# GA4 Dwell/Scroll Join Dry-run

작성 시각: 2026-05-17 16:23 KST
Lane: Green read-only
대상: biocom / thecleancoffee 분리

## 10초 요약

- GA4는 체류시간과 스크롤을 보는 source이고, VM Cloud는 실제 결제완료와 CAPI 성공을 보는 source다.
- 바이오컴과 더클린커피는 서로 다른 GA4 property/dataset과 VM Cloud site로 분리해 조회했다.
- 지금 단계는 aggregate cross-check다. 같은 고객/주문 단위 join은 safe session bridge가 필요하다.
- source별 구매율처럼 바로 쓰면 안 되는 숫자는 `not_safe_yet`으로 분리했다.

## Site Summary

| site | GA4 window | GA4 sessions | avg dwell sec | scroll50 | GA4 checkout | VM confirmed | VM CAPI | join level |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 바이오컴 | 2026-05-10~2026-05-16 | 58550 | 21.35 | 13.31% | 773 | 388 | 375 | aggregate_cross_check |
| 더클린커피 | 2026-05-10~2026-05-16 | 5017 | 86.48 | 59.52% | 0 | 330 | 328 | aggregate_cross_check |

## 쉬운 설명: 왜 source별 구매율로 바로 쓰면 안 되는가

같은 반 학생 100명 중 시험을 본 사람과 합격한 사람을 비교해야 합격률이 된다.
그런데 지금 일부 source별 화면 숫자는 서로 다른 장부에서 온다.

- GA4 체류시간/스크롤: 세션 기준이다.
- VM Cloud 실제 결제완료: 결제완료 row 기준이다.
- Meta CAPI 성공: Meta로 보낸 send attempt 기준이다.

이 세 숫자는 모두 중요하지만, 같은 사람/같은 주문으로 묶인 분모가 아니다.
그래서 source별로 `Meta 유입 913건 중 CAPI 376건`처럼 나누면 실제 전환율이 아니라 서로 다른 장부를 나눈 값이 된다.
현재 안전한 사용법은 site/source/landing bucket별 행동 차이를 보고, 다음 단계에서 safe session/order bridge로 같은 모집단을 닫는 것이다.

## 이번 dry-run에서 바로 읽을 수 있는 것

- 바이오컴: GA4 기준 7일 세션은 많지만 평균 체류시간은 21.35초다. Meta home_or_other 유입은 세션 수가 크지만 p50 dwell이 0초라 첫 화면 이탈/비활성 세션이 섞였을 가능성이 있다.
- 더클린커피: GA4 기준 7일 평균 체류시간은 86.48초로 바이오컴보다 길다. YouTube/product, Naver paid/home_or_other bucket에서 체류시간이 길게 잡힌다.
- GA4 scroll50과 scroll90이 같은 값으로 나오는 것은 주의가 필요하다. GA4 기본 scroll 이벤트는 보통 90% 도달 시점에 찍히므로, 별도 Scroll50 이벤트가 없으면 실제 50% 도달률이 아니라 `scroll 이벤트가 발생한 세션`에 가깝다.
- VM Cloud 결제완료와 CAPI 성공은 site별로 분리돼 있다. 바이오컴/더클린커피를 섞지 않고 monitoring하는 기준은 유지됐다.

## Source / Landing Bucket Detail

### 바이오컴

