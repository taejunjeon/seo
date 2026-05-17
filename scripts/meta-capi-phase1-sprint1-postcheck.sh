#!/bin/zsh
set -euo pipefail

ROOT="/Users/vibetj/coding/seo"
BASE_URL="${META_CAPI_POSTCHECK_BASE_URL:-https://att.ainativeos.net}"
SITE="${META_CAPI_POSTCHECK_SITE:-biocom}"
WINDOW="${META_CAPI_POSTCHECK_WINDOW:-7d}"
PIXEL_ID="${META_CAPI_POSTCHECK_PIXEL_ID:-1283400029487161}"
OUT_DIR="${META_CAPI_POSTCHECK_OUT_DIR:-$ROOT/data/project}"
RUN_LABEL="${META_CAPI_POSTCHECK_RUN_LABEL:-$(date '+%Y%m%d-%H%M%S')}"
CURL_TIMEOUT="${META_CAPI_POSTCHECK_TIMEOUT:-20}"
ALLOW_LIVE_SMOKE="${ALLOW_LIVE_SMOKE:-0}"
OUT_PATH="$OUT_DIR/meta-capi-phase1-sprint1-postcheck-${RUN_LABEL}.json"

mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fetch_json() {
  local name="$1"
  local url="$2"
  local out="$TMP_DIR/${name}.json"
  local status_file="$TMP_DIR/${name}.status"
  local code
  code="$(curl -sS -m "$CURL_TIMEOUT" -w '%{http_code}' -o "$out" "$url" || true)"
  printf '%s' "$code" > "$status_file"
}

post_json() {
  local name="$1"
  local url="$2"
  local payload="$3"
  local req="$TMP_DIR/${name}.request.json"
  local out="$TMP_DIR/${name}.json"
  local status_file="$TMP_DIR/${name}.status"
  local code
  printf '%s' "$payload" > "$req"
  code="$(curl -sS -m "$CURL_TIMEOUT" -w '%{http_code}' -o "$out" \
    -H 'Content-Type: application/json' \
    --data-binary "@$req" \
    "$url" || true)"
  printf '%s' "$code" > "$status_file"
}

echo "[postcheck] read-only checks start: base=$BASE_URL site=$SITE window=$WINDOW pixel=$PIXEL_ID"

fetch_json "health" "$BASE_URL/health"
fetch_json "funnel" "$BASE_URL/api/attribution/funnel-health?site=$SITE&window=$WINDOW"
fetch_json "capi_1d" "$BASE_URL/api/meta/capi/log?scope=recent_operational&pixel_id=$PIXEL_ID&since_days=1&response_status_class=success&limit=1"
fetch_json "capi_7d" "$BASE_URL/api/meta/capi/log?scope=recent_operational&pixel_id=$PIXEL_ID&since_days=7&response_status_class=success&limit=1"

if [ "$ALLOW_LIVE_SMOKE" = "1" ]; then
  echo "[postcheck] live smoke enabled: diagnostic insert <=2 rows"
  CHECKOUT_ID="postcheck_${RUN_LABEL}"
  post_json "smoke_payment_page_seen" "$BASE_URL/api/attribution/payment-page-seen" "{
    \"source\":\"biocom_imweb\",
    \"site\":\"biocom\",
    \"checkoutId\":\"${CHECKOUT_ID}_page_seen\",
    \"landing\":\"https://biocom.kr/shop_payment/?postcheck=phase1_sprint1\",
    \"metadata\":{
      \"semantic_touchpoint\":\"payment_page_seen\",
      \"is_purchase_candidate\":false,
      \"meta_purchase_candidate\":false,
      \"confirmed_bridge_candidate\":false,
      \"postcheck_run_id\":\"${RUN_LABEL}\"
    }
  }"
  post_json "smoke_payment_success_downgrade" "$BASE_URL/api/attribution/payment-success" "{
    \"source\":\"biocom_imweb\",
    \"site\":\"biocom\",
    \"checkoutId\":\"${CHECKOUT_ID}_downgrade\",
    \"landing\":\"https://biocom.kr/shop_payment/?postcheck=phase1_sprint1\",
    \"metadata\":{
      \"semantic_touchpoint\":\"payment_success\",
      \"postcheck_run_id\":\"${RUN_LABEL}\"
    }
  }"
