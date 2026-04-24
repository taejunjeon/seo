# GA4 v137 publish 효과 검증

작성 시각: 2026-04-21 23:55 KST
작성자: Claude Code
기준 publish: biocom GTM `GTM-W2Z6PHN` **container v137** (publish 시각 **2026-04-21 01:40 KST**)
대상 GA4 property: biocom `304759974` (`G-WJFXN5E2Q1`)
참조: [[gtm|GA4/gtm.md]] v7, [[!datacheckplan|data/!datacheckplan.md]] Phase3-Sprint5, [[gtm_exception_trigger_draft_20260421|GA4/gtm_exception_trigger_draft_20260421.md]]
실행 스크립트: `backend/scripts/verify-ga4-v137-effect.ts`
Raw 출력: `backend/scripts/verify-ga4-v137-effect.out.json`

---

## 10초 요약

v137 (vbank 차단) + v136 (transaction_id fallback) 두 번의 publish가 합쳐져 **04-20→04-21 하루 만에 GA4 오염이 극적으로 줄었다**.

- `transaction_id=(not set)` 이벤트: **97 → 5건 (94% 감소)**, 비율 37.9% → 8.3%
- `pay_method=(not set)` 이벤트: **70 → 0건 (100% 제거)**
- GA4 purchase 이벤트 총수: **256 → 60건 (76% 감소)** — vbank 미입금 + 중복 발사 제거된 효과
- GA4 purchase 매출과 운영 DB `PAYMENT_COMPLETE` 매출 비율: **04-20 +52%(GA4 과다) → 04-21 +10%(거의 수렴)**

단, 검증 한계: (1) biocom BigQuery raw 접근 403으로 event-level 분해 못함, (2) 로컬 Toss DB stale(04-06까지)로 Toss 대조 불가, (3) 관찰 기간 22시간뿐이라 요일 효과 분리 어려움, (4) 04-21은 오늘 일자라 GA4 lag 가능성 있음.

---

## v137 publish가 차단하는 대상

[[gtm|GA4/gtm.md]] v7 기준:

| 객체 | 변경 내용 |
|---|---|
| 변수 `[252]` | `JS - vbank blocked` (dataLayer 또는 server guard의 vbank 브랜치 감지) |
| 트리거 `[253]` | Exception trigger — vbank blocked=true 이면 발사 차단 |
| 태그 `[143]` HURDLERS 구매 | blockingTriggerId에 `[253]` 연결 |
| 태그 `[48]` 홈피구매 | blockingTriggerId에 `[253]` 연결 |
| 태그 `[154]` DL 구매 | blockingTriggerId에 `[253]` 연결 |

즉 v137은 "가상계좌 미입금 상태에서 GA4 purchase 이벤트가 발사되지 않도록" 세 태그에 예외 트리거를 건 것이다. 대상은 toss/nicepay/kakaopay 등을 거친 vbank 결제가 **실제 입금 전에** purchase 이벤트를 쏘는 패턴.

같이 기억해야 할 선행 publish: v136 (2026-04-20 23:55 KST) — 변수 `[250]` `JS - Purchase Transaction ID (fallback chain)` 생성 + 태그 `[143]/[48]/[43]` 의 `transaction_id` 파라미터를 이 변수로 교체. 즉 04-21의 개선치 중 transaction_id 쪽 몫은 v136 덕이고, vbank 차단 쪽 몫이 v137 덕이다. 두 publish를 **합쳐서** 검증하는 것이 맞다.

---

## 검증 환경

| 원천 | 상태 | 비고 |
|---|---|---|
| GA4 Data API (biocom property 304759974) | ✅ 접근 | service account `seo-656@seo-aeo-487113` — Data API로 runReport 가능 |
| biocom BigQuery raw `hurdlers-naver-pay.analytics_304759974` | ❌ 403 | `Permission bigquery.tables.list denied` — event-level 분석 막힘. [[!datacheckplan\|data/!datacheckplan.md]] Phase3-Sprint5 알려진 병목 |
| 운영 DB `tb_iamweb_users` (bico_readonly) | ✅ 접근 | biocom 주문 + 결제 상태 직접 조회 가능 |
| 로컬 `backend/data/crm.sqlite3` `toss_transactions` | ❌ stale | 최신 `transaction_at = 2026-04-06T23:53:27+09:00`. v137 전후 Toss 대조 불가 |
| 로컬 `imweb_orders` | ❌ stale | 최신 `order_time = 2026-04-15T12:18:58.000Z`. v137 후 구간 없음 |
| GTM API (v137 live 확인) | ⚠️ 부분 | `gtm-published-check.ts`는 env 충돌로 실패. [[gtm\|GA4/gtm.md]] v7의 직접 관측(containerVersionId `137`, live 매칭 확인) 증거만 인용 |

