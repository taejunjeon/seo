작성 시각: 2026-05-25 06:58 KST
기준일: 2026-05-25
문서 성격: Meta 남은 미매칭 GA4/Meta API read-only 추가 추적 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only
    - ga4_bigquery_read_only
    - meta_ads_api_read_only_url_inventory
    - documentation
  forbidden_actions:
    - operating_db_write
    - vm_cloud_deploy_or_restart
    - platform_send
    - meta_ads_mutation
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery + Meta Ads API
    window: VM orders 2026-05-18~2026-05-24 KST, GA4 events 2026-05-11~2026-05-24
    site: biocom
    confidence: A for read-only query execution, B for GA4 session attribution interpretation
```

## 10초 요약

남은 Meta 미매칭 14건을 GA4 BigQuery 세션으로 역추적했지만, 캠페인·세트·소재 숫자 ID는 복구되지 않았다.

Meta Ads API URL inventory는 최신 광고 URL 단서 자체는 다시 읽었지만, 남은 주문이 결제 페이지 안의 fbclid/cookie-only 상태라 광고 URL inventory와 직접 조인할 landing/ad id가 없다.

따라서 과거 14건은 D급 quarantine 유지가 맞고, 앞으로 줄이려면 결제 전 마지막 유료 유입을 `firstPaidTouch`로 고정 저장해야 한다.

## GA4 BigQuery 결과

GA4 BigQuery export 자체는 비어 있지 않았다. 2026-05-18~2026-05-23 current dataset 기준 이벤트 394,834건, 세션 74,589개, purchase 이벤트 332건이 있었고, joinable 이벤트도 394,834건이었다. 다만 2026-05-24 table은 아직 export에 없었다.

남은 14건 중 2026-05-19~2026-05-23 구간은 11건 4,111,200원이고, 이 구간은 GA4에 이미 당일 행동 기록이 들어와 있어 실제로 역추적했다.

반대로 2026-05-24 구간 3건 927,000원은 결제완료 원장에는 이미 보이지만, GA4 BigQuery에는 아직 2026-05-24 행동 기록 파일이 올라오지 않았다. 쉽게 말하면 결제 영수증은 있는데, 고객이 광고를 클릭하고 어떤 페이지를 거쳐 결제했는지 보는 CCTV 영상이 아직 2026-05-23까지만 도착한 상태다. 그래서 지금은 이 3건을 "Meta 매칭 불가"로 최종 확정하기보다, 2026-05-24 GA4 기록이 들어온 뒤 한 번 더 확인해야 한다.

남은 14건은 VM Cloud 원장 안에 `clientId`, `userPseudoId`, `gaSessionId` 후보가 모두 있었다. 이 중 BigQuery export가 존재하는 11건은 `client/user + ga_session_id` 조합으로 GA4 BigQuery 세션과 붙지 않았다.

```json
{
  "blank_utm_fbclid_only": {
    "orders": 13,
    "revenue": 4579200,
    "ga4Joined": 0,
    "anyUtmCampaign": 0,
    "anyNumericCampaign": 0,
    "anyNumericAdset": 0,
    "anyNumericAd": 0,
    "anyNonPaymentLanding": 0,
    "anyMetaTrafficSource": 0,
    "pageClassCounts": {},
    "referrerClassCounts": {}
  },
  "macro_placeholder_one": {
    "orders": 1,
    "revenue": 459000,
    "ga4Joined": 0,
    "anyUtmCampaign": 0,
    "anyNumericCampaign": 0,
    "anyNumericAdset": 0,
    "anyNumericAd": 0,
    "anyNonPaymentLanding": 0,
    "anyMetaTrafficSource": 0,
    "pageClassCounts": {},
    "referrerClassCounts": {}
  }
}
```

## GA4 ga_session_id-only 보조 진단

아래 값은 고객 ID와 세션 ID가 함께 맞는 확정 조인이 아니라, 세션 ID만으로 BigQuery 후보가 있는지 본 보조 진단이다. 후보가 여러 개이면 캠페인 매핑 근거로 쓰지 않는다.

결과는 세션 ID만으로도 0건이었다. 즉 GA4 행동 기록이 이미 들어온 11건은 GA4 BigQuery에서도 결제 전 페이지 흐름을 복원할 수 없는 상태다. 2026-05-24 3건은 아직 행동 기록 파일이 도착하지 않았기 때문에, 파일이 도착한 뒤 같은 방식으로 다시 확인해야 한다.

```json
{
  "blank_utm_fbclid_only": {
    "orders": 13,
    "revenue": 4579200,
    "matchedSessionIdKeys": 0,
    "uniqueSessionIdKeys": 0,
    "ambiguousSessionIdKeys": 0,
    "candidateSessionsTotal": 0,
    "maxCandidateSessions": 0,
    "anyUtmCampaign": 0,
    "anyNumericCampaign": 0,
    "anyNumericAdset": 0,
    "anyNumericAd": 0,
    "anyNonPaymentLanding": 0,
    "anyMetaTrafficSource": 0
  },
  "macro_placeholder_one": {
    "orders": 1,
    "revenue": 459000,
    "matchedSessionIdKeys": 0,
    "uniqueSessionIdKeys": 0,
    "ambiguousSessionIdKeys": 0,
    "candidateSessionsTotal": 0,
    "maxCandidateSessions": 0,
    "anyUtmCampaign": 0,
    "anyNumericCampaign": 0,
    "anyNumericAdset": 0,
    "anyNumericAd": 0,
    "anyNonPaymentLanding": 0,
    "anyMetaTrafficSource": 0
  }
}
```

## Meta Ads API URL Inventory 결과

같은 턴의 첫 Meta Ads API read-only 재조회는 성공했다. 즉시 재시도는 광고 계정 rate limit에 걸려 아래 생성 JSON에는 skip/rate-limit 상태가 남아 있다.

첫 재조회에서 확인한 핵심은 아래와 같다.

- 조회 범위: `act_3138805896402376 /ads` creative URL fields read-only
- API가 반환한 광고 수: 1,000건. 계정 캐시상 ads raw count는 1,012건이라 최대 12건은 상한 때문에 빠졌을 수 있다.
- ACTIVE 광고: 51건
- URL evidence가 있는 ACTIVE 광고: 51건
- URL 안에 숫자 campaign/adset/ad ID 3종이 모두 들어간 광고: 0건
- URL 안에 Meta dynamic macro가 그대로 있는 ACTIVE 광고: 24건
- `meta_` alias가 있는 ACTIVE 광고: 39건
- landing path가 있는 ACTIVE 광고: 51건
- 주요 path 단서: `/igg_store/` 17건, `/ads/image/` 16건, `/shop_view` 계열 12건, `/organicacid_store/` 3건, `/iiary02` 1건
- `meta_biocom_influencer_260506`: ACTIVE 광고 4건, macro 4건, alias 4건, 숫자 full ID 0건
- `meta_biocom_igg_260504`: ACTIVE 광고 4건, macro 4건, alias 4건, 숫자 full ID 0건
- `meta_biocom_acid_260504`: ACTIVE 광고 5건, macro 4건, alias 5건, 숫자 full ID 0건

해석은 명확하다. 현재 운용 광고 URL에는 alias/landing path 단서는 꽤 있지만, 숫자 campaign/adset/ad ID가 URL에 박혀 있는 구조는 아니다. 따라서 주문 쪽 원장에 landing path나 alias가 남아야 B/C급 후보라도 만들 수 있는데, 남은 14건은 그 주문 쪽 단서가 없다.

```json
{
  "ok": false,
  "skipped": true,
  "reason": "SKIP_META_API=1; previous same-turn requery already hit/saturated Meta API quota"
}
```

## 해석

- GA4에서 세션이 조인되어도 숫자 campaign/adset/ad ID가 없으면 A급 매칭으로 승격할 수 없다.
- Meta URL inventory는 광고 소재 쪽 URL 보완 상태를 보는 장부다. 주문 쪽에 landing/ad id가 없으면 양쪽을 결정적으로 붙일 수 없다.
- `fbclid/fbc/fbp`는 Meta 클릭/쿠키 흔적이지 캠페인 ID가 아니다.

## firstPaidTouch 설명

`firstPaidTouch`는 고객이 결제 페이지로 들어가기 전에 마지막으로 확인된 유료 유입 단서를 별도 칸에 고정해두자는 뜻이다.

현재 문제는 고객이 결제완료 시점에는 `/shop_payment` 안에 있고, 그 시점의 URL에는 UTM이나 landing path가 사라진다는 점이다. 이 상태에서 결제완료 신호만 보면 `fbclid/fbc/fbp` 같은 Meta 클릭 흔적은 남지만, 어느 캠페인·광고세트·소재였는지는 복구할 수 없다.

따라서 앞으로는 고객이 광고 URL로 처음 들어왔거나, 결제 전 상품/랜딩 페이지에서 유료 유입 UTM이 보이는 순간 아래 값을 저장해야 한다.

- 저장할 값: source, medium, campaign, term, content, campaign/adset/ad 숫자 ID가 있으면 그 ID, campaign_alias, landing path, referrer host, click id 종류, 저장 시각, confidence
- 저장 위치: 브라우저 저장소와 VM Cloud 유입 장부 둘 다. 결제완료 이벤트가 발생하면 이 값을 payment_success metadata에도 복사한다.
- 덮어쓰기 원칙: 빈 UTM이나 `/shop_payment` 값으로는 덮어쓰지 않는다. 더 늦게 들어온 명확한 유료 유입이 있을 때만 갱신한다.
- 보고 등급: 숫자 ID가 있으면 A급, 고유 alias면 B급, landing path/광고명 후보면 C급, `fbclid`만 있으면 D급으로 둔다.

이름은 `firstPaidTouch`보다 `lastPaidTouchBeforeCheckout`가 더 정확하다. 다만 구현에서는 기존 “first touch”와 헷갈리지 않게 `paidTouchBeforeCheckout` 같은 이름을 쓰는 편이 낫다.

이 장치를 넣으면 과거 14건을 되살리는 것이 아니라, 앞으로 같은 유형의 주문이 D급으로 떨어지는 것을 막는다.
