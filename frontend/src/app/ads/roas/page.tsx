"use client";

/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const META_PRIMARY_ATTR_WINDOW = "1d_click";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtRoasX = (v: number | null | undefined) => (v != null ? `${v.toFixed(2)}x` : "—");
const fmtShortDate = (value: string) => value.slice(5);
const formatRoasTooltip = (value: string | number | undefined) => `${Number(value ?? 0).toFixed(2)}x`;

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const CHANNEL_COLORS: Record<string, string> = {
  meta: "#6366f1",
  google: "#10b981",
  daangn: "#f59e0b",
};
const CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta (Facebook/Instagram)",
  google: "Google Ads",
  daangn: "당근마켓",
};
const SITE_LABELS: Record<string, string> = {
  biocom: "바이오컴",
  thecleancoffee: "더클린커피",
  aibio: "AIBIO 리커버리랩",
};
const DATE_PRESETS = [
  { value: "last_7d", label: "7일" },
  { value: "last_14d", label: "14일" },
  { value: "last_30d", label: "30일" },
  { value: "last_90d", label: "90일" },
];
const DATE_PRESET_LABELS: Record<string, string> = {
  last_7d: "최근 7일",
  last_14d: "최근 14일",
  last_30d: "최근 30일",
  last_90d: "최근 90일",
};
const ROAS_LAG_NOTE = "confirmed ledger만 메인 ROAS에 반영한다. 오늘/최근 1~2일 수치는 pending 결제와 PG 확정 지연 때문에 잠정치로 낮게 보일 수 있다.";

type MetaReference = {
  mode: "ads_manager_parity" | "custom_window_override";
  actionReportTime: string;
  useUnifiedAttributionSetting: boolean;
  requestedAttributionWindow: string | null;
  appliedAttributionWindows: string[] | null;
  actionValueField: string;
  purchaseRoasField: string;
  websitePurchaseRoasField: string;
  numeratorDefinition: string;
  comparisonGuidance: string;
};

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

type SiteSummaryResponse = {
  ok: boolean;
  date_preset: string | null;
  start_date: string;
  end_date: string;
  meta_reference: MetaReference;
  sites: SiteSummary[];
  total: {
    impressions: number;
    clicks: number;
    spend: number;
    revenue: number;
    roas: number | null;
    confirmedRevenue: number;
    pendingRevenue: number;
    potentialRevenue: number;
    metaPurchaseValue: number;
    confirmedRoas: number | null;
    potentialRoas: number | null;
    metaPurchaseRoas: number | null;
    orders: number;
  };
};

