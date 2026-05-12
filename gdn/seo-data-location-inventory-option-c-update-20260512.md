---
harness_preflight:
  lane: Green
  allowed_actions: [documentation_update]
  forbidden_actions: [database_write, deploy_restart, platform_send_upload]
  source_window_freshness_confidence: "inventory update / confidence 95%"
---

# SEO Data Location Inventory Option C Update

`data/!data_inventory.md`에 NPay summary source rule을 추가했습니다. 다음 sprint에서 같은 혼동이 반복되지 않도록 `complete_time`, `imweb_status`, 운영DB `PAYMENT_COMPLETE`, `imweb_orders.order_code/order_no`의 역할을 분리했습니다.

`data/dbstructure.md`에는 최신 source/freshness 원칙은 `data/!data_inventory.md`를 우선한다는 cross-link를 추가했습니다.

Notion 관리표는 문서 원장입니다. 실제 row 수, freshness, 매출 정본은 운영DB/VM Cloud/로컬DB read-only query 기준을 우선합니다.
