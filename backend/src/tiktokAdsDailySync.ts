import { promises as fs } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const API_DIR = path.join(REPO_ROOT, "data", "ads_csv", "tiktok", "api");
const PROCESSED_DIR = path.join(REPO_ROOT, "data", "ads_csv", "tiktok", "processed");

const DEFAULT_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversion",
  "cost_per_conversion",
  "conversion_rate",
  "cta_conversion",
  "vta_conversion",
  "complete_payment",
  "complete_payment_rate",
  "cost_per_complete_payment",
  "complete_payment_roas",
  "value_per_complete_payment",
  "cta_purchase",
  "evta_purchase",
  "vta_purchase",
  "cost_per_cta_purchase",
  "cost_per_evta_purchase",
  "cost_per_vta_purchase",
];

type TikTokReportRow = {
  dimensions?: Record<string, string>;
  metrics?: Record<string, string>;
};

export type TikTokDailyOutputRow = {
  report_date: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversion: number;
  cta_conversion: number;
  vta_conversion: number;
  complete_payment: number;
  value_per_complete_payment: number;
  derived_complete_payment_value: number;
  complete_payment_roas: number;
  cta_purchase: number;
  evta_purchase: number;
  vta_purchase: number;
  cost_per_cta_purchase: number;
  cost_per_evta_purchase: number;
  cost_per_vta_purchase: number;
};

export type TikTokDailyIngestResult = {
  ok: boolean;
  startDate: string;
  endDate: string;
  advertiserId: string;
  rows: number;
  fetchedAt: string;
  requestId: string;
  jsonPath: string;
  csvPath: string;
  processedDailyPath: string;
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
    files = await fs.readdir(PROCESSED_DIR);
  } catch {
    return names;
  }

  for (const file of files.filter((name) => name.endsWith(".csv")).sort()) {
    const text = await fs.readFile(path.join(PROCESSED_DIR, file), "utf8");
    const parsed = parseCsv(text.replace(/^﻿/, ""));
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

const toReportDate = (statTimeDay: string | undefined): string => (statTimeDay ?? "").slice(0, 10);

const normalizeRow = (row: TikTokReportRow): TikTokDailyOutputRow => {
  const metrics = row.metrics ?? {};
  const completePayment = readNumber(metrics.complete_payment);
  const valuePerCompletePayment = readNumber(metrics.value_per_complete_payment);

  return {
    report_date: toReportDate(row.dimensions?.stat_time_day),
    campaign_id: row.dimensions?.campaign_id ?? "",
    spend: readNumber(metrics.spend),
    impressions: readNumber(metrics.impressions),
    clicks: readNumber(metrics.clicks),
    conversion: readNumber(metrics.conversion),
    cta_conversion: readNumber(metrics.cta_conversion),
    vta_conversion: readNumber(metrics.vta_conversion),
    complete_payment: completePayment,
    value_per_complete_payment: valuePerCompletePayment,
    derived_complete_payment_value: completePayment * valuePerCompletePayment,
    complete_payment_roas: readNumber(metrics.complete_payment_roas),
    cta_purchase: readNumber(metrics.cta_purchase),
    evta_purchase: readNumber(metrics.evta_purchase),
    vta_purchase: readNumber(metrics.vta_purchase),
    cost_per_cta_purchase: readNumber(metrics.cost_per_cta_purchase),
    cost_per_evta_purchase: readNumber(metrics.cost_per_evta_purchase),
    cost_per_vta_purchase: readNumber(metrics.cost_per_vta_purchase),
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

const writeApiCsv = async (filePath: string, rows: TikTokDailyOutputRow[]) => {
  const headers: Array<keyof TikTokDailyOutputRow> = [
    "report_date",
    "campaign_id",
    "spend",
    "impressions",
    "clicks",
    "conversion",
    "cta_conversion",
    "vta_conversion",
    "complete_payment",
    "value_per_complete_payment",
    "derived_complete_payment_value",
    "complete_payment_roas",
    "cta_purchase",
    "evta_purchase",
    "vta_purchase",
    "cost_per_cta_purchase",
    "cost_per_evta_purchase",
    "cost_per_vta_purchase",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
};

const writeProcessedDailyCsv = async (
  filePath: string,
  rows: TikTokDailyOutputRow[],
  campaignNameById: Map<string, string>,
) => {
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
  const note = [
    "TikTok Business API report/integrated/get.",
    "Attribution window assumed TikTok default click 7d / view 1d unless Ads Manager says otherwise.",
    "API does not expose website CTA/VTA purchase value here; CTA/VTA counts use cta_conversion/vta_conversion fallback when purchase split metrics are empty.",
  ].join(" ");
  const lines = [headers.join(",")];

  for (const row of rows) {
    const platformRoas = row.spend > 0 ? row.derived_complete_payment_value / row.spend : 0;
    const ctaPurchaseCount = row.cta_purchase || row.cta_conversion;
    const evtaPurchaseCount = row.evta_purchase;
    const vtaPurchaseCount = row.vta_purchase || row.vta_conversion;
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
      ctaPurchaseCount,
      evtaPurchaseCount,
      vtaPurchaseCount,
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

const summarize = (rows: TikTokDailyOutputRow[]) =>
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

export const isoDateOnly = (input: Date | string) => {
  const date = typeof input === "string" ? new Date(input) : input;
  const utc = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayKstDate = () => isoDateOnly(new Date());

export const yesterdayKstDate = () => {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return isoDateOnly(now);
};

export const ingestTikTokDaily = async (params: {
  startDate: string;
  endDate: string;
  advertiserId?: string;
  accessToken?: string;
  pageSize?: number;
  writeProcessedDaily?: boolean;
}): Promise<TikTokDailyIngestResult> => {
  const { startDate, endDate } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Use YYYY-MM-DD for startDate and endDate");
  }

  const accessToken = params.accessToken ?? process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Missing TIKTOK_BUSINESS_ACCESS_TOKEN");

  const advertiserId = params.advertiserId ?? process.env.TIKTOK_ADVERTISER_ID;
  if (!advertiserId) throw new Error("Missing TIKTOK_ADVERTISER_ID");

  const pageSize = params.pageSize ?? 1000;
  const writeProcessed = params.writeProcessedDaily ?? true;

  await fs.mkdir(API_DIR, { recursive: true });
  if (writeProcessed) await fs.mkdir(PROCESSED_DIR, { recursive: true });

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
  const fetchedAt = new Date().toISOString();

  const rangeName = `${startDate.replace(/-/g, "")}_${endDate.replace(/-/g, "")}`;
  const jsonPath = path.join(API_DIR, `tiktok_business_api_campaign_daily_${rangeName}.json`);
  const csvPath = path.join(API_DIR, `tiktok_business_api_campaign_daily_${rangeName}.csv`);
  const processedDailyPath = path.join(PROCESSED_DIR, `${rangeName}_daily_campaign.csv`);

  await fs.writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        fetched_at: fetchedAt,
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
  await writeApiCsv(csvPath, rows);
  if (writeProcessed) {
    await writeProcessedDailyCsv(processedDailyPath, rows, await loadCampaignNameMap());
  }

  return {
    ok: true,
    startDate,
    endDate,
    advertiserId,
    rows: rows.length,
    fetchedAt,
    requestId,
    jsonPath,
    csvPath,
    processedDailyPath,
  };
};

export const TIKTOK_DAILY_PATHS = {
  apiDir: API_DIR,
  processedDir: PROCESSED_DIR,
};
