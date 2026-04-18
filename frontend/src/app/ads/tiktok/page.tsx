"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";
import { API_BASE_URL } from "@/constants/pageData";

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

type StatusAggregate = {
  orders: number;
  rows: number;
  amount: number;
};

type CampaignRow = {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  platformRoas: number | null;
  ctaPurchaseRoas: number | null;
  vtaPurchaseRoas: number | null;
};

type AvailableRange = {
  start_date: string;
  end_date: string;
  rows: number;
  spend: number;
  purchaseValue: number;
};

type SampleOrder = {
  loggedAt: string;
  orderId: string;
  paymentStatus: string;
  amount: number;
  utmSource: string;
  utmCampaign: string;
  hasTtclid: boolean;
};

type TikTokRoasResponse = {
  ok: boolean;
  error?: string;
  start_date: string;
  end_date: string;
  attribution_window: {
    source: "assumed_default";
    click: "7d";
    view: "1d";
    note: string;
  };
  local_table: {
    name: string;
    importedRows: number;
    matchedRows: number;
    availableRanges: AvailableRange[];
  };
  ads_report: {
    source: string;
    campaignRows: CampaignRow[];
    summary: {
      spend: number;
      netCost: number;
      impressions: number;
      destinationClicks: number;
      conversions: number;
      purchases: number;
      purchaseValue: number;
      platformRoas: number | null;
      ctaPurchaseRoas: number | null;
      vtaPurchaseRoas: number | null;
      currency: string;
    };
  };
  operational_ledger: {
    source: string;
    dataSource: string;
    fetchedEntries: number;
    tiktokPaymentSuccessRows: number;
    byStatus: Record<"confirmed" | "pending" | "canceled" | "unknown", StatusAggregate>;
    sampleOrders: SampleOrder[];
  };
  gap: {
    confirmedRevenue: number;
    pendingRevenue: number;
    canceledRevenue: number;
    platformPurchaseValue: number;
    platformMinusConfirmed: number;
    platformMinusConfirmedAndPending: number;
    confirmedRoas: number | null;
    potentialRoas: number | null;
    overstatementVsConfirmedRatio: number | null;
  };
  warnings: string[];
  notes: string[];
};

const DEFAULT_RANGE = {
  startDate: "2026-03-19",
  endDate: "2026-04-17",
};

const numberFormatter = new Intl.NumberFormat("ko-KR");
const moneyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const toneMap: Record<Tone, { border: string; background: string; accent: string; text: string }> = {
  green: { border: "#bbf7d0", background: "#f0fdf4", accent: "#16a34a", text: "#166534" },
  amber: { border: "#fde68a", background: "#fffbeb", accent: "#d97706", text: "#92400e" },
  red: { border: "#fecaca", background: "#fef2f2", accent: "#dc2626", text: "#991b1b" },
  blue: { border: "#bfdbfe", background: "#eff6ff", accent: "#2563eb", text: "#1d4ed8" },
  neutral: { border: "#e2e8f0", background: "#ffffff", accent: "#475569", text: "#334155" },
};

const fmtNum = (value: number | null | undefined) =>
  value == null ? "-" : numberFormatter.format(value);

const fmtKRW = (value: number | null | undefined) =>
  value == null ? "-" : moneyFormatter.format(Math.round(value));

const fmtRoas = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(2)}x`;

const fmtPct = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(1)}%`;

const fmtKst = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
};

