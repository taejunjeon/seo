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
    - data/biocom-bigquery-analysis-handoff-20260505.md
    - data/biocom-bigquery-final-delta-plan-20260505.md
  lane: Yellow
  approved_by: TJ
  allowed_actions:
    - copy target-missing daily events_YYYYMMDD tables only
    - use WRITE_EMPTY only
    - run source/target verification
    - write local result documents
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - source table delete
    - source table update
    - existing target table overwrite
    - existing target table delete
    - sourceFreshness switch
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    site: biocom
    window: events_20240909 to events_20260506
    freshness: final delta verification 2026-05-07 15:38 KST
    confidence: 96%
```

# Biocom BigQuery Final Delta Copy 실행 결과

작성 시각: 2026-05-07 15:43 KST
작업 유형: Yellow Lane 승인 실행
대상: biocom GA4 BigQuery final delta copy
운영DB 영향: 없음
외부 전환 전송: 없음
Auditor verdict: PASS

## 10초 요약

TJ님 승인 범위 안에서 final delta copy를 완료했다.
source에는 있고 target archive에는 없던 `events_20260504`, `events_20260505`, `events_20260506` 3개 daily table만 `WRITE_EMPTY`로 복사했다.
복사 후 source와 target은 모두 `events_20240909`부터 `events_20260506`까지 605개 table, 24,495,738 rows, 35.32 GiB로 일치한다.
GA4 BigQuery Link 삭제/생성, source table 수정, existing target overwrite/delete, sourceFreshness 전환은 하지 않았다.

## 실행 명령

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-copy
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify
npx tsx scripts/check-source-freshness.ts --json
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan --json > ../data/biocom-bigquery-final-delta-result-20260507.json
```

원본 JSON:

```text
data/biocom-bigquery-final-delta-result-20260507.json
```

## Copy 대상

copy 전 기준 시각: 2026-05-07 15:37 KST

| table | source rows | size_bytes | 처리 |
|---|---:|---:|---|
| `events_20260504` | 55,883 | 93,543,927 | `WRITE_EMPTY` copy |
| `events_20260505` | 59,133 | 107,194,272 | `WRITE_EMPTY` copy |
| `events_20260506` | 70,294 | 121,956,656 | `WRITE_EMPTY` copy |

copy job errorResult: 0건.

## Verification 결과

기준 시각: 2026-05-07 15:38 KST

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| first table | `events_20240909` | `events_20240909` | 일치 |
| latest table | `events_20260506` | `events_20260506` | 일치 |
| daily table count | 605 | 605 | 일치 |
| total rows | 24,495,738 | 24,495,738 | 일치 |
| total size_bytes | 37,928,684,719 | 37,928,684,719 | 일치 |
| total size GiB | 35.32 | 35.32 | 일치 |
| missing target tables | 0 | - | 없음 |
| existing row_count mismatch | 0 | - | 없음 |
| source intraday table count | 0 | - | 참고 |

Sample date check:

| table | source rows | target rows | 결과 |
|---|---:|---:|---|
| `events_20240909` | 9,441 | 9,441 | 일치 |
| `events_20260101` | 34,502 | 34,502 | 일치 |
| `events_20260423` | 73,802 | 73,802 | 일치 |
| `events_20260425` | 57,676 | 57,676 | 일치 |
| `events_20260506` | 70,294 | 70,294 | 일치 |

Latest purchase sanity:

| table | source rows | target rows | source purchase | target purchase | source distinct transaction_id | target distinct transaction_id | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| `events_20260506` | 70,294 | 70,294 | 79 | 79 | 79 | 79 | 일치 |

max event time도 source와 target 모두 `2026-05-06 23:59:52 UTC+9`로 일치한다.

## Freshness 재확인

기준 시각: 2026-05-07 15:38 KST

