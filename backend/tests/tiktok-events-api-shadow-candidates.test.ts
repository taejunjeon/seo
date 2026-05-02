import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { AttributionLedgerEntry } from "../src/attribution";
import type { TikTokPixelEvent } from "../src/tiktokPixelEvents";
import {
  buildTikTokEventsApiShadowCandidatesFromSources,
  buildTikTokServerEventIdCandidate,
  countTikTokEventsApiShadowCandidates,
  upsertTikTokEventsApiShadowCandidates,
} from "../src/tiktokEventsApiShadowCandidates";

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "node-test",
  origin: "https://biocom.kr",
  requestReferer: "https://biocom.kr/",
  method: "POST",
  path: "/api/attribution/tiktok-pixel-event",
};

const pixelEvent = (overrides: Partial<TikTokPixelEvent>): TikTokPixelEvent => ({
  eventLogId: overrides.eventLogId ?? `event-${overrides.orderCode ?? "order"}`,
  loggedAt: overrides.loggedAt ?? "2026-05-03T00:00:00.000Z",
  clientObservedAt: overrides.clientObservedAt ?? "2026-05-03T00:00:00.000Z",
  siteSource: overrides.siteSource ?? "biocom_imweb",
  pixelSource: overrides.pixelSource ?? "TIKTOK_PIXEL.track",
  action: overrides.action ?? "released_confirmed_purchase",
  eventName: overrides.eventName ?? "Purchase",
  eventId: overrides.eventId ?? overrides.orderCode ?? "o20260503abc",
  originalEventName: overrides.originalEventName ?? "",
  originalEventId: overrides.originalEventId ?? "",
  replacementEventName: overrides.replacementEventName ?? "",
  orderCode: overrides.orderCode ?? "o20260503abc",
  orderNo: overrides.orderNo ?? "202605031234567",
  paymentCode: overrides.paymentCode ?? "pa20260503abc",
  paymentKeyPresent: overrides.paymentKeyPresent ?? true,
  value: overrides.value ?? 11900,
  currency: overrides.currency ?? "KRW",
  decisionStatus: overrides.decisionStatus ?? "confirmed",
  decisionBranch: overrides.decisionBranch ?? "allow_purchase",
  decisionReason: overrides.decisionReason ?? "toss_direct_api_status",
  decisionMatchedBy: overrides.decisionMatchedBy ?? "toss_direct_payment_key",
  ttclid: overrides.ttclid ?? "ttclid-1",
  utmSource: overrides.utmSource ?? "tiktok",
  utmMedium: overrides.utmMedium ?? "paid",
  utmCampaign: overrides.utmCampaign ?? "campaign-a",
  utmContent: overrides.utmContent ?? "",
  utmTerm: overrides.utmTerm ?? "",
  url:
    overrides.url ??
    `https://biocom.kr/shop_payment_complete?order_code=${overrides.orderCode ?? "o20260503abc"}&order_no=${overrides.orderNo ?? "202605031234567"}&ttclid=ttclid-1`,
  referrer: overrides.referrer ?? "https://www.tiktok.com/",
  params: overrides.params ?? {},
  decision: overrides.decision ?? {},
  requestContext: overrides.requestContext ?? requestContext,
});

const ledgerEntry = (overrides: Partial<AttributionLedgerEntry>): AttributionLedgerEntry => ({
  touchpoint: overrides.touchpoint ?? "payment_success",
  captureMode: overrides.captureMode ?? "live",
  paymentStatus: overrides.paymentStatus ?? "confirmed",
  loggedAt: overrides.loggedAt ?? "2026-05-03T00:00:01.000Z",
  orderId: overrides.orderId ?? "202605031234567-P1",
  paymentKey: overrides.paymentKey ?? "pay-key",
  approvedAt: overrides.approvedAt ?? "2026-05-03T09:00:01+09:00",
  checkoutId: overrides.checkoutId ?? "",
  customerKey: overrides.customerKey ?? "",
  landing:
    overrides.landing ??
    "https://biocom.kr/shop_payment_complete?order_code=o20260503abc&order_no=202605031234567&payment_code=pa20260503abc&ttclid=ttclid-1",
  referrer: overrides.referrer ?? "https://www.tiktok.com/",
  gaSessionId: overrides.gaSessionId ?? "",
  utmSource: overrides.utmSource ?? "tiktok",
  utmMedium: overrides.utmMedium ?? "paid",
  utmCampaign: overrides.utmCampaign ?? "campaign-a",
  utmTerm: overrides.utmTerm ?? "",
  utmContent: overrides.utmContent ?? "",
  gclid: overrides.gclid ?? "",
  fbclid: overrides.fbclid ?? "",
  ttclid: overrides.ttclid ?? "ttclid-1",
  metadata: overrides.metadata ?? {
    orderCode: "o20260503abc",
    orderNo: "202605031234567",
    paymentCode: "pa20260503abc",
  },
  requestContext: overrides.requestContext ?? requestContext,
});

