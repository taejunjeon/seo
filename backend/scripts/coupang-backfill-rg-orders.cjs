#!/usr/bin/env node
// Draft: Coupang RG(2P) 주문 백필 스크립트
// 기본값은 dry-run 이며 DB 쓰기를 하지 않음.
//
// 사용 예시:
//   node scripts/coupang-backfill-rg-orders.cjs
//   node scripts/coupang-backfill-rg-orders.cjs 2025-01-01 2026-04-24 --account=all --chunk-days=7
//   node scripts/coupang-backfill-rg-orders.cjs 2025-01-01 2026-04-24 --account=biocom --apply
//   node scripts/coupang-backfill-rg-orders.cjs --print-schema

require("dotenv").config({ path: "/Users/vibetj/coding/seo/backend/.env" });
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const tsx = require("tsx/cjs/api");

const coupang = tsx.require("../src/coupangClient.ts", __filename);

const ACCOUNTS = [
  { account: "biocom", vendorId: "A00668577" },
  { account: "teamketo", vendorId: "A00963878" },
];

const RATE_LIMIT_PER_MINUTE = 50; // 공식 문서 명시치
const SAFE_INTERVAL_MS = 1300; // 60,000 / 50 = 1,200ms 보다 보수적으로 설정

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coupang_rg_orders_api (
  id BIGSERIAL PRIMARY KEY,
  vendor_id VARCHAR(20) NOT NULL,
  account_name VARCHAR(20) NOT NULL,
  order_id BIGINT NOT NULL,
  vendor_item_id BIGINT NOT NULL,
  paid_at_ms BIGINT NOT NULL,
  paid_at_kst TIMESTAMPTZ,
  product_name TEXT,
  sales_quantity INTEGER NOT NULL CHECK (sales_quantity >= 0),
  unit_sales_price INTEGER,
  currency VARCHAR(10),
  gross_amount BIGINT NOT NULL,
  raw_json JSONB NOT NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_id, order_id, vendor_item_id)
);

CREATE INDEX IF NOT EXISTS idx_coupang_rg_orders_api_vendor_paid
  ON coupang_rg_orders_api (vendor_id, paid_at_kst DESC);
`;

const UPSERT_SQL = `
INSERT INTO coupang_rg_orders_api (
  vendor_id, account_name, order_id, vendor_item_id, paid_at_ms, paid_at_kst,
  product_name, sales_quantity, unit_sales_price, currency, gross_amount, raw_json
) VALUES (
  $1, $2, $3, $4, $5, to_timestamp($5 / 1000.0),
  $6, $7, $8, $9, $10, $11::jsonb
)
ON CONFLICT (vendor_id, order_id, vendor_item_id) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  paid_at_ms = EXCLUDED.paid_at_ms,
  paid_at_kst = EXCLUDED.paid_at_kst,
  product_name = EXCLUDED.product_name,
  sales_quantity = EXCLUDED.sales_quantity,
  unit_sales_price = EXCLUDED.unit_sales_price,
  currency = EXCLUDED.currency,
  gross_amount = EXCLUDED.gross_amount,
  raw_json = EXCLUDED.raw_json,
  last_synced_at = NOW()
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) return fallback;
  const idx = hit.indexOf("=");
  return hit.slice(idx + 1);
}

