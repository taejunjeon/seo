import { createHash } from "node:crypto";

import type Database from "better-sqlite3";

import type { AttributionLedgerEntry } from "./attribution";
import { listAttributionLedgerEntries } from "./attributionLedgerDb";
import { getCrmDb } from "./crmLocalDb";
import { normalizeOrderIdBase } from "./orderKeys";
import { listTikTokPixelEvents, type TikTokPixelEvent } from "./tiktokPixelEvents";

const SHADOW_TABLE = "tiktok_events_api_shadow_candidates";
const CANDIDATE_VERSION = "2026-05-03.shadow.v1";
const PIXEL_CODE = "D5G8FTBC77UAODHQ0KOG";

export type TikTokEventsApiShadowBlockReason =
  | "not_confirmed"
  | "pending_virtual_account"
  | "canceled_or_overdue"
  | "no_tiktok_evidence"
  | "missing_order_code"
  | "missing_browser_event_id"
  | "event_name_mismatch"
  | "pixel_code_mismatch"
  | "pii_detected"
  | "duplicate_shadow_candidate";

export type TikTokEventsApiShadowCandidate = {
  candidateId: string;
  site: string;
  sourceSystem: string;
  candidateVersion: string;
  evaluationMode: "shadow_only";
  sendCandidate: false;
  eligibleForFutureSend: boolean;
  platformSendStatus: "not_sent";
  eventName: "Purchase";
  browserEventName: "Purchase";
  pixelCode: string;
  rawOrderCode: string;
  guardRawEventId: string;
  browserEventIdObserved: string;
  browserEventIdSource: string;
  serverEventIdCandidate: string;
  dedupReady: boolean;
  dedupBlockReason: string;
  orderCode: string;
  orderNo: string;
  orderId: string;
  paymentCode: string;
  paymentKeyPresent: boolean;
  value: number | null;
  currency: string;
  paymentStatus: string;
  paymentStatusSource: string;
  paymentDecisionBranch: string;
  paymentDecisionReason: string;
  paymentDecisionMatchedBy: string;
  tiktokEvidencePresent: boolean;
  tiktokEvidenceType: string;
  hasTtclid: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrerHost: string;
  piiInPayload: boolean;
  blockReasons: TikTokEventsApiShadowBlockReason[];
  payloadPreview: Record<string, unknown>;
  sourceRefs: Record<string, unknown>;
  metadata: Record<string, unknown>;
  firstObservedAt: string;
  lastEvaluatedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TikTokEventsApiShadowBuildOptions = {
  site?: string;
  siteSource?: string;
  now?: string;
  startAt?: string;
  endAt?: string;
  limit?: number;
};

export type TikTokEventsApiShadowBuildResult = {
  candidates: TikTokEventsApiShadowCandidate[];
  summary: TikTokEventsApiShadowSummary;
};

export type TikTokEventsApiShadowSummary = {
  totalCandidates: number;
  eligibleForFutureSend: number;
  blocked: number;
  sendCandidateTrue: 0;
  platformSent: 0;
  dedupReady: number;
  countsByBlockReason: Record<string, number>;
  countsByPaymentStatus: Record<string, number>;
  countsByEvidenceType: Record<string, number>;
};

type GroupedPurchase = {
  key: string;
  events: TikTokPixelEvent[];
};

type PaymentMatch = {
  entry: AttributionLedgerEntry | null;
  status: string;
  statusSource: string;
};

type EvidenceMatch = {
  present: boolean;
  type: string;
  hasTtclid: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrerHost: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readString = (input: unknown, key: string): string => {
  if (!isRecord(input)) return "";
  const value = input[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const readNestedString = (input: unknown, path: string[]): string => {
  let cursor: unknown = input;
  for (const key of path) {
    if (!isRecord(cursor)) return "";
    cursor = cursor[key];
  }
  if (typeof cursor === "string") return cursor.trim();
  if (typeof cursor === "number" && Number.isFinite(cursor)) return String(cursor);
  return "";
};

const parseHost = (value: string): string => {
  if (!value) return "";
  try {
    return new URL(value, "https://biocom.kr").hostname.toLowerCase();
  } catch {
    return "";
  }
};

const parseUrlParam = (value: string, key: string): string => {
  if (!value) return "";
  try {
    return new URL(value, "https://biocom.kr").searchParams.get(key)?.trim() ?? "";
  } catch {
    return "";
  }
};

const hasTikTokHost = (value: string) => /(^|\.)tiktok\.com$/i.test(parseHost(value));

const includesTikTokSource = (value: string) => /tiktok/i.test(value.trim());

const unique = <T>(values: T[]) => Array.from(new Set(values));

const hashCandidateId = (parts: string[]) => {
  const hash = createHash("sha256");
  hash.update(parts.join("\u001f"));
  return hash.digest("hex");
};

export const buildTikTokServerEventIdCandidate = (eventName: string, orderCode: string) =>
  `${eventName}_${orderCode}`;

const isRawOrderLikeEventId = (value: string) => /^o\d{8}[a-z0-9]+$/i.test(value.trim());

export const sanitizeTikTokRawEventIdForStorage = (eventId: string) => {
  const trimmed = eventId.trim();
  if (!trimmed) return "";
  if (!isRawOrderLikeEventId(trimmed)) return trimmed;
  return `raw_order_event_id_sha256:${createHash("sha256").update(trimmed).digest("hex")}`;
};

const candidateIdFor = (candidate: Pick<TikTokEventsApiShadowCandidate, "site" | "eventName" | "serverEventIdCandidate" | "orderCode" | "orderNo" | "paymentCode" | "candidateVersion">) =>
  hashCandidateId([
    candidate.site,
    candidate.eventName,
    candidate.serverEventIdCandidate,
    candidate.orderCode,
    candidate.orderNo,
    candidate.paymentCode,
    candidate.candidateVersion,
  ]);

const groupPurchaseEvents = (events: TikTokPixelEvent[]): GroupedPurchase[] => {
  const groups = new Map<string, TikTokPixelEvent[]>();
  for (const event of events) {
    if (event.eventName !== "Purchase") continue;
    const key = event.orderCode || event.orderNo || event.paymentCode || event.eventId;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([key, grouped]) => ({
    key,
    events: grouped.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
  }));
};

const latestByLoggedAt = (events: TikTokPixelEvent[]) =>
  [...events].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];

const firstObservedAt = (events: TikTokPixelEvent[]) =>
  [...events].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))[0]?.loggedAt ?? "";

const isPendingVirtualAccount = (events: TikTokPixelEvent[]) =>
  events.some((event) => {
    const haystack = [
      event.action,
      event.decisionStatus,
      event.decisionBranch,
      event.decisionReason,
      event.paymentCode,
      readString(event.decision, "browserAction"),
      readString(event.decision, "status"),
      readString(event.params, "payment_status"),
    ]
      .join(" ")
      .toLowerCase();
    return (
      haystack.includes("blocked_pending_purchase") ||
      haystack.includes("block_purchase_virtual_account") ||
      haystack.includes("virtual_account") ||
      haystack.includes("pending")
    );
  });

const isCanceledOrOverdue = (entry: AttributionLedgerEntry | null, events: TikTokPixelEvent[]) => {
  if (entry?.paymentStatus === "canceled") return true;
  const values = [
    entry?.paymentStatus ?? "",
    readString(entry?.metadata, "imwebPaymentStatus"),
    readString(entry?.metadata, "imweb_status"),
    readString(entry?.metadata, "paymentStatus"),
    readString(entry?.metadata, "status"),
    ...events.flatMap((event) => [
      event.decisionStatus,
      event.decisionBranch,
      event.decisionReason,
      readString(event.decision, "status"),
      readString(event.decision, "browserAction"),
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return /cancel|overdue|expired|payment_overdue|입금기간|자동\s*취소/.test(values);
};

const metadataOrderCode = (entry: AttributionLedgerEntry) =>
  readString(entry.metadata, "orderCode") ||
  readString(entry.metadata, "order_code") ||
  readNestedString(entry.metadata, ["landingPayment", "orderCode"]);

const metadataOrderNo = (entry: AttributionLedgerEntry) =>
  readString(entry.metadata, "orderNo") ||
  readString(entry.metadata, "order_no") ||
  readNestedString(entry.metadata, ["landingPayment", "orderNo"]);

const metadataPaymentCode = (entry: AttributionLedgerEntry) =>
  readString(entry.metadata, "paymentCode") ||
  readString(entry.metadata, "payment_code") ||
  readNestedString(entry.metadata, ["landingPayment", "paymentCode"]);

const entryMatchesOrder = (entry: AttributionLedgerEntry, event: TikTokPixelEvent) => {
  const entryOrderBase = normalizeOrderIdBase(entry.orderId);
  const eventOrderNoBase = normalizeOrderIdBase(event.orderNo);
  const entryMetadataOrderNo = metadataOrderNo(entry);
  const entryMetadataOrderCode = metadataOrderCode(entry);
  const entryPaymentCode = metadataPaymentCode(entry);
  return Boolean(
    (event.orderCode && entryMetadataOrderCode === event.orderCode) ||
      (event.orderCode && entry.landing.includes(`order_code=${event.orderCode}`)) ||
      (event.orderNo && entryOrderBase && eventOrderNoBase && entryOrderBase === eventOrderNoBase) ||
      (event.orderNo && entryMetadataOrderNo === event.orderNo) ||
      (event.orderNo && entry.landing.includes(`order_no=${event.orderNo}`)) ||
      (event.paymentCode && entryPaymentCode === event.paymentCode) ||
      (event.paymentCode && entry.landing.includes(`payment_code=${event.paymentCode}`)),
  );
};

const findPaymentMatch = (
  events: TikTokPixelEvent[],
  ledgerEntries: AttributionLedgerEntry[],
): PaymentMatch => {
  const paymentSuccesses = ledgerEntries
    .filter((entry) => entry.touchpoint === "payment_success")
    .filter((entry) => events.some((event) => entryMatchesOrder(entry, event)))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const confirmed = paymentSuccesses.find((entry) => entry.paymentStatus === "confirmed");
  if (confirmed) {
    return {
      entry: confirmed,
      status: "confirmed",
      statusSource: "CRM_LOCAL_DB_PATH#attribution_ledger.payment_success",
    };
  }
  const canceled = paymentSuccesses.find((entry) => entry.paymentStatus === "canceled");
  if (canceled) {
    return {
      entry: canceled,
      status: "canceled",
      statusSource: "CRM_LOCAL_DB_PATH#attribution_ledger.payment_success",
    };
  }
  const pending = paymentSuccesses.find((entry) => entry.paymentStatus === "pending");
  if (pending) {
    return {
      entry: pending,
      status: "pending",
      statusSource: "CRM_LOCAL_DB_PATH#attribution_ledger.payment_success",
    };
  }
  const confirmedEvent = events.find(
    (event) =>
      event.action === "released_confirmed_purchase" ||
      event.decisionStatus === "confirmed" ||
      event.decisionBranch === "allow_purchase",
  );
  if (confirmedEvent) {
    return {
      entry: null,
      status: "confirmed",
      statusSource: "CRM_LOCAL_DB_PATH#tiktok_pixel_events.decision",
    };
  }
  return {
    entry: null,
    status: "",
    statusSource: "",
  };
};

const tiktokReasonsFromMetadata = (metadata: Record<string, unknown>) => {
  const raw = metadata.tiktokMatchReasons ?? metadata.strictTikTokMarketingIntentReasons;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
};

const firstTouchFromMetadata = (metadata: Record<string, unknown>) => {
  const firstTouch = metadata.firstTouch;
  return isRecord(firstTouch) ? firstTouch : {};
};

const collectEvidence = (
  events: TikTokPixelEvent[],
  ledgerEntries: AttributionLedgerEntry[],
  paymentEntry: AttributionLedgerEntry | null,
): EvidenceMatch => {
  const entries = [
    ...(paymentEntry ? [paymentEntry] : []),
    ...ledgerEntries.filter((entry) => entry.touchpoint === "marketing_intent"),
    ...ledgerEntries.filter((entry) => entry.touchpoint === "checkout_started"),
  ];
  const ttclid =
    events.find((event) => event.ttclid)?.ttclid ||
    entries.find((entry) => entry.ttclid)?.ttclid ||
    readString(paymentEntry?.metadata, "ttclid") ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "ttclid") ||
    "";
  const utmSource =
    events.find((event) => event.utmSource)?.utmSource ||
    entries.find((entry) => entry.utmSource)?.utmSource ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "utmSource") ||
    "";
  const utmMedium =
    events.find((event) => event.utmMedium)?.utmMedium ||
    entries.find((entry) => entry.utmMedium)?.utmMedium ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "utmMedium") ||
    "";
  const utmCampaign =
    events.find((event) => event.utmCampaign)?.utmCampaign ||
    entries.find((entry) => entry.utmCampaign)?.utmCampaign ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "utmCampaign") ||
    "";
  const utmContent =
    events.find((event) => event.utmContent)?.utmContent ||
    entries.find((entry) => entry.utmContent)?.utmContent ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "utmContent") ||
    "";
  const referrer =
    events.find((event) => hasTikTokHost(event.referrer))?.referrer ||
    entries.find((entry) => hasTikTokHost(entry.referrer))?.referrer ||
    readString(firstTouchFromMetadata(paymentEntry?.metadata ?? {}), "referrer") ||
    "";
  const metadataReasons = [
    ...tiktokReasonsFromMetadata(paymentEntry?.metadata ?? {}),
    ...entries.flatMap((entry) => tiktokReasonsFromMetadata(entry.metadata)),
  ];
  const evidenceTypes = [
    ttclid ? "ttclid" : "",
    includesTikTokSource(utmSource) ? "utm_source_tiktok" : "",
    hasTikTokHost(referrer) ? "referrer_tiktok" : "",
    metadataReasons.length > 0 ? "metadata_tiktok_match_reasons" : "",
  ].filter(Boolean);
  return {
    present: evidenceTypes.length > 0,
    type: unique(evidenceTypes).join(","),
    hasTtclid: Boolean(ttclid),
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    referrerHost: parseHost(referrer),
  };
};

