/**
 * C-Sprint 4 (confirmed_stopline v1): Toss DONE → CANCELED / PARTIAL_CANCELED 전이를 감지해
 * Meta CAPI Refund 와 GA4 Measurement Protocol Refund 를 뒤따라 전송한다.
 *
 * 모드:
 *  - dry_run : diff 만 `refund_dispatch_log` 에 기록. 외부 호출 없음. 관측용.
 *  - enforce : log 기록 + Meta CAPI + GA4 MP 실제 전송. `REFUND_DISPATCH_ENFORCE=true` 와
 *              해당 site 의 `GA4_MP_API_SECRET_*` 가 모두 설정됐을 때만 실제 호출.
 *              자격증명이 없으면 이벤트별로 `meta_error` / `ga4_error` 에 skip 사유를 기록한다.
 *
 * 중복 전송 방지: `refund_dispatch_log` 의 UNIQUE(order_id, toss_status) 로 같은 전이는 한 번만 기록.
 * 이후 같은 (order_id, status) 가 들어오면 INSERT OR IGNORE 로 건너뛴다.
 */

import crypto from "node:crypto";

import { env } from "../env";
import { getCrmDb } from "../crmLocalDb";

const sha256Lower = (value: string): string =>
  crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";

export type RefundDispatchMode = "dry_run" | "enforce";

export type RefundCandidate = {
  order_id: string;
  payment_key: string;
  toss_status: "CANCELED" | "PARTIAL_CANCELED";
  method: string | null;
  total_amount: number;
  cancel_amount: number;
  currency: string;
  transaction_at: string | null;
  site: string | null;
  order_code: string | null;
};

export type RefundDispatchRecord = {
  id: number;
  order_id: string;
  payment_key: string;
  toss_status: string;
  total_amount: number;
  cancel_amount: number;
  currency: string;
  method: string | null;
  site: string | null;
  transaction_at: string | null;
  detected_at: string;
  mode: string;
  meta_dispatched: number;
  meta_dispatched_at: string | null;
  meta_error: string | null;
  ga4_dispatched: number;
  ga4_dispatched_at: string | null;
  ga4_error: string | null;
  purchase_refund_dispatched: number;
  purchase_refund_dispatched_at: string | null;
  purchase_refund_error: string | null;
};

export type RefundDispatchSummary = {
  mode: RefundDispatchMode;
  enforceRequested: boolean;
  processed: number;
  newlyDetected: number;
  metaSent: number;
  metaSkipped: number;
  ga4Sent: number;
  ga4Skipped: number;
  purchaseRefundSent: number;
  purchaseRefundSkipped: number;
  skipReasons: Record<string, number>;
};

/**
 * Toss 에 기록된 CANCELED / PARTIAL_CANCELED 중 아직 refund_dispatch_log 에 없는 건을 반환한다.
 * 과거 취소 건까지 포함되므로 첫 dry_run 시 한꺼번에 잡힌다 — 그 이후로는 신규 전이만 잡힌다.
 */
