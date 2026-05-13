"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type Campaign = {
  ncc_campaign_id: string;
  campaign_name: string;
  campaign_tp: string;
  status: string;
  days: number;
  imp_cnt: number;
  clk_cnt: number;
  ctr: number | null;
  spend_krw: number;
  spend_korean: string;
  naver_claim_revenue_krw: number;
  naver_claim_revenue_korean: string;
  naver_claim_roas: number | null;
};

type ApiResponse = {
  ok: true;
  site: string;
  window: { since: string; until: string };
  configured: boolean;
  cache_info: { last_cached_at: string | null; last_date_in_cache: string | null; rows_in_window: number };
  totals: {
    campaigns_total: number;
    campaigns_with_spend: number;
    total_imp: number;
    total_clk: number;
    total_spend_krw: number;
    total_spend_korean: string;
    naver_claim_total_revenue_krw: number;
    naver_claim_total_revenue_korean: string;
    naver_claim_total_roas: number | null;
    internal_paid_naver_revenue_krw?: number;
    internal_paid_naver_revenue_korean?: string;
    internal_paid_naver_orders?: number;
    internal_real_roas?: number | null;
    internal_revenue_source?: string;
    internal_revenue_warning?: string | null;
    internal_revenue_window?: { since: string; until: string } | null;
    over_claim_krw?: number | null;
    over_claim_korean?: string | null;
  };
  campaigns_by_spend_desc: Campaign[];
  guardrails: { source: string; recommended_use: string; campaign_id_to_utm_join_status: string };
};

const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

type SortKey = "spend" | "naver_roas" | "clk" | "imp" | "ctr";
const sortCampaigns = (campaigns: Campaign[], key: SortKey): Campaign[] => {
  const sorted = [...campaigns];
  switch (key) {
    case "spend": return sorted.sort((a, b) => b.spend_krw - a.spend_krw);
    case "naver_roas": return sorted.sort((a, b) => (b.naver_claim_roas ?? 0) - (a.naver_claim_roas ?? 0));
    case "clk": return sorted.sort((a, b) => b.clk_cnt - a.clk_cnt);
    case "imp": return sorted.sort((a, b) => b.imp_cnt - a.imp_cnt);
    case "ctr": return sorted.sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0));
  }
};

