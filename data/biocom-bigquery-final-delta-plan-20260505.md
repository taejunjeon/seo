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
  lane: Green
  allowed_actions:
    - read-only BigQuery inventory query
    - read-only source/target row_count comparison
    - read-only latest purchase sanity query
    - local JSON/document write
  forbidden_actions:
    - BigQuery dataset create
    - BigQuery table copy
    - BigQuery table overwrite
    - BigQuery table delete
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - sourceFreshness switch to backfill dataset
    - source table mutation
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    site: biocom
    window: events_20240909 to events_20260503
    freshness: delta-plan generated 2026-05-05 02:13 KST
    confidence: 95%
```

# Biocom BigQuery Final Delta Plan

작성 시각: 2026-05-05 02:16 KST
작업 유형: read-only delta-plan
BigQuery write: 없음
GA4 Link 변경: 없음
Auditor verdict: PASS

## 10초 요약

2026-05-05 02:13 KST 기준으로 final delta copy 대상은 없다.
허들러스 source와 우리 backfill archive 모두 latest daily table이 `events_20260503`이고, table count 602개와 total rows 24,310,428이 일치한다.
최근 4개 table인 `events_20260430`부터 `events_20260503`까지 row_count mismatch도 없다.
따라서 지금은 delta copy를 하지 말고, GA4 Link cutover 직전에 이 plan을 다시 실행해야 한다.

## 실행 목적

이 문서는 initial backfill 이후 source에 새 daily table이 생겼는지 확인하는 read-only 계획이다.
이번 실행은 복사나 삭제를 하지 않고, cutover 직전 필요한 승인 범위를 숫자로 좁히는 역할만 한다.

## Source와 Target

| 구분 | 값 |
|---|---|
| credential | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| live source | `hurdlers-naver-pay.analytics_304759974` |
| backfill archive | `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` |
| job project | `project-dadba7dd-0229-4ff6-81c` |
| location | `asia-northeast3` |

## 실행 명령

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan --json > ../data/biocom-bigquery-final-delta-plan-20260505.json
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan
```

원본 JSON:

```text
data/biocom-bigquery-final-delta-plan-20260505.json
```

## Delta Inventory 결과

기준 시각: 2026-05-05 02:13 KST

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| first table | `events_20240909` | `events_20240909` | 일치 |
| latest table | `events_20260503` | `events_20260503` | 일치 |
| daily table count | 602 | 602 | 일치 |
| total rows | 24,310,428 | 24,310,428 | 일치 |
| total size_bytes | 37,605,989,864 | 37,605,989,864 | 일치 |
| total size GiB | 35.02 | 35.02 | 일치 |
| source intraday table count | 0 | - | 참고 |

Delta 판단:

| 항목 | 값 | 판단 |
|---|---:|---|
| source에는 있고 target에는 없는 table | 0 | 지금 copy 대상 없음 |
| target에는 있고 source에는 없는 table | 0 | 이상 없음 |
| 기존 target row_count mismatch | 0 | repair 필요 없음 |
| recommended approval | `none_needed` | 현재 시점 delta copy 불필요 |
| ready for delta copy approval | YES | 단, copy 대상이 없으므로 실행하지 않음 |

## 최근 4일 Late Update Check

GA4 daily table은 table date 이후 늦게 들어온 이벤트로 업데이트될 수 있다.
그래서 final delta 때는 신규 table만 보지 않고, 최근 3-4일 기존 target table row_count도 다시 비교해야 한다.

이번 read-only 비교 결과:

| table | source rows | target rows | 결과 |
|---|---:|---:|---|
| `events_20260430` | 48,380 | 48,380 | 일치 |
| `events_20260501` | 46,229 | 46,229 | 일치 |
| `events_20260502` | 40,310 | 40,310 | 일치 |
| `events_20260503` | 48,553 | 48,553 | 일치 |

현재 repair copy는 필요 없다.

## Latest Purchase Sanity

| table | source rows | target rows | source purchase | target purchase | source distinct transaction_id | target distinct transaction_id | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| `events_20260503` | 48,553 | 48,553 | 59 | 59 | 59 | 59 | 일치 |

max event time도 source와 target 모두 `2026-05-03 23:59:58 UTC+9`로 일치한다.

## 공식 근거

GA4 BigQuery Export 공식 문서는 daily `events_YYYYMMDD` table이 table date 이후에도 late event로 업데이트될 수 있다고 설명한다.
따라서 final delta는 신규 table만 복사하는 작업이 아니라, 최근 며칠 table의 row_count 재확인을 포함해야 한다.

관련 공식 문서:

- GA4 BigQuery Export: https://support.google.com/analytics/answer/9358801?hl=en
- GA4 BigQuery Export 설정과 Link 삭제/생성: https://support.google.com/analytics/answer/9823238?hl=en
- BigQuery table 관리와 copy: https://cloud.google.com/bigquery/docs/managing-tables

## 현재 결정

현재 시점에는 delta copy를 승인하거나 실행할 필요가 없다.
source latest가 아직 `events_20260503`이고 target latest도 동일하기 때문이다.

