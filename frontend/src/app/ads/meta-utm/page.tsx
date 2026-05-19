"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const SITES = [
  { site: "biocom", label: "바이오컴", account_id: "act_3138805896402376" },
  { site: "aibio", label: "AIBIO 리커버리랩", account_id: "act_377604674894011" },
  { site: "thecleancoffee", label: "더클린커피", account_id: "act_654671961007474" },
] as const;

const DATE_PRESETS = [
  { value: "last_3d", label: "최근 3일" },
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
] as const;

const PERIOD_SUMMARY_PRESETS = [
  { value: "last_3d", label: "최근 3일" },
  { value: "last_7d", label: "최근 7일" },
  { value: "last_30d", label: "최근 30일" },
] as const;

type MetaUtmLevel = "campaign" | "adset" | "ad";
type MetaUtmSection = "ready" | "blocked" | "unmapped";
type PeriodPreset = (typeof PERIOD_SUMMARY_PRESETS)[number]["value"];

type MetaUtmMatch = {
  rate: number;
  threshold: number;
  level: "confirmed" | "probable" | "review" | "unmapped";
  label: string;
  matchedOrders: number;
  matchedRevenue: number;
  unmappedOrders: number;
  unmappedRevenue: number;
  basis: string[];
};

type MetaUtmRow = {
  rowKey: string;
  level: MetaUtmLevel;
  section: MetaUtmSection;
  name: string;
  campaignId: string;
  campaignName: string;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  thumbnailUrl: string | null;
  status: string;
  effectiveStatus: string;
  deliveryLabel: string;
  deliveryRaw: string;
  budget: {
    amount: number | null;
    label: string;
    source: "campaign" | "adset" | "none";
  };
  metrics: {
    impressions: number;
    reach: number;
    clicks: number;
    spend: number;
    cpm: number;
    cpc: number;
    purchases: number;
    purchaseValue: number;
    costPerPurchase: number | null;
  };
  att: {
    roas: number | null;
    revenue: number;
    orders: number;
    scope: "campaign" | "exact_adset" | "exact_ad" | "none";
    calculable: boolean;
  };
  evidence: {
    hasMetaSource?: boolean;
    hasPaidMedium?: boolean;
    hasCampaignId?: boolean;
    hasAdsetId?: boolean;
    hasAdId?: boolean;
    hasLandingUrl?: boolean;
    readyAdCount: number;
    blockedAdCount: number;
    totalAdCount: number;
    reasons: string[];
    sampleTags: string | null;
    sampleUrl: string | null;
  };
  match?: MetaUtmMatch;
};

type MetaUtmUnmappedOrderSample = {
  approvedDate: string | null;
  amount: number;
  utmSource: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  landingPath: string | null;
  reason: string;
};

type MetaUtmDiagnostics = {
  ok: boolean;
  account_id: string;
  date_preset: string | null;
  generated_at: string;
  source_confidence?: string;
  source_confidence_reason?: string;
  source_max_timestamp?: string | null;
  date_range?: { start_date: string; end_date: string; timezone: string } | null;
  sections: {
    ready: MetaUtmRow[];
    blocked: MetaUtmRow[];
    unmapped?: MetaUtmRow[];
  };
  rows: MetaUtmRow[];
  unmapped?: {
    orders: number;
    revenue: number;
    samples: MetaUtmUnmappedOrderSample[];
  };
  summary: {
    total?: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    ready: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    blocked: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    unmapped?: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    byLevel: Record<MetaUtmLevel, { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number }>;
    rawCounts: { campaigns: number; adsets: number; ads: number; campaignInsights: number; adsetInsights: number; adInsights: number };
  };
  diagnostics?: {
    limitations?: string[];
  };
  cache?: {
    source: string;
    cached: boolean;
    cached_at_kst: string | null;
    next_refresh_at_kst: string | null;
    stale?: boolean;
    stale_reason?: string;
  };
  error?: string;
  degraded?: boolean;
};

type PeriodRoasSummary = {
  queried_at?: string;
  date_range?: { start_date: string; end_date: string; timezone: string } | null;
  summary?: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    metaPurchaseValue?: number;
    metaPurchaseRoas?: number | null;
    meta?: {
      spend: number;
      purchaseValue: number;
      roas: number | null;
    };
    att?: {
      spend: number;
      purchaseValue: number;
      roas: number | null;
      orders: number;
    };
  };
};

type PeriodRoasSummaryResponse = {
  ok: boolean;
  results?: Partial<Record<PeriodPreset, PeriodRoasSummary>>;
  errors?: Record<string, { error?: string; response_message?: string }>;
  cache?: {
    source: string;
    cached?: boolean;
    cached_at_kst?: string | null;
    next_refresh_at_kst?: string | null;
    stale?: boolean;
  };
};

const LEVEL_LABEL: Record<MetaUtmLevel, string> = {
  campaign: "캠페인",
  adset: "광고 세트",
  ad: "광고",
};

