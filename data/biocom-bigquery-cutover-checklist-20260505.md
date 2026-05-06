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
  lane: Green
  allowed_actions:
    - cutover runbook documentation
    - approval checklist documentation
    - read-only verification command planning
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - BigQuery dataset create
    - BigQuery table copy
    - BigQuery table overwrite
    - sourceFreshness switch
    - deploy
    - platform send
  source_window_freshness_confidence:
    live_source: hurdlers-naver-pay.analytics_304759974
    historical_archive: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    planned_new_export: project-dadba7dd-0229-4ff6-81c.analytics_304759974
    site: biocom
    freshness: cutover checklist written 2026-05-05 02:18 KST
    confidence: 88%
```

# Biocom GA4 BigQuery Link Cutover Checklist

작성 시각: 2026-05-05 02:18 KST
작업 유형: cutover 준비 문서
실제 GA4 Link 변경: 하지 않음
BigQuery write: 하지 않음
Auditor verdict: NEEDS_HUMAN_APPROVAL_FOR_EXECUTION

## 10초 요약

지금 바로 GA4 BigQuery Link를 바꾸면 안 된다.
cutover 직전에 final delta plan을 다시 실행하고, missing table 또는 recent row_count mismatch가 없는지 확인해야 한다.
그 다음 TJ님이 GA4 Admin에서 기존 허들러스 Link를 삭제하고, 우리 프로젝트 `project-dadba7dd-0229-4ff6-81c`로 신규 Link를 생성한다.
신규 export dataset은 `analytics_304759974`여야 하며, 과거 archive인 `analytics_304759974_hurdlers_backfill`과 절대 섞으면 안 된다.

## Dataset 역할

| dataset | 역할 | 사용 시점 |
|---|---|---|
| `hurdlers-naver-pay.analytics_304759974` | 현재 live source | cutover 전 freshness와 final delta source |
| `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` | 과거 archive | 2024-09-09부터 cutover 전 과거 raw 분석 |
| `project-dadba7dd-0229-4ff6-81c.analytics_304759974` | 신규 GA4 export 예정 dataset | cutover 후 신규 daily export |

절대 금지:

- GA4 Link를 `_hurdlers_backfill` dataset에 연결하려고 하면 안 된다.
- `sourceFreshness`를 `_hurdlers_backfill`로 전환하면 안 된다.
- 신규 export 검증 전에는 허들러스 source 의존을 끊으면 안 된다.

## Cutover 전 필수 조건

아래가 모두 충족되어야 GA4 Link 삭제/생성으로 넘어간다.

1. Initial backfill PASS.
   - 완료: `events_20240909`부터 `events_20260503`까지 602개 table 검증 PASS.
2. Cutover 직전 final delta plan 재실행.
   - 현재 2026-05-05 02:13 KST delta-plan은 copy 대상 0개.
   - 이 값은 cutover 직전 다시 확인해야 한다.
3. Missing target table이 있으면 별도 delta-copy 승인 후 copy 완료.
4. 최근 3-4일 row_count mismatch가 있으면 repair 승인 문서 작성.
5. 신규 export dataset 이름과 위치 확인.
   - project: `project-dadba7dd-0229-4ff6-81c`
   - dataset: `analytics_304759974`
   - location: `asia-northeast3`
6. TJ님 또는 작업자가 GA4 property Editor 이상 권한을 가진다.
7. 작업자가 target BigQuery project Owner 또는 필요한 link 생성 권한을 가진다.

## TJ님 GA4 Admin 작업 순서

실제 클릭은 TJ님 또는 GA4 Admin 권한자가 수행한다.
Codex는 화면을 직접 클릭하지 않는다.

1. GA4 Admin 접속.
2. biocom GA4 property `304759974` 선택.
3. Product Links > BigQuery Links 이동.
4. 기존 `hurdlers-naver-pay` Link 상세 화면 캡처.
5. Daily export ON, Streaming 상태, location `asia-northeast3`를 캡처.
6. cutover 직전 Codex delta-plan PASS 확인.
7. 기존 `hurdlers-naver-pay` Link 삭제.
8. 새 BigQuery Link 생성.
9. project 선택: `project-dadba7dd-0229-4ff6-81c`.
10. location 선택: `asia-northeast3`.
11. data stream 선택: biocom web stream 포함.
12. event exclusion 없음 확인.
13. export option: Daily ON.
14. Streaming은 초기에는 OFF 추천.
15. Submit 전 설정 화면 캡처.
16. 생성 완료 화면 캡처.

## Daily ON, Streaming OFF 추천 근거

지금 목적은 광고/구매 정합성 분석이다.
초기 cutover 검증은 안정적인 daily `events_YYYYMMDD` table 기준으로 하는 편이 맞다.
Streaming export는 빠르지만 best-effort이고, 신규 사용자 traffic source 정보가 제한될 수 있다.
따라서 첫 cutover는 Daily ON, Streaming OFF로 시작하고, 필요하면 별도 승인으로 Streaming을 검토한다.

## 공식 근거

GA4 BigQuery Export 설정 공식 문서는 Analytics Admin > Product Links > BigQuery Links에서 project와 location을 선택하고 Daily 또는 Streaming export를 선택한다고 안내한다.
같은 문서에 따르면 link 생성 후 data가 BigQuery에 흐르기 시작하는 데 최대 24시간이 걸릴 수 있고, Daily export는 보통 property timezone 기준 전날 데이터를 하루 1회 export한다.
또한 link 삭제와 신규 생성 사이에는 daily/streaming export 공백이 생길 수 있다.

관련 공식 문서:

- GA4 BigQuery Export 설정: https://support.google.com/analytics/answer/9823238?hl=en
- GA4 BigQuery Export 동작과 daily/streaming 차이: https://support.google.com/analytics/answer/9358801?hl=en
- BigQuery table 관리와 copy location 제약 확인용: https://cloud.google.com/bigquery/docs/managing-tables

## Cutover 직후 Codex 검증

신규 Link 생성 직후 daily table이 바로 생기지 않을 수 있다.
처음 24시간은 dataset 생성 여부와 export status를 먼저 본다.

### 1차 확인

```bash
cd backend
npx tsx scripts/check-source-freshness.ts --json
```

주의:

- 이 단계에서는 `sourceFreshness`를 아직 신규 dataset으로 바꾸지 않는다.
- 위 명령은 기존 허들러스 source freshness를 계속 확인한다.

### 신규 dataset metadata 확인

별도 read-only script 또는 BigQuery Console에서 확인한다.

확인 대상:

```text
project-dadba7dd-0229-4ff6-81c.analytics_304759974
```

성공 기준:

- dataset exists.
- location `asia-northeast3`.
- GA4 export service account 권한 오류 없음.
- 첫 daily table 생성 전이면 `tables=0`도 초기에는 가능.

### 첫 daily table 확인

첫 daily table이 생긴 뒤 아래를 확인한다.

```sql
SELECT
  COUNT(*) AS total_events,
  COUNTIF(event_name = 'purchase') AS purchase_events,
  COUNT(DISTINCT IF(event_name = 'purchase', ecommerce.transaction_id, NULL)) AS distinct_purchase_transaction_ids,
  FORMAT_TIMESTAMP('%F %T %Z', MAX(TIMESTAMP_MICROS(event_timestamp)), 'Asia/Seoul') AS max_event_time_kst
