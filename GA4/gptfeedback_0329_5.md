목표:
Biocom의 GTM/GA4 측정 체계를 실제 컷오버 가능한 수준으로 정리하고, W2(GTM-W2Z6PHN)를 Biocom 소유의 단일 정본 컨테이너로 복구하는 실행안을 만든다. 이번 턴은 “분석 문서 작성”이 아니라 “실제로 끊고 붙일 수 있는 작업 지시서 + 수정안 + 검증 계획”까지 내는 것이 목표다.

현재까지 확정/준확정 사실:
1. 정본 컨테이너 후보: GTM-W2Z6PHN
2. 정본 속성 후보: [G4] biocom.kr
3. [G4] biocom.kr 속성 ID: 304759974
4. [G4] biocom.kr measurement ID: G-WJFXN5E2Q1
5. W7(GTM-W7VXS4D8)는 리인벤팅 CRM 전용 보조 컨테이너로만 봐야 하며, 우리 회사는 접근 권한이 없음
6. W2 안에는 G-WJFXN5E2Q1와 G-8GZ48B1S59가 혼재
7. 확인된 W2 상태:
   - GA4_픽셀 -> G-WJFXN5E2Q1, All Pages, send_page_view=true
   - GA4_픽셀2 -> G-8GZ48B1S59, All Pages, send_page_view=true
   - GA4_회원가입 -> G-WJFXN5E2Q1, sign_up, 활성
   - GA4_구매전환_Npay -> G-WJFXN5E2Q1, purchase, 일시중지
   - GA4_구매전환_Npay 2 -> G-8GZ48B1S59, purchase, 활성
   - GA4_구매전환_홈피구매 -> G-WJFXN5E2Q1, purchase, 일시중지
   - GA4_장바구니 담기 -> G-WJFXN5E2Q1, add_to_cart, 일시중지
   - GA4_장바구니 담기2 -> G-8GZ48B1S59, add_to_cart, 활성
   - GA4_주문완료_요소공개 -> G-WJFXN5E2Q1, test
   - GA4_주문완료_요소공개2 -> G-8GZ48B1S59, test
8. HURDLERS - GA4 아이디 변수값 = G-WJFXN5E2Q1
9. HURDLERS [이벤트전송] 계열은 구매, 네이버페이 구매, 상세페이지 조회, 장바구니 담기, 장바구니 보기, 주문서작성, 회원가입 완료 등을 참조
10. direct gtag G-8GZ48B1S59가 사이트 헤드 코드에 삽입되어 있었던 정황이 있음
11. 현재 핵심 리스크:
   - W2 내부 measurement ID 혼합
   - page_view 중복 가능성
   - 표준 view_item 부재 또는 불명확
   - PG/cross-domain로 인한 purchase 단절 가능성
   - 과거 데이터는 이미 혼합 구간일 가능성 큼
12. 현재 진단 문서상 운영 검증 미완료 항목:
   - 실제 purchase 1건 DebugView 검증
   - GA4 Admin cross-domain 설정 점검
   - GA4 Explore 같은 scope 표 재생성
   - 주문 원장과 transaction_id/order_number reconciliation

중요 원칙:
- 새 GTM 컨테이너를 만들지 말 것
- W2를 정본 컨테이너로 유지할 것
- W7을 정본 KPI 컨테이너로 쓰지 말 것
- HURDLERS라는 이름만 보고 삭제하지 말 것
- 이름이 외부스러워도 실제 목적지가 G-W이고 core web event이면 Biocom 정본 이벤트로 재정의 후 유지
- W2 안의 G-8 계열 태그와 direct G-8은 단계적으로 제거 대상
- 단, Preview / DebugView / 주문 DB 대조 전에 무작정 제거하지 말 것

이번 턴에서 Codex가 해야 할 일:

1. 최종 태그 분류표 작성
아래 4개 버킷으로 모든 확인 태그를 분류하라.
- 유지
- 재정의 후 유지
- 교체 후 제거
- 즉시 중지 가능

특히 아래 태그는 반드시 표에 포함하라.
- GA4_픽셀
- GA4_픽셀2
- GA4_회원가입
- GA4_구매전환_Npay
- GA4_구매전환_Npay 2
- GA4_구매전환_홈피구매
- GA4_장바구니 담기
- GA4_장바구니 담기2
- GA4_주문완료_요소공개
- GA4_주문완료_요소공개2
- HURDLERS [이벤트전송] 구매
- HURDLERS [이벤트전송] 네이버페이 구매
- HURDLERS [이벤트전송] 상세페이지 조회
- HURDLERS [이벤트전송] 장바구니 담기
- HURDLERS [이벤트전송] 장바구니 보기
- HURDLERS [이벤트전송] 주문서작성
- HURDLERS [이벤트전송] 회원가입 완료

