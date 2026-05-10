# Google Ads campaign_id join coverage extension - 2026-05-10

## 5줄 요약

1. 내부 confirmed 주문 2152건 중 Google click id로 campaign_id가 확정된 주문은 31건이다.
2. 미확정 주문 2121건은 캠페인별 예산 판단에 직접 쓰지 않고 HOLD로 둔다.
3. exact click id 조인 매출은 7,611,210 KRW이며, 이는 전체 내부 ROAS의 하한 샘플이다.
4. UTM campaign은 진단 힌트로만 쓰고, time-window-only attribution은 금지한다.
5. 다음 coverage 확대는 Path B paid-click evidence와 Google Ads click_view exact join이 쌓이는지 보는 것이다.

## Coverage

- confirmed_orders: 2152
- google_click_id_orders: 31
- campaign_id_matched_count: 31
- campaign_id_missing_count: 2121
- ambiguous_count: 0
- matched_revenue: 7,611,210 KRW

## Campaign matched count

- 14629255429 [SA]바이오컴 검사권: 9
- 23171999678 [PM] 이벤트: 2
- 21807994952 [PM]검사권 실적최대화: 12
- 22018174474 [PM]건기식 실적최대화: 8

## 예산 판단 규칙

- budget_decision_ready: exact click id로 campaign_id가 붙은 subset만 하한 샘플로 가능
- budget_decision_hold: missing 2,121건은 exact 증거가 없으면 캠페인별 internal ROAS에 직접 반영 금지
- send_candidate: false 유지

## 확장 후보

- `gclid/gbraid/wbraid` exact + Google Ads click_view: 사용 가능
- `paid_click_intent` exact click id: 사용 가능
- Path B order bridge exact click id: 앞으로 coverage 확대 경로
- UTM campaign hint: 진단 전용
- time-window-only attribution: 금지
