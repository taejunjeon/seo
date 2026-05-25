작성 시각: 2026-05-25 10:08 KST
최근 업데이트: 2026-05-25 23:12 KST
기준일: 2026-05-25
문서 성격: 그로스팀 전달용 Meta 광고 URL/UTM 점검 요청서

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - project/meta-unmapped-deep-trace-readonly-20260525.md
  lane: Green
  allowed_actions:
    - documentation
    - growth_team_request_draft
  forbidden_actions:
    - meta_ads_mutation
    - vm_cloud_deploy_or_restart
    - platform_send
    - operating_db_write
  source_window_freshness_confidence:
    source: VM Cloud payment_success read-only + GA4 BigQuery read-only + Meta Ads API read-only inventory
    window: 2026-05-18~2026-05-24 KST
    site: biocom
    confidence: high for request purpose, medium_high for Meta URL inventory because one retry hit rate limit
```

## 10초 요약

그로스팀에 요청할 핵심은 "지금 광고를 바로 다 수정해달라"가 아니다.

UTM 관리 엑셀에는 랜딩 URL과 UTM 생성 URL이 이미 있다. 이 파일은 캠페인 alias와 랜딩 후보를 찾는 데 도움이 된다.

다만 지금 추가로 필요한 것은 "UTM 관리표에 적힌 URL"이 아니라 "현재 Meta Ads Manager에서 실제 집행 중인 광고 소재별 최종 클릭 URL"이다. 이유는 결제완료 시점에는 UTM이 사라져서, 고객이 어떤 캠페인·광고세트·광고소재에서 들어왔는지 내부 원장에서 복구하지 못하는 주문이 생기고 있기 때문이다.

가능하면 앞으로 Meta 클릭 URL에 숫자 campaign ID, adset ID, ad ID가 남도록 설정해야 한다. 숫자 ID가 어렵다면 최소한 고유한 `campaign_alias`와 landing path가 주문 직전까지 보존되도록 해야 한다.

## "매크로가 남았다"를 쉬운 말로 바꾸면

앞으로 그로스팀에는 `macro가 남았다`라고 쓰지 않는다. 아래처럼 설명한다.

> Meta가 숫자 광고 ID로 자동 변환해야 하는 URL 매개변수가, 일부 실제 주문 기록에서는 숫자로 바뀌지 않고 템플릿 문구 그대로 저장됐습니다.

예를 들어 광고 설정에는 아래처럼 들어갈 수 있다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

이 값은 사람이 직접 캠페인 ID를 넣는 것이 아니라, Meta가 실제 광고 클릭 순간에 숫자로 바꿔주는 자리표시자다.

정상이라면 고객 클릭 후 내부 원장에는 아래처럼 숫자가 남아야 한다.

```text
utm_campaign=120245003319500396
utm_term=120245700952890396
utm_content=120245701139440396
```

문제 상황은 숫자로 바뀌지 않고 아래 문구 그대로 저장되는 것이다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

이 경우 Meta 유료 광고에서 들어온 정황은 남지만, 어느 campaign/adset/ad 매출인지 확정할 숫자 키가 없다. 그래서 내부 원장에서는 D급 수동확인 대상으로 둔다.

## 그로스팀에 전달할 메시지 초안

안녕하세요. 바이오컴 Meta 광고 유입 정합성 확인 때문에 현재 운용 중인 광고 소재의 랜딩 URL과 UTM 설정 확인을 요청드립니다.

현재 공유받은 UTM 관리 엑셀에는 랜딩 URL과 UTM 생성 URL이 기재되어 있어 내부 매칭 후보 사전으로 활용하고 있습니다. 다만 이 파일만으로는 "현재 Meta 광고 관리자에서 실제 ACTIVE 상태로 집행 중인 각 광고 소재에 어떤 URL이 들어가 있는지"와 "실제 클릭 시 Meta 자동 치환 템플릿 문구가 숫자 ID로 바뀌는지"를 확정하기 어렵습니다.

현재 내부 결제완료 원장에서는 Meta 클릭 흔적은 남아 있는데, 어느 캠페인·광고세트·광고소재에서 발생한 주문인지 확정하지 못하는 건들이 있습니다.

쉽게 말하면 고객이 Meta 광고를 클릭한 흔적은 보이지만, 결제 시점에는 URL이 결제 페이지로 바뀌면서 처음 들어왔던 광고 URL 정보가 사라져 있습니다. 그래서 내부 ROAS를 캠페인별로 계산할 때 일부 주문이 `(unmapped)`로 빠지고 있습니다.

이번 요청은 광고를 즉시 수정해달라는 요청이 아닙니다. UTM 관리표와 실제 광고 관리자 설정이 같은지 먼저 확인하고, 이후 어떤 방식으로 수정하는 것이 안전한지 판단하려는 요청입니다.

## 현재 UTM 관리 엑셀로 이미 확인된 것

`[바이오컴] UTM 관리.xlsx`와 CSV 변환본을 확인했습니다.

- 전체 2,355행 중 랜딩페이지 URL이 있는 행: 2,217행
- UTM이 붙은 생성 URL이 있는 행: 2,351행
- Meta 관련 행: 넓게 보면 920행
- `utm_source`가 Meta 계열인 행: 902행
- Meta 계열 중 유효한 랜딩 URL이 있는 행: 894행
- Meta 계열 중 유효한 UTM 생성 URL이 있는 행: 894행
- Meta 계열 중 `meta_` alias 형태가 있는 행: 831행
- Meta 계열 중 `{{campaign.id}}` 같은 Meta 자동 치환 템플릿 문구가 적힌 행: 0행
- Meta 계열 중 `120...` 형태의 숫자 campaign/adset/ad ID가 들어간 행: 0행

따라서 UTM 엑셀은 "이 alias가 어떤 랜딩/캠페인 후보인지"를 보는 데는 도움이 됩니다. 특히 B급 후보 사전으로는 의미가 큽니다.

하지만 아래 정보는 UTM 엑셀만으로 확정할 수 없습니다.

1. 해당 UTM이 현재 Meta 광고 관리자에서 ACTIVE 광고에 실제로 들어가 있는지
2. 같은 alias가 현재 어떤 campaign/adset/ad에 연결되어 있는지
3. 광고 소재별 최종 클릭 URL이 UTM 엑셀의 생성 URL과 완전히 같은지
4. `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 실제 클릭 시 숫자로 치환되는지
5. 특정 주문이 어떤 ad ID에서 발생했는지

