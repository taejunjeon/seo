# Path B limited storage deploy final packet

작성 시각: 2026-05-09 17:08 KST
대상: biocom Path B order bridge
Status: approval packet only / execution HOLD

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
    - gptconfirm/gpt0508-10/00-result-report.md
    - gdn/path-b-storage-canary-runbook-20260509.md
  lane: Yellow approval packet writing
  allowed_actions:
    - deploy packet writing
    - diff summary
    - schema bootstrap design
    - smoke and rollback runbook design
  forbidden_actions:
    - limited storage deploy execution
    - schema bootstrap execution
    - PM2 restart
    - 1h storage canary execution
    - GTM Production publish
    - Imweb production save
    - platform send
    - conversion upload
    - raw email/phone/member_code/order/payment storage or logging
  source_window_freshness_confidence:
    source: "local Path B hash-only storage implementation + gpt0508-10 VM Cloud precheck"
    window: "2026-05-09 10:18-17:08 KST"
    freshness: "2026-05-09 17:08 KST"
    confidence: 0.9
```

## 한 줄 결론

다음 승인은 **1시간 저장 canary 실행**이 아니라, 그 canary를 가능하게 만드는 **VM Cloud 제한 배포 + hash-only schema bootstrap**이다.

## 무엇을 승인하는가

VM Cloud backend에 Path B order bridge 저장 장치를 제한 반영할지 판단한다.

이 승인안은 아래를 포함한다.

- `order_bridge_ledger` hash-only table bootstrap.
- flag OFF 기본 배포.
- no-send endpoint 기존 동작 유지.
- flag ON일 때만 controlled hash-only row 1건 저장 가능.
- raw 값 저장/로그 금지.
- platform send 0.

이 승인만으로 아래는 하지 않는다.

- GTM Production publish.
- Imweb production save.
- 1h storage canary 본 실행.
- Google Ads/GA4/Meta/TikTok/Naver 전송.
- Google Ads conversion upload.

## 왜 필요한가

gpt0508-10에서 1h storage canary는 승인됐지만, VM Cloud에는 아직 저장 경로/테이블/플래그가 없어 실행하지 않았다.

운영 기준 100%로 가려면 먼저 저장 장치가 있어야 한다. Preview는 이미 PASS했지만, 실제 row fill rate와 ambiguous rate는 `order_bridge_ledger` row가 있어야 계산할 수 있다.

## Diff summary

Tracked diff 기준:

```text
backend/src/routes/attribution.ts | 155 ++++++++++++++++++++++++++++++++++++++
```

새 파일 또는 untracked 파일 기준:

```text
backend/src/orderBridgeIdentityHmac.ts             233 lines
backend/src/orderBridgeLedger.ts                   282 lines
backend/tests/order-bridge-identity-hmac.test.ts   270 lines
```

## 변경 파일별 요약

### `backend/src/orderBridgeIdentityHmac.ts`

- raw email/phone/order/click id를 response에 돌려주지 않고 HMAC/hash prefix만 만든다.
- 저장용 full hash material과 response용 safe preview를 분리한다.
- `would_store`는 flag OFF에서 false, flag ON local fixture에서 true로 바뀔 수 있다.
- raw payload 저장은 하지 않는다.

### `backend/src/orderBridgeLedger.ts`

- `order_bridge_ledger` table bootstrap 초안.
- `ORDER_BRIDGE_WRITE_ENABLED` guard.
- `ORDER_BRIDGE_WRITE_CANARY_UNTIL` guard.
- `ORDER_BRIDGE_WRITE_MAX_ROWS` cap, 최대 200.
- `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false` guard.
- `ORDER_BRIDGE_RAW_BODY_LOGGING=false` guard.
- dedupe key 기반 중복 억제.
- read-only summary helper.

### `backend/src/routes/attribution.ts`

- `POST /api/attribution/order-bridge/identity-hmac/no-send`에 write flag branch 추가.
- flag OFF면 기존 no-send response 유지.
- flag ON이면 hash-only row만 저장하고 `would_send=false` 유지.
- `GET /api/attribution/order-bridge/ledger/summary` read-only summary 추가.

### `backend/tests/order-bridge-identity-hmac.test.ts`

- normalize + HMAC fixture.
- no-send route fixture.
- oversized 413 fixture.
- write flag ON local storage fixture.
- duplicate dedupe fixture.
- raw echo 0 / raw stored 0 / platform send 0 assertion.

## 배포 대상 파일

Source 기준:

- `backend/src/orderBridgeIdentityHmac.ts`
- `backend/src/orderBridgeLedger.ts`
- `backend/src/routes/attribution.ts`

Build artifact 기준:

- `backend/dist/orderBridgeIdentityHmac.js`
- `backend/dist/orderBridgeLedger.js`
- `backend/dist/routes/attribution.js`

Test file은 VM Cloud 배포 대상이 아니다.

## Schema bootstrap SQL

실제 raw 값 컬럼은 없다. `raw_payload_stored`는 raw 저장 여부를 기록하는 audit flag일 뿐이다.

```sql
CREATE TABLE IF NOT EXISTS order_bridge_ledger (
  bridge_id TEXT PRIMARY KEY,
  site TEXT NOT NULL DEFAULT 'biocom',
  capture_stage TEXT NOT NULL DEFAULT 'order_confirm',
  received_at TEXT NOT NULL,
  order_no_hash TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  ga_session_id TEXT NOT NULL DEFAULT '',
  local_session_id_hash TEXT NOT NULL DEFAULT '',
  click_id_hash TEXT NOT NULL DEFAULT '',
  member_code_hash TEXT NOT NULL DEFAULT '',
  email_hash TEXT NOT NULL DEFAULT '',
  phone_hash TEXT NOT NULL DEFAULT '',
  identity_hash_version TEXT NOT NULL DEFAULT 'hmac_sha256_identity_v1',
  identity_source TEXT NOT NULL DEFAULT 'none',
  pay_type TEXT NOT NULL DEFAULT '',
  pg_type TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  reject_reason TEXT NOT NULL DEFAULT '',
  raw_payload_stored INTEGER NOT NULL DEFAULT 0,
  platform_send_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obl_dedupe ON order_bridge_ledger(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_obl_order ON order_bridge_ledger(site, order_no_hash) WHERE order_no_hash != '';
CREATE INDEX IF NOT EXISTS idx_obl_email ON order_bridge_ledger(site, email_hash) WHERE email_hash != '';
CREATE INDEX IF NOT EXISTS idx_obl_phone ON order_bridge_ledger(site, phone_hash) WHERE phone_hash != '';
CREATE INDEX IF NOT EXISTS idx_obl_click ON order_bridge_ledger(site, click_id_hash) WHERE click_id_hash != '';
CREATE INDEX IF NOT EXISTS idx_obl_session ON order_bridge_ledger(site, client_id, ga_session_id);
CREATE INDEX IF NOT EXISTS idx_obl_expires ON order_bridge_ledger(expires_at);
```

## Env flags

기본값:

```text
ORDER_BRIDGE_WRITE_ENABLED=false
ORDER_BRIDGE_WRITE_CANARY_UNTIL=
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
ORDER_BRIDGE_RETENTION_DAYS=90
```

기존 필요값:

```text
ORDER_BRIDGE_IDENTITY_HASH_SECRET=<redacted>
```

## PM2 restart 필요 여부

필요할 가능성이 높다. Node process가 `.env` 변경과 새 dist 파일을 읽으려면 `pm2 restart seo-backend --update-env`가 필요하다.

따라서 이 승인안은 PM2 restart 1회를 포함할지 명확히 결정해야 한다.

추천:

- deploy 시 PM2 restart 1회 허용.
- 1h canary window 중 unexpected restart 0을 성공 기준으로 둔다.

## Flag OFF smoke

목표: 배포 후에도 저장은 꺼져 있고 no-send가 유지되는지 확인한다.

성공 기준:

- `/health` 200.
- no-send endpoint 200.
- oversized 413.
- `preview.would_store=false`.
- `preview.would_send=false`.
- `raw_echo_count=0`.
- PM2 raw email pattern 증가 0.
- `platform_send_count=0`.
- summary endpoint 200.
- row_count는 기존값 유지.

## Flag ON controlled smoke

목표: 1h canary 전, controlled synthetic POST 1건만 hash-only 저장되는지 확인한다.

조건:

- `ORDER_BRIDGE_WRITE_ENABLED=true`.
- `ORDER_BRIDGE_WRITE_CANARY_UNTIL=<10분 후>`.
- `ORDER_BRIDGE_WRITE_MAX_ROWS=1`.
- `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false`.
- `ORDER_BRIDGE_RAW_BODY_LOGGING=false`.

성공 기준:

- controlled POST 1건 200.
- `ledger.stored=true`.
- `preview.would_store=true`.
- `preview.would_send=false`.
- row_count +1.
- `raw_payload_stored=0`.
- `platform_send_count=0`.
- duplicate 재POST 시 row_count 증가 없음, duplicate_count 증가.
- smoke 후 즉시 flag OFF.

## Rollback command

```bash
sudo -n -u biocomkr_sns bash -lc '
  set -euo pipefail
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  cd /home/biocomkr_sns/seo/repo/backend
  # 이전 dist 백업 위치로 원복한다. 실제 backup dir는 deploy 직전 생성한다.
  cp /home/biocomkr_sns/seo/deploy-backups/<backup>/orderBridgeIdentityHmac.js dist/orderBridgeIdentityHmac.js
  rm -f dist/orderBridgeLedger.js
  cp /home/biocomkr_sns/seo/deploy-backups/<backup>/attribution.js dist/routes/attribution.js
  python3 - <<PY
from pathlib import Path
p = Path(".env")
text = p.read_text()
for key, value in {
    "ORDER_BRIDGE_WRITE_ENABLED": "false",
    "ORDER_BRIDGE_WRITE_CANARY_UNTIL": "",
    "ORDER_BRIDGE_WRITE_MAX_ROWS": "0",
    "ORDER_BRIDGE_PLATFORM_SEND_ENABLED": "false",
    "ORDER_BRIDGE_RAW_BODY_LOGGING": "false",
}.items():
    lines = []
    found = False
    for line in text.splitlines():
        if line.startswith(key + "="):
            lines.append(f"{key}={value}")
            found = True
        else:
            lines.append(line)
    if not found:
        lines.append(f"{key}={value}")
    text = "\\n".join(lines) + "\\n"
p.write_text(text)
PY
  pm2 restart seo-backend --update-env
'
```

## 승인 문구 후보

```text
YES: Path B limited storage deploy + order_bridge_ledger schema bootstrap을 승인합니다.

범위:
- VM Cloud backend limited deploy
- 기본 flag OFF
- order_bridge_ledger hash-only schema bootstrap
- PM2 restart 1회
- flag OFF smoke
- flag ON controlled smoke 1건 후 즉시 OFF

금지:
- GTM Production publish
- Imweb production save
- 1h storage canary 본 실행
- raw email/phone/member_code/order/payment 저장·로그
- Google Ads/GA4/Meta/TikTok/Naver 전송
- Google Ads conversion upload
```

## 현재 판정

- Deploy readiness: READY_FOR_YELLOW_DECISION.
- Execution: HOLD.
- 다음 병목: traffic source 선택과 PM2 restart 허용 여부.
