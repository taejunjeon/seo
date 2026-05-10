#!/usr/bin/env tsx
/**
 * ConfirmedPurchasePrep integrated input builder.
 *
 * 무엇:
 *   - 운영DB PAYMENT_COMPLETE dry-run 결과를 primary confirmed source 로 사용한다.
 *   - VM Cloud ConfirmedPurchasePrep/Path B evidence 는 보조 증거로 붙인다.
 *
 * 왜:
 *   - VM Cloud complete_time/imweb_status blank 만으로 NPay 미결제를 판단하면 실제 결제가 누락된다.
 *   - Google Ads upload 전에는 운영DB confirmed 기준 + VM Cloud attribution evidence 를 한 입력으로 봐야 한다.
 *
 * 금지:
 *   - 운영DB write / VM Cloud write / platform send / send_candidate=true
 *   - raw email/phone/member_code 출력
 */

import fs from "node:fs";
import path from "node:path";

type CliOptions = {
  operationalInput: string;
  vmPrepInput: string;
  pathBEvidenceInput: string;
  npayActualSourceInput?: string;
  platformCostKrw?: number;
  output?: string;
  markdownOutput?: string;
};

type NpayActualSourceInput = {
  ok?: boolean;
  schema_version?: string;
  generated_at_kst?: string;
  snapshot?: {
    window_days?: number;
    rows?: number;
    total_amount_krw?: number;
    avg_amount_krw?: number;
    median_amount_krw?: number;
    filter?: Record<string, unknown>;
  };
  internal_roas_lift_estimate?: Record<string, unknown>;
};

type OperationalInput = {
  ok: boolean;
  generated_at_kst: string;
  source?: Record<string, unknown>;
  source_freshness?: Record<string, unknown>;
  window?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  candidates?: OperationalCandidate[];
};

type OperationalCandidate = {
  site: string;
  order_number: string;
  channel_order_no?: string;
  payment_method: "homepage" | "npay" | "unknown";
  payment_status: string;
  conversion_time: string;
  value: number;
  currency: string;
  vm_evidence?: VmEvidence;
  ga4_guard?: {
    status?: string;
    matched_ids?: string[];
  };
  would_be_eligible_after_approval?: boolean;
  send_candidate: false;
  block_reasons?: string[];
  include_reason?: string;
};

