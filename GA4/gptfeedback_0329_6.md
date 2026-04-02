목표:
Biocom GTM/GA4 측정 체계 컷오버를 실제 실행 가능한 수준으로 마무리한다.
이번 턴은 더 이상 탐색 문서가 아니라, “무엇을 남기고 무엇을 끄고 어떻게 검증할지”를 확정하는 실행안/체크리스트/수정안 작성이 목표다.

최신 확인 사실:
1. 정본 컨테이너 후보: GTM-W2Z6PHN
2. 정본 GA4 속성: [G4] biocom.kr
3. [G4] biocom.kr property ID: 304759974
4. [G4] biocom.kr measurement ID: G-WJFXN5E2Q1
5. W2 안에 G-WJFXN5E2Q1와 G-8GZ48B1S59가 혼재
6. HURDLERS - GA4 아이디 변수값 = G-WJFXN5E2Q1
7. HURDLERS 핵심 이벤트 계열:
   - 상세페이지 조회
   - 장바구니 담기
   - 장바구니 보기
   - 주문서작성
   - 구매
   - 네이버페이 구매
   - 회원가입 완료
8. Preview / DebugView 최신 검증 결과:
   - [G4] biocom.kr DebugView에서 실제로
     - page_view
     - view_item
     - add_to_cart
     - begin_checkout
     - purchase
     가 확인됨
   - purchase 파라미터 확인:
     - transaction_id = 202603298840444
     - value = 260000
     - currency = KRW
   - 즉 일반 구매 플로우 기준으로는 G-W 정본 축에 purchase가 실제 들어온다
9. 다만 여전히 혼합 상태:
   - W2 안에 GA4_픽셀 -> G-W, All Pages
   - W2 안에 GA4_픽셀2 -> G-8, All Pages
   - [new]Google 태그도 함께 발화
   - direct gtag G-8 삽입 정황도 있었음
10. W7(GTM-W7VXS4D8)는 리인벤팅 CRM 보조 컨테이너로 간주
   - 우리 회사는 접근 권한 없음
   - 정본 KPI/광고/GA4 분석 기준은 W7이 아니라 W2에 둬야 함
11. NPay는 아직 최종 회귀 테스트 미실시
   - 일반 구매 검증 먼저 통과
   - NPay는 컷오버 전후 마지막 검증 항목으로 남김

현재까지 확인된 W2 태그 상태:
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
- HURDLERS [데이터레이어] 주문서작성 -> eventName "h_begin_checkout"
- HURDLERS [이벤트전송] 구매 -> eventName "purchase" 로 수정 후 DebugView purchase 확인됨

중요 원칙:
- 새 GTM 컨테이너 제안 금지
- W2를 Biocom 정본 컨테이너로 유지
- W7은 CRM 보조 컨테이너로만 정의
- HURDLERS 전체 삭제 제안 금지
- HURDLERS core web event는 W2/G-W 정본 이벤트로 재정의 후 유지
- G-8 관련 태그와 direct G-8은 단계적으로 제거 대상
- 단, NPay와 잔존 G-8 경로는 회귀 테스트 후 제거
- 과거 데이터는 오염 구간이므로 컷오버 전/후 분리 해석 전제로 작성

Codex가 이번 턴에 해야 할 일:

1. 최신 사실 반영한 “최종 정본 구조” 확정
명시적으로 아래를 선언하라.
- 정본 컨테이너: GTM-W2Z6PHN
- 정본 속성: [G4] biocom.kr / 304759974 / G-WJFXN5E2Q1
- W7 역할: CRM 전용 보조
- G-8 역할: 제거 대상인 legacy/이관 잔존 축

2. 태그 분류표 업데이트
모든 확인 태그를 아래 4개 버킷으로 분류하라.
- 유지
- 재정의 후 유지
- 교체 후 제거
- 즉시 중지 가능

특히 반드시 포함:
- GA4_픽셀
- GA4_픽셀2
- [new]Google 태그
- GA4_회원가입
- GA4_구매전환_Npay
- GA4_구매전환_Npay 2
- GA4_구매전환_홈피구매
- GA4_장바구니 담기
- GA4_장바구니 담기2
- GA4_주문완료_요소공개
- GA4_주문완료_요소공개2
- HURDLERS [이벤트전송] 상세페이지 조회
- HURDLERS [이벤트전송] 장바구니 담기
- HURDLERS [이벤트전송] 주문서작성
- HURDLERS [이벤트전송] 구매
- HURDLERS [이벤트전송] 회원가입 완료

