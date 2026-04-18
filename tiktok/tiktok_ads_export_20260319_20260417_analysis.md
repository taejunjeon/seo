# TikTok Ads Export 분석 - 2026-03-19 ~ 2026-04-17

작성 시각: 2026-04-18 11:29 KST

## 결론

이번 파일은 **Guard 적용 전 기간의 TikTok 캠페인별 기간 합계 리포트**로 사용할 수 있다. 앞선 2026-04-01 ~ 2026-04-18 파일과 달리 구매 관련 컬럼이 들어 있어, 최소한 **캠페인 기간 합계 기준의 TikTok 플랫폼 ROAS**는 계산 가능하다.

다만 `date` 컬럼이 없으므로 일자별 추세, Guard 적용 전후 일 단위 비교, 일자별 내부 장부 조인은 아직 불가능하다.

## 파일 위치

- 원본 XLSX: `data/ads_csv/tiktok/raw/20260319_20260417_campaign_report.xlsx`
- 원본 CSV 변환본: `data/ads_csv/tiktok/processed/20260319_20260417_campaign_report_raw.csv`
- 분석용 표준 요약 CSV: `data/ads_csv/tiktok/processed/20260319_20260417_campaign_summary.csv`
- 분석 요약 JSON: `data/ads_csv/tiktok/processed/20260319_20260417_campaign_summary.json`
- 로컬 스냅샷 예비 gap JSON: `data/ads_csv/tiktok/processed/20260319_20260417_local_snapshot_gap.json`

## 중요한 컬럼

사용 가능:

- 캠페인 이름
- 캠페인 ID
- 비용
- 순 비용
- 노출수
- 클릭수(목적지)
- 전환수
- 총 구매 수(모든 채널)
- 구매당 비용(모든 채널)
- 구매당 금액(모든 채널)
- CTA 구매 ROAS(웹사이트)
- VTA 구매 ROAS(웹사이트)
- 통화

주의 필요:

- `총 구매 수(모든 채널)` 헤더가 2번 나온다.
- 첫 번째 `총 구매 수(모든 채널)`은 구매 건수로 보인다.
- 두 번째 `총 구매 수(모든 채널)`은 실제로는 구매값으로 보인다. 이유는 `구매당 금액 * 총 구매 수`와 거의 일치하기 때문이다.
- 이 두 번째 컬럼은 분석 파일에서 `all_channels_purchase_value_inferred`로 표준화했다.

없었던 컬럼:

- 날짜 / 일자
- 어트리뷰션 윈도우
- 주문 ID / transaction ID

## 기간 합계

| 지표 | 값 |
|---|---:|
| 캠페인 행 | 6 |
| 비용 발생 캠페인 | 4 |
| 총 비용 | 28,363,230 KRW |
| 순 비용 | 28,363,230 KRW |
| 노출수 | 13,262,333 |
| 클릭수(목적지) | 365,991 |
| 전환수 | 321 |
| 총 구매 수(모든 채널) | 321 |
| 구매당 금액(가중 평균) | 2,836,856.55 KRW |
| 추정 총 구매값 | 910,630,953 KRW |
| 추정 플랫폼 ROAS | 32.106 |
| VTA 구매 ROAS(웹사이트) | 0.49 |
| CTA 구매 ROAS(웹사이트) | 31.26 |

## 캠페인별 구매값·ROAS

| 캠페인 | 캠페인 ID | 비용 | 구매수 | 추정 구매값 | 추정 ROAS | CTA ROAS | VTA ROAS |
|---|---|---:|---:|---:|---:|---:|---:|
| 음과검 스마트+ 캠페인 | 1854347729644690 | 14,143,071 | 143 | 746,835,717 | 52.806 | 52.20 | 0.44 |
| 종합대사기능 분석 스마트+캠페인 | 1854918885396689 | 8,222,937 | 75 | 126,692,609 | 15.407 | 14.51 | 0.42 |
| 건강기능식품 스마트+캠페인 | 1858788275666081 | 2,999,202 | 62 | 23,091,112 | 7.699 | 6.33 | 1.02 |
| 영양중금속분석 스마트+ 캠페인 | 1856156648605858 | 2,998,020 | 41 | 14,011,515 | 4.674 | 3.35 | 0.37 |
| 호르몬 검사 캠페인 | 1856728035726529 | 0 | 0 | 0 | 0 | 0 | 0 |
| 음식물과민증검사 캠페인 | 1854281861468210 | 0 | 0 | 0 | 0 | 0 | 0 |

## 판단

이번 파일은 Sprint 3의 **L3 일부**까지 가능하게 만든다.

