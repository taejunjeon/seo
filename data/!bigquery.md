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

### 2026-05-05 서비스 계정 권한 재확인

TJ님이 전달한 허들러스 메일 기준으로 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`에 `hurdlers-naver-pay.analytics_304759974` BigQuery Data Viewer 권한이 부여된 것으로 보인다.
Codex가 2026-05-05 00:46 KST에 read-only로 재확인한 결과, 이전의 `bigquery.datasets.get denied` 상태는 해소됐다.

확인 결과:

- `datasets.get hurdlers-naver-pay.analytics_304759974`: 성공.
- `tables.list hurdlers-naver-pay.analytics_304759974`: 성공. `events_20240909`, `events_20240910`, `events_20240911` 확인.
- `jobs.query` in `hurdlers-naver-pay`: 실패. `bigquery.jobs.create` 권한 없음.
- `jobs.query` in `project-dadba7dd-0229-4ff6-81c`: 성공.
- `jobs.query` in `seo-aeo-487113`: 실패. `bigquery.jobs.create` 권한 없음.
- `check-source-freshness.ts --json`: biocom BigQuery source가 `jobs.create` 없음으로 error. 현재 코드가 job project를 `hurdlers-naver-pay`로 사용하기 때문이다.

해석:

- Dataset read 권한은 들어왔다.
- 허들러스 프로젝트에 job을 직접 만드는 권한은 아직 없다.
- 다만 우리 통합 후보 프로젝트 `project-dadba7dd-0229-4ff6-81c`에는 job 생성 권한이 있어, 그 프로젝트를 job project로 지정하면 허들러스 dataset SQL 조회가 가능하다.
- 즉시 추가 조사에는 허들러스 추가 권한이 필수는 아니다.
- 기존 freshness 스크립트를 그대로 통과시키려면 허들러스에 `roles/bigquery.jobUser`를 추가 요청하거나, 코드에서 biocom source project와 job project를 분리해야 한다.

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

참고사항 : 안녕하세요, 이준우 이사님.  
허들러스 남선우입니다.  
  
요청 주신 사항에 대해 아래와 같이 확인 및 회신드립니다.  
  

- **biocom 데이터셋 존재 여부**: Yes
- **최근 이벤트 정상 적재 여부**: Yes
- **요청 계정 권한 제공 가능 여부**: Yes

  
  
현재 데이터셋은 정상적으로 존재하며, 최근 이벤트 데이터 또한 문제없이 적재되고 있는 것을 확인했습니다.  
  
또한 요청 주신 계정([biocomkr.sns@gmail.com](mailto:biocomkr.sns@gmail.com))에 대해  
BigQuery Data Viewer, BigQuery Job User 권한을 부여해드렸으니 확인부탁드립니다.  
  
아울러, 이관 관련 기술 지원 여부에 대해서는 내부 검토 후 별도로 상세히 안내드릴 수 있도록 하겠습니다.  
금일 업무로 인해 회신이 다소 늦어진 점 양해 부탁드립니다.  
  
추가로 필요하신 사항이나 문의 있으시면 언제든 편하게 말씀 부탁드립니다.
![[iOS 이미지.jpg]]

허들러스 측으로부터 아래와 같이 메일을 추가로 전달받았습니다.  
  

안녕하세요, 이준우 이사님.
허들러스 남선우입니다.

문의 주신 이관 관련하여 진행 방향 안내드립니다.

GA4 BigQuery 링크를 다른 프로젝트로 변경하더라도 기존 hurdlers-naver-pay 프로젝트에 적재된 데이터가 함께 이전되지는 않습니다.
또한, 기존 데이터를 복사한 동일 데이터셋에 그대로 GA4를 재연결하는 방식은 데이터 중복이나 충돌 가능성이 있어 권장드리지 않습니다.

따라서 기존 데이터는 통합 프로젝트 내 별도의 데이터셋으로 복사해 이관하고,
이후 GA4 BigQuery Export를 통합 프로젝트로 재연결하여 변경 시점 이후 데이터는 신규 데이터셋에 적재하는 방식으로 진행드리고자 합니다.

이관 작업 진행을 위해 아래 정보 공유 부탁드립니다.

- 통합 예정 GCP 프로젝트 ID
- 작업 수행을 위한 권한 부여
- 데이터 이관 범위 (전체 / 최근 N개월 등)

전달 주신 내용 기반으로 상세 작업 절차도 함께 안내드리겠습니다.
추가로 궁금하신 사항 있으시면 편하게 말씀 부탁드립니다.

감사합니다.
남선우 드림

  
  
**결론부터 말씀드리면**, 허들러스 쪽은 **"우리 통합 프로젝트로 이관하는 방향으로 지원해주겠다"**는 답을 주셨습니다.  
방식은 아래와 같습니다.  
-  

- 과거 데이터는 우리 통합 프로젝트 안의 **별도 dataset**으로 복사 (이관)
- GA4 → BigQuery 링크는 우리 통합 프로젝트로 재연결
- 재연결 시점부터의 신규 데이터는 새 dataset에 적재

-  
결과적으로 **"과거 dataset + 신규 dataset" 두 개를 병행해서 쓰는 구조**가 됩니다.  
이 방식은 과거 데이터를 잃지 않으면서 중복·충돌도 피할 수 있는 일반적인 권장안이라 이대로 진행하면 좋을듯 합니다.  
-  
  
**[의사결정 필요한 3가지]**  
  

1. **통합 GCP 프로젝트 ID를 어느 것으로 할지?**
    1. 기존 AIBIO/더클린커피가 붙어 있는 `project-dadba7dd-0229-4ff6-81c`를 그대로 쓸지, 아니면 이 기회에 브랜드별·용도별로 프로젝트 네이밍을 정리할지? 지금 정하지 않으면 나중에 다시 옮기기 번거로워집니다.
2. **허들러스 측 작업자에게 줄 권한**
    1. 이관 작업 수행을 위한 권한이라 일시적이지만, 그래도 프로젝트 레벨 권한(BigQuery Admin 또는 Data Editor + Job User)이 필요합니다.
    2. 작업 완료 후 회수하는 조건으로 부여
3. **과거 데이터 이관 범위**
    1. 전체를 가져올지, 최근 N개월만 가져올지?
    2. 전체를 가져오는 게 기본이지만, biocom의 경우 GA4 export 시작 시점부터 누적된 용량에 따라 **저장 비용이 발생**하므로 실제 사용할 범위가 어디까지인지 먼저 판단 필요.
    3. 광고/구매 데이터 정합성 점검이 주 목적이라면 **최근 6~12개월 정도**가 현실적이고, 과거 전체를 보존 목적으로 가져가려면 비용이 크지 않은 선에서 전부 가져오는 것도 가능.

-  
**참고로 권한 부여 받은 계정으로 raw 데이터 조회는 이미 가능한 상태**라, 이관을 기다리는 동안에도 원래 목적이었던 광고·GA4·구매 숫자 불일치 점검은 `hurdlers-naver-pay` 쪽에서 바로 시작할 수 있습니다. 이관은 이 점검과 병행해서 가면 됩니다.  
  
**세 가지 결정 사항 알려주시면 허들러스 쪽에 바로 회신드리겠습니다.**

---

## 2026-04-30 접근권 감사 결과

작성 시각: 2026-04-30 15:35 KST
조사 범위: read-only. GA4 BigQuery Link 삭제, 신규 Link 생성, dataset 생성, table copy, table 삭제 모두 미실행.
대상: `hurdlers-naver-pay.analytics_304759974`

2026-05-05 최신 재검증에서 이 섹션의 접근 실패 상태는 해소됐다.
이 섹션은 당시 감사 기록으로 남기고, 현재 판단은 문서 하단 `2026-05-05 backend/Codex 권한 재검증 결과`를 따른다.

### 10초 요약

현재 Codex/backend 자동 조회는 아직 biocom BigQuery raw dataset에 접근하지 못한다.
허들러스가 권한을 준 계정은 `biocomkr.sns@gmail.com` 사용자 계정이고, 현재 로컬 backend가 쓰는 credential은 `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 서비스 계정이다.
따라서 허들러스에 이관 범위를 답하기 전에, 먼저 서비스 계정에 dataset read 권한을 추가 요청해야 한다.

