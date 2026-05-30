import path from "node:path";

import Database from "better-sqlite3";

import { queryPg } from "./postgres";

export const DEFAULT_NPAY_ROAS_DRY_RUN_START = "2026-04-27T09:10:00.000Z";

export type NpayRoasDryRunOrderStatus =
  | "strong_match"
  | "ambiguous"
  | "purchase_without_intent";

export type NpayRoasDryRunStrongGrade = "A" | "B";

export type NpayRoasDryRunGa4Presence = "present" | "robust_absent" | "absent" | "unknown";

export type NpayRoasDryRunOrderLabel = string;

export type NpayRoasDryRunIntentStatus =
  | "clicked_purchased_candidate"
  | "clicked_no_purchase"
  | "intent_pending";

export type NpayEnteredNotCompletedBreakdown = {
  total: number;
  pendingWindow: number;
  loginGatePossible: number;
  checkoutOpenedPossible: number;
  matchingGapPossible: number;
};

type SqliteIntentRow = {
  id: string;
  intent_key: string;
  site: string;
  source: string;
  environment: string;
  match_status: string;
  captured_at: string;
  received_at: string;
  client_id: string;
  ga_cookie_raw: string | null;
  ga_session_id: string;
  ga_session_number: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbp: string;
  fbc: string;
  fbclid: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  page_location: string;
  page_referrer: string;
  npay_bridge_url_hash?: string | null;
  npay_bridge_host?: string | null;
  npay_bridge_path_hash?: string | null;
  npay_bridge_observed_at?: string | null;
  product_idx: string;
  product_name: string;
  product_price: number | null;
  member_code: string;
  member_hash: string;
  phone_hash: string;
  email_hash: string;
  duplicate_count: number;
};

type PgNpayOrderRow = {
  orderNumber: string;
  channelOrderNo: string | null;
  paidAt: string;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: string | number | null;
  orderItemTotal: string | number | null;
  deliveryPrice: string | number | null;
  discountAmount: string | number | null;
  quantity: string | number | null;
  productNames: string;
  lineProductCount: string | number | null;
};

type SqliteImwebOrderBridgeRow = {
  order_no: string;
  channel_order_no: string | null;
  order_time: string | null;
  complete_time?: string | null;
  complete_time_unix?: number | null;
  payment_amount: number | null;
  total_price: number | null;
  delivery_price?: number | null;
  coupon_amount?: number | null;
  pay_type: string | null;
  pg_type?: string | null;
  raw_json?: string | null;
  imweb_status?: string | null;
  synced_at: string | null;
};

export type NpayRoasDryRunIntent = {
  id: string;
  intentKey: string;
  capturedAt: string;
  site: string;
  source: string;
  environment: string;
  matchStatus: string;
  clientId: string;
  gaSessionId: string;
  gaSessionNumber: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbp: string;
  fbc: string;
  fbclid: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  pageLocation: string;
  pageReferrer: string;
  npayBridgeUrlHash: string;
  npayBridgeHost: string;
  npayBridgePathHash: string;
  npayBridgeObservedAt: string;
  productIdx: string;
  productName: string;
  productPrice: number | null;
  memberCode: string;
  memberHash: string;
  phoneHash: string;
  emailHash: string;
  duplicateCount: number;
};

export type NpayRoasDryRunOrder = {
  orderNumber: string;
  channelOrderNo: string;
  orderCreatedAt: string;
  orderBridgeSource: "vm_imweb_orders" | "none";
  orderBridgePaymentAmount: number | null;
  paidAtBasis?: "operational_payment_complete_time" | "operational_order_date" | "vm_complete_time" | "vm_payment_time" | "manual";
  paidAt: string;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number | null;
  orderItemTotal: number | null;
  deliveryPrice: number | null;
  discountAmount: number | null;
  quantity: number;
  productNames: string[];
  lineProductCount: number;
};

export type NpayRoasDryRunManualOrderInput = {
  orderNumber: string;
  channelOrderNo?: string;
  paidAt: string;
  orderAmount: number;
  productName: string;
  orderItemTotal?: number;
  deliveryPrice?: number;
  discountAmount?: number;
  quantity?: number;
  paymentMethod?: string;
  paymentStatus?: string;
};

export type NpayRoasDryRunAmountMatchType =
  | "final_exact"
  | "item_exact"
  | "shipping_reconciled"
  | "discount_reconciled"
  | "quantity_reconciled"
  | "bundle_multiple_reconciled"
  | "cart_contains_item"
  | "near"
  | "none"
  | "unknown";

export type NpayRoasDryRunAmountMismatchCategory =
  | "matched_or_reconciled"
  | "quantity"
  | "cart_multi_item"
  | "set_or_bundle"
  | "coupon_shipping"
  | "insufficient_item_data"
  | "unknown";

export type NpayRoasDryRunAmountMismatchDiagnosis = {
  category: NpayRoasDryRunAmountMismatchCategory;
  label: string;
  plain: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
};

export type NpayRoasDryRunOrderCreateTimeBridge = "exact" | "near" | "weak" | "none" | "missing";

const AMOUNT_MATCH_TYPES: NpayRoasDryRunAmountMatchType[] = [
  "final_exact",
  "item_exact",
  "shipping_reconciled",
  "discount_reconciled",
  "quantity_reconciled",
  "bundle_multiple_reconciled",
  "cart_contains_item",
  "near",
  "none",
  "unknown",
];

const GRADE_A_AMOUNT_MATCH_TYPES = new Set<NpayRoasDryRunAmountMatchType>([
  "final_exact",
  "shipping_reconciled",
  "discount_reconciled",
  "quantity_reconciled",
  "bundle_multiple_reconciled",
]);

export type NpayRoasDryRunBreakdownRow = {
  key: string;
  count: number;
  sharePct: number;
};

export type NpayRoasDryRunProductBreakdownRow = NpayRoasDryRunBreakdownRow & {
  productIdx: string;
  productName: string;
};

export type NpayRoasDryRunReasonBreakdownRow = NpayRoasDryRunBreakdownRow & {
  orderNumbers: string[];
};

export type NpayRoasDryRunCandidate = {
  intentId: string;
  intentKey: string;
  source: string;
  capturedAt: string;
  timeGapMinutes: number;
  score: number;
  scoreComponents: {
    time: number;
    orderCreateTime: number;
    productName: number;
    amount: number;
    identity: number;
    session: number;
    adKey: number;
  };
  orderCreatedAt: string;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: NpayRoasDryRunOrderCreateTimeBridge;
  productIdx: string;
  orderProductIdx: null;
  productIdxMatch: null;
  productIdxMatchBasis: "order_product_idx_unavailable";
  productName: string;
  productNameMatch: boolean;
  productNameMatchType: "exact" | "contains" | "token_overlap" | "none";
  productPrice: number | null;
  orderAmount: number | null;
  intentProductPrice: number | null;
  orderItemTotal: number | null;
  deliveryPrice: number | null;
  orderPaymentAmount: number | null;
  amountDelta: number | null;
  amountMatch: boolean;
  amountMatchType: NpayRoasDryRunAmountMatchType;
  amountReconcileReason: string;
  amountMismatchCategory: NpayRoasDryRunAmountMismatchCategory;
  amountMismatchLabel: string;
  amountMismatchPlain: string;
  amountMismatchConfidence: NpayRoasDryRunAmountMismatchDiagnosis["confidence"];
  amountMismatchSignals: string[];
  clientId: string;
  gaSessionId: string;
  clientIdPresent: boolean;
  gaSessionIdPresent: boolean;
  gaSessionNumberPresent: boolean;
  adClickKeyPresent: boolean;
  adClickKeys: string[];
  memberKeyPresent: boolean;
  npayBridgeUrlHashPresent: boolean;
  npayBridgeHost: string;
  npayBridgePathHashPresent: boolean;
  npayBridgeObservedAt: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
  };
  pageLocation: string;
};

export type NpayRoasDryRunGa4PayloadPreview = {
  orderNumber: string;
  channelOrderNo: string;
  paidAt: string;
  paidAtAgeHours: number | null;
  paidAtWithin72Hours: boolean;
  matchedIntentId: string | null;
  clientId: string;
  gaSessionId: string;
  clientIdPresent: boolean;
  gaSessionIdPresent: boolean;
  value: number | null;
  currency: "KRW";
  transactionId: string;
  channelOrderNoParam: string;
  timestampMicros: string | null;
  eventId: string;
  dispatchDedupeKey: string;
  alreadyInGa4: NpayRoasDryRunGa4Presence;
  sendCandidate: boolean;
  blockReason: string[];
};

export type NpayRoasDryRunOrderResult = {
  order: NpayRoasDryRunOrder;
  orderLabel: NpayRoasDryRunOrderLabel;
  ga4LookupIds: string[];
  status: NpayRoasDryRunOrderStatus;
  strongGrade: NpayRoasDryRunStrongGrade | null;
  sendAllowed: false;
  dispatcherDryRun: {
    candidate: boolean;
    dryRunOnly: true;
    alreadyInGa4: NpayRoasDryRunGa4Presence;
    blockReasons: string[];
  };
  ga4PayloadPreview: NpayRoasDryRunGa4PayloadPreview;
  bestCandidate: NpayRoasDryRunCandidate | null;
  secondCandidate: NpayRoasDryRunCandidate | null;
  bestScore: number | null;
  secondScore: number | null;
  scoreGap: number | null;
  candidateCount: number;
  candidates: NpayRoasDryRunCandidate[];
  ambiguousReasons: string[];
};

export type NpayRoasDryRunIntentResult = {
  intent: NpayRoasDryRunIntent;
  status: NpayRoasDryRunIntentStatus;
  candidateOrderNumbers: string[];
  bestOrderNumber: string | null;
  bestScore: number | null;
};

export type NpayRoasDryRunReport = {
  ok: true;
  mode: "dry_run_read_only";
  generatedAt: string;
  source: {
    intents: string;
    orders: string;
  };
  window: {
    start: string;
    end: string;
    site: string;
    noPurchaseGraceHours: number;
    clickedNoPurchaseCutoffAt: string;
  };
  thresholds: {
    strongScoreThreshold: number;
    minScoreGap: number;
    gradeA: {
      minScore: number;
      requiredAmountMatchType: "final_or_reconciled";
      maxTimeGapMinutes: number;
      minScoreGap: number;
    };
    maxCandidateLookbackHours: number;
  };
  summary: {
    liveIntentCount: number;
    confirmedNpayOrderCount: number;
    strongMatch: number;
    strongMatchA: number;
    strongMatchB: number;
    ambiguous: number;
    purchaseWithoutIntent: number;
    dispatcherDryRunCandidate: number;
    alreadyInGa4Blocked: number;
    alreadyInGa4LookupPresent: number;
    alreadyInGa4LookupRobustAbsent: number;
    alreadyInGa4LookupAbsent: number;
    alreadyInGa4LookupUnknown: number;
    ga4LookupRequiredOrderCount: number;
    ga4LookupIdCount: number;
    testOrderBlocked: number;
    manualOrderCount: number;
    amountMatchTypeCounts: Record<NpayRoasDryRunAmountMatchType, number>;
    shippingReconciledCount: number;
    shippingReconciledNotGradeACount: number;
    orderCreateBridgeExact: number;
    orderCreateBridgeExactWithGoogleClickId: number;
    orderCreateBridgeMissing: number;
    clickedPurchasedCandidate: number;
    clickedNoPurchase: number;
    intentPending: number;
  };
  orderResults: NpayRoasDryRunOrderResult[];
  intentResults: NpayRoasDryRunIntentResult[];
  breakdowns: {
    ambiguousReasons: NpayRoasDryRunReasonBreakdownRow[];
    clickedNoPurchase: {
      byProduct: NpayRoasDryRunProductBreakdownRow[];
      byAdKey: NpayRoasDryRunBreakdownRow[];
      byKstHour: NpayRoasDryRunBreakdownRow[];
    };
  };
  notes: string[];
};

export type NpayIntentRematchDryRunClickIds = {
  gclid: string;
  gbraid: string;
  wbraid: string;
  googleClickIdTypes: Array<"gclid" | "gbraid" | "wbraid">;
  hasGoogleClickId: boolean;
};

export type NpayIntentRematchDateDistributionRow = {
  dateKst: string;
  completedOrders: number;
  amountKrw: number;
  strongMatch: number;
  gradeA: number;
  gradeB: number;
  ambiguous: number;
  purchaseWithoutIntent: number;
  googleLikeCompletedOrders: number;
  googleClickIdCompletedOrders: number;
};

export type NpayIntentSourceFunnelChannel = "google" | "meta" | "other";

export type NpayIntentSourceFunnelRow = {
  channel: NpayIntentSourceFunnelChannel;
  label: string;
  intentCount: number;
  bridgeOpenedIntentCount: number;
  googleClickIdIntentCount: number;
  completedOrders: number;
  completedAmountKrw: number;
  completionRatePct: number;
  plain: string;
};

export type NpayIntentRematchDryRunCandidate = {
  orderNumber: string;
  channelOrderNo: string;
  paidAt: string;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number | null;
  intentId: string;
  intentKey: string;
  intentCapturedAt: string;
  currentIntentMatchStatus: string;
  nextIntentMatchStatusPreview: "matched";
  matchedOrderNoPreview: string;
  matchedChannelOrderNoPreview: string;
  score: number;
  scoreGap: number | null;
  strongGrade: NpayRoasDryRunStrongGrade | null;
  amountMatchType: NpayRoasDryRunAmountMatchType;
  amountReconcileReason: string;
  amountMismatchCategory: NpayRoasDryRunAmountMismatchCategory;
  amountMismatchLabel: string;
  amountMismatchPlain: string;
  amountMismatchConfidence: NpayRoasDryRunAmountMismatchDiagnosis["confidence"];
  amountMismatchSignals: string[];
  timeGapMinutes: number;
  orderCreatedAt: string;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: NpayRoasDryRunOrderCreateTimeBridge;
  productIdx: string;
  productName: string;
  clientId: string;
  gaSessionId: string;
  pageLocation: string;
  npayBridgeUrlHashPresent: boolean;
  npayBridgeHost: string;
  npayBridgePathHashPresent: boolean;
  npayBridgeObservedAt: string;
  gadCampaignId: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
  };
  clickIds: NpayIntentRematchDryRunClickIds;
  recommendedAction:
    | "safe_apply_candidate_after_write_approval"
    | "manual_review_before_apply"
    | "review_but_no_google_click_id"
    | "skip_non_pending_intent";
  blockReasons: string[];
};

export type NpayIntentRematchUnresolvedRow = {
  orderNumber: string;
  channelOrderNo: string;
  status: NpayRoasDryRunOrderStatus;
  strongGrade: NpayRoasDryRunStrongGrade | null;
  paidAt: string;
  paidAtBasis: NpayRoasDryRunOrder["paidAtBasis"] | null;
  orderCreatedAt: string;
  orderAmount: number | null;
  orderItemTotal: number | null;
  deliveryPrice: number | null;
  discountAmount: number | null;
  quantity: number;
  productNames: string[];
  bestIntentCapturedAt: string;
  bestIntentProductPrice: number | null;
  bestIntentSourceChannel: NpayIntentSourceFunnelChannel;
  bestIntentSourceLabel: string;
  bestIntentHasGoogleClickId: boolean;
  bestIntentHasNpayBridgeUrlHash: boolean;
  bestIntentBridgeHost: string;
  timeGapMinutes: number | null;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: NpayRoasDryRunOrderCreateTimeBridge | null;
  amountMatchType: NpayRoasDryRunAmountMatchType | "none_candidate";
  amountReconcileReason: string;
  amountMismatchCategory: NpayRoasDryRunAmountMismatchCategory | "no_candidate_intent";
  amountMismatchLabel: string;
  amountMismatchPlain: string;
  amountMismatchConfidence: NpayRoasDryRunAmountMismatchDiagnosis["confidence"];
  amountMismatchSignals: string[];
  score: number | null;
  scoreGap: number | null;
  candidateCount: number;
  ambiguousReasons: string[];
  availableFacts: string[];
  missingFacts: string[];
  proposedFix: string;
};

export type NpayIntentRematchUnresolvedReasonBreakdownRow = {
  reason: string;
  label: string;
  completedOrders: number;
  sharePct: number;
  sampleOrderCount: number;
  plain: string;
};

export type NpayIntentRematchDryRunReport = {
  ok: true;
  mode: "npay_intent_rematch_dry_run_read_only";
  generatedAt: string;
  source: NpayRoasDryRunReport["source"];
  window: NpayRoasDryRunReport["window"];
  thresholds: NpayRoasDryRunReport["thresholds"];
  noWrite: true;
  noSend: true;
  rawIdentifierOutput: boolean;
  summary: {
    liveIntentCount: number;
    googleLikeIntentCount: number;
    googleLikeIntentWithGoogleClickId: number;
    liveIntentWithNpayBridgeUrlHash: number;
    googleLikeIntentWithNpayBridgeUrlHash: number;
    enteredNotCompletedBreakdown: NpayEnteredNotCompletedBreakdown;
    googleClickIdIntentCount: number;
    googleClickIdIntentBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
    confirmedNpayOrderCount: number;
    strongMatch: number;
    pendingStrongMatch: number;
    pendingStrongMatchWithGoogleClickId: number;
    pendingGradeA: number;
    pendingGradeB: number;
    pendingOrderCreateBridgeExact: number;
    pendingOrderCreateBridgeExactWithGoogleClickId: number;
    strongMatchWithNpayBridgeUrlHash: number;
    gradeAWithNpayBridgeUrlHash: number;
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash: number;
    googleLikeCompletedOrders: number;
    googleLikeCompletedAmountKrw: number;
    googleLikeCompletedWithDirectGoogleClickId: number;
    blockedNonPendingIntent: number;
    ambiguous: number;
    purchaseWithoutIntent: number;
    uploadCandidateCount: 0;
    platformSendCandidateCount: 0;
  };
  candidates: NpayIntentRematchDryRunCandidate[];
  blocked: NpayIntentRematchDryRunCandidate[];
  ambiguousReasonBreakdown: NpayRoasDryRunReasonBreakdownRow[];
  dateDistribution: NpayIntentRematchDateDistributionRow[];
  sourceFunnelComparison: NpayIntentSourceFunnelRow[];
  unresolvedRows: NpayIntentRematchUnresolvedRow[];
  unresolvedReasonBreakdown: NpayIntentRematchUnresolvedReasonBreakdownRow[];
  notes: string[];
};

