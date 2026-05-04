# Meta UTM 설정 운영 가이드

작성 시각: 2026-05-04 11:48 KST
문서 목적: 그로스 파트장이 신규 Meta 광고를 등록하거나 기존 광고를 복제할 때 URL Parameters/UTM을 어떻게 넣어야 하는지 안내한다.
대상: biocom Meta 광고, 신규 광고 URL Parameters, 향후 campaign mapping 자동화
관련 문서: `meta/campaign-mapping-growth-team-guide-20260504.md`, `meta/campaign-alias-mapping.md`, `data/!datacheckplan.md`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
    - docurule.md
    - frontrule.md
  required_context_docs:
    - meta/campaign-mapping-growth-team-guide-20260504.md
    - meta/campaign-alias-mapping.md
    - data/!datacheckplan.md
  lane: Green
  allowed_actions:
    - 문서 작성
    - 광고 URL 파라미터 설계
    - 운영팀 전달용 가이드 작성
  forbidden_actions:
    - Meta Ads Manager live 광고 수정
    - GTM publish
    - platform conversion send
    - production DB write
    - backend deploy
  source_window_freshness_confidence:
    source: "Meta URL parameter 운영 설계 + 기존 campaign mapping 정본 문서"
    window: "2026-05-04 KST 문서 작성 기준"
    freshness: "현재 문서는 설정 가이드이며 live 광고 변경 없음"
    confidence: 0.88
```

## 10초 요약

Meta 신규 광고에는 URL Parameters 칸에 아래 템플릿을 넣는다.

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&utm_id={{campaign.id}}&campaign_alias=meta_biocom_광고별칭&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}&meta_site_source={{site_source_name}}&meta_placement={{placement}}
```

핵심은 사람이 만든 이름이 아니라 Meta 숫자 ID를 남기는 것이다.
`{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 주문 원장에 남으면 나중에 캠페인별 내부 ROAS를 훨씬 정확하게 계산할 수 있다.

기존 live 광고를 한꺼번에 수정하지 않는다.
신규 광고와 복제 광고부터 적용하고, 고지출 미매핑 광고만 선별 수정한다.

## UTM을 쓰면 도움이 되는가

도움된다.
단, 그냥 아무 UTM이나 붙이면 안 되고 Meta 숫자 ID가 남도록 붙여야 한다.

UTM이 도움이 되는 이유:

1. 주문이 들어온 뒤 어느 광고에서 시작됐는지 내부 원장에 남는다.
2. Meta 광고비 데이터와 내부 매출 데이터를 campaign id로 붙일 수 있다.
3. `cellcleanerreel`, `yeonddle`, `songyuul` 같은 사람이 만든 별칭이 바뀌어도 숫자 ID로 다시 찾을 수 있다.
4. GA4, 내부 Attribution, `/ads/campaign-mapping`이 같은 키를 볼 수 있다.
5. 캠페인별 증액/감액 판단에서 `(unmapped)` 매출이 줄어든다.

UTM이 해결하지 못하는 것:

1. Meta 자체 attribution window 차이는 없어지지 않는다.
2. 사용자가 광고 클릭 후 다른 기기에서 구매하면 내부 원장만으로 100% 복구할 수 없다.
3. NPay처럼 외부 결제 후 사이트로 돌아오지 않는 흐름은 별도 server-side 보정이 필요하다.
4. 광고 URL이 아닌 게시글 본문 단축 URL, 인스타 프로필 링크, DM 링크에는 Meta 동적 파라미터가 자동 적용되지 않을 수 있다.
5. 랜딩 페이지가 URL 파라미터를 제거하면 주문까지 전달되지 않을 수 있다.

## Meta 광고관리자 어디에 넣는가

광고를 만들거나 수정할 때 광고 레벨에서 넣는다.
캠페인 레벨이나 광고세트 레벨이 아니라 실제 랜딩 URL이 들어가는 광고 화면에서 확인하는 것이 안전하다.

화면 이름은 계정 UI 언어와 버전에 따라 조금 다를 수 있다.
보통 아래 위치다.

1. Meta Ads Manager를 연다.
2. 캠페인 안에서 광고세트로 들어간다.
3. 실제 광고를 선택한다.
4. 광고 편집 화면에서 랜딩 URL 또는 Website URL을 확인한다.
5. 아래쪽 `Tracking`, `URL Parameters`, `Build a URL Parameter`, `URL 매개변수` 영역을 찾는다.
6. 그 칸에 권장 템플릿을 붙인다.
7. 게시 전 미리보기 또는 테스트 클릭으로 실제 URL에 숫자 ID가 치환되는지 확인한다.

중요:

랜딩 URL 자체에 직접 `?utm_...`를 길게 붙이는 것보다 Meta가 제공하는 `URL Parameters` 칸을 우선 사용한다.
이 칸이 광고 클릭 시 최종 URL 뒤에 파라미터를 붙여주는 역할을 한다.

## 권장 URL 파라미터 템플릿

### 기본 템플릿

신규 광고에는 이 템플릿을 기본으로 쓴다.

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&utm_id={{campaign.id}}&campaign_alias=meta_biocom_광고별칭&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}&meta_site_source={{site_source_name}}&meta_placement={{placement}}
```

