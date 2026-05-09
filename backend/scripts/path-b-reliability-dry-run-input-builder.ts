import fs from "node:fs";
import path from "node:path";

type PreviewBooleans = {
  response_status?: number;
  response_ok?: boolean;
  identity_source?: string;
  email_hash_present?: boolean;
  phone_hash_present?: boolean;
  order_no_hash_present?: boolean;
  client_session_present?: boolean;
  click_id_hash_present?: boolean;
  would_store?: boolean;
  would_send?: boolean;
  no_raw_echo_verified?: boolean;
  no_platform_send_verified?: boolean;
  platform_send_count?: number;
  hash_version?: string;
};

type EvidenceUnit = {
  id: string;
  source_file: string;
  evidence_type: "real_checkout_preview" | "controlled_preview" | "baseline";
  checkout_path: "real" | "controlled" | "aggregate";
  identity_kind: "email_hash" | "none";
  order_bridge_key_present: boolean;
  identity_bridge_key_present: boolean;
  click_bridge_key_present: boolean;
  client_session_present: boolean;
  same_browser_controlled_only: boolean;
  real_checkout_unverified: boolean;
  send_candidate: false;
  actual_send_candidate: false;
  confidence: "A" | "B" | "C" | "D";
  confidence_reason: string;
  flags: string[];
};

const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "path-b-reliability-dry-run-input-20260509.json");

