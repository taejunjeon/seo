"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import GlobalNav from "@/components/common/GlobalNav";
import { API_BASE_URL } from "@/constants/pageData";

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

type StatusAggregate = {
  orders: number;
  rows: number;
  amount: number;
};

type SourceReasonAggregate = {
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
  sourceMatchReasons: string[];
  precisionTier: "high" | "medium" | "low";
};

type PendingAuditFate = "confirmed_later" | "expired_unpaid" | "canceled" | "false_attribution" | "still_pending";

type PendingAuditOrder = SampleOrder & {
  paymentKey: string;
  ageHours: number | null;
  overVirtualAccountExpiry: boolean;
  expiryCutoffAt: string;
  firstSeenAt: string;
  lastStatusAt: string;
  fate: PendingAuditFate;
  evidence: string;
};

type TikTokPixelEventOrder = {
  loggedAt: string;
  orderKey: string;
  orderNo: string;
  paymentCode: string;
  value: number | null;
  currency: string;
  finalAction: string;
  actions: string[];
  decisionStatus: string;
  decisionBranch: string;
  replacementEventName: string;
  eventId: string;
};

type DailyComparisonRow = {
  date: string;
  guardPhase: "pre_guard" | "guard_start" | "post_guard";
  hasAdsData: boolean;
  spend: number;
  platformPurchases: number;
  platformPurchaseValue: number;
  platformRoas: number | null;
  ctaPurchaseCount: number;
  evtaPurchaseCount: number;
  vtaPurchaseCount: number;
  unclassifiedPurchaseCount: number;
  ctaPurchaseValue: number;
  evtaPurchaseValue: number;
  vtaPurchaseValue: number;
  confirmedOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  canceledRevenue: number;
  confirmedRoas: number | null;
  potentialRoas: number | null;
  platformMinusConfirmed: number;
  platformMinusConfirmedAndPending: number;
};

type DailyComparisonSummary = {
  days: number;
  daysWithSpend: number;
  platformSpend: number;
  platformPurchaseValue: number;
  platformPurchases: number;
  ctaPurchaseCount: number;
  evtaPurchaseCount: number;
  vtaPurchaseCount: number;
  unclassifiedPurchaseCount: number;
  platformRoas: number | null;
  confirmedRevenue: number;
  pendingRevenue: number;
  canceledRevenue: number;
  confirmedRoas: number | null;
  potentialRoas: number | null;
  platformMinusConfirmed: number;
  platformMinusConfirmedAndPending: number;
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
    daily: {
      name: string;
      importedRows: number;
      rows: number;
      minDate: string | null;
      maxDate: string | null;
      readyForImport: boolean;
      note: string;
    };
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
      ctaPurchaseCount: number;
      evtaPurchaseCount: number;
      vtaPurchaseCount: number;
      platformRoas: number | null;
      ctaPurchaseRoas: number | null;
      evtaPurchaseRoas: number | null;
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
    sourceReasonSummary: Record<string, SourceReasonAggregate>;
    sourcePrecisionSummary: Record<"high" | "medium" | "low", SourceReasonAggregate>;
    pendingFateSummary: Record<PendingAuditFate, SourceReasonAggregate>;
    pendingAuditTop20: PendingAuditOrder[];
    sampleOrders: SampleOrder[];
  };
  ga4_cross_check: {
    source: string;
    dataSource: string;
    available: boolean;
    confidence: "medium" | "unavailable";
    warning: string | null;
    totals: {
      ga4Rows: number;
      ga4Events: number;
      ga4Revenue: number;
      numericTransactionRows: number;
      npayTransactionRows: number;
      blankTransactionEvents: number;
      blankTransactionRevenue: number;
      ledgerConfirmedRows: number;
      ledgerConfirmedRevenue: number;
      ledgerConfirmedAmount: number;
      ledgerCanceledRows: number;
      ledgerCanceledRevenue: number;
      noLedgerMatchRows: number;
      noLedgerMatchRevenue: number;
      confirmedWithTikTokLedgerSignals: number;
      confirmedWithOtherLedgerSource: number;
      confirmedWithMissingLedgerSource: number;
    };
    notes: string[];
    samples: Array<{
      date: string;
      transactionId: string;
      sessionSource: string;
      sessionMedium: string;
      ga4Revenue: number;
      ledgerStatus: string;
      ledgerAmount: number;
      ledgerUtmSource: string;
      ledgerUtmMedium: string;
      ledgerTikTokMatchReasons: string[];
    }>;
  };
  tiktok_event_log: {
    source: "operational_vm_tiktok_pixel_events";
    storage: string;
    startAt: string;
    endAt: string;
    fetchedEvents: number;
    uniqueOrderKeys: number;
    countsByAction: Record<string, number>;
    countsByDecisionStatus: Record<string, number>;
    countsByDecisionBranch: Record<string, number>;
    finalActionSummary: {
      releasedConfirmedPurchase: number;
      blockedPendingPurchase: number;
      sentReplacementPlaceAnOrder: number;
      releasedUnknownPurchase: number;
      requestError: number;
      missingFinalActionOrders: number;
      anomalyCount: number;
      warningCount: number;
    };
    sampleOrders: TikTokPixelEventOrder[];
    anomalies: string[];
    warnings: string[];
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
  daily_comparison: {
    source: string;
    summary: DailyComparisonSummary;
    guardBreakdown: Record<"pre_guard" | "guard_start_and_after", Omit<DailyComparisonSummary, "daysWithSpend" | "canceledRevenue">>;
    rows: DailyComparisonRow[];
  };
  warnings: string[];
  notes: string[];
};

type MetaRoasSummary = {
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  orders: number;
  general?: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
  };
  coop?: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    campaignCount: number;
  };
};

type MetaRoasResponse = {
  ok: boolean;
  error?: string;
  summary?: MetaRoasSummary;
};

type GoogleAdsDashboardResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    cost: number;
    conversionValue: number;
    roas: number | null;
  };
  internal?: {
    summary?: {
      confirmedOrders: number;
      confirmedRevenue: number;
      platformCost: number;
      platformConversionValue: number;
      platformRoas: number | null;
      internalConfirmedRoas: number | null;
    };
    confirmedOrders?: number;
    confirmedRevenue?: number;
    platformCost?: number;
    platformConversionValue?: number;
    platformRoas?: number | null;
    internalConfirmedRoas?: number | null;
  };
};