export type NpayRoasDryRunOptions = {
  start?: string;
  end?: string;
  site?: string;
  sqlitePath?: string;
  now?: Date;
  noPurchaseGraceHours?: number;
  strongScoreThreshold?: number;
  minScoreGap?: number;
  gradeAMinScore?: number;
  gradeAMaxTimeGapMinutes?: number;
  gradeAMinScoreGap?: number;
  maxCandidateLookbackHours?: number;
  maxCandidatesPerOrder?: number;
  ga4PresentOrderNumbers?: string[];
  ga4RobustAbsentOrderNumbers?: string[];
  ga4AbsentOrderNumbers?: string[];
  testOrderNumbers?: string[];
  testOrderLabel?: string;
  orderNumbers?: string[];
  manualOrders?: NpayRoasDryRunManualOrderInput[];
};

export type NpayIntentRematchDryRunOptions = NpayRoasDryRunOptions & {
  includeOnlyPending?: boolean;
  includeRawClickIds?: boolean;
  limit?: number;
};

const numberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJsonRecord = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const nestedRecord = (source: Record<string, unknown>, key: string) => {
  const value = source[key];
  return isRecord(value) ? value : {};
};

const textValue = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const unixSecondsToIso = (value: unknown) => {
  const parsed = numberValue(value);
  if (!parsed || parsed <= 0) return "";
  const date = new Date(parsed * 1000);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const sqliteColumns = (db: Database.Database, table: string) => {
  try {
    return new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name),
    );
  } catch {
    return new Set<string>();
  }
};

const optionalColumnSelect = (columns: Set<string>, column: string) =>
  columns.has(column) ? column : `'' AS ${column}`;

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const isPlainDateTimeWithoutZone = (value: string) =>
  /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(value.trim());

const parseDateInput = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00+09:00`
    : isPlainDateTimeWithoutZone(trimmed)
    ? `${trimmed.replace(" ", "T")}+09:00`
    : trimmed.replace(/\s*KST$/i, "+09:00");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid dry-run date: ${value}`);
  }
  return parsed;
};