### 현재 접근 상태

| 항목 | 결과 | source | 기준 시각 | window | site | freshness | confidence |
|---|---|---|---|---|---|---|---|
| biocom BigQuery dataset | 접근 실패 | BigQuery API `datasets.get`, `tables.list` | 2026-04-30 15:32 KST | dataset | biocom | blocked | A |
| biocom BigQuery query | 접근 실패 | BigQuery API `jobs.query` | 2026-04-30 15:32 KST | yesterday table wildcard | biocom | blocked | A |
| coffee BigQuery | 정상 | `check-source-freshness.ts --json` | 2026-04-30 15:32 KST | latest table | thecleancoffee | fresh | A |
| biocom GA4 Data API | 정상 | GA4 Data API `properties/304759974` | 2026-04-30 15:35 KST | 2026-04-23~2026-04-29 | biocom | available | B |

### 실제 조회 credential

현재 backend/Codex가 쓰는 credential은 아래와 같다.

| 항목 | 값 |
|---|---|
| env key | `GA4_BIOCOM_SERVICE_ACCOUNT_KEY` |
| client email | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| service account project | `seo-aeo-487113` |
| `GA4_SERVICE_ACCOUNT_KEY` | 없음 |
| `GOOGLE_APPLICATION_CREDENTIALS` | 없음 |
| local ADC | 없음 (`~/.config/gcloud/application_default_credentials.json` 없음) |
| `gcloud` CLI | 없음 |
| `bq` CLI | 없음 |

판정:

- `biocomkr.sns@gmail.com` 사용자 계정은 브라우저 BigQuery Console에서 조회 가능할 수 있다.
- 하지만 현재 자동 조사와 backend freshness는 사용자 계정이 아니라 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`으로 돈다.
- 따라서 `biocomkr.sns@gmail.com` 권한만으로는 Codex/backend 자동 조회가 되지 않는다.

### Freshness 결과

실행 명령:

```bash
cd backend
npx tsx scripts/check-source-freshness.ts --json
```

결과:

| source | status | latest table | rows | purchase | distinct transaction_id | max event time KST | note |
|---|---|---|---:|---:|---:|---|---|
| `ga4_bigquery_thecleancoffee` | fresh | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260429` | 2,228 | 21 | 21 | 2026-04-29 23:57:37 KST | 정상 |
| `ga4_bigquery_biocom` | error | 확인 불가 | - | - | - | - | `Permission bigquery.datasets.get denied` |

biocom은 기존 `blocked`에서 `fresh/warn`으로 바뀌지 않았다.
허들러스가 부여한 권한이 backend 서비스 계정에는 아직 적용되지 않은 상태로 본다.

### Table Inventory

서비스 계정 기준 직접 확인 결과:

| 체크 | 결과 |
|---|---|
| `datasets.get hurdlers-naver-pay.analytics_304759974` | 403, `bigquery.datasets.get denied` |
| `tables.list hurdlers-naver-pay.analytics_304759974` | 403, `bigquery.tables.list denied` |
| `jobs.query SELECT 1` in `hurdlers-naver-pay` | 403, `bigquery.jobs.create` 없음 |
| `jobs.query SELECT 1` in `seo-aeo-487113` | 403, `bigquery.jobs.create` 없음 |
| `jobs.query SELECT 1` in `project-dadba7dd-0229-4ff6-81c` | 성공 |
| `hurdlers` table query with job project `project-dadba7dd-0229-4ff6-81c` | 403, remote table query 권한 없음 |

따라서 아래 숫자는 아직 산출 불가다.

- 첫 `events_YYYYMMDD` table
- 최신 `events_YYYYMMDD` table
- table 개수
- 총 row count
- 총 size_bytes
- 날짜별 row_count, size_bytes
- intraday table 존재 여부
- dataset location

단, GA4 Admin 화면과 허들러스 메일 기준 dataset은 존재하고 최근 이벤트도 적재 중이다.
자동화 계정으로는 아직 검증되지 않았으므로 confidence는 `D=blocked`로 둔다.

### Raw Sanity 결과

BigQuery raw query는 실행 불가다.
이유는 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`이 `hurdlers-naver-pay.analytics_304759974`의 table read 권한을 아직 갖고 있지 않기 때문이다.

미실행 항목:

- 최근 7일 전체 event count
- 최근 7일 purchase event count
- 최근 7일 distinct `ecommerce.transaction_id`
- missing transaction_id count/rate
- `pay_method=homepage/npay/vbank` count
- source / medium / campaign 결측률
- `collected_traffic_source` 필드 사용 가능 여부
- `page_location` 또는 `page_path` 기준 결제완료 페이지 이벤트 수
- 2026-04-01 이후 같은 항목

대신 GA4 Data API fallback으로 아래만 확인했다.

| source | 기준 시각 | window | site | metric | value | confidence |
|---|---|---|---|---|---:|---|
| GA4 Data API `properties/304759974` | 2026-04-30 15:35 KST | 2026-04-23~2026-04-29 | biocom | purchase eventCount | 862 | B |
| GA4 Data API `properties/304759974` | 2026-04-30 15:35 KST | 2026-04-23~2026-04-29 | biocom | totalRevenue | 193,226,714.02435803 | B |

주의: 이 fallback은 BigQuery raw 검증이 아니다.
`collected_traffic_source`, event-level duplicate sender, raw `event_params` 품질을 대신 검증할 수 없다.

### 이관 범위 추천

현재는 table inventory가 막혀 있어 `전체 / 2026-01-01 이후 / 2026-04-01 이후`를 실제 row count와 size_bytes로 비교할 수 없다.
따라서 이관 범위 최종 추천은 보류한다.

다만 의사결정 기준은 아래처럼 둔다.

| 옵션 | table 수 | 총 size | 장점 | 단점 | 현재 추천 |
|---|---:|---:|---|---|---|
| 전체 이관 | 확인 불가 | 확인 불가 | 2024-09-09 이후 raw 보존 가능. 과거 추적 이슈 재분석 가능 | 허들러스 copy 작업 범위가 가장 큼. 실제 사용 빈도가 낮은 과거 데이터까지 이동 | inventory 확인 후 size가 작으면 추천 |
| 2026-01-01 이후 | 확인 불가 | 확인 불가 | 2026년 Q1/Q2 광고·매출 정합성 분석에 충분 | 2025년 이전 비교는 포기 | 현실적 후보 |
| 2026-04-01 이후 | 확인 불가 | 확인 불가 | v136/v137/v138, NPay, `(not set)` 진단에 직접 필요. 가장 가벼움 | Q1 공동구매, 1~3월 source 품질 분석에는 부족 | 최소 필수 범위 |

비용 판단:

- BigQuery active storage는 일반적으로 `size_bytes`가 작으면 월 비용이 매우 작다.
- 정확한 비용은 `size_bytes` 확인 전에는 확정하지 않는다.
- 계산식은 `총 GB * 월 GB당 storage 단가`다.
- 실무상 GA4 daily event 규모가 수십 GB 이하면 월 수천 원~1달러 안팎일 가능성이 높지만, 현재 문서에는 추정치를 확정값으로 쓰지 않는다.

### 통합 프로젝트 후보 검토

| 후보 | 현재 확인 | 장점 | 단점 | 판단 |
|---|---|---|---|---|
| `project-dadba7dd-0229-4ff6-81c` | dataset 2개 확인: `analytics_326949178`, `analytics_326993019`, 둘 다 `asia-northeast3`. 서비스 계정 `jobs.query SELECT 1` 성공 | coffee/aibio와 같은 프로젝트. 현재 서비스 계정 job 실행 가능. 운영상 가장 단순 | 허들러스 작업자에게 이 프로젝트의 임시 write/copy 권한을 줘야 함 | 1순위 추천 |
| `seo-aeo-487113` | dataset 0개. BigQuery API는 활성. 서비스 계정 `jobs.create` 없음 | 이름상 우리 운영 프로젝트처럼 보임 | 현재 dataset 없음. 서비스 계정 job 실행도 막힘. 추가 IAM 정리가 필요 | 2순위 |

기본 추천은 `project-dadba7dd-0229-4ff6-81c`다.
반대 근거는 프로젝트 이름이 자동 생성형이라 장기 운영명으로 덜 명확하다는 점뿐이다.
현 시점에서는 coffee/aibio와 같은 project에 biocom backfill dataset을 두는 쪽이 더 단순하다.

추천 dataset 이름:

- 과거 복사본: `analytics_304759974_hurdlers_backfill`
- 재연결 후 GA4 자동 dataset: `analytics_304759974`

두 dataset을 분리해야 하는 이유:

- 허들러스 회신처럼 기존 데이터를 복사한 동일 dataset에 GA4를 재연결하면 중복·충돌 위험이 있다.
- 과거분은 backfill dataset, 재연결 이후 신규분은 GA4 자동 dataset으로 분리하는 것이 맞다.

### 허들러스에 추가 요청해야 할 내용

이관 범위 답변 전에 아래 권한 요청을 먼저 보낸다.

```text
안녕하세요. 확인 감사합니다.

