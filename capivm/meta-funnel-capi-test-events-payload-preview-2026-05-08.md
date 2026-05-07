# Meta funnel CAPI Test Events payload preview

작성 시각: 2026-05-08 01:00 KST
대상: biocom Meta Pixel `1283400029487161`
문서 성격: Green Lane no-send payload preview
관련 문서: [[meta-funnel-capi-readiness-20260508]], [[../total/!total-current]]
Do not use for: Meta Test Events 실제 호출, 운영 CAPI 전송, GTM Preview/Publish, Imweb header/footer 수정

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/meta-funnel-capi-readiness-20260508.md
    - capivm/meta-funnel-capi-test-events-smoke-plan-20260505.md
    - total/!total-current.md
  lane: Green no-send payload preview
  allowed_actions:
    - test_event_code 존재 여부 확인
    - payload preview 생성
    - GTM-first wiring 설계 보강
  forbidden_actions:
    - Meta Test Events 실제 호출
    - 운영 CAPI 전송
    - GTM Preview workspace 생성/수정
    - GTM Production publish
    - Imweb header/footer 수정
  source_window_freshness_confidence:
    source: "capivm/meta-funnel-capi-readiness-20260508.md + backend/src/routes/meta.ts + TJ 제공 test_event_code"
    window: "2026-05-08 KST"
    freshness: "payload preview generated 2026-05-07T16:00:08.394Z"
    confidence: 0.88
```

## 10초 결론

TJ님이 제공한 Meta Test Events code는 현재 세션에 존재한다. 이 파일에는 원문값을 저장하지 않고 마스킹과 길이만 남긴다.

이번 작업은 실제 Meta 호출이 아니다. `/api/meta/capi/track`로 네트워크 요청을 보내지 않았고, GTM/Imweb/운영 서버도 바꾸지 않았다.

## Test Code 확인

| 항목 | 값 |
| --- | --- |
| present | YES |
| masked | TEST***** |
| length | 9 |
| raw value written | NO |

## Payload Preview

| event | eventId | eventSourceUrl | testEventCode |
| --- | --- | --- | --- |
| ViewContent | biocom_meta_funnel_test_ViewContent_20260507T160008Z | https://biocom.kr/HealthFood/?idx=386 | <TJ_PROVIDED_TEST_EVENT_CODE> |
| AddToCart | biocom_meta_funnel_test_AddToCart_20260507T160008Z | https://biocom.kr/HealthFood/?idx=386 | <TJ_PROVIDED_TEST_EVENT_CODE> |
| InitiateCheckout | biocom_meta_funnel_test_InitiateCheckout_20260507T160008Z | https://biocom.kr/shop_cart/ | <TJ_PROVIDED_TEST_EVENT_CODE> |
| AddPaymentInfo | biocom_meta_funnel_test_AddPaymentInfo_20260507T160008Z | https://biocom.kr/shop_payment/ | <TJ_PROVIDED_TEST_EVENT_CODE> |
| Lead | biocom_meta_funnel_test_Lead_20260507T160008Z | https://biocom.kr/site_join/ | <TJ_PROVIDED_TEST_EVENT_CODE> |
| Search | biocom_meta_funnel_test_Search_20260507T160008Z | https://biocom.kr/?keyword=%EB%A9%94%ED%83%80%EB%93%9C%EB%A6%BC | <TJ_PROVIDED_TEST_EVENT_CODE> |

## 권장 wiring

1. 아임웹 header/footer 변경보다 GTM Custom HTML tag를 우선한다.
2. 실제 적용은 fresh Preview workspace에서만 시작한다.
3. Production publish 전에는 Test Events 탭에서 Browser/Server event_id dedup을 확인한다.
4. `test_event_code` 없는 funnel event 운영 송출은 별도 승인 전 금지한다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: meta-funnel-capi
Lane: Green
Mode: no-send payload preview

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- TJ provided a test code in the chat, but the raw value was not written to this file.
- Actual Test Events smoke remains Yellow because it calls Meta.
```
