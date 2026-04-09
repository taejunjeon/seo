# 더클린커피 데이터 구조 및 현황

> **기준일**: 2026-04-04
> **사이트**: thecleancoffee.com (아임웹)
> **site 코드**: `thecleancoffee`

---

## 한 줄 요약

더클린커피는 **6개 데이터 소스**(아임웹, Toss, 플레이오토, GA4, 로컬 SQLite, 운영 DB)에 주문/회원/정산 데이터가 흩어져 있다. 현재 로컬 DB에 회원 13,236명 + 주문 1,150건이 sync 돼 있고, 재구매 후보 API + GA4 접근까지 가동 중이다.

> **문서 역할 분리**: 이 문서(`coffeedata.md`)가 **현재 기준 문서(Source of Truth)**. 조사 과정 기록은 `coffee.md`(Research Log)를 본다.

---

## 1. 데이터 소스별 현황

### 1-1. 아임웹 API (`imweb.ready=true`)

| 항목 | 값 | 비고 |
|------|-----|------|
| 회원 수 | **13,236명** | 로컬 sync 완료 |
| SMS 동의 | 확인 필요 (전체 47.5%) | 사이트별 분리 조회 가능 |
| 주문 수 | **1,150건** | 2025-12-30 ~ 2026-04-02 |
| 주문 합계 | **₩50,010,084** | 결제 금액 기준 |
| 마지막 sync | 2026-04-02 06:10:27 | `POST /api/crm-local/imweb/sync-orders` |

**API 엔드포인트:**
- `GET /v2/member/members` — 회원 목록 (consent 포함)
- `GET /v2/shop/orders` — 주문 목록
- 인증: API Key + Secret Key → access token 발급

**데이터 구조 (imweb_orders 테이블):**
```
order_key, site, order_no, order_code, order_type, order_time, complete_time,
member_code, orderer_call, pay_type, pg_type,
total_price, payment_amount, coupon_amount, delivery_price
```

**제한:**
- 아임웹 API는 페이지당 100건, rate limit 있음 (전체 sync에 3~10분)
- 2025년 이전 주문은 아임웹 API에서 조회 제한될 수 있음

---

### 1-2. Toss Payments (`toss.ready=true`)

| 항목 | 값 | 비고 |
|------|-----|------|
| 커피 MID | `iw_thecleaz5j` | 바이오컴(`iw_biocomo8tx`)과 별도 |
| 확보 기간 | 2026-01-01 ~ 2026-02-23 | **2025년 데이터 없음** |
| 확보 건수 | **687건** | `tb_sales_toss` store='coffee' |
| 확보 금액 | **₩31,182,667** | 취소 ₩858,320 별도 |
| 평균 수수료율 | 3.48% | 정산 데이터 기준 |

**현재 바이오컴 MID 기준 Toss 데이터 (최근 7일):**
- 3/28: 32건 / ₩9,521,510
- 3/29: 50건 / ₩12,451,075
- 3/30: 18건 / ₩707,412 (취소 8건 포함)

**주의:** 위 데이터는 바이오컴 MID 기준이므로, 더클린커피 전용 조회를 위해서는 `TOSS_SECRET_KEY_COFFEE` 설정이 필요함. revenue 코드에 슬롯은 있으나 seo 백엔드에는 아직 미연동.

**API 엔드포인트 (가동 중):**
- `GET /api/toss/transactions` — 거래 내역
- `GET /api/toss/settlements` — 정산 내역
- `GET /api/toss/payments/orders/:orderId` — 주문 상세
- `GET /api/toss/daily-summary` — 일별 요약
- `POST /api/toss/sync` — 로컬 캐시 sync

---

### 1-3. 플레이오토 (`playauto.ready=true`)

| 항목 | 값 | 비고 |
|------|-----|------|
| 운영 DB 데이터 | **115,316건** | `tb_playauto_orders` |
| 쇼핑몰 수 | 10개 | 다중 쇼핑몰 통합 |
| 주문 상태 유형 | 14종 | |
| 스키마 테이블 | 28개 | `playauto_platform` 스키마 |

**활용 현황:**
- 2025년 재구매 빈도 분석의 **보조 데이터 소스**로 사용 중
- revenue 백엔드에 전용 API 있음 (`app/api/playauto_orders.py`)
- seo 백엔드에는 자격증명만 설정, 전용 라우트 없음

