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
    - data/biocom-bigquery-backfill-approval-20260505.md
  lane: Yellow
  approved_by: TJ
  allowed_actions:
    - create target dataset project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    - copy daily events_YYYYMMDD tables with WRITE_EMPTY
    - run source/target verification queries
    - write local result documents
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - source table delete
    - source table update
    - source dataset IAM change
    - writes outside target backfill dataset
    - production DB write
    - deploy
    - platform send
    - switch sourceFreshness default path to backfill dataset
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    site: biocom
    window: events_20240909 to events_20260503
    freshness: verification completed 2026-05-05 01:38 KST
    confidence: 94%
```

# Biocom BigQuery Initial Backfill 실행 결과

작성 시각: 2026-05-05 01:38 KST
실행 유형: Yellow Lane 승인 실행
대상: biocom GA4 BigQuery raw export initial backfill
운영DB 영향: 없음
외부 전환 전송: 없음
Auditor verdict: PASS_WITH_NOTES

## 10초 요약

TJ님 승인 범위 안에서 biocom GA4 daily raw table 602개를 우리 target backfill dataset으로 복사했다.
target dataset은 `asia-northeast3`로 생성됐고, source와 target의 table count, row_count 합계, size_bytes, sample 5개, latest purchase sanity가 모두 일치했다.
이번 실행은 initial backfill까지만 완료했다.
final delta backfill, GA4 BigQuery Link 삭제, 신규 Link 생성은 아직 하지 않았다.

## 실행 목적

이 작업은 허들러스 프로젝트에 쌓인 biocom GA4 raw export를 우리 통합 프로젝트에 보존하는 작업이다.
이제 허들러스 BigQuery Link를 나중에 해제하더라도 2024-09-09부터 2026-05-03까지의 raw event 데이터는 우리 프로젝트의 별도 backfill dataset에 남아 있다.

## Source와 Target

| 구분 | 값 |
|---|---|
| credential | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| source project | `hurdlers-naver-pay` |
| source dataset | `analytics_304759974` |
| source location | `asia-northeast3` |
| target project | `project-dadba7dd-0229-4ff6-81c` |
| target dataset | `analytics_304759974_hurdlers_backfill` |
| target location | `asia-northeast3` |
| job project | `project-dadba7dd-0229-4ff6-81c` |

## 실행 명령

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=plan
npx tsx scripts/biocom-bigquery-backfill.ts --mode=initial-copy
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify --json
npm run typecheck
npx tsx scripts/check-source-freshness.ts --json
```

참고: `verify` 첫 시도에서 SQL alias `rows`가 BigQuery 예약어로 걸렸다.
스크립트 alias를 `total_rows`로 수정한 뒤 같은 verification을 재실행했고 PASS했다.
이 오류는 데이터 mismatch나 BigQuery copy 실패가 아니다.

## Initial Backfill 결과

기준 시각: 2026-05-05 01:36 KST
source: `hurdlers-naver-pay.analytics_304759974`
target: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| first table | `events_20240909` | `events_20240909` | 일치 |
| latest table | `events_20260503` | `events_20260503` | 일치 |
| daily table count | 602 | 602 | 일치 |
| total rows | 24,310,428 | 24,310,428 | 일치 |
| total size_bytes | 37,605,989,864 | 37,605,989,864 | 일치 |
| total size GiB | 35.02 | 35.02 | 일치 |
| intraday table count | 0 | - | daily copy 범위 밖 |

copy 결과:

- target dataset 생성: 성공.
- target dataset location: `asia-northeast3`.
- copied table count: 602.
- write disposition: `WRITE_EMPTY`.
- source write: 없음.
- target 외 write: 없음.
- copy job errorResult: 0건.

## Verification 결과

기준 시각: 2026-05-05 01:38 KST

| 검증 | 결과 |
|---|---:|
| source/target table count 일치 | YES |
| source/target row_count 합계 일치 | YES |
| source/target size_bytes 차이 | 0 bytes, 0.000% |
| missing target tables | 0 |
| extra target tables | 0 |
| mismatched row tables | 0 |
| verification_ok | YES |

