# TikTok Ads Export 분석 - 2026-04-01 ~ 2026-04-18

작성 시각: 2026-04-18 05:30 KST

## 결론

이번 파일은 **TikTok 캠페인별 기간 합계 비용 리포트**로는 사용할 수 있지만, Sprint 2/3의 핵심 목표인 **TikTok 플랫폼 ROAS vs 내부 확정매출 ROAS 비교**에는 아직 부족하다.

이유는 세 가지다.

1. `date` 컬럼이 없다. 일자별 추세나 Guard 적용 전후 일 단위 비교를 만들 수 없다.
2. `purchase_value` 또는 구매 전환값 컬럼이 없다.
3. `구매 ROAS(모든 채널)`, `보조된 ROAS(샵)`, `보조된 구매 ROAS(웹사이트)`가 전부 0이다.

따라서 이번 파일에서 확정적으로 쓸 수 있는 값은 **기간 합계 광고비, 캠페인 ID, 캠페인명, 노출, 목적지 클릭, 전환수**다.

## 파일 위치

- 원본 XLSX: `data/ads_csv/tiktok/raw/20260401_20260418_campaign_report.xlsx`
- 원본 CSV 변환본: `data/ads_csv/tiktok/processed/20260401_20260418_campaign_report_raw.csv`
- 분석용 표준 요약 CSV: `data/ads_csv/tiktok/processed/20260401_20260418_campaign_summary.csv`
- 분석 요약 JSON: `data/ads_csv/tiktok/processed/20260401_20260418_campaign_summary.json`

## 수집된 컬럼

주요 컬럼:

- 캠페인 이름
- 기본 상태
- 캠페인 예산
- 비용
- CPC(목적지)
- CPM
- 노출수
- 클릭수(목적지)
- CTR(목적지)
- 전환수
- 전환당 비용
- 전환율(CVR)
- 캠페인 ID
- Date Created
- 순 비용
- 도달
- 전환 시간별 전환
- 구매 ROAS(모든 채널)
- 보조된 ROAS(샵)
- 보조된 구매 ROAS(웹사이트)
- 통화

없었던 컬럼:

- 날짜 / 일자
- 어트리뷰션 윈도우
- 구매 전환값 / Purchase value
- 웹사이트 구매값 / Website purchase value
- 주문 ID / transaction ID

## 기간 합계

| 지표 | 값 |
|---|---:|
| 캠페인 행 | 6 |
| 비용 발생 캠페인 | 4 |
| 총 비용 | 16,277,105 KRW |
| 순 비용 | 16,148,559 KRW |
| 노출수 | 7,763,802 |
| 클릭수(목적지) | 242,884 |
| 전환수 | 184 |
| 전환 시간별 전환 | 194 |
| 평균 CPC(목적지) | 67.02 KRW |
| 평균 CPM | 2,096.54 KRW |
| CTR(목적지) | 3.1284% |
| 전환당 비용 | 88,462.53 KRW |
| 구매 ROAS(모든 채널) | 0 |

## 캠페인별 비용 순위

| 순위 | 캠페인 | 캠페인 ID | 비용 | 전환수 | 목적지 클릭 |
|---:|---|---|---:|---:|---:|
| 1 | 음과검 스마트+ 캠페인 | 1854347729644690 | 8,258,613 | 76 | 144,117 |
| 2 | 종합대사기능 분석 스마트+캠페인 | 1854918885396689 | 4,595,661 | 37 | 37,159 |
| 3 | 영양중금속분석 스마트+ 캠페인 | 1856156648605858 | 1,712,213 | 25 | 38,357 |
| 4 | 건강기능식품 스마트+캠페인 | 1858788275666081 | 1,710,618 | 46 | 23,251 |
| 5 | 호르몬 검사 캠페인 | 1856728035726529 | 0 | 0 | 0 |
| 6 | 음식물과민증검사 캠페인 | 1854281861468210 | 0 | 0 | 0 |

## 판단

이번 파일은 내부 장부와 비교할 때 **광고비 분모**로는 일부 사용할 수 있다. 단, 일자별 분모가 아니라 전체 기간 합계 분모다.

이번 파일만으로는 다음을 할 수 없다.

- TikTok 플랫폼 구매값 계산
- TikTok 플랫폼 ROAS 계산
- Guard 적용 전후 일자별 비교
- 과거 TikTok ROAS가 실제 매출과 맞았는지 판정
- 가상계좌 미입금 오염 규모 산정

이번 파일에서 `전환수`는 184건으로 나오지만, 이것이 웹 `Purchase`인지, 다른 최적화 이벤트인지, 또는 TikTok의 기본 전환 정의인지 이 파일만으로는 확정할 수 없다. 내부 Toss 확정매출과 직접 비교하려면 **구매 이벤트명과 구매값 컬럼**이 필요하다.

## 다음 export 요청

TikTok Ads Manager Custom report에서 다음 조건으로 다시 export가 필요하다.

1. 기간: 2026-04-01 ~ 2026-04-18
2. 보기: 캠페인 단위 + 일자 단위
3. Dimensions: `Date`, `Campaign ID`, `Campaign name`
4. Metrics: `Cost`, `Impressions`, `Destination clicks`, `Conversions`, `Purchase`, `Purchase value`, `Purchase ROAS`
5. 구매값 관련 컬럼명이 다르면 `Website purchase value`, `Total purchase value`, `Value per Purchase`, `Complete payment value` 중 선택 가능한 것을 포함
6. 어트리뷰션 윈도우 컬럼이 없으면 화면 설정값을 수동 기록한다. 현재 계획 기준은 TikTok 기본값인 Click 7일 / View 1일이다.

TikTok 화면에서 일자 dimension이 바로 보이지 않으면 Custom report의 Pivot table 대신 Trend line 또는 date/time dimension을 추가해서 export한다.