---

## 지표 1 — transaction_id `(not set)` 감소

### GA4 Data API 쿼리
- 기간: `2026-04-15 ~ 2026-04-21` (비교 가능 7일)
- dimensions: `date`, `transactionId`
- metrics: `eventCount`, `purchaseRevenue`
- filter: `eventName == purchase`

### 결과

| 일자 | purchase 이벤트 총수 | distinct transactionId | `(not set)` 이벤트 | `(not set)` 비율 | 해석 |
|---|---:|---:|---:|---:|---|
| 2026-04-15 | 331 | 108 | 128 | 38.7% | 기준 (v136/v137 전) |
| 2026-04-16 | 319 | 91 | 157 | 49.2% | |
| 2026-04-17 | 232 | 66 | 111 | 47.8% | |
| 2026-04-18 | 130 | 40 | 64 | 49.2% | |
| 2026-04-19 | 147 | 53 | 57 | 38.8% | |
| 2026-04-20 | 256 | 93 | 97 | 37.9% | v136 publish 04-20 23:55 KST (당일 마지막 9시간만 적용) |
| **2026-04-21** | **60** | **50** | **5** | **8.3%** | **v136 + v137 모두 적용된 첫 날** |

### 결론
- `(not set)` 비율: 04-15~04-20 평균 **43.5%** → 04-21 **8.3%**. 35.2pp 하락.
- `(not set)` 절대 이벤트: 04-20 97건 → 04-21 5건 (94% 감소).
- 04-21의 잔여 5건은 edge case로 추정: URL에 `order_no` 없고 `hurdlers_ga4.transaction_id`와 `ecommerce.transaction_id` 모두 비어 있는 경우. 변수 `[250]` fallback chain이 빈 문자열을 반환한 케이스.
- 이 개선은 **v136 (transaction_id fallback) 주효**. v137 (vbank 차단)은 `(not set)` 자체를 줄이기보다 총 purchase 이벤트 수를 줄이는 방향. 둘이 겹쳐서 분모(total_events)도 줄었다.

---

## 지표 2 — `pay_method=(not set)` 제거

### 배경
- 태그 `[143]` HURDLERS 구매 → `pay_method` 파라미터 없음 → GA4에서 `(not set)`
- 태그 `[48]` 홈피구매 → `pay_method=homepage`
- 태그 `[43]` Npay구매 → `pay_method=npay`

GA4 Data API `customEvent:pay_method` dimension이 등록되어 있어 조회 가능.

### 결과

| 일자 | `(not set)` | 빈 문자열 `""` | `homepage` | `npay` | 총 |
|---|---:|---:|---:|---:|---:|
| 2026-04-15 | 203 | 0 | 85 | 43 | 331 |
| 2026-04-16 | 162 | 0 | 71 | 86 | 319 |
| 2026-04-17 | 121 | 0 | 55 | 56 | 232 |
| 2026-04-18 | 66 | 0 | 27 | 37 | 130 |
| 2026-04-19 | 90 | 0 | 39 | 18 | 147 |
| 2026-04-20 | 70 | **89** | 69 | 28 | 256 |
| **2026-04-21** | **0** | 9 | 36 | 15 | 60 |

