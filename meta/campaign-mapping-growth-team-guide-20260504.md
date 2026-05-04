# Meta 기존 캠페인 맵핑 수동 확인 가이드

작성 시각: 2026-05-04 01:52 KST
마지막 업데이트: 2026-05-04 11:48 KST
문서 목적: 이미 쌓인 기존 주문과 기존 광고 alias를 어떤 Meta 캠페인에 붙일지 수동 확인 기준을 정리한다.
대상: biocom Meta 광고, 캠페인별 Attribution ROAS, `/ads/campaign-mapping`
관련 문서: `meta/campaign-alias-mapping.md`, `meta/meta-utm-setup-growth-team-guide-20260504.md`, `meta/meta-roas-gap-confirmation-runbook-20260504.md`, `data/!datacheckplan.md`
작성 템플릿: `meta/campaign-mapping-manual-check-template-20260504.xlsx`

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
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - meta/meta-utm-setup-growth-team-guide-20260504.md
    - meta/meta-roas-gap-confirmation-runbook-20260504.md
    - data/!datacheckplan.md
    - frontend/src/app/ads/campaign-mapping/page.tsx
  lane: Green
  allowed_actions:
    - 문서 작성
    - 운영팀 전달용 가이드 작성
  forbidden_actions:
    - Meta Ads Manager live 광고 수정
    - GTM publish
    - platform conversion send
    - production DB write
    - backend deploy
  source_window_freshness_confidence:
    source: "기존 campaign alias mapping 문서 + 운영 VM attribution ledger read-only + Meta URL evidence snapshot"
    window: "2026-05-04 KST 문서 작성 기준"
    freshness: "현재 문서는 기존 캠페인 수동 확인 가이드이며 live 광고 변경 없음"
    confidence: 0.88
