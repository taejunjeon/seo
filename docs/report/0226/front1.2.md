# Step 6 — Tab 0 AI Traffic 요약 카드

오버뷰(Tab 0)에 AI Traffic 요약 카드를 추가해라.

## 위치
Tab 0의 기존 KPI 그리드 근처 또는 AI Citation 섹션 위.
기존 레이아웃을 확인하고 자연스러운 곳에 배치.

## API
`GET /api/ga4/ai-traffic` (기간: 최근 30일 고정)
Tab 0 로딩 시 호출.

## 표시 내용
- AI 유입 총 세션 수
- AI 유입 활성 사용자 수
- 상위 3개 소스 (이름 + 세션)
- _meta.type에 따라 "● 실시간" 또는 "⚠ 미연결" 뱃지
- "자세히 보기" 링크 → 클릭 시 Tab 5로 이동 (setActiveTab(5))

## 스타일
기존 오버뷰 카드와 동일한 디자인. 상세 지표(이탈률, 체류시간 등)는 넣지 마라.

## page.tsx 수정
Tab 0 영역에 `<AiTrafficSummaryCard onNavigateToDetail={() => setActiveTab(5)} />` 추가.

## 완료 확인
- [ ] Tab 0에 요약 카드 표시
- [ ] "자세히 보기" 클릭 시 Tab 5 이동
- [ ] 실데이터/fallback 뱃지 표시
- [ ] 기존 오버뷰 레이아웃에 영향 없음