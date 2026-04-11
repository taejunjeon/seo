# 아임웹 API 정리

작성일: 2026-04-11 KST

## 결론

전용 아임웹 API 문서는 없었다. 관련 내용은 `api.md`, `imweb/memberagree.md`, `data/coupon.md`, `localdb.md`, `backend/src/routes/crmLocal.ts`에 흩어져 있었다.

이 문서는 현재 SEO 프로젝트에서 실제로 확인했거나 코드에 붙어 있는 아임웹 API만 모은 운영 참고 문서다. 공식 문서 전체 목록의 최신성 검증 문서가 아니라, 우리 프로젝트 기준 사용 내역과 한계를 정리한 것이다.

## 사용 중인 사이트 설정

| site | 용도 | env key |
|---|---|---|
| `biocom` | 바이오컴 | `IMWEB_API_KEY`, `IMWEB_SECRET_KEY` |
| `thecleancoffee` | 더클린커피 | `IMWEB_API_KEY_COFFEE`, `IMWEB_SECRET_KEY_COFFEE` |
| `aibio` | AIBIO | `IMWEB_API_KEY_LAB`, `IMWEB_SECRET_KEY_LAB` |

주의:

- 시크릿 값은 문서에 적지 않는다.
- 현재 백엔드는 위 key/secret으로 `https://api.imweb.me/v2/auth` 토큰을 발급받아 레거시 v2 API를 호출한다.
- `openapi.imweb.me/orders` 계열은 별도 권한 또는 OAuth 앱 자격증명이 필요할 수 있다. 현재 확인한 토큰으로는 `401 / 토큰이 유효하지 않습니다`가 발생했다.

## 외부 아임웹 API

### 인증

| Method | URL | 사용 상태 | 설명 |
|---|---|---|---|
| `POST` | `https://api.imweb.me/v2/auth` | 사용 중 | `{ key, secret }`으로 `access_token` 발급 |

요청 헤더:

```http
Content-Type: application/json
```

응답 토큰 사용 헤더:

```http
Content-Type: application/json
access-token: <token>
```

### 회원

| Method | URL | 사용 상태 | 주요 필드 |
|---|---|---|---|
| `GET` | `https://api.imweb.me/v2/member/members?orderBy=jointime&offset={page}&limit=100` | 사용 중 | `member_code`, `uid`, `name`, `callnum`, `email`, `birth`, `marketing_agree_sms`, `marketing_agree_email`, `third_party_agree`, `member_grade`, `join_time`, `last_login_time` |

실측 메모:

- `offset`은 row offset이 아니라 page 번호처럼 동작한다.
- `limit`은 100 기준으로 사용 중이다.
- 대량 sync 중 토큰 만료 가능성이 있어 코드에서는 일정 페이지마다 토큰 갱신을 수행한다.
- 0402 기준 3사이트 회원/consent sync는 동작 확인됨.

### 주문

| Method | URL | 사용 상태 | 주요 필드 |
|---|---|---|---|
| `GET` | `https://api.imweb.me/v2/shop/orders?offset={page}&limit={limit}` | 사용 중 | `order_no`, `order_code`, `channel_order_no`, `order_type`, `sale_channel_idx`, `device`, `order_time`, `complete_time`, `orderer`, `payment`, `use_issue_coupon_codes` |
| `GET` | `https://api.imweb.me/v2/shop/orders/{order_no}` | 수동 검증에 사용 | 주문 헤더 상세. 단, 상품 라인아이템은 확인되지 않음 |
| `GET` | `https://openapi.imweb.me/orders` | 현재 미사용 | 현재 토큰으로는 `401` 발생. 권한/OAuth 확인 필요 |

로컬 캐시에 저장하는 주요 주문 필드:

| 로컬 컬럼 | 원천 필드 |
|---|---|
| `order_no` | `order_no` |
| `order_code` | `order_code` |
| `order_type` | `order_type` |
| `order_time` | `order_time` Unix time 변환 |
| `complete_time` | `complete_time` Unix time 변환 |
| `member_code` | `orderer.member_code` |
| `orderer_call` | `orderer.call` |
| `pay_type` | `payment.pay_type` |
| `pg_type` | `payment.pg_type` |
| `total_price` | `payment.total_price` |
| `payment_amount` | `payment.payment_amount` |
| `coupon_amount` | `payment.coupon` |
| `delivery_price` | `payment.deliv_price` |
| `use_issue_coupon_codes` | `use_issue_coupon_codes[]` |
| `raw_json` | 주문 원본 JSON |

주문 API 한계:

- 레거시 `v2/shop/orders` 페이지네이션은 사이트/limit 조합에 따라 빈 페이지가 섞이는 현상이 확인됐다.
- 더클린커피는 `data_count` 대비 실제 회수 건수가 낮아 전량 정본으로 보기 어렵다.
- 레거시 주문 상세 응답에는 상품 라인아이템이 직접 포함되지 않았다.
- 상품 라인아이템이 필요하면 운영 조회용 `tb_iamweb_users.product_name` 또는 `openapi.imweb.me/orders` 권한 확보가 필요하다.

### 상품

| Method | URL | 사용 상태 | 주요 필드 |
|---|---|---|---|
| `GET` | `https://api.imweb.me/v2/shop/products?offset={page}&limit=100` | 수동 검증에 사용 | `no`, `name`, `price`, `price_org`, `prod_status`, `prod_type`, `categories` |

사용 사례:

- 주문 상세에 상품 라인아이템이 없을 때, 주문 금액과 상품 카탈로그 가격을 교차 확인하는 데 사용했다.
- 예: `base_item_price = 57,000` 주문이 `[정기구독] 썬화이버 프리바이오틱스 식이섬유 210g` 후보인지 가격으로 확인.

### 쿠폰

| Method | URL | 사용 상태 | 주요 필드 |
|---|---|---|---|
| `GET` | `https://api.imweb.me/v2/shop/coupons?offset={page}&limit=100` | 사용 중 | `coupon_code`, `name`, `status`, `type`, `apply_sale_price`, `apply_sale_percent`, `type_coupon_create_count`, `type_coupon_use_count` |
| `GET` | `https://api.imweb.me/v2/shop/issue-coupons/{issueCouponCode}` | 사용 중 | `coupon_code`, `name`, `status`, `type`, `coupon_issue_code`, `shop_order_code`, `use_date` |

사용 사례:

- 로컬 `imweb_orders.use_issue_coupon_codes`에 있는 내부 발행쿠폰 ID를 사람이 읽을 수 있는 쿠폰명으로 백필한다.
- 2026-04-10 기준 최근 로컬 주문 캐시 안의 고유 발행쿠폰코드 매핑은 biocom/thecleancoffee 모두 100% 완료로 기록됐다.

## SEO 백엔드 내부 API

파일: `backend/src/routes/crmLocal.ts`

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/crm-local/imweb/sync-members` | 3사이트 또는 특정 사이트 회원/consent를 로컬 SQLite에 적재 |
| `GET` | `/api/crm-local/imweb/consent-stats` | 로컬 회원 consent 집계 |
| `GET` | `/api/crm-local/imweb/consent-check?phone=...` | 전화번호 기준 consent 조회 |
| `POST` | `/api/crm-local/imweb/sync-orders` | 아임웹 주문을 로컬 SQLite에 적재 |
| `POST` | `/api/crm-local/imweb/sync-coupons` | 쿠폰 마스터 + 미매핑 발행쿠폰명을 로컬 SQLite에 백필 |
| `GET` | `/api/crm-local/imweb/coupon-stats?site=...` | 쿠폰 백필 상태 조회 |
| `GET` | `/api/crm-local/imweb/order-stats?site=...` | 로컬 주문 캐시 상태 조회 |
| `GET` | `/api/crm-local/imweb/toss-reconcile?site=...` | 로컬 아임웹 주문과 Toss 캐시 reconcile |
| `GET` | `/api/crm-local/imweb/pagination-anomalies?site=...&maxPage=...` | 레거시 주문 API 페이지네이션 이상 감지 |

예시:

```bash
# 회원/consent 전체 sync
curl -X POST http://localhost:7020/api/crm-local/imweb/sync-members

