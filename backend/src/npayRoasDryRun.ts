import path from "node:path";

import Database from "better-sqlite3";

import { queryPg } from "./postgres";

export const DEFAULT_NPAY_ROAS_DRY_RUN_START = "2026-04-27T09:10:00.000Z";

export type NpayRoasDryRunOrderStatus =
  | "strong_match"
  | "ambiguous"
  | "purchase_without_intent";

export type NpayRoasDryRunStrongGrade = "A" | "B";

export type NpayRoasDryRunGa4Presence = "present" | "absent" | "unknown";

export type NpayRoasDryRunOrderLabel = string;

export type NpayRoasDryRunIntentStatus =
  | "clicked_purchased_candidate"
  | "clicked_no_purchase"
  | "intent_pending";

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
  | "cart_contains_item"
  | "near"
  | "none"
  | "unknown";

const AMOUNT_MATCH_TYPES: NpayRoasDryRunAmountMatchType[] = [
  "final_exact",
  "item_exact",
  "shipping_reconciled",
  "discount_reconciled",
  "quantity_reconciled",
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
  capturedAt: string;
  timeGapMinutes: number;
  score: number;
  scoreComponents: {
    time: number;
    productName: number;
    amount: number;
    identity: number;
    session: number;
    adKey: number;
  };
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
  clientId: string;
  gaSessionId: string;
  clientIdPresent: boolean;
  gaSessionIdPresent: boolean;
  gaSessionNumberPresent: boolean;
  adClickKeyPresent: boolean;
  adClickKeys: string[];
  memberKeyPresent: boolean;
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
  matchedIntentId: string | null;
  clientId: string;
  gaSessionId: string;
  value: number | null;
  currency: "KRW";
  eventId: string;
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
    alreadyInGa4LookupAbsent: number;
    alreadyInGa4LookupUnknown: number;
    ga4LookupRequiredOrderCount: number;
    ga4LookupIdCount: number;
    testOrderBlocked: number;
    manualOrderCount: number;
    amountMatchTypeCounts: Record<NpayRoasDryRunAmountMatchType, number>;
    shippingReconciledCount: number;
    shippingReconciledNotGradeACount: number;
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
  ga4AbsentOrderNumbers?: string[];
  testOrderNumbers?: string[];
  testOrderLabel?: string;
  orderNumbers?: string[];
  manualOrders?: NpayRoasDryRunManualOrderInput[];
};

const numberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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
  const normalized = isPlainDateTimeWithoutZone(trimmed)
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

const buildGa4LookupIds = (order: NpayRoasDryRunOrder) =>
  uniqueNonEmpty([order.orderNumber, order.channelOrderNo]);

const resolveGa4Presence = (
  lookupIds: string[],
  presentIds: Set<string>,
  absentIds: Set<string>,
): NpayRoasDryRunGa4Presence => {
  if (lookupIds.some((id) => presentIds.has(id))) return "present";
  if (lookupIds.length > 0 && lookupIds.every((id) => absentIds.has(id))) return "absent";
  return "unknown";
};

