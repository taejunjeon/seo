# Step 4 — AI Traffic 컴포넌트 분리

Tab 5의 AI Traffic 관련 코드를 page.tsx에서 별도 컴포넌트로 분리해라.

## 생성할 파일

```
frontend/src/components/ai-traffic/
├── AiTrafficDashboard.tsx       # Tab 5 AI Traffic 컨테이너
├── AiTrafficKpi.tsx             # KPI 카드 그리드
├── AiTrafficBySourceTable.tsx   # 소스별 테이블
├── AiTrafficByLandingTable.tsx  # 랜딩페이지별 테이블
├── AiTrafficUserType.tsx        # 신규 vs 재방문
├── AiTrafficSummaryCard.tsx     # Tab 0용 요약 카드 (아직 비워두기)
└── types.ts                     # 타입 정의
```

## 규칙

1. page.tsx의 Tab 5에서 AI Traffic 관련 코드를 AiTrafficDashboard로 이동
2. page.tsx에서는 `<AiTrafficDashboard />` 만 렌더링
3. 다른 탭(0~4, 6, 7) 코드는 절대 건드리지 마라
4. 기존 디자인 스타일(글래스모피즘, 색상, 간격) 그대로 유지
5. 이 단계에서는 API 연동 없이 구조만 잡아라. 더미 데이터로 렌더링 확인만.
6. 기존에 Tab 5에 AI Traffic UI가 있으면 그걸 옮기고, 없으면 빈 레이아웃으로 생성

## AiTrafficDashboard 레이아웃 순서

위에서 아래로:
- 기간 선택 (Tab 5 기존 기간선택 UI 재사용)
- KPI 카드 그리드
- 신규 vs 재방문 카드
- 소스별 테이블
- 랜딩페이지별 테이블

## types.ts 핵심 타입

실제 백엔드 API를 호출해서 `/api/ga4/ai-traffic` 응답 구조를 확인하고 타입을 정의해라.
주요 필드:
- totals: sessions, activeUsers, newUsers, engagedSessions, bounceRate(0-1 fraction), engagementRate(0-1 fraction), averageSessionDuration(초), screenPageViews, ecommercePurchases, grossPurchaseRevenue
- bySource[]: sessionSource, category("ai_referral"|"search_legacy"|"organic"), + 위 metrics
- byLandingPage[]: landingPage + metrics
- _meta: type("live"|"fallback"), queriedAt, period

## 완료 확인
- [ ] 새 컴포넌트 파일들이 생성되었는지
- [ ] page.tsx에서 Tab 5가 AiTrafficDashboard를 렌더링하는지
- [ ] 다른 탭에 영향 없는지
- [ ] 빌드 에러 없는지