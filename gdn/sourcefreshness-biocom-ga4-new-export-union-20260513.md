# biocom GA4 sourceFreshness 신규 export 전환 메모

작성 시각: 2026-05-13 23:25 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - data/!bigquery_new.md
    - project/total.md
  lane: Green
  allowed_actions:
    - local backend sourceFreshness patch
    - BigQuery read-only freshness check
    - local API smoke
    - document update
  forbidden_actions:
    - BigQuery write/copy/delete
    - 운영DB write/import
    - VM Cloud backend deploy/restart
    - Google Ads/GA4/Meta/TikTok/Naver send/upload
    - GTM publish
  source_window_freshness_confidence:
    source: "backend local /api/source-freshness + BigQuery read-only"
    window: "2026-05-13 23:15~23:25 KST"
    site: "biocom"
    freshness: "direct current-turn smoke"
    confidence: 0.94
```

## 한 줄 결론

로컬 backend `sourceFreshness`는 이제 biocom GA4를 신규 export current source로 읽고, 과거 hurdlers export 복사본을 archive source로 함께 표시한다. `/total`도 이 결과를 받아 GA4 BigQuery를 `fresh`로 표시한다.

## 왜 바꿨나

이전 화면의 `GA4 BigQuery 원본 — 연결 끊김`은 현재 사실과 달랐다. 실제 문제는 권한 단절이 아니라 backend freshness가 과거 허들러스 원본 `hurdlers-naver-pay.analytics_304759974.events_20260506`을 보고 있었던 것이다. 신규 export는 `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_20260512`까지 정상 조회된다.

## 구현 방식

- current source: BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`
- archive source: BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`
- freshness 판정 기준: current source의 최신 `event_timestamp`
- archive 사용 목적: 과거 기간 분석에서 2026-05-06 이전 데이터를 끊기지 않게 설명
- `/total` 표시: static `ga4_bigquery_raw` row 대신 live `ga4_bigquery_biocom` sourceFreshness row 사용

## 검증 숫자

- `ga4_bigquery_biocom.status`: `fresh`
- current latest table: `events_20260512`
- latest event: `2026-05-12T23:59:57+09:00`
- ageHours: 23.3
- latest table rows: 49,111
- purchase events: 64
- distinct purchase transaction_id: 64
- archive segment: `events_20240909~events_20260506`, 605 tables
- current segment: `events_20260507~events_20260512`, 6 tables
- boundary: contiguous

## 중요한 제한

GA4 BigQuery는 유입 교차검증 source다. 실제 결제완료 매출 정본이 아니므로 `/total` 예산 판단 매출에 GA4 purchase revenue를 더하지 않는다. 운영DB PostgreSQL 결제완료/토스 정합성과 VM Cloud 유입 장부를 섞어 쓰는 기존 계약은 유지한다.

## 다음

운영 화면에 반영하려면 VM Cloud backend deploy/restart가 필요하므로 Yellow approval packet으로 진행한다. 로컬 검증은 PASS지만, 운영 반영 전에는 BigQuery write/copy/delete, 운영DB write, 광고 플랫폼 send/upload는 계속 금지다.
