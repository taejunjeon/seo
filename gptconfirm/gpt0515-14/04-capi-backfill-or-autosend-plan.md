# 04. CAPI backfill or auto-send plan

작성 시각: 2026-05-15 11:48 KST

## 현재 상태

대상 safe_ref는 실제 결제완료다.

- VM Cloud `payment_success`: confirmed.
- amount: 11,900원.
- payment key presence: 있음.
- Toss direct: confirmed.
- Meta CAPI send log: 해당 건 0건.

그런데 현재 CAPI selector는 이 row를 제외한다.

제외 사유:

- `noSendReason=explicit_non_purchase_candidate`.
- payment_success payload에 `meta_purchase_candidate=false`가 남아 있음.
- `value_guard_required_before_meta_send=true`도 남아 있으나 value guard pass marker는 아직 없음.

해석:

`meta_purchase_candidate=false`는 원래 브라우저가 결제 직후 확인 전에는 Purchase로 보지 말라는 안전장치다. 하지만 서버가 나중에 `payment_success confirmed + Toss DONE`으로 닫은 뒤에도 이 플래그를 영구 no-send로 보면, 실제 구매가 CAPI에서도 빠진다.

## Red 승인안 A. 단건 CAPI backfill

목표:

- safe_ref 1건, 11,900원만 Meta CAPI Purchase로 전송한다.

전송 조건:

- Pixel: `1283400029487161`.
- event_name: Purchase.
- event_time: 실제 승인 시각.
- value/currency: 11,900 KRW.
- source: VM Cloud `payment_success confirmed` + Toss direct confirmed.
- duplicate event id 0.
- payment_page_seen/checkout_started는 전송 금지.

금지:

- 다른 pending/unknown row 전송.
- 대량 backfill.
- Browser Purchase fail-open.
- 운영DB write.

성공 기준:

- attempted 1.
- success 1.
- events_received 1.
- duplicate 0.

승인:

- Meta CAPI Purchase send는 Red Lane이므로 TJ님 명시 승인 전 실행 금지.

## Yellow+Red 승인안 B. CAPI auto-send gate patch

backend patch:

1. `payment_page_seen`은 계속 no-send.
2. `payment_success confirmed + paymentKey + completion allowlist + Toss DONE`이면 `meta_purchase_candidate=false`를 pre-confirmation flag로만 해석한다.
3. `value_guard_required_before_meta_send=true`여도 paymentKey가 있으면 Toss direct에서 value guard를 닫고 후보로 통과시킨다.
4. 0원, 취소/환불, duplicate event id, value mismatch는 계속 no-send.

주의:

- patch 배포 자체는 VM Cloud backend Yellow.
- patch 후 자동 Meta CAPI send가 켜지면 platform send이므로 Red 승인 범위가 필요하다.

성공 기준:

- 대상 safe_ref가 dry-run candidate 1건으로 보인다.
- pending/unknown row candidate 0.
- payment_page_seen candidate 0.
- value mismatch candidate 0.

## 운영DB 대신 VM Cloud/Imweb direct를 쓰는 안

운영DB는 이번 건에서 0건이었다. 운영DB sync가 빠르지 않으면 결제 직후 복구에 부적합하다.

추천 source priority:

1. VM Cloud `payment_success` live row + paymentKey/orderId exact.
2. Toss direct `DONE` + amount.
3. Imweb v2 exact order lookup의 card/amount/complete time presence.
4. 운영DB `PAYMENT_COMPLETE`는 cross-check 또는 지연 보강.

Imweb v2 API는 도움이 된다. 다만 status label이 `WAIT`처럼 표시될 수 있어 `imweb_status` 단독으로 actual purchase를 확정하면 안 된다. card 결제는 Toss direct가 더 강한 primary다.
