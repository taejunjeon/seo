# Today CAPI Vs Ads Manager

작성 시각: 2026-05-15 23:24 KST

## Server CAPI 수신 상태

오늘 바이오컴 Pixel `1283400029487161`로 전송된 운영 Purchase CAPI는 56건이다.

- attempted: 56
- success: 56
- failed: 0
- events_received: 56
- unique event ids: 56
- duplicate event ids: 0
- unique order-event keys: 56
- duplicate order-event keys: 0
- send path: auto_sync 56
- amount: 16,028,197원

## CAPI 전송되지 않은 결제완료

VM Cloud funnel-health 기준 오늘 confirmed-but-CAPI-missing queue는 5건 / 1,466,000원이다.

이는 오늘 결제완료 61건과 CAPI 전송 성공 56건의 금액 차이와 일치한다.

이번 sprint에서는 분류만 했고 backfill은 하지 않았다.

## Ads Manager today

Meta Ads Insights API 결과:

- date_preset: today
- spend: 3,383,604원
- purchases: 0
- purchase value: 0원
- purchase ROAS: null
- attribution window override 1d_click: purchases 0
- attribution window override 7d_click: purchases 0

캠페인 level에서도 today purchase row는 0건이다.

## 비교용 기간

Yesterday:

- Ads Manager purchase: 2건
- Ads Manager purchase value: 468,000원
- spend: 3,587,212원
- ROAS: 약 0.13

Last 7d:

- Ads Manager purchase: 219건
- Ads Manager purchase value: 58,123,707원
- spend: 28,956,798원
- ROAS: 약 2.01

## 판정

Meta가 서버 구매 이벤트를 받는 경로는 살아 있다. `events_received=1`이 56건이므로 “Meta가 구매 신호를 전혀 못 받는다”는 상태가 아니다.

다만 Ads Manager의 today 귀속 구매는 아직 0이다. 같은 날 구매가 광고 성과로 보이는 데 12-24시간 지연될 수 있으므로 지금은 `TODAY_CAPI_HEALTHY_ADS_LAG`로 둔다.

2026-05-16 오전에 2026-05-15가 `yesterday`가 된 뒤에도 0이면 `TODAY_CAPI_HEALTHY_ADS_ATTRIBUTION_BROKEN`으로 올린다.
