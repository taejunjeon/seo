# TikTok Campaign ID Exact UTM Rule

작성 시각: 2026-05-13 19:10 KST  
Owner: Codex  
Lane: Green design. 실제 TikTok 광고 URL 변경은 Yellow/Red 승인 필요.  
Do not use for: TikTok 광고 ON/OFF, TikTok Ads API write, TikTok Events API send, GTM publish, 운영DB write/import

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/sprint3.md
    - data/project/tiktok-spend-quality-join-20260513.json
    - gdn/tiktok-spend-quality-join-20260513.md
    - gdn/site-landing-fanout-utm-parse-audit-20260511.md
  lane: Green UTM rule design
  allowed_actions:
    - current TikTok spend-quality evidence review
    - UTM naming rule 설계
    - GA4 BigQuery verification query 설계
    - approval packet 작성
  forbidden_actions:
    - TikTok Ads API write
    - TikTok campaign/budget change
    - TikTok Events API send
    - GTM publish
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
  source_window_freshness_confidence:
    source: "local TikTok API export CSV + GA4 BigQuery channel funnel dry-run"
    window: "TikTok export 2026-05-07~2026-05-12, GA4 latest through 2026-05-12"
    freshness: "spend-quality join generated 2026-05-13 18:55 KST"
    confidence: 0.82
```

## 10초 요약

TikTok은 최근 6일 기준 광고비와 GA4 paid_tiktok 품질을 의미상으로는 붙였지만, GA4에 TikTok `campaign_id`가 exact로 남지 않아 캠페인별 예산 판단이 약하다. 해결책은 TikTok 광고 landing URL에 사람이 읽는 `utm_campaign`과 숫자 exact key인 `utm_id`, `tt_campaign_id`를 같이 심는 것이다. 실제 광고 URL 변경은 광고 운영 설정 변경이므로 승인 전 실행하지 않는다.

## 지금 문제

현재 join은 `semantic_matched`다.

예:

- TikTok API campaign `음과검 스마트+ 캠페인` → GA4 campaign_hint `tiktok_biocom_yeonddle_iggacidset`
- TikTok API campaign `종합대사기능 분석 스마트+캠페인` → GA4 campaign_hint `tiktok_biocom_yeonddle_acid`, `tiktok_biocom_acidcam_acid`
- TikTok API campaign `영양중금속분석 스마트+ 캠페인` → GA4 campaign_hint `tiktok_biocom_mineralcam_mineral`

이 방식은 방향 판단에는 쓸 수 있지만, campaign/day exact budget 판단에는 약하다. 이유는 GA4 BigQuery에 TikTok campaign id가 명시적으로 들어오지 않기 때문이다.

## 목표

TikTok Ads Manager의 campaign/day spend와 GA4 BigQuery session/purchase quality를 같은 key로 붙인다.

100% 조건:

1. TikTok API `campaign_id`가 GA4 BigQuery raw event에서 `utm_id` 또는 `tt_campaign_id`로 보인다.
2. `utm_campaign`은 사람이 읽는 campaign slug로 유지된다.
3. `ttclid`가 있으면 TikTok click evidence로 함께 보존된다.
4. GA4 7일 검증에서 active spend campaign의 exact coverage가 95% 이상이다.
5. 예산 판단 문서에서 `semantic_join`과 `exact_join`을 분리해서 표시한다.

## URL 규칙

### 필수 파라미터

```text
utm_source=tiktok
utm_medium=paid_social
utm_campaign=<human_readable_campaign_slug>
utm_id=<tiktok_campaign_id>
tt_campaign_id=<tiktok_campaign_id>
tt_adgroup_id=<tiktok_adgroup_id_if_available>
tt_ad_id=<tiktok_ad_id_if_available>
utm_content=<creative_or_ad_slug_if_available>
```

`utm_id`는 GA4와 여러 도구가 campaign id 성격으로 인식하기 쉬운 표준형 보조 key다. `tt_campaign_id`는 TikTok 전용 exact key다. 둘 다 같은 campaign id를 담아 이중 안정성을 둔다.

### 권장 campaign slug

형식:

```text
tiktok_<site>_<product_family>_<offer_or_angle>_<objective>
```

예:

```text
tiktok_biocom_yeonddle_iggacidset_smart
tiktok_biocom_yeonddle_acid_smart
tiktok_biocom_mineral_mineralcam_smart
```

규칙:

- 영문 소문자, 숫자, `_`만 쓴다.
- 띄어쓰기, 한글, 특수문자는 URL slug에 쓰지 않는다.
- campaign name이 바뀌어도 `utm_id`는 campaign id 그대로 유지한다.
- 광고 소재가 바뀌면 `utm_content`만 바꾸고 `utm_campaign`은 함부로 바꾸지 않는다.

## 예시 URL

현재 TikTok API export active campaign 기준으로 만들면 아래처럼 된다.

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=tiktok_biocom_yeonddle_iggacidset_smart&utm_id=1854347729644690&tt_campaign_id=1854347729644690
```

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=tiktok_biocom_yeonddle_acid_smart&utm_id=1854918885396689&tt_campaign_id=1854918885396689
```

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=tiktok_biocom_mineral_mineralcam_smart&utm_id=1856156648605858&tt_campaign_id=1856156648605858
```

