#!/usr/bin/env bash
set -euo pipefail

# Phase2-Sprint5 no-send preview.
# Purpose: prepare Meta server-side intermediate conversion events without
# sending anything to Meta or changing VM Cloud/operational DB state.
#
# This script reads aggregate funnel-health data only.
# It never calls Meta CAPI, payment-decision, or write endpoints.
# It never prints raw order/payment/click/member/email/phone identifiers.

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
      response: ($raw[0] // {}),
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true
    }'
  exit 1
fi

out="${OUT_DIR%/}/meta-intermediate-capi-phase2-sprint5-preview-${RUN_LABEL}.json"

jq \
  --arg checked_at_kst "$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')" \
  --arg endpoint "$endpoint" '
  def n($x): ($x // 0 | tonumber);
  def step_count($step):
    ([.funnel[]? | select(.step == $step) | .count] | add // 0 | tonumber);
  def browser_count($stage):
    ([.browser_funnel_health.stages[]? | select(.stage == $stage) | .count] | add // 0 | tonumber);
  def checkout_split_count($path; $fallback):
    (($path // $fallback // 0) | tonumber);

  def common_payload($event_name; $semantic_touchpoint):
    {
      event_name: $event_name,
      action_source: "website",
      event_time: "runtime_unix_seconds",
      event_id: "safe_session_event_id_or_hash_only",
      event_source_url_policy: "path_bucket_only_query_removed",
      user_data_allowed_presence_only: [
        "fbp",
        "fbc",
        "client_ip_address",
        "client_user_agent"
      ],
      custom_data_policy: {
        value: "omitted_until_explicit_approval",
        currency: "omitted_until_explicit_approval",
        content_name: "forbidden_health_wellness_sensitive",
        product_name: "forbidden_health_wellness_sensitive"
      },
      metadata: {
        semantic_touchpoint: $semantic_touchpoint,
        purchase_candidate: false,
        included_in_purchase_roas: false,
        included_in_budget_roas: false,
        red_approval_required_before_send: true
      }
    };

  def event_row($event_name; $semantic_touchpoint; $available_count; $source; $unit; $route_supported; $readiness_note):
    {
      event_name: $event_name,
      semantic_touchpoint: $semantic_touchpoint,
      available_count: $available_count,
      source: $source,
      unit: $unit,
      backend_route_supported_now: $route_supported,
      status: (
        if $route_supported != true then "backend_route_not_ready"
        elif $available_count > 0 then "preview_ready_no_send"
        else "source_gap_no_send"
        end
      ),
      readiness_note_ko: $readiness_note,
      send_allowed: false,
      test_events_allowed_without_new_approval: false,
      purchase_candidate: false,
      payload_preview: common_payload($event_name; $semantic_touchpoint),
      forbidden_fields: [
        "raw_order_code",
        "raw_order_no",
        "raw_payment_key",
        "raw_member_code",
        "raw_email",
        "raw_phone",
        "raw_click_id",
        "health_related_content_name",
        "health_related_product_name"
      ],
      success_criteria_before_staged_on: [
        "Test Events에서 server source 1건 이하 수신 확인",
        "Purchase count/value/ROAS 변화 0",
        "raw identifier output 0",
        "event별 OFF rollback 가능",
        "Meta health/wellness data restriction 검토"
      ]
    };

  {
    ok: true,
    verdict: (
      if ((.guardrails.raw_identifier_output // 0) != 0
        or (.guardrails.platform_send_from_this_endpoint // 0) != 0
        or (.guardrails.operational_db_write // 0) != 0) then
        "FAIL_GUARDRAIL"
      else
        "PREVIEW_READY_NO_SEND"
      end
    ),
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
    source_snapshot: {
      landing_count: step_count("landing"),
      cart_page_view_count: step_count("add_to_cart"),
      payment_started_count: step_count("payment_started"),
      vm_payment_page_reached_count:
        checkout_split_count(.checkout_signal_split.vm_payment_page_reached.count; step_count("payment_started")),
      meta_initiate_checkout_received_count:
        checkout_split_count(.checkout_signal_split.meta_initiate_checkout_received.count; browser_count("InitiateCheckout")),
      meta_capi_initiate_checkout_candidate_count:
        checkout_split_count(.checkout_signal_split.meta_capi_initiate_checkout_candidate.count; browser_count("InitiateCheckout")),
      payment_method_selected_count: step_count("payment_method_selected"),
      confirmed_purchase_count: step_count("confirmed_purchase"),
      meta_capi_success_count: step_count("meta_capi_success"),
      browser_add_to_cart_count: browser_count("AddToCart"),
      browser_initiate_checkout_count: browser_count("InitiateCheckout"),
      browser_add_payment_info_count: browser_count("AddPaymentInfo")
    },
    events: [
      event_row(
        "AddToCart";
        "cart_page_seen_or_add_to_cart";
        (step_count("add_to_cart") + browser_count("AddToCart"));
        "VM Cloud site_landing_ledger /shop_cart + attribution_ledger metadata.eventName=AddToCart";
        "first-party cart page landing row or browser event row";
        true;
        "장바구니 담기 클릭과 장바구니 페이지 진입을 같은 Purchase로 세지 않고, 보조 전환 후보로만 본다."
      ),
      event_row(
        "InitiateCheckout";
        "checkout_or_payment_page_seen";
        checkout_split_count(.checkout_signal_split.meta_capi_initiate_checkout_candidate.count; browser_count("InitiateCheckout"));
        "VM Cloud checkout_signal_split.meta_capi_initiate_checkout_candidate";
        "deduped no-send candidate";
        true;
        "결제 페이지 도달 전체가 아니라, Meta 광고 단서가 강하고 exit/completion URL을 제외한 좁은 서버 CAPI 후보만 본다. 현재는 no-send preview다."
      ),
      event_row(
        "AddPaymentInfo";
        "payment_method_selected";
        (step_count("payment_method_selected") + browser_count("AddPaymentInfo"));
        "VM Cloud attribution_ledger metadata.eventName=AddPaymentInfo";
        "event row";
        true;
        "결제수단 선택은 현재 source가 약하면 source_gap으로 둔다. 미입금/가상계좌를 Purchase로 올리지 않는다."
      ),
      event_row(
        "CompleteRegistration";
        "registration_completed";
        0;
        "not_connected_to_VM_Cloud_for_site_yet";
        "not_available";
        false;
        "회원가입 완료는 현재 선택 site의 VM Cloud route에서 별도 중간 CAPI 후보로 닫히지 않았다. source 연결과 route allowlist가 먼저 필요하다."
      ),
      event_row(
        "Scroll50";
        "scroll_50_percent";
        0;
        "not_connected_to_VM_Cloud_for_site_yet";
        "not_available";
        false;
        "50% 스크롤은 표준 Purchase가 아니며 health/wellness 제한과 custom event 정책 검토가 먼저 필요하다."
      )
    ],
    approval_packet_summary: {
      green_done: [
        "capture source inventory",
        "no-send payload preview",
        "forbidden field list",
        "event-level staged ON gate"
      ],
      yellow_or_red_required_next: [
        "Meta Test Events smoke 1건 이하",
        "event별 staged CAPI ON",
        "VM Cloud deploy/restart if route allowlist changes are implemented"
      ],
      hard_stop_conditions: [
        "Purchase count/value changes during intermediate event smoke",
        "raw identifier appears in payload/report",
        "health/wellness sensitive content_name/product_name required",
        "event cannot be rolled back per event name"
      ]
    },
    guardrails: .guardrails,
    no_send: true,
    no_write: true,
    no_deploy: true,
    no_publish: true
  }' "$tmp" > "$out"

cat "$out"
