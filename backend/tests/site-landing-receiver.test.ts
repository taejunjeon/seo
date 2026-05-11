import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `site-landing-receiver-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let express: typeof import("express").default;
let createRouter: typeof import("../src/routes/attribution").createAttributionRouter;
let crmLocal: typeof import("../src/crmLocalDb");
let app: import("express").Express;

test.before(async () => {
  const exp = await import("express");
  express = exp.default;
  const routesMod = await import("../src/routes/attribution");
  createRouter = routesMod.createAttributionRouter;
  crmLocal = await import("../src/crmLocalDb");

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

async function post(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const server = app.listen(0);
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? (addr as { port: number }).port : 0;
    const res = await fetch(`http://127.0.0.1:${port}/api/attribution/site-landing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data };
  } finally {
    server.close();
  }
}

test("receiver: UTM paid_social landing → channel paid_social", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/product?utm_source=instagram&utm_medium=cpc",
    referrerHost: "instagram.com",
    referrerFullUrl: "https://instagram.com/",
    utm: { source: "instagram", medium: "cpc", campaign: "meta_biocom" },
    sessionKey: { gaSessionId: "sess-recv-1", clientId: "cli-recv-1" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.channel_classified, "paid_social");
  assert.equal(r.data.source_breakdown, "instagram");
});

test("receiver: organic search referrer → organic_search", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/",
    referrerHost: "search.naver.com",
    referrerFullUrl: "https://search.naver.com/search.naver?query=biocom",
    sessionKey: { gaSessionId: "sess-recv-2" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.channel_classified, "organic_search");
});

test("receiver: direct landing (no referrer) → direct", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/",
    sessionKey: { gaSessionId: "sess-recv-3" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.channel_classified, "direct");
  assert.equal(r.data.is_self_domain, true);
});

test("receiver: raw click_id 저장 + storage_mode=raw", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/?gclid=Cj0KCQ_RECV_RAW",
    clickId: { type: "gclid", valueOrHash: "Cj0KCQ_RECV_RAW", storageMode: "raw" },
    sessionKey: { gaSessionId: "sess-recv-4" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.click_id_storage_mode, "raw");
  assert.equal(r.data.channel_classified, "paid_search");
});

test("receiver: hash click_id 저장 + storage_mode=hash", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/?gclid=will_be_hashed_externally",
    clickId: { type: "gclid", valueOrHash: "abcdef1234hashhex", storageMode: "hash" },
    sessionKey: { gaSessionId: "sess-recv-5" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.click_id_storage_mode, "hash");
});

test("receiver: raw PII (email) 차단", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/?email=test@example.com",
    sessionKey: { gaSessionId: "sess-recv-6" },
  });
  assert.equal(r.status, 400);
  assert.equal(r.data.ok, false);
  assert.equal(r.data.rejected, true);
});

test("receiver: missing landingUrl → 400", async () => {
  const r = await post({ sessionKey: { gaSessionId: "sess-recv-7" } });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, "missing_landing_url");
});

test("receiver: duplicate landing (same session + url + 10min bucket) → deduped=true", async () => {
  const body = {
    landingUrl: "https://biocom.kr/dedupe-recv",
    landedAt: "2026-05-11T05:00:00.000Z",
    sessionKey: { gaSessionId: "sess-recv-dedup" },
  };
  const first = await post(body);
  const second = await post(body);
  assert.equal(first.data.deduped, false);
  assert.equal(second.data.deduped, true);
});

test("receiver: invariants_held flags 항상 false/0", async () => {
  const r = await post({
    landingUrl: "https://biocom.kr/inv-check",
    sessionKey: { gaSessionId: "sess-recv-inv" },
  });
  assert.equal(r.status, 200);
  const inv = r.data.invariants_held as Record<string, unknown>;
  assert.equal(inv.send_candidate, false);
  assert.equal(inv.actual_send_candidate, false);
  assert.equal(inv.upload_candidate, 0);
  assert.equal(inv.external_platform_send, 0);
  assert.equal(inv.operational_db_write, 0);
});
