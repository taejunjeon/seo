# ROAS 화면 범위 정리

## 화면 구분

| 화면 | 성격 | 주요 API | Meta/Google 포함 여부 |
| --- | --- | --- | --- |
| `/ads/tiktok` | TikTok 광고 성과 화면 | `/api/ads/tiktok/roas-comparison` | Meta/Google은 비교 기준으로만 포함 |
| `/ads/roas` | Meta/Ads ROAS 계열 화면 | `/api/ads/roas/daily` | TikTok과 별도 |
| `/ads/google-roas-report` | Google Ads ROAS 화면 | `/api/google-ads/dashboard` | TikTok과 별도 |
| `/ai-crm/conversion-funnel` | 전환 퍼널/ROAS 요약 관제 | `/api/ads/roas-summary`, `/api/attribution/funnel-health` | Meta/Google/CAPI 일부 요약 포함 |
| `/ai-crm/capi-report` | CAPI 개발/운영 보고서 | 여러 CAPI/ROAS 요약 API | Meta CAPI 중심 |

## 현재 혼동 포인트

`TikTok/ROAS 화면`이라는 표현은 두 가지로 들릴 수 있다.

1. TikTok 광고 전용 ROAS 화면
2. TikTok, Meta, Google을 모두 포함한 전체 ROAS 화면

코드 기준으로는 1번이 맞다. `/ads/tiktok` 안에서 Meta와 Google API를 부르지만, 이는 TikTok 성과를 해석하기 위한 비교 기준이다.

## 추천 명칭

프론트엔드와 문서에서는 아래처럼 분리하는 것이 좋다.

- `TikTok 광고 성과 화면`
- `Meta ROAS 화면`
- `Google ROAS 화면`
- `전체 전환 퍼널 관제`

이렇게 나누면 “TikTok 광고가 꺼져 있는데 왜 ROAS 화면이 무겁냐”는 혼동이 줄어든다.

