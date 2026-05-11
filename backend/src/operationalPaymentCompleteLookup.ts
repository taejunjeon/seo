/**
 * order_bridge_ledger 의 order_no_hash 를 운영DB(tb_iamweb_users) PAYMENT_COMPLETE 와
 * read-only 로 매칭한다.
 *
 * 절대 금지:
 *   - hash 역산 시도
 *   - ledger hash 에서 raw order_no 복원 시도
 *   - output / log / response 에 raw order_no, email, phone, payment, member_code 출력
 *
 * 동작:
 *   1. 운영DB read-only 로 최근 N 일 PAYMENT_COMPLETE 후보 fetch (raw order_number/channel_order_no 포함)
 *   2. 함수 내부에서 transient HMAC 처리
 *   3. ledger order_no_hash 와 같은 HMAC 값을 가진 row 만 매칭으로 인정
 *   4. raw 값은 함수 종료와 함께 폐기 — 응답에는 hash prefix / status / payment_method_family / amount bucket 만
 *
 * 사용처:
 *   ConfirmedPurchasePrep cross_reference_evidence.ledger_lookup wire
 */

import { createHmac } from "node:crypto";

import { isDatabaseConfigured, queryPg } from "./postgres";

export type PaymentMethodFamily =
  | "homepage"
  | "npay"
  | "vbank"
  | "subscription"
  | "card"
  | "free"
  | "other";

export type PaymentCompleteMatchKeyType =
  | "order_number_hash"
  | "channel_order_no_hash"
  | "none";

export type OperationalPaymentCompleteLookupInput = {
  site: "biocom";
  /** ledger 에서 가져온 order_no_hash 목록 (64 char hex) */
  ledgerOrderHashes: ReadonlyArray<string>;
  windowDays?: number;
  hmacSecret: string;
};

export type OperationalPaymentCompleteRunner = (
  text: string,
  values?: ReadonlyArray<unknown>,
) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type OperationalPaymentCompleteLookupDeps = {
  isDatabaseConfigured?: () => boolean;
  queryPg?: OperationalPaymentCompleteRunner;
};

export type AmountKrwBucket =
  | "under_10000"
  | "10000_to_50000"
  | "50000_to_100000"
  | "100000_to_300000"
  | "300000_to_1000000"
  | "over_1000000"
  | "unknown";

export type OperationalPaymentCompleteLookupRow = {
  ledger_order_no_hash: string;
  payment_complete_match: boolean;
  match_key_type: PaymentCompleteMatchKeyType;
  payment_status: string | null;
  payment_method_family: PaymentMethodFamily;
  amount_krw_bucket: AmountKrwBucket;
  sync_lag_note: "fresh" | "lagged" | "stale" | "unknown";
};

export type OperationalPaymentCompleteLookupResult = {
  ok: boolean;
  window_days: number;
  candidates_scanned: number;
  matches: number;
  pending_sync_lag: number;
  unpaid_hold: number;
  rows: OperationalPaymentCompleteLookupRow[];
  warnings: string[];
};

const hmacHex = (value: string, secret: string): string =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

const classifyPaymentMethod = (raw: string | null | undefined): PaymentMethodFamily => {
  if (!raw) return "other";
  const upper = raw.toString().toUpperCase();
  if (upper.includes("NAVERPAY") || upper.includes("NPAY") || upper.includes("네이버")) return "npay";
  if (upper === "CARD" || upper === "CREDIT_CARD") return "card";
  if (upper === "VIRTUAL" || upper.includes("VBANK")) return "vbank";
  if (upper === "SUBSCRIPTION") return "subscription";
  if (upper === "FREE") return "free";
  if (upper === "HOMEPAGE") return "homepage";
  return "other";
};

