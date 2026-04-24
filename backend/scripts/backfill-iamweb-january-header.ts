import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";

import { queryPg } from "../src/postgres";

/*
 * 1월 1-7일 주문 헤더 백필 스크립트.
 * 공동구매내역.md Phase1-Sprint3.
 *
 * 방향:
 * 1. 로컬 `imweb_order_items` 2026-01-01 ~ 2026-01-07 구간에서 `site` 미확정 + imweb_orders에 없는 주문번호 목록 추출
 * 2. 운영 `public.tb_iamweb_users`에서 해당 주문번호를 주문 단위로 GROUP BY 집계
 * 3. 로컬 `imweb_orders`에 INSERT ... ON CONFLICT DO NOTHING
 * 4. 드라이런 기본. `--apply` 인자 있을 때만 실제 INSERT.
 *
 * 실행:
 *   cd backend && npx tsx scripts/backfill-iamweb-january-header.ts
 *   cd backend && npx tsx scripts/backfill-iamweb-january-header.ts --apply
 */

const MISSING_FROM = "2026-01-01";
const MISSING_TO = "2026-01-07"; // inclusive end handled by query (< 2026-01-08)

const PAYMENT_METHOD_MAP: Record<string, string> = {
  카드: "card",
  가상계좌: "virtual",
  무료결제: "free",
  정기결제: "etc",
  "네이버페이-주문형 결제": "npay",
  실시간계좌이체: "iche",
};

type OpsRow = {
  order_number: string;
  order_time_src: string;
  orderer_name: string;
  orderer_call: string;
  payment_method: string | null;
  pg_name: string | null;
  payment_status: string | null;
  sum_total_price: string;
  sum_final: string;
  sum_paid: string;
  sum_coupon: string;
  delivery_price: string;
  refunded: string;
  row_count: string;
};

const kstToUtcIso = (kstStr: string): { unix: number; iso: string } | null => {
  if (!kstStr) return null;
  // "2026-01-01 00:26:39" (KST 가정) or already-iso
  const s = kstStr.includes("T") ? kstStr : kstStr.replace(" ", "T") + "+09:00";
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return { unix: Math.floor(d.getTime() / 1000), iso: d.toISOString() };
};

