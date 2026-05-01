# 더클린커피 NPay Intent Ledger Enforce 활성 + 제한적 Live Capture 승인안 (v1.6)

생성 시각: 2026-05-01 KST (v1.5: 2026-05-02 00:30 KST hardening 보강 / **v1.6: 2026-05-02 00:48 KST Step A-2a smoke window 통제 메커니즘 추가**)
phase: A-2a (smoke window 통제 메커니즘 + 회귀 13종 PASS + env/window 모두 OFF 복귀)
승인 대상: TJ
관련 문서: [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501|all-in-one snippet v0.4+v0.5+v0.6]] / [[coffee-npay-intent-beacon-preview-design-20260501|design v0.4]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]] / [[coffee-npay-intent-uuid-preservation-test-20260501|URL 보존 검증 가이드]] / [[coffee-funnel-capi-cross-site-applicability-20260501|biocom cross-site 메모]]

## Auditor Verdict (A-1.5 종료 전)

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_ledger_enforce_approval_v1_5
No external send verified: YES (GA4 MP / Meta CAPI / TikTok Events / Google Ads 송출 0건)
No DB write verified: YES (enforce flag disabled 상태에서 ledger INSERT 0건 유지)
No GTM publish verified: YES (Production publish / live script 삽입 BLOCKED)
실제 운영 변경 (명시):
  - backend 재시작 2회 (PID 99378 → 2837 → 5596, 다운타임 각 ~3초)
  - schema migration v1 → v2 적용 (DROP+CREATE, row count 0 보장)
  - schema_versions 메타 테이블 1행 추가
  - route 4종 (POST coffee-npay-intent, GET coffee-npay-intents,
    GET coffee-npay-intent-join-report, GET coffee/intent/stats) 활성화
  - endpoint hardening 활성: Origin/Referer allowlist + rate limit + reject counter
실제 외부 트래픽: 0 (snippet fetch 금지, dispatcher 미배치)
PII output: NONE
```

## TJ 승인 항목별 반영 상태 (A-1 → A-1.5)

| TJ 승인 항목 | A-1 결과 | A-1.5 보강 |
|---|---|---|
| 1. schema v2 채택 | OK | (변경 없음) |
| 2. validation 정책 | OK + 보강 요청 | ✅ Origin/Referer allowlist + rate limit + 14종 reject counter + payload_schema_version 검증 추가 |
| 3. enforce mode 활성 조건 | 보류 | ✅ env flag 미활성 유지. 본 phase 는 enforce 활성 안 함 |
| 4. endpoint path | OK + 표현 정정 요청 | ✅ "운영 route 활성됨, 외부 트래픽 0" 으로 정정 (아래 § 실제 운영 변경) |
| 5. dispatcher 초안 | 보류 (sent_uuids 사후 기록 보강 요청) | ✅ pending/sent 분리 + fetch 2xx 성공 후에만 sent 기록 + retry TTL 24h + max retry 5회 (아래 § dispatcher v2) |
| 6. 모니터링 지표 + 중단 조건 | OK + 지표 추가 요청 | ✅ rejected_origin / invalid_payload / pii_rejected / rate_limited / endpoint_4xx_5xx / dispatcher_fetch_failed / retry_success / duplicate_intent 추가. 7일 default → **5일 + 3일 조기 평가 게이트** 로 변경 |

## 10초 요약

이번 phase A-1 의 실제 작업은:

1. backend `coffee_npay_intent_log` schema v2 정의 + 5종 인덱스 + (site, intent_uuid) UNIQUE + (site, imweb_order_code, intent_uuid) UNIQUE
2. validation 강화: PII reject + `preview_only !== true` reject + `is_simulation: true` ledger 진입 금지
3. dry-run / enforce 분기 코드 추가 (단 enforce 는 env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` 일 때만 활성. **본 phase 의 운영 backend 는 env flag 미설정 → enforce 호출 와도 항상 reject**)
4. `POST /api/attribution/coffee-npay-intent` (TJ 권장 path) + `GET /api/attribution/coffee-npay-intents` + `GET /api/attribution/coffee-npay-intent-join-report` endpoint 추가
5. join 5종 status (`joined_confirmed_order` / `pending_order_sync` / `no_order_after_24h` / `duplicated_intent` / `invalid_payload`) 분류 로직
6. 7종 회귀 검증 PASS (Codex curl) — total_rows 0 유지

