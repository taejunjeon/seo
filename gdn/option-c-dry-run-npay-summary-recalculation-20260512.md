---
harness_preflight:
  lane: Green
  allowed_actions: [read_only_vm_sqlite_query, read_only_operational_db_query, local_dry_run]
  forbidden_actions: [deploy_restart, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "last_30d / VM Cloud + 운영DB read-only / confidence 90%"
---

# Option C Dry-Run NPay Summary Recalculation

배포하면 biocom은 화면에서 `complete_time` 기준값과 실제 결제완료 기준값이 분리되어 보입니다. 이게 핵심입니다.

## biocom

| 기준 | 건수 | 금액 | 최신 시각 |
|---|---:|---:|---|
| legacy complete_time 현재 live | 128 | ₩25,664,000 | 2026-05-11T00:47:22.000Z |
| actual confirmed 운영DB | 163 | ₩29,500,200 | 2026-05-12T07:10:27.000Z |
| bridge pending VM Cloud | 59 | ₩7,841,600 | 2026-05-12T07:09:55.000Z |

## thecleancoffee

| 기준 | 건수 | 금액 | 최신 시각 |
|---|---:|---:|---|
| legacy complete_time 현재 live | 261 | ₩11,182,700 | 2026-05-11T05:08:29.000Z |
| actual confirmed 운영DB | bridge_pending | - | site 격리 미검증 |
| bridge pending VM Cloud | 75 | ₩5,067,700 | 2026-05-12T12:08:16.000Z |

해석: `complete_time`이 비어 있는 NPay row는 미결제가 아니라 bridge가 필요한 row입니다. biocom은 운영DB actual confirmed가 바로 붙고, thecleancoffee는 site 격리 증거가 생기기 전까지 actual confirmed로 올리지 않습니다.
