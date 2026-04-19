import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const COFFEE_DATASET = `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`;
const COFFEE_LOCATION = "asia-northeast3";
const DEFAULT_START_SUFFIX = "20260412";
const DEFAULT_END_SUFFIX = "20260417";
const DEFAULT_STORE = "coffee";

type BigQueryRow = Record<string, unknown>;

type Ga4PurchaseRow = {
  transactionId: string;
  firstEventDate: string;
  lastEventDate: string;
  purchaseEvents: number;
  ga4Gross: number;
};

type TossRow = {
  transactionId: string;
  orderId: string;
  paymentKey: string;
  approvedAt: string;
  status: string;
  store: string;
  channel: string;
  totalAmount: number;
  cancelAmount: number;
};

type TossAggregate = {
  transactionId: string;
  rows: TossRow[];
  statuses: string[];
  firstApprovedAt: string | null;
  lastApprovedAt: string | null;
  confirmedRows: number;
  canceledRows: number;
  pendingRows: number;
  totalRows: number;
  confirmedGross: number;
  confirmedNet: number;
  cancelAmount: number;
  inWindow: boolean;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => {
  const startSuffix = argValue("startSuffix") ?? DEFAULT_START_SUFFIX;
  const endSuffix = argValue("endSuffix") ?? DEFAULT_END_SUFFIX;
  const store = argValue("store") ?? DEFAULT_STORE;
  const json = process.argv.includes("--json");

  for (const [label, suffix] of Object.entries({ startSuffix, endSuffix })) {
    if (!/^\d{8}$/.test(suffix)) throw new Error(`${label} must be YYYYMMDD: ${suffix}`);
  }
  if (startSuffix > endSuffix) throw new Error(`startSuffix must be <= endSuffix: ${startSuffix} > ${endSuffix}`);

  return { startSuffix, endSuffix, store, json };
};

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) throw new Error("GA4 service account key missing");
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });

  return google.bigquery({ version: "v2", auth });
};

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const runBigQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: COFFEE_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: COFFEE_LOCATION,
      timeoutMs: 30_000,
    },
  });

  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
};

const parseString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const queryGa4Purchases = async (
  bq: bigquery_v2.Bigquery,
  startSuffix: string,
  endSuffix: string,
): Promise<Ga4PurchaseRow[]> => {
  const rows = await runBigQuery(
    bq,
    `
      WITH purchase AS (
        SELECT
          event_date,
          COALESCE(ecommerce.transaction_id, (
            SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
          )) AS transaction_id,
          ecommerce.purchase_revenue AS purchase_revenue
        FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
        WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
          AND event_name = 'purchase'
      )
      SELECT
        transaction_id,
        MIN(event_date) AS first_event_date,
        MAX(event_date) AS last_event_date,
        COUNT(*) AS purchase_events,
        ROUND(SUM(COALESCE(purchase_revenue, 0))) AS ga4_gross
      FROM purchase
      WHERE transaction_id IS NOT NULL AND transaction_id != ''
      GROUP BY transaction_id
      ORDER BY first_event_date ASC, transaction_id ASC
    `,
  );

  return rows.map((row) => ({
    transactionId: parseString(row.transaction_id),
    firstEventDate: parseString(row.first_event_date),
    lastEventDate: parseString(row.last_event_date),
    purchaseEvents: parseNumber(row.purchase_events),
    ga4Gross: parseNumber(row.ga4_gross),
  }));
};

