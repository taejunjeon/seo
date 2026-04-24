// Import 아임웹 어드민 엑셀(주문 기본 양식)을 로컬 SQLite coffee_orders_excel에 적재
// 사용: node scripts/import-coffee-excel.cjs <xlsx_path>
// 멱등성: UNIQUE(order_no, section_item_no, source_file) → 같은 파일 재실행 시 덮어쓰기

require('dotenv').config({ path: '/Users/vibetj/coding/seo/backend/.env' });
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const Database = require('better-sqlite3');

const xlsxPath = process.argv[2];
if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error('Usage: node scripts/import-coffee-excel.cjs <xlsx_path>');
  process.exit(1);
}

const sourceFile = path.basename(xlsxPath);
const dbPath = '/Users/vibetj/coding/seo/backend/data/crm.sqlite3';
const db = new Database(dbPath);

// 헤더 매핑 (한글 → SQL 컬럼)
const COL_MAP = {
  '판매채널': 'channel',
  '주문번호': 'order_no',
  '주문상태': 'status',
  '총 품목합계금액': 'total_item_amount',
  '총 합계 할인금액': 'total_discount',
  '총 합계 배송비': 'total_shipping',
  '총 합계 포인트 사용액': 'total_points_used',
  '최종주문금액': 'final_amount',
  '주문자 이름': 'orderer_name',
  '주문자 이메일': 'orderer_email',
  '주문자 번호': 'orderer_phone',
  '배송방식': 'ship_method',
  '배송비결제방식': 'ship_pay_method',
  '배송송장번호': 'invoice_no',
  '주문섹션번호': 'section_no',
  '주문섹션품목번호': 'section_item_no',
  '구매수량': 'qty',
  '상품명': 'product_name',
  '옵션명': 'option_name',
  '판매가': 'unit_price',
  '품목등급할인금액': 'item_grade_discount',
  '품목포인트사용금액': 'item_points_used',
  '품목쿠폰할인금액': 'item_coupon_discount',
  '품목실결제가': 'item_paid_price',
  '수령자명': 'receiver_name',
  '수령자 전화번호': 'receiver_phone',
  '배송지 국가코드': 'ship_country_code',
  '배송지 우편번호': 'ship_zip',
  '주소': 'ship_addr1',
  '상세주소': 'ship_addr2',
  '배송메모': 'ship_memo',
  '택배사명': 'carrier',
  '취소사유': 'cancel_reason',
  '반품사유': 'return_reason',
  '취소상세사유': 'cancel_reason_detail',
  '반품 상세사유': 'return_reason_detail',
  '주문일': 'ordered_at',
  '상품고유번호': 'product_uniq_no',
};

const INTEGER_COLS = new Set([
  'total_item_amount', 'total_discount', 'total_shipping', 'total_points_used', 'final_amount',
  'qty', 'unit_price', 'item_grade_discount', 'item_points_used', 'item_coupon_discount', 'item_paid_price',
]);

const normalizePhone = (p) => (p || '').toString().replace(/[^0-9]/g, '');

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

console.log(`[2/4] preparing upsert ...`);
const cols = Object.values(COL_MAP);
const placeholders = cols.map((c) => '@' + c).join(', ');
const columnList = cols.join(', ');
const updateSet = cols
  .filter((c) => c !== 'order_no' && c !== 'section_item_no')
  .map((c) => `${c}=excluded.${c}`)
  .join(', ');
const stmt = db.prepare(`
  INSERT INTO coffee_orders_excel (${columnList}, orderer_phone_norm, receiver_phone_norm, source_file)
  VALUES (${placeholders}, @orderer_phone_norm, @receiver_phone_norm, @source_file)
  ON CONFLICT(order_no, section_item_no, source_file) DO UPDATE SET
    ${updateSet},
    orderer_phone_norm=excluded.orderer_phone_norm,
    receiver_phone_norm=excluded.receiver_phone_norm,
    imported_at=datetime('now')
`);

console.log(`[3/4] inserting ...`);
const tx = db.transaction((rows) => {
  let n = 0;
  for (const r of rows) {
    const obj = { source_file: sourceFile };
    for (const [korCol, sqlCol] of Object.entries(COL_MAP)) {
      let v = r[korCol];
      if (sqlCol === 'ordered_at') v = formatDateTime(v);
      else if (INTEGER_COLS.has(sqlCol)) v = toInt(v);
      else if (v !== null && v !== undefined) v = String(v).trim();
      obj[sqlCol] = v ?? null;
    }
    obj.orderer_phone_norm = normalizePhone(obj.orderer_phone);
    obj.receiver_phone_norm = normalizePhone(obj.receiver_phone);
    if (!obj.order_no) continue;
    stmt.run(obj);
    n++;
  }
  return n;
});
const inserted = tx(json);
console.log(`  inserted/updated: ${inserted}`);

