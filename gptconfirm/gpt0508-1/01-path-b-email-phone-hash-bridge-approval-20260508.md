# Path B email/phone hash bridge 승인안 v1

작성 시각: 2026-05-08 20:38 KST
대상: biocom 주문-클릭 연결 보강(Path B)
Status: approval_packet_v1__hash_only_preview_and_smoke_candidate
Do not use for: raw email/phone 저장, raw email/phone logging, GTM Production publish, backend deploy, platform send

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
    - gdn/path-c-member-code-source-discovery-20260508.md
    - gdn/email-like-bridge-risk-review-20260508.md
    - gdn/path-b-order-confirm-beacon-design-20260508.md
  lane: Green approval packet writing; Yellow required for Preview/no-send smoke execution
  allowed_actions:
    - local markdown approval packet creation
    - GTM/API/code/docs read-only evidence reference
    - hash-only bridge design
  forbidden_actions:
    - raw email/phone/member_code storage
    - raw email/phone/member_code logging
    - GTM Production publish
    - Imweb body/footer production save
    - backend deploy
    - operational schema migration
    - GA4/Meta/Google Ads/TikTok/Naver send
    - Google Ads conversion upload
    - tag pause/delete
  source_window_freshness_confidence:
    source: "TJ Tag Assistant 200/201/203 evidence + GTM Default Workspace read-only inventory + local backend/docs"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:38 KST"
    confidence: 0.86
```

## 10초 결론

Path C는 회원코드로 주문과 광고 클릭을 직접 잇는 길이다. 그런데 2026-05-08 Preview에서는 브라우저/GTM에서 쓸 수 있는 `member_code` source가 보이지 않았다.

따라서 빠른 다음 후보는 Path B다. Path B는 결제완료 화면에서 주문번호, 세션, 클릭 ID, 이메일/전화 해시를 함께 받아 주문과 클릭을 잇는 길이다. 단, 이메일/전화 원문은 저장하지 않는다. HTTPS 요청으로 서버에 순간적으로 들어온 뒤 즉시 정규화하고 HMAC-SHA256 해시만 남겨야 한다.

## 승인 판단

추천 판단: **Preview + no-send HMAC smoke 준비는 YES 후보**, 운영 저장 canary는 별도 Yellow 승인 전 HOLD.

승인하면 하는 일은 `email_hash`와 `phone_hash`가 주문-클릭 연결키로 쓸 수 있는지 안전하게 확인하는 것이다. 승인하지 않으면 비회원 주문과 현재 `member_code`가 없는 회원 주문은 계속 deterministic bridge 없이 남는다.

## 왜 필요한가

현재 live paid click intent 원장에는 주문별 deterministic bridge가 없다. PG 주문에도 `client_id`나 `ga_session_id`가 없어 주문과 클릭을 1:1로 안정적으로 붙일 수 없다.

`member_code_hash`가 최선의 회원 bridge지만, 브라우저 source가 아직 발견되지 않았다. 그래서 회원/비회원 모두 커버할 수 있는 fallback 후보로 `email_hash`와 `phone_hash`를 검토한다.

## 저장 원칙

- raw email 저장 금지.
- raw phone 저장 금지.
- raw request body 저장 금지.
- raw email/phone/member_code 로그 금지.
- 서버 response에 raw email/phone/member_code 반환 금지.
- 저장 가능 값은 `email_hash`, `phone_hash`, `identity_hash_version`, `identity_source`뿐이다.
- 목적은 attribution bridge와 confirmed_purchase no-send 후보 생성으로 제한한다.
- TTL은 90일이다.
- platform send는 0건이어야 한다.

## transient 처리 원칙

raw email/phone은 브라우저에서 우리 HTTPS backend no-send endpoint에 순간적으로 들어올 수 있다. 이 허용은 HMAC 생성을 위한 transient 전달 허용이지 저장 허용이 아니다.

서버는 요청을 받으면 아래 순서만 수행한다.

1. raw email/phone을 메모리에서만 읽는다.
2. 정규화한다.
3. `ORDER_BRIDGE_IDENTITY_HASH_SECRET`으로 HMAC-SHA256을 계산한다.
4. raw 값을 즉시 폐기한다.
5. 로그와 응답에는 raw 값을 절대 남기지 않는다.

## 정규화 규칙 v1

이메일:

```text
email_normalized = trim(raw_email).toLowerCase()
```

전화번호:

```text
phone_digits = raw_phone에서 숫자만 남김
phone_normalized = phone_digits
```

전화번호는 v1에서 digits-only를 기본으로 둔다. E.164 변환은 국가/국제번호 오해가 생길 수 있으므로 v1 smoke에서는 보조 검토만 한다.

## 해시 규칙 v1

```text
email_hash = HMAC-SHA256(email_normalized, ORDER_BRIDGE_IDENTITY_HASH_SECRET)
phone_hash = HMAC-SHA256(phone_normalized, ORDER_BRIDGE_IDENTITY_HASH_SECRET)
identity_hash_version = hmac_sha256_identity_v1
```

secret은 git에 저장하지 않는다. 운영에서는 process env 또는 secret manager에 넣는다. smoke response에는 full hash를 반환하지 않고 `email_hash_present`, `phone_hash_present`, 선택적으로 8자 prefix만 반환한다.

## 허용 범위

- GTM Preview에서 값 존재 여부 확인.
- no-send endpoint로 HMAC smoke 설계 또는 별도 승인 후 실행.
- response/log/storage에서 raw 값이 없는지 확인.
- `would_store=false`, `would_send=false`로 안전 확인.
- hash-only canary 승인안 작성.

## 금지 범위

- GTM Production publish.
- Imweb production body/footer 저장.
- backend deploy.
- 운영 schema migration.
- raw email/phone/member_code 저장.
- raw email/phone/member_code 로그.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- Google Ads conversion upload.
- existing tag pause/delete.

## Hard Fail

- raw email/phone/member_code가 Google/GA4/Meta/TikTok/Naver 같은 외부 플랫폼 network payload에 포함된다.
- raw email/phone/member_code가 no-send backend response, server/application/access log, storage에 보인다.
- server/application/access log에 raw request body가 남는다.
- `would_send=true` 또는 platform send가 발생한다.
- live payment-success endpoint를 호출한다.
- order/payment/value/payment_key가 저장 후보에 섞인다.

## Success Criteria

- 결제완료 화면 또는 주문 단계에서 `email_hash_present` 또는 `phone_hash_present`를 확인한다.
- `order_no_hash_present`와 `client_session_present`가 함께 확인된다.
- raw stored 0, raw logged 0, platform send 0이다.
- `would_store=false` 상태에서 smoke가 끝난다.
- 다음 단계로 1h hash-only canary 승인 여부를 판단할 수 있다.

## 승인 문구 초안

```text
YES: Path B email/phone hash-only Preview + no-send HMAC smoke를 승인합니다.
조건: GTM Production publish 금지, backend 운영 저장 금지, raw email/phone/member_code 저장 및 logging 금지, platform send 금지.
raw email/phone이 우리 HTTPS no-send endpoint로 transient 전달되는 것은 HMAC 생성 목적에 한해 허용하되, 서버는 즉시 normalize + HMAC-SHA256 후 폐기합니다.
response에는 raw 값 없이 *_hash_present 또는 짧은 hash prefix만 허용합니다.
```

## 지금 결론

이 승인은 실제 광고 플랫폼 전송 승인이 아니다. 구매완료 주문을 더 정확히 잇기 위한 **hash-only 연결키 검증 승인안**이다.
