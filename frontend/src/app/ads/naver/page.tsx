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
  cache_info: {
    status?: string;
    last_cached_at: string | null;
    first_date_in_cache?: string | null;
    last_date_in_cache: string | null;
    rows_in_window: number;
  };
  summary_cache?: {
    cached: boolean;
    cached_at_kst: string | null;
    next_refresh_at_kst: string | null;
    ttl_seconds: number;
    source: string;
    key_scope?: string;
    generation_ms?: number | null;
    request_ms?: number;
    stale?: boolean;
    stale_reason?: string;
    precompute?: boolean;
  };
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

type ActionTone = "red" | "amber" | "blue" | "green" | "slate";
type ActionRow = {
  priority: "P0" | "P1" | "P2" | "P3";
  tone: ActionTone;
  campaign: Campaign;
  action: string;
  why: string;
  nextStep: string;
  evidence: string;
  score: number;
};

const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const summaryCacheLabel = (source?: string) => {
  if (source === "lazy_cache_hit") return "사전 계산 cache hit";
  if (source === "live_cache_miss") return "방금 계산 후 cache 저장";
  if (source === "live_force") return "강제 재계산";
  return source || "확인 전";
};
const isLocalApiBase = /localhost|127\.0\.0\.1|\[::1\]/.test(API_BASE);
const runtimeSourceLabel = isLocalApiBase ? "로컬 backend / 로컬DB" : "VM Cloud backend / VM Cloud SQLite";
const runtimeSourceTone = isLocalApiBase ? "#92400e" : "#047857";
const runtimeSourceBg = isLocalApiBase ? "#fffbeb" : "#ecfdf5";
const runtimeSourceBorder = isLocalApiBase ? "#fde68a" : "#a7f3d0";
const operationalApiUrl = "https://att.ainativeos.net/api/ads/naver/campaign-summary?site=biocom";

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

const pct = (value: number) => `${Math.round(value * 100)}%`;

