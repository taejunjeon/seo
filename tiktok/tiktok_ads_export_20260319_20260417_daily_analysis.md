# TikTok Ads 일별 CSV 분석 — 2026-03-19 ~ 2026-04-17

작성 시각: 2026-04-18 14:53 KST

## 결론

TJ님이 내려받은 `Tiktok Ads_date_주바이오컴_adv_20260319-20260417.csv`는 ROAS 정합성 프로젝트에서 필요하던 **일별 export**가 맞다.

- 첫 번째 컬럼: `일별`
- 실제 날짜 행: 285행
- 총계 행: 1행 (`총 285개 결과`)
- 기간: 2026-03-19 ~ 2026-04-17
- 고유 날짜: 30일
- 고유 캠페인: 5개
- 고유 광고: 10개
- 표준 캠페인×일자 집계 행: 147행

이번 파일은 `일별 + 캠페인 + 광고그룹 + 광고` 단위다. 로컬 `tiktok_ads_daily` 테이블은 캠페인×일자 기준이므로 광고 행을 `report_date + campaign_id + campaign_name`으로 합산해서 적재했다.

## 보관 및 처리 파일

| 구분 | 경로 |
|---|---|
| 원본 보관 | `data/ads_csv/tiktok/raw/20260319_20260417_daily_ad_report.csv` |
| 원본 정규화 사본 | `data/ads_csv/tiktok/processed/20260319_20260417_daily_ad_report_raw.csv` |
| 광고×일자 표준 CSV | `data/ads_csv/tiktok/processed/20260319_20260417_daily_ad.csv` |
| 캠페인×일자 표준 CSV | `data/ads_csv/tiktok/processed/20260319_20260417_daily_campaign.csv` |
| 요약 JSON | `data/ads_csv/tiktok/processed/20260319_20260417_daily_campaign_summary.json` |

## 합계 검증

| 지표 | 값 |
|---|---:|
| 비용 | 28,363,230원 |
| 노출수 | 13,262,333 |
| 클릭수(목적지) | 365,991 |
| 전환수 | 321 |
| 구매수 | 321 |
| 구매값 | 910,630,953원 |
| 플랫폼 ROAS | 32.106038 |
| VTA 구매수(웹사이트) | 90 |
| CTA 구매수(웹사이트) | 189 |
| EVTA 구매수(웹사이트) | 42 |
| VTA 구매 금액(웹사이트) | 13,825,423원 |
| CTA 구매 금액(웹사이트) | 886,614,137원 |

합계는 기존 `20260319_20260417_campaign_summary.csv`의 기간 합계와 일치한다.

## 캠페인별 합계

| 캠페인 | 일수 | 광고×일자 행 | 비용 | 구매수 | 구매값 | ROAS |
|---|---:|---:|---:|---:|---:|---:|
| 음과검 스마트+ 캠페인 | 30 | 60 | 14,143,071 | 143 | 746,835,717 | 52.805767 |
| 종합대사기능 분석 스마트+캠페인 | 30 | 60 | 8,222,937 | 75 | 126,692,609 | 15.407221 |
| 건강기능식품 스마트+캠페인 | 30 | 87 | 2,999,202 | 62 | 23,091,112 | 7.699085 |
| 영양중금속분석 스마트+ 캠페인 | 30 | 30 | 2,998,020 | 41 | 14,011,515 | 4.673590 |
| 호르몬 검사 캠페인 | 27 | 48 | 0 | 0 | 0 | - |

## 컬럼 해석

한국어 export에는 `총 구매 수(모든 채널)` 헤더가 2번 나온다.

- 첫 번째 `총 구매 수(모든 채널)`: 구매수로 사용
- 두 번째 `총 구매 수(모든 채널)__2`: 구매값으로 사용

근거는 두 번째 값이 `구매 ROAS(모든 채널)` 및 기존 기간 합계 CSV의 추정 구매값과 일치한다는 점이다.

EVTA는 `EVTA 구매 수(웹사이트)`와 `EVTA 구매당 비용(웹사이트)`만 있고, `EVTA 구매 금액/ROAS` 컬럼은 없었다. 그래서 `evta_purchase_value`, `evta_purchase_roas`는 0으로 표준화했다.

## 로컬 적재 결과

`GET /api/ads/tiktok/roas-comparison?start_date=2026-03-19&end_date=2026-04-17` 호출 시 `processed/*_daily_campaign.csv`가 자동 import된다.

| 항목 | 결과 |
|---|---:|
| `tiktok_ads_daily` rows | 147 |
| minDate | 2026-03-19 |
| maxDate | 2026-04-17 |
| spend 합계 | 28,363,230원 |
| purchase_count 합계 | 321 |
| purchase_value 합계 | 910,630,953원 |
| ROAS | 32.106038 |

## 검증

| 검증 | 결과 |
|---|---|
| Backend typecheck | 통과: `npm run typecheck` |
| Targeted frontend lint | 통과: `npx eslint src/app/ads/tiktok/page.tsx` |
| API 확인 | 통과. `daily.rows=147`, `daily.importedRows=147` |
| SQLite 확인 | 통과. `tiktok_ads_daily` 합계가 처리 JSON과 일치 |
| 브라우저 확인 | 시스템 Chrome으로 `http://localhost:7010/ads/tiktok` 접속. `tiktok_ads_daily`, `현재 행은 147개`, `이번 호출 upsert는 147행` 노출 확인 |

## 다음 작업

1. 일별 내부 운영 원장과 `tiktok_ads_daily`를 날짜 단위로 조인한다.
2. Guard 적용일인 2026-04-17 전후를 나눠 플랫폼 구매값, 내부 confirmed, 내부 pending을 비교한다.
3. `/ads/tiktok`에 일자별 시계열과 pending 포함/제외 토글을 추가한다.
4. Ads Manager 화면 총합과 이 처리 결과를 한 번 더 대조한다. 특히 중복 `총 구매 수(모든 채널)` 헤더의 두 번째 값이 구매값으로 표시되는지 확인한다.
