"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtRoasX = (v: number | null | undefined) => (v != null ? `${v.toFixed(2)}x` : "—");
const formatRoasTooltip = (value: string | number | undefined) => `${Number(value ?? 0).toFixed(2)}x`;

type CampaignRow = {
  campaign_name: string;
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  link_clicks: number;
  landing_page_views: number;
  leads: number;
  purchases: number;
  purchase_value?: number;
};

type DailyRow = {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landing_page_views: number;
  revenue: number;
  roas: number | null;
  confirmedRevenue: number;
  pendingRevenue: number;
  potentialRevenue: number;
  metaPurchaseValue: number;
  confirmedRoas: number | null;
  potentialRoas: number | null;
  metaPurchaseRoas: number | null;
};

type SiteRoasSummary = {
  site: string;
  account_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landing_page_views: number;
  leads: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  orders: number;
  confirmedRevenue: number;
  confirmedOrders: number;
  pendingRevenue: number;
  pendingOrders: number;
  potentialRevenue: number;
  potentialRoas: number | null;
  metaPurchaseValue: number;
  metaPurchaseRoas: number | null;
  siteConfirmedRevenue: number;
  siteConfirmedOrders: number;
  bestCaseCeilingRoas: number | null;
};

type AttributionCampaignRoasRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  orders: number;
};

type AttributionCampaignRoasResponse = {
  ok: boolean;
  account_id: string;
  date_preset: string;
  campaigns: AttributionCampaignRoasRow[];
  summary: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
  };
};

type AliasReviewCandidate = {
  campaignId: string;
  campaignName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  activeAdsets: number;
  activeAds: number;
  landingUrlExamples: string[];
  adsetSamples: string[];
  adSamples: string[];
  selected: boolean;
  rejected: boolean;
};

type AliasReviewItem = {
  aliasKey: string;
  site: string;
  status: string;
  confidence: string;
  familyHint: string;
  reviewReason: string;
  validFrom: string | null;
  validTo: string | null;
  reviewedAt: string | null;
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  rejectedCampaignIds: string[];
  evidence: {
    confirmedOrders: number;
    confirmedRevenue: number;
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRevenue: number;
    totalOrders: number;
    totalRevenue: number;
  };
  candidates: AliasReviewCandidate[];
};

type AliasReviewResponse = {
  ok: boolean;
  site: string;
  generated_at: string;
  summary: {
    totalAliases: number;
    pendingReview: number;
    manualVerified: number;
    rejectedAll: number;
  };
  items: AliasReviewItem[];
  error?: string;
};

const SITES = [
  { site: "biocom", label: "바이오컴", account_id: "act_3138805896402376" },
  { site: "aibio", label: "AIBIO 리커버리랩", account_id: "act_377604674894011" },
  { site: "thecleancoffee", label: "더클린커피", account_id: "act_1382574315626662" },
];

const DATE_PRESETS = [
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
  { value: "last_90d", label: "최근 90일" },
];
const ROAS_LAG_NOTE = "confirmed ledger만 메인 ROAS에 반영한다. 오늘/최근 1~2일 수치는 pending 결제와 PG 확정 지연 때문에 잠정치로 낮게 보일 수 있다.";

const ATTR_WINDOWS = [
  { value: "", label: "기본 (7d클릭+1d조회)", desc: "Meta 기본 설정. 클릭 7일 + 조회 1일" },
  { value: "1d_click", label: "클릭 1일", desc: "광고 클릭 후 24시간 내 구매만 집계" },
  { value: "7d_click", label: "클릭 7일", desc: "광고 클릭 후 7일 내 구매 집계" },
  { value: "28d_click", label: "클릭 28일", desc: "광고 클릭 후 28일 내 구매 집계" },
  { value: "1d_view", label: "조회 1일", desc: "광고를 보기만 하고 24시간 내 구매" },
];

const REVIEW_TARGET_SITES = new Set(["biocom"]);

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const summarizeAliasReviewItems = (items: AliasReviewItem[]) => ({
  totalAliases: items.length,
  pendingReview: items.filter((item) => item.status === "needs_manual_review").length,
  manualVerified: items.filter((item) => item.status === "manual_verified").length,
  rejectedAll: items.filter((item) => item.status === "rejected_all_candidates").length,
});