현재 biocomkr.sns@gmail.com 사용자 계정 권한은 받은 것으로 보이지만,
저희 backend/Codex 자동 점검은 아래 서비스 계정으로 실행됩니다.

서비스 계정:
seo-656@seo-aeo-487113.iam.gserviceaccount.com

현재 이 서비스 계정으로 확인한 결과,
hurdlers-naver-pay.analytics_304759974 에 대해
bigquery.datasets.get / bigquery.tables.list / table query 권한이 아직 없어
table inventory와 raw sanity query를 실행하지 못하고 있습니다.

아래 권한을 추가 부탁드립니다.

1. Dataset:
   hurdlers-naver-pay.analytics_304759974
   권한: BigQuery Data Viewer

2. Project:
   hurdlers-naver-pay
   권한: BigQuery Job User
   목적: 현재 source freshness script가 hurdlers-naver-pay를 job project로 사용합니다.

또는 2번이 어렵다면,
dataset viewer만 서비스 계정에 부여해주셔도 됩니다.
이 경우 저희는 query job을 project-dadba7dd-0229-4ff6-81c에서 실행하도록 코드/설정을 조정하겠습니다.

권한 반영 후 아래 항목을 read-only로 확인하겠습니다.
- 첫 events_YYYYMMDD table
- 최신 events_YYYYMMDD table
- table 개수
- 총 row count
- 총 size_bytes
- 날짜별 row_count / size_bytes
- intraday table 존재 여부
- 최근 7일 및 2026-04-01 이후 raw purchase 품질

이 숫자를 확인한 뒤 이관 범위(전체 / 2026-01-01 이후 / 2026-04-01 이후)를 확정해서 회신드리겠습니다.
```

통합 프로젝트를 먼저 답해야 한다면 아래처럼 답한다.

```text
통합 예정 GCP 프로젝트 ID 1순위는 project-dadba7dd-0229-4ff6-81c 입니다.
해당 프로젝트에는 이미 GA4 export dataset analytics_326949178, analytics_326993019가 있고,
둘 다 asia-northeast3 리전입니다.

다만 이관 범위는 아직 확정하지 않겠습니다.
먼저 서비스 계정 read 권한으로 hurdlers-naver-pay.analytics_304759974의 table inventory와 size_bytes를 확인한 뒤,
전체 / 2026-01-01 이후 / 2026-04-01 이후 중 하나로 확정하겠습니다.
```

### TJ 결정 필요 사항

1. 허들러스에 서비스 계정 권한 추가 요청을 먼저 보낼지 결정한다.
   - 제 추천: YES
   - 자신감: 95%
   - 이유: 현재는 table inventory 숫자가 없어 이관 범위를 숫자로 답할 수 없다.

2. 통합 프로젝트 1순위를 `project-dadba7dd-0229-4ff6-81c`로 둘지 결정한다.
   - 제 추천: YES
   - 자신감: 85%
   - 이유: coffee/aibio dataset이 이미 있고, 서비스 계정 job 실행이 확인됐다.

3. 허들러스 작업자에게 줄 권한 범위를 정한다.
   - 최소: 대상 backfill dataset에 대한 BigQuery Data Editor + Job User
   - 더 편한 방식: 작업 기간 한정 BigQuery Admin
   - 작업 완료 후 회수 조건 필수

4. 이관 범위는 지금 확정하지 않는다.
   - 제 추천: 보류
   - 자신감: 90%
   - 이유: `size_bytes`, table count, earliest/latest table을 아직 직접 확인하지 못했다.

---

## 2026-04-30 수동 inventory 반영

작성 시각: 2026-04-30 15:44 KST
source: TJ BigQuery Console 수동 조회
window: `hurdlers-naver-pay.analytics_304759974` 전체 table inventory, 일부 raw sanity
site: biocom
freshness: latest `events_20260429`
confidence: B. BigQuery Console 수동값으로는 신뢰 가능하지만, backend/Codex 서비스 계정으로 아직 재검증하지 못했다.

### 10초 요약

수동 확인 기준 biocom BigQuery raw export는 2024-09-09부터 2026-04-29까지 살아 있고, 전체 크기는 `34.73 GB`다.
이 정도 크기는 BigQuery storage 비용 관점에서 사실상 작은 편이다.
따라서 이관 범위는 비용 때문에 줄일 필요는 약하고, 분석 목적 기준으로 보면 **전체 이관**을 기본 추천한다.

다만 backend/Codex 서비스 계정은 2026-04-30 15:44 KST 재확인에서도 아직 `bigquery.datasets.get denied` 상태다.
허들러스에 `seo-656@seo-aeo-487113.iam.gserviceaccount.com` dataset-level BigQuery Data Viewer 권한을 추가 요청한 뒤, 같은 inventory와 raw sanity를 자동 기준으로 다시 실행해야 한다.

### 수동 table inventory

| 항목 | 값 |
|---|---:|
| first table | `events_20240909` |
| latest table | `events_20260429` |
| table count | 598 |
| total rows | 24,126,956 |
| total size | 34.73 GB |
| 평균 rows/table | 약 40,346 |
| 평균 size/table | 약 0.058 GB |

### 수동 raw sanity

| date | events | purchase_events | distinct transaction_id | missing transaction_id | 판정 |
|---|---:|---:|---:|---:|---|
| 2026-04-29 | 44,753 | 70 | 70 | 0 | 정상. purchase와 transaction_id가 1:1 |
| 2026-04-23 | 확인 필요 | 233 | 155 | 확인 필요 | 중복 의심. extra purchase `78` |
| 2026-04-24 | 확인 필요 | 288 | 197 | 확인 필요 | 중복 의심. extra purchase `91` |

중복률:

| date | extra purchase | purchase 대비 extra 비율 | purchase / distinct 배율 |
|---|---:|---:|---:|
| 2026-04-23 | 78 | 33.5% | 1.50x |
| 2026-04-24 | 91 | 31.6% | 1.46x |

현재 해석:

- 2026-04-23~24는 v138 배포 전후의 중복 purchase 오염 창으로 본다.
- 2026-04-25 이후 purchase와 distinct transaction_id가 1:1에 가까워졌다면, v138 조치가 효과를 낸 정황이다.
- 원인 확정은 아직 아니다. raw에서 `transaction_id`, `pay_method`, `page_location`, `page_path`, `event_timestamp`, `stream_id`, `event_params` sender 흔적을 묶어 봐야 한다.

유력 가설:

1. `[143] HURDLERS purchase`와 `[48] GA4_구매전환_홈피구매`가 같은 주문에서 동시 발화했다.
2. 일부 NPay 또는 결제 중간 이벤트가 purchase로 들어왔다.
3. 같은 결제 완료 페이지에서 태그가 두 번 실행됐다.

### Freshness 재확인

2026-04-30 15:44 KST backend/Codex 기준 재실행:

```bash
cd backend
npx tsx scripts/check-source-freshness.ts --json
```

| source | status | latest table | rows | purchase | distinct transaction_id | max event time KST | note |
|---|---|---|---:|---:|---:|---|---|
| `ga4_bigquery_thecleancoffee` | fresh | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260429` | 2,228 | 21 | 21 | 2026-04-29 23:57:37 KST | 정상 |
| `ga4_bigquery_biocom` | error | 확인 불가 | - | - | - | - | `Permission bigquery.datasets.get denied` |

