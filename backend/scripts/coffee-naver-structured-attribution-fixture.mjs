#!/usr/bin/env node
import assert from "node:assert/strict";

const trim = (value) => (value == null ? "" : String(value).trim());

export function parseNaverEvidence(urlLike, sourceName = "fixture") {
  const out = {
    naver_evidence_source: sourceName,
    naver_brandsearch_utm_present: false,
    napm_present: false,
    napm_ct: "",
    napm_tr: "",
    napm_nacn: "",
    napm_ci_present: false,
    napm_hk_present: false,
    srsltid_present: false,
    srsltid_source: "",
    n_media: "",
    n_query_present: false,
  };

  let url;
  try {
    url = new URL(urlLike, "https://thecleancoffee.com");
  } catch {
    return out;
  }

  const params = url.searchParams;
  const utmSource = trim(params.get("utm_source"));
  const utmMedium = trim(params.get("utm_medium"));
  out.naver_brandsearch_utm_present = /naver[_-]?brand/i.test(`${utmSource} ${utmMedium}`);

  const napmRaw = trim(params.get("NaPm"));
  if (napmRaw) {
    out.napm_present = true;
    for (const part of napmRaw.split("|")) {
      const index = part.indexOf("=");
      if (index <= 0) continue;
      const key = part.slice(0, index);
      const value = part.slice(index + 1);
      if (key === "ct") out.napm_ct = value.slice(0, 40);
      if (key === "tr") out.napm_tr = value.slice(0, 40);
      if (key === "nacn") out.napm_nacn = value.slice(0, 80);
      if (key === "ci") out.napm_ci_present = Boolean(value);
      if (key === "hk") out.napm_hk_present = Boolean(value);
    }
  }

  out.srsltid_present = Boolean(trim(params.get("srsltid")));
  out.srsltid_source = out.srsltid_present ? sourceName : "";
  out.n_media = trim(params.get("n_media")).slice(0, 80);
  out.n_query_present = Boolean(trim(params.get("n_query")));

  return out;
}

function run() {
  const naverBrand = parseNaverEvidence(
    "https://thecleancoffee.com/?utm_source=naver_brand_search&utm_medium=naver_brand_search&utm_content=home_pc&NaPm=ct%3Dmpndxf0w%7Cci%3DRAWCLICK%7Ctr%3Dbrnd%7Chk%3DRAWKEY%7Cnacn%3DTdgcB4ABequhB",
    "current_url",
  );
  assert.equal(naverBrand.naver_brandsearch_utm_present, true);
  assert.equal(naverBrand.napm_present, true);
  assert.equal(naverBrand.napm_tr, "brnd");
  assert.equal(naverBrand.napm_nacn, "TdgcB4ABequhB");
  assert.equal(naverBrand.napm_ci_present, true);
  assert.equal(naverBrand.napm_hk_present, true);
  assert.equal(Object.prototype.hasOwnProperty.call(naverBrand, "ci"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(naverBrand, "hk"), false);

  const organicWithSrsltid = parseNaverEvidence(
    "https://thecleancoffee.com/?srsltid=RAW_SRS_TOKEN",
    "google_organic_url",
  );
  assert.equal(organicWithSrsltid.srsltid_present, true);
  assert.equal(organicWithSrsltid.srsltid_source, "google_organic_url");
  assert.equal(Object.prototype.hasOwnProperty.call(organicWithSrsltid, "srsltid"), false);

  const naverShopping = parseNaverEvidence(
    "https://thecleancoffee.com/?n_media=shopping_ad&n_query=%EB%8D%94%ED%81%B4%EB%A6%B0%EC%BB%A4%ED%94%BC",
    "current_url",
  );
  assert.equal(naverShopping.n_media, "shopping_ad");
  assert.equal(naverShopping.n_query_present, true);
  assert.equal(Object.prototype.hasOwnProperty.call(naverShopping, "n_query"), false);

  const googleAds = parseNaverEvidence(
    "https://thecleancoffee.com/?gclid=TJ_GCLID_0527&gbraid=TJ_GBRAID_0527&gad_campaignid=14629255429",
    "current_url",
  );
  assert.equal(googleAds.napm_present, false);
  assert.equal(googleAds.srsltid_present, false);
  assert.equal(googleAds.naver_brandsearch_utm_present, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: "coffee-naver-structured-attribution-fixture",
        cases: 4,
        rawTokenFieldsStored: false,
      },
      null,
      2,
    ),
  );
}

run();
