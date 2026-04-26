"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type GoogleAdsRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  conversionAction: string;
};

type ParsedCsv = {
  fileName: string;
  headers: string[];
  rows: GoogleAdsRow[];
  missingFields: string[];
  skippedRows: number;
};

type CampaignSummary = {
  key: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  roas: number | null;
  cvr: number | null;
};

type DailySummary = {
  date: string;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number | null;
};

type ConversionActionSummary = {
  action: string;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number | null;
};

type GoogleAdsLiveCampaign = {
  campaignId: string;
  campaignName: string;
  status: string;
  channel: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
};

type GoogleAdsLiveDaily = {
  date: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  roas: number | null;
};

type GoogleAdsLiveConversionAction = {
  id: string;
  name: string;
  status: string;
  type: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  clickThroughLookbackWindowDays: number | null;
  viewThroughLookbackWindowDays: number | null;
  defaultValue: number | null;
  alwaysUseDefaultValue: boolean;
  sendTo: string[];
  conversionId: string | null;
  conversionLabels: string[];
};

type GoogleAdsInternalCampaign = {
  campaignId: string | null;
  campaignName: string;
  platformCost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRoas: number | null;
  roasGap: number | null;
  matchStatus: "matched" | "internal_only" | "platform_only" | "unknown_campaign";
  examples: string[];
  orders: number;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
};

type GoogleAdsInternalDaily = {
  date: string;
  platformCost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRevenue: number;
  internalConfirmedRoas: number | null;
  pendingRevenue: number;
  canceledRevenue: number;
  confirmedOrders: number;
  orders: number;
};

type GoogleAdsInternalSummary = {
  orders: number;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
  platformCost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRoas: number | null;
  roasGap: number | null;
  platformMinusConfirmedRevenue: number;
  matchedCampaignOrders: number;
  unknownCampaignOrders: number;
  campaignIdCoverage: number | null;
};

type GoogleAdsInternalReconciliation = {
  dataSource: "operational_vm_ledger" | "local_attribution_ledger";
  source: string;
  fetchedAt: string;
  latestLoggedAt: string | null;
  dateRange: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
  warnings: string[];
  summary: GoogleAdsInternalSummary;
  campaigns: GoogleAdsInternalCampaign[];
  internalOnlyCampaigns: GoogleAdsInternalCampaign[];
  daily: GoogleAdsInternalDaily[];
};

type GoogleAdsConversionActionSegmentAction = {
  conversionActionResourceName: string;
  conversionActionId: string | null;
  conversionActionName: string;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  status: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  sendTo: string[];
  conversionLabels: string[];
  classification: string;
  riskFlags: string[];
  campaignCount: number;
  campaigns: string[];
  shareOfPlatformConversionValue: number | null;
  shareOfAllConversionValue: number | null;
};

type GoogleAdsConversionActionGapDriver = {
  key: string;
  label: string;
  value: number;
  shareOfPlatformConversionValue: number | null;
  confidence: "high" | "medium-high" | "medium";
  evidence: string;
  nextAction: string;
};

type GoogleAdsConversionActionSegments = {
  summary: {
    primaryConversionValue: number;
    allConversionValue: number;
    allConversionValueMinusPlatform: number;
    platformMinusInternalConfirmed: number;
    primaryKnownNpayConversionValue: number;
    knownNpayAllConversionValue: number;
    knownNpayAllOnlyConversionValue: number;
    purchasePrimaryConversionValue: number;
    nonPurchasePrimaryConversionValue: number;
    gapAfterRemovingKnownNpayPrimary: number;
    viewThroughConversions: number;
    purchaseViewThroughConversions: number;
    primaryKnownNpayShareOfPlatform: number | null;
    allConversionValueMinusInternalConfirmed: number;
  };
  actions: GoogleAdsConversionActionSegmentAction[];
  campaignRows: Array<GoogleAdsConversionActionSegmentAction & {
    campaignId: string;
    campaignName: string;
    channel: string;
  }>;
  gapDrivers: GoogleAdsConversionActionGapDriver[];
};

type GoogleAdsDashboardResponse = {
  ok: boolean;
  fetchedAt: string;
  apiVersion: string;
  customerId: string;
  datePreset: GoogleAdsDatePreset;
  dateRangeLiteral: string;
  source: "google_ads_api";
  customer: {
    id?: string;
    descriptiveName?: string;
    status?: string;
  } | null;
  summary: {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    allConversions: number;
    allConversionValue: number;
    viewThroughConversions: number;
    roas: number | null;
    ctr: number | null;
    cvr: number | null;
  };
  campaigns: GoogleAdsLiveCampaign[];
  daily: GoogleAdsLiveDaily[];
  conversionActions: GoogleAdsLiveConversionAction[];
  conversionActionSegments?: GoogleAdsConversionActionSegments;
  internal?: GoogleAdsInternalReconciliation;
  diagnostics: {
    campaignRows: number;
    dailyRows: number;
    conversionActionRows: number;
    conversionActionMetricRows?: number;
    truncated: {
      campaigns: boolean;
      daily: boolean;
      conversionActions: boolean;
      conversionActionMetrics?: boolean;
    };
  };
};

