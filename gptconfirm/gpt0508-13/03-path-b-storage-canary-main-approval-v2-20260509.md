# Path B 1h storage canary main approval v2

작성 시각: 2026-05-09 18:34 KST
요청 유형: Yellow Lane approval packet update
Status: HOLD until GTM Preview controlled traffic blocker is cleared

## 한 줄 결론

1h hash-only storage canary 본 실행은 아직 HOLD다. 먼저 GTM fresh workspace blocker를 풀고 실제 browser controlled row 1건을 확인하는 것이 안전하다.

## 지금 충분히 확인된 것

- VM Cloud limited deploy: PASS.
- `order_bridge_ledger` schema bootstrap: PASS.
- flag OFF smoke: PASS.
- one-off controlled write 1건: PASS.
- duplicate dedupe: PASS.
- raw_stored_count: 0.
- platform_send_count: 0.

## 아직 부족한 것

- GTM Preview controlled traffic row 1건.
- 실제 브라우저 주문완료 화면에서 deployed endpoint write가 되는지.
- fresh workspace create blocker 해소.

## canary 본 실행 전 조건

필수:

1. GTM fresh workspace create 가능 상태 또는 TJ님이 workspace 164 reuse를 명시 승인.
2. GTM Preview controlled traffic에서 row_count +1.
3. raw_stored_delta = 0.
4. platform_send_delta = 0.
5. PM2 unexpected restart delta = 0.
6. write flag OFF cleanup verified.

## canary 본 실행 승인 범위 후보

아직 실행하지 않는다. 승인 후보는 아래 조건으로만 제안한다.

```text
site: biocom
duration: 1 hour
max_rows: 200
write_mode: hash-only
ORDER_BRIDGE_WRITE_ENABLED=true
ORDER_BRIDGE_WRITE_CANARY_UNTIL=<approved now + 1h>
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
```

## 계속 금지

- GTM Production publish.
- Imweb production save.
- real paid-click actual order test.
- Google Ads/GA4/Meta/TikTok/Naver send.
- Google Ads conversion upload.
- raw email/phone/member_code/order/payment storage or logging.
- existing GTM tag pause/delete.

## 추천 결정

지금은 1h canary 본 실행 승인보다 **GTM Preview workspace cleanup 또는 reuse 선택**이 먼저다.

Auditor verdict: HOLD_CANARY_MAIN_UNTIL_GTM_PREVIEW_CONTROLLED_ROW
