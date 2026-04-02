더클린커피 아임웹 사이트를 P1-S1A 테스트베드로 삼아, 운영 DB 수정 없이 `seo/backend`의 기존 attribution receiver를 실제 사이트에서 호출하는 최소 구현안을 조사하고 제안해라.

목표:

1. `POST /api/attribution/payment-success`로 live row 1건 이상 적재
2. 가능하면 `POST /api/attribution/checkout-context`도 추가
3. 저장은 기존 JSONL ledger 유지, 운영 DB migration 없음

반드시 확인할 것:

* 아임웹에서 실제로 사용 가능한 삽입 포인트: 헤더 상단, 헤더, 바디, 푸터, 결제완료 페이지
* 결제완료 페이지에서 JS로 얻을 수 있는 값: orderId, 주문번호, paymentKey, approvedAt, 상품명, 금액
* 최초 랜딩의 `utm_*`, `gclid`, `fbclid`, `referrer`, `landing URL`을 sessionStorage/localStorage에 저장 후 결제완료까지 유지 가능한지
* checkout 시작 시점을 잡을 수 있는 가장 안정적인 훅: 장바구니 페이지 진입, checkout 버튼 클릭, URL 패턴 감지, DOM 이벤트
* 현재 삽입된 GTM/Meta/Naver/Beusable/Keepgrow 스크립트와 충돌 가능성
* CORS / preflight / sendBeacon 사용 필요 여부
* 실제 아임웹에 저장된 코드 원문이 대화창 붙여넣기와 동일한지, markdown 깨짐인지
* 구현안을 3단계로 나눠 제안:

  * V0: payment-success만
  * V1: landing/utm 저장 + payment-success
  * V2: checkout-context + payment-success
* 각 단계별로 필요한 코드 위치, 수집 필드, 검증 방법, 실패 시 fallback 제시

출력 형식:

* 10초 요약
* 현재 가능/불가능 판단
* 아임웹 삽입 위치별 구현 가능성
* V0/V1/V2 구현안
* 위험요소 5개
* 검증 체크리스트
* 내가 아임웹에서 직접 해야 할 일과 Codex가 할 일을 분리