const REQUIRED_FIELDS = [
  "date",
  "campaignName",
  "cost",
  "conversions",
  "conversionValue",
] as const;

const FIELD_ALIASES: Record<string, string[]> = {
  date: ["date", "day", "일", "날짜", "기간", "일자"],
  campaignName: ["campaign", "campaign name", "campaignname", "캠페인", "캠페인 이름", "캠페인명"],
  campaignId: ["campaign id", "campaignid", "campaign id", "캠페인 id", "캠페인 ID", "캠페인 아이디"],
  campaignType: [
    "campaign type",
    "advertising channel type",
    "advertisingchanneltype",
    "channel type",
    "캠페인 유형",
    "광고 채널 유형",
    "광고 채널",
  ],
  cost: ["cost", "cost (krw)", "costkrw", "비용", "광고비", "비용 원", "costs"],
  impressions: ["impr.", "impressions", "노출수", "노출"],
  clicks: ["clicks", "클릭수", "클릭"],
  conversions: ["conversions", "conv.", "전환", "전환수"],
  conversionValue: [
    "conv. value",
    "conversion value",
    "conversionvalue",
    "전환 가치",
    "전환값",
    "전환 가치 합계",
  ],
  allConversions: ["all conv.", "all conversions", "allconversions", "모든 전환", "전체 전환"],
  allConversionValue: [
    "all conv. value",
    "all conversion value",
    "allconversionvalue",
    "모든 전환 가치",
    "전체 전환 가치",
  ],
  viewThroughConversions: [
    "view-through conv.",
    "view-through conversions",
    "viewthroughconversions",
    "조회 후 전환",
    "조회 후 전환수",
    "뷰스루 전환",
  ],
  conversionAction: [
    "conversion action",
    "conversion action name",
    "conversionaction",
    "전환 액션",
    "전환 액션 이름",
    "전환 작업",
  ],
};

const DATE_PRESETS = [
  { value: "last_7d", label: "7일" },
  { value: "last_14d", label: "14일" },
  { value: "last_30d", label: "30일" },
  { value: "last_90d", label: "90일" },
] as const;

type GoogleAdsDatePreset = typeof DATE_PRESETS[number]["value"];

const API_READINESS = [
  { label: "MCC", value: "454-088-2676", status: "ready" },
  { label: "Google Cloud", value: "seo-aeo-487113", status: "ready" },
  { label: "Service account", value: "read-only added", status: "ready" },
  { label: "Developer token", value: "Explorer Access active", status: "ready" },
];

const AUTO_QUERIES = [
  {
    name: "전환 액션 목록",
    source: "conversion_action",
    fields: "name, status, type, category, primary_for_goal, counting_type, windows",
    blockedBy: "live 연결됨",
  },
  {
    name: "캠페인 일별 성과",
    source: "campaign + metrics + segments.date",
    fields: "cost, clicks, conversions, conversion_value, view_through_conversions",
    blockedBy: "live 연결됨",
  },
  {
    name: "전환 액션별 ROAS",
    source: "segments.conversion_action",
    fields: "conversion value by action, primary/secondary 분리",
    blockedBy: "live 연결됨",
  },
];

const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtRoas = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}x`);
const fmtSignedRoas = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}x`);
const fmtChartRoas = (v: string | number | undefined) => `${Number(v ?? 0).toFixed(2)}x`;
const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[₩$€£]/g, "")
    .replace(/[()\[\]{}]/g, "")
    .replace(/[._\-/,%:]/g, "")
    .replace(/\s+/g, "");

const normalizeAlias = (value: string) => normalizeHeader(value);

const findColumnIndex = (headers: string[], field: string) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const aliases = (FIELD_ALIASES[field] ?? [field]).map(normalizeAlias);
  return normalizedHeaders.findIndex((header) => aliases.includes(header));
};

