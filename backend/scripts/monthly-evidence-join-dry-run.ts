import { getPgPool, queryPg } from "../src/postgres";
import { env } from "../src/env";
import { buildNpayRoasDryRunReport, type NpayRoasDryRunOrderResult, type NpayRoasDryRunReport } from "../src/npayRoasDryRun";
import { buildTikTokRoasComparison } from "../src/tiktokRoasComparison";
import { google } from "googleapis";

type Options = {
  site: "biocom";
  month: string;
  json: boolean;
  npayIntentDbPath?: string;
};

type SpineRow = {
  order_number: string;
  channel_order_no: string | null;
  payment_key: string | null;
  order_id: string | null;
  order_id_base: string | null;
  payment_method: string;
  payment_status: string;
  gross_revenue: string | number;
  net_revenue: string | number;
  join_method: string;
  join_confidence: string;
};

type LedgerItem = {
  touchpoint?: string;
  captureMode?: string;
  paymentStatus?: string | null;
  loggedAt?: string;
  orderId?: string;
  paymentKey?: string;
  checkoutId?: string;
  landing?: string;
  referrer?: string;
  gaSessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  metadata?: Record<string, unknown>;
};

type Assignment = {
  orderNumber: string;
  netRevenue: number;
  joinMethod: string;
  primaryChannel: string;
  assistChannels: string[];
  evidenceConfidence: "A" | "B" | "C" | "D";
  evidenceTier: string;
  unknownReason: string;
  matchedBy: string[];
  npayIntentStatus?: string;
};

type ChannelSummaryRow = {
  primaryChannel: string;
  orders: number;
  revenue: number;
  confidence: Record<string, number>;
};

type PlatformReferenceRow = {
  platform: "meta" | "tiktok" | "google" | "naver";
  internalChannel: string;
  internalConfirmed: {
    orders: number;
    revenue: number;
    confidenceRevenue: Record<string, number>;
  };
  platformReference: {
    status: "joined" | "not_joined" | "unavailable";
    source: string;
    spendKrw: number | null;
    conversionValueKrw: number | null;
    roas: number | null;
    attributionWindow: string | null;
    actionReportTime: string | null;
    queriedAt: string | null;
    freshness: "fresh" | "local_cache" | "not_queried" | "blocked" | "error";
    error: string | null;
    sourceWindow: {
      startDate: string | null;
      endDate: string | null;
      latestDate: string | null;
    };
    sourceDiagnostics: Record<string, unknown> | null;
  };
  gap: {
    conversionValueMinusInternalRevenue: number | null;
    roasDelta: number | null;
    reason: string;
  };
  allowedUse: "platform_reference_only";
  forbiddenUse: "do_not_add_to_internal_confirmed_revenue";
};

const CONTRACT_VERSION = "monthly-evidence-join-dry-run-v0.4";
const ATTRIBUTION_BASE_URL = process.env.ATTRIBUTION_OPERATIONAL_BASE_URL || "https://att.ainativeos.net";

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const parseArgs = (): Options => {
  const site = argValue("site") || "biocom";
  const month = argValue("month") || "2026-04";

  if (site !== "biocom") throw new Error("Only --site=biocom is supported in v0.1");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("--month must be YYYY-MM");

  return {
    site,
    month,
    json: process.argv.includes("--json"),
    npayIntentDbPath: argValue("npay-intent-db"),
  };
};

const monthRange = (month: string) => {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const startKstAsUtc = new Date(Date.UTC(year, monthIndex, 0, 15, 0, 0));
  const endKstAsUtc = new Date(Date.UTC(year, monthIndex + 1, 0, 15, 0, 0));
  const fmtDate = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  return {
    startDate: `${yearRaw}-${monthRaw}-01`,
    endDateExclusive: fmtDate(new Date(Date.UTC(year, monthIndex + 1, 1))),
    startAtUtc: startKstAsUtc.toISOString(),
    endAtUtc: endKstAsUtc.toISOString(),
  };
};

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const krw = (value: string | number | null | undefined) => `${toNumber(value).toLocaleString("ko-KR")}원`;

const round2 = (value: number) => Math.round(value * 100) / 100;
const roas = (value: number | null, spend: number | null) =>
  value != null && spend != null && spend > 0 ? round2(value / spend) : null;

const previousDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
};

const normalizeOrderIdBase = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/(?:-|_)(?:p|pay)\d+$/i, "") : "";

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const includesAny = (value: string, tokens: string[]) => {
  const lower = value.toLowerCase();
  return tokens.some((token) => lower.includes(token));
};

const evidenceText = (entry: LedgerItem) => [
  entry.landing,
  entry.referrer,
  entry.utmSource,
  entry.utmMedium,
  entry.utmCampaign,
  entry.utmTerm,
  entry.utmContent,
].map((value) => readString(value).toLowerCase()).join(" ");

