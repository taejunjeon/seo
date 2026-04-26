import express, { type Request, type Response } from "express";
import { google } from "googleapis";

import { readLedgerEntries, type AttributionLedgerEntry } from "../attribution";
import { env } from "../env";

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_CUSTOMER_ID = "2149990943";
const INTERNAL_LEDGER_SOURCE = "biocom_imweb";
const INTERNAL_LEDGER_LIMIT = 10000;
const KNOWN_NPAY_CONVERSION_LABELS = new Set([
  "r0vuCKvy-8caEJixj5EB",
  "3yjICOXRmJccEJixj5EB",
]);
const KST_TIME_ZONE = "Asia/Seoul";
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_PRESETS = {
  last_7d: "LAST_7_DAYS",
  last_14d: "LAST_14_DAYS",
  last_30d: "LAST_30_DAYS",
  last_90d: "LAST_90_DAYS",
} as const;

type DatePreset = keyof typeof DATE_PRESETS;

type DateRange = {
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  timezone: typeof KST_TIME_ZONE;
};

type GoogleAdsErrorSummary = {
  code?: number;
  status?: string;
  message?: string;
  requestId?: string | null;
  googleAdsErrors?: Array<{
    errorCode: unknown;
    message: string;
    fieldPath: string | null;
  }>;
  rawPreview?: string;
};

type GoogleAdsSearchResponse = {
  results?: unknown[];
  nextPageToken?: string;
  queryResourceConsumption?: string;
};

type GoogleAdsSearchResult =
  | {
      ok: true;
      status: number;
      body: GoogleAdsSearchResponse;
    }
  | {
      ok: false;
      status: number;
      body: GoogleAdsErrorSummary;
    };

type GoogleAdsClientContext = {
  token: string;
  customerId: string;
  apiVersion: string;
  developerToken: string;
  clientEmail: string | null;
  projectId: string | null;
};

type MetricTotals = {
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
};

type CampaignMetricRow = MetricTotals & {
  campaignId: string;
  campaignName: string;
  status: string;
  channel: string;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
};

type DailyMetricRow = MetricTotals & {
  date: string;
  roas: number | null;
};

type ConversionActionRow = {
  id: string;
  name: string;
  resourceName: string;
  status: string;
  type: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  clickThroughLookbackWindowDays: number | null;
  viewThroughLookbackWindowDays: number | null;
  defaultValue: number | null;
  alwaysUseDefaultValue: boolean;
  sendTo: string[];
  conversionId: string | null;
  conversionLabels: string[];
  snippetTypes: string[];
};

type ConversionActionSegmentCampaignRow = {
  conversionActionResourceName: string;
  conversionActionId: string | null;
  conversionActionName: string;
  campaignId: string;
  campaignName: string;
  channel: string;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  status: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  sendTo: string[];
  conversionLabels: string[];
  classification: string;
  riskFlags: string[];
};

type ConversionActionSegmentActionRow = Omit<
  ConversionActionSegmentCampaignRow,
  "campaignId" | "campaignName" | "channel"
> & {
  campaignCount: number;
  campaigns: string[];
  shareOfPlatformConversionValue: number | null;
  shareOfAllConversionValue: number | null;
};

type ConversionActionGapDriver = {
  key: string;
  label: string;
  value: number;
  shareOfPlatformConversionValue: number | null;
  confidence: "high" | "medium-high" | "medium";
  evidence: string;
  nextAction: string;
};

type InternalOrderStatus = "confirmed" | "pending" | "canceled";

type InternalOrder = {
  key: string;
  date: string;
  status: InternalOrderStatus;
  amount: number;
  campaignId: string | null;
  utmCampaign: string;
  hasClickId: boolean;
};

type InternalRevenueTotals = {
  orders: number;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
};

type InternalCampaignRow = InternalRevenueTotals & {
  campaignId: string | null;
  campaignName: string;
  platformCost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRoas: number | null;
  roasGap: number | null;
  matchStatus: "matched" | "internal_only" | "platform_only" | "unknown_campaign";
  examples: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCustomerId = (value: unknown): string => {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : env.GOOGLE_ADS_CUSTOMER_ID || DEFAULT_CUSTOMER_ID;
  return raw.replace(/\D/g, "") || DEFAULT_CUSTOMER_ID;
};

const parseDatePreset = (value: unknown): DatePreset => {
  if (typeof value === "string" && value in DATE_PRESETS) {
    return value as DatePreset;
  }
  return "last_30d";
};

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const kstDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  }
  return KST_DATE_FORMATTER.format(date);
};

const shiftIsoDate = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
};

const resolvePresetDateRange = (preset: DatePreset): DateRange => {
  const today = kstDate(new Date());
  const days = preset === "last_7d" ? 7 : preset === "last_14d" ? 14 : preset === "last_90d" ? 90 : 30;
  const startDate = shiftIsoDate(today, -days);
  const endDate = shiftIsoDate(today, -1);
  return {
    startDate,
    endDate,
    startAt: `${startDate}T00:00:00.000+09:00`,
    endAt: `${endDate}T23:59:59.999+09:00`,
    timezone: KST_TIME_ZONE,
  };
};

const isInDateRange = (date: string, range: DateRange) =>
  Boolean(date && date >= range.startDate && date <= range.endDate);

const toObject = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const firstString = (value: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
};

const firstPositiveNumber = (values: unknown[]) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const urlParam = (value: unknown, key: string) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    return new URL(raw, "https://biocom.kr").searchParams.get(key)?.trim() ?? "";
  } catch {
    return "";
  }
};

