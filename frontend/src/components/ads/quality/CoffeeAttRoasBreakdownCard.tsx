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
const COFFEE_OPERATIONAL_PIXEL_ID = "1186437633687388";
const COFFEE_STOP_CANDIDATE_PIXEL_ID = "993029601940881";
const COFFEE_PIXEL_AUDIT_KST = "2026-05-22 18:24 KST";
const COFFEE_OPERATIONAL_PIXEL_7D_SPEND = 1948301;
const COFFEE_OPERATIONAL_PIXEL_7D_CLICKS = 1563;
const COFFEE_OPERATIONAL_PIXEL_ACTIVE_ADSETS = 6;
const COFFEE_STOP_CANDIDATE_PIXEL_7D_SPEND = 0;
const COFFEE_LANDING_ROWS_7D = 597;
const COFFEE_PAYMENT_STARTED_7D = 434;
const COFFEE_CONFIRMED_PURCHASES_7D = 145;
const COFFEE_CAPI_SUCCESS_7D = 156;
const COFFEE_CART_PAGE_VIEWS_7D = 2;
const COFFEE_PAYMENT_METHOD_SELECTED_7D = 0;

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

function PixelCanonicalNotice() {
  return (
    <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
      <strong style={{ color: "#1d4ed8" }}>픽셀 정본 안내</strong>
      <div style={{ marginTop: 6, color: "#334155" }}>
        더클린커피 운영 보고서는 <strong>{COFFEE_OPERATIONAL_PIXEL_ID}</strong>을 기준으로 봅니다.
        최근 7일 광고비 {fmtKRW(COFFEE_OPERATIONAL_PIXEL_7D_SPEND)}, 클릭 {fmtNum(COFFEE_OPERATIONAL_PIXEL_7D_CLICKS)}건,
        active 광고세트 {fmtNum(COFFEE_OPERATIONAL_PIXEL_ACTIVE_ADSETS)}개가 이 픽셀 기준입니다.
        <strong> {COFFEE_STOP_CANDIDATE_PIXEL_ID}</strong>은 최근 7일 광고비 {fmtKRW(COFFEE_STOP_CANDIDATE_PIXEL_7D_SPEND)}인 정지/legacy 후보라
        운영 CAPI/ROAS 판단에서 섞으면 안 됩니다.
      </div>
      <div style={{ marginTop: 4, color: "#64748b", fontSize: "0.68rem" }}>
        기준: Meta Graph read-only + VM Cloud CAPI log, {COFFEE_PIXEL_AUDIT_KST}. 993 데이터 세트를 보고 CAPI 장애로 판단하면 오진 가능성이 큽니다.
      </div>
    </div>
  );
}

function LeadingIndicatorPlan() {
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
      <strong style={{ color: "#166534" }}>선행지표 찾는 방법</strong>
      <p style={{ margin: "6px 0 10px", color: "#334155" }}>
        목표는 매출 결과를 보고 늦게 반응하는 것이 아니라, <strong>구매자가 구매 전에 반복한 행동</strong>을 찾아 매일 관리하는 것입니다.
        더클린커피는 먼저 Meta 유입 구매자와 결제 시작 후 멈춘 사람을 나눠서,
        체류시간(페이지에 머문 시간), 스크롤 깊이, 상세페이지 조회, 장바구니, 결제 시작, 결제수단 선택 차이를 비교합니다.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #dcfce7" }}>
          <strong style={{ color: "#14532d" }}>1. 현재 퍼널을 먼저 닫기</strong>
          <p style={{ margin: "6px 0 0" }}>
            최근 7일 landing {fmtNum(COFFEE_LANDING_ROWS_7D)}건, 결제 시작 {fmtNum(COFFEE_PAYMENT_STARTED_7D)}건,
            실제 결제완료 {fmtNum(COFFEE_CONFIRMED_PURCHASES_7D)}건, CAPI success {fmtNum(COFFEE_CAPI_SUCCESS_7D)}건입니다.
            구매 신호는 살아 있으므로, 다음 병목은 클릭/주문 연결과 중간 행동 품질입니다.
          </p>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #dcfce7" }}>
          <strong style={{ color: "#14532d" }}>2. 약한 행동 신호부터 보강</strong>
          <p style={{ margin: "6px 0 0" }}>
            현재 장바구니 페이지 진입 {fmtNum(COFFEE_CART_PAGE_VIEWS_7D)}건,
            결제수단 선택 {fmtNum(COFFEE_PAYMENT_METHOD_SELECTED_7D)}건이라 선행지표로 쓰기 어렵습니다.
            먼저 GA4/GTM/VM Cloud에서 같은 이름과 같은 의미로 잡히는지 맞춘 뒤, CAPI 전송 후보로 올립니다.
          </p>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #dcfce7" }}>
          <strong style={{ color: "#14532d" }}>3. 보낼 이벤트는 dry-run 뒤 결정</strong>
          <p style={{ margin: "6px 0 0" }}>
            Browser Pixel이 이미 보내는 이벤트와 겹치면 중복 위험이 있습니다.
            그래서 중간전환 CAPI는 바로 켜지 않고, no-send preview로 후보 수, 중복 가능성, 구매 예측력을 본 뒤
            InitiateCheckout/AddPaymentInfo/CompleteRegistration 중 필요한 것만 켭니다.
          </p>
        </div>
      </div>
    </div>
  );
}

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
        <div style={{ marginBottom: 12, color: "#64748b" }}>더클린커피 Att ROAS 동적 숫자 로딩 중… 정본 픽셀과 선행지표 액션플랜은 먼저 확인할 수 있습니다.</div>
        <PixelCanonicalNotice />
        <LeadingIndicatorPlan />
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

      <PixelCanonicalNotice />

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

      <LeadingIndicatorPlan />
    </div>
  );
}