| source | landing bucket | sessions | p50 dwell | p75 dwell | scroll50% | checkout | add_payment_info | GA4 purchase event |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| meta | home_or_other | 21972 | 0 | 0 | 15.3% | 195 | 7 | 115 |
| meta | review_or_story | 11331 | 0 | 0 | 1.67% | 20 | 8 | 13 |
| other | home_or_other | 5270 | 0.005 | 6.73 | 25.09% | 28 | 1 | 0 |
| google_paid | home_or_other | 3495 | 4.512 | 19.953 | 7.7% | 14 | 19 | 8 |
| naver_paid_or_brand | home_or_other | 3421 | 2.355 | 47.602 | 16.6% | 135 | 15 | 78 |
| google_paid | content_guide | 2820 | 10.22 | 39.156 | 22.91% | 64 | 276 | 0 |
| meta | product | 2093 | 0 | 0 | 4.92% | 16 | 3 | 10 |
| meta | content_guide | 1633 | 0 | 0 | 4.84% | 7 | 1 | 6 |
| organic | home_or_other | 1305 | 6.574 | 85.011 | 34.25% | 147 | 62 | 100 |
| naver_paid_or_brand | product | 777 | 0.016 | 36.76 | 11.33% | 24 | 1 | 15 |
| naver_other | home_or_other | 688 | 0.002 | 19.971 | 15.12% | 15 | 8 | 11 |
| other | product | 666 | 0.004 | 0.006 | 5.86% | 7 | 0 | 0 |
| google_paid | product | 664 | 6.017 | 29.971 | 22.74% | 4 | 30 | 1 |
| naver_other | product | 653 | 6.786 | 46.776 | 12.1% | 14 | 5 | 7 |
| youtube | content_guide | 318 | 1.051 | 49.563 | 16.98% | 9 | 6 | 6 |
| other | content_guide | 314 | 0.006 | 0.02 | 12.1% | 1 | 0 | 0 |
| organic | product | 297 | 0.015 | 44.194 | 20.54% | 26 | 3 | 18 |
| naver_other | content_guide | 180 | 11.997 | 69.868 | 17.78% | 5 | 1 | 2 |
| naver_paid_or_brand | checkout | 149 | 21.889 | 132.869 | 34.9% | 11 | 5 | 7 |
| organic | content_guide | 137 | 23.012 | 85.726 | 23.36% | 2 | 0 | 1 |

### 더클린커피

| source | landing bucket | sessions | p50 dwell | p75 dwell | scroll50% | checkout | add_payment_info | GA4 purchase event |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| youtube | product | 1427 | 42.856 | 114.858 | 60.55% | 0 | 0 | 110 |
| other | product | 846 | 7.647 | 110.824 | 69.03% | 0 | 0 | 94 |
| meta | review_or_story | 818 | 0.066 | 31.23 | 41.2% | 0 | 0 | 30 |
| other | home_or_other | 623 | 15.736 | 117.024 | 61.96% | 0 | 0 | 65 |
| meta | product | 410 | 0 | 26.958 | 40.24% | 0 | 0 | 12 |
| naver_paid_or_brand | home_or_other | 247 | 119.03 | 244.89 | 88.66% | 0 | 0 | 63 |
| naver_paid_or_brand | checkout | 124 | 51.294 | 161.172 | 62.1% | 0 | 0 | 16 |
| naver_other | home_or_other | 112 | 25.403 | 100.424 | 68.75% | 0 | 0 | 4 |
| meta | home_or_other | 104 | 12.597 | 91.422 | 79.81% | 0 | 0 | 7 |
| organic | home_or_other | 82 | 34.293 | 106.442 | 76.83% | 0 | 0 | 6 |
| youtube | home_or_other | 57 | 0 | 6.2 | 56.14% | 0 | 0 | 4 |
| naver_paid_or_brand | product | 39 | 39.506 | 119.509 | 53.85% | 0 | 0 | 6 |
| naver_other | product | 22 | 66.907 | 244.513 | 81.82% | 0 | 0 | 4 |
| other | cart | 21 | 74.618 | 128.654 | 90.48% | 0 | 0 | 6 |
| other | checkout | 19 | 0 | 4.942 | 21.05% | 0 | 0 | 0 |
| other | review_or_story | 19 | 62.499 | 112.168 | 52.63% | 0 | 0 | 2 |
| naver_other | review_or_story | 10 | 25.013 | 71.637 | 80% | 0 | 0 | 0 |
| youtube | checkout | 10 | 0 | 55.733 | 40% | 0 | 0 | 1 |
| organic | product | 8 | 2.341 | 64.204 | 75% | 0 | 0 | 1 |
| naver_other | cart | 5 | 0 | 0 | 60% | 0 | 0 | 1 |

## 다음 개발 판단

- P0/P1 화면에는 GA4 dwell/scroll과 VM Cloud actual purchase를 분리해서 보여준다.
- Claude Code 프론트에는 `site`, `source`, `landing_bucket`, `freshness`, `confidence`, `join_level`을 필수 필드로 넘긴다.
- Codex 다음 Green 작업은 VM Cloud의 GA4 join key presence aggregate를 만드는 것이다.
- 운영 전송, GTM publish, VM Cloud deploy는 이번 dry-run에서 하지 않았다.
