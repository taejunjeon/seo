# gpt0508-49 Next Actions And Approval

## 현재 목표

더클린커피 NPay actual source local patch는 PASS했다. 다음 목표는 TJ님이 VM backend deploy/restart를 승인할지 판단할 수 있게 실행 범위, 예상값, rollback 조건을 명확히 고정하는 것이다.

## 완료한 것

- local code patch 완료.
- typecheck PASS.
- targeted tests 16/16 PASS.
- VM Cloud read-only dry-run 완료.
- source guide/data inventory/coffee current/total current 업데이트 완료.
- VM deploy/restart는 실행하지 않음.

## 다음 명령

승인 전에는 아래 명령을 실행하지 않는다. 승인 후 Codex가 순서대로 수행한다.

### 1. pre-snapshot

```bash
mkdir -p data/gpt0508-49-live-snapshots
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24' > data/gpt0508-49-live-snapshots/pre-thecleancoffee.json
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=biocom&windowHours=24' > data/gpt0508-49-live-snapshots/pre-biocom.json
curl -sS -m 20 'https://att.ainativeos.net/api/health' > data/gpt0508-49-live-snapshots/pre-health.json
```

### 2. remote backup

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 "sudo -n -u biocomkr_sns bash -lc '
  set -euo pipefail
  cd /home/biocomkr_sns/seo/repo
  BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-49-$(date +%Y%m%dT%H%M%SKST)
  mkdir -p \"$BACKUP/backend/src/routes\" \"$BACKUP/backend/src\"
  cp backend/src/npayActualConfirmedPgReader.ts \"$BACKUP/backend/src/npayActualConfirmedPgReader.ts\"
  cp backend/src/siteLandingLedger.ts \"$BACKUP/backend/src/siteLandingLedger.ts\"
  cp backend/src/routes/attribution.ts \"$BACKUP/backend/src/routes/attribution.ts\"
  echo \"$BACKUP\"
'"
```

### 3. deploy copied files, build, restart

승인 후에만 local patched files를 VM repo 같은 경로에 복사한다. 이후:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 "sudo -n -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
  cd /home/biocomkr_sns/seo/repo/backend
  npm run typecheck
  npm run build
  pm2 restart seo-backend --update-env
  pm2 status seo-backend
'"
```

### 4. post-snapshot

```bash
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24'
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=biocom&windowHours=24'
```

## 기대값

- thecleancoffee `derived.npay_revenue_30d_actual_confirmed.source`: `imweb_v2_vm_cloud_imweb_orders`
- thecleancoffee status: `included_with_warning`
- thecleancoffee included 후보: 308건 / 약 14,835,000원
- thecleancoffee status blank: 13건 / 약 877,100원
- thecleancoffee warnings: `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h`
- biocom actual confirmed: 기존 `operational_db.tb_iamweb_users PAYMENT_COMPLETE` included 유지
- invariants: external send 0, upload 0, operational DB write 0, GTM publish 0, raw PII/order/payment/click id exposure false

## rollback 조건

다음 중 하나라도 나오면 즉시 rollback한다.

- summary API 5xx
- biocom actual source/status/count가 깨짐
- coffee cancel/return/exchange가 included에 들어감
- raw email/phone/member_code/order/payment/click_id가 response에 노출됨
- GA4 revenue가 actual NPay 매출 source로 쓰임
- 외부 platform send/upload가 발생함

## rollback 명령

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 taejun@34.64.104.94 "sudo -n -u biocomkr_sns bash -lc '
  set -euo pipefail
  export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
  cd /home/biocomkr_sns/seo/repo
  BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/<gpt0508-49-backup-dir>
  cp \"$BACKUP/backend/src/npayActualConfirmedPgReader.ts\" backend/src/npayActualConfirmedPgReader.ts
  cp \"$BACKUP/backend/src/siteLandingLedger.ts\" backend/src/siteLandingLedger.ts
  cp \"$BACKUP/backend/src/routes/attribution.ts\" backend/src/routes/attribution.ts
  cd backend
  npm run typecheck
  npm run build
  pm2 restart seo-backend --update-env
'"
```

## 절대 건드리면 안 되는 것

- 운영DB write/import.
- VM Cloud schema migration.
- cron 등록/변경.
- GA4/Meta/TikTok/Google Ads/Naver send/upload.
- GTM publish.
- Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.

## Handoff Block

- 현재 목표: gpt0508-49 local patch를 승인 가능한 VM deploy packet으로 넘긴다.
- 완료한 것: code patch, tests, dry-run, source docs.
- 다음 명령: validation 전체 실행 후 commit/push. 승인 전 deploy/restart 금지.
- 절대 건드리면 안 되는 것: DB write, VM deploy/restart, platform send/upload, GTM publish, Imweb footer/header, secrets/raw identifiers.

## TJ님 승인 판단

Codex 추천은 “조건부 YES”다. 이유는 로컬 patch와 fixture는 통과했고 source isolation도 좋지만, status blank 13건과 status sync stale warning이 남기 때문이다. 승인하면 live dashboard/backend API에서 coffee actual 후보를 볼 수 있고, 승인하지 않으면 coffee는 계속 `bridge_pending`으로 남는다.