type GoogleBenchmark = {
  cost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRevenue: number;
  internalConfirmedOrders: number;
  internalConfirmedRoas: number | null;
};

type ChannelBenchmarkState = {
  loading: boolean;
  checkedAt: string | null;
  meta: MetaRoasSummary | null;
  google: GoogleBenchmark | null;
  error: string | null;
};

const DEFAULT_RANGE = {
  startDate: "2026-04-18",
  endDate: "2026-04-24",
};

const META_BIOCOM_ACCOUNT_ID = "act_3138805896402376";
const META_REPORTING_API_BASE = "https://att.ainativeos.net";
const GROWTH_STRATEGY_DATE_PRESET = "last_7d";
const GROWTH_STRATEGY_WINDOW_LABEL = "최근 7일";

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

const fmtCompactKRW = (value: number | null | undefined) => {
  if (value == null) return "-";
  const absolute = Math.abs(value);
  if (absolute >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
  if (absolute >= 10000) return `${Math.round(value / 10000)}만`;
  return fmtNum(value);
};

const fmtDailyAdsKRW = (row: DailyComparisonRow, value: number | null | undefined) =>
  row.hasAdsData ? fmtKRW(value) : "데이터 없음";

const fmtDailyAdsCompactKRW = (row: DailyComparisonRow, value: number | null | undefined) =>
  row.hasAdsData ? fmtCompactKRW(value) : "데이터 없음";

const fmtDailyAdsRoas = (row: DailyComparisonRow, value: number | null | undefined) =>
  row.hasAdsData ? fmtRoas(value) : "-";

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

const precisionTone = (tier: "high" | "medium" | "low"): Tone => {
  if (tier === "high") return "green";
  if (tier === "medium") return "amber";
  return "red";
};

const fateLabel = (fate: PendingAuditOrder["fate"]) => ({
  confirmed_later: "후속 입금",
  expired_unpaid: "미입금 만료",
  canceled: "취소",
  false_attribution: "오귀속",
  still_pending: "대기",
}[fate] ?? fate);

const fateTone = (fate: PendingAuditOrder["fate"]): Tone => {
  if (fate === "confirmed_later") return "green";
  if (fate === "still_pending") return "amber";
  if (fate === "expired_unpaid" || fate === "canceled" || fate === "false_attribution") return "red";
  return "neutral";
};

const reasonLabel = (reason: string) => ({
  ttclid_direct: "ttclid 직접",
  ttclid_url: "URL ttclid",
  metadata_ttclid_url: "metadata ttclid",
  utm_source_tiktok: "UTM source",
  utm_medium_tiktok: "UTM medium",
  utm_campaign_tiktok: "UTM campaign",
  utm_content_tiktok: "UTM content",
  utm_term_tiktok: "UTM term",
  landing_tiktok: "landing URL",
  referrer_tiktok: "referrer",
  metadata_url_tiktok: "metadata URL",
}[reason] ?? reason);

const formatReasons = (reasons: string[]) =>
  reasons.length ? reasons.map(reasonLabel).join(", ") : "-";

const pixelActionLabel = (action: string) => ({
  purchase_intercepted: "Purchase 감지",
  decision_received: "판정 수신",
  released_confirmed_purchase: "확정 Purchase 허용",
  released_unknown_purchase: "unknown fail-open",
  blocked_pending_purchase: "pending Purchase 차단",
  sent_replacement_place_an_order: "PlaceAnOrder 대체",
  request_error: "판정 요청 실패",
}[action] ?? action);

const pixelActionTone = (action: string): Tone => {
  if (action === "released_confirmed_purchase") return "green";
  if (action === "blocked_pending_purchase" || action === "sent_replacement_place_an_order") return "blue";
  if (action === "released_unknown_purchase" || action === "request_error") return "red";
  return "neutral";
};

const guardPhaseLabel = (phase: DailyComparisonRow["guardPhase"]) => ({
  pre_guard: "Guard 전",
  guard_start: "Guard 적용일",
  post_guard: "Guard 후",
}[phase]);

const formatRoasTooltip = (value: unknown, name: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return [
    Number.isFinite(numeric) ? fmtRoas(numeric) : String(value),
    String(name),
  ] as [string, string];
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
  const [dailyRevenueMode, setDailyRevenueMode] = useState<"confirmed" | "potential">("potential");
  const [data, setData] = useState<TikTokRoasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [benchmarks, setBenchmarks] = useState<ChannelBenchmarkState>({
    loading: true,
    checkedAt: null,
    meta: null,
    google: null,
    error: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadBenchmarks = async () => {
      setBenchmarks((previous) => ({ ...previous, loading: true, error: null }));

      const [metaResult, googleResult] = await Promise.allSettled([
        fetch(
          `${META_REPORTING_API_BASE}/api/ads/roas?account_id=${META_BIOCOM_ACCOUNT_ID}&date_preset=${GROWTH_STRATEGY_DATE_PRESET}`,
          { cache: "no-store" },
        ).then(async (response) => {
          const payload = (await response.json()) as MetaRoasResponse;
          if (!response.ok || payload.ok !== true) {
            throw new Error(payload.error ?? `Meta HTTP ${response.status}`);
          }
          return payload.summary ?? null;
        }),
        fetch(`${API_BASE_URL}/api/google-ads/dashboard?date_preset=${GROWTH_STRATEGY_DATE_PRESET}`, {
          cache: "no-store",
        }).then(async (response) => {
          const payload = (await response.json()) as GoogleAdsDashboardResponse;
          if (!response.ok || payload.ok !== true) {
            throw new Error(payload.error ?? `Google HTTP ${response.status}`);
          }
          return payload;
        }),
      ]);

      if (canceled) return;

      const errors: string[] = [];
      const meta = metaResult.status === "fulfilled" ? metaResult.value : null;
      if (metaResult.status === "rejected") {
        errors.push(`Meta ${metaResult.reason instanceof Error ? metaResult.reason.message : "조회 실패"}`);
      }

      let google: GoogleBenchmark | null = null;
      if (googleResult.status === "fulfilled") {
        const payload = googleResult.value;
        const googleInternal = payload.internal?.summary ?? payload.internal;
        google = {
          cost: googleInternal?.platformCost ?? payload.summary?.cost ?? 0,
          platformConversionValue: googleInternal?.platformConversionValue ?? payload.summary?.conversionValue ?? 0,
          platformRoas: googleInternal?.platformRoas ?? payload.summary?.roas ?? null,
          internalConfirmedRevenue: googleInternal?.confirmedRevenue ?? 0,
          internalConfirmedOrders: googleInternal?.confirmedOrders ?? 0,
          internalConfirmedRoas: googleInternal?.internalConfirmedRoas ?? null,
        };
      } else {
        errors.push(`Google ${googleResult.reason instanceof Error ? googleResult.reason.message : "조회 실패"}`);
      }

      setBenchmarks({
        loading: false,
        checkedAt: new Date().toISOString(),
        meta,
        google,
        error: errors.length ? errors.join(" / ") : null,
      });
    };

    void loadBenchmarks();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const element = chartFrameRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      const width = Math.floor(element.getBoundingClientRect().width);
      setChartWidth(width > 0 ? Math.max(320, width) : 0);
    };

    updateWidth();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateWidth)
      : null;
    resizeObserver?.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

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
  const ga4CrossCheck = data?.ga4_cross_check;
  const ga4Totals = ga4CrossCheck?.totals;
  const ledger = data?.operational_ledger.byStatus;
  const confirmed = ledger?.confirmed ?? { rows: 0, orders: 0, amount: 0 };
  const pending = ledger?.pending ?? { rows: 0, orders: 0, amount: 0 };
  const canceled = ledger?.canceled ?? { rows: 0, orders: 0, amount: 0 };
  const pendingShare = useMemo(() => {
    const total = confirmed.orders + pending.orders + canceled.orders;
    return total > 0 ? pending.orders / total * 100 : null;
  }, [confirmed.orders, pending.orders, canceled.orders]);
  const availableRanges = data?.local_table.availableRanges ?? [];
  const rangeButtons = [
    {
      label: "v2 검증 포함",
      start_date: "2026-04-18",
      end_date: "2026-04-24",
      rows: 0,
      spend: summary?.spend ?? 0,
      purchaseValue: summary?.purchaseValue ?? 0,
    },
    ...availableRanges.filter((range) => !(range.start_date === "2026-04-18" && range.end_date === "2026-04-24")),
  ];
  const sourceReasonRows = Object.entries(data?.operational_ledger.sourceReasonSummary ?? {})
    .sort(([, left], [, right]) => right.amount - left.amount);
  const pendingAuditRows = data?.operational_ledger.pendingAuditTop20 ?? [];
  const pendingFateSummary = data?.operational_ledger.pendingFateSummary;
  const stillPending = pendingFateSummary?.still_pending ?? { rows: 0, orders: 0, amount: 0 };
  const expiredUnpaid = pendingFateSummary?.expired_unpaid ?? { rows: 0, orders: 0, amount: 0 };
  const stillPendingShare = pending.orders > 0 ? stillPending.orders / pending.orders * 100 : null;
  const precisionSummary = data?.operational_ledger.sourcePrecisionSummary ?? {
    high: { rows: 0, orders: 0, amount: 0 },
    medium: { rows: 0, orders: 0, amount: 0 },
    low: { rows: 0, orders: 0, amount: 0 },
  };
  const highConfidenceAmount = precisionSummary.high.amount;
  const broadAttributionAmount = precisionSummary.high.amount + precisionSummary.medium.amount + precisionSummary.low.amount;
  const lowConfidenceAmount = precisionSummary.low.amount;
  const unexplainedGap = Math.max(0, (summary?.purchaseValue ?? 0) - (confirmed.amount + pending.amount));
  const waterfallRows = [
    {
      label: "TikTok 플랫폼 구매값",
      value: summary?.purchaseValue ?? 0,
      detail: `${fmtNum(summary?.purchases)}건`,
      tone: "amber" as const,
    },
    {
      label: "내부 confirmed",
      value: confirmed.amount,
      detail: `${fmtNum(confirmed.orders)}건`,
      tone: confirmed.amount > 0 ? "green" as const : "red" as const,
    },
    {
      label: "내부 pending",
      value: pending.amount,
      detail: `${fmtNum(pending.orders)}건`,
      tone: "amber" as const,
    },
    {
      label: "설명 안 된 gap",
      value: unexplainedGap,
      detail: "플랫폼 구매값 - confirmed - pending",
      tone: unexplainedGap > 0 ? "red" as const : "green" as const,
    },
    {
      label: "High 근거 금액",
      value: highConfidenceAmount,
      detail: `${fmtNum(precisionSummary.high.orders)}건 · ttclid 직접/URL 근거`,
      tone: "green" as const,
    },
    {
      label: "Low 제외 후보",
      value: lowConfidenceAmount,
      detail: `${fmtNum(precisionSummary.low.orders)}건 · referrer/metadata 넓은 기준`,
      tone: lowConfidenceAmount > 0 ? "red" as const : "neutral" as const,
    },
  ];
  const dailyRows = useMemo(() => data?.daily_comparison.rows ?? [], [data?.daily_comparison.rows]);
  const dailySummary = data?.daily_comparison.summary;
  const dailyGuard = data?.daily_comparison.guardBreakdown;
  const dailyModeIsPotential = dailyRevenueMode === "potential";
  const dailySelectedRevenue = dailyModeIsPotential
    ? (dailySummary?.confirmedRevenue ?? 0) + (dailySummary?.pendingRevenue ?? 0)
    : dailySummary?.confirmedRevenue ?? 0;
  const dailySelectedRoas = dailyModeIsPotential ? dailySummary?.potentialRoas : dailySummary?.confirmedRoas;
  const dailySelectedGap = dailyModeIsPotential
    ? dailySummary?.platformMinusConfirmedAndPending
    : dailySummary?.platformMinusConfirmed;
  const dailyCtaPurchaseCount = dailySummary?.ctaPurchaseCount ?? summary?.ctaPurchaseCount ?? 0;
  const dailyEvtaPurchaseCount = dailySummary?.evtaPurchaseCount ?? summary?.evtaPurchaseCount ?? 0;
  const dailyVtaPurchaseCount = dailySummary?.vtaPurchaseCount ?? summary?.vtaPurchaseCount ?? 0;
  const dailyUnclassifiedPurchaseCount = dailySummary?.unclassifiedPurchaseCount
    ?? Math.max(0, (dailySummary?.platformPurchases ?? summary?.purchases ?? 0) - dailyCtaPurchaseCount - dailyEvtaPurchaseCount - dailyVtaPurchaseCount);
  const dailyAttributionSplitTotal = dailyCtaPurchaseCount + dailyEvtaPurchaseCount + dailyVtaPurchaseCount + dailyUnclassifiedPurchaseCount;
  const dailyChartRows = useMemo(() => dailyRows.map((row) => ({
    date: row.date.slice(5),
    platformRoas: row.hasAdsData ? row.platformRoas : null,
    internalRoas: row.hasAdsData ? (dailyModeIsPotential ? row.potentialRoas : row.confirmedRoas) : null,
  })), [dailyRows, dailyModeIsPotential]);
  const missingAdsDates = dailyRows
    .filter((row) => !row.hasAdsData)
    .map((row) => row.date);
  const adsCoverageText = data?.local_table.daily.minDate && data.local_table.daily.maxDate
    ? `${data.local_table.daily.minDate} ~ ${data.local_table.daily.maxDate}`
    : "미확인";

  const eventLog = data?.tiktok_event_log;
  const eventFinal = eventLog?.finalActionSummary;
  const guardVerified = Boolean(
    eventFinal
    && eventFinal.releasedConfirmedPurchase > 0
    && eventFinal.blockedPendingPurchase > 0
    && eventFinal.sentReplacementPlaceAnOrder > 0
    && eventFinal.releasedUnknownPurchase === 0
    && eventFinal.requestError === 0
    && eventFinal.anomalyCount === 0,
  );
  const eventLogTone: Tone = !eventLog
    ? "neutral"
    : eventFinal?.anomalyCount || eventFinal?.requestError || eventFinal?.releasedUnknownPurchase
      ? "red"
      : eventFinal?.warningCount || eventFinal?.missingFinalActionOrders
        ? "amber"
        : guardVerified
          ? "green"
          : "blue";

  const verdictTone: Tone = loading ? "neutral" : error ? "red" : guardVerified ? "green" : data?.gap.confirmedRevenue === 0 ? "red" : "amber";
  const verdict = loading
    ? "운영 VM 확인 중"
    : error
      ? "API 확인 필요"
      : guardVerified
        ? "v2 Guard 운영 검증 완료"
      : data?.gap.confirmedRevenue === 0
        ? "과거 TikTok ROAS 과대 가능성 매우 큼"
        : "확정매출 기준 gap 검토 필요";
  const tiktokSelectedSpend = summary?.spend ?? 0;
  const tiktokPlatformPurchaseValue = summary?.purchaseValue ?? 0;
  const tiktokInternalConfirmedRevenue = data?.gap.confirmedRevenue ?? confirmed.amount;
  const tiktokPaymentSuccessRows = data?.operational_ledger.tiktokPaymentSuccessRows ?? 0;
  const tiktokHasSpend = tiktokSelectedSpend > 0;
  const tiktokHasInternalConfirmed = tiktokInternalConfirmedRevenue > 0;
  const strategyConfidence = tiktokHasSpend && !tiktokHasInternalConfirmed && tiktokPaymentSuccessRows === 0
    ? 82
    : tiktokHasInternalConfirmed
      ? 64
      : 58;
  const strategyTone: Tone = tiktokHasInternalConfirmed ? "amber" : tiktokHasSpend ? "red" : "neutral";
  const resourceRecommendation = tiktokHasInternalConfirmed
    ? "TikTok 제한 검증"
    : "Meta/Google 우선";
  const tiktokStrategyReason = tiktokHasInternalConfirmed
    ? `TikTok 내부 confirmed가 ${fmtKRW(tiktokInternalConfirmedRevenue)} 발생했지만, 아직 소재팀 주력 채널로 올리기 전 표본 확대가 필요합니다.`
    : `TikTok은 선택 기간 광고비 ${fmtKRW(tiktokSelectedSpend)}를 쓰고 플랫폼 구매값 ${fmtKRW(tiktokPlatformPurchaseValue)}를 주장하지만, 운영 VM TikTok payment_success는 ${fmtNum(tiktokPaymentSuccessRows)}행입니다.`;
  const metaTone: Tone = benchmarks.meta?.roas == null
    ? "neutral"
    : benchmarks.meta.roas >= 1
      ? "green"
      : "amber";
  const googleTone: Tone = benchmarks.google?.internalConfirmedRoas == null
    ? "neutral"
    : benchmarks.google.internalConfirmedRoas > 0
      ? "amber"
      : "red";
  const benchmarkStatus = benchmarks.loading
    ? "Meta/Google 조회 중"
    : benchmarks.error
      ? `일부 조회 실패: ${benchmarks.error}`
      : `Meta VM / Google local ${fmtKst(benchmarks.checkedAt)} 확인`;

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
              {rangeButtons.length > 0 ? rangeButtons.map((range) => {
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
                    {"label" in range ? `${range.label}: ` : ""}{range.start_date} ~ {range.end_date}
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
                  : missingAdsDates.length > 0
                    ? `선택 기간 중 ${missingAdsDates.join(", ")} TikTok Ads 일별 데이터가 아직 로컬에 없습니다. 해당 날짜의 비용 0원은 실제 무집행 확정값이 아니라 미수집 표시입니다. 현재 Ads 일별 데이터 범위는 ${adsCoverageText}입니다.`
                  : guardVerified
                    ? `운영 VM tiktok_pixel_events 기준으로 확정 Purchase 허용 ${fmtNum(eventFinal?.releasedConfirmedPurchase)}건, pending Purchase 차단 ${fmtNum(eventFinal?.blockedPendingPurchase)}건, PlaceAnOrder 대체 ${fmtNum(eventFinal?.sentReplacementPlaceAnOrder)}건이 확인됐습니다. 이상 release, request error, final 누락은 없습니다.`
                    : `TikTok 플랫폼은 구매값 ${fmtKRW(summary?.purchaseValue)}와 ROAS ${fmtRoas(summary?.platformRoas)}를 보고하지만, 운영 VM 원장의 TikTok 귀속 confirmed 매출은 ${fmtKRW(data?.gap.confirmedRevenue)}입니다. pending ${fmtNum(pending.orders)}건 중 24시간 미만 대기는 ${fmtNum(stillPending.orders)}건이고, 24시간 초과 미입금 만료 후보는 ${fmtNum(expiredUnpaid.orders)}건 ${fmtKRW(expiredUnpaid.amount)}입니다.`}
            </p>
          </section>

          <section
            style={{
              border: `1px solid ${toneMap[strategyTone].border}`,
              borderRadius: 8,
              background: toneMap[strategyTone].background,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 860 }}>
                <h2 style={{ margin: 0, fontSize: "1.08rem", fontWeight: 900 }}>그로스 리소스 배분 판단</h2>
                <p style={{ margin: "8px 0 0", color: toneMap[strategyTone].text, fontSize: "0.84rem", lineHeight: 1.75 }}>
                  현재 팀 체계 변동 중에는 TikTok을 더 깊게 파기보다 Meta와 Google에서 먼저 위닝 소재를 찾고,
                  검증된 메시지를 TikTok용 숏폼으로 확장하는 순서가 더 안전합니다. TikTok은 중단 결론이 아니라
                  Guard·event log·CTA/VTA 분해 기준으로 낮은 비용의 검증 채널로 두는 판단입니다.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <StatusBadge tone={strategyTone}>추천: {resourceRecommendation}</StatusBadge>
                <StatusBadge tone="neutral">자신감 {strategyConfidence}%</StatusBadge>
                <StatusBadge tone={benchmarks.error ? "amber" : "neutral"}>{benchmarkStatus}</StatusBadge>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 10,
                marginTop: 15,
              }}
            >
              <MetricCard
                label="TikTok"
                value={loading ? "로딩 중" : resourceRecommendation}
                detail={loading ? "운영 VM과 Ads API를 조회하고 있습니다." : tiktokStrategyReason}
                tone={strategyTone}
              />
              <MetricCard
                label="TikTok CTA/VTA"
                value={loading ? "로딩 중" : `CTA ${fmtNum(dailyCtaPurchaseCount)} / VTA ${fmtNum(dailyVtaPurchaseCount)}`}
                detail={`선택 기간 ${fmtNum(dailyAttributionSplitTotal)}건 중 EVTA ${fmtNum(dailyEvtaPurchaseCount)}건, API 미분류 ${fmtNum(dailyUnclassifiedPurchaseCount)}건. 금액 분해는 TikTok API에서 아직 직접 제공되지 않습니다.`}
                tone={dailyCtaPurchaseCount > dailyVtaPurchaseCount ? "amber" : "red"}
              />
              <MetricCard
                label="GA4 TikTok 교차검증"
                value={loading ? "로딩 중" : fmtKRW(ga4Totals?.ledgerConfirmedAmount)}
                detail={
                  ga4CrossCheck?.available
                    ? `GA4 session-source 주문번호 ${fmtNum(ga4Totals?.ledgerConfirmedRows)}건이 운영 confirmed와 맞습니다. 단, 운영 ledger에서 TikTok 직접 근거는 ${fmtNum(ga4Totals?.confirmedWithTikTokLedgerSignals)}건입니다.`
                    : ga4CrossCheck?.warning ?? "GA4 transaction_id 교차검증 대기"
                }
                tone={(ga4Totals?.ledgerConfirmedAmount ?? 0) > 0 ? "amber" : "neutral"}
              />
              <MetricCard
                label={`Meta ${GROWTH_STRATEGY_WINDOW_LABEL}`}
                value={benchmarks.loading ? "조회 중" : fmtRoas(benchmarks.meta?.roas)}
                detail={
                  benchmarks.meta
                    ? `VM Attribution 기준 ${fmtKRW(benchmarks.meta.attributedRevenue)} / ${fmtKRW(benchmarks.meta.spend)} · ${fmtNum(benchmarks.meta.orders)}건`
                    : "VM 광고성과 API 조회값이 없으면 Meta 페이지에서 직접 확인합니다."
                }
                tone={metaTone}
              />
              <MetricCard
                label={`Google ${GROWTH_STRATEGY_WINDOW_LABEL}`}
                value={benchmarks.loading ? "조회 중" : fmtRoas(benchmarks.google?.internalConfirmedRoas)}
                detail={
                  benchmarks.google
                    ? `내부 confirmed ${fmtKRW(benchmarks.google.internalConfirmedRevenue)} / ${fmtKRW(benchmarks.google.cost)} · 플랫폼 ROAS ${fmtRoas(benchmarks.google.platformRoas)}`
                    : "Google Ads API 또는 내부 매칭 API 응답을 확인해야 합니다."
                }
                tone={googleTone}
              />
              <MetricCard
                label="센터/운영"
                value="회수 루프"
                detail="상담, 취소, 구매확정 피드백을 소재 브리프에 붙입니다. 플랫폼 ROAS보다 실제 결제와 후속 매출을 우선합니다."
                tone="blue"
              />
            </div>

            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead>
                  <tr style={{ background: "#ffffff", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>우선순위</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>역할</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>판단 기준</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>다음 액션</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>1</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>Meta / Google</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      내부 confirmed가 0원이 아니고, 소재별 피드백을 더 빨리 회수할 수 있습니다.
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      현재 소재를 채널별로 정리하고, 카드 결제 confirmed 기준으로 메시지·후킹·상품군을 선별합니다.
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>2</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>센터/운영</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      구매확정, 자동취소, 상담 품질은 플랫폼이 과대 보고하는 매출을 걸러내는 기준입니다.
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      취소 사유와 상담 전환을 소재 브리프에 붙이고, 광고 원장에는 confirmed 중심으로 반영합니다.
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>3</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>TikTok</td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      최근 데이터는 플랫폼 주장 구매와 내부 confirmed 사이의 gap이 큽니다.
                    </td>
                    <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                      7~14일은 소액·측정 유지로 보고, 내부 confirmed 발생 또는 CTA 중심 구매 확인 후 소재 제작량을 늘립니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section
            style={{
              border: `1px solid ${toneMap[eventLogTone].border}`,
              borderRadius: 8,
              background: toneMap[eventLogTone].background,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>v2 Guard 운영 이벤트 원장</h2>
                <p style={{ margin: "7px 0 0", color: toneMap[eventLogTone].text, fontSize: "0.82rem", lineHeight: 1.7 }}>
                  위치: 운영 VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events`. 카드 confirmed는 Purchase를 통과시키고, 가상계좌 pending은 Purchase를 막은 뒤 PlaceAnOrder로 낮춥니다.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <StatusBadge tone={eventLogTone}>
                  {guardVerified ? "검증 완료" : eventFinal?.anomalyCount ? "이상 확인 필요" : "관찰 중"}
                </StatusBadge>
                <StatusBadge tone="neutral">
                  기간: {startDate} ~ {endDate}
                </StatusBadge>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginTop: 14,
            }}>
              <MetricCard
                label="이벤트 row"
                value={loading ? "로딩 중" : fmtNum(eventLog?.fetchedEvents)}
                detail={`${fmtNum(eventLog?.uniqueOrderKeys)}개 주문키. row 수는 구매 수가 아니라 단계 로그 수`}
                tone="blue"
              />
              <MetricCard
                label="확정 Purchase 허용"
                value={loading ? "로딩 중" : fmtNum(eventFinal?.releasedConfirmedPurchase)}
                detail="decision confirmed / allow_purchase"
                tone="green"
              />
              <MetricCard
                label="pending Purchase 차단"
                value={loading ? "로딩 중" : fmtNum(eventFinal?.blockedPendingPurchase)}
                detail={`PlaceAnOrder 대체 ${fmtNum(eventFinal?.sentReplacementPlaceAnOrder)}건`}
                tone="blue"
              />
              <MetricCard
                label="이상 신호"
                value={loading ? "로딩 중" : fmtNum((eventFinal?.anomalyCount ?? 0) + (eventFinal?.requestError ?? 0) + (eventFinal?.releasedUnknownPurchase ?? 0))}
                detail={`warning ${fmtNum(eventFinal?.warningCount)}, final 누락 ${fmtNum(eventFinal?.missingFinalActionOrders)}`}
                tone={(eventFinal?.anomalyCount ?? 0) > 0 || (eventFinal?.requestError ?? 0) > 0 ? "red" : "green"}
              />
            </div>

            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead>
                  <tr style={{ background: "#ffffff", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>시간</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>최종 action</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>주문</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>금액</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>decision</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>전체 흐름</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: "#64748b" }}>이벤트 원장을 조회하고 있습니다.</td>
                    </tr>
                  ) : eventLog?.sampleOrders.length ? eventLog.sampleOrders.map((row) => (
                    <tr key={`${row.loggedAt}-${row.orderKey}`}>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {fmtKst(row.loggedAt)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <StatusBadge tone={pixelActionTone(row.finalAction)}>{pixelActionLabel(row.finalAction)}</StatusBadge>
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <strong>{row.orderKey}</strong>
                        <p style={{ margin: "5px 0 0", color: "#64748b" }}>{row.orderNo || "-"} · {row.paymentCode || "-"}</p>
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900 }}>
                        {fmtKRW(row.value)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        {row.decisionStatus} / {row.decisionBranch}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.55 }}>
                        {row.actions.map(pixelActionLabel).join(" -> ")}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: "#64748b" }}>선택 기간에 v2 이벤트 로그가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(eventLog?.anomalies.length || eventLog?.warnings.length) ? (
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: toneMap[eventLogTone].text, fontSize: "0.8rem", lineHeight: 1.75 }}>
                {[...(eventLog?.anomalies ?? []), ...(eventLog?.warnings ?? [])].map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p style={{ margin: "14px 0 0", color: toneMap[eventLogTone].text, fontSize: "0.8rem", lineHeight: 1.7 }}>
                현재 선택 기간에는 비정상 release, request error, final action 누락이 없습니다.
              </p>
            )}
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
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>ROAS Gap Waterfall</h2>
                <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
                  TikTok 구매값에서 내부 confirmed와 pending을 빼고, 남은 gap과 source precision을 나눠 봅니다.
                </p>
              </div>
              <StatusBadge tone="neutral">Broad 근거 합계 {fmtKRW(broadAttributionAmount)}</StatusBadge>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginTop: 14,
            }}>
              {waterfallRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    border: `1px solid ${toneMap[row.tone].border}`,
                    borderRadius: 8,
                    background: toneMap[row.tone].background,
                    padding: 14,
                  }}
                >
                  <div style={{ color: toneMap[row.tone].text, fontSize: "0.72rem", fontWeight: 900 }}>
                    {row.label}
                  </div>
                  <div style={{ marginTop: 7, fontSize: "1.05rem", fontWeight: 900, color: "#0f172a" }}>
                    {loading ? "로딩 중" : fmtKRW(row.value)}
                  </div>
                  <div style={{ marginTop: 5, color: "#64748b", fontSize: "0.72rem", lineHeight: 1.45 }}>
                    {row.detail}
                  </div>
                </div>
              ))}
            </div>
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
              label="24h 미만 pending"
              value={loading ? "로딩 중" : fmtKRW(stillPending.amount)}
              detail={`${fmtNum(stillPending.orders)}건. pending 중 ${fmtPct(stillPendingShare)}`}
              tone={stillPending.amount > 0 ? "amber" : "green"}
            />
            <MetricCard
              label="미입금 만료 후보"
              value={loading ? "로딩 중" : fmtKRW(expiredUnpaid.amount)}
              detail={`${fmtNum(expiredUnpaid.orders)}건. 원장 write 전에는 표시 보정값`}
              tone={expiredUnpaid.amount > 0 ? "red" : "neutral"}
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
              border: `1px solid ${toneMap[(ga4Totals?.ledgerConfirmedAmount ?? 0) > 0 ? "amber" : "neutral"].border}`,
              borderRadius: 8,
              background: toneMap[(ga4Totals?.ledgerConfirmedAmount ?? 0) > 0 ? "amber" : "neutral"].background,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>GA4 주문번호 교차검증</h2>
                <p style={{ margin: "7px 0 0", color: "#475569", fontSize: "0.82rem", lineHeight: 1.7 }}>
                  GA4 session source가 TikTok인 purchase를 `transaction_id`로 운영 VM Attribution 원장과 붙였습니다. 이 값은
                  strict internal confirmed를 대체하지 않고, TikTok 가능성을 보는 중간 신뢰 지표입니다.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <StatusBadge tone={(ga4Totals?.ledgerConfirmedAmount ?? 0) > 0 ? "amber" : "neutral"}>
                  운영 confirmed 매칭 {fmtKRW(ga4Totals?.ledgerConfirmedAmount)}
                </StatusBadge>
                <StatusBadge tone={(ga4Totals?.confirmedWithTikTokLedgerSignals ?? 0) > 0 ? "green" : "red"}>
                  TikTok 직접근거 {fmtNum(ga4Totals?.confirmedWithTikTokLedgerSignals)}건
                </StatusBadge>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                marginTop: 14,
              }}
            >
              <MetricCard
                label="GA4 TikTok 구매"
                value={loading ? "로딩 중" : fmtKRW(ga4Totals?.ga4Revenue)}
                detail={`${fmtNum(ga4Totals?.ga4Events)}회. GA4 sessionSource/sessionMedium 기준`}
                tone="blue"
              />
              <MetricCard
                label="주문번호 매칭 confirmed"
                value={loading ? "로딩 중" : fmtKRW(ga4Totals?.ledgerConfirmedAmount)}
                detail={`${fmtNum(ga4Totals?.ledgerConfirmedRows)}건. GA4 금액 ${fmtKRW(ga4Totals?.ledgerConfirmedRevenue)}와 대조`}
                tone="amber"
              />
              <MetricCard
                label="다른 채널 근거 충돌"
                value={loading ? "로딩 중" : `${fmtNum(ga4Totals?.confirmedWithOtherLedgerSource)}건`}
                detail="운영 ledger UTM/landing이 Meta, Naver, CRM 등으로 남은 주문"
                tone={(ga4Totals?.confirmedWithOtherLedgerSource ?? 0) > 0 ? "red" : "green"}
              />
              <MetricCard
                label="조인 불가/취소"
                value={loading ? "로딩 중" : `${fmtNum(ga4Totals?.noLedgerMatchRows)}건 / ${fmtNum(ga4Totals?.ledgerCanceledRows)}건`}
                detail={`transaction_id 없음 ${fmtNum(ga4Totals?.blankTransactionEvents)}회, NPay 형식 ${fmtNum(ga4Totals?.npayTransactionRows)}건`}
                tone={(ga4Totals?.noLedgerMatchRows ?? 0) > 0 ? "amber" : "neutral"}
              />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>일별 ROAS 추세</h2>
                <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
                  TikTok 일별 export와 운영 VM TikTok 주문을 KST 날짜 기준으로 맞췄습니다.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "confirmed" as const, label: "confirmed 기준" },
                  { key: "potential" as const, label: "confirmed+pending 기준" },
                ].map((option) => {
                  const active = dailyRevenueMode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setDailyRevenueMode(option.key)}
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
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <StatusBadge tone="blue">일자 {fmtNum(dailySummary?.days)}개</StatusBadge>
              <StatusBadge tone="neutral">광고비 {fmtKRW(dailySummary?.platformSpend)}</StatusBadge>
              <StatusBadge tone="amber">플랫폼 ROAS {fmtRoas(dailySummary?.platformRoas)}</StatusBadge>
              <StatusBadge tone={dailyCtaPurchaseCount > 0 ? "amber" : "neutral"}>
                CTA {fmtNum(dailyCtaPurchaseCount)}건
              </StatusBadge>
              <StatusBadge tone={dailyVtaPurchaseCount > 0 ? "red" : "neutral"}>
                VTA {fmtNum(dailyVtaPurchaseCount)}건
              </StatusBadge>
              <StatusBadge tone={dailyUnclassifiedPurchaseCount > 0 ? "amber" : "neutral"}>
                API 미분류 {fmtNum(dailyUnclassifiedPurchaseCount)}건
              </StatusBadge>
              <StatusBadge tone={dailySelectedRevenue > 0 ? "green" : "red"}>
                운영 기준 매출 {fmtKRW(dailySelectedRevenue)}
              </StatusBadge>
              <StatusBadge tone={dailySelectedRoas && dailySelectedRoas > 0 ? "green" : "red"}>
                운영 ROAS {fmtRoas(dailySelectedRoas)}
              </StatusBadge>
              <StatusBadge tone="red">선택 기준 gap {fmtKRW(dailySelectedGap)}</StatusBadge>
              <StatusBadge tone={missingAdsDates.length > 0 ? "amber" : "green"}>
                Ads 데이터 범위 {adsCoverageText}
              </StatusBadge>
            </div>

            {dailyGuard ? (
              <p style={{ margin: "12px 0 0", color: "#475569", fontSize: "0.8rem", lineHeight: 1.7 }}>
                Guard 전 {fmtNum(dailyGuard.pre_guard.days)}일은 플랫폼 ROAS {fmtRoas(dailyGuard.pre_guard.platformRoas)},
                운영 potential ROAS {fmtRoas(dailyGuard.pre_guard.potentialRoas)}입니다. Guard 적용일 이후는
                {fmtNum(dailyGuard.guard_start_and_after.days)}일이며 플랫폼 구매값은 {fmtKRW(dailyGuard.guard_start_and_after.platformPurchaseValue)}입니다.
              </p>
            ) : null}

            {missingAdsDates.length > 0 ? (
              <p style={{ margin: "10px 0 0", color: "#92400e", fontSize: "0.8rem", lineHeight: 1.7 }}>
                {missingAdsDates.join(", ")}은 TikTok Ads 일별 데이터가 아직 적재되지 않았습니다. 아래 표의 `데이터 없음`은 실제 비용 0원이 아니라 수집 공백입니다.
              </p>
            ) : null}

            <div ref={chartFrameRef} style={{ width: "100%", height: 300, marginTop: 18, overflowX: "auto" }}>
              {mounted && chartWidth > 0 ? (
                <LineChart width={chartWidth} height={300} data={dailyChartRows} margin={{ top: 12, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tickFormatter={(value: number) => `${value.toFixed(0)}x`} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip formatter={formatRoasTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="platformRoas"
                    name="TikTok 플랫폼 ROAS"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="internalRoas"
                    name={dailyModeIsPotential ? "운영 potential ROAS" : "운영 confirmed ROAS"}
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    color: "#64748b",
                    fontSize: "0.8rem",
                  }}
                >
                  차트 준비 중
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>날짜</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>구분</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>비용</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>플랫폼 구매값</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>CTA</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>VTA</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>미분류</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>플랫폼 ROAS</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>운영 기준 매출</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>운영 ROAS</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>gap</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.length ? dailyRows.map((row) => {
                    const internalRevenue = dailyModeIsPotential
                      ? row.confirmedRevenue + row.pendingRevenue
                      : row.confirmedRevenue;
                    const internalRoas = dailyModeIsPotential ? row.potentialRoas : row.confirmedRoas;
                    const gap = dailyModeIsPotential ? row.platformMinusConfirmedAndPending : row.platformMinusConfirmed;
                    return (
                      <tr key={row.date}>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>
                          {row.date}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {guardPhaseLabel(row.guardPhase)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtDailyAdsCompactKRW(row, row.spend)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtDailyAdsKRW(row, row.platformPurchaseValue)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {row.hasAdsData ? fmtNum(row.ctaPurchaseCount) : "-"}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {row.hasAdsData ? fmtNum(row.vtaPurchaseCount) : "-"}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {row.hasAdsData ? fmtNum(row.unclassifiedPurchaseCount) : "-"}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900 }}>
                          {fmtDailyAdsRoas(row, row.platformRoas)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtKRW(internalRevenue)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtDailyAdsRoas(row, internalRoas)}
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtDailyAdsKRW(row, gap)}
                        </td>
                      </tr>
                    );
                  }) : (
	                    <tr>
	                      <td colSpan={11} style={{ padding: 14, color: "#64748b" }}>일별 비교 행이 없습니다.</td>
	                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>캠페인별 TikTok 주장 ROAS</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
                TikTok Ads/API가 캠페인에 귀속한 구매값 기준입니다. 내부 확정매출 ROAS가 아니며, 기간 합계가 없으면 일자별 campaign 데이터를 합산합니다.
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
                    <th style={{ textAlign: "right", padding: "11px 14px", borderBottom: "1px solid #e2e8f0" }}>TikTok 주장 ROAS</th>
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
            <article style={{ border: "1px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4", padding: 18 }}>
              <h3 style={{ margin: 0, color: "#166534", fontSize: "0.95rem", fontWeight: 900 }}>일자별 export 계약</h3>
              <p style={{ margin: "10px 0 0", color: "#166534", fontSize: "0.82rem", lineHeight: 1.75 }}>
                `{data?.local_table.daily.name ?? "tiktok_ads_daily"}`에 일자별 export를 적재했습니다.
                현재 행은 {fmtNum(data?.local_table.daily.rows)}개이고, 이번 호출 upsert는 {fmtNum(data?.local_table.daily.importedRows)}행입니다.
                {data?.local_table.daily.note ? ` ${data.local_table.daily.note}` : ""}
              </p>
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            <article style={{ border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 900 }}>TikTok 분류 사유</h2>
              <p style={{ margin: "8px 0 14px", color: "#64748b", fontSize: "0.78rem", lineHeight: 1.65 }}>
                극단적인 gap을 바로 결론으로 쓰지 않기 위해, TikTok 귀속으로 잡힌 이유를 분리했습니다.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: "0.76rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569" }}>
                      <th style={{ textAlign: "left", padding: "9px 10px", borderBottom: "1px solid #e2e8f0" }}>사유</th>
                      <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: "1px solid #e2e8f0" }}>주문</th>
                      <th style={{ textAlign: "right", padding: "9px 10px", borderBottom: "1px solid #e2e8f0" }}>금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceReasonRows.length ? sourceReasonRows.map(([reason, aggregate]) => (
                      <tr key={reason}>
                        <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>
                          {reasonLabel(reason)}
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtNum(aggregate.orders)}
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          {fmtKRW(aggregate.amount)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} style={{ padding: 12, color: "#64748b" }}>분류 사유가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article style={{ border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", padding: 18 }}>
              <h2 style={{ margin: 0, color: "#92400e", fontSize: "1rem", fontWeight: 900 }}>표본 감정 기준</h2>
              <p style={{ margin: "10px 0 0", color: "#92400e", fontSize: "0.82rem", lineHeight: 1.75 }}>
                pending 상위 20건을 금액순으로 뽑았습니다. `ttclid`가 있으면 high, UTM만 있으면 medium,
                URL·metadata 텍스트만 있으면 low로 표시합니다. 바이오컴 가상계좌는 주문 후 24시간 이내 미입금 시 취소되므로,
                24시간이 지난 pending은 미입금 만료로 표시합니다.
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
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900 }}>pending 상위 20건 감정</h2>
            <p style={{ margin: "8px 0 14px", color: "#64748b", fontSize: "0.8rem", lineHeight: 1.65 }}>
              API 승인 전에도 source precision과 pending fate를 확인할 수 있는 최소 표본입니다.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: "0.76rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>시간</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>경과</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>정밀도</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>fate</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>주문번호</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>금액</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>분류 사유</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>근거</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAuditRows.length ? pendingAuditRows.map((row) => (
                    <tr key={`${row.loggedAt}-${row.orderId}-${row.paymentKey}`}>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {fmtKst(row.loggedAt)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {typeof row.ageHours === "number" ? `${row.ageHours.toFixed(1)}h` : "-"}
                        {row.overVirtualAccountExpiry ? (
                          <span style={{ display: "block", marginTop: 4, color: "#b91c1c", fontWeight: 800 }}>24h 초과</span>
                        ) : null}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <StatusBadge tone={precisionTone(row.precisionTier)}>{row.precisionTier}</StatusBadge>
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <StatusBadge tone={fateTone(row.fate)}>{fateLabel(row.fate)}</StatusBadge>
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>{row.orderId}</td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 900 }}>
                        {fmtKRW(row.amount)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        {formatReasons(row.sourceMatchReasons)}
                      </td>
                      <td style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word", color: "#64748b" }}>
                        {row.evidence || "-"}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} style={{ padding: 14, color: "#64748b" }}>pending audit 대상이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
