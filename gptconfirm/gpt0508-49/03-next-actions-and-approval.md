# gpt0508-49 Next Actions And Approval

## 현재 목표

더클린커피 NPay actual source VM backend deploy/restart는 TJ님 승인 범위 안에서 완료됐다. 다음 목표는 배포 결과, backup 위치, rollback 가능 조건, 그리고 ROAS gap/프론트 대시보드 후속 작업을 명확히 고정하는 것이다.

## 완료한 것

- local code patch 완료.
- targeted tests 16/16 PASS.
- VM Cloud read-only dry-run 완료.
- pre-snapshot 저장 완료.
- remote backup 생성 완료: `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-49-20260513T005354KST`.
- backend 파일 3개 VM 배포 완료.
- remote backend typecheck/build PASS.
- `seo-backend` restart 완료, PM2 online.
- post-snapshot 검증 PASS.
- source guide/data inventory/coffee current/total current 업데이트 완료.

## 다음 명령

아래 명령은 이번 배포에서 실행한 절차다. rollback이 필요하면 마지막 rollback 명령만 backup 경로를 실제값으로 넣어 실행한다.

### 1. pre-snapshot

```bash
mkdir -p data/gpt0508-49-live-snapshots
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24' > data/gpt0508-49-live-snapshots/pre-thecleancoffee.json
curl -sS -m 20 'https://att.ainativeos.net/api/attribution/site-landing/summary?site=biocom&windowHours=24' > data/gpt0508-49-live-snapshots/pre-biocom.json
curl -sS -m 20 'https://att.ainativeos.net/health' > data/gpt0508-49-live-snapshots/pre-health.json
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

local patched files를 VM repo 같은 경로에 복사한 뒤 실행했다.

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
- thecleancoffee included 후보: 309건 / 14,902,800원 post-snapshot PASS
- thecleancoffee status blank: 14건 / 944,900원 post-snapshot PASS
- thecleancoffee warnings: `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h`
- biocom actual confirmed: 기존 `operational_db.tb_iamweb_users PAYMENT_COMPLETE` included 유지, 162건 / 29,463,300원
- invariants: external send 0, upload 0, operational DB write 0, GTM publish 0, raw PII/order/payment/click id exposure false

## post-snapshot 결과

| site | actual source | status | count | amount | 판정 |
|---|---|---|---:|---:|---|
| `thecleancoffee` | `imweb_v2_vm_cloud_imweb_orders` | `included_with_warning` | 309 | 14,902,800원 | PASS |
| `biocom` | `operational_db.tb_iamweb_users PAYMENT_COMPLETE` | `included` | 162 | 29,463,300원 | PASS |

Health는 `https://att.ainativeos.net/health` 기준 200이다. `https://att.ainativeos.net/api/health`는 기존 라우트 미존재로 `route_not_found`를 반환하므로 rollback 조건으로 보지 않는다.

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
  BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-49-20260513T005354KST
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

- 현재 목표: gpt0508-49 live deploy 결과를 후속 ROAS/프론트 스프린트로 넘긴다.
- 완료한 것: code patch, tests, dry-run, pre-snapshot, backup, deploy, remote build, restart, post-snapshot, source docs.
- 다음 명령: validation 전체 실행 후 commit/push. rollback은 실패 조건 발생 시에만 실행.
- 절대 건드리면 안 되는 것: DB write, 승인 범위 밖 deploy/restart, platform send/upload, GTM publish, Imweb footer/header, secrets/raw identifiers.

## TJ님 승인 판단

이번 승인 범위 실행은 PASS다. 추가 승인 판단은 프론트 대시보드 배포/재시작, Google Ads 전환 upload, GTM publish 같은 별도 Yellow/Red 작업에만 필요하다. Codex 추천은 다음 Green 작업인 24h monitor, ROAS gap recompute, channel funnel 최신화는 바로 진행하는 것이다.
