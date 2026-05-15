# Backend Guard And Value Guard

작성 시각: 2026-05-15 03:01 KST

```yaml
harness_preflight:
  lane:
    local_patch: Green
    vm_cloud_deploy_restart: Yellow approval required
    meta_purchase_send: Red approval required
  source_window_freshness_confidence:
    source: "로컬 backend source + VM Cloud attribution_ledger read-only aggregate"
    window: "2026-05-15 02:00-03:01 KST"
    freshness: "2026-05-15 03:01 KST"
    confidence: 0.93
  forbidden_actions:
    - VM Cloud deploy/restart without approval
    - Meta 운영 Purchase send
    - 운영DB write/import
    - raw identifier output
```

## 왜 필요한가

현재 문제의 핵심은 결제 진행 페이지(`/shop_payment/`)가 구매완료(`payment_success`)처럼 들어오면 Meta Purchase 후보를 오염시킬 수 있다는 점이다. Footer v4.4.2가 오염을 줄였지만, 서버도 같은 guard를 가져야 다음 실수나 우회 payload를 막을 수 있다.

## 로컬 패치 내용

- `payment_page_seen` touchpoint를 attribution ledger type에 추가했다.
- `/api/attribution/checkout-context`는 `metadata.semantic_touchpoint=payment_page_seen` payload를 `payment_page_seen`으로 저장할 수 있게 했다.
- `/api/attribution/payment-page-seen` 신규 endpoint를 추가했다.
- `/api/attribution/payment-success`가 `/shop_payment/` 또는 `semantic_touchpoint=payment_page_seen` payload를 받으면 `payment_success`로 저장하지 않고 `payment_page_seen`으로 downgrade한다.
- `payment_page_seen`은 Meta Purchase 후보가 될 수 없도록 metadata guard를 붙인다.
- Meta CAPI 후보 선택 앞에 no-send reason을 추가했다.

## value guard

Meta Purchase 후보는 다음 조건에서 제외된다.

- `payment_page_seen` 또는 `semantic_touchpoint=payment_page_seen`
- `meta_purchase_candidate=false` 또는 `is_purchase_candidate=false`
- bridge가 별도 send 승인을 요구하는 row
- 0원 또는 음수 금액
- 금액 없음 + payment key fallback도 없음
- 환불/취소 flag 또는 refund amount
- `value_guard_required_before_meta_send=true`인데 guard pass 없음
- source total과 후보 value가 다름

## VM Cloud read-only 결과

Footer v4.4.2 이후 VM Cloud attribution ledger aggregate:

- 전체 v4.4.2 row: 14건.
- `payment_page_seen` semantic: 12건.
- `payment_success` semantic: 2건.
- `/api/attribution/checkout-context`: 12건.
- `/api/attribution/payment-success`: 2건.
- purchase candidate true: 0건.
- completion URL true: 2건.
- selected payment method present: 9건.
- scroll/dwell metric present: 12건.

해석: live Footer는 이미 진행 페이지를 구매완료로 보내지 않는 방향으로 작동하고 있다. 다만 현재 VM Cloud backend는 아직 로컬 패치 전이므로 `payment_page_seen`을 정식 touchpoint로 보존하려면 VM Cloud backend 배포가 필요하다.

## 테스트

- `cd backend && npm run typecheck` PASS.
- `cd backend && node --test --import tsx tests/attribution.test.ts` PASS, 40/40.

추가 fixture로 확인한 것:

- `payment_page_seen`은 진단 신호로 저장된다.
- `/shop_payment/` payment_success payload는 downgrade된다.
- value guard 미통과, value mismatch, payment_page_seen은 Meta CAPI 후보에서 제외된다.
- value guard pass row만 후보로 남는다.