const parseCurrencyNumber = (value: string | undefined) => {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "--" || trimmed === "—") return 0;
  const negative = /^\(.*\)$/.test(trimmed) || /^-/.test(trimmed);
  const cleaned = trimmed
    .replace(/[,%₩$€£원\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const normalizeDate = (value: string | undefined) => {
  if (!value) return "";
  const trimmed = value.trim();
  const korean = trimmed.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (korean) {
    const [, y, m, d] = korean;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
};

const parseGoogleAdsCsv = (text: string, fileName: string): ParsedCsv => {
  const rawRows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rawRows.length === 0) {
    return { fileName, headers: [], rows: [], missingFields: [...REQUIRED_FIELDS], skippedRows: 0 };
  }

  const headerIndex = rawRows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.some((cell) => ["date", "날짜", "일", "기간"].includes(cell))
      && normalized.some((cell) => ["campaign", "campaignname", "캠페인", "캠페인이름", "캠페인명"].includes(cell));
  });

  const headers = rawRows[headerIndex >= 0 ? headerIndex : 0].map((cell) => cell.trim());
  const bodyRows = rawRows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);

  const indexes = {
    date: findColumnIndex(headers, "date"),
    campaignName: findColumnIndex(headers, "campaignName"),
    campaignId: findColumnIndex(headers, "campaignId"),
    campaignType: findColumnIndex(headers, "campaignType"),
    cost: findColumnIndex(headers, "cost"),
    impressions: findColumnIndex(headers, "impressions"),
    clicks: findColumnIndex(headers, "clicks"),
    conversions: findColumnIndex(headers, "conversions"),
    conversionValue: findColumnIndex(headers, "conversionValue"),
    allConversions: findColumnIndex(headers, "allConversions"),
    allConversionValue: findColumnIndex(headers, "allConversionValue"),
    viewThroughConversions: findColumnIndex(headers, "viewThroughConversions"),
    conversionAction: findColumnIndex(headers, "conversionAction"),
  };

  const missingFields = REQUIRED_FIELDS.filter((field) => indexes[field] < 0);
  const rows: GoogleAdsRow[] = [];
  let skippedRows = 0;

  bodyRows.forEach((raw) => {
    const get = (index: number) => (index >= 0 ? raw[index]?.trim() ?? "" : "");
    const campaignName = get(indexes.campaignName);
    const date = normalizeDate(get(indexes.date));
    const isTotalRow = /^(total|grand total|합계|총계)/i.test(campaignName)
      || /^(total|grand total|합계|총계)/i.test(date);

    if (!campaignName || isTotalRow) {
      skippedRows += 1;
      return;
    }

    rows.push({
      date,
      campaignId: get(indexes.campaignId),
      campaignName,
      campaignType: get(indexes.campaignType) || "Unknown",
      cost: parseCurrencyNumber(get(indexes.cost)),
      impressions: parseCurrencyNumber(get(indexes.impressions)),
      clicks: parseCurrencyNumber(get(indexes.clicks)),
      conversions: parseCurrencyNumber(get(indexes.conversions)),
      conversionValue: parseCurrencyNumber(get(indexes.conversionValue)),
      allConversions: parseCurrencyNumber(get(indexes.allConversions)),
      allConversionValue: parseCurrencyNumber(get(indexes.allConversionValue)),
      viewThroughConversions: parseCurrencyNumber(get(indexes.viewThroughConversions)),
      conversionAction: get(indexes.conversionAction) || "(not segmented)",
    });
  });

  return { fileName, headers, rows, missingFields, skippedRows };
};

const sumRows = (rows: GoogleAdsRow[]) => {
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  const conversionValue = rows.reduce((sum, row) => sum + row.conversionValue, 0);
  return {
    cost,
    impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    conversionValue,
    allConversions: rows.reduce((sum, row) => sum + row.allConversions, 0),
    allConversionValue: rows.reduce((sum, row) => sum + row.allConversionValue, 0),
    viewThroughConversions: rows.reduce((sum, row) => sum + row.viewThroughConversions, 0),
    roas: cost > 0 ? conversionValue / cost : null,
  };
};

