According to a document from 2026-04-09, 제 판단은 **메타 ROAS 쪽이 더 과장됐을 가능성이 높습니다.** 다만 **어트리뷰션 ROAS도 특히 30일-90일 구간은 실제보다 과하게 낮게 보이는 잠정치**라서, 지금 차이는 “한쪽만 틀렸다”보다 **양쪽이 서로 다른 방식으로 왜곡**된 결과에 가깝습니다.  

## 10초 요약

최근 7일 바이오컴 기준으로 보면, 광고비는 같고 분자만 다릅니다. 어트리뷰션은 `confirmed`만 써서 **0.53x**, 메타는 Ads Manager `purchase value`를 써서 **4.08x**인데, 지금 정보만 놓고 보면 **메타 값이 운영 판단용으로는 더 부풀어졌을 확률이 높습니다.** 

## 내 의견 한 줄

**지금 메인 판단값은 계속 “Attribution confirmed ROAS”로 두는 게 맞고, Meta ROAS는 보조 참고값으로만 봐야 합니다.** 실제 문서도 `/ads`와 `/ads/roas`의 메인 source-of-truth를 attribution confirmed 기준으로 맞추고, Meta purchase ROAS는 reference only로 낮췄습니다.  

## 원인 3가지

### 1) 두 숫자는 애초에 같은 ROAS가 아닙니다

무슨 일인지: 어트리뷰션 기준은 `Meta로 귀속된 confirmed revenue / 광고비`이고, Meta 기준은 `Ads Manager purchase value / 광고비`입니다. 최근 7일 바이오컴 기준 광고비는 `₩27,724,670`, 어트리뷰션 confirmed 매출은 `₩14,586,790`로 `0.53x`, Meta purchase value는 `₩112,991,932`로 `4.08x`입니다. 

왜 문제인지: 이름은 둘 다 ROAS인데, 실제로는 **하나는 “확정 매출 중심”**, 다른 하나는 **“광고 플랫폼이 넓게 본 구매값”**입니다. 같은 숫자처럼 비교하면 오판합니다. 

결과 영향: 지금 차이는 “0.53 vs 4.08”의 단순 오차가 아니라, **정의 자체가 다른 두 숫자를 같은 축에 올린 결과**입니다. 그래서 메타 값이 높다고 바로 광고가 잘 된다고 볼 수 없고, 어트리뷰션 값이 낮다고 바로 광고가 망했다고 보기도 어렵습니다. 

### 2) 어트리뷰션은 최근 구간에서는 덜 잡고, 긴 구간에서는 더 심하게 덜 잡고 있습니다

무슨 일인지: 최근 7일 Meta 귀속 매출 안에도 `pending ₩6,813,750`가 있고, 어트리뷰션은 이걸 메인 ROAS에서 제외합니다. 또 14일-30일-90일 구간에서 어트리뷰션 매출이 거의 `₩15.94M` 근처로 고정인데 광고비만 커집니다. 문서도 이걸 cutover bias, historical under-coverage로 해석합니다. 

왜 문제인지: 이 상태에서는 **최근 7일은 약간 낮게**, **30일-90일은 꽤 많이 낮게** 보입니다. 실제로 pending을 전부 confirmed로 가정해도 최근 7일 ROAS는 `0.77x` 정도입니다. 

결과 영향: **최근 7일 어트리뷰션 0.53x는 보수적인 값**, **30일-90일 어트리뷰션 0.14x / 0.05x는 지금 그대로 의사결정에 쓰기엔 너무 낮은 잠정치**라고 보는 게 맞습니다. 

### 3) 메타 쪽은 과대 귀속과 이벤트 품질 문제 가능성이 큽니다

무슨 일인지: 문서 자체가 Meta purchase ROAS가 실제 확정 매출보다 높게 잡힐 확률이 높다고 보고 있습니다. 이유로는 click/view attribution window, purchase value의 정의 차이, legacy firing, duplicate purchase event 가능성, 그리고 바이오컴 결제 페이지의 `GTM-W7VXS4D8` 커스텀 스크립트 오류를 듭니다.   

왜 문제인지: 이쪽은 “광고가 기여했을 수 있다”를 넓게 잡는 경향이 있는데, 지금처럼 payment page 품질 이슈와 historical row 혼선이 남아 있으면 **확정 매출보다 더 높게 보일 여지**가 큽니다. 