| source | status | table | rows | purchase | distinct transaction_id | max event time KST |
|---|---:|---|---:|---:|---:|---|
| `ga4_bigquery_thecleancoffee` | `fresh` | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260506` | 3,924 | 26 | 26 | 2026-05-06 23:59:13 |
| `ga4_bigquery_biocom` | `fresh` | `hurdlers-naver-pay.analytics_304759974.events_20260506` | 70,294 | 79 | 79 | 2026-05-06 23:59:52 |

biocom freshness는 아직 허들러스 source를 본다.
이번 작업에서 sourceFreshness 기본 경로를 backfill archive로 전환하지 않았다.

## 하지 않은 것

- GA4 BigQuery Link 삭제: 하지 않음.
- 신규 GA4 BigQuery Link 생성: 하지 않음.
- source table 삭제: 하지 않음.
- source table 수정: 하지 않음.
- existing target table overwrite: 하지 않음.
- existing target table delete: 하지 않음.
- source dataset IAM 변경: 하지 않음.
- sourceFreshness 전환: 하지 않음.
- deploy: 하지 않음.
- 운영DB write: 하지 않음.
- GA4/Meta/TikTok/Google Ads 전송: 하지 않음.

## 현재 판단

final delta copy는 성공이다.
이제 다음 게이트는 GA4 Admin에서 기존 허들러스 BigQuery Link를 삭제하고, 우리 프로젝트 `project-dadba7dd-0229-4ff6-81c`로 신규 Link를 만드는 cutover다.

단, GA4 Link cutover는 Codex가 로컬에서 대신 클릭할 수 없다.
TJ님 또는 GA4 Admin 권한자가 화면에서 직접 수행해야 한다.

## 다음 할일

### TJ님이 할 일

1. GA4 BigQuery Link cutover 실행 여부를 결정한다.
   왜: archive가 `events_20260506`까지 닫혔으므로, 이제 신규 export를 우리 프로젝트로 만들 수 있는 단계다.
   어떻게: GA4 Admin > biocom property `304759974` > Product Links > BigQuery Links에서 기존 `hurdlers-naver-pay` Link를 삭제하고, `project-dadba7dd-0229-4ff6-81c`로 신규 Link를 생성한다.
   성공 기준: 신규 target project는 `project-dadba7dd-0229-4ff6-81c`, location은 `asia-northeast3`, export option은 Daily ON, Streaming OFF다.
   실패 시 해석: project가 선택 목록에 안 보이면 GA4/GCP 권한 또는 project owner 조건을 확인해야 한다.
   승인 필요 여부: YES.
   추천 점수/자신감: 88%.

### Codex가 할 일

1. TJ님이 Link cutover를 수행하면 post-cutover read-only 검증을 한다.
   왜: 신규 `project-dadba7dd-0229-4ff6-81c.analytics_304759974` dataset이 생겼는지 확인해야 한다.
   어떻게: BigQuery dataset metadata와 tables.list를 read-only로 확인하고, 첫 daily table이 생긴 뒤 rows/purchase/distinct transaction_id/max event time을 확인한다.
   성공 기준: 신규 dataset location `asia-northeast3`, 첫 daily table exists, row_count > 0, purchase sanity 정상.
   실패 시 해석: 24시간 이내에는 지연일 수 있고, 24~48시간 이상 dataset/table이 없으면 Link 권한, billing, GA4 설정을 점검한다.
   승인 필요 여부: read-only 검증은 NO, sourceFreshness 전환은 나중에 별도 승인.
   추천 점수/자신감: 91%.

## Auditor Verdict

```text
Auditor verdict: PASS
Project: biocom BigQuery final delta
Phase: delta_copy
Lane: Yellow
Mode: approved_write_to_target_backfill_dataset

No-send verified: YES
No-write verified: YES outside approved target backfill dataset
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Source / window / freshness:
- source: hurdlers-naver-pay.analytics_304759974
- target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- window: events_20240909 to events_20260506
- freshness: verification 2026-05-07 15:38 KST
- site: biocom
- confidence: 96%

Validation:
- copied tables: events_20260504, events_20260505, events_20260506
- missing target tables after copy: 0
- source/target table count: 605 / 605
- source/target rows: 24,495,738 / 24,495,738
- source/target size_bytes difference: 0
- latest purchase sanity: PASS

Next actions:
- GA4 BigQuery Link cutover requires TJ님 human UI execution.
- sourceFreshness remains on hurdlers source until new export dataset is stable.
```