const resolveSqlitePath = (explicitPath?: string) =>
  explicitPath ||
  process.env.NPAY_INTENT_DB_PATH ||
  process.env.CRM_LOCAL_DB_PATH ||
  path.join(__dirname, "..", "data", "crm.sqlite3");

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[()（）]/g, " ")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitProductNames = (value: string) =>
  value
    .split(/\s*\+\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

const roundOne = (value: number) => Math.round(value * 10) / 10;

const hasAny = (...values: string[]) => values.some((value) => Boolean(value.trim()));

const normalizeOrderNumberSet = (values: string[] | undefined) =>
  new Set(
    (values ?? [])
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );

const uniqueNonEmpty = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const queryParamFromUrlLike = (urlLike: string, key: string) => {
  if (!urlLike) return "";
  try {
    return new URL(urlLike, "https://biocom.kr").searchParams.get(key)?.trim() || "";
  } catch {
    const match = urlLike.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"));
    if (!match?.[1]) return "";
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
};

const extractGadCampaignIdFromUrlLike = (urlLike: string) =>
  queryParamFromUrlLike(urlLike, "gad_campaignid").replace(/[^\d]/g, "");

const buildGa4LookupIds = (order: NpayRoasDryRunOrder) =>
  uniqueNonEmpty([order.orderNumber, order.channelOrderNo]);

const resolveGa4Presence = (
  lookupIds: string[],
  presentIds: Set<string>,
  robustAbsentIds: Set<string>,
  absentIds: Set<string>,
): NpayRoasDryRunGa4Presence => {
  if (lookupIds.some((id) => presentIds.has(id))) return "present";
  if (lookupIds.length > 0 && lookupIds.every((id) => robustAbsentIds.has(id))) return "robust_absent";
  if (lookupIds.length > 0 && lookupIds.every((id) => absentIds.has(id))) return "absent";
  return "unknown";
};

const timestampMicros = (iso: string) => {
  const millis = Date.parse(iso);
  if (!Number.isFinite(millis)) return null;
  return String(millis * 1000);
};

const buildGa4PayloadPreview = (
  order: NpayRoasDryRunOrder,
  bestCandidate: NpayRoasDryRunCandidate | null,
  dispatcherDryRun: NpayRoasDryRunOrderResult["dispatcherDryRun"],
  now: Date,
  site: string,
): NpayRoasDryRunGa4PayloadPreview => ({
  orderNumber: order.orderNumber,
  channelOrderNo: order.channelOrderNo,
  paidAt: order.paidAt,
  paidAtAgeHours: Number.isFinite(Date.parse(order.paidAt))
    ? roundOne((now.getTime() - Date.parse(order.paidAt)) / 3_600_000)
    : null,
  paidAtWithin72Hours:
    Number.isFinite(Date.parse(order.paidAt)) &&
    now.getTime() >= Date.parse(order.paidAt) &&
    now.getTime() - Date.parse(order.paidAt) <= 72 * 3_600_000,
  matchedIntentId: bestCandidate?.intentId ?? null,
  clientId: bestCandidate?.clientId ?? "",
  gaSessionId: bestCandidate?.gaSessionId ?? "",
  clientIdPresent: Boolean(bestCandidate?.clientId),
  gaSessionIdPresent: Boolean(bestCandidate?.gaSessionId),
  value: order.orderAmount,
  currency: "KRW",
  transactionId: order.orderNumber,
  channelOrderNoParam: order.channelOrderNo,
  timestampMicros: timestampMicros(order.paidAt),
  eventId: `NPayRecoveredPurchase_${order.orderNumber}`,
  dispatchDedupeKey: `npay_recovery_ga4_purchase:${site}:${order.orderNumber}`,
  alreadyInGa4: dispatcherDryRun.alreadyInGa4,
  sendCandidate: dispatcherDryRun.candidate,
  blockReason: [...dispatcherDryRun.blockReasons],
});

const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 10_000) / 100 : 0;

const adKeyCombo = (intent: NpayRoasDryRunIntent) => {
  const keys = [
    intent.gclid ? "gclid" : "",
    intent.gbraid ? "gbraid" : "",
    intent.wbraid ? "wbraid" : "",
    intent.fbclid ? "fbclid" : "",
    intent.fbc ? "fbc" : "",
    intent.fbp ? "fbp" : "",
  ].filter(Boolean);
  return keys.length > 0 ? keys.join("+") : "none";
};

const kstHour = (iso: string) => {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  const hour = String(kst.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00 KST`;
};

const kstDateOnly = (iso: string) => {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sortBreakdown = <T extends NpayRoasDryRunBreakdownRow>(rows: T[]) =>
  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });

const buildClickedNoPurchaseBreakdown = (intentResults: NpayRoasDryRunIntentResult[]) => {
  const clickedNoPurchase = intentResults.filter((result) => result.status === "clicked_no_purchase");
  const total = clickedNoPurchase.length;
  const productMap = new Map<string, NpayRoasDryRunProductBreakdownRow>();
  const adKeyMap = new Map<string, number>();
  const hourMap = new Map<string, number>();

  for (const result of clickedNoPurchase) {
    const intent = result.intent;
    const productKey = `${intent.productIdx || "unknown"}|${intent.productName || "unknown"}`;
    const product = productMap.get(productKey) ?? {
      key: productKey,
      productIdx: intent.productIdx || "unknown",
      productName: intent.productName || "unknown",
      count: 0,
      sharePct: 0,
    };
    product.count += 1;
    productMap.set(productKey, product);

    const adKey = adKeyCombo(intent);
    adKeyMap.set(adKey, (adKeyMap.get(adKey) ?? 0) + 1);

    const hour = kstHour(intent.capturedAt);
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }

  const byProduct = sortBreakdown(
    Array.from(productMap.values()).map((row) => ({
      ...row,
      sharePct: percent(row.count, total),
    })),
  );
  const byAdKey = sortBreakdown(
    Array.from(adKeyMap.entries()).map(([key, count]) => ({
      key,
      count,
      sharePct: percent(count, total),
    })),
  );
  const byKstHour = Array.from(hourMap.entries())
    .map(([key, count]) => ({
      key,
      count,
      sharePct: percent(count, total),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { byProduct, byAdKey, byKstHour };
};

const buildAmbiguousReasonBreakdown = (
  orderResults: NpayRoasDryRunOrderResult[],
): NpayRoasDryRunReasonBreakdownRow[] => {
  const ambiguous = orderResults.filter((result) => result.status === "ambiguous");
  const total = ambiguous.length;
  const map = new Map<string, { count: number; orderNumbers: Set<string> }>();

  for (const result of ambiguous) {
    for (const reason of result.ambiguousReasons) {
      const current = map.get(reason) ?? { count: 0, orderNumbers: new Set<string>() };
      current.count += 1;
      current.orderNumbers.add(result.order.orderNumber);
      map.set(reason, current);
    }
  }

  return sortBreakdown(
    Array.from(map.entries()).map(([key, value]) => ({
      key,
      count: value.count,
      sharePct: percent(value.count, total),
      orderNumbers: Array.from(value.orderNumbers).sort(),
    })),
  );
};

const toIntent = (row: SqliteIntentRow): NpayRoasDryRunIntent => ({
  id: row.id,
  intentKey: row.intent_key,
  capturedAt: row.captured_at,
  site: row.site,
  source: row.source,
  environment: row.environment,
  matchStatus: row.match_status,
  clientId: row.client_id,
  gaSessionId: row.ga_session_id,
  gaSessionNumber: row.ga_session_number,
  gclid: row.gclid,
  gbraid: row.gbraid,
  wbraid: row.wbraid,
  fbp: row.fbp,
  fbc: row.fbc,
  fbclid: row.fbclid,
  utmSource: row.utm_source,
  utmMedium: row.utm_medium,
  utmCampaign: row.utm_campaign,
  pageLocation: row.page_location,
  pageReferrer: row.page_referrer,
  npayBridgeUrlHash: row.npay_bridge_url_hash ?? "",
  npayBridgeHost: row.npay_bridge_host ?? "",
  npayBridgePathHash: row.npay_bridge_path_hash ?? "",
  npayBridgeObservedAt: row.npay_bridge_observed_at ?? "",
  productIdx: row.product_idx,
  productName: row.product_name,
  productPrice: row.product_price,
  memberCode: row.member_code,
  memberHash: row.member_hash,
  phoneHash: row.phone_hash,
  emailHash: row.email_hash,
  duplicateCount: row.duplicate_count,
});

const toOrder = (row: PgNpayOrderRow): NpayRoasDryRunOrder => ({
  orderNumber: row.orderNumber,
  channelOrderNo: row.channelOrderNo?.trim() || "",
  orderCreatedAt: "",
  orderBridgeSource: "none",
  orderBridgePaymentAmount: null,
  paidAtBasis: "operational_payment_complete_time",
  paidAt: new Date(row.paidAt).toISOString(),
  paymentMethod: row.paymentMethod,
  paymentStatus: row.paymentStatus,
  orderAmount: numberValue(row.orderAmount),
  orderItemTotal: numberValue(row.orderItemTotal),
  deliveryPrice: numberValue(row.deliveryPrice),
  discountAmount: numberValue(row.discountAmount),
  quantity: parsePositiveInteger(row.quantity, 1),
  productNames: splitProductNames(row.productNames),
  lineProductCount: parsePositiveInteger(row.lineProductCount, 1),
});

const toManualOrder = (input: NpayRoasDryRunManualOrderInput): NpayRoasDryRunOrder => {
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error(`Invalid manual order paidAt: ${input.paidAt}`);
  }
  return {
    orderNumber: input.orderNumber.trim(),
    channelOrderNo: input.channelOrderNo?.trim() || "",
    orderCreatedAt: "",
    orderBridgeSource: "none",
    orderBridgePaymentAmount: null,
    paidAtBasis: "manual",
    paidAt: paidAt.toISOString(),
    paymentMethod: input.paymentMethod?.trim() || "NAVERPAY_ORDER",
    paymentStatus: input.paymentStatus?.trim() || "PAYMENT_COMPLETE",
    orderAmount: input.orderAmount,
    orderItemTotal: input.orderItemTotal ?? null,
    deliveryPrice: input.deliveryPrice ?? null,
    discountAmount: input.discountAmount ?? null,
    quantity: parsePositiveInteger(input.quantity, 1),
    productNames: splitProductNames(input.productName),
    lineProductCount: 1,
  };
};

const isNpayLoginGateHost = (host: string) =>
  host.trim().toLowerCase() === "nid.naver.com";

const isNpayCheckoutHost = (host: string) => {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "orders.pay.naver.com" ||
    normalized === "new-m.pay.naver.com" ||
    normalized === "m.pay.naver.com" ||
    normalized === "pay.naver.com"
  );
};

const buildEnteredNotCompletedBreakdown = ({
  bridgeHashIntents,
  matchedBridgeIntentIds,
}: {
  bridgeHashIntents: NpayRoasDryRunIntentResult[];
  matchedBridgeIntentIds: Set<string>;
}): NpayEnteredNotCompletedBreakdown => {
  const enteredNotCompleted = bridgeHashIntents.filter(
    (result) => !matchedBridgeIntentIds.has(result.intent.id),
  );
  const pendingWindow = enteredNotCompleted.filter((result) => result.status === "intent_pending").length;
  const clickedNoPurchase = enteredNotCompleted.filter((result) => result.status === "clicked_no_purchase");
  const loginGatePossible = clickedNoPurchase.filter((result) =>
    isNpayLoginGateHost(result.intent.npayBridgeHost),
  ).length;
  const checkoutOpenedPossible = clickedNoPurchase.filter((result) =>
    isNpayCheckoutHost(result.intent.npayBridgeHost),
  ).length;
  const matchingGapPossible = Math.max(
    0,
    enteredNotCompleted.length - pendingWindow - loginGatePossible - checkoutOpenedPossible,
  );

  return {
    total: enteredNotCompleted.length,
    pendingWindow,
    loginGatePossible,
    checkoutOpenedPossible,
    matchingGapPossible,
  };
};

const scoreTimeGap = (timeGapMinutes: number) => {
  if (timeGapMinutes < 0) return 0;
  if (timeGapMinutes <= 1) return 30;
  if (timeGapMinutes <= 15) return 20;
  if (timeGapMinutes <= 60) return 10;
  if (timeGapMinutes <= 24 * 60) return 2;
  return 0;
};

const scoreOrderCreateTimeBridge = (orderCreatedAt: string, capturedAt: string) => {
  if (!orderCreatedAt) {
    return {
      type: "missing" as const,
      score: 0,
      gapMinutes: null,
    };
  }

  const orderCreatedAtMs = Date.parse(orderCreatedAt);
  const capturedAtMs = Date.parse(capturedAt);
  if (!Number.isFinite(orderCreatedAtMs) || !Number.isFinite(capturedAtMs)) {
    return {
      type: "missing" as const,
      score: 0,
      gapMinutes: null,
    };
  }

  const gapMinutes = roundOne((orderCreatedAtMs - capturedAtMs) / 60_000);
  const absoluteGap = Math.abs(gapMinutes);

  if (absoluteGap <= 1) {
    return {
      type: "exact" as const,
      score: 35,
      gapMinutes,
    };
  }

  if (absoluteGap <= 5) {
    return {
      type: "near" as const,
      score: 25,
      gapMinutes,
    };
  }

  if (absoluteGap <= 15) {
    return {
      type: "weak" as const,
      score: 15,
      gapMinutes,
    };
  }

  return {
    type: "none" as const,
    score: 0,
    gapMinutes,
  };
};

const productNameMatch = (intentName: string, orderNames: string[]) => {
  const intent = normalizeText(intentName);
  const orders = orderNames.map(normalizeText).filter(Boolean);
  if (!intent || orders.length === 0) return { type: "none" as const, score: 0, matched: false };
  if (orders.some((orderName) => orderName === intent)) {
    return { type: "exact" as const, score: 30, matched: true };
  }
  if (orders.some((orderName) => orderName.includes(intent) || intent.includes(orderName))) {
    return { type: "contains" as const, score: 24, matched: true };
  }

  const intentTokens = new Set(intent.split(" ").filter((token) => token.length >= 2));
  const overlaps = orders.some((orderName) =>
    orderName
      .split(" ")
      .filter((token) => token.length >= 2)
      .some((token) => intentTokens.has(token)),
  );
  if (overlaps) return { type: "token_overlap" as const, score: 14, matched: true };
  return { type: "none" as const, score: 0, matched: false };
};

const moneyEqual = (left: number | null, right: number | null, tolerance = 0) => {
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= tolerance;
};

const nearestSmallIntegerMultiple = (numerator: number, denominator: number | null) => {
  if (!denominator || denominator <= 0 || !Number.isFinite(numerator)) return null;
  const ratio = numerator / denominator;
  const rounded = Math.round(ratio);
  if (rounded < 2 || rounded > 12) return null;
  const relativeGap = Math.abs(ratio - rounded) / Math.max(rounded, 1);
  return relativeGap <= 0.08 ? rounded : null;
};

const hasSetOrBundleKeyword = (values: string[]) =>
  /세트|set|bundle|패키지|묶음|구성|정기구독|구독|개월|종합|패밀리|starter|kit|package/i.test(
    values.join(" "),
  );

const buildAmountMismatchDiagnosis = (
  intentPrice: number | null,
  order: NpayRoasDryRunOrder,
  productMatched: boolean,
  amountType: NpayRoasDryRunAmountMatchType,
): NpayRoasDryRunAmountMismatchDiagnosis => {
  if (amountType !== "none" && amountType !== "unknown") {
    return {
      category: "matched_or_reconciled",
      label: "금액 설명됨",
      plain: "상품가, 배송비, 할인, 수량 또는 장바구니 규칙으로 이미 설명된 주문입니다.",
      confidence: "high",
      signals: [amountType],
    };
  }

  const orderPaymentAmount = order.orderAmount;
  const orderItemTotal = order.orderItemTotal;
  const deliveryPrice = order.deliveryPrice ?? 0;
  const discountAmount = order.discountAmount ?? 0;
  const productNames = order.productNames.filter(Boolean);
  const signals: string[] = [];

  if (!intentPrice || !orderPaymentAmount) {
    return {
      category: "insufficient_item_data",
      label: "정보부족",
      plain: "버튼 클릭 시점 상품가 또는 결제완료 주문금액이 없어 수량/배송비/세트 여부를 계산할 수 없습니다.",
      confidence: "high",
      signals: [
        intentPrice ? "intent_price_present" : "intent_price_missing",
        orderPaymentAmount ? "order_payment_amount_present" : "order_payment_amount_missing",
      ],
    };
  }

  const adjustedByShippingDiscount = orderPaymentAmount - deliveryPrice + discountAmount;
  const paymentMultiple = nearestSmallIntegerMultiple(orderPaymentAmount, intentPrice);
  const adjustedMultiple = nearestSmallIntegerMultiple(adjustedByShippingDiscount, intentPrice);
  const itemTotalMultiple = orderItemTotal !== null ? nearestSmallIntegerMultiple(orderItemTotal, intentPrice) : null;
  const likelyMultiple = adjustedMultiple ?? itemTotalMultiple ?? paymentMultiple;

  if (order.lineProductCount > 1) {
    signals.push(`product_lines=${order.lineProductCount}`);
    if (orderItemTotal !== null) signals.push(`item_total=${orderItemTotal}`);
    return {
      category: "cart_multi_item",
      label: "장바구니/복수상품",
      plain: "한 주문번호 안에 상품 row가 여러 개 있어, 버튼 클릭한 단일 상품 가격과 전체 장바구니 결제금액이 달라진 것으로 보입니다.",
      confidence: "high",
      signals,
    };
  }

  if (order.quantity > 1) {
    signals.push(`quantity=${order.quantity}`);
    if (likelyMultiple) signals.push(`price_multiple≈${likelyMultiple}`);
    return {
      category: "quantity",
      label: "수량",
      plain: "같은 상품을 여러 개 산 주문으로 보입니다. 버튼 클릭가 1개 가격과 실제 결제금액이 여러 개 수량 기준으로 달라졌을 가능성이 큽니다.",
      confidence: likelyMultiple ? "high" : "medium",
      signals,
    };
  }

  if (hasSetOrBundleKeyword(productNames) || (productMatched && likelyMultiple)) {
    if (likelyMultiple) signals.push(`price_multiple≈${likelyMultiple}`);
    if (hasSetOrBundleKeyword(productNames)) signals.push("set_or_bundle_keyword");
    return {
      category: "set_or_bundle",
      label: "세트상품/묶음",
      plain: "상품명 또는 금액 배수가 세트/묶음 상품처럼 보입니다. 단일 상품 클릭가와 실제 결제금액이 세트 구성 때문에 달라졌을 수 있습니다.",
      confidence: hasSetOrBundleKeyword(productNames) ? "high" : "medium",
      signals,
    };
  }

  const adjustedGap = Math.abs(adjustedByShippingDiscount - intentPrice);
  const paymentGap = Math.abs(orderPaymentAmount - intentPrice);
  const hasAdjustment = deliveryPrice > 0 || discountAmount > 0;
  const adjustmentExplainsMostGap =
    hasAdjustment && adjustedGap < paymentGap && adjustedGap <= Math.max(5000, intentPrice * 0.15);
  if (adjustmentExplainsMostGap) {
    if (deliveryPrice > 0) signals.push(`delivery=${deliveryPrice}`);
    if (discountAmount > 0) signals.push(`discount=${discountAmount}`);
    signals.push(`remaining_gap=${Math.round(adjustedGap)}`);
    return {
      category: "coupon_shipping",
      label: "쿠폰·배송비",
      plain: "상품가와 주문금액 차이의 대부분이 배송비나 쿠폰/포인트 할인으로 설명됩니다. 남은 차이만 추가 확인하면 됩니다.",
      confidence: adjustedGap <= 1000 ? "high" : "medium",
      signals,
    };
  }

  if (!productMatched || productNames.length === 0) {
    return {
      category: "insufficient_item_data",
      label: "정보부족",
      plain: "상품명이 정확히 맞지 않거나 주문 상품 정보가 부족해 금액 차이 원인을 안전하게 분류하지 못했습니다.",
      confidence: "medium",
      signals: [
        productMatched ? "product_matched" : "product_not_matched",
        productNames.length ? "order_product_name_present" : "order_product_name_missing",
      ],
    };
  }

  return {
    category: "unknown",
    label: "미분류 금액차",
    plain: "수량, 장바구니, 세트상품, 쿠폰·배송비 중 하나로 자동 확정하기에는 아직 증거가 부족합니다.",
    confidence: "low",
    signals: ["manual_amount_review_required"],
  };
};

const amountMatch = (
  intentPrice: number | null,
  order: NpayRoasDryRunOrder,
  productMatched: boolean,
) => {
  const orderPaymentAmount = order.orderAmount;
  const orderItemTotal = order.orderItemTotal;
  const deliveryPrice = order.deliveryPrice ?? 0;
  const discountAmount = order.discountAmount ?? 0;
  const quantity = order.quantity;
  const amountDelta =
    intentPrice !== null && orderPaymentAmount !== null ? orderPaymentAmount - intentPrice : null;

  if (!intentPrice || !orderPaymentAmount) {
    return {
      type: "unknown" as const,
      score: 0,
      matched: false,
      amountDelta,
      reason: "intent_product_price_or_order_payment_amount_missing",
    };
  }

  if (moneyEqual(intentPrice, orderPaymentAmount)) {
    return {
      type: "final_exact" as const,
      score: 20,
      matched: true,
      amountDelta,
      reason: "intent_product_price == order_payment_amount",
    };
  }

  const itemExact = moneyEqual(intentPrice, orderItemTotal);
  const paymentEqualsItemPlusShipping = moneyEqual(orderPaymentAmount, (orderItemTotal ?? 0) + deliveryPrice);
  const deltaEqualsShipping = moneyEqual(amountDelta, deliveryPrice);
  if (itemExact && (paymentEqualsItemPlusShipping || deltaEqualsShipping)) {
    return {
      type: "shipping_reconciled" as const,
      score: 20,
      matched: true,
      amountDelta,
      reason: "item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price",
    };
  }

  const discountedTotal = (orderItemTotal ?? 0) + deliveryPrice - discountAmount;
  if (orderItemTotal !== null && discountAmount > 0 && moneyEqual(orderPaymentAmount, discountedTotal)) {
    return {
      type: "discount_reconciled" as const,
      score: 18,
      matched: true,
      amountDelta,
      reason: "order_payment_amount == order_item_total + delivery_price - discount_amount",
    };
  }

  if (itemExact) {
    return {
      type: "item_exact" as const,
      score: 16,
      matched: true,
      amountDelta,
      reason: "intent_product_price == order_item_total",
    };
  }

  const quantityItemTotal = intentPrice * quantity;
  if (
    quantity > 1 &&
    (moneyEqual(orderItemTotal, quantityItemTotal) ||
      moneyEqual(orderPaymentAmount, quantityItemTotal + deliveryPrice - discountAmount))
  ) {
    return {
      type: "quantity_reconciled" as const,
      score: 18,
      matched: true,
      amountDelta,
      reason: "order amount reconciles with intent_product_price * quantity plus delivery/discount",
    };
  }

  if (productMatched && intentPrice > 0 && order.lineProductCount <= 1) {
    const itemTotalMultiple = orderItemTotal !== null ? orderItemTotal / intentPrice : 0;
    const paymentAmountMultiple = orderPaymentAmount / intentPrice;
    const isReasonableIntegerMultiple = (value: number) =>
      Number.isFinite(value) && Number.isInteger(value) && value >= 2 && value <= 6;

    if (isReasonableIntegerMultiple(itemTotalMultiple) || isReasonableIntegerMultiple(paymentAmountMultiple)) {
      return {
        type: "bundle_multiple_reconciled" as const,
        score: 18,
        matched: true,
        amountDelta,
        reason: "product exact match; order amount reconciles with intent_product_price as a small integer bundle multiple",
      };
    }
  }

  if (
    productMatched &&
    order.lineProductCount > 1 &&
    orderItemTotal !== null &&
    orderItemTotal >= intentPrice &&
    orderPaymentAmount >= intentPrice
  ) {
    return {
      type: "cart_contains_item" as const,
      score: 12,
      matched: true,
      amountDelta,
      reason: "cart_contains_item=true; order amount is cart total for multiple products",
    };
  }

  const diffRate = Math.abs(orderPaymentAmount - intentPrice) / Math.max(orderPaymentAmount, intentPrice);
  if (diffRate <= 0.05) {
    return {
      type: "near" as const,
      score: 8,
      matched: true,
      amountDelta,
      reason: "order_payment_amount is within 5% of intent_product_price",
    };
  }

  return {
    type: "none" as const,
    score: 0,
    matched: false,
    amountDelta,
    reason: "amount_not_reconciled",
  };
};

const buildCandidate = (
  order: NpayRoasDryRunOrder,
  intent: NpayRoasDryRunIntent,
): NpayRoasDryRunCandidate => {
  const paidAtMs = Date.parse(order.paidAt);
  const capturedAtMs = Date.parse(intent.capturedAt);
  const timeGapMinutes = roundOne((paidAtMs - capturedAtMs) / 60_000);
  const timeScore = scoreTimeGap(timeGapMinutes);
  const orderCreateTime = scoreOrderCreateTimeBridge(order.orderCreatedAt, intent.capturedAt);
  const productMatch = productNameMatch(intent.productName, order.productNames);
  const amount = amountMatch(intent.productPrice, order, productMatch.matched);
  const amountMismatch = buildAmountMismatchDiagnosis(
    intent.productPrice,
    order,
    productMatch.matched,
    amount.type,
  );
  const adClickKeys = [
    intent.gclid ? "gclid" : "",
    intent.gbraid ? "gbraid" : "",
    intent.wbraid ? "wbraid" : "",
    intent.fbclid ? "fbclid" : "",
    intent.fbc ? "fbc" : "",
    intent.fbp ? "fbp" : "",
  ].filter(Boolean);
  const memberKeyPresent = hasAny(intent.memberCode, intent.memberHash, intent.phoneHash, intent.emailHash);
  const scoreComponents = {
    time: timeScore,
    orderCreateTime: orderCreateTime.score,
    productName: productMatch.score,
    amount: amount.score,
    identity: 0,
    session: 0,
    adKey: 0,
  };

  return {
    intentId: intent.id,
    intentKey: intent.intentKey,
    source: intent.source,
    capturedAt: intent.capturedAt,
    timeGapMinutes,
    score:
      scoreComponents.time +
      scoreComponents.orderCreateTime +
      scoreComponents.productName +
      scoreComponents.amount +
      scoreComponents.identity +
      scoreComponents.session +
      scoreComponents.adKey,
    scoreComponents,
    orderCreatedAt: order.orderCreatedAt,
    orderCreatedGapMinutes: orderCreateTime.gapMinutes,
    orderCreateTimeBridge: orderCreateTime.type,
    productIdx: intent.productIdx,
    orderProductIdx: null,
    productIdxMatch: null,
    productIdxMatchBasis: "order_product_idx_unavailable",
    productName: intent.productName,
    productNameMatch: productMatch.matched,
    productNameMatchType: productMatch.type,
    productPrice: intent.productPrice,
    orderAmount: order.orderAmount,
    intentProductPrice: intent.productPrice,
    orderItemTotal: order.orderItemTotal,
    deliveryPrice: order.deliveryPrice,
    orderPaymentAmount: order.orderAmount,
    amountDelta: amount.amountDelta,
    amountMatch: amount.matched,
    amountMatchType: amount.type,
    amountReconcileReason: amount.reason,
    amountMismatchCategory: amountMismatch.category,
    amountMismatchLabel: amountMismatch.label,
    amountMismatchPlain: amountMismatch.plain,
    amountMismatchConfidence: amountMismatch.confidence,
    amountMismatchSignals: amountMismatch.signals,
    clientId: intent.clientId,
    gaSessionId: intent.gaSessionId,
    clientIdPresent: Boolean(intent.clientId),
    gaSessionIdPresent: Boolean(intent.gaSessionId),
    gaSessionNumberPresent: Boolean(intent.gaSessionNumber),
    adClickKeyPresent: adClickKeys.length > 0,
    adClickKeys,
    memberKeyPresent,
    npayBridgeUrlHashPresent: Boolean(intent.npayBridgeUrlHash),
    npayBridgeHost: intent.npayBridgeHost,
    npayBridgePathHashPresent: Boolean(intent.npayBridgePathHash),
    npayBridgeObservedAt: intent.npayBridgeObservedAt,
    utm: {
      source: intent.utmSource,
      medium: intent.utmMedium,
      campaign: intent.utmCampaign,
    },
    pageLocation: intent.pageLocation,
  };
};

const isBridgeEnrichedIntent = (candidate: NpayRoasDryRunCandidate) =>
  candidate.npayBridgeUrlHashPresent ||
  candidate.npayBridgePathHashPresent ||
  candidate.source === "gtm_npay_bridge_v1_1";

const capturedAtGapSeconds = (left: NpayRoasDryRunCandidate, right: NpayRoasDryRunCandidate) => {
  const leftMs = Date.parse(left.capturedAt);
  const rightMs = Date.parse(right.capturedAt);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftMs - rightMs) / 1000;
};

const isSameNpayButtonClickDuplicate = (
  left: NpayRoasDryRunCandidate,
  right: NpayRoasDryRunCandidate,
) => {
  if (!isBridgeEnrichedIntent(left) && !isBridgeEnrichedIntent(right)) return false;
  if (capturedAtGapSeconds(left, right) > 2) return false;
  if (left.productIdx !== right.productIdx) return false;
  if (left.productPrice !== right.productPrice) return false;
  if (left.pageLocation !== right.pageLocation) return false;
  if (left.orderCreatedAt !== right.orderCreatedAt) return false;
  if (left.orderCreateTimeBridge !== right.orderCreateTimeBridge) return false;
  if (left.amountMatchType !== right.amountMatchType) return false;
  if (left.orderPaymentAmount !== right.orderPaymentAmount) return false;
  if (left.adClickKeys.join("|") !== right.adClickKeys.join("|")) return false;
  return true;
};

const preferNpayIntentCandidate = (
  current: NpayRoasDryRunCandidate,
  next: NpayRoasDryRunCandidate,
) => {
  if (current.npayBridgeUrlHashPresent !== next.npayBridgeUrlHashPresent) {
    return next.npayBridgeUrlHashPresent ? next : current;
  }
  if (current.source !== next.source) {
    if (next.source === "gtm_npay_bridge_v1_1") return next;
    if (current.source === "gtm_npay_bridge_v1_1") return current;
  }
  if (current.score !== next.score) return next.score > current.score ? next : current;
  return Math.abs(next.timeGapMinutes) < Math.abs(current.timeGapMinutes) ? next : current;
};

const sortNpayCandidates = (candidates: NpayRoasDryRunCandidate[]) =>
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (Number(b.npayBridgeUrlHashPresent) !== Number(a.npayBridgeUrlHashPresent)) {
      return Number(b.npayBridgeUrlHashPresent) - Number(a.npayBridgeUrlHashPresent);
    }
    return Math.abs(a.timeGapMinutes) - Math.abs(b.timeGapMinutes);
  });

const collapseSameNpayButtonClickCandidates = (
  candidates: NpayRoasDryRunCandidate[],
) => {
  const collapsed: NpayRoasDryRunCandidate[] = [];

  for (const candidate of candidates) {
    const index = collapsed.findIndex((existing) => isSameNpayButtonClickDuplicate(existing, candidate));
    if (index === -1) {
      collapsed.push(candidate);
      continue;
    }

    collapsed[index] = preferNpayIntentCandidate(collapsed[index], candidate);
  }

  return sortNpayCandidates(collapsed);
};

const buildAmbiguousReasons = (
  order: NpayRoasDryRunOrder,
  candidates: NpayRoasDryRunCandidate[],
  minScoreGap: number,
  scoreGap: number | null,
) => {
  const reasons = new Set<string>();
  const best = candidates[0] ?? null;
  if (!best) return ["no_candidate_intent"];
  const matchingProductCandidates = candidates.filter((candidate) => candidate.productNameMatch);
  if (matchingProductCandidates.length > 1) reasons.add("multiple_intents_same_product");
  if (matchingProductCandidates.filter((candidate) => candidate.timeGapMinutes <= 15).length > 1) {
    reasons.add("same_product_multiple_clicks");
  }
  if (best.scoreComponents.time < 20 && best.orderCreateTimeBridge !== "exact") reasons.add("weak_time_gap");
  if (!best.amountMatch) reasons.add("amount_not_reconciled");
  if (!best.memberKeyPresent) reasons.add("no_member_key");
  if (best.productNameMatchType !== "exact") reasons.add("product_name_variant");
  if (scoreGap !== null && scoreGap <= minScoreGap) reasons.add("low_score_gap");
  if (
    order.lineProductCount > 1 ||
    order.quantity > 1 ||
    (best.productNameMatch &&
      !best.amountMatch &&
      best.intentProductPrice !== null &&
      best.orderPaymentAmount !== null &&
      best.orderPaymentAmount > best.intentProductPrice)
  ) {
    reasons.add("cart_multi_item_possible");
  }
  return Array.from(reasons);
};

const classifyStrongGrade = (
  bestCandidate: NpayRoasDryRunCandidate | null,
  bestScore: number | null,
  scoreGap: number | null,
  thresholds: {
    minScore: number;
    maxTimeGapMinutes: number;
    minScoreGap: number;
  },
): NpayRoasDryRunStrongGrade | null => {
  if (!bestCandidate || bestScore === null || scoreGap === null) return null;
  const orderCreateTimingOk =
    bestCandidate.orderCreateTimeBridge === "exact" &&
    bestCandidate.orderCreatedGapMinutes !== null &&
    Math.abs(bestCandidate.orderCreatedGapMinutes) <= 1;
  const completionTimingOk = bestCandidate.timeGapMinutes <= thresholds.maxTimeGapMinutes;
  const isGradeA =
    bestScore >= thresholds.minScore &&
    GRADE_A_AMOUNT_MATCH_TYPES.has(bestCandidate.amountMatchType) &&
    (completionTimingOk || orderCreateTimingOk) &&
    scoreGap >= thresholds.minScoreGap;
  return isGradeA ? "A" : "B";
};

const buildDispatcherDryRunGuard = (
  status: NpayRoasDryRunOrderStatus,
  strongGrade: NpayRoasDryRunStrongGrade | null,
  alreadyInGa4: NpayRoasDryRunGa4Presence,
  orderLabel: NpayRoasDryRunOrderLabel,
) => {
  const blockReasons: string[] = [];
  if (status !== "strong_match") blockReasons.push(status);
  if (strongGrade !== "A") blockReasons.push("not_a_grade_strong");
  if (alreadyInGa4 === "present") blockReasons.push("already_in_ga4");
  if (alreadyInGa4 === "unknown") blockReasons.push("already_in_ga4_unknown");
  if (orderLabel !== "production_order") {
    blockReasons.push(orderLabel.includes("manual") ? "manual_test_order" : "test_order");
  }

  return {
    candidate: blockReasons.length === 0,
    dryRunOnly: true as const,
    alreadyInGa4,
    blockReasons,
  };
};

const readLiveIntents = (
  sqlitePath: string,
  site: string,
  start: Date,
  end: Date,
): NpayRoasDryRunIntent[] => {
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const columns = sqliteColumns(db, "npay_intent_log");
    const rows = db
      .prepare(
        `
        SELECT
          id, intent_key, site, source, environment, match_status, captured_at, received_at,
          client_id, ga_cookie_raw, ga_session_id, ga_session_number,
          gclid, gbraid, wbraid, fbp, fbc, fbclid,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          page_location, page_referrer,
          ${optionalColumnSelect(columns, "npay_bridge_url_hash")},
          ${optionalColumnSelect(columns, "npay_bridge_host")},
          ${optionalColumnSelect(columns, "npay_bridge_path_hash")},
          ${optionalColumnSelect(columns, "npay_bridge_observed_at")},
          product_idx, product_name, product_price,
          member_code, member_hash, phone_hash, email_hash, duplicate_count
        FROM npay_intent_log
        WHERE site = @site
          AND environment = 'live'
          AND captured_at >= @start
          AND captured_at < @end
        ORDER BY captured_at ASC
      `,
      )
      .all({
        site,
        start: start.toISOString(),
        end: end.toISOString(),
      }) as SqliteIntentRow[];

    return rows.map(toIntent);
  } finally {
    db.close();
  }
};

const readConfirmedNpayOrders = async (start: Date, end: Date): Promise<NpayRoasDryRunOrder[]> => {
  const result = await queryPg<PgNpayOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(product_name::text), ''), '미분류') AS product_name,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '(blank)') AS payment_status,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN payment_complete_time::timestamptz
          WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN order_date::timestamptz
          ELSE NULL
        END AS paid_at,
        NULLIF(final_order_amount, 0)::numeric AS final_order_amount,
        NULLIF(paid_price, 0)::numeric AS paid_price,
        NULLIF(total_price, 0)::numeric AS total_price,
        NULLIF(delivery_price, 0)::numeric AS delivery_price,
        NULLIF(item_price, 0)::numeric AS item_price,
        COALESCE(NULLIF(purchase_quantity, 0), 1)::numeric AS purchase_quantity,
        CASE
          WHEN NULLIF(item_price, 0)::numeric IS NOT NULL
            THEN NULLIF(item_price, 0)::numeric * COALESCE(NULLIF(purchase_quantity, 0), 1)::numeric
          ELSE NULL
        END AS line_item_total,
        COALESCE(NULLIF(grade_discount, 0), 0)::numeric
          + COALESCE(NULLIF(coupon_discount, 0), 0)::numeric
          + COALESCE(NULLIF(point_used, 0), 0)::numeric
          + COALESCE(NULLIF(promotion_discount, 0), 0)::numeric AS line_discount_amount,
        NULLIF(total_discount_price, 0)::numeric AS total_discount_price,
        COALESCE(NULLIF(TRIM(cancellation_reason::text), ''), '') AS cancellation_reason,
        COALESCE(NULLIF(TRIM(return_reason::text), ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        COALESCE(MAX(final_order_amount), MAX(paid_price), MAX(total_price), SUM(COALESCE(line_item_total, 0)), 0)::numeric AS "orderAmount",
        COALESCE(NULLIF(SUM(COALESCE(line_item_total, 0)), 0), MAX(total_price), MAX(final_order_amount), 0)::numeric AS "orderItemTotal",
        COALESCE(MAX(delivery_price), 0)::numeric AS "deliveryPrice",
        GREATEST(COALESCE(MAX(total_discount_price), 0), SUM(COALESCE(line_discount_amount, 0)))::numeric AS "discountAmount",
        SUM(COALESCE(purchase_quantity, 1))::numeric AS "quantity",
        STRING_AGG(DISTINCT product_name, ' + ' ORDER BY product_name) AS "productNames",
        COUNT(DISTINCT product_name) AS "lineProductCount",
        BOOL_OR(cancellation_reason NOT IN ('', 'nan', 'null')) AS has_cancel,
        BOOL_OR(return_reason NOT IN ('', 'nan', 'null')) AS has_return,
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%') AS is_npay
      FROM raw
      GROUP BY order_number
    )
    SELECT
      "orderNumber",
      "channelOrderNo",
      "paidAt",
      "paymentMethod",
      "paymentStatus",
      "orderAmount",
      "orderItemTotal",
      "deliveryPrice",
      "discountAmount",
      "quantity",
      "productNames",
      "lineProductCount"
    FROM order_level
    WHERE "paidAt" >= $1::timestamptz
      AND "paidAt" < $2::timestamptz
      AND is_npay
      AND NOT has_cancel
      AND NOT has_return
      AND "orderAmount" > 0
      AND "paymentStatus" NOT IN (
        'REFUND_COMPLETE',
        'PARTIAL_REFUND_COMPLETE',
        'CANCELLED_BEFORE_DEPOSIT',
        'PAYMENT_OVERDUE',
        'PAYMENT_PREPARATION'
      )
      AND LOWER("paymentStatus") NOT LIKE '%refund%'
      AND LOWER("paymentStatus") NOT LIKE '%cancel%'
    ORDER BY "paidAt" ASC
    `,
    [start.toISOString(), end.toISOString()],
  );

  return result.rows.map(toOrder);
};

const normalizeBridgeTime = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
};

