# TikTok fetch smoke 결과

작성 시각: 2026-04-23 21:57 KST
기준 페이지: `https://biocom.kr/`

## 결론

- `biocom.kr` 브라우저 콘솔에서 실행한 `fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', ...)` smoke는 **성공**이다.
- 운영 VM 기준으로 **CORS 허용**, **POST write 성공**, **GET readback 성공**까지 확인했다.
- 다만 현재 라이브 페이지 소스는 아직 **v2가 아니라 v1 debug=true** 상태다. 따라서 콘솔에 Guard 설치/래핑 로그가 계속 보이는 것은 정상이다.
- `froogaloop2.min.js` 오류는 **TikTok Guard와 직접 관련 없는 별도 이슈**로 본다.

## 사용자가 본 콘솔 메시지

실행 전 콘솔:

```text
[biocom-tiktok-purchase-guard] accessor_installed_TIKTOK_PIXEL
[biocom-tiktok-purchase-guard] accessor_installed_ttq
[biocom-tiktok-purchase-guard] installed
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_init
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_track
[funnel-capi] fbq wrapped agent=imweb version=2.0
[funnel-capi] installed 2026-04-15-biocom-funnel-capi-v3 ...
tiktok-pixel start
[biocom-tiktok-purchase-guard] wrapped_ttq_track
IMWEB_DEPLOY_STRATEGY init event dispatched
[biocom-tiktok-purchase-guard] wrapped_ttq_track
[biocom-tiktok-purchase-guard] wrapped_ttq_track
Uncaught TypeError: Cannot read properties of undefined (reading 'value')
  at froogaloop2.min.js?1577682292:1
```

fetch 실행 후:

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

브라우저 결과:

```text
Promise fulfilled -> Response
```

## 특이사항 판정

### 1. Guard 설치/래핑 로그

판정: **특이사항 있음**

이 로그들은 최종 v2 운영본(`2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`)의 `debug: false` 상태라면 원칙적으로 보이지 않아야 한다.

실제 라이브 소스 확인 결과:

- 현재 `https://biocom.kr/` 페이지는 `2026-04-17.tiktok-purchase-guard-enforce.v1`를 로드 중
- 해당 블록의 설정은 `debug: true`

즉, 지금 보인 설치/래핑 로그는 이상 현상이 아니라 **아직 라이브 헤더가 v2로 교체되지 않았다는 신호**다.

확인 근거:

```text
Version: 2026-04-17.tiktok-purchase-guard-enforce.v1
debug: true
```

따라서 현재 상태는:

- backend 준비 완료
- browser fetch smoke 성공
- 그러나 **아임웹 Header Code는 아직 v1 debug=true**

### 2. `[funnel-capi] ...`

판정: **특이사항 아님**

이 로그는 Meta/fbq mirror 쪽 로그다. TikTok fetch smoke의 실패 원인으로 보지 않는다.

### 3. `tiktok-pixel start`

판정: **특이사항 아님**

기존 footer 코드에서 나오는 로그로 보이며, 이번 smoke 결과를 막는 증거는 없다.

### 4. `froogaloop2.min.js ... reading 'value'`

판정: **특이사항은 맞지만, TikTok Guard 직접 원인으로 보이지 않음**

라이브 페이지 소스 확인 결과:

- `https://vendor-cdn.imweb.me/js/froogaloop2.min.js?1577682292` 포함
- 페이지에 Vimeo section 2개 존재
- `data-vimeo-id="1065304531"` 사용 중

따라서 이 오류는 Imweb/Vimeo 비디오 섹션 스크립트에서 난 것으로 보이며, TikTok Guard나 `tiktok-pixel-event` fetch 경로와 직접 연결된 스택은 아니다.

현재 판단:

- TikTok event log smoke의 성공/실패 판정에는 **비차단**
- 다만 홈 비주얼 Vimeo 섹션 오류로 이어질 수 있으므로 별도 정리 대상

## 서버 검증 결과

### 1. 운영 CORS preflight

외부 확인:

```text
OPTIONS https://att.ainativeos.net/api/attribution/tiktok-pixel-event
status: 204
access-control-allow-origin: https://biocom.kr
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
access-control-allow-headers: content-type
```

판정: **정상**

### 2. 운영 readback

외부 조회:

```text
GET /api/attribution/tiktok-pixel-events?orderCode=smoke_order_code&limit=10
```

결과 핵심:

```json
{
  "ok": true,
  "summary": {
    "totalEvents": 1,
    "uniqueOrderKeys": 1,
    "countsByAction": {
      "smoke_test": 1
    }
  },
  "items": [
    {
      "siteSource": "biocom_imweb",
      "pixelSource": "manual_browser_test",
      "action": "smoke_test",
      "eventName": "Purchase",
      "eventId": "SmokeTest_20260423",
      "orderCode": "smoke_order_code",
      "orderNo": "smoke_order_no",
      "paymentCode": "smoke_payment_code",
      "value": 1000,
      "currency": "KRW",
      "url": "https://biocom.kr/",
      "requestContext": {
        "origin": "https://biocom.kr",
        "path": "/api/attribution/tiktok-pixel-event"
      }
    }
  ]
}
```

판정: **write/readback 성공**

## 최종 판단

1. 사용자가 브라우저 콘솔에서 실행한 fetch smoke는 성공했다.
2. 운영 VM `tiktok_pixel_events` 원장에 실제 row가 들어갔다.
3. `biocom.kr` -> `att.ainativeos.net` CORS는 정상이다.
4. 현재 가장 큰 특이사항은 `froogaloop` 오류가 아니라, **라이브 Header Code가 아직 v1 debug=true라는 점**이다.

## 다음 액션

1. 아임웹 Header Code에서 `2026-04-17.tiktok-purchase-guard-enforce.v1` 블록 제거
2. `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` 블록 1회만 삽입
3. 라이브 소스에서 아래 2개 확인
   - `2026-04-17.tiktok-purchase-guard-enforce.v1` -> 0회
   - `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` -> 1회
4. 그 다음 카드 결제 1건, 가상계좌 1건으로 실제 release/block 확인
