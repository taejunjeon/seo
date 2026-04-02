더클린커피 아임웹에 헤더 상단 V1과 푸터 V0 삽입 완료 상태다.

지금부터는 새 기능 개발보다 “첫 실전 테스트 주문 1건 검증”만 해라.

목표:
- 더클린커피 테스트 주문 1건 이후 live row 1건 이상 확인
- payment-success payload에 필요한 필드가 실제로 들어오는지 검증
- orderId 추출이 어디에서 잡혔는지 확인
- 다음 단계로 checkout-context(V2)가 정말 필요한지 판단

반드시 확인할 것:
1. ngrok URL이 현재도 살아 있는지 health 체크
2. 테스트 주문 후 `GET /api/attribution/ledger`에서 live row가 몇 건 들어왔는지 확인
3. 가장 최근 live row의 payload 확인:
   - touchpoint
   - captureMode
   - source
   - orderId
   - clientObservedAt
   - landing
   - originalReferrer
   - utm_source / utm_medium / utm_campaign
   - gclid / fbclid
4. orderId가 비어 있으면 원인을 분류:
   - URL 파라미터 없음
   - dataLayer 없음
   - DOM selector 실패
5. `thecleancoffee_imweb` source로 들어온 row만 따로 요약
6. 가능하면 orderId 기준으로 Toss API/기존 진단 로직과 대조 가능한지 확인
7. 다음 액션을 아래 중 하나로 명확히 결론:
   - A. 현재 구조로 충분, V1/V0 유지 후 테스트 확대
   - B. orderId 추출 보강 필요
   - C. checkout-context(V2) 바로 진행 필요
   - D. 결제완료 페이지 외 별도 훅 필요

출력 형식:
- 10초 요약
- live row 결과
- payload 확인표
- orderId 추출 성공/실패 원인
- 바로 다음 액션 1개