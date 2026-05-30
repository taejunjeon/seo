/**
 * Naver Search Ad Bizmoney cost preview.
 *
 * Read-only by default and by design:
 * - No SQLite write.
 * - No Naver Ads state change.
 * - No conversion send/upload.
 * - No raw secret output.
 */
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import "../src/env";

const BASE_URL = "https://api.searchad.naver.com";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = "naver-bizmoney-cost-preview-v1-20260525";

type CliOptions = {
  site: string;
  envPrefix: string;
  since: string;
  until: string;
  json: boolean;
  output: string;
};

type Credentials = {
  accessKey: string;
  customerId: string;
  secretKey: string;
};

type BizmoneyExhaustRow = {
  activityCd?: number;
  campaignTp?: number;
  customerId?: number;
  prodInfoCd?: string;
  settleDt?: number;
  useNonrefundableAmt?: number;
  useRefundableAmt?: number;
};

type CostAggregate = {
  campaign_tp: number;
  campaign_type_label: string;
  product_code: string;
  cost_krw: number;
  raw_rows: number;
};

const campaignTypeLabel = (campaignTp: number): string => {
  switch (campaignTp) {
    case 1:
      return "WEB_SITE";
    case 2:
      return "SHOPPING";
    case 3:
      return "POWER_CONTENTS";
    case 4:
      return "BRAND_SEARCH";
    case 0:
      return "NON_SEARCH_OR_OTHER";
    default:
      return "UNKNOWN";
  }
};

const usage = () => `
Usage:
  npx tsx scripts/naver-bizmoney-cost-preview.ts [options]

Options:
  --site=biocom                   Report label. Default: biocom
  --env-prefix=BIOCOM_NAVER_ADS   Env prefix. Reads *_CUSTOMER_ID, *_ACCESS or *_ACESS, *_SECRET_KEY
  --since=YYYY-MM-DD              Inclusive KST date. Default: KST yesterday - 33 days
  --until=YYYY-MM-DD              Inclusive KST date. Default: KST yesterday
  --output=path                   Write JSON output to path
  --json                          Print JSON only
  --help                          Show help
`;

const formatKstDateFromTodayOffset = (offsetDays: number): string => {
  return new Date(Date.now() + KST_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
};

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const compactDate = (value: string): string => value.replaceAll("-", "");

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    site: "biocom",
    envPrefix: "BIOCOM_NAVER_ADS",
    since: formatKstDateFromTodayOffset(34),
    until: formatKstDateFromTodayOffset(1),
    json: false,
    output: "",
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--site=")) {
      options.site = arg.slice("--site=".length).trim() || options.site;
      continue;
    }
    if (arg.startsWith("--env-prefix=")) {
      options.envPrefix = arg.slice("--env-prefix=".length).trim() || options.envPrefix;
      continue;
    }
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!isDateString(options.since) || !isDateString(options.until)) {
    throw new Error("since/until must be YYYY-MM-DD");
  }
  if (options.since > options.until) {
    throw new Error("since must be earlier than or equal to until");
  }

  return options;
};

const readCredentials = (envPrefix: string): Credentials => {
  const accessKey =
    process.env[`${envPrefix}_ACCESS`] ??
    process.env[`${envPrefix}_ACESS`] ??
    "";
  const customerId = process.env[`${envPrefix}_CUSTOMER_ID`] ?? "";
  const secretKey = process.env[`${envPrefix}_SECRET_KEY`] ?? "";

  if (!accessKey || !customerId || !secretKey) {
    throw new Error(`${envPrefix}_CUSTOMER_ID / ${envPrefix}_ACCESS(or ACESS) / ${envPrefix}_SECRET_KEY missing`);
  }

  return { accessKey, customerId, secretKey };
};

const buildHeaders = (
  credentials: Credentials,
  method: "GET",
  uri: string,
): Record<string, string> => {
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", credentials.secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest("base64");

  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": credentials.accessKey,
    "X-Customer": credentials.customerId,
    "X-Signature": signature,
    "Content-Type": "application/json; charset=UTF-8",
  };
};