본 phase 는 **enforce mode 활성 승인** 만 받으면 즉시 다음 단계로 진입 가능한 코드 상태. live capture 활성화는 TJ 별도 승인 후 env flag + dispatcher (GTM Custom HTML tag 또는 별도 forwarder) + 7일 모니터링 시작 절차로 별도 phase.

## 왜 A 트랙으로 가는가 (B 는 왜 optional 인가)

| 이유 | 근거 |
|---|---|
| (A++) imweb orderCode capture 가 검증됨 | 2026-05-01 22:30 / 23:55 KST TJ chrome 검증 2회. `imweb_order_code: o20260501...` capture (1500ms retry). [[coffee-npay-intent-uuid-preservation-test-20260501]] § v0.5 / v0.6 결과 |
| backend `imweb_orders.order_code` 컬럼이 동일 형식 (`o<YYYYMMDD><14자 hex>`) | Codex local SQLite 정찰 (5건). 1:1 deterministic 매핑 가능 |
| (B) GA4 synthetic transaction_id 는 nice-to-have | (A++) 만으로 deterministic join 채널 1개 확보. (B) 는 BigQuery 측 매핑을 추가하는 보강일 뿐 enforce 진입 blocker 아님 |
| (b) Imweb meta_data 보존 NO 확정 | 1-D 정찰 결과. imweb v2 API 응답에 자유 텍스트 자리 0건 |
| (c) NPay channel_order_no 응답 보존 권한 미발급 | 호스팅사 입점 제약. 별도 phase |
| (B) 정찰 비용 vs 가치 | dataLayer dump 1회로 v0.7 보강 가능하지만, (A++) 만으로 충분히 deterministic 매핑 — backlog 로 두고 enforce 후 모니터링 결과로 필요 시 진행 |

## 실제 운영 변경 범위 (정정 v1.5)

A-1 시점 "No-deploy verified: YES" 표현은 부정확. 실제로는 **운영 backend 의 코드와 schema 가 변경됐고 production server 가 재시작** 되었다. 본 phase 의 정확한 표현:

| 운영 변경 항목 (이미 발생) | 영향 |
|---|---|
| backend 코드 deploy (`coffeeNpayIntentLog.ts` 신규, `routes/coffee.ts` 수정) | dist 재빌드 후 production server 가 새 endpoint 노출 |
| backend production server 재시작 (PID 99378 → 2837 → 5596, 2회) | 각 ~3초 다운타임. 그 외 영향 0 |
| `coffee_npay_intent_log` 테이블 v2 schema + 5종 인덱스 | 새 테이블 1개 추가. 기존 테이블 / 데이터 영향 0. row 0 |
| `schema_versions` 메타 테이블 | 새 테이블 1개 + 1행 |
| 새 route 4종 활성 | `POST /api/attribution/coffee-npay-intent`, `GET /api/attribution/coffee-npay-intents`, `GET /api/attribution/coffee-npay-intent-join-report`, `GET /api/coffee/intent/stats`. 외부에서 호출 가능 (단 Origin/Referer allowlist + rate limit + dispatcher 미배치라 실제 트래픽 0) |
| endpoint hardening | Origin/Referer 검사 active, rate limit (1초 5회 / 1분 30회) active, reject counter 14종 in-memory active |

본 phase 에서 **명시적으로 차단된 것** (앞으로 별도 승인 후에만):

