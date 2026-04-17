"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import GlobalNav from "@/components/common/GlobalNav";
import { API_BASE_URL } from "@/constants/pageData";

type RangeDays = 7 | 30 | 90;

type ChannelRow = {
  key: string;
  label: string;
  description: string;
  count: number;
  share: number;
  confirmedCount: number;
  pendingCount: number;
  canceledCount: number;
  revenue: number;
  pendingRevenue: number;
  examples: string[];
};

type RecentSample = {
  loggedAt: string;
  touchpoint: string;
  paymentStatus: string | null;
  channel: string;
  landing: string;
  referrer: string;
  utmSource: string;
  utmCampaign: string;
  clickIdType: string | null;
};

type SiteReport = {
  key: string;
  source: string;
  name: string;
  domain: string;
  totalConversions: number;
  operationalConversions?: number;
  confirmedConversions: number;
  pendingConversions: number;
  canceledConversions: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  totalObservedRevenue: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  channels: ChannelRow[];
  recentSamples: RecentSample[];
  insights: string[];
  dataWarnings: string[];
};

type AcquisitionSummaryResponse = {
  ok: boolean;
  dataSource?: string;
  remoteWarnings?: string[];
  generatedAt: string;
  range: {
    rangeDays: number;
    startAt: string;
    endAt: string;
  };
  sites: SiteReport[];
  notes: string[];
};

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

const RANGE_OPTIONS: RangeDays[] = [7, 30, 90];

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