const callNaverSearchAd = async <T>(
  credentials: Credentials,
  uri: string,
  query: Record<string, string>,
): Promise<T> => {
  const queryString = new URLSearchParams(query).toString();
  const response = await fetch(`${BASE_URL}${uri}?${queryString}`, {
    method: "GET",
    headers: buildHeaders(credentials, "GET", uri),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : null;

  if (!response.ok) {
    const error = typeof body === "object" && body !== null
      ? JSON.stringify(body).slice(0, 200)
      : String(text).slice(0, 200);
    throw new Error(`Naver Search Ad API ${uri} failed ${response.status}: ${error}`);
  }

  return body as T;
};

const normalizeRows = (body: unknown): BizmoneyExhaustRow[] => {
  if (Array.isArray(body)) return body as BizmoneyExhaustRow[];
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  for (const key of ["data", "list", "rows", "items"]) {
    if (Array.isArray(record[key])) return record[key] as BizmoneyExhaustRow[];
  }
  return [];
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const settleDateKst = (row: BizmoneyExhaustRow): string => {
  const settleDt = toNumber(row.settleDt);
  if (!settleDt) return "unknown";
  return new Date(settleDt + KST_OFFSET_MS).toISOString().slice(0, 10);
};

const rowCostKrw = (row: BizmoneyExhaustRow): number => {
  const netUse = toNumber(row.useRefundableAmt) + toNumber(row.useNonrefundableAmt);
  return -netUse;
};

const aggregateRows = (
  rows: BizmoneyExhaustRow[],
  keyFn: (row: BizmoneyExhaustRow) => string,
): CostAggregate[] => {
  const map = new Map<string, CostAggregate>();

  for (const row of rows) {
    const campaignTp = toNumber(row.campaignTp);
    const productCode = String(row.prodInfoCd ?? "unknown");
    const key = keyFn(row);
    const current = map.get(key) ?? {
      campaign_tp: campaignTp,
      campaign_type_label: campaignTypeLabel(campaignTp),
      product_code: productCode,
      cost_krw: 0,
      raw_rows: 0,
    };
    current.cost_krw += rowCostKrw(row);
    current.raw_rows += 1;
    map.set(key, current);
  }

  return [...map.values()].map((row) => ({
    ...row,
    cost_krw: Math.round(row.cost_krw),
  })).sort((a, b) => {
    if (a.campaign_tp !== b.campaign_tp) return a.campaign_tp - b.campaign_tp;
    return a.product_code.localeCompare(b.product_code);
  });
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const credentials = readCredentials(options.envPrefix);
  const uri = "/billing/bizmoney/histories/exhaust";
  const rows = normalizeRows(await callNaverSearchAd<unknown>(credentials, uri, {
    searchStartDt: compactDate(options.since),
    searchEndDt: compactDate(options.until),
  }));

  const byCampaignType = aggregateRows(rows, (row) => `${row.campaignTp ?? "unknown"}|${row.prodInfoCd ?? "unknown"}`);
  const byDateMap = new Map<string, CostAggregate & { date: string }>();
  for (const row of rows) {
    const date = settleDateKst(row);
    const campaignTp = toNumber(row.campaignTp);
    const productCode = String(row.prodInfoCd ?? "unknown");
    const key = `${date}|${campaignTp}|${productCode}`;
    const current = byDateMap.get(key) ?? {
      date,
      campaign_tp: campaignTp,
      campaign_type_label: campaignTypeLabel(campaignTp),
      product_code: productCode,
      cost_krw: 0,
      raw_rows: 0,
    };
    current.cost_krw += rowCostKrw(row);
    current.raw_rows += 1;
    byDateMap.set(key, current);
  }

  const byDate = [...byDateMap.values()].map((row) => ({
    ...row,
    cost_krw: Math.round(row.cost_krw),
  })).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.campaign_tp !== b.campaign_tp) return a.campaign_tp - b.campaign_tp;
    return a.product_code.localeCompare(b.product_code);
  });
  const brandSearch = byCampaignType.find((row) => row.campaign_tp === 4) ?? null;

  const output = {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    site: options.site,
    env_prefix: options.envPrefix,
    source: "Naver Search Ad API /billing/bizmoney/histories/exhaust",
    window: { since: options.since, until: options.until, timezone: "KST" },
    freshness: "live_api_read",
    confidence: "medium_high",
    row_count: rows.length,
    totals: {
      total_cost_krw: byCampaignType.reduce((sum, row) => sum + row.cost_krw, 0),
      brand_search_cost_krw: brandSearch?.cost_krw ?? 0,
      search_ads_ncc_cost_krw: byCampaignType
        .filter((row) => row.product_code === "NCC")
        .reduce((sum, row) => sum + row.cost_krw, 0),
    },
    by_campaign_type: byCampaignType,
    by_date_campaign_type: byDate,
    invariants_held: {
      sqlite_write: 0,
      naver_ads_state_change: 0,
      external_platform_send: 0,
      raw_secret_logged: false,
    },
    notes: [
      "Cost is calculated as -(useRefundableAmt + useNonrefundableAmt).",
      "campaignTp=4 means Brand Search in the Naver Search Ad billing model.",
      "This is a cash deduction source, not yet an amortized reporting source.",
    ],
  };

  if (options.output) {
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`);
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Naver Bizmoney cost preview (${options.site})`);
  console.log(`source: ${output.source}`);
  console.log(`window: ${options.since}..${options.until} KST`);
  console.log(`rows: ${rows.length}`);
  console.log(`total_cost_krw: ${output.totals.total_cost_krw.toLocaleString("ko-KR")}`);
  console.log(`brand_search_cost_krw: ${output.totals.brand_search_cost_krw.toLocaleString("ko-KR")}`);
  if (options.output) console.log(`output: ${options.output}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
