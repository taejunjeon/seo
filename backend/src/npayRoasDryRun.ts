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
  paidAt: string;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: string | number | null;
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
  paidAt: string;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number | null;
  productNames: string[];
  lineProductCount: number;
};

export type NpayRoasDryRunManualOrderInput = {
  orderNumber: string;
  paidAt: string;
  orderAmount: number;
  productName: string;
  paymentMethod?: string;
  paymentStatus?: string;
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
  amountMatch: boolean;
  amountMatchType: "exact" | "multiple" | "near" | "none" | "unknown";
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

export type NpayRoasDryRunOrderResult = {
  order: NpayRoasDryRunOrder;
  orderLabel: NpayRoasDryRunOrderLabel;
  status: NpayRoasDryRunOrderStatus;
  strongGrade: NpayRoasDryRunStrongGrade | null;
  sendAllowed: false;
  dispatcherDryRun: {
    candidate: boolean;
    dryRunOnly: true;
    alreadyInGa4: NpayRoasDryRunGa4Presence;
    blockReasons: string[];
  };
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
      requiredAmountMatchType: "exact";
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
    testOrderBlocked: number;
    manualOrderCount: number;
    clickedPurchasedCandidate: number;
    clickedNoPurchase: number;
    intentPending: number;
  };
  orderResults: NpayRoasDryRunOrderResult[];
  intentResults: NpayRoasDryRunIntentResult[];
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
  paidAt: new Date(row.paidAt).toISOString(),
  paymentMethod: row.paymentMethod,
  paymentStatus: row.paymentStatus,
  orderAmount: numberValue(row.orderAmount),
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
    paidAt: paidAt.toISOString(),
    paymentMethod: input.paymentMethod?.trim() || "NAVERPAY_ORDER",
    paymentStatus: input.paymentStatus?.trim() || "PAYMENT_COMPLETE",
    orderAmount: input.orderAmount,
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

const amountMatch = (intentPrice: number | null, orderAmount: number | null) => {
  if (!intentPrice || !orderAmount) return { type: "unknown" as const, score: 0, matched: false };
  if (intentPrice === orderAmount) return { type: "exact" as const, score: 20, matched: true };
  const ratio = orderAmount / intentPrice;
  if (Number.isFinite(ratio) && ratio >= 2 && Math.abs(ratio - Math.round(ratio)) <= 0.05) {
    return { type: "multiple" as const, score: 12, matched: true };
  }
  const diffRate = Math.abs(orderAmount - intentPrice) / Math.max(orderAmount, intentPrice);
  if (diffRate <= 0.05) return { type: "near" as const, score: 8, matched: true };
  return { type: "none" as const, score: 0, matched: false };
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
  const amount = amountMatch(intent.productPrice, order.orderAmount);
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
    amountMatch: amount.matched,
    amountMatchType: amount.type,
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
  if (!best.memberKeyPresent) reasons.add("no_member_key");
  if (best.productNameMatchType !== "exact") reasons.add("product_name_variant");
  if (scoreGap !== null && scoreGap <= minScoreGap) reasons.add("low_score_gap");
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
    bestCandidate.amountMatchType === "exact" &&
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
  if (orderLabel !== "production_order") blockReasons.push("test_order");

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
        COALESCE(NULLIF(TRIM(cancellation_reason::text), ''), '') AS cancellation_reason,
        COALESCE(NULLIF(TRIM(return_reason::text), ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
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
      "paidAt",
      "paymentMethod",
      "paymentStatus",
      "orderAmount",
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
    (order) => selectedOrderNumbers.size === 0 || selectedOrderNumbers.has(order.orderNumber),
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
    const alreadyInGa4: NpayRoasDryRunGa4Presence = ga4PresentOrderNumbers.has(order.orderNumber)
      ? "present"
      : ga4AbsentOrderNumbers.has(order.orderNumber)
        ? "absent"
        : "unknown";
    const orderLabel: NpayRoasDryRunOrderLabel = testOrderNumbers.has(order.orderNumber)
      ? testOrderLabel
      : "production_order";
    const dispatcherDryRun = buildDispatcherDryRunGuard(
      status,
      strongGrade,
      alreadyInGa4,
      orderLabel,
    );
    const ambiguousReasons =
      status === "ambiguous" ? buildAmbiguousReasons(candidates, minScoreGap, scoreGap) : [];

    return {
      order,
      orderLabel,
      status,
      strongGrade,
      sendAllowed: false,
      dispatcherDryRun,
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
      if (result.orderLabel !== "production_order") acc.testOrderBlocked += 1;
      if (manualOrderNumbers.has(result.order.orderNumber)) acc.manualOrderCount += 1;
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
      testOrderBlocked: 0,
      manualOrderCount: 0,
    } as Record<NpayRoasDryRunOrderStatus, number> & {
      strongMatchA: number;
      strongMatchB: number;
      dispatcherDryRunCandidate: number;
      alreadyInGa4Blocked: number;
      testOrderBlocked: number;
      manualOrderCount: number;
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
        requiredAmountMatchType: "exact",
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
      testOrderBlocked: orderSummary.testOrderBlocked,
      manualOrderCount: orderSummary.manualOrderCount,
      clickedPurchasedCandidate: intentSummary.clicked_purchased_candidate,
      clickedNoPurchase: intentSummary.clicked_no_purchase,
      intentPending: intentSummary.intent_pending,
    },
    orderResults,
    intentResults,
    notes: [
      "This report is read-only. It does not update npay_intent_log.match_status.",
      "This report does not send GA4, Meta, TikTok, or Google Ads purchase events.",
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
  const orderRows = report.orderResults.map((result) => [
    result.order.orderNumber,
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
    result.bestCandidate?.amountMatchType ?? null,
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
      index + 1,
      candidate.intentId,
      candidate.capturedAt,
      candidate.timeGapMinutes,
      candidate.score,
      `time:${candidate.scoreComponents.time}, product:${candidate.scoreComponents.productName}, amount:${candidate.scoreComponents.amount}`,
      candidate.productIdx,
      "N/A",
      candidate.productNameMatchType,
      candidate.amountMatchType,
      candidate.clientIdPresent ? "Y" : "N",
      candidate.gaSessionIdPresent ? "Y" : "N",
      candidate.adClickKeys.join(", "),
      candidate.utm.source || candidate.utm.campaign,
    ]),
  );

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
        ["test_order_blocked", report.summary.testOrderBlocked],
        ["manual_order_count", report.summary.manualOrderCount],
        ["clicked_purchased_candidate", report.summary.clickedPurchasedCandidate],
        ["clicked_no_purchase", report.summary.clickedNoPurchase],
        ["intent_pending", report.summary.intentPending],
      ],
    ),
    "",
    "## Order Decisions",
    "",
    renderTable(
      [
        "order_number",
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
        "amount_match",
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
    "## Top Candidate Intents",
    "",
    renderTable(
      [
        "order_number",
        "rank",
        "intent_id",
        "captured_at",
        "time_gap_min",
        "score",
        "score_components",
        "product_idx",
        "order_product_idx",
        "product_name_match",
        "amount_match",
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
    "- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.",
    "- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.",
    "- test_order 라벨 주문은 전송 후보에서 제외한다.",
  ].join("\n");
};
