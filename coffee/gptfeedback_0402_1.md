더클린커피 P1-S1A는 live row + UTM 검증까지 완료했다. 이제 새 기능보다 운영 고정과 바이오컴 확장 준비를 하라.

해야 할 일:
1. attribution 필드 정본 정의 문서 작성
   - orderNo
   - orderId
   - paymentKey
   - paymentCode
   - orderCode
   - amount
   - source
   각 필드의 의미, source of truth, fallback 규칙 정리
2. 더클린커피용 현재 구조를 운영용 체크리스트로 정리
   - 헤더 상단 V1
   - 푸터 V0.2
   - Cloudflare endpoint
   - source filter 조회 방법
3. 바이오컴 확장 준비
   - 바이오컴 결제완료 URL 패턴 확인 절차
   - 바이오컴용 푸터 코드 초안 작성
   - source를 biocom_imweb로 분리
4. 고정 endpoint 전환안 제시
   - trycloudflare 임시 주소에서 named tunnel 또는 고정 서브도메인으로 바꾸는 절차
5. 출력 형식:
   - 10초 요약
   - 필드 정본 표
   - 더클린커피 운영 체크리스트
   - 바이오컴 확장 준비안
   - 고정 endpoint 전환안
   - 바로 다음 액션 1개