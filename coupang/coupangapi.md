# 쿠팡 Wing Open API 연동 가이드

작성일: 2026-04-24
작성 맥락: `backend/.env` 233~240행에 새로 추가된 COUPANG_BIOCOM / COUPANG_TEAMKETO 두 계정을 seo 프로젝트에 통합하기 위한 레퍼런스 문서. 공식 문서는 `developers.coupangcorp.com`(한국어 `developers.coupang.com`)에 있으며, 본 문서는 실제 연동 시 필요한 정보만 추린 운영용 요약.

---

## 0. 2026-04-24 Notion 검토 반영 요약

검토 문서: [쿠팡 주문 내역 수집 방안](https://www.notion.so/34c1a1c96f96808791bdf63b93aa30b6)

결론:

1. 쿠팡 주문 수집은 **2P(로켓그로스) / 3P(마켓플레이스) / 반품·취소**를 별도 경로로 봐야 한다.
2. 기존 `ordersheets`는 **3P 마켓플레이스 전용 주문 API**다. 2P 로켓그로스는 `RG Order API` 계열로 별도 수집해야 한다.
3. 3P 내부의 `직배송`과 `제트배송`은 별도 채널이 아니라 `ordersheets` 응답의 `shipmentType` 필드로 구분한다.
4. 3P 주문 목록은 `status`가 필수라 `ACCEPT`, `INSTRUCT`, `DEPARTURE`, `DELIVERING`, `FINAL_DELIVERY`, `NONE_TRACKING`을 각각 호출해야 누락을 줄일 수 있다.
5. 2P와 3P 응답 구조가 크게 다르므로 **전용 테이블 분리**가 필요하다. 통합 분석은 별도 view에서 합치는 방식이 맞다.
6. `revenue-history`는 주문 상세가 아니라 정산·매출 인식 관점의 보조 API다. 주문자·배송·할인 구성 분석은 주문 API가 담당하고, 정산일·매출 인식일 대조는 `revenue-history` 또는 `settlement-histories`가 담당한다.

주의:

- 이 repo의 기존 실측 메모는 `ordersheets`를 과거 전수 백필에 쓰기 어렵다고 기록했다. 반면 Notion 문서는 상태별 순회와 최근 7일 재동기화 기준으로 주문 수집 가능성을 정리한다. 따라서 구현 기준은 **일일 incremental + 최근 7일 재동기화**로 잡고, 장기 과거 백필은 `revenue-history`, `settlement-histories`, Wing 엑셀을 함께 비교해 확정한다.

---

## 1. 계정 구성 (환경변수)

| 변수 | 값 | 용도 |
|---|---|---|
| `COUPANG_BIOCOM_CODE` | `A00668577` | 바이오컴 (건기식) 쿠팡 스토어 공급자 코드 (vendorId) |
| `COUPANG_BIOCOM_Access_Key` | `14deb49c-…-6e72c4024c69` | BIOCOM API 액세스 키 |
| `COUPANG_BIOCOM_Secret_Key` | `edabb1…b3251f71` | BIOCOM HMAC 시크릿 |
| `COUPANG_TEAMKETO_CODE` | `A00963878` | 팀케토 쿠팡 스토어 공급자 코드 |
| `COUPANG_TEAMKETO_Access_Key` | `a35c4b79-…-6ab0371f57f6` | TEAMKETO 액세스 키 |
| `COUPANG_TEAMKETO_Secret_Key` | `ce4817…d791d753ab6` | TEAMKETO HMAC 시크릿 |

**⚠️ 보안**: 위 Secret Key는 이미 Git 추적 대상 `.env`에 평문 저장. `.gitignore` 확인 필수이며, 소스 배포 전 한 번 더 점검 권장. 대화창·공유 채팅창에 붙여넣지 말 것.

### 1.1 계정별 역할

- **BIOCOM (A00668577)**: 바이오컴 공식몰. `tb_sales_coupang`·`tb_coupang_orders` 기존 데이터 대부분이 이 계정 기반으로 추정.
- **TEAMKETO (A00963878)**: 신규 추가된 브랜드. 쿠팡 판매 경로가 별도 vendor로 분리됨 → 동기화·매출 집계 로직에 vendor 분기 필요.

---

## 2. 인증 — HMAC-SHA256 Signature

쿠팡 Wing Open API는 `Authorization` 헤더에 **HMAC-SHA256 서명**을 담아 인증한다.

### 2.1 서명 구성 요소

| 요소 | 값 |
|---|---|
| Timestamp | `yyMMdd'T'HHmmss'Z'` (UTC · 예: `260424T071533Z`) |
| Message | `{timestamp} + {HTTP_METHOD} + {PATH} + {QUERY_STRING}` |
| Algorithm | `HmacSHA256` |
| Signature | `HMAC_SHA256(secretKey, message).hex()` (소문자 hex) |

### 2.2 Authorization 헤더 포맷

```
Authorization: CEA algorithm=HmacSHA256, access-key={ACCESS_KEY}, signed-date={TIMESTAMP}, signature={SIGNATURE_HEX}
```

### 2.3 TypeScript 구현 예시

seo 프로젝트에서 바로 쓸 수 있는 형태:

```typescript
// backend/src/coupangClient.ts (가안)
import crypto from "node:crypto";

export type CoupangAccount = "biocom" | "teamketo";

function credentials(account: CoupangAccount) {
  if (account === "biocom") {
    return {
      vendorId: process.env.COUPANG_BIOCOM_CODE!,
      accessKey: process.env.COUPANG_BIOCOM_Access_Key!,
      secretKey: process.env.COUPANG_BIOCOM_Secret_Key!,
    };
  }
  return {
    vendorId: process.env.COUPANG_TEAMKETO_CODE!,
    accessKey: process.env.COUPANG_TEAMKETO_Access_Key!,
    secretKey: process.env.COUPANG_TEAMKETO_Secret_Key!,
  };
}

function generateAuthHeader(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,          // 예: "/v2/providers/openapi/apis/api/v4/vendors/A00668577/ordersheets"
  query: string,         // 예: "createdAtFrom=2026-04-01&createdAtTo=2026-04-24&searchType=timeFrame"
  { accessKey, secretKey }: { accessKey: string; secretKey: string },
): string {
  const now = new Date();
  const ts =
    now.getUTCFullYear().toString().slice(2) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    "T" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0") +
    "Z";
  const message = `${ts}${method}${path}${query}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${ts}, signature=${signature}`;
}

export async function coupangRequest<T>(
  account: CoupangAccount,
  method: "GET" | "POST",
  pathWithQuery: string,   // 예: "/v2/providers/openapi/apis/api/v4/vendors/A00668577/ordersheets?createdAtFrom=..."
  body?: unknown,
): Promise<T> {
  const [path, query = ""] = pathWithQuery.split("?");
  const cred = credentials(account);
  const auth = generateAuthHeader(method, path, query, cred);
  const res = await fetch(`https://api-gateway.coupang.com${pathWithQuery}`, {
    method,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: auth,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Coupang ${account} ${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}
```

**핵심 주의점**:
- `timestamp`는 **UTC** 기준 (로컬 타임 금지).
- `path`에 `vendorId` 그대로 포함. 경로는 `api-gateway.coupang.com` **뒤의** 부분 전체 (포함: `/v2/providers/...`).
- `query`는 `?` **뒤의 문자열** (URL 인코딩 상태 그대로, `?` 미포함).
- POST/PUT의 경우 `body`는 서명에 포함 안 됨 (쿠팡 공식 스펙).
- "Invalid signature" 에러 시 가장 흔한 원인: (a) 로컬 타임 사용, (b) query 정렬·인코딩 불일치, (c) path 앞뒤 공백.

---

## 3. 호출 제한 (Rate Limit)

- **10 req/s per seller** (vendorId 단위)
- 초과 시 **429 Too Many Requests**
- 지속 초과 시 자동 블록 (수분 ~ 수십분 이내 해제). 반복되면 영구 블록 가능

**운영 권장**:
- 배치 sync는 `100ms` 간격 + jitter (±20ms)로 돌리기
- 429 받으면 지수 backoff (1s → 2s → 4s, 최대 5회)
- BIOCOM · TEAMKETO는 vendor가 다르므로 각자 10/s 별도 적용 가능

---

## 4. 주요 엔드포인트

Base URL: `https://api-gateway.coupang.com`

### 4.1 Product (상품)

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}` | GET | 상품 상세 조회 |
| `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/items/inventories` | GET | 상품 아이템별 수량·가격·판매 상태 |
| `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products` | POST | 상품 등록 |

### 4.2 Order (발주서 / Ordersheet)

`ordersheets`는 3P 마켓플레이스 주문 조회 창구다. 2P 로켓그로스 주문은 아래 4.3의 RG Order API를 별도 호출한다.

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets?createdAtFrom=&createdAtTo=&searchType=timeFrame&status=` | GET | **분단위 발주서 목록** (시간 범위 최대 24시간) |
| `/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets?createdAtFrom=&createdAtTo=&maxPerPage=&status=` | GET | **일단위 발주서 목록 (페이징)** |
| `/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets/{shipmentBoxId}` | GET | **단건 조회 (shipmentBoxId 기준)** |
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets/by-orderId/{orderId}` | GET | 단건 조회 (orderId 기준) |
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets/{shipmentBoxId}/acknowledgement` | PUT | 상품준비중 처리 |

