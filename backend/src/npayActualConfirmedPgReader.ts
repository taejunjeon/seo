/**
 * NPay actual confirmed snapshot reader (운영 PG read-only).
 *
 * 목적:
 *   - 운영 PG `dashboard.public.tb_iamweb_users` 에서 NAVERPAY_ORDER + PAYMENT_COMPLETE 분포를 read-only로 가져온다.
 *   - cancellation_reason / return_reason 빈값 + final_order_amount > 0 이중 필터로 confirmed actual 매출만 라벨링한다.
 *   - ConfirmedPurchasePrep `npay_actual_count` 0 누락을 메우는 보조 입력 source.
 *
 * 금지:
 *   - 운영DB write
 *   - raw email/phone/order/payment/member_code 출력
 *   - NPay click/count/add_payment_info 를 actual purchase로 승격
 *   - send_candidate / actual_send_candidate / upload_candidate true
 */

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