function parseDate(dateText) {
  if (!dateText) return null;
  const value = `${dateText}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 15);
  start.setDate(1);
  return { from: ymd(start), to: ymd(end) };
}

function buildDateChunks(fromText, toText, chunkDays) {
  const from = parseDate(fromText);
  const to = parseDate(toText);
  if (!from || !to || from > to) {
    throw new Error(`Invalid date range: ${fromText} ~ ${toText}`);
  }
  const chunks = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + chunkDays - 1);
    if (end > to) end.setTime(to.getTime());
    chunks.push({ from: ymd(cursor), to: ymd(end) });
    cursor.setDate(cursor.getDate() + chunkDays);
  }
  return chunks;
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function flattenRows(accountName, vendorId, order) {
  const paidAtMs = toInteger(order.paidAt);
  const orderId = toInteger(order.orderId);
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const rows = [];

  for (const item of items) {
    const vendorItemId = toInteger(item.vendorItemId);
    const salesQuantity = toInteger(item.salesQuantity) ?? 0;
    const unitSalesPrice = toInteger(item.unitSalesPrice ?? item.salesPrice);
    const grossAmount = salesQuantity * (unitSalesPrice ?? 0);
    if (!orderId || !vendorItemId || !paidAtMs) continue;

    rows.push({
      vendor_id: vendorId,
      account_name: accountName,
      order_id: orderId,
      vendor_item_id: vendorItemId,
      paid_at_ms: paidAtMs,
      product_name: item.productName ?? null,
      sales_quantity: salesQuantity,
      unit_sales_price: unitSalesPrice,
      currency: item.currency ?? null,
      gross_amount: grossAmount,
      raw_json: JSON.stringify(order),
    });
  }

  return rows;
}

async function main() {
  if (process.argv.includes("--print-schema")) {
    console.log(SCHEMA_SQL.trim());
    return;
  }

  const defaults = defaultWindow();
  const from = process.argv[2] || defaults.from;
  const to = process.argv[3] || defaults.to;
  const accountOpt = parseArgValue("--account", "all");
  const chunkDays = Number(parseArgValue("--chunk-days", "7")) || 7;
  const apply = process.argv.includes("--apply");

  const selected =
    accountOpt === "all"
      ? ACCOUNTS
      : ACCOUNTS.filter((x) => x.account === accountOpt);
  if (!selected.length) {
    throw new Error(`Unknown account option: ${accountOpt}`);
  }

  const chunks = buildDateChunks(from, to, chunkDays);
  const outputFile = path.join(
    process.cwd(),
    "data",
    `coupang-rg-backfill-draft-${Date.now()}.json`,
  );

  const summary = {
    args: { from, to, account: accountOpt, chunkDays, apply },
    assumptions: {
      rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
      intervalMs: SAFE_INTERVAL_MS,
    },
    apiCalls: 0,
    ordersSeen: 0,
    rowsFlattened: 0,
    rowsUpserted: 0,
    errors: [],
    byAccount: {},
  };

  let pgClient = null;
  if (apply) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when --apply is used.");
    }
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    await pgClient.query("BEGIN");
  }

  try {
    for (const { account, vendorId } of selected) {
      summary.byAccount[account] = { apiCalls: 0, ordersSeen: 0, rowsFlattened: 0, rowsUpserted: 0 };
      for (const chunk of chunks) {
        let nextToken = undefined;
        do {
          summary.apiCalls += 1;
          summary.byAccount[account].apiCalls += 1;
          try {
            const res = await coupang.getRgOrders(account, chunk.from, chunk.to, { nextToken });
            const orders = Array.isArray(res.data) ? res.data : [];
            summary.ordersSeen += orders.length;
            summary.byAccount[account].ordersSeen += orders.length;

            for (const order of orders) {
              const flatRows = flattenRows(account, vendorId, order);
              summary.rowsFlattened += flatRows.length;
              summary.byAccount[account].rowsFlattened += flatRows.length;
              if (apply && pgClient && flatRows.length) {
                for (const row of flatRows) {
                  await pgClient.query(UPSERT_SQL, [
                    row.vendor_id,
                    row.account_name,
                    row.order_id,
                    row.vendor_item_id,
                    row.paid_at_ms,
                    row.product_name,
                    row.sales_quantity,
                    row.unit_sales_price,
                    row.currency,
                    row.gross_amount,
                    row.raw_json,
                  ]);
                  summary.rowsUpserted += 1;
                  summary.byAccount[account].rowsUpserted += 1;
                }
              }
            }
            nextToken = res.nextToken || undefined;
          } catch (err) {
            const message = err && err.message ? String(err.message) : String(err);
            summary.errors.push(`${account} ${chunk.from}~${chunk.to}: ${message.slice(0, 300)}`);
            nextToken = undefined;
          }
          await sleep(SAFE_INTERVAL_MS);
        } while (nextToken);
      }
    }

    if (apply && pgClient) {
      await pgClient.query("COMMIT");
    }
  } catch (fatal) {
    if (apply && pgClient) {
      await pgClient.query("ROLLBACK");
    }
    throw fatal;
  } finally {
    if (pgClient) await pgClient.end();
  }

  fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
  console.log("[RG BACKFILL DRAFT]");
  console.log(`  mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`  window: ${from} ~ ${to} (${chunks.length} chunks @ ${chunkDays} days)`);
  console.log(`  calls: ${summary.apiCalls}`);
  console.log(`  orders: ${summary.ordersSeen}`);
  console.log(`  rows(flat): ${summary.rowsFlattened}`);
  console.log(`  rows(upserted): ${summary.rowsUpserted}`);
  console.log(`  errors: ${summary.errors.length}`);
  console.log(`  summary: ${outputFile}`);
  if (!apply) {
    console.log("  note: dry-run mode, DB write not executed.");
  }
  console.log("\n[Schema Proposal]");
  console.log(SCHEMA_SQL.trim());
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
