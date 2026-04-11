# Meta Purchase 정합성 작업 계획 - 2026-04-11

## 바로 결론

VM이나 Google Cloud 이전보다 먼저 **Meta Purchase 정합성 작업을 마무리하는 순서**가 맞다.

지금 Meta ROAS와 내부 Attribution ROAS 차이는 단순 attribution window 차이만으로 보기 어렵다. 현재 확인된 핵심 리스크는 두 가지다.

- 미입금 가상계좌 주문에서도 Browser Pixel `Purchase`가 먼저 발화한다.
- 카드 결제 완료 테스트 주문에서 Browser Pixel Purchase Event ID가 `Purchase.{아임웹 order_code}` 형식으로 확인됐다. Server CAPI도 이 값에 맞춰야 dedup된다.

따라서 지금 목표는 “서버 이전”이 아니라 **Meta가 무엇을 Purchase로 보고 있는지와 우리 서버가 무엇을 Purchase로 보내는지를 주문 단위로 맞추는 것**이다. 이 작업은 CAPI만의 문제가 아니라 Browser Pixel, Server CAPI, 내부 Attribution 원장의 Purchase 정의를 맞추는 작업이다.

## 현재 확인된 사실

- 백엔드는 Express 서버이고, CAPI는 `backend/src/metaCapi.ts`와 `/api/meta/capi/*` 라우트에서 처리한다.
- Server CAPI auto-sync는 confirmed 주문만 전송하는 방향으로 동작한다.
- 가상계좌 미입금 주문 `202604114568447`은 local ledger 기준 pending이었고, Server CAPI로는 전송되지 않았다.
- 같은 주문에서 Browser Pixel은 결제완료 페이지에서 `Purchase`, `value=39000`, `currency=KRW`로 발화했다.
- 즉, 이 케이스는 CAPI 중복 문제가 아니라 **Browser Pixel의 Purchase 정의가 내부 confirmed 기준보다 빠른 문제**다.
- 카드 결제 완료 주문 `202604110037075`은 Toss direct fallback 이후 `confirmed`, `DONE`, `카드`로 보정됐다.
- 해당 카드 결제의 Browser Pixel Purchase Event ID는 `Purchase.o202604111e6d6e78c02e9`였다.
- `o202604111e6d6e78c02e9`는 내부 주문번호가 아니라 아임웹 `order_code`다.
- Meta 샘플 활동 CSV에는 Browser/Server 이벤트는 보이지만 `event_id`와 dedup status가 없어 최종 dedup 판정에는 부족하다.
- 백엔드는 특정 주문만 Test Events로 보내기 위해 `/api/meta/capi/sync`에 `order_id`, `payment_key`, `test_event_code` 필터를 받을 수 있게 되어 있다.
- 2026-04-12 기준 가상계좌 미입금 Browser Purchase 차단용 헤더 스니펫 [header_purchase_guard_0412.md](/Users/vibetj/coding/seo/footer/header_purchase_guard_0412.md)을 작성했다. 로컬 시뮬레이션에서는 카드 결제는 `Purchase` 통과, 가상계좌/입금대기는 `Purchase` 차단 후 `VirtualAccountIssued` 전환으로 확인됐다.

## 완료 기준

아래가 확인되어야 Meta Purchase 1차 정합성 작업을 완료로 본다.

- 가상계좌 미입금 주문에서는 Browser Pixel `Purchase`가 발화하지 않는다.
- 즉시 차단이 어렵다면 `pending_purchase_leakage`로 별도 집계하되, 그 상태는 1차 정합성 완료로 보지 않는다.
- Server CAPI Purchase는 confirmed 주문만 보낸다는 원칙을 유지한다.
- `Purchase event_id`는 `Purchase.{아임웹 order_code}`를 우선 사용한다. Browser, Server, retry 모두 같은 주문의 같은 Purchase에는 같은 값을 써야 한다.
- order_code가 없을 때만 fallback으로 내부 주문번호 기반 값을 사용한다.
- 카드 결제 또는 입금 완료된 테스트 주문 1건에서 Browser Purchase와 Server Purchase의 `event_id`가 같은지 Meta Test Events에서 확인한다.
- Server CAPI payload에 `custom_data.order_id`, `event_source_url`, `value`, `currency`가 안정적으로 들어간다.
- 가능하면 Server CAPI payload에 `content_ids`, `contents`, `content_type`도 안정적으로 들어간다.
- 같은 `orderId + Purchase`가 서로 다른 `event_id`로 여러 번 운영 전송되지 않는지 확인한다.
- 결과를 `meta/metareport.md`와 `data/roasphase.md`에 반영한다.

