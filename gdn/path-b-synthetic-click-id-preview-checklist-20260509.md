# Path B synthetic click id Preview checklist

작성 시각: 2026-05-09 01:23 KST
대상: biocom Path B click id bridge
상태: checklist_ready
Lane: Yellow Preview only
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
  lane: Yellow Preview only
  allowed_actions:
    - GTM Preview workspace use
    - synthetic click id URL parameter test
    - no-send endpoint call
    - hash-only evidence collection
  forbidden_actions:
    - real ad click generation
    - GTM Production publish
    - operational paid_click_intent write expectation
    - platform send
    - conversion upload
  source_window_freshness_confidence:
    source: "Path B HURDLERS controlled Preview result"
    window: "2026-05-09 01:17-01:23 KST"
    freshness: "2026-05-09 01:23 KST"
    confidence: 0.88
```

## 10초 결론

다음 확인은 `click_id_hash_present=true`가 가능한지 보는 것이다.
이 테스트는 실제 광고 클릭을 만들지 않는다.
주문완료 URL에 TEST click id를 붙이고 no-send endpoint response boolean만 본다.

## 왜 필요한가

HURDLERS user_id HMAC은 주문과 사람을 잇는 identity bridge다.
하지만 Google ROAS 개선에는 광고 클릭에서 온 click id bridge도 필요하다.
따라서 실제 광고 클릭 테스트 전, synthetic click id가 주문완료 tag에서 읽히는지 먼저 봐야 한다.

## 실행 체크리스트

1. GTM Preview workspace `164`를 유지한다.
2. 주문완료 path에서만 실행되는 Path B tag를 사용한다.
3. 주문완료 URL에 아래 형태의 TEST click id를 붙인다.

```text
https://biocom.kr/shop_payment_complete?...&gclid=TEST_GCLID_PATHB_PREVIEW_20260509
```

4. Tag Assistant에서 `agent_os_path_b_user_identity_preview_result` 이벤트를 확인한다.
5. Network에서 no-send endpoint만 호출됐는지 확인한다.
6. GA4/Google Ads/Meta/TikTok/Naver request가 새로 생기지 않았는지 확인한다.

## 성공 기준

- `response_status=200`
- `click_id_hash_present=true`
- `order_no_hash_present=true`
- `client_session_present=true`
- `would_store=false`
- `would_send=false`
- `no_raw_echo_verified=true`
- `no_platform_send_verified=true`
- `platform_send_count=0`

## 실패 시 분리

- `click_id_hash_present=false`: URL param 또는 storage read 문제.
- `order_no_hash_present=false`: 주문완료 URL/query/dataLayer source 문제.
- `client_session_present=false`: GA cookie 또는 Imweb session source 문제.
- endpoint failure: CORS, network, endpoint availability 문제.
- platform request 발생: 즉시 중단.

## 한계

이 테스트는 click id parsing 기능 확인이다.
VM live `paid_click_intent_ledger` row와 실제로 연결되는지는 증명하지 않는다.
row-level reliability는 same-browser preservation과 controlled paid-click-originated test 이후에 판단한다.

Auditor verdict: CHECKLIST_READY_SYNTHETIC_CLICK_ID_PREVIEW