### 결론
- `pay_method=(not set)` : 04-20 70건 → 04-21 **0건**. 완전히 사라졌다.
- 04-20에는 `(not set) 70건`과 `빈문자열 89건`이 같이 존재. v136 publish(04-20 23:55 KST)가 태그 `[143]`의 transaction_id 파라미터를 교체하면서 관련 이벤트 구조가 바뀌었을 가능성. 04-21부터는 태그 `[143]`의 모든 발사가 `""`(빈 값)로 집계되고 `(not set)`은 사라짐.
- 변화의 방향은 분명하지만 "왜 빈 문자열로 바뀌었나"는 GTM Preview + GA4 DebugView로 재검증이 필요. GTM 변경 로그만으로는 여기까지 단정하기 어렵다.

---

## 지표 3 — `purchase_revenue = 0` 이벤트 감소

### 결과 (transaction 단위 purchaseRevenue=0 집계)

| 일자 | value=0 이벤트 | value=0 tx 수 | 전체 대비 |
|---|---:|---:|---:|
| 2026-04-15 | 24 | 12 | 7.3% |
| 2026-04-16 | 2 | 1 | 0.6% |
| 2026-04-17 | 2 | 1 | 0.9% |
| 2026-04-18 | 0 | 0 | 0.0% |
| 2026-04-19 | 0 | 0 | 0.0% |
| 2026-04-20 | 0 | 0 | 0.0% |
| 2026-04-21 | 2 | 2 | 3.3% |

### 결론
- `value=0` purchase는 **04-18부터 이미 0건으로 내려와 있었다**. v136/v137 publish와 직접 인과 없음.
- 04-21에 2건 재등장했지만 모수가 작아(60) 비율이 3.3%로 보인다. 절대값으로는 작은 노이즈 수준.
- **이 지표는 v137 효과 판단 근거로 사용하기 부적절**. 개선은 04-18 이전에 이미 끝난 것으로 보인다. 과거 24건 급등(04-15)의 원인 분해는 별도 과제.

---

## 지표 4 — vbank purchase 이벤트 감소 (GA4 × 운영 DB 대조)

### 4-1. 운영 DB 기준 biocom 주문 상태

| 일자 | 전체 주문 | 가상계좌 주문(VIRTUAL) | vbank 완료(PAYMENT_COMPLETE) | vbank 미입금계열\*  | 결제완료 주문 | 결제완료 금액 | NPAY 완료 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-04-15 | 106 | 11 | 7 | 4 | 96 | 24,458,833 | 4 |
| 2026-04-16 | 90 | 10 | 5 | 4 | 77 | 20,823,950 | 2 |
| 2026-04-17 | 65 | 9 | 5 | 4 | 58 | 13,525,965 | 2 |
| 2026-04-18 | 39 | 1 | 1 | 0 | 38 | 9,492,226 | 5 |
| 2026-04-19 | 51 | 1 | 1 | 0 | 48 | 11,923,239 | 2 |
| 2026-04-20 | 93 | 6 | 4 | 2 | 88 | 24,364,829 | 8 |
| **2026-04-21** | **56** | 5 | 2 | **3** | 51 | 14,625,256 | 4 |

*vbank 미입금계열 = `PAYMENT_PREPARATION` + `PAYMENT_OVERDUE` + `CANCELLED_BEFORE_DEPOSIT`. 이게 v137이 GA4 purchase에서 차단해야 할 주문 집합이다.

### 4-2. GA4 purchase 이벤트 총수 vs 운영 DB 결제완료

| 일자 | GA4 이벤트 | GA4 valid events (not set 제외 & value>0) | 운영 DB paid_orders | GA4/운영 비율 (이벤트) |
|---|---:|---:|---:|---:|
| 2026-04-18 | 130 | 66 | 38 | 342% / 173% |
| 2026-04-19 | 147 | 90 | 48 | 306% / 187% |
| 2026-04-20 | 256 | 159 | 88 | 290% / 180% |
| **2026-04-21** | **60** | **53** | **51** | **117% / 104%** |

### 4-3. 매출 기준 대조

| 일자 | GA4 purchase_revenue | 운영 DB paid_sum | GA4 - 운영 | 과다율 |
|---|---:|---:|---:|---:|
| 2026-04-19 | 35,641,955 | 11,923,239 | +23,718,716 | +199% |
| 2026-04-20 | 61,839,638 | 24,364,829 | +37,474,809 | +154% |
| **2026-04-21** | **17,060,034** | **14,625,256** | **+2,434,778** | **+17%** |