FROM `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY));
```

첫 daily table 성공 기준:

| 항목 | 기준 |
|---|---|
| table exists | `events_YYYYMMDD` 존재 |
| total_events | 0보다 큼 |
| purchase_events | 최근 주문 흐름과 큰 괴리 없음 |
| distinct transaction_id | purchase 대비 과도한 결측/중복 없음 |
| max event time | 전날 late night까지 포함되는지 확인 |
| location | `asia-northeast3` |

첫날은 생성 지연과 link 생성 시점 영향이 있을 수 있다.
최소 3일 연속 daily table 생성 후 `sourceFreshness` 전환을 추천한다.

## sourceFreshness 전환 기준

현재 설정:

```text
sourceProjectId = hurdlers-naver-pay
dataset = analytics_304759974
jobProjectId = project-dadba7dd-0229-4ff6-81c
location = asia-northeast3
```

전환 후 목표:

```text
sourceProjectId = project-dadba7dd-0229-4ff6-81c
dataset = analytics_304759974
jobProjectId = project-dadba7dd-0229-4ff6-81c
location = asia-northeast3
```

전환 조건:

1. 신규 Link 생성 완료.
2. 신규 `analytics_304759974` dataset exists.
3. 최소 3일 연속 daily `events_YYYYMMDD` table 생성.
4. latest table row_count와 purchase sanity가 정상.
5. 더클린커피 freshness가 계속 fresh.
6. `npm run typecheck` PASS.
7. `data/!bigquery.md`에 전환 결과 기록.