const detectPayloadPii = (payload: Record<string, unknown>) => {
  const text = JSON.stringify(payload).toLowerCase();
  return /email|phone|mobile|address|addr|name|shipping|buyer|receiver/.test(text);
};

const addBlockReason = (
  reasons: TikTokEventsApiShadowBlockReason[],
  reason: TikTokEventsApiShadowBlockReason,
) => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

const buildPayloadPreview = (input: {
  eventName: string;
  eventId: string;
  event: TikTokPixelEvent;
  paymentMatch: PaymentMatch;
  evidence: EvidenceMatch;
}) => {
  const orderId =
    input.paymentMatch.entry?.orderId ||
    (input.event.orderNo ? `${input.event.orderNo}-P1` : input.event.orderCode);
  return {
    pixel_code: PIXEL_CODE,
    event: input.eventName,
    event_id: input.eventId,
    timestamp_source: input.paymentMatch.entry
      ? "attribution_ledger.payment_success.logged_at"
      : "tiktok_pixel_events.logged_at",
    properties: {
      currency: input.event.currency || "KRW",
      value: input.event.value,
      content_type: "product",
      order_id: orderId,
    },
    context_preview: {
      has_ttp: false,
      has_ttclid: input.evidence.hasTtclid,
      has_user_agent: false,
      has_ip: false,
      raw_pii_included: false,
    },
    send_mode: "shadow_only",
    send_candidate: false,
  };
};

