import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `crm-local-imweb-order-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let crmLocal: typeof import("../src/crmLocalDb");

function resetDb() {
  crmLocal.resetCrmDbForTests();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
});

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  resetDb();
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("crmLocal imweb orders: upsert and stats aggregate by site", () => {
  crmLocal.upsertImwebOrders([
    {
      order_key: "thecleancoffee:order-1",
      site: "thecleancoffee",
      order_no: "order-1",
      order_code: "code-1",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "mobile",
      order_time_unix: 1775109060,
      order_time: "2026-04-01T01:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "member-1",
      orderer_name: "홍길동",
      orderer_call: "01012345678",
      pay_type: "npay",
      pg_type: "",
      price_currency: "KRW",
      total_price: 18300,
      payment_amount: 21300,
      coupon_amount: 0,
      delivery_price: 3000,
      use_issue_coupon_codes: "[]",
      raw_json: "{\"order_no\":\"order-1\"}",
    },
    {
      order_key: "thecleancoffee:order-2",
      site: "thecleancoffee",
      order_no: "order-2",
      order_code: "code-2",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "desktop",
      order_time_unix: 1775195460,
      order_time: "2026-04-02T01:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "",
      orderer_name: "김철수",
      orderer_call: "01087654321",
      pay_type: "card",
      pg_type: "tosspayments",
      price_currency: "KRW",
      total_price: 30000,
      payment_amount: 33000,
      coupon_amount: 1000,
      delivery_price: 3000,
      use_issue_coupon_codes: "[\"coupon-1\"]",
      raw_json: "{\"order_no\":\"order-2\"}",
    },
  ]);

  const allStats = crmLocal.getImwebOrderStats();
  const coffeeStats = crmLocal.getImwebOrderStats("thecleancoffee");
  const dbStats = crmLocal.getDbStats();

  assert.equal(allStats.totalOrders, 2);
  assert.equal(coffeeStats.totalOrders, 2);
  assert.equal(coffeeStats.memberOrders, 1);
  assert.equal(coffeeStats.phoneCustomers, 2);
  assert.equal(coffeeStats.paymentAmountSum, 54300);
  assert.equal(coffeeStats.firstOrderAt, "2026-04-01T01:11:00.000Z");
  assert.equal(coffeeStats.lastOrderAt, "2026-04-02T01:11:00.000Z");
  assert.equal(coffeeStats.bySite[0]?.site, "thecleancoffee");
  assert.equal(dbStats.imwebOrders, 2);
});

test("crmLocal imweb coupons: map issue coupon codes from cached orders", () => {
  crmLocal.upsertImwebOrders([
    {
      order_key: "biocom:coupon-order",
      site: "biocom",
      order_no: "202604101234567",
      order_code: "order-code-1",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "mobile",
      order_time_unix: 1775793060,
      order_time: "2026-04-10T01:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "member-1",
      orderer_name: "홍길동",
      orderer_call: "01012345678",
      pay_type: "card",
      pg_type: "tosspayments",
      price_currency: "KRW",
      total_price: 260000,
      payment_amount: 245000,
      coupon_amount: 15000,
      delivery_price: 0,
      use_issue_coupon_codes: "[\"issue-1\"]",
      raw_json: "{\"order_no\":\"202604101234567\"}",
    },
  ]);

  assert.deepEqual(crmLocal.listUnmappedImwebIssueCouponCodes("biocom", 10), [
    { issue_coupon_code: "issue-1" },
  ]);

  crmLocal.upsertImwebCouponMasters([
    {
      coupon_key: "biocom:coupon-1",
      site: "biocom",
      coupon_code: "coupon-1",
      name: "신규가입 1만5천원 쿠폰",
      status: "progress",
      type: "create",
      apply_sale_price: 15000,
      apply_sale_percent: 0,
      type_coupon_create_count: 1,
      type_coupon_use_count: 1,
      raw_json: "{\"coupon_code\":\"coupon-1\"}",
    },
  ]);
  crmLocal.upsertImwebIssueCoupons([
    {
      issue_key: "biocom:issue-1",
      site: "biocom",
      issue_coupon_code: "issue-1",
      coupon_code: "coupon-1",
      name: "신규가입 1만5천원 쿠폰",
      status: "complete",
      type: "create",
      coupon_issue_code: "PUBLIC-CODE",
      shop_order_code: "order-code-1",
      use_date: "2026-04-10 10:00:00",
      raw_json: "{\"coupon_code\":\"coupon-1\",\"name\":\"신규가입 1만5천원 쿠폰\"}",
    },
  ]);

  assert.deepEqual(crmLocal.listUnmappedImwebIssueCouponCodes("biocom", 10), []);

  const stats = crmLocal.getImwebCouponBackfillStats("biocom");
  assert.equal(stats.couponMasters, 1);
  assert.equal(stats.sourceIssueCouponCodes, 1);
  assert.equal(stats.mappedIssueCoupons, 1);
  assert.equal(stats.mappedIssueCouponsWithName, 1);
  assert.equal(stats.topNames[0]?.name, "신규가입 1만5천원 쿠폰");
  assert.equal(stats.topNames[0]?.issueCount, 1);

  const dbStats = crmLocal.getDbStats();
  assert.equal(dbStats.imwebCouponMasters, 1);
  assert.equal(dbStats.imwebIssueCoupons, 1);
});

test("crmLocal imweb orders: reconcile report matches Imweb base order ids against Toss", () => {
  crmLocal.upsertImwebOrders([
    {
      order_key: "biocom:matched",
      site: "biocom",
      order_no: "202604055309687",
      order_code: "code-1",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "mobile",
      order_time_unix: 1775109060,
      order_time: "2026-04-05T01:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "member-1",
      orderer_name: "홍길동",
      orderer_call: "010-1234-5678",
      pay_type: "card",
      pg_type: "tosspayments",
      price_currency: "KRW",
      total_price: 113000,
      payment_amount: 113000,
      coupon_amount: 0,
      delivery_price: 0,
      use_issue_coupon_codes: "[]",
      raw_json: "{\"order_no\":\"202604055309687\"}",
    },
    {
      order_key: "biocom:mismatch",
      site: "biocom",
      order_no: "202604056847482",
      order_code: "code-2",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "desktop",
      order_time_unix: 1775195460,
      order_time: "2026-04-05T02:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "",
      orderer_name: "김철수",
      orderer_call: "01087654321",
      pay_type: "card",
      pg_type: "tosspayments",
      price_currency: "KRW",
      total_price: 283000,
      payment_amount: 283000,
      coupon_amount: 0,
      delivery_price: 0,
      use_issue_coupon_codes: "[]",
      raw_json: "{\"order_no\":\"202604056847482\"}",
    },
    {
      order_key: "biocom:missing",
      site: "biocom",
      order_no: "202604057391762",
      order_code: "code-3",
      channel_order_no: "",
      order_type: "shopping",
      sale_channel_idx: 1,
      device_type: "desktop",
      order_time_unix: 1775199460,
      order_time: "2026-04-05T03:11:00.000Z",
      complete_time_unix: null,
      complete_time: null,
      member_code: "",
      orderer_name: "박영희",
      orderer_call: "01099998888",
      pay_type: "card",
      pg_type: "tosspayments",
      price_currency: "KRW",
      total_price: 245000,
      payment_amount: 245000,
      coupon_amount: 0,
      delivery_price: 0,
      use_issue_coupon_codes: "[]",
      raw_json: "{\"order_no\":\"202604057391762\"}",
    },
  ]);

  const db = crmLocal.getCrmDb();
  db.prepare(`
    INSERT INTO toss_transactions (transaction_key, payment_key, order_id, method, status, transaction_at, currency, amount, m_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    "txn-1",
    "iw_bi20260405004559w8bc6",
    "202604055309687-P1",
    "카드",
    "DONE",
    "2026-04-05T04:00:00.000Z",
    "KRW",
    113000,
    "m_bi",
  );
  db.prepare(`
    INSERT INTO toss_transactions (transaction_key, payment_key, order_id, method, status, transaction_at, currency, amount, m_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    "txn-2",
    "iw_bi20260405014051sGXQ8",
    "202604056847482-P1",
    "카드",
    "DONE",
    "2026-04-05T04:10:00.000Z",
    "KRW",
    280000,
    "m_bi",
  );
  db.prepare(`
    INSERT INTO toss_transactions (transaction_key, payment_key, order_id, method, status, transaction_at, currency, amount, m_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    "txn-3",
    "iw_bi20260405030000extra",
    "202604059999999-P1",
    "카드",
    "DONE",
    "2026-04-05T05:00:00.000Z",
    "KRW",
    99000,
    "m_bi",
  );

  const report = crmLocal.getImwebTossReconcileReport({
    site: "biocom",
    limit: 10,
    lookbackDays: 365,
    now: "2026-04-06T00:00:00.000Z",
  });

  assert.equal(report.tossStore, "biocom");
  assert.equal(report.imwebOrders, 3);
  assert.equal(report.tossOrders, 3);
  assert.equal(report.matchedOrders, 2);
  assert.equal(report.missingInToss, 1);
  assert.equal(report.missingInImweb, 1);
  assert.equal(report.amountMismatchCount, 1);
  assert.equal(report.coverageRate, 66.67);
  assert.equal(report.ageBuckets[0]?.key, "0_1d");
  assert.equal(report.ageBuckets[0]?.imwebOrders, 3);
  assert.equal(report.ageBuckets[0]?.matchedOrders, 2);
  assert.equal(report.ageBuckets[0]?.missingInToss, 1);
  assert.equal(report.ageBuckets[0]?.amountMismatchCount, 1);
  assert.equal(report.ageBuckets[0]?.coverageRate, 66.67);
  assert.equal(report.samples.missingInToss[0]?.orderIdBase, "202604057391762");
  assert.equal(report.samples.missingInImweb[0]?.orderIdBase, "202604059999999");
  assert.equal(report.samples.amountMismatches[0]?.paymentKey, "iw_bi20260405014051sGXQ8");
  assert.equal(report.samples.amountMismatches[0]?.normalizedPhone, "01087654321");
});