결과 영향: 최근 7일 기준으로 Meta purchase value `₩112.99M`는 Attribution confirmed `₩14.59M`의 약 `7.75배`, confirmed+pending `₩21.40M`의 약 `5.28배`입니다. 심지어 같은 7일 전체 사이트 confirmed 매출 `₩48.92M`를 메타에 전부 몰아줘도 ROAS 상한은 약 `1.76x`라서, **4.08x는 운영용 main ROAS로 보기엔 지나치게 큽니다.** 이 부분 때문에 저는 “지금 더 과장된 쪽은 Meta”라고 봅니다. 

## 그래서 뭐가 더 과장됐나

제 판단을 구간별로 나누면 이렇습니다.

* **최근 7일:**
  **Meta ROAS가 더 과장됐을 가능성이 높습니다.** 어트리뷰션 0.53x는 낮게 잡혔을 수 있지만, pending을 다 더해도 0.77x 수준이고, 사이트 전체 confirmed를 전부 Meta로 몰아도 1.76x입니다. 그래서 4.08x는 “정의가 넓은 플랫폼 값”으로는 이해되지만, 실제 확정 매출 중심 운영값으로는 너무 높습니다. 

* **최근 30일-90일:**
  **둘 다 왜곡됐습니다.** Meta는 높게, Attribution은 낮게. 다만 **Attribution 쪽이 장기 구간에서 과소평가된 폭이 커서**, 이 구간은 지금 “정확한 절대값”보다 “보수적 하한선”으로 읽는 게 맞습니다. 

## alias 매핑 설계에 대한 피드백

설명해 주신 설계 방향은 **맞습니다.**
특히 이 4개는 아주 좋습니다.

* file-based seed로 시작
* `site + channel + alias_key + valid_from/valid_to`
* direct match 실패 시에만 seed 조회
* 억지 매핑 금지, `unmapped` 유지

이건 안전한 설계입니다. **지금 단계에서 추측 매핑을 넣지 않는 판단도 맞습니다.** 캠페인별 ROAS는 숫자가 예민해서, 잘못 붙이면 “모른다”보다 더 나쁜 대시보드가 됩니다.

다만 중요한 점이 하나 있습니다.

> **이 alias 매핑은 “캠페인 drill-down 문제”를 푸는 것이지, 지금 headline 수준의 “0.53x vs 4.08x” 격차를 바로 줄이는 해법은 아닙니다.**

왜냐하면 지금 설명한 문제는 “최근 7일 confirmed Meta 주문 49건 / ₩14.6M이 전부 `(unmapped)`로 모인다”는 것이고, 이건 **총 Meta attributed revenue를 못 잡는 문제라기보다, 그 매출을 캠페인별로 못 나누는 문제**에 가깝기 때문입니다. 즉 alias mapping이 들어가면 `(unmapped)`이 캠페인들로 흩어질 수는 있지만, **사이트 전체 Attribution ROAS 0.53x 자체가 갑자기 4x로 올라가진 않습니다.** 이건 꼭 분리해서 보셔야 합니다.

제가 설계에 3가지만 추가하라고 하면:

* `last_verified_at`
* `evidence` 또는 `source_note`
* `match_reason`
  이 3개입니다. 나중에 “왜 이 alias를 이 campaign_id에 붙였지?”를 바로 추적할 수 있어야 합니다.

## 좁힐 수 있는 방법 3단계

### 지금 당장(오늘)

1. **7일 기준 3개 숫자를 한 카드에 같이 보여주세요.**

   * Attribution confirmed ROAS
   * Attribution confirmed+pending ROAS
   * Meta purchase ROAS
     이 3개를 같이 보이면 “지연 확정”과 “플랫폼 과대귀속”을 구분하기 쉬워집니다. 지금 문서 숫자로는 0.53x / 0.77x / 4.08x 입니다. 

2. **최근 7일은 일자별로 쪼개서 보세요.**
   하루 단위로

   * spend
   * Meta purchase value
   * Attribution confirmed revenue
   * Attribution pending revenue
     를 나란히 놓으면, 특정 날짜만 튀는지 바로 보입니다.

3. **`unmapped revenue %`를 대시보드에 넣으세요.**
   지금 alias 문제는 캠페인 drill-down blocker입니다. `(unmapped)` 비중이 얼마인지 안 보이면, 캠페인 표가 얼마나 불완전한지 감이 안 옵니다.

### 이번 주

1. **Meta campaign/adset/ad/link_url audit export 만들기**
   이건 당신이 적은 다음 순서 1번이 맞습니다.
   export에 최소한 아래는 있어야 합니다.

   * campaign_id / campaign_name
   * adset_id / adset_name
   * ad_id / ad_name
   * effective_status
   * link_url
   * url_tags
   * 최근 7일 spend / purchase value

