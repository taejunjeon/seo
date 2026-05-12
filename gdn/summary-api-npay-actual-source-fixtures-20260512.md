---
harness_preflight:
  lane: Green
  allowed_actions: [fixture_test, local_typecheck]
  forbidden_actions: [deploy_restart, operational_db_write, platform_send_upload]
  source_window_freshness_confidence: "local fixture / no external write / confidence 92%"
---

# Summary API NPay Actual Source Fixtures

옵션 C의 오염 방지 fixture를 추가했습니다. 핵심은 `complete_time`이 비어 있어도 운영DB `PAYMENT_COMPLETE`면 실제 결제완료로 포함하고, 반대로 `complete_time`이나 `imweb_status`만으로는 actual confirmed에 넣지 않는 것입니다.

검증:

- `npm run typecheck`: PASS
- `npx tsx --test tests/site-landing-npay-actual-source.test.ts tests/site-landing-summary-api.test.ts tests/npay-actual-confirmed-pg-reader.test.ts`: 12/12 PASS
- raw email/phone/order/payment/member_code 패턴 출력 없음
- send/upload 후보 0 유지