이번에 그로스팀에 요청하는 것은 이미 받은 UTM 엑셀을 다시 달라는 뜻이 아닙니다. UTM 관리표와 Meta 광고 관리자 실제 설정을 맞춰보기 위한 확인입니다.

## 왜 숫자 ID UTM이 필요한가

Meta 광고에는 캠페인명, 광고세트명, 광고명이 있습니다. 그런데 이 이름들은 사람이 보기에는 편하지만, 데이터 매칭 기준으로는 약합니다.

이유는 아래와 같습니다.

1. 이름은 나중에 바뀔 수 있습니다.
2. 비슷한 이름이나 복제 캠페인이 생길 수 있습니다.
3. 같은 랜딩 페이지를 여러 광고가 함께 쓸 수 있습니다.
4. `fbclid`는 Meta 클릭 흔적일 뿐, 캠페인 ID는 알려주지 않습니다.
5. `utm_campaign={{campaign.id}}`처럼 Meta가 숫자로 바꿔줘야 하는 템플릿 문구가 그대로 들어오면, 내부 시스템은 이 값을 캠페인 ID로 해석할 수 없습니다.

반대로 숫자 ID는 광고 계정 안에서 고유합니다.

- campaign ID: 어떤 캠페인인지 확정
- adset ID: 어떤 광고세트인지 확정
- ad ID: 어떤 광고소재인지 확정

그래서 숫자 ID가 들어오면 내부 매출 매칭 등급을 A급으로 볼 수 있습니다.

## 현재 확인된 문제

2026-05-18~2026-05-24 기준으로 Meta 미매칭 주문을 다시 봤습니다.

- 남은 미매칭: 14건, 5,038,200원
- 이 중 13건은 UTM/랜딩 경로가 없고 `fbclid` 같은 Meta 클릭 흔적만 남아 있습니다.
- 1건은 `utm_campaign={{campaign.id}}`, `utm_term={{adset.id}}`, `utm_content={{ad.id}}`가 숫자로 바뀌지 않고 그대로 들어왔습니다.
- 현재 운용 광고 URL inventory에서는 alias와 landing path 단서는 있지만, 숫자 campaign/adset/ad ID가 URL에 들어간 ACTIVE 광고는 확인되지 않았습니다.

이 상태에서는 내부에서 "Meta 광고로 들어온 주문일 가능성"은 볼 수 있어도, "어느 캠페인/세트/소재의 매출인지"는 확정하기 어렵습니다.

## TJ님 직접 확인 샘플 — 2026-05-25

