"use client";

import { useEffect, useState } from "react";

const ADS_REPORTING_API_BASE = "https://att.ainativeos.net";
const COFFEE_ACCOUNT_ID = "act_654671961007474";
const COFFEE_CAPI_SNAPSHOT_KST = "2026-04-15 KST";
const COFFEE_CAPI_SOURCE_REPAIR_KST = "2026-04-15 20:53 KST";
const COFFEE_CAPI_CLEAN_START_DATE = "2026-04-16";
const COFFEE_FIRST_CLOSED_DAY_KST = "2026-04-17 아침";
const COFFEE_FIRST_3D_SIGNAL_KST = "2026-04-19 아침";
const COFFEE_FIRST_7D_BASELINE_KST = "2026-04-23 아침";

const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtRoasX = (v: number | null | undefined) => (v != null ? `${v.toFixed(2)}x` : "—");

type CampaignSummary = {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  avgCpc: number;
  totalLandingViews: number;
  totalLeads: number;
  totalPurchases: number;
  totalPurchaseValue?: number;
};

type SiteRoasSummary = {
  site: string;
  spend: number;
  revenue: number;
  roas: number | null;
  orders: number;
  potentialRevenue?: number;
  potentialRoas?: number | null;
  metaPurchaseValue?: number;
  metaPurchaseRoas?: number | null;
  siteConfirmedRevenue: number;
  siteConfirmedOrders: number;
  bestCaseCeilingRoas?: number | null;
};

type Props = { datePreset: string };

