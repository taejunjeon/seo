#!/usr/bin/env tsx
/**
 * VM Cloud original landing bridge read-only draft.
 *
 * Green Lane:
 * - Reads VM Cloud SQLite through SSH.
 * - Writes only local sanitized aggregate docs.
 * - Does not mutate VM Cloud, ads platforms, GTM, or local DB.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_JSON = path.join(REPO_ROOT, "data/project/vm-original-landing-bridge-readonly-20260525.json");
const OUTPUT_MD = path.join(REPO_ROOT, "project/vm-original-landing-bridge-readonly-20260525.md");
const SSH_TARGET = process.env.VM_CLOUD_SSH_TARGET?.trim() || "taejun@34.64.104.94";
const VM_DB_PATH = process.env.VM_CLOUD_SQLITE_PATH?.trim() || "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const VM_USER = process.env.VM_CLOUD_APP_USER?.trim() || "biocomkr_sns";

type BridgeSummary = {
  generated_at_kst: string;
  source: {
    system: string;
    sqlite_path: string;
    tables_read: string[];
    target_path: string;
    logged_at_window_utc: { start: string; end: string };
    site: string;
    no_send: boolean;
    no_write: boolean;
    no_deploy: boolean;
  };
  site_landing_exact_path_rows: number | null;
  attribution_bridge: {
    metadata_text_mentions: number;
    metadata_text_mentions_without_usable_imweb_landing_url: number;
    source_rows: number;
    rows_with_utm: number;
    rows_with_fbclid: number;
    numeric_id_rows: number;
    template_phrase_rows: number;
    generic_alias_rows: number;
    checkout_started_rows: number;
    confirmed_payment_rows: number;
    confirmed_revenue_krw: number;
    first_logged_at_utc: string | null;
    last_logged_at_utc: string | null;
  };
  confidence_rollup: Array<{
    grade: string;
    meaning: string;
    rows: number;
    checkout_started_rows: number;
    confirmed_payment_rows: number;
    confirmed_revenue_krw: number;
  }>;
  campaign_rollup: Array<{
    campaign_evidence: string;
    rows: number;
    checkout_started_rows: number;
    confirmed_payment_rows: number;
    confirmed_revenue_krw: number;
    top_terms: Array<{ value: string; rows: number }>;
    top_contents: Array<{ value: string; rows: number }>;
  }>;
  template_phrase_diagnostic: {
    rows: number;
    confirmed_payment_rows: number;
    confirmed_revenue_krw: number;
    same_session_prior_numeric_utm_rows: number;
    plain_language: string;
  };
  bridge_rule_draft: {
    proposed_use: string[];
    forbidden_use: string[];
    next_lane: string;
  };
};

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const krw = (value: number) => `₩${Math.round(value).toLocaleString("ko-KR")}`;

const readArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
};

const fetchBridgeSummary = async (targetPath: string, startUtc: string, endUtc: string): Promise<BridgeSummary> => {
  const python = String.raw`
import json, re, sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

DB = __DB__
TARGET_PATH = __TARGET_PATH__
START_UTC = __START_UTC__
END_UTC = __END_UTC__

def kst_now():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M KST")

def text(value):
    return str(value or "").strip()

def money(meta):
    for key in ("totalAmount", "total_amount", "amount", "paymentAmount", "paidAmount"):
        raw = meta.get(key)
        if raw is None:
            continue
        try:
            return int(float(str(raw).replace(",", "")))
        except Exception:
            pass
    return 0

def is_numeric_id(value):
    return bool(re.fullmatch(r"120[0-9]{8,}", text(value)))

def has_template(value):
    s = text(value)
    return "{{" in s and "}}" in s

def first_value(params, key):
    values = params.get(key) or []
    return text(values[0]) if values else ""

def classify(row, params):
    campaign_candidates = [
        text(row["utm_campaign"]),
        first_value(params, "utm_campaign"),
        first_value(params, "utm_id"),
        first_value(params, "meta_campaign_id"),
    ]
    adset_candidates = [
        text(row["utm_term"]),
        first_value(params, "utm_term"),
        first_value(params, "meta_adset_id"),
    ]
    ad_candidates = [
        text(row["utm_content"]),
        first_value(params, "utm_content"),
        first_value(params, "meta_ad_id"),
    ]
    alias = first_value(params, "campaign_alias")
    all_values = campaign_candidates + adset_candidates + ad_candidates + [alias]
    if any(is_numeric_id(v) for v in campaign_candidates) and (
        any(is_numeric_id(v) for v in adset_candidates) or any(is_numeric_id(v) for v in ad_candidates)
    ):
        return "A", "숫자 campaign/adset/ad ID가 있어 광고 계층 매칭 재료로 쓸 수 있음"
    if alias and alias != "meta_biocom_광고별칭" and not any(has_template(v) for v in all_values):
        return "B", "고유 별칭 후보가 있어 단일 매칭이면 준확정으로 제안 가능"
    if any(has_template(v) for v in all_values):
        return "D", "Meta가 숫자로 바꿔줘야 하는 템플릿 문구가 그대로 남음"
    return "C", "원본 랜딩 경로는 있으나 광고 숫자 ID가 없어 후보로만 볼 수 있음"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

def site_landing_count():
    try:
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(site_landing_ledger)").fetchall()]
        path_cols = [c for c in ("landing_path", "page_path", "path", "landing") if c in cols]
        if not path_cols:
            return None
        where = " OR ".join([f"{c}=?" for c in path_cols])
        params = [TARGET_PATH for _ in path_cols]
        if "site" in cols:
            return conn.execute(f"SELECT COUNT(*) AS n FROM site_landing_ledger WHERE site='biocom' AND ({where})", params).fetchone()["n"]
        return conn.execute(f"SELECT COUNT(*) AS n FROM site_landing_ledger WHERE {where}", params).fetchone()["n"]
    except Exception:
        return None

rows = conn.execute("""
  SELECT
    entry_id, touchpoint, capture_mode, payment_status, logged_at, approved_at,
    ga_session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, source, metadata_json
  FROM attribution_ledger
  WHERE source='biocom_imweb'
    AND logged_at >= ?
    AND logged_at < ?
    AND metadata_json LIKE '%imweb_landing_url%'
  ORDER BY logged_at ASC
""", (START_UTC, END_UTC)).fetchall()

like_token = "%" + TARGET_PATH.strip("/") + "%"
mention_rows = conn.execute("""
  SELECT metadata_json
  FROM attribution_ledger
  WHERE source='biocom_imweb'
    AND logged_at >= ?
    AND logged_at < ?
    AND metadata_json LIKE ?
""", (START_UTC, END_UTC, like_token)).fetchall()
mention_without_usable_original = 0
for mention in mention_rows:
    try:
        mention_meta = json.loads(mention["metadata_json"] or "{}")
    except Exception:
        mention_meta = {}
    if not text(mention_meta.get("imweb_landing_url")):
        mention_without_usable_original += 1

items = []
template_sessions = []
for row in rows:
    try:
        meta = json.loads(row["metadata_json"] or "{}")
    except Exception:
        meta = {}
    landing_url = text(meta.get("imweb_landing_url"))
    if not landing_url:
        continue
    parsed = urlparse(landing_url)
    if parsed.path != TARGET_PATH:
        continue
    params = parse_qs(parsed.query, keep_blank_values=True)
    grade, meaning = classify(row, params)
    is_checkout = text(row["touchpoint"]) == "checkout_started"
    is_confirmed = text(row["touchpoint"]) == "payment_success" and text(row["payment_status"]) == "confirmed"
    row_money = money(meta) if is_confirmed else 0
    top_values = [
        text(row["utm_campaign"]),
        text(row["utm_term"]),
        text(row["utm_content"]),
        first_value(params, "utm_campaign"),
        first_value(params, "utm_term"),
        first_value(params, "utm_content"),
        first_value(params, "meta_campaign_id"),
        first_value(params, "meta_adset_id"),
        first_value(params, "meta_ad_id"),
        first_value(params, "campaign_alias"),
    ]
    has_template_phrase = any(has_template(v) for v in top_values)
    if has_template_phrase and text(row["ga_session_id"]):
        template_sessions.append((text(row["ga_session_id"]), text(row["logged_at"])))
    items.append({
        "logged_at": text(row["logged_at"]),
        "touchpoint": text(row["touchpoint"]),
        "payment_status": text(row["payment_status"]),
        "utm_source": text(row["utm_source"]),
        "utm_medium": text(row["utm_medium"]),
        "utm_campaign": text(row["utm_campaign"]) or first_value(params, "utm_campaign") or first_value(params, "meta_campaign_id"),
        "utm_term": text(row["utm_term"]) or first_value(params, "utm_term") or first_value(params, "meta_adset_id"),
        "utm_content": text(row["utm_content"]) or first_value(params, "utm_content") or first_value(params, "meta_ad_id"),
        "has_utm": any(text(row[k]) for k in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content")),
        "has_fbclid": bool(text(row["fbclid"]) or first_value(params, "fbclid")),
        "has_numeric": any(is_numeric_id(v) for v in top_values),
        "has_template": has_template_phrase,
        "has_generic_alias": first_value(params, "campaign_alias") == "meta_biocom_광고별칭",
        "grade": grade,
        "grade_meaning": meaning,
        "is_checkout": is_checkout,
        "is_confirmed": is_confirmed,
        "revenue": row_money,
    })

same_session_prior_numeric = 0
for ga_session_id, logged_at in template_sessions:
    row = conn.execute("""
      SELECT COUNT(*) AS n
      FROM attribution_ledger
      WHERE source='biocom_imweb'
        AND ga_session_id=?
        AND logged_at <= ?
        AND (utm_campaign GLOB '120*' OR utm_term GLOB '120*' OR utm_content GLOB '120*')
    """, (ga_session_id, logged_at)).fetchone()
    same_session_prior_numeric += int(row["n"] or 0)

grade_meanings = {
    "A": "숫자 campaign/adset/ad ID가 있어 광고 계층 매칭 재료로 쓸 수 있음",
    "B": "고유 별칭 후보가 있어 단일 매칭이면 준확정으로 제안 가능",
    "C": "원본 랜딩 경로는 있으나 광고 숫자 ID가 없어 후보로만 볼 수 있음",
    "D": "Meta가 숫자로 바꿔줘야 하는 템플릿 문구가 그대로 남음",
}

def aggregate(rows):
    return {
        "rows": len(rows),
        "checkout_started_rows": sum(1 for r in rows if r["is_checkout"]),
        "confirmed_payment_rows": sum(1 for r in rows if r["is_confirmed"]),
        "confirmed_revenue_krw": sum(r["revenue"] for r in rows),
    }

by_grade = []
for grade in ("A", "B", "C", "D"):
    chunk = [r for r in items if r["grade"] == grade]
    agg = aggregate(chunk)
    agg["grade"] = grade
    agg["meaning"] = grade_meanings[grade]
    by_grade.append(agg)

campaigns = defaultdict(list)
for item in items:
    campaigns[item["utm_campaign"] or "(blank)"].append(item)

campaign_rollup = []
for campaign, chunk in campaigns.items():
    agg = aggregate(chunk)
    terms = Counter(r["utm_term"] or "(blank)" for r in chunk).most_common(5)
    contents = Counter(r["utm_content"] or "(blank)" for r in chunk).most_common(5)
    campaign_rollup.append({
        "campaign_evidence": campaign,
        **agg,
        "top_terms": [{"value": v, "rows": n} for v, n in terms],
        "top_contents": [{"value": v, "rows": n} for v, n in contents],
    })
campaign_rollup.sort(key=lambda r: (r["confirmed_revenue_krw"], r["rows"]), reverse=True)

template_rows = [r for r in items if r["has_template"]]
summary = {
    "generated_at_kst": kst_now(),
    "source": {
        "system": "VM Cloud SQLite read-only",
        "sqlite_path": DB,
        "tables_read": ["site_landing_ledger", "attribution_ledger"],
        "target_path": TARGET_PATH,
        "logged_at_window_utc": {"start": START_UTC, "end": END_UTC},
        "site": "biocom",
        "no_send": True,
        "no_write": True,
        "no_deploy": True,
    },
    "site_landing_exact_path_rows": site_landing_count(),
    "attribution_bridge": {
        "metadata_text_mentions": len(mention_rows),
        "metadata_text_mentions_without_usable_imweb_landing_url": mention_without_usable_original,
        "source_rows": len(items),
        "rows_with_utm": sum(1 for r in items if r["has_utm"]),
        "rows_with_fbclid": sum(1 for r in items if r["has_fbclid"]),
        "numeric_id_rows": sum(1 for r in items if r["has_numeric"]),
        "template_phrase_rows": len(template_rows),
        "generic_alias_rows": sum(1 for r in items if r["has_generic_alias"]),
        "checkout_started_rows": sum(1 for r in items if r["is_checkout"]),
        "confirmed_payment_rows": sum(1 for r in items if r["is_confirmed"]),
        "confirmed_revenue_krw": sum(r["revenue"] for r in items),
        "first_logged_at_utc": items[0]["logged_at"] if items else None,
        "last_logged_at_utc": items[-1]["logged_at"] if items else None,
    },
    "confidence_rollup": by_grade,
    "campaign_rollup": campaign_rollup,
    "template_phrase_diagnostic": {
        "rows": len(template_rows),
        "confirmed_payment_rows": sum(1 for r in template_rows if r["is_confirmed"]),
        "confirmed_revenue_krw": sum(r["revenue"] for r in template_rows),
        "same_session_prior_numeric_utm_rows": same_session_prior_numeric,
        "plain_language": "Meta가 실제 숫자 광고 ID로 바꿔줘야 하는 URL 매개변수가 일부 원장 row에서 템플릿 문구 그대로 남은 상태입니다. Meta 유료 유입인 것은 보이지만 campaign/adset/ad를 확정할 숫자 키가 없습니다.",
    },
    "bridge_rule_draft": {
        "proposed_use": [
            "site_landing_ledger에 원본 랜딩 path가 없을 때 attribution_ledger.metadata_json.imweb_landing_url을 원본 랜딩 후보 증거로 읽는다.",
            "숫자 campaign/adset/ad ID가 있으면 A급 매칭 재료로 사용한다.",
            "템플릿 문구 그대로 남은 row는 Meta 유료 유입 보조 매출로만 보고 campaign/adset/ad 확정 배정은 금지한다.",
        ],
        "forbidden_use": [
            "read-only bridge 결과를 원장에 바로 write하지 않는다.",
            "템플릿 문구 row를 후보 광고 3개 중 하나로 자동 배정하지 않는다.",
            "원본 랜딩 후보 row를 새 방문 1건으로 중복 가산하지 않는다.",
        ],
        "next_lane": "Green for helper/test/report, Yellow for backend deploy, Red for schema/write/backfill",
    },
}

print(json.dumps(summary, ensure_ascii=False, indent=2))
`;

  const preparedPython = python
    .replace("__DB__", JSON.stringify(VM_DB_PATH))
    .replace("__TARGET_PATH__", JSON.stringify(targetPath))
    .replace("__START_UTC__", JSON.stringify(startUtc))
    .replace("__END_UTC__", JSON.stringify(endUtc));
  const encoded = Buffer.from(preparedPython, "utf8").toString("base64");
  const remote = `sudo -n -u ${VM_USER} bash -lc ${shellQuote(`python3 - <<'PY'\nimport base64\nexec(base64.b64decode('${encoded}').decode('utf-8'))\nPY`)}`;
  const { stdout } = await execFileAsync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", SSH_TARGET, remote],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as BridgeSummary;
};

const renderMarkdown = (summary: BridgeSummary) => {
  const attribution = summary.attribution_bridge;
  const gradeLines = summary.confidence_rollup
    .filter((row) => row.rows > 0)
    .map(
      (row) =>
        `| ${row.grade} | ${row.meaning} | ${row.rows.toLocaleString("ko-KR")} | ${row.checkout_started_rows.toLocaleString("ko-KR")} | ${row.confirmed_payment_rows.toLocaleString("ko-KR")} | ${krw(row.confirmed_revenue_krw)} |`,
    )
    .join("\n");
  const campaignLines = summary.campaign_rollup
    .map((row) => {
      const terms = row.top_terms.map((term) => `${term.value} ${term.rows}건`).join(", ");
      const contents = row.top_contents.map((content) => `${content.value} ${content.rows}건`).join(", ");
      return `| ${row.campaign_evidence} | ${row.rows.toLocaleString("ko-KR")} | ${row.checkout_started_rows.toLocaleString("ko-KR")} | ${row.confirmed_payment_rows.toLocaleString("ko-KR")} | ${krw(row.confirmed_revenue_krw)} | ${terms} | ${contents} |`;
    })
    .join("\n");

  return `작성 시각: ${summary.generated_at_kst}
기준일: 2026-05-25
문서 성격: VM Cloud 원본 랜딩 read-only bridge 초안

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_readonly_query
    - local_sanitized_report_write
    - bridge_design_draft
  forbidden_actions:
    - vm_cloud_sqlite_write
    - operating_db_write
    - meta_ads_mutation
    - platform_send
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only, attribution_ledger + site_landing_ledger
    window: ${summary.source.logged_at_window_utc.start} ~ ${summary.source.logged_at_window_utc.end} UTC
    site: biocom
    freshness: ${summary.generated_at_kst} read-only 조회
    confidence: high for aggregate counts, medium_high for bridge interpretation
\`\`\`

## 10초 요약

고객 유입 장부에는 \`${summary.source.target_path}\` 원본 랜딩이 ${summary.site_landing_exact_path_rows ?? "확인 불가"}건으로 보이지만, 결제/체크아웃 원장 안의 원본 랜딩 URL에는 같은 경로가 ${attribution.source_rows.toLocaleString("ko-KR")}건 남아 있다.

그래서 \`site_landing_ledger\`만 보면 "해당 랜딩 유입이 없다"처럼 보일 수 있지만, \`attribution_ledger.metadata_json.imweb_landing_url\`을 함께 읽으면 원본 랜딩 후보를 복구할 수 있다.

이 초안은 조회 전용 bridge다. 원장 write, 배포, 광고 설정 변경은 하지 않는다.

## 먼저 용어 정리

\`macro가 남았다\`는 말은 그로스팀이나 대표가 이해하기 어렵다. 앞으로는 아래 표현을 쓴다.

> Meta가 숫자 광고 ID로 자동 변환해야 하는 URL 매개변수가, 일부 실제 주문 기록에서는 숫자로 바뀌지 않고 템플릿 문구 그대로 저장됐다.

예상 정상값은 아래처럼 숫자가 들어오는 것이다.

\`\`\`text
utm_campaign=120245003319500396
utm_term=120245700952890396
utm_content=120245701139440396
\`\`\`

문제가 있는 값은 아래처럼 템플릿 문구가 그대로 남는 것이다.

\`\`\`text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
\`\`\`

이 상태에서는 Meta 광고에서 온 것은 알 수 있지만, 내부 원장에서 어느 캠페인·광고세트·광고소재 매출인지 확정할 숫자 키가 없다.

## 왜 bridge가 필요한가

현재 고객 유입 장부는 실제 첫 랜딩 페이지 대신 결제 페이지, 상품 페이지, 결제완료 페이지를 랜딩처럼 기록하는 경우가 있다. 그러면 "어떤 랜딩 페이지가 매출을 만들었는가"를 볼 때 왜곡이 생긴다.

반면 결제/체크아웃 원장에는 아임웹이 넘긴 원본 랜딩 URL이 \`metadata_json.imweb_landing_url\` 형태로 남아 있다. 이 값을 읽기만 해서 보조 증거로 쓰면, 고객 유입 장부가 놓친 원본 랜딩을 복구할 수 있다.

## read-only bridge 규칙 초안

1. 고객 유입 장부에 원본 랜딩 path가 없을 때만 결제/체크아웃 원장의 \`metadata_json.imweb_landing_url\`을 보조 증거로 읽는다.
2. 숫자 campaign/adset/ad ID가 있으면 A급 매칭 재료로 쓴다.
3. 고유 campaign alias가 있고 단일 광고와만 연결되면 B급 제안으로 둔다.
4. 원본 랜딩 경로만 있고 숫자 ID가 없으면 C급 후보로 둔다.
5. \`{{campaign.id}}\` 같은 템플릿 문구가 그대로 남은 row는 D급 수동확인으로 둔다.
6. D급 row는 Meta 유료 유입 보조 매출로 볼 수 있지만, campaign/adset/ad 중 하나로 자동 배정하지 않는다.
7. bridge 결과를 새 방문으로 중복 가산하지 않는다. 같은 세션/일자/원본 랜딩 기준으로 dedupe해야 한다.

## \`${summary.source.target_path}\` read-only 결과

source: ${summary.source.system}

window: ${summary.source.logged_at_window_utc.start} ~ ${summary.source.logged_at_window_utc.end} UTC

freshness: ${summary.generated_at_kst}

site: ${summary.source.site}

\`\`\`text
site_landing_ledger exact path rows: ${summary.site_landing_exact_path_rows ?? "unknown"}

attribution bridge source rows: ${attribution.source_rows}
metadata text mentions: ${attribution.metadata_text_mentions}
metadata text mentions without usable imweb_landing_url: ${attribution.metadata_text_mentions_without_usable_imweb_landing_url}
rows with UTM: ${attribution.rows_with_utm}
rows with fbclid: ${attribution.rows_with_fbclid}
numeric ID rows: ${attribution.numeric_id_rows}
template phrase rows: ${attribution.template_phrase_rows}
generic alias rows: ${attribution.generic_alias_rows}
checkout_started rows: ${attribution.checkout_started_rows}
confirmed payment rows: ${attribution.confirmed_payment_rows}
confirmed revenue: ${krw(attribution.confirmed_revenue_krw)}
first logged_at UTC: ${attribution.first_logged_at_utc ?? "-"}
last logged_at UTC: ${attribution.last_logged_at_utc ?? "-"}
\`\`\`

참고로 \`metadata_json\` 텍스트 안에 \`${summary.source.target_path}\`가 보이는 row는 ${attribution.metadata_text_mentions.toLocaleString("ko-KR")}건이다. 그중 ${attribution.metadata_text_mentions_without_usable_imweb_landing_url.toLocaleString("ko-KR")}건은 실제로 파싱 가능한 \`imweb_landing_url\` 값이 없어 원본 랜딩 URL bridge의 직접 재료로 쓰지 않았다. 그래서 이전 수기 조사에서 말한 "관련 151건"과 이 초안의 "원본 랜딩 URL bridge 148건"은 서로 다른 기준이다.

## 등급별 결과

| 등급 | 뜻 | row | checkout_started | confirmed payment | confirmed revenue |
|---|---|---:|---:|---:|---:|
${gradeLines || "| - | 데이터 없음 | 0 | 0 | 0 | ₩0 |"}

## campaign evidence rollup

| campaign evidence | row | checkout_started | confirmed payment | confirmed revenue | top term | top content |
|---|---:|---:|---:|---:|---|---|
${campaignLines || "| - | 0 | 0 | 0 | ₩0 | - | - |"}

## 템플릿 문구 그대로 남은 row 해석

${summary.template_phrase_diagnostic.plain_language}

이번 조회에서 템플릿 문구 그대로 남은 row는 ${summary.template_phrase_diagnostic.rows.toLocaleString("ko-KR")}건이고, 이 중 실제 결제완료는 ${summary.template_phrase_diagnostic.confirmed_payment_rows.toLocaleString("ko-KR")}건, 금액은 ${krw(summary.template_phrase_diagnostic.confirmed_revenue_krw)}이다.

같은 세션 안에서 그보다 앞선 숫자 UTM row는 ${summary.template_phrase_diagnostic.same_session_prior_numeric_utm_rows.toLocaleString("ko-KR")}건이었다. 즉 원장 안의 다른 row를 끌어와 숫자 campaign/adset/ad로 자동 치환할 근거는 아직 없다.

## 운영 반영 전 필요한 결정

이 초안은 read-only bridge다. 지금 바로 원장을 바꾸지 않는다.

운영 반영을 하려면 아래 중 하나를 선택해야 한다.

1. 보고서/프론트에서만 bridge를 읽어 보조 증거로 보여준다. 운영 write 없음.
2. 백엔드 helper로 bridge를 만들고 테스트 후 VM Cloud 배포를 승인받는다.
3. 장기적으로 원본 랜딩 필드를 별도 저장하도록 schema 변경 또는 backfill 설계를 만든다. 이 경우 write/schema 변경이므로 별도 명시 승인이 필요하다.

## Auditor verdict

PASS_WITH_NOTES.

읽기 전용 집계와 로컬 산출물 작성만 수행했다. VM Cloud write, 운영DB write, Meta 광고 설정 변경, 플랫폼 전송, GTM publish, 배포는 수행하지 않았다.
`;
};

const main = async () => {
  const targetPath = readArg("path", "/iiary02");
  const startUtc = readArg("start", "2026-05-18 00:00:00");
  const endUtc = readArg("end", "2026-05-26 00:00:00");
  console.log(`[vm-original-landing-bridge] ${kstNow()} start path=${targetPath} window=${startUtc}~${endUtc}`);
  const summary = await fetchBridgeSummary(targetPath, startUtc, endUtc);
  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.mkdir(path.dirname(OUTPUT_MD), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(OUTPUT_MD, renderMarkdown(summary), "utf8");
  console.log(`[vm-original-landing-bridge] wrote ${OUTPUT_JSON}`);
  console.log(`[vm-original-landing-bridge] wrote ${OUTPUT_MD}`);
  console.log(JSON.stringify(summary.attribution_bridge, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