const statusTone = (status: string): Tone => {
  if (status === "confirmed") return "green";
  if (status === "canceled") return "red";
  if (status === "pending") return "amber";
  return "neutral";
};

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) {
  const colors = toneMap[tone];
  return (
    <article
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: colors.background,
        padding: 18,
        minHeight: 128,
      }}
    >
      <p style={{ margin: 0, color: "#64748b", fontSize: "0.76rem", fontWeight: 800 }}>{label}</p>
      <strong style={{ display: "block", marginTop: 10, color: colors.accent, fontSize: "1.35rem" }}>
        {value}
      </strong>
      <p style={{ margin: "10px 0 0", color: colors.text, fontSize: "0.78rem", lineHeight: 1.6 }}>{detail}</p>
    </article>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const colors = toneMap[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: colors.background,
        color: colors.text,
        padding: "5px 9px",
        fontSize: "0.72rem",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function TikTokAdsPerformancePage() {
  const [startDate, setStartDate] = useState(DEFAULT_RANGE.startDate);
  const [endDate, setEndDate] = useState(DEFAULT_RANGE.endDate);
  const [data, setData] = useState<TikTokRoasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        const response = await fetch(`${API_BASE_URL}/api/ads/tiktok/roas-comparison?${params.toString()}`, {
          signal: abortController.signal,
          cache: "no-store",
        });
        const nextData = (await response.json()) as TikTokRoasResponse;
        if (!response.ok || nextData.ok !== true) {
          throw new Error(nextData.error ?? `HTTP ${response.status}`);
        }
        setData(nextData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "TikTok ROAS API 응답을 불러오지 못했습니다.");
        setData(null);
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    void load();

    return () => abortController.abort();
  }, [startDate, endDate]);

  const summary = data?.ads_report.summary;
  const ledger = data?.operational_ledger.byStatus;
  const confirmed = ledger?.confirmed ?? { rows: 0, orders: 0, amount: 0 };
  const pending = ledger?.pending ?? { rows: 0, orders: 0, amount: 0 };
  const canceled = ledger?.canceled ?? { rows: 0, orders: 0, amount: 0 };
  const pendingShare = useMemo(() => {
    const total = confirmed.orders + pending.orders + canceled.orders;
    return total > 0 ? pending.orders / total * 100 : null;
  }, [confirmed.orders, pending.orders, canceled.orders]);
  const availableRanges = data?.local_table.availableRanges ?? [];

  const verdictTone: Tone = loading ? "neutral" : error ? "red" : data?.gap.confirmedRevenue === 0 ? "red" : "amber";
  const verdict = loading
    ? "운영 VM 확인 중"
    : error
      ? "API 확인 필요"
      : data?.gap.confirmedRevenue === 0
        ? "과거 TikTok ROAS 과대 가능성 매우 큼"
        : "확정매출 기준 gap 검토 필요";

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "28px 24px 56px",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
      >
        <div style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gap: 18 }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 840 }}>
              <Link href="/?tab=crm" style={{ color: "#0f766e", fontSize: "0.78rem", fontWeight: 800 }}>
                AI CRM으로 돌아가기
              </Link>
              <h1 style={{ margin: "8px 0 8px", fontSize: "1.8rem", lineHeight: 1.2, fontWeight: 900 }}>
                틱톡 ROAS 정합성
              </h1>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem", lineHeight: 1.75 }}>
                TikTok Ads Manager XLSX에서 가져온 플랫폼 구매값과 운영 VM Attribution 원장의 실제 결제 상태를 같은
                기간으로 비교합니다.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {availableRanges.length > 0 ? availableRanges.map((range) => {
                const active = range.start_date === startDate && range.end_date === endDate;
                return (
                  <button
                    key={`${range.start_date}-${range.end_date}`}
                    type="button"
                    onClick={() => {
                      setStartDate(range.start_date);
                      setEndDate(range.end_date);
                    }}
                    style={{
                      border: `1px solid ${active ? "#0f766e" : "#cbd5e1"}`,
                      borderRadius: 8,
                      background: active ? "#0f766e" : "#ffffff",
                      color: active ? "#ffffff" : "#475569",
                      cursor: "pointer",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      padding: "8px 12px",
                    }}
                  >
                    {range.start_date} ~ {range.end_date}
                  </button>
                );
              }) : (
                <StatusBadge tone="neutral">{startDate} ~ {endDate}</StatusBadge>
              )}
            </div>
          </header>

          <section
            style={{
              border: `1px solid ${toneMap[verdictTone].border}`,
              borderRadius: 8,
              background: toneMap[verdictTone].background,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <StatusBadge tone={verdictTone}>{verdict}</StatusBadge>
              <StatusBadge tone="neutral">기간: {startDate} ~ {endDate}</StatusBadge>
              <StatusBadge tone="neutral">어트리뷰션: Click 7일 / View 1일 가정</StatusBadge>
            </div>
            <p style={{ margin: "14px 0 0", color: toneMap[verdictTone].text, fontSize: "0.9rem", lineHeight: 1.8 }}>
              {loading
                ? "로컬 TikTok Ads 테이블과 운영 VM 원장을 조회하고 있습니다."
                : error
                  ? error
                  : `TikTok 플랫폼은 구매값 ${fmtKRW(summary?.purchaseValue)}와 ROAS ${fmtRoas(summary?.platformRoas)}를 보고하지만, 운영 VM 원장의 TikTok 귀속 confirmed 매출은 ${fmtKRW(data?.gap.confirmedRevenue)}입니다. pending은 ${fmtKRW(data?.gap.pendingRevenue)}로 분리됩니다.`}
            </p>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <MetricCard
              label="TikTok 광고비"
              value={loading ? "로딩 중" : fmtKRW(summary?.spend)}
              detail="TikTok Ads XLSX에서 로컬 SQLite로 적재한 캠페인 기간 합계"
              tone="blue"
            />
            <MetricCard
              label="플랫폼 구매값"
              value={loading ? "로딩 중" : fmtKRW(summary?.purchaseValue)}
              detail={`${fmtNum(summary?.purchases)}건 구매 기준. 한국어 export 중복 헤더는 구매값으로 표준화`}
              tone="amber"
            />
            <MetricCard
              label="플랫폼 ROAS"
              value={loading ? "로딩 중" : fmtRoas(summary?.platformRoas)}
              detail="TikTok 구매값 / TikTok 광고비"
              tone="amber"
            />
            <MetricCard
              label="운영 confirmed"
              value={loading ? "로딩 중" : fmtKRW(data?.gap.confirmedRevenue)}
              detail={`${fmtNum(confirmed.orders)}건. Toss DONE 기준 확정매출`}
              tone={confirmed.amount > 0 ? "green" : "red"}
            />
            <MetricCard
              label="운영 pending"
              value={loading ? "로딩 중" : fmtKRW(data?.gap.pendingRevenue)}
              detail={`${fmtNum(pending.orders)}건. 전체 TikTok 주문 중 ${fmtPct(pendingShare)}`}
              tone={pending.amount > 0 ? "amber" : "neutral"}
            />
            <MetricCard
              label="confirmed 기준 gap"
              value={loading ? "로딩 중" : fmtKRW(data?.gap.platformMinusConfirmed)}
              detail={`confirmed ROAS ${fmtRoas(data?.gap.confirmedRoas)}, potential ROAS ${fmtRoas(data?.gap.potentialRoas)}`}
              tone="red"
            />
          </section>

          <section
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>캠페인별 플랫폼 ROAS</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
                현재 export는 일자 컬럼이 없어 캠페인 기간 합계 기준입니다.
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>캠페인</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>비용</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>구매수</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>구매값</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>ROAS</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>CTA</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>VTA</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, color: "#64748b" }}>불러오는 중입니다.</td>
                    </tr>
                  ) : data?.ads_report.campaignRows.length ? data.ads_report.campaignRows.map((row) => (
                    <tr key={row.campaignId}>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>
                        {row.campaignName}
                        <p style={{ margin: "5px 0 0", color: "#64748b", fontWeight: 500 }}>
                          {row.campaignId} · {row.status}
                        </p>
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtKRW(row.spend)}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtNum(row.purchases)}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtKRW(row.purchaseValue)}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900 }}>
                        {fmtRoas(row.platformRoas)}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtRoas(row.ctaPurchaseRoas)}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtRoas(row.vtaPurchaseRoas)}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, color: "#64748b" }}>표시할 캠페인 행이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            <article style={{ border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#991b1b", fontSize: "0.95rem", fontWeight: 900 }}>gap 판정</h3>
              <p style={{ margin: "10px 0 0", color: "#991b1b", fontSize: "0.82rem", lineHeight: 1.75 }}>
                플랫폼 구매값에서 운영 confirmed 매출을 빼면 {fmtKRW(data?.gap.platformMinusConfirmed)}입니다. confirmed와
                pending을 모두 포함해도 gap은 {fmtKRW(data?.gap.platformMinusConfirmedAndPending)}입니다.
              </p>
            </article>
            <article style={{ border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#92400e", fontSize: "0.95rem", fontWeight: 900 }}>운영 VM 상태</h3>
              <p style={{ margin: "10px 0 0", color: "#92400e", fontSize: "0.82rem", lineHeight: 1.75 }}>
                VM에서 {fmtNum(data?.operational_ledger.fetchedEntries)}개 원장을 읽었고, TikTok payment_success는
                {fmtNum(data?.operational_ledger.tiktokPaymentSuccessRows)}행입니다. 운영 원장은 읽기 전용으로만 조회했습니다.
              </p>
            </article>
            <article style={{ border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#1d4ed8", fontSize: "0.95rem", fontWeight: 900 }}>로컬 테이블</h3>
              <p style={{ margin: "10px 0 0", color: "#1d4ed8", fontSize: "0.82rem", lineHeight: 1.75 }}>
                `{data?.local_table.name ?? "tiktok_ads_campaign_range"}`에 XLSX 처리 CSV를 upsert했습니다.
                현재 선택 기간 매칭 행은 {fmtNum(data?.local_table.matchedRows)}개입니다.
              </p>
            </article>
          </section>

          <section
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>운영 VM TikTok 주문 샘플</h2>
            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>시간</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>상태</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>주문번호</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>금액</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>캠페인</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>ttclid</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.operational_ledger.sampleOrders ?? []).map((sample) => (
                    <tr key={`${sample.loggedAt}-${sample.orderId}`}>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {fmtKst(sample.loggedAt)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <StatusBadge tone={statusTone(sample.paymentStatus)}>{sample.paymentStatus}</StatusBadge>
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>{sample.orderId}</td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                        {fmtKRW(sample.amount)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word" }}>
                        {sample.utmCampaign || sample.utmSource || "-"}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        {sample.hasTtclid ? "있음" : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(data?.warnings.length || data?.notes.length) ? (
            <section style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff", padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 900 }}>주의 및 기록</h2>
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#475569", fontSize: "0.8rem", lineHeight: 1.75 }}>
                {[...(data?.warnings ?? []), ...(data?.notes ?? [])].map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          <footer style={{ color: "#64748b", fontSize: "0.76rem", lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              데이터 소스: TikTok XLSX local SQLite + 운영 VM Attribution ledger ·{" "}
              <Link href="/ads" style={{ color: "#0f766e", fontWeight: 800 }}>Meta 광고성과</Link>
              {" / "}
              <Link href="/ads/roas" style={{ color: "#0f766e", fontWeight: 800 }}>ROAS 대시보드</Link>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
