import express, { type Request, type Response } from "express";
import { promises as fs } from "fs";
import path from "path";

import type {
  AttributionCaptureMode,
  AttributionLedgerEntry,
  AttributionPaymentStatus,
} from "../attribution";
import { readLedgerEntries } from "../attribution";
import {
  getExperimentActivityWindow,
  getExperimentResults,
  listExperiments,
  type CrmExperiment,
  type ExperimentActivityWindow,
  type VariantSummary,
} from "../crmLocalDb";
import { env } from "../env";
import {
  parseIsoDate,
  shiftIsoDateByDays,
  shiftIsoDateByMonths,
} from "../utils/isoDate";
import {
  applyAliasReviewDecision,
  loadAliasReviewItems,
  type AliasReviewDecision,
} from "../metaCampaignAliasReview";
import { isDatabaseConfigured, queryPg } from "../postgres";
import { categorizeProductName, normalizePhone } from "../consultation";

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const KST_TIMEZONE = "Asia/Seoul";
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const META_DEFAULT_ACTION_REPORT_TIME = "conversion";
const META_DEFAULT_ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"] as const;
const META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING = true;
const ADS_DEFAULT_DATE_PRESET = "last_7d";
const VALID_META_ATTRIBUTION_WINDOWS = ["1d_click", "7d_click", "28d_click", "1d_view"] as const;

export type SiteKey = "biocom" | "thecleancoffee" | "aibio";
type AdsChannel = "meta" | "google" | "daangn";
type MetaAttributionWindow = typeof VALID_META_ATTRIBUTION_WINDOWS[number];

type DateRange = {
  startDate: string;
  endDate: string;
};

type MetaInsightAction = {
  action_type: string;
  value: string;
} & Partial<Record<MetaAttributionWindow, string>>;

type MetaInsightRow = {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  date_start: string;
  date_stop: string;
  actions?: MetaInsightAction[];
  action_values?: MetaInsightAction[];
};

type MetaFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type MetaReference = {
  mode: "ads_manager_parity" | "custom_window_override";
  actionReportTime: string;
  useUnifiedAttributionSetting: boolean;
  requestedAttributionWindow: string | null;
  appliedAttributionWindows: string[] | null;
  actionValueField: string;
  purchaseRoasField: string;
  websitePurchaseRoasField: string;
  numeratorDefinition: string;
  comparisonGuidance: string;
};

type MetaCampaignAggregate = {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
};

type MetaTotals = {
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
};

type SiteMetaSummary = MetaTotals & {
  site: SiteKey;
  accountId: string;
  metaError: string | null;
};

export type NormalizedLedgerOrder = {
  key: string;
  orderId: string;
  paymentKey: string;
  approvedDate: string | null;
  amount: number | null;
  site: SiteKey | null;
  customerKey: string;
  utmSource: string;
  utmCampaign: string;
  utmTerm: string;
  fbclid: string;
  gclid: string;
  ttclid: string;
  campaignIdHint: string;
  adsetIdHint: string;
  captureMode: AttributionCaptureMode;
  paymentStatus: AttributionPaymentStatus;
  status: string;
  completed: boolean;
  entryCount: number;
};

export type CampaignRoasRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  orders: number;
};

export type CampaignLtvRoasRow = CampaignRoasRow & {
  ltvRevenue: number;
  repeatRevenue: number;
  supplementRevenue: number;
  ltvRoas: number | null;
  matchedCustomers: number;
  consultedCustomers: number;
  supplementCustomers: number;
  identityMatchedOrders: number;
  ltvStatus: "ready" | "low_sample" | "identity_missing" | "no_attribution" | "blocked";
  ltvBlocker: string | null;
};

export type DailyRoasRow = {
  date: string;
  spend: number;
  revenue: number;
  roas: number | null;
  confirmedRevenue: number;
  pendingRevenue: number;
  potentialRevenue: number;
  metaPurchaseValue: number;
  confirmedRoas: number | null;
  potentialRoas: number | null;
  metaPurchaseRoas: number | null;
};

export type ChannelComparisonRow = {
  channel: AdsChannel;
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number | null;
  placeholder: boolean;
  dataSource: string;
};

const SITE_ACCOUNTS: Array<{ site: SiteKey; accountId: string; hosts: string[] }> = [
  {
    site: "biocom",
    accountId: "act_3138805896402376",
    hosts: ["biocom.kr", "www.biocom.kr", "biocom.imweb.me"],
  },
  {
    site: "thecleancoffee",
    accountId: "act_654671961007474",
    hosts: ["thecleancoffee.com", "www.thecleancoffee.com", "thecleancoffee.imweb.me"],
  },
  {
    site: "aibio",
    accountId: "act_377604674894011",
    hosts: ["aibio.ai", "www.aibio.ai", "aibio.imweb.me"],
  },
];

const findSiteAccountByAccountId = (accountId: string) =>
  SITE_ACCOUNTS.find((site) => site.accountId === accountId.trim()) ?? null;

const filterOrdersForAccount = (
  orders: NormalizedLedgerOrder[],
  accountId: string,
): NormalizedLedgerOrder[] => {
  const siteAccount = findSiteAccountByAccountId(accountId);
  if (!siteAccount) return orders;
  return orders.filter((order) => order.site === siteAccount.site);
};

const CAPTURE_MODE_PRIORITY: Record<AttributionCaptureMode, number> = {
  live: 3,
  replay: 2,
  smoke: 1,
};
const PAYMENT_STATUS_PRIORITY: Record<AttributionPaymentStatus, number> = {
  pending: 1,
  confirmed: 2,
  canceled: 3,
};

const round2 = (value: number) => Number(value.toFixed(2));

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : null;
};

const toObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const firstNonEmpty = (values: string[]) => values.find((value) => value.trim()) ?? "";

const firstMetadataString = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const extractUrlParam = (value: string, key: string) => {
  if (!value.trim()) return "";
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get(key)?.trim() ?? "";
  } catch {
    const match = value.match(new RegExp(`[?&]${key}=([^&#\\s]+)`));
    return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  }
};

const extractFirstUrlParam = (values: string[], key: string) =>
  firstNonEmpty(values.map((value) => extractUrlParam(value, key)));

const getKstToday = () => KST_DATE_FORMATTER.format(new Date());

const firstDayOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

const lastDayOfMonth = (date: string) =>
  shiftIsoDateByDays(shiftIsoDateByMonths(firstDayOfMonth(date), 1), -1);

export const resolveDatePresetRange = (
  datePreset: string,
  today: string = getKstToday(),
): DateRange | null => {
  // Meta's rolling date_preset windows such as last_7d use completed days ending yesterday.
  const lastCompletedDate = shiftIsoDateByDays(today, -1);
  switch (datePreset) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      return { startDate: lastCompletedDate, endDate: lastCompletedDate };
    }
    case "last_7d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -6), endDate: lastCompletedDate };
    case "last_14d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -13), endDate: lastCompletedDate };
    case "last_30d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -29), endDate: lastCompletedDate };
    case "last_90d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -89), endDate: lastCompletedDate };
    case "this_month":
      return { startDate: firstDayOfMonth(today), endDate: today };
    case "last_month": {
      const previousMonthAnchor = shiftIsoDateByMonths(today, -1);
      return {
        startDate: firstDayOfMonth(previousMonthAnchor),
        endDate: lastDayOfMonth(previousMonthAnchor),
      };
    }
    default:
      return null;
  }
};

const parseIsoDateParam = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${label} 형식은 YYYY-MM-DD 이어야 함`);
  }
  parseIsoDate(value.trim());
  return value.trim();
};

const ensureValidDateRange = (startDate: string, endDate: string): DateRange => {
  if (startDate > endDate) {
    throw new Error("start_date 는 end_date 보다 늦을 수 없음");
  }
  return { startDate, endDate };
};

const resolveExplicitRange = (req: Request) => ensureValidDateRange(
  parseIsoDateParam(req.query.start_date, "start_date"),
  parseIsoDateParam(req.query.end_date, "end_date"),
);

const resolveOptionalRange = (req: Request): { range: DateRange; datePreset: string | null } => {
  const hasExplicitRange = typeof req.query.start_date === "string" || typeof req.query.end_date === "string";
  if (hasExplicitRange) {
    return { range: resolveExplicitRange(req), datePreset: null };
  }

  const requestedDatePreset = typeof req.query.date_preset === "string"
    ? req.query.date_preset.trim()
    : ADS_DEFAULT_DATE_PRESET;
  const range = resolveDatePresetRange(requestedDatePreset);
  if (!range) {
    throw new Error(`지원하지 않는 date_preset: ${requestedDatePreset}`);
  }
  return { range, datePreset: requestedDatePreset };
};

const parseMetaAttributionWindow = (value: unknown): MetaAttributionWindow | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const requested = value.trim();
  if (!VALID_META_ATTRIBUTION_WINDOWS.includes(requested as MetaAttributionWindow)) {
    throw new Error(`지원하지 않는 attribution_window: ${requested}`);
  }
  return requested as MetaAttributionWindow;
};

const normalizeDateLike = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return KST_DATE_FORMATTER.format(parsed);
};

const resolveHost = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";

  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    const match = raw.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
  }
};

const getMetaToken = (accountId?: string) => {
  if (accountId === "act_654671961007474") {
    return (
      env.COFFEE_META_TOKEN
      ?? env.META_ADMANAGER_API_KEY_COFFEE
      ?? env.META_ADMANAGER_API_KEY
      ?? ""
    );
  }
  return env.META_ADMANAGER_API_KEY ?? "";
};

const fetchMeta = async <T>(
  path: string,
  params: Record<string, string> = {},
): Promise<MetaFetchResult<T>> => {
  const accountId = path.match(/^\/(act_\d+)/)?.[1];
  const token = getMetaToken(accountId);
  if (!token) return { ok: false, error: "META_ADMANAGER_API_KEY 미설정" };

  const url = new URL(`${META_GRAPH_URL}${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  const body = await response.json() as Record<string, unknown>;

  if (body.error) {
    const error = body.error as { message?: string };
    return { ok: false, error: error.message ?? "Meta API error" };
  }

  return { ok: true, data: body as T };
};

