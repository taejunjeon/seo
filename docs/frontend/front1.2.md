AEO Score 상세(56점)와 GEO Score 상세(45점) 섹션의 정보 표현을 개선해줘.

[현재 문제]
- 각 항목(Q&A 키워드 커버리지 14/20, 구조화 데이터 0/20 등)이 
  단순 텍스트 + 숫자 나열로 스캔하기 어려움
- 빨간 X, 초록 체크 아이콘이 원시적
- 프로그레스 바가 모두 동일한 스타일

[변경 방향]
1. 각 항목을 미니 카드 형태로 분리:
   - 좌측: 항목명 + 설명 텍스트
   - 우측: 점수 (14/20) + 작은 circular badge 또는 horizontal bar
   - 점수 상태별 배경색: 80%↑ green subtle bg, 50-79% amber, 50%↓ red subtle bg

2. 아이콘 개선: ❌ → Lucide의 XCircle (red-400), ✅ → CheckCircle (green-400)
   크기 16px, 텍스트와 inline 정렬

3. 각 상세 항목 사이에 subtle divider (1px border-b border-gray-100)

4. 0점 항목(구조화 데이터 0/20, AI Overview 노출 0/25)은 
   좌측에 amber warning stripe (4px border-left)를 붙여서 
   "개선 필요" 항목이 시각적으로 즉시 구분되게 해줘

5. 항목 호버 시 배경이 미세하게 밝아지는 hover:bg-gray-50 transition

텍스트 내용과 점수 데이터는 현재 그대로 유지해줘.