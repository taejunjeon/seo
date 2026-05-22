# Naver Ads 과거 30일 구간 추가 sync 승인안

작성 시각: 2026-05-22 00:50 KST
기준일: 2026-05-22
문서 성격: VM Cloud `naver_ads_daily` 과거 구간 추가 적재 승인안 + 실행 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - project/naver-ads-cache-source-green-audit-20260521.md
    - project/naver-ads-daily-cron-sync-design-20260522.md
  lane: Yellow_after_TJ_approval
  allowed_after_approval:
    - vm_cloud_naver_ads_api_read_only_dry_run
    - vm_cloud_sqlite_naver_ads_daily_upsert
    - public_campaign_summary_smoke
    - result_doc_update
  forbidden_even_after_approval:
    - naver_ads_state_change
    - bid_budget_keyword_mutation
    - ad_platform_conversion_upload
    - operational_db_write
    - gtm_or_imweb_change
    - daily_cron_registration
    - secret_value_output
  source_window_freshness_confidence:
    source: VM Cloud Naver Search Ad API dry-run
    window: 2026-04-21~2026-05-13
    freshness: 2026-05-22 00:50 KST
    confidence: high
```

## 10초 요약

현재 VM Cloud에는 2026-05-14~2026-05-20 7일치 Naver Ads 광고비만 있다. 그래서 `/ads/naver` 최근 7일 화면은 쓸 수 있지만, 기본 30일 API는 앞 23일 비용이 빠져 `partial_requested_window`로 표시된다.

이 승인안은 빠진 과거 구간 `2026-04-21~2026-05-13`만 추가로 upsert하는 작업이다. no-write dry-run 결과는 37개 캠페인 전부 성공, 851 rows, 광고비 5,213,991원, 클릭 8,919건이었다.

승인 후 실행해도 광고 계정 상태는 바꾸지 않는다. VM Cloud SQLite cache에 광고비 row만 추가한다.

2026-05-22 01:17 KST에 TJ님 승인 후 실행했다. VM Cloud는 2026-04-21~2026-05-20 30일 cache가 `ready`가 됐고, default API 광고비는 7,276,795원으로 확인됐다.

## 현재 cache와 빠진 구간

| 구분 | window | rows | spend | 상태 |
|---|---|---:|---:|---|
| 이미 적재됨 | 2026-05-14~2026-05-20 | 259 | 2,062,804원 | ready |
| 이번 승인 대상 | 2026-04-21~2026-05-13 | 851 | 5,213,991원 | dry-run 확인, write 미실행 |
| 합산 후 기대 | 2026-04-21~2026-05-20 | 1,110 | 7,276,795원 | 승인 후 default 30일 ready 기대 |

## dry-run 결과

source: VM Cloud Naver Search Ad API read-only
window: 2026-04-21~2026-05-13
freshness: 2026-05-22 00:50 KST
confidence: high

| 항목 | 값 |
|---|---:|
| campaigns total | 37 |
| campaigns selected | 37 |
| campaigns success | 37 |
| campaigns failed | 0 |
| rows previewed | 851 |
| rows written | 0 |
| impressions | 539,791 |
| clicks | 8,919 |
| spend | 5,213,991원 |
| Naver claim convAmt | 113,054,847원 |
| Naver claim ROAS | 21.68 |
| campaigns with spend | 7 |

## 승인 후 실행 결과

source: VM Cloud Naver Search Ad API read-only + VM Cloud SQLite write
window: 2026-04-21~2026-05-13
freshness: 2026-05-22 01:17 KST
confidence: high

| 항목 | 값 |
|---|---:|
| campaigns total | 37 |
| campaigns selected | 37 |
| campaigns success | 37 |
| campaigns failed | 0 |
| rows previewed | 851 |
| rows written | 851 |
| spend | 5,213,991원 |
| impressions | 539,791 |
| clicks | 8,919 |
| Naver claim convAmt | 113,054,847원 |
| Naver claim ROAS | 21.68 |

합산 후 VM Cloud cache:

| 항목 | 값 |
|---|---:|
| rows | 1,110 |
| min date | 2026-04-21 |
| max date | 2026-05-20 |
| spend | 7,276,795원 |
| impressions | 696,474 |
| clicks | 12,443 |

공개 API smoke:

| endpoint | status | cache status | first date | last date | rows | spend | internal real ROAS |
|---|---:|---|---|---|---:|---:|---:|
| `/api/ads/naver/campaign-summary?site=biocom` | 200 | ready | 2026-04-21 | 2026-05-20 | 1,110 | 7,276,795원 | 1.7 |

금지선:

- Naver Ads 광고 상태/입찰/예산/키워드 변경 0.
- 광고 플랫폼 전환 upload/send 0.
- 운영DB write 0.
- raw credential 로그 0.

## 실행 승인 범위

승인 문구:

> Naver Ads 과거 구간 추가 sync 승인한다.

승인하면 실행할 명령:

```bash
cd /home/biocomkr_sns/seo/repo/backend

