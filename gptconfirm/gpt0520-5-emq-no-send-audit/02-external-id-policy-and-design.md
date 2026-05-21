# external_id 정책과 설계

## 쉬운 설명

`external_id`는 Meta가 “이 구매가 같은 사람에게서 온 신호인지” 더 잘 맞추기 위해 받는 사용자 식별 보조키다. 주문번호가 아니라 사람을 안정적으로 구분하는 키에 가깝다.

## 원문 회원 ID 사용 판단

| 방법 | 가능 여부 | 이 프로젝트 판단 | 이유 |
|---|---|---|---|
| raw email / raw phone | 금지 | 금지 | 직접 개인정보라 원문 전송 금지 |
| raw member code | 기술적으로는 가능할 수 있음 | 비권장, 운영상 금지 취급 | 내부 ID라도 원문이 외부 플랫폼/로그에 남으면 추적 가능성이 생김 |
| plain SHA-256 member code | 가능 | 제한적 가능 | 원문은 숨기지만 member code 형식이 예측 가능하면 역추적 위험이 남음 |
| HMAC-SHA256 member code | 권장 | 권장 | secret이 없으면 원문 복원이 어려워 안전성이 높음 |
| order code / payment key 기반 external_id | 기술적으로 가능할 수 있음 | Purchase에는 비권장 | 주문/결제 단위라 사람 식별 품질이 낮고, 매칭 품질 개선 목적과 다름 |

## 권장 설계

### 1. external_id

- source: Imweb `member_code`
- transform: `HMAC_SHA256(secret, site + ':' + member_code)`
- payload field: `user_data.external_id`
- log/report: presence boolean만 남김
- raw output: 0

회원이 아닌 주문은 external_id를 억지로 만들지 않는다. 전화번호가 있으면 `ph`로만 보조한다.

### 2. phone hash

- source: Imweb orderer phone
- transform:
  - 숫자만 남김
  - 국가번호/앞자리 정규화 규칙 고정
  - SHA-256 해시
- payload field: `user_data.ph`
- log/report: `phone_hash_present=true`처럼 presence만 남김
- raw output: 0

### 3. email

현재 VM audit에서는 email 후보가 0이다. Imweb 상세 API나 회원 테이블에서 합법적/정책상 허용된 source가 확인되기 전까지는 email 확장을 보류한다.

## 코드 레벨 변경 후보

- `backend/src/metaCapi.ts`
  - `MetaCapiUserData`에 `external_id` 필드 추가.
  - Purchase 후보 생성 시 Imweb order cache를 safe join.
  - member code는 raw로 로그하지 않고 즉시 HMAC.
  - phone은 정규화 후 hash.
  - send log에는 `external_id_present`, `ph_present` 같은 boolean만 남김.

## 안전 조건

- raw member/order/payment/click id output 0.
- 기존 duplicate event_id guard 유지.
- canceled/refunded/0원/pending no-send 유지.
- no-send dry-run에서 후보율과 payload presence만 먼저 확인.
- 실제 Meta 전송은 별도 Red 승인 후 진행.

## 참고한 공식 자료

- Meta Conversions API 개요: https://www.facebook.com/business/help/AboutConversionsAPI
- Meta Conversions API Direct Integration Playbook: https://storage.googleapis.com/lr-tech-docs-resources/PDFs/Conversions-API-Direct-Integration-Playbook_English.pdf