export default function AdsPage() {
  const [selectedSite, setSelectedSite] = useState(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [attrWindow, setAttrWindow] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignSummary, setCampaignSummary] = useState<{ totalImpressions: number; totalClicks: number; totalSpend: number; avgCpc: number; totalLandingViews: number; totalLeads: number; totalPurchases: number; totalPurchaseValue?: number } | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [siteSummary, setSiteSummary] = useState<{ sites: SiteRoasSummary[]; total: { impressions: number; clicks: number; spend: number; revenue: number; roas: number | null; orders: number } } | null>(null);
  const [campaignRoas, setCampaignRoas] = useState<AttributionCampaignRoasResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSiteData = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, dailyRes, siteSummaryRes, campaignRoasRes] = await Promise.all([
        fetch(`${API_BASE}/api/meta/insights?account_id=${selectedSite.account_id}&date_preset=${datePreset}${attrWindow ? `&attribution_window=${attrWindow}` : ""}`),
        fetch(`${API_BASE}/api/ads/roas/daily?account_id=${selectedSite.account_id}&date_preset=${datePreset}`),
        fetch(`${API_BASE}/api/ads/site-summary?date_preset=${datePreset}`),
        fetch(`${API_BASE}/api/ads/roas?account_id=${selectedSite.account_id}&date_preset=${datePreset}`),
      ]);
      const insightsData = await insightsRes.json();
      const dailyData = await dailyRes.json();
      const siteSummaryData = await siteSummaryRes.json();
      const campaignRoasData = await campaignRoasRes.json();
      if (insightsData.ok) {
        setCampaigns(insightsData.rows ?? []);
        setCampaignSummary(insightsData.summary ?? null);
      }
      if (dailyData.ok) setDaily(dailyData.rows ?? []);
      if (siteSummaryData.ok) setSiteSummary(siteSummaryData);
      if (campaignRoasData.ok) setCampaignRoas(campaignRoasData);
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedSite, datePreset, attrWindow]);

  useEffect(() => { loadSiteData(); }, [loadSiteData]);

  const selectedSiteSummary = siteSummary?.sites.find((site) => site.site === selectedSite.site) ?? null;
  const selectedAccountId = selectedSiteSummary?.account_id ?? selectedSite.account_id;
  const selectedAttributedRevenue = selectedSiteSummary?.revenue ?? 0;
  const selectedAttributedRoas = selectedSiteSummary?.roas ?? null;
  const selectedAttributedOrders = selectedSiteSummary?.orders ?? 0;
  const selectedPendingRevenue = selectedSiteSummary?.pendingRevenue ?? 0;
  const selectedPendingOrders = selectedSiteSummary?.pendingOrders ?? 0;
  const selectedPotentialRevenue = selectedSiteSummary?.potentialRevenue ?? selectedAttributedRevenue + selectedPendingRevenue;
  const selectedPotentialRoas = selectedSiteSummary?.potentialRoas ?? null;
  const selectedMetaPurchaseValue = selectedSiteSummary?.metaPurchaseValue ?? campaignSummary?.totalPurchaseValue ?? 0;
  const selectedMetaPurchaseRoas = selectedSiteSummary?.metaPurchaseRoas
    ?? (campaignSummary && (campaignSummary.totalPurchaseValue ?? 0) > 0 && campaignSummary.totalSpend > 0
      ? campaignSummary.totalPurchaseValue! / campaignSummary.totalSpend
      : null);
  const selectedSiteConfirmedRevenue = selectedSiteSummary?.siteConfirmedRevenue ?? 0;
  const selectedBestCaseCeilingRoas = selectedSiteSummary?.bestCaseCeilingRoas ?? null;
  const unmappedRow = campaignRoas?.campaigns.find((row) => row.campaignName === "(unmapped)") ?? null;
  const totalAttributedRevenueForMapping = campaignRoas?.summary.attributedRevenue ?? 0;
  const unmappedRevenueShare = unmappedRow && totalAttributedRevenueForMapping > 0
    ? unmappedRow.attributedRevenue / totalAttributedRevenueForMapping
    : null;
  const selectedRoasGapRatio =
    selectedAttributedRoas != null
    && selectedAttributedRoas > 0
    && selectedMetaPurchaseRoas != null
      ? selectedMetaPurchaseRoas / selectedAttributedRoas
      : null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Link href="/" style={{ fontSize: "0.78rem", color: "#6366f1", textDecoration: "none" }}>← 대시보드로 돌아가기</Link>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>광고 성과 대시보드</h1>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
            Meta 집행 지표와 Attribution 기준 ROAS를 함께 본다
            {" · "}
            <Link href="/ads/roas" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>ROAS 대시보드 →</Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {DATE_PRESETS.map((dp) => (
            <button key={dp.value} onClick={() => setDatePreset(dp.value)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.75rem", fontWeight: 600,
              background: datePreset === dp.value ? "#6366f1" : "#fff",
              color: datePreset === dp.value ? "#fff" : "#64748b",
              cursor: "pointer",
            }}>{dp.label}</button>
          ))}
        </div>
      </div>

      {/* Attribution Window 필터 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>전환 기준</span>
        {ATTR_WINDOWS.map((aw) => (
          <button key={aw.value} onClick={() => setAttrWindow(aw.value)} title={aw.desc} style={{
            padding: "5px 10px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
            border: attrWindow === aw.value ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
            background: attrWindow === aw.value ? "#f5f3ff" : "#fff",
            color: attrWindow === aw.value ? "#6d28d9" : "#64748b",
          }}>{aw.label}</button>
        ))}
      </div>

      {/* 3사이트 오버뷰 */}
      {siteSummary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {SITES.map((s) => {
            const data = siteSummary.sites.find((o) => o.site === s.site);
            const isActive = data && data.spend > 0;
            const isSelected = selectedSite.site === s.site;
            return (
              <div key={s.site} onClick={() => setSelectedSite(s)} style={{
                padding: "16px 20px", borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                border: isSelected ? "2px solid #6366f1" : "1px solid #e2e8f0",
                background: isSelected ? "rgba(99,102,241,0.04)" : "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{s.label}</span>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    background: isActive ? "#f0fdf4" : "#f1f5f9",
                    color: isActive ? "#16a34a" : "#94a3b8",
                  }}>{isActive ? "집행 중" : "미집행"}</span>
                </div>
                {data && data.spend > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>비용</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{fmtKRW(data.spend)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>ROAS</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: data.roas != null && data.roas >= 1 ? "#16a34a" : data.roas != null ? "#dc2626" : "#94a3b8" }}>
                        {data.roas != null ? `${data.roas.toFixed(2)}x` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>광고 귀속 매출</div>
                      <div style={{ fontSize: "0.82rem", color: "#475569" }}>{fmtKRW(data.revenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>주문</div>
                      <div style={{ fontSize: "0.82rem", color: "#475569" }}>{fmtNum(data.orders)}건</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", paddingTop: 8 }}>최근 30일 광고 집행 없음</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 선택된 사이트 상세 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{selectedSite.label} 상세</h2>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>계정: {selectedAccountId}</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>로딩 중...</div>
      ) : (
        <>
          {/* KPI 카드 */}
          {campaignSummary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { label: "노출", value: fmtNum(campaignSummary.totalImpressions), color: "#6366f1" },
                { label: "클릭", value: fmtNum(campaignSummary.totalClicks), color: "#3b82f6" },
                { label: "비용", value: fmtKRW(campaignSummary.totalSpend), color: "#ef4444" },
                { label: "평균 CPC", value: fmtKRW(campaignSummary.avgCpc), color: "#f59e0b" },
                { label: "랜딩 뷰", value: fmtNum(campaignSummary.totalLandingViews), color: "#10b981" },
                { label: "전환", value: String(campaignSummary.totalLeads + campaignSummary.totalPurchases), color: "#8b5cf6" },
              ].map((kpi) => (
                <div key={kpi.label} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* 전환 상세 + 전환 매출 */}
          {campaignSummary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #f5f3ff, #fff)", border: "1px solid #e0e7ff" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>Meta purchase ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#8b5cf6" }}>
                  {fmtRoasX(selectedMetaPurchaseRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  Ads Manager purchase value <strong>{fmtKRW(selectedMetaPurchaseValue)}</strong> / 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong> 기준이오.
                  Meta purchase 이벤트 {fmtNum(campaignSummary.totalPurchases)}건을 같이 보되, 운영 메인값으로는 쓰지 않소.
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>Attribution confirmed ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#16a34a" }}>
                  {fmtRoasX(selectedAttributedRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  confirmed attribution 매출 <strong>{fmtKRW(selectedAttributedRevenue)}</strong> / 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong> 기준이오.
                  현재 선택 사이트의 광고 귀속 확정 주문 {fmtNum(selectedAttributedOrders)}건을 기반으로 계산함. {ROAS_LAG_NOTE}
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #fffbeb, #fff)", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>confirmed + pending ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d97706" }}>
                  {fmtRoasX(selectedPotentialRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  confirmed <strong>{fmtKRW(selectedAttributedRevenue)}</strong> + pending <strong>{fmtKRW(selectedPendingRevenue)}</strong> = <strong>{fmtKRW(selectedPotentialRevenue)}</strong> 기준이오.
                  "확정 지연 때문인지, 실제 효율 저하인지"를 구분하는 보조값이며 pending 주문 {fmtNum(selectedPendingOrders)}건이 포함되오.
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #eff6ff, #fff)", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>best-case ceiling</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#2563eb" }}>
                  {fmtRoasX(selectedBestCaseCeilingRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  선택 사이트 confirmed 매출 전체 <strong>{fmtKRW(selectedSiteConfirmedRevenue)}</strong>를 전부 Meta에 몰아준 상한선이오.
                  Meta purchase ROAS가 이 값보다 과하게 크면, 플랫폼 귀속 과대나 이벤트 품질 문제를 더 의심해야 하오.
                </div>
              </div>
            </div>
          )}

          {campaignSummary && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#475569", lineHeight: 1.7 }}>
              <strong style={{ color: "#0f172a" }}>ROAS 기준 정리</strong>: 이 페이지와 <Link href="/ads/roas" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>/ads/roas</Link>는 모두 <strong>Attribution 기준 ROAS</strong>를 메인으로 사용한다.
              Meta 구매 이벤트 기준 ROAS는
              {" "}
              <strong>{selectedMetaPurchaseRoas != null ? `${selectedMetaPurchaseRoas.toFixed(2)}x` : "—"}</strong>
              로 별도 참고만 하시오. 픽셀 purchase value는 쿠키 차단, 가상계좌, CAPI 누락 여부에 따라 실제 Toss 확정 매출과 차이가 날 수 있소. 또한 {ROAS_LAG_NOTE}
            </div>
          )}

          {campaignSummary && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.76rem", color: "#7c2d12", lineHeight: 1.75 }}>
              <strong style={{ color: "#9a3412" }}>Attribution 기준 ROAS 설명</strong>: 이 값은 <strong>광고비 대비, attribution ledger에서 실제로 Meta로 귀속됐고 `payment_status=confirmed`까지 된 매출</strong>만 나눈 수치요.
              기존 ROAS처럼 Ads Manager의 <strong>purchase value / spend</strong>를 그대로 쓰지 않으므로 보통 더 낮고 보수적으로 보이오.
              {selectedMetaPurchaseRoas != null && selectedAttributedRoas != null && (
                <>
                  {" "}
                  현재 선택 사이트 기준으로는 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong>에 대해,
                  Meta purchase value는 <strong>{fmtKRW(selectedMetaPurchaseValue)}</strong>라서 <strong>{selectedMetaPurchaseRoas.toFixed(2)}x</strong>,
                  confirmed attribution revenue는 <strong>{fmtKRW(selectedAttributedRevenue)}</strong>라서 <strong>{selectedAttributedRoas.toFixed(2)}x</strong>,
                  confirmed+pending은 <strong>{fmtKRW(selectedPotentialRevenue)}</strong>라서 <strong>{selectedPotentialRoas != null ? `${selectedPotentialRoas.toFixed(2)}x` : "—"}</strong>요.
                  두 값의 차이는 현재 약 <strong>{selectedRoasGapRatio != null ? `${selectedRoasGapRatio.toFixed(1)}배` : "—"}</strong>요.
                </>
              )}
              {" "}
              특히 최근 30일·90일처럼 범위를 넓히면 attribution live rollout 이전 광고비가 같이 들어와 ROAS가 더 낮아 보일 수 있으니, 비교할 때는 최근 7일·14일과 함께 읽는 편이 안전하오.
            </div>
          )}

          {campaignRoas && unmappedRow && unmappedRow.attributedRevenue > 0 && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.76rem", color: "#7c2d12", lineHeight: 1.75 }}>
              <strong style={{ color: "#9a3412" }}>(unmapped) revenue 경고</strong>: 현재 선택 사이트 confirmed attribution 매출 중
              {" "}
              <strong>{fmtKRW(unmappedRow.attributedRevenue)}</strong>
              {" "}
              ({unmappedRevenueShare != null ? `${(unmappedRevenueShare * 100).toFixed(1)}%` : "—"})
              가 아직 Meta 실제 캠페인으로 나뉘지 않았소. 즉 사이트 전체 Attribution ROAS 해석은 가능하지만, 캠페인 drill-down은 아직 불완전하오.
              {" "}
              <strong>{selectedSite.site === "biocom" ? "아래 alias 검토 섹션에서 yes / no로 수동 검증을 진행하면 된다." : "campaign별 Attribution 해석은 seed 매핑 전까지 보수적으로 읽어야 한다."}</strong>
            </div>
          )}

          {/* 일별 추이 차트 */}
          {daily.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일별 비용</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} labelFormatter={(l) => `${l}`} />
                    <Bar dataKey="spend" fill="#ef4444" radius={[4, 4, 0, 0]} name="비용" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일별 ROAS 비교</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
                    <Tooltip formatter={formatRoasTooltip} />
                    <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
                    <Line type="monotone" dataKey="confirmedRoas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed" />
                    <Line type="monotone" dataKey="potentialRoas" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed+pending" />
                    <Line type="monotone" dataKey="metaPurchaseRoas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Meta purchase" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {daily.length > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일자별 비교표</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      {["날짜", "광고비", "Meta purchase", "Attr confirmed", "Attr pending", "Attr potential", "Meta ROAS", "Attr ROAS", "Potential ROAS"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((row) => (
                      <tr key={row.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#1e293b" }}>{row.date}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{fmtKRW(row.spend)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6", fontWeight: 600 }}>{fmtKRW(row.metaPurchaseValue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmtKRW(row.confirmedRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{fmtKRW(row.pendingRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f766e", fontWeight: 600 }}>{fmtKRW(row.potentialRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6" }}>{row.metaPurchaseRoas != null ? `${row.metaPurchaseRoas.toFixed(2)}x` : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a" }}>{row.confirmedRoas != null ? `${row.confirmedRoas.toFixed(2)}x` : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706" }}>{row.potentialRoas != null ? `${row.potentialRoas.toFixed(2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 전환 퍼널 */}
          {campaignSummary && campaignSummary.totalImpressions > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>전환 퍼널</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[
                  { label: "노출", value: campaignSummary.totalImpressions, color: "#6366f1" },
                  { label: "클릭", value: campaignSummary.totalClicks, color: "#3b82f6" },
                  { label: "랜딩 뷰", value: campaignSummary.totalLandingViews, color: "#10b981" },
                  { label: "전환", value: campaignSummary.totalLeads + campaignSummary.totalPurchases, color: "#8b5cf6" },
                ].map((step, i, arr) => (
                  <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: step.color }}>{fmtNum(step.value)}</div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{step.label}</div>
                      {i > 0 && arr[i - 1].value > 0 && (
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2 }}>
                          {((step.value / arr[i - 1].value) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    {i < arr.length - 1 && <div style={{ color: "#cbd5e1", fontSize: "1.2rem" }}>→</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 캠페인별 테이블 */}
          {campaigns.length > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>캠페인별 성과</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      {["캠페인", "노출", "클릭", "CTR", "비용", "CPC", "CPM", "랜딩뷰", "전환", "전환매출", "ROAS"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.campaign_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#1e293b", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.campaign_name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtNum(c.impressions)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtNum(c.clicks)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{c.ctr.toFixed(2)}%</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{fmtKRW(c.spend)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtKRW(c.cpc)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtKRW(c.cpm)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#10b981" }}>{fmtNum(c.landing_page_views)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{c.leads + c.purchases}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: (c.purchase_value ?? 0) > 0 ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
                          {(c.purchase_value ?? 0) > 0 ? fmtKRW(c.purchase_value!) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: c.spend > 0 && (c.purchase_value ?? 0) > 0 ? (c.purchase_value! / c.spend >= 3 ? "#16a34a" : c.purchase_value! / c.spend >= 1 ? "#d97706" : "#dc2626") : "#94a3b8" }}>
                          {c.spend > 0 && (c.purchase_value ?? 0) > 0 ? `${(c.purchase_value! / c.spend).toFixed(2)}x` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {campaigns.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", background: "#f8fafc", borderRadius: 14 }}>
              {selectedSite.label}에 해당 기간 광고 데이터가 없습니다.
            </div>
          )}

          <CampaignAliasReviewSection selectedSite={selectedSite} />

          {/* AI 인사이트 */}
          {campaignSummary && campaignSummary.totalSpend > 0 && (() => {
            const cpa = campaignSummary.totalPurchases > 0 ? campaignSummary.totalSpend / campaignSummary.totalPurchases : 0;
            const ctr = campaignSummary.totalClicks / Math.max(campaignSummary.totalImpressions, 1);
            const landingRate = campaignSummary.totalLandingViews / Math.max(campaignSummary.totalClicks, 1);
            const convRate = campaignSummary.totalPurchases / Math.max(campaignSummary.totalLandingViews, 1);
            const metaRoas = (campaignSummary.totalPurchaseValue ?? 0) > 0 ? campaignSummary.totalPurchaseValue! / campaignSummary.totalSpend : 0;
            const avgOrderValue = campaignSummary.totalPurchases > 0 ? (campaignSummary.totalPurchaseValue ?? 0) / campaignSummary.totalPurchases : 0;
            const dailySpend = campaignSummary.totalSpend / 30;

            return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
              {/* Claude Code — 퍼널 분석 + 액션 */}
              <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #eef2ff, #fff)", border: "1px solid #c7d2fe" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🤖"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#4338ca" }}>Claude Code — 퍼널 분석 및 성장 기회</strong>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 2 }}>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>1. 퍼널 병목 진단</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      노출 {fmtNum(campaignSummary.totalImpressions)} → 클릭 {fmtNum(campaignSummary.totalClicks)} (CTR {(ctr * 100).toFixed(1)}%)
                      → 랜딩뷰 {fmtNum(campaignSummary.totalLandingViews)} (클릭 대비 {(landingRate * 100).toFixed(0)}%)
                      → 구매 {fmtNum(campaignSummary.totalPurchases)} (랜딩뷰 대비 {(convRate * 100).toFixed(1)}%).
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#6366f1" }}>
                      {landingRate < 0.5
                        ? `클릭의 ${((1 - landingRate) * 100).toFixed(0)}%가 랜딩 페이지 로딩 전에 이탈. 페이지 속도 개선이 가장 큰 기회.`
                        : convRate < 0.005
                          ? `랜딩까지는 잘 오지만 구매 전환율이 ${(convRate * 100).toFixed(2)}%로 낮음. 랜딩 페이지의 CTA/오퍼/가격 구조 점검 필요.`
                          : `퍼널 전체가 건강한 편. 클릭→랜딩 ${(landingRate * 100).toFixed(0)}%, 랜딩→구매 ${(convRate * 100).toFixed(1)}% 모두 양호.`}
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>2. 단위 경제성 (Unit Economics)</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      CPA {fmtKRW(Math.round(cpa))} · 평균 주문액 {fmtKRW(Math.round(avgOrderValue))} · Meta ROAS {metaRoas.toFixed(2)}x.
                    </p>
                    <p style={{ margin: "4px 0 0" }}>
                      {avgOrderValue > 0
                        ? `고객 1명 확보에 ${fmtKRW(Math.round(cpa))}를 쓰고, 첫 구매에서 ${fmtKRW(Math.round(avgOrderValue))}를 얻는다.
                           ${cpa < avgOrderValue * 0.3
                             ? "CPA가 주문액의 30% 미만이라 첫 구매에서 이미 수익. 공격적 확대 가능."
                             : cpa < avgOrderValue
                               ? "CPA < 주문액이라 손익분기는 넘지만, 마진율에 따라 첫 구매에서 수익이 날 수도, 아닐 수도 있음. 재구매까지 봐야 진짜 ROI."
                               : "CPA > 주문액이라 첫 구매에서는 적자. 재구매 LTV가 CPA를 커버하는지 반드시 확인 필요."}`
                        : "전환 매출 데이터가 없어 단위 경제성을 계산할 수 없음."}
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>3. 소재 효율 분석</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      CTR {(ctr * 100).toFixed(1)}%는 {ctr > 0.03 ? "3% 이상으로 매우 높음. 소재 매력도가 뛰어남." : ctr > 0.015 ? "업계 평균(1~2%) 이상. 현재 소재를 유지하되 2주 주기로 새 소재 테스트 권장." : "1.5% 미만. 소재 피로도(ad fatigue)가 의심됨. 이미지/카피/훅을 교체하고 A/B 테스트 필요."}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.76rem" }}>
                      팁: 같은 오퍼라도 고객 후기 기반 소재 vs 제품 이미지 소재의 CTR 차이가 2~3배까지 남. UGC(사용자 생성 콘텐츠) 소재 테스트를 추천.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>4. Attribution Window 권장 — Claude Code 의견</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      <strong>권장: 7d_click (클릭 7일)</strong>을 기본 기준으로 쓸 것.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>1d_click</strong>은 너무 보수적 — 검사키트/영양제는 고관여 상품이라 클릭 당일 바로 사지 않음. 비교/검토 시간이 필요.</li>
                      <li><strong>7d_click</strong>이 가장 현실적 — 건강기능식품/검사키트의 평균 구매 결정 기간은 2~5일. 클릭 후 7일이면 대부분의 진짜 전환을 잡음.</li>
                      <li><strong>28d_click</strong>은 과대 계상 위험 — 28일이면 다른 채널(검색, 직접 방문)에서 자연 유입된 구매도 Meta 전환으로 잡힐 가능성. 실제 광고 효과보다 부풀어 보임.</li>
                      <li><strong>1d_view</strong>는 참고용만 — "광고를 보기만 하고 구매"는 우연의 일치일 가능성이 높음. 예산 판단에는 사용하지 않을 것.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#6366f1", fontWeight: 600, fontSize: "0.76rem" }}>
                      실무 팁: Meta 광고 관리자의 "기여 설정"과 이 대시보드의 기준을 7d_click으로 통일하면, 양쪽 숫자가 일치하여 보고 시 혼동이 없어짐.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #c7d2fe" }}>
                    <strong style={{ color: "#4338ca" }}>5. 즉시 실행 가능한 액션 3가지</strong>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li style={{ marginBottom: 4 }}>
                        <strong>캠페인별 ROAS 정리</strong>: 위 테이블에서 전환 0인 캠페인의 예산을 ROAS 상위 3개에 재배분 → 같은 예산으로 전환 20~30% 증가 기대.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>CAPI 활성화</strong>: 현재 브라우저 픽셀만 사용 중. 서버사이드 전환(CAPI)을 켜면 iOS 사용자 전환이 30~50% 더 잡혀 Meta AI 최적화 품질이 올라감. <a href="/ads/roas" style={{ color: "#6366f1" }}>ROAS 대시보드</a>에서 CAPI 전송 현황 확인 가능.
                      </li>
                      <li>
                        <strong>리타겟팅 세분화</strong>: 랜딩뷰 {fmtNum(campaignSummary.totalLandingViews)}명 중 구매 안 한 {fmtNum(campaignSummary.totalLandingViews - campaignSummary.totalPurchases)}명을 대상으로 7일/14일 리타겟팅 광고 세트 분리. 통상 리타겟팅 ROAS는 프로스펙팅의 2~5배.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Codex — 데이터 정합성 + 전략 */}
              <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🧠"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#166534" }}>Codex — 데이터 정합성 및 전략 제안</strong>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 2 }}>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>1. 전환 데이터 신뢰도 평가</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      Meta 기준 전환 {fmtNum(campaignSummary.totalPurchases)}건 · 매출 {(campaignSummary.totalPurchaseValue ?? 0) > 0 ? fmtKRW(campaignSummary.totalPurchaseValue!) : "미수집"}. 이 숫자를 그대로 믿으면 안 되는 이유가 3가지 있음.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>Attribution window</strong>: Meta는 "클릭 7일 + 조회 1일" 기여 모델을 사용. 고객이 광고를 보고 3일 후에 직접 URL 입력해서 구매해도 Meta 전환으로 잡힘. GA4 "마지막 클릭" 기준과 차이가 남.</li>
                      <li><strong>iOS 14+ 누락</strong>: 현재 브라우저 픽셀만 사용 중이라 iOS Safari 사용자의 전환이 30~50% 누락될 수 있음. 즉, 실제 전환은 {fmtNum(campaignSummary.totalPurchases)}건보다 더 많을 가능성.</li>
                      <li><strong>가상계좌 이슈</strong>: 아임웹에서 가상계좌 주문도 결제 완료 페이지에 도달하여 픽셀이 발화됨. 미입금 취소 건이 전환에 포함됐을 수 있음.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      해결: CAPI(서버사이드 전환)를 활성화하고, Toss API로 DONE 상태만 전송하면 위 3가지 문제가 모두 완화됨. 이미 구현 완료(Phase 5-S3), 테스트 발송만 남음.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>2. 예산 최적화 — 파레토 분석</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      일 평균 광고비 약 {fmtKRW(Math.round(dailySpend))}. 캠페인별 ROAS 편차가 크다면 (위 테이블 참조), 상위 20% 캠페인이 전체 전환의 80%를 만들고 있을 가능성이 높음.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>Step 1</strong>: 전환 0인 캠페인의 예산을 즉시 줄이거나 정지</li>
                      <li><strong>Step 2</strong>: ROAS 상위 3개 캠페인에 예산 집중 (CBO 또는 수동)</li>
                      <li><strong>Step 3</strong>: 2주 후 ROAS 변화를 <a href="/ads/roas" style={{ color: "#16a34a" }}>ROAS 대시보드</a>에서 비교</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "0.76rem" }}>
                      주의: 인지도 캠페인(브랜딩)은 ROAS가 낮아도 의도적일 수 있음. 캠페인 목적(전환 vs 인지도)을 구분해서 판단할 것.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>3. 다음 단계 — 증분 측정(Incrementality)</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      현재 ROAS {metaRoas > 0 ? metaRoas.toFixed(1) + "x" : "—"}는 "광고를 클릭한 사람의 매출"이지, "광고 덕분에 생긴 매출"이 아님. 이 차이가 중요한 이유:
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li>ROAS 5x여도, 광고 없이 자연 검색으로 샀을 고객이 80%라면 실제 iROAS는 1x에 불과</li>
                      <li>반대로 ROAS 2x여도 전부 신규 고객이라면 iROAS도 2x → 가장 가치 있는 광고비</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      해결: Phase 7의 증분 실험(holdout 테스트)을 실행하면 "광고를 끄면 매출이 얼마나 줄까?"를 직접 측정 가능. iROAS 엔진은 이미 구현 완료(Phase 5.5-S3).
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>4. Attribution Window 권장 — Codex 의견</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      <strong>데이터 엔지니어 관점에서 7d_click을 기본으로 하되, 1d_click과 병행 모니터링</strong>할 것.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>왜 7d_click인가</strong>: Meta 광고 관리자의 기본 최적화 기준이 "7일 클릭 + 1일 조회"임. 우리 대시보드도 같은 기준을 쓰면 Meta Ads Manager와 숫자가 비슷해져서 크로스체크가 가능.</li>
                      <li><strong>왜 1d_click도 봐야 하는가</strong>: 1d_click은 "광고가 즉시 행동을 유발한" 가장 순수한 신호. 이게 높은 캠페인은 소재/오퍼가 강력하다는 증거. ROAS 최적화 시 1d_click ROAS가 높은 캠페인부터 예산을 늘리는 게 안전.</li>
                      <li><strong>28d_click은 전략 점검용</strong>: 28d와 7d의 차이가 큰 캠페인은 "고객이 오래 고민하고 사는" 상품. 이런 캠페인에는 리타겟팅을 강화하면 7d 전환을 끌어올릴 수 있음.</li>
                      <li><strong>CAPI와의 관계</strong>: 서버사이드 전환(CAPI)을 켜면 1d_click 숫자가 가장 많이 올라감. iOS에서 누락되던 즉시 전환이 복구되기 때문. CAPI 적용 전/후를 1d_click 기준으로 비교하면 CAPI 효과를 가장 명확하게 측정 가능.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      자동화 제안: 매주 월요일 7d_click vs 28d_click 전환 비율을 자동 산출하여, 비율 변화가 크면 알림. 비율이 갑자기 올라가면 "고객 구매 결정이 느려지고 있다"는 시그널 → 오퍼/가격/UX 점검 필요.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                    <strong style={{ color: "#166534" }}>5. 로드맵 — 다음에 개발할 것</strong>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li style={{ marginBottom: 4 }}>
                        <strong>CAPI 테스트 발송</strong> → Events Manager에서 수신 확인 → 운영 전환. iOS 전환 복구로 Meta AI 최적화 품질 향상.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>캠페인별 ROAS 자동 경고</strong>: ROAS가 1x 미만으로 3일 연속 떨어지면 슬랙/알림톡으로 자동 알림. 예산 낭비 조기 차단.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>광고 → CRM 연결</strong>: Meta 광고로 유입된 고객이 CRM 알림톡을 받고 재구매하면, 광고의 진짜 LTV 기여분을 산출. 현재 attribution ledger + 발송 로그로 기술적으로 가능.
                      </li>
                      <li>
                        <strong>크리에이티브 A/B 자동 리포트</strong>: 소재별(이미지/카피) CTR·CPA·ROAS를 자동 비교하여 승자/패자 소재를 식별. 마케터가 매주 수동으로 분석하는 시간을 절약.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* CAPI 현황 + 가설 검증 */}
          <CapiStatusSection />

          {/* 캠페인 관리 */}
          <CampaignManagerSection selectedSite={selectedSite!} />

          {/* UX 분석 · Clarity 현황 */}
          {campaignSummary && campaignSummary.totalLandingViews > 0 && (() => {
            const clickToLanding = campaignSummary.totalLandingViews / Math.max(campaignSummary.totalClicks, 1);
            const totalConversions = campaignSummary.totalLeads + campaignSummary.totalPurchases;
            const landingToConv = totalConversions / Math.max(campaignSummary.totalLandingViews, 1);
            const droppedClicks = campaignSummary.totalClicks - campaignSummary.totalLandingViews;
            const isLeadSite = selectedSite.site === "aibio";
            const convLabel = isLeadSite ? "리드(상담예약)" : "구매";
            const convBenchmark = isLeadSite ? "리드 전환율 벤치마크: 3~8%" : "구매 전환율 벤치마크: 1~3%";

            return (
            <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #fff7ed, #fff)", border: "1px solid #fed7aa", marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🔥"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#c2410c" }}>퍼널 병목 · Clarity UX 분석 — {selectedSite.label}</strong>
                </div>
                <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>
                  Clarity 3사이트 설치 완료
                </span>
              </div>

              {/* 병목 현황 KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: clickToLanding < 0.6 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${clickToLanding < 0.6 ? "#fecaca" : "#bbf7d0"}` }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>클릭 → 랜딩뷰</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: clickToLanding < 0.6 ? "#dc2626" : "#16a34a" }}>{(clickToLanding * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                    {clickToLanding < 0.6 ? `이탈 ${fmtNum(droppedClicks)}건 — 업계 평균(60~70%) 미달` : clickToLanding > 0.85 ? `양호 (업계 평균 60~70%)` : "정상 범위"}
                  </div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>랜딩뷰 → {convLabel} 전환율</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: landingToConv > 0.01 ? "#16a34a" : "#d97706" }}>{(landingToConv * 100).toFixed(2)}%</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>{convBenchmark}</div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{convLabel} 전환</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalConversions > 0 ? "#16a34a" : "#d97706" }}>{fmtNum(totalConversions)}건</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                    {totalConversions > 0 ? `비용 대비 ${fmtKRW(campaignSummary.totalSpend / totalConversions)}/건` : isLeadSite ? "리드 캠페인 데이터 축적 중" : "전환 데이터 확인 필요"}
                  </div>
                </div>
              </div>

              {/* Clarity 운영 현황 */}
              <div style={{ padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong style={{ fontSize: "0.82rem", color: "#16a34a" }}>Microsoft Clarity — 운영 중</strong>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                      3사이트 GTM 연동 완료 (바이오컴 · AIBIO · 더클린커피) · 봇 감지 ON · 세션 리플레이 수집 중
                    </div>
                  </div>
                  <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                    border: "1px solid #16a34a", background: "#fff", color: "#16a34a", textDecoration: "none",
                  }}>
                    Clarity 대시보드 →
                  </a>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 }}>
                  {[
                    { label: "Dead clicks", desc: "클릭했는데 반응 없는 UI", where: "Dashboard" },
                    { label: "Rage clicks", desc: "연속 클릭 = 사용자 좌절", where: "Dashboard" },
                    { label: "스크롤 depth", desc: "CTA까지 도달하는 비율", where: "Heatmaps" },
                    { label: "세션 리플레이", desc: "이탈자 행동 패턴 추적", where: "Recordings" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "8px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.72rem" }}>
                      <div style={{ fontWeight: 700, color: "#334155" }}>{item.label}</div>
                      <div style={{ color: "#64748b", marginTop: 2 }}>{item.desc}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.64rem", marginTop: 2 }}>위치: {item.where}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 사이트별 Claude Code vs Codex 인사이트 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e0e7ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: "0.9rem" }}>{"🤖"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>Claude Code — {selectedSite.label} 분석</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                    {isLeadSite ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#16a34a" }}>랜딩뷰 우수 — 전환 최적화가 핵심</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            클릭→랜딩뷰 {(clickToLanding * 100).toFixed(1)}%로 양호. 페이지 속도 문제 아님.
                            핵심은 랜딩뷰→리드(상담예약) 전환율 개선.
                            Clarity 히트맵으로 상담 예약 폼까지 스크롤하는 비율, 폼 입력 중 이탈 지점 확인.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe", marginBottom: 10 }}>
                          <strong style={{ color: "#4338ca" }}>리드 캠페인 전환 추적</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            LEADS 캠페인 활성화됨. Meta AI가 "상담 예약 가능성 높은 사람"에게 최적화 시작.
                            generate_lead 이벤트(GTM)가 Meta 픽셀 Lead로 매핑되어 전환 집계됨.
                            리드 50건 이상 쌓이면 CPL(리드당 비용) 안정화 예상.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <strong style={{ color: "#d97706" }}>Clarity에서 확인할 것</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>상담 예약 CTA 버튼까지 스크롤 도달률</li>
                            <li style={{ marginBottom: 3 }}>모바일 vs 데스크톱 폼 제출 완료율 비교</li>
                            <li>Rage clicks — 예약 버튼/가격 영역에서 좌절 패턴</li>
                          </ol>
                        </div>
                      </>
                    ) : selectedSite.site === "thecleancoffee" ? (
                      <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
                        <strong style={{ color: "#d97706" }}>Meta 광고 계정 미연동</strong>
                        <p style={{ margin: "4px 0 0" }}>
                          더클린커피 Meta 광고 데이터가 연결되지 않아 퍼널 분석 불가.
                          Clarity는 설치 완료 — 사이트 방문자 UX 분석은 가능.
                          광고 계정 연동 후 퍼널 데이터 확인 가능.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 10 }}>
                          <strong style={{ color: "#dc2626" }}>1순위: 페이지 속도 개선</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            클릭→랜딩뷰 {(100 - clickToLanding * 100).toFixed(0)}% 이탈은 페이지 도달 전 이탈.
                            Clarity JS 로드 전에 사용자가 떠나므로 세션이 기록되지 않는 구간.
                            PageSpeed 진단 → LCP/FCP 개선이 최우선. 상세 분석은 랜딩뷰 분석 페이지에서.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#16a34a" }}>Clarity 역할: 랜딩뷰→구매 전환율</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            현재 {(landingToConv * 100).toFixed(2)}% 전환율을 2%로 올리면 월 +{fmtNum(Math.round(campaignSummary.totalLandingViews * 0.0075))}건 추가 전환.
                            히트맵/세션 리플레이로 CTA 위치, 스크롤 depth, 결제 퍼널 이탈 지점 분석.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                          <strong style={{ color: "#4338ca" }}>즉시 실행</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}><strong>PageSpeed 진단</strong>: {selectedSite.label} 랜딩 페이지 LCP/FCP/CLS 확인</li>
                            <li style={{ marginBottom: 3 }}><strong>Clarity Dead clicks</strong>: 클릭했는데 반응 없는 UI 요소 탐색</li>
                            <li><strong>결제 퍼널 리플레이</strong>: 장바구니→결제 이탈 세션 확인</li>
                          </ol>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1px solid #bbf7d0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: "0.9rem" }}>{"🧠"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "#166534" }}>Codex — {selectedSite.label} 제안</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                    {isLeadSite ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>리드 퍼널 벤치마크</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            오프라인 서비스 리드 전환율 벤치마크: 3~8%.
                            현재 {(landingToConv * 100).toFixed(2)}%{landingToConv < 0.03 ? " — 벤치마크 미달. CTA 가시성, 폼 간소화 필요." : " — 양호 범위."}
                            리드 캠페인 데이터가 50건+ 쌓이면 CPL 기준으로 입찰 전략 전환 가능.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>Clarity 분석 우선순위</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>모바일 상담 예약 폼 완료율 (대부분 모바일 유입)</li>
                            <li style={{ marginBottom: 3 }}>가격/서비스 설명 영역 체류 시간</li>
                            <li style={{ marginBottom: 3 }}>후기/리뷰 섹션 스크롤 도달률</li>
                            <li>경쟁사 대비 CTA 배치 A/B 테스트</li>
                          </ol>
                        </div>
                      </>
                    ) : selectedSite.site === "thecleancoffee" ? (
                      <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <strong style={{ color: "#166534" }}>Clarity만으로 가능한 분석</strong>
                        <p style={{ margin: "4px 0 0" }}>
                          Meta 연동 전이라도 자연 유입 방문자의 UX 분석 가능.
                          상품 페이지 Dead clicks, 장바구니 이탈, 모바일 결제 UX를 먼저 분석.
                          광고 계정 연동 후 캠페인별 UTM 필터링으로 광고 유입 분석 시작.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>도구별 현황</strong>
                          <table style={{ width: "100%", fontSize: "0.72rem", borderCollapse: "collapse", marginTop: 6 }}>
                            <tbody>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>Microsoft Clarity</td>
                                <td style={{ padding: "4px 6px" }}>무제한 세션 리플레이, 히트맵, Rage click</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>운영 중</td>
                              </tr>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>CAPI</td>
                                <td style={{ padding: "4px 6px" }}>서버사이드 전환 추적 (iOS 복구)</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>운영 중</td>
                              </tr>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>GA4</td>
                                <td style={{ padding: "4px 6px" }}>디바이스별/캠페인별 이탈률 세분화</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>연동 완료</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>Hotjar 유료</td>
                                <td style={{ padding: "4px 6px" }}>설문/피드백 위젯이 필요할 때</td>
                                <td style={{ padding: "4px 6px", color: "#94a3b8" }}>필요시 판단</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                          <strong style={{ color: "#166534" }}>고도화 로드맵</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>Clarity 2주 데이터 축적 후 첫 UX 병목 보고서</li>
                            <li style={{ marginBottom: 3 }}>캠페인별 랜딩 URL 성과 비교 대시보드</li>
                            <li style={{ marginBottom: 3 }}>경량 랜딩 페이지 A/B 테스트 (LCP 1~2초 목표)</li>
                            <li>Clarity API 연동 (세션 수/Dead clicks 자동 표시)</li>
                          </ol>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 상세 분석 링크 */}
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <a href="/ads/landing" style={{ fontSize: "0.82rem", color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
                  랜딩뷰 상세 분석 · PageSpeed · Clarity 가이드 →
                </a>
              </div>
            </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function CampaignAliasReviewSection({ selectedSite }: { selectedSite: { site: string; label: string; account_id: string } }) {
  const [review, setReview] = useState<AliasReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const loadReview = useCallback(async () => {
    if (!REVIEW_TARGET_SITES.has(selectedSite.site)) {
      setReview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ads/campaign-alias-review?site=${selectedSite.site}`);
      const data = await res.json() as AliasReviewResponse;
      if (!data.ok) {
        setReview(null);
        setError(data.error ?? "alias review load failed");
        return;
      }
      setReview(data);
    } catch {
      setReview(null);
      setError("alias review load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedSite.site]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleDecision = async (aliasKey: string, campaignId: string, decision: "yes" | "no") => {
    const actionKey = `${aliasKey}:${campaignId}:${decision}`;
    setActionLoading(actionKey);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ads/campaign-alias-review/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: selectedSite.site,
          aliasKey,
          campaignId,
          decision,
        }),
      });
      const data = await res.json() as { ok: boolean; item?: AliasReviewItem; error?: string };
      if (!data.ok || !data.item) {
        setError(data.error ?? "alias review decision failed");
        return;
      }
      setReview((current) => {
        if (!current) return current;
        const items = current.items
          .map((item) => item.aliasKey === data.item!.aliasKey ? data.item! : item)
          .sort((a, b) => {
            const statusPriority = (status: string) => {
              if (status === "needs_manual_review") return 0;
              if (status === "manual_verified") return 1;
              if (status === "rejected_all_candidates") return 2;
              return 3;
            };

            return statusPriority(a.status) - statusPriority(b.status)
              || b.evidence.confirmedRevenue - a.evidence.confirmedRevenue
              || b.evidence.confirmedOrders - a.evidence.confirmedOrders
              || a.aliasKey.localeCompare(b.aliasKey);
          });
        return {
          ...current,
          summary: summarizeAliasReviewItems(items),
          items,
        };
      });
    } catch {
      setError("alias review decision failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (!REVIEW_TARGET_SITES.has(selectedSite.site)) return null;

  const visibleItems = showResolved
    ? review?.items ?? []
    : (review?.items ?? []).filter((item) => item.status === "needs_manual_review");

  return (
    <div style={{ padding: "20px 22px", borderRadius: 14, background: "linear-gradient(180deg, #f8fafc, #fff)", border: "1px solid #e2e8f0", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>utm_campaign alias 검토</h3>
          <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.7 }}>
            JSON 대신 여기서 alias 후보를 보고 <strong>yes / no</strong>를 누르면 수동 seed에 바로 반영되오.
            현재는 <strong>link_url만으로는 부족</strong>하므로, campaign spend, adset/ad 이름, landing URL 유무를 같이 보고 판단하시오.
          </div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 6 }}>
            마지막 audit 생성 시각: {review?.generated_at ? formatDateTime(review.generated_at) : "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowResolved((current) => !current)}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#475569",
            cursor: "pointer",
            fontSize: "0.72rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {showResolved ? "검토 필요만 보기" : "완료 항목도 보기"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "전체 alias", value: review?.summary.totalAliases ?? 0, color: "#0f172a" },
          { label: "검토 필요", value: review?.summary.pendingReview ?? 0, color: "#d97706" },
          { label: "yes 확정", value: review?.summary.manualVerified ?? 0, color: "#16a34a" },
          { label: "전부 no", value: review?.summary.rejectedAll ?? 0, color: "#dc2626" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{item.label}</div>
            <div style={{ fontSize: "1.08rem", fontWeight: 800, color: item.color }}>{fmtNum(item.value)}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.76rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: "0.78rem" }}>alias review 로딩 중...</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: 12, border: "1px dashed #cbd5e1", fontSize: "0.78rem" }}>
          {showResolved ? "표시할 alias review 항목이 없소." : "현재 남은 미확정 alias가 없소."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleItems.map((item) => {
            const statusStyle = item.status === "manual_verified"
              ? { background: "#dcfce7", color: "#166534", label: "yes 확정" }
              : item.status === "rejected_all_candidates"
                ? { background: "#fee2e2", color: "#991b1b", label: "전부 no" }
                : { background: "#fef3c7", color: "#92400e", label: "검토 필요" };

            return (
              <div key={item.aliasKey} style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <strong style={{ fontSize: "0.84rem", color: "#0f172a" }}>{item.aliasKey}</strong>
                      <span style={{
                        fontSize: "0.66rem",
                        fontWeight: 700,
                        padding: "3px 7px",
                        borderRadius: 999,
                        background: statusStyle.background,
                        color: statusStyle.color,
                      }}>
                        {statusStyle.label}
                      </span>
                      {item.familyHint && (
                        <span style={{ fontSize: "0.66rem", color: "#6366f1", background: "#eef2ff", padding: "3px 7px", borderRadius: 999, fontWeight: 700 }}>
                          {item.familyHint}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.7 }}>
                      {item.reviewReason}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", textAlign: "right", whiteSpace: "nowrap" }}>
                    reviewed: {formatDateTime(item.reviewedAt)}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "confirmed", value: `${fmtNum(item.evidence.confirmedOrders)}건 · ${fmtKRW(item.evidence.confirmedRevenue)}`, color: "#16a34a" },
                    { label: "pending", value: `${fmtNum(item.evidence.pendingOrders)}건 · ${fmtKRW(item.evidence.pendingRevenue)}`, color: "#d97706" },
                    { label: "전체 주문", value: `${fmtNum(item.evidence.totalOrders)}건`, color: "#0f172a" },
                    { label: "선택 결과", value: item.selectedCampaignName ?? "아직 없음", color: item.selectedCampaignName ? "#16a34a" : "#64748b" },
                  ].map((meta) => (
                    <div key={meta.label} style={{ padding: "9px 10px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.64rem", color: "#94a3b8" }}>{meta.label}</div>
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: meta.color, lineHeight: 1.5 }}>{meta.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {item.candidates.map((candidate) => {
                    const decisionPrefix = `${item.aliasKey}:${candidate.campaignId}:`;
                    const metaRoas = candidate.spend > 0 && candidate.purchaseValue > 0
                      ? candidate.purchaseValue / candidate.spend
                      : null;

                    return (
                      <div key={candidate.campaignId} style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: candidate.selected
                          ? "2px solid #16a34a"
                          : candidate.rejected
                            ? "1px solid #fecaca"
                            : "1px solid #dbeafe",
                        background: candidate.selected
                          ? "#f0fdf4"
                          : candidate.rejected
                            ? "#fef2f2"
                            : "#f8fafc",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: "0.79rem", fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{candidate.campaignName}</div>
                            <div style={{ fontSize: "0.67rem", color: "#94a3b8" }}>{candidate.campaignId}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={Boolean(actionLoading)}
                              onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "yes")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                border: "1px solid #16a34a",
                                background: candidate.selected ? "#16a34a" : "#fff",
                                color: candidate.selected ? "#fff" : "#16a34a",
                                cursor: actionLoading ? "not-allowed" : "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                opacity: actionLoading && actionLoading !== `${decisionPrefix}yes` ? 0.5 : 1,
                              }}
                            >
                              {actionLoading === `${decisionPrefix}yes` ? "저장 중..." : "yes"}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionLoading)}
                              onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "no")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                border: "1px solid #dc2626",
                                background: candidate.rejected ? "#dc2626" : "#fff",
                                color: candidate.rejected ? "#fff" : "#dc2626",
                                cursor: actionLoading ? "not-allowed" : "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                opacity: actionLoading && actionLoading !== `${decisionPrefix}no` ? 0.5 : 1,
                              }}
                            >
                              {actionLoading === `${decisionPrefix}no` ? "저장 중..." : "no"}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
                          {[
                            { label: "spend", value: fmtKRW(candidate.spend), color: "#ef4444" },
                            { label: "purchase value", value: fmtKRW(candidate.purchaseValue), color: "#16a34a" },
                            { label: "Meta ROAS", value: metaRoas != null ? `${metaRoas.toFixed(2)}x` : "—", color: "#d97706" },
                            { label: "active adsets", value: fmtNum(candidate.activeAdsets), color: "#0f172a" },
                            { label: "active ads", value: fmtNum(candidate.activeAds), color: "#0f172a" },
                          ].map((stat) => (
                            <div key={stat.label} style={{ padding: "8px 9px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
                              <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{stat.label}</div>
                              <div style={{ fontSize: "0.74rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
                          <div style={{ padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.64rem", color: "#94a3b8", marginBottom: 4 }}>landing URL 힌트</div>
                            <div style={{ fontSize: "0.7rem", color: "#334155", lineHeight: 1.6, wordBreak: "break-all" }}>
                              {candidate.landingUrlExamples.length > 0
                                ? candidate.landingUrlExamples.join(" | ")
                                : "audit에서 link_url 대부분 null. adset/ad name 기준으로 수동 판단 필요"}
                            </div>
                          </div>
                          <div style={{ padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.64rem", color: "#94a3b8", marginBottom: 4 }}>대표 adset</div>
                            <div style={{ fontSize: "0.7rem", color: "#334155", lineHeight: 1.6 }}>
                              {candidate.adsetSamples.length > 0 ? candidate.adsetSamples.join(" · ") : "—"}
                            </div>
                          </div>
                          <div style={{ padding: "9px 10px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.64rem", color: "#94a3b8", marginBottom: 4 }}>대표 ad</div>
                            <div style={{ fontSize: "0.7rem", color: "#334155", lineHeight: 1.6 }}>
                              {candidate.adSamples.length > 0 ? candidate.adSamples.join(" · ") : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type TrackingInfo = {
  optimizationGoal: string;
  pixelId: string | null;
  pageId: string | null;
  customEventType: string | null;
  trackingType: "website_lead" | "instant_form" | "pixel_purchase" | "landing_page" | "unknown";
  trackingLabel: string;
};

type CampaignHealth = {
  id: string; name: string; objective: string; objectiveLabel: string;
  status: string; dailyBudget: number | null; issues: string[]; healthy: boolean;
  impressions?: number; clicks?: number; spend?: number; ctr?: number;
  resultLabel?: string; resultValue?: number; resultCost?: number;
  signal?: "green" | "yellow" | "red";
  tracking?: TrackingInfo | null;
};

type CampaignDetail = {
  adsets: Array<{
    id: string; name: string; status: string; dailyBudget: number | null; optimizationGoal: string | null;
    promotedObject?: { pixelId: string | null; pageId: string | null; customEventType: string | null } | null;
    targeting: { geo: string; age: string };
    ads: Array<{ id: string; name: string; status: string; thumbnailUrl: string | null; imageUrl?: string | null; title: string | null; body: string | null; impressions: number; clicks: number; spend: number; isVideo?: boolean; videoId?: string | null; landingUrl?: string | null; landingDomain?: string | null; isExternalLanding?: boolean }>;
  }>;
};

function CampaignManagerSection({ selectedSite }: { selectedSite: { site: string; label: string; account_id: string } }) {
  const [campaigns, setCampaigns] = useState<CampaignHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggleDetail = async (campaignId: string) => {
    if (expandedCampaign === campaignId) { setExpandedCampaign(null); return; }
    setExpandedCampaign(campaignId);
    setDetailLoading(true);
    setCampaignDetail(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/${campaignId}/detail`);
      const d = await res.json();
      if (d.ok) setCampaignDetail(d);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  // 새 캠페인 준비
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(() => {
    const now = new Date();
    const ts = `${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    return `${selectedSite.label} 리드 캠페인 ${ts}`;
  });
  const [newBudget, setNewBudget] = useState(50000);
  const [newObjective, setNewObjective] = useState("OUTCOME_LEADS");
  const [createResult, setCreateResult] = useState<{ ok: boolean; campaignId?: string; error?: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const loadHealth = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/meta/campaigns/health?account_id=${selectedSite.account_id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCampaigns(d.campaigns ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHealth(); }, [selectedSite.account_id]);

  const handleAction = async (campaignId: string, action: "pause" | "activate") => {
    setActionLoading(campaignId);
    setActionResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/${campaignId}/${action}`, { method: "POST" });
      const d = await res.json();
      setActionResult({ id: campaignId, msg: d.ok ? `${action === "pause" ? "일시정지" : "활성화"} 완료` : (d.error ?? "실패"), ok: d.ok });
      if (d.ok) loadHealth();
    } catch { setActionResult({ id: campaignId, msg: "요청 실패", ok: false }); }
    finally { setActionLoading(null); }
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedSite.account_id, name: newName, objective: newObjective, dailyBudget: newBudget, status: "PAUSED" }),
      });
      const d = await res.json();
      setCreateResult({ ok: d.ok, campaignId: d.campaignId, error: d.error });
      if (d.ok) { loadHealth(); setShowCreate(false); }
    } catch { setCreateResult({ ok: false, error: "요청 실패" }); }
    finally { setCreating(false); }
  };

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const issueCount = campaigns.filter((c) => c.issues.length > 0).length;

  return (
    <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #fefce8, #fff)", border: "1px solid #fde68a", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.1rem" }}>{"🎯"}</span>
          <strong style={{ fontSize: "0.92rem", color: "#92400e" }}>캠페인 관리 — {selectedSite.label}</strong>
          {issueCount > 0 && (
            <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontWeight: 700 }}>
              문제 {issueCount}건
            </span>
          )}
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)} style={{
          padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
          border: "1px solid #6366f1", background: showCreate ? "#6366f1" : "#fff", color: showCreate ? "#fff" : "#6366f1",
        }}>
          {showCreate ? "취소" : "+ 새 캠페인 준비"}
        </button>
      </div>

      {/* 새 캠페인 생성 폼 */}
      {showCreate && (
        <div style={{ padding: "16px 18px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 16 }}>
          <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>새 캠페인 생성 (PAUSED 상태로 생성됨)</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>캠페인 이름</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>목표</label>
              <select value={newObjective} onChange={(e) => setNewObjective(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }}>
                <option value="OUTCOME_LEADS">리드 (폼 제출/상담 예약)</option>
                <option value="OUTCOME_SALES">매출 (구매)</option>
                <option value="OUTCOME_TRAFFIC">트래픽 (클릭)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>일 예산 (원)</label>
              <input type="number" value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
              background: "#6366f1", color: "#fff", border: "none",
            }}>
              {creating ? "생성 중..." : "Meta에 캠페인 생성 (PAUSED)"}
            </button>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              PAUSED 상태로 생성됨. 광고세트와 소재는 Meta 광고 관리자에서 추가 설정 필요.
            </span>
          </div>
          {createResult && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: createResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${createResult.ok ? "#bbf7d0" : "#fecaca"}`, fontSize: "0.78rem", color: createResult.ok ? "#16a34a" : "#dc2626" }}>
              {createResult.ok ? `캠페인 생성 완료 (ID: ${createResult.campaignId}). Meta 광고 관리자에서 광고세트/소재를 설정하세요.` : `실패: ${createResult.error}`}
            </div>
          )}
        </div>
      )}

      {/* 캠페인 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: "0.82rem" }}>캠페인 목록 로딩 중...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: "0.82rem" }}>캠페인 없음</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #fde68a" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#92400e", fontSize: "0.64rem" }}></th>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#92400e", fontSize: "0.64rem" }}>캠페인</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>목표</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>추적</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>상태</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>결과</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>결과당 비용</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>CTR</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>지출</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <React.Fragment key={c.id}>
                <tr onClick={() => toggleDetail(c.id)} style={{ borderBottom: "1px solid #fef3c7", background: expandedCampaign === c.id ? "#fefce8" : c.signal === "red" ? "#fef2f2" : c.signal === "yellow" ? "#fffbeb" : undefined, cursor: "pointer" }}>
                  {/* 신호등 */}
                  <td style={{ padding: "6px 4px", textAlign: "center", width: 28 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.signal === "green" ? "#16a34a" : c.signal === "red" ? "#dc2626" : "#d97706", margin: "0 auto" }} title={c.issues.length > 0 ? c.issues[0] : "양호"} />
                  </td>
                  {/* 캠페인명 */}
                  <td style={{ padding: "6px 8px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ marginRight: 4, fontSize: "0.55rem", color: "#94a3b8" }}>{expandedCampaign === c.id ? "▼" : "▶"}</span>
                    {c.name}
                    {c.issues.length > 0 && <div style={{ fontSize: "0.58rem", color: "#dc2626", fontWeight: 400, whiteSpace: "normal", lineHeight: 1.3, marginTop: 2 }}>{c.issues[0]?.slice(0, 50)}</div>}
                  </td>
                  {/* 목표 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 600,
                      background: c.objective === "OUTCOME_LEADS" ? "#dcfce7" : c.objective === "OUTCOME_SALES" ? "#dbeafe" : "#fef3c7",
                      color: c.objective === "OUTCOME_LEADS" ? "#16a34a" : c.objective === "OUTCOME_SALES" ? "#2563eb" : "#92400e",
                    }}>
                      {c.objectiveLabel}
                    </span>
                  </td>
                  {/* 추적 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    {c.tracking ? (() => {
                      const t = c.tracking;
                      const colorMap: Record<string, { bg: string; color: string; border: string }> = {
                        website_lead: { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" },
                        pixel_purchase: { bg: "#dbeafe", color: "#2563eb", border: "#bfdbfe" },
                        instant_form: { bg: "#f3e8ff", color: "#7c3aed", border: "#e9d5ff" },
                        landing_page: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
                        unknown: { bg: "#f1f5f9", color: "#94a3b8", border: "#e2e8f0" },
                      };
                      const style = colorMap[t.trackingType] ?? colorMap.unknown;
                      const shortLabel: Record<string, string> = {
                        website_lead: "웹 리드",
                        pixel_purchase: "구매 픽셀",
                        instant_form: "인스턴트 폼",
                        landing_page: "랜딩뷰만",
                        unknown: "미설정",
                      };
                      return (
                        <span title={t.trackingLabel} style={{
                          display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: "0.58rem", fontWeight: 600,
                          background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                          maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {shortLabel[t.trackingType] ?? "미설정"}
                          {t.pixelId && <span style={{ fontSize: "0.5rem", opacity: 0.7, marginLeft: 2 }}>({t.pixelId.slice(-4)})</span>}
                        </span>
                      );
                    })() : (
                      <span style={{ fontSize: "0.58rem", color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  {/* 상태 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: c.status === "ACTIVE" ? "#16a34a" : "#94a3b8" }}>
                      {c.status === "ACTIVE" ? "활성" : "정지"}
                    </span>
                  </td>
                  {/* 결과 (목표별 분기) */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.resultValue ?? 0) > 0 ? (
                      <div>
                        <strong style={{ color: "#334155" }}>{fmtNum(c.resultValue!)}</strong>
                        <div style={{ fontSize: "0.58rem", color: "#94a3b8" }}>{c.resultLabel}</div>
                      </div>
                    ) : c.status === "ACTIVE" ? (
                      <span style={{ fontSize: "0.68rem", color: "#dc2626" }}>0</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  {/* 결과당 비용 */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.resultCost ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem" }}>{fmtKRW(c.resultCost!)}</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  {/* CTR */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.ctr ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem", color: (c.ctr ?? 0) > 2 ? "#16a34a" : "#d97706" }}>{(c.ctr ?? 0).toFixed(1)}%</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  {/* 지출 */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.spend ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem" }}>{fmtKRW(c.spend!)}</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {c.status === "ACTIVE" ? (
                      <button type="button" onClick={() => handleAction(c.id, "pause")} disabled={actionLoading === c.id} style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                        border: "1px solid #fecaca", background: "#fff", color: "#dc2626",
                      }}>
                        {actionLoading === c.id ? "..." : "일시정지"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleAction(c.id, "activate")} disabled={actionLoading === c.id} style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                        border: "1px solid #bbf7d0", background: "#fff", color: "#16a34a",
                      }}>
                        {actionLoading === c.id ? "..." : "활성화"}
                      </button>
                    )}
                  </td>
                </tr>
                {/* 상세 펼침 — 소재 썸네일 + 타겟 */}
                {expandedCampaign === c.id && (
                  <tr>
                    <td colSpan={10} style={{ padding: "12px 18px", background: "#fefce8" }}>
                      {detailLoading ? (
                        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", padding: 12 }}>소재 정보 로딩 중...</div>
                      ) : campaignDetail ? (
                        <>
                          {campaignDetail.adsets.map((as) => (
                            <div key={as.id} style={{ marginBottom: 12 }}>
                              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                                <strong style={{ fontSize: "0.78rem", color: "#92400e" }}>{as.name}</strong>
                                <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#fff", border: "1px solid #e2e8f0", color: "#64748b" }}>
                                  타겟: {as.targeting.geo} · {as.targeting.age}
                                </span>
                                {as.optimizationGoal && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#eef2ff", color: "#6366f1" }}>
                                    최적화: {as.optimizationGoal === "LANDING_PAGE_VIEWS" ? "랜딩뷰" : as.optimizationGoal === "LEAD_GENERATION" ? "리드" : as.optimizationGoal === "OFFSITE_CONVERSIONS" ? "전환(구매)" : as.optimizationGoal}
                                  </span>
                                )}
                                {as.promotedObject && (as.promotedObject.pixelId || as.promotedObject.pageId) && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: as.promotedObject.pixelId ? "#dcfce7" : "#f3e8ff", color: as.promotedObject.pixelId ? "#16a34a" : "#7c3aed", border: `1px solid ${as.promotedObject.pixelId ? "#bbf7d0" : "#e9d5ff"}` }}>
                                    {as.promotedObject.pixelId ? (
                                      <>픽셀: ...{as.promotedObject.pixelId.slice(-6)}{as.promotedObject.customEventType && ` · 이벤트: ${as.promotedObject.customEventType}`}</>
                                    ) : (
                                      <>페이지: ...{as.promotedObject.pageId!.slice(-6)}</>
                                    )}
                                  </span>
                                )}
                                {as.promotedObject === null && as.optimizationGoal !== "LANDING_PAGE_VIEWS" && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                    promoted_object 미설정
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {as.ads.map((ad) => (
                                  <div key={ad.id} style={{
                                    width: 160, padding: "8px", borderRadius: 8,
                                    background: "#fff", border: `1px solid ${ad.status === "ACTIVE" ? "#bbf7d0" : "#e2e8f0"}`,
                                    opacity: ad.status === "ACTIVE" ? 1 : 0.6,
                                  }}>
                                    {ad.thumbnailUrl ? (
                                      <a href={ad.isVideo && ad.videoId ? `https://www.facebook.com/watch/?v=${ad.videoId}` : (ad.imageUrl || ad.thumbnailUrl)} target="_blank" rel="noopener noreferrer" title={ad.isVideo ? "영상 보기 (Facebook)" : "이미지 크게 보기"}>
                                        <div style={{ position: "relative" }}>
                                          <img src={ad.thumbnailUrl} alt={ad.name} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4, cursor: "pointer" }} />
                                          {ad.isVideo && (
                                            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <div style={{ width: 0, height: 0, borderLeft: "10px solid #fff", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />
                                            </div>
                                          )}
                                        </div>
                                      </a>
                                    ) : (
                                      <div style={{ width: "100%", height: 90, background: "#f1f5f9", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", color: "#94a3b8" }}>썸네일 없음</div>
                                    )}
                                    <div style={{ fontSize: "0.54rem", marginTop: 2, marginBottom: 2 }}>
                                      <span style={{ padding: "1px 4px", borderRadius: 3, fontSize: "0.5rem", fontWeight: 600, background: ad.isVideo ? "#dbeafe" : "#f3e8ff", color: ad.isVideo ? "#2563eb" : "#7c3aed" }}>
                                        {ad.isVideo ? "영상" : "이미지"}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: "0.64rem", fontWeight: 600, color: "#334155", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.name}>{ad.name}</div>
                                    <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                                      <span style={{ color: ad.status === "ACTIVE" ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>{ad.status === "ACTIVE" ? "활성" : "정지"}</span>
                                      {" · 노출 "}{ad.impressions.toLocaleString()}{" · 클릭 "}{ad.clicks.toLocaleString()}
                                    </div>
                                    {ad.spend > 0 && <div style={{ fontSize: "0.58rem", color: "#d97706" }}>비용 ₩{ad.spend.toLocaleString()}</div>}
                                    {ad.title && <div style={{ fontSize: "0.58rem", color: "#6366f1", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.title}>{ad.title}</div>}
                                    {ad.body && <div style={{ fontSize: "0.54rem", color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.body}>{ad.body}</div>}
                                    {/* 랜딩 도메인 표시 */}
                                    {ad.landingDomain ? (
                                      <div style={{ marginTop: 3 }}>
                                        <span title={ad.landingUrl ?? ""} style={{
                                          display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: "0.5rem", fontWeight: 600,
                                          background: ad.isExternalLanding ? "#fef2f2" : "#f0fdf4",
                                          color: ad.isExternalLanding ? "#dc2626" : "#16a34a",
                                          border: `1px solid ${ad.isExternalLanding ? "#fecaca" : "#bbf7d0"}`,
                                        }}>
                                          {ad.isExternalLanding ? "⚠ " : ""}{ad.landingDomain}
                                        </span>
                                        {ad.isExternalLanding && (
                                          <div style={{ fontSize: "0.48rem", color: "#dc2626", marginTop: 1 }}>픽셀 추적 불가</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: 3 }}>
                                        <span style={{ fontSize: "0.5rem", color: "#94a3b8", fontStyle: "italic" }}>랜딩 URL 미확인</span>
                                      </div>
                                    )}
                                    <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                                      <a href={`https://www.facebook.com/ads/manager/creation/creative/?act=${selectedSite.account_id.replace("act_","")}&selected_adsets=${as.id}&selected_ads=${ad.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.54rem", color: "#6366f1", textDecoration: "none" }}>Meta에서 보기</a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {actionResult && (
            <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, background: actionResult.ok ? "#f0fdf4" : "#fef2f2", fontSize: "0.72rem", color: actionResult.ok ? "#16a34a" : "#dc2626" }}>
              {actionResult.msg}
            </div>
          )}
        </div>
      )}

      {/* LEADS로 복사 — 트래픽 캠페인이 있을 때 */}
      {campaigns.some((c) => c.objective === "OUTCOME_TRAFFIC" && c.status === "ACTIVE") && (
        <CloneAsLeadsSection accountId={selectedSite.account_id} campaigns={campaigns} onDone={loadHealth} />
      )}

      {/* 목표 문제 안내 */}
      {issueCount > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.76rem", color: "#dc2626", lineHeight: 1.7 }}>
          <strong>캠페인 목표 경고:</strong> 트래픽(TRAFFIC) 목표 캠페인은 Meta AI가 "클릭 많이 하는 사람"에게 광고를 보여줌. 전환(구매/리드) 최적화가 안 됨.
          기존 캠페인의 목표는 변경 불가(Meta 제한) — 위 "LEADS로 복사" 버튼으로 기존 소재를 유지하면서 목표만 바꾼 새 캠페인을 만들 수 있음.
        </div>
      )}

      {/* 전환 이벤트 설명 */}
      <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <strong style={{ fontSize: "0.82rem", color: "#334155" }}>전환 이벤트란?</strong>
        <p style={{ fontSize: "0.76rem", color: "#64748b", margin: "6px 0 10px", lineHeight: 1.7 }}>
          Meta 광고를 돌릴 때, "이 광고가 성과를 냈는지" 판단하는 기준이다.
          캠페인 목표에 따라 어떤 행동을 "성공"으로 볼지가 달라진다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#dcfce7", border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>리드 (generate_lead)</div>
            <div style={{ fontSize: "0.68rem", color: "#166534", marginTop: 4, lineHeight: 1.5 }}>
              고객이 상담 폼을 제출. AIBIO처럼 쇼핑몰이 없는 서비스에 적합.
              Meta AI가 "폼 제출 가능성 높은 사람"에게 광고를 보여줌.
            </div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#dbeafe", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2563eb" }}>구매 (purchase)</div>
            <div style={{ fontSize: "0.68rem", color: "#1e40af", marginTop: 4, lineHeight: 1.5 }}>
              고객이 상품을 결제. 바이오컴처럼 온라인 쇼핑몰이 있는 경우에 적합.
              Meta AI가 "구매 가능성 높은 사람"에게 광고를 보여줌.
            </div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fde68a" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e" }}>트래픽 (landing_page_view)</div>
            <div style={{ fontSize: "0.68rem", color: "#78350f", marginTop: 4, lineHeight: 1.5 }}>
              고객이 페이지를 방문. "많이 보여주기"만 할 때 사용.
              Meta AI가 "클릭 잘 하는 사람"에게 노출 → 전환 최적화 안 됨.
            </div>
          </div>
        </div>
      </div>

      {/* 외부 랜딩 도메인 경고 — 소재 중 네이버 등 외부 도메인이 있으면 표시 */}
      {expandedCampaign && campaignDetail && campaignDetail.adsets.some((as) => as.ads.some((ad) => ad.isExternalLanding)) && (
        <div style={{ marginTop: 12, padding: "16px 18px", borderRadius: 10, background: "linear-gradient(180deg, #fef2f2, #fff)", border: "1px solid #fecaca" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: "1rem" }}>{"⚠️"}</span>
            <strong style={{ fontSize: "0.85rem", color: "#dc2626" }}>외부 도메인 랜딩 — 전환 추적 불가 감지</strong>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>
            일부 소재가 네이버 플레이스/예약 등 외부 도메인으로 랜딩하고 있소.
            이 도메인에는 Meta 픽셀과 GTM 태그가 설치되지 않아 <strong>전환(리드/구매)이 집계되지 않소</strong>.
          </div>

          {/* 외부 도메인 소재 목록 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>전환 추적 불가 소재:</div>
            {campaignDetail.adsets.flatMap((as) => as.ads.filter((ad) => ad.isExternalLanding).map((ad) => (
              <div key={ad.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", marginBottom: 4, borderRadius: 4, background: "#fff5f5", fontSize: "0.72rem" }}>
                <span style={{ padding: "1px 6px", borderRadius: 3, background: "#fecaca", color: "#991b1b", fontWeight: 600, fontSize: "0.6rem" }}>{ad.landingDomain}</span>
                <span style={{ color: "#334155" }}>{ad.name}</span>
                <span style={{ color: "#94a3b8", fontSize: "0.64rem" }}>{ad.status === "ACTIVE" ? "활성" : "정지"}</span>
              </div>
            )))}
          </div>

          {/* 해결 방안 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "0.9rem" }}>{"🤖"}</span>
                <strong style={{ fontSize: "0.78rem", color: "#4338ca" }}>Claude Code 분석</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#334155", lineHeight: 1.7 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 8 }}>
                  <strong style={{ color: "#dc2626" }}>문제:</strong> 네이버 플레이스/예약에는 커스텀 스크립트(Meta 픽셀, GTM) 삽입 불가. 네이버가 제공하는 플랫폼이라 HTML 편집 권한 없음.
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 8 }}>
                  <strong style={{ color: "#d97706" }}>영향:</strong>{"\n"}
                  · LEADS 캠페인에서 이 소재 전환 = 0 → Meta AI가 이 소재를 비효율로 판단{"\n"}
                  · Meta가 자사몰 소재에만 예산 집중 → 네이버 예약 유입 감소{"\n"}
                  · CPL 과대평가 (실제 리드보다 적게 잡힘)
                </div>
                <strong style={{ color: "#4338ca" }}>해결 방안 (권장순):</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: "0.72rem" }}>
                  <li style={{ marginBottom: 4 }}><strong>자사몰 랜딩 통일</strong> — 가장 확실. 모든 소재를 aibio.kr로 변경하면 픽셀 추적 + CAPI 모두 작동</li>
                  <li style={{ marginBottom: 4 }}><strong>네이버 소재 분리</strong> — LEADS 캠페인에서 제외하고 별도 TRAFFIC 광고세트로 유지. Meta AI 학습 왜곡 방지</li>
                  <li style={{ marginBottom: 4 }}><strong>UTM + GA4 우회</strong> — 네이버 URL에 UTM 파라미터 붙여 GA4에서 추적. Meta 전환에는 안 잡히지만 성과 측정은 가능</li>
                  <li><strong>네이버 예약 API 연동</strong> — 네이버 예약 완료를 서버에서 감지 → Meta CAPI로 전송. 기술적 난이도 높음</li>
                </ol>
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "0.9rem" }}>{"🧠"}</span>
                <strong style={{ fontSize: "0.78rem", color: "#166534" }}>Codex 분석</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#334155", lineHeight: 1.7 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 8 }}>
                  <strong style={{ color: "#166534" }}>기술적 확인:</strong>{"\n"}
                  · 네이버 플레이스(map.naver.com): 사업자 커스텀 HTML 삽입 불가{"\n"}
                  · 네이버 예약(booking.naver.com): 예약 위젯 커스텀 불가{"\n"}
                  · 두 도메인 모두 네이버 SaaS 플랫폼 → 서드파티 JS 주입 차단
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#ecfdf5", border: "1px solid #bbf7d0", marginBottom: 8 }}>
                  <strong style={{ color: "#166534" }}>CAPI 서버사이드 접근:</strong>{"\n"}
                  현재 CAPI 구현(metaCapi.ts)은 Toss 결제 기반이오. 네이버 예약의 경우:{"\n"}
                  · 네이버 예약 API(비공개) 또는 웹훅이 필요{"\n"}
                  · 현재는 예약 완료 이벤트를 서버에서 감지할 방법이 없음{"\n"}
                  · 수동으로 네이버 예약 건을 CAPI로 전송하는 것은 가능하나 자동화 어려움
                </div>
                <strong style={{ color: "#166534" }}>권장:</strong> 단기적으로 자사몰 랜딩 통일이 가장 ROI 높음. 리드 캠페인에는 이미 자사몰 소재만 복사되어 있으므로, 트래픽 캠페인의 네이버 소재만 정리하면 됨.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CloneAsLeadsSection({ accountId, campaigns, onDone }: { accountId: string; campaigns: CampaignHealth[]; onDone: () => void }) {
  const trafficCampaigns = campaigns.filter((c) => c.objective === "OUTCOME_TRAFFIC" && c.status === "ACTIVE");
  const [selectedSource, setSelectedSource] = useState(trafficCampaigns[0]?.id ?? "");
  const [newName, setNewName] = useState(() => {
    const now = new Date();
    const ts = `${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    return `리드 캠페인 (소재복사 ${ts})`;
  });
  const [budget, setBudget] = useState(50000);
  const [activeOnly, setActiveOnly] = useState(true);
  const [leadType, setLeadType] = useState<"website" | "instant_form">("website");
  const [pixelId, setPixelId] = useState("1068377347547682"); // AIBIO 픽셀 기본값
  const [customEventType, setCustomEventType] = useState("LEAD");
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; summary?: { adsetsCreated: number; adsCreated: number; skippedPausedAds: number }; newCampaign?: { id: string }; error?: string; message?: string; errorDetail?: { message: string; code?: number; error_subcode?: number; error_data?: string; fbtrace_id?: string } } | null>(null);

  const PIXEL_PRESETS = [
    { id: "1068377347547682", label: "AIBIO 리커버리랩스" },
    { id: "1283400029487161", label: "바이오컴" },
    { id: "1186437633687388", label: "더클린커피" },
  ];

  const handleClone = async () => {
    setCloning(true);
    setResult(null);
    try {
      const bodyPayload: Record<string, unknown> = {
        accountId,
        sourceCampaignId: selectedSource,
        newName,
        dailyBudget: budget,
        copyActiveAdsOnly: activeOnly,
        leadType,
        pageId: "110337454469232",
      };
      if (leadType === "website") {
        bodyPayload.pixelId = pixelId;
        bodyPayload.customEventType = customEventType;
      }
      const res = await fetch(`${API_BASE}/api/meta/campaigns/clone-as-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const d = await res.json();
      setResult(d);
      if (d.ok) onDone();
    } catch { setResult({ ok: false, error: "요청 실패" }); }
    finally { setCloning(false); }
  };

  if (trafficCampaigns.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 10, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
      <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>기존 소재 유지 → LEADS 목표 캠페인으로 복사</strong>
      <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "4px 0 12px" }}>
        기존 트래픽 캠페인의 타겟/소재를 그대로 복사하고, 목표만 LEADS(리드)로 변경한 새 캠페인을 PAUSED 상태로 생성.
      </p>

      {/* 리드 타입 선택 */}
      <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e0e7ff" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4338ca", marginBottom: 8 }}>전환 추적 방식 선택</div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            border: `2px solid ${leadType === "website" ? "#4338ca" : "#e2e8f0"}`,
            background: leadType === "website" ? "#eef2ff" : "#fff",
          }}>
            <input type="radio" name="leadType" checked={leadType === "website"} onChange={() => setLeadType("website")} style={{ display: "none" }} />
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: leadType === "website" ? "#4338ca" : "#334155" }}>웹사이트 리드 (권장)</div>
            <div style={{ fontSize: "0.64rem", color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Meta 픽셀 + 전환 이벤트로 추적. 고객이 웹사이트에서 폼 제출 시 전환으로 집계.
              <br />AIBIO generate_lead처럼 GTM 태그가 설정된 경우 적합.
            </div>
          </label>
          <label style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            border: `2px solid ${leadType === "instant_form" ? "#4338ca" : "#e2e8f0"}`,
            background: leadType === "instant_form" ? "#eef2ff" : "#fff",
          }}>
            <input type="radio" name="leadType" checked={leadType === "instant_form"} onChange={() => setLeadType("instant_form")} style={{ display: "none" }} />
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: leadType === "instant_form" ? "#4338ca" : "#334155" }}>인스턴트 폼</div>
            <div style={{ fontSize: "0.64rem", color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Meta 앱 내 폼으로 리드 수집. 별도 랜딩 페이지 불필요.
              <br />빠른 리드 수집이 목적이나, 리드 품질이 낮을 수 있음.
            </div>
          </label>
        </div>

        {/* 웹사이트 리드 설정 */}
        {leadType === "website" && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: "0.64rem", color: "#94a3b8", fontWeight: 600 }}>픽셀 ID</label>
              <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.76rem", marginTop: 4 }}>
                {PIXEL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.id.slice(-6)})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.64rem", color: "#94a3b8", fontWeight: 600 }}>전환 이벤트 타입</label>
              <select value={customEventType} onChange={(e) => setCustomEventType(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.76rem", marginTop: 4 }}>
                <option value="LEAD">LEAD (폼 제출 / 상담 예약)</option>
                <option value="PURCHASE">PURCHASE (구매)</option>
                <option value="COMPLETE_REGISTRATION">COMPLETE_REGISTRATION (회원가입)</option>
                <option value="CONTACT">CONTACT (문의)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>소스 캠페인</label>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }}>
            {trafficCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>새 캠페인 이름</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>일 예산 (원)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }} />
        </div>
        <button type="button" onClick={handleClone} disabled={cloning || !selectedSource} style={{
          padding: "8px 16px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
          background: "#4338ca", color: "#fff", border: "none", whiteSpace: "nowrap",
        }}>
          {cloning ? "복사 중..." : "LEADS로 복사 실행"}
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: "0.72rem", color: "#64748b" }}>
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
        활성 소재만 복사 (일시정지 소재 제외)
      </label>

      {/* 현재 설정 요약 */}
      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.6 }}>
        <strong style={{ color: "#334155" }}>설정 요약:</strong>{" "}
        {leadType === "website" ? (
          <>웹사이트 리드 · 픽셀 {PIXEL_PRESETS.find((p) => p.id === pixelId)?.label ?? pixelId} · 이벤트 {customEventType} · promoted_object: {`{pixel_id: "${pixelId}", custom_event_type: "${customEventType}"}`}</>
        ) : (
          <>인스턴트 폼 · promoted_object: {`{page_id: "110337454469232"}`}</>
        )}
      </div>
      {result && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: result.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`, fontSize: "0.78rem", color: result.ok ? "#16a34a" : "#dc2626" }}>
          {result.ok ? (
            <>
              LEADS 캠페인 복사 완료 (ID: {result.newCampaign?.id}).
              광고세트 {result.summary?.adsetsCreated}개, 소재 {result.summary?.adsCreated}개 연결.
              {(result.summary?.skippedPausedAds ?? 0) > 0 && ` 일시정지 소재 ${result.summary!.skippedPausedAds}개 제외.`}
              {" "}PAUSED 상태 — Meta 광고 관리자에서 확인 후 활성화.
            </>
          ) : (
            <>
              <div><strong>실패:</strong> {result.error}</div>
              {result.message && <div style={{ marginTop: 4, fontSize: "0.72rem" }}>{result.message}</div>}
              {result.errorDetail && (
                <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", fontSize: "0.68rem", color: "#991b1b", fontFamily: "monospace", lineHeight: 1.5 }}>
                  <div>Meta 에러 상세:</div>
                  <div>code: {result.errorDetail.code} · subcode: {result.errorDetail.error_subcode ?? "없음"}</div>
                  <div>message: {result.errorDetail.message}</div>
                  {result.errorDetail.error_data && <div>data: {result.errorDetail.error_data}</div>}
                  {result.errorDetail.fbtrace_id && <div>trace: {result.errorDetail.fbtrace_id}</div>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CapiStatusSection() {
  const [capiLog, setCapiLog] = useState<{
    total: number;
    countsByPixelId: Record<string, number>;
    latestSentAt: string;
  } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/meta/capi/log?limit=500`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCapiLog({
            total: d.summary?.total ?? 0,
            countsByPixelId: d.summary?.countsByPixelId ?? {},
            latestSentAt: d.entries?.[0]?.sent_at ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #faf5ff, #fff)", border: "1px solid #e9d5ff", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: "1.1rem" }}>{"🔌"}</span>
        <strong style={{ fontSize: "0.92rem", color: "#7c3aed" }}>CAPI (서버사이드 전환) 현황</strong>
        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>운영 중</span>
      </div>

      {/* CAPI 상태 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>총 전송</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#7c3aed" }}>{capiLog ? fmtNum(capiLog.total) + "건" : "—"}</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>자동 sync</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#16a34a" }}>30분 주기</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>서버 내장 자동화</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>가상계좌 필터</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#16a34a" }}>자동 차단</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>미입금/취소 제외</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>운영 시작</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#7c3aed" }}>0405</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>125건 첫 전송</div>
        </div>
      </div>

      {/* 가설 검증 타임라인 */}
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #f3e8ff" }}>
        <strong style={{ fontSize: "0.85rem", color: "#7c3aed" }}>CAPI 효과 가설 — 검증 타임라인</strong>
        <p style={{ fontSize: "0.76rem", color: "#94a3b8", margin: "6px 0 12px" }}>
          CAPI 활성화 전/후를 비교하여 아래 가설이 맞는지 확인한다. 기준일: 2026-04-05.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            {
              period: "0~7일", date: "~04/12",
              hypothesis: "전환 건수 +25~50% 증가",
              metric: "Meta 전환 수",
              check: "Events Manager > 서버 이벤트 비중 확인. 전체 전환 중 서버 소스 비중이 20%+ 이면 iOS 복구 효과 있음.",
              status: "진행 중",
              color: "#d97706", bg: "#fffbeb", border: "#fde68a",
            },
            {
              period: "7~14일", date: "~04/19",
              hypothesis: "Meta AI 학습 → CPA 5~10% 하락",
              metric: "CPA 추이",
              check: "이 대시보드에서 기간을 '최근 7일'로 바꿔 CPA 비교. 04/05 이전 vs 이후.",
              status: "대기",
              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
            },
            {
              period: "14~30일", date: "~05/05",
              hypothesis: "ROAS 5.03x → 6~7.5x 개선",
              metric: "7d_click ROAS",
              check: "이 대시보드에서 '클릭 7일' 기준 ROAS를 04/05 전후로 비교. 2.38x → 3.0x+ 이면 CAPI 효과.",
              status: "대기",
              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
            },
            {
              period: "30일+", date: "05/05~",
              hypothesis: "전환 매칭 품질(EMQ) '좋음' 달성",
              metric: "Events Manager EMQ 점수",
              check: "Events Manager > 이벤트 매칭 탭에서 품질 점수 확인. '보통' → '좋음'이면 fbp 쿠키 추가 검토.",
              status: "대기",
              color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0",
            },
          ].map((item) => (
            <div key={item.period} style={{ padding: "12px 14px", borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, fontSize: "0.76rem" }}>
              <div style={{ fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.period}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{item.date}</div>
              <div style={{ fontWeight: 600, color: "#334155", margin: "8px 0 4px", lineHeight: 1.4 }}>가설: {item.hypothesis}</div>
              <div style={{ color: "#64748b", lineHeight: 1.5 }}>확인 방법: {item.check}</div>
              <div style={{ marginTop: 6, fontSize: "0.68rem", fontWeight: 600, color: item.color }}>상태: {item.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CAPI 전송 요약 */}
      {capiLog && capiLog.total > 0 && (
        <div style={{ marginTop: 12, fontSize: "0.76rem", color: "#64748b", lineHeight: 1.6 }}>
          Pixel별 전송: {Object.entries(capiLog.countsByPixelId).map(([pid, cnt]) => `${pid.slice(-6)}... ${cnt}건`).join(" · ")}
          {capiLog.latestSentAt && ` · 최근 전송: ${capiLog.latestSentAt.slice(0, 16).replace("T", " ")}`}
        </div>
      )}
    </div>
  );
}