const hasVmNpaySignal = (row: SqliteImwebOrderBridgeRow) => {
  const raw = parseJsonRecord(row.raw_json);
  const payment = nestedRecord(raw, "payment");
  const material = [
    row.pay_type,
    row.pg_type,
    raw.pay_type,
    raw.pg_type,
    raw.payment_method,
    payment.pay_type,
    payment.pg_type,
    payment.payment_method,
    row.channel_order_no,
  ]
    .map(textValue)
    .join(" ")
    .toLowerCase();

  return /npay|naver|네이버/.test(material);
};

const isVmOrderCanceledOrRefunded = (row: SqliteImwebOrderBridgeRow) => {
  const raw = parseJsonRecord(row.raw_json);
  const payment = nestedRecord(raw, "payment");
  const material = [
    row.imweb_status,
    raw.imweb_status,
    raw.order_status,
    raw.status,
    raw.payment_status,
    payment.status,
    payment.payment_status,
  ]
    .map(textValue)
    .join(" ")
    .toUpperCase();

  return /CANCEL|REFUND|RETURN|EXCHANGE|OVERDUE/.test(material);
};

const resolveVmPaidAt = (
  row: SqliteImwebOrderBridgeRow,
): { paidAt: string; basis: NonNullable<NpayRoasDryRunOrder["paidAtBasis"]> } | null => {
  const raw = parseJsonRecord(row.raw_json);
  const payment = nestedRecord(raw, "payment");
  const completeTime = normalizeBridgeTime(row.complete_time) || unixSecondsToIso(row.complete_time_unix);
  if (completeTime) {
    return {
      paidAt: completeTime,
      basis: "vm_complete_time",
    };
  }

  const paymentTime =
    unixSecondsToIso(payment.payment_time) ||
    unixSecondsToIso(payment.paymentTime) ||
    unixSecondsToIso(raw.payment_time) ||
    unixSecondsToIso(raw.paymentTime);
  if (paymentTime) {
    return {
      paidAt: paymentTime,
      basis: "vm_payment_time",
    };
  }

  return null;
};

const toVmNpayOrder = (row: SqliteImwebOrderBridgeRow): NpayRoasDryRunOrder | null => {
  const orderNumber = textValue(row.order_no);
  if (!orderNumber) return null;
  if (!hasVmNpaySignal(row)) return null;
  if (isVmOrderCanceledOrRefunded(row)) return null;

  const paid = resolveVmPaidAt(row);
  if (!paid) return null;

  const orderAmount = numberValue(row.payment_amount) ?? numberValue(row.total_price);
  if (!orderAmount || orderAmount <= 0) return null;

  return {
    orderNumber,
    channelOrderNo: textValue(row.channel_order_no),
    orderCreatedAt: normalizeBridgeTime(row.order_time),
    orderBridgeSource: "vm_imweb_orders",
    orderBridgePaymentAmount: orderAmount,
    paidAtBasis: paid.basis,
    paidAt: paid.paidAt,
    paymentMethod: "NAVERPAY_ORDER",
    paymentStatus:
      paid.basis === "vm_payment_time"
        ? "PAYMENT_COMPLETE_BY_NPAY_PAYMENT_TIME"
        : "PAYMENT_COMPLETE",
    orderAmount,
    orderItemTotal: numberValue(row.total_price) ?? orderAmount,
    deliveryPrice: numberValue(row.delivery_price),
    discountAmount: numberValue(row.coupon_amount),
    quantity: 1,
    productNames: [],
    lineProductCount: 1,
  };
};

const readVmConfirmedNpayOrders = (
  sqlitePath: string,
  site: string,
  start: Date,
  end: Date,
): NpayRoasDryRunOrder[] => {
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const columns = sqliteColumns(db, "imweb_orders");
    const startLookback = new Date(start.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const endLookahead = new Date(end.getTime() + 6 * 60 * 60 * 1000).toISOString();
    const rows = db
      .prepare(
        `
        SELECT
          order_no,
          channel_order_no,
          order_time,
          ${optionalColumnSelect(columns, "complete_time")},
          ${optionalColumnSelect(columns, "complete_time_unix")},
          payment_amount,
          total_price,
          ${optionalColumnSelect(columns, "delivery_price")},
          ${optionalColumnSelect(columns, "coupon_amount")},
          pay_type,
          ${optionalColumnSelect(columns, "pg_type")},
          ${optionalColumnSelect(columns, "raw_json")},
          ${optionalColumnSelect(columns, "imweb_status")},
          synced_at
        FROM imweb_orders
        WHERE site = @site
          AND COALESCE(payment_amount, total_price, 0) > 0
          AND (
            COALESCE(order_time, '') BETWEEN @startLookback AND @endLookahead
            OR COALESCE(synced_at, '') BETWEEN @startLookback AND @endLookahead
          )
          AND (
            LOWER(COALESCE(pay_type, '')) LIKE '%npay%'
            OR LOWER(COALESCE(${columns.has("pg_type") ? "pg_type" : "''"}, '')) LIKE '%npay%'
            OR COALESCE(channel_order_no, '') <> ''
            OR LOWER(COALESCE(${columns.has("raw_json") ? "raw_json" : "''"}, '')) LIKE '%npay%'
            OR LOWER(COALESCE(${columns.has("raw_json") ? "raw_json" : "''"}, '')) LIKE '%naver%'
          )
        ORDER BY COALESCE(order_time, synced_at, '') ASC
      `,
      )
      .all({ site, startLookback, endLookahead }) as SqliteImwebOrderBridgeRow[];

    return rows
      .map(toVmNpayOrder)
      .filter((order): order is NpayRoasDryRunOrder => {
        if (!order) return false;
        const paidAtMs = Date.parse(order.paidAt);
        return Number.isFinite(paidAtMs) && paidAtMs >= start.getTime() && paidAtMs < end.getTime();
      });
  } finally {
    db.close();
  }
};