const fmtNum = (value: number) => Math.round(value).toLocaleString("ko-KR");
const fmtKRW = (value: number | null | undefined) => (
  value == null ? "—" : `₩${Math.round(value).toLocaleString("ko-KR")}`
);
const fmtRoas = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(2)}x`);
const fmtRatio = (value: number) => `${value.toFixed(0)}%`;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "미확인";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const describeMetaUtmError = (message: string) => {
  const lower = message.toLowerCase();
  if (
    lower.includes("too many calls")
    || lower.includes("rate-limiting")
    || lower.includes("user request limit")
  ) {
    return {
      title: "Meta API 호출 제한으로 새 데이터를 기다리는 중입니다",
      message: "캠페인 데이터가 없다는 뜻은 아닙니다. Meta가 이 광고 계정의 API 호출을 잠시 제한해 새 결과를 못 가져온 상태입니다.",
      action: "사전계산이 한 번 성공하면 이 화면은 캐시된 결과로 바로 표시됩니다. 지금은 10~20분 뒤 새로고침하거나, 호출량이 줄어든 뒤 다시 확인하면 됩니다.",
      technical: message,
    };
  }
  return {
    title: "Meta UTM 진단 조회 실패",
    message: "새 결과를 가져오지 못했습니다. 캐시가 없으면 표가 비어 보일 수 있습니다.",
    action: "잠시 뒤 새로고침하고, 같은 문제가 반복되면 backend 로그와 Meta API 응답을 확인해야 합니다.",
    technical: message,
  };
};

const deliveryTone = (label: string) => {
  if (label.includes("활동") || label.includes("머신러닝")) return { bg: "#ecfdf5", fg: "#047857", dot: "#059669", border: "#bbf7d0" };
  if (label.includes("준비")) return { bg: "#eff6ff", fg: "#1d4ed8", dot: "#3b82f6", border: "#bfdbfe" };
  if (label.includes("오류")) return { bg: "#fef2f2", fg: "#b91c1c", dot: "#dc2626", border: "#fecaca" };
  return { bg: "#f8fafc", fg: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
};

const summarize = (rows: MetaUtmRow[]) => ({
  rows: rows.length,
  spend: rows.reduce((sum, row) => sum + row.metrics.spend, 0),
  purchases: rows.reduce((sum, row) => sum + row.metrics.purchases, 0),
  attRevenue: rows.reduce((sum, row) => sum + row.att.revenue, 0),
  attOrders: rows.reduce((sum, row) => sum + row.att.orders, 0),
});

const MATCH_THRESHOLD = 85;

const estimateLegacyMatchRate = (row: MetaUtmRow) => {
  if (row.match) return row.match.rate;
  if (row.att.orders > 0) return row.level === "campaign" ? 95 : 100;
  if (row.section === "ready") return 95;
  if (row.evidence.readyAdCount > 0) return 75;
  if (row.evidence.totalAdCount > 0) return 45;
  return 0;
};

const getRowMatch = (row: MetaUtmRow): MetaUtmMatch => {
  if (row.match) return row.match;
  const rate = estimateLegacyMatchRate(row);
  return {
    rate,
    threshold: MATCH_THRESHOLD,
    level: rate >= 95 ? "confirmed" : rate >= MATCH_THRESHOLD ? "probable" : rate > 0 ? "review" : "unmapped",
    label: rate >= MATCH_THRESHOLD ? "85% 이상 매칭" : rate > 0 ? "검토 필요" : "미맵핑",
    matchedOrders: row.att.orders,
    matchedRevenue: row.att.revenue,
    unmappedOrders: 0,
    unmappedRevenue: 0,
    basis: row.evidence.reasons.length > 0 ? row.evidence.reasons : ["이전 캐시 응답이라 매칭 근거를 보수적으로 추정"],
  };
};

const getRowSection = (row: MetaUtmRow): MetaUtmSection => {
  const rate = getRowMatch(row).rate;
  if (rate >= MATCH_THRESHOLD) return "ready";
  if (rate > 0) return "blocked";
  return "unmapped";
};

const matchTone = (rate: number) => {
  if (rate >= MATCH_THRESHOLD) return { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0", bar: "#059669" };
  if (rate > 0) return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", bar: "#f97316" };
  return { bg: "#f8fafc", fg: "#64748b", border: "#e2e8f0", bar: "#94a3b8" };
};

function StatusPill({ label }: { label: string }) {
  const tone = deliveryTone(label);
  return (
    <span className="statusPill" style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
      <span className="statusDot" style={{ background: tone.dot }} />
      {label}
    </span>
  );
}

function MatchRateCell({ row }: { row: MetaUtmRow }) {
  const match = getRowMatch(row);
  const tone = matchTone(match.rate);
  return (
    <div className="matchRateCell" title={match.basis.join(" · ")}>
      <span style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
        {match.rate}%
      </span>
      <div className="matchBar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, Math.max(0, match.rate))}%`, background: tone.bar }} />
      </div>
      <small>{match.label}</small>
    </div>
  );
}

function IdStack({ row }: { row: MetaUtmRow }) {
  if (row.level === "ad") {
    return (
      <div className="idStack">
        <span>캠페인 {row.campaignId || "—"}</span>
        <span>광고세트 {row.adsetId || "—"}</span>
        <strong>광고 {row.adId || "—"}</strong>
      </div>
    );
  }
  if (row.level === "adset") {
    return (
      <div className="idStack">
        <span>캠페인 {row.campaignId || "—"}</span>
        <strong>광고세트 {row.adsetId || "—"}</strong>
      </div>
    );
  }
  return <span className="monoValue">{row.campaignId || "—"}</span>;
}

function NameCell({ row }: { row: MetaUtmRow }) {
  const match = getRowMatch(row);
  const section = getRowSection(row);
  const reason = section === "ready"
    ? match.basis[0] ?? `85% 이상 매칭 ${row.evidence.readyAdCount || (row.level === "ad" ? 1 : 0)}개`
    : match.basis.slice(0, 2).join(" · ");
  return (
    <div className={`nameCell ${row.level === "ad" ? "withThumb" : ""}`}>
      {row.level === "ad" && (
        <div className="thumbBox">
          {row.thumbnailUrl ? (
            <img src={row.thumbnailUrl} alt={row.name} />
          ) : (
            <span>no image</span>
          )}
        </div>
      )}
      <div className="nameText">
        <strong>{row.name}</strong>
        <span>
          {row.level === "campaign" ? "캠페인 단위" : row.level === "adset" ? row.campaignName : `${row.campaignName} / ${row.adsetName ?? "광고세트 미확인"}`}
        </span>
        <small title={row.evidence.sampleTags ?? row.evidence.sampleUrl ?? reason}>
          {reason || "UTM evidence 미확인"}
        </small>
      </div>
    </div>
  );
}