test("tiktok events api shadow: builds Purchase dedup candidate from confirmed TikTok order", () => {
  const event = pixelEvent({ eventId: "o20260503abc" });
  const result = buildTikTokEventsApiShadowCandidatesFromSources([event], [ledgerEntry({})], {
    now: "2026-05-03T00:10:00.000Z",
  });

  assert.equal(result.summary.totalCandidates, 1);
  assert.equal(result.summary.eligibleForFutureSend, 1);
  assert.equal(result.summary.sendCandidateTrue, 0);
  assert.equal(result.summary.platformSent, 0);
  const candidate = result.candidates[0];
  assert.equal(candidate.sendCandidate, false);
  assert.equal(candidate.platformSendStatus, "not_sent");
  assert.equal(candidate.serverEventIdCandidate, "Purchase_o20260503abc");
  assert.equal(candidate.browserEventIdObserved, "Purchase_o20260503abc");
  assert.equal(candidate.guardRawEventId, "o20260503abc");
  assert.equal(candidate.dedupReady, true);
  assert.equal(candidate.eligibleForFutureSend, true);
  assert.deepEqual(candidate.blockReasons, []);
});

test("tiktok events api shadow: blocks pending virtual-account Purchase", () => {
  const event = pixelEvent({
    action: "blocked_pending_purchase",
    decisionStatus: "pending",
    decisionBranch: "block_purchase_virtual_account",
  });
  const result = buildTikTokEventsApiShadowCandidatesFromSources(
    [event],
    [ledgerEntry({ paymentStatus: "pending" })],
  );

  assert.equal(result.summary.eligibleForFutureSend, 0);
  assert.ok(result.candidates[0].blockReasons.includes("pending_virtual_account"));
  assert.ok(result.candidates[0].blockReasons.includes("not_confirmed"));
  assert.equal(result.candidates[0].sendCandidate, false);
});

test("tiktok events api shadow: blocks confirmed order without TikTok evidence", () => {
  const event = pixelEvent({
    ttclid: "",
    utmSource: "",
    referrer: "https://biocom.kr/",
    url: "https://biocom.kr/shop_payment_complete?order_code=o20260503abc&order_no=202605031234567",
  });
  const entry = ledgerEntry({
    ttclid: "",
    utmSource: "",
    referrer: "https://biocom.kr/",
    landing: "https://biocom.kr/shop_payment_complete?order_code=o20260503abc&order_no=202605031234567",
    metadata: {
      orderCode: "o20260503abc",
      orderNo: "202605031234567",
    },
  });
  const result = buildTikTokEventsApiShadowCandidatesFromSources([event], [entry]);

  assert.equal(result.candidates[0].eligibleForFutureSend, false);
  assert.ok(result.candidates[0].blockReasons.includes("no_tiktok_evidence"));
  assert.equal(result.candidates[0].tiktokEvidencePresent, false);
});

test("tiktok events api shadow: persists only not_sent shadow rows in temp local DB", async () => {
  const testDbPath = path.join(os.tmpdir(), `tiktok-events-api-shadow-${process.pid}.sqlite3`);
  process.env.CRM_LOCAL_DB_PATH = testDbPath;
  const crmLocal = await import("../src/crmLocalDb");
  crmLocal.resetCrmDbForTests();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const filePath = `${testDbPath}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  try {
    const result = buildTikTokEventsApiShadowCandidatesFromSources(
      [pixelEvent({ eventId: "o20260503abc" })],
      [ledgerEntry({})],
    );
    const changed = upsertTikTokEventsApiShadowCandidates(result.candidates);
    const count = countTikTokEventsApiShadowCandidates();
    const db = crmLocal.getCrmDb();
    const row = db
      .prepare(
        "SELECT send_candidate, platform_send_status, server_event_id_candidate FROM tiktok_events_api_shadow_candidates",
      )
      .get() as { send_candidate: number; platform_send_status: string; server_event_id_candidate: string };

    assert.equal(changed, 1);
    assert.equal(count, 1);
    assert.equal(row.send_candidate, 0);
    assert.equal(row.platform_send_status, "not_sent");
    assert.equal(row.server_event_id_candidate, "Purchase_o20260503abc");
  } finally {
    crmLocal.resetCrmDbForTests();
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const filePath = `${testDbPath}${suffix}`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    delete process.env.CRM_LOCAL_DB_PATH;
  }
});

test("tiktok events api shadow: server event id builder uses final browser id format", () => {
  assert.equal(
    buildTikTokServerEventIdCandidate("Purchase", "o20260503abc"),
    "Purchase_o20260503abc",
  );
});
