# Path B GTM Preview 결과

작성 시각: 2026-05-09 00:08 KST
대상: Path B email/phone/order/session hash-only Preview
Lane: Yellow approved Preview only
Mode: no-publish / no-write / no-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
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
  lane: Yellow approved Preview only
  allowed_actions:
    - GTM fresh workspace Preview
    - no-send endpoint call
    - hash-only evidence collection
  forbidden_actions:
    - Default Workspace editing
    - GTM Production publish
    - Imweb production save
    - live payment-success endpoint call
    - raw email/phone/member_code/order storage or logging
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete
  source_window_freshness_confidence:
    source: "Mode A endpoint smoke + GTM access state"
    window: "2026-05-09 00:02-00:08 KST"
    freshness: "2026-05-09 00:08 KST"
    confidence: 0.78
```

## 10초 결론

GTM Preview 실행 자체는 아직 완료되지 않았다.
이유는 승인 부족이 아니라 Google Tag Manager 화면과 Google 계정/2FA 세션 접근이 필요한 외부 UI 작업이기 때문이다.

대신 서버 준비는 완료됐다. Path B no-send endpoint는 HTTPS에서 200/413/CORS/raw echo 0/raw log 0/platform send 0 smoke를 통과했다.

## 현재 상태

- no-send endpoint 준비: PASS.
- GTM Preview fresh workspace 실행: PENDING, TJ님 UI 실행 필요.
- Default Workspace 사용: 하지 않음.
- Production publish: 하지 않음.
- Imweb production save: 하지 않음.
- live payment-success endpoint call: 하지 않음.
- platform send: 하지 않음.

## TJ님이 Preview에서 확인할 것

1. GTM에서 Default Workspace가 아니라 새 workspace를 만든다.
2. Path B Preview tag는 결제완료 화면 scope에만 둔다.
3. All Pages trigger는 쓰지 않는다.
4. endpoint는 아래만 사용한다.

```text
https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send
```

5. Network response에서 아래 값을 본다.

```text
would_store=false
would_send=false
no_platform_send_verified=true
email_hash_present 또는 phone_hash_present = true
order_no_hash_present = true
client_session_present = true
raw email/phone/order/member_code 없음
```

## 성공 기준

- 로그인/비로그인 중 최소 1개 결제완료 화면에서 `email_hash_present` 또는 `phone_hash_present`가 true다.
- `order_no_hash_present`가 true다.
- `client_session_present`가 true다.
- response에 raw email, phone, member_code, order number가 없다.
- `would_store=false`.
- `would_send=false`.
- `platform_send_count=0`.
- 콘솔 fatal error가 0이다.
- Preview workspace를 submit/publish하지 않는다.

## 실패 시 해석

- email/phone 후보가 없으면 Path B identity bridge는 HOLD다.
- order_no 후보가 없으면 주문 단위 중복 방지와 reliability dry-run이 약해진다.
- client/session 후보가 없으면 광고 클릭과의 시간 연결이 약해진다.
- NPay가 thanks page로 돌아오지 않으면 `npay_no_thanks_page`로 분리한다.
- raw 값이 response, log, 외부 플랫폼 payload에 보이면 즉시 중단한다.

## evidence schema

JSON schema 초안:

`data/path-b-preview-evidence-20260508.json`

## 하지 않은 것

- GTM Production publish를 하지 않았다.
- Imweb production save를 하지 않았다.
- 기존 GTM tag pause/delete를 하지 않았다.
- 운영 저장 canary를 하지 않았다.
- Google Ads/GA4/Meta/TikTok/Naver 전송을 하지 않았다.

Auditor verdict: ENDPOINT_READY_PREVIEW_PENDING
Confidence: 78%
