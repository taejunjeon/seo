# Coffee Status Sync Cron Activation

작성 시각: 2026-05-13 21:05 KST
Owner: Codex
Lane: Yellow approved by TJ

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
    - gdn/coffee-status-monitor-cron-approval-20260513.md
  lane: Yellow approved VM Cloud cron/status sync execution
  allowed_actions:
    - VM Cloud monitor script deploy
    - one-shot thecleancoffee Imweb status sync
    - one-shot read-only monitor
    - VM Cloud biocomkr_sns crontab registration
  forbidden_actions:
    - operational DB write/import
    - VM Cloud SQLite schema migration
    - platform send/upload
    - GTM publish
    - Imweb footer/header edit
    - raw identifier output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite imweb_orders + Imweb v2 status list API + VM Cloud summary API"
    window: "thecleancoffee NPay rolling 30d"
    freshness: "post-monitor 2026-05-13 21:03:15 KST, max_status_synced_at 2026-05-13 12:02:48 UTC"
    confidence: 0.92
```

## 결과

승인받은 방향대로 더클린커피 Imweb status sync를 하루 4회, monitor를 1시간 단위로 돌리도록 VM Cloud `biocomkr_sns` crontab에 등록했다.

VM Cloud 서버 시간이 UTC라서 crontab은 아래처럼 등록했다.

- status sync: `10 0,6,12,18 * * *`
- KST 환산: 03:10 / 09:10 / 15:10 / 21:10
- read-only monitor: `40 * * * *`

## One-Shot 결과

승인 후 one-shot status sync를 실행했다. endpoint 응답 요약 formatter에서 `node` PATH가 빠져 출력은 실패했지만, sync 자체는 완료됐다. 근거는 직후 monitor에서 `max_status_synced_at`이 실행 시각으로 이동했고, status blank가 급감한 것이다.

| 항목 | 실행 전 18:48 KST | 실행 후 21:03 KST |
|---|---:|---:|
| actual count | 315 | 315 |
| actual amount | 15,477,100원 | 15,486,200원 |
| status blank | 32건 / 1,983,600원 | 2건 / 68,700원 |
| status sync lag | 29.63h | 0.01h |
| stale warning | 있음 | 없음 |

남은 warning은 `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`이다. `status_sync_stale_over_6h`는 사라졌다.

## 등록된 Cron

```cron
# coffee imweb status sync: KST 03:10,09:10,15:10,21:10 (server UTC 18:10,00:10,06:10,12:10)
10 0,6,12,18 * * * curl -sS -m 900 -X POST http://127.0.0.1:7020/api/crm-local/imweb/sync-order-statuses -H "Content-Type: application/json" -d "{\"site\":\"thecleancoffee\",\"pageLimit\":100}" >> /home/biocomkr_sns/seo/logs/coffee-imweb-status-sync.log 2>&1

# coffee actual status monitor: hourly at :40, read-only DB/API aggregate
40 * * * * export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && npx tsx scripts/coffee-actual-status-monitor.ts --mode=local --site=thecleancoffee --window-days=30 --window-hours=24 --summary-base-url=https://att.ainativeos.net --sqlite-path=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 --output=/home/biocomkr_sns/seo/repo/data/project/monitoring/coffee-actual-status-monitor-latest.json >> /home/biocomkr_sns/seo/logs/coffee-actual-status-monitor.log 2>&1
```

Backup:

`/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-status-sync-monitor-20260513T120354UTC`

## Guard

- 운영DB write/import: 0
- VM Cloud SQLite schema migration: 0
- VM Cloud SQLite write scope: `imweb_orders.imweb_status`, `imweb_status_synced_at` only
- platform send/upload: 0
- GTM publish: 0
- Imweb footer/header 변경: 0
- raw identifier output: 0

## 다음 Gate

48~72시간 동안 아래를 본 뒤 status sync를 hourly로 승격할지 결정한다.

1. Imweb API 429 또는 TOO MANY REQUEST 0회.
2. status sync 평균 실행 시간 10분 이하.
3. summary API와 VM Cloud SQLite aggregate mismatch 0회.
4. backend health 안정.
5. status blank가 0에 가까워지거나, 남은 blank 2건의 source root cause가 별도로 분류됨.
