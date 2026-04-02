P1-S1A는 더클린커피/바이오컴 모두 기술 검증 완료 상태다. 이제 새 계측보다 운영 고정에 집중하라.

해야 할 일:
1. Cloudflare Quick Tunnel을 고정 endpoint(Named Tunnel 또는 고정 서브도메인)로 전환하는 실행안 작성
2. 전환 후 두 사이트에서 바꿔야 하는 푸터 코드 URL 1줄 정리
3. 운영 체크리스트 작성
   - source=thecleancoffee_imweb 최근 live
   - source=biocom_imweb 최근 live
   - paymentKey 존재율
   - amount 존재율
   - utmSource 비어있는 비율
4. 첫 운영형 성과 리포트 초안 작성
   - source별 주문 건수
   - channel_talk / campaign 유입 건수
   - 결제 금액 합계
5. checkout-context(V2)를 지금 바로 할지, 보류할지 한 줄 결론

출력 형식:
- 10초 요약
- 고정 endpoint 전환안
- 운영 체크리스트
- 첫 성과 리포트 초안
- 바로 다음 액션 1개