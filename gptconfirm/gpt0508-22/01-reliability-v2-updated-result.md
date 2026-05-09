# Path B reliability v2 updated result

작성 시각: 2026-05-10 01:18 KST

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
  lane: Green reliability input update
  allowed_actions:
    - no-send evidence normalization
    - dry-run scorecard update
    - approval document writing
  forbidden_actions:
    - real ad click
    - actual payment
    - GTM Production publish
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - send_candidate=true
    - raw email/phone/member_code/order/payment storage or logging
  source_window_freshness_confidence:
    source: gpt0508-21 TJ Tag Assistant Preview evidence
    window: 2026-05-10 01:02~01:18 KST
    site: biocom
    freshness: same-session
    confidence: 0.94
```

## 한 줄 결론

Path B reliability v2 input에 `gpt0508-21` PASS_CONTROLLED evidence를 반영했다. Preview/no-send 기준으로 order, identity, click, session 네 축은 모두 PASS지만 실제 Google 광고 클릭 주문 테스트는 아직 HOLD다.

## 반영한 evidence

- source: `data/path-b-same-browser-preservation-tj-preview-result-20260510.json`
- event: `agent_os_path_b_controlled_traffic_result`
- evidence type: controlled Preview
- click source: TEST gclid
- raw click id 저장: 없음
- order bridge key: present
- identity bridge key: present
- click bridge key: present
- client/session: present
- send_candidate: false
- actual_send_candidate: false

## v2 scorecard

| 항목 | 판정 | 의미 |
|---|---|---|
| order_bridge_key_present | PASS | 주문 hash 후보가 있다 |
| identity_bridge_key_present | PASS | 로그인 identity hash 후보가 있다 |
| click_bridge_key_present | PASS_CONTROLLED_TEST_GCLID | TEST gclid 기준 click hash가 있다 |
| same_browser_preservation | PASS_CONTROLLED | 같은 브라우저 주문완료까지 보존됐다 |
| real_paid_click_order_test_ready | HOLD_REQUIRES_SEPARATE_APPROVAL | 실제 광고 클릭/결제는 별도 승인 필요 |
| google_ads_upload_ready | NO | 아직 Google Ads upload 후보가 아니다 |
| send_candidate | PASS_FALSE | 전송 후보 0 |
| actual_send_candidate | PASS_FALSE | actual send 후보 0 |

## Confidence 분류

- `A_CONTROLLED`: 1건
  - TJ님 same-browser TEST gclid 주문완료 evidence.
  - 기술적으로 bridge는 닫혔지만 실제 광고 클릭이 아니므로 upload 후보가 아니다.
- `B_IDENTITY_ONLY_HOLD`: 1묶음
  - 기존 1h identity-first canary row 2건.
  - order/identity/session은 PASS지만 click exact bridge가 없다.

## Guard 결과

- raw values stored in this artifact: false
- platform send count: 0
- send_candidate count: 0
- actual_send_candidate count: 0
- Google Ads upload candidate count: 0
- test evidence excluded from upload: true
- test evidence excluded from budget ROAS: true

## 다음 판단

Preview/manual loop는 더 반복하지 않아도 된다. 다음 병목은 실제 Google 광고 클릭에서 출발한 실제 주문을 할지 여부다. 이는 비용과 외부 플랫폼 영향이 있으므로 별도 승인 전까지 HOLD다.

Auditor verdict: PASS_RELIABILITY_V2_INPUT_UPDATED__REAL_PAID_CLICK_TEST_HOLD

