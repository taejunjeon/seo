import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  lookupGoogleAdsClickViewExact,
  type GoogleAdsClickViewCandidate,
} from "../src/googleAdsClickViewExactLookup";

const sha256Hex = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const DUMMY_SECRET = "dummy-secret-fixture-only";

const fakeClickViewCandidates: GoogleAdsClickViewCandidate[] = [
  {
    rawClickId: "FIX-GCLID-AAA",
    clickIdType: "gclid",
    campaignId: "22018174474",
    campaignName: "[PM]건기식 실적최대화",
    clickTimeIso: "2026-05-10T00:00:00.000Z",
  },
  {
    rawClickId: "FIX-GBRAID-BBB",
    clickIdType: "gbraid",
    campaignId: "21807994952",
    campaignName: "[PM]검사권 실적최대화",
    clickTimeIso: "2026-05-10T01:00:00.000Z",
  },
];

test("googleAdsClickViewExactLookup: ledger click_hash matches gclid → campaign_id exact", async () => {
  const ledgerHash = sha256Hex("FIX-GCLID-AAA");
  const result = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes: [ledgerHash],
    hmacSecret: DUMMY_SECRET,
    clickViewCandidates: fakeClickViewCandidates,
  });
  assert.equal(result.ok, true);
  assert.equal(result.matches, 1);
  assert.equal(result.rows[0].click_view_exact_match, true);
  assert.equal(result.rows[0].campaign_id, "22018174474");
  assert.equal(result.rows[0].click_id_type, "gclid");
  assert.equal(result.rows[0].match_source, "google_ads_click_view");
});

test("googleAdsClickViewExactLookup: ledger click_hash matches gbraid → campaign_id exact", async () => {
  const ledgerHash = sha256Hex("FIX-GBRAID-BBB");
  const result = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes: [ledgerHash],
    hmacSecret: DUMMY_SECRET,
    clickViewCandidates: fakeClickViewCandidates,
  });
  assert.equal(result.rows[0].click_view_exact_match, true);
  assert.equal(result.rows[0].campaign_id, "21807994952");
  assert.equal(result.rows[0].click_id_type, "gbraid");
});

test("googleAdsClickViewExactLookup: ledger click_hash no match in candidates → click_view_not_found", async () => {
  const ledgerHash = sha256Hex("NOT-IN-CLICK-VIEW");
  const result = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes: [ledgerHash],
    hmacSecret: DUMMY_SECRET,
    clickViewCandidates: fakeClickViewCandidates,
  });
  assert.equal(result.rows[0].click_view_exact_match, false);
  assert.equal(result.rows[0].match_source, "fallback_blocked");
  assert.equal(result.rows[0].reason, "click_view_not_found");
});

test("googleAdsClickViewExactLookup: no candidates injected → source_blocked all", async () => {
  const ledgerHash = sha256Hex("FIX-GCLID-AAA");
  const result = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes: [ledgerHash],
    hmacSecret: DUMMY_SECRET,
    clickViewCandidates: [],
  });
  assert.equal(result.source_blocked, 1);
  assert.equal(result.rows[0].click_view_exact_match, false);
  assert.equal(result.rows[0].match_source, "fallback_blocked");
  assert.equal(result.rows[0].reason, "no_raw_click_id_candidates_injected");
});

test("googleAdsClickViewExactLookup: raw gclid/gbraid never appears in output", async () => {
  const ledgerHash = sha256Hex("FIX-GCLID-AAA");
  const result = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes: [ledgerHash],
    hmacSecret: DUMMY_SECRET,
    clickViewCandidates: fakeClickViewCandidates,
  });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("FIX-GCLID-AAA"), "raw gclid must not appear");
  assert.ok(!serialized.includes("FIX-GBRAID-BBB"), "raw gbraid must not appear");
});