TJ님이 Ads Manager에서 `meta_biocom_influencer_260506` 아래 `iiari` 광고세트/광고 샘플을 확인했다.

확인된 값은 아래와 같다.

```text
웹사이트 URL: https://biocom.kr/iiary02
소스 URL: https://biocom.kr/iiary02

URL 매개변수:
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

이 샘플로 확인된 것은 세 가지다.

1. 현재 광고 설정에는 숫자 ID를 받기 위한 Meta 자동 치환 템플릿 문구가 들어가 있다.
2. 웹사이트 URL 자체는 `/iiary02`이고, UTM은 Meta의 URL 매개변수 칸에서 붙는 구조다.
3. `campaign_alias=meta_biocom_광고별칭`은 실제 고유 별칭이 아니라 공용 자리표시 문구다. 따라서 이 값은 B급 매칭 키로 쓰면 안 된다.

아직 남은 확인은 하나다.

실제 광고 미리보기/테스트 클릭 후 주소창 URL에서 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 숫자로 바뀌는지 확인해야 한다.

성공 예시는 아래와 같다.

```text
utm_campaign=120245003319500396
utm_term=120245700952890396
utm_content=120xxxxxxxxxxxxx
meta_campaign_id=120245003319500396
meta_adset_id=120245700952890396
meta_ad_id=120xxxxxxxxxxxxx
```

실패 예시는 아래와 같다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

숫자로 치환되면 앞으로 들어오는 `/iiary02` 광고 클릭은 A급 매칭 재료가 된다. 다만 결제완료 시점에 이 값이 사라지면 여전히 주문 원장에는 남지 않으므로, 결제 전 유료 유입 저장 장치가 필요하다.

## 광고 공유 미리보기 링크 확인 — 2026-05-25 22:17 KST

TJ님이 `meta_biocom_iiari_260518` 샘플에서 광고 공유 링크를 열어 확인했다.

확인 결과, 공유 링크는 실제 고객 랜딩 URL로 바로 이동하지 않았다. Facebook 로그인 계정 기준으로 `business.facebook.com/ads/experience/confirmation/` 확인 화면이 열렸고, 화면에는 `거부`와 `광고 표시` 버튼이 보였다.

이 화면에서 확인된 핵심은 아래와 같다.

1. 공유 링크는 "이 광고 미리보기를 내 계정에서 볼 수 있게 할지"를 묻는 확인 화면이다.
2. `광고 표시`는 실제 고객 클릭을 발생시키는 버튼이 아니라, 선택한 노출 위치에서 광고 미리보기를 보여달라고 요청하는 버튼이다.
3. 이 경로만으로는 `https://biocom.kr/iiary02?...` 형태의 최종 랜딩 URL을 확인할 수 없다.
4. 따라서 이 공유 링크만으로는 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 숫자로 치환되는지 확정할 수 없다.
5. `크리에이티브 테스트`나 `테스트 설정` 버튼도 이번 질문의 최단 경로는 아니다. 이번에 필요한 것은 크리에이티브 성과 테스트가 아니라 "클릭 후 최종 URL에 어떤 파라미터가 남는지" 확인하는 것이다.

이 방식으로 더 확인하려면 순서는 아래가 맞다.

1. TJ님 계정에서 `광고 표시`를 눌러 미리보기가 실제 피드/선택 노출 위치에 뜨는지 본다.
2. 피드 안의 광고 카드에서 `자세히 보기` CTA가 실제로 클릭되는지 확인한다.
3. 클릭이 되면 주소창의 최종 URL을 복사한다.
4. CTA가 계속 클릭되지 않거나 미리보기 화면 안에서만 머무르면, 이 방법은 중단한다.

이 확인에서 성공으로 보는 기준은 단순하다. 주소창 또는 복사한 링크에 아래처럼 숫자 ID가 보여야 한다.

```text
utm_campaign=120...
utm_term=120...
utm_content=120...
meta_campaign_id=120...
meta_adset_id=120...
meta_ad_id=120...
```

반대로 아래처럼 숫자로 바뀌지 않은 템플릿 문구가 그대로 보이면 실패다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

현재까지는 "광고 설정에는 Meta 자동 치환 템플릿 문구가 들어가 있다"까지만 확인됐고, "실제 클릭 URL에서 숫자로 바뀐다"는 아직 확인되지 않았다.

## 검토 화면 웹사이트 URL 복사 결과 — 2026-05-25 22:24 KST

TJ님이 Ads Manager의 `검토` 화면에서 `웹사이트 URL` 링크 주소를 복사했다.

