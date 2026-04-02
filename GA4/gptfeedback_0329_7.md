목표:
이번 턴은 GTM/GA4 컷오버의 “전략 결정”이 아니라, 이미 확정된 전략을 바탕으로 GTM 작업자가 실제로 따라할 수 있는 실행 사양서와 검증 문서를 만드는 것이다.

중요:
아래 “Assistant 확정 사양”은 이번 턴의 source of truth다.
Codex는 이 방향을 다시 토론하거나 흔들지 말고, 실행 가능한 산출물로 정리하는 데 집중하라.

Assistant 확정 사양:
1. 정본 컨테이너 = GTM-W2Z6PHN
2. 정본 속성 = [G4] biocom.kr
3. 정본 property ID = 304759974
4. 정본 measurement ID = G-WJFXN5E2Q1
5. 일반 구매 canonical sender = HURDLERS - [이벤트전송] 구매
6. 상세페이지 조회 canonical sender = HURDLERS - [이벤트전송] 상세페이지 조회
7. 장바구니 담기 canonical sender = HURDLERS - [이벤트전송] 장바구니 담기
8. 주문서작성 canonical sender = HURDLERS - [이벤트전송] 주문서작성
9. 회원가입 canonical sender = GA4_회원가입
10. W7(GTM-W7VXS4D8)은 CRM 보조 컨테이너로만 간주
11. G-8GZ48B1S59 계열은 legacy/이관 잔존 축이며 단계적으로 제거 대상
12. HURDLERS - [이벤트전송] 네이버페이 구매는 purchase 정본이 아니라 add_payment_info 또는 npay_click 계열 보조 이벤트로 재정의 대상
13. 즉시 중지 가능 태그:
   - GA4_주문완료_요소공개
   - GA4_주문완료_요소공개2
14. 교체 후 제거 대상:
   - GA4_픽셀2
   - GA4_장바구니 담기2
   - GA4_구매전환_Npay 2
   - direct gtag G-8 삽입 코드
15. paused 유지 후 제거 후보:
   - GA4_구매전환_홈피구매
   - GA4_구매전환_Npay
   - GA4_장바구니 담기
16. [new]Google 태그는 무조건 삭제가 아니라 autonomous page_view off 여부를 확인하고 shell 역할만 남길지 판단해야 함
17. HURDLERS 변수 source 확인 사실:
   - HURDLERS - GA4 상품정보 -> dataLayer variable hurdlers_ga4.items
   - HURDLERS - GA4 Value -> dataLayer variable hurdlers_ga4.value
   - HURDLERS - GA4 shipping -> dataLayer variable hurdlers_ga4.shipping
   - HURDLERS - GA4 Transaction_id -> dataLayer variable hurdlers_ga4.transaction_id
18. 일반 구매 DebugView에서 실제로 확인된 이벤트:
   - page_view
   - view_item
   - add_to_cart
   - begin_checkout
   - purchase
19. purchase DebugView에서 확인된 파라미터:
   - transaction_id = 202603298840444
   - value = 260000
   - currency = KRW
20. items는 GTM source variable은 존재하지만 DebugView 실측 확인은 아직 미완료
21. NPay는 외부 도메인(pay.naver.com / orders.pay.naver.com) 구조상 최종 완료를 W2 GTM으로 직접 추적하기 어려움
22. 따라서 NPay는 현재 기준으로 “버튼 클릭/진입 기반 보조 추적 + 주문 DB 대조”로 정의

이번 턴에서 Codex가 해야 할 일:

1. GTM 작업 사양서 작성
반드시 표 형식:
- 태그명
- 현재 상태
- 현재 목적지
- 바꿀 액션 (유지 / pause / unpause / rename / 신규 생성 / 제거 후보)
- 이유
- 변경 후 기대 이벤트
- 검증 방법

반드시 포함:
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
- HURDLERS [이벤트전송] 네이버페이 구매
- HURDLERS [이벤트전송] 회원가입 완료