**데이터 품질 주의:**
- 배송비 0원 행이 다수 포함 → 주문 건수가 실제보다 부풀어 보임
- 묶음 배송 기반 카운팅 → 실제 주문 수와 불일치
- 전화번호 기반 고객 식별이 불안정

---

### 1-4. 로컬 SQLite DB (`backend/data/crm.sqlite3`) — 0404 전체 sync 반영

| 테이블 | 건수 | 용도 | 기간 |
|--------|------|------|------|
| `imweb_members` | **13,452건** (커피) | 회원 + consent + **birth** | 전체 |
| `imweb_orders` | **1,937건** (커피) | 주문 이력 | **2025-12-30 ~ 2026-04-04** |
| `toss_transactions` | 33,603건 (전체) | Toss 거래 캐시 | 2025-01 ~ 2026-03 |
| `toss_settlements` | 1,567건 (전체) | Toss 정산 캐시 | |

**재구매 분석 결과 (0404 전체 sync 후):**

| 지표 | 이전 (부분 sync) | 현재 (전체 sync) |
|------|----------------|----------------|
| 주문 수 | 1,150건 | **1,937건** |
| 매출 합계 | ₩50M | **₩83.6M** |
| 재구매 후보 (30~180일) | 682명 | **1,049명** |
| 발송 가능 (SMS 동의) | 152명 | **303명** |
| 평균 미구매일 | 70일 | 70일 |

**재구매 후보 경과일 분포:**

| 구간 | 인원 | 비고 |
|------|------|------|
| 30~60일 | 521명 | 가장 전환 가능성 높음 |
| 61~90일 | 511명 | 리마인드 효과 큼 |
| 91~120일 | 17명 | 이탈 위험 |
| 121~180일 | **0명** | 아래 참고 |
| 180일+ | **0명** | 아래 참고 |

> **120일 이상이 0명인 이유**: 아임웹 API에서 더클린커피 주문이 **2025-12-30부터만** 내려옴 (최대 약 95일 전). 아임웹 사이트 자체가 2025년 12월경 개설 또는 이전된 것으로 추정됨. 그 이전 주문 데이터는 아임웹에 존재하지 않음.

---

### 1-5. 운영 DB (PostgreSQL)

| 테이블 | 건수 | 용도 | 기간 |
|--------|------|------|------|
| `tb_sales_toss` (store='coffee') | 687건 | Toss 결제 원장 | 2026-01 ~ 2026-02 |
| `tb_playauto_orders` | 115,316건 (전체) | 플레이오토 주문 | `created_at` 2026-03-13 (백필 적재일) |
| `ltr_customer_cohort` | 30,546명 | 재구매 코호트 (바이오컴 중심) | |
| `tb_iamweb_users` | 83,017명 | 아임웹 회원 전체 | |

**운영 DB에 2025년 이전 커피 데이터가 있는가?**

| 소스 | 2025년 이전 | 2025년 | 2026년 | 비고 |
|------|-----------|--------|--------|------|
| `tb_sales_toss` (store='coffee') | **없음** | **없음** | 687건 (01~02월) | 커피 전용 Toss Key 미확보 → 2026년만 |
| `tb_playauto_orders` (커피 키워드) | **확인 필요** | **16,180건** | 미확인 | `ord_time` 기준 2025-01~12. 2024년 이전은 별도 조회 필요 |
| `tb_iamweb_users` (커피 주문 고객) | **없음** | **없음** | 없음 | 커피 site_code 미등록 → sync 안 됨 |
| 아임웹 API (로컬 sync) | **없음** | 12/30부터 | 1,937건 | API 자체가 2025-12-30 이후만 반환 |

**결론**: 2025년 커피 주문 데이터의 유일한 소스는 **운영 DB의 PlayAuto** (`tb_playauto_orders`, 2025년 16,180건). 다만 물류 시스템이라 `pay_amt=0` 행이 89%이고, 정밀 재구매 분석에는 부적합. 2024년 이전 데이터 존재 여부는 운영 DB에서 `ord_time < '2025-01-01'` 쿼리로 별도 확인 필요.