npx tsx scripts/naver-ads-collect-7d-20260513.ts \
  --dry-run \
  --site=biocom \
  --since=2026-04-21 \
  --until=2026-05-13 \
  --json

npx tsx scripts/naver-ads-collect-7d-20260513.ts \
  --write \
  --site=biocom \
  --since=2026-04-21 \
  --until=2026-05-13 \
  --max-rows=900 \
  --json
```

`--max-rows=900`으로 둔 이유:

- dry-run 기대값은 851 rows다.
- 900을 넘으면 캠페인 수나 날짜 범위가 예상과 달라진 것이므로 write를 막는다.
- 정확히 851로 묶으면 Naver API가 같은 기간에 일부 추가 row를 반환하는 작은 변동에도 실행이 막힐 수 있어 5.7% 여유를 둔다.

## 성공 기준

1. write 결과 `ok=true`.
2. campaigns success 37, failed 0.
3. rows written 851 전후, 최대 900 이하.
4. VM Cloud DB `naver_ads_daily` biocom rows가 1,110 전후.
5. default API `/api/ads/naver/campaign-summary?site=biocom`이 `cache_info.status=ready`.
6. default API `first_date_in_cache <= 2026-04-21`.
7. default API `last_date_in_cache=2026-05-20`.
8. default API `total_spend_krw=7,276,795` 전후.
9. raw credential 로그 0.

## 중단 기준

아래가 나오면 write를 하지 않거나, write 후 추가 조치를 멈추고 보고한다.

- dry-run failed campaign > 0.
- `rows_previewed > 900`.
- Naver API 401/403.
- Naver API 429/rate limit 반복.
- write 결과 `write_blocked_reason` 존재.
- public API 500.
- secret 값 로그 노출.

## 실행 후 smoke

실행 후 아래를 확인한다.

```bash
https://att.ainativeos.net/api/ads/naver/campaign-summary?site=biocom
```

확인할 필드:

- `cache_info.status`
- `cache_info.first_date_in_cache`
- `cache_info.last_date_in_cache`
- `cache_info.rows_in_window`
- `totals.total_spend_krw`
- `totals.internal_paid_naver_revenue_krw`
- `totals.internal_real_roas`

## 영향

좋아지는 점:

- `/ads/naver` 기본 30일 기준이 partial이 아니라 full cache 기준이 된다.
- 내부 Naver ROAS의 광고비 분모가 최신 30일 기준에 가까워진다.
- daily cron 등록 전에도 30일 baseline을 확보한다.

주의할 점:

- Naver claim convAmt는 네이버 플랫폼 주장 매출이다. 내부 confirmed 매출과 합산하지 않는다.
- 이 작업은 광고비 cache를 채우는 일이지, Naver 광고 전환을 업로드하는 일이 아니다.
- 과거 30일보다 더 긴 기간 분석은 별도 window dry-run이 필요하다.

## 의존성

- 이 backfill은 daily cron보다 먼저 하는 것이 좋다.
- cron 자체는 독립적으로 등록 가능하지만, backfill 없이 등록하면 첫 cron 전까지 default 30일 API가 계속 partial로 남는다.
- backfill은 backend deploy/restart가 필요 없다. 현재 VM Cloud collector와 env가 이미 준비돼 있다.

## 다음 할일

### 실제 필요한 작업 순서

1. daily cron 첫 자동 실행을 확인한다.
   - 담당: Codex 설계, TJ님 승인.
   - 이유: backfill은 기준선을 맞췄고, cron은 앞으로 stale을 막는 작업이다.
   - 방법: `project/naver-ads-daily-cron-sync-design-20260522.md`의 cron 결과를 확인한다.
   - 성공 기준: 2026-05-22 07:20 KST 이후 log에 성공 row가 남고 `last_date_in_cache=2026-05-21`.
   - 실패 시 다음 확인점: cron PATH/TZ/env 차이, Naver API 429.
   - 승인 필요 여부: 이미 승인·등록 완료. 확인은 read-only.
   - 의존성: cron 등록 완료.
   - 추천 점수/자신감: 86%.

## Auditor verdict

PASS.

과거 구간은 no-write dry-run으로 숫자를 확정한 뒤 승인 범위 안에서 VM Cloud SQLite `naver_ads_daily`에만 추가 upsert했다.