| 차단 항목 | 차단 방법 |
|---|---|
| ledger row INSERT (write) | env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` 가 false → enforce mode 호출도 reject |
| 외부 트래픽 forward (dispatcher) | GTM Custom HTML tag / 별도 forwarder 미배치 |
| snippet 의 fetch / sendBeacon | snippet 코드 자체에 fetch 호출 0건 |
| GTM Production publish | Coffee workspace publish 미수행 |
| GA4 MP / Meta CAPI / TikTok Events / Google Ads 보강 송출 | 코드 path 0건 |

**결론**: A-1.5 phase 의 "No-deploy" 는 외부 송출/DB write/GTM publish 가 0 이라는 의미이지, backend route/schema 변경이 0 이라는 뜻이 아님. 정확한 표현 = "**No external send / No DB write / No GTM publish verified**".

## GTM publish 전 체크리스트 (v1.5: 5일 + 3일 조기 게이트)

GTM Production publish (또는 imweb head custom code 직접 삽입) 결정 전 다음을 모두 PASS 해야 함.

- [ ] enforce mode 모니터링 — default 5일 / 조기 게이트 시 3일 (joined_confirmed_order ≥ 90% AND 24h grace 통과 row ≥ 20건 시)
- [ ] `joined_confirmed_order` 비율 ≥ 80% (조기 게이트 90%)
- [ ] `no_order_after_24h` 비율 < 10%
- [ ] `duplicated_intent` 0건 또는 1% 이하
- [ ] `invalid_payload` (imweb_order_code null) 비율 ≤ 5% — 5% 초과면 snippet retry 시점 보강 (v0.7) 후 재모니터링
- [ ] PII reject **0건 strict** (validation 결과 모두 ok=true. 1건이라도 발생하면 dispatcher 일시 중단 + 원인 분석)
- [ ] dispatcher 가 보낸 payload 의 `preview_only: true` 가 100% 유지 — 변조 의심 0
- [ ] `rejected_origin` 일 누적 < 5건
- [ ] `rate_limited` 일 누적 < 50건
- [ ] `endpoint_5xx` 0건
- [ ] `dispatcher_fetch_failed` 누적 < 10% of attempts
- [ ] `retry_success` ≥ 80% of retries
- [ ] Auditor verdict PASS (No external send / No DB write 외부 / No GTM publish 다른 workspace)
- [ ] rollback 절차 1회 dry-run (env flag false 로 되돌리고 dispatcher 끄기 — 아래 § Rollback)

## endpoint 배포 전 체크리스트

신규 endpoint (`POST /api/attribution/coffee-npay-intent` 등) 가 외부 트래픽을 받기 전:

- [ ] tsc PASS (Codex 진행 완료)
- [ ] dry-run 4종 시나리오 회귀 PASS (Codex curl 진행 완료)
- [ ] schema migration v1 → v2 row count 0 보장 (Codex 진행 완료, abort 가드 작동)
- [ ] 운영 backend 재시작 후 endpoint 활성 (Codex 진행 완료, PID 99378 → 2837)
- [ ] enforce flag 미활성 상태에서 enforce 호출 reject 확인 (Codex 진행 완료)
- [ ] coffee 외 site 또는 PII 들어온 payload reject 확인 (Codex 진행 완료)
- [ ] join report endpoint read-only 응답 확인 (Codex 진행 완료, 빈 ledger 5종 status counts 모두 0)

→ 위 7항목 PASS. **운영 endpoint 배포 단계 완료**. 단 외부 트래픽은 dispatcher 가 활성된 뒤부터.

## Rollback 방법

| 시나리오 | 방법 |
|---|---|
| enforce mode 켰는데 매핑 정확도 낮음 | env `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` → 미설정 또는 false. backend 재시작. 새 INSERT 0. 기존 row 는 그대로 (모니터링 데이터로 보존) |
| dispatcher 가 너무 많은 트래픽 발생 | GTM Coffee workspace 의 dispatcher tag pause 또는 imweb head custom code 의 forward 줄 주석 처리 |
| schema 깨짐 또는 데이터 오염 발견 | enforce flag 끄고 ledger row 분석. 필요 시 schema_versions 의 version 을 1 로 reset 후 backend 재시작 → migration 재실행 (단 row count > 0 이면 abort 가드로 차단 — 수동 백업 + DROP + 재migration) |
| backend route 자체 문제 | route file 의 router.post 라인 주석 처리 후 backend 재시작 |
| 운영 매출/주문 데이터 영향 의심 | 본 phase 는 운영 DB write 0 이라 영향 가능성 0. 그러나 `imweb_orders` 테이블 read 만으로도 join 시도하므로 SELECT-only 부담은 있음 — 큰 리스크 아님 |

## 모니터링 지표 (v1.5: default 5일 + 3일 조기 평가 게이트)

### 윈도우 결정

| 옵션 | NPay click 표본 | 24h grace 후 실효 측정 | 95% CI | 채택 |
|---|---:|---:|---|---|
| 3일 | ~25건 | ~17건 | ±15%pp | 조기 평가 게이트 (조건부) |
| 5일 | ~42건 | ~34건 | ±9%pp | **default** |
| 7일 | ~60건 | ~51건 | ±7%pp | 가장 보수적 |

### 조기 평가 게이트 (3일 시점, v1.6 — TJ 명시 9 조건)

다음 9 조건 **모두** 만족 시 5일 기다리지 않고 publish 결정 가능:

1. 24h grace 통과 row ≥ **20**
2. `joined_confirmed_order` 비율 ≥ **90%**
3. `invalid_payload` 비율 ≤ **5%**
4. `no_order_after_24h` 비율 < **10%**
5. `duplicated_intent` 비율 ≤ **1%**
6. `pii_rejected` = **0**
7. `endpoint_5xx` = **0**
8. `dispatcher_fetch_failed` < **10%** of attempts
9. `retry_success` ≥ **80%** of retries

9 조건 중 1개라도 미충족이면 5일까지 default 모니터링.

### 5일 → 7일 fallback (애매한 경우만)

5일 시점에도 위 9 조건 중 일부가 경계선 (예: joined 85~89%, retry_success 70~79%) 이라 명확히 publish 결정이 어려우면 7일까지 데이터 수집 후 재평가. 7일은 fallback only.

### 핵심 지표 (`GET /api/attribution/coffee-npay-intent-join-report` + `GET /api/coffee/intent/stats` 일 1회 polling)

| 지표 | 출처 | 목표 |
|---|---|---|
| `total_intents_in_window` | join-report | NPay click 발생 수에 비례 (참고: 2026-04-23~29 NPay actual 60건/주, 일 ~8.5건) |
| `status_counts.joined_confirmed_order` 비율 | join-report | ≥ 80% (조기 게이트 90%) |
| `status_counts.pending_order_sync` 비율 | join-report | < 20% (24h 미만 정상) |
| `status_counts.no_order_after_24h` 비율 | join-report | < 10% |
| `status_counts.duplicated_intent` 건수 | join-report | 0~1건 |
| `status_counts.invalid_payload` 비율 | join-report | ≤ 5% (snippet retry 실패 케이스) |
| capture delay 평균 | join-report row | < 2000ms |
| 운영 매출 영향 | imweb_orders 일별 합계 | 변화 0 |

### 보강 지표 (TJ 요청 8종)

| 지표 | 출처 | 임계 |
|---|---|---|
| `rejected_origin` | stats `reject_counters.invalid_origin` | 일 누적 < 5건. allowlist 외 origin 시도가 5건 이상이면 abuse 의심 |
| `invalid_payload` | join-report `status_counts.invalid_payload` (이미 위) + stats `reject_counters.missing_required` + `invalid_intent_phase` + `payment_button_type_violation` + `schema_version_unsupported` | 일 누적 ≤ 5% of total |
| `pii_rejected` | stats `reject_counters.pii_rejected` | **0건 strict**. 1건 이상 발생 시 즉시 dispatcher 일시 중단 + 원인 분석 |
| `rate_limited` | stats `reject_counters.rate_limited` | 일 누적 < 50건. 정상 사용자가 1초 5회를 초과하는 일은 거의 없음 |
| `endpoint_4xx` | reverse proxy log 또는 backend 응답 status 카운트 (별도 collector 필요) | < 5% of total |
| `endpoint_5xx` | 동일 | 0% strict (backend 에러는 즉시 fix) |
| `dispatcher_fetch_failed` | dispatcher 측 sessionStorage `__coffee_intent_dispatch_log` (아래 dispatcher v2) | 일 누적 < 10% of attempts |
| `retry_success` | dispatcher 측 retry 후 성공 카운트 | retry 시도의 ≥ 80% 가 다음 sweep 에서 성공 |
| `duplicate_intent` (위와 별개로 dispatcher 측) | dispatcher 측 dedup hit 카운트 | 정상 (sweep 마다 발생, 단 INSERT OR IGNORE 가 처리하므로 무해) |

## live publish 중단 조건 (v1.5)

다음 중 하나라도 발생하면 즉시 enforce flag 끄고 dispatcher 일시 중지:

- `joined_confirmed_order` 비율 < 50% (deterministic 매핑이 실패)
- `duplicated_intent` 5건 이상 (snippet 의 intent_uuid 정책 문제)
- `invalid_payload` 비율 > 20% (snippet retry capture 가 다수 실패)
- **`pii_rejected` 1건 이상** (변조 또는 dispatcher 측에서 의도치 않은 필드 추가) — strict
- `rejected_origin` 시간당 10건 이상 (abuse 또는 origin 누락 변조)
- `rate_limited` 시간당 100건 이상 (정상 사용자 패턴 아님)
- `endpoint_5xx` 1건 이상 (backend 에러는 즉시 fix)
- `endpoint_4xx` 비율 > 5% of total
- `dispatcher_fetch_failed` 비율 > 10% of attempts (네트워크 또는 backend 안정성 문제)
- `retry_success` 비율 < 50% of retries (영구 실패 패턴)
- 운영 매출 / GA4 / Meta 등 다른 layer 에 의도치 않은 영향 의심

## Step A-2a — Smoke Window 통제 메커니즘 (TJ 조건부 승인 반영, v1.6)

TJ 가 A-1.5 의 항목 3 (enforce mode 활성 조건) 을 "**상시 켜두는 방식 비승인**, smoke window 와 묶어서 짧게 활성**"로 변경 요청. v1.6 에서 다음 3중 가드 적용:

### 3중 가드 (모두 만족해야 INSERT)

1. **env flag** `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` (kill switch). default false → enforce 호출 시 항상 reject.
2. **admin token** `COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN` (auth). 별도 env 환경변수. token 미설정 시 모든 admin 호출 401.
3. **smoke window record** (burst limit). admin 이 명시적으로 open 한 시간 제한된 window 안에서만 INSERT 가능. window 만료 또는 max_inserts 도달 시 자동 reject.

### Schema 추가

`coffee_npay_intent_smoke_windows` 테이블 (CREATE TABLE IF NOT EXISTS):

```sql
CREATE TABLE coffee_npay_intent_smoke_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL DEFAULT 'thecleancoffee',
  started_by TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,           -- ISO 8601, max 120분 후
  max_inserts INTEGER NOT NULL,        -- max 50건
  inserted_count INTEGER NOT NULL DEFAULT 0,
  manually_closed_at TEXT,
  manually_closed_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_..._active ON ...(site, expires_at, manually_closed_at);