전환 금지:

- 신규 daily table 생성 전.
- 첫 daily table만 보고 즉시 전환.
- backfill archive로 전환.
- final delta/repair 미해결 상태에서 전환.

## Hard Stop

아래 중 하나라도 발생하면 중단한다.

| 상황 | 중단 이유 | 다음 확인 |
|---|---|---|
| `project-dadba7dd-0229-4ff6-81c`가 GA4 project 선택 화면에 없음 | link 생성 불가 | GCP/GA4 권한 확인 |
| location을 `asia-northeast3`로 선택할 수 없음 | source/archive와 location 불일치 위험 | 작업 중단, 지역 전략 재검토 |
| `_hurdlers_backfill` dataset에 연결하려는 흐름 | 과거 archive 오염 위험 | 즉시 중단 |
| final delta plan 미실행 | source 누락 위험 | read-only delta-plan 재실행 |
| recent row_count mismatch 존재 | late update 미반영 | repair 승인 문서 작성 |
| 신규 Link 생성 후 24~48시간 동안 dataset/table이 전혀 안 생김 | export 실패 가능성 | GA4 Link 상태, billing, service account 권한 확인 |
| sourceFreshness를 backfill로 바꾸라는 요청 | stale source 감시 위험 | 거부하고 live source/new export 기준 재확인 |

## 승인 문구 초안

이 문구는 final delta plan이 PASS이고, TJ님이 GA4 Admin에서 실제 클릭 가능한 시간이 정해졌을 때만 사용한다.

```text
YES: biocom GA4 BigQuery Link cutover 승인.

전제:
- initial backfill PASS.
- cutover 직전 final delta plan PASS.
- missing target daily table copy 또는 repair 필요 사항이 모두 해결됨.
- 신규 target project는 project-dadba7dd-0229-4ff6-81c.
- 신규 GA4 export dataset은 analytics_304759974.
- location은 asia-northeast3.

허용:
- TJ님 또는 GA4 Admin 권한자가 기존 hurdlers-naver-pay BigQuery Link 삭제
- TJ님 또는 GA4 Admin 권한자가 project-dadba7dd-0229-4ff6-81c로 신규 BigQuery Link 생성
- Daily export ON
- Streaming export OFF
- Codex의 read-only post-cutover 검증
- 결과 문서화

금지:
- analytics_304759974_hurdlers_backfill dataset에 Link 연결
- source table 삭제/수정
- backfill archive table 삭제/수정
- 신규 export 검증 전 sourceFreshness 전환
- deploy
- platform send
```

## 하지 않은 것

- GA4 BigQuery Link 삭제: 하지 않음.
- 신규 GA4 BigQuery Link 생성: 하지 않음.
- BigQuery dataset 생성: 하지 않음.
- BigQuery table copy/overwrite/delete: 하지 않음.
- sourceFreshness 전환: 하지 않음.
- deploy: 하지 않음.
- platform send: 하지 않음.