복사된 링크는 Facebook 외부 이동 경유 링크였다. 이 링크를 클릭하지 않고 내부 목적지만 해석한 결과는 아래와 같다.

```text
경유 도메인: l.facebook.com
실제 목적지: https://biocom.kr/iiary02
목적지 파라미터: fbclid
UTM 파라미터: 없음
Meta 숫자 ID 파라미터: 없음
```

이 정보로 판단할 수 있는 것은 아래와 같다.

1. `검토` 화면의 `웹사이트 URL` 링크 자체에는 UTM이 붙어 있지 않다.
2. 이 링크에는 `utm_campaign`, `utm_term`, `utm_content`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`가 없다.
3. 따라서 이 링크만으로는 캠페인·광고세트·광고소재를 A급으로 매칭할 수 없다.
4. 이 링크를 그대로 클릭해도 새 UTM이 생기지는 않는다. 이미 경유 링크 안의 실제 목적지가 `/iiary02?fbclid=...`로 정해져 있기 때문이다.
5. 다만 이 화면이 "광고 설정의 웹사이트 URL"만 보여주고, URL 매개변수 칸은 별도로 합성하지 않는 구조일 가능성은 남아 있다.

따라서 현재 판정은 "검토 화면에서 복사한 웹사이트 URL 기준으로는 UTM 없음"이다.

아직 확정되지 않은 것은 "실제 광고 노출에서 고객이 CTA를 클릭할 때도 UTM이 빠지는지"이다. 이 부분은 실제 CTA 클릭 최종 URL이나 Ads Manager export의 URL parameter 컬럼으로 확인해야 한다.

## `/iiary02` VM Cloud 원장 확인 — 2026-05-25 22:34 KST

TJ님 요청에 따라 VM Cloud SQLite를 read-only로 직접 확인했다.

source는 VM Cloud `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`이며, 조회는 `site_landing_ledger`와 `attribution_ledger`만 읽었다. 외부 전송, DB write, 광고 설정 변경은 하지 않았다.

결론부터 말하면 `/iiary02` 유입은 UTM이 "전혀 없는 상태"가 아니다. 오히려 체크아웃/결제 원장에는 숫자 campaign ID가 대부분 들어와 있다.

다만 `site_landing_ledger`에는 `/iiary02` row가 0건이었다. `/iiary02` 단서는 `attribution_ledger`의 `metadata_json` 안에 남아 있었다. 즉 첫 랜딩 원장에서는 못 보지만, 체크아웃/결제 단계 원장에서는 복구 가능한 상태다.

### 원장별 확인 결과

```text
site_landing_ledger /iiary02 row: 0

attribution_ledger /iiary02 관련 row: 151
- 기간: 2026-05-18 01:46:09 UTC ~ 2026-05-25 12:22:13 UTC
- UTM 컬럼이 있는 row: 151
- 숫자 120... campaign/adset/ad ID가 있는 row: 135
- `{{campaign.id}}` 템플릿 문구가 그대로 남은 row: 16
- fbclid evidence가 있는 row: 125
- touchpoint: checkout_started 97, payment_success confirmed 54
```

### `/iiary02` campaign rollup

```text
utm_campaign=120245003319500396
- 전체 row: 117
- checkout_started: 74
- payment_success confirmed: 43
- confirmed revenue: ₩15,005,770
- top utm_term: 120245700952890396 91건, 120245956430970396 26건
- top utm_content: 120245701139440396 91건, 120245956430950396 26건

utm_campaign=120242626179290396
- 전체 row: 17
- checkout_started: 12
- payment_success confirmed: 5
- confirmed revenue: ₩2,737,050
- top utm_term: 120242626179270396 17건
- top utm_content: 120245955028820396 17건

utm_campaign={{campaign.id}}
- 전체 row: 16
- checkout_started: 10
- payment_success confirmed: 6
- confirmed revenue: ₩1,894,000
- top utm_term: {{adset.id}} 16건
- top utm_content: {{ad.id}} 16건

