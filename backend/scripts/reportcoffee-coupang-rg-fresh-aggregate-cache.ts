import Database from "better-sqlite3";
import path from "node:path";

import type { CoupangAccount, CoupangRgOrderItem } from "../src/coupangClient";
import { getRgOrders, isCoupangConfigured } from "../src/coupangClient";

type ProductClass = "coffee_hint" | "teamketo_hint" | "other_hint";

type CliOptions = {
  account: CoupangAccount;
  from: string;
  to: string;
  dbPath: string;
  apply: boolean;
};

type Bucket = {
  orderIds: Set<string>;
  itemCount: number;
  quantity: number;
  grossAmountKrw: number;
};

const PRODUCT_CLASSES: ProductClass[] = ["coffee_hint", "teamketo_hint", "other_hint"];
const CLASSIFICATION_RULE_VERSION = "coffee_product_classifier_v20260525";
const SOURCE_API = "coupang_rg_orders_api_readonly";

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function parseOptions(): CliOptions {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const account = String(argValue("--account") ?? "teamketo") as CoupangAccount;
  if (account !== "teamketo" && account !== "biocom") {
    throw new Error("--account must be teamketo or biocom");
  }
  return {
    account,
    from: assertDate(String(argValue("--from") ?? "2026-04-25"), "--from"),
    to: assertDate(String(argValue("--to") ?? "2026-05-01"), "--to"),
    dbPath: String(argValue("--db") ?? path.join(repoRoot, "backend", "data", "crm.sqlite3")),
    apply: process.argv.includes("--apply"),
  };
}

