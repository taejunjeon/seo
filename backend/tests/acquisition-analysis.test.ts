import assert from "node:assert/strict";
import test from "node:test";

import { resolveAcquisitionChannelGroup } from "../src/acquisitionAnalysis";

test("acquisition analysis: Naver brandsearch source containing igg stays Naver", () => {
  assert.equal(
    resolveAcquisitionChannelGroup("naverbrandsearch_biocom_mo_tab1_igg", "naverbrandsearch_biocom_mo_tab1_igg"),
    "Naver",
  );
});

test("acquisition analysis: short ig must be tokenized before Meta classification", () => {
  assert.equal(resolveAcquisitionChannelGroup("instagram", "referral"), "Meta Ads");
  assert.equal(resolveAcquisitionChannelGroup("paid_ig", "paid"), "Meta Ads");
  assert.equal(resolveAcquisitionChannelGroup("organic", "organic"), "Organic");
});
