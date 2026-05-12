---
harness_preflight:
  lane: Green
  allowed_actions: [local_backend_patch, fixture_test, read_only_query, document_update]
  forbidden_actions: [vm_deploy_restart, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "summary API local patch / no deploy / confidence 90%"
---

# Summary API NPay Actual Source Patch

화면이 보던 NPay 매출을 두 줄로 나눴습니다. 기존 `complete_time` 기준 값은 지우지 않고 legacy 진단값으로 남겼고, 실제 결제완료 기준은 운영DB `PAYMENT_COMPLETE`에서 따로 붙입니다.

## 변경

- `derived.npay_revenue_30d` 유지: 기존 화면 호환용.
- `derived.npay_revenue_30d_complete_time_legacy` 추가: `complete_time` 기준 값, 진단용.
- `derived.npay_revenue_30d_actual_confirmed` 추가: 운영DB actual confirmed 값.
- `derived.npay_revenue_30d_bridge_pending` 추가: `complete_time` 공백이라 미결제로 볼 수 없고, 주문 단위 bridge가 필요한 NPay row.
- `derived.npay_revenue_source/freshness/source_disagreement_reason` 추가.

thecleancoffee는 운영DB `tb_iamweb_users` site 격리가 아직 증명되지 않았으므로 actual confirmed를 바로 붙이지 않고 `bridge_pending`으로 표시합니다.

상태: 로컬 패치 완료, VM 배포/restart 미실행.
