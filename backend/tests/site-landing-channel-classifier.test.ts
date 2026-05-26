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

test("Naver brand search UTM survives self referrer as naver_brandsearch", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "thecleancoffee.com",
    referrerFullUrl: "https://thecleancoffee.com/thecleancoffee/?idx=75",
    utm: { source: "naver_brand_search", medium: "naver_brand_search", campaign: "" },
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "naver_brandsearch");
  assert.equal(r.source_breakdown, "naver_brand_search");
  assert.equal(r.reason, "utm_naver_brandsearch_marker");
});

test("Biocom Naver brand search UTM also stays separate from paid_search", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "biocom.kr",
    referrerFullUrl: "https://biocom.kr/",
    utm: {
      source: "naverbrandsearch_biocom_mo_mainhome",
      medium: "naverbrandsearch_biocom_mo_mainhome",
      campaign: "naverbrandsearch_biocom_MO_mainhome",
    },
    site: "biocom",
  });
  assert.equal(r.channel, "naver_brandsearch");
  assert.equal(r.source_breakdown, "naverbrandsearch_biocom_mo_mainhome");
  assert.equal(r.reason, "utm_naver_brandsearch_marker");
});

test("Biocom explicit Naver brandsearch UTM wins over preserved Google click id", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "",
    referrerFullUrl: "",
    utm: {
      source: "naverbrandsearch_biocom_pc_mainhome",
      medium: "naverbrandsearch_biocom_pc_mainhome",
      campaign: "naverbrandsearch_biocom_PC_mainhome",
    },
    clickIdType: "gclid",
    site: "biocom",
  });
  assert.equal(r.channel, "naver_brandsearch");
  assert.equal(r.source_breakdown, "naverbrandsearch_biocom_pc_mainhome");
  assert.equal(r.reason, "utm_naver_brandsearch_marker");
});

test("Current Google paid click remains paid_search when no Naver brandsearch marker exists", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "",
    referrerFullUrl: "",
    utm: {
      source: "google_biocom_pmkit_acid",
      medium: "google_biocom_pmkit_acid",
      campaign: "google_biocom_pmkit_acid0512",
    },
    clickIdType: "gclid",
    site: "biocom",
  });
  assert.equal(r.channel, "paid_search");
  assert.equal(r.source_breakdown, "google.com");
  assert.equal(r.reason, "click_id_type_google_paid");
});

test("Naver ad brandsearch campaign marker is naver_brandsearch", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "m.search.naver.com",
    utm: {
      source: "naverad_theclean_brandsearch_banatancoffeeopen",
      medium: "naverad_theclean_brandsearch_banatancoffeeopen",
      campaign: "naverad_theclean_brandsearch_banatancoffeeopen",
    },
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "naver_brandsearch");
  assert.equal(r.reason, "utm_naver_brandsearch_marker");
});

test("Naver powerlink marker remains generic paid_search", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "m.search.naver.com",
    utm: {
      source: "naver",
      medium: "powerlink",
      campaign: "coffee_nonbrand_powerlink",
    },
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "paid_search");
  assert.equal(r.reason, "utm_naver_paid_search_marker");
});

test("Naver shopping search ad click URL is naver_shopping_ad", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "search.naver.com",
    referrerFullUrl: "https://ader.naver.com/v1/test?c=naver.search.pc.npla&NaPm=1&ui=GUIDE",
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "naver_shopping_ad");
  assert.equal(r.reason, "naver_shopping_ad_marker");
});

test("Naver ADVoost display UTM is naver_display", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "m.search.naver.com",
    utm: {
      source: "naver",
      medium: "display",
      campaign: "advoost_shopping_april",
    },
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "naver_display");
  assert.equal(r.reason, "naver_display_marker");
});

test("Naver SmartStore referrer remains referral, not self-mall shopping ad", () => {
  const r = classifySiteLandingChannel({
    referrerHost: "smartstore.naver.com",
    referrerFullUrl: "https://smartstore.naver.com/lockhart",
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "referral");
  assert.equal(r.reason, "naver_commerce_referrer");
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