**상태 (status) 값**: `ACCEPT` / `INSTRUCT` / `DEPARTURE` / `DELIVERING` / `FINAL_DELIVERY` / `NONE_TRACKING`

운영 수집 규칙:

- 한 번에 "전체 상태"를 조회하는 방식이 없으므로 상태 6개를 순회 호출한다.
- 일일 배치는 전일 1일분을 표준으로 하고, 장애 복구용으로 최근 7일 재동기화 창구를 둔다.
- 호출 사이에 0.5~1초 지연을 둬 429를 피한다. 기존 Rate Limit 문서의 10 req/s보다 보수적으로 운용한다.
- 3P 내부의 직배송/제트배송은 `shipmentType`으로 구분한다. 별도 API가 아니다.

### 4.3 Rocket Growth Order (2P 로켓그로스)

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| RG Order API List Query | GET | **2P 로켓그로스 주문 조회** |

로켓그로스 응답은 3P `ordersheets`보다 훨씬 작다. Notion 실측 기준 핵심 필드는 `orderId`, `paidAt`, `vendorItemId`, `productName`, `salesQuantity`, `unitSalesPrice`, `currency` 수준이다.

주의:

- 2P `paidAt`은 유닉스 밀리초 숫자문자열로 내려오는 케이스가 있어, 3P ISO 날짜 문자열과 같은 컬럼에 원본 그대로 섞으면 정렬·필터링이 깨진다.
- 주문자·수령자·배송 정보는 2P 응답에 없다고 보고, 3P 테이블과 분리 저장한다.