## 다음 할일

### TJ님이 할 일

1. GA4 BigQuery Links 화면을 확인한다.
   왜: 기존 `hurdlers-naver-pay` Link 상태와 신규 project 선택 가능 여부는 Codex가 로컬에서 대신 확인할 수 없다.
   어떻게: GA4 Admin > biocom property `304759974` > Product Links > BigQuery Links에서 기존 link 상세와 신규 project 선택 화면을 캡처한다.
   성공 기준: 기존 link가 살아 있고, `project-dadba7dd-0229-4ff6-81c`가 신규 link 대상 project로 선택 가능하다는 근거가 생긴다.
   실패 시 해석: project가 안 보이면 GA4/GCP 권한 또는 project owner 조건을 확인해야 한다.
   승인 필요 여부: 확인은 NO, 실제 삭제/생성은 YES.
   추천 점수/자신감: 88%.

2. cutover 희망 시간을 정한다.
   왜: final delta plan은 cutover 직전에 실행해야 한다.
   어떻게: TJ님이 GA4 Admin에서 직접 link 삭제/생성을 할 수 있고, Codex가 바로 read-only 검증을 돌릴 수 있는 시간대를 정한다.
   성공 기준: 같은 window 안에서 delta-plan, 필요한 copy/repair 승인, GA4 Link 작업, post-check를 순서대로 진행한다.
   실패 시 해석: 시간이 벌어지면 delta-plan은 stale해지므로 재실행한다.
   승인 필요 여부: YES for cutover execution.
   추천 점수/자신감: 90%.

### Codex가 할 일

1. cutover 직전에 final delta plan을 다시 실행한다.
   왜: 현재 delta 대상은 0개지만 cutover 때는 `events_20260504` 이후 table이 생겨 있을 수 있다.
   어떻게: `npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan --json`을 실행하고 missing table과 recent mismatch를 문서화한다.
   성공 기준: copy 대상과 repair 대상이 분리된다.
   실패 시 해석: mismatch가 있으면 Link cutover 전에 repair 계획과 별도 승인이 필요하다.
   승인 필요 여부: NO for plan, YES for copy/repair.
   추천 점수/자신감: 95%.

2. Link 생성 후 신규 export를 3일 이상 검증한 뒤 sourceFreshness 전환 patch를 제안한다.
   왜: 신규 export가 안정적으로 daily table을 만드는지 확인해야 한다.
   어떻게: 신규 `analytics_304759974.events_YYYYMMDD` table의 rows, purchase, distinct transaction_id, max event time을 매일 확인한다.
   성공 기준: 3일 연속 daily table 생성과 sanity PASS.
   실패 시 해석: sourceFreshness를 허들러스 source에 유지하고 신규 Link/export 장애를 조사한다.
   승인 필요 여부: sourceFreshness 전환은 별도 승인 또는 명시 지시 필요.
   추천 점수/자신감: 91%.

## Auditor Verdict

```text
Auditor verdict: NEEDS_HUMAN_APPROVAL_FOR_EXECUTION
Project: biocom GA4 BigQuery cutover
Phase: cutover_checklist
Lane: Green for document, separate approval required for execution
Mode: document_only

No-send verified: YES
No-write verified: YES for BigQuery/DB/platform; local document only
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Source / window / freshness:
- live source: hurdlers-naver-pay.analytics_304759974
- historical archive: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- planned new export: project-dadba7dd-0229-4ff6-81c.analytics_304759974
- freshness: checklist written 2026-05-05 02:18 KST
- site: biocom
- confidence: 88%

What changed:
- Cutover checklist and approval wording documented.

What did not change:
- No GA4 Link delete/create.
- No BigQuery dataset/table write.
- No sourceFreshness switch.
- No deploy.

Next actions:
- TJ님 screen check.
- Codex cutover-time final delta plan.
- Separate approval before any Link change or copy.
```
