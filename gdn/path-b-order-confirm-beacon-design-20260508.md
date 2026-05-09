# Path B order-confirm beacon 설계

작성 시각: 2026-05-08 20:17 KST
대상: biocom confirmed purchase attribution bridge / Path B
Status: design_draft_green_no_send_no_write
Do not use for: GTM Production publish, Imweb body/footer save, backend deploy, raw order/email/phone/payment/value storage, platform send

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
    - data/biocom-live-tracking-inventory-20260501.md
    - data/biocom-npay-intent-beacon-preview-design-20260501.md
    - gdn/path-c-wrapper-preview-result-20260508.md
    - gdn/path-c-member-code-source-discovery-20260508.md
  lane: Green design draft
  allowed_actions:
    - local docs/code read-only inspection
    - GTM read-only inventory reference
    - no-send/no-write design document
  forbidden_actions:
    - GTM Production publish
    - GTM tag pause/delete
    - Imweb production body/footer save
    - backend deploy
    - raw order_number/email/phone/payment_key/value storage
    - GA4/Meta/Google Ads/TikTok/Naver send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "Path C source discovery + GTM fallback inventory + live tracking inventory + local attribution/payment-success code"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:17 KST"
    confidence: 0.84
```

## 10초 결론

Path B는 결제완료 화면에서 주문과 클릭을 이어주는 `주문 단위 다리`다.

Path C는 회원코드 기반이라 비회원에 약하고, 2026-05-08 현재 브라우저/GTM에서 usable `member_code` source도 보이지 않는다. 그래서 다음 우선 설계는 Path B다. 단, **raw order_number, email, phone, payment_key, value는 저장하지 않고 HMAC hash와 세션/클릭 hash만 남기는 no-send/no-write Preview부터 시작**해야 한다.

## 쉬운 설명

- Path C: 회원번호로 주문과 광고 클릭을 잇는다. 회원 주문에는 좋지만, 비회원에는 약하다.
- Path B: 결제완료 페이지에서 생기는 주문 흔적과 브라우저 세션을 잇는다. 회원/비회원 모두 후보가 된다.
- 지금 필요한 것: 실제 전송이 아니라, “결제완료 페이지에서 안전한 연결키를 만들 수 있는가”를 확인하는 설계다.

## 현재 근거

1. `gdn/path-c-member-code-source-discovery-20260508.md` 기준 usable browser `member_code` source는 0건이다.
2. `data/path-bridge-fallback-inventory-20260508.json` 기준 order/payment 후보는 2개(`JS - Purchase Transaction ID (fallback chain)`, purchase 값 주입 태그)다.
3. 기존 `backend/src/imwebAttributionSnippet.ts`는 `shop_payment_complete` 또는 `shop_order_done`에서 `order_no`, `paymentKey`, GA client/session 후보를 읽는 구조가 있다.
4. 기존 구조는 live `/api/attribution/payment-success` 전송과 원문 order/payment key를 포함할 수 있으므로, 이번 Path B 설계에 그대로 쓰면 안 된다.
5. NPay는 외부 결제창에서 완료되고 biocom thanks page로 돌아오지 않는 경우가 있어, NPay no-return 케이스는 별도 분리해야 한다.

## Path B가 봐야 하는 값

### 저장 허용 후보

| field | 의미 | 저장 방식 |
|---|---|---|
| `order_no_hash` | 주문번호를 직접 저장하지 않고 만든 주문 키 | HMAC-SHA256, raw 저장 금지 |
| `order_code_hash` | Imweb order_code 후보 | HMAC-SHA256, raw 저장 금지 |
| `payment_key_hash` | 결제키 후보. 선택 필드 | HMAC-SHA256, raw 저장 금지 |
| `client_id` | GA client id | 저장 후보. 필요 시 hash 전환 가능 |
| `ga_session_id` | GA session id | 저장 후보 |
| `local_session_id_hash` | `__seo_funnel_session` 또는 Imweb session | HMAC-SHA256 |
| `click_id_hash` | paid click id hash | 기존 paid_click_intent와 같은 hash 정책에 맞춤 |
| `pay_type` | homepage/npay/card 등 결제수단 구분 | allowlist string |
| `pg_type` | 결제 PG 구분 | allowlist string |
| `capture_stage` | `order_confirm`, `shop_payment_complete`, `shop_order_done` 등 | allowlist string |
| `member_code_hash` | 있으면 회원 bridge도 함께 보강 | nullable, raw 금지 |

### 저장 금지

```text
raw order_number
raw order_no
raw order_code
raw payment_key
raw email
raw phone
raw name
raw address
raw value
raw currency
raw request body
```

## Preview 설계

### Step 1. no-send/no-write page probe

목적: 결제완료 화면에서 어떤 값이 보이는지만 확인한다.

허용:

- 로컬/Preview snippet에서 DOM, URL query, dataLayer, sessionStorage key presence만 확인.
- raw 값을 저장하지 않고 `present/type/length/prefix category` 정도만 문서화.
- Network call 없음.

금지:

- `/api/attribution/payment-success` 호출.
- `/api/attribution/paid-click-intent` 호출.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- 실제 결제 테스트.

### Step 2. no-send receiver preview

목적: hash payload 형태가 안전한지 확인한다.

허용 후보:

```json
{
  "site": "biocom",
  "mode": "preview_no_send",
  "capture_stage": "order_confirm",
  "order_no_hash_present": true,
  "client_id_present": true,
  "ga_session_id_present": true,
  "local_session_id_hash_present": true,
  "click_id_hash_present": true,
  "pay_type": "homepage_or_npay",
  "pg_type": "imweb_or_npay",
  "would_send": false,
  "would_store": false
}
```

성공 기준:

- raw order/payment/email/phone/value가 payload에 없다.
- `would_send=false`, `would_store=false`다.
- Production publish 0건이다.
- 기존 live purchase/npay intent endpoint를 호출하지 않는다.

## NPay 케이스 분리

| 케이스 | Path B 가능성 | 해석 |
|---|---|---|
| 홈페이지 일반 PG가 `shop_payment_complete`로 복귀 | 높음 | order_confirm beacon으로 회원/비회원 모두 bridge 가능 |
| NPay가 biocom thanks page로 복귀 | 중간 | return URL과 실제 복귀율 확인 필요 |
| NPay가 외부 결제 후 biocom으로 복귀하지 않음 | 낮음 | Path B browser beacon만으로는 부족. 운영 주문 API 또는 Path C/server bridge 필요 |
| 비회원 NPay | 미확정 | thanks page 복귀가 없으면 browser bridge 불가. order API/server bridge를 검토 |

## 기존 코드와의 차이

기존 `payment_success` snippet은 운영용 live endpoint 호출 구조다. Path B Preview는 그 코드를 복붙하지 않는다.

필요한 차이:

1. endpoint는 `/no-send` 계열이어야 한다.
2. raw `orderId/paymentKey/value`를 보내지 않는다.
3. 저장도 하지 않는다.
4. network call 자체도 Preview 1단계에서는 하지 않는다.
5. `order_no_hash`는 browser 단순 SHA-256이 아니라 server HMAC 또는 controlled test에서만 검토한다.

## 승인 전 체크리스트

Path B를 Yellow Preview로 올릴 때 필요한 조건:

1. 확인 화면: `shop_payment_complete`, `shop_order_done`, NPay return 후보 URL.
2. raw 값 금지: order/payment/email/phone/value 0건.
3. hash 방식: `HMAC-SHA256(raw, server_secret)`.
4. secret 위치: repo에 저장하지 않음.
5. receiver mode: `no-send`, `no-write`.
6. rollback: GTM Preview workspace discard 또는 tag pause.
7. success: 회원/비회원 각각 key presence 판정.
8. fail: raw 값 노출, live endpoint 호출, platform send 발생 시 즉시 중단.

## 결론

Path B는 지금 가장 실용적인 다음 후보지만, 바로 운영 publish가 아니다.

```text
Path B design: YES
Preview-only 승인안 작성: 다음 후보
Production publish: NO
raw order/payment/value 저장: NO
NPay no-return 완전 해결: 아직 NO, 별도 server/order bridge 필요
```

## 다음 할일

1. 비회원까지 커버하는 `order_bridge_ledger` schema를 별도 문서로 확정한다.
2. Path B Preview 승인안은 `no-send/no-write`와 raw 금지 증거 중심으로 작성한다.
3. NPay return 여부는 실제 결제 없이 read-only 문서/설정/기존 로그로 먼저 확인한다.
