"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

const SITES = [
  { key: "biocom", label: "바이오컴", accountId: "act_3138805896402376" },
  { key: "aibio", label: "AIBIO 리커버리랩", accountId: "act_377604674894011" },
  { key: "thecleancoffee", label: "더클린커피", accountId: "act_1382574315626662" },
];

type SiteData = {
  clicks: number; linkClicks: number; landingViews: number; purchases: number;
  purchaseValue: number; spend: number; leads: number;
};

const SITE_PLAYBOOK: Record<string, { primaryConversion: "purchase" | "lead" | "none"; convLabel: string; benchmark: string; benchmarkRange: [number, number] }> = {
  biocom: { primaryConversion: "purchase", convLabel: "구매", benchmark: "구매 전환율 벤치마크: 1~3%", benchmarkRange: [0.01, 0.03] },
  aibio: { primaryConversion: "lead", convLabel: "리드(상담예약)", benchmark: "리드 전환율 벤치마크: 3~8%", benchmarkRange: [0.03, 0.08] },
  thecleancoffee: { primaryConversion: "none", convLabel: "—", benchmark: "Meta 미연동", benchmarkRange: [0, 0] },
};

export default function LandingViewPage() {
  const [siteDataMap, setSiteDataMap] = useState<Record<string, SiteData>>({});
  const [selectedSite, setSelectedSite] = useState(SITES[0]!.key);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(
      SITES.map((s) =>
        fetch(`${API_BASE}/api/meta/insights?account_id=${s.accountId}&date_preset=last_30d`)
          .then((r) => r.json())
          .then((d) => {
            if (!d.ok) return { key: s.key, data: null };
            const summary = d.summary ?? {};
            const rows = d.rows ?? [];
            return {
              key: s.key,
              data: {
                clicks: summary.totalClicks ?? 0,
                linkClicks: rows.reduce((sum: number, r: { link_clicks?: number }) => sum + (r.link_clicks ?? 0), 0),
                landingViews: summary.totalLandingViews ?? 0,
                purchases: summary.totalPurchases ?? 0,
                purchaseValue: summary.totalPurchaseValue ?? 0,
                spend: summary.totalSpend ?? 0,
                leads: summary.totalLeads ?? 0,
              } as SiteData,
            };
          })
          .catch(() => ({ key: s.key, data: null })),
      ),
    ).then((results) => {
      const map: Record<string, SiteData> = {};
      for (const r of results) {
        if (r.data) map[r.key] = r.data;
      }
      setSiteDataMap(map);
      setLoading(false);
    });
  }, []);

  const data = siteDataMap[selectedSite] ?? null;

  const playbook = SITE_PLAYBOOK[selectedSite] ?? SITE_PLAYBOOK.biocom;
  const primaryConversions = data ? (playbook.primaryConversion === "lead" ? data.leads : data.purchases) : 0;
  const linkToLanding = data ? data.landingViews / Math.max(data.linkClicks, 1) : 0;
  const landingToConv = data ? primaryConversions / Math.max(data.landingViews, 1) : 0;
  const droppedClicks = data ? data.linkClicks - data.landingViews : 0;
  const aov = data && data.purchases > 0 ? data.purchaseValue / data.purchases : 0;

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 48px", background: "linear-gradient(180deg, rgba(248,250,252,0.96), #fff)" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.84)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 1px 6px rgba(15,23,42,0.08)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 24px" }}>
          <Link href="/ads" style={{ fontSize: "0.76rem", color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
            ← 광고 대시보드로 돌아가기
          </Link>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginTop: 4 }}>랜딩뷰 분석 · Clarity UX 인사이트</h1>
          <p style={{ fontSize: "0.84rem", color: "#94a3b8", marginTop: 4 }}>
            클릭→랜딩뷰 이탈 원인 분석, Microsoft Clarity 히트맵/세션 리플레이, 전환율 개선 전략
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, display: "grid", gap: 20 }}>
        {/* 사이트 선택 + 3사이트 비교 */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* 사이트 탭 */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            {SITES.map((s) => {
              const sd = siteDataMap[s.key];
              const hasData = sd && sd.linkClicks > 0;
              const ltl = sd ? sd.landingViews / Math.max(sd.linkClicks, 1) : 0;
              return (
                <button key={s.key} type="button" onClick={() => setSelectedSite(s.key)} style={{
                  padding: "14px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left", minWidth: 160,
                  border: selectedSite === s.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                  background: selectedSite === s.key ? "#eef2ff" : "#fff",
                }}>
                  <strong style={{ fontSize: "0.88rem", color: selectedSite === s.key ? "#4338ca" : "#334155" }}>{s.label}</strong>
                  {hasData ? (
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                      link→land {(ltl * 100).toFixed(0)}% · {fmtNum(sd!.linkClicks)} clicks
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>
                      {loading ? "로딩 중..." : "광고 데이터 없음"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 3사이트 비교 테이블 */}
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.76rem" }}>
            <strong style={{ fontSize: "0.82rem", color: "#334155" }}>3사이트 퍼널 비교</strong>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "#94a3b8", fontSize: "0.68rem" }}>사이트</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "#94a3b8", fontSize: "0.68rem" }}>link_clicks</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "#94a3b8", fontSize: "0.68rem" }}>랜딩뷰</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "#94a3b8", fontSize: "0.68rem" }}>link→land</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "#94a3b8", fontSize: "0.68rem" }}>구매</th>
                </tr>
              </thead>
              <tbody>
                {SITES.map((s) => {
                  const sd = siteDataMap[s.key];
                  if (!sd || sd.linkClicks === 0) return (
                    <tr key={s.key} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "4px 6px", fontWeight: 600 }}>{s.label}</td>
                      <td colSpan={4} style={{ padding: "4px 6px", textAlign: "center", color: "#94a3b8" }}>
                        {s.key === "thecleancoffee" ? "Meta 계정 미연동" : "데이터 없음"}
                      </td>
                    </tr>
                  );
                  const ltl = sd.landingViews / Math.max(sd.linkClicks, 1);
                  return (
                    <tr key={s.key} style={{ borderBottom: "1px solid #f8fafc", background: selectedSite === s.key ? "#f5f3ff" : undefined }}>
                      <td style={{ padding: "4px 6px", fontWeight: 600 }}>{s.label}</td>
                      <td style={{ padding: "4px 6px", textAlign: "right" }}>{fmtNum(sd.linkClicks)}</td>
                      <td style={{ padding: "4px 6px", textAlign: "right" }}>{fmtNum(sd.landingViews)}</td>
                      <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, color: ltl > 0.65 ? "#16a34a" : ltl > 0.5 ? "#d97706" : "#dc2626" }}>
                        {(ltl * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "4px 6px", textAlign: "right" }}>{fmtNum(sd.purchases)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>데이터를 불러오는 중...</div>
        ) : !data || data.linkClicks === 0 ? (
          <SiteNoDataPanel site={SITES.find((s) => s.key === selectedSite)!} />
        ) : (
          <>
            {/* 퍼널 현황 KPI */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
              <KpiCard label="link_clicks" value={fmtNum(data.linkClicks)} sub="실제 광고 링크 클릭" />
              <KpiCard label="랜딩뷰" value={fmtNum(data.landingViews)} sub={`link→land ${(linkToLanding * 100).toFixed(1)}%`} tone={linkToLanding > 0.65 ? "success" : "warn"} />
              <KpiCard label="이탈 클릭" value={fmtNum(droppedClicks)} sub={`${((1 - linkToLanding) * 100).toFixed(1)}% 페이지 도달 전 이탈`} tone="warn" />
              <KpiCard label={selectedSite === "aibio" ? "리드(상담예약)" : "구매 전환"} value={`${fmtNum(data.purchases)}건`} sub={`랜딩뷰 대비 ${(landingToConv * 100).toFixed(2)}%`} />
              <KpiCard label="이탈 복구 시 추가 매출" value={fmtKRW(Math.round(droppedClicks * 0.14 * landingToConv * aov))} sub="70% 달성 시 월 예상" tone="success" />
            </section>

            {/* 퍼널 시각화 */}
            <Panel title="광고 클릭 → 구매 퍼널">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "20px 0" }}>
                {[
                  { label: "link_clicks", value: data.linkClicks, color: "#6366f1", sub: "광고 링크 클릭" },
                  { label: "랜딩뷰", value: data.landingViews, color: linkToLanding > 0.65 ? "#10b981" : "#f59e0b", sub: `${(linkToLanding * 100).toFixed(1)}%` },
                  { label: playbook.convLabel, value: primaryConversions, color: "#8b5cf6", sub: `${(landingToConv * 100).toFixed(2)}%` },
                ].map((step, i, arr) => (
                  <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.8rem", fontWeight: 700, color: step.color }}>{fmtNum(step.value)}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{step.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{step.sub}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ fontSize: "1.5rem", color: "#cbd5e1" }}>→</div>}
                  </div>
                ))}
              </div>
              {droppedClicks > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: linkToLanding > 0.85 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${linkToLanding > 0.85 ? "#bbf7d0" : "#fecaca"}`, fontSize: "0.78rem", color: linkToLanding > 0.85 ? "#16a34a" : "#dc2626" }}>
                {linkToLanding > 0.85 ? (
                  <><strong>양호</strong>: link_clicks → 랜딩뷰 {(linkToLanding * 100).toFixed(1)}%로 업계 평균 이상. 이탈 {fmtNum(droppedClicks)}건은 정상 범위.</>
                ) : linkToLanding > 0.65 ? (
                  <><strong>보통</strong>: link_clicks → 랜딩뷰에서 {fmtNum(droppedClicks)}건 ({((1 - linkToLanding) * 100).toFixed(1)}%) 이탈. 업계 평균(65~75%) 범위. 페이지 속도 개선으로 추가 확보 가능.</>
                ) : (
                  <><strong>최대 병목</strong>: link_clicks → 랜딩뷰에서 {fmtNum(droppedClicks)}건 ({((1 - linkToLanding) * 100).toFixed(1)}%) 이탈. 업계 평균(65~75%) 미달. 페이지 로딩 속도 점검 필요. 아래 PageSpeed 참조.</>
                )}
              </div>
              )}
            </Panel>

            {/* PageSpeed 현황 — 사이트별 */}
            <PageSpeedPanel site={selectedSite} />

            {/* Clarity 현황 */}
            <Panel title="Microsoft Clarity — 3사이트 운영 현황">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {SITES.map((s) => (
                  <div key={s.key} style={{ padding: "16px 18px", borderRadius: 12, background: selectedSite === s.key ? "#f0fdf4" : "#fff", border: `2px solid ${selectedSite === s.key ? "#16a34a" : "#e2e8f0"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{s.label}</span>
                      <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>운영 중</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
                      GTM 연동 완료 · 봇 감지 ON<br />
                      세션 리플레이 · 히트맵 · Dead clicks 수집 중
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  GTM 경유 설치 — HTML 소스에 Clarity 코드가 직접 보이지 않음 (정상). Clarity 대시보드에서 세션 유입 확인.
                </span>
                <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.78rem", color: "#6366f1", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
                  Clarity 대시보드 →
                </a>
              </div>
            </Panel>

            {/* Clarity에서 볼 것 가이드 */}
            <Panel title="Clarity에서 이렇게 분석하면 됨">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { week: "첫 주", items: [
                    { what: "Dead clicks 상위 5개", where: "Dashboard > Dead clicks", why: "클릭했는데 반응 없는 UI = 구매 퍼널 차단" },
                    { what: "Rage clicks 상위 5개", where: "Dashboard > Rage clicks", why: "사용자 좌절 = UX 문제 핵심" },
                    { what: "모바일 vs 데스크톱", where: "Filters > Device type", why: "모바일 이탈이 더 심한지 확인" },
                    { what: "스크롤 depth", where: "Heatmaps > Scroll", why: "CTA까지 스크롤하는 비율" },
                  ]},
                  { week: "2~3주 후", items: [
                    { what: "캠페인별 행동 차이", where: "Filters > UTM Campaign", why: "음식물 과민증(53% 이탈) vs 호르몬(79%)" },
                    { what: "구매 vs 이탈 세션 비교", where: "Segments", why: "구매자가 본 것 vs 이탈자가 안 본 것" },
                    { what: "AI Copilot 질문", where: "Copilot 탭", why: "가장 큰 UX 문제 자동 분석" },
                    { what: "결제 퍼널 세션 리플레이", where: "Recordings > 장바구니 페이지 필터", why: "결제 중 이탈 지점 발견" },
                  ]},
                ].map((phase) => (
                  <div key={phase.week} style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 10 }}>{phase.week}</div>
                    {phase.items.map((item) => (
                      <div key={item.what} style={{ marginBottom: 10, fontSize: "0.76rem", lineHeight: 1.5 }}>
                        <strong style={{ color: "#6366f1" }}>{item.what}</strong>
                        <div style={{ color: "#94a3b8", fontSize: "0.68rem" }}>{item.where}</div>
                        <div style={{ color: "#64748b" }}>{item.why}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Panel>

            {/* Claude Code vs Codex 인사이트 — 사이트별 분기 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Panel title="">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <span style={{ fontSize: "1rem" }}>{"🤖"}</span>
                  <strong style={{ fontSize: "0.88rem", color: "#4338ca" }}>Claude Code — {SITES.find((s) => s.key === selectedSite)?.label} 랜딩뷰 전략</strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                  {selectedSite === "aibio" ? (
                    <>
                      <InsightBox color="#16a34a" bg="#f0fdf4" border="#bbf7d0" title="랜딩뷰 우수 — 전환 최적화가 핵심">
                        클릭→랜딩뷰 {(linkToLanding * 100).toFixed(1)}%로 양호. 페이지 속도는 문제 아님.
                        핵심 병목은 랜딩뷰→리드(상담예약) 전환율 {(landingToConv * 100).toFixed(2)}%.
                        오프라인 서비스 리드 전환율 벤치마크(3~8%) 대비 {landingToConv >= 0.03 ? "양호" : "개선 필요"}.
                      </InsightBox>
                      <InsightBox color="#4338ca" bg="#eef2ff" border="#c7d2fe" title="LEADS 캠페인 전환 추적 시작">
                        리드 캠페인이 활성화되어 Meta AI가 "상담 예약 가능성 높은 사람"에게 최적화 중.
                        generate_lead 이벤트(GTM)가 Meta 픽셀 Lead로 매핑됨.
                        리드 50건+ 쌓이면 CPL 안정화 → 입찰 전략을 "결과당 비용 목표"로 전환 가능.
                      </InsightBox>
                      <InsightBox color="#d97706" bg="#fffbeb" border="#fde68a" title="Clarity에서 확인할 것">
                        1. 상담 예약 CTA 버튼까지 스크롤 도달률{"\n"}
                        2. 모바일 vs 데스크톱 폼 제출 완료율 비교{"\n"}
                        3. 가격/서비스 설명 영역 체류 시간{"\n"}
                        4. Rage clicks — 예약 버튼 근처 좌절 패턴
                      </InsightBox>
                    </>
                  ) : selectedSite === "thecleancoffee" ? (
                    <>
                      <InsightBox color="#d97706" bg="#fffbeb" border="#fde68a" title="Meta 광고 계정 미연동">
                        더클린커피 광고 데이터가 연결되지 않아 퍼널(클릭→랜딩뷰→구매) 분석 불가.
                        마케팅팀에 실제 광고 계정 ID 확인 후 API 연동 필요.
                      </InsightBox>
                      <InsightBox color="#16a34a" bg="#f0fdf4" border="#bbf7d0" title="Clarity로 가능한 분석">
                        Clarity 설치 완료 — 자연 유입 방문자의 UX 분석은 즉시 가능.{"\n"}
                        1. 상품 페이지 Dead clicks (클릭했는데 반응 없는 UI){"\n"}
                        2. 장바구니→결제 이탈 세션 리플레이{"\n"}
                        3. 모바일 결제 UX 병목 분석
                      </InsightBox>
                    </>
                  ) : (
                    <>
                      <InsightBox color="#dc2626" bg="#fef2f2" border="#fecaca" title="1순위: 페이지 속도 개선">
                        클릭→랜딩뷰 이탈 {((1 - linkToLanding) * 100).toFixed(0)}%는 페이지 도달 전 이탈.
                        Clarity/Hotjar JS 로드 전에 사용자가 떠나므로 세션 자체가 기록 안 됨.
                        <strong> 속도 개선이 UX 분석보다 먼저.</strong> 아래 PageSpeed 결과 참조.
                      </InsightBox>
                      <InsightBox color="#16a34a" bg="#f0fdf4" border="#bbf7d0" title="2순위: Clarity로 전환율 개선">
                        랜딩까지 온 사람의 전환율 {(landingToConv * 100).toFixed(2)}%을 올리는 게 Clarity의 역할.
                        Dead clicks + Rage clicks로 CTA 문제 즉시 발견.
                        구매자 vs 이탈자 세션 비교로 "뭘 봐야 사는지" 패턴 파악.
                        {landingToConv < 0.02 && `전환율 2.0%로 올리면 월 +${fmtNum(Math.round(data.landingViews * 0.0075))}건 추가 전환.`}
                      </InsightBox>
                      <InsightBox color="#6366f1" bg="#eef2ff" border="#c7d2fe" title="아임웹에서 할 수 있는 속도 개선">
                        1. 불필요한 앱/위젯 제거 (요청 수 20~30% 감소){"\n"}
                        2. 이미지 WebP 변환 + 해상도 조정{"\n"}
                        3. 영상 lazy loading{"\n"}
                        4. GTM에서 서드파티 스크립트를 Window Loaded 이후로 이동{"\n"}
                        5. 별도 경량 랜딩 페이지(Next.js/Vercel) 검토 — LCP 1~2초 달성 가능
                      </InsightBox>
                    </>
                  )}
                </div>
              </Panel>

              <Panel title="">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <span style={{ fontSize: "1rem" }}>{"🧠"}</span>
                  <strong style={{ fontSize: "0.88rem", color: "#166534" }}>Codex — {SITES.find((s) => s.key === selectedSite)?.label} 데이터 분석</strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                  {selectedSite === "aibio" ? (
                    <>
                      <InsightBox color="#166534" bg="#f0fdf4" border="#bbf7d0" title="리드 퍼널 벤치마크">
                        오프라인 서비스 리드 전환율 벤치마크: 3~8%.
                        현재 {(landingToConv * 100).toFixed(2)}%{landingToConv < 0.03 ? " — 벤치마크 미달." : " — 양호 범위."}
                        리드 캠페인 데이터 축적 후 CPL 기준 설정 가능.
                      </InsightBox>
                      <InsightBox color="#166534" bg="#fff" border="#bbf7d0" title="봇 트래픽 필터링">
                        Meta 광고 봇 비중 일반적 5~15%.
                        link_clicks {fmtNum(data.linkClicks)} × 5% = ~{fmtNum(Math.round(data.linkClicks * 0.05))}건 봇 추정.
                        Clarity 봇 감지 ON으로 자동 필터링 중.
                      </InsightBox>
                      <InsightBox color="#166534" bg="#ecfdf5" border="#bbf7d0" title="실행 우선순위">
                        1. <strong>리드 50건 축적 대기</strong> (Meta AI 학습 완료 기준){"\n"}
                        2. <strong>Clarity 히트맵</strong>: 상담 예약 CTA 도달률 확인{"\n"}
                        3. <strong>모바일 폼 UX</strong>: 세션 리플레이로 폼 이탈 지점 발견{"\n"}
                        4. <strong>CPL 안정화 후 입찰 전략 전환</strong> (최고 볼륨 → 결과당 비용 목표)
                      </InsightBox>
                    </>
                  ) : selectedSite === "thecleancoffee" ? (
                    <>
                      <InsightBox color="#166534" bg="#f0fdf4" border="#bbf7d0" title="연동 전 활용 전략">
                        Meta 연동 전이라도 자연 유입 방문자의 UX 분석 가능.{"\n"}
                        · 상품 페이지 Dead clicks → UI 반응 없는 요소 제거{"\n"}
                        · 장바구니 이탈 세션 → 결제 UX 병목 발견{"\n"}
                        · 스크롤 depth → 구매 CTA 위치 최적화
                      </InsightBox>
                      <InsightBox color="#166534" bg="#ecfdf5" border="#bbf7d0" title="실행 우선순위">
                        1. <strong>Meta 광고 계정 연동</strong> (마케팅팀 확인){"\n"}
                        2. <strong>Clarity 2주 데이터 축적</strong> 후 첫 UX 보고서{"\n"}
                        3. <strong>PageSpeed 측정</strong>으로 속도 기준점 확보
                      </InsightBox>
                    </>
                  ) : (
                    <>
                      <InsightBox color="#166534" bg="#f0fdf4" border="#bbf7d0" title="clicks vs link_clicks 구분">
                        clicks(all)={fmtNum(data.clicks)} 중 {fmtNum(data.clicks - data.linkClicks)}건은 좋아요/댓글/공유.
                        <strong> link_clicks={fmtNum(data.linkClicks)}이 실제 광고 링크 클릭</strong>.
                        이 페이지는 link_clicks 기준으로 이탈률 {((1 - linkToLanding) * 100).toFixed(1)}%를 표시 중 (정확).
                      </InsightBox>
                      <InsightBox color="#166534" bg="#fff" border="#bbf7d0" title="봇 트래픽 5~15% 추정">
                        link_clicks {fmtNum(data.linkClicks)} × 5% = ~{fmtNum(Math.round(data.linkClicks * 0.05))}건 봇.
                        실제 human 이탈률은 {((1 - data.landingViews / Math.max(data.linkClicks * 0.92, 1)) * 100).toFixed(1)}%로 업계 평균에 근접.
                        Clarity 봇 감지 ON으로 자동 필터링 중.
                      </InsightBox>
                      <InsightBox color="#166534" bg="#ecfdf5" border="#bbf7d0" title="실행 우선순위">
                        1. <strong>PageSpeed 재측정</strong> — 캐시된 데이터가 오래됐을 수 있음{"\n"}
                        2. <strong>Clarity 2주 데이터</strong> 축적 후 UX 병목 분석{"\n"}
                        3. <strong>캠페인별 랜딩 URL 성과 비교</strong>{"\n"}
                        4. <strong>경량 랜딩 페이지 A/B 테스트</strong> (LCP 1~2초 목표)
                      </InsightBox>
                    </>
                  )}
                </div>
              </Panel>
            </div>

            {/* 예상 임팩트 — 사이트별 */}
            <Panel title={`${SITES.find((s) => s.key === selectedSite)?.label ?? ""} 개선 시 예상 임팩트`}>
              {selectedSite === "aibio" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706" }}>보수적 시나리오</div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.8, marginTop: 8 }}>
                      리드 전환율 {(landingToConv * 100).toFixed(1)}% → <strong>3%</strong>{"\n"}
                      추가 리드: +{fmtNum(Math.round(data.landingViews * (0.03 - landingToConv)))}건/월{"\n"}
                      <strong>CPL 목표: {data.spend > 0 ? fmtKRW(data.spend / Math.max(data.landingViews * 0.03, 1)) : "—"}/리드</strong>
                    </div>
                  </div>
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>낙관적 시나리오</div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.8, marginTop: 8 }}>
                      리드 전환율 {(landingToConv * 100).toFixed(1)}% → <strong>5%</strong>{"\n"}
                      추가 리드: +{fmtNum(Math.round(data.landingViews * (0.05 - landingToConv)))}건/월{"\n"}
                      <strong>CPL 목표: {data.spend > 0 ? fmtKRW(data.spend / Math.max(data.landingViews * 0.05, 1)) : "—"}/리드</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706" }}>보수적 시나리오</div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.8, marginTop: 8 }}>
                      link→landing {(linkToLanding * 100).toFixed(0)}% → <strong>70%</strong> + 전환율 {(landingToConv * 100).toFixed(2)}% → <strong>{Math.max(landingToConv * 100 + 0.05, 1.3).toFixed(1)}%</strong>{"\n"}
                      추가 전환: +{fmtNum(Math.round((data.linkClicks * 0.7 * Math.max(landingToConv + 0.0005, 0.013)) - data.purchases))}건/월{"\n"}
                      <strong>추가 매출: +{fmtKRW(Math.round((data.linkClicks * 0.7 * Math.max(landingToConv + 0.0005, 0.013) - data.purchases) * aov))}/월</strong>
                    </div>
                  </div>
                  <div style={{ padding: "16px 18px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>낙관적 시나리오</div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.8, marginTop: 8 }}>
                      link→landing {(linkToLanding * 100).toFixed(0)}% → <strong>75%</strong> + 전환율 → <strong>{Math.max(landingToConv * 100 + 0.25, 1.5).toFixed(1)}%</strong>{"\n"}
                      추가 전환: +{fmtNum(Math.round((data.linkClicks * 0.75 * Math.max(landingToConv + 0.0025, 0.015)) - data.purchases))}건/월{"\n"}
                      <strong>추가 매출: +{fmtKRW(Math.round((data.linkClicks * 0.75 * Math.max(landingToConv + 0.0025, 0.015) - data.purchases) * aov))}/월</strong>
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <div style={{ padding: "16px 18px", borderRadius: 14, borderLeft: "4px solid #6366f1", background: "rgba(99,102,241,0.04)", fontSize: "0.84rem", color: "#475569", lineHeight: 1.7 }}>
              <strong>상세 문서</strong>: <a href="https://github.com" style={{ color: "#6366f1" }}>meta/landingview.md</a>에 Clarity 설치 방법, 캠페인별 이탈률, PageSpeed 상세 분석, 실행 로드맵 7단계가 정리돼 있음.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warn" }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.18)",
      background: tone === "success" ? "linear-gradient(180deg, #f0fdf4, #fff)" : tone === "warn" ? "linear-gradient(180deg, #fffbeb, #fff)" : "linear-gradient(180deg, #fff, #f8fafc)",
    }}>
      <div style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148,163,184,0.18)", boxShadow: "0 8px 24px rgba(15,23,42,0.05)" }}>
      {title && <h2 style={{ fontSize: "1.02rem", fontWeight: 700, marginBottom: 18 }}>{title}</h2>}
      {children}
    </section>
  );
}

