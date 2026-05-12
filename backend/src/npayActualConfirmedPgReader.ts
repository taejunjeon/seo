/**
 * NPay actual confirmed snapshot reader (site별 read-only source router).
 *
 * 목적:
 *   - biocom: 운영DB `dashboard.public.tb_iamweb_users` 에서 NAVERPAY_ORDER + PAYMENT_COMPLETE 분포를 read-only로 가져온다.
 *   - thecleancoffee: VM Cloud/로컬 SQLite `imweb_orders` 의 Imweb v2 NPay 주문을 read-only로 가져온다.
 *   - cancellation_reason / return_reason 또는 imweb_status exclusion 필터로 confirmed actual 후보 매출만 라벨링한다.
 *   - ConfirmedPurchasePrep `npay_actual_count` 0 누락을 메우는 보조 입력 source.
 *
 * 금지:
 *   - 운영DB write
 *   - raw email/phone/order/payment/member_code 출력
 *   - NPay click/count/add_payment_info 를 actual purchase로 승격
 *   - send_candidate / actual_send_candidate / upload_candidate true
 */

import { getCrmDb } from "./crmLocalDb";
import { isDatabaseConfigured, queryPg } from "./postgres";

export type NpayActualConfirmedSnapshotInput = {
  windowDays: number;
};

export type NpayActualConfirmedSnapshot = {
  ok: boolean;
  windowDays: number;
  generatedAtIso: string;
  rows: number;
  totalAmountKrw: number;
  avgAmountKrw: number;
  medianAmountKrw: number;
  p90AmountKrw: number;
  minAmountKrw: number;
  maxAmountKrw: number;
  filter: {
    paymentMethod: "NAVERPAY_ORDER";
    paymentStatus: "PAYMENT_COMPLETE";
    cancelReasonExcluded: true;
    returnReasonExcluded: true;
    amountPositive: true;
  };
  promotionRule: {
    actualPurchaseDefinition:
      "PAYMENT_COMPLETE + cancellation_reason/return_reason empty + final_order_amount > 0";
    npayClickToPurchase: false;
    sendCandidate: false;
    actualSendCandidate: false;
    uploadCandidate: false;
  };
  warnings: string[];
};

export const NPAY_ACTUAL_CONFIRMED_DEFAULT_WINDOW_DAYS = 30;

const baseSql = `
WITH base AS (
  SELECT final_order_amount::numeric AS amt
  FROM public.tb_iamweb_users
  WHERE order_date::timestamp >= NOW() - ($1::int || ' days')::interval
    AND payment_method = 'NAVERPAY_ORDER'
    AND payment_status = 'PAYMENT_COMPLETE'
    AND (cancellation_reason IS NULL OR trim(cancellation_reason::text) IN ('', 'nan'))
    AND (return_reason IS NULL OR trim(return_reason::text) IN ('', 'nan'))
    AND final_order_amount IS NOT NULL
    AND final_order_amount > 0
)
SELECT
  COUNT(*)::int AS rows,
  COALESCE(SUM(amt), 0)::bigint AS total_amt,
  COALESCE(ROUND(AVG(amt))::bigint, 0) AS avg_amt,
  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY amt), 0)::bigint AS median_amt,
  COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY amt), 0)::bigint AS p90_amt,
  COALESCE(MIN(amt), 0)::bigint AS min_amt,
  COALESCE(MAX(amt), 0)::bigint AS max_amt
FROM base
`;

type AggRow = {
  rows: number;
  total_amt: string | number;
  avg_amt: string | number;
  median_amt: string | number;
  p90_amt: string | number;
  min_amt: string | number;
  max_amt: string | number;
};

const numFromBig = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatKrwKorean = (amount: number): string => {
  if (amount === 0) return "₩0";
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const rest = amount % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (rest > 0 && eok === 0) parts.push(`${rest.toLocaleString("ko-KR")}`);
  return `₩${parts.join(" ")}`.trim() || `₩${amount.toLocaleString("ko-KR")}`;
};

export type NpayActualConfirmedSiteLandingStatus =
  | "included"
  | "included_with_warning"
  | "bridge_pending"
  | "unavailable";