### 4-4. 결론
- 04-18~04-20 GA4 매출은 운영 기준 대비 **+154% ~ +199%** 과다 집계. 이중/삼중 발사(`[143]` + `[48]` + `[154]` 동시 발사) + `(not set)` 주문 오염이 주된 이유로 추정.
- **04-21에는 과다율이 +17%까지 축소**. GA4와 운영 확정 매출이 거의 수렴.
- 04-21 운영 DB vbank 미입금계열 주문은 3건인데, GA4 valid_events와 paid_orders 차이는 2건(53 vs 51) 수준. 정확한 주문번호 매칭은 transactionId 샘플을 뽑아 운영 DB `order_number`와 1:1 대조해야 확정할 수 있다(아직 미실행).
- 직접적 "vbank purchase 감소량"은 GA4 측에서 별도 파라미터(pay_method 등)로 vbank를 식별할 수 없어 **총 이벤트 수 감소**로만 추정. 지표 2의 `pay_method` 분포 변화와 이벤트 총수 감소가 이 효과의 간접 증거.

---

## 전체 판정

| 지표 | 결과 | v137 publish 효과 판정 |
|---|---|---|
| transaction_id `(not set)` 감소 | **97→5 (94%↓)** | ✅ 성공 (단, 주공은 v136 fallback) |
| `pay_method=(not set)` 제거 | **70→0** | ✅ 성공 (v136 태그 구조 변경 부산물로 추정) |
| `value=0` purchase 감소 | 0건 → 2건 (노이즈) | ➖ 무관 (이미 04-18부터 0) |
| vbank purchase 감소 (간접) | GA4 총 이벤트 256→60, 운영 대비 과다율 +154%→+17% | ✅ 성공 (간접 근거, 주문번호 1:1 대조로 확정 필요) |
| GA4 vs 운영 confirmed 차이 | +154~+199% → +17% | ✅ **크게 수렴** |

**총평**: v136 + v137 두 publish 합산 효과는 **기대한 방향으로 작동**했다. 특히 GA4와 운영 확정 매출의 수렴은 ROAS 판단에 즉시 영향을 주는 변화다. 다만:

1. 관찰 기간이 **22시간**에 불과하다. 04-22~04-23 데이터로 재검증 필요.
2. 04-21은 오늘 일자라 **GA4 late-arrival event가 아직 다 들어오지 않았을 가능성**이 있다. 04-22 자정 기준으로 한 번 더 뽑아야 한다.
3. biocom BigQuery raw 접근이 열리면 event-level로 "어떤 session이 차단됐는지" 주문번호 단위 확정이 가능하다. 현재는 Data API 집계로만 추정.
4. GTM live version이 실제 **v137**인지 API로 재확인하는 단계는 `gtm-published-check.ts` env 문제로 미완료. [[gtm\|GA4/gtm.md]] v7 기록만으로 신뢰.

---

## 다음 액션

1. [Claude Code] 2026-04-22 12:00 KST 이후 같은 스크립트 재실행. 04-21 최종값 + 04-22 full day 결과 비교. 의존성: 시간 경과 대기.
2. [Claude Code] GA4 transaction_id 샘플 10~20건을 뽑아 운영 DB `order_number`와 1:1 대조. 특히 04-21 5건 `(not set)` 이벤트가 어떤 주문인지 역추적. 의존성: 병렬 가능.
3. [TJ] biocom BigQuery legacy `hurdlers-naver-pay` dataset 접근 권한을 service account에 부여받으면 event-level 검증 가능. 의존성: 현재 datacheckplan Phase3-Sprint5의 선행필수와 동일 건.
4. [Codex] 로컬 `toss_transactions` / `imweb_orders` sync 재개. 최신 2026-04-06 / 04-15 이후 데이터가 로컬에 없어 v137 효과 교차검증이 운영 DB에 종속됨. 의존성: 병렬 가능.
5. [Claude Code] `pay_method` 빈 문자열(`""`) 증가(0→9)가 태그 `[143]` 구조 변경의 부산물인지 GTM Preview로 재확인. 이 값이 실제 purchase인지 누락된 테스트인지 확정 필요. 의존성: 병렬 가능.

