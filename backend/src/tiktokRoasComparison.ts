import { promises as fs } from "node:fs";
import path from "node:path";

import { getCrmDb } from "./crmLocalDb";
import { queryGA4TikTokTransactions, type GA4TikTokTransactionRow } from "./ga4";

const TIKTOK_ADS_TABLE = "tiktok_ads_campaign_range";
const TIKTOK_ADS_DAILY_TABLE = "tiktok_ads_daily";
const TIKTOK_SOURCE = "biocom_imweb";
const VIRTUAL_ACCOUNT_EXPIRY_HOURS = 24;
const OPERATIONAL_ATTRIBUTION_BASE_URL =
  process.env.ATTRIBUTION_OPERATIONAL_BASE_URL?.trim() || "https://att.ainativeos.net";
const PROCESSED_DIR = path.resolve(__dirname, "..", "..", "data", "ads_csv", "tiktok", "processed");

type TikTokAdsCampaignRangeRow = {
  report_start: string;
  report_end: string;
  granularity: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  campaign_budget: number;
  currency: string;
  spend: number;
  net_cost: number;
  impressions: number;
  destination_clicks: number;
  conversions: number;
  all_channels_total_purchases: number;
  all_channels_purchase_value_inferred: number;
  platform_roas_from_inferred_purchase_value: number;
  website_cta_purchase_roas: number;
  website_vta_purchase_roas: number;
  source_file: string;
  attribution_window_note: string;
  imported_at: string;
};

type TikTokAdsDailyRow = {
  report_date: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  currency: string;
  spend: number;
  net_cost: number;
  impressions: number;
  destination_clicks: number;
  clicks: number;
  conversions: number;
  purchase_count: number;
  purchase_value: number;
  cta_purchase_count: number;
  evta_purchase_count: number;
  vta_purchase_count: number;
  cta_purchase_value: number;
  evta_purchase_value: number;
  vta_purchase_value: number;
  platform_roas: number;
  cta_purchase_roas: number;
  evta_purchase_roas: number;
  vta_purchase_roas: number;
  attribution_click_window_days: number;
  attribution_view_window_days: number;
  attribution_window_note: string;
  source_file: string;
  imported_at: string;
};

type RemoteLedgerEntry = {
  touchpoint?: unknown;
  paymentStatus?: unknown;
  loggedAt?: unknown;
  orderId?: unknown;
  paymentKey?: unknown;
  landing?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
  ttclid?: unknown;
  metadata?: unknown;
};

type RemoteLedgerBody = {
  ok?: unknown;
  items?: unknown;
  summary?: unknown;
};

type RemoteTikTokPixelEvent = {
  loggedAt?: unknown;
  action?: unknown;
  eventName?: unknown;
  eventId?: unknown;
  originalEventId?: unknown;
  replacementEventName?: unknown;
  orderCode?: unknown;
  orderNo?: unknown;
  paymentCode?: unknown;
  value?: unknown;
  currency?: unknown;
  decisionStatus?: unknown;
  decisionBranch?: unknown;
  decisionReason?: unknown;
  decisionMatchedBy?: unknown;
};

type RemoteTikTokPixelEventsBody = {
  ok?: unknown;
  dataSource?: unknown;
  storage?: unknown;
  items?: unknown;
  summary?: unknown;
};

type StatusAggregate = {
  orders: number;
  rows: number;
  amount: number;
};

type SourceReasonAggregate = {
  rows: number;
  orders: number;
  amount: number;
};

type SourcePrecisionTier = "high" | "medium" | "low";
type TikTokAuditFate = "confirmed_later" | "expired_unpaid" | "canceled" | "false_attribution" | "still_pending";

type DailyStatusAggregate = StatusAggregate & { orderSet: Set<string> };

type DailyAdsAggregate = {
  date: string;
  spend: number;
  netCost: number;
  impressions: number;
  destinationClicks: number;
  clicks: number;
  conversions: number;
  platformPurchases: number;
  platformPurchaseValue: number;
  ctaPurchaseCount: number;
  evtaPurchaseCount: number;
  vtaPurchaseCount: number;
  ctaPurchaseValue: number;
  evtaPurchaseValue: number;
  vtaPurchaseValue: number;
};

type TikTokAuditOrder = {
  loggedAt: string;
  orderId: string;
  paymentKey: string;
  paymentStatus: string;
  amount: number;
  utmSource: string;
  utmCampaign: string;
  hasTtclid: boolean;
  sourceMatchReasons: string[];
  precisionTier: SourcePrecisionTier;
  ageHours: number | null;
  overVirtualAccountExpiry: boolean;
  expiryCutoffAt: string;
  firstSeenAt: string;
  lastStatusAt: string;
  fate: TikTokAuditFate;
  evidence: string;
};

export type TikTokRoasComparison = {
  ok: true;
  start_date: string;
  end_date: string;
  attribution_window: {
    source: "assumed_default";
    click: "7d";
    view: "1d";
    note: string;
  };
  local_table: {
    name: string;
    importedRows: number;
    matchedRows: number;
    daily: {
      name: string;
      importedRows: number;
      rows: number;
      minDate: string | null;
      maxDate: string | null;
      readyForImport: boolean;
      note: string;
      autoIngest: {
        attempted: boolean;
        ok: boolean;
        message: string | null;
        startDate: string | null;
        endDate: string | null;
        rows: number | null;
        fetchedAt: string | null;
      };
    };
    availableRanges: Array<{
      start_date: string;
      end_date: string;
      rows: number;
      spend: number;
      purchaseValue: number;
    }>;
  };
  ads_report: {
    source: "local_sqlite_from_tiktok_xlsx";
    campaignRows: Array<{
      campaignId: string;
      campaignName: string;
      status: string;
      spend: number;
      purchases: number;
      purchaseValue: number;
      platformRoas: number | null;
      ctaPurchaseRoas: number | null;
      vtaPurchaseRoas: number | null;
    }>;
    summary: {
      spend: number;
      netCost: number;
      impressions: number;
      destinationClicks: number;
      conversions: number;
      purchases: number;
      purchaseValue: number;
      ctaPurchaseCount: number;
      evtaPurchaseCount: number;
      vtaPurchaseCount: number;
      platformRoas: number | null;
      ctaPurchaseRoas: number | null;
      evtaPurchaseRoas: number | null;
      vtaPurchaseRoas: number | null;
      currency: string;
    };
  };
  operational_ledger: {
    source: string;
    dataSource: "operational_vm_ledger";
    fetchedEntries: number;
    tiktokPaymentSuccessRows: number;
    byStatus: Record<"confirmed" | "pending" | "canceled" | "unknown", StatusAggregate>;
    sourceReasonSummary: Record<string, SourceReasonAggregate>;
    sourcePrecisionSummary: Record<SourcePrecisionTier, SourceReasonAggregate>;
    pendingFateSummary: Record<TikTokAuditFate, SourceReasonAggregate>;
    pendingAuditTop20: TikTokAuditOrder[];
    sampleOrders: Array<{
      loggedAt: string;
      orderId: string;
      paymentStatus: string;
      amount: number;
      utmSource: string;
      utmCampaign: string;
      hasTtclid: boolean;
      sourceMatchReasons: string[];
      precisionTier: SourcePrecisionTier;
    }>;
  };
  first_touch_attribution: {
    source: "tj_managed_attribution_vm_first_touch";
    storage: "CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch";
    candidatePaymentSuccessRows: number;
    strictOverlapRows: number;
    byStatus: Record<"confirmed" | "pending" | "canceled" | "unknown", StatusAggregate>;
    sourceReasonSummary: Record<string, SourceReasonAggregate>;
    sampleOrders: Array<{
      loggedAt: string;
      orderId: string;
      paymentStatus: string;
      amount: number;
      firstTouchLoggedAt: string;
      firstTouchSource: string;
      firstTouchUtmSource: string;
      firstTouchUtmCampaign: string;
      firstTouchHasTtclid: boolean;
      firstTouchMatchReasons: string[];
      matchedBy: string[];
      matchScore: number;
    }>;
    note: string;
  };
  ga4_cross_check: {
    source: "ga4_session_source_transaction_joined_with_operational_vm_ledger";
    dataSource: "GA4 Data API + operational_vm_ledger";
    available: boolean;
    confidence: "medium" | "unavailable";
    warning: string | null;
    totals: {
      ga4Rows: number;
      ga4Events: number;
      ga4Revenue: number;
      numericTransactionRows: number;
      npayTransactionRows: number;
      blankTransactionEvents: number;
      blankTransactionRevenue: number;
      ledgerConfirmedRows: number;
      ledgerConfirmedRevenue: number;
      ledgerConfirmedAmount: number;
      ledgerCanceledRows: number;
      ledgerCanceledRevenue: number;
      noLedgerMatchRows: number;
      noLedgerMatchRevenue: number;
      confirmedWithTikTokLedgerSignals: number;
      confirmedWithOtherLedgerSource: number;
      confirmedWithMissingLedgerSource: number;
    };
    notes: string[];
    samples: Array<{
      date: string;
      transactionId: string;
      sessionSource: string;
      sessionMedium: string;
      ga4Revenue: number;
      ledgerStatus: string;
      ledgerAmount: number;
      ledgerUtmSource: string;
      ledgerUtmMedium: string;
      ledgerTikTokMatchReasons: string[];
    }>;
  };
  tiktok_event_log: {
    source: "operational_vm_tiktok_pixel_events";
    storage: string;
    startAt: string;
    endAt: string;
    fetchedEvents: number;
    uniqueOrderKeys: number;
    countsByAction: Record<string, number>;
    countsByDecisionStatus: Record<string, number>;
    countsByDecisionBranch: Record<string, number>;
    finalActionSummary: {
      releasedConfirmedPurchase: number;
      blockedPendingPurchase: number;
      sentReplacementPlaceAnOrder: number;
      releasedUnknownPurchase: number;
      requestError: number;
      missingFinalActionOrders: number;
      anomalyCount: number;
      warningCount: number;
    };
    sampleOrders: Array<{
      loggedAt: string;
      orderKey: string;
      orderNo: string;
      paymentCode: string;
      value: number | null;
      currency: string;
      finalAction: string;
      actions: string[];
      decisionStatus: string;
      decisionBranch: string;
      replacementEventName: string;
      eventId: string;
    }>;
    anomalies: string[];
    warnings: string[];
  };
  gap: {
    confirmedRevenue: number;
    pendingRevenue: number;
    canceledRevenue: number;
    platformPurchaseValue: number;
    platformMinusConfirmed: number;
    platformMinusConfirmedAndPending: number;
    confirmedRoas: number | null;
    potentialRoas: number | null;
    overstatementVsConfirmedRatio: number | null;
  };
  daily_comparison: {
    source: "tiktok_ads_daily_joined_with_operational_vm_ledger";
    summary: {
      days: number;
      daysWithSpend: number;
      platformSpend: number;
      platformPurchaseValue: number;
      platformPurchases: number;
      ctaPurchaseCount: number;
      evtaPurchaseCount: number;
      vtaPurchaseCount: number;
      unclassifiedPurchaseCount: number;
      platformRoas: number | null;
      confirmedRevenue: number;
      pendingRevenue: number;
      canceledRevenue: number;
      confirmedRoas: number | null;
      potentialRoas: number | null;
      platformMinusConfirmed: number;
      platformMinusConfirmedAndPending: number;
    };
    guardBreakdown: Record<"pre_guard" | "guard_start_and_after", {
      days: number;
      platformSpend: number;
      platformPurchaseValue: number;
      platformPurchases: number;
      ctaPurchaseCount: number;
      evtaPurchaseCount: number;
      vtaPurchaseCount: number;
      unclassifiedPurchaseCount: number;
      platformRoas: number | null;
      confirmedRevenue: number;
      pendingRevenue: number;
      confirmedRoas: number | null;
      potentialRoas: number | null;
      platformMinusConfirmed: number;
      platformMinusConfirmedAndPending: number;
    }>;
    rows: Array<{
      date: string;
      guardPhase: "pre_guard" | "guard_start" | "post_guard";
      hasAdsData: boolean;
      spend: number;
      platformPurchases: number;
      platformPurchaseValue: number;
      platformRoas: number | null;
      ctaPurchaseCount: number;
      evtaPurchaseCount: number;
      vtaPurchaseCount: number;
      unclassifiedPurchaseCount: number;
      ctaPurchaseValue: number;
      evtaPurchaseValue: number;
      vtaPurchaseValue: number;
      confirmedOrders: number;
      pendingOrders: number;
      canceledOrders: number;
      confirmedRevenue: number;
      pendingRevenue: number;
      canceledRevenue: number;
      confirmedRoas: number | null;
      potentialRoas: number | null;
      platformMinusConfirmed: number;
      platformMinusConfirmedAndPending: number;
    }>;
  };
  warnings: string[];
  notes: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized || normalized === "-") return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toRoas = (revenue: number, spend: number) => (spend > 0 ? round(revenue / spend) : null);

