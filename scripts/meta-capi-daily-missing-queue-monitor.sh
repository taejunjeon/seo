#!/usr/bin/env bash
set -euo pipefail

ROOT="${META_CAPI_DAILY_MONITOR_ROOT:-/Users/vibetj/coding/seo}"
POSTCHECK_SCRIPT="$ROOT/scripts/meta-capi-phase1-sprint1-postcheck.sh"
BASE_URL="${META_CAPI_DAILY_MONITOR_BASE_URL:-https://att.ainativeos.net}"
SITE="${META_CAPI_DAILY_MONITOR_SITE:-biocom}"
WINDOW="${META_CAPI_DAILY_MONITOR_WINDOW:-1d}"
PIXEL_ID="${META_CAPI_DAILY_MONITOR_PIXEL_ID:-1283400029487161}"
OUT_DIR="${META_CAPI_DAILY_MONITOR_OUT_DIR:-$ROOT/data/project}"
RUN_LABEL="${META_CAPI_DAILY_MONITOR_RUN_LABEL:-daily-$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S')}"
POSTCHECK_TIMEOUT="${META_CAPI_DAILY_MONITOR_TIMEOUT:-25}"
SLACK_WEBHOOK_URL="${META_CAPI_DAILY_MONITOR_SLACK_WEBHOOK_URL:-}"
NOTIFY_MODE="${META_CAPI_DAILY_MONITOR_NOTIFY_MODE:-alert_only}"
MISSING_GRACE_MINUTES="${META_CAPI_DAILY_MONITOR_MIN_MISSING_AGE_MINUTES:-30}"
INCLUDE_ROAS="${META_CAPI_DAILY_MONITOR_INCLUDE_META_ROAS:-1}"
ROAS_ACCOUNT_ID="${META_CAPI_DAILY_MONITOR_META_AD_ACCOUNT_ID:-act_3138805896402376}"
ROAS_PRESETS="${META_CAPI_DAILY_MONITOR_ROAS_PRESETS:-yesterday}"
ROAS_TIMEOUT="${META_CAPI_DAILY_MONITOR_ROAS_TIMEOUT:-25}"

mkdir -p "$OUT_DIR"

if [ ! -x "$POSTCHECK_SCRIPT" ]; then
  echo "[daily-monitor] postcheck script is not executable: $POSTCHECK_SCRIPT" >&2
  exit 2
fi

export META_CAPI_POSTCHECK_BASE_URL="$BASE_URL"
export META_CAPI_POSTCHECK_SITE="$SITE"
export META_CAPI_POSTCHECK_WINDOW="$WINDOW"
export META_CAPI_POSTCHECK_PIXEL_ID="$PIXEL_ID"
export META_CAPI_POSTCHECK_OUT_DIR="$OUT_DIR"
export META_CAPI_POSTCHECK_RUN_LABEL="$RUN_LABEL"
export META_CAPI_POSTCHECK_TIMEOUT="$POSTCHECK_TIMEOUT"
export ALLOW_LIVE_SMOKE=0

"$POSTCHECK_SCRIPT"

POSTCHECK_PATH="$OUT_DIR/meta-capi-phase1-sprint1-postcheck-${RUN_LABEL}.json"
SUMMARY_PATH="$OUT_DIR/meta-capi-daily-missing-queue-monitor-${RUN_LABEL}.json"
ROAS_PATH="$OUT_DIR/meta-capi-daily-monitor-roas-${RUN_LABEL}.json"
ROAS_STATUS="skipped"

if [ "$INCLUDE_ROAS" = "1" ] && [ -n "$ROAS_ACCOUNT_ID" ]; then
  ROAS_URL="$BASE_URL/api/ads/roas-summary?account_id=$ROAS_ACCOUNT_ID&site=$SITE&presets=$ROAS_PRESETS"
  ROAS_TMP="$ROAS_PATH.tmp"
  ROAS_ERR="$ROAS_PATH.err"
  if ROAS_HTTP_STATUS="$(curl -sS -m "$ROAS_TIMEOUT" -w "%{http_code}" -o "$ROAS_TMP" "$ROAS_URL" 2>"$ROAS_ERR")"; then
    if [ "$ROAS_HTTP_STATUS" -ge 200 ] && [ "$ROAS_HTTP_STATUS" -lt 300 ]; then
      mv "$ROAS_TMP" "$ROAS_PATH"
      rm -f "$ROAS_ERR"
      ROAS_STATUS="ok"
    else
      rm -f "$ROAS_TMP"
      ROAS_STATUS="http_$ROAS_HTTP_STATUS"
    fi
  else
    rm -f "$ROAS_TMP"
    ROAS_STATUS="curl_failed"
  fi
else
  rm -f "$ROAS_PATH"
fi

