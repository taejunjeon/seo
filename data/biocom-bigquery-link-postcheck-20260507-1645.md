# biocom BigQuery Link 자동 확인 - 20260507-1645

작성 시각: 2026-05-07 16:45:02 KST
작업 성격: Green Lane, cron scheduled read-only check
관련 JSON: `biocom-bigquery-link-postcheck-20260507-1645.md`

## 10초 요약

자동 확인 결과는 `new_export_dataset_pending`이다.
신규 GA4 export dataset은 `project-dadba7dd-0229-4ff6-81c.analytics_304759974`이고, 기대 location은 `asia-northeast3`이다.
이 문서는 BigQuery read-only 확인 결과만 기록한다.

## Harness Preflight

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - data/!bigquery.md
  lane: Green
  allowed_actions:
    - BigQuery dataset/table metadata read
    - BigQuery sanity query read
    - local result file write
  forbidden_actions:
    - BigQuery dataset/table create
    - BigQuery table copy/delete
    - GA4 Link delete/create
    - sourceFreshness switch
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: project-dadba7dd-0229-4ff6-81c.analytics_304759974
    window: post-cutover latest daily table if available
    freshness: 2026-05-07 16:45:02 KST
    site: biocom
    confidence: B
```

## Dataset Checks

- project-dadba7dd-0229-4ff6-81c.analytics_304759974: not found (404)
- hurdlers-naver-pay.analytics_304759974: exists, location asia-northeast3, latest -, tables -, rows -
- project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill: exists, location asia-northeast3, latest -, tables -, rows -

## New Export Latest Sanity

신규 export daily table이 아직 없어 purchase sanity를 실행하지 않았다.

## 판단

- 신규 dataset이 없으면: Link 생성은 됐지만 BigQuery export materialization 대기.
- 신규 dataset은 있고 daily table이 없으면: dataset 생성은 됐지만 첫 daily export 대기.
- daily table이 있으면: rows, purchase, distinct transaction_id, max event time KST를 기준으로 3일 연속 안정 여부를 계속 본다.

## 금지선 확인

- sourceFreshness 전환: 하지 않음.
- BigQuery write/copy/delete: 하지 않음.
- GA4 Link 추가 변경: 하지 않음.
- deploy: 하지 않음.
- platform send: 하지 않음.
