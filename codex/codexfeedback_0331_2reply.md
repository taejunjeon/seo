# codexfeedback_0331_2 reply

기준일: 2026-03-31

## 이번 턴 한 줄 결론

`P1-S1A`는 아직 live 트래픽이 없어 원인 확정까지는 못 갔지만, 로컬에서 더 밀 수 있는 `replay/backfill shadow`와 `live / replay / smoke` 구분을 실제 코드와 화면에 반영했다.

## 이번 턴의 목표

1. 실제 고객 사이트 연결 전에도 토스 승인 데이터로 조인 배선을 검증할 수 있게 만든다.
2. `/crm`의 결제 귀속 화면이 `live`, `replay`, `smoke`를 구분하도록 바꾼다.
3. 로드맵에 `무엇이 닫혔고 무엇이 아직 live 검증 전인지`를 과장 없이 반영한다.

## 실제로 바뀐 것

### 1. replay/backfill shadow를 추가했다

- `POST /api/attribution/replay/toss`를 추가했다.
- read-only 운영 DB의 `tb_sales_toss` 승인건을 읽어 `payment_success` replay row로 JSONL 원장에 적재할 수 있게 했다.
- 같은 `paymentKey/orderId`가 이미 있으면 건너뛰도록 해서 idempotency를 넣었다.
- 반복 실행용 보조 스크립트 `backend/scripts/attribution-replay-toss.ts`를 추가했다.
- 실제 고객 사이트 연결 전에도 `live` 흐름을 temp ledger에서 검증할 수 있게 `backend/scripts/attribution-live-probe.ts`를 추가했다.

### 2. 원장에 `capture mode`를 넣었다

- 모든 attribution row를 `live`, `replay`, `smoke` 중 하나로 구분하게 했다.
- 예전 row도 읽을 때 자동으로 보정되게 만들었다.
- 토스 조인 리포트와 Phase 1 ops 스냅샷이 이제 capture mode별 수치를 따로 보여준다.

### 3. `/crm` 결제 귀속 탭을 더 솔직하게 바꿨다

- 카드에서 `live payment_success`, `replay payment_success`, `smoke payment_success`를 따로 보여주게 했다.
- 토스 조인율도 `live`와 `replay`를 분리해서 보이게 했다.
- 날짜별 표에서도 `live row`, `replay row`, `smoke row`를 따로 보이게 했다.
- 해석 문구도 `replay는 배선 점검용이고, live가 들어와야 원인 확정이 가능하다`는 뜻으로 바꿨다.

### 4. roadmap을 현재 사실 기준으로 다시 적었다

- `P1-S1A` 진행률을 `95% / 20%`로 올렸다.
- `replay 5건`, `smoke 2건`, `live 0건` 상태를 상단 요약과 상세 섹션 둘 다에 반영했다.
- `배선 점검용 replay는 닫혔고, 원인 확정용 live만 남았다`는 해석을 문서에 명시했다.

## 실측 결과

- `npm --prefix /Users/vibetj/coding/seo/backend run typecheck` 통과
- `cd /Users/vibetj/coding/seo/backend && node --import tsx --test tests/attribution.test.ts tests/crm-phase1.test.ts` 결과 `9 passed`
- `npm --prefix /Users/vibetj/coding/seo/frontend run build` 통과
- `POST http://localhost:7020/api/attribution/replay/toss?startDate=2026-03-29&endDate=2026-03-29&limit=5&dryRun=false`
  - `tossRows 5`
  - `candidateRows 5`
  - `writtenRows 5`
- 같은 조건으로 `dryRun=true` 재실행
  - `insertableRows 0`
  - `skippedExistingRows 5`
- `GET http://localhost:7020/api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30`
  - ledger total `7건`
  - capture mode 분포 `live 0 / replay 5 / smoke 2`
  - `payment_success` 분포 `live 0 / replay 5 / smoke 1`
  - replay 기준 토스 조인 `5/5`
  - replay ledger coverage rate `100%`
  - 전체 ledger coverage rate `83.3%`
  - `2026-03-29` 진단 문구: `GA4 (not set) 매출과 토스 replay는 있으나 live receiver가 비어 있음`