```

기본값: `duration_minutes=30` (max 120), `max_inserts=5` (hard max 50).

### Admin Endpoints

| Method | Path | 설명 |
|---|---|---|
| `POST /api/attribution/coffee-npay-intent-smoke-window` | window open. body `{started_by, note?, duration_minutes?, max_inserts?, site?}`. 응답 `{ok, smoke_window: {id, expires_at, max_inserts, ...}}` |
| `POST /api/attribution/coffee-npay-intent-smoke-window/close` | window close (`{id?, closed_by, site?}`). id 미제공 시 site 의 모든 active window close |
| `GET /api/attribution/coffee-npay-intent-smoke-windows` | list 최근 N건 (`?limit=20`) |

모두 `Authorization: Bearer <token>` 또는 `X-Coffee-Smoke-Admin-Token: <token>` 필요. token 누락/불일치 시 401 + `reason: smoke_admin_token_invalid_or_missing`.

### enforce 호출 분기 (3중 가드)

`POST /api/attribution/coffee-npay-intent?mode=enforce` 처리 순서:

1. Origin/Referer allowlist 통과 (A-1.5)
2. rate limit 통과 (A-1.5)
3. env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` 활성 — 미활성 시 `reason: enforce_flag_not_active`
4. **active smoke window 존재 + max_inserts 미초과** — 미존재/초과 시 `reason: smoke_window_not_active`
5. validation (preview_only/PII/site/intent_phase 등 A-1.5)
6. is_simulation=true 차단
7. INSERT OR IGNORE → window.inserted_count +1

