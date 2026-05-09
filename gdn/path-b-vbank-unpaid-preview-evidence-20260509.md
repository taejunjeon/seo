# Path B 가상계좌 미입금 Preview evidence

작성 시각: 2026-05-09 01:03 KST
대상: GTM workspace `163` / Path B Preview tag `290`
상태: partial pass / result payload confirmed / order-session only
Lane: Yellow approved Preview only
Mode: no-publish / no-platform-send / no-operational-storage

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
  lane: Yellow Preview evidence
  allowed_actions:
    - GTM Preview evidence collection
    - no-send endpoint smoke
    - raw log guard patch
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - operational schema migration
    - backend operational storage canary
    - raw email/phone/member_code/order/payment storage
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "TJ님 Tag Assistant dataLayer payload + backend redaction patch smoke + GTM API guard fix"
    window: "2026-05-09 00:25-00:49 KST"
    freshness: "2026-05-09 01:03 KST"
    confidence: 0.94
```

## 10초 결론

Path B Preview tag는 실제 `shop_payment_complete` 화면에서 `path_b_order_bridge_preview_result`까지 도달했다.
따라서 GTM workspace, trigger, tag scope, receiver 호출 흐름은 맞다.

실제 payload 기준으로 `order_no_hash_present=true`, `client_session_present=true`, `would_store=false`, `would_send=false`, `no_raw_echo_verified=true`, `no_platform_send_verified=true`다.

반면 `email_hash_present=false`, `phone_hash_present=false`, `click_id_hash_present=false`다.
즉 이번 가상계좌 미입금 Preview는 "주문번호 + client/session 다리"는 통과했고, "email/phone/click id 다리"는 아직 없다.

## 확인된 것

- 화면: `shop_payment_complete`.
- 결제수단: 가상계좌.
- 상태: 주문 생성 완료, 입금 전.
- Path B Preview tag 발화: YES, 1회.
- Path B result event: YES, `path_b_order_bridge_preview_result`.
- Production publish: NO.
- 기존 GTM tag pause/delete: NO.
- platform send by Path B tag: NO, no-send endpoint만 사용.
- 주문번호 후보: 페이지/기존 데이터레이어에 존재.
- client/session 후보: GA client id와 Imweb session object가 존재.
- email-like 후보: 기존 HURDLERS `user_id` 변수에 이메일형 값이 보이나, 현재 Path B tag는 이 GTM custom JS 변수를 bridge source로 읽지 않는다.
- 실제 result payload:
  - `response_status=200`
  - `response_ok=true`
  - `would_store=false`
  - `would_send=false`
  - `email_hash_present=false`
  - `phone_hash_present=false`
  - `order_no_hash_present=true`
  - `client_session_present=true`
  - `click_id_hash_present=false`
  - `no_raw_echo_verified=true`
- `no_platform_send_verified=true`
- `platform_send_count=0`
- post-patch VM PM2 raw log pattern count:
  - `order_code=` 0
  - `payment_code=` 0
  - `order_no=` 0
  - `paymentKey=` 0
  - `amount=` 0

## 발견한 문제

가상계좌 미입금 화면에서 기존 구매성 태그들이 발화했다.

- `HURDLERS - [이벤트전송] 구매`
- `채널톡_구매전환`
- 기타 기존 purchase-like 태그

이 문제는 Path B no-send preview와 별개다.
다만 "가상계좌 주문 생성"과 "실제 입금 완료"가 분리되지 않는 기존 구매 태그 문제를 다시 확인한 증거다.

## 이번 result event 해석

이번 결과는 `blocked`가 아니라 `result`다.
즉 앞서 발견한 Preview guard 문제는 해결됐고, 태그가 no-send receiver 응답 처리 지점까지 갔다.

아래 최종 플래그를 확인했다.

- `response_status`
- `response_ok`
- `would_store`
- `would_send`
- `email_hash_present`
- `phone_hash_present`
- `order_no_hash_present`
- `client_session_present`
- `click_id_hash_present`
- `no_raw_echo_verified`
- `no_platform_send_verified`
- `platform_send_count`

주문번호 hash와 client/session hash는 true다.
반면 email/phone hash와 click id hash는 false다.
이유는 현재 Preview tag가 page input 또는 dataLayer key의 `email`, `email_buy`, `ordererEmail`, `buyerEmail`, `phone`, `phone_buy`, `ordererCall`, `buyerPhone`만 읽고, 기존 HURDLERS custom JS 변수의 이메일형 `user_id`를 직접 읽지 않기 때문이다.

click id는 이번 세션이 광고 click id를 주문완료 화면에 노출하지 않았기 때문에 false다.
따라서 다음 reliability dry-run은 `order_no_hash + client/session` 조인 품질을 먼저 봐야 한다.

## raw logging guard 이슈와 조치

처음 확인 때 VM PM2 로그에서 제공된 결제완료 URL 식별자 일부가 1회 매칭됐다.
원인은 no-send endpoint body 저장이 아니라, 브라우저 `Referer` 헤더에 결제완료 URL 전체가 들어가고 pino HTTP 로그가 `req.headers.referer`를 남긴 것이다.

조치:

- `backend/src/bootstrap/configureMiddleware.ts`에서 `req.headers.referer`, `req.headers.referrer`를 redaction 대상에 추가했다.
- `dist/bootstrap/configureMiddleware.js`만 제한 배포했다.
- PM2 1회 restart했다.

재검증:

- 같은 Referer 조건 synthetic request: endpoint 200.
- response raw echo: false.
- PM2 raw log match: 0.

## 아직 필요한 것

이제 같은 화면 재확인은 필요 없다.
다음은 두 갈래다.

1. `order_no_hash + client/session`만으로 paid_click_intent ledger와 얼마나 잘 이어지는지 reliability dry-run을 만든다.
2. email-like `user_id`를 raw 저장 없이 server-side HMAC source로 추가할지 별도 승인안으로 판단한다.

## 다음 결제 테스트 판단

카드 결제나 NPay 결제는 아직 바로 하지 않는 편이 좋다.
이번 가상계좌 Preview payload 확인은 완료됐다.

다음 순서는 카드 결제완료 Preview보다 reliability dry-run이 먼저다.
NPay는 thanks page 복귀 여부가 별도 변수라, order/session dry-run 결과를 본 뒤 진행하는 것이 낫다.

Auditor verdict: PARTIAL_PASS_REAL_VBANK_PREVIEW_ORDER_SESSION_ONLY__IDENTITY_AND_CLICK_PENDING
Confidence: 94%
