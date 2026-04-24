#!/usr/bin/env node
// 쿠팡 Wing Open API BIOCOM ordersheets 백필
//
// 전략:
//   1. v5 일단위 페이징 (createdAtFrom=YYYY-MM-DD, createdAtTo=YYYY-MM-DD 하루)
//   2. 6가지 status 순회 (ACCEPT/INSTRUCT/DEPARTURE/DELIVERING/FINAL_DELIVERY/NONE_TRACKING)
//   3. nextToken 페이지네이션
//   4. rate limit 10/s per seller → 100ms 간격 + jitter
//   5. coupang_ordersheets_api 로컬 적재
//
// 사용:
//   node scripts/coupang-backfill-biocom.cjs <YYYY-MM-DD> <YYYY-MM-DD>
//   node scripts/coupang-backfill-biocom.cjs 2026-02-19 2026-04-22
//
// 없이 실행 시 기본: 직전 30일

require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const tsx = require('tsx/cjs/api');
const Database = require('better-sqlite3');

const client = tsx.require('../src/coupangClient.ts', __filename);

const STATUSES = ['ACCEPT','INSTRUCT','DEPARTURE','DELIVERING','FINAL_DELIVERY','NONE_TRACKING'];
const SLEEP_MS = 120; // 10/s per seller → 100ms + 여유

const argFrom = process.argv[2];
const argTo = process.argv[3];
const now = new Date();
const pad = (n) => String(n).padStart(2,'0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startDate = argFrom || fmt(new Date(now.getTime() - 30*86400*1000));
const endDate = argTo || fmt(now);

const db = new Database('/Users/vibetj/coding/seo/backend/data/crm.sqlite3');

const upsertStmt = db.prepare(`
  INSERT INTO coupang_ordersheets_api (
    shipment_box_id, vendor_id, order_id, ordered_at, paid_at, status,
    orderer_name, orderer_safe_number, orderer_email,
    receiver_name, receiver_safe_number, receiver_addr1, receiver_addr2,
    total_price, discount_price, delivery_price, item_count, raw_json
  ) VALUES (
    @shipment_box_id, @vendor_id, @order_id, @ordered_at, @paid_at, @status,
    @orderer_name, @orderer_safe_number, @orderer_email,
    @receiver_name, @receiver_safe_number, @receiver_addr1, @receiver_addr2,
    @total_price, @discount_price, @delivery_price, @item_count, @raw_json
  )
  ON CONFLICT(shipment_box_id) DO UPDATE SET
    status = excluded.status,
    paid_at = excluded.paid_at,
    total_price = excluded.total_price,
    raw_json = excluded.raw_json,
    synced_at = datetime('now')
`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms + Math.random()*30));

function extractRow(r, vendorId) {
  const items = Array.isArray(r.orderItems) ? r.orderItems : [];
  const total = items.reduce((s, it) => s + (Number(it.orderPrice) || 0), 0);
  const discount = items.reduce((s, it) => s + (Number(it.instantCouponDiscount || 0) + Number(it.downloadableCouponDiscount || 0)), 0);
  const delivery = Number(r.shippingPrice || 0);
  return {
    shipment_box_id: Number(r.shipmentBoxId),
    vendor_id: vendorId,
    order_id: Number(r.orderId),
    ordered_at: r.orderedAt ?? null,
    paid_at: r.paidAt ?? null,
    status: r.status ?? null,
    orderer_name: r.orderer?.name ?? null,
    orderer_safe_number: r.orderer?.safeNumber ?? null,
    orderer_email: r.orderer?.email ?? null,
    receiver_name: r.receiver?.name ?? null,
    receiver_safe_number: r.receiver?.safeNumber ?? null,
    receiver_addr1: r.receiver?.addr1 ?? null,
    receiver_addr2: r.receiver?.addr2 ?? null,
    total_price: total,
    discount_price: discount,
    delivery_price: delivery,
    item_count: items.length,
    raw_json: JSON.stringify(r).slice(0, 10000),
  };
}

(async () => {
  const t0 = Date.now();
  console.log(`\n[coupang-backfill biocom] ${startDate} ~ ${endDate}`);
  const totals = { apiCalls: 0, rowsFetched: 0, rowsUpserted: 0, byStatus: {}, errors: [] };

  // 일자 배열 생성
  const dates = [];
  const s = new Date(startDate); const e = new Date(endDate);
  while (s <= e) { dates.push(fmt(s)); s.setDate(s.getDate()+1); }
  console.log(`  총 ${dates.length}일 × ${STATUSES.length} status = ${dates.length*STATUSES.length} 호출 예상`);

  for (const d of dates) {
    for (const status of STATUSES) {
      // 쿠팡 v5: yyyy-MM-dd+09:00 포맷 (ISO 타임존 offset). 하루 범위 = d+09:00 ~ 다음날+09:00 (KST)
      const next = new Date(d + 'T00:00:00+09:00');
      next.setDate(next.getDate() + 1);
      const nextDate = `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}`;
      let nextToken = undefined;
      let page = 0;
      do {
        totals.apiCalls++;
        try {
          const res = await client.listOrderSheetsByDay('biocom', {
            createdAtFrom: `${d}+09:00`,
            createdAtTo: `${nextDate}+09:00`,
            status,
            maxPerPage: 50,
            nextToken,
          });
          const list = res.data || [];
          if (list.length) {
            totals.rowsFetched += list.length;
            totals.byStatus[status] = (totals.byStatus[status] || 0) + list.length;
            const tx = db.transaction((arr) => {
              for (const r of arr) { try { upsertStmt.run(extractRow(r, 'A00668577')); totals.rowsUpserted++; } catch(e){ totals.errors.push(`${d}/${status}/${r.shipmentBoxId}: ${e.message}`); } }
            });
            tx(list);
          }
          nextToken = res.nextToken || undefined;
          page++;
          if (list.length) process.stdout.write(`    ${d} ${status} page${page}: +${list.length}\n`);
        } catch (e) {
          totals.errors.push(`${d}/${status}: ${e.message.slice(0, 150)}`);
          nextToken = undefined;
        }
        await sleep(SLEEP_MS);
      } while (nextToken);
    }
  }

  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  console.log(`\n✓ 백필 완료 (${elapsed}s)`);
  console.log(`  API 호출: ${totals.apiCalls}`);
  console.log(`  Row fetched: ${totals.rowsFetched}`);
  console.log(`  Row upserted: ${totals.rowsUpserted}`);
  console.log(`  Status 분포:`);
  for (const [k,v] of Object.entries(totals.byStatus)) console.log(`    ${k}: ${v}`);
  if (totals.errors.length) {
    console.log(`  오류 ${totals.errors.length}건 (최대 5개):`);
    for (const e of totals.errors.slice(0,5)) console.log(`    - ${e}`);
  }

  // 매칭률 검증
  console.log(`\n=== tb_coupang_orders 매칭 검증 ===`);
  const apiCount = db.prepare("SELECT COUNT(DISTINCT order_id) c FROM coupang_ordersheets_api WHERE vendor_id='A00668577'").get();
  const apiByMonth = db.prepare(`SELECT substr(ordered_at,1,7) ym, COUNT(DISTINCT order_id) orders FROM coupang_ordersheets_api WHERE vendor_id='A00668577' GROUP BY 1 ORDER BY 1`).all();
  console.log(`  API 적재 unique orders: ${apiCount.c}`);
  console.log(`  월별:`); for (const r of apiByMonth) console.log(`    ${r.ym}: ${r.orders}`);
  db.close();
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
