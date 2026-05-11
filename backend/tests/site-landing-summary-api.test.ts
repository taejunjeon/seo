import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `site-landing-summary-api-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let express: typeof import("express").default;
let createRouter: typeof import("../src/routes/attribution").createAttributionRouter;
let crmLocal: typeof import("../src/crmLocalDb");
let ledger: typeof import("../src/siteLandingLedger");
let app: import("express").Express;

test.before(async () => {
  const exp = await import("express");
  express = exp.default;
  const r = await import("../src/routes/attribution");
  createRouter = r.createAttributionRouter;
  crmLocal = await import("../src/crmLocalDb");
  ledger = await import("../src/siteLandingLedger");
  ledger.bootstrapSiteLandingTable();

  // sample 데이터 inject
  for (let i = 0; i < 3; i++) {
    ledger.recordSiteLanding({
      site: "biocom",
      landedAt: new Date(Date.now() - i * 60 * 1000).toISOString(),
      landingUrl: `https://biocom.kr/p/${i}`,
      referrerHost: "instagram.com",
      referrerFullUrl: "https://instagram.com/",
      utm: { source: "instagram", medium: "cpc", campaign: "meta_biocom" },
      sessionKey: { gaSessionId: `sum-sess-${i}`, clientId: `sum-cli-${i}` },
      channelClassified: "paid_social",
      sourceBreakdown: "instagram",
    });
  }
  ledger.recordSiteLanding({
    site: "biocom",
    landedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    landingUrl: "https://biocom.kr/direct",
    sessionKey: { gaSessionId: "sum-direct" },
    channelClassified: "direct",
  });

  app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(createRouter());
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

async function get(path: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const server = app.listen(0);
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? (addr as { port: number }).port : 0;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const data = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data };
  } finally {
    server.close();
  }
}

test("summary API: default windowHours=24, total>=4", async () => {
  const r = await get("/api/attribution/site-landing/summary");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.mode, "read_only_no_send");
  assert.equal(r.data.window_hours, 24);
  assert.ok((r.data.total as number) >= 4);
});

test("summary API: derived 필드 모두 존재", async () => {
  const r = await get("/api/attribution/site-landing/summary");
  const derived = r.data.derived as Record<string, unknown>;
  assert.ok(derived);
  assert.equal(typeof derived.source_evidence_present_rate, "number");
  assert.equal(typeof derived.paid_hint_count, "number");
  assert.equal(typeof derived.organic_count, "number");
  assert.equal(typeof derived.direct_count, "number");
  assert.equal(typeof derived.referral_count, "number");
  assert.equal(typeof derived.unknown_or_hold_count, "number");
  assert.equal(typeof derived.raw_click_mode_count, "number");
  assert.equal(typeof derived.ttl_expiring_24h_count, "number");
  assert.equal(derived.external_send_count, 0);
  assert.equal(derived.upload_candidate_count, 0);
});

test("summary API: paid_hint_count 가 paid_social 3 + paid_search 0 = 3", async () => {
  const r = await get("/api/attribution/site-landing/summary");
  const derived = r.data.derived as Record<string, number>;
  assert.equal(derived.paid_hint_count, 3);
  assert.equal(derived.direct_count, 1);
});

test("summary API: invariants_held 항상 0/false", async () => {
  const r = await get("/api/attribution/site-landing/summary");
  const inv = r.data.invariants_held as Record<string, unknown>;
  assert.equal(inv.external_send_count, 0);
  assert.equal(inv.upload_candidate_count, 0);
  assert.equal(inv.gtm_publish, 0);
  assert.equal(inv.imweb_footer_edit, 0);
  assert.equal(inv.operational_db_write, 0);
  assert.equal(inv.raw_email_phone_member_payment_order_in_response, false);
});

test("summary API: windowHours=720 max clamp", async () => {
  const r = await get("/api/attribution/site-landing/summary?windowHours=9999");
  assert.equal(r.data.window_hours, 720);
});

test("summary API: response 안에 raw email/phone/jumin 패턴 0", async () => {
  const r = await get("/api/attribution/site-landing/summary");
  const serialized = JSON.stringify(r.data);
  assert.ok(!/\b\d{6}-?\d{7}\b/.test(serialized));
  assert.ok(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized));
});