각 값의 의미:

```text
utm_source=meta
이 유입이 Meta 광고에서 왔다는 뜻이다.

utm_medium=paid_social
유료 소셜 광고라는 뜻이다.

utm_campaign={{campaign.id}}
Meta 캠페인 숫자 ID를 남긴다. 캠페인 맵핑의 1순위 키다.

utm_term={{adset.id}}
Meta 광고세트 숫자 ID를 남긴다. 캠페인 ID가 빠졌을 때 parent campaign을 찾는 보조 키다.

utm_content={{ad.id}}
Meta 광고 숫자 ID를 남긴다. 어떤 소재가 주문을 만들었는지 보는 키다.

utm_id={{campaign.id}}
GA4나 외부 리포트에서 campaign id를 별도 ID 필드로 쓰기 위한 보조값이다.

campaign_alias=meta_biocom_광고별칭
사람이 읽기 쉬운 내부 별칭이다. 소재명, 인플루언서명, 상품군을 짧게 담는다.

meta_campaign_id={{campaign.id}}
내부 원장에서 campaign id를 명시적으로 읽기 위한 중복 안전장치다.

meta_adset_id={{adset.id}}
내부 원장에서 adset id를 명시적으로 읽기 위한 중복 안전장치다.

meta_ad_id={{ad.id}}
내부 원장에서 ad id를 명시적으로 읽기 위한 중복 안전장치다.

meta_site_source={{site_source_name}}
Facebook, Instagram, Messenger, Audience Network 중 어디에서 클릭됐는지 보는 값이다.

meta_placement={{placement}}
피드, 릴스, 스토리 같은 노출 위치를 보는 값이다.
```

### 사람이 읽는 이름도 꼭 필요할 때

캠페인명/광고세트명/광고명도 보고 싶으면 아래 값을 추가할 수 있다.

```text
meta_campaign_name={{campaign.name}}&meta_adset_name={{adset.name}}&meta_ad_name={{ad.name}}
```

다만 이름값은 보조용이다.
캠페인 맵핑의 정답 키로 쓰지 않는다.
이름은 길고, 중복될 수 있고, 변경될 수 있고, 한글·공백 때문에 URL에서 보기 어려울 수 있다.

## campaign_alias 이름 규칙

`campaign_alias`는 사람이 보고 이해하는 내부 별칭이다.
하지만 사람이 보기 좋다고 아무렇게나 쓰면 안 된다.
소문자 영어, 숫자, 언더스코어만 쓴다.

권장 형식:

```text
meta_biocom_{상품군}_{소재또는인플루언서}_{날짜또는버전}
```

예시:

```text
meta_biocom_igg_cellcleanerreel_202605
meta_biocom_igg_yeonddle_202605
meta_biocom_organicacid_retarget_202605
meta_biocom_supplement_melatonin_202605
```

피해야 할 예시:

```text
음식물과민증 캠페인
Meta 캠페인 1
test
인플루언서광고
meta_biocom_좋은소재
```

피해야 하는 이유:

1. 한글과 공백은 URL에서 깨지거나 보기 어렵다.
2. `test`처럼 의미 없는 이름은 나중에 누구도 해석할 수 없다.
3. 같은 별칭을 여러 캠페인에 재사용하면 매핑이 다시 꼬인다.

## 광고 등록 전 체크리스트

광고를 게시하기 전 아래를 확인한다.

1. Website URL이 실제 랜딩페이지로 연결되는가.
2. URL Parameters 칸에 권장 템플릿이 들어갔는가.
3. `campaign_alias`가 광고마다 의미 있게 작성됐는가.
4. `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`의 중괄호가 두 개씩인지 확인했는가.
5. `utm_source=meta`, `utm_medium=paid_social`이 고정돼 있는가.
6. 내부 링크나 사이트 배너에는 UTM을 붙이지 않았는가.
7. 미리보기 또는 테스트 클릭에서 URL에 실제 숫자 ID가 보이는가.

중괄호는 반드시 두 개다.

좋은 예:

```text
{{campaign.id}}
```

나쁜 예:

```text
{campaign.id}
(campaign.id)
campaign.id
```

## 게시 후 테스트 방법

광고를 게시하거나 Preview로 확인한 뒤 아래를 본다.

1. 광고 미리보기 또는 테스트 클릭을 연다.
2. 랜딩 URL 주소창에 `utm_source=meta`가 있는지 본다.
3. `utm_campaign` 값이 `{{campaign.id}}` 그대로가 아니라 숫자로 바뀌었는지 본다.
4. `utm_term` 값이 숫자로 바뀌었는지 본다.
5. `utm_content` 값이 숫자로 바뀌었는지 본다.
6. `campaign_alias`가 의도한 별칭으로 남았는지 본다.
7. 주문 테스트까지 하는 경우, 주문 원장에도 같은 값이 남는지 Codex가 read-only로 확인한다.