utm_campaign=meta_biocom_iggacidset_2026
- 전체 row: 1
- checkout_started: 1
- payment_success confirmed: 0
- confirmed revenue: ₩0
```

### 해석

1. `/iiary02`는 이미 대부분 숫자 ID UTM으로 들어오고 있다.
2. `utm_campaign=120245003319500396`은 `meta_biocom_influencer_260506` 캠페인으로 볼 수 있으므로, 해당 43건 결제완료 매출은 캠페인 기준 A급 매칭이 가능하다.
3. `utm_term`과 `utm_content`도 숫자로 들어와 있어, 이 135개 row는 광고세트/광고소재 수준까지 매칭 가능성이 높다.
4. 다만 16개 row는 아직 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 숫자로 바뀌지 않은 템플릿 문구 그대로 남아 있다. 이 건들은 D급 또는 수동확인 대상으로 둬야 한다.
5. `site_landing_ledger`에 `/iiary02`가 0건인 것은 별도 이슈다. 첫 랜딩 수집점이 `/iiary02`를 직접 저장하지 못했거나, 해당 값이 checkout/payment metadata로만 전달되는 구조일 수 있다. 이 원인 확인은 다음 sprint에서 분리한다.

숫자로 바뀌지 않은 템플릿 문구가 그대로 남은 16개 row의 confirmed 결제완료는 6건, ₩1,894,000이다. 날짜별로는 2026-05-18 1건/₩459,000, 2026-05-20 2건/₩468,000, 2026-05-21 2건/₩482,000, 2026-05-24 1건/₩485,000이다.

따라서 `/iiary02`는 "UTM이 안 달린 광고"로 볼 사안이 아니다. 현재 문제는 "검토 화면 웹사이트 URL에는 UTM이 안 보이지만, 실제 원장에는 숫자 UTM이 상당수 들어오고 있고, 일부는 숫자로 바뀌지 않은 템플릿 문구 그대로 남아 있다"로 정리하는 것이 맞다.

추가로 2026-05-25 23:22 KST에 VM 원본 랜딩 read-only bridge 기준으로 다시 집계했다. 위의 151건은 `metadata_json` 텍스트 안에 `/iiary02`가 보이는 넓은 관련 row 기준이고, bridge가 직접 원본 랜딩 URL로 쓰는 `metadata_json.imweb_landing_url=/iiary02` 기준은 148건이다. 차이 3건은 `/iiary02` 단서는 있지만 실제로 파싱 가능한 `imweb_landing_url` 값이 없어 원본 랜딩 URL bridge 직접 재료에서는 제외했다. 이 기준에서는 숫자 ID row가 132건, 템플릿 문구 잔존 row가 16건, 결제완료는 동일하게 54건/₩19,636,820이다.

## `/iiary02` 템플릿 문구 잔존 16개 row 추가 조사 — 2026-05-25 22:57 KST

남은 `{{campaign.id}}` 템플릿 문구 잔존 16개 row를 더 좁혀봤다.

결론은 "VM Cloud 원장만으로는 광고 1개까지 자동 확정할 수 없고, 후보 광고 묶음까지만 좁힐 수 있다"이다.

### 원장 안에서 확인된 것

숫자로 바뀌지 않은 템플릿 문구가 남은 16개 row는 모두 아래 조건을 만족했다.

```text
source: biocom_imweb
capture_mode: live
utm_source: meta
utm_medium: paid_social
utm_campaign: {{campaign.id}}
utm_term: {{adset.id}}
utm_content: {{ad.id}}
ga_session_id: 16/16 존재
same-session prior numeric UTM 후보: 0
confirmed payment_success: 6건 / ₩1,894,000
```

이 말은 같은 세션 안에 더 앞선 숫자 campaign/adset/ad ID row가 없다는 뜻이다. 따라서 내부 원장만으로 `{{campaign.id}}`를 숫자 campaign ID로 자동 치환할 근거는 없다.

### `/iiary02` 원본 URL 안의 값

16개 row 모두 `metadata_json.imweb_landing_url` 안에 `/iiary02`가 있었다.

하지만 이 URL 안의 값도 아래처럼 숫자로 바뀌지 않은 템플릿 문구 상태였다.

```text
campaign_alias: meta_biocom_광고별칭
meta_campaign_id: {{campaign.id}}
meta_adset_id: {{adset.id}}
meta_ad_id: {{ad.id}}
meta_site_source: {{site_source_name}}
meta_placement: {{placement}}
```

즉 숨겨진 숫자 ID가 metadata 안에 따로 있는 상태가 아니다. `campaign_alias`도 고유 별칭이 아니라 공용 자리표시 문구라서 B급 매칭 키로 쓰면 안 된다.

### 결제완료 row에 템플릿 문구가 남았다는 뜻

정확히는 16개 row 전체에 숫자로 바뀌지 않은 템플릿 문구가 남아 있고, 그중 6개가 실제 결제완료 row다.

`결제완료 row에 템플릿 문구가 남았다`는 말은 결제는 정상 완료됐고 매출도 원장에 잡혔지만, 그 결제 매출을 어느 Meta campaign/adset/ad에 붙일 숫자 ID가 남지 않았다는 뜻이다.

따라서 이 6건, ₩1,894,000은 "Meta 유료 유입 매출"로 보는 근거는 있지만, 광고세트/광고소재 단위 A급 매칭은 불가능하다.

### Meta Ads API 후보군

Meta Ads API read-only로 현재/최근 광고 설정을 다시 봤다.

조회 결과 `iiari` 관련 템플릿 문구 URL parameter 후보는 5개 광고였고, 이 중 현재 ACTIVE 성격은 3개였다.

```text
후보 1
- campaign: 120245003319500396 / meta_biocom_influencer_260506
- adset: 120245700952890396 / meta_biocom_iiari_260518
- ad: 120245701139440396 / meta_biocom_iiari_Igg_260518
- 2026-05-18~2026-05-24 spend: ₩2,884,047
- clicks: 3,782
- Meta reported purchases: 42