const hoursSince = (value: unknown, nowMs = Date.now()) => {
  const text = readString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return round((nowMs - parsed) / (60 * 60 * 1000), 1);
};

const isoAfterHours = (value: unknown, hours: number) => {
  const text = readString(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed + hours * 60 * 60 * 1000).toISOString();
};

const pendingFateForStatus = (
  status: "confirmed" | "pending" | "canceled" | "unknown",
  overVirtualAccountExpiry: boolean,
): TikTokAuditFate => {
  if (status === "confirmed") return "confirmed_later";
  if (status === "canceled") return "canceled";
  if (status === "pending" && overVirtualAccountExpiry) return "expired_unpaid";
  return "still_pending";
};

const kstDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toKstDate = (value: unknown) => {
  const text = readString(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = Object.fromEntries(kstDateFormatter.formatToParts(parsed).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const eachDateInRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (!Number.isNaN(current.getTime()) && current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
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

const ensureTikTokAdsSchema = () => {
  getCrmDb().exec(`
    CREATE TABLE IF NOT EXISTS ${TIKTOK_ADS_TABLE} (
      report_start TEXT NOT NULL,
      report_end TEXT NOT NULL,
      granularity TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '',
      campaign_budget REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KRW',
      spend REAL NOT NULL DEFAULT 0,
      net_cost REAL NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      destination_clicks INTEGER NOT NULL DEFAULT 0,
      conversions INTEGER NOT NULL DEFAULT 0,
      all_channels_total_purchases INTEGER NOT NULL DEFAULT 0,
      all_channels_purchase_value_inferred REAL NOT NULL DEFAULT 0,
      platform_roas_from_inferred_purchase_value REAL NOT NULL DEFAULT 0,
      website_cta_purchase_roas REAL NOT NULL DEFAULT 0,
      website_vta_purchase_roas REAL NOT NULL DEFAULT 0,
      source_file TEXT NOT NULL DEFAULT '',
      attribution_window_note TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (report_start, report_end, granularity, campaign_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tiktok_ads_campaign_range_period
      ON ${TIKTOK_ADS_TABLE}(report_start, report_end);

    CREATE TABLE IF NOT EXISTS ${TIKTOK_ADS_DAILY_TABLE} (
      report_date TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      campaign_status TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'KRW',
      spend REAL NOT NULL DEFAULT 0,
      net_cost REAL NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      destination_clicks INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      conversions INTEGER NOT NULL DEFAULT 0,
      purchase_count INTEGER NOT NULL DEFAULT 0,
      purchase_value REAL NOT NULL DEFAULT 0,
      cta_purchase_count INTEGER NOT NULL DEFAULT 0,
      evta_purchase_count INTEGER NOT NULL DEFAULT 0,
      vta_purchase_count INTEGER NOT NULL DEFAULT 0,
      cta_purchase_value REAL NOT NULL DEFAULT 0,
      evta_purchase_value REAL NOT NULL DEFAULT 0,
      vta_purchase_value REAL NOT NULL DEFAULT 0,
      platform_roas REAL NOT NULL DEFAULT 0,
      cta_purchase_roas REAL NOT NULL DEFAULT 0,
      evta_purchase_roas REAL NOT NULL DEFAULT 0,
      vta_purchase_roas REAL NOT NULL DEFAULT 0,
      attribution_click_window_days INTEGER NOT NULL DEFAULT 7,
      attribution_view_window_days INTEGER NOT NULL DEFAULT 1,
      attribution_window_note TEXT NOT NULL DEFAULT 'TikTok default: click 7d / view 1d unless Ads Manager says otherwise',
      source_file TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (report_date, campaign_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tiktok_ads_daily_date
      ON ${TIKTOK_ADS_DAILY_TABLE}(report_date);
  `);
};

export const getDailyTableState = () => {
  ensureTikTokAdsSchema();
  return getCrmDb().prepare(`
    SELECT
      COUNT(*) AS rows,
      MIN(report_date) AS minDate,
      MAX(report_date) AS maxDate
    FROM ${TIKTOK_ADS_DAILY_TABLE}
  `).get() as { rows: number; minDate: string | null; maxDate: string | null };
};

const rowObject = (headers: string[], values: string[]) => {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = values[index] ?? "";
  });
  return record;
};

export const importProcessedCsvFiles = async () => {
  ensureTikTokAdsSchema();

  let importedRows = 0;
  let names: string[] = [];
  try {
    names = await fs.readdir(PROCESSED_DIR);
  } catch {
    return importedRows;
  }

  const files = names
    .filter((name) => /^\d{8}_\d{8}_campaign_summary\.csv$/.test(name))
    .sort();

  const db = getCrmDb();
  const upsert = db.prepare(`
    INSERT INTO ${TIKTOK_ADS_TABLE} (
      report_start, report_end, granularity, campaign_id, campaign_name, status,
      campaign_budget, currency, spend, net_cost, impressions, destination_clicks,
      conversions, all_channels_total_purchases, all_channels_purchase_value_inferred,
      platform_roas_from_inferred_purchase_value, website_cta_purchase_roas,
      website_vta_purchase_roas, source_file, attribution_window_note, imported_at
    ) VALUES (
      @report_start, @report_end, @granularity, @campaign_id, @campaign_name, @status,
      @campaign_budget, @currency, @spend, @net_cost, @impressions, @destination_clicks,
      @conversions, @all_channels_total_purchases, @all_channels_purchase_value_inferred,
      @platform_roas_from_inferred_purchase_value, @website_cta_purchase_roas,
      @website_vta_purchase_roas, @source_file, @attribution_window_note, @imported_at
    )
    ON CONFLICT(report_start, report_end, granularity, campaign_id)
    DO UPDATE SET
      campaign_name = excluded.campaign_name,
      status = excluded.status,
      campaign_budget = excluded.campaign_budget,
      currency = excluded.currency,
      spend = excluded.spend,
      net_cost = excluded.net_cost,
      impressions = excluded.impressions,
      destination_clicks = excluded.destination_clicks,
      conversions = excluded.conversions,
      all_channels_total_purchases = excluded.all_channels_total_purchases,
      all_channels_purchase_value_inferred = excluded.all_channels_purchase_value_inferred,
      platform_roas_from_inferred_purchase_value = excluded.platform_roas_from_inferred_purchase_value,
      website_cta_purchase_roas = excluded.website_cta_purchase_roas,
      website_vta_purchase_roas = excluded.website_vta_purchase_roas,
      source_file = excluded.source_file,
      attribution_window_note = excluded.attribution_window_note,
      imported_at = excluded.imported_at
  `);

  const now = new Date().toISOString();
  const importRows = db.transaction((rows: TikTokAdsCampaignRangeRow[]) => {
    let count = 0;
    for (const row of rows) {
      const result = upsert.run(row);
      count += Number(result.changes ?? 0) > 0 ? 1 : 0;
    }
    return count;
  });

  for (const file of files) {
    const text = await fs.readFile(path.join(PROCESSED_DIR, file), "utf8");
    const parsed = parseCsv(text.replace(/^\uFEFF/, ""));
    if (parsed.length < 2) continue;
    const headers = parsed[0] ?? [];
    const rows = parsed.slice(1)
      .map((values) => rowObject(headers, values))
      .map((record): TikTokAdsCampaignRangeRow => ({
        report_start: record.report_start,
        report_end: record.report_end,
        granularity: record.granularity || "campaign_range_total",
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        status: record.status,
        campaign_budget: parseNumber(record.campaign_budget),
        currency: record.currency || "KRW",
        spend: parseNumber(record.spend),
        net_cost: parseNumber(record.net_cost),
        impressions: Math.round(parseNumber(record.impressions)),
        destination_clicks: Math.round(parseNumber(record.destination_clicks)),
        conversions: Math.round(parseNumber(record.conversions)),
        all_channels_total_purchases: Math.round(parseNumber(record.all_channels_total_purchases)),
        all_channels_purchase_value_inferred: parseNumber(record.all_channels_purchase_value_inferred),
        platform_roas_from_inferred_purchase_value: parseNumber(record.platform_roas_from_inferred_purchase_value),
        website_cta_purchase_roas: parseNumber(record.website_cta_purchase_roas),
        website_vta_purchase_roas: parseNumber(record.website_vta_purchase_roas),
        source_file: record.source_file,
        attribution_window_note: record.attribution_window_note,
        imported_at: now,
      }))
      .filter((row) => row.report_start && row.report_end && row.campaign_id && row.campaign_name);

    importedRows += importRows(rows);
  }

  return importedRows;
};

export const importProcessedDailyCsvFiles = async () => {
  ensureTikTokAdsSchema();

  let importedRows = 0;
  let names: string[] = [];
  try {
    names = await fs.readdir(PROCESSED_DIR);
  } catch {
    return importedRows;
  }

  const files = names
    .filter((name) => /^\d{8}_\d{8}_daily_campaign\.csv$/.test(name))
    .sort();

  const db = getCrmDb();
  const upsert = db.prepare(`
    INSERT INTO ${TIKTOK_ADS_DAILY_TABLE} (
      report_date, campaign_id, campaign_name, campaign_status, currency,
      spend, net_cost, impressions, destination_clicks, clicks, conversions,
      purchase_count, purchase_value, cta_purchase_count, evta_purchase_count,
      vta_purchase_count, cta_purchase_value, evta_purchase_value, vta_purchase_value,
      platform_roas, cta_purchase_roas, evta_purchase_roas, vta_purchase_roas,
      attribution_click_window_days, attribution_view_window_days,
      attribution_window_note, source_file, imported_at
    ) VALUES (
      @report_date, @campaign_id, @campaign_name, @campaign_status, @currency,
      @spend, @net_cost, @impressions, @destination_clicks, @clicks, @conversions,
      @purchase_count, @purchase_value, @cta_purchase_count, @evta_purchase_count,
      @vta_purchase_count, @cta_purchase_value, @evta_purchase_value, @vta_purchase_value,
      @platform_roas, @cta_purchase_roas, @evta_purchase_roas, @vta_purchase_roas,
      @attribution_click_window_days, @attribution_view_window_days,
      @attribution_window_note, @source_file, @imported_at
    )
    ON CONFLICT(report_date, campaign_id)
    DO UPDATE SET
      campaign_name = excluded.campaign_name,
      campaign_status = excluded.campaign_status,
      currency = excluded.currency,
      spend = excluded.spend,
      net_cost = excluded.net_cost,
      impressions = excluded.impressions,
      destination_clicks = excluded.destination_clicks,
      clicks = excluded.clicks,
      conversions = excluded.conversions,
      purchase_count = excluded.purchase_count,
      purchase_value = excluded.purchase_value,
      cta_purchase_count = excluded.cta_purchase_count,
      evta_purchase_count = excluded.evta_purchase_count,
      vta_purchase_count = excluded.vta_purchase_count,
      cta_purchase_value = excluded.cta_purchase_value,
      evta_purchase_value = excluded.evta_purchase_value,
      vta_purchase_value = excluded.vta_purchase_value,
      platform_roas = excluded.platform_roas,
      cta_purchase_roas = excluded.cta_purchase_roas,
      evta_purchase_roas = excluded.evta_purchase_roas,
      vta_purchase_roas = excluded.vta_purchase_roas,
      attribution_click_window_days = excluded.attribution_click_window_days,
      attribution_view_window_days = excluded.attribution_view_window_days,
      attribution_window_note = excluded.attribution_window_note,
      source_file = excluded.source_file,
      imported_at = excluded.imported_at
  `);

  const now = new Date().toISOString();
  const importRows = db.transaction((rows: TikTokAdsDailyRow[]) => {
    let count = 0;
    for (const row of rows) {
      const result = upsert.run(row);
      count += Number(result.changes ?? 0) > 0 ? 1 : 0;
    }
    return count;
  });

  for (const file of files) {
    const text = await fs.readFile(path.join(PROCESSED_DIR, file), "utf8");
    const parsed = parseCsv(text.replace(/^\uFEFF/, ""));
    if (parsed.length < 2) continue;
    const headers = parsed[0] ?? [];
    const rows = parsed.slice(1)
      .map((values) => rowObject(headers, values))
      .map((record): TikTokAdsDailyRow => ({
        report_date: record.report_date,
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        campaign_status: record.campaign_status || record.status || "",
        currency: record.currency || "KRW",
        spend: parseNumber(record.spend),
        net_cost: parseNumber(record.net_cost),
        impressions: Math.round(parseNumber(record.impressions)),
        destination_clicks: Math.round(parseNumber(record.destination_clicks)),
        clicks: Math.round(parseNumber(record.clicks)),
        conversions: Math.round(parseNumber(record.conversions)),
        purchase_count: Math.round(parseNumber(record.purchase_count)),
        purchase_value: parseNumber(record.purchase_value),
        cta_purchase_count: Math.round(parseNumber(record.cta_purchase_count)),
        evta_purchase_count: Math.round(parseNumber(record.evta_purchase_count)),
        vta_purchase_count: Math.round(parseNumber(record.vta_purchase_count)),
        cta_purchase_value: parseNumber(record.cta_purchase_value),
        evta_purchase_value: parseNumber(record.evta_purchase_value),
        vta_purchase_value: parseNumber(record.vta_purchase_value),
        platform_roas: parseNumber(record.platform_roas),
        cta_purchase_roas: parseNumber(record.cta_purchase_roas),
        evta_purchase_roas: parseNumber(record.evta_purchase_roas),
        vta_purchase_roas: parseNumber(record.vta_purchase_roas),
        attribution_click_window_days: Math.round(parseNumber(record.attribution_click_window_days)) || 7,
        attribution_view_window_days: Math.round(parseNumber(record.attribution_view_window_days)) || 1,
        attribution_window_note: record.attribution_window_note
          || "TikTok default: click 7d / view 1d unless Ads Manager says otherwise",
        source_file: record.source_file || file,
        imported_at: now,
      }))
      .filter((row) => row.report_date && row.campaign_id && row.campaign_name);

    importedRows += importRows(rows);
  }

  return importedRows;
};

const listAvailableRanges = () => {
  ensureTikTokAdsSchema();
  const campaignRanges = getCrmDb().prepare(`
    SELECT
      report_start AS start_date,
      report_end AS end_date,
      COUNT(*) AS rows,
      COALESCE(SUM(spend), 0) AS spend,
      COALESCE(SUM(all_channels_purchase_value_inferred), 0) AS purchaseValue
    FROM ${TIKTOK_ADS_TABLE}
    GROUP BY report_start, report_end
    ORDER BY report_start DESC, report_end DESC
  `).all() as Array<{
    start_date: string;
    end_date: string;
    rows: number;
    spend: number;
    purchaseValue: number;
  }>;
  const dailyRanges = getCrmDb().prepare(`
    SELECT
      MIN(report_date) AS start_date,
      MAX(report_date) AS end_date,
      COUNT(*) AS rows,
      COALESCE(SUM(spend), 0) AS spend,
      COALESCE(SUM(purchase_value), 0) AS purchaseValue
    FROM ${TIKTOK_ADS_DAILY_TABLE}
    WHERE source_file LIKE '%_daily_campaign.csv'
    GROUP BY source_file
    HAVING start_date IS NOT NULL AND end_date IS NOT NULL
  `).all() as Array<{
    start_date: string;
    end_date: string;
    rows: number;
    spend: number;
    purchaseValue: number;
  }>;

  const byRange = new Map<string, {
    start_date: string;
    end_date: string;
    rows: number;
    spend: number;
    purchaseValue: number;
  }>();
  for (const range of [...campaignRanges, ...dailyRanges]) {
    const key = `${range.start_date}:${range.end_date}`;
    if (!byRange.has(key)) byRange.set(key, range);
  }

  return [...byRange.values()].sort((left, right) =>
    right.start_date.localeCompare(left.start_date) || right.end_date.localeCompare(left.end_date),
  );
};

const loadAdsRows = (startDate: string, endDate: string) => {
  ensureTikTokAdsSchema();
  const campaignRangeRows = getCrmDb().prepare(`
    SELECT *
    FROM ${TIKTOK_ADS_TABLE}
    WHERE report_start = ? AND report_end = ?
    ORDER BY spend DESC, campaign_name ASC
  `).all(startDate, endDate) as TikTokAdsCampaignRangeRow[];
  if (campaignRangeRows.length > 0) return campaignRangeRows;

  return getCrmDb().prepare(`
    SELECT
      ? AS report_start,
      ? AS report_end,
      'daily_campaign_aggregate' AS granularity,
      campaign_id,
      campaign_name,
      COALESCE(campaign_status, '') AS status,
      0 AS campaign_budget,
      COALESCE(currency, 'KRW') AS currency,
      COALESCE(SUM(spend), 0) AS spend,
      COALESCE(SUM(net_cost), 0) AS net_cost,
      COALESCE(SUM(impressions), 0) AS impressions,
      COALESCE(SUM(destination_clicks), 0) AS destination_clicks,
      COALESCE(SUM(conversions), 0) AS conversions,
      COALESCE(SUM(purchase_count), 0) AS all_channels_total_purchases,
      COALESCE(SUM(purchase_value), 0) AS all_channels_purchase_value_inferred,
      CASE WHEN COALESCE(SUM(spend), 0) > 0
        THEN COALESCE(SUM(purchase_value), 0) / COALESCE(SUM(spend), 0)
        ELSE 0
      END AS platform_roas_from_inferred_purchase_value,
      CASE WHEN COALESCE(SUM(spend), 0) > 0
        THEN COALESCE(SUM(cta_purchase_value), 0) / COALESCE(SUM(spend), 0)
        ELSE 0
      END AS website_cta_purchase_roas,
      CASE WHEN COALESCE(SUM(spend), 0) > 0
        THEN COALESCE(SUM(vta_purchase_value), 0) / COALESCE(SUM(spend), 0)
        ELSE 0
      END AS website_vta_purchase_roas,
      MIN(source_file) AS source_file,
      MAX(attribution_window_note) AS attribution_window_note,
      MAX(imported_at) AS imported_at
    FROM ${TIKTOK_ADS_DAILY_TABLE}
    WHERE report_date BETWEEN ? AND ?
    GROUP BY campaign_id, campaign_name, campaign_status, currency
    ORDER BY spend DESC, campaign_name ASC
  `).all(startDate, endDate, startDate, endDate) as TikTokAdsCampaignRangeRow[];
};

const loadDailyAdsRows = (startDate: string, endDate: string) => {
  ensureTikTokAdsSchema();
  return getCrmDb().prepare(`
    SELECT
      report_date AS date,
      COALESCE(SUM(spend), 0) AS spend,
      COALESCE(SUM(net_cost), 0) AS netCost,
      COALESCE(SUM(impressions), 0) AS impressions,
      COALESCE(SUM(destination_clicks), 0) AS destinationClicks,
      COALESCE(SUM(clicks), 0) AS clicks,
      COALESCE(SUM(conversions), 0) AS conversions,
      COALESCE(SUM(purchase_count), 0) AS platformPurchases,
      COALESCE(SUM(purchase_value), 0) AS platformPurchaseValue,
      COALESCE(SUM(cta_purchase_count), 0) AS ctaPurchaseCount,
      COALESCE(SUM(evta_purchase_count), 0) AS evtaPurchaseCount,
      COALESCE(SUM(vta_purchase_count), 0) AS vtaPurchaseCount,
      COALESCE(SUM(cta_purchase_value), 0) AS ctaPurchaseValue,
      COALESCE(SUM(evta_purchase_value), 0) AS evtaPurchaseValue,
      COALESCE(SUM(vta_purchase_value), 0) AS vtaPurchaseValue
    FROM ${TIKTOK_ADS_DAILY_TABLE}
    WHERE report_date BETWEEN ? AND ?
    GROUP BY report_date
    ORDER BY report_date ASC
  `).all(startDate, endDate) as DailyAdsAggregate[];
};

const defaultRange = () => {
  const ranges = listAvailableRanges();
  return ranges.find((range) => range.purchaseValue > 0) ?? ranges[0] ?? {
    start_date: "2026-03-19",
    end_date: "2026-04-17",
    rows: 0,
    spend: 0,
    purchaseValue: 0,
  };
};

const toKstStartIso = (date: string) => new Date(`${date}T00:00:00+09:00`).toISOString();

const toKstEndExclusiveIso = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
};

const getMetadata = (entry: RemoteLedgerEntry) => (isRecord(entry.metadata) ? entry.metadata : {});

const urlHasParam = (value: unknown, param: string) => {
  const text = readString(value);
  if (!text) return false;
  try {
    return Boolean(new URL(text).searchParams.get(param));
  } catch {
    return text.toLowerCase().includes(`${param.toLowerCase()}=`);
  }
};

const textIncludesTikTok = (value: unknown) => readString(value).toLowerCase().includes("tiktok");

const metadataValueIncludesTikTok = (metadata: Record<string, unknown>, key: string) =>
  textIncludesTikTok(metadata[key]);

const getTikTokMatchReasons = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  const reasons = new Set<string>();

  if (readString(entry.ttclid)) reasons.add("ttclid_direct");
  if (urlHasParam(entry.landing, "ttclid") || urlHasParam(entry.referrer, "ttclid")) reasons.add("ttclid_url");
  if (textIncludesTikTok(entry.utmSource)) reasons.add("utm_source_tiktok");
  if (textIncludesTikTok(entry.utmMedium)) reasons.add("utm_medium_tiktok");
  if (textIncludesTikTok(entry.utmCampaign)) reasons.add("utm_campaign_tiktok");
  if (textIncludesTikTok(entry.utmContent)) reasons.add("utm_content_tiktok");
  if (textIncludesTikTok(entry.utmTerm)) reasons.add("utm_term_tiktok");
  if (textIncludesTikTok(entry.landing)) reasons.add("landing_tiktok");
  if (textIncludesTikTok(entry.referrer)) reasons.add("referrer_tiktok");
  if (
    metadataValueIncludesTikTok(metadata, "imweb_landing_url")
    || metadataValueIncludesTikTok(metadata, "initial_referrer")
    || metadataValueIncludesTikTok(metadata, "original_referrer")
    || metadataValueIncludesTikTok(metadata, "checkoutUrl")
  ) {
    reasons.add("metadata_url_tiktok");
  }
  if (
    urlHasParam(metadata.imweb_landing_url, "ttclid")
    || urlHasParam(metadata.initial_referrer, "ttclid")
    || urlHasParam(metadata.original_referrer, "ttclid")
    || urlHasParam(metadata.checkoutUrl, "ttclid")
  ) {
    reasons.add("metadata_ttclid_url");
  }

  return [...reasons].sort();
};