**revenue 코드에서 더클린커피 분류 기준:**
- `project_mapping.py`: `더클린커피`, `콜롬비아`, `과테말라`, `에티오피아`, `케냐`, `드립백`, `디카페인`, `SHB`, `원두` → `커피` 프로젝트

---

### 1-6. 결제 추적 (Attribution Ledger)

| 항목 | 값 |
|------|-----|
| live payment_success | **20건** |
| source | `thecleancoffee_imweb` |
| 최근 기록 | 2026-04-04 00:44:14 |
| UTM/gclid 수집 | ✅ 자동 |
| paymentKey 수집 | ✅ 20/20건 |
| orderId 수집 | ✅ 20/20건 |

**수집 방식:** 아임웹 결제 완료 페이지 푸터 코드 → Cloudflare Tunnel → `POST /api/attribution/payment-success`

---

### 1-7. GA4 (`326949178`) — ✅ 해결 (0404)

| 항목 | 값 | 비고 |
|------|-----|------|
| Property ID | 326949178 | 서비스 계정 뷰어 권한 추가 완료 |
| 2025 총 구매 | **8,662건** | GA4 ecommercePurchases |
| 2025 총 매출 | **₩348,599,901** | GA4 purchaseRevenue |
| 2025 총 사용자 | **54,661명** | GA4 totalUsers |
| 신규 사용자 구매 | 4,612건 / ₩178M | 전체의 53.2% |
| 재방문 사용자 구매 | 3,999건 / ₩169M | 전체의 46.2% → **재방문 매출 비중 48.3%** |
| 7일 세션 (0404 기준) | 1,530 | 일 ~220 |

### 1-8. 생일 데이터 현황 (0404 전체 sync 후)

| 사이트 | 회원 | 생일 입력 | 입력률 | 비고 |
|--------|------|---------|--------|------|
| 바이오컴 | 69,924명 | 65,714명 | **94.0%** | 검사키트 구매 시 생일 필수 입력 |
| 더클린커피 | 13,253명 | **1명** | **0.0%** | 회원가입 시 생일 미요구. 생일 쿠폰 사실상 불가 |
| AIBIO | 100명 | 미확인 | | |

**더클린커피 생일 쿠폰 판단**: 생일 입력률이 0%이므로 **현재 상태에서는 불가**. 생일 쿠폰을 하려면 먼저 회원가입 시 생일 입력을 필수로 바꾸거나, 생일 입력 유도 캠페인을 해야 함. 바이오컴은 94%라 즉시 가능.

---

**GA4로 새로 가능해진 것:**
- 2025년 월별 매출/구매 추이 (1월 ₩29M ~ 12월 ₩38M)
- 신규 vs 재방문 구매 비중 분석
- PlayAuto 코호트와 교차 검증

**GA4만으로 불가능한 것:**
- 개인 단위 재구매 추적 (쿠키 기반이라 동일인 식별 불가)
- 정밀 LTR/코호트 분석 → 아임웹 주문 원장 필요

---

