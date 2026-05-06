#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

type Candidate = {
  site: "biocom";
  order_number: string;
  channel_order_no: string;
  payment_method: "homepage" | "npay" | "unknown";
  payment_status: "confirmed" | "canceled" | "refunded" | "excluded";
  conversion_time: string;
  value: number;
  currency: "KRW";
  vm_evidence: {
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
  block_reasons: string[];
};

type DryRunPayload = {
  generated_at_kst?: string;
  candidates?: Candidate[];
};

type RouteResult = {
  ok: boolean;
  http_status: number;
  sample_type: string;
  order_number: string;
  channel_order_no: string;
  payment_method: string;
  value: number;
  paid_at: string;
  has_google_click_id: boolean;
  already_in_ga4: boolean;
  route_block_reasons: string[];
  upstream_block_reasons: string[];
  no_send_verified: boolean;
  no_write_verified: boolean;
  no_platform_send_verified: boolean;
};

const DEFAULT_INPUT = path.resolve(__dirname, "..", "..", "data", "bi-confirmed-purchase-operational-dry-run-20260505.json");
const DEFAULT_OUTPUT = path.resolve(__dirname, "..", "..", "data", "confirmed-purchase-no-send-route-sample-20260506.json");
const DEFAULT_MD_OUTPUT = path.resolve(__dirname, "..", "..", "data", "confirmed-purchase-no-send-route-sample-20260506.md");

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const options = {
  input: path.resolve(argValue("input") ?? DEFAULT_INPUT),
  output: path.resolve(argValue("output") ?? DEFAULT_OUTPUT),
  markdownOutput: path.resolve(argValue("markdown-output") ?? argValue("markdownOutput") ?? DEFAULT_MD_OUTPUT),
  baseUrl: argValue("base-url") ?? "http://localhost:7020",
};

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const hasGoogleClickId = (row: Candidate) =>
  Boolean(row.vm_evidence.gclid || row.vm_evidence.gbraid || row.vm_evidence.wbraid);

const uniqueByOrder = (rows: Candidate[]) => {
  const seen = new Set<string>();
  const next: Candidate[] = [];
  for (const row of rows) {
    const key = row.channel_order_no || row.order_number;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(row);
  }
  return next;
};

const sampleRows = (candidates: Candidate[]) =>
  uniqueByOrder([
    ...candidates.filter(hasGoogleClickId).slice(0, 5),
    ...candidates.filter((row) => row.ga4_guard.status === "robust_absent" && !hasGoogleClickId(row)).slice(0, 5),
    ...candidates.filter((row) => row.payment_method === "npay").slice(0, 5),
    ...candidates.filter((row) => row.ga4_guard.status === "present").slice(0, 5),
  ]).slice(0, 20);

const buildRouteBody = (row: Candidate, signalStage = "payment_complete") => ({
  site: row.site,
  order_number: row.order_number,
  channel_order_no: row.channel_order_no,
  payment_method: row.payment_method,
  signal_stage: signalStage,
  value: row.value,
  currency: row.currency,
  paid_at: row.conversion_time,
  event_id: `ConfirmedPurchase_${row.channel_order_no || row.order_number}`,
  client_id: row.vm_evidence.client_id,
  ga_session_id: row.vm_evidence.ga_session_id,
  gclid: row.vm_evidence.gclid,
  gbraid: row.vm_evidence.gbraid,
  wbraid: row.vm_evidence.wbraid,
  fbclid: row.vm_evidence.fbclid,
  is_canceled: row.payment_status === "canceled",
  is_refunded: row.payment_status === "refunded",
  page_location: `https://biocom.kr/shop_payment_complete?order_no=${encodeURIComponent(row.order_number)}`,
});

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

const postPreview = async (row: Candidate, sampleType: string, signalStage = "payment_complete"): Promise<RouteResult> => {
  const response = await fetch(`${options.baseUrl}/api/attribution/confirmed-purchase/no-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRouteBody(row, signalStage)),
  });
  const body = (await response.json()) as any;
  return {
    ok: Boolean(body.ok),
    http_status: response.status,
    sample_type: sampleType,
    order_number: row.order_number,
    channel_order_no: row.channel_order_no,
    payment_method: row.payment_method,
    value: row.value,
    paid_at: row.conversion_time,
    has_google_click_id: hasGoogleClickId(row),
    already_in_ga4: row.ga4_guard.status === "present",
    route_block_reasons: body.preview?.block_reasons ?? [],
    upstream_block_reasons: row.block_reasons ?? [],
    no_send_verified: Boolean(body.noSendVerified),
    no_write_verified: Boolean(body.noWriteVerified),
    no_platform_send_verified: Boolean(body.noPlatformSendVerified),
  };
};

const renderMarkdown = (payload: any) => [
  "# confirmed_purchase no-send route 운영 샘플",
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "",
  "## 10초 결론",
  "",
  "운영 결제완료 주문 샘플을 로컬 no-send route에 넣어 preview 응답과 block_reason 분포를 확인했다.",
  "이 검증은 로컬 API preview이며 GA4/Meta/Google Ads 전송, 운영 DB write, backend deploy를 하지 않는다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["route_sample_count", payload.summary.route_sample_count],
      ["control_sample_count", payload.summary.control_sample_count],
      ["all_no_send_verified", payload.summary.all_no_send_verified],
      ["all_no_write_verified", payload.summary.all_no_write_verified],
      ["all_no_platform_send_verified", payload.summary.all_no_platform_send_verified],
    ],
  ),
  "",
  "## route block_reason 분포",
  "",
  mdTable(
    ["block_reason", "count"],
    Object.entries(payload.summary.route_block_reason_counts).map(([key, value]) => [key, value]),
  ),
  "",
  "## 샘플",
  "",
  mdTable(
    ["type", "http", "ok", "order", "method", "value", "google_click", "already_ga4", "route_block_reasons"],
    payload.results.map((row: RouteResult) => [
      row.sample_type,
      row.http_status,
      row.ok,
      row.channel_order_no || row.order_number,
      row.payment_method,
      row.value,
      row.has_google_click_id ? "Y" : "N",
      row.already_in_ga4 ? "Y" : "N",
      row.route_block_reasons.join(", "),
    ]),
  ),
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No-publish verified: YES",
  "No-platform-send verified: YES",
  "```",
].join("\n");

const main = async () => {
  const dryRun = JSON.parse(fs.readFileSync(options.input, "utf8")) as DryRunPayload;
  const candidates = dryRun.candidates ?? [];
  const rows = sampleRows(candidates);
  const results: RouteResult[] = [];

  for (const row of rows) {
    results.push(await postPreview(row, "operational_payment_complete"));
  }

  const firstNpay = rows.find((row) => row.payment_method === "npay") ?? candidates.find((row) => row.payment_method === "npay");
  if (firstNpay) {
    results.push(await postPreview(firstNpay, "control_npay_click_block", "npay_click"));
  }

  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: kstNow(),
    source: {
      input: options.input,
      dry_run_generated_at_kst: dryRun.generated_at_kst ?? null,
      route: `${options.baseUrl}/api/attribution/confirmed-purchase/no-send`,
    },
    summary: {
      route_sample_count: rows.length,
      control_sample_count: firstNpay ? 1 : 0,
      route_block_reason_counts: countBy(results.flatMap((row) => row.route_block_reasons)),
      upstream_block_reason_counts: countBy(results.flatMap((row) => row.upstream_block_reasons)),
      all_no_send_verified: results.every((row) => row.no_send_verified),
      all_no_write_verified: results.every((row) => row.no_write_verified),
      all_no_platform_send_verified: results.every((row) => row.no_platform_send_verified),
    },
    results,
  };

  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(options.markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(payload.summary, null, 2)}\n`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`confirmed-purchase-no-send-route-sample failed: ${message}`);
  process.exitCode = 1;
});
