#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(repoRoot, "backend", ".env"), quiet: true });
dotenv.config({ path: path.resolve(repoRoot, ".env"), quiet: true });

type Args = {
  baseUrl: string;
  site: string;
  limit: number;
  source: string;
  minutes: number;
  output: string;
  help: boolean;
};

type NpayIntentApiRow = {
  id?: string;
  source?: string;
  environment?: string;
  matchStatus?: string;
  capturedAt?: string;
  receivedAt?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  pageLocation?: string;
  pageReferrer?: string;
  npayBridgeUrlHash?: string;
  npayBridgeHost?: string;
  npayBridgePathHash?: string;
  npayBridgeObservedAt?: string;
  productIdx?: string;
  productPrice?: number | null;
  buttonSelector?: string;
  gtmEventId?: string;
  debugMode?: boolean;
  duplicateCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type NpayIntentApiResponse = {
  ok?: boolean;
  source?: string;
  generatedAt?: string;
  summary?: unknown;
  items?: NpayIntentApiRow[];
  error?: string;
  message?: string;
};

const usage = `Usage:
  cd backend
  npx tsx scripts/npay-intent-row-level-check.ts \\
    --base-url=https://att.ainativeos.net \\
    --site=biocom \\
    --source=gtm_npay_bridge_v1 \\
    --minutes=180 \\
    --limit=50

Environment:
  NPAY_INTENT_ADMIN_TOKEN  Dedicated VM Cloud row-level read token (recommended)
  AIBIO_NATIVE_ADMIN_TOKEN Legacy fallback accepted by the VM Cloud API

Output:
  Redacted JSON only. Raw gclid/gbraid/wbraid, raw URLs, and raw bridge URLs are never printed.
`;

const valueAfter = (arg: string, key: string) =>
  arg.startsWith(`--${key}=`) ? arg.slice(key.length + 3) : "";

const parsePositiveInt = (value: string, fallback: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    baseUrl: "https://att.ainativeos.net",
    site: "biocom",
    limit: 50,
    source: "",
    minutes: 0,
    output: "",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1] ?? "";
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = next;
    else if (arg.startsWith("--base-url=")) args.baseUrl = valueAfter(arg, "base-url");
    else if (arg === "--site") args.site = next;
    else if (arg.startsWith("--site=")) args.site = valueAfter(arg, "site");
    else if (arg === "--source") args.source = next;
    else if (arg.startsWith("--source=")) args.source = valueAfter(arg, "source");
    else if (arg === "--output") args.output = next;
    else if (arg.startsWith("--output=")) args.output = valueAfter(arg, "output");
    else if (arg === "--limit") args.limit = parsePositiveInt(next, 50, 200);
    else if (arg.startsWith("--limit=")) args.limit = parsePositiveInt(valueAfter(arg, "limit"), 50, 200);
    else if (arg === "--minutes") args.minutes = parsePositiveInt(next, 0, 60 * 24 * 14);
    else if (arg.startsWith("--minutes=")) args.minutes = parsePositiveInt(valueAfter(arg, "minutes"), 0, 60 * 24 * 14);

    if (
      [
        "--base-url",
        "--site",
        "--source",
        "--output",
        "--limit",
        "--minutes",
      ].includes(arg)
    ) {
      i += 1;
    }
  }

  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  return args;
};

const getToken = () =>
  process.env.NPAY_INTENT_ADMIN_TOKEN?.trim() ||
  process.env.AIBIO_NATIVE_ADMIN_TOKEN?.trim() ||
  "";

const maskTail = (value: string | undefined, tail = 8) => {
  const text = value ?? "";
  if (!text) return "";
  return text.length <= tail ? `...${text}` : `...${text.slice(-tail)}`;
};

const bool = (value: unknown) => {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
};

const parseUrlShape = (raw: string | undefined) => {
  if (!raw) return { host: "", path: "" };
  try {
    const parsed = new URL(raw, "https://biocom.kr");
    return {
      host: parsed.hostname,
      path: parsed.pathname,
    };
  } catch {
    return { host: "", path: "" };
  }
};

