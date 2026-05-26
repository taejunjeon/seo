# Meta UTM API evidence 보완 설계 및 적용 후보

작성 시각: 2026-05-27 01:32 KST  
대상: 바이오컴 Meta UTM 정합성 보고서 `/ads/meta-utm`  
작업 성격: Green Lane, read-only 설계/후보 정리, 배포 없음

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - docs/agent-harness/growth-data-harness-v0.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - project/meta-retained-unmapped-first-paid-touch-design-20260526.md
    - project/meta-url-parameter-substitution-analysis-20260525.md
  lane: Green
  allowed_actions:
    - local_api_smoke_read_only
    - local_design_doc
    - no_write_candidate_summary
  forbidden_actions:
    - vm_cloud_deploy
    - meta_ads_setting_change
    - production_db_write
    - gtm_publish
  source_window_freshness_confidence:
    source: "local backend /api/ads/meta-utm-diagnostics disk_cache_hit"
    window: "2026-05-20~2026-05-26 KST calendar dates inclusive"
    freshness: "cached_at 2026-05-27 01:02 KST; live refresh는 Meta ad-account rate limit으로 stale cache 사용"
    confidence: "Medium-High for current report classification, Medium for live status because cache is stale"
```

## 한 줄 결론

현재 남은 미맵핑의 핵심은 “광고에 UTM이 없어서”라기보다 “Meta API 진단 조회가 실제 광고 URL/URL 매개변수가 들어있는 creative 깊은 필드를 충분히 가져오지 못해서”인 가능성이 크다. 우선 API evidence 수집 범위를 넓히고, 그래도 안 잡히는 것만 TJ님/그로스팀 수동 확인 후보로 남기는 방식이 맞다.

## 왜 이 설계가 필요한가

TJ님이 확인해 준 `meta_biocom_acid_reel_260504` 사례가 기준점이다.

- Ads Manager 실제 URL에는 `utm_source=meta_biocom_acidset_pregnancyreel_acid`, `utm_campaign=meta_biocom_acidset_pregnancyreel_acid`가 있었다.
- 그런데 `/ads/meta-utm` API 진단 행에는 `sampleUrl=null`, `sampleTags=null`로 내려왔다.
- 그래서 보고서는 처음에 Section C, 즉 “현재 API evidence로는 URL/UTM을 확인하지 못함”으로 분류했다.
- 이건 곧바로 “UTM이 아예 없다”는 뜻이 아니다. 현재 API가 읽는 creative 필드 위치에 UTM이 안 보였다는 뜻이다.

따라서 보고서 문구와 API 수집 설계는 아래처럼 나누어야 한다.

1. `UTM 있음`: API 또는 Ads Manager URL에서 숫자 ID/alias/URL 파라미터가 실제 확인됨.
2. `API evidence 없음`: 현재 API 응답만으로는 URL/파라미터를 못 봄. 실제 광고에는 있을 수 있음.
3. `UTM 없음`: Ads Manager 실제 URL/URL 매개변수까지 확인했는데도 없음.

현재 문제 후보 대부분은 2번이다.

## 현재 관측 수치

기준 소스: local backend `GET /api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d`  
캐시 기준 시각: 2026-05-27 01:02 KST  
조회 기간: 2026-05-20~2026-05-26 KST  
주의: Meta API rate limit으로 live refresh가 실패해 stale disk cache 기준이다.

- 전체 진단 row: 125개
- 캠페인 미맵핑: 0개
- 광고세트 미맵핑: 6개
- 최근 7일 지출 있는 광고세트 미맵핑: 0개
- 광고 미맵핑: 49개
- 최근 7일 지출 있는 광고 미맵핑: 34개
- 최근 7일 지출 있는 광고 미맵핑의 합계 지출: 20,297,175원
- 최근 7일 지출 있는 광고 미맵핑의 Meta 구매 수: 128건
- 최근 7일 지출 있는 광고 미맵핑의 Meta 구매값: 37,116,380원
- 최근 7일 지출 있는 광고 미맵핑 중 `effective_status=ACTIVE`: 26개
- 최근 7일 지출 있는 광고 미맵핑 중 `effective_status!=ACTIVE`: 8개

해석:

- 광고세트 쪽은 지출 있는 미맵핑이 0개라서 지금 TJ님이 바로 확인할 급한 대상은 아니다.
- 광고 쪽 34개가 다음 API 보완의 직접 적용 후보다.
- 이 34개는 모두 현재 응답에서 `sampleUrl=null`, `sampleTags=null`이다. 즉 “값이 비어 있다”가 아니라 “현재 API 수집 범위에서는 URL/URL Parameters 위치를 못 찾은 상태”로 봐야 한다.

## 현재 코드에서 보이는 원인

현재 진단 파서는 URL/UTM을 읽을 준비가 되어 있다.

- `backend/src/routes/ads.ts`의 `collectCreativeTrackingValues()`는 `url_tags`, `link_url`, `object_url`, `object_story_spec`, `asset_feed_spec`, `instagram_permalink_url`까지 재귀적으로 읽도록 되어 있다.

하지만 `/ads/meta-utm` 진단 조회에서 실제 Meta Ads API에 요청하는 creative 필드는 더 좁다.

현재 진단용 요청:

```ts
creative{id,thumbnail_url,image_url,url_tags,link_url}
```

이미 다른 Meta 광고 evidence 조회 경로에는 더 넓은 필드 요청이 존재한다.

```ts
creative{id,name,url_tags,link_url,object_url,object_story_spec,asset_feed_spec,instagram_permalink_url}
```

따라서 1차 보완은 새 로직을 invent하는 것이 아니라, 이미 쓰고 있는 넓은 creative evidence 필드를 `/ads/meta-utm` 진단 경로에도 적용하는 것이다.

## API 보완 설계

### 1단계: 진단 API의 creative field 확장

대상 파일:

- `backend/src/routes/ads.ts`

대상 위치:

- `fetchMetaUtmDiagnosticsData()` 내부의 `/ads` 조회 fields

변경 후보:

```ts
const META_UTM_CREATIVE_EVIDENCE_FIELDS = [
  "id",
  "name",
  "thumbnail_url",
  "image_url",
  "url_tags",
  "link_url",
  "object_url",
  "object_story_spec",
  "asset_feed_spec",
  "instagram_permalink_url",
].join(",");
```

적용 방식:

```ts
`creative{${META_UTM_CREATIVE_EVIDENCE_FIELDS}}`
```

기대 효과:

- 기존 `sampleUrl=null`, `sampleTags=null`였던 광고 중 일부가 `object_story_spec` 또는 `asset_feed_spec` 안의 랜딩 URL/URL Parameters로 복구될 수 있다.
- TJ님이 수동 확인해야 하는 후보 수가 34개에서 더 줄 수 있다.

주의:

- Meta API 계정 rate limit이 이미 발생하고 있으므로, 바로 live refresh를 강제하는 방식은 피한다.
- 기존 cache fallback은 유지해야 한다.
- 필드 확장으로 특정 creative 타입에서 권한/필드 오류가 날 경우 전체 API가 죽지 않도록 fallback을 둔다.

### 2단계: creative direct fallback probe

1단계에서 `/act_xxx/ads?fields=creative{...}`로도 URL이 안 나오면, `creative.id`만 모아서 creative 단건 또는 배치 조회를 시도한다.

설계 후보:

```txt
1. /ads 진단 조회에서 creative.id 확보
2. sampleUrl/sampleTags가 모두 null인 ad만 후보화
3. creative.id 기준 dedupe
4. /{creative_id}?fields=id,name,url_tags,link_url,object_url,object_story_spec,asset_feed_spec,instagram_permalink_url 조회
5. 기존 collectCreativeTrackingValues()로 재파싱
6. 성공한 evidence는 row.evidenceSource = "creative_direct_probe"로 표시
```

rate limit 보호:

- 기본은 disabled 또는 local/dry-run 전용으로 시작한다.
- 동시에 2~3개 이상 호출하지 않는다.
- TTL cache를 둔다. 권장 TTL은 최소 6시간이다.
- 실패 시 기존 row를 유지하고 `probeSkippedReason`만 응답에 붙인다.

### 3단계: evidence 등급 재정의

보고서의 분류 기준은 아래처럼 고정한다.

- A급: 광고 URL 또는 URL Parameters에서 숫자 `campaign_id`, `adset_id`, `ad_id`가 확인됨. 내부 ROAS 매칭의 확정 근거로 사용 가능.
- B급: 고유 `campaign_alias` 또는 고유 UTM alias가 확인되고, 현재 Meta API의 campaign/adset/ad entity와 단일로 연결됨. 캠페인/광고세트 수준 제안 근거로 사용하되, 숫자 ID가 없으면 광고 단위 ROAS 확정값으로 쓰지 않는다.
- C급: 랜딩 URL, 광고명, 광고세트명, 상품군만 있음. 후보 제안만 가능하다.
- D급: fbclid only, URL 없음, placeholder macro만 있음, 또는 source 불명. 수동확인/quarantine이다.

중요 원칙:

- UTM 관리 파일에 alias가 있다는 사실만으로 자동 확정하지 않는다.
- API 또는 TJ님/그로스팀이 확인한 실제 Ads Manager URL이 있어야 “현재 운용 광고에 붙은 값”으로 본다.
- 단, UTM 관리 파일은 “이 alias가 어떤 상품/캠페인을 뜻하는지” 해석하는 B급 제안 사전으로 사용한다.

### 4단계: 프론트 보고서 문구 보강

현재 Section C 문구는 사용자가 “UTM이 없다”로 오해하기 쉽다. 아래 문구로 바꾼다.

권장 문구:

```txt
현재 API evidence로는 광고 URL/URL 매개변수를 확인하지 못했습니다.
실제 Ads Manager에는 UTM이 있을 수 있으므로, 지출이 있는 항목부터 URL 매개변수 확인이 필요합니다.
```

그리고 각 row에 evidence source를 표시한다.

- `api_creative_url_tags`
- `api_creative_object_story_spec`
- `api_creative_asset_feed_spec`
- `creative_direct_probe`
- `tj_ads_manager_url_copy`
- `utm_file_candidate_only`

### 5단계: 수동 evidence는 별도 overlay로 관리

현재 acid 릴스 사례처럼 TJ님이 Ads Manager에서 실제 URL을 복사해 준 경우는 API가 놓친 구멍을 메울 수 있다.

권장 구조:

```txt
manual evidence registry
- site
- campaign_id
- adset_id
- ad_id nullable
- canonical_url
- source
- checked_at_kst
- grade
- reason
```

다만 이 registry는 “API 보완 전 임시 overlay”로 봐야 한다. 장기적으로는 API field 확장과 creative direct probe가 우선이다.

## 적용 후보 우선순위

### P0. 최근 7일 지출 있는 광고 미맵핑 34개

이 34개가 API 보완의 직접 적용 후보다. 모두 현재 `sampleUrl=null`, `sampleTags=null`이므로 expanded creative field 또는 creative direct probe로 복구 가능성이 있다.

| 순위 | 광고 ID | 광고명 | 상태 | 7일 지출 | Meta 구매값 | 캠페인 | 광고세트 | API 보완 기대 |
|---:|---|---|---|---:|---:|---|---|---|
| 1 | 120240625478010396 | 260203_식단스토리 | ACTIVE | 2,689,270 | 4,858,072 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 최우선 |
| 2 | 120237382384260396 | 음과검_셀렉트스토어 영상_피부소구 - 사본 | ACTIVE | 2,470,036 | 3,810,750 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 최우선 |
| 3 | 120239451369460396 | 260102_영중검_대사속도 | ACTIVE | 2,054,784 | 2,060,147 | [바이오컴] 영양중금속검사 전환 캠페인 | 영양중금속검사 | 최우선 |
| 4 | 120241010607940396 | [연뜰살뜰] 스토리 6 | ACTIVE | 2,030,200 | 4,284,000 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 최우선 |
| 5 | 120241846760620396 | 260305_봄맞이이벤트_음과검 - 사본 | ACTIVE | 1,778,976 | 8,833,079 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물 과민증 검사_피부 타겟 | 최우선 |
| 6 | 120236437701390396 | 1104_단백질스토리_음과검 | ACTIVE | 1,631,593 | 2,198,000 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물과민증검사_근육 타겟 | 최우선 |
| 7 | 120236165716000396 | 1030_급성비교블로그_음과검 | ACTIVE | 1,593,132 | 2,882,000 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물과민증검사_관심타겟 | 최우선 |
| 8 | 120240969187000396 | [연뜰살뜰x음과검종대사] 26.2.12-18 스토리 | PAUSED | 1,326,080 | 552,710 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 높음 |
| 9 | 120237783487450396 | [연뜰살뜰x음과검] 2차공구 - 사본 | ACTIVE | 909,096 | 1,463,000 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 높음 |
| 10 | 120242627148820396 | 260323_미라클모닝스토리 | ADSET_PAUSED | 669,193 | 735,000 | [바이오컴] 호르몬 검사 바이럴 소재 캠페인_0811 | 종합호르몬분석_바이럴소재_0811 | 높음 |
| 11 | 120242626208430396 | [연뜰살뜰x음과검] 2차공구 - 사본 - 사본 | ACTIVE | 567,575 | 490,000 | 공동구매 인플루언서 파트너 광고 모음_3 (260323) | 인플루언서 공동구매 파트너 광고 | 높음 |
| 12 | 120218587547830396 | 영양중금속_리뷰소재_다이어트소구 | ACTIVE | 566,510 | 318,400 | [바이오컴] 영양중금속검사 전환 캠페인 | 영양중금속검사 | 높음 |
| 13 | 120239562914250396 | 260105_음과검/종대사 set_새해이벤트 - 사본 | ACTIVE | 298,976 | 1,195,200 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 중간 |
| 14 | 120235591897450396 | 음식물과민증검사_팀키토영상_5_검사하나로해결 | ACTIVE | 287,698 | 1,470,000 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 중간 |
| 15 | 120234443392970396 | [연뜰살뜰X음과검] 상시릴스 1 - 사본 | ACTIVE | 276,425 | 144,074 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물 과민증 검사_피부 타겟 | 중간 |
| 16 | 120235776731190396 | [염증청소뿌X음과검] 상시릴스 1 - 사본 | ACTIVE | 217,618 | 490,000 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물과민증검사_관심타겟 | 중간 |
| 17 | 120240056812400396 | [요즘픽X음과검] 상시 게시글 - 사본 | ACTIVE | 195,961 | 332,948 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물과민증검사_관심타겟 | 중간 |
| 18 | 120242626208390396 | [연뜰살뜰x음과검] mast검사 스토리2 - 사본 | ACTIVE | 160,554 | 0 | 공동구매 인플루언서 파트너 광고 모음_3 (260323) | 인플루언서 공동구매 파트너 광고 | 중간 |
| 19 | 120235192232440396 | [연뜰살뜰X음과검] 공구게시글 - 사본 | ACTIVE | 122,290 | 479,000 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물 과민증 검사_피부 타겟 | 중간 |
| 20 | 120239854599920396 | [요즘픽X음과검] 상시 게시글 | ACTIVE | 102,722 | 0 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 중간 |
| 21 | 120244878893850396 | 260504_종대사 스토리 1 - 사본 | PAUSED | 82,548 | 260,000 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 낮음 |
| 22 | 120242626208410396 | [연뜰살뜰x음과검] mast검사 스토리1 - 사본 | ACTIVE | 48,048 | 0 | 공동구매 인플루언서 파트너 광고 모음_3 (260323) | 인플루언서 공동구매 파트너 광고 | 낮음 |
| 23 | 120240401259960396 | [연뜰x종대사] 상시 릴스 2 | ACTIVE | 46,361 | 260,000 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 낮음 |
| 24 | 120244878893840396 | 260504_종대사 스토리 2 - 사본 | PAUSED | 37,320 | 0 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 낮음 |
| 25 | 120236607075520396 | 1107_영양제추천스토리_뉴로 | ACTIVE | 36,006 | 0 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | 뉴로 마스터 | 낮음 |
| 26 | 120240976053360396 | [연뜰살뜰x종대사음과검] 스토리-3 - 사본 | PAUSED | 31,594 | 0 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 낮음 |
| 27 | 120241506461580396 | [연뜰살뜰x음과검] mast검사 스토리1 - 사본 | PAUSED | 21,164 | 0 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 낮음 |
| 28 | 120215196342520396 | 풍성밸런스6_풍성함되찾는방법 | ACTIVE | 12,307 | 0 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | 풍성밸런스 | 낮음 |
| 29 | 120244676919410396 | 260429_음과검피부TTS1 - 사본 | ACTIVE | 11,267 | 0 | [바이오컴] 음식물 과민증 검사 전환캠페인(10/14~) | 음식물 과민증 검사_피부 타겟 | 낮음 |
| 30 | 120244878893830396 | 260504_종대사 스토리 3 - 사본 | PAUSED | 8,146 | 0 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 낮음 |
| 31 | 120244880114070396 | 260504_음과검_임신준비1 - 사본 | ACTIVE | 4,612 | 0 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 낮음 |
| 32 | 120231750072130396 | 0728_종호균_에겐&테토 - 사본 | ADSET_PAUSED | 4,025 | 0 | [바이오컴] 호르몬 검사 바이럴 소재 캠페인_0811 | 종합호르몬분석_바이럴소재_0811 | 낮음 |
| 33 | 120244878995230396 | 260504_종대사 임신준비 릴스1 - 사본 | ACTIVE | 3,637 | 0 | [바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본 | 종합대사기능검사 - 사본 | 낮음 |
| 34 | 120239866963060396 | 260113_음과검 언박싱 | ACTIVE | 1,451 | 0 | [바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020) | 음식물과민증검사_관심타겟_어드밴티지+ | 낮음 |

### P1. 최근 7일 지출 없는 광고세트 미맵핑 6개

이 6개는 현재 지출 0원이므로 TJ님 수동 확인 우선순위는 낮다. 다만 API field 확장 후 자동으로 일부 복구될 수 있으므로 보고서에는 “지출 없음, 확인 보류”로 남기는 것이 맞다.

| 광고세트 ID | 광고세트명 | 캠페인 | 상태 | 7일 지출 |
|---|---|---|---|---:|
| 120226617123430396 | 당당케어 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |
| 120238538162980396 | 리셋데이 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |
| 120215616210950396 | 바이오밸런스 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |
| 120239339405510396 | 방탄젤리 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |
| 120238737034910396 | 수면 캠페인_메타드림 - 사본 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |
| 120220377232950396 | 영데이즈 - ROAS 목표 | [바이오컴] 건강기능식품 - 클린, 풍성, 바이오 | ACTIVE | 0 |

## 구현 후보

### 후보 A: 최소 패치

내용:

- `/ads/meta-utm` 진단용 Meta `/ads` 조회 creative field를 넓힌다.
- 기존 파서와 UI 구조는 최대한 그대로 둔다.

장점:

- 변경 범위가 작다.
- 이미 다른 경로에서 쓰는 field 조합을 재사용하므로 위험이 낮다.

단점:

- 필드 확장만으로 안 잡히는 partnership/post 기반 광고는 계속 남을 수 있다.

추천:

- 1차 적용 후보. 추천 강도 90%.

### 후보 B: expanded creative probe 캐시 추가

내용:

- 미맵핑 row만 creative direct probe로 재조회한다.
- 결과를 runtime cache로 저장한다.

장점:

- API field 확장만으로 안 잡히는 creative의 URL 증거를 추가로 회수할 수 있다.
- TJ님 수동 확인 후보를 더 줄일 가능성이 높다.

단점:

- Meta API 호출량이 늘어난다.
- rate limit 보호, TTL, 실패 시 fallback 설계가 필요하다.

추천:

- 후보 A 검증 후 2차 적용. 추천 강도 75%.

### 후보 C: UTM 관리 파일 alias overlay 강화

내용:

- UTM 관리 파일의 alias를 “자동 확정”이 아니라 “B급 제안 사전”으로 붙인다.
- API 또는 TJ님 실제 URL evidence가 있을 때만 alias 의미 해석에 사용한다.

장점:

- TJ님이 제공한 acid 사례처럼 `meta_biocom_acidset_pregnancyreel_acid` 같은 문자열의 의미를 빠르게 해석할 수 있다.

단점:

- UTM 관리 파일은 계획/관리 파일일 수 있으므로 실제 라이브 광고 URL 증거가 아니다.

추천:

- 후보 A와 병행 가능. 추천 강도 85%.

### 후보 D: 프론트 문구/섹션 재정리

내용:

- Section C를 “UTM 없음”이 아니라 “API evidence 없음”으로 명확히 표시한다.
- 지출 0원 항목은 “운용 중 확인 대상”에서 제외한다.
- `sourceConfidence`, `evidenceSource`, `sampleUrl`, `sampleTags`를 row별로 표시한다.

장점:

- TJ님/그로스팀이 무엇을 확인해야 하는지 오해가 줄어든다.

단점:

- API 보완 없이 문구만 바꾸면 실제 미맵핑 수는 줄지 않는다.

추천:

- 후보 A와 함께 적용. 추천 강도 90%.

## 검증 계획

### 로컬 API smoke

성공 기준:

- `GET /api/ads/meta-utm-diagnostics`가 HTTP 200을 반환한다.
- 기존 ready/blocked/unmapped row가 누락되지 않는다.
- `meta_biocom_acid_reel_260504` 수동 evidence row가 다시 unmapped로 떨어지지 않는다.
- `sampleUrl` 또는 `sampleTags`가 새로 채워지는 row 수를 before/after로 기록한다.

### 타입/테스트

성공 기준:

- `npm run typecheck` in `backend` 통과
- `npx tsc --noEmit` in `frontend` 통과
- 필요 시 `backend/tests/ads.test.ts`에 expanded creative evidence fixture 추가

### 프론트 smoke

성공 기준:

- `/ads/meta-utm`에서 “TJ님 확인 후보”가 최근 7일 지출 있는 row만 기준으로 표시된다.
- “API evidence 없음”과 “UTM 없음” 문구가 분리된다.
- sample URL이 있는 row는 evidence source가 보인다.

## 이번 문서 기준 권장 다음 실행

1. 후보 A와 후보 D를 로컬 패치로 먼저 적용한다.
2. local API smoke로 34개 후보 중 몇 개가 줄었는지 확인한다.
3. 그래도 남은 후보만 후보 B의 creative direct probe 대상으로 삼는다.
4. VM Cloud 반영은 TJ님이 별도 승인할 때만 진행한다.

## 남은 리스크

- Meta API rate limit이 계속되면 live refresh 검증이 늦어질 수 있다.
- partnership 광고, 기존 게시물 홍보, Instagram 프로필/게시물 기반 광고는 expanded field로도 최종 랜딩 URL이 안 나올 수 있다.
- UTM 관리 파일 alias는 실제 라이브 광고 URL 증거가 아니므로 자동 확정에 쓰면 오분류 위험이 있다.
- Meta 구매값은 광고 플랫폼 주장값이고, 내부 confirmed ROAS는 결제완료 원장 기준이다. 예산 판단에는 내부 confirmed ROAS 또는 확정 매칭된 Att ROAS를 우선해야 한다.
