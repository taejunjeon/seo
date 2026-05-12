import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `site-landing-npay-actual-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let ledger: typeof import("../src/siteLandingLedger");
let crmLocal: typeof import("../src/crmLocalDb");

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
  ledger = await import("../src/siteLandingLedger");
  ledger.bootstrapSiteLandingTable();

  const db = crmLocal.getCrmDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO imweb_orders (
      order_key, site, order_no, order_code, channel_order_no, order_time, complete_time,
      pay_type, payment_amount, total_price, raw_json, synced_at, imweb_status, imweb_status_synced_at
    )
    VALUES (?, 'biocom', ?, ?, '', ?, ?, 'npay', ?, ?, '{}', ?, ?, ?)
  `);

  stmt.run("case-actual-blank", "masked-1", "bridge-1", now, "", 88000, 88000, now, "PAYMENT_COMPLETE", now);
  stmt.run("case-legacy-only", "masked-2", "bridge-2", now, now, 99000, 99000, now, "PAYMENT_COMPLETE", now);
  stmt.run("case-status-only", "masked-3", "bridge-3", now, "", 70000, 70000, now, "PURCHASE_CONFIRMATION", now);
  stmt.run("case-lifecycle", "masked-4", "bridge-4", now, "", 33000, 33000, now, "DELIVERING", now);
  stmt.run("case-bridge-actual", "masked-5", "bridge-5", now, "", 50000, 50000, now, "PAYMENT_COMPLETE", now);
});

test.after(() => {
  try {
    if (typeof crmLocal?.resetCrmDbForTests === "function") crmLocal.resetCrmDbForTests();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore
  }
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("site_landing summary: NPay actual confirmed is separated from complete_time legacy", () => {
  const summary = ledger.summarizeSiteLanding("biocom", 24, {
    npayActualConfirmed30d: {
      source: "operational_db.tb_iamweb_users PAYMENT_COMPLETE",
      status: "included",
      complete_count: 2,
      complete_amount_krw: 138000,
      complete_amount_krw_korean: "₩13만 8,000",
      max_payment_complete_time: "2026-05-12T01:00:00.000Z",
      max_order_date: "2026-05-12 10:00:00",
      reason: "PAYMENT_COMPLETE aggregate fixture",
      warnings: [],
    },
  });

  const derived = summary.derived;
  assert.ok(derived);
  assert.equal(derived.npay_revenue_30d?.complete_count, 1);
  assert.equal(derived.npay_revenue_30d?.complete_amount_krw, 99000);
  assert.equal(derived.npay_revenue_30d_complete_time_legacy?.role, "legacy_diagnostic_only");
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.complete_count, 2);
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.complete_amount_krw, 138000);
  assert.equal(derived.npay_revenue_30d_bridge_pending?.pending_count, 4);
  assert.equal(derived.npay_revenue_30d_bridge_pending?.pending_amount_krw, 241000);
  assert.equal(derived.external_send_count, 0);
  assert.equal(derived.upload_candidate_count, 0);
  assert.equal(
    derived.source_disagreement_reason,
    "complete_time legacy와 actual confirmed source가 다르므로 예산 판단에는 actual confirmed만 사용한다.",
  );
});

test("site_landing summary: thecleancoffee included_with_warning actual source is accepted", () => {
  const summary = ledger.summarizeSiteLanding("thecleancoffee", 24, {
    npayActualConfirmed30d: {
      source: "imweb_v2_vm_cloud_imweb_orders",
      status: "included_with_warning",
      complete_count: 3,
      complete_amount_krw: 9000,
      complete_amount_krw_korean: "₩9,000",
      max_payment_complete_time: null,
      max_order_date: "2026-05-13T02:00:00.000Z",
      reason: "coffee Imweb v2 fixture",
      warnings: ["status_blank_rows_included_with_warning", "ga4_guard_not_actual_source"],
      gross_count: 6,
      gross_amount_krw: 21000,
      gross_amount_krw_korean: "₩2만 1,000",
      excluded_cancel_return_exchange_count: 3,
      excluded_cancel_return_exchange_amount_krw: 12000,
      excluded_cancel_return_exchange_amount_krw_korean: "₩1만 2,000",
      confirmed_status_count: 2,
      confirmed_status_amount_krw: 3000,
      confirmed_status_amount_krw_korean: "₩3,000",
      status_blank_count: 1,
      status_blank_amount_krw: 6000,
      status_blank_amount_krw_korean: "₩6,000",
      max_order_time: "2026-05-13T02:00:00.000Z",
      max_synced_at: "2026-05-13T03:00:00.000Z",
      max_status_synced_at: "2026-05-13T03:00:00.000Z",
      ga4_guard_role: "already_in_ga4_guard_only_not_actual_source",
    },
  });

  const derived = summary.derived;
  assert.ok(derived);
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.source, "imweb_v2_vm_cloud_imweb_orders");
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.status, "included_with_warning");
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.status_blank_count, 1);
  assert.equal(derived.npay_revenue_source?.actual_paid_source_primary, "imweb_v2_vm_cloud_imweb_orders");
  assert.equal(
    derived.npay_revenue_freshness?.actual_confirmed_source,
    "imweb_v2_vm_cloud_imweb_orders",
  );
  assert.equal(derived.npay_revenue_freshness?.confidence, "medium");
});

test("site_landing summary: source guard keeps forbidden proxies visible and no raw PII patterns", () => {
  const summary = ledger.summarizeSiteLanding("biocom", 24);
  const derived = summary.derived;
  assert.ok(derived);
  assert.equal(derived.npay_revenue_30d_actual_confirmed?.status, "unavailable");
  assert.ok(
    derived.npay_revenue_source?.forbidden_proxy.includes("complete_time_blank_only_unpaid"),
  );
  assert.ok(
    derived.npay_revenue_source?.forbidden_proxy.includes("imweb_status_only_actual_purchase"),
  );
  assert.ok(
    derived.npay_revenue_source?.forbidden_proxy.includes(
      "npay_click_count_add_payment_info_purchase",
    ),
  );

  const serialized = JSON.stringify(summary);
  assert.ok(!/\b\d{6}-?\d{7}\b/.test(serialized));
  assert.ok(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized));
  assert.ok(!/\b\d{2,3}-\d{3,4}-\d{4}\b/.test(serialized));
});
