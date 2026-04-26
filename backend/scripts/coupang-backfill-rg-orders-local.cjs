#!/usr/bin/env node
// 쿠팡 RG Order API 2025 년 공백 백필 · 로컬 SQLite 타겟
// (원격 운영 PG 는 read-only 정책이라 로컬 SQLite 에 적재)
//
// 사용:
//   node scripts/coupang-backfill-rg-orders-local.cjs 2025-01-01 2025-01-07 --account=biocom --apply
//   node scripts/coupang-backfill-rg-orders-local.cjs 2025-01-01 2026-01-31 --account=biocom --apply
//
// BIOCOM (A00668577) 만 지원 — TEAMKETO 는 로켓그로스 미운영 (coupangorderdocu.md §2.1)

require("dotenv").config({ path: "/Users/vibetj/coding/seo/backend/.env" });
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const tsx = require("tsx/cjs/api");

const coupang = tsx.require("../src/coupangClient.ts", __filename);

const ACCOUNTS = [
  { account: "biocom", vendorId: "A00668577" },
  { account: "teamketo", vendorId: "A00963878" },
];

const RATE_LIMIT_PER_MINUTE = 50;
const SAFE_INTERVAL_MS = 1300;

const DB_PATH = "/Users/vibetj/coding/seo/backend/data/crm.sqlite3";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coupang_rg_orders_api (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  order_id INTEGER NOT NULL,
  vendor_item_id INTEGER NOT NULL,
  paid_at_ms INTEGER NOT NULL,
  paid_at_kst TEXT,
  product_name TEXT,
  sales_quantity INTEGER NOT NULL CHECK (sales_quantity >= 0),
  unit_sales_price INTEGER,
  currency TEXT,
  gross_amount INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  first_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vendor_id, order_id, vendor_item_id)
);
CREATE INDEX IF NOT EXISTS idx_crg_vendor_paid ON coupang_rg_orders_api (vendor_id, paid_at_kst);
CREATE INDEX IF NOT EXISTS idx_crg_paid_ms ON coupang_rg_orders_api (paid_at_ms);
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.slice(hit.indexOf("=") + 1);
}