const readVmImwebOrderBridgeRows = (
  sqlitePath: string,
  site: string,
  orders: NpayRoasDryRunOrder[],
) => {
  const keys = Array.from(
    new Set(
      orders
        .flatMap((order) => [order.orderNumber, order.channelOrderNo])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (keys.length === 0) return new Map<string, SqliteImwebOrderBridgeRow>();

  const placeholders = keys.map(() => "?").join(", ");
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  try {
    const columns = sqliteColumns(db, "imweb_orders");
    const rows = db
      .prepare(
        `
        SELECT
          order_no,
          channel_order_no,
          order_time,
          ${optionalColumnSelect(columns, "complete_time")},
          ${optionalColumnSelect(columns, "complete_time_unix")},
          payment_amount,
          total_price,
          ${optionalColumnSelect(columns, "delivery_price")},
          ${optionalColumnSelect(columns, "coupon_amount")},
          pay_type,
          ${optionalColumnSelect(columns, "pg_type")},
          ${optionalColumnSelect(columns, "raw_json")},
          ${optionalColumnSelect(columns, "imweb_status")},
          synced_at
        FROM imweb_orders
        WHERE site = ?
          AND (
            order_no IN (${placeholders})
            OR channel_order_no IN (${placeholders})
          )
      `,
      )
      .all(site, ...keys, ...keys) as SqliteImwebOrderBridgeRow[];

    const bridgeByKey = new Map<string, SqliteImwebOrderBridgeRow>();
    for (const row of rows) {
      if (row.order_no) bridgeByKey.set(row.order_no, row);
      if (row.channel_order_no) bridgeByKey.set(row.channel_order_no, row);
    }
    return bridgeByKey;
  } finally {
    db.close();
  }
};

const enrichOrdersWithVmImwebOrderBridge = (
  sqlitePath: string,
  site: string,
  orders: NpayRoasDryRunOrder[],
) => {
  if (orders.length === 0) return orders;

  const bridgeByKey = readVmImwebOrderBridgeRows(sqlitePath, site, orders);

  return orders.map<NpayRoasDryRunOrder>((order) => {
    const bridge = bridgeByKey.get(order.orderNumber) || bridgeByKey.get(order.channelOrderNo);
    if (!bridge) return order;

    return {
      ...order,
      orderCreatedAt: normalizeBridgeTime(bridge.order_time),
      orderBridgeSource: "vm_imweb_orders",
      orderBridgePaymentAmount: numberValue(bridge.payment_amount) ?? numberValue(bridge.total_price),
    };
  });
};

const hasSameOrderIdentity = (left: NpayRoasDryRunOrder, right: NpayRoasDryRunOrder) => {
  const leftKeys = uniqueNonEmpty([left.orderNumber, left.channelOrderNo]);
  const rightKeys = new Set(uniqueNonEmpty([right.orderNumber, right.channelOrderNo]));
  return leftKeys.some((key) => rightKeys.has(key));
};

const mergeOrdersPreferExisting = (
  primaryOrders: NpayRoasDryRunOrder[],
  secondaryOrders: NpayRoasDryRunOrder[],
) => {
  const merged = [...primaryOrders];
  for (const secondary of secondaryOrders) {
    if (!merged.some((existing) => hasSameOrderIdentity(existing, secondary))) {
      merged.push(secondary);
    }
  }
  return merged;
};

export const buildNpayRoasDryRunReport = async (
  options: NpayRoasDryRunOptions = {},
): Promise<NpayRoasDryRunReport> => {
  const now = options.now ?? new Date();
  const start = parseDateInput(options.start, new Date(DEFAULT_NPAY_ROAS_DRY_RUN_START));
  const end = parseDateInput(options.end, now);
  if (end <= start) throw new Error("dry-run end must be later than start");

  const site = options.site ?? "biocom";
  const sqlitePath = resolveSqlitePath(options.sqlitePath);
  const noPurchaseGraceHours = options.noPurchaseGraceHours ?? 24;
  const strongScoreThreshold = options.strongScoreThreshold ?? 50;
  const minScoreGap = options.minScoreGap ?? 10;
  const gradeAMinScore = options.gradeAMinScore ?? 70;
  const gradeAMaxTimeGapMinutes = options.gradeAMaxTimeGapMinutes ?? 2;
  const gradeAMinScoreGap = options.gradeAMinScoreGap ?? 15;
  const maxCandidateLookbackHours = options.maxCandidateLookbackHours ?? 24;
  const maxCandidatesPerOrder = options.maxCandidatesPerOrder ?? 25;
  const ga4PresentOrderNumbers = normalizeOrderNumberSet(options.ga4PresentOrderNumbers);
  const ga4RobustAbsentOrderNumbers = normalizeOrderNumberSet(options.ga4RobustAbsentOrderNumbers);
  const ga4AbsentOrderNumbers = normalizeOrderNumberSet(options.ga4AbsentOrderNumbers);
  const testOrderNumbers = normalizeOrderNumberSet(options.testOrderNumbers);
  const testOrderLabel = options.testOrderLabel?.trim() || "test_order";
  const selectedOrderNumbers = normalizeOrderNumberSet(options.orderNumbers);
  const manualOrders = (options.manualOrders ?? []).map(toManualOrder);
  const manualOrderNumbers = new Set(manualOrders.map((order) => order.orderNumber));

  const intents = readLiveIntents(sqlitePath, site, start, end);
  const pgOrders = enrichOrdersWithVmImwebOrderBridge(
    sqlitePath,
    site,
    await readConfirmedNpayOrders(start, end),
  );
  const vmOrders = readVmConfirmedNpayOrders(sqlitePath, site, start, end);
  const baseOrders = mergeOrdersPreferExisting(pgOrders, vmOrders);
  const orderMap = new Map(baseOrders.map((order) => [order.orderNumber, order]));
  for (const manualOrder of manualOrders) {
    if (!orderMap.has(manualOrder.orderNumber)) orderMap.set(manualOrder.orderNumber, manualOrder);
  }
  const orders = Array.from(orderMap.values()).filter(
    (order) =>
      selectedOrderNumbers.size === 0 ||
      selectedOrderNumbers.has(order.orderNumber) ||
      (order.channelOrderNo ? selectedOrderNumbers.has(order.channelOrderNo) : false),
  ).sort((a, b) => Date.parse(a.paidAt) - Date.parse(b.paidAt));
  const intentsById = new Map(intents.map((intent) => [intent.id, intent]));
  const candidateOrderNumbersByIntentId = new Map<string, Set<string>>();
  const bestOrderByIntentId = new Map<string, { orderNumber: string; score: number }>();
  const lookbackMs = maxCandidateLookbackHours * 60 * 60 * 1000;

  const orderResults = orders.map<NpayRoasDryRunOrderResult>((order) => {
    const paidAtMs = Date.parse(order.paidAt);
    const orderCreatedAtMs = Date.parse(order.orderCreatedAt);
    const hasUsableOrderCreatedAt = Number.isFinite(orderCreatedAtMs);
    const candidates = collapseSameNpayButtonClickCandidates(
      intents
        .filter((intent) => {
          const capturedAtMs = Date.parse(intent.capturedAt);
          if (!Number.isFinite(capturedAtMs) || capturedAtMs > paidAtMs) return false;

          const completionWindowMatch = paidAtMs - capturedAtMs <= lookbackMs;
          const orderCreateWindowMatch =
            hasUsableOrderCreatedAt && Math.abs(orderCreatedAtMs - capturedAtMs) <= lookbackMs;

          return completionWindowMatch || orderCreateWindowMatch;
        })
        .map((intent) => buildCandidate(order, intent))
        .filter((candidate) => candidate.score > 0),
    ).slice(0, maxCandidatesPerOrder);

    for (const candidate of candidates) {
      const set = candidateOrderNumbersByIntentId.get(candidate.intentId) ?? new Set<string>();
      set.add(order.orderNumber);
      candidateOrderNumbersByIntentId.set(candidate.intentId, set);
      const currentBest = bestOrderByIntentId.get(candidate.intentId);
      if (!currentBest || candidate.score > currentBest.score) {
        bestOrderByIntentId.set(candidate.intentId, {
          orderNumber: order.orderNumber,
          score: candidate.score,
        });
      }
    }

    const bestCandidate = candidates[0] ?? null;
    const secondCandidate = candidates[1] ?? null;
    const bestScore = bestCandidate?.score ?? null;
    const secondScore = secondCandidate?.score ?? null;
    const scoreGap =
      bestScore !== null && secondScore !== null
        ? Math.max(0, bestScore - secondScore)
        : bestScore !== null
          ? bestScore
          : null;
    const isStrong =
      Boolean(bestCandidate) &&
      bestScore !== null &&
      scoreGap !== null &&
      bestScore >= strongScoreThreshold &&
      scoreGap > minScoreGap;
    const status: NpayRoasDryRunOrderStatus = bestCandidate
      ? isStrong
        ? "strong_match"
        : "ambiguous"
      : "purchase_without_intent";
    const strongGrade =
      status === "strong_match"
        ? classifyStrongGrade(bestCandidate, bestScore, scoreGap, {
            minScore: gradeAMinScore,
            maxTimeGapMinutes: gradeAMaxTimeGapMinutes,
            minScoreGap: gradeAMinScoreGap,
          })
        : null;
    const ga4LookupIds = buildGa4LookupIds(order);
    const alreadyInGa4 = resolveGa4Presence(
      ga4LookupIds,
      ga4PresentOrderNumbers,
      ga4RobustAbsentOrderNumbers,
      ga4AbsentOrderNumbers,
    );
    const orderLabel: NpayRoasDryRunOrderLabel =
      testOrderNumbers.has(order.orderNumber) ||
      (order.channelOrderNo ? testOrderNumbers.has(order.channelOrderNo) : false)
      ? testOrderLabel
      : "production_order";
    const dispatcherDryRun = buildDispatcherDryRunGuard(
      status,
      strongGrade,
      alreadyInGa4,
      orderLabel,
    );
    const ga4PayloadPreview = buildGa4PayloadPreview(order, bestCandidate, dispatcherDryRun, now, site);
    const ambiguousReasons =
      status === "ambiguous" ? buildAmbiguousReasons(order, candidates, minScoreGap, scoreGap) : [];

    return {
      order,
      orderLabel,
      ga4LookupIds,
      status,
      strongGrade,
      sendAllowed: false,
      dispatcherDryRun,
      ga4PayloadPreview,
      bestCandidate,
      secondCandidate,
      bestScore,
      secondScore,
      scoreGap,
      candidateCount: candidates.length,
      candidates,
      ambiguousReasons,
    };
  });

  const strongBestIntentIds = new Set(
    orderResults
      .filter((result) => result.status === "strong_match" && result.bestCandidate)
      .map((result) => result.bestCandidate?.intentId ?? "")
      .filter(Boolean),
  );
  const clickedNoPurchaseCutoff = new Date(end.getTime() - noPurchaseGraceHours * 60 * 60 * 1000);
  const intentResults = intents.map<NpayRoasDryRunIntentResult>((intent) => {
    const candidateOrders = Array.from(candidateOrderNumbersByIntentId.get(intent.id) ?? []).sort();
    const bestOrder = bestOrderByIntentId.get(intent.id) ?? null;
    const capturedAt = new Date(intent.capturedAt);
    const status: NpayRoasDryRunIntentStatus = strongBestIntentIds.has(intent.id)
      ? "clicked_purchased_candidate"
      : capturedAt <= clickedNoPurchaseCutoff
        ? "clicked_no_purchase"
        : "intent_pending";

    return {
      intent,
      status,
      candidateOrderNumbers: candidateOrders,
      bestOrderNumber: bestOrder?.orderNumber ?? null,
      bestScore: bestOrder?.score ?? null,
    };
  });

  const orderSummary = orderResults.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      if (result.strongGrade === "A") acc.strongMatchA += 1;
      if (result.strongGrade === "B") acc.strongMatchB += 1;
      if (result.dispatcherDryRun.candidate) acc.dispatcherDryRunCandidate += 1;
      if (result.dispatcherDryRun.alreadyInGa4 === "present") acc.alreadyInGa4Blocked += 1;
      if (result.strongGrade === "A" && result.orderLabel === "production_order") {
        acc.ga4LookupRequiredOrderCount += 1;
        acc.ga4LookupIdCount += result.ga4LookupIds.length;
      }
      if (result.dispatcherDryRun.alreadyInGa4 === "present") acc.alreadyInGa4LookupPresent += 1;
      if (result.dispatcherDryRun.alreadyInGa4 === "robust_absent") {
        acc.alreadyInGa4LookupRobustAbsent += 1;
      }
      if (result.dispatcherDryRun.alreadyInGa4 === "absent") acc.alreadyInGa4LookupAbsent += 1;
      if (result.dispatcherDryRun.alreadyInGa4 === "unknown") acc.alreadyInGa4LookupUnknown += 1;
      if (result.orderLabel !== "production_order") acc.testOrderBlocked += 1;
      if (manualOrderNumbers.has(result.order.orderNumber)) acc.manualOrderCount += 1;
      const amountType = result.bestCandidate?.amountMatchType ?? "unknown";
      acc.amountMatchTypeCounts[amountType] += 1;
      if (amountType === "shipping_reconciled") {
        acc.shippingReconciledCount += 1;
        if (result.strongGrade !== "A") acc.shippingReconciledNotGradeACount += 1;
      }
      if (!result.order.orderCreatedAt) acc.orderCreateBridgeMissing += 1;
      if (result.bestCandidate?.orderCreateTimeBridge === "exact") {
        acc.orderCreateBridgeExact += 1;
        if (result.bestCandidate.adClickKeys.some((key) => key === "gclid" || key === "gbraid" || key === "wbraid")) {
          acc.orderCreateBridgeExactWithGoogleClickId += 1;
        }
      }
      return acc;
    },
    {
      strong_match: 0,
      ambiguous: 0,
      purchase_without_intent: 0,
      strongMatchA: 0,
      strongMatchB: 0,
      dispatcherDryRunCandidate: 0,
      alreadyInGa4Blocked: 0,
      alreadyInGa4LookupPresent: 0,
      alreadyInGa4LookupRobustAbsent: 0,
      alreadyInGa4LookupAbsent: 0,
      alreadyInGa4LookupUnknown: 0,
      ga4LookupRequiredOrderCount: 0,
      ga4LookupIdCount: 0,
      testOrderBlocked: 0,
      manualOrderCount: 0,
      amountMatchTypeCounts: Object.fromEntries(
        AMOUNT_MATCH_TYPES.map((type) => [type, 0]),
      ) as Record<NpayRoasDryRunAmountMatchType, number>,
      shippingReconciledCount: 0,
      shippingReconciledNotGradeACount: 0,
      orderCreateBridgeExact: 0,
      orderCreateBridgeExactWithGoogleClickId: 0,
      orderCreateBridgeMissing: 0,
    } as Record<NpayRoasDryRunOrderStatus, number> & {
      strongMatchA: number;
      strongMatchB: number;
      dispatcherDryRunCandidate: number;
      alreadyInGa4Blocked: number;
      alreadyInGa4LookupPresent: number;
      alreadyInGa4LookupRobustAbsent: number;
      alreadyInGa4LookupAbsent: number;
      alreadyInGa4LookupUnknown: number;
      ga4LookupRequiredOrderCount: number;
      ga4LookupIdCount: number;
      testOrderBlocked: number;
      manualOrderCount: number;
      amountMatchTypeCounts: Record<NpayRoasDryRunAmountMatchType, number>;
      shippingReconciledCount: number;
      shippingReconciledNotGradeACount: number;
      orderCreateBridgeExact: number;
      orderCreateBridgeExactWithGoogleClickId: number;
      orderCreateBridgeMissing: number;
    },
  );
  const intentSummary = intentResults.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    {
      clicked_purchased_candidate: 0,
      clicked_no_purchase: 0,
      intent_pending: 0,
    } as Record<NpayRoasDryRunIntentStatus, number>,
  );
  const breakdowns = {
    ambiguousReasons: buildAmbiguousReasonBreakdown(orderResults),
    clickedNoPurchase: buildClickedNoPurchaseBreakdown(intentResults),
  };

  return {
    ok: true,
    mode: "dry_run_read_only",
    generatedAt: now.toISOString(),
    source: {
      intents: `readonly sqlite npay_intent_log (${sqlitePath})`,
      orders: "readonly operational_postgres.public.tb_iamweb_users + readonly sqlite imweb_orders(payment.payment_time fallback)",
    },
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      site,
      noPurchaseGraceHours,
      clickedNoPurchaseCutoffAt: clickedNoPurchaseCutoff.toISOString(),
    },
    thresholds: {
      strongScoreThreshold,
      minScoreGap,
      gradeA: {
        minScore: gradeAMinScore,
        requiredAmountMatchType: "final_or_reconciled",
        maxTimeGapMinutes: gradeAMaxTimeGapMinutes,
        minScoreGap: gradeAMinScoreGap,
      },
      maxCandidateLookbackHours,
    },
    summary: {
      liveIntentCount: intents.length,
      confirmedNpayOrderCount: orders.length,
      strongMatch: orderSummary.strong_match,
      strongMatchA: orderSummary.strongMatchA,
      strongMatchB: orderSummary.strongMatchB,
      ambiguous: orderSummary.ambiguous,
      purchaseWithoutIntent: orderSummary.purchase_without_intent,
      dispatcherDryRunCandidate: orderSummary.dispatcherDryRunCandidate,
      alreadyInGa4Blocked: orderSummary.alreadyInGa4Blocked,
      alreadyInGa4LookupPresent: orderSummary.alreadyInGa4LookupPresent,
      alreadyInGa4LookupRobustAbsent: orderSummary.alreadyInGa4LookupRobustAbsent,
      alreadyInGa4LookupAbsent: orderSummary.alreadyInGa4LookupAbsent,
      alreadyInGa4LookupUnknown: orderSummary.alreadyInGa4LookupUnknown,
      ga4LookupRequiredOrderCount: orderSummary.ga4LookupRequiredOrderCount,
      ga4LookupIdCount: orderSummary.ga4LookupIdCount,
      testOrderBlocked: orderSummary.testOrderBlocked,
      manualOrderCount: orderSummary.manualOrderCount,
      amountMatchTypeCounts: orderSummary.amountMatchTypeCounts,
      shippingReconciledCount: orderSummary.shippingReconciledCount,
      shippingReconciledNotGradeACount: orderSummary.shippingReconciledNotGradeACount,
      orderCreateBridgeExact: orderSummary.orderCreateBridgeExact,
      orderCreateBridgeExactWithGoogleClickId: orderSummary.orderCreateBridgeExactWithGoogleClickId,
      orderCreateBridgeMissing: orderSummary.orderCreateBridgeMissing,
      clickedPurchasedCandidate: intentSummary.clicked_purchased_candidate,
      clickedNoPurchase: intentSummary.clicked_no_purchase,
      intentPending: intentSummary.intent_pending,
    },
    orderResults,
    intentResults,
    breakdowns,
    notes: [
      "This report is read-only. It does not update npay_intent_log.match_status.",
      "This report does not send GA4, Meta, TikTok, or Google Ads purchase events.",
      "This Phase2 report work does not deploy or enable production endpoints.",
      "already_in_ga4 guard checks both Imweb order_number and NPay channel_order_no when channel_order_no is available.",
      "Only A-grade strong matches with already_in_ga4=robust_absent or absent are future dispatcher dry-run candidates; B-grade strong, ambiguous, purchase_without_intent, test orders, and already_in_ga4 rows are blocked.",
      "Manual orders are dry-run inputs only and are not written to any database.",
      "product_idx_match is null because tb_iamweb_users does not expose an order-level product_idx in this read model.",
      "order_create_time_bridge is internal analysis evidence only. It narrows NPay external order matching but does not make a Google Ads upload candidate.",
      "NPay matching now allows order_time-exact evidence to satisfy the timing guard when complete_time/payment_time is delayed by external NPay or Imweb sync behavior.",
    ],
  };
};

const buildClickIdPreview = (
  intent: NpayRoasDryRunIntent,
  includeRawClickIds: boolean,
): NpayIntentRematchDryRunClickIds => {
  const googleClickIdTypes: Array<"gclid" | "gbraid" | "wbraid"> = [];
  if (intent.gclid) googleClickIdTypes.push("gclid");
  if (intent.gbraid) googleClickIdTypes.push("gbraid");
  if (intent.wbraid) googleClickIdTypes.push("wbraid");

  return {
    gclid: includeRawClickIds ? intent.gclid : intent.gclid ? "[present]" : "",
    gbraid: includeRawClickIds ? intent.gbraid : intent.gbraid ? "[present]" : "",
    wbraid: includeRawClickIds ? intent.wbraid : intent.wbraid ? "[present]" : "",
    googleClickIdTypes,
    hasGoogleClickId: googleClickIdTypes.length > 0,
  };
};

const buildRematchRecommendedAction = (
  result: NpayRoasDryRunOrderResult,
  intent: NpayRoasDryRunIntent,
  clickIds: NpayIntentRematchDryRunClickIds,
): NpayIntentRematchDryRunCandidate["recommendedAction"] => {
  if (intent.matchStatus && intent.matchStatus !== "pending") return "skip_non_pending_intent";
  if (!clickIds.hasGoogleClickId) return "review_but_no_google_click_id";
  if (result.strongGrade === "A") return "safe_apply_candidate_after_write_approval";
  return "manual_review_before_apply";
};

