---
harness_preflight:
  lane: Yellow approved deploy validation
  allowed_actions: [pre_snapshot, approved_vm_deploy_restart, post_snapshot, health_check, rollback_readiness_check]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration, imweb_footer_edit]
  source_window_freshness_confidence: "pre/post/live refresh 2026-05-12 21:54-22:25 KST / confidence 94%"
---

# Live Deploy And Validation

## Deploy Scope

- 배포 commit: `880f979`
- 대상: summary API NPay source split
- live health: `https://att.ainativeos.net/health` 200
- PM2: `seo-backend` online

## Pre-Snapshot

배포 전에는 actual/legacy/bridge 새 필드가 live API에 없었습니다.

- biocom summary: 200
- thecleancoffee summary: 200
- health: 200
- raw pattern scan: 0
- 산출: `data/option-c-live-pre-snapshot-20260512.json`

## Post-Snapshot

배포 직후 post-snapshot verdict는 PASS입니다.

| 체크 | 결과 |
|---|---|
| biocom actual included | PASS |
| biocom legacy present | PASS |
| biocom bridge pending present | PASS |
| coffee not included | PASS |
| coffee bridge pending | PASS |
| invariants zero | PASS |
| raw patterns zero | PASS |

산출: `data/option-c-live-post-snapshot-20260512.json`

## 22:11 KST Live Refresh

| site | actual confirmed | legacy complete_time | bridge pending |
|---|---:|---:|---:|
| biocom | 163건 / ₩29,500,200 | 127건 / ₩25,168,000 | 61건 / ₩8,108,600 |
| thecleancoffee | bridge_pending | 261건 / ₩11,182,700 | 76건 / ₩5,110,600 |

## Rollback Readiness

- Backup path: `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-47-20260512T2153KST`
- Files present:
  - `backend/src/siteLandingLedger.ts`
  - `backend/src/npayActualConfirmedPgReader.ts`
  - `backend/src/routes/attribution.ts`
- 실제 rollback 실행: 0

## 금지선

- 운영DB write: 0
- platform send/upload: 0
- GTM publish: 0
- cron registration: 0
- Imweb footer/header edit: 0
