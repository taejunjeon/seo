---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - CLAUDE.md
    - AGENTS.md
    - harness/common/REPORTING_TEMPLATE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions: [local_code_patch, fixture_test, read_only_query, document_update, gptconfirm_packaging]
  forbidden_actions: [deploy_restart, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "last_30d / 2026-05-12 21:24-21:27 KST / confidence 90%"
---

# Option C Source Sufficiency Audit

NPay 매출 요약이 오래돼 보인 이유는 sync 미실행 하나로 끝나는 문제가 아니라, 화면이 `complete_time`만 보고 있었기 때문입니다. 그래서 옵션 C는 `complete_time` 보정이 아니라 실제 결제완료 기준을 운영DB `PAYMENT_COMPLETE`로 바꾸는 작업입니다.

## Source 역할

| 역할 | source | 판단 |
|---|---|---|
| actual paid primary | 운영DB `public.tb_iamweb_users` | `NAVERPAY_ORDER + PAYMENT_COMPLETE + 취소/반품 제외 + 금액 양수`만 실제 결제완료로 사용 |
| bridge | VM Cloud/로컬DB `imweb_orders.order_code/order_no` | site_landing 주문 흔적을 운영DB 주문번호에 이어붙이는 연결 고리 |
| diagnostic | `complete_time`, `imweb_status`, `raw_json.orderStatus` | lifecycle와 sync 상태 진단용. actual purchase 단독 판정 금지 |
| freshness | 운영DB `order_date/payment_complete_time`, VM Cloud `synced_at/imweb_status_synced_at` | 어느 원장이 늦었는지 설명 |

## 점수

| 항목 | 점수 |
|---|---:|
| 데이터 충분도 | 92 |
| 타이밍 | 90 |
| 목표 영향도 | 94 |
| 위험도 | 14 |
| 종합 추천 | 91 |

판정: Green 로컬 패치 진행 가능. 배포/restart는 승인 전 실행하지 않음.
