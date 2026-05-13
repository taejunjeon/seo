# Coffee Actual Status Sync + Monitor Cron Approval

작성 시각: 2026-05-13 19:28 KST
Owner: Codex  
Lane: Green approval packet. 실제 cron 등록과 status sync 실행은 Yellow 승인 필요.
Do not use for: 운영DB write/import, VM Cloud SQLite schema migration, platform send/upload, GTM publish, Imweb footer/header 변경

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
    - gdn/vm-cloud-imweb-sync-status-review-20260510.md
  lane: Green approval packet, Yellow VM Cloud cron/status sync registration if approved
  allowed_actions:
    - approval packet 작성
    - status sync cron 명령 설계
    - read-only monitor cron 명령 설계
    - rollback 명령 설계
  forbidden_actions:
    - cron registration before approval
    - status sync execution before approval
    - operational DB write/import
    - VM Cloud SQLite schema migration
    - platform send/upload
    - GTM publish
    - Imweb footer/header edit
  source_window_freshness_confidence:
    source: "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders + Imweb v2 shop/orders status list API + VM Cloud summary API"
    window: "thecleancoffee NPay rolling 30d, latest read-only monitor 2026-05-13 18:48:54 KST"
    freshness: "imweb_orders synced_at 2026-05-13 09:35:27, imweb_status_synced_at 2026-05-12 04:11:07, status sync lag 29.63h"
    confidence: 0.9
```

## 10초 요약

하루 4번 또는 1시간 단위로 돌릴 수 있다. 다만 두 작업을 분리해야 한다.

1. Status sync: Imweb v2 API를 다시 읽어 VM Cloud SQLite `imweb_orders.imweb_status`와 `imweb_status_synced_at`을 갱신한다. 이것이 status blank를 줄이는 작업이다. VM Cloud SQLite write이므로 Yellow 승인 후 실행한다.
2. Monitor: VM Cloud SQLite와 summary API를 read-only로 읽어 blank count, amount, lag만 기록한다. 이것은 안전하게 자주 돌릴 수 있지만 blank 자체를 줄이지는 않는다.

추천은 status sync를 처음부터 1시간마다 쓰지 않고, 먼저 하루 4회로 시작하는 것이다. 동시에 monitor는 1시간마다 돌려서 48~72시간 동안 API 429, 실행 시간, blank 감소 속도를 본 뒤 hourly status sync 승격을 판단한다.

## 현재 원인

더클린커피 actual 매출은 live API에 붙었지만, VM Cloud SQLite `imweb_orders.imweb_status` 보강 sync가 늦어 `included_with_warning` 상태다.

- DB 위치: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
- 테이블: VM Cloud SQLite `imweb_orders`
- 주문 수집 최신값: `imweb_orders.synced_at = 2026-05-13 09:35:27`
- status 보강 최신값: `imweb_orders.imweb_status_synced_at = 2026-05-12 04:11:07`
- lag: 29.63h
- 해석: 주문 원장은 들어오고 있으나 status 보강 job이 늦다. status blank를 미결제로 단정하면 안 된다.

## 무엇을 하는가

승인 후 VM Cloud에서 두 cron을 분리 등록한다.

1. 더클린커피 Imweb status sync cron
   - 주기: 하루 4회, 03:10 / 09:10 / 15:10 / 21:10 KST
   - 하는 일: Imweb v2 `shop/orders?status=...` 목록을 상태별로 읽고, VM Cloud SQLite `imweb_orders.imweb_status`와 `imweb_status_synced_at`만 갱신한다.
   - write 범위: VM Cloud SQLite status 보강 컬럼만. 운영DB write는 없다.

2. Coffee actual status monitor cron
   - 주기: 매시간 40분 KST
   - 하는 일: VM Cloud SQLite aggregate와 summary API를 read-only로 cross-check하고 JSON/log를 남긴다.
   - write 범위: monitoring output JSON/log 파일만. DB write는 없다.

## Imweb API와 데이터 흐름

Status sync는 운영DB가 아니라 VM Cloud backend의 Imweb v2 연동을 사용한다.

1. 인증
   - API: `POST https://api.imweb.me/v2/auth`
   - key 위치: `.env`의 더클린커피 Imweb API key/secret
   - 내부 코드: `backend/src/routes/crmLocal.ts`