## 2. 데이터 흐름도

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  아임웹 API   │    │  Toss API    │    │  플레이오토   │
│  (회원+주문)  │    │  (결제+정산)  │    │  (물류+주문)  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│               로컬 SQLite (crm.sqlite3)               │
│  imweb_members (13,236)  │  toss_transactions (33K)  │
│  imweb_orders  (1,150)   │  toss_settlements  (1.5K) │
└──────────────────────────────────────────────────────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────────────────────────┐
│               CRM API 레이어                          │
│  /api/crm-local/repurchase-candidates (재구매 후보)    │
│  /api/crm-local/imweb/consent-check  (동의 확인)      │
│  /api/contact-policy/evaluate-batch  (발송 정책)      │
│  /api/aligo/send                     (알림톡 발송)    │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│               운영 DB (PostgreSQL)                     │
│  tb_sales_toss (687)     │  tb_playauto_orders (115K) │
│  ltr_customer_cohort     │  tb_iamweb_users (83K)     │
└──────────────────────────────────────────────────────┘
```

---

## 3. 아직 열리지 않은 것

| 항목 | 현재 상태 | 필요한 액션 |
|------|----------|-----------|
| 2025년 Toss 커피 데이터 | ❌ 미확보 | `TOSS_SECRET_KEY_COFFEE` 설정 + 백필 |
| 커피 전용 Toss 라우트 | ❌ 바이오컴 MID 공유 | 커피 MID(`iw_thecleaz5j`) 분리 필요 |
| GA4 접근 권한 | ✅ **해결 (0404)** | 서비스 계정에 뷰어 권한 추가 완료. 일 세션 ~240, 사용자 ~220 확인 |
| 플레이오토 SEO 백엔드 라우트 | ❌ 자격증명만 설정 | `/api/playauto/*` 라우트 구현 필요 시 |
| 상품 카테고리 매핑 | △ revenue 코드에만 있음 | seo 백엔드에 동기화 필요 |
| 커피 LTR/재구매율 정식 지표 | △ 로컬 DB 근사치만 | Toss 백필 후 정식 코호트 구축 |

---

## 4. 현재 가동 중인 API 목록 (더클린커피 관련)

| API | 용도 | 상태 |
|-----|------|------|
| `GET /api/crm-local/imweb/order-stats` | 주문 sync 현황 | ✅ |
| `POST /api/crm-local/imweb/sync-orders` | 아임웹 주문 sync | ✅ |
| `POST /api/crm-local/imweb/sync-members` | 아임웹 회원 sync | ✅ |
| `GET /api/crm-local/imweb/consent-check` | 개별 동의 확인 | ✅ |
| `GET /api/crm-local/imweb/consent-stats` | 동의 집계 | ✅ |
| `GET /api/crm-local/repurchase-candidates` | 재구매 후보 추출 | ✅ **신규** |
| `POST /api/contact-policy/evaluate-batch` | 일괄 정책 평가 | ✅ **신규** |
| `GET /api/toss/daily-summary` | 일별 매출 요약 | ✅ (바이오컴 MID) |
| `GET /api/attribution/ledger?source=thecleancoffee_imweb` | 결제 추적 | ✅ live 20건 |

---

## 5. 식별키(Site Code) 정의

> 문서에서 "site code"로 불리는 값이 3종류 있어 혼동됨. 아래처럼 분리한다.

| 구분 | 명칭 | 값 | 설명 |
|------|------|-----|------|
| **site_slug** | 내부 슬러그 | `thecleancoffee` | 로컬 DB `imweb_orders.site`, `imweb_members.site` 컬럼 |
| **imweb_site_code** | 아임웹 공식 사이트 코드 | 확인 필요 (바이오컴은 `S20190715619285c855898`) | 아임웹 API 인증 시 사용. `IMWEB_SITE_CODE` 환경변수 |
| **brand_key** | 브랜드 키 | `coffee` | 운영 DB `tb_sales_toss.store`, revenue 코드 `project_mapping.py` |
| **toss_mid** | Toss MID | `iw_thecleaz5j` | Toss 결제 시 사용되는 가맹점 ID |
| **ga4_property_id** | GA4 속성 ID | `326949178` | `.env`의 `GA4_COFFEE_PROPERTY_ID` |
| **meta_pixel_id** | Meta Pixel ID | `993029601940881` | 아임웹 헤더에 삽입됨 |
| **gtm_id** | GTM 컨테이너 | `GTM-5M33GC4` | Google Tag Manager |
| **google_ads_id** | Google Ads | `AW-304339096` | 전환 추적용 |

---

## 6. KPI 사전 — 더클린커피 지표 정의

> "재구매율"이 3가지 다른 뜻으로 쓰이고 있었음. 앞으로는 아래 정의를 따른다.

| metric_name | source | grain | 기간 | customer_key | 현재 값 | confidence |
|-------------|--------|-------|------|-------------|---------|-----------|
| `repeat_customer_rate_playauto_2025` | PlayAuto `tb_playauto_orders` | 고객 (phone 정규화) | 2025-01 ~ 2025-12 | `order_htel` 숫자화 | **21.7%** (1,528/7,035) | medium — 물류행 혼재 |
| `repeat_customer_rate_playauto_90d` | PlayAuto | 고객 (phone), 성숙 코호트 | 첫구매 + 90일 | `order_htel` | **21.5%** | medium |
| `repeat_customer_rate_playauto_180d` | PlayAuto | 고객 (phone), 성숙 코호트 | 첫구매 + 180일 | `order_htel` | **32.9%** | medium |
| `repeat_member_rate_imweb_recent` | 로컬 SQLite `imweb_orders` | 회원 (`member_code`) | 2025-12 ~ 2026-04 | `member_code` | **9.4%** (47/500) | low — 기간 4개월 |
| `returning_revenue_share_ga4_2025` | GA4 `326949178` | 세션 (쿠키 기반) | 2025-01 ~ 2025-12 | 쿠키 | **48.3%** (₩169M/₩349M) | high — 세션 기반, 개인 추적 불가 |
| `ltr_toss_cross_2m` | Toss 크로스 조인 | 고객 (Toss matched) | 2026-01 ~ 2026-02 | Toss `order_id` → PlayAuto `shop_ord_no` | **₩58,383** | low — 2개월만 |
| `ltr_toss_per_customer` | Toss 직접 | 전체 (매출/고객) | 2026-01 ~ 2026-02 | 없음 (집계) | **₩98,112** | medium — 단순 나눗셈 |
| `monthly_revenue_ga4_2025` | GA4 | 거래 | 2025 월별 | 세션 | ₩22M ~ ₩38M/월 | high |
| `avg_order_value_toss` | Toss `tb_sales_toss` | 주문 (`order_id`) | 2026-01 ~ 2026-02 | `order_id` | **₩48,579** | high |

**소스별 주권 원칙:**
- **매출/취소/수수료**: Toss가 정본
- **고객 식별/동의/주문 원장**: Imweb가 정본
- **상품 구성/출고/전화번호 proxy**: PlayAuto는 보조
- **신규/재방문/세션**: GA4가 정본
- **유입별 결제 성공 로그**: Attribution ledger가 정본

---

## 7. 트래킹/태깅 현황

> 더클린커피 사이트에 삽입된 코드와 역할 정리. 중복/누락 주의.

| 코드 | 식별값 | 위치 | 역할 | 주의 |
|------|--------|------|------|------|
| Meta Pixel | `993029601940881` | 헤더 | 광고 전환 추적 | - |
| Google Ads | `AW-304339096` | 헤더 | 광고 전환 | 장바구니 전환이 `endsWith('shop_cart')` URL 조건에 의존 — 취약 |
| GTM | `GTM-5M33GC4` | 헤더+바디 | 태그 관리 | GA4 등 하위 태그 관리 |
| GA4 | `326949178` | GTM 경유 | 세션/구매 분석 | ✅ 서비스 계정 접근 해결 (0404) |
| Beusable | `b230307e145743u179` | 헤더+바디 | UX 히트맵 | **중복 삽입** — 헤더와 바디에 2번. 세션 데이터 2배 잡힐 수 있음 |
| Keepgrow | `56eb7c97-...` | 바디 | CRM 자동화 | 알리고/채널톡과 **역할 중복 가능** — 역할 분리 필요 |
| 네이버 WCS | `4b725022d61ce0` | 헤더 | 네이버 광고 전환 | - |
| 아임웹 푸터 코드 | (우리 코드) | 푸터 | 결제 완료 → attribution ledger | ✅ live 20건 가동 중 |

**이벤트 담당 매핑:**

| 이벤트 | 담당 도구 | 비고 |
|--------|----------|------|
| 페이지뷰 | GA4 (GTM 경유) | - |
| 장바구니 추가 | Google Ads (하드코드) | URL 패턴 의존 |
| 결제 시작 | 미계측 | 향후 attribution checkout-context |
| 결제 완료 | 아임웹 푸터 코드 → attribution | ✅ live |
| 구매 전환 | GA4 ecommerce purchase | GA4 자동 수집 |
| UX 히트맵 | Beusable | 중복 삽입 주의 |
| CRM 자동화 | Keepgrow + 알리고 + 채널톡 | 역할 분리 필요 |

**권장 조치:**
1. Beusable 중복 삽입 → 헤더 또는 바디 하나만 남기기
2. Keepgrow vs 알리고/채널톡 역할 명확화 (누가 어떤 메시지를 보내는지)
3. Google Ads 장바구니 전환 → GTM 이벤트 기반으로 변경 권장 (URL 패턴 의존 제거)
