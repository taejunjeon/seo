"use client";

import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const STORAGE_PREFIX = "seo:tiktok-off-impact-audit:v3:";

type Metric = {
  days: number;
  orders: number;
  revenue: number;
  ordersPerDay: number;
  revenuePerDay: number;
};

type ChannelRow = {
  channel: string;
  label: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  baseline: Metric;
  off: Metric;
  deltaOrdersPerDay: number;
  deltaRevenuePerDay: number;
  deltaRevenuePct: number | null;
  shareOfObservedDropPct: number | null;
};

type AuditItem = {
  item: string;
  answer: string;
  score: number;
  evidence: string;
  whatItMeans: string;
};

type TikTokEvidence = {
  marketingIntentRows: number;
  marketingIntentClients: number;
  checkoutRows: number;
  checkoutOrders: number;
  strictConfirmedOrders: number;
  strictConfirmedRevenue: number;
  firstTouchConfirmedOrders: number;
  firstTouchConfirmedRevenue: number;
};

type CoopRange = {
  days: number;
  rows: number;
  groupBuys: number;
  grossAmount: number;
  grossAmountPerDay: number;
  includedRows: number;
  includedAmount: number;
  includedAmountPerDay: number;
  excludedRows: number;
  excludedAmount: number;
  topGroups: Array<{
    groupBuyId: number;
    title: string;
    rows: number;
    amount: number;
    amountPerDay: number;
  }>;
};

type TikTokOffImpactResponse = {
  ok: boolean;
  error?: string;
  checked_at: string;
  lane: string;
  ranges: {
    baseline: { startDate: string; endDate: string; label: string; days: number };
    off: { startDate: string; endDate: string; label: string; days: number };
  };
  source: {
    primary: string;
    ga4_cross_check: string;
    tiktok_ads: string;
    coop_adjustment?: string;
    notes: string[];
  };
  warnings: string[];
  overall: {
    baseline: Metric;
    off: Metric;
    deltaOrdersPerDay: number;
    deltaRevenuePerDay: number;
    deltaRevenuePct: number | null;
  };
  tiktok_spend_and_claim: {
    baseline: { spend: number; platformPurchases: number; platformPurchaseValue: number; platformRoas: number | null };
    off: { spend: number; platformPurchases: number; platformPurchaseValue: number; platformRoas: number | null };
  };
  tiktok_internal_evidence: {
    baseline: TikTokEvidence;
    off: TikTokEvidence;
  };
  coop_adjustment?: {
    status: "included" | "unavailable";
    source: string;
    sourceLocation: "operational_db";
    baseline: CoopRange;
    off: CoopRange;
    deltaRows: number;
    deltaIncludedAmountPerDay: number;
    deltaIncludedAmountPct: number | null;
    shareOfObservedDropPct: number | null;
    nonCoopDeltaRevenuePerDay: number | null;
    warnings: string[];
  };
  channel_shift: {
    source: string;
    observedRevenueDropPerDay: number;
    topDropChannels: ChannelRow[];
    rows: ChannelRow[];
  };
  ga4_channel_cross_check: {
    source: string;
    error?: string | null;
    rows: ChannelRow[];
  };
  mistracking_audit: {
    missingTrackingProbabilityScore: number;
    platformOverCreditProbabilityScore: number;
    recommendation: string;
    items: AuditItem[];
  };
  invariants: {
    no_send: boolean;
    no_write: boolean;
    no_deploy: boolean;
    no_publish: boolean;
    raw_identifier_suppressed: boolean;
  };
  cache?: {
    hit: boolean;
    key: string;
    generated_at: string;
    stale_due_to_error?: boolean;
    refresh_error?: string;
  };
};

type StoredAudit = {
  savedAt: string;
  payload: TikTokOffImpactResponse;
};

const fmtNum = (value: number | null | undefined) => Math.round(value ?? 0).toLocaleString("ko-KR");
const fmtKrw = (value: number | null | undefined) => `${fmtNum(value)}원`;
const fmtKrwSigned = (value: number | null | undefined) => {
  const safe = Math.round(value ?? 0);
  const prefix = safe > 0 ? "+" : safe < 0 ? "-" : "";
  return `${prefix}${Math.abs(safe).toLocaleString("ko-KR")}원`;
};
const fmtPct = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "확인 불가";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
};
const fmtDate = (value: string | null | undefined) => (value ? value.slice(0, 10) : "-");