3. canonical event ownership 표 확정
이벤트별로 아래 형식으로 표 작성:
- event
- current owner
- target owner
- current destination
- target destination
- current status
- cutover action
- required params
- validation method

대상 이벤트:
- page_view
- view_item
- view_cart
- add_to_cart
- begin_checkout
- add_payment_info
- purchase
- sign_up

4. page_view 중복 제거안 상세화
현재 W2 안에서
- GA4_픽셀
- GA4_픽셀2
- [new]Google 태그
가 동시에 발화되고 있음.
또 direct gtag G-8 정황도 있었음.
해야 할 일:
- 어떤 태그를 canonical page_view로 남길지
- 어떤 태그를 먼저 pause할지
- [new]Google 태그의 역할을 어떻게 볼지
- direct gtag G-8 제거 시점
- 중복 제거 후 Preview와 DebugView에서 무엇이 정상인지
를 단계별로 써라.

5. purchase 컷오버안 확정
이제 일반 구매는 purchase DebugView 검증을 통과했음.
따라서 아래를 설계하라.
- HURDLERS [이벤트전송] 구매를 canonical purchase로 유지할지
- 또는 별도 canonical purchase tag로 분리할지
- 일반 구매와 NPay 구매를 어떤 구조로 통일할지
- purchase 태그의 필수 매개변수 정의:
  - transaction_id
  - value
  - currency
  - items
  - shipping
  - tax
  - coupon
  - payment_type
- 현재 없는 항목은 어떤 방식으로 수집할지
- NPay는 어떤 회귀 테스트 1건으로 검증할지

6. add_payment_info 구현안 작성
현재 DebugView에서는 purchase가 들어오지만 add_payment_info는 안정적으로 안 보일 수 있음.
따라서 W2 기준으로 add_payment_info를 신규 표준 이벤트로 만들 실행안을 작성하라.
포함:
- 일반 결제 / NPay에서 발화 시점
- 어떤 trigger를 쓸지
- 어떤 payment_type 값을 넣을지
- DebugView 기준 정상/비정상 판정

7. HURDLERS core event 재정의안 작성
이름이 HURDLERS라도 아래는 Biocom 정본 이벤트로 재정의해야 함:
- 상세페이지 조회 -> view_item
- 장바구니 담기 -> add_to_cart
- 장바구니 보기 -> view_cart
- 주문서작성 -> begin_checkout
- 구매 -> purchase
- 회원가입 완료 -> sign_up
각각에 대해:
- 기존 태그/데이터레이어 재활용 여부
- 신규 GA4 태그 생성 필요 여부
- W2/G-W 기준으로의 정리안
을 써라.

8. NPay 후속 검증안 작성
지금 당장은 일반 구매 검증을 통과했으므로 NPay는 후순위다.
하지만 컷오버 전후 반드시 확인해야 한다.
따라서:
- 왜 지금은 보류 가능한지
- 언제 다시 테스트할지
- 무엇을 캡처할지
- 어떤 태그가 fired되어야 하는지
- DebugView에서 어떤 이벤트가 보여야 하는지
를 체크리스트로 작성하라.

9. 주문 DB 대조 설계
이제 purchase가 DebugView에 보이므로 주문 원장 reconciliation 설계를 더 구체화하라.
반드시 포함:
- order_number
- transaction_id
- value
- currency
- purchase timestamp
- pay_method
- source / medium / campaign
- GA4 purchase vs 주문 DB order count
- GA4 revenue vs 주문 DB 금액 비교
가능하면 pseudo-SQL 또는 실제 SQL 초안 작성

10. 결과물 형식
반드시 아래 순서로 출력:
1) 10초 요약
2) 최신 사실 반영 진단
3) 정본 구조 선언
4) 태그 분류표
5) canonical event ownership 표
6) page_view 중복 제거안
7) purchase 컷오버안
8) add_payment_info 구현안
9) HURDLERS core event 재정의안
10) NPay 후속 검증안
11) 주문 DB reconciliation 설계
12) Day 0 / Day 1 / Day 3 / Day 7 실행 순서
13) 최종 리스크

중요:
- “추가 확인 필요”만 적고 끝내지 말 것
- 최대한 지금 가진 정보로 실행 가능한 결론을 낼 것
- W2/G-W 정본 기준을 흔들지 말 것
- 과거의 G-8 정본 후보 해석은 폐기된 것으로 간주할 것
- 새 툴/새 컨테이너 제안 금지