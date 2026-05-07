# minimal `paid_click_intent` ledger write canary — Phase 0~2 T+0 결과

작성 시각: 2026-05-07 23:05 KST
대상: 운영 VM `seo-backend` `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
승인 근거: TJ "YES: minimal paid_click_intent ledger write canary execution packet 승인" (2026-05-07 22:35 KST 채팅 회신)
관련 문서: [[paid-click-intent-minimal-ledger-canary-execution-packet-20260507]] (실행 패킷), [[paid-click-intent-minimal-ledger-schema-contract-20260507]] (필드/dedupe 계약), [[backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] (4 blocker PASS)
Status: **Phase 0 / Phase 1 / Phase 2 T+0 모두 PASS**. 1h canary 진행 중 (T+15min/T+30min/T+45min/T+60min monitoring 예정)
Do not use for: confirmed_purchase 실제 send, GA4/Meta/Google Ads/TikTok/Naver 전송, conversion upload, conversion action 변경, 광고 변경, 무기한 ledger write 연장

```yaml
harness_preflight:
  lane: Yellow approved canary execution
  allowed_actions_executed:
    - 운영 VM SSH (taejun -> sudo -u biocomkr_sns)
    - dist + crm.sqlite3 백업
    - paidClickIntentLog.js + dist/routes/attribution.js scp 후 sha256 3-way 일치
    - bootstrap 추가 후 재배포
    - PAID_CLICK_INTENT_WRITE_ENABLED=false 배포 (Phase 0)
    - flag-off smoke (Phase 1) — table 생성, row_count=0, oversized 413 유지
    - PAID_CLICK_INTENT_WRITE_ENABLED=true PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1 배포 (Phase 2)
    - flag-on smoke 7종
    - ledger row 2 insert + dedupe 1 회
  forbidden_actions_kept:
    - GA4/Meta/Google Ads/TikTok/Naver 전송 0건
    - conversion upload 0건
    - confirmed_purchase 실제 send 0건
    - 운영 PG/AIBIO Supabase write 없음 (운영 sqlite만 minimal write)
    - PII / order / payment / value / currency 저장 없음
  source_window_freshness_confidence:
    source: "운영 VM SSH 직접 deploy + smoke + sqlite read"
    window: "2026-05-07 22:40 KST Phase 0 deploy ~ 2026-05-07 23:02 KST Phase 2 T+0 smoke"
    freshness: "T+3min after Phase 2 flag on"
    confidence: 0.94
