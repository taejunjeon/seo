# minimal `paid_click_intent` ledger write — canary 실행 패킷

작성 시각: 2026-05-07 22:35 KST
대상: 운영 VM `seo-backend` `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` (better-sqlite3 WAL)
문서 성격: 한 장 통합 실행 패킷. TJ 승인 문구 한 줄 회신만 받으면 본 agent가 즉시 실행
관련 문서: [[paid-click-intent-minimal-ledger-write-approval-20260507]] (승인 본문), [[paid-click-intent-minimal-ledger-schema-contract-20260507]] (필드/dedupe/retention 계약), [[backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] (4 blocker PASS evidence)
Status: needs_human_approval (canary 조건부 승인 — 본 agent 자율 실행 권한 없는 마지막 게이트)
Do not use for: Google Ads conversion upload, Google Ads conversion action 변경/생성, GA4/Meta/Google Ads/TikTok/Naver 실제 전송, confirmed_purchase dispatcher 운영 전송, raw payload 저장, PII 저장, order/payment/value/currency 저장, 광고 예산/캠페인 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - vm/!vm.md
    - total/!total-current.md
    - gdn/!gdnplan.md
    - gdn/paid-click-intent-minimal-ledger-write-approval-20260507.md
    - gdn/paid-click-intent-minimal-ledger-schema-contract-20260507.md
    - gdn/backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507.md
  lane: Yellow approved canary write / Green approval packet 작성
  allowed_actions_now:
    - 본 패킷 자체 작성
    - 로컬 schema migration 작성 (apply 안 함)
    - backend code (paidClickIntentLog.ts) 작성 (deploy 안 함)
    - typecheck/local smoke (sqlite test fixture)
  allowed_actions_after_approval:
    - 운영 backend deploy: 신규 table migration + paidClickIntentLog.ts + attribution.ts 변경 (flag off)
    - flag off final smoke
    - canary 1h: PAID_CLICK_INTENT_WRITE_ENABLED=true
    - 1h smoke PASS 확인 후 24h 연장
    - 24h smoke PASS 확인 후 minimal write 정식 운영 status 보고
    - 실패 시 즉시 flag off + 신규 row TTL 처리
  forbidden_actions_until_explicit_separate_approval:
    - GA4/Meta/Google Ads/TikTok/Naver 실제 purchase 전송
    - Google Ads conversion action 생성/변경
    - conversion upload
    - Google Ads `구매완료` Primary 변경
    - confirmed_purchase no-send → 실제 send 전환
    - raw request body 저장
    - PII (email/phone/name/address) 저장
    - order_number / payment_key / value / currency 저장
    - 광고 예산/캠페인 변경
    - 무기한 운영 ledger write (canary 24h 후 재승인 없이 무한 연장 금지)
  source_window_freshness_confidence:
    source: "운영 VM SSH 직접 점검 + backend 코드 + schema contract + deploy result T+23min evidence"
    window: "2026-05-07 22:01~22:35 KST"
    freshness: "T+34min"
    confidence: 0.92
```

## 5줄 결론

1. **4 선행 blocker 모두 PASS 확정** (T+23min evidence). minimal ledger write 진입 가능 status.
2. 본 패킷은 무기한 풀오픈이 아니라 **feature flag + 1h → 24h canary + 즉시 rollback** 조건의 제한적 승인을 위해 작성됨.
3. 저장은 운영 VM `crm.sqlite3` 신규 table `paid_click_intent_ledger`. 저장 필드는 click id / UTM / landing_path / referrer_host / client_id·session_id / hash 계열만. raw body·PII·order·payment 저장 금지.
4. flag 기본값 OFF 배포 → final smoke → 1h flag ON → smoke → 24h 연장 → 종료 시 재승인 없이 무한 연장 금지.
5. 본 agent는 TJ 한 줄 회신 (§9 승인 문구) 받으면 즉시 §6 절차 시작. 실패 또는 임계 초과 시 flag 즉시 off + canary row TTL 처리.

## 1. 저장 필드 (8필드 - field allowlist)

[[paid-click-intent-minimal-ledger-schema-contract-20260507|schema contract]] 정본을 그대로 사용. 핵심:

| 필드 | 저장? | 비고 |
|---|---|---|
| `intent_id` (UUID) | YES | row primary key |
| `site` | YES | `biocom`만 |
| `captured_at` / `received_at` | YES | 시각 두 종 (브라우저/서버) |
| `platform_hint` | YES | `google_ads` 우선 |
| `capture_stage` | YES | `landing` / `checkout_start` / `npay_intent` |
| `click_id_type` | YES | `gclid` / `gbraid` / `wbraid` |
| `click_id_value` | YES | Google Ads matching용 원문, 90일 TTL |
| `click_id_hash` | YES | 검색·dedupe·통계용 |
| `utm_source/medium/campaign/term/content` | YES | UTM allowlist |
| `landing_path` | YES | query 제거 path만 |
| `allowed_query_json` | YES | UTM/click id allowlist만 (raw query 금지) |
| `referrer_host` | YES | full URL 금지, host만 |
| `client_id` / `ga_session_id` / `local_session_id` | YES | join용 |
| `user_agent_hash` / `ip_hash` | YES | bot/dedupe 보조, raw 금지 |
| `dedupe_key` | YES | UNIQUE INDEX |
| `status` | YES | received / matched_to_checkout / matched_to_payment_complete_candidate / expired / rejected |
| `expires_at` | YES | retention enforcement |

## 2. 저장 금지 (forbidden allowlist)

| 필드 | 금지 이유 |
|---|---|
| raw request body | 무관 데이터/PII 누출 위험 |
| raw full URL query | session token / 기타 식별자 누출 위험 |
| raw referrer URL | 동일 |
| email / phone / name / address | PII |
| order_number / channel_order_no | confirmed_purchase는 별 단계에서만 |
| payment_key / paid_at / value / currency | 결제 정보 분리 원칙 |
| 카드 / 계좌 / token / cookie | 보안 정보 |
| 건강 상태 / 질병 추정값 | 민감정보 |

## 3. DB / table / migration

| 항목 | 값 |
|---|---|
| 운영 DB | `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` (better-sqlite3 WAL, 242 MB) |
| 신규 table | `paid_click_intent_ledger` (DDL은 schema contract §"테이블 초안" 그대로) |
| migration runner | 기존 `schema_versions` table 패턴 따름 (`coffee_npay_intent_log`/`npay_intent_log` 패턴 참고) |
| 운영 PG (tb_iamweb_users 등) write | 절대 금지 (read-only 정본) |
| AIBIO Supabase write | 해당 없음 |

backend code 변경 (운영 deploy 1회 — 직전 errorHandler hardening 패턴과 동일):

| 변경 종류 | 위치 | 내용 |
|---|---|---|
| 신규 file | `backend/src/paidClickIntentLog.ts` | `recordPaidClickIntent(row, deps): {row, deduped}`. better-sqlite3 prepared statement |
| 신규 migration | `backend/src/migrations/` (또는 `crmLocalDb` schema bootstrap 위치) | DDL + UNIQUE INDEX + status/expires_at index |
| 변경 file | `backend/src/routes/attribution.ts` | `/api/attribution/paid-click-intent/no-send` 핸들러에 flag 분기. flag false면 기존 no-send 응답 그대로, true면 sanitize → hash → dedupe → insert → response 반환 (`would_send=false` 유지) |
| env 변수 | VM `.env` | `PAID_CLICK_INTENT_WRITE_ENABLED`, `PAID_CLICK_INTENT_WRITE_SAMPLE_RATE`, `PAID_CLICK_INTENT_RAW_LOGGING_ENABLED` |

본 agent 사전 검증 가능: typecheck PASS, local sqlite migration smoke (`backend/data/crm.sqlite3` 로컬 fixture). 실제 운영 적용은 승인 후만.

## 4. dedupe key

```text
paid_click_intent:{site}:{click_id_type}:{click_id_hash}:{ga_session_id || local_session_id}:{landing_path}:{capture_stage}
```

- 동일 사용자가 새로고침/redirect 반복할 때 row 폭증 방지
- `INSERT OR IGNORE` + 응답에 `deduped: true` 표시
- 통계용 `duplicateCount`는 update (npay_intent_log 패턴 따름)

## 5. feature flag

```text
PAID_CLICK_INTENT_WRITE_ENABLED=false      # 기본값. on/off 단일 스위치
PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1      # 1=전체, 0.1=10% 샘플 등
PAID_CLICK_INTENT_RAW_LOGGING_ENABLED=false  # 디버그 로깅 별도 가드
```

| 동작 | flag false (기본) | flag true (canary) |
|---|---|---|
| receiver POST 응답 | 기존 no-send 응답 그대로 (`would_store=false`) | sanitize/hash/dedupe/insert 후 응답 (`would_store=true`, `would_send=false`) |
| ledger row 생성 | 0 | dedupe 통과 row만 |
| platform send | 0 | 0 (flag와 무관, 항상 0) |
| rollback | flag 그대로 두면 됨 | flag false로 변경 즉시 신규 write 중단 |

flag on/off 명령:

```bash
sudo -u biocomkr_sns bash -lc '
export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
cd /home/biocomkr_sns/seo/repo/backend
# .env 또는 PM2 env 변수로 적용
pm2 restart seo-backend --update-env
'
```

## 6. canary 계획 (1h → 24h)

본 agent가 TJ 승인 후 자동 실행하는 절차.

### Phase 0 — 사전 (TJ 승인 직후, 약 30분)

- [ ] 백업 디렉터리 생성 (`/shared/deploy-backups/{TIMESTAMP}_paid_click_intent_minimal_ledger_canary/`)
- [ ] 운영 `crm.sqlite3` 백업 (`.bak_pre_paid_click_intent_canary`)
- [ ] 로컬 typecheck + sqlite migration smoke
- [ ] backend build (errorHandler hardening 직전 deploy 동일 절차)
- [ ] scp 변경 파일 (paidClickIntentLog.js + dist/routes/attribution.js + dist/migrations/...)
- [ ] sha256 3-way 검증
- [ ] migration apply (운영 sqlite에 신규 table 추가, dry-run 후 실행)
- [ ] flag 기본값 false 보장
- [ ] PM2 restart `--update-env`

### Phase 1 — flag off final smoke (10분)

- [ ] `/health` 200
- [ ] positive_test_gclid POST → 400 (기존 no-write 응답)
- [ ] oversized 120KB → 413 (errorHandler hardening 유지)
- [ ] 새 table row count 0 (write 안 일어남)
- [ ] PM2 restart count 변화 없음
- [ ] mem 안정

### Phase 2 — flag ON canary 1h

- [ ] env: `PAID_CLICK_INTENT_WRITE_ENABLED=true`
- [ ] PM2 restart `--update-env`
- [ ] 즉시 (T+0) — receiver smoke 7종 (positive + 6 reject) → flag true 응답에 `would_store=true`
- [ ] T+15min — row count, dedupe ratio, 5xx, mem, restart count
- [ ] T+30min — 동일
- [ ] T+45min — 동일
- [ ] T+1h — Phase 2 종합 판정 (PASS/WARN/FAIL)

### Phase 3 — 24h 연장 또는 중단

- Phase 2 PASS → flag 유지 24h
- Phase 2 WARN → 보고 후 TJ 결정
- Phase 2 FAIL → 즉시 flag off (Phase 5)

### Phase 4 — 24h 종합 판정 + 보고

- [ ] 24h 누적 row count, dedupe ratio, 시간대별 분포
- [ ] PM2 restart count 24h 변화
- [ ] heap / mem 추세
- [ ] checkout / NPay flow 이상 evidence
- [ ] PII reject log
- [ ] no_platform_send 0건 검증
- [ ] 본 패킷 success criteria (§7) 전부 PASS 시: 정식 운영 status 승인 후보 보고
- [ ] 일부 FAIL 시: 원인 분리 + 추가 조치 후 재승인 보고

### Phase 5 — rollback (모든 단계에서 즉시 가능)

- `PAID_CLICK_INTENT_WRITE_ENABLED=false` + PM2 restart
- 신규 insert 중단 즉시 효과
- canary 기간 row 처리: TTL 설정대로 90일 후 자동 만료 (또는 incident 발생 시 본 agent가 `created_at >= incident_start` row의 status를 `rejected` / `expired`로 update + click_id_value null/empty 처리)
- TEST/DEBUG/PREVIEW row는 별도로 7일 TTL

## 7. 모니터링 기준 (정량 임계값)

| 지표 | 임계 | 측정 방법 |
|---|---|---|
| 5xx 비율 | < 1% | bounded probe (5초 간격 × 5분) + cloudflared error log |
| PM2 restart count | < 5회 / 24h | `pm2 list` + pm2.log grep |
| heap usage at 1m uptime | < 70% (1.5G 기준 약 1050 MB 미만) | pm2 describe Code Metrics |
| backend mem RSS | < 800 MB peak | `ps aux --sort=-rss` |
| dedupe ratio | > 0% (정상 0~30%) | row count vs request count |
| PII reject 카운트 | 0 (또는 정상 expected reject만) | log grep |
| no_platform_send_verified | 100% | response field 검증 |
| checkout/NPay flow regression | 0건 | imweb_orders growth rate / npay_intent_log growth rate 비교 |
| event loop p95 latency | < 200ms | pm2 describe |

각 phase에서 위 임계 1개라도 초과 시:
- Phase 1 → deploy rollback
- Phase 2/3 → flag false (Phase 5)
- 추가 분석 후 재승인 prompts

## 8. 실제 전송 금지 검증

| 항목 | 본 패킷 영향 |
|---|---|
| GA4 Measurement Protocol send | 변경 없음 (0건 유지) |
| Meta CAPI Purchase send | 변경 없음 (0건 유지) |
| Google Ads conversion upload | 변경 없음 (0건 유지) |
| Google Ads conversion action 생성/변경 | 변경 없음 |
| TikTok Events API send | 변경 없음 |
| Naver NPay send | 변경 없음 |
| confirmed_purchase dispatcher 운영 전송 | 변경 없음 (no-send 유지) |
| GTM publish | 변경 없음 (live version 142 그대로) |
| 광고 예산/캠페인 | 변경 없음 |

→ 본 패킷은 **운영 ledger write만**이고, 외부 플랫폼 신호는 0건 그대로 유지.

## 9. 승인 문구 template

TJ님께서 회신할 한 줄.

```text
YES: minimal paid_click_intent ledger write canary execution packet 승인.
```

또는 더 명시적으로:

```text
YES: minimal paid_click_intent ledger write를 canary 조건으로 승인합니다.
범위는 site=biocom의 Google click id 보존용 최소 ledger write입니다. 저장 필드는
gclid/gbraid/wbraid, UTM, landing_path, referrer_host, client/session id, captured_at
등 schema contract 정본 필드만 사용합니다. raw request body, PII, order/payment/value/
currency는 저장하지 않습니다.

실행은 feature flag로 진행합니다. PAID_CLICK_INTENT_WRITE_ENABLED=false 기본값으로
schema/write path를 배포하고, final smoke 통과 후 1시간 canary를 켭니다. 1시간 PASS
시 24시간 제한 write로 연장하고 결과를 보고합니다.

계속 금지: GA4/Meta/Google Ads/TikTok/Naver 전송, Google Ads conversion action
생성/변경, conversion upload, confirmed_purchase dispatcher 운영 전송, 광고 예산 변경.

성공 기준: 5xx < 1%, PM2 restart < 5회/24h, heap < 70%, PII/value/order field
reject 정상, no platform send 0건, checkout/NPay 흐름 이상 없음. 문제 발생 시 write
flag 즉시 off, 신규 write 중단, canary row TTL 또는 status=rejected 처리.
```

본 agent가 회신 받으면:
1. 본 packet의 §6 Phase 0 시작
2. 각 phase 통과 시 commit + push로 진행상황 기록
3. WARN/FAIL 시 즉시 보고 + flag off
4. 24h 종료 시 정식 운영 status 승인 후보 보고

## 10. 본 agent 한계 / 접근 blocker

| 항목 | 본 agent 자율 가능? | 비고 |
|---|---|---|
| schema migration apply | YES (승인 후) | 운영 sqlite에 ALTER TABLE 적용 |
| backend deploy (3 파일) | YES (승인 후) | errorHandler hardening 절차와 동일 |
| .env 변경 (`PAID_CLICK_INTENT_WRITE_ENABLED`) | YES (승인 후) | PM2 restart `--update-env`로 적용 |
| 운영 ledger write | YES (canary scope 안에서) | 본 패킷 §6 phase 따름 |
| 새 평가 외부 플랫폼 전송 | NO | 별도 Red 승인 |
| confirmed_purchase 실제 전송 | NO | 별도 Red 승인 |

## 11. 한 줄 결론

> 4 선행 blocker 모두 PASS 확인. minimal `paid_click_intent` ledger write를 무기한 풀오픈이 아니라 **feature flag + 1h → 24h canary + 즉시 rollback** 조건의 제한적 운영 write로 진입할 수 있는 단계. TJ 한 줄 회신만 받으면 본 agent가 §6 절차 자율 실행.

Auditor verdict: NEEDS_HUMAN_APPROVAL
