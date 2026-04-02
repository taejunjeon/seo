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
