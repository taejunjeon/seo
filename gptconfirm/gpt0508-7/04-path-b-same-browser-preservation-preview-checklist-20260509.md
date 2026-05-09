# Path B same-browser preservation Preview checklist

작성 시각: 2026-05-09 01:24 KST
대상: biocom Path B same-browser click preservation
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
    - GTM Preview browser flow
    - synthetic TEST click id use
    - no-send endpoint call
    - browser storage read-only inspection
  forbidden_actions:
    - real ad click generation
    - actual payment test without separate approval
    - GTM Production publish
    - operational write canary
    - platform send
    - conversion upload
  source_window_freshness_confidence:
    source: "Path B Preview workspace and vbank baseline evidence"
    window: "2026-05-09 00:24-01:24 KST"
    freshness: "2026-05-09 01:24 KST"
    confidence: 0.86
```

## 10초 결론

same-browser preservation은 상품상세에서 들어온 TEST click id가 결제완료 화면까지 살아남는지 보는 점검이다.
실제 광고 클릭이나 실제 결제 없이, 같은 브라우저 흐름에서 source가 보존되는지만 확인한다.

## 왜 필요한가

이전 가상계좌 주문완료 Preview는 `click_id_hash_present=false`였다.
그 주문은 paid-click-origin이 아니어서 VM paid_click_intent 원장과도 client/session match가 없었다.

따라서 결제수단을 바꾸기 전에, 같은 브라우저에서 click id가 상품상세 -> checkout -> 주문완료까지 유지되는지 봐야 한다.

## 실행 체크리스트

1. GTM Tag Assistant Preview를 연결한다.
2. 상품상세 URL에 TEST click id를 붙여 진입한다.

```text
https://biocom.kr/shop_view/?idx=198&gclid=TEST_GCLID_PATHB_FLOW_20260509
```

3. 상품상세 단계에서 기존 paid click intent no-send/preview marker가 있는지 확인한다.
4. checkout/order complete까지 같은 브라우저로 이동한다.
5. 주문완료 화면에서 Path B Preview result 이벤트를 확인한다.
6. browser storage에는 raw click id가 장기 저장되지 않는지 확인한다.
7. response/log/storage에는 raw email/order/click id가 남지 않는지 확인한다.

## 성공 기준

- 상품상세 단계에서 TEST click id source 확인.
- 주문완료 단계에서 `click_id_hash_present=true`.
- 주문완료 단계에서 `order_no_hash_present=true`.
- 주문완료 단계에서 `client_session_present=true`.
- `would_store=false`.
- `would_send=false`.
- `no_raw_echo_verified=true`.
- `no_platform_send_verified=true`.
- `platform_send_count=0`.

## 실패 시 분리

- 상품상세에서 TEST click id capture 없음: paid click capture tag/source 문제.
- checkout에서 사라짐: storage namespace 또는 page transition 문제.
- 주문완료에서만 사라짐: final page source read 문제.
- endpoint는 성공하나 click absent: payload extraction 문제.
- platform request 발생: 즉시 중단.

## 다음 단계와 의존성

이 checklist가 PASS해야 real paid-click-originated controlled test 승인안을 좁힐 수 있다.
실제 광고 클릭, 실제 결제, 실제 주문은 별도 승인 전에는 하지 않는다.

Auditor verdict: CHECKLIST_READY_SAME_BROWSER_PRESERVATION
