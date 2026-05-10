# Google Ads campaign_id coverage extension - 2026-05-11

작성 시각: 2026-05-10 21:17:36 KST
Lane: Green read-only HOLD reducer

## 5줄 요약

1. 내부 confirmed 2,152건 중 campaign_id가 exact로 붙은 주문은 31건이다.
2. 이번 Green 분석에서 새로 예산 판단에 쓸 수 있는 exact/strong match는 0건이었다.
3. missing 2,121건은 유지된다. UTM campaign 1,081건은 진단 단서지만 예산 ROAS나 upload 후보가 아니다.
4. paid_click_intent/order bridge dry-run의 time-window-only 후보 2건은 금지 기준 때문에 send_candidate로 승격하지 않았다.
5. 결론은 HOLD지만 승인 대기만 하지 않고, exact source별로 막힌 이유를 줄여 다음 반복 조건을 고정했다.

## Coverage

| metric | value |
| --- | --- |
| confirmed_orders | 2152 |
| campaign_id_matched_count | 31 |
| campaign_id_missing_count | 2121 |
| exact_match_rate | 1.44% |
| matched_revenue | 7,611,210원 |
| new_budget_usable_matches | 0 |
| upload_candidate_count | 0 |

## Method review

| method | budget floor 사용 | result | notes |
| --- | --- | --- | --- |
| gclid/gbraid/wbraid exact + Google Ads click_view | YES | PASS_existing_31_orders_no_new_rows_in_current_artifact | 이미 campaign_id가 붙은 31건만 하한 샘플로 사용 가능하다. |
| paid_click_intent exact evidence | YES | HOLD_no_exact_same_order_confirmed_match_in_current_dry_run | time-window-only 후보 2건은 금지. send_candidate로 승격하지 않는다. |
| Path B order bridge exact click id | YES | PASS_REAL_GOOGLE_AD_CLICK_TO_ORDER_COMPLETE_NO_SEND_BRIDGE__CONFIRMED_PAYMENT_HOLD | 실제 Google 광고 클릭에서 주문완료 bridge evidence는 있으나 confirmed payment가 아니어서 예산 ROAS 후보에 쓰지 않는다. |
| UTM campaign hint | NO | DIAGNOSTIC_ONLY | UTM은 사람이 볼 단서일 뿐 campaign_id 확정이나 upload 후보가 아니다. |
| time-window-only attribution | NO | FORBIDDEN | 광고 클릭과 주문 시간이 가까운 것만으로 캠페인에 붙이지 않는다. |

## HOLD Reducer

- hold_reason: campaign_id missing 2,121건을 exact/strong 증거로 추가 축소할 새 row가 현재 산출물에 없음
- hold_reason_category: missing_click_bridge
- auto_green_followups_done: click_view exact, paid_click_intent/order_bridge exact, Path B evidence, UTM hint, time-window-only 금지 확인
- remaining_blocker: 새 confirmed 주문에 order-level Google click id 또는 Path B exact click id가 더 쌓여야 한다.

## 금지선 준수

- time-window-only attribution 0건 사용
- ambiguous 후보 send_candidate 승격 0건
- Google Ads upload 0
- send_candidate=true 0
