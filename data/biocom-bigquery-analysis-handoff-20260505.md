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
    - data/biocom-bigquery-backfill-result-20260505.md
  lane: Green
  allowed_actions:
    - read-only BigQuery analysis
    - local JSON/patch/document review
    - local SQL draft
    - local result documentation
  forbidden_actions:
    - BigQuery dataset create
    - BigQuery table copy
    - BigQuery table overwrite
    - BigQuery table delete
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - sourceFreshness switch to backfill dataset
    - source dataset IAM change
    - production DB write
    - deploy
    - platform send
  source_window_freshness_confidence:
    live_source: hurdlers-naver-pay.analytics_304759974
    historical_archive: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    site: biocom
    copied_window: events_20240909 to events_20260503
    freshness: verification JSON generated 2026-05-05 02:03 KST
    confidence: 96% for historical analysis after this handoff
```

# Biocom BigQuery 분석 Handoff

작성 시각: 2026-05-05 02:05 KST
대상: 다른 Codex/분석 에이전트가 biocom GA4 BigQuery raw 데이터를 안전하게 읽기 위한 인수인계 문서
운영DB 영향: 없음
외부 전환 전송: 없음
BigQuery write 허용: 없음

## 10초 요약

biocom GA4 과거 raw 데이터는 우리 프로젝트의 backfill archive로 복사 완료됐다.
단, 이 archive는 `events_20240909`부터 `events_20260503`까지의 과거 보존본이다.
현재 freshness 정본과 신규 daily export 감시는 아직 허들러스 source dataset을 봐야 한다.
다른 Codex는 이 문서를 기준으로 read-only 분석만 수행하고, final delta와 GA4 Link cutover는 별도 승인 전까지 건드리면 안 된다.

## Dataset 구분

### Current Live Source

현재 살아 있는 GA4 BigQuery export source:

```text
hurdlers-naver-pay.analytics_304759974
```

사용 목적:

- 현재 freshness 확인
- 신규 daily table 발생 여부 확인
- final delta 전 source 기준 inventory
- cutover 전까지의 정본 raw source

주의:

- 이 source는 허들러스 프로젝트 소유다.
- 이 source table을 삭제, 수정, overwrite 하면 안 된다.
- 이 source dataset IAM을 변경하면 안 된다.

### Historical Backfill Archive

우리 프로젝트에 복사된 과거 보존본:

```text
project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
```

사용 목적:

- 2024-09-09부터 2026-05-03까지 과거 raw 분석
- 2026-04-23~24 purchase 중복 원인 분석
- transaction_id 기준 dedupe 분석
- 과거 source / medium / campaign 품질 감사
- backfill 검증 재실행

주의:

- 이 archive를 현재 freshness 정본으로 쓰면 안 된다.
- 이 archive는 2026-05-04 이후 daily table을 포함하지 않는다.
- 운영 코드의 기본 source로 전환하면 안 된다.

## Copy 범위와 검증 상태

상세 결과 문서:

```text
data/biocom-bigquery-backfill-result-20260505.md
```

원본 verification JSON:

```text
data/biocom-bigquery-backfill-verify-20260505.json
```

검증 기준 시각:

```text
2026-05-05 02:03 KST
```

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| first table | `events_20240909` | `events_20240909` | 일치 |
| latest table | `events_20260503` | `events_20260503` | 일치 |
| daily table count | 602 | 602 | 일치 |
| total rows | 24,310,428 | 24,310,428 | 일치 |
| total size_bytes | 37,605,989,864 | 37,605,989,864 | 일치 |
| total size GiB | 35.02 | 35.02 | 일치 |
| intraday source table count | 0 | - | 참고 |

Sample check:

| table | source rows | target rows | 결과 |
|---|---:|---:|---|
| `events_20240909` | 9,441 | 9,441 | 일치 |
| `events_20260101` | 34,502 | 34,502 | 일치 |
| `events_20260423` | 73,802 | 73,802 | 일치 |
| `events_20260425` | 57,676 | 57,676 | 일치 |
| `events_20260503` | 48,553 | 48,553 | 일치 |

Latest purchase sanity:

| table | rows | purchase | distinct transaction_id | max event time KST |
|---|---:|---:|---:|---|
| source `events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 UTC+9 |
| target `events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 UTC+9 |

## Freshness 기준선

원본 freshness JSON:

```text
data/source-freshness-20260505-after-biocom-backfill.json
```

기준 시각:

```text
2026-05-05 02:03 KST
```

BigQuery source 결과:

| source | status | table | rows | freshness |
|---|---:|---|---:|---|
| `ga4_bigquery_thecleancoffee` | `fresh` | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260503` | 2,949 | 2026-05-03 23:41:44 KST |
| `ga4_bigquery_biocom` | `fresh` | `hurdlers-naver-pay.analytics_304759974.events_20260503` | 48,553 | 2026-05-03 23:59:58 KST |