const buildRematchBlockReasons = (
  result: NpayRoasDryRunOrderResult,
  intent: NpayRoasDryRunIntent,
  clickIds: NpayIntentRematchDryRunClickIds,
) => {
  const reasons: string[] = [];
  if (intent.matchStatus && intent.matchStatus !== "pending") reasons.push("intent_not_pending");
  if (!clickIds.hasGoogleClickId) reasons.push("missing_google_click_id");
  if (result.strongGrade !== "A") reasons.push("not_grade_a_auto_apply");
  if (result.status !== "strong_match") reasons.push(`order_status_${result.status}`);
  return reasons;
};

const buildRematchCandidate = (
  result: NpayRoasDryRunOrderResult,
  intent: NpayRoasDryRunIntent,
  includeRawClickIds: boolean,
): NpayIntentRematchDryRunCandidate | null => {
  const candidate = result.bestCandidate;
  if (!candidate) return null;
  const clickIds = buildClickIdPreview(intent, includeRawClickIds);
  return {
    orderNumber: result.order.orderNumber,
    channelOrderNo: result.order.channelOrderNo,
    paidAt: result.order.paidAt,
    paymentMethod: result.order.paymentMethod,
    paymentStatus: result.order.paymentStatus,
    orderAmount: result.order.orderAmount,
    intentId: intent.id,
    intentKey: intent.intentKey,
    intentCapturedAt: intent.capturedAt,
    currentIntentMatchStatus: intent.matchStatus,
    nextIntentMatchStatusPreview: "matched",
    matchedOrderNoPreview: result.order.orderNumber,
    matchedChannelOrderNoPreview: result.order.channelOrderNo,
    score: candidate.score,
    scoreGap: result.scoreGap,
    strongGrade: result.strongGrade,
    amountMatchType: candidate.amountMatchType,
    amountReconcileReason: candidate.amountReconcileReason,
    amountMismatchCategory: candidate.amountMismatchCategory,
    amountMismatchLabel: candidate.amountMismatchLabel,
    amountMismatchPlain: candidate.amountMismatchPlain,
    amountMismatchConfidence: candidate.amountMismatchConfidence,
    amountMismatchSignals: candidate.amountMismatchSignals,
    timeGapMinutes: candidate.timeGapMinutes,
    orderCreatedAt: candidate.orderCreatedAt,
    orderCreatedGapMinutes: candidate.orderCreatedGapMinutes,
    orderCreateTimeBridge: candidate.orderCreateTimeBridge,
    productIdx: candidate.productIdx,
    productName: candidate.productName,
    clientId: intent.clientId,
    gaSessionId: intent.gaSessionId,
    pageLocation: candidate.pageLocation,
    npayBridgeUrlHashPresent: Boolean(intent.npayBridgeUrlHash),
    npayBridgeHost: intent.npayBridgeHost,
    npayBridgePathHashPresent: Boolean(intent.npayBridgePathHash),
    npayBridgeObservedAt: intent.npayBridgeObservedAt,
    gadCampaignId: extractGadCampaignIdFromUrlLike(candidate.pageLocation),
    utm: candidate.utm,
    clickIds,
    recommendedAction: buildRematchRecommendedAction(result, intent, clickIds),
    blockReasons: buildRematchBlockReasons(result, intent, clickIds),
  };
};

const hasGoogleClickIdInNpayIntent = (intent: NpayRoasDryRunIntent) =>
  Boolean(intent.gclid || intent.gbraid || intent.wbraid);

const hasMetaSignalInNpayIntent = (intent: NpayRoasDryRunIntent) =>
  Boolean(intent.fbclid || intent.fbc || intent.fbp) ||
  /facebook|instagram|meta|fbclid|utm_source=fb|utm_source=facebook|utm_source=instagram/i.test(
    [
      intent.utmSource,
      intent.utmMedium,
      intent.utmCampaign,
      intent.pageLocation,
      intent.pageReferrer,
    ].join(" "),
  );

const classifyNpayIntentSource = (
  intent: NpayRoasDryRunIntent | null | undefined,
): { channel: NpayIntentSourceFunnelChannel; label: string; plain: string } => {
  if (!intent) {
    return {
      channel: "other",
      label: "기타/오가닉 포함",
      plain: "버튼 클릭 row를 찾지 못했거나 유입 단서를 읽을 수 없어 기타로 둡니다.",
    };
  }

  if (isGoogleLikeNpayIntent(intent)) {
    return {
      channel: "google",
      label: "Google",
      plain: "gclid, gbraid, wbraid 또는 Google 광고 URL/UTM 흔적이 있는 NPay 버튼 클릭입니다.",
    };
  }

  if (hasMetaSignalInNpayIntent(intent)) {
    return {
      channel: "meta",
      label: "Meta",
      plain: "fbclid, fbc, fbp 또는 Meta/Facebook/Instagram 유입 흔적이 있는 NPay 버튼 클릭입니다.",
    };
  }

  return {
    channel: "other",
    label: "기타/오가닉 포함",
    plain: "Naver, organic, direct, 출처 유실을 한 묶음으로 본 값입니다. Google 예산 판단용 매출로 쓰지 않습니다.",
  };
};

const round2 = (value: number) => Number(value.toFixed(2));

const isGoogleLikeNpayIntent = (intent: NpayRoasDryRunIntent) => {
  if (hasGoogleClickIdInNpayIntent(intent)) return true;
  const material = [
    intent.utmSource,
    intent.utmMedium,
    intent.utmCampaign,
    intent.pageLocation,
    intent.pageReferrer,
  ].join(" ").toLowerCase();
  return /googleads|google_ads|google|gclid=|gbraid=|wbraid=|gad_source=|gad_campaignid=/.test(material);
};

const emptyNpayIntentSourceFunnelRow = (
  channel: NpayIntentSourceFunnelChannel,
): NpayIntentSourceFunnelRow => {
  const base = classifyNpayIntentSource(null);
  const label = channel === "google" ? "Google" : channel === "meta" ? "Meta" : base.label;
  const plain =
    channel === "google"
      ? "Google 광고 흔적이 있는 NPay 버튼 클릭에서 실제 결제완료까지 간 비율입니다."
      : channel === "meta"
        ? "Meta 계열 흔적이 있는 NPay 버튼 클릭에서 실제 결제완료까지 간 비율입니다."
        : base.plain;

  return {
    channel,
    label,
    intentCount: 0,
    bridgeOpenedIntentCount: 0,
    googleClickIdIntentCount: 0,
    completedOrders: 0,
    completedAmountKrw: 0,
    completionRatePct: 0,
    plain,
  };
};

const buildNpayIntentSourceFunnelComparison = ({
  intentResults,
  rows,
  intentById,
}: {
  intentResults: NpayRoasDryRunIntentResult[];
  rows: NpayIntentRematchDryRunCandidate[];
  intentById: Map<string, NpayRoasDryRunIntent>;
}): NpayIntentSourceFunnelRow[] => {
  const byChannel = new Map<NpayIntentSourceFunnelChannel, NpayIntentSourceFunnelRow>([
    ["google", emptyNpayIntentSourceFunnelRow("google")],
    ["meta", emptyNpayIntentSourceFunnelRow("meta")],
    ["other", emptyNpayIntentSourceFunnelRow("other")],
  ]);

  for (const result of intentResults) {
    const classification = classifyNpayIntentSource(result.intent);
    const current = byChannel.get(classification.channel);
    if (!current) continue;
    current.intentCount += 1;
    if (result.intent.npayBridgeUrlHash) current.bridgeOpenedIntentCount += 1;
    if (hasGoogleClickIdInNpayIntent(result.intent)) current.googleClickIdIntentCount += 1;
  }

  for (const row of rows) {
    const intent = intentById.get(row.intentId);
    const classification = classifyNpayIntentSource(intent);
    const current = byChannel.get(classification.channel);
    if (!current) continue;
    current.completedOrders += 1;
    current.completedAmountKrw += row.orderAmount ?? 0;
  }

  return Array.from(byChannel.values()).map((row) => ({
    ...row,
    completedAmountKrw: round2(row.completedAmountKrw),
    completionRatePct: percent(row.completedOrders, row.intentCount),
  }));
};

const sourceLabelForNpayIntent = (intent: NpayRoasDryRunIntent | null | undefined) =>
  classifyNpayIntentSource(intent).label;

const buildUnresolvedAvailableFacts = (
  result: NpayRoasDryRunOrderResult,
  candidate: NpayRoasDryRunCandidate | null,
) => {
  const facts: string[] = [];
  if (result.order.orderNumber) facts.push("내부 주문번호 있음");
  if (result.order.channelOrderNo) facts.push("NPay 주문번호 있음");
  if (result.order.orderCreatedAt) facts.push("order_time 있음");
  if (result.order.paidAt) facts.push(`${result.order.paidAtBasis ?? "complete_time"} 있음`);
  if (result.order.orderAmount) facts.push("실제 결제금액 있음");
  if (candidate?.productNameMatch) facts.push("상품명 후보 있음");
  if (candidate?.npayBridgeUrlHashPresent) facts.push("NPay bridge URL hash 있음");
  if (candidate?.adClickKeyPresent) facts.push("광고 click id/광고키 있음");
  return facts;
};

const buildUnresolvedMissingFacts = (
  result: NpayRoasDryRunOrderResult,
  candidate: NpayRoasDryRunCandidate | null,
) => {
  const missing: string[] = [];
  if (!candidate) {
    missing.push("주문 근처 NPay 버튼 클릭 row 없음");
    return missing;
  }
  if (!candidate.amountMatch) missing.push("버튼 클릭 금액과 실제 결제금액이 자동 조합으로 맞지 않음");
  if (candidate.orderCreateTimeBridge !== "exact") missing.push("order_time과 버튼 클릭 시각이 1분 이내로 맞지 않음");
  if (!candidate.npayBridgeUrlHashPresent) missing.push("네이버 bridge URL hash 없음");
  if (!candidate.memberKeyPresent) missing.push("회원/브라우저 연결키 부족");
  if (!candidate.adClickKeyPresent) missing.push("광고 click id/광고키 없음");
  if (result.scoreGap !== null && result.scoreGap <= 10) missing.push("1등 후보와 2등 후보 차이가 작음");
  return missing;
};

const buildUnresolvedProposedFix = (
  result: NpayRoasDryRunOrderResult,
  candidate: NpayRoasDryRunCandidate | null,
) => {
  if (!candidate) {
    return "NPay 버튼 클릭 저장 누락 또는 분석 창 밖 주문입니다. bridge URL/버튼 클릭 저장 범위와 주문 sync 시간을 먼저 확인합니다.";
  }
  if (!candidate.amountMatch) {
    if (candidate.amountMismatchCategory === "quantity") {
      return "수량형 금액 차이로 분류했습니다. 주문 수량과 상품 단가 조합이 맞는지 확인한 뒤 자동 연결 기준에 반영합니다.";
    }
    if (candidate.amountMismatchCategory === "cart_multi_item") {
      return "장바구니/복수상품 금액 차이로 분류했습니다. 같은 주문번호 안의 여러 상품 row를 주문 1건으로 묶어 비교해야 합니다.";
    }
    if (candidate.amountMismatchCategory === "set_or_bundle") {
      return "세트상품/묶음 금액 차이로 분류했습니다. 세트 구성명 또는 금액 배수를 상품 조합 규칙에 추가합니다.";
    }
    if (candidate.amountMismatchCategory === "coupon_shipping") {
      return "쿠폰·배송비 금액 차이로 분류했습니다. 배송비, 쿠폰, 포인트 차감 값을 주문금액 계산에 포함합니다.";
    }
    return "상품 단가, 배송비, 쿠폰, 수량, 장바구니 묶음 규칙을 line item 기준으로 더 풀어야 합니다.";
  }
  if (candidate.orderCreateTimeBridge !== "exact") {
    return "complete_time 대신 order_time을 우선 보고, 주문 생성 시각과 버튼 클릭 시각이 얼마나 가까운지 기준을 조정합니다.";
  }
  if (!candidate.adClickKeyPresent) {
    return "버튼 클릭 시점에 gclid/gbraid/wbraid/fbclid/fbc/fbp를 함께 저장하도록 태그 저장값을 보강합니다.";
  }
  return result.status === "ambiguous"
    ? "후보가 여러 개라 1등/2등 차이를 더 벌릴 추가 키가 필요합니다. bridge path, 상품 idx, 세션 키를 같이 봅니다."
    : "수동 검토로 남깁니다.";
};

const buildRematchUnresolvedRows = ({
  orderResults,
  intentById,
  limit,
}: {
  orderResults: NpayRoasDryRunOrderResult[];
  intentById: Map<string, NpayRoasDryRunIntent>;
  limit: number;
}): NpayIntentRematchUnresolvedRow[] => {
  const priority = (result: NpayRoasDryRunOrderResult) => {
    if (result.ambiguousReasons.includes("amount_not_reconciled")) return 0;
    if (result.ambiguousReasons.includes("weak_time_gap")) return 1;
    if (result.status === "purchase_without_intent") return 2;
    if (result.strongGrade === "B") return 3;
    return 4;
  };

  return orderResults
    .filter((result) => result.status !== "strong_match" || result.strongGrade === "B")
    .sort((a, b) =>
      priority(a) - priority(b) ||
      Date.parse(b.order.paidAt) - Date.parse(a.order.paidAt),
    )
    .slice(0, limit)
    .map((result) => {
      const candidate = result.bestCandidate;
      const intent = candidate ? intentById.get(candidate.intentId) : null;
      const source = classifyNpayIntentSource(intent);
      return {
        orderNumber: result.order.orderNumber,
        channelOrderNo: result.order.channelOrderNo,
        status: result.status,
        strongGrade: result.strongGrade,
        paidAt: result.order.paidAt,
        paidAtBasis: result.order.paidAtBasis ?? null,
        orderCreatedAt: result.order.orderCreatedAt,
        orderAmount: result.order.orderAmount,
        orderItemTotal: result.order.orderItemTotal,
        deliveryPrice: result.order.deliveryPrice,
        discountAmount: result.order.discountAmount,
        quantity: result.order.quantity,
        productNames: result.order.productNames,
        bestIntentCapturedAt: intent?.capturedAt ?? "",
        bestIntentProductPrice: candidate?.intentProductPrice ?? null,
        bestIntentSourceChannel: source.channel,
        bestIntentSourceLabel: source.label,
        bestIntentHasGoogleClickId: intent ? hasGoogleClickIdInNpayIntent(intent) : false,
        bestIntentHasNpayBridgeUrlHash: Boolean(intent?.npayBridgeUrlHash),
        bestIntentBridgeHost: intent?.npayBridgeHost ?? "",
        timeGapMinutes: candidate?.timeGapMinutes ?? null,
        orderCreatedGapMinutes: candidate?.orderCreatedGapMinutes ?? null,
        orderCreateTimeBridge: candidate?.orderCreateTimeBridge ?? null,
        amountMatchType: candidate?.amountMatchType ?? "none_candidate",
        amountReconcileReason: candidate?.amountReconcileReason ?? "no_candidate_intent",
        amountMismatchCategory: candidate?.amountMismatchCategory ?? "no_candidate_intent",
        amountMismatchLabel: candidate?.amountMismatchLabel ?? "버튼 클릭 후보 없음",
        amountMismatchPlain:
          candidate?.amountMismatchPlain ??
          "주문 주변에서 비교할 NPay 버튼 클릭 row를 찾지 못해 금액 차이 원인을 분류하지 못했습니다.",
        amountMismatchConfidence: candidate?.amountMismatchConfidence ?? "low",
        amountMismatchSignals: candidate?.amountMismatchSignals ?? ["no_candidate_intent"],
        score: result.bestScore,
        scoreGap: result.scoreGap,
        candidateCount: result.candidateCount,
        ambiguousReasons: result.ambiguousReasons,
        availableFacts: buildUnresolvedAvailableFacts(result, candidate),
        missingFacts: buildUnresolvedMissingFacts(result, candidate),
        proposedFix: buildUnresolvedProposedFix(result, candidate),
      };
    });
};

