import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

import { readLedgerEntries } from "../src/attribution";
import { buildNormalizedLedgerOrders } from "../src/routes/ads";

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

dotenv.config({ path: path.resolve(REPO_ROOT, "backend", ".env") });

type SiteKey = "biocom" | "thecleancoffee" | "aibio";

type SiteConfig = {
  site: SiteKey;
  accountId: string;
};

type MetaInsight = {
  campaign_id: string;
  campaign_name: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
};

type MetaAdset = {
  id: string;
  campaign_id: string;
  name: string;
  status?: string;
  attribution_spec?: Array<{
    event_type?: string;
    window_days?: number;
  }>;
  optimization_goal?: string;
  promoted_object?: {
    pixel_id?: string;
    page_id?: string;
    custom_event_type?: string;
    application_id?: string;
  };
};

type MetaAd = {
  id: string;
  name: string;
  status?: string;
  url_tags?: string;
  creative?: {
    id?: string;
    name?: string;
    object_story_id?: string;
    effective_object_story_id?: string;
    object_url?: string;
    thumbnail_url?: string;
    instagram_permalink_url?: string;
    image_url?: string;
    title?: string;
    body?: string;
    object_type?: string;
    video_id?: string;
    link_url?: string;
    url_tags?: string;
    asset_feed_spec?: {
      link_urls?: Array<{
        website_url?: string;
        display_url?: string;
        url_tags?: string;
      }>;
    };
    object_story_spec?: {
      link_data?: {
        link?: string;
        child_attachments?: Array<{
          link?: string;
          call_to_action?: {
            value?: {
              link?: string;
            };
          };
        }>;
        call_to_action?: {
          value?: {
            link?: string;
          };
        };
      };
      video_data?: {
        call_to_action?: {
          value?: {
            link?: string;
          };
        };
      };
    };
  };
  insights?: {
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
    }>;
  };
};

type NormalizedOrder = ReturnType<typeof buildNormalizedLedgerOrders>[number];
type UrlCandidate = {
  source: string;
  url: string;
};

const SITE_CONFIGS: Record<SiteKey, SiteConfig> = {
  biocom: { site: "biocom", accountId: "act_3138805896402376" },
  thecleancoffee: { site: "thecleancoffee", accountId: "act_654671961007474" },
  aibio: { site: "aibio", accountId: "act_377604674894011" },
};

const DATE_PRESETS: Record<string, { startDate: string; endDate: string }> = {
  last_7d: { startDate: "2026-04-03", endDate: "2026-04-09" },
  last_14d: { startDate: "2026-03-27", endDate: "2026-04-09" },
  last_30d: { startDate: "2026-03-11", endDate: "2026-04-09" },
  last_90d: { startDate: "2026-01-10", endDate: "2026-04-09" },
};

const normalizeSource = (value: string) => value.trim().toLowerCase();

const isMetaAttributedOrder = (order: NormalizedOrder) => {
  const source = normalizeSource(order.utmSource || "");
  return source === "fb" || source.includes("facebook") || Boolean((order.fbclid || "").trim());
};

const firstNonEmpty = (values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const extractUrlTags = (input: string | null) => {
  if (!input) return null;
  try {
    const trimmed = input.trim();
    const searchParams = isAbsoluteHttpUrl(trimmed)
      ? new URL(trimmed).searchParams
      : new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
    const tags = Object.fromEntries(
      [...searchParams.entries()].filter(([key]) =>
        key.startsWith("utm_")
        || key === "fbclid"
        || key === "gclid"
        || key === "ttclid"
        || key.startsWith("meta_")),
    );
    return Object.keys(tags).length > 0 ? tags : null;
  } catch {
    return null;
  }
};

const addUrlCandidate = (
  candidates: UrlCandidate[],
  source: string,
  value: string | null | undefined,
) => {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url || !isAbsoluteHttpUrl(url)) return;
  if (candidates.some((candidate) => candidate.url === url)) return;
  candidates.push({ source, url });
};