const buildSourceRefs = (
  event: TikTokPixelEvent,
  paymentMatch: PaymentMatch,
  evidence: EvidenceMatch,
) => ({
  tiktok_pixel_events: {
    event_log_id: event.eventLogId,
    action: event.action,
    event_id: sanitizeTikTokRawEventIdForStorage(event.eventId),
    raw_event_id_stored: !isRawOrderLikeEventId(event.eventId),
    storage: "CRM_LOCAL_DB_PATH#tiktok_pixel_events",
  },
  attribution_ledger_payment_success: paymentMatch.entry
    ? {
        touchpoint: paymentMatch.entry.touchpoint,
        order_id: paymentMatch.entry.orderId,
        payment_status: paymentMatch.entry.paymentStatus,
        logged_at: paymentMatch.entry.loggedAt,
        storage: "CRM_LOCAL_DB_PATH#attribution_ledger",
      }
    : null,
  tiktok_evidence: {
    present: evidence.present,
    type: evidence.type,
  },
  operating_db_crosscheck: {
    used: false,
    table: "dashboard.public.tb_iamweb_users",
    write: false,
  },
});

export const buildTikTokEventsApiShadowCandidatesFromSources = (
  pixelEvents: TikTokPixelEvent[],
  ledgerEntries: AttributionLedgerEntry[],
  options: TikTokEventsApiShadowBuildOptions = {},
): TikTokEventsApiShadowBuildResult => {
  const site = options.site ?? "biocom";
  const now = options.now ?? new Date().toISOString();
  const candidates = groupPurchaseEvents(pixelEvents).map((group) => {
    const event = latestByLoggedAt(group.events);
    const orderCode = event.orderCode || parseUrlParam(event.url, "order_code");
    const serverEventIdCandidate = orderCode ? buildTikTokServerEventIdCandidate("Purchase", orderCode) : "";
    const browserEventIdObserved = event.eventId.startsWith("Purchase_")
      ? event.eventId
      : serverEventIdCandidate;
    const browserEventIdSource = event.eventId.startsWith("Purchase_")
      ? "tiktok_pixel_events.event_id"
      : "imweb_wrapper_rule";
    const paymentMatch = findPaymentMatch(group.events, ledgerEntries);
    const evidence = collectEvidence(group.events, ledgerEntries, paymentMatch.entry);
    const payloadPreview = buildPayloadPreview({
      eventName: "Purchase",
      eventId: serverEventIdCandidate,
      event,
      paymentMatch,
      evidence,
    });
    const blockReasons: TikTokEventsApiShadowBlockReason[] = [];

    if (!orderCode) addBlockReason(blockReasons, "missing_order_code");
    if (!browserEventIdObserved) addBlockReason(blockReasons, "missing_browser_event_id");
    if (event.eventName !== "Purchase") addBlockReason(blockReasons, "event_name_mismatch");
    if (PIXEL_CODE !== "D5G8FTBC77UAODHQ0KOG") addBlockReason(blockReasons, "pixel_code_mismatch");
    if (isPendingVirtualAccount(group.events)) addBlockReason(blockReasons, "pending_virtual_account");
    if (isCanceledOrOverdue(paymentMatch.entry, group.events)) addBlockReason(blockReasons, "canceled_or_overdue");
    if (paymentMatch.status !== "confirmed") addBlockReason(blockReasons, "not_confirmed");
    if (!evidence.present) addBlockReason(blockReasons, "no_tiktok_evidence");
    if (detectPayloadPii(payloadPreview)) addBlockReason(blockReasons, "pii_detected");

    const eligibleForFutureSend = blockReasons.length === 0;
    const dedupReady = Boolean(
      eligibleForFutureSend &&
        browserEventIdObserved &&
        serverEventIdCandidate &&
        browserEventIdObserved === serverEventIdCandidate,
    );
    const candidateBase = {
      site,
      eventName: "Purchase" as const,
      serverEventIdCandidate,
      orderCode,
      orderNo: event.orderNo,
      paymentCode: event.paymentCode,
      candidateVersion: CANDIDATE_VERSION,
    };
    return {
      candidateId: candidateIdFor(candidateBase),
      site,
      sourceSystem: "tj_attribution_vm",
      candidateVersion: CANDIDATE_VERSION,
      evaluationMode: "shadow_only" as const,
      sendCandidate: false as const,
      eligibleForFutureSend,
      platformSendStatus: "not_sent" as const,
      eventName: "Purchase" as const,
      browserEventName: "Purchase" as const,
      pixelCode: PIXEL_CODE,
      rawOrderCode: orderCode,
      guardRawEventId: sanitizeTikTokRawEventIdForStorage(event.eventId),
      browserEventIdObserved,
      browserEventIdSource,
      serverEventIdCandidate,
      dedupReady,
      dedupBlockReason: dedupReady ? "" : blockReasons[0] ?? "missing_browser_event_id",
      orderCode,
      orderNo: event.orderNo,
      orderId: paymentMatch.entry?.orderId || (event.orderNo ? `${event.orderNo}-P1` : ""),
      paymentCode: event.paymentCode,
      paymentKeyPresent: event.paymentKeyPresent,
      value: event.value,
      currency: event.currency || "KRW",
      paymentStatus: paymentMatch.status,
      paymentStatusSource: paymentMatch.statusSource,
      paymentDecisionBranch: event.decisionBranch,
      paymentDecisionReason: event.decisionReason,
      paymentDecisionMatchedBy: event.decisionMatchedBy,
      tiktokEvidencePresent: evidence.present,
      tiktokEvidenceType: evidence.type,
      hasTtclid: evidence.hasTtclid,
      utmSource: evidence.utmSource,
      utmMedium: evidence.utmMedium,
      utmCampaign: evidence.utmCampaign,
      utmContent: evidence.utmContent,
      referrerHost: evidence.referrerHost,
      piiInPayload: detectPayloadPii(payloadPreview),
      blockReasons,
      payloadPreview,
      sourceRefs: buildSourceRefs(event, paymentMatch, evidence),
      metadata: {
        groupKey: group.key,
        groupedEventCount: group.events.length,
        source: "tiktok_events_api_shadow_candidates",
      },
      firstObservedAt: firstObservedAt(group.events),
      lastEvaluatedAt: now,
    };
  });

  return {
    candidates,
    summary: summarizeTikTokEventsApiShadowCandidates(candidates),
  };
};

