# BigQuery Hurdlers Cutover Plan

작성 시각: 2026-04-27 15:54 KST
기준일: 2026-04-27
문서 성격: 실행 계획
대상: biocom GA4 property `304759974` / measurement ID `G-WJFXN5E2Q1`
현재 소스: `hurdlers-naver-pay.analytics_304759974`
단기 목표: 허들러스 dataset read 권한 확보
장기 목표 후보: `project-dadba7dd-0229-4ff6-81c.analytics_304759974` 또는 `seo-aeo-487113.analytics_304759974`
링크 한도 확인: 2026-04-27 16:52 KST TJ GA4 화면에서 `링크 한도에 도달했습니다` 확인
관련 문서: `data/bigquery.md`, `data/bigquery0409.md`, `data/bigquery_migration_plan_20260421.md`, `data/!datacheckplan.md`

## 10초 요약

결론은 `data/bigquery.md`의 예전 메모대로 단순히 새 프로젝트 하나를 만들어 3개 GA4 property를 모두 연결하는 방식으로 진행하면 안 된다.
2026-04-27 TJ 화면 기준 biocom GA4는 BigQuery Link 한도에 도달해 새 링크를 병행 생성할 수 없다.
따라서 단기 정답은 허들러스 `hurdlers-naver-pay.analytics_304759974`에 우리 서비스 계정 read 권한을 받는 것이다.
우리 쪽 프로젝트로 완전히 옮기는 작업은 `허들러스 과거 table 보존 -> 기존 링크 해제 -> 새 링크 생성 -> 다음날 daily table 검증` 순서로만 진행해야 한다.

