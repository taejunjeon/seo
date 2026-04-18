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
YYYYMMDD_YYYYMMDD_adgroup.csv
YYYYMMDD_YYYYMMDD_raw.csv
raw/YYYYMMDD_YYYYMMDD_campaign_report.xlsx
processed/YYYYMMDD_YYYYMMDD_campaign_summary.csv
processed/YYYYMMDD_YYYYMMDD_campaign_summary.json
```

예시:

```text
20260401_20260417_campaign.csv
20260416_20260418_raw.csv
raw/20260401_20260418_campaign_report.xlsx
processed/20260401_20260418_campaign_summary.csv
```

## 현재 수령 파일

| 기간 | 원본 | 처리 결과 | 판정 |
|---|---|---|---|
| 2026-04-01 ~ 2026-04-18 | `raw/20260401_20260418_campaign_report.xlsx` | `processed/20260401_20260418_campaign_summary.csv`, `processed/20260401_20260418_campaign_summary.json` | 캠페인 기간 합계 비용 데이터로만 사용 가능. `date`, 구매 전환값, 어트리뷰션 윈도우 없음 |
| 2026-03-19 ~ 2026-04-17 | `raw/20260319_20260417_campaign_report.xlsx` | `processed/20260319_20260417_campaign_summary.csv`, `processed/20260319_20260417_campaign_summary.json` | 캠페인 기간 합계 기준의 구매수·추정 구매값·ROAS 확인 가능. `date`, 어트리뷰션 윈도우 없음 |

## 필수 컬럼

| 표준 컬럼 | 설명 | 허용 별칭 |
|---|---|---|
| `date` | 보고 일자 | `Date`, `날짜`, `일` |
| `campaign_id` | 캠페인 ID | `Campaign ID`, `캠페인 ID` |
| `campaign_name` | 캠페인명 | `Campaign name`, `Campaign Name`, `캠페인 이름`, `캠페인명` |
| `spend` | 광고비 | `Cost`, `Spend`, `비용`, `광고비` |
| `impressions` | 노출수 | `Impressions`, `노출` |
| `clicks` | 클릭수 | `Clicks`, `클릭` |
| `conversions` | 전환수 | `Conversions`, `전환`, `구매` |
| `purchase_value` | 구매 전환값 | `Purchase value`, `Total purchase value`, `구매 전환값`, `구매값` |
| `platform_roas` | TikTok Ads Manager ROAS | `ROAS`, `Purchase ROAS`, `구매 ROAS` |
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
- `date`가 없는 기간 합계 파일은 `tiktok_ads_daily` 후보 테이블에 바로 넣지 않는다. 분석 보조 파일로만 둔다.
- 한국어 export에서 `총 구매 수(모든 채널)` 헤더가 중복되는 경우가 있다. 2026-03-19 ~ 2026-04-17 파일에서는 첫 번째가 구매수, 두 번째가 구매값으로 보이며, 처리 파일에서는 두 번째를 `all_channels_purchase_value_inferred`로 표준화했다. Ads Manager 화면과 한 번 대조한다.

## ROAS 비교 기준

| 내부 지표 | 계산식 |
|---|---|
| 내부 Att ROAS | TikTok 귀속 Toss `DONE` 매출 / TikTok spend |
| Potential Att ROAS | TikTok 귀속 Toss `DONE + WAITING_FOR_DEPOSIT` 금액 / TikTok spend |
| TikTok 플랫폼 ROAS | `purchase_value / spend` |
| ROAS Gap | TikTok 플랫폼 ROAS - 내부 Att ROAS |

DB 테이블 생성이나 실제 적재는 별도 승인 후 진행한다.
