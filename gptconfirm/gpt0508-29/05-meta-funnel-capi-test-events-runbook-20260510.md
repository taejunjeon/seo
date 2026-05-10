# Meta funnel CAPI Test Events runbook - 2026-05-10

## 한 줄 결론
Meta 구매 전 퍼널 이벤트 CAPI는 운영 송출을 켜는 단계가 아니다. TJ님이 Meta Events Manager에서 test_event_code를 발급한 뒤, Test Events 탭에서만 6종 이벤트를 각 1회 이하로 확인하는 준비 단계다.

## 현재 판정
- readiness: READY_FOR_TEST_EVENT_CODE
- operational send: HOLD
- Purchase event: NO
- GTM Production publish: NO
- raw email/phone/order/member_code logging: NO

## TJ님이 준비할 화면
1. Meta Events Manager 접속
2. Dataset/Pixel 후보: 1283400029487161
3. Test Events 탭 열기
4. test_event_code 발급
5. 코드 원문은 문서에 저장하지 않고 대화/실행 환경에서만 사용

## Codex 실행 조건
- test_event_code가 있어야 한다.
- 각 이벤트는 1회 이하만 호출한다.
- ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Lead, Search만 허용한다.
- Purchase는 호출하지 않는다.
- production count 증가 0을 확인한다.

## Payload 원칙
- event_id는 이벤트마다 고유하게 둔다.
- event_source_url은 테스트 URL만 사용한다.
- user_data는 _fbp, _fbc, user_agent, client_ip 수준으로 제한한다.
- email/phone/external_id는 별도 hash 정책 승인 전 제외한다.
- value는 구매 이벤트가 아니므로 0 또는 생략한다.

## Smoke 순서
1. VM Cloud endpoint와 Meta token/env 존재 여부를 read-only로 확인한다.
2. test_event_code 포함 payload preview를 만든다.
3. ViewContent 1회 전송 후 Test Events 탭 수신을 확인한다.
4. 나머지 이벤트는 수신 확인이 되면 각 1회 이하로 전송한다.
5. production count 증가 0, Purchase 0, raw PII log 0을 확인한다.
6. 결과를 gptconfirm batch에 JSON/Markdown으로 기록한다.

## 실패 시 확인점
- test_event_code 만료
- Dataset ID 불일치
- Meta access token/env 누락
- endpoint route/CORS 실패
- event_id 누락
- Test Events 탭 필터 문제

## 승인 문구 후보

```text
YES: Meta funnel CAPI Test Events smoke를 승인합니다.
범위는 Dataset 1283400029487161, test_event_code 필수, ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo/Lead/Search 각 1회 이하입니다. Purchase, operational send, GTM publish, raw PII 저장/logging은 금지합니다.
```
