/**
 * order_bridge_ledger 의 click_id_hash 를 Google Ads click_view exact campaign_id 와
 * read-only 로 매칭한다.
 *
 * 절대 금지:
 *   - click_id_hash 역산 시도
 *   - Google Ads API write
 *   - raw click_id (gclid/gbraid/wbraid) output / log
 *
 * 동작:
 *   1. caller 가 (option a) Google Ads click_view 후보 row 를 raw click_id 와 함께 직접 fetch 후 inject (transient)
 *      또는 (option b) paid_click_intent_log 의 raw click_id 후보를 inject (transient)
 *   2. 함수 내부에서 transient HMAC 처리 (각 raw → click_id_hash)
 *   3. ledger click_id_hash 와 같은 HMAC 값을 가진 row 만 매칭으로 인정
 *   4. raw 값은 함수 종료와 함께 폐기 — 응답에는 campaign_id, campaign_name, click_id_type, match_source 만
 *
 * 사용처:
 *   ConfirmedPurchasePrep cross_reference_evidence.ledger_lookup wire
 */

import { createHmac } from "node:crypto";

export type ClickIdType = "gclid" | "gbraid" | "wbraid" | "unknown";

export type ClickViewExactMatchSource =
  | "google_ads_click_view"
  | "paid_click_intent_hash"
  | "fallback_blocked";

export type GoogleAdsClickViewCandidate = {
  /** raw click_id (transient input only — 응답에 절대 노출 안 됨) */
  rawClickId: string;
  clickIdType: ClickIdType;
  campaignId: string | null;
  campaignName: string | null;
  clickTimeIso: string | null;
};

export type GoogleAdsClickViewExactLookupInput = {
  /** ledger 에서 가져온 click_id_hash 목록 */
  ledgerClickHashes: ReadonlyArray<string>;
  hmacSecret: string;
  /** 옵션 a: Google Ads click_view 후보 — caller 가 read-only 로 fetch 후 inject */
  clickViewCandidates?: ReadonlyArray<GoogleAdsClickViewCandidate>;
  /** 옵션 b: paid_click_intent_log 후보 (raw click_id transient) — 본 sprint 미사용, 다음 sprint 확장용 */
  paidClickIntentCandidates?: ReadonlyArray<GoogleAdsClickViewCandidate>;
};

export type GoogleAdsClickViewExactLookupRow = {
  ledger_click_id_hash: string;
  click_view_exact_match: boolean;
  campaign_id: string | null;
  campaign_name_safe: string | null;
  click_id_type: ClickIdType;
  match_source: ClickViewExactMatchSource;
  reason: string;
};

export type GoogleAdsClickViewExactLookupResult = {
  ok: boolean;
  total_ledger_hashes: number;
  candidates_scanned: number;
  matches: number;
  source_blocked: number;
  rows: GoogleAdsClickViewExactLookupRow[];
  warnings: string[];
};

const hmacHex = (value: string, secret: string): string =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

const sha256HexShim = (value: string): string => {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
};

/**
 * ledger click_id_hash 는 orderBridgeIdentityHmac.ts 에서 sha256Hex (HMAC 아님) 으로 생성됨.
 * 따라서 click_id hash 비교는 sha256(rawClickId) 으로 진행한다.
 * order_no_hash 는 HMAC 사용이라 비교 함수가 다르다.
 */
const clickIdHashOf = (rawClickId: string): string => sha256HexShim(rawClickId);

export const lookupGoogleAdsClickViewExact = async (
  input: GoogleAdsClickViewExactLookupInput,
): Promise<GoogleAdsClickViewExactLookupResult> => {
  const uniqueLedgerHashes = Array.from(new Set(input.ledgerClickHashes.filter((h) => Boolean(h))));
  if (uniqueLedgerHashes.length === 0) {
    return {
      ok: true,
      total_ledger_hashes: 0,
      candidates_scanned: 0,
      matches: 0,
      source_blocked: 0,
      rows: [],
      warnings: ["ledgerClickHashes empty (click_id_hash 부재 row → 자동 click_view_not_found)"],
    };
  }

  const clickViewCandidates = input.clickViewCandidates ?? [];
  const paidClickIntentCandidates = input.paidClickIntentCandidates ?? [];

  if (clickViewCandidates.length === 0 && paidClickIntentCandidates.length === 0) {
    // raw click_id 후보 자체가 없으면 source_blocked — Google Ads API 가 click_id raw 를 반환하지 못하는 케이스 포함
    return {
      ok: true,
      total_ledger_hashes: uniqueLedgerHashes.length,
      candidates_scanned: 0,
      matches: 0,
      source_blocked: uniqueLedgerHashes.length,
      rows: uniqueLedgerHashes.map((h) => ({
        ledger_click_id_hash: h,
        click_view_exact_match: false,
        campaign_id: null,
        campaign_name_safe: null,
        click_id_type: "unknown" as ClickIdType,
        match_source: "fallback_blocked" as ClickViewExactMatchSource,
        reason: "no_raw_click_id_candidates_injected",
      })),
      warnings: [
        "caller 가 clickViewCandidates 또는 paidClickIntentCandidates 를 inject 하지 않음. Google Ads API 또는 paid_click_intent_log 에서 raw click_id 후보를 먼저 가져와야 한다.",
      ],
    };
  }

  // transient HMAC index 만들기
  const hashIndex = new Map<
    string,
    {
      campaignId: string | null;
      campaignName: string | null;
      clickIdType: ClickIdType;
      source: ClickViewExactMatchSource;
    }
  >();
  for (const c of clickViewCandidates) {
    const h = clickIdHashOf(c.rawClickId);
    if (!hashIndex.has(h)) {
      hashIndex.set(h, {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        clickIdType: c.clickIdType,
        source: "google_ads_click_view",
      });
    }
  }
  for (const c of paidClickIntentCandidates) {
    const h = clickIdHashOf(c.rawClickId);
    if (!hashIndex.has(h)) {
      hashIndex.set(h, {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        clickIdType: c.clickIdType,
        source: "paid_click_intent_hash",
      });
    }
  }

  const rows: GoogleAdsClickViewExactLookupRow[] = [];
  let matches = 0;
  for (const ledgerHash of uniqueLedgerHashes) {
    const candidate = hashIndex.get(ledgerHash);
    if (!candidate) {
      rows.push({
        ledger_click_id_hash: ledgerHash,
        click_view_exact_match: false,
        campaign_id: null,
        campaign_name_safe: null,
        click_id_type: "unknown",
        match_source: "fallback_blocked",
        reason: "click_view_not_found",
      });
      continue;
    }
    matches += 1;
    rows.push({
      ledger_click_id_hash: ledgerHash,
      click_view_exact_match: true,
      campaign_id: candidate.campaignId,
      campaign_name_safe: candidate.campaignName,
      click_id_type: candidate.clickIdType,
      match_source: candidate.source,
      reason: "click_view_exact_matched",
    });
  }

  return {
    ok: true,
    total_ledger_hashes: uniqueLedgerHashes.length,
    candidates_scanned: clickViewCandidates.length + paidClickIntentCandidates.length,
    matches,
    source_blocked: 0,
    rows,
    warnings: [],
  };
};

// for symmetry with operational lookup
export const HMAC_HEX = hmacHex;
