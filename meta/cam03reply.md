# cam03 reply. Meta API alias audit 개발 결과

작성시각: 2026-04-11 KST

## 질문 답변: Meta API로 원래 수집이 되었었나

수집은 이미 되고 있었다.

기존 `backend/scripts/export-meta-campaign-alias-audit.ts`는 Meta Marketing API를 호출해서 아래 데이터를 가져오고 있었다.

- campaign insight: campaign별 spend, clicks, impressions, purchase, purchase value
- adset 목록: adset id/name/status, attribution spec, optimization goal
- ad 목록: ad id/name/status, 일부 creative 정보, 일부 landing URL, `url_tags`

그런데 기존 수집이 충분하지 않았다.

문제:

- `last_7d` 기간이 `2026-04-03 ~ 2026-04-09`로 하드코딩되어 있었다.
- 현재 CSV/운영 판단 기간인 `2026-04-04 ~ 2026-04-10`과 날짜축이 어긋났다.
- URL 추출 경로가 `link_data.link`, `CTA link`, `video CTA link`, `creative.link_url` 정도로 제한되어 있었다.
- `url_tags`가 `utm_campaign=...` 같은 query string만 들어오는 경우를 제대로 파싱하지 못했다.
- URL evidence 파일이 별도로 없어, 어느 광고에서 어떤 URL/UTM이 나왔는지 사람이 검토하기 어려웠다.

왜 바로 안 했는가:

- 이전에는 CSV와 수동 화면 확인으로 특정 alias 3개를 먼저 확정하는 흐름이었다.
- 기존 audit 파일에 Meta API 수집 결과가 있어서 “API 수집 자체가 안 된다”가 아니라 “이미 수집된 결과 중 URL 추출률이 낮다”는 쪽이 핵심이었다.
- 이번 작업에서 그 차이를 분리해서, 기존 수집 흐름을 보강하고 최신 기간으로 재생성했다.

## 반영 성공

### 1. audit 날짜축 수정

`backend/scripts/export-meta-campaign-alias-audit.ts`에 아래 옵션을 추가했다.

```bash
--start-date YYYY-MM-DD
--end-date YYYY-MM-DD
```

이제 하드코딩된 `last_7d`만 쓰지 않고, Meta spend 기간과 Attribution 원장 기간을 같은 날짜로 맞춰 audit을 생성할 수 있다.

이번 실행 기준:

```text
site: biocom
requestedDatePreset: last_7d
actual datePreset: custom
range: 2026-04-04 ~ 2026-04-10
Meta API param: time_range={since: 2026-04-04, until: 2026-04-10}
```

### 2. 최신 audit 재생성

성공적으로 재생성했다.

생성 파일:

```text
data/meta_campaign_alias_audit.biocom.json
```

생성 결과:

```text
generatedAt: 2026-04-11T05:31:33.717Z
campaigns: 7
adsets: 26
ads: 410
aliasCandidates: 19
adsWithLandingUrl: 345
adsWithUrlTags: 340
```

기존 파일과 비교:

```text
기존 generatedAt: 2026-04-08T16:34:01.492Z
기존 range: 2026-04-03 ~ 2026-04-09
기존 adsWithLandingUrl: 128
기존 adsWithUrlTags: 123

신규 generatedAt: 2026-04-11T05:31:33.717Z
신규 range: 2026-04-04 ~ 2026-04-10
신규 adsWithLandingUrl: 345
신규 adsWithUrlTags: 340
```

즉 URL 추출률이 크게 개선됐다.

### 3. 송율 stale audit 문제 해결

기존 audit에서는 송율이 아래처럼 보였다.

```text
confirmed: 0건 / 0원
pending: 9건 / 2,378,500원
```

최신 audit에서는 아래처럼 바뀌었다.

```text
confirmed: 26건 / 6,948,200원
pending: 1건 / 268,200원
canceled: 1건 / 234,000원
total: 28건 / 7,450,400원
```

이제 `/ads` alias review API도 최신 audit 값을 읽는다.

검증 결과:

```text
meta_biocom_songyuul08
confirmedOrders: 26
confirmedRevenue: 6,948,200
pendingOrders: 1
pendingRevenue: 268,200
canceledOrders: 1
canceledRevenue: 234,000
```

### 4. URL evidence 파일 생성

새 파일을 생성했다.

```text
meta/campaign-url-evidence.biocom.json
```

구성:

- campaign ID/name
- adset ID/name
- ad ID/name
- spend/clicks/impressions
- creative landing URL
- URL source path
- `url_tags`
- 추출된 UTM
- 매칭된 alias key
- confidence
- reason

생성 결과:

```text
rows: 410
rowsWithLandingUrl: 345
rowsWithTrackingTags: 340
rowsWithMatchedUtmCampaign: 340
```

자동으로 `utm_campaign`을 뽑은 alias 수:

```text
전체 matched alias: 231개
campaign이 1개로 좁혀지는 alias: 198개
여러 campaign에 걸친 alias: 33개
```

따라서 앞으로 TJ님이 광고 URL을 하나씩 주는 방식 대신, 대부분은 이 파일로 자동 검토할 수 있다.

## 일부 해결

### 1. 송율/연뜰살뜰/현서가 속한 공동구매 캠페인은 API URL이 비어 있음

문제 캠페인:

```text
campaignId: 120242626179290396
campaignName: 공동구매 인플루언서 파트너 광고 모음_3 (260323)
```

이 캠페인의 송율/연뜰살뜰/현서 광고들은 Meta API에서 광고명, 본문, creative ID, spend는 내려오지만 landing URL이 비어 있다.

