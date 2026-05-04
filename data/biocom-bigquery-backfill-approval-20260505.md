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
  lane: Yellow
  allowed_actions_after_approval:
    - create one target BigQuery dataset
    - copy GA4 daily events tables from source dataset to target backfill dataset
    - run read-only verification queries
    - write local execution report
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - source table delete
    - source table update
    - source dataset IAM change
    - production DB write
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    site: biocom
    window: events_20240909 to current latest daily table
    freshness: latest verified table events_20260503, max event time 2026-05-03 23:59:58 KST
    confidence: 88%
```

# Biocom BigQuery Backfill 실행 승인 문서

작성 시각: 2026-05-05 01:17 KST
요청 유형: Yellow Lane
대상: biocom GA4 BigQuery raw export backfill
데이터 위치: 외부 BigQuery source dataset, 우리 GCP target project
운영DB 영향: 없음
외부 전환 전송: 없음
Codex 진행 추천 자신감: 88%

## 10초 요약

biocom GA4 raw 데이터는 현재 `hurdlers-naver-pay.analytics_304759974`에서 정상 조회된다.
허들러스에 추가 Job User 권한을 요청하지 않아도 `project-dadba7dd-0229-4ff6-81c`를 job project로 쓰면 freshness와 raw query가 가능하다.
다음 단계는 과거 daily table을 우리 프로젝트의 별도 backfill dataset으로 복사해 보존하는 것이다.
승인 전에는 dataset 생성, table copy, GA4 Link 삭제·생성, source table 변경을 하지 않는다.

## 실행 목적

이 작업은 허들러스 프로젝트에 쌓인 biocom GA4 raw event를 우리 통합 프로젝트에 보존하는 작업이다.

목적은 세 가지다.

1. 허들러스 BigQuery Link를 나중에 해제하더라도 과거 GA4 raw 데이터를 잃지 않는다.
2. 2026-04-23~24 purchase 중복 같은 추적 품질 이슈를 과거 raw 기준으로 계속 재검증할 수 있게 한다.
3. 이후 GA4 BigQuery Link를 우리 프로젝트로 재연결할 때, 과거 backfill dataset과 신규 GA4 export dataset을 분리해 중복과 충돌을 피한다.

이번 승인은 `과거 데이터 복사`만 다룬다.
기존 GA4 BigQuery Link 삭제와 신규 Link 생성은 이 문서 승인 범위에 포함하지 않는다.

## Source Dataset과 Target Dataset

| 구분 | 값 |
|---|---|
| source project | `hurdlers-naver-pay` |
| source dataset | `analytics_304759974` |
| source table pattern | `events_YYYYMMDD` |
| source location | `asia-northeast3` |
| job project | `project-dadba7dd-0229-4ff6-81c` |
| target project | `project-dadba7dd-0229-4ff6-81c` |
| target dataset 후보 | `analytics_304759974_hurdlers_backfill` |
| target dataset location | `asia-northeast3` |

Target dataset location은 반드시 `asia-northeast3`로 만든다.
source와 target dataset location이 다르면 BigQuery table copy가 실패하거나 별도 전송 비용·절차가 생길 수 있다.

## 현재 확인값

기준 시각: 2026-05-05 01:05 KST
source: `hurdlers-naver-pay.analytics_304759974`
site: biocom
confidence: A

| 항목 | 값 |
|---|---:|
| freshness status | `fresh` |
| first table | `events_20240909` |
| latest verified table | `events_20260503` |
| daily table count | 602 |
| total rows | 24,310,428 |
| total size | 35.02 GiB |
| latest table rows | 48,553 |
| latest table purchase | 59 |
| latest table distinct transaction_id | 59 |
| latest table max event time KST | 2026-05-03 23:59:58 |

## Initial Backfill 범위

Initial backfill은 승인 직후 source dataset에 존재하는 모든 daily `events_YYYYMMDD` table을 복사한다.

초기 기준 범위:

- 시작 table: `events_20240909`
- 끝 table: 실행 시점의 최신 daily `events_YYYYMMDD`
- 현재 검증된 최신 table: `events_20260503`
- 현재 검증된 table 수: 602

실행 시점에 `events_20260504` 또는 이후 daily table이 이미 생겨 있으면 initial backfill 범위에 포함한다.
`events_intraday_YYYYMMDD` table은 현재 0개로 확인됐고, initial backfill 기본 범위에는 포함하지 않는다.

복사 방식:

- source table 하나를 target table 하나로 1:1 복사한다.
- table 이름은 원본과 동일하게 유지한다. 예: `events_20260503` -> `events_20260503`
- target dataset에 같은 이름의 table이 이미 있고 row count가 다르면 즉시 중단한다.
- 기본 write disposition은 `WRITE_EMPTY`로 둔다. 기존 table overwrite는 하지 않는다.

## Final Delta Backfill 계획

Final delta backfill은 initial copy 이후 cutover 직전에 한 번 더 실행한다.
목적은 initial copy 이후 새로 생긴 daily table을 빠짐없이 보존하는 것이다.

절차:

1. source dataset에서 현재 latest daily table을 다시 조회한다.
2. target backfill dataset의 table 목록을 조회한다.
3. source에는 있고 target에는 없는 `events_YYYYMMDD` table만 delta 대상에 넣는다.
4. delta 대상이 0개면 copy 없이 verification만 실행한다.
5. delta 대상이 있으면 `WRITE_EMPTY`로 복사한다.
6. 복사 후 source/target inventory와 sample sanity를 다시 비교한다.

예상 예시:

```text
Initial backfill 기준 latest: events_20260503
Cutover 직전 source latest: events_20260507
Delta 대상: events_20260504, events_20260505, events_20260506, events_20260507
```

Final delta backfill까지 완료해야 이후 GA4 BigQuery Link 해제와 신규 Link 생성 검토로 넘어갈 수 있다.
단, Link 해제와 신규 Link 생성은 이 문서 승인 범위 밖이다.

## 권한 전제

현재 확인된 권한:

| 확인 | 결과 |
|---|---:|
| source dataset metadata 조회 | 성공 |
| source table metadata 조회 | 성공 |
| source table SELECT query | 성공 |
| target project query job 생성 | 성공 |
| target backfill dataset metadata 조회 | 없음, 아직 생성 전 |
| target backfill dataset `CREATE SCHEMA` dryRun | 성공 |
| 기존 coffee dataset에 probe table copy dryRun | 실패, `bigquery.tables.create` 없음 |

권한 해석:

- 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`이 target backfill dataset을 직접 만들면 copy 가능성이 높다.
- dataset creator는 생성한 dataset의 BigQuery Data Owner가 되므로, target dataset 안에 table을 만들 권한도 함께 확보되는 구조다.
- 반대로 target dataset을 다른 계정이 먼저 만들면, 서비스 계정에 target dataset의 BigQuery Data Editor 또는 BigQuery Data Owner를 추가로 줘야 한다.

