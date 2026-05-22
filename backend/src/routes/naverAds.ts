/**
 * 네이버 검색광고 dashboard API.
 * 로컬DB SQLite naver_ads_daily 캐시 정본 사용.
 * 운영DB tb_iamweb_users 결제완료 매출과 합산 금지 — convAmt 는 참고용.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { Router, type Request, type Response } from "express";

import { summarizeNaverAdsDaily } from "../naverAdsLocalDb";
import { isNaverAdsConfigured } from "../naverAdsClient";
import { getCrmDb } from "../crmLocalDb";

const execFileAsync = promisify(execFile);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const TSX_BIN = path.resolve(BACKEND_ROOT, "node_modules", ".bin", "tsx");
const EVIDENCE_SCRIPT = "scripts/monthly-evidence-join-dry-run.ts";
const EVIDENCE_TIMEOUT_MS = 90_000;

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

export const createNaverAdsRouter = () => {
  const router = Router();

  router.get("/api/ads/naver/campaign-summary", async (req: Request, res: Response) => {
    try {
      const siteRaw = typeof req.query.site === "string" ? req.query.site : "biocom";
      const site = siteRaw === "thecleancoffee" ? "thecleancoffee" : "biocom";
      const sinceQuery = typeof req.query.since === "string" ? req.query.since : null;
      const untilQuery = typeof req.query.until === "string" ? req.query.until : null;
      const since = sinceQuery || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const until = untilQuery || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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

      // 마지막 캐시 시점
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

      // gpt0508-50: 진짜 ROAS = 광고비 vs 내부 paid_naver 채널 매출, **광고비와 같은 since~until 윈도우**.
      // evidence-join script (NaPm/paid UTM/search referrer 분류) 를 since/until 직접 전달해 실행 → window mismatch 제거.
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

      res.json({
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
          // 진짜 ROAS (내부 결제완료 매출 기준)
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
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "naver ads summary failed";
      res.status(500).json({ ok: false, error: "naver_ads_summary_error", message: msg });
    }
  });

  return router;
};