export default function CoffeeAttRoasBreakdownCard({ datePreset }: Props) {
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null);
  const [siteSummary, setSiteSummary] = useState<SiteRoasSummary | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch(`${ADS_REPORTING_API_BASE}/api/meta/insights?account_id=${COFFEE_ACCOUNT_ID}&date_preset=${datePreset}&attribution_window=1d_click`, { signal: ac.signal })
        .then((r) => r.json()).catch(() => null),
      fetch(`${ADS_REPORTING_API_BASE}/api/ads/site-summary?date_preset=${datePreset}&attribution_window=1d_click`, { signal: ac.signal })
        .then((r) => r.json()).catch(() => null),
    ]).then(([insights, siteSum]) => {
      if (insights?.ok && insights.summary) setCampaignSummary(insights.summary as CampaignSummary);
      if (siteSum?.ok && Array.isArray(siteSum.sites)) {
        const row = (siteSum.sites as SiteRoasSummary[]).find((s) => s.site === "thecleancoffee");
        setSiteSummary(row ?? null);
      }
    }).catch(() => { /* ignore */ });
    return () => ac.abort();
  }, [datePreset]);

  if (!campaignSummary || !siteSummary) {
    return (
      <div style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 14, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: "0.78rem", color: "#64748b" }}>
        더클린커피 Att ROAS 분해 데이터 로딩 중…
      </div>
    );
  }

  const selectedAttributedRevenue = siteSummary.revenue;
  const selectedAttributedRoas = siteSummary.roas;
  const selectedAttributedOrders = siteSummary.orders;
  const selectedMetaPurchaseValue = siteSummary.metaPurchaseValue ?? campaignSummary.totalPurchaseValue ?? 0;
  const selectedMetaPurchaseRoas = siteSummary.metaPurchaseRoas
    ?? ((campaignSummary.totalPurchaseValue ?? 0) > 0 && campaignSummary.totalSpend > 0
      ? (campaignSummary.totalPurchaseValue ?? 0) / campaignSummary.totalSpend
      : null);
  const selectedSiteConfirmedRevenue = siteSummary.siteConfirmedRevenue;
  const selectedBestCaseCeilingRoas = siteSummary.bestCaseCeilingRoas ?? null;
  const selectedMetaPurchases = campaignSummary.totalPurchases;
  const selectedMetaAov = selectedMetaPurchases > 0 ? selectedMetaPurchaseValue / selectedMetaPurchases : null;
  const selectedMetaCpa = selectedMetaPurchases > 0 ? campaignSummary.totalSpend / selectedMetaPurchases : null;
  const selectedClickToLandingRate = campaignSummary.totalClicks > 0
    ? campaignSummary.totalLandingViews / campaignSummary.totalClicks
    : null;
  const selectedLandingToPurchaseRate = campaignSummary.totalLandingViews > 0
    ? campaignSummary.totalPurchases / campaignSummary.totalLandingViews
    : null;
  const selectedAttShareOfMetaPurchases = selectedMetaPurchases > 0
    ? selectedAttributedOrders / selectedMetaPurchases
    : null;
  const selectedAttShareOfSiteOrders = siteSummary.siteConfirmedOrders > 0
    ? selectedAttributedOrders / siteSummary.siteConfirmedOrders
    : null;

  return (
    <div style={{
      marginBottom: 20,
      padding: "18px 20px",
      borderRadius: 14,
      background: "#f8fafc",
      border: "1px solid #cbd5e1",
      fontSize: "0.76rem",
      color: "#334155",
      lineHeight: 1.75,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: "1 1 520px" }}>
          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>더클린커피 Att ROAS 낮음 원인 분해</strong>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Meta 광고 계정은 연동 완료. 현재 낮은 Att ROAS는 &quot;광고가 곧바로 나쁘다&quot;보다
            <strong> CAPI 전환일이 너무 최신이고, payment_success 식별자 커버리지가 낮아 내부 광고 귀속이 덜 잡히는 상태</strong>로 해석하는 것이 맞습니다.
          </div>
        </div>
        <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", fontSize: "0.68rem", fontWeight: 800 }}>
          clean baseline 대기
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Meta ROAS", value: fmtRoasX(selectedMetaPurchaseRoas), note: `${fmtNum(selectedMetaPurchases)}건 · ${fmtKRW(selectedMetaPurchaseValue)}`, color: "#8b5cf6" },
          { label: "Att ROAS", value: fmtRoasX(selectedAttributedRoas), note: `${fmtNum(selectedAttributedOrders)}건 · ${fmtKRW(selectedAttributedRevenue)}`, color: "#16a34a" },
          { label: "사이트 전체 상한", value: fmtRoasX(selectedBestCaseCeilingRoas), note: `${fmtNum(siteSummary.siteConfirmedOrders)}건 · ${fmtKRW(selectedSiteConfirmedRevenue)}`, color: "#2563eb" },
          { label: "광고 귀속률", value: selectedAttShareOfMetaPurchases != null ? `${(selectedAttShareOfMetaPurchases * 100).toFixed(1)}%` : "—", note: `Att 주문 / Meta 구매`, color: "#d97706" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.66rem", color: "#94a3b8", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: "0.66rem", color: "#64748b" }}>{item.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
          <strong style={{ color: "#0f172a" }}>왜 낮게 보이나</strong>
          <p style={{ margin: "6px 0 0" }}>
            최근 7일 기준 Meta 구매는 {fmtNum(selectedMetaPurchases)}건인데 내부 Attribution confirmed는 {fmtNum(selectedAttributedOrders)}건입니다.
            사이트 전체 confirmed 주문 {fmtNum(siteSummary.siteConfirmedOrders)}건 중 광고 귀속은
            {" "}
            <strong>{selectedAttShareOfSiteOrders != null ? `${(selectedAttShareOfSiteOrders * 100).toFixed(1)}%` : "—"}</strong>만 잡힙니다.
            즉 전환 자체보다 주문 단위 광고 연결이 병목입니다.
          </p>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
          <strong style={{ color: "#0f172a" }}>CAPI 신뢰 시작일</strong>
          <p style={{ margin: "6px 0 0" }}>
            footer/CAPI v3 스냅샷: <strong>{COFFEE_CAPI_SNAPSHOT_KST}</strong>.
            source-label 교정: <strong>{COFFEE_CAPI_SOURCE_REPAIR_KST}</strong>.
            신뢰 시작일은 <strong>{COFFEE_CAPI_CLEAN_START_DATE}</strong>로 둡니다.
            첫 1일 신호는 {COFFEE_FIRST_CLOSED_DAY_KST}, 3일 신호는 {COFFEE_FIRST_3D_SIGNAL_KST}, 7일 baseline은 {COFFEE_FIRST_7D_BASELINE_KST}입니다.
          </p>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
          <strong style={{ color: "#0f172a" }}>지금 운영 판단</strong>
          <p style={{ margin: "6px 0 0" }}>
            클릭→랜딩 {selectedClickToLandingRate != null ? `${(selectedClickToLandingRate * 100).toFixed(1)}%` : "—"},
            랜딩→구매 {selectedLandingToPurchaseRate != null ? `${(selectedLandingToPurchaseRate * 100).toFixed(2)}%` : "—"}라 UX 퍼널은 강합니다.
            CPA는 {selectedMetaCpa != null ? fmtKRW(selectedMetaCpa) : "—"}, Meta AOV는 {selectedMetaAov != null ? fmtKRW(selectedMetaAov) : "—"}입니다.
            7일 clean baseline 전까지 감액보다 유지하면서 식별자 보강을 우선합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
