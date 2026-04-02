더클린커피 P1-S1A 1차 live row 적재 성공 상태다. 지금부터는 새 삽입 코드보다 “데이터 정리와 검증 품질 향상”에 집중해라.

현재 확인된 사실:
- 결제완료 URL은 `shop_payment_complete`
- live row 적재 성공
- orderId는 URL 파라미터에서 자동 추출됨
- referrer 안에 orderCode, orderNo, paymentCode, orderId, paymentKey, amount가 포함됨
- 현재 구조는 V1/V0 유지 후 테스트 확대가 맞고, checkout-context(V2)는 급하지 않음

해야 할 일:
1. backend에서 `document.referrer` 또는 수신 referrer URL을 파싱해 아래 필드를 구조화 저장/표시하도록 정리
   - orderCode
   - orderNo
   - paymentCode
   - orderId
   - paymentKey
   - amount
2. `source=thecleancoffee_imweb` 기준으로 live row만 따로 보는 간단한 확인 API/뷰 또는 요약 로직 정리
3. 더클린커피용 Toss Secret Key가 있으면 어디에 넣고 어떤 endpoint로 cross-check할지 정리
4. UTM 붙은 URL로 재테스트 시, receiver payload에서 아래 값이 들어오는지 검증 시나리오 작성
   - landing
   - originalReferrer
   - utm_source
   - utm_medium
   - utm_campaign
   - gclid / fbclid
5. 현재 footer code의 감지 조건이 `shop_payment_complete`와 `shop_order_done` 둘 다 포함되어 있는지 최종 점검
6. 다음 단계 판단:
   - A. 현재 구조 유지 + UTM 테스트 확대
   - B. referrer 파싱만 보강
   - C. 더클린커피에서는 이 정도면 충분, 바이오컴으로 확장 준비
중 하나로 결론

출력 형식:
- 10초 요약
- 현재 확보된 필드 / 아직 비어 있는 필드
- backend 정리안
- UTM 재테스트 체크리스트
- 바이오컴 확장 전 필요한 것 3개