else
  printf '000' > "$TMP_DIR/smoke_payment_page_seen.status"
  printf '{}' > "$TMP_DIR/smoke_payment_page_seen.json"
  printf '000' > "$TMP_DIR/smoke_payment_success_downgrade.status"
  printf '{}' > "$TMP_DIR/smoke_payment_success_downgrade.json"
fi

node - "$TMP_DIR" "$OUT_PATH" "$BASE_URL" "$SITE" "$WINDOW" "$PIXEL_ID" "$ALLOW_LIVE_SMOKE" "$RUN_LABEL" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [tmpDir, outPath, baseUrl, site, windowKey, pixelId, allowLiveSmoke, runLabel] = process.argv.slice(2);

const readStatus = (name) => {
  const raw = fs.readFileSync(path.join(tmpDir, `${name}.status`), "utf8").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readBody = (name) => {
  const file = path.join(tmpDir, `${name}.json`);
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { parse_error: true };
  }
};

const read = (name) => ({
  http_status: readStatus(name),
  body: readBody(name),
});

const nowKst = () => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date()).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
};

const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const array = (value) => (Array.isArray(value) ? value : []);
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const health = read("health");
const funnel = read("funnel");
const capi1d = read("capi_1d");
const capi7d = read("capi_7d");
const smokePageSeen = read("smoke_payment_page_seen");
const smokeDowngrade = read("smoke_payment_success_downgrade");

const f = object(funnel.body);
const metricContract = object(f.metric_contract);
const metrics = object(metricContract.metrics);
const guardrails = object(f.guardrails);
const metaBreakdown = object(f.meta_capi_breakdown);
const capiHealth = object(f.capi_health);
const purchaseQueue = object(f.purchase_eligibility_queue);
const actionQueue = array(f.action_queue);
const confirmedNoCapi = actionQueue.find((item) => item && item.key === "confirmed_but_no_capi_send") || null;
const capi7Summary = object(object(capi7d.body).summary);
const capi1Summary = object(object(capi1d.body).summary);

const pageSeenSmokeExpected = allowLiveSmoke === "1";
const smokePageSeenBody = object(smokePageSeen.body);
const smokeDowngradeBody = object(smokeDowngrade.body);

