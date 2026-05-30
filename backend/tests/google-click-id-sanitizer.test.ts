import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelySyntheticGoogleClickId,
  sanitizeGoogleClickIdForStorage,
} from "../src/googleClickIdSanitizer";

test("google click id sanitizer keeps real Google click ids", () => {
  const realIds = [
    "EAIaIQobChMIraDmrJrXlAMVi34PAh1ppxy3EAAYASAAEgJg_PD_BwE",
    "CjwKCAjw2rrQBhBuEiwAarLWHfKy-dk-SqIuXjq9_GYk18_cwf-mjFYwkQNe6HbeysJzRwruMeajMBoCC0cQAvD_BwE",
    "0AAAAABIj2Jglr_XmOSLg-SWrtK-onwbPn",
  ];

  for (const value of realIds) {
    assert.equal(isLikelySyntheticGoogleClickId(value), false);
    assert.equal(sanitizeGoogleClickIdForStorage(value), value);
  }
});

test("google click id sanitizer removes smoke and preview markers", () => {
  const syntheticIds = [
    "TEST_GTM_NPAY_BRIDGE_V11_20260528",
    "SMOKE-google-click-id",
    "codex_preview_gclid",
    "GTM_TEST_ONLY",
  ];

  for (const value of syntheticIds) {
    assert.equal(isLikelySyntheticGoogleClickId(value), true);
    assert.equal(sanitizeGoogleClickIdForStorage(value), "");
  }
});

test("google click id sanitizer does not block plain GTM prefix without marker delimiter", () => {
  assert.equal(isLikelySyntheticGoogleClickId("GTMabcPotentialRealValue"), false);
  assert.equal(sanitizeGoogleClickIdForStorage("GTMabcPotentialRealValue"), "GTMabcPotentialRealValue");
});
