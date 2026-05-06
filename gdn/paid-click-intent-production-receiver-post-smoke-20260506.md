# paid_click_intent production receiver POST smoke 결과

작성 시각: 2026-05-06 17:03 KST
대상: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`
문서 성격: production receiver 접근성 read-only/TEST payload smoke 결과. Google Ads/GA4/Meta 전송 없음.
Status: blocked / production route missing
Supersedes: 없음
Depends on: [[paid-click-intent-gtm-production-publish-approval-20260506]]
Do not use for: GTM Production publish 승인, backend 운영 deploy 승인, Google Ads conversion upload

## 10초 결론

`att.ainativeos.net`은 `OPTIONS` preflight에서는 `https://biocom.kr` Origin을 허용했다.
하지만 TEST click id 1건으로 실제 `POST` smoke를 보내자 `404 Route not found`가 반환됐다.

따라서 현재 운영 `att.ainativeos.net`에는 `paid-click-intent/no-send` POST route가 아직 배포되어 있지 않은 것으로 본다.
receiver POST까지 포함한 GTM 운영 publish는 지금 바로 진행하면 receiver 호출이 실패한다.

## 실행한 것

### 1. Preflight

```text
OPTIONS https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
Origin: https://biocom.kr
결과: 204
Access-Control-Allow-Origin: https://biocom.kr
```

### 2. TEST POST smoke

payload 성격:

- `gclid=TEST_GCLID_20260506_POST_SMOKE`
- value/currency/order_number 없음
- PII 없음
- Google Ads/GA4/Meta 전송 의도 없음
- 목적은 receiver 응답 확인

결과:

```json
{
  "http_status": 404,
  "error": "not_found",
  "message": "Route not found"
}
```

응답 헤더에는 `Access-Control-Allow-Origin: https://biocom.kr`가 있었지만, route 자체가 없었다.

## 해석

`OPTIONS 204`는 route가 존재한다는 뜻이 아니다.
Express/Cloudflare 레벨에서 CORS preflight가 통과해도, 실제 POST route가 없으면 브라우저 receiver 호출은 실패한다.

현재 상태:

- local backend 7020: `POST /api/attribution/paid-click-intent/no-send` 존재.
- temporary HTTPS tunnel Preview: POST 성공.
- production `att.ainativeos.net`: POST 404.

## 승인 영향

`paid_click_intent v1` 운영 GTM publish는 두 선택지로 나뉜다.

### 선택지 A. storage-only publish

GTM tag가 browser storage에만 저장하고 production receiver POST는 하지 않는다.

장점:

- backend 운영 deploy 없이 진행 가능.
- click id를 브라우저에 보존하는 1차 목적은 일부 달성.

단점:

- 서버 receiver count, 2xx rate, payload fill-rate 모니터링은 할 수 없다.
- NPay/checkout/주문 원장 연결은 제한적이다.

### 선택지 B. receiver route 배포 후 publish

`att.ainativeos.net`에 `paid-click-intent/no-send` route를 운영 배포한 뒤 GTM publish한다.

장점:

- receiver 2xx, payload, fill-rate를 서버 기준으로 볼 수 있다.
- checkout/NPay/confirmed_purchase no-send와 연결하기 쉽다.

단점:

- backend 운영 deploy가 필요하다.
- backend 운영 deploy는 별도 Red Lane 승인이다.

## Codex 추천

추천은 선택지 B다.

이유:

- 이번 문제의 핵심은 브라우저 저장만이 아니라 주문 원장/Attribution VM까지 click id가 이어지지 않는 것이다.
- storage-only publish는 browser 안에만 남아 서버 측 fill-rate 개선을 바로 측정하기 어렵다.
- 다만 backend 운영 deploy는 Red Lane이므로 별도 승인 문서가 필요하다.

## 다음 할 일

Codex가 할 일:

- `paid_click_intent/no-send` production receiver 배포 승인안을 별도 문서로 작성한다.
- GTM publish 승인안은 receiver route 배포 여부에 따라 storage-only 또는 receiver-enabled로 분기한다.

TJ님이 할 일:

- storage-only GTM publish를 먼저 할지, receiver route 배포 승인 후 receiver-enabled publish를 할지 결정한다.

## 금지 유지

아래는 계속 금지다.

- GTM Production publish.
- backend 운영 deploy.
- Google Ads conversion action 생성/변경.
- conversion upload.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- 운영 DB write.
