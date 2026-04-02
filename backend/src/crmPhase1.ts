import { readLedgerEntries, buildLedgerSummary, buildTossJoinReport, type AttributionLedgerEntry, type TossJoinRow } from "./attribution";
import { env } from "./env";
import {
  queryGA4NotSetDailyRevenue,
  queryGA4SeoConversionDiagnostic,
  type GA4NotSetDailyRevenueRow,
  type GA4SeoConversionDiagnosticResult,
} from "./ga4";
import { isDatabaseConfigured, queryPg } from "./postgres";

type RevenueApiEnvelope<T> = {
  status: string;
  data: T;
};

export type RevenueExperiment = {
  experiment_key: string;
  name: string;
  channel: string;
  status: string;
  assignment_version: number;
  conversion_window_days: number;
  variant_weights: Record<string, number>;
  created_at: string | null;
  updated_at: string | null;
};

export type RevenueExperimentResults = {
  experiment: RevenueExperiment;
  assignments: Array<{ variant_key: string; assignment_count: number }>;
  messages: Array<{ provider_status: string; message_count: number }>;
  variant_summary: Array<{
    variant_key: string;
    assignment_count: number;
    purchaser_count: number;
    purchase_count: number;
    revenue_amount: number;
    refund_amount: number;
    net_revenue: number;
    purchase_rate: number;
  }>;
  conversions: Array<{
    conversion_type: string;
    conversion_count: number;
    revenue_amount: number;
    refund_amount: number;
    net_revenue: number;
  }>;
};

export type RevenueAssignments = {
  total_count: number;
  limit: number;
  offset: number;
  items: Array<{
    customer_key: string;
    variant_key: string;
    assignment_bucket: number;
    assigned_at: string | null;
    source_segment: string | null;
    conversion_summary: {
      purchase_count: number;
      purchase_revenue: number;
      refund_amount: number;
      net_revenue: number;
      last_conversion_at: string | null;
      has_purchase: boolean;
    };
  }>;
};

type TossDailyRow = {
  date: string;
  approvalCount: number;
  totalAmount: number;
};

export type AttributionTimelineRow = {
  date: string;
  ga4NotSetPurchases: number;
  ga4NotSetRevenue: number;
  tossApprovalCount: number;
  tossApprovalAmount: number;
  paymentSuccessEntries: number;
  livePaymentSuccessEntries: number;
  replayPaymentSuccessEntries: number;
  smokePaymentSuccessEntries: number;
  checkoutEntries: number;
  diagnosticLabel: string;
};

export type Phase1OpsSnapshot = {
  range: { startDate: string; endDate: string };
  generatedAt: string;
  blockers: string[];
  p1s1: {
    revenueBridge: {
      configured: boolean;
      baseUrl: string | null;
      reachable: boolean;
      authReady: boolean;
      error: string | null;
    };
    experimentCount: number;
    experiments: RevenueExperiment[];
    selectedExperimentKey: string | null;
    selectedExperimentResults: RevenueExperimentResults | null;
    selectedAssignments: RevenueAssignments | null;
  };
  p1s1a: {
    ledgerSummary: ReturnType<typeof buildLedgerSummary>;
    tossJoinSummary: ReturnType<typeof buildTossJoinReport>["summary"];
    ga4NotSetTotals: {
      ecommercePurchases: number;
      grossPurchaseRevenue: number;
    } | null;
    ga4Diagnosis: Pick<
      GA4SeoConversionDiagnosticResult["summary"],
      "sourceSignals" | "dataQualitySignals" | "transactionSignals"
    > | null;
    timeline: AttributionTimelineRow[];
    nextActions: string[];
  };
};

const REVENUE_TIMEOUT_MS = 5000;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeDate = (value: string | null | undefined) => (value ?? "").trim().slice(0, 10);

const buildLedgerDailyCounts = (entries: AttributionLedgerEntry[]) => {
  const counts = new Map<
    string,
    {
      paymentSuccessEntries: number;
      paymentSuccessByCaptureMode: {
        live: number;
        replay: number;
        smoke: number;
      };
      checkoutEntries: number;
    }
  >();

  for (const entry of entries) {
    const date = normalizeDate(entry.loggedAt);
    if (!date) continue;
    const current = counts.get(date) ?? {
      paymentSuccessEntries: 0,
      paymentSuccessByCaptureMode: {
        live: 0,
        replay: 0,
        smoke: 0,
      },
      checkoutEntries: 0,
    };
    if (entry.touchpoint === "payment_success") {
      current.paymentSuccessEntries += 1;
      current.paymentSuccessByCaptureMode[entry.captureMode] += 1;
    }
    if (entry.touchpoint === "checkout_started") current.checkoutEntries += 1;
    counts.set(date, current);
  }

  return counts;
};