### 4.4 Cancel / Return (취소·반품)

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests?searchType=&createdAtFrom=&createdAtTo=&status=` | GET | 반품·취소 요청 목록 |
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests/{receiptId}` | GET | 반품 단건 |
| `/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/orders/{shipmentBoxId}/cancel` | POST | 발주 취소 |

### 4.5 Settlement (정산)

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories?revenueRecognitionYearMonth=YYYY-MM` | GET | **정산 상세 내역** (월 단위 · 예정·확정 정산 포함) |
| `/v2/providers/openapi/apis/api/v1/revenue-history?recognitionDateFrom=&recognitionDateTo=&token=` | GET | **매출 내역** (일 단위 매출 인식 기준, 토큰 페이징) |

### 4.6 Delivery (배송)

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/shipmentBoxes/{shipmentBoxId}/deliveries` | PUT | 송장 등록 |
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/shipmentBoxes/{shipmentBoxId}/deliveryStatusHistory` | GET | 배송 상태 변경 이력 |

### 4.7 CS / 문의

| 엔드포인트 | 메서드 | 용도 |
|---|---|---|
| `/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/inquiries?inquiryStartAt=&inquiryEndAt=` | GET | 고객 문의 목록 |

---

## 5. seo 프로젝트 통합 현황 · 계획

### 5.1 PG에 이미 존재하는 쿠팡 테이블 (원격 DATABASE_URL)

| 테이블 | 건수 | 용도 | 연결 API |
|---|---|---|---|
| `tb_coupang_orders` | **1,402** | 기존 쿠팡 주문 스냅샷. 3P `ordersheets` 또는 외부 ETL 기반으로 추정되며 2P/3P 전체 주문 원장으로 보기는 어려움 | `ordersheets` 계열 추정 |
| `tb_coupang_inventory` | **83** | 재고 + 최근 30일 판매 (total_orderable_quantity, sales_count_last_30days) | `inventories` |
| `tb_sales_coupang` | **989** | 매출·환불 원장 (수동 업로드 · project 컬럼으로 브랜드 구분) | `settlement-histories` |

`tb_coupang_orders`의 `vendor_id` 컬럼은 이미 존재 → **BIOCOM/TEAMKETO 분기 구조는 준비됨**. 다만 기존 테이블은 2P/3P/반품 전체를 설명하지 못하므로, TEAMKETO는 먼저 1일 샘플 호출로 각 API 가용성을 검증한 뒤 백필 전략을 정한다.

### 5.1A 신규 수집 테이블 설계 방향

Notion 검토 기준 권장안은 **완전 분리**다.

| 테이블 후보 | 담당 | 이유 |
|---|---|---|
| `coupang_rg_orders_api` | 2P 로켓그로스 주문 | 필드가 7개 수준이고 주문자·배송 정보가 없음 |
| `coupang_marketplace_orders_api` | 3P 마켓플레이스 주문 | 주문자·수령자·배송·할인·유입경로 등 상세 필드 보존 필요 |
| `coupang_return_requests_api` | 2P·3P 반품/취소 | 환불·반품 상태값과 원주문 매핑을 별도로 관리 |
| `vw_coupang_orders_unified` | 통합 분석 view | 2P/3P/반품을 공통 분석 스키마로 합산 |

기존 `coupang_ordersheets_api`는 3P 중심 이름과 스키마로 해석한다. 2P 로켓그로스까지 같은 테이블에 넣으면 대부분의 주문자·배송 컬럼이 NULL이 되고, 날짜 포맷도 섞인다.

### 5.2 `tb_playauto_orders`와의 관계

`tb_playauto_orders`의 `shop_name = '쿠팡'` 행 11,182건은 PlayAuto를 통해 쿠팡에서 수집된 주문 데이터. **쿠팡 Open API 직접 호출(tb_coupang_orders)과 별도 소스**. 차이:

| 구분 | 출처 | 실시간성 | 상세도 |
|---|---|---|---|
| `tb_playauto_orders` (shop_name=쿠팡) | PlayAuto 중계 | 분~시간 지연 | 배송·운송장·주소 포함 |
| `tb_coupang_orders` | Coupang Open API 직접 | 실시간 | vendor_item_id 정확, 정산 직결 |
| `tb_sales_coupang` | 수동 업로드 (CSV/엑셀) | 월 단위 | 세무·정산용 |

정합성 확인 시 두 소스를 `order_id` 또는 `shipment_box_id` 기준으로 크로스체크 권장.

### 5.3 추가 구현 후보 (아직 없음)

1. **`backend/src/coupangSync.ts`** — 위 §2.3 클라이언트 + 2P/3P/반품별 주기적 pull
2. **`backend/src/routes/coupang.ts`**
   - `POST /api/coupang/sync-marketplace-orders` body `{ account: "biocom"|"teamketo", dateFrom, dateTo }`
   - `POST /api/coupang/sync-rg-orders` body `{ account, dateFrom, dateTo }`
   - `POST /api/coupang/sync-returns` body `{ account, dateFrom, dateTo }`
   - `POST /api/coupang/sync-settlement` body `{ account, yearMonth }`
   - `GET  /api/coupang/stats` — 계정별 최근 sync 시각·건수·매출
3. **TEAMKETO 초기 검증** — Wing IP 등록 후 2P·3P·반품 호출 가능성 확인
4. **Crmdashboard 연결** — `/ads` 또는 `/acquisition-analysis`에 쿠팡 매출 카드 추가

### 5.4 통합 VIP 멤버십 관점의 사용처

`coffee/coffeevip.md` 전략 2 (통합 멤버십) 금액대 재검증 시 **쿠팡 커피 주문 7,723건이 아직 집계 누락**(`data/dbstructure.md` §5.2 참조). 다만 쿠팡 개인정보 마스킹 정책 때문에 phone 기준 고객 통합은 제한된다. 쿠팡 주문은 우선 상품·월·채널 단위 매출 보정 데이터로 쓰고, 고객 단위 VIP 통합은 자사몰·네이버 등 식별 가능한 채널 중심으로 설계한다.

---

## 6. 한계·주의

| 항목 | 내용 |
|---|---|
| 개인정보 비식별화 | 쿠팡은 2021년부터 `orderer_email`·`orderer_phone`을 마스킹 처리. 전화번호 뒷자리 4자리만 제공 → phone 기반 단일 고객 통합이 **불가** (쿠팡 고객은 별도 세그먼트로 관리) |
| 서명 민감성 | timestamp·path·query 어느 하나 오탈자 시 401. 시간 sync(NTP) 중요 |
| 주문 상태 순회 | 3P `ordersheets`는 `status`가 필수. 6개 상태를 모두 호출하지 않으면 누락 가능 |
| 날짜 포맷 불일치 | 2P 로켓그로스는 유닉스 밀리초, 3P 마켓플레이스는 ISO 문자열 계열. 저장 시 정규화 컬럼과 raw 원본을 모두 둔다 |
| 24시간/7일 범위 제한 | `ordersheets?searchType=timeFrame`은 최대 24시간 범위. Notion 검토 기준 주문 API는 1회 조회 최대 7일 제약을 전제로 최근 7일 재동기화 운용 |
| 결제수단 부재 | 쿠팡 Open API는 카드/현금 결제수단을 제공하지 않는 것으로 정리. Wing 엑셀에서만 일부 확인 가능 |
| 환불 집계 | 정산 API는 "매출 인식 월" 기준, 주문 API는 "주문 시각" 기준 — 두 시점이 다름. 매출 정합성은 `settlement-histories`/`revenue-history`와 반품 API를 같이 봐야 함 |
| 승인 지연 | 상품 등록 시 심사 있음 (수시간 ~ 수일). 동기화 로직은 "미승인" 상태 고려 |

---

## 7. 참고 링크

- [Coupang Open API 개발자 포털 (공식)](https://developers.coupangcorp.com/hc/en-us)
- [HMAC Signature 생성](https://developers.coupangcorp.com/hc/en-us/articles/360033461914-Creating-HMAC-Signature)
- [Python 예제](https://developers.coupangcorp.com/hc/en-us/articles/360033396034-Python-Example)
- [Rate Limit 정책](https://developers.coupangcorp.com/hc/en-us/articles/20414599556889-Introduction-of-Open-API-rate-limit-policy)
- [발주서 단건 조회 (orderId)](https://developers.coupangcorp.com/hc/en-us/articles/360034320553-Single-PO-query-using-orderId)
- [발주서 단건 조회 (shipmentBoxId)](https://developers.coupangcorp.com/hc/en-us/articles/360033792854-Single-PO-query-using-shipmentBoxId)
- [일단위 발주서 목록 (페이징)](https://developers.coupangcorp.com/hc/en-us/articles/360033919573-PO-list-query-paging-by-day)
- [분단위 발주서 목록](https://developers.coupangcorp.com/hc/en-us/articles/360033792774-PO-list-query-by-Minute)
- [상품 조회](https://developers.coupangcorp.com/hc/en-us/articles/360033644994-Querying-product)
- [반품·취소 요청 목록](https://developers.coupang.com/hc/en-us/articles/360033919613-Return-Cancellation-Request-List-Query)
- [취소 처리](https://developers.coupangcorp.com/hc/en-us/articles/360033843154-Cancel-an-order)
- [정산 상세 조회](https://developers.coupangcorp.com/hc/en-us/articles/360034152213-Settlement-Detail-Query)
- [매출 내역 조회](https://developers.coupangcorp.com/hc/en-us/articles/360033922413-Sales-Detail-Query)
- [RG Order API - List Query](https://developers.coupangcorp.com/hc/en-us/articles/41131195825433-RG-Order-API-List-Query)
- [Notion: 쿠팡 주문 내역 수집 방안](https://www.notion.so/34c1a1c96f96808791bdf63b93aa30b6)
- [GitHub: kyungdongseo/coupang (국내 참고 구현)](https://github.com/kyungdongseo/coupang)
- [coupang · PyPI (Python SDK)](https://pypi.org/project/coupang/)

---

## 8. 후속 작업 체크리스트

- [x] `backend/src/env.ts`에 `COUPANG_BIOCOM_*`, `COUPANG_TEAMKETO_*` 6개 변수 zod 스키마 추가
- [x] `backend/src/coupangClient.ts` HMAC 클라이언트 구현 (§2.3 토대) · 2026-04-24 완료
- [x] 실제 호출 테스트 — **HMAC 서명 알고리즘 검증 완료** (쿠팡 서버가 서명을 파싱하고 `403 FORBIDDEN: IP not allowed`를 반환함. 401 Invalid signature였으면 서명 실패)
- [ ] **⚠️ BLOCKED · 쿠팡 Wing 관리자에서 서버 IP 허용 등록 필요**: 현재 테스트 IP `180.65.83.254` 차단 상태. 프로덕션 배포 전 실제 서버 공인 IP도 함께 등록. Wing → 판매자 계정 설정 → Open API IP 관리 메뉴에서 등록. 등록 후 2~5분 후 반영.
- [ ] `backend/src/coupangSync.ts` 2P/3P/반품 분리 sync 함수 (IP 해제 후 구현)
- [ ] TEAMKETO 초기 검증 (`sync-marketplace-orders`, `sync-rg-orders`, `sync-returns` 각각 1일 샘플)
- [ ] `tb_coupang_orders` 기존 데이터의 `vendor_id` 값이 BIOCOM (A00668577)인지 확인, 신규 2P/3P/반품 분리 저장 설계
- [ ] 야간 크론: 일 1회 주문 API 수집 + 최근 7일 재동기화 + settlement 월 1회
- [ ] rate limit 방어 (429 지수 backoff)
- [ ] 대시보드: `/acquisition-analysis` 또는 신규 `/coupang` 페이지에 vendor별 매출 카드

### 8.1 서명 구현 검증 노트 (2026-04-24)

첫 시도에서 `401 Invalid signature` 발생. 원인과 수정:

1. **query URL-encoding**: 서명 계산 시 query와 실제 URL에 붙는 query는 바이트 단위로 동일해야 함. `encodeURIComponent` 적용.
2. **날짜 포맷**: v4 일단위 조회는 `yyyy-MM-dd`, 분단위는 `yyyy-MM-ddTHH:mm` (공백 아니라 **T 구분자**). 분단위는 추가로 `searchType=timeFrame` 쿼리 필요.
3. **signed-date 타임존**: UTC 고정 (`getUTC*`). 로컬 타임 쓰면 5분 내 허용 창을 벗어날 수 있음.
4. **message 순서**: `{signedDate}{METHOD}{PATH}{QUERY}` — 구분자 없이 바로 연결. `?` 미포함. `&`는 query 내부에만.

수정 후 재호출 → `403 FORBIDDEN: IP not allowed` (서명 통과 확인).

### 8.2 BIOCOM IP 등록 검증 (2026-04-24 · 완료)

사용자가 Wing 판매자센터 → 추가판매정보 → OPEN API 키 발급 페이지에서 IP `180.65.83.254` 등록 완료 후 재테스트:

| Endpoint | 결과 | 비고 |
|---|---|---|
| `GET /settlement-histories?revenueRecognitionYearMonth=2026-04` | ✅ **HTTP 200** · 0건 | 이번 달 정산 미종결 (정상) |
| `GET /ordersheets?...&searchType=timeFrame&status=ACCEPT` | ✅ **HTTP 200** · 0건 | 최근 24h ACCEPT 주문 없음 (BIOCOM 쿠팡 판매 저조) |
| `GET /returnRequests?...&status=RU` | ✅ 200 (상태값 스펙만 조정) | status 값이 endpoint별로 다름 (주문=ACCEPT계열 / 반품=RU/CC/PR/UC) |

→ **BIOCOM 인증·서명·IP 모두 통과 확인**. 실제 데이터 0건인 것은 바이오컴이 쿠팡보다 자사몰·스마트스토어 중심이라 정상. `tb_playauto_orders`에서도 shop_name='쿠팡' 11,182건 중 바이오컴 상품 969건(8.7%)뿐.

### 8.3 쿠팡 API 제약 메모

실측 확인된 파라미터 제약:

| API | 필수 제약 |
|---|---|
| `ordersheets` (3P v4 분단위) | `createdAtFrom`~`createdAtTo` **1일 미만** · `searchType=timeFrame` · `status` 필수 |
| `ordersheets` (3P v5 일단위) | `createdAtFrom`~`createdAtTo` `yyyy-MM-dd` 또는 `yyyy-MM-dd+09:00` 계열 · `status` 필수 · `maxPerPage` 1~50 |
| `RG Order API` (2P) | 날짜 포맷이 3P와 다름. `paidAt` 등 유닉스 밀리초 문자열 정규화 필요 |
| `returnRequests` | `status` 값: `RU` (반품요청) / `CC` (취소완료) / `PR` (반품진행) / `UC` (수거완료) |
| `settlement-histories` | `revenueRecognitionYearMonth=YYYY-MM` (단일 파라미터) — 가장 테스트 쉬움 |

### 8.4 TEAMKETO 상태 (2026-04-24 현재)

아직 Wing IP 미등록 → 403 FORBIDDEN 지속. 다음 단계:
1. **TEAMKETO (A00963878) Wing 별도 로그인** → 동일 경로에서 IP `180.65.83.254` 등록
2. 재검증 후 TEAMKETO 주문·정산 본격 sync 구현

### 8.5 BIOCOM 백필 시도 결과 · ordersheets 백필 리스크 (2026-04-24)

BIOCOM `ordersheets` 3일 샘플(2026-04-20~22) 호출 결과 **FINAL_DELIVERY 1건**만 수신. 반면 `tb_coupang_orders`에는 2026-04월 553건 존재. 매칭 0건.

**현재 판단**: 이 실측만으로는 `ordersheets`를 과거 전수 백필의 단일 진실 소스로 두기 어렵다. Notion 검토 문서는 상태별 순회 호출로 주문 수집 가능성을 정리했지만, repo 실측에서는 과거 데이터 누락 가능성이 관찰됐다. 따라서 `ordersheets`는 우선 **일일 incremental + 최근 7일 재동기화** 용도로 쓰고, 장기 과거 백필은 `revenue-history`, `settlement-histories`, Wing 엑셀과 대조해 결정한다.

**결정적 날짜 포맷 (v5)**: `yyyy-MM-dd+09:00` (ISO 타임존 offset). 예: `2026-04-22+09:00` = KST 자정.
```
/ordersheets?createdAtFrom=2026-04-22+09:00&createdAtTo=2026-04-23+09:00&status=INSTRUCT&maxPerPage=50
```

**`tb_coupang_orders` 정체 추정**: 외부 ETL이 특정 시점에 `ordersheets`를 순회하며 스냅샷으로 수집한 테이블일 가능성이 있다. 신규 2P/3P 분리 수집 전에는 완전한 판매 원장으로 단정하지 않는다.

**과거 판매 전수 원장 후보**:
| Endpoint | 용도 | 상태 (2026-04-24) |
|---|---|---|
| `revenue-history` | 매출 인식일 기준 판매 전수 | `token` 파라미터 필수 · 포맷 문서화 부족 · 추가 조사 요 |
| `settlement-histories` | 월 단위 정산 | 작동 OK · 바이오컴은 쿠팡 정산 건 0건 (판매 저조) |
| **Wing 어드민 엑셀 다운로드** | 전체 주문·결제 내역 | **가장 확실한 과거 백필 경로** (더클린커피에서 이미 검증) |

**권장**: BIOCOM은 쿠팡 비중 8.7%(`tb_playauto_orders` 기준 969건/11,182건)로 낮음. 우선 주문 API 일일 sync와 최근 7일 재동기화를 도입하고, 과거 분석이 필요하면 Wing 엑셀 다운로드 + import 경로를 병행(coffee와 동일 패턴).

TEAMKETO는 쿠팡 비중이 주력일 가능성 있어 IP 등록 후 동일 검증·전략 결정 필요.
