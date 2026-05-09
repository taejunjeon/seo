# Path B 1h hash-only storage canary runbook

작성 시각: 2026-05-09 10:35 KST
대상: biocom Path B order bridge
Status: precheck complete / canary execution blocked by missing deployed storage path

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - gptconfirm/gpt0508-9/03-path-b-storage-canary-final-approval-20260509.md
  lane: Yellow approved canary precheck; Green local implementation draft
  allowed_actions:
    - VM read-only precheck
    - no-send synthetic smoke
    - local hash-only storage implementation draft
    - fixture test
    - report and gptconfirm packaging
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - backend deploy without deploy packet
    - operational schema migration
    - platform send
    - conversion upload
    - raw email/phone/member_code/order/payment storage or logging
  source_window_freshness_confidence:
    source: "VM read-only precheck + local code inspection + synthetic no-send smoke"
    window: "2026-05-09 10:18-10:35 KST"
    freshness: "2026-05-09 10:35 KST"
    confidence: 0.9
```

## 한 줄 결론

1시간 저장 canary는 승인됐지만, **운영에는 아직 order bridge 저장 코드/테이블/플래그가 없어 실행하지 않았다.** 대신 같은 조건을 만족하는 로컬 hash-only 저장 구현 초안과 fixture를 추가했다.

## 사전 점검 결과

- PM2 `seo-backend`: online.
- backend health: HTTP 200.
- `.env`: `ORDER_BRIDGE_IDENTITY_HASH_SECRET` 있음.
- `.env`: `ORDER_BRIDGE_WRITE_ENABLED`, `ORDER_BRIDGE_WRITE_CANARY_UNTIL`, `ORDER_BRIDGE_WRITE_MAX_ROWS`, `ORDER_BRIDGE_PLATFORM_SEND_ENABLED`, `ORDER_BRIDGE_RAW_BODY_LOGGING` 없음.
- SQLite table: `paid_click_intent_ledger`만 있음. `order_bridge_ledger` 없음.
- deployed dist: `identity-hmac/no-send` endpoint 있음.
- deployed dist: `ORDER_BRIDGE_WRITE_ENABLED`, `order_bridge_ledger` 저장 경로 없음.
- synthetic no-send smoke: HTTP 200.
- oversized guard: HTTP 413.
- raw echo count: 0.
- email-like PM2 log count before/after smoke: 0 -> 0.
- platform send count: 0.

## 실행하지 않은 이유

승인된 canary 조건은 `ORDER_BRIDGE_WRITE_ENABLED=true`로 1시간 동안 hash-only row를 저장하는 것이다. 그러나 운영 backend에는 해당 플래그를 읽어 `order_bridge_ledger`에 쓰는 경로가 없다.

또한 `order_bridge_ledger` 테이블이 운영 SQLite에 없다. 이를 만들려면 operational schema bootstrap이 필요하고, 기존 문서상 operational schema migration은 별도 승인 전 HOLD다.

따라서 이번에는 canary를 강제로 열지 않았다. 이는 실패가 아니라 **precheck block**이다.

## 로컬 보강

다음 제한 deploy 승인에 바로 쓸 수 있도록 로컬 코드만 보강했다.

- `backend/src/orderBridgeLedger.ts`
  - `order_bridge_ledger` hash-only schema bootstrap.
  - `ORDER_BRIDGE_WRITE_ENABLED` guard.
  - `ORDER_BRIDGE_WRITE_CANARY_UNTIL` guard.
  - `ORDER_BRIDGE_WRITE_MAX_ROWS` cap.
  - `ORDER_BRIDGE_RAW_BODY_LOGGING=false` guard.
  - `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false` guard.
  - dedupe update.
  - summary read endpoint helper.
- `backend/src/orderBridgeIdentityHmac.ts`
  - response에는 prefix만 두고, 내부 저장용 full hash material을 분리.
- `backend/src/routes/attribution.ts`
  - 기존 `/api/attribution/order-bridge/identity-hmac/no-send`에 write flag 분기 초안 추가.
  - flag OFF면 기존 no-send 동작 유지.
  - flag ON이면 hash-only row만 저장하고 `would_send=false` 유지.
  - `/api/attribution/order-bridge/ledger/summary` read-only summary 초안 추가.
- `backend/tests/order-bridge-identity-hmac.test.ts`
  - write flag ON fixture.
  - hash-only row 저장.
  - duplicate dedupe.
  - raw echo 0.
  - raw stored 0.
  - platform send 0.

## 승인 즉시 실행하려면 필요한 추가 전제

1. 제한 backend deploy 승인:
   - 위 로컬 diff를 운영 backend에 반영.
   - PM2 restart 1회 필요 여부 명확화.
2. schema bootstrap 승인:
   - `order_bridge_ledger` table/index 생성.
   - raw column 없음.
3. flag 주입 승인:
   - `ORDER_BRIDGE_WRITE_ENABLED=true`.
   - `ORDER_BRIDGE_WRITE_CANARY_UNTIL=<1h window>`.
   - `ORDER_BRIDGE_WRITE_MAX_ROWS=200`.
   - `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false`.
   - `ORDER_BRIDGE_RAW_BODY_LOGGING=false`.
4. traffic source 승인:
   - GTM Production publish 금지 상태에서는 일반 운영 트래픽이 Path B endpoint를 호출하지 않는다.
   - 실제 고객 주문 흐름을 보려면 Production tag publish 또는 서버 측 주문완료 hook이 별도 승인되어야 한다.
   - 그 전에는 Preview/manual controlled flow만 관측 가능하다.

## 권장 runbook

### 1. Flag OFF precheck

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
sudo -n -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  cd /home/biocomkr_sns/seo/repo/backend
  pm2 describe seo-backend | sed -n "1,40p"
  curl -sS -o /tmp/health.json -w "%{http_code}\n" http://127.0.0.1:7020/health
'
```

