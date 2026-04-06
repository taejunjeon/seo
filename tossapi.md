# 토스페이먼츠 API 연동 메모

작성일: 2026-04-01

## 1. 인증 정보

| 항목 | 테스트 | 라이브 |
|------|--------|--------|
| Client Key | `test_ck_d46qopOB89POOvXxk1EarZmM75y0` | `live_ck_E92LAa5PVb5GE7X09pWJ37YmpXyJ` |
| Secret Key | `test_sk_ZLKGPx4M3MRxQbammxL2VBaWypv1` | `live_sk_Z61JOxRQVEbR5Mgow4RRrW0X9bAq` |
| Security Key | `e7945d1c...` | `ccde1e28...` |
| Shop ID (MID) | `iw_biocomo8tx` | `iw_biocomo8tx` |

## 2. API 인증 방법

- **Base URL**: `https://api.tosspayments.com`
- **인증**: HTTP Basic Authentication
- **헤더**: `Authorization: Basic {base64(시크릿키:)}`
- 시크릿 키 뒤에 콜론(`:`)을 반드시 붙인 후 Base64 인코딩

```bash
# 예시
SECRET_KEY="live_sk_Z61JOxRQVEbR5Mgow4RRrW0X9bAq"
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
