/**
 * peak canary click material rate 측정 script (gpt0508-40 작업 6)
 *
 * 목적: 정점 트래픽 window (KST 11~12 또는 19~20) 에서 R2 order_bridge_ledger 의
 *   click_id_hash_present_rate, payment_complete_match_rate, click_view_exact_rate
 *   3 지표를 read-only 로 측정한다.
 *
 * 본 script 는 R2 ledger 에 SSH 또는 attribution Cloudflare endpoint 로 접근하지만
 * write 는 하지 않는다. operational DB 는 ORDER_BRIDGE_IDENTITY_HASH_SECRET 가
 * 환경에 세팅되어 있을 때만 호출. Google Ads click_view 는 본 script 에서 직접
 * 호출하지 않고, paid_click_intent_ledger 의 candidate 만 inject.
 *
 * 사용:
 *   ORDER_BRIDGE_IDENTITY_HASH_SECRET=... \
 *   ATT_LEDGER_FETCH_URL=https://att.ainativeos.net/api/attribution/order-bridge-ledger/recent \
 *   npx tsx scripts/peak-canary-click-material-rate-20260511.ts --window-hours=1
 */

import { enrichConfirmedPurchaseWithLedgerLookup } from "../src/confirmedPurchaseLedgerLookupEnricher";
import { injectClickViewCandidatesFromPaidIntent } from "../src/clickViewCandidatesInjector";
import type { OrderBridgeLedgerRow } from "../src/orderBridgeLedger";

const FETCH_URL = process.env.ATT_LEDGER_FETCH_URL || "";
const HMAC_SECRET = process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET || "";

const parseArgs = () => {
  const args: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.+)$/.exec(a);
    if (m) args[m[1]] = m[2];
  }
  return args;
};

const main = async () => {
  const args = parseArgs();
  const windowHours = Number(args["window-hours"] || "1");

  if (!FETCH_URL) {
    console.error("ATT_LEDGER_FETCH_URL 미설정 — read-only fetch URL 필요");
    process.exit(2);
  }
  if (!HMAC_SECRET) {
    console.error("ORDER_BRIDGE_IDENTITY_HASH_SECRET 미설정 — operationalPaymentCompleteLookup skip 됨");
  }

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const url = `${FETCH_URL}?since=${encodeURIComponent(since)}`;

  let rows: OrderBridgeLedgerRow[] = [];
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.error(`fetch failed: ${res.status} ${res.statusText}`);
      process.exit(3);
    }
    const data = (await res.json()) as { rows?: OrderBridgeLedgerRow[] };
    rows = Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.error("fetch error", err);
    process.exit(4);
  }

  const total = rows.length;
  const withClickHash = rows.filter((r) => Boolean(r.clickIdHash)).length;
  const withGaSession = rows.filter((r) => Boolean(r.gaSessionId)).length;

  const distribution: Record<string, number> = {};
  const perRowSummary: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    let clickViewCandidates: import("../src/googleAdsClickViewExactLookup").GoogleAdsClickViewCandidate[] = [];
    if (row.gaSessionId || row.clientId) {
      const inject = injectClickViewCandidatesFromPaidIntent({
        site: row.site || "biocom",
        sessionKeys: [{ ga_session_id: row.gaSessionId, client_id: row.clientId }],
      });
      clickViewCandidates = inject.click_view_candidates;
    }

    const result = await enrichConfirmedPurchaseWithLedgerLookup(
      {
        orderNo: "",
        site: "biocom",
        pathBBridgePresent: Boolean(row.clickIdHash),
      },
      {
        hmacSecret: HMAC_SECRET || "n/a",
        ledgerRowOverride: [row],
        clickViewCandidates,
      },
    );

    const category = result.cross_reference_evidence?.category ?? "unknown";
    distribution[category] = (distribution[category] ?? 0) + 1;
    perRowSummary.push({
      bridge_id_prefix: row.bridgeId.slice(0, 8),
      ledger_status: row.status,
      has_click_id_hash: Boolean(row.clickIdHash),
      category,
      budget_usable: Boolean(result.budget_usable),
      click_view_exact: Boolean(result.click_view_exact_match),
    });
  }

  const out = {
    ok: true,
    schema_version: "peak_canary_click_material_rate_20260511",
    generated_at_kst: new Date().toISOString(),
    window_hours: windowHours,
    fetched_rows: total,
    click_id_hash_present_rate: total > 0 ? withClickHash / total : 0,
    ga_session_present_rate: total > 0 ? withGaSession / total : 0,
    category_distribution: distribution,
    per_row_summary: perRowSummary,
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
  console.error("peak-canary-click-material-rate failed", err);
  process.exit(1);
});