type VmEvidence = {
  matched?: boolean;
  matched_by?: string;
  entry_id?: string;
  source?: string;
  logged_at?: string;
  ga_session_id?: string;
  client_id?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type VmPrepInput = {
  ok: boolean;
  generated_at_kst: string;
  summary?: Record<string, unknown>;
  candidates?: VmPrepCandidate[];
};

type VmPrepCandidate = {
  order_number: string;
  channel_order_no?: string;
  payment_method?: string;
  include_reason?: string;
  conversion_time?: string;
  value?: number;
  member_code_present?: boolean;
  member_code_hash?: string;
  path_c_status?: string;
  status_guard?: Record<string, unknown>;
  block_reasons?: string[];
};

type PathBEvidenceInput = {
  schema_version?: string;
  generated_at_kst?: string;
  flow?: {
    order_no?: string;
    payment_method?: string;
    paid_status?: string;
    landing_url?: string;
  };
  path_b_controlled_traffic_result?: PathBResult;
  path_b_identity_first_canary_result?: PathBResult;
  verdict?: string;
};

type PathBResult = {
  event?: string;
  response_status?: number;
  response_ok?: boolean;
  identity_source?: string;
  would_store?: boolean;
  ledger_stored?: boolean;
  ledger_deduped?: boolean;
  ledger_rejected?: boolean;
  email_hash_present?: boolean;
  phone_hash_present?: boolean;
  order_no_hash_present?: boolean;
  client_session_present?: boolean;
  click_id_hash_present?: boolean;
  no_raw_echo_verified?: boolean;
  no_platform_send_verified?: boolean;
  platform_send_count?: number;
  source_write_flag_on?: boolean;
  row_status?: string;
};

type IntegratedCandidate = {
  site: string;
  order_number: string;
  channel_order_no: string;
  payment_method: "homepage" | "npay" | "unknown";
  primary_confirmed_source: "operational_db_payment_complete";
  include_reason: string;
  conversion_time: string;
  value: number;
  currency: string;
  vm_order_evidence: {
    matched: boolean;
    matched_by: string;
    source: string;
    logged_at: string;
    client_id_present: boolean;
    ga_session_id_present: boolean;
    google_click_id_present: boolean;
    meta_click_id_present: boolean;
    utm_source: string;
    utm_campaign: string;
  };
  vm_prep_evidence: {
    matched: boolean;
    path_c_status: string;
    member_code_hash_present: boolean;
    status_guard: Record<string, unknown>;
  };
  path_b_evidence: {
    matched_same_order: boolean;
    recent_controlled_full_bridge: boolean;
    email_hash_present: boolean;
    phone_hash_present: boolean;
    order_no_hash_present: boolean;
    client_session_present: boolean;
    click_id_hash_present: boolean;
    no_raw_echo_verified: boolean;
    no_platform_send_verified: boolean;
    verdict: string;
  };
  guard: {
    npay_actual_confirmed_allowed: boolean;
    complete_time_blank_not_blocking: boolean;
    imweb_status_blank_not_blocking: boolean;
    click_only_blocked_by_construction: boolean;
    controlled_or_unpaid_excluded: boolean;
  };
  send_candidate: false;
  actual_send_candidate: false;
  upload_candidate: false;
  block_reasons: string[];
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = (): CliOptions => ({
  operationalInput: path.resolve(
    argValue("operational-input") ??
      path.join(__dirname, "..", "..", "data", "bi-confirmed-purchase-operational-dry-run-20260510.json"),
  ),
  vmPrepInput: path.resolve(
    argValue("vm-prep-input") ??
      path.join(__dirname, "..", "..", "data", "confirmed-purchase-prep-recalc-20260510.json"),
  ),
  pathBEvidenceInput: path.resolve(
    argValue("path-b-evidence") ??
      path.join(__dirname, "..", "..", "data", "path-b-real-paid-click-actual-order-preview-result-20260510.json"),
  ),
  npayActualSourceInput: argValue("npay-actual-source-input")
    ? path.resolve(argValue("npay-actual-source-input")!)
    : undefined,
  platformCostKrw: argValue("platform-cost-krw") ? Number(argValue("platform-cost-krw")) : undefined,
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
});

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const countBy = <T>(items: T[], pick: (item: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = pick(item) || "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
};

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const str = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const asPaymentMethod = (value: string): "homepage" | "npay" | "unknown" => {
  if (value === "homepage") return "homepage";
  if (value === "npay") return "npay";
  return "unknown";
};

const pathBResult = (input: PathBEvidenceInput): PathBResult =>
  input.path_b_identity_first_canary_result ?? input.path_b_controlled_traffic_result ?? {};

const normalizeBlockReasons = (candidate: OperationalCandidate): string[] => {
  const reasons = new Set(candidate.block_reasons ?? []);
  reasons.add("read_only_integrated_input");
  reasons.add("approval_required");
  reasons.add("send_candidate_forced_false");
  if (candidate.payment_method === "npay") reasons.add("npay_actual_confirmed_from_primary_source");
  if (!candidate.vm_evidence?.gclid && !candidate.vm_evidence?.gbraid && !candidate.vm_evidence?.wbraid) {
    reasons.add("missing_google_click_id");
  }
  return Array.from(reasons).sort();
};

const buildIntegratedCandidates = (
  operational: OperationalInput,
  vmPrep: VmPrepInput,
  pathB: PathBEvidenceInput,
): IntegratedCandidate[] => {
  const prepByOrder = new Map((vmPrep.candidates ?? []).map((candidate) => [candidate.order_number, candidate]));
  const pathBOrderNo = str(pathB.flow?.order_no);
  const recentPathB = pathBResult(pathB);
  const recentControlledFullBridge =
    recentPathB.email_hash_present === true &&
    recentPathB.order_no_hash_present === true &&
    recentPathB.client_session_present === true &&
    recentPathB.click_id_hash_present === true &&
    recentPathB.no_raw_echo_verified === true &&
    recentPathB.no_platform_send_verified === true;

  return (operational.candidates ?? []).map((candidate) => {
    const vm = candidate.vm_evidence ?? {};
    const prep = prepByOrder.get(candidate.order_number);
    const googleClickPresent = Boolean(vm.gclid || vm.gbraid || vm.wbraid);
    const sameOrderPathB = Boolean(pathBOrderNo && pathBOrderNo === candidate.order_number);
    const pathBForOrder = sameOrderPathB ? recentPathB : {};
    return {
      site: candidate.site,
      order_number: candidate.order_number,
      channel_order_no: str(candidate.channel_order_no),
      payment_method: asPaymentMethod(candidate.payment_method),
      primary_confirmed_source: "operational_db_payment_complete",
      include_reason: str(candidate.include_reason),
      conversion_time: candidate.conversion_time,
      value: num(candidate.value),
      currency: candidate.currency || "KRW",
      vm_order_evidence: {
        matched: vm.matched === true,
        matched_by: str(vm.matched_by || "none"),
        source: str(vm.source),
        logged_at: str(vm.logged_at),
        client_id_present: Boolean(vm.client_id),
        ga_session_id_present: Boolean(vm.ga_session_id),
        google_click_id_present: googleClickPresent,
        meta_click_id_present: Boolean(vm.fbclid),
        utm_source: str(vm.utm_source),
        utm_campaign: str(vm.utm_campaign),
      },
      vm_prep_evidence: {
        matched: Boolean(prep),
        path_c_status: str(prep?.path_c_status || "not_in_vm_prep_input"),
        member_code_hash_present: Boolean(prep?.member_code_hash),
        status_guard: prep?.status_guard ?? {},
      },
      path_b_evidence: {
        matched_same_order: sameOrderPathB,
        recent_controlled_full_bridge: recentControlledFullBridge,
        email_hash_present: pathBForOrder.email_hash_present === true,
        phone_hash_present: pathBForOrder.phone_hash_present === true,
        order_no_hash_present: pathBForOrder.order_no_hash_present === true,
        client_session_present: pathBForOrder.client_session_present === true,
        click_id_hash_present: pathBForOrder.click_id_hash_present === true,
        no_raw_echo_verified: pathBForOrder.no_raw_echo_verified === true,
        no_platform_send_verified: pathBForOrder.no_platform_send_verified === true,
        verdict: sameOrderPathB ? str(pathB.verdict || "observed") : "not_same_order_reference_only",
      },
      guard: {
        npay_actual_confirmed_allowed: candidate.payment_method === "npay",
        complete_time_blank_not_blocking: true,
        imweb_status_blank_not_blocking: true,
        click_only_blocked_by_construction: true,
        controlled_or_unpaid_excluded: true,
      },
      send_candidate: false,
      actual_send_candidate: false,
      upload_candidate: false,
      block_reasons: normalizeBlockReasons(candidate),
    };
  });
};

const renderMarkdown = (payload: ReturnType<typeof buildPayload>): string => {
  const summary = payload.summary;
  const lines: string[] = [];
  lines.push("# ConfirmedPurchasePrep 통합 input dry-run (2026-05-10)");
  lines.push("");
  lines.push("## 5줄 요약");
  lines.push("");
  lines.push(
    `1. 운영DB PAYMENT_COMPLETE 기준 confirmed 주문 ${summary.integrated_candidate_count}건을 primary source로 통합했다.`,
  );
  lines.push(
    `2. NPay actual confirmed는 ${summary.npay_actual_confirmed_count}건 포함했고, complete_time/imweb_status blank는 단독 차단 사유로 쓰지 않았다.`,
  );
  lines.push(
    `3. Google click id 보유 주문은 ${summary.with_google_click_id}건이라 Google Ads upload 후보는 아직 0건이다.`,
  );
  lines.push("4. VM Cloud/Path B evidence는 보조 원장으로만 붙였고 send_candidate=false를 강제했다.");
  lines.push("5. 다음은 action/campaign별 Google Ads 플랫폼 주장값과 내부 confirmed 매출 gap 분해다.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- generated_at_kst: ${payload.generated_at_kst}`);
  lines.push(`- operational_input: ${payload.inputs.operational_input}`);
  lines.push(`- vm_prep_input: ${payload.inputs.vm_prep_input}`);
  lines.push(`- path_b_evidence_input: ${payload.inputs.path_b_evidence_input}`);
  lines.push(`- integrated_candidate_count: ${summary.integrated_candidate_count}`);
  lines.push(`- homepage_confirmed_count: ${summary.homepage_confirmed_count}`);
  lines.push(`- npay_actual_confirmed_count: ${summary.npay_actual_confirmed_count}`);
  lines.push(`- with_google_click_id: ${summary.with_google_click_id}`);
  lines.push(`- vm_order_evidence_matched_count: ${summary.vm_order_evidence_matched_count}`);
  lines.push(`- vm_prep_matched_count: ${summary.vm_prep_matched_count}`);
  lines.push(`- send_candidate: ${summary.send_candidate}`);
  lines.push(`- actual_send_candidate: ${summary.actual_send_candidate}`);
  lines.push("");
  lines.push("## Block Reason Counts");
  lines.push("");
  for (const [reason, count] of Object.entries(summary.block_reason_counts).sort()) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push("");
  lines.push("## Candidate Table");
  lines.push("");
  lines.push("| order_number | method | value | VM order | Google click | Path B same order | send | primary reason |");
  lines.push("| --- | --- | ---: | --- | --- | --- | --- | --- |");
  for (const candidate of payload.candidates) {
    lines.push(
      `| ${candidate.order_number} | ${candidate.payment_method} | ${candidate.value} | ${candidate.vm_order_evidence.matched ? "yes" : "no"} | ${candidate.vm_order_evidence.google_click_id_present ? "yes" : "no"} | ${candidate.path_b_evidence.matched_same_order ? "yes" : "no"} | ${candidate.send_candidate} | ${candidate.include_reason} |`,
    );
  }
  lines.push("");
  lines.push("## 이번 문서가 말하는 것");
  lines.push("");
  lines.push("- 실제 결제완료 판단은 운영DB PAYMENT_COMPLETE/admin-confirmed 계열을 primary로 둔다.");
  lines.push("- NPay 버튼 클릭, 결제 시작, add_payment_info는 구매완료가 아니다.");
  lines.push("- NPay actual confirmed는 포함 후보가 될 수 있으나 Google Ads upload는 계속 금지다.");
  lines.push("- VM Cloud complete_time/imweb_status blank는 단독 미결제 판단 근거가 아니다.");
  lines.push("");
  lines.push("## 이번 문서가 말하지 않는 것");
  lines.push("");
  lines.push("- Google Ads 전송 후보 승인 여부를 말하지 않는다. 현재 upload 후보는 0건이다.");
  lines.push("- Google Ads ROAS gap 원인을 확정하지 않는다. action/campaign decomposition이 다음 입력이다.");
  lines.push("- Path B evidence가 모든 운영 주문과 1:1로 연결됐다고 말하지 않는다.");
  lines.push("");
  lines.push("## 금지선 준수");
  lines.push("");
  lines.push("- 운영DB write 0");
  lines.push("- VM Cloud write 0");
  lines.push("- GTM Production publish 0");
  lines.push("- Google Ads/GA4/Meta/TikTok/Naver send 0");
  lines.push("- send_candidate=true 0");
  lines.push("");
  return `${lines.join("\n")}\n`;
};

type NpayActualSummary = {
  npay_actual_confirmed_pg_count: number;
  npay_actual_confirmed_pg_revenue_krw: number;
  internal_confirmed_revenue_current_krw: number;
  internal_confirmed_revenue_with_npay_actual_pg_krw: number;
  platform_cost_baseline_krw: number;
  internal_roas_current: number | null;
  internal_roas_with_npay_actual_pg: number | null;
  npay_actual_wire_status:
    | "wired_from_pg_snapshot"
    | "missing_snapshot_input"
    | "snapshot_zero_or_unconfigured";
  npay_actual_source_path: string | null;
};

const round4 = (value: number) => Math.round(value * 10000) / 10000;

const buildNpayActualSummary = (
  candidates: IntegratedCandidate[],
  npayActual: NpayActualSourceInput | null,
  platformCostKrwOption: number | undefined,
): NpayActualSummary => {
  const platformCost = Number.isFinite(platformCostKrwOption)
    ? Number(platformCostKrwOption)
    : 23666491.84;
  const homepageRevenueKrw = candidates
    .filter((candidate) => candidate.payment_method === "homepage")
    .reduce((acc, candidate) => acc + (Number.isFinite(candidate.value) ? candidate.value : 0), 0);
  const candidateNpayRevenueKrw = candidates
    .filter((candidate) => candidate.payment_method === "npay")
    .reduce((acc, candidate) => acc + (Number.isFinite(candidate.value) ? candidate.value : 0), 0);
  const currentRevenueKrw = homepageRevenueKrw + candidateNpayRevenueKrw;

  if (!npayActual) {
    return {
      npay_actual_confirmed_pg_count: 0,
      npay_actual_confirmed_pg_revenue_krw: 0,
      internal_confirmed_revenue_current_krw: currentRevenueKrw,
      internal_confirmed_revenue_with_npay_actual_pg_krw: currentRevenueKrw,
      platform_cost_baseline_krw: platformCost,
      internal_roas_current: platformCost > 0 ? round4(currentRevenueKrw / platformCost) : null,
      internal_roas_with_npay_actual_pg:
        platformCost > 0 ? round4(currentRevenueKrw / platformCost) : null,
      npay_actual_wire_status: "missing_snapshot_input",
      npay_actual_source_path: null,
    };
  }

  const snap = npayActual.snapshot ?? {};
  const pgCount = Number(snap.rows ?? 0);
  const pgRevenueKrw = Number(snap.total_amount_krw ?? 0);
  if (!Number.isFinite(pgCount) || pgCount <= 0 || !Number.isFinite(pgRevenueKrw) || pgRevenueKrw <= 0) {
    return {
      npay_actual_confirmed_pg_count: pgCount > 0 ? pgCount : 0,
      npay_actual_confirmed_pg_revenue_krw: pgRevenueKrw > 0 ? pgRevenueKrw : 0,
      internal_confirmed_revenue_current_krw: currentRevenueKrw,
      internal_confirmed_revenue_with_npay_actual_pg_krw: currentRevenueKrw,
      platform_cost_baseline_krw: platformCost,
      internal_roas_current: platformCost > 0 ? round4(currentRevenueKrw / platformCost) : null,
      internal_roas_with_npay_actual_pg:
        platformCost > 0 ? round4(currentRevenueKrw / platformCost) : null,
      npay_actual_wire_status: "snapshot_zero_or_unconfigured",
      npay_actual_source_path: null,
    };
  }

  const correctedRevenueKrw = homepageRevenueKrw + pgRevenueKrw;
  return {
    npay_actual_confirmed_pg_count: pgCount,
    npay_actual_confirmed_pg_revenue_krw: pgRevenueKrw,
    internal_confirmed_revenue_current_krw: currentRevenueKrw,
    internal_confirmed_revenue_with_npay_actual_pg_krw: correctedRevenueKrw,
    platform_cost_baseline_krw: platformCost,
    internal_roas_current: platformCost > 0 ? round4(currentRevenueKrw / platformCost) : null,
    internal_roas_with_npay_actual_pg:
      platformCost > 0 ? round4(correctedRevenueKrw / platformCost) : null,
    npay_actual_wire_status: "wired_from_pg_snapshot",
    npay_actual_source_path: null,
  };
};

const buildPayload = (
  options: CliOptions,
  operational: OperationalInput,
  vmPrep: VmPrepInput,
  pathB: PathBEvidenceInput,
  npayActual: NpayActualSourceInput | null,
) => {
  const candidates = buildIntegratedCandidates(operational, vmPrep, pathB);
  const blockReasonCounts: Record<string, number> = {};
  for (const candidate of candidates) {
    for (const reason of candidate.block_reasons) {
      blockReasonCounts[reason] = (blockReasonCounts[reason] ?? 0) + 1;
    }
  }
  const generatedAt = new Date();
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    generated_at_kst: `${new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(generatedAt)} KST`,
    mode: "confirmed_purchase_integrated_input_no_send",
    harness: {
      lane: "Green",
      read_only: true,
      no_send: true,
      no_write: true,
      no_platform_send: true,
    },
    inputs: {
      operational_input: path.relative(process.cwd(), options.operationalInput),
      vm_prep_input: path.relative(process.cwd(), options.vmPrepInput),
      path_b_evidence_input: path.relative(process.cwd(), options.pathBEvidenceInput),
    },
    source: {
      primary_confirmed_source: "operational_db_payment_complete",
      secondary_evidence_sources: ["vm_cloud_order_evidence", "vm_cloud_confirmed_purchase_prep", "path_b_controlled_evidence"],
      operational_source_freshness: operational.source_freshness ?? {},
      operational_window: operational.window ?? {},
      vm_prep_summary: vmPrep.summary ?? {},
    },
    summary: {
      integrated_candidate_count: candidates.length,
      homepage_confirmed_count: candidates.filter((candidate) => candidate.payment_method === "homepage").length,
      npay_actual_confirmed_count: candidates.filter((candidate) => candidate.payment_method === "npay").length,
      payment_method_counts: countBy(candidates, (candidate) => candidate.payment_method),
      with_google_click_id: candidates.filter((candidate) => candidate.vm_order_evidence.google_click_id_present).length,
      vm_order_evidence_matched_count: candidates.filter((candidate) => candidate.vm_order_evidence.matched).length,
      vm_prep_matched_count: candidates.filter((candidate) => candidate.vm_prep_evidence.matched).length,
      path_b_same_order_count: candidates.filter((candidate) => candidate.path_b_evidence.matched_same_order).length,
      ...buildNpayActualSummary(candidates, npayActual, options.platformCostKrw),
      send_candidate: 0,
      actual_send_candidate: 0,
      upload_candidate: 0,
      block_reason_counts: blockReasonCounts,
      controlled_path_b_reference: {
        order_no: pathB.flow?.order_no ?? "",
        verdict: pathB.verdict ?? "",
        click_id_hash_present: pathBResult(pathB).click_id_hash_present === true,
        email_hash_present: pathBResult(pathB).email_hash_present === true,
        order_no_hash_present: pathBResult(pathB).order_no_hash_present === true,
        client_session_present: pathBResult(pathB).client_session_present === true,
      },
    },
    candidates,
  };
};

const main = () => {
  const options = parseArgs();
  const operational = readJson<OperationalInput>(options.operationalInput);
  const vmPrep = readJson<VmPrepInput>(options.vmPrepInput);
  const pathB = readJson<PathBEvidenceInput>(options.pathBEvidenceInput);
  const npayActual = options.npayActualSourceInput
    ? readJson<NpayActualSourceInput>(options.npayActualSourceInput)
    : null;
  const payload = buildPayload(options, operational, vmPrep, pathB, npayActual);
  if (npayActual && payload.summary) {
    (payload.summary as Record<string, unknown>).npay_actual_source_path = path.relative(
      process.cwd(),
      options.npayActualSourceInput!,
    );
  }
  const jsonText = `${JSON.stringify(payload, null, 2)}\n`;

  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), jsonText);
  } else {
    process.stdout.write(jsonText);
  }

  if (options.markdownOutput) {
    fs.mkdirSync(path.dirname(path.resolve(options.markdownOutput)), { recursive: true });
    fs.writeFileSync(path.resolve(options.markdownOutput), renderMarkdown(payload));
  }
};

main();