const getFirstTouchMetadata = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  return isRecord(metadata.firstTouch) ? metadata.firstTouch : {};
};

const getFirstTouchMatchMetadata = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  return isRecord(metadata.firstTouchMatch) ? metadata.firstTouchMatch : {};
};

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map(readString).filter(Boolean)
    : [];

const getFirstTouchTikTokMatchReasons = (entry: RemoteLedgerEntry) => {
  const firstTouch = getFirstTouchMetadata(entry);
  const firstTouchMatch = getFirstTouchMatchMetadata(entry);
  const reasons = new Set<string>();

  for (const reason of [
    ...readStringArray(firstTouch.tiktokMatchReasons),
    ...readStringArray(firstTouchMatch.tiktokMatchReasons),
  ]) {
    reasons.add(`first_touch_${reason}`);
  }

  if (readString(firstTouch.ttclid)) reasons.add("first_touch_ttclid_direct");
  if (urlHasParam(firstTouch.landing, "ttclid") || urlHasParam(firstTouch.referrer, "ttclid")) {
    reasons.add("first_touch_ttclid_url");
  }
  if (textIncludesTikTok(firstTouch.utmSource)) reasons.add("first_touch_utm_source_tiktok");
  if (textIncludesTikTok(firstTouch.utmMedium)) reasons.add("first_touch_utm_medium_tiktok");
  if (textIncludesTikTok(firstTouch.utmCampaign)) reasons.add("first_touch_utm_campaign_tiktok");
  if (textIncludesTikTok(firstTouch.utmContent)) reasons.add("first_touch_utm_content_tiktok");
  if (textIncludesTikTok(firstTouch.utmTerm)) reasons.add("first_touch_utm_term_tiktok");
  if (textIncludesTikTok(firstTouch.landing)) reasons.add("first_touch_landing_tiktok");
  if (textIncludesTikTok(firstTouch.referrer)) reasons.add("first_touch_referrer_tiktok");

  return [...reasons].sort();
};

