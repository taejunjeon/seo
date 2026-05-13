/**
 * 로컬DB SQLite naver_ads_daily 테이블 — 네이버 검색광고 API stats 일별 캐시.
 *
 * 정책:
 *   - read-only 외부 source. 운영DB write 0.
 *   - convAmt (네이버 주장 매출) 는 참고용. 운영DB tb_iamweb_users 결제완료 매출과 합산 금지 (caller 책임).
 *   - raw secret 저장 0.
 */

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

const TABLE = "naver_ads_daily";
let ready = false;

const ensureTable = (db: Database.Database) => {
  if (ready) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      site TEXT NOT NULL DEFAULT 'biocom',
      ncc_campaign_id TEXT NOT NULL,
      campaign_name TEXT NOT NULL DEFAULT '',
      campaign_tp TEXT NOT NULL DEFAULT '',
      campaign_status TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      imp_cnt INTEGER NOT NULL DEFAULT 0,
      clk_cnt INTEGER NOT NULL DEFAULT 0,
      ctr_pct REAL DEFAULT NULL,
      cpc_krw REAL DEFAULT NULL,
      sales_amt_krw INTEGER NOT NULL DEFAULT 0,
      conv_amt_krw INTEGER NOT NULL DEFAULT 0,
      ccnt INTEGER NOT NULL DEFAULT 0,
      crto_pct REAL DEFAULT NULL,
      cached_at TEXT NOT NULL,
      PRIMARY KEY (site, ncc_campaign_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_nad_site_date ON ${TABLE}(site, date DESC);
    CREATE INDEX IF NOT EXISTS idx_nad_campaign ON ${TABLE}(site, ncc_campaign_id, date DESC);
  `);
  ready = true;
};

export const bootstrapNaverAdsDailyTable = () => ensureTable(getCrmDb());

export type NaverAdsDailyUpsert = {
  site: string;
  nccCampaignId: string;
  campaignName: string;
  campaignTp: string;
  campaignStatus: string;
  date: string;
  impCnt: number;
  clkCnt: number;
  ctrPct?: number | null;
  cpcKrw?: number | null;
  salesAmtKrw: number;
  convAmtKrw: number;
  ccnt?: number;
  crtoPct?: number | null;
};

export const upsertNaverAdsDaily = (rows: NaverAdsDailyUpsert[]): number => {
  if (rows.length === 0) return 0;
  const db = getCrmDb();
  ensureTable(db);
  const stmt = db.prepare(`
    INSERT INTO ${TABLE} (
      site, ncc_campaign_id, campaign_name, campaign_tp, campaign_status,
      date, imp_cnt, clk_cnt, ctr_pct, cpc_krw,
      sales_amt_krw, conv_amt_krw, ccnt, crto_pct, cached_at
    ) VALUES (
      @site, @nccCampaignId, @campaignName, @campaignTp, @campaignStatus,
      @date, @impCnt, @clkCnt, @ctrPct, @cpcKrw,
      @salesAmtKrw, @convAmtKrw, @ccnt, @crtoPct, datetime('now')
    )
    ON CONFLICT(site, ncc_campaign_id, date) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      campaign_tp = excluded.campaign_tp,
      campaign_status = excluded.campaign_status,
      imp_cnt = excluded.imp_cnt,
      clk_cnt = excluded.clk_cnt,
      ctr_pct = excluded.ctr_pct,
      cpc_krw = excluded.cpc_krw,
      sales_amt_krw = excluded.sales_amt_krw,
      conv_amt_krw = excluded.conv_amt_krw,
      ccnt = excluded.ccnt,
      crto_pct = excluded.crto_pct,
      cached_at = excluded.cached_at;
  `);
  const tx = db.transaction((items: NaverAdsDailyUpsert[]) => {
    let count = 0;
    for (const item of items) {
      stmt.run({
        site: item.site,
        nccCampaignId: item.nccCampaignId,
        campaignName: item.campaignName,
        campaignTp: item.campaignTp,
        campaignStatus: item.campaignStatus,
        date: item.date,
        impCnt: item.impCnt,
        clkCnt: item.clkCnt,
        ctrPct: item.ctrPct ?? null,
        cpcKrw: item.cpcKrw ?? null,
        salesAmtKrw: item.salesAmtKrw,
        convAmtKrw: item.convAmtKrw,
        ccnt: item.ccnt ?? 0,
        crtoPct: item.crtoPct ?? null,
      });
      count++;
    }
    return count;
  });
  return tx(rows);
};

export const summarizeNaverAdsDaily = (input: {
  site?: string;
  since: string;
  until: string;
}): {
  total_rows: number;
  total_imp: number;
  total_clk: number;
  total_sales_amt_krw: number; // 광고비 합계 (정본)
  total_conv_amt_krw: number;  // 네이버 주장 매출 (참고)
  by_campaign: Array<{
    nccCampaignId: string;
    campaignName: string;
    campaignTp: string;
    campaignStatus: string;
    days: number;
    impCnt: number;
    clkCnt: number;
    salesAmtKrw: number;
    convAmtKrw: number;
    roasNaverClaim: number | null;
  }>;
} => {
  const db = getCrmDb();
  ensureTable(db);
  const site = input.site ?? "biocom";
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS rows, SUM(imp_cnt) AS imp, SUM(clk_cnt) AS clk,
              SUM(sales_amt_krw) AS sales, SUM(conv_amt_krw) AS conv
       FROM ${TABLE} WHERE site = ? AND date >= ? AND date <= ?`,
    )
    .get(site, input.since, input.until) as {
    rows: number; imp: number; clk: number; sales: number; conv: number;
  };
  const byCampaignRows = db
    .prepare(
      `SELECT ncc_campaign_id AS id, campaign_name AS name, campaign_tp AS tp,
              campaign_status AS status,
              COUNT(*) AS days,
              SUM(imp_cnt) AS imp, SUM(clk_cnt) AS clk,
              SUM(sales_amt_krw) AS sales, SUM(conv_amt_krw) AS conv
       FROM ${TABLE} WHERE site = ? AND date >= ? AND date <= ?
       GROUP BY ncc_campaign_id, campaign_name, campaign_tp, campaign_status
       ORDER BY sales DESC`,
    )
    .all(site, input.since, input.until) as Array<{
    id: string; name: string; tp: string; status: string;
    days: number; imp: number; clk: number; sales: number; conv: number;
  }>;
  return {
    total_rows: Number(totalRow.rows) || 0,
    total_imp: Number(totalRow.imp) || 0,
    total_clk: Number(totalRow.clk) || 0,
    total_sales_amt_krw: Number(totalRow.sales) || 0,
    total_conv_amt_krw: Number(totalRow.conv) || 0,
    by_campaign: byCampaignRows.map((r) => ({
      nccCampaignId: r.id,
      campaignName: r.name,
      campaignTp: r.tp,
      campaignStatus: r.status,
      days: Number(r.days) || 0,
      impCnt: Number(r.imp) || 0,
      clkCnt: Number(r.clk) || 0,
      salesAmtKrw: Number(r.sales) || 0,
      convAmtKrw: Number(r.conv) || 0,
      roasNaverClaim: Number(r.sales) > 0 ? Number(r.conv) / Number(r.sales) : null,
    })),
  };
};
