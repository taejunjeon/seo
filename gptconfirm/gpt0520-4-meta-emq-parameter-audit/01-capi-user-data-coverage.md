# CAPI user_data coverage

## 관측 기준

- 기준 시각: 2026-05-20 23:20 KST.
- source: VM Cloud attribution ledger + CAPI send log + provider read-only diagnostic.
- site: biocom, thecleancoffee.
- raw identifier output: 0.

## 코드 기준

`backend/src/metaCapi.ts`는 다음 값을 `user_data`에 넣을 수 있다.

- `client_ip_address`
- `client_user_agent`
- `fbc`
- `fbp`
- hashed `em`
- hashed `ph`

현재 코드가 하지 않는 것:

- `user_data.external_id` 전송.
- Facebook login ID 전송.

## 운영 관측

| 항목 | 상태 | 의미 |
|---|---|---|
| IP 주소 | 정상 | 모든 표본에서 존재 |
| 사용자 에이전트 | 정상 | 모든 표본에서 존재 |
| fbp | 정상 | 바이오컴 1건 외 대부분 존재 |
| fbc | 부분 | Meta 광고 클릭 단서가 있는 row에만 존재 |
| 이메일 | 미연동 | 코드 준비는 있으나 provider 표본에서 0건 |
| 전화번호 | 미연동 | 코드 준비는 있으나 provider 표본에서 0건 |
| external_id | 미연동 | 안전한 HMAC/safe id 설계 필요 |
| Facebook login ID | 보류 | 현재 사이트 구조상 낮은 우선순위 |

## 해석

이벤트 매칭 품질 6.1/10은 구매 이벤트 실패가 아니다. 구매는 회복됐지만 Meta가 구매자를 더 정확히 식별할 이름표가 부족하다는 뜻이다.

우선순위:

1. fbc/fbclid capture gap audit.
2. 이메일/전화번호 후보율 no-send audit.
3. safe `external_id` 설계.
4. Test Events에서 EMQ 개선 smoke.