const precisionTierForReasons = (reasons: string[]): SourcePrecisionTier => {
  if (reasons.some((reason) => reason.includes("ttclid"))) return "high";
  if (reasons.some((reason) => reason.startsWith("utm_"))) return "medium";
  return "low";
};

const evidenceForEntry = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  const values = [
    entry.ttclid,
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.referrer,
    entry.landing,
    metadata.imweb_landing_url,
    metadata.initial_referrer,
    metadata.original_referrer,
  ].map(readString).filter(Boolean);
  return values.join(" | ").slice(0, 260);
};

const isTikTokPaymentSuccess = (entry: RemoteLedgerEntry) => (
  entry.touchpoint === "payment_success"
  && getTikTokMatchReasons(entry).length > 0
);

const readEntryAmount = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  const referrerPayment = isRecord(metadata.referrerPayment) ? metadata.referrerPayment : {};
  const candidates = [
    metadata.totalAmount,
    metadata.total_amount,
    metadata.amount,
    metadata.paymentAmount,
    metadata.payment_amount,
    referrerPayment.amount,
  ];
  for (const candidate of candidates) {
    const parsed = parseNumber(candidate);
    if (parsed > 0) return parsed;
  }
  for (const urlValue of [entry.referrer, entry.landing].map(readString)) {
    try {
      const amount = parseNumber(new URL(urlValue).searchParams.get("amount"));
      if (amount > 0) return amount;
    } catch {
      // ignore malformed URL
    }
  }
  return 0;
};

const ledgerOrderKeys = (entry: RemoteLedgerEntry) => {
  const metadata = getMetadata(entry);
  const referrerPayment = isRecord(metadata.referrerPayment) ? metadata.referrerPayment : {};
  const keys = new Set<string>();
  const candidates = [
    entry.orderId,
    metadata.orderNo,
    metadata.order_no,
    metadata.orderIdBase,
    metadata.order_id_base,
    referrerPayment.orderNo,
    referrerPayment.order_no,
    referrerPayment.orderId,
    referrerPayment.order_id,
  ];
  for (const candidate of candidates) {
    const value = readString(candidate);
    if (!value) continue;
    keys.add(value);
    keys.add(value.replace(/-P\d+$/, ""));
  }
  return [...keys].filter(Boolean);
};

const bestLedgerEntryForOrder = (entries: RemoteLedgerEntry[]) => {
  const paymentEntries = entries.filter((entry) => entry.touchpoint === "payment_success");
  return (
    paymentEntries.find((entry) => readString(entry.paymentStatus) === "confirmed")
    ?? paymentEntries[0]
    ?? entries[0]
    ?? null
  );
};

const buildGa4CrossCheckUnavailable = (warning: string): TikTokRoasComparison["ga4_cross_check"] => ({
  source: "ga4_session_source_transaction_joined_with_operational_vm_ledger",
  dataSource: "GA4 Data API + operational_vm_ledger",
  available: false,
  confidence: "unavailable",
  warning,
  totals: {
    ga4Rows: 0,
    ga4Events: 0,
    ga4Revenue: 0,
    numericTransactionRows: 0,
    npayTransactionRows: 0,
    blankTransactionEvents: 0,
    blankTransactionRevenue: 0,
    ledgerConfirmedRows: 0,
    ledgerConfirmedRevenue: 0,
    ledgerConfirmedAmount: 0,
    ledgerCanceledRows: 0,
    ledgerCanceledRevenue: 0,
    noLedgerMatchRows: 0,
    noLedgerMatchRevenue: 0,
    confirmedWithTikTokLedgerSignals: 0,
    confirmedWithOtherLedgerSource: 0,
    confirmedWithMissingLedgerSource: 0,
  },
  notes: [
    "GA4 교차검증은 TJ 관리 Attribution VM strict confirmed를 대체하지 않는다.",
    "GA4 session source가 TikTok이어도 TJ 관리 Attribution VM ledger의 landing/UTM/ttclid와 충돌하면 중간 신뢰 지표로만 본다.",
  ],
  samples: [],
});