2. 주문 기본 수집
   - API: `GET https://api.imweb.me/v2/shop/orders?offset={page}&limit={limit}`
   - 내부 route: `POST /api/crm-local/imweb/sync-orders`
   - 저장 위치: VM Cloud SQLite `imweb_orders`
   - 저장 필드 예: `site`, `order_time`, `complete_time`, `pay_type`, `payment_amount`, `raw_json`, `synced_at`

3. status 보강
   - API: `GET https://api.imweb.me/v2/shop/orders?status={STATUS}&offset={page}&limit={limit}`
   - 내부 route: `POST /api/crm-local/imweb/sync-order-statuses`
   - status 후보: `PAY_WAIT`, `PAY_COMPLETE`, `STANDBY`, `DELIVERING`, `COMPLETE`, `PURCHASE_CONFIRMATION`, `CANCEL`, `RETURN`, `EXCHANGE`
   - 저장 필드: VM Cloud SQLite `imweb_orders.imweb_status`, `imweb_orders.imweb_status_synced_at`

Imweb 응답 row 자체에 status 값이 안정적으로 들어오는 구조가 아니라, status별 목록을 조회한 뒤 해당 목록에 들어온 주문을 그 status로 라벨링하는 방식이다. 그래서 이 보강 job이 늦으면 주문은 있는데 `imweb_status`가 blank로 남는다.

## 왜 하루 4회부터 시작하는가

하루 1회 monitor만으로는 status blank 원인을 관측할 수는 있지만 해결하지 못한다. 반대로 처음부터 1시간마다 status sync write를 돌리면 Imweb API rate-limit, partial sync, 중복 실행, VM Cloud backend 부하를 먼저 검증하지 못한다.

따라서 권장 단계는 다음이다.

1. Status sync 하루 4회로 blank lag를 6시간 이하로 낮춘다.
2. Monitor는 1시간마다 돌려 실제 lag와 blank count 변화를 본다.
3. 48~72시간 동안 API 429 없음, 실행 시간 10분 이내, summary mismatch 없음이면 status sync를 1시간 단위로 승격할 수 있다.

## 승인 후 실행안

### 1. Precheck

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
   cd /home/biocomkr_sns/seo/repo/backend
   node -v
   test -f scripts/coffee-actual-status-monitor.ts
   curl -fsS http://127.0.0.1:7020/api/health >/dev/null
   echo precheck_ok'"
```

성공 기준:
- VM Cloud backend health가 200이다.
- monitor script가 VM Cloud repo에 있다.
- 이 단계는 DB write가 없다.

### 2. One-shot status sync

승인 후 cron 등록 전에 더클린커피 status sync를 한 번 실행한다. 이 단계는 VM Cloud SQLite status 보강 write가 발생한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   curl -sS -m 900 -X POST http://127.0.0.1:7020/api/crm-local/imweb/sync-order-statuses \
     -H \"Content-Type: application/json\" \
     -d \"{\\\"site\\\":\\\"thecleancoffee\\\",\\\"pageLimit\\\":100}\"'"
```

성공 기준:
- HTTP 200.
- status별 sync 결과가 반환된다.
- raw order/email/phone/member_code/payment/click_id를 로그나 보고서에 출력하지 않는다.
- 이후 monitor에서 `max_status_synced_at`이 최신으로 이동한다.

### 3. One-shot monitor

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
- `no_send=true`, `raw_identifier_output=false`.
- summary API cross-check count/amount가 aggregate와 맞는다.

### 4. Cron 등록

권장 첫 등록은 status sync 4회/일 + monitor 24회/일이다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   CRON_BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-status-sync-monitor-cron-\$(date +%Y%m%dT%H%M%SKST).txt
   mkdir -p /home/biocomkr_sns/seo/repo/.deploy-backups /home/biocomkr_sns/seo/repo/data/project/monitoring /home/biocomkr_sns/seo/logs
   crontab -l > \$CRON_BACKUP 2>/dev/null || true
   (crontab -l 2>/dev/null | grep -v \"sync-order-statuses.*thecleancoffee\" | grep -v \"coffee-actual-status-monitor.ts\"; cat <<\"CRON\"
10 3,9,15,21 * * * curl -sS -m 900 -X POST http://127.0.0.1:7020/api/crm-local/imweb/sync-order-statuses -H \"Content-Type: application/json\" -d \"{\\\"site\\\":\\\"thecleancoffee\\\",\\\"pageLimit\\\":100}\" >> /home/biocomkr_sns/seo/logs/coffee-imweb-status-sync.log 2>&1
40 * * * * export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && npx tsx scripts/coffee-actual-status-monitor.ts --mode=local --site=thecleancoffee --window-days=30 --window-hours=24 --summary-base-url=https://att.ainativeos.net --sqlite-path=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 --output=/home/biocomkr_sns/seo/repo/data/project/monitoring/coffee-actual-status-monitor-latest.json >> /home/biocomkr_sns/seo/logs/coffee-actual-status-monitor.log 2>&1
CRON
   ) | crontab -
   crontab -l | grep -E \"sync-order-statuses.*thecleancoffee|coffee-actual-status-monitor.ts\"
   echo backup=\$CRON_BACKUP'"