const mapPayType = (m: string | null): string => {
  if (!m) return "";
  return PAYMENT_METHOD_MAP[m] ?? "";
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  console.log(`## backfill-iamweb-january-header (${apply ? "APPLY" : "DRY-RUN"})`);
  console.log(`   range: ${MISSING_FROM} ~ ${MISSING_TO}`);

  const dbPath = path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath, { readonly: !apply });
  try {
    // 1. 로컬 missing order_no 리스트
    const missing = db
      .prepare(
        `SELECT DISTINCT order_no
         FROM imweb_order_items
         WHERE (site IS NULL OR site='' OR site='biocom')
           AND ord_time >= ?
           AND ord_time < datetime(?, '+1 day')
           AND order_no NOT IN (SELECT order_no FROM imweb_orders WHERE site='biocom')`,
      )
      .all(MISSING_FROM, MISSING_TO) as Array<{ order_no: string }>;
    const missingOrderNos = missing.map((r) => r.order_no);
    console.log(`\n## local missing order_no count: ${missingOrderNos.length}`);

    if (missingOrderNos.length === 0) {
      console.log("no missing orders. nothing to backfill.");
      return;
    }

    // 2. 운영 DB에서 주문 단위 집계
    const pgRes = await queryPg<OpsRow>(
      `SELECT order_number,
              MIN(COALESCE(NULLIF(payment_complete_time, ''), order_date)) AS order_time_src,
              MAX(customer_name) AS orderer_name,
              MAX(customer_number) AS orderer_call,
              MAX(payment_method) AS payment_method,
              MAX(pg_name) AS pg_name,
              MAX(payment_status) AS payment_status,
              SUM(COALESCE(total_price, 0))::text AS sum_total_price,
              SUM(COALESCE(final_order_amount, 0))::text AS sum_final,
              SUM(COALESCE(paid_price, 0))::text AS sum_paid,
              SUM(COALESCE(coupon_discount, 0))::text AS sum_coupon,
              MAX(COALESCE(delivery_price, 0))::text AS delivery_price,
              SUM(COALESCE(total_refunded_price, 0))::text AS refunded,
              COUNT(*)::text AS row_count
       FROM public.tb_iamweb_users
       WHERE order_number = ANY($1::text[])
       GROUP BY order_number`,
      [missingOrderNos],
    );
    console.log(`## ops DB matched orders: ${pgRes.rowCount}`);

    if (pgRes.rowCount === 0) {
      console.log("no ops rows matched. aborting.");
      return;
    }

    // 3. 변환
    const nowIso = new Date().toISOString();
    const inserts = [];
    let skipped = 0;
    let totalPaid = 0;
    let totalFinal = 0;
    const byPayType: Record<string, { n: number; amount: number }> = {};

    for (const row of pgRes.rows) {
      const t = kstToUtcIso(row.order_time_src);
      if (!t) {
        skipped++;
        continue;
      }
      const payType = mapPayType(row.payment_method);
      const paymentAmount = Number(row.sum_final ?? "0");
      const paidPrice = Number(row.sum_paid ?? "0");
      const totalPrice = Number(row.sum_total_price ?? "0");
      const couponAmount = Number(row.sum_coupon ?? "0");
      const deliveryPrice = Number(row.delivery_price ?? "0");
      totalPaid += paidPrice;
      totalFinal += paymentAmount;
      byPayType[payType || "(empty)"] = byPayType[payType || "(empty)"] ?? { n: 0, amount: 0 };
      byPayType[payType || "(empty)"].n += 1;
      byPayType[payType || "(empty)"].amount += paymentAmount;

      inserts.push({
        order_key: `iamweb_${row.order_number}`,
        site: "biocom",
        order_no: row.order_number,
        order_code: "",
        channel_order_no: "",
        order_type: "shopping",
        sale_channel_idx: 1,
        device_type: "",
        order_time_unix: t.unix,
        order_time: t.iso,
        complete_time_unix: t.unix,
        complete_time: t.iso,
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
          _source: "ops_backfill_iamweb",
          _synced_at: nowIso,
          order_number: row.order_number,
          payment_method_kr: row.payment_method,
          payment_status_kr: row.payment_status,
          refunded: row.refunded,
          row_count: row.row_count,
        }),
        synced_at: nowIso,
        imweb_status: row.payment_status ?? "",
        imweb_status_synced_at: nowIso,
      });
    }

    console.log(`\n## prepared ${inserts.length} rows (skipped ${skipped})`);
    console.log(`   total payment_amount (SUM final): ${totalFinal.toLocaleString()}원`);
    console.log(`   total paid_price         (SUM paid):  ${totalPaid.toLocaleString()}원`);
    console.log("   by pay_type:");
    for (const [k, v] of Object.entries(byPayType)) {
      console.log(`     ${k}: ${v.n} rows, ${v.amount.toLocaleString()}원`);
    }
    console.log("\n## first 3 samples:");
    for (const s of inserts.slice(0, 3)) {
      console.log("  ", JSON.stringify({
        order_no: s.order_no,
        order_time: s.order_time,
        pay_type: s.pay_type,
        payment_amount: s.payment_amount,
        orderer_call_suffix: s.orderer_call.slice(-4),
      }));
    }

    if (!apply) {
      console.log("\n## DRY-RUN. no rows inserted. re-run with --apply to write.");
      return;
    }

    // 4. apply 모드: INSERT
    const stmt = db.prepare(`
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
      ON CONFLICT(order_key) DO NOTHING
    `);
    const tx = db.transaction((rows: typeof inserts) => {
      let ok = 0;
      for (const r of rows) {
        const res = stmt.run(r);
        if (res.changes > 0) ok++;
      }
      return ok;
    });
    const inserted = tx(inserts);
    console.log(`\n## APPLIED. inserted ${inserted} rows (duplicates skipped).`);

    // 5. site 미확정 라인 업데이트
    const updateRes = db
      .prepare(
        `UPDATE imweb_order_items
         SET site='biocom'
         WHERE (site IS NULL OR site='')
           AND order_no IN (SELECT order_no FROM imweb_orders WHERE site='biocom' AND order_key LIKE 'iamweb_%')`,
      )
      .run();
    console.log(`   site-fill on imweb_order_items: ${updateRes.changes} rows updated`);
  } finally {
    db.close();
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