후보 2
- campaign: 120242626179290396 / 공동구매 인플루언서 파트너 광고 모음_3 (260323)
- adset: 120242626179270396 / 인플루언서 공동구매 파트너 광고
- ad: 120245955028820396 / meta_biocom_iiari_Igg_260518 - 사본
- 2026-05-21~2026-05-24 spend: ₩846,125
- clicks: 997
- Meta reported purchases: 5

후보 3
- campaign: 120245003319500396 / meta_biocom_influencer_260506
- adset: 120245956430970396 / meta_biocom_iiari_260518 - 사본
- ad: 120245956430950396 / meta_biocom_iiari_acid_260518
- 2026-05-21~2026-05-24 spend: ₩686,796
- clicks: 461
- Meta reported purchases: 7
```

주의할 점은 이 후보군이 "가능성이 있는 광고 묶음"이라는 것이다. 템플릿 문구가 남은 row에는 ad ID가 없으므로 이 6건 결제완료를 위 광고 중 하나로 확정 배정하면 안 된다.

### `site_landing_ledger` 0건은 괜찮은가

예산 판단용 캠페인 ROAS에는 당장 치명적이지 않다. `/iiary02` 관련 체크아웃/결제 row는 `attribution_ledger`에 있고, 151개 중 135개는 숫자 ID로 매칭 가능하기 때문이다.

하지만 유입 퍼널 분석 관점에서는 문제가 있다. 같은 세션의 `site_landing_ledger` row는 존재했지만, 경로가 `/iiary02`가 아니라 `/shop_payment`, `/shop_payment_complete`, `/shop_view`, `/igg_store`로 기록됐다.

즉 현재 고객 유입 장부는 실제 첫 랜딩 페이지를 항상 보존하지 못하고, 결제/상품/후속 페이지를 landing path처럼 기록하는 경우가 있다. 이러면 "어떤 랜딩 페이지가 매출을 만들었는가"를 볼 때 왜곡이 생긴다.

### VM 원장 설계 보완 의견

설계 보완은 필요하다. 다만 바로 schema 변경이나 운영 write를 할 단계는 아니다.

우선순위는 아래와 같다.

1. read-only 보고서에서는 `site_landing_ledger.landing_path`만 보지 말고, `attribution_ledger.metadata_json.imweb_landing_url`의 원본 랜딩 경로도 함께 본다.
2. backend ROAS 매칭에서는 `/iiary02`처럼 metadata에 원본 landing URL이 있는 경우, 이 값을 후보 landing evidence로 쓰는 read-only bridge를 먼저 만든다.
3. 이후 운영 반영이 필요하면, `site_landing_ledger`에 후속 페이지와 원본 랜딩을 구분하는 필드 또는 별도 original landing ledger를 추가하는 설계를 승인받는다.

현재 권장하는 즉시 판단은 아래와 같다.

- `/iiary02` 숫자 ID row 135개: A급 또는 A급 후보로 사용 가능
- `/iiary02` 템플릿 문구 잔존 16개 중 결제완료 6건/₩1,894,000: Meta 유료 유입으로는 인정하되, campaign/adset/ad 확정 배정은 금지
- 그로스팀 요청: 위 후보 3개 광고의 실제 URL parameter가 왜 일부 클릭에서 숫자로 바뀌지 않았는지 확인

## 요청드리는 확인 사항

### 먼저 볼 샘플 캠페인 우선순위

전체 광고를 한 번에 다 확인하기 어렵다면 아래 캠페인부터 샘플 확인을 요청드립니다.

1. `meta_biocom_influencer_260506`
   - 먼저 보는 이유: 인플루언서 공동구매/파트너 광고 성격이라 자연 유입, 프로필 링크, 유료 광고 클릭이 섞이기 쉽습니다.
   - 확인하고 싶은 것: `/songyuul07`, `/hwajung01`, `/nanabebe05` 같은 인플루언서 랜딩이 실제 광고 URL에 어떻게 들어가 있는지, `campaign_alias`가 있는지, 숫자 campaign/adset/ad ID가 붙는지.
   - 샘플 수: ACTIVE 광고 2개. 성과가 큰 광고 1개와 최근 생성/수정된 광고 1개.

2. `meta_biocom_acid_260504`
   - 먼저 보는 이유: 현재 운용 중이고, organic acid 계열은 UTM alias가 많아 보이지만 숫자 ID가 URL에 남는지 확인이 필요합니다.
   - 확인하고 싶은 것: 실제 클릭 URL에 `utm_campaign`, `utm_term`, `utm_content`가 무엇으로 찍히는지. `{{campaign.id}}` 같은 템플릿 문구가 숫자로 바뀌는지.
   - 샘플 수: ACTIVE 광고 2개.

3. `meta_biocom_igg_260504`
   - 먼저 보는 이유: `/igg_store` 계열은 UTM 관리 파일과 Meta URL inventory 양쪽에 단서가 많습니다. 이 캠페인이 제대로 잡히면 B급 이상 매칭 사전 품질을 확인하기 좋습니다.
   - 확인하고 싶은 것: `/igg_store` 랜딩 URL, URL parameters, alias, 숫자 ID 여부.
   - 샘플 수: ACTIVE 광고 2개.

4. `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(2510...)`
   - 먼저 보는 이유: 화면상 예산/매출 규모가 큰 핵심 캠페인입니다. 여기서 URL 파라미터가 약하면 미매칭 금액 영향이 커집니다.
   - 확인하고 싶은 것: 광고 소재별 URL parameter가 동일한지, 광고마다 다른 `utm_content` 또는 ad ID가 있는지.
   - 샘플 수: ACTIVE 광고 2개. 가능하면 지출 큰 광고 위주.

5. `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
   - 먼저 보는 이유: 공동구매/인플루언서 성격이라 Meta 유료 광고와 인스타 프로필/인포크/링크인바이오 유입이 섞일 가능성이 있습니다.
   - 확인하고 싶은 것: 유료 광고 URL과 프로필 링크용 UTM이 분리되어 있는지.
   - 샘플 수: ACTIVE 광고 1~2개.

