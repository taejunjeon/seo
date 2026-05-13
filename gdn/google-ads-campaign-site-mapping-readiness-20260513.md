# Google Ads Campaign Site Mapping Readiness

작성 시각: 2026-05-13 18:55:11 KST
Lane: Green read-only.

## 10초 요약

Google Ads last_30d campaign list에서는 thecleancoffee 전용 spend marker가 보이지 않는다. 따라서 coffee actual은 내부 참고 매출 line으로 유지하고, biocom Google Ads 예산 판단 ROAS에 자동 가산하지 않는 현재 정책이 맞다.

## 확인 결과

| inferred site | campaigns | cost | cost share |
|---|---:|---:|---:|
| biocom | 6 | 22,055,511원 | 100% |

## 결론

- 판정: `coffee_actual_reference_only_continue`.
- 이유: 캠페인 이름과 Google Ads dashboard source가 biocom 중심이고 coffee campaign/site marker가 없다.
- coffee actual source: VM Cloud SQLite `imweb_orders(site='thecleancoffee', pay_type='npay')`.
- coffee latest: 315건 / 15,477,100원, status blank 32건 / 1,983,600원.

## 100% 조건

coffee actual을 site-specific budget ROAS에 넣으려면 spend의 95% 이상이 campaign name, landing URL, UTM site marker, campaign_id exact map 중 하나로 biocom/thecleancoffee에 분리되어야 한다.

산출 JSON: `data/project/google-ads-campaign-site-mapping-readiness-20260513.json`
