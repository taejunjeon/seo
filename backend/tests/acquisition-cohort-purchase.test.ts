import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { FirstTouchSnapshot } from "../src/acquisitionCohort";
import type { ImwebOrderRow } from "../src/crmLocalDb";

const TEST_DB_PATH = path.join(os.tmpdir(), `acquisition-cohort-purchase-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let cohort: typeof import("../src/acquisitionCohort");
let crmLocal: typeof import("../src/crmLocalDb");

function resetDb() {
  crmLocal?.resetCrmDbForTests();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

function order(overrides: Partial<ImwebOrderRow>): ImwebOrderRow {
  return {
    order_key: overrides.order_key ?? "biocom:order",
    site: overrides.site ?? "biocom",
    order_no: overrides.order_no ?? overrides.order_key?.split(":").at(-1) ?? "order",
    order_code: overrides.order_code ?? "",
    channel_order_no: "",
    order_type: "shopping",
    sale_channel_idx: 1,
    device_type: "mobile",
    order_time_unix: null,
    order_time: overrides.order_time ?? "2026-01-02T00:00:00.000Z",
    complete_time_unix: null,
    complete_time: null,
    member_code: overrides.member_code ?? "member-1",
    orderer_name: "",
    orderer_call: overrides.orderer_call ?? "",
    pay_type: "card",
    pg_type: "tosspayments",
    price_currency: "KRW",
    total_price: overrides.total_price ?? overrides.payment_amount ?? 0,
    payment_amount: overrides.payment_amount ?? 0,
    coupon_amount: 0,
    delivery_price: 0,
    use_issue_coupon_codes: "[]",
    raw_json: overrides.raw_json ?? "{}",
  };
}

function touch(customerKey: string, channel: FirstTouchSnapshot["acquisition_channel"]): FirstTouchSnapshot {
  return {
    customer_key: customerKey,
    first_touch_at: "2026-01-01T00:00:00.000Z",
    acquisition_channel: channel,
    utm_source: channel === "youtube" ? "youtube_teamketo" : channel,
    utm_medium: "video",
    utm_campaign: "fixture",
  };
}

function insertOrderItems(items: Array<{ orderKey: string; itemName: string }>) {
  const db = crmLocal.getCrmDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS imweb_order_items (
      order_key TEXT NOT NULL,
      item_name TEXT NOT NULL
    )
  `);
  const stmt = db.prepare("INSERT INTO imweb_order_items (order_key, item_name) VALUES (?, ?)");
  for (const item of items) {
    stmt.run(item.orderKey, item.itemName);
  }
}

test.before(async () => {
  cohort = await import("../src/acquisitionCohort");
  crmLocal = await import("../src/crmLocalDb");
  resetDb();
});