### 이관 범위 비교

수동 inventory 전체값을 기준으로 단순 평균 추정했다.
정확한 옵션별 size는 서비스 계정 권한 반영 후 날짜별 `size_bytes`로 다시 계산해야 한다.

| 옵션 | table 수 | size 추정 | rows 추정 | 장점 | 단점 | 추천 |
|---|---:|---:|---:|---|---|---|
| 전체 이관 | 598 | 34.73 GB | 24,126,956 | 2024-09-09 이후 raw 전체 보존. 과거 GA4/GTM 이슈 재분석 가능 | 허들러스 copy 작업 범위가 가장 큼 | 추천 |
| 2026-01-01 이후 | 119 | 약 6.91 GB | 약 4,801,000 | 2026년 Q1/Q2 광고·매출 정합성에 충분 | 2025년 이슈 재분석 불가 | 대안 |
| 2026-04-01 이후 | 29 | 약 1.68 GB | 약 1,170,000 | v136/v137/v138, NPay, `(not set)` 진단에는 충분 | Q1 공동구매와 1~3월 source 품질 분석에 부족 | 최소 범위 |

비용 판단:

- 34.73 GB 전체 이관도 storage 비용은 사실상 무시 가능한 수준이다.
- Google Cloud BigQuery 공식 가격표 기준 on-demand query는 월 1 TiB까지 free tier가 있고, 이후 과금된다. Storage는 active logical storage 기준 첫 10 GiB free tier가 있다.
- 같은 가격표의 예시에서 active logical storage 1 TiB full month가 약 `$23.552`로 제시된다. 이를 단순 환산하면 34.73 GiB는 전체 active 기준 약 `$0.80/month`, 첫 10 GiB free tier를 반영하면 약 `$0.57/month` 수준이다.
- 90일 이상 수정되지 않은 table은 long-term storage rate로 낮아질 수 있다.
- 따라서 이관 범위는 비용보다 분석 가치와 허들러스 작업 난이도로 결정하는 것이 맞다.

공식 근거:

- BigQuery pricing: https://cloud.google.com/bigquery/pricing

### 통합 프로젝트 추천

추천: `project-dadba7dd-0229-4ff6-81c`

이유:

- 이미 `analytics_326949178`, `analytics_326993019`가 있다.
- 두 dataset 모두 `asia-northeast3`다.
- 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`이 이 project에서는 `jobs.query SELECT 1`을 실행할 수 있다.
- biocom backfill dataset과 향후 `analytics_304759974` 자동 dataset을 같은 project, 같은 region에 두면 cross-site query가 가장 단순하다.

권장 dataset 구조:

| 목적 | dataset |
|---|---|
| 허들러스 과거 복사본 | `analytics_304759974_hurdlers_backfill` |
| GA4 재연결 이후 신규 export | `analytics_304759974` |
| 사람이 만든 mart/view | `seo_marts` 또는 별도 mart dataset. 아직 생성하지 않음 |

주의:

- 과거 복사본과 GA4 자동 export dataset을 같은 이름으로 합치지 않는다.
- 허들러스가 말한 것처럼 중복·충돌 위험이 있으므로 backfill dataset과 신규 GA4 dataset을 분리한다.

### 권한 반영 후 재실행할 쿼리

아래 쿼리는 서비스 계정 권한 반영 후 backend/Codex 기준으로 실행한다.
실행 전제: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`에 `hurdlers-naver-pay.analytics_304759974` BigQuery Data Viewer 권한이 있어야 한다.

#### Inventory

```sql
SELECT
  MIN(table_name) AS first_table,
  MAX(table_name) AS latest_table,
  COUNT(*) AS table_count,
  SUM(row_count) AS total_rows,
  SUM(size_bytes) AS total_size_bytes,
  ROUND(SUM(size_bytes) / POW(1024, 3), 2) AS total_size_gib
FROM `hurdlers-naver-pay.analytics_304759974.__TABLES__`
WHERE STARTS_WITH(table_name, 'events_');
```

#### 날짜별 table size

```sql
SELECT
  table_name,
  row_count,
  size_bytes,
  ROUND(size_bytes / POW(1024, 3), 4) AS size_gib,
  creation_time
FROM `hurdlers-naver-pay.analytics_304759974.__TABLES__`
WHERE STARTS_WITH(table_name, 'events_')
ORDER BY table_name;
```

#### 최근 7일 raw sanity

```sql
SELECT
  event_date,
  COUNT(*) AS events,
  COUNTIF(event_name = 'purchase') AS purchase_events,
  COUNT(DISTINCT IF(event_name = 'purchase', ecommerce.transaction_id, NULL)) AS distinct_transaction_ids,
  COUNTIF(event_name = 'purchase' AND (ecommerce.transaction_id IS NULL OR ecommerce.transaction_id = '')) AS missing_transaction_id,
  SAFE_DIVIDE(
    COUNTIF(event_name = 'purchase' AND (ecommerce.transaction_id IS NULL OR ecommerce.transaction_id = '')),
    COUNTIF(event_name = 'purchase')
  ) AS missing_transaction_id_rate,
  COUNTIF(event_name = 'purchase' AND (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') = 'homepage') AS pay_method_homepage,
  COUNTIF(event_name = 'purchase' AND (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') = 'npay') AS pay_method_npay,
  COUNTIF(event_name = 'purchase' AND (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') = 'vbank') AS pay_method_vbank,
  COUNTIF(event_name = 'purchase' AND (traffic_source.source IS NULL OR traffic_source.source = '' OR traffic_source.source = '(not set)')) AS missing_session_source,
  COUNTIF(event_name = 'purchase' AND (traffic_source.medium IS NULL OR traffic_source.medium = '' OR traffic_source.medium = '(not set)')) AS missing_session_medium,
  COUNTIF(event_name = 'purchase' AND (traffic_source.name IS NULL OR traffic_source.name = '' OR traffic_source.name = '(not set)')) AS missing_session_campaign,
  COUNTIF(event_name = 'purchase' AND collected_traffic_source.manual_source IS NOT NULL) AS has_collected_manual_source,
  COUNTIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_location') LIKE '%shop_payment_complete%') AS payment_complete_events
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 7 DAY))
  AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY))
GROUP BY event_date
ORDER BY event_date;
```

