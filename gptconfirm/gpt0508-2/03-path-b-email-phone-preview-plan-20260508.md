# Path B email/phone Preview 및 no-send HMAC smoke 계획

작성 시각: 2026-05-08 20:38 KST
대상: biocom 결제완료 화면 Path B Preview
Status: preview_plan__execution_requires_yellow_approval
Do not use for: GTM Production publish, live payment-success endpoint call, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - gdn/path-b-email-phone-hash-bridge-approval-20260508.md
    - gdn/guest-order-attribution-ledger-design-v2-20260508.md
  lane: Green plan writing; Yellow required for GTM Preview/no-send smoke execution
  allowed_actions:
    - Preview procedure design
    - no-send smoke response contract design
    - local markdown artifact creation
  forbidden_actions:
    - GTM Production publish
    - Imweb body/footer production save
    - payment_success live endpoint call
    - backend deploy
    - operational schema migration
    - raw email/phone/member_code storage
    - raw logging
    - platform send
  source_window_freshness_confidence:
    source: "TJ Tag Assistant evidence + GTM read-only inventory + local backend attribution snippet review"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:38 KST"
    confidence: 0.83
```

## 10초 결론

Path B Preview의 목적은 “실제 결제완료 화면에서 주문과 클릭을 잇는 재료가 보이는지” 확인하는 것이다. 여기서 구매 전송이나 저장을 하면 안 된다.

성공 기준은 네 가지다. `email_hash_present`, `phone_hash_present`, `order_no_hash_present`, `client_session_present` 중 무엇이 실제로 가능한지 확인해야 한다.

## 이번 Preview가 말하는 것

- 결제완료 화면에서 email/phone/order/session/click 후보가 보이는지.
- raw 값을 우리 HTTPS no-send endpoint에서 transient로만 받아 저장하지 않고 HMAC만 만들 수 있는지.
- response/log/storage에 raw 값이 남지 않는지.
- 비회원 주문까지 커버할 수 있는 Path B가 현실적인지.

## 이번 Preview가 말하지 않는 것

- 실제 구매 전송이 좋아졌다는 뜻이 아니다.
- Google Ads ROAS가 개선됐다는 뜻이 아니다.
- 운영 저장 canary가 시작됐다는 뜻이 아니다.
- GTM Production publish가 승인됐다는 뜻이 아니다.

## Preview 범위

허용:

- GTM fresh workspace Preview.
- 테스트 주문 또는 controlled checkout flow.
- no-send HMAC endpoint 호출.
- response에서 hash present 여부만 확인.
- browser Network tab과 Tag Assistant evidence 수집.

금지:

- GTM Production publish.
- Imweb production body/footer 저장.
- 기존 `/api/attribution/payment-success` live endpoint 호출.
- platform 전송.
- raw email/phone/member_code 저장.
- raw request body logging.
- order/payment/value/payment_key 저장.

## no-send endpoint 계약안

실행 전 backend deploy가 필요하므로 이 문서는 endpoint 설계까지만 다룬다.

```http
POST /api/attribution/order-bridge/identity-hmac/no-send
Content-Type: application/json
```

request 후보:

```json
{
  "site": "biocom",
  "capture_stage": "order_confirm_preview",
  "email": "<transient only>",
  "phone": "<transient only>",
  "order_no": "<transient only>",
  "client_id": "GA client id when available",
  "ga_session_id": "GA session id when available",
  "local_session_id": "local/session source when available",
  "click_id": "gclid/gbraid/wbraid/ttclid/naver click id when available",
  "preview_mode": true
}
```

response 후보:

```json
{
  "ok": true,
  "would_store": false,
  "would_send": false,
  "email_hash_present": true,
  "phone_hash_present": true,
  "order_no_hash_present": true,
  "client_session_present": true,
  "no_raw_echo_verified": true,
  "no_platform_send_verified": true,
  "hash_version": "hmac_sha256_identity_v1"
}
```

response에는 raw email, raw phone, raw order number, payment key, value를 넣지 않는다.

## 확인 케이스

1. 로그인 홈페이지 결제완료.
2. 비로그인 홈페이지 결제완료.
3. NPay 결제 시작 후 복귀 케이스가 있으면 별도 확인.
4. NPay가 결제완료 페이지로 복귀하지 않으면 `npay_no_thanks_page`로 분리 기록.

## 수집할 evidence

- Tag Assistant event 이름.
- Network request URL은 no-send endpoint인지.
- response의 `would_store=false`.
- response의 `would_send=false`.
- `email_hash_present` 값.
- `phone_hash_present` 값.
- `order_no_hash_present` 값.
- `client_session_present` 값.
- console error 0 여부.
- platform request 0 여부.

## Hard Fail

- raw email/phone/order/member_code가 Google/GA4/Meta/TikTok/Naver 같은 외부 플랫폼 network payload에 포함된다.
- response/log/storage에 raw email/phone/order/member_code가 보인다.
- live payment-success endpoint가 호출된다.
- `would_store=true`가 나온다.
- `would_send=true`가 나온다.
- Google Ads/GA4/Meta/TikTok/Naver 전송 request가 새로 발생한다.
- browser console에서 endpoint error가 반복된다.

우리 HTTPS no-send endpoint request에 raw email/phone/order가 transient로 들어오는 것은 HMAC 생성 목적에 한해 허용한다. 단, response/log/storage에는 남으면 안 된다.

## PASS/HOLD/FAIL

PASS:

- raw echo 0, raw logging 0, platform send 0.
- email 또는 phone hash가 하나 이상 present.
- order_no_hash와 client/session 후보가 함께 present.

HOLD:

- hash 후보는 보이나 order/session/click 후보가 부족하다.
- NPay가 thanks page로 복귀하지 않아 홈페이지 결제만 확인된다.
- no-send endpoint가 아직 없어 Preview 증거만 확보된다.

FAIL:

- raw 값이 response/log/storage에 남는다.
- live endpoint 또는 platform send가 발생한다.
- 결제완료 화면에서 bridge 재료가 전혀 보이지 않는다.

## 다음 승인 포인트

이 계획을 실행하려면 TJ님이 GTM Preview와 no-send HMAC smoke를 승인해야 한다. 단, 이 승인은 Production publish나 운영 저장 승인이 아니다.
