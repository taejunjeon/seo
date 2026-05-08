#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import { lookupByMemberCode, type PaidClickIntentRow } from "../src/paidClickIntentLog";

type Candidate = {
  site: "biocom";
  order_number: string;
  channel_order_no: string;
  payment_method: "homepage" | "npay" | "unknown";
  payment_status: "confirmed" | "canceled" | "refunded" | "excluded";
  conversion_time: string;
  value: number;
  currency: "KRW";
  member_code?: string;
  vm_evidence: {
    matched?: boolean;
    matched_by?: string;
    entry_id?: string;
    ga_session_id: string;
    client_id: string;
    gclid: string;
    gbraid: string;
    wbraid: string;
    fbclid: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
  };
  ga4_guard: {
    status: "present" | "robust_absent" | "unknown";
  };
  include_reason?: string;
  send_candidate: boolean;
  block_reasons: string[];
};

type AttributionSource =
  | "vm_evidence"
  | "paid_click_intent_member_code_match"
  | "none";

type DryRun = {
  generated_at_kst?: string;
  summary?: Record<string, unknown>;
  candidates: Candidate[];
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const KST_NOW = `${new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(new Date())} KST`;

const KST_DATE = KST_NOW.slice(0, 10).replaceAll("-", "");

const options = {
  input: path.resolve(argValue("input") ?? path.join(REPO_ROOT, "data", "bi-confirmed-purchase-operational-dry-run-20260505.json")),
  jsonOutput: path.resolve(argValue("json-output") ?? path.join(REPO_ROOT, "data", `google-ads-confirmed-purchase-candidate-prep-${KST_DATE}.json`)),
  markdownOutput: path.resolve(argValue("markdown-output") ?? path.join(REPO_ROOT, "gdn", `google-ads-confirmed-purchase-candidate-prep-${KST_DATE}.md`)),
};

const hasGoogleClickId = (row: Candidate) =>
  Boolean(row.vm_evidence?.gclid || row.vm_evidence?.gbraid || row.vm_evidence?.wbraid);

const googleClickType = (row: Candidate) => {
  if (row.vm_evidence?.gclid) return "gclid";
  if (row.vm_evidence?.gbraid) return "gbraid";
  if (row.vm_evidence?.wbraid) return "wbraid";
  return "";
};

const PATH_C_LOOKUP_ENABLED = (() => {
  const v = (process.env.PATH_C_LOOKUP_ENABLED ?? "false").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
})();

const lookupPathCMatch = (memberCode?: string): PaidClickIntentRow | null => {
  if (!PATH_C_LOOKUP_ENABLED) return null;
  if (!memberCode) return null;
  try {
    const rows = lookupByMemberCode(memberCode, "biocom", 30);
    if (rows.length === 0) return null;
    return rows[0];
  } catch {
    return null;
  }
};

const pathCClickType = (row: PaidClickIntentRow | null) => {
  if (!row) return "";
  if (row.clickIdType === "gclid" || row.clickIdType === "gbraid" || row.clickIdType === "wbraid") {
    return row.clickIdType;
  }
  return "";
};

const dedupeKey = (row: Candidate) =>
  `google_ads_confirmed_purchase:${row.site}:${row.channel_order_no || row.order_number}:${row.value}:${row.conversion_time}`;

const buildUploadPreview = (
  row: Candidate,
  effectiveClickIds: { gclid: string; gbraid: string; wbraid: string },
) => ({
  conversion_action: "BI confirmed_purchase (not created / approval required)",
  order_id: row.channel_order_no || row.order_number,
  conversion_date_time: row.conversion_time,
  conversion_value: row.value,
  currency_code: row.currency,
  gclid: effectiveClickIds.gclid,
  gbraid: effectiveClickIds.gbraid,
  wbraid: effectiveClickIds.wbraid,
  restatement_value: null,
  user_identifiers: [],
  consent: "not_set_in_no_send_preview",
});

const prepRow = (row: Candidate) => {
  const vmHasClick = hasGoogleClickId(row);
  const pathCRow = vmHasClick ? null : lookupPathCMatch(row.member_code);
  const pathCType = pathCClickType(pathCRow);
  const effectiveClickIds = vmHasClick
    ? {
        gclid: row.vm_evidence?.gclid || "",
        gbraid: row.vm_evidence?.gbraid || "",
        wbraid: row.vm_evidence?.wbraid || "",
      }
    : pathCRow && pathCType
      ? {
          gclid: pathCType === "gclid" ? pathCRow.clickIdValue : "",
          gbraid: pathCType === "gbraid" ? pathCRow.clickIdValue : "",
          wbraid: pathCType === "wbraid" ? pathCRow.clickIdValue : "",
        }
      : { gclid: "", gbraid: "", wbraid: "" };
  const effectiveHasClick = Boolean(
    effectiveClickIds.gclid || effectiveClickIds.gbraid || effectiveClickIds.wbraid,
  );
  const effectiveClickType = vmHasClick ? googleClickType(row) : pathCType;
  const attributionSource: AttributionSource = vmHasClick
    ? "vm_evidence"
    : pathCRow
      ? "paid_click_intent_member_code_match"
      : "none";

  const blockReasons = new Set(row.block_reasons ?? []);
  blockReasons.add("read_only_phase");
  blockReasons.add("approval_required");
  blockReasons.add("google_ads_conversion_action_not_created");
  blockReasons.add("conversion_upload_not_approved");
  if (!effectiveHasClick) blockReasons.add("missing_google_click_id");
  if (!row.conversion_time) blockReasons.add("missing_conversion_time");
  if (!row.value || row.value <= 0) blockReasons.add("invalid_value");
  if (row.payment_status !== "confirmed") blockReasons.add(`${row.payment_status}_order`);

  const hardBlocks = [...blockReasons].filter((reason) => ![
    "read_only_phase",
    "approval_required",
    "google_ads_conversion_action_not_created",
    "conversion_upload_not_approved",
  ].includes(reason));

  return {
    site: row.site,
    order_number: row.order_number,
    channel_order_no: row.channel_order_no,
    payment_method: row.payment_method,
    member_code: row.member_code ?? "",
    include_reason: row.include_reason ?? "",
    conversion_time: row.conversion_time,
    value: row.value,
    currency: row.currency,
    google_click_id_type: effectiveClickType,
    has_google_click_id: effectiveHasClick,
    ga4_presence: row.ga4_guard?.status ?? "unknown",
    vm_matched: Boolean(row.vm_evidence?.matched),
    vm_matched_by: row.vm_evidence?.matched_by ?? "",
    attribution_source: attributionSource,
    attribution_chain_window_hours:
      pathCRow && row.conversion_time
        ? Math.max(
            0,
            (Date.parse(row.conversion_time) - Date.parse(pathCRow.receivedAt)) / 3600000,
          )
        : null,
    dedupe_key: dedupeKey(row),
    would_be_google_ads_upload_candidate_after_approval: hardBlocks.length === 0,
    send_candidate: false,
    block_reasons: [...blockReasons],
    upload_preview: buildUploadPreview(row, effectiveClickIds),
  };
};

const countBy = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "(blank)", (counts.get(value || "(blank)") ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: any) => [
  "# Google Ads confirmed_purchase 후보 준비 no-send",
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "상태: read-only candidate prep",
  "Owner: gdn / google_ads",
  "Do not use for: Google Ads conversion upload, conversion action 생성/변경, 운영 DB write",
  "",
  "## 10초 결론",
  "",
  "운영 결제완료 dry-run 후보를 Google Ads offline conversion 관점의 payload preview로 바꿨다. 실제 upload 후보를 만든 것이 아니라, 어떤 block_reason 때문에 전송을 열면 안 되는지 고정한 것이다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["payment_complete_candidates", payload.summary.payment_complete_candidates],
      ["homepage", payload.summary.payment_method_counts.homepage ?? 0],
      ["npay", payload.summary.payment_method_counts.npay ?? 0],
      ["with_google_click_id", payload.summary.with_google_click_id],
      ["after_approval_structurally_eligible", payload.summary.after_approval_structurally_eligible],
      ["send_candidate", payload.summary.send_candidate],
    ],
  ),
  "",
  "## block_reason 분포",
  "",
  mdTable(
    ["block_reason", "count"],
    Object.entries(payload.summary.block_reason_counts).map(([key, value]) => [key, value]),
  ),
  "",
  "## Google click id 있는 샘플",
  "",
  mdTable(
    ["order", "method", "value", "click_type", "ga4", "eligible_after_approval", "block_reasons"],
    payload.samples.with_google_click_id.map((row: any) => [
      row.channel_order_no || row.order_number,
      row.payment_method,
      row.value,
      row.google_click_id_type,
      row.ga4_presence,
      row.would_be_google_ads_upload_candidate_after_approval ? "Y" : "N",
      row.block_reasons.join(", "),
    ]),
  ),
  "",
  "## click id 없는 robust_absent 샘플",
  "",
  mdTable(
    ["order", "method", "value", "ga4", "block_reasons"],
    payload.samples.missing_click_id_robust_absent.map((row: any) => [
      row.channel_order_no || row.order_number,
      row.payment_method,
      row.value,
      row.ga4_presence,
      row.block_reasons.join(", "),
    ]),
  ),
  "",
  "## 다음 할 일",
  "",
  "- 24h/72h 모니터링 PASS 이후 minimal paid_click_intent ledger write를 검토한다.",
  "- 저장이 열리면 이 prep을 재실행해 `missing_google_click_id` 감소 여부를 본다.",
  "- Google Ads conversion action 생성/변경과 upload는 계속 별도 Red Lane으로 둔다.",
].join("\n");

