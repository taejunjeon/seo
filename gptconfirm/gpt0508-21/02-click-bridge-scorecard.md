# Path B click bridge scorecard

작성 시각: 2026-05-10 01:04 KST

## 미니 채점표

| 항목 | 판정 | 의미 | 다음 액션 |
|---|---|---|---|
| storage_infra_ready | PASS | VM Cloud hash-only 저장 장치와 summary가 준비됨 | 유지 |
| identity_bridge_key_present | PASS | email hash/order hash/client session은 canary에서 채워짐 | 유지 |
| paid_click_storage_key_match | PASS | Path B와 paid_click_intent 모두 `bi_paid_click_intent_v1` 사용 | 유지 |
| product_stage_click_capture | PASS | 상품상세 TEST gclid가 storage에 들어감 | 유지 |
| same_browser_order_complete_access | PASS | TJ님 로그인 Tag Assistant 세션에서 주문완료 화면 유지 확인 | 유지 |
| order_complete_click_id_hash_present | PASS_CONTROLLED_TEST_GCLID | 주문완료 Path B response에서 click hash present 확인 | real paid-click test 전까지 controlled evidence로 사용 |
| time_window_only_attribution | FAIL_FOR_SEND | 후보가 너무 많아 attribution에 쓰면 안 됨 | 금지 유지 |
| send_candidate | PASS_FALSE | 실제 전송 후보 0 | 유지 |
| actual_send_candidate | PASS_FALSE | Google Ads upload 후보 0 | 유지 |
| platform_send | PASS_ZERO | 이번 자동화 delta 0 | 유지 |
| production_publish | PASS_ZERO | submit/create_version/publish 0 | 유지 |

## 현재 판정

Path B는 identity/order/session bridge가 PASS다. TJ님 로그인 Tag Assistant 세션에서 같은 브라우저 TEST gclid 흐름도 `click_id_hash_present=true`를 확인했으므로 click bridge는 controlled Preview 기준 PASS다.

## 다음 액션

다음은 identity-only canary 연장이 아니다. 이 controlled evidence를 reliability v2 input에 반영하고, 실제 광고 클릭/실제 결제 테스트는 별도 승인안으로 분리한다. Google Ads confirmed_purchase upload는 계속 HOLD다.
