# Coffee Actual Status Monitor Cron Approval

작성 시각: 2026-05-13 19:10 KST  
Owner: Codex  
Lane: Green approval packet. 실제 cron 등록은 Yellow 승인 필요.  
Do not use for: 운영DB write/import, VM Cloud SQLite write/schema migration, platform send/upload, GTM publish, Imweb footer/header 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - project/sprint1.md
    - data/project/coffee-actual-status-monitor-latest-20260513.json
  lane: Green approval packet, Yellow cron registration if approved
  allowed_actions:
    - approval packet 작성
    - read-only dry-run command 설계
    - cron 등록 명령 설계
    - rollback 명령 설계
  forbidden_actions:
    - cron registration before approval
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - platform send/upload
    - GTM publish
    - Imweb footer/header edit
  source_window_freshness_confidence:
    source: "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders + VM Cloud summary API"
    window: "thecleancoffee NPay rolling 30d, latest read-only monitor 2026-05-13 18:48:54 KST"
    freshness: "imweb_orders synced_at 2026-05-13 09:35:27, imweb_status_synced_at 2026-05-12 04:11:07, status sync lag 29.63h"
    confidence: 0.9
```

## 10초 요약

더클린커피 actual 매출은 live API에 붙었지만, VM Cloud SQLite `imweb_orders.imweb_status` 보강 sync가 늦어 `included_with_warning` 상태다. Cron으로 하루 한 번 같은 monitor를 돌리면 status blank가 줄어드는지, 더 늘어나는지, status sync가 멈춘 것인지 매일 같은 숫자로 판단할 수 있다. 실제 cron 등록은 VM Cloud 파일/cron 변경이므로 TJ님 Yellow 승인 전 실행하지 않는다.

## 무엇을 하는가

VM Cloud에서 더클린커피 NPay actual 상태를 매일 read-only로 확인하는 cron을 등록한다.

cron이 실행할 일:

1. VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders(site='thecleancoffee', pay_type='npay')`를 read-only aggregate로 읽는다.
2. VM Cloud summary API `https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24`와 숫자를 cross-check한다.
3. 아래 값을 JSON으로 남긴다.
   - actual count/amount
   - status blank count/amount
   - cancel/return/exchange excluded count/amount
   - max order time
   - max order sync time
   - max status sync time
   - status sync lag hours
   - warnings
   - no_send/no_write/raw_identifier_output

## 왜 필요한가

더클린커피 actual은 현재 `included_with_warning`이다. 이 warning의 핵심은 “주문은 들어오는데 status 보강 sync가 늦다”는 점이다.

이 상태를 수동으로만 보면 두 문제가 생긴다.

1. status blank가 줄었는지 늘었는지 놓친다.
2. 실제 취소/반품/교환 status가 나중에 붙었을 때 included 금액이 얼마나 바뀌는지 모른다.

Cron monitor는 매출을 바꾸지 않는다. 외부 플랫폼에도 보내지 않는다. 숫자와 stale warning만 매일 같은 형식으로 남긴다.

## 어떻게 할 것인가

### 1. Precheck

아래는 승인 후 VM Cloud에서 먼저 확인할 명령이다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
   cd /home/biocomkr_sns/seo/repo/backend
   test -f scripts/coffee-actual-status-monitor.ts
   sqlite3 -version >/dev/null
   node -v
   npx --yes tsx --version >/dev/null
   echo precheck_ok'"
```

성공 기준:
- script가 VM Cloud repo에 있다.
- `sqlite3`, `node`, `tsx` 실행이 가능하다.
- 이 단계는 DB write가 없다.

실패 시:
- script가 없으면 승인 범위 안에서 `backend/scripts/coffee-actual-status-monitor.ts` 1파일 배포가 필요하다.
- `tsx`가 없으면 backend dependency 확인 또는 compiled JS wrapper가 필요하다.

### 2. One-shot dry-run

cron 등록 전에 같은 명령을 한 번만 실행한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
   cd /home/biocomkr_sns/seo/repo/backend
   mkdir -p /home/biocomkr_sns/seo/repo/data/project/monitoring
   npx tsx scripts/coffee-actual-status-monitor.ts \
     --mode=local \
     --site=thecleancoffee \
     --window-days=30 \
     --window-hours=24 \
     --summary-base-url=https://att.ainativeos.net \
     --sqlite-path=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 \
     --output=/home/biocomkr_sns/seo/repo/data/project/monitoring/coffee-actual-status-monitor-latest.json'"
```

