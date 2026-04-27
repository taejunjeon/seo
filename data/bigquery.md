# BigQuery Current Decision

작성 시각: 2026-04-27 16:58 KST
기준일: 2026-04-27
문서 성격: BigQuery 현재 판단 요약
정본 실행 계획: `data/bigquery_hurdlers_cutover_20260427.md`
이전 참고 문서: `data/bigquery0409.md`, `data/bigquery_migration_plan_20260421.md`

## 10초 요약

결론은 **이전 bigquery 메모 그대로 진행하면 안 된다**.
예전 메모의 큰 방향, 즉 GA4 raw event를 BigQuery에 쌓아야 한다는 판단은 맞지만, 현재 구조는 더 복잡하다.
더클린커피 BigQuery는 이미 `project-dadba7dd-0229-4ff6-81c`에서 정상 조회되고, biocom만 `hurdlers-naver-pay` 권한에 막혀 있으므로 biocom 이관 계획을 별도로 진행해야 한다.
2026-04-27 TJ 화면에서 biocom BigQuery Link는 이미 한도에 도달한 상태로 확인됐다.
따라서 새 링크를 병행 생성하는 방식은 불가하고, 단기적으로는 허들러스 dataset read 권한을 받는 것이 먼저다.

## 지금 결론

추천안은 `data/bigquery_hurdlers_cutover_20260427.md`의 A다.

- 허들러스 `hurdlers-naver-pay.analytics_304759974`에 우리 서비스 계정 read 권한을 먼저 받는다.
- 현재 링크를 삭제하기 전까지 우리 쪽 프로젝트에 biocom을 새로 병행 연결할 수 없다.
- 과거 table 보존 방식이 정해진 뒤에만 기존 링크 삭제와 새 링크 생성을 검토한다.
- 재연결한다면 1순위 후보는 coffee가 이미 있는 `project-dadba7dd-0229-4ff6-81c`, 2순위 후보는 `seo-aeo-487113`이다.

## 왜 예전 메모만으로 부족한가

예전 메모는 `billing 연결된 BigQuery 프로젝트 1개에 3개 GA4 property를 모두 연결`하는 일반론이었다.
하지만 현재 프로젝트의 실제 상태는 아래와 다르다.

| 항목 | 예전 메모 | 2026-04-27 현재 판단 |
|---|---|---|
| 목표 구조 | 새 프로젝트 1개에 3개 property 연결 | coffee는 이미 `project-dadba7dd-0229-4ff6-81c`에서 정상. biocom만 별도 이관 |
| biocom | 바로 새 연결 | 링크 한도 도달. 허들러스 read 권한 확보가 먼저 |
| coffee | 권한 확보 후 추가 | 이미 read-only freshness 정상 |
| aibio | 같은 방식으로 추가 | 별도 확인 필요. 이번 문서는 biocom cutover 우선 |
| streaming | 필요 시 추가 | 초기에는 Daily만 추천. 운영 판단은 stable daily table 기준 |
| 해제 순서 | 언급 약함 | 새 export 검증과 과거 table 보존 뒤 허들러스 해제 |

## 현재 실측 상태

2026-04-27 16:52 KST에 `backend/scripts/check-source-freshness.ts --json`을 read-only로 실행했다.

| source | site | freshness | 결과 | confidence |
|---|---|---|---|---|
| `ga4_bigquery_thecleancoffee` | thecleancoffee | fresh | `events_20260426`, rows `1,459`, purchase `11`, distinct transaction `11` | A |
| `ga4_bigquery_biocom` | biocom | blocked | `hurdlers-naver-pay.analytics_304759974`에서 `bigquery.datasets.get denied` | D |
| TJ GA4 Admin 화면 | biocom | link exists | project `hurdlers-naver-pay`, location `서울(asia-northeast3)`, 만든 사람 `team@hurdlers.kr`, 작성일 `2024. 9. 9.`, Daily ON | A |
| TJ GA4 Admin 화면 | biocom | link limit reached | `연결` 버튼 비활성화, `링크 한도에 도달했습니다` 표시 | A |

이 결과 때문에 biocom은 `새 프로젝트에 하나 더 연결`로 풀 수 없다.
허들러스 read 권한을 먼저 받고, 완전 이관은 단절형 재연결로 별도 승인해야 한다.

## 실행 정본

실행은 아래 문서를 따른다.

- `data/bigquery_hurdlers_cutover_20260427.md`

핵심 순서:

1. TJ가 허들러스에 `dataset 존재`, `latest events table`, `dataset location`, `read 권한`, `2026-04-01 이후 table copy 가능 여부`를 요청한다.
2. 허들러스가 서비스 계정 권한을 주면 Codex가 freshness와 raw sanity query를 실행한다.
3. 과거 table 보존 또는 보존 불가 사유를 확정한다.
4. 재연결 필요성이 있으면 기존 링크 삭제와 새 링크 생성을 별도 승인한다.
5. 새 링크 생성 후 첫 daily table이 생기면 Codex가 event count, purchase, distinct transaction_id를 검증한다.
6. 검증 후 `backend/src/sourceFreshness.ts`의 biocom BigQuery source를 전환한다.

## 지금 TJ 결정이 필요한 것

추천안 A: 허들러스 `analytics_304759974` read 권한을 먼저 받는다.

제 추천: **YES**
추천 자신감: **90%**
이유: 링크 한도 때문에 병행 신규 연결이 막혔고, 현재 export는 이미 허들러스에서 Daily로 쌓이고 있다.
부족 데이터: 허들러스가 서비스 계정 권한과 과거 table copy를 허용할지.
답변 형식: `YES` 또는 `NO: 바로 재연결 검토`

## 공식 근거

- GA4 BigQuery Export 설정과 삭제는 GA4 Admin > Product Links > BigQuery Links에서 한다. 출처: https://support.google.com/analytics/answer/9823238
- daily export는 안정적인 전날 raw event table이고, streaming은 빠르지만 attribution data 제한이 있다. 출처: https://support.google.com/analytics/answer/9358801
- GA4 BigQuery dataset 이름은 `analytics_<property_id>`이고 daily table은 `events_YYYYMMDD` 형식이다. 출처: https://support.google.com/analytics/answer/7029846
