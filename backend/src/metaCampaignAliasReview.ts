import { promises as fs } from "fs";
import path from "path";

export type AliasReviewSite = "biocom" | "thecleancoffee" | "aibio";
export type AliasReviewDecision = "yes" | "no";

type AliasAuditCandidate = {
  utmCampaign: string;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
  totalOrders: number;
  totalRevenue: number;
};

type AliasAuditAd = {
  adId: string;
  adName: string;
  landingUrl: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  status: string;
};

type AliasAuditAdset = {
  adsetId: string;
  adsetName: string;
  status: string;
  ads: AliasAuditAd[];
};

type AliasAuditCampaign = {
  campaignId: string;
  campaignName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  adsets: AliasAuditAdset[];
};

type AliasAuditFile = {
  site: AliasReviewSite;
  generatedAt: string;
  campaigns: AliasAuditCampaign[];
  aliasCandidates: AliasAuditCandidate[];
};

type AliasSeedEntry = {
  site: AliasReviewSite;
  channel: string;
  alias_key: string;
  status: string;
  family_hint?: string;
  candidate_campaign_ids?: string[];
  candidate_campaign_names?: string[];
  valid_from?: string | null;
  valid_to?: string | null;
  confidence?: string;
  review_reason?: string;
  evidence?: {
    confirmed_orders?: number;
    confirmed_revenue?: number;
  };
  selected_campaign_id?: string | null;
  selected_campaign_name?: string | null;
  reviewed_at?: string | null;
  rejected_campaign_ids?: string[];
};

export type AliasReviewCandidateSummary = {
  campaignId: string;
  campaignName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  activeAdsets: number;
  activeAds: number;
  landingUrlExamples: string[];
  adsetSamples: string[];
  adSamples: string[];
  selected: boolean;
  rejected: boolean;
};

export type AliasReviewItem = {
  aliasKey: string;
  site: AliasReviewSite;
  status: string;
  confidence: string;
  familyHint: string;
  reviewReason: string;
  validFrom: string | null;
  validTo: string | null;
  reviewedAt: string | null;
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  rejectedCampaignIds: string[];
  evidence: {
    confirmedOrders: number;
    confirmedRevenue: number;
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRevenue: number;
    totalOrders: number;
    totalRevenue: number;
  };
  candidates: AliasReviewCandidateSummary[];
};

export type AliasReviewResponse = {
  site: AliasReviewSite;
  generatedAt: string;
  summary: {
    totalAliases: number;
    pendingReview: number;
    manualVerified: number;
    rejectedAll: number;
  };
  items: AliasReviewItem[];
};

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const SUPPORTED_SITES = new Set<AliasReviewSite>(["biocom", "thecleancoffee", "aibio"]);

const round2 = (value: number) => Number(value.toFixed(2));

const ensureSite = (site: string): AliasReviewSite => {
  if (!SUPPORTED_SITES.has(site as AliasReviewSite)) {
    throw new Error(`지원하지 않는 site: ${site}`);
  }
  return site as AliasReviewSite;
};

const auditPathForSite = (site: AliasReviewSite) =>
  path.resolve(DATA_DIR, `meta_campaign_alias_audit.${site}.json`);

const seedPathForSite = (site: AliasReviewSite) =>
  path.resolve(DATA_DIR, `meta_campaign_aliases.${site}.json`);

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) return fallback;
    throw error;
  }
};

const writeJsonFile = async (filePath: string, value: unknown) => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const loadAudit = async (site: AliasReviewSite) =>
  readJsonFile<AliasAuditFile>(auditPathForSite(site), {
    site,
    generatedAt: "",
    campaigns: [],
    aliasCandidates: [],
  });

const loadSeed = async (site: AliasReviewSite) =>
  readJsonFile<AliasSeedEntry[]>(seedPathForSite(site), []);

const collectLandingUrls = (campaign: AliasAuditCampaign) => {
  const urls = new Set<string>();
  for (const adset of campaign.adsets) {
    for (const ad of adset.ads) {
      const landingUrl = typeof ad.landingUrl === "string" ? ad.landingUrl.trim() : "";
      if (landingUrl) urls.add(landingUrl);
      if (urls.size >= 3) return [...urls];
    }
  }
  return [...urls];
};

const collectAdsetSamples = (campaign: AliasAuditCampaign) => campaign.adsets
  .slice()
  .sort((a, b) => {
    const aSpend = a.ads.reduce((sum, ad) => sum + ad.spend, 0);
    const bSpend = b.ads.reduce((sum, ad) => sum + ad.spend, 0);
    return bSpend - aSpend || b.ads.length - a.ads.length;
  })
  .slice(0, 3)
  .map((adset) => adset.adsetName);

