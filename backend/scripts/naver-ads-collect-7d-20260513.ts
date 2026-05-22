/**
 * Naver Search Ad daily stats collector/readiness.
 *
 * Default mode is no-write dry-run. SQLite upsert happens only with --write.
 * The old filename is kept because existing docs/routes point to this script.
 */
import { getDailyStats, isNaverAdsConfigured, listCampaigns } from "../src/naverAdsClient";
import {
  bootstrapNaverAdsDailyTable,
  type NaverAdsDailyUpsert,
  upsertNaverAdsDaily,
} from "../src/naverAdsLocalDb";

type CliOptions = {
  site: string;
  since: string;
  until: string;
  dryRun: boolean;
  write: boolean;
  json: boolean;
  maxCampaigns: number | null;
  maxRows: number | null;
  delayMs: number;
  allowPartialWrite: boolean;
};

type CampaignSummary = {
  nccCampaignId: string;
  campaignName: string;
  campaignTp: string;
  status: string;
  days: number;
  impCnt: number;
  clkCnt: number;
  salesAmtKrw: number;
  convAmtKrw: number;
  roasNaverClaim: number | null;
};

type Failure = {
  id: string;
  name: string;
  status?: number;
  error: string;
};

const SCHEMA_VERSION = "naver-ads-collect-readiness-v2-20260522";
const DAY_MS = 86400000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fmtKrw = (n: number): string => {
  if (n === 0) return "₩0";
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.round((n % 100_000_000) / 10_000);
    return `₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-ads-collect-7d-20260513.ts [options]

Default:
  no-write dry-run for the latest 7 complete KST days ending yesterday.

Options:
  --site=biocom                 Site value stored in naver_ads_daily. Default: biocom
  --since=YYYY-MM-DD            Inclusive start date. Default: KST yesterday - 6 days
  --until=YYYY-MM-DD            Inclusive end date. Default: KST yesterday
  --dry-run                     Force no-write mode. Default: true
  --write                       Enable SQLite upsert. Mutually exclusive with --dry-run
  --allow-partial-write         Allow write even when some campaign reads fail
  --max-campaigns=N             Limit campaign reads for smoke/readiness
  --max-rows=N                  Abort before write if preview row count exceeds N
  --delay-ms=N                  Delay between Naver API campaign stats calls. Default: 600
  --json                        Print JSON only
  --help                        Show this help
`;

const formatKstDateFromTodayOffset = (offsetDays: number): string => {
  return new Date(Date.now() + KST_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
};

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const readPositiveInt = (name: string, value: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    site: "biocom",
    since: formatKstDateFromTodayOffset(7),
    until: formatKstDateFromTodayOffset(1),
    dryRun: true,
    write: false,
    json: false,
    maxCampaigns: null,
    maxRows: null,
    delayMs: 600,
    allowPartialWrite: false,
  };
  let dryRunRequested = false;
  let writeRequested = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--dry-run" || arg === "--readiness") {
      if (writeRequested) throw new Error("--write and --dry-run cannot be used together");
      dryRunRequested = true;
      options.dryRun = true;
      options.write = false;
      continue;
    }
    if (arg === "--write") {
      if (dryRunRequested) throw new Error("--write and --dry-run cannot be used together");
      writeRequested = true;
      options.write = true;
      options.dryRun = false;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--allow-partial-write") {
      options.allowPartialWrite = true;
      continue;
    }
    if (arg.startsWith("--site=")) {
      options.site = arg.slice("--site=".length).trim() || "biocom";
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
    if (arg.startsWith("--max-campaigns=")) {
      options.maxCampaigns = readPositiveInt("max-campaigns", arg.slice("--max-campaigns=".length));
      continue;
    }
    if (arg.startsWith("--max-rows=")) {
      options.maxRows = readPositiveInt("max-rows", arg.slice("--max-rows=".length));
      continue;
    }
    if (arg.startsWith("--delay-ms=")) {
      const parsed = Number(arg.slice("--delay-ms=".length));
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("delay-ms must be a non-negative integer");
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

const sumCampaigns = (rows: NaverAdsDailyUpsert[]): CampaignSummary[] => {
  const byCampaign = new Map<string, CampaignSummary>();

  for (const row of rows) {
    const current = byCampaign.get(row.nccCampaignId) ?? {
      nccCampaignId: row.nccCampaignId,
      campaignName: row.campaignName,
      campaignTp: row.campaignTp,
      status: row.campaignStatus,
      days: 0,
      impCnt: 0,
      clkCnt: 0,
      salesAmtKrw: 0,
      convAmtKrw: 0,
      roasNaverClaim: null,
    };

    current.days += 1;
    current.impCnt += row.impCnt;
    current.clkCnt += row.clkCnt;
    current.salesAmtKrw += row.salesAmtKrw;
    current.convAmtKrw += row.convAmtKrw;
    current.roasNaverClaim =
      current.salesAmtKrw > 0 ? current.convAmtKrw / current.salesAmtKrw : null;

    byCampaign.set(row.nccCampaignId, current);
  }

  return [...byCampaign.values()].sort((a, b) => b.salesAmtKrw - a.salesAmtKrw);
};

const summarizeRows = (rows: NaverAdsDailyUpsert[]) => {
  const byCampaign = sumCampaigns(rows);
  const totalSpend = rows.reduce((sum, row) => sum + row.salesAmtKrw, 0);
  const totalConv = rows.reduce((sum, row) => sum + row.convAmtKrw, 0);

  return {
    total_rows: rows.length,
    total_imp: rows.reduce((sum, row) => sum + row.impCnt, 0),
    total_clk: rows.reduce((sum, row) => sum + row.clkCnt, 0),
    total_sales_amt_krw: totalSpend,
    total_conv_amt_krw: totalConv,
    campaigns_with_spend: byCampaign.filter((row) => row.salesAmtKrw > 0).length,
    naver_claim_roas: totalSpend > 0 ? Number((totalConv / totalSpend).toFixed(2)) : null,
    by_campaign: byCampaign,
  };
};

const log = (options: CliOptions, message: string) => {
  if (!options.json) console.log(message);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const configured = isNaverAdsConfigured();

  if (!configured) {
    const out = {
      ok: false,
      schema_version: SCHEMA_VERSION,
      mode: options.write ? "write" : "dry_run",
      configured,
      window: { since: options.since, until: options.until },
      site: options.site,
      error: "env 미설정",
      missing_env_hint: "BIOCOM_NAVER_ADS_CUSTOMER_ID / ACCESS 또는 ACESS / SECRET_KEY",
      invariants_held: {
        sqlite_write: 0,
        naver_ads_state_change: 0,
        external_send_count: 0,
        raw_secret_logged: false,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(2);
  }

  log(options, `mode: ${options.write ? "write" : "dry-run/readiness"}`);
  log(options, `site: ${options.site}`);
  log(options, `window: ${options.since} ~ ${options.until}`);

  const campaignsResult = await listCampaigns();
  if (!campaignsResult.ok) {
    const out = {
      ok: false,
      schema_version: SCHEMA_VERSION,
      mode: options.write ? "write" : "dry_run",
      configured,
      site: options.site,
      window: { since: options.since, until: options.until },
      error: "listCampaigns failed",
      status: campaignsResult.status,
      message: campaignsResult.error,
      invariants_held: {
        sqlite_write: 0,
        naver_ads_state_change: 0,
        external_send_count: 0,
        raw_secret_logged: false,
      },
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(2);
  }

  const selectedCampaigns = options.maxCampaigns
    ? campaignsResult.campaigns.slice(0, options.maxCampaigns)
    : campaignsResult.campaigns;
  const rows: NaverAdsDailyUpsert[] = [];
  const failures: Failure[] = [];

  log(options, `campaigns: ${selectedCampaigns.length}/${campaignsResult.campaigns.length}`);

  for (let i = 0; i < selectedCampaigns.length; i += 1) {
    const campaign = selectedCampaigns[i];
    const stats = await getDailyStats({
      campaignId: campaign.nccCampaignId,
      since: options.since,
      until: options.until,
    });

    if (!stats.ok) {
      failures.push({
        id: campaign.nccCampaignId,
        name: campaign.name,
        status: stats.status,
        error: stats.error.slice(0, 140),
      });
    } else {
      rows.push(
        ...stats.daily.data.map((daily) => ({
          site: options.site,
          nccCampaignId: campaign.nccCampaignId,
          campaignName: campaign.name,
          campaignTp: campaign.campaignTp,
          campaignStatus: campaign.status,
          date: daily.dateStart,
          impCnt: Number(daily.impCnt) || 0,
          clkCnt: Number(daily.clkCnt) || 0,
          ctrPct: daily.ctr ?? null,
          cpcKrw: daily.cpc ?? null,
          salesAmtKrw: Math.round(Number(daily.salesAmt) || 0),
          convAmtKrw: Math.round(Number(daily.convAmt) || 0),
          ccnt: Number(daily.ccnt) || 0,
          crtoPct: daily.crto ?? null,
        })),
      );
    }

    if ((i + 1) % 10 === 0 || i + 1 === selectedCampaigns.length) {
      log(options, `progress: ${i + 1}/${selectedCampaigns.length} rows_previewed=${rows.length}`);
    }
    if (i + 1 < selectedCampaigns.length && options.delayMs > 0) {
      await wait(options.delayMs);
    }
  }

  const summary = summarizeRows(rows);
  let rowsWritten = 0;
  let writeBlockedReason = "";

  if (options.maxRows !== null && rows.length > options.maxRows) {
    writeBlockedReason = `preview rows ${rows.length} exceed --max-rows=${options.maxRows}`;
  } else if (options.write && failures.length > 0 && !options.allowPartialWrite) {
    writeBlockedReason = "campaign read failures exist; rerun with --allow-partial-write to write partial rows";
  }

  if (options.write && !writeBlockedReason) {
    bootstrapNaverAdsDailyTable();
    rowsWritten = upsertNaverAdsDaily(rows);
  }

  const out = {
    ok: !writeBlockedReason,
    schema_version: SCHEMA_VERSION,
    mode: options.write ? "write" : "dry_run",
    site: options.site,
    configured,
    window: { since: options.since, until: options.until },
    options: {
      dry_run: !options.write,
      write: options.write,
      max_campaigns: options.maxCampaigns,
      max_rows: options.maxRows,
      delay_ms: options.delayMs,
      allow_partial_write: options.allowPartialWrite,
    },
    campaigns: {
      total_available: campaignsResult.campaigns.length,
      selected: selectedCampaigns.length,
      success: selectedCampaigns.length - failures.length,
      failed: failures.length,
    },
    rows_previewed: rows.length,
    rows_written: rowsWritten,
    write_blocked_reason: writeBlockedReason || null,
    failures: failures.slice(0, 10),
    summary_7d: {
      total_imp: summary.total_imp,
      total_clk: summary.total_clk,
      total_spend_krw: summary.total_sales_amt_krw,
      total_spend_korean: fmtKrw(summary.total_sales_amt_krw),
      total_conv_amt_krw_naver_claim: summary.total_conv_amt_krw,
      total_conv_amt_korean_naver_claim: fmtKrw(summary.total_conv_amt_krw),
      naver_claim_roas: summary.naver_claim_roas,
      campaigns_with_spend: summary.campaigns_with_spend,
    },
    top5_by_spend: summary.by_campaign.slice(0, 5).map((campaign) => ({
      ncc_campaign_id: campaign.nccCampaignId,
      campaign_name: campaign.campaignName.slice(0, 40),
      campaign_tp: campaign.campaignTp,
      status: campaign.status,
      days: campaign.days,
      imp: campaign.impCnt,
      clk: campaign.clkCnt,
      spend_krw: campaign.salesAmtKrw,
      spend_krw_korean: fmtKrw(campaign.salesAmtKrw),
      conv_amt_krw_naver_claim: campaign.convAmtKrw,
      conv_amt_korean_naver_claim: fmtKrw(campaign.convAmtKrw),
      naver_claim_roas:
        campaign.roasNaverClaim != null ? Number(campaign.roasNaverClaim.toFixed(2)) : null,
    })),
    invariants_held: {
      sqlite_write: rowsWritten,
      naver_ads_state_change: 0,
      external_send_count: 0,
      raw_secret_logged: false,
      convAmt_added_to_internal_revenue: 0,
    },
  };

  console.log(JSON.stringify(out, null, 2));
  if (writeBlockedReason) process.exit(3);
};

main().catch((error) => {
  console.error("collect failed", error);
  process.exit(1);
});
