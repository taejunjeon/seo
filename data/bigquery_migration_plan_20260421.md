# BigQuery GA4 Export 자체 프로젝트 이전 계획

작성: 2026-04-21 01:50 KST
대상: biocom GA4 property `304759974` (`G-WJFXN5E2Q1`)
현재 소스: `hurdlers-naver-pay.analytics_304759974` (허들러스 GCP 프로젝트)
목표 소스: `seo-aeo-487113.analytics_304759974` (자체 GCP 프로젝트)
상태: 설계 단계 (실행 미착수)

## 10초 요약

- 현재 biocom GA4 raw export 는 **허들러스 GCP 프로젝트**에 있음 — Claude service account 권한 부분 확보, TJ 개인 계정 Data Viewer 보유
- 자체 프로젝트 `seo-aeo-487113` 로 이전하면 **권한 의존성 제거 + 백엔드 `check-source-freshness` 자동 freshness 수집**이 가능해짐
- **타이밍 권장: 2026-05-05 이후** — v136/v137 효과 baseline 2주 확보 후. 양쪽 병행 기간 1~2주 두고 교차 검증
- **과거 데이터는 가져올 수 없음** (GA4 BigQuery Link 는 link 시점 이후만 export). 2026-04 이전 raw 는 허들러스 의존 유지 또는 일회성 table copy

## 1. 왜 이 이전이 필요한가

### 현재 통증

