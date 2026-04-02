더클린커피 아임웹 사이트에서 P1-S1A live row를 운영 DB 수정 없이 띄우기 위한 “짧은 조사 + 바로 실행안”만 해라.

목표:
- 오늘 안에 넣을 코드의 최종판을 확정하는 것
- 우선순위는 V0 payment-success 1건 live 적재
- 그 다음 V1 landing/utm 저장
- V2 checkout-context는 후순위

반드시 확인할 것:
1. 외부에서 호출 가능한 HTTPS backend endpoint를 무엇으로 쓸지
   - ngrok / 배포 URL 중 무엇이 가장 빠른지
   - 최종 endpoint URL을 정확히 제시
2. 더클린커피 결제완료 페이지(`?mode=shop_order_done`)에서 orderId 또는 주문번호를 어디서 가장 안정적으로 가져올 수 있는지
   - 우선순위: URL 파라미터 → dataLayer → 전역 JS 변수 → DOM
   - 실제로 무엇이 잡히는지 확인
3. 장바구니/결제진입 감지 위치(`shop_cart`, `shop_pay` 등)를 확인
4. 현재 GTM/dataLayer에서 purchase 관련 값이 이미 push되는지 확인
5. fetch keepalive와 sendBeacon 중 무엇을 1순위로 쓸지 최종 결정
6. Beusable 중복 삽입은 어떤 위치를 남기고 어떤 위치를 제거할지 제안
7. 최종 출력은 아래 형식으로 줄 것:
   - 10초 요약
   - go / no-go
   - 오늘 바로 넣을 코드 2개
     1) 헤더 상단 V1
     2) 푸터 V0
   - 각 코드의 정확한 삽입 위치
   - 내가 바꿔야 하는 값(예: endpoint URL)
   - 검증 방법 5줄