const queryTossRows = async (
  pool: Pool,
  transactionIds: string[],
  startDate: string,
  endDate: string,
  store: string,
): Promise<TossRow[]> => {
  const result = await pool.query<{
    transaction_id: string | null;
    order_id: string | null;
    payment_key: string | null;
    approved_at: string | null;
    status: string | null;
    store: string | null;
    channel: string | null;
    total_amount: string | number | null;
    cancel_amount: string | number | null;
  }>(
    `
      SELECT
        regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', '') AS transaction_id,
        order_id,
        payment_key,
        approved_at,
        status,
        store,
        channel,
        total_amount,
        cancel_amount
      FROM tb_sales_toss
      WHERE ($1 = '' OR store = $1)
        AND (
          regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', '') = ANY($2::text[])
          OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) BETWEEN $3 AND $4
        )
      ORDER BY approved_at ASC NULLS LAST, order_id ASC
    `,
    [store, transactionIds, startDate, endDate],
  );

  return result.rows
    .map((row) => ({
      transactionId: row.transaction_id ?? "",
      orderId: row.order_id ?? "",
      paymentKey: row.payment_key ?? "",
      approvedAt: row.approved_at ?? "",
      status: row.status ?? "",
      store: row.store ?? "",
      channel: row.channel ?? "",
      totalAmount: parseNumber(row.total_amount),
      cancelAmount: parseNumber(row.cancel_amount),
    }))
    .filter((row) => row.transactionId);
};

const isConfirmedStatus = (status: string) => {
  const normalized = status.trim().toUpperCase();
  return normalized === "DONE" || normalized === "PARTIAL_CANCELED";
};

const isCanceledStatus = (status: string) => status.trim().toUpperCase() === "CANCELED";

const isPendingStatus = (status: string) => {
  const normalized = status.trim().toUpperCase();
  return normalized.includes("WAIT") || normalized.includes("PENDING");
};

const aggregateTossRows = (rows: TossRow[], startDate: string, endDate: string) => {
  const byTransaction = new Map<string, TossAggregate>();

  for (const row of rows) {
    const current = byTransaction.get(row.transactionId) ?? {
      transactionId: row.transactionId,
      rows: [],
      statuses: [],
      firstApprovedAt: null,
      lastApprovedAt: null,
      confirmedRows: 0,
      canceledRows: 0,
      pendingRows: 0,
      totalRows: 0,
      confirmedGross: 0,
      confirmedNet: 0,
      cancelAmount: 0,
      inWindow: false,
    };

    const approvedDate = row.approvedAt.slice(0, 10);
    const confirmed = isConfirmedStatus(row.status);

    current.rows.push(row);
    current.totalRows += 1;
    if (!current.statuses.includes(row.status)) current.statuses.push(row.status);
    if (row.approvedAt && (!current.firstApprovedAt || row.approvedAt < current.firstApprovedAt)) {
      current.firstApprovedAt = row.approvedAt;
    }
    if (row.approvedAt && (!current.lastApprovedAt || row.approvedAt > current.lastApprovedAt)) {
      current.lastApprovedAt = row.approvedAt;
    }
    if (approvedDate >= startDate && approvedDate <= endDate) current.inWindow = true;
    if (confirmed) {
      current.confirmedRows += 1;
      current.confirmedGross += row.totalAmount;
      current.confirmedNet += row.totalAmount - row.cancelAmount;
      current.cancelAmount += row.cancelAmount;
    } else if (isCanceledStatus(row.status)) {
      current.canceledRows += 1;
    } else if (isPendingStatus(row.status)) {
      current.pendingRows += 1;
    }

    byTransaction.set(row.transactionId, current);
  }

  return byTransaction;
};

const sum = <T>(rows: T[], picker: (row: T) => number) =>
  rows.reduce((total, row) => total + picker(row), 0);

const pct = (numerator: number, denominator: number) =>
  denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(2));

const money = (value: number) => Math.round(value);

const isNpayTransaction = (transactionId: string) => transactionId.trim().toUpperCase().startsWith("NPAY");