2. canonical event ownership 표 작성
아래 이벤트별로 “정본 태그 후보”, “목적지”, “필수 매개변수”, “현재 문제”, “컷오버 후 상태”를 표로 정리하라.
- page_view
- view_item
- view_cart
- add_to_cart
- begin_checkout
- add_payment_info
- purchase
- sign_up

3. view_item 구현 상세안 작성
가장 중요하다.
현재 표준 view_item이 비어 있거나 불명확한 상태이므로, W2 기준으로 실제 구현 가능한 설계안을 작성하라.
반드시 포함:
- event name
- trigger 조건
- firing 시점
- item_id / item_name / currency / value / items 등 필요한 payload
- 기존 rebuyz_view와의 관계
- HURDLERS 상세페이지 조회 태그를 재활용할지, 신규 GA4 태그를 만들지
- Preview / DebugView에서 어떻게 검증할지

4. add_payment_info 구현 상세안 작성
반드시 포함:
- 일반 결제와 네이버페이 흐름에서 어디서 발화할지
- 어떤 trigger를 쓸지
- 어떤 파라미터를 넣을지
- PG 직전 세션 단절 점검에 왜 중요한지
- DebugView에서 begin_checkout -> add_payment_info -> purchase 연결을 어떻게 볼지

5. page_view 중복 차단안 작성
반드시 아래를 기준으로 판단하라.
- W2의 GA4_픽셀(G-W, All Pages)
- W2의 GA4_픽셀2(G-8, All Pages)
- 사이트 헤드의 direct gtag G-8
목표:
- 정본 page_view는 W2의 G-W 한 축만 남긴다
- G-8 page_view 중복 경로를 단계적으로 제거한다
출력:
- 먼저 끌 것
- 나중에 끌 것
- Preview 전에는 건드리면 안 되는 것

6. purchase 컷오버안 작성
일반 구매 / NPay 구매를 나눠서 설계하라.
반드시 포함:
- G-W purchase 정본화 방법
- G-8 purchase 계열 제거 순서
- transaction_id 검증 항목
- 주문 DB 대조 방식
- purchase 이벤트가 GTM, CMS, HURDLERS, direct gtag 중 어느 레이어에서 책임지는 것이 가장 맞는지 판단

7. W7 운영 정책 초안 작성
리인벤팅 GTM(W7)은 접근권한이 없다는 제약을 전제로, 아래를 문서화하라.
- W7에 남겨도 되는 것
- W7에서 제거되어야 하는 것
- 벤더에게 받아야 하는 증빙
- W7이 core analytics를 건드리지 않는지 검증하는 방법
- “W7은 CRM 보조, W2는 KPI 정본” 원칙을 문장으로 명확하게 정리

8. 실제 실행 체크리스트 작성
아래 3개 버전으로 만들어라.
- GTM 작업자용
- 대표/운영 확인용
- 검증용(DebugView/주문DB/GA4 Explore)

9. 주문 원장 reconciliation 설계
이건 Codex가 계속 밀 수 있는 영역이다.
아래 기준으로 주문 DB와 GA4를 대조하는 설계를 작성하라.
- order_number
- transaction_id
- purchase count
- revenue
- pay_method
- purchase timestamp
- source / medium / campaign
가능하면 실제 SQL 또는 pseudo-SQL까지 작성하라.

10. 결과물 형식
반드시 아래 순서로 출력하라.
1) 10초 요약
2) 현재 구조 진단
3) 태그 분류표
4) canonical event ownership 표
5) view_item 상세 구현안
6) add_payment_info 상세 구현안
7) page_view 중복 제거안
8) purchase 컷오버안
9) W7 운영 정책
10) GTM 작업 체크리스트
11) DebugView / 주문DB 검증 체크리스트
12) 최종 리스크
13) 실제 수정 순서 Day 0 / Day 1 / Day 2 / Day 7

중요:
- 새 컨테이너 제안 금지
- HURDLERS 전체 삭제 제안 금지
- “추가 확인 필요”만 남기고 끝내지 말 것
- 가능한 한 지금 가진 정보로 실행 가능한 결론을 내릴 것
- 사실과 추론을 구분할 것
- 과거 문서 중 G-8을 정본 후보로 본 해석은 폐기하고, 현재는 G-W / 304759974 / W2 정본 기준으로 작성할 것
- 벤더 접근권한이 없다는 현실 제약을 반드시 반영할 것