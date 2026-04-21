/**
 * C-Sprint 5 (identity coverage 50% → 85%): BigQuery 없이 `attribution_ledger` 만으로
 * payment_success 식별자 누락의 5가지 원인 중 historical / duplicate_sender / tag_payload_missing
 * 3 가지를 정량화한다.
 *
 * 기점 (payment_success row 의 logged_at 기준으로 era 분류):
 *  - 2026-04-08 : fetch-fix 적용 (snippet 이 clientId / userPseudoId / gaSessionId 수집 시작)
 *  - 2026-04-12 : post-server-decision-guard (가상계좌 Purchase 차단)
 *  - 2026-04-15 : source 라벨 오염 SQL 복구 + origin↔source 가드
 */

import { getCrmDb } from "../crmLocalDb";

export type FetchFixEra = "before_fix" | "after_fix";

export type CoverageRow = {
  era: FetchFixEra;
  source: string;
  total: number;
  withGaSessionId: number;
  withClientId: number;
  withUserPseudoId: number;
  withFbclid: number;
  withGclid: number;
  withUtmSource: number;
  withAllThree: number;
};

export type DuplicateOrderSample = {
  order_id: string;
  rows: number;
  firstLoggedAt: string;
  lastLoggedAt: string;
  paymentStatuses: string;
  captureModes: string;
};

export type FieldCoverageRow = {
  field: string;
  total: number;
  present: number;
  pct: number;
};

export type IdentityCoverageSummary = {
  generatedAt: string;
  fetchFixDate: string;
  totalPaymentSuccess: number;
  byEra: Array<{ era: FetchFixEra; total: number; allThreePct: number; gaSessionIdPct: number; clientIdPct: number }>;
  bySource: CoverageRow[];
  historicalShare: { beforeFix: number; afterFix: number; beforeFixPct: number };
  duplicateOrders: { totalDuplicateOrders: number; extraRows: number };
  fieldCoverage: FieldCoverageRow[];
  timeSeries: Array<{ day: string; total: number; allThree: number; allThreePct: number }>;
};

const FETCH_FIX_DATE = "2026-04-08";

const pctRound = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.round((numerator * 1000) / denominator) / 10;