const collectUrlCandidates = (ad: MetaAd) => {
  const candidates: UrlCandidate[] = [];
  const linkData = ad.creative?.object_story_spec?.link_data;
  const videoData = ad.creative?.object_story_spec?.video_data;

  addUrlCandidate(candidates, "creative.object_story_spec.link_data.link", linkData?.link);
  addUrlCandidate(
    candidates,
    "creative.object_story_spec.link_data.call_to_action.value.link",
    linkData?.call_to_action?.value?.link,
  );

  for (const [index, attachment] of (linkData?.child_attachments ?? []).entries()) {
    addUrlCandidate(
      candidates,
      `creative.object_story_spec.link_data.child_attachments.${index}.link`,
      attachment.link,
    );
    addUrlCandidate(
      candidates,
      `creative.object_story_spec.link_data.child_attachments.${index}.call_to_action.value.link`,
      attachment.call_to_action?.value?.link,
    );
  }

  addUrlCandidate(
    candidates,
    "creative.object_story_spec.video_data.call_to_action.value.link",
    videoData?.call_to_action?.value?.link,
  );
  addUrlCandidate(candidates, "creative.link_url", ad.creative?.link_url);
  addUrlCandidate(candidates, "creative.object_url", ad.creative?.object_url);

  for (const [index, linkUrl] of (ad.creative?.asset_feed_spec?.link_urls ?? []).entries()) {
    addUrlCandidate(candidates, `creative.asset_feed_spec.link_urls.${index}.website_url`, linkUrl.website_url);
    addUrlCandidate(candidates, `creative.asset_feed_spec.link_urls.${index}.display_url`, linkUrl.display_url);
  }

  return candidates;
};

const mergeUrlTags = (inputs: Array<Record<string, string> | null>) => {
  const merged: Record<string, string> = {};
  for (const input of inputs) {
    if (!input) continue;
    for (const [key, value] of Object.entries(input)) {
      if (!merged[key]) merged[key] = value;
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
};

const toNumber = (value: string | number | undefined | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current?.startsWith("--")) continue;
    const key = current.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
};

const resolveDateRange = (args: Record<string, string>) => {
  const datePreset = args["date-preset"] ?? "last_30d";
  const startDate = args["start-date"]?.trim();
  const endDate = args["end-date"]?.trim();
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new Error("--start-date와 --end-date는 함께 입력해야 함");
    }
    return {
      datePreset: "custom",
      requestedDatePreset: datePreset,
      range: { startDate, endDate },
      customRange: true,
    };
  }

  const range = DATE_PRESETS[datePreset];
  if (!range) {
    throw new Error(`지원하지 않는 date_preset: ${datePreset}`);
  }
  return {
    datePreset,
    requestedDatePreset: datePreset,
    range,
    customRange: false,
  };
};

const buildInsightParams = (
  range: { startDate: string; endDate: string },
  datePreset: string,
  customRange: boolean,
  params: Record<string, string>,
) => ({
  ...params,
  ...(customRange
    ? { time_range: JSON.stringify({ since: range.startDate, until: range.endDate }) }
    : { date_preset: datePreset }),
});

const buildNestedInsightsField = (
  range: { startDate: string; endDate: string },
  datePreset: string,
  customRange: boolean,
) => {
  if (!customRange) return `insights.date_preset(${datePreset}){impressions,clicks,spend}`;
  return `insights.time_range({"since":"${range.startDate}","until":"${range.endDate}"}){impressions,clicks,spend}`;
};

