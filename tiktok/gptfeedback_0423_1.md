네. **방향은 맞습니다.**
특히 “헤더 먼저 교체하지 말고, 운영 VM backend endpoint가 먼저 살아난 뒤 교체한다”는 판단은 맞습니다. 이 순서를 어기면 v2 Guard는 동작해도 핵심인 `tiktok_pixel_events` 저장이 안 돼서, 그 사이 주문은 또 과거처럼 event-level 연결이 비게 됩니다. 후보 헤더 문서도 이 순서를 명확히 적고 있습니다.

다만 제 피드백은 조금 더 강합니다.

**이건 조건부 승인입니다.**
`node --check` 통과만으로는 부족하고, **운영 endpoint 2xx + 실제 DB insert + 브라우저 CORS 검증 + v1 완전 제거 확인**까지 보고 붙여야 합니다.

## 결론

**헤더 교체는 승인 가능. 단, backend 배포와 smoke test가 먼저입니다.**

적용 순서는 아래가 맞습니다.

1. 운영 VM backend 배포

2. `POST /api/attribution/tiktok-pixel-event` 운영 2xx 확인

3. 실제 `tiktok_pixel_events`에 row 저장 확인

4. `biocom.kr` 브라우저에서 CORS 포함 POST 성공 확인

5. 기존 `2026-04-17.tiktok-purchase-guard-enforce.v1` 블록 제거

6. v2 블록을 기존 v1 위치에 1회만 삽입

7. 카드 1건, 가상계좌 1건으로 release/block 로그 확인


현재 운영 헤더에는 Meta guard가 먼저 있고, 그 아래에 기존 TikTok Guard v1이 들어가 있습니다. 따라서 v2는 **기존 v1 블록만 제거하고 같은 위치에 교체**하는 방식이 맞습니다. GTM, TikTok Catalog, footer attribution 코드는 건드리면 안 됩니다.

## 가장 중요한 피드백 5개

### 1) “endpoint 2xx”만 보면 안 됩니다

후보 문서에는 `POST /api/attribution/tiktok-pixel-event` smoke test를 하라고 되어 있습니다. 방향은 맞습니다.

그런데 저는 여기서 한 단계 더 봐야 한다고 봅니다.

**2xx 응답만으로는 부족합니다.**
반드시 아래까지 확인해야 합니다.

- POST 응답이 2xx인지

- SQLite `tiktok_pixel_events`에 실제 row가 들어갔는지

- `GET /api/attribution/tiktok-pixel-events?limit=1`로 방금 넣은 row가 보이는지

- 운영 DB 위치가 로컬이 아니라 운영 VM SQLite인지


이걸 안 보면 “API는 성공했는데 실제 저장은 안 됨” 같은 구멍이 생길 수 있습니다.

### 2) 브라우저 CORS 검증이 필요합니다

curl이나 서버 내부 smoke test만으로는 부족합니다.

실제 v2 헤더는 `biocom.kr` 브라우저에서 `att.ainativeos.net`으로 cross-origin POST를 보냅니다. 후보 코드도 `eventLogEndpoint`를 `https://att.ainativeos.net/api/attribution/tiktok-pixel-event`로 두고 있습니다.

그래서 **biocom.kr 실제 페이지 콘솔에서 fetch POST가 되는지** 봐야 합니다.
서버에서는 되는데 브라우저에서는 CORS 때문에 막히는 케이스가 흔합니다.

체크 기준은 이겁니다.

```js
fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'smoke_test',
    source: 'manual_browser_test',
    eventName: 'Purchase',
    eventId: 'SmokeTest_20260423',
    orderCode: 'smoke_order_code',
    orderNo: 'smoke_order_no',
    paymentCode: 'smoke_payment_code',
    value: '1000',
    currency: 'KRW',
    url: location.href,
    referrer: document.referrer
  })
})
```

이게 브라우저에서 성공하고, 운영 이벤트 로그 조회에서도 보여야 합니다.

### 3) v1과 v2가 동시에 있으면 안 됩니다

이건 아주 중요합니다.

현재 운영 헤더에는 기존 v1 블록이 들어가 있습니다.
후보 문서도 “기존 TikTok Guard v1과 중복 삽입 금지”라고 적고 있습니다.

중복으로 두면 위험한 이유는 간단합니다.

- v1과 v2가 같은 `TIKTOK_PIXEL.track` / `ttq.track`을 감쌀 수 있음

- 서로 다른 버전의 scan timer가 90초 동안 다시 wrap할 수 있음

- release/block 자체가 꼬이진 않더라도, 어떤 버전이 최종 wrapper인지 헷갈릴 수 있음

- event log가 일부만 남거나, 중복/누락 해석이 어려워질 수 있음


따라서 교체 후 live source에서 확인해야 합니다.

- `2026-04-17.tiktok-purchase-guard-enforce.v1` → **0회**

- `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` → **1회**


이건 필수입니다.

### 4) v2는 “과거 복원”이 아니라 “앞으로의 연결 보장”입니다

이 점은 잘 잡고 있습니다.

v2가 들어가면 앞으로는 아래 흐름이 남습니다.

- `purchase_intercepted`

- `decision_received`

- `released_confirmed_purchase`

- `blocked_pending_purchase`

- `sent_replacement_place_an_order`


후보 코드도 이 action들을 서버로 보내도록 구성되어 있습니다.

그래서 v2 배포 후의 핵심 KPI는 ROAS가 아니라 먼저 이것입니다.

**TikTok Purchase 시도 1건마다 최종 stage가 남는가?**

즉, 첫 1-2일은 광고 효율을 보지 말고 로그 품질을 봐야 합니다.

### 5) `released_unknown_purchase`는 별도 경고 지표로 봐야 합니다