```

## 10초 요약

캠페인 맵핑은 "이 주문 매출을 어느 Meta 캠페인 ROAS에 붙일지" 정하는 작업이다.

이 문서는 이미 쌓인 기존 주문과 기존 광고 alias를 수동으로 확인하는 문서다.
신규 광고 URL Parameters/UTM 설정 방법은 `meta/meta-utm-setup-growth-team-guide-20260504.md`를 따른다.

가장 안전한 기존 캠페인 맵핑 기준은 상품명이나 광고명 추측이 아니라, 주문 또는 광고 URL에 남은 Meta 숫자 ID다.
숫자 ID가 없으면 광고 URL evidence, Ads Manager export, 날짜/ad id 분리 근거가 있어야 한다.
상품군만 맞으면 campaign ROAS에 억지로 붙이지 않고 quarantine으로 둔다.

## 이 문서가 해결하려는 문제

현재 내부 주문 장부에는 이런 값이 남는다.

```text
meta_biocom_cellcleanerreel_igg
inpork_biocom_igg
```

하지만 Meta 광고비 장부에는 이런 값이 남는다.

```text
campaign id: 120213362391690396
adset id: 120213362391830396
ad id: 1202...
```

둘이 바로 같지 않기 때문에 캠페인별 ROAS가 틀어진다.

예를 들어 `cellcleanerreel`로 들어온 주문이 실제로는 음식물 과민증 검사 전환캠페인에서 온 것인지, 건강기능식품 캠페인에서 온 것인지, 공동구매 캠페인에서 온 것인지 사람이 다시 맞춰야 한다.
이 작업이 캠페인 맵핑이다.

## 쉬운 비유

캠페인 맵핑은 택배 송장을 붙이는 일과 같다.

주문이 들어왔다는 사실만으로는 어느 광고가 만든 매출인지 모른다.
광고 링크에 송장 번호처럼 `campaign id`, `adset id`, `ad id`를 붙여두면, 주문이 들어온 뒤에도 어느 광고에서 왔는지 다시 찾을 수 있다.

송장 번호가 없으면 사람이 상품명, 랜딩페이지, 인플루언서 이름을 보고 추측해야 한다.
추측은 틀릴 수 있고, 틀리면 ROAS가 부풀거나 빠진다.

## 캠페인 맵핑 판단 기준

### 1순위: 주문 URL에 Meta campaign id가 직접 남아 있는가

가장 강한 증거다.

아래 값 중 하나가 주문 원장이나 랜딩 URL에 있으면 이 값을 우선한다.

```text
meta_campaign_id=120213362391690396
campaign_id=120213362391690396
utm_campaign=120213362391690396
```

이 경우 사람 이름이나 광고명보다 숫자 ID를 우선한다.
캠페인 이름은 바뀔 수 있지만 숫자 ID는 안정적이다.

운영 판단:

```text
이 주문 매출은 campaign id 120213362391690396 캠페인 ROAS에 붙인다.
```

### 2순위: 주문 URL에 adset id 또는 ad id가 남아 있는가

campaign id가 직접 없어도 adset id나 ad id가 있으면 강한 증거다.
Meta에서는 광고가 광고세트에 속하고, 광고세트가 캠페인에 속한다.
따라서 adset id나 ad id를 Meta evidence와 대조하면 parent campaign을 찾을 수 있다.

예시:

```text
utm_term=120213362391830396
meta_adset_id=120213362391830396
utm_content=1202...
meta_ad_id=1202...
```

운영 판단:

```text
주문에 남은 adset id가 음식물 과민증 검사 전환캠페인 하위 광고세트로 확인된다.
따라서 이 주문은 음식물 과민증 검사 전환캠페인 ROAS에 붙인다.
```

### 3순위: 광고 URL에 사람이 만든 별칭이 있고, 그 별칭이 한 캠페인으로만 좁혀지는가

기존 광고에는 `utm_campaign=meta_biocom_yeonddle_igg`처럼 사람이 만든 별칭이 들어간 경우가 있다.
이 값은 쓸 수 있지만, 숫자 ID보다 약하다.

쓸 수 있는 조건:

1. 광고 URL에 같은 별칭이 실제로 있다.
2. 그 별칭이 한 Meta 캠페인 안에서만 쓰였다.
3. 같은 기간 주문 원장에도 같은 별칭이 남았다.

쓸 수 없는 조건:

1. 같은 별칭이 여러 캠페인에 걸쳐 있다.
2. 광고명에는 비슷한 단어가 있지만 URL 증거가 없다.
3. 상품군만 같고 광고 ID가 없다.

### 4순위: 광고명, 광고세트명, 랜딩페이지, 상품군

이건 보조 증거다.
단독으로 캠페인 ROAS에 붙이면 안 된다.

예를 들어 주문 상품이 IGG라고 해서 무조건 음식물 과민증 검사 캠페인에 붙이면 위험하다.
IGG 상품은 Meta 광고, 인플루언서, 공동구매, direct 재방문 등 여러 경로에서 팔릴 수 있다.

운영 판단:

```text
상품군은 IGG로 분류한다.
하지만 Meta campaign id가 없으므로 캠페인 ROAS에는 아직 붙이지 않는다.
```

### 5순위: 알 수 없으면 quarantine

근거가 부족하면 억지로 붙이지 않는다.
`quarantine`은 버리는 것이 아니라 "정확한 캠페인을 아직 모르는 매출"이라는 뜻이다.

운영 판단:

```text
상품군은 알지만 Meta 캠페인 근거가 없다.
이 매출은 캠페인 ROAS에 강제 배정하지 않고 quarantine으로 둔다.
```

## 기존 캠페인 수동 맵핑 목록

이 섹션은 이미 쌓인 기존 주문과 기존 광고 alias 중, 사람이 한 번 더 봐야 하는 항목을 정리한다.

여기서 alias는 광고 링크나 주문 원장에 남은 내부 추적값이다.
예를 들어 `meta_biocom_songyuul08`은 사람이 보는 캠페인명이 아니라, 송율 소재 또는 랜딩에서 온 주문을 내부적으로 구분하기 위해 남긴 값이다.

### 기준 데이터와 주의점

기준 데이터:

1. `data/meta_campaign_aliases.biocom.json`: 현재 운영 seed 파일. 18개 alias가 들어 있다.
2. `data/meta_campaign_alias_audit.biocom.json`: 2026-04-11 생성 audit 스냅샷. 주문 수와 매출은 우선순위 판단용으로만 쓴다.
3. `meta/campaign-url-evidence.biocom.json`: 2026-04-11 기준 Meta URL evidence 스냅샷. 광고 URL과 campaign id 연결을 볼 때 쓴다.
4. `meta/campaign-alias-mapping.md`: 2026-04-25 이후 확인한 최신 로컬 원장 메모. `cellcleanerreel`, `inpork`는 이 문서의 최신 수치를 우선한다.

주의점:

1. audit 스냅샷은 오래됐다. 특히 `cellcleanerreel`, `inpork`, `songyuul08`은 최신 로컬 원장과 숫자가 다르다.
2. 아래 금액은 "어떤 것부터 봐야 하는가"를 정하기 위한 참고값이다. 최종 ROAS 반영 전에는 최신 원장으로 다시 재계산해야 한다.
3. seed 파일의 `status=manual_verified`를 그대로 믿으면 안 된다. 실제로는 자동 추정, 임시 분류, 수동 확인 필요 항목이 섞여 있다.
4. 사람이 최종 확인할 때는 Meta Ads Manager에서 광고명만 보지 말고 Website URL 또는 URL Parameters에 남은 값을 확인해야 한다.

### 2026-05-04 최신 window 기준 남은 확인 후보

기준:

```text
기간: 2026-04-27~2026-05-03 KST inclusive
원천: 운영 VM attribution ledger read-only
화면/API: /api/ads/roas, ledger_source=operational_vm
현재 unmapped: 33건 / 10,879,100원
```

이제 코드는 `campaign id`, `adset id`, `ad id`가 남은 주문을 우선 자동 분류한다.
따라서 아래 후보는 "코드가 아직 못 읽는 값"이라기보다 "현재 주문 증거만으로 캠페인에 붙이면 위험한 값"이다.

`fbclid only`

```text
사람이 읽는 이름: Meta 클릭 흔적은 있으나 campaign/adset/ad id가 없는 주문
대표 랜딩: /sosohantoon01, /kangman03, /shop_view/?idx=503
현재 결정: campaign ROAS에는 강제 배정하지 않고 quarantine
이유: fbclid는 Meta 유입 가능성을 보여주지만, 어느 campaign인지까지 알려주지는 않는다.
사람이 볼 것: Ads Manager에서 해당 랜딩 URL을 쓰는 광고를 검색하고 Website URL 또는 URL Parameters의 campaign/adset/ad id를 확인한다.
결정 기준: id가 확인되면 해당 campaign에 붙인다. id가 없고 랜딩/상품군만 맞으면 계속 quarantine이다.
우선순위: 최상
```

`meta_biocom_sosohantoon01_igg`

```text
사람이 읽는 이름: 소소한툰 1번 소재 또는 랜딩에서 들어온 음식물 과민증 검사 주문
현재 자동 처리: adset id가 남은 주문은 parent campaign으로 자동 분류된다.
남은 문제: id 없이 alias만 남은 주문 묶음이 있다. read-only 후보 기준 약 12건 / 3,933,000원이다.
현재 결정: id 없는 묶음은 아직 campaign ROAS에 강제 배정하지 않는다.
사람이 볼 것: Ads Manager에서 sosohantoon01, 소소한툰, meta_biocom_sosohantoon01_igg를 검색한다.
필수 확인값: campaign id, adset id, ad id, Website URL, URL Parameters
결정 기준: URL Parameters에 같은 alias 또는 숫자 ID가 있고 한 campaign으로 좁혀지면 확정한다. 여러 campaign에서 쓰였으면 ad id 또는 날짜로 나눈다.
우선순위: 최상
현재 신뢰도: 70%. 소재/랜딩은 강하지만 id 없는 주문은 campaign attribution 근거가 부족하다.
```

`meta_biocom_kkunoping02_igg`

```text
사람이 읽는 이름: 꾸노핑 2번 소재 또는 랜딩에서 들어온 음식물 과민증 검사 주문 후보
현재 결정: campaign ROAS에 붙이지 않고 수동 확인 후보로 둔다.
확인된 한계: 현재 seed, 2026-04-11 URL evidence, live Ads API 검색에서 campaign 증거가 확인되지 않았다.
사람이 볼 것: Ads Manager에서 kkunoping02, 꾸노핑, meta_biocom_kkunoping02_igg를 검색한다.
결정 기준: URL Parameters나 Website URL에서 campaign/adset/ad id가 확인되면 확정한다. 광고명만 비슷하면 확정하지 않는다.
우선순위: 높음
현재 신뢰도: 52%. 상품군 후보는 있으나 campaign attribution 증거가 아직 없다.
```

`meta_biocom_skintts1_igg`

```text
사람이 읽는 이름: skin tts 1번 소재에서 들어온 음식물 과민증 검사 주문
현재 자동 처리: utm_term=120244759212190396처럼 adset id가 남은 주문은 campaign id 120244759209860396으로 자동 분류된다.
남은 문제: 같은 alias가 여러 campaign에 걸칠 수 있어 alias 단독으로는 확정하면 안 된다.
현재 결정: adset/ad id가 있는 주문만 campaign ROAS에 붙이고, alias만 있으면 수동 확인한다.
사람이 볼 것: Ads Manager에서 skintts1, skin tts, meta_biocom_skintts1_igg를 검색하고 campaign/adset/ad id를 확인한다.
결정 기준: 숫자 ID가 있으면 그 ID를 우선한다. alias만 있으면 campaign이 하나인지 확인한다.
우선순위: 중간
현재 신뢰도: 88% for id 있는 주문, 55% for alias-only 주문
```

`inpork_biocom_igg`

```text
사람이 읽는 이름: inpork 또는 외부 인플루언서/비Meta IGG 유입 주문
현재 결정: Meta campaign ROAS에 붙이지 않는다.
이유: 상품과 랜딩은 IGG가 맞지만, campaign/adset/ad id가 없다. meta_ prefix도 없다.
운영 액션: 상품군 매출에는 포함할 수 있지만 Meta campaign ROAS에는 강제 배정하지 않는다.
우선순위: Meta campaign mapping 대상 아님
현재 신뢰도: 88%
```

### 그대로 유지해도 되는 확정 항목

아래 항목은 2026-04-11 수동 확인에서 광고 URL에 alias가 직접 남은 것이 확인됐다.
운영자가 다시 바꾸기 전까지는 현재 매핑을 유지한다.

`meta_biocom_songyuul08`

```text
사람이 읽는 이름: 송율 소재 또는 송율 랜딩에서 들어온 음식물 과민증 검사 주문
현재 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인에 붙인다.
대상 campaign id: 120242626179290396
근거: 광고 소스 URL/웹사이트 URL에 utm_campaign=meta_biocom_songyuul08이 직접 있었다.
참고 매출: seed 기준 confirmed 29건 / 8,316,200원, 2026-04-11 audit 기준 confirmed 26건 / 6,948,200원
운영 액션: 유지. 다만 최신 ROAS 계산 전에는 최신 원장으로 confirmed 금액만 다시 뽑는다.
신뢰도: 94%
```

`meta_biocom_yeonddle_igg`

```text
사람이 읽는 이름: 연뜰살뜰 2차공구 소재에서 들어온 음식물 과민증 검사 주문
현재 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인에 붙인다.
대상 campaign id: 120242626179290396
근거: 광고 소스 URL/웹사이트 URL에 utm_campaign=meta_biocom_yeonddle_igg가 직접 있었다.
참고 매출: seed 기준 confirmed 13건 / 4,460,250원, 2026-04-11 audit 기준 confirmed 18건 / 5,939,750원
운영 액션: 유지. 최신 window 재계산 때 금액만 갱신한다.
신뢰도: 94%
```

`meta_biocom_hyunseo01_igg`

```text
사람이 읽는 이름: 현서 소재 또는 현서 랜딩에서 들어온 음식물 과민증 검사 주문
현재 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인에 붙인다.
대상 campaign id: 120242626179290396
근거: 광고 소스 URL/웹사이트 URL에 utm_campaign=meta_biocom_hyunseo01_igg가 직접 있었다.
참고 매출: confirmed 1건 / 675,000원
운영 액션: 유지.
신뢰도: 93%
```

`meta_biocom_kimteamjang_supplements`

```text
사람이 읽는 이름: 김팀장 또는 건강기능식품 계열 소재에서 들어온 주문
현재 결정: 건강기능식품 캠페인에 붙인다.
대상 campaign id: 120215102309650396
근거: Meta URL evidence에서 이 alias가 한 캠페인에만 연결됐다.
참고 매출: seed 기준 confirmed 13건 / 817,240원, 2026-04-11 audit 기준 confirmed 11건 / 756,240원
운영 액션: 유지. 고지출 캠페인이 바뀌었거나 동일 alias를 새 캠페인에 재사용했다면 그때 재확인한다.
신뢰도: 88%
```

### 수동 재확인이 필요한 항목

아래 항목은 기존 seed에 매핑값이 들어 있지만, 근거가 약하거나 여러 캠페인에 걸쳐 있다.
그로스 파트장이 Meta Ads Manager에서 직접 확인해야 한다.

`meta_biocom_proteinstory_igg`

```text
사람이 읽는 이름: 단백질스토리 소재에서 들어온 음식물 과민증 검사 주문
현재 seed 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인
현재 의심점: URL evidence에는 음식물 과민증 검사 어드밴티지+캠페인과 음식물 과민증 검사 전환캠페인 양쪽이 잡힌다.
참고 매출: 2026-04-11 audit 기준 confirmed 9건 / 2,787,750원
사람이 볼 것: Ads Manager에서 `proteinstory`, `단백질스토리`, `meta_biocom_proteinstory_igg`를 검색한다. 광고의 Website URL 또는 URL Parameters에 어떤 campaign id가 붙었는지 확인한다.
결정 기준: 한 캠페인에만 있으면 그 campaign id로 확정한다. 두 캠페인에 걸쳐 있으면 ad id 또는 날짜 기준으로 분리한다. 분리가 안 되면 캠페인 ROAS에는 넣지 않고 quarantine으로 둔다.
재확인 우선순위: 높음
현재 seed 신뢰도: 55%
```

`meta_biocom_iggspring`

```text
사람이 읽는 이름: 봄 또는 spring 소재에서 들어온 음식물 과민증 검사 주문
현재 seed 결정: 음식물 과민증 검사 전환캠페인
대상 campaign id: 120213362391690396
현재 의심점: 동일 alias가 음식물 과민증 검사 어드밴티지+캠페인과 전환캠페인 양쪽에서 발견된다. 현재 seed는 spend+active 기준 자동 추정이다.
참고 매출: 2026-04-11 audit 기준 confirmed 7건 / 2,206,200원
사람이 볼 것: Ads Manager에서 `iggspring`, `spring`, `봄`, `봄맞이`를 검색한다.
결정 기준: 실제 집행 캠페인이 한쪽이면 그쪽으로 확정한다. 양쪽에서 실제 집행됐으면 날짜 또는 ad id로 나눠야 한다.
재확인 우선순위: 높음
현재 seed 신뢰도: 65%
```

`meta_biocom_iggacidset_2026`

```text
사람이 읽는 이름: 음식물 과민증 검사와 유기산 또는 대사기능검사 세트 소재 주문
현재 seed 결정: 종합대사기능검사 전환캠페인
대상 campaign id: 120237452088280396
현재 의심점: URL evidence에 음식물 과민증 검사 어드밴티지+캠페인과 종합대사기능검사 캠페인이 같이 나온다.
참고 매출: 2026-04-11 audit 기준 confirmed 4건 / 1,658,600원
사람이 볼 것: Ads Manager에서 `iggacidset`, `acidset`, `유기산`, `종합대사`, `세트`를 검색한다.
결정 기준: 세트 상품 광고가 실제 어느 캠페인 예산에서 집행됐는지 확인한다. 세트 캠페인이 별도로 있으면 그쪽에 붙이고, IGG 캠페인에서 집행한 세트 소재라면 IGG 캠페인으로 붙인다.
재확인 우선순위: 높음
현재 seed 신뢰도: 60%
```

`meta_biocom_cellcleanerreel_igg`

```text
사람이 읽는 이름: cellcleanerreel 소재에서 들어온 음식물 과민증 검사 주문
현재 결정: 음식물 과민증 검사 전환캠페인으로 임시 분류
대상 campaign id: 120213362391690396
근거: 최신 로컬 원장 confirmed 주문 4건 모두 utm_term=120213362391830396가 남았고, 이 adset은 음식물 과민증 검사 전환캠페인 하위로 확인됐다.
참고 매출: 최신 로컬 메모 기준 confirmed 4건 / 1,060,200원
사람이 볼 것: Ads Manager에서 `cellcleanerreel`, `cellcleaner`, `reel`을 검색하고, 해당 광고의 campaign/adset 관계를 확인한다.
결정 기준: 현재 adset parent가 맞으면 임시를 최종 확정으로 바꾼다.
재확인 우선순위: 높음
현재 분류 신뢰도: 93%
```

`meta_biocom_mingzzinginstatoon_igg`

```text
사람이 읽는 이름: 밍찡 또는 인스타툰 소재에서 들어온 음식물 과민증 검사 주문
현재 seed 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인
현재 의심점: link URL 직접 증거가 부족하고, 기존 메모에서도 adset/ad name 수동 확인 필요로 남아 있다.
참고 매출: 2026-04-11 audit 기준 confirmed 4건 / 980,000원
사람이 볼 것: Ads Manager에서 `mingzzing`, `밍찡`, `인스타툰`, `meta_biocom_mingzzinginstatoon_igg`를 검색한다.
결정 기준: URL Parameters에 alias가 직접 있거나 같은 광고세트 안 소재로 확인되면 공동구매 캠페인에 유지한다. 없으면 quarantine으로 둔다.
재확인 우선순위: 중간 이상
현재 seed 신뢰도: 62%
```

`meta_biocom_iggpost_igg`

```text
사람이 읽는 이름: IGG post 또는 인플루언서 게시글 계열 주문
현재 seed 결정: 공동구매 인플루언서 파트너 광고 모음_3 캠페인
현재 의심점: 이름상 인플루언서 공동구매 계열 후보지만, 직접 URL evidence가 약하다.
참고 매출: 2026-04-11 audit 기준 total 3건 / 490,000원, confirmed 1건 / 245,000원
사람이 볼 것: Ads Manager에서 `iggpost`, `post`, 게시글형 소재명을 검색한다.
결정 기준: Meta 광고 URL 증거가 있으면 캠페인에 붙이고, 게시글/외부 링크 유입이면 non-meta 또는 quarantine으로 분리한다.
재확인 우선순위: 중간
현재 seed 신뢰도: 58%
```

### Meta 캠페인 ROAS에 붙이면 안 되는 항목

`inpork_biocom_igg`

```text
사람이 읽는 이름: inpork 또는 외부 인플루언서/비Meta IGG 유입 주문
현재 결정: Meta 캠페인 ROAS에 붙이지 않는다.
분류 위치: non_meta_influencer_igg 또는 quarantine
근거: 상품과 랜딩은 IGG가 맞지만, campaign id/adset id가 없다. `meta_` prefix도 없고 현재 seed 후보도 없다.
참고 매출: 최신 로컬 메모 기준 confirmed 7건 / 1,969,500원
운영 액션: 상품군 매출에는 포함할 수 있지만 Meta 캠페인 ROAS에는 강제 배정하지 않는다.
신뢰도: 88%
```

이 항목은 "수동 맵핑해서 Meta 캠페인에 붙일 항목"이 아니다.
정확한 처리는 "Meta 광고가 아닌 IGG 유입으로 분리한다"이다.

### 낮은 우선순위로 관찰할 항목

아래 항목은 현재 seed를 유지하되, 최신 audit을 다시 만들 때 함께 재검토한다.
대부분 한 캠페인 URL에만 연결됐거나 매출 규모가 작아, 위 항목보다 우선순위가 낮다.

`meta_biocom_sikdanstory_igg`

```text
현재 결정: 음식물 과민증 검사 어드밴티지+캠페인
대상 campaign id: 120235591897270396
참고 매출: 2026-04-11 audit 기준 confirmed 2건 / 995,000원
현재 신뢰도: 86%
```

`meta_biocom_igevsiggblog_igg`

```text
현재 결정: 음식물 과민증 검사 전환캠페인
대상 campaign id: 120213362391690396
참고 매출: 2026-04-11 audit 기준 confirmed 4건 / 995,000원
주의: 두 캠페인에 alias가 보이므로 최신 재생성 때 자동 추정을 다시 확인한다.
현재 신뢰도: 72%
```

`meta_biocom_iggunboxing_igg`

```text
현재 결정: 음식물 과민증 검사 어드밴티지+캠페인
대상 campaign id: 120235591897270396
참고 매출: 2026-04-11 audit 기준 confirmed 3건 / 974,500원
주의: 두 캠페인에 alias가 보이므로 최신 재생성 때 자동 추정을 다시 확인한다.
현재 신뢰도: 72%
```

`meta_biocom_skincare_igg`

```text
현재 결정: 음식물 과민증 검사 어드밴티지+캠페인
대상 campaign id: 120235591897270396
참고 매출: 2026-04-11 audit 기준 confirmed 5건 / 1,129,000원
주의: 두 캠페인에 alias가 보이므로 최신 재생성 때 자동 추정을 다시 확인한다.
현재 신뢰도: 70%
```

`meta_biocom_allhormon_miraclemorningstory`

```text
현재 결정: 호르몬 검사 바이럴 소재 캠페인
대상 campaign id: 120231749833120396
참고 매출: 2026-04-11 audit 기준 confirmed 2건 / 870,200원
현재 신뢰도: 86%
```

`meta_biocom_channelA_acid`

```text
현재 결정: 종합대사기능검사 전환캠페인
대상 campaign id: 120237452088280396
참고 매출: 2026-04-11 audit 기준 confirmed 1건 / 283,000원
현재 신뢰도: 86%
```

`meta_biocom_happynewyear_igg`

```text
현재 결정: 음식물 과민증 검사 전환캠페인
대상 campaign id: 120213362391690396
참고 매출: 2026-04-11 audit 기준 confirmed 1건 / 484,500원
주의: 두 캠페인에 alias가 보이므로 최신 재생성 때 자동 추정을 다시 확인한다.
현재 신뢰도: 68%
```

`meta_master_slow`

```text
현재 결정: 건강기능식품 캠페인
대상 campaign id: 120215102309650396
참고 매출: 2026-04-11 audit 기준 confirmed 1건 / 35,000원
현재 신뢰도: 84%
```

### 그로스 파트장이 수동 확인할 때 남겨야 하는 기록

공식 작성 파일은 `meta/campaign-mapping-manual-check-template-20260504.xlsx`다.
수동 확인을 끝냈으면 아래 필수 항목만 남긴다.
운영자가 부담 없이 남기는 것이 우선이다.

```text
확인한 alias:
최종 결정:
대상 campaign id:
근거 한 줄:
결정자:
확인 시각:
```

필수 항목 설명:

1. `확인한 alias`: 예를 들어 `meta_biocom_sosohantoon01_igg`.
2. `최종 결정`: 아래 4개 중 하나로 쓴다.
3. `대상 campaign id`: 확정 또는 분리일 때만 적는다. 제외/보류면 비워도 된다.
4. `근거 한 줄`: 예를 들어 "Ads Manager URL Parameters에 `utm_term=120242626179270396` 확인".
5. `결정자`, `확인 시각`: 나중에 누가 언제 판단했는지 알기 위한 최소 기록이다.

최종 결정은 아래 4개 중 하나로 쓴다.

```text
확정: 이 campaign id에 붙인다.
분리: 날짜 또는 ad id 기준으로 여러 campaign id에 나눠 붙인다.
제외: Meta 캠페인 ROAS에 붙이지 않는다.
보류: 근거 부족으로 quarantine에 둔다.
```

필요한 경우에만 추가로 남길 선택 항목:

```text
확인한 adset id:
확인한 ad id:
확인한 Website URL 또는 URL Parameters:
적용 시작일:
적용 종료일:
신뢰도:
```

## 캠페인 맵핑에서 하지 말아야 할 것

1. 상품군만 보고 Meta 캠페인에 붙이지 않는다.
2. 광고명에 비슷한 단어가 있다는 이유만으로 확정하지 않는다.
3. `fbclid`만 있다는 이유로 특정 campaign id에 붙이지 않는다.
4. 같은 alias가 여러 캠페인에 걸쳐 있으면 날짜, adset id, ad id로 분리하기 전까지 확정하지 않는다.
5. Meta Ads Manager의 기본 ROAS와 내부 confirmed ROAS를 같은 숫자로 맞추려고 하지 않는다.
6. 수동 확인 기록 없이 seed만 조용히 바꾸지 않는다.
7. Ads Manager export에서 URL Parameters가 비어 있으면 광고명만으로 확정하지 않는다.

## 운영자가 결론을 내리는 방법

캠페인 맵핑 판단은 아래 순서로 한다.

1. 주문에 `meta_campaign_id` 또는 숫자형 `utm_campaign`이 있으면 해당 campaign id로 확정한다.
2. campaign id가 없고 adset id가 있으면 Meta evidence에서 parent campaign을 찾아 확정한다.
3. 숫자 ID가 없고 alias만 있으면, 그 alias가 한 캠페인에만 연결되는지 확인한다.
4. 상품군만 맞으면 product-family로만 분류하고 캠페인 ROAS에는 붙이지 않는다.
5. 근거가 부족하면 quarantine으로 둔다.

이 기준을 쓰면 실수 유형이 줄어든다.

좋은 판단:

```text
이 주문은 adset id가 음식물 과민증 검사 전환캠페인 하위로 확인되므로 해당 캠페인에 붙입니다.
```

나쁜 판단:

```text
IGG 상품을 샀으니 음식물 과민증 캠페인에 붙입니다.
```

## 그로스팀에 전달할 최종 운영 규칙

아래 문장을 운영 규칙으로 고정하는 것을 권장한다.

```text
캠페인별 ROAS는 상품명 추정이 아니라 주문에 남은 Meta 숫자 ID를 기준으로 맵핑한다.
숫자 ID가 없는 기존 광고 매출은 무리하게 붙이지 않고, URL evidence 또는 사람 검토가 끝난 것만 반영한다.
신규 광고 UTM 설정은 별도 문서 meta/meta-utm-setup-growth-team-guide-20260504.md를 따른다.
```

## Codex 추천도

기존 매출을 숫자 ID 기준으로만 campaign ROAS에 반영:

```text
추천도 94%
이유: false positive를 막는 가장 안전한 기준이다. 매핑 누락은 나중에 보정할 수 있지만, 잘못 붙인 매출은 캠페인 판단을 오염시킨다.
```

id 없는 `fbclid only` 매출을 landing/product 추정으로 campaign에 강제 배정:

```text
추천도 18%
이유: Meta 유입 가능성은 있지만 어느 campaign인지 모른다. 캠페인별 ROAS에는 넣지 말고 quarantine으로 둔다.
```

Ads Manager export로 `sosohantoon01`, `kkunoping02`, `skintts1`, `kangman03`, `idx=503` 확인:

```text
추천도 91%
이유: 현재 남은 unmapped 중 큰 금액은 코드보다 evidence 부족이 원인이다. campaign/adset/ad id가 확인되면 바로 dry-run 재계산할 수 있다.
```

## 다음 액션

1. 그로스 파트장은 Ads Manager에서 `sosohantoon01`, `kkunoping02`, `skintts1`, `kangman03`, `idx=503`을 검색한다.
2. export 컬럼은 `campaign id`, `campaign name`, `adset id`, `adset name`, `ad id`, `ad name`, `Website URL`, `URL Parameters`, `spend`, `purchase`, `purchase conversion value`로 잡는다.
3. Codex는 export를 받으면 campaign/adset/ad id 기준으로 seed 반영 dry-run을 실행한다.
4. export에서도 id가 없으면 해당 매출은 product-family 분석에는 남기되 campaign ROAS에는 계속 quarantine으로 둔다.
5. 신규 광고 URL Parameters/UTM 설정은 `meta/meta-utm-setup-growth-team-guide-20260504.md`에서 관리한다.
