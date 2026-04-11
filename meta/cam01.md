# utm_campaign alias 검토 가이드

작성 시각: 2026-04-11 KST

## 결론

`utm_campaign alias 검토`는 **사이트 전체 ROAS 차이를 바로 줄이는 작업이 아니다.**

이 작업의 목적은 내부 주문 원장의 `utm_campaign` 값을 Meta의 실제 `campaign_id / campaign_name`에 연결해서, 캠페인별 Attribution ROAS를 열기 위한 것이다.

현재는 site-level로는 `Meta ROAS vs Attribution ROAS` 비교가 가능하지만, 캠페인별로는 아직 `(unmapped)`가 크다. 이유는 내부 주문에는 `meta_biocom_yeonddle_igg` 같은 사람이 만든 alias가 남고, Meta 광고 데이터에는 `120213362391690396` 같은 campaign ID와 `[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)` 같은 campaign name이 남기 때문이다.

즉, 이 작업은 아래 질문에 답하는 일이다.

> 이 주문들의 `utm_campaign=meta_biocom_yeonddle_igg`는 Meta 광고관리자 안의 어떤 캠페인에서 온 것인가?

## 왜 필요한가

캠페인별 ROAS를 계산하려면 두 데이터가 같은 키로 붙어야 한다.

- 내부 Attribution 원장: 주문, 매출, `utm_campaign`, `fbclid`, 결제 상태가 있음.
- Meta Ads API: campaign ID, campaign name, spend, purchase value, adset/ad 이름, landing URL이 있음.

지금은 `utm_campaign`과 `campaign_id`가 직접 일치하지 않는다. 그래서 캠페인별 표에서 내부 confirmed revenue가 특정 캠페인에 붙지 못하고 `(unmapped)`로 남는다.

이 상태에서 캠페인별 Attribution ROAS를 운영 판단값으로 쓰면 위험하다. 어떤 캠페인이 실제로 팔았는지 모르는 상태에서 매출을 잘못 붙일 수 있기 때문이다.

## 이 작업으로 바뀌는 것

검토 전:

- 사이트 전체 Attribution ROAS는 볼 수 있음.
- 캠페인별 Attribution ROAS는 대부분 `(unmapped)`라 신뢰하기 어려움.

검토 후:

- 검증된 alias만 특정 Meta campaign ID에 연결됨.
- 캠페인별로 `spend / confirmed revenue / orders / ROAS`를 나눠 볼 수 있음.
- 어떤 캠페인을 증액, 유지, 중단할지 더 구체적으로 판단 가능.

단, 잘못 yes를 누르면 캠페인별 매출이 오염된다. 애매하면 확정하지 않는 것이 맞다.

## 어디서 하는가

1. `http://localhost:7010/ads` 접속.
2. 사이트를 `바이오컴`으로 선택.
3. 아래쪽 `utm_campaign alias 검토` 섹션 확인.
4. 각 alias row에서 후보 campaign을 보고 `yes` 또는 `no`를 판단.

현재 대상은 biocom이다.

## 화면에 보이는 항목 뜻

`aliasKey`

- 내부 주문 원장에 들어온 `utm_campaign` 값이다.
- 예: `meta_biocom_yeonddle_igg`
- 고객이 광고 링크를 타고 들어왔을 때 URL이나 푸터 스크립트가 보존한 캠페인명이라고 보면 된다.

`confirmed / pending / 전체 주문`

- 이 alias로 들어온 주문 수와 매출이다.
- `confirmed`는 실제 결제 확정 매출이라 가장 중요하다.
- `pending`은 가상계좌 미입금 등 아직 확정 전이므로 보조로만 본다.

`candidate campaign`

- 이 alias와 연결될 가능성이 있는 Meta 캠페인 후보이다.
- 후보는 `data/meta_campaign_alias_audit.biocom.json`의 Meta campaign/adset/ad audit와 `data/meta_campaign_aliases.biocom.json`의 seed를 합쳐서 만든다.

`spend / purchase value / Meta ROAS`

- 해당 Meta campaign의 광고비와 Meta가 잡은 구매값이다.
- 이 값은 후보 campaign의 규모를 보는 참고값이지, alias 확정의 단독 근거는 아니다.

`landing URL 힌트`

- Meta 광고 소재에 남아 있는 랜딩 URL 또는 URL 태그다.
- 여기에 alias와 같은 `utm_campaign`이 있으면 강한 증거다.
- 현재는 link URL이 비어 있는 광고가 많아서 이 힌트만으로 판단이 안 되는 경우가 있다.

`대표 adset / 대표 ad`

- 후보 campaign 안에서 spend가 크거나 대표성 있는 광고세트명, 광고명이다.
- 인플루언서명, 제품명, 공동구매명, 소재명이 alias와 맞는지 확인한다.

## yes를 누르는 기준

아래 조건을 대부분 만족할 때만 `yes`를 누른다.

- alias 안의 핵심 단어가 Meta campaign, adset, ad name, URL tag 중 하나와 명확히 연결된다.
- 예: `yeonddle`, `proteinstory`, `acid`, `hormon`, `supplements` 같은 단어가 후보 campaign 하위 adset/ad/URL에 직접 보인다.
- 후보 campaign의 제품군이 alias의 제품군과 맞다.
- 예: `igg`, `acid` 계열이면 음식물 과민증 검사 또는 유기산/대사검사 계열인지 확인한다.
- 주문 발생 기간과 campaign 운영 기간이 겹친다.
- 후보가 2개 이상일 때도 한 후보가 다른 후보보다 명확하다.
- Meta 광고관리자에서 campaign/adset/ad 상세를 봐도 같은 결론이다.