export function buildIdentityCoverageSummary(): IdentityCoverageSummary {
  const db = getCrmDb();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM attribution_ledger WHERE touchpoint='payment_success'`)
    .get() as { cnt: number };
  const totalPaymentSuccess = Number(totalRow.cnt ?? 0);

  const allThreeWhere = `
    ga_session_id != ''
    AND json_extract(metadata_json,'$.clientId') IS NOT NULL AND json_extract(metadata_json,'$.clientId') != ''
    AND json_extract(metadata_json,'$.userPseudoId') IS NOT NULL AND json_extract(metadata_json,'$.userPseudoId') != ''
  `;

  // era × source breakdown
  const coverageRows = db
    .prepare(
      `SELECT
         CASE WHEN logged_at < @fixDate THEN 'before_fix' ELSE 'after_fix' END AS era,
         source,
         COUNT(*) AS total,
         SUM(CASE WHEN ga_session_id != '' THEN 1 ELSE 0 END) AS with_gsid,
         SUM(CASE WHEN json_extract(metadata_json,'$.clientId') IS NOT NULL AND json_extract(metadata_json,'$.clientId') != '' THEN 1 ELSE 0 END) AS with_clientid,
         SUM(CASE WHEN json_extract(metadata_json,'$.userPseudoId') IS NOT NULL AND json_extract(metadata_json,'$.userPseudoId') != '' THEN 1 ELSE 0 END) AS with_psid,
         SUM(CASE WHEN fbclid != '' OR (json_extract(metadata_json,'$.fbc') IS NOT NULL AND json_extract(metadata_json,'$.fbc') != '') THEN 1 ELSE 0 END) AS with_fb,
         SUM(CASE WHEN gclid != '' THEN 1 ELSE 0 END) AS with_gclid,
         SUM(CASE WHEN utm_source != '' THEN 1 ELSE 0 END) AS with_utmsrc,
         SUM(CASE WHEN ${allThreeWhere} THEN 1 ELSE 0 END) AS with_all3
       FROM attribution_ledger
       WHERE touchpoint='payment_success'
       GROUP BY era, source
       ORDER BY total DESC`,
    )
    .all({ fixDate: `${FETCH_FIX_DATE}T00:00:00.000Z` }) as Array<Record<string, unknown>>;

  const bySource: CoverageRow[] = coverageRows.map((row) => ({
    era: row.era === "before_fix" ? "before_fix" : "after_fix",
    source: String(row.source ?? ""),
    total: Number(row.total ?? 0),
    withGaSessionId: Number(row.with_gsid ?? 0),
    withClientId: Number(row.with_clientid ?? 0),
    withUserPseudoId: Number(row.with_psid ?? 0),
    withFbclid: Number(row.with_fb ?? 0),
    withGclid: Number(row.with_gclid ?? 0),
    withUtmSource: Number(row.with_utmsrc ?? 0),
    withAllThree: Number(row.with_all3 ?? 0),
  }));

  // era aggregate
  const eraAgg = db
    .prepare(
      `SELECT
         CASE WHEN logged_at < @fixDate THEN 'before_fix' ELSE 'after_fix' END AS era,
         COUNT(*) AS total,
         SUM(CASE WHEN ${allThreeWhere} THEN 1 ELSE 0 END) AS all3,
         SUM(CASE WHEN ga_session_id != '' THEN 1 ELSE 0 END) AS gsid,
         SUM(CASE WHEN json_extract(metadata_json,'$.clientId') IS NOT NULL AND json_extract(metadata_json,'$.clientId') != '' THEN 1 ELSE 0 END) AS cid
       FROM attribution_ledger
       WHERE touchpoint='payment_success'
       GROUP BY era`,
    )
    .all({ fixDate: `${FETCH_FIX_DATE}T00:00:00.000Z` }) as Array<Record<string, unknown>>;

  const byEra = eraAgg.map((row) => {
    const total = Number(row.total ?? 0);
    return {
      era: (row.era === "before_fix" ? "before_fix" : "after_fix") as FetchFixEra,
      total,
      allThreePct: pctRound(Number(row.all3 ?? 0), total),
      gaSessionIdPct: pctRound(Number(row.gsid ?? 0), total),
      clientIdPct: pctRound(Number(row.cid ?? 0), total),
    };
  });

  const beforeFix = byEra.find((r) => r.era === "before_fix")?.total ?? 0;
  const afterFix = byEra.find((r) => r.era === "after_fix")?.total ?? 0;

  // duplicate orderId
  const duplicates = db
    .prepare(
      `SELECT COUNT(*) AS dup_orders, COALESCE(SUM(extra), 0) AS extra_rows
       FROM (
         SELECT order_id, COUNT(*) - 1 AS extra
         FROM attribution_ledger
         WHERE touchpoint='payment_success' AND order_id != ''
         GROUP BY order_id
         HAVING COUNT(*) > 1
       )`,
    )
    .get() as { dup_orders: number; extra_rows: number };

  // metadata 필드 커버리지 (payment_success 전체 기준)
  const fieldChecks: Array<{ field: string; sql: string }> = [
    { field: "ga_session_id", sql: `ga_session_id != ''` },
    { field: "clientId", sql: `json_extract(metadata_json,'$.clientId') IS NOT NULL AND json_extract(metadata_json,'$.clientId') != ''` },
    { field: "userPseudoId", sql: `json_extract(metadata_json,'$.userPseudoId') IS NOT NULL AND json_extract(metadata_json,'$.userPseudoId') != ''` },
    { field: "fbc", sql: `json_extract(metadata_json,'$.fbc') IS NOT NULL AND json_extract(metadata_json,'$.fbc') != ''` },
    { field: "fbp", sql: `json_extract(metadata_json,'$.fbp') IS NOT NULL AND json_extract(metadata_json,'$.fbp') != ''` },
    { field: "fbclid", sql: `fbclid != ''` },
    { field: "gclid", sql: `gclid != ''` },
    { field: "ttclid", sql: `ttclid != ''` },
    { field: "utm_source", sql: `utm_source != ''` },
    { field: "utm_campaign", sql: `utm_campaign != ''` },
    { field: "paymentKey", sql: `payment_key != ''` },
    { field: "order_code", sql: `json_extract(metadata_json,'$.orderCode') IS NOT NULL AND json_extract(metadata_json,'$.orderCode') != ''` },
  ];

  const fieldCoverage: FieldCoverageRow[] = fieldChecks.map((check) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN ${check.sql} THEN 1 ELSE 0 END) AS present
         FROM attribution_ledger WHERE touchpoint='payment_success'`,
      )
      .get() as { total: number; present: number };
    const total = Number(row.total ?? 0);
    const present = Number(row.present ?? 0);
    return { field: check.field, total, present, pct: pctRound(present, total) };
  });

  // 일자별 시계열 (최근 60일 또는 전체)
  const timeSeries = db
    .prepare(
      `SELECT
         substr(logged_at, 1, 10) AS day,
         COUNT(*) AS total,
         SUM(CASE WHEN ${allThreeWhere} THEN 1 ELSE 0 END) AS all_three
       FROM attribution_ledger
       WHERE touchpoint='payment_success'
       GROUP BY day ORDER BY day`,
    )
    .all() as Array<{ day: string; total: number; all_three: number }>;

  return {
    generatedAt: new Date().toISOString(),
    fetchFixDate: FETCH_FIX_DATE,
    totalPaymentSuccess,
    byEra,
    bySource,
    historicalShare: {
      beforeFix,
      afterFix,
      beforeFixPct: pctRound(beforeFix, beforeFix + afterFix),
    },
    duplicateOrders: {
      totalDuplicateOrders: Number(duplicates.dup_orders ?? 0),
      extraRows: Number(duplicates.extra_rows ?? 0),
    },
    fieldCoverage,
    timeSeries: timeSeries.map((row) => ({
      day: row.day,
      total: Number(row.total ?? 0),
      allThree: Number(row.all_three ?? 0),
      allThreePct: pctRound(Number(row.all_three ?? 0), Number(row.total ?? 0)),
    })),
  };
}

export function listDuplicateOrderSamples(limit = 20): DuplicateOrderSample[] {
  const db = getCrmDb();
  return db
    .prepare(
      `SELECT
         order_id,
         COUNT(*) AS rows,
         MIN(logged_at) AS first_logged_at,
         MAX(logged_at) AS last_logged_at,
         GROUP_CONCAT(DISTINCT COALESCE(payment_status, '')) AS payment_statuses,
         GROUP_CONCAT(DISTINCT COALESCE(capture_mode, '')) AS capture_modes
       FROM attribution_ledger
       WHERE touchpoint='payment_success' AND order_id != ''
       GROUP BY order_id
       HAVING COUNT(*) > 1
       ORDER BY rows DESC, last_logged_at DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 200)) as Array<{
      order_id: string;
      rows: number;
      first_logged_at: string;
      last_logged_at: string;
      payment_statuses: string;
      capture_modes: string;
    }> as unknown as DuplicateOrderSample[];
}
