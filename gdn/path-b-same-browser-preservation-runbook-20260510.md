# Path B same-browser preservation runbook

작성 시각: 2026-05-10 00:56 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - docs/report/text-report-template.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  lane: Green/Yellow-lite GTM Preview no-send controlled flow
  allowed_actions:
    - GTM fresh workspace Preview
    - no-send receiver call
    - read-only row summary check
    - result packaging
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - real ad click
    - actual payment
    - Google Ads/GA4/Meta/TikTok/Naver conversion send
    - raw email/phone/member_code/order/payment storage or logging
    - send_candidate=true
  source_window_freshness_confidence:
    source: GTM Preview workspace 167, Path B no-send endpoint, VM Cloud summary read-only
    window: 2026-05-10 00:54~00:56 KST
    site: biocom
    freshness: same-session
    confidence: high for product-stage storage, medium for order-complete redirect cause
```

## 목적

상품상세에서 들어온 TEST click id가 같은 브라우저 안에서 주문완료 화면까지 살아남는지 확인한다. 이 확인이 필요한 이유는 1h identity-first canary row 2건에는 order/email/session은 있었지만 click id가 없었기 때문이다.

## 금지선

- 실제 광고 클릭을 만들지 않는다.
- 실제 결제를 하지 않는다.
- GTM Production publish를 하지 않는다.
- Google Ads/GA4/Meta/TikTok/Naver로 새 전송을 만들지 않는다.
- raw email/phone/member_code/order/payment를 저장하거나 로그로 남기지 않는다.
- `send_candidate=true`를 만들지 않는다.

## 실행 URL

- 상품상세 시작 URL: `https://biocom.kr/shop_view/?idx=198&gclid=TEST_GCLID_PATHB_FLOW_20260510`
- 주문완료 확인 URL: 같은 브라우저에서 생성된 가상계좌 주문완료 URL 또는 TJ님 로그인 세션에서 접근 가능한 주문완료 URL
- 이번 자동화에 사용한 주문완료 URL: `https://biocom.kr/shop_payment_complete?order_code=o202605096beabd229d958&payment_code=pa20260509a7fc435adfca8&order_no=202605097332574&rk=S`

## 실행 순서

1. GTM fresh workspace를 만든다.
   - 이번 생성 workspace: `167`
   - tag: `AGENT_OS_path_b_controlled_traffic_hmac_write_preview_20260509T155435Z`
   - trigger: `AGENT_OS_path_b_order_confirm_controlled_traffic_20260509T155435Z`
   - submit/create_version/publish: 0

2. 같은 브라우저에서 상품상세 URL을 연다.
   - 성공 기준: `bi_paid_click_intent_v1` storage가 생긴다.
   - 성공 기준: storage 안에 TEST `gclid`가 있다.

3. 같은 브라우저에서 주문완료 URL로 이동한다.
   - 성공 기준: 주문완료 URL이 `shop_payment_complete`에 남는다.
   - 실패 기준: 홈페이지로 redirect되면 로그인/주문 세션 접근 문제로 분류한다.

4. Path B Preview tag 결과를 확인한다.
   - 성공 기준: `click_id_hash_present=true`
   - 성공 기준: `order_no_hash_present=true`
   - 성공 기준: `client_session_present=true`
   - 성공 기준: `would_send=false`
   - 성공 기준: `platform_send_count=0`

## 실패 분류

- 상품상세 storage가 없으면 `paid_click_intent_capture_missing`.
- 상품상세 storage는 있는데 주문완료에서 사라지면 `browser_storage_preservation_loss`.
- 주문완료가 홈페이지로 redirect되면 `blocked_authenticated_order_complete_access`.
- 주문완료에서 tag는 fired인데 receiver가 false면 `path_b_extraction_mismatch`.
- platform request가 생기면 `tag_scope_or_blocker_failure`.

## 이번 자동화 결과

이번 자동화는 상품상세 storage 생성까지 PASS했다. 주문완료 URL은 headless 브라우저에서 `https://biocom.kr/`로 redirect되어 receiver가 호출되지 않았다. 따라서 click bridge는 아직 PASS가 아니라 HOLD이며, 원인은 상품상세 click capture가 아니라 주문완료 접근 세션/redirect 쪽으로 좁혀졌다.

