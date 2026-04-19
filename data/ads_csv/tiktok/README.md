# TikTok Ads CSV Intake

이 폴더는 TikTok Ads Manager에서 내려받은 캠페인 성과 CSV/XLSX를 임시 보관하는 위치다.

## 폴더 구조

```text
raw/        TikTok에서 받은 원본 파일
processed/  분석용으로 변환한 CSV/JSON
```

## 파일명 규칙

```text
YYYYMMDD_YYYYMMDD_campaign.csv
YYYYMMDD_YYYYMMDD_daily_campaign.csv
YYYYMMDD_YYYYMMDD_ad.csv
YYYYMMDD_YYYYMMDD_adgroup.csv
YYYYMMDD_YYYYMMDD_raw.csv
raw/YYYYMMDD_YYYYMMDD_campaign_report.xlsx
raw/YYYYMMDD_YYYYMMDD_daily_campaign_report.xlsx
raw/YYYYMMDD_YYYYMMDD_ad_report.xlsx
processed/YYYYMMDD_YYYYMMDD_campaign_summary.csv
processed/YYYYMMDD_YYYYMMDD_campaign_summary.json
processed/YYYYMMDD_YYYYMMDD_daily_campaign.csv
processed/YYYYMMDD_YYYYMMDD_ad_summary.csv
```

예시:

```text
20260401_20260417_campaign.csv
20260319_20260417_daily_campaign.csv
20260416_20260418_raw.csv
raw/20260401_20260418_campaign_report.xlsx
processed/20260401_20260418_campaign_summary.csv
```

## 현재 수령 파일

| 기간 | 원본 | 처리 결과 | 판정 |
|---|---|---|---|
| 2026-04-01 ~ 2026-04-18 | `raw/20260401_20260418_campaign_report.xlsx` | `processed/20260401_20260418_campaign_summary.csv`, `processed/20260401_20260418_campaign_summary.json` | 캠페인 기간 합계 비용 데이터로만 사용 가능. `date`, 구매 전환값, 어트리뷰션 윈도우 없음 |
| 2026-03-19 ~ 2026-04-17 | `raw/20260319_20260417_campaign_report.xlsx` | `processed/20260319_20260417_campaign_summary.csv`, `processed/20260319_20260417_campaign_summary.json` | 캠페인 기간 합계 기준의 구매수·추정 구매값·ROAS 확인 가능. `date`, 어트리뷰션 윈도우 없음 |
| 2026-03-19 ~ 2026-04-17 | `raw/20260319_20260417_daily_ad_report.csv` | `processed/20260319_20260417_daily_ad.csv`, `processed/20260319_20260417_daily_campaign.csv`, `processed/20260319_20260417_daily_campaign_summary.json` | 일별+광고 단위 export. 캠페인×일자 147행으로 집계해 `tiktok_ads_daily`에 적재 완료 |
| 2026-01-01 ~ 2026-04-17 | `raw/20260101_20260417_ad_report.xlsx` | `processed/20260101_20260417_ad_summary.csv`, `processed/20260101_20260417_ad_summary.json` | 광고별 기간 합계 기준의 구매수·추정 구매값·ROAS 확인 가능. `date` 없음. 소재/광고 ID 단위 원인 분석 보조로만 사용 |

## 일자별 Custom report 계약

API 승인 전 핵심 경로는 Ads Manager Custom report export다. 아래 포맷 1개를 고정한다.

차원:

- `Date`
- `Campaign ID`
- `Campaign name`

지표:

- `Cost`
- `Net cost` 가능하면 포함
- `Impressions`
- `Destination clicks` 또는 `Clicks`
- `Conversions`
- `Purchase count`
- `Purchase value`
- `CTA purchase`
- `EVTA purchase`
- `VTA purchase`
- `CTA purchase ROAS`
- `EVTA purchase ROAS`
- `VTA purchase ROAS`

운영 메모:

- TikTok 기본 attribution window는 프로젝트 기준으로 Click 7일 / View 1일로 둔다.
- Ads Manager 화면에서 다른 window를 설정했다면 export 파일명 옆에 수동 기록하고 `attribution_window_note`에 남긴다.
- Ads Manager scheduled export를 켜면 API 승인 전에도 일일 수집을 반자동화할 수 있다. 메일 첨부 파일은 `raw/`에 원본 그대로 보관한다.
- 일자별 파일만 `tiktok_ads_daily`에 적재한다. 날짜가 없는 기간 합계 파일은 `tiktok_ads_campaign_range`에만 둔다.
- 광고별 기간 합계 파일은 `ad_range_total` 보조 자료로만 둔다. 일자별 ROAS 계산에는 사용하지 않는다.

## Metric dictionary