const collectAdSamples = (campaign: AliasAuditCampaign) => campaign.adsets
  .flatMap((adset) => adset.ads)
  .slice()
  .sort((a, b) => b.spend - a.spend || b.clicks - a.clicks || b.impressions - a.impressions)
  .slice(0, 4)
  .map((ad) => ad.adName);

const buildCandidateSummary = (
  campaign: AliasAuditCampaign,
  selectedCampaignId: string | null,
  rejectedCampaignIds: Set<string>,
): AliasReviewCandidateSummary => ({
  campaignId: campaign.campaignId,
  campaignName: campaign.campaignName,
  spend: round2(campaign.spend),
  purchases: campaign.purchases,
  purchaseValue: round2(campaign.purchaseValue),
  impressions: campaign.impressions,
  clicks: campaign.clicks,
  activeAdsets: campaign.adsets.filter((adset) => adset.status === "ACTIVE").length,
  activeAds: campaign.adsets.flatMap((adset) => adset.ads).filter((ad) => ad.status === "ACTIVE").length,
  landingUrlExamples: collectLandingUrls(campaign),
  adsetSamples: collectAdsetSamples(campaign),
  adSamples: collectAdSamples(campaign),
  selected: selectedCampaignId === campaign.campaignId,
  rejected: rejectedCampaignIds.has(campaign.campaignId),
});

const buildReviewItem = (params: {
  site: AliasReviewSite;
  audit: AliasAuditFile;
  seedEntry: AliasSeedEntry | null;
  aliasCandidate: AliasAuditCandidate | null;
}): AliasReviewItem => {
  const aliasKey = params.seedEntry?.alias_key ?? params.aliasCandidate?.utmCampaign ?? "";
  const selectedCampaignId = params.seedEntry?.selected_campaign_id ?? null;
  const rejectedCampaignIds = new Set(params.seedEntry?.rejected_campaign_ids ?? []);
  const candidateIds = params.seedEntry?.candidate_campaign_ids ?? [];
  const candidateCampaigns = candidateIds
    .map((campaignId) => params.audit.campaigns.find((campaign) => campaign.campaignId === campaignId))
    .filter((campaign): campaign is AliasAuditCampaign => Boolean(campaign));
  const seedEvidence = params.seedEntry?.evidence;
  const auditEvidence = params.aliasCandidate;

  return {
    aliasKey,
    site: params.site,
    status: params.seedEntry?.status ?? "needs_manual_review",
    confidence: params.seedEntry?.confidence ?? "needs_manual_review",
    familyHint: params.seedEntry?.family_hint ?? "",
    reviewReason: params.seedEntry?.review_reason ?? "수동 검토 필요",
    validFrom: params.seedEntry?.valid_from ?? null,
    validTo: params.seedEntry?.valid_to ?? null,
    reviewedAt: params.seedEntry?.reviewed_at ?? null,
    selectedCampaignId,
    selectedCampaignName: params.seedEntry?.selected_campaign_name ?? null,
    rejectedCampaignIds: [...rejectedCampaignIds],
    evidence: {
      confirmedOrders: auditEvidence?.confirmedOrders ?? seedEvidence?.confirmed_orders ?? 0,
      confirmedRevenue: auditEvidence?.confirmedRevenue ?? seedEvidence?.confirmed_revenue ?? 0,
      pendingOrders: auditEvidence?.pendingOrders ?? 0,
      pendingRevenue: auditEvidence?.pendingRevenue ?? 0,
      canceledOrders: auditEvidence?.canceledOrders ?? 0,
      canceledRevenue: auditEvidence?.canceledRevenue ?? 0,
      totalOrders: auditEvidence?.totalOrders ?? 0,
      totalRevenue: auditEvidence?.totalRevenue ?? 0,
    },
    candidates: candidateCampaigns.map((campaign) =>
      buildCandidateSummary(campaign, selectedCampaignId, rejectedCampaignIds)),
  };
};

const compareReviewItems = (a: AliasReviewItem, b: AliasReviewItem) => {
  const priority = (status: string) => {
    if (status === "needs_manual_review") return 0;
    if (status === "manual_verified") return 1;
    if (status === "rejected_all_candidates") return 2;
    return 3;
  };

  return priority(a.status) - priority(b.status)
    || b.evidence.confirmedRevenue - a.evidence.confirmedRevenue
    || b.evidence.confirmedOrders - a.evidence.confirmedOrders
    || a.aliasKey.localeCompare(b.aliasKey);
};

