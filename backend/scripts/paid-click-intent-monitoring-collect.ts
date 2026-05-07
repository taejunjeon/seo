#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

type SmokeResult = {
  name: string;
  expected_status: number;
  http_status: number;
  ok: boolean;
  pass: boolean;
  reason: string;
  has_google_click_id: boolean;
  would_store: boolean;
  would_send: boolean;
  no_write_verified: boolean;
  no_platform_send_verified: boolean;
  test_click_id: boolean;
  live_candidate_after_approval: boolean;
  block_reasons: string[];
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const KST_DATE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date()).replaceAll("-", "");

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

const options = {
  baseUrl: (argValue("base-url") ?? "https://att.ainativeos.net").replace(/\/$/, ""),
  window: argValue("window") ?? "immediate",
  jsonOutput: path.resolve(argValue("json-output") ?? path.join(REPO_ROOT, "data", `paid-click-intent-monitoring-${argValue("window") ?? "immediate"}-${KST_DATE}.json`)),
  markdownOutput: path.resolve(argValue("markdown-output") ?? path.join(REPO_ROOT, "gdn", `paid-click-intent-post-publish-monitoring-result-${argValue("window") ?? "immediate"}-${KST_DATE}.md`)),
};

const endpoint = `${options.baseUrl}/api/attribution/paid-click-intent/no-send`;

const basePayload = () => ({
  site: "biocom",
  platform_hint: "google_ads",
  event_name: "PaidClickIntent",
  capture_stage: "landing",
  gclid: `TEST_GCLID_MONITOR_${options.window.toUpperCase()}_${KST_DATE}`,
  landing_url: `https://biocom.kr/?gclid=TEST_GCLID_MONITOR_${options.window.toUpperCase()}_${KST_DATE}&utm_source=google&utm_medium=cpc`,
  current_url: `https://biocom.kr/?gclid=TEST_GCLID_MONITOR_${options.window.toUpperCase()}_${KST_DATE}&utm_source=google&utm_medium=cpc`,
  referrer: "https://www.google.com/",
  client_id: `monitor.${KST_DATE}`,
  ga_session_id: `monitor_session_${KST_DATE}`,
  local_session_id: `monitor_local_${KST_DATE}`,
  captured_at: new Date().toISOString(),
});