const checks = [
  {
    key: "health_200",
    label: "VM Cloud backend health 200",
    pass: health.http_status === 200 && object(health.body).status === "ok",
    observed: { http_status: health.http_status, status: object(health.body).status ?? null },
    required: true,
  },
  {
    key: "funnel_health_200",
    label: "funnel-health API 200",
    pass: funnel.http_status === 200 && f.ok === true,
    observed: { http_status: funnel.http_status, ok: f.ok === true },
    required: true,
  },
  {
    key: "site_pixel_filter",
    label: "site/pixel filter applied",
    pass: f.site === site && array(metricContract.pixel_ids).includes(pixelId),
    observed: { site: f.site ?? null, pixel_ids: array(metricContract.pixel_ids) },
    required: true,
  },
  {
    key: "metric_contract_present",
    label: "metric contract exposes source/unit/window/site/pixel",
    pass: Boolean(
      metrics.meta_capi_success?.source &&
      metrics.meta_capi_success?.unit &&
      metrics.meta_capi_success?.window &&
      metrics.meta_capi_success?.site === site &&
      metrics.meta_capi_success?.pixel_id === pixelId
    ),
    observed: {
      source: metrics.meta_capi_success?.source ?? null,
      unit: metrics.meta_capi_success?.unit ?? null,
      window: metrics.meta_capi_success?.window ?? null,
      site: metrics.meta_capi_success?.site ?? null,
      pixel_id: metrics.meta_capi_success?.pixel_id ?? null,
    },
    required: true,
  },
  {
    key: "raw_identifier_output_zero",
    label: "API contract says raw identifier output is 0",
    pass: guardrails.raw_identifier_output === 0,
    observed: { raw_identifier_output: guardrails.raw_identifier_output ?? null },
    required: true,
  },
  {
    key: "platform_send_from_funnel_endpoint_zero",
    label: "funnel-health endpoint does not send to platforms",
    pass: guardrails.platform_send_from_this_endpoint === 0,
    observed: { platform_send_from_this_endpoint: guardrails.platform_send_from_this_endpoint ?? null },
    required: true,
  },
  {
    key: "operational_db_write_zero",
    label: "funnel-health endpoint does not write 운영DB",
    pass: guardrails.operational_db_write === 0,
    observed: { operational_db_write: guardrails.operational_db_write ?? null },
    required: true,
  },
  {
    key: "capi_log_readable",
    label: "Meta CAPI send log aggregate is readable",
    pass: capi7d.http_status === 200 && object(capi7d.body).ok === true,
    observed: {
      http_status: capi7d.http_status,
      total_7d: capi7Summary.total ?? null,
      success_7d: capi7Summary.success ?? null,
      failure_7d: capi7Summary.failure ?? null,
    },
    required: true,
  },
  {
    key: "capi_failures_zero_in_funnel_window",
    label: "CAPI failure count in funnel window is 0",
    pass: number(metaBreakdown.failed) === 0,
    observed: { failed: metaBreakdown.failed ?? null },
    required: false,
  },
  {
    key: "duplicate_estimate_zero",
    label: "CAPI duplicate estimate is 0",
    pass: number(metaBreakdown.duplicate_estimate) === 0,
    observed: { duplicate_estimate: metaBreakdown.duplicate_estimate ?? null },
    required: false,
  },
  {
    key: "confirmed_unsent_queue_visible",
    label: "confirmed but unsent queue is visible as aggregate",
    pass: typeof purchaseQueue.confirmed_eligible_unsent_count === "number",
    observed: {
      count: purchaseQueue.confirmed_eligible_unsent_count ?? null,
      amount_krw: purchaseQueue.confirmed_eligible_unsent_amount_krw ?? null,
      oldest_age_minutes: purchaseQueue.oldest_age_minutes ?? null,
    },
    required: true,
  },
  {
    key: "payment_page_seen_smoke",
    label: "optional payment_page_seen live smoke",
    pass: !pageSeenSmokeExpected || (
      smokePageSeen.http_status === 201 &&
      smokePageSeenBody.ok === true &&
      smokePageSeenBody.receiver === "payment_page_seen"
    ),
    observed: pageSeenSmokeExpected
      ? { http_status: smokePageSeen.http_status, ok: smokePageSeenBody.ok ?? null, receiver: smokePageSeenBody.receiver ?? null }
      : { skipped: true, reason: "ALLOW_LIVE_SMOKE=1 not set" },
    required: pageSeenSmokeExpected,
  },
  {
    key: "shop_payment_downgrade_smoke",
    label: "optional /shop_payment payment_success downgrade live smoke",
    pass: !pageSeenSmokeExpected || (
      smokeDowngrade.http_status === 202 &&
      smokeDowngradeBody.ok === true &&
      smokeDowngradeBody.downgraded === true &&
      smokeDowngradeBody.receiver === "payment_page_seen"
    ),
    observed: pageSeenSmokeExpected
      ? {
          http_status: smokeDowngrade.http_status,
          ok: smokeDowngradeBody.ok ?? null,
          downgraded: smokeDowngradeBody.downgraded ?? null,
          receiver: smokeDowngradeBody.receiver ?? null,
          reason: smokeDowngradeBody.reason ?? null,
        }
      : { skipped: true, reason: "ALLOW_LIVE_SMOKE=1 not set" },
    required: pageSeenSmokeExpected,
  },
];

const requiredFailed = checks.filter((c) => c.required && !c.pass);
const nonRequiredFailed = checks.filter((c) => !c.required && !c.pass);
const unsentCount = number(purchaseQueue.confirmed_eligible_unsent_count);
const verdict = requiredFailed.length > 0
  ? "FAIL"
  : unsentCount > 0 || nonRequiredFailed.length > 0
    ? "PASS_WITH_NOTES"
    : "PASS";

