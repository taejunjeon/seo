import type { AttributionLedgerEntry } from "./attribution";
import { listAttributionLedgerEntries } from "./attributionLedgerDb";
import { categorizeProductName, type ConsultationProductCategory } from "./consultation";
import { getCrmDb } from "./crmLocalDb";
import { normalizePhoneDigits } from "./orderKeys";

export const ACQUISITION_CHANNELS = ["youtube", "meta", "tiktok", "google", "other"] as const;

export type AcquisitionChannel = typeof ACQUISITION_CHANNELS[number];
export type FirstPurchaseCategory = ConsultationProductCategory;

export type ChannelClassificationInput = {
  utmSource?: unknown;
  utm_source?: unknown;
  referrer?: unknown;
  fbclid?: unknown;
  ttclid?: unknown;
  gclid?: unknown;
};

export type FirstTouchSnapshot = {
  customer_key: string;
  first_touch_at: string;
  acquisition_channel: AcquisitionChannel;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

export type CohortLtrSample = {
  customer_key: string;
  first_touch_at: string;
  utm_source: string;
  utm_campaign: string;
  first_purchase_category: FirstPurchaseCategory;
  first_purchase_item_name: string;
  is_dangdangcare: boolean;
  ltr_30d: number | null;
  ltr_90d: number | null;
  ltr_180d: number | null;
};

type CohortWindowSummary = {
  n: number;
  revenue: number;
  median: number | null;
};

export type AttributionCohortLtrChannel = {
  channel: AcquisitionChannel;
  customerCount: number;
  matureCohort: {
    d30: CohortWindowSummary;
    d90: CohortWindowSummary;
    d180: CohortWindowSummary;
  };
  sampleFirstTouches: CohortLtrSample[];
};

export type AttributionCohortLtrReport = {
  generatedAt: string;
  range: {
    startAt: string;
    endAt: string;
  };
  channels: AttributionCohortLtrChannel[];
};

export type FirstPurchaseSnapshot = FirstTouchSnapshot & {
  first_purchase_category: FirstPurchaseCategory;
  first_purchase_item_name: string;
  first_purchase_order_key: string | null;
  first_purchase_at: string | null;
  first_purchase_amount: number | null;
  is_dangdangcare: boolean;
};

export type ChannelCategoryRepeatCell = {
  channel: AcquisitionChannel;
  category: FirstPurchaseCategory;
  isDangdangcare: boolean;
  customerCount: number;
  repeaterCount: number;
  repeatRate: number;
  medianFirstPurchaseAmount: number | null;
  median180dLtr: number | null;
};

export type ChannelCategoryRepeatReport = {
  generatedAt: string;
  range: {
    startAt: string;
    endAt: string;
  };
  cells: ChannelCategoryRepeatCell[];
};

export type ReverseFunnelSummary = {
  supplementFirstBuyers: number;
  convertedToTest: number;
  rate: number;
};

export type ReverseFunnelChannel = ReverseFunnelSummary & {
  channel: AcquisitionChannel;
};

export type ReverseFunnelReport = {
  generatedAt: string;
  range: {
    startAt: string;
    endAt: string;
  };
  overall: ReverseFunnelSummary;
  byChannel: ReverseFunnelChannel[];
};

type ImwebOrderLtrRow = {
  order_key: string;
  order_no: string | null;
  order_code: string | null;
  member_code: string | null;
  orderer_call: string | null;
  payment_amount: number | null;
  order_time: string | null;
  order_time_unix: number | null;
  raw_json: string | null;
};

type LtrOrder = {
  orderKey: string;
  orderNo: string;
  orderCode: string;
  memberCode: string;
  normalizedPhone: string;
  orderTimeMs: number;
  orderTimeText: string;
  amount: number;
  itemNames: string[];
};

type CustomerLtr = FirstPurchaseSnapshot & {
  ltr_30d: number | null;
  ltr_90d: number | null;
  ltr_180d: number | null;
};

type PurchaseCohortRow = FirstPurchaseSnapshot & {
  firstTouchMs: number;
  orders180d: LtrOrder[];
  ltr180d: number;
  hasRepeat180d: boolean;
  hasTestKitOrder180d: boolean;
};

const DAY_MS = 86400000;
const PRODUCT_CATEGORIES: FirstPurchaseCategory[] = ["test_kit", "supplement", "other"];
const PRODUCT_CATEGORY_PRIORITY: FirstPurchaseCategory[] = ["test_kit", "supplement", "other"];
const LTR_WINDOWS = [
  { key: "ltr_30d", summaryKey: "d30", days: 30 },
  { key: "ltr_90d", summaryKey: "d90", days: 90 },
  { key: "ltr_180d", summaryKey: "d180", days: 180 },
] as const;
const ORDER_ITEM_TABLE = "imweb_order_items";
const ORDER_ITEM_ORDER_COLUMNS = ["order_key", "order_no", "order_code", "shop_order_code"];
const ORDER_ITEM_NAME_COLUMNS = ["item_name", "product_name", "prod_name", "name"];
const RAW_PRODUCT_ARRAY_KEYS = [
  "items",
  "order_items",
  "orderItems",
  "products",
  "goods",
  "prod_order",
  "product_list",
  "item_list",
];
const RAW_PRODUCT_NAME_KEYS = ["item_name", "product_name", "prod_name", "order_name"];
const RAW_GENERIC_NAME_KEYS = ["name", "title"];

export class CohortValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CohortValidationError";
  }
}