const confidenceLabel: Record<ChannelRow["confidence"], string> = {
  high: "근거 높음",
  medium: "보조 근거",
  low: "분류 주의",
};

const buildStorageKey = (baselineStart: string, baselineEnd: string, offStart: string, offEnd: string) =>
  `${STORAGE_PREFIX}${baselineStart}_${baselineEnd}__${offStart}_${offEnd}`;

const readStoredAudit = (key: string): StoredAudit | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAudit;
    return parsed?.payload?.ok ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredAudit = (key: string, payload: TikTokOffImpactResponse) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), payload }));
  } catch {
    // localStorage quota or private mode should not block the dashboard.
  }
};

const formatSavedAt = (value: string | null | undefined) => {
  if (!value) return "저장 시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

function Card({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "green" | "amber" | "red" | "blue";
}) {
  const palette = {
    plain: { border: "#e2e8f0", bg: "#ffffff" },
    green: { border: "#bbf7d0", bg: "#f0fdf4" },
    amber: { border: "#fde68a", bg: "#fffbeb" },
    red: { border: "#fecaca", bg: "#fef2f2" },
    blue: { border: "#bfdbfe", bg: "#eff6ff" },
  }[tone];

  return (
    <section
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        borderRadius: 8,
        padding: 18,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "plain" | "green" | "amber" | "red" | "blue";
}) {
  return (
    <Card tone={tone}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: 28, lineHeight: 1.1, color: "#0f172a", fontWeight: 950 }}>{value}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#475569" }}>{sub}</div>
      </div>
    </Card>
  );
}

function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "green" | "amber" | "red" | "blue" }) {
  const palette = {
    plain: { border: "#cbd5e1", bg: "#f8fafc", text: "#334155" },
    green: { border: "#86efac", bg: "#dcfce7", text: "#166534" },
    amber: { border: "#fcd34d", bg: "#fef3c7", text: "#92400e" },
    red: { border: "#fca5a5", bg: "#fee2e2", text: "#991b1b" },
    blue: { border: "#93c5fd", bg: "#dbeafe", text: "#1d4ed8" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.text,
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ChannelShiftRow({ row, maxAbsDelta }: { row: ChannelRow; maxAbsDelta: number }) {
  const isDrop = row.deltaRevenuePerDay < 0;
  const barWidth = `${Math.max(4, Math.min(100, (Math.abs(row.deltaRevenuePerDay) / Math.max(1, maxAbsDelta)) * 100))}%`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        alignItems: "center",
        borderTop: "1px solid #e2e8f0",
        padding: "14px 0",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ color: "#0f172a" }}>{row.label}</strong>
          <Pill tone={row.confidence === "high" ? "green" : row.confidence === "medium" ? "blue" : "amber"}>
            {confidenceLabel[row.confidence]}
          </Pill>
        </div>
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.45 }}>{row.explanation}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#475569", fontSize: 13 }}>
          <span>OFF 전 {fmtKrw(row.baseline.revenuePerDay)} / 일</span>
          <span>OFF 후 {fmtKrw(row.off.revenuePerDay)} / 일</span>
        </div>
        <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              width: barWidth,
              height: "100%",
              background: isDrop ? "#ef4444" : "#10b981",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div style={{ fontWeight: 950, color: isDrop ? "#b91c1c" : "#047857", fontSize: 18 }}>
          {fmtKrwSigned(row.deltaRevenuePerDay)} / 일
        </div>
        <div style={{ marginTop: 5, color: "#64748b", fontSize: 12 }}>
          변화율 {fmtPct(row.deltaRevenuePct)}
          {row.shareOfObservedDropPct != null ? ` · 하락 설명 ${row.shareOfObservedDropPct.toFixed(1)}%` : ""}
        </div>
      </div>
    </div>
  );
}

