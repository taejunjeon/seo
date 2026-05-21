#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

APP_ROOT="${APP_ROOT:-/home/biocomkr_sns/seo}"
REPO_DIR="$APP_ROOT/repo"
ECOSYSTEM_FILE="$REPO_DIR/capivm/ecosystem.config.cjs"
MONITORING_DIR="$APP_ROOT/monitoring"
ALERT_SRC="/tmp/leading-indicators-restart-alert.sh"
ALERT_DST="$MONITORING_DIR/leading-indicators-restart-alert.sh"
API_URL="http://127.0.0.1:7020/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver"
TS="$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S')"

mkdir -p "$MONITORING_DIR"

if [ -f "$ALERT_SRC" ]; then
  install -m 0750 "$ALERT_SRC" "$ALERT_DST"
fi

if [ -f "$MONITORING_DIR/leading-indicators-restart-alert.log" ] &&
   grep -q "seo-backend not found in PM2" "$MONITORING_DIR/leading-indicators-restart-alert.log" &&
   ! grep -Eq "INIT|OK|restart changed" "$MONITORING_DIR/leading-indicators-restart-alert.log"; then
  mv "$MONITORING_DIR/leading-indicators-restart-alert.log" \
    "$MONITORING_DIR/leading-indicators-restart-alert.setup-false-positive-$TS.log"
fi

BACKUP_DIR="$REPO_DIR/backend/_leading-indicators-permanent-on-backup-$TS"
mkdir -p "$BACKUP_DIR"
cp "$ECOSYSTEM_FILE" "$BACKUP_DIR/ecosystem.config.cjs.before"

python3 - "$ECOSYSTEM_FILE" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

def upsert_env(src: str, key: str, value: str, after_key: str) -> str:
    pattern = re.compile(rf'(\s*{re.escape(key)}:\s*)"[^"]*"(\s*,)')
    if pattern.search(src):
        return pattern.sub(rf'\g<1>"{value}"\2', src)

    anchor = re.compile(rf'(\s*{re.escape(after_key)}:\s*"[^"]*"\s*,\n)')
    match = anchor.search(src)
    if not match:
        raise SystemExit(f"anchor_not_found:{after_key}")

    indent = re.match(r"(\s*)", match.group(1)).group(1)
    insertion = f'{indent}{key}: "{value}",\n'
    return src[:match.end()] + insertion + src[match.end():]

text = upsert_env(text, "LEADING_INDICATORS_PRECOMPUTE_ENABLED", "1", "TRUST_PROXY")
text = upsert_env(
    text,
    "LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS",
    "1800000",
    "LEADING_INDICATORS_PRECOMPUTE_ENABLED",
)
path.write_text(text)
PY

export APP_ROOT
if ! pm2 restart "$ECOSYSTEM_FILE" --only seo-backend --update-env; then
  export LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
  export LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
  pm2 restart seo-backend --update-env
fi
pm2 save

CRON_FILE="$MONITORING_DIR/crontab.leading-indicators.$TS"
CRON_LINE="*/5 * * * * $ALERT_DST >> $MONITORING_DIR/leading-indicators-restart-alert.cron.log 2>&1"
crontab -l 2>/dev/null | grep -v "leading-indicators-restart-alert.sh" > "$CRON_FILE" || true
{
  echo "# leading indicators precompute restart alert: every 5m"
  echo "$CRON_LINE"
} >> "$CRON_FILE"
crontab "$CRON_FILE"

"$ALERT_DST"
"$ALERT_DST"

curl -sS -m 10 "$API_URL" | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  const x = JSON.parse(s || "{}");
  const c = x.cache || {};
  const safety = x.safety || {};
  console.log(JSON.stringify({
    status: "ok",
    schema_version: x.schema_version,
    cache_source: c.source || "",
    cached: Boolean(c.cached),
    raw_identifier_output: safety.raw_identifier_output,
    aggregate_only: safety.aggregate_only,
  }));
});
'

pm2 env 0 | grep -E "LEADING_INDICATORS_PRECOMPUTE|NODE_ENV|PORT" || true
pm2 status seo-backend --no-color
tail -5 "$MONITORING_DIR/leading-indicators-restart-alert.log"