## 작업 트랙

이 작업은 두 트랙으로 진행한다.

- 트랙 A: Purchase 정합성 수정. 지금 직접 진행할 핵심 작업이다.
- 트랙 B: VM 배포 준비. 문서와 체크리스트만 병행하고, origin 컷오버는 Purchase 정합성 확인 후 진행한다.

즉, VM 준비는 멈추지 않지만 실제 전환은 `pending Purchase 차단 + confirmed 주문 dedup 확인` 이후에 한다.

## 내가 할 일

## 1. 코드 기준 CAPI 전송 원칙 확인

할 일:

- `backend/src/metaCapi.ts`에서 CAPI 후보 선정 조건을 확인한다.
- pending 주문이 운영 auto-sync에서 제외되는지 재확인한다.
- 같은 주문이 재전송될 때 Browser Pixel과 같은 `Purchase.{orderCode}` 형식의 `event_id`를 쓰도록 강제한다.
- `order_id`, `event_source_url`, `content_ids`, `contents`, `value`, `currency` payload 생성 위치를 확인한다.

산출물:

- 어떤 조건에서 CAPI Purchase가 전송되는지 문서화.
- pending/confirmed 기준이 코드상 어디에서 갈리는지 문서화.
- event_id 생성식과 재전송 idempotency 위험 기록.

## 2. Server CAPI payload 품질 보강

할 일:

- `custom_data.order_id`가 모든 Server Purchase에 들어가도록 확인/보강한다.
- `event_source_url`이 상대경로가 아니라 `https://biocom.kr/...` 절대 URL로 들어가도록 확인/보강한다.
- 가능한 주문/상품 정보가 있으면 `content_ids`, `contents`, `content_type`을 일관되게 넣는다.
- 수정 후 `npm --prefix backend run typecheck`와 관련 테스트를 실행한다.

주의:

- dedup의 1순위는 `event_id`다.
- 상품정보 보강은 이벤트 품질 개선에는 중요하지만, Browser/Server 중복 제거의 핵심은 아니다.

## 3. Test Events 전송용 서버 호출 준비

할 일:

- `POST /api/meta/capi/sync`에 `order_id`, `payment_key`, `test_event_code`를 넣어 특정 주문 1건만 Meta Test Events로 보낼 수 있는 호출 예시를 정리한다.
- test event code는 Meta Events Manager 화면에서 새로 받은 값을 사용해야 한다.
- 가상계좌 미입금 주문은 confirmed가 아니므로 자동 sync 후보에서 제외된다는 점을 명확히 적는다.

예시:

```bash
curl -X POST "http://localhost:7020/api/meta/capi/sync" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"테스트주문번호","test_event_code":"TEST_CODE","limit":1}'
```

## 4. 로컬 로그 기준 중복 여부 재검증

할 일:

- `/api/meta/capi/log`와 JSONL 로그를 기준으로 최근 운영 성공 CAPI를 재집계한다.
- 같은 `orderId + eventName`이 같은 `event_id`로 반복된 retry-like 중복과, 서로 다른 `event_id`로 반복된 실제 위험 그룹을 분리한다.
- post-fix 이후 구간을 따로 본다.

산출물:

- 최근 24시간, post-fix 이후, 전체 최근 3일 기준 중복 요약.
- multi-event-id risk가 0인지 여부.

## 5. 증거 수집원 분리

할 일:

- Browser 증거는 Pixel Helper와 필요 시 Chrome Network 탭으로 본다.
- Server 증거는 `/api/meta/capi/log`, JSONL 로그, Meta Test Events로 본다.
- Meta Test Events만 유일한 증거원으로 보지 않는다. 이전처럼 Browser 이벤트가 Test Events에 늦게 뜨거나 누락될 수 있기 때문이다.

## 6. 문서 업데이트

할 일:

- `meta/metareport.md`에 Test Events 확인 결과를 기록한다.
- `data/roasphase.md`의 Phase 4 완성도와 다음 액션을 갱신한다.
- VM 이전은 `capivm/vmplan.md` 기준으로 CAPI 마무리 이후 진행한다고 연결한다.

## 7. 가상계좌 미입금 Browser Purchase 차단

완료한 것:

- [header_purchase_guard_0412.md](/Users/vibetj/coding/seo/footer/header_purchase_guard_0412.md) 작성.
- 스니펫 문법 검증.
- 로컬 시뮬레이션으로 카드/가상계좌 분기 확인.

운영 반영 원칙:

- 아임웹 헤더 코드 상단 또는 Meta Pixel/GTM보다 먼저 실행되는 위치에 넣는다.
- 기존 footer 하단에만 넣으면 이미 발화된 `Purchase`는 막지 못할 수 있다.
- 가상계좌/무통장/입금대기 문구가 있는 주문완료 화면에서는 Browser `Purchase`를 차단한다.
- 차단된 주문은 `VirtualAccountIssued` custom event로 낮춘다.
- 카드 결제 주문완료에서는 Browser `Purchase`를 그대로 통과시킨다.

검증 기준:

- 가상계좌 미입금 주문완료: Meta Pixel Helper에 `Purchase`가 보이지 않고 `VirtualAccountIssued`가 보인다.
- 카드 결제 주문완료: Meta Pixel Helper에 `Purchase`가 계속 보인다.
- 브라우저 콘솔에 `[biocom-purchase-guard] Blocked unpaid virtual account Purchase` 로그가 남는다.

## TJ님이 할 일

## 1. Meta Events Manager Test Events 화면 열기

할 일:

- Meta Events Manager에서 biocom Pixel을 연다.
- `Test Events` 화면으로 이동한다.
- 웹사이트 테스트용 URL에 biocom 랜딩 또는 상품 상세 URL을 넣고 테스트를 시작한다.
- 새로 표시되는 `test_event_code`를 확인한다.

내가 필요한 것:

- `test_event_code`.
- Test Events 화면에서 Browser Purchase와 Server Purchase가 보이는지 캡처.

## 2. confirmed 테스트 주문 1건 만들기

가장 좋은 방식:

- 카드 결제로 소액 테스트 주문 1건을 완료한다.

대안:

- 가상계좌 주문 후 실제 입금까지 완료한다.

이유:

- 가상계좌 미입금 주문은 pending이므로 Server CAPI auto-sync 대상이 아니다.
- 최종 dedup 검증은 Browser Purchase와 Server CAPI Purchase가 둘 다 발생해야 가능하다.
- 미입금 가상계좌는 Browser Purchase 정의 문제를 확인하는 데는 유용하지만, Server CAPI dedup 확인에는 부족하다.

내가 필요한 것:

- 주문번호.
- 결제수단.
- 결제완료 페이지 URL.
- 결제 완료 또는 입금 완료 시각.

## 3. Test Events에서 event_id 비교

확인할 것:

- Browser Purchase가 뜨는지.
- Server Purchase가 뜨는지.
- Browser와 Server의 `event_id`가 같은지.
- `value`, `currency`, `event_source_url`, `order_id`가 보이는지.
- Server 이벤트에 `content_ids`, `contents`가 보이는지.

판정 기준:

- Browser와 Server의 `event_id`가 같으면 dedup 가능성이 높다.
- Browser와 Server의 `event_id`가 다르면 Meta가 같은 주문을 2개 Purchase로 볼 수 있다.
- Browser Purchase만 뜨고 Server Purchase가 안 뜨면 confirmed 상태 또는 CAPI sync 경로를 확인해야 한다.
- Server Purchase만 뜨면 Browser Pixel 발화/차단 상태를 확인해야 한다.

