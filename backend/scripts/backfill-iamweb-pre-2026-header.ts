import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";

import { getPgPool, queryPg } from "../src/postgres";

/*
 * Backfill local imweb_orders headers from the long-retention operations
 * table. Dry-run by default; pass --apply to write to local SQLite.
 *
 * Scope:
 * - Insert biocom headers whose Imweb order_number date prefix is before
 *   --before-order-date (default: 20260101).
 * - Repair existing ops-backed rows (order_key LIKE 'iamweb_%') using
 *   per-order amounts from tb_iamweb_users. That table repeats order-level
 *   amounts across product rows, so MAX(), not SUM(), is the safe aggregate.
 */

const DEFAULT_BEFORE_ORDER_DATE = "20260101";

const PAYMENT_METHOD_MAP: Record<string, string> = {
  카드: "card",
  가상계좌: "virtual",
  무료결제: "free",
  정기결제: "etc",
  "네이버페이-주문형 결제": "npay",
  실시간계좌이체: "iche",
};

type OpsOrderRow = {
  order_number: string;
  order_time_src: string;
  orderer_name: string | null;
  orderer_call: string | null;
  payment_method: string | null;
  pg_name: string | null;
  payment_status: string | null;
  order_total_price: string;
  order_final: string;
  order_paid: string;
  order_coupon: string;
  delivery_price: string;
  refunded: string;
  row_count: string;
};

type ExistingOrderRow = {
  order_key: string;
  order_no: string;
  payment_amount: number;
  total_price: number;
  coupon_amount: number;
  delivery_price: number;
};

const parseArgs = () => {
  const apply = process.argv.includes("--apply");
  const beforeArg = process.argv.find((arg) => arg.startsWith("--before-order-date="));
  const beforeOrderDate = beforeArg?.split("=")[1]?.trim() || DEFAULT_BEFORE_ORDER_DATE;
  if (!/^\d{8}$/.test(beforeOrderDate)) {
    throw new Error("--before-order-date must be YYYYMMDD");
  }
  return { apply, beforeOrderDate };
};

const kstToUtcIso = (value: string): { unix: number; iso: string } | null => {
  if (!value) return null;
  const input = value.includes("T") ? value : `${value.replace(" ", "T")}+09:00`;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return { unix: Math.floor(date.getTime() / 1000), iso: date.toISOString() };
};

const mapPayType = (method: string | null) => (method ? PAYMENT_METHOD_MAP[method] ?? "" : "");

const closePgPool = async () => {
  try {
    await getPgPool().end();
  } catch {
    // Pool may not have been initialized if configuration failed before query.
  }
};

