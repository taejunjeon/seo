/**
 * site_landing_ledger fan-out helper (gpt0508-42 작업1)
 *
 * 기존 attribution handler (marketing-intent / payment-success / checkout-context / paid-click-intent)
 * 가 받은 AttributionLedgerEntry 또는 PaidClickIntentPreview 에서 referrer / UTM / sessionKey /
 * click_id 를 뽑아 site_landing_ledger 에 best-effort 저장하는 helper.
 *
 * 핵심 정책:
 *   - click_id_value 는 sha256 hash 로 변환해 저장 (storage_mode='hash'). raw 모드 사용 안 함.
 *   - raw email/phone/order_no/payment 패턴은 recordSiteLanding 안의 정규식이 차단.
 *   - landing URL 가 없으면 skip (record 의미 없음).
 *   - 호출 실패는 throw 하지 않고 null 반환 (handler 의 본 흐름을 막지 않는다).
 */

import { createHash } from "node:crypto";

import type { AttributionLedgerEntry } from "./attribution";
import {
  recordSiteLanding,
  detectSiteFromUrl,
  type SiteKey,
  type SiteLandingChannelClassified,
  type SiteLandingRecordResult,
} from "./siteLandingLedger";
import { classifySiteLandingChannel } from "./siteLandingChannelClassifier";

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const extractHost = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
};

const pickClickId = (
  entry: AttributionLedgerEntry,
): { type: "gclid" | "fbclid" | "ttclid" | "nclick_id"; value: string } | null => {
  if (entry.gclid) return { type: "gclid", value: entry.gclid };
  if (entry.fbclid) return { type: "fbclid", value: entry.fbclid };
  if (entry.ttclid) return { type: "ttclid", value: entry.ttclid };
  const meta = entry.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.nclickId === "string" && meta.nclickId) {
    return { type: "nclick_id", value: meta.nclickId };
  }
  return null;
};

const pickSessionKey = (entry: AttributionLedgerEntry): {
  gaSessionId: string;
  clientId: string;
} => {
  const meta = entry.metadata as Record<string, unknown> | undefined;
  const clientId = meta && typeof meta.clientId === "string" ? meta.clientId : "";
  return { gaSessionId: entry.gaSessionId || "", clientId };
};

export type FanoutOutcome =
  | { ok: true; source: string; deduped: boolean; landing_id_prefix: string }
  | { ok: false; source: string; skipped: true; reason: string };

/**
 * AttributionLedgerEntry (marketing-intent / payment-success / checkout-context) 에서 fan-out.
 * 실패시 throw 하지 않고 outcome 객체 반환.
 */
export const fanOutEntryToSiteLanding = (
  entry: AttributionLedgerEntry,
  sourceTag: "marketing_intent" | "payment_success" | "checkout_started",
): FanoutOutcome => {
  if (!entry.landing) {
    return { ok: false, source: sourceTag, skipped: true, reason: "missing_landing" };
  }

  const referrerFullUrl = entry.referrer || "";
  const referrerHost = extractHost(referrerFullUrl);
  const clickId = pickClickId(entry);
  const sessionKey = pickSessionKey(entry);

  // gpt0508-45 정정: landing URL 의 host 로 site 자동 감지. 모르면 biocom 으로 fallback.
  const detectedSite: SiteKey = detectSiteFromUrl(entry.landing) ?? "biocom";

  const classification = classifySiteLandingChannel({
    referrerHost,
    referrerFullUrl,
    utm: { source: entry.utmSource, medium: entry.utmMedium, campaign: entry.utmCampaign },
    clickIdType: clickId?.type ?? "",
    site: detectedSite,
  });

  try {
    const result: SiteLandingRecordResult = recordSiteLanding({
      site: detectedSite,
      landedAt: entry.loggedAt,
      receivedAt: new Date().toISOString(),
      referrerHost,
      referrerFullUrl,
      landingUrl: entry.landing,
      utm: {
        source: entry.utmSource,
        medium: entry.utmMedium,
        campaign: entry.utmCampaign,
        term: entry.utmTerm,
        content: entry.utmContent,
      },
      clickId: clickId
        ? { type: clickId.type, valueOrHash: sha256Hex(clickId.value), storageMode: "hash" }
        : undefined,
      sessionKey: {
        gaSessionId: sessionKey.gaSessionId,
        clientId: sessionKey.clientId,
        localSessionIdHash: "",
      },
      channelClassified: classification.channel as SiteLandingChannelClassified,
      sourceBreakdown: classification.source_breakdown,
    });

    if (!result.stored) {
      return { ok: false, source: sourceTag, skipped: true, reason: result.reason };
    }
    return {
      ok: true,
      source: sourceTag,
      deduped: result.deduped,
      landing_id_prefix: result.row.landingId.slice(0, 12),
    };
  } catch (err) {
    return {
      ok: false,
      source: sourceTag,
      skipped: true,
      reason: `record_throw_${(err as Error).message.slice(0, 60)}`,
    };
  }
};