const summarizeGoogleAdsError = (text: string): GoogleAdsErrorSummary => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const root = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : parsed;
    if (!isRecord(root)) return { rawPreview: text.slice(0, 800) };

    const details = Array.isArray(root.details) ? root.details : [];
    const failure = details.find((detail) => isRecord(detail) && Array.isArray(detail.errors));
    const requestDetail = details.find((detail) => isRecord(detail) && typeof detail.requestId === "string");
    const failureErrors = isRecord(failure) && Array.isArray(failure.errors) ? failure.errors : [];

    return {
      code: toOptionalNumber(root.code) ?? undefined,
      status: toStringValue(root.status) || undefined,
      message: toStringValue(root.message) || undefined,
      requestId: isRecord(requestDetail) ? toStringValue(requestDetail.requestId) : null,
      googleAdsErrors: failureErrors
        .filter(isRecord)
        .map((error) => {
          const location = isRecord(error.location) ? error.location : {};
          const elements = Array.isArray(location.fieldPathElements)
            ? location.fieldPathElements
            : [];
          return {
            errorCode: error.errorCode,
            message: toStringValue(error.message),
            fieldPath: elements
              .filter(isRecord)
              .map((element) => toStringValue(element.fieldName))
              .filter(Boolean)
              .join(".") || null,
          };
        }),
    };
  } catch {
    return { rawPreview: text.slice(0, 800) };
  }
};

const parseServiceAccountCredentials = () => {
  const raw = env.GSC_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("Google service account key is not configured");
  }

  const credentials = JSON.parse(raw) as Record<string, unknown>;
  return {
    credentials,
    clientEmail: toStringValue(credentials.client_email) || null,
    projectId: toStringValue(credentials.project_id) || null,
  };
};

const createGoogleAdsContext = async (customerIdInput: unknown): Promise<GoogleAdsClientContext> => {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("Google Ads developer token is not configured");
  }

  const { credentials, clientEmail, projectId } = parseServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [GOOGLE_ADS_SCOPE],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error("Failed to obtain Google Ads OAuth access token");
  }

  return {
    token,
    customerId: normalizeCustomerId(customerIdInput),
    apiVersion: env.GOOGLE_ADS_API_VERSION,
    developerToken,
    clientEmail,
    projectId,
  };
};