# 특정 사이트 회원 sync
curl -X POST http://localhost:7020/api/crm-local/imweb/sync-members \
  -H 'Content-Type: application/json' \
  -d '{"site":"thecleancoffee"}'

# 주문 sync
curl -X POST http://localhost:7020/api/crm-local/imweb/sync-orders \
  -H 'Content-Type: application/json' \
  -d '{"site":"biocom","maxPage":120}'

# 쿠폰명 백필
curl -X POST http://localhost:7020/api/crm-local/imweb/sync-coupons \
  -H 'Content-Type: application/json' \
  -d '{"site":"biocom","maxCouponPage":20,"maxIssueCodes":3000}'

# 쿠폰 백필 상태
curl 'http://localhost:7020/api/crm-local/imweb/coupon-stats?site=biocom'

# 주문 API 페이지네이션 이상 점검
curl 'http://localhost:7020/api/crm-local/imweb/pagination-anomalies?site=thecleancoffee&maxPage=130'
```

## 로컬 SQLite 테이블

파일: `backend/data/crm.sqlite3`

| 테이블 | 역할 |
|---|---|
| `imweb_members` | 아임웹 회원/consent 로컬 캐시 |
| `imweb_orders` | 아임웹 주문 헤더 로컬 캐시 |
| `imweb_coupon_masters` | 아임웹 쿠폰 마스터 로컬 캐시 |
| `imweb_issue_coupons` | 발행쿠폰 ID → 쿠폰명 매핑 캐시 |

중요:

- `imweb_orders`는 주문 헤더 중심이다. 상품 라인아이템 정본으로 쓰면 안 된다.
- 쿠폰명은 `imweb_orders.use_issue_coupon_codes`와 `imweb_issue_coupons.issue_coupon_code`를 조인해서 본다.
- 운영 주문 전체 기간에는 발행쿠폰 ID가 없을 수 있으므로, 전체 기간 쿠폰명 확정은 추가 백필이 필요하다.

## 운영 Postgres 관련

운영 조회용 `tb_iamweb_users`에는 상품 라인아이템이 있다.

확인된 주요 컬럼:

- `order_number`
- `product_name`
- `option_name`
- `order_section_item_no`
- `order_item_code`
- `item_price`
- `base_item_price`
- `coupon_discount`
- `total_price`
- `total_discount_price`
- `payment_method`
- `payment_status`
- `paid_price`
- `payment_complete_time`

사용 기준:

- 상품명/상품군 확정은 가능하면 `tb_iamweb_users.product_name`을 우선한다.
- 같은 주문번호가 여러 상품 라인으로 나뉠 수 있으므로, 주문 단위 매출을 계산할 때는 `order_number` 기준 dedupe가 필요하다.
- 운영 DB는 read-only 조회만 한다. 직접 수정하지 않는다.

## 현재 중요한 한계

1. 레거시 주문 API 페이지네이션이 불안정하다.
2. 레거시 주문 상세 응답만으로는 상품 라인아이템을 확정하기 어렵다.
3. `openapi.imweb.me/orders`는 현재 토큰으로 접근 불가다.
4. 로컬 주문 캐시 기간과 운영 주문 원장 전체 기간이 다를 수 있다.
5. 쿠폰명 백필은 최근 로컬 캐시에 있는 발행쿠폰코드 기준으로 완료된 것이지, 운영 전체 기간 확정은 아니다.

## 참고 파일

- `api.md`
- `imweb/memberagree.md`
- `data/coupon.md`
- `localdb.md`
- `data/metaroas6reply.md`
- `backend/src/routes/crmLocal.ts`
- `backend/src/crmLocalDb.ts`