#### 2026-04-01 이후 raw sanity

최근 7일 쿼리와 같고, `WHERE`만 아래로 바꾼다.

```sql
WHERE _TABLE_SUFFIX BETWEEN '20260401'
  AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY))
```

### 2026-04-23~24 purchase 중복 원인 분석 쿼리

권한 반영 후 가장 먼저 실행할 쿼리다.
목적은 같은 `transaction_id`가 어떤 `pay_method`, `page_location`, timestamp, stream에서 중복 발화했는지 보는 것이다.

```sql
WITH purchase_events AS (
  SELECT
    event_date,
    TIMESTAMP_MICROS(event_timestamp) AS event_ts_utc,
    FORMAT_TIMESTAMP('%F %T', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_ts_kst,
    user_pseudo_id,
    stream_id,
    ecommerce.transaction_id AS transaction_id,
    ecommerce.purchase_revenue AS purchase_revenue,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pay_method') AS pay_method,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_location') AS page_location,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_path') AS page_path,
    traffic_source.source AS session_source,
    traffic_source.medium AS session_medium,
    traffic_source.name AS session_campaign,
    collected_traffic_source.manual_source AS collected_source,
    collected_traffic_source.manual_medium AS collected_medium,
    collected_traffic_source.manual_campaign_name AS collected_campaign
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260423' AND '20260424'
    AND event_name = 'purchase'
)
SELECT
  event_date,
  transaction_id,
  COUNT(*) AS event_count,
  COUNT(DISTINCT event_ts_utc) AS distinct_event_ts,
  COUNT(DISTINCT pay_method) AS distinct_pay_method,
  STRING_AGG(DISTINCT COALESCE(pay_method, '(null)'), ', ' ORDER BY COALESCE(pay_method, '(null)')) AS pay_methods,
  COUNT(DISTINCT page_location) AS distinct_page_location,
  STRING_AGG(DISTINCT COALESCE(page_path, '(null)'), ', ' ORDER BY COALESCE(page_path, '(null)')) AS page_paths,
  STRING_AGG(DISTINCT COALESCE(stream_id, '(null)'), ', ' ORDER BY COALESCE(stream_id, '(null)')) AS stream_ids,
  MIN(event_ts_kst) AS first_event_kst,
  MAX(event_ts_kst) AS last_event_kst,
  SUM(COALESCE(purchase_revenue, 0)) AS summed_purchase_revenue,
  ANY_VALUE(session_source) AS sample_session_source,
  ANY_VALUE(collected_source) AS sample_collected_source
FROM purchase_events
WHERE transaction_id IS NOT NULL AND transaction_id != ''
GROUP BY event_date, transaction_id
HAVING COUNT(*) > 1
ORDER BY event_count DESC, event_date, transaction_id
LIMIT 200;
```

원인 판정 기준:

| 패턴 | 해석 |
|---|---|
| 같은 `transaction_id`, 같은 `page_location`, event_ts가 수 초 이내 | 같은 결제완료 페이지에서 태그가 중복 발화 |
| 같은 `transaction_id`, `pay_method`가 `(null)` 또는 `homepage`로 섞임 | `[143] HURDLERS`와 `[48] 홈피구매` 동시 발화 가능성 |
| `page_path`가 `/shop_cart` 또는 NPay 계열이고 transaction_id가 비정상 | NPay 버튼/중간 이벤트 오염 가능성 |
| 2026-04-25 이후 같은 패턴 급감 | v138 조치 효과로 판단 가능 |

### 현재 결정

1. 허들러스에 서비스 계정 dataset-level BigQuery Data Viewer 요청은 그대로 진행한다.
2. 권한 반영 후 동일 inventory와 raw sanity를 backend/Codex 기준으로 재실행한다.
3. 2026-04-23~24 duplicate purchase 원인 분석은 위 쿼리로 별도 실행한다.
4. 삭제, 복사, 신규 링크 생성은 아직 하지 않는다.

## 2026-05-05 backend/Codex 권한 재검증 결과

작성 시각: 2026-05-05 00:46 KST
기준 시각: 2026-05-05 00:46 KST
작업 성격: BigQuery read-only 권한 확인, inventory 조회, raw sanity 조회, duplicate purchase 원인 조사

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
    - BigQuery read-only metadata lookup
    - BigQuery read-only SELECT query
    - local freshness script run
    - Obsidian decision doc update
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - BigQuery data copy
    - BigQuery data delete
    - production DB write
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    site: biocom
    window: 2024-09-09 to 2026-05-03 daily events tables
    freshness: latest table events_20260503, max event time 2026-05-03 23:59:58 KST
    confidence: A for metadata and SQL result, B for duplicate cause interpretation
```

### 10초 요약

`seo-656@seo-aeo-487113.iam.gserviceaccount.com` 기준으로 허들러스 dataset read 권한은 열렸다.
`datasets.get`과 `tables.list`는 성공했고, `project-dadba7dd-0229-4ff6-81c`를 job project로 쓰면 허들러스 dataset SQL 조회도 성공했다.
다만 기존 `check-source-freshness.ts`는 job project를 `hurdlers-naver-pay`로 사용하므로 아직 `bigquery.jobs.create` 에러가 난다.
결론은 허들러스 추가 권한 없이도 read-only 조사는 가능하지만, 운영 freshness 스크립트는 job project 분리 패치가 필요하다.

### 현재 접근 상태

| 확인 항목 | 결과 | 해석 |
|---|---:|---|
| `datasets.get hurdlers-naver-pay.analytics_304759974` | OK | Data Viewer 계열 권한 반영됨 |
| `tables.list hurdlers-naver-pay.analytics_304759974` | OK | table inventory 확인 가능 |
| `jobs.query` in `hurdlers-naver-pay` | FAIL | `bigquery.jobs.create` 없음 |
| `jobs.query` in `project-dadba7dd-0229-4ff6-81c` | OK | 이 프로젝트를 job project로 쓰면 SQL 가능 |
| `jobs.query` in `seo-aeo-487113` | FAIL | 이 프로젝트도 `bigquery.jobs.create` 없음 |

실제 조회 credential:

- `credential`: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`
- `sourceProject`: `hurdlers-naver-pay`
- `jobProject`: `project-dadba7dd-0229-4ff6-81c`
- `dataset`: `analytics_304759974`
- `location`: `asia-northeast3`

### Freshness 결과

`backend/scripts/check-source-freshness.ts --json` 실행 시각은 2026-05-05 00:45:09 KST다.

