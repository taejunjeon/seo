# 토스페이먼츠 API 연동 메모

작성일: 2026-04-01

## 1. 인증 정보

| 항목 | 테스트 | 라이브 |
|------|--------|--------|
| Client Key | `test_ck_d46qopOB89POOvXxk1EarZmM75y0` | `live_ck_E92LAa5PVb5GE7X09pWJ37YmpXyJ` |
| Secret Key | 환경변수 `TOSS_SECRET_KEY_TEST` 참조 | 환경변수 `TOSS_SECRET_KEY_LIVE` 참조 |
| Security Key | `e7945d1c...` | `ccde1e28...` |
| Shop ID (MID) | `iw_biocomo8tx` | `iw_biocomo8tx` |

## 2. API 인증 방법

- **Base URL**: `https://api.tosspayments.com`
- **인증**: HTTP Basic Authentication
- **헤더**: `Authorization: Basic {base64(시크릿키:)}`
- 시크릿 키 뒤에 콜론(`:`)을 반드시 붙인 후 Base64 인코딩

```bash
# 예시
SECRET_KEY="$TOSS_SECRET_KEY_LIVE"
AUTH=$(echo -n "${SECRET_KEY}:" | base64)
curl -H "Authorization: Basic ${AUTH}" https://api.tosspayments.com/v1/transactions
```

## 3. 주요 API 엔드포인트

### 결제 (Payment)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/v1/payments/confirm` | 결제 승인 |
| GET | `/v1/payments/{paymentKey}` | paymentKey로 결제 조회 |
| GET | `/v1/payments/orders/{orderId}` | orderId로 결제 조회 |
| POST | `/v1/payments/{paymentKey}/cancel` | 결제 취소 |
| POST | `/v1/payments/key-in` | 카드 키인 결제 |
| POST | `/v1/virtual-accounts` | 가상계좌 발급 |

### 거래 (Transaction)
| Method | Path | 설명 |
|--------|------|------|
| **GET** | **`/v1/transactions`** | **거래내역 조회** (startDate/endDate/limit) |

### 정산 (Settlement)
| Method | Path | 설명 |
|--------|------|------|
| **GET** | **`/v1/settlements`** | **정산내역 조회** (startDate/endDate) |
| POST | `/v1/settlements/manual` | 수동 정산 |

### 자동결제 (Billing)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/v1/billing/authorizations/issue` | 빌링키 발급 |
| POST | `/v1/billing/{billingKey}` | 자동결제 승인 |
| DELETE | `/v1/billing/authorizations/{authorizationKey}` | 빌링키 삭제 |

### 현금영수증 (CashReceipt)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/v1/cash-receipts` | 현금영수증 발급 |
| POST | `/v1/cash-receipts/{receiptKey}/cancel` | 취소 |
| GET | `/v1/cash-receipts` | 조회 |

### 프로모션 (Promotion)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/promotions` | 전체 프로모션 조회 |
| GET | `/v1/promotions/card` | 카드 프로모션 조회 |

## 4. 연동 테스트 결과 (0401)

### 라이브 키 테스트: 성공

**거래내역 조회** (`GET /v1/transactions`):
```
2026-03-28 | 카드 | DONE | ₩725,000 | orderId=202603287152117-P1
2026-03-28 | 카드 | DONE | ₩680,400 | orderId=202603284937325-P1
2026-03-28 | 카드 | DONE | ₩891,000 | orderId=202603282775287-P1
```

**정산내역 조회** (`GET /v1/settlements`):
```
2026-03-01 | 카드 | ₩485,000 | 수수료 ₩17,605 | 정산 ₩467,395 | 정산일 2026-03-06
```

정산 응답에 포함되는 핵심 필드:
- `amount` — 결제 금액
- `fee` — PG 수수료
- `payOutAmount` — 실 정산 금액 (= amount - fee)
- `soldDate` — 매출일
- `paidOutDate` — 정산일
- `card.issuerCode` / `card.acquirerCode` — 카드사
- `cancel` — 취소 내역

### 테스트 키: 조회 API 미지원 (POST confirm만 가능)

## 5. 우리 프로젝트에서 활용 가능한 것