export const buildAttributionTimeline = (params: {
  ga4Rows: GA4NotSetDailyRevenueRow[];
  tossDailyRows: TossDailyRow[];
  ledgerEntries: AttributionLedgerEntry[];
}): AttributionTimelineRow[] => {
  const ga4Map = new Map(params.ga4Rows.map((row) => [row.date, row]));
  const tossMap = new Map(params.tossDailyRows.map((row) => [row.date, row]));
  const ledgerMap = buildLedgerDailyCounts(params.ledgerEntries);

  const allDates = [...new Set([...ga4Map.keys(), ...tossMap.keys(), ...ledgerMap.keys()])]
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  return allDates.map((date) => {
    const ga4 = ga4Map.get(date);
    const toss = tossMap.get(date);
    const ledger = ledgerMap.get(date);
    const livePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.live ?? 0;
    const replayPaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.replay ?? 0;
    const smokePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.smoke ?? 0;

    let diagnosticLabel = "정상 범위";
    if ((ga4?.grossPurchaseRevenue ?? 0) > 0 && livePaymentSuccessEntries === 0 && replayPaymentSuccessEntries > 0) {
      diagnosticLabel = "GA4 (not set) 매출과 토스 replay는 있으나 live receiver가 비어 있음";
    } else if ((ga4?.grossPurchaseRevenue ?? 0) > 0 && (ledger?.paymentSuccessEntries ?? 0) === 0) {
      diagnosticLabel = "GA4 (not set) 매출은 있는데 receiver row가 없음";
    } else if ((toss?.approvalCount ?? 0) > 0 && livePaymentSuccessEntries === 0 && replayPaymentSuccessEntries > 0) {
      diagnosticLabel = "토스 replay는 있으나 live payment success receiver가 비어 있음";
    } else if ((toss?.approvalCount ?? 0) > 0 && (ledger?.paymentSuccessEntries ?? 0) === 0) {
      diagnosticLabel = "토스 승인만 있고 payment success receiver가 비어 있음";
    } else if ((ledger?.paymentSuccessEntries ?? 0) > 0 && (toss?.approvalCount ?? 0) === 0) {
      diagnosticLabel = "receiver row는 있으나 토스 승인 집계와 분리됨";
    }

    return {
      date,
      ga4NotSetPurchases: ga4?.ecommercePurchases ?? 0,
      ga4NotSetRevenue: ga4?.grossPurchaseRevenue ?? 0,
      tossApprovalCount: toss?.approvalCount ?? 0,
      tossApprovalAmount: toss?.totalAmount ?? 0,
      paymentSuccessEntries: ledger?.paymentSuccessEntries ?? 0,
      livePaymentSuccessEntries,
      replayPaymentSuccessEntries,
      smokePaymentSuccessEntries,
      checkoutEntries: ledger?.checkoutEntries ?? 0,
      diagnosticLabel,
    };
  });
};

const isRevenueBridgeConfigured = () =>
  Boolean(env.REVENUE_API_BASE_URL?.trim() && env.REVENUE_API_BEARER_TOKEN?.trim());