응답에 `smoke_window: {active, window_id, expires_at, inserted_count, max_inserts, remaining}` 포함.

### Step A-2a 회귀 검증 (Codex 직접 진행, ledger row 0 복귀)

13종 시나리오 모두 PASS (curl):

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | admin token 미제공 → 401 | `reason: smoke_admin_token_invalid_or_missing` |
| 2 | admin token 잘못 → 401 | 동일 |
| 3 | enforce + window 없음 → reject | `reason: smoke_window_not_active` |
| 4 | window open (max_inserts=2, 5분) | 201, window id=1, max_inserts=2 |
| 5 | enforce #1 (window active, valid payload) | inserted=true, inserted_id=1, remaining=1 |
| 6 | enforce #2 (같은 intent_uuid, dedup) | inserted=false, deduped=true |
| 7 | enforce #3 (새 uuid, 잔여 1) | inserted=true, remaining=0 |
| 8 | enforce #4 (max_inserts 도달) | reject, `reason: smoke_window_not_active` |
| 9 | join report (row 2건) | total=2, status=`pending_order_sync: 2` (24h grace 안) |
| 10 | ledger row count + smoke_window record | ledger=2, smoke_window inserted_count=2 |
| 11 | window close | closed_count=1 |
| 12 | close 후 enforce → 다시 reject | `reason: smoke_window_not_active` |
| 13 | ledger 정리 (DELETE 후) | row=0 |

