결론부터 말하면, **Meta ROAS는 “실제 확정 매출”이 아니라 “Meta가 자기 규칙으로 광고에 귀속한 전환 가치”를 분자로 쓰는 방식**입니다. 그래서 지금처럼 우리 내부의 `confirmed revenue` 기반 ROAS와 비교하면, **Meta 쪽이 더 높게 나오는 구조가 기본값**에 가깝습니다. Meta 개발자 문서상 `purchase_roas`는 “하나 이상의 연결된 Facebook Business Tools에서 받은 구매 정보를 광고에 귀속한 ROAS”이고, `website_purchase_roas`는 “웹사이트에서 Pixel이 기록한 전환 가치에 기반한 ROAS”입니다. 또 `action_values`는 “광고에 귀속된 모든 전환의 총 가치”입니다. 즉 Meta 분자는 **PG 확정 매출이 아니라 attributed conversion value**입니다. ([Facebook Developers][1])

이걸 실무적으로 풀면, Meta ROAS는 3층 구조로 봐야 합니다.

첫째, **무슨 가치(value)를 분자로 잡느냐**입니다.

* `purchase_roas`는 Pixel만이 아니라 **연결된 Business Tools 전체** 기준일 수 있습니다.
* `website_purchase_roas`는 **웹사이트 Pixel 전환 가치** 기준입니다.
  즉 같은 “구매 ROAS”처럼 보여도, 어떤 필드를 보고 있느냐에 따라 분자 범위가 다를 수 있습니다. 이 점 하나만으로도 Ads Manager 값이 우리 내부 `confirmed` 매출보다 넓게 보일 수 있습니다. ([Facebook Developers][1])

둘째, **어떤 attribution window로 귀속하느냐**입니다.
Meta Insights API 문서에서 `action_attribution_windows`는 `1d_view`, `7d_view`, `1d_click`, `7d_click`, `1d_ev`, `dda` 등을 받을 수 있고, API의 `default`는 `["7d_click","1d_view"]`입니다. 또 `1d_ev`는 동영상 광고를 10초 이상 보거나 짧은 영상의 97% 이상을 본 뒤 1일 내 발생한 engaged-view 전환을 뜻합니다. 즉 Meta 값은 클릭뿐 아니라 **뷰/인게이지드뷰 규칙**에 따라 분자가 달라질 수 있습니다. ([Facebook Developers][1])

셋째, **Ads Manager와 API를 같게 맞췄는지**입니다.
Meta 문서상 `use_unified_attribution_setting=true`를 줘야 “Ads Manager와 같은 동작”을 하며, 이때 ad set 수준의 unified attribution setting을 사용합니다. 반대로 이걸 안 주면 account attribution setting이나 API 기본 창으로 읽을 수 있습니다. 즉 지금 숫자를 비교할 때는 **“이 API 응답이 정말 Ads Manager와 같은 attribution setting으로 조회된 것인가”**를 먼저 확인해야 합니다. ([Facebook Developers][1])

넷째, **같은 전환을 어느 날짜에 놓느냐**입니다.
`action_report_time`은 `impression / conversion / mixed`를 받을 수 있고, 문서 예시도 “1월 1일에 광고를 보고 1월 2일에 전환했을 때, impression 기준이면 1월 1일에 잡히고 conversion 기준이면 1월 2일에 잡힌다”고 설명합니다. 그래서 같은 최근 7일이라도 어떤 endpoint는 conversion day, 어떤 표는 impression day로 보면 **일별 차트가 서로 안 맞을 수 있습니다.** ([Facebook Developers][1])

여기까지를 당신 상황에 바로 대입하면, 지금 내부 문서 해석은 대체로 맞습니다.
당신 팀 문서상 최근 7일 biocom 기준으로 `Attribution confirmed ROAS 0.53x`, `confirmed+pending 0.77x`, `Meta purchase ROAS 4.09x`이고, `/ads`의 메인 ROAS는 이제 attribution confirmed를 primary로 쓰고 Meta purchase ROAS는 reference only로 낮췄습니다. 이 운영 원칙은 **Meta의 측정 구조를 감안하면 맞는 판단**입니다. 내부 ROAS는 “PG 확정 매출 중심”, Meta ROAS는 “광고 플랫폼 귀속 가치 중심”이라서, 둘은 처음부터 같은 숫자가 아닙니다.

제 판단을 더 분명히 쓰면 이렇습니다.

* **운영 메인값**: Attribution `confirmed` ROAS
* **운영 보조값**: `confirmed + pending` ROAS
* **플랫폼 참고값**: Meta `purchase_roas` 또는 UI의 purchase ROAS

왜냐하면 Meta 공식 정의상 그 값은 **광고에 귀속된 전환 가치**이고, 우리 내부 정의는 **확정 결제 매출**이기 때문입니다. 둘이 다를 수밖에 없습니다. ([Facebook Developers][1])

지금 바로 좁히는 방법은 복잡하지 않습니다.

