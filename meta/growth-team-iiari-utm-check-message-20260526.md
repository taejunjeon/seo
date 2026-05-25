작성 시각: 2026-05-26 01:04 KST
기준일: 2026-05-26
문서 성격: 그로스팀 전달용 `/iiary02` 이아리 광고세트/UTM 확인 메시지 초안

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - docurule.md
    - meta/growth-team-meta-numeric-utm-request-20260525.md
    - project/meta-placeholder-date-comparison-20260526.md
  lane: Green
  allowed_actions:
    - growth_team_request_draft
    - read_only_evidence_summary
    - no_raw_click_id_output
  forbidden_actions:
    - Meta ads mutation
    - URL parameter edit request as immediate action
    - platform send
    - operating DB write
    - VM Cloud SQLite write
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only attribution_ledger + TJ님 Ads Manager screenshots/click samples
    window: /iiary02 bridge 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC
    site: biocom
    freshness: 2026-05-26 00:29 KST read-only query
    confidence: high for A/D counts, medium for preview-click interpretation
```

## 10초 요약

그로스팀에는 광고 수정을 요청하지 않는다.

요청할 핵심은 `meta_biocom_iiari_260518`와 `meta_biocom_iiari_260518 - 사본`이 왜 동시에 머신러닝 진행 중인지, 그리고 두 광고세트/하위 광고의 실제 URL Parameters가 현재 어떤 값으로 저장되어 있는지 확인해 달라는 것이다.

현재 내부 원장에서는 `/iiary02` 실제 결제 흐름 대부분이 숫자 Meta ID로 잡히고 있다. 문제는 일부 row에서만 숫자로 바뀌어야 할 값이 템플릿 문구 그대로 남은 것이다.

## 그로스팀에 보낼 메시지 초안

안녕하세요. 바이오컴 Meta 광고 유입 정합성 때문에 이아리 광고세트 2개에 대한 확인 요청드립니다.

이번 요청은 광고를 바로 수정해 달라는 요청이 아닙니다. 현재 잘 돌고 있는 광고의 학습을 건드리지 않기 위해, 우선 Ads Manager에 실제로 저장된 설정값을 읽기 전용으로 확인하려는 목적입니다.

현재 내부 결제/체크아웃 원장 기준으로 `/iiary02` 랜딩은 대부분 Meta 숫자 ID가 정상적으로 잡히고 있습니다.

- `/iiary02` 숫자 ID 매칭 가능 row: 132건
- 그중 결제완료: 48건
- 결제완료 금액: 17,742,820원
- 숫자 ID 없이 템플릿 문구가 그대로 남은 row: 16건
- 그중 결제완료: 6건
- 결제완료 금액: 1,894,000원

따라서 현재 문제는 “이아리 광고에 UTM이 전혀 없다”가 아닙니다. 실제 고객 결제 흐름에서는 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id` 숫자 ID가 대부분 남고 있습니다. 다만 일부 클릭/결제 흐름에서만 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`, `{{site_source_name}}`, `{{placement}}` 같은 템플릿 문구가 숫자로 바뀌지 않은 상태로 남았습니다.

확인 부탁드릴 광고세트는 아래 2개입니다.

1. `meta_biocom_iiari_260518`
   - campaign ID: `120245003319500396`
   - adset ID: `120245700952890396`
   - 내부 원장 기준 A급 row: 89건
   - 결제완료: 32건
   - 결제완료 금액: 10,569,200원

2. `meta_biocom_iiari_260518 - 사본`
   - campaign ID: `120245003319500396`
   - adset ID: `120245956430970396`
   - 내부 원장 기준 A급 row: 26건
   - 결제완료: 11건
   - 결제완료 금액: 4,436,570원

확인해주시면 좋은 내용은 아래입니다.

1. 두 광고세트가 왜 동시에 머신러닝 진행 중인지 확인 부탁드립니다.
   - 원본과 사본을 동시에 운영하는 목적이 테스트인지, 기존 세트 대체인지, 복제 실수인지, 파트너십 광고 권한/세팅 이슈 때문인지 알고 싶습니다.
   - 예산 판단을 위해 두 광고세트를 별도 성과로 봐야 하는지, 하나의 이아리 묶음으로 봐야 하는지도 함께 확인 부탁드립니다.

2. 각 광고세트 하위 광고별로 아래 값을 그대로 공유 부탁드립니다.
   - 캠페인명 / campaign ID
   - 광고세트명 / adset ID
   - 광고명 / ad ID
   - 게재 상태
   - 웹사이트 URL 또는 랜딩 URL
   - URL Parameters 원문
   - 광고가 원본인지 사본인지
   - 마지막 수정 시각 또는 최근 영향이 큰 변경 시각

3. URL Parameters가 아래처럼 들어가 있는지 확인 부탁드립니다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
utm_id={{campaign.id}}
campaign_alias=meta_biocom_광고별칭
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
meta_site_source={{site_source_name}}
meta_placement={{placement}}
```