| source | 결과 | latest table | rows | purchase | distinct transaction_id | max event time KST | note |
|---|---:|---|---:|---:|---:|---|---|
| `ga4_bigquery_biocom` | `error` | 확인 전 실패 | - | - | - | - | `hurdlers-naver-pay`에 `bigquery.jobs.create` 없음 |
| direct BigQuery query with `project-dadba7dd-0229-4ff6-81c` job project | fresh로 볼 수 있음 | `events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 KST | 기존 스크립트 코드만 job project 분리 필요 |

정리하면 데이터 자체는 최신 daily export 기준 정상이다.
실패 지점은 source dataset 권한이 아니라 job 생성 프로젝트 선택이다.

### Table Inventory

Source: `hurdlers-naver-pay.analytics_304759974`
Window: 전체 `events_YYYYMMDD`
Freshness: 2026-05-05 00:44 KST 조회
Confidence: A

| 항목 | 값 |
|---|---:|
| dataset location | `asia-northeast3` |
| first table | `events_20240909` |
| latest table | `events_20260503` |
| daily table count | 602 |
| total row count | 24,310,428 |
| total size bytes | 37,605,989,864 |
| total size GiB | 35.02 |
| intraday table count | 0 |
| latest intraday table | 없음 |

최근 daily table:

| table | rows | size GiB |
|---|---:|---:|
| `events_20260503` | 48,553 | 0.0803 |
| `events_20260502` | 40,310 | 0.0649 |
| `events_20260501` | 46,229 | 0.0728 |
| `events_20260430` | 48,380 | 0.0800 |
| `events_20260429` | 44,753 | 0.0678 |
| `events_20260428` | 57,292 | 0.0898 |
| `events_20260427` | 70,212 | 0.1126 |

### Raw Sanity 결과

최근 사용 가능한 daily export 7일은 `2026-04-27`부터 `2026-05-03`까지다.
`events_20260504` daily table은 이 시점에 아직 없다.

| event_date | events | purchase | distinct transaction_id | empty/null transaction_id | homepage | npay | pay_method missing | max event time KST |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-04-27 | 70,212 | 80 | 80 | 0 | 77 | 3 | 0 | 2026-04-27 23:59:45 |
| 2026-04-28 | 57,292 | 82 | 82 | 0 | 82 | 0 | 0 | 2026-04-28 23:59:56 |
| 2026-04-29 | 44,753 | 70 | 70 | 0 | 70 | 0 | 0 | 2026-04-29 23:59:58 |
| 2026-04-30 | 48,380 | 78 | 78 | 0 | 76 | 0 | 2 | 2026-04-30 23:59:59 |
| 2026-05-01 | 46,229 | 72 | 72 | 0 | 72 | 0 | 0 | 2026-05-01 23:59:55 |
| 2026-05-02 | 40,310 | 49 | 49 | 0 | 49 | 0 | 0 | 2026-05-02 23:59:59 |
| 2026-05-03 | 48,553 | 59 | 59 | 0 | 59 | 0 | 0 | 2026-05-03 23:59:58 |

2026-04-01 이후 summary:

| 항목 | 값 |
|---|---:|
| total events | 2,922,584 |
| purchase events | 5,188 |
| distinct ecommerce.transaction_id | 2,858 |
| empty/null transaction_id | 0 |
| empty/null transaction_id rate | 0.0% |
| pay_method homepage | 1,177 |
| pay_method npay | 512 |
| pay_method vbank | 0 |
| pay_method missing | 3,499 |
| missing session source | 2 |
| missing session medium | 2 |
| missing session campaign | 15 |
| collected_traffic_source manual_source present | 4,500 |
| payment complete page events | 11,695 |
| payment complete page purchase events | 2,640 |

Traffic source 해석:

- 최근 daily export의 `session_traffic_source_last_click` 기준 source/medium은 거의 채워져 있다.
- 2026-04-29, 2026-05-02, 2026-05-03에 campaign만 각 1건 결측이다.
- `collected_traffic_source.manual_source`는 구매 이벤트 대부분에서 존재하지만, `manual_medium`, `manual_campaign_name`은 최근 구매 이벤트에서 거의 비어 있다.
- ROAS/캠페인 분석 primary는 `session_traffic_source_last_click.manual_campaign` 계열로 두고, `collected_traffic_source`는 보조 신호로 쓰는 편이 맞다.

### 2026-04-23~24 Purchase 중복 원인

Source: `hurdlers-naver-pay.analytics_304759974.events_*`
Window: `20260423` to `20260424`
Freshness: 2026-05-05 00:45 KST 조회
Confidence: 숫자 A, 원인 해석 B

| event_date | purchase | distinct transaction_id | duplicated transaction_id | duplicate extra events | same timestamp duplicate | same bundle duplicate | same revenue duplicate |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-04-23 | 233 | 155 | 70 | 78 | 0 | 0 | 69 |
| 2026-04-24 | 288 | 197 | 82 | 91 | 0 | 0 | 81 |

중복 분포:

| event_date | 1회 발화 transaction_id | 2회 발화 | 3회 발화 | 4회 발화 |
|---|---:|---:|---:|---:|
| 2026-04-23 | 85 | 62 | 8 | 0 |
| 2026-04-24 | 115 | 74 | 7 | 1 |

가장 강한 패턴:

- 2026-04-23 중복 transaction 53건은 `pay_method missing + page_location missing` 1건과 `pay_method homepage + shop_payment_complete` 1건이 같은 transaction_id, 같은 revenue로 같이 존재한다.
- 2026-04-24 중복 transaction 46건도 같은 패턴이다.
- 같은 timestamp나 같은 bundle 중복은 0건이다. BigQuery export 중복 적재라기보다 서로 다른 GA4 purchase 발화 경로가 같은 주문을 여러 번 보낸 형태에 가깝다.
- 중복 transaction 대부분은 revenue가 같다. 따라서 매출 합산은 `purchase event count`가 아니라 `transaction_id` 기준 dedupe가 필요하다.
- 2026-04-23의 `(not set)` transaction_id NPay row는 3건, 2026-04-24는 4건이다. empty/null은 아니지만 정상 주문번호가 아니므로 NPay sanity에서는 invalid transaction_id로 별도 취급해야 한다.
- 2026-04-25 이후에는 purchase와 distinct transaction_id가 1:1에 가깝다. 2026-04-23~24 중복은 당시 태그 중복 또는 v138 이전 결제완료 태그 구조의 영향으로 보는 것이 유력하다. 단 GTM 변경 로그와 대조하기 전까지 확정 원인은 아니다.

### 이관 범위 추천

| 옵션 | table 수 | rows | size GiB | 장점 | 단점 | 추천 |
|---|---:|---:|---:|---|---|---|
| 전체 이관 | 602 | 24,310,428 | 35.02 | 2024-09-09 이후 raw를 모두 보존. 과거 비교와 추적 감사에 가장 안전 | 가장 넓지만 그래도 작음 | YES |
| 2026-01-01 이후 | 123 | 10,314,223 | 17.34 | 2026년 ROAS/캠페인 판단에는 충분 | 2024~2025 장기 추세와 과거 오류 감사가 빠짐 | 보조안 |
| 2026-04-01 이후 | 33 | 2,922,584 | 5.05 | 이번 중복/태그 수정 전후만 빠르게 보기 좋음 | 이관 정본으로는 너무 좁음 | NO, 임시 분석용 |

비용 판단:

- 전체 이관도 35.02 GiB라 저장 비용은 사실상 무시 가능하다.
- Google Cloud 공식 가격표 기준 BigQuery는 첫 10 GiB 저장과 월 1 TiB query processing free tier가 있다.
- 서울 리전 active logical storage 단가를 적용해도 전체 35.02 GiB는 월 1달러 안팎의 작은 규모다. 실제 청구는 billing account의 free tier 사용량, logical/physical billing model, 장기 저장 전환 여부에 따라 달라진다.
- 가격 근거: https://cloud.google.com/bigquery/pricing, storage 산식 근거: https://docs.cloud.google.com/bigquery/docs/information-schema-table-storage

추천은 전체 이관이다.
이유는 용량 차이보다 과거 원자료 보존 가치가 크고, 이후 중복/ROAS 감사에서 2024~2025 baseline이 필요해질 수 있기 때문이다.

### 통합 프로젝트 후보

기본 추천은 `project-dadba7dd-0229-4ff6-81c`다.

근거:

- 같은 서비스 계정으로 이 프로젝트에서는 `jobs.query`가 성공한다.
- 더클린커피 `analytics_326949178`도 이미 이 프로젝트에서 정상 freshness 조회 중이다.
- biocom raw backfill과 coffee raw export를 같은 billing/project 운영면에 두면 스크립트와 권한 관리가 단순하다.
- `seo-aeo-487113`은 2026-05-05 00:46 KST 기준 `jobs.query`도 실패한다. 지금 후보로 쓰면 먼저 IAM 정리가 필요하다.

권장 dataset 구조:

- 과거 허들러스 복사본: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`
- GA4 재연결 후 신규 export: `project-dadba7dd-0229-4ff6-81c.analytics_304759974`