const downloadCsv = (data: ApiResponse) => {
  const headers = ["campaign_id", "campaign_name", "campaign_tp", "status", "imp", "clk", "ctr_pct", "spend_krw", "naver_claim_revenue_krw", "naver_claim_roas"];
  const rows = data.campaigns_by_spend_desc.map((c) => [
    c.ncc_campaign_id,
    `"${c.campaign_name.replace(/"/g, '""')}"`,
    c.campaign_tp,
    c.status,
    c.imp_cnt,
    c.clk_cnt,
    c.ctr ?? "",
    c.spend_krw,
    c.naver_claim_revenue_krw,
    c.naver_claim_roas ?? "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naver-ads-${data.window.since}_${data.window.until}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function NaverAdsPage() {
  const [since, setSince] = useState(daysAgo(7));
  const [until, setUntil] = useState(daysAgo(1));
  const [draftSince, setDraftSince] = useState(since);
  const [draftUntil, setDraftUntil] = useState(until);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [hideZeroSpend, setHideZeroSpend] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/ads/naver/campaign-summary?site=biocom&since=${since}&until=${until}`)
      .then(async (r) => {
        const j = (await r.json()) as ApiResponse | { ok: false; error: string };
        if (cancelled) return;
        if ("ok" in j && j.ok) setData(j);
        else setError("error" in j ? (j as { error: string }).error : "unknown");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [since, until]);

  const visibleCampaigns = useMemo(() => {
    const rows = data?.campaigns_by_spend_desc ?? [];
    const filtered = hideZeroSpend ? rows.filter((c) => c.spend_krw > 0) : rows;
    return sortCampaigns(filtered, sortKey);
  }, [data, hideZeroSpend, sortKey]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui", color: "#0f172a" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>네이버 광고 성과</h1>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 18px" }}>
        네이버 검색광고 API (HMAC 인증) → 로컬DB <code>naver_ads_daily</code> 캐시 정본.
        광고비는 정본, 네이버 주장 매출은 참고용 (운영DB 결제완료 매출과 합산 금지).
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#475569" }}>
          from <input type="date" value={draftSince} onChange={(e) => setDraftSince(e.target.value)} style={{ marginLeft: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: "#475569" }}>
          to <input type="date" value={draftUntil} onChange={(e) => setDraftUntil(e.target.value)} style={{ marginLeft: 4 }} />
        </label>
        <button
          type="button"
          onClick={() => { setSince(draftSince); setUntil(draftUntil); }}
          style={{ background: "#03c75a", color: "white", border: 0, borderRadius: 6, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >조회</button>
        <div style={{ display: "inline-flex", gap: 4, marginLeft: 4 }}>
          {[7, 30, 90].map((n) => {
            const s = daysAgo(n);
            const u = daysAgo(1);
            const active = since === s && until === u;
            return (
              <button
                key={n}
                type="button"
                onClick={() => { setDraftSince(s); setDraftUntil(u); setSince(s); setUntil(u); }}
                style={{
                  background: active ? "#0f172a" : "white",
                  color: active ? "white" : "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >최근 {n}일</button>
            );
          })}
        </div>
        {data?.cache_info?.last_cached_at && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            캐시 갱신: {new Date(data.cache_info.last_cached_at).toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      {loading && <div style={{ padding: 20, color: "#475569" }}>불러오는 중…</div>}
      {error && (
        <div style={{ padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", marginBottom: 16 }}>
          에러: {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
            <KpiCard label="전체 광고비" value={data.totals.total_spend_korean} sub={`${fmtNum(data.totals.total_clk)}회 클릭 · CPC ${data.totals.total_clk > 0 ? Math.round(data.totals.total_spend_krw / data.totals.total_clk).toLocaleString("ko-KR") : "-"}원`} primary />
            <KpiCard
              label="진짜 ROAS"
              value={data.totals.internal_real_roas != null ? `${data.totals.internal_real_roas}x` : "-"}
              sub={
                data.totals.internal_paid_naver_revenue_korean
                  ? `${data.totals.internal_paid_naver_revenue_korean} · ${fmtNum(data.totals.internal_paid_naver_orders ?? 0)}건 (내부 paid_naver)`
                  : "내부 매출 미연결"
              }
              accent
            />
            <KpiCard
              label="네이버 주장 ROAS"
              value={data.totals.naver_claim_total_roas != null ? `${data.totals.naver_claim_total_roas}x` : "-"}
              sub={`${data.totals.naver_claim_total_revenue_korean} · 참고용`}
            />
            <KpiCard
              label="과대 주장 (Over-Claim)"
              value={data.totals.over_claim_korean ?? "-"}
              sub={
                data.totals.over_claim_krw != null
                  ? data.totals.over_claim_krw > 0
                    ? "네이버 주장 > 내부 실매출"
                    : "네이버 주장 ≤ 내부 실매출"
                  : "내부 매출 미연결"
              }
            />
            <KpiCard label="활성 캠페인" value={`${data.totals.campaigns_with_spend}/${data.totals.campaigns_total}`} sub={`총 노출 ${fmtNum(data.totals.total_imp)}회`} />
          </section>

          {data.totals.internal_revenue_warning ? (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#78350f" }}>
              ⚠️ 진짜 ROAS 주의: {data.totals.internal_revenue_warning}
              {data.totals.internal_revenue_source && (
                <span style={{ display: "block", marginTop: 4, color: "#92400e" }}>출처: {data.totals.internal_revenue_source}</span>
              )}
            </div>
          ) : data.totals.internal_revenue_window ? (
            <div style={{ marginBottom: 16, padding: "8px 14px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, fontSize: 12, color: "#065f46" }}>
              ✓ 진짜 ROAS 는 광고비와 <strong>같은 윈도우</strong> ({data.totals.internal_revenue_window.since} ~ {data.totals.internal_revenue_window.until}) 의 paid_naver 매출 기준.
              <span style={{ display: "block", marginTop: 2, color: "#047857", fontSize: 11 }}>출처: {data.totals.internal_revenue_source}</span>
            </div>
          ) : null}

          <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 8px" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                캠페인별 ROAS <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>({visibleCampaigns.length}개 노출)</span>
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#475569" }}>
                  정렬:
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    style={{ marginLeft: 4, padding: "3px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4 }}
                  >
                    <option value="spend">광고비 ↓</option>
                    <option value="naver_roas">네이버 주장 ROAS ↓</option>
                    <option value="clk">클릭 ↓</option>
                    <option value="imp">노출 ↓</option>
                    <option value="ctr">CTR ↓</option>
                  </select>
                </label>
                <label style={{ fontSize: 12, color: "#475569", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={hideZeroSpend} onChange={(e) => setHideZeroSpend(e.target.checked)} />
                  광고비 0 숨김
                </label>
                <button
                  type="button"
                  onClick={() => data && downloadCsv(data)}
                  disabled={!data}
                  style={{ background: "white", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: data ? "pointer" : "not-allowed" }}
                >📥 CSV</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
              ROAS 는 <strong>네이버 자체 attribution 기준</strong>. 같은 매출이라도 다른 광고와 중복으로 자기 공으로 잡았을 가능성. 예산 판단은 <a href="/total" style={{ color: "#1d4ed8" }}>/total</a> 의 내부 매출 (paid_naver 채널) 기준으로.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>캠페인</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>유형</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>노출</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>클릭</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>CTR</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>광고비</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>네이버 주장 매출</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>네이버 주장 ROAS</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>이 기간 광고비 발생 캠페인 없음</td></tr>
                )}
                {visibleCampaigns.map((c) => (
                  <tr key={c.ncc_campaign_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <strong>{c.campaign_name}</strong>
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>{c.status}</span>
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 12 }}>{translateTp(c.campaign_tp)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtNum(c.imp_cnt)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtNum(c.clk_cnt)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{c.ctr != null ? `${c.ctr}%` : "-"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{c.spend_korean}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b" }}>{c.naver_claim_revenue_korean}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: c.naver_claim_roas != null && c.naver_claim_roas >= 3 ? "#16a34a" : "#92400e", fontWeight: 700 }}>
                      {c.naver_claim_roas != null ? `${c.naver_claim_roas}x` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "12px 16px", fontSize: 12.5, color: "#78350f", lineHeight: 1.6 }}>
            <strong>읽는 법:</strong>
            <ul style={{ margin: "6px 0 0 18px", paddingLeft: 0 }}>
              <li><strong>광고비</strong> = 네이버 검색광고 API 가 응답한 실제 집행액. 가장 신뢰 가능한 정본.</li>
              <li><strong>네이버 주장 매출 / ROAS</strong> = 네이버가 자기 attribution 기준 (보통 클릭 후 7일 안 결제) 으로 "이 광고 덕분" 이라 주장하는 값. 다른 광고 채널과 합치면 같은 매출 중복 카운트 위험.</li>
              <li><strong>진짜 ROAS</strong> = 우리 내부 결제완료 매출 (utm_source=naver) ÷ 광고비. <a href="/total" style={{ color: "#1d4ed8" }}>/total</a> 페이지의 paid_naver 채널 매출과 본 페이지 광고비 비교.</li>
              <li>{data.guardrails.campaign_id_to_utm_join_status}</li>
            </ul>
          </section>

          <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
            데이터: {data.cache_info.rows_in_window} row · 윈도우 {data.window.since} ~ {data.window.until} · 캐시 최신 {data.cache_info.last_date_in_cache}
          </div>
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value, sub, primary, accent }: { label: string; value: string; sub?: string; primary?: boolean; accent?: boolean }) {
  const bg = accent
    ? "linear-gradient(180deg, #eff6ff, white)"
    : primary
      ? "linear-gradient(180deg, #f0fdf4, white)"
      : "white";
  const border = accent ? "1px solid #93c5fd" : primary ? "1px solid #86efac" : "1px solid #e2e8f0";
  const valueColor = accent ? "#1d4ed8" : primary ? "#15803d" : "#0f172a";
  const valueSize = accent || primary ? 22 : 18;
  return (
    <div style={{
      background: bg,
      border,
      borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{label}</span>
      <strong style={{ fontSize: valueSize, color: valueColor }}>{value}</strong>
      {sub && <span style={{ fontSize: 11, color: "#64748b" }}>{sub}</span>}
    </div>
  );
}

function translateTp(tp: string): string {
  const map: Record<string, string> = {
    WEB_SITE: "파워링크",
    SHOPPING: "쇼핑검색",
    POWER_CONTENTS: "파워컨텐츠",
    BRAND_SEARCH: "브랜드검색",
    PLACE: "플레이스",
    POWER_LINK_PLUS: "파워링크+",
  };
  return map[tp] || tp;
}