const buildGa4PayloadPreview = (
  order: NpayRoasDryRunOrder,
  bestCandidate: NpayRoasDryRunCandidate | null,
  dispatcherDryRun: NpayRoasDryRunOrderResult["dispatcherDryRun"],
): NpayRoasDryRunGa4PayloadPreview => ({
  orderNumber: order.orderNumber,
  channelOrderNo: order.channelOrderNo,
  matchedIntentId: bestCandidate?.intentId ?? null,
  clientId: bestCandidate?.clientId ?? "",
  gaSessionId: bestCandidate?.gaSessionId ?? "",
  value: order.orderAmount,
  currency: "KRW",
  eventId: `NPayRecoveredPurchase_${order.orderNumber}`,
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

const scoreTimeGap = (timeGapMinutes: number) => {
  if (timeGapMinutes < 0) return 0;
  if (timeGapMinutes <= 1) return 30;
  if (timeGapMinutes <= 15) return 20;
  if (timeGapMinutes <= 60) return 10;
  if (timeGapMinutes <= 24 * 60) return 2;
  return 0;
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

  if (itemExact) {
    return {
      type: "item_exact" as const,
      score: 16,
      matched: true,
      amountDelta,
      reason: "intent_product_price == order_item_total",
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
  const productMatch = productNameMatch(intent.productName, order.productNames);
  const amount = amountMatch(intent.productPrice, order, productMatch.matched);
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
    productName: productMatch.score,
    amount: amount.score,
    identity: 0,
    session: 0,
    adKey: 0,
  };

  return {
    intentId: intent.id,
    intentKey: intent.intentKey,
    capturedAt: intent.capturedAt,
    timeGapMinutes,
    score:
      scoreComponents.time +
      scoreComponents.productName +
      scoreComponents.amount +
      scoreComponents.identity +
      scoreComponents.session +
      scoreComponents.adKey,
    scoreComponents,
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
    clientId: intent.clientId,
    gaSessionId: intent.gaSessionId,
    clientIdPresent: Boolean(intent.clientId),
    gaSessionIdPresent: Boolean(intent.gaSessionId),
    gaSessionNumberPresent: Boolean(intent.gaSessionNumber),
    adClickKeyPresent: adClickKeys.length > 0,
    adClickKeys,
    memberKeyPresent,
    utm: {
      source: intent.utmSource,
      medium: intent.utmMedium,
      campaign: intent.utmCampaign,
    },
    pageLocation: intent.pageLocation,
  };
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
  if (best.scoreComponents.time < 20) reasons.add("weak_time_gap");
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
  const isGradeA =
    bestScore >= thresholds.minScore &&
    GRADE_A_AMOUNT_MATCH_TYPES.has(bestCandidate.amountMatchType) &&
    bestCandidate.timeGapMinutes <= thresholds.maxTimeGapMinutes &&
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
    const rows = db
      .prepare(
        `
        SELECT
          id, intent_key, site, source, environment, match_status, captured_at, received_at,
          client_id, ga_cookie_raw, ga_session_id, ga_session_number,
          gclid, gbraid, wbraid, fbp, fbc, fbclid,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          page_location, page_referrer, product_idx, product_name, product_price,
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
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        SUM(COALESCE(total_price, item_price * purchase_quantity, 0))::numeric AS "orderItemTotal",
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
  const ga4AbsentOrderNumbers = normalizeOrderNumberSet(options.ga4AbsentOrderNumbers);
  const testOrderNumbers = normalizeOrderNumberSet(options.testOrderNumbers);
  const testOrderLabel = options.testOrderLabel?.trim() || "test_order";
  const selectedOrderNumbers = normalizeOrderNumberSet(options.orderNumbers);
  const manualOrders = (options.manualOrders ?? []).map(toManualOrder);
  const manualOrderNumbers = new Set(manualOrders.map((order) => order.orderNumber));

  const intents = readLiveIntents(sqlitePath, site, start, end);
  const pgOrders = await readConfirmedNpayOrders(start, end);
  const orderMap = new Map(pgOrders.map((order) => [order.orderNumber, order]));
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
    const candidates = intents
      .filter((intent) => {
        const capturedAtMs = Date.parse(intent.capturedAt);
        return capturedAtMs <= paidAtMs && paidAtMs - capturedAtMs <= lookbackMs;
      })
      .map((intent) => buildCandidate(order, intent))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Math.abs(a.timeGapMinutes) - Math.abs(b.timeGapMinutes);
      })
      .slice(0, maxCandidatesPerOrder);

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
    const ga4PayloadPreview = buildGa4PayloadPreview(order, bestCandidate, dispatcherDryRun);
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
    } as Record<NpayRoasDryRunOrderStatus, number> & {
      strongMatchA: number;
      strongMatchB: number;
      dispatcherDryRunCandidate: number;
      alreadyInGa4Blocked: number;
      alreadyInGa4LookupPresent: number;
      alreadyInGa4LookupAbsent: number;
      alreadyInGa4LookupUnknown: number;
      ga4LookupRequiredOrderCount: number;
      ga4LookupIdCount: number;
      testOrderBlocked: number;
      manualOrderCount: number;
      amountMatchTypeCounts: Record<NpayRoasDryRunAmountMatchType, number>;
      shippingReconciledCount: number;
      shippingReconciledNotGradeACount: number;
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
      orders: "readonly operational_postgres.public.tb_iamweb_users",
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
      alreadyInGa4LookupAbsent: orderSummary.alreadyInGa4LookupAbsent,
      alreadyInGa4LookupUnknown: orderSummary.alreadyInGa4LookupUnknown,
      ga4LookupRequiredOrderCount: orderSummary.ga4LookupRequiredOrderCount,
      ga4LookupIdCount: orderSummary.ga4LookupIdCount,
      testOrderBlocked: orderSummary.testOrderBlocked,
      manualOrderCount: orderSummary.manualOrderCount,
      amountMatchTypeCounts: orderSummary.amountMatchTypeCounts,
      shippingReconciledCount: orderSummary.shippingReconciledCount,
      shippingReconciledNotGradeACount: orderSummary.shippingReconciledNotGradeACount,
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
      "Only A-grade strong matches with already_in_ga4=absent are future dispatcher dry-run candidates; B-grade strong, ambiguous, purchase_without_intent, test orders, and already_in_ga4 rows are blocked.",
      "Manual orders are dry-run inputs only and are not written to any database.",
      "product_idx_match is null because tb_iamweb_users does not expose an order-level product_idx in this read model.",
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

export const renderNpayRoasDryRunMarkdown = (report: NpayRoasDryRunReport) => {
  const gradeAProductionResults = report.orderResults.filter(
    (result) => result.strongGrade === "A" && result.orderLabel === "production_order",
  );
  const bigQueryLookupIds = uniqueNonEmpty(
    gradeAProductionResults.flatMap((result) => result.ga4LookupIds),
  );
  const bigQueryIdLiteral = bigQueryLookupIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ");
  const ambiguousRate = percent(report.summary.ambiguous, report.summary.confirmedNpayOrderCount);
  const gradeAProductionCount = gradeAProductionResults.length;
  const gradeAProductionUnknownCount = gradeAProductionResults.filter(
    (result) => result.dispatcherDryRun.alreadyInGa4 === "unknown",
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
      `A급 production 후보 ${gradeAProductionCount}건, unknown ${gradeAProductionUnknownCount}건`,
      "두 ID 모두 GA4 absent 확인 + TJ 승인 후에만 실제 전송",
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
    result.order.orderAmount,
    result.order.productNames.join(" + "),
    result.status,
    result.strongGrade,
    result.candidateCount,
    result.bestScore,
    result.secondScore,
    result.scoreGap,
    result.bestCandidate?.timeGapMinutes ?? null,
    result.bestCandidate?.productNameMatchType ?? null,
    result.bestCandidate?.intentProductPrice ?? null,
    result.bestCandidate?.orderItemTotal ?? null,
    result.bestCandidate?.deliveryPrice ?? null,
    result.bestCandidate?.orderPaymentAmount ?? null,
    result.bestCandidate?.amountDelta ?? null,
    result.bestCandidate?.amountMatchType ?? null,
    result.bestCandidate?.amountReconcileReason ?? null,
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
      candidate.score,
      `time:${candidate.scoreComponents.time}, product:${candidate.scoreComponents.productName}, amount:${candidate.scoreComponents.amount}`,
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
      result.dispatcherDryRun.alreadyInGa4 === "unknown" ? "BigQuery 확인 필요" : "확인됨",
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
        best?.amountMatchType ?? null,
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
    result.ga4PayloadPreview.sendCandidate ? "Y" : "N",
    result.ga4PayloadPreview.blockReason.join(", "),
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
        ["already_in_ga4_lookup_absent", report.summary.alreadyInGa4LookupAbsent],
        ["already_in_ga4_lookup_unknown", report.summary.alreadyInGa4LookupUnknown],
        ["ga4_lookup_required_order_count", report.summary.ga4LookupRequiredOrderCount],
        ["ga4_lookup_id_count", report.summary.ga4LookupIdCount],
        ["test_order_blocked", report.summary.testOrderBlocked],
        ["manual_order_count", report.summary.manualOrderCount],
        ["shipping_reconciled_count", report.summary.shippingReconciledCount],
        ["shipping_reconciled_not_grade_a_count", report.summary.shippingReconciledNotGradeACount],
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
        "amount",
        "product",
        "status",
        "strong_grade",
        "candidate_count",
        "best_score",
        "second_score",
        "score_gap",
        "time_gap_min",
        "product_name_match",
        "intent_product_price",
        "order_item_total",
        "delivery_price",
        "order_payment_amount",
        "amount_delta",
        "amount_match",
        "amount_reconcile_reason",
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
        "amount_match",
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
    "A급 production 후보는 `order_number`와 `channel_order_no`를 모두 GA4 raw/purchase에서 조회한다. 둘 중 하나라도 존재하면 `already_in_ga4=present`로 막고, 둘 다 조회해 absent가 확인된 경우에만 dispatcher dry-run 후보가 된다.",
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
    "WHERE _TABLE_SUFFIX BETWEEN '20260427' AND '20260504'",
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
        "send_candidate",
        "block_reason",
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