v2 코드는 `allowOnUnknown: true`입니다.

이건 맞는 선택입니다.
진짜 카드 결제를 놓치면 안 되기 때문에, 모르는 경우에는 Purchase를 열어주는 쪽이 안전합니다.

다만 부작용이 있습니다.

식별자가 없거나 decision endpoint가 실패하면, pending 가상계좌도 `unknown`으로 풀릴 수 있습니다. 그래서 운영 후에는 아래 지표를 매일 봐야 합니다.

- `released_confirmed_purchase`

- `blocked_pending_purchase`

- `sent_replacement_place_an_order`

- `released_unknown_purchase`

- `missing_lookup_keys`

- `request_error`


특히 `released_unknown_purchase`가 많으면 v2는 “정확한 가드”가 아니라 “로그 달린 fail-open”에 가까워집니다.

## 코드 관점에서 보는 리스크

### 리스크 1: full URL/referrer 저장

v2는 payload에 `url`과 `referrer`를 보냅니다.

문제는 URL이나 referrer에 `paymentKey`, `orderNo`, `paymentCode` 같은 값이 들어갈 수 있다는 점입니다. 기존 Attribution 원장도 일부 결제 식별자를 저장하므로 완전 금지는 아니지만, 새 이벤트 로그는 row 수가 늘어날 수 있습니다.

제 추천은:

- 프론트에서 paymentKey 원문은 보내지 않는 현재 방향 유지

- backend 저장 시 URL 안의 `paymentKey/payment_key`는 가능하면 redaction

- 최소한 외부 노출 가능한 admin 화면에는 paymentKey 전체 표시 금지


이건 보안 리스크라기보다 **운영 데이터 위생** 문제입니다.

### 리스크 2: 같은 주문의 여러 stage를 row count로 세면 안 됨

v2는 한 Purchase 시도에 여러 row를 남깁니다.

예를 들어 카드 결제 1건이면:

- `purchase_intercepted`

- `decision_received`

- `released_confirmed_purchase`


이렇게 3개가 생길 수 있습니다.

가상계좌 pending이면:

- `purchase_intercepted`

- `decision_received`

- `blocked_pending_purchase`

- `sent_replacement_place_an_order`


이렇게 4개가 생길 수 있습니다.

따라서 분석할 때 **row 수 = 구매 수**로 보면 안 됩니다.
구매 수는 `eventId/orderCode/orderNo/paymentCode` 기준으로 묶고, 최종 stage를 기준으로 봐야 합니다.

### 리스크 3: 전역 wrapping

v2는 payment complete 페이지에서만 설치되는 구조가 아니라, header 전체에서 `TIKTOK_PIXEL`과 `ttq`를 감쌉니다.

다만 `Purchase`만 실제로 가로채고, `ViewContent` 같은 이벤트는 그대로 흘려보내므로 큰 문제는 아닙니다. 기존 v1도 같은 방식으로 운영됐기 때문에, 이건 **차단 리스크는 낮고 성능 리스크만 약간 있는 수준**입니다.

그래도 첫날은 브라우저 콘솔에서 오류가 없는지 봐야 합니다.

## 제가 보는 승인 조건

아래 7개가 모두 만족되면 헤더 교체 승인해도 됩니다.

|체크|기준|
|---|---|
|backend 배포|운영 VM 배포 완료|
|health|`/health = ok`|
|event endpoint|`POST /api/attribution/tiktok-pixel-event` 2xx|
|DB insert|`tiktok_pixel_events`에 실제 row 저장|
|browser CORS|`biocom.kr` 브라우저에서 POST 성공|
|v1 제거|live source에 v1 문자열 0회|
|v2 단일 삽입|live source에 v2 문자열 1회|

## 실결제 검증 시나리오

### 카드 결제 1건

기대값:

- `purchase_intercepted`

- `decision_received`

- `released_confirmed_purchase`

- TikTok Pixel Helper에서 `Purchase`

- 내부 주문 DB `PAYMENT_COMPLETE`

- 가능하면 Attribution 원장 `payment_success confirmed`


### 가상계좌 미입금 1건

기대값:

- `purchase_intercepted`

- `decision_received`

- `blocked_pending_purchase`

- `sent_replacement_place_an_order`

- TikTok Pixel Helper에서 `Purchase` 없음

- TikTok Pixel Helper에서 `PlaceAnOrder`

- 운영 주문 DB는 입금 전 대기, 24시간 후 overdue

- status sync 후 `vbank_expired/canceled`


## 개발팀에 줄 피드백 문장

그대로 보내도 되는 형태로 정리하면:

> 헤더 교체 순서는 맞습니다. 다만 운영 VM에서 endpoint 2xx만 볼 게 아니라, `tiktok_pixel_events` 실제 insert와 GET 조회까지 확인해 주세요. 추가로 biocom.kr 브라우저 콘솔에서 cross-origin POST가 성공하는지 확인해야 합니다. 기존 v1 블록은 반드시 완전히 제거하고, v2는 같은 위치에 1회만 삽입합니다. 교체 후 live source에서 v1 문자열 0회, v2 문자열 1회를 확인한 뒤 카드 1건/가상계좌 1건으로 release/block stage가 서버에 남는지 검증하면 됩니다.

## 최종 판단

**진행해도 됩니다.**
하지만 헤더 교체 버튼을 누르는 조건은 명확합니다.

**운영 backend endpoint가 살아 있고, 실제 insert가 되고, 브라우저에서 CORS까지 통과한 뒤에만 교체.**

이 순서만 지키면 이번 v2는 앞으로 TikTok Ads 구매와 내부 주문을 연결하는 데 필요한 최소 장치가 됩니다. 👍