const fetchMetaInsights = async (params: {
  accountId: string;
  fields: string;
  level?: string;
  timeIncrement?: string;
  datePreset?: string;
  range?: DateRange;
  limit?: string;
  actionReportTime?: string;
  useUnifiedAttributionSetting?: boolean;
  actionAttributionWindows?: string[];
}): Promise<MetaFetchResult<MetaInsightRow[]>> => {
  const query: Record<string, string> = {
    fields: params.fields,
    limit: params.limit ?? "100",
  };

  if (params.level) query.level = params.level;
  if (params.timeIncrement) query.time_increment = params.timeIncrement;
  if (params.actionReportTime) query.action_report_time = params.actionReportTime;
  if (params.useUnifiedAttributionSetting) {
    query.use_unified_attribution_setting = "true";
  }
  if (params.actionAttributionWindows?.length) {
    query.action_attribution_windows = JSON.stringify(params.actionAttributionWindows);
  }
  if (params.range) {
    query.time_range = JSON.stringify({
      since: params.range.startDate,
      until: params.range.endDate,
    });
  } else if (params.datePreset) {
    query.date_preset = params.datePreset;
  }

  const result = await fetchMeta<{ data: MetaInsightRow[] }>(
    `/${params.accountId}/insights`,
    query,
  );

  if (!result.ok) return result;
  return { ok: true, data: result.data.data ?? [] };
};

type LocalAliasAuditFile = {
  campaigns?: Array<{
    campaignId?: string;
    campaignName?: string;
    adsets?: Array<{
      adsetId?: string;
      adsetName?: string;
    }>;
  }>;
};

const loadLocalAuditAdsetCampaignMap = async (
  site: SiteKey | null,
): Promise<AdsetCampaignMap> => {
  const map: AdsetCampaignMap = new Map();
  if (!site) return map;

  try {
    const raw = await fs.readFile(path.resolve(DATA_DIR, `meta_campaign_alias_audit.${site}.json`), "utf8");
    const audit = JSON.parse(raw) as LocalAliasAuditFile;
    for (const campaign of audit.campaigns ?? []) {
      const campaignId = campaign.campaignId?.trim() ?? "";
      if (!campaignId) continue;
      for (const adset of campaign.adsets ?? []) {
        const adsetId = adset.adsetId?.trim() ?? "";
        if (!adsetId) continue;
        map.set(adsetId, {
          campaignId,
          campaignName: campaign.campaignName?.trim() ?? "",
          adsetName: adset.adsetName?.trim() ?? "",
        });
      }
    }
  } catch {
    return map;
  }

  return map;
};

const fetchMetaAdsetCampaignMap = async (
  accountId: string,
): Promise<{ map: AdsetCampaignMap; error: string | null }> => {
  const result = await fetchMeta<{
    data: Array<{
      id: string;
      name?: string;
      campaign_id?: string;
      campaign?: { id?: string; name?: string };
    }>;
  }>(
    `/${accountId}/adsets`,
    { fields: "id,name,campaign_id,campaign{id,name}", limit: "500" },
  );

  if (!result.ok) {
    const siteAccount = findSiteAccountByAccountId(accountId);
    const fallbackMap = await loadLocalAuditAdsetCampaignMap(siteAccount?.site ?? null);
    return {
      map: fallbackMap,
      error: fallbackMap.size > 0
        ? `${result.error}; local alias audit fallback adsets=${fallbackMap.size}`
        : result.error,
    };
  }

  const map: AdsetCampaignMap = new Map();
  for (const adset of result.data.data ?? []) {
    const campaignId = adset.campaign_id ?? adset.campaign?.id ?? "";
    if (!adset.id || !campaignId) continue;
    map.set(adset.id, {
      campaignId,
      campaignName: adset.campaign?.name ?? "",
      adsetName: adset.name ?? "",
    });
  }
  return { map, error: null };
};

const buildMetaReference = (params?: {
  mode?: MetaReference["mode"];
  requestedAttributionWindow?: string | null;
  appliedAttributionWindows?: string[] | null;
}): MetaReference => {
  const mode = params?.mode ?? "ads_manager_parity";
  return {
    mode,
    actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
    useUnifiedAttributionSetting: mode === "ads_manager_parity"
      ? META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING
      : false,
    requestedAttributionWindow: params?.requestedAttributionWindow ?? null,
    appliedAttributionWindows: params?.appliedAttributionWindows ?? null,
    actionValueField: "action_values[purchase]",
    purchaseRoasField: "purchase_roas",
    websitePurchaseRoasField: "website_purchase_roas",
    numeratorDefinition: "Meta ROAS 분자는 PG confirmed revenue가 아니라 Meta가 광고에 귀속한 conversion value임",
    comparisonGuidance: "운영 메인은 Attribution confirmed ROAS, Meta purchase ROAS는 platform reference로만 해석",
  };
};

const pickActionValue = (
  action: MetaInsightAction,
  attributionWindow: MetaAttributionWindow | null,
) => toNumber(attributionWindow ? action[attributionWindow] ?? action.value : action.value);

const parseActions = (
  actions: MetaInsightAction[] | undefined,
  attributionWindow: MetaAttributionWindow | null = null,
) => {
  const actionMap: Record<string, number> = {};
  for (const action of actions ?? []) {
    actionMap[action.action_type] = pickActionValue(action, attributionWindow);
  }
  return {
    landingPageViews: actionMap.landing_page_view ?? 0,
    leads: actionMap.lead ?? actionMap["offsite_conversion.fb_pixel_lead"] ?? 0,
    purchases: actionMap.purchase ?? actionMap["offsite_conversion.fb_pixel_purchase"] ?? 0,
  };
};

const parsePurchaseValue = (
  actionValues: MetaInsightAction[] | undefined,
  attributionWindow: MetaAttributionWindow | null = null,
) => {
  const action = actionValues?.find((item) => item.action_type === "purchase");
  return action ? pickActionValue(action, attributionWindow) : 0;
};

const summarizeMetaRows = (
  rows: MetaInsightRow[],
  attributionWindow: MetaAttributionWindow | null = null,
): MetaTotals => {
  const totals = rows.reduce<MetaTotals>((sum, row) => {
    const actions = parseActions(row.actions, attributionWindow);
    sum.impressions += toNumber(row.impressions);
    sum.clicks += toNumber(row.clicks);
    sum.spend += toNumber(row.spend);
    sum.landingPageViews += actions.landingPageViews;
    sum.leads += actions.leads;
    sum.purchases += actions.purchases;
    sum.purchaseValue += parsePurchaseValue(row.action_values, attributionWindow);
    return sum;
  }, {
    impressions: 0,
    clicks: 0,
    spend: 0,
    cpc: 0,
    cpm: 0,
    landingPageViews: 0,
    leads: 0,
    purchases: 0,
    purchaseValue: 0,
  });

  return {
    ...totals,
    cpc: totals.clicks > 0 ? round2(totals.spend / totals.clicks) : 0,
    cpm: totals.impressions > 0 ? round2((totals.spend / totals.impressions) * 1000) : 0,
  };
};

const aggregateMetaCampaigns = (rows: MetaInsightRow[]): MetaCampaignAggregate[] => {
  const grouped = new Map<string, MetaCampaignAggregate>();

  for (const row of rows) {
    const campaignId = row.campaign_id || row.campaign_name || "(unknown)";
    const existing = grouped.get(campaignId) ?? {
      campaignId,
      campaignName: row.campaign_name || row.campaign_id || "(unknown)",
      impressions: 0,
      clicks: 0,
      spend: 0,
    };

    existing.impressions += toNumber(row.impressions);
    existing.clicks += toNumber(row.clicks);
    existing.spend += toNumber(row.spend);
    grouped.set(campaignId, existing);
  }

  return [...grouped.values()].sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
};

const sortEntriesByPreference = (entries: AttributionLedgerEntry[]) => [...entries].sort((a, b) => (
  CAPTURE_MODE_PRIORITY[b.captureMode] - CAPTURE_MODE_PRIORITY[a.captureMode]
  || Number(Boolean(b.utmSource || b.utmCampaign || b.fbclid || b.gclid))
    - Number(Boolean(a.utmSource || a.utmCampaign || a.fbclid || a.gclid))
  || b.loggedAt.localeCompare(a.loggedAt)
));

const extractStatus = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  return typeof metadata.status === "string" ? metadata.status.trim() : "";
};

const resolveOrderPaymentStatus = (entries: AttributionLedgerEntry[]): AttributionPaymentStatus => entries.reduce<AttributionPaymentStatus>(
  (current, entry) => {
    const candidate = entry.paymentStatus ?? "pending";
    return PAYMENT_STATUS_PRIORITY[candidate] > PAYMENT_STATUS_PRIORITY[current]
      ? candidate
      : current;
  },
  "pending",
);