2. **alias seed 작성 후, API 출력에 `match_type`를 같이 넣으세요.**

   * `direct`
   * `alias_seed`
   * `unmapped`
     이렇게요. 그래야 사람이 숫자를 믿을 수 있습니다.

3. **BigQuery raw purchase / transaction_id 중복 확인**
   문서상 `(not set)` historical row와 payment page GTM 오류, raw export 검증 부족이 남아 있습니다. 이제는 same-day로 raw purchase count와 transaction_id duplication을 봐야 합니다. 문서도 `BigQuery raw export + hourly compare + caller coverage` 루틴을 다음 진단으로 잡고 있습니다.  

4. **biocom GTM-W7VXS4D8 오류 정리**
   이건 ROAS 차이의 직접 원인일 가능성이 큽니다. 결제 페이지에서 custom script 오류가 남아 있으면 Meta purchase event 품질을 의심해야 합니다.  

### 다음 배치

1. **랜딩 URL에 Meta 실제 ID를 직접 싣는 방향**
   장기적으로는 지금 설명한 방향이 맞습니다.
   `meta_campaign_id / meta_adset_id / meta_ad_id`를 직접 넣으면 alias layer 의존이 크게 줄어듭니다.

2. **cutover 경계 문구를 대시보드에 명시**

   * `live verified from 2026-04-08`
   * `long-range ROAS is conservative`
     같은 문구가 있어야 30일-90일 숫자 오해가 줄어듭니다.

3. **Meta purchase value는 계속 보조값으로만**
   phase 문서도 이미 `/ads` 메인 ROAS를 attribution 기준으로 정렬했고, Meta purchase ROAS는 reference only로 둡니다. 이 운영 원칙은 유지하는 게 맞습니다. 

## attroas.md 자체에 대한 피드백

이 문서는 **좋습니다.**
특히 아래가 좋습니다.

* 정의 차이를 분리해서 적음
* 최근 7일 / 14일 / 30일 / 90일을 나눔
* `confirmed`, `pending`, `site total confirmed`를 같이 보여줌
* 메타와 어트리뷰션 둘 다 왜곡 가능성을 따로 평가함

다만 2가지만 더 넣으면 더 좋아집니다.

1. **“내 운영 판단” 한 줄을 맨 위에 더 강하게**

   * 메인값: Attribution confirmed
   * 보조값: confirmed+pending
   * 참고값: Meta purchase
     이걸 맨 위에 박아두면 보는 사람이 덜 흔들립니다.

2. **“best-case ceiling” 한 줄 추가**

   * 최근 7일 전체 site confirmed를 전부 Meta로 줘도 약 1.76x
     이 한 줄이 들어가면 “왜 내가 Meta 4.08x를 못 믿는지”가 직관적으로 전달됩니다. 

## 지금 더 있으면 좋은 자료

더 좁히려면 아래 3개만 주시면 됩니다.

1. **같은 기간 Meta campaign/adset/ad export**

   * spend, purchase value, attribution setting, link_url, url_tags 포함

2. **BigQuery raw purchase query 결과**

   * 날짜별 purchase event 수
   * distinct transaction_id 수
   * duplicate transaction_id 상위 샘플

3. **최근 7일 Meta 귀속 confirmed 주문 샘플 20건**

   * orderId
   * amount
   * payment_status
   * utm_source / utm_medium / utm_campaign
   * fbclid
   * approvedDate

## 최종 판단

제 최종 의견은 단순합니다.

* **더 과장된 쪽:** Meta ROAS
* **더 보수적인 쪽:** Attribution confirmed ROAS
* **지금 가장 쓸만한 메인값:** Attribution confirmed
* **지금 가장 필요한 보조값:** confirmed+pending
* **지금 바로 해야 할 것:** alias audit export + GTM 오류 정리 + BigQuery same-day 대조

즉, **“메타가 잘못됐다”보다 “메타는 너무 넓게 잡고 있고, 어트리뷰션은 아직 덜 잡고 있다”가 더 정확한 표현**입니다. 하지만 운영 의사결정 기준으로 하나만 고르라면, 지금은 **Meta보다 Attribution confirmed 쪽이 덜 위험합니다.**  

Q1. 최근 7일 바이오컴 기준 Meta export에서 `campaign_id / campaign_name / adset_id / ad_id / link_url / url_tags / attribution setting`까지 뽑을 수 있습니까?
Q2. BigQuery raw purchase에서 최근 7일 `purchase events`와 `distinct transaction_id`를 날짜별로 뽑아주실 수 있습니까?
Q3. `(unmapped)`로 모인 49건/₩14.6M 주문의 상위 `utm_campaign` 10개만 보내주실 수 있습니까?