const getFirstTouch = (entry: LedgerItem) => objectValue(entry.metadata?.firstTouch);
const getFirstTouchMatch = (entry: LedgerItem) => objectValue(entry.metadata?.firstTouchMatch);

const safeUrlParam = (key: string, ...values: unknown[]) => {
  for (const value of values) {
    const raw = readString(value);
    if (!raw) continue;
    try {
      const parsed = new URL(raw, "https://biocom.kr");
      const found = parsed.searchParams.get(key)?.trim();
      if (found) return found;
    } catch {
      // Ignore malformed URL evidence and continue with other fields.
    }
  }
  return "";
};

const paidMedium = (value: unknown) =>
  /^(cpc|ppc|paid|paid_social|social_paid|display|shopping|performance|max)$/i.test(readString(value));

const sourceIs = (value: unknown, tokens: string[]) => {
  const source = readString(value).toLowerCase();
  return tokens.some((token) => source.includes(token));
};

const classifyEvidence = (entry: LedgerItem | undefined): {
  channel: string;
  tier: string;
  confidence: Assignment["evidenceConfidence"];
  assistChannels: string[];
  reason: string;
} => {
  if (!entry) {
    return {
      channel: "unknown",
      tier: "no_vm_payment_success",
      confidence: "C",
      assistChannels: [],
      reason: "vm_payment_success_missing",
    };
  }

  const firstTouch = getFirstTouch(entry);
  const firstTouchMatch = getFirstTouchMatch(entry);
  const directText = evidenceText(entry);
  const firstTouchText = [
    firstTouch.landing,
    firstTouch.referrer,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  ].map((value) => readString(value).toLowerCase()).join(" ");

  type EvidenceCandidate = {
    channel: string;
    tier: string;
    confidence: Assignment["evidenceConfidence"];
    strength: number;
  };
  const candidates = new Map<string, EvidenceCandidate>();
  const add = (candidate: EvidenceCandidate) => {
    const current = candidates.get(candidate.channel);
    if (!current || candidate.strength > current.strength) candidates.set(candidate.channel, candidate);
  };

  const directFbclid = readString(entry.fbclid) || safeUrlParam("fbclid", entry.landing, entry.referrer);
  const firstFbclid =
    readString(firstTouch.fbclid) || safeUrlParam("fbclid", firstTouch.landing, firstTouch.referrer);
  const directFbc = readString(entry.metadata?.fbc);
  const firstFbc = readString(firstTouch.fbc);
  const directTtclid = readString(entry.ttclid) || safeUrlParam("ttclid", entry.landing, entry.referrer);
  const firstTtclid =
    readString(firstTouch.ttclid) || safeUrlParam("ttclid", firstTouch.landing, firstTouch.referrer);
  const directGclid =
    readString(entry.gclid) ||
    safeUrlParam("gclid", entry.landing, entry.referrer) ||
    safeUrlParam("gbraid", entry.landing, entry.referrer) ||
    safeUrlParam("wbraid", entry.landing, entry.referrer);
  const firstGclid =
    readString(firstTouch.gclid) ||
    safeUrlParam("gclid", firstTouch.landing, firstTouch.referrer) ||
    safeUrlParam("gbraid", firstTouch.landing, firstTouch.referrer) ||
    safeUrlParam("wbraid", firstTouch.landing, firstTouch.referrer);
  const directNapm = safeUrlParam("NaPm", entry.landing, entry.referrer);
  const firstNapm = safeUrlParam("NaPm", firstTouch.landing, firstTouch.referrer);
  const firstTouchStrong = Array.isArray(firstTouchMatch.matchedBy)
    ? firstTouchMatch.matchedBy.some((key) => ["checkout_id", "ga_session_id", "client_id", "user_pseudo_id"].includes(readString(key)))
    : Object.keys(firstTouch).length > 0;

  if (directGclid) add({ channel: "paid_google", tier: "paid_google_order_click_id", confidence: "A", strength: 100 });
  if (directTtclid) add({ channel: "paid_tiktok", tier: "paid_tiktok_order_click_id", confidence: "A", strength: 100 });
  if (directFbclid || directFbc) add({ channel: "paid_meta", tier: "paid_meta_order_click_id", confidence: "A", strength: 100 });
  if (directNapm) add({ channel: "paid_naver", tier: "paid_naver_order_click_id", confidence: "A", strength: 100 });

  if (firstGclid) add({ channel: "paid_google", tier: "paid_google_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (firstTtclid) add({ channel: "paid_tiktok", tier: "paid_tiktok_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (firstFbclid || firstFbc) add({ channel: "paid_meta", tier: "paid_meta_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (firstNapm) add({ channel: "paid_naver", tier: "paid_naver_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });

  if (paidMedium(entry.utmMedium) || paidMedium(firstTouch.utmMedium)) {
    if (sourceIs(entry.utmSource, ["google"]) || sourceIs(firstTouch.utmSource, ["google"])) {
      add({ channel: "paid_google", tier: "paid_google_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["tiktok"]) || sourceIs(firstTouch.utmSource, ["tiktok"])) {
      add({ channel: "paid_tiktok", tier: "paid_tiktok_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["meta", "facebook", "instagram", "fb", "ig"]) || sourceIs(firstTouch.utmSource, ["meta", "facebook", "instagram", "fb", "ig"])) {
      add({ channel: "paid_meta", tier: "paid_meta_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["naver"]) || sourceIs(firstTouch.utmSource, ["naver"])) {
      add({ channel: "paid_naver", tier: "paid_naver_paid_utm", confidence: "B", strength: 65 });
    }
  }

  const ordered = Array.from(candidates.values()).sort((a, b) => b.strength - a.strength || a.channel.localeCompare(b.channel));

  if (ordered.length > 1) {
    const winner = ordered[0];
    return {
      channel: winner.channel,
      tier: `multiple_paid_evidence_${winner.tier}`,
      confidence: winner.confidence === "A" ? "B" : winner.confidence,
      assistChannels: ordered.slice(1).map((candidate) => candidate.channel),
      reason: "",
    };
  }

  if (ordered.length === 1) {
    const winner = ordered[0];
    const hasFirstTouch = Object.keys(firstTouch).length > 0;
    return {
      channel: winner.channel,
      tier: winner.tier,
      confidence: winner.confidence,
      assistChannels: [],
      reason: "",
    };
  }

  const hasSearchReferrer = includesAny(`${directText} ${firstTouchText}`, ["search.naver.com", "google.com/search", "bing.com"]);

  if (hasSearchReferrer) {
    return {
      channel: "organic_search",
      tier: "organic_referrer",
      confidence: "C",
      assistChannels: [],
      reason: "",
    };
  }

  if (includesAny(`${directText} ${firstTouchText}`, ["link.inpock.co.kr"])) {
    return {
      channel: "influencer_non_paid",
      tier: "influencer_referrer",
      confidence: "C",
      assistChannels: [],
      reason: "",
    };
  }

  return {
    channel: "unknown",
    tier: "no_paid_or_referrer_evidence",
    confidence: "C",
    assistChannels: [],
    reason: "missing_channel_evidence",
  };
};

const fetchVmLedger = async (source: string, startAt: string, endAt: string) => {
  const url = new URL("/api/attribution/ledger", ATTRIBUTION_BASE_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("startAt", startAt);
  url.searchParams.set("endAt", endAt);
  url.searchParams.set("limit", "10000");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Attribution VM request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json() as { summary?: unknown; items?: LedgerItem[]; filters?: unknown };
};

const getSpineRows = async (site: string, startDate: string, endDateExclusive: string) => {
  const result = await queryPg<SpineRow>(
    `
    WITH
      imweb AS (
        SELECT
          order_number,
          MAX(COALESCE(final_order_amount, 0)) AS imweb_amount,
          MAX(COALESCE(total_refunded_price, 0)) AS imweb_refund,
          MAX(payment_method) AS payment_method,
          MAX(payment_status) AS payment_status,
          MAX(raw_data->>'channelOrderNo') AS channel_order_no
        FROM public.tb_iamweb_users
        WHERE order_date::timestamp >= $1::timestamp
          AND order_date::timestamp < $2::timestamp
        GROUP BY order_number
      ),
      toss AS (
        SELECT
          payment_key,
          order_id,
          regexp_replace(order_id, '(-|_)(p|pay)[0-9]+$', '', 'i') AS order_id_base,
          MAX(COALESCE(total_amount, 0)) AS toss_amount,
          MAX(COALESCE(balance_amount, 0)) AS toss_balance,
          MAX(COALESCE(cancel_amount, 0)) AS toss_cancel,
          MAX(status) AS toss_status
        FROM public.tb_sales_toss
        WHERE store = $3
          AND approved_at::timestamp >= $1::timestamp
          AND approved_at::timestamp < $2::timestamp
        GROUP BY payment_key, order_id
      ),
      spine AS (
        SELECT
          i.order_number,
          i.channel_order_no,
          t.payment_key,
          t.order_id,
          t.order_id_base,
          i.payment_method,
          i.payment_status,
          i.imweb_amount AS gross_revenue,
          CASE
            WHEN t.payment_key IS NOT NULL THEN t.toss_balance
            WHEN i.payment_method IN ('NAVERPAY_ORDER', 'SUBSCRIPTION')
              AND i.payment_status = 'PAYMENT_COMPLETE' THEN i.imweb_amount
            ELSE 0
          END AS net_revenue,
          CASE
            WHEN t.payment_key IS NOT NULL THEN 'toss_order_id_base'
            WHEN i.payment_method = 'NAVERPAY_ORDER' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_npay_confirmed'
            WHEN i.payment_method = 'SUBSCRIPTION' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_subscription_confirmed'
            WHEN i.payment_method = 'VIRTUAL' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_virtual_without_toss'
            WHEN i.imweb_amount = 0 THEN 'zero_amount_non_revenue'
            ELSE 'quarantine_unmatched_revenue'
          END AS join_method,
          CASE
            WHEN t.payment_key IS NOT NULL THEN 'A'
            WHEN i.payment_method IN ('NAVERPAY_ORDER', 'SUBSCRIPTION') AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'B'
            WHEN i.payment_method = 'VIRTUAL' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'C'
            WHEN i.imweb_amount = 0 THEN 'A'
            ELSE 'D'
          END AS join_confidence
        FROM imweb i
        LEFT JOIN toss t ON t.order_id_base = i.order_number
      )
    SELECT *
    FROM spine
    WHERE join_confidence IN ('A', 'B')
      AND net_revenue > 0
    ORDER BY order_number
    `,
    [startDate, endDateExclusive, site],
  );
  return result.rows;
};

const buildLedgerIndexes = (items: LedgerItem[]) => {
  const paymentEntries = items.filter((item) => item.touchpoint === "payment_success" && item.paymentStatus === "confirmed");
  const byPaymentKey = new Map<string, LedgerItem>();
  const byOrderId = new Map<string, LedgerItem>();

  for (const entry of paymentEntries) {
    if (entry.paymentKey && !byPaymentKey.has(entry.paymentKey)) byPaymentKey.set(entry.paymentKey, entry);
    for (const key of [
      normalizeOrderIdBase(entry.orderId),
      normalizeOrderIdBase(readString(entry.metadata?.orderIdBase)),
      normalizeOrderIdBase(readString(objectValue(entry.metadata?.referrerPayment).orderNo)),
      normalizeOrderIdBase(readString(objectValue(entry.metadata?.referrerPayment).orderId)),
    ].filter(Boolean)) {
      if (!byOrderId.has(key)) byOrderId.set(key, entry);
    }
  }

  return { byPaymentKey, byOrderId };
};

type NpayContext = {
  sourceAccess: "available" | "empty_or_unavailable" | "error";
  byOrderNumber: Map<string, NpayRoasDryRunOrderResult>;
};

const assignRow = (
  row: SpineRow,
  indexes: ReturnType<typeof buildLedgerIndexes>,
  npay: NpayContext,
): Assignment => {
  const matchedBy: string[] = [];
  let entry: LedgerItem | undefined;

  if (row.payment_key) {
    entry = indexes.byPaymentKey.get(row.payment_key);
    if (entry) matchedBy.push("payment_key");
  }

  const orderKey = row.order_id_base || row.order_number;
  if (!entry && orderKey) {
    entry = indexes.byOrderId.get(orderKey);
    if (entry) matchedBy.push("order_id_base");
  }

  if (row.join_method === "imweb_npay_confirmed") {
    const npayResult = npay.byOrderNumber.get(row.order_number);
    const base = {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "npay",
      assistChannels: [],
      unknownReason: "",
      matchedBy,
    };

    if (npay.sourceAccess !== "available") {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_intent_source_unavailable",
        npayIntentStatus: npay.sourceAccess,
      };
    }

    if (!npayResult) {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_not_in_match_report",
        npayIntentStatus: "not_in_match_report",
      };
    }

    if (npayResult.status === "strong_match" && npayResult.strongGrade === "A") {
      return {
        ...base,
        evidenceConfidence: "B",
        evidenceTier: "npay_confirmed_intent_strong_a",
        matchedBy: [...matchedBy, "npay_intent_strong_a"],
        npayIntentStatus: "strong_match_a",
      };
    }

    if (npayResult.status === "strong_match") {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_intent_strong_b",
        matchedBy: [...matchedBy, "npay_intent_strong_b"],
        npayIntentStatus: "strong_match_b",
      };
    }

    if (npayResult.status === "ambiguous") {
      return {
        ...base,
        evidenceConfidence: "D",
        evidenceTier: "npay_confirmed_intent_ambiguous",
        unknownReason: "npay_intent_ambiguous",
        npayIntentStatus: "ambiguous",
      };
    }

    return {
      ...base,
      evidenceConfidence: "C",
      evidenceTier: "npay_confirmed_without_intent",
      npayIntentStatus: "purchase_without_intent",
    };
  }

  const classified = classifyEvidence(entry);
  if (row.join_method === "imweb_subscription_confirmed" && classified.channel === "unknown") {
    return {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "unknown",
      assistChannels: [],
      evidenceConfidence: "C",
      evidenceTier: "subscription_without_acquisition_evidence",
      unknownReason: "subscription_without_acquisition_evidence",
      matchedBy,
    };
  }

  return {
    orderNumber: row.order_number,
    netRevenue: toNumber(row.net_revenue),
    joinMethod: row.join_method,
    primaryChannel: classified.channel,
    assistChannels: classified.assistChannels,
    evidenceConfidence: classified.confidence,
    evidenceTier: classified.tier,
    unknownReason: classified.reason,
    matchedBy,
  };
};

const summarizeAssignments = (assignments: Assignment[]) => {
  const byChannel = new Map<string, { orders: number; revenue: number; confidence: Record<string, number> }>();
  const unknownReasons = new Map<string, { orders: number; revenue: number }>();
  const evidenceTiers = new Map<string, { orders: number; revenue: number }>();
  const npayIntentStatuses = new Map<string, { orders: number; revenue: number }>();

  for (const assignment of assignments) {
    const channel = byChannel.get(assignment.primaryChannel) || { orders: 0, revenue: 0, confidence: {} };
    channel.orders += 1;
    channel.revenue += assignment.netRevenue;
    channel.confidence[assignment.evidenceConfidence] = (channel.confidence[assignment.evidenceConfidence] || 0) + assignment.netRevenue;
    byChannel.set(assignment.primaryChannel, channel);

    if (assignment.unknownReason) {
      const reason = unknownReasons.get(assignment.unknownReason) || { orders: 0, revenue: 0 };
      reason.orders += 1;
      reason.revenue += assignment.netRevenue;
      unknownReasons.set(assignment.unknownReason, reason);
    }

    const tier = evidenceTiers.get(assignment.evidenceTier) || { orders: 0, revenue: 0 };
    tier.orders += 1;
    tier.revenue += assignment.netRevenue;
    evidenceTiers.set(assignment.evidenceTier, tier);

    if (assignment.joinMethod === "imweb_npay_confirmed") {
      const statusKey = assignment.npayIntentStatus || assignment.evidenceTier;
      const npayStatus = npayIntentStatuses.get(statusKey) || { orders: 0, revenue: 0 };
      npayStatus.orders += 1;
      npayStatus.revenue += assignment.netRevenue;
      npayIntentStatuses.set(statusKey, npayStatus);
    }
  }

  return {
    byChannel: Array.from(byChannel.entries())
      .map(([primaryChannel, value]) => ({ primaryChannel, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    unknownReasons: Array.from(unknownReasons.entries())
      .map(([unknownReason, value]) => ({ unknownReason, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    evidenceTiers: Array.from(evidenceTiers.entries())
      .map(([evidenceTier, value]) => ({ evidenceTier, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    npayIntentStatuses: Array.from(npayIntentStatuses.entries())
      .map(([npayIntentStatus, value]) => ({ npayIntentStatus, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
  };
};

type PlatformFetchResult = {
  status: PlatformReferenceRow["platformReference"]["status"];
  source: string;
  spendKrw: number | null;
  conversionValueKrw: number | null;
  roas: number | null;
  attributionWindow: string | null;
  actionReportTime: string | null;
  queriedAt: string | null;
  freshness: PlatformReferenceRow["platformReference"]["freshness"];
  error: string | null;
  sourceWindow: {
    startDate: string | null;
    endDate: string | null;
    latestDate: string | null;
  };
  sourceDiagnostics: Record<string, unknown> | null;
};

const unavailablePlatformReference = (
  source: string,
  error: string,
  freshness: PlatformReferenceRow["platformReference"]["freshness"] = "blocked",
): PlatformFetchResult => ({
  status: "unavailable",
  source,
  spendKrw: null,
  conversionValueKrw: null,
  roas: null,
  attributionWindow: null,
  actionReportTime: null,
  queriedAt: new Date().toISOString(),
  freshness,
  error,
  sourceWindow: {
    startDate: null,
    endDate: null,
    latestDate: null,
  },
  sourceDiagnostics: null,
});

const joinedPlatformReference = (input: Omit<PlatformFetchResult, "status" | "error">): PlatformFetchResult => ({
  ...input,
  status: "joined",
  error: null,
});

const fetchMetaPlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  const token = env.META_ADMANAGER_API_KEY;
  const accountId = "act_3138805896402376";
  if (!token) {
    return unavailablePlatformReference("Meta Ads Insights API", "META_ADMANAGER_API_KEY is not configured");
  }

  const url = new URL(`https://graph.facebook.com/v22.0/${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "spend,actions,action_values");
  url.searchParams.set("time_range", JSON.stringify({ since: startDate, until: endDateInclusive }));
  url.searchParams.set("action_report_time", "conversion");
  url.searchParams.set("use_unified_attribution_setting", "true");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json() as {
    data?: Array<{
      spend?: string;
      actions?: Array<{ action_type?: string; value?: string }>;
      action_values?: Array<{ action_type?: string; value?: string }>;
    }>;
    error?: { message?: string };
  };

  if (!response.ok || body.error) {
    return unavailablePlatformReference(
      "Meta Ads Insights API",
      body.error?.message || `Meta API request failed: ${response.status}`,
      "error",
    );
  }

  const rows = body.data || [];
  const spend = rows.reduce((sum, row) => sum + toNumber(row.spend), 0);
  const conversionValue = rows.reduce((sum, row) => {
    const purchase = row.action_values?.find((action) =>
      action.action_type === "purchase" || action.action_type === "offsite_conversion.fb_pixel_purchase"
    );
    return sum + toNumber(purchase?.value);
  }, 0);

  return joinedPlatformReference({
    source: "Meta Ads Insights API",
    spendKrw: Math.round(spend),
    conversionValueKrw: Math.round(conversionValue),
    roas: roas(conversionValue, spend),
    attributionWindow: "use_unified_attribution_setting=true",
    actionReportTime: "conversion",
    queriedAt: new Date().toISOString(),
    freshness: "fresh",
    sourceWindow: {
      startDate,
      endDate: endDateInclusive,
      latestDate: endDateInclusive,
    },
    sourceDiagnostics: {
      accountId,
      rows: rows.length,
      currency: "KRW",
    },
  });
};

const fetchTikTokPlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  try {
    const report = await buildTikTokRoasComparison({
      startDate,
      endDate: endDateInclusive,
      autoIngest: false,
    });
    const summary = report.ads_report.summary;
    return joinedPlatformReference({
      source: report.ads_report.source,
      spendKrw: Math.round(summary.spend),
      conversionValueKrw: Math.round(summary.purchaseValue),
      roas: summary.platformRoas == null ? null : round2(summary.platformRoas),
      attributionWindow: `${report.attribution_window.click}_click/${report.attribution_window.view}_view`,
      actionReportTime: "TikTok export default",
      queriedAt: new Date().toISOString(),
      freshness: report.local_table.daily.readyForImport ? "local_cache" : "blocked",
      sourceWindow: {
        startDate,
        endDate: endDateInclusive,
        latestDate: report.local_table.daily.maxDate,
      },
      sourceDiagnostics: {
        dailyTable: report.local_table.daily,
        availableRanges: report.local_table.availableRanges,
        warnings: report.warnings,
        currency: summary.currency,
      },
    });
  } catch (error) {
    return unavailablePlatformReference(
      "TikTok Business API/local export",
      error instanceof Error ? error.message : "TikTok reference failed",
      "error",
    );
  }
};

const fetchGooglePlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const rawCredentials = env.GSC_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!developerToken) {
    return unavailablePlatformReference("Google Ads API", "GOOGLE_ADS_DEVELOPER_TOKEN is not configured");
  }
  if (!rawCredentials) {
    return unavailablePlatformReference("Google Ads API", "Google service account key is not configured");
  }

  try {
    const credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/adwords"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
    if (!token) {
      return unavailablePlatformReference("Google Ads API", "Failed to obtain Google Ads OAuth access token");
    }

    const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/\D/g, "");
    const query = `
      SELECT
        campaign.id,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDateInclusive}'
        AND metrics.cost_micros > 0
      LIMIT 10000
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": developerToken,
          ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
            ? { "login-customer-id": env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "") }
            : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      return unavailablePlatformReference("Google Ads API", text.slice(0, 500), "error");
    }

    const body = JSON.parse(text) as { results?: Array<{ metrics?: Record<string, unknown> }> };
    const rows = body.results || [];
    const spend = rows.reduce((sum, row) => sum + toNumber(row.metrics?.costMicros) / 1_000_000, 0);
    const conversionValue = rows.reduce((sum, row) => sum + toNumber(row.metrics?.conversionsValue), 0);

    return joinedPlatformReference({
      source: "Google Ads API",
      spendKrw: Math.round(spend),
      conversionValueKrw: Math.round(conversionValue),
      roas: roas(conversionValue, spend),
      attributionWindow: "Google Ads conversion action settings",
      actionReportTime: "segments.date by Google Ads reporting timezone",
      queriedAt: new Date().toISOString(),
      freshness: "fresh",
      sourceWindow: {
        startDate,
        endDate: endDateInclusive,
        latestDate: endDateInclusive,
      },
      sourceDiagnostics: {
        customerId,
        rows: rows.length,
        currency: "KRW",
      },
    });
  } catch (error) {
    return unavailablePlatformReference(
      "Google Ads API",
      error instanceof Error ? error.message : "Google Ads reference failed",
      "error",
    );
  }
};

const fetchNaverPlatformReference = async (): Promise<PlatformFetchResult> =>
  unavailablePlatformReference(
    "Naver Ads API/export",
    "Naver Ads spend/conversion reference source is not connected in this repo yet",
    "blocked",
  );

const buildPlatformReference = async (
  channelSummary: ChannelSummaryRow[],
  range: ReturnType<typeof monthRange>,
) => {
  const byChannel = new Map(channelSummary.map((row) => [row.primaryChannel, row]));
  const endDateInclusive = previousDate(range.endDateExclusive);
  const fetched = new Map<PlatformReferenceRow["platform"], PlatformFetchResult>();
  const results = await Promise.allSettled([
    fetchMetaPlatformReference(range.startDate, endDateInclusive),
    fetchTikTokPlatformReference(range.startDate, endDateInclusive),
    fetchGooglePlatformReference(range.startDate, endDateInclusive),
    fetchNaverPlatformReference(),
  ]);
  const platforms: PlatformReferenceRow["platform"][] = ["meta", "tiktok", "google", "naver"];
  results.forEach((result, index) => {
    const platform = platforms[index];
    fetched.set(
      platform,
      result.status === "fulfilled"
        ? result.value
        : unavailablePlatformReference(`${platform} platform reference`, String(result.reason), "error"),
    );
  });

  const specs: Array<{
    platform: PlatformReferenceRow["platform"];
    internalChannel: string;
    source: string;
  }> = [
    {
      platform: "meta",
      internalChannel: "paid_meta",
      source: "Meta Ads Insights API or exported Ads Manager report",
    },
    {
      platform: "tiktok",
      internalChannel: "paid_tiktok",
      source: "TikTok Business API or exported TikTok Ads report",
    },
    {
      platform: "google",
      internalChannel: "paid_google",
      source: "Google Ads API or exported Google Ads report",
    },
    {
      platform: "naver",
      internalChannel: "paid_naver",
      source: "Naver Ads API/export plus NPay intent/reference ledger when available",
    },
  ];

  const rows: PlatformReferenceRow[] = specs.map((spec) => {
    const internal = byChannel.get(spec.internalChannel);
    const reference = fetched.get(spec.platform) ?? unavailablePlatformReference(spec.source, "platform reference not fetched");
    const internalRevenue = internal?.revenue || 0;
    const internalRoas = roas(internalRevenue, reference.spendKrw);
    return {
      platform: spec.platform,
      internalChannel: spec.internalChannel,
      internalConfirmed: {
        orders: internal?.orders || 0,
        revenue: internalRevenue,
        confidenceRevenue: internal?.confidence || {},
      },
      platformReference: reference,
      gap: {
        conversionValueMinusInternalRevenue: reference.conversionValueKrw == null
          ? null
          : Math.round(reference.conversionValueKrw - internalRevenue),
        roasDelta: reference.roas != null && internalRoas != null ? round2(reference.roas - internalRoas) : null,
        reason: reference.status === "joined"
          ? "platform_value_minus_internal_confirmed_revenue"
          : "platform_api_reference_not_connected",
      },
      allowedUse: "platform_reference_only",
      forbiddenUse: "do_not_add_to_internal_confirmed_revenue",
    };
  });

  return {
    contractVersion: "platform-reference-v0.2",
    referenceOnly: true,
    noInternalRevenueMerge: true,
    joinStatus: rows.some((row) => row.platformReference.status === "joined") ? "partial_join" : "skeleton_only",
    reason: "Platform API values are intentionally kept as reference-only and never merged into internal confirmed revenue.",
    requiredMetadataWhenJoined: [
      "platform",
      "source",
      "queried_at",
      "timezone",
      "date_range",
      "attribution_window",
      "action_report_time",
      "currency",
      "rounding_rule",
    ],
    primaryJoinKeys: [
      "platform_campaign_id",
      "platform_adset_or_group_id",
      "platform_ad_id",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "click_id",
    ],
    rows,
  };
};

const run = async (options: Options) => {
  const range = monthRange(options.month);
  const rows = await getSpineRows(options.site, range.startDate, range.endDateExclusive);
  const vm = await fetchVmLedger(`${options.site}_imweb`, range.startAtUtc, range.endAtUtc);
  const indexes = buildLedgerIndexes(vm.items || []);
  let npayReport: NpayRoasDryRunReport | null = null;
  let npayReportError = "";

  try {
    npayReport = await buildNpayRoasDryRunReport({
      start: range.startAtUtc,
      end: range.endAtUtc,
      site: options.site,
      sqlitePath: options.npayIntentDbPath,
    });
  } catch (error) {
    npayReportError = error instanceof Error ? error.message : String(error);
  }

  const npaySourceAccess: NpayContext["sourceAccess"] = npayReport
    ? npayReport.summary.liveIntentCount > 0
      ? "available"
      : "empty_or_unavailable"
    : "error";
  const npayContext: NpayContext = {
    sourceAccess: npaySourceAccess,
    byOrderNumber: new Map(npayReport?.orderResults.map((result) => [result.order.orderNumber, result]) || []),
  };
  const assignments = rows.map((row) => assignRow(row, indexes, npayContext));
  const totalRevenue = assignments.reduce((sum, assignment) => sum + assignment.netRevenue, 0);
  const assignedRevenue = assignments
    .filter((assignment) => assignment.primaryChannel !== "unknown" && assignment.primaryChannel !== "quarantine")
    .reduce((sum, assignment) => sum + assignment.netRevenue, 0);
  const summary = summarizeAssignments(assignments);
  const platformReference = await buildPlatformReference(summary.byChannel, range);

  return {
    metadata: {
      contractVersion: CONTRACT_VERSION,
      site: options.site,
      month: options.month,
      timezone: "Asia/Seoul",
      dateStart: range.startDate,
      dateEndExclusive: range.endDateExclusive,
      attributionStartAt: range.startAtUtc,
      attributionEndAt: range.endAtUtc,
      queriedAt: new Date().toISOString(),
      dryRun: true,
      write: false,
      send: false,
    },
    source: {
      vmFilters: vm.filters,
      vmSummary: vm.summary,
      npayIntentMatching: npayReport
        ? {
            sourceAccess: npaySourceAccess,
            source: npayReport.source.intents,
            window: npayReport.window,
            summary: npayReport.summary,
          }
        : {
            sourceAccess: npaySourceAccess,
            error: npayReportError,
          },
    },
    totals: {
      ordersTotalAb: assignments.length,
      revenueTotalAb: totalRevenue,
      assignedOrders: assignments.filter((assignment) => assignment.primaryChannel !== "unknown").length,
      assignedRevenue,
      unknownOrders: assignments.filter((assignment) => assignment.primaryChannel === "unknown").length,
      unknownRevenue: assignments
        .filter((assignment) => assignment.primaryChannel === "unknown")
        .reduce((sum, assignment) => sum + assignment.netRevenue, 0),
      primarySumMatchesRevenue: summary.byChannel.reduce((sum, row) => sum + row.revenue, 0) === totalRevenue,
    },
    channelSummary: summary.byChannel,
    platformReference,
    unknownReasons: summary.unknownReasons,
    evidenceTierSummary: summary.evidenceTiers,
    npayIntentStatusSummary: summary.npayIntentStatuses,
    sampleRows: assignments.slice(0, 20),
  };
};

const printMarkdown = (payload: Awaited<ReturnType<typeof run>>) => {
  const { metadata, totals, channelSummary, platformReference, unknownReasons } = payload;
  console.log(`# monthly-evidence-join-dry-run ${metadata.site} ${metadata.month}`);
  console.log("");
  console.log(`- contract_version: ${metadata.contractVersion}`);
  console.log(`- timezone: ${metadata.timezone}`);
  console.log(`- window: ${metadata.dateStart} <= KST < ${metadata.dateEndExclusive}`);
  console.log(`- dry_run/write/send: ${metadata.dryRun}/${metadata.write}/${metadata.send}`);
  console.log("");
  console.log("## Totals");
  console.log("");
  console.log("| metric | value |");
  console.log("|---|---:|");
  console.log(`| orders_total_ab | ${totals.ordersTotalAb.toLocaleString("ko-KR")} |`);
  console.log(`| revenue_total_ab | ${krw(totals.revenueTotalAb)} |`);
  console.log(`| assigned_orders | ${totals.assignedOrders.toLocaleString("ko-KR")} |`);
  console.log(`| assigned_revenue | ${krw(totals.assignedRevenue)} |`);
  console.log(`| unknown_orders | ${totals.unknownOrders.toLocaleString("ko-KR")} |`);
  console.log(`| unknown_revenue | ${krw(totals.unknownRevenue)} |`);
  console.log(`| primary_sum_matches_revenue | ${totals.primarySumMatchesRevenue ? "YES" : "NO"} |`);
  console.log("");
  console.log("## Channel Summary");
  console.log("");
  console.log("| primary_channel | orders | revenue | confidence_revenue |");
  console.log("|---|---:|---:|---|");
  for (const row of channelSummary) {
    const confidenceRevenue = Object.entries(row.confidence)
      .map(([key, value]) => `${key}:${krw(value)}`)
      .join(", ");
    console.log(`| ${row.primaryChannel} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} | ${confidenceRevenue} |`);
  }
  console.log("");
  console.log("## Platform Reference Skeleton");
  console.log("");
  console.log(`- contract_version: ${platformReference.contractVersion}`);
  console.log(`- reference_only: ${platformReference.referenceOnly ? "YES" : "NO"}`);
  console.log(`- no_internal_revenue_merge: ${platformReference.noInternalRevenueMerge ? "YES" : "NO"}`);
  console.log(`- join_status: ${platformReference.joinStatus}`);
  console.log("");
  console.log("| platform | internal_channel | internal_orders | internal_revenue | platform_status |");
  console.log("|---|---|---:|---:|---|");
  for (const row of platformReference.rows) {
    console.log(
      `| ${row.platform} | ${row.internalChannel} | ${row.internalConfirmed.orders.toLocaleString("ko-KR")} | ${krw(row.internalConfirmed.revenue)} | ${row.platformReference.status} |`,
    );
  }
  console.log("");
  console.log("## Unknown Reasons");
  console.log("");
  console.log("| unknown_reason | orders | revenue |");
  console.log("|---|---:|---:|");
  for (const row of unknownReasons) {
    console.log(`| ${row.unknownReason} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} |`);
  }
};

const main = async () => {
  const options = parseArgs();
  const payload = await run(options);
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printMarkdown(payload);
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPgPool().end();
    } catch {
      // Ignore close errors after reporting the primary result.
    }
  });