function AuditCard({ item }: { item: AuditItem }) {
  const tone = item.score >= 60 ? "red" : item.score >= 35 ? "amber" : "green";
  const color = tone === "red" ? "#dc2626" : tone === "amber" ? "#d97706" : "#059669";

  return (
    <Card tone={tone}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <strong style={{ color: "#0f172a" }}>{item.item}</strong>
          <Pill tone={tone}>{item.answer}</Pill>
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 12, fontWeight: 800 }}>
            <span>미추적 가능성 점수</span>
            <span>{item.score}/100</span>
          </div>
          <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, Math.min(100, item.score))}%`, height: "100%", background: color }} />
          </div>
        </div>
        <p style={{ margin: 0, color: "#334155", lineHeight: 1.55, fontSize: 13 }}>{item.evidence}</p>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55, fontSize: 13 }}>{item.whatItMeans}</p>
      </div>
    </Card>
  );
}

export default function TikTokOffImpactPage() {
  const [baselineStart, setBaselineStart] = useState("2026-05-01");
  const [baselineEnd, setBaselineEnd] = useState("2026-05-07");
  const [offStart, setOffStart] = useState("2026-05-08");
  const [offEnd, setOffEnd] = useState("2026-05-12");
  const [data, setData] = useState<TikTokOffImpactResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [forceRefreshKey, setForceRefreshKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const storageKey = useMemo(
    () => buildStorageKey(baselineStart, baselineEnd, offStart, offEnd),
    [baselineStart, baselineEnd, offStart, offEnd],
  );

  useEffect(() => {
    const forceRefresh = forceRefreshKey === storageKey;
    const stored = !forceRefresh ? readStoredAudit(storageKey) : null;
    if (stored) {
      setData(stored.payload);
      setLoading(false);
      setLoadingProgress(100);
      setError(null);
      setCacheStatus(`브라우저 저장본 ${formatSavedAt(stored.savedAt)}`);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      baseline_start: baselineStart,
      baseline_end: baselineEnd,
      off_start: offStart,
      off_end: offEnd,
    });
    if (forceRefresh) {
      params.set("refresh", "1");
    }

    setLoading(true);
    setLoadingProgress(8);
    setError(null);
    setCacheStatus(forceRefresh ? "새로 계산 중" : null);

    const progressTimer = window.setInterval(() => {
      setLoadingProgress((value) => {
        if (value < 35) return value + 7;
        if (value < 70) return value + 4;
        if (value < 92) return value + 2;
        return value;
      });
    }, 900);

    fetch(`${API_BASE}/api/ads/tiktok/off-impact-audit?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as TikTokOffImpactResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? `API ${response.status}`);
        }
        writeStoredAudit(storageKey, payload);
        setData(payload);
        setLoadingProgress(100);
        setCacheStatus(
          payload.cache?.hit
            ? `서버 저장본 ${formatSavedAt(payload.cache.generated_at)}`
            : `계산 완료·저장 ${formatSavedAt(new Date().toISOString())}`,
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        const fallback = readStoredAudit(storageKey);
        if (fallback) {
          setData(fallback.payload);
          setCacheStatus(`새 계산 실패·저장본 표시 ${formatSavedAt(fallback.savedAt)}`);
          setError(`새 계산은 실패했습니다. 저장본을 표시합니다. 원인: ${err instanceof Error ? err.message : "unknown"}`);
        } else {
          setError(err instanceof Error ? err.message : "TikTok OFF 감사 데이터를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        window.clearInterval(progressTimer);
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      window.clearInterval(progressTimer);
      controller.abort();
    };
  }, [baselineStart, baselineEnd, offStart, offEnd, forceRefreshKey, refreshKey, storageKey]);

  const sortedChannels = useMemo(() => {
    const rows = data?.channel_shift.rows ?? [];
    return [...rows].sort((a, b) => a.deltaRevenuePerDay - b.deltaRevenuePerDay);
  }, [data]);

  const maxAbsDelta = useMemo(
    () => Math.max(1, ...sortedChannels.map((row) => Math.abs(row.deltaRevenuePerDay))),
    [sortedChannels],
  );

  const topDrop = data?.channel_shift.topDropChannels[0] ?? sortedChannels[0] ?? null;
  const missingScore = data?.mistracking_audit.missingTrackingProbabilityScore ?? 0;
  const overCreditScore = data?.mistracking_audit.platformOverCreditProbabilityScore ?? 0;
  const strictTikTokRevenue = data?.tiktok_internal_evidence.baseline.strictConfirmedRevenue ?? 0;
  const assistedTikTokRevenue = data?.tiktok_internal_evidence.baseline.firstTouchConfirmedRevenue ?? 0;
  const topDropLabel = topDrop?.label ?? "특정 채널";
  const coopAdjustment = data?.coop_adjustment;
  const coopDropShare = coopAdjustment?.shareOfObservedDropPct;
  const coopDelta = coopAdjustment?.deltaIncludedAmountPerDay ?? 0;
  const nonCoopDelta = coopAdjustment?.nonCoopDeltaRevenuePerDay;

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "28px 24px 64px",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
          <header style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 840 }}>
                <Link href="/ads/tiktok" style={{ color: "#0f766e", fontSize: 13, fontWeight: 900 }}>
                  TikTok ROAS 진단으로 돌아가기
                </Link>
                <h1 style={{ margin: "8px 0 8px", fontSize: 32, lineHeight: 1.15, fontWeight: 950 }}>
                  TikTok OFF 전후 매출 영향 감사
                </h1>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.65, fontSize: 15 }}>
                  TikTok 광고를 껐을 때 줄어든 매출이 TikTok 때문인지, Google·Meta·오가닉 중 어디에서 줄었는지
                  VM Cloud 보조 원장과 GA4 교차검증으로 나눠 봅니다.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Pill tone="green">Green read-only</Pill>
                <Pill tone="blue">외부 전송 없음</Pill>
                <Pill tone="blue">운영DB 쓰기 없음</Pill>
                {cacheStatus && <Pill tone={error ? "amber" : "plain"}>{cacheStatus}</Pill>}
              </div>
            </div>

            <Card>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setForceRefreshKey(storageKey);
                  setRefreshKey((value) => value + 1);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                {[
                  ["OFF 전 시작", baselineStart, setBaselineStart],
                  ["OFF 전 종료", baselineEnd, setBaselineEnd],
                  ["OFF 후 시작", offStart, setOffStart],
                  ["OFF 후 종료", offEnd, setOffEnd],
                ].map(([label, value, setter]) => (
                  <label key={label as string} style={{ display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 900 }}>
                    {label as string}
                    <input
                      type="date"
                      value={value as string}
                      onChange={(event) => (setter as Dispatch<SetStateAction<string>>)(event.target.value)}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "9px 10px",
                        fontSize: 14,
                        color: "#0f172a",
                        background: "#ffffff",
                      }}
                    />
                  </label>
                ))}
                <button
                  type="submit"
                  style={{
                    minHeight: 40,
                    border: "1px solid #0f766e",
                    borderRadius: 8,
                    background: "#0f766e",
                    color: "#ffffff",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  다시 계산
                </button>
              </form>
            </Card>
          </header>

          {loading && (
            <Card tone="blue">
              <strong>{data ? "새 계산을 진행 중입니다. 기존 결과는 아래에 유지됩니다." : "데이터를 계산하는 중입니다."}</strong>
              <p style={{ margin: "8px 0 0", color: "#475569" }}>
                기간별 VM Cloud 보조 원장과 TikTok Ads 캐시, GA4 교차검증을 read-only로 불러옵니다.
              </p>
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                <div style={{ height: 10, background: "#dbeafe", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${loadingProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #0f766e, #2563eb)",
                      borderRadius: 999,
                      transition: "width 500ms ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: 12, fontWeight: 800 }}>
                  <span>{loadingProgress < 35 ? "원장 조회" : loadingProgress < 70 ? "채널별 집계" : "화면 저장 준비"}</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
              </div>
            </Card>
          )}

          {error && (
            <Card tone="red">
              <strong>감사 데이터를 불러오지 못했습니다.</strong>
              <p style={{ margin: "8px 0 0", color: "#7f1d1d" }}>{error}</p>
            </Card>
          )}

          {data && (
            <>
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
                <KpiCard
                  tone="red"
                  label="전체 일평균 매출 변화"
                  value={fmtKrwSigned(data.overall.deltaRevenuePerDay)}
                  sub={`${fmtDate(data.ranges.baseline.startDate)}~${fmtDate(data.ranges.baseline.endDate)} 대비 ${fmtDate(data.ranges.off.startDate)}~${fmtDate(data.ranges.off.endDate)} · ${fmtPct(data.overall.deltaRevenuePct)}`}
                />
                <KpiCard
                  tone={topDrop?.label === "TikTok 광고" ? "amber" : "blue"}
                  label="하락분이 가장 크게 잡힌 곳"
                  value={topDrop?.label ?? "확인 불가"}
                  sub={topDrop ? `${fmtKrwSigned(topDrop.deltaRevenuePerDay)} / 일 · 관측 하락 설명 ${topDrop.shareOfObservedDropPct?.toFixed(1) ?? "-"}%` : "분류 row 없음"}
                />
                <KpiCard
                  tone={strictTikTokRevenue > 0 ? "amber" : "green"}
                  label="TikTok 직접 결제완료 근거"
                  value={fmtKrw(strictTikTokRevenue)}
                  sub={`보조 후보는 ${fmtKrw(assistedTikTokRevenue)} · TikTok 플랫폼 주장 매출은 ${fmtKrw(data.tiktok_spend_and_claim.baseline.platformPurchaseValue)}`}
                />
                <KpiCard
                  tone={missingScore >= 60 ? "red" : missingScore >= 35 ? "amber" : "green"}
                  label="TikTok 미추적 가능성"
                  value={`${missingScore}/100`}
                  sub={`플랫폼 과대 attribution 가능성 ${overCreditScore}/100 · ${data.mistracking_audit.recommendation}`}
                />
                <KpiCard
                  tone={coopAdjustment?.status === "included" && coopDelta < 0 ? "amber" : "plain"}
                  label="공동구매 감소 영향"
                  value={coopAdjustment?.status === "included" ? `${fmtKrwSigned(coopDelta)} / 일` : "확인 불가"}
                  sub={
                    coopAdjustment?.status === "included"
                      ? `관측 하락 설명 ${coopDropShare?.toFixed(1) ?? "-"}% · 공동구매 제외 후 ${fmtKrwSigned(nonCoopDelta)} / 일`
                      : "운영DB 공동구매 집계를 불러오지 못했습니다."
                  }
                />
              </section>

              <Card tone={missingScore >= 60 ? "amber" : "green"}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill tone={missingScore >= 60 ? "amber" : "green"}>현재 판단</Pill>
                      <Pill tone="plain">조회 {fmtDate(data.checked_at)}</Pill>
                    </div>
                    <h2 style={{ margin: "12px 0 8px", fontSize: 24, lineHeight: 1.25 }}>
                      TikTok을 꺼서 매출은 줄었지만, 현재 원장상 하락분은 TikTok보다 {topDropLabel} 쪽에서 크게 잡힙니다.
                    </h2>
                    <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
                      TikTok 광고비는 OFF 기간에 사실상 0원으로 내려갔고, 같은 기간 전체 결제완료 매출은 일평균
                      {` ${fmtKrw(data.overall.baseline.revenuePerDay)}에서 ${fmtKrw(data.overall.off.revenuePerDay)}로 `}
                      줄었습니다. 다만 TikTok 직접 결제완료는 0원이고, VM Cloud 유입 근거 분류에서는 {topDropLabel} 라인이
                      관측 하락분의 대부분을 설명합니다.
                      {coopAdjustment?.status === "included"
                        ? ` 같은 기간 운영DB 공동구매 매출도 일평균 ${fmtKrwSigned(coopDelta)} 변해, 공동구매 일정 효과를 함께 봐야 합니다.`
                        : ""}
                    </p>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: "#64748b" }}>TikTok 광고비</span>
                      <strong>{fmtKrw(data.tiktok_spend_and_claim.baseline.spend)} → {fmtKrw(data.tiktok_spend_and_claim.off.spend)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: "#64748b" }}>TikTok 내부 직접 매출</span>
                      <strong>{fmtKrw(data.tiktok_internal_evidence.baseline.strictConfirmedRevenue)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: "#64748b" }}>TikTok first-touch 후보</span>
                      <strong>{fmtKrw(data.tiktok_internal_evidence.baseline.firstTouchConfirmedRevenue)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: "#64748b" }}>TikTok 유입 row</span>
                      <strong>
                        {fmtNum(data.tiktok_internal_evidence.baseline.marketingIntentRows)} → {fmtNum(data.tiktok_internal_evidence.off.marketingIntentRows)}
                      </strong>
                    </div>
                  </div>
                </div>
              </Card>

              {coopAdjustment && (
                <Card tone={coopAdjustment.status === "included" && coopDelta < 0 ? "amber" : "plain"}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 22 }}>공동구매 보정 라인</h2>
                        <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.55 }}>
                          광고 채널 매출과 섞지 않고, 운영DB 공동구매 테이블을 별도 라인으로 비교합니다.
                        </p>
                      </div>
                      <Pill tone={coopAdjustment.status === "included" ? "amber" : "red"}>
                        source: 운영DB 공동구매
                      </Pill>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <Card tone="plain">
                        <strong>OFF 전 공동구매</strong>
                        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>
                          {fmtNum(coopAdjustment.baseline.includedRows)}건 · {fmtKrw(coopAdjustment.baseline.includedAmount)}
                          <br />
                          일평균 {fmtKrw(coopAdjustment.baseline.includedAmountPerDay)}
                        </p>
                      </Card>
                      <Card tone="plain">
                        <strong>OFF 후 공동구매</strong>
                        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>
                          {fmtNum(coopAdjustment.off.includedRows)}건 · {fmtKrw(coopAdjustment.off.includedAmount)}
                          <br />
                          일평균 {fmtKrw(coopAdjustment.off.includedAmountPerDay)}
                        </p>
                      </Card>
                      <Card tone={coopDelta < 0 ? "amber" : "green"}>
                        <strong>공동구매 제외 후 변화</strong>
                        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>
                          공동구매 변화 {fmtKrwSigned(coopDelta)} / 일
                          <br />
                          제외 후 남는 변화 {fmtKrwSigned(nonCoopDelta)} / 일
                        </p>
                      </Card>
                    </div>
                    {coopAdjustment.baseline.topGroups.length + coopAdjustment.off.topGroups.length > 0 && (
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>공동구매 상세 보기</summary>
                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                          {[
                            ["OFF 전", coopAdjustment.baseline.topGroups],
                            ["OFF 후", coopAdjustment.off.topGroups],
                          ].map(([label, groups]) => (
                            <div key={label as string} style={{ display: "grid", gap: 8 }}>
                              <strong>{label as string}</strong>
                              {(groups as CoopRange["topGroups"]).map((group) => (
                                <div key={`${label}-${group.groupBuyId}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "#475569" }}>
                                  <span>{group.title}</span>
                                  <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>{fmtKrw(group.amount)}</strong>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </Card>
              )}

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>광고 OFF 전후 채널별 매출 변화</h2>
                    <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.55 }}>
                      일평균 결제완료 매출 기준입니다. 기간 길이가 달라 총액이 아니라 하루 평균으로 비교합니다.
                    </p>
                  </div>
                  <Pill tone="blue">source: VM Cloud 보조 원장</Pill>
                </div>
                <div style={{ marginTop: 14 }}>
                  {sortedChannels.map((row) => (
                    <ChannelShiftRow key={row.channel} row={row} maxAbsDelta={maxAbsDelta} />
                  ))}
                </div>
              </Card>

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>TikTok 미추적 가능성 감사표</h2>
                    <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.55 }}>
                      “효과가 있었는데 우리가 못 잡은 것인지”를 5개 질문으로 나눠 점수화했습니다.
                    </p>
                  </div>
                  <Pill tone={missingScore >= 60 ? "amber" : "green"}>종합 {missingScore}/100</Pill>
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                  {data.mistracking_audit.items.map((item) => (
                    <AuditCard key={item.item} item={item} />
                  ))}
                </div>
              </Card>

              <Card>
                <h2 style={{ margin: 0, fontSize: 22 }}>GA4와 원천 설명</h2>
                <p style={{ margin: "8px 0 12px", color: "#64748b", lineHeight: 1.55 }}>
                  GA4는 보조 교차검증입니다. 예산 판단의 1차 기준은 VM Cloud 보조 원장 결제완료 row와 광고비 비교입니다.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <Card tone="blue">
                    <strong>1차 매출 분류</strong>
                    <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>{data.source.primary}</p>
                  </Card>
                  <Card tone={data.ga4_channel_cross_check.error ? "amber" : "plain"}>
                    <strong>GA4 교차검증</strong>
                    <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>
                      {data.ga4_channel_cross_check.error ?? data.source.ga4_cross_check}
                    </p>
                  </Card>
                  <Card tone="plain">
                    <strong>안전장치</strong>
                    <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.55 }}>
                      전송 {data.invariants.no_send ? "0" : "확인 필요"} · 쓰기 {data.invariants.no_write ? "0" : "확인 필요"} · 배포{" "}
                      {data.invariants.no_deploy ? "0" : "확인 필요"} · 식별자 숨김 {data.invariants.raw_identifier_suppressed ? "적용" : "확인 필요"}
                    </p>
                  </Card>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </>
  );
}