const groupCampaigns = (rows: GoogleAdsRow[]): CampaignSummary[] => {
  const map = new Map<string, GoogleAdsRow[]>();
  rows.forEach((row) => {
    const key = row.campaignId || row.campaignName;
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return [...map.entries()]
    .map(([key, group]) => {
      const totals = sumRows(group);
      const first = group[0];
      return {
        key,
        campaignId: first.campaignId,
        campaignName: first.campaignName,
        campaignType: first.campaignType,
        ...totals,
        cvr: totals.clicks > 0 ? totals.conversions / totals.clicks : null,
      };
    })
    .sort((a, b) => b.cost - a.cost);
};

const groupDaily = (rows: GoogleAdsRow[]): DailySummary[] => {
  const map = new Map<string, GoogleAdsRow[]>();
  rows.forEach((row) => {
    if (!row.date) return;
    map.set(row.date, [...(map.get(row.date) ?? []), row]);
  });
  return [...map.entries()]
    .map(([date, group]) => {
      const totals = sumRows(group);
      return {
        date,
        cost: totals.cost,
        conversions: totals.conversions,
        conversionValue: totals.conversionValue,
        roas: totals.roas,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

const groupConversionActions = (rows: GoogleAdsRow[]): ConversionActionSummary[] => {
  const map = new Map<string, GoogleAdsRow[]>();
  rows.forEach((row) => {
    map.set(row.conversionAction, [...(map.get(row.conversionAction) ?? []), row]);
  });
  return [...map.entries()]
    .map(([action, group]) => {
      const totals = sumRows(group);
      return {
        action,
        cost: totals.cost,
        conversions: totals.conversions,
        conversionValue: totals.conversionValue,
        roas: totals.roas,
      };
    })
    .sort((a, b) => b.conversionValue - a.conversionValue);
};

function KpiCard({ label, value, sub, tone = "neutral" }: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "success" | "warn";
}) {
  const color = tone === "success" ? "#047857" : tone === "warn" ? "#b45309" : "#0f172a";
  const bg = tone === "success" ? "#ecfdf5" : tone === "warn" ? "#fffbeb" : "#ffffff";
  return (
    <div style={{
      padding: 18,
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      background: bg,
      boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    }}>
      <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", color, fontWeight: 900, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 6, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section style={{
      padding: 20,
      borderRadius: 14,
      border: "1px solid #e2e8f0",
      background: "#ffffff",
      boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1rem", fontWeight: 850 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function GoogleAdsPerformancePage() {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<GoogleAdsDatePreset>("last_30d");
  const [liveData, setLiveData] = useState<GoogleAdsDashboardResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);

  const loadLiveData = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/google-ads/dashboard?date_preset=${datePreset}`, {
        cache: "no-store",
      });
      const data = await res.json() as GoogleAdsDashboardResponse | { ok: false; error?: unknown; errors?: unknown };
      if (!res.ok || !data.ok) {
        throw new Error(JSON.stringify("error" in data ? data.error ?? data.errors : data).slice(0, 500));
      }
      setLiveData(data);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Google Ads live API 조회 실패");
    } finally {
      setLiveLoading(false);
    }
  }, [datePreset]);

  useEffect(() => {
    void loadLiveData();
  }, [loadLiveData]);

  const csvSummary = useMemo(() => sumRows(parsed?.rows ?? []), [parsed]);
  const csvCampaigns = useMemo(() => groupCampaigns(parsed?.rows ?? []), [parsed]);
  const csvDaily = useMemo(() => groupDaily(parsed?.rows ?? []), [parsed]);
  const csvConversionActions = useMemo(() => groupConversionActions(parsed?.rows ?? []), [parsed]);
  const liveCampaigns = useMemo<CampaignSummary[]>(() => (
    liveData?.campaigns.map((row) => ({
      key: row.campaignId || row.campaignName,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      campaignType: row.channel,
      cost: row.cost,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
      conversionValue: row.conversionValue,
      allConversions: row.allConversions,
      allConversionValue: row.allConversionValue,
      viewThroughConversions: row.viewThroughConversions,
      roas: row.roas,
      cvr: row.cvr,
    })) ?? []
  ), [liveData]);
  const liveDaily = useMemo<DailySummary[]>(() => (
    liveData?.daily.map((row) => ({
      date: row.date,
      cost: row.cost,
      conversions: row.conversions,
      conversionValue: row.conversionValue,
      roas: row.roas,
    })) ?? []
  ), [liveData]);
  const liveConversionActions = useMemo(() => {
    const score = (row: GoogleAdsLiveConversionAction) => {
      const name = `${row.name} ${row.category} ${row.conversionLabels.join(" ")}`;
      return (
        (row.status === "ENABLED" ? 100 : 0)
        + (row.category === "PURCHASE" ? 50 : 0)
        + (row.primaryForGoal ? 20 : 0)
        + (/구매|purchase|npay/i.test(name) ? 10 : 0)
        - (row.status === "HIDDEN" ? 20 : 0)
      );
    };

    return [...(liveData?.conversionActions ?? [])].sort((a, b) =>
      score(b) - score(a) || a.name.localeCompare(b.name, "ko"),
    );
  }, [liveData]);
  const internal = parsed ? null : liveData?.internal ?? null;
  const internalCampaignById = useMemo(() => {
    const map = new Map<string, GoogleAdsInternalCampaign>();
    (liveData?.internal?.campaigns ?? []).forEach((row) => {
      if (row.campaignId) map.set(row.campaignId, row);
    });
    return map;
  }, [liveData]);

  const summary = parsed ? csvSummary : liveData?.summary ?? csvSummary;
  const actionSegments = parsed ? null : liveData?.conversionActionSegments ?? null;
  const campaigns = parsed ? csvCampaigns : liveCampaigns;
  const daily = parsed ? csvDaily : liveDaily;
  const conversionActions = parsed ? csvConversionActions : [];
  const liveRiskyActions = liveConversionActions.filter((row) =>
    /npay|네이버|naver|click|클릭/i.test(`${row.name} ${row.conversionLabels.join(" ")}`),
  );
  const riskyActions = parsed
    ? conversionActions.filter((row) => /npay|네이버|naver|click|클릭/i.test(row.action))
    : liveRiskyActions.map((row) => ({ action: row.name }));
  const hasPerformanceData = campaigns.length > 0 || daily.length > 0;
  const sourceLabel = parsed ? "CSV 합계" : liveData ? "Google Ads API live" : liveLoading ? "API 조회 중" : "대기";

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParseError(null);
    try {
      const text = await file.text();
      const next = parseGoogleAdsCsv(text, file.name);
      setParsed(next);
      if (next.rows.length === 0) {
        setParseError("읽을 수 있는 캠페인 행이 없습니다. Google Ads 캠페인 보고서 CSV인지 확인이 필요합니다.");
      }
    } catch (error) {
      setParsed(null);
      setParseError(error instanceof Error ? error.message : "CSV 파싱 실패");
    }
  };

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main style={{ maxWidth: 1220, margin: "0 auto", padding: "32px 24px 48px", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            <Link href="/#ai-crm" style={{ fontSize: "0.78rem", color: "#2563eb", textDecoration: "none", fontWeight: 700 }}>
              ← AI CRM으로 돌아가기
            </Link>
            <h1 style={{ margin: "6px 0 6px", fontSize: "1.55rem", fontWeight: 900, color: "#0f172a" }}>
              Google Ads 광고성과 분석
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.84rem", lineHeight: 1.55 }}>
              Google Ads API 플랫폼 성과와 내부 confirmed 매출을 같은 기간으로 대조한다.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/ads" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #c7d2fe", color: "#4338ca", textDecoration: "none", fontSize: "0.76rem", fontWeight: 800 }}>
              Meta
            </Link>
            <Link href="/ads/tiktok" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #99f6e4", color: "#0f766e", textDecoration: "none", fontSize: "0.76rem", fontWeight: 800 }}>
              TikTok
            </Link>
            <Link href="/ads/roas" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", color: "#334155", textDecoration: "none", fontSize: "0.76rem", fontWeight: 800 }}>
              ROAS
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            background: liveError ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${liveError ? "#fecaca" : "#bbf7d0"}`,
            color: liveError ? "#991b1b" : "#166534",
            fontSize: "0.76rem",
            fontWeight: 800,
          }}>
            <span>{liveLoading ? "API 조회 중" : liveError ? "API 오류" : "API live"}</span>
            <span style={{ fontWeight: 600, color: liveError ? "#b91c1c" : "#15803d" }}>
              {liveError ? liveError : liveData ? `${liveData.customer?.descriptiveName ?? liveData.customerId} · ${liveData.dateRangeLiteral}` : "대기"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                style={{
                  padding: "7px 11px",
                  borderRadius: 8,
                  border: datePreset === preset.value ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: datePreset === preset.value ? "#eff6ff" : "#ffffff",
                  color: datePreset === preset.value ? "#1d4ed8" : "#475569",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => void loadLiveData()}
              disabled={liveLoading}
              style={{
                padding: "7px 11px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "0.76rem",
                fontWeight: 800,
                cursor: liveLoading ? "wait" : "pointer",
              }}
            >
              새로고침
            </button>
          </div>
        </div>

        <section style={{
          marginBottom: 18,
          padding: 20,
          borderRadius: 16,
          background: "linear-gradient(135deg, #0f172a 0%, #14532d 52%, #1d4ed8 100%)",
          color: "#f8fafc",
          boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "start" }}>
            <div>
              <div style={{ color: "#bfdbfe", fontSize: "0.72rem", letterSpacing: "0.06em", fontWeight: 900, textTransform: "uppercase" as const, marginBottom: 8 }}>
                Google Ads live read
              </div>
              <h2 style={{ margin: "0 0 8px", fontSize: "1.16rem", lineHeight: 1.35 }}>
                Explorer Access와 운영 원장을 연결했다. CSV는 수동 대조용이다.
              </h2>
              <p style={{ margin: 0, color: "#dbeafe", fontSize: "0.82rem", lineHeight: 1.65 }}>
                2026-04-25 기준 `customer`, `conversion_action`, 캠페인 성과 지표는 Google Ads API에서 읽고,
                내부 확정매출은 운영 attribution ledger에서 읽는다.
              </p>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {API_READINESS.map((item) => (
                <div key={item.label} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#ecfeff",
                  fontSize: "0.75rem",
                }}>
                  <strong>{item.label}</strong>
                  <span style={{ color: item.status === "ready" ? "#bbf7d0" : "#fde68a", textAlign: "right" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16, marginBottom: 16 }}>
          <Panel title="CSV 임시 분석">
            <label style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: 16,
              borderRadius: 12,
              border: "1px dashed #93c5fd",
              background: "#eff6ff",
              cursor: "pointer",
            }}>
              <div>
                <div style={{ color: "#1e3a8a", fontSize: "0.86rem", fontWeight: 900 }}>Google Ads 캠페인 보고서 CSV</div>
                <div style={{ color: "#64748b", fontSize: "0.74rem", marginTop: 4 }}>
                  date, campaign, cost, conversions, conv. value 기준으로 읽는다.
                </div>
              </div>
              <span style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: "0.76rem", fontWeight: 850 }}>
                파일 선택
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
            {parsed && (
              <div style={{ marginTop: 12, fontSize: "0.75rem", color: "#475569", lineHeight: 1.55 }}>
                <strong>{parsed.fileName}</strong> · 읽은 행 {fmtNum(parsed.rows.length)}개 · 건너뜀 {fmtNum(parsed.skippedRows)}개
                {parsed.missingFields.length > 0 && (
                  <div style={{ color: "#b45309", marginTop: 4 }}>
                    부족한 열: {parsed.missingFields.join(", ")}
                  </div>
                )}
              </div>
            )}
            {parseError && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: "0.76rem" }}>
                {parseError}
              </div>
            )}
          </Panel>

          <Panel title="API 자동화 대기열">
            <div style={{ display: "grid", gap: 8 }}>
              {AUTO_QUERIES.map((item) => (
                <div key={item.name} style={{ padding: 11, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ fontSize: "0.78rem", color: "#0f172a" }}>{item.name}</strong>
                    <span style={{ fontSize: "0.68rem", color: "#b45309", fontWeight: 850 }}>{item.blockedBy}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.7rem", lineHeight: 1.45, marginTop: 4 }}>
                    {item.source} · {item.fields}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, marginBottom: 16 }}>
          <KpiCard label="광고비" value={fmtKRW(summary.cost)} sub={sourceLabel} />
          <KpiCard label="전환수" value={fmtNum(summary.conversions)} sub="Conversions" />
          <KpiCard label="전환값" value={fmtKRW(summary.conversionValue)} sub="Conv. value" tone="success" />
          <KpiCard label="Google ROAS" value={fmtRoas(summary.roas)} sub="전환값 / 비용" tone={summary.roas != null && summary.roas >= 2 ? "success" : "neutral"} />
          <KpiCard label="조회 후 전환" value={fmtNum(summary.viewThroughConversions)} sub="보조 판단값" tone={summary.viewThroughConversions > 0 ? "warn" : "neutral"} />
          {internal && (
            <>
              <KpiCard label="내부 확정매출" value={fmtKRW(internal.summary.confirmedRevenue)} sub={`${internal.summary.confirmedOrders} confirmed`} tone="success" />
              <KpiCard label="내부 ROAS" value={fmtRoas(internal.summary.internalConfirmedRoas)} sub={internal.dataSource} tone={internal.summary.internalConfirmedRoas != null && internal.summary.internalConfirmedRoas < 1 ? "warn" : "neutral"} />
              <KpiCard label="ROAS 차이" value={fmtSignedRoas(internal.summary.roasGap)} sub="내부 - Google" tone={internal.summary.roasGap != null && internal.summary.roasGap < 0 ? "warn" : "neutral"} />
            </>
          )}
        </div>

        {internal && (
          <div style={{ marginBottom: 16 }}>
            <Panel
              title="Google Ads vs 내부 confirmed"
              action={(
                <span style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 750 }}>
                  {internal.dateRange.startDate} ~ {internal.dateRange.endDate} · {fmtDateTime(internal.latestLoggedAt)}
                </span>
              )}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10 }}>
                {[
                  ["Google 전환값", fmtKRW(internal.summary.platformConversionValue), "플랫폼 귀속"],
                  ["내부 confirmed", fmtKRW(internal.summary.confirmedRevenue), `${internal.summary.confirmedOrders}건`],
                  ["차이 금액", fmtKRW(internal.summary.platformMinusConfirmedRevenue), "Google - 내부"],
                  ["캠페인 ID 커버리지", fmtPct(internal.summary.campaignIdCoverage), `${internal.summary.unknownCampaignOrders}건 미확인`],
                  ["pending", fmtKRW(internal.summary.pendingRevenue), `${internal.summary.pendingOrders}건`],
                  ["canceled", fmtKRW(internal.summary.canceledRevenue), `${internal.summary.canceledOrders}건`],
                ].map(([label, value, sub]) => (
                  <div key={label} style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 800 }}>{label}</div>
                    <div style={{ color: "#0f172a", fontSize: "1rem", fontWeight: 900, marginTop: 4 }}>{value}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.68rem", marginTop: 3 }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, color: "#64748b", fontSize: "0.72rem", lineHeight: 1.5 }}>
                {internal.warnings.slice(0, 2).join(" ")}
              </div>
            </Panel>
          </div>
        )}

        {actionSegments && (
          <div style={{ marginBottom: 16 }}>
            <Panel
              title="전환 액션별 gap 분해"
              action={(
                <span style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: 750 }}>
                  Primary NPay {fmtPct(actionSegments.summary.primaryKnownNpayShareOfPlatform)}
                </span>
              )}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 10, marginBottom: 12 }}>
                {[
                  ["Primary NPay 전환값", fmtKRW(actionSegments.summary.primaryKnownNpayConversionValue), "입찰 ROAS에 직접 반영"],
                  ["내부 confirmed 차이", fmtKRW(actionSegments.summary.platformMinusInternalConfirmed), "Google - 내부"],
                  ["All conv. NPay 보조", fmtKRW(actionSegments.summary.knownNpayAllOnlyConversionValue), "ROAS 분자에는 제외"],
                  ["NPay 제거 후 잔차", fmtKRW(actionSegments.summary.gapAfterRemovingKnownNpayPrimary), "플랫폼 - NPay - 내부"],
                ].map(([label, value, sub]) => (
                  <div key={label} style={{ padding: 12, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div style={{ color: "#9a3412", fontSize: "0.68rem", fontWeight: 850 }}>{label}</div>
                    <div style={{ color: "#7c2d12", fontSize: "1rem", fontWeight: 950, marginTop: 4 }}>{value}</div>
                    <div style={{ color: "#c2410c", fontSize: "0.68rem", marginTop: 3 }}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                {actionSegments.gapDrivers.map((driver) => (
                  <div key={driver.key} style={{ padding: 11, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.78rem" }}>{driver.label}</strong>
                      <span style={{ color: "#b45309", fontSize: "0.72rem", fontWeight: 900 }}>
                        {fmtKRW(driver.value)} · {fmtPct(driver.shareOfPlatformConversionValue)}
                      </span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.7rem", lineHeight: 1.45, marginTop: 4 }}>
                      {driver.evidence} {driver.nextAction}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <thead>
                    <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      {["전환 액션", "분류", "Primary", "Conv. value", "All value", "전환", "조회 후", "라벨"].map((head) => (
                        <th key={head} style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actionSegments.actions.map((row) => (
                      <tr key={row.conversionActionResourceName || row.conversionActionName} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 8px", minWidth: 230 }}>
                          <strong style={{ color: "#0f172a" }}>{row.conversionActionName}</strong>
                          <div style={{ color: "#94a3b8", fontSize: "0.67rem", marginTop: 2 }}>{row.conversionActionId ?? "—"} · {row.category}</div>
                        </td>
                        <td style={{ padding: "10px 8px", color: row.riskFlags.length > 0 ? "#b45309" : "#475569", fontWeight: 850 }}>
                          {row.classification}
                          {row.riskFlags.length > 0 && (
                            <div style={{ color: "#d97706", fontSize: "0.66rem", marginTop: 2 }}>{row.riskFlags.join(", ")}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", color: row.primaryForGoal ? "#047857" : "#64748b", fontWeight: 850 }}>
                          {row.primaryForGoal ? "Y" : "N"}
                        </td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontWeight: 900 }}>{fmtKRW(row.conversionValue)}</td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.allConversionValue)}</td>
                        <td style={{ padding: "10px 8px" }}>{row.conversions.toFixed(2)} / {row.allConversions.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px" }}>{row.viewThroughConversions.toFixed(2)}</td>
                        <td style={{ padding: "10px 8px", minWidth: 180, color: "#64748b" }}>{row.conversionLabels.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {hasPerformanceData ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16 }}>
              <Panel title="일별 ROAS">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
                      <Tooltip formatter={fmtChartRoas} />
                      <Line type="monotone" dataKey="roas" name="ROAS" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="캠페인별 비용">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campaigns.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="campaignName" tick={{ fontSize: 10 }} interval={0} height={64} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`} />
                      <Tooltip formatter={(value) => fmtKRW(Number(value ?? 0))} />
                      <Bar dataKey="cost" name="비용" fill="#16a34a" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <Panel title="캠페인 ROAS 표">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                  <thead>
                    <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      {["캠페인", "유형", "비용", "전환", "전환값", "ROAS", "내부매출", "내부ROAS", "CVR", "조회 후"].map((head) => (
                        <th key={head} style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.slice(0, 20).map((row) => {
                      const internalRow = internalCampaignById.get(row.campaignId);
                      return (
                        <tr key={row.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 8px", minWidth: 240 }}>
                            <strong style={{ color: "#0f172a" }}>{row.campaignName}</strong>
                            {row.campaignId && <div style={{ color: "#94a3b8", fontSize: "0.68rem", marginTop: 2 }}>{row.campaignId}</div>}
                          </td>
                          <td style={{ padding: "10px 8px", color: "#64748b" }}>{row.campaignType}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.cost)}</td>
                          <td style={{ padding: "10px 8px" }}>{row.conversions.toFixed(2)}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.conversionValue)}</td>
                          <td style={{ padding: "10px 8px", color: row.roas != null && row.roas >= 2 ? "#047857" : "#0f172a", fontWeight: 900 }}>{fmtRoas(row.roas)}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{internalRow ? fmtKRW(internalRow.confirmedRevenue) : "—"}</td>
                          <td style={{ padding: "10px 8px", fontWeight: 900 }}>{internalRow ? fmtRoas(internalRow.internalConfirmedRoas) : "—"}</td>
                          <td style={{ padding: "10px 8px" }}>{fmtPct(row.cvr)}</td>
                          <td style={{ padding: "10px 8px" }}>{row.viewThroughConversions.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {internal && internal.internalOnlyCampaigns.length > 0 && (
              <Panel title="내부 원장 Google 유입 미매칭">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                    <thead>
                      <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        {["캠페인", "상태", "주문", "confirmed", "pending", "canceled", "UTM 예시"].map((head) => (
                          <th key={head} style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {internal.internalOnlyCampaigns.slice(0, 8).map((row) => (
                        <tr key={row.campaignId ?? row.campaignName} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 8px", minWidth: 230 }}>
                            <strong style={{ color: "#0f172a" }}>{row.campaignName}</strong>
                            {row.campaignId && <div style={{ color: "#94a3b8", fontSize: "0.68rem", marginTop: 2 }}>{row.campaignId}</div>}
                          </td>
                          <td style={{ padding: "10px 8px", color: "#b45309", fontWeight: 800 }}>{row.matchStatus}</td>
                          <td style={{ padding: "10px 8px" }}>{fmtNum(row.orders)}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.confirmedRevenue)}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.pendingRevenue)}</td>
                          <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{fmtKRW(row.canceledRevenue)}</td>
                          <td style={{ padding: "10px 8px", minWidth: 220, color: "#64748b" }}>{row.examples.join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            <Panel title="전환 액션 기준 점검">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
                <div style={{ overflowX: "auto" }}>
                  {parsed ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          {["전환 액션", "전환", "전환값", "ROAS"].map((head) => (
                            <th key={head} style={{ padding: "9px 8px" }}>{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {conversionActions.slice(0, 12).map((row) => (
                          <tr key={row.action} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 8px", color: "#0f172a", fontWeight: 750 }}>{row.action}</td>
                            <td style={{ padding: "10px 8px" }}>{row.conversions.toFixed(2)}</td>
                            <td style={{ padding: "10px 8px" }}>{fmtKRW(row.conversionValue)}</td>
                            <td style={{ padding: "10px 8px", fontWeight: 900 }}>{fmtRoas(row.roas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                      <thead>
                        <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          {["전환 액션", "상태", "목표", "전환 라벨", "기간"].map((head) => (
                            <th key={head} style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liveConversionActions.slice(0, 18).map((row) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 8px", color: "#0f172a", fontWeight: 750, minWidth: 220 }}>
                              {row.name}
                              <div style={{ color: "#94a3b8", fontSize: "0.68rem", marginTop: 2 }}>{row.id} · {row.category}</div>
                            </td>
                            <td style={{ padding: "10px 8px" }}>{row.status}</td>
                            <td style={{ padding: "10px 8px", color: row.primaryForGoal ? "#047857" : "#64748b", fontWeight: 850 }}>
                              {row.primaryForGoal ? "Primary" : "Secondary"}
                            </td>
                            <td style={{ padding: "10px 8px", minWidth: 180 }}>
                              {row.conversionLabels.length > 0 ? row.conversionLabels.join(", ") : "—"}
                            </td>
                            <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                              click {row.clickThroughLookbackWindowDays ?? "—"}d · view {row.viewThroughLookbackWindowDays ?? "—"}d
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div style={{
                  padding: 13,
                  borderRadius: 12,
                  background: riskyActions.length > 0 ? "#fffbeb" : "#f8fafc",
                  border: `1px solid ${riskyActions.length > 0 ? "#fde68a" : "#e2e8f0"}`,
                  color: riskyActions.length > 0 ? "#92400e" : "#475569",
                  fontSize: "0.76rem",
                  lineHeight: 1.55,
                }}>
                  <strong>{riskyActions.length > 0 ? "클릭/NPay 계열 후보 있음" : "전환 액션 세그먼트 대기"}</strong>
                  <div style={{ marginTop: 6 }}>
                    {riskyActions.length > 0
                      ? riskyActions.map((row) => row.action).join(", ")
                      : parsed
                        ? "CSV에 전환 액션 열이 없으면 live API의 conversion_action 목록으로 primary/secondary 여부를 확인한다."
                        : "live API에서 전환 액션 목록을 읽고 있다. NPay/클릭 계열은 발견되면 여기서 경고한다."}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        ) : (
          <Panel title="현재 판단">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
              {[
                ["1", "Explorer Access 확인", "실제 계정 214-999-0943의 customer, conversion_action, 캠페인 성과 지표가 API로 읽힌다."],
                ["2", "Live API 화면", "백엔드 live endpoint에서 캠페인 성과와 전환 액션 목록을 불러와 이 화면에 표시한다."],
                ["3", "GTM/GA4 대조", "전환 액션 이름과 label을 GTM 태그, GA4 purchase, 내부 confirmed 매출과 연결한다."],
              ].map(([step, title, body]) => (
                <div key={step} style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", display: "grid", placeItems: "center", fontWeight: 900, marginBottom: 10 }}>
                    {step}
                  </div>
                  <strong style={{ display: "block", color: "#0f172a", fontSize: "0.82rem", marginBottom: 5 }}>{title}</strong>
                  <span style={{ color: "#64748b", fontSize: "0.74rem", lineHeight: 1.55 }}>{body}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </main>
    </>
  );
}