2. page_view 중복 제거 실행안
아래를 구체적으로 작성:
- canonical page_view sender
- GA4_픽셀2를 언제 pause할지
- [new]Google 태그를 shell로 둘지, page_view를 꺼야 하는지
- direct gtag G-8 제거 시점
- Preview / DebugView 정상 판정 기준

3. purchase payload 정합성 사양
필드를 아래 4열로 정리:
- 필드명
- source 존재 여부
- 현재 실측 확인 상태
- 조치
대상 필드:
- transaction_id
- value
- currency
- items
- shipping
- tax
- coupon
- payment_type

중요:
- items는 source variable은 존재하지만 DebugView 실측 확인은 아직 미완료로 적을 것
- tax/coupon/payment_type는 source가 불명확하거나 미구현일 가능성이 크므로 그렇게 구분할 것

4. items 검증/보강안
반드시 포함:
- HURDLERS - GA4 상품정보 source = hurdlers_ga4.items
- expected items schema
  - item_id
  - item_name
  - price
  - quantity
  - item_brand
  - item_variant
- Preview / dataLayer / DebugView에서 어떻게 확인할지
- items가 DebugView에서 안 보일 수 있는 원인 후보
- payload shape 보정안

5. HURDLERS core event 정본화 사양
아래 이벤트를 W2/G-W 정본 이벤트로 재정의하는 구체안을 작성:
- 상세페이지 조회 -> view_item
- 장바구니 담기 -> add_to_cart
- 장바구니 보기 -> view_cart
- 주문서작성 -> begin_checkout
- 구매 -> purchase
- 회원가입 완료 -> sign_up

각 항목에 대해:
- 현재 sender
- target sender
- 현재 event name
- target event name
- 필요한 param
- 관련 dataLayer/변수
- 검증 방법

6. add_payment_info 구현/정의안
아래를 작성:
- 일반 결제에서 별도 add_payment_info를 둘지
- NPay 버튼 클릭은 add_payment_info로 볼지, npay_click으로 둘지
- payment_type 표준값 제안
- purchase와 혼동되지 않게 하는 기준
- DebugView 정상 예시

7. NPay 후속 검증안
다음 항목을 체크리스트로 작성:
- 왜 현재 구조상 최종 완료를 W2에서 직접 보기 어려운지
- 지금 확보된 NPay 신호가 무엇인지
- 컷오버 후 어느 시점에 다시 테스트할지
- 어떤 태그가 fired되어야 하는지
- 어떤 이벤트가 DebugView에 보여야 하는지
- 최종 완료는 어떤 DB 대조로 보완할지

8. 주문 DB reconciliation 초안
실무적으로 작성:
- 필요한 테이블/컬럼 가정
- 일반 구매 / NPay 분리
- GA4 purchase vs DB paid order count
- GA4 revenue vs DB amount
- source / medium / campaign 확인 포인트
- pseudo-SQL 또는 SQL 초안

9. 추가 자료 요청
반드시 아래 형식으로 분리:
- 필수자료
- 참고자료
중요:
- 이미 확보된 자료는 다시 요구하지 말 것
- 현재 턴 기준 꼭 필요한 것만 적을 것

출력 형식:
1) 10초 요약
2) 최신 확정 상태
3) 정본 구조 선언
4) GTM 작업 사양서
5) page_view 중복 제거 실행안
6) purchase payload 정합성 사양
7) items 검증/보강안
8) HURDLERS core event 정본화 사양
9) add_payment_info 구현/정의안
10) NPay 후속 검증안
11) 주문 DB reconciliation 초안
12) 필수자료 / 참고자료
13) Day 0 / Day 1 / Day 3 작업 순서
14) 최종 리스크

중요:
- 새 컨테이너 제안 금지
- 전략 재토론 금지
- W2/G-W 정본 기준을 흔들지 말 것
- GTM UI를 직접 클릭할 수 없는 현실을 반영하되, 작업자가 실행 가능한 수준으로 구체적으로 써라