export type NpayActualConfirmedSiteLandingSource =
  | "operational_db.tb_iamweb_users PAYMENT_COMPLETE"
  | "imweb_v2_vm_cloud_imweb_orders"
  | "unavailable";

export type NpayActualConfirmedSiteLandingSummary = {
  ok: boolean;
  site: "biocom" | "thecleancoffee";
  windowDays: number;
  source: NpayActualConfirmedSiteLandingSource;
  status: NpayActualConfirmedSiteLandingStatus;
  completeCount: number;
  completeAmountKrw: number;
  completeAmountKrwKorean: string;
  maxPaymentCompleteTime: string | null;
  maxOrderDate: string | null;
  reason: string;
  warnings: string[];
  grossCount?: number;
  grossAmountKrw?: number;
  grossAmountKrwKorean?: string;
  excludedCancelReturnExchangeCount?: number;
  excludedCancelReturnExchangeAmountKrw?: number;
  excludedCancelReturnExchangeAmountKrwKorean?: string;
  confirmedStatusCount?: number;
  confirmedStatusAmountKrw?: number;
  confirmedStatusAmountKrwKorean?: string;
  statusBlankCount?: number;
  statusBlankAmountKrw?: number;
  statusBlankAmountKrwKorean?: string;
  maxOrderTime?: string | null;
  maxSyncedAt?: string | null;
  maxStatusSyncedAt?: string | null;
  ga4GuardRole?: "already_in_ga4_guard_only_not_actual_source";
};

type SiteLandingAggRow = {
  orders: number;
  total_amt: string | number;
  max_payment_complete_time: string | null;
  max_order_date: string | null;
};

type SqliteAggRow = {
  cnt: number;
  amount_krw: number | null;
  max_order_time: string | null;
};

type SqliteFreshnessRow = {
  max_synced_at: string | null;
  max_status_synced_at: string | null;
};

const siteLandingSummarySql = `
WITH grouped AS (
  SELECT
    order_number,
    MAX(final_order_amount::numeric) AS amt,
    MAX(NULLIF(trim(payment_complete_time::text), '')) AS max_payment_complete_time,
    MAX(NULLIF(trim(order_date::text), '')) AS max_order_date
  FROM public.tb_iamweb_users
  WHERE order_date::timestamp >= NOW() - ($1::int || ' days')::interval
    AND payment_method = 'NAVERPAY_ORDER'
    AND payment_status = 'PAYMENT_COMPLETE'
    AND (cancellation_reason IS NULL OR trim(cancellation_reason::text) IN ('', 'nan'))
    AND (return_reason IS NULL OR trim(return_reason::text) IN ('', 'nan'))
    AND final_order_amount IS NOT NULL
    AND final_order_amount > 0
  GROUP BY order_number
)
SELECT
  COUNT(*)::int AS orders,
  COALESCE(SUM(amt), 0)::bigint AS total_amt,
  MAX(max_payment_complete_time) AS max_payment_complete_time,
  MAX(max_order_date) AS max_order_date
FROM grouped
`;

const readCoffeeAgg = (whereSql: string, params: unknown[]): SqliteAggRow => {
  const db = getCrmDb();
  return db
    .prepare(
      `
        SELECT
          COUNT(*) AS cnt,
          COALESCE(SUM(payment_amount), 0) AS amount_krw,
          MAX(order_time) AS max_order_time
        FROM imweb_orders
        WHERE ${whereSql}
      `,
    )
    .get(...params) as SqliteAggRow;
};

const parseSqliteTimestampMs = (value: string | null): number | null => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