승인 후 필요한 최소 권한:

| 위치 | 필요한 권한 |
|---|---|
| `hurdlers-naver-pay.analytics_304759974` | source table metadata와 data read 권한 |
| `project-dadba7dd-0229-4ff6-81c` | `bigquery.jobs.create`, `bigquery.datasets.create` |
| `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` | dataset 생성 후 table create/update 권한 |

공식 근거:

- BigQuery dataset 생성에는 `bigquery.datasets.create`가 필요하고, dataset creator는 생성한 dataset의 BigQuery Data Owner가 된다. 출처: https://cloud.google.com/bigquery/docs/datasets
- BigQuery table copy에는 source의 `bigquery.tables.getData`, `bigquery.tables.get`, destination의 `bigquery.tables.create`, `bigquery.tables.update`, copy job 실행 권한 `bigquery.jobs.create`가 필요하다. 출처: https://cloud.google.com/bigquery/docs/managing-tables

## 실제 실행 명령 또는 Node Script 계획

승인 후에는 Node script 방식으로 실행한다.
이유는 현재 로컬 환경에 `gcloud`와 `bq` CLI가 없고, backend는 이미 Google API credential로 BigQuery freshness를 성공시켰기 때문이다.

계획 파일:

```text
backend/scripts/biocom-bigquery-backfill.ts
```