Sample date 5개:

| table | source rows | target rows | 결과 |
|---|---:|---:|---|
| `events_20240909` | 9,441 | 9,441 | 일치 |
| `events_20260101` | 34,502 | 34,502 | 일치 |
| `events_20260423` | 73,802 | 73,802 | 일치 |
| `events_20260425` | 57,676 | 57,676 | 일치 |
| `events_20260503` | 48,553 | 48,553 | 일치 |

Latest purchase sanity:

| table | source rows | target rows | source purchase | target purchase | source distinct transaction_id | target distinct transaction_id | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| `events_20260503` | 48,553 | 48,553 | 59 | 59 | 59 | 59 | 일치 |

max event time도 source와 target 모두 `2026-05-03 23:59:58 UTC+9`로 일치했다.

## Freshness 재확인

실행 명령:

```bash
cd backend
npx tsx scripts/check-source-freshness.ts --json
```

기준 시각: 2026-05-05 01:36 KST

| source | status | table | rows | purchase | distinct transaction_id | max event time KST |
|---|---:|---|---:|---:|---:|---|
| `ga4_bigquery_thecleancoffee` | `fresh` | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260503` | 2,949 | 14 | 14 | 2026-05-03 23:41:44 |
| `ga4_bigquery_biocom` | `fresh` | `hurdlers-naver-pay.analytics_304759974.events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 |

biocom sourceFreshness 기본 경로는 아직 source dataset을 본다.
이번 작업에서 기본 경로를 backfill dataset으로 전환하지 않았다.

참고: 같은 freshness 실행에서 Toss/Imweb local mirror 일부는 stale 또는 warn으로 표시됐다.
이는 이번 BigQuery backfill과 별개다.

## 하지 않은 것

- GA4 BigQuery Link 삭제: 하지 않음.
- 신규 GA4 BigQuery Link 생성: 하지 않음.
- source table 삭제: 하지 않음.
- source table 수정: 하지 않음.
- source dataset IAM 변경: 하지 않음.
- target backfill dataset 외 dataset/table write: 하지 않음.
- 운영DB write: 하지 않음.
- GA4/Meta/TikTok/Google Ads 전송: 하지 않음.
- deploy: 하지 않음.
- sourceFreshness 기본 경로를 backfill dataset으로 전환: 하지 않음.
- final delta backfill: 하지 않음.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `backend/scripts/biocom-bigquery-backfill.ts` | plan, initial-copy, verify 모드 구현. delta mode는 별도 승인 필요로 차단 |
| `data/biocom-bigquery-backfill-result-20260505.md` | 이 실행 결과 문서 |
| `data/!bigquery.md` | BigQuery 정본 하단에 initial backfill 결과 요약 추가 |

## 남은 리스크

1. `events_20260504` 이후 daily table은 아직 backfill 대상이 아니다.
   이번 승인 범위가 initial copy 실행 시점 latest인 `events_20260503`까지였기 때문이다.
2. 기존 GA4 BigQuery Link는 아직 허들러스 프로젝트를 향한다.
   따라서 cutover 전까지는 신규 daily table이 계속 source dataset에 생길 수 있다.
3. final delta backfill과 GA4 BigQuery Link 삭제/신규 생성은 별도 승인 전에는 진행하면 안 된다.

## 다음 할일

### TJ님이 할 일

1. Final delta backfill 승인 여부를 나중에 결정한다.
   왜: initial 이후 `events_20260504` 이후 daily table이 source에 새로 생기면 cutover 직전에 한 번 더 복사해야 데이터 공백이 없다.
   어떻게: cutover 직전 Codex에게 `delta-plan` 문서 작성을 먼저 지시하고, 결과가 맞으면 별도 Yellow Lane 승인 문구를 준다.
   성공 기준: source에는 있고 target에는 없는 daily table만 delta 대상으로 잡힌다.
   실패 시 해석: target에 이미 다른 row_count의 table이 있으면 즉시 중단하고 cleanup 승인 문서를 따로 만든다.
   승인 필요 여부: YES.
   추천 점수/자신감: 92%.