test.after(() => {
  resetDb();
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("acquisition cohort purchase: attaches first purchase category with priority and Dangdangcare spacing", () => {
  crmLocal.upsertImwebOrders([
    order({
      order_key: "biocom:mixed",
      member_code: "member-mixed",
      payment_amount: 341800,
    }),
    order({
      order_key: "biocom:dang",
      member_code: "member-dang",
      payment_amount: 41800,
    }),
  ]);
  insertOrderItems([
    { orderKey: "biocom:mixed", itemName: "혈당관리엔 당당 케어 (120정)" },
    { orderKey: "biocom:mixed", itemName: "음식물 과민증 검사권" },
    { orderKey: "biocom:dang", itemName: "[정기구독] 혈당관리엔 당당 케어 (120정)" },
  ]);

  const rows = cohort.attachFirstPurchaseCategory([
    touch("member-mixed", "youtube"),
    touch("member-dang", "youtube"),
  ]);

  assert.equal(rows[0]?.first_purchase_category, "test_kit");
  assert.equal(rows[0]?.first_purchase_item_name, "음식물 과민증 검사권");
  assert.equal(rows[0]?.is_dangdangcare, false);
  assert.equal(rows[1]?.first_purchase_category, "supplement");
  assert.equal(rows[1]?.is_dangdangcare, true);
});

test("acquisition cohort purchase: builds supplement parent and Dangdangcare repeat sub-row", () => {
  crmLocal.upsertImwebOrders([
    order({
      order_key: "biocom:dd-1",
      member_code: "member-dd",
      order_time: "2026-01-02T00:00:00.000Z",
      payment_amount: 41800,
    }),
    order({
      order_key: "biocom:dd-2",
      member_code: "member-dd",
      order_time: "2026-02-01T00:00:00.000Z",
      payment_amount: 41800,
    }),
    order({
      order_key: "biocom:bio-1",
      member_code: "member-bio",
      order_time: "2026-01-03T00:00:00.000Z",
      payment_amount: 60000,
    }),
  ]);
  insertOrderItems([
    { orderKey: "biocom:dd-1", itemName: "혈당관리엔 당당케어 (120정)" },
    { orderKey: "biocom:dd-2", itemName: "혈당관리엔 당당케어 (120정)" },
    { orderKey: "biocom:bio-1", itemName: "바이오밸런스 90정" },
  ]);

  const report = cohort.buildChannelCategoryRepeatReport({
    startAt: "2026-01-01",
    endAt: "2026-01-31",
    firstTouches: [touch("member-dd", "youtube"), touch("member-bio", "youtube")],
    now: new Date("2026-04-17T00:00:00.000Z"),
  });

  const supplement = report.cells.find((cell) =>
    cell.channel === "youtube" && cell.category === "supplement" && !cell.isDangdangcare,
  );
  const dangdangcare = report.cells.find((cell) =>
    cell.channel === "youtube" && cell.category === "supplement" && cell.isDangdangcare,
  );

  assert.equal(supplement?.customerCount, 2);
  assert.equal(supplement?.repeaterCount, 1);
  assert.equal(supplement?.repeatRate, 0.5);
  assert.equal(supplement?.medianFirstPurchaseAmount, 50900);
  assert.equal(supplement?.median180dLtr, 71800);
  assert.equal(dangdangcare?.customerCount, 1);
  assert.equal(dangdangcare?.repeaterCount, 1);
  assert.ok((supplement?.customerCount ?? 0) >= (dangdangcare?.customerCount ?? 0));
});

test("acquisition cohort purchase: builds reverse funnel from supplement first purchase to test kit", () => {
  crmLocal.upsertImwebOrders([
    order({
      order_key: "biocom:conv-supp",
      member_code: "member-conv",
      order_time: "2026-01-02T00:00:00.000Z",
      payment_amount: 41800,
    }),
    order({
      order_key: "biocom:conv-test",
      member_code: "member-conv",
      order_time: "2026-03-01T00:00:00.000Z",
      payment_amount: 300000,
    }),
    order({
      order_key: "biocom:no-conv-supp",
      member_code: "member-no-conv",
      order_time: "2026-01-03T00:00:00.000Z",
      payment_amount: 60000,
    }),
  ]);
  insertOrderItems([
    { orderKey: "biocom:conv-supp", itemName: "혈당관리엔 당당케어 (120정)" },
    { orderKey: "biocom:conv-test", itemName: "음식물 과민증 검사권" },
    { orderKey: "biocom:no-conv-supp", itemName: "바이오밸런스 90정" },
  ]);

  const report = cohort.buildReverseFunnelReport({
    startAt: "2026-01-01",
    endAt: "2026-01-31",
    firstTouches: [touch("member-conv", "youtube"), touch("member-no-conv", "youtube")],
    now: new Date("2026-04-17T00:00:00.000Z"),
  });
  const youtube = report.byChannel.find((row) => row.channel === "youtube");

  assert.deepEqual(report.overall, {
    supplementFirstBuyers: 2,
    convertedToTest: 1,
    rate: 0.5,
  });
  assert.equal(youtube?.rate, 0.5);
});
