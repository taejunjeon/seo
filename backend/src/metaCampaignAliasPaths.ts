import path from "path";

export const META_CAMPAIGN_ALIAS_DATA_DIR = path.resolve(__dirname, "..", "..", "data");

export const metaCampaignAliasAuditPathForSite = (site: string) =>
  path.resolve(META_CAMPAIGN_ALIAS_DATA_DIR, `meta_campaign_alias_audit.${site}.json`);

export const metaCampaignAliasSeedPathForSite = (site: string) =>
  path.resolve(META_CAMPAIGN_ALIAS_DATA_DIR, `meta_campaign_aliases.${site}.json`);
