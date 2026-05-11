/**
 * R2 order_bridge_ledger row 의 sessionKey 또는 시간 윈도우 기준으로
 *   1) paid_click_intent_ledger (로컬 SQLite)
 *   2) Google Ads click_view (caller 가 fetch — 본 helper 는 inject만)
 * 에서 후보를 모아 GoogleAdsClickViewExactLookup / PaidClickIntentSameSessionBridge
 * 두 helper 의 입력으로 자동 변환하는 read-only injector.
 *
 * 본 helper 자체는 운영DB / 외부 API 를 호출하지 않음. 로컬 SQLite 만 SELECT.
 */

import { getCrmDb } from "./crmLocalDb";
import type { GoogleAdsClickViewCandidate } from "./googleAdsClickViewExactLookup";
import type { PaidClickIntentCandidate, LedgerSessionKey } from "./paidClickIntentSameSessionBridge";

const TABLE = "paid_click_intent_ledger";

export type SessionWindow = {
  /** 최소 captured_at iso (포함) — default 1시간 전 */
  minCapturedAtIso?: string;
  /** 최대 captured_at iso (포함) — default 현재 */
  maxCapturedAtIso?: string;
};

export type CandidatesInjectorInput = {
  site: string;
  sessionKeys: ReadonlyArray<LedgerSessionKey>;
  window?: SessionWindow;
  /** 최대 후보 수 — default 500. 후보 폭주 방지 */
  limit?: number;
};

export type CandidatesInjectorResult = {
  total_rows_scanned: number;
  paid_click_intent_candidates: PaidClickIntentCandidate[];
  click_view_candidates: GoogleAdsClickViewCandidate[];
  warnings: string[];
};

type Row = {
  intent_id: string;
  captured_at: string;
  click_id_type: string;
  click_id_value: string;
  ga_session_id: string;
  client_id: string;
  local_session_id: string;
  utm_campaign: string;
};

const toClickIdType = (raw: string): PaidClickIntentCandidate["click_id_type"] => {
  switch (raw) {
    case "gclid":
    case "gbraid":
    case "wbraid":
    case "ttclid":
    case "nclick_id":
      return raw;
    default:
      return "unknown";
  }
};

const toClickViewClickIdType = (raw: string): GoogleAdsClickViewCandidate["clickIdType"] => {
  switch (raw) {
    case "gclid":
    case "gbraid":
    case "wbraid":
      return raw;
    default:
      return "unknown";
  }
};

const oneHourAgoIso = (now: Date = new Date()): string => {
  const d = new Date(now.getTime() - 60 * 60 * 1000);
  return d.toISOString();
};

export const injectClickViewCandidatesFromPaidIntent = (
  input: CandidatesInjectorInput,
): CandidatesInjectorResult => {
  const warnings: string[] = [];
  const sessionKeysFiltered = input.sessionKeys.filter(
    (k) => Boolean(k.ga_session_id) || Boolean(k.client_id),
  );
  if (sessionKeysFiltered.length === 0) {
    return {
      total_rows_scanned: 0,
      paid_click_intent_candidates: [],
      click_view_candidates: [],
      warnings: ["sessionKeys empty — caller 가 ledger row sessionKey 를 inject 하지 않음"],
    };
  }

  const min = input.window?.minCapturedAtIso ?? oneHourAgoIso();
  const max = input.window?.maxCapturedAtIso ?? new Date().toISOString();
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 2000);

  const gaSessions = Array.from(
    new Set(sessionKeysFiltered.map((k) => k.ga_session_id ?? "").filter(Boolean)),
  );
  const clientIds = Array.from(
    new Set(sessionKeysFiltered.map((k) => k.client_id ?? "").filter(Boolean)),
  );

  const orClauses: string[] = [];
  const params: Array<string | number> = [];
  if (gaSessions.length > 0) {
    orClauses.push(`ga_session_id IN (${gaSessions.map(() => "?").join(",")})`);
    params.push(...gaSessions);
  }
  if (clientIds.length > 0) {
    orClauses.push(`client_id IN (${clientIds.map(() => "?").join(",")})`);
    params.push(...clientIds);
  }
  if (orClauses.length === 0) {
    return {
      total_rows_scanned: 0,
      paid_click_intent_candidates: [],
      click_view_candidates: [],
      warnings: ["sessionKey 에 ga_session_id / client_id 둘 다 없음"],
    };
  }

  const sql = `
    SELECT intent_id, captured_at, click_id_type, click_id_value,
           ga_session_id, client_id, local_session_id, utm_campaign
    FROM ${TABLE}
    WHERE site = ?
      AND captured_at >= ?
      AND captured_at <= ?
      AND (${orClauses.join(" OR ")})
    ORDER BY captured_at DESC
    LIMIT ?
  `;
  params.unshift(max);
  params.unshift(min);
  params.unshift(input.site);
  params.push(limit);

  let rows: Row[] = [];
  try {
    const db = getCrmDb();
    rows = db.prepare(sql).all(...params) as Row[];
  } catch (err) {
    warnings.push(`paid_click_intent_ledger SELECT failed: ${(err as Error).message}`);
    return {
      total_rows_scanned: 0,
      paid_click_intent_candidates: [],
      click_view_candidates: [],
      warnings,
    };
  }

  const paidCandidates: PaidClickIntentCandidate[] = [];
  const clickViewCandidates: GoogleAdsClickViewCandidate[] = [];

  for (const row of rows) {
    if (!row.click_id_value) continue;
    paidCandidates.push({
      intent_id: row.intent_id,
      rawClickIdValue: row.click_id_value,
      click_id_type: toClickIdType(row.click_id_type),
      ga_session_id: row.ga_session_id,
      client_id: row.client_id,
      local_session_id: row.local_session_id,
      captured_at_iso: row.captured_at,
    });

    const cvType = toClickViewClickIdType(row.click_id_type);
    if (cvType !== "unknown") {
      clickViewCandidates.push({
        rawClickId: row.click_id_value,
        clickIdType: cvType,
        campaignId: null,
        campaignName: row.utm_campaign || null,
        clickTimeIso: row.captured_at,
      });
    }
  }

  if (paidCandidates.length === 0) {
    warnings.push("paid_click_intent_ledger 에 sessionKey 매칭 row 0건 — window 짧거나 ga_session_id mismatch");
  }

  return {
    total_rows_scanned: rows.length,
    paid_click_intent_candidates: paidCandidates,
    click_view_candidates: clickViewCandidates,
    warnings,
  };
};