`yes`는 “이 alias의 주문 매출을 이 campaign에 붙여도 된다”는 뜻이다.

## no를 누르는 기준

아래에 해당하면 `no`를 누른다.

- 후보 campaign 이름이나 adset/ad 이름이 alias와 맞지 않는다.
- 제품군이 다르다.
- 예: alias는 영양제인데 후보는 음식물 과민증 검사 캠페인이다.
- 날짜가 맞지 않는다.
- alias 주문은 4월에 발생했는데 후보 campaign은 해당 기간에 거의 집행되지 않았다.
- 후보가 단순히 “비슷한 family”일 뿐 직접 증거가 없다.
- link URL, URL tag, adset/ad name 어디에도 alias 단서가 없다.

`no`는 “이 alias가 틀렸다”가 아니라 “이 후보 campaign은 이 alias의 정답이 아니다”라는 뜻이다.

모든 후보에 `no`가 붙으면 해당 alias는 `rejected_all_candidates` 상태가 된다. 그 경우 새 후보를 audit에서 추가하거나 Meta 광고관리자에서 더 찾아봐야 한다.

## 애매할 때 원칙

애매하면 `yes`를 누르지 않는다.

잘못된 `yes`는 캠페인별 ROAS를 오염시킨다. 반대로 yes를 늦게 누르면 캠페인별 ROAS가 잠시 `(unmapped)`로 남을 뿐이다. 지금 단계에서는 false positive가 false negative보다 더 위험하다.

따라서 판단 우선순위는 아래와 같다.

1. URL tag 또는 landing URL에 같은 `utm_campaign`이 있으면 가장 강한 증거다.
2. adset/ad name에 alias 단어가 직접 있으면 강한 증거다.
3. campaign name의 제품군과 alias 제품군이 같으면 보조 증거다.
4. spend, purchase value, Meta ROAS는 참고값이지 단독 확정 근거가 아니다.
5. 후보가 섞여 있거나 광고명 샘플이 여러 인플루언서로 섞이면 보류한다.

## Meta 광고관리자를 켜서 봐야 하는가

가능하면 켜서 보는 것이 맞다.

현재 API audit에는 campaign/adset/ad 이름과 일부 landing URL이 들어오지만, link URL이 비어 있는 소재가 많다. 이 경우 화면에 보이는 정보만으로는 확정하기 어렵다.

Meta 광고관리자에서 확인할 것:

- campaign ID 또는 campaign name 검색.
- 해당 campaign의 ad set 목록 확인.
- ad set name에 alias 단어, 인플루언서명, 제품군이 있는지 확인.
- ad 목록에서 광고명과 미리보기 URL 확인.
- URL parameters 또는 website URL에 `utm_campaign`이 있는지 확인.
- 운영 기간과 spend가 alias 주문 발생 기간과 맞는지 확인.

광고관리자에서 `utm_campaign`이 직접 보이면 yes 가능성이 높다. 직접 보이지 않고 이름만 비슷하면 보류하거나 no로 두는 편이 안전하다.

## yes/no를 누르면 실제로 무엇이 바뀌는가

`yes` 또는 `no`를 누르면 `data/meta_campaign_aliases.biocom.json` seed 파일이 업데이트된다.

- `yes`: 해당 alias가 특정 `selected_campaign_id`에 `manual_verified`로 저장된다.
- `no`: 해당 campaign ID가 `rejected_campaign_ids`에 저장된다.
- 모든 후보가 no면 `rejected_all_candidates`가 된다.

중요한 점:

- 이 작업은 검증 seed를 만드는 단계다.
- 캠페인별 Attribution ROAS에 반영하려면 matcher가 `manual_verified` seed만 읽도록 연결되어야 한다.
- 자동 fuzzy 매칭은 아직 금지하는 것이 맞다.

## 작업 순서

1. `/ads`에서 검토 필요 alias를 확인한다.
2. confirmed revenue가 큰 alias부터 본다.
3. 후보 campaign의 adset/ad 이름과 landing URL 힌트를 확인한다.
4. 애매하면 Meta 광고관리자에서 campaign ID를 검색한다.
5. 확실하면 yes.
6. 명확히 틀리면 no.
7. 판단 근거가 부족하면 누르지 않고 보류한다.
8. `manual_verified`가 쌓이면 matcher에 연결하고 `(unmapped)` 비율이 줄어드는지 확인한다.

## 예시 판단

`meta_biocom_yeonddle_igg`

- yes 가능: 후보 campaign 하위 adset/ad 이름에 `yeonddle`, `연뜰`, `공동구매`, `igg`가 직접 보이고 운영 기간이 주문 기간과 맞음.
- no 또는 보류: 후보 ad sample에 여러 인플루언서가 섞여 있고 `yeonddle` 직접 증거가 없음.

`meta_biocom_iggacidset_2026`

- yes 가능: 후보 campaign이 음식물 과민증/유기산/대사검사 계열이고 URL tag 또는 adset/ad name에 `acid`, `igg`, `set` 단서가 있음.
- no 또는 보류: 후보가 단순히 `igg` family라는 이유만으로 묶인 상태이고 제품군/소재명이 직접 맞지 않음.

## 지금 가장 중요한 원칙

site-level ROAS 판단과 campaign-level ROAS 판단을 섞지 않는다.

- site-level: 지금도 운영 판단 가능.
- campaign-level: alias manual verification 전까지 운영 판단 금지.

따라서 alias 검토의 목표는 “Meta ROAS와 Attribution ROAS의 3배 차이를 바로 해결”하는 것이 아니라, “어떤 캠페인이 내부 confirmed revenue를 만들었는지 안전하게 나누는 것”이다.
