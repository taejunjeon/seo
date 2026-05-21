# Safe Event ID Contract

작성 시각: 2026-05-21 KST
목적: Browser Purchase와 Server CAPI가 같은 dedup key를 쓰도록 `payment-decision` 응답 계약을 정의한다.

## 원칙

Browser Purchase의 eventID는 브라우저가 만들지 않는다. 서버가 결제완료를 확인한 뒤 만든 safe event_id만 사용한다.

## 서버 응답 필드

`GET /api/attribution/payment-decision`의 `allow_purchase` 응답에 아래 필드를 추가한다.

```jsonc
{
  "ok": true,
  "decision": {
    "status": "confirmed",
    "browserAction": "allow_purchase",
    "confidence": "high",
    "matchedBy": "fast_ledger_confirmed"
  },
  "dedup": {
    "event_name": "Purchase",
    "event_id_source": "server_generated",
    "event_id_mode": "safe_hash",
    "browser_purchase_event_id": "mcap_<safe_hash>",
    "server_capi_event_id_same": true,
    "dedup_ready": true,
    "ttl_seconds": 120
  },
  "safety": {
    "raw_identifier_output": false,
    "purchase_allowed_only_when_confirmed": true,
    "unknown_fail_open": false
  }
}
```

## 필드 의미

- `browser_purchase_event_id`: 브라우저가 `fbq('track', 'Purchase', ..., { eventID })`에 넣을 값. raw 주문/결제/회원/click id를 포함하면 안 된다.
- `event_id_mode`: `safe_hash`일 때만 Header Guard가 사용할 수 있다.
- `server_capi_event_id_same`: Server CAPI가 실제로 같은 event_id를 쓰는지 알려주는 안전 플래그.
- `dedup_ready`: 브라우저가 eventID를 써도 dedup이 깨지지 않는 상태인지 알려주는 최종 플래그.
- `ttl_seconds`: Header Guard cache 유효 시간. 기본 120초.

## 서버 생성 규칙

서버는 `buildMetaCapiEventId(input, "Purchase")`와 같은 계열의 함수를 사용해야 한다. 단, Browser에 내려주는 값은 항상 safe form이어야 하므로 cutover 전까지는 아래 정책이 필요하다.

| 상태 | `META_CAPI_ENABLE_EVENT_ID_HASH` | `browser_purchase_event_id` | `dedup_ready` | 해석 |
|---|---:|---|---:|---|
| legacy 운영 | false | null 또는 omitted | false | 서버 CAPI가 아직 legacy event_id를 쓰므로 브라우저가 safe eventID를 쓰면 dedup mismatch 위험 |
| safe cutover | true | `mcap_<safe_hash>` | true | Browser와 Server가 같은 safe event_id를 쓸 수 있음 |
| test-only | test mode only | `mcap_<safe_hash>` | true | Meta Test Events에서만 1건 이하 확인 가능 |

## 금지

- `event_id = order_id`
- `event_id = 원문 결제 코드`
- `event_id = 원문 결제 키`
- `event_id = 원문 회원 식별자`
- `event_id = 원문 광고 클릭 식별자`
- Browser JS에서 HMAC secret 보관 또는 계산
- `unknown` 또는 `pending`에서 `browser_purchase_event_id` 발급

## Header Guard v3.1.2 소비 규칙

Header Guard는 아래 조건을 모두 만족할 때만 서버 safe event_id를 사용한다.

1. `decision.browserAction === "allow_purchase"`
2. `decision.status === "confirmed"`
3. `dedup.dedup_ready === true`
4. `dedup.event_id_mode === "safe_hash"`
5. `dedup.browser_purchase_event_id` present

조건 하나라도 실패하면 Browser Purchase는 기존 guard 정책을 따른다. `unknown` fail-open은 계속 금지다.

## sessionStorage cache

cache value에는 아래만 저장한다.

```jsonc
{
  "snippetVersion": "2026-05-21-server-payment-decision-guard-v3-1-2",
  "cachedAt": "ISO",
  "expiresAt": 0,
  "safe_ref": "safe_<hash>",
  "source": "payment-decision",
  "decision": {
    "status": "confirmed",
    "browserAction": "allow_purchase"
  },
  "dedup": {
    "event_id_mode": "safe_hash",
    "browser_purchase_event_id": "mcap_<safe_hash>",
    "dedup_ready": true
  }
}
```

cache key와 cache value 모두 raw order/payment/member/click id를 포함하면 안 된다.

## 성공 기준

- confirmed 구매에서 `browser_purchase_event_id_present=true`.
- pending/unknown/canceled에서 `browser_purchase_event_id_present=false`.
- Browser `eventID`와 Server CAPI `event_id`가 같은 safe string.
- raw identifier scan 0.
- duplicate event_id 0.
- Meta Test Events에서 browser/server dedup pair 확인.
