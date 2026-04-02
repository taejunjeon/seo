import path from "node:path";

import {
  appendLedgerEntry,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossJoinReport,
  readLedgerEntries,
} from "../src/attribution";
import { isDatabaseConfigured, queryPg } from "../src/postgres";

type ProbeOptions = {
  startDate: string;
  endDate: string;
  limit: number;
};

type TossRow = {
  paymentKey: string | null;
  orderId: string | null;
  approvedAt: string | null;
  status: string | null;
  channel: string | null;
  store: string | null;
  totalAmount: number | null;
};

const resolveKstDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const parseArgs = (): ProbeOptions => {
  const defaults: ProbeOptions = {
    startDate: resolveKstDate(),
    endDate: resolveKstDate(),
    limit: 1,
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    if (key === "--startDate") {
      defaults.startDate = value;
      index += 1;
      continue;
    }
    if (key === "--endDate") {
      defaults.endDate = value;
      index += 1;
      continue;
    }
    if (key === "--limit") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        defaults.limit = parsed;
      }
      index += 1;
    }
  }

  return defaults;
};

const fetchTossRows = async (startDate: string, endDate: string, limit: number) => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const result = await queryPg<TossRow>(
    `
      SELECT
        payment_key AS "paymentKey",
        order_id AS "orderId",
        approved_at AS "approvedAt",
        status,
        channel,
        store,
        total_amount AS "totalAmount"
      FROM tb_sales_toss
      WHERE ($1 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) >= $1)
        AND ($2 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) <= $2)
      ORDER BY approved_at DESC NULLS LAST
      LIMIT $3
    `,
    [startDate, endDate, limit],
  );

  return result.rows.map((row) => ({
    paymentKey: row.paymentKey ?? "",
    orderId: row.orderId ?? "",
    approvedAt: row.approvedAt ?? "",
    status: row.status ?? "",
    channel: row.channel ?? "",
    store: row.store ?? "",
    totalAmount: Number(row.totalAmount ?? 0),
  }));
};

const main = async () => {
  const options = parseArgs();
  const tossRows = await fetchTossRows(options.startDate, options.endDate, options.limit);
  if (tossRows.length === 0) {
    throw new Error(`No toss rows found for ${options.startDate} ~ ${options.endDate}`);
  }

  const selected =
    tossRows.find((row) => row.status.trim().toUpperCase() !== "CANCELED" && row.paymentKey && row.orderId) ??
    tossRows.find((row) => row.paymentKey && row.orderId) ??
    tossRows[0];
  const runId = Date.now();
  const ledgerPath = path.resolve(
    __dirname,
    "..",
    "logs",
    `attribution-live-probe-${options.startDate.replaceAll("-", "")}-${runId}.jsonl`,
  );
  const checkoutId = `live-probe-checkout-${runId}`;
  const customerKey = `ck_live_probe_${runId}`;
  const gaSessionId = `ga-live-probe-${runId}`;
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "codex-live-probe",
    origin: "http://localhost:7020",
    requestReferer: "https://biocom.kr/shop_payment",
    method: "POST",
    path: "/probe/live",
  } as const;

  const checkoutEntry = buildLedgerEntry(
    "checkout_started",
    {
      checkoutId,
      customerKey,
      landing: "/shop_payment",
      referrer: "https://biocom.kr/products/live-probe",
      gaSessionId,
      utmSource: "codex",
      utmMedium: "live_probe",
      utmCampaign: "p1-s1a-live-probe",
      gclid: `gclid-live-probe-${runId}`,
      captureMode: "live",
      metadata: {
        probe: true,
        probeType: "local_live_probe",
        note: "temp ledger only",
      },
    },
    requestContext,
  );

  const paymentEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: selected.orderId,
      paymentKey: selected.paymentKey,
      approvedAt: selected.approvedAt,
      checkoutId,
      customerKey,
      landing: "/order_complete",
      referrer: "https://biocom.kr/shop_payment",
      gaSessionId,
      utmSource: "codex",
      utmMedium: "live_probe",
      utmCampaign: "p1-s1a-live-probe",
      captureMode: "live",
      metadata: {
        probe: true,
        probeType: "local_live_probe",
        note: "temp ledger only",
        matchedTossRow: true,
      },
    },
    requestContext,
  );

  await appendLedgerEntry(checkoutEntry, ledgerPath);
  await appendLedgerEntry(paymentEntry, ledgerPath);

  const entries = await readLedgerEntries(ledgerPath);
  const report = buildTossJoinReport(entries, tossRows, options.limit);

  console.log(
    JSON.stringify(
      {
        purpose: "P1-S1A local live probe",
        note: [
          "실제 고객 사이트를 건드리지 않고 temp ledger에서 live row 흐름을 한 번 검증한다.",
          "main checkout-attribution-ledger.jsonl은 건드리지 않는다.",
          "선택한 최신 toss row와 payment_success live row가 조인되는지 본다.",
        ],
        inputs: options,
        tempLedgerPath: ledgerPath,
        selectedTossRow: selected,
        ledgerSummary: buildLedgerSummary(entries),
        tossJoinSummary: report.summary,
        matchedItemsPreview: report.items.slice(0, 3),
        unmatchedLedgerEntries: report.unmatchedLedgerEntries,
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown live probe error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
