---
harness_preflight:
  lane: Yellow approved deploy pre-snapshot
  allowed_actions: [live_api_read_only_snapshot, health_check, pm2_status_read_only]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "pre-deploy snapshot 2026-05-12 21:54 KST / confidence 90%"
---

# Option C Live Pre-Snapshot

배포 전 live API는 NPay actual confirmed 필드를 아직 반환하지 않았습니다. 그래서 화면은 기존 `complete_time` 계열 값만 보고 있었고, 실제 결제완료와 legacy 진단값이 분리되지 않았습니다.

## Snapshot

| 항목 | 결과 |
|---|---|
| 생성 시각 | 2026-05-12 21:54:10 KST |
| 배포 대상 commit | `880f979` |
| biocom summary | HTTP 200 |
| thecleancoffee summary | HTTP 200 |
| health | HTTP 200 |
| actual/legacy/bridge 새 필드 | 아직 없음 |
| raw PII/click id pattern | 0 |
| 운영DB write/platform send/GTM publish/cron/footer 변경 | 0 |

산출 JSON: `data/option-c-live-pre-snapshot-20260512.json`
