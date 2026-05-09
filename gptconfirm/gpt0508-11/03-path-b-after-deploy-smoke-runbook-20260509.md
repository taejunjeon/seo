# Path B after-deploy smoke runbook

작성 시각: 2026-05-09 17:08 KST
Status: runbook only / execution HOLD

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
    - gptconfirm/gpt0508-11/01-path-b-limited-storage-deploy-final-packet-20260509.md
  lane: Green runbook writing
  allowed_actions:
    - smoke command drafting
    - post-canary report template drafting
  forbidden_actions:
    - command execution on VM Cloud
    - env change
    - PM2 restart
    - row write
    - platform send
  source_window_freshness_confidence:
    source: "local fixture + gpt0508-10 precheck"
    window: "2026-05-09 KST"
    freshness: "2026-05-09 17:08 KST"
    confidence: 0.89
```

## 한 줄 결론

배포 후 smoke는 **flag OFF 안전 확인 -> flag ON controlled 1건 -> 즉시 rollback/OFF** 순서로 실행해야 한다.

## 실행 전 조건

- limited deploy 승인 완료.
- schema bootstrap 승인 완료.
- PM2 restart 1회 허용 여부 결정.
- `ORDER_BRIDGE_IDENTITY_HASH_SECRET` present.
- GTM Production publish 없음.
- platform send flag false.
- raw body logging false.

## Smoke script draft

아래는 실행 승인 후 사용할 수 있는 초안이다. 지금 실행하지 않는다.

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/biocomkr_sns/seo/repo/backend"
LOG_DIR="/home/biocomkr_sns/seo/shared/backend-logs"
BASE_URL="http://127.0.0.1:7020"
SQLITE="$APP_DIR/data/crm.sqlite3"

cd "$APP_DIR"
export PATH=/home/biocomkr_sns/seo/node/bin:$PATH

echo "[1] health"
curl -sS -o /tmp/pathb-health.json -w "%{http_code}\n" "$BASE_URL/health"

echo "[2] table exists"
sqlite3 "$SQLITE" "SELECT name FROM sqlite_master WHERE type='table' AND name='order_bridge_ledger';"

echo "[3] baseline summary"
curl -sS "$BASE_URL/api/attribution/order-bridge/ledger/summary" | python3 -m json.tool

echo "[4] raw log baseline count"
BASE_RAW_COUNT=$(grep -Eio "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}" "$LOG_DIR"/pm2-*.log 2>/dev/null | wc -l | tr -d ' ')
echo "raw_email_like_count_before=$BASE_RAW_COUNT"

echo "[5] flag OFF no-send smoke"
cat >/tmp/pathb-off-payload.json <<'JSON'
{
  "site": "biocom",
  "capture_stage": "after_deploy_flag_off_smoke",
  "email": "pathb-after-deploy@example.invalid",
  "phone": "010-0000-0000",
  "order_no": "ORDER-PATHB-AFTER-DEPLOY-OFF-20260509",
  "client_id": "349382661.1770783461",
  "ga_session_id": "1778253859",
  "local_session_id": "local-session-pathb-after-deploy-off",
  "click_id": "TEST_GCLID_PATHB_AFTER_DEPLOY_OFF_20260509"
}
JSON
curl -sS -o /tmp/pathb-off-response.json -w "%{http_code}\n" \
  -X POST "$BASE_URL/api/attribution/order-bridge/identity-hmac/no-send" \
  -H "Content-Type: application/json" \
  --data @/tmp/pathb-off-payload.json
python3 - <<'PY'
import json
from pathlib import Path
body=json.loads(Path("/tmp/pathb-off-response.json").read_text())
preview=body.get("preview", {})
assert body.get("ok") is True
assert preview.get("would_store") is False
assert preview.get("would_send") is False
assert preview.get("no_raw_echo_verified") is True
assert preview.get("no_platform_send_verified") is True
assert preview.get("platform_send_count") == 0
print("flag_off_smoke=PASS")
PY

echo "[6] oversized 413 smoke"
python3 - <<'PY' >/tmp/pathb-oversized.json
import json
print(json.dumps({"site":"biocom","email":"oversized@example.invalid","extra_note":"x"*(17*1024)}))
PY
curl -sS -o /tmp/pathb-oversized-response.json -w "%{http_code}\n" \
  -X POST "$BASE_URL/api/attribution/order-bridge/identity-hmac/no-send" \
  -H "Content-Type: application/json" \
  --data @/tmp/pathb-oversized.json

echo "[7] enable controlled write"
# 승인된 경우에만 .env 변경 후 pm2 restart --update-env 수행.
# ORDER_BRIDGE_WRITE_ENABLED=true
# ORDER_BRIDGE_WRITE_CANARY_UNTIL=<now+10m>
# ORDER_BRIDGE_WRITE_MAX_ROWS=1
# ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
# ORDER_BRIDGE_RAW_BODY_LOGGING=false

echo "[8] flag ON controlled write smoke"
cat >/tmp/pathb-on-payload.json <<'JSON'
{
  "site": "biocom",
  "capture_stage": "after_deploy_flag_on_controlled_smoke",
  "email": "pathb-after-deploy@example.invalid",
  "phone": "010-0000-0000",
  "order_no": "ORDER-PATHB-AFTER-DEPLOY-ON-20260509",
  "client_id": "349382661.1770783461",
  "ga_session_id": "1778253859",
  "local_session_id": "local-session-pathb-after-deploy-on",
  "click_id": "TEST_GCLID_PATHB_AFTER_DEPLOY_ON_20260509"
}
JSON
curl -sS -o /tmp/pathb-on-response.json -w "%{http_code}\n" \
  -X POST "$BASE_URL/api/attribution/order-bridge/identity-hmac/no-send" \
  -H "Content-Type: application/json" \
  --data @/tmp/pathb-on-payload.json
python3 - <<'PY'
import json
from pathlib import Path
body=json.loads(Path("/tmp/pathb-on-response.json").read_text())
preview=body.get("preview", {})
ledger=body.get("ledger", {})
assert body.get("ok") is True
assert preview.get("would_store") is True
assert preview.get("would_send") is False
assert ledger.get("stored") is True
assert preview.get("platform_send_count") == 0
print("flag_on_controlled_write=PASS")
PY

echo "[9] summary and raw checks"
curl -sS "$BASE_URL/api/attribution/order-bridge/ledger/summary" | python3 -m json.tool
AFTER_RAW_COUNT=$(grep -Eio "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}" "$LOG_DIR"/pm2-*.log 2>/dev/null | wc -l | tr -d ' ')
echo "raw_email_like_count_after=$AFTER_RAW_COUNT"
test "$BASE_RAW_COUNT" = "$AFTER_RAW_COUNT"

echo "[10] rollback flag OFF"
# 승인된 rollback command로 ORDER_BRIDGE_WRITE_ENABLED=false 후 pm2 restart --update-env
```

