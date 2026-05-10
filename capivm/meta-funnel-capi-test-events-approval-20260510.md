# Meta funnel CAPI Test Events approval packet (2026-05-10)

작성 시각: 2026-05-10 18:05 KST
Lane: Yellow approval packet
Mode: approval document only

## 한 줄 결론

Meta 구매 전 퍼널 이벤트를 운영 송출로 켜자는 문서가 아니다. Meta Events Manager의 Test Events 탭으로만 6종 이벤트를 각 1회 이하 보내서 서버 CAPI 경로와 browser/server dedup이 작동하는지 확인하자는 제한 승인안이다.

## 무엇을 승인하는가

TJ님이 Meta Events Manager에서 `test_event_code`를 발급하면, Codex가 아래 이벤트를 테스트 탭으로만 보낸다.

- `ViewContent`: 상품/콘텐츠 조회
- `AddToCart`: 장바구니 담기
- `InitiateCheckout`: 주문서 또는 결제 흐름 시작
- `AddPaymentInfo`: 결제정보 단계 진입. 구매완료가 아니다.
- `Lead`: 리드/회원가입 후보
- `Search`: 검색 행동 후보

대상 Pixel/Dataset 후보는 기존 문서 기준 `1283400029487161`이다.

## 왜 필요한가

Meta ROAS 개선에는 구매 전 신호가 필요할 수 있다. 하지만 바로 운영 CAPI를 켜면 Meta 이벤트 수와 학습 신호가 바뀐다. 먼저 Test Events에서 서버 수신, event_id, dedup, payload 안전성을 확인해야 한다.

## 어떻게 진행하는가

1. TJ님이 Meta Events Manager > Dataset `1283400029487161` > Test Events 탭에서 `test_event_code`를 발급한다.
2. Codex는 `test_event_code`가 있는 payload만 VM Cloud endpoint에 보낸다.
3. 각 이벤트는 1회 이하로 제한한다.
4. Test Events 탭에 이벤트가 보이는지 확인한다.
5. 운영 이벤트 카운트 증가, Purchase 발화, raw PII 저장이 없는지 확인한다.

## 허용 범위

- Meta Test Events smoke
- 6종 이벤트 각 1회 이하
- `test_event_code` 포함 호출
- no purchase event
- no GTM Production publish
- no Imweb production save
- no permanent env ON
- 결과 문서 작성

## 금지 범위

- `test_event_code` 없는 Meta CAPI 운영 송출
- `Purchase` 이벤트 송출 또는 변경
- GTM Production publish
- Imweb header/footer production save
- Pixel ID/token/env 변경
- raw email/phone/member_code/order/payment 저장 또는 logging
- Meta CAPI operational send

## Payload 안전 기준

- `event_id` 필수
- `event_source_url`은 테스트 URL만 사용
- user_data는 기본적으로 `_fbp`, `_fbc`, user agent, client IP 수준에서 검토한다
- email/phone/external_id는 별도 hash 정책 승인 전 제외
- 건강 상태를 추정할 수 있는 민감 custom_data 금지
- value는 구매 이벤트가 아니므로 `0` 또는 생략
- `test_event_code` 원문은 문서에 저장하지 않고 마스킹만 허용

## 성공 기준

- Test Events 탭에서 6종 이벤트 수신
- endpoint 2xx
- Meta 응답에 `fbtrace_id` 또는 동등한 trace 확인
- Browser/Server dedup 테스트 시 동일 event_id 확인
- production count 증가 0
- 의도치 않은 Purchase 0
- raw PII 저장/logging 0

## 실패 시 다음 확인점

- `test_event_code` 만료
- Pixel/Dataset ID 불일치
- Meta token/env 누락
- Origin whitelist/CORS
- event_id 누락
- Test Events 탭 필터

## 승인 문구

```text
YES: Meta funnel CAPI Test Events smoke를 승인합니다.

범위:
- Pixel/Dataset 1283400029487161
- test_event_code 필수
- ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Lead, Search 각 1회 이하
- Purchase 이벤트 금지
- 운영 송출 금지
- GTM Production publish 금지
- Imweb production save 금지

성공 기준:
- Test Events 탭 수신
- production count 증가 0
- raw PII 저장/logging 0
```

## Auditor verdict

PASS_WITH_NOTES

- 승인 문서 작성만 수행했다.
- Meta 호출은 하지 않았다.
- 운영 송출은 금지 상태다.
