# Path B HURDLERS user_id HMAC-only source 승인안

작성 시각: 2026-05-09 01:01 KST
대상: biocom Path B 주문-클릭 bridge
요청 유형: Yellow Preview approval draft
상태: approval_ready
Mode: no-send / no-operational-write / no-platform-send / no-publish

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
  lane: Yellow Preview approval draft
  allowed_actions:
    - approval document writing
    - GTM read-only dependency review
    - Preview-only tag design
    - no-send HMAC smoke planning
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - backend operational storage canary
    - operational schema migration
    - raw email/phone/member_code/order storage
    - raw email/phone/member_code/order logging
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete
  source_window_freshness_confidence:
    source: "GTM dependency map 2026-05-08 + actual Path B Preview payload 2026-05-09"
    window: "2026-05-08 22:40 KST - 2026-05-09 01:01 KST"
    freshness: "2026-05-09 01:01 KST"
    confidence: 0.91
```

## 10초 결론

이번 승인안은 기존 HURDLERS `user_id`의 이메일형 값을 Path B bridge source로 쓸지 판단하기 위한 문서다.

승인해도 raw email을 저장하지 않는다.
승인해도 GA4, Google Ads, Meta, TikTok, Naver로 보내지 않는다.
승인 범위는 GTM Preview workspace에서 우리 no-send HMAC endpoint로 transient 전달해 `email_hash_present=true`가 되는지 확인하는 것뿐이다.

## 왜 필요한가

2026-05-09 실제 가상계좌 주문완료 Preview에서 아래는 확인됐다.

- `order_no_hash_present=true`
- `client_session_present=true`
- `would_store=false`
- `would_send=false`
- `no_raw_echo_verified=true`
- `no_platform_send_verified=true`

하지만 아래는 비어 있었다.

- `email_hash_present=false`
- `phone_hash_present=false`
- `click_id_hash_present=false`

또 VM live `paid_click_intent_ledger` read-only join에서 이번 주문의 client/session 후보는 0건이었다.
따라서 client/session만으로는 이번 주문을 광고 클릭 원장에 잇지 못했다.

반면 Tag Assistant에서 기존 HURDLERS `user_id` 값은 이메일형으로 관측됐다.
이 값을 raw로 쓰면 안 되지만, 서버에서 즉시 HMAC 처리하고 raw를 버리면 identity bridge 후보가 된다.

## 현재 source inventory

GTM read-only dependency map 기준:

- 변수 ID: `124`
- 변수명: `HURDLERS - [맞춤 JS] user_id`
- 유형: Custom JavaScript variable
- 읽는 후보: `.email-info`
- 분류: `pii_risk`
- 현재 참조 태그:
  - `HURDLERS - [이벤트전송] 구매`
  - `HURDLERS - [이벤트전송] 네이버페이 구매`
  - `HURDLERS - [이벤트전송] 상세페이지 조회`
  - `User_id`
  - 기타 HURDLERS 이벤트 태그

중요:

- 기존 태그를 pause/delete/edit 하지 않는다.
- 기존 HURDLERS `user_id` 값을 운영 저장값으로 쓰지 않는다.
- Path B Preview tag에서만 별도 source 후보로 읽는다.

## 승인 범위

TJ님이 이 승인안을 승인하면 가능한 작업:

1. GTM fresh workspace에서 Path B Preview tag를 수정한다.
2. 기존 HURDLERS `user_id` 변수를 email source 후보로 추가한다.
3. 값은 우리 HTTPS no-send endpoint로만 transient 전달한다.
4. backend는 normalize 후 HMAC-SHA256만 계산한다.
5. response에는 raw email을 반환하지 않는다.
6. PM2 log에는 raw email이 남지 않는지 확인한다.
7. GTM workspace는 submit/publish하지 않는다.

## 금지 범위

승인해도 금지:

- GTM Production publish.
- Imweb production save.
- backend operational storage canary.
- raw email 저장.
- raw email logging.
- raw request body 저장.
- GA4/Google Ads/Meta/TikTok/Naver 전송.
- Google Ads conversion upload.
- 기존 HURDLERS tag pause/delete/edit.

## 구현 방식 후보

### Option A - Preview tag에서 GTM variable을 email 후보로 주입

Path B Preview tag 안에서 기존 GTM 변수 `HURDLERS - [맞춤 JS] user_id`를 읽어 `payload.email` 후보로 넣는다.
이 값은 우리 endpoint로만 전송되고, 서버가 즉시 HMAC을 만든다.

장점:

- 가장 빠르다.
- 실제 결제완료 화면 source availability를 바로 확인할 수 있다.
- 기존 HURDLERS 변수와 일치하는지 검증 가능하다.

주의:

- raw email이 browser memory와 우리 HTTPS request body에 transient로 존재한다.
- 따라서 response/log/storage/platform에 raw가 보이면 Hard Fail이다.

### Option B - 먼저 availability marker만 확인

raw email을 보내지 않고, 브라우저에서 `email_source_present=true`만 dataLayer에 남긴다.

장점:

- raw 전송이 없다.

단점:

- HMAC endpoint가 실제로 hash를 만들 수 있는지 확인하지 못한다.
- Path B reliability 판단에는 부족하다.

권장:

Option A를 Yellow Preview only로 승인한다.
이미 no-send HMAC endpoint는 raw echo 0, raw log 0, platform send 0 smoke를 통과했다.

## 성공 기준

Preview result payload에서 아래가 확인되면 PASS다.

- `response_status=200`
- `response_ok=true`
- `email_hash_present=true`
- `identity_source=email`
- `order_no_hash_present=true`
- `client_session_present=true`
- `would_store=false`
- `would_send=false`
- `no_raw_echo_verified=true`
- `no_platform_send_verified=true`
- `platform_send_count=0`

VM PM2 log check:

- test email pattern count: 0.
- raw order/payment/value pattern count: 0.

## Hard Fail

아래 중 하나라도 있으면 즉시 중단한다.

- raw email이 response에 보임.
- raw email이 PM2 log에 보임.
- raw email이 local/VM storage에 저장됨.
- request body를 raw로 저장하는 코드가 필요해짐.
- GA4/Google Ads/Meta/TikTok/Naver request가 새로 발생함.
- `would_store=true`.
- `would_send=true`.
- tag가 order complete 외 화면에서 firing됨.
- Default Workspace 또는 Production publish가 필요해짐.

## Rollback

Preview workspace에서만 작업한다.

문제 발생 시:

1. Preview tag 수정분을 폐기한다.
2. workspace를 submit/publish하지 않는다.
3. 기존 live version은 그대로 둔다.
4. 기존 HURDLERS tag는 건드리지 않는다.

## 승인 문구

```text
YES: Path B HURDLERS email-like user_id HMAC-only Preview를 승인합니다.
범위: GTM fresh workspace Preview only, 기존 HURDLERS user_id를 Path B no-send HMAC endpoint의 transient email source로만 사용.
금지: Production publish, raw email 저장/로그/응답, platform send, operational storage canary, 기존 태그 pause/delete.
성공 기준: email_hash_present=true, would_store=false, would_send=false, raw echo/log/storage 0, platform send 0.
```

## 현재 추천

진행 추천: 92%.

이유:

- 현재 client/session만으로는 이번 Preview 주문이 paid_click_intent 원장과 0건 매칭이었다.
- HURDLERS `user_id`는 이미 화면/GTM에서 관측되는 source다.
- raw 저장 없이 HMAC-only로 제한하면 속도와 안전성의 균형이 맞다.

Auditor verdict: READY_FOR_YELLOW_PREVIEW_APPROVAL
Confidence: 91%