const fetchRevenueJson = async <T>(pathname: string): Promise<T> => {
  if (!env.REVENUE_API_BASE_URL?.trim()) {
    throw new Error("REVENUE_API_BASE_URL is not configured");
  }
  if (!env.REVENUE_API_BEARER_TOKEN?.trim()) {
    throw new Error("REVENUE_API_BEARER_TOKEN is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVENUE_TIMEOUT_MS);

  try {
    const response = await fetch(`${trimTrailingSlash(env.REVENUE_API_BASE_URL)}${pathname}`, {
      headers: {
        Authorization: `Bearer ${env.REVENUE_API_BEARER_TOKEN}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`revenue api ${response.status}: ${body || response.statusText}`);
    }

    const payload = (await response.json()) as RevenueApiEnvelope<T>;
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
};

const fetchRevenueExperimentSnapshot = async (experimentKey?: string | null) => {
  if (!isRevenueBridgeConfigured()) {
    return {
      experiments: [] as RevenueExperiment[],
      selectedExperimentKey: null,
      selectedExperimentResults: null,
      selectedAssignments: null,
      error:
        !env.REVENUE_API_BASE_URL?.trim()
          ? "REVENUE_API_BASE_URL 미설정"
          : "REVENUE_API_BEARER_TOKEN 미설정",
    };
  }

  const experiments = await fetchRevenueJson<RevenueExperiment[]>("/api/crm/experiments");
  const selectedExperimentKey =
    experimentKey?.trim() || experiments[0]?.experiment_key || null;

  if (!selectedExperimentKey) {
    return {
      experiments,
      selectedExperimentKey: null,
      selectedExperimentResults: null,
      selectedAssignments: null,
      error: null,
    };
  }

  const [selectedExperimentResults, selectedAssignments] = await Promise.all([
    fetchRevenueJson<RevenueExperimentResults>(
      `/api/crm/experiments/${encodeURIComponent(selectedExperimentKey)}/results`,
    ),
    fetchRevenueJson<RevenueAssignments>(
      `/api/crm/experiments/${encodeURIComponent(selectedExperimentKey)}/assignments?limit=20&offset=0`,
    ),
  ]);

  return {
    experiments,
    selectedExperimentKey,
    selectedExperimentResults,
    selectedAssignments,
    error: null,
  };
};

const fetchTossRows = async (startDate: string, endDate: string, limit: number) => {
  if (!isDatabaseConfigured()) {
    return [] as TossJoinRow[];
  }

  const result = await queryPg<{
    paymentKey: string | null;
    orderId: string | null;
    approvedAt: string | null;
    status: string | null;
    channel: string | null;
    store: string | null;
    totalAmount: number | null;
  }>(
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

const fetchTossDailyRows = async (startDate: string, endDate: string) => {
  if (!isDatabaseConfigured()) {
    return [] as TossDailyRow[];
  }

  const result = await queryPg<TossDailyRow>(
    `
      SELECT
        SUBSTRING(approved_at, 1, 10) AS date,
        COUNT(*)::int AS "approvalCount",
        COALESCE(SUM(total_amount), 0)::float AS "totalAmount"
      FROM tb_sales_toss
      WHERE approved_at IS NOT NULL
        AND approved_at <> ''
        AND ($1 = '' OR SUBSTRING(approved_at, 1, 10) >= $1)
        AND ($2 = '' OR SUBSTRING(approved_at, 1, 10) <= $2)
      GROUP BY SUBSTRING(approved_at, 1, 10)
      ORDER BY SUBSTRING(approved_at, 1, 10) DESC
    `,
    [startDate, endDate],
  );

  return result.rows.map((row) => ({
    date: row.date,
    approvalCount: Number(row.approvalCount ?? 0),
    totalAmount: Number(row.totalAmount ?? 0),
  }));
};

const buildNextActions = (params: {
  ledgerEntries: AttributionLedgerEntry[];
  tossJoinSummary: ReturnType<typeof buildTossJoinReport>["summary"];
  revenueBridgeReady: boolean;
}): string[] => {
  const actions: string[] = [];
  const livePaymentSuccessEntries = params.tossJoinSummary.byCaptureMode.live.paymentSuccessEntries;
  const replayPaymentSuccessEntries = params.tossJoinSummary.byCaptureMode.replay.paymentSuccessEntries;

  if (!params.revenueBridgeReady) {
    actions.push("P1-S2 live 실험 목록을 보려면 seo backend에 REVENUE_API_BASE_URL / REVENUE_API_BEARER_TOKEN 설정이 필요하다.");
  }
  if (livePaymentSuccessEntries === 0 && replayPaymentSuccessEntries > 0) {
    actions.push("read-only 운영 DB replay row는 들어왔지만 live payment_success receiver는 아직 0건이다. 실제 고객 사이트에서 receiver 호출을 연결해야 한다.");
  } else if (livePaymentSuccessEntries === 0) {
    actions.push("P1-S1A는 아직 live receiver row가 0건이다. 고객 사이트 checkout 시작과 payment success에서 표준 receiver를 호출해야 한다.");
  }
  if (replayPaymentSuccessEntries === 0) {
    actions.push("운영 DB read-only 기준 plumbing 점검을 위해 /api/attribution/replay/toss?dryRun=true를 먼저 실행해 replay preview를 확인한다.");
  }
  if (params.tossJoinSummary.byCaptureMode.live.joinCoverageRate < 100) {
    actions.push("paymentKey / orderId 기준 토스 조인율이 100%가 아니다. 실제 결제 플로우에서 payment success payload에 두 값을 모두 남겨야 한다.");
  }
  actions.push("GA4 DebugView는 Codex가 코드로 준비할 수 있지만 브라우저 실결제 흐름 재현은 운영 병행이 필요하다.");
  return actions;
};

export const getPhase1OpsSnapshot = async (params: {
  startDate: string;
  endDate: string;
  experimentKey?: string | null;
}): Promise<Phase1OpsSnapshot> => {
  const { startDate, endDate, experimentKey } = params;
  const blockers: string[] = [];
  const ledgerEntries = await readLedgerEntries();
  const ledgerSummary = buildLedgerSummary(ledgerEntries);
  const tossRows = await fetchTossRows(startDate, endDate, 100);
  const tossDailyRows = await fetchTossDailyRows(startDate, endDate);
  const tossJoinReport = buildTossJoinReport(ledgerEntries, tossRows, 100);

  let ga4NotSetTotals: Phase1OpsSnapshot["p1s1a"]["ga4NotSetTotals"] = null;
  let ga4Diagnosis: Phase1OpsSnapshot["p1s1a"]["ga4Diagnosis"] = null;
  let timeline: AttributionTimelineRow[] = buildAttributionTimeline({
    ga4Rows: [],
    tossDailyRows,
    ledgerEntries,
  });

  try {
    const [ga4NotSetDaily, ga4Diagnostic] = await Promise.all([
      queryGA4NotSetDailyRevenue({ startDate, endDate }),
      queryGA4SeoConversionDiagnostic({ startDate, endDate }),
    ]);
    ga4NotSetTotals = ga4NotSetDaily.totals;
    ga4Diagnosis = {
      sourceSignals: ga4Diagnostic.summary.sourceSignals,
      dataQualitySignals: ga4Diagnostic.summary.dataQualitySignals,
      transactionSignals: ga4Diagnostic.summary.transactionSignals,
    };
    timeline = buildAttributionTimeline({
      ga4Rows: ga4NotSetDaily.rows,
      tossDailyRows,
      ledgerEntries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 diagnosis failed";
    blockers.push(`GA4 not-set 진단은 현재 live 조회를 못 했다: ${message}`);
  }

  let revenueBridge = {
    configured: Boolean(env.REVENUE_API_BASE_URL?.trim()),
    baseUrl: env.REVENUE_API_BASE_URL?.trim() || null,
    reachable: false,
    authReady: Boolean(env.REVENUE_API_BEARER_TOKEN?.trim()),
    error: null as string | null,
  };
  let experiments: RevenueExperiment[] = [];
  let selectedExperimentKey: string | null = null;
  let selectedExperimentResults: RevenueExperimentResults | null = null;
  let selectedAssignments: RevenueAssignments | null = null;

  try {
    const revenueSnapshot = await fetchRevenueExperimentSnapshot(experimentKey);
    experiments = revenueSnapshot.experiments;
    selectedExperimentKey = revenueSnapshot.selectedExperimentKey;
    selectedExperimentResults = revenueSnapshot.selectedExperimentResults;
    selectedAssignments = revenueSnapshot.selectedAssignments;
    revenueBridge.reachable = revenueSnapshot.error === null;
    revenueBridge.error = revenueSnapshot.error;
    if (revenueSnapshot.error) blockers.push(`P1-S2 live 실험 데이터 연결이 아직 안 닫혔다: ${revenueSnapshot.error}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "revenue bridge request failed";
    revenueBridge.error = message;
    blockers.push(`P1-S2 live 실험 데이터 연결 실패: ${message}`);
  }

  if (ledgerSummary.paymentSuccessByCaptureMode.live === 0) {
    blockers.push("P1-S1A는 live ledger row가 아직 0건이라 PG direct 여부를 확정할 수 없다.");
  }

  return {
    range: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    blockers,
    p1s1: {
      revenueBridge,
      experimentCount: experiments.length,
      experiments,
      selectedExperimentKey,
      selectedExperimentResults,
      selectedAssignments,
    },
    p1s1a: {
      ledgerSummary,
      tossJoinSummary: tossJoinReport.summary,
      ga4NotSetTotals,
      ga4Diagnosis,
      timeline,
      nextActions: buildNextActions({
        ledgerEntries,
        tossJoinSummary: tossJoinReport.summary,
        revenueBridgeReady: revenueBridge.reachable,
      }),
    },
  };
};
