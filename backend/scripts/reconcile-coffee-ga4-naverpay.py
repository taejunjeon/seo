#!/usr/bin/env python3
import argparse
import base64
import contextlib
import io
import json
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from dotenv import dotenv_values
from google.oauth2 import service_account
from googleapiclient.discovery import build


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
ENV_PATH = BACKEND_ROOT / ".env"
CRM_DB_PATH = BACKEND_ROOT / "data" / "crm.sqlite3"

COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c"
COFFEE_DATASET = "analytics_326949178"
COFFEE_LOCATION = "asia-northeast3"
NAVER_BASE_URL = "https://api.commerce.naver.com/external"
KST = timezone(timedelta(hours=9))


def load_env() -> dict[str, str]:
    # backend/.env has a few non-python-dotenv-compatible lines. Keep parser warnings out
    # of the reconciliation output because this script prints machine-readable JSON.
    with contextlib.redirect_stderr(io.StringIO()):
        parsed = dotenv_values(ENV_PATH)
    return {k: v for k, v in parsed.items() if k and v}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconcile Coffee GA4 NPAY transactions with Naver Commerce API.")
    parser.add_argument("--startSuffix", default="20260412")
    parser.add_argument("--endSuffix", default="20260417")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--maxProbeOrders", type=int, default=5)
    return parser.parse_args()


def suffix_to_date(suffix: str) -> str:
    return f"{suffix[:4]}-{suffix[4:6]}-{suffix[6:8]}"


def next_date(date_str: str) -> str:
    return (datetime.fromisoformat(date_str).date() + timedelta(days=1)).isoformat()


def parse_number(value) -> int:
    if value is None or value == "":
        return 0
    return round(float(value))


def query_bigquery_npay(env: dict[str, str], start_suffix: str, end_suffix: str) -> list[dict]:
    raw_key = env.get("GA4_SERVICE_ACCOUNT_KEY") or env.get("GA4_BIOCOM_SERVICE_ACCOUNT_KEY")
    if not raw_key:
        raise RuntimeError("GA4 service account key missing")
    credentials_info = json.loads(raw_key)
    credentials = service_account.Credentials.from_service_account_info(
        credentials_info,
        scopes=[
            "https://www.googleapis.com/auth/bigquery.readonly",
            "https://www.googleapis.com/auth/cloud-platform.read-only",
        ],
    )
    bq = build("bigquery", "v2", credentials=credentials, cache_discovery=False)
    query = f"""
      SELECT
        COALESCE(ecommerce.transaction_id, (
          SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
        )) AS transaction_id,
        event_date,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E3S%Ez', TIMESTAMP_MICROS(MAX(event_timestamp)), 'Asia/Seoul') AS event_time_kst,
        ROUND(SUM(COALESCE(ecommerce.purchase_revenue, 0))) AS ga4_gross,
        COUNT(*) AS purchase_events
      FROM `{COFFEE_PROJECT_ID}.{COFFEE_DATASET}.events_*`
      WHERE _TABLE_SUFFIX BETWEEN '{start_suffix}' AND '{end_suffix}'
        AND event_name = 'purchase'
      GROUP BY transaction_id, event_date
      HAVING STARTS_WITH(UPPER(transaction_id), 'NPAY')
      ORDER BY event_date, transaction_id
    """
    response = (
        bq.jobs()
        .query(
            projectId=COFFEE_PROJECT_ID,
            body={"query": query, "useLegacySql": False, "location": COFFEE_LOCATION},
        )
        .execute()
    )
    fields = [field["name"] for field in response["schema"]["fields"]]
    rows = []
    for row in response.get("rows", []):
        item = dict(zip(fields, [cell.get("v") for cell in row.get("f", [])]))
        transaction_id = item.get("transaction_id") or ""
        parts = [part.strip() for part in transaction_id.split(" - ")]
        middle = parts[1] if len(parts) >= 3 else ""
        timestamp_ms = parts[2] if len(parts) >= 3 else ""
        rows.append(
            {
                "transactionId": transaction_id,
                "middleKey": middle,
                "timestampMs": timestamp_ms,
                "eventDate": item.get("event_date") or "",
                "eventTimeKst": item.get("event_time_kst") or "",
                "ga4Gross": parse_number(item.get("ga4_gross")),
                "purchaseEvents": parse_number(item.get("purchase_events")),
            }
        )
    return rows


