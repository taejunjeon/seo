# UTM Campaign Alias 매핑 설계

작성일: 2026-04-09  
대상: `biocom` Meta 캠페인별 Attribution ROAS 매핑

## 1. 왜 이 설계가 필요한가

현재 캠페인별 Attribution ROAS는 **기술적으로 API가 이미 존재**하지만, 실제 주문 원장의 `utm_campaign` 값이 Meta Ads의 `campaign_name` / `campaign_id`와 직접 맞지 않아서 거의 전부 `(unmapped)`로 빠지고 있소.

### 현재 확인된 현상

- API: [backend/src/routes/ads.ts](/Users/vibetj/coding/seo/backend/src/routes/ads.ts#L999)
- `최근 7일 바이오컴` 기준
  - Meta confirmed attribution 주문: `49건`
  - attribution 매출: `₩14,586,790`
  - 캠페인별 응답: 실제 각 캠페인은 `attributedRevenue=0`
  - 별도 `(unmapped)` row 하나에 `₩14,586,790 / 49건`이 몰림

즉 지금은 **캠페인별 Attribution ROAS를 화면에 그대로 노출하면 오해를 만든다**는 뜻이오.

## 2. 왜 현재 매핑이 실패하는가

현재 매칭 로직은 [backend/src/routes/ads.ts](/Users/vibetj/coding/seo/backend/src/routes/ads.ts#L595) 기준으로:

1. `utm_campaign`
2. Meta `campaign_id`
3. Meta `campaign_name`

이 셋을 정규화해서 exact/fuzzy 비교하오.

그런데 실제 원장에 들어오는 값은 이런 형태요.

- `meta_biocom_yeonddle_igg`
- `meta_biocom_kimteamjang_supplements`
- `meta_biocom_proteinstory_igg`
- `meta_biocom_iggspring`
- `meta_biocom_allhormon_miraclemorningstory`

반면 Meta 실제 캠페인 이름은 이런 형태요.

- `[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)`
- `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)`
- `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
- `(NEW)공동구매 인플루언서 파트너 광고 모음(260126)`

즉 지금의 `utm_campaign`은 **campaign name이 아니라 운영 alias / 인플루언서 별칭 / 소재 계열명**에 가깝소.  
따라서 문자열 유사도만으로는 안정적으로 맞출 수 없소.

## 3. 설계 원칙

### 원칙 1. 추측 매핑을 바로 넣지 않는다

- `meta_biocom_yeonddle_igg`가 어느 Meta 캠페인에 속하는지 사람이 보기엔 감이 와도,
- 시점에 따라 `공동구매 인플루언서 파트너 광고 모음`과 `..._3`처럼 다른 campaign_id로 옮겨갈 수 있소.

따라서 **날짜 범위 없이 alias -> campaign_id를 고정 매핑하면 오매핑 위험이 크오.**

### 원칙 2. 1차는 파일 기반 seed로 간다

DB 스키마 추가는 승인 대상이니, 1차는 **파일 기반 수동 seed**가 맞소.

권장 파일:

- `data/meta_campaign_aliases.biocom.json`

장점:

- 운영 검증이 빠름
- 롤백이 쉬움
- 승인 없이 백엔드 로더만 추가해서 즉시 적용 가능

### 원칙 3. alias는 날짜 범위를 가져야 한다

같은 alias가 다른 시점에 다른 Meta campaign에 붙을 수 있으니, rule에는 최소한 아래가 있어야 하오.

- `valid_from`
- `valid_to`

### 원칙 4. confidence를 보존한다

매핑도 품질 단계가 다르오.

- `exact_id`
- `manual_verified`
- `inferred_from_alias`
- `fallback_family`

이걸 남겨야, 나중에 “이 캠페인별 Attribution ROAS를 어느 정도 믿을 수 있는가”를 설명할 수 있소.

## 4. 제안 데이터 모델

1차 파일 seed의 권장 스키마는 이렇소.

```json
[
  {
    "site": "biocom",
    "channel": "meta",
    "alias_key": "meta_biocom_yeonddle_igg",
    "match_type": "exact",
    "target_campaign_id": "120242626179290396",
    "target_campaign_name": "공동구매 인플루언서 파트너 광고 모음_3 (260323)",
    "valid_from": "2026-03-23",
    "valid_to": null,
    "confidence": "manual_verified",
    "source": "meta_adset_audit",
    "notes": "인플루언서 여는뜰 IGG 소재는 260323 이후 _3 캠페인으로 운영"
  }
]
```

필수 필드:

- `site`
- `channel`
- `alias_key`
- `match_type`
- `target_campaign_id`
- `valid_from`
- `confidence`

권장 필드:

- `target_campaign_name`
- `valid_to`
- `source`
- `notes`

## 5. 매칭 순서 설계

매칭은 아래 우선순위로 가야 하오.

### 1단계. direct match

기존 로직 유지:

- `utm_campaign == campaign_id`
- `utm_campaign == campaign_name`
- 정규화 exact/fuzzy

이건 계속 가장 높은 신뢰도로 유지하오.

### 2단계. alias seed exact match

`normalize(utm_campaign)` 후:

- `site`
- `channel=meta`
- `approvedDate ∈ [valid_from, valid_to]`

조건을 만족하는 exact rule을 찾소.

### 3단계. alias pattern match

필요하면 `prefix` / `regex` rule을 두되, 이건 `confidence=inferred_from_alias`로 낮춰야 하오.

예:

- `meta_biocom_.*_igg`
- `meta_biocom_.*_acid`

다만 이 단계는 **같은 family 안에서도 실제 campaign_id가 갈릴 수 있어** 아주 제한적으로만 쓰는 게 맞소.

### 4단계. unmapped 유지

매칭 안 되면 억지로 붙이지 말고 계속 `(unmapped)`로 남기오.

이게 중요하오.  
**잘못 붙은 캠페인별 ROAS는 0보다 더 위험하오.**

## 6. 구현 권장 구조

### 1차 구현

- 새 파일 로더: `backend/src/metaCampaignAliasMap.ts`
- seed 파일: `data/meta_campaign_aliases.biocom.json`
- `matchCampaignId()` 확장:
  - direct match 실패 시 alias seed 조회

### 2차 구현

응답에 아래 필드를 같이 실어주는 게 좋소.

- `mappingConfidence`
- `mappingSource`
- `unmappedReason`

예:

```ts
{
  campaignId: "120242626179290396",
  attributedRevenue: 4460250,
  roas: 0.8,
  orders: 13,
  mappingConfidence: "manual_verified"
}
```

### 3차 구현

`/api/ads/roas` summary에 이 수치를 추가하오.

- `mappedOrders`
- `mappedRevenue`
- `unmappedOrders`
- `unmappedRevenue`
- `mappingCoverageRate`

그래야 화면에서 “캠페인별 Attribution ROAS를 얼마나 믿을 수 있는지”를 같이 보여줄 수 있소.

## 7. 초기 운영 절차

### Step 1. 최근 30일 confirmed Meta 주문 alias inventory 추출

지금 바로 확인된 상위 alias는 이렇소.

| utm_campaign | orders | revenue |
| --- | ---: | ---: |
| `meta_biocom_yeonddle_igg` | 13 | ₩4,460,250 |
| `meta_biocom_proteinstory_igg` | 7 | ₩2,211,200 |
| `meta_biocom_iggspring` | 5 | ₩1,716,200 |
| `meta_biocom_mingzzinginstatoon_igg` | 4 | ₩980,000 |
| `meta_biocom_allhormon_miraclemorningstory` | 2 | ₩870,200 |
| `meta_biocom_kimteamjang_supplements` | 13 | ₩817,240 |

즉 상위 몇 개 alias만 잡아도 매출 커버리지가 빠르게 올라갈 가능성이 크오.

### Step 2. Meta campaign/adset/ad audit

현재 백엔드에는 Meta adset/ad/creative 조회 기반이 이미 있소.

- [backend/src/routes/meta.ts](/Users/vibetj/coding/seo/backend/src/routes/meta.ts#L661)

여기서 가져올 핵심:

- `campaign_id`
- `campaign_name`
- `adset.name`
- `ad.name`
- `creative.link_url`
- `object_story_spec.link_data.link`

즉 **실제 광고 링크와 adset/ad 이름을 뽑아 alias와 사람이 대조할 수 있는 자료를 만들 수 있소.**

### Step 3. 수동 검증 seed 작성

우선은 revenue 기준 상위 alias만 manual verify해서 seed에 넣소.

권장 기준:

- 최근 30일 revenue 상위 alias
- 누적 revenue의 80% 이상 커버

### Step 4. 매핑 커버리지 확인

배포 후 확인 지표:

- 기존 `unmappedOrders 49`가 얼마나 줄었는지
- `mappedRevenue / totalAttributedRevenue`
- 특정 캠페인 ROAS가 비정상적으로 튀지 않는지

## 8. 앞으로는 alias 대신 무엇을 남겨야 하는가

장기적으로는 alias 매핑 자체를 줄여야 하오.

가장 좋은 해법은 **랜딩 URL에 실제 Meta 식별자를 같이 실어 보내는 것**이오.

권장 추가 파라미터:

- `meta_campaign_id`
- `meta_adset_id`
- `meta_ad_id`

예:

```text
?utm_source=meta
&utm_campaign=meta_biocom_yeonddle_igg
&meta_campaign_id=120242626179290396
&meta_adset_id=120242626179290397
&meta_ad_id=120242626179290398
```

그러면 나중엔 alias는 설명용으로만 남고, 매핑은 `campaign_id` direct match로 끝나오.

## 9. 권장 구현 단계

### P1. 설계 고정

- 이 문서 기준으로 file-seed 구조 확정

### P2. audit export 추가

- Meta API에서 `campaign/adset/ad/link_url`를 한 번에 뽑는 스크립트 또는 API 추가

### P3. seed 파일 작성

- `data/meta_campaign_aliases.biocom.json`
- 상위 revenue alias부터 manual verify

### P4. ads router 연결

- `matchCampaignId()`에 alias seed 로더 연결

### P5. UI 노출

- 캠페인별 표에
  - `Attribution 매출`
  - `Attribution ROAS`
  - `mapping confidence`
  - `unmapped coverage`
  를 같이 노출

## 10. 최종 판단

- **캠페인별 Attribution ROAS는 가능하오.**
- 다만 지금은 `utm_campaign`이 실제 Meta campaign key가 아니라 운영 alias라서, **매핑 계층 없이는 신뢰도 있는 수치를 못 만든다**고 봐야 하오.
- 따라서 바로 UI에 붙이기보다,
  1. file-based alias seed
  2. 날짜범위
  3. confidence
  4. unmapped coverage 표시
  를 먼저 고정하는 것이 맞소.

한 줄로 정리하면:

**지금 필요한 건 “더 똑똑한 fuzzy match”가 아니라, `utm_campaign alias -> campaign_id`를 날짜범위와 검증 상태까지 가진 운영 매핑 레이어”요.**