| 항목 | 현재 상태 |
|---|---|
| biocom GA4 raw 접근 | 허들러스 프로젝트 `hurdlers-naver-pay.analytics_304759974` 에 전적으로 의존 |
| Claude service account `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 권한 | 미확보 (허들러스에 요청했으나 미부여 상태) — `check-source-freshness.ts` 에 `ga4_bigquery_biocom` 항목이 오래 대기 |
| TJ `biocomkr.sns@gmail.com` 권한 | Data Viewer + Job User 부여됨 (2026-04-20) — BQ Console 수동 쿼리만 가능 |
| 백엔드 자동 쿼리 | 불가능 (service account 권한 부재) |
| 허들러스 측 의사결정 종속성 | 허들러스가 export 해제/변경할 권한 보유. 우리는 제어 불가 |
| thecleancoffee | 자체 프로젝트에 이미 있음 (`ga4_bigquery_thecleancoffee`). biocom 만 외부 |

### 이전 후 얻는 것

- **서비스 계정 권한 즉시 확보** — 백엔드 freshness 체크, 일일 쿼리 자동화, `/ads` 대시보드 BQ 직연동 가능
- **C-Sprint 5 identity coverage 다음 단계 (session_lost / raw_export_unknown 원인 분해)** 자동화
- **`(not set)` / `(direct)` 추이 자동 모니터링**
- **vbank guard v137 효과 자동 집계** — `pay_method=vbank` purchase 이벤트 일자별 감소 trend
- **NPay return 누락 비중 상시 관측** (Phase5-Sprint9)
- **허들러스 프로젝트 권한 이슈로부터 완전 분리**

## 2. 타이밍 분석

### 권장: 2026-05-05 (2주 후)

근거:
1. **v136/v137 효과 baseline 2주 확보 필요** — publish 후 `(not set)` 감소, vbank guard 효과가 허들러스 export 에 먼저 쌓여야 before/after 비교 가능. 중간에 source 이전하면 baseline 이 끊김
2. **GA4 BigQuery Link 는 link 시점 이후 데이터만 export** — 5/05 에 link 하면 5/05 부터 자체 프로젝트에 쌓이고, 그 이전은 허들러스 prediction 에 의존 유지
3. **병행 기간 1~2주 (5/05~5/20)** 에 같은 날짜 데이터가 양쪽에 존재 → 일치 여부 검증 → 자체 프로젝트 신뢰성 확정
4. **5/20 이후** Claude / 백엔드 쿼리를 자체 프로젝트로 point 전환

### 대안 타이밍

| 타이밍 | 장점 | 단점 |
|---|---|---|
| **2026-04-22 즉시** | v136/v137 효과 측정 자동화 즉시 가능 | baseline 끊김, 비교 분석 복잡 |
| **2026-05-05 (권장)** | baseline 깨끗, 병행 검증 가능 | 2주 대기 |
| 2026-06-01 | 1달 baseline + 월말 리포트 검증 | 너무 늦음, C-Sprint 5 지연 |

## 3. 실행 방법 3가지 옵션 비교

### 옵션 A — GA4 BigQuery Link (신규 export, 권장)

GA4 Admin → Data Streams → BigQuery Links → 자체 프로젝트 `seo-aeo-487113` 선택 → Daily + Streaming export 활성.

| 항목 | 내용 |
|---|---|
| 데이터 범위 | Link 시점 이후 전체 |
| 지연 | Daily (24h 지연) + Streaming (수 분) |
| 허들러스 export | 유지 여부 선택 가능 (양쪽 export 허용) |
| 사전 작업 | BQ API 활성화, billing 계정 연결, dataset 자동 생성 |
| 비용 | Storage ~수 GB/월 예상, 쿼리는 on-demand 또는 flat-rate |
| 장점 | 공식 route, 실시간 streaming, 무중단 |
| 단점 | 과거 데이터 미포함 |

### 옵션 B — Scheduled Data Transfer (허들러스 → 우리)

BigQuery Data Transfer Service 로 허들러스 dataset 을 일일 복제.

| 항목 | 내용 |
|---|---|
| 데이터 범위 | 허들러스에 있는 전체 (과거 포함) |
| 지연 | 일일 배치 |
| 사전 작업 | 허들러스 측 "Source dataset share" 또는 service account에 읽기 권한 영구 부여 |
| 장점 | 과거 데이터 포함 가능 |
| 단점 | 허들러스 의존성 계속 유지, 비용 중복, 스키마 drift 위험 |

### 옵션 C — 허들러스 프로젝트 유지 + 권한만 확보

현재 상태로 계속 가면서 허들러스에 서비스 계정 권한 지속 요청.

| 항목 | 내용 |
|---|---|
| 장점 | 구현 0 |
| 단점 | 권한 미부여 상태가 이미 수 주째, 근본 해결 아님. 허들러스 의사결정 종속성 유지 |

### 최종 권장

**옵션 A (새 Link) + 옵션 B 간단 복사** 혼합:
- A: 5/05 부터 자체 프로젝트에 export 시작
- B: 일회성으로 허들러스 `events_20260401~20260504` table 을 우리 프로젝트로 copy (과거 1개월치 확보)
- 1~2주 검증 후 Claude/백엔드를 자체 프로젝트로 전환. 허들러스 export 는 2026-06-01 에 요청 해제 (또는 유지 결정)

## 4. 사전 작업 체크리스트

### 사전 작업 1 — GCP 프로젝트 상태 점검

- [ ] `seo-aeo-487113` 프로젝트 billing 계정 연결 상태 (유료 쿼리 허용 위해)
- [ ] BigQuery API 활성화 여부 (`cloud.google.com/apis/library/bigquery.googleapis.com`)
- [ ] IAM — TJ 가 owner/editor, service account `seo-656` 이 `bigquery.dataViewer` + `bigquery.jobUser` 보유
- [ ] 기존 dataset 확인 — `analytics_326949178` (thecleancoffee) 는 이미 있음, 이 구조 참조

### 사전 작업 2 — GA4 측 권한 및 설정 확인

- [ ] biocom GA4 property `304759974` 에 TJ 가 "편집자" 이상 권한 (이미 보유)
- [ ] GA4 property → 데이터 스트림 → 웹 스트림 → BigQuery 연결 메뉴 접근 가능
- [ ] 현재 허들러스 프로젝트 연결 상태 확인 (이미 활성화된 Link 가 있는지)
- [ ] 신규 Link 추가 시 기존 Link 와 병존 가능한지 확인 (GA4 는 property 당 2개 link 까지 허용)

### 사전 작업 3 — 비용 예상

biocom 일 events 수:
- page_view ~수만/일
- purchase ~100~200/일
- 전체 이벤트 ~5만~10만/일 추정

월 storage:
- 약 1~3GB/월 예상
- Storage 비용: $0.02/GB/월 = 월 $0.02~0.06 (무시할 수준)

월 쿼리:
- 백엔드 freshness 체크 하루 1~2회 = 무료 tier 내
- 대시보드/수동 분석 쿼리 = on-demand $5/TB scanned, 대부분 무료 tier (1TB/월 free)

**예상 총 비용: 월 $1 미만**. 사실상 무시 가능.

### 사전 작업 4 — 데이터 모델 동등성 검증

- [ ] 기존 `hurdlers-naver-pay.analytics_304759974.events_*` 스키마 snapshot
- [ ] 새 link 후 `seo-aeo-487113.analytics_304759974.events_*` 와 동일 스키마 확인
- [ ] `user_pseudo_id`, `ga_session_id`, `event_params`, `traffic_source`, `collected_traffic_source`, `items` 배열 등 핵심 필드 존재 확인

### 사전 작업 5 — 백엔드 코드 교체 대상 파악

- `backend/src/sourceFreshness.ts` 의 `ga4_bigquery_biocom` dataset config → 새 프로젝트로 변경
- `backend/scripts/check-source-freshness.ts` 실행 경로 검증
- 앞으로 구현할 identity coverage 자동 쿼리들이 새 프로젝트 이름 사용

## 5. 실행 단계 (2026-05-05 기준)

### Day 0 (2026-05-04) — 사전 준비

1. [TJ] GCP Console 로 `seo-aeo-487113` 프로젝트 확인 — billing / BQ API / IAM 상태
2. [TJ] 허들러스 측에 "5/05 부터 자체 export 시작함. 허들러스 export 는 당분간 유지 요청" 공지
3. [Claude] 이 문서를 TJ 와 최종 검토 (실행 단계 확정)

### Day 1 (2026-05-05) — Link 생성

1. [TJ] GA4 Admin → biocom property 304759974 → 데이터 스트림 → 웹 스트림 `G-WJFXN5E2Q1` → BigQuery 연결 → 새 링크 → `seo-aeo-487113` 선택
2. [TJ] 이벤트 목록: "모든 이벤트" + Daily export + Streaming export 체크 (User ID 없이)
3. [TJ] 리전: US (허들러스와 동일) 또는 asia-northeast3 (한국 — 비용 저렴)
4. [Claude] 6~24시간 후 첫 daily table `events_20260506` 생성 확인 (2026-05-05 분)

### Day 2~7 (2026-05-06 ~ 12) — 검증 병행 기간

1. [Claude] `backend/sourceFreshness.ts` 에 `ga4_bigquery_biocom_seo_aeo` 신규 항목 추가 (기존 `hurdlers-naver-pay` 유지)
2. [Claude] 양쪽 dataset 동일 날짜 (예: 2026-05-06) 의 `events_*` 에서 event count, distinct user, purchase count 비교 쿼리 실행
3. [Claude] 검증 결과 일치하면 `/api/identity-coverage/*` 쿼리를 새 프로젝트로 교체 준비
4. [TJ] 2026-05-12 저녁에 검증 결과 검토 → Go/No-Go 결정

### Day 14 (2026-05-19) — 전환 완료

1. [Claude] 백엔드 `sourceFreshness.ts` 의 `ga4_bigquery_biocom` 기본값을 `seo-aeo-487113` 로 전환
2. [Claude] 기존 허들러스 참조 쿼리를 전부 자체 프로젝트로 교체
3. [TJ] 허들러스에 "자체 export 검증 완료. 허들러스 export 해제해도 무방" 통보 (또는 유지 요청)

### Day 30 (2026-06-04) — 과거 데이터 일회성 복사 (선택)

과거 분석이 필요하면 허들러스 export 해제 전에:

1. [TJ] 허들러스에 `analytics_304759974` dataset 의 월별 table 일회성 copy 허용 요청
2. [Claude] `bq cp` 명령으로 `events_20260101..events_20260504` 전체 → `seo-aeo-487113.analytics_304759974_backfill` 에 복사
3. storage 비용 추가 (수십 GB 예상, 월 $1~3)

## 6. 검증 쿼리 (병행 기간용)

### Q1. 양쪽 dataset 이벤트 수 일치 검증

```sql
-- 허들러스 쪽
SELECT 
  event_date, COUNT(*) AS events, 
  COUNTIF(event_name='purchase') AS purchase_events,
  COUNT(DISTINCT user_pseudo_id) AS distinct_users
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX = '20260506'
GROUP BY event_date;

-- 우리 쪽 (동일 날짜)
SELECT 
  event_date, COUNT(*) AS events, 
  COUNTIF(event_name='purchase') AS purchase_events,
  COUNT(DISTINCT user_pseudo_id) AS distinct_users
FROM `seo-aeo-487113.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX = '20260506'
GROUP BY event_date;
```

**기대**: 두 결과가 ±1% 이내 일치. purchase_events 는 0 차이가 이상적.

### Q2. 스키마 동등성 검증

```sql
SELECT column_name, data_type 
FROM `hurdlers-naver-pay.analytics_304759974.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name LIKE 'events_2026%'
ORDER BY ordinal_position;

-- 비교 대상
SELECT column_name, data_type 
FROM `seo-aeo-487113.analytics_304759974.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name LIKE 'events_2026%'
ORDER BY ordinal_position;
```

**기대**: 두 결과 완전 일치.

### Q3. vbank guard v137 효과 자동 집계 (전환 후)

```sql
-- 일자별 pay_method=vbank purchase events 추이
SELECT 
  event_date,
  COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') = 'vbank') AS vbank_purchase,
  COUNT(*) AS total_purchase
FROM `seo-aeo-487113.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260415' AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

**기대**: 2026-04-21 publish 이후 `vbank_purchase` 큰 폭 감소.

## 7. 리스크 / 롤백

### 리스크 1 — 허들러스가 허들러스 export 조기 해제

영향: 과거 데이터 일시 손실 가능. 대응: 병행 기간 동안 TJ 가 허들러스에 "5/19 까지 유지" 명시 확약받기.

### 리스크 2 — 스키마 drift

GA4 가 향후 스키마 변경 시 양쪽 dataset 동시 업데이트되어야 함. GA4 는 자동으로 반영하므로 원칙적으로 문제 없지만 link 시점 차이로 일부 필드 missing 가능.

대응: Q2 스키마 검증 쿼리를 주 1회 자동 실행.

### 리스크 3 — 비용 예상 초과

월 $1 미만 예상이지만 만약 쿼리 폭주 시 on-demand $5/TB 가 합산. 대응: BigQuery → `Reservation` 또는 `Flat-rate` 로 전환 고려 (월 $2000~ 수준이라 작은 팀은 불필요).

### 리스크 4 — 전환 후 데이터 품질 차이

만약 검증 쿼리에서 ±1% 이상 차이 발견 시 원인 조사 후 Link 재생성 또는 복구.

### 롤백

Day 14 이후라도 `sourceFreshness.ts` 의 reference 를 `hurdlers-naver-pay` 로 되돌리면 즉시 원복. 허들러스 export 가 유지되어 있어야 함.

## 8. 다음 할 일 연결

### Phase5-Sprint9 (NPay return 누락) 와의 관계

자체 프로젝트 전환 완료 후 NPay 비중 쿼리가 자동화됨:
```sql
SELECT ... FROM `seo-aeo-487113.analytics_304759974.events_*` ...
WHERE event_name IN ('add_payment_info', 'purchase') AND pay_method='npay'
```
백엔드 `/api/npay-coverage/summary` 같은 엔드포인트로 `/ads` 대시보드에 상시 표시 가능.

### C-Sprint 5 identity coverage 후속

`session_lost` / `raw_export_unknown` 원인 분해가 이번 이전으로 가능해짐. `identityCoverage.ts` 를 BigQuery 직연동으로 확장.

### Google Ads [248] 감사 (NPay 버튼 클릭을 purchase 로 기록 오염)

Google Ads Conversion Tracking API + BQ 조인으로 실제 결제완료 vs 버튼 클릭 비교 가능. 자체 프로젝트 전환 후 자동화.

## 9. 관련 문서

- [[../backend/src/sourceFreshness.ts|backend/src/sourceFreshness.ts]] — 이전 후 수정 대상
- [[!datacheckplan|data/!datacheckplan.md]] — Phase1-Sprint1 (원천 데이터) 에 업데이트 이력 추가
- [[../GA4/npay_return_missing_20260421|GA4/npay_return_missing_20260421.md]] — Phase5-Sprint9 자동화 대상
- [[../roadmap/confirmed_stopline|roadmap/confirmed_stopline.md]] C-Sprint 5 — identity coverage 확장
- [[../GA4/gtm|GA4/gtm.md]] — v137 효과 검증이 이 이전으로 자동화

## 10. TJ 결정 요청

| 질문 | 옵션 |
|---|---|
| 타이밍 | (a) 2026-05-05 권장 / (b) 더 빨리 / (c) 더 늦게 |
| 방식 | (a) 옵션 A + 일부 B / (b) 옵션 A 만 (과거 데이터 포기) / (c) 옵션 C (현상 유지) |
| 리전 | (a) US (허들러스 동일) / (b) asia-northeast3 (한국, 비용 최적) |
| 허들러스 export 유지 기간 | (a) 검증 후 해제 / (b) 영구 병행 (비용 미미) |

---

## 11. 사전 점검 자동 실행 결과 (2026-04-21 02:00 KST)

`backend/scripts/check-bq-migration-readiness.ts` 실행:

### 11-1. 자체 프로젝트 `seo-aeo-487113`

| 항목 | 상태 | 비고 |
|---|---|---|
| BigQuery API 활성화 | ✅ | datasets.list HTTP 200 |
| Cloud Resource Manager API | ❌ | 비활성. IAM 자동 조회 불가 — 활성화 선택 (별도 사전작업) |
| Service Account IAM 확인 | ⚠️ | 위 API 비활성으로 자동 확인 못 함 |
| 기존 dataset 개수 | **0** | — 중요한 발견 (§11-4) |

### 11-2. 허들러스 프로젝트 `hurdlers-naver-pay`

| 항목 | 상태 | 비고 |
|---|---|---|
| Service account `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 접근 | ❌ HTTP 403 | `bigquery.tables.list denied on dataset analytics_304759974` |
| TJ `biocomkr.sns@gmail.com` 접근 (수동) | ✅ | 2026-04-20 부여 확인됨 |

**결론**: service account 권한 미부여 상태 여전 — 이전 계획 실행 전 **(a) 허들러스에 service account 영구 권한 요청** 또는 **(b) 자체 Link 로 먼저 전환** 양자택일.

### 11-3. 스키마 동등성 자동 검증

❌ 불가. 허들러스 접근 거부로 `INFORMATION_SCHEMA.COLUMNS` 쿼리 실행 실패. TJ 가 BQ Console 에서 수동 실행하거나, 자체 Link 후 우리 쪽 schema 와 기존 thecleancoffee schema (같은 GA4 export 구조이므로) 비교로 대체 가능.

### 11-4. 🔍 thecleancoffee 실제 위치 재확인

`backend/src/sourceFreshness.ts:173` 확인:
```ts
projectId: "project-dadba7dd-0229-4ff6-81c"
dataset:   "analytics_326949178"
```

즉 **thecleancoffee 도 자체 프로젝트 `seo-aeo-487113` 가 아니라 GA4 가 자동 생성한 별도 프로젝트 `project-dadba7dd-0229-4ff6-81c` 에 존재**. 지금까지 `seo-aeo-487113` 프로젝트에는 GA4 raw export 가 **하나도 연결된 적 없음**.

**이전 계획 재검토**: 원래 §3 옵션 A 는 `seo-aeo-487113` 에 새 Link 를 가정했으나, 실제로는 3가지 선택지가 있음:

| 선택지 | 내용 | 장단점 |
|---|---|---|
| **A-0 (권장)** | biocom 도 `project-dadba7dd-0229-4ff6-81c` 에 Link 추가 — coffee 와 **같은 프로젝트** | 가장 가벼운 이전. 기존 thecleancoffee 집계 코드 재사용. service account 가 이미 coffee 에 권한 있다면 즉시 가능 |
| A-1 | `seo-aeo-487113` 에 biocom + coffee 모두 Link — 프로젝트 단일화 | coffee 도 재link 필요. 과거 데이터 없음 리스크 2배 |
| A-2 | `seo-aeo-487113` 에 biocom 만 Link (원래 §3 안) | 프로젝트 분리 유지. Link 2곳 관리 |

**Claude 권장**: **A-0**. 근거 2가지:
1. coffee 와 biocom 이 같은 project 에 있으면 cross-site 조인 쿼리 단순
2. 이미 `ga4_bigquery_thecleancoffee` 가 동작 중이므로 service account 권한 configuration 재사용 가능

단 GA4 자동 생성 프로젝트 `project-dadba7dd-0229-4ff6-81c` 의 billing / 쿼터 확인 필요 — thecleancoffee link 만 있는 상태에서 biocom 추가 시 용량 2배로 증가.

### 11-5. 실행 우선순위 재정렬

1. **TJ 결정 필요 (2026-04-22)**: 선택지 A-0 / A-1 / A-2 중 선택
2. **Claude 지금 가능한 것**:
   - Cloud Resource Manager API 활성화 (자체 프로젝트) — TJ 수동 또는 gcloud
   - TJ 에게 `project-dadba7dd-0229-4ff6-81c` 현재 billing 상태 + IAM 확인 요청
3. **TJ 수동 확인 필요**:
   - GA4 property 304759974 → 데이터 스트림 → BigQuery 연결 메뉴 → 기존 link 확인 (허들러스만 있는지)
   - GA4 가 제공하는 connect-able 프로젝트 목록에 `project-dadba7dd-0229-4ff6-81c` / `seo-aeo-487113` 둘 다 뜨는지 (권한 있어야 뜸)
4. **타이밍**: 사전 조사 완료 → 2026-05-05 에 실제 Link 생성 일관

## 버전 기록

- **v2** (2026-04-21 02:00 KST): §11 사전 점검 자동 실행 결과 추가. thecleancoffee 실제 위치가 `project-dadba7dd-0229-4ff6-81c` 임을 재확인 → 선택지 3개 (A-0/A-1/A-2) 추가. **A-0 권장** (biocom 도 coffee 와 같은 프로젝트). TJ 결정 사항 2026-04-22 로 앞당김.
- **v1** (2026-04-21 01:50 KST): 최초 작성. 타이밍 2026-05-05 권장 + 옵션 A (신규 Link) + 과거 데이터 일회성 복사 혼합안 제시. 사전 작업 5개, 실행 단계 4단계, 검증 쿼리 3개, 리스크 4개 정리.