핵심 규칙:

- `ga4_bigquery_biocom`은 아직 허들러스 source를 본다.
- `sourceFreshness` 기본 경로를 backfill archive로 바꾸면 안 된다.
- backfill archive는 historical analysis용이다.

## Query Job Project와 Credential

Query job project:

```text
project-dadba7dd-0229-4ff6-81c
```

Credential:

```text
seo-656@seo-aeo-487113.iam.gserviceaccount.com
```

`backend/src/sourceFreshness.ts`는 source project와 job project를 분리한다.
source table reference는 아래처럼 허들러스 source를 유지한다.

```text
hurdlers-naver-pay.analytics_304759974.events_*
```

query job은 아래 프로젝트에 생성한다.

```text
project-dadba7dd-0229-4ff6-81c
```

관련 patch artifact:

```text
data/sourceFreshness-job-project-diff-20260505.patch
```

참고:

- 현재 checkout에서는 `backend/src/sourceFreshness.ts` 변경이 이미 HEAD에 포함되어 있어 `git diff -- backend/src/sourceFreshness.ts`는 빈 결과가 될 수 있다.
- 위 patch artifact는 다른 Codex가 변경 의도를 볼 수 있도록 현재 HEAD의 해당 파일 변경 patch를 저장한 것이다.

## 분석 허용 범위

허용:

- read-only `SELECT`
- dry-run query
- local SQL draft
- local markdown/json result 작성
- 과거 archive 기준 분석
- live source 기준 freshness 확인

금지:

- BigQuery dataset 생성
- BigQuery table copy
- BigQuery table overwrite
- BigQuery table delete
- GA4 BigQuery Link 삭제
- 신규 GA4 BigQuery Link 생성
- source dataset IAM 변경
- `sourceFreshness` 기본 경로를 backfill archive로 전환
- 운영DB write
- deploy
- GA4/Meta/TikTok/Google Ads 전송

## 분석 규칙

### Purchase 분석

2026-04-23~24는 purchase event 중복 이슈가 확인된 window다.
따라서 purchase event count를 주문 수로 바로 쓰면 안 된다.

분석 기준:

```text
order_count = distinct ecommerce.transaction_id
```

또는 transaction_id가 event_params에만 있는 예외까지 포함하려면 아래처럼 coalesce한다.

```sql
COALESCE(
  ecommerce.transaction_id,
  (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id' LIMIT 1)
)
```

기본 purchase query 패턴:

```sql
SELECT
  event_date,
  COUNTIF(event_name = 'purchase') AS purchase_events,
  COUNT(DISTINCT IF(
    event_name = 'purchase',
    NULLIF(COALESCE(
      ecommerce.transaction_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id' LIMIT 1)
    ), ''),
    NULL
  )) AS distinct_transaction_ids
FROM `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260423' AND '20260424'
GROUP BY event_date
ORDER BY event_date;
```

### Source / Medium / Campaign 분석

가능하면 raw field 존재 여부를 먼저 확인한다.

우선순위:

1. `session_traffic_source_last_click`
2. `collected_traffic_source`
3. event_params 내 UTM 관련 key
4. page_location query parameter

missing rate를 숫자로 같이 기록한다.

필수 기록:

- source dataset
- target dataset
- table suffix window
- run time KST
- row_count denominator
- missing count/rate
- confidence

## 72시간 Late Update 기준

Google Analytics BigQuery Export 공식 문서는 daily `events_YYYYMMDD` table이 table date 이후에도 late event로 업데이트될 수 있다고 설명한다.
공식 표현은 table date 이후 `2 calendar days, plus today` 동안 업데이트될 수 있다는 내용이다.
출처: https://support.google.com/analytics/answer/9358801?hl=en-EN

이번 initial backfill은 2026-05-05 01:38~02:03 KST에 검증됐다.
latest table은 `events_20260503`이다.

따라서 final delta 때 아래 table은 다시 비교해야 한다.

| table | 이유 |
|---|---|
| `events_20260501` | late update 또는 예외적 reprocess 가능성 확인 |
| `events_20260502` | table date 이후 update window에 걸칠 수 있음 |
| `events_20260503` | initial copy 당시 아직 late update 가능성이 큼 |
| `events_20260504` 이후 | initial copy 이후 신규 table 가능성 |

Final delta 기본 원칙:

1. source에는 있고 target에는 없는 신규 `events_YYYYMMDD` table을 찾는다.
2. 신규 table은 별도 승인 후 `WRITE_EMPTY`로 copy한다.
3. target에 이미 있는 최근 3-4일 table도 source/target row_count와 latest purchase sanity를 다시 비교한다.
4. 이미 존재하는 target table의 row_count가 source와 달라졌다면 자동 overwrite/delete를 하지 않는다.
5. mismatch table은 repair 계획과 별도 Yellow Lane 승인을 만든다.

Repair 추천 방식:

```text
events_YYYYMMDD_repair_yyyymmddhhmm
```

위처럼 target dataset 내부 임시 repair table로 먼저 copy한다.
그 다음 source, existing target, repair target을 비교한다.
기존 target 삭제나 교체는 별도 승인 전까지 하지 않는다.

## Cutover 전 Hard Stop

다른 Codex가 아래 상황을 발견하면 즉시 중단하고 보고한다.

1. backfill archive를 live freshness source로 쓰라는 요청.
2. target table overwrite 또는 delete가 필요한 상황.
3. source table 수정 또는 source dataset IAM 변경이 필요한 상황.
4. GA4 BigQuery Link 삭제/생성 요청.
5. 2026-05-04 이후 데이터를 archive에서 찾으려는 분석.
6. purchase event count를 주문 수로 쓰려는 분석.
7. final delta copy를 승인 없이 실행하려는 상황.

## 다음 할일

### TJ님이 할 일

1. Cutover 시점을 정한 뒤 final delta 승인 여부를 판단한다.
   왜: initial 이후 새 daily table과 최근 3-4일 late update 차이를 닫아야 archive가 완성된다.
   어떻게: Codex가 먼저 read-only delta-plan을 만들고, TJ님은 copy/repair가 필요한 table 목록과 row_count 차이를 보고 승인한다.
   성공 기준: 신규 table은 `WRITE_EMPTY`, mismatch repair는 임시 repair table 방식으로 별도 검증된다.
   실패 시 해석: mismatch가 있으면 자동 삭제/교체 없이 repair 승인 문서로 넘어간다.
   승인 필요 여부: YES.
   추천 점수/자신감: 92%.

2. GA4 BigQuery Link cutover는 final delta PASS 후 별도 승인으로 진행한다.
   왜: Link 삭제/생성은 export 경로를 바꾸는 운영 변경이다.
   어떻게: GA4 Admin에서 허들러스 Link 삭제와 우리 프로젝트 신규 Link 생성을 별도 문서와 승인 문구로 진행한다.
   성공 기준: 신규 `project-dadba7dd-0229-4ff6-81c.analytics_304759974` dataset이 생기고, sourceFreshness가 신규 export로 전환 가능한 상태가 된다.
   실패 시 해석: 기존 허들러스 Link를 유지한 상태에서 권한/한도/location 문제를 재점검한다.
   승인 필요 여부: YES.
   추천 점수/자신감: 85%.

### Codex가 할 일

1. 다른 Codex 분석 시 이 handoff를 먼저 읽게 한다.
   왜: archive와 live source를 혼동하면 freshness와 현재 데이터 판단이 틀어진다.
   어떻게: 분석 지시문에 `data/biocom-bigquery-analysis-handoff-20260505.md`를 required context로 넣는다.
   성공 기준: 분석 결과마다 source/window/freshness/confidence가 포함된다.
   실패 시 해석: source가 누락되면 분석 결론을 신뢰하지 않고 재작성한다.
   승인 필요 여부: NO.
   추천 점수/자신감: 96%.

2. final delta 전까지 write 작업을 하지 않는다.
   왜: 이번 handoff pack은 read-only 분석 준비물이다.
   어떻게: BigQuery copy/delete/overwrite, GA4 Link 변경, deploy 명령을 실행하지 않는다.
   성공 기준: changed files가 local data/doc artifact로만 제한된다.
   실패 시 해석: write 흔적이 있으면 즉시 보고하고 중단한다.
   승인 필요 여부: NO for read-only, YES for delta/cutover.
   추천 점수/자신감: 98%.

## Auditor Verdict

```text
Auditor verdict: PASS
Project: biocom BigQuery handoff pack
Phase: post_initial_backfill_handoff
Lane: Green
Mode: document_and_json_only

No-send verified: YES
No-write verified: YES for BigQuery/DB/platform; local artifact writes only
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Changed files:
- data/biocom-bigquery-backfill-verify-20260505.json
- data/source-freshness-20260505-after-biocom-backfill.json
- data/sourceFreshness-job-project-diff-20260505.patch
- data/biocom-bigquery-analysis-handoff-20260505.md

Source / window / freshness:
- live source: hurdlers-naver-pay.analytics_304759974
- historical archive: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- copied window: events_20240909 to events_20260503
- freshness: verify JSON generated 2026-05-05 02:03 KST
- site: biocom
- confidence: 96%

What changed:
- Handoff pack artifacts created.

What did not change:
- No BigQuery dataset created.
- No BigQuery table copied.
- No GA4 BigQuery Link deleted or created.
- No sourceFreshness route changed.
- No deploy.
- No platform send.

Next actions:
- Use archive for historical analysis only.
- Run final delta/repair plan near cutover under separate approval.
```
