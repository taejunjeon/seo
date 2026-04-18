import { getCrmDb } from "./crmLocalDb";
import { isDatabaseConfigured, queryPg } from "./postgres";

const PLAYAUTO_IMWEB_SHOP_PATTERNS = ["아임웹%", "바이오컴-앱%"] as const;

export type ImwebOrderItemsSyncMode = "full" | "incremental";

export type ImwebOrderItemsSyncOptions = {
  mode?: ImwebOrderItemsSyncMode;
  sinceHours?: number;
  dryRun?: boolean;
};

export type ImwebOrderItemsSyncResult = {
  ok: boolean;
  mode: ImwebOrderItemsSyncMode;
  pgRowsFetched: number;
  linesWritten: number;
  linesSkippedNoOrderNo: number;
  linesSkippedNoItemName: number;
  siteBreakdown: Record<string, number>;
  shopNameBreakdown: Record<string, number>;
  sample: Array<{
    line_key: string;
    site: string | null;
    order_no: string;
    item_name: string;
    shop_name: string;
    sale_cnt: number;
    pay_amt: number;
  }>;
  message: string;
};

type PgRow = {
  shop_ord_no: string | null;
  shop_name: string | null;
  shop_sale_name: string | null;
  shop_opt_name: string | null;
  sale_cnt: number | null;
  pay_amt: string | null;
  order_htel: string | null;
  ord_time: string | null;
};

const parseOrderNoAndLine = (shopOrdNo: string | null): { orderNo: string; lineNo: string } => {
  if (!shopOrdNo) return { orderNo: "", lineNo: "" };
  const trimmed = shopOrdNo.trim();
  if (!trimmed) return { orderNo: "", lineNo: "" };

  const spaceIdx = trimmed.indexOf(" ");
  const head = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
  const tail = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).trim() : trimmed;

  const baseMatch = head.match(/^(\d+)/);
  const orderNo = baseMatch ? baseMatch[1] : head;

  const lineMatch = tail.match(/-(\d+)$/);
  let lineNo = lineMatch ? lineMatch[1] : "";
  if (!lineNo) {
    const solo = trimmed.match(/-(\d+)$/);
    if (solo) lineNo = solo[1];
  }
  return { orderNo, lineNo };
};

const toInteger = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isFinite(num)) return Math.round(num);
  }
  return 0;
};