```

## 5줄 결론

1. canary execution packet §6 절차에 따라 Phase 0 (deploy) → Phase 1 (flag-off final smoke) → Phase 2 (flag-on T+0 smoke) 모두 PASS.
2. 신규 table `paid_click_intent_ledger` 생성, 5개 index 등록. flag false 상태에서 row_count=0 baseline 확인.
3. flag true 후 7종 smoke: TEST id 차단 (would_store=false), live gclid 2건 insert (different capture_stage), 같은 live gclid 1회 dedupe (duplicate_count=1), PII 400 reject, order_number 400 reject, oversized 120KB 413, capture_stage 분리 정상.
4. 모든 응답에서 `would_send=false`, `no_platform_send_verified=true` 유지. 외부 플랫폼 전송 0건.
5. 1h canary 진행 중 (T+0 시점 row_count=2, duplicate_count_total=1). T+15min/30min/45min/60min monitoring 예정.

## 1. 변경 요약

### 신규 파일

| 파일 | 역할 |
|---|---|
| `backend/src/paidClickIntentLog.ts` | `recordPaidClickIntent`, `bootstrapPaidClickIntentTable`, `isPaidClickIntentWriteEnabled`, `getPaidClickIntentWriteSampleRate`, `getPaidClickIntentSummary`, `listPaidClickIntents` export. lazy schema bootstrap (CREATE TABLE IF NOT EXISTS + 5 indexes). PII allowlist guard. dedupe via UNIQUE INDEX. 90일 retention TTL. |

### 변경 파일

| 파일 | 변경 |
|---|---|
| `backend/src/routes/attribution.ts` | import 추가 (`bootstrap*`/`isWriteEnabled`/`getSampleRate`/`recordPaidClickIntent`). `createAttributionRouter()` 진입 시 `bootstrapPaidClickIntentTable()` 호출 (try/catch). `/api/attribution/paid-click-intent/no-send` 핸들러에 flag 분기 추가 — flag true + `live_candidate_after_approval=true` + sample rate 통과 시 `recordPaidClickIntent()` 호출, 응답에 `ledger`/`source.mode=minimal_ledger_canary_write`/`source.write_flag_on`/`would_store=true` 반영. flag false면 기존 no-write 응답 그대로. |

### 신규 env 변수 (운영 PM2 env)

```text
PAID_CLICK_INTENT_WRITE_ENABLED=false  # Phase 0 → true at Phase 2
PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1  # 1=전체 캡처
PAID_CLICK_INTENT_RETENTION_DAYS=90    # 기본값
```

## 2. Phase 0 — 운영 deploy (flag off)

### Backup

| 파일 | sha256 |
|---|---|
| `attribution.js.before` | (256 bytes hash 생략) |
| `crm.sqlite3.before` (242 MB) | (생략) |
| 위치 | `/home/biocomkr_sns/seo/shared/deploy-backups/20260507-2240_paid_click_intent_minimal_ledger_canary/` |

### Deploy 절차 (sha256 3-way 일치)

```text
local sha256 4a85e0bf6a7c52835a857f5687611c69d7f3135858f5836ee0e4332587f5fdb4  paidClickIntentLog.js
local sha256 96c64edbfc407111e589c879b7a836ace0d3748525dfdc01f81c456c3446f06a  attribution.js
transit /tmp on VM = same
remote dist/ on VM = same
```

PM2 restart with `PAID_CLICK_INTENT_WRITE_ENABLED=false --max-memory-restart 1500M --update-env`. pid 438912, restart count 3822, max_memory_restart 1.5G 유지.

## 3. Phase 1 — flag off final smoke

| smoke | expected | actual |
|---|---|---|
| `GET /health` | 200 | 200 (`status: ok`) |
| `POST /api/attribution/paid-click-intent/no-send` (live gclid, flag off) | `would_store=false`, `mode=no_write_no_send_preview`, `ledger=null` | 정확히 일치 |
| `POST .../no-send` oversized 120KB | 413 (`entity.too.large`) | 일치 (errorHandler hardening 유지) |
| 운영 sqlite `paid_click_intent_ledger` table 존재 | YES (bootstrap call) | YES |
| `paid_click_intent_ledger` indexes | 5 (UNIQUE dedupe + click_hash + session + expires + status) | 5 일치 |
| Initial row_count | 0 | 0 |

## 4. Phase 2 — flag ON canary T+0 smoke

PM2 restart with `PAID_CLICK_INTENT_WRITE_ENABLED=true PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1 --max-memory-restart 1500M --update-env`. pid 439031, restart count 3823.

### 7개 smoke 결과

| # | smoke | request 핵심 | response 핵심 | 결과 |
|---:|---|---|---|---|
| 1 | TEST_ click id | gclid `TEST_canary_001` | `would_store=false`, `live_candidate_after_approval=false`, `ledger=null` | **PASS** (TEST id가 ledger에 들어가지 않음) |
| 2 | live gclid 1st | gclid `AW.canary.live.001` (landing) | `would_store=true`, `mode=minimal_ledger_canary_write`, `ledger.stored=true`, `deduped=false`, `would_send=false`, `no_platform_send_verified=true` | **PASS** (1st insert 정상) |
| 3 | 동일 live gclid 재요청 | 동일 dedupe_key | `ledger.stored=true`, `deduped=true` | **PASS** (UNIQUE INDEX 작동, duplicate_count++) |
| 4 | PII (`email: x@x.com`) | 모든 PII 입력 | 400, `rejectedField=email`, ledger row 미생성 | **PASS** (upstream PII guard) |
| 5 | `order_number: ORDER123` | order field | 400, `rejectedField=order_number` | **PASS** (forbidden field guard) |
| 6 | oversized 120KB | body 120KB | 413, `entity.too.large` | **PASS** (errorHandler hardening 그대로) |
| 7 | 다른 live gclid + capture_stage=checkout_start | gclid `AW.canary.live.002` + UTM 포함 | `ledger.stored=true`, `deduped=false`, `capture_stage=checkout_start` | **PASS** (2nd unique row, capture_stage 분리) |

### Ledger 직접 read (운영 sqlite SSH read-only)

```text
row_count: 2
total_duplicate_count: 1
rows:
  - click_id_value=AW.canary.live.002, capture_stage=checkout_start, duplicate_count=0, status=received
  - click_id_value=AW.canary.live.001, capture_stage=landing, duplicate_count=1, status=received