export function detectPendingRefundCandidates(limit = 500): RefundCandidate[] {
  const db = getCrmDb();
  const rows = db
    .prepare(
      `SELECT
         t.order_id        AS order_id,
         t.payment_key     AS payment_key,
         t.status          AS toss_status,
         t.method          AS method,
         t.amount          AS cancel_amount,
         t.currency        AS currency,
         t.transaction_at  AS transaction_at,
         i.site            AS site,
         i.order_code      AS order_code,
         i.payment_amount  AS total_amount
       FROM toss_transactions t
       LEFT JOIN imweb_orders i
         ON (t.order_id = i.order_no || '-P1') OR (t.order_id = i.order_no)
       WHERE t.status IN ('CANCELED', 'PARTIAL_CANCELED')
         AND NOT EXISTS (
           SELECT 1 FROM refund_dispatch_log r
           WHERE r.order_id = t.order_id AND r.toss_status = t.status
         )
       ORDER BY t.transaction_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    order_id: String(row.order_id ?? ""),
    payment_key: String(row.payment_key ?? ""),
    toss_status: row.toss_status === "PARTIAL_CANCELED" ? "PARTIAL_CANCELED" : "CANCELED",
    method: row.method ? String(row.method) : null,
    total_amount: Number(row.total_amount ?? 0),
    cancel_amount: Number(row.cancel_amount ?? 0),
    currency: (row.currency as string) || "KRW",
    transaction_at: row.transaction_at ? String(row.transaction_at) : null,
    site: row.site ? String(row.site) : null,
    order_code: row.order_code ? String(row.order_code) : null,
  }));
}

const pickMetaCredentials = (site: string | null): { pixelId: string | null; token: string | null; missing: string | null } => {
  if (site === "thecleancoffee") {
    const pixelId = env.META_PIXEL_ID_COFFEE || null;
    const token = env.COFFEE_META_TOKEN?.trim() || null;
    return { pixelId, token, missing: token ? null : "coffee_meta_token_missing" };
  }
  if (site === "aibio") {
    return { pixelId: env.META_PIXEL_ID_AIBIO || null, token: null, missing: "aibio_meta_token_not_configured" };
  }
  // biocom 및 unknown 은 공통 META_ADMANAGER_API_KEY 가 있는 경우에만.
  const pixelId = env.META_PIXEL_ID_BIOCOM || null;
  const token = env.META_ADMANAGER_API_KEY?.trim() || null;
  return { pixelId, token, missing: token ? null : "biocom_meta_token_missing" };
};

const pickGa4Credentials = (site: string | null): { measurementId: string | null; apiSecret: string | null; missing: string | null } => {
  if (site === "thecleancoffee") {
    return {
      measurementId: env.GA4_MEASUREMENT_ID_COFFEE || null,
      apiSecret: env.GA4_MP_API_SECRET_COFFEE || null,
      missing: env.GA4_MP_API_SECRET_COFFEE ? null : "ga4_mp_secret_coffee_missing",
    };
  }
  if (site === "aibio") {
    return { measurementId: null, apiSecret: null, missing: "ga4_mp_not_configured_for_aibio" };
  }
  return {
    measurementId: env.GA4_MEASUREMENT_ID_BIOCOM || null,
    apiSecret: env.GA4_MP_API_SECRET_BIOCOM || null,
    missing: env.GA4_MP_API_SECRET_BIOCOM ? null : "ga4_mp_secret_biocom_missing",
  };
};

const sendMetaRefund = async (candidate: RefundCandidate): Promise<{ ok: boolean; error: string | null }> => {
  const { pixelId, token, missing } = pickMetaCredentials(candidate.site);
  if (missing || !pixelId || !token) return { ok: false, error: missing ?? "meta_credentials_missing" };
  const refundEventId = `Refund.${candidate.order_code ?? candidate.order_id}`;
  // Meta CAPI는 `event_time` 이 7일 이전이면 reject (subcode 2804003).
  // Refund 는 "지금 정정 보고" 시점 이벤트이므로 현재 시각을 기본으로 쓰고,
  // 원래 Toss 취소 시각은 custom_data.original_canceled_at 으로 보존한다.
  const nowSec = Math.floor(Date.now() / 1000);
  const tossSec = candidate.transaction_at
    ? Math.floor(new Date(candidate.transaction_at).getTime() / 1000)
    : null;
  const withinMetaWindowSec = 6 * 24 * 3600; // 6일 안전 마진
  const useTossTime = tossSec !== null && nowSec - tossSec <= withinMetaWindowSec;
  const eventTime = useTossTime ? tossSec! : nowSec;
  // Meta CAPI 는 user_data 에 최소 1 개 이상의 식별자가 있어야 수락한다 (subcode 2804050 방지).
  // Refund 는 감지 시점에 원 구매자의 PII 가 보장되지 않으므로 order_code 해시를 external_id 로 사용한다.
  const externalId = sha256Lower(candidate.order_code ?? candidate.order_id);
  const payload = {
    data: [
      {
        event_name: "Refund",
        event_time: eventTime,
        event_id: refundEventId,
        action_source: "website",
        user_data: {
          external_id: [externalId],
        },
        custom_data: {
          currency: candidate.currency,
          value: -Math.abs(candidate.cancel_amount),
          order_id: candidate.order_code ?? candidate.order_id,
          toss_status: candidate.toss_status,
          original_canceled_at: candidate.transaction_at,
          reporting_mode: useTossTime ? "toss_time" : "now_fallback",
        },
      },
    ],
  };
  const url = new URL(`${META_GRAPH_URL}/${pixelId}/events`);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `meta_http_${res.status}:${text.slice(0, 200)}` };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "meta_network_error" };
  }
};

/**
 * 옵션 C 의 두 번째 Meta 호출: `event_name="Purchase"` + `value` 음수로 원 Purchase 의 ROAS 를 차감.
 * dedup 리스크 방지를 위해 원 Purchase 와 동일 event_id 를 **재사용하지 않고** 별도 키
 * `Refund-As-Purchase.{order_code}` 를 쓴다. 원 Purchase 참조는 custom_data.original_purchase_event_id 로 보존.
 */
const sendMetaPurchaseRefund = async (candidate: RefundCandidate): Promise<{ ok: boolean; error: string | null }> => {
  const { pixelId, token, missing } = pickMetaCredentials(candidate.site);
  if (missing || !pixelId || !token) return { ok: false, error: missing ?? "meta_credentials_missing" };
  const refundAsPurchaseEventId = `Refund-As-Purchase.${candidate.order_code ?? candidate.order_id}`;
  const originalPurchaseEventId = `Purchase.${candidate.order_code ?? candidate.order_id}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const tossSec = candidate.transaction_at
    ? Math.floor(new Date(candidate.transaction_at).getTime() / 1000)
    : null;
  const withinMetaWindowSec = 6 * 24 * 3600;
  const useTossTime = tossSec !== null && nowSec - tossSec <= withinMetaWindowSec;
  const eventTime = useTossTime ? tossSec! : nowSec;
  const externalId = sha256Lower(candidate.order_code ?? candidate.order_id);
  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: refundAsPurchaseEventId,
        action_source: "website",
        user_data: {
          external_id: [externalId],
        },
        custom_data: {
          currency: candidate.currency,
          value: -Math.abs(candidate.cancel_amount),
          order_id: candidate.order_code ?? candidate.order_id,
          order_status: "refunded",
          toss_status: candidate.toss_status,
          original_purchase_event_id: originalPurchaseEventId,
          original_canceled_at: candidate.transaction_at,
          reporting_mode: useTossTime ? "toss_time" : "now_fallback",
        },
      },
    ],
  };
  const url = new URL(`${META_GRAPH_URL}/${pixelId}/events`);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `meta_purchase_refund_http_${res.status}:${text.slice(0, 200)}` };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "meta_purchase_refund_network_error" };
  }
};