const buildReconciliation = (ga4Rows: Ga4PurchaseRow[], tossRows: TossRow[], startDate: string, endDate: string) => {
  const ga4ByTransaction = new Map(ga4Rows.map((row) => [row.transactionId, row]));
  const tossByTransaction = aggregateTossRows(tossRows, startDate, endDate);
  const ga4NpayRows = ga4Rows.filter((row) => isNpayTransaction(row.transactionId));
  const ga4TossCandidateRows = ga4Rows.filter((row) => !isNpayTransaction(row.transactionId));

  const joined = ga4Rows.map((ga4) => {
    const toss = tossByTransaction.get(ga4.transactionId) ?? null;
    return {
      transactionId: ga4.transactionId,
      firstEventDate: ga4.firstEventDate,
      purchaseEvents: ga4.purchaseEvents,
      ga4Gross: ga4.ga4Gross,
      tossStatuses: toss?.statuses ?? [],
      tossConfirmedGross: toss?.confirmedGross ?? 0,
      tossConfirmedNet: toss?.confirmedNet ?? 0,
      tossCancelAmount: toss?.cancelAmount ?? 0,
      tossRows: toss?.totalRows ?? 0,
      tossFirstApprovedAt: toss?.firstApprovedAt ?? null,
      grossDiff: ga4.ga4Gross - (toss?.confirmedGross ?? 0),
      netDiff: ga4.ga4Gross - (toss?.confirmedNet ?? 0),
      hasToss: Boolean(toss),
      hasConfirmedToss: (toss?.confirmedRows ?? 0) > 0,
    };
  });

  const matchedConfirmed = joined.filter((row) => row.hasConfirmedToss);
  const ga4Only = joined.filter((row) => !row.hasToss);
  const ga4OnlyNpay = ga4Only.filter((row) => isNpayTransaction(row.transactionId));
  const ga4OnlyNonNpay = ga4Only.filter((row) => !isNpayTransaction(row.transactionId));
  const tossWithoutConfirmed = joined.filter((row) => row.hasToss && !row.hasConfirmedToss);
  const grossMismatches = matchedConfirmed.filter((row) => Math.abs(row.grossDiff) > 1);
  const netMismatches = matchedConfirmed.filter((row) => Math.abs(row.netDiff) > 1);
  const tossConfirmedInWindow = [...tossByTransaction.values()].filter((row) => row.inWindow && row.confirmedRows > 0);
  const tossOnlyConfirmed = tossConfirmedInWindow.filter((row) => !ga4ByTransaction.has(row.transactionId));

  return {
    summary: {
      ga4Transactions: ga4Rows.length,
      ga4PurchaseEvents: sum(ga4Rows, (row) => row.purchaseEvents),
      ga4Gross: money(sum(ga4Rows, (row) => row.ga4Gross)),
      ga4NpayTransactions: ga4NpayRows.length,
      ga4NpayGross: money(sum(ga4NpayRows, (row) => row.ga4Gross)),
      ga4TossCandidateTransactions: ga4TossCandidateRows.length,
      ga4TossCandidateGross: money(sum(ga4TossCandidateRows, (row) => row.ga4Gross)),
      tossConfirmedTransactionsInWindow: tossConfirmedInWindow.length,
      tossConfirmedGrossInWindow: money(sum(tossConfirmedInWindow, (row) => row.confirmedGross)),
      tossConfirmedNetInWindow: money(sum(tossConfirmedInWindow, (row) => row.confirmedNet)),
      matchedConfirmedTransactions: matchedConfirmed.length,
      matchedConfirmedRatePct: pct(matchedConfirmed.length, ga4Rows.length),
      matchedConfirmedRateAmongTossCandidatesPct: pct(matchedConfirmed.length, ga4TossCandidateRows.length),
      matchedGa4Gross: money(sum(matchedConfirmed, (row) => row.ga4Gross)),
      matchedTossConfirmedGross: money(sum(matchedConfirmed, (row) => row.tossConfirmedGross)),
      matchedTossConfirmedNet: money(sum(matchedConfirmed, (row) => row.tossConfirmedNet)),
      matchedGrossDiff: money(sum(matchedConfirmed, (row) => row.grossDiff)),
      matchedNetDiff: money(sum(matchedConfirmed, (row) => row.netDiff)),
      grossExactMatches: matchedConfirmed.length - grossMismatches.length,
      grossMismatchTransactions: grossMismatches.length,
      netExactMatches: matchedConfirmed.length - netMismatches.length,
      netMismatchTransactions: netMismatches.length,
      ga4OnlyTransactions: ga4Only.length,
      ga4OnlyNpayTransactions: ga4OnlyNpay.length,
      ga4OnlyNpayGross: money(sum(ga4OnlyNpay, (row) => row.ga4Gross)),
      ga4OnlyNonNpayTransactions: ga4OnlyNonNpay.length,
      ga4OnlyNonNpayGross: money(sum(ga4OnlyNonNpay, (row) => row.ga4Gross)),
      tossWithoutConfirmedTransactions: tossWithoutConfirmed.length,
      tossOnlyConfirmedTransactions: tossOnlyConfirmed.length,
    },
    samples: {
      grossMismatches: grossMismatches.slice(0, 10),
      ga4Only: ga4Only.slice(0, 10),
      ga4OnlyNonNpay: ga4OnlyNonNpay.slice(0, 10),
      tossWithoutConfirmed: tossWithoutConfirmed.slice(0, 10),
      tossOnlyConfirmed: tossOnlyConfirmed.slice(0, 10).map((row) => ({
        transactionId: row.transactionId,
        statuses: row.statuses,
        firstApprovedAt: row.firstApprovedAt,
        confirmedGross: money(row.confirmedGross),
        confirmedNet: money(row.confirmedNet),
      })),
    },
  };
};

