import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
const processedDir = path.join(repoRoot, "data", "ads_csv", "tiktok", "processed");

dotenv.config({ path: path.join(backendRoot, ".env"), quiet: true });

type TikTokReportRow = {
  dimensions?: Record<string, string>;
  metrics?: Record<string, string>;
};

type OutputRow = {
  report_date: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversion: number;
  complete_payment: number;
  value_per_complete_payment: number;
  derived_complete_payment_value: number;
  complete_payment_roas: number;
};

const DEFAULT_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversion",
  "cost_per_conversion",
  "conversion_rate",
  "complete_payment",
  "complete_payment_rate",
  "cost_per_complete_payment",
  "complete_payment_roas",
  "value_per_complete_payment",
];

const getArgValue = (name: string): string | undefined => {
  const exact = process.argv.find((arg) => arg === name);
  if (exact) {
    const next = process.argv[process.argv.indexOf(exact) + 1];
    return next && !next.startsWith("--") ? next : undefined;
  }

  const withEq = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return withEq ? withEq.slice(name.length + 1) : undefined;
};

const hasFlag = (name: string) => process.argv.includes(name);

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const readNumber = (value: string | undefined): number => {
  const normalized = value?.replace(/,/g, "") ?? "";
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((item) => item !== "")) rows.push(row);
  return rows;
};

const rowObject = (headers: string[], values: string[]) => {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = values[index] ?? "";
  });
  return record;
};

const loadCampaignNameMap = async () => {
  const names = new Map<string, string>();
  let files: string[] = [];
  try {
    files = await fs.readdir(processedDir);
  } catch {
    return names;
  }

  for (const file of files.filter((name) => name.endsWith(".csv")).sort()) {
    const text = await fs.readFile(path.join(processedDir, file), "utf8");
    const parsed = parseCsv(text.replace(/^\uFEFF/, ""));
    if (parsed.length < 2) continue;
    const headers = parsed[0] ?? [];
    for (const values of parsed.slice(1)) {
      const record = rowObject(headers, values);
      const id = record.campaign_id?.trim();
      const name = record.campaign_name?.trim();
      if (id && name) names.set(id, name);
    }
  }

  return names;
};

const toDate = (statTimeDay: string | undefined): string => (statTimeDay ?? "").slice(0, 10);

const normalizeRow = (row: TikTokReportRow): OutputRow => {
  const metrics = row.metrics ?? {};
  const completePayment = readNumber(metrics.complete_payment);
  const valuePerCompletePayment = readNumber(metrics.value_per_complete_payment);

  return {
    report_date: toDate(row.dimensions?.stat_time_day),
    campaign_id: row.dimensions?.campaign_id ?? "",
    spend: readNumber(metrics.spend),
    impressions: readNumber(metrics.impressions),
    clicks: readNumber(metrics.clicks),
    conversion: readNumber(metrics.conversion),
    complete_payment: completePayment,
    value_per_complete_payment: valuePerCompletePayment,
    derived_complete_payment_value: completePayment * valuePerCompletePayment,
    complete_payment_roas: readNumber(metrics.complete_payment_roas),
  };
};

const buildUrl = (params: {
  advertiserId: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}) => {
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/");
  url.searchParams.set("advertiser_id", params.advertiserId);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("page_size", String(params.pageSize));
  url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("dimensions", JSON.stringify(["campaign_id", "stat_time_day"]));
  url.searchParams.set("metrics", JSON.stringify(DEFAULT_METRICS));
  url.searchParams.set("start_date", params.startDate);
  url.searchParams.set("end_date", params.endDate);
  return url;
};

const fetchPage = async (input: {
  accessToken: string;
  advertiserId: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}) => {
  const url = buildUrl(input);
  const response = await fetch(url, { headers: { "Access-Token": input.accessToken } });
  const body = (await response.json()) as {
    code?: number;
    message?: string;
    request_id?: string;
    data?: { list?: TikTokReportRow[]; page_info?: { total_page?: number; total_number?: number } };
  };

  if (!response.ok || body.code !== 0) {
    throw new Error(`TikTok report request failed: http=${response.status} code=${body.code} message=${body.message}`);
  }

  return body;
};