쉬운 비유로 말하면, 지금은 장부를 빌려 보고 있는 상태다.
새 장부를 동시에 펼칠 수 없으므로, 기존 장부를 복사하거나 읽을 권한을 받은 뒤 갈아타야 한다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 현재 상태 고정 | Codex | 100% / 70% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 허들러스 접근권 확보 | TJ + Codex | 35% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | 허들러스 데이터 보존 | TJ + Codex | 40% / 0% | [[#Phase1-Sprint3\|이동]] |
| Phase1 | [[#Phase1-Sprint4]] | 단절형 재연결 검증 | TJ + Codex | 20% / 0% | [[#Phase1-Sprint4\|이동]] |
| Phase1 | [[#Phase1-Sprint5]] | 허들러스 해제와 source 전환 | TJ + Codex | 15% / 0% | [[#Phase1-Sprint5\|이동]] |

## 문서 목적

이 문서는 허들러스 GCP 프로젝트에 묶인 biocom GA4 BigQuery export를 우리 쪽 관리 프로젝트로 옮기거나, 최소한 우리 서비스 계정이 읽을 수 있게 만드는 실행 순서를 정한다.

## 이 작업이 하는 일

이 작업은 GA4 원본 이벤트 장부를 허들러스가 관리하는 곳에서 우리가 관리하고 자동 조회할 수 있는 곳으로 옮긴다.
옮긴 뒤에는 `/ads`, source freshness, GA4 `(not set)` 진단, NPay return 누락 분석이 허들러스 권한 대기 없이 돌아가야 한다.

## 왜 필요한가

biocom GA4 raw event를 직접 읽지 못하면 아래 판단이 추측에 머문다.

- `purchase` 중복 발사가 완전히 잡혔는지
- 결제 완료 페이지에서 세션과 캠페인 정보가 끊기는지
- NPay 결제가 GA4/Meta 매출에서 얼마나 빠지는지
- v138 이후 `transaction_id`, `pay_method`, `pagePath` 품질이 유지되는지
- `/ads`가 보여주는 source freshness가 실제 운영 기준으로 믿을 수 있는지

## 현재 상태

### 확인된 것

| source | 기준 시각 | window | site | freshness | confidence | 결과 |
|---|---|---|---|---|---|---|
| `backend/scripts/check-source-freshness.ts --json` | 2026-04-27 16:52 KST | latest table | thecleancoffee | fresh | A | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260426`, rows `1,459`, purchase `11`, distinct transaction `11`, max event `2026-04-26 23:40:32 KST` |
| `backend/scripts/check-source-freshness.ts --json` | 2026-04-27 16:52 KST | dataset get | biocom | blocked | D | `hurdlers-naver-pay.analytics_304759974` 조회가 `bigquery.datasets.get denied`로 실패. 권한 문제인지 dataset 부재인지는 현재 권한으로 구분 불가 |
| TJ GA4 Admin 화면 | 2026-04-27 16:52 KST | link detail | biocom | link exists | A | project `hurdlers-naver-pay`, project number `206998047127`, dataset location `서울(asia-northeast3)`, 만든 사람 `team@hurdlers.kr`, 작성일 `2024. 9. 9.`, Daily export ON, Streaming OFF |
| TJ GA4 Admin 화면 | 2026-04-27 16:52 KST | link list | biocom | link limit reached | A | `연결` 버튼이 비활성화되고 `링크 한도에 도달했습니다`가 표시된다 |
| `backend/src/sourceFreshness.ts` | 2026-04-27 15:54 KST | code read | biocom | current config | B | `ga4_bigquery_biocom`은 아직 `hurdlers-naver-pay`를 본다 |
| `data/!datacheckplan.md` | 2026-04-25 11:12 KST | project status | biocom | documented blocker | B | biocom BigQuery legacy raw export 접근이 GA4 `(not set)` 원인 분해의 확정 병목으로 기록돼 있다 |

### 아직 안 된 것

- biocom GA4 property는 현재 링크 한도 때문에 우리 쪽 프로젝트를 추가 링크로 선택할 수 없다.
- 허들러스 `analytics_304759974`의 최근 table 범위와 dataset location을 우리 서비스 계정으로 확인하지 못했다.
- 허들러스 과거 table을 우리 쪽으로 복사할 권한과 범위를 확정하지 못했다.
- 기존 허들러스 링크를 삭제한 뒤 새 프로젝트로 재연결할지 여부를 승인하지 않았다.

### 지금 막힌 이유

허들러스 프로젝트의 biocom dataset에 우리 서비스 계정 권한이 없다.
2026-04-27 16:52 KST read-only 점검에서 `bigquery.datasets.get denied`가 재현됐다.
따라서 지금 Codex가 직접 확인 가능한 것은 `coffee는 정상`, `biocom은 권한 또는 dataset 문제로 blocked`까지다.

### 현재 주체

- TJ: GA4 Admin, GCP Console, 허들러스 커뮤니케이션처럼 계정 소유자 권한과 2FA가 필요한 작업
- Codex: read-only 점검, SQL 작성, source freshness 코드 전환, 검증 결과 문서화
- Claude Code: 필요 시 `/ads` 화면 문구와 freshness UI 반영

## 추천안

추천안 A는 **허들러스 dataset read 권한을 먼저 확보하고, 과거 table 보존이 끝난 뒤 단절형 재연결을 별도 승인하는 것**이다.

추천 이유:

- 현재 링크 한도 때문에 새 프로젝트를 병행 연결할 수 없다.
- 허들러스 dataset은 이미 2024-09-09부터 Daily export가 켜져 있으므로, 권한만 받으면 당장 raw 진단을 시작할 수 있다.
- GA4 공식 문서 기준 링크 삭제와 새 링크 생성 사이에는 daily/streaming export 공백이 생길 수 있다.
- 따라서 지금은 이관보다 권한 확보가 더 빠르고, 이관은 과거 table 보존이 닫힌 뒤 실행해야 한다.

대안:

| 대안 | 내용 | 쓸 조건 |
|---|---|---|
| A 추천 | 허들러스 `analytics_304759974` read 권한 확보 | 지금 당장 raw 진단을 시작해야 할 때 |
| B | 허들러스 과거 table copy 후 기존 링크 삭제, `project-dadba7dd-0229-4ff6-81c`로 재연결 | coffee와 같은 프로젝트로 통합하고, 짧은 export 공백을 감수할 수 있을 때 |
| C | 허들러스 과거 table copy 후 기존 링크 삭제, `seo-aeo-487113`으로 재연결 | 프로젝트명을 우리 운영 프로젝트로 명시 통일해야 할 때 |
| D | 허들러스 유지 | 허들러스가 장기 read 권한과 운영 책임을 확약할 때 |

제 추천: **YES - A를 먼저 진행**
추천 자신감: **90%**
낮은 이유: 허들러스가 서비스 계정 권한 또는 table copy를 허용할지 아직 답이 없다.
답변 형식: `YES` 또는 `NO: 바로 재연결 검토`
YES 이후 작업: TJ가 허들러스 권한 요청을 보내고, Codex가 권한 반영 즉시 freshness와 raw sanity query를 실행한다.

## 산출물

- 단기 산출물: 허들러스 `analytics_304759974` read-only 접근
- 장기 산출물: 우리 쪽 biocom GA4 raw dataset `analytics_304759974`
- 허들러스 과거 table 보존본: `analytics_304759974_hurdlers_backfill` 또는 동일 목적의 read-only archive
- source freshness 기본 경로 전환: `backend/src/sourceFreshness.ts`
- GA4 `(not set)` 원인 분해 쿼리 실행 결과
- 허들러스 해제 확인 메모

## Phase 상세

#### Phase1-Sprint1

**이름**: 현재 상태 고정

▲ [[#Phase-Sprint 요약표|요약표로]]

### 역할 구분

- TJ: 해당 없음
- Codex: 현재 문서, 코드, read-only freshness 결과를 고정한다.
- Claude Code: 해당 없음

### 실행 단계

1. [Codex] 현재 권한으로 BigQuery freshness를 점검한다 - 무엇: `backend/scripts/check-source-freshness.ts --json` 실행. 왜: TJ에게 넘기기 전 자동 확인 가능한 범위를 닫기 위해서다. 어떻게: `backend`에서 read-only 실행. 산출물: source별 freshness 결과. 검증: coffee는 fresh, biocom은 permission denied로 구분된다.
2. [Codex] 기존 문서와 코드 위치를 기록한다 - 무엇: `data/!datacheckplan.md`, `data/bigquery_migration_plan_20260421.md`, `backend/src/sourceFreshness.ts`를 대조한다. 왜: 오래된 계획과 현재 코드가 다른 부분을 막기 위해서다. 산출물: 이 문서의 현재 상태 표. 검증: source, 기준 시각, window, site, freshness, confidence가 표에 있어야 한다.

### 완료 기준

- coffee BigQuery 정상 여부가 숫자로 기록된다.
- biocom BigQuery blocked 사유가 에러 메시지로 기록된다.
- 기존 `data/bigquery.md`를 그대로 실행하면 안 되는 이유가 문서화된다.

#### Phase1-Sprint2

**이름**: 허들러스 접근권 확보

▲ [[#Phase-Sprint 요약표|요약표로]]

### 역할 구분

- TJ: 허들러스에 dataset read 권한과 table 상태 확인을 요청한다.
- Codex: 권한 반영 즉시 freshness와 raw sanity query를 실행한다.
- Claude Code: 해당 없음

### 실행 단계

1. [완료/TJ] GA4 Admin에서 biocom property `304759974`의 BigQuery Links 화면을 확인한다 - 무엇: 현재 linked project와 새 링크 가능 여부를 본다. 왜: 새 export를 병행 생성할 수 있는지가 전체 일정의 첫 분기다. 어떻게: GA4 Admin > Product Links > BigQuery Links. 산출물: `hurdlers-naver-pay` 1개 링크와 `링크 한도에 도달했습니다` 화면. 검증: project ID, project number, dataset location, 만든 사람, 작성일, export type이 캡처로 남았다.
2. [TJ] 허들러스에 서비스 계정 read 권한을 요청한다 - 무엇: `hurdlers-naver-pay.analytics_304759974`에 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`을 BigQuery Data Viewer로 추가하고, query 실행 project 권한을 확인한다. 왜: 링크를 지우지 않고 biocom raw 진단을 시작하는 가장 빠른 방법이다. 어떻게: 아래 허들러스 요청문 사용. 산출물: 권한 부여 회신. 검증: Codex freshness에서 biocom이 `error`가 아니라 `fresh/warn`으로 바뀐다. 의존성: 선행필수 - 외부 계정 권한 필요.
3. [Codex] 권한 반영 후 freshness를 재실행한다 - 무엇: `npx tsx scripts/check-source-freshness.ts --json`으로 biocom BigQuery를 조회한다. 왜: 화면 권한이 아니라 실제 서비스 계정 권한을 검증해야 하기 때문이다. 어떻게: backend에서 read-only 실행. 산출물: row count, purchase count, distinct transaction_id, max event time. 검증: latest table이 `events_YYYYMMDD`로 나오고 rows > 0이어야 한다. 의존성: 선행필수 - 2번 완료 후.
4. [Codex] 권한 반영 후 raw sanity query를 실행한다 - 무엇: v138 이후 `purchase`, `transaction_id`, `pay_method`, `pagePath` 품질을 조회한다. 왜: BigQuery 접근 확보의 목적이 GA4 원인 분해이기 때문이다. 어떻게: Q2 쿼리를 `hurdlers-naver-pay` 기준으로 실행. 산출물: 날짜별 purchase 품질 표. 검증: `transaction_id` 결측과 duplicate extra가 Data API 결과와 같은 방향이어야 한다. 의존성: 선행필수 - 3번 완료 후.

### 완료 기준

- 허들러스 `analytics_304759974.events_*`를 우리 서비스 계정으로 조회할 수 있다.
- biocom BigQuery source freshness가 `error`에서 `fresh` 또는 `warn`으로 바뀐다.
- v138 이후 raw purchase 품질표가 생성된다.

#### Phase1-Sprint3

**이름**: 허들러스 데이터 보존

▲ [[#Phase-Sprint 요약표|요약표로]]

### 역할 구분

- TJ: 허들러스에 dataset 확인, 임시 권한, 과거 table copy 허용, 해제 보류를 요청한다.
- Codex: 허들러스가 준 권한으로 table inventory와 copy 검증을 한다.
- Claude Code: 해당 없음

### 실행 단계

1. [TJ] 허들러스에 해제 보류와 데이터 보존 요청을 보낸다 - 무엇: `hurdlers-naver-pay.analytics_304759974`를 즉시 삭제하지 말고, 우리 쪽 검증 완료까지 유지하도록 요청한다. 왜: GA4 BigQuery Link는 과거 raw data를 새 link로 자동 이전하지 않기 때문이다. 어떻게: 아래 `허들러스 요청문` 사용. 산출물: 허들러스 회신. 검증: dataset 존재, latest table, 유지 가능일, copy 가능 여부가 yes/no로 돌아온다. 의존성: 선행필수 - 외부 커뮤니케이션 필요.
2. [Codex] 권한이 들어오면 table inventory를 확인한다 - 무엇: `events_YYYYMMDD` 최소/최대 suffix, row count, dataset location을 조회한다. 왜: 어떤 기간을 보존해야 하는지 정해야 한다. 어떻게: BigQuery `tables.list`와 `INFORMATION_SCHEMA` read-only. 산출물: 허들러스 table inventory. 검증: 최소 2026-04-01 이후 table 범위가 기록된다. 의존성: 부분병렬.
3. [Codex] 과거 table copy 방식을 결정한다 - 무엇: BQ copy, BigQuery Data Transfer, GCS export 중 하나를 고른다. 왜: 허들러스 권한이 사라져도 2026-04 raw 진단을 유지하기 위해서다. 어떻게: 허들러스 권한 범위와 dataset region을 기준으로 결정. 산출물: `analytics_304759974_hurdlers_backfill` 또는 보존 불가 사유. 검증: sample date 1일의 row count가 원본과 일치한다. 의존성: 부분병렬.

### 허들러스 요청문

```text
안녕하세요. biocom GA4 BigQuery export 이관 관련 요청드립니다.

현재 biocom GA4 property 304759974의 raw export가 `hurdlers-naver-pay.analytics_304759974`에 연결된 것을 GA4 Admin 화면에서 확인했습니다.
또한 GA4 화면에서 `링크 한도에 도달했습니다`가 표시되어 새 프로젝트를 병행 연결할 수 없는 상태입니다.
따라서 먼저 현재 dataset 조회 권한을 받아 raw 진단을 시작하고, 이후 필요하면 과거 table 보존 후 재연결을 별도 진행하려고 합니다.

삭제나 해제 전에 아래 항목 확인 부탁드립니다.

1. `hurdlers-naver-pay.analytics_304759974` dataset 존재 여부: yes / no
2. 최근 `events_YYYYMMDD` table 적재 여부와 latest table명
3. dataset location
4. 2026-04-01부터 해제 전일까지 table copy 또는 export 가능 여부
5. 2026-05-12 KST까지 기존 export 유지 가능 여부
6. 임시 조회 권한 부여 가능 여부
   - 계정: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`
   - 필요 권한: BigQuery Data Viewer, BigQuery Job User
7. 향후 저희 쪽 프로젝트로 옮길 경우 2026-04-01 이후 table copy 또는 export 가능 여부

저희 요청은 즉시 삭제가 아니라, 현재 dataset read 권한 확보와 과거 table 보존 가능 여부 확인입니다.
재연결이 필요하면 기존 link 해제 전에 다시 확정드리겠습니다.
```

### 완료 기준

- 허들러스 dataset 존재와 latest table 상태가 yes/no로 기록된다.
- 허들러스 export 해제 전 유지 기한이 문서화된다.
- 과거 raw data 보존 방식이 `copy 완료`, `read-only 유지`, `보존 불가` 중 하나로 결정된다.

#### Phase1-Sprint4

**이름**: 단절형 재연결 검증

▲ [[#Phase-Sprint 요약표|요약표로]]

### 역할 구분

- TJ: 기존 링크 삭제와 새 링크 생성의 Go/No-Go를 승인한다.
- Codex: 삭제 전 inventory, 삭제 후 새 dataset sanity, GA4 Data API 대조를 수행한다.
- Claude Code: `/ads` 또는 CRM source freshness UI 문구가 필요하면 반영한다.

### 실행 단계

1. [Codex] 삭제 전 허들러스 table inventory를 고정한다 - 무엇: `events_YYYYMMDD` 최소/최대 suffix, row count, latest event time을 기록한다. 왜: 재연결 뒤 과거 raw 공백을 설명하려면 삭제 전 기준이 필요하다. 어떻게: BigQuery read-only. 산출물: table inventory. 검증: 최소 2026-04-01 이후 table 범위가 있어야 한다.
2. [Codex] GA4 Data API fallback 대조표를 만든다 - 무엇: 최근 7일 purchase, distinct transaction_id, revenue를 Data API로 고정한다. 왜: 기존 링크 삭제 뒤 old/new BigQuery 병행 비교가 불가능하기 때문이다. 어떻게: GA4 Data API runReport. 산출물: fallback 기준표. 검증: 기준 시각, timezone, dimensions, metrics가 남아야 한다.
3. [TJ] 재연결 Go/No-Go를 승인한다 - 무엇: 기존 `hurdlers-naver-pay` 링크를 삭제하고 새 프로젝트로 연결할지 결정한다. 왜: 이 단계는 raw export 공백과 과거 table 손실 위험이 있는 운영 변경이다. 어떻게: 승인 포인트 표 기준으로 답한다. 산출물: `YES: project-dadba7dd` 또는 `NO: 허들러스 유지`. 검증: 과거 table 보존 상태가 먼저 기록돼 있어야 한다. 의존성: 선행필수.
4. [TJ] Go 승인 시 기존 링크 삭제 후 새 링크를 만든다 - 무엇: BigQuery Link를 `project-dadba7dd-0229-4ff6-81c` 또는 `seo-aeo-487113`으로 재생성한다. 왜: 링크 한도 때문에 기존 링크 삭제 없이는 새 링크를 만들 수 없다. 어떻게: GA4 Admin > BigQuery Links > 기존 링크 Delete > Link. 산출물: 새 project ID와 export 설정. 검증: Daily ON, Streaming OFF, location `asia-northeast3`, event 제외 없음. 의존성: 선행필수.
5. [Codex] 새 daily table이 생기면 sanity query를 실행한다 - 무엇: event count, purchase count, distinct transaction_id, max event time을 본다. 왜: 새 링크가 실제로 데이터를 쓰는지 확인하기 위해서다. 어떻게: Q1, Q2를 새 project 기준으로 실행. 산출물: 첫 export 검증 결과. 검증: latest daily table rows > 0. 의존성: 선행필수 - 4번 후 24시간 대기.
6. [Codex] `backend/src/sourceFreshness.ts`의 biocom BigQuery source를 새 프로젝트로 바꾼다 - 무엇: `ga4_bigquery_biocom`의 `projectId`를 목표 프로젝트로 바꾼다. 왜: `/ads`와 점검 스크립트가 허들러스 권한에 의존하지 않게 하기 위해서다. 어떻게: 코드 수정 전 백업, 수정, `npx tsx scripts/check-source-freshness.ts --json`, `npm run typecheck`. 산출물: 코드 변경과 검증 로그. 검증: biocom BigQuery status가 `fresh` 또는 `warn`. 의존성: 선행필수 - 5번 완료 후.

### 완료 기준

- 새 dataset의 첫 daily table이 정상 생성된다.
- 3일 이상 purchase와 distinct transaction_id가 GA4 Data API 기준과 같은 방향이다.
- source freshness가 새 프로젝트 기준으로 돈다.
- `data/!datacheckplan.md`의 biocom BigQuery blocker가 `blocked`에서 `migrating` 또는 `closed`로 바뀔 수 있다.

#### Phase1-Sprint5

**이름**: 허들러스 해제와 source 전환

▲ [[#Phase-Sprint 요약표|요약표로]]

### 역할 구분

- TJ: 허들러스에 해제 요청을 보내고 GA4 Admin에서 링크 상태를 확인한다.
- Codex: 해제 후 우리 쪽 freshness와 과거 보존본 접근을 재검증한다.
- Claude Code: 운영 화면 문구가 바뀌면 반영한다.

### 실행 단계

1. [TJ] 허들러스에 해제 가능 통보를 보낸다 - 무엇: `hurdlers-naver-pay`의 biocom BigQuery Link 해제를 요청한다. 왜: 우리 쪽 export가 정상화되면 외부 프로젝트 권한 의존을 끝내기 위해서다. 어떻게: 검증 완료일, 보존본 위치, 해제 예정일을 함께 전달. 산출물: 허들러스 해제 일정 회신. 검증: 허들러스가 해제일과 담당자를 답한다. 의존성: 선행필수.
2. [TJ] GA4 Admin에서 BigQuery Links 목록을 확인한다 - 무엇: 허들러스 링크가 사라지고 우리 쪽 링크만 남았는지 본다. 왜: 외부 export가 실제로 해제됐는지 UI 기준으로 닫기 위해서다. 어떻게: GA4 Admin > Product Links > BigQuery Links. 산출물: 연결 목록 메모 또는 캡처. 검증: project ID가 우리 쪽만 남는다. 의존성: 선행필수 - 2FA 필요.
3. [Codex] 해제 다음 날 source freshness를 재실행한다 - 무엇: 우리 쪽 `analytics_304759974.events_*`가 계속 쌓이는지 확인한다. 왜: 해제 과정에서 GA4 export 자체가 끊기지 않았는지 보기 위해서다. 어떻게: read-only freshness와 BigQuery sanity query. 산출물: post-cutover 점검 결과. 검증: latest table이 해제 다음 날에도 생성된다. 의존성: 부분병렬.

### 완료 기준

- 허들러스 BigQuery Link가 GA4 Admin에서 제거된다.
- 우리 쪽 `analytics_304759974`는 계속 fresh다.
- 과거 table 보존본 또는 허들러스 해제 전 table inventory가 남아 있다.
- `/ads`와 데이터 정합성 문서의 BigQuery blocker가 닫힌다.

## 일정

| 날짜 | 목표 | 조건 |
|---|---|---|
| 2026-04-27 | 링크 한도와 허들러스 연결 상세 확인 | 완료: `링크 한도에 도달했습니다`, location `asia-northeast3`, Daily ON |
| 2026-04-27 ~ 2026-04-28 | 허들러스 read 권한 요청 | 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| 권한 반영 당일 | freshness와 raw sanity query 실행 | biocom BigQuery status가 `fresh/warn`으로 바뀌어야 함 |
| 2026-04-28 ~ 2026-05-03 | 허들러스 table inventory와 과거 보존 가능성 확인 | 2026-04-01 이후 table copy/export 가능 여부 |
| 2026-05-05 이후 | 재연결 여부 결정 | v138 이후 baseline과 table 보존 상태 확인 후 |
| 재연결 승인 후 24시간 | 새 project daily table 검증 | 기존 링크 삭제와 새 링크 생성 사이 공백 기록 필수 |

## 검증 쿼리

### Q1. 우리 쪽 최신 table sanity

```sql
SELECT
  COUNT(*) AS events,
  COUNTIF(event_name = 'purchase') AS purchase_events,
  COUNT(DISTINCT IF(event_name = 'purchase', ecommerce.transaction_id, NULL)) AS distinct_purchase_transaction_ids,
  FORMAT_TIMESTAMP('%F %T %Z', MAX(TIMESTAMP_MICROS(event_timestamp)), 'Asia/Seoul') AS max_event_time_kst
FROM `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY));
```

현재 허들러스 링크를 유지한 상태에서 같은 쿼리를 돌릴 때는 project만 아래처럼 바꾼다.

```sql
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
```

### Q2. v138 이후 purchase 품질

```sql
SELECT
  event_date,
  COUNT(*) AS purchase_events,
  COUNT(DISTINCT ecommerce.transaction_id) AS distinct_transaction_ids,
  COUNTIF(ecommerce.transaction_id IS NULL OR ecommerce.transaction_id = '') AS missing_transaction_id,
  COUNTIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') = 'homepage') AS homepage_purchase,
  COUNTIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') = 'npay') AS npay_purchase
FROM `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260425' AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY))
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

현재 허들러스 링크를 유지한 상태에서 같은 쿼리를 돌릴 때도 project만 아래처럼 바꾼다.

```sql
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
```

### Q3. 삭제 전 table inventory

```sql
SELECT
  table_name,
  row_count,
  size_bytes,
  creation_time
FROM `hurdlers-naver-pay.analytics_304759974.__TABLES__`
WHERE STARTS_WITH(table_name, 'events_')
ORDER BY table_name;
```

## 승인 포인트

| 안건 | 추천 | 답변 형식 | 이유 | Codex 추천 | 자신감 |
|---|---|---|---|---|---:|
| 단기 접근 | 허들러스 read 권한 확보 | `YES` / `NO: 바로 재연결` | 링크 한도 때문에 병행 이관이 불가하고, 권한 확보가 가장 빠르다 | YES | 90% |
| 장기 목표 프로젝트 | 재연결 시 `project-dadba7dd-0229-4ff6-81c` | `YES` / `NO: seo-aeo-487113` | coffee가 이미 정상이고 같은 프로젝트 조인이 쉽다 | YES | 78% |
| export 방식 | Daily만 먼저 켜기 | `YES` / `NO: Streaming도 켜기` | GA4 유입/세션 분석은 daily가 더 안정적이다. streaming은 attribution data가 불완전할 수 있다 | YES | 86% |
| 허들러스 해제 시점 | 과거 table 보존 후 재연결 당일 | `YES` / `NO: 즉시 해제` | 링크 삭제와 새 링크 생성 사이 공백이 생길 수 있다 | YES | 92% |
| 과거 데이터 | 2026-04-01부터 해제 전일까지 보존 요청 | `YES` / `NO: 보존 생략` | v138, NPay, `(not set)` 진단에 4월 raw가 필요하다 | YES | 78% |

## 리스크와 방어 규칙

| 리스크 | 영향 | 방어 규칙 |
|---|---|---|
| 새 링크가 기존 허들러스 링크 때문에 추가 불가 | 병행 검증 불가 | 단기 read 권한을 먼저 확보하고, 해제 전 table inventory와 copy 허용을 확보한다 |
| dataset location 불일치 | cross-query와 copy가 어려움 | 재연결 시 coffee와 같은 `asia-northeast3`를 우선 검토한다. 기존 dataset location은 생성 후 바꾸지 못하는 전제로 본다 |
| streaming export를 너무 빨리 신뢰 | source/campaign 오판 | 운영 판단은 daily `events_YYYYMMDD` 기준으로 한다 |
| 허들러스 과거 table copy 불가 | 2026-04 raw 진단 일부 손실 | 최소한 2026-04 table inventory와 TJ 계정 read-only 유지 기간을 문서화한다 |
| BigQuery 비용 증가 | 예산 초과 | 월 예산 알림을 걸고, 쿼리는 `_TABLE_SUFFIX`로 날짜 범위를 제한한다 |

## 공식 근거

- Google Analytics BigQuery Export 설정은 GA4 Admin의 Product Links에서 한다. property Editor 이상과 BigQuery 프로젝트 권한이 필요하다. 출처: https://support.google.com/analytics/answer/9823238
- Google 공식 문서 기준 BigQuery Link를 삭제하고 새로 만들 수 있으며, 링크 삭제와 새 링크 생성 사이에는 daily/streaming export 공백이 생길 수 있다. 출처: https://support.google.com/analytics/answer/9823238
- GA4 BigQuery daily export는 전날 raw event를 하루 1회 내보내며, streaming은 당일 데이터를 빠르게 주지만 attribution data에 제한이 있다. 출처: https://support.google.com/analytics/answer/9358801
- GA4 BigQuery dataset은 `analytics_<property_id>` 형식이고, daily export는 `events_YYYYMMDD` table을 만든다. 출처: https://support.google.com/analytics/answer/7029846
- BigQuery dataset location은 생성 시점 결정이 중요하고, 다른 location과 섞이면 copy/query 운영이 복잡해진다. 출처: https://docs.cloud.google.com/bigquery/docs/locations

## 다음 액션

지금 당장:

1. [TJ] 허들러스 요청문을 보낸다.
2. [TJ] 단기 접근 추천안에 `YES` 또는 `NO: 바로 재연결`로 답한다.
3. [Codex] 권한 반영 즉시 freshness와 raw sanity query를 실행한다.

이번 주:

1. [Codex] 허들러스 table inventory와 Q2 raw purchase 품질을 실행한다.
2. [TJ+Codex] 과거 table copy/export 가능 여부를 확정한다.
3. [TJ] 재연결이 필요한지 승인한다.

운영 승인 후:

1. [TJ] 기존 허들러스 링크 삭제 후 새 프로젝트 링크를 만든다.
2. [Codex] 새 daily table 생성 후 `backend/src/sourceFreshness.ts` 기본 project를 우리 쪽으로 전환한다.
3. [Codex] 해제 다음 날 우리 쪽 latest table 생성 여부를 재확인한다.