const fetchCoffeeNpayActualConfirmedSiteLandingSummary = (
  windowDays: number,
): NpayActualConfirmedSiteLandingSummary => {
  try {
    const db = getCrmDb();
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'imweb_orders'",
      )
      .get();

    if (!tableExists) {
      return {
        ok: false,
        site: "thecleancoffee",
        windowDays,
        source: "unavailable",
        status: "unavailable",
        completeCount: 0,
        completeAmountKrw: 0,
        completeAmountKrwKorean: "₩0",
        maxPaymentCompleteTime: null,
        maxOrderDate: null,
        reason: "VM Cloud imweb_orders table is not available for thecleancoffee actual source.",
        warnings: ["imweb_orders_missing"],
      };
    }

    const thresholdIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const baseWhere =
      "site = ? AND pay_type = 'npay' AND order_time >= ? AND payment_amount > 0";
    const baseParams = ["thecleancoffee", thresholdIso];
    const normalizedStatus = "COALESCE(NULLIF(TRIM(imweb_status), ''), '')";

    const gross = readCoffeeAgg(baseWhere, baseParams);
    const included = readCoffeeAgg(
      `${baseWhere} AND ${normalizedStatus} NOT IN ('CANCEL', 'RETURN', 'EXCHANGE')`,
      baseParams,
    );
    const excluded = readCoffeeAgg(
      `${baseWhere} AND ${normalizedStatus} IN ('CANCEL', 'RETURN', 'EXCHANGE')`,
      baseParams,
    );
    const confirmedStatus = readCoffeeAgg(
      `${baseWhere} AND ${normalizedStatus} != '' AND ${normalizedStatus} NOT IN ('CANCEL', 'RETURN', 'EXCHANGE')`,
      baseParams,
    );
    const statusBlank = readCoffeeAgg(
      `${baseWhere} AND ${normalizedStatus} = ''`,
      baseParams,
    );
    const freshness = db
      .prepare(
        `
          SELECT
            MAX(synced_at) AS max_synced_at,
            MAX(imweb_status_synced_at) AS max_status_synced_at
          FROM imweb_orders
          WHERE site = ?
        `,
      )
      .get("thecleancoffee") as SqliteFreshnessRow;

    const warnings = ["ga4_guard_not_actual_source"];
    if (statusBlank.cnt > 0) {
      warnings.push("status_blank_rows_included_with_warning");
    }
    if (!freshness.max_status_synced_at) {
      warnings.push("status_sync_freshness_unknown");
    } else {
      const statusSyncedAtMs = parseSqliteTimestampMs(freshness.max_status_synced_at);
      const statusSyncAgeHours =
        statusSyncedAtMs === null ? null : (Date.now() - statusSyncedAtMs) / (60 * 60 * 1000);
      if (statusSyncAgeHours === null || statusSyncAgeHours > 6) {
        warnings.push("status_sync_stale_over_6h");
      }
    }
    if (gross.cnt === 0) {
      warnings.push("coffee_npay_no_rows_in_window");
    }

    const status: NpayActualConfirmedSiteLandingStatus =
      statusBlank.cnt > 0 ? "included_with_warning" : "included";
    const includedAmount = Number(included.amount_krw || 0);
    const grossAmount = Number(gross.amount_krw || 0);
    const excludedAmount = Number(excluded.amount_krw || 0);
    const confirmedAmount = Number(confirmedStatus.amount_krw || 0);
    const statusBlankAmount = Number(statusBlank.amount_krw || 0);

    return {
      ok: true,
      site: "thecleancoffee",
      windowDays,
      source: "imweb_v2_vm_cloud_imweb_orders",
      status,
      completeCount: Number(included.cnt || 0),
      completeAmountKrw: includedAmount,
      completeAmountKrwKorean: formatKrwKorean(includedAmount),
      maxPaymentCompleteTime: null,
      maxOrderDate: included.max_order_time,
      reason:
        "thecleancoffee actual source uses VM Cloud imweb_orders captured from Imweb v2. NPay positive-amount orders are included after excluding CANCEL/RETURN/EXCHANGE; GA4 is only an already_in_ga4 guard, not an actual revenue source.",
      warnings,
      grossCount: Number(gross.cnt || 0),
      grossAmountKrw: grossAmount,
      grossAmountKrwKorean: formatKrwKorean(grossAmount),
      excludedCancelReturnExchangeCount: Number(excluded.cnt || 0),
      excludedCancelReturnExchangeAmountKrw: excludedAmount,
      excludedCancelReturnExchangeAmountKrwKorean: formatKrwKorean(excludedAmount),
      confirmedStatusCount: Number(confirmedStatus.cnt || 0),
      confirmedStatusAmountKrw: confirmedAmount,
      confirmedStatusAmountKrwKorean: formatKrwKorean(confirmedAmount),
      statusBlankCount: Number(statusBlank.cnt || 0),
      statusBlankAmountKrw: statusBlankAmount,
      statusBlankAmountKrwKorean: formatKrwKorean(statusBlankAmount),
      maxOrderTime: included.max_order_time,
      maxSyncedAt: freshness.max_synced_at,
      maxStatusSyncedAt: freshness.max_status_synced_at,
      ga4GuardRole: "already_in_ga4_guard_only_not_actual_source",
    };
  } catch (error) {
    return {
      ok: false,
      site: "thecleancoffee",
      windowDays,
      source: "unavailable",
      status: "unavailable",
      completeCount: 0,
      completeAmountKrw: 0,
      completeAmountKrwKorean: "₩0",
      maxPaymentCompleteTime: null,
      maxOrderDate: null,
      reason: error instanceof Error ? error.message : String(error),
      warnings: ["imweb_orders_read_failed"],
    };
  }
};