const fmtPct = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(1)}%`;

const fmtRoas = (value: number | null | undefined) =>
  value == null ? "계산 불가" : `${value.toFixed(2)}x`;

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

const compactUrl = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    const parsed = new URL(value);
    const idx = parsed.searchParams.get("idx");
    const orderCode = parsed.searchParams.get("order_code");
    const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
    if (orderCode) return `${parsed.hostname}${path}?order_code=${orderCode}`;
    if (idx) return `${parsed.hostname}${path}?idx=${idx}`;
    return `${parsed.hostname}${path}`;
  } catch {
    return value.length > 76 ? `${value.slice(0, 76)}...` : value;
  }
};

const computeRoas = (revenue: number, spend: number | null) =>
  spend != null && spend > 0 ? revenue / spend : null;

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
        minHeight: 126,
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
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [data, setData] = useState<AcquisitionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/attribution/acquisition-summary?rangeDays=${rangeDays}&dataSource=vm`,
          { signal: abortController.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const nextData = (await response.json()) as AcquisitionSummaryResponse;
        setData(nextData.ok ? nextData : null);
        if (!nextData.ok) setError("유입분석 API가 ok=false를 반환했습니다.");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("유입분석 API 응답을 불러오지 못했습니다. 백엔드 7020 실행 상태를 확인하세요.");
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    void load();

    return () => abortController.abort();
  }, [rangeDays]);

  const biocom = useMemo(
    () => data?.sites.find((site) => site.key === "biocom" || site.domain === "biocom.kr") ?? null,
    [data],
  );

  const tiktokChannel = useMemo(
    () => biocom?.channels.find((channel) => channel.key === "tiktok") ?? null,
    [biocom],
  );

  const tiktokSamples = useMemo(
    () =>
      biocom?.recentSamples.filter((sample) => {
        const haystack = `${sample.channel} ${sample.landing} ${sample.referrer} ${sample.utmSource} ${sample.utmCampaign}`.toLowerCase();
        return haystack.includes("tiktok") || haystack.includes("ttclid");
      }) ?? [],
    [biocom],
  );

  const totalConversions = biocom?.operationalConversions ?? biocom?.totalConversions ?? 0;
  const tiktokCount = tiktokChannel?.count ?? 0;
  const tiktokShare = tiktokChannel?.share ?? 0;
  const tiktokConfirmedCount = tiktokChannel?.confirmedCount ?? 0;
  const tiktokPendingCount = tiktokChannel?.pendingCount ?? 0;
  const tiktokConfirmedRevenue = tiktokChannel?.revenue ?? 0;
  const tiktokPendingRevenue = tiktokChannel?.pendingRevenue ?? 0;

  const tiktokSpend: number | null = null;
  const tiktokAdsRevenue: number | null = null;
  const attRoas = computeRoas(tiktokConfirmedRevenue, tiktokSpend);
  const tiktokPlatformRoas = computeRoas(tiktokAdsRevenue ?? 0, tiktokSpend);
  const hasPendingOnly = tiktokPendingCount > 0 && tiktokConfirmedCount === 0;

  const decisionTone: Tone = loading ? "neutral" : error ? "red" : tiktokCount > 0 ? "amber" : "blue";
  const decisionText = loading
    ? "원장 불러오는 중"
    : error
    ? "데이터 확인 필요"
    : tiktokCount > 0
      ? "부분 분석 가능, ROAS 비교는 보류"
      : "기간 내 TikTok 전환 없음";

  const comparisonRows = [
    {
      label: "Attribution ROAS",
      formula: "TikTok 귀속 confirmed 매출 / TikTok 광고비",
      current: loading ? "확인 중" : `${fmtKRW(tiktokConfirmedRevenue)} / 광고비 미연동`,
      value: loading ? "확인 중" : fmtRoas(attRoas),
      status: loading ? "대기" : "보류",
      tone: loading ? "neutral" as Tone : "amber" as Tone,
      note: "운영 원장 매출은 있으나 TikTok 광고비가 백엔드에 없다.",
    },
    {
      label: "TikTok Ads ROAS",
      formula: "TikTok Ads Manager 구매값 / TikTok 광고비",
      current: "Ads Manager 지출 및 구매값 미연동",
      value: loading ? "확인 중" : fmtRoas(tiktokPlatformRoas),
      status: loading ? "대기" : "불가",
      tone: loading ? "neutral" as Tone : "red" as Tone,
      note: "현재 저장소에는 TikTok Ads API 또는 CSV 적재 로직이 없다.",
    },
    {
      label: "전환 품질",
      formula: "confirmed와 pending 분리",
      current: loading ? "확인 중" : `confirmed ${fmtNum(tiktokConfirmedCount)}건, pending ${fmtNum(tiktokPendingCount)}건`,
      value: loading ? "확인 중" : hasPendingOnly ? "미입금 주의" : "확인 가능",
      status: loading ? "대기" : hasPendingOnly ? "주의" : "가능",
      tone: loading ? "neutral" as Tone : hasPendingOnly ? "amber" as Tone : "green" as Tone,
      note: "가상계좌 미입금 주문이 웹 Purchase로 잡히면 플랫폼 ROAS가 과대 계산될 수 있다.",
    },
  ];

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
        <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 820 }}>
              <Link href="/?tab=crm" style={{ color: "#0f766e", fontSize: "0.78rem", fontWeight: 800 }}>
                AI CRM으로 돌아가기
              </Link>
              <h1 style={{ margin: "8px 0 8px", fontSize: "1.8rem", lineHeight: 1.2, fontWeight: 900 }}>
                틱톡 광고성과
              </h1>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem", lineHeight: 1.75 }}>
                운영 Attribution 원장에 잡힌 TikTok 유입 전환을 기준으로 Att ROAS와 TikTok Ads Manager ROAS
                비교 가능 여부를 점검합니다.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRangeDays(option)}
                  style={{
                    border: `1px solid ${rangeDays === option ? "#0f766e" : "#cbd5e1"}`,
                    borderRadius: 8,
                    background: rangeDays === option ? "#0f766e" : "#ffffff",
                    color: rangeDays === option ? "#ffffff" : "#475569",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    padding: "8px 12px",
                  }}
                >
                  최근 {option}일
                </button>
              ))}
            </div>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            <article
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                padding: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <StatusBadge tone={decisionTone}>{decisionText}</StatusBadge>
                <StatusBadge tone="neutral">데이터 소스: {data?.dataSource ?? (loading ? "확인 중" : "운영 VM 원장")}</StatusBadge>
              </div>
              <h2 style={{ margin: "16px 0 8px", fontSize: "1.2rem", fontWeight: 900 }}>
                현재 결론
              </h2>
              <p style={{ margin: 0, color: "#334155", fontSize: "0.88rem", lineHeight: 1.8 }}>
                {loading
                  ? "운영 VM 원장에서 바이오컴 TikTok 귀속 전환을 불러오는 중입니다."
                  : error
                  ? error
                  : tiktokCount > 0
                    ? `바이오컴 원장에는 TikTok 귀속 전환 ${fmtNum(tiktokCount)}건이 있습니다. 다만 confirmed 매출은 ${fmtKRW(tiktokConfirmedRevenue)}, pending 매출은 ${fmtKRW(tiktokPendingRevenue)}이고, TikTok 광고비 및 Ads Manager 구매값이 연결되어 있지 않아 Att ROAS와 TikTok ROAS를 숫자로 비교할 수 없습니다.`
                    : "선택 기간의 바이오컴 원장에서 TikTok 귀속 전환이 잡히지 않았습니다. TikTok 광고비와 플랫폼 구매값도 아직 연결되어 있지 않아 ROAS 비교는 보류 상태입니다."}
              </p>
            </article>

            <article
              style={{
                border: "1px solid #fde68a",
                borderRadius: 8,
                background: "#fffbeb",
                padding: 20,
              }}
            >
              <p style={{ margin: 0, color: "#92400e", fontSize: "0.76rem", fontWeight: 900 }}>운영 주의</p>
              <h2 style={{ margin: "10px 0 8px", fontSize: "1.05rem", fontWeight: 900 }}>
                가상계좌 미입금 Purchase
              </h2>
              <p style={{ margin: 0, color: "#78350f", fontSize: "0.8rem", lineHeight: 1.75 }}>
                미입금 주문 생성 시점에 TikTok 웹 Purchase가 발생하면 Ads Manager ROAS가 실제 입금 매출보다 높아질 수
                있습니다. 현재 비교 기준은 pending 제외, confirmed 매출 우선입니다.
              </p>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            <MetricCard
              label="TikTok 원장 전환"
              value={loading ? "로딩 중" : `${fmtNum(tiktokCount)}건`}
              detail={loading ? "운영 VM 원장을 확인 중" : `바이오컴 운영 전환 ${fmtNum(totalConversions)}건 중 ${fmtPct(tiktokShare)}`}
              tone="blue"
            />
            <MetricCard
              label="confirmed 매출"
              value={loading ? "로딩 중" : fmtKRW(tiktokConfirmedRevenue)}
              detail={loading ? "confirmed 주문을 확인 중" : `${fmtNum(tiktokConfirmedCount)}건. ROAS 분자는 이 값을 우선 사용`}
              tone={tiktokConfirmedRevenue > 0 ? "green" : "neutral"}
            />
            <MetricCard
              label="pending 매출"
              value={loading ? "로딩 중" : fmtKRW(tiktokPendingRevenue)}
              detail={loading ? "pending 주문을 확인 중" : `${fmtNum(tiktokPendingCount)}건. 가상계좌 미입금 가능성 때문에 분리`}
              tone={tiktokPendingRevenue > 0 ? "amber" : "neutral"}
            />
            <MetricCard
              label="TikTok 광고비"
              value="미연동"
              detail="TikTok Ads API 또는 캠페인 CSV 적재가 필요"
              tone="red"
            />
            <MetricCard
              label="Att ROAS"
              value={fmtRoas(attRoas)}
              detail="광고비 denominator가 없어 현재 계산 보류"
              tone="amber"
            />
            <MetricCard
              label="TikTok ROAS"
              value={fmtRoas(tiktokPlatformRoas)}
              detail="Ads Manager 구매값과 지출이 없어 현재 계산 불가"
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
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>Att ROAS vs TikTok ROAS 비교</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
                현재는 전환 원장 쪽 일부 분석만 가능하고, 플랫폼 ROAS 비교는 입력 데이터가 부족합니다.
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>기준</th>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>공식</th>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>현재 데이터</th>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>값</th>
                    <th style={{ textAlign: "left", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>판정</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>
                        {row.label}
                        <p style={{ margin: "5px 0 0", color: "#64748b", fontWeight: 500, lineHeight: 1.55 }}>
                          {row.note}
                        </p>
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                        {row.formula}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                        {row.current}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>
                        {row.value}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #e2e8f0" }}>
                        <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            <article style={{ border: "1px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#166534", fontSize: "0.95rem", fontWeight: 900 }}>지금 가능한 분석</h3>
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#166534", fontSize: "0.8rem", lineHeight: 1.75 }}>
                <li>ttclid, TikTok referrer, TikTok UTM 기준 전환 분류</li>
                <li>confirmed, pending, canceled 주문 상태 분리</li>
                <li>가상계좌 미입금 주문이 ROAS를 오염시키는지 확인</li>
              </ul>
            </article>
            <article style={{ border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#991b1b", fontSize: "0.95rem", fontWeight: 900 }}>현재 막힌 비교</h3>
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#991b1b", fontSize: "0.8rem", lineHeight: 1.75 }}>
                <li>TikTok Ads 캠페인별 spend, click, impression 미수집</li>
                <li>Ads Manager 구매값과 내부 confirmed 매출의 차이 미수집</li>
                <li>캠페인 ID 또는 UTM과 주문 원장 매칭 테이블 부재</li>
              </ul>
            </article>
            <article style={{ border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#1d4ed8", fontSize: "0.95rem", fontWeight: 900 }}>연결하면 바로 계산할 값</h3>
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#1d4ed8", fontSize: "0.8rem", lineHeight: 1.75 }}>
                <li>Att ROAS = TikTok confirmed 매출 / TikTok spend</li>
                <li>TikTok ROAS = Ads Manager purchase value / TikTok spend</li>
                <li>차이 = TikTok ROAS - Att ROAS, pending 제외 기준으로 판정</li>
              </ul>
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>최근 TikTok 전환 샘플</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.8rem" }}>
                  운영 원장 recentSamples 기준입니다. 표본은 전체 원장 전체가 아니라 최근 일부 샘플입니다.
                </p>
              </div>
              <StatusBadge tone="neutral">최근 원장: {fmtKst(biocom?.latestLoggedAt)} KST</StatusBadge>
            </div>

            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>시간</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>상태</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>랜딩</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>referrer</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>식별자</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: "#64748b" }}>불러오는 중입니다.</td>
                    </tr>
                  ) : tiktokSamples.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: "#64748b" }}>최근 샘플에 TikTok 전환이 없습니다.</td>
                    </tr>
                  ) : (
                    tiktokSamples.map((sample) => (
                      <tr key={`${sample.loggedAt}-${sample.landing}`}>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                          {fmtKst(sample.loggedAt)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          <StatusBadge tone={sample.paymentStatus === "confirmed" ? "green" : "amber"}>
                            {sample.paymentStatus ?? "-"}
                          </StatusBadge>
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word" }}>
                          {compactUrl(sample.landing)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word" }}>
                          {compactUrl(sample.referrer)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {sample.clickIdType ?? "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer style={{ color: "#64748b", fontSize: "0.76rem", lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              생성 시각: {fmtKst(data?.generatedAt)} KST · 원격 경고:
              {" "}
              {data?.remoteWarnings?.length ? data.remoteWarnings.join(", ") : "없음"}
              {" · "}
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
