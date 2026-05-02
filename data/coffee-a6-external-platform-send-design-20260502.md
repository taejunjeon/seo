# A-6 외부 플랫폼 보강 전송 design (2026-05-02)

상위 sprint: [[!coffeedata#다음 할일]] 항목 22 (A-6 외부 플랫폼 보강 전송).

본 문서 성격: **A-6 design + dry-run only**. 본 commit 시점에 외부 플랫폼 (GA4 MP / Meta CAPI / TikTok Events / Google Ads) **실제 send 0**. enforce 활성은 A-5 closure + TJ 명시 승인 후만 (Red Lane).

## 0. 결론 (10초)

| 항목 | 판정 |
|---|---|
| A-6 진입 가능 여부 | **A-5 closure 후만** (5일 default 또는 3일 조기 게이트 PASS) |
| 본 sprint scope | design + ledger join SQL dry-run + backend skeleton + payload schema 초안 |
| 외부 send | **0** (본 sprint commit 시점) |
| backend 영향 | 0 (skeleton + schema 만, runtime 영향 0) |
| 첫 publish target platform | **GA4 MP only** 우선 (Meta CAPI 후속 sprint) |
| dedup 인프라 | `coffee_npay_send_log` 테이블 — UNIQUE on (platform, transaction_id) |
| 가드 (sprint 19.7 패턴 재사용) | env flag `COFFEE_NPAY_INTENT_A6_SEND_LIVE=true` + (production_mode OR smoke_window) + daily_quota_a6 |

## 1. A-6 의 정확한 의미

### 1.1 현재 attribution 의 한계

| 시스템 | 현재 NPay purchase 처리 | 한계 |
|---|---|---|
| GA4 | site 가 `transaction_id = NPAY - <id> - <epoch_ms>` 합성 발화 | 합성 ID — imweb 의 진짜 `order_code` / `channel_order_no` 와 매칭 0. ROAS 계산 / 환불 매칭 0 |
| Meta CAPI | site 의 fbq Purchase 발화 → funnel-capi v3 mirror | event_id mismatch 가능. dedup logic 약함 |
| TikTok Events / Google Ads | site 발화 의존 | GA4 와 동일 한계 |

### 1.2 A-6 의 목표

A-4 publish (dispatcher v2.1 + snippet installer) → A-5 5일 monitoring (capture rate ≥95% 검증) → **A-6: ledger 의 deterministic mapping 결과를 외부 플랫폼에 보강 전송**.

### 1.3 보강 (correction / dedup / additional) flow

```
ledger row (id=N, imweb_order_code=o20260502abc...)
  ↓ deterministic join (sprint 19 의 lesson coffee-lesson-013)
imweb_orders (origin: tb_iamweb_orders)
  → order_no, channel_order_no, phone_norm, value, item_name, ts
  ↓ A-6 enforce send (sprint 19.7 가드 패턴)
GA4 MP: transaction_id 정정 (synthetic → 진짜 order_no), event_id dedup
Meta CAPI: event_id 일치, em/ph hash 보강
TikTok Events / Google Ads: 후속 sprint (별도 design)
```

## 2. send platform 우선순위

| Platform | 우선순위 | 사유 |
|---|---|---|
| **GA4 MP** | **1** | site 의 GA4 NPay purchase synthetic transaction_id 한계 가장 큼. ROAS 정합성의 base. event_id dedup logic 명확 |
| Meta CAPI | 2 | 광고 ROAS 측정의 두 번째 축. event_id hash format 정의 필요 |
| TikTok Events | 3 | Coffee site 의 TikTok 광고 비중 검증 후 진입 |
| Google Ads | 4 | conversion API 별도, gclid 의존도 |

본 sprint 의 dry-run 범위 = GA4 MP 만. Meta CAPI 는 후속 sprint (A-6.2).

## 3. GA4 MP send payload schema

### 3.1 endpoint

production: `https://www.google-analytics.com/mp/collect?measurement_id={MEASUREMENT_ID}&api_secret={API_SECRET}`
debug: `https://www.google-analytics.com/debug/mp/collect?measurement_id={...}&api_secret={...}` — `validation_only=true` 응답만, 실제 GA4 안 들어감

### 3.2 payload (GA4 MP purchase)

```json
{
  "client_id": "<from ledger.ga_client_id 또는 fallback uuid>",
  "user_id": "<phone_hash 또는 미설정>",
  "events": [
    {
      "name": "purchase",
      "params": {
        "transaction_id": "<imweb_orders.order_no>",
        "value": <imweb_orders.payment_amount>,
        "currency": "KRW",
        "items": [
          {
            "item_id": "<prod_code>",
            "item_name": "<item_name>",
            "price": <prod_price>,
            "quantity": <selected_quantity>,
            "item_brand": "thecleancoffee"
          }
        ],
        "session_id": "<ledger.ga_session_id 또는 funnel_capi_session_id>",
        "engagement_time_msec": "1",
        "_a6_source": "coffee_npay_intent_ledger_v1"
      }
    }
  ]
}
```

### 3.3 검증 절차 (test_event_code / validation_only=true)

```bash
# debug endpoint — validation_only 응답, GA4 안 들어감
curl -X POST 'https://www.google-analytics.com/debug/mp/collect?...' \
  -d '{"client_id":"test","events":[{"name":"purchase","params":{...}}]}'
# 응답: { "validationMessages": [] } → schema OK
```

본 sprint 에서는 **debug endpoint 만** 호출. real send 는 A-6 enforce 시점에만.

## 4. ledger → imweb_orders join SQL

### 4.1 join key

| ledger 컬럼 | imweb_orders 컬럼 | 매칭 |
|---|---|---|
| `imweb_order_code` (예: `o20260502abc...`) | `order_code` | 1:1 deterministic |
| `site` ('thecleancoffee') | `site` | filter |
| `ts_ms_kst` (click 시점) | `order_time` | 24h 윈도우 추정 |

### 4.2 dry-run SQL (read-only)

```sql
-- 현재 ledger 의 imweb_order_code 가 imweb_orders 와 join 되는 비율
SELECT
  l.id AS ledger_id,
  l.intent_uuid,
  l.imweb_order_code,
  l.payment_button_type,
  l.intent_phase,
  o.order_no,
  o.order_code AS imweb_order_code_real,
  o.channel_order_no,
  o.payment_amount,
  o.order_time,
  o.phone_norm,
  o.email_hash,
  o.item_name,
  CASE
    WHEN o.order_code IS NULL THEN 'no_order_match'
    WHEN o.payment_amount IS NULL THEN 'order_match_but_no_amount'
    ELSE 'joined_confirmed_order'
  END AS join_status
FROM coffee_npay_intent_log l
LEFT JOIN imweb_orders o
  ON l.site = o.site
  AND l.imweb_order_code = o.order_code
WHERE l.site = 'thecleancoffee'
  AND l.intent_uuid NOT LIKE 'smoke_%'
  AND l.source_version NOT LIKE '%_codex_sim'
  AND l.source_version NOT LIKE '%_playwright%'
  AND l.is_simulation = 0
ORDER BY l.id DESC
LIMIT 100;
```

**현재 ledger 18 row 의 dry-run 결과 예상**:
- 대부분 test row (sprint 19.x 의 codex_sim / playwright) — `intent_uuid LIKE 'smoke_%'` 또는 `source_version LIKE '%_codex_sim'` 또는 `%_playwright%` 필터로 제외
- real row 는 sprint 19 의 site dispatcher 2건 (id=3, 6) — 단 imweb_order_code=null (v2 race) 또는 mock
- 즉 hit rate 0 또는 매우 작음 — 운영 traffic (publish 후) 들어와야 진짜 검증

본 sprint 의 dry-run 은 SQL 실행 + 0 hit 정상 인지 + design 검증 용도.

## 5. dedup table schema

### 5.1 신규 테이블 `coffee_npay_send_log`

```sql
CREATE TABLE coffee_npay_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id INTEGER NOT NULL,         -- coffee_npay_intent_log.id 참조
  platform TEXT NOT NULL,             -- 'ga4_mp' | 'meta_capi' | 'tiktok_events' | 'google_ads'
  transaction_id TEXT NOT NULL,       -- imweb_orders.order_no (보강 후 진짜 ID)
  imweb_order_code TEXT NOT NULL,     -- ledger 의 imweb_order_code (mapping anchor)
  send_mode TEXT NOT NULL,            -- 'dry_run' | 'enforce'
  send_status TEXT,                   -- 'ok' | 'permanent_4xx' | 'fetch_failed' | 'dedup'
  send_response_code INTEGER,
  send_response_body TEXT,            -- 첫 300 chars 만 (디버그용)
  send_payload_hash TEXT,             -- 같은 payload 두 번 send 방지용
  attempts INTEGER DEFAULT 1,
  last_attempt_ms INTEGER,
  permanent_failure INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', '+09:00'))
);

CREATE UNIQUE INDEX idx_coffee_npay_send_log_platform_tx
  ON coffee_npay_send_log (platform, transaction_id);

CREATE INDEX idx_coffee_npay_send_log_ledger_id
  ON coffee_npay_send_log (ledger_id);

CREATE INDEX idx_coffee_npay_send_log_status
  ON coffee_npay_send_log (send_status, created_at);
```

### 5.2 dedup 동작

- send 시도 시 `INSERT OR IGNORE INTO coffee_npay_send_log (...)`
- 같은 `(platform, transaction_id)` 두 번째 시도는 dedup
- `permanent_4xx` 응답 시 `permanent_failure=1` — 다시 시도 안 함
- `fetch_failed` (5xx / network) 는 retry 가능 (max 3회 / 24h)

## 6. send 가드 (sprint 19.7 패턴 재사용)

```typescript
const A6_SEND_LIVE_FLAG = "COFFEE_NPAY_INTENT_A6_SEND_LIVE";
const A6_DAILY_QUOTA = 200;  // 일일 send cap, 비정상 polling 방어 (publish 후 traffic 60-100/일 기준)
```

`runA6SendEnforce` 가드:
1. env flag `COFFEE_NPAY_INTENT_A6_SEND_LIVE=true` 검사
2. (production_mode OR smoke_window) 활성 검사 (sprint 19.7 패턴)
3. production_mode 만 활성 시 daily quota (`A6_DAILY_QUOTA=200`) 검사
4. dedup 검사 (`coffee_npay_send_log` 의 UNIQUE constraint)
5. payload validation (transaction_id / value / items 필수)
6. send 시도 → response code 기록

## 7. send 흐름 (cron 또는 실시간)

| 옵션 | 설명 | 추천 |
|---|---|---|
| **A. cron batch** | 매일 KST 09:00 cron 이 ledger join → unsent 행 → batch send (1건/sec) | **추천** — backend traffic 통제, RL 방어 |
| B. 실시간 trigger | dispatcher 가 backend INSERT 직후 imweb_orders sync 대기 + send | imweb_orders sync timing 의존, 복잡 |
| C. on-demand | 운영자가 manual trigger | 안전 / 단 자동 anh |

본 sprint design = **A 패턴**. cron 스크립트 신규: `backend/scripts/coffee-a6-send-cron.ts`.

## 8. publish 전 필수 체크리스트 (8개)

| # | 항목 | 기대 |
|---|---|---|
| C1 | A-5 5일 default monitoring closure | PASS (3일 조기 게이트 9 조건 OR 5일 6/9 + 핵심 4) |
| C2 | imweb_order_code capture rate (운영 traffic) | ≥95% |
| C3 | ledger → imweb_orders join hit rate (24h 이내) | ≥80% |
| C4 | `coffee_npay_send_log` table schema 적용 | tsc PASS + UNIQUE constraint 동작 |
| C5 | GA4 MP debug endpoint validation | `validationMessages: []` 검증 |
| C6 | dry-run send (debug endpoint) 50건 PASS | 50건 모두 200 응답 + dedup 동작 |
| C7 | A6_SEND_LIVE env flag dormant (default false) | publish 시점에만 활성 |
| C8 | TJ 명시 send 승인 (Red Lane) | OK |

## 9. rollback / stop 조건

### 9.1 rollback

- send_log 의 `permanent_failure=1` 또는 `send_status='permanent_4xx'` 비율 > 5% → 즉시 cron 중단 + 보고
- send_log daily count > A6_DAILY_QUOTA → cron 중단
- env flag OFF (.env 의 `COFFEE_NPAY_INTENT_A6_SEND_LIVE=false` 또는 line 제거 + pm2 restart) — 1분

### 9.2 14 stop 조건

| # | 조건 | stop 임계 |
|---|---|---|
| AS-1 | send 실패율 (5xx/network) | >5% / 1h |
| AS-2 | 4xx 영구 실패 | >2% / 1h |
| AS-3 | dedup hit rate | >50% (= 같은 transaction_id 재시도) — payload hash 정정 필요 |
| AS-4 | daily quota 초과 | >A6_DAILY_QUOTA — 비정상 polling 의심 |
| AS-5 | GA4 MP API key 무효 | 401/403 응답 |
| AS-6 | Meta CAPI access_token 만료 | 동일 |
| AS-7 | imweb_orders sync delay | join_status 'pending_order_sync' >50% — imweb sync cron 점검 |
| AS-8 | ROAS 분기 (광고 측 dashboard) 회귀 | 별도 GA4 / Meta dashboard 추적 |
| AS-9 | A-5 monitoring 의 EG 회귀 | F-1/F-2 위반 → A-4 + A-6 둘 다 stop |
| AS-10 | TJ 직접 stop | 즉시 |
| AS-11 | 외부 플랫폼 정책 변경 (custom event 차단 등) | 별도 |
| AS-12 | timezone 미스 (ts_ms_kst → epoch 변환 오류) | logging 으로 감지 |
| AS-13 | imweb_order_code 형식 변경 | snippet retry capture 실패 |
| AS-14 | ledger 자체 capture rate <80% | A-5 회귀 추적 |

## 10. monitoring 지표

기존 [[coffee-a4-monitoring-report-template-20260502]] §4 + 신규:

| # | 지표 | 산출 |
|---|---|---|
| S-1 | send_total_count | `coffee_npay_send_log` 의 row 수 |
| S-2 | send_ok_count | `send_status='ok'` 비율 |
| S-3 | send_permanent_4xx_count | `send_status='permanent_4xx'` |
| S-4 | send_fetch_failed_count | `send_status='fetch_failed'` |
| S-5 | dedup_hit_count | `INSERT OR IGNORE` 의 deduped 비율 |
| S-6 | platform 별 split | GA4 MP / Meta CAPI 별 |
| S-7 | daily_send_count | KST 자정 기준 |

## 11. backend 구현 범위 (skeleton)

### 11.1 신규 파일

- `backend/src/coffeeNpaySendLog.ts` — schema + functions (`runA6SendDryRun`, `runA6SendEnforce`, stats, list)
- `backend/scripts/coffee-a6-ledger-join-dry-run.ts` — 현재 ledger 18 row 로 join SQL dry-run 검증
- `backend/scripts/coffee-a6-send-cron.ts` (별도 sprint, A-5 closure 후) — cron batch send

### 11.2 routes 추가

- `POST /api/attribution/coffee-a6-send` (mode=dry_run|enforce) — A-1 패턴 재사용
- `GET /api/coffee/a6-send/stats` — public read-only

### 11.3 schema 추가

- `coffee_npay_send_log` 테이블 (위 §5.1)
- `schema_versions` 메타 row 추가 (`coffee_npay_send_log` v1)

## 12. Auditor verdict (본 sprint = design + dry-run only)

| 항목 | 결과 |
|---|---|
| GA4 MP / Meta CAPI 실제 send | **0** (debug endpoint 만 검증, 본 commit 시점에는 실행 안 함) |
| backend env flag 변경 | 0 (skeleton 만 — A6_SEND_LIVE flag 추가 단 default false) |
| ledger 영향 | 0 (read-only join SQL 만) |
| imweb_orders 영향 | 0 (read-only) |
| GTM publish | 0 |
| backend deploy | dry-run script + skeleton 만 — VM 배포는 본 sprint 에서 안 함 (별도 sprint 22.1) |
| 외부 플랫폼 광고 데이터 영향 | 0 |

**verdict: PASS (design + dry-run only)**

NOTES:
- N1: 본 sprint commit 시점에 backend send module 은 skeleton + dry_run only. enforce 활성은 A-5 closure + TJ 명시 승인 후 별도 sprint
- N2: cron batch send 의 RL / pacing 은 GA4 MP 의 default RL (10 events/min/property) 와 부합 — 1 event/sec pacing 이면 안전
- N3: imweb_orders sync delay 시 send_log 가 'pending_order_sync' 상태 — 후속 cron 에서 retry

## 13. 다음 액션 (구체)

| Sprint | 진입 시점 | 내용 |
|---|---|---|
| **본 sprint 22 (현재)** | 즉시 | design 문서 + dry-run script + backend skeleton — Yellow Lane |
| 22.1 | A-5 closure 후 | backend skeleton 의 schema 적용 + VM 배포 + dry-run send 50건 검증 |
| 22.2 | 22.1 PASS + TJ 승인 | A6_SEND_LIVE env flag 활성 + cron batch send 1일/일 시험 |
| 22.3 | 22.2 안정 | Meta CAPI design + skeleton |
| A-7 (별도) | A-6 GA4 MP / Meta CAPI 모두 안정 후 | TikTok Events / Google Ads 보강 |

자세한 진입 게이트: 본 문서 §8 publish 전 필수 체크리스트 + A-5 closure ([[coffee-a4-publish-decision-and-dispatcher-v21-20260502#9-3일-조기-평가-기준]]).