export const fetchNpayActualConfirmedSiteLandingSummary = async (
  input: {
    site: "biocom" | "thecleancoffee";
    windowDays?: number;
  },
): Promise<NpayActualConfirmedSiteLandingSummary> => {
  const windowDays = input.windowDays ?? NPAY_ACTUAL_CONFIRMED_DEFAULT_WINDOW_DAYS;
  if (input.site !== "biocom") {
    return fetchCoffeeNpayActualConfirmedSiteLandingSummary(windowDays);
  }
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      site: input.site,
      windowDays,
      source: "unavailable",
      status: "unavailable",
      completeCount: 0,
      completeAmountKrw: 0,
      completeAmountKrwKorean: "₩0",
      maxPaymentCompleteTime: null,
      maxOrderDate: null,
      reason: "DATABASE_URL 미설정 — 운영DB PAYMENT_COMPLETE actual confirmed를 조회하지 않았다.",
      warnings: ["DATABASE_URL_missing"],
    };
  }

  const result = await queryPg<SiteLandingAggRow>(siteLandingSummarySql, [windowDays]);
  const row = result.rows[0];
  const amount = numFromBig(row?.total_amt);
  return {
    ok: true,
    site: input.site,
    windowDays,
    source: "operational_db.tb_iamweb_users PAYMENT_COMPLETE",
    status: "included",
    completeCount: numFromBig(row?.orders),
    completeAmountKrw: amount,
    completeAmountKrwKorean: formatKrwKorean(amount),
    maxPaymentCompleteTime: row?.max_payment_complete_time ?? null,
    maxOrderDate: row?.max_order_date ?? null,
    reason:
      "운영DB tb_iamweb_users의 NAVERPAY_ORDER + PAYMENT_COMPLETE + 취소/반품 제외 + 금액 양수 조건을 실제 결제완료 기준으로 사용한다.",
    warnings: [],
  };
};

export const fetchNpayActualConfirmedSnapshot = async (
  input: NpayActualConfirmedSnapshotInput = { windowDays: NPAY_ACTUAL_CONFIRMED_DEFAULT_WINDOW_DAYS },
): Promise<NpayActualConfirmedSnapshot> => {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      windowDays: input.windowDays,
      generatedAtIso: new Date().toISOString(),
      rows: 0,
      totalAmountKrw: 0,
      avgAmountKrw: 0,
      medianAmountKrw: 0,
      p90AmountKrw: 0,
      minAmountKrw: 0,
      maxAmountKrw: 0,
      filter: {
        paymentMethod: "NAVERPAY_ORDER",
        paymentStatus: "PAYMENT_COMPLETE",
        cancelReasonExcluded: true,
        returnReasonExcluded: true,
        amountPositive: true,
      },
      promotionRule: {
        actualPurchaseDefinition:
          "PAYMENT_COMPLETE + cancellation_reason/return_reason empty + final_order_amount > 0",
        npayClickToPurchase: false,
        sendCandidate: false,
        actualSendCandidate: false,
        uploadCandidate: false,
      },
      warnings: ["DATABASE_URL 미설정 — snapshot 0 반환"],
    };
  }

  const result = await queryPg<AggRow>(baseSql, [input.windowDays]);
  const row = result.rows[0];
  if (!row) {
    return summarizeEmpty(input.windowDays, ["empty_result_row"]);
  }
  return {
    ok: true,
    windowDays: input.windowDays,
    generatedAtIso: new Date().toISOString(),
    rows: numFromBig(row.rows),
    totalAmountKrw: numFromBig(row.total_amt),
    avgAmountKrw: numFromBig(row.avg_amt),
    medianAmountKrw: numFromBig(row.median_amt),
    p90AmountKrw: numFromBig(row.p90_amt),
    minAmountKrw: numFromBig(row.min_amt),
    maxAmountKrw: numFromBig(row.max_amt),
    filter: {
      paymentMethod: "NAVERPAY_ORDER",
      paymentStatus: "PAYMENT_COMPLETE",
      cancelReasonExcluded: true,
      returnReasonExcluded: true,
      amountPositive: true,
    },
    promotionRule: {
      actualPurchaseDefinition:
        "PAYMENT_COMPLETE + cancellation_reason/return_reason empty + final_order_amount > 0",
      npayClickToPurchase: false,
      sendCandidate: false,
      actualSendCandidate: false,
      uploadCandidate: false,
    },
    warnings: [],
  };
};