const SITE_URLS: Record<string, string> = {
  biocom: "https://biocom.kr",
  aibio: "https://aibio.kr",
  thecleancoffee: "https://thecleancoffee.com",
};

function PageSpeedPanel({ site }: { site: string }) {
  const [ps, setPs] = useState<{ performance: number; lcp: string; fcp: string; ttfb: string; si: string; measuredAt: string } | null>(null);
  const [psLoading, setPsLoading] = useState(false);
  const [psError, setPsError] = useState<string | null>(null);

  const siteUrl = SITE_URLS[site] ?? "";
  const siteLabel = SITES.find((s) => s.key === site)?.label ?? site;

  const parseResult = (d: Record<string, unknown>) => {
    const perf = d.performanceScore as number | null;
    const lcpMs = (d.lcpMs ?? d.lcp) as number | null;
    const fcpMs = (d.fcpMs ?? d.fcp) as number | null;
    const ttfbMs = (d.ttfbMs ?? d.ttfb) as number | null;
    const measuredAt = (d.measuredAt ?? "") as string;
    if (perf != null) {
      setPs({
        performance: perf > 1 ? perf : Math.round(perf * 100),
        lcp: lcpMs ? `${(lcpMs / 1000).toFixed(1)}초` : "?",
        fcp: fcpMs ? `${(fcpMs / 1000).toFixed(1)}초` : "?",
        ttfb: ttfbMs ? `${Math.round(ttfbMs)}ms` : "?",
        si: "?",
        measuredAt: measuredAt ? measuredAt.slice(0, 16).replace("T", " ") : "",
      });
      return true;
    }
    return false;
  };

  // 캐시 먼저 로드
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_BASE}/api/pagespeed/results?url=${encodeURIComponent(siteUrl)}&strategy=mobile`)
      .then((r) => r.json())
      .then((d) => {
        const results = d.results ?? (Array.isArray(d) ? d : []);
        const mobile = results.find((r: Record<string, unknown>) => r.strategy === "mobile");
        if (mobile) parseResult(mobile);
      })
      .catch(() => {});
  }, [siteUrl]);

  // 수동 재측정
  const runMeasure = () => {
    setPsLoading(true);
    setPsError(null);
    fetch(`${API_BASE}/api/pagespeed/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: siteUrl, strategy: "mobile" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!parseResult(d)) setPsError("PageSpeed 측정 실패");
      })
      .catch(() => setPsError("PageSpeed API 호출 실패"))
      .finally(() => setPsLoading(false));
  };

  const getColor = (score: number) => score >= 90 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";

  return (
    <Panel title={`${siteLabel} 모바일 PageSpeed 현황`}>
      {psLoading ? (
        <div style={{ textAlign: "center", padding: 30, color: "#94a3b8", fontSize: "0.82rem" }}>
          PageSpeed 측정 중... (10~30초 소요)
        </div>
      ) : psError ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.82rem", color: "#92400e" }}>
          {psError}. <a href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(siteUrl)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>PageSpeed Insights에서 직접 확인 →</a>
        </div>
      ) : !ps && !psError ? (
        <div style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 12 }}>캐시된 PageSpeed 데이터 없음</div>
          <button type="button" onClick={runMeasure} disabled={psLoading} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            border: "1px solid #6366f1", background: "#eef2ff", color: "#6366f1",
          }}>
            지금 측정하기 (10~30초)
          </button>
        </div>
      ) : ps ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Performance", value: `${ps.performance}점`, color: getColor(ps.performance), sub: "100점 만점" },
              { label: "LCP", value: ps.lcp, color: parseFloat(ps.lcp) <= 2.5 ? "#16a34a" : parseFloat(ps.lcp) <= 4 ? "#d97706" : "#dc2626", sub: "권장 2.5초 이하" },
              { label: "FCP", value: ps.fcp, color: parseFloat(ps.fcp) <= 1.8 ? "#16a34a" : parseFloat(ps.fcp) <= 3 ? "#d97706" : "#dc2626", sub: "권장 1.8초 이하" },
              { label: "TTFB", value: ps.ttfb, color: parseInt(ps.ttfb) <= 800 ? "#16a34a" : "#d97706", sub: "서버 응답 속도" },
            ].map((m) => (
              <div key={m.label} style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{m.label}</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "#94a3b8" }}>
            <span>
              {ps.measuredAt ? `측정일: ${ps.measuredAt}` : ""}
              {" · "}
              <a href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(siteUrl)}`} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>PageSpeed Insights →</a>
            </span>
            <button type="button" onClick={runMeasure} disabled={psLoading} style={{
              padding: "5px 12px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
              border: "1px solid #e2e8f0", background: "#fff", color: "#6366f1",
            }}>
              {psLoading ? "측정 중..." : "재측정"}
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function SiteNoDataPanel({ site }: { site: { key: string; label: string } }) {
  const isOff = site.key === "thecleancoffee";
  const isAibio = site.key === "aibio";
  return (
    <>
    <Panel title={`${site.label} — 랜딩뷰 분석`}>
      {isOff ? (
        <div style={{ padding: "30px 0", textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", color: "#d97706", marginBottom: 12 }}>Meta 광고 데이터 미연동</div>
          <div style={{ fontSize: "0.84rem", color: "#64748b", lineHeight: 1.8, maxWidth: 500, margin: "0 auto" }}>
            <p>더클린커피는 3월에 Meta 광고를 ₩606만 집행했지만, 실제 광고 계정이 우리 API에 연결되지 않아 클릭/랜딩뷰 데이터가 안 보임. 페이지 속도와 Clarity는 확인 가능.</p>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", marginTop: 12, textAlign: "left" }}>
              <strong style={{ color: "#92400e" }}>해결 방법:</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>마케팅팀에 "3월 Meta 광고 돌린 계정 ID" 확인</li>
                <li>해당 계정에 우리 토큰 권한 추가</li>
                <li>코드에서 account_id 교체</li>
              </ol>
              <p style={{ marginTop: 8, fontSize: "0.76rem", color: "#92400e" }}>상세: <code>meta/coffeemeta.md</code></p>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginTop: 12, textAlign: "left" }}>
              <strong style={{ color: "#16a34a" }}>Clarity는 설치 완료:</strong> 더클린커피 Clarity 프로젝트가 GTM으로 연결됨. 광고 데이터 없이도 사이트 방문자의 히트맵/세션 리플레이는 수집 중.
            </div>
          </div>
        </div>
      ) : isAibio ? (
        <div style={{ padding: "30px 0", textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", color: "#6366f1", marginBottom: 12 }}>AIBIO — 리드 전환 분석</div>
          <div style={{ fontSize: "0.84rem", color: "#64748b", lineHeight: 1.8, maxWidth: 500, margin: "0 auto", textAlign: "left" }}>
            <p>AIBIO는 오프라인 체험 서비스로 온라인 구매가 아닌 <strong>리드(상담 예약)</strong>가 전환 목표.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>캠페인 전환</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#4338ca" }}>LEADS</div>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>리드 캠페인 활성화됨</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>전환 이벤트</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#16a34a" }}>generate_lead</div>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>GTM 태그 설정 완료</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "#dcfce7", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Clarity</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#16a34a" }}>운영 중</div>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>GTM 연동 완료</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe", marginTop: 12 }}>
              <strong style={{ color: "#4338ca" }}>현재 상태:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, lineHeight: 1.8 }}>
                <li><strong>LEADS 캠페인 활성화</strong> — Meta AI가 상담 예약 가능성 높은 사람에게 최적화 중</li>
                <li><strong>추적 방식</strong>: 웹사이트 리드 (픽셀 + custom_event_type=LEAD)</li>
                <li><strong>다음 단계</strong>: 리드 50건 축적 → CPL 안정화 → 입찰 전략 전환</li>
              </ul>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginTop: 12 }}>
              <strong style={{ color: "#16a34a" }}>Clarity로 확인할 것:</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 16, lineHeight: 1.8 }}>
                <li>상담 예약 CTA까지 스크롤 도달률</li>
                <li>모바일 폼 제출 완료율</li>
                <li>Rage clicks — 예약 버튼 근처 좌절 패턴</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>데이터 없음</div>
      )}
    </Panel>
    <PageSpeedPanel site={site.key} />
    </>
  );
}

function InsightBox({ color, bg, border, title, children }: { color: string; bg: string; border: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: bg, border: `1px solid ${border}`, marginBottom: 10 }}>
      <strong style={{ color }}>{title}</strong>
      <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>{children}</p>
    </div>
  );
}