const fetchMeta = async <T>(resourcePath: string, params: Record<string, string>) => {
  const token = process.env.META_ADMANAGER_API_KEY?.trim() ?? "";
  if (!token) {
    throw new Error("META_ADMANAGER_API_KEY 미설정");
  }

  const url = new URL(`${META_GRAPH_URL}${resourcePath}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  const body = await response.json() as { data?: T; error?: { message?: string } };
  if (body.error) {
    throw new Error(body.error.message || "Meta API error");
  }
  return body.data as T;
};

const summarizeActionValue = (
  values: Array<{ action_type: string; value: string }> | undefined,
  actionType: string,
) => values?.find((item) => item.action_type === actionType)?.value ?? "0";

const buildAliasCandidates = (
  orders: NormalizedOrder[],
  site: SiteKey,
  startDate: string,
  endDate: string,
) => {
  const grouped = new Map<string, { confirmedOrders: number; confirmedRevenue: number; pendingOrders: number; pendingRevenue: number; canceledOrders: number; canceledRevenue: number }>();

  for (const order of orders) {
    if (order.site !== site) continue;
    if (!isMetaAttributedOrder(order)) continue;
    if (!order.approvedDate || order.approvedDate < startDate || order.approvedDate > endDate) continue;
    const key = order.utmCampaign || "(blank)";
    const bucket = grouped.get(key) ?? {
      confirmedOrders: 0,
      confirmedRevenue: 0,
      pendingOrders: 0,
      pendingRevenue: 0,
      canceledOrders: 0,
      canceledRevenue: 0,
    };
    if (order.paymentStatus === "confirmed") {
      bucket.confirmedOrders += 1;
      bucket.confirmedRevenue += order.amount ?? 0;
    } else if (order.paymentStatus === "pending") {
      bucket.pendingOrders += 1;
      bucket.pendingRevenue += order.amount ?? 0;
    } else if (order.paymentStatus === "canceled") {
      bucket.canceledOrders += 1;
      bucket.canceledRevenue += order.amount ?? 0;
    }
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .map(([utmCampaign, metrics]) => ({
      utmCampaign,
      ...metrics,
      totalOrders: metrics.confirmedOrders + metrics.pendingOrders + metrics.canceledOrders,
      totalRevenue: metrics.confirmedRevenue + metrics.pendingRevenue + metrics.canceledRevenue,
    }))
    .sort((left, right) => right.confirmedRevenue - left.confirmedRevenue || right.totalRevenue - left.totalRevenue);
};

const buildOutputPath = (site: SiteKey) =>
  path.resolve(REPO_ROOT, "data", `meta_campaign_alias_audit.${site}.json`);

const buildUrlEvidenceOutputPath = (site: SiteKey) =>
  path.resolve(REPO_ROOT, "meta", `campaign-url-evidence.${site}.json`);

async function main() {
  const args = parseArgs();
  const site = (args.site as SiteKey | undefined) ?? "biocom";
  const { datePreset, requestedDatePreset, range, customRange } = resolveDateRange(args);
  const config = SITE_CONFIGS[site];
  if (!config) {
    throw new Error(`지원하지 않는 site: ${site}`);
  }

  const [campaignInsights, adsets, entries] = await Promise.all([
    fetchMeta<MetaInsight[]>(`/${config.accountId}/insights`, buildInsightParams(range, requestedDatePreset, customRange, {
      fields: "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values",
      level: "campaign",
      limit: "100",
    })),
    fetchMeta<MetaAdset[]>(`/${config.accountId}/adsets`, {
      fields: "id,campaign_id,name,status,attribution_spec,optimization_goal,promoted_object",
      limit: "200",
    }),
    readLedgerEntries(),
  ]);

  const orders = buildNormalizedLedgerOrders(entries);
  const aliasCandidates = buildAliasCandidates(orders, site, range.startDate, range.endDate);

  const campaignMap = new Map<string, {
    campaignId: string;
    campaignName: string;
    spend: number;
    purchases: number;
    purchaseValue: number;
    impressions: number;
    clicks: number;
    adsets: Array<{
      adsetId: string;
      adsetName: string;
      status: string;
      optimizationGoal: string;
      promotedObject: {
        pixelId: string | null;
        pageId: string | null;
        customEventType: string | null;
      };
      attributionSpec: Array<{
        eventType: string | null;
        windowDays: number | null;
      }>;
      ads: Array<{
        adId: string;
        adName: string;
        status: string;
        creativeId: string | null;
        creativeName: string | null;
        objectStoryId: string | null;
        effectiveObjectStoryId: string | null;
        instagramPermalinkUrl: string | null;
        landingUrl: string | null;
        urlTags: string | null;
        extractedUrlTags: Record<string, string> | null;
        title: string | null;
        body: string | null;
        objectType: string | null;
        spend: number;
        clicks: number;
        impressions: number;
      }>;
    }>;
  }>();

  for (const row of campaignInsights) {
    campaignMap.set(row.campaign_id, {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name || row.campaign_id,
      spend: toNumber(row.spend),
      purchases: toNumber(summarizeActionValue(row.actions, "purchase")),
      purchaseValue: toNumber(summarizeActionValue(row.action_values, "purchase")),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      adsets: [],
    });
  }

  for (const adset of adsets) {
    const insightsField = buildNestedInsightsField(range, requestedDatePreset, customRange);
    const ads = await fetchMeta<MetaAd[]>(`/${adset.id}/ads`, {
      fields: `id,name,status,url_tags,creative{id,name,object_story_id,effective_object_story_id,object_url,link_url,url_tags,instagram_permalink_url,title,body,object_type,video_id,asset_feed_spec,object_story_spec},${insightsField}`,
      limit: "50",
    });
    const campaign = campaignMap.get(adset.campaign_id);
    if (!campaign) continue;

    campaign.adsets.push({
      adsetId: adset.id,
      adsetName: adset.name,
      status: adset.status ?? "",
      optimizationGoal: adset.optimization_goal ?? "",
      promotedObject: {
        pixelId: adset.promoted_object?.pixel_id ?? null,
        pageId: adset.promoted_object?.page_id ?? null,
        customEventType: adset.promoted_object?.custom_event_type ?? null,
      },
      attributionSpec: (adset.attribution_spec ?? []).map((spec) => ({
        eventType: spec.event_type ?? null,
        windowDays: typeof spec.window_days === "number" ? spec.window_days : null,
      })),
      ads: ads.map((ad) => {
        const insight = ad.insights?.data?.[0];
        const urlCandidates = collectUrlCandidates(ad);
        const landingUrl = urlCandidates[0]?.url ?? null;
        const extractedUrlTags = mergeUrlTags([
          extractUrlTags(ad.url_tags ?? null),
          extractUrlTags(ad.creative?.url_tags ?? null),
          ...urlCandidates.map((candidate) => extractUrlTags(candidate.url)),
          ...(ad.creative?.asset_feed_spec?.link_urls ?? [])
            .map((linkUrl) => extractUrlTags(linkUrl.url_tags ?? null)),
        ]);
        return {
          adId: ad.id,
          adName: ad.name,
          status: ad.status ?? "",
          creativeId: ad.creative?.id ?? null,
          creativeName: ad.creative?.name ?? null,
          objectStoryId: ad.creative?.object_story_id ?? null,
          effectiveObjectStoryId: ad.creative?.effective_object_story_id ?? null,
          instagramPermalinkUrl: ad.creative?.instagram_permalink_url ?? null,
          landingUrl,
          landingUrlSource: urlCandidates[0]?.source ?? null,
          urlCandidates,
          urlTags: ad.url_tags ?? null,
          creativeUrlTags: ad.creative?.url_tags ?? null,
          extractedUrlTags,
          matchedUtmCampaign: extractedUrlTags?.utm_campaign ?? null,
          title: ad.creative?.title ?? null,
          body: ad.creative?.body ?? null,
          objectType: ad.creative?.object_type ?? null,
          spend: toNumber(insight?.spend),
          clicks: toNumber(insight?.clicks),
          impressions: toNumber(insight?.impressions),
        };
      }),
    });
  }

  const campaigns = [...campaignMap.values()].sort((left, right) => right.spend - left.spend);
  const audit = {
    generatedAt: new Date().toISOString(),
    site,
    accountId: config.accountId,
    datePreset,
    requestedDatePreset,
    range,
    metaDateParams: customRange
      ? { time_range: { since: range.startDate, until: range.endDate } }
      : { date_preset: requestedDatePreset },
    ledgerDateRange: range,
    summary: {
      campaigns: campaigns.length,
      adsets: campaigns.reduce((sum, campaign) => sum + campaign.adsets.length, 0),
      ads: campaigns.reduce((sum, campaign) => (
        sum + campaign.adsets.reduce((inner, adset) => inner + adset.ads.length, 0)
      ), 0),
      aliasCandidates: aliasCandidates.length,
      adsWithLandingUrl: campaigns.reduce((sum, campaign) => (
        sum + campaign.adsets.reduce((inner, adset) => (
          inner + adset.ads.filter((ad) => Boolean(ad.landingUrl)).length
        ), 0)
      ), 0),
      adsWithUrlTags: campaigns.reduce((sum, campaign) => (
        sum + campaign.adsets.reduce((inner, adset) => (
          inner + adset.ads.filter((ad) => Boolean(ad.urlTags || ad.extractedUrlTags)).length
        ), 0)
      ), 0),
    },
    aliasCandidates,
    campaigns,
  };

  const urlEvidence = {
    generatedAt: audit.generatedAt,
    site,
    accountId: config.accountId,
    datePreset,
    requestedDatePreset,
    range,
    summary: {
      rows: campaigns.reduce((sum, campaign) => (
        sum + campaign.adsets.reduce((inner, adset) => inner + adset.ads.length, 0)
      ), 0),
      rowsWithLandingUrl: audit.summary.adsWithLandingUrl,
      rowsWithTrackingTags: audit.summary.adsWithUrlTags,
      rowsWithMatchedUtmCampaign: campaigns.reduce((sum, campaign) => (
        sum + campaign.adsets.reduce((inner, adset) => (
          inner + adset.ads.filter((ad) => Boolean(ad.matchedUtmCampaign)).length
        ), 0)
      ), 0),
    },
    rows: campaigns.flatMap((campaign) => campaign.adsets.flatMap((adset) => (
      adset.ads.map((ad) => ({
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        adsetId: adset.adsetId,
        adsetName: adset.adsetName,
        adId: ad.adId,
        adName: ad.adName,
        status: ad.status,
        creativeId: ad.creativeId,
        creativeName: ad.creativeName,
        objectStoryId: ad.objectStoryId,
        effectiveObjectStoryId: ad.effectiveObjectStoryId,
        instagramPermalinkUrl: ad.instagramPermalinkUrl,
        spend: ad.spend,
        clicks: ad.clicks,
        impressions: ad.impressions,
        landingUrl: ad.landingUrl,
        landingUrlSource: ad.landingUrlSource,
        urlCandidates: ad.urlCandidates,
        urlTags: ad.urlTags,
        creativeUrlTags: ad.creativeUrlTags,
        extractedUrlTags: ad.extractedUrlTags,
        matchedAliasKey: ad.matchedUtmCampaign,
        confidence: ad.matchedUtmCampaign ? "url_utm_match" : "needs_manual_review",
        reason: ad.matchedUtmCampaign
          ? "광고 creative URL 또는 url_tags에서 utm_campaign을 추출함"
          : "Meta API 응답에서 utm_campaign을 확인하지 못함",
      }))
    ))),
  };

  const outputPath = buildOutputPath(site);
  const urlEvidenceOutputPath = buildUrlEvidenceOutputPath(site);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(urlEvidenceOutputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(urlEvidenceOutputPath, `${JSON.stringify(urlEvidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    outputPath,
    urlEvidenceOutputPath,
    summary: audit.summary,
    urlEvidenceSummary: urlEvidence.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