const result = {
  ok: requiredFailed.length === 0,
  verdict,
  run_label: runLabel,
  generated_at_kst: nowKst(),
  mode: pageSeenSmokeExpected ? "read_only_plus_limited_live_smoke" : "read_only",
  source_window_freshness_confidence: {
    source: "VM Cloud /health + funnel-health aggregate + Meta CAPI send log aggregate",
    window: windowKey,
    site,
    pixel_id: pixelId,
    freshness: object(f.source_summary).freshness ?? "unknown",
    checked_at_kst: f.checked_at_kst ?? null,
    confidence: requiredFailed.length === 0 ? "high_for_api_contract_medium_for_business_queue" : "low_until_failed_checks_fixed",
  },
  inputs: {
    base_url: baseUrl,
    site,
    window: windowKey,
    pixel_id: pixelId,
    allow_live_smoke: pageSeenSmokeExpected,
  },
  checks,
  live_snapshot: {
    health_status: object(health.body).status ?? null,
    funnel_cache: f.cache ?? null,
    status: f.status ?? null,
    risk_combo: f.risk_combo ?? null,
    confirmed_purchase_count: f.kpis?.confirmed_purchases?.count ?? f.kpis?.confirmed_purchase?.count ?? null,
    meta_capi_success_count: f.kpis?.meta_capi_success?.count ?? f.meta_capi_breakdown?.events_received_count ?? null,
    capi_breakdown: {
      send_attempts: metaBreakdown.send_attempts ?? null,
      events_received_count: metaBreakdown.events_received_count ?? null,
      unique_orders: metaBreakdown.unique_orders ?? null,
      duplicate_estimate: metaBreakdown.duplicate_estimate ?? null,
      failed: metaBreakdown.failed ?? null,
    },
    capi_health: {
      last_success_at_kst: capiHealth.last_success_at_kst ?? null,
      last_1h: capiHealth.last_1h ?? null,
      today: capiHealth.today ?? null,
      last_7d: capiHealth.last_7d ?? null,
      no_send_reasons: capiHealth.no_send_reasons ?? [],
    },
    purchase_eligibility_queue: {
      confirmed_eligible_unsent_count: purchaseQueue.confirmed_eligible_unsent_count ?? null,
      confirmed_eligible_unsent_amount_krw: purchaseQueue.confirmed_eligible_unsent_amount_krw ?? null,
      oldest_age_minutes: purchaseQueue.oldest_age_minutes ?? null,
    },
    confirmed_but_no_capi_action_queue: confirmedNoCapi
      ? {
          priority: confirmedNoCapi.priority,
          title: confirmedNoCapi.title,
          count: confirmedNoCapi.count,
          amount_krw: confirmedNoCapi.amount_krw,
          next_action: confirmedNoCapi.next_action,
          detail_count: array(confirmedNoCapi.details).length,
        }
      : null,
    capi_log_aggregate: {
      last_1d: {
        total: capi1Summary.total ?? null,
        success: capi1Summary.success ?? null,
        failure: capi1Summary.failure ?? null,
        duplicate_event_ids: capi1Summary.duplicateEventIds ?? null,
        duplicate_order_event_keys: capi1Summary.duplicateOrderEventKeys ?? null,
      },
      last_7d: {
        total: capi7Summary.total ?? null,
        success: capi7Summary.success ?? null,
        failure: capi7Summary.failure ?? null,
        duplicate_event_ids: capi7Summary.duplicateEventIds ?? null,
        duplicate_order_event_keys: capi7Summary.duplicateOrderEventKeys ?? null,
      },
    },
  },
  forbidden_actions_observed_from_this_script: {
    meta_capi_operational_send: 0,
    google_ads_upload: 0,
    ga4_measurement_protocol_send: 0,
    tiktok_or_naver_send: 0,
    operational_db_write: 0,
    gtm_publish: 0,
    raw_identifier_report_output: 0,
    live_diagnostic_insert_count: pageSeenSmokeExpected ? 2 : 0,
  },
  next_action_hint:
    requiredFailed.length > 0
      ? "FAIL 항목을 먼저 고친 뒤 같은 스크립트를 재실행하세요."
      : unsentCount > 0
        ? "confirmed-but-unsent queue가 남아 있으면 current/legacy/do-not-send 사유를 분류하세요. 실제 backfill send는 Red 승인 전 금지입니다."
        : "Phase1-Sprint1 post-check 기준은 통과했습니다. 24~48시간 current missing queue를 모니터링하세요.",
};

fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`[postcheck] verdict=${result.verdict}`);
console.log(`[postcheck] output=${outPath}`);
console.log(`[postcheck] health=${health.http_status} funnel=${funnel.http_status} capi_log_7d=${capi7d.http_status}`);
console.log(`[postcheck] capi_success_7d=${capi7Summary.success ?? "-"} capi_failure_7d=${capi7Summary.failure ?? "-"}`);
console.log(`[postcheck] confirmed_unsent=${purchaseQueue.confirmed_eligible_unsent_count ?? "-"} amount=${purchaseQueue.confirmed_eligible_unsent_amount_krw ?? "-"}`);
if (pageSeenSmokeExpected) {
  console.log(`[postcheck] smoke_payment_page_seen=${smokePageSeen.http_status} smoke_downgrade=${smokeDowngrade.http_status}`);
} else {
  console.log("[postcheck] live_smoke=skipped (set ALLOW_LIVE_SMOKE=1 only inside approved Yellow deploy post-check)");
}
NODE