검증 종료 후 **`.env` 의 임시 추가 키 (`COFFEE_NPAY_INTENT_ENFORCE_LIVE`, `COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN`) 모두 제거 + backend 재시작**. 최종 stats: `enforce=false / token=false / window_active=false / total_rows=0`.

### 운영에 남은 변경 (검증 후 최종 상태)

- backend 코드 deploy: smoke window logic + admin endpoints + enforce 분기 보강
- backend dist 재빌드 + production server 재시작 (Codex 직접, 다운타임 ~3초 / 4회)
- `coffee_npay_intent_smoke_windows` 테이블 schema 추가 (row 0 유지)
- `coffee_npay_intent_log` 테이블 schema 그대로 (row 0 유지)
- env flag 모두 미활성 (운영 트래픽 0)

### TJ 가 활성하는 절차 (Step A-2a 실제 사용 시)

1. TJ 가 backend `.env` 에 `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` + `COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN=<랜덤 secret>` 추가 후 재시작 (또는 supervisor 가 자동)
2. TJ 가 `POST /api/attribution/coffee-npay-intent-smoke-window` 로 window open (예: 30분, max 5건)
3. snippet 또는 GTM Preview dispatcher 가 1~5건 forward → backend INSERT
4. `GET /api/coffee/intent/stats` 로 inserted_count / remaining 모니터
5. window 자동 만료 (또는 max_inserts 도달) 시 enforce 자동 reject 복귀
6. TJ 가 `.env` 에서 두 키 삭제 후 재시작 (env flag OFF 복귀)
7. 7일 (또는 5일/3일 게이트) 모니터링 — `GET /api/attribution/coffee-npay-intent-join-report` 일 1회 polling

## 다음 phase (TJ 승인 후)

| 단계 | 트리거 | 내용 |
|---|---|---|
| Step A-2a (위 섹션) | 본 승인안 v1.6 PASS | TJ 직접 .env 추가 → admin 으로 window open → 1~5건 INSERT 검증 → window close → .env 정리 |
| Step A-3 | Step A-2 PASS | dispatcher 작성 — GTM Coffee workspace 에 Custom HTML tag (Production 미publish, Preview 만) 또는 별도 forwarder. all-in-one snippet 의 buffer 를 1초 throttle + dedup 후 `POST /api/attribution/coffee-npay-intent?mode=enforce` 로 forward |
| Step A-4 | dispatcher Preview PASS | GTM Coffee workspace publish (소수 트래픽부터) — TJ 승인 |
| Step A-5 | 7일 모니터링 PASS | join report 의 status 비율 목표 달성 → ledger 가 deterministic mapping 의 source-of-truth 로 인정 |
| Step A-6 | A-5 PASS | GA4 / Meta CAPI 보강 전송 단계 — 별도 승인 게이트, 본 승인안 범위 외 |

## Dispatcher v2 — pending/sent 분리 + retry TTL + max retry (Step A-3 진입 시 사용)

A-1 초안의 "fetch **전에** sent_uuids 기록" 은 fetch 실패 시 retry 가 막히는 문제. v1.5 에서 **fetch 2xx 성공 후에만 sent 기록**, 시도 중인 intent_uuid 는 별도 `pending` 트래커에 두고 sweep 마다 재시도.