const sendGa4Refund = async (candidate: RefundCandidate): Promise<{ ok: boolean; error: string | null }> => {
  const { measurementId, apiSecret, missing } = pickGa4Credentials(candidate.site);
  if (missing || !measurementId || !apiSecret) return { ok: false, error: missing ?? "ga4_credentials_missing" };
  const clientId = `refund-dispatcher-${candidate.order_id}`;
  const payload = {
    client_id: clientId,
    non_personalized_ads: false,
    events: [
      {
        name: "refund",
        params: {
          transaction_id: candidate.order_code ?? candidate.order_id,
          value: Math.abs(candidate.cancel_amount),
          currency: candidate.currency,
          engagement_time_msec: 1,
        },
      },
    ],
  };
  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `ga4_http_${res.status}:${text.slice(0, 200)}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "ga4_network_error" };
  }
};

const insertDispatchRow = (
  candidate: RefundCandidate,
  mode: RefundDispatchMode,
  metaResult: { ok: boolean; error: string | null } | null,
  ga4Result: { ok: boolean; error: string | null } | null,
  purchaseRefundResult: { ok: boolean; error: string | null } | null,
): void => {
  const db = getCrmDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO refund_dispatch_log (
       order_id, payment_key, toss_status, total_amount, cancel_amount, currency,
       method, site, transaction_at, detected_at, mode,
       meta_dispatched, meta_dispatched_at, meta_error,
       ga4_dispatched, ga4_dispatched_at, ga4_error,
       purchase_refund_dispatched, purchase_refund_dispatched_at, purchase_refund_error
     ) VALUES (
       @order_id, @payment_key, @toss_status, @total_amount, @cancel_amount, @currency,
       @method, @site, @transaction_at, @detected_at, @mode,
       @meta_dispatched, @meta_dispatched_at, @meta_error,
       @ga4_dispatched, @ga4_dispatched_at, @ga4_error,
       @purchase_refund_dispatched, @purchase_refund_dispatched_at, @purchase_refund_error
     )`,
  ).run({
    order_id: candidate.order_id,
    payment_key: candidate.payment_key,
    toss_status: candidate.toss_status,
    total_amount: candidate.total_amount,
    cancel_amount: candidate.cancel_amount,
    currency: candidate.currency,
    method: candidate.method,
    site: candidate.site,
    transaction_at: candidate.transaction_at,
    detected_at: now,
    mode,
    meta_dispatched: metaResult?.ok ? 1 : 0,
    meta_dispatched_at: metaResult?.ok ? now : null,
    meta_error: metaResult?.error ?? null,
    ga4_dispatched: ga4Result?.ok ? 1 : 0,
    ga4_dispatched_at: ga4Result?.ok ? now : null,
    ga4_error: ga4Result?.error ?? null,
    purchase_refund_dispatched: purchaseRefundResult?.ok ? 1 : 0,
    purchase_refund_dispatched_at: purchaseRefundResult?.ok ? now : null,
    purchase_refund_error: purchaseRefundResult?.error ?? null,
  });
};

