# Path B click bridge scorecard

작성 시각: 2026-05-10 00:56 KST

## 미니 채점표

| 항목 | 판정 | 의미 | 다음 액션 |
|---|---|---|---|
| storage_infra_ready | PASS | VM Cloud hash-only 저장 장치와 summary가 준비됨 | 유지 |
| identity_bridge_key_present | PASS | email hash/order hash/client session은 canary에서 채워짐 | 유지 |
| paid_click_storage_key_match | PASS | Path B와 paid_click_intent 모두 `bi_paid_click_intent_v1` 사용 | 유지 |
| product_stage_click_capture | PASS | 상품상세 TEST gclid가 storage에 들어감 | 유지 |
| same_browser_order_complete_access | HOLD | headless 세션에서 주문완료 URL이 홈페이지로 redirect됨 | 로그인 Tag Assistant 세션에서 재확인 |
| order_complete_click_id_hash_present | HOLD | receiver가 호출되지 않아 click hash 확인 불가 | redirect 해결 후 재확인 |
| time_window_only_attribution | FAIL_FOR_SEND | 후보가 너무 많아 attribution에 쓰면 안 됨 | 금지 유지 |
| send_candidate | PASS_FALSE | 실제 전송 후보 0 | 유지 |
| actual_send_candidate | PASS_FALSE | Google Ads upload 후보 0 | 유지 |
| platform_send | PASS_ZERO | 이번 자동화 delta 0 | 유지 |
| production_publish | PASS_ZERO | submit/create_version/publish 0 | 유지 |

## 현재 판정

Path B는 identity/order/session bridge는 PASS다. click bridge는 product-stage capture까지는 PASS지만, 주문완료 페이지 접근이 headless 환경에서 막혀 최종 `click_id_hash_present=true` 확인이 HOLD다.

## 다음 액션

다음은 identity-only canary 연장이 아니다. workspace 167 Preview를 로그인된 실제 브라우저에서 열고 상품상세 TEST gclid에서 주문완료까지 같은 브라우저 흐름을 다시 실행해야 한다.

