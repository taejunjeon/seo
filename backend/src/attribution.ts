import { promises as fs } from "node:fs";
import path from "node:path";

import type { Request } from "express";
import { z } from "zod";

export type AttributionTouchpoint = "checkout_started" | "payment_success" | "form_submit";
export type AttributionCaptureMode = "live" | "replay" | "smoke";

export type AttributionCaptureModeCounts = Record<AttributionCaptureMode, number>;

export type AttributionLedgerEntry = {
  touchpoint: AttributionTouchpoint;
  captureMode: AttributionCaptureMode;
  loggedAt: string;
  orderId: string;
  paymentKey: string;
  approvedAt: string;
  checkoutId: string;
  customerKey: string;
  landing: string;
  referrer: string;
  gaSessionId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  gclid: string;
  fbclid: string;
  ttclid: string;
  metadata: Record<string, unknown>;
  requestContext: {
    ip: string;
    userAgent: string;
    origin: string;
    requestReferer: string;
    method: string;
    path: string;
  };
};

export type TossJoinRow = {
  paymentKey: string;
  orderId: string;
  approvedAt: string;
  status: string;
  channel: string;
  store: string;
  totalAmount: number;
};

export type TossHourlyRow = {
  dateHour: string;
  approvalCount: number;
  totalAmount: number;
};

export type AttributionHourlyCompareRow = {
  dateHour: string;
  tossApprovalCount: number;
  tossApprovalAmount: number;
  paymentSuccessEntries: number;
  livePaymentSuccessEntries: number;
  replayPaymentSuccessEntries: number;
  smokePaymentSuccessEntries: number;
  checkoutEntries: number;
  diagnosticLabel: string;
};

export type TossReplayPlan = {
  summary: {
    tossRows: number;
    candidateRows: number;
    insertableRows: number;
    skippedExistingRows: number;
  };
  insertableEntries: AttributionLedgerEntry[];
  skippedRows: Array<{
    paymentKey: string;
    orderId: string;
    approvedAt: string;
    reason: string;
  }>;
};

const stringField = z.string().trim().max(5000).optional().default("");
const CAPTURE_MODES = ["live", "replay", "smoke"] as const;

