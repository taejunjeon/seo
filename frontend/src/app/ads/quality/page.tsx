"use client";

import { useState } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import IdentityCoverageCard from "@/components/ads/quality/IdentityCoverageCard";
import RefundDispatchCard from "@/components/ads/quality/RefundDispatchCard";
import CancelSubcategoryCard from "@/components/ads/quality/CancelSubcategoryCard";
import CapiConvergenceCard from "@/components/ads/quality/CapiConvergenceCard";
import CoffeeAttRoasBreakdownCard from "@/components/ads/quality/CoffeeAttRoasBreakdownCard";
import AibioCsoStrategyCard from "@/components/ads/quality/AibioCsoStrategyCard";

const SITES = [
  { site: "biocom", label: "바이오컴" },
  { site: "aibio", label: "AIBIO 리커버리랩" },
  { site: "thecleancoffee", label: "더클린커피" },
];

const DATE_PRESETS = [
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
  { value: "last_90d", label: "최근 90일" },
];

export default function AdsQualityPage() {
  const [selectedSite, setSelectedSite] = useState(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_7d");

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 16 }}>
          <Link href="/ads" style={{ fontSize: "0.78rem", color: "#6366f1", textDecoration: "none" }}>← Meta 광고성과 대시보드로 돌아가기</Link>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>
            Attribution 신뢰성 진단
          </h1>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            이 화면의 질문 — <strong style={{ color: "#0f172a" }}>광고 매출 숫자가 정확히 잡히고 있는가</strong>.
            CAPI 전송, 식별자 커버리지, 환불 보정, 매출 차감 분류를 한 화면에서 본다.
            상세 ROAS 모니터링은 {" "}
            <Link href="/ads" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>/ads</Link>,
            {" "}캠페인 alias 매핑은 {" "}
            <Link href="/ads/campaign-mapping" style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>/ads/campaign-mapping</Link>
            {" "}에서 본다.
          </p>
        </div>

        {/* 사이트 선택 + 기간 선택 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SITES.map((s) => (
              <button
                key={s.site}
                onClick={() => setSelectedSite(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: selectedSite.site === s.site ? "2px solid #0f766e" : "1px solid #e2e8f0",
                  background: selectedSite.site === s.site ? "#ecfdf5" : "#fff",
                  color: selectedSite.site === s.site ? "#0f766e" : "#64748b",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DATE_PRESETS.map((dp) => (
              <button
                key={dp.value}
                onClick={() => setDatePreset(dp.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: datePreset === dp.value ? "#6366f1" : "#fff",
                  color: datePreset === dp.value ? "#fff" : "#64748b",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {dp.label}
              </button>
            ))}
          </div>
        </div>

        {/* 핵심 KPI 카드 (frontrule §12 카테고리형 2번 섹션) */}
        <section style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 8 }}>
            진단 카테고리 핵심 신호
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: "0.78rem", color: "#334155", lineHeight: 1.6 }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>CAPI 전송 품질</div>
              <div style={{ color: "#64748b" }}>Browser/Server 중복, EMQ, 이벤트 매칭. 자세한 KPI는 /ads CAPI 상태 카드</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>식별자 커버리지</div>
              <div style={{ color: "#64748b" }}>payment_success row 의 clientId/gaSessionId 유입률 — 아래 Identity Coverage</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>매출 보정</div>
              <div style={{ color: "#64748b" }}>환불·가상계좌 만료·부분환불 분류 — CANCEL / Refund Dispatch</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>CAPI 스냅샷 이후 ROAS 수렴</div>
              <div style={{ color: "#64748b" }}>바이오컴 PRE/POST 격차 추세 — 아래 CAPI 수렴 카드</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>사이트별 진단</div>
              <div style={{ color: "#64748b" }}>더클린커피 Att 낮음 원인 분해 · AIBIO CSO 전환 설계 — 사이트 선택 시 표시</div>
            </div>
          </div>
        </section>

        {/* 사이트별 진단 카드 (선택된 사이트에서만 마운트) */}
        {selectedSite.site === "thecleancoffee" && <CoffeeAttRoasBreakdownCard datePreset={datePreset} />}
        {selectedSite.site === "aibio" && <AibioCsoStrategyCard datePreset={datePreset} />}

        {/* 공통 진단 카드 */}
        <CapiConvergenceCard site={selectedSite.site} />
        <CancelSubcategoryCard site={selectedSite.site} />
        <RefundDispatchCard />
        <IdentityCoverageCard />
      </div>
    </>
  );
}