- L2: TikTok 광고비 기반 내부 Att ROAS 계산 가능
- L3 일부: TikTok 플랫폼 구매값·ROAS와 내부 확정매출 비교 가능
- L4 일부: 캠페인별 gap 가능

단, 일자별 데이터가 없으므로 `tiktok_ads_daily`에는 바로 넣지 않는다. 별도 `campaign_range_total` 성격의 입력으로 다루거나, 일자별 재export를 받아야 한다.

## ROAS 정합성 관점의 의미

TikTok 플랫폼은 2026-03-19 ~ 2026-04-17 기간에 구매수 321건, 추정 구매값 910,630,953원, 추정 ROAS 32.106을 보고하고 있다.

이 값이 내부 Toss `DONE` 확정매출보다 크게 높다면, 과거 TikTok ROAS가 가상계좌 미입금 또는 결제완료 페이지 기반 purchase 오염으로 과대 집계됐을 가능성이 강해진다.

## 로컬 스냅샷 예비 비교

로컬 `backend/data/crm.sqlite3` 기준으로 같은 TikTok 리포트 기간을 조회했다. 단, 로컬 Attribution 원장 자체가 `2026-03-29T10:26:32Z ~ 2026-04-12T04:13:40Z`까지만 있어 전체 기간을 덮지 못한다. 따라서 아래 값은 **방향성 확인용**이다.

| 항목 | 값 |
|---|---:|
| 로컬 TikTok payment_success 주문 | 49 |
| imweb 조인 누락 | 0 |
| Toss confirmed / 내부 확정매출 | 0건 / 0원 |
| pending | 48건 / 551,074,000원 |
| canceled | 1건 / 750,000원 |
| TikTok 플랫폼 추정 구매값 | 910,630,953원 |
| 플랫폼 - confirmed | 910,630,953원 |
| 플랫폼 - confirmed - pending | 359,556,953원 |
| confirmed ROAS | 0 |
| confirmed + pending potential ROAS | 19.429 |

예비 판단: 로컬 스냅샷 안에서는 TikTok 귀속 확정매출이 0원이고 pending만 551,074,000원이다. TikTok 플랫폼 구매값 910,630,953원과 비교하면 과거 ROAS 과대 가능성이 매우 크다. 다만 로컬 원장이 전체 기간을 덮지 못하므로 최종 판정은 운영 VM 원장 전체 export 또는 페이지네이션 조회로 다시 계산해야 한다.

## 운영 VM 전체 기간 비교

2026-04-18 12:14 KST에 운영 VM 원장을 read-only로 직접 조회했다.

조회 기준:

- endpoint: `https://att.ainativeos.net/api/attribution/ledger`
- source: `biocom_imweb`
- startAt: `2026-03-18T15:00:00.000Z`
- endAt: `2026-04-17T15:00:00.000Z`
- limit: `10000`

결과:

| 항목 | 값 |
|---|---:|
| 운영 VM 전체 원장 행 | 2,516 |
| TikTok payment_success | 50 |
| confirmed | 0건 / 0원 |
| pending | 49건 / 551,095,900원 |
| canceled | 1건 / 750,000원 |
| TikTok 플랫폼 추정 구매값 | 910,630,953원 |
| 플랫폼 - confirmed | 910,630,953원 |
| 플랫폼 - confirmed - pending | 359,535,053원 |
| confirmed ROAS | 0 |
| confirmed + pending potential ROAS | 19.430 |

판정: 운영 VM 전체 기간 기준으로도 TikTok 귀속 확정매출은 0원이다. TikTok Ads Manager가 같은 기간 구매값 910,630,953원과 ROAS 32.106을 보고하므로, 과거 TikTok ROAS는 실제 확정매출 기준으로 과대 집계됐다고 보는 것이 타당하다.

다음 단계는 같은 기간 내부 Attribution/Toss 원장에서 TikTok 귀속 주문을 뽑아 다음 세 값을 계산하는 것이다.

1. Toss `DONE` 확정매출
2. Toss `WAITING_FOR_DEPOSIT` pending 금액
3. TikTok 플랫폼 추정 구매값 910,630,953원과의 gap

## 다음 요청

가능하면 같은 기간을 다시 export하되, 이번에는 `Date` dimension을 추가한다.

필수:

- `Date`
- `Campaign ID`
- `Campaign name`
- `Cost`
- `Total purchase count`
- `Total purchase value`
- `CTA Purchase ROAS`
- `VTA Purchase ROAS`

어트리뷰션 윈도우 컬럼이 없으면 화면 설정값을 수동 기록한다. 현재 계획 기준은 TikTok 기본값인 Click 7일 / View 1일이다.
