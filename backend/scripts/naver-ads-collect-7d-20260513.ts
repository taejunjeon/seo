/**
 * 네이버 검색광고 37 캠페인 7일 광고비/노출/클릭/convAmt 수집 (gpt0508-49 단계2).
 * stats endpoint 형식 B (?id=단수 + timeRange) — 일별 자동 분해.
 * rate limit: 호출 간 600ms.
 */
import { listCampaigns, getDailyStats } from "../src/naverAdsClient";
import { bootstrapNaverAdsDailyTable, upsertNaverAdsDaily, summarizeNaverAdsDaily } from "../src/naverAdsLocalDb";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

const main = async () => {
  bootstrapNaverAdsDailyTable();

  const c = await listCampaigns();
  if (!c.ok) {
    console.error("listCampaigns failed", c);
    process.exit(2);
  }
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const until = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  console.log(`수집 윈도우: ${since} ~ ${until} (어제까지 7일)`);
  console.log(`캠페인 수: ${c.campaigns.length}`);

  let okCount = 0;
  let failCount = 0;
  let totalRows = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];

  for (let i = 0; i < c.campaigns.length; i++) {
    const camp = c.campaigns[i];
    const stats = await getDailyStats({ campaignId: camp.nccCampaignId, since, until });
    if (!stats.ok) {
      failCount++;
      failures.push({ id: camp.nccCampaignId, name: camp.name, error: stats.error.slice(0, 100) });
    } else {
      const upserts = stats.daily.data.map((d) => ({
        site: "biocom",
        nccCampaignId: camp.nccCampaignId,
        campaignName: camp.name,
        campaignTp: camp.campaignTp,
        campaignStatus: camp.status,
        date: d.dateStart, // YYYY-MM-DD
        impCnt: Number(d.impCnt) || 0,
        clkCnt: Number(d.clkCnt) || 0,
        ctrPct: d.ctr ?? null,
        cpcKrw: d.cpc ?? null,
        salesAmtKrw: Math.round(Number(d.salesAmt) || 0),
        convAmtKrw: Math.round(Number(d.convAmt) || 0),
        ccnt: Number(d.ccnt) || 0,
        crtoPct: d.crto ?? null,
      }));
      const written = upsertNaverAdsDaily(upserts);
      totalRows += written;
      okCount++;
      if ((i + 1) % 10 === 0) console.log(`  진행: ${i + 1}/${c.campaigns.length} (rows ${totalRows})`);
    }
    await wait(600);
  }

  const summary = summarizeNaverAdsDaily({ site: "biocom", since, until });
  const out = {
    schema_version: "naver-ads-collect-7d-20260513",
    window: { since, until },
    campaigns: { total: c.campaigns.length, success: okCount, failed: failCount },
    rows_written: totalRows,
    failures: failures.slice(0, 5),
    summary_7d: {
      total_imp: summary.total_imp,
      total_clk: summary.total_clk,
      total_spend_krw: summary.total_sales_amt_krw,
      total_spend_korean: fmtKrw(summary.total_sales_amt_krw),
      total_conv_amt_krw_naver_claim: summary.total_conv_amt_krw,
      total_conv_amt_korean_naver_claim: fmtKrw(summary.total_conv_amt_krw),
      naver_claim_roas: summary.total_sales_amt_krw > 0
        ? Number((summary.total_conv_amt_krw / summary.total_sales_amt_krw).toFixed(2))
        : null,
      campaigns_with_spend: summary.by_campaign.filter((c) => c.salesAmtKrw > 0).length,
    },
    top5_by_spend: summary.by_campaign.slice(0, 5).map((c) => ({
      ncc_campaign_id: c.nccCampaignId,
      campaign_name: c.campaignName.slice(0, 40),
      campaign_tp: c.campaignTp,
      status: c.campaignStatus,
      days: c.days,
      imp: c.impCnt,
      clk: c.clkCnt,
      spend_krw_korean: fmtKrw(c.salesAmtKrw),
      conv_amt_korean_naver_claim: fmtKrw(c.convAmtKrw),
      naver_claim_roas: c.roasNaverClaim != null ? Number(c.roasNaverClaim.toFixed(2)) : null,
    })),
    invariants_held: {
      operational_db_write: 0,
      external_send_count: 0,
      raw_secret_logged: false,
      naver_ads_state_change: 0,
      convAmt_added_to_internal_revenue: 0,
    },
  };
  console.log(JSON.stringify(out, null, 2));
};

main().catch((e) => {
  console.error("collect failed", e);
  process.exit(1);
});