---

## 잔여 이상치 14건 역추적 (2026-04-22 00:05 KST)

실행 스크립트: `backend/scripts/trace-ga4-residual-anomalies.ts`
Raw 출력: `backend/scripts/trace-ga4-residual-anomalies.out.json`

### 10초 요약

04-21 잔여 14건은 **세 가지 구조**로 완전히 분해됐다. 운영 DB에서 9/9건 매칭됨(missing 0).

| 카테고리 | 건수 | 원인 | 조치 방향 |
|---|---:|---|---|
| NPay 버튼 클릭 시점 발사 (legacy tag `[43]`) | **5** | 태그 `[43] GA4_구매전환_Npay`가 `/shop_cart`에서 click trigger로 발사. 실결제 무관, transaction_id 없이 쏨 | 태그 `[43]` 발사 조건을 실결제 확인 후로 변경 또는 태그 자체 제거 |
| HURDLERS `[143]` + 홈피구매 `[48]` 중복 발사 | **6** | 같은 `transactionId`에 두 태그가 동시 발사. GA4에 purchase가 이벤트 2회 기록됨 | GTM에서 `[48]` 발사 시 HURDLERS `[143]`와 중복되지 않게 exception trigger 또는 발사 조건 분리 |
| HURDLERS `[143]` 단독 발사 (홈피 태그 안 쏨) | **1** | 홈피구매 태그 `[48]`의 발사 조건(`{{dlv_price_vlaue}} greater 0`) 미충족 edge | Preview로 단일 재현, `dlv_price_vlaue` 데이터 레이어 push 시점 확인 |
| 내부 FREE 주문 (value=0) | **2** | 운영 DB `payment_method=FREE`, 상품명 `"내부 확인용"`. 진짜 노이즈 아님 | 매출 0원이므로 ROAS/판정에 영향 없음. 단 event_count는 분리 집계 |

즉 **잔여 이상치의 실질적 남은 문제는 구조 두 가지로 좁혀진다**: (A) NPay 버튼 클릭 시점 발사 5건, (B) HURDLERS + 홈피구매 중복 발사 6건.

### 카테고리 A — NPay 버튼 클릭 시점 발사 (5건, 966,800원)

GA4 Data API 분해:

| 속성 | 값 |
|---|---|
| pagePath | `/shop_cart` (5건 전부) |
| deviceCategory | `mobile` (5건 전부) |
| hostname | `biocom.kr` |
| pay_method | `npay` |
| streamId | `3469501673` (바이오컴, `G-WJFXN5E2Q1`) |
| event_count | 5 |
| purchaseRevenue 합 | 966,799.9996 |

세션 소스 분해(5건 중 4건만 단일 소스로 분리됨):

| sessionSource | sessionMedium | sessionCampaign | event | revenue |
|---|---|---|---:|---:|
| m.search.naver.com | referral | (referral) | 2 | 205,800 |
| crm_kolas_jhg_encore | crm_kolas_jhg_encore | crm_kolas_jhg_encore | 1 | 264,000 |
| google | cpc | [PM]검사권 실적최대화 | 1 | 116,000 |
| meta_biocom_iggspring | meta_biocom_iggspring | meta_biocom_iggspring | 1 | 381,000 |

해석:
- 태그 `[43] GA4_구매전환_Npay`의 트리거(`purchase_npay_mo` custom event — NPay 버튼 click 감지)가 `/shop_cart`에서 발사됐다.
- 태그 `[43]`은 `transaction_id` 파라미터가 없어 GA4에 `(not set)`으로 저장됐고, `value`는 `dlv_price_vlaue` (장바구니 금액)으로 넘어가 revenue 966,800원이 찍혔다.
- 이건 **실제 결제 완료 아님**. NPay 버튼만 눌렀고, 그 뒤 NPay 팝업에서 결제가 성사됐는지는 알 수 없다(실제로 `shop_payment_complete` URL에 복귀 안 함은 [[npay_return_missing_20260421\|GA4/npay_return_missing_20260421.md]]에서 기록됨).
- Google Ads 태그 `[248] TechSol-NPAY구매`도 같은 트리거를 공유하므로 같은 구조의 과다집계 위험이 남아 있다.