주의:

- 위 URL은 설계 예시다. 실제 TikTok Ads Manager에 적용하지 않았다.
- TikTok 동적 매크로가 계정에서 지원되면 static id 대신 TikTok macro를 쓸 수 있다. 다만 macro 이름은 Ads Manager 화면에서 실제 지원 여부를 확인해야 한다.
- `ttclid`는 TikTok이 클릭 시 자동으로 붙이는 click id다. 수동으로 임의 값을 넣지 않는다.

## BigQuery 검증 쿼리 설계

적용 후 24h/72h/7d에 GA4 BigQuery에서 아래를 확인한다.

```sql
WITH base AS (
  SELECT
    event_date,
    user_pseudo_id,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_id'), '') AS utm_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'tt_campaign_id'), '') AS tt_campaign_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'tt_adgroup_id'), '') AS tt_adgroup_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'tt_ad_id'), '') AS tt_ad_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '') AS page_location
  FROM `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '<start_yyyymmdd>' AND '<end_yyyymmdd>'
)
SELECT
  COALESCE(NULLIF(tt_campaign_id, ''), NULLIF(utm_id, ''), 'missing') AS exact_campaign_id,
  ANY_VALUE(utm_campaign) AS sample_utm_campaign,
  COUNT(DISTINCT CONCAT(user_pseudo_id, '.', ga_session_id)) AS sessions,
  COUNTIF(tt_campaign_id != '' OR utm_id != '') AS rows_with_exact_id,
  COUNT(*) AS rows
FROM base
WHERE LOWER(utm_source) = 'tiktok'
   OR LOWER(page_location) LIKE '%ttclid=%'
   OR LOWER(page_location) LIKE '%tt_campaign_id=%'
GROUP BY exact_campaign_id
ORDER BY sessions DESC;
```

## 기대 결과

적용 전:

- active spend campaign은 semantic join만 가능하다.
- 예산 판단은 HOLD다.

적용 후:

- TikTok API `campaign_id`와 GA4 `tt_campaign_id` 또는 `utm_id`가 exact join된다.
- campaign/day별 spend, clicks, sessions, scroll90, checkout, purchase를 같은 key로 볼 수 있다.
- 그래도 GA4 purchase는 actual purchase 정본이 아니다. 최종 ROAS는 내부 confirmed order와 다시 연결해야 한다.

## 승인 범위

이 설계를 실제 적용하려면 TJ님 또는 광고 운영자가 TikTok Ads Manager에서 landing URL 또는 URL parameter template을 바꿔야 한다.

승인 시 허용:

1. TikTok Ads Manager에서 위 필수 UTM 파라미터를 landing URL에 추가한다.
2. 기존 광고를 대량 수정하지 않고 active campaign 1~3개부터 적용한다.
3. 적용 후 24h/72h/7d GA4 BigQuery read-only 검증을 한다.

금지:

- TikTok 예산 변경.
- TikTok 광고 ON/OFF 변경.
- TikTok Events API send.
- GA4/Meta/Google Ads/Naver conversion send.
- GTM publish.
- 운영DB write/import.

## Stop Criteria

- 랜딩 URL이 깨진다.
- GA4 BigQuery에서 `utm_source=tiktok` 유입이 사라진다.
- `utm_source`, `utm_medium`, `utm_campaign`이 모두 같은 값으로 들어오는 Google Ads식 오류가 재발한다.
- active campaign exact coverage가 7일 후에도 50% 미만이다.
- `ttclid`가 줄어든다.

## TJ님이 실제로 볼 화면

화면: TikTok Ads Manager → Campaign → Ad 또는 Ad group → Destination URL / URL parameters.

바꾸는 설정 이름:

- Destination URL
- URL Parameters
- Tracking parameters

바꾸면 생기는 효과:

- GA4와 내부 장부에서 TikTok campaign id를 exact로 볼 수 있다.
- TikTok 광고를 껐을 때 줄어든 매출이 어느 campaign에서 온 것인지 더 정확히 비교할 수 있다.

안 바꾸면 남는 문제:

- 지금처럼 campaign name 의미상 매칭만 가능하다.
- TikTok이 효과 있었는지, 특정 캠페인이 나빴는지, 추적이 빠진 것인지 분해가 약하다.

## 추천

- 추천: 조건부 진행.
- 먼저 1~3개 active campaign에만 적용하고 24h/72h/7d 검증한다.
- 추천 점수/자신감: 80%.
