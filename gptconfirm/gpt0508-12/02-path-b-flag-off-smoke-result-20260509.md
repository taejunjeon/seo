# Path B flag OFF smoke result

작성 시각: 2026-05-09 17:28 KST
Status: PASS

## 한 줄 결론

배포 후 VM Cloud service는 flag OFF 상태에서 no-send endpoint를 정상 유지했다.

## 결과

- health: 200.
- summary endpoint: 200.
- table bootstrap: PASS.
- no-send endpoint: 200.
- oversized payload: 413.
- `would_store`: false.
- `would_send`: false.
- `email_hash_present`: true.
- `phone_hash_present`: true.
- `order_no_hash_present`: true.
- `client_session_present`: true.
- `click_id_hash_present`: true.
- `no_raw_echo_verified`: true.
- `no_platform_send_verified`: true.
- `platform_send_count`: 0.
- `raw_payload_stored`: false.
- `raw_logging_enabled`: false.
- PM2 email-like raw log count: 0 -> 0.

## 해석

limited deploy 후에도 기본 상태는 안전하다. 실제 서비스는 `ORDER_BRIDGE_WRITE_ENABLED=false`이며 고객 traffic이 endpoint를 호출해도 저장하지 않는다.
