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
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
] as const;

type MetaUtmLevel = "campaign" | "adset" | "ad";
type MetaUtmSection = "ready" | "blocked";

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
    readyAdCount: number;
    blockedAdCount: number;
    totalAdCount: number;
    reasons: string[];
    sampleTags: string | null;
    sampleUrl: string | null;
  };
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
  };
  rows: MetaUtmRow[];
  summary: {
    ready: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
    blocked: { rows: number; spend: number; purchases: number; attRevenue: number; attOrders: number };
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

const LEVEL_LABEL: Record<MetaUtmLevel, string> = {
  campaign: "캠페인",
  adset: "광고 세트",
  ad: "광고",
};

const fmtNum = (value: number) => Math.round(value).toLocaleString("ko-KR");
const fmtKRW = (value: number | null | undefined) => (
  value == null ? "—" : `₩${Math.round(value).toLocaleString("ko-KR")}`
);
const fmtRoas = (value: number | null) => (value == null ? "—" : `${value.toFixed(2)}x`);
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

function StatusPill({ label }: { label: string }) {
  const tone = deliveryTone(label);
  return (
    <span className="statusPill" style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
      <span className="statusDot" style={{ background: tone.dot }} />
      {label}
    </span>
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
  const reason = row.section === "ready"
    ? `UTM 준비 광고 ${row.evidence.readyAdCount || (row.level === "ad" ? 1 : 0)}개`
    : row.evidence.reasons.slice(0, 2).join(" · ");
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
    ? `${LEVEL_LABEL[level]} 중 현재 UTM 기준을 모두 통과한 항목이 없습니다.`
    : `${LEVEL_LABEL[level]} 중 UTM 보완이 필요한 항목이 없습니다.`;

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
            <th>캠페인 ID</th>
            <th>예산</th>
            <th>ROAS(att)</th>
            <th>지출금액</th>
            <th>구매(수)</th>
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
              <td><IdStack row={row} /></td>
              <td>
                <div className="metricMain">{fmtKRW(row.budget.amount)}</div>
                <div className="metricSub">{row.budget.label}</div>
              </td>
              <td>
                <div className={row.att.calculable ? "roasOk" : "roasBlocked"}>{fmtRoas(row.att.roas)}</div>
                <div className="metricSub">{row.att.calculable ? `${fmtKRW(row.att.revenue)} · ${fmtNum(row.att.orders)}건` : "UTM 보완 필요"}</div>
              </td>
              <td><div className="metricMain">{fmtKRW(row.metrics.spend)}</div></td>
              <td>
                <div className="metricMain">{fmtNum(row.metrics.purchases)}</div>
                <div className="metricSub">Meta 구매</div>
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
  tone: "ready" | "blocked";
  rows: MetaUtmRow[];
  level: MetaUtmLevel;
  levelSpend: number;
}) {
  const stats = summarize(rows);
  const spendShare = levelSpend > 0 ? (stats.spend / levelSpend) * 100 : 0;
  return (
    <section className={`sectionPanel ${tone}`}>
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p>{tone === "ready" ? "광고 링크에 Meta UTM/ID가 남아 내부 ROAS 계산에 쓸 수 있는 묶음입니다." : "UTM/ID evidence가 부족해 광고별 내부 ROAS를 신뢰하기 어려운 묶음입니다."}</p>
        </div>
        <div className="sectionStats">
          <span>{fmtNum(stats.rows)}행</span>
          <span>{fmtKRW(stats.spend)}</span>
          <span>Meta 구매 {fmtNum(stats.purchases)}</span>
          <span>{fmtRatio(spendShare)}</span>
        </div>
      </div>
      <MetricTable rows={rows} section={tone} level={level} />
    </section>
  );
}

export default function MetaUtmPage() {
  const [selectedSite, setSelectedSite] = useState<(typeof SITES)[number]>(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [level, setLevel] = useState<MetaUtmLevel>("campaign");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MetaUtmDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
  const readyRows = rows.filter((row) => row.section === "ready");
  const blockedRows = rows.filter((row) => row.section === "blocked");
  const levelSummary = data?.summary.byLevel[level] ?? { rows: 0, spend: 0, purchases: 0, attRevenue: 0, attOrders: 0 };
  const blockedSpendShare = levelSummary.spend > 0 ? blockedRows.reduce((sum, row) => sum + row.metrics.spend, 0) / levelSummary.spend : 0;
  const cacheStatus = data?.cache?.cached
    ? data.cache.stale
      ? "지난 계산값"
      : "사전계산/캐시 응답"
    : loading && data
      ? "갱신 중"
      : "라이브 조회";
  const currentDecision = blockedSpendShare >= 0.9
    ? "현재 예산 판단은 UTM 보완부터 해야 합니다"
    : "ROAS 산정 가능 항목과 보완 항목을 나눠 볼 수 있습니다";

  return (
    <>
      <GlobalNav />
      <main className="metaUtmPage page">
        <div className="topBar">
          <div>
            <div className="eyebrow">Meta UTM 진단</div>
            <h1>광고 링크가 ROAS 계산에 충분한지 계층별로 확인합니다</h1>
            <p>
              Section A는 광고 링크에 UTM과 Meta ID가 충분히 남아 내부 ROAS를 계산할 수 있는 항목,
              Section B는 보완 전까지 ROAS 판단에서 제외해야 하는 항목입니다.
            </p>
          </div>
          <div className="actions">
            <Link href="/ads" className="secondaryLink">ROAS 대시보드</Link>
            <Link href="/ads/campaign-mapping" className="secondaryLink">캠페인 매핑</Link>
            <button type="button" onClick={() => load(true)} disabled={loading}>{loading ? "조회 중" : "새로고침"}</button>
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

        <div className={`decisionBanner ${blockedSpendShare >= 0.9 ? "needsFix" : "balanced"}`}>
          <div>
            <strong>{currentDecision}</strong>
            <span>
              {LEVEL_LABEL[level]} 기준 Section B 지출 {fmtKRW(blockedRows.reduce((sum, row) => sum + row.metrics.spend, 0))}
              {" "}· 전체 대비 {fmtRatio(blockedSpendShare * 100)}
            </span>
          </div>
          <div>
            <strong>{cacheStatus}</strong>
            <span>{data?.cache?.cached_at_kst ? `계산 시각 ${data.cache.cached_at_kst}` : "첫 조회는 서버 계산 후 캐시에 저장됩니다"}</span>
          </div>
        </div>

        {error && (
          <div className="errorBox">
            <strong>Meta UTM 진단 조회 실패</strong>
            <span>{error}</span>
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
            <span>UTM 보완 대상 지출</span>
            <strong>{fmtKRW(blockedRows.reduce((sum, row) => sum + row.metrics.spend, 0))}</strong>
            <small>비중 {fmtRatio(blockedSpendShare * 100)}</small>
          </div>
          <div className="summaryItem">
            <span>내부 ATT 매출</span>
            <strong>{fmtKRW(levelSummary.attRevenue)}</strong>
            <small>{fmtNum(levelSummary.attOrders)}건 · source confidence {data?.source_confidence ?? "미확인"}</small>
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
        ) : (
          <>
            <SectionPanel title="Section A · UTM 정상, ROAS 산정 가능" tone="ready" rows={readyRows} level={level} levelSpend={levelSummary.spend} />
            <SectionPanel title="Section B · UTM 보완 필요, ROAS 산정 보류" tone="blocked" rows={blockedRows} level={level} levelSpend={levelSummary.spend} />
          </>
        )}

        <div className="notes">
          <strong>판단 기준</strong>
          <p>
            광고 링크에 `utm_source`, `utm_medium`, campaign id, adset id, ad id가 모두 있어야 Section A로 봅니다.
            캠페인 단위 ROAS는 기존 내부 attribution 계산과 같고, 광고세트/광고 단위 ROAS는 주문 원장에 해당 ID가 남은 경우만 계산합니다.
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
        .topBar, .toolbar, .summaryGrid, .levelTabs, .sectionPanel, .notes, .errorBox, .loadingBox {
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          border-left: 4px solid #dc2626;
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
          min-width: 1360px;
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
        @media (max-width: 980px) {
          .topBar, .toolbar, .summaryGrid, .sectionHeader {
            grid-template-columns: 1fr;
          }
          .actions, .metaInfo, .sectionStats {
            justify-content: flex-start;
            align-items: flex-start;
          }
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .page {
            padding-left: 10px;
            padding-right: 10px;
          }
          .summaryGrid {
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
          border-left: 4px solid #dc2626;
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
          min-width: 1480px;
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
          width: 190px;
        }
        .metaUtmPage th:nth-child(4),
        .metaUtmPage td:nth-child(4),
        .metaUtmPage th:nth-child(5),
        .metaUtmPage td:nth-child(5),
        .metaUtmPage th:nth-child(6),
        .metaUtmPage td:nth-child(6),
        .metaUtmPage th:nth-child(11),
        .metaUtmPage td:nth-child(11) {
          width: 116px;
        }
        .metaUtmPage th:nth-child(7),
        .metaUtmPage td:nth-child(7),
        .metaUtmPage th:nth-child(8),
        .metaUtmPage td:nth-child(8),
        .metaUtmPage th:nth-child(9),
        .metaUtmPage td:nth-child(9),
        .metaUtmPage th:nth-child(10),
        .metaUtmPage td:nth-child(10) {
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
        @media (max-width: 980px) {
          .metaUtmPage .decisionBanner,
          .metaUtmPage .sectionHeader {
            grid-template-columns: 1fr;
          }
          .metaUtmPage .decisionBanner div:last-child,
          .metaUtmPage .sectionStats {
            text-align: left;
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}
