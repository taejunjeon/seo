#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

APP_NAME="${APP_NAME:-seo-backend}"
export APP_NAME
BASE_DIR="${BASE_DIR:-/home/biocomkr_sns/seo/monitoring}"
STATE_FILE="${STATE_FILE:-$BASE_DIR/leading-indicators-restart-alert.state}"
LOG_FILE="${LOG_FILE:-$BASE_DIR/leading-indicators-restart-alert.log}"
LOCK_DIR="${LOCK_DIR:-$BASE_DIR/leading-indicators-restart-alert.lock}"
API_URL="${API_URL:-http://127.0.0.1:7020/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver}"

mkdir -p "$BASE_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST') SKIP already_running" >> "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

json_field() {
  node -e 'const x = JSON.parse(process.argv[1] || "{}"); const path = process.argv[2].split("."); let v = x; for (const k of path) v = v && v[k]; console.log(v == null ? "" : v);' "$1" "$2"
}

send_alert() {
  local text="$1"

  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -sS -m 5 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${text}" >/dev/null || true
  fi

  if [ -n "${LEADING_INDICATORS_ALERT_WEBHOOK:-}" ]; then
    curl -sS -m 5 -X POST -H "Content-Type: application/json" \
      -d "$(node -e 'console.log(JSON.stringify({ text: process.argv[1] }))' "$text")" \
      "$LEADING_INDICATORS_ALERT_WEBHOOK" >/dev/null || true
  fi
}

now_kst="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"
pm2_json="$(pm2 jlist)"
pm2_summary="$(printf '%s' "$pm2_json" | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  const list = JSON.parse(s || "[]");
  const p = list.find((item) => item.name === process.env.APP_NAME);
  if (!p) {
    console.log(JSON.stringify({ found: false }));
    return;
  }

  const env = p.pm2_env || {};
  const mon = p.monit || {};
  console.log(JSON.stringify({
    found: true,
    pm_id: Number(p.pm_id || 0),
    status: env.status || "unknown",
    restarts: Number(env.restart_time || 0),
    pid: Number(p.pid || 0),
    uptime_ms: Date.now() - Number(env.pm_uptime || Date.now()),
    memory_mb: Math.round(Number(mon.memory || 0) / 1024 / 1024),
    cpu_pct: Number(mon.cpu || 0)
  }));
});
')"

if [ "$(json_field "$pm2_summary" "found")" != "true" ]; then
  msg="[$now_kst] ALERT leading-indicators monitor: ${APP_NAME} not found in PM2"
  echo "$msg" >> "$LOG_FILE"
  send_alert "$msg"
  exit 2
fi

current_restarts="$(json_field "$pm2_summary" "restarts")"
pm_id="$(json_field "$pm2_summary" "pm_id")"
status="$(json_field "$pm2_summary" "status")"
pid="$(json_field "$pm2_summary" "pid")"
mem="$(json_field "$pm2_summary" "memory_mb")"
cpu="$(json_field "$pm2_summary" "cpu_pct")"
enabled="$(pm2 env "$pm_id" | awk -F': ' '$1 == "LEADING_INDICATORS_PRECOMPUTE_ENABLED" {print $2; exit}' || true)"
interval="$(pm2 env "$pm_id" | awk -F': ' '$1 == "LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS" {print $2; exit}' || true)"

api_summary="$(curl -sS -m 8 "$API_URL" | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  try {
    const x = JSON.parse(s || "{}");
    const c = x.cache || {};
    const safety = x.safety || {};
    console.log(JSON.stringify({
      ok: true,
      cache_source: c.source || "",
      cached: Boolean(c.cached),
      raw_identifier_output: safety.raw_identifier_output,
      aggregate_only: safety.aggregate_only
    }));
  } catch {
    console.log(JSON.stringify({ ok: false, error: "parse_failed" }));
  }
});
' 2>/dev/null || printf '{"ok":false,"error":"curl_failed"}')"

prev_restarts=""
if [ -f "$STATE_FILE" ]; then
  prev_restarts="$(awk -F= '/^restarts=/ {print $2}' "$STATE_FILE" | tail -1)"
fi

write_state() {
  cat > "$STATE_FILE" <<STATE
restarts=$current_restarts
pid=$pid
checked_at=$now_kst
STATE
}

if [ -z "$prev_restarts" ]; then
  write_state
  echo "[$now_kst] INIT restarts=$current_restarts pid=$pid status=$status mem_mb=$mem cpu_pct=$cpu enabled=${enabled:-unknown} interval=${interval:-unknown} api=$api_summary" >> "$LOG_FILE"
  exit 0
fi

if [ "$current_restarts" != "$prev_restarts" ]; then
  msg="[$now_kst] ALERT leading-indicators restart changed prev=$prev_restarts current=$current_restarts pid=$pid status=$status mem_mb=$mem cpu_pct=$cpu enabled=${enabled:-unknown} interval=${interval:-unknown} api=$api_summary"
  echo "$msg" >> "$LOG_FILE"
  send_alert "$msg"
else
  echo "[$now_kst] OK restarts=$current_restarts pid=$pid status=$status mem_mb=$mem cpu_pct=$cpu enabled=${enabled:-unknown} interval=${interval:-unknown} api=$api_summary" >> "$LOG_FILE"
fi

write_state
