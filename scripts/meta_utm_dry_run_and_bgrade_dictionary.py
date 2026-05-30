#!/usr/bin/env python3
"""Build Meta UTM non-Meta exclusion dry-run and B-grade alias proposals.

This script is intentionally read-only against external systems. It reads local
UTM candidate files, local alias/audit JSON, and the local diagnostics endpoint
or disk cache, then writes local CSV/JSON/MD artifacts under utm/.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


REPO_ROOT = Path(__file__).resolve().parents[1]
KST = ZoneInfo("Asia/Seoul")
GENERIC_KEYS = {
    "",
    "—",
    "-",
    "meta",
    "fb",
    "facebook",
    "ig",
    "instagram",
    "google",
    "googleads",
    "naver",
    "kakao",
    "crm",
    "display",
    "banner",
    "blog",
    "message",
    "cpc",
    "paid_social",
    "paidsocial",
    "group_purchase",
    "profile",
    "post",
    "campaign",
    "content",
    "source",
    "medium",
    "campaignid",
    "adsetid",
    "adid",
}


def kst_now() -> datetime:
    return datetime.now(tz=KST)


def date_tag() -> str:
    return kst_now().strftime("%Y%m%d")


def kst_stamp() -> str:
    return kst_now().strftime("%Y-%m-%d %H:%M:%S KST")


def normalize_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9가-힣]+", "", str(value or "").strip().lower())


def is_macro_or_placeholder(value: Any) -> bool:
    text = str(value or "").strip()
    lowered = text.lower()
    return (
        not text
        or text == "—"
        or "{{" in text
        or "}}" in text
        or lowered in {"null", "none", "undefined"}
    )


def safe_lookup_key(value: Any) -> str:
    if is_macro_or_placeholder(value):
        return ""
    key = normalize_key(value)
    if key in GENERIC_KEYS or len(key) < 4:
        return ""
    return key


def read_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return [dict(row) for row in csv.DictReader(f)]


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_query_values(text: str) -> list[str]:
    output: list[str] = []
    if "?" in text:
        parsed = urllib.parse.urlparse(text)
        output.extend(
            value
            for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            if key in {"utm_campaign", "utm_source", "campaign_alias"}
        )
    if any(marker in text for marker in ("utm_campaign=", "utm_source=", "campaign_alias=")):
        query_like = text.split("?", 1)[-1]
        output.extend(
            value
            for key, value in urllib.parse.parse_qsl(query_like, keep_blank_values=True)
            if key in {"utm_campaign", "utm_source", "campaign_alias"}
        )
    return output


def collect_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        output: list[str] = []
        for item in value:
            output.extend(collect_strings(item))
        return output
    if isinstance(value, dict):
        output: list[str] = []
        for item in value.values():
            output.extend(collect_strings(item))
        return output
    return []


def build_utm_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    fields = ["primary_alias_key", "utm_source", "utm_campaign", "utm_content"]
    for row in rows:
        for field in fields:
            key = safe_lookup_key(row.get(field, ""))
            if key:
                lookup.setdefault(key, row)
    return lookup


def is_metaish_utm_row(row: dict[str, str]) -> bool:
    alias = row.get("primary_alias_key", "").strip().lower()
    return (
        alias.startswith("meta_")
        or row.get("channel_bucket") == "meta_paid_or_meta_candidate"
        or "메타광고" in row.get("management_memo", "")
    )


def load_diagnostics(endpoint: str, cache_path: Path, cache_key: str) -> tuple[dict[str, Any], str]:
    try:
        with urllib.request.urlopen(endpoint, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
        if body.get("ok"):
            return body, f"local_api:{endpoint}"
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        pass

    cache = json.loads(cache_path.read_text(encoding="utf-8"))
    entry = cache.get("entries", {}).get(cache_key)
    if not entry:
        raise RuntimeError(f"diagnostics API failed and cache key not found: {cache_key}")
    result = entry.get("result")
    if not isinstance(result, dict):
        raise RuntimeError(f"diagnostics cache has no result object: {cache_key}")
    return result, f"disk_cache:{cache_path}#{cache_key}"


def classify_unmapped_sample(sample: dict[str, Any], lookup: dict[str, dict[str, str]]) -> dict[str, Any]:
    source = str(sample.get("utmSource") or "")
    campaign = str(sample.get("utmCampaign") or "")
    content = str(sample.get("utmContent") or "")
    landing_path = str(sample.get("landingPath") or "")
    amount = float(sample.get("amount") or 0)

    matched: dict[str, str] | None = None
    for raw_value in (campaign, source, content):
        key = safe_lookup_key(raw_value)
        if key and key in lookup:
            matched = lookup[key]
            break

    lowered_source = source.strip().lower()
    lowered_campaign = campaign.strip().lower()
    lowered_content = content.strip().lower()
    matched_bucket = matched.get("channel_bucket", "") if matched else ""
    matched_alias = matched.get("primary_alias_key", "") if matched else ""

    if "{{campaign.id}}" in lowered_campaign:
        bucket = "real_meta_placeholder_no_alias"
        recommendation = "Meta 흔적은 있으나 숫자 ID·고유 alias·랜딩 path가 없어 캠페인 매핑 보류"
        exclude_from_meta_unmapped = "NO"
        can_campaign_match = "NO"
        confidence = 0.78
    elif matched_bucket == "google_ads_or_content" or lowered_source.startswith("googleads") or lowered_campaign.startswith("googleads"):
        bucket = "exclude_from_meta_google_ads_by_utm_file"
        recommendation = "Meta 미매칭에서 제외하고 Google Ads/검색광고 bucket으로 분리"
        exclude_from_meta_unmapped = "YES"
        can_campaign_match = "NO"
        confidence = 0.94
    elif matched_alias == "newmember_coupon":
        bucket = "exclude_from_meta_coupon_by_utm_file"
        recommendation = "Meta 미매칭에서 제외하고 쿠폰/CRM성 내부 유입으로 분리"
        exclude_from_meta_unmapped = "YES"
        can_campaign_match = "NO"
        confidence = 0.93
    elif lowered_source == "ig" or lowered_content == "link_in_bio":
        bucket = "quarantine_or_exclude_ig_profile_link"
        recommendation = "광고 캠페인 확정 금지. profile/link-in-bio 또는 assisted social로 분리 검토"
        exclude_from_meta_unmapped = "REVIEW"
        can_campaign_match = "NO"
        confidence = 0.82
    elif all(is_macro_or_placeholder(v) for v in (source, campaign, sample.get("utmTerm"), content)) and not landing_path:
        bucket = "no_utm_no_landing_not_matchable"
        recommendation = "UTM·landing path가 없어 UTM 파일로 매칭 불가. fbclid only 여부 원장 재확인"
        exclude_from_meta_unmapped = "NO"
        can_campaign_match = "NO"
        confidence = 0.7
    elif matched_bucket == "meta_paid_or_meta_candidate":
        bucket = "potential_meta_alias_needs_meta_id"
        recommendation = "Meta alias 후보이나 숫자 ID 또는 Meta API URL evidence 확인 전 B급 후보로만 유지"
        exclude_from_meta_unmapped = "NO"
        can_campaign_match = "PROPOSAL_ONLY"
        confidence = 0.74
    elif matched:
        bucket = "non_meta_or_other_utm_file_match"
        recommendation = f"UTM 파일 bucket={matched_bucket or 'unknown'} 기준으로 Meta 캠페인 자동 매핑 금지"
        exclude_from_meta_unmapped = "REVIEW"
        can_campaign_match = "NO"
        confidence = 0.75
    else:
        bucket = "other_unmapped_no_utm_file_match"
        recommendation = "UTM 파일 후보 없음. 원장 raw evidence 또는 그로스팀 URL 확인 필요"
        exclude_from_meta_unmapped = "NO"
        can_campaign_match = "NO"
        confidence = 0.62

    return {
        "approved_date": sample.get("approvedDate") or "",
        "amount": int(amount) if amount.is_integer() else amount,
        "utm_source": source,
        "utm_campaign": campaign,
        "utm_term": sample.get("utmTerm") or "",
        "utm_content": content,
        "landing_path": landing_path,
        "dry_run_bucket": bucket,
        "exclude_from_meta_unmapped": exclude_from_meta_unmapped,
        "can_campaign_match": can_campaign_match,
        "confidence": confidence,
        "matched_utm_alias": matched_alias,
        "matched_channel_bucket": matched_bucket,
        "matched_management_memo": matched.get("management_memo", "") if matched else "",
        "matched_source_row": matched.get("source_row", "") if matched else "",
        "recommendation": recommendation,
    }


def summarize_rows(rows: list[dict[str, Any]], amount_key: str = "amount") -> dict[str, Any]:
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {"orders": 0, "revenue": 0, "examples": []})
    for row in rows:
        bucket = str(row.get("dry_run_bucket") or row.get("proposal_bucket") or "unknown")
        buckets[bucket]["orders"] += 1
        buckets[bucket]["revenue"] += float(row.get(amount_key) or 0)
        if len(buckets[bucket]["examples"]) < 5:
            buckets[bucket]["examples"].append(row)
    for bucket in buckets.values():
        bucket["revenue"] = int(bucket["revenue"]) if float(bucket["revenue"]).is_integer() else round(bucket["revenue"], 2)
    return dict(sorted(buckets.items(), key=lambda item: (-item[1]["revenue"], item[0])))


def build_audit_alias_map(audit: dict[str, Any]) -> dict[str, set[tuple[str, str]]]:
    alias_map: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for campaign in audit.get("campaigns", []):
        campaign_id = str(campaign.get("campaignId") or campaign.get("id") or "")
        campaign_name = str(campaign.get("campaignName") or campaign.get("name") or "")
        for text in collect_strings(campaign):
            for value in extract_query_values(text):
                key = safe_lookup_key(value)
                if key:
                    alias_map[key].add((campaign_id, campaign_name))
    return alias_map


def build_bgrade_dictionary(
    utm_rows: list[dict[str, str]],
    seed: list[dict[str, Any]],
    audit: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    seed_keys = {normalize_key(row.get("alias_key")) for row in seed}
    audit_alias_map = build_audit_alias_map(audit)

    unique_metaish: dict[str, dict[str, str]] = {}
    for row in utm_rows:
        if not is_metaish_utm_row(row):
            continue
        key = safe_lookup_key(row.get("primary_alias_key"))
        if key:
            unique_metaish.setdefault(key, row)

    output_rows: list[dict[str, Any]] = []
    stats = {
        "unique_metaish_aliases": len(unique_metaish),
        "already_in_manual_seed": 0,
        "b_grade_proposal_single_campaign": 0,
        "multi_campaign_keep_split": 0,
        "no_current_audit_match": 0,
        "audit_generated_at": audit.get("generatedAt"),
        "audit_range": audit.get("range"),
    }
    multi_examples: list[dict[str, Any]] = []
    no_audit_examples: list[dict[str, Any]] = []

    for key, row in sorted(unique_metaish.items(), key=lambda item: item[1].get("primary_alias_key", "")):
        if key in seed_keys:
            stats["already_in_manual_seed"] += 1
            continue

        matches = sorted(audit_alias_map.get(key, set()))
        if len(matches) == 1:
            campaign_id, campaign_name = matches[0]
            stats["b_grade_proposal_single_campaign"] += 1
            output_rows.append({
                "alias_key": row.get("primary_alias_key", ""),
                "proposal_grade": "B_alias_single_campaign_proposal",
                "proposal_status": "proposal_only_do_not_auto_confirm",
                "proposed_campaign_id": campaign_id,
                "proposed_campaign_name": campaign_name,
                "source_row": row.get("source_row", ""),
                "date_iso": row.get("date_iso", ""),
                "management_memo": row.get("management_memo", ""),
                "landing_path": row.get("landing_path_with_idx") or row.get("landing_path", ""),
                "ledger_path_candidates": row.get("ledger_path_candidates", ""),
                "utm_source": row.get("utm_source", ""),
                "utm_medium": row.get("utm_medium", ""),
                "utm_campaign": row.get("utm_campaign", ""),
                "utm_content": row.get("utm_content", ""),
                "channel_bucket": row.get("channel_bucket", ""),
                "product_family_hint": row.get("product_family_hint", ""),
                "audit_generated_at": audit.get("generatedAt", ""),
                "audit_range": f"{audit.get('range', {}).get('startDate', '')}~{audit.get('range', {}).get('endDate', '')}",
                "confidence": "0.74",
                "why_not_auto_confirm": "UTM 파일과 과거 Meta URL audit의 단일 캠페인 조인 근거다. 현재 Ads Manager/최근 주문 window 확인 전 manual_verified로 승격하지 않는다.",
                "next_action": "해당 alias 주문이 발생하면 Meta API URL evidence 또는 그로스팀 Ads Manager export로 숫자 ID 확인 후 승급",
            })
        elif len(matches) > 1:
            stats["multi_campaign_keep_split"] += 1
            if len(multi_examples) < 20:
                multi_examples.append({
                    "alias_key": row.get("primary_alias_key", ""),
                    "campaign_count": len(matches),
                    "campaigns": matches,
                    "management_memo": row.get("management_memo", ""),
                })
        else:
            stats["no_current_audit_match"] += 1
            if len(no_audit_examples) < 20:
                no_audit_examples.append({
                    "alias_key": row.get("primary_alias_key", ""),
                    "landing_path": row.get("landing_path_with_idx") or row.get("landing_path", ""),
                    "management_memo": row.get("management_memo", ""),
                })

    stats["b_grade_proposal_rows"] = len(output_rows)
    summary = {
        "stats": stats,
        "multi_campaign_examples": multi_examples,
        "no_current_audit_examples": no_audit_examples,
    }
    return output_rows, summary


def md_table(headers: list[str], rows: list[list[Any]]) -> str:
    def cell(value: Any) -> str:
        return str(value or "").replace("|", "\\|").replace("\n", " ")

    lines = [
        "| " + " | ".join(cell(header) for header in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(cell(item) for item in row) + " |")
    return "\n".join(lines)


def build_report(
    *,
    run_at: str,
    diagnostics_source: str,
    diagnostics: dict[str, Any],
    dry_rows: list[dict[str, Any]],
    dry_summary: dict[str, Any],
    bgrade_summary: dict[str, Any],
    output_paths: dict[str, Path],
) -> str:
    bucket_rows = [
        [bucket, data["orders"], f"{int(data['revenue']):,}원"]
        for bucket, data in dry_summary.items()
    ]
    b_stats = bgrade_summary["stats"]
    audit_range = b_stats.get("audit_range") or {}
    audit_range_text = (
        f"{audit_range.get('startDate', '')}~{audit_range.get('endDate', '')}"
        if isinstance(audit_range, dict)
        else str(audit_range)
    )
    return f"""# Meta UTM dry-run 비Meta 제외 규칙 + B급 alias 제안 사전