export async function dispatchRefunds(
  options: { mode: RefundDispatchMode; limit?: number } = { mode: "dry_run" },
): Promise<RefundDispatchSummary> {
  const enforceRequested = options.mode === "enforce" && env.REFUND_DISPATCH_ENFORCE === true;
  const effectiveMode: RefundDispatchMode = enforceRequested ? "enforce" : "dry_run";
  const candidates = detectPendingRefundCandidates(options.limit ?? 500);

  const summary: RefundDispatchSummary = {
    mode: effectiveMode,
    enforceRequested,
    processed: 0,
    newlyDetected: candidates.length,
    metaSent: 0,
    metaSkipped: 0,
    ga4Sent: 0,
    ga4Skipped: 0,
    purchaseRefundSent: 0,
    purchaseRefundSkipped: 0,
    skipReasons: {},
  };

  for (const candidate of candidates) {
    let metaResult: { ok: boolean; error: string | null } | null = null;
    let ga4Result: { ok: boolean; error: string | null } | null = null;
    let purchaseRefundResult: { ok: boolean; error: string | null } | null = null;

    if (effectiveMode === "enforce") {
      metaResult = await sendMetaRefund(candidate);
      ga4Result = await sendGa4Refund(candidate);
      purchaseRefundResult = await sendMetaPurchaseRefund(candidate);
      if (metaResult.ok) summary.metaSent += 1;
      else {
        summary.metaSkipped += 1;
        summary.skipReasons[metaResult.error ?? "meta_unknown"] =
          (summary.skipReasons[metaResult.error ?? "meta_unknown"] ?? 0) + 1;
      }
      if (ga4Result.ok) summary.ga4Sent += 1;
      else {
        summary.ga4Skipped += 1;
        summary.skipReasons[ga4Result.error ?? "ga4_unknown"] =
          (summary.skipReasons[ga4Result.error ?? "ga4_unknown"] ?? 0) + 1;
      }
      if (purchaseRefundResult.ok) summary.purchaseRefundSent += 1;
      else {
        summary.purchaseRefundSkipped += 1;
        summary.skipReasons[purchaseRefundResult.error ?? "purchase_refund_unknown"] =
          (summary.skipReasons[purchaseRefundResult.error ?? "purchase_refund_unknown"] ?? 0) + 1;
      }
    } else {
      metaResult = { ok: false, error: "dry_run" };
      ga4Result = { ok: false, error: "dry_run" };
      purchaseRefundResult = { ok: false, error: "dry_run" };
    }

    insertDispatchRow(candidate, effectiveMode, metaResult, ga4Result, purchaseRefundResult);
    summary.processed += 1;
  }

  return summary;
}

/**
 * 옵션 C backfill: 이미 `refund_dispatch_log` 에 enforce 로 기록됐지만
 * `purchase_refund_dispatched=0` 인 행에 대해 `sendMetaPurchaseRefund` 만 추가로 쏜다.
 * 기존 Refund custom event / GA4 refund 는 그대로 유지.
 */
