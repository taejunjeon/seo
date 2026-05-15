# 02. payment_page_seen Data Contract

작성 시각: 2026-05-15 01:32 KST

## 결론

`payment_page_seen`은 구매완료가 아니다. 결제 페이지에서 무슨 일이 있었는지 보는 진단 신호다.

이 신호는 Meta Purchase 후보가 될 수 없다. 예산 판단이나 ROAS 계산에도 자동 포함하지 않는다.

## contract 목적

`/shop_payment/`에서 아래를 알기 위한 신호다.

1. 고객이 결제 단계에 도달했는가.
2. 어떤 결제수단을 보거나 선택했는가.
3. NPay 버튼을 보거나 눌렀는가.
4. 회원/비회원 흐름인가.
5. 결제 페이지에서 머문 시간과 스크롤 깊이는 어느 정도인가.
6. GA4/Meta/Google click id join key가 살아 있는가.

## recommended endpoint

정식 권장:

- `POST /api/attribution/payment-page-seen`

빠른 호환:

- `POST /api/attribution/checkout-context`
- metadata에 `semantic_touchpoint=payment_page_seen` 기록

## payload shape

```json
{
  "touchpoint": "payment_page_seen",
  "captureMode": "live",
  "source": "biocom_imweb",
  "checkoutId": "safe runtime value",
  "clientObservedAt": "ISO timestamp",
  "landing": "current page URL",
  "referrer": "document referrer",
  "ga_session_id": "runtime value if present",
  "client_id": "runtime value if present",
  "user_pseudo_id": "runtime value if present",
  "utm_source": "runtime value if present",
  "utm_medium": "runtime value if present",
  "utm_campaign": "runtime value if present",
  "utm_content": "runtime value if present",
  "utm_term": "runtime value if present",
  "gclid": "runtime value if present",
  "fbclid": "runtime value if present",
  "ttclid": "runtime value if present",
  "fbc": "runtime value if present",
  "fbp": "runtime value if present",
  "metadata": {
    "snippetVersion": "2026-05-15-biocom-payment-event-split-v4-4-draft",
    "semantic_touchpoint": "payment_page_seen",
    "event_phase": "page_entry or page_exit",
    "page_location_class": "shop_payment",
    "is_purchase_candidate": false,
    "meta_purchase_candidate": false,
    "completion_url": false,
    "order_code_present": true,
    "order_no_present": true,
    "member_present": false,
    "guest_checkout": true,
    "selected_payment_method": "card | npay | virtual_account_or_bank_transfer | kakao_pay | toss | unknown_selected",
    "payment_method_attempted": "same enum",
    "card_attempted": false,
    "virtual_account_selected": false,
    "virtual_account_issued": false,
    "npay_button_seen": false,
    "npay_button_clicked": false,
    "cart_value_present": false,
    "item_count": 0,
    "product_count": 0,
    "scroll_max_percent": 0,
    "visible_seconds": 0,
    "time_on_page_ms": 0,
    "page_entered_at": "ISO timestamp",
    "page_left_at": "ISO timestamp if known",
    "ga_session_id_present": false,
    "client_id_present": false,
    "user_pseudo_id_present": false,
    "fbp_present": false,
    "fbc_present": false,
    "fbclid_present": false,
    "gclid_present": false,
    "gbraid_present": false,
    "wbraid_present": false,
    "value_guard_required_before_meta_send": true
  }
}
```

## field meaning

### 결제수단

- `selected_payment_method`: DOM에서 현재 선택된 결제수단으로 추정한다.
- `payment_method_attempted`: 사용자가 클릭하거나 선택한 결제수단으로 추정한다.
- `virtual_account_issued`: 현재 v4.4 draft에서는 false다. 실제 발급 여부는 완료/결과 페이지 또는 Imweb API confirmed source가 필요하다.

### NPay

- `npay_button_seen`: 결제 페이지에서 NPay 버튼/텍스트/DOM marker가 보였는지.
- `npay_button_clicked`: 같은 페이지에서 NPay 관련 DOM을 클릭했는지.
- 둘 다 actual purchase가 아니다.
- NPay actual은 별도 NPay actual path 또는 Imweb/운영DB confirmed source가 필요하다.

### 회원/비회원

- `member_present`: URL 또는 session context에 회원 key presence가 있는지.
- `guest_checkout`: member key presence가 없으면 true.
- raw member id는 보고서/텔레그램/git에 출력하지 않는다.

### scroll/dwell

- `scroll_max_percent`: 페이지에서 관측한 최대 스크롤 비율.
- `visible_seconds`: visible 상태였던 초 단위 시간.
- `time_on_page_ms`: 페이지 진입 후 경과 시간.
- pagehide/visibilitychange에서 exit 이벤트를 보내면 더 정확해진다.

## 지금 backend에서 안 되는 것

현재 `backend/src/attribution.ts`의 `AttributionTouchpoint`에는 `payment_page_seen`이 없다.

현재 `/api/attribution/checkout-context` route는 `buildLedgerEntry("checkout_started", ...)`를 강제한다. 따라서 빠른 적용안으로는 metadata marker는 남지만 ledger touchpoint는 `checkout_started`가 된다.

정식 분리를 하려면 아래 중 하나가 필요하다.

1. 신규 `/api/attribution/payment-page-seen`.
2. `/api/attribution/checkout-context`가 allowlist touchpoint를 읽도록 확장.
3. 별도 diagnostic ledger에 저장.

## Purchase 후보 금지 규칙

`payment_page_seen` row는 아래 조건과 무관하게 Purchase 후보가 아니다.

- fbp/fbc/fbclid가 있어도 Purchase 후보 아님.
- gclid/gbraid/wbraid가 있어도 Purchase 후보 아님.
- order key presence가 있어도 Purchase 후보 아님.
- NPay button clicked가 있어도 Purchase 후보 아님.
- cart value가 있어도 Purchase 후보 아님.

Purchase 후보가 되려면 완료 URL `payment_success` + 운영DB/Imweb confirmed + value guard가 필요하다.
