/**
 * builder dry-run v2 (gpt0508-40 작업5)
 *
 * 목적: enricher + injector + bridge 통합이 R2 ledger 11 row 스타일 입력에 대해
 *       5 cross_reference category 분포를 정확히 산출하는지 검증한다.
 *
 * 본 script 는:
 *   - operational DB 호출하지 않는다 (stub queryPg 사용)
 *   - Google Ads API 호출하지 않는다
 *   - VM R2 ledger 에 SSH 접속하지 않는다 (로컬 mock row 만 사용)
 *
 * R2 실측은 작업 6 peak canary 에서 진행한다.
 */

import { createHmac, createHash } from "node:crypto";

import { enrichConfirmedPurchaseWithLedgerLookup } from "../src/confirmedPurchaseLedgerLookupEnricher";
import type { OrderBridgeLedgerRow } from "../src/orderBridgeLedger";

const HMAC_SECRET = "dry-run-secret-20260511";
const hmacHex = (v: string) => createHmac("sha256", HMAC_SECRET).update(v).digest("hex");
const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");

type MockRow = {
  label: string;
  orderNo: string;
  hasClickIdHash: boolean;
  paymentStatus: "PAYMENT_COMPLETE" | "REFUND" | "PAYMENT_FAILED" | "PENDING";
  clickViewMatch: boolean;
};

const ROWS: MockRow[] = [
  { label: "5/9-tag-assistant-A (paid_click_intent matched)", orderNo: "ORD-001", hasClickIdHash: true, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: true },
  { label: "5/9-tag-assistant-B", orderNo: "ORD-002", hasClickIdHash: true, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: true },
  { label: "canary-row-001 (no click_id)", orderNo: "ORD-003", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-002 (no click_id)", orderNo: "ORD-004", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-003 (no click_id)", orderNo: "ORD-005", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-004 (no click_id)", orderNo: "ORD-006", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-005 (no click_id)", orderNo: "ORD-007", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-006 (no click_id)", orderNo: "ORD-008", hasClickIdHash: false, paymentStatus: "PAYMENT_COMPLETE", clickViewMatch: false },
  { label: "canary-row-007 (REFUND)", orderNo: "ORD-009", hasClickIdHash: false, paymentStatus: "REFUND", clickViewMatch: false },
  { label: "canary-row-008 (no click_id, unpaid)", orderNo: "ORD-010", hasClickIdHash: false, paymentStatus: "PENDING", clickViewMatch: false },
  { label: "canary-row-009 (no click_id, failed)", orderNo: "ORD-011", hasClickIdHash: false, paymentStatus: "PAYMENT_FAILED", clickViewMatch: false },
];

const toLedgerRow = (row: MockRow): OrderBridgeLedgerRow => ({
  bridgeId: `obid-${row.orderNo}`,
  site: "biocom",
  captureStage: "payment_success",
  receivedAt: "2026-05-11T01:00:00.000Z",
  orderNoHash: hmacHex(row.orderNo),
  clientId: `cli-${row.orderNo}`,
  gaSessionId: `sess-${row.orderNo}`,
  localSessionIdHash: sha256Hex(`ls-${row.orderNo}`),
  clickIdHash: row.hasClickIdHash ? sha256Hex(`click-for-${row.orderNo}`) : "",
  emailHash: sha256Hex(`email-${row.orderNo}`),
  phoneHash: "",
  identitySource: "email_only",
  dedupeKey: `dedup-${row.orderNo}`,
  duplicateCount: 0,
  status: row.paymentStatus === "PAYMENT_COMPLETE"
    ? (row.hasClickIdHash ? "full_bridge" : "click_missing_hold")
    : "identity_only_quarantine",
  rejectReason: "",
  rawPayloadStored: 0,
  platformSendCount: 0,
  expiresAt: "2027-05-11T01:00:00.000Z",
});

const stubQueryPg: import("../src/operationalPaymentCompleteLookup").OperationalPaymentCompleteRunner = async (
  _sql,
  _values,
) => {
  const nowIso = new Date().toISOString();
  const rows = ROWS.map((r) => ({
    order_number: r.orderNo,
    channel_order_no: r.orderNo,
    payment_status: r.paymentStatus,
    payment_method: "CARD",
    payment_complete_time: r.paymentStatus === "PAYMENT_COMPLETE" ? nowIso : null,
    order_date: nowIso,
    final_order_amount: "55000",
    now_utc: nowIso,
    max_order_utc: nowIso,
  }));
  return { rows };
};

const buildClickViewCandidates = (row: MockRow) => {
  if (!row.hasClickIdHash || !row.clickViewMatch) return [];
  return [
    {
      rawClickId: `click-for-${row.orderNo}`,
      clickIdType: "gclid" as const,
      campaignId: "11111111",
      campaignName: "dry-run-camp",
      clickTimeIso: "2026-05-11T00:55:00.000Z",
    },
  ];
};

const main = async () => {
  const distribution: Record<string, number> = {};
  const perRow: Array<{ label: string; category: string; budget_usable: boolean; click_view_exact: boolean; payment_match: boolean }> = [];

  for (const row of ROWS) {
    const ledgerRow = toLedgerRow(row);
    const result = await enrichConfirmedPurchaseWithLedgerLookup(
      {
        orderNo: row.orderNo,
        site: "biocom",
        confirmedPaidPurchase: row.paymentStatus === "PAYMENT_COMPLETE",
        pathBBridgePresent: row.hasClickIdHash,
      },
      {
        hmacSecret: HMAC_SECRET,
        ledgerRowOverride: [ledgerRow],
        operationalPaymentCompleteLookupDeps: {
          isDatabaseConfigured: () => true,
          queryPg: stubQueryPg,
        },
        clickViewCandidates: buildClickViewCandidates(row),
      },
    );

    const category = result.cross_reference_evidence?.category ?? "unknown";
    distribution[category] = (distribution[category] ?? 0) + 1;
    perRow.push({
      label: row.label,
      category,
      budget_usable: Boolean(result.budget_usable),
      click_view_exact: Boolean(result.click_view_exact_match),
      payment_match: Boolean(result.payment_complete_match),
    });
  }

  const out = {
    ok: true,
    schema_version: "builder_dry_run_v2_20260511",
    generated_at_kst: new Date().toISOString(),
    total_rows: ROWS.length,
    distribution,
    per_row: perRow,
    invariants_held: {
      send_candidate: false,
      actual_send_candidate: false,
      upload_candidate: 0,
      operational_db_write: 0,
      raw_pii_in_output: false,
    },
  };
  console.log(JSON.stringify(out, null, 2));
};

main().catch((err) => {
  console.error("dry-run-v2 failed", err);
  process.exit(1);
});