6. `[바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본`
   - 먼저 보는 이유: 현재도 활동 중이고 전환 캠페인 성격이라 내부 ROAS 판단에 영향이 있습니다.
   - 확인하고 싶은 것: URL parameters, alias, 숫자 ID 여부.
   - 샘플 수: ACTIVE 광고 1~2개.

시간이 정말 부족하면 1~3번만 먼저 확인해도 됩니다. 이 세 캠페인은 인플루언서/acid/IGG 세 축이라 현재 미매칭 원인을 가르는 데 가장 효율적입니다.

### 1. 현재 운용 중인 ACTIVE 광고의 실제 URL 파라미터 확인

아래 항목을 광고 단위로 확인 부탁드립니다.

- 캠페인명
- 캠페인 ID
- 광고세트명
- 광고세트 ID
- 광고명
- 광고 ID
- 광고 상태
- 실제 랜딩 URL
- URL 파라미터 입력값
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `campaign_alias`가 있다면 그 값
- 실제 클릭 시 Meta 자동 치환 템플릿 문구가 숫자로 바뀌는지 여부

중요한 것은 UTM 관리표에 존재하는 URL만이 아닙니다. 그 URL이 현재 ACTIVE 광고 소재에 실제로 들어가 있는지, 그리고 실제 고객이 클릭했을 때 최종 랜딩 URL에 어떤 값이 붙는지가 더 중요합니다.

예를 들어 화면에는 아래처럼 보일 수 있습니다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

하지만 실제 클릭 URL에서도 그대로 `{{campaign.id}}`라고 남으면 내부 매칭에는 도움이 되지 않습니다. 실제 클릭 후에는 아래처럼 숫자로 바뀌어야 합니다.

```text
utm_campaign=120245003319500396
utm_term=120245370784880396
utm_content=120xxxxxxxxxxxxx
```

### 2. Meta dynamic parameter가 실제로 치환되는지 확인

아래 세 가지가 실제 랜딩 URL에서 숫자로 바뀌는지 확인 부탁드립니다.

```text
{{campaign.id}}
{{adset.id}}
{{ad.id}}
```