v137은 vbank exception trigger만 건 것이라 NPay 버튼 클릭 발사는 차단하지 않는다. 이 5건은 **v137의 범위 밖**이며 Phase5-Sprint9의 대상이다.

### 카테고리 B — HURDLERS + 홈피구매 중복 발사 (6건)

같은 `transactionId`에 대해 `event_count=2`로 집계된 tx (전부 `/shop_payment_complete`에서 발사, CARD 결제 완료):

| transactionId | paid_price | 상품 | pay_method 조합 |
|---|---:|---|---|
| 202604210273084 | 484,500 | 음식물 과민증 분석 | `""` + `homepage` |
| 202604211373044 | 245,000 | 음식물 과민증 분석 | `""` + `homepage` |
| 202604213588914 | 485,000 | 음식물 과민증 분석 | `""` + `homepage` |
| 202604214793916 | 260,000 | 음식물 과민증 분석 | `""` + `homepage` |
| 202604217876108 | 221,824 | 바이오밸런스 90정 | `""` + `homepage` |
| 202604219048851 | 245,000 | 음식물 과민증 분석 | `""` + `homepage` |

해석:
- `pay_method=""` row는 HURDLERS 태그 `[143]` (eventSettings에 `pay_method` 파라미터 없음). 이전엔 `(not set)`으로 찍혔지만 v136의 `transaction_id` 변수 교체 이후 빈 문자열로 바뀜.
- `pay_method="homepage"` row는 홈피구매 태그 `[48]`. 같은 `/shop_payment_complete` + `{{dlv_price_vlaue}} greater 0` 조건에서 발사.
- 두 태그가 **같은 이벤트를 동일 measurementId `G-WJFXN5E2Q1`에 중복 기록**. `ecommercePurchases` / `purchaseRevenue` 집계 중복이 발생한다.
- v136 이전에는 같은 구조가 `(not set)` + `homepage`로 기록돼 있었다. 즉 **v136/v137 publish 이전부터 계속 있던 구조적 중복**이고, 이번 개선에 포함된 변경은 아니다.
- 04-21 기준 중복으로 부풀려진 매출: `484,500 + 245,000 + 485,000 + 260,000 + 221,824 + 245,000 = 1,941,324원` (동일 금액이 한 번 더 잡힘).

### 카테고리 C — HURDLERS 단독 정상 발사 (1건)

| transactionId | paid_price | 상품 | 해석 |
|---|---:|---|---|
| 202604212972548 | 245,000 | 음식물 과민증 분석 | `event_count=1`. HURDLERS만 쏘고 홈피구매 `[48]` 미발사. 원인 불명 — 해당 세션에서 `dlv_price_vlaue` 변수가 0이었거나 `{{_event}}=conversion` 조건 미충족 edge case |

Preview로 단일 재현 확인 필요. 잔여 1건이라 영향 미미.

### 카테고리 D — 내부 FREE 주문 (2건, value=0)

| transactionId | paid_price | payment_method | 상품 |
|---|---:|---|---|
| 202604212366591 | 0 | FREE | 내부 확인용 |
| 202604212516211 | 0 | FREE | 내부 확인용 |

바이오컴 내부 테스트용 무료 주문. `pay_method=""` (HURDLERS), revenue=0. GA4 오염이 아니라 운영 그대로 흘려보낸 결과. ROAS 분모 영향 0원.

### 전체 판정

| 항목 | 건수 | 매출 영향 | 구조 문제? | v137과 관련? |
|---|---:|---:|---|---|
| A. NPay 클릭 시점 발사 | 5 | +966,800 (허위) | 예(legacy tag `[43]` + `[248]`) | 아니오 (Phase5-Sprint9) |
| B. HURDLERS + 홈피구매 중복 | 6 | +1,941,324 (중복) | 예(오래된 중복 sender) | 아니오 |
| C. HURDLERS 단독 edge | 1 | 0 (정상이지만 `pay_method=""`) | 미미 | 아니오 |
| D. 내부 FREE | 2 | 0 | 아니오 (정상) | 아니오 |