def naver_signature(client_id: str, client_secret: str) -> tuple[str, str]:
    timestamp = str(int(time.time() * 1000))
    hashed = bcrypt.hashpw(f"{client_id}_{timestamp}".encode("utf-8"), client_secret.encode("utf-8"))
    return timestamp, base64.b64encode(hashed).decode("utf-8")


def naver_request(method: str, path: str, data=None, token: str | None = None, json_body: bool = False) -> dict:
    headers = {"Accept": "application/json"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        if json_body:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            body = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
    request = urllib.request.Request(NAVER_BASE_URL + path, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            text = response.read().decode("utf-8", "replace")
            return {
                "httpStatus": response.status,
                "headers": {
                    key: response.headers.get(key)
                    for key in ["GNCP-GW-Trace-ID", "GNCP-GW-RateLimit-Remaining"]
                    if response.headers.get(key)
                },
                "body": json.loads(text) if text else None,
            }
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", "replace")
        try:
            body_json = json.loads(text) if text else None
        except Exception:
            body_json = {"raw": text[:500]}
        return {
            "httpStatus": error.code,
            "headers": {
                key: error.headers.get(key)
                for key in ["GNCP-GW-Trace-ID", "GNCP-GW-RateLimit-Remaining"]
                if error.headers.get(key)
            },
            "body": body_json,
        }


def issue_naver_token(env: dict[str, str]) -> dict:
    client_id = (env.get("BIOCOM_STORE_APP_ID") or "").strip()
    client_secret = (env.get("BIOCOM_STORE_APP_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET missing")
    timestamp, signature = naver_signature(client_id, client_secret)
    response = naver_request(
        "POST",
        "/v1/oauth2/token",
        {
            "client_id": client_id,
            "timestamp": timestamp,
            "client_secret_sign": signature,
            "grant_type": "client_credentials",
            "type": "SELF",
        },
    )
    if response["httpStatus"] != 200:
        return {"ok": False, "response": response}
    token = response["body"].get("access_token")
    safe_response = {
        "httpStatus": response["httpStatus"],
        "headers": response["headers"],
        "body": {
            "access_token": "***MASKED***",
            "expires_in": response["body"].get("expires_in"),
            "token_type": response["body"].get("token_type"),
        },
    }
    return {"ok": True, "token": token, "safeResponse": safe_response}


def fetch_naver_product_orders(token: str, start_date: str, end_date: str) -> tuple[list[dict], list[dict]]:
    statuses: list[dict] = []
    errors: list[dict] = []
    current = datetime.fromisoformat(start_date).date()
    end = datetime.fromisoformat(end_date).date()
    while current <= end:
        last_changed_from = f"{current.isoformat()}T00:00:00.000+09:00"
        last_changed_to = f"{(current + timedelta(days=1)).isoformat()}T00:00:00.000+09:00"
        more_sequence = None
        for _ in range(20):
            params = {
                "lastChangedFrom": last_changed_from,
                "lastChangedTo": last_changed_to,
                "limitCount": "300",
            }
            if more_sequence:
                params["moreSequence"] = more_sequence
            response = naver_request(
                "GET",
                f"/v1/pay-order/seller/product-orders/last-changed-statuses?{urllib.parse.urlencode(params)}",
                token=token,
            )
            if response["httpStatus"] == 429:
                time.sleep(1.2)
                response = naver_request(
                    "GET",
                    f"/v1/pay-order/seller/product-orders/last-changed-statuses?{urllib.parse.urlencode(params)}",
                    token=token,
                )
            if response["httpStatus"] != 200:
                errors.append({"date": current.isoformat(), "response": sanitize_error_response(response)})
                break
            data = (response["body"] or {}).get("data") or {}
            statuses.extend(data.get("lastChangeStatuses") or [])
            more = data.get("more") or {}
            if not more:
                break
            last_changed_from = more.get("moreFrom") or last_changed_from
            more_sequence = more.get("moreSequence")
            if not more_sequence:
                break
            time.sleep(0.45)
        current += timedelta(days=1)
        time.sleep(0.45)

    product_order_ids = []
    seen = set()
    for row in statuses:
        product_order_id = row.get("productOrderId")
        if product_order_id and product_order_id not in seen:
            product_order_ids.append(product_order_id)
            seen.add(product_order_id)

    details: list[dict] = []
    for start in range(0, len(product_order_ids), 300):
        response = naver_request(
            "POST",
            "/v1/pay-order/seller/product-orders/query",
            {"productOrderIds": product_order_ids[start : start + 300]},
            token=token,
            json_body=True,
        )
        if response["httpStatus"] == 429:
            time.sleep(1.2)
            response = naver_request(
                "POST",
                "/v1/pay-order/seller/product-orders/query",
                {"productOrderIds": product_order_ids[start : start + 300]},
                token=token,
                json_body=True,
            )
        if response["httpStatus"] != 200:
            errors.append({"detailChunk": start, "response": sanitize_error_response(response)})
            continue
        data = (response["body"] or {}).get("data")
        if isinstance(data, list):
            details.extend(data)
        time.sleep(0.45)

    return details, errors


def sanitize_error_response(response: dict) -> dict:
    body = response.get("body")
    return {
        "httpStatus": response.get("httpStatus"),
        "headers": response.get("headers"),
        "body": {
            "code": body.get("code") if isinstance(body, dict) else None,
            "message": body.get("message") if isinstance(body, dict) else None,
            "traceId": body.get("traceId") if isinstance(body, dict) else None,
        },
    }


def aggregate_naver_orders(details: list[dict], start_date: str, end_date: str) -> dict[str, dict]:
    orders: dict[str, dict] = {}
    for item in details:
        product_order = item.get("productOrder") or {}
        order = item.get("order") or {}
        order_id = product_order.get("orderId") or order.get("orderId")
        product_order_id = product_order.get("productOrderId")
        payment_date = product_order.get("paymentDate") or order.get("paymentDate") or ""
        if not order_id or not (start_date <= payment_date[:10] <= end_date):
            continue
        current = orders.setdefault(
            order_id,
            {
                "orderId": order_id,
                "productOrderIds": set(),
                "statuses": Counter(),
                "paymentDate": payment_date,
                "gross": 0,
                "deliveryFee": 0,
            },
        )
        if product_order_id:
            current["productOrderIds"].add(product_order_id)
        current["statuses"][product_order.get("productOrderStatus") or "UNKNOWN"] += 1
        current["gross"] += parse_number(product_order.get("totalPaymentAmount"))
        current["deliveryFee"] += parse_number(product_order.get("deliveryFeeAmount"))
        if payment_date and payment_date < current["paymentDate"]:
            current["paymentDate"] = payment_date
    for order in orders.values():
        order["productOrderIds"] = sorted(order["productOrderIds"])
        order["statuses"] = dict(order["statuses"])
    return orders


def match_by_amount_and_time(ga4_rows: list[dict], naver_orders: dict[str, dict], tolerance_minutes: int = 10) -> list[dict]:
    matches = []
    for ga4 in ga4_rows:
        ga4_time = parse_kst_datetime(ga4["eventTimeKst"])
        candidates = []
        for order in naver_orders.values():
            order_time = parse_kst_datetime(order["paymentDate"])
            diff_minutes = abs((ga4_time - order_time).total_seconds()) / 60 if ga4_time and order_time else None
            if order["gross"] == ga4["ga4Gross"] and diff_minutes is not None and diff_minutes <= tolerance_minutes:
                candidates.append({"orderId": order["orderId"], "diffMinutes": round(diff_minutes, 2), "gross": order["gross"]})
        matches.append({"transactionId": ga4["transactionId"], "candidateCount": len(candidates), "candidates": candidates[:5]})
    return matches


def parse_kst_datetime(value: str):
    if not value:
        return None
    normalized = value
    if len(value) >= 5 and value[-5] in ["+", "-"] and value[-3] != ":":
        normalized = value[:-2] + ":" + value[-2:]
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=KST)
    return parsed.astimezone(KST)


def local_imweb_candidate_summary(ga4_rows: list[dict]) -> dict:
    if not CRM_DB_PATH.exists():
        return {"available": False}
    conn = sqlite3.connect(CRM_DB_PATH)
    conn.row_factory = sqlite3.Row
    unique_amount = 0
    unique_amount_gross = 0
    prefix_candidates = 0
    no_amount = 0
    candidate_order_ids = []
    for ga4 in ga4_rows:
        middle = ga4["middleKey"]
        gross = ga4["ga4Gross"]
        candidates = conn.execute(
            """
            SELECT order_no, order_code, channel_order_no, total_price, payment_amount, delivery_price
            FROM imweb_orders
            WHERE site='thecleancoffee' AND pay_type='npay'
              AND (order_code LIKE ? OR order_no LIKE ? OR channel_order_no LIKE ?)
            """,
            (f"o{middle}%", f"{middle}%", f"{middle}%"),
        ).fetchall()
        if candidates:
            prefix_candidates += 1
        amount_matches = []
        for row in candidates:
            values = [
                parse_number(row["total_price"]),
                parse_number(row["payment_amount"]),
                parse_number(row["payment_amount"]) - parse_number(row["delivery_price"]),
            ]
            if gross in values:
                amount_matches.append(row)
        if len(amount_matches) == 1:
            unique_amount += 1
            unique_amount_gross += gross
            channel_order_no = amount_matches[0]["channel_order_no"]
            if channel_order_no:
                candidate_order_ids.append(channel_order_no)
        elif len(amount_matches) == 0:
            no_amount += 1
    conn.close()
    return {
        "available": True,
        "prefixCandidateRows": prefix_candidates,
        "uniqueAmountMatchRows": unique_amount,
        "uniqueAmountMatchGross": unique_amount_gross,
        "noAmountMatchRows": no_amount,
        "candidateNaverOrderIdsSample": candidate_order_ids[:10],
    }


def probe_naver_order_access(token: str, order_ids: list[str], max_probe: int) -> dict:
    probes = []
    for order_id in order_ids[:max_probe]:
        response = naver_request(
            "GET",
            f"/v1/pay-order/seller/orders/{urllib.parse.quote(order_id)}/product-order-ids",
            token=token,
        )
        body = response.get("body") if isinstance(response.get("body"), dict) else {}
        probes.append(
            {
                "httpStatus": response["httpStatus"],
                "code": body.get("code"),
                "message": body.get("message"),
            }
        )
        time.sleep(0.45)
    return {
        "probed": len(probes),
        "statusCounts": dict(Counter(str(item["httpStatus"]) for item in probes)),
        "messages": dict(Counter(item.get("message") or "OK" for item in probes)),
    }


def build_result(args: argparse.Namespace) -> dict:
    env = load_env()
    start_date = suffix_to_date(args.startSuffix)
    end_date = suffix_to_date(args.endSuffix)
    ga4_rows = query_bigquery_npay(env, args.startSuffix, args.endSuffix)
    token_result = issue_naver_token(env)
    if not token_result["ok"]:
        return {
            "ok": False,
            "checkedAt": datetime.now(KST).isoformat(timespec="seconds"),
            "stage": "naver_token",
            "token": token_result["response"],
        }

    naver_details, naver_errors = fetch_naver_product_orders(token_result["token"], start_date, end_date)
    naver_orders = aggregate_naver_orders(naver_details, start_date, end_date)
    amount_time_matches = match_by_amount_and_time(ga4_rows, naver_orders)
    local_summary = local_imweb_candidate_summary(ga4_rows)
    access_probe = {"probed": 0, "statusCounts": {}, "messages": {}}
    if local_summary.get("candidateNaverOrderIdsSample"):
        access_probe = probe_naver_order_access(
            token_result["token"],
            local_summary["candidateNaverOrderIdsSample"],
            args.maxProbeOrders,
        )

    unique_amount_time = [row for row in amount_time_matches if row["candidateCount"] == 1]
    multi_amount_time = [row for row in amount_time_matches if row["candidateCount"] > 1]
    ga4_gross = sum(row["ga4Gross"] for row in ga4_rows)
    naver_gross = sum(order["gross"] for order in naver_orders.values())

    return {
        "ok": True,
        "checkedAt": datetime.now(KST).isoformat(timespec="seconds"),
        "window": {"startSuffix": args.startSuffix, "endSuffix": args.endSuffix, "startDate": start_date, "endDate": end_date},
        "sources": {
            "ga4": f"{COFFEE_PROJECT_ID}.{COFFEE_DATASET}.events_*",
            "naverApiCredential": "BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET",
            "localImwebCache": str(CRM_DB_PATH.relative_to(REPO_ROOT)),
        },
        "token": token_result["safeResponse"],
        "ga4Npay": {
            "transactions": len(ga4_rows),
            "purchaseEvents": sum(row["purchaseEvents"] for row in ga4_rows),
            "gross": ga4_gross,
        },
        "naverApiLedger": {
            "detailRows": len(naver_details),
            "ordersInPaymentWindow": len(naver_orders),
            "grossInPaymentWindow": naver_gross,
            "statusCounts": dict(sum((Counter(order["statuses"]) for order in naver_orders.values()), Counter())),
            "errors": naver_errors[:5],
        },
        "ga4ToCurrentNaverApiMatch": {
            "method": "same gross and payment timestamp within 10 minutes",
            "uniqueMatches": len(unique_amount_time),
            "multiMatches": len(multi_amount_time),
            "matchedGross": sum(
                ga4["ga4Gross"]
                for ga4 in ga4_rows
                if any(match["transactionId"] == ga4["transactionId"] and match["candidateCount"] == 1 for match in amount_time_matches)
            ),
        },
        "localImwebAuxiliaryMatch": {
            key: value for key, value in local_summary.items() if key != "candidateNaverOrderIdsSample"
        },
        "coffeeNaverOrderAccessProbe": access_probe,
        "interpretation": [
            "Current Naver Commerce API credential opens order APIs, but it is scoped to the Biocom store.",
            "The 65 GA4 NPAY transactions are from the TheCleanCoffee GA4 dataset and do not directly match current Naver API orders.",
            "Local Imweb cache can find a few historical TheCleanCoffee NPAY candidates, but the current Naver credential returns no authority for those channel order numbers.",
        ],
    }


def print_markdown(result: dict) -> None:
    print("# Coffee GA4 NPAY ↔ Naver Commerce API reconciliation")
    print("")
    print(f"- checkedAt: {result.get('checkedAt')}")
    print(f"- window: {result.get('window', {}).get('startDate')} ~ {result.get('window', {}).get('endDate')}")
    if not result.get("ok"):
        print(f"- failed stage: {result.get('stage')}")
        return
    print("")
    print("| Metric | Value |")
    print("|---|---:|")
    print(f"| GA4 NPAY transactions | {result['ga4Npay']['transactions']} |")
    print(f"| GA4 NPAY gross | {result['ga4Npay']['gross']} |")
    print(f"| Naver API orders in payment window | {result['naverApiLedger']['ordersInPaymentWindow']} |")
    print(f"| Naver API gross in payment window | {result['naverApiLedger']['grossInPaymentWindow']} |")
    print(f"| GA4 ↔ current Naver API unique matches | {result['ga4ToCurrentNaverApiMatch']['uniqueMatches']} |")
    print(f"| GA4 ↔ current Naver API matched gross | {result['ga4ToCurrentNaverApiMatch']['matchedGross']} |")
    print(f"| Local Imweb unique auxiliary candidates | {result['localImwebAuxiliaryMatch'].get('uniqueAmountMatchRows', 0)} |")
    print(f"| Coffee Naver order access probe count | {result['coffeeNaverOrderAccessProbe']['probed']} |")
    print("")
    print("## Interpretation")
    for line in result.get("interpretation", []):
        print(f"- {line}")


def main() -> None:
    args = parse_args()
    result = build_result(args)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_markdown(result)


if __name__ == "__main__":
    main()