| 표준 컬럼 | 설명 | 허용 별칭 |
|---|---|---|
| `date` | 보고 일자 | `Date`, `날짜`, `일` |
| `campaign_id` | 캠페인 ID | `Campaign ID`, `캠페인 ID` |
| `campaign_name` | 캠페인명 | `Campaign name`, `Campaign Name`, `캠페인 이름`, `캠페인명` |
| `spend` | 광고비 | `Cost`, `Spend`, `비용`, `광고비` |
| `impressions` | 노출수 | `Impressions`, `노출` |
| `clicks` | 클릭수 | `Clicks`, `클릭` |
| `conversions` | 전환수 | `Conversions`, `전환`, `구매` |
| `purchase_count` | 구매수 | `Purchase count`, `Total purchase count`, `총 구매 수`, `총 구매 수(모든 채널)` |
| `purchase_value` | 구매 전환값 | `Purchase value`, `Total purchase value`, `구매 전환값`, `구매값` |
| `platform_roas` | TikTok Ads Manager ROAS | `ROAS`, `Purchase ROAS`, `구매 ROAS` |
| `cta_purchase_count` | 클릭 후 구매수 | `CTA purchase`, `CTA 구매` |
| `evta_purchase_count` | engaged view-through 구매수 | `EVTA purchase`, `EVTA 구매` |
| `vta_purchase_count` | view-through 구매수 | `VTA purchase`, `VTA 구매` |
| `cta_purchase_roas` | 클릭 후 구매 ROAS | `CTA purchase ROAS`, `CTA 구매 ROAS(웹사이트)` |
| `evta_purchase_roas` | engaged view-through 구매 ROAS | `EVTA purchase ROAS`, `EVTA 구매 ROAS(웹사이트)` |
| `vta_purchase_roas` | view-through 구매 ROAS | `VTA purchase ROAS`, `VTA 구매 ROAS(웹사이트)` |
| `attribution_window` | 보고 기준/어트리뷰션 윈도우 | `Attribution window`, `어트리뷰션 윈도우`, `보고 기준` |

어트리뷰션 윈도우 컬럼이 export에 없으면 TikTok 기본값인 Click 7일 / View 1일을 `attribution_window_note`에 기록한다. 단, Ads Manager에서 별도 설정을 바꾼 흔적이 있으면 화면 설정값을 우선한다.

## 적재 전 검증 규칙

- `date`, `campaign_name`, `spend`는 비어 있으면 안 된다.
- 금액 컬럼은 쉼표, 원화 기호, 공백을 제거한 뒤 숫자로 파싱한다.
- `purchase_value`가 비어 있으면 0으로 처리하되, 원본 누락 경고를 남긴다.
- `platform_roas`가 비어 있으면 `purchase_value / spend`로 재계산한다.
- 같은 `date + campaign_id + campaign_name` 조합이 중복되면 원본 행을 합산하지 말고 먼저 중복 원인을 확인한다.
- CSV 적재는 처음에는 dry-run으로만 실행하고, 숫자가 TikTok Ads Manager 화면과 일치할 때만 DB insert를 진행한다.
- XLSX 원본에서 Excel dimension이 `A1`로 잘못 저장되는 경우가 있다. `openpyxl` read-only로 읽을 때는 `ws.reset_dimensions()` 후 실제 행/열을 확인한다.
- `date`가 없는 기간 합계 파일은 `tiktok_ads_daily`에 바로 넣지 않는다. `tiktok_ads_campaign_range` 기간 합계 캐시로만 둔다.
- 한국어 export에서 `총 구매 수(모든 채널)` 헤더가 중복되는 경우가 있다. 2026-03-19 ~ 2026-04-17 파일에서는 첫 번째가 구매수, 두 번째가 구매값으로 보이며, 기간 합계 파일은 두 번째를 `all_channels_purchase_value_inferred`, 일별 파일은 두 번째를 `purchase_value`로 표준화했다. Ads Manager 화면과 한 번 대조한다.

## 로컬 테이블

| 테이블 | 용도 | 현재 상태 |
|---|---|---|
| `tiktok_ads_campaign_range` | 날짜 없는 캠페인 기간 합계 XLSX/CSV 캐시 | 생성 완료. 2개 기간 12행 |
| `tiktok_ads_daily` | Date dimension이 있는 캠페인 × 일자 export 캐시 | 생성 및 적재 완료. 2026-03-19 ~ 2026-04-17 캠페인×일자 147행 |

## ROAS 비교 기준

| 내부 지표 | 계산식 |
|---|---|
| 내부 Att ROAS | TikTok 귀속 Toss `DONE` 매출 / TikTok spend |
| Potential Att ROAS | TikTok 귀속 Toss `DONE + WAITING_FOR_DEPOSIT` 금액 / TikTok spend |
| TikTok 플랫폼 ROAS | `purchase_value / spend` |
| ROAS Gap | TikTok 플랫폼 ROAS - 내부 Att ROAS |

운영 DB insert는 별도 승인 후 진행한다. 로컬 SQLite 캐시 테이블은 `/ads/tiktok` 검증용으로만 사용한다.
