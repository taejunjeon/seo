# 구현 승인안

## 목표

Meta Purchase 이벤트 매칭 품질을 6.1/10에서 올리기 위해, 현재 빠진 사용자 매칭 정보 후보를 안전하게 CAPI payload에 넣을 준비를 한다.

## 단계 1. no-send dry-run patch

Lane: Green to Yellow

무엇을 하는가:

- CAPI payload builder가 Imweb 주문 캐시를 read-only join한다.
- 전송하지 않고 `external_id_candidate_present`, `phone_hash_candidate_present`만 계산한다.
- raw 값은 출력하지 않는다.

왜 하는가:

- 실제 Meta 전송 전에 “몇 %의 Purchase에서 품질 개선 후보가 붙는지” 확인하기 위해서다.

성공 기준:

- 최근 24h/7d에서 site별 후보율이 산출된다.
- raw identifier output 0.
- Meta send 0.

## 단계 2. payload preview

Lane: Yellow

무엇을 하는가:

- 실제 send 직전 payload shape만 preview한다.
- `user_data.external_id`와 `user_data.ph`가 presence로만 보이는지 확인한다.
- duplicate/value/refund guard가 기존과 동일하게 적용되는지 확인한다.

왜 하는가:

- 매칭 품질을 올리려다 잘못된 주문이나 취소 주문을 보내면 ROAS가 오염되기 때문이다.

성공 기준:

- confirmed + value guard pass + duplicate 0 row만 preview 대상.
- pending/unknown/0원/canceled/refunded no-send.

## 단계 3. 제한 배포

Lane: Red

무엇을 하는가:

- TJ님 승인 후 실제 Purchase CAPI에 hashed phone과 safe external_id를 포함한다.
- 우선 biocom 또는 thecleancoffee 한 사이트, 짧은 window로 시작한다.

왜 하는가:

- 고객 정보를 해시하더라도 외부 플랫폼으로 추가 전송하는 것이므로 명시 승인이 필요하다.

성공 기준:

- Meta CAPI success 유지.
- duplicate event_id 0.
- Event Match Quality가 24~72시간 내 상승 방향.
- Meta UI shared customer information에서 phone/external_id 비율 증가.

## 단계 4. 모니터링

Lane: Green

무엇을 하는가:

- Event Match Quality score.
- ph/external_id presence rate.
- fbc/fbp presence rate.
- CAPI success/failed/duplicate.
- Ads attributed purchase lag.

왜 하는가:

- EMQ가 올라가도 send 실패나 중복이 생기면 오히려 더 위험하기 때문이다.

성공 기준:

- CAPI success rate 99% 이상.
- failed 0 또는 즉시 원인 분류.
- duplicate event_id 0.
- raw id output 0.
