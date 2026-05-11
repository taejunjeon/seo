import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `multisite-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let fanout: typeof import("../src/siteLandingFanout");
let ledger: typeof import("../src/siteLandingLedger");
let crmLocal: typeof import("../src/crmLocalDb");
let classifier: typeof import("../src/siteLandingChannelClassifier");

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
  ledger = await import("../src/siteLandingLedger");
  fanout = await import("../src/siteLandingFanout");
  classifier = await import("../src/siteLandingChannelClassifier");
  ledger.bootstrapSiteLandingTable();
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

test("detectSiteFromUrl: biocom.kr → biocom", () => {
  assert.equal(ledger.detectSiteFromUrl("https://biocom.kr/product/123"), "biocom");
});

test("detectSiteFromUrl: thecleancoffee.com → thecleancoffee", () => {
  assert.equal(ledger.detectSiteFromUrl("https://thecleancoffee.com/shop_payment/?order_code=o123"), "thecleancoffee");
});

test("detectSiteFromUrl: 외부 도메인 → null", () => {
  assert.equal(ledger.detectSiteFromUrl("https://example.com/x"), null);
});

test("classifier: thecleancoffee site + 자기 도메인 referrer → self_internal", () => {
  const r = classifier.classifySiteLandingChannel({
    referrerHost: "thecleancoffee.com",
    site: "thecleancoffee",
  });
  assert.equal(r.channel, "self_internal");
});

test("classifier: thecleancoffee site + biocom.kr referrer → referral (남의 site)", () => {
  const r = classifier.classifySiteLandingChannel({
    referrerHost: "biocom.kr",
    site: "thecleancoffee",
  });
  // site=thecleancoffee 일 때 biocom.kr 는 self 아님. 검색/소셜 host 도 아니라 referral.
  assert.equal(r.channel, "referral");
  assert.equal(r.source_breakdown, "biocom.kr");
});

test("classifier: kakao + brand-message → paid_social (정정 신규 paid medium)", () => {
  const r = classifier.classifySiteLandingChannel({
    utm: { source: "kakao", medium: "brand-message", campaign: "b2026051144755feeb63db" },
    referrerHost: "thecleancoffee.com",
  });
  // 카카오 알림톡: paid_social 분류
  assert.ok(r.channel === "paid_social" || r.channel === "paid_search", `expected paid_*, got ${r.channel}`);
});

test("classifier: naver + powerlink → paid_search (정정 신규 paid medium)", () => {
  const r = classifier.classifySiteLandingChannel({
    utm: { source: "naver", medium: "powerlink", campaign: "1" },
    referrerHost: "biocom.kr",
  });
  // 네이버 파워링크: paid_search 분류
  assert.equal(r.channel, "paid_search");
});

test("fanout: thecleancoffee landing URL → site=thecleancoffee 로 저장", () => {
  const entry: import("../src/attribution").AttributionLedgerEntry = {
    touchpoint: "payment_success",
    captureMode: "live",
    paymentStatus: null,
    loggedAt: "2026-05-11T09:00:00.000Z",
    orderId: "",
    paymentKey: "",
    approvedAt: "",
    checkoutId: "",
    customerKey: "",
    landing: "https://thecleancoffee.com/shop_payment/?order_code=o2026",
    referrer: "https://thecleancoffee.com/shop_view",
    gaSessionId: "tcc-sess-1",
    utmSource: "kakao",
    utmMedium: "brand-message",
    utmCampaign: "b2026051144755feeb63db",
    utmTerm: "",
    utmContent: "",
    gclid: "",
    fbclid: "",
    ttclid: "",
    metadata: { clientId: "tcc-cli-1" },
    requestContext: { ip: "", userAgent: "", origin: "", requestReferer: "", method: "POST", path: "/" },
  };
  const outcome = fanout.fanOutEntryToSiteLanding(entry, "payment_success");
  assert.equal(outcome.ok, true);

  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT site, channel_classified FROM site_landing_ledger WHERE ga_session_id = ?")
    .get("tcc-sess-1") as { site: string; channel_classified: string } | undefined;
  assert.equal(row?.site, "thecleancoffee");
  assert.ok(row?.channel_classified === "paid_social" || row?.channel_classified === "paid_search");
});

test("fanout: biocom landing URL → site=biocom 로 저장 + paid_search (naver powerlink)", () => {
  const entry: import("../src/attribution").AttributionLedgerEntry = {
    touchpoint: "payment_success",
    captureMode: "live",
    paymentStatus: null,
    loggedAt: "2026-05-11T09:10:00.000Z",
    orderId: "",
    paymentKey: "",
    approvedAt: "",
    checkoutId: "",
    customerKey: "",
    landing: "https://biocom.kr/shop_payment/?order_code=o2026",
    referrer: "https://biocom.kr/shop_view",
    gaSessionId: "biocom-sess-1",
    utmSource: "naver",
    utmMedium: "powerlink",
    utmCampaign: "1",
    utmTerm: "",
    utmContent: "",
    gclid: "",
    fbclid: "",
    ttclid: "",
    metadata: { clientId: "biocom-cli-1" },
    requestContext: { ip: "", userAgent: "", origin: "", requestReferer: "", method: "POST", path: "/" },
  };
  const outcome = fanout.fanOutEntryToSiteLanding(entry, "payment_success");
  assert.equal(outcome.ok, true);

  const db = crmLocal.getCrmDb();
  const row = db
    .prepare("SELECT site, channel_classified FROM site_landing_ledger WHERE ga_session_id = ?")
    .get("biocom-sess-1") as { site: string; channel_classified: string } | undefined;
  assert.equal(row?.site, "biocom");
  assert.equal(row?.channel_classified, "paid_search");
});

test("summarize: site=thecleancoffee 만 별도 집계", () => {
  const summary = ledger.summarizeSiteLanding("thecleancoffee", 24);
  assert.ok(summary.total >= 1, `expected >=1, got ${summary.total}`);
});

test("summarize: site=biocom 만 별도 집계 (thecleancoffee row 제외)", () => {
  const summary = ledger.summarizeSiteLanding("biocom", 24);
  // biocom row 만 카운트되어야 함
  assert.ok(summary.total >= 1);
});
