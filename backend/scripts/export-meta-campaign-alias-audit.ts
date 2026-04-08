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
    thumbnail_url?: string;
    image_url?: string;
    title?: string;
    body?: string;
    object_type?: string;
    video_id?: string;
    link_url?: string;
    object_story_spec?: {
      link_data?: {
        link?: string;
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

const SITE_CONFIGS: Record<SiteKey, SiteConfig> = {
  biocom: { site: "biocom", accountId: "act_3138805896402376" },
  thecleancoffee: { site: "thecleancoffee", accountId: "act_1382574315626662" },
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

const extractUrlTags = (input: string | null) => {
  if (!input) return null;
  try {
    const url = new URL(input);
    const tags = Object.fromEntries(
      [...url.searchParams.entries()].filter(([key]) =>
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

async function main() {
  const args = parseArgs();
  const site = (args.site as SiteKey | undefined) ?? "biocom";
  const datePreset = args["date-preset"] ?? "last_30d";
  const config = SITE_CONFIGS[site];
  if (!config) {
    throw new Error(`지원하지 않는 site: ${site}`);
  }
  const range = DATE_PRESETS[datePreset];
  if (!range) {
    throw new Error(`지원하지 않는 date_preset: ${datePreset}`);
  }

  const [campaignInsights, adsets, entries] = await Promise.all([
    fetchMeta<MetaInsight[]>(`/${config.accountId}/insights`, {
      fields: "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values",
      date_preset: datePreset,
      level: "campaign",
      limit: "100",
    }),
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
    const ads = await fetchMeta<MetaAd[]>(`/${adset.id}/ads`, {
      fields: `id,name,status,url_tags,creative{id,link_url,title,body,object_type,video_id,object_story_spec},insights.date_preset(${datePreset}){impressions,clicks,spend}`,
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
        const linkData = ad.creative?.object_story_spec?.link_data;
        const videoData = ad.creative?.object_story_spec?.video_data;
        const landingUrl = firstNonEmpty([
          linkData?.link,
          linkData?.call_to_action?.value?.link,
          videoData?.call_to_action?.value?.link,
          ad.creative?.link_url,
        ]) || null;
        return {
          adId: ad.id,
          adName: ad.name,
          status: ad.status ?? "",
          creativeId: ad.creative?.id ?? null,
          landingUrl,
          urlTags: ad.url_tags ?? null,
          extractedUrlTags: extractUrlTags(landingUrl),
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
    range,
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

  const outputPath = buildOutputPath(site);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, summary: audit.summary }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
