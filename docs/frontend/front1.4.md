상단 네비게이션 바와 전체 타이포그래피를 세련되게 정리해줘.

[네비게이션 변경]
1. 현재 단순 텍스트 탭 → pill 형태의 active indicator
   - 활성 탭: bg-primary/10 text-primary rounded-full px-4 py-1.5 font-medium
   - 비활성: text-muted-foreground hover:text-foreground transition
2. 로고 "Biocom AI Agent" 좌측에 subtle gradient text 또는 아이콘 개선
3. 우측 "AI 연결됨" 상태 → 초록 dot pulse + "Connected" 텍스트, 
   hover 시 연결 상세 정보 tooltip

[타이포그래피 변경]
1. 폰트 시스템:
   - 제목/점수 숫자: Google Fonts 'Plus Jakarta Sans' (weight 700-800)
   - 본문: 'Pretendard' 또는 기존 시스템 폰트
   - 점수 숫자(56, 45): font-variant-numeric: tabular-nums, letter-spacing: -0.02em
2. 텍스트 크기 위계 명확화:
   - 페이지 제목: text-2xl font-bold
   - 카드 제목: text-lg font-semibold  
   - 항목 레이블: text-sm font-medium
   - 설명 텍스트: text-xs text-muted-foreground
3. 중요 숫자에 font-feature-settings: "tnum" 적용 (숫자 정렬)

기존 컴포넌트 구조와 라우팅은 유지해줘.