export const extractLedgerAmount = (entry: AttributionLedgerEntry): number | null => {
  const metadata = toObject(entry.metadata);
  const referrerPayment = toObject(metadata.referrerPayment);

  const referrerAmount = (() => {
    try {
      const raw = entry.referrer.trim();
      if (!raw) return null;
      return toPositiveNumber(new URL(raw).searchParams.get("amount"));
    } catch {
      return null;
    }
  })();

  const candidates = [
    metadata.totalAmount,
    metadata.total_amount,
    metadata.amount,
    metadata.paymentAmount,
    metadata.payment_amount,
    referrerPayment.amount,
    referrerAmount,
  ];

  for (const candidate of candidates) {
    const amount = toPositiveNumber(candidate);
    if (amount !== null) return amount;
  }

  return null;
};

const resolveSiteFromString = (value: string): SiteKey | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("biocom")) return "biocom";
  if (normalized.startsWith("thecleancoffee")) return "thecleancoffee";
  if (normalized.startsWith("aibio")) return "aibio";
  return null;
};

export const inferSiteFromLedgerEntry = (entry: AttributionLedgerEntry): SiteKey | null => {
  const metadata = toObject(entry.metadata);
  const source = typeof metadata.source === "string" ? resolveSiteFromString(metadata.source) : null;
  if (source) return source;

  const store = typeof metadata.store === "string" ? resolveSiteFromString(metadata.store) : null;
  if (store) return store;

  for (const candidate of [
    entry.requestContext.origin,
    entry.requestContext.requestReferer,
    entry.referrer,
    entry.landing,
  ]) {
    const host = resolveHost(candidate);
    if (!host) continue;
    const matchedSite = SITE_ACCOUNTS.find((site) =>
      site.hosts.some((siteHost) => host === siteHost || host.endsWith(`.${siteHost}`)));
    if (matchedSite) return matchedSite.site;
  }

  return null;
};

const resolveLedgerOrderDate = (entry: AttributionLedgerEntry): string | null =>
  normalizeDateLike(entry.approvedAt) ?? normalizeDateLike(entry.loggedAt);

const getOrderKey = (entry: AttributionLedgerEntry, index: number) =>
  entry.paymentKey || entry.orderId || `ledger:${index}:${entry.loggedAt}`;

export const buildNormalizedLedgerOrders = (
  entries: AttributionLedgerEntry[],
): NormalizedLedgerOrder[] => {
  const grouped = new Map<string, AttributionLedgerEntry[]>();

  entries
    .filter((entry) => entry.touchpoint === "payment_success")
    .forEach((entry, index) => {
      const key = getOrderKey(entry, index);
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

  return [...grouped.entries()].map(([key, group]) => {
    const preferred = sortEntriesByPreference(group);
    const attributionCarrier = preferred.find(
      (entry) => Boolean(entry.utmSource || entry.utmCampaign || entry.fbclid || entry.gclid || entry.ttclid),
    ) ?? preferred[0];

    const amount = preferred.map(extractLedgerAmount).find((value) => value !== null) ?? null;
    const site = preferred.map(inferSiteFromLedgerEntry).find((value) => value !== null) ?? null;
    const approvedDate = preferred.map(resolveLedgerOrderDate).find((value) => value !== null) ?? null;
    const paymentStatus = resolveOrderPaymentStatus(preferred);
    const statusCarrier = [...preferred].sort((a, b) => (
      PAYMENT_STATUS_PRIORITY[b.paymentStatus ?? "pending"] - PAYMENT_STATUS_PRIORITY[a.paymentStatus ?? "pending"]
      || b.loggedAt.localeCompare(a.loggedAt)
    ))[0];
    const status = extractStatus(statusCarrier) || paymentStatus.toUpperCase();
    const urlCandidates = preferred.flatMap((entry) => [
      entry.landing,
      entry.referrer,
      firstMetadataString(entry.metadata, [
        "imweb_landing_url",
        "checkout_started_landing",
        "checkoutUrl",
        "initial_referrer",
        "original_referrer",
      ]),
    ]);
    const utmTerm = attributionCarrier?.utmTerm ?? "";

    return {
      key,
      orderId: firstNonEmpty(preferred.map((entry) => entry.orderId)),
      paymentKey: firstNonEmpty(preferred.map((entry) => entry.paymentKey)),
      approvedDate,
      amount,
      site,
      customerKey: firstNonEmpty(preferred.map((entry) => normalizePhone(entry.customerKey))),
      utmSource: attributionCarrier?.utmSource ?? "",
      utmCampaign: attributionCarrier?.utmCampaign ?? "",
      utmTerm,
      fbclid: attributionCarrier?.fbclid ?? "",
      gclid: attributionCarrier?.gclid ?? "",
      ttclid: attributionCarrier?.ttclid ?? "",
      campaignIdHint: extractFirstUrlParam(urlCandidates, "utm_id"),
      adsetIdHint: firstNonEmpty([utmTerm, extractFirstUrlParam(urlCandidates, "utm_term")]),
      captureMode: attributionCarrier?.captureMode ?? preferred[0]?.captureMode ?? "live",
      paymentStatus,
      status,
      completed: paymentStatus === "confirmed",
      entryCount: group.length,
    };
  }).sort((a, b) => (
    (b.approvedDate ?? "").localeCompare(a.approvedDate ?? "")
    || b.key.localeCompare(a.key)
  ));
};

const normalizeSource = (value: string) => value.trim().toLowerCase();

const inDateRange = (date: string | null, range: DateRange) =>
  Boolean(date && date >= range.startDate && date <= range.endDate);

const isMetaAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  const campaign = normalizeSource(order.utmCampaign);
  return (
    source === "fb"
    || source.includes("facebook")
    || source.includes("meta")
    || campaign.includes("meta")
    || Boolean(order.fbclid.trim())
    || Boolean(order.campaignIdHint.trim())
    || Boolean(order.adsetIdHint.trim())
  );
};

const isGoogleAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  return source.includes("google") || Boolean(order.gclid.trim());
};

const isDaangnAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  return source.includes("daangn")
    || source.includes("danggn")
    || source.includes("karrot")
    || source.includes("당근");
};

const filterOrdersByRange = (
  orders: NormalizedLedgerOrder[],
  range: DateRange,
) => orders.filter((order) => order.completed && inDateRange(order.approvedDate, range));

const filterOrdersByDateRange = (
  orders: NormalizedLedgerOrder[],
  range: DateRange,
) => orders.filter((order) => inDateRange(order.approvedDate, range));

const computeRoas = (
  revenue: number,
  spend: number,
  ledgerAvailable: boolean,
): number | null => {
  if (!ledgerAvailable) return null;
  if (spend <= 0) return null;
  return round2(revenue / spend);
};

const computeObservedRoas = (value: number, spend: number) => {
  if (spend <= 0) return null;
  return round2(value / spend);
};

const sumRevenue = (orders: NormalizedLedgerOrder[]) =>
  round2(orders.reduce((sum, order) => sum + (order.amount ?? 0), 0));

const normalizeCampaignKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");

type AdsetCampaignMatch = {
  campaignId: string;
  campaignName: string;
  adsetName: string;
};

type AdsetCampaignMap = Map<string, AdsetCampaignMatch>;

type CampaignAliasMatch = {
  campaignId: string;
  campaignName: string | null;
  validFrom: string | null;
  validTo: string | null;
  confidence: string;
};

type CampaignAliasMap = Map<string, CampaignAliasMatch[]>;

