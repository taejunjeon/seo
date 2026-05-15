# Direct Pixel C Plan Secondary

작성 시각: 2026-05-15 03:31 KST

## 결론

전체 Pixel 직접 삽입은 지금 1순위가 아니다. PageView는 이미 firing confirmed이고, 전체 Pixel을 다시 넣으면 PageView/ViewContent 중복부터 발생할 수 있다. Purchase 중복 위험도 커진다.

## C안 정의

C안은 FBE OFF + direct Pixel ON 또는 direct Pixel을 별도 운영 삽입하는 30분 실험이다.

## 언제 검토하는가

fallback-only Block 4가 실패할 때만 검토한다.

조건:

- AddToCart/InitiateCheckout/AddPaymentInfo fallback이 Network에서 안 잡힘.
- FBE/native trigger가 계속 누락됨.
- PageView 중복은 실험 시간 동안 허용 가능.
- Purchase는 직접 Pixel에서 제외.

## 실험 조건

- 시간: 30분 이하.
- 대상: 테스트 브라우저/짧은 window.
- Purchase 직접 발화 금지.
- GTM publish 금지.
- Imweb 저장은 TJ님 승인 필요.
- 종료 후 원복 확인.

## 성공 기준

- PageView/ViewContent는 중복 가능성을 별도 표시.
- AddToCart/InitiateCheckout/AddPaymentInfo가 Network 200.
- Purchase 증가 0.
- 실험 종료 후 원래 구조 복귀.

## 현재 추천

보류. 먼저 fallback-only Block 4와 backend guard 배포가 더 낮은 리스크다.