- `cd /Users/vibetj/coding/seo/backend && node --import tsx scripts/attribution-live-probe.ts --startDate 2026-03-29 --endDate 2026-03-29 --limit 20`
  - main ledger가 아니라 temp ledger 파일에서만 실행
  - 선택된 토스 승인건: `paymentKey=iw_bi20260329230553vE1n5`, `orderId=202603290278889-P1`, `status=DONE`
  - temp ledger summary `totalEntries 2`, capture mode `live 2`
  - temp probe 기준 토스 조인 `matchedByPaymentKey 1`, `ledgerCoverageRate 100%`

## live row가 무엇인가

live row는 `실제 고객 사이트 또는 실제 결제 서버가 지금 발생한 결제 흐름을 우리 attribution 원장에 남긴 1줄 기록`이다.

쉽게 말하면:

- `smoke row`는 연습용 더미 기록
- `replay row`는 이미 끝난 토스 승인 데이터를 다시 읽어 만든 재현 기록
- `live row`는 실제 checkout 또는 실제 payment success 순간에 바로 들어온 현장 기록

지금 우리가 끝까지 원하는 것은 `진짜 고객 결제`가 들어올 때 생기는 `live payment_success row`다.  
이게 있어야 `토스 승인`, `GA4 purchase`, `(not set)` 해석을 같은 결제 건으로 묶을 수 있다.

## live row를 하려면 무엇을 해야 하는가

### 1. 실제 고객 사이트의 두 지점이 필요하다

live row는 `우리 서버가 live로 받는 실제 결제 흐름 기록`이다.  
따라서 아래 두 지점 중 최소 하나가 실제 고객 사이트나 실제 결제 서버 코드에 있어야 한다.

1. checkout 시작 지점
2. payment success 또는 server confirm 지점

이번 턴에 `/Users/vibetj/coding/seo`와 `/Users/vibetj/coding` 전체를 다시 찾았지만, 실제 biocom 결제 프론트 코드나 success URL 페이지 코드는 확인되지 않았다.  
즉 지금 남은 blocker는 `receiver 부족`이 아니라 `실제 사이트 코드 위치가 현재 workspace에 없다`는 점이다.

### 2. checkout 시작에서 반드시 보내야 할 것

checkout에 들어가는 순간 `POST /api/attribution/checkout-context`를 호출해야 한다.

최소 필수:

- `checkoutId`
- `customerKey`
- `landing`
- `referrer`
- `gaSessionId`

가능하면 같이:

- `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`
- `gclid`, `fbclid`, `ttclid`

이 값은 나중에 `payment_success`와 묶여야 하므로, 새 값을 만들기보다 checkout 진입 시점 값을 그대로 유지해야 한다.

### 3. payment success에서 반드시 보내야 할 것

결제가 끝난 순간 `POST /api/attribution/payment-success`를 호출해야 한다.

최소 필수:

- `orderId`
- `paymentKey`
- `approvedAt`

같이 보내야 하는 문맥:

- `checkoutId`
- `customerKey`
- `landing`
- `referrer`
- `gaSessionId`
- `utm*`
- `gclid/fbclid/ttclid`

핵심은 `paymentKey`와 `orderId`를 둘 다 남기는 것이다. 지금 토스 조인은 이 두 키가 있어야 가장 안정적으로 닫힌다.

### 4. 실제 삽입 포인트는 어디인가

현재 workspace에서 직접 확인한 근거는 두 가지다.

- [receiver playbook](/Users/vibetj/coding/seo/codex/p1s1a_receiver_playbook_20260329.md)에는 `checkout-context`와 `payment-success` payload가 이미 정리돼 있다.
- [ga4Cutover.ts](/Users/vibetj/coding/seo/backend/src/ga4Cutover.ts) 기준으로 실제 결제 퍼널 정본 sender는 `HURDLERS [이벤트전송] 주문서작성 -> begin_checkout`, `HURDLERS [이벤트전송] 구매 -> purchase`다.

따라서 실제 고객 사이트에서는 아래 순서가 가장 자연스럽다.

1. `h_begin_checkout`가 만들어지는 지점에서 `checkout-context`
2. 성공 페이지 또는 server confirm에서 `payment-success`
3. 같은 결제 건으로 GA4 DebugView의 `begin_checkout -> purchase`도 확인

### 5. 운영 안전장치도 같이 필요하다

실무에서는 아래를 같이 넣어야 한다.