export const summarizeTikTokEventsApiShadowCandidates = (
  candidates: TikTokEventsApiShadowCandidate[],
): TikTokEventsApiShadowSummary => {
  const countsByBlockReason: Record<string, number> = {};
  const countsByPaymentStatus: Record<string, number> = {};
  const countsByEvidenceType: Record<string, number> = {};
  for (const candidate of candidates) {
    for (const reason of candidate.blockReasons.length ? candidate.blockReasons : ["(none)"]) {
      countsByBlockReason[reason] = (countsByBlockReason[reason] ?? 0) + 1;
    }
    const paymentStatus = candidate.paymentStatus || "(none)";
    countsByPaymentStatus[paymentStatus] = (countsByPaymentStatus[paymentStatus] ?? 0) + 1;
    const evidenceType = candidate.tiktokEvidenceType || "(none)";
    countsByEvidenceType[evidenceType] = (countsByEvidenceType[evidenceType] ?? 0) + 1;
  }
  return {
    totalCandidates: candidates.length,
    eligibleForFutureSend: candidates.filter((candidate) => candidate.eligibleForFutureSend).length,
    blocked: candidates.filter((candidate) => !candidate.eligibleForFutureSend).length,
    sendCandidateTrue: 0,
    platformSent: 0,
    dedupReady: candidates.filter((candidate) => candidate.dedupReady).length,
    countsByBlockReason,
    countsByPaymentStatus,
    countsByEvidenceType,
  };
};