```

dedupe ratio: 1/3 attempts = 33.3% (duplicate 1회, unique 2건). 정상 범위.

## 5. canary 모니터링 임계 (T+0 baseline)

| 임계 | 값 | 상태 |
|---|---:|---|
| 5xx 비율 | 0% (smoke 7건 + 직전 errorHandler hardening evidence) | PASS |
| PM2 restart count (deploy 직후) | 3823 (Phase 0 1회 + 재배포 1회 + Phase 2 1회 = 직전 deploy 후 3회 restart) | 진행 중 (Phase 2 시작 후 추가 restart 필요 < 5/24h) |
| backend mem | 207.8 MB at 3s uptime, 1.5G threshold의 13.8% | PASS |
| heap usage | 측정 예정 (T+15min에 추가) | - |
| event loop p95 | 측정 예정 | - |
| `no_platform_send_verified` | 100% (smoke 7/7) | PASS |
| PII reject 정상 | 2/2 (smoke 4, 5) | PASS |
| dedupe 동작 | 1/3 (smoke 3) | PASS |
| TEST id 차단 | 1/1 (smoke 1) | PASS |
| capture_stage 분리 | 2 stage (landing + checkout_start) | PASS |

## 6. 본 agent 자동 진행 (시간 의존, TJ 컨펌 NO)

| 시점 | 작업 |
|---|---|
| 2026-05-07 23:18 KST (T+15min) | row count, dedupe ratio, mem, restart count, 5xx 비율 측정 |
| 2026-05-07 23:33 KST (T+30min) | 동일 |
| 2026-05-07 23:48 KST (T+45min) | 동일 |
| 2026-05-08 00:03 KST (T+60min) | 1h 종합 판정. PASS면 Phase 3 (24h 연장), WARN/FAIL이면 Phase 5 rollback |
| 2026-05-08 23:03 KST (T+24h) | 24h 누적 보고 |

각 시점에서 임계 초과 시 즉시 보고 + flag false rollback.

## 7. rollback 절차 (필요 시)

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  PAID_CLICK_INTENT_WRITE_ENABLED=false pm2 restart seo-backend --max-memory-restart 1500M --update-env
  pm2 save
'
```

PM2 restart 즉시 신규 write 중단. 기존 row는 90일 TTL로 자동 만료. 긴급 cleanup 필요 시 `UPDATE paid_click_intent_ledger SET status='rejected', click_id_value='' WHERE created_at >= 'incident_start'`.

## 8. 자신감 / 잔여 리스크

| 항목 | 자신감 | 리스크 |
|---|---:|---|
| Phase 0~2 T+0 통과 | 95% | 7 smoke 모두 PASS, ledger 동작 확인 |
| 1h canary 안정성 | 80% | 자연 traffic 0.5건/h 페이스라 추가 evidence 적을 수 있음 |
| 메모리 누수 부재 | 75% | T+15~T+60min 추세 봐야 |
| 외부 전송 0건 유지 | 99% | response field 명시적 검증 |
| **종합** | **88%** | - |

## 9. 다음 자동 보고

T+15min~T+60min 측정 완료 시 본 agent가 자동으로 단일 보고서로 합쳐 commit + push 합니다. 임계 초과 시에만 즉시 알람성 보고.

## 한 줄 결론

> Phase 0~2 T+0 PASS. flag ON 정상 동작 (TEST 차단, live insert, dedupe, PII reject, oversized 413, no_platform_send_verified 100%). 1h canary 진행 중. T+15~T+60min 본 agent 자동 monitoring → 종합 판정 후 24h 연장 또는 rollback.