## Smoke success criteria

- health 200.
- table exists.
- summary endpoint 200.
- flag OFF no-send 200.
- oversized 413.
- raw echo 0.
- raw log count unchanged.
- platform_send_count 0.
- flag ON controlled write stores exactly one hash-only row.
- duplicate does not increase row_count.
- flag OFF rollback confirmed.

## Post-canary report template

1h canary 본 실행 후 보고서는 아래를 채운다.

```md
# Path B 1h storage canary post report

작성 시각: YYYY-MM-DD HH:mm KST
Window: <start> - <end> KST
Site: biocom
Mode: hash-only storage canary

## 한 줄 결론

- PASS / HOLD / FAIL:
- 사람이 이해하는 1문장:

## 수집 건강도

- row_count:
- row cap:
- endpoint 5xx rate:
- PM2 unexpected restart:
- duplicate_dedupe_count:
- raw_stored_count:
- raw_log_count_delta:
- platform_send_count:

## Bridge fill rate

- order_no_hash_fill_rate:
- identity_hash_fill_rate:
- email_hash_fill_rate:
- phone_hash_fill_rate:
- click_id_hash_fill_rate:
- client_session_present_rate:

## Reliability

- confidence_A:
- confidence_B:
- confidence_C:
- confidence_D:
- ambiguous_count:
- ambiguous_rate:

## Decision

- Production publish ready: YES/HOLD/NO
- real paid-click actual order test ready: YES/HOLD/NO
- actual send ready: NO

## 금지선

- raw 저장:
- platform send:
- conversion upload:
```

## 현재 판정

- Runbook readiness: READY.
- Execution: HOLD.
- 다음 필요 승인: limited deploy + schema bootstrap + controlled write smoke.