export const buildTikTokEventsApiShadowCandidatesFromDb = (
  options: TikTokEventsApiShadowBuildOptions = {},
) => {
  const pixelEvents = listTikTokPixelEvents({
    startAt: options.startAt,
    endAt: options.endAt,
    siteSource: options.siteSource ?? "biocom_imweb",
    eventName: "Purchase",
    limit: options.limit ?? 10000,
  });
  const ledgerEntries = listAttributionLedgerEntries();
  return buildTikTokEventsApiShadowCandidatesFromSources(pixelEvents, ledgerEntries, options);
};

export const ensureTikTokEventsApiShadowCandidateSchema = (db: Database.Database = getCrmDb()) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SHADOW_TABLE} (
      candidate_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      source_system TEXT NOT NULL DEFAULT 'tj_attribution_vm',
      candidate_version TEXT NOT NULL DEFAULT '${CANDIDATE_VERSION}',
      evaluation_mode TEXT NOT NULL DEFAULT 'shadow_only',
      send_candidate INTEGER NOT NULL DEFAULT 0,
      eligible_for_future_send INTEGER NOT NULL DEFAULT 0,
      platform_send_status TEXT NOT NULL DEFAULT 'not_sent',
      event_name TEXT NOT NULL DEFAULT '',
      browser_event_name TEXT NOT NULL DEFAULT '',
      pixel_code TEXT NOT NULL DEFAULT '',
      raw_order_code TEXT NOT NULL DEFAULT '',
      guard_raw_event_id TEXT NOT NULL DEFAULT '',
      browser_event_id_observed TEXT NOT NULL DEFAULT '',
      browser_event_id_source TEXT NOT NULL DEFAULT '',
      server_event_id_candidate TEXT NOT NULL DEFAULT '',
      dedup_ready INTEGER NOT NULL DEFAULT 0,
      dedup_block_reason TEXT NOT NULL DEFAULT '',
      order_code TEXT NOT NULL DEFAULT '',
      order_no TEXT NOT NULL DEFAULT '',
      order_id TEXT NOT NULL DEFAULT '',
      payment_code TEXT NOT NULL DEFAULT '',
      payment_key_present INTEGER NOT NULL DEFAULT 0,
      value REAL,
      currency TEXT NOT NULL DEFAULT 'KRW',
      payment_status TEXT NOT NULL DEFAULT '',
      payment_status_source TEXT NOT NULL DEFAULT '',
      payment_decision_branch TEXT NOT NULL DEFAULT '',
      payment_decision_reason TEXT NOT NULL DEFAULT '',
      payment_decision_matched_by TEXT NOT NULL DEFAULT '',
      tiktok_evidence_present INTEGER NOT NULL DEFAULT 0,
      tiktok_evidence_type TEXT NOT NULL DEFAULT '',
      has_ttclid INTEGER NOT NULL DEFAULT 0,
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      referrer_host TEXT NOT NULL DEFAULT '',
      pii_in_payload INTEGER NOT NULL DEFAULT 0,
      block_reasons_json TEXT NOT NULL DEFAULT '[]',
      payload_preview_json TEXT NOT NULL DEFAULT '{}',
      source_refs_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      first_observed_at TEXT NOT NULL DEFAULT '',
      last_evaluated_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tiktok_events_api_shadow_candidate
      ON ${SHADOW_TABLE}(site, event_name, server_event_id_candidate);
    CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_order_code
      ON ${SHADOW_TABLE}(order_code);
    CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_order_no
      ON ${SHADOW_TABLE}(order_no);
    CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_eligible
      ON ${SHADOW_TABLE}(eligible_for_future_send);
    CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_evaluated_at
      ON ${SHADOW_TABLE}(last_evaluated_at DESC);
  `);
};

export const upsertTikTokEventsApiShadowCandidates = (
  candidates: TikTokEventsApiShadowCandidate[],
  db: Database.Database = getCrmDb(),
) => {
  if (candidates.some((candidate) => candidate.sendCandidate !== false)) {
    throw new Error("TikTok Events API shadow candidates must keep sendCandidate=false");
  }
  if (candidates.some((candidate) => candidate.platformSendStatus !== "not_sent")) {
    throw new Error("TikTok Events API shadow candidates must keep platformSendStatus=not_sent");
  }
  ensureTikTokEventsApiShadowCandidateSchema(db);
  const stmt = db.prepare(`
    INSERT INTO ${SHADOW_TABLE} (
      candidate_id, site, source_system, candidate_version, evaluation_mode,
      send_candidate, eligible_for_future_send, platform_send_status,
      event_name, browser_event_name, pixel_code, raw_order_code, guard_raw_event_id,
      browser_event_id_observed, browser_event_id_source, server_event_id_candidate,
      dedup_ready, dedup_block_reason, order_code, order_no, order_id, payment_code,
      payment_key_present, value, currency, payment_status, payment_status_source,
      payment_decision_branch, payment_decision_reason, payment_decision_matched_by,
      tiktok_evidence_present, tiktok_evidence_type, has_ttclid, utm_source,
      utm_medium, utm_campaign, utm_content, referrer_host, pii_in_payload,
      block_reasons_json, payload_preview_json, source_refs_json, metadata_json,
      first_observed_at, last_evaluated_at, updated_at
    ) VALUES (
      @candidate_id, @site, @source_system, @candidate_version, @evaluation_mode,
      @send_candidate, @eligible_for_future_send, @platform_send_status,
      @event_name, @browser_event_name, @pixel_code, @raw_order_code, @guard_raw_event_id,
      @browser_event_id_observed, @browser_event_id_source, @server_event_id_candidate,
      @dedup_ready, @dedup_block_reason, @order_code, @order_no, @order_id, @payment_code,
      @payment_key_present, @value, @currency, @payment_status, @payment_status_source,
      @payment_decision_branch, @payment_decision_reason, @payment_decision_matched_by,
      @tiktok_evidence_present, @tiktok_evidence_type, @has_ttclid, @utm_source,
      @utm_medium, @utm_campaign, @utm_content, @referrer_host, @pii_in_payload,
      @block_reasons_json, @payload_preview_json, @source_refs_json, @metadata_json,
      @first_observed_at, @last_evaluated_at, @updated_at
    )
    ON CONFLICT(site, event_name, server_event_id_candidate) DO UPDATE SET
      source_system = excluded.source_system,
      candidate_version = excluded.candidate_version,
      evaluation_mode = excluded.evaluation_mode,
      send_candidate = 0,
      eligible_for_future_send = excluded.eligible_for_future_send,
      platform_send_status = 'not_sent',
      browser_event_name = excluded.browser_event_name,
      pixel_code = excluded.pixel_code,
      raw_order_code = excluded.raw_order_code,
      guard_raw_event_id = excluded.guard_raw_event_id,
      browser_event_id_observed = excluded.browser_event_id_observed,
      browser_event_id_source = excluded.browser_event_id_source,
      dedup_ready = excluded.dedup_ready,
      dedup_block_reason = excluded.dedup_block_reason,
      order_code = excluded.order_code,
      order_no = excluded.order_no,
      order_id = excluded.order_id,
      payment_code = excluded.payment_code,
      payment_key_present = excluded.payment_key_present,
      value = excluded.value,
      currency = excluded.currency,
      payment_status = excluded.payment_status,
      payment_status_source = excluded.payment_status_source,
      payment_decision_branch = excluded.payment_decision_branch,
      payment_decision_reason = excluded.payment_decision_reason,
      payment_decision_matched_by = excluded.payment_decision_matched_by,
      tiktok_evidence_present = excluded.tiktok_evidence_present,
      tiktok_evidence_type = excluded.tiktok_evidence_type,
      has_ttclid = excluded.has_ttclid,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      referrer_host = excluded.referrer_host,
      pii_in_payload = excluded.pii_in_payload,
      block_reasons_json = excluded.block_reasons_json,
      payload_preview_json = excluded.payload_preview_json,
      source_refs_json = excluded.source_refs_json,
      metadata_json = excluded.metadata_json,
      first_observed_at = excluded.first_observed_at,
      last_evaluated_at = excluded.last_evaluated_at,
      updated_at = excluded.updated_at
  `);
  const runMany = db.transaction((items: TikTokEventsApiShadowCandidate[]) => {
    let changed = 0;
    for (const candidate of items) {
      const result = stmt.run({
        candidate_id: candidate.candidateId,
        site: candidate.site,
        source_system: candidate.sourceSystem,
        candidate_version: candidate.candidateVersion,
        evaluation_mode: candidate.evaluationMode,
        send_candidate: 0,
        eligible_for_future_send: candidate.eligibleForFutureSend ? 1 : 0,
        platform_send_status: candidate.platformSendStatus,
        event_name: candidate.eventName,
        browser_event_name: candidate.browserEventName,
        pixel_code: candidate.pixelCode,
        raw_order_code: candidate.rawOrderCode,
        guard_raw_event_id: candidate.guardRawEventId,
        browser_event_id_observed: candidate.browserEventIdObserved,
        browser_event_id_source: candidate.browserEventIdSource,
        server_event_id_candidate: candidate.serverEventIdCandidate,
        dedup_ready: candidate.dedupReady ? 1 : 0,
        dedup_block_reason: candidate.dedupBlockReason,
        order_code: candidate.orderCode,
        order_no: candidate.orderNo,
        order_id: candidate.orderId,
        payment_code: candidate.paymentCode,
        payment_key_present: candidate.paymentKeyPresent ? 1 : 0,
        value: candidate.value,
        currency: candidate.currency,
        payment_status: candidate.paymentStatus,
        payment_status_source: candidate.paymentStatusSource,
        payment_decision_branch: candidate.paymentDecisionBranch,
        payment_decision_reason: candidate.paymentDecisionReason,
        payment_decision_matched_by: candidate.paymentDecisionMatchedBy,
        tiktok_evidence_present: candidate.tiktokEvidencePresent ? 1 : 0,
        tiktok_evidence_type: candidate.tiktokEvidenceType,
        has_ttclid: candidate.hasTtclid ? 1 : 0,
        utm_source: candidate.utmSource,
        utm_medium: candidate.utmMedium,
        utm_campaign: candidate.utmCampaign,
        utm_content: candidate.utmContent,
        referrer_host: candidate.referrerHost,
        pii_in_payload: candidate.piiInPayload ? 1 : 0,
        block_reasons_json: JSON.stringify(candidate.blockReasons),
        payload_preview_json: JSON.stringify(candidate.payloadPreview),
        source_refs_json: JSON.stringify(candidate.sourceRefs),
        metadata_json: JSON.stringify(candidate.metadata),
        first_observed_at: candidate.firstObservedAt,
        last_evaluated_at: candidate.lastEvaluatedAt,
        updated_at: candidate.lastEvaluatedAt,
      });
      changed += Number(result.changes ?? 0);
    }
    return changed;
  });
  return runMany(candidates);
};

export const countTikTokEventsApiShadowCandidates = (db: Database.Database = getCrmDb()) => {
  ensureTikTokEventsApiShadowCandidateSchema(db);
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${SHADOW_TABLE}`).get() as { count: number };
  return row.count;
};
