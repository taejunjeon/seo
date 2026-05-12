---
harness_preflight:
  lane: Green source isolation and guide audit
  allowed_actions: [read_only_vm_cloud_sqlite_query, read_only_operational_db_query, local_document_patch]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration, coffee_actual_included_promotion]
  source_window_freshness_confidence: "last_30d / 2026-05-12 22:19-22:24 KST / confidence 92%"
---

# Coffee And Source Guide Deep Dive

## Coffee Verdict

`COFFEE_BRIDGE_PENDING_CONTINUE`

더클린커피는 actual included로 올리지 않습니다. VM Cloud에는 coffee 주문번호가 충분하지만, 운영DB `tb_iamweb_users`에서 coffee site를 안전하게 고르는 키가 없습니다.

## Evidence

| 확인 | 결과 |
|---|---:|
| VM Cloud coffee NPay 30일 | 337건 / ₩16,293,300 |
| VM Cloud coffee order_no/order_code/channel_order_no present | 337/337 |
| VM coffee order_no → 운영DB `tb_iamweb_users` match | 0/337 |
| VM biocom order_no → 운영DB match control | 186/188 |
| 운영DB raw site key probe | 0 |
| PlayAuto coffee 30일 | 1,151 orders |
| Toss coffee 30일 | 488 tx / ₩24,593,250 net |

해석: 조인 방식 자체는 biocom control에서 동작합니다. coffee만 0/337인 것은 coffee 주문이 `tb_iamweb_users` actual primary에 들어오지 않거나, 현재 접근 가능한 필터로는 분리할 수 없다는 뜻입니다.

## Source Guide Patch

`gdn/attribution-data-source-decision-guide-20260511.md`에 아래를 보강했습니다.

- 운영DB `tb_iamweb_users PAYMENT_COMPLETE`는 biocom NPay actual primary.
- thecleancoffee는 site 격리 전 `bridge_pending`.
- coffee는 Imweb v2/VM Cloud, PlayAuto, Toss, Excel을 cross-check로 분리.
- NPay click/count/add_payment_info 구매완료 승격 금지 유지.

`total/!total-current.md`에는 gpt0508-47 live state와 rollback backup 위치를 추가했습니다.

## 산출물

- `data/thecleancoffee-actual-source-isolation-deep-dive-20260512.json`
- `gdn/thecleancoffee-actual-source-isolation-deep-dive-20260512.md`
- `data/option-c-source-guide-consistency-audit-20260512.json`
- `gdn/option-c-source-guide-consistency-audit-20260512.md`