성공 기준:
- output JSON `ok=true`.
- `source=imweb_v2_vm_cloud_imweb_orders`.
- `db_location`이 VM Cloud SQLite를 가리킨다.
- `no_send=true`, `no_write=true`, `raw_identifier_output=false`.
- summary API cross-check count/amount가 aggregate와 맞는다.

### 3. Cron 등록

권장 스케줄은 하루 1회 09:20 KST다. status sync stale 여부를 보기 위한 24h monitor이므로 과도한 빈도는 필요 없다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   CRON_BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-status-monitor-cron-\$(date +%Y%m%dT%H%M%SKST).txt
   mkdir -p /home/biocomkr_sns/seo/repo/.deploy-backups /home/biocomkr_sns/seo/repo/data/project/monitoring /home/biocomkr_sns/seo/logs
   crontab -l > \$CRON_BACKUP 2>/dev/null || true
   (crontab -l 2>/dev/null | grep -v \"coffee-actual-status-monitor.ts\"; cat <<\"CRON\"
20 9 * * * export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && npx tsx scripts/coffee-actual-status-monitor.ts --mode=local --site=thecleancoffee --window-days=30 --window-hours=24 --summary-base-url=https://att.ainativeos.net --sqlite-path=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 --output=/home/biocomkr_sns/seo/repo/data/project/monitoring/coffee-actual-status-monitor-latest.json >> /home/biocomkr_sns/seo/logs/coffee-actual-status-monitor.log 2>&1
CRON
   ) | crontab -
   crontab -l | grep coffee-actual-status-monitor.ts
   echo backup=\$CRON_BACKUP'"
```

등록 후 확인:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'crontab -l | grep coffee-actual-status-monitor.ts && tail -n 80 /home/biocomkr_sns/seo/logs/coffee-actual-status-monitor.log || true'"
```

## 성공 기준

승인 후 성공은 아래를 모두 만족해야 한다.

1. one-shot dry-run JSON이 `ok=true`다.
2. 매일 09:20 KST cron line이 `biocomkr_sns` crontab에 1개만 있다.
3. JSON output에 actual, status blank, cancel excluded, freshness, warnings가 모두 있다.
4. raw order/email/phone/member_code/payment/click_id가 output에 없다.
5. 운영DB write 0, VM Cloud SQLite write/schema migration 0, external send/upload 0, GTM publish 0이다.
6. 3일 연속 실행 후 status blank trend를 볼 수 있다.

## 중단 기준

아래 중 하나라도 발생하면 cron을 제거하고 원인 분류로 전환한다.

- script가 raw identifier를 출력한다.
- `no_send` 또는 `no_write`가 false가 된다.
- summary API와 VM Cloud SQLite aggregate가 count/amount 기준으로 불일치한다.
- script가 2일 연속 실패한다.
- status sync lag가 48h를 넘고 계속 증가한다.
- cancel/return/exchange excluded가 actual included에 섞인 evidence가 보인다.

## Rollback

cron은 DB schema나 데이터를 바꾸지 않는다. rollback은 crontab line 제거다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   crontab -l 2>/dev/null | grep -v \"coffee-actual-status-monitor.ts\" | crontab -
   crontab -l 2>/dev/null | grep coffee-actual-status-monitor.ts && exit 1 || echo coffee_status_monitor_cron_removed'"
```

## 승인 요청 문구

TJ님이 진행하려면 아래처럼 승인하면 된다.

`[승인] Coffee actual status monitor cron 등록 진행. 범위: VM Cloud에서 precheck, one-shot dry-run, biocomkr_sns crontab 09:20 KST 1줄 등록, post-check, rollback 준비. 금지: 운영DB write/import, VM Cloud SQLite write/schema migration, platform send/upload, GTM publish, Imweb footer/header 변경, raw identifier 출력.`

## 추천

- 추천: 조건부 진행.
- 이유: status blank warning이 운영 판단에 영향을 주므로 자동 관측 가치가 높다.
- 위험: 낮음. 다만 crontab 변경은 VM Cloud 운영 파일 변경이므로 Yellow 승인 후 진행해야 한다.
- 추천 점수/자신감: 86%.