const readString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
};

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = readString(value);
    if (text) return text;
  }
  return "";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const quoteSqlIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`invalid SQLite identifier: ${value}`);
  }
  return `"${value}"`;
};

const getTableColumns = (tableName: string) => (
  getCrmDb()
    .prepare(`PRAGMA table_info(${quoteSqlIdentifier(tableName)})`)
    .all() as Array<{ name: string }>
).map((column) => column.name);

const hasTable = (tableName: string) => {
  const row = getCrmDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
};

const pickColumn = (columns: string[], candidates: string[]) =>
  candidates.find((candidate) => columns.includes(candidate)) ?? null;

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = readString(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
};

const readNamedProductFields = (record: Record<string, unknown>, keys: string[]) =>
  keys.map((key) => readString(record[key])).filter(Boolean);

const collectRawProductNamesFromValue = (value: unknown, allowGenericName: boolean): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRawProductNamesFromValue(item, true));
  }
  if (!isRecord(value)) return [];

  const names = [
    ...readNamedProductFields(value, RAW_PRODUCT_NAME_KEYS),
    ...(allowGenericName ? readNamedProductFields(value, RAW_GENERIC_NAME_KEYS) : []),
  ];

  for (const key of RAW_PRODUCT_ARRAY_KEYS) {
    if (key in value) {
      names.push(...collectRawProductNamesFromValue(value[key], true));
    }
  }

  if (isRecord(value.ecommerce)) {
    names.push(...collectRawProductNamesFromValue(value.ecommerce.items, true));
  }

  return names;
};

export const extractItemNamesFromRawJson = (value: string | null | undefined) => {
  const raw = readString(value);
  if (!raw) return [];
  try {
    return uniqueStrings(collectRawProductNamesFromValue(JSON.parse(raw), false));
  } catch {
    return [];
  }
};

const indexImwebOrderItemNames = () => {
  const db = getCrmDb();
  if (!hasTable(ORDER_ITEM_TABLE)) return new Map<string, string[]>();

  const columns = getTableColumns(ORDER_ITEM_TABLE);
  const orderColumn = pickColumn(columns, ORDER_ITEM_ORDER_COLUMNS);
  const itemNameColumn = pickColumn(columns, ORDER_ITEM_NAME_COLUMNS);
  if (!orderColumn || !itemNameColumn) return new Map<string, string[]>();

  const rows = db.prepare(`
    SELECT
      ${quoteSqlIdentifier(orderColumn)} AS order_ref,
      ${quoteSqlIdentifier(itemNameColumn)} AS item_name
    FROM ${quoteSqlIdentifier(ORDER_ITEM_TABLE)}
    WHERE NULLIF(TRIM(${quoteSqlIdentifier(orderColumn)}), '') IS NOT NULL
      AND NULLIF(TRIM(${quoteSqlIdentifier(itemNameColumn)}), '') IS NOT NULL
  `).all() as Array<{ order_ref: unknown; item_name: unknown }>;

  const byOrderRef = new Map<string, string[]>();
  for (const row of rows) {
    const orderRef = readString(row.order_ref);
    const itemName = readString(row.item_name);
    if (!orderRef || !itemName) continue;
    const names = byOrderRef.get(orderRef) ?? [];
    names.push(itemName);
    byOrderRef.set(orderRef, names);
  }

  for (const [orderRef, names] of byOrderRef.entries()) {
    byOrderRef.set(orderRef, uniqueStrings(names));
  }
  return byOrderRef;
};

