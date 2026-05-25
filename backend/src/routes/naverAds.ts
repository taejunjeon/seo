/**
 * 네이버 검색광고 dashboard API.
 * 로컬DB SQLite naver_ads_daily 캐시 정본 사용.
 * 운영DB tb_iamweb_users 결제완료 매출과 합산 금지 — convAmt 는 참고용.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { Router, type Request, type Response } from "express";

import { summarizeNaverAdsDaily } from "../naverAdsLocalDb";
import { isNaverAdsConfigured } from "../naverAdsClient";
import { getCrmDb } from "../crmLocalDb";
import {
  buildLazyCacheMeta,
  getLazyCached,
  getLazyCachedStale,
  setLazyCached,
  type LazyCacheEntry,
  type LazyCacheSource,
} from "../lib/lazyCache";

const execFileAsync = promisify(execFile);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");
const TSX_BIN = path.resolve(BACKEND_ROOT, "node_modules", ".bin", "tsx");
const EVIDENCE_SCRIPT = "scripts/monthly-evidence-join-dry-run.ts";
const EVIDENCE_TIMEOUT_MS = 90_000;
const NAVER_ADS_SUMMARY_CACHE_TTL_MS = Number.parseInt(
  process.env.NAVER_ADS_SUMMARY_CACHE_TTL_MS ?? `${15 * 60 * 1000}`,
  10,
);
const NAVER_ADS_SUMMARY_STALE_MAX_AGE_MS = Number.parseInt(
  process.env.NAVER_ADS_SUMMARY_STALE_MAX_AGE_MS ?? `${2 * 60 * 60 * 1000}`,
  10,
);

type NaverAdsSite = "biocom" | "thecleancoffee";
type NaverAdsCampaignSummaryResponse = {
  ok: true;
  mode: "read_only";
  site: NaverAdsSite;
  window: { since: string; until: string };
  configured: boolean;
  cache_info: ReturnType<typeof buildNaverAdsCacheInfo>;
  totals: Record<string, unknown>;
  campaigns_by_spend_desc: Array<Record<string, unknown>>;
  guardrails: Record<string, unknown>;
  invariants_held: Record<string, unknown>;
};
type NaverAdsSummaryCachePayload = ReturnType<typeof buildLazyCacheMeta> & {
  key_scope: string;
  generation_ms: number | null;
  request_ms: number;
  stale?: boolean;
  stale_reason?: string;
  precompute?: boolean;
};

type EvidencePayload = {
  metadata: { dateStart: string; dateEndExclusive: string; month: string };
  channelSummary: Array<{ primaryChannel: string; orders: number; revenue: number }>;
};

const runEvidenceJoin = async (site: string, since: string, until: string): Promise<EvidencePayload> => {
  const nodeBinDir = path.dirname(process.execPath);
  const mergedPath = [nodeBinDir, process.env.PATH || ""].filter(Boolean).join(path.delimiter);
  const { stdout } = await execFileAsync(
    process.execPath,
    [TSX_BIN, EVIDENCE_SCRIPT, `--site=${site}`, `--since=${since}`, `--until=${until}`, "--json"],
    {
      cwd: BACKEND_ROOT,
      timeout: EVIDENCE_TIMEOUT_MS,
      maxBuffer: 25 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: mergedPath,
        BACKGROUND_JOBS_ENABLED: "false",
        SCHEDULED_SEND_ENABLED: "false",
      },
    },
  );
  return JSON.parse(stdout) as EvidencePayload;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const isMissingNaverAdsDailyTableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /no such table:\s*naver_ads_daily/i.test(message);
};

const buildEmptyNaverAdsSummary = (): ReturnType<typeof summarizeNaverAdsDaily> => ({
  total_rows: 0,
  total_imp: 0,
  total_clk: 0,
  total_sales_amt_krw: 0,
  total_conv_amt_krw: 0,
  by_campaign: [],
});

type NaverAdsCacheInfoInput = {
  site: string;
  since: string;
  until: string;
  configured: boolean;
  available: boolean;
  warning: string | null;
  lastCachedAt: string | null;
  firstDateInCache: string | null;
  lastDateInCache: string | null;
  rowsInWindow: number;
};

const buildCollectorCommand = (
  mode: "dry-run" | "write",
  site: string,
  since: string,
  until: string,
): string => {
  const args = [
    "npx tsx scripts/naver-ads-collect-7d-20260513.ts",
    mode === "write" ? "--write" : "--dry-run",
    `--site=${site}`,
    `--since=${since}`,
    `--until=${until}`,
  ];
  args.push("--json");
  return args.join(" ");
};

const buildNaverAdsCacheInfo = (input: NaverAdsCacheInfoInput) => {
  const missingEnv = !input.configured;
  const missingTable = !input.available;

  let status:
    | "ready"
    | "not_connected"
    | "empty_cache"
    | "partial_requested_window"
    | "empty_requested_window"
    | "stale_or_out_of_window" = "ready";
  let unavailableReason: string | null = null;
  let operatorMessage = "Naver Ads 광고비 cache가 연결되어 있습니다.";
  let impact = "광고비/클릭/노출 기반 campaign-summary 계산 가능.";
  let nextAction: string | null = null;
  let confidence: "high" | "medium" = "high";

  if (missingEnv || missingTable) {
    status = "not_connected";
    unavailableReason = [
      missingTable ? "missing_naver_ads_daily_table" : "",
      missingEnv ? "missing_naver_ads_env" : "",
    ].filter(Boolean).join("+") || "cache_unavailable";
    operatorMessage =
      "Naver Ads 광고비 cache source가 아직 연결되지 않았습니다. 광고비가 0으로 보이면 성과가 0이라는 뜻이 아니라, Naver Ads API → VM Cloud SQLite 적재가 비어 있거나 env/table이 빠진 상태입니다.";
    impact =
      "paid_naver 내부 매출은 볼 수 있어도, 광고비가 없어서 내부 ROAS=매출÷광고비 판단을 하면 안 됩니다.";
    nextAction =
      "collector dry-run으로 Naver API 응답 row 수를 확인한 뒤, 승인된 one-shot sync로 naver_ads_daily를 1회 적재합니다.";
  } else if (!input.lastDateInCache) {
    status = "empty_cache";
    unavailableReason = "empty_naver_ads_daily_table";
    operatorMessage =
      "naver_ads_daily 테이블은 있지만 아직 cache row가 없습니다. 테이블만 준비된 상태입니다.";
    impact =
      "광고비가 0으로 내려오므로 Naver ROAS 화면은 비용 누락 상태입니다.";
    nextAction =
      "collector dry-run에서 rows_previewed가 기대 범위인지 확인한 뒤 --write one-shot sync를 실행합니다.";
  } else if (input.rowsInWindow === 0) {
    status = "empty_requested_window";
    unavailableReason = "no_rows_in_requested_window";
    operatorMessage =
      "Naver Ads cache는 있지만 요청한 기간에 해당 row가 없습니다. 기간 필터와 cache 보유 기간이 어긋난 상태입니다.";
    impact =
      "요청 기간의 광고비만 0으로 보이며, cache 전체가 깨졌다는 뜻은 아닐 수 있습니다.";
    nextAction =
      "since/until을 cache_info.last_date_in_cache 주변으로 맞춰 재조회하거나 해당 기간을 one-shot sync합니다.";
  } else if (input.firstDateInCache && input.firstDateInCache > input.since) {
    status = "partial_requested_window";
    unavailableReason = "cache_first_date_after_requested_since";
    operatorMessage =
      "Naver Ads cache는 연결됐지만 요청 시작일보다 늦은 날짜부터만 보유 중입니다. 요청 기간 앞부분 광고비가 빠진 부분 cache입니다.";
    impact =
      "조회된 기간의 비용은 맞지만, requested_window 전체 비용으로 보면 과소 집계입니다. ROAS는 실제보다 높게 보일 수 있습니다.";
    nextAction =
      "요청 시작일까지 과거 기간을 추가 sync하거나, 화면 필터를 cache_info.first_date_in_cache 이후로 좁혀 봅니다.";
    confidence = "medium";
  } else if (input.lastDateInCache < input.until) {
    status = "stale_or_out_of_window";
    unavailableReason = "cache_last_date_before_requested_until";
    operatorMessage =
      "Naver Ads cache가 요청 종료일보다 오래되었습니다. 최신 날짜 광고비가 일부 빠질 수 있습니다.";
    impact =
      "부분 ROAS는 계산되지만 최신 일자 비용이 빠질 수 있어 예산 판단에는 보수적으로 봐야 합니다.";
    nextAction =
      "요청 종료일까지 collector dry-run을 돌린 뒤 누락 날짜만 one-shot sync합니다.";
    confidence = "medium";
  }

  return {
    available: input.available,
    status,
    warning: input.warning,
    unavailable_reason: unavailableReason,
    configured: input.configured,
    last_cached_at: input.lastCachedAt,
    first_date_in_cache: input.firstDateInCache,
    last_date_in_cache: input.lastDateInCache,
    rows_in_window: input.rowsInWindow,
    requested_window: { since: input.since, until: input.until },
    operator_message: operatorMessage,
    impact,
    next_action: nextAction,
    readiness_command: buildCollectorCommand("dry-run", input.site, input.since, input.until),
    one_shot_sync_command: buildCollectorCommand("write", input.site, input.since, input.until),
    source_window_freshness_confidence: {
      source: "VM Cloud SQLite naver_ads_daily cache",
      window: `${input.since}~${input.until}`,
      freshness: input.lastCachedAt || "not_cached",
      confidence,
    },
  };
};

const fmtKrw = (n: number): string => {
  if (n === 0) return "₩0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.round((abs % 100_000_000) / 10_000);
    return `${sign}₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};

const makeNaverAdsSummaryCacheKey = (site: NaverAdsSite, since: string, until: string): string => (
  `naver-ads:campaign-summary:v1:${site}:${since}:${until}`
);

const parseNaverAdsSite = (siteRaw: unknown): NaverAdsSite => (
  siteRaw === "thecleancoffee" ? "thecleancoffee" : "biocom"
);

const attachSummaryCacheMeta = (
  body: NaverAdsCampaignSummaryResponse,
  entry: LazyCacheEntry | null,
  source: LazyCacheSource,
  options: {
    keyScope: string;
    generationMs: number | null;
    requestMs: number;
    stale?: boolean;
    staleReason?: string;
    precompute?: boolean;
  },
): NaverAdsCampaignSummaryResponse & { summary_cache: NaverAdsSummaryCachePayload } => ({
  ...body,
  summary_cache: {
    ...buildLazyCacheMeta(entry, source),
    key_scope: options.keyScope,
    generation_ms: options.generationMs,
    request_ms: options.requestMs,
    stale: options.stale,
    stale_reason: options.staleReason,
    precompute: options.precompute,
  },
});

const readJsonArtifact = (relativePath: string): Record<string, unknown> | null => {
  const fullPath = path.resolve(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) return null;
  try {
    return JSON.parse(readFileSync(fullPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const asArray = (value: unknown): Array<Record<string, unknown>> => (
  Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : []
);

const numberValue = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? value : 0
);

const pickSiteRow = (
  rows: Array<Record<string, unknown>>,
  site: "biocom" | "thecleancoffee",
): Record<string, unknown> => (
  rows.find((row) => row.site === site) ?? {}
);

const buildNaverRoasDashboardSkeleton = (site: "all" | NaverAdsSite) => {
  const brandsearchRoas = readJsonArtifact("data/project/naver-brandsearch-roas-preview-20260525.json");
  const brandsearchBridge = readJsonArtifact("data/project/naver-brandsearch-order-bridge-preview-20260525.json");
  const brandsearchNarrowing = readJsonArtifact("data/project/biocom-naver-brandsearch-unresolved-narrowing-20260526.json")
    ?? readJsonArtifact("data/project/biocom-naver-brandsearch-unresolved-breakdown-20260525.json");
  const displayCoffee = readJsonArtifact("report/reportcoffee-naver-display-hermes-export-result-20260525.json");

  const brandRows = asArray(brandsearchRoas?.by_site);
  const bridgeRows = asArray(brandsearchBridge?.by_site ?? brandsearchBridge);
  const biocomBrand = pickSiteRow(brandRows, "biocom");
  const coffeeBrand = pickSiteRow(brandRows, "thecleancoffee");
  const biocomBridge = pickSiteRow(bridgeRows, "biocom");
  const coffeeBridge = pickSiteRow(bridgeRows, "thecleancoffee");
  const displayCampaign = asRecord(displayCoffee?.display_campaign);
  const narrowing = asRecord(brandsearchNarrowing?.narrowing);
  const narrowedRows = asArray(narrowing.narrowed_safe_rows);
  const biocomVmExactUpgradeRevenue = narrowedRows.reduce((sum, row) => {
    const sourceSums = asRecord(row.source_amount_sums);
    const exactBySource = asRecord(sourceSums.exact_key_match_krw_by_source);
    return sum + numberValue(exactBySource.vm_cloud_imweb_orders);
  }, 0);
  const biocomBrandCost = numberValue(asRecord(biocomBrand.cost).total_cost_krw ?? biocomBridge.cost_krw);
  const biocomExistingExactRevenue = numberValue(asRecord(biocomBridge.bridge).exact_marker_amount_krw);

  return {
    ok: true,
    mode: "local_skeleton_read_only",
    generated_at: new Date().toISOString(),
    requested_site: site,
    source_policy: {
      internal_confirmed_roas:
        "실제 결제완료 주문 정본 매출을 광고비로 나눈 값. 예산 판단에 우선 사용.",
      naver_claim_roas:
        "네이버 광고 플랫폼이 주장하는 전환매출 기반 값. 참고용이며 내부 confirmed 매출에 합산하지 않음.",
      channel_split_required: true,
      do_not_mix_windows: true,
    },
    channels: {
      search_ads: {
        status: "api_cache_partial",
        endpoint_reference: "/api/ads/naver/campaign-summary?site=biocom",
        source: "Naver Search Ad API -> local/VM naver_ads_daily cache",
        current_known: {
          biocom_window: "2026-04-21~2026-05-20",
          biocom_spend_krw: 7276795,
          biocom_clicks: 12443,
          thecleancoffee_recent_spend_krw: 440,
          warning: "검색광고 API에는 브랜드검색/성과 디스플레이가 포함되지 않는다.",
        },
        next_action: "검색광고 cache freshness를 daily로 고정하고 내부 결제완료 주문 bridge와 같은 window로 조회",
      },
      brandsearch: {
        status: "manual_cost_cache_ready_order_bridge_partial_upgrade_candidate",
        source: "TJ-confirmed manual contract daily allocation cache + VM Cloud brandsearch payment marker",
        totals: {
          cost_krw: numberValue(asRecord(brandsearchRoas?.totals).total_cost_krw),
          vm_marker_revenue_krw: numberValue(asRecord(brandsearchRoas?.totals).total_vm_confirmed_payment_success_amount_krw),
          landing_rows: numberValue(asRecord(brandsearchRoas?.totals).total_landing_rows),
        },
        biocom: {
          effective_window: biocomBrand.effective_window ?? asRecord(biocomBridge.window),
          cost_krw: biocomBrandCost,
          exact_order_bridge_roas: numberValue(asRecord(biocomBridge.roas).exact_order_bridge_roas),
          marker_rows: numberValue(asRecord(brandsearchNarrowing?.source_summary).marker_rows)
            || numberValue(asRecord(biocomBridge.bridge).total_marker_rows),
          exact_rows: numberValue(asRecord(biocomBridge.bridge).exact_rows),
          previous_unresolved_rows: numberValue(asRecord(brandsearchNarrowing?.source_summary).previous_unresolved_rows),
          latest_narrowing: narrowing.classification_counts ?? null,
          existing_exact_revenue_krw: biocomExistingExactRevenue,
          vm_exact_upgrade_candidate_revenue_krw: biocomVmExactUpgradeRevenue,
          upgraded_candidate_revenue_krw: biocomExistingExactRevenue + biocomVmExactUpgradeRevenue,
          upgraded_candidate_roas: biocomBrandCost > 0
            ? round2((biocomExistingExactRevenue + biocomVmExactUpgradeRevenue) / biocomBrandCost)
            : null,
          interpretation:
            "기존 운영DB 기준 미해결 6건은 VM Cloud imweb_orders에서는 exact match라 주문 source 정책 결정 후 upgraded bridge 후보.",
        },
        thecleancoffee: {
          effective_window: coffeeBrand.effective_window ?? asRecord(coffeeBridge.window),
          cost_krw: numberValue(asRecord(coffeeBrand.cost).total_cost_krw ?? coffeeBridge.cost_krw),
          exact_order_bridge_roas: numberValue(asRecord(coffeeBridge.roas).exact_order_bridge_roas),
          marker_rows: numberValue(asRecord(coffeeBridge.bridge).total_marker_rows),
          exact_rows: numberValue(asRecord(coffeeBridge.bridge).exact_rows),
          interpretation: "현재 marker row는 모두 주문 정본과 주문키로 연결됨.",
        },
        next_action: "biocom 6건 upgrade preview와 브랜드검색 주문 source policy 문서화",
      },
      display: {
        status: "manual_hermes_required",
        source: "Hermes Chrome CDP read-only XLSX export from Naver Ads UI",
        thecleancoffee_weekly_reference: {
          window: "2026-05-18~2026-05-24",
          campaign_name: displayCampaign.campaign_name ?? "[ADVoost] 쇼핑",
          spend_krw: numberValue(displayCampaign.spend_krw),
          clicks: numberValue(displayCampaign.clicks),
          naver_claim_conversion_revenue_krw: numberValue(displayCampaign.conversion_revenue_krw),
          naver_claim_roas: numberValue(displayCampaign.spend_krw) > 0
            ? round2(numberValue(displayCampaign.conversion_revenue_krw) / numberValue(displayCampaign.spend_krw))
            : null,
        },
        april_request_status: "prompt_prepared_needed",
        next_action: "Hermes에게 2026-04-01~2026-04-30 성과 디스플레이 비용/전환금액/클릭/ROAS export 지시",
      },
    },
    okr_progress: [
      {
        kr: "KR1 네이버 광고 비용 source를 채널별로 분리",
        progress_percent: 72,
        current: "검색광고 API cache, 브랜드검색 수동 cache, coffee display Hermes 주간 원본이 분리됨.",
      },
      {
        kr: "KR2 내부 confirmed ROAS와 네이버 주장 ROAS를 분리",
        progress_percent: 61,
        current: "브랜드검색 주문 bridge는 구축, display 내부 confirmed order bridge는 미완.",
      },
      {
        kr: "KR3 운영 화면/API로 반복 조회",
        progress_percent: 54,
        current: "프론트 정적 화면과 local API skeleton 단계.",
      },
    ],
    action_plan: [
      "biocom 브랜드검색 6건 upgrade preview 작성",
      "Hermes 4월 성과 디스플레이 원본 export",
      "프론트 /ads/naver-roas를 local API 응답으로 연결하는 Yellow 승인안 확정",
    ],
    invariants_held: {
      read_only: true,
      operating_db_write: 0,
      vm_cloud_write: 0,
      platform_send: 0,
      naver_ads_state_change: 0,
    },
  };
};

const naverAdsSummaryInflight = new Map<
  string,
  Promise<{ body: NaverAdsCampaignSummaryResponse; entry: LazyCacheEntry; generationMs: number }>
>();

const buildNaverAdsCampaignSummary = async (
  site: NaverAdsSite,
  since: string,
  until: string,
): Promise<NaverAdsCampaignSummaryResponse> => {
  const naverAdsConfigured = isNaverAdsConfigured();

  let naverAdsCacheAvailable = true;
  let naverAdsCacheWarning: string | null = null;
  let summary: ReturnType<typeof summarizeNaverAdsDaily>;

  try {
    summary = summarizeNaverAdsDaily({ site, since, until });
  } catch (error) {
    if (!isMissingNaverAdsDailyTableError(error)) throw error;
    naverAdsCacheAvailable = false;
    naverAdsCacheWarning = "naver_ads_daily 테이블이 없어 광고비 cache를 읽지 못했습니다.";
    summary = buildEmptyNaverAdsSummary();
  }

  let lastCachedRow: {
    last_cached: string | null;
    first_date: string | null;
    last_date: string | null;
  } = {
    last_cached: null,
    first_date: null,
    last_date: null,
  };
  if (naverAdsCacheAvailable) {
    try {
      lastCachedRow = getCrmDb()
        .prepare(
          `SELECT MAX(cached_at) AS last_cached, MIN(date) AS first_date, MAX(date) AS last_date
           FROM naver_ads_daily WHERE site = ? AND date >= ? AND date <= ?`,
        )
        .get(site, since, until) as {
        last_cached: string | null;
        first_date: string | null;
        last_date: string | null;
      };
    } catch (error) {
      if (!isMissingNaverAdsDailyTableError(error)) throw error;
      naverAdsCacheAvailable = false;
      naverAdsCacheWarning = "naver_ads_daily 테이블이 없어 광고비 cache freshness를 읽지 못했습니다.";
    }
  }

  let internalRevenue = 0;
  let internalOrders = 0;
  const internalRevenueSource =
    "evidence-join paid_naver channel (NaPm/paid UTM/search referrer · 광고비와 동일 since~until 윈도우)";
  let internalRevenueWarning: string | null = null;
  let internalWindow: { since: string; until: string } | null = null;
  try {
    const evidence = await runEvidenceJoin(site, since, until);
    internalWindow = { since, until };
    const paidNaver = (evidence.channelSummary || []).find(
      (r) => r.primaryChannel === "paid_naver",
    );
    if (paidNaver) {
      internalRevenue = paidNaver.revenue;
      internalOrders = paidNaver.orders;
    } else {
      internalRevenueWarning = `paid_naver 채널 0건 (${since}~${until})`;
    }
  } catch (e) {
    internalRevenueWarning = e instanceof Error ? e.message.slice(0, 140) : "evidence-join 실패";
  }

  const totalSpend = summary.total_sales_amt_krw;
  const totalConv = summary.total_conv_amt_krw;
  const naverClaimRoas = totalSpend > 0 ? round2(totalConv / totalSpend) : null;
  const internalRoas = totalSpend > 0 ? round2(internalRevenue / totalSpend) : null;

  const campaigns = summary.by_campaign.map((c) => ({
    ncc_campaign_id: c.nccCampaignId,
    campaign_name: c.campaignName,
    campaign_tp: c.campaignTp,
    status: c.campaignStatus,
    days: c.days,
    imp_cnt: c.impCnt,
    clk_cnt: c.clkCnt,
    ctr: c.impCnt > 0 ? round2((c.clkCnt / c.impCnt) * 100) : null,
    spend_krw: c.salesAmtKrw,
    spend_korean: fmtKrw(c.salesAmtKrw),
    naver_claim_revenue_krw: c.convAmtKrw,
    naver_claim_revenue_korean: fmtKrw(c.convAmtKrw),
    naver_claim_roas: c.roasNaverClaim != null ? round2(c.roasNaverClaim) : null,
  }));

  const cacheInfo = buildNaverAdsCacheInfo({
    site,
    since,
    until,
    configured: naverAdsConfigured,
    available: naverAdsCacheAvailable,
    warning: naverAdsCacheWarning,
    lastCachedAt: lastCachedRow.last_cached,
    firstDateInCache: lastCachedRow.first_date,
    lastDateInCache: lastCachedRow.last_date,
    rowsInWindow: summary.total_rows,
  });

  return {
    ok: true,
    mode: "read_only",
    site,
    window: { since, until },
    configured: naverAdsConfigured,
    cache_info: cacheInfo,
    totals: {
      campaigns_total: campaigns.length,
      campaigns_with_spend: campaigns.filter((c) => c.spend_krw > 0).length,
      total_imp: summary.total_imp,
      total_clk: summary.total_clk,
      total_spend_krw: totalSpend,
      total_spend_korean: fmtKrw(totalSpend),
      naver_claim_total_revenue_krw: totalConv,
      naver_claim_total_revenue_korean: fmtKrw(totalConv),
      naver_claim_total_roas: naverClaimRoas,
      internal_paid_naver_revenue_krw: internalRevenue,
      internal_paid_naver_revenue_korean: fmtKrw(internalRevenue),
      internal_paid_naver_orders: internalOrders,
      internal_real_roas: internalRoas,
      internal_revenue_source: internalRevenueSource,
      internal_revenue_warning: internalRevenueWarning,
      internal_revenue_window: internalWindow,
      over_claim_krw: internalRevenue > 0 ? totalConv - internalRevenue : null,
      over_claim_korean: internalRevenue > 0 ? fmtKrw(totalConv - internalRevenue) : null,
    },
    campaigns_by_spend_desc: campaigns,
    guardrails: {
      source: "Naver Search Ad API (HMAC + X-Customer 인증) → 로컬DB naver_ads_daily 캐시",
      conv_amt_is_naver_claim_not_internal_revenue: true,
      add_to_internal_confirmed_revenue: false,
      attribution_window: "네이버 자체 attribution (보통 7일 클릭, 1일 view)",
      recommended_use: "광고비 (spend_krw) 는 광고비 정본. naver_claim_roas 는 참고용 — 운영자 진짜 ROAS 는 /total 페이지의 paid_naver 채널 매출 ÷ spend_krw 사용.",
      campaign_id_to_utm_join_status: "두 ID 형식 다름 (cmp-a001-... vs sometag) — 광고 destination URL utm_campaign 정정 필요",
    },
    invariants_held: {
      operational_db_write: 0,
      external_send_count: 0,
      raw_secret_logged: false,
      naver_ads_state_change: 0,
    },
  };
};

const computeAndCacheNaverAdsSummary = async (
  cacheKey: string,
  site: NaverAdsSite,
  since: string,
  until: string,
): Promise<{ body: NaverAdsCampaignSummaryResponse; entry: LazyCacheEntry; generationMs: number }> => {
  const startedAt = Date.now();
  const body = await buildNaverAdsCampaignSummary(site, since, until);
  const entry = setLazyCached(cacheKey, body, NAVER_ADS_SUMMARY_CACHE_TTL_MS);
  return { body, entry, generationMs: Date.now() - startedAt };
};

export const createNaverAdsRouter = () => {
  const router = Router();

  router.get("/api/ads/naver-roas/dashboard", (req: Request, res: Response) => {
    const siteRaw = typeof req.query.site === "string" ? req.query.site : "all";
    const site: "all" | NaverAdsSite =
      siteRaw === "biocom" || siteRaw === "thecleancoffee" ? siteRaw : "all";
    res.json(buildNaverRoasDashboardSkeleton(site));
  });

  router.get("/api/ads/naver/campaign-summary", async (req: Request, res: Response) => {
    const requestStartedAt = Date.now();
    const site = parseNaverAdsSite(typeof req.query.site === "string" ? req.query.site : "biocom");
    const sinceQuery = typeof req.query.since === "string" ? req.query.since : null;
    const untilQuery = typeof req.query.until === "string" ? req.query.until : null;
    const since = sinceQuery || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = untilQuery || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const forceRefresh = req.query.force === "1" || req.query.force === "true";
    const isPrecomputeRequest = req.query.precompute === "1" || req.query.precompute === "true";
    const cacheKey = makeNaverAdsSummaryCacheKey(site, since, until);
    const keyScope = `${site}:${since}:${until}`;

    try {
      if (!forceRefresh) {
        const cached = getLazyCached(cacheKey);
        if (cached) {
          res.json(attachSummaryCacheMeta(
            cached.result as NaverAdsCampaignSummaryResponse,
            cached,
            "lazy_cache_hit",
            {
              keyScope,
              generationMs: 0,
              requestMs: Date.now() - requestStartedAt,
              precompute: isPrecomputeRequest,
            },
          ));
          return;
        }
      }

      let promise = forceRefresh ? null : naverAdsSummaryInflight.get(cacheKey);
      if (!promise) {
        promise = computeAndCacheNaverAdsSummary(cacheKey, site, since, until);
        if (!forceRefresh) {
          naverAdsSummaryInflight.set(cacheKey, promise);
          promise.finally(() => naverAdsSummaryInflight.delete(cacheKey)).catch(() => {});
        }
      }

      const result = await promise;
      res.json(attachSummaryCacheMeta(result.body, result.entry, forceRefresh ? "live_force" : "live_cache_miss", {
        keyScope,
        generationMs: result.generationMs,
        requestMs: Date.now() - requestStartedAt,
        precompute: isPrecomputeRequest,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "naver ads summary failed";
      const stale = getLazyCachedStale(cacheKey, NAVER_ADS_SUMMARY_STALE_MAX_AGE_MS);
      if (stale) {
        res.json(attachSummaryCacheMeta(
          stale.result as NaverAdsCampaignSummaryResponse,
          stale,
          "lazy_cache_hit",
          {
            keyScope,
            generationMs: null,
            requestMs: Date.now() - requestStartedAt,
            stale: true,
            staleReason: msg,
            precompute: isPrecomputeRequest,
          },
        ));
        return;
      }
      res.status(500).json({ ok: false, error: "naver_ads_summary_error", message: msg });
    }
  });

  return router;
};
