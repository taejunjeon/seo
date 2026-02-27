현재 대시보드의 배경과 컬러 시스템을 리팩토링해줘.

[현재 문제]
- 민트 그린(#E8F5E9 계열) 단색 배경이 밋밋하고 깊이감 없음
- 카드와 배경의 구분이 약함
- 전체적으로 "의료/건강" 느낌이 부족

[변경 방향]
1. 배경: 단색 → subtle gradient mesh 또는 매우 은은한 radial gradient
   - 옵션A (다크 모드): #0F172A → #1E293B 다크 블루 기반, 카드는 #1E293B/80 backdrop-blur
   - 옵션B (라이트 유지): #F8FAFC 기반, 매우 은은한 mint-to-blue gradient, 우측 상단에 subtle glow effect
2. 카드: border-radius: 16px, shadow를 더 깊게 (0 4px 24px rgba(0,0,0,0.08)), 
   border: 1px solid rgba(255,255,255,0.1) 추가
3. CSS variables로 컬러 토큰 정의:
   --color-primary: 건강/신뢰 느낌의 teal (#0D9488)
   --color-accent: 에너지/경고용 amber (#F59E0B)  
   --color-danger: #EF4444
   --color-success: #10B981
   --color-surface: 카드 배경
   --color-text-primary / secondary / muted
4. 기존 초록색 프로그레스 바 → --color-primary(teal) 그라디언트로 교체

기존 레이아웃과 컴포넌트 구조는 유지하고, 컬러/배경/그림자만 변경해줘.