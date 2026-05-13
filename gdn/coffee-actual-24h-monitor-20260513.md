---
title: Coffee Actual 24h Status Monitor
date: 2026-05-13
owner: Codex
lane: Green read-only
---

# Coffee Actual 24h Status Monitor

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - project/sprint1.md
  lane: Green read-only monitor
  allowed_actions:
    - live summary API read-only check
    - VM Cloud SQLite read-only aggregate
    - cron/log existence read-only check
    - local JSON/Markdown evidence
  forbidden_actions:
    - cron registration/change
    - platform send/upload
    - operational DB write
    - GTM publish
    - Imweb footer/header edit
  source_window_freshness_confidence:
    source: "VM Cloud summary API + VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders"
    window: "thecleancoffee NPay recent 30d; site landing API windowHours=24 smoke"
    freshness: "order sync 2026-05-13 01:30:03 UTC-ish, status sync 2026-05-12 04:11:07"
    confidence: 0.92
```

## 결론

전용 24h coffee actual status monitor는 자동으로 돌고 있지 않았다. VM Cloud cron에는 `/home/biocomkr_sns/seo/coffee-monitoring/run.sh`가 매일 KST 09:00에 잡혀 있지만, 이 스크립트는 `scripts/coffee-npay-intent-monitoring-report.ts`를 실행하는 기존 NPay intent 모니터다. 더클린커피 actual source의 `imweb_status` blank를 직접 추적하는 monitor는 아니다.

Codex가 수동 read-only 24h 모니터를 실행했다. 더클린커피 live summary API는 계속 `included_with_warning`이고 source는 `imweb_v2_vm_cloud_imweb_orders`다. 최근 30일 actual 후보는 318건 / 15,503,000원이며, status blank는 26건 / 1,663,600원으로 늘었다.

## 왜 blank가 늘었는가

`status blank`는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders.imweb_status`가 빈 row를 뜻한다. 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`의 결제 상태 blank가 아니고, 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` row도 아니다.

이번 확인에서 blank 26건은 모두 `imweb_status_synced_at` marker가 없었다. VM Cloud SQLite `imweb_orders`의 order sync는 `2026-05-13 01:30:03`까지 들어왔지만, status sync는 `2026-05-12 04:11:07`에서 멈춰 있었다. 따라서 원인은 결제 실패나 미결제 단정이 아니라 `source_freshness_gap_status_sync_lag`다.

## 현재 숫자

| 항목 | 2026-05-13 02:02 KST | 2026-05-13 10:37 KST |
|---|---:|---:|
| actual 후보 | 311건 / 14,970,600원 | 318건 / 15,503,000원 |
| status blank | 16건 / 1,012,700원 | 26건 / 1,663,600원 |
| confirmed status only | 295건 / 13,957,900원 | 292건 / 13,839,400원 |
| cancel/return/exchange 제외 | 31건 / 1,796,400원 | 31건 / 1,796,400원 |
| max order_time | - | 2026-05-13T01:21:01.000Z |
| max synced_at | - | 2026-05-13 01:30:03 |
| max imweb_status_synced_at | 2026-05-12 04:11:07 | 2026-05-12 04:11:07 |

## 판정

- actual source 유지: PASS.
- `included_with_warning` 유지: PASS.
- 취소/반품/교환 제외: PASS, 31건 / 1,796,400원 제외.
- raw email/phone/member_code/order/payment/click_id 노출: 0.
- external send/upload: 0.
- 운영DB write: 0.
- GTM publish: 0.
- dedicated auto monitor: FAIL/미구축. 기존 cron은 NPay intent monitor라 목적이 다르다.

## 다음 행동

1. Green: 전용 status monitor 스크립트를 추가한다. cron 등록은 하지 않고, `summary API + VM Cloud SQLite aggregate`를 같은 JSON shape로 출력하게 만든다.
2. Yellow: 자동 24h cron 등록이 필요하면 별도 승인 후 `/home/biocomkr_sns/seo/coffee-status-monitoring/run.sh` 형태로 등록한다.
3. Green: status sync가 계속 `2026-05-12 04:11:07`에서 멈추면 Imweb v2 status sync job 점검 승인안을 작성한다.

상세 raw evidence: `data/project/coffee-actual-24h-monitor-20260513.json`.
