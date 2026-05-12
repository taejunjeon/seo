---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions: [read_only_vm_cloud_sqlite_query, read_only_operational_db_query, local_document_update]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration, imweb_footer_edit, thecleancoffee_actual_included_promotion]
  source_window_freshness_confidence: "last_30d / 2026-05-12 22:19 KST / confidence 91%"
---

# Thecleancoffee Actual Source Isolation Deep Dive

더클린커피는 아직 실제 결제완료 매출로 승격하지 않습니다. VM Cloud에는 더클린커피 NPay 주문번호가 잘 들어오지만, 운영DB `tb_iamweb_users` 안에서 더클린커피만 안전하게 고를 site key와 주문번호 매칭이 없습니다.

## 확인 결과

| 확인 | 결과 | 해석 |
|---|---:|---|
| VM Cloud `imweb_orders` coffee NPay 30일 | 337건 / ₩16,293,300 | coffee 자체 주문 원장은 있음 |
| 그중 `order_no/order_code/channel_order_no` 존재 | 337/337 | 주문 단위 bridge 재료는 충분 |
| `complete_time` present | 261건 | legacy 진단값 |
| `complete_time` blank bridge pending | 76건 / API live ₩5,110,600 | 미결제가 아니라 bridge 필요 |
| VM coffee order_no → 운영DB `tb_iamweb_users` 매칭 | 0/337 | 운영DB를 coffee actual primary로 쓰면 안 됨 |
| VM biocom order_no → 운영DB 매칭 control | 186/188 | 조인 방식 자체는 동작 |
| `tb_iamweb_users` raw site key probe | 0건 | site 격리 키 없음 |
| PlayAuto coffee 30일 | 1,151 주문 | cross-check 가능 |
| Toss coffee 30일 | 488건 / ₩24,593,250 net | 결제 cross-check 가능 |

## 결론

판정은 `COFFEE_BRIDGE_PENDING_CONTINUE`입니다.

운영DB `tb_iamweb_users`의 NPay `PAYMENT_COMPLETE`는 biocom에는 actual confirmed primary로 쓸 수 있습니다. 하지만 더클린커피는 같은 테이블에서 site 격리 키가 없고, VM Cloud coffee 주문번호 337건이 운영DB 주문번호와 0건 매칭됩니다. 따라서 summary API가 coffee actual confirmed를 `included`로 올리면 site 오염 위험이 큽니다.

## 다음 안전 경로

1. 더클린커피 actual source는 Imweb v2/VM Cloud `imweb_orders(site='thecleancoffee')`를 bridge evidence로 유지합니다.
2. PlayAuto `shop_name='아임웹-C'`, Toss `store='coffee'`, 엑셀은 cross-check로 분리합니다.
3. 운영DB 또는 개발팀이 coffee site-isolated actual source를 제공하기 전까지 live summary의 `actual_confirmed.status=bridge_pending`을 유지합니다.

## 금지선

- 운영DB write: 0
- 외부 플랫폼 전송: 0
- GTM publish: 0
- Imweb footer 변경: 0
- raw order/email/phone/member/payment 출력: 0

산출 JSON: `data/thecleancoffee-actual-source-isolation-deep-dive-20260512.json`
