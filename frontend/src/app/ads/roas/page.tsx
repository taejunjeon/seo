"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const CHANNEL_COLORS: Record<string, string> = { meta: "#6366f1", google: "#10b981", daangn: "#f59e0b" };
const CHANNEL_LABELS: Record<string, string> = { meta: "Meta (Facebook/Instagram)", google: "Google Ads", daangn: "당근마켓" };
const ROAS_LAG_NOTE = "메인 ROAS는 confirmed ledger만 반영한다. 따라서 오늘/최근 1~2일 수치는 pending 결제와 PG 확정 지연 때문에 잠정치로 낮게 보일 수 있다.";

type ChannelData = {
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number | null;
  placeholder: boolean;
  dataSource: string;
};

type SiteSummary = {
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
};

type DailyRoas = {
  date: string;
  spend: number;
  revenue: number;
  roas: number | null;
};

export default function RoasPage() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [dailyRoas, setDailyRoas] = useState<DailyRoas[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const daysBack = datePreset === "last_7d" ? 7 : datePreset === "last_14d" ? 14 : datePreset === "last_90d" ? 90 : 30;
      const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

      const [channelRes, siteRes] = await Promise.all([
        fetch(`${API_BASE}/api/ads/channel-comparison?start_date=${startDate}&end_date=${today}`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/ads/site-summary?date_preset=${datePreset}`).then((r) => r.json()).catch(() => null),
      ]);

      if (channelRes?.ok) setChannels(channelRes.channels ?? []);
      if (siteRes?.ok) {
        const siteList = siteRes.sites ?? [];
        setSites(siteList);
        if (!selectedAccountId && siteList.length > 0) {
          const activeSite = siteList.find((s: SiteSummary) => s.spend > 0) ?? siteList[0];
          setSelectedAccountId(activeSite.account_id);
        }
      }

      // 일별 ROAS (광고 집행 중인 계정)
      if (selectedAccountId) {
        const dailyRes = await fetch(`${API_BASE}/api/ads/roas/daily?account_id=${selectedAccountId}&start_date=${startDate}&end_date=${today}`).then((r) => r.json()).catch(() => null);
        if (dailyRes?.ok) setDailyRoas(dailyRes.daily ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [datePreset, selectedAccountId]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 48px", background: "linear-gradient(180deg, rgba(248,250,252,0.96), #fff)" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.84)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 1px 6px rgba(15,23,42,0.08)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/ads" style={{ fontSize: "0.76rem", color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
              ← 광고 대시보드로 돌아가기
            </Link>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginTop: 4 }}>ROAS 모니터링 대시보드</h1>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", marginTop: 4 }}>
              광고비 대비 매출(ROAS)을 채널별·사이트별로 비교한다. confirmed ledger만 메인 기준으로 사용한다.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { value: "last_7d", label: "7일" },
              { value: "last_14d", label: "14일" },
              { value: "last_30d", label: "30일" },
              { value: "last_90d", label: "90일" },
            ].map((p) => (
              <button key={p.value} type="button" onClick={() => setDatePreset(p.value)} style={{
                padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                border: datePreset === p.value ? "2px solid #6366f1" : "1px solid #e2e8f0",
                background: datePreset === p.value ? "#eef2ff" : "#fff",
                color: datePreset === p.value ? "#4338ca" : "#64748b",
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24, display: "grid", gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <p>ROAS 데이터를 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fdba74", color: "#7c2d12", fontSize: "0.78rem", lineHeight: 1.7 }}>
              <strong>확정 기준 안내</strong>: {ROAS_LAG_NOTE}
            </div>

            {/* 전체 ROAS 요약 */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <KpiCard label="총 광고비" value={fmtKRW(totalSpend)} sub={`${channels.filter((c) => !c.placeholder).length}개 채널 합산`} />
              <KpiCard label="광고 귀속 매출" value={fmtKRW(totalRevenue)} sub="confirmed ledger + UTM/fbclid 매칭" />
              <KpiCard label="전체 ROAS" value={overallRoas != null ? `${overallRoas.toFixed(2)}x` : "—"} sub={overallRoas != null ? `광고 ₩1 → 매출 ₩${overallRoas.toFixed(0)}` : "광고비 없음"} tone={overallRoas != null && overallRoas >= 1 ? "success" : "warn"} />
              <KpiCard label="채널 수" value={`${channels.filter((c) => !c.placeholder).length}개 활성`} sub={`${channels.filter((c) => c.placeholder).length}개 미연동`} />
            </section>

            {/* 채널별 ROAS 비교 */}
            <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
              <Panel title="채널별 성과 비교">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" as const }}>채널</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>광고비</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>노출</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>클릭</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>매출</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch) => (
                        <tr key={ch.channel} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: CHANNEL_COLORS[ch.channel] ?? "#94a3b8", marginRight: 8 }} />
                            <strong>{CHANNEL_LABELS[ch.channel] ?? ch.channel}</strong>
                            {ch.placeholder && <span style={{ marginLeft: 6, fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>미연동</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(ch.spend)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(ch.impressions)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(ch.clicks)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(ch.revenue)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: ch.roas != null && ch.roas >= 1 ? "#16a34a" : ch.roas != null ? "#dc2626" : "#94a3b8" }}>
                            {ch.roas != null ? `${ch.roas.toFixed(2)}x` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="광고비 채널 비중">
                {totalSpend > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={channels.filter((c) => c.spend > 0).map((c) => ({ name: CHANNEL_LABELS[c.channel] ?? c.channel, value: c.spend }))}
                        cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                        dataKey="value" paddingAngle={2}
                      >
                        {channels.filter((c) => c.spend > 0).map((c, i) => (
                          <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel] ?? COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: "0.82rem" }}>광고비 데이터 없음</div>
                )}
              </Panel>
            </section>

            {/* 사이트별 ROAS */}
            <Panel title="사이트별 ROAS 비교">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {sites.map((s) => (
                  <div key={s.site} style={{
                    padding: 18, borderRadius: 14,
                    border: `1.5px solid ${s.spend > 0 ? "#6366f1" : "#e2e8f0"}`,
                    background: s.spend > 0 ? "linear-gradient(180deg, #eef2ff, #fff)" : "#f8fafc",
                    cursor: s.account_id ? "pointer" : "default",
                  }} onClick={() => s.account_id && setSelectedAccountId(s.account_id)}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>
                      {s.site === "biocom" ? "바이오컴" : s.site === "thecleancoffee" ? "더클린커피" : "AIBIO"}
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: s.roas != null && s.roas >= 1 ? "#16a34a" : s.roas != null ? "#dc2626" : "#94a3b8", marginTop: 6 }}>
                      {s.roas != null ? `${s.roas.toFixed(2)}x` : "—"}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 4 }}>ROAS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: "0.76rem" }}>
                      <div><span style={{ color: "#94a3b8" }}>광고비</span><br /><strong>{fmtKRW(s.spend)}</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>매출</span><br /><strong>{fmtKRW(s.revenue)}</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>주문</span><br /><strong>{fmtNum(s.orders)}건</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>클릭</span><br /><strong>{fmtNum(s.clicks)}</strong></div>
                    </div>
                    {selectedAccountId === s.account_id && (
                      <div style={{ marginTop: 8, fontSize: "0.68rem", color: "#6366f1", fontWeight: 600 }}>일별 추이 표시 중</div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            {/* 일별 ROAS 추이 */}
            {dailyRoas.length > 0 && (
              <Panel title="일별 ROAS 추이">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyRoas} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis yAxisId="krw" tickFormatter={(v) => `₩${(Number(v) / 10000).toFixed(0)}만`} width={70} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="roas" orientation="right" tickFormatter={(v) => `${Number(v).toFixed(1)}x`} width={50} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v, name) => name === "ROAS" ? `${Number(v).toFixed(2)}x` : fmtKRW(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="krw" dataKey="spend" name="광고비" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Bar yAxisId="krw" dataKey="revenue" name="매출" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Line yAxisId="roas" dataKey="roas" name="ROAS" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}

            {/* iROAS 섹션 */}
            <IroasSection />

            {/* 해석 가이드 */}
            <div style={{ padding: "16px 18px", borderRadius: 14, borderLeft: "4px solid #6366f1", background: "rgba(99,102,241,0.04)", color: "#475569", lineHeight: 1.7, fontSize: "0.84rem" }}>
              <strong>ROAS vs iROAS 읽는 법</strong>
              <p style={{ marginTop: 8 }}>
                <strong>확정 기준 주의</strong>: {ROAS_LAG_NOTE}
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>ROAS</strong> 2.44x = 광고비 ₩1을 쓰면 매출 ₩2.44가 들어온다는 뜻이다.
                1.0x 이상이면 광고비를 회수하고 있고, 3.0x 이상이면 효율이 좋은 편이다.
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>iROAS (증분 ROAS)</strong>는 "광고가 없었다면 발생하지 않았을 매출"만 계산한 것이다.
                ROAS가 3.0x인데 iROAS가 0.5x라면, 고객이 광고 없이도 샀을 가능성이 높다는 뜻이다.
                iROAS가 ROAS보다 높으면 광고가 진짜 새 매출을 만들고 있다는 의미이다.
              </p>
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
      padding: "16px 18px", borderRadius: 14,
      border: "1px solid rgba(148,163,184,0.18)",
      background: tone === "success" ? "linear-gradient(180deg, #f0fdf4, #fff)" : tone === "warn" ? "linear-gradient(180deg, #fffbeb, #fff)" : "linear-gradient(180deg, #fff, #f8fafc)",
    }}>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 22, borderRadius: 16, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(148,163,184,0.18)", boxShadow: "0 8px 24px rgba(15,23,42,0.05)" }}>
      <h2 style={{ fontSize: "1.02rem", fontWeight: 700, marginBottom: 18 }}>{title}</h2>
      {children}
    </section>
  );
}

/* ─── iROAS 섹션 ─── */
type IroasExperiment = {
  experiment_key: string;
  name: string;
  status: string;
  channel: string;
  treatment_revenue: number;
  control_revenue: number;
  incremental_revenue: number;
  ad_spend: number;
  iroas: number | null;
  treatment_count: number;
  control_count: number;
  treatment_purchase_rate: number;
  control_purchase_rate: number;
};

function IroasSection() {
  const [experiments, setExperiments] = useState<IroasExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}/api/ads/iroas/experiments`, { signal: ac.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.ok) setExperiments(d.experiments ?? []); })
      .catch((err) => { if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "iROAS 데이터를 불러올 수 없음"); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, []);

  const totalIncremental = experiments.reduce((s, e) => s + e.incremental_revenue, 0);
  const totalAdSpend = experiments.reduce((s, e) => s + e.ad_spend, 0);
  const overallIroas = totalAdSpend > 0 ? totalIncremental / totalAdSpend : null;

  return (
    <Panel title="iROAS — 증분 광고수익률 (실험 기반)">
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>iROAS 데이터를 불러오는 중...</div>
      ) : error ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.82rem" }}>
          {error}
        </div>
      ) : experiments.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: "1.2rem", color: "#94a3b8", marginBottom: 8 }}>실험 데이터 없음</div>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            iROAS는 control/treatment 실험 결과가 있어야 계산됨.
            CRM 관리 허브의 실험 운영 탭에서 실험을 생성하고 전환 동기화를 실행하면 여기에 표시됨.
          </p>
        </div>
      ) : (
        <>
          {/* iROAS 요약 KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
            <KpiCard
              label="전체 iROAS"
              value={overallIroas != null ? `${overallIroas.toFixed(2)}x` : "—"}
              sub={overallIroas != null ? "증분 매출 기준" : "광고비 또는 실험 데이터 부족"}
              tone={overallIroas != null && overallIroas >= 1 ? "success" : "warn"}
            />
            <KpiCard label="증분 매출 합계" value={fmtKRW(totalIncremental)} sub={`${experiments.length}개 실험 합산`} />
            <KpiCard label="광고비 합계" value={fmtKRW(totalAdSpend)} sub="실험 기간 중 집행 비용" />
          </div>

          {/* 실험별 iROAS 테이블 */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" as const }}>실험</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>실험군 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>대조군 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>증분 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>광고비</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>ROAS</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>iROAS</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => {
                  const roas = e.ad_spend > 0 ? (e.treatment_revenue / e.ad_spend) : null;
                  return (
                    <tr key={e.experiment_key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{e.name}</strong>
                        <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
                          {e.experiment_key} · {e.channel} · {e.status}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>
                          실험군 {fmtNum(e.treatment_count)}명 ({fmtPct(e.treatment_purchase_rate * 100)} 구매) · 대조군 {fmtNum(e.control_count)}명 ({fmtPct(e.control_purchase_rate * 100)} 구매)
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(e.treatment_revenue)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(e.control_revenue)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: e.incremental_revenue > 0 ? "#16a34a" : e.incremental_revenue < 0 ? "#dc2626" : "#94a3b8" }}>
                        {e.incremental_revenue >= 0 ? "+" : ""}{fmtKRW(e.incremental_revenue)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(e.ad_spend)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#94a3b8" }}>
                        {roas != null ? `${roas.toFixed(2)}x` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: e.iroas != null && e.iroas >= 1 ? "#16a34a" : e.iroas != null ? "#dc2626" : "#94a3b8" }}>
                        {e.iroas != null ? `${e.iroas.toFixed(2)}x` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ROAS vs iROAS 비교 차트 */}
          {experiments.some((e) => e.iroas != null) && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 12 }}>ROAS vs iROAS 비교</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={experiments.map((e) => ({
                    name: e.name.length > 12 ? e.name.slice(0, 12) + "…" : e.name,
                    ROAS: e.ad_spend > 0 ? Number((e.treatment_revenue / e.ad_spend).toFixed(2)) : 0,
                    iROAS: e.iroas ?? 0,
                  }))}
                  margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${Number(v).toFixed(1)}x`} width={50} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)}x`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ROAS" name="ROAS (광고 클릭 매출)" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Bar dataKey="iROAS" name="iROAS (증분 매출)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