const main = () => {
  const source = JSON.parse(fs.readFileSync(options.input, "utf8")) as DryRun;
  const rows = source.candidates.map(prepRow);
  const withGoogle = rows.filter((row) => row.has_google_click_id);
  const robustAbsentMissing = rows.filter((row) => !row.has_google_click_id && row.ga4_presence === "robust_absent");
  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: KST_NOW,
    source: {
      input: options.input,
      input_generated_at_kst: source.generated_at_kst ?? null,
      note: "input is no-send operational dry-run; this script does not call Google Ads API",
    },
    summary: {
      payment_complete_candidates: rows.length,
      payment_method_counts: countBy(rows.map((row) => row.payment_method)),
      include_reason_counts: countBy(rows.map((row) => row.include_reason)),
      ga4_presence_counts: countBy(rows.map((row) => row.ga4_presence)),
      google_click_id_type_counts: countBy(rows.map((row) => row.google_click_id_type || "missing")),
      with_google_click_id: withGoogle.length,
      attribution_source_counts: countBy(rows.map((row) => row.attribution_source)),
      with_member_code: rows.filter((row) => row.member_code).length,
      after_approval_structurally_eligible: rows.filter((row) => row.would_be_google_ads_upload_candidate_after_approval).length,
      send_candidate: 0,
      block_reason_counts: countBy(rows.flatMap((row) => row.block_reasons)),
    },
    samples: {
      with_google_click_id: withGoogle.slice(0, 20),
      missing_click_id_robust_absent: robustAbsentMissing.slice(0, 20),
    },
    rows,
  };

  fs.mkdirSync(path.dirname(options.jsonOutput), { recursive: true });
  fs.mkdirSync(path.dirname(options.markdownOutput), { recursive: true });
  fs.writeFileSync(options.jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(options.markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(payload.summary, null, 2)}\n`);
};

main();
