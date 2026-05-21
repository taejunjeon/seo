# gpt0515-30 Leading Indicators google_paid Live API 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - frontrule.md
  project_harness_read: []
  required_context_docs:
    - data/!data_inventory.md
  lane: Yellow deploy + Green read-only audit
  allowed_actions:
    - backend scoped code patch
    - VM Cloud backend build/restart
    - VM Cloud SQLite read-only audit
    - API smoke test
  forbidden_actions:
    - Google Ads/GA4/Meta send or upload
    - GTM publish
    - operating DB write/import
    - VM Cloud schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud leading-indicators API + VM Cloud SQLite
    window: leadingIndicators 7d; thecleancoffee site_landing 7d; attribution/paid_click 30d
    freshness: 2026-05-20 13:21-13:31 KST
    confidence: high for API availability; medium-high for thecleancoffee Google paid evidence absence
```

## 이번에 가능해진 것

운영 API에서 `channel=google_paid`를 정식 채널로 받을 수 있게 됐다.

이제 프론트엔드나 분석 스크립트가 아래처럼 Google 유료 검색 유입만 따로 요청할 수 있다.

```text
/api/attribution/leading-indicators?site=biocom&window=7d&channel=google_paid&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=google_paid&dimension=buyer_vs_leaver
```

`google_paid` 판정 기준은 Google 클릭 ID(`gclid`, `gbraid`, `wbraid`, `gad_source`) 또는 `utm_source=google/adwords/googleads` + `utm_medium=cpc/paid/ppc/sem/display` 조합이다.

## 운영 API smoke

| site | window | channel | HTTP | safe_sessions | confirmed_buyer | checkout_non_buyer | pending_payment_success | source |
|---|---:|---|---:|---:|---:|---:|---:|---|
| biocom | 7d | google_paid | 200 | 119 | 7 | 98 | 14 | live_cache_miss |
| thecleancoffee | 7d | google_paid | 200 | 0 | 0 | 0 | 0 | live_cache_miss |

현재 `leading-indicators` precompute worker는 운영 환경변수상 OFF라 첫 요청은 live fallback으로 계산된다. API 자체는 정상 응답하지만, 고정 캐시 응답까지 쓰려면 별도 env ON이 필요하다.

## 더클린커피 Google Ads 랜딩 파라미터 점검

VM Cloud 원장 기준으로 최근 7일 더클린커피 `site_landing_ledger`에는 Google Ads 강한 증거가 0건이다.

```text
site_landing_ledger 7d:
- landing rows: 712
- safe sessions: 712
- gclid/gbraid/wbraid/gad_source rows: 0
- google paid UTM rows: 0
```

`attribution_ledger` 최근 30일과 `paid_click_intent_ledger` 최근 30일에서도 더클린커피 Google 유료 클릭 증거는 0건이었다.

이 결과는 “더클린커피에 Google Ads가 없다”는 확정이 아니다. 정확한 해석은 “현재 VM Cloud 수집 원장에는 Google Ads 랜딩 식별자가 들어오지 않는다”이다.

## 하지 않은 것

- Google Ads, GA4, Meta로 이벤트를 새로 보내지 않았다.
- GTM publish를 하지 않았다.
- 운영DB write/import를 하지 않았다.
- VM Cloud schema migration을 하지 않았다.
- 원문 주문/결제/회원/클릭 ID를 문서에 출력하지 않았다.

## 다음 판단

더클린커피 Google 유료 유입을 분석하려면 Google Ads 계정의 최종 URL과 추적 템플릿을 확인해야 한다.

우선순위는 다음 순서가 맞다.

1. Google Ads 최종 URL에 `gclid` 자동 태깅 또는 `utm_source=google&utm_medium=cpc`가 붙는지 확인한다.
2. 광고 클릭 후 리다이렉트 과정에서 파라미터가 지워지는지 확인한다.
3. 더클린커피 사이트 랜딩 수집 코드가 Google Ads 랜딩 경로에서 실행되는지 확인한다.
4. 위 세 가지가 정상인데도 VM Cloud가 못 받으면 site_landing 수집 로직을 보강한다.
