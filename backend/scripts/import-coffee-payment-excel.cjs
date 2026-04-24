// 아임웹 어드민 엑셀 (결제 기본 양식) → coffee_payments_excel 적재
// 사용: node scripts/import-coffee-payment-excel.cjs <xlsx_path>
require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const Database = require('better-sqlite3');

const xlsxPath = process.argv[2];
if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error('Usage: node scripts/import-coffee-payment-excel.cjs <xlsx_path>');
  process.exit(1);
}
const sourceFile = path.basename(xlsxPath);
const db = new Database('/Users/vibetj/coding/seo/backend/data/crm.sqlite3');

const COL_MAP = {
  '주문번호': 'order_no',
  '결제번호': 'payment_no',
  '결제상태': 'payment_status',
  '결제시간': 'payment_at',
  '결제수단': 'payment_method',
  '결제구분': 'payment_kind',
  '금액': 'amount',
  '간편결제 잔액 상세정보': 'pay_detail',
  'PG주문번호': 'pg_order_no',
  'PG거래번호': 'pg_tx_no',
  '은행명': 'bank_name',
  '계좌번호': 'bank_account',
  '예금주': 'account_holder',
  '입금자명': 'depositor_name',
  '만료일시': 'expired_at',
  '현금영수증 신청정보': 'cash_receipt_request',
  '현금영수증 발급번호': 'cash_receipt_no',
  '현금영수증 발급일시': 'cash_receipt_at',
};

const formatDateTime = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  }
  return String(v);
};
const toInt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};

console.log(`[1/4] reading ${xlsxPath} ...`);
const wb = xlsx.readFile(xlsxPath, { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const json = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: true });
console.log(`  parsed ${json.length} rows`);

const cols = Object.values(COL_MAP);
const placeholders = cols.map((c) => '@' + c).join(', ');
const columnList = cols.join(', ');
const updateSet = cols
  .filter((c) => c !== 'payment_no')
  .map((c) => `${c}=excluded.${c}`)
  .join(', ');
const stmt = db.prepare(`
  INSERT INTO coffee_payments_excel (${columnList}, source_file)
  VALUES (${placeholders}, @source_file)
  ON CONFLICT(payment_no, source_file) DO UPDATE SET
    ${updateSet}, imported_at=datetime('now')
`);

console.log(`[2/4] inserting ...`);
const tx = db.transaction((rows) => {
  let n = 0;
  for (const r of rows) {
    const obj = { source_file: sourceFile };
    for (const [korCol, sqlCol] of Object.entries(COL_MAP)) {
      let v = r[korCol];
      if (sqlCol === 'payment_at' || sqlCol === 'expired_at' || sqlCol === 'cash_receipt_at') {
        v = formatDateTime(v);
      } else if (sqlCol === 'amount') {
        v = toInt(v);
      } else if (v !== null && v !== undefined) {
        v = String(v).trim();
      }
      obj[sqlCol] = v ?? null;
    }
    if (!obj.payment_no) continue;
    stmt.run(obj);
    n++;
  }
  return n;
});
const inserted = tx(json);
console.log(`  inserted/updated: ${inserted}`);

console.log(`[3/4] verification ...`);
const total = db.prepare(`SELECT COUNT(*) c FROM coffee_payments_excel WHERE source_file=?`).get(sourceFile);
const dateRange = db.prepare(`SELECT MIN(payment_at) min_d, MAX(payment_at) max_d FROM coffee_payments_excel WHERE source_file=?`).get(sourceFile);
console.log(`총 행: ${total.c} / 기간: ${dateRange.min_d} ~ ${dateRange.max_d}`);

console.log(`\n[4/4] insights:`);
const status = db.prepare(`SELECT payment_status, COUNT(*) c, SUM(amount) sum FROM coffee_payments_excel WHERE source_file=? GROUP BY payment_status`).all(sourceFile);
console.log('\n=== 결제상태 ===');
for (const r of status) console.log(`  ${r.payment_status}: ${r.c}건 · ₩${(r.sum||0).toLocaleString()}`);

const methodCompleted = db.prepare(`
  SELECT payment_method, COUNT(*) c, SUM(amount) sum
  FROM coffee_payments_excel
  WHERE source_file=? AND payment_status='결제완료' AND payment_kind='결제'
  GROUP BY payment_method ORDER BY sum DESC`).all(sourceFile);
console.log('\n=== 결제완료+결제 결제수단 분포 ===');
for (const r of methodCompleted) console.log(`  ${r.payment_method}: ${r.c}건 · ₩${(r.sum||0).toLocaleString()}`);
const totalRev = methodCompleted.reduce((s,r)=>s+(r.sum||0),0);
console.log(`  ────────────────`);
console.log(`  합계: ₩${totalRev.toLocaleString()}`);

const refund = db.prepare(`
  SELECT COUNT(*) c, SUM(amount) sum FROM coffee_payments_excel
  WHERE source_file=? AND payment_kind='환불'`).get(sourceFile);
console.log(`\n환불: ${refund.c}건 · ₩${(refund.sum||0).toLocaleString()}`);

const provider = db.prepare(`
  SELECT pg_provider, COUNT(*) c, SUM(amount) sum FROM coffee_payments_excel
  WHERE source_file=? AND payment_status='결제완료' AND payment_kind='결제'
  GROUP BY pg_provider ORDER BY sum DESC`).all(sourceFile);
console.log('\n=== PG 분포 (결제완료) ===');
for (const r of provider) console.log(`  ${r.pg_provider||'(unknown)'}: ${r.c}건 · ₩${(r.sum||0).toLocaleString()}`);

// Toss 매칭 검증 (PG provider=toss인 결제 ↔ tb_sales_toss는 별도 PG. 여기선 prefix 통계)
const tossInPay = db.prepare(`
  SELECT COUNT(*) c, SUM(amount) sum FROM coffee_payments_excel
  WHERE source_file=? AND pg_provider='toss' AND payment_status='결제완료' AND payment_kind='결제'`).get(sourceFile);
console.log(`\nPayment xlsx 내 Toss(iw_th) 결제: ${tossInPay.c}건 · ₩${(tossInPay.sum||0).toLocaleString()}`);

// 주문↔결제 매칭률
const orderJoinCount = db.prepare(`
  SELECT COUNT(DISTINCT cpe.order_no) matched
  FROM coffee_payments_excel cpe
  JOIN coffee_orders_excel coe ON coe.order_no = cpe.order_no
  WHERE cpe.source_file=?`).get(sourceFile);
const totalOrderInPay = db.prepare(`SELECT COUNT(DISTINCT order_no) c FROM coffee_payments_excel WHERE source_file=?`).get(sourceFile);
console.log(`\n주문↔결제 매칭: ${orderJoinCount.matched}/${totalOrderInPay.c} 주문번호 매칭됨`);

db.close();
console.log('\n✓ done');