아직 실행하지 않은 것:

- 기존 GA4 BigQuery Link 삭제: 하지 않음.
- 신규 GA4 BigQuery Link 생성: 하지 않음.
- BigQuery table copy: 하지 않음.
- BigQuery data delete: 하지 않음.

### 허들러스에 추가 요청해야 할 내용

즉시 raw 조사만 보면 추가 요청은 필수가 아니다.
`project-dadba7dd-0229-4ff6-81c`를 job project로 지정하면 SQL 조회가 가능하기 때문이다.

다만 기존 `check-source-freshness.ts`를 코드 수정 없이 그대로 통과시키려면 아래 권한이 더 필요하다.

```text
Please grant the service account seo-656@seo-aeo-487113.iam.gserviceaccount.com
the project-level BigQuery Job User role (roles/bigquery.jobUser)
on the GCP project hurdlers-naver-pay.

Dataset-level BigQuery Data Viewer on hurdlers-naver-pay.analytics_304759974
is already working. The remaining failing permission is bigquery.jobs.create
on project hurdlers-naver-pay.
```

Codex 추천은 허들러스에 추가 요청하기 전에 `backend/src/sourceFreshness.ts`에서 source project와 job project를 분리하는 것이다.
그렇게 하면 허들러스에는 dataset-level Data Viewer만 유지하고, job 비용과 권한은 우리 통합 프로젝트에서 관리할 수 있다.

### TJ 결정 필요 사항

1. `check-source-freshness.ts`를 `project-dadba7dd-0229-4ff6-81c` job project 방식으로 수정할지 결정한다.
2. 허들러스에 `roles/bigquery.jobUser`를 추가 요청할지, 아니면 우리 job project 방식으로 운영할지 결정한다.
3. 이관 범위는 전체 이관으로 확정할지 결정한다.
4. 허들러스가 실제 복사를 수행한다면, 대상 프로젝트는 `project-dadba7dd-0229-4ff6-81c`, backfill dataset은 `analytics_304759974_hurdlers_backfill`로 전달한다.

## 2026-05-05 source/job project 분리 패치 결과

작성 시각: 2026-05-05 01:05 KST
작업 성격: backend freshness 코드 최소 수정, read-only BigQuery query 검증, backfill 권한 가능성 확인

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
    - backend code patch
    - BigQuery read-only SELECT query
    - BigQuery dryRun validation
    - local typecheck
    - Obsidian decision doc update
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - BigQuery dataset create
    - BigQuery table copy
    - BigQuery data delete
    - production DB write
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    site: biocom
    window: latest daily table events_20260503
    freshness: 2026-05-03 23:59:58 KST
    confidence: A for freshness result, B for future copy IAM because target dataset does not exist yet
```

### 10초 요약

허들러스 추가 Job User 요청은 보류하고, backend에서 source project와 job project를 분리했다.
이제 biocom freshness는 `hurdlers-naver-pay.analytics_304759974`를 읽되, query job은 `project-dadba7dd-0229-4ff6-81c`에 만든다.
재실행 결과 `ga4_bigquery_biocom`은 `error`에서 `fresh`로 바뀌었다.
실제 dataset 생성, table copy, GA4 Link 삭제·생성은 하지 않았다.

### 코드 변경

변경 파일:

- `backend/src/sourceFreshness.ts`

변경 내용:

- BigQuery source config를 `sourceProjectId`, `jobProjectId`, `location` 구조로 분리했다.
- 기존 source는 `jobProjectId`가 없으면 `sourceProjectId`를 그대로 사용한다.
- biocom만 아래 값으로 지정했다.

```text
sourceProjectId: hurdlers-naver-pay
dataset: analytics_304759974
jobProjectId: project-dadba7dd-0229-4ff6-81c
location: asia-northeast3
```

SQL table reference는 계속 아래를 사용한다.

```text
hurdlers-naver-pay.analytics_304759974.events_*
```

### Freshness 재검증

실행 명령:

```bash
cd backend
npx tsx scripts/check-source-freshness.ts --json
```

기준 시각: 2026-05-05 01:05:16 KST

| source | status | table | rows | purchase | distinct transaction_id | max event time KST | note |
|---|---:|---|---:|---:|---:|---|---|
| `ga4_bigquery_thecleancoffee` | `fresh` | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260503` | 2,949 | 14 | 14 | 2026-05-03 23:41:44 | job project `project-dadba7dd-0229-4ff6-81c` |
| `ga4_bigquery_biocom` | `fresh` | `hurdlers-naver-pay.analytics_304759974.events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 | job project `project-dadba7dd-0229-4ff6-81c` |

참고:

- `toss_operational`, `playauto_operational`은 같은 실행에서 PostgreSQL connection slot 부족으로 error가 났다.
- 이는 BigQuery 패치와 별개다.
- 이번 성공 기준인 thecleancoffee BigQuery fresh 유지와 biocom BigQuery fresh 전환은 충족했다.

### Typecheck

실행 명령:

```bash
cd backend
npm run typecheck
```

결과: 통과.

### Backfill dataset 생성/copy 권한 가능성

대상:

- target project: `project-dadba7dd-0229-4ff6-81c`
- target dataset 후보: `analytics_304759974_hurdlers_backfill`
- source table sample: `hurdlers-naver-pay.analytics_304759974.events_20260503`
- credential: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`

실제 생성이나 copy는 하지 않았다.
확인은 metadata lookup과 BigQuery `dryRun`만 사용했다.

| 확인 | 결과 | 해석 |
|---|---:|---|
| target dataset metadata lookup | `Not found` | `analytics_304759974_hurdlers_backfill`은 아직 없음 |
| target project `jobs.query SELECT 1` | OK | target project에서 job 생성 가능 |
| source table metadata `events_20260503` | OK | source table metadata 접근 가능. rows 48,553, bytes 86,212,350 |
| `CREATE SCHEMA project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` dryRun | OK | dataset 생성 권한 가능성이 높음. 실제 생성은 하지 않음 |
| copy job dryRun to missing backfill dataset | FAIL, dataset not found | target dataset이 없어서 copy 권한은 아직 완전 검증 불가 |
| copy job dryRun to existing coffee dataset probe table | FAIL, `bigquery.tables.create` denied | 이 서비스 계정은 기존 coffee dataset에 임의 table을 만들 권한은 없음 |
| post-check probe table | Not found | dryRun으로 실제 table 생성 없음 |

