/**
 * TheCleanCoffee Naver Ads campaign allowlist dry-run.
 *
 * This script never writes SQLite and never changes Naver Ads state.
 * It only reads campaigns/stats and proposes a campaign allowlist.
 */
import { getDailyStats, isNaverAdsConfigured, listCampaigns } from "../src/naverAdsClient";

type CliOptions = {
  site: string;
  since: string;
  until: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  allowlistIds: string[];
  delayMs: number;
  json: boolean;
};

type CampaignStats = {
  nccCampaignId: string;
  campaignName: string;
  campaignTp: string;
  status: string;
  matchedKeywords: string[];
  excludedKeywords: string[];
  recommendation: "allowlist_candidate" | "excluded_by_keyword" | "not_matched";
  days: number;
  impCnt: number;
  clkCnt: number;
  spendKrw: number;
  convAmtKrwNaverClaim: number;
};

const SCHEMA_VERSION = "reportcoffee-naver-ads-campaign-allowlist-dry-run-v1-20260522";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86400000;

const defaultIncludeKeywords = ["더클린커피", "클린커피", "thecleancoffee", "clean coffee"];
const defaultExcludeKeywords = ["바이오컴", "biocom", "aibio", "아이바이오"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const todayKst = () => new Date(Date.now() + KST_OFFSET_MS);

const formatKstDateFromTodayOffset = (offsetDays: number): string => {
  return new Date(Date.now() + KST_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
};

const generatedAtKst = (): string => {
  const d = todayKst();
  return d.toISOString().replace("T", " ").slice(0, 19) + " KST";
};

const fmtKrw = (value: number): string => `${Math.round(value).toLocaleString("ko-KR")}원`;

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const usage = () => `
Usage:
  npx tsx scripts/reportcoffee-naver-ads-campaign-allowlist-dry-run.ts [options]

Default:
  no-write dry-run for rolling 30 complete KST days ending yesterday.

Options:
  --site=thecleancoffee
  --since=YYYY-MM-DD
  --until=YYYY-MM-DD
  --include-keywords=더클린커피,클린커피,thecleancoffee
  --exclude-keywords=바이오컴,biocom,aibio
  --allowlist-ids=cmp-a...,cmp-b...  Optional exact id filter for already approved campaigns
  --delay-ms=100
  --json
`;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    site: "thecleancoffee",
    since: formatKstDateFromTodayOffset(30),
    until: formatKstDateFromTodayOffset(1),
    includeKeywords: defaultIncludeKeywords,
    excludeKeywords: defaultExcludeKeywords,
    allowlistIds: [],
    delayMs: 150,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--site=")) {
      options.site = arg.slice("--site=".length).trim() || options.site;
      continue;
    }
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
      continue;
    }
    if (arg.startsWith("--include-keywords=")) {
      options.includeKeywords = splitCsv(arg.slice("--include-keywords=".length));
      continue;
    }
    if (arg.startsWith("--exclude-keywords=")) {
      options.excludeKeywords = splitCsv(arg.slice("--exclude-keywords=".length));
      continue;
    }
    if (arg.startsWith("--allowlist-ids=")) {
      options.allowlistIds = splitCsv(arg.slice("--allowlist-ids=".length));
      continue;
    }
    if (arg.startsWith("--delay-ms=")) {
      const parsed = Number(arg.slice("--delay-ms=".length));
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--delay-ms must be a non-negative integer");
      }
      options.delayMs = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!isDateString(options.since) || !isDateString(options.until)) {
    throw new Error("since/until must be YYYY-MM-DD");
  }
  if (options.since > options.until) {
    throw new Error("since must be earlier than or equal to until");
  }
  return options;
};

const findKeywordMatches = (name: string, keywords: string[]): string[] => {
  const lower = name.toLocaleLowerCase("ko-KR");
  return keywords.filter((keyword) => lower.includes(keyword.toLocaleLowerCase("ko-KR")));
};