const fetchManualVerifiedAliasMap = async (
  site: SiteKey | null,
): Promise<{ map: CampaignAliasMap; error: string | null }> => {
  const map: CampaignAliasMap = new Map();
  if (!site) return { map, error: null };

  try {
    const review = await loadAliasReviewItems(site);
    for (const item of review.items) {
      if (item.status !== "manual_verified" || !item.selectedCampaignId) continue;
      const aliasKey = normalizeCampaignKey(item.aliasKey);
      if (!aliasKey) continue;
      const bucket = map.get(aliasKey) ?? [];
      bucket.push({
        campaignId: item.selectedCampaignId,
        campaignName: item.selectedCampaignName,
        validFrom: item.validFrom,
        validTo: item.validTo,
        confidence: item.confidence,
      });
      map.set(aliasKey, bucket);
    }
    return { map, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { map, error: message };
  }
};

const isAliasMatchActive = (match: CampaignAliasMatch, orderDate: string | null) => {
  if (!orderDate) return true;
  if (match.validFrom && orderDate < match.validFrom) return false;
  if (match.validTo && orderDate > match.validTo) return false;
  return true;
};

const matchCampaignId = (
  utmCampaign: string,
  campaigns: MetaCampaignAggregate[],
): string | null => {
  const key = normalizeCampaignKey(utmCampaign);
  if (!key) return null;

  const exactMatch = campaigns.find((campaign) => (
    normalizeCampaignKey(campaign.campaignId) === key
    || normalizeCampaignKey(campaign.campaignName) === key
  ));
  if (exactMatch) return exactMatch.campaignId;

  const fuzzyMatches = campaigns.filter((campaign) => {
    const campaignKey = normalizeCampaignKey(campaign.campaignName);
    return campaignKey.includes(key) || key.includes(campaignKey);
  });

  return fuzzyMatches.length === 1 ? fuzzyMatches[0]?.campaignId ?? null : null;
};

const matchCampaignIdForOrder = (
  order: NormalizedLedgerOrder,
  campaigns: MetaCampaignAggregate[],
  adsetCampaignMap: AdsetCampaignMap = new Map(),
  campaignAliasMap: CampaignAliasMap = new Map(),
): string | null => {
  const campaignIdHint = order.campaignIdHint.trim();
  if (campaignIdHint && campaigns.some((campaign) => campaign.campaignId === campaignIdHint)) {
    return campaignIdHint;
  }

  const adsetMatch = adsetCampaignMap.get(order.adsetIdHint.trim());
  if (adsetMatch && campaigns.some((campaign) => campaign.campaignId === adsetMatch.campaignId)) {
    return adsetMatch.campaignId;
  }

  const directMatch = matchCampaignId(order.utmCampaign, campaigns);
  if (directMatch) return directMatch;

  const aliasKey = normalizeCampaignKey(firstNonEmpty([order.utmCampaign, order.utmSource]));
  const activeAliasCampaignIds = new Set(
    (campaignAliasMap.get(aliasKey) ?? [])
      .filter((match) => isAliasMatchActive(match, order.approvedDate))
      .filter((match) => campaigns.some((campaign) => campaign.campaignId === match.campaignId))
      .map((match) => match.campaignId),
  );

  return activeAliasCampaignIds.size === 1 ? [...activeAliasCampaignIds][0] ?? null : null;
};

export const buildCampaignRoasRows = (params: {
  metaRows: MetaInsightRow[];
  orders: NormalizedLedgerOrder[];
  ledgerAvailable: boolean;
  adsetCampaignMap?: AdsetCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
}): CampaignRoasRow[] => {
  const campaigns = aggregateMetaCampaigns(params.metaRows);
  const revenueByCampaignId = new Map<string, { revenue: number; orders: number }>();
  let unmappedRevenue = 0;
  let unmappedOrders = 0;

  for (const order of params.orders.filter((candidate) => candidate.completed).filter(isMetaAttributedOrder)) {
    const matchedCampaignId = matchCampaignIdForOrder(
      order,
      campaigns,
      params.adsetCampaignMap,
      params.campaignAliasMap,
    );
    if (!matchedCampaignId) {
      unmappedRevenue += order.amount ?? 0;
      unmappedOrders += 1;
      continue;
    }

    const existing = revenueByCampaignId.get(matchedCampaignId) ?? { revenue: 0, orders: 0 };
    existing.revenue += order.amount ?? 0;
    existing.orders += 1;
    revenueByCampaignId.set(matchedCampaignId, existing);
  }

  const rows: CampaignRoasRow[] = campaigns.map((campaign) => {
    const attribution = revenueByCampaignId.get(campaign.campaignId);
    const attributedRevenue = round2(attribution?.revenue ?? 0);
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      spend: round2(campaign.spend),
      attributedRevenue,
      roas: computeRoas(attributedRevenue, campaign.spend, params.ledgerAvailable),
      orders: attribution?.orders ?? 0,
    };
  });

  if (unmappedOrders > 0 || unmappedRevenue > 0) {
    rows.push({
      campaignId: null,
      campaignName: "(unmapped)",
      spend: 0,
      attributedRevenue: round2(unmappedRevenue),
      roas: params.ledgerAvailable ? null : null,
      orders: unmappedOrders,
    });
  }

  return rows.sort((a, b) => b.spend - a.spend || b.attributedRevenue - a.attributedRevenue);
};

const ADS_ORDER_DATE_SQL = `
  case
    when trim(coalesce(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(payment_complete_time::text), 10)::date
    when trim(coalesce(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(order_date::text), 10)::date
    else null
  end
`;
const ADS_ORDER_REVENUE_SQL = `
  greatest(
    coalesce(nullif(final_order_amount, 0), nullif(paid_price, 0), nullif(total_price, 0), 0)
      - coalesce(total_refunded_price, 0),
    0
  )
`;
const ADS_NORMALIZED_PHONE_SQL = `regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g')`;
const ADS_NORMALIZED_CONTACT_SQL = `regexp_replace(coalesce(customer_contact::text, ''), '[^0-9]', '', 'g')`;

type AdsOrderIdentityRow = {
  order_number: string;
  normalized_phone: string;
  order_date: string;
  net_revenue: number | string;
  product_names: string[] | null;
};

type AdsOrderFact = {
  orderNumber: string;
  normalizedPhone: string;
  orderDate: string;
  netRevenue: number;
  productCategories: Set<"test_kit" | "supplement" | "other">;
};

const normalizeProductNames = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const mapOrderFact = (row: AdsOrderIdentityRow): AdsOrderFact | null => {
  const normalizedPhone = normalizePhone(row.normalized_phone);
  const orderDate = normalizeDateLike(String(row.order_date ?? ""));
  if (!row.order_number || !normalizedPhone || !orderDate) return null;
  return {
    orderNumber: row.order_number,
    normalizedPhone,
    orderDate,
    netRevenue: toNumber(row.net_revenue),
    productCategories: new Set(normalizeProductNames(row.product_names).map(categorizeProductName)),
  };
};

const fetchOrderFactsByOrderNumbers = async (orderNumbers: string[]) => {
  const uniqueOrderNumbers = [...new Set(orderNumbers.filter((value) => value.trim()))];
  if (uniqueOrderNumbers.length === 0) return new Map<string, AdsOrderFact>();

  const result = await queryPg<AdsOrderIdentityRow>(
    `
      select
        order_number::text as order_number,
        ${ADS_NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ADS_ORDER_DATE_SQL}::text as order_date,
        max(${ADS_ORDER_REVENUE_SQL}) as net_revenue,
        array_agg(distinct coalesce(nullif(trim(product_name), ''), '미분류')) as product_names
      from public.tb_iamweb_users
      where order_number::text = any($1::text[])
        and ${ADS_ORDER_DATE_SQL} is not null
        and ${ADS_ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      group by order_number::text, ${ADS_NORMALIZED_PHONE_SQL}, ${ADS_ORDER_DATE_SQL}
    `,
    [uniqueOrderNumbers],
  );

  const facts = new Map<string, AdsOrderFact>();
  for (const row of result.rows) {
    const fact = mapOrderFact(row);
    if (fact) facts.set(fact.orderNumber, fact);
  }
  return facts;
};

const fetchOrderFactsByPhones = async (phones: string[], startDate: string, endDate: string) => {
  const uniquePhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (uniquePhones.length === 0) return new Map<string, AdsOrderFact[]>();

  const result = await queryPg<AdsOrderIdentityRow>(
    `
      select
        order_number::text as order_number,
        ${ADS_NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ADS_ORDER_DATE_SQL}::text as order_date,
        max(${ADS_ORDER_REVENUE_SQL}) as net_revenue,
        array_agg(distinct coalesce(nullif(trim(product_name), ''), '미분류')) as product_names
      from public.tb_iamweb_users
      where ${ADS_NORMALIZED_PHONE_SQL} = any($1::text[])
        and ${ADS_ORDER_DATE_SQL} between $2::date and $3::date
        and ${ADS_ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      group by order_number::text, ${ADS_NORMALIZED_PHONE_SQL}, ${ADS_ORDER_DATE_SQL}
      order by ${ADS_NORMALIZED_PHONE_SQL} asc, ${ADS_ORDER_DATE_SQL} asc, order_number::text asc
    `,
    [uniquePhones, startDate, endDate],
  );

  const grouped = new Map<string, AdsOrderFact[]>();
  for (const row of result.rows) {
    const fact = mapOrderFact(row);
    if (!fact) continue;
    const bucket = grouped.get(fact.normalizedPhone) ?? [];
    bucket.push(fact);
    grouped.set(fact.normalizedPhone, bucket);
  }
  return grouped;
};

const fetchCompletedConsultationPhones = async (phones: string[]) => {
  const uniquePhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (uniquePhones.length === 0) return new Set<string>();

  const result = await queryPg<{ normalized_phone: string }>(
    `
      select distinct ${ADS_NORMALIZED_CONTACT_SQL} as normalized_phone
      from public.tb_consultation_records
      where ${ADS_NORMALIZED_CONTACT_SQL} = any($1::text[])
        and coalesce(consultation_status::text, '') like '%완료%'
    `,
    [uniquePhones],
  );

  return new Set(result.rows.map((row) => normalizePhone(row.normalized_phone)).filter(Boolean));
};

const buildCampaignOrderMap = (params: {
  campaigns: MetaCampaignAggregate[];
  orders: NormalizedLedgerOrder[];
  adsetCampaignMap?: AdsetCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
}) => {
  const matched = new Map<string, NormalizedLedgerOrder[]>();
  for (const order of params.orders.filter((candidate) => candidate.completed).filter(isMetaAttributedOrder)) {
    const campaignId = matchCampaignIdForOrder(
      order,
      params.campaigns,
      params.adsetCampaignMap,
      params.campaignAliasMap,
    );
    if (!campaignId) continue;
    const bucket = matched.get(campaignId) ?? [];
    bucket.push(order);
    matched.set(campaignId, bucket);
  }
  return matched;
};

const buildBlockedLtvRows = (campaignRows: CampaignRoasRow[], ltvWindowDays: number, blocker: string) =>
  campaignRows.map((row): CampaignLtvRoasRow => ({
    ...row,
    ltvRevenue: row.attributedRevenue,
    repeatRevenue: 0,
    supplementRevenue: 0,
    ltvRoas: computeRoas(row.attributedRevenue, row.spend, true),
    matchedCustomers: 0,
    consultedCustomers: 0,
    supplementCustomers: 0,
    identityMatchedOrders: 0,
    ltvStatus: "blocked",
    ltvBlocker: `${blocker} (window=${ltvWindowDays}d)`,
  }));