송율 예시:

```text
adId: 120243539487070396
adName: [송율x바이오컴] 04.08-04.15
spend: 83,974
landingUrl: null
urlTags: null
matchedAliasKey: null
confidence: needs_manual_review
```

즉 TJ님이 Ads Manager 화면에서 본 `소스 URL / 웹사이트 URL`은 UI에서는 보이지만, 현재 API 응답에서는 해당 필드로 내려오지 않는다.

### 2. 개별 creative 추가 필드 보강은 코드에 반영했지만 재생성은 rate limit로 막힘

추가로 코드에 아래 필드 저장을 반영했다.

- `creativeId`
- `creativeName`
- `objectStoryId`
- `effectiveObjectStoryId`
- `instagramPermalinkUrl`

하지만 이 보강 후 재실행은 Meta API 제한으로 실패했다.

오류:

```text
User request limit reached
```

현재 저장된 `meta/campaign-url-evidence.biocom.json`은 첫 번째 성공 실행 결과다. 즉 URL evidence 자체는 최신이지만, `creativeName/storyId/instagramPermalinkUrl` 추가 필드는 rate limit 해제 후 재실행해야 파일에 들어간다.

## 실패 또는 현재 한계

### 1. 현재 토큰으로는 일부 post attachment URL을 못 읽음

송율 광고의 `effective_object_story_id`는 조회됐다.

```text
effective_object_story_id: 457149091768586_2330869220751559
instagram_permalink_url: https://www.instagram.com/p/DW2mvWHjD2G/
```

하지만 해당 story의 attachment URL을 조회하려고 하면 권한 오류가 난다.

오류:

```text
(#10) This endpoint requires the 'pages_read_engagement' permission or the 'Page Public Content Access' feature.
```

의미:

- 현재 광고 API 토큰으로는 광고 성과와 일부 creative 정보는 읽을 수 있다.
- 그러나 IG/Facebook 게시물 attachment 안의 실제 링크까지 읽으려면 추가 Page 권한이 필요할 수 있다.
- 따라서 공동구매 캠페인처럼 기존 IG 게시물/공유형 creative를 쓰는 광고는 현재 토큰만으로 URL 자동 확정이 안 되는 경우가 있다.

### 2. 여러 campaign에 걸친 alias는 자동 확정 금지

URL evidence에서 `utm_campaign`은 잡혔지만 같은 alias가 여러 campaign에 걸친 경우가 있다.

상위 예시:

```text
meta_biocom_proteinstory_igg -> 2 campaigns
meta_biocom_skincare_igg -> 2 campaigns
meta_biocom_iggspring -> 2 campaigns
meta_biocom_iggacidset_2026 -> 2 campaigns
meta_biocom_igevsiggblog_igg -> 2 campaigns
meta_biocom_servicecatalog_service -> 2 campaigns
meta_biocom_iggunboxing_igg -> 2 campaigns
```

이런 항목은 URL이 있어도 campaign-level 매핑을 바로 하나로 확정하면 안 된다. campaign별 spend/기간/광고명을 같이 보고 분리해야 한다.

## 다음 액션

### 바로 할 수 있는 것

1. Meta API rate limit가 풀리면 아래 명령을 다시 실행한다.

```bash
cd backend
npx tsx scripts/export-meta-campaign-alias-audit.ts --site biocom --date-preset last_7d --start-date 2026-04-04 --end-date 2026-04-10
```

2. 재실행 후 `meta/campaign-url-evidence.biocom.json`에 `creativeId`, `effectiveObjectStoryId`, `instagramPermalinkUrl`까지 들어오는지 확인한다.

3. `/ads` 화면의 alias review 카드에 `campaign-url-evidence` 기반 자동 매칭/예외 목록을 표시한다.

### TJ님 수동 확인이 여전히 필요한 경우

전부가 아니라 아래만 수동 확인하면 된다.

- spend가 큰데 API URL이 비어 있는 광고
- 같은 alias가 여러 campaign에 걸친 광고
- 공동구매 캠페인처럼 UI에서는 URL이 보이지만 API에서는 `landingUrl=null`인 광고
- 광고명과 UTM이 충돌하는 광고

### 수동 URL 제공을 줄이는 더 좋은 방법

Meta 권한을 보강할 수 있으면 다음 권한/접근을 검토한다.

- Page 게시물 attachment 조회 권한
- `pages_read_engagement`
- 필요한 경우 Page Public Content Access
- system user 또는 page token 기반 조회 가능 여부

다만 이건 Meta 앱 권한/비즈니스 설정 이슈라 로컬 코드만으로 해결되는 영역은 아니다.

## 검증

실행한 검증:

```bash
cd backend && npx tsc --noEmit --pretty false
```

결과:

```text
성공
```

추가 검증:

```text
git diff --check
성공
```

## 결론

Meta API 수집은 원래 있었다. 문제는 “수집 안 함”이 아니라 “날짜축 고정 + URL 추출 경로 부족 + evidence 파일 부재”였다.

이번 작업으로 최신 audit와 URL evidence 자동 생성까지는 성공했다. 전체 410개 광고 중 340개는 API만으로 `utm_campaign`을 추출했다.

남은 한계는 공동구매 캠페인 일부 광고다. 특히 송율/연뜰살뜰/현서처럼 Ads Manager UI에서는 URL이 보이지만 API 응답에서는 landing URL이 빠지는 광고가 있다. 이 부분은 현재 토큰 권한으로는 완전 자동화가 안 되고, 추가 Page 권한 또는 제한된 수동 확인이 필요하다.
