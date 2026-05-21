#!/usr/bin/env python3
"""
No-send Meta CAPI payload preview.

This script intentionally prints only aggregate field-presence counts. It does
not print raw order, payment, member, phone, email, click, or hash values.
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SITES = {
    "biocom": "biocom_imweb",
    "thecleancoffee": "thecleancoffee_imweb",
}

WINDOWS = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


def parse_iso(value: str) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    candidates = [
        raw,
        raw.replace("Z", "+00:00"),
        raw.replace(" ", "T"),
    ]
    for candidate in candidates:
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def safe_json(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def metadata_first(metadata: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = metadata.get(key)
        if text(value):
            return text(value)
    return ""


def phone_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def phone_hash_candidate(value: str) -> bool:
    digits = phone_digits(value)
    return len(digits) >= 9


def load_success_log(path: Path, since: datetime) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = defaultdict(lambda: {"success": 0, "failed": 0, "events_received": 0})
    if not path.exists():
        return result
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue
            ts = parse_iso(text(item.get("timestamp")))
            if ts is None or ts < since:
                continue
            ledger = item.get("ledger_entry") if isinstance(item.get("ledger_entry"), dict) else {}
            source = text(ledger.get("source"))
            site = next((s for s, src in SITES.items() if src == source), "unknown")
            status = int(item.get("response_status") or 0)
            body = item.get("response_body") if isinstance(item.get("response_body"), dict) else {}
            events_received = int(body.get("events_received") or 0)
            if status == 200 and events_received > 0:
                result[site]["success"] += 1
                result[site]["events_received"] += events_received
            else:
                result[site]["failed"] += 1
    return result


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: no_send_payload_preview.py <sqlite_db> <meta_capi_jsonl>", file=sys.stderr)
        return 2

    db_path = Path(sys.argv[1])
    log_path = Path(sys.argv[2])
    now = datetime.now(timezone.utc)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    output: dict[str, Any] = {
        "generated_at_utc": now.isoformat(),
        "raw_identifier_output": False,
        "mode": "no_send_payload_preview",
        "external_send": False,
        "windows": {},
    }

    for window_name, delta in WINDOWS.items():
        since = now - delta
        send_log = load_success_log(log_path, since)
        window_payload: dict[str, Any] = {"since_utc": since.isoformat(), "sites": {}}

        for site, source in SITES.items():
            rows = conn.execute(
                """
                SELECT
                  l.logged_at,
                  l.order_id,
                  l.payment_key,
                  l.customer_key,
                  l.fbclid,
                  l.metadata_json,
                  l.request_context_json,
                  i.member_code,
                  i.orderer_call
                FROM attribution_ledger l
                LEFT JOIN imweb_orders i
                  ON i.site = ?
                 AND (
                   i.order_no = l.order_id
                   OR i.order_code = l.order_id
                   OR i.order_no = json_extract(l.metadata_json, '$.order_no')
                   OR i.order_code = json_extract(l.metadata_json, '$.order_code')
                 )
                WHERE l.touchpoint = 'payment_success'
                  AND l.payment_status = 'confirmed'
                  AND l.source = ?
                  AND l.logged_at >= ?
                """,
                (site, source, since.strftime("%Y-%m-%dT%H:%M:%S")),
            ).fetchall()

            counts: dict[str, int] = defaultdict(int)
            for row in rows:
                counts["confirmed_candidates"] += 1
                metadata = safe_json(row["metadata_json"])
                request_context = safe_json(row["request_context_json"])

                if text(request_context.get("ip")):
                    counts["current_client_ip_address_present"] += 1
                if text(request_context.get("userAgent")) or text(request_context.get("user_agent")):
                    counts["current_client_user_agent_present"] += 1
                if metadata_first(metadata, ["fbp"]):
                    counts["current_fbp_present"] += 1
                if metadata_first(metadata, ["fbc"]):
                    counts["current_fbc_present"] += 1
                if text(row["fbclid"]) or metadata_first(metadata, ["fbclid"]):
                    counts["fbclid_or_fbc_buildable"] += 1

                current_email = metadata_first(metadata, ["email", "customerEmail", "buyerEmail"])
                current_phone = metadata_first(metadata, ["phone", "mobile", "mobilePhone", "customerMobilePhone", "buyerPhone"])
                if current_email:
                    counts["current_email_hash_source_present"] += 1
                if current_phone:
                    counts["current_phone_hash_source_present"] += 1

                if text(row["customer_key"]):
                    counts["ledger_customer_key_present"] += 1
                if text(row["member_code"]):
                    counts["imweb_member_code_present"] += 1
                    counts["preview_external_id_hmac_candidate_present"] += 1
                if phone_hash_candidate(text(row["orderer_call"])):
                    counts["imweb_phone_present"] += 1
                    counts["preview_ph_hash_candidate_present"] += 1

            n = counts["confirmed_candidates"]
            after = {
                "client_ip_address": counts["current_client_ip_address_present"],
                "client_user_agent": counts["current_client_user_agent_present"],
                "fbp": counts["current_fbp_present"],
                "fbc": counts["current_fbc_present"],
                "em": counts["current_email_hash_source_present"],
                "ph_current": counts["current_phone_hash_source_present"],
                "ph_with_imweb_preview": counts["preview_ph_hash_candidate_present"],
                "external_id_current": 0,
                "external_id_with_hmac_preview": counts["preview_external_id_hmac_candidate_present"],
            }
            site_payload = {
                "confirmed_candidates": n,
                "send_log": send_log.get(site, {"success": 0, "failed": 0, "events_received": 0}),
                "current_user_data_presence_counts": {
                    "client_ip_address": counts["current_client_ip_address_present"],
                    "client_user_agent": counts["current_client_user_agent_present"],
                    "fbp": counts["current_fbp_present"],
                    "fbc": counts["current_fbc_present"],
                    "em": counts["current_email_hash_source_present"],
                    "ph": counts["current_phone_hash_source_present"],
                    "external_id": 0,
                },
                "no_send_preview_presence_counts": {
                    "ph_from_imweb_orderer_call": counts["preview_ph_hash_candidate_present"],
                    "external_id_from_imweb_member_hmac": counts["preview_external_id_hmac_candidate_present"],
                },
                "after_preview_user_data_presence_counts": after,
                "candidate_rates_pct": {
                    "ph_preview": round(counts["preview_ph_hash_candidate_present"] / n * 100, 2) if n else 0,
                    "external_id_preview": round(counts["preview_external_id_hmac_candidate_present"] / n * 100, 2) if n else 0,
                    "current_fbc": round(counts["current_fbc_present"] / n * 100, 2) if n else 0,
                    "current_fbp": round(counts["current_fbp_present"] / n * 100, 2) if n else 0,
                },
                "sanitized_payload_shape": {
                    "event_name": "Purchase",
                    "user_data": {
                        "client_ip_address": "present_or_absent",
                        "client_user_agent": "present_or_absent",
                        "fbp": "present_or_absent",
                        "fbc": "present_or_absent",
                        "ph": "sha256_normalized_phone_if_approved",
                        "external_id": "hmac_sha256_site_member_code_if_approved",
                    },
                    "custom_data": {
                        "currency": "KRW",
                        "value": "positive_confirmed_order_total",
                        "order_id": "already_sent_order_key",
                    },
                },
            }
            window_payload["sites"][site] = site_payload

        output["windows"][window_name] = window_payload

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
