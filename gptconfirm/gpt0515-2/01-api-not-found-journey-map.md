# 01. API not found journey map

작성 시각: 2026-05-15 00:55 KST

## 결론

API not found 48건은 “Meta가 잡은 주문”이 아니라 VM Cloud `payment_success` pending 후보 중 Imweb/운영DB 정본으로 닫히지 않은 row다.

출발점은 48건 모두 `footer_v4_3_payment_success`다. GTM trigger나 FBE/browser pixel-only 이벤트가 직접 만든 row로 보이지 않는다.

## Source / Window / Freshness

- source: VM Cloud SQLite `attribution_ledger`, VM Cloud SQLite `imweb_orders`, 운영DB `dashboard.public.tb_iamweb_users` read-only evidence, Imweb v2 API fallback evidence.
- window: `logged_at >= 2026-05-14T04:00:00.000Z`.
- freshness: 2026-05-15 00:55 KST.
- confidence: 0.82.

## 공통 journey

1. 고객이 `biocom.kr/shop_payment/` 결제 흐름 페이지에 도달한다.
2. 아임웹 footer v4.3 코드가 order_code/order_no/orderIdBase를 읽는다.
3. 코드가 VM Cloud `/api/attribution/payment-success`로 `payment_success` 후보를 보낸다.
4. VM Cloud는 `source=biocom_imweb`, `capture_mode=live`, `payment_status=pending`으로 저장한다.
5. 이후 운영DB `PAYMENT_COMPLETE` 또는 Imweb API confirmed status가 닫히면 confirmed 후보가 된다.
6. 닫히지 않으면 pending/API not found로 남는다.

## 시작 경로 분해

- `footer_v4_3_payment_success`: 66/66 current pending rows.
- `gtm_triggered_event`: 0/66. metadata/request context에 GTM hint 없음.
- `fbe_browser_pixel_only`: 0/66. 이 row의 직접 origin은 VM Cloud endpoint다.
- `backend_auto_sync`: 0/66. backend auto sync send log와는 별도다.
- `unknown`: 0/66 at start-path level.

주의: `fbp`는 66/66 있고 `fbclid/fbc`도 일부 있다. 이것은 Meta attribution evidence이지 row의 출발점이 FBE/browser pixel이라는 뜻이 아니다.

## field presence

- snippetVersion: 66/66 `2026-05-14-biocom-payment-success-click-id-v4-3`
- source/touchpoint/capture: 66/66 `biocom_imweb / payment_success / live`
- request path: 66/66 `/api/attribution/payment-success`
- checkout/payment URL pattern: 66/66 `/shop_payment/`
- order_code: 66/66 present
- order_no: 66/66 present
- order_member: 0/66
- transaction_id: 0/66
- payment_key: 0/66
- value: 0/66
- gclid: 9/66
- gbraid: 1/66
- wbraid: 0/66
- fbclid column: 21/66
- fbc: 25/66
- fbp: 66/66

## 반복성

- same order key repeated count: 0. 같은 주문키가 여러 번 반복된 문제는 현재 주요 원인이 아니다.
- same session repeated: 3개 session group / 10 rows. 일부 사용자가 같은 세션에서 여러 결제 흐름 후보를 만들었을 가능성은 있다.

## API not found 48건 분류

| safe_ref group | count | A-H 분류 | Meta send | 근거 |
|---|---:|---|---|---|
| `API-NF-001` ~ `API-NF-012` | 12 | D. checkout_or_payment_page_artifact | no-send | footer v4.3 + `/shop_payment/` + payment_key/value 없음 + 정본 match 없음 |
| `API-NF-013` ~ `API-NF-024` | 12 | D. checkout_or_payment_page_artifact | no-send | 같은 패턴 |
| `API-NF-025` ~ `API-NF-036` | 12 | D. checkout_or_payment_page_artifact | no-send | 같은 패턴 |
| `API-NF-037` ~ `API-NF-048` | 12 | D. checkout_or_payment_page_artifact | no-send | 같은 패턴 |

## A-H 카운트

- A. real_order_confirmed: 0 within API not found 48.
- B. real_order_pending_unpaid: 0. payment API/status가 pending unpaid로 닫힌 것은 없음.
- C. canceled_or_refunded: 별도 1건 / 234,000원. API not found 48에는 넣지 않음.
- D. checkout_or_payment_page_artifact: 48.
- E. key_mapping_error: 0 confirmed. 단 status-list/API 오류가 있어 일부는 재검증 필요.
- F. api_window_or_pagination_miss: current latest 증가분과 VM Cloud cache blank 8건은 이 bucket 가능성 있음.
- G. source_or_site_mismatch: 0. 더클린커피 API 직접조회에서는 found 0이었고, source는 biocom_imweb로 일관.
- H. unknown_need_admin_ui: 최신 status-list 오류/증가분은 관리자 UI 확인 후보.

## 결론

API not found 48건은 Meta send 후보 0이다.

payment_success footer 신호는 “결제 흐름 도달” 후보이지 “실제 결제완료” 정본이 아니다. 운영DB/Imweb/API/cache 중 하나가 결제완료를 닫아줄 때만 bridge 후보로 올릴 수 있다.
