---
harness_preflight:
  lane: Yellow approval packet only
  allowed_actions: [approval_packet]
  forbidden_actions: [deploy_restart_before_approval, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "post-approval deployment packet / confidence 88%"
---

# Option C Summary API Deploy Approval

이 문서는 배포 승인안입니다. 이번 sprint에서는 VM 배포, restart, cron 등록을 실행하지 않았습니다.

## 승인하면 바뀌는 화면

- biocom summary API에 실제 결제완료 NPay 매출(`npay_revenue_30d_actual_confirmed`)이 추가됩니다.
- 기존 `npay_revenue_30d`는 legacy complete_time 기준으로 남아 비교할 수 있습니다.
- complete_time 공백 NPay row는 `bridge_pending`으로 표시됩니다.
- thecleancoffee는 운영DB site 격리 전까지 actual confirmed가 아니라 bridge_pending으로 남습니다.

## 승인 후 실행 순서

1. pre-snapshot: biocom/thecleancoffee summary API 현재 응답 저장.
2. VM Cloud에 backend src 변경 파일 복사.
3. VM Cloud backend build/typecheck.
4. `seo-backend` restart.
5. post-snapshot: 새 derived 필드와 invariant 0 확인.
6. 실패 시 pre-deploy backup으로 rollback 후 restart.

승인 전 실행한 배포/restart/cron 등록은 0건입니다.