2. GA4 BigQuery Link cutover는 final delta 후 별도 승인으로 판단한다.
   왜: 현재 GA4 Link 삭제와 신규 Link 생성은 source export를 끊는 운영 변경이다.
   어떻게: GA4 Admin 화면의 BigQuery Link 삭제/생성 절차를 별도 승인 문서로 만들고, final delta verification PASS 후 진행한다.
   성공 기준: 신규 export dataset이 우리 target project에 생성되고, backfill dataset과 신규 export dataset이 분리 유지된다.
   실패 시 해석: Link 생성 실패나 daily export 지연이 생기면 허들러스 기존 Link 유지 상태에서 재시도 계획을 세운다.
   승인 필요 여부: YES.
   추천 점수/자신감: 85%.

### Codex가 할 일

1. 다음 승인 전까지는 backfill dataset을 정본 조회 경로로 전환하지 않는다.
   왜: 현재 sourceFreshness는 운영 중인 허들러스 export의 freshness를 봐야 한다.
   어떻게: `backend/src/sourceFreshness.ts`의 biocom source table reference를 유지한다.
   성공 기준: `ga4_bigquery_biocom` freshness table이 계속 `hurdlers-naver-pay.analytics_304759974.events_*`로 표시된다.
   실패 시 해석: backfill dataset으로 바뀌면 최신 export 감시가 끊겼다는 뜻이므로 즉시 롤백한다.
   승인 필요 여부: NO.
   추천 점수/자신감: 96%.

2. cutover 직전에 read-only delta-plan을 먼저 실행한다.
   왜: 새 daily table 범위를 숫자로 보고 final delta copy 승인 범위를 좁혀야 한다.
   어떻게: 현재 스크립트의 delta mode는 승인 전 차단되어 있으므로, 먼저 문서 승인 범위를 업데이트한 뒤 read-only 계획만 실행한다.
   성공 기준: source latest와 target latest 차이, delta table 수, 예상 row_count가 문서화된다.
   실패 시 해석: source read나 target inventory가 실패하면 GA4 Link 변경 전에 권한과 dataset 상태를 재점검한다.
   승인 필요 여부: delta copy는 YES, delta plan 문서 작성은 NO.
   추천 점수/자신감: 90%.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: biocom BigQuery backfill
Phase: initial_backfill
Lane: Yellow
Mode: approved_write_to_target_backfill_dataset

No-send verified: YES
No-write verified: YES outside approved target BigQuery dataset
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Changed files:
- backend/scripts/biocom-bigquery-backfill.ts
- data/biocom-bigquery-backfill-result-20260505.md
- data/!bigquery.md

Source / window / freshness:
- source: hurdlers-naver-pay.analytics_304759974
- target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- window: events_20240909 to events_20260503
- freshness: verification 2026-05-05 01:38 KST
- site: biocom
- confidence: 94%

What changed:
- Target dataset created in asia-northeast3.
- 602 daily events_YYYYMMDD tables copied with WRITE_EMPTY.
- Source/target verification passed.

What did not change:
- No GA4 BigQuery Link delete/create.
- No source table mutation.
- No production DB write.
- No platform send.
- No deploy.
- No sourceFreshness switch to backfill dataset.
- No final delta backfill.

Smoke / validation:
- plan PASS: source 602 tables, 24,310,428 rows, 35.02 GiB.
- initial-copy PASS: target 602 tables, 24,310,428 rows, 35.02 GiB.
- verify PASS: table_count, row_count, size_bytes, sample 5 dates, latest purchase sanity all match.
- npm run typecheck PASS.
- check-source-freshness PASS for thecleancoffee and biocom BigQuery sources.

Notes:
- Final delta backfill remains outside this approval.
- GA4 Link cutover remains blocked until separate approval.
```
