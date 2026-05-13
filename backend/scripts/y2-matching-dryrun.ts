/**
 * Y-2 NPay intent → order matching dry-run.
 * Read-only · aggregate only · raw identifier 출력 금지.
 */
import { Pool } from "pg";
import Database from "better-sqlite3";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL missing");

const main = async () => {
  const sqlite = new Database("data/vm-attribution-snapshot-20260514.sqlite3", { readonly: true });
  const pg = new Pool({ connectionString: DATABASE_URL });

  const intents = sqlite
    .prepare(`
      SELECT intent_key, captured_at, client_id, ga_session_id, gclid, gbraid, wbraid,
        product_idx, member_hash
      FROM npay_intent_log
      WHERE site='biocom' AND environment='live'
        AND captured_at >= '2026-04-14' AND captured_at < '2026-05-14'
    `).all() as Array<{
      intent_key: string; captured_at: string; client_id: string; ga_session_id: string;
      gclid: string; gbraid: string; wbraid: string;
      product_idx: string; member_hash: string;
    }>;
  console.log("intent rows last_30d:", intents.length);

  const sql = `
    WITH npay_orders AS (
      SELECT
        order_number,
        order_date::text AS order_date,
        final_order_amount AS amount_krw,
        raw_data->>'memberCode' AS member_code,
        jsonb_path_query_array(
          raw_data->'sections',
          '$[*].sectionItems[*].productInfo.prodNo'
        ) AS prod_nos
      FROM public.tb_iamweb_users
      WHERE payment_method = 'NAVERPAY_ORDER'
        AND payment_status = 'PAYMENT_COMPLETE'
        AND order_date::timestamp >= '2026-04-14T00:00:00+09:00'::timestamp
        AND order_date::timestamp < '2026-05-14T00:00:00+09:00'::timestamp
    )
    SELECT order_number, order_date, amount_krw, member_code, prod_nos::text
    FROM npay_orders
  `;
  const orders = (await pg.query(sql)).rows as Array<{
    order_number: string; order_date: string; amount_krw: string; member_code: string | null;
    prod_nos: string;
  }>;
  console.log("NPay payment_complete orders last_30d:", orders.length);

  type Order = { order_number: string; order_date: string; amount_krw: number; product_ids: string[]; member_code: string | null };
  const parsedOrders: Order[] = orders.map((o) => {
    let pids: string[] = [];
    try {
      const arr = JSON.parse(o.prod_nos) as Array<number | string>;
      pids = arr.map(String);
    } catch { /* ignore */ }
    return {
      order_number: o.order_number,
      order_date: o.order_date,
      amount_krw: Number(o.amount_krw) || 0,
      product_ids: pids,
      member_code: o.member_code,
    };
  });
  console.log("orders with prodNo extracted:", parsedOrders.filter((o) => o.product_ids.length > 0).length);

  const WINDOW_30MIN = 30 * 60 * 1000;
  const WINDOW_24H = 24 * 60 * 60 * 1000;

  let aGrade = 0; let aGradeWithClickId = 0; let aGradeAmount = 0;
  let bGrade = 0; let cGrade = 0; let ambiguous30min = 0; let unmatched = 0;
  const matchedOrderNos = new Set<string>();
  const aGradeIntentKeys = new Set<string>();

  for (const intent of intents) {
    const intentAt = new Date(intent.captured_at).getTime();
    const candidates = parsedOrders.filter((o) => {
      const orderAt = new Date(o.order_date).getTime();
      const delta = orderAt - intentAt;
      return delta >= 0 && delta <= WINDOW_24H && o.product_ids.includes(intent.product_idx);
    });
    if (candidates.length === 0) { unmatched++; continue; }

    const within30min = candidates.filter((o) => (new Date(o.order_date).getTime() - intentAt) <= WINDOW_30MIN);

    if (within30min.length === 1 && !matchedOrderNos.has(within30min[0].order_number)) {
      aGrade++;
      const o = within30min[0];
      matchedOrderNos.add(o.order_number);
      aGradeIntentKeys.add(intent.intent_key);
      aGradeAmount += o.amount_krw;
      const hasClickId = Boolean(intent.gclid || intent.gbraid || intent.wbraid);
      if (hasClickId) aGradeWithClickId++;
    } else if (within30min.length > 1) {
      ambiguous30min++;
    } else if (candidates.length === 1) {
      bGrade++;
    } else {
      cGrade++;
    }
  }

  console.log("\n=== Y-2 matching dry-run summary (aggregate, raw value 출력 금지) ===");
  console.log("intent_total_last_30d:", intents.length);
  console.log("intent_with_gclid:", intents.filter((i) => i.gclid).length);
  console.log("npay_payment_complete_orders_last_30d:", parsedOrders.length);
  console.log("");
  console.log("== matching grade distribution ==");
  console.log("A-grade (product_idx + 30min unique):", aGrade);
  console.log("  amount_total_krw:", aGradeAmount);
  console.log("  intents_with_gclid_among_A:", aGradeWithClickId);
  console.log("B-grade (product_idx + 30min~24h single):", bGrade);
  console.log("C-grade (product_idx + 30min~24h multiple):", cGrade);
  console.log("ambiguous_30min (>1 candidate in 30min):", ambiguous30min);
  console.log("unmatched:", unmatched);
  console.log("");
  console.log("== projected fill-rate ==");
  console.log("baseline with_gclid (post-snapshot-refresh):", 26);
  console.log("projected with_gclid post-Y2_A-grade_only:", 26 + aGradeWithClickId);
  console.log("projected fill-rate:", ((26 + aGradeWithClickId) / 2228 * 100).toFixed(2), "%");

  await pg.end();
};

main().catch((e) => { console.error(e); process.exit(1); });