const mapSiteByOrderNo = (orderNos: string[]): Map<string, string> => {
  const siteByOrderNo = new Map<string, string>();
  if (orderNos.length === 0) return siteByOrderNo;
  const db = getCrmDb();
  const chunkSize = 500;
  const uniqueOrderNos = [...new Set(orderNos)];
  for (let i = 0; i < uniqueOrderNos.length; i += chunkSize) {
    const chunk = uniqueOrderNos.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT order_no, site FROM imweb_orders WHERE order_no IN (${placeholders})`,
      )
      .all(...chunk) as Array<{ order_no: string; site: string }>;
    for (const row of rows) {
      if (row.order_no && row.site) siteByOrderNo.set(row.order_no, row.site);
    }
  }
  return siteByOrderNo;
};

export const syncImwebOrderItemsFromPlayauto = async (
  options: ImwebOrderItemsSyncOptions = {},
): Promise<ImwebOrderItemsSyncResult> => {
  const mode: ImwebOrderItemsSyncMode = options.mode ?? "incremental";
  const sinceHours = Math.max(1, Math.min(24 * 365, options.sinceHours ?? 24 * 7));
  const dryRun = Boolean(options.dryRun);

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      mode,
      pgRowsFetched: 0,
      linesWritten: 0,
      linesSkippedNoOrderNo: 0,
      linesSkippedNoItemName: 0,
      siteBreakdown: {},
      shopNameBreakdown: {},
      sample: [],
      message: "DATABASE_URL 미설정",
    };
  }

  const shopFilterFragment = PLAYAUTO_IMWEB_SHOP_PATTERNS.map((_, idx) => `shop_name LIKE $${idx + 1}`).join(" OR ");
  const params: unknown[] = [...PLAYAUTO_IMWEB_SHOP_PATTERNS];

  let timeFilter = "";
  if (mode === "incremental") {
    params.push(`${sinceHours} hours`);
    timeFilter = `AND ord_time::timestamp >= NOW() - $${params.length}::interval`;
  }

  const pgRes = await queryPg<PgRow>(
    `SELECT shop_ord_no, shop_name, shop_sale_name, shop_opt_name, sale_cnt, pay_amt::text AS pay_amt, order_htel, ord_time
     FROM public.tb_playauto_orders
     WHERE (${shopFilterFragment}) ${timeFilter}
     ORDER BY ord_time DESC`,
    params,
  );

  const rawRows = pgRes.rows;

  const parsed: Array<{
    lineKey: string;
    orderNo: string;
    lineNo: string;
    shopName: string;
    itemName: string;
    optName: string;
    saleCnt: number;
    payAmt: number;
    ordererPhone: string;
    ordTime: string;
  }> = [];
  let skippedNoOrderNo = 0;
  let skippedNoItemName = 0;
  const shopNameBreakdown: Record<string, number> = {};

  const lineKeySeen = new Set<string>();
  for (const row of rawRows) {
    const { orderNo, lineNo } = parseOrderNoAndLine(row.shop_ord_no);
    if (!orderNo) {
      skippedNoOrderNo += 1;
      continue;
    }
    const itemName = (row.shop_sale_name ?? "").trim();
    if (!itemName) {
      skippedNoItemName += 1;
      continue;
    }
    const shopName = (row.shop_name ?? "").trim();
    shopNameBreakdown[shopName] = (shopNameBreakdown[shopName] ?? 0) + 1;

    const lineSuffix = lineNo || `${parsed.length}-${itemName.slice(0, 20)}`;
    let lineKey = `playauto:${orderNo}:${lineSuffix}`;
    if (lineKeySeen.has(lineKey)) {
      let dedupe = 1;
      while (lineKeySeen.has(`${lineKey}#${dedupe}`)) dedupe += 1;
      lineKey = `${lineKey}#${dedupe}`;
    }
    lineKeySeen.add(lineKey);

    parsed.push({
      lineKey,
      orderNo,
      lineNo,
      shopName,
      itemName,
      optName: (row.shop_opt_name ?? "").trim(),
      saleCnt: toInteger(row.sale_cnt),
      payAmt: toInteger(row.pay_amt),
      ordererPhone: (row.order_htel ?? "").trim(),
      ordTime: (row.ord_time ?? "").trim(),
    });
  }

  const siteByOrderNo = mapSiteByOrderNo(parsed.map((r) => r.orderNo));
  const siteBreakdown: Record<string, number> = {};
  const sample: ImwebOrderItemsSyncResult["sample"] = [];

  let written = 0;
  if (!dryRun) {
    const db = getCrmDb();
    const insertStmt = db.prepare(`
      INSERT INTO imweb_order_items (
        line_key, site, order_no, line_no, shop_name, item_name, opt_name,
        sale_cnt, pay_amt, order_htel, ord_time, source, synced_at
      ) VALUES (
        @line_key, @site, @order_no, @line_no, @shop_name, @item_name, @opt_name,
        @sale_cnt, @pay_amt, @order_htel, @ord_time, 'playauto', datetime('now')
      )
      ON CONFLICT(line_key) DO UPDATE SET
        site = excluded.site,
        order_no = excluded.order_no,
        line_no = excluded.line_no,
        shop_name = excluded.shop_name,
        item_name = excluded.item_name,
        opt_name = excluded.opt_name,
        sale_cnt = excluded.sale_cnt,
        pay_amt = excluded.pay_amt,
        order_htel = excluded.order_htel,
        ord_time = excluded.ord_time,
        synced_at = datetime('now')
    `);
    const tx = db.transaction((rows: typeof parsed) => {
      for (const row of rows) {
        const site = siteByOrderNo.get(row.orderNo) ?? null;
        if (site) siteBreakdown[site] = (siteBreakdown[site] ?? 0) + 1;
        else siteBreakdown.unknown = (siteBreakdown.unknown ?? 0) + 1;
        insertStmt.run({
          line_key: row.lineKey,
          site,
          order_no: row.orderNo,
          line_no: row.lineNo,
          shop_name: row.shopName,
          item_name: row.itemName,
          opt_name: row.optName,
          sale_cnt: row.saleCnt,
          pay_amt: row.payAmt,
          order_htel: row.ordererPhone,
          ord_time: row.ordTime,
        });
        if (sample.length < 5) {
          sample.push({
            line_key: row.lineKey,
            site,
            order_no: row.orderNo,
            item_name: row.itemName,
            shop_name: row.shopName,
            sale_cnt: row.saleCnt,
            pay_amt: row.payAmt,
          });
        }
      }
    });
    tx(parsed);
    written = parsed.length;
  } else {
    for (const row of parsed) {
      const site = siteByOrderNo.get(row.orderNo) ?? null;
      if (site) siteBreakdown[site] = (siteBreakdown[site] ?? 0) + 1;
      else siteBreakdown.unknown = (siteBreakdown.unknown ?? 0) + 1;
      if (sample.length < 5) {
        sample.push({
          line_key: row.lineKey,
          site,
          order_no: row.orderNo,
          item_name: row.itemName,
          shop_name: row.shopName,
          sale_cnt: row.saleCnt,
          pay_amt: row.payAmt,
        });
      }
    }
  }

  return {
    ok: true,
    mode,
    pgRowsFetched: rawRows.length,
    linesWritten: written,
    linesSkippedNoOrderNo: skippedNoOrderNo,
    linesSkippedNoItemName: skippedNoItemName,
    siteBreakdown,
    shopNameBreakdown,
    sample,
    message: dryRun
      ? `dry-run: ${rawRows.length} PG rows scanned, ${parsed.length} parsed. No write.`
      : `${mode} sync: ${rawRows.length} PG rows → ${written} lines written/updated.`,
  };
};

export const _internal_parseOrderNoAndLine = parseOrderNoAndLine;
