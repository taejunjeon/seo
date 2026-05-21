# Implementation Plan

작성 시각: 2026-05-21 KST
목적: 실제 개발 순서와 승인 경계를 분리한다.

## Phase 1. Backend response shape, no-send

무엇을 하는가: `payment-decision` 응답에 `dedup` 블록을 추가한다.

왜 하는가: Header Guard가 구매 확정 여부뿐 아니라 “어떤 eventID를 써야 Server CAPI와 중복 제거가 되는지”를 서버에서 받을 수 있게 하기 위해서다.

어떻게 하는가:

1. `backend/src/metaCapi.ts`에서 safe event id 생성 helper를 export 또는 wrapper로 분리한다.
2. `backend/src/routes/attribution.ts`의 fast path와 fallback path 모두 `allow_purchase`일 때만 `dedup` 블록을 만든다.
3. `META_CAPI_ENABLE_EVENT_ID_HASH=false`면 `dedup_ready=false`로 내려준다.
4. pending/unknown/canceled에서는 `browser_purchase_event_id`를 내려주지 않는다.

개발 대상:

- `backend/src/metaCapi.ts`
- `backend/src/routes/attribution.ts`

검증:

- backend typecheck.
- payment-decision fixture smoke.
- raw identifier scan.

승인 경계: 로컬 구현은 Green. VM Cloud 배포는 Yellow.

## Phase 2. Header Guard v3.1.2 code draft

무엇을 하는가: Header Guard가 서버 `dedup.browser_purchase_event_id`를 읽고, `allow_purchase + dedup_ready`에서만 원래 Purchase 호출 옵션의 `eventID`를 서버 safe 값으로 교체한다.

왜 하는가: Browser Pixel과 Server CAPI가 같은 safe event_id를 써야 Meta dedup이 작동하기 때문이다.

어떻게 하는가:

```js
if (decision.browserAction === 'allow_purchase' && payload.dedup && payload.dedup.dedup_ready) {
  var safeEventId = payload.dedup.browser_purchase_event_id;
  if (safeEventId) {
    params.options.eventID = safeEventId;
    params.params.eventID = safeEventId;
  }
  invokeOriginalPurchase();
}
```

주의:

- 위 코드는 설명용 pseudocode다. 실제 Header Guard wrapper 구조에 맞춰 `FB_PIXEL.Purchase`와 `fbq('track','Purchase')` 두 경로를 모두 유지해야 한다.
- 기존 `VirtualAccountIssued`, `PurchaseDecisionUnknown`, `PurchaseBlocked` 경로는 유지한다.
- existing raw eventID가 들어와도 서버 safe event_id가 있으면 safe 값이 우선한다.

승인 경계: 코드 초안은 Green. Imweb Header 저장은 Yellow/Red에 가까우므로 별도 승인 필요.

## Phase 3. Safe cutover

무엇을 하는가: Server CAPI event_id hash와 Header Guard safe eventID 소비를 같은 시점에 켠다.

왜 하는가: 한쪽만 바뀌면 dedup이 깨진다.

배포 묶음:

1. VM Cloud backend deploy: `payment-decision dedup response`.
2. env 준비: `META_CAPI_EVENT_ID_SECRET`.
3. Header Guard v3.1.2 적용.
4. `META_CAPI_ENABLE_EVENT_ID_HASH=true` 전환.
5. confirmed test-only 1건 이하로 Browser/Server same event_id 확인.

승인 경계:

- `META_CAPI_ENABLE_EVENT_ID_HASH=true`: Yellow/Red 경계. 운영 dedup semantics가 바뀌므로 TJ님 승인 필요.
- Browser Purchase test/live send: Red. Test Events 보장 없으면 실행 금지.

## Phase 4. Monitoring

무엇을 보는가:

- CAPI Purchase success count.
- Browser Purchase count.
- duplicate event_id count.
- Meta Events Manager dedup/EMQ.
- safe event id present rate.
- raw event_id leak scan.

성공 기준:

- confirmed 구매에서 Browser/Server event id 일치.
- duplicate 증가 없음.
- Browser Purchase 0 문제가 개선되더라도 Server CAPI success는 유지.
- pending/unknown/virtual account Purchase 0 유지.

## 실패 시 해석

- Browser Purchase는 보이지만 Server CAPI와 dedup 안 됨: event_id mismatch 또는 hash flag/cutover 순서 문제.
- Server CAPI success가 줄어듦: candidate gate 또는 event_id success key 영향 점검.
- pending에서 Purchase 발생: Header Guard regression, 즉시 rollback.
- Meta UI 반영 지연: events_received와 raw network/API success를 먼저 본 뒤 Ads UI lag와 분리.
