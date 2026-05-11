import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `site-landing-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let mod: typeof import("../src/siteLandingLedger");
let crmLocal: typeof import("../src/crmLocalDb");

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
  mod = await import("../src/siteLandingLedger");
  mod.bootstrapSiteLandingTable();
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

test("bootstrap: table exists after bootstrapSiteLandingTable", () => {
  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get("site_landing_ledger") as { name: string } | undefined;
  assert.ok(row, "site_landing_ledger table must exist");
  assert.equal(row?.name, "site_landing_ledger");
});

test("record: UTM landing 저장 OK", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:00:00.000Z",
    landingUrl: "https://biocom.kr/product/123?utm_source=instagram&utm_medium=cpc",
    referrerFullUrl: "https://instagram.com/",
    referrerHost: "instagram.com",
    utm: { source: "instagram", medium: "cpc", campaign: "meta_biocom_yeondidle_igg" },
    sessionKey: { gaSessionId: "111111", clientId: "999.888" },
    channelClassified: "paid_social",
    sourceBreakdown: "instagram.com",
  });
  assert.equal(result.stored, true);
  if (result.stored) {
    assert.equal(result.deduped, false);
    assert.equal(result.row.utm.source, "instagram");
    assert.equal(result.row.channelClassified, "paid_social");
    assert.equal(result.row.isSelfDomain, false);
  }
});

test("record: organic referrer 저장 OK + is_self_domain=false", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:10:00.000Z",
    landingUrl: "https://biocom.kr/",
    referrerFullUrl: "https://search.naver.com/search.naver?query=biocom",
    referrerHost: "search.naver.com",
    sessionKey: { gaSessionId: "222222", clientId: "111.222" },
    channelClassified: "organic_search",
    sourceBreakdown: "naver.com",
  });
  assert.equal(result.stored, true);
  if (result.stored) assert.equal(result.row.isSelfDomain, false);
});

test("record: direct/self-domain referrer 분류", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:20:00.000Z",
    landingUrl: "https://biocom.kr/product/abc",
    referrerFullUrl: "https://biocom.kr/list",
    referrerHost: "biocom.kr",
    sessionKey: { gaSessionId: "333333", clientId: "333.444" },
    channelClassified: "self_internal",
  });
  assert.equal(result.stored, true);
  if (result.stored) assert.equal(result.row.isSelfDomain, true);
});

test("record: raw click_id 저장 + storage_mode=raw 유지", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:30:00.000Z",
    landingUrl: "https://biocom.kr/?gclid=Cj0KCQ_RAW_TEST",
    clickId: { type: "gclid", valueOrHash: "Cj0KCQ_RAW_TEST", storageMode: "raw" },
    sessionKey: { gaSessionId: "444444", clientId: "555.666" },
    channelClassified: "paid_search",
    sourceBreakdown: "google.com",
  });
  assert.equal(result.stored, true);
  if (result.stored) {
    assert.equal(result.row.clickId.storageMode, "raw");
    assert.equal(result.row.clickId.valueOrHash, "Cj0KCQ_RAW_TEST");
  }
});

test("record: hash click_id 저장 + storage_mode=hash", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:35:00.000Z",
    landingUrl: "https://biocom.kr/?gclid=hash_only_input",
    clickId: { type: "gclid", valueOrHash: "abcdef1234567890hashhex", storageMode: "hash" },
    sessionKey: { gaSessionId: "555555", clientId: "666.777" },
    channelClassified: "paid_search",
  });
  assert.equal(result.stored, true);
  if (result.stored) assert.equal(result.row.clickId.storageMode, "hash");
});

test("record: raw PII pattern 차단 (email)", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:40:00.000Z",
    landingUrl: "https://biocom.kr/?email=test@example.com",
    sessionKey: { gaSessionId: "666666" },
  });
  assert.equal(result.stored, false);
  if (!result.stored) assert.equal(result.rejected, true);
});

test("record: raw PII pattern 차단 (전화)", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T01:42:00.000Z",
    landingUrl: "https://biocom.kr/?phone=010-1234-5678",
    sessionKey: { gaSessionId: "777777" },
  });
  assert.equal(result.stored, false);
});

test("dedupe: 동일 sessionKey + 10분 bucket + 같은 URL → deduped=true", () => {
  const first = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T02:00:00.000Z",
    landingUrl: "https://biocom.kr/dedupe-test",
    sessionKey: { gaSessionId: "888888" },
  });
  const second = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T02:01:30.000Z",
    landingUrl: "https://biocom.kr/dedupe-test",
    sessionKey: { gaSessionId: "888888" },
  });
  assert.equal(first.stored, true);
  assert.equal(second.stored, true);
  if (first.stored && second.stored) {
    assert.equal(first.deduped, false);
    assert.equal(second.deduped, true);
    assert.equal(second.row.duplicateCount >= 1, true);
  }
});

test("dedupe: 같은 URL 다른 sessionKey → 별도 row", () => {
  const a = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T03:00:00.000Z",
    landingUrl: "https://biocom.kr/multi-session",
    sessionKey: { gaSessionId: "AAA" },
  });
  const b = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T03:00:30.000Z",
    landingUrl: "https://biocom.kr/multi-session",
    sessionKey: { gaSessionId: "BBB" },
  });
  assert.equal(a.stored, true);
  assert.equal(b.stored, true);
  if (a.stored && b.stored) {
    assert.equal(a.deduped, false);
    assert.equal(b.deduped, false);
  }
});

test("TTL: expires_at = landed_at + 30d default", () => {
  const result = mod.recordSiteLanding({
    site: "biocom",
    landedAt: "2026-05-11T04:00:00.000Z",
    landingUrl: "https://biocom.kr/ttl-test",
    sessionKey: { gaSessionId: "TTL-001" },
  });
  assert.equal(result.stored, true);
  if (result.stored) {
    const expectedMs = Date.parse("2026-05-11T04:00:00.000Z") + 30 * 24 * 60 * 60 * 1000;
    const actualMs = Date.parse(result.row.expiresAt);
    assert.equal(actualMs, expectedMs);
  }
});

test("summarize: 분포 / source top10 / joinable count", () => {
  const summary = mod.summarizeSiteLanding("biocom", 72);
  assert.ok(summary.total > 0);
  assert.ok(summary.joinable_session_key_count > 0);
  assert.ok(Object.keys(summary.channel_distribution).length > 0);
  assert.ok(Array.isArray(summary.source_breakdown_top10));
});