function kstDateFromEpochMs(value: unknown): string | null {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kstNowText(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function classifyProduct(productName: string): ProductClass {
  const normalized = productName.toLowerCase();
  if (/커피|coffee|디카페|decaf|원두|콜드브루|드립|블렌드/.test(normalized)) {
    return "coffee_hint";
  }
  if (/키토|keto|mct|방탄|bulletproof|저탄|저당/.test(normalized)) {
    return "teamketo_hint";
  }
  return "other_hint";
}

function itemQuantity(item: CoupangRgOrderItem): number {
  const value = Number(item.salesQuantity ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function itemUnitPrice(item: CoupangRgOrderItem): number {
  const value = Number(item.unitSalesPrice ?? item.salesPrice ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function bucketKey(date: string, productClass: ProductClass): string {
  return `${date}|${productClass}`;
}

function emptyBucket(): Bucket {
  return {
    orderIds: new Set<string>(),
    itemCount: 0,
    quantity: 0,
    grossAmountKrw: 0,
  };
}

function ensureAggregateSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupang_rg_daily_aggregate_api (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      paid_date_kst TEXT NOT NULL,
      product_class TEXT NOT NULL,
      order_count INTEGER NOT NULL CHECK (order_count >= 0),
      item_count INTEGER NOT NULL CHECK (item_count >= 0),
      quantity INTEGER NOT NULL CHECK (quantity >= 0),
      gross_amount_krw INTEGER NOT NULL CHECK (gross_amount_krw >= 0),
      source_window_start_kst TEXT NOT NULL,
      source_window_end_kst TEXT NOT NULL,
      fetched_at_kst TEXT NOT NULL,
      api_call_count INTEGER NOT NULL CHECK (api_call_count >= 0),
      classification_rule_version TEXT NOT NULL,
      source_api TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(account_name, paid_date_kst, product_class)
    );
    CREATE INDEX IF NOT EXISTS idx_crg_daily_agg_account_date
      ON coupang_rg_daily_aggregate_api (account_name, paid_date_kst);
  `);
}

async function buildFreshAggregate(options: CliOptions) {
  if (!isCoupangConfigured(options.account)) {
    throw new Error(`Coupang ${options.account} credentials are not configured`);
  }

  const buckets = new Map<string, Bucket>();
  for (const date of enumerateDates(options.from, options.to)) {
    for (const productClass of PRODUCT_CLASSES) {
      buckets.set(bucketKey(date, productClass), emptyBucket());
    }
  }

  let nextToken: string | undefined;
  let apiCallCount = 0;
  let apiOrdersSeen = 0;
  let apiItemsSeen = 0;

  do {
    apiCallCount += 1;
    const response = await getRgOrders(options.account, options.from, options.to, {
      nextToken,
      timeoutMs: 30000,
    });
    const orders = Array.isArray(response.data) ? response.data : [];
    apiOrdersSeen += orders.length;

    for (const order of orders) {
      const paidDate = kstDateFromEpochMs(order.paidAt);
      if (!paidDate || paidDate < options.from || paidDate > options.to) continue;
      const orderKey = String(order.orderId ?? `missing-order-${apiOrdersSeen}`);
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      for (const item of items) {
        apiItemsSeen += 1;
        const productClass = classifyProduct(String(item.productName ?? ""));
        const bucket = buckets.get(bucketKey(paidDate, productClass)) ?? emptyBucket();
        const quantity = itemQuantity(item);
        const gross = quantity * itemUnitPrice(item);
        bucket.orderIds.add(orderKey);
        bucket.itemCount += 1;
        bucket.quantity += quantity;
        bucket.grossAmountKrw += gross;
        buckets.set(bucketKey(paidDate, productClass), bucket);
      }
    }

    nextToken = response.nextToken || undefined;
  } while (nextToken);

  const rows = [...buckets.entries()]
    .map(([key, bucket]) => {
      const [paidDateKst, productClass] = key.split("|") as [string, ProductClass];
      return {
        account_name: options.account,
        paid_date_kst: paidDateKst,
        product_class: productClass,
        order_count: bucket.orderIds.size,
        item_count: bucket.itemCount,
        quantity: bucket.quantity,
        gross_amount_krw: bucket.grossAmountKrw,
        source_window_start_kst: options.from,
        source_window_end_kst: options.to,
        fetched_at_kst: kstNowText(),
        api_call_count: apiCallCount,
        classification_rule_version: CLASSIFICATION_RULE_VERSION,
        source_api: SOURCE_API,
      };
    })
    .sort((a, b) => `${a.paid_date_kst}:${a.product_class}`.localeCompare(`${b.paid_date_kst}:${b.product_class}`));

  return {
    options,
    api_call_count: apiCallCount,
    api_orders_seen: apiOrdersSeen,
    api_items_seen: apiItemsSeen,
    rows,
    totals: rows.reduce(
      (acc, row) => {
        acc.order_count += row.order_count;
        acc.item_count += row.item_count;
        acc.quantity += row.quantity;
        acc.gross_amount_krw += row.gross_amount_krw;
        if (row.product_class === "coffee_hint") {
          acc.coffee_order_count += row.order_count;
          acc.coffee_item_count += row.item_count;
          acc.coffee_quantity += row.quantity;
          acc.coffee_gross_amount_krw += row.gross_amount_krw;
        }
        return acc;
      },
      {
        order_count: 0,
        item_count: 0,
        quantity: 0,
        gross_amount_krw: 0,
        coffee_order_count: 0,
        coffee_item_count: 0,
        coffee_quantity: 0,
        coffee_gross_amount_krw: 0,
      },
    ),
  };
}

function writeAggregate(db: Database.Database, rows: Awaited<ReturnType<typeof buildFreshAggregate>>["rows"]) {
  ensureAggregateSchema(db);
  const upsert = db.prepare(`
    INSERT INTO coupang_rg_daily_aggregate_api (
      account_name,
      paid_date_kst,
      product_class,
      order_count,
      item_count,
      quantity,
      gross_amount_krw,
      source_window_start_kst,
      source_window_end_kst,
      fetched_at_kst,
      api_call_count,
      classification_rule_version,
      source_api
    ) VALUES (
      @account_name,
      @paid_date_kst,
      @product_class,
      @order_count,
      @item_count,
      @quantity,
      @gross_amount_krw,
      @source_window_start_kst,
      @source_window_end_kst,
      @fetched_at_kst,
      @api_call_count,
      @classification_rule_version,
      @source_api
    )
    ON CONFLICT(account_name, paid_date_kst, product_class) DO UPDATE SET
      order_count=excluded.order_count,
      item_count=excluded.item_count,
      quantity=excluded.quantity,
      gross_amount_krw=excluded.gross_amount_krw,
      source_window_start_kst=excluded.source_window_start_kst,
      source_window_end_kst=excluded.source_window_end_kst,
      fetched_at_kst=excluded.fetched_at_kst,
      api_call_count=excluded.api_call_count,
      classification_rule_version=excluded.classification_rule_version,
      source_api=excluded.source_api,
      updated_at=datetime('now')
  `);
  const tx = db.transaction((inputRows: typeof rows) => {
    for (const row of inputRows) upsert.run(row);
  });
  tx(rows);
}

async function main() {
  const options = parseOptions();
  const result = await buildFreshAggregate(options);

  const safeOutput = {
    mode: options.apply ? "apply" : "dry_run",
    account: options.account,
    window: {
      from: options.from,
      to: options.to,
    },
    api_call_count: result.api_call_count,
    api_orders_seen: result.api_orders_seen,
    api_items_seen: result.api_items_seen,
    totals: result.totals,
    by_day: result.rows.map((row) => ({
      paid_date_kst: row.paid_date_kst,
      product_class: row.product_class,
      order_count: row.order_count,
      item_count: row.item_count,
      quantity: row.quantity,
      gross_amount_krw: row.gross_amount_krw,
    })),
    local_db_write: options.apply ? "applied_to_coupang_rg_daily_aggregate_api" : "not_run",
    raw_identifier_output: 0,
  };

  console.log(JSON.stringify(safeOutput, null, 2));

  if (options.apply) {
    const db = new Database(options.dbPath);
    try {
      writeAggregate(db, result.rows);
    } finally {
      db.close();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