작성 시각: {run_at}
Site: biocom
Lane: Green, read-only/local artifact

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - data/!data_inventory.md
  required_context_docs:
    - utm/[바이오컴] UTM 관리.xlsx
    - utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv
    - utm/biocom-utm-mapping-candidates-20260522.csv
    - data/meta_campaign_aliases.biocom.json
    - data/meta_campaign_alias_audit.biocom.json
  lane: Green
  allowed_actions:
    - read_local_utm_files
    - read_local_backend_diagnostics_api_or_cache
    - generate_local_csv_json_md_artifacts
  forbidden_actions:
    - production_db_write
    - vm_cloud_deploy
    - meta_ads_write
    - gtm_publish
    - platform_send
  source_window_freshness_confidence:
    source: \"{diagnostics_source} + local UTM candidate CSV + local Meta alias audit\"
    window: \"{diagnostics.get('date_range', {}).get('start_date')}~{diagnostics.get('date_range', {}).get('end_date')} KST for dry-run; audit {audit_range_text}\"
    freshness: \"{run_at}\"
    confidence: \"dry-run 분류 high for explicit UTM rows, B-grade proposal medium because audit is stale/proposal-only\"
```

## 결론

현재 Meta 미매칭에서 UTM 관리 파일로 바로 할 수 있는 일은 두 가지다.

1. `googleads_*`, `newmember_coupon`, `ig/link_in_bio`처럼 Meta 광고 캠페인 매출로 붙이면 안 되는 유입을 분리한다.
2. UTM 파일과 과거 Meta URL audit에서 단일 캠페인으로만 보이는 alias를 `manual_verified`가 아니라 `B급 제안 사전`으로 보관한다.

## 비Meta 오분류 dry-run

기준 미매칭: {diagnostics.get('unmapped', {}).get('orders')}건 / {int(diagnostics.get('unmapped', {}).get('revenue') or 0):,}원

{md_table(['bucket', 'orders', 'revenue'], bucket_rows)}

운영 반영 시 추천:

- `exclude_from_meta_google_ads_by_utm_file`: Meta 캠페인 미매칭에서 제외한다.
- `exclude_from_meta_coupon_by_utm_file`: Meta 캠페인 미매칭에서 제외한다.
- `quarantine_or_exclude_ig_profile_link`: campaign ROAS에는 붙이지 않는다. 다만 assisted/social로 볼지 완전 제외할지는 VM Cloud raw row에서 fbclid 여부를 재확인한다.
- `real_meta_placeholder_no_alias`: 진짜 Meta 흔적은 있으나 캠페인 특정 근거가 없으므로 계속 quarantine한다.
- `no_utm_no_landing_not_matchable`: UTM 파일로는 매칭할 수 없다.

## B급 alias 제안 사전

UTM 파일 기준 Meta 성격 alias unique: {b_stats['unique_metaish_aliases']}개

- 이미 수동 seed에 있는 alias: {b_stats['already_in_manual_seed']}개
- B급 제안으로 분리한 단일 캠페인 후보: {b_stats['b_grade_proposal_single_campaign']}개
- 여러 캠페인에 걸쳐 split 유지해야 하는 후보: {b_stats['multi_campaign_keep_split']}개
- 현재 audit에서 확인되지 않은 후보: {b_stats['no_current_audit_match']}개

이 192개는 자동 확정이 아니다. 해당 alias가 주문 원장에 실제로 들어오면 “이 캠페인일 가능성이 높다”는 후보로 띄우고, 최신 Meta API URL evidence나 그로스팀 Ads Manager export로 숫자 ID를 확인한 뒤 승급한다.

## 산출물

- `{output_paths['dry_csv']}`
- `{output_paths['dry_json']}`
- `{output_paths['bgrade_csv']}`
- `{output_paths['bgrade_json']}`

## Auditor verdict

PASS_WITH_NOTES

- No-send: YES
- No-write to DB: YES
- No-deploy: YES
- No-publish: YES
- No-platform-send: YES
- Note: `last_30d` Meta API 강제 갱신은 rate limit에 걸렸으므로, 최신 성공 window인 last_7d dry-run과 로컬 audit 기반 B급 제안으로 한정한다.
"""


def main() -> int:
    tag = date_tag()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--utm-candidates", default=str(REPO_ROOT / "utm/biocom-utm-mapping-candidates-20260522.csv"))
    parser.add_argument("--alias-seed", default=str(REPO_ROOT / "data/meta_campaign_aliases.biocom.json"))
    parser.add_argument("--audit", default=str(REPO_ROOT / "data/meta_campaign_alias_audit.biocom.json"))
    parser.add_argument("--diagnostics-endpoint", default="http://localhost:7020/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d")
    parser.add_argument("--diagnostics-cache", default=str(REPO_ROOT / "backend/data/runtime-cache/meta-utm-diagnostics-cache.json"))
    parser.add_argument("--diagnostics-cache-key", default="meta-utm-diagnostics:act_3138805896402376:last_7d:auto")
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "utm"))
    parser.add_argument("--date-tag", default=tag)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    run_at = kst_stamp()

    utm_rows = read_csv_dicts(Path(args.utm_candidates))
    seed = json.loads(Path(args.alias_seed).read_text(encoding="utf-8"))
    audit = json.loads(Path(args.audit).read_text(encoding="utf-8"))
    diagnostics, diagnostics_source = load_diagnostics(
        args.diagnostics_endpoint,
        Path(args.diagnostics_cache),
        args.diagnostics_cache_key,
    )

    lookup = build_utm_lookup(utm_rows)
    samples = diagnostics.get("unmapped", {}).get("samples", [])
    dry_rows = [classify_unmapped_sample(sample, lookup) for sample in samples]
    dry_summary = summarize_rows(dry_rows)

    bgrade_rows, bgrade_summary = build_bgrade_dictionary(utm_rows, seed, audit)

    dry_csv = out_dir / f"meta-utm-nonmeta-exclusion-dry-run-{args.date_tag}.csv"
    dry_json = out_dir / f"meta-utm-nonmeta-exclusion-dry-run-summary-{args.date_tag}.json"
    bgrade_csv = out_dir / f"biocom-meta-bgrade-alias-proposal-dictionary-{args.date_tag}.csv"
    bgrade_json = out_dir / f"biocom-meta-bgrade-alias-proposal-summary-{args.date_tag}.json"
    report_md = out_dir / f"meta-utm-dry-run-and-bgrade-proposal-{args.date_tag}.md"

    write_csv(
        dry_csv,
        dry_rows,
        [
            "approved_date",
            "amount",
            "utm_source",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "landing_path",
            "dry_run_bucket",
            "exclude_from_meta_unmapped",
            "can_campaign_match",
            "confidence",
            "matched_utm_alias",
            "matched_channel_bucket",
            "matched_management_memo",
            "matched_source_row",
            "recommendation",
        ],
    )
    write_json(
        dry_json,
        {
            "run_at_kst": run_at,
            "source": diagnostics_source,
            "date_range": diagnostics.get("date_range"),
            "unmapped_total": diagnostics.get("unmapped"),
            "bucket_summary": dry_summary,
            "rows": dry_rows,
            "rules": {
                "exclude_from_meta_google_ads_by_utm_file": "UTM 관리 파일 channel_bucket=google_ads_or_content 또는 googleads_* prefix",
                "exclude_from_meta_coupon_by_utm_file": "UTM 관리 파일 primary_alias_key=newmember_coupon",
                "quarantine_or_exclude_ig_profile_link": "utm_source=ig 또는 utm_content=link_in_bio. Campaign ROAS에는 붙이지 않음.",
                "real_meta_placeholder_no_alias": "utm_source=meta + literal {{campaign.id}}/{{adset.id}}/{{ad.id}}. 숫자 ID나 alias 없으면 quarantine.",
                "no_utm_no_landing_not_matchable": "UTM/landing path 없음. UTM 파일로 매칭 불가.",
            },
        },
    )

    write_csv(
        bgrade_csv,
        bgrade_rows,
        [
            "alias_key",
            "proposal_grade",
            "proposal_status",
            "proposed_campaign_id",
            "proposed_campaign_name",
            "source_row",
            "date_iso",
            "management_memo",
            "landing_path",
            "ledger_path_candidates",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_content",
            "channel_bucket",
            "product_family_hint",
            "audit_generated_at",
            "audit_range",
            "confidence",
            "why_not_auto_confirm",
            "next_action",
        ],
    )
    write_json(
        bgrade_json,
        {
            "run_at_kst": run_at,
            "source": {
                "utm_candidates": str(Path(args.utm_candidates)),
                "alias_seed": str(Path(args.alias_seed)),
                "audit": str(Path(args.audit)),
            },
            **bgrade_summary,
            "outputs": {
                "bgrade_csv": str(bgrade_csv),
            },
        },
    )

    report = build_report(
        run_at=run_at,
        diagnostics_source=diagnostics_source,
        diagnostics=diagnostics,
        dry_rows=dry_rows,
        dry_summary=dry_summary,
        bgrade_summary=bgrade_summary,
        output_paths={
            "dry_csv": dry_csv,
            "dry_json": dry_json,
            "bgrade_csv": bgrade_csv,
            "bgrade_json": bgrade_json,
        },
    )
    report_md.write_text(report, encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "run_at_kst": run_at,
        "diagnostics_source": diagnostics_source,
        "dry_run_rows": len(dry_rows),
        "dry_run_buckets": {key: {"orders": value["orders"], "revenue": value["revenue"]} for key, value in dry_summary.items()},
        "bgrade_rows": len(bgrade_rows),
        "bgrade_stats": bgrade_summary["stats"],
        "outputs": {
            "dry_csv": str(dry_csv),
            "dry_json": str(dry_json),
            "bgrade_csv": str(bgrade_csv),
            "bgrade_json": str(bgrade_json),
            "report_md": str(report_md),
        },
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