const buildGa4CrossCheck = async (
  startDate: string,
  endDate: string,
  ledgerEntries: RemoteLedgerEntry[],
): Promise<TikTokRoasComparison["ga4_cross_check"]> => {
  let ga4Rows: GA4TikTokTransactionRow[] = [];
  let warning: string | null = null;
  try {
    const ga4 = await queryGA4TikTokTransactions({ startDate, endDate });
    ga4Rows = ga4.rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 TikTok transaction query failed";
    return buildGa4CrossCheckUnavailable(message);
  }

  const ledgerByOrder = new Map<string, RemoteLedgerEntry[]>();
  for (const entry of ledgerEntries) {
    for (const key of ledgerOrderKeys(entry)) {
      const bucket = ledgerByOrder.get(key) ?? [];
      bucket.push(entry);
      ledgerByOrder.set(key, bucket);
    }
  }

  const numericRows = ga4Rows.filter((row) => /^\d{12,}$/.test(row.transactionId));
  const joined = numericRows.map((row) => {
    const entries = ledgerByOrder.get(row.transactionId) ?? [];
    const best = bestLedgerEntryForOrder(entries);
    const reasons = best ? getTikTokMatchReasons(best) : [];
    const metadata = best ? getMetadata(best) : {};
    return {
      row,
      entries,
      best,
      reasons,
      ledgerAmount: best ? readEntryAmount(best) : 0,
      ledgerStatus: best ? readString(best.paymentStatus) : "",
      ledgerUtmSource: best ? readString(best.utmSource) : "",
      ledgerUtmMedium: best ? readString(best.utmMedium) : "",
      hasAnyLedgerSource: Boolean(
        readString(best?.utmSource)
        || readString(best?.utmMedium)
        || readString(best?.utmCampaign)
        || readString(best?.landing)
        || readString(metadata.imweb_landing_url)
        || readString(metadata.initial_referrer)
        || readString(metadata.original_referrer),
      ),
    };
  });

  const blankRows = ga4Rows.filter((row) => {
    const normalized = row.transactionId.trim().toLowerCase();
    return !normalized || normalized === "(not set)" || normalized === "not set";
  });

  const ledgerConfirmed = joined.filter((item) => item.ledgerStatus === "confirmed");
  const ledgerCanceled = joined.filter((item) => item.ledgerStatus === "canceled");
  const noLedgerMatch = joined.filter((item) => item.entries.length === 0);
  const confirmedWithTikTokLedgerSignals = ledgerConfirmed.filter((item) => item.reasons.length > 0);
  const confirmedWithOtherLedgerSource = ledgerConfirmed.filter(
    (item) => item.reasons.length === 0 && item.hasAnyLedgerSource,
  );
  const confirmedWithMissingLedgerSource = ledgerConfirmed.filter(
    (item) => item.reasons.length === 0 && !item.hasAnyLedgerSource,
  );

  if (ga4Rows.length > 0 && numericRows.length === 0) {
    warning = "GA4 TikTok session-source 구매는 있으나 숫자형 transactionId가 없어 운영 주문 원장과 조인하지 못했다.";
  }

  return {
    source: "ga4_session_source_transaction_joined_with_operational_vm_ledger",
    dataSource: "GA4 Data API + operational_vm_ledger",
    available: true,
    confidence: "medium",
    warning,
    totals: {
      ga4Rows: ga4Rows.length,
      ga4Events: ga4Rows.reduce((sum, row) => sum + row.eventCount, 0),
      ga4Revenue: Math.round(ga4Rows.reduce((sum, row) => sum + row.grossPurchaseRevenue, 0)),
      numericTransactionRows: numericRows.length,
      npayTransactionRows: ga4Rows.filter((row) => /^NPAY\s-/i.test(row.transactionId)).length,
      blankTransactionEvents: blankRows.reduce((sum, row) => sum + row.eventCount, 0),
      blankTransactionRevenue: Math.round(blankRows.reduce((sum, row) => sum + row.grossPurchaseRevenue, 0)),
      ledgerConfirmedRows: ledgerConfirmed.length,
      ledgerConfirmedRevenue: Math.round(ledgerConfirmed.reduce((sum, item) => sum + item.row.grossPurchaseRevenue, 0)),
      ledgerConfirmedAmount: Math.round(ledgerConfirmed.reduce((sum, item) => sum + item.ledgerAmount, 0)),
      ledgerCanceledRows: ledgerCanceled.length,
      ledgerCanceledRevenue: Math.round(ledgerCanceled.reduce((sum, item) => sum + item.row.grossPurchaseRevenue, 0)),
      noLedgerMatchRows: noLedgerMatch.length,
      noLedgerMatchRevenue: Math.round(noLedgerMatch.reduce((sum, item) => sum + item.row.grossPurchaseRevenue, 0)),
      confirmedWithTikTokLedgerSignals: confirmedWithTikTokLedgerSignals.length,
      confirmedWithOtherLedgerSource: confirmedWithOtherLedgerSource.length,
      confirmedWithMissingLedgerSource: confirmedWithMissingLedgerSource.length,
    },
    notes: [
      "GA4 sessionSource/sessionMedium에 tiktok이 포함된 purchase를 transactionId로 TJ 관리 Attribution VM ledger와 조인했다.",
      "이 값은 TikTok high-confidence confirmed가 아니라 GA4 session-source 중간 신뢰 검산이다.",
      "TJ 관리 Attribution VM ledger의 ttclid/UTM/landing에 TikTok 신호가 없으면 strict internal confirmed에는 반영하지 않는다.",
    ],
    samples: joined.slice(0, 24).map((item) => ({
      date: item.row.date,
      transactionId: item.row.transactionId,
      sessionSource: item.row.sessionSource,
      sessionMedium: item.row.sessionMedium,
      ga4Revenue: Math.round(item.row.grossPurchaseRevenue),
      ledgerStatus: item.ledgerStatus || "no_ledger_match",
      ledgerAmount: Math.round(item.ledgerAmount),
      ledgerUtmSource: item.ledgerUtmSource,
      ledgerUtmMedium: item.ledgerUtmMedium,
      ledgerTikTokMatchReasons: item.reasons,
    })),
  };
};