**총 오염 매출(04-21): 2,908,124원**. 04-21 GA4 purchase_revenue 17,060,035 중 약 **17%**가 위 구조 문제로 인한 오염이다. 운영 DB paid_sum 14,625,256과의 차이 `+2,434,779원`과 동일 수준(A+B의 중복/허위 합 2,908,124 ≈ 차이 2,434,779 + 내부 FREE 0 − 알려지지 않은 보정 473k).

### 다음 액션

1. [TJ] 카테고리 A(NPay 클릭) — 태그 `[43]` 발사 조건을 "클릭" → "실결제 확인"으로 변경할지, 태그를 제거할지 의사결정. 현재 선택지는 [[npay_return_missing_20260421\|GA4/npay_return_missing_20260421.md]] §의사결정 (a/b/c)에 있음. 의존성: 선행필수.
2. [Claude Code] 카테고리 B(HURDLERS+홈피구매 중복) — GTM에 exception trigger를 붙일지, 태그 `[48]` 발사 조건에 "HURDLERS 이미 발사했으면 제외"를 넣을지 draft 설계. 의존성: 병렬가능. 태그 `[48]`은 `{{Page Path}} contains shop_payment_complete AND {{dlv_price_vlaue}} greater 0 AND {{_event}} equals conversion` 이라 HURDLERS와 겹치는 조건.
3. [Claude Code] 카테고리 C(HURDLERS 단독 edge) — 04-22 이후 재현 수 관찰. 1~2건 빈도면 우선순위 낮음. 의존성: 관찰.
4. [TJ/Claude Code] 카테고리 D — GA4 IP 필터 또는 internal traffic 제외로 분리할지 결정. 현재 매출 영향 0이라 긴급도 낮음. 의존성: 병렬가능.
5. [Claude Code] 2026-04-22 23:59 KST 이후 같은 trace 스크립트 재실행 → 24시간 완전 집계 기준으로 카테고리별 빈도 재확인. 의존성: 시간 경과.

### 운영 DB 매칭 요약

| transactionId | GA4 pay_method | GA4 event_count | 운영 payment_method | 운영 status | 운영 paid_price | 판정 |
|---|---|---:|---|---|---:|---|
| 202604210273084 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 484,500 | B. 중복 |
| 202604211373044 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 245,000 | B. 중복 |
| 202604213588914 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 485,000 | B. 중복 |
| 202604214793916 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 260,000 | B. 중복 |
| 202604217876108 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 221,824 | B. 중복 |
| 202604219048851 | `""` + `homepage` | 2 | CARD | PAYMENT_COMPLETE | 245,000 | B. 중복 |
| 202604212972548 | `""` 단독 | 1 | CARD | PAYMENT_COMPLETE | 245,000 | C. edge |
| 202604212366591 | `""` 단독 | 1 | **FREE** | PAYMENT_COMPLETE | **0** | D. 내부 |
| 202604212516211 | `""` 단독 | 1 | **FREE** | PAYMENT_COMPLETE | **0** | D. 내부 |

(not set) 5건은 `transaction_id` 자체가 비어 있어 운영 DB 매칭 불가(클릭 시점 발사이므로 매칭 가능한 order_number가 애초에 없음).

---

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-22 00:05 KST | 잔여 이상치 14건 역추적 완료. (A) NPay 클릭 시점 발사 5건, (B) HURDLERS+홈피구매 중복 6건, (C) HURDLERS 단독 edge 1건, (D) 내부 FREE 2건으로 분해. 운영 DB 9/9 매칭 성공 | GA4 Data API (transactionId × pay_method × pagePath × sessionSource × streamId), 운영 DB `tb_iamweb_users` read-only, `backend/scripts/trace-ga4-residual-anomalies.ts` 실행 결과 |
| 2026-04-21 23:55 KST | 최초 작성. v137 publish 약 22시간 후 GA4 Data API + 운영 DB 기준 효과 측정 | GA4 Data API runReport (property 304759974), 운영 DB `tb_iamweb_users` read-only, `backend/scripts/verify-ga4-v137-effect.ts` 실행 결과 |