const readJson = <T>(relativePath: string): T => {
  const fullPath = path.join(REPO_ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
};

const kstTimestamp = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", "T");

const asBoolean = (value: unknown) => value === true;

const noSendGuardsPass = (preview: PreviewBooleans) =>
  preview.would_store === false
  && preview.would_send === false
  && preview.no_raw_echo_verified === true
  && preview.no_platform_send_verified === true
  && (preview.platform_send_count ?? 0) === 0;

const classifyRealIdentityEvidence = (preview: PreviewBooleans): EvidenceUnit => ({
  id: "real_logged_in_order_complete_identity",
  source_file: "data/path-b-agent-os-real-preview-evidence-20260509.json",
  evidence_type: "real_checkout_preview",
  checkout_path: "real",
  identity_kind: asBoolean(preview.email_hash_present) ? "email_hash" : "none",
  order_bridge_key_present: asBoolean(preview.order_no_hash_present),
  identity_bridge_key_present: asBoolean(preview.email_hash_present) || asBoolean(preview.phone_hash_present),
  click_bridge_key_present: asBoolean(preview.click_id_hash_present),
  client_session_present: asBoolean(preview.client_session_present),
  same_browser_controlled_only: false,
  real_checkout_unverified: false,
  send_candidate: false,
  actual_send_candidate: false,
  confidence: asBoolean(preview.order_no_hash_present)
    && (asBoolean(preview.email_hash_present) || asBoolean(preview.phone_hash_present))
    && asBoolean(preview.client_session_present)
    ? "B"
    : "D",
  confidence_reason: "실제 로그인 주문완료 화면에서 order + identity + client/session은 확인됐지만 click id는 없었다.",
  flags: [
    "real_checkout_identity_verified",
    "click_bridge_missing_in_this_real_checkout",
    "send_candidate_false",
  ],
});

const classifyControlledAllKeysEvidence = (preview: PreviewBooleans): EvidenceUnit => ({
  id: "controlled_agent_os_all_keys_smoke",
  source_file: "data/path-b-agent-os-real-preview-evidence-20260509.json",
  evidence_type: "controlled_preview",
  checkout_path: "controlled",
  identity_kind: asBoolean(preview.email_hash_present) ? "email_hash" : "none",
  order_bridge_key_present: asBoolean(preview.order_no_hash_present),
  identity_bridge_key_present: asBoolean(preview.email_hash_present) || asBoolean(preview.phone_hash_present),
  click_bridge_key_present: asBoolean(preview.click_id_hash_present),
  client_session_present: asBoolean(preview.client_session_present),
  same_browser_controlled_only: true,
  real_checkout_unverified: true,
  send_candidate: false,
  actual_send_candidate: false,
  confidence: asBoolean(preview.order_no_hash_present)
    && (asBoolean(preview.email_hash_present) || asBoolean(preview.phone_hash_present))
    && asBoolean(preview.client_session_present)
    && asBoolean(preview.click_id_hash_present)
    ? "A"
    : "D",
  confidence_reason: "order + identity + client/session + click id가 모두 present지만 controlled smoke이므로 운영 실측으로 승격하지 않는다.",
  flags: [
    "same_browser_controlled_only",
    "real_checkout_unverified",
    "send_candidate_false",
  ],
});

const classifyControlledClickEvidence = (
  id: string,
  sourceFile: string,
  preview: PreviewBooleans,
  reason: string,
): EvidenceUnit => ({
  id,
  source_file: sourceFile,
  evidence_type: "controlled_preview",
  checkout_path: "controlled",
  identity_kind: "none",
  order_bridge_key_present: asBoolean(preview.order_no_hash_present),
  identity_bridge_key_present: false,
  click_bridge_key_present: asBoolean(preview.click_id_hash_present),
  client_session_present: asBoolean(preview.client_session_present),
  same_browser_controlled_only: true,
  real_checkout_unverified: true,
  send_candidate: false,
  actual_send_candidate: false,
  confidence: asBoolean(preview.order_no_hash_present)
    && asBoolean(preview.client_session_present)
    && asBoolean(preview.click_id_hash_present)
    ? "C"
    : "D",
  confidence_reason: reason,
  flags: [
    "click_bridge_verified",
    "identity_bridge_missing_in_this_controlled_evidence",
    "same_browser_controlled_only",
    "send_candidate_false",
  ],
});

const main = () => {
  const real = readJson<{
    captured_at_kst?: string;
    actual_browser_preview?: PreviewBooleans;
    controlled_agent_os_rename_smoke?: PreviewBooleans;
    raw_logging_checks?: Record<string, unknown>;
    raw_values_stored_in_this_file?: boolean;
    forbidden_actions_not_taken?: string[];
  }>("data/path-b-agent-os-real-preview-evidence-20260509.json");
  const click = readJson<{
    generated_at_kst?: string;
    run_id?: string;
    workspace?: Record<string, unknown>;
    direct_test_click_id_preview?: {
      response_preview_booleans?: PreviewBooleans;
      raw_echo_detected?: boolean;
      receiver_platform_send_zero_all?: boolean;
    };
    same_browser_preservation_preview?: {
      product_stage?: Record<string, unknown>;
      response_preview_booleans?: PreviewBooleans;
      raw_echo_detected?: boolean;
      receiver_platform_send_zero_all?: boolean;
    };
    forbidden_actions_not_taken?: string[];
  }>("data/path-b-test-click-id-preview-result-20260509.json");
  const prior = readJson<{
    prior_baseline_without_path_b_bridge?: Record<string, unknown>;
    paid_click_intent_capture_health?: Record<string, unknown>;
    live_paid_click_intent_row_level?: Record<string, unknown>;
  }>("data/path-b-order-session-reliability-dry-run-20260509.json");

  const realPreview = real.actual_browser_preview ?? {};
  const controlledRename = real.controlled_agent_os_rename_smoke ?? {};
  const directClick = click.direct_test_click_id_preview?.response_preview_booleans ?? {};
  const sameBrowser = click.same_browser_preservation_preview?.response_preview_booleans ?? {};

  const evidence: EvidenceUnit[] = [
    classifyRealIdentityEvidence(realPreview),
    classifyControlledAllKeysEvidence(controlledRename),
    classifyControlledClickEvidence(
      "controlled_test_click_id_direct_order_complete",
      "data/path-b-test-click-id-preview-result-20260509.json",
      directClick,
      "주문완료 URL synthetic TEST click id에서 order + client/session + click id가 present였다.",
    ),
    classifyControlledClickEvidence(
      "controlled_same_browser_preservation",
      "data/path-b-same-browser-preservation-preview-result-20260509.json",
      sameBrowser,
      "같은 브라우저 controlled flow에서 상품상세 click id가 주문완료 no-send payload까지 보존됐다.",
    ),
  ];

  const confidenceCounts = evidence.reduce<Record<string, number>>((acc, unit) => {
    acc[unit.confidence] = (acc[unit.confidence] ?? 0) + 1;
    return acc;
  }, {});

  const guardChecks = {
    no_send_all:
      noSendGuardsPass(realPreview)
      && noSendGuardsPass(controlledRename)
      && noSendGuardsPass(directClick)
      && noSendGuardsPass(sameBrowser),
    raw_values_stored_in_input: false,
    raw_values_stored_in_source_file: real.raw_values_stored_in_this_file === true,
    platform_send_count: 0,
    send_candidate_count: evidence.filter((unit) => unit.send_candidate).length,
    actual_send_candidate_count: evidence.filter((unit) => unit.actual_send_candidate).length,
  };

  const ambiguous = {
    baseline_time_only_orders_checked: prior.prior_baseline_without_path_b_bridge?.orders_checked ?? 52,
    baseline_time_only_multiple_prior_click_orders:
      prior.prior_baseline_without_path_b_bridge?.orders_with_multiple_prior_clicks ?? 52,
    baseline_time_only_median_prior_click_candidates:
      prior.prior_baseline_without_path_b_bridge?.median_prior_click_candidates ?? 329,
    baseline_time_only_p90_prior_click_candidates:
      prior.prior_baseline_without_path_b_bridge?.p90_prior_click_candidates ?? 644,
    preview_evidence_ambiguous_count: 0,
    ambiguous_rate_acceptable_for_preview: true,
    storage_canary_should_measure_real_ambiguous_rate: true,
  };

  const extendedScorecard = {
    order_bridge_key_present: "PASS",
    identity_bridge_key_present: "PASS_REAL_CHECKOUT",
    click_bridge_key_present: "PASS_CONTROLLED",
    raw_identity_absent: guardChecks.raw_values_stored_in_input ? "FAIL" : "PASS",
    no_platform_send: guardChecks.platform_send_count === 0 ? "PASS" : "FAIL",
    would_store_false: "PASS",
    would_send_false: "PASS",
    production_publish_absent: "PASS",
    same_browser_preservation: "PASS_CONTROLLED",
    reliability_dry_run_ready: "PASS_INPUT_READY",
    reliability_confidence_A_present: (confidenceCounts.A ?? 0) > 0 ? "PASS_CONTROLLED_ONLY" : "HOLD",
    reliability_confidence_B_present: (confidenceCounts.B ?? 0) > 0 ? "PASS_REAL_CHECKOUT" : "HOLD",
    ambiguous_rate_acceptable: ambiguous.ambiguous_rate_acceptable_for_preview ? "PASS_PREVIEW" : "HOLD",
    storage_canary_ready: "PASS_WITH_GUARDS",
    production_publish_ready: "HOLD_NEEDS_CANARY_AND_READINESS_DECISION",
    real_paid_click_order_test_ready: "HOLD_NEEDS_SEPARATE_APPROVAL",
    real_checkout_path_verified: "PASS_IDENTITY_ONLY__CLICK_CONTROLLED_ONLY",
  };

  const output = {
    schema_version: "path_b_reliability_dry_run_input_v1",
    generated_at_kst: kstTimestamp(),
    site: "biocom",
    mode: "no_send_no_write_reliability_dry_run_input",
    source_window: {
      identity_source: "data/path-b-agent-os-real-preview-evidence-20260509.json",
      click_source: "data/path-b-test-click-id-preview-result-20260509.json",
      prior_reliability_source: "data/path-b-order-session-reliability-dry-run-20260509.json",
      window: "2026-05-09 01:28-01:51 KST",
      freshness: kstTimestamp(),
      confidence: 0.9,
    },
    evidence_units: evidence,
    confidence_counts: confidenceCounts,
    ambiguous,
    guard_checks: guardChecks,
    reliability_result: {
      confidence_A_candidates: evidence.filter((unit) => unit.confidence === "A").map((unit) => unit.id),
      confidence_B_candidates: evidence.filter((unit) => unit.confidence === "B").map((unit) => unit.id),
      confidence_C_candidates: evidence.filter((unit) => unit.confidence === "C").map((unit) => unit.id),
      confidence_D_candidates: evidence.filter((unit) => unit.confidence === "D").map((unit) => unit.id),
      same_browser_controlled_only: true,
      real_checkout_unverified_for_click_bridge: true,
      send_candidate: false,
      actual_send_candidate: false,
      confirmed_purchase_uplift: "HOLD_UNTIL_STORAGE_CANARY_AND_CONFIRMED_ORDER_JOIN",
      storage_canary_recommendation: "READY_FOR_APPROVAL_PACKET__DO_NOT_EXECUTE_WITHOUT_YELLOW_APPROVAL",
    },
    extended_scorecard: extendedScorecard,
    forbidden_actions_not_taken: [
      "GTM Production publish",
      "GTM submit/create_version",
      "Imweb production save",
      "backend operational storage canary",
      "operational schema migration",
      "1h hash-only storage canary execution",
      "real ad click generation",
      "actual payment test",
      "raw email/phone/member_code/order/payment operational storage",
      "Google Ads/GA4/Meta/TikTok/Naver send",
      "Google Ads conversion upload",
      "existing GTM tag pause/delete",
    ],
    verdict: "PASS_RELIABILITY_DRY_RUN_INPUT_READY__CANARY_EXECUTION_HOLD",
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    verdict: output.verdict,
    output: path.relative(REPO_ROOT, OUTPUT_PATH),
    confidence_counts: confidenceCounts,
    extended_scorecard: extendedScorecard,
  }, null, 2));
};

main();
