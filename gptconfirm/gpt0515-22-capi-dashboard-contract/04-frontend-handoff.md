# Frontend Handoff

## Claude Code에 넘길 화면 의도

사용자는 “Meta CAPI가 살아 있나?”와 “ROAS 판단에 써도 되는 숫자인가?”를 한 화면에서 분리해서 봐야 한다.

## 상단 카드

1. Server CAPI 상태
   - 최근 1시간/오늘/7일 attempted, success, failed
   - Pixel ID와 site 표시
   - success가 0이면 Critical

2. Meta 광고 증거 품질
   - strong Meta evidence count/rate
   - non-Meta or unproven Meta count/rate
   - fbp만 있는 주문은 Meta 광고로 확정하지 않는다는 caveat 표시

3. Ads Manager ROAS
   - Meta Ads Manager purchase/value/spend/ROAS
   - same-day lag flag
   - “광고 플랫폼 주장값”으로 표시

4. 내부 confirmed ROAS
   - VM Cloud confirmed purchase 기준
   - “예산 판단용”인지 “참고용”인지 분리

## Funnel

일별/주별 토글:
- landing
- add_to_cart
- payment_started
- payment_method_selected
- confirmed_purchase
- meta_capi_success
- browser_purchase

각 step에는 source/unit/caveat를 tooltip 또는 접힘 영역으로 표시한다.

## Missing Queue

queue는 전송 버튼이 아니라 분류표로 먼저 보여준다.

필드:
- category
- count
- amount_krw
- next_action
- approval_required
- risk_level

전송이 필요한 경우에도 Red approval 문구를 별도 생성하고, 화면에서 즉시 send는 하지 않는다.

## UTM Breakdown

`meta_capi_success_count`는 Pixel-filtered CAPI success다. 이것을 Meta 광고 귀속으로 곧바로 해석하지 않는다.

추가 bucket:
- `no_ledger_match`: CAPI send log는 있으나 ledger와 조인 실패
- `strong_meta_ad_evidence`: fbc/fbclid/Meta UTM/source 있음
- `non_meta_or_unproven_meta`: Meta 광고 증거 약함/없음

## 배포 전 확인

- biocom 7d CAPI success ≈ 353
- thecleancoffee 7d CAPI success ≈ 298
- all_sites 7d CAPI success ≈ 651
- site 탭 전환 시 Pixel ID가 함께 바뀜
- `budget_roas_included`는 자동 true가 되지 않음