const buildCampaignLtvRoasRows = async (params: {
  campaignRows: CampaignRoasRow[];
  campaigns: MetaCampaignAggregate[];
  orders: NormalizedLedgerOrder[];
  range: DateRange;
  adsetCampaignMap?: AdsetCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
  ltvWindowDays: number;
}): Promise<CampaignLtvRoasRow[]> => {
  if (!isDatabaseConfigured()) {
    return buildBlockedLtvRows(params.campaignRows, params.ltvWindowDays, "DATABASE_URL 미설정");
  }

  const campaignOrderMap = buildCampaignOrderMap({
    campaigns: params.campaigns,
    orders: params.orders,
    adsetCampaignMap: params.adsetCampaignMap,
    campaignAliasMap: params.campaignAliasMap,
  });
  const orderNumbers = [...campaignOrderMap.values()].flat().map((order) => order.orderId);
  const orderFactsByOrderNumber = await fetchOrderFactsByOrderNumbers(orderNumbers);
  const phones = [...new Set([...orderFactsByOrderNumber.values()].map((fact) => fact.normalizedPhone))];
  const futureOrdersByPhone = await fetchOrderFactsByPhones(
    phones,
    params.range.startDate,
    shiftIsoDateByDays(params.range.endDate, params.ltvWindowDays),
  );
  const completedConsultationPhones = await fetchCompletedConsultationPhones(phones);

  return params.campaignRows.map((row) => {
    if (!row.campaignId) {
      return {
        ...row,
        ltvRevenue: row.attributedRevenue,
        repeatRevenue: 0,
        supplementRevenue: 0,
        ltvRoas: null,
        matchedCustomers: 0,
        consultedCustomers: 0,
        supplementCustomers: 0,
        identityMatchedOrders: 0,
        ltvStatus: "no_attribution",
        ltvBlocker: "캠페인 미매핑 버킷",
      };
    }

    const campaignOrders = campaignOrderMap.get(row.campaignId) ?? [];
    if (campaignOrders.length === 0) {
      return {
        ...row,
        ltvRevenue: 0,
        repeatRevenue: 0,
        supplementRevenue: 0,
        ltvRoas: computeRoas(0, row.spend, true),
        matchedCustomers: 0,
        consultedCustomers: 0,
        supplementCustomers: 0,
        identityMatchedOrders: 0,
        ltvStatus: "no_attribution",
        ltvBlocker: "confirmed attribution 주문 없음",
      };
    }

    const ordersByPhone = new Map<string, NormalizedLedgerOrder[]>();
    let identityMatchedOrders = 0;
    let unmatchedAttributedRevenue = 0;

    for (const order of campaignOrders) {
      const fact = orderFactsByOrderNumber.get(order.orderId);
      const phone = fact?.normalizedPhone ?? normalizePhone(order.customerKey);
      if (!phone) {
        unmatchedAttributedRevenue += order.amount ?? 0;
        continue;
      }
      identityMatchedOrders += 1;
      const bucket = ordersByPhone.get(phone) ?? [];
      bucket.push(order);
      ordersByPhone.set(phone, bucket);
    }

    let ltvRevenue = unmatchedAttributedRevenue;
    let supplementRevenue = 0;
    let consultedCustomers = 0;
    let supplementCustomers = 0;

    for (const [phone, orders] of ordersByPhone.entries()) {
      const anchorDate = orders
        .map((order) => order.approvedDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? params.range.startDate;
      const attributedRevenueForPhone = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
      const windowEnd = shiftIsoDateByDays(anchorDate, params.ltvWindowDays);
      const ltvOrders = (futureOrdersByPhone.get(phone) ?? []).filter(
        (order) => order.orderDate >= anchorDate && order.orderDate <= windowEnd,
      );
      const phoneLtvRevenue = ltvOrders.reduce((sum, order) => sum + order.netRevenue, 0);
      const phoneSupplementRevenue = ltvOrders
        .filter((order) => order.productCategories.has("supplement"))
        .reduce((sum, order) => sum + order.netRevenue, 0);

      ltvRevenue += Math.max(phoneLtvRevenue, attributedRevenueForPhone);
      supplementRevenue += phoneSupplementRevenue;
      if (phoneSupplementRevenue > 0) supplementCustomers += 1;
      if (completedConsultationPhones.has(phone)) consultedCustomers += 1;
    }

    const roundedLtvRevenue = round2(ltvRevenue);
    const repeatRevenue = Math.max(0, roundedLtvRevenue - row.attributedRevenue);
    const matchedCustomers = ordersByPhone.size;
    const ltvStatus: CampaignLtvRoasRow["ltvStatus"] =
      matchedCustomers === 0
        ? "identity_missing"
        : identityMatchedOrders < 2 || row.attributedRevenue < 500_000
          ? "low_sample"
          : "ready";

    return {
      ...row,
      ltvRevenue: roundedLtvRevenue,
      repeatRevenue: round2(repeatRevenue),
      supplementRevenue: round2(supplementRevenue),
      ltvRoas: computeRoas(roundedLtvRevenue, row.spend, true),
      matchedCustomers,
      consultedCustomers,
      supplementCustomers,
      identityMatchedOrders,
      ltvStatus,
      ltvBlocker:
        ltvStatus === "identity_missing"
          ? "order_number/customer phone 매칭 실패"
          : ltvStatus === "low_sample"
            ? "표본 부족: confirmed 2건 이상 또는 ₩500,000 이상 필요"
            : null,
    };
  });
};

export const buildDailyRoasRows = (params: {
  range: DateRange;
  metaRows: MetaInsightRow[];
  orders: NormalizedLedgerOrder[];
  ledgerAvailable: boolean;
  attributionWindow?: MetaAttributionWindow | null;
}): DailyRoasRow[] => {
  const spendByDate = new Map<string, number>();
  const metaPurchaseValueByDate = new Map<string, number>();
  for (const row of params.metaRows) {
    const date = normalizeDateLike(row.date_start);
    if (!date) continue;
    spendByDate.set(date, (spendByDate.get(date) ?? 0) + toNumber(row.spend));
    metaPurchaseValueByDate.set(
      date,
      (metaPurchaseValueByDate.get(date) ?? 0) + parsePurchaseValue(row.action_values, params.attributionWindow ?? null),
    );
  }

  const confirmedRevenueByDate = new Map<string, number>();
  const pendingRevenueByDate = new Map<string, number>();
  for (const order of params.orders.filter(isMetaAttributedOrder)) {
    if (!order.approvedDate) continue;
    if (order.paymentStatus === "confirmed") {
      confirmedRevenueByDate.set(
        order.approvedDate,
        (confirmedRevenueByDate.get(order.approvedDate) ?? 0) + (order.amount ?? 0),
      );
      continue;
    }
    if (order.paymentStatus === "pending") {
      pendingRevenueByDate.set(
        order.approvedDate,
        (pendingRevenueByDate.get(order.approvedDate) ?? 0) + (order.amount ?? 0),
      );
    }
  }

  const rows: DailyRoasRow[] = [];
  for (
    let date = params.range.startDate;
    date <= params.range.endDate;
    date = shiftIsoDateByDays(date, 1)
  ) {
    const spend = round2(spendByDate.get(date) ?? 0);
    const confirmedRevenue = round2(confirmedRevenueByDate.get(date) ?? 0);
    const pendingRevenue = round2(pendingRevenueByDate.get(date) ?? 0);
    const potentialRevenue = round2(confirmedRevenue + pendingRevenue);
    const metaPurchaseValue = round2(metaPurchaseValueByDate.get(date) ?? 0);
    rows.push({
      date,
      spend,
      revenue: confirmedRevenue,
      roas: computeRoas(confirmedRevenue, spend, params.ledgerAvailable),
      confirmedRevenue,
      pendingRevenue,
      potentialRevenue,
      metaPurchaseValue,
      confirmedRoas: computeRoas(confirmedRevenue, spend, params.ledgerAvailable),
      potentialRoas: computeRoas(potentialRevenue, spend, params.ledgerAvailable),
      metaPurchaseRoas: computeObservedRoas(metaPurchaseValue, spend),
    });
  }

  return rows;
};

const fetchSiteMetaSummary = async (params: {
  site: SiteKey;
  accountId: string;
  range: DateRange;
  datePreset: string | null;
  attributionWindow?: MetaAttributionWindow | null;
}): Promise<SiteMetaSummary> => {
  const result = await fetchMetaInsights({
    accountId: params.accountId,
    fields: "impressions,clicks,spend,cpc,cpm,actions,action_values",
    datePreset: params.datePreset ?? undefined,
    range: params.datePreset ? undefined : params.range,
    limit: "10",
    actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
    useUnifiedAttributionSetting: params.attributionWindow
      ? false
      : META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
    actionAttributionWindows: params.attributionWindow
      ? [params.attributionWindow]
      : undefined,
  });

  if (!result.ok) {
    return {
      site: params.site,
      accountId: params.accountId,
      impressions: 0,
      clicks: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      landingPageViews: 0,
      leads: 0,
      purchases: 0,
      purchaseValue: 0,
      metaError: result.error,
    };
  }

  return {
    site: params.site,
    accountId: params.accountId,
    ...summarizeMetaRows(result.data, params.attributionWindow ?? null),
    metaError: null,
  };
};

const loadLedgerOrders = async () => {
  const entries = await readLedgerEntries();
  return {
    entries,
    orders: buildNormalizedLedgerOrders(entries),
  };
};

type IroasMetaError = {
  site: SiteKey;
  account_id: string;
  error: string;
};

type IroasVariantRow = VariantSummary & {
  group: "control" | "treatment";
};

type ExperimentIroasSnapshot = {
  experiment_key: string;
  name: string;
  status: string;
  channel: string;
  start_date: string | null;
  end_date: string | null;
  site_scope: SiteKey[];
  variants: IroasVariantRow[];
  treatment_revenue: number;
  control_revenue: number;
  incremental_revenue: number;
  ad_spend: number;
  iroas: number | null;
  roas: number | null;
  treatment_count: number;
  control_count: number;
  treatment_purchase_rate: number;
  control_purchase_rate: number;
  treatment_purchaser_count: number;
  control_purchaser_count: number;
  treatment_purchase_count: number;
  control_purchase_count: number;
  meta_errors: IroasMetaError[];
};

const CONTROL_VARIANT_KEY = "control";

const round4 = (value: number) => Number(value.toFixed(4));

const isControlVariant = (variantKey: string) =>
  variantKey.trim().toLowerCase() === CONTROL_VARIANT_KEY;

const computeSpendRatio = (
  numerator: number,
  denominator: number,
  ready: boolean,
): number | null => {
  if (!ready || denominator <= 0) return null;
  return round2(numerator / denominator);
};

const dedupeMetaErrors = (errors: IroasMetaError[]) => {
  const byKey = new Map<string, IroasMetaError>();
  for (const error of errors) {
    const key = `${error.site}|${error.account_id}|${error.error}`;
    if (!byKey.has(key)) byKey.set(key, error);
  }
  return [...byKey.values()];
};

const inferExperimentSites = (experiment: Pick<
  CrmExperiment,
  "experiment_key" | "name" | "asset_id" | "lead_magnet_id"
>): SiteKey[] => {
  const haystack = [
    experiment.experiment_key,
    experiment.name,
    experiment.asset_id ?? "",
    experiment.lead_magnet_id ?? "",
  ].join(" ").toLowerCase();

  if (haystack.includes("coffee") || haystack.includes("커피")) {
    return ["thecleancoffee"];
  }
  if (
    haystack.includes("aibio")
    || haystack.includes("recoverylab")
    || haystack.includes("리커버리랩")
  ) {
    return ["aibio"];
  }
  if (
    haystack.includes("biocom")
    || haystack.includes("바이오컴")
    || haystack.includes("consult")
    || haystack.includes("상담")
    || haystack.includes("checkout")
    || haystack.includes("abandon")
    || haystack.includes("장바구니")
  ) {
    return ["biocom"];
  }

  return ["biocom"];
};

const resolveExperimentRangeFromWindow = (
  activityWindow: ExperimentActivityWindow | null,
): DateRange | null => {
  if (!activityWindow) return null;

  const startDate = normalizeDateLike(activityWindow.start_at ?? "");
  const endDate = normalizeDateLike(activityWindow.end_at ?? activityWindow.start_at ?? "");
  if (!startDate || !endDate) return null;

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
};

const sumVariantMetrics = (variants: VariantSummary[]) => {
  const totals = variants.reduce((sum, variant) => ({
    assignment_count: sum.assignment_count + variant.assignment_count,
    purchaser_count: sum.purchaser_count + variant.purchaser_count,
    purchase_count: sum.purchase_count + variant.purchase_count,
    net_revenue: sum.net_revenue + variant.net_revenue,
  }), {
    assignment_count: 0,
    purchaser_count: 0,
    purchase_count: 0,
    net_revenue: 0,
  });

  return {
    ...totals,
    net_revenue: round2(totals.net_revenue),
    purchase_rate: totals.assignment_count > 0
      ? round4(totals.purchaser_count / totals.assignment_count)
      : 0,
  };
};

const createMetaSpendLoader = () => {
  const cache = new Map<string, Promise<{
    ad_spend: number;
    site_scope: SiteKey[];
    meta_errors: IroasMetaError[];
  }>>();

  return (
    experiment: Pick<CrmExperiment, "experiment_key" | "name" | "asset_id" | "lead_magnet_id">,
    range: DateRange | null,
  ) => {
    const siteScope = inferExperimentSites(experiment);
    const cacheKey = `${siteScope.slice().sort().join(",")}|${range?.startDate ?? ""}|${range?.endDate ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const promise = (async () => {
      if (!range) {
        return { ad_spend: 0, site_scope: siteScope, meta_errors: [] };
      }

      const siteResults = await Promise.all(
        SITE_ACCOUNTS
          .filter((site) => siteScope.includes(site.site))
          .map((site) => fetchSiteMetaSummary({
            site: site.site,
            accountId: site.accountId,
            range,
            datePreset: null,
          })),
      );

      return {
        ad_spend: round2(siteResults.reduce((sum, site) => sum + site.spend, 0)),
        site_scope: siteScope,
        meta_errors: dedupeMetaErrors(
          siteResults
            .filter((site) => site.metaError)
            .map((site) => ({
              site: site.site,
              account_id: site.accountId,
              error: site.metaError ?? "Meta insights unavailable",
            })),
        ),
      };
    })();

    cache.set(cacheKey, promise);
    return promise;
  };
};

const buildExperimentIroasSnapshot = async (
  experiment: CrmExperiment,
  loadMetaSpend: ReturnType<typeof createMetaSpendLoader>,
): Promise<ExperimentIroasSnapshot> => {
  const result = getExperimentResults(experiment.experiment_key);
  const activityWindow = getExperimentActivityWindow(experiment.experiment_key);
  const range = resolveExperimentRangeFromWindow(activityWindow);
  const metaSpend = await loadMetaSpend(experiment, range);
  const variants: IroasVariantRow[] = result.variant_summary.map((variant) => ({
    ...variant,
    group: isControlVariant(variant.variant_key) ? "control" : "treatment",
  }));
  const controlTotals = sumVariantMetrics(variants.filter((variant) => variant.group === "control"));
  const treatmentTotals = sumVariantMetrics(variants.filter((variant) => variant.group === "treatment"));
  const hasComparableGroups = controlTotals.assignment_count > 0 && treatmentTotals.assignment_count > 0;
  const incrementalRevenue = round2(treatmentTotals.net_revenue - controlTotals.net_revenue);

  return {
    experiment_key: experiment.experiment_key,
    name: experiment.name,
    status: experiment.status,
    channel: experiment.channel,
    start_date: range?.startDate ?? null,
    end_date: range?.endDate ?? null,
    site_scope: metaSpend.site_scope,
    variants,
    treatment_revenue: treatmentTotals.net_revenue,
    control_revenue: controlTotals.net_revenue,
    incremental_revenue: incrementalRevenue,
    ad_spend: metaSpend.ad_spend,
    iroas: computeSpendRatio(incrementalRevenue, metaSpend.ad_spend, hasComparableGroups),
    roas: computeSpendRatio(
      treatmentTotals.net_revenue,
      metaSpend.ad_spend,
      treatmentTotals.assignment_count > 0,
    ),
    treatment_count: treatmentTotals.assignment_count,
    control_count: controlTotals.assignment_count,
    treatment_purchase_rate: treatmentTotals.purchase_rate,
    control_purchase_rate: controlTotals.purchase_rate,
    treatment_purchaser_count: treatmentTotals.purchaser_count,
    control_purchaser_count: controlTotals.purchaser_count,
    treatment_purchase_count: treatmentTotals.purchase_count,
    control_purchase_count: controlTotals.purchase_count,
    meta_errors: metaSpend.meta_errors,
  };
};

const loadExperimentIroasSnapshots = async () => {
  const experiments = listExperiments();
  const loadMetaSpend = createMetaSpendLoader();
  return Promise.all(experiments.map((experiment) => buildExperimentIroasSnapshot(experiment, loadMetaSpend)));
};

export const createAdsRouter = () => {
  const router = express.Router();

  router.get("/api/ads/roas", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const datePreset = typeof req.query.date_preset === "string"
        ? req.query.date_preset.trim()
        : ADS_DEFAULT_DATE_PRESET;
      const range = resolveDatePresetRange(datePreset);
      if (!range) {
        res.status(400).json({ ok: false, error: `지원하지 않는 date_preset: ${datePreset}` });
        return;
      }

      const siteAccount = findSiteAccountByAccountId(accountId);
      const [metaResult, adsetCampaigns, aliasCampaigns, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "campaign_name,campaign_id,impressions,clicks,spend",
          level: "campaign",
          datePreset,
          limit: "100",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
        }),
        fetchMetaAdsetCampaignMap(accountId),
        fetchManualVerifiedAliasMap(siteAccount?.site ?? null),
        loadLedgerOrders(),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const filteredOrders = filterOrdersByRange(filterOrdersForAccount(ledger.orders, accountId), range);
      const campaigns = buildCampaignRoasRows({
        metaRows: metaResult.data,
        orders: filteredOrders,
        ledgerAvailable: ledger.entries.length > 0,
        adsetCampaignMap: adsetCampaigns.map,
        campaignAliasMap: aliasCampaigns.map,
      });
      const totalSpend = round2(campaigns.reduce((sum, row) => sum + row.spend, 0));
      const totalAttributedRevenue = round2(campaigns.reduce((sum, row) => sum + row.attributedRevenue, 0));
      const totalOrders = campaigns.reduce((sum, row) => sum + row.orders, 0);

      res.json({
        ok: true,
        account_id: accountId,
        date_preset: datePreset,
        range,
        meta_reference: buildMetaReference(),
        adset_mapping_error: adsetCampaigns.error,
        alias_mapping_error: aliasCampaigns.error,
        campaigns,
        summary: {
          spend: totalSpend,
          attributedRevenue: totalAttributedRevenue,
          roas: computeRoas(totalAttributedRevenue, totalSpend, ledger.entries.length > 0),
          orders: totalOrders,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "ads roas failed",
      });
    }
  });

  router.get("/api/ads/campaign-ltv-roas", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const datePreset = typeof req.query.date_preset === "string"
        ? req.query.date_preset.trim()
        : ADS_DEFAULT_DATE_PRESET;
      const range = resolveDatePresetRange(datePreset);
      if (!range) {
        res.status(400).json({ ok: false, error: `지원하지 않는 date_preset: ${datePreset}` });
        return;
      }
      const ltvWindowDays = Math.min(
        365,
        Math.max(30, Number.parseInt(typeof req.query.ltv_window_days === "string" ? req.query.ltv_window_days : "180", 10) || 180),
      );

      const siteAccount = findSiteAccountByAccountId(accountId);
      const [metaResult, adsetCampaigns, aliasCampaigns, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "campaign_name,campaign_id,impressions,clicks,spend",
          level: "campaign",
          datePreset,
          limit: "100",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
        }),
        fetchMetaAdsetCampaignMap(accountId),
        fetchManualVerifiedAliasMap(siteAccount?.site ?? null),
        loadLedgerOrders(),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const filteredOrders = filterOrdersByRange(filterOrdersForAccount(ledger.orders, accountId), range);
      const campaigns = aggregateMetaCampaigns(metaResult.data);
      const campaignRoasRows = buildCampaignRoasRows({
        metaRows: metaResult.data,
        orders: filteredOrders,
        ledgerAvailable: ledger.entries.length > 0,
        adsetCampaignMap: adsetCampaigns.map,
        campaignAliasMap: aliasCampaigns.map,
      });
      const rows = await buildCampaignLtvRoasRows({
        campaignRows: campaignRoasRows,
        campaigns,
        orders: filteredOrders,
        range,
        adsetCampaignMap: adsetCampaigns.map,
        campaignAliasMap: aliasCampaigns.map,
        ltvWindowDays,
      });

      const mappedRows = rows.filter((row) => row.campaignId);
      res.json({
        ok: true,
        account_id: accountId,
        date_preset: datePreset,
        range,
        ltv_window_days: ltvWindowDays,
        ltv_definition: "campaign에 귀속된 confirmed 주문 고객을 order_number/customer_number로 조인하고, anchor date 이후 LTV window 안의 전체 후속 주문 매출을 포함한다.",
        adset_mapping_error: adsetCampaigns.error,
        alias_mapping_error: aliasCampaigns.error,
        rows,
        summary: {
          spend: round2(mappedRows.reduce((sum, row) => sum + row.spend, 0)),
          attributedRevenue: round2(mappedRows.reduce((sum, row) => sum + row.attributedRevenue, 0)),
          ltvRevenue: round2(mappedRows.reduce((sum, row) => sum + row.ltvRevenue, 0)),
          repeatRevenue: round2(mappedRows.reduce((sum, row) => sum + row.repeatRevenue, 0)),
          supplementRevenue: round2(mappedRows.reduce((sum, row) => sum + row.supplementRevenue, 0)),
          ltvRoas: computeRoas(
            mappedRows.reduce((sum, row) => sum + row.ltvRevenue, 0),
            mappedRows.reduce((sum, row) => sum + row.spend, 0),
            ledger.entries.length > 0,
          ),
          readyCampaigns: mappedRows.filter((row) => row.ltvStatus === "ready").length,
          blockedCampaigns: mappedRows.filter((row) => row.ltvStatus === "blocked" || row.ltvStatus === "identity_missing").length,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "campaign ltv roas failed",
      });
    }
  });

  router.get("/api/ads/roas/daily", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const { range, datePreset } = resolveOptionalRange(req);
      const attributionWindow = parseMetaAttributionWindow(req.query.attribution_window);
      const [metaResult, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "spend,action_values",
          datePreset: datePreset ?? undefined,
          range: datePreset ? undefined : range,
          timeIncrement: "1",
          limit: "400",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: attributionWindow
            ? false
            : META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
          actionAttributionWindows: attributionWindow ? [attributionWindow] : undefined,
        }),
        loadLedgerOrders(),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const rows = buildDailyRoasRows({
        range,
        metaRows: metaResult.data,
        orders: filterOrdersByDateRange(filterOrdersForAccount(ledger.orders, accountId), range),
        ledgerAvailable: ledger.entries.length > 0,
        attributionWindow,
      });
      const totalSpend = round2(rows.reduce((sum, row) => sum + row.spend, 0));
      const totalRevenue = round2(rows.reduce((sum, row) => sum + row.revenue, 0));

      res.json({
        ok: true,
        account_id: accountId,
        date_preset: datePreset,
        start_date: range.startDate,
        end_date: range.endDate,
        meta_reference: buildMetaReference(attributionWindow ? {
          mode: "custom_window_override",
          requestedAttributionWindow: attributionWindow,
          appliedAttributionWindows: [attributionWindow],
        } : undefined),
        rows,
        summary: {
          spend: totalSpend,
          revenue: totalRevenue,
          confirmedRevenue: totalRevenue,
          pendingRevenue: round2(rows.reduce((sum, row) => sum + row.pendingRevenue, 0)),
          potentialRevenue: round2(rows.reduce((sum, row) => sum + row.potentialRevenue, 0)),
          metaPurchaseValue: round2(rows.reduce((sum, row) => sum + row.metaPurchaseValue, 0)),
          roas: computeRoas(totalRevenue, totalSpend, ledger.entries.length > 0),
          confirmedRoas: computeRoas(totalRevenue, totalSpend, ledger.entries.length > 0),
          potentialRoas: computeRoas(
            round2(rows.reduce((sum, row) => sum + row.potentialRevenue, 0)),
            totalSpend,
            ledger.entries.length > 0,
          ),
          metaPurchaseRoas: computeObservedRoas(
            round2(rows.reduce((sum, row) => sum + row.metaPurchaseValue, 0)),
            totalSpend,
          ),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "daily roas failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("start_date") || message.includes("attribution_window") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/channel-comparison", async (req: Request, res: Response) => {
    try {
      const range = resolveExplicitRange(req);
      const [siteResults, ledger] = await Promise.all([
        Promise.all(SITE_ACCOUNTS.map((site) => fetchSiteMetaSummary({
          site: site.site,
          accountId: site.accountId,
          range,
          datePreset: null,
        }))),
        loadLedgerOrders(),
      ]);

      const filteredOrders = filterOrdersByRange(ledger.orders, range);
      const metaOrders = filteredOrders.filter(isMetaAttributedOrder);
      const googleOrders = filteredOrders.filter(isGoogleAttributedOrder);
      const daangnOrders = filteredOrders.filter(isDaangnAttributedOrder);
      const metaTotals = siteResults.reduce<MetaTotals>((sum, site) => ({
        impressions: sum.impressions + site.impressions,
        clicks: sum.clicks + site.clicks,
        spend: sum.spend + site.spend,
        cpc: 0,
        cpm: 0,
        landingPageViews: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
      }), {
        impressions: 0,
        clicks: 0,
        spend: 0,
        cpc: 0,
        cpm: 0,
        landingPageViews: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
      });

      const channels: ChannelComparisonRow[] = [
        {
          channel: "meta",
          spend: round2(metaTotals.spend),
          impressions: metaTotals.impressions,
          clicks: metaTotals.clicks,
          revenue: sumRevenue(metaOrders),
          roas: computeRoas(sumRevenue(metaOrders), metaTotals.spend, ledger.entries.length > 0),
          placeholder: false,
          dataSource: "meta_insights + attribution_ledger",
        },
        {
          channel: "google",
          spend: 0,
          impressions: 0,
          clicks: 0,
          revenue: sumRevenue(googleOrders),
          roas: null,
          placeholder: true,
          dataSource: "attribution_ledger placeholder (GA4/Ads spend 미연동)",
        },
        {
          channel: "daangn",
          spend: 0,
          impressions: 0,
          clicks: 0,
          revenue: sumRevenue(daangnOrders),
          roas: null,
          placeholder: true,
          dataSource: "attribution_ledger placeholder (수동 입력 테이블 미구현)",
        },
      ];

      res.json({
        ok: true,
        start_date: range.startDate,
        end_date: range.endDate,
        channels,
        metaErrors: siteResults
          .filter((site) => site.metaError)
          .map((site) => ({ site: site.site, account_id: site.accountId, error: site.metaError })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "channel comparison failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("start_date") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/site-summary", async (req: Request, res: Response) => {
    try {
      const { range, datePreset } = resolveOptionalRange(req);
      const attributionWindow = parseMetaAttributionWindow(req.query.attribution_window);
      const [siteResults, ledger] = await Promise.all([
        Promise.all(SITE_ACCOUNTS.map((site) => fetchSiteMetaSummary({
          site: site.site,
          accountId: site.accountId,
          range,
          datePreset,
          attributionWindow,
        }))),
        loadLedgerOrders(),
      ]);

      const filteredOrders = filterOrdersByRange(ledger.orders, range).filter(isMetaAttributedOrder);
      const datedOrders = filterOrdersByDateRange(ledger.orders, range);
      const sites = siteResults.map((site) => {
        const siteOrders = filteredOrders.filter((order) => order.site === site.site);
        const sitePendingOrders = datedOrders.filter((order) =>
          order.site === site.site && isMetaAttributedOrder(order) && order.paymentStatus === "pending");
        const siteAllConfirmedOrders = datedOrders.filter((order) =>
          order.site === site.site && order.paymentStatus === "confirmed");
        const revenue = sumRevenue(siteOrders);
        const pendingRevenue = sumRevenue(sitePendingOrders);
        const potentialRevenue = round2(revenue + pendingRevenue);
        const siteConfirmedRevenue = sumRevenue(siteAllConfirmedOrders);
        return {
          site: site.site,
          account_id: site.accountId,
          impressions: site.impressions,
          clicks: site.clicks,
          spend: round2(site.spend),
          cpc: site.cpc,
          cpm: site.cpm,
          landing_page_views: site.landingPageViews,
          leads: site.leads,
          purchases: site.purchases,
          purchase_value: round2(site.purchaseValue),
          revenue,
          roas: computeRoas(revenue, site.spend, ledger.entries.length > 0),
          orders: siteOrders.length,
          confirmedRevenue: revenue,
          confirmedOrders: siteOrders.length,
          pendingRevenue,
          pendingOrders: sitePendingOrders.length,
          potentialRevenue,
          potentialRoas: computeRoas(potentialRevenue, site.spend, ledger.entries.length > 0),
          metaPurchaseValue: round2(site.purchaseValue),
          metaPurchaseRoas: computeObservedRoas(round2(site.purchaseValue), site.spend),
          siteConfirmedRevenue,
          siteConfirmedOrders: siteAllConfirmedOrders.length,
          bestCaseCeilingRoas: computeRoas(siteConfirmedRevenue, site.spend, ledger.entries.length > 0),
          metaError: site.metaError,
        };
      });

      const totalSpend = round2(sites.reduce((sum, site) => sum + site.spend, 0));
      const totalRevenue = round2(sites.reduce((sum, site) => sum + site.revenue, 0));
      const totalPendingRevenue = round2(sites.reduce((sum, site) => sum + site.pendingRevenue, 0));
      const totalPotentialRevenue = round2(sites.reduce((sum, site) => sum + site.potentialRevenue, 0));
      const totalMetaPurchaseValue = round2(sites.reduce((sum, site) => sum + site.metaPurchaseValue, 0));

      res.json({
        ok: true,
        date_preset: datePreset,
        start_date: range.startDate,
        end_date: range.endDate,
        meta_reference: buildMetaReference(attributionWindow ? {
          mode: "custom_window_override",
          requestedAttributionWindow: attributionWindow,
          appliedAttributionWindows: [attributionWindow],
        } : undefined),
        sites,
        total: {
          impressions: sites.reduce((sum, site) => sum + site.impressions, 0),
          clicks: sites.reduce((sum, site) => sum + site.clicks, 0),
          spend: totalSpend,
          revenue: totalRevenue,
          roas: computeRoas(totalRevenue, totalSpend, ledger.entries.length > 0),
          confirmedRevenue: totalRevenue,
          pendingRevenue: totalPendingRevenue,
          potentialRevenue: totalPotentialRevenue,
          metaPurchaseValue: totalMetaPurchaseValue,
          confirmedRoas: computeRoas(totalRevenue, totalSpend, ledger.entries.length > 0),
          potentialRoas: computeRoas(totalPotentialRevenue, totalSpend, ledger.entries.length > 0),
          metaPurchaseRoas: computeObservedRoas(totalMetaPurchaseValue, totalSpend),
          orders: sites.reduce((sum, site) => sum + site.orders, 0),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "site summary failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("date_preset") || message.includes("attribution_window") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/campaign-alias-review", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" ? req.query.site.trim() : "biocom";
      const review = await loadAliasReviewItems(site);
      res.json({
        ok: true,
        site: review.site,
        generated_at: review.generatedAt,
        summary: review.summary,
        items: review.items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign alias review failed";
      const status = message.includes("지원하지 않는 site") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.post("/api/ads/campaign-alias-review/decision", express.json(), async (req: Request, res: Response) => {
    try {
      const site = typeof req.body?.site === "string" ? req.body.site.trim() : "";
      const aliasKey = typeof req.body?.aliasKey === "string" ? req.body.aliasKey.trim() : "";
      const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId.trim() : "";
      const decision = typeof req.body?.decision === "string"
        ? req.body.decision.trim().toLowerCase()
        : "";

      if (!site || !aliasKey || !campaignId) {
        res.status(400).json({ ok: false, error: "site, aliasKey, campaignId 필요" });
        return;
      }
      if (decision !== "yes" && decision !== "no") {
        res.status(400).json({ ok: false, error: "decision 은 yes 또는 no 이어야 함" });
        return;
      }

      const item = await applyAliasReviewDecision({
        site,
        aliasKey,
        campaignId,
        decision: decision as AliasReviewDecision,
      });
      res.json({
        ok: true,
        item,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign alias review decision failed";
      const status = message.includes("need")
        || message.includes("지원하지 않는 site")
        || message.includes("not found")
        ? 400
        : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/iroas/experiments", async (_req: Request, res: Response) => {
    try {
      const experiments = await loadExperimentIroasSnapshots();
      res.json({
        ok: true,
        experiments: experiments.map((experiment) => ({
          experiment_key: experiment.experiment_key,
          name: experiment.name,
          status: experiment.status,
          channel: experiment.channel,
          treatment_revenue: experiment.treatment_revenue,
          control_revenue: experiment.control_revenue,
          incremental_revenue: experiment.incremental_revenue,
          ad_spend: experiment.ad_spend,
          iroas: experiment.iroas,
          treatment_count: experiment.treatment_count,
          control_count: experiment.control_count,
          treatment_purchase_rate: experiment.treatment_purchase_rate,
          control_purchase_rate: experiment.control_purchase_rate,
        })),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas experiments failed",
      });
    }
  });

  router.get("/api/ads/iroas/experiments/:key", async (req: Request, res: Response) => {
    try {
      const experiment = listExperiments().find((item) => item.experiment_key === req.params.key);
      if (!experiment) {
        res.status(404).json({ ok: false, error: "experiment not found" });
        return;
      }

      const loadMetaSpend = createMetaSpendLoader();
      const snapshot = await buildExperimentIroasSnapshot(experiment, loadMetaSpend);

      res.json({
        ok: true,
        experiment: {
          experiment_key: snapshot.experiment_key,
          name: snapshot.name,
          status: snapshot.status,
          channel: snapshot.channel,
          start_date: snapshot.start_date,
          end_date: snapshot.end_date,
          site_scope: snapshot.site_scope,
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          ad_spend: snapshot.ad_spend,
          roas: snapshot.roas,
          iroas: snapshot.iroas,
          treatment_count: snapshot.treatment_count,
          control_count: snapshot.control_count,
          treatment_purchase_rate: snapshot.treatment_purchase_rate,
          control_purchase_rate: snapshot.control_purchase_rate,
          treatment_purchaser_count: snapshot.treatment_purchaser_count,
          control_purchaser_count: snapshot.control_purchaser_count,
          treatment_purchase_count: snapshot.treatment_purchase_count,
          control_purchase_count: snapshot.control_purchase_count,
        },
        variants: snapshot.variants.map((variant) => ({
          variant_key: variant.variant_key,
          group: variant.group,
          assignment_count: variant.assignment_count,
          purchaser_count: variant.purchaser_count,
          purchase_count: variant.purchase_count,
          purchase_rate: variant.purchase_rate,
          revenue_amount: variant.revenue_amount,
          refund_amount: variant.refund_amount,
          net_revenue: variant.net_revenue,
        })),
        calculation: {
          formula: "iROAS = (treatment_revenue - control_revenue) / ad_spend",
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          ad_spend: snapshot.ad_spend,
          iroas: snapshot.iroas,
          comparable_groups: snapshot.treatment_count > 0 && snapshot.control_count > 0,
        },
        meta_errors: snapshot.meta_errors,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas experiment detail failed",
      });
    }
  });

  router.get("/api/ads/iroas/channel-comparison", async (_req: Request, res: Response) => {
    try {
      const snapshots = await loadExperimentIroasSnapshots();
      const grouped = new Map<string, {
        channel: string;
        ad_spend: number;
        incremental_revenue: number;
        treatment_revenue: number;
        experiments: number;
      }>();

      for (const snapshot of snapshots) {
        const key = snapshot.channel.trim().toLowerCase() || "unknown";
        const existing = grouped.get(key) ?? {
          channel: snapshot.channel,
          ad_spend: 0,
          incremental_revenue: 0,
          treatment_revenue: 0,
          experiments: 0,
        };
        existing.ad_spend += snapshot.ad_spend;
        existing.incremental_revenue += snapshot.incremental_revenue;
        existing.treatment_revenue += snapshot.treatment_revenue;
        existing.experiments += 1;
        grouped.set(key, existing);
      }

      res.json({
        ok: true,
        channels: [...grouped.values()]
          .map((channel) => ({
            channel: channel.channel,
            ad_spend: round2(channel.ad_spend),
            incremental_revenue: round2(channel.incremental_revenue),
            iroas: computeSpendRatio(
              channel.incremental_revenue,
              channel.ad_spend,
              channel.experiments > 0,
            ),
            roas: computeSpendRatio(
              channel.treatment_revenue,
              channel.ad_spend,
              channel.experiments > 0,
            ),
            experiments: channel.experiments,
          }))
          .sort((a, b) => {
            const aScore = a.iroas ?? Number.NEGATIVE_INFINITY;
            const bScore = b.iroas ?? Number.NEGATIVE_INFINITY;
            return bScore - aScore || b.incremental_revenue - a.incremental_revenue;
          }),
        meta_errors: dedupeMetaErrors(snapshots.flatMap((snapshot) => snapshot.meta_errors)),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas channel comparison failed",
      });
    }
  });

  router.get("/api/ads/iroas/trend", async (_req: Request, res: Response) => {
    try {
      const snapshots = await loadExperimentIroasSnapshots();
      const cycles = [...snapshots]
        .sort((a, b) => (
          (a.start_date ?? "").localeCompare(b.start_date ?? "")
          || a.experiment_key.localeCompare(b.experiment_key)
        ))
        .map((snapshot, index) => ({
          cycle: index + 1,
          experiment_key: snapshot.experiment_key,
          name: snapshot.name,
          status: snapshot.status,
          channel: snapshot.channel,
          start_date: snapshot.start_date,
          end_date: snapshot.end_date,
          ad_spend: snapshot.ad_spend,
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          roas: snapshot.roas,
          iroas: snapshot.iroas,
        }));

      res.json({
        ok: true,
        cycles,
        meta_errors: dedupeMetaErrors(snapshots.flatMap((snapshot) => snapshot.meta_errors)),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas trend failed",
      });
    }
  });

  return router;
};
