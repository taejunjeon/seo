import assert from "node:assert/strict";
import test from "node:test";

import { classifyAttributionChannel } from "../src/acquisitionCohort";

test("acquisition cohort: classifies YouTube by source and referrer", () => {
  assert.equal(classifyAttributionChannel({ utm_source: "youtube_shorts" }), "youtube");
  assert.equal(
    classifyAttributionChannel({ referrer: "https://m.youtube.com/watch?v=abc" }),
    "youtube",
  );
  assert.equal(classifyAttributionChannel({ referrer: "https://youtu.be/abc" }), "youtube");
});

test("acquisition cohort: classifies paid social and search channels", () => {
  assert.equal(classifyAttributionChannel({ utm_source: "meta_spring" }), "meta");
  assert.equal(classifyAttributionChannel({ utm_source: "facebook-cpc" }), "meta");
  assert.equal(classifyAttributionChannel({ utm_source: "instagram_reels" }), "meta");
  assert.equal(classifyAttributionChannel({ fbclid: "fb.1.123" }), "meta");

  assert.equal(classifyAttributionChannel({ utm_source: "tiktok_ads" }), "tiktok");
  assert.equal(classifyAttributionChannel({ ttclid: "ttclid-1" }), "tiktok");

  assert.equal(classifyAttributionChannel({ utm_source: "google_cpc" }), "google");
  assert.equal(classifyAttributionChannel({ gclid: "gclid-1" }), "google");
});

test("acquisition cohort: falls back to other and keeps rule priority", () => {
  assert.equal(classifyAttributionChannel({ utm_source: "newsletter" }), "other");
  assert.equal(
    classifyAttributionChannel({
      utm_source: "youtube",
      fbclid: "fbclid-1",
      gclid: "gclid-1",
    }),
    "youtube",
  );
});