const smokeCases = [
  {
    name: "positive_test_gclid",
    expectedStatus: 200,
    body: basePayload(),
  },
  {
    name: "missing_google_click_id",
    expectedStatus: 400,
    body: { ...basePayload(), gclid: "", gbraid: "", wbraid: "" },
  },
  {
    name: "reject_value_currency",
    expectedStatus: 400,
    body: { ...basePayload(), value: 123000, currency: "KRW" },
  },
  {
    name: "reject_order_fields",
    expectedStatus: 400,
    body: { ...basePayload(), order_number: "202605071234567", payment_key: "pay_secret", paid_at: new Date().toISOString() },
  },
  {
    name: "reject_pii",
    expectedStatus: 400,
    body: { ...basePayload(), email: "tj@example.com" },
  },
  {
    name: "reject_admin_path",
    expectedStatus: 400,
    body: { ...basePayload(), landing_url: "https://biocom.kr/admin/config/domain?gclid=TEST_GCLID_ADMIN" },
  },
  {
    name: "reject_oversized_body",
    expectedStatus: 413,
    body: { ...basePayload(), debug_blob: "x".repeat(20 * 1024) },
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, init: RequestInit, attempts = 3) => {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      lastResponse = response;
      if (![502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(500 * attempt);
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
};

const field = (body: any, key: string, fallback: any = undefined) => body?.[key] ?? body?.preview?.[key] ?? body?.guard?.[key] ?? fallback;

const blockReasonsFrom = (body: any) => {
  const values = [
    ...(Array.isArray(body?.block_reasons) ? body.block_reasons : []),
    ...(Array.isArray(body?.preview?.block_reasons) ? body.preview.block_reasons : []),
    ...(Array.isArray(body?.guard?.block_reasons) ? body.guard.block_reasons : []),
  ];
  return Array.from(new Set(values.map(String)));
};

const postJson = async (name: string, expectedStatus: number, body: unknown): Promise<SmokeResult> => {
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://biocom.kr",
      "User-Agent": `codex-paid-click-intent-monitor/${options.window}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { raw };
  }

  const wouldStore = Boolean(field(parsed, "would_store", parsed.wouldStore));
  const wouldSend = Boolean(field(parsed, "would_send", parsed.wouldSend));
  const noWrite = Boolean(field(parsed, "no_write_verified", parsed.noWriteVerified));
  const noPlatformSend = Boolean(field(parsed, "no_platform_send_verified", parsed.noPlatformSendVerified));
  const result: SmokeResult = {
    name,
    expected_status: expectedStatus,
    http_status: response.status,
    ok: Boolean(parsed.ok),
    pass: response.status === expectedStatus
      && wouldStore === false
      && wouldSend === false
      && (response.status >= 400 || (noWrite && noPlatformSend)),
    reason: String(parsed.reason ?? parsed.error ?? ""),
    has_google_click_id: Boolean(field(parsed, "has_google_click_id", false)),
    would_store: wouldStore,
    would_send: wouldSend,
    no_write_verified: noWrite,
    no_platform_send_verified: noPlatformSend,
    test_click_id: Boolean(field(parsed, "test_click_id", false)),
    live_candidate_after_approval: Boolean(field(parsed, "live_candidate_after_approval", false)),
    block_reasons: blockReasonsFrom(parsed),
  };
  return result;
};

const getHealth = async () => {
  const response = await fetchWithRetry(`${options.baseUrl}/health`, {
    headers: { "User-Agent": `codex-paid-click-intent-monitor/${options.window}` },
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return {
    http_status: response.status,
    ok: response.ok,
    body: parsed,
  };
};

const countBy = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: any) => [
  `# paid_click_intent v1 ${options.window} 모니터링 결과`,
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "상태: generated monitoring smoke",
  "Owner: gdn / paid_click_intent",
  "Do not use for: Google Ads 전환 변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB/ledger write",
  "",
  "## 10초 결론",
  "",
  payload.summary.pass
    ? "receiver health와 positive/negative smoke가 통과했다. 이 결과는 live payload validation이며, 주문 원장 fill-rate 개선 판정은 아니다."
    : "receiver smoke 중 실패가 있다. 24h/72h PASS 또는 minimal ledger write 판단 전에 실패 케이스를 먼저 분해해야 한다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["window", payload.window],
      ["base_url", payload.base_url],
      ["health_ok", payload.health.ok],
      ["smoke_pass", payload.summary.pass],
      ["smoke_count", payload.summary.smoke_count],
      ["failed_count", payload.summary.failed_count],
      ["no_write_violations", payload.summary.no_write_violations],
      ["no_platform_send_violations", payload.summary.no_platform_send_violations],
    ],
  ),
  "",
  "## Smoke 결과",
  "",
  mdTable(
    ["case", "expected", "http", "pass", "ok", "would_store", "would_send", "test_click", "live_candidate", "block_reasons"],
    payload.smoke_results.map((row: SmokeResult) => [
      row.name,
      row.expected_status,
      row.http_status,
      row.pass ? "Y" : "N",
      row.ok ? "Y" : "N",
      row.would_store ? "Y" : "N",
      row.would_send ? "Y" : "N",
      row.test_click_id ? "Y" : "N",
      row.live_candidate_after_approval ? "Y" : "N",
      row.block_reasons.join(", "),
    ]),
  ),
  "",
  "## block_reason 분포",
  "",
  mdTable(
    ["block_reason", "count"],
    Object.entries(payload.summary.block_reason_counts).map(([key, value]) => [key, value]),
  ),
  "",
  "## 아직 판정하지 않는 것",
  "",
  "- 운영 고객 트래픽 전체 receiver fill-rate.",
  "- 주문 원장 `missing_google_click_id` 감소.",
  "- Google Ads ROAS 개선.",
  "- minimal ledger write 승인 여부.",
  "",
  "## 다음 할 일",
  "",
  "- 24h/72h 정시 모니터링에서는 이 스크립트를 같은 옵션으로 재실행한다.",
  "- 실패 케이스가 있으면 GTM tag pause 또는 receiver guard 수정 여부를 판단한다.",
  "- PASS가 유지되면 minimal paid_click_intent ledger write 승인안을 검토한다.",
].join("\n");

const main = async () => {
  const health = await getHealth();
  const smokeResults: SmokeResult[] = [];
  for (const smokeCase of smokeCases) {
    smokeResults.push(await postJson(smokeCase.name, smokeCase.expectedStatus, smokeCase.body));
  }
  const failed = smokeResults.filter((row) => !row.pass);
  const payload = {
    ok: health.ok && failed.length === 0,
    generated_at: new Date().toISOString(),
    generated_at_kst: KST_NOW,
    window: options.window,
    base_url: options.baseUrl,
    endpoint,
    health,
    summary: {
      pass: health.ok && failed.length === 0,
      smoke_count: smokeResults.length,
      failed_count: failed.length,
      no_write_violations: smokeResults.filter((row) => row.would_store).length,
      no_platform_send_violations: smokeResults.filter((row) => row.would_send).length,
      block_reason_counts: countBy(smokeResults.flatMap((row) => row.block_reasons)),
    },
    smoke_results: smokeResults,
  };

  fs.mkdirSync(path.dirname(options.jsonOutput), { recursive: true });
  fs.mkdirSync(path.dirname(options.markdownOutput), { recursive: true });
  fs.writeFileSync(options.jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(options.markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(payload.summary, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
