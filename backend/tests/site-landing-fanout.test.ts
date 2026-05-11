import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `fanout-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let fanout: typeof import("../src/siteLandingFanout");
let crmLocal: typeof import("../src/crmLocalDb");
let ledger: typeof import("../src/siteLandingLedger");

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
  fanout = await import("../src/siteLandingFanout");
  ledger = await import("../src/siteLandingLedger");
  ledger.bootstrapSiteLandingTable();
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

const baseEntry = (overrides: Record<string, unknown> = {}): import("../src/attribution").AttributionLedgerEntry => ({
  touchpoint: "marketing_intent",
  captureMode: "live",
  paymentStatus: null,
  loggedAt: "2026-05-11T05:00:00.000Z",
  orderId: "",
  paymentKey: "",
  approvedAt: "",
  checkoutId: "",
  customerKey: "",
  landing: "https://biocom.kr/product/123",
  referrer: "https://instagram.com/",
  gaSessionId: "fanout-sess-1",
  utmSource: "instagram",
  utmMedium: "cpc",
  utmCampaign: "meta_biocom",
  utmTerm: "",
  utmContent: "",
  gclid: "",
  fbclid: "",
  ttclid: "",
  metadata: { clientId: "fanout-cli-1" },
  requestContext: { ip: "", userAgent: "", origin: "", requestReferer: "", method: "POST", path: "/" },
  ...overrides,
} as import("../src/attribution").AttributionLedgerEntry);

test("fanOutEntry: marketing_intent with UTM paid → channel paid_social, hash mode click 0", () => {
  const outcome = fanout.fanOutEntryToSiteLanding(baseEntry(), "marketing_intent");
  assert.equal(outcome.ok, true);
  if (outcome.ok) assert.equal(outcome.deduped, false);
});

test("fanOutEntry: gclid → sha256 hash 저장, raw 미저장", () => {
  const outcome = fanout.fanOutEntryToSiteLanding(
    baseEntry({
      loggedAt: "2026-05-11T05:10:00.000Z",
      gclid: "Cj0KCQ_FANOUT_RAW_VALUE",
      utmSource: "",
      utmMedium: "",
    }),
    "payment_success",
  );
  assert.equal(outcome.ok, true);

  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT click_id_storage_mode, click_id_value_or_hash FROM site_landing_ledger WHERE click_id_type = 'gclid' ORDER BY created_at DESC LIMIT 1")
    .get() as { click_id_storage_mode: string; click_id_value_or_hash: string } | undefined;
  assert.ok(row);
  assert.equal(row?.click_id_storage_mode, "hash");
  assert.notEqual(row?.click_id_value_or_hash, "Cj0KCQ_FANOUT_RAW_VALUE");
  assert.equal(row?.click_id_value_or_hash.length, 64); // sha256 hex
});

test("fanOutEntry: landing 없으면 skipped", () => {
  const outcome = fanout.fanOutEntryToSiteLanding(baseEntry({ landing: "" }), "marketing_intent");
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.reason, "missing_landing");
});

test("fanOutEntry: organic naver referrer → organic_search", () => {
  const outcome = fanout.fanOutEntryToSiteLanding(
    baseEntry({
      loggedAt: "2026-05-11T05:20:00.000Z",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      utmSource: "",
      utmMedium: "",
      gaSessionId: "fanout-sess-organic",
    }),
    "marketing_intent",
  );
  assert.equal(outcome.ok, true);
  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT channel_classified FROM site_landing_ledger WHERE ga_session_id = ?")
    .get("fanout-sess-organic") as { channel_classified: string } | undefined;
  assert.equal(row?.channel_classified, "organic_search");
});

test("fanOutEntry: payment_success entry 도 site_landing 에 mirror", () => {
  const outcome = fanout.fanOutEntryToSiteLanding(
    baseEntry({
      touchpoint: "payment_success",
      loggedAt: "2026-05-11T05:30:00.000Z",
      gaSessionId: "fanout-sess-pay",
      landing: "https://biocom.kr/order/complete",
    }),
    "payment_success",
  );
  assert.equal(outcome.ok, true);
});

test("fanOutPaidClickIntent: gclid preview → site_landing hash 저장", () => {
  const outcome = fanout.fanOutPaidClickIntentPreviewToSiteLanding({
    capturedAt: "2026-05-11T06:00:00.000Z",
    landingUrl: "https://biocom.kr/?gclid=Cj0KCQ_PCI_RAW",
    referrer: "https://google.com/",
    utm: { source: "google", medium: "cpc", campaign: "search-brand", term: "", content: "" },
    clickIds: { gclid: "Cj0KCQ_PCI_RAW", gbraid: "", wbraid: "" },
    sessionKey: { gaSessionId: "pci-sess-1", clientId: "pci-cli-1" },
  });
  assert.equal(outcome.ok, true);

  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT click_id_storage_mode, click_id_value_or_hash, channel_classified FROM site_landing_ledger WHERE ga_session_id = ?")
    .get("pci-sess-1") as
    | { click_id_storage_mode: string; click_id_value_or_hash: string; channel_classified: string }
    | undefined;
  assert.equal(row?.click_id_storage_mode, "hash");
  assert.notEqual(row?.click_id_value_or_hash, "Cj0KCQ_PCI_RAW");
  assert.equal(row?.channel_classified, "paid_search");
});

test("fanOutPaidClickIntent: 모든 click 없으면 channel 은 referrer 기반", () => {
  const outcome = fanout.fanOutPaidClickIntentPreviewToSiteLanding({
    capturedAt: "2026-05-11T06:10:00.000Z",
    landingUrl: "https://biocom.kr/",
    referrer: "https://instagram.com/",
    utm: { source: "", medium: "", campaign: "", term: "", content: "" },
    clickIds: { gclid: "", gbraid: "", wbraid: "" },
    sessionKey: { gaSessionId: "pci-sess-noclick", clientId: "pci-cli-noclick" },
  });
  assert.equal(outcome.ok, true);
  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT channel_classified FROM site_landing_ledger WHERE ga_session_id = ?")
    .get("pci-sess-noclick") as { channel_classified: string } | undefined;
  assert.equal(row?.channel_classified, "organic_social");
});

test("fanOutEntry: invariant — site_landing row 에 raw email/phone 없음", () => {
  fanout.fanOutEntryToSiteLanding(
    baseEntry({
      loggedAt: "2026-05-11T05:40:00.000Z",
      gaSessionId: "fanout-sess-piiscan",
      landing: "https://biocom.kr/clean",
    }),
    "marketing_intent",
  );
  const db = crmLocal.getCrmDb();
  const rows = db
    .prepare("SELECT * FROM site_landing_ledger")
    .all() as Array<Record<string, unknown>>;
  for (const r of rows) {
    const serialized = JSON.stringify(r);
    assert.ok(!/\b\d{2,3}-\d{3,4}-\d{4}\b/.test(serialized), "no phone");
    assert.ok(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized), "no email");
    assert.ok(!/\b\d{6}-?\d{7}\b/.test(serialized), "no jumin");
  }
});