권한 해석:

- 서비스 계정이 직접 `analytics_304759974_hurdlers_backfill` dataset을 만들면 copy 가능성이 높다.
- 이유는 `CREATE SCHEMA` dryRun이 통과했고, BigQuery 공식 문서 기준 dataset creator는 해당 dataset의 BigQuery Data Owner가 된다.
- 다만 target dataset이 아직 없으므로 실제 table copy 권한은 100% 확정할 수 없다.
- 누군가가 target dataset을 대신 만들어주면, 이 서비스 계정에는 그 dataset에 대한 table create/write 권한이 따로 필요하다.

필요 IAM:

1. 서비스 계정이 직접 backfill dataset을 만들고 복사하는 방식
   - `project-dadba7dd-0229-4ff6-81c` project에 `bigquery.datasets.create`
   - `project-dadba7dd-0229-4ff6-81c` project에 `bigquery.jobs.create`
   - `hurdlers-naver-pay.analytics_304759974` source dataset에 `bigquery.tables.get`, `bigquery.tables.getData`
   - 현재 dryRun과 source query 결과상 위 조건은 대체로 충족된 것으로 보인다.

2. TJ 또는 다른 계정이 backfill dataset을 먼저 만드는 방식
   - `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill` dataset에 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`을 BigQuery Data Editor 또는 BigQuery Data Owner로 부여해야 한다.
   - target project에는 계속 BigQuery Job User가 필요하다.
   - source dataset에는 BigQuery Data Viewer가 필요하다.

공식 근거:

- dataset 생성에는 `bigquery.datasets.create`가 필요하고, BigQuery User/Data Editor/Data Owner/Admin에 포함된다. Dataset creator는 생성한 dataset의 BigQuery Data Owner가 된다. 출처: https://cloud.google.com/bigquery/docs/datasets
- table copy에는 source의 `bigquery.tables.getData`, `bigquery.tables.get`, destination의 `bigquery.tables.create`, `bigquery.tables.update`, 그리고 copy job 실행 권한 `bigquery.jobs.create`가 필요하다. 출처: https://cloud.google.com/bigquery/docs/managing-tables
- query 결과를 table에 쓰는 경우 destination에 `bigquery.tables.create`, `bigquery.tables.updateData`, job project에 `bigquery.jobs.create`가 필요하다. 출처: https://docs.cloud.google.com/bigquery/docs/writing-results

### 하지 않은 것

- `analytics_304759974_hurdlers_backfill` dataset 생성: 하지 않음.
- 허들러스 dataset table copy: 하지 않음.
- 기존 GA4 BigQuery Link 삭제: 하지 않음.
- 신규 GA4 BigQuery Link 생성: 하지 않음.
- 운영 DB write: 하지 않음.
- deploy: 하지 않음.

### 현재 결정

1. 허들러스에 project-level Job User 추가 요청은 계속 보류한다.
2. biocom freshness는 `project-dadba7dd-0229-4ff6-81c` job project 방식으로 운영 가능하다.
3. backfill은 전체 이관을 추천하되, 실제 dataset 생성과 copy는 별도 승인 전에는 하지 않는다.
4. backfill 실행 시에는 서비스 계정이 직접 target dataset을 만들게 하는 방식이 가장 단순하다.

## 2026-05-05 biocom initial backfill 실행 결과

작성 시각: 2026-05-05 01:38 KST
상세 결과 문서: [[biocom-bigquery-backfill-result-20260505]]
작업 성격: Yellow Lane 승인 실행, target backfill dataset 생성 및 initial daily table copy

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
  allowed_actions:
    - target dataset create
    - target dataset internal daily table copy with WRITE_EMPTY
    - read-only verification query
    - local result documentation
  forbidden_actions:
    - GA4 BigQuery Link delete
    - GA4 BigQuery Link create
    - source table delete
    - source table update
    - source dataset IAM change
    - write outside target backfill dataset
    - production DB write
    - deploy
    - platform send
    - sourceFreshness switch to backfill dataset
  source_window_freshness_confidence:
    source: hurdlers-naver-pay.analytics_304759974
    target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
    site: biocom
    window: events_20240909 to events_20260503
    freshness: verification completed 2026-05-05 01:38 KST
    confidence: 94%
```

### 10초 요약

TJ님 승인 범위 안에서 biocom GA4 daily raw table 602개를 우리 target backfill dataset으로 복사했다.
target dataset은 `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`이고 location은 `asia-northeast3`다.
source와 target의 table count, row_count 합계, size_bytes, sample 5개, latest purchase sanity가 모두 일치했다.
이번 실행은 initial backfill까지만이며 final delta backfill과 GA4 BigQuery Link cutover는 아직 하지 않았다.

### 실행 결과

source: `hurdlers-naver-pay.analytics_304759974`
target: `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`
credential: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| first table | `events_20240909` | `events_20240909` | 일치 |
| latest table | `events_20260503` | `events_20260503` | 일치 |
| daily table count | 602 | 602 | 일치 |
| total rows | 24,310,428 | 24,310,428 | 일치 |
| total size_bytes | 37,605,989,864 | 37,605,989,864 | 일치 |
| total size GiB | 35.02 | 35.02 | 일치 |

copy 결과:

- target dataset 생성: 성공.
- target dataset location: `asia-northeast3`.
- copied table count: 602.
- write disposition: `WRITE_EMPTY`.
- source write: 없음.
- target 외 write: 없음.
- copy job errorResult: 0건.

### Verification 결과

실행 명령:

```bash
cd backend
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify
npx tsx scripts/biocom-bigquery-backfill.ts --mode=verify --json
```

검증 기준 시각: 2026-05-05 01:38 KST

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

| table | rows | purchase | distinct transaction_id | max event time KST | 결과 |
|---|---:|---:|---:|---|---|
| source `events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 UTC+9 | 일치 |
| target `events_20260503` | 48,553 | 59 | 59 | 2026-05-03 23:59:58 UTC+9 | 일치 |

### Freshness 재확인

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

biocom sourceFreshness 기본 경로는 아직 허들러스 source dataset을 본다.
이번 작업에서 backfill dataset으로 전환하지 않았다.

### 하지 않은 것

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

### 다음 결정

1. final delta backfill은 cutover 직전에 별도 승인으로 진행한다.
2. GA4 BigQuery Link 삭제와 신규 Link 생성은 final delta verification PASS 후 별도 승인으로 진행한다.
3. `backend/src/sourceFreshness.ts`의 biocom source는 당분간 `hurdlers-naver-pay.analytics_304759974`를 유지한다.

### Auditor Verdict

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

Source / window / freshness:
- source: hurdlers-naver-pay.analytics_304759974
- target: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill
- window: events_20240909 to events_20260503
- freshness: verification 2026-05-05 01:38 KST
- site: biocom
- confidence: 94%

Validation:
- plan PASS.
- initial-copy PASS.
- verify PASS.
- npm run typecheck PASS.
- check-source-freshness PASS for thecleancoffee and biocom BigQuery sources.

Notes:
- Final delta backfill remains outside this approval.
- GA4 Link cutover remains blocked until separate approval.
```
