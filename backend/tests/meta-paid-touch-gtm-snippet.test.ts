import assert from "node:assert/strict";
import test from "node:test";

import { renderMetaPaidTouchGtmStorageTag } from "../src/metaPaidTouchGtmSnippet";

test("renderMetaPaidTouchGtmStorageTag stores paid touch without network send", () => {
  const snippet = renderMetaPaidTouchGtmStorageTag();

  assert.match(snippet, /biocom_paid_touch_before_checkout_v1/);
  assert.match(snippet, /_p1s1a_last_touch/);
  assert.match(snippet, /paidTouchBeforeCheckout/);
  assert.match(snippet, /utm_campaign/);
  assert.match(snippet, /meta_campaign_id/);
  assert.match(snippet, /meta_adset_id/);
  assert.match(snippet, /meta_ad_id/);
  assert.match(snippet, /campaign_alias/);
  assert.match(snippet, /isPaymentPath\(url\.pathname\)/);
  assert.match(snippet, /shouldReplace\(existing, incoming\)/);
  assert.doesNotMatch(snippet, /fetch\(/);
  assert.doesNotMatch(snippet, /navigator\.sendBeacon/);
  assert.doesNotMatch(snippet, /gtag\(/);
  assert.doesNotMatch(snippet, /fbq\(/);
  assert.doesNotMatch(snippet, /ttq\./);
});

test("renderMetaPaidTouchGtmStorageTag preserves existing Imweb last-touch compatibility", () => {
  const snippet = renderMetaPaidTouchGtmStorageTag({
    storageKey: "custom_paid_touch",
    legacyLastTouchKey: "_custom_last_touch",
    debugQueryKey: "__debug_paid_touch",
    ttlDays: 14,
  });

  assert.match(snippet, /custom_paid_touch/);
  assert.match(snippet, /_custom_last_touch/);
  assert.match(snippet, /__debug_paid_touch/);
  assert.match(snippet, /ttlMs: 14 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(snippet, /utm_source: firstNonEmpty/);
  assert.match(snippet, /utm_medium: firstNonEmpty/);
  assert.match(snippet, /utm_campaign: firstNonEmpty/);
  assert.match(snippet, /paidTouchBeforeCheckout: snapshot/);
});

test("renderMetaPaidTouchGtmStorageTag requires storage keys", () => {
  assert.throws(
    () => renderMetaPaidTouchGtmStorageTag({ storageKey: " " }),
    /storageKey is required/,
  );
  assert.throws(
    () => renderMetaPaidTouchGtmStorageTag({ legacyLastTouchKey: " " }),
    /legacyLastTouchKey is required/,
  );
});