### 2. Table precheck

```bash
sqlite3 /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='order_bridge_ledger';"
```

### 3. No-send smoke

POST `/api/attribution/order-bridge/identity-hmac/no-send` with synthetic payload.

Expected:

- HTTP 200.
- `preview.would_store=false` when flag OFF.
- `preview.would_send=false`.
- `no_raw_echo_verified=true`.
- `raw_payload_stored=false`.
- `raw_logging_enabled=false`.
- `platform_send_count=0`.

### 4. Canary enable

Only after limited deploy + schema bootstrap approval:

```text
ORDER_BRIDGE_WRITE_ENABLED=true
ORDER_BRIDGE_WRITE_CANARY_UNTIL=<now + 1h>
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
```

### 5. 10분 모니터링

```sql
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT NULLIF(order_no_hash, '')) AS unique_order_no_hash,
  COUNT(DISTINCT NULLIF(email_hash, '')) AS unique_email_hash,
  COUNT(DISTINCT NULLIF(phone_hash, '')) AS unique_phone_hash,
  COUNT(DISTINCT NULLIF(click_id_hash, '')) AS unique_click_id_hash,
  SUM(CASE WHEN raw_payload_stored != 0 THEN 1 ELSE 0 END) AS raw_stored_count,
  SUM(platform_send_count) AS platform_send_count,
  SUM(duplicate_count) AS duplicate_dedupe_count
FROM order_bridge_ledger
WHERE site='biocom';
```

### 6. Stop condition

즉시 OFF:

- raw stored > 0.
- platform send > 0.
- 5xx 반복.
- PM2 unexpected restart.
- row_count > 200.
- duplicate 폭증.

## 현재 판정

- Canary approval: YES from TJ.
- Canary execution: BLOCKED_NOT_EXECUTED.
- Local implementation readiness: PASS.
- Next approval needed: limited backend deploy + schema bootstrap + traffic source decision.