## 4. 가상계좌 Browser Purchase 차단 여부 확인

할 일:

- [header_purchase_guard_0412.md](/Users/vibetj/coding/seo/footer/header_purchase_guard_0412.md)를 아임웹 헤더 코드 상단에 넣는다.
- 가상계좌 미입금 화면에서 Browser `Purchase`가 막히는지 확인한다.
- 같은 화면에서 `VirtualAccountIssued`가 뜨는지 확인한다.
- 카드 결제 주문완료에서는 Browser `Purchase`가 계속 뜨는지 확인한다.

판단:

- 카드 결제는 결제완료 시점이 confirmed에 가깝기 때문에 Browser Purchase 유지가 가능하다.
- 가상계좌는 입금 전에는 confirmed가 아니므로 Browser Purchase가 먼저 잡히면 Meta ROAS가 내부 confirmed ROAS보다 커질 수 있다.

## 5. 광고 최적화 이벤트 분리 판단

할 일:

- pending 가상계좌 `Purchase`를 줄이면 일부 광고세트는 학습량이 줄 수 있음을 광고 운영 관점에서 확인한다.
- 저볼륨 광고세트는 학습용 후보로 `AddPaymentInfo` 또는 `VirtualAccountIssued`를 쓸지 검토한다.
- 단, ROAS 리포팅 기준은 계속 confirmed `Purchase`로 유지한다.

## 우리가 같이 확인할 것

## 1. Purchase 기준

정해야 할 기준:

- 내부 Attribution ROAS의 Purchase는 confirmed 기준.
- Server CAPI Purchase도 confirmed 기준.
- Browser Pixel Purchase도 가능하면 confirmed 기준.
- 가상계좌 미입금은 Purchase가 아니라 별도 이벤트로 분리.
- 광고 학습용 이벤트와 매출 측정용 이벤트는 분리할 수 있다.

## 2. Meta ROAS 해석 기준

정해야 할 기준:

- 기본 운영 비교는 Meta `1d_click` 기준을 우선한다.
- Meta 기본 `7d_click + 1d_view`는 참고값으로 둔다.
- Attribution confirmed ROAS와 비교할 때는 pending/미입금 가상계좌가 Meta Purchase에 섞였는지 별도 표기한다.

## 3. VM 이전 가능 조건

VM으로 옮기기 전 최소 조건:

- CAPI confirmed-only 원칙 확인.
- 가상계좌 Browser Purchase 문제의 처리 방향 결정.
- Test Events에서 dedup 결과 확인.
- CAPI payload 품질 보강 여부 확인.
- 노트북 백엔드와 VM 백엔드 동시 실행 방지 절차 확정.

## 작업 순서

1. 내가 CAPI 코드와 로그를 재확인한다.
2. 내가 payload 보강이 필요한 부분을 수정한다.
3. TJ님이 Meta Test Events code와 confirmed 테스트 주문 정보를 제공한다.
4. 내가 특정 주문만 Server CAPI Test Events로 전송한다.
5. TJ님이 Meta 화면에서 Browser/Server event_id와 payload를 확인한다.
6. 내가 결과를 `meta/metareport.md`, `data/roasphase.md`에 기록한다.
7. 그 다음 `capivm/vmplan.md` 기준으로 VM 컷오버를 준비한다.

## 지금 하지 않을 것

- VM 배포 실행.
- Cloud Run 이관.
- Workers 재작성.
- 백엔드 Next.js 통합.
- CRM 발송 자동화 확대.
- CAPI만 별도 서버로 분리.

지금은 CAPI/Purchase 정의를 먼저 끝내야 한다.

## 관련 문서

- [VM 이전 계획](/Users/vibetj/coding/seo/capivm/vmplan.md)
- [기존 GCP 계획](/Users/vibetj/coding/seo/capivm/plan0411.md)
- [GCP 계획 보강 검토](/Users/vibetj/coding/seo/capivm/plan0411-2.md)
- [ROAS Phase](/Users/vibetj/coding/seo/data/roasphase.md)
- [Meta 이벤트 품질 보고](/Users/vibetj/coding/seo/meta/metareport.md)
