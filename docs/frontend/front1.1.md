AEO Score와 GEO Score 카드의 비주얼을 임팩트 있게 개선해줘.

[현재 문제]
- 점수가 plain text로만 표시됨 (56, 45)
- 프로그레스 바가 단순 직선
- "실시간" 뱃지가 눈에 안 띔

[변경 방향]
1. 점수 표시: 큰 숫자(56, 45)를 circular progress ring(도넛 차트)으로 감싸기
   - SVG 원형 프로그레스: stroke-dasharray/stroke-dashoffset 활용
   - 0~40: red, 40~70: amber/yellow, 70~100: green/teal 색상 자동 적용
   - 원 안에 점수 큰 숫자, 아래에 "/100" 작은 텍스트
   - 페이지 로드 시 0에서 목표값까지 카운트업 애니메이션 (CSS transition 또는 framer-motion)
2. "실시간" 뱃지: 초록 점이 pulse 애니메이션으로 깜빡이는 live indicator
   - @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
3. "5/6 항목 측정 완료" → 작은 세그먼트 바(6칸 중 5칸 채워진 형태)로 시각화
4. 카드 호버 시 미세한 scale(1.01) + shadow 증가 transition

기존 데이터 바인딩과 상태 관리 로직은 그대로 유지해줘.