다만 이 결론은 2026-05-05 02:13 KST의 스냅샷이다.
GA4 Link cutover 직전에는 반드시 다시 실행해야 한다.

## Cutover 직전 재실행 기준

cutover 직전에는 아래 명령을 다시 실행한다.

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan --json
```

그때 확인할 것:

1. source latest daily table.
2. target latest daily table.
3. source에는 있고 target에는 없는 신규 daily table.
4. 최근 3-4일 기존 target table row_count mismatch.
5. latest table purchase와 distinct transaction_id sanity.
6. copy 대상이 있으면 delta-copy 승인 문구.
7. mismatch가 있으면 repair 승인 문구.

## Delta Copy 승인 문구

현재는 copy 대상이 없으므로 아래 문구를 쓰지 않는다.
cutover 직전 재실행 결과 missing target table이 생겼을 때만 사용한다.

```text
YES: biocom BigQuery final delta backfill Yellow Lane 승인.

Codex는 read-only delta-plan 결과에 나온
`hurdlers-naver-pay.analytics_304759974` source daily table 중
`project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` target archive에 없는
`events_YYYYMMDD` table만 `WRITE_EMPTY`로 copy해도 된다.

허용 범위:
- delta-plan 결과에 나온 missing target daily table copy
- copy 후 source/target table count, row_count, size_bytes 검증
- 최근 3-4일 row_count 재비교
- latest purchase / distinct transaction_id sanity 검증
- 결과 문서화

금지:
- existing target table overwrite
- existing target table delete
- source table 수정/삭제
- source dataset IAM 변경
- GA4 BigQuery Link 삭제
- 신규 GA4 BigQuery Link 생성
- sourceFreshness 전환
- deploy
- platform send

이미 target에 있는 table의 row_count가 source와 다르면 자동 overwrite/delete하지 말고 즉시 중단한다.
repair copy 또는 교체는 별도 승인으로 진행한다.
```

## Repair 승인 기준

현재는 repair 필요가 없다.
cutover 직전 재실행에서 기존 target table row_count가 source와 달라지면 아래 원칙을 따른다.

1. 자동 overwrite/delete 금지.
2. source와 existing target row_count 차이를 문서화.
3. `events_YYYYMMDD_repair_yyyymmddhhmm` 형식의 임시 repair table copy 계획 작성.
4. 별도 Yellow Lane 승인 전에는 repair copy도 하지 않음.
5. 기존 target table 삭제/교체는 repair copy 검증 후 별도 승인.

## 하지 않은 것

- BigQuery dataset 생성: 하지 않음.
- BigQuery table copy: 하지 않음.
- BigQuery table overwrite/delete: 하지 않음.
- GA4 BigQuery Link 삭제/생성: 하지 않음.
- sourceFreshness 전환: 하지 않음.
- deploy: 하지 않음.
- platform send: 하지 않음.

## 다음 할일

### TJ님이 할 일

1. GA4 Link cutover 작업 가능 시간을 정한다.
   왜: final delta plan은 cutover 직전에 다시 실행해야 의미가 있다.
   어떻게: GA4 Admin에서 직접 link 삭제/생성을 할 수 있는 시간대를 정하고 Codex가 바로 delta-plan과 post-check를 돌릴 수 있게 한다.
   성공 기준: cutover 직전 source/target delta 상태를 보고 copy 또는 no-copy 결정을 할 수 있다.
   실패 시 해석: 일정이 밀리면 이 delta-plan은 오래된 스냅샷이므로 다시 실행해야 한다.
   승인 필요 여부: YES for cutover.
   추천 점수/자신감: 90%.

### Codex가 할 일

1. cutover 직전에 delta-plan을 다시 실행한다.
   왜: 2026-05-05 02:13 KST 기준으로는 copy 대상이 없지만, 이후 `events_20260504` 이상이 생길 수 있다.
   어떻게: `npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan --json`을 다시 실행하고 missing table과 recent mismatch를 문서화한다.
   성공 기준: copy 대상 0개 또는 승인 가능한 missing table 목록이 나온다.
   실패 시 해석: mismatch가 있으면 자동 copy가 아니라 repair 승인 문서로 전환한다.
   승인 필요 여부: NO for read-only, YES for copy/repair.
   추천 점수/자신감: 95%.

## Auditor Verdict

```text
Auditor verdict: PASS
Project: biocom BigQuery final delta
Phase: delta_plan
Lane: Green
Mode: read_only

No-send verified: YES
No-write verified: YES for BigQuery/DB/platform; local artifact writes only
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Source / window / freshness:
- source: hurdlers-naver-pay.analytics_304759974
- target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- window: events_20240909 to events_20260503
- freshness: delta-plan 2026-05-05 02:13 KST
- site: biocom
- confidence: 95%

Validation:
- missing target tables: 0
- existing row_count mismatches: 0
- recent 4 table checks: all match
- latest purchase sanity: match

Next actions:
- Do not copy now.
- Re-run delta-plan immediately before GA4 Link cutover.
```
