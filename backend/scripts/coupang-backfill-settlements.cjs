#!/usr/bin/env node
// 쿠팡 정산 백필 · BIOCOM + TEAMKETO · 2025-01 ~ 2026-04
// 사용:
//   node scripts/coupang-backfill-settlements.cjs 2025-01 2026-04
//   node scripts/coupang-backfill-settlements.cjs  (기본: 최근 16개월)

require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const tsx = require('tsx/cjs/api');
const Database = require('better-sqlite3');

const client = tsx.require('../src/coupangClient.ts', __filename);

const argFrom = process.argv[2]; // YYYY-MM
const argTo = process.argv[3];
const now = new Date();
const endYM = argTo || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const startYM = argFrom || (() => {
  const d = new Date(now.getFullYear(), now.getMonth() - 15, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const db = new Database('/Users/vibetj/coding/seo/backend/data/crm.sqlite3');

// YYYY-MM 범위 계산
function monthRange(fromYM, toYM) {
  const out = [];
  let [y, m] = fromYM.split('-').map(Number);
  const [toY, toM] = toYM.split('-').map(Number);
  while (y < toY || (y === toY && m <= toM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { y++; m = 1; }
  }
  return out;
}

const upsertStmt = db.prepare(`
  INSERT INTO coupang_settlements_api (
    settlement_id, vendor_id, settlement_type, settlement_date, recognition_year_month,
    recognition_date_from, recognition_date_to, total_sale, service_fee,
    settlement_target_amount, settlement_amount, last_amount, deduction_amount,
    seller_discount_coupon, downloadable_coupon, final_amount, status, raw_json
  ) VALUES (
    @settlement_id, @vendor_id, @settlement_type, @settlement_date, @recognition_year_month,
    @recognition_date_from, @recognition_date_to, @total_sale, @service_fee,
    @settlement_target_amount, @settlement_amount, @last_amount, @deduction_amount,
    @seller_discount_coupon, @downloadable_coupon, @final_amount, @status, @raw_json
  )
  ON CONFLICT(settlement_id) DO UPDATE SET
    settlement_type=excluded.settlement_type,
    settlement_date=excluded.settlement_date,
    total_sale=excluded.total_sale, service_fee=excluded.service_fee,
    settlement_target_amount=excluded.settlement_target_amount,
    settlement_amount=excluded.settlement_amount, last_amount=excluded.last_amount,
    deduction_amount=excluded.deduction_amount,
    seller_discount_coupon=excluded.seller_discount_coupon,
    downloadable_coupon=excluded.downloadable_coupon,
    final_amount=excluded.final_amount, status=excluded.status,
    raw_json=excluded.raw_json, synced_at=datetime('now')
`);

const VENDORS = [
  { account: 'biocom', vendorId: 'A00668577' },
  { account: 'teamketo', vendorId: 'A00963878' },
];

(async () => {
  const t0 = Date.now();
  const months = monthRange(startYM, endYM);
  console.log(`\n[쿠팡 정산 백필] ${startYM} ~ ${endYM} · ${months.length}개월 × ${VENDORS.length} vendor = ${months.length * VENDORS.length} 호출\n`);

  const totals = { api: 0, inserted: 0, typeCount: {}, byVendor: {} };
  const errors = [];

  for (const v of VENDORS) {
    totals.byVendor[v.account] = { rows: 0, final: 0, sale: 0 };
    for (const ym of months) {
      totals.api++;
      try {
        const rows = await client.getSettlementHistories(v.account, ym);
        const list = Array.isArray(rows) ? rows : [];
        if (list.length) {
          const tx = db.transaction((arr) => {
            for (const r of arr) {
              const id = `${v.vendorId}-${r.recognitionDateFrom || ym}-${r.settlementDate || ''}-${r.settlementType || ''}`;
              upsertStmt.run({
                settlement_id: id,
                vendor_id: v.vendorId,
                settlement_type: r.settlementType || null,
                settlement_date: r.settlementDate || null,
                recognition_year_month: r.revenueRecognitionYearMonth || ym,
                recognition_date_from: r.revenueRecognitionDateFrom || null,
                recognition_date_to: r.revenueRecognitionDateTo || null,
                total_sale: Number(r.totalSale) || 0,
                service_fee: Number(r.serviceFee) || 0,
                settlement_target_amount: Number(r.settlementTargetAmount) || 0,
                settlement_amount: Number(r.settlementAmount) || 0,
                last_amount: Number(r.lastAmount) || 0,
                deduction_amount: Number(r.deductionAmount) || 0,
                seller_discount_coupon: Number(r.sellerDiscountCoupon) || 0,
                downloadable_coupon: Number(r.downloadableCoupon) || 0,
                final_amount: Number(r.finalAmount) || 0,
                status: r.status || null,
                raw_json: JSON.stringify(r).slice(0, 8000),
              });
              totals.inserted++;
              totals.byVendor[v.account].rows++;
              totals.byVendor[v.account].final += Number(r.finalAmount) || 0;
              totals.byVendor[v.account].sale += Number(r.totalSale) || 0;
              totals.typeCount[r.settlementType || 'NULL'] = (totals.typeCount[r.settlementType || 'NULL'] || 0) + 1;
            }
          });
          tx(list);
        }
        process.stdout.write(`  ${v.account} ${ym}: ${list.length}건\n`);
      } catch (e) {
        const msg = (e.message || String(e)).slice(0, 200);
        errors.push(`${v.account}/${ym}: ${msg}`);
        process.stdout.write(`  ${v.account} ${ym}: ❌ ${msg}\n`);
      }
      // 10/s per seller limit 여유 → 150ms per call (약 7/s)
      await new Promise(r => setTimeout(r, 150));
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n═══ 백필 완료 (${elapsed}s) ═══`);
  console.log(`  API 호출: ${totals.api} · 적재: ${totals.inserted}행`);
  console.log(`\n  settlementType 분포:`);
  for (const [k, v] of Object.entries(totals.typeCount)) console.log(`    ${k}: ${v}`);
  console.log(`\n  vendor별 summary:`);
  for (const [k, v] of Object.entries(totals.byVendor)) {
    console.log(`    ${k}: ${v.rows}행 · totalSale ₩${v.sale.toLocaleString()} · finalAmount ₩${v.final.toLocaleString()}`);
  }
  if (errors.length) {
    console.log(`\n  오류 ${errors.length}건:`);
    errors.slice(0, 10).forEach(e => console.log(`    - ${e}`));
  }

  // 월별 피벗 (검증용)
  console.log(`\n═══ 월별 × vendor finalAmount ═══`);
  const piv = db.prepare(`
    SELECT recognition_year_month ym,
           SUM(CASE WHEN vendor_id='A00668577' THEN final_amount ELSE 0 END) biocom,
           SUM(CASE WHEN vendor_id='A00963878' THEN final_amount ELSE 0 END) teamketo,
           COUNT(*) rows
    FROM coupang_settlements_api
    GROUP BY recognition_year_month ORDER BY recognition_year_month
  `).all();
  for (const r of piv) {
    console.log(`  ${r.ym}: biocom ₩${Number(r.biocom).toLocaleString()} · teamketo ₩${Number(r.teamketo).toLocaleString()} (${r.rows}건)`);
  }

  db.close();
  console.log('\n✓ done');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