const summarizeEmpty = (windowDays: number, warnings: string[]): NpayActualConfirmedSnapshot => ({
  ok: true,
  windowDays,
  generatedAtIso: new Date().toISOString(),
  rows: 0,
  totalAmountKrw: 0,
  avgAmountKrw: 0,
  medianAmountKrw: 0,
  p90AmountKrw: 0,
  minAmountKrw: 0,
  maxAmountKrw: 0,
  filter: {
    paymentMethod: "NAVERPAY_ORDER",
    paymentStatus: "PAYMENT_COMPLETE",
    cancelReasonExcluded: true,
    returnReasonExcluded: true,
    amountPositive: true,
  },
  promotionRule: {
    actualPurchaseDefinition:
      "PAYMENT_COMPLETE + cancellation_reason/return_reason empty + final_order_amount > 0",
    npayClickToPurchase: false,
    sendCandidate: false,
    actualSendCandidate: false,
    uploadCandidate: false,
  },
  warnings,
});

export type NpayActualRoasContribution = {
  before: {
    confirmedOrders: number;
    confirmedRevenueKrw: number;
    platformCostKrw: number;
    internalConfirmedRoas: number;
  };
  after: {
    confirmedOrders: number;
    confirmedRevenueKrw: number;
    internalConfirmedRoas: number;
  };
  delta: {
    addedOrders: number;
    addedRevenueKrw: number;
    roasLift: number;
  };
  caveat: string;
};

/**
 * Internal confirmed ROAS lift estimate after merging NPay actual snapshot.
 * Send/Upload 의미가 아니다. 분자 합산만 계산한다.
 */
export const estimateInternalRoasLift = (
  snapshot: NpayActualConfirmedSnapshot,
  baseline: {
    confirmedOrders: number;
    confirmedRevenueKrw: number;
    platformCostKrw: number;
  },
): NpayActualRoasContribution => {
  const before = {
    ...baseline,
    internalConfirmedRoas:
      baseline.platformCostKrw > 0
        ? round4(baseline.confirmedRevenueKrw / baseline.platformCostKrw)
        : 0,
  };
  const afterOrders = baseline.confirmedOrders + snapshot.rows;
  const afterRevenue = baseline.confirmedRevenueKrw + snapshot.totalAmountKrw;
  const afterRoas =
    baseline.platformCostKrw > 0 ? round4(afterRevenue / baseline.platformCostKrw) : 0;
  return {
    before,
    after: {
      confirmedOrders: afterOrders,
      confirmedRevenueKrw: afterRevenue,
      internalConfirmedRoas: afterRoas,
    },
    delta: {
      addedOrders: snapshot.rows,
      addedRevenueKrw: snapshot.totalAmountKrw,
      roasLift: round4(afterRoas - before.internalConfirmedRoas),
    },
    caveat:
      "기존 confirmedOrders 안에 NPay 중복이 0이라고 가정한 추정. 실제 wire 후 dedupe 결과 약간 작아질 수 있음. send_candidate/upload_candidate 의미는 아님.",
  };
};

const round4 = (value: number) => Math.round(value * 10000) / 10000;
