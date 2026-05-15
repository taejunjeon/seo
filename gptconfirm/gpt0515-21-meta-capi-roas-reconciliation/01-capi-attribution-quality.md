# 01. CAPI attribution quality

## 사람이 이해하는 결론

바이오컴 서버 전환 API(CAPI)는 Meta가 정상 수신하고 있다. 최근 7일 기준 실패 0, duplicate event_id 0이고, `fbp`와 IP/User-Agent는 거의 전부 붙어 있다. 다만 `fbc/fbclid`는 30-40%대라 “Meta 광고 클릭과 강하게 이어지는 주문”은 전체 CAPI보다 작다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| primary source | VM Cloud `meta-capi-sends.jsonl` |
| cross-check | VM Cloud `attribution_ledger`, live `funnel-health` API |
| site | biocom |
| target Pixel | `1283400029487161` |
| checked_at | 2026-05-15 17:04 KST |
| confidence | medium_high |
| raw identifier output | 0 |

## Target Pixel 기준

| window | attempts | events_received=1 | failed | duplicate_event_id | duplicate_order_key |
|---|---:|---:|---:|---:|---:|
| 최근 24시간 | 52 | 52 | 0 | 0 | 0 |
| 최근 7일 | 353 | 353 | 0 | 0 | 0 |

## Match quality proxy

| field | 최근 24시간 | 최근 7일 | 해석 |
|---|---:|---:|---|
| fbp | 100.0% | 98.6% | Meta 사용자 쿠키는 거의 붙음 |
| fbc resolvable | 36.5% | 41.9% | Meta 광고 클릭 쿠키는 일부만 강하게 연결 |
| fbclid | 30.8% | 33.1% | URL 클릭 ID 기준 Meta evidence |
| IP | 100.0% | 100.0% | CAPI user_data 기본 match 신호 |
| User-Agent | 100.0% | 100.0% | CAPI user_data 기본 match 신호 |
| value/currency | 100.0% | 100.0% | 금액은 모두 양수, currency는 코드상 KRW |
| external_id | 0.0% | 0.0% | 현재 CAPI builder는 external_id를 핵심 match key로 쓰지 않음 |

## User data quality proxy

| window | strong | medium | weak | medium 이상 |
|---|---:|---:|---:|---:|
| 최근 24시간 | 19 | 33 | 0 | 100.0% |
| 최근 7일 | 148 | 200 | 5 | 98.6% |

정의:
- strong: fbc + fbp + IP/User-Agent가 같이 있음.
- medium: fbc 또는 fbclid가 있거나, fbp + IP/User-Agent가 있음.
- weak: Meta evidence가 거의 없음.

## Event time delay

| window | p50 | p95 | sample |
|---|---:|---:|---:|
| 최근 24시간 | 108.0분 | 417.6분 | 52 |
| 최근 7일 | 31.5분 | 216.7분 | 353 |

해석:
- CAPI 전송 자체는 성공한다.
- 다만 2026-05-14 사고/복구 구간의 manual/API sync 영향으로 최근 24시간 p95 지연이 크다.
- 앞으로는 fast decision + auto_sync 안정화 후 p50/p95가 줄어야 한다.

## All-pixel dashboard mismatch

Live `/total` 계열 API의 `meta_capi_success`는 현재 site별 Pixel 필터가 충분하지 않다.

| window | 바이오컴 Pixel | 더클린커피 Pixel | 합계 |
|---|---:|---:|---:|
| 최근 24시간 | 52 | 31 | 83 |
| 오늘 KST | 42 | 26 | 68 |
| 최근 7일 | 353 | 298 | 651 |

따라서 `/total`에서 바이오컴 CAPI success가 651로 보이면, 그것은 바이오컴 단독이 아니라 더클린커피가 섞인 값이다.

## 판정

- `B. CAPI_RECEIVED_BUT_LOW_MATCH_QUALITY`: NO. match quality가 낮다고 볼 정도는 아니다.
- 단, fbc/fbclid가 30-40%대라 Meta 광고 클릭 기반 귀속은 CAPI 전체보다 작게 잡히는 것이 정상이다.
- external_id 0은 개선 여지다. 하지만 개인정보/해시 정책이 필요하므로 즉시 운영 반영할 항목은 아니다.
