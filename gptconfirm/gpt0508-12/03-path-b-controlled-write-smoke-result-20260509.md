# Path B controlled write smoke result

작성 시각: 2026-05-09 17:28 KST
Status: PASS_WITH_ONE_OFF_ROUTE_SMOKE

## 한 줄 결론

VM Cloud에 배포된 route/module을 one-off로 실행해 hash-only row 1건 저장과 duplicate dedupe를 확인했다.

## 왜 one-off인가

PM2 restart 승인 범위는 1회였다. PM2 service를 flag ON으로 바꾸려면 추가 restart가 필요하다.

따라서 서비스는 flag OFF로 유지했다. controlled smoke는 같은 VM Cloud의 배포된 dist route를 one-off local process로 띄워 `ORDER_BRIDGE_WRITE_ENABLED=true`를 주입해 실행했다.

## 결과

첫 번째 controlled write:

- status: 200.
- `would_store`: true.
- `would_send`: false.
- `ledger.stored`: true.
- `ledger.deduped`: false.
- `email_hash_present`: true.
- `phone_hash_present`: true.
- `order_no_hash_present`: true.
- `client_session_present`: true.
- `click_id_hash_present`: true.
- sensitive raw echo count: 0.
- PM2 email-like raw log count: 0 -> 0.
- raw payload stored: false.
- platform send count: 0.

두 번째 duplicate write:

- status: 200.
- `ledger.stored`: true.
- `ledger.deduped`: true.
- row_count 증가 없음.
- duplicate_dedupe_count: 1.

## Row summary

- before: row_count 0.
- after first: row_count 1.
- after duplicate: row_count 1.
- unique_order_no_hash: 1.
- unique_email_hash: 1.
- unique_phone_hash: 1.
- unique_click_id_hash: 1.
- raw_stored_count: 0.
- platform_send_count: 0.
- duplicate_dedupe_count: 1.

## 해석

저장 장치 자체는 작동한다. 다만 실제 PM2 service endpoint를 flag ON으로 운영 traffic에 여는 것은 아직 하지 않았다.