| 활용 | API | 관련 Phase |
|------|-----|-----------|
| PG 수수료 실비 산출 | `GET /v1/settlements` | Phase 1 (P1-S1A 결제 귀속) |
| 결제 금액 vs 정산 금액 차이 확인 | `GET /v1/settlements` | Phase 1 |
| orderId 기준 주문-결제 매칭 | `GET /v1/payments/orders/{orderId}` | Phase 1 (토스 조인) |
| 일별 거래 건수/금액 추이 | `GET /v1/transactions` | Phase 4 (북극성 지표) |
| 카드사별/결제수단별 분해 | `GET /v1/settlements` → card 필드 | 쿠폰 분석 |
| 환불/취소 건 추적 | `GET /v1/payments/{key}` → cancel 필드 | Phase 7 (실험 iROAS) |
| 더클린커피 결제 분리 | `GET /v1/transactions` + store 필터 | 커피 전략 |

## 6. 운영 DB `tb_sales_toss`와의 관계

- 운영 DB에 이미 `tb_sales_toss` 테이블이 있고 `store='coffee'` / `store='biocom'`으로 분리됨
- 하지만 이 테이블에는 **고객 식별자가 없음** (전화번호/이메일 미포함)
- Toss API의 `GET /v1/payments/orders/{orderId}`를 호출하면 아임웹 주문과 매칭 가능
- `orderId` 포맷: `202603012359271-P1` (아임웹 주문번호 + 결제 시퀀스)

## 7. 구현 완료 (0401)

| 항목 | 상태 |
|------|------|
| `env.ts`에 키 등록 | ✅ 완료 |
| `routes/toss.ts` 4개 엔드포인트 | ✅ 완료 |
| `server.ts`에 라우터 등록 | ✅ 완료 |
| `/health`에 toss 상태 노출 | ✅ `ready: true` |
| 거래내역 실조회 | ✅ 성공 |
| 정산내역 실조회 | ✅ 성공 (PG 수수료 3.41~3.63%) |
| orderId 매칭 | ✅ 아임웹 주문번호로 1:1 조회 성공 |
| 일별 요약 집계 | ✅ 매출/수수료/카드/가상계좌 |

## 8. 과거 데이터 전체 조회 가능 확인 (0401)

### 발견

운영 DB `tb_sales_toss`에는 2026-01~03만 있었지만, **Toss API에서는 2025-01부터 전체 기간 조회 가능**하다.

| 소스 | coffee | biocom | 기간 |
|------|--------|--------|------|
| 운영 DB `tb_sales_toss` | 687건 | 6,248건 | 2026-01 ~ 2026-03 |
| **Toss API** | **전체 조회 가능** | **전체 조회 가능** | **2025-01 ~ 현재** |

테스트 결과:
- `2025-01`: 100건 조회 OK (limit=100에 잘림, 실제 더 많음)
- `2025-06`: 100건 조회 OK
- `2025-12`: 100건 조회 OK
- 모든 월에서 200 OK 응답

### Toss API 페이지네이션

`GET /v1/transactions`는 `limit=100`이 최대이고, `startingAfter` 파라미터로 페이지네이션이 가능하다.
한 달에 2,000건이면 20번 호출 필요. 15개월 × 20회 = 300회 호출로 전체 데이터 적재 가능.

### 로컬 SQLite 적재 결과 및 운영 활용

Toss API에서 2025-01 ~ 현재까지 전체 거래+정산을 `backend/data/crm.sqlite3`에 적재하는 경로는 이미 확보되었다. 현재 기준 활용 포인트는 다음과 같다.

1. **커피 VIP LTR 재산출 가능** — 기존 2개월 기준 과소추정 문제를 15개월 범위로 다시 계산할 수 있다
2. **월별 매출 추이 확보** — 운영 DB 의존 없이 Toss 직접 조회 데이터로 확인 가능하다
3. **API 호출 최소화** — 한 번 적재 후 로컬 조회, 일간 증분만 API 호출하면 된다
4. **PlayAuto 크로스 조인 범위 확대** — 2025 전체 기간 기준으로 매칭률을 다시 계산할 수 있다

적재할 테이블:
- `toss_transactions` — transactionKey, paymentKey, orderId, method, status, transactionAt, amount, mId
- `toss_settlements` — paymentKey, orderId, amount, fee, payOutAmount, soldDate, paidOutDate, method, card info

예상 총 데이터:
- 거래: 월 ~2,000건 × 15개월 = ~30,000건
- 정산: 거래와 거의 1:1 = ~30,000건

