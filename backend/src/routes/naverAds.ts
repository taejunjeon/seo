/**
 * 네이버 검색광고 dashboard API.
 * 로컬DB SQLite naver_ads_daily 캐시 정본 사용.
 * 운영DB tb_iamweb_users 결제완료 매출과 합산 금지 — convAmt 는 참고용.
 */

import { Router, type Request, type Response } from "express";

import { summarizeNaverAdsDaily } from "../naverAdsLocalDb";
import { isNaverAdsConfigured } from "../naverAdsClient";
import { getCrmDb } from "../crmLocalDb";

const round2 = (n: number) => Math.round(n * 100) / 100;
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

      const summary = summarizeNaverAdsDaily({ site, since, until });

      // 마지막 캐시 시점
      const lastCachedRow = getCrmDb()
        .prepare(`SELECT MAX(cached_at) AS last_cached, MAX(date) AS last_date FROM naver_ads_daily WHERE site = ?`)
        .get(site) as { last_cached: string | null; last_date: string | null };

      const totalSpend = summary.total_sales_amt_krw;
      const totalConv = summary.total_conv_amt_krw;
      const naverClaimRoas = totalSpend > 0 ? round2(totalConv / totalSpend) : null;

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

      res.json({
        ok: true,
        mode: "read_only",
        site,
        window: { since, until },
        configured: isNaverAdsConfigured(),
        cache_info: {
          last_cached_at: lastCachedRow.last_cached,
          last_date_in_cache: lastCachedRow.last_date,
          rows_in_window: summary.total_rows,
        },
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