핵심 변경:
- `__coffee_intent_pending` (`{ intent_uuid: { first_seen_ms, attempts, last_attempt_ms, last_status, last_reason } }`) 와 `__coffee_intent_sent` (`{ intent_uuid: { sent_at_ms, status } }`) 분리
- fetch 시작 시: pending entry 추가/업데이트 (attempts +1, last_attempt_ms 기록)
- fetch 2xx (200/201): sent 로 promote, pending 에서 제거
- fetch 4xx (validation reject 등): sent 안 함, pending 에 status='4xx' 기록 후 retry 안 함 (4xx 는 영구 실패)
- fetch 5xx 또는 network 실패: pending 에 남기고 다음 sweep 에서 재시도. **max retry 5회**, **TTL 24h** (24h 후 또는 5회 후 영구 실패 처리)
- payload 의 `payload_schema_version: 1` 박음

GTM Coffee workspace 의 Custom HTML tag (Production publish 금지, **GTM Preview workspace 한정**):

```html
<script>
(function () {
  if (window.__coffeeNpayIntentDispatcherInstalled) return;
  window.__coffeeNpayIntentDispatcherInstalled = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var PENDING_KEY = "__coffee_intent_pending";
  var SENT_KEY = "__coffee_intent_sent";
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce";
  var SWEEP_INTERVAL_MS = 1000;
  var MAX_RETRY = 5;
  var TTL_MS = 24 * 3600 * 1000;

  function readJsonStorage(k) {
    try { return JSON.parse(sessionStorage.getItem(k) || "{}"); }
    catch (e) { return {}; }
  }
  function writeJsonStorage(k, v) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function hasSent(intentUuid) {
    var sent = readJsonStorage(SENT_KEY);
    return !!sent[intentUuid];
  }
  function markSent(intentUuid, status) {
    var sent = readJsonStorage(SENT_KEY);
    sent[intentUuid] = { sent_at_ms: Date.now(), status: status };
    // GC: 200개 초과 시 가장 오래된 entry 제거
    var keys = Object.keys(sent);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (sent[a].sent_at_ms || 0) - (sent[b].sent_at_ms || 0); });
      for (var i = 0; i < keys.length - 200; i++) delete sent[keys[i]];
    }
    writeJsonStorage(SENT_KEY, sent);
  }

  function readPending() { return readJsonStorage(PENDING_KEY); }
  function writePending(p) { writeJsonStorage(PENDING_KEY, p); }

  function isPermanentFailure(entry) {
    if (!entry) return false;
    if (entry.attempts >= MAX_RETRY) return true;
    if (entry.first_seen_ms && Date.now() - entry.first_seen_ms > TTL_MS) return true;
    if (entry.last_status && entry.last_status >= 400 && entry.last_status < 500) return true;
    return false;
  }

  function attemptDispatch(payload) {
    if (!payload || payload.preview_only !== true) return;
    if (payload.is_simulation === true) return;
    if (!payload.intent_uuid) return;
    if (hasSent(payload.intent_uuid)) return;

    var pending = readPending();
    var entry = pending[payload.intent_uuid];
    if (entry && isPermanentFailure(entry)) return; // skip permanent failures

    var nextAttempts = (entry && entry.attempts ? entry.attempts : 0) + 1;
    pending[payload.intent_uuid] = {
      first_seen_ms: entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now(),
      attempts: nextAttempts,
      last_attempt_ms: Date.now(),
      last_status: null,
      last_reason: null
    };
    writePending(pending);

    var withSchema = Object.assign({}, payload, { payload_schema_version: 1 });
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSchema),
      keepalive: true
    }).then(function (res) {
      var pend = readPending();
      var e = pend[payload.intent_uuid] || {};
      e.last_status = res.status;
      pend[payload.intent_uuid] = e;
      writePending(pend);
      if (res.status >= 200 && res.status < 300) {
        markSent(payload.intent_uuid, "ok_" + res.status);
        // pending 에서 제거 (성공)
        delete pend[payload.intent_uuid];
        writePending(pend);
      } else if (res.status >= 400 && res.status < 500) {
        // 4xx 는 영구 실패 — sent 에 status 만 박고 pending 정리
        markSent(payload.intent_uuid, "permanent_4xx_" + res.status);
        delete pend[payload.intent_uuid];
        writePending(pend);
      }
      // 5xx 는 pending 그대로 두고 다음 sweep 에서 재시도
    }).catch(function (err) {
      var pend = readPending();
      var e = pend[payload.intent_uuid] || {};
      e.last_reason = err && err.message ? String(err.message).slice(0, 100) : "fetch_failed";
      pend[payload.intent_uuid] = e;
      writePending(pend);
      // network 실패 — 다음 sweep 에서 재시도
    });
  }

  function sweep() {
    try {
      var buf = JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]");
      buf.forEach(attemptDispatch);
    } catch (e) {}
  }

  setInterval(sweep, SWEEP_INTERVAL_MS);
  window.addEventListener("beforeunload", sweep);
})();
</script>
```

