목표:
Meta Ads의 ROAS 측정 방식을 공식 문서 기준으로 정리하고, 우리 내부 Attribution confirmed ROAS와 왜 차이가 나는지 원인별로 분해하라.

반드시 다룰 것:
1. Meta `purchase_roas`와 `website_purchase_roas`의 공식 정의 차이
2. `action_values`가 무엇인지, Meta ROAS 분자와 어떤 관계인지
3. `action_attribution_windows`가 Meta ROAS에 어떤 영향을 주는지
4. `use_unified_attribution_setting=true`가 왜 Ads Manager parity에 중요한지
5. `action_report_time=impression vs conversion`이 일별 비교에 어떤 차이를 만드는지
6. Ads Manager 화면값과 Marketing API 값이 어긋나는 대표 원인
7. Pixel / CAPI / connected business tools / offline events가 분자에 미치는 영향
8. 우리 환경에서 Meta ROAS가 과장될 수 있는 경로와 Attribution confirmed가 과소평가될 수 있는 경로
9. Meta 공식 문서와 개발자 문서를 우선 사용하고, 추정은 추정이라고 명시할 것

우리 내부 비교 기준:
- Meta purchase ROAS
- Attribution confirmed ROAS
- Attribution confirmed+pending ROAS
- best-case ceiling

분석 산출물 형식:
- 10초 요약
- 공식 정의 표
- 우리 상황에의 적용
- 과장 가능성이 큰 쪽 / 과소평가 가능성이 큰 쪽
- 숫자 차이를 줄이기 위한 실행 체크리스트
- 추가로 필요한 데이터 목록

중요:
- Meta 공식 문서와 Meta Developers 문서를 우선 인용할 것
- 광고 대시보드 운영자가 바로 이해할 수 있는 쉬운 한국어로 쓸 것
- “확정 매출”과 “플랫폼 귀속 가치”를 절대 혼동하지 말 것