확인 방법은 아래 중 편한 방식으로 부탁드립니다.

1. Ads Manager에서 해당 광고의 URL 파라미터 설정 화면 캡처
2. 광고 미리보기 또는 테스트 클릭 후 최종 랜딩 URL 캡처
3. 광고 export 파일에서 URL/URL parameters 컬럼 제공

### 3. 현재 광고를 바로 수정해도 되는지 여부는 별도 판단

이번 요청은 먼저 확인 요청입니다. 이미 학습이 잘 돌고 있는 광고 소재의 랜딩 URL을 바로 바꾸면 광고 재검토나 성과 변동이 생길 수 있으므로, 수정은 별도 논의가 필요합니다.

우선순위는 아래처럼 보는 것이 안전합니다.

1. 신규 광고/신규 소재부터 숫자 ID UTM 표준 적용
2. 오류가 확실한 숫자 ID 미치환 광고는 수정 후보로 분리
3. 성과가 큰 기존 광고는 바로 수정하지 말고, 복제본 또는 낮은 리스크 방식 검토
4. 수정 전후 ROAS/전환 추적 영향은 내부에서 별도 모니터링

## 권장 URL 파라미터 표준안

가능하다면 앞으로 Meta 광고 URL에는 아래 구조를 권장합니다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
campaign_alias=meta_biocom_{캠페인구분}_{생성일}
```

예시:

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
campaign_alias=meta_biocom_influencer_260506
```

숫자 ID가 실제 클릭 시 정상 치환되면 내부에서는 campaign ID, adset ID, ad ID를 Meta API와 연결해 캠페인별 ROAS를 더 정확히 계산할 수 있습니다.

## 만약 숫자 ID 자동 치환이 불가능하다면

Meta 설정상 숫자 ID 자동 치환 템플릿 문구가 실제 클릭 URL에서 숫자로 바뀌지 않는다면, 대안은 아래 순서입니다.

1. `campaign_alias`를 광고 URL에 반드시 넣습니다.
2. alias는 캠페인마다 고유하게 만듭니다.
3. 같은 alias를 여러 캠페인에서 재사용하지 않습니다.
4. 광고세트/광고 소재까지 나누려면 `adset_alias`, `ad_alias`도 별도 규칙으로 둡니다.
5. 그로스팀이 관리하는 UTM 관리 파일에도 같은 alias를 등록합니다.

이 경우 내부 매칭 등급은 A급은 아니지만, 단일 캠페인에만 연결되는 alias라면 B급으로 볼 수 있습니다.

## 내부 매칭 등급 기준

- A급: 숫자 campaign ID, adset ID, ad ID가 URL/원장에 있음
- B급: 고유한 `campaign_alias`가 있고, 단일 캠페인으로만 연결됨
- C급: landing path, 광고명, 광고세트명만 있어 후보 추정만 가능
- D급: `fbclid`만 있거나 `{{campaign.id}}` 같은 템플릿 문구만 남아 수동확인 필요

이번 요청의 목표는 앞으로 D급 주문을 줄이고, 최소 B급 이상으로 남기는 것입니다.

## 그로스팀에서 회신해주시면 좋은 형식

가능하면 아래 형태로 회신 부탁드립니다.

```text
1. 현재 ACTIVE 광고 URL 파라미터 export 가능 여부:
2. 숫자 ID 자동 치환이 실제 클릭에서 가능한지:
3. 현재 템플릿 문구가 그대로 남는 광고가 있는지:
4. 숫자 ID UTM을 신규 광고부터 적용 가능 여부:
5. 기존 성과 우수 광고 URL 수정 시 예상 리스크:
6. 샘플 광고 3~5개의 실제 클릭 최종 URL:
7. 광고별 URL/UTM export 파일 첨부 가능 여부:
```

## 이번 확인이 끝나면 내부에서 할 일

그로스팀에서 실제 URL과 UTM 정보를 주시면 내부에서는 아래 작업을 진행하겠습니다.

1. 현재 미매칭 주문 중 추가로 B급/C급 후보가 생기는지 확인
2. 신규 URL 표준을 내부 매출 원장과 연결
3. `fbclid only` 주문이 줄어드는지 모니터링
4. 캠페인별 내부 ROAS와 Meta 플랫폼 ROAS 차이를 다시 비교

## 한 줄 요청

현재 운용 중인 Meta ACTIVE 광고의 실제 랜딩 URL과 URL 파라미터를 광고 단위로 확인 부탁드립니다. 특히 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`가 실제 클릭 URL에서 숫자로 치환되는지 확인이 필요합니다.
