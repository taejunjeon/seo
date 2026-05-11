import assert from "node:assert/strict";
import test from "node:test";

import { classifySiteLandingChannel } from "../src/siteLandingChannelClassifier";

test("gclid → paid_search google", () => {
  const r = classifySiteLandingChannel({ clickIdType: "gclid" });
  assert.equal(r.channel, "paid_search");
  assert.equal(r.source_breakdown, "google.com");
});

test("ttclid → paid_social tiktok", () => {
  const r = classifySiteLandingChannel({ clickIdType: "ttclid" });
  assert.equal(r.channel, "paid_social");
  assert.equal(r.source_breakdown, "tiktok.com");
});

test("nclick_id → paid_search naver", () => {
  const r = classifySiteLandingChannel({ clickIdType: "nclick_id" });
  assert.equal(r.channel, "paid_search");
  assert.equal(r.source_breakdown, "naver.com");
});

test("UTM medium=cpc source=instagram → paid_social", () => {
  const r = classifySiteLandingChannel({
    utm: { source: "instagram", medium: "cpc", campaign: "meta_biocom" },
  });
  assert.equal(r.channel, "paid_social");
  assert.equal(r.source_breakdown, "instagram");
});

test("UTM medium=cpc source=google → paid_search", () => {
  const r = classifySiteLandingChannel({
    utm: { source: "google", medium: "cpc", campaign: "search-brand" },
  });
  assert.equal(r.channel, "paid_search");
});

test("UTM medium=social → organic_social", () => {
  const r = classifySiteLandingChannel({
    utm: { source: "instagram", medium: "social" },
  });
  assert.equal(r.channel, "organic_social");
});

test("자기 도메인 referrer biocom.kr → self_internal", () => {
  const r = classifySiteLandingChannel({ referrerHost: "biocom.kr" });
  assert.equal(r.channel, "self_internal");
});

test("자기 도메인 biocom.imweb.me → self_internal", () => {
  const r = classifySiteLandingChannel({ referrerHost: "biocom.imweb.me" });
  assert.equal(r.channel, "self_internal");
});

test("referrer 없음 → direct", () => {
  const r = classifySiteLandingChannel({});
  assert.equal(r.channel, "direct");
});

test("naver search → organic_search", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "search.naver.com",
    referrerFullUrl: "https://search.naver.com/search.naver?query=biocom",
  });
  assert.equal(r.channel, "organic_search");
  assert.equal(r.source_breakdown, "search.naver.com");
});

test("daum search → organic_search", () => {
  const r = classifySiteLandingChannel({ referrerHost: "search.daum.net" });
  assert.equal(r.channel, "organic_search");
});

test("kakao kauth → organic_search 그룹", () => {
  const r = classifySiteLandingChannel({ referrerHost: "kauth.kakao.com" });
  assert.equal(r.channel, "organic_search");
});

test("instagram organic → organic_social", () => {
  const r = classifySiteLandingChannel({ referrerHost: "instagram.com" });
  assert.equal(r.channel, "organic_social");
});

test("facebook organic → organic_social", () => {
  const r = classifySiteLandingChannel({ referrerHost: "l.facebook.com" });
  assert.equal(r.channel, "organic_social");
});

test("외부 host (link.inpock.co.kr) → referral", () => {
  const r = classifySiteLandingChannel({ referrerHost: "link.inpock.co.kr" });
  assert.equal(r.channel, "referral");
});

test("google 검색 → organic_search", () => {
  const r = classifySiteLandingChannel({ referrerHost: "www.google.com" });
  assert.equal(r.channel, "organic_search");
});

test("syndicatedsearch.goog → organic_search", () => {
  const r = classifySiteLandingChannel({ referrerHost: "syndicatedsearch.goog" });
  assert.equal(r.channel, "organic_search");
});

test("threads.com → organic_social", () => {
  const r = classifySiteLandingChannel({ referrerHost: "www.threads.com" });
  assert.equal(r.channel, "organic_social");
});
