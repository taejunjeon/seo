# ROAS Screen Audit

작성 시각: 2026-05-25 21:21 KST  
기준일: 2026-05-25  
문서 성격: 프론트엔드 ROAS 화면별 endpoint 점검

## 판정 기준

- `PASS`: 기본 화면이 미리 계산된 요약값을 먼저 읽는다.
- `PARTIAL`: 핵심 데이터는 요약값을 읽지만, 보조 계산 API가 남아 있다.
- `NEEDS_CONVERSION`: 화면 진입 시 큰 원본성 API를 직접 호출한다.
- `DIAGNOSTIC_OK`: 원본성 API가 남아 있지만 사용자가 버튼을 눌렀을 때만 실행된다.

## 화면별 결과

### `/ai-crm/conversion-funnel`

판정: `PASS`

무엇을 확인했나:

- Meta ROAS 카드가 `/api/ads/roas-summary`를 사용한다.
- 강제 새로고침 버튼과 cooldown이 있어 무한 호출 위험이 낮다.

왜 괜찮나:

- 기본 조회는 캐시된 요약값을 읽는다.
- 원본 계산은 사용자가 명시적으로 새로고침할 때만 실행되는 구조다.

### `/ads/tiktok`

판정: `PASS`

무엇을 확인했나:

- TikTok 자체 ROAS는 `/api/ads/tiktok/roas-summary`를 사용한다.
- Meta 참고 카드는 `/api/ads/roas-summary`를 사용한다.
- Google 참고 카드는 `/api/google-ads/dashboard-summary`를 사용한다.
- 원본 비교 API `/api/ads/tiktok/roas-comparison`은 진단 버튼 흐름에만 남아 있다.

왜 괜찮나:

- 기본 화면은 요약값을 보여준다.
- 원본 진단은 사용자가 필요할 때만 누르는 구조다.

### `/ads/google`

판정: `PARTIAL`

무엇을 확인했나:

- Google Ads 주요 데이터는 `/api/google-ads/dashboard-summary`를 사용한다.
- 보조 내부 ROAS는 `/api/ads/internal-real-roas`를 호출한다.

왜 부분 통과인가:

- 핵심 Google 대시보드는 요약 우선 구조다.
- 다만 내부 ROAS 보조 계산도 장기적으로 캐시화 후보가 될 수 있다.
- 현재는 raw ledger hammer로 판단하지 않고 모니터링 대상으로 둔다.

### `/ads/google-roas-report`

판정: `PASS`

무엇을 확인했나:

- 보고서 카드가 `/api/google-ads/dashboard-summary`를 사용한다.

왜 괜찮나:

- Google Ads API 직접 호출을 매 화면 진입마다 반복하지 않는다.

### `/ads/meta-utm`

판정: `PASS`

무엇을 확인했나:

- 기간 ROAS 요약은 `/api/ads/roas-summary`를 사용한다.

주의:

- 이 화면에는 UTM/source 진단 API가 있다.
- 진단 API는 화면 목적상 필요하므로 ROAS hammer와 분리해서 봐야 한다.

### `/ads`

판정: `NEEDS_CONVERSION`

무엇을 확인했나:

- 화면 진입 시 다음 계열 API를 직접 호출한다.
  - Meta insights
  - daily ROAS
  - site-summary
  - campaign ROAS
  - campaign LTV ROAS

왜 문제인가:

- 이 화면은 여러 계산을 한 번에 실행한다.
- 사용자가 여러 번 열거나 여러 창에서 열면 backend와 외부 광고 API에 부담이 커질 수 있다.

권장:

- 이 화면을 계속 쓸 거면 `/api/ads/overview-summary` 같은 묶음 요약 endpoint로 바꾼다.
- 더 이상 주력 화면이 아니면 deprecated 표시를 붙이고, Google/TikTok/전환퍼널 보고서로 이동시킨다.

### `/biocom-ltv-cac`

판정: `NEEDS_CONVERSION`

무엇을 확인했나:

- site-summary, ROAS, campaign LTV ROAS를 화면 진입 시 직접 호출한다.

왜 문제인가:

- LTV/CAC는 계산 비용이 큰 지표다.
- 매번 원본을 다시 계산하기보다 "어제 기준 요약"과 "원본 재계산 버튼"을 분리해야 한다.

권장:

- `/api/ads/biocom-ltv-cac-summary` 또는 기존 summary API 확장으로 기본 카드를 먼저 보여준다.
- 원본 재계산은 버튼으로 둔다.

### `/ads/roas`

판정: `NEEDS_CONVERSION`

무엇을 확인했나:

- site-summary와 daily ROAS를 live로 호출한다.

왜 문제인가:

- Meta ROAS 전용 화면이라 조회 빈도가 높아질 수 있다.
- 일별 차트는 캐시된 daily summary를 쓰는 편이 낫다.

권장:

- 카드 영역은 `/api/ads/roas-summary`를 사용한다.
- 일별 차트는 `/api/ads/roas-daily-summary` 같은 precompute 결과로 분리한다.

## 우선순위

1. `/ads`
   - 이유: 가장 많은 live API를 동시에 호출한다.
   - 추천 점수: 92%.

2. `/biocom-ltv-cac`
   - 이유: LTV/CAC 계산은 사업 판단에 중요하고 계산 비용도 크다.
   - 추천 점수: 86%.

3. `/ads/roas`
   - 이유: Meta ROAS 전용 화면이라 쓰임새가 남아 있을 가능성이 크다.
   - 추천 점수: 82%.

## 이번 점검의 한계

- 소스 코드 기준 점검이다.
- 실제 사용 빈도와 서버 로그의 호출량은 이번 문서에서 별도 집계하지 않았다.
- 다음 단계에서는 access log 또는 backend route counter로 실제 호출량을 붙이면 우선순위가 더 정확해진다.