const getReferrerHost = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  const candidates = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? [trimmed] : [`https://${trimmed}`];
  for (const candidate of candidates) {
    try {
      return new URL(candidate).hostname.toLowerCase();
    } catch {
      continue;
    }
  }
  return "";
};

const matchesYoutubeReferrer = (value: string) => {
  const referrer = value.trim().toLowerCase();
  if (!referrer) return false;

  const host = getReferrerHost(referrer);
  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host.endsWith(".youtu.be")
  ) {
    return true;
  }

  return /(?:^|[/:?&=#])(?:[a-z0-9-]+\.)?youtube\.com(?:[/:?#&]|$)/i.test(referrer) ||
    /(?:^|[/:?&=#])youtu\.be(?:[/:?#&]|$)/i.test(referrer);
};

export const classifyAttributionChannel = (input: ChannelClassificationInput): AcquisitionChannel => {
  const utmSource = readFirstString(input.utmSource, input.utm_source).toLowerCase();
  const referrer = readString(input.referrer);
  const fbclid = readString(input.fbclid);
  const ttclid = readString(input.ttclid);
  const gclid = readString(input.gclid);

  if (/^youtube/.test(utmSource) || matchesYoutubeReferrer(referrer)) {
    return "youtube";
  }

  if (
    utmSource === "meta" ||
    utmSource.startsWith("meta_") ||
    utmSource.startsWith("facebook") ||
    utmSource.startsWith("instagram") ||
    fbclid
  ) {
    return "meta";
  }

  if (utmSource.startsWith("tiktok") || ttclid) {
    return "tiktok";
  }

  if (utmSource.startsWith("google") || gclid) {
    return "google";
  }

  return "other";
};

const parseDateLikeMs = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    candidates.push(`${trimmed}T00:00:00+09:00`);
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    candidates.push(`${trimmed.replace(" ", "T")}+09:00`);
  } else {
    candidates.push(trimmed);
  }

  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseOrderTimeMs = (row: ImwebOrderLtrRow): number | null => {
  const orderTimeUnix = Number(row.order_time_unix ?? 0);
  if (Number.isFinite(orderTimeUnix) && orderTimeUnix > 0) {
    return orderTimeUnix > 1000000000000 ? orderTimeUnix : orderTimeUnix * 1000;
  }
  return parseDateLikeMs(row.order_time ?? "");
};

const toOrderTimeText = (row: ImwebOrderLtrRow, orderTimeMs: number) => {
  const orderTime = readString(row.order_time);
  return orderTime || new Date(orderTimeMs).toISOString();
};

const resolveOrderItemNames = (
  row: ImwebOrderLtrRow,
  itemNamesByOrderRef: Map<string, string[]>,
) => uniqueStrings([
  ...(itemNamesByOrderRef.get(readString(row.order_key)) ?? []),
  ...(itemNamesByOrderRef.get(readString(row.order_no)) ?? []),
  ...(itemNamesByOrderRef.get(readString(row.order_code)) ?? []),
  ...extractItemNamesFromRawJson(row.raw_json),
]);

export const isDangdangcareItemName = (value?: string | null) =>
  readString(value).replace(/\s+/g, "").includes("당당케어");

const summarizeFirstPurchaseItems = (itemNames: string[]) => {
  for (const category of PRODUCT_CATEGORY_PRIORITY) {
    const itemName = itemNames.find((name) => categorizeProductName(name) === category);
    if (itemName) {
      return {
        category,
        itemName,
        isDangdangcare: category === "supplement" && isDangdangcareItemName(itemName),
      };
    }
  }

  return {
    category: "other" as const,
    itemName: itemNames[0] ?? "",
    isDangdangcare: false,
  };
};

const compareDateLike = (left: string, right: string) => {
  const leftMs = parseDateLikeMs(left);
  const rightMs = parseDateLikeMs(right);
  if (leftMs !== null && rightMs !== null && leftMs !== rightMs) return leftMs - rightMs;
  return left.localeCompare(right);
};

export const buildFirstTouchSnapshots = (
  entries: AttributionLedgerEntry[] = listAttributionLedgerEntries(),
): FirstTouchSnapshot[] => {
  const firstEntryByCustomer = new Map<string, AttributionLedgerEntry>();

  for (const entry of entries) {
    const customerKey = entry.customerKey.trim();
    const loggedAt = entry.loggedAt.trim();
    if (!customerKey || !loggedAt) continue;

    const current = firstEntryByCustomer.get(customerKey);
    if (!current || compareDateLike(loggedAt, current.loggedAt) < 0) {
      firstEntryByCustomer.set(customerKey, entry);
    }
  }

  return [...firstEntryByCustomer.entries()]
    .map(([customerKey, entry]) => ({
      customer_key: customerKey,
      first_touch_at: entry.loggedAt,
      acquisition_channel: classifyAttributionChannel({
        utmSource: entry.utmSource,
        referrer: entry.referrer,
        fbclid: entry.fbclid,
        ttclid: entry.ttclid,
        gclid: entry.gclid,
      }),
      utm_source: entry.utmSource,
      utm_medium: entry.utmMedium,
      utm_campaign: entry.utmCampaign,
    }))
    .sort((left, right) => compareDateLike(left.first_touch_at, right.first_touch_at));
};

export const getFirstTouchSnapshots = () => buildFirstTouchSnapshots();

export const parseAcquisitionChannelFilter = (value: string): AcquisitionChannel[] => {
  const raw = value.trim();
  if (!raw) return [...ACQUISITION_CHANNELS];

  const channels: AcquisitionChannel[] = [];
  for (const part of raw.split(",")) {
    const channel = part.trim().toLowerCase();
    if (!channel) continue;
    if (!ACQUISITION_CHANNELS.includes(channel as AcquisitionChannel)) {
      throw new CohortValidationError(`channel must be one of: ${ACQUISITION_CHANNELS.join(", ")}`);
    }
    if (!channels.includes(channel as AcquisitionChannel)) channels.push(channel as AcquisitionChannel);
  }

  return channels.length > 0 ? channels : [...ACQUISITION_CHANNELS];
};

const parseRangeBoundMs = (value: string, label: string, endOfDay: boolean) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CohortValidationError(`${label} is required`);
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00"}+09:00`
    : trimmed;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new CohortValidationError(`${label} must be an ISO date or datetime`);
  }
  return parsed;
};