계획 명령:

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=plan
npx tsx scripts/biocom-bigquery-backfill.ts --mode=initial-copy
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-plan
npx tsx scripts/biocom-bigquery-backfill.ts --mode=delta-copy
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify
```

Script mode별 역할:

| mode | 하는 일 | write 여부 |
|---|---|---:|
| `plan` | source inventory 조회, target dataset 존재 여부 확인, copy 대상 목록 출력 | NO |
| `initial-copy` | target dataset이 없으면 `asia-northeast3`에 생성, initial 범위 table copy | YES |
| `verify` | source/target table count, row sum, size sum, sample date, latest purchase sanity 비교 | NO |
| `delta-plan` | initial 이후 새로 생긴 source daily table과 target 누락 table 비교 | NO |
| `delta-copy` | delta 대상 table만 `WRITE_EMPTY`로 copy | YES |

복사 구현 계획:

- BigQuery API `datasets.insert`로 target dataset 생성
- BigQuery API `jobs.insert` copy job 사용
- source table: `hurdlers-naver-pay.analytics_304759974.events_YYYYMMDD`
- destination table: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_YYYYMMDD`
- job location: `asia-northeast3`
- write disposition: `WRITE_EMPTY`
- copy concurrency: 3~5개 이하
- 각 copy job 완료 후 errorResult 확인
- 실행 로그는 별도 markdown 결과 문서에 기록

## 금지선

이 승인으로도 아래 작업은 절대 하지 않는다.

| 금지 항목 | 이유 |
|---|---|
| GA4 BigQuery Link 삭제 | 이관 검증 전 source export 단절 위험 |
| 신규 GA4 BigQuery Link 생성 | 별도 cutover 승인 필요 |
| source table 삭제 | 원본 데이터 손상 위험 |
| source table 수정 | 원본 데이터 변조 위험 |
| source dataset IAM 변경 | 허들러스 관리 범위 변경 위험 |
| target 외 dataset/table write | 승인 범위 밖 write |
| existing coffee dataset table 생성·수정 | biocom backfill과 무관 |
| 운영DB write | 이번 작업 범위 아님 |
| GA4/Meta/TikTok/Google Ads 전송 | 전환값 오염 위험 |
| deploy | 이번 작업은 로컬 실행 script와 BigQuery API 작업만 대상 |

## 성공 기준

Initial backfill 성공 기준:

1. source daily `events_YYYYMMDD` table count와 target table count가 일치한다.
2. source row_count 합계와 target row_count 합계가 일치한다.
3. source size_bytes 합계와 target size_bytes 합계가 큰 차이 없이 같은 수준이다.
4. sample date 5개의 source/target row count가 모두 일치한다.
5. latest table의 source/target purchase count가 일치한다.
6. latest table의 source/target distinct `ecommerce.transaction_id` count가 일치한다.
7. target dataset location이 `asia-northeast3`로 확인된다.
8. copy job errorResult가 0건이다.

Sample date 5개 기본 후보:

| 목적 | sample table |
|---|---|
| 첫 export 날짜 | `events_20240909` |
| 연초 기준 | `events_20260101` |
| 중복 이슈 직전 | `events_20260423` |
| 중복 이슈 이후 안정 구간 | `events_20260425` |
| latest 검증 | 실행 시점 latest daily table |

현재 latest 기준 sanity 기대값:

| table | rows | purchase | distinct transaction_id |
|---|---:|---:|---:|
| `events_20260503` | 48,553 | 59 | 59 |

Final delta backfill 성공 기준:

1. delta copy 후 source/target daily table count가 다시 일치한다.
2. delta 대상 table의 source/target row_count가 모두 일치한다.
3. cutover 직전 latest daily table의 purchase와 distinct transaction_id가 일치한다.
4. initial backfill 때 복사한 기존 target table을 overwrite하지 않는다.

## 실패 시 중단 조건

아래 조건 중 하나라도 발생하면 즉시 중단한다.

| Hard Fail | 중단 이유 | 다음 대응 |
|---|---|---|
| target dataset location이 `asia-northeast3`가 아님 | source와 location 불일치 | 잘못 만든 target은 사용하지 않고 별도 cleanup 승인 필요 |
| `bigquery.datasets.create` 권한 실패 | target dataset 생성 불가 | 우리 target project IAM 확인 |
| source read 권한 실패 | 원본 복사 불가 | 허들러스 source dataset 권한 확인 |
| copy job에서 `bigquery.tables.create` 또는 `bigquery.tables.update` 실패 | target table 생성 불가 | target dataset Data Owner/Data Editor 확인 |
| target table이 이미 존재하고 source와 row count가 다름 | overwrite 시 데이터 충돌 위험 | 즉시 중단, target 상태 조사 |
| copy job errorResult 1건 이상 | 일부 table 누락 위험 | 해당 job 로그 기록 후 중단 |
| source/target table count 불일치 | 누락 발생 | 누락 table 목록 생성 후 delta-plan으로 재검토 |
| source/target row_count 합계 불일치 | copy 정합성 불확실 | mismatched table 찾기 전까지 중단 |
| sample date row count 불일치 | 검증 실패 | 해당 table 재조회, 재copy는 별도 판단 |
| latest purchase 또는 distinct transaction_id 불일치 | 구매 데이터 보존 실패 | 즉시 중단, source/target SQL 비교 |
| source table 삭제·수정이 필요한 상황 | 금지선 위반 | 실행 중단, TJ 재승인 필요 |

