# Path B no-send HMAC endpoint 로컬 구현 보고

작성 시각: 2026-05-08 23:03 KST
작업 시작: 2026-05-08 22:59 KST
작업 종료: 2026-05-08 23:06 KST
작업 소요 시간: 7분
대상: biocom Path B email/phone hash-only bridge
Status: local_implementation_fixture_pass__no_deploy
Do not use for: backend 운영 deploy, operational schema migration, GTM Production publish, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - ../AGENTS.md
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
    - gdn/path-b-email-phone-preview-plan-20260508.md
  lane: Green local implementation and fixture test
  allowed_actions:
    - local backend source edit
    - local fixture test
    - local markdown report
  forbidden_actions:
    - backend 운영 deploy
    - operational schema migration
    - GTM Production publish
    - Imweb production save
    - 1h hash-only canary 운영 저장
    - raw email/phone/member_code 저장 또는 logging
    - Google Ads/GA4/Meta/TikTok/Naver 전송
    - Google Ads conversion upload
    - 기존 GTM tag pause/delete
  source_window_freshness_confidence:
    source: "local backend source + node:test fixture smoke"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:03 KST"
    confidence: 0.88
```

## 10초 결론

Path B Preview용 no-send HMAC endpoint 로컬 초안을 만들었다. 이 endpoint는 이메일/전화/주문번호를 저장하지 않고, HMAC 생성 후 response에는 present 여부와 짧은 hash prefix만 돌려준다.

운영 배포는 하지 않았다. 지금 상태는 local fixture PASS다.

## 만든 것

1. `backend/src/orderBridgeIdentityHmac.ts`
   - email normalize: `trim().toLowerCase()`.
   - phone normalize: 숫자만 남김.
   - HMAC: `HMAC-SHA256(value, ORDER_BRIDGE_IDENTITY_HASH_SECRET)`.
   - response에는 full hash가 아니라 8자 prefix와 present boolean만 포함.
   - safe log record에도 raw email/phone/order/session/click id를 넣지 않음.

2. `backend/src/routes/attribution.ts`
   - `POST /api/attribution/order-bridge/identity-hmac/no-send` 추가.
   - `would_store=false`, `would_send=false`.
   - `no_platform_send_verified=true`.
   - `ORDER_BRIDGE_IDENTITY_HASH_SECRET`이 없거나 너무 짧으면 503으로 차단.

3. `backend/tests/order-bridge-identity-hmac.test.ts`
   - normalize fixture.
   - HMAC fixture smoke.
   - response raw echo 0.
   - safe log raw echo 0.
   - no platform send 0.

## endpoint 응답 원칙

응답에 들어갈 수 있는 값:

- `email_hash_present`
- `phone_hash_present`
- `order_no_hash_present`
- `client_session_present`
- `click_id_hash_present`
- `identity_source`
- `hash_version`
- 8자 hash prefix

응답에 들어가면 안 되는 값:

- raw email
- raw phone
- raw order number
- raw member_code
- raw payment key
- raw value/currency
- raw local session id
- raw click id

## fixture 검증 결과

명령:

```bash
npm --prefix backend run typecheck
node --import tsx --test tests/order-bridge-identity-hmac.test.ts
```

결과:

- typecheck PASS.
- fixture smoke 4개 PASS.
- raw echo 0 assertion PASS.
- raw logging 0 assertion PASS.
- no platform send 0 assertion PASS.

## 하지 않은 것

- backend 운영 deploy 하지 않음.
- operational schema migration 하지 않음.
- GTM Production publish 하지 않음.
- Imweb production save 하지 않음.
- 운영 저장 canary 열지 않음.
- 외부 플랫폼 전송 0건.

## 현재 판정

로컬 구현 초안은 Green 범위에서 PASS다. 다음 병목은 이 endpoint를 제한 배포할지, 또는 GTM Preview 전에 local/tunnel 방식으로 smoke할지 정하는 것이다.