const makeRecommendation = (input: {
  matchedKeywords: string[];
  excludedKeywords: string[];
  allowlistIds: string[];
  campaignId: string;
}): CampaignStats["recommendation"] => {
  if (input.excludedKeywords.length > 0) return "excluded_by_keyword";
  if (input.allowlistIds.length > 0) {
    return input.allowlistIds.includes(input.campaignId) ? "allowlist_candidate" : "not_matched";
  }
  return input.matchedKeywords.length > 0 ? "allowlist_candidate" : "not_matched";
};

const emptyStats = {
  days: 0,
  impCnt: 0,
  clkCnt: 0,
  spendKrw: 0,
  convAmtKrwNaverClaim: 0,
};

const collectCampaignStats = async (
  options: CliOptions,
  campaign: {
    nccCampaignId: string;
    name: string;
    campaignTp: string;
    status: string;
  },
): Promise<CampaignStats & { readOk: boolean; readError?: string; readStatus?: number }> => {
  const matchedKeywords = findKeywordMatches(campaign.name, options.includeKeywords);
  const excludedKeywords = findKeywordMatches(campaign.name, options.excludeKeywords);
  const recommendation = makeRecommendation({
    matchedKeywords,
    excludedKeywords,
    allowlistIds: options.allowlistIds,
    campaignId: campaign.nccCampaignId,
  });

  const base = {
    nccCampaignId: campaign.nccCampaignId,
    campaignName: campaign.name,
    campaignTp: campaign.campaignTp,
    status: campaign.status,
    matchedKeywords,
    excludedKeywords,
    recommendation,
  };

  const stats = await getDailyStats({
    campaignId: campaign.nccCampaignId,
    since: options.since,
    until: options.until,
  });
  if (!stats.ok) {
    return {
      ...base,
      ...emptyStats,
      readOk: false,
      readStatus: stats.status,
      readError: stats.error.slice(0, 180),
    };
  }

  const totals = stats.daily.data.reduce(
    (sum, row) => ({
      days: sum.days + 1,
      impCnt: sum.impCnt + (Number(row.impCnt) || 0),
      clkCnt: sum.clkCnt + (Number(row.clkCnt) || 0),
      spendKrw: sum.spendKrw + Math.round(Number(row.salesAmt) || 0),
      convAmtKrwNaverClaim: sum.convAmtKrwNaverClaim + Math.round(Number(row.convAmt) || 0),
    }),
    { ...emptyStats },
  );

  return {
    ...base,
    ...totals,
    readOk: true,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const configured = isNaverAdsConfigured();

  if (!configured) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          schema_version: SCHEMA_VERSION,
          mode: "dry_run_no_write",
          generated_at_kst: generatedAtKst(),
          site: options.site,
          configured,
          error: "BIOCOM_NAVER_ADS_* env is not configured",
          invariants_held: {
            sqlite_write: 0,
            naver_ads_state_change: 0,
            external_send_count: 0,
            raw_secret_logged: false,
          },
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  if (!options.json) {
    console.log(`mode=dry_run_no_write site=${options.site} window=${options.since} - ${options.until}`);
  }

  const campaignsResult = await listCampaigns();
  if (!campaignsResult.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          schema_version: SCHEMA_VERSION,
          mode: "dry_run_no_write",
          generated_at_kst: generatedAtKst(),
          site: options.site,
          configured,
          error: "listCampaigns failed",
          status: campaignsResult.status,
          message: campaignsResult.error,
          invariants_held: {
            sqlite_write: 0,
            naver_ads_state_change: 0,
            external_send_count: 0,
            raw_secret_logged: false,
          },
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const results: Array<CampaignStats & { readOk: boolean; readError?: string; readStatus?: number }> = [];
  for (let i = 0; i < campaignsResult.campaigns.length; i += 1) {
    const campaign = campaignsResult.campaigns[i];
    results.push(await collectCampaignStats(options, campaign));
    if (!options.json && ((i + 1) % 10 === 0 || i + 1 === campaignsResult.campaigns.length)) {
      console.log(`progress=${i + 1}/${campaignsResult.campaigns.length}`);
    }
    if (i + 1 < campaignsResult.campaigns.length && options.delayMs > 0) {
      await wait(options.delayMs);
    }
  }

  const candidates = results
    .filter((row) => row.recommendation === "allowlist_candidate")
    .sort((a, b) => b.spendKrw - a.spendKrw || a.campaignName.localeCompare(b.campaignName, "ko-KR"));
  const excluded = results.filter((row) => row.recommendation === "excluded_by_keyword");
  const notMatched = results.filter((row) => row.recommendation === "not_matched");
  const readFailures = results.filter((row) => !row.readOk);
  const candidateSpend = candidates.reduce((sum, row) => sum + row.spendKrw, 0);
  const accountSpend = results.reduce((sum, row) => sum + row.spendKrw, 0);
  const candidateClicks = candidates.reduce((sum, row) => sum + row.clkCnt, 0);
  const allCandidatesPausedOrDeleted = candidates.every((row) => !["ELIGIBLE", "RUNNING"].includes(row.status));
  const candidateStatus = candidates.length === 0
    ? "no_candidate"
    : candidateSpend === 0 && candidateClicks === 0 && allCandidatesPausedOrDeleted
      ? "zero_spend_candidate_all_inactive"
      : "needs_review_before_cache_write";

  const out = {
    ok: readFailures.length === 0,
    schema_version: SCHEMA_VERSION,
    mode: "dry_run_no_write",
    generated_at_kst: generatedAtKst(),
    site: options.site,
    configured,
    window: {
      since: options.since,
      until: options.until,
      timezone: "KST date labels",
    },
    filters: {
      include_keywords: options.includeKeywords,
      exclude_keywords: options.excludeKeywords,
      exact_allowlist_ids_used: options.allowlistIds.length > 0,
      allowlist_ids_count: options.allowlistIds.length,
    },
    summary: {
      campaigns_total: results.length,
      allowlist_candidates: candidates.length,
      excluded_by_keyword: excluded.length,
      not_matched: notMatched.length,
      read_failures: readFailures.length,
      account_total_spend_krw: accountSpend,
      account_total_spend_text: fmtKrw(accountSpend),
      candidate_spend_krw: candidateSpend,
      candidate_spend_text: fmtKrw(candidateSpend),
      candidate_clicks: candidateClicks,
      non_candidate_spend_krw: accountSpend - candidateSpend,
      candidate_status: candidateStatus,
      recommendation:
        candidateStatus === "zero_spend_candidate_all_inactive"
          ? "Naver spend can be shown as 0 candidate, but cache write still needs allowlist approval."
          : "Do not write thecleancoffee cache until candidates are reviewed.",
    },
    proposed_allowlist: candidates.map((row) => ({
      ncc_campaign_id: row.nccCampaignId,
      campaign_name: row.campaignName,
      campaign_tp: row.campaignTp,
      status: row.status,
      matched_keywords: row.matchedKeywords,
      days: row.days,
      impressions: row.impCnt,
      clicks: row.clkCnt,
      spend_krw: row.spendKrw,
      spend_text: fmtKrw(row.spendKrw),
      naver_claim_conversion_value_krw: row.convAmtKrwNaverClaim,
    })),
    excluded_samples: excluded.slice(0, 10).map((row) => ({
      campaign_name: row.campaignName,
      status: row.status,
      excluded_keywords: row.excludedKeywords,
      spend_krw: row.spendKrw,
    })),
    top_non_candidate_spend: notMatched
      .filter((row) => row.spendKrw > 0)
      .sort((a, b) => b.spendKrw - a.spendKrw)
      .slice(0, 5)
      .map((row) => ({
        campaign_name: row.campaignName,
        status: row.status,
        spend_krw: row.spendKrw,
        reason: "not matched by coffee include keywords",
      })),
    read_failures: readFailures.slice(0, 10).map((row) => ({
      campaign_name: row.campaignName,
      status: row.readStatus,
      error: row.readError,
    })),
    invariants_held: {
      sqlite_write: 0,
      naver_ads_state_change: 0,
      external_send_count: 0,
      platform_conversion_send: 0,
      raw_secret_logged: false,
      internal_revenue_from_naver_conv_amt: 0,
    },
  };

  console.log(JSON.stringify(out, null, 2));
  if (readFailures.length > 0) process.exit(3);
};

main().catch((error) => {
  console.error("allowlist dry-run failed", error);
  process.exit(1);
});
