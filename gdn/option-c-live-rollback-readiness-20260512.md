---
harness_preflight:
  lane: Green rollback readiness check
  allowed_actions: [backup_presence_check, rollback_command_documentation, no_execute_unless_fail]
  forbidden_actions: [rollback_without_fail_condition, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "VM backup check 2026-05-12 22:13 KST / confidence 92%"
---

# Option C Live Rollback Readiness

실제 rollback은 필요하지 않습니다. 다만 실패 조건이 생기면 되돌릴 수 있는 백업 위치와 절차는 확인했습니다.

## 백업

| 항목 | 값 |
|---|---|
| 경로 | `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-47-20260512T2153KST` |
| 확인 파일 | `backend/src/siteLandingLedger.ts`, `backend/src/npayActualConfirmedPgReader.ts`, `backend/src/routes/attribution.ts` |
| 판정 | PASS |

## Rollback 조건

아래 중 하나가 발생하면 rollback을 검토합니다.

1. summary API 5xx가 지속된다.
2. biocom actual field가 사라진다.
3. thecleancoffee가 근거 없이 actual included로 바뀐다.
4. raw email/phone/order/payment/click id가 응답에 노출된다.
5. 승인 없는 platform send/upload, 운영DB write, GTM publish가 발생한다.

## Rollback 명령 초안

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
sudo -n -u biocomkr_sns bash -lc '
  cd /home/biocomkr_sns/seo/repo
  BACKUP=.deploy-backups/gpt0508-47-20260512T2153KST
  cp "$BACKUP/backend/src/siteLandingLedger.ts" backend/src/siteLandingLedger.ts
  cp "$BACKUP/backend/src/npayActualConfirmedPgReader.ts" backend/src/npayActualConfirmedPgReader.ts
  cp "$BACKUP/backend/src/routes/attribution.ts" backend/src/routes/attribution.ts
  cd backend
  npm run build
  pm2 restart seo-backend
'
```

현재는 rollback 실행 0건입니다.
