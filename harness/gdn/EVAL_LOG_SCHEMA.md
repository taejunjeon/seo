# GDN Eval Log Schema

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS read-only와 dry-run 결과를 반복 비교할 수 있게 run log schema를 고정한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[harness/gdn/AUDITOR_CHECKLIST|GDN Auditor Checklist]]

## 10초 요약

GDN 작업은 숫자가 쉽게 stale된다.

매 실행마다 `source`, `window`, `freshness`, `confidence`, `forbidden actions`를 같은 schema로 남겨야 다음 실행에서 개선 여부를 비교할 수 있다.

## YAML 예시

```yaml
run_id: gdn-readonly-20260503-2225
created_at: "2026-05-03T22:25:00+09:00"
operator: Codex
project: gdn
phase: conversion_action_audit
lane: Green
mode: read_only
site: biocom

source:
  google_ads:
    customer_id: "2149990943"
    api_version: "v22"
    fetched_at: "2026-05-03T13:25:00Z"
    window: LAST_30_DAYS
    confidence: high
  internal_revenue:
    source: "TJ 관리 Attribution VM /api/attribution/ledger"
    ledger_source: biocom_imweb
    window: "2026-04-03~2026-05-02 KST"
    latest_logged_at: null
    confidence: medium-high
  tracking:
    gtm_container: GTM-W2Z6PHN
    snapshot_at: null
    stale: true
    confidence: medium

summary_metrics:
  google_ads_cost: 0
  google_conv_value: 0
  google_all_conv_value: 0
  view_through_conversions: 0
  internal_confirmed_revenue: 0
  internal_confirmed_roas: null
  primary_known_npay_value: 0
  secondary_known_npay_all_value: 0
  platform_minus_internal_confirmed: 0

conversion_actions:
  total: 0
  primary_known_npay: 0
  secondary_known_npay: 0
  helper_actions: 0
  unknown_purchase: 0

guards:
  no_send: true
  no_write: true
  no_deploy: true
  no_publish: true
  no_platform_send: true
  google_ads_mutate: false
  conversion_upload: false

changed_files:
  - harness/gdn/README.md

verification:
  wiki_links: pass
  no_send_grep: pass
  no_write_grep: pass
  typecheck: not_run

decision:
  verdict: report_only
  confidence: 0.88
  next_green:
    - "Google Ads API live numbers refresh"
  next_yellow: []
  next_red:
    - "action 7130249515 primary change approval"
```

## 필드 기준

| 필드 | 설명 |
|---|---|
| `run_id` | `gdn-{phase}-{YYYYMMDD-HHMM}` |
| `lane` | Green / Yellow / Red |
| `mode` | read_only / dry_run / approval_draft / smoke / live |
| `source.google_ads.window` | Google Ads date preset 또는 explicit date |
| `source.internal_revenue.window` | KST 기준 내부 원장 window |
| `summary_metrics` | 숫자는 원 단위. null 가능 |
| `conversion_actions` | classification별 count |
| `guards` | 금지된 side effect 여부 |
| `decision.verdict` | report_only / approval_required / blocked / no_action |

## 저장 위치

| 유형 | 위치 |
|---|---|
| 사람이 읽는 report | `gdn/google-ads-*.md` |
| eval log yaml | `data/google-ads-*.yaml` 또는 `harness/gdn/eval-*.yaml` |
| approval draft | `gdn/google-ads-*-approval.md` |

## 판정값

| verdict | 의미 |
|---|---|
| `report_only` | read-only 결과만 남김 |
| `approval_required` | Red/Yellow Lane 실행 승인 필요 |
| `blocked` | 권한/source 차단으로 판단 불가 |
| `no_action` | 추가 조치 필요 없음 |
| `stale_refresh_required` | source가 stale이라 재조회 필요 |