const classifyAmountBucket = (amount: number | null | undefined): AmountKrwBucket => {
  if (amount == null || !Number.isFinite(amount)) return "unknown";
  if (amount < 10000) return "under_10000";
  if (amount < 50000) return "10000_to_50000";
  if (amount < 100000) return "50000_to_100000";
  if (amount < 300000) return "100000_to_300000";
  if (amount < 1000000) return "300000_to_1000000";
  return "over_1000000";
};

const syncLagFromMinutes = (lagMinutes: number | null): "fresh" | "lagged" | "stale" | "unknown" => {
  if (lagMinutes == null) return "unknown";
  if (lagMinutes <= 60) return "fresh";
  if (lagMinutes <= 360) return "lagged";
  return "stale";
};

type PgCandidateRow = {
  order_number: string | null;
  channel_order_no: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_complete_time: string | null;
  order_date: string | null;
  final_order_amount: string | number | null;
};

export const lookupOperationalPaymentComplete = async (
  input: OperationalPaymentCompleteLookupInput,
  deps: OperationalPaymentCompleteLookupDeps = {},
): Promise<OperationalPaymentCompleteLookupResult> => {
  const isConfigured = deps.isDatabaseConfigured ?? isDatabaseConfigured;
  const runner: OperationalPaymentCompleteRunner =
    deps.queryPg ??
    (async (text, values) => {
      const result = await queryPg<Record<string, unknown>>(text, values ?? []);
      return { rows: result.rows };
    });
  const windowDays = input.windowDays ?? 30;
  if (!isConfigured()) {
    return {
      ok: false,
      window_days: windowDays,
      candidates_scanned: 0,
      matches: 0,
      pending_sync_lag: 0,
      unpaid_hold: 0,
      rows: [],
      warnings: ["DATABASE_URL 미설정 — operationalPaymentCompleteLookup skip"],
    };
  }
  if (!input.hmacSecret) {
    return {
      ok: false,
      window_days: windowDays,
      candidates_scanned: 0,
      matches: 0,
      pending_sync_lag: 0,
      unpaid_hold: 0,
      rows: [],
      warnings: ["hmacSecret 미설정 — operationalPaymentCompleteLookup skip"],
    };
  }

  const uniqueLedgerHashes = Array.from(new Set(input.ledgerOrderHashes.filter((h) => Boolean(h))));
  if (uniqueLedgerHashes.length === 0) {
    return {
      ok: true,
      window_days: windowDays,
      candidates_scanned: 0,
      matches: 0,
      pending_sync_lag: 0,
      unpaid_hold: 0,
      rows: [],
      warnings: ["ledgerOrderHashes empty"],
    };
  }

  let candidateRows: PgCandidateRow[] = [];
  let lagMinutes: number | null = null;
  try {
    const result = await runner(
      `WITH base AS (
        SELECT
          order_number,
          order_section_item_no AS channel_order_no,
          payment_status,
          payment_method,
          payment_complete_time,
          order_date,
          final_order_amount,
          NOW() AS now_utc,
          (SELECT MAX(NULLIF(TRIM(order_date::text),'')::timestamp) FROM public.tb_iamweb_users WHERE NULLIF(TRIM(order_date::text),'') IS NOT NULL) AS max_order_utc
        FROM public.tb_iamweb_users
        WHERE NULLIF(TRIM(order_date::text),'')::timestamp >= NOW() - ($1::int || ' days')::interval
          AND (cancellation_reason IS NULL OR trim(cancellation_reason::text) IN ('', 'nan'))
          AND (return_reason IS NULL OR trim(return_reason::text) IN ('', 'nan'))
      )
      SELECT order_number, channel_order_no, payment_status, payment_method, payment_complete_time, order_date, final_order_amount, now_utc::text AS now_utc, max_order_utc::text AS max_order_utc
      FROM base`,
      [windowDays],
    );
    candidateRows = result.rows.map((row) => ({
      order_number: (row.order_number as string | null) ?? null,
      channel_order_no: (row.channel_order_no as string | null) ?? null,
      payment_status: (row.payment_status as string | null) ?? null,
      payment_method: (row.payment_method as string | null) ?? null,
      payment_complete_time: (row.payment_complete_time as string | null) ?? null,
      order_date: (row.order_date as string | null) ?? null,
      final_order_amount: (row.final_order_amount as string | number | null) ?? null,
    }));
    const first = result.rows[0] as Record<string, unknown> | undefined;
    if (first && typeof first.now_utc === "string" && typeof first.max_order_utc === "string") {
      const nowMs = Date.parse(first.now_utc);
      const maxMs = Date.parse(first.max_order_utc);
      if (Number.isFinite(nowMs) && Number.isFinite(maxMs)) {
        lagMinutes = Math.max(0, Math.round((nowMs - maxMs) / 60000));
      }
    }
  } catch (error) {
    return {
      ok: false,
      window_days: windowDays,
      candidates_scanned: 0,
      matches: 0,
      pending_sync_lag: 0,
      unpaid_hold: 0,
      rows: [],
      warnings: [error instanceof Error ? `query_error: ${error.message}` : "query_error"],
    };
  }

  const hashIndex = new Map<string, PgCandidateRow>();
  for (const row of candidateRows) {
    const orderNumber = (row.order_number ?? "").toString().trim();
    const channelOrderNo = (row.channel_order_no ?? "").toString().trim();
    if (orderNumber) {
      hashIndex.set(hmacHex(orderNumber, input.hmacSecret), row);
    }
    if (channelOrderNo && !hashIndex.has(hmacHex(channelOrderNo, input.hmacSecret))) {
      hashIndex.set(hmacHex(channelOrderNo, input.hmacSecret), row);
    }
  }

  const syncLagNote = syncLagFromMinutes(lagMinutes);
  const rows: OperationalPaymentCompleteLookupRow[] = [];
  let matches = 0;
  let pendingSyncLag = 0;
  let unpaidHold = 0;

  for (const ledgerHash of uniqueLedgerHashes) {
    const candidate = hashIndex.get(ledgerHash);
    if (!candidate) {
      pendingSyncLag += 1;
      rows.push({
        ledger_order_no_hash: ledgerHash,
        payment_complete_match: false,
        match_key_type: "none",
        payment_status: null,
        payment_method_family: "other",
        amount_krw_bucket: "unknown",
        sync_lag_note: syncLagNote,
      });
      continue;
    }
    const orderNumber = (candidate.order_number ?? "").toString().trim();
    const channelOrderNo = (candidate.channel_order_no ?? "").toString().trim();
    const matchKeyType: PaymentCompleteMatchKeyType =
      orderNumber && hmacHex(orderNumber, input.hmacSecret) === ledgerHash
        ? "order_number_hash"
        : channelOrderNo && hmacHex(channelOrderNo, input.hmacSecret) === ledgerHash
          ? "channel_order_no_hash"
          : "none";
    const paymentStatus = (candidate.payment_status ?? "").toString();
    const isPaid = paymentStatus.toUpperCase() === "PAYMENT_COMPLETE";
    if (isPaid) {
      matches += 1;
    } else {
      unpaidHold += 1;
    }
    rows.push({
      ledger_order_no_hash: ledgerHash,
      payment_complete_match: isPaid,
      match_key_type: matchKeyType,
      payment_status: paymentStatus || null,
      payment_method_family: classifyPaymentMethod(candidate.payment_method),
      amount_krw_bucket: classifyAmountBucket(
        candidate.final_order_amount == null ? null : Number(candidate.final_order_amount),
      ),
      sync_lag_note: syncLagNote,
    });
  }

  return {
    ok: true,
    window_days: windowDays,
    candidates_scanned: candidateRows.length,
    matches,
    pending_sync_lag: pendingSyncLag,
    unpaid_hold: unpaidHold,
    rows,
    warnings: [],
  };
};