구현 방법:
1. `backend/src/tossSyncLocal.ts` — Toss API 전체 기간 backfill 스크립트
2. `crmLocalDb.ts`에 `toss_transactions`, `toss_settlements` 테이블 추가
3. `routes/toss.ts`에 `/api/toss/sync` 엔드포인트 추가 (수동 트리거)
4. 일간 증분 동기화: `GET /api/toss/sync?mode=incremental` (어제~오늘만)

### 구현 시 주의사항

- Toss API rate limit: 문서에 명시적 제한은 없지만 초당 10건 이하 권장
- backfill 시 1초 간격 sleep 추가 → 30,000건 적재에 약 5분
- 정산 데이터는 `soldDate` 기준이라 당일 거래는 정산 데이터가 아직 없을 수 있음
- `transactionKey`를 primary key로 사용하여 중복 적재 방지

## 9. Backfill 실행 결과 (0401)

### 실행

```bash
POST /api/toss/sync?mode=backfill&startDate=2025-01-01
```

### 결과

| 항목 | 수치 |
|------|------|
| 기간 | 2025-01-01 ~ 2026-04-01 (16개월) |
| 거래 적재 | **32,916건** |
| 정산 적재 | **1,472건** (정산은 limit=100/월, 추가 페이지네이션 필요) |
| 가장 오래된 거래 | 2025-01-01 |
| 가장 최근 거래 | 2026-03-30 |
| DONE 거래 | 29,367건 |
| 총 매출 | **₩7,614,378,186** (76억원) |
| 파일 크기 | ~15MB |

### 월별 매출 (Toss 로컬 기준)

| 월 | 건수 | 매출 |
|----|------|------|
| 2025-01 | 969 | ₩212,332,953 |
| 2025-02 | 2,299 | ₩611,530,421 |
| 2025-03 | 2,248 | ₩554,007,958 |
| 2025-04 | 1,999 | ₩437,357,541 |
| 2025-05 | 2,828 | ₩617,555,447 |
| 2025-06 | 2,581 | ₩519,901,798 |
| 2025-07 | 3,080 | ₩745,022,326 |
| 2025-08 | 1,812 | ₩396,788,722 |
| 2025-09 | 1,708 | ₩411,688,077 |
| 2025-10 | 1,866 | ₩443,739,524 |
| 2025-11 | 2,414 | ₩540,760,219 |
| 2025-12 | 1,871 | ₩422,912,472 |
| 2026-01 | 2,987 | ₩717,536,021 |
| 2026-02 | 2,063 | ₩482,994,530 |
| 2026-03 | 2,191 | ₩500,250,177 |

### 추가 API

| 엔드포인트 | 용도 |
|-----------|------|
| `POST /api/toss/sync?mode=backfill` | 전체 기간 적재 |
| `POST /api/toss/sync?mode=incremental` | 최근 2일 증분 |
| `GET /api/toss/local-stats` | 로컬 DB 통계 |

## 10. 커피 Toss 데이터 한계 (0401)

### 현재 상태

| MID | 용도 | Toss API 키 | 로컬 적재 |
|-----|------|------------|----------|
| `iw_biocomo8tx` | 바이오컴 | 라이브 키 확보 | **32,916건** (15개월) |
| `iw_thecleaz5j` | 더클린커피 | **라이브 키 반영 완료 (0406)** | **5,043건** (2025-01 ~ 2026-02, local backfill 완료) |

- 과거에는 바이오컴 키로 커피 orderId 조회 시 `NOT_FOUND_PAYMENT` (404)였다
- 2026-04-06 현재 `seo/backend`가 `store=biocom|coffee` 분기를 지원하며, coffee orderId 상세 조회 실검증까지 완료했다
- `POST /api/toss/sync?store=coffee&mode=backfill&startDate=2025-01-01&endDate=2026-04-06` 실행 결과, `transactions 4,356건 / settlements 1,400건` 추가 적재됐다
- 남은 것은 키 확보가 아니라 coffee LTR/재구매 지표 갱신이다

### 커피 15개월 데이터 확보 방법

1. **완료**: 커피 Toss backfill 실행 → `.env` 반영된 live key로 2025~현재 local 재적재
2. PlayAuto 기반 분석 유지 (현재 방식, LTR은 여전히 과소추정 가능)
3. 운영 DB `tb_sales_toss` 동기화 범위 확대 요청 (개발팀, 보조 경로)

