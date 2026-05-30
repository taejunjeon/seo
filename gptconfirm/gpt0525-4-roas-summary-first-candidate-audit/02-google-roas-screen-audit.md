harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  lane: Green
  allowed_actions:
    - local_code_read
    - route_audit
    - documentation
  forbidden_actions:
    - vm_deploy
    - platform_send
    - production_db_write
  source_window_freshness_confidence:
    source: "frontend/src/app/ads/google* + backend/src/routes/googleAds.ts"
    window: "current local code"
    freshness: "2026-05-25 17:26 KST"
    confidence: "0.9"

# Google ROAS 화면 Audit

## 현재 구조

### Google Ads 운영 화면

파일: `frontend/src/app/ads/google/page.tsx`

첫 화면에서 호출:

- `/api/google-ads/dashboard?date_preset=${datePreset}`
- 이후 비용이 있으면 `/api/ads/internal-real-roas?platform=paid_google...`

화면 문구:

- "Google Ads API + 운영DB confirmed + VM Cloud ledger 조회 — 약 5~15초 소요"

판단:

- 강한 summary-first 후보이다.
- 지금은 화면이 열릴 때 Google Ads API와 내부 매출 대조를 직접 실행한다.

### Google ROAS 보고서

파일: `frontend/src/app/ads/google-roas-report/page.tsx`

첫 화면에서 호출:

- `/api/google-ads/dashboard?date_preset=last_7d&campaign_limit=20`
- `/api/google-ads/dashboard?date_preset=last_30d&campaign_limit=20`

판단:

- 강한 summary-first 후보이다.
- 보고서 화면은 특히 "최신 요약을 먼저 보고, 필요할 때 새로 계산"이 맞다.

## 백엔드 병목 후보

파일: `backend/src/routes/googleAds.ts`

`/api/google-ads/dashboard`는 한 요청에서 다음을 수행한다.

1. Google Ads customer 조회
2. conversion actions 조회
3. campaign metrics 조회
4. daily metrics 조회
5. conversion action metrics 조회
6. 내부 매출 대조
7. NPay actual correction
8. click-id health
9. NPay bridge review
10. click-id dropoff health

이 구조는 진단 화면에는 좋지만, 첫 화면 기본 로딩에는 무겁다.

## 권장 summary-first 구조

새 endpoint 후보:

```text
GET /api/google-ads/dashboard-summary
  ?date_preset=yesterday|last_7d|last_30d
  &site=biocom|thecleancoffee
```

응답은 아래만 우선 반환한다.

- 광고비
- 광고 플랫폼 주장 구매/매출/ROAS
- 내부 confirmed 구매/매출/ROAS
- 매칭 상태 요약
- 마지막 계산 시각
- confidence/caveat

상세 원본은 기존 `/api/google-ads/dashboard`를 버튼 뒤로 둔다.

## 기대 효과

- Google ROAS 보고서 첫 화면이 5~15초 live 계산에서 0.2~0.5초 cache read로 바뀔 수 있다.
- Google Ads API quota와 backend CPU 사용을 줄인다.
- 사용자는 "지금 봐도 되는 숫자"를 먼저 보고, 원인 분석은 별도로 열 수 있다.