const indexOrders = () => {
  const itemNamesByOrderRef = indexImwebOrderItemNames();
  const rows = getCrmDb().prepare(`
    SELECT
      order_key,
      order_no,
      order_code,
      member_code,
      orderer_call,
      payment_amount,
      order_time,
      order_time_unix,
      raw_json
    FROM imweb_orders
  `).all() as ImwebOrderLtrRow[];

  const byMemberCode = new Map<string, LtrOrder[]>();
  const byNormalizedPhone = new Map<string, LtrOrder[]>();

  for (const row of rows) {
    const orderTimeMs = parseOrderTimeMs(row);
    if (orderTimeMs === null) continue;

    const amount = Number(row.payment_amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    const order: LtrOrder = {
      orderKey: row.order_key,
      orderNo: readString(row.order_no),
      orderCode: readString(row.order_code),
      memberCode: readString(row.member_code),
      normalizedPhone: normalizePhoneDigits(row.orderer_call ?? ""),
      orderTimeMs,
      orderTimeText: toOrderTimeText(row, orderTimeMs),
      amount,
      itemNames: resolveOrderItemNames(row, itemNamesByOrderRef),
    };

    if (order.memberCode) {
      const orders = byMemberCode.get(order.memberCode) ?? [];
      orders.push(order);
      byMemberCode.set(order.memberCode, orders);
    }

    if (order.normalizedPhone) {
      const orders = byNormalizedPhone.get(order.normalizedPhone) ?? [];
      orders.push(order);
      byNormalizedPhone.set(order.normalizedPhone, orders);
    }
  }

  for (const orders of byMemberCode.values()) {
    orders.sort((left, right) => left.orderTimeMs - right.orderTimeMs || left.orderKey.localeCompare(right.orderKey));
  }
  for (const orders of byNormalizedPhone.values()) {
    orders.sort((left, right) => left.orderTimeMs - right.orderTimeMs || left.orderKey.localeCompare(right.orderKey));
  }

  return { byMemberCode, byNormalizedPhone };
};

const getOrdersForCustomer = (
  customerKey: string,
  orders: ReturnType<typeof indexOrders>,
) => {
  const memberCode = customerKey.trim();
  const memberOrders = memberCode ? orders.byMemberCode.get(memberCode) : undefined;
  if (memberOrders && memberOrders.length > 0) return memberOrders;

  const normalizedPhone = normalizePhoneDigits(customerKey);
  return normalizedPhone ? orders.byNormalizedPhone.get(normalizedPhone) ?? [] : [];
};

const findFirstPurchaseOrder = (
  touch: FirstTouchSnapshot,
  orders: ReturnType<typeof indexOrders>,
) => {
  const firstTouchMs = parseDateLikeMs(touch.first_touch_at);
  if (firstTouchMs === null) return null;

  return getOrdersForCustomer(touch.customer_key, orders)
    .filter((order) => order.orderTimeMs >= firstTouchMs)
    .sort((left, right) => left.orderTimeMs - right.orderTimeMs || left.orderKey.localeCompare(right.orderKey))[0] ?? null;
};

const buildFirstPurchaseSnapshot = (
  touch: FirstTouchSnapshot,
  firstPurchase: LtrOrder | null,
): FirstPurchaseSnapshot => {
  if (!firstPurchase) {
    return {
      ...touch,
      first_purchase_category: "other",
      first_purchase_item_name: "",
      first_purchase_order_key: null,
      first_purchase_at: null,
      first_purchase_amount: null,
      is_dangdangcare: false,
    };
  }

  const summary = summarizeFirstPurchaseItems(firstPurchase.itemNames);
  return {
    ...touch,
    first_purchase_category: summary.category,
    first_purchase_item_name: summary.itemName,
    first_purchase_order_key: firstPurchase.orderKey,
    first_purchase_at: firstPurchase.orderTimeText,
    first_purchase_amount: firstPurchase.amount,
    is_dangdangcare: summary.isDangdangcare,
  };
};

const attachFirstPurchaseCategoryWithOrders = (
  snapshots: FirstTouchSnapshot[],
  orders: ReturnType<typeof indexOrders>,
): FirstPurchaseSnapshot[] =>
  snapshots.map((touch) => buildFirstPurchaseSnapshot(touch, findFirstPurchaseOrder(touch, orders)));

export const attachFirstPurchaseCategory = (snapshots: FirstTouchSnapshot[]): FirstPurchaseSnapshot[] =>
  attachFirstPurchaseCategoryWithOrders(snapshots, indexOrders());

const sumWindowLtr = (params: {
  firstTouchMs: number;
  orders: LtrOrder[];
  nowMs: number;
  days: number;
}) => {
  const windowMs = params.days * DAY_MS;
  if (params.nowMs - params.firstTouchMs < windowMs) return null;

  const windowEndMs = params.firstTouchMs + windowMs;
  return params.orders.reduce((sum, order) => {
    if (order.orderTimeMs < params.firstTouchMs || order.orderTimeMs > windowEndMs) return sum;
    return sum + order.amount;
  }, 0);
};

const summarizeWindow = (values: Array<number | null>): CohortWindowSummary => {
  const matureValues = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  const n = matureValues.length;
  if (n === 0) return { n: 0, revenue: 0, median: null };

  const revenue = matureValues.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.floor(n / 2);
  const median = n % 2 === 1
    ? matureValues[midpoint]
    : (matureValues[midpoint - 1] + matureValues[midpoint]) / 2;

  return { n, revenue, median };
};

const medianNumber = (values: number[]): number | null => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  const midpoint = Math.floor(n / 2);
  return n % 2 === 1
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
};

const toRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
};

const toSample = (row: CustomerLtr): CohortLtrSample => ({
  customer_key: row.customer_key,
  first_touch_at: row.first_touch_at,
  utm_source: row.utm_source,
  utm_campaign: row.utm_campaign,
  first_purchase_category: row.first_purchase_category,
  first_purchase_item_name: row.first_purchase_item_name,
  is_dangdangcare: row.is_dangdangcare,
  ltr_30d: row.ltr_30d,
  ltr_90d: row.ltr_90d,
  ltr_180d: row.ltr_180d,
});

const resolveInputFirstTouches = (input: {
  ledgerEntries?: AttributionLedgerEntry[];
  firstTouches?: FirstTouchSnapshot[];
}) => input.firstTouches ?? (
  input.ledgerEntries ? buildFirstTouchSnapshots(input.ledgerEntries) : getFirstTouchSnapshots()
);

export const buildAttributionCohortLtrReport = (input: {
  startAt: string;
  endAt: string;
  channels?: AcquisitionChannel[];
  ledgerEntries?: AttributionLedgerEntry[];
  firstTouches?: FirstTouchSnapshot[];
  now?: Date;
  sampleLimit?: number;
}): AttributionCohortLtrReport => {
  const startMs = parseRangeBoundMs(input.startAt, "startAt", false);
  const endMs = parseRangeBoundMs(input.endAt, "endAt", true);
  if (startMs > endMs) {
    throw new CohortValidationError("startAt must be before or equal to endAt");
  }

  const nowMs = input.now?.getTime() ?? Date.now();
  const selectedChannels = input.channels ?? [...ACQUISITION_CHANNELS];
  const sampleLimit = Math.max(1, Math.min(input.sampleLimit ?? 20, 100));
  const orders = indexOrders();
  const firstTouches = attachFirstPurchaseCategoryWithOrders(resolveInputFirstTouches(input), orders);

  const filtered = firstTouches.filter((touch) => {
    const firstTouchMs = parseDateLikeMs(touch.first_touch_at);
    return firstTouchMs !== null &&
      firstTouchMs >= startMs &&
      firstTouchMs <= endMs &&
      selectedChannels.includes(touch.acquisition_channel);
  });

  const ltrRows = filtered.map((touch): CustomerLtr | null => {
    const firstTouchMs = parseDateLikeMs(touch.first_touch_at);
    if (firstTouchMs === null) return null;

    const customerOrders = getOrdersForCustomer(touch.customer_key, orders);
    return {
      ...touch,
      ltr_30d: sumWindowLtr({ firstTouchMs, orders: customerOrders, nowMs, days: 30 }),
      ltr_90d: sumWindowLtr({ firstTouchMs, orders: customerOrders, nowMs, days: 90 }),
      ltr_180d: sumWindowLtr({ firstTouchMs, orders: customerOrders, nowMs, days: 180 }),
    };
  }).filter((row): row is CustomerLtr => row !== null);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    range: {
      startAt: input.startAt,
      endAt: input.endAt,
    },
    channels: selectedChannels.map((channel) => {
      const rows = ltrRows.filter((row) => row.acquisition_channel === channel);
      return {
        channel,
        customerCount: rows.length,
        matureCohort: {
          d30: summarizeWindow(rows.map((row) => row.ltr_30d)),
          d90: summarizeWindow(rows.map((row) => row.ltr_90d)),
          d180: summarizeWindow(rows.map((row) => row.ltr_180d)),
        },
        sampleFirstTouches: rows.slice(0, sampleLimit).map(toSample),
      };
    }),
  };
};