const NPAY_UNRESOLVED_PRIMARY_REASON_LABELS: Record<string, { label: string; plain: string }> = {
  no_button_click_row: {
    label: "주문 근처 NPay 버튼 클릭 row 없음",
    plain:
      "실제 결제완료 주문은 있지만, 같은 분석 창 안에서 비교할 NPay 버튼 클릭 row를 찾지 못했습니다. 버튼 클릭 저장 누락, 분석 창 밖 클릭, 외부 결제 지연 가능성을 먼저 봅니다.",
  },
  missing_bridge_link: {
    label: "네이버 bridge URL 연결고리 없음",
    plain:
      "버튼 클릭 후보는 있지만 네이버 외부 결제창으로 넘어간 bridge URL hash가 없습니다. 네이버 화면을 지난 뒤 주문과 다시 붙일 연결고리가 약합니다.",
  },
  missing_order_time: {
    label: "주문 생성시각 없음",
    plain:
      "결제완료 주문에 order_time이 없거나 읽히지 않아, 버튼 클릭 직후 만들어진 주문인지 확인하기 어렵습니다.",
  },
  amount_quantity: {
    label: "수량 차이",
    plain:
      "버튼 클릭 단가와 실제 주문금액 차이가 수량 배수로 설명될 가능성이 있습니다. 수량 정보를 주문금액 조합 규칙에 반영해야 합니다.",
  },
  amount_cart_multi_item: {
    label: "장바구니/복수상품 차이",
    plain:
      "실제 결제금액이 단일 버튼 클릭 상품보다 큽니다. 여러 상품을 한 번에 결제한 주문일 수 있어 상품 조합 기준이 필요합니다.",
  },
  amount_set_or_bundle: {
    label: "세트상품/묶음 차이",
    plain:
      "세트상품, 정기구독, 묶음 할인처럼 상품명이나 단가가 단일 상품과 다르게 보이는 케이스입니다.",
  },
  amount_coupon_shipping: {
    label: "쿠폰·배송비 차이",
    plain:
      "상품금액과 최종 결제금액 사이에 배송비, 쿠폰, 포인트 차감이 끼어 있어 금액이 바로 맞지 않습니다.",
  },
  amount_insufficient_item_data: {
    label: "상품/금액 정보 부족",
    plain:
      "주문 안의 상품 단가, 수량, 배송비, 할인 정보가 충분하지 않아 자동 조합으로 금액을 설명하지 못했습니다.",
  },
  amount_unknown: {
    label: "아직 설명 안 된 금액 차이",
    plain:
      "현재 규칙으로는 금액 차이를 수량, 장바구니, 세트, 쿠폰·배송비 중 하나로 확정하지 못했습니다.",
  },
  order_time_not_exact: {
    label: "버튼 클릭과 주문 생성시각이 딱 맞지 않음",
    plain:
      "버튼 클릭 후보와 주문 생성시각이 1분 이내로 맞지 않아 자동 확정하지 않습니다. complete_time 지연과 order_time 품질을 같이 봐야 합니다.",
  },
  multiple_click_candidates: {
    label: "비슷한 버튼 클릭 후보가 여러 개",
    plain:
      "같은 상품이나 비슷한 시간대의 NPay 버튼 클릭이 여러 개라 어느 클릭이 실제 주문으로 이어졌는지 자동 확정하기 어렵습니다.",
  },
  score_gap_too_small: {
    label: "1등 후보와 2등 후보 차이가 작음",
    plain:
      "가장 유력한 후보와 다음 후보의 점수 차이가 작습니다. 잘못 붙이는 것을 막기 위해 보류합니다.",
  },
  source_click_id_missing: {
    label: "광고 click id/출처 증거 없음",
    plain:
      "주문과 버튼 클릭 후보는 있으나 gclid/gbraid/wbraid 또는 광고 출처 증거가 부족합니다. 내부 구매 연결과 Google Ads 전송 가능성을 분리해야 합니다.",
  },
  manual_review_remaining: {
    label: "수동 검토 잔여",
    plain:
      "기본 연결 재료는 있지만 현재 자동 규칙으로는 확정하지 않은 잔여 케이스입니다. 샘플을 보며 추가 규칙을 만들어야 합니다.",
  },
};

const amountReasonKey = (category: NpayIntentRematchUnresolvedRow["amountMismatchCategory"]) => {
  if (category === "quantity") return "amount_quantity";
  if (category === "cart_multi_item") return "amount_cart_multi_item";
  if (category === "set_or_bundle") return "amount_set_or_bundle";
  if (category === "coupon_shipping") return "amount_coupon_shipping";
  if (category === "insufficient_item_data") return "amount_insufficient_item_data";
  if (category === "unknown") return "amount_unknown";
  return "";
};

const classifyPrimaryUnresolvedReason = (row: NpayIntentRematchUnresolvedRow) => {
  if (
    row.status === "purchase_without_intent" ||
    row.candidateCount === 0 ||
    row.amountMismatchCategory === "no_candidate_intent"
  ) {
    return "no_button_click_row";
  }
  if (!row.bestIntentHasNpayBridgeUrlHash) return "missing_bridge_link";
  if (!row.orderCreatedAt || row.orderCreateTimeBridge === "missing") return "missing_order_time";

  const amountKey = amountReasonKey(row.amountMismatchCategory);
  if (
    amountKey &&
    row.amountMismatchCategory !== "matched_or_reconciled" &&
    row.amountMatchType !== "final_exact" &&
    row.amountMatchType !== "shipping_reconciled" &&
    row.amountMatchType !== "discount_reconciled" &&
    row.amountMatchType !== "quantity_reconciled" &&
    row.amountMatchType !== "bundle_multiple_reconciled"
  ) {
    return amountKey;
  }

  if (row.orderCreateTimeBridge && row.orderCreateTimeBridge !== "exact") return "order_time_not_exact";
  if (
    row.ambiguousReasons.includes("multiple_intents_same_product") ||
    row.ambiguousReasons.includes("same_product_multiple_clicks")
  ) {
    return "multiple_click_candidates";
  }
  if (row.ambiguousReasons.includes("low_score_gap")) return "score_gap_too_small";
  if (!row.bestIntentHasGoogleClickId) return "source_click_id_missing";
  return "manual_review_remaining";
};

export const buildNpayIntentUnresolvedReasonBreakdown = (
  unresolvedRows: NpayIntentRematchUnresolvedRow[],
): NpayIntentRematchUnresolvedReasonBreakdownRow[] => {
  const byReason = new Map<string, { count: number; sample: Set<string> }>();
  for (const row of unresolvedRows) {
    const reason = classifyPrimaryUnresolvedReason(row);
    const current = byReason.get(reason) ?? { count: 0, sample: new Set<string>() };
    current.count += 1;
    if (current.sample.size < 5) current.sample.add(row.orderNumber);
    byReason.set(reason, current);
  }

  const total = unresolvedRows.length;
  return Array.from(byReason.entries())
    .map(([reason, value]) => {
      const mapped = NPAY_UNRESOLVED_PRIMARY_REASON_LABELS[reason] ?? {
        label: reason,
        plain: "자동 분류 규칙이 아직 자세히 설명하지 못한 잔여 사유입니다.",
      };
      return {
        reason,
        label: mapped.label,
        completedOrders: value.count,
        sharePct: percent(value.count, total),
        sampleOrderCount: value.sample.size,
        plain: mapped.plain,
      };
    })
    .sort((a, b) => b.completedOrders - a.completedOrders || a.reason.localeCompare(b.reason));
};

const buildRematchDateDistribution = ({
  orderResults,
  rows,
  intentById,
}: {
  orderResults: NpayRoasDryRunOrderResult[];
  rows: NpayIntentRematchDryRunCandidate[];
  intentById: Map<string, NpayRoasDryRunIntent>;
}): NpayIntentRematchDateDistributionRow[] => {
  const rowByOrderNumber = new Map(rows.map((row) => [row.orderNumber, row]));
  const byDate = new Map<string, NpayIntentRematchDateDistributionRow>();

  for (const result of orderResults) {
    const dateKst = kstDateOnly(result.order.paidAt);
    const row = rowByOrderNumber.get(result.order.orderNumber);
    const intent = row ? intentById.get(row.intentId) : undefined;
    const current = byDate.get(dateKst) ?? {
      dateKst,
      completedOrders: 0,
      amountKrw: 0,
      strongMatch: 0,
      gradeA: 0,
      gradeB: 0,
      ambiguous: 0,
      purchaseWithoutIntent: 0,
      googleLikeCompletedOrders: 0,
      googleClickIdCompletedOrders: 0,
    };

    current.completedOrders += 1;
    current.amountKrw += result.order.orderAmount ?? 0;
    if (result.status === "strong_match") current.strongMatch += 1;
    if (result.status === "ambiguous") current.ambiguous += 1;
    if (result.status === "purchase_without_intent") current.purchaseWithoutIntent += 1;
    if (result.strongGrade === "A") current.gradeA += 1;
    if (result.strongGrade === "B") current.gradeB += 1;
    if (intent && isGoogleLikeNpayIntent(intent)) current.googleLikeCompletedOrders += 1;
    if (row?.clickIds.hasGoogleClickId) current.googleClickIdCompletedOrders += 1;

    byDate.set(dateKst, current);
  }

  return Array.from(byDate.values())
    .map((row) => ({
      ...row,
      amountKrw: round2(row.amountKrw),
    }))
    .sort((a, b) => a.dateKst.localeCompare(b.dateKst));
};

export const buildNpayIntentRematchDryRunReport = async (
  options: NpayIntentRematchDryRunOptions = {},
): Promise<NpayIntentRematchDryRunReport> => {
  const includeOnlyPending = options.includeOnlyPending !== false;
  const includeRawClickIds = options.includeRawClickIds !== false;
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const baseReport = await buildNpayRoasDryRunReport(options);
  const intentById = new Map(baseReport.intentResults.map((result) => [result.intent.id, result.intent]));
  const rows = baseReport.orderResults
    .filter((result) => result.status === "strong_match" && result.bestCandidate)
    .flatMap((result) => {
      const intentId = result.bestCandidate?.intentId ?? "";
      const intent = intentById.get(intentId);
      if (!intent) return [];
      const row = buildRematchCandidate(result, intent, includeRawClickIds);
      return row ? [row] : [];
    })
    .sort((a, b) =>
      Date.parse(b.paidAt) - Date.parse(a.paidAt)
      || b.score - a.score
      || a.orderNumber.localeCompare(b.orderNumber),
    );
  const pendingRows = rows.filter((row) => row.currentIntentMatchStatus === "pending" || !row.currentIntentMatchStatus);
  const nonPendingRows = rows.filter((row) => row.currentIntentMatchStatus && row.currentIntentMatchStatus !== "pending");
  const candidateRows = includeOnlyPending ? pendingRows : rows;
  const googleLikeIntents = baseReport.intentResults.filter((result) => isGoogleLikeNpayIntent(result.intent));
  const googleClickIdIntents = baseReport.intentResults.filter((result) => hasGoogleClickIdInNpayIntent(result.intent));
  const bridgeHashIntents = baseReport.intentResults.filter((result) => Boolean(result.intent.npayBridgeUrlHash));
  const matchedBridgeIntentIds = new Set(
    rows
      .filter((row) => row.npayBridgeUrlHashPresent)
      .map((row) => row.intentId)
      .filter(Boolean),
  );
  const enteredNotCompletedBreakdown = buildEnteredNotCompletedBreakdown({
    bridgeHashIntents,
    matchedBridgeIntentIds,
  });
  const googleLikeCompletedRows = rows.filter((row) => {
    const intent = intentById.get(row.intentId);
    return intent ? isGoogleLikeNpayIntent(intent) : false;
  });
  const dateDistribution = buildRematchDateDistribution({
    orderResults: baseReport.orderResults,
    rows,
    intentById,
  });
  const sourceFunnelComparison = buildNpayIntentSourceFunnelComparison({
    intentResults: baseReport.intentResults,
    rows,
    intentById,
  });
  const unresolvedRows = buildRematchUnresolvedRows({
    orderResults: baseReport.orderResults,
    intentById,
    limit,
  });
  const unresolvedReasonBreakdown = buildNpayIntentUnresolvedReasonBreakdown(unresolvedRows);

  return {
    ok: true,
    mode: "npay_intent_rematch_dry_run_read_only",
    generatedAt: new Date().toISOString(),
    source: baseReport.source,
    window: baseReport.window,
    thresholds: baseReport.thresholds,
    noWrite: true,
    noSend: true,
    rawIdentifierOutput: includeRawClickIds,
    summary: {
      liveIntentCount: baseReport.summary.liveIntentCount,
      googleLikeIntentCount: googleLikeIntents.length,
      googleLikeIntentWithGoogleClickId: googleLikeIntents.filter((result) =>
        hasGoogleClickIdInNpayIntent(result.intent),
      ).length,
      liveIntentWithNpayBridgeUrlHash: bridgeHashIntents.length,
      googleLikeIntentWithNpayBridgeUrlHash: googleLikeIntents.filter((result) =>
        Boolean(result.intent.npayBridgeUrlHash),
      ).length,
      enteredNotCompletedBreakdown,
      googleClickIdIntentCount: googleClickIdIntents.length,
      googleClickIdIntentBreakdown: {
        gclid: baseReport.intentResults.filter((result) => Boolean(result.intent.gclid)).length,
        gbraid: baseReport.intentResults.filter((result) => Boolean(result.intent.gbraid)).length,
        wbraid: baseReport.intentResults.filter((result) => Boolean(result.intent.wbraid)).length,
      },
      confirmedNpayOrderCount: baseReport.summary.confirmedNpayOrderCount,
      strongMatch: baseReport.summary.strongMatch,
      pendingStrongMatch: pendingRows.length,
      pendingStrongMatchWithGoogleClickId: pendingRows.filter((row) => row.clickIds.hasGoogleClickId).length,
      pendingGradeA: pendingRows.filter((row) => row.strongGrade === "A").length,
      pendingGradeB: pendingRows.filter((row) => row.strongGrade === "B").length,
      pendingOrderCreateBridgeExact: pendingRows.filter((row) => row.orderCreateTimeBridge === "exact").length,
      pendingOrderCreateBridgeExactWithGoogleClickId: pendingRows.filter(
        (row) => row.orderCreateTimeBridge === "exact" && row.clickIds.hasGoogleClickId,
      ).length,
      strongMatchWithNpayBridgeUrlHash: rows.filter((row) => row.npayBridgeUrlHashPresent).length,
      gradeAWithNpayBridgeUrlHash: rows.filter((row) =>
        row.strongGrade === "A" && row.npayBridgeUrlHashPresent,
      ).length,
      gradeAWithGoogleClickIdAndNpayBridgeUrlHash: rows.filter((row) =>
        row.strongGrade === "A" && row.clickIds.hasGoogleClickId && row.npayBridgeUrlHashPresent,
      ).length,
      googleLikeCompletedOrders: googleLikeCompletedRows.length,
      googleLikeCompletedAmountKrw: round2(
        googleLikeCompletedRows.reduce((sum, row) => sum + (row.orderAmount ?? 0), 0),
      ),
      googleLikeCompletedWithDirectGoogleClickId: googleLikeCompletedRows.filter(
        (row) => row.clickIds.hasGoogleClickId,
      ).length,
      blockedNonPendingIntent: nonPendingRows.length,
      ambiguous: baseReport.summary.ambiguous,
      purchaseWithoutIntent: baseReport.summary.purchaseWithoutIntent,
      uploadCandidateCount: 0,
      platformSendCandidateCount: 0,
    },
    candidates: candidateRows.slice(0, limit),
    blocked: nonPendingRows.slice(0, limit),
    ambiguousReasonBreakdown: baseReport.breakdowns.ambiguousReasons,
    dateDistribution,
    sourceFunnelComparison,
    unresolvedRows,
    unresolvedReasonBreakdown,
    notes: [
      "read-only dry-run only: npay_intent_log.match_status, matched_order_no, matched_at are not updated.",
      "This does not send GA4, Meta, TikTok, or Google Ads conversions.",
      "recommendedAction=safe_apply_candidate_after_write_approval still means DB write approval is required before applying.",
      "Grade B rows are useful for diagnosis and manual review, not automatic write/apply.",
      "order_create_time_bridge=exact is internal bridge evidence only. It does not bypass Grade A or platform-send guards.",
      "For NPay matching, order_time exact evidence is now the first timing anchor; complete_time/payment_time remains the payment-confirmed timestamp and can lag order_time.",
      "unresolved_reason_breakdown assigns one primary reason per unresolved order so the same order is not counted under many labels.",
    ],
  };
};

const markdownValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
};

const renderTable = (headers: string[], rows: unknown[][]) => {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(markdownValue).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
};

const kstDateSuffix = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");

