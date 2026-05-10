
# Google Ads campaign_id join coverage update - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green read-only / no upload

## 결론
campaign_id 결정 조인은 Google click id가 있는 confirmed 주문 31건에는 PASS다. 전체 2,152건 중 2,121건은 campaign_id가 없으므로 캠페인별 internal ROAS는 아직 예산 판단값이 아니라 click-id matched floor다.

## 현재 coverage
- confirmed orders: 2152
- Google click id orders: 31
- campaign_id matched: 31
- missing: 2121
- ambiguous: 0
- matched revenue: 7,611,210 KRW

## 캠페인별 matched count
- 14629255429 [SA]바이오컴 검사권: 9
- 23171999678 [PM] 이벤트: 2
- 21807994952 [PM]검사권 실적최대화: 12
- 22018174474 [PM]건기식 실적최대화: 8

## 확장 판단
- exact `gclid/gbraid/wbraid` + Google Ads click_view: 예산 판단 후보로 사용 가능.
- paid_click_intent/order_bridge exact click id: 앞으로 들어오는 row의 coverage 확장 경로.
- UTM campaign hint: 보조 진단만 가능. 예산 판단 직접 사용 금지.
- time-window-only attribution: 금지.

## 다음 액션
Path B가 앞으로 저장하는 click hash와 Google Ads click_view를 같은 window로 묶어 campaign_id coverage를 늘린다. 기존 2,121 missing row는 exact click id가 없으면 HOLD로 둔다.