const printMarkdown = (result: ReturnType<typeof buildReconciliation>, meta: Record<string, string>) => {
  const { summary, samples } = result;
  console.log(`# Coffee GA4 ↔ Toss reconciliation`);
  console.log("");
  console.log(`- Window: ${meta.startSuffix}~${meta.endSuffix} (${meta.startDate}~${meta.endDate})`);
  console.log(`- Store: ${meta.store}`);
  console.log(`- GA4 dataset: ${COFFEE_PROJECT_ID}.${COFFEE_DATASET}`);
  console.log("");
  console.log(`| Metric | Value |`);
  console.log(`|---|---:|`);
  for (const [key, value] of Object.entries(summary)) {
    console.log(`| ${key} | ${value ?? "n/a"} |`);
  }
  console.log("");
  console.log(`## Gross mismatches sample`);
  console.log("");
  console.log(`| transaction_id | GA4 gross | Toss confirmed gross | Toss confirmed net | gross diff | net diff | status |`);
  console.log(`|---|---:|---:|---:|---:|---:|---|`);
  for (const row of samples.grossMismatches) {
    console.log(
      `| ${row.transactionId} | ${money(row.ga4Gross)} | ${money(row.tossConfirmedGross)} | ${money(row.tossConfirmedNet)} | ${money(row.grossDiff)} | ${money(row.netDiff)} | ${row.tossStatuses.join(", ")} |`,
    );
  }
  if (samples.grossMismatches.length === 0) console.log(`| - | 0 | 0 | 0 | 0 | 0 | - |`);
};

const main = async () => {
  const args = parseArgs();
  const startDate = suffixToDate(args.startSuffix);
  const endDate = suffixToDate(args.endSuffix);
  const bq = createBigQueryClient();
  const pool = createPgPool();

  try {
    const ga4Rows = await queryGa4Purchases(bq, args.startSuffix, args.endSuffix);
    const tossRows = await queryTossRows(
      pool,
      ga4Rows.map((row) => row.transactionId),
      startDate,
      endDate,
      args.store,
    );
    const reconciliation = buildReconciliation(ga4Rows, tossRows, startDate, endDate);
    const output = {
      ok: true,
      checkedAt: new Date().toISOString(),
      projectId: COFFEE_PROJECT_ID,
      dataset: COFFEE_DATASET,
      store: args.store,
      window: { startSuffix: args.startSuffix, endSuffix: args.endSuffix, startDate, endDate },
      ...reconciliation,
    };

    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      printMarkdown(reconciliation, {
        startSuffix: args.startSuffix,
        endSuffix: args.endSuffix,
        startDate,
        endDate,
        store: args.store,
      });
    }
  } finally {
    await pool.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