const normalizedPayloadSchema = z.object({
  orderId: stringField,
  paymentKey: stringField,
  approvedAt: stringField,
  checkoutId: stringField,
  customerKey: stringField,
  landing: stringField,
  referrer: stringField,
  gaSessionId: stringField,
  utmSource: stringField,
  utmMedium: stringField,
  utmCampaign: stringField,
  utmTerm: stringField,
  utmContent: stringField,
  gclid: stringField,
  fbclid: stringField,
  ttclid: stringField,
  captureMode: z.enum(CAPTURE_MODES).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const DEFAULT_LEDGER_PATH = path.resolve(__dirname, "..", "logs", "checkout-attribution-ledger.jsonl");
const KST_TIMEZONE = "Asia/Seoul";
const CAPTURE_MODE_PRIORITY: Record<AttributionCaptureMode, number> = {
  live: 3,
  replay: 2,
  smoke: 1,
};

const createCaptureModeCounts = (): AttributionCaptureModeCounts => ({
  live: 0,
  replay: 0,
  smoke: 0,
});

const REFERRER_PAYMENT_KEYS = [
  "orderCode",
  "orderNo",
  "paymentCode",
  "orderId",
  "paymentKey",
  "amount",
] as const;

const parseReferrerPaymentParams = (
  referrerUrl: string,
): Record<string, string> => {
  if (!referrerUrl) return {};
  try {
    const url = new URL(referrerUrl);
    const result: Record<string, string> = {};
    for (const key of REFERRER_PAYMENT_KEYS) {
      const value = url.searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
};

const firstString = (input: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const objectValue = (input: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
  for (const key of keys) {
    const value = input[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
};

export const resolveLedgerPath = (overridePath?: string) => overridePath || DEFAULT_LEDGER_PATH;

const normalizeCaptureMode = (value: unknown): AttributionCaptureMode | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "replay" || normalized === "smoke") {
    return normalized;
  }
  return undefined;
};

export const buildRequestContext = (req: Request) => ({
  ip:
    (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0] : "")?.trim() ||
    req.ip ||
    "",
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
  origin: typeof req.headers.origin === "string" ? req.headers.origin : "",
  requestReferer: typeof req.headers.referer === "string" ? req.headers.referer : "",
  method: req.method,
  path: req.path,
});

export const normalizeAttributionPayload = (raw: unknown) => {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const referrerRaw = firstString(input, ["referrer", "referer"]);
  const referrerParams = parseReferrerPaymentParams(referrerRaw);

  const orderId =
    firstString(input, ["orderId", "order_id"]) ||
    referrerParams.orderNo ||
    referrerParams.orderId ||
    "";
  const paymentKey =
    firstString(input, ["paymentKey", "payment_key"]) ||
    referrerParams.paymentKey ||
    "";

  const existingMetadata = objectValue(input, ["metadata", "meta"]);
  const source = firstString(input, ["source"]);
  const clientObservedAt = firstString(input, ["clientObservedAt", "client_observed_at"]);

  const enrichedMetadata: Record<string, unknown> = { ...existingMetadata };
  if (source) enrichedMetadata.source = source;
  if (clientObservedAt) enrichedMetadata.clientObservedAt = clientObservedAt;
  if (Object.keys(referrerParams).length > 0) {
    enrichedMetadata.referrerPayment = referrerParams;
  }
  const formId = firstString(input, ["formId", "form_id"]);
  if (formId) enrichedMetadata.formId = formId;
  const formName = firstString(input, ["formName", "form_name"]);
  if (formName) enrichedMetadata.formName = formName;
  const formPage = firstString(input, ["formPage", "form_page"]);
  if (formPage) enrichedMetadata.formPage = formPage;

  return normalizedPayloadSchema.parse({
    orderId,
    paymentKey,
    approvedAt: firstString(input, ["approvedAt", "approved_at"]),
    checkoutId: firstString(input, ["checkoutId", "checkout_id"]),
    customerKey: firstString(input, ["customerKey", "customer_key"]),
    landing: firstString(input, ["landing", "landingPath", "landing_path"]),
    referrer: referrerRaw,
    gaSessionId: firstString(input, ["gaSessionId", "ga_session_id"]),
    utmSource: firstString(input, ["utmSource", "utm_source"]),
    utmMedium: firstString(input, ["utmMedium", "utm_medium"]),
    utmCampaign: firstString(input, ["utmCampaign", "utm_campaign"]),
    utmTerm: firstString(input, ["utmTerm", "utm_term"]),
    utmContent: firstString(input, ["utmContent", "utm_content"]),
    gclid: firstString(input, ["gclid"]),
    fbclid: firstString(input, ["fbclid"]),
    ttclid: firstString(input, ["ttclid"]),
    captureMode: normalizeCaptureMode(
      firstString(input, ["captureMode", "capture_mode", "sourceMode", "source_mode"]),
    ),
    metadata: enrichedMetadata,
  });
};

const resolveCaptureMode = (params: {
  captureMode?: AttributionCaptureMode;
  metadata: Record<string, unknown>;
  utmMedium: string;
  requestContext: AttributionLedgerEntry["requestContext"];
}) => {
  if (params.captureMode) {
    return params.captureMode;
  }

  const metadataMode = normalizeCaptureMode(params.metadata.captureMode);
  if (metadataMode) {
    return metadataMode;
  }

  if (
    params.metadata.replaySource ||
    params.requestContext.method === "REPLAY" ||
    params.requestContext.path.includes("/replay/")
  ) {
    return "replay" as const;
  }

  if (params.metadata.smokeCheck === true || params.utmMedium === "smoke") {
    return "smoke" as const;
  }

  return "live" as const;
};

const inferCaptureMode = (
  payload: ReturnType<typeof normalizeAttributionPayload>,
  requestContext: AttributionLedgerEntry["requestContext"],
): AttributionCaptureMode => {
  return resolveCaptureMode({
    captureMode: payload.captureMode,
    metadata: payload.metadata,
    utmMedium: payload.utmMedium,
    requestContext,
  });
};

export const buildLedgerEntry = (
  touchpoint: AttributionTouchpoint,
  raw: unknown,
  requestContext: AttributionLedgerEntry["requestContext"],
  loggedAt = new Date().toISOString(),
): AttributionLedgerEntry => {
  const payload = normalizeAttributionPayload(raw);
  if (
    touchpoint === "checkout_started" &&
    !payload.checkoutId &&
    !payload.customerKey &&
    !payload.landing &&
    !payload.gaSessionId
  ) {
    throw new Error("checkout_started requires at least one of checkoutId, customerKey, landing, gaSessionId");
  }
  if (touchpoint === "payment_success" && !payload.orderId && !payload.paymentKey) {
    throw new Error("payment_success requires orderId or paymentKey");
  }
  if (touchpoint === "form_submit" && !payload.metadata?.source) {
    throw new Error("form_submit requires source in metadata");
  }
  return {
    touchpoint,
    loggedAt,
    ...payload,
    captureMode: inferCaptureMode(payload, requestContext),
    requestContext,
  };
};

export const appendLedgerEntry = async (
  entry: AttributionLedgerEntry,
  ledgerPath?: string,
) => {
  const targetPath = resolveLedgerPath(ledgerPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.appendFile(targetPath, `${JSON.stringify(entry)}\n`, "utf8");
  return targetPath;
};

export const readLedgerEntries = async (ledgerPath?: string): Promise<AttributionLedgerEntry[]> => {
  const targetPath = resolveLedgerPath(ledgerPath);
  try {
    const content = await fs.readFile(targetPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parsed = JSON.parse(line) as Partial<AttributionLedgerEntry>;
        const requestContext = {
          ip: parsed.requestContext?.ip ?? "",
          userAgent: parsed.requestContext?.userAgent ?? "",
          origin: parsed.requestContext?.origin ?? "",
          requestReferer: parsed.requestContext?.requestReferer ?? "",
          method: parsed.requestContext?.method ?? "",
          path: parsed.requestContext?.path ?? "",
        };

        return {
          touchpoint: parsed.touchpoint === "payment_success" ? "payment_success" : parsed.touchpoint === "form_submit" ? "form_submit" : "checkout_started",
          captureMode: resolveCaptureMode({
            captureMode: normalizeCaptureMode(parsed.captureMode),
            metadata: parsed.metadata ?? {},
            utmMedium: typeof parsed.utmMedium === "string" ? parsed.utmMedium : "",
            requestContext,
          }),
          loggedAt: parsed.loggedAt ?? "",
          orderId: parsed.orderId ?? "",
          paymentKey: parsed.paymentKey ?? "",
          approvedAt: parsed.approvedAt ?? "",
          checkoutId: parsed.checkoutId ?? "",
          customerKey: parsed.customerKey ?? "",
          landing: parsed.landing ?? "",
          referrer: parsed.referrer ?? "",
          gaSessionId: parsed.gaSessionId ?? "",
          utmSource: parsed.utmSource ?? "",
          utmMedium: parsed.utmMedium ?? "",
          utmCampaign: parsed.utmCampaign ?? "",
          utmTerm: parsed.utmTerm ?? "",
          utmContent: parsed.utmContent ?? "",
          gclid: parsed.gclid ?? "",
          fbclid: parsed.fbclid ?? "",
          ttclid: parsed.ttclid ?? "",
          metadata: parsed.metadata ?? {},
          requestContext,
        } satisfies AttributionLedgerEntry;
      })
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return [];
    throw error;
  }
};

export const filterLedgerEntries = (
  entries: AttributionLedgerEntry[],
  filters: { source?: string; captureMode?: string },
): AttributionLedgerEntry[] => {
  return entries.filter((entry) => {
    if (filters.source) {
      const entrySource =
        typeof entry.metadata?.source === "string" ? entry.metadata.source : "";
      if (entrySource !== filters.source) return false;
    }
    if (filters.captureMode && entry.captureMode !== filters.captureMode) return false;
    return true;
  });
};

export const buildLedgerSummary = (entries: AttributionLedgerEntry[]) => {
  const countsByTouchpoint: Record<string, number> = {};
  const countsByCaptureMode = createCaptureModeCounts();
  const paymentSuccessByCaptureMode = createCaptureModeCounts();
  const checkoutByCaptureMode = createCaptureModeCounts();
  const countsBySource: Record<string, number> = {};
  let withPaymentKey = 0;
  let withOrderId = 0;
  let withGaSessionId = 0;
  let withReferrerPayment = 0;

  for (const entry of entries) {
    countsByTouchpoint[entry.touchpoint] = (countsByTouchpoint[entry.touchpoint] ?? 0) + 1;
    countsByCaptureMode[entry.captureMode] += 1;
    if (entry.touchpoint === "payment_success") paymentSuccessByCaptureMode[entry.captureMode] += 1;
    if (entry.touchpoint === "checkout_started") checkoutByCaptureMode[entry.captureMode] += 1;
    if (entry.paymentKey) withPaymentKey += 1;
    if (entry.orderId) withOrderId += 1;
    if (entry.gaSessionId) withGaSessionId += 1;
    const source = typeof entry.metadata?.source === "string" ? entry.metadata.source : "(none)";
    countsBySource[source] = (countsBySource[source] ?? 0) + 1;
    if (entry.metadata?.referrerPayment) withReferrerPayment += 1;
  }

  return {
    totalEntries: entries.length,
    countsByTouchpoint,
    countsByCaptureMode,
    paymentSuccessByCaptureMode,
    checkoutByCaptureMode,
    countsBySource,
    entriesWithPaymentKey: withPaymentKey,
    entriesWithOrderId: withOrderId,
    entriesWithGaSessionId: withGaSessionId,
    entriesWithReferrerPayment: withReferrerPayment,
    latestLoggedAt: entries[0]?.loggedAt ?? null,
  };
};

const toKstDateHour = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(parsed)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  if (!parts.year || !parts.month || !parts.day || !parts.hour) {
    return null;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parts.hour,
    dateHour: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:00`,
  };
};

const buildAttributionIndex = (entries: AttributionLedgerEntry[]) => {
  const byPaymentKey = new Map<string, AttributionLedgerEntry>();
  const byOrderId = new Map<string, AttributionLedgerEntry>();

  for (const entry of entries) {
    const currentPaymentKeyEntry = entry.paymentKey ? byPaymentKey.get(entry.paymentKey) : undefined;
    if (
      entry.paymentKey &&
      (!currentPaymentKeyEntry ||
        CAPTURE_MODE_PRIORITY[entry.captureMode] > CAPTURE_MODE_PRIORITY[currentPaymentKeyEntry.captureMode] ||
        (
          CAPTURE_MODE_PRIORITY[entry.captureMode] === CAPTURE_MODE_PRIORITY[currentPaymentKeyEntry.captureMode] &&
          entry.loggedAt > currentPaymentKeyEntry.loggedAt
        ))
    ) {
      byPaymentKey.set(entry.paymentKey, entry);
    }
    const currentOrderIdEntry = entry.orderId ? byOrderId.get(entry.orderId) : undefined;
    if (
      entry.orderId &&
      (!currentOrderIdEntry ||
        CAPTURE_MODE_PRIORITY[entry.captureMode] > CAPTURE_MODE_PRIORITY[currentOrderIdEntry.captureMode] ||
        (
          CAPTURE_MODE_PRIORITY[entry.captureMode] === CAPTURE_MODE_PRIORITY[currentOrderIdEntry.captureMode] &&
          entry.loggedAt > currentOrderIdEntry.loggedAt
        ))
    ) {
      byOrderId.set(entry.orderId, entry);
    }
  }

  return { byPaymentKey, byOrderId };
};

const buildLedgerHourlyCounts = (entries: AttributionLedgerEntry[], date: string) => {
  const counts = new Map<
    string,
    {
      paymentSuccessEntries: number;
      paymentSuccessByCaptureMode: AttributionCaptureModeCounts;
      checkoutEntries: number;
    }
  >();

  for (const entry of entries) {
    const dateHour = toKstDateHour(entry.loggedAt);
    if (!dateHour || dateHour.date !== date) {
      continue;
    }

    const current = counts.get(dateHour.hour) ?? {
      paymentSuccessEntries: 0,
      paymentSuccessByCaptureMode: createCaptureModeCounts(),
      checkoutEntries: 0,
    };
    if (entry.touchpoint === "payment_success") {
      current.paymentSuccessEntries += 1;
      current.paymentSuccessByCaptureMode[entry.captureMode] += 1;
    }
    if (entry.touchpoint === "checkout_started") current.checkoutEntries += 1;
    counts.set(dateHour.hour, current);
  }

  return counts;
};

export const buildAttributionHourlyCompare = (params: {
  date: string;
  ledgerEntries: AttributionLedgerEntry[];
  tossHourlyRows: TossHourlyRow[];
}): AttributionHourlyCompareRow[] => {
  const ledgerMap = buildLedgerHourlyCounts(params.ledgerEntries, params.date);
  const tossMap = new Map(
    params.tossHourlyRows.map((row) => [row.dateHour.slice(11, 13), row]),
  );

  return Array.from({ length: 24 }, (_, hourIndex) => hourIndex.toString().padStart(2, "0")).map((hour) => {
    const toss = tossMap.get(hour);
    const ledger = ledgerMap.get(hour);
    const livePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.live ?? 0;
    const replayPaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.replay ?? 0;
    const smokePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.smoke ?? 0;

    let diagnosticLabel = "정상 범위";
    if ((toss?.approvalCount ?? 0) > 0 && livePaymentSuccessEntries === 0 && replayPaymentSuccessEntries > 0) {
      diagnosticLabel = "replay row는 있으나 live payment success receiver가 비어 있음";
    } else if ((toss?.approvalCount ?? 0) > 0 && (ledger?.paymentSuccessEntries ?? 0) === 0) {
      diagnosticLabel = "토스 승인만 있고 payment success receiver가 비어 있음";
    } else if ((ledger?.paymentSuccessEntries ?? 0) > 0 && (toss?.approvalCount ?? 0) === 0) {
      diagnosticLabel = "receiver row는 있으나 토스 승인 집계와 분리됨";
    }

    return {
      dateHour: `${params.date} ${hour}:00`,
      tossApprovalCount: toss?.approvalCount ?? 0,
      tossApprovalAmount: toss?.totalAmount ?? 0,
      paymentSuccessEntries: ledger?.paymentSuccessEntries ?? 0,
      livePaymentSuccessEntries,
      replayPaymentSuccessEntries,
      smokePaymentSuccessEntries,
      checkoutEntries: ledger?.checkoutEntries ?? 0,
      diagnosticLabel,
    };
  });
};

export const buildTossJoinReport = (
  entries: AttributionLedgerEntry[],
  tossRows: TossJoinRow[],
  limit = 50,
) => {
  const relevantEntries = entries.filter((entry) => entry.touchpoint === "payment_success");
  const { byPaymentKey, byOrderId } = buildAttributionIndex(relevantEntries);
  const matchedEntryKeys = new Set<string>();
  const matchedTossRowsByCaptureMode = createCaptureModeCounts();
  const entriesWithPaymentKey = relevantEntries.filter((entry) => Boolean(entry.paymentKey)).length;
  const entriesWithOrderId = relevantEntries.filter((entry) => Boolean(entry.orderId)).length;
  const entriesWithBothKeys = relevantEntries.filter((entry) => Boolean(entry.paymentKey && entry.orderId)).length;
  const paymentSuccessEntriesByCaptureMode = createCaptureModeCounts();
  for (const entry of relevantEntries) {
    paymentSuccessEntriesByCaptureMode[entry.captureMode] += 1;
  }
  let matchedByPaymentKey = 0;
  let matchedByOrderId = 0;
  const items = tossRows.slice(0, Math.max(1, Math.min(limit, 500))).map((row) => {
    const paymentKeyMatch = row.paymentKey ? byPaymentKey.get(row.paymentKey) : undefined;
    const orderIdMatch = paymentKeyMatch ? undefined : row.orderId ? byOrderId.get(row.orderId) : undefined;
    const match = paymentKeyMatch ?? orderIdMatch;
    const matchType = paymentKeyMatch ? "payment_key" : orderIdMatch ? "order_id" : "unmatched";

    if (matchType === "payment_key") matchedByPaymentKey += 1;
    if (matchType === "order_id") matchedByOrderId += 1;

    if (match) {
      matchedEntryKeys.add(`${match.loggedAt}:${match.paymentKey}:${match.orderId}`);
      matchedTossRowsByCaptureMode[match.captureMode] += 1;
    }

    return {
      paymentKey: row.paymentKey,
      orderId: row.orderId,
      approvedAt: row.approvedAt,
      status: row.status,
      channel: row.channel,
      store: row.store,
      totalAmount: row.totalAmount,
      attributionMatchType: matchType,
      attribution: match
        ? {
            captureMode: match.captureMode,
            loggedAt: match.loggedAt,
            landing: match.landing,
            referrer: match.referrer,
            gaSessionId: match.gaSessionId,
            utmSource: match.utmSource,
            utmMedium: match.utmMedium,
            utmCampaign: match.utmCampaign,
            gclid: match.gclid,
            fbclid: match.fbclid,
            ttclid: match.ttclid,
            requestContext: match.requestContext,
          }
        : null,
    };
  });

  const unmatchedLedgerEntries = relevantEntries.filter(
    (entry) => !matchedEntryKeys.has(`${entry.loggedAt}:${entry.paymentKey}:${entry.orderId}`),
  );
  const unmatchedLedgerEntriesByCaptureMode = createCaptureModeCounts();
  for (const entry of unmatchedLedgerEntries) {
    unmatchedLedgerEntriesByCaptureMode[entry.captureMode] += 1;
  }

  const matchedCount = items.filter((item) => item.attributionMatchType !== "unmatched").length;
  const matchedLedgerEntries = relevantEntries.length - unmatchedLedgerEntries.length;

  return {
    summary: {
      tossRows: items.length,
      paymentSuccessEntries: relevantEntries.length,
      matchedTossRows: matchedCount,
      matchedByPaymentKey,
      matchedByOrderId,
      unmatchedTossRows: items.length - matchedCount,
      unmatchedLedgerEntries: unmatchedLedgerEntries.length,
      paymentSuccessEntriesWithPaymentKey: entriesWithPaymentKey,
      paymentSuccessEntriesWithOrderId: entriesWithOrderId,
      paymentSuccessEntriesWithBothKeys: entriesWithBothKeys,
      joinCoverageRate: items.length > 0 ? +((matchedCount / items.length) * 100).toFixed(1) : 0,
      ledgerCoverageRate:
        relevantEntries.length > 0 ? +((matchedLedgerEntries / relevantEntries.length) * 100).toFixed(1) : 0,
      byCaptureMode: {
        live: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.live,
          matchedTossRows: matchedTossRowsByCaptureMode.live,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.live,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.live / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.live > 0
              ? +(((paymentSuccessEntriesByCaptureMode.live - unmatchedLedgerEntriesByCaptureMode.live) / paymentSuccessEntriesByCaptureMode.live) * 100).toFixed(1)
              : 0,
        },
        replay: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.replay,
          matchedTossRows: matchedTossRowsByCaptureMode.replay,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.replay,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.replay / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.replay > 0
              ? +(((paymentSuccessEntriesByCaptureMode.replay - unmatchedLedgerEntriesByCaptureMode.replay) / paymentSuccessEntriesByCaptureMode.replay) * 100).toFixed(1)
              : 0,
        },
        smoke: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.smoke,
          matchedTossRows: matchedTossRowsByCaptureMode.smoke,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.smoke,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.smoke / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.smoke > 0
              ? +(((paymentSuccessEntriesByCaptureMode.smoke - unmatchedLedgerEntriesByCaptureMode.smoke) / paymentSuccessEntriesByCaptureMode.smoke) * 100).toFixed(1)
              : 0,
        },
      },
    },
    items,
    unmatchedLedgerEntries: unmatchedLedgerEntries.slice(0, 20).map((entry) => ({
      captureMode: entry.captureMode,
      loggedAt: entry.loggedAt,
      orderId: entry.orderId,
      paymentKey: entry.paymentKey,
      landing: entry.landing,
      gaSessionId: entry.gaSessionId,
      utmSource: entry.utmSource,
      utmCampaign: entry.utmCampaign,
    })),
  };
};

export const normalizeApprovedAtToIso = (value: string, fallback = new Date().toISOString()) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const candidates = [
    trimmed,
    trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"),
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed) ? `${trimmed.replace(" ", "T")}+09:00` : "",
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}+09:00` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
};

export const buildTossReplayPlan = (
  existingEntries: AttributionLedgerEntry[],
  tossRows: TossJoinRow[],
  limit = 100,
): TossReplayPlan => {
  const existingPaymentKeys = new Set(existingEntries.map((entry) => entry.paymentKey).filter(Boolean));
  const existingOrderIds = new Set(existingEntries.map((entry) => entry.orderId).filter(Boolean));
  const candidateRows = tossRows.slice(0, Math.max(1, Math.min(limit, 500)));
  const insertableEntries: AttributionLedgerEntry[] = [];
  const skippedRows: TossReplayPlan["skippedRows"] = [];

  for (const row of candidateRows) {
    const paymentKeyExists = Boolean(row.paymentKey && existingPaymentKeys.has(row.paymentKey));
    const orderIdExists = Boolean(row.orderId && existingOrderIds.has(row.orderId));

    if (paymentKeyExists || orderIdExists) {
      skippedRows.push({
        paymentKey: row.paymentKey,
        orderId: row.orderId,
        approvedAt: row.approvedAt,
        reason: paymentKeyExists && orderIdExists ? "paymentKey/orderId already exists" : paymentKeyExists ? "paymentKey already exists" : "orderId already exists",
      });
      continue;
    }

    const replayEntry = buildLedgerEntry(
      "payment_success",
      {
        orderId: row.orderId,
        paymentKey: row.paymentKey,
        approvedAt: row.approvedAt,
        captureMode: "replay",
        metadata: {
          replaySource: "tb_sales_toss",
          status: row.status,
          channel: row.channel,
          store: row.store,
          totalAmount: row.totalAmount,
        },
      },
      {
        ip: "",
        userAgent: "system:replay",
        origin: "",
        requestReferer: "",
        method: "REPLAY",
        path: "/api/attribution/replay/toss",
      },
      normalizeApprovedAtToIso(row.approvedAt),
    );
    insertableEntries.push(replayEntry);
    if (replayEntry.paymentKey) existingPaymentKeys.add(replayEntry.paymentKey);
    if (replayEntry.orderId) existingOrderIds.add(replayEntry.orderId);
  }

  return {
    summary: {
      tossRows: tossRows.length,
      candidateRows: candidateRows.length,
      insertableRows: insertableEntries.length,
      skippedExistingRows: skippedRows.length,
    },
    insertableEntries,
    skippedRows,
  };
};
