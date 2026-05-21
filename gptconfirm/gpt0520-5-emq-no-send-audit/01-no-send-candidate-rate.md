# no-send 후보율 상세

## 정의

- confirmed 후보: VM Cloud에서 결제완료 후보로 닫힌 Purchase 후보 row.
- CAPI success key match: 같은 safe key 계열에서 Meta CAPI success send log가 확인된 row.
- 현재 email/phone 관측: 현재 CAPI 입력 또는 ledger metadata에서 email/phone 후보가 보이는지.
- Imweb phone hash 후보: Imweb 주문 캐시에 주문자 전화번호가 있어, 정규화 후 해시하면 `ph` 후보가 될 수 있는지.
- Imweb member 기반 external_id 후보: Imweb 주문 캐시에 member code가 있어, secret 기반 safe external_id 후보가 될 수 있는지.

## 최근 24시간

### biocom

- confirmed 후보: 43
- CAPI success key match: 41
- duplicate event_id: 0
- failed send: 0
- `client_ip_address`: 43 / 43
- `client_user_agent`: 43 / 43
- `fbp`: 42 / 43
- `fbc`: 18 / 43
- `fbclid` 또는 `fbc` 복원 가능: 19 / 43
- 현재 email 후보: 0 / 43
- 현재 phone 후보: 0 / 43
- 현재 external_id sent: 0 / 43
- Imweb member 기반 external_id 후보: 43 / 43
- Imweb phone hash 후보: 43 / 43

### thecleancoffee

- confirmed 후보: 16
- CAPI success key match: 16
- duplicate event_id: 0
- failed send: 0
- `client_ip_address`: 16 / 16
- `client_user_agent`: 16 / 16
- `fbp`: 16 / 16
- `fbc`: 5 / 16
- `fbclid` 또는 `fbc` 복원 가능: 5 / 16
- 현재 email 후보: 0 / 16
- 현재 phone 후보: 0 / 16
- 현재 external_id sent: 0 / 16
- Imweb member 기반 external_id 후보: 16 / 16
- Imweb phone hash 후보: 16 / 16

## 최근 7일

### biocom

- confirmed 후보: 368
- CAPI success key match: 352
- duplicate event_id: 0
- failed send: 0
- `client_ip_address`: 368 / 368
- `client_user_agent`: 368 / 368
- `fbp`: 362 / 368
- `fbc`: 171 / 368
- `fbclid` 또는 `fbc` 복원 가능: 172 / 368
- 현재 email 후보: 0 / 368
- 현재 phone 후보: 0 / 368
- 현재 external_id sent: 0 / 368
- Imweb member 기반 external_id 후보: 368 / 368
- Imweb phone hash 후보: 368 / 368

### thecleancoffee

- confirmed 후보: 174
- CAPI success key match: 174
- duplicate event_id: 0
- failed send: 0
- `client_ip_address`: 174 / 174
- `client_user_agent`: 174 / 174
- `fbp`: 174 / 174
- `fbc`: 41 / 174
- `fbclid` 또는 `fbc` 복원 가능: 41 / 174
- 현재 email 후보: 0 / 174
- 현재 phone 후보: 0 / 174
- 현재 external_id sent: 0 / 174
- Imweb member 기반 external_id 후보: 174 / 174
- Imweb phone hash 후보: 174 / 174

## no-send bucket

| bucket | 의미 | 현재 판단 |
|---|---|---|
| source_present_not_sent | source는 있는데 현재 CAPI payload에 안 들어감 | Imweb member code, Imweb orderer phone |
| source_missing_or_not_joined | source가 현재 CAPI 입력에 없음 | email |
| already_sent_or_healthy | 이미 대부분 들어감 | IP, user agent, fbp |
| partial_source | 일부 유입에서만 들어감 | fbc/fbclid |
| not_recommended_for_purchase | 기술적으로 가능해도 구매 매칭 품질용으로 부적합 | order_no/order_code/payment_key 기반 external_id |