const main = async () => {
  const { apply, beforeOrderDate } = parseArgs();
  console.log(`## backfill-iamweb-pre-2026-header (${apply ? "APPLY" : "DRY-RUN"})`);
  console.log(`   target: biocom order_number prefix < ${beforeOrderDate}`);

  const dbPath = path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath, { readonly: !apply });

  try {
    const existingRows = db
      .prepare(
        `SELECT order_key, order_no, payment_amount, total_price, coupon_amount, delivery_price
         FROM imweb_orders
         WHERE site='biocom'`,
      )
      .all() as ExistingOrderRow[];

    const existingByKey = new Map(existingRows.map((row) => [row.order_key, row]));
    const existingOrderNos = new Set(existingRows.map((row) => row.order_no));
    const existingOpsOrderNos = existingRows
      .filter((row) => row.order_key.startsWith("iamweb_"))
      .map((row) => row.order_no);

    const pgRows = await queryPg<OpsOrderRow>(
      `SELECT order_number,
              MIN(COALESCE(NULLIF(payment_complete_time, ''), order_date)) AS order_time_src,
              MAX(customer_name) AS orderer_name,
              MAX(customer_number) AS orderer_call,
              MAX(payment_method) AS payment_method,
              MAX(pg_name) AS pg_name,
              MAX(payment_status) AS payment_status,
              MAX(COALESCE(total_price, 0))::text AS order_total_price,
              MAX(COALESCE(final_order_amount, 0))::text AS order_final,
              MAX(COALESCE(paid_price, 0))::text AS order_paid,
              MAX(COALESCE(coupon_discount, 0))::text AS order_coupon,
              MAX(COALESCE(delivery_price, 0))::text AS delivery_price,
              MAX(COALESCE(total_refunded_price, 0))::text AS refunded,
              COUNT(*)::text AS row_count
       FROM public.tb_iamweb_users
       WHERE (
           order_number ~ '^[0-9]+$'
           AND substring(order_number, 1, 8) < $1
         )
          OR order_number = ANY($2::text[])
       GROUP BY order_number
       ORDER BY order_number`,
      [beforeOrderDate, existingOpsOrderNos],
    );

    const nowIso = new Date().toISOString();
    const inserts = [];
    let skippedBadTime = 0;
    let skippedExistingOtherKey = 0;
    let wouldInsert = 0;
    let wouldUpdate = 0;
    let amountChanged = 0;
    let existingUnchanged = 0;
    let totalPaymentAmount = 0;

    for (const row of pgRows.rows) {
      const orderNo = String(row.order_number ?? "");
      const orderKey = `iamweb_${orderNo}`;
      const existing = existingByKey.get(orderKey);
      if (!existing && existingOrderNos.has(orderNo)) {
        skippedExistingOtherKey++;
        continue;
      }

      const parsedTime = kstToUtcIso(String(row.order_time_src ?? ""));
      if (!parsedTime) {
        skippedBadTime++;
        continue;
      }

      const payType = mapPayType(row.payment_method);
      const paymentAmount = Number(row.order_final ?? "0") || 0;
      const totalPrice = Number(row.order_total_price ?? "0") || 0;
      const couponAmount = Number(row.order_coupon ?? "0") || 0;
      const deliveryPrice = Number(row.delivery_price ?? "0") || 0;
      totalPaymentAmount += paymentAmount;

      if (existing) {
        const changed =
          existing.payment_amount !== paymentAmount ||
          existing.total_price !== totalPrice ||
          existing.coupon_amount !== couponAmount ||
          existing.delivery_price !== deliveryPrice;
        if (!changed) {
          existingUnchanged++;
          continue;
        }
        wouldUpdate++;
        amountChanged++;
      } else {
        wouldInsert++;
      }

      inserts.push({
        order_key: orderKey,
        site: "biocom",
        order_no: orderNo,
        order_code: "",
        channel_order_no: "",
        order_type: "shopping",
        sale_channel_idx: 1,
        device_type: "",
        order_time_unix: parsedTime.unix,
        order_time: parsedTime.iso,
        complete_time_unix: parsedTime.unix,
        complete_time: parsedTime.iso,
        member_code: "",
        orderer_name: row.orderer_name ?? "",
        orderer_call: row.orderer_call ?? "",
        pay_type: payType,
        pg_type: row.pg_name ?? "",
        total_price: totalPrice,
        payment_amount: paymentAmount,
        coupon_amount: couponAmount,
        delivery_price: deliveryPrice,
        use_issue_coupon_codes: "[]",
        raw_json: JSON.stringify({
          _source: "ops_backfill_iamweb_pre_2026",
          _synced_at: nowIso,
          amount_aggregation: "max_per_order_from_repeated_rows",
          order_number: orderNo,
          payment_method_kr: row.payment_method,
          payment_status_kr: row.payment_status,
          paid_price: Number(row.order_paid ?? "0") || 0,
          refunded: Number(row.refunded ?? "0") || 0,
          row_count: Number(row.row_count ?? "0") || 0,
        }),
        synced_at: nowIso,
        imweb_status: row.payment_status ?? "",
        imweb_status_synced_at: nowIso,
      });
    }

    console.log("## prepared");
    console.table([
      {
        pgOrders: pgRows.rowCount,
        prepared: inserts.length,
        wouldInsert,
        wouldUpdate,
        amountChanged,
        existingUnchanged,
        skippedExistingOtherKey,
        skippedBadTime,
        totalPaymentAmount,
      },
    ]);

    if (!apply) {
      console.log("## DRY-RUN. no rows written. re-run with --apply to update local SQLite.");
      return;
    }

    const upsert = db.prepare(`
      INSERT INTO imweb_orders (
        order_key, site, order_no, order_code, channel_order_no, order_type,
        sale_channel_idx, device_type, order_time_unix, order_time,
        complete_time_unix, complete_time, member_code, orderer_name, orderer_call,
        pay_type, pg_type, price_currency, total_price, payment_amount,
        coupon_amount, delivery_price, use_issue_coupon_codes, raw_json,
        synced_at, imweb_status, imweb_status_synced_at
      ) VALUES (
        @order_key, @site, @order_no, @order_code, @channel_order_no, @order_type,
        @sale_channel_idx, @device_type, @order_time_unix, @order_time,
        @complete_time_unix, @complete_time, @member_code, @orderer_name, @orderer_call,
        @pay_type, @pg_type, 'KRW', @total_price, @payment_amount,
        @coupon_amount, @delivery_price, @use_issue_coupon_codes, @raw_json,
        @synced_at, @imweb_status, @imweb_status_synced_at
      )
      ON CONFLICT(order_key) DO UPDATE SET
        site=excluded.site,
        order_no=excluded.order_no,
        order_code=excluded.order_code,
        channel_order_no=excluded.channel_order_no,
        order_type=excluded.order_type,
        sale_channel_idx=excluded.sale_channel_idx,
        device_type=excluded.device_type,
        order_time_unix=excluded.order_time_unix,
        order_time=excluded.order_time,
        complete_time_unix=excluded.complete_time_unix,
        complete_time=excluded.complete_time,
        member_code=excluded.member_code,
        orderer_name=excluded.orderer_name,
        orderer_call=excluded.orderer_call,
        pay_type=excluded.pay_type,
        pg_type=excluded.pg_type,
        price_currency='KRW',
        total_price=excluded.total_price,
        payment_amount=excluded.payment_amount,
        coupon_amount=excluded.coupon_amount,
        delivery_price=excluded.delivery_price,
        use_issue_coupon_codes=excluded.use_issue_coupon_codes,
        raw_json=excluded.raw_json,
        synced_at=excluded.synced_at,
        imweb_status=excluded.imweb_status,
        imweb_status_synced_at=excluded.imweb_status_synced_at
    `);

    const tx = db.transaction((rows: typeof inserts) => {
      let changed = 0;
      for (const row of rows) {
        changed += upsert.run(row).changes;
      }
      return changed;
    });
    const changed = tx(inserts);

    const itemSiteFill = db
      .prepare(
        `UPDATE imweb_order_items
         SET site='biocom'
         WHERE (site IS NULL OR site='')
           AND order_no IN (
             SELECT order_no FROM imweb_orders
             WHERE site='biocom' AND order_key LIKE 'iamweb_%'
           )`,
      )
      .run();

    console.log("## applied");
    console.table([{ changed, itemSiteFill: itemSiteFill.changes }]);
  } finally {
    db.close();
    await closePgPool();
  }
};

main().catch(async (error) => {
  console.error(error);
  await closePgPool();
  process.exit(1);
});
