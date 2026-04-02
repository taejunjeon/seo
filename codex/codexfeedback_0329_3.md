목표:
Biocom GTM/GA4 측정 체계를 정리하기 위한 최종 컷오버 계획서를 작성하라.
이번 작업의 핵심은 “리인벤팅 GTM(W7)은 CRM 전용 보조 컨테이너로 유지하고, 바이오컴 GTM(W2)을 정본 컨테이너로 유지하는 구조”를 기준으로 중복/혼합 측정을 제거하는 것이다.

현재까지 확인된 사실:
- 리인벤팅 GTM 컨테이너: GTM-W7VXS4D8
- 바이오컴 GTM 정본 후보 컨테이너: GTM-W2Z6PHN
- [G4] biocom.kr 속성 ID: 304759974
- [G4] biocom.kr 측정 ID: G-WJFXN5E2Q1
- W2 안에 아래가 확인됨:
  - GA4_픽셀 → G-WJFXN5E2Q1, All Pages, send_page_view=true
  - GA4_픽셀2 → G-8GZ48B1S59, All Pages, send_page_view=true
  - GA4_회원가입 → G-WJFXN5E2Q1, sign_up, 활성
  - GA4_구매전환_Npay → G-WJFXN5E2Q1, purchase, 일시중지
  - GA4_구매전환_Npay 2 → G-8GZ48B1S59, purchase, 활성
  - GA4_구매전환_홈피구매 → G-WJFXN5E2Q1, purchase, 일시중지
  - GA4_장바구니 담기 → G-WJFXN5E2Q1, add_to_cart, 일시중지
  - GA4_장바구니 담기2 → G-8GZ48B1S59, add_to_cart, 활성
  - GA4_주문완료_요소공개 → G-WJFXN5E2Q1, test
  - GA4_주문완료_요소공개2 → G-8GZ48B1S59, test
- HURDLERS - GA4 아이디 변수값 = G-WJFXN5E2Q1
- HURDLERS [이벤트전송] 계열은 구매, 네이버페이 구매, 상세페이지 조회, 장바구니 담기, 장바구니 보기, 주문서작성, 회원가입 완료 등을 참조
- 리인벤팅 측 설명:
  - W7은 현재 CRM 성과 대시보드 운영용
  - 바이오컴 GTM의 리토스 태그는 제거해도 된다고 전달받음
  - 다만 바이오컴은 W7 접근 권한이 없음
- direct gtag로 G-8GZ48B1S59가 사이트 코드에 삽입되어 있었던 정황이 있음

중요한 판단 원칙:
- W7을 핵심 분석의 정본으로 두지 말 것
- W2를 바이오컴 소유의 정본 컨테이너로 유지할 것
- W7은 리인벤팅 CRM 전용 보조 컨테이너로만 유지할 것
- 같은 이벤트를 같은 목적지로 W2와 W7에서 중복 발화하지 않게 할 것
- HURDLERS라는 이름만 보고 삭제하지 말 것. 실제 목적지가 G-W이고 핵심 이벤트라면 바이오컴 정본 태그로 재정의/이관 후 유지해야 함

Codex가 해야 할 일:
1. 현재 확인된 태그를 아래 4개 버킷으로 분류하라.
   - 유지
   - 교체 후 제거
   - 즉시 중지 가능
   - 추가 확인 필요
2. 특히 다음 이벤트에 대해 “정본 태그 후보”를 제안하라.
   - page_view
   - view_item
   - add_to_cart
   - begin_checkout
   - add_payment_info
   - purchase
   - sign_up
3. HURDLERS 계열 태그를 “리토스 CRM 전용”과 “실질적으로 바이오컴 정본 이벤트”로 분리하라.
4. W2 기준 최종 권장 구조를 제안하라.
   - 어떤 태그를 G-WJFXN5E2Q1 기준으로 남길지
   - G-8GZ48B1S59 관련 어떤 태그를 제거/중지할지
   - direct gtag 제거 시점
5. 컷오버 순서를 단계별로 작성하라.
   - 사전 점검
   - GTM Preview
   - 태그 중지/교체
   - 사이트 헤드코드 정리
   - DebugView 검증
   - 주문 DB / GA4 대조
6. “외부 대행사 컨테이너 접근권한 없음”을 전제로 한 운영 정책도 작성하라.
   - W7에 어떤 역할만 남길지
   - 어떤 데이터는 반드시 W2에서 소유해야 하는지
   - 벤더에 어떤 확인자료를 요청해야 하는지
7. 출력 형식:
   - 10초 요약
   - 현재 문제 구조
   - 태그 분류표
   - 정본 구조 제안
   - 컷오버 실행 순서
   - 벤더 요청사항
   - 최종 리스크