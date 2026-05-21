# 더클린커피 Google Ads 랜딩 파라미터 점검

## 질문

더클린커피에서 Google Ads 유입이 실제로 VM Cloud에 Google 유료 유입으로 식별되고 있는가?

## 점검한 source

VM Cloud SQLite read-only로 확인했다.

- `site_landing_ledger`: 사이트 첫 유입/랜딩 수집 원장
- `attribution_ledger`: checkout/payment/purchase 등 attribution 이벤트 원장
- `paid_click_intent_ledger`: 유료 클릭 intent 수집 원장

## 결과

### site_landing_ledger 최근 7일

| metric | value |
|---|---:|
| landing rows | 712 |
| safe sessions | 712 |
| Google click ID rows | 0 |
| Google query marker rows | 0 |
| Google text marker rows | 0 |
| Google paid UTM rows | 0 |
| latest received_at | 2026-05-20T04:22:14.085Z |

### attribution_ledger 최근 30일

| metric | value |
|---|---:|
| attribution rows | 2,271 |
| safe sessions | 1,387 |
| direct gclid rows | 0 |
| landing query Google rows | 0 |
| metadata gclid rows | 0 |
| metadata braid rows | 0 |
| Google paid UTM rows | 0 |
| latest logged_at | 2026-05-20T04:22:14.081Z |

### paid_click_intent_ledger 최근 30일

| metric | value |
|---|---:|
| paid click rows | 0 |
| latest received_at | 없음 |

## 최근 7일 site_landing source 분포

| channel_classified | source_breakdown | rows |
|---|---|---:|
| self_internal | thecleancoffee.com | 415 |
| paid_search | kakao | 193 |
| organic_search | orders.pay.naver.com | 24 |
| organic_search | m.search.naver.com | 23 |
| organic_search | shopping.naver.com | 16 |
| paid_social | meta | 12 |
| organic_social | ig | 10 |
| organic_search | pay.naver.com | 9 |

## 해석

더클린커피는 VM Cloud 기준으로 Google Ads 랜딩 파라미터가 아직 잡히지 않는다.

가능한 원인은 네 가지다.

1. 최근 window에 Google Ads 클릭 유입 자체가 없었다.
2. Google Ads 최종 URL이나 추적 템플릿에 `gclid`, `gbraid`, `wbraid`, `gad_source`, `utm_source=google&utm_medium=cpc`가 없다.
3. 광고 클릭 후 리다이렉트 과정에서 파라미터가 지워진다.
4. 더클린커피 Google Ads 랜딩 경로에서 VM Cloud landing capture가 실행되지 않는다.

## 다음 확인

Google Ads 계정 read-only로 아래를 확인해야 한다.

- 더클린커피 캠페인/광고그룹/광고 최종 URL
- 계정 자동 태그 추가 설정
- tracking template / final URL suffix
- 실제 광고 클릭 URL에 `gclid` 또는 UTM이 붙는지
- 랜딩 후 주소창에 파라미터가 남는지
