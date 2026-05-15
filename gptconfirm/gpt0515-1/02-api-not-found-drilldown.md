# 02. API not found drilldown

작성 시각: 2026-05-15 00:32 KST

## 결론

VM Cloud pending row는 Meta 주문만 모은 목록이 아니다. 아임웹 payment_success 신호 전체 중 결제완료 정본이 아직 닫히지 않은 후보 목록이다.

최신 read-only 기준으로 운영DB bridge 이후 남은 54건 중 Imweb v2 API confirmed 후보는 5건 / 1,566,621원이다. 취소 1건 / 234,000원은 제외해야 하고, API not found 48건은 Meta send 후보가 아니다.

## 기준

- VM Cloud: `attribution_ledger`, `imweb_orders`
- 운영DB: `dashboard.public.tb_iamweb_users`
- 외부 API: Imweb v2 API read-only
- window: `logged_at >= 2026-05-14T04:00:00.000Z`
- raw output policy: `safe_ref`만 출력

## 왜 pending이었나

pending은 “미결제 확정”이 아니다.

아임웹 footer/payment_success 코드가 결제 흐름에서 VM Cloud로 후보를 보냈지만, 운영DB `PAYMENT_COMPLETE`, Imweb v2 API confirmed status, fresh VM Cloud `imweb_orders` status 중 하나가 닫혀야 실제 결제완료로 볼 수 있다. 이 기준이 닫히지 않으면 pending으로 유지한다.

## 현재 분류

- `confirmed_by_imweb_api`: 5건 / 1,566,621원
- `canceled_or_refunded_by_imweb_api`: 1건 / 234,000원
- `api_not_found`: 48건
- `api_unavailable`: 0건
- VM Cloud cache hit: 6건, status blank 6건
- payment key present: 0건

safe_ref drilldown:

- checkout/payment page artifact 후보: 48건
- API window/pagination/status sync gap 후보: 4건
- canceled/refunded/excluded 안전 bucket: 13건

## 전송 판단

API not found 48건은 no-send다.

Imweb confirmed 5건은 bridge 후보일 뿐이다. Meta backfill을 하려면 금액, 취소/환불, duplicate event_id, 운영DB/Imweb source priority를 다시 닫은 뒤 별도 Red 승인이 필요하다.

## 근거 파일

- `capivm/biocom-api-not-found-raw-key-drilldown-20260515.md`
- `data/project/biocom-api-not-found-raw-key-drilldown-20260515.json`