/**
 * paid_click_intent preview 에서 fan-out (paid-click-intent handler 용).
 * preview 는 raw click_id 가 들어있을 수 있으므로 sha256 변환 후 hash 모드로 저장.
 */
export const fanOutPaidClickIntentPreviewToSiteLanding = (input: {
  capturedAt: string;
  landingUrl: string;
  referrer: string;
  utm: { source: string; medium: string; campaign: string; term: string; content: string };
  clickIds: { gclid: string; gbraid: string; wbraid: string; fbclid?: string; ttclid?: string };
  sessionKey: { gaSessionId: string; clientId: string; localSessionIdHash?: string };
}): FanoutOutcome => {
  if (!input.landingUrl) {
    return { ok: false, source: "paid_click_intent", skipped: true, reason: "missing_landing" };
  }

  const referrerFullUrl = input.referrer || "";
  const referrerHost = extractHost(referrerFullUrl);

  let clickType: "gclid" | "gbraid" | "wbraid" | "ttclid" | "fbclid" | "" = "";
  let clickValue = "";
  if (input.clickIds.gclid) {
    clickType = "gclid";
    clickValue = input.clickIds.gclid;
  } else if (input.clickIds.gbraid) {
    clickType = "gbraid";
    clickValue = input.clickIds.gbraid;
  } else if (input.clickIds.wbraid) {
    clickType = "wbraid";
    clickValue = input.clickIds.wbraid;
  } else if (input.clickIds.ttclid) {
    clickType = "ttclid";
    clickValue = input.clickIds.ttclid;
  } else if (input.clickIds.fbclid) {
    clickType = "fbclid";
    clickValue = input.clickIds.fbclid;
  }

  // gpt0508-45 정정: landing URL 의 host 로 site 자동 감지.
  const detectedSite: SiteKey = detectSiteFromUrl(input.landingUrl) ?? "biocom";

  const classification = classifySiteLandingChannel({
    referrerHost,
    referrerFullUrl,
    utm: { source: input.utm.source, medium: input.utm.medium, campaign: input.utm.campaign },
    clickIdType: clickType,
    site: detectedSite,
  });

  try {
    const result = recordSiteLanding({
      site: detectedSite,
      landedAt: input.capturedAt,
      receivedAt: new Date().toISOString(),
      referrerHost,
      referrerFullUrl,
      landingUrl: input.landingUrl,
      utm: input.utm,
      clickId: clickValue
        ? { type: clickType || "gclid", valueOrHash: sha256Hex(clickValue), storageMode: "hash" }
        : undefined,
      sessionKey: {
        gaSessionId: input.sessionKey.gaSessionId,
        clientId: input.sessionKey.clientId,
        localSessionIdHash: input.sessionKey.localSessionIdHash ?? "",
      },
      channelClassified: classification.channel as SiteLandingChannelClassified,
      sourceBreakdown: classification.source_breakdown,
    });

    if (!result.stored) {
      return { ok: false, source: "paid_click_intent", skipped: true, reason: result.reason };
    }
    return {
      ok: true,
      source: "paid_click_intent",
      deduped: result.deduped,
      landing_id_prefix: result.row.landingId.slice(0, 12),
    };
  } catch (err) {
    return {
      ok: false,
      source: "paid_click_intent",
      skipped: true,
      reason: `record_throw_${(err as Error).message.slice(0, 60)}`,
    };
  }
};