node - "$POSTCHECK_PATH" "$SUMMARY_PATH" "$NOTIFY_MODE" "$MISSING_GRACE_MINUTES" "$ROAS_PATH" "$ROAS_STATUS" "$ROAS_PRESETS" <<'NODE'
const fs = require("node:fs");

const [
  postcheckPath,
  summaryPath,
  notifyMode,
  missingGraceMinutesRaw,
  roasPath,
  roasStatus,
  roasPresetsRaw,
] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(postcheckPath, "utf8"));

function readJsonIfExists(path) {
  try {
    if (!path || !fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    return {
      ok: false,
      error: "parse_failed",
      message: error && error.message ? error.message : String(error),
    };
  }
}

function formatKrw(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("ko-KR").format(Number.isFinite(numeric) ? numeric : 0);
}

function formatRoas(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}x` : "-";
}

const snapshot = report.live_snapshot || {};
const queue = snapshot.purchase_eligibility_queue || {};
const capi = snapshot.capi_log_aggregate || {};
const oneDay = capi.last_1d || {};
const action = snapshot.confirmed_but_no_capi_action_queue || null;
const roasReport = readJsonIfExists(roasPath);
const roasPreset = String(roasPresetsRaw || "yesterday").split(",").map((value) => value.trim()).filter(Boolean)[0] || "yesterday";
const roasResult = roasReport && roasReport.results && roasReport.results[roasPreset]
  ? roasReport.results[roasPreset]
  : null;
const roasSummary = roasResult && roasResult.summary ? roasResult.summary : null;
const roasMetrics = roasSummary ? {
  preset: roasPreset,
  date_range: roasResult.date_range || null,
  spend_krw: Number(roasSummary.spend || 0),
  internal_attributed_revenue_krw: Number(roasSummary.attributedRevenue || 0),
  internal_attributed_roas: Number.isFinite(Number(roasSummary.roas)) ? Number(roasSummary.roas) : null,
  internal_attributed_orders: Number(roasSummary.orders || 0),
  meta_ads_purchase_value_krw: Number(roasSummary.metaPurchaseValue || roasSummary.meta?.purchaseValue || 0),
  meta_ads_purchase_roas: Number.isFinite(Number(roasSummary.metaPurchaseRoas ?? roasSummary.meta?.roas))
    ? Number(roasSummary.metaPurchaseRoas ?? roasSummary.meta?.roas)
    : null,
  cache_source: roasReport.cache?.source || null,
  cache_stale: Boolean(roasReport.cache?.stale),
} : null;

const missingCount = Number(queue.confirmed_eligible_unsent_count || 0);
const missingAmount = Number(queue.confirmed_eligible_unsent_amount_krw || 0);
const missingOldestAgeMinutes = Number(queue.oldest_age_minutes);
const missingGraceMinutes = Number(missingGraceMinutesRaw || 30);
const capiFailures = Number(oneDay.failure || 0);
const duplicateEventIds = Number(oneDay.duplicate_event_ids || 0);
const duplicateOrderEventKeys = Number(oneDay.duplicate_order_event_keys || 0);
const requiredFailed = (report.checks || []).filter((check) => check.required && !check.pass);

let severity = "ok";
const reasons = [];

if (requiredFailed.length > 0) {
  severity = "critical";
  reasons.push(`required_check_failed=${requiredFailed.length}`);
}
if (missingCount > 0 && Number.isFinite(missingOldestAgeMinutes) && missingOldestAgeMinutes < missingGraceMinutes) {
  reasons.push(`confirmed_missing_capi_in_grace=${missingCount}`);
} else if (missingCount > 0) {
  severity = "critical";
  reasons.push(`confirmed_missing_capi=${missingCount}`);
}
if (capiFailures > 0) {
  severity = "critical";
  reasons.push(`capi_failures_1d=${capiFailures}`);
}
if (duplicateEventIds > 0 || duplicateOrderEventKeys > 0) {
  if (severity === "ok") severity = "watch";
  reasons.push(`duplicates_event_id=${duplicateEventIds}`);
  reasons.push(`duplicates_order_event_key=${duplicateOrderEventKeys}`);
}

const shouldNotify =
  notifyMode === "always" ||
  (notifyMode === "alert_only" && severity !== "ok");

const kst = report.generated_at_kst || "";
const source = report.source_window_freshness_confidence || {};
const title = severity === "ok"
  ? "✅ Meta CAPI daily monitor OK"
  : severity === "watch"
    ? "⚠️ Meta CAPI daily monitor WATCH"
    : "🚨 Meta CAPI daily monitor CRITICAL";

const amountText = new Intl.NumberFormat("ko-KR").format(missingAmount);
const roasText = roasMetrics ? [
  `어제 Meta ROAS: 내부귀속=${formatRoas(roasMetrics.internal_attributed_roas)} / AdsManager=${formatRoas(roasMetrics.meta_ads_purchase_roas)}`,
  `어제 광고비=₩${formatKrw(roasMetrics.spend_krw)} 내부매출=₩${formatKrw(roasMetrics.internal_attributed_revenue_krw)} Meta매출=₩${formatKrw(roasMetrics.meta_ads_purchase_value_krw)} 주문=${roasMetrics.internal_attributed_orders}건`,
] : [
  `어제 Meta ROAS: unavailable (${roasStatus || "unknown"})`,
];
const text = [
  title,
  `site=${source.site || "-"} window=${source.window || "-"} pixel=${source.pixel_id || "-"}`,
  `confirmed-but-no-CAPI=${missingCount}건 / ₩${amountText}`,
  Number.isFinite(missingOldestAgeMinutes)
    ? `missing_oldest_age=${Math.round(missingOldestAgeMinutes)}분 grace=${Math.round(missingGraceMinutes)}분`
    : null,
  `CAPI 1d success=${oneDay.success ?? "-"} failure=${oneDay.failure ?? "-"} duplicate_event_id=${duplicateEventIds}`,
  ...roasText,
  action ? `action=${action.next_action || action.title || "queue detail available"}` : "action=현재 누락 큐 없음",
  `checked_at=${kst}`,
].filter(Boolean).join("\n");

const summary = {
  ok: severity !== "critical",
  severity,
  should_notify: shouldNotify,
  notify_mode: notifyMode,
  reasons,
  source_window_freshness_confidence: source,
  metrics: {
    confirmed_but_no_capi_count: missingCount,
    confirmed_but_no_capi_amount_krw: missingAmount,
    confirmed_but_no_capi_oldest_age_minutes: Number.isFinite(missingOldestAgeMinutes) ? missingOldestAgeMinutes : null,
    confirmed_but_no_capi_grace_minutes: missingGraceMinutes,
    capi_1d_success: Number(oneDay.success || 0),
    capi_1d_failure: capiFailures,
    duplicate_event_ids: duplicateEventIds,
    duplicate_order_event_keys: duplicateOrderEventKeys,
    required_failed_checks: requiredFailed.map((check) => check.key),
  },
  meta_roas_yesterday: roasMetrics,
  meta_roas_fetch: {
    status: roasStatus,
    path: roasMetrics ? roasPath : null,
    preset: roasPreset,
    source: "VM Cloud /api/ads/roas-summary",
    caveat: "내부귀속 ROAS는 VM Cloud 결제완료 원장 기준이고, AdsManager ROAS는 Meta가 광고에 귀속한 구매값 기준이다.",
  },
  slack_text_preview: text,
  postcheck_path: postcheckPath,
  generated_at_kst: kst,
  forbidden_actions_observed_from_this_script: {
    meta_capi_operational_send: 0,
    google_ads_upload: 0,
    ga4_measurement_protocol_send: 0,
    tiktok_or_naver_send: 0,
    operational_db_write: 0,
    gtm_publish: 0,
    raw_identifier_report_output: 0,
  },
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[daily-monitor] severity=${severity} should_notify=${shouldNotify}`);
console.log(`[daily-monitor] summary=${summaryPath}`);
console.log(`[daily-monitor] missing_count=${missingCount} missing_amount_krw=${missingAmount}`);
console.log(`[daily-monitor] capi_1d_success=${oneDay.success ?? "-"} capi_1d_failure=${oneDay.failure ?? "-"}`);
NODE