export async function backfillPurchaseRefunds(limit = 5000): Promise<{
  mode: "enforce";
  enforceRequested: boolean;
  processed: number;
  sent: number;
  skipped: number;
  skipReasons: Record<string, number>;
}> {
  const enforceRequested = env.REFUND_DISPATCH_ENFORCE === true;
  const db = getCrmDb();
  const rows = db
    .prepare(
      `SELECT id, order_id, payment_key, toss_status, total_amount, cancel_amount, currency,
              method, site, transaction_at
         FROM refund_dispatch_log
        WHERE purchase_refund_dispatched = 0
          AND mode = 'enforce'
        ORDER BY detected_at DESC
        LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 5000)) as Array<Record<string, unknown>>;

  const summary = {
    mode: "enforce" as const,
    enforceRequested,
    processed: 0,
    sent: 0,
    skipped: 0,
    skipReasons: {} as Record<string, number>,
  };

  if (!enforceRequested) {
    // enforce flag 꺼진 상태면 실제 전송 없이 return.
    return summary;
  }

  const updateStmt = db.prepare(
    `UPDATE refund_dispatch_log
        SET purchase_refund_dispatched = @dispatched,
            purchase_refund_dispatched_at = @at,
            purchase_refund_error = @error
      WHERE id = @id`,
  );

  for (const row of rows) {
    const candidate: RefundCandidate = {
      order_id: String(row.order_id ?? ""),
      payment_key: String(row.payment_key ?? ""),
      toss_status: row.toss_status === "PARTIAL_CANCELED" ? "PARTIAL_CANCELED" : "CANCELED",
      method: row.method ? String(row.method) : null,
      total_amount: Number(row.total_amount ?? 0),
      cancel_amount: Number(row.cancel_amount ?? 0),
      currency: (row.currency as string) || "KRW",
      transaction_at: row.transaction_at ? String(row.transaction_at) : null,
      site: row.site ? String(row.site) : null,
      order_code: null, // backfill 시 imweb_orders 재조인은 생략 — order_id 로 external_id 생성
    };
    const result = await sendMetaPurchaseRefund(candidate);
    const now = new Date().toISOString();
    updateStmt.run({
      id: row.id as number,
      dispatched: result.ok ? 1 : 0,
      at: result.ok ? now : null,
      error: result.error,
    });
    if (result.ok) summary.sent += 1;
    else {
      summary.skipped += 1;
      summary.skipReasons[result.error ?? "unknown"] =
        (summary.skipReasons[result.error ?? "unknown"] ?? 0) + 1;
    }
    summary.processed += 1;
  }

  return summary;
}

export function listRefundDispatchLog(options: { limit?: number; site?: string } = {}): RefundDispatchRecord[] {
  const db = getCrmDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const where = options.site ? "WHERE site = ?" : "";
  const params = options.site ? [options.site, limit] : [limit];
  return db
    .prepare(
      `SELECT * FROM refund_dispatch_log ${where}
       ORDER BY detected_at DESC LIMIT ?`,
    )
    .all(...params) as RefundDispatchRecord[];
}

export function getRefundDispatchSummary(windowDays = 7): {
  windowStart: string;
  totals: { cases: number; amount: number; metaSent: number; ga4Sent: number; purchaseRefundSent: number };
  bySite: Array<{ site: string; cases: number; amount: number; metaSent: number; ga4Sent: number; purchaseRefundSent: number }>;
  latestDetectedAt: string | null;
} {
  const db = getCrmDb();
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString();
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS cases,
         COALESCE(SUM(cancel_amount), 0) AS amount,
         COALESCE(SUM(meta_dispatched), 0) AS meta_sent,
         COALESCE(SUM(ga4_dispatched), 0) AS ga4_sent,
         COALESCE(SUM(purchase_refund_dispatched), 0) AS purchase_refund_sent,
         MAX(detected_at) AS latest
       FROM refund_dispatch_log WHERE detected_at >= ?`,
    )
    .get(since) as { cases: number; amount: number; meta_sent: number; ga4_sent: number; purchase_refund_sent: number; latest: string | null };
  const bySite = db
    .prepare(
      `SELECT
         COALESCE(site, 'unknown') AS site,
         COUNT(*) AS cases,
         COALESCE(SUM(cancel_amount), 0) AS amount,
         COALESCE(SUM(meta_dispatched), 0) AS meta_sent,
         COALESCE(SUM(ga4_dispatched), 0) AS ga4_sent,
         COALESCE(SUM(purchase_refund_dispatched), 0) AS purchase_refund_sent
       FROM refund_dispatch_log
       WHERE detected_at >= ?
       GROUP BY COALESCE(site, 'unknown')`,
    )
    .all(since) as Array<{ site: string; cases: number; amount: number; meta_sent: number; ga4_sent: number; purchase_refund_sent: number }>;
  return {
    windowStart: since,
    totals: {
      cases: Number(totals.cases ?? 0),
      amount: Number(totals.amount ?? 0),
      metaSent: Number(totals.meta_sent ?? 0),
      ga4Sent: Number(totals.ga4_sent ?? 0),
      purchaseRefundSent: Number(totals.purchase_refund_sent ?? 0),
    },
    bySite: bySite.map((row) => ({
      site: row.site,
      cases: Number(row.cases ?? 0),
      amount: Number(row.amount ?? 0),
      metaSent: Number(row.meta_sent ?? 0),
      ga4Sent: Number(row.ga4_sent ?? 0),
      purchaseRefundSent: Number(row.purchase_refund_sent ?? 0),
    })),
    latestDetectedAt: totals.latest ?? null,
  };
}