- feature flag로 on/off 가능하게
- 성공 응답 `201` 로그 남기기
- 중복 전송 허용 전제의 idempotency
- 브라우저 실패 시 server confirm 경로에서 한 번 더 보완 가능하게

### 6. 완료 판정은 무엇인가

진짜로 `live row가 들어왔다`고 말하려면 아래 4개가 같이 보여야 한다.

1. main ledger에서 `paymentSuccessByCaptureMode.live > 0`
2. 같은 건이 `paymentKey` 또는 `orderId`로 토스와 조인
3. `/api/crm-phase1/ops` timeline에서 `livePaymentSuccessEntries > 0`
4. GA4 DebugView에서 같은 결제 건의 `begin_checkout -> purchase` 확인

## 이번 턴 live row 트라이 한 번

실제 고객 사이트 코드를 아직 못 찾았으므로, 이번 턴의 트라이는 `실사이트 연결`이 아니라 `같은 로직으로 local live probe를 temp ledger에 한 번 태우는 것`으로 했다.

무엇을 했는가:

1. read-only `tb_sales_toss`에서 `2026-03-29` 승인건을 읽었다.
2. `status=DONE`인 최근 토스 승인 1건을 골랐다.
3. `captureMode=live`인 `checkout_started`, `payment_success` row를 temp ledger 파일에만 썼다.
4. 그 temp ledger로 토스 조인 리포트를 다시 만들었다.

결과:

- selected toss row
  - `paymentKey=iw_bi20260329230553vE1n5`
  - `orderId=202603290278889-P1`
  - `status=DONE`
- temp ledger `2건`
  - `checkout_started 1`
  - `payment_success 1`
- capture mode `live 2`
- 토스 조인
  - `matchedByPaymentKey 1`
  - `ledgerCoverageRate 100%`

의미:

- 실제 고객 사이트가 위 payload를 보내기만 하면 `live row -> payment_success -> toss join` 자체는 닫힌다.
- 아직 안 닫힌 것은 조인 로직이 아니라 `실제 사이트가 이 receiver를 호출하게 붙이는 마지막 배선`이다.

## 무엇이 증명됐는가

- 실제 고객 사이트 연결 전에도 `read-only 토스 승인 -> replay row -> 토스 조인 -> /crm 진단 화면` 흐름은 닫힌다.
- `smoke`와 `replay`를 분리하지 않으면 생기던 착시를 이제 줄일 수 있다.
- 현재 병목은 `운영 DB write 자체`보다 `실제 고객 사이트가 receiver를 아직 호출하지 않는 것`에 더 가깝다는 점이 코드와 수치로 다시 확인됐다.
- 실제 고객 사이트를 못 붙여도, 같은 로직으로 `live probe`를 temp ledger에서 재현했을 때 토스 조인이 `paymentKey` 기준으로 닫힌다는 점까지는 증명됐다.

## 아직 증명되지 않은 것

- 실제 고객 사이트 checkout 시작 시점과 payment success 시점에서 live row가 들어오는지는 아직 확인되지 않았다.
- `(not set) = PG 리다이렉트`는 아직 확정이 아니다.
- GA4 DebugView 기준 `begin_checkout -> purchase` 귀속이 실제 결제 브라우저 흐름에서 끊기는지도 아직 닫히지 않았다.
- 실제 고객 사이트 코드가 어느 repo 또는 어떤 배포 경로에 있는지는 아직 확인되지 않았다.

## 이 결과가 프로젝트에 주는 도움

- 개발팀 handoff 전에 `무엇이 배선 문제이고 무엇이 운영 반영 문제인지`를 분리할 수 있다.
- 실제 고객 사이트 연결 직후 바로 볼 지표가 준비돼, 첫 live row 1건의 가치가 커졌다.
- `/crm` 화면이 `진짜 들어온 신호`와 `재현용 신호`를 섞어 보여주지 않게 되어 운영 해석 실수를 줄인다.

## 다음 행동

1. 실제 고객 사이트 checkout 시작 함수와 payment success 진입점에 receiver 호출을 삽입한다.
2. live row 1건이 들어오면 `paymentKey/orderId` 기준 토스 조인과 `GA4 DebugView`를 같은 결제 건으로 확인한다.
3. 그 다음에야 `(not set)`을 `PG 직결`로 볼지 계속 `유력 가설`로 둘지 결정한다.
4. 운영 승인 후에는 JSONL 원장을 정식 DB ledger로 승격한다.