성공 예시:

```text
utm_source=meta
utm_medium=paid_social
utm_campaign=120213362391690396
utm_term=120213362391830396
utm_content=120244444444440396
campaign_alias=meta_biocom_igg_cellcleanerreel_202605
```

실패 예시:

```text
utm_campaign={{campaign.id}}
```

이렇게 중괄호가 그대로 남으면 Meta가 동적 값을 치환하지 않은 것이다.
이 경우 광고를 게시하거나 예산을 쓰기 전에 멈추고 URL Parameters 위치와 문법을 다시 확인한다.

## 기존 광고는 어떻게 할 것인가

기존 live 광고를 한꺼번에 수정하지 않는다.
URL Parameters 수정은 광고 재검수나 짧은 전달 중단을 만들 수 있다.
따라서 아래 순서가 안전하다.

1. 신규 광고부터 표준 템플릿을 적용한다.
2. 기존 광고를 복제해서 새 버전으로 만들 때 표준 템플릿을 적용한다.
3. 고지출 광고 중 캠페인 맵핑이 안 되는 광고만 우선 수정 후보로 뽑는다.
4. 수정 전후 24시간 성과 흔들림을 확인한다.
5. 이미 성과가 안정적인 광고는 급하게 건드리지 않는다.

권장 판단:

```text
신규 광고 표준 적용: 바로 진행 권장
기존 live 광고 일괄 수정: 보류
고지출 미매핑 광고 선별 수정: 검토 후 진행
```

## UTM 설정에서 하지 말아야 할 것

1. 내부 링크에 UTM을 붙이지 않는다.
2. `utm_source`, `utm_medium`, `utm_campaign`을 모두 같은 별칭으로 채우지 않는다.
3. `utm_campaign={{campaign.name}}`만 쓰고 숫자 ID를 남기지 않는 방식은 피한다.
4. 같은 `campaign_alias`를 여러 캠페인에 재사용하지 않는다.
5. URL Parameters 수정 후 테스트 클릭 없이 광고비를 쓰지 않는다.

특히 아래 방식은 피한다.

```text
utm_source=meta_biocom_yeonddle_igg&utm_medium=meta_biocom_yeonddle_igg&utm_campaign=meta_biocom_yeonddle_igg&utm_content=meta_biocom_yeonddle_igg
```

왜냐하면 source, medium, campaign, content가 모두 같은 값이면 나중에 어느 값이 캠페인이고 어느 값이 소재인지 알 수 없기 때문이다.

## 그로스팀에 전달할 최종 운영 규칙

아래 문장을 운영 규칙으로 고정하는 것을 권장한다.

```text
Meta 신규 광고는 URL Parameters 필드에 campaign id, adset id, ad id가 남는 표준 템플릿을 반드시 넣는다.
기존 live 광고는 일괄 수정하지 않고 신규 광고와 복제 광고부터 적용한다.
테스트 클릭에서 동적 파라미터가 실제 숫자로 치환되는지 확인한 뒤 집행한다.
```

## Codex 추천도

신규 광고부터 표준 URL Parameters 적용:

```text
추천도 92%
이유: 운영 리스크는 낮고, 앞으로 쌓이는 주문의 캠페인 맵핑 정확도를 크게 올린다.
```

기존 live 광고 전체 일괄 수정:

```text
추천도 52%
이유: 매핑에는 도움되지만 광고 재검수, 성과 흔들림, URL 오타 리스크가 있다.
```

고지출 미매핑 광고만 선별 수정:

```text
추천도 78%
이유: 영향 큰 구멍부터 줄일 수 있다. 단, 수정 전후 성과 모니터링이 필요하다.
```

## 다음 액션

1. 그로스 파트장은 신규 Meta 광고부터 권장 URL Parameters 템플릿을 적용한다.
2. 기존 live 광고는 일괄 수정하지 말고, 고지출인데 맵핑이 안 되는 광고만 후보로 뽑는다.
3. 테스트 클릭에서 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 실제 숫자로 바뀌는지 확인한다.
4. 주문 원장에 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `campaign_alias`가 남는지 Codex가 read-only로 확인한다.
5. 기존 캠페인별 매출 수동 확인은 `meta/campaign-mapping-growth-team-guide-20260504.md`를 따른다.

## 참고 링크

아래는 동적 URL 파라미터 동작과 광고 URL 파라미터 위치를 확인할 때 참고한 공개 자료다.
Meta UI는 계정과 언어에 따라 메뉴명이 달라질 수 있으므로, 실제 운영 문서에서는 `Tracking` 또는 `URL Parameters` 영역을 기준으로 안내한다.

1. Meta Marketing API Ad Creative reference: https://developers.facebook.com/docs/marketing-api/reference/ad-creative
2. Meta Ads dynamic URL parameters guide: https://www.utmmind.com/blog/meta-ads-dynamic-url-parameters-guide
3. Facebook URL dynamic parameters overview: https://www.adleaks.com/facebook-url-dynamic-parameters/
