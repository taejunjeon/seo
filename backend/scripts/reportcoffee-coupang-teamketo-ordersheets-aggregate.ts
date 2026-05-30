import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import type { CoupangAccount, CoupangOrderSheet } from "../src/coupangClient";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

type CliOptions = {
  account: CoupangAccount;
  startDate: string;
  endDate: string;
  statuses: string[];
  delayMs: number;
  outputPath?: string;
  topProducts: number;
};

type Bucket = {
  order_sheets: number;
  items: number;
  quantity: number;
  amount_krw: number;
};

type ProductBucket = {
  name: string;
  items: number;
  quantity: number;
  amount_krw: number;
};

type ProductClassBucket = {
  items: number;
  quantity: number;
  amount_krw: number;
};

type CoupangOrderItem = NonNullable<CoupangOrderSheet["orderItems"]>[number] & {
  sellerProductName?: string;
  sellerProductItemName?: string;
  firstSellerProductItemName?: string;
  vendorItemName?: string;
  vendorItemPackageName?: string;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STATUSES = [
  "ACCEPT",
  "INSTRUCT",
  "DEPARTURE",
  "DELIVERING",
  "FINAL_DELIVERY",
  "NONE_TRACKING",
];

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const body = token.slice(2);
    const eqIndex = body.indexOf("=");
    if (eqIndex >= 0) {
      args[body.slice(0, eqIndex)] = body.slice(eqIndex + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[body] = next;
      i += 1;
    } else {
      args[body] = true;
    }
  }
  return args;
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function shiftKstDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getPreviousKstDate(): string {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const todayKstUtc = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
  );
  const previous = new Date(todayKstUtc - ONE_DAY_MS);
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, "0"),
    String(previous.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function asInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function getOptions(): CliOptions {
  const args = parseArgs(process.argv.slice(2));
  const account = String(args.account ?? "teamketo") as CoupangAccount;
  if (account !== "teamketo" && account !== "biocom") {
    throw new Error("--account must be teamketo or biocom");
  }
  const days = asInt(args.days, 7) || 7;
  const endDate = assertDate(String(args.end ?? getPreviousKstDate()), "--end");
  const startDate = assertDate(
    String(args.start ?? shiftKstDate(endDate, -(days - 1))),
    "--start",
  );
  if (startDate > endDate) {
    throw new Error("--start must be before or equal to --end");
  }
  const statuses = String(args.statuses ?? DEFAULT_STATUSES.join(","))
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  return {
    account,
    startDate,
    endDate,
    statuses,
    delayMs: asInt(args.delayMs ?? args["delay-ms"], 350),
    outputPath: args.out ? String(args.out) : undefined,
    topProducts: asInt(args.topProducts ?? args["top-products"], 10),
  };
}

function emptyBucket(): Bucket {
  return {
    order_sheets: 0,
    items: 0,
    quantity: 0,
    amount_krw: 0,
  };
}

function emptyProductClassBucket(): ProductClassBucket {
  return {
    items: 0,
    quantity: 0,
    amount_krw: 0,
  };
}

function addToBucket(bucket: Bucket, itemCount: number, quantity: number, amount: number) {
  bucket.order_sheets += 1;
  bucket.items += itemCount;
  bucket.quantity += quantity;
  bucket.amount_krw += amount;
}

function classifyProduct(productName: string): "coffee_hint" | "teamketo_hint" | "other_hint" {
  const normalized = productName.toLowerCase();
  if (/커피|coffee|디카페|decaf|원두|콜드브루|드립|블렌드/.test(normalized)) {
    return "coffee_hint";
  }
  if (/키토|keto|mct|방탄|bulletproof|저탄|저당/.test(normalized)) {
    return "teamketo_hint";
  }
  return "other_hint";
}

function getProductName(item: CoupangOrderItem): string {
  return String(
    item.productName ??
      item.sellerProductName ??
      item.sellerProductItemName ??
      item.firstSellerProductItemName ??
      item.vendorItemName ??
      item.vendorItemPackageName ??
      "unknown_product",
  );
}

function itemQuantity(item: CoupangOrderItem): number {
  const quantity = Number(item.shippingCount ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function itemAmount(item: CoupangOrderItem): number {
  const orderPrice = Number(item.orderPrice ?? 0);
  if (Number.isFinite(orderPrice) && orderPrice > 0) return Math.round(orderPrice);
  const salesPrice = Number(item.salesPrice ?? 0);
  if (Number.isFinite(salesPrice) && salesPrice > 0) {
    return Math.round(salesPrice * itemQuantity(item));
  }
  return 0;
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = shiftKstDate(cursor, 1);
  }
  return dates;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/access-key=[^,\s]+/gi, "access-key=[redacted]")
    .replace(/signature=[^,\s]+/gi, "signature=[redacted]")
    .slice(0, 240);
}

async function run() {
  const { isCoupangConfigured, listOrderSheetsByMinute } = await import(
    "../src/coupangClient"
  );
  const options = getOptions();
  if (!isCoupangConfigured(options.account)) {
    throw new Error(`Coupang ${options.account} env is not configured`);
  }

  const totals = emptyBucket();
  const byStatus: Record<string, Bucket> = {};
  const byDay: Record<string, Bucket> = {};
  const byProductClass: Record<string, ProductClassBucket> = {
    coffee_hint: emptyProductClassBucket(),
    teamketo_hint: emptyProductClassBucket(),
    other_hint: emptyProductClassBucket(),
  };
  const topProducts = new Map<string, ProductBucket>();
  const seenShipmentBoxes = new Set<string>();
  const apiErrors: Array<{ date: string; status: string; error: string }> = [];
  let apiCalls = 0;

  for (const date of dateRange(options.startDate, options.endDate)) {
    byDay[date] = emptyBucket();
    for (const status of options.statuses) {
      byStatus[status] = byStatus[status] ?? emptyBucket();
      apiCalls += 1;
      try {
        const response = await listOrderSheetsByMinute(options.account, {
          createdAtFrom: `${date}T00:00`,
          createdAtTo: `${date}T23:59`,
          status,
        });
        for (const sheet of response.data) {
          const shipmentKey =
            sheet.shipmentBoxId === undefined || sheet.shipmentBoxId === null
              ? ""
              : String(sheet.shipmentBoxId);
          if (shipmentKey && seenShipmentBoxes.has(shipmentKey)) continue;
          if (shipmentKey) seenShipmentBoxes.add(shipmentKey);

          const items = sheet.orderItems ?? [];
          let sheetQuantity = 0;
          let sheetAmount = 0;
          for (const item of items) {
            const productName = getProductName(item);
            const quantity = itemQuantity(item);
            const amount = itemAmount(item);
            const productClass = classifyProduct(productName);
            const productBucket = byProductClass[productClass];
            productBucket.items += 1;
            productBucket.quantity += quantity;
            productBucket.amount_krw += amount;

            const existing = topProducts.get(productName) ?? {
              name: productName,
              items: 0,
              quantity: 0,
              amount_krw: 0,
            };
            existing.items += 1;
            existing.quantity += quantity;
            existing.amount_krw += amount;
            topProducts.set(productName, existing);

            sheetQuantity += quantity;
            sheetAmount += amount;
          }
          const itemCount = items.length;
          addToBucket(totals, itemCount, sheetQuantity, sheetAmount);
          addToBucket(byStatus[status], itemCount, sheetQuantity, sheetAmount);
          addToBucket(byDay[date], itemCount, sheetQuantity, sheetAmount);
        }
      } catch (error) {
        apiErrors.push({ date, status, error: summarizeError(error) });
      }
      if (options.delayMs > 0) await sleep(options.delayMs);
    }
  }

  const result = {
    report: "reportcoffee_coupang_teamketo_ordersheets_aggregate_v1",
    generated_at: new Date().toISOString(),
    source: {
      system: "coupang_wing_open_api_ordersheets_read_only",
      account: options.account,
      endpoint_family: "ordersheets_v4_minute",
      raw_order_output: 0,
    },
    window: {
      timezone: "Asia/Seoul",
      start_date: options.startDate,
      end_date_inclusive: options.endDate,
      statuses: options.statuses,
    },
    api: {
      calls: apiCalls,
      error_count: apiErrors.length,
      errors: apiErrors,
    },
    totals,
    by_status: byStatus,
    by_day: byDay,
    product_classification: byProductClass,
    top_products: [...topProducts.values()]
      .sort((a, b) => b.amount_krw - a.amount_krw)
      .slice(0, options.topProducts),
    guardrails: {
      read_only: true,
      db_write: 0,
      slack_send: 0,
      platform_send_or_upload: 0,
      raw_customer_identifier_output: 0,
      raw_order_identifier_output: 0,
    },
    confidence:
      apiErrors.length === 0
        ? "medium_high_api_aggregate"
        : "medium_with_api_error_notes",
  };

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(options.outputPath)), { recursive: true });
    fs.writeFileSync(options.outputPath, json);
  } else {
    process.stdout.write(json);
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        report: "reportcoffee_coupang_teamketo_ordersheets_aggregate_v1",
        status: "failed",
        error: summarizeError(error),
        guardrails: {
          read_only: true,
          db_write: 0,
          slack_send: 0,
          platform_send_or_upload: 0,
          raw_customer_identifier_output: 0,
          raw_order_identifier_output: 0,
        },
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