const buildActionRows = (data: ApiResponse): ActionRow[] => {
  const totalSpend = Math.max(data.totals.total_spend_krw, 1);
  const totalInternalRoas = data.totals.internal_real_roas ?? null;
  const active = data.campaigns_by_spend_desc.filter((c) => c.spend_krw > 0);

  return active
    .map((campaign): ActionRow => {
      const spendShare = campaign.spend_krw / totalSpend;
      const naverRoas = campaign.naver_claim_roas ?? 0;
      const cpc = campaign.clk_cnt > 0 ? Math.round(campaign.spend_krw / campaign.clk_cnt) : 0;
      const evidence = `광고비 ${campaign.spend_korean}, 클릭 ${fmtNum(campaign.clk_cnt)}회, CPC ${fmtNum(cpc)}원, 네이버 주장 ROAS ${campaign.naver_claim_roas != null ? `${campaign.naver_claim_roas}x` : "없음"}`;

      if (spendShare >= 0.35 && naverRoas >= 6) {
        return {
          priority: "P0",
          tone: "blue",
          campaign,
          action: "매칭 보강 후 증액 검토",
          why: `기간 광고비의 ${pct(spendShare)}를 쓰고 네이버는 고효율이라고 주장합니다. 다만 캠페인별 내부 결제완료 매출이 아직 직접 연결되지 않아 즉시 증액 판단은 위험합니다.`,
          nextStep: "최종 URL의 n_campaign/n_ad와 주문 paid_naver evidence를 캠페인 단위로 연결한 뒤, 내부 결제완료 ROAS가 유지되면 예산 증액을 검토합니다.",
          evidence,
          score: 100,
        };
      }

      if (campaign.campaign_tp === "POWER_CONTENTS" && campaign.clk_cnt >= 500 && naverRoas < 1) {
        return {
          priority: "P1",
          tone: "amber",
          campaign,
          action: "저가 클릭 품질 점검",
          why: "클릭은 많이 들어오지만 네이버 주장 매출이 거의 없습니다. 정보성 클릭이 구매 의도와 다를 수 있어 검색어와 랜딩 행동을 먼저 봐야 합니다.",
          nextStep: "검색어·콘텐츠별 클릭 후 결제 페이지 진입률을 확인하고, 결제 신호가 약하면 입찰/노출 범위를 줄입니다.",
          evidence,
          score: 88,
        };
      }

      if (campaign.spend_krw >= 100_000 && naverRoas < 1) {
        return {
          priority: "P0",
          tone: "red",
          campaign,
          action: "감액 또는 검색어 점검 후보",
          why: "광고비는 의미 있게 쓰였지만 네이버 기준으로도 매출 기여가 거의 없습니다. 내부 캠페인 매칭 전이라도 우선 점검 순위가 높습니다.",
          nextStep: "검색어 보고서, 기기, 랜딩 URL, 구매하기 진입률을 확인합니다. 주문 연결 evidence가 계속 없으면 예산 축소 후보로 올립니다.",
          evidence,
          score: 96,
        };
      }

      if (campaign.spend_krw >= 100_000 && naverRoas < 3) {
        return {
          priority: "P1",
          tone: "amber",
          campaign,
          action: "효율 점검 후보",
          why: "광고비가 작지 않고 네이버 주장 ROAS도 낮습니다. 내부 결제완료 매출까지 낮으면 감액 대상이 됩니다.",
          nextStep: "동일 기간 내부 paid_naver 주문의 유입 URL을 확인해 이 캠페인 후보가 있는지 먼저 좁힙니다.",
          evidence,
          score: 82,
        };
      }

      if (naverRoas >= 6 && spendShare < 0.15 && totalInternalRoas != null && totalInternalRoas >= 3) {
        return {
          priority: "P2",
          tone: "green",
          campaign,
          action: "소액 확장 실험 후보",
          why: "광고비 비중은 낮지만 네이버 주장 효율은 높고, 전체 내부 Naver ROAS도 양호합니다. 작은 폭의 확장 실험 후보입니다.",
          nextStep: "일 예산을 크게 올리기 전에 캠페인별 내부 매출 매칭을 먼저 붙이고, 3~7일 소액 증액 테스트로 봅니다.",
          evidence,
          score: 70,
        };
      }

      return {
        priority: "P3",
        tone: "slate",
        campaign,
        action: "유지 관찰",
        why: "현재 광고비와 클릭 규모가 작거나 판단 신호가 약합니다. 큰 예산 결정 전에 데이터가 더 필요합니다.",
        nextStep: "daily cache가 2~3회 더 쌓인 뒤 같은 기준으로 재정렬합니다.",
        evidence,
        score: 45,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
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
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`${API_BASE}/api/ads/naver/campaign-summary?site=biocom&since=${since}&until=${until}`);
        const j = (await r.json()) as ApiResponse | { ok: false; error: string };
        if (cancelled) return;
        if ("ok" in j && j.ok) setData(j);
        else setError("error" in j ? (j as { error: string }).error : "unknown");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [since, until]);

  const visibleCampaigns = useMemo(() => {
    const rows = data?.campaigns_by_spend_desc ?? [];
    const filtered = hideZeroSpend ? rows.filter((c) => c.spend_krw > 0) : rows;
    return sortCampaigns(filtered, sortKey);
  }, [data, hideZeroSpend, sortKey]);
  const actionRows = useMemo(() => (data ? buildActionRows(data) : []), [data]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "system-ui", color: "#0f172a" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>네이버 광고 성과</h1>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 18px" }}>
        네이버 검색광고 API (HMAC 인증)로 가져온 광고비 cache를 보여줍니다.
        광고비는 집행액 정본, 네이버 주장 매출은 참고용이며 내부 결제완료 매출과 합산하지 않습니다.
      </p>

      <section
        style={{
          background: runtimeSourceBg,
          border: `1px solid ${runtimeSourceBorder}`,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        <SourceMiniBlock
          label="현재 화면이 읽는 곳"
          value={runtimeSourceLabel}
          tone={runtimeSourceTone}
          note={isLocalApiBase ? "localhost 화면입니다. 로컬DB 보강/검증에는 유용하지만 운영 예산 판단값과 다를 수 있습니다." : "운영 화면입니다. 예산 판단 기준으로 볼 수 있습니다."}
        />
        <SourceMiniBlock
          label="운영 판단 기준"
          value="VM Cloud API"
          tone="#0369a1"
          note="예산 조정과 보고에는 att.ainativeos.net의 VM Cloud cache와 내부 evidence를 기준으로 봅니다."
        />
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
          <strong style={{ display: "block", color: "#0f172a", marginBottom: 3 }}>source 구분</strong>
          로컬 화면의 낮은 진짜 ROAS가 운영 성과 악화를 뜻하지는 않습니다. 같은 기간이라도 로컬DB와 VM Cloud의 결제 evidence가 다를 수 있습니다.
          <a href={operationalApiUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4, color: "#1d4ed8", fontWeight: 700 }}>
            운영 API 원본 확인
          </a>
        </div>
      </section>

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
        {data?.summary_cache && (
          <span style={{ fontSize: 11, color: data.summary_cache.source === "lazy_cache_hit" ? "#047857" : "#92400e" }}>
            요약 계산: {summaryCacheLabel(data.summary_cache.source)}
            {typeof data.summary_cache.request_ms === "number" ? ` · ${data.summary_cache.request_ms}ms` : ""}
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

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
            <SourceKpi label="현재 화면 source" value={runtimeSourceLabel} sub={API_BASE} />
            <SourceKpi label="광고비 cache 상태" value={data.cache_info.status ?? "ready"} sub={`${data.cache_info.rows_in_window.toLocaleString("ko-KR")} rows`} />
            <SourceKpi
              label="cache 보유 기간"
              value={`${data.cache_info.first_date_in_cache ?? "?"} ~ ${data.cache_info.last_date_in_cache ?? "?"}`}
              sub={data.cache_info.last_cached_at ? `갱신 ${new Date(data.cache_info.last_cached_at).toLocaleString("ko-KR")}` : "갱신 시각 없음"}
            />
            <SourceKpi
              label="요약 계산 cache"
              value={summaryCacheLabel(data.summary_cache?.source)}
              sub={
                data.summary_cache?.source === "lazy_cache_hit"
                  ? `${data.summary_cache.cached_at_kst ?? "?"} 계산 · 요청 ${data.summary_cache.request_ms ?? "?"}ms`
                  : `계산 ${data.summary_cache?.generation_ms ?? "?"}ms · 요청 ${data.summary_cache?.request_ms ?? "?"}ms`
              }
            />
            <SourceKpi label="운영 판단 기준" value="VM Cloud" sub="로컬DB 숫자와 분리해서 해석" />
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

          <section style={{ background: "white", border: "1px solid #dbeafe", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 4px" }}>Naver ROAS 액션 테이블</h2>
                <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.55 }}>
                  캠페인별 내부 결제완료 매출이 아직 직접 매칭되지 않았으므로, 이 표는 예산 확정표가 아니라 <strong>점검과 매칭 보강 우선순위</strong>입니다.
                </p>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", lineHeight: 1.5 }}>
                기준: {data.window.since} ~ {data.window.until}<br />
                source: {runtimeSourceLabel}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 960, borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
                    <th style={{ padding: "9px 10px", textAlign: "left", width: 72 }}>우선순위</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", width: 210 }}>추천 액션</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", minWidth: 220 }}>캠페인</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", minWidth: 280 }}>왜 하는가</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", minWidth: 250 }}>다음 확인점</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", minWidth: 180 }}>근거</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRows.map((row) => (
                    <tr key={row.campaign.ncc_campaign_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px" }}><ActionBadge priority={row.priority} tone={row.tone} /></td>
                      <td style={{ padding: "10px", fontWeight: 800, color: actionToneColor(row.tone) }}>{row.action}</td>
                      <td style={{ padding: "10px" }}>
                        <strong style={{ display: "block", color: "#0f172a" }}>{row.campaign.campaign_name}</strong>
                        <span style={{ display: "block", marginTop: 3, color: "#64748b", fontSize: 11 }}>
                          {translateTp(row.campaign.campaign_tp)} · {row.campaign.ncc_campaign_id}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "#334155", lineHeight: 1.55 }}>{row.why}</td>
                      <td style={{ padding: "10px", color: "#334155", lineHeight: 1.55 }}>{row.nextStep}</td>
                      <td style={{ padding: "10px", color: "#64748b", lineHeight: 1.55 }}>{row.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
              <li><strong>네이버 주장 매출 / ROAS</strong> = 네이버가 자기 attribution 기준 (보통 클릭 후 7일 안 결제) 으로 &quot;이 광고 덕분&quot; 이라 주장하는 값. 다른 광고 채널과 합치면 같은 매출 중복 카운트 위험.</li>
              <li><strong>진짜 ROAS</strong> = 우리 내부 결제완료 매출 (utm_source=naver) ÷ 광고비. <a href="/total" style={{ color: "#1d4ed8" }}>/total</a> 페이지의 paid_naver 채널 매출과 본 페이지 광고비 비교.</li>
              <li>{data.guardrails.campaign_id_to_utm_join_status}</li>
            </ul>
          </section>

          <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
            데이터: {data.cache_info.rows_in_window} row · 윈도우 {data.window.since} ~ {data.window.until} · 캐시 최신 {data.cache_info.last_date_in_cache} · 요약 계산 {summaryCacheLabel(data.summary_cache?.source)} · 현재 화면 source {runtimeSourceLabel}
          </div>
        </>
      )}
    </main>
  );
}