function parseDate(t) {
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(t).trim())) return null;
  const d = new Date(`${String(t).trim()}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDateChunks(from, to, chunkDays) {
  const f = parseDate(from);
  const t = parseDate(to);
  if (!f || !t || f > t) throw new Error(`Invalid date range: ${from} ~ ${to}`);
  const chunks = [];
  const cur = new Date(f);
  while (cur <= t) {
    const end = new Date(cur);
    end.setDate(end.getDate() + chunkDays - 1);
    if (end > t) end.setTime(t.getTime());
    chunks.push({ from: ymd(cur), to: ymd(end) });
    cur.setDate(cur.getDate() + chunkDays);
  }
  return chunks;
}

function toInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function flattenRows(accountName, vendorId, order) {
  const paidAtMs = toInt(order.paidAt);
  const orderId = toInt(order.orderId);
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const out = [];
  for (const it of items) {
    const vendorItemId = toInt(it.vendorItemId);
    const qty = toInt(it.salesQuantity) ?? 0;
    const unit = toInt(it.unitSalesPrice ?? it.salesPrice);
    const gross = qty * (unit ?? 0);
    if (!orderId || !vendorItemId || !paidAtMs) continue;
    const kst = new Date(paidAtMs).toISOString();
    out.push({
      vendor_id: vendorId,
      account_name: accountName,
      order_id: orderId,
      vendor_item_id: vendorItemId,
      paid_at_ms: paidAtMs,
      paid_at_kst: kst,
      product_name: it.productName ?? null,
      sales_quantity: qty,
      unit_sales_price: unit,
      currency: it.currency ?? null,
      gross_amount: gross,
      raw_json: JSON.stringify(order),
    });
  }
  return out;
}

async function main() {
  const from = process.argv[2] || "2025-01-01";
  const to = process.argv[3] || ymd(new Date());
  const accountOpt = parseArgValue("--account", "biocom");
  const chunkDays = Number(parseArgValue("--chunk-days", "7")) || 7;
  const apply = process.argv.includes("--apply");

  const selected = accountOpt === "all" ? ACCOUNTS : ACCOUNTS.filter((a) => a.account === accountOpt);
  if (!selected.length) throw new Error(`Unknown account: ${accountOpt}`);

  const chunks = buildDateChunks(from, to, chunkDays);

  const db = new Database(DB_PATH);
  db.exec(SCHEMA_SQL);
  const upsert = db.prepare(`
    INSERT INTO coupang_rg_orders_api
      (vendor_id, account_name, order_id, vendor_item_id, paid_at_ms, paid_at_kst,
       product_name, sales_quantity, unit_sales_price, currency, gross_amount, raw_json)
    VALUES (@vendor_id, @account_name, @order_id, @vendor_item_id, @paid_at_ms, @paid_at_kst,
            @product_name, @sales_quantity, @unit_sales_price, @currency, @gross_amount, @raw_json)
    ON CONFLICT(vendor_id, order_id, vendor_item_id) DO UPDATE SET
      paid_at_ms=excluded.paid_at_ms,
      paid_at_kst=excluded.paid_at_kst,
      product_name=excluded.product_name,
      sales_quantity=excluded.sales_quantity,
      unit_sales_price=excluded.unit_sales_price,
      currency=excluded.currency,
      gross_amount=excluded.gross_amount,
      raw_json=excluded.raw_json,
      last_synced_at=datetime('now')
  `);

  const summary = {
    mode: apply ? "APPLY" : "DRY-RUN",
    window: `${from} ~ ${to}`,
    chunks: chunks.length,
    chunkDays,
    apiCalls: 0,
    ordersSeen: 0,
    rowsFlattened: 0,
    rowsUpserted: 0,
    errors: [],
  };

  const t0 = Date.now();
  for (const { account, vendorId } of selected) {
    for (const ch of chunks) {
      let nextToken = undefined;
      do {
        summary.apiCalls++;
        try {
          const res = await coupang.getRgOrders(account, ch.from, ch.to, { nextToken });
          const orders = Array.isArray(res.data) ? res.data : [];
          summary.ordersSeen += orders.length;
          for (const o of orders) {
            const flat = flattenRows(account, vendorId, o);
            summary.rowsFlattened += flat.length;
            if (apply) {
              for (const row of flat) {
                try { upsert.run(row); summary.rowsUpserted++; } catch (e) { summary.errors.push(`upsert fail: ${e.message}`); }
              }
            }
          }
          nextToken = res.nextToken || undefined;
        } catch (err) {
          summary.errors.push(`${account} ${ch.from}~${ch.to}: ${(err.message || String(err)).slice(0, 200)}`);
          nextToken = undefined;
        }
        await sleep(SAFE_INTERVAL_MS);
      } while (nextToken);
      process.stdout.write(`  ${account} ${ch.from}~${ch.to} · calls ${summary.apiCalls} · orders ${summary.ordersSeen} · upserted ${summary.rowsUpserted}\n`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n═══ ${summary.mode} 완료 (${elapsed}s) ═══`);
  console.log(JSON.stringify(summary, null, 2).slice(0, 1200));

  const outputFile = path.join(process.cwd(), "data", `coupang-rg-backfill-local-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
  console.log(`\n요약 저장: ${outputFile}`);

  if (apply) {
    const counts = db.prepare(`
      SELECT strftime('%Y-%m', paid_at_kst) ym, COUNT(*) cnt, SUM(gross_amount) gross
      FROM coupang_rg_orders_api GROUP BY 1 ORDER BY 1
    `).all();
    console.log("\n[DB 월별 현황 (coupang_rg_orders_api)]");
    for (const r of counts) console.log(`  ${r.ym}: ${r.cnt}건 · ₩${Number(r.gross).toLocaleString()}`);
  }

  db.close();
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
