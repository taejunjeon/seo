import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `injector-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let injector: typeof import("../src/clickViewCandidatesInjector");
let crmLocal: typeof import("../src/crmLocalDb");

const now = Date.now();
const isoNowMinus = (mins: number) => new Date(now - mins * 60 * 1000).toISOString();

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
  injector = await import("../src/clickViewCandidatesInjector");

  const db = crmLocal.getCrmDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_click_intent_ledger (
      intent_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      captured_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      platform_hint TEXT NOT NULL DEFAULT 'google_ads',
      capture_stage TEXT NOT NULL DEFAULT 'landing',
      click_id_type TEXT NOT NULL DEFAULT '',
      click_id_value TEXT NOT NULL DEFAULT '',
      click_id_hash TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      landing_path TEXT NOT NULL DEFAULT '',
      allowed_query_json TEXT NOT NULL DEFAULT '{}',
      referrer_host TEXT NOT NULL DEFAULT '',
      client_id TEXT NOT NULL DEFAULT '',
      ga_session_id TEXT NOT NULL DEFAULT '',
      local_session_id TEXT NOT NULL DEFAULT '',
      user_agent_hash TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      member_code TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received',
      reject_reason TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.prepare(`DELETE FROM paid_click_intent_ledger`).run();
  const insert = db.prepare(`
    INSERT INTO paid_click_intent_ledger
      (intent_id, site, captured_at, received_at, click_id_type, click_id_value,
       ga_session_id, client_id, local_session_id, utm_campaign, dedupe_key, expires_at, created_at, updated_at)
    VALUES (?, 'biocom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run("intent-A", isoNowMinus(20), isoNowMinus(20), "gclid", "CjMatchA", "sess-111", "cli-aa", "ls-1", "camp-A", "dedup-A", isoNowMinus(-720), isoNowMinus(20), isoNowMinus(20));
  insert.run("intent-B", isoNowMinus(40), isoNowMinus(40), "gbraid", "GbValB", "sess-222", "cli-bb", "ls-2", "camp-B", "dedup-B", isoNowMinus(-720), isoNowMinus(40), isoNowMinus(40));
  insert.run("intent-OLD", isoNowMinus(180), isoNowMinus(180), "gclid", "CjOLD", "sess-111", "cli-aa", "ls-1", "camp-A", "dedup-OLD", isoNowMinus(-540), isoNowMinus(180), isoNowMinus(180));
  insert.run("intent-EMPTY", isoNowMinus(10), isoNowMinus(10), "", "", "sess-111", "cli-aa", "ls-1", "camp-Z", "dedup-EMPTY", isoNowMinus(-720), isoNowMinus(10), isoNowMinus(10));
});

test.after(() => {
  try {
    if (typeof crmLocal?.resetCrmDbForTests === "function") {
      crmLocal.resetCrmDbForTests();
    }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore
  }
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("injector: ga_session_id match within 1h window returns gclid + click_view candidate", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [{ ga_session_id: "sess-111" }],
  });
  assert.equal(result.paid_click_intent_candidates.length, 1);
  assert.equal(result.paid_click_intent_candidates[0].intent_id, "intent-A");
  assert.equal(result.paid_click_intent_candidates[0].click_id_type, "gclid");
  assert.equal(result.click_view_candidates.length, 1);
  assert.equal(result.click_view_candidates[0].clickIdType, "gclid");
});

test("injector: client_id fallback works for gbraid row", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [{ client_id: "cli-bb" }],
  });
  assert.equal(result.paid_click_intent_candidates.length, 1);
  assert.equal(result.paid_click_intent_candidates[0].intent_id, "intent-B");
  assert.equal(result.paid_click_intent_candidates[0].click_id_type, "gbraid");
});

test("injector: empty click_id_value rows are excluded", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [{ ga_session_id: "sess-111" }],
  });
  const ids = result.paid_click_intent_candidates.map((c) => c.intent_id);
  assert.ok(!ids.includes("intent-EMPTY"), "empty click_id_value must be excluded");
});

test("injector: default 1h window skips 3h-old row", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [{ ga_session_id: "sess-111" }],
  });
  const ids = result.paid_click_intent_candidates.map((c) => c.intent_id);
  assert.ok(!ids.includes("intent-OLD"), "3h-old row must be outside default 1h window");
});

test("injector: explicit 6h window includes 3h-old row", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [{ ga_session_id: "sess-111" }],
    window: { minCapturedAtIso: isoNowMinus(360), maxCapturedAtIso: new Date(now).toISOString() },
  });
  const ids = result.paid_click_intent_candidates.map((c) => c.intent_id);
  assert.ok(ids.includes("intent-OLD"), "explicit 6h window should include 3h-old row");
});

test("injector: sessionKeys empty → 0 candidates + warning", () => {
  const result = injector.injectClickViewCandidatesFromPaidIntent({
    site: "biocom",
    sessionKeys: [],
  });
  assert.equal(result.paid_click_intent_candidates.length, 0);
  assert.ok(result.warnings.length > 0);
});