여기서 중요한 점은 `campaign_alias=meta_biocom_광고별칭`은 공통 placeholder라서 내부 매칭 근거로는 약합니다. 신규 광고나 수정이 필요한 광고에는 `campaign_alias=meta_biocom_iiari_260518_igg`처럼 광고세트/소재를 구분할 수 있는 고유 별칭을 쓰는 것이 좋습니다.

다만 기존에 잘 돌아가고 있는 광고는 URL을 바로 수정하지 말아 주세요. 먼저 설정값과 실제 export 값만 확인하고, 수정 여부는 별도로 판단하겠습니다.

4. 가능하다면 Ads Manager export도 함께 부탁드립니다.
   - 캠페인, 광고세트, 광고 레벨이 모두 들어간 export가 좋습니다.
   - URL Parameters 또는 URL 태그 컬럼이 포함되면 내부에서 바로 대조할 수 있습니다.
   - export가 어렵다면 각 광고의 검토 화면 캡처와 URL Parameters 원문 복사만으로도 우선 확인 가능합니다.

5. 검토 화면에서 웹사이트 URL을 클릭하면 `https://biocom.kr/iiary02?fbclid=...`처럼 보일 수 있습니다.
   - 이 화면만으로 “실제 고객 클릭에도 UTM이 없다”고 단정하지는 않겠습니다.
   - 내부 원장에서는 실제 결제 흐름 대부분이 숫자 Meta ID로 잡히고 있기 때문입니다.
   - 다만 일부 결제에서만 템플릿 문구가 그대로 남아 있어, 실제 광고별 URL Parameters 저장 상태와 사본 운영 이유를 확인하려는 목적입니다.

확인 결과를 주시면 내부에서는 아래처럼 처리하겠습니다.

- 숫자 campaign/adset/ad ID가 확인되는 건은 A급 매칭으로 유지합니다.
- 사본 운영 이유가 확인되면 원본/사본 성과를 나눠 볼지, 이아리 캠페인 묶음으로 볼지 정리합니다.
- 템플릿 문구가 그대로 남은 D급 16건은 특정 광고에 임의 배정하지 않고 수동확인 또는 보조 매출로 분리합니다.
- 신규 광고부터는 숫자 ID 매개변수와 고유 `campaign_alias`가 남도록 표준을 적용하겠습니다.

감사합니다.

## 내부 메모

그로스팀에 보내는 문장에서는 `macro가 남았다`라는 표현을 쓰지 않는다. 대신 아래처럼 말한다.

> Meta가 숫자 광고 ID로 자동 변환해야 하는 URL 매개변수가, 일부 실제 주문 기록에서는 숫자로 바뀌지 않고 템플릿 문구 그대로 저장되었습니다.

## 하지 않은 것

- 광고 수정 요청: 0
- URL parameter 즉시 변경 요청: 0
- Meta 플랫폼 send: 0
- VM Cloud/운영DB write: 0