const fetchOperationalLedger = async (startDate: string, endDate: string) => {
  const url = new URL("/api/attribution/ledger", OPERATIONAL_ATTRIBUTION_BASE_URL);
  url.searchParams.set("source", TIKTOK_SOURCE);
  url.searchParams.set("limit", "10000");
  url.searchParams.set("startAt", toKstStartIso(startDate));
  url.searchParams.set("endAt", toKstEndExclusiveIso(endDate));

  const response = await fetch(url, {
    headers: { "user-agent": "biocom-seo-local-tiktok-roas/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as RemoteLedgerBody;
  if (!response.ok || body.ok !== true || !Array.isArray(body.items)) {
    throw new Error(`operational VM ledger fetch failed: HTTP ${response.status}`);
  }
  return body.items.filter(isRecord) as RemoteLedgerEntry[];
};

const fetchOperationalTikTokPixelEvents = async (startDate: string, endDate: string) => {
  const startAt = toKstStartIso(startDate);
  const endAt = toKstEndExclusiveIso(endDate);
  const url = new URL("/api/attribution/tiktok-pixel-events", OPERATIONAL_ATTRIBUTION_BASE_URL);
  url.searchParams.set("startAt", startAt);
  url.searchParams.set("endAt", endAt);
  url.searchParams.set("limit", "10000");

  const response = await fetch(url, {
    headers: { "user-agent": "biocom-seo-local-tiktok-roas/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as RemoteTikTokPixelEventsBody;
  if (!response.ok || body.ok !== true || !Array.isArray(body.items)) {
    throw new Error(`operational VM TikTok pixel event fetch failed: HTTP ${response.status}`);
  }

  return {
    startAt,
    endAt,
    storage: readString(body.storage) || "CRM_LOCAL_DB_PATH#tiktok_pixel_events",
    events: body.items.filter(isRecord) as RemoteTikTokPixelEvent[],
  };
};

const eventOrderKey = (event: RemoteTikTokPixelEvent) =>
  readString(event.orderCode) || readString(event.orderNo) || readString(event.eventId) || "(unknown)";

const countEventsBy = (
  events: RemoteTikTokPixelEvent[],
  pick: (event: RemoteTikTokPixelEvent) => string,
) => {
  const result: Record<string, number> = {};
  for (const event of events) {
    const key = pick(event) || "(none)";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};

const buildTikTokEventLogSummary = (
  params: {
    startAt: string;
    endAt: string;
    storage: string;
    events: RemoteTikTokPixelEvent[];
    fetchWarning?: string;
  },
): TikTokRoasComparison["tiktok_event_log"] => {
  const productionEvents = params.events.filter((event) => readString(event.action) !== "smoke_test");
  const grouped = new Map<string, RemoteTikTokPixelEvent[]>();
  const anomalies: string[] = [];
  const warnings: string[] = [];
  if (params.fetchWarning) warnings.push(params.fetchWarning);

  for (const event of productionEvents) {
    const key = eventOrderKey(event);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(event);
  }

  let missingFinalActionOrders = 0;
  for (const [orderKey, events] of grouped.entries()) {
    const actionSet = new Set(events.map((event) => readString(event.action)));
    if (actionSet.has("purchase_intercepted")) {
      const hasFinal =
        actionSet.has("released_confirmed_purchase") ||
        actionSet.has("released_unknown_purchase") ||
        actionSet.has("blocked_pending_purchase") ||
        actionSet.has("request_error");
      if (!hasFinal) {
        missingFinalActionOrders += 1;
        warnings.push(`final action missing for ${orderKey}`);
      }
    }
    if (actionSet.has("sent_replacement_place_an_order") && !actionSet.has("blocked_pending_purchase")) {
      anomalies.push(`replacement without blocked_pending_purchase for ${orderKey}`);
    }
  }

  for (const event of productionEvents) {
    const action = readString(event.action);
    const status = readString(event.decisionStatus);
    const branch = readString(event.decisionBranch);
    const orderKey = eventOrderKey(event);
    if (action === "released_confirmed_purchase" && (status !== "confirmed" || branch !== "allow_purchase")) {
      anomalies.push(`non-confirmed release for ${orderKey}: ${status}/${branch}`);
    }
    if (action === "blocked_pending_purchase" && (status !== "pending" || branch !== "block_purchase_virtual_account")) {
      warnings.push(`non-standard pending block for ${orderKey}: ${status}/${branch}`);
    }
    if (action === "released_unknown_purchase") {
      warnings.push(`fail-open unknown release for ${orderKey}`);
    }
    if (action === "request_error") {
      warnings.push(`request_error for ${orderKey}`);
    }
  }

  const finalPriority = [
    "released_confirmed_purchase",
    "released_unknown_purchase",
    "blocked_pending_purchase",
    "request_error",
    "sent_replacement_place_an_order",
    "decision_received",
    "purchase_intercepted",
  ];
  const sampleOrders = [...grouped.entries()]
    .map(([orderKey, events]) => {
      const sorted = events
        .slice()
        .sort((left, right) => readString(right.loggedAt).localeCompare(readString(left.loggedAt)));
      const finalEvent =
        finalPriority
          .map((action) => sorted.find((event) => readString(event.action) === action))
          .find(Boolean) ?? sorted[0];
      return {
        loggedAt: readString(finalEvent?.loggedAt),
        orderKey,
        orderNo: [...new Set(events.map((event) => readString(event.orderNo)).filter(Boolean))].join(", "),
        paymentCode: [...new Set(events.map((event) => readString(event.paymentCode)).filter(Boolean))].join(", "),
        value: finalEvent ? parseNumber(finalEvent.value) : null,
        currency: readString(finalEvent?.currency) || "KRW",
        finalAction: readString(finalEvent?.action),
        actions: [...new Set(events.map((event) => readString(event.action)).filter(Boolean))],
        decisionStatus: readString(finalEvent?.decisionStatus) || "unknown",
        decisionBranch: readString(finalEvent?.decisionBranch) || "unknown",
        replacementEventName: readString(finalEvent?.replacementEventName),
        eventId: readString(finalEvent?.eventId),
      };
    })
    .sort((left, right) => right.loggedAt.localeCompare(left.loggedAt))
    .slice(0, 12);

  const countsByAction = countEventsBy(productionEvents, (event) => readString(event.action));

  return {
    source: "operational_vm_tiktok_pixel_events",
    storage: params.storage,
    startAt: params.startAt,
    endAt: params.endAt,
    fetchedEvents: productionEvents.length,
    uniqueOrderKeys: grouped.size,
    countsByAction,
    countsByDecisionStatus: countEventsBy(productionEvents, (event) => readString(event.decisionStatus)),
    countsByDecisionBranch: countEventsBy(productionEvents, (event) => readString(event.decisionBranch)),
    finalActionSummary: {
      releasedConfirmedPurchase: countsByAction.released_confirmed_purchase ?? 0,
      blockedPendingPurchase: countsByAction.blocked_pending_purchase ?? 0,
      sentReplacementPlaceAnOrder: countsByAction.sent_replacement_place_an_order ?? 0,
      releasedUnknownPurchase: countsByAction.released_unknown_purchase ?? 0,
      requestError: countsByAction.request_error ?? 0,
      missingFinalActionOrders,
      anomalyCount: anomalies.length,
      warningCount: warnings.length,
    },
    sampleOrders,
    anomalies,
    warnings,
  };
};

const statusKey = (entry: RemoteLedgerEntry): "confirmed" | "pending" | "canceled" | "unknown" => {
  const status = readString(entry.paymentStatus);
  if (status === "confirmed" || status === "pending" || status === "canceled") return status;
  return "unknown";
};

const buildOperationalSummary = (entries: RemoteLedgerEntry[]) => {
  const byStatus: Record<"confirmed" | "pending" | "canceled" | "unknown", StatusAggregate & { orderSet: Set<string> }> = {
    confirmed: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    pending: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    canceled: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    unknown: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
  };
  const sourceReasonSummary: Record<string, SourceReasonAggregate & { orderSet: Set<string> }> = {};
  const sourcePrecisionSummary: Record<SourcePrecisionTier, SourceReasonAggregate & { orderSet: Set<string> }> = {
    high: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    medium: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    low: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
  };
  const pendingFateSummary: Record<TikTokAuditFate, SourceReasonAggregate & { orderSet: Set<string> }> = {
    confirmed_later: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    expired_unpaid: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    canceled: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    false_attribution: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
    still_pending: { rows: 0, orders: 0, amount: 0, orderSet: new Set() },
  };
  const samples: TikTokRoasComparison["operational_ledger"]["sampleOrders"] = [];
  const pendingAuditCandidates: TikTokAuditOrder[] = [];

  for (const entry of entries.filter(isTikTokPaymentSuccess)) {
    const key = statusKey(entry);
    const aggregate = byStatus[key];
    const amount = readEntryAmount(entry);
    const orderKey = readString(entry.orderId) || readString(entry.paymentKey) || readString(entry.loggedAt);
    const sourceMatchReasons = getTikTokMatchReasons(entry);
    const precisionTier = precisionTierForReasons(sourceMatchReasons);
    const ageHours = hoursSince(entry.loggedAt);
    const overVirtualAccountExpiry = ageHours !== null && ageHours >= VIRTUAL_ACCOUNT_EXPIRY_HOURS;
    const auditOrder: TikTokAuditOrder = {
      loggedAt: readString(entry.loggedAt),
      orderId: readString(entry.orderId),
      paymentKey: readString(entry.paymentKey),
      paymentStatus: key,
      amount,
      utmSource: readString(entry.utmSource),
      utmCampaign: readString(entry.utmCampaign),
      hasTtclid: Boolean(readString(entry.ttclid)) || sourceMatchReasons.some((reason) => reason.includes("ttclid")),
      sourceMatchReasons,
      precisionTier,
      ageHours,
      overVirtualAccountExpiry,
      expiryCutoffAt: isoAfterHours(entry.loggedAt, VIRTUAL_ACCOUNT_EXPIRY_HOURS),
      firstSeenAt: readString(entry.loggedAt),
      lastStatusAt: readString(entry.loggedAt),
      fate: pendingFateForStatus(key, overVirtualAccountExpiry),
      evidence: evidenceForEntry(entry),
    };

    aggregate.rows += 1;
    aggregate.amount += amount;
    aggregate.orderSet.add(orderKey);
    sourcePrecisionSummary[precisionTier].rows += 1;
    sourcePrecisionSummary[precisionTier].amount += amount;
    sourcePrecisionSummary[precisionTier].orderSet.add(orderKey);
    for (const reason of sourceMatchReasons) {
      const reasonAggregate = sourceReasonSummary[reason] ?? {
        rows: 0,
        orders: 0,
        amount: 0,
        orderSet: new Set<string>(),
      };
      reasonAggregate.rows += 1;
      reasonAggregate.amount += amount;
      reasonAggregate.orderSet.add(orderKey);
      sourceReasonSummary[reason] = reasonAggregate;
    }
    if (key === "pending") {
      const fateAggregate = pendingFateSummary[auditOrder.fate];
      fateAggregate.rows += 1;
      fateAggregate.amount += amount;
      fateAggregate.orderSet.add(orderKey);
      pendingAuditCandidates.push(auditOrder);
    }
    if (samples.length < 10) {
      samples.push({
        loggedAt: auditOrder.loggedAt,
        orderId: auditOrder.orderId,
        paymentStatus: key,
        amount,
        utmSource: auditOrder.utmSource,
        utmCampaign: auditOrder.utmCampaign,
        hasTtclid: auditOrder.hasTtclid,
        sourceMatchReasons,
        precisionTier,
      });
    }
  }

  const cleaned = Object.fromEntries(
    Object.entries(byStatus).map(([key, value]) => [
      key,
      {
        rows: value.rows,
        orders: value.orderSet.size,
        amount: Math.round(value.amount),
      },
    ]),
  ) as TikTokRoasComparison["operational_ledger"]["byStatus"];
  const cleanedReasonSummary = Object.fromEntries(
    Object.entries(sourceReasonSummary)
      .sort(([, left], [, right]) => right.amount - left.amount)
      .map(([key, value]) => [
        key,
        {
          rows: value.rows,
          orders: value.orderSet.size,
          amount: Math.round(value.amount),
        },
      ]),
  );
  const cleanedPrecisionSummary = Object.fromEntries(
    Object.entries(sourcePrecisionSummary).map(([key, value]) => [
      key,
      {
        rows: value.rows,
        orders: value.orderSet.size,
        amount: Math.round(value.amount),
      },
    ]),
  ) as Record<SourcePrecisionTier, SourceReasonAggregate>;
  const cleanedPendingFateSummary = Object.fromEntries(
    Object.entries(pendingFateSummary).map(([key, value]) => [
      key,
      {
        rows: value.rows,
        orders: value.orderSet.size,
        amount: Math.round(value.amount),
      },
    ]),
  ) as Record<TikTokAuditFate, SourceReasonAggregate>;

  return {
    byStatus: cleaned,
    tiktokPaymentSuccessRows: Object.values(cleaned).reduce((sum, value) => sum + value.rows, 0),
    sourceReasonSummary: cleanedReasonSummary,
    sourcePrecisionSummary: cleanedPrecisionSummary,
    pendingFateSummary: cleanedPendingFateSummary,
    pendingAuditTop20: pendingAuditCandidates
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 20),
    samples,
  };
};

const buildFirstTouchAttributionSummary = (
  entries: RemoteLedgerEntry[],
): TikTokRoasComparison["first_touch_attribution"] => {
  const byStatus: Record<"confirmed" | "pending" | "canceled" | "unknown", StatusAggregate & { orderSet: Set<string> }> = {
    confirmed: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    pending: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    canceled: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
    unknown: { orders: 0, rows: 0, amount: 0, orderSet: new Set() },
  };
  const sourceReasonSummary: Record<string, SourceReasonAggregate & { orderSet: Set<string> }> = {};
  const sampleOrders: TikTokRoasComparison["first_touch_attribution"]["sampleOrders"] = [];
  let candidatePaymentSuccessRows = 0;
  let strictOverlapRows = 0;

  for (const entry of entries.filter((item) => item.touchpoint === "payment_success")) {
    const firstTouchMatchReasons = getFirstTouchTikTokMatchReasons(entry);
    if (firstTouchMatchReasons.length === 0) continue;

    if (getTikTokMatchReasons(entry).length > 0) {
      strictOverlapRows += 1;
      continue;
    }

    candidatePaymentSuccessRows += 1;
    const key = statusKey(entry);
    const aggregate = byStatus[key];
    const amount = readEntryAmount(entry);
    const orderKey = readString(entry.orderId) || readString(entry.paymentKey) || readString(entry.loggedAt);
    aggregate.rows += 1;
    aggregate.amount += amount;
    aggregate.orderSet.add(orderKey);

    for (const reason of firstTouchMatchReasons) {
      const reasonAggregate = sourceReasonSummary[reason] ?? {
        rows: 0,
        orders: 0,
        amount: 0,
        orderSet: new Set<string>(),
      };
      reasonAggregate.rows += 1;
      reasonAggregate.amount += amount;
      reasonAggregate.orderSet.add(orderKey);
      sourceReasonSummary[reason] = reasonAggregate;
    }

    if (sampleOrders.length < 10) {
      const firstTouch = getFirstTouchMetadata(entry);
      const firstTouchMatch = getFirstTouchMatchMetadata(entry);
      sampleOrders.push({
        loggedAt: readString(entry.loggedAt),
        orderId: readString(entry.orderId),
        paymentStatus: key,
        amount,
        firstTouchLoggedAt: readString(firstTouch.loggedAt),
        firstTouchSource: readString(firstTouch.source),
        firstTouchUtmSource: readString(firstTouch.utmSource),
        firstTouchUtmCampaign: readString(firstTouch.utmCampaign),
        firstTouchHasTtclid: Boolean(readString(firstTouch.ttclid)) ||
          firstTouchMatchReasons.some((reason) => reason.includes("ttclid")),
        firstTouchMatchReasons,
        matchedBy: readStringArray(firstTouchMatch.matchedBy),
        matchScore: parseNumber(firstTouchMatch.matchScore),
      });
    }
  }

  const cleaned = Object.fromEntries(
    Object.entries(byStatus).map(([key, value]) => [
      key,
      {
        rows: value.rows,
        orders: value.orderSet.size,
        amount: Math.round(value.amount),
      },
    ]),
  ) as TikTokRoasComparison["first_touch_attribution"]["byStatus"];

  const cleanedReasonSummary = Object.fromEntries(
    Object.entries(sourceReasonSummary)
      .sort(([, left], [, right]) => right.amount - left.amount)
      .map(([key, value]) => [
        key,
        {
          rows: value.rows,
          orders: value.orderSet.size,
          amount: Math.round(value.amount),
        },
      ]),
  );

  return {
    source: "tj_managed_attribution_vm_first_touch",
    storage: "CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch",
    candidatePaymentSuccessRows,
    strictOverlapRows,
    byStatus: cleaned,
    sourceReasonSummary: cleanedReasonSummary,
    sampleOrders,
    note: "strict TikTok payment_success에는 직접 포함하지 않는다. checkout_started firstTouch에 TikTok UTM/ttclid가 보존된 payment_success 후보만 별도 집계한다.",
  };
};

const adsSummary = (rows: TikTokAdsCampaignRangeRow[]) => {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const netCost = rows.reduce((sum, row) => sum + row.net_cost, 0);
  const purchaseValue = rows.reduce((sum, row) => sum + row.all_channels_purchase_value_inferred, 0);
  return {
    spend: Math.round(spend),
    netCost: Math.round(netCost),
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    destinationClicks: rows.reduce((sum, row) => sum + row.destination_clicks, 0),
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    purchases: rows.reduce((sum, row) => sum + row.all_channels_total_purchases, 0),
    purchaseValue: Math.round(purchaseValue),
    ctaPurchaseCount: 0,
    evtaPurchaseCount: 0,
    vtaPurchaseCount: 0,
    platformRoas: spend > 0 ? round(purchaseValue / spend) : null,
    ctaPurchaseRoas: null as number | null,
    evtaPurchaseRoas: null as number | null,
    vtaPurchaseRoas: null as number | null,
    currency: rows.find((row) => row.currency)?.currency ?? "KRW",
  };
};

const dailyAdsSummary = (rows: DailyAdsAggregate[]): TikTokRoasComparison["ads_report"]["summary"] => {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const netCost = rows.reduce((sum, row) => sum + row.netCost, 0);
  const purchaseValue = rows.reduce((sum, row) => sum + row.platformPurchaseValue, 0);
  const ctaPurchaseValue = rows.reduce((sum, row) => sum + row.ctaPurchaseValue, 0);
  const evtaPurchaseValue = rows.reduce((sum, row) => sum + row.evtaPurchaseValue, 0);
  const vtaPurchaseValue = rows.reduce((sum, row) => sum + row.vtaPurchaseValue, 0);
  return {
    spend: Math.round(spend),
    netCost: Math.round(netCost),
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    destinationClicks: rows.reduce((sum, row) => sum + row.destinationClicks, 0),
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    purchases: rows.reduce((sum, row) => sum + row.platformPurchases, 0),
    purchaseValue: Math.round(purchaseValue),
    ctaPurchaseCount: rows.reduce((sum, row) => sum + row.ctaPurchaseCount, 0),
    evtaPurchaseCount: rows.reduce((sum, row) => sum + row.evtaPurchaseCount, 0),
    vtaPurchaseCount: rows.reduce((sum, row) => sum + row.vtaPurchaseCount, 0),
    platformRoas: spend > 0 ? round(purchaseValue / spend) : null,
    ctaPurchaseRoas: spend > 0 && ctaPurchaseValue > 0 ? round(ctaPurchaseValue / spend) : null,
    evtaPurchaseRoas: spend > 0 && evtaPurchaseValue > 0 ? round(evtaPurchaseValue / spend) : null,
    vtaPurchaseRoas: spend > 0 && vtaPurchaseValue > 0 ? round(vtaPurchaseValue / spend) : null,
    currency: "KRW",
  };
};

const emptyDailyStatus = (): DailyStatusAggregate => ({
  orders: 0,
  rows: 0,
  amount: 0,
  orderSet: new Set<string>(),
});

const emptyDailyStatuses = () => ({
  confirmed: emptyDailyStatus(),
  pending: emptyDailyStatus(),
  canceled: emptyDailyStatus(),
  unknown: emptyDailyStatus(),
});

const addDailyStatusEntry = (aggregate: DailyStatusAggregate, entry: RemoteLedgerEntry) => {
  const orderKey = readString(entry.orderId) || readString(entry.paymentKey) || readString(entry.loggedAt);
  aggregate.rows += 1;
  aggregate.amount += readEntryAmount(entry);
  aggregate.orderSet.add(orderKey);
};

const buildDailyOperationalMap = (entries: RemoteLedgerEntry[], startDate: string, endDate: string) => {
  const map = new Map<string, ReturnType<typeof emptyDailyStatuses>>();

  for (const entry of entries.filter(isTikTokPaymentSuccess)) {
    const date = toKstDate(entry.loggedAt);
    if (!date || date < startDate || date > endDate) continue;
    const statuses = map.get(date) ?? emptyDailyStatuses();
    addDailyStatusEntry(statuses[statusKey(entry)], entry);
    map.set(date, statuses);
  }

  return map;
};

const guardPhaseForDate = (date: string): TikTokRoasComparison["daily_comparison"]["rows"][number]["guardPhase"] => {
  if (date < "2026-04-17") return "pre_guard";
  if (date === "2026-04-17") return "guard_start";
  return "post_guard";
};

const emptyDailyAdsAggregate = (date: string): DailyAdsAggregate => ({
  date,
  spend: 0,
  netCost: 0,
  impressions: 0,
  destinationClicks: 0,
  clicks: 0,
  conversions: 0,
  platformPurchases: 0,
  platformPurchaseValue: 0,
  ctaPurchaseCount: 0,
  evtaPurchaseCount: 0,
  vtaPurchaseCount: 0,
  ctaPurchaseValue: 0,
  evtaPurchaseValue: 0,
  vtaPurchaseValue: 0,
});

const summarizeDailyComparisonRows = (rows: TikTokRoasComparison["daily_comparison"]["rows"]) => {
  const platformSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const platformPurchaseValue = rows.reduce((sum, row) => sum + row.platformPurchaseValue, 0);
  const platformPurchases = rows.reduce((sum, row) => sum + row.platformPurchases, 0);
  const ctaPurchaseCount = rows.reduce((sum, row) => sum + row.ctaPurchaseCount, 0);
  const evtaPurchaseCount = rows.reduce((sum, row) => sum + row.evtaPurchaseCount, 0);
  const vtaPurchaseCount = rows.reduce((sum, row) => sum + row.vtaPurchaseCount, 0);
  const confirmedRevenue = rows.reduce((sum, row) => sum + row.confirmedRevenue, 0);
  const pendingRevenue = rows.reduce((sum, row) => sum + row.pendingRevenue, 0);
  const canceledRevenue = rows.reduce((sum, row) => sum + row.canceledRevenue, 0);
  return {
    days: rows.length,
    daysWithSpend: rows.filter((row) => row.spend > 0).length,
    platformSpend,
    platformPurchaseValue,
    platformPurchases,
    ctaPurchaseCount,
    evtaPurchaseCount,
    vtaPurchaseCount,
    unclassifiedPurchaseCount: Math.max(0, platformPurchases - ctaPurchaseCount - evtaPurchaseCount - vtaPurchaseCount),
    platformRoas: toRoas(platformPurchaseValue, platformSpend),
    confirmedRevenue,
    pendingRevenue,
    canceledRevenue,
    confirmedRoas: toRoas(confirmedRevenue, platformSpend),
    potentialRoas: toRoas(confirmedRevenue + pendingRevenue, platformSpend),
    platformMinusConfirmed: platformPurchaseValue - confirmedRevenue,
    platformMinusConfirmedAndPending: platformPurchaseValue - confirmedRevenue - pendingRevenue,
  };
};

const summarizeDailyGuardRows = (rows: TikTokRoasComparison["daily_comparison"]["rows"]) => {
  const summary = summarizeDailyComparisonRows(rows);
  return {
    days: summary.days,
    platformSpend: summary.platformSpend,
    platformPurchaseValue: summary.platformPurchaseValue,
    platformPurchases: summary.platformPurchases,
    ctaPurchaseCount: summary.ctaPurchaseCount,
    evtaPurchaseCount: summary.evtaPurchaseCount,
    vtaPurchaseCount: summary.vtaPurchaseCount,
    unclassifiedPurchaseCount: summary.unclassifiedPurchaseCount,
    platformRoas: summary.platformRoas,
    confirmedRevenue: summary.confirmedRevenue,
    pendingRevenue: summary.pendingRevenue,
    confirmedRoas: summary.confirmedRoas,
    potentialRoas: summary.potentialRoas,
    platformMinusConfirmed: summary.platformMinusConfirmed,
    platformMinusConfirmedAndPending: summary.platformMinusConfirmedAndPending,
  };
};

const buildDailyComparison = (
  startDate: string,
  endDate: string,
  dailyAdsRows: DailyAdsAggregate[],
  operationalEntries: RemoteLedgerEntry[],
): TikTokRoasComparison["daily_comparison"] => {
  const platformByDate = new Map(dailyAdsRows.map((row) => [row.date, row]));
  const operationalByDate = buildDailyOperationalMap(operationalEntries, startDate, endDate);
  const rows = eachDateInRange(startDate, endDate).map((date) => {
    const hasAdsData = platformByDate.has(date);
    const platform = platformByDate.get(date) ?? emptyDailyAdsAggregate(date);
    const operational = operationalByDate.get(date) ?? emptyDailyStatuses();
    const confirmedRevenue = Math.round(operational.confirmed.amount);
    const pendingRevenue = Math.round(operational.pending.amount);
    const canceledRevenue = Math.round(operational.canceled.amount);
    const spend = Math.round(platform.spend);
    const platformPurchaseValue = Math.round(platform.platformPurchaseValue);
    const platformPurchases = Math.round(platform.platformPurchases);
    const ctaPurchaseCount = Math.round(platform.ctaPurchaseCount);
    const evtaPurchaseCount = Math.round(platform.evtaPurchaseCount);
    const vtaPurchaseCount = Math.round(platform.vtaPurchaseCount);
    return {
      date,
      guardPhase: guardPhaseForDate(date),
      hasAdsData,
      spend,
      platformPurchases,
      platformPurchaseValue,
      platformRoas: toRoas(platformPurchaseValue, spend),
      ctaPurchaseCount,
      evtaPurchaseCount,
      vtaPurchaseCount,
      unclassifiedPurchaseCount: Math.max(0, platformPurchases - ctaPurchaseCount - evtaPurchaseCount - vtaPurchaseCount),
      ctaPurchaseValue: Math.round(platform.ctaPurchaseValue),
      evtaPurchaseValue: Math.round(platform.evtaPurchaseValue),
      vtaPurchaseValue: Math.round(platform.vtaPurchaseValue),
      confirmedOrders: operational.confirmed.orderSet.size,
      pendingOrders: operational.pending.orderSet.size,
      canceledOrders: operational.canceled.orderSet.size,
      confirmedRevenue,
      pendingRevenue,
      canceledRevenue,
      confirmedRoas: toRoas(confirmedRevenue, spend),
      potentialRoas: toRoas(confirmedRevenue + pendingRevenue, spend),
      platformMinusConfirmed: platformPurchaseValue - confirmedRevenue,
      platformMinusConfirmedAndPending: platformPurchaseValue - confirmedRevenue - pendingRevenue,
    };
  });

  return {
    source: "tiktok_ads_daily_joined_with_operational_vm_ledger",
    summary: summarizeDailyComparisonRows(rows),
    guardBreakdown: {
      pre_guard: summarizeDailyGuardRows(rows.filter((row) => row.guardPhase === "pre_guard")),
      guard_start_and_after: summarizeDailyGuardRows(rows.filter((row) => row.guardPhase !== "pre_guard")),
    },
    rows,
  };
};

export const buildTikTokRoasComparison = async (params: {
  startDate?: string;
  endDate?: string;
  autoIngest?: boolean;
}): Promise<TikTokRoasComparison> => {
  const importedRows = await importProcessedCsvFiles();
  let dailyImportedRows = await importProcessedDailyCsvFiles();
  const selected = params.startDate && params.endDate
    ? { start_date: params.startDate, end_date: params.endDate }
    : defaultRange();
  const startDate = selected.start_date;
  const endDate = selected.end_date;
  const autoIngestState: TikTokRoasComparison["local_table"]["daily"]["autoIngest"] = {
    attempted: false,
    ok: false,
    message: null,
    startDate: null,
    endDate: null,
    rows: null,
    fetchedAt: null,
  };

  if (params.autoIngest !== false) {
    try {
      const { ensureTikTokDailyCovers } = await import("./tiktokAdsAutoSync");
      const result = await ensureTikTokDailyCovers(startDate, endDate);
      autoIngestState.attempted = result.attempted;
      autoIngestState.ok = result.ok;
      autoIngestState.message = result.message ?? null;
      autoIngestState.startDate = result.startDate;
      autoIngestState.endDate = result.endDate;
      autoIngestState.rows = result.rows;
      autoIngestState.fetchedAt = result.fetchedAt;
      if (result.attempted && result.ok) {
        dailyImportedRows += await importProcessedDailyCsvFiles();
      }
    } catch (error) {
      autoIngestState.attempted = true;
      autoIngestState.ok = false;
      autoIngestState.message = error instanceof Error ? error.message : "auto ingest failed";
    }
  }

  const availableRanges = listAvailableRanges();
  const dailyTableState = getDailyTableState();
  const rows = loadAdsRows(startDate, endDate);
  const dailyAdsRows = loadDailyAdsRows(startDate, endDate);
  const warnings: string[] = [];

  if (rows.length === 0 && dailyAdsRows.length === 0) {
    warnings.push(`TikTok Ads 로컬 테이블에 ${startDate} ~ ${endDate} 행이 없다.`);
  }
  if (rows.length === 0 && dailyAdsRows.length > 0) {
    warnings.push(`기간 합계 테이블에는 ${startDate} ~ ${endDate} 행이 없어 일자별 TikTok Ads 테이블 합계로 상단 요약을 계산한다.`);
  }

  const remoteEntries = await fetchOperationalLedger(startDate, endDate);
  const pixelEventsResult = await fetchOperationalTikTokPixelEvents(startDate, endDate)
    .catch((error) => ({
      startAt: toKstStartIso(startDate),
      endAt: toKstEndExclusiveIso(endDate),
      storage: "CRM_LOCAL_DB_PATH#tiktok_pixel_events",
      events: [] as RemoteTikTokPixelEvent[],
      fetchWarning: error instanceof Error ? error.message : "operational VM TikTok pixel event fetch failed",
    }));
  const operational = buildOperationalSummary(remoteEntries);
  const firstTouchAttribution = buildFirstTouchAttributionSummary(remoteEntries);
  const ga4CrossCheck = await buildGa4CrossCheck(startDate, endDate, remoteEntries)
    .catch((error) => buildGa4CrossCheckUnavailable(
      error instanceof Error ? error.message : "GA4 TikTok cross-check failed",
    ));
  const tiktokEventLog = buildTikTokEventLogSummary(pixelEventsResult);
  const summary = rows.length > 0 ? adsSummary(rows) : dailyAdsSummary(dailyAdsRows);
  const dailyComparison = buildDailyComparison(startDate, endDate, dailyAdsRows, remoteEntries);
  const confirmedRevenue = operational.byStatus.confirmed.amount;
  const pendingRevenue = operational.byStatus.pending.amount;
  const canceledRevenue = operational.byStatus.canceled.amount;
  const platformPurchaseValue = summary.purchaseValue;
  const spend = summary.spend;
  const platformMinusConfirmed = platformPurchaseValue - confirmedRevenue;
  const platformMinusConfirmedAndPending = platformPurchaseValue - confirmedRevenue - pendingRevenue;

  if (rows.some((row) => row.attribution_window_note.includes("assume TikTok default"))) {
    warnings.push("TikTok export에 어트리뷰션 윈도우 컬럼이 없어 Click 7일 / View 1일 기본값으로 표기한다.");
  }
  if (rows.some((row) => row.all_channels_purchase_value_inferred > 0)) {
    warnings.push("한국어 export의 중복 구매 헤더를 구매값으로 추정했다. Ads Manager 화면에서 한 번 대조 필요.");
  }
  const campaignRowsFromDailyAggregate = rows.some((row) => row.granularity === "daily_campaign_aggregate");

  return {
    ok: true,
    start_date: startDate,
    end_date: endDate,
    attribution_window: {
      source: "assumed_default",
      click: "7d",
      view: "1d",
      note: "TikTok export에 어트리뷰션 윈도우 컬럼이 없어 프로젝트 기준 기본값으로 둔다.",
    },
    local_table: {
      name: TIKTOK_ADS_TABLE,
      importedRows,
      matchedRows: rows.length,
      daily: {
        name: TIKTOK_ADS_DAILY_TABLE,
        importedRows: dailyImportedRows,
        rows: dailyTableState.rows,
        minDate: dailyTableState.minDate,
        maxDate: dailyTableState.maxDate,
        readyForImport: dailyTableState.rows > 0,
        note: dailyTableState.rows > 0
          ? "일자별 TikTok Ads export가 적재되어 있다."
          : "아직 Date dimension이 있는 TikTok Ads export가 없어 스키마만 준비했다.",
        autoIngest: autoIngestState,
      },
      availableRanges,
    },
    ads_report: {
      source: "local_sqlite_from_tiktok_xlsx",
      campaignRows: rows.map((row) => ({
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        status: row.status,
        spend: Math.round(row.spend),
        purchases: row.all_channels_total_purchases,
        purchaseValue: Math.round(row.all_channels_purchase_value_inferred),
        platformRoas: row.spend > 0 ? round(row.all_channels_purchase_value_inferred / row.spend) : null,
        ctaPurchaseRoas: row.website_cta_purchase_roas || null,
        vtaPurchaseRoas: row.website_vta_purchase_roas || null,
      })),
      summary,
    },
    operational_ledger: {
      source: TIKTOK_SOURCE,
      dataSource: "operational_vm_ledger",
      fetchedEntries: remoteEntries.length,
      tiktokPaymentSuccessRows: operational.tiktokPaymentSuccessRows,
      byStatus: operational.byStatus,
      sourceReasonSummary: operational.sourceReasonSummary,
      sourcePrecisionSummary: operational.sourcePrecisionSummary,
      pendingFateSummary: operational.pendingFateSummary,
      pendingAuditTop20: operational.pendingAuditTop20,
      sampleOrders: operational.samples,
    },
    first_touch_attribution: firstTouchAttribution,
    ga4_cross_check: ga4CrossCheck,
    tiktok_event_log: tiktokEventLog,
    gap: {
      confirmedRevenue,
      pendingRevenue,
      canceledRevenue,
      platformPurchaseValue,
      platformMinusConfirmed,
      platformMinusConfirmedAndPending,
      confirmedRoas: spend > 0 ? round(confirmedRevenue / spend) : null,
      potentialRoas: spend > 0 ? round((confirmedRevenue + pendingRevenue) / spend) : null,
      overstatementVsConfirmedRatio: confirmedRevenue > 0 ? round(platformPurchaseValue / confirmedRevenue) : null,
    },
    daily_comparison: dailyComparison,
    warnings,
    notes: [
      "TJ 관리 Attribution VM은 read-only 조회만 수행한다.",
      "로컬 SQLite 테이블은 TikTok XLSX/CSV 처리 결과를 조회하기 위한 캐시다.",
      "first_touch_attribution은 TJ 관리 Attribution VM SQLite metadata_json.firstTouch 후보이며 strict confirmed 매출로 합산하지 않는다.",
      campaignRowsFromDailyAggregate
        ? "캠페인별 플랫폼 ROAS는 기간 합계 export가 없으면 일자별 campaign 테이블을 캠페인 단위로 합산해 계산한다."
        : "캠페인별 플랫폼 ROAS는 기간 합계 export 테이블 기준이다.",
      dailyTableState.rows > 0
        ? "일자별 export는 tiktok_ads_daily에 적재했지만, 현재 gap summary는 기간 합계 테이블 기준이다."
        : "일자별 export가 없으므로 현재 결과는 캠페인 기간 합계 기준이다.",
    ],
  };
};