const googleAdsSearch = async (
  context: GoogleAdsClientContext,
  query: string,
): Promise<GoogleAdsSearchResult> => {
  const url = `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}/googleAds:search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      "developer-token": context.developerToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: summarizeGoogleAdsError(text),
    };
  }
  return {
    ok: true,
    status: response.status,
    body: JSON.parse(text) as GoogleAdsSearchResponse,
  };
};

const emptyTotals = (): MetricTotals => ({
  cost: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversionValue: 0,
  allConversions: 0,
  allConversionValue: 0,
  viewThroughConversions: 0,
});

const addMetrics = (target: MetricTotals, source: MetricTotals) => {
  target.cost += source.cost;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
  target.conversions += source.conversions;
  target.conversionValue += source.conversionValue;
  target.allConversions += source.allConversions;
  target.allConversionValue += source.allConversionValue;
  target.viewThroughConversions += source.viewThroughConversions;
};

const parseMetrics = (row: Record<string, unknown>): MetricTotals => {
  const metrics = isRecord(row.metrics) ? row.metrics : {};
  return {
    cost: toNumber(metrics.costMicros) / 1_000_000,
    impressions: toNumber(metrics.impressions),
    clicks: toNumber(metrics.clicks),
    conversions: toNumber(metrics.conversions),
    conversionValue: toNumber(metrics.conversionsValue),
    allConversions: toNumber(metrics.allConversions),
    allConversionValue: toNumber(metrics.allConversionsValue),
    viewThroughConversions: toNumber(metrics.viewThroughConversions),
  };
};

const withDerivedMetrics = <T extends MetricTotals>(row: T): T & {
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
} => ({
  ...row,
  roas: row.cost > 0 ? row.conversionValue / row.cost : null,
  ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
  cvr: row.clicks > 0 ? row.conversions / row.clicks : null,
});

const extractSendTo = (snippet: string) => {
  const matches = snippet.match(/AW-\d+\/[A-Za-z0-9_-]+/g) ?? [];
  return [...new Set(matches)];
};

const normalizeConversionAction = (row: unknown): ConversionActionRow | null => {
  if (!isRecord(row) || !isRecord(row.conversionAction)) return null;
  const action = row.conversionAction;
  const tagSnippets = Array.isArray(action.tagSnippets) ? action.tagSnippets : [];
  const sendTo = tagSnippets
    .filter(isRecord)
    .flatMap((snippet) => [
      ...extractSendTo(toStringValue(snippet.eventSnippet)),
      ...extractSendTo(toStringValue(snippet.globalSiteTag)),
    ]);
  const uniqueSendTo = [...new Set(sendTo)];
  const labels = uniqueSendTo
    .map((value) => value.split("/")[1])
    .filter(Boolean);
  const conversionIds = uniqueSendTo
    .map((value) => value.split("/")[0]?.replace("AW-", ""))
    .filter(Boolean);
  const valueSettings = isRecord(action.valueSettings) ? action.valueSettings : {};

  return {
    id: toStringValue(action.id),
    name: toStringValue(action.name),
    resourceName: toStringValue(action.resourceName),
    status: toStringValue(action.status),
    type: toStringValue(action.type),
    category: toStringValue(action.category),
    primaryForGoal: action.primaryForGoal === true,
    countingType: toStringValue(action.countingType),
    clickThroughLookbackWindowDays: toOptionalNumber(action.clickThroughLookbackWindowDays),
    viewThroughLookbackWindowDays: toOptionalNumber(action.viewThroughLookbackWindowDays),
    defaultValue: toOptionalNumber(valueSettings.defaultValue),
    alwaysUseDefaultValue: valueSettings.alwaysUseDefaultValue === true,
    sendTo: uniqueSendTo,
    conversionId: conversionIds[0] ?? null,
    conversionLabels: [...new Set(labels)],
    snippetTypes: [
      ...new Set(tagSnippets
        .filter(isRecord)
        .map((snippet) => toStringValue(snippet.type))
        .filter(Boolean)),
    ],
  };
};

const buildCustomerQuery = () => `
  SELECT
    customer.id,
    customer.descriptive_name,
    customer.manager,
    customer.test_account,
    customer.status
  FROM customer
  LIMIT 1
`;

const buildConversionActionsQuery = (limit: number) => `
  SELECT
    conversion_action.id,
    conversion_action.name,
    conversion_action.status,
    conversion_action.type,
    conversion_action.category,
    conversion_action.primary_for_goal,
    conversion_action.counting_type,
    conversion_action.click_through_lookback_window_days,
    conversion_action.view_through_lookback_window_days,
    conversion_action.value_settings.default_value,
    conversion_action.value_settings.always_use_default_value,
    conversion_action.tag_snippets
  FROM conversion_action
  WHERE conversion_action.status != REMOVED
  ORDER BY conversion_action.category, conversion_action.id
  LIMIT ${limit}
`;

const buildCampaignMetricsQuery = (dateRangeLiteral: string, limit: number) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE segments.date DURING ${dateRangeLiteral}
    AND metrics.cost_micros > 0
  ORDER BY metrics.cost_micros DESC
  LIMIT ${limit}
`;

const buildDailyMetricsQuery = (dateRangeLiteral: string) => `
  SELECT
    segments.date,
    campaign.id,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE segments.date DURING ${dateRangeLiteral}
    AND metrics.cost_micros > 0
  ORDER BY segments.date ASC
  LIMIT 10000
`;

const buildConversionActionMetricsQuery = (dateRangeLiteral: string) => `
  SELECT
    segments.conversion_action,
    segments.conversion_action_name,
    campaign.id,
    campaign.name,
    campaign.advertising_channel_type,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE segments.date DURING ${dateRangeLiteral}
    AND metrics.all_conversions > 0
  ORDER BY metrics.all_conversions_value DESC
  LIMIT 10000
`;

const parseCampaignRows = (results: unknown[]): CampaignMetricRow[] =>
  results
    .filter(isRecord)
    .map((row) => {
      const campaign = isRecord(row.campaign) ? row.campaign : {};
      return {
        campaignId: toStringValue(campaign.id),
        campaignName: toStringValue(campaign.name),
        status: toStringValue(campaign.status),
        channel: toStringValue(campaign.advertisingChannelType),
        ...withDerivedMetrics(parseMetrics(row)),
      };
    });

const parseDailyRows = (results: unknown[]): DailyMetricRow[] => {
  const grouped = new Map<string, MetricTotals>();
  results.filter(isRecord).forEach((row) => {
    const segments = isRecord(row.segments) ? row.segments : {};
    const date = toStringValue(segments.date);
    if (!date) return;
    const current = grouped.get(date) ?? emptyTotals();
    addMetrics(current, parseMetrics(row));
    grouped.set(date, current);
  });

  return [...grouped.entries()]
    .map(([date, totals]) => ({
      date,
      ...withDerivedMetrics(totals),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const conversionActionIdFromResourceName = (resourceName: string) =>
  resourceName.split("/").filter(Boolean).at(-1) ?? null;

const summarizeRows = (rows: CampaignMetricRow[]): MetricTotals & {
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
} => {
  const totals = emptyTotals();
  rows.forEach((row) => addMetrics(totals, row));
  return withDerivedMetrics(totals);
};

const normalizeRemoteLedgerEntry = (value: unknown): AttributionLedgerEntry | null => {
  if (!isRecord(value)) return null;
  const metadata = toObject(value.metadata);
  const requestContext = toObject(value.requestContext);
  const touchpoint = toStringValue(value.touchpoint);
  if (!["payment_success", "checkout_started", "form_submit"].includes(touchpoint)) return null;
  const captureMode = toStringValue(value.captureMode) || "live";
  const paymentStatus = toStringValue(value.paymentStatus);

  return {
    touchpoint: touchpoint as AttributionLedgerEntry["touchpoint"],
    captureMode: ["live", "replay", "smoke"].includes(captureMode)
      ? captureMode as AttributionLedgerEntry["captureMode"]
      : "live",
    paymentStatus: ["confirmed", "pending", "canceled"].includes(paymentStatus)
      ? paymentStatus as AttributionLedgerEntry["paymentStatus"]
      : null,
    loggedAt: toStringValue(value.loggedAt),
    orderId: toStringValue(value.orderId),
    paymentKey: toStringValue(value.paymentKey),
    approvedAt: toStringValue(value.approvedAt),
    checkoutId: toStringValue(value.checkoutId),
    customerKey: toStringValue(value.customerKey),
    landing: toStringValue(value.landing),
    referrer: toStringValue(value.referrer),
    gaSessionId: toStringValue(value.gaSessionId),
    utmSource: toStringValue(value.utmSource),
    utmMedium: toStringValue(value.utmMedium),
    utmCampaign: toStringValue(value.utmCampaign),
    utmTerm: toStringValue(value.utmTerm),
    utmContent: toStringValue(value.utmContent),
    gclid: toStringValue(value.gclid),
    fbclid: toStringValue(value.fbclid),
    ttclid: toStringValue(value.ttclid),
    metadata,
    requestContext: {
      ip: toStringValue(requestContext.ip),
      userAgent: toStringValue(requestContext.userAgent),
      origin: toStringValue(requestContext.origin),
      requestReferer: toStringValue(requestContext.requestReferer),
      method: toStringValue(requestContext.method),
      path: toStringValue(requestContext.path),
    },
  };
};

const loadOperationalLedgerEntries = async (range: DateRange) => {
  const url = new URL("/api/attribution/ledger", env.ATTRIBUTION_OPERATIONAL_BASE_URL);
  url.searchParams.set("source", INTERNAL_LEDGER_SOURCE);
  url.searchParams.set("limit", String(INTERNAL_LEDGER_LIMIT));
  url.searchParams.set("startAt", range.startAt);
  url.searchParams.set("endAt", range.endAt);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json() as unknown;
  if (!response.ok || !isRecord(body) || body.ok !== true) {
    throw new Error(`Operational attribution ledger returned HTTP ${response.status}`);
  }

  const entries = (Array.isArray(body.items) ? body.items : [])
    .map(normalizeRemoteLedgerEntry)
    .filter((entry): entry is AttributionLedgerEntry => Boolean(entry));
  const summary = toObject(body.summary);

  return {
    entries,
    latestLoggedAt: toStringValue(summary.latestLoggedAt),
    url: url.toString(),
  };
};

const loadInternalLedgerEntries = async (range: DateRange) => {
  const warnings: string[] = [];
  try {
    const operational = await loadOperationalLedgerEntries(range);
    return {
      dataSource: "operational_vm_ledger" as const,
      entries: operational.entries,
      latestLoggedAt: operational.latestLoggedAt,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`운영 VM attribution ledger 조회 실패. 로컬 attribution_ledger로 fallback: ${message}`);
  }

  const localEntries = await readLedgerEntries();
  return {
    dataSource: "local_attribution_ledger" as const,
    entries: localEntries.filter((entry) => {
      const source = toStringValue(entry.metadata?.source) || toStringValue(entry.metadata?.store);
      const date = kstDate(entry.approvedAt || entry.loggedAt);
      return source === INTERNAL_LEDGER_SOURCE && isInDateRange(date, range);
    }),
    latestLoggedAt: localEntries.map((entry) => entry.loggedAt).sort().at(-1) ?? "",
    warnings,
  };
};

const collectLedgerUrls = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  return [
    entry.landing,
    entry.referrer,
    entry.requestContext.requestReferer,
    firstString(metadata, [
      "imweb_landing_url",
      "checkout_started_landing",
      "checkoutUrl",
      "initial_referrer",
      "original_referrer",
    ]),
  ].filter(Boolean);
};

const ledgerAmount = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  const referrerPayment = toObject(metadata.referrerPayment);
  const fromUrl = collectLedgerUrls(entry)
    .map((url) => toNumber(urlParam(url, "amount")))
    .find((value) => value > 0) ?? 0;
  return firstPositiveNumber([
    metadata.totalAmount,
    metadata.total_amount,
    metadata.amount,
    metadata.paymentAmount,
    metadata.payment_amount,
    referrerPayment.amount,
    fromUrl,
  ]);
};

const ledgerCampaignId = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  const direct = firstString(metadata, [
    "googleAdsCampaignId",
    "google_ads_campaign_id",
    "campaignId",
    "campaign_id",
  ]);
  if (/^\d{6,}$/.test(direct)) return direct;

  for (const url of collectLedgerUrls(entry)) {
    for (const key of ["gad_campaignid", "utm_id", "campaignid", "campaign_id"]) {
      const value = urlParam(url, key);
      if (/^\d{6,}$/.test(value)) return value;
    }
  }

  return "";
};

const isGoogleAttributedEntry = (entry: AttributionLedgerEntry) => {
  const haystack = [
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.gclid,
    ...collectLedgerUrls(entry),
  ].join(" ").toLowerCase();
  return (
    Boolean(entry.gclid.trim())
    || haystack.includes("google")
    || haystack.includes("gclid=")
    || haystack.includes("gbraid=")
    || haystack.includes("wbraid=")
    || haystack.includes("gad_campaignid=")
  );
};

const normalizeInternalStatus = (entry: AttributionLedgerEntry): InternalOrderStatus => {
  if (entry.paymentStatus === "confirmed" || entry.paymentStatus === "canceled") return entry.paymentStatus;
  return "pending";
};

const statusPriority: Record<InternalOrderStatus, number> = {
  pending: 1,
  confirmed: 2,
  canceled: 3,
};

const ledgerOrderKey = (entry: AttributionLedgerEntry, index: number) => {
  const metadata = toObject(entry.metadata);
  const key = entry.paymentKey
    || entry.orderId
    || firstString(metadata, ["orderIdBase", "order_id_base", "orderNo", "order_no", "orderCode", "order_code"]);
  return key || `ledger:${index}:${entry.loggedAt}`;
};

const buildInternalOrders = (entries: AttributionLedgerEntry[], range: DateRange): InternalOrder[] => {
  const grouped = new Map<string, AttributionLedgerEntry[]>();
  entries
    .filter((entry) => entry.touchpoint === "payment_success")
    .filter(isGoogleAttributedEntry)
    .forEach((entry, index) => {
      const key = ledgerOrderKey(entry, index);
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

  return [...grouped.entries()].flatMap(([key, group]) => {
    const date = group.map((entry) => kstDate(entry.approvedAt || entry.loggedAt)).find(Boolean) ?? "";
    if (!isInDateRange(date, range)) return [];
    const status = group
      .map(normalizeInternalStatus)
      .sort((a, b) => statusPriority[b] - statusPriority[a])[0] ?? "pending";
    const amount = group.map(ledgerAmount).find((value) => value > 0) ?? 0;
    const attributionCarrier = group.find((entry) => ledgerCampaignId(entry) || entry.gclid || entry.utmCampaign)
      ?? group[0];

    return [{
      key,
      date,
      status,
      amount,
      campaignId: ledgerCampaignId(attributionCarrier) || null,
      utmCampaign: attributionCarrier.utmCampaign,
      hasClickId: group.some((entry) => Boolean(entry.gclid.trim())),
    }];
  });
};

const emptyInternalTotals = (): InternalRevenueTotals => ({
  orders: 0,
  confirmedOrders: 0,
  confirmedRevenue: 0,
  pendingOrders: 0,
  pendingRevenue: 0,
  canceledOrders: 0,
  canceledRevenue: 0,
});

const addInternalOrder = (totals: InternalRevenueTotals, order: InternalOrder) => {
  totals.orders += 1;
  if (order.status === "confirmed") {
    totals.confirmedOrders += 1;
    totals.confirmedRevenue += order.amount;
  } else if (order.status === "canceled") {
    totals.canceledOrders += 1;
    totals.canceledRevenue += order.amount;
  } else {
    totals.pendingOrders += 1;
    totals.pendingRevenue += order.amount;
  }
};

const round2 = (value: number) => Number(value.toFixed(2));
const roas = (revenue: number, cost: number) => (cost > 0 ? round2(revenue / cost) : null);
const roasGap = (internalRoas: number | null, platformRoas: number | null) =>
  internalRoas == null || platformRoas == null ? null : round2(internalRoas - platformRoas);

const ratio = (value: number, total: number) => (total > 0 ? round2(value / total) : null);

const classifyConversionActionSegment = (params: {
  actionName: string;
  category: string;
  primaryForGoal: boolean;
  conversionLabels: string[];
}) => {
  const name = params.actionName.toLowerCase();
  const hasKnownNpayLabel = params.conversionLabels.some((label) =>
    KNOWN_NPAY_CONVERSION_LABELS.has(label),
  );
  const hasNpayName = /npay|naver|네이버/.test(name);
  const isPurchase = params.category === "PURCHASE" || /purchase|구매/.test(name);
  const isNonRevenueAction = /page[_ ]?view|장바구니|cart|sign[_ ]?up|회원가입/.test(name);

  if (hasKnownNpayLabel && params.primaryForGoal) return "primary_known_npay";
  if (hasKnownNpayLabel || hasNpayName) return "secondary_known_npay";
  if (isPurchase && params.primaryForGoal) return "primary_purchase";
  if (isPurchase) return "secondary_purchase";
  if (isNonRevenueAction) return "non_revenue_action";
  return params.primaryForGoal ? "other_primary" : "other_secondary";
};

const conversionActionRiskFlags = (params: {
  classification: string;
  primaryForGoal: boolean;
  conversionLabels: string[];
  conversionValue: number;
  allConversionValue: number;
}) => {
  const flags: string[] = [];
  if (params.conversionLabels.some((label) => KNOWN_NPAY_CONVERSION_LABELS.has(label))) {
    flags.push("known_npay_label");
  }
  if (params.classification === "primary_known_npay") {
    flags.push("primary_bid_signal_is_npay");
  }
  if (!params.primaryForGoal && params.allConversionValue > 0) {
    flags.push("all_conversions_only_value");
  }
  if (params.primaryForGoal && params.conversionValue > 0 && params.classification === "non_revenue_action") {
    flags.push("non_revenue_primary_value");
  }
  return flags;
};

const parseConversionActionMetricRows = (
  results: unknown[],
  conversionActions: ConversionActionRow[],
): ConversionActionSegmentCampaignRow[] => {
  const actionByResource = new Map(conversionActions.map((action) => [action.resourceName, action]));
  const actionById = new Map(conversionActions.map((action) => [action.id, action]));

  return results.filter(isRecord).map((row) => {
    const campaign = isRecord(row.campaign) ? row.campaign : {};
    const segments = isRecord(row.segments) ? row.segments : {};
    const metrics = parseMetrics(row);
    const resourceName = toStringValue(segments.conversionAction);
    const actionId = conversionActionIdFromResourceName(resourceName);
    const metadata = actionByResource.get(resourceName) ?? (actionId ? actionById.get(actionId) : undefined);
    const actionName = toStringValue(segments.conversionActionName) || metadata?.name || "(unknown action)";
    const conversionLabels = metadata?.conversionLabels ?? [];
    const category = metadata?.category || "UNKNOWN";
    const primaryForGoal = metadata?.primaryForGoal ?? false;
    const classification = classifyConversionActionSegment({
      actionName,
      category,
      primaryForGoal,
      conversionLabels,
    });

    return {
      conversionActionResourceName: resourceName,
      conversionActionId: actionId,
      conversionActionName: actionName,
      campaignId: toStringValue(campaign.id),
      campaignName: toStringValue(campaign.name),
      channel: toStringValue(campaign.advertisingChannelType),
      conversions: round2(metrics.conversions),
      conversionValue: round2(metrics.conversionValue),
      allConversions: round2(metrics.allConversions),
      allConversionValue: round2(metrics.allConversionValue),
      viewThroughConversions: round2(metrics.viewThroughConversions),
      status: metadata?.status ?? "UNKNOWN",
      category,
      primaryForGoal,
      countingType: metadata?.countingType ?? "UNKNOWN",
      sendTo: metadata?.sendTo ?? [],
      conversionLabels,
      classification,
      riskFlags: conversionActionRiskFlags({
        classification,
        primaryForGoal,
        conversionLabels,
        conversionValue: metrics.conversionValue,
        allConversionValue: metrics.allConversionValue,
      }),
    };
  });
};

const summarizeConversionActionSegments = (params: {
  rows: ConversionActionSegmentCampaignRow[];
  platformSummary: MetricTotals & { roas: number | null };
  internalConfirmedRevenue: number;
}) => {
  const byAction = new Map<string, ConversionActionSegmentActionRow & { campaignIds: Set<string> }>();

  for (const row of params.rows) {
    const key = row.conversionActionResourceName || row.conversionActionName;
    const current = byAction.get(key) ?? {
      conversionActionResourceName: row.conversionActionResourceName,
      conversionActionId: row.conversionActionId,
      conversionActionName: row.conversionActionName,
      conversions: 0,
      conversionValue: 0,
      allConversions: 0,
      allConversionValue: 0,
      viewThroughConversions: 0,
      status: row.status,
      category: row.category,
      primaryForGoal: row.primaryForGoal,
      countingType: row.countingType,
      sendTo: row.sendTo,
      conversionLabels: row.conversionLabels,
      classification: row.classification,
      riskFlags: row.riskFlags,
      campaignCount: 0,
      campaigns: [],
      campaignIds: new Set<string>(),
      shareOfPlatformConversionValue: null,
      shareOfAllConversionValue: null,
    };

    current.conversions += row.conversions;
    current.conversionValue += row.conversionValue;
    current.allConversions += row.allConversions;
    current.allConversionValue += row.allConversionValue;
    current.viewThroughConversions += row.viewThroughConversions;
    if (row.campaignId) current.campaignIds.add(row.campaignId);
    if (row.campaignName && current.campaigns.length < 4 && !current.campaigns.includes(row.campaignName)) {
      current.campaigns.push(row.campaignName);
    }
    current.riskFlags = [...new Set([...current.riskFlags, ...row.riskFlags])];
    byAction.set(key, current);
  }

  const allConversionValue = params.rows.reduce((sum, row) => sum + row.allConversionValue, 0);
  const primaryConversionValue = params.rows.reduce((sum, row) => sum + row.conversionValue, 0);
  const primaryKnownNpayConversionValue = params.rows
    .filter((row) => row.classification === "primary_known_npay")
    .reduce((sum, row) => sum + row.conversionValue, 0);
  const knownNpayAllConversionValue = params.rows
    .filter((row) => row.riskFlags.includes("known_npay_label"))
    .reduce((sum, row) => sum + row.allConversionValue, 0);
  const knownNpayAllOnlyConversionValue = params.rows
    .filter((row) => row.riskFlags.includes("known_npay_label"))
    .reduce((sum, row) => sum + Math.max(0, row.allConversionValue - row.conversionValue), 0);
  const purchasePrimaryConversionValue = params.rows
    .filter((row) => row.category === "PURCHASE" && row.primaryForGoal)
    .reduce((sum, row) => sum + row.conversionValue, 0);
  const nonPurchasePrimaryConversionValue = Math.max(0, primaryConversionValue - purchasePrimaryConversionValue);
  const viewThroughConversions = params.rows.reduce((sum, row) => sum + row.viewThroughConversions, 0);
  const purchaseViewThroughConversions = params.rows
    .filter((row) => row.category === "PURCHASE")
    .reduce((sum, row) => sum + row.viewThroughConversions, 0);
  const platformMinusInternalConfirmed =
    params.platformSummary.conversionValue - params.internalConfirmedRevenue;
  const gapAfterRemovingKnownNpayPrimary =
    params.platformSummary.conversionValue - primaryKnownNpayConversionValue - params.internalConfirmedRevenue;

  const actions = [...byAction.values()]
    .map(({ campaignIds, ...row }) => ({
      ...row,
      campaignCount: campaignIds.size,
      conversions: round2(row.conversions),
      conversionValue: round2(row.conversionValue),
      allConversions: round2(row.allConversions),
      allConversionValue: round2(row.allConversionValue),
      viewThroughConversions: round2(row.viewThroughConversions),
      shareOfPlatformConversionValue: ratio(row.conversionValue, params.platformSummary.conversionValue),
      shareOfAllConversionValue: ratio(row.allConversionValue, allConversionValue),
    }))
    .sort((a, b) =>
      b.conversionValue - a.conversionValue
      || b.allConversionValue - a.allConversionValue
      || a.conversionActionName.localeCompare(b.conversionActionName, "ko"),
    );

  const gapDrivers: ConversionActionGapDriver[] = [
    {
      key: "primary_known_npay_label",
      label: "Primary 전환값의 대부분이 NPay label에서 발생",
      value: round2(primaryKnownNpayConversionValue),
      shareOfPlatformConversionValue: ratio(primaryKnownNpayConversionValue, params.platformSummary.conversionValue),
      confidence: "high",
      evidence: "`구매완료` action의 send_to가 아임웹 자동 NPay count label `r0vuCKvy-8caEJixj5EB`와 일치한다.",
      nextAction: "이 전환 액션을 purchase primary로 계속 둘지 즉시 재검토한다.",
    },
    {
      key: "platform_minus_internal_confirmed",
      label: "Google Conv. value와 내부 confirmed 매출 차이",
      value: round2(platformMinusInternalConfirmed),
      shareOfPlatformConversionValue: ratio(platformMinusInternalConfirmed, params.platformSummary.conversionValue),
      confidence: "medium-high",
      evidence: "같은 기간 Google Ads API live와 operational attribution ledger confirmed를 비교했다.",
      nextAction: "전환 액션별 value와 주문 원장 매칭을 결제수단별로 분해한다.",
    },
    {
      key: "known_npay_all_only_value",
      label: "All conv.에만 잡히는 NPay 보조 전환값",
      value: round2(knownNpayAllOnlyConversionValue),
      shareOfPlatformConversionValue: ratio(knownNpayAllOnlyConversionValue, params.platformSummary.conversionValue),
      confidence: "high",
      evidence: "`TechSol - NPAY구매 50739`는 secondary라 Conv. value에는 0원이지만 All conv. value에는 잡힌다.",
      nextAction: "All conv. value를 운영 ROAS 판단에서 제외하고 보조 오염 지표로만 본다.",
    },
  ];

  return {
    summary: {
      primaryConversionValue: round2(primaryConversionValue),
      allConversionValue: round2(allConversionValue),
      allConversionValueMinusPlatform: round2(allConversionValue - params.platformSummary.conversionValue),
      platformMinusInternalConfirmed: round2(platformMinusInternalConfirmed),
      primaryKnownNpayConversionValue: round2(primaryKnownNpayConversionValue),
      knownNpayAllConversionValue: round2(knownNpayAllConversionValue),
      knownNpayAllOnlyConversionValue: round2(knownNpayAllOnlyConversionValue),
      purchasePrimaryConversionValue: round2(purchasePrimaryConversionValue),
      nonPurchasePrimaryConversionValue: round2(nonPurchasePrimaryConversionValue),
      gapAfterRemovingKnownNpayPrimary: round2(gapAfterRemovingKnownNpayPrimary),
      viewThroughConversions: round2(viewThroughConversions),
      purchaseViewThroughConversions: round2(purchaseViewThroughConversions),
      primaryKnownNpayShareOfPlatform: ratio(primaryKnownNpayConversionValue, params.platformSummary.conversionValue),
      allConversionValueMinusInternalConfirmed: round2(allConversionValue - params.internalConfirmedRevenue),
    },
    actions,
    campaignRows: params.rows
      .map((row) => ({
        ...row,
        shareOfPlatformConversionValue: ratio(row.conversionValue, params.platformSummary.conversionValue),
        shareOfAllConversionValue: ratio(row.allConversionValue, allConversionValue),
      }))
      .sort((a, b) => b.conversionValue - a.conversionValue || b.allConversionValue - a.allConversionValue),
    gapDrivers,
  };
};

const buildInternalReconciliation = async (params: {
  datePreset: DatePreset;
  campaigns: CampaignMetricRow[];
  daily: DailyMetricRow[];
  summary: MetricTotals & { roas: number | null };
}) => {
  const dateRange = resolvePresetDateRange(params.datePreset);
  const ledger = await loadInternalLedgerEntries(dateRange);
  const orders = buildInternalOrders(ledger.entries, dateRange);
  const totals = emptyInternalTotals();
  orders.forEach((order) => addInternalOrder(totals, order));

  const byCampaign = new Map<string, InternalRevenueTotals & { examples: Set<string> }>();
  for (const order of orders) {
    const key = order.campaignId ?? "(unknown)";
    const current = byCampaign.get(key) ?? { ...emptyInternalTotals(), examples: new Set<string>() };
    addInternalOrder(current, order);
    if (order.utmCampaign && current.examples.size < 3) current.examples.add(order.utmCampaign);
    byCampaign.set(key, current);
  }

  const platformByCampaign = new Map(params.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const campaigns: InternalCampaignRow[] = params.campaigns.map((campaign) => {
    const internal = byCampaign.get(campaign.campaignId) ?? { ...emptyInternalTotals(), examples: new Set<string>() };
    const internalRoas = roas(internal.confirmedRevenue, campaign.cost);
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      platformCost: round2(campaign.cost),
      platformConversionValue: round2(campaign.conversionValue),
      platformRoas: campaign.roas == null ? null : round2(campaign.roas),
      internalConfirmedRoas: internalRoas,
      roasGap: roasGap(internalRoas, campaign.roas),
      matchStatus: internal.orders > 0 ? "matched" : "platform_only",
      ...internal,
      examples: [...internal.examples],
      confirmedRevenue: round2(internal.confirmedRevenue),
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
    };
  });

  const internalOnlyCampaigns: InternalCampaignRow[] = [...byCampaign.entries()]
    .filter(([campaignId]) => campaignId === "(unknown)" || !platformByCampaign.has(campaignId))
    .map(([campaignId, internal]) => ({
      campaignId: campaignId === "(unknown)" ? null : campaignId,
      campaignName: campaignId === "(unknown)" ? "캠페인 ID 미확인 Google 유입" : `Google Ads campaign ${campaignId}`,
      platformCost: 0,
      platformConversionValue: 0,
      platformRoas: null,
      internalConfirmedRoas: null,
      roasGap: null,
      matchStatus: campaignId === "(unknown)" ? "unknown_campaign" as const : "internal_only" as const,
      ...internal,
      examples: [...internal.examples],
      confirmedRevenue: round2(internal.confirmedRevenue),
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
    }))
    .sort((a, b) => b.confirmedRevenue - a.confirmedRevenue || b.orders - a.orders);

  const internalByDate = new Map<string, InternalRevenueTotals>();
  for (const order of orders) {
    const current = internalByDate.get(order.date) ?? emptyInternalTotals();
    addInternalOrder(current, order);
    internalByDate.set(order.date, current);
  }

  const daily = params.daily.map((row) => {
    const internal = internalByDate.get(row.date) ?? emptyInternalTotals();
    const internalRoas = roas(internal.confirmedRevenue, row.cost);
    return {
      date: row.date,
      platformCost: round2(row.cost),
      platformConversionValue: round2(row.conversionValue),
      platformRoas: row.roas == null ? null : round2(row.roas),
      internalConfirmedRevenue: round2(internal.confirmedRevenue),
      internalConfirmedRoas: internalRoas,
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
      confirmedOrders: internal.confirmedOrders,
      orders: internal.orders,
    };
  });

  const internalRoas = roas(totals.confirmedRevenue, params.summary.cost);
  const matchedCampaignOrders = campaigns.reduce((sum, row) => sum + row.orders, 0);
  const unknownCampaignOrders = internalOnlyCampaigns
    .filter((row) => row.matchStatus === "unknown_campaign")
    .reduce((sum, row) => sum + row.orders, 0);

  return {
    dataSource: ledger.dataSource,
    source: INTERNAL_LEDGER_SOURCE,
    fetchedAt: new Date().toISOString(),
    latestLoggedAt: ledger.latestLoggedAt || null,
    dateRange,
    warnings: [
      ...ledger.warnings,
      "내부 ROAS는 운영 attribution ledger의 Google click/UTM 증거가 있는 payment_success만 집계한다.",
      "캠페인 ID가 없는 주문은 캠페인별 ROAS에는 직접 조인하지 않고 internal-only/unknown으로 분리한다.",
    ],
    summary: {
      ...totals,
      confirmedRevenue: round2(totals.confirmedRevenue),
      pendingRevenue: round2(totals.pendingRevenue),
      canceledRevenue: round2(totals.canceledRevenue),
      platformCost: round2(params.summary.cost),
      platformConversionValue: round2(params.summary.conversionValue),
      platformRoas: params.summary.roas == null ? null : round2(params.summary.roas),
      internalConfirmedRoas: internalRoas,
      roasGap: roasGap(internalRoas, params.summary.roas),
      platformMinusConfirmedRevenue: round2(params.summary.conversionValue - totals.confirmedRevenue),
      matchedCampaignOrders,
      unknownCampaignOrders,
      campaignIdCoverage:
        totals.orders > 0 ? round2((totals.orders - unknownCampaignOrders) / totals.orders) : null,
    },
    campaigns,
    internalOnlyCampaigns,
    daily,
  };
};

export const createGoogleAdsRouter = () => {
  const router = express.Router();

  router.get("/api/google-ads/status", async (req: Request, res: Response) => {
    try {
      const context = await createGoogleAdsContext(req.query.customer_id);
      const customerResult = await googleAdsSearch(context, buildCustomerQuery());
      if (!customerResult.ok) {
        res.status(customerResult.status).json({
          ok: false,
          error: customerResult.body,
        });
        return;
      }

      const first = customerResult.body.results?.find(isRecord) ?? {};
      res.json({
        ok: true,
        checkedAt: new Date().toISOString(),
        apiVersion: context.apiVersion,
        customerId: context.customerId,
        serviceAccount: {
          clientEmail: context.clientEmail,
          projectId: context.projectId,
        },
        customer: isRecord(first.customer) ? first.customer : null,
        queryResourceConsumption: customerResult.body.queryResourceConsumption ?? null,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads status check failed",
      });
    }
  });

  router.get("/api/google-ads/dashboard", async (req: Request, res: Response) => {
    try {
      const datePreset = parseDatePreset(req.query.date_preset);
      const dateRangeLiteral = DATE_PRESETS[datePreset];
      const campaignLimit = parsePositiveInt(req.query.campaign_limit, 50, 200);
      const conversionActionLimit = parsePositiveInt(req.query.conversion_action_limit, 100, 200);
      const context = await createGoogleAdsContext(req.query.customer_id);

      const [customerResult, conversionResult, campaignResult, dailyResult, actionMetricResult] = await Promise.all([
        googleAdsSearch(context, buildCustomerQuery()),
        googleAdsSearch(context, buildConversionActionsQuery(conversionActionLimit)),
        googleAdsSearch(context, buildCampaignMetricsQuery(dateRangeLiteral, campaignLimit)),
        googleAdsSearch(context, buildDailyMetricsQuery(dateRangeLiteral)),
        googleAdsSearch(context, buildConversionActionMetricsQuery(dateRangeLiteral)),
      ]);

      const errors = {
        customer: customerResult.ok ? null : customerResult.body,
        conversionActions: conversionResult.ok ? null : conversionResult.body,
        campaigns: campaignResult.ok ? null : campaignResult.body,
        daily: dailyResult.ok ? null : dailyResult.body,
        conversionActionMetrics: actionMetricResult.ok ? null : actionMetricResult.body,
      };
      const hasBlockingError =
        !customerResult.ok || !conversionResult.ok || !campaignResult.ok || !dailyResult.ok || !actionMetricResult.ok;

      if (hasBlockingError) {
        res.status(502).json({
          ok: false,
          fetchedAt: new Date().toISOString(),
          apiVersion: context.apiVersion,
          customerId: context.customerId,
          datePreset,
          dateRangeLiteral,
          errors,
        });
        return;
      }

      const campaigns = parseCampaignRows(campaignResult.body.results ?? []);
      const daily = parseDailyRows(dailyResult.body.results ?? []);
      const conversionActions = (conversionResult.body.results ?? [])
        .map(normalizeConversionAction)
        .filter((row): row is ConversionActionRow => Boolean(row));
      const customerRaw = customerResult.body.results?.find(isRecord);
      const summary = summarizeRows(campaigns);
      const conversionActionMetricRows = parseConversionActionMetricRows(
        actionMetricResult.body.results ?? [],
        conversionActions,
      );
      const internal = await buildInternalReconciliation({
        datePreset,
        campaigns,
        daily,
        summary,
      });
      const conversionActionSegments = summarizeConversionActionSegments({
        rows: conversionActionMetricRows,
        platformSummary: summary,
        internalConfirmedRevenue: internal.summary.confirmedRevenue,
      });

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        apiVersion: context.apiVersion,
        customerId: context.customerId,
        datePreset,
        dateRangeLiteral,
        serviceAccount: {
          clientEmail: context.clientEmail,
          projectId: context.projectId,
        },
        source: "google_ads_api",
        customer: isRecord(customerRaw?.customer) ? customerRaw.customer : null,
        summary,
        campaigns,
        daily,
        conversionActions,
        conversionActionSegments,
        internal,
        diagnostics: {
          campaignRows: campaigns.length,
          dailyRows: daily.length,
          conversionActionRows: conversionActions.length,
          conversionActionMetricRows: conversionActionMetricRows.length,
          campaignQueryResourceConsumption: campaignResult.body.queryResourceConsumption ?? null,
          dailyQueryResourceConsumption: dailyResult.body.queryResourceConsumption ?? null,
          conversionActionQueryResourceConsumption: conversionResult.body.queryResourceConsumption ?? null,
          conversionActionMetricQueryResourceConsumption: actionMetricResult.body.queryResourceConsumption ?? null,
          truncated: {
            campaigns: Boolean(campaignResult.body.nextPageToken),
            daily: Boolean(dailyResult.body.nextPageToken),
            conversionActions: Boolean(conversionResult.body.nextPageToken),
            conversionActionMetrics: Boolean(actionMetricResult.body.nextPageToken),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads dashboard query failed",
      });
    }
  });

  return router;
};
