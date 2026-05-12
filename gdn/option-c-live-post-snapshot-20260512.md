---
harness_preflight:
  lane: Yellow approved deploy post-snapshot + Green refresh
  allowed_actions: [live_api_read_only_snapshot, invariant_check, raw_pattern_scan]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "post snapshot 2026-05-12 21:57 KST + refresh 22:11 KST / confidence 94%"
---

# Option C Live Post-Snapshot

post-snapshot PASS입니다. biocom은 실제 결제완료 NPay 매출이 included로 붙었고, thecleancoffee는 bridge_pending으로 멈췄습니다.

## 최초 post-snapshot

| 체크 | 결과 |
|---|---|
| biocom summary | HTTP 200 |
| thecleancoffee summary | HTTP 200 |
| health | HTTP 200 |
| biocom actual included | PASS |
| biocom legacy present | PASS |
| biocom bridge pending present | PASS |
| coffee actual not included | PASS |
| coffee bridge pending | PASS |
| invariant 0 | PASS |
| raw pattern 0 | PASS |

## 22:11 KST refresh

| site | actual confirmed | legacy complete_time | bridge pending |
|---|---:|---:|---:|
| biocom | 163건 / ₩29,500,200 | 127건 / ₩25,168,000 | 61건 / ₩8,108,600 |
| thecleancoffee | bridge_pending | 261건 / ₩11,182,700 | 76건 / ₩5,110,600 |

산출 JSON: `data/option-c-live-post-snapshot-20260512.json`