### 현재 크로스 조인 결과 (구버전 2개월 기준)

| 세그먼트 | 고객 | 평균 LTR | 재구매율 |
|---------|------|---------|---------|
| VIP(6+) | 1명 | ₩146,846 | - |
| 재구매(2~5) | 107명 | ₩107,366 | - |
| 1회 | 409명 | ₩45,352 | - |
| **전체** | **517명** | **₩58,383** | **20.9%** |

→ 이 표는 backfill 전 2개월 기준으로 만든 값이다. 0406 local backfill 완료 후에는 15개월 기준으로 다시 계산해야 한다.

## 11. 다음 단계

1. 정산 페이지네이션 보완 (현재 월 100건 제한 → 추가 페이지 적재)
2. 로컬 Toss 데이터로 커피 VIP LTR 15개월 기준 재산출
3. PlayAuto 크로스 조인 범위 확대 (2개월→15개월)
4. `/crm` 결제 귀속 탭에서 로컬 Toss 데이터 차트 연결
5. 일간 증분 동기화 자동화 (cron 또는 서버 시작 시)

## 12. 상품명/상품 ID 조회 가능 여부 (0411 추가)

### 한 줄 결론

Toss API에서는 결제 상세의 `orderName`은 가져올 수 있다.

하지만 `orderName`은 "구매상품 대표명"에 가까운 문자열이다. 예를 들면 `생수 외 1건` 같은 형태다.

Toss 거래/정산 API에는 상품명, 상품 ID, 상품 라인아이템이 없다. Toss에는 일반 주문의 상품 목록을 다시 조회하는 별도 상품 API도 확인되지 않는다.

따라서 상품별 ROAS, Meta `content_ids`, 상품군 분석에는 Toss가 아니라 **아임웹 주문 라인아이템, 운영 DB 상품 원장, GA4 BigQuery `items`, 또는 결제완료 페이지 dataLayer**가 필요하다.

### 공식 문서 기준 확인

참고 공식 문서:

- Toss Payments Core API: https://docs.tosspayments.com/reference
- Toss Payments API 요청/응답: https://docs.tosspayments.com/reference/using-api/req-res
- Toss Payments API 키: https://docs.tosspayments.com/reference/using-api/api-keys

### 결제 상세 API

사용 가능한 조회 API:

| API | 용도 | 상품명 관련 |
|---|---|---|
| `GET /v1/payments/{paymentKey}` | paymentKey로 결제 상세 조회 | `Payment.orderName` 확인 가능 |
| `GET /v1/payments/orders/{orderId}` | orderId로 결제 상세 조회 | `Payment.orderName` 확인 가능 |

공식 `Payment` 객체에는 `orderName`이 있다.

의미:

- 결제 요청 시 전달된 구매상품명
- 최대 100자
- 복수 상품이면 보통 `대표상품 외 N건` 같은 형태

중요한 한계:

- `orderName`은 상품 라인아이템 목록이 아니다.
- `product_id`, `product_no`, `item_id`, `quantity` 같은 구조화된 상품 목록이 아니다.
- 쇼핑몰 또는 결제창을 띄우는 쪽에서 어떤 문자열을 넘겼는지에 따라 품질이 달라진다.
- 이미 생성된 결제에 대해 Toss가 상품 목록을 새로 추론해서 주는 구조가 아니다.

따라서 `orderName`은 사람이 주문을 식별하는 보조 정보로는 쓸 수 있지만, Meta CAPI `content_ids`나 상품군별 ROAS의 정본으로 쓰기에는 부족하다.

### 거래 조회 API

API:

```text
GET /v1/transactions
```

공식 `Transaction` 객체의 주요 필드:

- `mId`
- `transactionKey`
- `paymentKey`
- `orderId`
- `method`
- `customerKey`
- `useEscrow`
- `receiptUrl`
- `status`
- `transactionAt`
- `currency`
- `amount`

여기에는 `orderName`도 없고, 상품명/상품 ID/상품 라인아이템도 없다.

우리 로컬 DB `toss_transactions`도 이 구조를 따른다.