```

## 성공 기준

승인 후 성공은 아래를 모두 만족해야 한다.

1. one-shot status sync HTTP 200.
2. one-shot monitor JSON이 `ok=true`.
3. `max_status_synced_at`이 status sync 실행 시각 근처로 이동한다.
4. status sync cron 1줄과 monitor cron 1줄만 있다.
5. monitor output에 actual, status blank, cancel excluded, freshness, warnings가 모두 있다.
6. raw order/email/phone/member_code/payment/click_id가 output에 없다.
7. 운영DB write 0, platform send/upload 0, GTM publish 0이다.
8. VM Cloud SQLite write는 `imweb_orders.imweb_status`, `imweb_status_synced_at` 보강 범위로만 제한된다.

## 중단 기준

아래 중 하나라도 발생하면 cron을 제거하고 원인 분류로 전환한다.

- Imweb API 429 또는 TOO MANY REQUEST가 반복된다.
- status sync가 20분 이상 걸린다.
- summary API와 VM Cloud SQLite aggregate가 count/amount 기준으로 불일치한다.
- cancel/return/exchange excluded가 actual included에 섞인 evidence가 보인다.
- script가 raw identifier를 출력한다.
- external send/upload, 운영DB write, GTM publish 흔적이 보인다.
- VM Cloud CPU/IO 또는 backend health에 영향이 생긴다.

## Hourly status sync 승격 조건

처음부터 1시간마다 status sync write를 등록하지 않는다. 아래가 48~72시간 충족되면 승격한다.

- status sync 4회/일에서 API 429가 0회다.
- 평균 실행 시간이 10분 이하다.
- monitor상 status sync lag가 안정적으로 6시간 이하로 내려간다.
- status blank count가 줄거나, 줄지 않아도 root cause가 API/source 문제로 분리된다.
- summary API와 VM Cloud SQLite aggregate mismatch가 없다.

승격 시 cron은 `10 * * * *`로 바꾸고, 24시간 동안 monitor로 다시 감시한다.

## Rollback

Rollback은 crontab line 제거다. status sync가 이미 쓴 VM Cloud SQLite status 보강값은 Imweb API 기반 보강값이므로 일반적으로 역삭제하지 않는다. 잘못된 status가 확인되면 별도 rollback approval을 작성한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'set -euo pipefail
   crontab -l 2>/dev/null | grep -v \"sync-order-statuses.*thecleancoffee\" | grep -v \"coffee-actual-status-monitor.ts\" | crontab -
   crontab -l 2>/dev/null | grep -E \"sync-order-statuses.*thecleancoffee|coffee-actual-status-monitor.ts\" && exit 1 || echo coffee_status_sync_monitor_cron_removed'"
```

## 승인 요청 문구

TJ님이 진행하려면 아래처럼 승인하면 된다.

`[승인] Coffee Imweb status sync 4회/일 + actual status monitor 1시간 단위 등록 진행. 범위: VM Cloud에서 precheck, 더클린커피 sync-order-statuses one-shot 실행, monitor one-shot 실행, biocomkr_sns crontab에 status sync 03:10/09:10/15:10/21:10 KST 1줄과 monitor 매시간 40분 1줄 등록, post-check, rollback 준비. 허용: VM Cloud SQLite imweb_orders.imweb_status/imweb_status_synced_at 보강 write. 금지: 운영DB write/import, VM Cloud SQLite schema migration, platform send/upload, GTM publish, Imweb footer/header 변경, raw identifier 출력.`

## 추천

- 추천: 하루 4회 status sync + 1시간 단위 read-only monitor로 시작.
- 이유: 하루 1회 monitor는 status blank를 줄이지 못한다. 하루 4회 status sync는 freshness를 6시간 단위로 낮추면서 rate-limit 리스크를 먼저 볼 수 있다.
- 1시간 단위 status sync: 가능하지만 48~72시간 관측 후 승격 권장.
- 추천 점수/자신감: 90%.