const buildPurchaseCohortRows = (input: {
  startAt: string;
  endAt: string;
  ledgerEntries?: AttributionLedgerEntry[];
  firstTouches?: FirstTouchSnapshot[];
  now?: Date;
}) => {
  const startMs = parseRangeBoundMs(input.startAt, "startAt", false);
  const endMs = parseRangeBoundMs(input.endAt, "endAt", true);
  if (startMs > endMs) {
    throw new CohortValidationError("startAt must be before or equal to endAt");
  }

  const orders = indexOrders();
  const firstTouches = attachFirstPurchaseCategoryWithOrders(resolveInputFirstTouches(input), orders);

  return firstTouches
    .map((touch): PurchaseCohortRow | null => {
      const firstTouchMs = parseDateLikeMs(touch.first_touch_at);
      if (firstTouchMs === null || firstTouchMs < startMs || firstTouchMs > endMs) return null;

      const windowEndMs = firstTouchMs + 180 * DAY_MS;
      const customerOrders = getOrdersForCustomer(touch.customer_key, orders);
      const orders180d = customerOrders.filter((order) =>
        order.orderTimeMs >= firstTouchMs && order.orderTimeMs <= windowEndMs,
      );
      const ltr180d = orders180d.reduce((sum, order) => sum + order.amount, 0);
      const orderKeys180d = new Set(orders180d.map((order) => order.orderKey));
      const hasTestKitOrder180d = orders180d.some((order) =>
        order.itemNames.some((itemName) => categorizeProductName(itemName) === "test_kit"),
      );

      return {
        ...touch,
        firstTouchMs,
        orders180d,
        ltr180d,
        hasRepeat180d: orderKeys180d.size >= 2,
        hasTestKitOrder180d,
      };
    })
    .filter((row): row is PurchaseCohortRow => row !== null);
};

