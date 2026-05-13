/**
 * 네이버 검색광고 dashboard API.
 * 로컬DB SQLite naver_ads_daily 캐시 정본 사용.
 * 운영DB tb_iamweb_users 결제완료 매출과 합산 금지 — convAmt 는 참고용.
 */

import { Router, type Request, type Response } from "express";

import { summarizeNaverAdsDaily } from "../naverAdsLocalDb";
import { isNaverAdsConfigured } from "../naverAdsClient";
import { getCrmDb } from "../crmLocalDb";
import { queryPg, isDatabaseConfigured } from "../postgres";

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

      // gpt0508-49 step3+: 진짜 ROAS = 광고비 vs 내부 paid_naver 채널 매출.
      // /total API 의 paid_naver channel_summary (evidence-join NaPm/paid UTM/search referrer 분류) reuse.
      // since 의 month 기준으로 paid_naver 월 매출 매핑 (정확 윈도우 비교는 다음 sprint, 본 sprint 는 월 단위 비교).
      let internalRevenue = 0;
      let internalOrders = 0;
      let internalRevenueSource: string = "/total paid_naver channel (evidence-join NaPm/paid UTM/search referrer)";
      let internalRevenueWarning: string | null = null;
      let internalMonth: string | null = null;
      try {
        const monthOfSince = since.slice(0, 7); // YYYY-MM
        internalMonth = monthOfSince;
        const totalRes = await fetch(
          `http://localhost:7020/api/total/monthly-channel-summary?month=${monthOfSince}&site=biocom&mode=dry_run`,
          { signal: AbortSignal.timeout(30000) },
        );
        if (totalRes.ok) {
          const totalJson = (await totalRes.json()) as {
            ok?: boolean;
            evidence?: { channel_summary?: Array<{ primary_channel: string; orders: number; revenue: number }> };
            platform_reference?: { rows?: Array<{ platform: string; internalConfirmed?: { orders: number; revenue: number } }> };
          };
          if (totalJson.ok) {
            // paid_naver row 추출
            const paidNaver = (totalJson.evidence?.channel_summary || []).find(
              (r) => r.primary_channel === "paid_naver",
            );
            if (paidNaver) {
              internalRevenue = paidNaver.revenue;
              internalOrders = paidNaver.orders;
              internalRevenueWarning =
                `${monthOfSince} 월 paid_naver 채널 매출 기준 (월 단위 합산). 광고비 윈도우 (${since}~${until}) 와 mismatch 가능.`;
            } else {
              internalRevenueWarning = `${monthOfSince} paid_naver 채널 0건`;
            }
          } else {
            internalRevenueWarning = "/total API 응답 ok=false";
          }
        } else {
          internalRevenueWarning = `/total HTTP ${totalRes.status}`;
        }
      } catch (e) {
        internalRevenueWarning = e instanceof Error ? e.message.slice(0, 100) : "/total fetch 실패";
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
          // 진짜 ROAS (내부 결제완료 매출 기준)
          internal_paid_naver_revenue_krw: internalRevenue,
          internal_paid_naver_revenue_korean: fmtKrw(internalRevenue),
          internal_paid_naver_orders: internalOrders,
          internal_real_roas: internalRoas,
          internal_revenue_source: internalRevenueSource,
          internal_revenue_warning: internalRevenueWarning,
          internal_revenue_month: internalMonth,
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