const writeCsv = async (filePath: string, rows: OutputRow[]) => {
  const headers: Array<keyof OutputRow> = [
    "report_date",
    "campaign_id",
    "spend",
    "impressions",
    "clicks",
    "conversion",
    "complete_payment",
    "value_per_complete_payment",
    "derived_complete_payment_value",
    "complete_payment_roas",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
};

const writeProcessedDailyCsv = async (filePath: string, rows: OutputRow[], campaignNameById: Map<string, string>) => {
  const headers = [
    "report_date",
    "campaign_id",
    "campaign_name",
    "currency",
    "spend",
    "net_cost",
    "impressions",
    "destination_clicks",
    "clicks",
    "conversions",
    "purchase_count",
    "purchase_value",
    "cta_purchase_count",
    "evta_purchase_count",
    "vta_purchase_count",
    "cta_purchase_value",
    "evta_purchase_value",
    "vta_purchase_value",
    "platform_roas",
    "cta_purchase_roas",
    "evta_purchase_roas",
    "vta_purchase_roas",
    "source_file",
    "attribution_window_note",
  ];
  const sourceFile = `api/${path.basename(filePath)}`;
  const note = "TikTok Business API report/integrated/get. Attribution window assumed TikTok default click 7d / view 1d unless Ads Manager says otherwise.";
  const lines = [headers.join(",")];

  for (const row of rows) {
    const platformRoas = row.spend > 0 ? row.derived_complete_payment_value / row.spend : 0;
    lines.push([
      row.report_date,
      row.campaign_id,
      campaignNameById.get(row.campaign_id) ?? row.campaign_id,
      "KRW",
      row.spend,
      row.spend,
      row.impressions,
      row.clicks,
      row.clicks,
      row.conversion,
      row.complete_payment,
      row.derived_complete_payment_value,
      0,
      0,
      0,
      0,
      0,
      0,
      platformRoas,
      row.complete_payment_roas,
      0,
      0,
      sourceFile,
      note,
    ].map((value) => csvCell(value)).join(","));
  }

  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
};

const summarize = (rows: OutputRow[]) =>
  rows.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.conversion += row.conversion;
      acc.complete_payment += row.complete_payment;
      acc.derived_complete_payment_value += row.derived_complete_payment_value;
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversion: 0,
      complete_payment: 0,
      derived_complete_payment_value: 0,
    },
  );

const main = async () => {
  const startDate = getArgValue("--start-date") ?? "2026-03-19";
  const endDate = getArgValue("--end-date") ?? "2026-04-17";
  const advertiserId = getArgValue("--advertiser-id") ?? requireEnv("TIKTOK_ADVERTISER_ID");
  const accessToken = requireEnv("TIKTOK_BUSINESS_ACCESS_TOKEN");
  const pageSize = Number(getArgValue("--page-size") ?? "1000");
  const outDir = path.resolve(
    repoRoot,
    getArgValue("--out-dir") ?? "data/ads_csv/tiktok/api",
  );
  const writeProcessedDaily = hasFlag("--write-processed-daily");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Use YYYY-MM-DD for --start-date and --end-date");
  }

  await fs.mkdir(outDir, { recursive: true });

  const rawRows: TikTokReportRow[] = [];
  let page = 1;
  let totalPage = 1;
  let requestId = "";

  do {
    const body = await fetchPage({ accessToken, advertiserId, startDate, endDate, page, pageSize });
    requestId = body.request_id ?? requestId;
    rawRows.push(...(body.data?.list ?? []));
    totalPage = body.data?.page_info?.total_page ?? page;
    page += 1;
  } while (page <= totalPage);

  const rows = rawRows.map(normalizeRow).sort((a, b) =>
    a.report_date.localeCompare(b.report_date) || a.campaign_id.localeCompare(b.campaign_id),
  );
  const totals = summarize(rows);

  const rangeName = `${startDate.replace(/-/g, "")}_${endDate.replace(/-/g, "")}`;
  const jsonPath = path.join(outDir, `tiktok_business_api_campaign_daily_${rangeName}.json`);
  const csvPath = path.join(outDir, `tiktok_business_api_campaign_daily_${rangeName}.csv`);
  const processedDailyPath = path.join(processedDir, `${rangeName}_daily_campaign.csv`);

  await fs.writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        advertiser_id: advertiserId,
        request_id: requestId,
        start_date: startDate,
        end_date: endDate,
        data_level: "AUCTION_CAMPAIGN",
        dimensions: ["campaign_id", "stat_time_day"],
        metrics: DEFAULT_METRICS,
        rows: rows.length,
        totals,
        data: rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeCsv(csvPath, rows);
  if (writeProcessedDaily) {
    await fs.mkdir(processedDir, { recursive: true });
    await writeProcessedDailyCsv(processedDailyPath, rows, await loadCampaignNameMap());
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        advertiser_id: advertiserId,
        start_date: startDate,
        end_date: endDate,
        rows: rows.length,
        totals,
        json_path: path.relative(repoRoot, jsonPath),
        csv_path: path.relative(repoRoot, csvPath),
        processed_daily_path: writeProcessedDaily ? path.relative(repoRoot, processedDailyPath) : null,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
