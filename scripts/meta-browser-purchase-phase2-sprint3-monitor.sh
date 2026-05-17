#!/usr/bin/env bash
set -euo pipefail

# Phase2-Sprint3 read-only monitor.
# Purpose: separate "Server CAPI purchase is healthy" from
# "Browser Purchase is still a supplementary observation gap".
#
# This script only reads VM Cloud aggregate API responses.
# It does not call payment-decision, does not send Meta events, and does not
# print raw order/payment/click/member identifiers.

BASE_URL="${BASE_URL:-https://att.ainativeos.net}"
SITE="${SITE:-biocom}"
WINDOW="${WINDOW:-1d}"
FORCE="${FORCE:-0}"
OUT_DIR="${OUT_DIR:-data/project}"
RUN_LABEL="${RUN_LABEL:-$(TZ=Asia/Seoul date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

query="site=${SITE}&window=${WINDOW}"
if [[ "$FORCE" == "1" || "$FORCE" == "true" ]]; then
  query="${query}&force=true"
fi

endpoint="${BASE_URL%/}/api/attribution/funnel-health?${query}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -sS -m 30 "$endpoint" > "$tmp"

if ! jq -e '.ok == true' "$tmp" >/dev/null; then
  jq -n \
    --arg checked_at_kst "$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')" \
    --arg site "$SITE" \
    --arg window "$WINDOW" \
    --arg endpoint "$endpoint" \
    --slurpfile raw "$tmp" \
    '{
      ok: false,
      verdict: "FAIL_API_RESPONSE",
      checked_at_kst: $checked_at_kst,
      site: $site,
      window: $window,
      source: "VM Cloud funnel-health API",
      endpoint: $endpoint,
      blocker_category: "technical_failure",
      response: ($raw[0] // {})
    }'
  exit 1
fi

out="${OUT_DIR%/}/meta-browser-purchase-phase2-sprint3-monitor-${RUN_LABEL}.json"

jq \
  --arg checked_at_kst "$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')" \
  --arg endpoint "$endpoint" '
  def n($x): ($x // 0 | tonumber);
  def current_missing_count: ([.action_queue[]? | select(.key == "confirmed_but_no_capi_send") | .count] | add // 0 | tonumber);
  def verdict:
    if ((.guardrails.raw_identifier_output // 0) != 0
      or (.guardrails.platform_send_from_this_endpoint // 0) != 0
      or (.guardrails.operational_db_write // 0) != 0) then
      "FAIL_GUARDRAIL"
    elif (n(.kpis.confirmed_purchases.count) > 0 and n(.kpis.meta_capi_success.count) == 0) then
      "FAIL_CAPI_MISSING_WHILE_CONFIRMED_EXISTS"
    elif (current_missing_count > 0) then
      "PASS_WITH_NOTES_CURRENT_CAPI_MISSING_QUEUE"
    elif (n(.kpis.browser_purchase.count) == 0 and n(.kpis.meta_capi_success.count) > 0) then
      "PASS_WITH_NOTES_BROWSER_PURCHASE_SUPPLEMENTARY_GAP"
    elif (.payment_decision_latency.available != true) then
      "PASS_WITH_NOTES_NO_PAYMENT_DECISION_SAMPLE"
    else
      "PASS"
    end;

  {
    ok: true,
    verdict: verdict,
    checked_at_kst: $checked_at_kst,
    site: .site,
    window: .window,
    source: "VM Cloud funnel-health API",
    endpoint: $endpoint,
    cache: .cache,
    metric_contract: {
      site: .metric_contract.site,
      pixel_ids: .metric_contract.pixel_ids,
      window: .metric_contract.window,
      last_updated_at: .metric_contract.last_updated_at
    },
    counts: {
      confirmed_purchase_count: n(.kpis.confirmed_purchases.count),
      confirmed_purchase_amount_krw: n(.kpis.confirmed_purchases.amount_krw),
      meta_capi_success_count: n(.kpis.meta_capi_success.count),
      meta_capi_events_received: n(.kpis.meta_capi_success.events_received),
      browser_purchase_count: n(.kpis.browser_purchase.count),
      payment_started_count: n(.kpis.payment_started.count)
    },
    capi_health: {
      last_success_at_kst: .capi_health.last_success_at_kst,
      last_1h: .capi_health.last_1h,
      today: .capi_health.today,
      last_7d: .capi_health.last_7d
    },
    payment_decision_latency: .payment_decision_latency,
    browser_funnel_health: .browser_funnel_health,
    action_queue_summary: [
      .action_queue[]? | {
        key,
        priority,
        title,
        count,
        amount_krw,
        next_action,
        explanation_ko
      }
    ],
    guardrails: .guardrails,
    interpretation_ko: (
      if verdict == "FAIL_GUARDRAIL" then
        "읽기 전용 모니터 응답에서 금지선 위반 신호가 보여 즉시 원인 확인이 필요합니다."
      elif verdict == "FAIL_CAPI_MISSING_WHILE_CONFIRMED_EXISTS" then
        "결제완료는 있는데 Server CAPI 성공이 0입니다. Meta 학습 신호 누락 가능성이 큽니다."
      elif verdict == "PASS_WITH_NOTES_CURRENT_CAPI_MISSING_QUEUE" then
        "Server CAPI는 대체로 살아 있지만, 현재 window에 아직 send log가 없는 결제완료 큐가 남아 있습니다."
      elif verdict == "PASS_WITH_NOTES_BROWSER_PURCHASE_SUPPLEMENTARY_GAP" then
        "Server CAPI는 정상 전송 중이고 Browser Purchase만 보조 신호로 비어 있습니다. 운영 매출 누락과 분리해서 봐야 합니다."
      elif verdict == "PASS_WITH_NOTES_NO_PAYMENT_DECISION_SAMPLE" then
        "현재 backend restart 이후 payment-decision 샘플이 없습니다. 다음 실제 결제 시 자동으로 채워집니다."
      else
        "Server CAPI, Browser Purchase 보조 관찰, payment-decision 지표가 모두 정상 범위입니다."
      end
    ),
    no_send: true,
    no_write: true,
    no_deploy: true,
    no_publish: true
  }' "$tmp" > "$out"

cat "$out"