```sql
CREATE TABLE toss_transactions (
  transaction_key TEXT PRIMARY KEY,
  payment_key TEXT NOT NULL,
  order_id TEXT NOT NULL,
  method TEXT,
  status TEXT,
  transaction_at TEXT,
  currency TEXT DEFAULT 'KRW',
  amount INTEGER DEFAULT 0,
  m_id TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

즉, 현재 로컬 Toss 거래 캐시만 보면 상품명은 알 수 없다.

### 정산 조회 API

API:

```text
GET /v1/settlements
```

공식 `Settlement` 객체의 주요 필드:

- `mId`
- `paymentKey`
- `transactionKey`
- `orderId`
- `currency`
- `method`
- `amount`
- `fees`
- `payOutAmount`
- `approvedAt`
- `soldDate`
- `paidOutDate`

정산 API도 결제 금액, 수수료, 지급일 확인용이다. 상품명/상품 ID/상품 라인아이템 조회 용도가 아니다.

### `metadata`

`Payment.metadata`는 존재한다.

의미:

- 결제 요청 시 SDK에서 직접 추가한 key-value 정보
- 최대 5개 key-value 쌍
- key는 최대 40자, value는 최대 2000자

중요한 한계:

- 결제 요청 시점에 우리가 넣어야만 내려온다.
- 이미 Toss에 생성된 주문에 대해 사후에 자동으로 생기지 않는다.
- 현재 아임웹/Toss 경로에서 상품 ID가 이 `metadata`에 들어오고 있다는 근거는 없다.
- 5개 제한이 있어서 여러 상품의 라인아이템 전체를 안정적으로 담기에는 부적합하다.

활용 가능성:

- 결제창을 직접 띄우는 구조라면 `metadata.product_ids`, `metadata.order_items_json` 같은 값을 넣을 수 있다.
- 하지만 현재 바이오컴은 아임웹 결제 흐름이므로, 우리가 직접 Toss SDK 요청 payload를 제어할 수 있는지 별도 확인이 필요하다.

### `escrowProducts`

공식 문서에는 `escrowProducts`가 있다.

위치:

```text
POST /v1/virtual-accounts
```

의미:

- 가상계좌 발급 요청에서 에스크로 결제를 사용할 때 전달하는 상품 상세 배열
- 필드 예시: `id`, `name`, `code`, `unitPrice`, `quantity`

중요한 한계:

- 일반 결제 전체에 대한 상품 조회 API가 아니다.
- 에스크로 결제 사용 시 요청 시점에 보내는 파라미터다.
- 아임웹 기본 결제 흐름에서 이 값이 항상 들어간다고 볼 근거가 없다.
- 현재 우리 로컬 Toss 캐시에도 `escrowProducts`를 저장하는 컬럼이 없다.

따라서 `escrowProducts`는 "Toss에 상품 정보를 담을 수 있는 특수 경로"이지, "기존 주문의 상품명을 Toss에서 불러오는 API"로 보면 안 된다.

### 우리 프로젝트 현재 구현 기준

현재 백엔드 Toss 라우트:

| 로컬 API | 내부 호출 | 상태 |
|---|---|---|
| `GET /api/toss/transactions` | `GET /v1/transactions` | 거래 목록 조회 |
| `GET /api/toss/settlements` | `GET /v1/settlements` | 정산 목록 조회 |
| `GET /api/toss/payments/orders/:orderId` | `GET /v1/payments/orders/{orderId}` | 결제 상세 조회 |
| `POST /api/toss/sync` | 거래/정산 backfill | 로컬 SQLite 적재 |
| `GET /api/toss/local-stats` | 로컬 SQLite 통계 | 거래/정산 현황 |

현재 로컬 SQLite 적재 테이블:

- `toss_transactions`: `transaction_key`, `payment_key`, `order_id`, `method`, `status`, `transaction_at`, `amount`, `m_id`
- `toss_settlements`: `payment_key`, `order_id`, `method`, `amount`, `fee`, `pay_out_amount`, `sold_date`, `paid_out_date`, `approved_at`, 카드 일부 정보

현재 저장 구조에는 `orderName`, `metadata`, `escrowProducts`, 상품 ID, 상품명 컬럼이 없다.

즉, 현재 Toss sync 결과만으로는 상품명을 복원할 수 없다.

### 상품명을 가져올 수 있는가?

특정 주문 1건에 대해 결제 상세 API를 호출하면 `payment.orderName`은 확인할 수 있다.

예상 호출:

```bash
curl "http://localhost:7020/api/toss/payments/orders/202604063820747-P1?store=biocom"
```

확인할 필드:

```json
{
  "payment": {
    "orderId": "202604063820747-P1",
    "orderName": "대표 상품명 또는 대표 상품명 외 N건",
    "metadata": {}
  }
}
```

이 값은 "대표 주문명"으로는 쓸 수 있다.

하지만 Toss API만으로 아래 정보를 안정적으로 가져오는 것은 어렵다.

- 주문 안의 전체 상품 목록
- 상품별 ID
- 상품별 수량
- 상품별 단가
- 상품별 할인
- 상품군 분류
- Meta CAPI `content_ids`로 쓸 안정 ID

이유:

- Toss는 PG다. 상품 카탈로그/주문 라인아이템의 정본 시스템이 아니다.
- Toss의 핵심 식별자는 `paymentKey`, `orderId`, `transactionKey`다.
- 일반 거래/정산 API는 결제 대사와 정산 대사용 데이터만 제공한다.
- 상품 정보가 필요하면 결제를 요청하는 상점 시스템이 먼저 `orderName`, `metadata`, 또는 에스크로 파라미터에 넣어야 한다.

### ROAS/Meta CAPI 관점의 판단

Toss API는 다음 용도에는 적합하다.

- 결제 승인 여부 확인
- 가상계좌 입금 전/입금 완료 구분
- 취소/부분취소 확인
- 결제금액 검증
- PG 수수료와 정산 금액 검증
- `paymentKey`/`orderId` 기준 원장 대사

Toss API는 다음 용도에는 정본으로 부적합하다.

- 상품별 ROAS
- 검사권/영양제/커피/정기구독 분류
- Meta `content_ids` 생성
- 광고 소재별 구매 상품 분석

상품 분석 정본 후보 우선순위:

1. 운영 DB의 주문 라인아이템 테이블 또는 `tb_iamweb_users.product_name`
2. 아임웹 주문 상세/상품 API로 별도 backfill
3. GA4 BigQuery `items` 배열
4. 결제완료 페이지의 dataLayer 또는 DOM에서 상품 line item을 읽어 payment-success 원장에 같이 저장
5. Toss `orderName`은 보조값으로만 사용

### 현재 원장 metadata에 상품 ID가 안정적으로 안 들어오는 이유와 연결

현재 payment-success 원장 metadata에는 `orderId`, `paymentKey`, UTM, `fbclid`, `_fbc`, `_fbp`, GA 식별자 등이 중심으로 들어온다.

상품 ID가 안정적으로 안 들어오는 이유:

- Toss 거래/정산 API 자체가 상품 ID를 제공하지 않는다.
- 현재 로컬 Toss sync 테이블도 상품 필드를 저장하지 않는다.
- 아임웹 결제완료 페이지 footer snippet이 상품 line item을 수집하지 않는다.
- `orderId`의 `-P1` suffix는 상품 ID가 아니라 결제/라인 suffix로 보는 것이 안전하다.
- Toss `orderName`은 대표 문자열이라 상품 ID로 쓰면 안 된다.

따라서 상품 ID를 안정화하려면 Toss가 아니라 주문 라인아이템 소스를 별도로 붙여야 한다.

### 다음 액션

1. 최근 주문 3-5건에 대해 `GET /api/toss/payments/orders/:orderId` 호출.
2. 응답의 `orderName`, `metadata`, `useEscrow`, `method`, `status` 확인.
3. 같은 주문을 아임웹/운영 DB/GA4 items와 비교.
4. `orderName`이 실제 상품명인지, `대표상품 외 N건`인지 샘플로 판단.
5. 필요하면 `GET /api/toss/payments/orders/:orderId` 응답에서 `orderName`과 `metadata`를 표시하는 진단 API를 추가.
6. 단, 상품 ID/상품군 정본은 아임웹 주문 라인아이템 또는 운영 DB에서 가져오는 별도 경로로 구현.

권장 결론:

상품명/상품 ID 문제는 Toss API로 푸는 것이 아니라, **아임웹 또는 운영 주문 라인아이템 원장으로 풀어야 한다.**

Toss는 결제 상태와 금액 검증의 정본이고, 상품 정보의 정본은 아니다.
