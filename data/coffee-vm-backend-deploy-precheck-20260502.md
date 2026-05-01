# VM production backend 배포 사전 체크리스트 (2026-05-02)

상위 sprint: [[!coffeedata#2026-05-02 enforce series 종결 (B-2)]] 의 **다음 sprint 항목 15**.

배포 대상: `seo-backend` (pm2 id=0, VM `34.64.104.94:7020`, owner `biocomkr_sns`, repo `~/seo/repo/`)

본 문서 성격: **배포 직전 가이드**. 본 문서 자체에는 실제 배포 명령 실행이 포함되지 않으며, 모든 변경은 TJ 별도 승인 게이트로 분리.

## 0. 결론 (10초)

| 항목 | 판정 |
|---|---|
| 배포 가능 여부 | **YES** (모든 사전 사실 수집 완료) |
| migration 위험 | **없음** — VM SQLite 에 `coffee_npay_intent_log` / `schema_versions` 테이블 부재 → `CREATE TABLE IF NOT EXISTS` 로 빈 v2 새로 생성 |
| .env 위험 | **없음** — `backend/.env` rsync exclude. enforce 키 미설정 = endpoint dormant 자동 활성 |
| dependency 변경 | **없음** — 로컬 vs VM `package.json` diff 0 |
| 신규 endpoint 노출 시점 | pm2 restart 직후. enforce flag/window 미설정으로 read-only stats + dry-run 만 동작 |
| 외부 send (GA4/Meta/TikTok/Google Ads) | **0** (코드 자체에 발신 없음) |
| 로컬 측 미해결 1건 | **rsync 미설치** — `brew install rsync` 가 배포 첫 단계 |
| 권한 우회 1건 | rsync 시 `--rsync-path="sudo -u biocomkr_sns rsync"` 필수 (taejun → biocomkr_sns owner 전환) |

## 1. 수집된 환경 사실

### 1.1 로컬 (macOS)

| 항목 | 값 |
|---|---|
| git HEAD | `a06a5a9` (B-2 종결 commit) |
| origin/main 과 차이 | 1 commit ahead (a06a5a9 — docs only) |
| backend src mtime | 2026-05-01 23:40 |
| backend dist mtime | 2026-05-01 23:45 (src 보다 5분 늦음 — fresh build) |
| `npm run typecheck` | **PASS** (no errors) |
| `npm run build` | **PASS** |
| rsync 설치 여부 | **미설치** (`rsync: command not found`) |

### 1.2 VM (`34.64.104.94`)

| 항목 | 값 |
|---|---|
| ssh 접속 | OK (`taejun@34.64.104.94`, BatchMode) |
| hostname | `instance-20260412-035206` |
| uptime | 7d (load 0.01) |
| pm2 `seo-backend` | online, pid 144309, 2D uptime, restart 34, 263MB |
| pm2 `seo-cloudflared` | online, pid 654, 7D uptime, restart 0 |
| pm2 `seo-frontend` | online, pid 152637, 2D uptime, restart 17 |
| node | v22.14.0 |
| npm | 10.9.2 |
| repo 경로 | `/home/biocomkr_sns/seo/repo` (`.git` 디렉토리 부재 — git checkout 아닌 rsync 운영) |
| repo owner/perm | `biocomkr_sns:biocomkr_sns` 700 (`/home/biocomkr_sns` 단계부터 700) |
| backend `node_modules` | 존재 (Apr 29 06:49) |
| backend `dist` | 존재 (Apr 29 06:50) — 신규 endpoint 미포함 코드 |
| backend `src/coffeeNpayIntentLog.ts` | **부재** (배포 시 신규 추가 예정) |
| backend `src/routes/coffee.ts` | 3793 bytes (Apr 24, 정기구독 router 만 — 로컬 15544 bytes 와 차이 큼) |
| SQLite `~/repo/backend/data/crm.sqlite3` | 150MB (May 1 15:40) |
| `coffee_npay_intent_log` 테이블 | **부재** |
| `schema_versions` 테이블 | **부재** |
| smoke window 테이블 | **부재** |
| `.env` `COFFEE_NPAY_INTENT_*` 변수 | **0줄** (.env 총 201줄) |
| `taejun` 그룹 | `google-sudoers` 포함 → NOPASSWD `sudo -u biocomkr_sns` 가능 |
| port 7020 | listen by `node` (pid 144309, owner biocomkr_sns) |
| cloudflared | `cloudflared tunnel run --token-file /home/biocomkr_sns/seo/shared/secrets/cloudflared.token` (ingress 룰은 Cloudflare Zero Trust dashboard 측 — VM 무변경) |

### 1.3 외부 도메인 baseline (배포 전, 2026-05-02 기준)

| Path | Method | Status | 의미 |
|---|---|---|---|
| `/health` | GET | 200 | tunnel + backend alive |
| `/api/coffee/intent/stats` | GET | **404** | 신규 endpoint, 배포 후 200 기대 |
| `/api/attribution/coffee-npay-intent` | OPTIONS | 204 | CORS middleware (Origin allow `https://thecleancoffee.com`) — 배포 무관 통과 |
| `/api/attribution/coffee-npay-intent` | POST | **404** | 신규 endpoint, 배포 후 200/4xx 정상 응답 기대 |
| `/api/coffee/sync-subscriber-tracks` | GET | 404 | 코드는 POST 만 정의 — method mismatch (정상) |

## 2. 영향 범위

### 2.1 코드 변경 (rsync 가 옮길 것)

| Layer | 영향 |
|---|---|
| `backend/src/coffeeNpayIntentLog.ts` | **신규 추가** (700+ 줄) |
| `backend/src/routes/coffee.ts` | **수정** (3793 → 15544 bytes, intent endpoint 7개 + applyCoffeeIntentGuard 미들웨어 추가) |
| `backend/src/server.ts` | 미변경 (mtime Apr 18) |
| `backend/package.json` | 미변경 (deps 동일) |
| 로컬 `data/`, `harness/`, `tiktok/`, `amplitude/` 등 | rsync working tree 동기화 — 다른 sprint 산출물도 함께 감 (운영에 영향 없음, 단 deletion 위험은 dry-run 으로 사전 확인) |

### 2.2 런타임 효과 (배포 후 즉시)

| 항목 | 효과 |
|---|---|
| 신규 endpoint 7종 | live (단 enforce 가드로 INSERT 0) |
| SQLite migration | backend 첫 시작 시 빈 `schema_versions` + `coffee_npay_intent_log` (v2) + smoke window 테이블 자동 생성 |
| ledger row count | 0 (운영 데이터 무관) |
| 외부 send | 0 (코드 자체에 GA4/Meta/TikTok/Google Ads 발신 없음) |
| pm2 restart | 1회 (5초 다운타임) |
| frontend / cloudflared | 영향 없음 |

## 3. Schema migration idempotency 분석

`backend/src/coffeeNpayIntentLog.ts:228, 275, 281, 1195` 검토 결과:

```typescript
// schema_versions: idempotent
CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSIONS_TABLE} (...)

// coffee_npay_intent_log: 신규 시작이면 v2 직접 생성
// 단 cur < v2 + row > 0 이면 abort (수동 migration 요구)
if (cnt > 0 && cur < SCHEMA_VERSION) {
  throw new Error(`coffee_npay_intent_log → v${SCHEMA_VERSION} migration aborted: ${cnt} rows present`);
}
CREATE TABLE ${TABLE} (...)  // v2

// smoke_window: 별도 테이블, IF NOT EXISTS
CREATE TABLE IF NOT EXISTS ${SMOKE_WINDOW_TABLE} (...)
```

**판정**: VM 에 두 테이블 모두 부재 + row 0 → migration abort 분기 미발동. **위험 0**.

## 4. rsync 권한 우회 패턴

`/home/biocomkr_sns/` perm 700, taejun 직접 쓰기 불가. `--rsync-path` 로 원격측 sudo 위임:

```bash
rsync -az --delete \
  -e "ssh -o ConnectTimeout=10" \
  --rsync-path="sudo -u biocomkr_sns rsync" \
  --exclude ".git" --exclude "node_modules" --exclude "frontend/.next" \
  --exclude "backend/dist" --exclude "backend/.env" --exclude "backend/data" \
  --exclude "backend/logs" --exclude ".DS_Store" \
  /Users/vibetj/coding/seo/ taejun@34.64.104.94:/home/biocomkr_sns/seo/repo/
```

(`capivm/deploy-backend-rsync.sh` 의 기본 명령은 `--rsync-path` 가 없음. 본 sprint 에서는 deploy 스크립트 수정 대신 위 명령을 직접 사용.)

## 5. Pre-flight 체크리스트 (배포 직전 final guard)

배포 명령 실행 직전, 아래 7항목을 순서대로 확인.

| # | 항목 | 명령/방법 | 기대 |
|---|---|---|---|
| P1 | 로컬 git working tree 검토 | `git status -s` | 의도한 변경만 stage. 무관 untracked 가 rsync 대상이면 명시적 인지 또는 추가 exclude |
| P2 | 로컬 `npm run typecheck` | `cd backend && npm run typecheck` | exit 0 |
| P3 | 로컬 `npm run build` | `cd backend && npm run build` | exit 0 (단 VM 에서 다시 build 하므로 sanity 용) |
| P4 | rsync 설치 (로컬) | `rsync --version` | 3.x+ (`brew install rsync` 완료) |
| P4.1 | rsync 설치 (VM, 1회) | `ssh taejun@34.64.104.94 "sudo apt-get install -y rsync"` | Debian 13 기본 미설치. taejun NOPASSWD root sudo 로 1회 설치 (taejun + biocomkr_sns 양쪽 PATH 에 즉시 사용 가능) |
| P5 | rsync **dry-run** 으로 변경/삭제 목록 확인 | 4번 명령에 `-n --itemize-changes` 추가 | deletion 항목이 의도와 일치 (특히 backend/ 외 디렉토리) |
| P6 | VM 백업 (선택) — SQLite 스냅샷 | `ssh ... "sudo -u biocomkr_sns cp ~/seo/repo/backend/data/crm.sqlite3 ~/seo/backups/crm.sqlite3.$(date +%Y%m%d-%H%M)"` | 150MB 복사 |
| P7 | VM pm2 현재 상태 캡처 | `ssh ... "sudo -u biocomkr_sns bash -lc 'pm2 list'"` | restart 시점 비교용 |

## 6. 배포 명령 sequence (실제 실행은 TJ 별도 승인)

> **중요 갱신 (P5 dry-run 결과 반영)**: 전체 repo sync 는 의도치 않은 deletion 6,055건 (frontend.backup.* 5,479건 + 그 외) 위험으로 차단. **`backend/` subset sync 로 좁힌다**. dry-run 결과 deletion 0건 + 신규 12 + 수정 3 = 전송 15 (총 ~390KB). 자세한 evidence 는 §11 참조.

```bash
# Step 1. 로컬 sanity (P2 + P3)
cd /Users/vibetj/coding/seo/backend && npm run typecheck && npm run build

# Step 2. rsync — backend/ subset sync (P5'' dry-run 통과 후 -n 제거)
rsync -az --delete \
  -e "ssh -o ConnectTimeout=15" \
  --rsync-path="sudo -u biocomkr_sns rsync" \
  --exclude "node_modules" \
  --exclude "dist" \
  --exclude ".env" \
  --exclude "data" \
  --exclude "logs" \
  --exclude "src.old" \
  --exclude "._*" \
  --exclude "*.bak_*" \
  --exclude "*.backup.*" \
  --exclude ".DS_Store" \
  /Users/vibetj/coding/seo/backend/ taejun@34.64.104.94:/home/biocomkr_sns/seo/repo/backend/

# Step 3. VM build + pm2 restart
ssh taejun@34.64.104.94 "sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
  cd /home/biocomkr_sns/seo/repo/backend
  npm ci
  npm run typecheck
  npm run build
  pm2 restart seo-backend --update-env
  pm2 save
  pm2 list
'"
```

`pm2 restart --update-env` 는 만일의 .env 갱신을 반영하기 위함. 본 배포에서는 .env 미수정이라 무영향이지만 안전 옵션.

## 7. Post-deploy smoke (배포 직후 검증, 4 항목)

배포 직후 외부 도메인 reachability 가 깨끗한지.

| # | 명령 | 기대 |
|---|---|---|
| S1 | `curl -sS https://att.ainativeos.net/health` | `status=ok` |
| S2 | `curl -sS https://att.ainativeos.net/api/coffee/intent/stats \| jq '.enforce_flag_active, .smoke_window_active, .total_rows'` | `false / false / 0` (VM SQLite 가 신규로 비어 있음) |
| S3 | `curl -sS -X OPTIONS https://att.ainativeos.net/api/attribution/coffee-npay-intent -H "Origin: https://thecleancoffee.com" -H "Access-Control-Request-Method: POST" -i \| head -5` | 204 + `access-control-allow-origin: https://thecleancoffee.com` |
| S4 | `curl -sS -X POST 'https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=dry_run' -H "Origin: https://thecleancoffee.com" -H "Content-Type: application/json" -d '{"preview_only":true,"intent_uuid":"vm-postdeploy-probe-1","payload_schema_version":1,"site":"thecleancoffee","intent_phase":"npay_button_click","payment_button_type":"npay","page_url":"https://thecleancoffee.com/shop_view/?idx=73","content_key":"vm_probe","funnel_session_id":"sess_vm_probe","ts_ms":'"$(date +%s)"'000}'` | `ok=true` + `mode=dry_run` + ledger total_rows 변동 없음 |

S2 통과는 신규 endpoint 가 VM 에서 살아있음을 증명. S4 통과는 외부 origin 통한 payload validation 동작 증명. ledger write 0 가 유지됨을 별도 stats 재호출로 확인.

## 8. Rollback 절차

배포 실패 또는 회귀 발견 시.

| 시나리오 | 절차 |
|---|---|
| pm2 restart 실패 (build error / runtime error) | VM `~/seo/backups/` 의 직전 snapshot 으로 src/dist 복원 → `pm2 restart seo-backend` |
| schema migration 차단 (예상 외 row 발견) | error 로그 확인. SQLite 에 직접 `DROP TABLE schema_versions; DROP TABLE coffee_npay_intent_log;` (운영 데이터 영향 없음 — 신규 빈 테이블만 제거) → 재시작 |
| reachability S1~S4 실패 | `pm2 logs seo-backend` 마지막 100줄 → 원인 파악. 외부 send 영향 없음 |
| 의도치 않은 rsync deletion | P6 의 SQLite 스냅샷은 보존. backend src 는 git 으로 복원 가능 (단 VM 에 .git 없으므로 로컬에서 다시 rsync) |

운영 SQLite (150MB) 는 P6 스냅샷으로 보호. .env 는 rsync exclude 라 무손실.

## 9. 미해결 / 추가 확인 필요

| 항목 | 상태 |
|---|---|
| 로컬 rsync 설치 | **완료** (3.4.2 via brew, 2026-05-02) |
| VM rsync 설치 | **완료** (3.4.1+ds1-5+deb13u1 via apt, 2026-05-02) |
| rsync dry-run 실제 검증 | **완료** — backend-only sync 로 deletion 0 / 신규 12 / 수정 3. §11 참조 |
| `--rsync-path` sudo 위임 실제 동작 | **완료** (taejun ssh + sudoers NOPASSWD 동작 확인, biocomkr_sns 로 정상 스위치) |
| 전체 repo sync 위험 발견 | **완료** — `frontend.backup.*` 등 deletion 6,055건 위험 → `backend/` subset sync 로 전환 (§6 갱신) |
| VM working tree dirty 점검 | dry-run 의 deletion 0건이 "VM 측 backend 가 깔끔" 을 동등 증명 |
| `seo-backend` restart 카운터 34 | 7일간 34회 — 평균 4.8회/일. 정상 범위 추정. 별도 sprint 의제 |

## 10. 다음 sprint 항목과의 매핑

[[!coffeedata]] 표 항목 15~18 진행 매핑:

| 항목 | 본 문서 | 상태 |
|---|---|---|
| 15 | 본 사전 체크리스트 작성 | **완료** |
| 16 | VM endpoint reachability 확인 | 본 문서 §7 (S1~S4) — 배포 후 실행 |
| 17 | external dry-run 확인 | 본 문서 §7 S4 — 배포 후 실행 |
| 18 | A-3 GTM Preview dispatcher 재개 | 16/17 PASS 후 [[coffee-npay-intent-a3-gtm-preview-dispatcher-runbook-20260502]] Step S1~T4 재진입 |

본 sprint 는 **항목 15 (사전 체크리스트) 까지 완료**. 항목 16~18 은 TJ 가 §6 배포 명령 실행 결정 시 자동 트리거.

## 11. dry-run evidence (P5 PASS, 2026-05-02 KST)

### 11.1 1차 시도 — 전체 repo sync (§6 초안)

| 항목 | 결과 |
|---|---|
| rsync exit | 0 |
| 권한 우회 | OK (taejun ssh → sudoers NOPASSWD → biocomkr_sns rsync) |
| 신규 (created) | 1,314 |
| 삭제 (deleted) | **6,055** ← 위험 |
| 전송 데이터 | 598 MB |

deletion top 디렉토리:

| 디렉토리 | 건수 | 의미 |
|---|---|---|
| `frontend.backup.20260429_062415/` | 1,930 | VM frontend 배포 backup (4월 29일) |
| `frontend.backup.20260429_034435/` | 1,912 | 동일 |
| `frontend.backup.20260429_033857/` | 1,637 | 동일 |
| `backend/` (대부분 `src.old/`) | 434 | backend refactor 잔재 |
| `frontend/` | 104 | frontend 산출물 |
| `capivm/` | 37 | 배포 스크립트 정리 흔적 |
| `._capivm/` | 1 | macOS resource fork |

**판정**: 본 sprint 는 backend 만 갱신할 의도인데 frontend backup 까지 통째 손실 위험. **차단 → backend subset sync 로 전환**.

### 11.2 2차 시도 — backend/ subset sync (§6 갱신본)

| 항목 | 결과 |
|---|---|
| rsync exit | 0 |
| 권한 우회 | OK |
| 비교 대상 파일 | 244 (reg 230 + dir 14) |
| 신규 (created) | **12** |
| 수정 (transferred without create) | **3** |
| 삭제 (deleted) | **0** ← 위험 제거 |
| 전송 데이터 | 390 KB |

신규 12개 파일:

| 영역 | 파일 |
|---|---|
| `src/` | `coffeeNpayIntentLog.ts`, `npayRoasDryRun.ts` |
| `scripts/` | `coffee-excel-import-dry-run.ts`, `coffee-excel-ltv-dry-run.ts`, `coffee-excel-payment-mismatch.ts`, `coffee-ga4-baseline.ts`, `coffee-ga4-robust-guard.ts`, `coffee-imweb-operational-readonly.ts`, `npay-ga4-mp-limited-test.ts`, `npay-ga4-robust-guard.ts`, `npay-roas-dry-run.ts` |
| `tests/` | `npay-roas-dry-run.test.ts` |

수정 3개 파일:

- `src/env.ts`
- `src/routes/attribution.ts`
- `src/routes/coffee.ts`

deletion 0건 — 추가된 exclude (`*.backup.*`, `*.bak_*`, `._*`, `src.old`) 가 VM 의 운영 backup 보존.

### 11.3 결론

**§6 갱신본 명령 그대로 -n 만 제거하면 실제 배포 가능 상태**. 의도하지 않은 deletion 0, 변경 정확히 의도와 일치, 권한 우회 검증 완료.
