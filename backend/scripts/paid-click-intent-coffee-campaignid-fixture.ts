import assert from "node:assert/strict";

import { buildPaidClickIntentAllowedQueryJson } from "../src/paidClickIntentLog";
import { buildPaidClickIntentNoSendPreview } from "../src/routes/attribution";

const baseBody = {
  site: "thecleancoffee",
  event_name: "PaidClickIntent",
  capture_stage: "landing",
  captured_at: "2026-05-24T03:00:00.000Z",
  ga_session_id: "ga_session_fixture",
  local_session_id: "local_session_fixture",
  landing_url: "https://thecleancoffee.com/",
};

const parseAllowed = (preview: ReturnType<typeof buildPaidClickIntentNoSendPreview>) =>
  JSON.parse(buildPaidClickIntentAllowedQueryJson({
    site: preview.site,
    capture_stage: preview.capture_stage,
    captured_at: preview.captured_at,
    dedupe_key: preview.dedupe_key,
    has_google_click_id: preview.has_google_click_id,
    test_click_id: preview.test_click_id,
    live_candidate_after_approval: preview.live_candidate_after_approval,
    block_reasons: preview.block_reasons,
    click_ids: preview.click_ids,
    utm: preview.utm,
    client_id: preview.client_id,
    ga_session_id: preview.ga_session_id,
    local_session_id: preview.local_session_id,
    sanitized_landing_url: preview.sanitized_landing_url,
    sanitized_current_url: preview.sanitized_current_url,
    sanitized_referrer: preview.sanitized_referrer,
    google_campaign_id: preview.google_campaign_id,
    gad_campaignid: preview.gad_campaignid,
    gad_source: preview.gad_source,
    member_code: preview.member_code,
  })) as Record<string, string>;

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: "coffee site is allowed and current_url campaign hint is preserved",
    run() {
      const preview = buildPaidClickIntentNoSendPreview({
        ...baseBody,
        gclid: "live_click_fixture",
        current_url: "https://thecleancoffee.com/?gad_campaignid=14629255429&gad_source=1",
      });
      const allowed = parseAllowed(preview);

      assert.equal(preview.site, "thecleancoffee");
      assert.equal(preview.block_reasons.includes("site_not_allowed"), false);
      assert.equal(preview.live_candidate_after_approval, true);
      assert.equal(allowed.gad_campaignid, "14629255429");
      assert.equal(allowed.gad_source, "1");
    },
  },
  {
    name: "explicit campaign hint outranks landing and current url",
    run() {
      const preview = buildPaidClickIntentNoSendPreview({
        ...baseBody,
        gclid: "live_click_fixture",
        gad_campaignid: "222222222222",
        gad_source: "search",
        landing_url: "https://thecleancoffee.com/?gad_campaignid=111111111111&gad_source=landing",
        current_url: "https://thecleancoffee.com/?gad_campaignid=333333333333&gad_source=current",
      });
      const allowed = parseAllowed(preview);

      assert.equal(allowed.gad_campaignid, "222222222222");
      assert.equal(allowed.gad_source, "search");
    },
  },
  {
    name: "gad_campaignid without click id stays blocked as campaign hint only",
    run() {
      const preview = buildPaidClickIntentNoSendPreview({
        ...baseBody,
        current_url: "https://thecleancoffee.com/?gad_campaignid=14629255429&gad_source=1",
      });

      assert.equal(preview.block_reasons.includes("site_not_allowed"), false);
      assert.equal(preview.block_reasons.includes("missing_google_click_id"), true);
      assert.equal(preview.live_candidate_after_approval, false);
      assert.equal(preview.has_google_click_id, false);
    },
  },
  {
    name: "preview click id remains rejected for live ledger",
    run() {
      const preview = buildPaidClickIntentNoSendPreview({
        ...baseBody,
        gclid: "TEST_CLICK_FIXTURE",
        gad_campaignid: "14629255429",
      });

      assert.equal(preview.block_reasons.includes("site_not_allowed"), false);
      assert.equal(preview.block_reasons.includes("test_click_id_rejected_for_live"), true);
      assert.equal(preview.live_candidate_after_approval, false);
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  try {
    testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log(`${passed}/${cases.length} fixture cases passed`);
