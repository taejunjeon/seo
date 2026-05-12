---
harness_preflight:
  lane: Yellow approved deploy result + Green validation
  allowed_actions: [approved_vm_backend_deploy_restart, build_typecheck, health_check, post_snapshot, rollback_readiness_check]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration, imweb_footer_edit]
  source_window_freshness_confidence: "live API refresh 2026-05-12 22:11-22:25 KST / confidence 93%"
---

# Option C Live Deploy Result

화면이 NPay 매출을 오래된 `complete_time` 기준 하나로 보던 문제를 live에서 분리했습니다. 이제 biocom은 실제 결제완료 주문만 NPay actual로 표시하고, 더클린커피는 site 격리 전까지 pending으로 멈춥니다.

## 결과

| 항목 | 결과 |
|---|---|
| 배포 commit | `880f979` |
| health | `https://att.ainativeos.net/health` 200 / `status=ok` |
| PM2 | `seo-backend` online |
| biocom actual confirmed | 163건 / ₩29,500,200 / included |
| biocom legacy complete_time | 127건 / ₩25,168,000 |
| biocom bridge pending | 61건 / ₩8,108,600 |
| thecleancoffee actual confirmed | bridge_pending |
| thecleancoffee legacy complete_time | 261건 / ₩11,182,700 |
| thecleancoffee bridge pending | 76건 / ₩5,110,600 |

## 금지선

- 운영DB write: 0
- 플랫폼 send/upload: 0
- GTM publish: 0
- cron 등록: 0
- Imweb footer 변경: 0
- raw PII/click/payment/order 노출: 0

## Rollback

백업 위치는 `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-47-20260512T2153KST`입니다. 백업 파일은 `siteLandingLedger.ts`, `npayActualConfirmedPgReader.ts`, `routes/attribution.ts` 3개가 확인됐습니다.

산출 JSON: `data/option-c-live-deploy-result-20260512.json`