type DailyRoas = {
  date: string;
  spend: number;
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

type DailyRoasResponse = {
  ok: boolean;
  account_id: string;
  date_preset: string | null;
  start_date: string;
  end_date: string;
  meta_reference: MetaReference;
  rows: DailyRoas[];
  summary: {
    spend: number;
    revenue: number;
    confirmedRevenue: number;
    pendingRevenue: number;
    potentialRevenue: number;
    metaPurchaseValue: number;
    roas: number | null;
    confirmedRoas: number | null;
    potentialRoas: number | null;
    metaPurchaseRoas: number | null;
  };
};

type ChannelComparisonResponse = {
  ok: boolean;
  start_date: string;
  end_date: string;
  channels: ChannelData[];
};

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

const resolveDefaultAccountId = (sites: SiteSummary[], currentAccountId: string) => {
  if (currentAccountId && sites.some((site) => site.account_id === currentAccountId)) {
    return currentAccountId;
  }
  return sites.find((site) => site.spend > 0)?.account_id ?? sites[0]?.account_id ?? "";
};

export default function RoasPage() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [siteSummary, setSiteSummary] = useState<SiteSummaryResponse | null>(null);
  const [dailyResponse, setDailyResponse] = useState<DailyRoasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const daysBack = datePreset === "last_7d"
        ? 7
        : datePreset === "last_14d"
          ? 14
          : datePreset === "last_90d"
            ? 90
            : 30;
      const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

      const [channelRaw, siteRaw] = await Promise.all([
        fetch(`${API_BASE}/api/ads/channel-comparison?start_date=${startDate}&end_date=${today}`)
          .then((response) => response.json())
          .catch(() => null),
        fetch(`${API_BASE}/api/ads/site-summary?date_preset=${datePreset}&attribution_window=${META_PRIMARY_ATTR_WINDOW}`)
          .then((response) => response.json())
          .catch(() => null),
      ]);

      const nextChannels = (channelRaw as ChannelComparisonResponse | null)?.ok
        ? (channelRaw as ChannelComparisonResponse).channels ?? []
        : [];
      setChannels(nextChannels);

      const nextSiteSummary = (siteRaw as SiteSummaryResponse | null)?.ok
        ? siteRaw as SiteSummaryResponse
        : null;
      setSiteSummary(nextSiteSummary);

      const accountIdToLoad = resolveDefaultAccountId(nextSiteSummary?.sites ?? [], selectedAccountId);
      if (accountIdToLoad && accountIdToLoad !== selectedAccountId) {
        setSelectedAccountId(accountIdToLoad);
      }

      if (!accountIdToLoad) {
        setDailyResponse(null);
        return;
      }

      const dailyRaw = await fetch(`${API_BASE}/api/ads/roas/daily?account_id=${accountIdToLoad}&date_preset=${datePreset}&attribution_window=${META_PRIMARY_ATTR_WINDOW}`)
        .then((response) => response.json())
        .catch(() => null);
      setDailyResponse((dailyRaw as DailyRoasResponse | null)?.ok ? dailyRaw as DailyRoasResponse : null);
    } finally {
      setLoading(false);
    }
  }, [datePreset, selectedAccountId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedSite = siteSummary?.sites.find((site) => site.account_id === selectedAccountId) ?? null;
  const dailyRoas = dailyResponse?.rows ?? [];
  const metaReference = dailyResponse?.meta_reference ?? siteSummary?.meta_reference ?? null;
  const totalSpend = channels.reduce((sum, channel) => sum + channel.spend, 0);
  const totalRevenue = channels.reduce((sum, channel) => sum + channel.revenue, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const totalConfirmedRoas = siteSummary?.total.confirmedRoas ?? siteSummary?.total.roas ?? null;
  const totalPotentialRoas = siteSummary?.total.potentialRoas ?? null;
  const totalMetaPurchaseRoas = siteSummary?.total.metaPurchaseRoas ?? null;
  const totalGapRatio = totalConfirmedRoas != null && totalConfirmedRoas > 0 && totalMetaPurchaseRoas != null
    ? totalMetaPurchaseRoas / totalConfirmedRoas
    : null;
  const selectedGapRatio = selectedSite?.roas != null && selectedSite.roas > 0 && selectedSite.metaPurchaseRoas != null
    ? selectedSite.metaPurchaseRoas / selectedSite.roas
    : null;
  const currentPresetLabel = DATE_PRESET_LABELS[datePreset] ?? "선택 기간";
  const isLongWindow = datePreset === "last_30d" || datePreset === "last_90d";
  const selectedSiteLabel = selectedSite ? SITE_LABELS[selectedSite.site] ?? selectedSite.site : "선택 사이트";

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 48px", background: "linear-gradient(180deg, rgba(248,250,252,0.96), #fff)" }}>
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.84)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 1px 6px rgba(15,23,42,0.08)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/ads" style={{ fontSize: "0.76rem", color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
              ← 광고 대시보드로 돌아가기
            </Link>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginTop: 4 }}>ROAS 모니터링 대시보드</h1>
            <p style={{ fontSize: "0.84rem", color: "#94a3b8", marginTop: 4 }}>
              Attribution confirmed, confirmed+pending, Meta purchase, iROAS를 같은 화면에서 비교한다.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDatePreset(preset.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: datePreset === preset.value ? "2px solid #6366f1" : "1px solid #e2e8f0",
                  background: datePreset === preset.value ? "#eef2ff" : "#fff",
                  color: datePreset === preset.value ? "#4338ca" : "#64748b",
                }}
              >
                {preset.label}
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
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fdba74", color: "#7c2d12", fontSize: "0.78rem", lineHeight: 1.75 }}>
              <strong style={{ color: "#9a3412" }}>운영 headline</strong>
              <div>운영 메인: <strong>{selectedSiteLabel} {currentPresetLabel} Attribution confirmed {fmtRoasX(selectedSite?.roas)}</strong></div>
              <div>운영 보조: <strong>confirmed+pending {fmtRoasX(selectedSite?.potentialRoas)}</strong></div>
              <div>플랫폼 참고: <strong>Meta purchase {fmtRoasX(selectedSite?.metaPurchaseRoas)}</strong> (Ads Manager `결과 ROAS`/`결과 값` 대응)</div>
              <div>
                해석: Meta가 내부 confirmed보다 더 넓게 잡고 있소. <strong>30일 값은 rollout bias가 섞인 보수치</strong>라서 운영 기본 탭은 최근 7일이오.
                <strong> 잠정 상한선</strong>은 Ads Manager export/timezone 최종 대조 전까지 사이트 전체 confirmed 기준의 임시 상한으로 읽으시오.
              </div>
              <div style={{ marginTop: 6 }}>
                개념 먼저 구분하시오: Attribution ROAS는 우리 attribution ledger 기준의 내부 운영값이고, Meta purchase ROAS는 Meta가 광고에 귀속한 conversion value 기준의 플랫폼 참고값이오.
                iROAS는 여기서 한 번 더 달라서, <strong>실험이 없었다면 발생하지 않았을 증분 매출</strong>만 쓰는 실험 지표요. 즉 세 값은 이름이 비슷해도 같은 숫자가 아니오.
                Meta 화면에서는 큰 <strong>구매 전환값</strong> 열보다 <strong>결과 ROAS</strong>와 그 옆 <strong>결과 값</strong> 계열을 API 비교 대상으로 고정하시오.
              </div>
            </div>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <KpiCard
                label="전체 confirmed ROAS"
                value={fmtRoasX(totalConfirmedRoas)}
                sub={siteSummary ? `확정 매출 ${fmtKRW(siteSummary.total.confirmedRevenue)} / 광고비 ${fmtKRW(siteSummary.total.spend)}` : "—"}
                tone={totalConfirmedRoas != null && totalConfirmedRoas >= 1 ? "success" : "warn"}
              />
              <KpiCard
                label="전체 confirmed+pending"
                value={fmtRoasX(totalPotentialRoas)}
                sub={siteSummary ? `확정+대기 ${fmtKRW(siteSummary.total.potentialRevenue)} 기준` : "—"}
                tone={totalPotentialRoas != null && totalPotentialRoas >= 1 ? "success" : "warn"}
              />
              <KpiCard
                label="전체 Meta purchase"
                value={fmtRoasX(totalMetaPurchaseRoas)}
                sub={siteSummary ? `Meta 가치 ${fmtKRW(siteSummary.total.metaPurchaseValue)} / spend` : "—"}
              />
              <KpiCard
                label="총 광고비"
                value={fmtKRW(siteSummary?.total.spend ?? totalSpend)}
                sub={totalGapRatio != null ? `Meta/Attribution 격차 ${totalGapRatio.toFixed(1)}배` : "비교 가능한 ROAS 부족"}
              />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
              <Panel title="채널별 confirmed ROAS">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" }}>채널</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>광고비</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>노출</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>클릭</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>confirmed 매출</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((channel) => (
                        <tr key={channel.channel} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: CHANNEL_COLORS[channel.channel] ?? "#94a3b8", marginRight: 8 }} />
                            <strong>{CHANNEL_LABELS[channel.channel] ?? channel.channel}</strong>
                            {channel.placeholder && (
                              <span style={{ marginLeft: 6, fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>
                                미연동
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(channel.spend)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(channel.impressions)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(channel.clicks)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(channel.revenue)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: channel.roas != null && channel.roas >= 1 ? "#16a34a" : channel.roas != null ? "#dc2626" : "#94a3b8" }}>
                            {fmtRoasX(channel.roas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="채널별 광고비 비중">
                {totalSpend > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={channels.filter((channel) => channel.spend > 0).map((channel) => ({
                          name: CHANNEL_LABELS[channel.channel] ?? channel.channel,
                          value: channel.spend,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={74}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {channels.filter((channel) => channel.spend > 0).map((channel, index) => (
                          <Cell key={channel.channel} fill={CHANNEL_COLORS[channel.channel] ?? COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => fmtKRW(Number(value))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: "0.82rem" }}>광고비 데이터 없음</div>
                )}
                <div style={{ marginTop: 12, fontSize: "0.74rem", color: "#64748b", lineHeight: 1.6 }}>
                  채널 표의 ROAS는 confirmed attribution 기준이오. Meta purchase value를 얹은 값이 아니므로 Ads Manager 수치보다 낮게 보이는 것이 기본값일 수 있소.
                </div>
              </Panel>
            </section>

            <Panel title="사이트별 비교">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {(siteSummary?.sites ?? []).map((site) => (
                  <div
                    key={site.site}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAccountId(site.account_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAccountId(site.account_id);
                      }
                    }}
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      border: selectedAccountId === site.account_id ? "2px solid #6366f1" : "1.5px solid #e2e8f0",
                      background: selectedAccountId === site.account_id ? "linear-gradient(180deg, #eef2ff, #fff)" : "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                      {SITE_LABELS[site.site] ?? site.site}
                    </div>
                    <div style={{ fontSize: "1.56rem", fontWeight: 700, color: site.roas != null && site.roas >= 1 ? "#16a34a" : site.roas != null ? "#dc2626" : "#94a3b8", marginTop: 6 }}>
                      {fmtRoasX(site.roas)}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 4 }}>Attribution confirmed ROAS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: "0.76rem" }}>
                      <div><span style={{ color: "#94a3b8" }}>광고비</span><br /><strong>{fmtKRW(site.spend)}</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>confirmed</span><br /><strong>{fmtKRW(site.confirmedRevenue)}</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>pending</span><br /><strong>{fmtKRW(site.pendingRevenue)}</strong></div>
                      <div><span style={{ color: "#94a3b8" }}>Meta value</span><br /><strong>{fmtKRW(site.metaPurchaseValue)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {selectedSite && (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                  <KpiCard
                    label={`${SITE_LABELS[selectedSite.site] ?? selectedSite.site} Meta purchase`}
                    value={fmtRoasX(selectedSite.metaPurchaseRoas)}
                    sub={`Meta 가치 ${fmtKRW(selectedSite.metaPurchaseValue)} / 광고비 ${fmtKRW(selectedSite.spend)}`}
                  />
                  <KpiCard
                    label={`${SITE_LABELS[selectedSite.site] ?? selectedSite.site} Attr confirmed`}
                    value={fmtRoasX(selectedSite.roas)}
                    sub={`confirmed ${fmtKRW(selectedSite.confirmedRevenue)} / 주문 ${fmtNum(selectedSite.confirmedOrders)}건`}
                    tone={selectedSite.roas != null && selectedSite.roas >= 1 ? "success" : "warn"}
                  />
                  <KpiCard
                    label={`${SITE_LABELS[selectedSite.site] ?? selectedSite.site} Attr confirmed+pending`}
                    value={fmtRoasX(selectedSite.potentialRoas)}
                    sub={`pending ${fmtKRW(selectedSite.pendingRevenue)} 포함 / 주문 ${fmtNum(selectedSite.pendingOrders)}건`}
                    tone={selectedSite.potentialRoas != null && selectedSite.potentialRoas >= 1 ? "success" : "warn"}
                  />
                  <KpiCard
                    label={`${SITE_LABELS[selectedSite.site] ?? selectedSite.site} 잠정 상한선`}
                    value={fmtRoasX(selectedSite.bestCaseCeilingRoas)}
                    sub={selectedGapRatio != null ? `Meta/Attr 격차 ${selectedGapRatio.toFixed(1)}배 · Ads Manager export 최종 대조 전` : "비교 가능한 ROAS 부족"}
                  />
                </section>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                  <Panel title="Attribution ROAS 해석 메모">
                    <div style={{ display: "grid", gap: 10, fontSize: "0.82rem", color: "#475569", lineHeight: 1.75 }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>Attribution confirmed ROAS</strong>는
                        {" "}
                        <strong>우리 attribution ledger에서 Meta로 귀속되고 `payment_status=confirmed`까지 된 매출</strong>만 분자로 쓰오.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>confirmed+pending ROAS</strong>는
                        {" "}
                        confirmed에 가상계좌 대기분을 임시로 더한 값이오. 확정 지연 때문에 눌린 것인지, 실제 효율 저하인지 가르는 보조값이오.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>Meta purchase ROAS</strong>는
                        {" "}
                        <strong>{metaReference?.actionValueField ?? "action_values[purchase]"}</strong>
                        {" "}
                        / spend 기준이오. 이 값의 분자는 PG 확정매출이 아니라
                        {" "}
                        <strong>Meta가 광고에 귀속한 conversion value</strong>라서 내부 confirmed ROAS와 다르게 나오는 것이 정상일 수 있소.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>현재 선택 사이트 차이</strong>:
                        {" "}
                        Meta purchase는 <strong>{fmtRoasX(selectedSite.metaPurchaseRoas)}</strong>,
                        confirmed attribution은 <strong>{fmtRoasX(selectedSite.roas)}</strong>,
                        confirmed+pending은 <strong>{fmtRoasX(selectedSite.potentialRoas)}</strong>요.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>기간 해석 주의</strong>:
                        {" "}
                        {isLongWindow
                          ? `${currentPresetLabel}는 rollout bias가 섞인 보수치라서 최근 7일·14일과 함께 읽어야 하오.`
                          : `${currentPresetLabel}는 fetch-fix 이후 품질을 더 잘 반영하는 운영 메인 구간이오.`}
                      </div>
                    </div>
                  </Panel>

                  <Panel title="Meta parity 체크">
                    <div style={{ display: "grid", gap: 10, fontSize: "0.8rem", color: "#475569", lineHeight: 1.7 }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>action_report_time</strong> = <code>{metaReference?.actionReportTime ?? "conversion"}</code>
                        {" "}
                        이라서 일별 표는 <strong>전환이 발생한 날짜 기준</strong>으로 맞췄소.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>use_unified_attribution_setting</strong> = <code>{String(metaReference?.useUnifiedAttributionSetting ?? true)}</code>
                        {" "}
                        이오. 현재 Meta ROAS headline은 <code>{metaReference?.requestedAttributionWindow ?? META_PRIMARY_ATTR_WINDOW}</code> 기준이고, Ads Manager 기본값은 보조 참고값으로만 보오.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>purchase_roas</strong>와
                        {" "}
                        <strong>website_purchase_roas</strong>는 같은 필드가 아니오.
                        이 화면은 Meta 분자 자체를 참고할 때
                        {" "}
                        <strong>{metaReference?.actionValueField ?? "action_values[purchase]"}</strong>
                        {" "}
                        를 기준으로 설명하오.
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>운영 원칙</strong>: 메인값은 Attribution confirmed ROAS, Meta purchase ROAS headline은 클릭 1일 기준 플랫폼 참고값, iROAS는 아래 실험 섹션에서 별도로 읽으시오.
                      </div>
                    </div>
                  </Panel>
                </div>
              </>
            )}

            {dailyRoas.length > 0 && (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Panel title="일별 광고비와 잠정/확정 매출">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyRoas} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtShortDate} />
                        <YAxis yAxisId="krw" tickFormatter={(value) => `₩${(Number(value) / 10000).toFixed(0)}만`} width={70} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value) => fmtKRW(Number(value))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="krw" dataKey="spend" name="광고비" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.75} />
                        <Bar yAxisId="krw" dataKey="confirmedRevenue" name="Attr confirmed" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
                        <Bar yAxisId="krw" dataKey="potentialRevenue" name="Attr confirmed+pending" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>

                  <Panel title="일별 ROAS 비교">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyRoas}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtShortDate} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} width={58} />
                        <Tooltip formatter={formatRoasTooltip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="confirmedRoas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed" />
                        <Line type="monotone" dataKey="potentialRoas" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed+pending" />
                        <Line type="monotone" dataKey="metaPurchaseRoas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Meta purchase" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Panel>
                </section>

                <Panel title="일자별 비교표">
                  <div style={{ marginBottom: 12, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.65 }}>
                    같은 날짜축에서 <strong>Meta purchase</strong>, <strong>Attribution confirmed</strong>, <strong>Attribution confirmed+pending</strong>를 같이 보시오.
                    이렇게 보면 Meta가 넓게 잡는 구간과, pending 때문에 내부값이 눌리는 구간을 분리해서 읽을 수 있소.
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          {["날짜", "광고비", "Meta value", "Attr confirmed", "Attr pending", "Attr potential", "Meta ROAS", "Attr ROAS", "Potential ROAS"].map((header) => (
                            <th key={header} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRoas.map((row) => (
                          <tr key={row.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#1e293b" }}>{row.date}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#6366f1", fontWeight: 600 }}>{fmtKRW(row.spend)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6", fontWeight: 600 }}>{fmtKRW(row.metaPurchaseValue)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmtKRW(row.confirmedRevenue)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{fmtKRW(row.pendingRevenue)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f766e", fontWeight: 600 }}>{fmtKRW(row.potentialRevenue)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6" }}>{fmtRoasX(row.metaPurchaseRoas)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a" }}>{fmtRoasX(row.confirmedRoas)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706" }}>{fmtRoasX(row.potentialRoas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}

            <IroasSection />

            <div style={{ padding: "16px 18px", borderRadius: 14, borderLeft: "4px solid #6366f1", background: "rgba(99,102,241,0.04)", color: "#475569", lineHeight: 1.75, fontSize: "0.84rem" }}>
              <strong>Attribution ROAS와 iROAS는 같은 개념이 아니오</strong>
              <p style={{ marginTop: 8 }}>
                <strong>Attribution ROAS</strong>는 이미 발생한 주문을 광고에 관측적으로 귀속해서 본 값이오. 즉 "이 주문이 어떤 광고에서 왔다고 보이는가"를 기준으로 하오.
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>iROAS</strong>는 실험군과 대조군을 비교해서, 광고가 없었다면 생기지 않았을 <strong>증분 매출</strong>만 남긴 값이오. 따라서 광고가 원래 살 사람을 데려온 것인지, 진짜 새 매출을 만든 것인지를 가르는 데 쓰오.
              </p>
              <p style={{ marginTop: 8 }}>
                같은 광고라도 Attribution ROAS는 높고 iROAS는 낮을 수 있소. 그런 경우는 매출이 광고에 귀속되긴 했지만, 실제 증분 효과는 약하다는 뜻이오. {ROAS_LAG_NOTE}
              </p>
            </div>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <ConceptCard
                title="ROAS"
                accent="#8b5cf6"
                summary="플랫폼이 보고하는 광고비 대비 매출"
                numerator="보통 Meta의 purchase value 같은 플랫폼 귀속 가치"
                meaning="Ads Manager에서 빨리 보는 참고 지표로는 좋지만, 내부 확정매출과 같은 뜻은 아니오."
              />
              <ConceptCard
                title="Attribution ROAS"
                accent="#16a34a"
                summary="우리 attribution ledger 기준 광고비 대비 매출"
                numerator="Meta로 귀속됐고 payment_status=confirmed까지 된 내부 매출"
                meaning="운영 메인값은 이 값을 쓰오. pending을 더한 값은 잠정 보조지표요."
              />
              <ConceptCard
                title="iROAS"
                accent="#0f766e"
                summary="증분 매출 기준 광고비 대비 효과"
                numerator="실험군과 대조군 비교로 남긴 incremental revenue"
                meaning="광고가 진짜 새 매출을 만들었는지 보는 지표요. Attribution ROAS와 같은 값이 아니오."
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warn" }) {
  return (
    <div style={{
      padding: "16px 18px",
      borderRadius: 14,
      border: "1px solid rgba(148,163,184,0.18)",
      background: tone === "success"
        ? "linear-gradient(180deg, #f0fdf4, #fff)"
        : tone === "warn"
          ? "linear-gradient(180deg, #fffbeb, #fff)"
          : "linear-gradient(180deg, #fff, #f8fafc)",
    }}>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      padding: 22,
      borderRadius: 16,
      background: "rgba(255,255,255,0.94)",
      border: "1px solid rgba(148,163,184,0.18)",
      boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    }}>
      <h2 style={{ fontSize: "1.02rem", fontWeight: 700, marginBottom: 18 }}>{title}</h2>
      {children}
    </section>
  );
}

function ConceptCard({
  title,
  accent,
  summary,
  numerator,
  meaning,
}: {
  title: string;
  accent: string;
  summary: string;
  numerator: string;
  meaning: string;
}) {
  return (
    <div style={{
      padding: "18px 20px",
      borderRadius: 16,
      background: "#fff",
      border: `1px solid ${accent}33`,
      boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.96rem", fontWeight: 700, color: "#0f172a", marginTop: 8 }}>
        {summary}
      </div>
      <div style={{ marginTop: 12, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.7 }}>
        <strong style={{ color: "#0f172a" }}>분자</strong>: {numerator}
      </div>
      <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.7 }}>
        <strong style={{ color: "#0f172a" }}>해석</strong>: {meaning}
      </div>
    </div>
  );
}

function IroasSection() {
  const [experiments, setExperiments] = useState<IroasExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}/api/ads/iroas/experiments`, { signal: abortController.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.ok) setExperiments(data.experiments ?? []);
      })
      .catch((errorValue) => {
        if (!abortController.signal.aborted) {
          setError(errorValue instanceof Error ? errorValue.message : "iROAS 데이터를 불러올 수 없음");
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });
    return () => abortController.abort();
  }, []);

  const totalIncremental = experiments.reduce((sum, experiment) => sum + experiment.incremental_revenue, 0);
  const totalAdSpend = experiments.reduce((sum, experiment) => sum + experiment.ad_spend, 0);
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase" }}>실험</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>실험군 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>대조군 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>증분 매출</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>광고비</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>ROAS</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>iROAS</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((experiment) => {
                  const roas = experiment.ad_spend > 0 ? experiment.treatment_revenue / experiment.ad_spend : null;
                  return (
                    <tr key={experiment.experiment_key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{experiment.name}</strong>
                        <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
                          {experiment.experiment_key} · {experiment.channel} · {experiment.status}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>
                          실험군 {fmtNum(experiment.treatment_count)}명 ({fmtPct(experiment.treatment_purchase_rate * 100)} 구매) · 대조군 {fmtNum(experiment.control_count)}명 ({fmtPct(experiment.control_purchase_rate * 100)} 구매)
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(experiment.treatment_revenue)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(experiment.control_revenue)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: experiment.incremental_revenue > 0 ? "#16a34a" : experiment.incremental_revenue < 0 ? "#dc2626" : "#94a3b8" }}>
                        {experiment.incremental_revenue >= 0 ? "+" : ""}{fmtKRW(experiment.incremental_revenue)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtKRW(experiment.ad_spend)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#94a3b8" }}>
                        {roas != null ? `${roas.toFixed(2)}x` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: experiment.iroas != null && experiment.iroas >= 1 ? "#16a34a" : experiment.iroas != null ? "#dc2626" : "#94a3b8" }}>
                        {experiment.iroas != null ? `${experiment.iroas.toFixed(2)}x` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {experiments.some((experiment) => experiment.iroas != null) && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 12 }}>ROAS vs iROAS 비교</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={experiments.map((experiment) => ({
                    name: experiment.name.length > 12 ? `${experiment.name.slice(0, 12)}…` : experiment.name,
                    ROAS: experiment.ad_spend > 0 ? Number((experiment.treatment_revenue / experiment.ad_spend).toFixed(2)) : 0,
                    iROAS: experiment.iroas ?? 0,
                  }))}
                  margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(value) => `${Number(value).toFixed(1)}x`} width={50} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}x`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ROAS" name="ROAS (귀속 매출)" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
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