실패 시 자동 rollback으로 target dataset이나 target table을 삭제하지 않는다.
이미 만들어진 target dataset/table은 증거 보존 상태로 두고, cleanup이 필요하면 별도 승인 문서를 작성한다.

## Rollback과 Cleanup 원칙

이 작업의 원본 보호 원칙은 단순하다.
source dataset에는 어떤 write도 하지 않는다.

실패 후 target 쪽 cleanup이 필요한 경우:

1. 실패 로그와 target inventory를 먼저 문서화한다.
2. 삭제 대상이 target backfill dataset 내부인지 확인한다.
3. TJ님에게 별도 cleanup 승인을 받는다.
4. 승인 전에는 target dataset/table 삭제도 하지 않는다.

## 승인 문구

TJ님은 아래 문구로 승인할 수 있다.

```text
YES: biocom BigQuery backfill Yellow Lane 승인.

Codex는 project-dadba7dd-0229-4ff6-81c에
analytics_304759974_hurdlers_backfill dataset을 asia-northeast3 location으로 생성하고,
hurdlers-naver-pay.analytics_304759974의 events_YYYYMMDD daily table을
events_20240909부터 실행 시점 latest daily table까지 target dataset으로 복사해도 된다.

허용 범위:
- target dataset 생성
- target dataset 내부 events_YYYYMMDD table copy
- initial backfill 후 verification
- cutover 직전 final delta backfill plan/copy/verification

금지:
- GA4 BigQuery Link 삭제
- 신규 GA4 BigQuery Link 생성
- source table 삭제
- source table 수정
- source dataset IAM 변경
- 운영DB write
- GA4/Meta/TikTok/Google Ads 전송
- deploy

실패 시:
- source에는 어떤 write도 하지 않는다.
- target dataset/table 자동 삭제도 하지 않는다.
- 실패 로그와 mismatch 목록을 보고한 뒤 중단한다.
```

보류 문구:

```text
NO: biocom BigQuery backfill 실행 보류.
승인 문서만 보존하고 dataset 생성, table copy, GA4 Link 작업은 하지 않는다.
```

## 승인 후 다음 액션

1. Codex가 `backend/scripts/biocom-bigquery-backfill.ts`를 작성한다.
2. `--mode=plan`으로 source/target inventory와 copy 대상 목록을 다시 출력한다.
3. plan 결과가 현재 문서의 범위와 맞으면 `--mode=initial-copy`를 실행한다.
4. initial copy 후 `--mode=verify`로 table count, row_count, size_bytes, sample date, latest purchase sanity를 검증한다.
5. cutover 직전에 `--mode=delta-plan`, `--mode=delta-copy`, `--mode=verify` 순서로 새 daily table만 추가 복사한다.
6. 검증 결과를 `data/!bigquery.md`와 별도 실행 결과 문서에 남긴다.

## Auditor Verdict

```text
Auditor verdict: NEEDS_HUMAN_APPROVAL
Project: biocom BigQuery backfill
Phase: approval_document
Lane: Yellow
Mode: document_only

No-send verified: YES
No-write verified: YES for this document step
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Changed files:
- data/biocom-bigquery-backfill-approval-20260505.md

Source / window / freshness:
- source: hurdlers-naver-pay.analytics_304759974
- window: events_20240909 to current latest daily table
- freshness: latest verified events_20260503, max event time 2026-05-03 23:59:58 KST
- site: biocom
- confidence: 88%

What changed:
- Approval document created.

What did not change:
- No BigQuery dataset created.
- No BigQuery table copied.
- No GA4 BigQuery Link deleted.
- No GA4 BigQuery Link created.
- No source table modified or deleted.

Smoke / validation:
- `python3 scripts/validate_wiki_links.py data/biocom-bigquery-backfill-approval-20260505.md` PASS.
- `git diff --check -- data/biocom-bigquery-backfill-approval-20260505.md` PASS.
- `python3 scripts/harness-preflight-check.py --strict` PASS.

Next actions:
Yellow:
- TJ님 승인 후 target dataset creation and initial copy may proceed within the document limits.
Red:
- GA4 BigQuery Link delete/create remains blocked until separate cutover approval.
```
