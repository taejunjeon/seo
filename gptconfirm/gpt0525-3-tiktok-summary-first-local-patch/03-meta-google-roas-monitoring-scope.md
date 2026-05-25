# Meta/Google ROAS Large Endpoint Monitoring Scope

## 이미 요약 우선으로 바뀐 화면

- `/ai-crm/conversion-funnel`
  - `/api/ads/roas-summary` 사용.
- `/ads/meta-utm`
  - `/api/ads/roas-summary` 사용.

## 다음 전환 후보

### 1. Meta 광고 대시보드

관련 화면:

- `frontend/src/app/ads/page.tsx`

현재 호출:

- `/api/ads/roas/daily`
- `/api/ads/roas`

전환 이유:

Meta 광고 화면은 자주 열리는 핵심 화면이다. 응답 p95가 5초를 넘거나 VM Cloud ledger 호출이 늘면 summary-first 전환 우선순위가 가장 높다.

### 2. 바이오컴 LTV/CAC 화면

관련 화면:

- `frontend/src/app/biocom-ltv-cac/page.tsx`

현재 호출:

- `/api/ads/roas?account_id=...&date_preset=last_7d`

전환 이유:

LTV/CAC 화면은 경영 판단용이라 요약 지표가 먼저 필요하다. 주문별 원본 진단은 별도 버튼으로 내려도 충분하다.

### 3. Google Ads 화면

관련 화면:

- `frontend/src/app/ads/google/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.tsx`

현재 호출:

- `/api/google-ads/dashboard`
- `/api/ads/internal-real-roas`

전환 이유:

Google Ads는 API 호출 비용과 권한/쿼터 리스크가 있다. 단, 현재는 TikTok보다 운영 우선순위가 높지만 Meta CAPI 안정화보다 낮다. 24시간 모니터링 뒤 p95/500/429 지표로 전환 범위를 확정한다.

## 전환 기준

아래 중 하나가 24시간 window에서 확인되면 summary-first 전환 후보로 확정한다.

- p95 latency 5초 초과.
- 단일 요청 memory spike 250MB 이상.
- 429/500 비율 1% 이상.
- 같은 화면 진입 시 원본 ledger를 반복 조회.
- hard guard 때문에 일부 row만 내려와 분석값이 줄어드는 현상 확인.

## 권장 순서

1. TikTok 화면 summary-first 로컬 패치 운영 반영.
2. Meta 광고 대시보드 호출 로그 24시간 수집.
3. LTV/CAC ROAS 호출을 summary endpoint로 전환.
4. Google Ads dashboard는 별도 cache 설계 후 전환.