function SourceMiniBlock({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.55 }}>
      <span style={{ display: "block", color: "#64748b", fontWeight: 700, marginBottom: 2 }}>{label}</span>
      <strong style={{ display: "block", color: tone, fontSize: 15, marginBottom: 3 }}>{value}</strong>
      <span style={{ color: "#475569" }}>{note}</span>
    </div>
  );
}

function SourceKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
      <span style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>{label}</span>
      <strong style={{ display: "block", fontSize: 13, color: "#0f172a", wordBreak: "break-word" }}>{value}</strong>
      <span style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "#64748b", wordBreak: "break-word" }}>{sub}</span>
    </div>
  );
}

function actionToneColor(tone: ActionTone): string {
  const map: Record<ActionTone, string> = {
    red: "#b91c1c",
    amber: "#92400e",
    blue: "#1d4ed8",
    green: "#047857",
    slate: "#475569",
  };
  return map[tone];
}

function ActionBadge({ priority, tone }: { priority: ActionRow["priority"]; tone: ActionTone }) {
  const color = actionToneColor(tone);
  const bg: Record<ActionTone, string> = {
    red: "#fef2f2",
    amber: "#fffbeb",
    blue: "#eff6ff",
    green: "#ecfdf5",
    slate: "#f8fafc",
  };

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 40,
      borderRadius: 999,
      padding: "4px 8px",
      background: bg[tone],
      color,
      border: `1px solid ${color}`,
      fontSize: 11,
      fontWeight: 900,
    }}>
      {priority}
    </span>
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