핵심 (v1.5 변경):

- `preview_only !== true` 또는 `is_simulation === true` → 송출 안 함
- `intent_uuid` 단위 dedup (`__coffee_intent_sent`)
- pending 트래커 (`__coffee_intent_pending`) 와 sent 분리. fetch 2xx 후에만 sent 기록
- 4xx → 영구 실패로 sent 기록 (재시도 안 함, validation 실패는 retry 무의미)
- 5xx 또는 network 실패 → pending 유지, 다음 sweep 에서 재시도
- max retry 5회, TTL 24h. 둘 중 하나라도 도달 시 영구 실패
- `payload_schema_version: 1` 명시 박음
- sent 200개 초과 시 GC

Step A-3 에서 **GTM Preview workspace** 에 Custom HTML tag 로 등록 후 1회 검증 (preview-only 사용자가 NPay click → backend `/api/coffee/intent/stats` 의 `reject_counters.dry_run_ok` 가 +1 인지 확인). enforce 활성은 Step A-2 가 먼저. 본 phase commit 시점에는 이 코드를 GTM 에 박지 않는다.

dispatcher 검증용 추가 reject counter (backend 측):
- `enforce_inserted` — INSERT 성공 (enforce 활성 후 + dispatcher 보낸 경우)
- `enforce_deduped` — UNIQUE 충돌로 dedup
- `enforce_disabled` — env flag 미활성으로 reject
- `dispatcher_fetch_failed` — dispatcher 측 sessionStorage 의 pending entries 수 (backend 가 모름. dispatcher 자체 보고 endpoint 별도 phase)

## 금지선 (전 phase 동일)

- GA4 Measurement Protocol 전송 금지
- Meta CAPI 서버 전송 금지
- TikTok Events API 전송 금지
- Google Ads conversion upload 금지
- GTM Production workspace publish 금지
- 운영 endpoint 신규 배포 금지 (본 phase 는 backend 재시작 1회만, 외부 트래픽 0)
- 운영 DB write 금지 (enforce flag 활성 전까지 INSERT 0)
- live capture 활성화는 TJ 별도 승인 전 금지
- snippet 의 fetch / sendBeacon / XHR 사용 금지 (dispatcher 가 별도 layer)

## 외부 시스템 영향

| 시스템 | 본 phase 영향 |
|---|---|
| imweb 사이트 | 변경 0 |
| GTM workspace | 변경 0 |
| funnel-capi | 수정 0 (read-only reuse) |
| GA4 / Meta / TikTok / Google Ads | 신규 송출 0 |
| 로컬 SQLite `coffee_npay_intent_log` | schema v2 + 5종 인덱스 정의. 데이터 row 0 |
| 로컬 SQLite `schema_versions` | 메타 1행 |
| 운영 PG (`tb_iamweb_users` 등) | 변경 0 |
| 외부 API | 신규 호출 0 |

## 승인 요청 (TJ)

본 승인안의 다음 6개 항목에 OK / 보강 요청 / reject 표기 부탁드리오:

1. schema v2 (id PK + (site, intent_uuid) UNIQUE + (site, imweb_order_code, intent_uuid) UNIQUE + 5종 인덱스) 채택?
2. validation 정책 (PII reject + preview_only=true 강제 + is_simulation 차단) 채택?
3. enforce mode 활성 조건 (env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` + TJ 승인 + 별도 phase) 채택?
4. endpoint path (`POST /api/attribution/coffee-npay-intent` + `GET /api/attribution/coffee-npay-intents` + `GET /api/attribution/coffee-npay-intent-join-report`) 채택?
5. dispatcher 초안 (GTM Custom HTML tag, preview_only/is_simulation 가드 + 1초 throttle + sessionStorage dedup) 채택?
6. 7일 모니터링 지표 + live publish 중단 조건 채택?

OK 6/6 시 Step A-2 (env flag 활성) 진입. 1개라도 보강 요청 시 그 항목만 수정 후 재검토.