export const loadAliasReviewItems = async (siteInput: string): Promise<AliasReviewResponse> => {
  const site = ensureSite(siteInput);
  const [audit, seedEntries] = await Promise.all([loadAudit(site), loadSeed(site)]);
  const aliasCandidateByKey = new Map(audit.aliasCandidates.map((item) => [item.utmCampaign, item]));
  const seedEntryByKey = new Map(seedEntries.map((item) => [item.alias_key, item]));
  const aliasKeys = new Set<string>([
    ...aliasCandidateByKey.keys(),
    ...seedEntryByKey.keys(),
  ]);

  const items = [...aliasKeys]
    .map((aliasKey) => buildReviewItem({
      site,
      audit,
      seedEntry: seedEntryByKey.get(aliasKey) ?? null,
      aliasCandidate: aliasCandidateByKey.get(aliasKey) ?? null,
    }))
    .sort(compareReviewItems);

  return {
    site,
    generatedAt: audit.generatedAt,
    summary: {
      totalAliases: items.length,
      pendingReview: items.filter((item) => item.status === "needs_manual_review").length,
      manualVerified: items.filter((item) => item.status === "manual_verified").length,
      rejectedAll: items.filter((item) => item.status === "rejected_all_candidates").length,
    },
    items,
  };
};

export const applyAliasReviewDecision = async (params: {
  site: string;
  aliasKey: string;
  campaignId: string;
  decision: AliasReviewDecision;
}) => {
  const site = ensureSite(params.site);
  const aliasKey = params.aliasKey.trim();
  const campaignId = params.campaignId.trim();
  if (!aliasKey) throw new Error("aliasKey 필요");
  if (!campaignId) throw new Error("campaignId 필요");

  const [audit, seedEntries] = await Promise.all([loadAudit(site), loadSeed(site)]);
  const aliasCandidate = audit.aliasCandidates.find((item) => item.utmCampaign === aliasKey);
  const campaign = audit.campaigns.find((item) => item.campaignId === campaignId);
  if (!campaign) throw new Error(`campaignId not found in audit: ${campaignId}`);

  const seedIndex = seedEntries.findIndex((item) => item.alias_key === aliasKey);
  const current = seedIndex >= 0 ? seedEntries[seedIndex] : null;
  const next: AliasSeedEntry = current ?? {
    site,
    channel: "meta",
    alias_key: aliasKey,
    status: "needs_manual_review",
    family_hint: "",
    candidate_campaign_ids: [campaignId],
    candidate_campaign_names: [campaign.campaignName],
    valid_from: null,
    valid_to: null,
    confidence: "needs_manual_review",
    review_reason: "UI에서 수동 생성된 alias review row",
    evidence: {
      confirmed_orders: aliasCandidate?.confirmedOrders ?? 0,
      confirmed_revenue: aliasCandidate?.confirmedRevenue ?? 0,
    },
  };

  const candidateIds = new Set(next.candidate_campaign_ids ?? []);
  const candidateNames = new Map<string, string>(
    (next.candidate_campaign_ids ?? []).map((id, index) => [
      id,
      next.candidate_campaign_names?.[index] ?? "",
    ]),
  );
  candidateIds.add(campaignId);
  candidateNames.set(campaignId, campaign.campaignName);

  const rejectedIds = new Set(next.rejected_campaign_ids ?? []);
  if (params.decision === "yes") {
    rejectedIds.delete(campaignId);
    next.status = "manual_verified";
    next.confidence = "manual_verified";
    next.selected_campaign_id = campaignId;
    next.selected_campaign_name = campaign.campaignName;
  } else {
    rejectedIds.add(campaignId);
    if (next.selected_campaign_id === campaignId) {
      next.selected_campaign_id = null;
      next.selected_campaign_name = null;
    }
    const remainingCandidates = [...candidateIds].filter((id) => !rejectedIds.has(id));
    next.status = remainingCandidates.length > 0
      ? "needs_manual_review"
      : "rejected_all_candidates";
    next.confidence = next.status === "rejected_all_candidates"
      ? "rejected_all_candidates"
      : "needs_manual_review";
  }

  next.candidate_campaign_ids = [...candidateIds];
  next.candidate_campaign_names = next.candidate_campaign_ids.map((id) =>
    candidateNames.get(id) ?? (audit.campaigns.find((item) => item.campaignId === id)?.campaignName ?? id));
  next.rejected_campaign_ids = [...rejectedIds];
  next.reviewed_at = new Date().toISOString();

  if (seedIndex >= 0) {
    seedEntries[seedIndex] = next;
  } else {
    seedEntries.push(next);
  }

  await writeJsonFile(seedPathForSite(site), seedEntries);

  return buildReviewItem({
    site,
    audit,
    seedEntry: next,
    aliasCandidate: aliasCandidate ?? null,
  });
};