function MetricTable({ rows, section, level }: { rows: MetaUtmRow[]; section: MetaUtmSection; level: MetaUtmLevel }) {
  const emptyText = section === "ready"
    ? `${LEVEL_LABEL[level]} 중 매칭율 85% 이상 항목이 없습니다.`
    : section === "blocked"
      ? `${LEVEL_LABEL[level]} 중 1~84% 검토 항목이 없습니다.`
      : `${LEVEL_LABEL[level]} 중 미맵핑 항목이 없습니다.`;

  if (rows.length === 0) {
    return <div className="emptyState">{emptyText}</div>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th className="nameCol">{LEVEL_LABEL[level]}</th>
            <th>게재</th>
            <th>매칭율%</th>
            <th>캠페인 ID</th>
            <th>예산</th>
            <th>ROAS(att)</th>
            <th>지출금액</th>
            <th>구매(수)</th>
            <th>구매 전환 금액</th>
            <th>도달</th>
            <th>CPM</th>
            <th>CPC(전체)</th>
            <th>구매당 비용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowKey}>
              <td className="nameCol"><NameCell row={row} /></td>
              <td><StatusPill label={row.deliveryLabel} /></td>
              <td><MatchRateCell row={row} /></td>
              <td><IdStack row={row} /></td>
              <td>
                <div className="metricMain">{fmtKRW(row.budget.amount)}</div>
                <div className="metricSub">{row.budget.label}</div>
              </td>
              <td>
                <div className={row.att.calculable ? "roasOk" : "roasBlocked"}>{fmtRoas(row.att.roas)}</div>
                <div className="metricSub">{row.att.calculable ? `${fmtKRW(row.att.revenue)} · ${fmtNum(row.att.orders)}건` : getRowSection(row) === "unmapped" ? "미맵핑" : "검토 필요"}</div>
              </td>
              <td><div className="metricMain">{fmtKRW(row.metrics.spend)}</div></td>
              <td>
                <div className="metricMain">{fmtNum(row.metrics.purchases)}</div>
                <div className="metricSub">Meta 구매</div>
              </td>
              <td>
                <div className="metricMain">{fmtKRW(row.att.revenue)}</div>
                <div className="metricSub">{row.att.orders > 0 ? `내부 원장 ${fmtNum(row.att.orders)}건` : getRowSection(row) === "unmapped" ? "미맵핑" : "내부 매출 없음"}</div>
              </td>
              <td><div className="metricMain">{fmtNum(row.metrics.reach)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.cpm)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.cpc)}</div></td>
              <td><div className="metricMain">{fmtKRW(row.metrics.costPerPurchase)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionPanel({
  title,
  tone,
  rows,
  level,
  levelSpend,
}: {
  title: string;
  tone: MetaUtmSection;
  rows: MetaUtmRow[];
  level: MetaUtmLevel;
  levelSpend: number;
}) {
  const stats = summarize(rows);
  const spendShare = levelSpend > 0 ? (stats.spend / levelSpend) * 100 : 0;
  const description = tone === "ready"
    ? "광고 구조와 매출을 85% 이상 확률로 연결할 수 있어 ROAS 산정 후보로 볼 묶음입니다."
    : tone === "blocked"
      ? "일부 evidence는 있지만 85%에는 못 미쳐 보완하거나 샘플 검토가 필요한 묶음입니다."
      : "현재 기준으로 캠페인/광고세트/광고를 특정하기 어려워 별도 확인해야 하는 묶음입니다.";
  return (
    <section className={`sectionPanel ${tone}`}>
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="sectionStats">
          <span>{fmtNum(stats.rows)}행</span>
          <span>{fmtKRW(stats.spend)}</span>
          <span>Meta 구매 {fmtNum(stats.purchases)}</span>
          <span>내부매출 {fmtKRW(stats.attRevenue)}</span>
          <span>{fmtRatio(spendShare)}</span>
        </div>
      </div>
      <MetricTable rows={rows} section={tone} level={level} />
    </section>
  );
}

function UnmappedOrdersPanel({ summary }: { summary?: MetaUtmDiagnostics["unmapped"] }) {
  if (!summary || summary.orders === 0) return null;
  return (
    <section className="unmappedOrdersPanel">
      <div className="sectionHeader">
        <div>
          <h2>미맵핑 주문 묶음</h2>
          <p>Meta 유입 결제완료 evidence는 있지만 현재 alias/ID/landing path 기준으로 단일 캠페인을 확정하지 못한 건입니다.</p>
        </div>
        <div className="sectionStats">
          <span>{fmtNum(summary.orders)}건</span>
          <span>{fmtKRW(summary.revenue)}</span>
          <span>샘플 {fmtNum(summary.samples.length)}개</span>
        </div>
      </div>
      <div className="unmappedList">
        {summary.samples.map((sample, index) => (
          <div key={`${sample.approvedDate ?? "date"}:${index}`} className="unmappedItem">
            <strong>{fmtKRW(sample.amount)}</strong>
            <span>{sample.approvedDate ?? "일자 미확인"}</span>
            <small>campaign {sample.utmCampaign} · term {sample.utmTerm} · content {sample.utmContent}</small>
            <small>source {sample.utmSource} · landing {sample.landingPath ?? "미확인"}</small>
            <em>{sample.reason}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeriodRoasCards({
  data,
  loading,
  error,
}: {
  data: PeriodRoasSummaryResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="periodRoasPanel">
      <div className="periodRoasHead">
        <div>
          <h2>기간별 ROAS 기준 비교</h2>
          <p>집계 기간은 KST 완료일 기준이며 오늘은 제외합니다. Meta 기준은 플랫폼이 내려주는 구매 전환값이고, ATT 기준은 내부 attribution 원장에 매칭된 결제완료 매출입니다. 예산 판단은 ATT 기준을 우선합니다.</p>
        </div>
        <div className="periodRoasStatus">
          <strong>{loading ? "조회 중" : data?.cache?.cached ? "캐시 응답" : "라이브/캐시 응답"}</strong>
          <span>{error ?? (data?.cache?.cached_at_kst ? `계산 시각 ${data.cache.cached_at_kst}` : "3일·7일·30일 통합 조회")}</span>
        </div>
      </div>
      <div className="periodRoasGrid">
        {PERIOD_SUMMARY_PRESETS.map((period) => {
          const result = data?.results?.[period.value];
          const summary = result?.summary;
          const meta = summary?.meta ?? {
            spend: summary?.spend ?? 0,
            purchaseValue: summary?.metaPurchaseValue ?? 0,
            roas: summary?.metaPurchaseRoas ?? null,
          };
          const att = summary?.att ?? {
            spend: summary?.spend ?? 0,
            purchaseValue: summary?.attributedRevenue ?? 0,
            roas: summary?.roas ?? null,
            orders: summary?.orders ?? 0,
          };
          const itemError = data?.errors?.[period.value]?.error ?? data?.errors?.[period.value]?.response_message ?? null;
          return (
            <article key={period.value} className="periodRoasCard">
              <div className="periodRoasCardTitle">
                <strong>{period.label}</strong>
                <span>{result?.date_range ? `완료일 기준 ${result.date_range.start_date}~${result.date_range.end_date}` : itemError ? "조회 실패" : "계산 대기"}</span>
              </div>
              <div className="periodSourceRow meta">
                <span>Meta 기준</span>
                <strong>{fmtRoas(meta.roas)}</strong>
                <small>구매전환값 {fmtKRW(meta.purchaseValue)} · 광고비 {fmtKRW(meta.spend)}</small>
              </div>
              <div className="periodSourceRow att">
                <span>ATT 기준</span>
                <strong>{fmtRoas(att.roas)}</strong>
                <small>내부매출 {fmtKRW(att.purchaseValue)} · 광고비 {fmtKRW(att.spend)} · {fmtNum(att.orders)}건</small>
              </div>
              {itemError && <em>{itemError}</em>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function MetaUtmPage() {
  const [selectedSite, setSelectedSite] = useState<(typeof SITES)[number]>(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [level, setLevel] = useState<MetaUtmLevel>("campaign");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MetaUtmDiagnostics | null>(null);
  const [periodSummary, setPeriodSummary] = useState<PeriodRoasSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);

  const load = useCallback((force = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      account_id: selectedSite.account_id,
      date_preset: datePreset,
    });
    if (force) params.set("force", "1");
    fetch(`${API_BASE}/api/ads/meta-utm-diagnostics?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body as MetaUtmDiagnostics;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Meta UTM 진단 조회 실패"))
      .finally(() => setLoading(false));
  }, [datePreset, selectedSite.account_id]);

  const loadPeriodSummary = useCallback((force = false) => {
    setPeriodLoading(true);
    setPeriodError(null);
    const params = new URLSearchParams({
      account_id: selectedSite.account_id,
      presets: PERIOD_SUMMARY_PRESETS.map((period) => period.value).join(","),
    });
    if (force) params.set("force", "1");
    fetch(`${API_BASE}/api/ads/roas-summary?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body as PeriodRoasSummaryResponse;
      })
      .then(setPeriodSummary)
      .catch((err) => setPeriodError(err instanceof Error ? err.message : "기간별 ROAS 요약 조회 실패"))
      .finally(() => setPeriodLoading(false));
  }, [selectedSite.account_id]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadPeriodSummary(false), 0);
    return () => window.clearTimeout(timer);
  }, [loadPeriodSummary]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((row) => row.level === level)
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [
          row.name,
          row.campaignName,
          row.adsetName ?? "",
          row.adName ?? "",
          row.campaignId,
          row.adsetId ?? "",
          row.adId ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      });
  }, [data?.rows, level, query]);
  const readyRows = rows.filter((row) => getRowSection(row) === "ready");
  const blockedRows = rows.filter((row) => getRowSection(row) === "blocked");
  const unmappedRows = rows.filter((row) => getRowSection(row) === "unmapped");
  const levelSummary = data?.summary.byLevel[level] ?? { rows: 0, spend: 0, purchases: 0, attRevenue: 0, attOrders: 0 };
  const attentionSpend = [...blockedRows, ...unmappedRows].reduce((sum, row) => sum + row.metrics.spend, 0);
  const blockedSpendShare = levelSummary.spend > 0 ? attentionSpend / levelSummary.spend : 0;
  const errorInfo = error ? describeMetaUtmError(error) : null;
  const cacheStatus = error && !data
    ? "조회 제한"
    : data?.cache?.cached
    ? data.cache.stale
      ? "지난 계산값"
      : "사전계산/캐시 응답"
    : loading && data
      ? "갱신 중"
      : "라이브 조회";
  const currentDecision = error && !data
    ? "현재는 Meta API 제한으로 새 결과를 기다리는 중입니다"
    : blockedSpendShare >= 0.9
    ? "현재 예산 판단은 매칭 보완부터 해야 합니다"
    : "85% 이상 매칭 항목과 미맵핑 항목을 나눠 볼 수 있습니다";
  const decisionDetail = error && !data
    ? "실제 광고 데이터가 없다는 뜻은 아니며, 마지막 성공 캐시가 없어 표를 비워 둔 상태입니다"
    : `${LEVEL_LABEL[level]} 기준 검토/미맵핑 지출 ${fmtKRW(attentionSpend)} · 전체 대비 ${fmtRatio(blockedSpendShare * 100)}`;

  return (
    <>
      <GlobalNav />
      <main className="metaUtmPage page">
        <div className="topBar">
          <div>
            <div className="eyebrow">Meta UTM 진단</div>
            <h1>매출을 어느 Meta 광고 구조에 붙일 수 있는지 계층별로 확인합니다</h1>
            <p>
              UTM이 완벽하지 않아도 campaign/adset/ad ID, dynamic macro, 내부 주문 evidence를 합쳐 85% 이상이면 ROAS 산정 후보로 봅니다.
              낮은 확률과 미맵핑은 따로 모아 보완 우선순위를 정합니다.
            </p>
          </div>
          <div className="actions">
            <Link href="/ads" className="secondaryLink">ROAS 대시보드</Link>
            <Link href="/ads/campaign-mapping" className="secondaryLink">캠페인 매핑</Link>
            <button type="button" onClick={() => { load(true); loadPeriodSummary(true); }} disabled={loading || periodLoading}>{loading || periodLoading ? "조회 중" : "새로고침"}</button>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label>사이트</label>
            <select value={selectedSite.site} onChange={(event) => {
              const next = SITES.find((site) => site.site === event.target.value) ?? SITES[0];
              setSelectedSite(next);
            }}>
              {SITES.map((site) => <option key={site.site} value={site.site}>{site.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>기간</label>
            <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
              {DATE_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          </div>
          <div className="searchField">
            <label>검색</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, ID, 지표 검색" />
          </div>
          <div className="metaInfo">
            <span>계정 {selectedSite.account_id}</span>
            <span>기준 {formatDateTime(data?.generated_at)}</span>
            <span>{cacheStatus}</span>
          </div>
        </div>

        <PeriodRoasCards data={periodSummary} loading={periodLoading} error={periodError} />

        <div className={`decisionBanner ${error && !data ? "needsFix" : blockedSpendShare >= 0.9 ? "needsFix" : "balanced"}`}>
          <div>
            <strong>{currentDecision}</strong>
            <span>{decisionDetail}</span>
          </div>
          <div>
            <strong>{cacheStatus}</strong>
            <span>{data?.cache?.cached_at_kst ? `계산 시각 ${data.cache.cached_at_kst}` : "첫 조회는 서버 계산 후 캐시에 저장됩니다"}</span>
          </div>
        </div>

        {errorInfo && (
          <div className="errorBox">
            <strong>{errorInfo.title}</strong>
            <span>{errorInfo.message}</span>
            <small>{errorInfo.action}</small>
            <details>
              <summary>기술 원문 보기</summary>
              <code>{errorInfo.technical}</code>
            </details>
          </div>
        )}

        <div className="summaryGrid">
          <div className="summaryItem">
            <span>현재 보는 계층</span>
            <strong>{LEVEL_LABEL[level]}</strong>
            <small>{fmtNum(levelSummary.rows)}행 · Meta raw {level === "campaign" ? fmtNum(data?.summary.rawCounts.campaignInsights ?? 0) : level === "adset" ? fmtNum(data?.summary.rawCounts.adsetInsights ?? 0) : fmtNum(data?.summary.rawCounts.adInsights ?? 0)}행</small>
          </div>
          <div className="summaryItem">
            <span>해당 계층 지출</span>
            <strong>{fmtKRW(levelSummary.spend)}</strong>
            <small>Meta Ads Insights API 기준</small>
          </div>
          <div className="summaryItem">
            <span>85% 이상 매칭 지출</span>
            <strong>{fmtKRW(readyRows.reduce((sum, row) => sum + row.metrics.spend, 0))}</strong>
            <small>{fmtNum(readyRows.length)}행 · 예산 판단 후보</small>
          </div>
          <div className="summaryItem">
            <span>검토/미맵핑 지출</span>
            <strong>{fmtKRW(attentionSpend)}</strong>
            <small>비중 {fmtRatio(blockedSpendShare * 100)}</small>
          </div>
          <div className="summaryItem">
            <span>내부 ATT 매출</span>
            <strong>{fmtKRW(levelSummary.attRevenue)}</strong>
            <small>{fmtNum(levelSummary.attOrders)}건 · source confidence {data?.source_confidence ?? "미확인"}</small>
          </div>
          <div className="summaryItem">
            <span>미맵핑 주문</span>
            <strong>{fmtNum(data?.unmapped?.orders ?? 0)}건</strong>
            <small>{fmtKRW(data?.unmapped?.revenue ?? 0)} · campaign 확정 실패</small>
          </div>
        </div>

        <div className="levelTabs">
          {(["campaign", "adset", "ad"] as const).map((item) => (
            <button key={item} type="button" className={level === item ? "active" : ""} onClick={() => setLevel(item)}>
              {LEVEL_LABEL[item]}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="loadingBox">Meta 캠페인, 광고 세트, 광고와 내부 attribution 원장을 읽는 중입니다.</div>
        ) : error && !data ? (
          <div className="loadingBox">조회 제한으로 아직 표를 채우지 못했습니다. 사전계산 캐시가 준비되면 Section A/B/C가 자동으로 표시됩니다.</div>
        ) : (
          <>
            <SectionPanel title="Section A · 매칭율 85% 이상, ROAS 산정 후보" tone="ready" rows={readyRows} level={level} levelSpend={levelSummary.spend} />
            <SectionPanel title="Section B · 1~84%, 보완 후 판단" tone="blocked" rows={blockedRows} level={level} levelSpend={levelSummary.spend} />
            <SectionPanel title="Section C · 미맵핑, 별도 확인" tone="unmapped" rows={unmappedRows} level={level} levelSpend={levelSummary.spend} />
            <UnmappedOrdersPanel summary={data?.unmapped} />
          </>
        )}

        <div className="notes">
          <strong>판단 기준</strong>
          <p>
            매칭율은 내부 주문 ID evidence와 광고 URL의 campaign/adset/ad ID 또는 dynamic macro를 합쳐 계산합니다.
            85% 이상이면 예산 판단 후보로 보고, 1~84%는 보완/샘플 검토, 0%는 미맵핑으로 분리합니다.
            캠페인 단위 ROAS는 기존 내부 attribution 계산과 같고, 광고세트/광고 단위 ROAS는 주문 원장에 해당 ID가 남은 경우 정확도가 높습니다.
            상세 표의 구매 전환 금액은 내부 attribution 원장에 해당 광고 구조로 매칭된 결제완료 매출입니다.
            상단 Meta 기준 구매전환값은 Meta Ads Insights의 action_values[purchase]라 최근 Meta 데이터 제한 영향으로 낮거나 비어 있을 수 있습니다.
          </p>
          {data?.diagnostics?.limitations?.map((item) => <span key={item}>{item}</span>)}
          <span>Source: Meta Ads Insights API + VM Cloud attribution ledger. Window: {data?.date_range ? `${data.date_range.start_date}~${data.date_range.end_date} KST` : datePreset}. Freshness: {data?.source_max_timestamp ?? "Meta live/cache 기준"}. Confidence: {data?.source_confidence ?? "API 응답 기준"}.</span>
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f4f6f8;
          color: #1f2937;
          padding: 96px 18px 36px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .topBar, .toolbar, .periodRoasPanel, .summaryGrid, .levelTabs, .sectionPanel, .unmappedOrdersPanel, .notes, .errorBox, .loadingBox {
          max-width: 1760px;
          margin-left: auto;
          margin-right: auto;
        }
        .topBar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 14px;
        }
        .eyebrow {
          color: #2563eb;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0;
          margin-bottom: 6px;
        }
        h1 {
          margin: 0;
          color: #111827;
          font-size: 1.42rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 0.86rem;
          line-height: 1.65;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .actions button, .secondaryLink {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 0.78rem;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .actions button {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .actions button:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .toolbar {
          display: grid;
          grid-template-columns: 180px 160px minmax(220px, 1fr) auto;
          gap: 10px;
          align-items: end;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .field, .searchField {
          display: grid;
          gap: 4px;
        }
        label {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 900;
        }
        select, input {
          height: 36px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          padding: 0 10px;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .metaInfo {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 3px;
          color: #64748b;
          font-size: 0.72rem;
          white-space: nowrap;
        }
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }
        .summaryItem {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 13px 14px;
          display: grid;
          gap: 5px;
        }
        .summaryItem span {
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 900;
        }
        .summaryItem strong {
          color: #111827;
          font-size: 1.08rem;
          font-variant-numeric: tabular-nums;
        }
        .summaryItem small {
          color: #94a3b8;
          font-size: 0.68rem;
          font-weight: 700;
        }
        .levelTabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          background: #e9eef5;
          border: 1px solid #d8e0ea;
          border-radius: 8px 8px 0 0;
          overflow: hidden;
        }
        .levelTabs button {
          height: 42px;
          border: 0;
          border-right: 1px solid #d8e0ea;
          background: #eef2f7;
          color: #475569;
          font-size: 0.86rem;
          font-weight: 900;
          cursor: pointer;
        }
        .levelTabs button:last-child {
          border-right: 0;
        }
        .levelTabs button.active {
          background: #fff;
          color: #2563eb;
        }
        .sectionPanel {
          background: #fff;
          border: 1px solid #d8e0ea;
          border-top: 0;
          padding: 14px;
          margin-bottom: 14px;
        }
        .sectionPanel.ready {
          border-left: 4px solid #059669;
        }
        .sectionPanel.blocked {
          border-left: 4px solid #f97316;
        }
        .sectionPanel.unmapped {
          border-left: 4px solid #64748b;
        }
        .sectionHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
        }
        h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          letter-spacing: 0;
        }
        .sectionHeader p {
          font-size: 0.76rem;
          margin-top: 4px;
        }
        .sectionStats {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .sectionStats span {
          padding: 5px 8px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .tableWrap {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        table {
          width: 100%;
          min-width: 1540px;
          border-collapse: collapse;
          font-size: 0.76rem;
        }
        th {
          position: sticky;
          top: 0;
          background: #f8fafc;
          color: #334155;
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid #d8e0ea;
          font-size: 0.68rem;
          font-weight: 900;
          white-space: nowrap;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #edf2f7;
          color: #334155;
          vertical-align: middle;
          font-variant-numeric: tabular-nums;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        tr:last-child td {
          border-bottom: 0;
        }
        .nameCol {
          width: 360px;
          min-width: 360px;
        }
        .nameCell {
          display: grid;
          gap: 9px;
          align-items: center;
          grid-template-columns: minmax(0, 1fr);
        }
        .nameCell.withThumb {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .thumbBox {
          width: 42px;
          height: 42px;
          border-radius: 4px;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 0.56rem;
          text-align: center;
        }
        .thumbBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .nameText {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .nameText strong {
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.78rem;
        }
        .nameText span, .nameText small, .metricSub, .idStack span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nameText small {
          color: #9a3412;
        }
        .statusPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid;
          border-radius: 999px;
          padding: 4px 8px;
          white-space: nowrap;
          font-size: 0.68rem;
          font-weight: 900;
        }
        .statusDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .matchRateCell {
          display: grid;
          gap: 4px;
          min-width: 92px;
        }
        .matchRateCell span {
          display: inline-flex;
          width: fit-content;
          border: 1px solid;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 0.68rem;
          font-weight: 1000;
        }
        .matchRateCell small {
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .matchBar {
          width: 76px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .matchBar i {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
        .idStack {
          display: grid;
          gap: 2px;
          max-width: 190px;
        }
        .idStack strong, .monoValue {
          color: #111827;
          font-size: 0.68rem;
          font-weight: 900;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .metricMain {
          color: #111827;
          font-weight: 900;
          white-space: nowrap;
        }
        .roasOk, .roasBlocked {
          font-weight: 1000;
          white-space: nowrap;
        }
        .roasOk {
          color: #047857;
        }
        .roasBlocked {
          color: #94a3b8;
        }
        .emptyState, .loadingBox, .errorBox {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 6px;
          padding: 26px 18px;
          color: #64748b;
          font-size: 0.84rem;
          text-align: center;
          font-weight: 800;
        }
        .errorBox {
          display: grid;
          gap: 5px;
          margin-bottom: 12px;
          text-align: left;
          background: #fff7ed;
          border-color: #fed7aa;
          color: #9a3412;
        }
        .errorBox small {
          color: #7c2d12;
          font-size: 0.74rem;
          line-height: 1.55;
        }
        .errorBox details {
          margin-top: 3px;
          color: #9a3412;
          font-size: 0.7rem;
        }
        .errorBox summary {
          cursor: pointer;
          font-weight: 900;
        }
        .errorBox code {
          display: block;
          margin-top: 6px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #7c2d12;
        }
        .notes {
          display: grid;
          gap: 7px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
        }
        .notes strong {
          color: #111827;
          font-size: 0.82rem;
        }
        .notes p, .notes span {
          margin: 0;
          color: #64748b;
          font-size: 0.74rem;
          line-height: 1.6;
        }
        .unmappedOrdersPanel {
          background: #fff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #64748b;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .unmappedList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .unmappedItem {
          display: grid;
          gap: 3px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 9px 10px;
        }
        .unmappedItem strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .unmappedItem span, .unmappedItem small {
          color: #64748b;
          font-size: 0.68rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .unmappedItem em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .topBar, .toolbar, .periodRoasHead, .summaryGrid, .sectionHeader {
            grid-template-columns: 1fr;
          }
          .actions, .metaInfo, .periodRoasStatus, .sectionStats {
            justify-content: flex-start;
            align-items: flex-start;
            text-align: left;
          }
          .periodRoasGrid, .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .page {
            padding-left: 10px;
            padding-right: 10px;
          }
          .periodRoasGrid, .summaryGrid {
            grid-template-columns: 1fr;
          }
          .levelTabs {
            grid-template-columns: 1fr;
            border-radius: 8px;
          }
          .levelTabs button {
            border-right: 0;
            border-bottom: 1px solid #d8e0ea;
          }
          .unmappedList {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <style jsx global>{`
        .metaUtmPage .decisionBanner {
          max-width: 1760px;
          margin: 0 auto 12px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          background: #ffffff;
          padding: 12px 14px;
        }
        .metaUtmPage .decisionBanner.needsFix {
          border-color: #fed7aa;
          background: #fffaf3;
        }
        .metaUtmPage .decisionBanner.balanced {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .decisionBanner div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .metaUtmPage .decisionBanner div:last-child {
          text-align: right;
        }
        .metaUtmPage .decisionBanner strong {
          color: #111827;
          font-size: 0.86rem;
          line-height: 1.35;
        }
        .metaUtmPage .decisionBanner span {
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .metaUtmPage .periodRoasPanel {
          max-width: 1760px;
          margin: 0 auto 12px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .periodRoasHead {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .metaUtmPage .periodRoasHead h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .periodRoasHead p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .periodRoasStatus {
          display: grid;
          gap: 3px;
          text-align: right;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .metaUtmPage .periodRoasStatus strong {
          color: #111827;
          font-size: 0.8rem;
        }
        .metaUtmPage .periodRoasGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .metaUtmPage .periodRoasCard {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 11px;
          display: grid;
          gap: 8px;
        }
        .metaUtmPage .periodRoasCardTitle {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
        }
        .metaUtmPage .periodRoasCardTitle strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .metaUtmPage .periodRoasCardTitle span {
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          text-align: right;
        }
        .metaUtmPage .periodSourceRow {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #fff;
          padding: 8px;
          display: grid;
          grid-template-columns: auto auto;
          gap: 3px 8px;
          align-items: baseline;
        }
        .metaUtmPage .periodSourceRow span {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .metaUtmPage .periodSourceRow strong {
          justify-self: end;
          color: #111827;
          font-size: 1rem;
          font-variant-numeric: tabular-nums;
        }
        .metaUtmPage .periodSourceRow small {
          grid-column: 1 / -1;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 700;
          line-height: 1.45;
        }
        .metaUtmPage .periodSourceRow.meta strong {
          color: #475569;
        }
        .metaUtmPage .periodSourceRow.att {
          border-color: #bbf7d0;
          background: #f7fef9;
        }
        .metaUtmPage .periodSourceRow.att strong {
          color: #047857;
        }
        .metaUtmPage .periodRoasCard em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        .metaUtmPage .sectionPanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-top: 0;
          padding: 14px;
        }
        .metaUtmPage .sectionPanel.ready {
          border-left: 4px solid #059669;
        }
        .metaUtmPage .sectionPanel.blocked {
          border-left: 4px solid #f97316;
        }
        .metaUtmPage .sectionPanel.unmapped {
          border-left: 4px solid #64748b;
        }
        .metaUtmPage .sectionHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 12px;
        }
        .metaUtmPage .sectionHeader h2 {
          margin: 0;
          color: #111827;
          font-size: 0.98rem;
          line-height: 1.35;
          letter-spacing: 0;
        }
        .metaUtmPage .sectionHeader p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.76rem;
          line-height: 1.55;
        }
        .metaUtmPage .sectionStats {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .metaUtmPage .sectionStats span {
          padding: 5px 8px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .metaUtmPage .tableWrap {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
        }
        .metaUtmPage table {
          width: 100%;
          min-width: 1600px;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 0.74rem;
        }
        .metaUtmPage th,
        .metaUtmPage td {
          border-bottom: 1px solid #edf2f7;
          text-align: left;
          vertical-align: middle;
        }
        .metaUtmPage th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #f8fafc;
          color: #334155;
          padding: 8px 10px;
          font-size: 0.68rem;
          font-weight: 900;
          line-height: 1.25;
          white-space: nowrap;
        }
        .metaUtmPage td {
          padding: 7px 10px;
          color: #334155;
          font-variant-numeric: tabular-nums;
          line-height: 1.35;
        }
        .metaUtmPage tr:nth-child(even) td {
          background: #f8fafc;
        }
        .metaUtmPage tr:last-child td {
          border-bottom: 0;
        }
        .metaUtmPage .nameCol {
          width: 390px;
          min-width: 390px;
        }
        .metaUtmPage th:nth-child(2),
        .metaUtmPage td:nth-child(2) {
          width: 112px;
        }
        .metaUtmPage th:nth-child(3),
        .metaUtmPage td:nth-child(3) {
          width: 112px;
        }
        .metaUtmPage th:nth-child(4),
        .metaUtmPage td:nth-child(4) {
          width: 190px;
        }
        .metaUtmPage th:nth-child(5),
        .metaUtmPage td:nth-child(5),
        .metaUtmPage th:nth-child(6),
        .metaUtmPage td:nth-child(6),
        .metaUtmPage th:nth-child(7),
        .metaUtmPage td:nth-child(7),
        .metaUtmPage th:nth-child(12),
        .metaUtmPage td:nth-child(12) {
          width: 116px;
        }
        .metaUtmPage th:nth-child(8),
        .metaUtmPage td:nth-child(8),
        .metaUtmPage th:nth-child(9),
        .metaUtmPage td:nth-child(9),
        .metaUtmPage th:nth-child(10),
        .metaUtmPage td:nth-child(10),
        .metaUtmPage th:nth-child(11),
        .metaUtmPage td:nth-child(11) {
          width: 92px;
        }
        .metaUtmPage .nameCell {
          display: grid;
          gap: 9px;
          align-items: center;
          grid-template-columns: minmax(0, 1fr);
        }
        .metaUtmPage .nameCell.withThumb {
          grid-template-columns: auto minmax(0, 1fr);
        }
        .metaUtmPage .thumbBox {
          width: 42px;
          height: 42px;
          border-radius: 4px;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 0.56rem;
          text-align: center;
        }
        .metaUtmPage .thumbBox img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .metaUtmPage .nameText {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .metaUtmPage .nameText strong {
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.78rem;
        }
        .metaUtmPage .nameText span,
        .metaUtmPage .nameText small,
        .metaUtmPage .metricSub,
        .metaUtmPage .idStack span {
          color: #64748b;
          font-size: 0.66rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .metaUtmPage .nameText small {
          color: #9a3412;
        }
        .metaUtmPage .statusPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid;
          border-radius: 999px;
          padding: 4px 8px;
          white-space: nowrap;
          font-size: 0.68rem;
          font-weight: 900;
        }
        .metaUtmPage .statusDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .metaUtmPage .matchRateCell {
          display: grid;
          gap: 4px;
          min-width: 92px;
        }
        .metaUtmPage .matchRateCell span {
          display: inline-flex;
          width: fit-content;
          border: 1px solid;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 0.68rem;
          font-weight: 1000;
        }
        .metaUtmPage .matchRateCell small {
          color: #64748b;
          font-size: 0.62rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .metaUtmPage .matchBar {
          width: 76px;
          height: 5px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .metaUtmPage .matchBar i {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
        .metaUtmPage .idStack {
          display: grid;
          gap: 2px;
          max-width: 180px;
        }
        .metaUtmPage .idStack strong,
        .metaUtmPage .monoValue {
          display: block;
          color: #111827;
          font-size: 0.68rem;
          font-weight: 900;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .metaUtmPage .metricMain,
        .metaUtmPage .roasOk,
        .metaUtmPage .roasBlocked {
          color: #111827;
          font-weight: 900;
          white-space: nowrap;
        }
        .metaUtmPage .roasOk {
          color: #047857;
        }
        .metaUtmPage .roasBlocked {
          color: #94a3b8;
        }
        .metaUtmPage .emptyState,
        .metaUtmPage .loadingBox {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 6px;
          padding: 26px 18px;
          color: #64748b;
          font-size: 0.84rem;
          text-align: center;
          font-weight: 800;
        }
        .metaUtmPage .unmappedOrdersPanel {
          max-width: 1760px;
          margin: 0 auto 14px;
          background: #ffffff;
          border: 1px solid #d8e0ea;
          border-left: 4px solid #64748b;
          border-radius: 8px;
          padding: 14px;
        }
        .metaUtmPage .unmappedList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .metaUtmPage .unmappedItem {
          display: grid;
          gap: 3px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 9px 10px;
        }
        .metaUtmPage .unmappedItem strong {
          color: #111827;
          font-size: 0.84rem;
        }
        .metaUtmPage .unmappedItem span,
        .metaUtmPage .unmappedItem small {
          color: #64748b;
          font-size: 0.68rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .metaUtmPage .unmappedItem em {
          color: #9a3412;
          font-size: 0.66rem;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .metaUtmPage .decisionBanner,
          .metaUtmPage .periodRoasHead,
          .metaUtmPage .sectionHeader {
            grid-template-columns: 1fr;
          }
          .metaUtmPage .decisionBanner div:last-child,
          .metaUtmPage .periodRoasStatus,
          .metaUtmPage .sectionStats {
            text-align: left;
            justify-content: flex-start;
          }
          .metaUtmPage .periodRoasGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .metaUtmPage .unmappedList {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .metaUtmPage .periodRoasGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