export const renderNpayRoasDryRunMarkdown = (report: NpayRoasDryRunReport) => {
  const gradeAProductionResults = report.orderResults.filter(
    (result) => result.strongGrade === "A" && result.orderLabel === "production_order",
  );
  const bigQueryLookupIds = uniqueNonEmpty(
    gradeAProductionResults.flatMap((result) => result.ga4LookupIds),
  );
  const bigQueryIdLiteral = bigQueryLookupIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ");
  const tableSuffixStart = kstDateSuffix(report.window.start);
  const tableSuffixEnd = kstDateSuffix(report.window.end);
  const ambiguousRate = percent(report.summary.ambiguous, report.summary.confirmedNpayOrderCount);
  const gradeAProductionCount = gradeAProductionResults.length;
  const gradeAProductionUnknownCount = gradeAProductionResults.filter(
    (result) => result.dispatcherDryRun.alreadyInGa4 === "unknown",
  ).length;
  const gradeAProductionRobustAbsentCount = gradeAProductionResults.filter(
    (result) => result.dispatcherDryRun.alreadyInGa4 === "robust_absent",
  ).length;
  const earlyDecisionRows = [
    [
      "현재 표본 조기 진행",
      report.summary.liveIntentCount >= 100 && report.summary.confirmedNpayOrderCount >= 5
        ? "가능"
        : "보류",
      `${report.summary.liveIntentCount} intents / ${report.summary.confirmedNpayOrderCount} confirmed NPay orders`,
      "BigQuery guard, 수동 검토, GA4 MP 제한 테스트 승인안까지만 진행",
    ],
    [
      "자동 dispatcher",
      "금지",
      `ambiguous ${report.summary.ambiguous}건 (${ambiguousRate}%), already_in_ga4 unknown ${report.summary.alreadyInGa4LookupUnknown}건`,
      "7일 후보정 전 자동/대량 전송 금지",
    ],
    [
      "GA4 MP 제한 테스트",
      gradeAProductionCount > 0 ? "준비 가능" : "보류",
      `A급 production 후보 ${gradeAProductionCount}건, robust_absent ${gradeAProductionRobustAbsentCount}건, unknown ${gradeAProductionUnknownCount}건`,
      "두 ID 모두 GA4 robust_absent 확인 + TJ 승인 후에만 실제 전송",
    ],
    [
      "clicked_no_purchase 해석",
      report.summary.clickedNoPurchase >= 50 ? "가능" : "보류",
      `${report.summary.clickedNoPurchase}건`,
      "상품/광고키/시간대 가설 작성. audience 전송은 7일 후보정 후",
    ],
  ];

  const orderRows = report.orderResults.map((result) => [
    result.order.orderNumber,
    result.order.channelOrderNo,
    result.orderLabel,
    result.order.paidAt,
    result.order.orderCreatedAt,
    result.order.orderAmount,
    result.order.productNames.join(" + "),
    result.status,
    result.strongGrade,
    result.candidateCount,
    result.bestScore,
    result.secondScore,
    result.scoreGap,
    result.bestCandidate?.timeGapMinutes ?? null,
    result.bestCandidate?.orderCreatedGapMinutes ?? null,
    result.bestCandidate?.orderCreateTimeBridge ?? null,
    result.bestCandidate?.productNameMatchType ?? null,
    result.bestCandidate?.intentProductPrice ?? null,
    result.bestCandidate?.orderItemTotal ?? null,
    result.bestCandidate?.deliveryPrice ?? null,
    result.bestCandidate?.orderPaymentAmount ?? null,
    result.bestCandidate?.amountDelta ?? null,
    result.bestCandidate?.amountMatchType ?? null,
    result.bestCandidate?.amountReconcileReason ?? null,
    result.bestCandidate?.amountMismatchCategory ?? null,
    result.bestCandidate?.amountMismatchLabel ?? null,
    result.bestCandidate?.amountMismatchPlain ?? null,
    result.bestCandidate?.gaSessionIdPresent ? "Y" : "N",
    result.bestCandidate?.adClickKeyPresent ? "Y" : "N",
    result.dispatcherDryRun.alreadyInGa4,
    result.dispatcherDryRun.candidate ? "Y" : "N",
    result.dispatcherDryRun.blockReasons.join(", "),
    result.ambiguousReasons.join(", "),
    result.sendAllowed ? "Y" : "N",
  ]);

  const candidateRows = report.orderResults.flatMap((result) =>
    result.candidates.slice(0, 5).map((candidate, index) => [
      result.order.orderNumber,
      result.order.channelOrderNo,
      index + 1,
      candidate.intentId,
      candidate.capturedAt,
      candidate.timeGapMinutes,
      candidate.orderCreatedGapMinutes,
      candidate.orderCreateTimeBridge,
      candidate.score,
      `paidTime:${candidate.scoreComponents.time}, orderCreate:${candidate.scoreComponents.orderCreateTime}, product:${candidate.scoreComponents.productName}, amount:${candidate.scoreComponents.amount}`,
      candidate.productIdx,
      "N/A",
      candidate.productNameMatchType,
      candidate.intentProductPrice,
      candidate.orderItemTotal,
      candidate.deliveryPrice,
      candidate.orderPaymentAmount,
      candidate.amountDelta,
      candidate.amountMatchType,
      candidate.amountReconcileReason,
      candidate.amountMismatchCategory,
      candidate.amountMismatchLabel,
      candidate.clientIdPresent ? "Y" : "N",
      candidate.gaSessionIdPresent ? "Y" : "N",
      candidate.adClickKeys.join(", "),
      candidate.utm.source || candidate.utm.campaign,
    ]),
  );

  const bigQueryLookupRows = report.orderResults
    .filter((result) => result.strongGrade === "A" && result.orderLabel === "production_order")
    .map((result) => [
      result.order.orderNumber,
      result.order.channelOrderNo,
      result.ga4LookupIds.join(", "),
      "a_grade_production_candidate",
      result.dispatcherDryRun.alreadyInGa4,
      result.dispatcherDryRun.alreadyInGa4 === "unknown"
        ? "BigQuery 확인 필요"
        : result.dispatcherDryRun.alreadyInGa4 === "robust_absent"
          ? "robust query 확인됨"
          : "확인됨",
    ]);

  const manualReviewRows = report.orderResults
    .filter(
      (result) =>
        result.status === "ambiguous" ||
        result.strongGrade === "B" ||
        result.status === "purchase_without_intent",
    )
    .map((result) => {
      const best = result.bestCandidate;
      const group =
        result.status === "ambiguous"
          ? "ambiguous"
          : result.strongGrade === "B"
            ? "b_grade_strong"
            : "purchase_without_intent";
      const why =
        result.status === "ambiguous"
          ? result.ambiguousReasons.join(", ")
          : result.strongGrade === "B"
            ? result.dispatcherDryRun.blockReasons.join(", ")
            : "no_intent_candidate";
      const nextAction =
        result.status === "ambiguous"
          ? "같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인"
          : result.strongGrade === "B"
            ? "금액 조정 가능성 또는 장바구니/수량 구조 확인"
            : "GTM selector, 브라우저 차단, 주문 sync 누락 확인";

      return [
        result.order.orderNumber,
        result.order.channelOrderNo,
        group,
        result.order.orderAmount,
        result.order.productNames.join(" + "),
        result.bestScore,
        result.secondScore,
        result.scoreGap,
        best?.timeGapMinutes ?? null,
        best?.orderCreatedGapMinutes ?? null,
        best?.orderCreateTimeBridge ?? null,
        best?.amountMatchType ?? null,
        best?.amountMismatchCategory ?? null,
        best?.amountMismatchLabel ?? null,
        why,
        "전송 금지",
        nextAction,
      ];
    });

  const clickedNoPurchaseActionRows = report.breakdowns.clickedNoPurchase.byProduct
    .slice(0, 10)
    .map((row) => [
      row.productIdx,
      row.productName,
      row.count,
      `${row.sharePct}%`,
      "상품 상세/가격/배송비/결제 UX 가설 작성",
      "7일 후보정 전 audience 전송 금지",
    ]);

  const dispatcherRows = report.orderResults.map((result) => [
    result.ga4PayloadPreview.orderNumber,
    result.ga4PayloadPreview.channelOrderNo,
    result.ga4PayloadPreview.matchedIntentId,
    result.ga4PayloadPreview.clientId,
    result.ga4PayloadPreview.gaSessionId,
    result.ga4PayloadPreview.value,
    result.ga4PayloadPreview.currency,
    result.ga4PayloadPreview.eventId,
    result.ga4PayloadPreview.alreadyInGa4,
    result.ga4PayloadPreview.sendCandidate ? "Y" : "N",
    result.ga4PayloadPreview.blockReason.join(", "),
    result.ga4PayloadPreview.paidAt,
    result.ga4PayloadPreview.paidAtWithin72Hours ? "Y" : "N",
    result.ga4PayloadPreview.paidAtAgeHours,
    result.ga4PayloadPreview.clientIdPresent ? "Y" : "N",
    result.ga4PayloadPreview.gaSessionIdPresent ? "Y" : "N",
    result.ga4PayloadPreview.transactionId,
    result.ga4PayloadPreview.channelOrderNoParam,
    result.ga4PayloadPreview.timestampMicros,
    result.ga4PayloadPreview.dispatchDedupeKey,
  ]);
  const ambiguousReasonRows = report.breakdowns.ambiguousReasons.map((row) => [
    row.key,
    row.count,
    `${row.sharePct}%`,
    row.orderNumbers.join(", "),
  ]);
  const clickedNoPurchaseProductRows = report.breakdowns.clickedNoPurchase.byProduct
    .slice(0, 30)
    .map((row) => [row.productIdx, row.productName, row.count, `${row.sharePct}%`]);
  const clickedNoPurchaseAdKeyRows = report.breakdowns.clickedNoPurchase.byAdKey.map((row) => [
    row.key,
    row.count,
    `${row.sharePct}%`,
  ]);
  const clickedNoPurchaseHourRows = report.breakdowns.clickedNoPurchase.byKstHour.map((row) => [
    row.key,
    row.count,
    `${row.sharePct}%`,
  ]);

  return [
    "# NPay ROAS Dry-run Report",
    "",
    `Generated at: ${report.generatedAt}`,
    `Window: ${report.window.start} ~ ${report.window.end}`,
    "",
    "## Summary",
    "",
    renderTable(
      ["metric", "value"],
      [
        ["live_intent_count", report.summary.liveIntentCount],
        ["confirmed_npay_order_count", report.summary.confirmedNpayOrderCount],
        ["strong_match", report.summary.strongMatch],
        ["strong_match_a", report.summary.strongMatchA],
        ["strong_match_b", report.summary.strongMatchB],
        ["ambiguous", report.summary.ambiguous],
        ["purchase_without_intent", report.summary.purchaseWithoutIntent],
        ["dispatcher_dry_run_candidate", report.summary.dispatcherDryRunCandidate],
        ["already_in_ga4_blocked", report.summary.alreadyInGa4Blocked],
        ["already_in_ga4_lookup_present", report.summary.alreadyInGa4LookupPresent],
        ["already_in_ga4_lookup_robust_absent", report.summary.alreadyInGa4LookupRobustAbsent],
        ["already_in_ga4_lookup_absent", report.summary.alreadyInGa4LookupAbsent],
        ["already_in_ga4_lookup_unknown", report.summary.alreadyInGa4LookupUnknown],
        ["ga4_lookup_required_order_count", report.summary.ga4LookupRequiredOrderCount],
        ["ga4_lookup_id_count", report.summary.ga4LookupIdCount],
        ["test_order_blocked", report.summary.testOrderBlocked],
        ["manual_order_count", report.summary.manualOrderCount],
        ["shipping_reconciled_count", report.summary.shippingReconciledCount],
        ["shipping_reconciled_not_grade_a_count", report.summary.shippingReconciledNotGradeACount],
        ["order_create_bridge_exact", report.summary.orderCreateBridgeExact],
        ["order_create_bridge_exact_with_google_click_id", report.summary.orderCreateBridgeExactWithGoogleClickId],
        ["order_create_bridge_missing", report.summary.orderCreateBridgeMissing],
        ["clicked_purchased_candidate", report.summary.clickedPurchasedCandidate],
        ["clicked_no_purchase", report.summary.clickedNoPurchase],
        ["intent_pending", report.summary.intentPending],
      ],
    ),
    "",
    "## Early Phase2 Decision Package",
    "",
    "현재 누적 표본으로 먼저 진행할 수 있는 일과 아직 막아야 하는 일을 분리한다. 이 섹션은 승인안 준비용이며, 실제 전송이나 DB 업데이트를 하지 않는다.",
    "",
    renderTable(
      ["decision_item", "status", "evidence", "next_action"],
      earlyDecisionRows,
    ),
    "",
    "## Order Decisions",
    "",
    renderTable(
      [
        "order_number",
        "channel_order_no",
        "order_label",
        "paid_at",
        "order_created_at",
        "amount",
        "product",
        "status",
        "strong_grade",
        "candidate_count",
        "best_score",
        "second_score",
        "score_gap",
        "time_gap_min",
        "order_create_gap_min",
        "order_create_bridge",
        "product_name_match",
        "intent_product_price",
        "order_item_total",
        "delivery_price",
        "order_payment_amount",
        "amount_delta",
        "amount_match",
        "amount_reconcile_reason",
        "amount_mismatch_category",
        "amount_mismatch_label",
        "amount_mismatch_plain",
        "ga_session_id",
        "ad_key",
        "already_in_ga4",
        "dispatcher_candidate",
        "dispatcher_block_reason",
        "ambiguous_reason",
        "send_allowed",
      ],
      orderRows,
    ),
    "",
    "## Ambiguous Reason Breakdown",
    "",
    renderTable(
      ["reason", "orders", "share", "order_numbers"],
      ambiguousReasonRows,
    ),
    "",
    "## Manual Review Queue",
    "",
    "아래 주문은 자동 전송 후보가 아니다. 수동 검토로 규칙을 보강하거나 전송 제외를 확정해야 한다.",
    "",
    renderTable(
      [
        "order_number",
        "channel_order_no",
        "review_group",
        "amount",
        "product",
        "best_score",
        "second_score",
        "score_gap",
        "time_gap_min",
        "order_create_gap_min",
        "order_create_bridge",
        "amount_match",
        "amount_mismatch_category",
        "amount_mismatch_label",
        "why_review",
        "dispatch_decision",
        "next_action",
      ],
      manualReviewRows,
    ),
    "",
    "## Clicked No Purchase Breakdown",
    "",
    "아래 표는 `clicked_no_purchase` intent만 대상으로 한 read-only 분해다. 구매 전환 전송 대상이 아니며, 리마케팅/결제 UX 점검용이다.",
    "",
    "### By Product",
    "",
    renderTable(
      ["product_idx", "product_name", "clicked_no_purchase", "share"],
      clickedNoPurchaseProductRows,
    ),
    "",
    "### By Ad Key",
    "",
    renderTable(
      ["ad_key_combo", "clicked_no_purchase", "share"],
      clickedNoPurchaseAdKeyRows,
    ),
    "",
    "### By KST Hour",
    "",
    renderTable(
      ["kst_hour", "clicked_no_purchase", "share"],
      clickedNoPurchaseHourRows,
    ),
    "",
    "### Action Queue",
    "",
    "상위 미결제 클릭 상품은 purchase가 아니라 결제 UX와 리마케팅 검토 후보로만 본다.",
    "",
    renderTable(
      [
        "product_idx",
        "product_name",
        "clicked_no_purchase",
        "share",
        "analysis_action",
        "guardrail",
      ],
      clickedNoPurchaseActionRows,
    ),
    "",
    "## BigQuery Lookup IDs",
    "",
    "A급 production 후보는 `order_number`와 `channel_order_no`를 모두 GA4 raw/purchase에서 조회한다. 둘 중 하나라도 존재하면 `already_in_ga4=present`로 막고, 둘 다 robust query에서 조회되지 않은 경우 `already_in_ga4=robust_absent`로 표시한다.",
    "",
    renderTable(
      [
        "order_number",
        "channel_order_no",
        "lookup_ids",
        "candidate_scope",
        "already_in_ga4",
        "lookup_status",
      ],
      bigQueryLookupRows,
    ),
    "",
    "### BigQuery Query Template",
    "",
    "아래 쿼리는 템플릿이다. `<PROJECT>.<GA4_DATASET>`를 실제 GA4 export dataset으로 바꿔 실행한다. `order_number`와 `channel_order_no` 중 하나라도 조회되면 해당 주문은 `already_in_ga4=present`로 막는다.",
    "",
    "```sql",
    "WITH ids AS (",
    `  SELECT id FROM UNNEST([${bigQueryIdLiteral || "''"}]) AS id`,
    ")",
    "SELECT",
    "  event_date,",
    "  event_timestamp,",
    "  event_name,",
    "  ecommerce.transaction_id AS ecommerce_transaction_id,",
    "  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS event_param_transaction_id,",
    "  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method') AS pay_method",
    "FROM `<PROJECT>.<GA4_DATASET>.events_*`",
    `WHERE _TABLE_SUFFIX BETWEEN '${tableSuffixStart}' AND '${tableSuffixEnd}'`,
    "  AND (",
    "    ecommerce.transaction_id IN (SELECT id FROM ids)",
    "    OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') IN (SELECT id FROM ids)",
    "    OR EXISTS (",
    "      SELECT 1",
    "      FROM UNNEST(event_params) ep",
    "      WHERE ep.value.string_value IN (SELECT id FROM ids)",
    "    )",
    "  )",
    "ORDER BY event_timestamp;",
    "```",
    "",
    "## Dispatcher Dry-run Log",
    "",
    "아래 표는 GA4 Measurement Protocol payload preview다. 실제 전송은 하지 않고, `send_candidate=Y`인 행도 승인 전까지 전송 금지다.",
    "",
    renderTable(
      [
        "order_number",
        "channel_order_no",
        "matched_intent_id",
        "client_id",
        "ga_session_id",
        "value",
        "currency",
        "event_id",
        "already_in_ga4",
        "send_candidate",
        "block_reason",
        "paid_at",
        "paid_at_72h",
        "paid_at_age_hours",
        "client_id_present",
        "ga_session_id_present",
        "transaction_id",
        "channel_order_no_param",
        "timestamp_micros",
        "dispatch_dedupe_key",
      ],
      dispatcherRows,
    ),
    "",
    "## Amount Reconciliation",
    "",
    renderTable(
      ["amount_match_type", "orders"],
      AMOUNT_MATCH_TYPES.map((type) => [type, report.summary.amountMatchTypeCounts[type]]),
    ),
    "",
    "## Top Candidate Intents",
    "",
    renderTable(
      [
        "order_number",
        "channel_order_no",
        "rank",
        "intent_id",
        "captured_at",
        "time_gap_min",
        "order_create_gap_min",
        "order_create_bridge",
        "score",
        "score_components",
        "product_idx",
        "order_product_idx",
        "product_name_match",
        "intent_product_price",
        "order_item_total",
        "delivery_price",
        "order_payment_amount",
        "amount_delta",
        "amount_match",
        "amount_reconcile_reason",
        "amount_mismatch_category",
        "amount_mismatch_label",
        "client_id",
        "ga_session_id",
        "ad_keys",
        "utm",
      ],
      candidateRows,
    ),
    "",
    "## Guardrail",
    "",
    "- 아직 purchase dispatcher를 열지 않는다.",
    "- 이 리포트는 DB 상태를 바꾸지 않는다.",
    "- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.",
    "- 이 리포트 변경만으로 운영 endpoint를 배포하지 않는다.",
    "- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.",
    "- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.",
    "- robust_absent는 order_number와 channel_order_no가 GA4 raw/purchase 전체 robust query에서 모두 조회되지 않은 상태다.",
    "- 테스트/수동 테스트 라벨 주문은 전송 후보에서 제외한다.",
  ].join("\n");
};

export const _internal_npayRoasDryRun = {
  amountMatch,
  buildCandidate,
  buildGa4LookupIds,
  classifyStrongGrade,
  resolveGa4Presence,
};