console.log(`[4/4] verification queries ...`);
const total = db.prepare(`SELECT COUNT(*) c FROM coffee_orders_excel WHERE source_file=?`).get(sourceFile);
const uniqueOrders = db.prepare(`SELECT COUNT(DISTINCT order_no) c FROM coffee_orders_excel WHERE source_file=?`).get(sourceFile);
const uniquePhones = db.prepare(`
  SELECT COUNT(DISTINCT orderer_phone_norm) c FROM coffee_orders_excel
  WHERE source_file=? AND orderer_phone_norm != ''`).get(sourceFile);
const dateRange = db.prepare(`
  SELECT MIN(ordered_at) min_d, MAX(ordered_at) max_d FROM coffee_orders_excel WHERE source_file=?`).get(sourceFile);
const channelDist = db.prepare(`
  SELECT channel, COUNT(*) c, COUNT(DISTINCT order_no) orders, SUM(final_amount) rev
  FROM coffee_orders_excel WHERE source_file=? GROUP BY channel`).all(sourceFile);
const statusDist = db.prepare(`
  SELECT status, COUNT(DISTINCT order_no) orders, SUM(final_amount) rev
  FROM coffee_orders_excel WHERE source_file=? GROUP BY status`).all(sourceFile);

console.log('\n═══ 적재 검증 ═══');
console.log(`총 행: ${total.c} / 고유 주문: ${uniqueOrders.c} / 고유 phone: ${uniquePhones.c}`);
console.log(`기간: ${dateRange.min_d} ~ ${dateRange.max_d}`);
console.log('\n채널 분포:');
for (const r of channelDist) console.log(`  ${r.channel}: ${r.c}행 / ${r.orders}주문 / ₩${(r.rev||0).toLocaleString()}`);
console.log('\n주문상태:');
for (const r of statusDist) console.log(`  ${r.status}: ${r.orders}주문 / ₩${(r.rev||0).toLocaleString()}`);

// 거래종료 자사몰 LTV TOP 10
console.log('\n═══ 더클린커피 자사몰 거래종료 LTV TOP 10 (phone 기준) ═══');
const ltv = db.prepare(`
  WITH orders AS (
    SELECT DISTINCT order_no, orderer_phone_norm, final_amount, channel, status
    FROM coffee_orders_excel
    WHERE source_file=? AND status='거래종료'
      AND channel='더클린 커피 (the clean coffee)'
      AND orderer_phone_norm != ''
  )
  SELECT orderer_phone_norm phone, COUNT(*) orders, SUM(final_amount) total_rev
  FROM orders GROUP BY orderer_phone_norm
  ORDER BY total_rev DESC LIMIT 10
`).all(sourceFile);
for (const r of ltv) console.log(`  ${r.phone} · ${r.orders}회 · ₩${(r.total_rev||0).toLocaleString()}`);

// LTV 분포
console.log('\n═══ 거래종료 자사몰 LTV 분포 (12개월) ═══');
const dist = db.prepare(`
  WITH orders AS (
    SELECT DISTINCT order_no, orderer_phone_norm, final_amount
    FROM coffee_orders_excel
    WHERE source_file=? AND status='거래종료'
      AND channel='더클린 커피 (the clean coffee)'
      AND orderer_phone_norm != ''
  ),
  cust AS (
    SELECT orderer_phone_norm phone, SUM(final_amount) rev, COUNT(*) cnt
    FROM orders GROUP BY orderer_phone_norm
  )
  SELECT
    SUM(CASE WHEN rev >= 5000000 THEN 1 ELSE 0 END) ge_5M,
    SUM(CASE WHEN rev >= 2000000 THEN 1 ELSE 0 END) ge_2M,
    SUM(CASE WHEN rev >= 1000000 THEN 1 ELSE 0 END) ge_1M,
    SUM(CASE WHEN rev >= 500000  THEN 1 ELSE 0 END) ge_500K,
    SUM(CASE WHEN rev >= 300000  THEN 1 ELSE 0 END) ge_300K,
    SUM(CASE WHEN rev >= 100000  THEN 1 ELSE 0 END) ge_100K,
    SUM(CASE WHEN cnt >= 6 THEN 1 ELSE 0 END) repeat_6plus,
    SUM(CASE WHEN cnt >= 3 THEN 1 ELSE 0 END) repeat_3plus,
    SUM(CASE WHEN cnt >= 2 THEN 1 ELSE 0 END) repeat_2plus,
    COUNT(*) paying_total,
    SUM(rev) sum_rev,
    MAX(rev) max_rev
  FROM cust
`).get(sourceFile);
console.log(JSON.stringify(dist, null, 2));

db.close();
console.log('\n✓ done');
