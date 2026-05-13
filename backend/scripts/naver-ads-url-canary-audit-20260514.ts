import { buildNaverSearchAdHeaders, listCampaigns } from "../src/naverAdsClient";

const BASE_URL = "https://api.searchad.naver.com";
const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "NaPm",
  "nclid",
  "n_media",
  "n_query",
  "n_rank",
  "n_ad_group",
  "n_ad",
  "n_keyword_id",
  "n_keyword",
  "n_match",
];

const callNaverAds = async <T>(uri: string, query?: Record<string, string>) => {
  const queryString = query
    ? "?" + Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
    : "";
  const res = await fetch(`${BASE_URL}${uri}${queryString}`, {
    method: "GET",
    headers: buildNaverSearchAdHeaders("GET", uri),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${uri} ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
};

const safeUrlSummary = (raw: unknown) => {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw);
    const utm: Record<string, string> = {};
    for (const key of TRACKING_KEYS) {
      const value = url.searchParams.get(key);
      if (value) utm[key] = key === "NaPm" || key === "nclid" ? "<present>" : value.slice(0, 80);
    }
    return {
      origin: url.origin,
      path: url.pathname,
      queryKeys: Array.from(url.searchParams.keys()).sort(),
      tracking: utm,
    };
  } catch {
    return { rawKind: "unparseable", length: raw.length };
  }
};

const parseCreative = (value: unknown) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const standardUtm = (input: { campaignName: string; adgroupName: string; medium: "cpc" | "brandsearch" }) => ({
  utm_source: "naver",
  utm_medium: input.medium,
  utm_campaign: input.campaignName,
  utm_content: input.adgroupName,
  utm_term: "{keyword}",
});

const inferMedium = (campaignName: string) =>
  /brandsearch|브랜드검색/i.test(campaignName) ? "brandsearch" as const : "cpc" as const;

const main = async () => {
  const campaigns = await listCampaigns();
  if (!campaigns.ok) throw new Error(campaigns.error);

  const activeCampaigns = campaigns.campaigns
    .filter((campaign) => campaign.status === "ELIGIBLE")
    .slice(0, 12);
  const rows = [];

  for (const campaign of activeCampaigns) {
    const adgroups = await callNaverAds<Array<Record<string, unknown>>>("/ncc/adgroups", {
      nccCampaignId: campaign.nccCampaignId,
    });
    const adgroup = adgroups.find((item) => item.status === "ELIGIBLE") ?? adgroups[0];
    if (!adgroup) {
      rows.push({
        campaign: { id: campaign.nccCampaignId, name: campaign.name, status: campaign.status, campaignTp: campaign.campaignTp },
        adgroups: 0,
      });
      continue;
    }

    const adgroupId = String(adgroup.nccAdgroupId || "");
    const ads = await callNaverAds<Array<Record<string, unknown>>>("/ncc/ads", { nccAdgroupId: adgroupId });
    const ad = ads.find((item) => item.status === "ELIGIBLE" || item.inspectStatus === "APPROVED") ?? ads[0];
    const creative = parseCreative(ad?.ad);
    const pc = parseCreative(creative.pc);
    const mobile = parseCreative(creative.mobile);
    const adgroupName = String(adgroup.name || "");
    const recommended = standardUtm({
      campaignName: campaign.name,
      adgroupName,
      medium: inferMedium(campaign.name),
    });

    rows.push({
      campaign: { id: campaign.nccCampaignId, name: campaign.name, status: campaign.status, campaignTp: campaign.campaignTp },
      adgroup: { id: adgroupId, name: adgroupName, status: adgroup.status },
      adsCount: ads.length,
      sampleAd: ad ? {
        id: ad.nccAdId,
        type: ad.type,
        status: ad.status,
        inspectStatus: ad.inspectStatus,
        creativeKeys: Object.keys(creative).sort(),
        pcFinal: safeUrlSummary(pc.final),
        mobileFinal: safeUrlSummary(mobile.final),
      } : null,
      recommendedStandardUtm: recommended,
      canaryApiWriteStatus: "blocked_by_searchad_api_update_fields",
      canaryManualStatus: "ready_for_single_adgroup_ui_change",
    });
  }

  console.log(JSON.stringify({
    ok: true,
    source: "Naver Search Ad API read-only",
    checkedAtKst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T"),
    campaignsScanned: rows.length,
    externalWrite: false,
    platformUpload: false,
    rows,
  }, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