const toKst = (raw: string | undefined) => {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)} KST`;
};

const isWithinMinutes = (row: NpayIntentApiRow, minutes: number) => {
  if (minutes <= 0) return true;
  const raw = row.capturedAt || row.receivedAt || row.createdAt;
  if (!raw) return false;
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= minutes * 60 * 1000;
};

const redactRow = (row: NpayIntentApiRow) => {
  const pageLocation = parseUrlShape(row.pageLocation);
  const pageReferrer = parseUrlShape(row.pageReferrer);
  const hasGclid = bool(row.gclid);
  const hasGbraid = bool(row.gbraid);
  const hasWbraid = bool(row.wbraid);

  return {
    id_tail: maskTail(row.id),
    source: row.source || "",
    environment: row.environment || "",
    match_status: row.matchStatus || "",
    captured_at: row.capturedAt || "",
    captured_at_kst: toKst(row.capturedAt),
    received_at: row.receivedAt || "",
    received_at_kst: toKst(row.receivedAt),
    product_idx: row.productIdx || "",
    product_price: row.productPrice ?? null,
    has_gclid: hasGclid,
    has_gbraid: hasGbraid,
    has_wbraid: hasWbraid,
    has_google_click_id: hasGclid || hasGbraid || hasWbraid,
    utm_source_present: bool(row.utmSource),
    utm_medium_present: bool(row.utmMedium),
    utm_campaign_present: bool(row.utmCampaign),
    page_host: pageLocation.host,
    page_path: pageLocation.path,
    referrer_host: pageReferrer.host,
    referrer_path: pageReferrer.path,
    has_npay_bridge_url_hash: bool(row.npayBridgeUrlHash),
    npay_bridge_host: row.npayBridgeHost || "",
    has_npay_bridge_path_hash: bool(row.npayBridgePathHash),
    npay_bridge_observed_at: row.npayBridgeObservedAt || "",
    npay_bridge_observed_at_kst: toKst(row.npayBridgeObservedAt),
    button_selector_present: bool(row.buttonSelector),
    gtm_event_id_tail: maskTail(row.gtmEventId),
    debug_mode: row.debugMode === true,
    duplicate_count: Number(row.duplicateCount ?? 0),
  };
};

const buildSummary = (rows: ReturnType<typeof redactRow>[]) => {
  const sourceCounts: Record<string, number> = {};
  const environmentCounts: Record<string, number> = {};
  for (const row of rows) {
    sourceCounts[row.source || "unknown"] = (sourceCounts[row.source || "unknown"] ?? 0) + 1;
    environmentCounts[row.environment || "unknown"] = (environmentCounts[row.environment || "unknown"] ?? 0) + 1;
  }

  return {
    rows_returned: rows.length,
    rows_with_google_click_id: rows.filter((row) => row.has_google_click_id).length,
    rows_with_gclid: rows.filter((row) => row.has_gclid).length,
    rows_with_gbraid: rows.filter((row) => row.has_gbraid).length,
    rows_with_wbraid: rows.filter((row) => row.has_wbraid).length,
    rows_with_npay_bridge_url_hash: rows.filter((row) => row.has_npay_bridge_url_hash).length,
    rows_with_npay_bridge_path_hash: rows.filter((row) => row.has_npay_bridge_path_hash).length,
    rows_from_gtm_bridge_v1: rows.filter((row) => row.source === "gtm_npay_bridge_v1").length,
    source_counts: sourceCounts,
    environment_counts: environmentCounts,
    latest_captured_at_kst: rows[0]?.captured_at_kst || "",
  };
};

const fetchRows = async (args: Args, token: string) => {
  const url = new URL("/api/attribution/npay-intents", args.baseUrl);
  url.searchParams.set("site", args.site);
  url.searchParams.set("limit", String(args.limit));
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let body: NpayIntentApiResponse;
  try {
    body = JSON.parse(text) as NpayIntentApiResponse;
  } catch {
    throw new Error(`invalid_json_response HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  if (!response.ok || body.ok !== true) {
    const code = body.error || `http_${response.status}`;
    const message = body.message ? `: ${body.message}` : "";
    throw new Error(`${code}${message}`);
  }

  return body;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage);
    return;
  }

  const token = getToken();
  if (!token) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          error: "missing_admin_token",
          blocker_category: "blocked_access",
          message:
            "NPAY_INTENT_ADMIN_TOKEN 또는 AIBIO_NATIVE_ADMIN_TOKEN이 로컬 env에 없어 VM Cloud row-level 조회를 실행하지 않았습니다.",
          next_step:
            "VM Cloud backend에 설정된 같은 토큰 값을 로컬 backend/.env 또는 루트 .env에 NPAY_INTENT_ADMIN_TOKEN으로 저장한 뒤 다시 실행하세요.",
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const body = await fetchRows(args, token);
  const apiRows = body.items ?? [];
  const filtered = apiRows
    .filter((row) => (args.source ? row.source === args.source : true))
    .filter((row) => isWithinMinutes(row, args.minutes))
    .map(redactRow);

  const report = {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: toKst(new Date().toISOString()),
    source: {
      api: `${args.baseUrl}/api/attribution/npay-intents`,
      api_source: body.source || "",
      site: args.site,
      requested_limit: args.limit,
      source_filter: args.source || "all",
      minutes_filter: args.minutes > 0 ? args.minutes : "disabled",
      raw_identifier_output: false,
      token_value_output: false,
    },
    summary: buildSummary(filtered),
    rows: filtered,
  };

  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    fs.writeFileSync(args.output, output, "utf8");
    return;
  }
  process.stdout.write(output);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`npay-intent-row-level-check failed: ${message}\n`);
  process.exitCode = 1;
});