**1. Meta에서 어떤 ROAS 필드를 보고 있는지 먼저 고정하세요.**
`purchase_roas`인지, `website_purchase_roas`인지, 아니면 UI purchase value 기반 커스텀 계산인지 먼저 고정해야 합니다. 이걸 안 정하면 “Meta ROAS”가 매번 다른 의미가 됩니다. 공식 정의상 `purchase_roas`와 `website_purchase_roas`는 같은 필드가 아닙니다. ([Facebook Developers][1])

**2. API는 반드시 Ads Manager parity로 뽑으세요.**
같은 계정/기간/레벨로 조회하되:

* `use_unified_attribution_setting=true`
* `action_report_time=conversion`
* 동일 `time_range` 또는 `date_preset`
* 동일 `time_increment`
  를 고정해서 뽑아야 합니다. 문서상 `use_unified_attribution_setting=true`가 Ads Manager와 같은 동작이고, `action_report_time`은 전환이 어느 날짜에 잡히는지 바꿉니다. ([Facebook Developers][1])

**3. 내부 비교는 3줄로만 보세요.**

* Meta purchase ROAS
* Attribution confirmed ROAS
* Attribution confirmed+pending ROAS

이 3개를 같은 기간에 같이 보면,

* Meta가 얼마나 넓게 잡는지
* pending 때문에 우리 쪽이 얼마나 눌려 있는지
  를 동시에 볼 수 있습니다. 당신 문서도 이 구조로 바꾸는 중인데, 그 방향이 맞습니다.

**4. 일별 비교는 꼭 conversion-day 기준으로 통일하세요.**
`action_report_time`이 다르면 Meta 쪽 일별 매출이 하루씩 밀려 보이거나 당겨 보일 수 있습니다. 일별 표와 headline 카드가 안 맞는 이유 중 하나가 이 축일 가능성이 있습니다. ([Facebook Developers][1])

**5. 마지막으로 raw 검증을 붙이세요.**
지금 내부 문서가 잡은 후속 과제, 즉

* BigQuery raw purchase same-day
* GTM 오류 정리
* alias mapping
  이 순서는 타당합니다. 다만 일반론으로 보면 **alias보다 먼저** Meta ROAS 정의와 날짜축을 고정해야 합니다. alias는 캠페인 drill-down 문제를 풀고, attribution setting / report time은 headline ROAS 정의를 바로잡습니다.

제가 지금 단계에서 추가로 보면 좋은 파일은 4개입니다.

1. **같은 시각에 뽑은 Ads Manager 기준값 스크린샷**

   * account / campaign / adset level 중 무엇인지
   * attribution setting 표시 포함
2. **`/api/ads/site-summary` raw JSON 1개**
3. **`/api/ads/roas/daily` raw JSON 1개**
4. **`meta_campaign_alias_audit.biocom.json`**
   이 4개가 있으면, “Meta ROAS가 왜 4x대냐”를 **정의 차이 / 날짜 차이 / alias 차이 / 과발화 가능성**으로 더 깔끔하게 잘라볼 수 있습니다.

원하시면 아래 프롬프트를 딥리서치용으로 그대로 쓰시면 됩니다.

```text
목표:
Meta Ads의 ROAS 측정 방식을 공식 문서 기준으로 정리하고, 우리 내부 Attribution confirmed ROAS와 왜 차이가 나는지 원인별로 분해하라.

반드시 다룰 것:
1. Meta `purchase_roas`와 `website_purchase_roas`의 공식 정의 차이
2. `action_values`가 무엇인지, Meta ROAS 분자와 어떤 관계인지
3. `action_attribution_windows`가 Meta ROAS에 어떤 영향을 주는지
4. `use_unified_attribution_setting=true`가 왜 Ads Manager parity에 중요한지
5. `action_report_time=impression vs conversion`이 일별 비교에 어떤 차이를 만드는지
6. Ads Manager 화면값과 Marketing API 값이 어긋나는 대표 원인
7. Pixel / CAPI / connected business tools / offline events가 분자에 미치는 영향
8. 우리 환경에서 Meta ROAS가 과장될 수 있는 경로와 Attribution confirmed가 과소평가될 수 있는 경로
9. Meta 공식 문서와 개발자 문서를 우선 사용하고, 추정은 추정이라고 명시할 것

우리 내부 비교 기준:
- Meta purchase ROAS
- Attribution confirmed ROAS
- Attribution confirmed+pending ROAS
- best-case ceiling

분석 산출물 형식:
- 10초 요약
- 공식 정의 표
- 우리 상황에의 적용
- 과장 가능성이 큰 쪽 / 과소평가 가능성이 큰 쪽
- 숫자 차이를 줄이기 위한 실행 체크리스트
- 추가로 필요한 데이터 목록

중요:
- Meta 공식 문서와 Meta Developers 문서를 우선 인용할 것
- 광고 대시보드 운영자가 바로 이해할 수 있는 쉬운 한국어로 쓸 것
- “확정 매출”과 “플랫폼 귀속 가치”를 절대 혼동하지 말 것
```

지금 바로 제가 더 구체적으로 들어가려면, **Ads Manager 스크린샷 1장**과 **site-summary / daily raw JSON** 2개만 있으면 충분합니다.

[1]: https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights "Ad Account, Insights - Documentation - Meta for Developers"
