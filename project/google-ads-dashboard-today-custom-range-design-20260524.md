# Google Ads dashboard today/custom range design 2026-05-24

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - project/google-roas-report-baseline-card-deploy-and-clickid-bottleneck-20260524.md
    - project/google-roas-npay-intent-rematch-backend-plan-20260524.md
  lane: Green
  allowed_actions:
    - read-only API/code audit
    - design
    - approval packet
  forbidden_actions:
    - Google Ads mutation
    - conversion upload
    - backend deploy without approval
  source_window_freshness_confidence:
    source: backend/src/routes/googleAds.ts + Google Ads API official date range docs
    window: 2026-05-24 KST
    freshness: current code audited 2026-05-24, Google docs last updated 2026-05-13 UTC
    confidence: A-
```

## 한 줄 결론

Google Ads API는 오늘 데이터와 직접 날짜 범위를 조회할 수 있다. 현재 우리 backend가 `last_1d`, `last_7d`, `last_14d`, `last_30d`, `last_90d`만 허용해서 오늘 13:40 클릭 캠페인을 바로 못 보는 것이다.

공식 문서 근거:

- Google Ads Query Language는 `TODAY`, `YESTERDAY`, `LAST_7_DAYS`, `LAST_30_DAYS` 같은 predefined date range를 지원한다.
- 직접 날짜 범위는 `segments.date BETWEEN '2024-01-01' AND '2024-01-31'` 형식으로 지원한다.
- source: https://developers.google.com/google-ads/api/docs/query/date-ranges

## 현재 코드 상태

파일: `backend/src/routes/googleAds.ts`

현재 허용값:

```ts
const DATE_PRESETS = {
  last_1d: "YESTERDAY",
  last_7d: "LAST_7_DAYS",
  last_14d: "LAST_14_DAYS",
  last_30d: "LAST_30_DAYS",
  last_90d: "LAST_90_DAYS",
} as const;
```

현재 endpoint:

```text
GET /api/google-ads/dashboard?date_preset=last_1d
GET /api/google-ads/dashboard?date_preset=last_7d
GET /api/google-ads/dashboard?date_preset=last_30d
```

`last_1d`는 이름만 보면 최근 1일 같지만 실제로는 Google Ads의 `YESTERDAY`다. 즉 오늘 클릭은 내일이 되어야 보인다.

## 사용자 입장에서 필요한 동작

1. 오늘 클릭한 광고가 오늘 Google Ads에서 어느 캠페인으로 잡히는지 보고 싶다.
2. “5월 21일 밤 보강 이후”처럼 특정 시작일 이후의 Google 주장 ROAS를 보고 싶다.
3. 날짜 이름 때문에 어제/오늘/최근 24시간을 헷갈리지 않아야 한다.

## 설계안

### 1. `date_preset=today` 추가

추가:

```ts
const DATE_PRESETS = {
  today: "TODAY",
  last_1d: "YESTERDAY",
  last_7d: "LAST_7_DAYS",
  last_14d: "LAST_14_DAYS",
  last_30d: "LAST_30_DAYS",
  last_90d: "LAST_90_DAYS",
} as const;
```

결과:

```text
GET /api/google-ads/dashboard?date_preset=today
```

주의:

- Google Ads 당일 데이터는 지연/부분집계일 수 있다.
- 화면에는 `당일 잠정치`라고 표시해야 한다.
- 예산 판단은 당일 단독이 아니라 어제/7일과 함께 봐야 한다.

### 2. 직접 날짜 범위 추가

새 query:

```text
GET /api/google-ads/dashboard?start_date=2026-05-21&end_date=2026-05-24
```

내부 GAQL:

```sql
WHERE segments.date BETWEEN '2026-05-21' AND '2026-05-24'
```

검증:

```text
start_date/end_date는 YYYY-MM-DD만 허용
end_date >= start_date
최대 범위는 우선 90일로 제한
KST 날짜 선택이지만 Google Ads 계정 timezone 기준으로 해석됨
```

### 3. 응답 필드 명확화

현재 `datePreset`만 내려주면 화면에서 해석이 헷갈린다.

추가할 응답:

```json
{
  "dateMode": "preset" | "custom",
  "datePreset": "today",
  "dateRangeLiteral": "TODAY",
  "dateRangeLabelKo": "오늘, 당일 잠정치",
  "dateFreshnessNote": "Google Ads 당일 데이터는 지연될 수 있음"
}
```

직접 날짜 범위일 때:

```json
{
  "dateMode": "custom",
  "datePreset": null,
  "dateRangeLiteral": "BETWEEN '2026-05-21' AND '2026-05-24'",
  "dateRangeLabelKo": "2026-05-21 ~ 2026-05-24"
}
```

## 구현 순서

1. `DATE_PRESETS`에 `today` 추가.
2. `parseDatePreset`가 `start_date/end_date`가 있으면 preset 대신 custom range를 쓰도록 분기.
3. `buildCampaignMetricsQuery`, `buildDailyMetricsQuery`, `buildConversionActionMetricsQuery`가 `DURING ${literal}`뿐 아니라 custom condition도 받을 수 있게 변경.
4. `/ads/google`와 `/ads/google-roas-report`에서 `today`/직접 날짜 범위 라벨을 명확히 표시.
5. smoke:
   - `/api/google-ads/dashboard?date_preset=today`
   - `/api/google-ads/dashboard?start_date=2026-05-21&end_date=2026-05-24`
   - 기존 `/api/google-ads/dashboard?date_preset=last_7d`

## 성공 기준

```text
오늘 클릭 캠페인이 Google Ads API campaign rows에 보이는지 당일 조회 가능
5/21 밤 보강 이후 Google 주장 ROAS를 직접 날짜 범위로 조회 가능
기존 last_7d/last_30d 화면 깨짐 없음
Google Ads mutation/send/upload 0
```

## 배포 승인 필요 여부

설계/로컬 구현/로컬 테스트는 Green Lane이다.
VM Cloud backend 배포는 운영 API 동작을 바꾸므로 TJ님 승인 후 진행한다.

## 2026-05-24 로컬 구현 결과

Google Ads API를 오늘 또는 원하는 날짜 범위로 조회할 수 있게 로컬 backend를 보강했다. 이 작업은 조회 조건만 넓힌 것이고, Google Ads 설정 변경이나 전환 업로드는 하지 않았다.

구현 위치:

```text
backend/src/routes/googleAds.ts
```

새 사용법:

```text
GET /api/google-ads/dashboard?date_preset=today
GET /api/google-ads/dashboard?start_date=2026-05-24&end_date=2026-05-24
GET /api/google-ads/dashboard?start_date=2026-05-21&end_date=2026-05-24
```

응답에서 추가로 내려주는 값:

```json
{
  "dateMode": "preset 또는 custom",
  "dateRangeLiteral": "TODAY 또는 2026-05-24..2026-05-24",
  "dateRangeCondition": "Google Ads API에 실제로 들어간 날짜 조건",
  "dateRange": "KST 기준 시작/종료 시각"
}
```

로컬 smoke 결과:

```text
date_preset=today: HTTP 200
start_date만 넣은 잘못된 요청: HTTP 400
start_date=2026-05-24&end_date=2026-05-24: HTTP 200
Google Ads mutation/send/upload: 0
```

2026-05-24 16:40 KST 로컬 조회 참고값:

```text
today campaign_limit=1 기준:
cost 약 90,485원
clicks 237
primary conversions 0
conversion value 0
all conversions 7
all conversion value 700
```

주의:

`campaign_limit=1`로 조회하면 summary는 상위 캠페인 1개만 합산한다. 전체 캠페인 기준 숫자를 보려면 `campaign_limit=200`으로 조회해야 한다.

당일 Google Ads 값은 늦게 바뀔 수 있다. 오늘 숫자는 예산 판단의 단독 기준이 아니라 “방금 테스트가 어느 캠페인에 잡히는지 보는 참고값”으로 써야 한다.