const summarizeRepeatCell = (
  channel: AcquisitionChannel,
  category: FirstPurchaseCategory,
  isDangdangcare: boolean,
  rows: PurchaseCohortRow[],
): ChannelCategoryRepeatCell => {
  const customerCount = rows.length;
  const repeaterCount = rows.filter((row) => row.hasRepeat180d).length;
  return {
    channel,
    category,
    isDangdangcare,
    customerCount,
    repeaterCount,
    repeatRate: toRate(repeaterCount, customerCount),
    medianFirstPurchaseAmount: medianNumber(
      rows
        .map((row) => row.first_purchase_amount)
        .filter((value): value is number => value !== null),
    ),
    median180dLtr: medianNumber(rows.map((row) => row.ltr180d)),
  };
};

export const buildChannelCategoryRepeatReport = (input: {
  startAt: string;
  endAt: string;
  ledgerEntries?: AttributionLedgerEntry[];
  firstTouches?: FirstTouchSnapshot[];
  now?: Date;
}): ChannelCategoryRepeatReport => {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const cohortRows = buildPurchaseCohortRows(input);
  const cells: ChannelCategoryRepeatCell[] = [];

  for (const channel of ACQUISITION_CHANNELS) {
    for (const category of PRODUCT_CATEGORIES) {
      const rows = cohortRows.filter((row) =>
        row.acquisition_channel === channel && row.first_purchase_category === category,
      );
      cells.push(summarizeRepeatCell(channel, category, false, rows));

      if (category === "supplement") {
        cells.push(summarizeRepeatCell(channel, category, true, rows.filter((row) => row.is_dangdangcare)));
      }
    }
  }

  return {
    generatedAt,
    range: {
      startAt: input.startAt,
      endAt: input.endAt,
    },
    cells,
  };
};

const summarizeReverseFunnel = (rows: PurchaseCohortRow[]): ReverseFunnelSummary => {
  const supplementFirstBuyers = rows.length;
  const convertedToTest = rows.filter((row) => row.hasTestKitOrder180d).length;
  return {
    supplementFirstBuyers,
    convertedToTest,
    rate: toRate(convertedToTest, supplementFirstBuyers),
  };
};

export const buildReverseFunnelReport = (input: {
  startAt: string;
  endAt: string;
  ledgerEntries?: AttributionLedgerEntry[];
  firstTouches?: FirstTouchSnapshot[];
  now?: Date;
}): ReverseFunnelReport => {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const supplementRows = buildPurchaseCohortRows(input)
    .filter((row) => row.first_purchase_category === "supplement");

  return {
    generatedAt,
    range: {
      startAt: input.startAt,
      endAt: input.endAt,
    },
    overall: summarizeReverseFunnel(supplementRows),
    byChannel: ACQUISITION_CHANNELS.map((channel) => ({
      channel,
      ...summarizeReverseFunnel(supplementRows.filter((row) => row.acquisition_channel === channel)),
    })),
  };
};