SHOULD_NOTIFY="$(node -e 'const fs=require("node:fs"); const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(x.should_notify ? "1" : "0")' "$SUMMARY_PATH")"

if [ "$SHOULD_NOTIFY" = "1" ]; then
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "[daily-monitor] notification skipped: META_CAPI_DAILY_MONITOR_SLACK_WEBHOOK_URL is not set"
  else
    node - "$SUMMARY_PATH" "$SLACK_WEBHOOK_URL" <<'NODE'
const fs = require("node:fs");
const https = require("node:https");

const [summaryPath, webhookUrl] = process.argv.slice(2);
const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const payload = JSON.stringify({ text: summary.slack_text_preview });
const url = new URL(webhookUrl);

const req = https.request({
  method: "POST",
  hostname: url.hostname,
  path: `${url.pathname}${url.search}`,
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
  timeout: 5000,
}, (res) => {
  let body = "";
  res.on("data", (chunk) => { body += chunk; });
  res.on("end", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(`[daily-monitor] slack failed status=${res.statusCode} body=${body}`);
      process.exitCode = 1;
    } else {
      console.log(`[daily-monitor] slack sent status=${res.statusCode}`);
    }
  });
});

req.on("error", (error) => {
  console.error(`[daily-monitor] slack error: ${error.message}`);
  process.exitCode = 1;
});
req.write(payload);
req.end();
NODE
  fi
else
  echo "[daily-monitor] notification skipped: notify_mode=$NOTIFY_MODE and severity=ok"
fi
