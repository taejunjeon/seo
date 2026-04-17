"use client";

/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtRoasX = (v: number | null | undefined) => (v != null ? `${v.toFixed(2)}x` : "—");
const formatRoasTooltip = (value: string | number | undefined) => `${Number(value ?? 0).toFixed(2)}x`;

type CampaignRow = {
  campaign_name: string;
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  link_clicks: number;
  landing_page_views: number;
  leads: number;
  purchases: number;
  purchase_value?: number;
  view_content?: number;
  add_to_cart?: number;
  initiate_checkout?: number;
};

type CampaignSummary = {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  avgCpc: number;
  totalLandingViews: number;
  totalLeads: number;
  totalPurchases: number;
  totalPurchaseValue?: number;
};

type DailyRow = {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landing_page_views: number;
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

type SiteRoasSummary = {
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

type AttributionCampaignRoasRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  orders: number;
};

type AttributionCampaignRoasResponse = {
  ok: boolean;
  account_id: string;
  date_preset: string;
  campaigns: AttributionCampaignRoasRow[];
  summary: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
  };
};

type CampaignLtvRoasRow = AttributionCampaignRoasRow & {
  ltvRevenue: number;
  repeatRevenue: number;
  supplementRevenue: number;
  ltvRoas: number | null;
  matchedCustomers: number;
  consultedCustomers: number;
  supplementCustomers: number;
  identityMatchedOrders: number;
  ltvStatus: "ready" | "low_sample" | "identity_missing" | "no_attribution" | "blocked";
  ltvBlocker: string | null;
};

type CampaignLtvRoasResponse = {
  ok: boolean;
  account_id: string;
  date_preset: string;
  ltv_window_days: number;
  ltv_definition: string;
  rows: CampaignLtvRoasRow[];
  summary: {
    spend: number;
    attributedRevenue: number;
    ltvRevenue: number;
    repeatRevenue: number;
    supplementRevenue: number;
    ltvRoas: number | null;
    readyCampaigns: number;
    blockedCampaigns: number;
  };
  error?: string;
};

type AliasReviewCandidate = {
  campaignId: string;
  campaignName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  activeAdsets: number;
  activeAds: number;
  landingUrlExamples: string[];
  adsetSamples: string[];
  adSamples: string[];
  selected: boolean;
  rejected: boolean;
};

type AliasReviewItem = {
  aliasKey: string;
  site: string;
  status: string;
  confidence: string;
  familyHint: string;
  reviewReason: string;
  validFrom: string | null;
  validTo: string | null;
  reviewedAt: string | null;
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  rejectedCampaignIds: string[];
  evidence: {
    confirmedOrders: number;
    confirmedRevenue: number;
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRevenue: number;
    totalOrders: number;
    totalRevenue: number;
  };
  candidates: AliasReviewCandidate[];
};

type AliasReviewResponse = {
  ok: boolean;
  site: string;
  generated_at: string;
  summary: {
    totalAliases: number;
    pendingReview: number;
    manualVerified: number;
    rejectedAll: number;
  };
  items: AliasReviewItem[];
  error?: string;
};

type CapiLogSegmentCounts = {
  operational: number;
  manual: number;
  test: number;
};

type CapiOrderEventDuplicateSample = {
  orderId: string;
  eventName: string;
  count: number;
  uniqueEventIds: number;
  firstSentAt: string;
  lastSentAt: string;
  classification: "same_event_id_retry_like" | "multiple_event_ids_duplicate_risk";
  eventIds: string[];
  segments: CapiLogSegmentCounts;
  success: number;
  failure: number;
};

type CapiDedupCandidateDetail = Omit<CapiOrderEventDuplicateSample, "segments" | "success" | "failure" | "eventIds"> & {
  rows: Array<{
    createdAt: string;
    eventId: string;
    responseStatus: number;
    pixelId: string;
    eventSourceUrl: string;
    mode: "operational" | "manual" | "test";
    sendPath: "auto_sync" | "manual_api" | "test_event" | "unknown";
    orderId: string;
    paymentKey: string;
    touchpoint: string;
    captureMode: string;
    source: string;
    approvedAt: string;
    loggedAt: string;
    ledgerLanding: string;
    ledgerReferrer: string;
    requestOrigin: string;
    requestPath: string;
  }>;
};

type CapiLogSummary = {
  total: number;
  success: number;
  failure: number;
  countsByPixelId: Record<string, number>;
  countsBySegment: CapiLogSegmentCounts;
  uniqueEventIds: number;
  duplicateEventIds: number;
  duplicateEventIdGroups: number;
  uniqueOrderEventKeys: number;
  duplicateOrderEventKeys: number;
  duplicateOrderEventGroups: number;
  duplicateOrderEventBreakdown: {
    retryLikeGroups: number;
    retryLikeRows: number;
    multiEventIdGroups: number;
    multiEventIdRows: number;
  };
  duplicateOrderEventSamples: CapiOrderEventDuplicateSample[];
};

type CallerCoverageSummary = {
  total: number;
  withGaSessionId: number;
  withClientId: number;
  withUserPseudoId: number;
  withAllThree: number;
  gaSessionIdRate: number;
  clientIdRate: number;
  userPseudoIdRate: number;
  allThreeRate: number;
};

type CallerCoverageReport = {
  paymentSuccess: CallerCoverageSummary;
  checkoutStarted: CallerCoverageSummary;
  notes: string[];
};

type AcquisitionDimensionRow = {
  label: string;
  count: number;
  share: number;
  revenue?: number;
  examples?: string[];
};

type AcquisitionChannelRow = AcquisitionDimensionRow & {
  key: string;
  description?: string;
  confirmedCount?: number;
  pendingCount?: number;
  canceledCount?: number;
  pendingRevenue?: number;
};

type AibioAcquisitionSite = {
  key: string;
  name: string;
  conversionName: string;
  operationalConversions: number;
  rawConversions: number;
  excludedConversions: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  topChannel: AcquisitionChannelRow | null;
  channels: AcquisitionChannelRow[];
  campaigns: AcquisitionDimensionRow[];
  landings: AcquisitionDimensionRow[];
  insights?: string[];
  dataWarnings?: string[];
};

const SITES = [
  { site: "biocom", label: "바이오컴", account_id: "act_3138805896402376" },
  { site: "aibio", label: "AIBIO 리커버리랩", account_id: "act_377604674894011" },
  { site: "thecleancoffee", label: "더클린커피", account_id: "act_654671961007474" },
];

const DATE_PRESETS = [
  { value: "last_7d", label: "최근 7일" },
  { value: "last_14d", label: "최근 14일" },
  { value: "last_30d", label: "최근 30일" },
  { value: "last_90d", label: "최근 90일" },
];
const DATE_PRESET_DAY_COUNTS: Record<string, number> = {
  last_7d: 7,
  last_14d: 14,
  last_30d: 30,
  last_90d: 90,
};
const ROAS_LAG_NOTE = "confirmed ledger만 메인 ROAS에 반영한다. 오늘/최근 1~2일 수치는 pending 결제와 PG 확정 지연 때문에 잠정치로 낮게 보일 수 있다.";
const META_PRIMARY_ATTR_WINDOW = "1d_click";

const ATTR_WINDOWS = [
  { value: "1d_click", label: "클릭 1일 (운영 기준)", desc: "광고 클릭 후 24시간 내 구매만 집계. 앞으로 Meta ROAS 기준값" },
  { value: "", label: "Meta 기본 (7d클릭+1d조회)", desc: "Ads Manager 기본 설정. 클릭 7일 + 조회 1일" },
  { value: "7d_click", label: "클릭 7일", desc: "광고 클릭 후 7일 내 구매 집계. 보조 비교값" },
  { value: "28d_click", label: "클릭 28일", desc: "광고 클릭 후 28일 내 구매 집계" },
  { value: "1d_view", label: "조회 1일", desc: "광고를 보기만 하고 24시간 내 구매" },
];

const REVIEW_TARGET_SITES = new Set(["biocom"]);

// 캠페인명 → 검사유형 매핑 (callprice LTV 데이터 연동용)
// 알러지=음식물과민증 (CRM 라벨 차이일 뿐 동일 검사 — 2024년까지 "음식물", 2025년부터 "알러지"로 전환)
// 유기산=종합대사기능 (동일 리포트 유형)
// 아래 값은 알러지+음식물 합산 기준 (표본 3,675명, 가장 안정적)
const CAMPAIGN_LTV_MAP: Record<string, { analysisType: string; ltvNoConsult: number; ltvConsulted: number; consultRate: number }> = {
  "음식물 과민증": { analysisType: "음식물과민증(알러지+음식물 합산)", ltvNoConsult: 20177, ltvConsulted: 80173, consultRate: 0.234 },
  "영양중금속": { analysisType: "중금속", ltvNoConsult: 69509, ltvConsulted: 153046, consultRate: 0.352 },
  "종합대사기능": { analysisType: "유기산(종합대사기능)", ltvNoConsult: 61266, ltvConsulted: 234383, consultRate: 0.467 },
  "호르몬": { analysisType: "호르몬", ltvNoConsult: 66983, ltvConsulted: 268852, consultRate: 0.401 },
  // 영양제 직접판매 캠페인 — 상담 모델 아님. supplement-first 180일 LTR 기반 재구매 추가매출
  // 180일 LTR ₩209,550, 첫주문 평균 ₩69,585 → 추가매출 ₩139,965. 재구매율 43%
  "건강기능식품": { analysisType: "영양제(180일 재구매 기반)", ltvNoConsult: 0, ltvConsulted: 139965, consultRate: 1.0 },
};
const matchCampaignLtv = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("음식물") || n.includes("과민증") || n.includes("알러지")) return CAMPAIGN_LTV_MAP["음식물 과민증"];
  if (n.includes("중금속") || n.includes("영양중금속")) return CAMPAIGN_LTV_MAP["영양중금속"];
  if (n.includes("종합대사") || n.includes("유기산")) return CAMPAIGN_LTV_MAP["종합대사기능"];
  if (n.includes("호르몬")) return CAMPAIGN_LTV_MAP["호르몬"];
  if (n.includes("건강기능식품") || n.includes("영양제")) return CAMPAIGN_LTV_MAP["건강기능식품"];
  return null;
};

// CAPI 최신화 스냅샷 (post-server-decision-guard v3) — 2026-04-12 21:52 KST.
// 2026-04-14 22:00 ~ 2026-04-15 20:17 KST 사이 footer source-label 오염은
// 2026-04-15 20:53 KST에 source + metadata_json.source 모두 SQL 교정 완료.
// 따라서 이 카드는 교정된 VM ledger 기준으로 2026-04-13 KST부터 POST 창에 포함한다.
const CAPI_SNAPSHOT_KST = "2026-04-12 21:52 KST";
const CAPI_SNAPSHOT_UTC_MS = Date.UTC(2026, 3, 12, 12, 52, 0); // 2026-04-12T12:52:00Z
const CAPI_SOURCE_LABEL_FIX_KST = "2026-04-15 20:17 KST";
const CAPI_SOURCE_LABEL_REPAIR_KST = "2026-04-15 20:53 KST";
const CAPI_REPAIRED_POLLUTION_WINDOW = "2026-04-14 22:00 ~ 2026-04-15 20:17 KST (276건 SQL 교정 완료)";
const CAPI_POST_START_DATE = "2026-04-13"; // 교정된 VM ledger 기준 post-CAPI 첫 full-day KST 날짜
// 2026-04-13 00:00 KST를 UTC ms로 환산: 2026-04-12 15:00 UTC
const CAPI_POST_START_KST_UTC_MS = Date.UTC(2026, 3, 12, 15, 0, 0);
const CAPI_PRE_WINDOW_DAYS = 7; // 비교용 스냅샷 직전 7일
const CAPI_PRE_END_DATE = "2026-04-11"; // 2026-04-12 pre-snapshot 당일 제외
const CAPI_PRE_START_DATE = "2026-04-05"; // 2026-04-05 ~ 2026-04-11 (7일)
const COFFEE_CAPI_SNAPSHOT_KST = "2026-04-15 KST";
const COFFEE_CAPI_SOURCE_REPAIR_KST = "2026-04-15 20:53 KST";
const COFFEE_CAPI_CLEAN_START_DATE = "2026-04-16";
const COFFEE_FIRST_CLOSED_DAY_KST = "2026-04-17 아침";
const COFFEE_FIRST_3D_SIGNAL_KST = "2026-04-19 아침";
const COFFEE_FIRST_7D_BASELINE_KST = "2026-04-23 아침";
const BIOCOM_BUDGET_DECISION = {
  window: "2026-04-13~15 닫힌 3일",
  spend: 12361899,
  attrRevenue: 23428300,
  attrRoas: 1.9,
  metaValue: 37841869,
  metaRoas: 3.06,
  gapRatio: 1.61,
  pendingRevenue: 260000,
};
const BIOCOM_CAMPAIGN_SELECTION_CANDIDATES = [
  {
    campaignId: "120242626179290396",
    campaignName: "공동구매 인플루언서 파트너 광고 모음_3",
    confirmedSignal: "13건 / ₩4,015,700",
    followupGate: "상담·영양제 후속 조인 전",
    action: "증액 보류",
  },
  {
    campaignId: "120213362391690396",
    campaignName: "음식물 과민증 검사 전환캠페인",
    confirmedSignal: "4건 / ₩1,209,000",
    followupGate: "검사 후 영양제 후속 가능성이 큰 상품군",
    action: "우선 확인",
  },
  {
    campaignId: "120237452088280396",
    campaignName: "종합대사기능검사 전환캠페인",
    confirmedSignal: "2건 / ₩536,400",
    followupGate: "상담·영양제 후속 조인 필요",
    action: "확인 후 +10~15%",
  },
  {
    campaignId: "120218496689750396",
    campaignName: "영양중금속검사 전환 캠페인",
    confirmedSignal: "1건 / ₩268,200",
    followupGate: "표본 추가 필요",
    action: "보류",
  },
  {
    campaignId: "120235591897270396",
    campaignName: "음식물 과민증 검사 어드밴티지+캠페인",
    confirmedSignal: "1건 / ₩245,000",
    followupGate: "표본 추가 필요",
    action: "보류",
  },
] as const;
// VM endpoint: CAPI auto-sync / attribution status sync는 현재 VM에서만 돌고
// 로컬 노트북 백엔드는 cutover 이후 sync가 꺼져 있어 ledger가 오래됨.
// 따라서 이 카드는 VM endpoint를 직접 조회해 "실시간" post-CAPI 상태를 보여준다.
const CAPI_VM_BASE = "https://att.ainativeos.net";
// 광고 ROAS 리포팅도 VM ledger 기준으로 통일한다.
// localhost:7020은 2026-04-13 이후 attribution sync가 꺼져 있어 일자별 Attr 값이 0으로 보일 수 있다.
const ADS_REPORTING_API_BASE = CAPI_VM_BASE;

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const summarizeAliasReviewItems = (items: AliasReviewItem[]) => ({
  totalAliases: items.length,
  pendingReview: items.filter((item) => item.status === "needs_manual_review").length,
  manualVerified: items.filter((item) => item.status === "manual_verified").length,
  rejectedAll: items.filter((item) => item.status === "rejected_all_candidates").length,
});

export default function AdsPage() {
  const [selectedSite, setSelectedSite] = useState(SITES[0]);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [attrWindow, setAttrWindow] = useState(META_PRIMARY_ATTR_WINDOW);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [siteSummary, setSiteSummary] = useState<{ sites: SiteRoasSummary[]; total: { impressions: number; clicks: number; spend: number; revenue: number; roas: number | null; orders: number } } | null>(null);
  const [campaignRoas, setCampaignRoas] = useState<AttributionCampaignRoasResponse | null>(null);
  const [campaignLtvRoas, setCampaignLtvRoas] = useState<CampaignLtvRoasResponse | null>(null);
  const [campaignLtvRoasError, setCampaignLtvRoasError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaStatus, setMetaStatus] = useState<{
    coffee?: {
      configured: boolean;
      activeTokenKind: "system_user" | "app" | "fallback_global";
      systemUser: { configured: boolean; userId: string | null };
      appToken: { configured: boolean };
    };
  } | null>(null);
  const [aibioAcquisition, setAibioAcquisition] = useState<AibioAcquisitionSite | null>(null);
  const [aibioAcquisitionLoading, setAibioAcquisitionLoading] = useState(false);
  const [aibioAcquisitionError, setAibioAcquisitionError] = useState<string | null>(null);

  // Post-CAPI 바이오컴 비교 상태 (교정된 VM ledger 기준 2026-04-13~today vs 2026-04-05~2026-04-11)
  type CapiRoasWindow = {
    start_date: string;
    end_date: string;
    spend: number;
    attrConfirmedRoas: number | null;
    metaPurchaseRoas: number | null;
    gapRatio: number | null; // meta / attribution
    gapPct: number | null;   // (meta - attr) / attr
    orders: number;
    revenue: number;
    metaPurchaseValue: number;
  };
  const [capiWindows, setCapiWindows] = useState<{ pre: CapiRoasWindow | null; post: CapiRoasWindow | null } | null>(null);
  const [capiWindowsLoading, setCapiWindowsLoading] = useState(false);
  const [capiNowMs, setCapiNowMs] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/meta/status`)
      .then((r) => r.json())
      .then((data) => { if (data?.ok) setMetaStatus(data); })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (selectedSite.site !== "aibio") {
      setAibioAcquisition(null);
      setAibioAcquisitionError(null);
      setAibioAcquisitionLoading(false);
      return;
    }

    const ac = new AbortController();
    const rangeDays = DATE_PRESET_DAY_COUNTS[datePreset] ?? 30;
    setAibioAcquisitionLoading(true);
    setAibioAcquisitionError(null);

    fetch(`${API_BASE}/api/attribution/acquisition-summary?rangeDays=${rangeDays}&dataSource=vm`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: { ok?: boolean; sites?: AibioAcquisitionSite[]; error?: string }) => {
        if (!data?.ok || !Array.isArray(data.sites)) {
          throw new Error(data?.error ?? "AIBIO acquisition summary unavailable");
        }
        setAibioAcquisition(data.sites.find((site) => site.key === "aibio") ?? null);
      })
      .catch((error) => {
        if (!ac.signal.aborted) {
          setAibioAcquisition(null);
          setAibioAcquisitionError(error instanceof Error ? error.message : "AIBIO acquisition summary unavailable");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setAibioAcquisitionLoading(false);
      });

    return () => ac.abort();
  }, [selectedSite.site, datePreset]);

  useEffect(() => {
    const updateNow = () => setCapiNowMs(Date.now());
    updateNow();
    const id = window.setInterval(updateNow, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // 바이오컴 선택 시 post-CAPI 스냅샷 기준 ROAS 차이 로드 (1d_click 고정)
  // VM endpoint 직접 조회 — 로컬 ledger는 VM cutover 이후 sync가 꺼져 있음.
  useEffect(() => {
    if (selectedSite.site !== "biocom") { setCapiWindows(null); return; }
    const today = new Date();
    const kstShifted = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    const todayIsoKst = kstShifted.toISOString().slice(0, 10);
    const postEndDate = todayIsoKst >= CAPI_POST_START_DATE ? todayIsoKst : CAPI_POST_START_DATE;
    const ac = new AbortController();
    setCapiWindowsLoading(true);
    const buildUrl = (start: string, end: string) =>
      `${CAPI_VM_BASE}/api/ads/site-summary?start_date=${start}&end_date=${end}&attribution_window=1d_click`;

    const parseWindow = (data: Record<string, unknown> | null, startDate: string, endDate: string): CapiRoasWindow | null => {
      if (!data || !data.ok || !Array.isArray(data.sites)) return null;
      const row = (data.sites as Array<Record<string, unknown>>).find((s) => s.site === "biocom");
      if (!row) return null;
      const spend = Number(row.spend ?? 0);
      const attrConfirmedRoas = typeof row.roas === "number" ? (row.roas as number) : null;
      const metaPurchaseRoas = typeof row.metaPurchaseRoas === "number" ? (row.metaPurchaseRoas as number) : null;
      const gapRatio = attrConfirmedRoas != null && attrConfirmedRoas > 0 && metaPurchaseRoas != null
        ? metaPurchaseRoas / attrConfirmedRoas
        : null;
      const gapPct = attrConfirmedRoas != null && attrConfirmedRoas > 0 && metaPurchaseRoas != null
        ? (metaPurchaseRoas - attrConfirmedRoas) / attrConfirmedRoas
        : null;
      return {
        start_date: startDate,
        end_date: endDate,
        spend,
        attrConfirmedRoas,
        metaPurchaseRoas,
        gapRatio,
        gapPct,
        orders: Number(row.orders ?? 0),
        revenue: Number(row.revenue ?? 0),
        metaPurchaseValue: Number(row.metaPurchaseValue ?? 0),
      };
    };

    Promise.all([
      fetch(buildUrl(CAPI_PRE_START_DATE, CAPI_PRE_END_DATE), { signal: ac.signal }).then((r) => r.json()).catch(() => null),
      fetch(buildUrl(CAPI_POST_START_DATE, postEndDate), { signal: ac.signal }).then((r) => r.json()).catch(() => null),
    ])
      .then(([preData, postData]) => {
        setCapiWindows({
          pre: parseWindow(preData, CAPI_PRE_START_DATE, CAPI_PRE_END_DATE),
          post: parseWindow(postData, CAPI_POST_START_DATE, postEndDate),
        });
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!ac.signal.aborted) setCapiWindowsLoading(false); });
    return () => ac.abort();
  }, [selectedSite.site]); // eslint-disable-line react-hooks/exhaustive-deps

  // CAPI 카드 자동 갱신: 매 1시간마다 (페이지를 오래 열어두면 자동 최신화)
  useEffect(() => {
    if (selectedSite.site !== "biocom") return;
    const interval = setInterval(() => {
      const today = new Date();
      const kstShifted = new Date(today.getTime() + 9 * 60 * 60 * 1000);
      const todayIsoKst = kstShifted.toISOString().slice(0, 10);
      const postEndDate = todayIsoKst >= CAPI_POST_START_DATE ? todayIsoKst : CAPI_POST_START_DATE;
      const buildUrl = (start: string, end: string) =>
        `${CAPI_VM_BASE}/api/ads/site-summary?start_date=${start}&end_date=${end}&attribution_window=1d_click`;
      Promise.all([
        fetch(buildUrl(CAPI_PRE_START_DATE, CAPI_PRE_END_DATE)).then((r) => r.json()).catch(() => null),
        fetch(buildUrl(CAPI_POST_START_DATE, postEndDate)).then((r) => r.json()).catch(() => null),
      ]).then(([preData, postData]) => {
        const parseW = (data: Record<string, unknown> | null, s: string, e: string) => {
          if (!data || !data.ok || !Array.isArray(data.sites)) return null;
          const row = (data.sites as Array<Record<string, unknown>>).find((x) => x.site === "biocom");
          if (!row) return null;
          const spend = Number(row.spend ?? 0);
          const attrR = typeof row.roas === "number" ? (row.roas as number) : null;
          const metaR = typeof row.metaPurchaseRoas === "number" ? (row.metaPurchaseRoas as number) : null;
          const gapR = attrR != null && attrR > 0 && metaR != null ? metaR / attrR : null;
          const gapP = attrR != null && attrR > 0 && metaR != null ? (metaR - attrR) / attrR : null;
          return { start_date: s, end_date: e, spend, attrConfirmedRoas: attrR, metaPurchaseRoas: metaR, gapRatio: gapR, gapPct: gapP, orders: Number(row.orders ?? 0), revenue: Number(row.revenue ?? 0), metaPurchaseValue: Number(row.metaPurchaseValue ?? 0) };
        };
        setCapiWindows({ pre: parseW(preData, CAPI_PRE_START_DATE, CAPI_PRE_END_DATE), post: parseW(postData, CAPI_POST_START_DATE, postEndDate) });
      }).catch(() => {});
    }, 60 * 60 * 1000); // 1시간
    return () => clearInterval(interval);
  }, [selectedSite.site]);

  const loadSiteData = useCallback(async () => {
    setLoading(true);
    try {
      const attrWindowQuery = attrWindow ? `&attribution_window=${attrWindow}` : "";
      const campaignRoasApiBase = selectedSite.site === "biocom" ? API_BASE : ADS_REPORTING_API_BASE;
      const [insightsRes, dailyRes, siteSummaryRes, campaignRoasRes] = await Promise.all([
        fetch(`${ADS_REPORTING_API_BASE}/api/meta/insights?account_id=${selectedSite.account_id}&date_preset=${datePreset}${attrWindowQuery}`),
        fetch(`${ADS_REPORTING_API_BASE}/api/ads/roas/daily?account_id=${selectedSite.account_id}&date_preset=${datePreset}${attrWindowQuery}`),
        fetch(`${ADS_REPORTING_API_BASE}/api/ads/site-summary?date_preset=${datePreset}${attrWindowQuery}`),
        fetch(`${campaignRoasApiBase}/api/ads/roas?account_id=${selectedSite.account_id}&date_preset=${datePreset}`),
      ]);
      const campaignLtvRoasRes = selectedSite.site === "biocom"
        ? await fetch(`${API_BASE}/api/ads/campaign-ltv-roas?account_id=${selectedSite.account_id}&date_preset=${datePreset}&ltv_window_days=180`).catch(() => null)
        : null;
      const insightsData = await insightsRes.json();
      const dailyData = await dailyRes.json();
      const siteSummaryData = await siteSummaryRes.json();
      const campaignRoasData = await campaignRoasRes.json();
      const campaignLtvRoasData = campaignLtvRoasRes ? await campaignLtvRoasRes.json().catch(() => null) as CampaignLtvRoasResponse | null : null;
      if (insightsData.ok) {
        setCampaigns(insightsData.rows ?? []);
        setCampaignSummary(insightsData.summary ?? null);
      }
      if (dailyData.ok) setDaily(dailyData.rows ?? []);
      if (siteSummaryData.ok) setSiteSummary(siteSummaryData);
      if (campaignRoasData.ok) setCampaignRoas(campaignRoasData);
      if (campaignLtvRoasData?.ok) {
        setCampaignLtvRoas(campaignLtvRoasData);
        setCampaignLtvRoasError(null);
      } else {
        setCampaignLtvRoas(null);
        setCampaignLtvRoasError(
          selectedSite.site === "biocom"
            ? campaignLtvRoasData?.error ?? "campaign LTV ROAS API 응답 없음"
            : null,
        );
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedSite, datePreset, attrWindow]);

  useEffect(() => { loadSiteData(); }, [loadSiteData]);

  const selectedSiteSummary = siteSummary?.sites.find((site) => site.site === selectedSite.site) ?? null;
  const selectedAccountId = selectedSiteSummary?.account_id ?? selectedSite.account_id;
  const selectedAttributedRevenue = selectedSiteSummary?.revenue ?? 0;
  const selectedAttributedRoas = selectedSiteSummary?.roas ?? null;
  const selectedAttributedOrders = selectedSiteSummary?.orders ?? 0;
  const selectedPendingRevenue = selectedSiteSummary?.pendingRevenue ?? 0;
  const selectedPendingOrders = selectedSiteSummary?.pendingOrders ?? 0;
  const selectedPotentialRevenue = selectedSiteSummary?.potentialRevenue ?? selectedAttributedRevenue + selectedPendingRevenue;
  const selectedPotentialRoas = selectedSiteSummary?.potentialRoas ?? null;
  const selectedMetaPurchaseValue = selectedSiteSummary?.metaPurchaseValue ?? campaignSummary?.totalPurchaseValue ?? 0;
  const selectedMetaPurchaseRoas = selectedSiteSummary?.metaPurchaseRoas
    ?? (campaignSummary && (campaignSummary.totalPurchaseValue ?? 0) > 0 && campaignSummary.totalSpend > 0
      ? campaignSummary.totalPurchaseValue! / campaignSummary.totalSpend
      : null);
  const selectedSiteConfirmedRevenue = selectedSiteSummary?.siteConfirmedRevenue ?? 0;
  const selectedBestCaseCeilingRoas = selectedSiteSummary?.bestCaseCeilingRoas ?? null;
  const unmappedRow = campaignRoas?.campaigns.find((row) => row.campaignName === "(unmapped)") ?? null;
  const attributionRoasByCampaignId = new Map(
    (campaignRoas?.campaigns ?? [])
      .filter((row): row is AttributionCampaignRoasRow & { campaignId: string } => Boolean(row.campaignId))
      .map((row) => [row.campaignId, row]),
  );
  const ltvRoasByCampaignId = new Map(
    (campaignLtvRoas?.rows ?? [])
      .filter((row): row is CampaignLtvRoasRow & { campaignId: string } => Boolean(row.campaignId))
      .map((row) => [row.campaignId, row]),
  );
  const totalAttributedRevenueForMapping = campaignRoas?.summary.attributedRevenue ?? 0;
  const campaignRoasCoverageAgainstVm = selectedSiteConfirmedRevenue > 0 && campaignRoas
    ? campaignRoas.summary.attributedRevenue / selectedSiteConfirmedRevenue
    : null;
  const unmappedRevenueShare = unmappedRow && totalAttributedRevenueForMapping > 0
    ? unmappedRow.attributedRevenue / totalAttributedRevenueForMapping
    : null;
  const selectedRoasGapRatio =
    selectedAttributedRoas != null
    && selectedAttributedRoas > 0
    && selectedMetaPurchaseRoas != null
      ? selectedMetaPurchaseRoas / selectedAttributedRoas
      : null;
  const currentPresetLabel = DATE_PRESETS.find((preset) => preset.value === datePreset)?.label ?? "선택 기간";
  const currentAttrWindowLabel = ATTR_WINDOWS.find((window) => window.value === attrWindow)?.label ?? attrWindow;
  const currentPresetDays = DATE_PRESET_DAY_COUNTS[datePreset] ?? 30;
  const isLongWindow = datePreset === "last_30d" || datePreset === "last_90d";
  const selectedMetaPurchases = campaignSummary?.totalPurchases ?? 0;
  const selectedMetaAov = selectedMetaPurchases > 0 ? selectedMetaPurchaseValue / selectedMetaPurchases : null;
  const selectedMetaCpa = campaignSummary && selectedMetaPurchases > 0 ? campaignSummary.totalSpend / selectedMetaPurchases : null;
  const selectedClickToLandingRate = campaignSummary && campaignSummary.totalClicks > 0
    ? campaignSummary.totalLandingViews / campaignSummary.totalClicks
    : null;
  const selectedLandingToPurchaseRate = campaignSummary && campaignSummary.totalLandingViews > 0
    ? campaignSummary.totalPurchases / campaignSummary.totalLandingViews
    : null;
  const selectedAttShareOfMetaPurchases = selectedMetaPurchases > 0
    ? selectedAttributedOrders / selectedMetaPurchases
    : null;
  const selectedAttShareOfSiteOrders = selectedSiteSummary?.siteConfirmedOrders
    ? selectedAttributedOrders / selectedSiteSummary.siteConfirmedOrders
    : null;

  return (
    <>
    <GlobalNav activeSlug="ai-crm" />
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Link href="/#ai-crm" style={{ fontSize: "0.78rem", color: "#6366f1", textDecoration: "none" }}>← 대시보드로 돌아가기</Link>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "4px 0" }}>Meta 광고성과 대시보드</h1>
          <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
            Meta 집행 지표와 Attribution 기준 ROAS를 함께 본다
            {" · "}
            <Link href="/ads/roas" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>ROAS 대시보드 →</Link>
            {" · "}
            <Link href="/ads/tiktok" style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>틱톡 광고성과 →</Link>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {DATE_PRESETS.map((dp) => (
            <button key={dp.value} onClick={() => setDatePreset(dp.value)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.75rem", fontWeight: 600,
              background: datePreset === dp.value ? "#6366f1" : "#fff",
              color: datePreset === dp.value ? "#fff" : "#64748b",
              cursor: "pointer",
            }}>{dp.label}</button>
          ))}
        </div>
      </div>

      {/* Attribution Window 필터 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>전환 기준</span>
        {ATTR_WINDOWS.map((aw) => (
          <button key={aw.value} onClick={() => setAttrWindow(aw.value)} title={aw.desc} style={{
            padding: "5px 10px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
            border: attrWindow === aw.value ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
            background: attrWindow === aw.value ? "#f5f3ff" : "#fff",
            color: attrWindow === aw.value ? "#6d28d9" : "#64748b",
          }}>{aw.label}</button>
        ))}
      </div>

      {selectedSite.site === "biocom" && (
        <div style={{
          marginBottom: 20,
          padding: "16px 18px",
          borderRadius: 8,
          background: "#fff",
          border: "1px solid #cbd5e1",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 520px" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 4 }}>
                운영 의견 · 바이오컴 광고비
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                전체 예산은 유지. 무차별 증액은 보류하고, 우수 캠페인만 +10~15% 제한 테스트.
              </div>
              <div style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.75 }}>
                {BIOCOM_BUDGET_DECISION.window} 기준 Attribution ROAS는 <strong>{BIOCOM_BUDGET_DECISION.attrRoas.toFixed(2)}x</strong>,
                Meta ROAS는 <strong>{BIOCOM_BUDGET_DECISION.metaRoas.toFixed(2)}x</strong>입니다.
                Meta/Attribution 격차는 <strong>{BIOCOM_BUDGET_DECISION.gapRatio.toFixed(2)}배</strong>이고,
                pending은 {fmtKRW(BIOCOM_BUDGET_DECISION.pendingRevenue)}뿐이라 현재 격차의 주범은 미입금이 아니라 Meta의 넓은 매칭과 내부 캠페인 매핑 미완성입니다.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: 8, flex: "1 1 520px" }}>
              {[
                { label: "광고비", value: fmtKRW(BIOCOM_BUDGET_DECISION.spend), color: "#ef4444" },
                { label: "Attr 매출", value: fmtKRW(BIOCOM_BUDGET_DECISION.attrRevenue), color: "#16a34a" },
                { label: "Attr ROAS", value: `${BIOCOM_BUDGET_DECISION.attrRoas.toFixed(2)}x`, color: "#16a34a" },
                { label: "Meta ROAS", value: `${BIOCOM_BUDGET_DECISION.metaRoas.toFixed(2)}x`, color: "#8b5cf6" },
              ].map((item) => (
                <div key={item.label} style={{ padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontSize: "0.9rem", color: item.color, fontWeight: 800 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: "0.72rem", color: "#475569", lineHeight: 1.65 }}>
            <div style={{ padding: "9px 10px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <strong style={{ color: "#166534" }}>증액 조건:</strong> Meta ROAS 상위 캠페인만 +10~15%, 48~72시간 관찰.
            </div>
            <div style={{ padding: "9px 10px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <strong style={{ color: "#9a3412" }}>보류 조건:</strong> 내부 캠페인 매출이 unmapped라 전체 증액 판단은 아직 금지.
            </div>
            <div style={{ padding: "9px 10px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <strong style={{ color: "#1d4ed8" }}>다음 검증:</strong> 7일 clean baseline 후 holdout/iROAS 설계 실행.
            </div>
          </div>
        </div>
      )}

      {/* 3사이트 오버뷰 */}
      {siteSummary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {SITES.map((s) => {
            const data = siteSummary.sites.find((o) => o.site === s.site);
            const isActive = data && data.spend > 0;
            const isSelected = selectedSite.site === s.site;
            return (
              <div key={s.site} onClick={() => setSelectedSite(s)} style={{
                padding: "16px 20px", borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                border: isSelected ? "2px solid #6366f1" : "1px solid #e2e8f0",
                background: isSelected ? "rgba(99,102,241,0.04)" : "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{s.label}</span>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    background: isActive ? "#f0fdf4" : "#f1f5f9",
                    color: isActive ? "#16a34a" : "#94a3b8",
                  }}>{isActive ? "집행 중" : "미집행"}</span>
                </div>
                {data && data.spend > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>비용</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{fmtKRW(data.spend)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>ROAS</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: data.roas != null && data.roas >= 1 ? "#16a34a" : data.roas != null ? "#dc2626" : "#94a3b8" }}>
                        {data.roas != null ? `${data.roas.toFixed(2)}x` : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>광고 귀속 매출</div>
                      <div style={{ fontSize: "0.82rem", color: "#475569" }}>{fmtKRW(data.revenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>주문</div>
                      <div style={{ fontSize: "0.82rem", color: "#475569" }}>{fmtNum(data.orders)}건</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", paddingTop: 8 }}>{currentPresetLabel} 광고 집행 없음</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 선택된 사이트 상세 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{selectedSite.label} 상세</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>계정: {selectedAccountId}</p>
          {selectedSite.site === "thecleancoffee" && metaStatus?.coffee && (
            (() => {
              const kind = metaStatus.coffee.activeTokenKind;
              const style =
                kind === "system_user"
                  ? { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0", label: "시스템 유저 토큰 사용 중 (비만료)" }
                  : kind === "app"
                  ? { bg: "#fef3c7", fg: "#92400e", border: "#fde68a", label: "앱 토큰 사용 중 (만료 가능)" }
                  : { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca", label: "글로벌 fallback 토큰 사용 (커피 전용 토큰 없음)" };
              return (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: style.bg,
                    color: style.fg,
                    border: `1px solid ${style.border}`,
                  }}
                  title={
                    kind === "system_user"
                      ? `COFFEE_META_TOKEN 활성. System User ID: ${metaStatus.coffee.systemUser.userId ?? "—"}`
                      : "env의 COFFEE_META_TOKEN 을 사용하도록 설정되지 않음"
                  }
                >
                  {style.label}
                </span>
              );
            })()
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>로딩 중...</div>
      ) : (
        <>
          {campaignSummary && (
            <div style={{ marginBottom: 20, padding: "16px 18px", borderRadius: 14, background: "#fff7ed", border: "1px solid #fdba74", fontSize: "0.78rem", color: "#7c2d12", lineHeight: 1.8 }}>
              <strong style={{ color: "#9a3412" }}>운영 headline</strong>
              <div>운영 메인: <strong>{currentPresetLabel} Attribution confirmed {fmtRoasX(selectedAttributedRoas)}</strong></div>
              <div>운영 보조: <strong>confirmed+pending {fmtRoasX(selectedPotentialRoas)}</strong></div>
              <div>플랫폼 참고: <strong>Meta purchase {currentAttrWindowLabel} {fmtRoasX(selectedMetaPurchaseRoas)}</strong> (Ads Manager `결과 ROAS`/`결과 값` 대응)</div>
              <div>
                해석: Meta가 내부 confirmed보다 더 넓게 잡고 있소. <strong>30일 값은 rollout bias가 섞인 보수치</strong>라서 운영 기본 탭은 최근 7일로 두었고,
                <strong> 잠정 상한선</strong>은 Ads Manager export/timezone 최종 대조 전까지 사이트 전체 confirmed 기준의 임시 상한으로 읽어야 하오.
              </div>
            </div>
          )}

          {selectedSite.site === "aibio" && campaignSummary && (
            <AibioCsoStrategySection
              campaignSummary={campaignSummary}
              acquisition={aibioAcquisition}
              acquisitionLoading={aibioAcquisitionLoading}
              acquisitionError={aibioAcquisitionError}
              currentPresetLabel={currentPresetLabel}
            />
          )}

          {selectedSite.site === "thecleancoffee" && campaignSummary && selectedSiteSummary && (
            <div style={{
              marginBottom: 20,
              padding: "18px 20px",
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              fontSize: "0.76rem",
              color: "#334155",
              lineHeight: 1.75,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ flex: "1 1 520px" }}>
                  <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>더클린커피 Att ROAS 낮음 원인 분해</strong>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    Meta 광고 계정은 연동 완료. 현재 낮은 Att ROAS는 "광고가 곧바로 나쁘다"보다
                    <strong> CAPI 전환일이 너무 최신이고, payment_success 식별자 커버리지가 낮아 내부 광고 귀속이 덜 잡히는 상태</strong>로 해석하는 것이 맞습니다.
                  </div>
                </div>
                <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", fontSize: "0.68rem", fontWeight: 800 }}>
                  clean baseline 대기
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Meta ROAS", value: fmtRoasX(selectedMetaPurchaseRoas), note: `${fmtNum(selectedMetaPurchases)}건 · ${fmtKRW(selectedMetaPurchaseValue)}`, color: "#8b5cf6" },
                  { label: "Att ROAS", value: fmtRoasX(selectedAttributedRoas), note: `${fmtNum(selectedAttributedOrders)}건 · ${fmtKRW(selectedAttributedRevenue)}`, color: "#16a34a" },
                  { label: "사이트 전체 상한", value: fmtRoasX(selectedBestCaseCeilingRoas), note: `${fmtNum(selectedSiteSummary.siteConfirmedOrders)}건 · ${fmtKRW(selectedSiteConfirmedRevenue)}`, color: "#2563eb" },
                  { label: "광고 귀속률", value: selectedAttShareOfMetaPurchases != null ? `${(selectedAttShareOfMetaPurchases * 100).toFixed(1)}%` : "—", note: `Att 주문 / Meta 구매`, color: "#d97706" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.66rem", color: "#94a3b8", marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: "0.66rem", color: "#64748b" }}>{item.note}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <strong style={{ color: "#0f172a" }}>왜 낮게 보이나</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    최근 7일 기준 Meta 구매는 {fmtNum(selectedMetaPurchases)}건인데 내부 Attribution confirmed는 {fmtNum(selectedAttributedOrders)}건입니다.
                    사이트 전체 confirmed 주문 {fmtNum(selectedSiteSummary.siteConfirmedOrders)}건 중 광고 귀속은
                    {" "}
                    <strong>{selectedAttShareOfSiteOrders != null ? `${(selectedAttShareOfSiteOrders * 100).toFixed(1)}%` : "—"}</strong>만 잡힙니다.
                    즉 전환 자체보다 주문 단위 광고 연결이 병목입니다.
                  </p>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <strong style={{ color: "#0f172a" }}>CAPI 신뢰 시작일</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    footer/CAPI v3 스냅샷: <strong>{COFFEE_CAPI_SNAPSHOT_KST}</strong>.
                    source-label 교정: <strong>{COFFEE_CAPI_SOURCE_REPAIR_KST}</strong>.
                    신뢰 시작일은 <strong>{COFFEE_CAPI_CLEAN_START_DATE}</strong>로 둡니다.
                    첫 1일 신호는 {COFFEE_FIRST_CLOSED_DAY_KST}, 3일 신호는 {COFFEE_FIRST_3D_SIGNAL_KST}, 7일 baseline은 {COFFEE_FIRST_7D_BASELINE_KST}입니다.
                  </p>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <strong style={{ color: "#0f172a" }}>지금 운영 판단</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    클릭→랜딩 {selectedClickToLandingRate != null ? `${(selectedClickToLandingRate * 100).toFixed(1)}%` : "—"},
                    랜딩→구매 {selectedLandingToPurchaseRate != null ? `${(selectedLandingToPurchaseRate * 100).toFixed(2)}%` : "—"}라 UX 퍼널은 강합니다.
                    CPA는 {selectedMetaCpa != null ? fmtKRW(selectedMetaCpa) : "—"}, Meta AOV는 {selectedMetaAov != null ? fmtKRW(selectedMetaAov) : "—"}입니다.
                    7일 clean baseline 전까지 감액보다 유지하면서 식별자 보강을 우선합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CAPI 최신화 스냅샷 이후 ROAS 수렴 모니터링 (바이오컴 전용) */}
          {selectedSite.site === "biocom" && (() => {
            const post = capiWindows?.post ?? null;
            const pre = capiWindows?.pre ?? null;
            // 2026-04-13 00:00 KST를 기준으로 "POST 창이 몇 일째인지" 계산
            // (KST 자정 경계로 카운트하므로 2026-04-13 = 1일차, 04-14 = 2일차)
            const now = capiNowMs ?? CAPI_SNAPSHOT_UTC_MS;
            const postDaysInWindow = (() => {
              if (now < CAPI_POST_START_KST_UTC_MS) return 0;
              return Math.floor((now - CAPI_POST_START_KST_UTC_MS) / (24 * 60 * 60 * 1000)) + 1;
            })();
            // "충분한 관측 시간"은 POST 창이 완전히 닫힌 일수 기준 (= postDaysInWindow - 1)
            const postFullDaysClosed = Math.max(0, postDaysInWindow - 1);
            const hoursSinceSnapshot = Math.max(0, Math.floor((now - CAPI_SNAPSHOT_UTC_MS) / (60 * 60 * 1000)));
            const hasMeaningfulPostSpend = post != null && post.spend > 0;
            const hasAttributionData = post != null && (post.orders > 0 || post.revenue > 0);
            // 판단: 완전히 닫힌 일수 기준 (오늘은 아직 집계 중이라 미포함)
            const verdictTier: "insufficient" | "early_signal" | "trendable" =
              !hasMeaningfulPostSpend || !hasAttributionData ? "insufficient"
                : postFullDaysClosed < 3 ? "insufficient"
                : postFullDaysClosed < 7 ? "early_signal"
                : "trendable";
            const verdictLabel = {
              insufficient: "데이터 부족",
              early_signal: "초기 신호",
              trendable: "추세 판정 가능",
            }[verdictTier];
            const verdictColor = {
              insufficient: "#dc2626",
              early_signal: "#d97706",
              trendable: "#16a34a",
            }[verdictTier];
            const verdictBg = {
              insufficient: "#fef2f2",
              early_signal: "#fffbeb",
              trendable: "#f0fdf4",
            }[verdictTier];
            return (
              <div style={{
                marginBottom: 20, padding: "18px 20px", borderRadius: 14,
                background: "#f8fafc", border: "1px solid #cbd5e1",
                lineHeight: 1.7,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>
                      CAPI 최신화 스냅샷 이후 Meta vs Attribution ROAS 차이 (바이오컴)
                    </strong>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                      스냅샷 시점: <strong style={{ color: "#0f172a" }}>{CAPI_SNAPSHOT_KST}</strong>
                      {" · "}source-label SQL 교정: <strong style={{ color: "#0f172a" }}>{CAPI_SOURCE_LABEL_REPAIR_KST}</strong>
                      {" · "}경과 {Math.floor(hoursSinceSnapshot / 24)}일 {hoursSinceSnapshot % 24}시간
                      {" · "}POST 창 {postDaysInWindow}일차 (닫힌 일수 {postFullDaysClosed}일)
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
                      데이터 소스: VM <code>att.ainativeos.net</code>
                      {" (로컬 노트북 백엔드는 cutover 이후 attribution sync가 꺼져 있어 VM을 직접 조회합니다)"}
                      {" · "}오염 창: {CAPI_REPAIRED_POLLUTION_WINDOW}
                      {" · "}footer fix: {CAPI_SOURCE_LABEL_FIX_KST}
                    </div>
                  </div>
                  <span style={{
                    padding: "5px 12px", borderRadius: 999,
                    background: verdictBg, color: verdictColor,
                    border: `1px solid ${verdictColor}33`,
                    fontSize: "0.72rem", fontWeight: 700,
                  }}>
                    {capiWindowsLoading ? "로딩…" : verdictLabel}
                  </span>
                </div>

                <div style={{ fontSize: "0.74rem", color: "#475569", marginBottom: 12, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <strong>왜 보는가 · 한 줄 설명:</strong> 스냅샷 이전 바이오컴 자사몰은 가상계좌 미입금까지 Browser Pixel이 Purchase로 잡아서 Meta ROAS가 내부 Attribution ROAS보다 구조적으로 높았습니다.
                  서버 결제 판정 가드가 붙은 뒤에는 Meta Purchase가 confirmed 기준으로 수렴해야 정상입니다. 이 카드는 <strong>SQL 교정된 VM ledger</strong>를 쓰므로 source-label 오염 창까지 복구 반영된 POST 구간으로 봅니다.
                </div>

                {capiWindowsLoading ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>데이터 로딩 중...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {/* Pre 컬럼 */}
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>PRE (스냅샷 직전 {CAPI_PRE_WINDOW_DAYS}일)</div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{CAPI_PRE_START_DATE} ~ {CAPI_PRE_END_DATE}</div>
                      {pre ? (
                        <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#475569", lineHeight: 1.8 }}>
                          <div>Attribution: <strong>{fmtRoasX(pre.attrConfirmedRoas)}</strong></div>
                          <div>Meta Purchase: <strong>{fmtRoasX(pre.metaPurchaseRoas)}</strong></div>
                          <div>차이 (Meta/Attr): <strong style={{ color: "#9a3412" }}>
                            {pre.gapRatio != null ? `${pre.gapRatio.toFixed(2)}x` : "—"}
                            {pre.gapPct != null && ` (+${(pre.gapPct * 100).toFixed(0)}%)`}
                          </strong></div>
                          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 4 }}>
                            광고비 {fmtKRW(pre.spend)} · 주문 {pre.orders}건
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>데이터 없음</div>
                      )}
                    </div>

                    {/* Post 컬럼 */}
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #86efac" }}>
                      <div style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 700 }}>POST (CAPI 스냅샷 이후 · 교정 반영)</div>
                      <div style={{ fontSize: "0.68rem", color: "#16a34a" }}>
                        {post?.start_date ?? CAPI_POST_START_DATE} ~ {post?.end_date ?? CAPI_POST_START_DATE} (어제 자정 KST 기준 마감, 매일 페이지 로드 시 갱신)
                      </div>
                      {post ? (
                        <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#166534", lineHeight: 1.8 }}>
                          <div>Attribution: <strong>{fmtRoasX(post.attrConfirmedRoas)}</strong></div>
                          <div>Meta Purchase: <strong>{fmtRoasX(post.metaPurchaseRoas)}</strong></div>
                          <div>차이 (Meta/Attr): <strong style={{ color: "#166534" }}>
                            {post.gapRatio != null ? `${post.gapRatio.toFixed(2)}x` : "—"}
                            {post.gapPct != null && ` (${post.gapPct >= 0 ? "+" : ""}${(post.gapPct * 100).toFixed(0)}%)`}
                          </strong></div>
                          <div style={{ fontSize: "0.68rem", color: "#15803d", marginTop: 4 }}>
                            광고비 {fmtKRW(post.spend)} · 주문 {post.orders}건
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>데이터 없음</div>
                      )}
                    </div>

                    {/* Delta / 판정 컬럼 */}
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: verdictBg, border: `1px solid ${verdictColor}33` }}>
                      <div style={{ fontSize: "0.68rem", color: verdictColor, fontWeight: 700 }}>개선 폭 및 현 판정</div>
                      {pre && post && pre.gapRatio != null && post.gapRatio != null ? (
                        <div style={{ marginTop: 8, fontSize: "0.74rem", color: "#1e293b", lineHeight: 1.8 }}>
                          <div>
                            격차 변화:{" "}
                            <strong>
                              {pre.gapRatio.toFixed(2)}x → {post.gapRatio.toFixed(2)}x
                            </strong>
                          </div>
                          <div>
                            절대 변화:{" "}
                            <strong style={{ color: post.gapRatio < pre.gapRatio ? "#16a34a" : "#dc2626" }}>
                              {post.gapRatio < pre.gapRatio ? "−" : "+"}
                              {Math.abs(post.gapRatio - pre.gapRatio).toFixed(2)}x
                            </strong>
                            {" · "}
                            {pre.gapRatio > 0 && (
                              <strong style={{ color: post.gapRatio < pre.gapRatio ? "#16a34a" : "#dc2626" }}>
                                {((post.gapRatio - pre.gapRatio) / pre.gapRatio * 100).toFixed(0)}%
                              </strong>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#64748b" }}>
                          격차 계산 불가 (데이터 부족)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 판단 + 다음 액션 */}
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#334155", lineHeight: 1.8 }}>
                  <strong style={{ color: "#0f172a" }}>현재 판단:</strong>{" "}
                  {verdictTier === "insufficient" && !hasAttributionData && hasMeaningfulPostSpend && (
                    <span>
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>Attribution 데이터가 아직 들어오지 않았습니다.</span>{" "}
                      POST 창에 광고비는 잡혔는데 confirmed 주문이 0건입니다. 이건 (1) PG 확정 지연 또는 (2) attribution ledger 수집 지연 둘 중 하나입니다.
                      먼저 <code>att.ainativeos.net/health</code>에서 <code>attributionStatusSync.enabled</code>가 true인지, 그리고 최근 CAPI 전송 로그가 쌓이는지 확인하세요.
                    </span>
                  )}
                  {verdictTier === "insufficient" && hasAttributionData && (
                    <span>
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>초기 신호로도 이르나 방향성은 보이기 시작합니다.</span>{" "}
                      POST 창이 {postDaysInWindow}일차이고 완전히 닫힌 일수는 {postFullDaysClosed}일입니다. 오늘 데이터는 PG 확정 지연 때문에 자정까지 계속 늘어날 가능성이 크니 수치를 고정값으로 읽지 마세요.
                      최소 <strong>3일 이상</strong>의 완전히 닫힌 창이 쌓여야 초기 신호 단계로 승격됩니다.
                    </span>
                  )}
                  {verdictTier === "insufficient" && !hasMeaningfulPostSpend && (
                    <span>
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>POST 창에 광고비가 거의 없습니다.</span>{" "}
                      오늘 캠페인이 정상 집행 중인지 Ads Manager에서 확인해 주세요.
                    </span>
                  )}
                  {verdictTier === "early_signal" && (
                    <span>
                      <span style={{ color: "#d97706", fontWeight: 700 }}>초기 신호 단계입니다.</span>{" "}
                      POST 창에서 {postFullDaysClosed}일이 닫혔습니다. 격차가 줄어드는 방향인지는 볼 수 있지만 주말·캠페인 믹스 변동이 섞여 있어 단일 수치로 결론 내리기는 이릅니다.
                      일주일(닫힌 7일)이 채워지기 전까지는 보조 지표로만 해석하고, 운영 headline은 기존 7일 confirmed 값을 그대로 씁니다.
                    </span>
                  )}
                  {verdictTier === "trendable" && (
                    <span>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>7일 이상 경과, 추세 판정이 가능합니다.</span>{" "}
                      POST 격차가 PRE 대비 유의미하게 줄었다면 서버 결제 판정 가드가 의도대로 작동한 것입니다. 여전히 PRE 수준이면 Meta 쪽 attribution 윈도우 또는 다른 오염 경로를 추가 진단해야 합니다.
                    </span>
                  )}
                </div>

                <details style={{ marginTop: 10 }} open={verdictTier === "insufficient" && hasAttributionData}>
                  <summary style={{ cursor: "pointer", fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                    언제 무엇을 할지 (체크리스트)
                  </summary>
                  {(() => {
                    // 동적 날짜 계산
                    const d3Date = new Date(CAPI_POST_START_KST_UTC_MS + 3 * 86400000); // POST +3일
                    const d7Date = new Date(CAPI_POST_START_KST_UTC_MS + 7 * 86400000); // POST +7일
                    const d14Date = new Date(CAPI_POST_START_KST_UTC_MS + 14 * 86400000); // POST +14일
                    const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const todayStr = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
                    return (
                      <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#475569", lineHeight: 1.8 }}>
                        <div>
                          <strong>현재 (POST {postDaysInWindow}일차, 닫힌 {postFullDaysClosed}일):</strong>{" "}
                          매 아침 이 카드 + <code>att.ainativeos.net/api/meta/capi/log</code> total/success/failure 추이를 확인합니다.
                          가상계좌 미입금이 실제로 차단되는지 로그에서 <code>VirtualAccountIssued</code> 이벤트가 <code>Purchase</code>보다 많이 나타나면 가드가 제대로 작동 중입니다.
                          오늘 Attribution 값은 자정까지 계속 늘어날 수 있으니 고정값으로 읽지 마세요.
                        </div>
                        <div style={{ marginTop: 6, opacity: postFullDaysClosed >= 3 ? 0.5 : 1 }}>
                          <strong>{postFullDaysClosed >= 3 ? "✅ " : ""}D+3 ({fmtD(d3Date)} 아침):</strong>{" "}
                          3일치가 완전히 닫힌 상태로 쌓입니다. &quot;초기 신호&quot; 배지로 전환되면 격차 방향성을 처음으로 메모합니다.
                        </div>
                        <div style={{ marginTop: 6, opacity: postFullDaysClosed >= 7 ? 0.5 : 1 }}>
                          <strong>{postFullDaysClosed >= 7 ? "✅ " : ""}D+7 ({fmtD(d7Date)} 아침):</strong>{" "}
                          &quot;추세 판정 가능&quot; 배지로 전환됩니다. 격차가 <strong>PRE 대비 30% 이상 축소</strong>되었으면 Meta ROAS도 참고값으로 편입 검토합니다.
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>D+14 ({fmtD(d14Date)} 아침):</strong>{" "}
                          2주 누적으로 격차가 PRE 대비 <strong>40% 이상</strong> 줄었고 pending 주문 비중이 5% 이하면 &quot;확정 상한선&quot;으로 승격합니다.
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>격차가 줄지 않을 경우 (D+7 판정 기준):</strong>{" "}
                          (1) CAPI server_event_time / action_source 필드 sampling, (2) Meta Events Manager 이벤트 품질 점수 재확인, (3) 자사몰 외부 채널 Purchase 오염 여부 점검.
                        </div>
                      </div>
                    );
                  })()}
                </details>
              </div>
            );
          })()}

          {/* KPI 카드 */}
          {campaignSummary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                { label: "노출", value: fmtNum(campaignSummary.totalImpressions), color: "#6366f1" },
                { label: "클릭", value: fmtNum(campaignSummary.totalClicks), color: "#3b82f6" },
                { label: "비용", value: fmtKRW(campaignSummary.totalSpend), color: "#ef4444" },
                { label: "평균 CPC", value: fmtKRW(campaignSummary.avgCpc), color: "#f59e0b" },
                { label: "랜딩 뷰", value: fmtNum(campaignSummary.totalLandingViews), color: "#10b981" },
                { label: "전환", value: String(campaignSummary.totalLeads + campaignSummary.totalPurchases), color: "#8b5cf6" },
              ].map((kpi) => (
                <div key={kpi.label} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* 전환 상세 + 전환 매출 */}
          {campaignSummary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #f5f3ff, #fff)", border: "1px solid #e0e7ff" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>Meta purchase ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#8b5cf6" }}>
                  {fmtRoasX(selectedMetaPurchaseRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  Meta <strong>action_values[purchase]</strong> <strong>{fmtKRW(selectedMetaPurchaseValue)}</strong> / 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong> 기준이오.
                  현재 API는 <strong>action_report_time=conversion</strong>, <strong>{attrWindow ? `attribution_window=${attrWindow}` : "use_unified_attribution_setting=true"}</strong> 기준으로 맞춰 두었소.
                  Meta purchase 이벤트 {fmtNum(campaignSummary.totalPurchases)}건을 같이 보되, 운영 메인값으로는 쓰지 않소.
                  Ads Manager 화면과 맞출 때는 큰 <strong>구매 전환값</strong> 열보다 <strong>결과 ROAS</strong>와 그에 대응하는 <strong>결과 값</strong> 계열을 우선 비교하시오.
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>Attribution confirmed ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#16a34a" }}>
                  {fmtRoasX(selectedAttributedRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  confirmed attribution 매출 <strong>{fmtKRW(selectedAttributedRevenue)}</strong> / 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong> 기준이오.
                  현재 선택 사이트의 광고 귀속 확정 주문 {fmtNum(selectedAttributedOrders)}건을 기반으로 계산함. {ROAS_LAG_NOTE}
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #fffbeb, #fff)", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>confirmed + pending ROAS</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d97706" }}>
                  {fmtRoasX(selectedPotentialRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  confirmed <strong>{fmtKRW(selectedAttributedRevenue)}</strong> + pending <strong>{fmtKRW(selectedPendingRevenue)}</strong> = <strong>{fmtKRW(selectedPotentialRevenue)}</strong> 기준이오.
                  "확정 지연 때문인지, 실제 효율 저하인지"를 구분하는 보조값이며 pending 주문 {fmtNum(selectedPendingOrders)}건이 포함되오.
                </div>
              </div>
              <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(180deg, #eff6ff, #fff)", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>잠정 상한선</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#2563eb" }}>
                  {fmtRoasX(selectedBestCaseCeilingRoas)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  선택 사이트 confirmed 매출 전체 <strong>{fmtKRW(selectedSiteConfirmedRevenue)}</strong>를 현재 spend에 나눈 임시 상한선이오.
                  Ads Manager export/timezone 최종 대조 전까지 확정 상한이 아니라 <strong>잠정 상한선</strong>으로 읽어야 하며, Meta purchase ROAS가 이 값보다 과하게 크면 플랫폼 귀속 과대나 이벤트 품질 문제를 더 의심해야 하오.
                </div>
              </div>
            </div>
          )}

          {campaignSummary && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#475569", lineHeight: 1.7 }}>
              <strong style={{ color: "#0f172a" }}>ROAS 기준 정리</strong>: 이 페이지와 <Link href="/ads/roas" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>/ads/roas</Link>는 모두 <strong>Attribution 기준 ROAS</strong>를 메인으로 사용한다.
              <strong> 현재 30일 값은 rollout bias가 섞인 보수치</strong>이므로 운영 기본값은 최근 7일이오.
              Meta 구매 이벤트 기준 ROAS는
              {" "}
              <strong>{selectedMetaPurchaseRoas != null ? `${selectedMetaPurchaseRoas.toFixed(2)}x` : "—"}</strong>
              로 별도 참고만 하시오. 이 값의 분자는 PG 확정 매출이 아니라 <strong>Meta가 광고에 귀속한 conversion value</strong>이며, 현재 집계는 <strong>conversion-day</strong>와 <strong>{currentAttrWindowLabel}</strong> 기준으로 맞춰 두었소.
              Meta UI에서는 <strong>결과 ROAS</strong>와 그 옆 <strong>결과 값</strong> 계열을 비교 대상으로 고정하고, 큰 <strong>구매 전환값</strong> 열과 섞어 읽지 마시오.
              픽셀 purchase value는 쿠키 차단, 가상계좌, CAPI 누락 여부에 따라 실제 Toss 확정 매출과 차이가 날 수 있소. 또한 {ROAS_LAG_NOTE}
            </div>
          )}

          {campaignSummary && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.76rem", color: "#7c2d12", lineHeight: 1.75 }}>
              <strong style={{ color: "#9a3412" }}>Attribution 기준 ROAS 설명</strong>: 이 값은 <strong>광고비 대비, attribution ledger에서 실제로 Meta로 귀속됐고 `payment_status=confirmed`까지 된 매출</strong>만 나눈 수치요.
              기존 ROAS처럼 Ads Manager의 <strong>purchase value / spend</strong>를 그대로 쓰지 않으므로 보통 더 낮고 보수적으로 보이오.
              {selectedMetaPurchaseRoas != null && selectedAttributedRoas != null && (
                <>
                  {" "}
                  현재 선택 사이트 {currentPresetLabel} 기준으로는 광고비 <strong>{fmtKRW(campaignSummary.totalSpend)}</strong>에 대해,
                  Meta purchase value는 <strong>{fmtKRW(selectedMetaPurchaseValue)}</strong>라서 <strong>{selectedMetaPurchaseRoas.toFixed(2)}x</strong>,
                  confirmed attribution revenue는 <strong>{fmtKRW(selectedAttributedRevenue)}</strong>라서 <strong>{selectedAttributedRoas.toFixed(2)}x</strong>,
                  confirmed+pending은 <strong>{fmtKRW(selectedPotentialRevenue)}</strong>라서 <strong>{selectedPotentialRoas != null ? `${selectedPotentialRoas.toFixed(2)}x` : "—"}</strong>요.
                  두 값의 차이는 현재 약 <strong>{selectedRoasGapRatio != null ? `${selectedRoasGapRatio.toFixed(1)}배` : "—"}</strong>요.
                </>
              )}
              {" "}
              {isLongWindow
                ? `현재 ${currentPresetLabel}는 attribution live rollout 이전 광고비가 섞인 보수치라서 운영 판단 headline으로 바로 쓰기보다 최근 7일·14일과 함께 읽어야 하오.`
                : `현재 기본 탭인 ${currentPresetLabel}는 fetch-fix 이후 품질을 더 잘 반영하는 구간이오.`}
            </div>
          )}

          {campaignRoas && unmappedRow && unmappedRow.attributedRevenue > 0 && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.76rem", color: "#7c2d12", lineHeight: 1.75 }}>
              <strong style={{ color: "#9a3412" }}>(unmapped) revenue 경고</strong>: 현재 선택 사이트 confirmed attribution 매출 중
              {" "}
              <strong>{fmtKRW(unmappedRow.attributedRevenue)}</strong>
              {" "}
              ({unmappedRevenueShare != null ? `${(unmappedRevenueShare * 100).toFixed(1)}%` : "—"})
              가 아직 Meta 실제 캠페인으로 나뉘지 않았소. 즉 사이트 전체 Attribution ROAS 해석은 가능하지만, 캠페인 drill-down은 아직 불완전하오.
              {" "}
              <strong>{selectedSite.site === "biocom" ? "아래 alias 검토 섹션에서 yes / no로 수동 검증을 진행하면 된다." : "campaign별 Attribution 해석은 seed 매핑 전까지 보수적으로 읽어야 한다."}</strong>
            </div>
          )}

          {selectedSite.site === "biocom" && (
            <div style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 14, background: "linear-gradient(180deg, #ecfdf5, #fff)", border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#14532d", marginBottom: 6 }}>상담·영양제 전환 캠페인 선별 게이트</h3>
                  <div style={{ fontSize: "0.75rem", color: "#166534", lineHeight: 1.8 }}>
                    소액 증액은 Meta ROAS 상위 캠페인이 아니라, <strong>campaign id 확정 → confirmed 결제 → 상담 완료/영양제 후속 주문</strong>까지 연결된 캠페인만 통과시킵니다.
                    통과 캠페인만 전체 예산 안에서 +10~15%로 제한 테스트합니다.
                  </div>
                </div>
                <span style={{ padding: "5px 10px", borderRadius: 999, background: campaignLtvRoas ? "#dcfce7" : "#fee2e2", color: campaignLtvRoas ? "#166534" : "#991b1b", fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                  {campaignLtvRoas ? `LTV API ready ${campaignLtvRoas.summary.readyCampaigns}건` : "LTV API 확인 필요"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "1. 캠페인 확정", value: "utm_id 또는 utm_term/adset", color: "#0f766e" },
                  { label: "2. 결제 확정", value: "confirmed만 포함", color: "#16a34a" },
                  { label: "3. 후속 전환", value: "상담 완료·영양제 주문", color: "#2563eb" },
                  { label: "4. 테스트 조건", value: "2건 이상 또는 ₩50만+", color: "#d97706" },
                ].map((gate) => (
                  <div key={gate.label} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #d1fae5" }}>
                    <div style={{ fontSize: "0.64rem", color: "#94a3b8", marginBottom: 3 }}>{gate.label}</div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 800, color: gate.color }}>{gate.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #bbf7d0" }}>
                      {["1차 후보 캠페인", "campaign confirmed", "상담·영양제 게이트", "현재 액션"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#166534", fontWeight: 800 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BIOCOM_CAMPAIGN_SELECTION_CANDIDATES.map((row) => (
                      <tr key={row.campaignId} style={{ borderBottom: "1px solid #ecfdf5" }}>
                        <td style={{ padding: "8px 10px", color: "#0f172a", fontWeight: 700 }}>
                          {row.campaignName}
                          <div style={{ color: "#94a3b8", fontSize: "0.65rem", marginTop: 2 }}>{row.campaignId}</div>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#16a34a", fontWeight: 700 }}>{row.confirmedSignal}</td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>{row.followupGate}</td>
                        <td style={{ padding: "8px 10px", color: row.action.includes("보류") ? "#92400e" : "#166534", fontWeight: 800 }}>{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!campaignLtvRoas && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "0.73rem", lineHeight: 1.7 }}>
                  LTV 기준 ROAS 계산은 백엔드가 `campaign → confirmed order → customer_number → 180일 후속 주문`을 조인해야 합니다.
                  현재 상태: {campaignLtvRoasError ?? "응답 대기"}. 이 상태에서는 캠페인별 성과 표의 LTV ROAS를 보류값으로 읽어야 합니다.
                </div>
              )}
              {campaignLtvRoas && campaignRoasCoverageAgainstVm != null && campaignRoasCoverageAgainstVm < 0.8 && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "0.73rem", lineHeight: 1.7 }}>
                  캠페인별 Att/LTV ROAS는 현재 <strong>localhost:7020 alias mapper</strong> 기준입니다. VM 최신 confirmed 매출 대비
                  캠페인 매핑 커버리지가 <strong>{(campaignRoasCoverageAgainstVm * 100).toFixed(1)}%</strong>라서,
                  지금 표는 “증액 후보 선별용”이고 전체 예산 판단은 위의 VM 일별 ROAS를 우선합니다.
                </div>
              )}
            </div>
          )}

          {/* 일별 추이 차트 */}
          {daily.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일별 비용</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} labelFormatter={(l) => `${l}`} />
                    <Bar dataKey="spend" fill="#ef4444" radius={[4, 4, 0, 0]} name="비용" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일별 ROAS 비교</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
                    <Tooltip formatter={formatRoasTooltip} />
                    <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
                    <Line type="monotone" dataKey="confirmedRoas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed" />
                    <Line type="monotone" dataKey="potentialRoas" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Attr confirmed+pending" />
                    <Line type="monotone" dataKey="metaPurchaseRoas" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Meta purchase" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {daily.length > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>일자별 비교표</h3>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 8 }}>
                Attribution 원장 기준: VM <code>att.ainativeos.net</code> · 로컬 백엔드 sync 지연값 제외
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      {["날짜", "광고비", "Meta purchase", "Attr confirmed", "Attr pending", "Attr potential", "Meta ROAS", "Attr ROAS", "Potential ROAS"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((row) => (
                      <tr key={row.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#1e293b" }}>{row.date}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{fmtKRW(row.spend)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6", fontWeight: 600 }}>{fmtKRW(row.metaPurchaseValue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmtKRW(row.confirmedRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{fmtKRW(row.pendingRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f766e", fontWeight: 600 }}>{fmtKRW(row.potentialRevenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b5cf6" }}>{row.metaPurchaseRoas != null ? `${row.metaPurchaseRoas.toFixed(2)}x` : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a" }}>{row.confirmedRoas != null ? `${row.confirmedRoas.toFixed(2)}x` : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#d97706" }}>{row.potentialRoas != null ? `${row.potentialRoas.toFixed(2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 전환 퍼널 */}
          {campaignSummary && campaignSummary.totalImpressions > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>전환 퍼널</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[
                  { label: "노출", value: campaignSummary.totalImpressions, color: "#6366f1" },
                  { label: "클릭", value: campaignSummary.totalClicks, color: "#3b82f6" },
                  { label: "랜딩 뷰", value: campaignSummary.totalLandingViews, color: "#10b981" },
                  { label: "전환", value: campaignSummary.totalLeads + campaignSummary.totalPurchases, color: "#8b5cf6" },
                ].map((step, i, arr) => (
                  <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: step.color }}>{fmtNum(step.value)}</div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{step.label}</div>
                      {i > 0 && arr[i - 1].value > 0 && (
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 2 }}>
                          {((step.value / arr[i - 1].value) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    {i < arr.length - 1 && <div style={{ color: "#cbd5e1", fontSize: "1.2rem" }}>→</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 캠페인별 테이블 */}
          {campaigns.length > 0 && (
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "#fff", border: "1px solid #f1f5f9", marginBottom: 24 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>캠페인별 성과</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      {["캠페인", "노출", "클릭", "CTR", "비용", "랜딩뷰", "전환", "Meta 매출", "Meta ROAS", "Att 매출", "Att ROAS", "LTV ROAS", "추정 LTV ROAS"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => {
                      const metaRoas = c.spend > 0 && (c.purchase_value ?? 0) > 0 ? c.purchase_value! / c.spend : null;
                      const attrRow = attributionRoasByCampaignId.get(c.campaign_id);
                      const ltvRow = ltvRoasByCampaignId.get(c.campaign_id);
                      // 추정 LTV ROAS: callprice 검사유형별 LTV 승수 × Meta ROAS
                      // 광고 유입 보정: 전체 모수 재구매율의 50%만 적용 (광고 유입 고객은 자연유입 대비 재구매율 30~50% 낮음)
                      const AD_CHANNEL_DISCOUNT = 0.5;
                      const ltvMatch = matchCampaignLtv(c.campaign_name);
                      const estLtvRoas = (() => {
                        if (!ltvMatch || metaRoas == null || c.purchases <= 0) return null;
                        const avgOv = (c.purchase_value ?? 0) / c.purchases;
                        if (avgOv <= 0) return null;
                        const weightedLtv = (1 - ltvMatch.consultRate) * ltvMatch.ltvNoConsult + ltvMatch.consultRate * ltvMatch.ltvConsulted;
                        const adjustedLtv = weightedLtv * AD_CHANNEL_DISCOUNT;
                        const multiplier = (avgOv + adjustedLtv) / avgOv;
                        return metaRoas * multiplier;
                      })();
                      const ltvColor = ltvRow?.ltvStatus === "ready"
                        ? "#16a34a"
                        : ltvRow?.ltvStatus === "low_sample"
                          ? "#d97706"
                          : ltvRow
                            ? "#64748b"
                            : "#94a3b8";

                      return (
                        <tr key={c.campaign_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#1e293b", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.campaign_name}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtNum(c.impressions)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{fmtNum(c.clicks)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{c.ctr.toFixed(2)}%</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{fmtKRW(c.spend)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#10b981" }}>{fmtNum(c.landing_page_views)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{c.leads + c.purchases}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: (c.purchase_value ?? 0) > 0 ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
                            {(c.purchase_value ?? 0) > 0 ? fmtKRW(c.purchase_value!) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: metaRoas != null ? (metaRoas >= 3 ? "#16a34a" : metaRoas >= 1 ? "#d97706" : "#dc2626") : "#94a3b8" }}>
                            {fmtRoasX(metaRoas)}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: attrRow && attrRow.attributedRevenue > 0 ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
                            {attrRow && attrRow.attributedRevenue > 0 ? fmtKRW(attrRow.attributedRevenue) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: attrRow?.roas != null ? (attrRow.roas >= 3 ? "#16a34a" : attrRow.roas >= 1 ? "#d97706" : "#dc2626") : "#94a3b8" }}>
                            {fmtRoasX(attrRow?.roas)}
                          </td>
                          <td title={ltvRow?.ltvBlocker ?? `180일 LTV 매출 ${ltvRow ? fmtKRW(ltvRow.ltvRevenue) : "계산 전"}`} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: ltvColor }}>
                            {fmtRoasX(ltvRow?.ltvRoas)}
                            {ltvRow?.ltvStatus === "low_sample" && <div style={{ fontSize: "0.62rem", color: "#d97706", marginTop: 2 }}>표본 부족</div>}
                            {ltvRow?.ltvStatus === "identity_missing" && <div style={{ fontSize: "0.62rem", color: "#64748b", marginTop: 2 }}>ID 미매칭</div>}
                          </td>
                          <td title={ltvMatch ? `검사유형: ${ltvMatch.analysisType} · 상담전환율 ${(ltvMatch.consultRate * 100).toFixed(0)}% · 미상담 추가매출 ₩${ltvMatch.ltvNoConsult.toLocaleString()} · 상담 추가매출 ₩${ltvMatch.ltvConsulted.toLocaleString()}` : "검사유형 매핑 없음"} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: estLtvRoas != null ? (estLtvRoas >= 3 ? "#16a34a" : estLtvRoas >= 1 ? "#2563eb" : "#dc2626") : "#94a3b8" }}>
                            {estLtvRoas != null ? `${estLtvRoas.toFixed(2)}x` : "—"}
                            {ltvMatch && <div style={{ fontSize: "0.56rem", color: "#64748b", marginTop: 1 }}>{ltvMatch.analysisType}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: "0.7rem", color: "#64748b", lineHeight: 1.7 }}>
                <strong>Meta ROAS</strong>는 Meta purchase value / spend, <strong>Att ROAS</strong>는 Attribution confirmed revenue / spend,
                <strong> LTV ROAS</strong>는 campaign에 귀속된 confirmed 주문 고객의 180일 후속 주문 매출까지 포함한 값입니다.
                <strong> 추정 LTV ROAS</strong>는 callprice 검사유형별 상담 전환율·추가 매출 데이터로 Meta ROAS에 LTV 승수를 곱한 추정치입니다 (검사 이후 영양제·추가검사 매출 반영).
                <strong style={{ color: "#d97706" }}> 광고 유입 보정 50% 적용</strong>: 전체 모수 재구매율의 절반만 반영 (광고 유입 고객은 자연유입 대비 재구매율이 낮은 업계 통상 기준).
                Meta 유입 코호트 초기 실측: 전체 Meta 유입 47명 중 재구매 6명(<strong>12.8%</strong>), 건강기능식품 캠페인 14명 중 재구매 3명(<strong>21.4%</strong>) — 50% 보정(22%)과 거의 일치. 표본 50건+ 모이면 확정 전환.
                {selectedSite.site === "biocom" ? " 바이오컴 캠페인별 Att/LTV는 확정 alias가 반영된 localhost:7020 계산값이며, VM 최신 원장 배포 전까지 후보 선별용으로만 봅니다." : ""}
                {campaignLtvRoas ? ` 현재 LTV 계산 가능 캠페인 ${campaignLtvRoas.summary.readyCampaigns}개, 보류 ${campaignLtvRoas.summary.blockedCampaigns}개입니다.` : ` 현재 LTV 계산 상태: ${campaignLtvRoasError ?? "확인 중"}.`}
                {campaignRoasCoverageAgainstVm != null && campaignRoasCoverageAgainstVm < 0.8 ? ` VM confirmed 매출 대비 캠페인 매핑 커버리지는 ${(campaignRoasCoverageAgainstVm * 100).toFixed(1)}%입니다.` : ""}
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {campaigns.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", background: "#f8fafc", borderRadius: 14 }}>
              {selectedSite.label}에 해당 기간 광고 데이터가 없습니다.
            </div>
          )}

          {/* CAPI 퍼널 분석 */}
          <CampaignFunnelSection campaigns={campaigns} datePreset={datePreset} onDatePresetChange={setDatePreset} />

          <CampaignAliasReviewSection selectedSite={selectedSite} />

          {/* AI 인사이트 */}
          {campaignSummary && campaignSummary.totalSpend > 0 && (() => {
            const cpa = campaignSummary.totalPurchases > 0 ? campaignSummary.totalSpend / campaignSummary.totalPurchases : 0;
            const ctr = campaignSummary.totalClicks / Math.max(campaignSummary.totalImpressions, 1);
            const landingRate = campaignSummary.totalLandingViews / Math.max(campaignSummary.totalClicks, 1);
            const convRate = campaignSummary.totalPurchases / Math.max(campaignSummary.totalLandingViews, 1);
            const metaRoas = (campaignSummary.totalPurchaseValue ?? 0) > 0 ? campaignSummary.totalPurchaseValue! / campaignSummary.totalSpend : 0;
            const avgOrderValue = campaignSummary.totalPurchases > 0 ? (campaignSummary.totalPurchaseValue ?? 0) / campaignSummary.totalPurchases : 0;
            const dailySpend = campaignSummary.totalSpend / currentPresetDays;

            return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
              {/* Claude Code — 퍼널 분석 + 액션 */}
              <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #eef2ff, #fff)", border: "1px solid #c7d2fe" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🤖"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#4338ca" }}>Claude Code — 퍼널 분석 및 성장 기회</strong>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 2 }}>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>1. 퍼널 병목 진단</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      노출 {fmtNum(campaignSummary.totalImpressions)} → 클릭 {fmtNum(campaignSummary.totalClicks)} (CTR {(ctr * 100).toFixed(1)}%)
                      → 랜딩뷰 {fmtNum(campaignSummary.totalLandingViews)} (클릭 대비 {(landingRate * 100).toFixed(0)}%)
                      → 구매 {fmtNum(campaignSummary.totalPurchases)} (랜딩뷰 대비 {(convRate * 100).toFixed(1)}%).
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#6366f1" }}>
                      {landingRate < 0.5
                        ? `클릭의 ${((1 - landingRate) * 100).toFixed(0)}%가 랜딩 페이지 로딩 전에 이탈. 페이지 속도 개선이 가장 큰 기회.`
                        : convRate < 0.005
                          ? `랜딩까지는 잘 오지만 구매 전환율이 ${(convRate * 100).toFixed(2)}%로 낮음. 랜딩 페이지의 CTA/오퍼/가격 구조 점검 필요.`
                          : `퍼널 전체가 건강한 편. 클릭→랜딩 ${(landingRate * 100).toFixed(0)}%, 랜딩→구매 ${(convRate * 100).toFixed(1)}% 모두 양호.`}
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>2. 단위 경제성 (Unit Economics)</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      CPA {fmtKRW(Math.round(cpa))} · 평균 주문액 {fmtKRW(Math.round(avgOrderValue))} · Meta ROAS {metaRoas.toFixed(2)}x.
                    </p>
                    <p style={{ margin: "4px 0 0" }}>
                      {avgOrderValue > 0
                        ? `고객 1명 확보에 ${fmtKRW(Math.round(cpa))}를 쓰고, 첫 구매에서 ${fmtKRW(Math.round(avgOrderValue))}를 얻는다.
                           ${cpa < avgOrderValue * 0.3
                             ? "CPA가 주문액의 30% 미만이라 첫 구매에서 이미 수익. 공격적 확대 가능."
                             : cpa < avgOrderValue
                               ? "CPA < 주문액이라 손익분기는 넘지만, 마진율에 따라 첫 구매에서 수익이 날 수도, 아닐 수도 있음. 재구매까지 봐야 진짜 ROI."
                               : "CPA > 주문액이라 첫 구매에서는 적자. 재구매 LTV가 CPA를 커버하는지 반드시 확인 필요."}`
                        : "전환 매출 데이터가 없어 단위 경제성을 계산할 수 없음."}
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>3. 소재 효율 분석</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      CTR {(ctr * 100).toFixed(1)}%는 {ctr > 0.03 ? "3% 이상으로 매우 높음. 소재 매력도가 뛰어남." : ctr > 0.015 ? "업계 평균(1~2%) 이상. 현재 소재를 유지하되 2주 주기로 새 소재 테스트 권장." : "1.5% 미만. 소재 피로도(ad fatigue)가 의심됨. 이미지/카피/훅을 교체하고 A/B 테스트 필요."}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.76rem" }}>
                      팁: 같은 오퍼라도 고객 후기 기반 소재 vs 제품 이미지 소재의 CTR 차이가 2~3배까지 남. UGC(사용자 생성 콘텐츠) 소재 테스트를 추천.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 12 }}>
                    <strong style={{ color: "#4338ca" }}>4. Attribution Window 권장 — Claude Code 의견</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      <strong>권장: 1d_click (클릭 1일)</strong>을 운영 메인 기준으로 쓸 것.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>1d_click</strong>은 가장 보수적이고 즉시성 높은 기준 — Meta 과대 귀속을 줄이고 Attribution confirmed ROAS와 비교하기 좋음.</li>
                      <li><strong>7d_click</strong>은 보조 기준 — 검사키트/영양제처럼 고민 기간이 있는 상품의 지연 구매를 참고할 때만 같이 봄.</li>
                      <li><strong>28d_click</strong>은 과대 계상 위험 — 28일이면 다른 채널(검색, 직접 방문)에서 자연 유입된 구매도 Meta 전환으로 잡힐 가능성. 실제 광고 효과보다 부풀어 보임.</li>
                      <li><strong>1d_view</strong>는 참고용만 — "광고를 보기만 하고 구매"는 우연의 일치일 가능성이 높음. 예산 판단에는 사용하지 않을 것.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#6366f1", fontWeight: 600, fontSize: "0.76rem" }}>
                      실무 팁: Ads Manager 기본값은 참고값으로 남기되, TJ님과 논의하는 Meta ROAS headline은 클릭 1일 기준으로 통일함.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #c7d2fe" }}>
                    <strong style={{ color: "#4338ca" }}>5. 즉시 실행 가능한 액션 3가지</strong>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li style={{ marginBottom: 4 }}>
                        <strong>캠페인별 ROAS 정리</strong>: 위 테이블에서 전환 0인 캠페인의 예산을 ROAS 상위 3개에 재배분 → 같은 예산으로 전환 20~30% 증가 기대.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>CAPI/식별자 품질 점검</strong>: Purchase CAPI는 운영 중입니다. 다음 병목은 payment_success에서 GA/Meta 식별자가 빠지는 주문을 줄이는 것입니다. <a href="/ads/roas" style={{ color: "#6366f1" }}>ROAS 대시보드</a>와 아래 식별자 품질 카드를 같이 보세요.
                      </li>
                      <li>
                        <strong>리타겟팅 세분화</strong>: 랜딩뷰 {fmtNum(campaignSummary.totalLandingViews)}명 중 구매 안 한 {fmtNum(campaignSummary.totalLandingViews - campaignSummary.totalPurchases)}명을 대상으로 7일/14일 리타겟팅 광고 세트 분리. 통상 리타겟팅 ROAS는 프로스펙팅의 2~5배.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Codex — 데이터 정합성 + 전략 */}
              <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🧠"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#166534" }}>Codex — 데이터 정합성 및 전략 제안</strong>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 2 }}>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>1. 전환 데이터 신뢰도 평가</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      Meta 기준 전환 {fmtNum(campaignSummary.totalPurchases)}건 · 매출 {(campaignSummary.totalPurchaseValue ?? 0) > 0 ? fmtKRW(campaignSummary.totalPurchaseValue!) : "미수집"}. 이 숫자를 그대로 믿으면 안 되는 이유가 3가지 있음.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>Attribution window</strong>: Ads Manager 기본값은 "클릭 7일 + 조회 1일"이라 과대 가능성이 있다. 이 페이지의 운영 기준은 클릭 1일이고, default는 보조 비교값으로만 본다.</li>
                      <li><strong>식별자 누락</strong>: 서버 CAPI가 있어도 결제완료 원장에 `ga_session_id`, `client_id`, `user_pseudo_id`가 빠지면 Meta CAPI 중복 여부와 실제 광고 기여 주문을 주문 단위로 비교하기 어렵다.</li>
                      <li><strong>가상계좌 이슈</strong>: 아임웹에서 가상계좌 주문도 결제 완료 페이지에 도달하여 픽셀이 발화됨. 미입금 취소 건이 전환에 포함됐을 수 있음.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      해결: Purchase CAPI 운영 상태는 유지하고, Toss DONE 확정 주문만 서버 전송한다. 동시에 checkout_started에서 확보한 GA/Meta 식별자를 payment_success까지 이어 붙이는 작업이 다음 병목이다.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>2. 예산 최적화 — 파레토 분석</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      일 평균 광고비 약 {fmtKRW(Math.round(dailySpend))}. 캠페인별 ROAS 편차가 크다면 (위 테이블 참조), 상위 20% 캠페인이 전체 전환의 80%를 만들고 있을 가능성이 높음.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>Step 1</strong>: 전환 0인 캠페인의 예산을 즉시 줄이거나 정지</li>
                      <li><strong>Step 2</strong>: ROAS 상위 3개 캠페인에 예산 집중 (CBO 또는 수동)</li>
                      <li><strong>Step 3</strong>: 2주 후 ROAS 변화를 <a href="/ads/roas" style={{ color: "#16a34a" }}>ROAS 대시보드</a>에서 비교</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "0.76rem" }}>
                      주의: 인지도 캠페인(브랜딩)은 ROAS가 낮아도 의도적일 수 있음. 캠페인 목적(전환 vs 인지도)을 구분해서 판단할 것.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>3. 다음 단계 — 증분 측정(Incrementality)</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      현재 ROAS {metaRoas > 0 ? metaRoas.toFixed(1) + "x" : "—"}는 "광고를 클릭한 사람의 매출"이지, "광고 덕분에 생긴 매출"이 아님. 이 차이가 중요한 이유:
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li>ROAS 5x여도, 광고 없이 자연 검색으로 샀을 고객이 80%라면 실제 iROAS는 1x에 불과</li>
                      <li>반대로 ROAS 2x여도 전부 신규 고객이라면 iROAS도 2x → 가장 가치 있는 광고비</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      해결: Phase 7의 증분 실험(holdout 테스트)을 실행하면 "광고를 끄면 매출이 얼마나 줄까?"를 직접 측정 가능. iROAS 엔진은 이미 구현 완료(Phase 5.5-S3).
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 12 }}>
                    <strong style={{ color: "#166534" }}>4. Attribution Window 권장 — Codex 의견</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      <strong>데이터 엔지니어 관점에서 1d_click을 운영 기준으로 두고, 7d_click/default를 보조 비교값으로 병행</strong>할 것.
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                      <li><strong>왜 1d_click인가</strong>: "광고 클릭 후 24시간 내 구매"만 보므로 view-through와 긴 고민 기간이 섞이는 과대 효과를 줄일 수 있음.</li>
                      <li><strong>왜 7d_click도 봐야 하는가</strong>: 7d_click은 지연 구매를 보는 보조값. 1d_click 대비 7d_click이 과도하게 높으면 리타겟팅/검색/재방문 기여가 섞였을 가능성을 점검함.</li>
                      <li><strong>28d_click은 전략 점검용</strong>: 28d와 7d의 차이가 큰 캠페인은 "고객이 오래 고민하고 사는" 상품. 이런 캠페인에는 리타겟팅을 강화하면 7d 전환을 끌어올릴 수 있음.</li>
                      <li><strong>CAPI와의 관계</strong>: 서버사이드 전환(CAPI)을 켜면 1d_click 숫자가 가장 많이 올라감. iOS에서 누락되던 즉시 전환이 복구되기 때문. CAPI 적용 전/후를 1d_click 기준으로 비교하면 CAPI 효과를 가장 명확하게 측정 가능.</li>
                    </ul>
                    <p style={{ margin: "6px 0 0", color: "#16a34a", fontWeight: 600, fontSize: "0.76rem" }}>
                      자동화 제안: 매주 월요일 1d_click vs 7d_click/default 전환 비율을 자동 산출하여, 지연 전환과 view-through 의존도가 커지는 캠페인을 분리함.
                    </p>
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                    <strong style={{ color: "#166534" }}>5. 로드맵 — 다음에 개발할 것</strong>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li style={{ marginBottom: 4 }}>
                        <strong>CAPI dedup/EMQ 점검</strong> → Events Manager에서 browser/server 중복 제거, 이벤트 매칭 품질, event_id 경고 확인.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>캠페인별 ROAS 자동 경고</strong>: ROAS가 1x 미만으로 3일 연속 떨어지면 슬랙/알림톡으로 자동 알림. 예산 낭비 조기 차단.
                      </li>
                      <li style={{ marginBottom: 4 }}>
                        <strong>광고 → CRM 연결</strong>: Meta 광고로 유입된 고객이 CRM 알림톡을 받고 재구매하면, 광고의 진짜 LTV 기여분을 산출. 현재 attribution ledger + 발송 로그로 기술적으로 가능.
                      </li>
                      <li>
                        <strong>크리에이티브 A/B 자동 리포트</strong>: 소재별(이미지/카피) CTR·CPA·ROAS를 자동 비교하여 승자/패자 소재를 식별. 마케터가 매주 수동으로 분석하는 시간을 절약.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* CAPI 현황 + 가설 검증 */}
          <CapiStatusSection />

          {/* 결제완료 식별자 품질 */}
          <AttributionCallerCoverageSection />

          {/* 캠페인 관리 */}
          <CampaignManagerSection selectedSite={selectedSite!} />

          {/* UX 분석 · Clarity 현황 */}
          {campaignSummary && campaignSummary.totalLandingViews > 0 && (() => {
            const clickToLanding = campaignSummary.totalLandingViews / Math.max(campaignSummary.totalClicks, 1);
            const totalConversions = campaignSummary.totalLeads + campaignSummary.totalPurchases;
            const landingToConv = totalConversions / Math.max(campaignSummary.totalLandingViews, 1);
            const droppedClicks = campaignSummary.totalClicks - campaignSummary.totalLandingViews;
            const isLeadSite = selectedSite.site === "aibio";
            const convLabel = isLeadSite ? "리드(상담예약)" : "구매";
            const convBenchmark = isLeadSite ? "리드 전환율 벤치마크: 3~8%" : "구매 전환율 벤치마크: 1~3%";

            return (
            <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #fff7ed, #fff)", border: "1px solid #fed7aa", marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.1rem" }}>{"🔥"}</span>
                  <strong style={{ fontSize: "0.92rem", color: "#c2410c" }}>퍼널 병목 · Clarity UX 분석 — {selectedSite.label}</strong>
                </div>
                <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>
                  Clarity 3사이트 설치 완료
                </span>
              </div>

              {/* 병목 현황 KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: clickToLanding < 0.6 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${clickToLanding < 0.6 ? "#fecaca" : "#bbf7d0"}` }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>클릭 → 랜딩뷰</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: clickToLanding < 0.6 ? "#dc2626" : "#16a34a" }}>{(clickToLanding * 100).toFixed(1)}%</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                    {clickToLanding < 0.6 ? `이탈 ${fmtNum(droppedClicks)}건 — 업계 평균(60~70%) 미달` : clickToLanding > 0.85 ? `양호 (업계 평균 60~70%)` : "정상 범위"}
                  </div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>랜딩뷰 → {convLabel} 전환율</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: landingToConv > 0.01 ? "#16a34a" : "#d97706" }}>{(landingToConv * 100).toFixed(2)}%</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>{convBenchmark}</div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{convLabel} 전환</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, color: totalConversions > 0 ? "#16a34a" : "#d97706" }}>{fmtNum(totalConversions)}건</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                    {totalConversions > 0 ? `비용 대비 ${fmtKRW(campaignSummary.totalSpend / totalConversions)}/건` : isLeadSite ? "리드 캠페인 데이터 축적 중" : "전환 데이터 확인 필요"}
                  </div>
                </div>
              </div>

              {/* Clarity 운영 현황 */}
              <div style={{ padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong style={{ fontSize: "0.82rem", color: "#16a34a" }}>Microsoft Clarity — 운영 중</strong>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                      3사이트 GTM 연동 완료 (바이오컴 · AIBIO · 더클린커피) · 봇 감지 ON · 세션 리플레이 수집 중
                    </div>
                  </div>
                  <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                    border: "1px solid #16a34a", background: "#fff", color: "#16a34a", textDecoration: "none",
                  }}>
                    Clarity 대시보드 →
                  </a>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 }}>
                  {[
                    { label: "Dead clicks", desc: "클릭했는데 반응 없는 UI", where: "Dashboard" },
                    { label: "Rage clicks", desc: "연속 클릭 = 사용자 좌절", where: "Dashboard" },
                    { label: "스크롤 depth", desc: "CTA까지 도달하는 비율", where: "Heatmaps" },
                    { label: "세션 리플레이", desc: "이탈자 행동 패턴 추적", where: "Recordings" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "8px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.72rem" }}>
                      <div style={{ fontWeight: 700, color: "#334155" }}>{item.label}</div>
                      <div style={{ color: "#64748b", marginTop: 2 }}>{item.desc}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.64rem", marginTop: 2 }}>위치: {item.where}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 사이트별 Claude Code vs Codex 인사이트 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e0e7ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: "0.9rem" }}>{"🤖"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>Claude Code — {selectedSite.label} 분석</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                    {isLeadSite ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#16a34a" }}>랜딩뷰 우수 — 전환 최적화가 핵심</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            클릭→랜딩뷰 {(clickToLanding * 100).toFixed(1)}%로 양호. 페이지 속도 문제 아님.
                            핵심은 랜딩뷰→리드(상담예약) 전환율 개선.
                            Clarity 히트맵으로 상담 예약 폼까지 스크롤하는 비율, 폼 입력 중 이탈 지점 확인.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe", marginBottom: 10 }}>
                          <strong style={{ color: "#4338ca" }}>리드 캠페인 전환 추적</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            LEADS 캠페인 활성화됨. Meta AI가 "상담 예약 가능성 높은 사람"에게 최적화 시작.
                            generate_lead 이벤트(GTM)가 Meta 픽셀 Lead로 매핑되어 전환 집계됨.
                            리드 50건 이상 쌓이면 CPL(리드당 비용) 안정화 예상.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <strong style={{ color: "#d97706" }}>Clarity에서 확인할 것</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>상담 예약 CTA 버튼까지 스크롤 도달률</li>
                            <li style={{ marginBottom: 3 }}>모바일 vs 데스크톱 폼 제출 완료율 비교</li>
                            <li>Rage clicks — 예약 버튼/가격 영역에서 좌절 패턴</li>
                          </ol>
                        </div>
                      </>
                    ) : selectedSite.site === "thecleancoffee" ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#16a34a" }}>Meta 광고 계정 연동 완료 — 퍼널은 양호</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            최근 7일 1d_click 기준 클릭 {fmtNum(campaignSummary.totalClicks)}건 → 랜딩뷰 {fmtNum(campaignSummary.totalLandingViews)}건
                            ({(clickToLanding * 100).toFixed(1)}%) → 구매 {fmtNum(campaignSummary.totalPurchases)}건
                            ({(landingToConv * 100).toFixed(2)}%).
                            클릭→랜딩 {(clickToLanding * 100).toFixed(1)}%는 정상 이상이고, 랜딩→구매 {(landingToConv * 100).toFixed(2)}%는 일반 커머스 벤치마크 1~3%보다 높다.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", marginBottom: 10 }}>
                          <strong style={{ color: "#d97706" }}>Att ROAS 낮음은 UX보다 식별자/귀속 문제</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            Meta 구매 {fmtNum(campaignSummary.totalPurchases)}건 중 내부 Attribution confirmed는 {fmtNum(selectedAttributedOrders)}건입니다.
                            사이트 전체 confirmed 주문 {fmtNum(selectedSiteSummary?.siteConfirmedOrders ?? 0)}건과 비교해도 광고 귀속 주문이 적습니다.
                            먼저 결제완료 식별자 coverage와 clean baseline을 보강해야 합니다.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                          <strong style={{ color: "#4338ca" }}>Clarity에서 확인할 것</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>모바일 상품 옵션 선택 후 장바구니/구매 버튼까지 막힘 없는지</li>
                            <li style={{ marginBottom: 3 }}>네이버페이·카카오싱크·토스 복귀 구간에서 결제완료 페이지 진입이 끊기는지</li>
                            <li>구매하지 않은 랜딩뷰 {fmtNum(Math.max(0, campaignSummary.totalLandingViews - campaignSummary.totalPurchases))}명의 Dead click/Rage click 패턴</li>
                          </ol>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 10 }}>
                          <strong style={{ color: "#dc2626" }}>1순위: 페이지 속도 개선</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            클릭→랜딩뷰 {(100 - clickToLanding * 100).toFixed(0)}% 이탈은 페이지 도달 전 이탈.
                            Clarity JS 로드 전에 사용자가 떠나므로 세션이 기록되지 않는 구간.
                            PageSpeed 진단 → LCP/FCP 개선이 최우선. 상세 분석은 랜딩뷰 분석 페이지에서.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#16a34a" }}>Clarity 역할: 랜딩뷰→구매 전환율</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            현재 {(landingToConv * 100).toFixed(2)}% 전환율을 2%로 올리면 월 +{fmtNum(Math.round(campaignSummary.totalLandingViews * 0.0075))}건 추가 전환.
                            히트맵/세션 리플레이로 CTA 위치, 스크롤 depth, 결제 퍼널 이탈 지점 분석.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                          <strong style={{ color: "#4338ca" }}>즉시 실행</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}><strong>PageSpeed 진단</strong>: {selectedSite.label} 랜딩 페이지 LCP/FCP/CLS 확인</li>
                            <li style={{ marginBottom: 3 }}><strong>Clarity Dead clicks</strong>: 클릭했는데 반응 없는 UI 요소 탐색</li>
                            <li><strong>결제 퍼널 리플레이</strong>: 장바구니→결제 이탈 세션 확인</li>
                          </ol>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1px solid #bbf7d0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: "0.9rem" }}>{"🧠"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "#166534" }}>Codex — {selectedSite.label} 제안</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.9 }}>
                    {isLeadSite ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>리드 퍼널 벤치마크</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            오프라인 서비스 리드 전환율 벤치마크: 3~8%.
                            현재 {(landingToConv * 100).toFixed(2)}%{landingToConv < 0.03 ? " — 벤치마크 미달. CTA 가시성, 폼 간소화 필요." : " — 양호 범위."}
                            리드 캠페인 데이터가 50건+ 쌓이면 CPL 기준으로 입찰 전략 전환 가능.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>Clarity 분석 우선순위</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>모바일 상담 예약 폼 완료율 (대부분 모바일 유입)</li>
                            <li style={{ marginBottom: 3 }}>가격/서비스 설명 영역 체류 시간</li>
                            <li style={{ marginBottom: 3 }}>후기/리뷰 섹션 스크롤 도달률</li>
                            <li>경쟁사 대비 CTA 배치 A/B 테스트</li>
                          </ol>
                        </div>
                      </>
                    ) : selectedSite.site === "thecleancoffee" ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>데이터 판단</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            더클린커피는 페이지 도달과 구매 전환이 약하지 않습니다.
                            Meta ROAS {fmtRoasX(selectedMetaPurchaseRoas)}, Att ROAS {fmtRoasX(selectedAttributedRoas)}, 사이트 전체 상한 {fmtRoasX(selectedBestCaseCeilingRoas)}의 간격이 크므로
                            UX 개선보다 payment_success identity carry-over가 우선입니다.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>신뢰 가능한 날짜</strong>
                          <p style={{ margin: "4px 0 0" }}>
                            CAPI/footer v3는 {COFFEE_CAPI_SNAPSHOT_KST} 배포, source-label 교정은 {COFFEE_CAPI_SOURCE_REPAIR_KST}.
                            2026-04-16부터 clean day로 보고, 2026-04-23 아침 7일 baseline이 쌓이면 광고 효율 판단에 쓸 수 있습니다.
                          </p>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                          <strong style={{ color: "#166534" }}>다음 액션</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>결제완료 식별자 coverage를 80% 이상으로 올림</li>
                            <li style={{ marginBottom: 3 }}>Clarity에서 결제 복귀/완료 페이지 세션 리플레이 20건 수동 확인</li>
                            <li>릴스/스토리와 이미지 캠페인을 Meta ROAS, Att ROAS, clean baseline으로 재비교</li>
                          </ol>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 10 }}>
                          <strong style={{ color: "#166534" }}>도구별 현황</strong>
                          <table style={{ width: "100%", fontSize: "0.72rem", borderCollapse: "collapse", marginTop: 6 }}>
                            <tbody>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>Microsoft Clarity</td>
                                <td style={{ padding: "4px 6px" }}>무제한 세션 리플레이, 히트맵, Rage click</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>운영 중</td>
                              </tr>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>CAPI</td>
                                <td style={{ padding: "4px 6px" }}>서버사이드 전환 추적 (iOS 복구)</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>운영 중</td>
                              </tr>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>GA4</td>
                                <td style={{ padding: "4px 6px" }}>디바이스별/캠페인별 이탈률 세분화</td>
                                <td style={{ padding: "4px 6px", color: "#16a34a", fontWeight: 600 }}>연동 완료</td>
                              </tr>
                              <tr>
                                <td style={{ padding: "4px 6px", fontWeight: 600 }}>Hotjar 유료</td>
                                <td style={{ padding: "4px 6px" }}>설문/피드백 위젯이 필요할 때</td>
                                <td style={{ padding: "4px 6px", color: "#94a3b8" }}>필요시 판단</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                          <strong style={{ color: "#166534" }}>고도화 로드맵</strong>
                          <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
                            <li style={{ marginBottom: 3 }}>Clarity 2주 데이터 축적 후 첫 UX 병목 보고서</li>
                            <li style={{ marginBottom: 3 }}>캠페인별 랜딩 URL 성과 비교 대시보드</li>
                            <li style={{ marginBottom: 3 }}>경량 랜딩 페이지 A/B 테스트 (LCP 1~2초 목표)</li>
                            <li>Clarity API 연동 (세션 수/Dead clicks 자동 표시)</li>
                          </ol>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 상세 분석 링크 */}
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <a href="/ads/landing" style={{ fontSize: "0.82rem", color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
                  랜딩뷰 상세 분석 · PageSpeed · Clarity 가이드 →
                </a>
              </div>
            </div>
            );
          })()}
        </>
      )}
    </div>
    </>
  );
}

function AibioMetricCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.08rem", fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.5, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function AibioStrategyBox({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: `1px solid ${accent}55`, fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
      <strong style={{ color: accent, fontSize: "0.82rem" }}>{title}</strong>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function AibioCsoStrategySection({
  campaignSummary,
  acquisition,
  acquisitionLoading,
  acquisitionError,
  currentPresetLabel,
}: {
  campaignSummary: CampaignSummary;
  acquisition: AibioAcquisitionSite | null;
  acquisitionLoading: boolean;
  acquisitionError: string | null;
  currentPresetLabel: string;
}) {
  const fmtPct = (value: number | null | undefined) => (
    value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—"
  );
  const spend = campaignSummary.totalSpend;
  const clickToLanding = campaignSummary.totalClicks > 0
    ? campaignSummary.totalLandingViews / campaignSummary.totalClicks
    : null;
  const internalForms = acquisition?.operationalConversions ?? 0;
  const rawForms = acquisition?.rawConversions ?? 0;
  const excludedForms = acquisition?.excludedConversions ?? 0;
  const metaChannel = acquisition?.channels.find((channel) => channel.key === "meta") ?? null;
  const metaForms = metaChannel?.count ?? 0;
  const internalFormRate = campaignSummary.totalLandingViews > 0 && internalForms > 0
    ? internalForms / campaignSummary.totalLandingViews
    : null;
  const cplByInternal = internalForms > 0 ? spend / internalForms : null;
  const cplByMetaForms = metaForms > 0 ? spend / metaForms : null;
  const topLanding = acquisition?.landings[0] ?? null;
  const topCampaign = acquisition?.campaigns.find((row) => row.label !== "(campaign 없음)") ?? acquisition?.campaigns[0] ?? null;
  const platformLeadEvents = campaignSummary.totalLeads;
  const platformPurchaseEvents = campaignSummary.totalPurchases;
  const hasInternalButNoMetaLead = internalForms > 0 && platformLeadEvents === 0;

  return (
    <div style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 620px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 800, marginBottom: 4 }}>
            AIBIO CSO 판단 · 리커버리랩 전환 설계
          </div>
          <div style={{ fontSize: "1.02rem", fontWeight: 900, color: "#0f172a", lineHeight: 1.55 }}>
            전체 Meta를 끄기보다, 전환 계측을 먼저 맞추고 트래픽 목표 예산만 통제하는 쪽이 맞습니다.
          </div>
          <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#475569", lineHeight: 1.75 }}>
            현재 광고는 사람을 데려오고 있습니다. 문제는 수요 부재가 아니라
            <strong> Meta API Lead {fmtNum(platformLeadEvents)}건</strong>과 <strong>내부 form_submit {acquisitionLoading ? "확인 중" : `${fmtNum(internalForms)}건`}</strong>이 갈라진 상태입니다.
            이 상태에서 예산을 크게 늘리면 Meta는 아직 "좋은 리드"를 학습하지 못하고, 반대로 전부 멈추면 이미 들어오는 상담 신호를 잃습니다.
          </div>
        </div>
        <span style={{
          padding: "6px 12px",
          borderRadius: 8,
          background: hasInternalButNoMetaLead ? "#fff7ed" : "#ecfdf5",
          color: hasInternalButNoMetaLead ? "#9a3412" : "#047857",
          border: `1px solid ${hasInternalButNoMetaLead ? "#fed7aa" : "#a7f3d0"}`,
          fontSize: "0.7rem",
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}>
          {hasInternalButNoMetaLead ? "계측 정합성 우선" : "전환 신호 확인 중"}
        </span>
      </div>

      {acquisitionError && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.74rem" }}>
          AIBIO 내부 전환 원장 조회 실패: {acquisitionError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
        <AibioMetricCard
          label="선택 기간 광고비"
          value={fmtKRW(spend)}
          note={`${currentPresetLabel} · Meta API 기준`}
          color="#ef4444"
        />
        <AibioMetricCard
          label="Meta API Lead"
          value={`${fmtNum(platformLeadEvents)}건`}
          note={`Purchase ${fmtNum(platformPurchaseEvents)}건 · Ads Manager 학습 신호는 아직 약함`}
          color={platformLeadEvents > 0 ? "#16a34a" : "#dc2626"}
        />
        <AibioMetricCard
          label="내부 form_submit"
          value={acquisitionLoading ? "확인 중" : `${fmtNum(internalForms)}건`}
          note={acquisition ? `raw ${fmtNum(rawForms)}건 중 테스트 ${fmtNum(excludedForms)}건 제외` : "VM attribution 원장 기준"}
          color={internalForms > 0 ? "#16a34a" : "#d97706"}
        />
        <AibioMetricCard
          label="Meta/Instagram 폼"
          value={acquisitionLoading ? "확인 중" : `${fmtNum(metaForms)}건`}
          note={metaChannel ? `내부 폼의 ${metaChannel.share.toFixed(1)}% · ${metaChannel.examples?.slice(0, 2).join(", ") ?? "campaign 확인"}` : "fbclid/fbc/fbp/Instagram referrer 기준"}
          color="#2563eb"
        />
        <AibioMetricCard
          label="내부 기준 CPL"
          value={cplByInternal != null ? fmtKRW(cplByInternal) : "—"}
          note={cplByMetaForms != null ? `Meta 유입 폼 기준 ${fmtKRW(cplByMetaForms)}/건` : "폼 표본이 쌓이면 판단 가능"}
          color="#0f766e"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
        <AibioStrategyBox title="1. 전환은 하나가 아니라 단계로 쪼갭니다" accent="#0f766e">
          <p style={{ margin: 0 }}>
            메인 전환은 계속 <strong>form_submit</strong>입니다. 보조 전환은
            <strong> 카카오톡 클릭</strong>, <strong>채널톡 열기</strong>, <strong>체험권 결제 시작</strong>,
            <strong> 1분 체류</strong>, <strong>90% 스크롤</strong>, <strong>CTA 클릭</strong>으로 나눕니다.
            보조 전환은 ROAS 분자가 아니라 리타겟팅과 UX 병목 찾기용입니다.
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            GTM 이벤트명 제안: <code>aibio_kakao_click</code>, <code>aibio_channeltalk_open</code>,
            <code>aibio_ticket_checkout</code>, <code>aibio_engaged_60s</code>, <code>aibio_scroll_90</code>.
          </p>
        </AibioStrategyBox>

        <AibioStrategyBox title="2. 카카오톡은 즉시, 채널톡은 운영 준비 후" accent="#2563eb">
          <p style={{ margin: 0 }}>
            AIBIO는 고관여 오프라인 서비스라 즉시 질문 채널이 전환율에 영향을 줍니다.
            <strong> 카카오톡 버튼은 우선 적용</strong>이 맞습니다. 이미 GTM에 카톡채널 클릭 트리거가 있으므로, 고정 CTA와 클릭 이벤트만 안정화하면 됩니다.
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            채널톡은 응답 담당자, 운영 시간, FAQ, 리드 소유자 필드가 준비될 때 붙입니다. 응답이 느리면 위젯은 신뢰를 깎으므로 카카오톡보다 늦게 여는 편이 낫습니다.
          </p>
        </AibioStrategyBox>

        <AibioStrategyBox title="3. shop은 전체 상점보다 체험권 1개부터" accent="#d97706">
          <p style={{ margin: 0 }}>
            {topLanding ? (
              <>
                현재 내부 폼의 <strong>{topLanding.share.toFixed(1)}%</strong>가 <strong>{topLanding.label}</strong>에서 나옵니다.
                이미 shop_view 맥락이 리드를 만들고 있으므로, 전체 쇼핑몰보다 <strong>예약금형 체험권</strong> 1개를 먼저 테스트하는 게 맞습니다.
              </>
            ) : (
              <>체험권은 가능하지만 전체 shop을 먼저 키우면 폼 제출보다 마찰이 커질 수 있습니다.</>
            )}
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            추천 상품은 무료 상담을 대체하는 고가 상품이 아니라, 환불 가능하거나 방문 시 차감되는 소액 예약금입니다.
            결제 시작과 구매가 생기면 Meta에는 더 강한 가치 신호가 생깁니다.
          </p>
        </AibioStrategyBox>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
          <strong style={{ color: "#0f172a", fontSize: "0.82rem" }}>Meta 광고 운영안</strong>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li style={{ marginBottom: 5 }}>
              <strong>전체 중단은 하지 않습니다.</strong> 내부 원장에는 폼이 들어오고, 그중 Meta/Instagram 비중이 높습니다. 수요가 없는 캠페인으로 단정하기 이릅니다.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>증액은 금지합니다.</strong> Meta Lead가 0인 동안은 알고리즘이 리드 품질을 못 배우므로, 예산 확대보다 Lead 이벤트 정합성 확인이 먼저입니다.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>트래픽 목표 캠페인은 감액/일시정지 후보입니다.</strong> 랜딩뷰 최적화는 싼 클릭을 잘 만들지만 상담 가능성이 높은 사람을 찾는 목표가 아닙니다.
            </li>
            <li>
              <strong>48시간 게이트:</strong> Events Manager와 Ads API에서 Lead가 보이면 리드 캠페인만 유지, 계속 0이면 태그/맞춤전환을 고친 뒤 재개합니다.
            </li>
          </ol>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
          <strong style={{ color: "#0f172a", fontSize: "0.82rem" }}>다음 의사결정 기준</strong>
          <div style={{ marginTop: 8 }}>
            <div>클릭→랜딩: <strong>{fmtPct(clickToLanding)}</strong></div>
            <div>랜딩→내부 폼: <strong>{fmtPct(internalFormRate)}</strong></div>
            <div>상위 원장 캠페인: <strong>{topCampaign?.label ?? "확인 중"}</strong></div>
            <div>최신 폼 제출: <strong>{formatDateTime(acquisition?.latestLoggedAt ?? null)}</strong></div>
          </div>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            진짜 CSO 지표는 폼 제출 수가 아니라 <strong>폼 제출→상담 연결→예약 확정→방문→체험권/본상품 결제</strong>입니다.
            이 후속 전환율이 붙기 전까지 Meta ROAS 대신 CPL과 상담 연결률로 판단해야 합니다.
          </p>
        </div>
      </div>

      {acquisition?.dataWarnings?.length ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.72rem", color: "#92400e", lineHeight: 1.65 }}>
          <strong>데이터 주의:</strong> {acquisition.dataWarnings.join(" ")}
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════
   CAPI 퍼널 분석 섹션
   ══════════════════════════════════════════ */
function CampaignFunnelSection({ campaigns, datePreset, onDatePresetChange }: { campaigns: CampaignRow[]; datePreset: string; onDatePresetChange: (v: string) => void }) {
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const funnelCampaigns = campaigns.filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);
  if (funnelCampaigns.length === 0) return null;

  const hasCapi = (c: CampaignRow): boolean =>
    (c.view_content ?? 0) > 0 || (c.add_to_cart ?? 0) > 0 || (c.initiate_checkout ?? 0) > 0;
  const hasAnyCapi = funnelCampaigns.some(hasCapi);

  const calcRate = (from: number, to: number): number | null => from <= 0 ? null : to / from;
  const fmtPct = (rate: number | null): string => rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;

  // 퍼널 건강 점수 (0~100)
  const calcFunnelScore = (c: CampaignRow): { score: number; grade: string; color: string; reasons: string[] } => {
    const reasons: string[] = [];
    let score = 50; // 기본
    const cHasCapi = hasCapi(c);

    // 1. 클릭→랜딩 전환율 (Meta 서버 측정 기준) — 임계값 rateColor와 통일: 0.7/0.5
    const clkToLand = c.clicks > 0 ? c.landing_page_views / c.clicks : 0;
    if (clkToLand >= 0.7) { score += 10; reasons.push(`클릭→랜딩 ${(clkToLand * 100).toFixed(0)}% 우수`); }
    else if (clkToLand >= 0.5) { score += 5; }
    else if (clkToLand > 0) { score -= 5; reasons.push(`클릭→랜딩 ${(clkToLand * 100).toFixed(0)}%, 이탈 높음`); }

    if (cHasCapi) {
      const vc = c.view_content ?? 0;
      const atc = c.add_to_cart ?? 0;
      const ic = c.initiate_checkout ?? 0;

      // 2. 장바구니 담기율 (ViewContent 대비) — 0건도 치명 병목으로 감지
      if (vc > 0) {
        const cartRate = atc / vc;
        if (atc === 0) { score -= 15; reasons.push(`조회 ${vc.toLocaleString()}건인데 장바구니 0건 → 상품/가격 점검`); }
        else if (cartRate >= 0.03) { score += 15; reasons.push(`장바구니율 ${(cartRate * 100).toFixed(1)}% 양호`); }
        else if (cartRate >= 0.01) { score += 5; }
        else { score -= 10; reasons.push(`장바구니율 ${(cartRate * 100).toFixed(1)}%, 기준 1% 미만`); }
      }

      // 3. 결제 완료율 (결제 시작 대비) — 0건도 감지
      if (ic > 0) {
        const purchaseRate = c.purchases / ic;
        if (c.purchases === 0) { score -= 15; reasons.push(`결제시작 ${ic}건인데 구매 0건 → 결제 UX/PG 점검`); }
        else if (purchaseRate >= 0.4) { score += 15; reasons.push(`결제완료율 ${(purchaseRate * 100).toFixed(0)}% 우수`); }
        else if (purchaseRate >= 0.2) { score += 5; }
        else { score -= 10; reasons.push(`결제완료율 ${(purchaseRate * 100).toFixed(0)}%, 이탈 높음`); }
      }

      // 4. 전체 통과율 (ViewContent → Purchase)
      if (vc > 0) {
        const throughRate = c.purchases / vc;
        if (throughRate >= 0.02) { score += 10; reasons.push(`전체 통과율 ${(throughRate * 100).toFixed(2)}% 양호`); }
        else if (throughRate < 0.005) { score -= 10; reasons.push(`전체 통과율 ${(throughRate * 100).toFixed(2)}% 매우 낮음`); }
      }
    } else {
      // CAPI 없을 때 랜딩→구매로만 판단
      const landToPurch = c.landing_page_views > 0 ? c.purchases / c.landing_page_views : 0;
      if (landToPurch >= 0.02) { score += 15; reasons.push(`랜딩→구매 ${(landToPurch * 100).toFixed(1)}% 양호`); }
      else if (landToPurch >= 0.01) { score += 5; }
      else if (landToPurch > 0) { score -= 5; reasons.push(`랜딩→구매 ${(landToPurch * 100).toFixed(1)}% 낮음`); }
      else { score -= 15; reasons.push("구매 전환 없음"); }
    }

    // 5. 구매 볼륨 보정
    if (c.purchases >= 50) { score += 5; }
    else if (c.purchases < 10) { score -= 5; reasons.push("구매 건수 적어 통계 신뢰도 낮음"); }

    // 6. CPA 보조 지표 (ROAS 대용)
    if (c.purchases > 0) {
      const cpa = c.spend / c.purchases;
      const avgValue = (c.purchase_value ?? 0) / c.purchases;
      if (avgValue > 0 && cpa < avgValue * 0.5) { score += 5; reasons.push(`CPA ₩${Math.round(cpa).toLocaleString()} < 객단가 절반`); }
      else if (avgValue > 0 && cpa > avgValue) { score -= 5; reasons.push(`CPA ₩${Math.round(cpa).toLocaleString()} > 객단가 ₩${Math.round(avgValue).toLocaleString()}`); }
    }

    score = Math.min(100, Math.max(0, score));
    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
    const color = score >= 80 ? "#16a34a" : score >= 60 ? "#3b82f6" : score >= 40 ? "#d97706" : "#dc2626";
    return { score, grade, color, reasons };
  };

  type FunnelStep = { key: string; label: string; value: number; color: string; source: string };

  const buildFunnel = (c: CampaignRow): FunnelStep[] => [
    { key: "impressions", label: "노출", value: c.impressions, color: "#94a3b8", source: "Meta Ads" },
    { key: "clicks", label: "클릭", value: c.clicks, color: "#64748b", source: "Meta Ads" },
    { key: "landing", label: "랜딩뷰", value: c.landing_page_views, color: "#3b82f6", source: "Meta Ads" },
    { key: "view_content", label: "상품 조회", value: c.view_content ?? 0, color: "#8b5cf6", source: "imweb Pixel" },
    { key: "add_to_cart", label: "장바구니", value: c.add_to_cart ?? 0, color: "#f59e0b", source: "imweb Pixel" },
    { key: "checkout", label: "결제 시작", value: c.initiate_checkout ?? 0, color: "#f97316", source: "imweb Pixel" },
    { key: "purchase", label: "구매 완료", value: c.purchases, color: "#16a34a", source: "Pixel+서버CAPI" },
  ];

  // 임계값을 calcFunnelScore와 통일 (landing: 0.7/0.5, cart: 0.03/0.01)
  const rateColor = (rate: number | null, step: string): string => {
    if (rate == null) return "#94a3b8";
    if (step === "cart") return rate >= 0.03 ? "#16a34a" : rate >= 0.01 ? "#d97706" : "#dc2626";
    if (step === "land_checkout") return rate >= 0.03 ? "#16a34a" : rate >= 0.01 ? "#d97706" : "#dc2626"; // 랜딩→결제시작 (장바구니 스킵 포함)
    if (step === "checkout") return rate >= 0.3 ? "#16a34a" : rate >= 0.1 ? "#d97706" : "#dc2626";
    if (step === "purchase") return rate >= 0.4 ? "#16a34a" : rate >= 0.2 ? "#d97706" : "#dc2626";
    if (step === "landing") return rate >= 0.7 ? "#16a34a" : rate >= 0.5 ? "#d97706" : "#dc2626";
    if (step === "overall") return rate >= 0.02 ? "#16a34a" : rate >= 0.005 ? "#d97706" : "#dc2626";
    return "#64748b";
  };

  // 기간 계산
  const presetDays = DATE_PRESET_DAY_COUNTS[datePreset] ?? 7;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Meta는 어제까지 집계
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - presetDays + 1);
  const fmtDate = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const presetLabel = DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? datePreset;

  return (
    <div style={{ padding: "20px 22px", borderRadius: 14, background: "linear-gradient(180deg, #f8fafc, #fff)", border: "1px solid #e2e8f0", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>퍼널 분석</h3>
          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 500 }}>{fmtDate(startDate)} ~ {fmtDate(endDate)}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {DATE_PRESETS.map((dp) => (
            <button
              key={dp.value}
              onClick={() => onDatePresetChange(dp.value)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.66rem", fontWeight: 600, cursor: "pointer",
                background: datePreset === dp.value ? "#6366f1" : "#fff",
                color: datePreset === dp.value ? "#fff" : "#64748b",
                transition: "all 0.15s",
              }}
            >
              {dp.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
        노출·클릭·랜딩뷰 = <span style={{ color: "#3b82f6", fontWeight: 600 }}>Meta Ads 서버 측정</span> &nbsp;|&nbsp;
        상품조회·장바구니·결제시작 = <span style={{ color: "#8b5cf6", fontWeight: 600 }}>Meta Pixel (imweb 쇼핑몰 자동 발화)</span> &nbsp;|&nbsp;
        구매 = <span style={{ color: "#16a34a", fontWeight: 600 }}>Pixel + 자체 서버 CAPI</span>
        {hasAnyCapi && <span> &nbsp;|&nbsp; 조회 &gt; 랜딩인 경우 = Meta 뷰스루 어트리뷰션 포함</span>}
        <br />
        <span style={{ color: "#64748b" }}>랜딩뷰 = 광고 클릭 후 페이지가 실제로 로드 완료된 횟수 (클릭했지만 로딩 전 이탈한 경우 제외)</span>
        <br />
        <span style={{ color: "#b45309" }}>구매 건수는 해당 캠페인 광고를 통해 유입된 사용자의 전체 구매이며, 광고 상품이 아닌 다른 상품 구매도 포함됨 (Meta 어트리뷰션 특성)</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#64748b" }}>캠페인</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", width: 60 }}>점수</th>
              <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>비용</th>
              <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#64748b" }}>구매</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>클릭→랜딩</th>
              {hasAnyCapi && <>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>조회→장바구니</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>랜딩→결제</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>결제→구매</th>
              </>}
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>랜딩→구매</th>
              <th style={{ padding: "8px 10px", width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {funnelCampaigns.map((c) => {
              const isExpanded = expandedCampaign === c.campaign_id;
              const fs = calcFunnelScore(c);
              const funnel = buildFunnel(c);
              const clkLand = calcRate(c.clicks, c.landing_page_views);
              const vcCart = hasAnyCapi ? calcRate(c.view_content ?? 0, c.add_to_cart ?? 0) : null;
              const landCheckout = hasAnyCapi ? calcRate(c.landing_page_views, c.initiate_checkout ?? 0) : null;
              const icPurch = hasAnyCapi ? calcRate(c.initiate_checkout ?? 0, c.purchases) : null;
              const landPurch = calcRate(c.landing_page_views, c.purchases);
              // CAPI 구간에서 가장 큰 이탈 찾기
              const vc = c.view_content ?? 0; const atc = c.add_to_cart ?? 0; const ic = c.initiate_checkout ?? 0;
              const drops = [
                vc > 0 ? { label: "상품 조회 → 장바구니", rate: atc > 0 ? atc / vc : 0, fix: atc === 0 ? "장바구니 0건: 상품 상세/가격/CTA 전면 점검" : "가격, 상품 구성, CTA 위치 점검" } : null,
                atc > 0 ? { label: "장바구니 → 결제 시작", rate: ic > 0 ? ic / atc : 0, fix: ic === 0 ? "결제시작 0건: 배송비/회원가입 장벽 제거" : "배송비, 추가 비용, 회원가입 장벽 점검" } : null,
                ic > 0 ? { label: "결제 시작 → 구매 완료", rate: c.purchases > 0 ? c.purchases / ic : 0, fix: c.purchases === 0 ? "구매 0건: PG 오류/결제 수단 즉시 점검" : "결제 수단, PG 오류, 결제 UX 점검" } : null,
              ].filter(Boolean) as { label: string; rate: number; fix: string }[];
              const worstDrop = drops.length > 0 ? drops.reduce((a, b) => a.rate < b.rate ? a : b) : null;

              const colCount = hasAnyCapi ? 10 : 7;

              return (
                <React.Fragment key={c.campaign_id}>
                  <tr onClick={() => setExpandedCampaign(isExpanded ? null : c.campaign_id)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: isExpanded ? "#f0f9ff" : undefined }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.campaign_name}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-block", minWidth: 36, padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: "0.72rem",
                        color: "#fff", background: fs.color,
                      }}>{fs.grade}</span>
                      <div style={{ fontSize: "0.58rem", color: fs.color, fontWeight: 700, marginTop: 1 }}>{fs.score}점</div>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600, fontSize: "0.72rem" }}>{fmtKRW(c.spend)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: c.purchases > 0 ? "#16a34a" : "#94a3b8" }}>{c.purchases || "0"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: rateColor(clkLand, "landing") }}>{fmtPct(clkLand)}</td>
                    {hasAnyCapi && <>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: rateColor(vcCart, "cart") }}>{fmtPct(vcCart)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: rateColor(landCheckout, "land_checkout") }}>{fmtPct(landCheckout)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: rateColor(icPurch, "purchase") }}>{fmtPct(icPurch)}</td>
                    </>}
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: rateColor(landPurch, "overall") }}>{fmtPct(landPurch)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center", color: "#94a3b8", fontSize: "0.64rem" }}>{isExpanded ? "▲" : "▼"}</td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={colCount} style={{ padding: "16px 20px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <div style={{ display: "flex", gap: 20 }}>
                          {/* 퍼널 바 */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {funnel.map((step, i) => {
                                const maxVal = Math.max(...funnel.map((s) => s.value));
                                const barW = maxVal > 0 ? Math.max((step.value / maxVal) * 100, step.value > 0 ? 2 : 0) : 0;
                                const prev = i > 0 ? funnel[i - 1].value : 0;
                                const stepRate = prev > 0 && step.value > 0 ? step.value / prev : null;
                                const isBottleneck = worstDrop && (
                                  (step.key === "add_to_cart" && worstDrop.label.includes("장바구니")) ||
                                  (step.key === "checkout" && worstDrop.label.includes("결제 시작")) ||
                                  (step.key === "purchase" && worstDrop.label.includes("구매 완료"))
                                );
                                return (
                                  <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 56, textAlign: "right", fontSize: "0.68rem", color: "#64748b", flexShrink: 0 }}>
                                      {step.label}
                                    </div>
                                    <div style={{ width: 40, textAlign: "right", fontSize: "0.58rem", color: "#a1a1aa", flexShrink: 0 }}>
                                      {step.source}
                                    </div>
                                    <div style={{ flex: 1, height: 20, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                      <div style={{
                                        height: "100%", borderRadius: 4,
                                        background: isBottleneck ? "#fca5a5" : step.color, opacity: step.value === 0 ? 0.2 : 0.8,
                                        width: `${barW}%`, transition: "width 0.3s",
                                      }} />
                                    </div>
                                    <div style={{ width: 65, fontSize: "0.72rem", fontWeight: 700, color: step.value > 0 ? "#0f172a" : "#cbd5e1", flexShrink: 0, textAlign: "right" }}>
                                      {step.value > 0 ? fmtNum(step.value) : "—"}
                                    </div>
                                    <div style={{ width: 50, fontSize: "0.66rem", fontWeight: 600, flexShrink: 0, textAlign: "right" }}>
                                      {i > 0 && stepRate != null && stepRate <= 1 ? (
                                        <span style={{ color: isBottleneck ? "#dc2626" : "#64748b" }}>{fmtPct(stepRate)}</span>
                                      ) : i > 0 && stepRate != null && stepRate > 1 ? (
                                        <span style={{ color: "#8b5cf6", fontSize: "0.6rem" }} title="Meta 뷰스루 어트리뷰션 포함">{fmtPct(stepRate)}</span>
                                      ) : ""}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 점수 & 진단 */}
                          <div style={{ width: 240, flexShrink: 0 }}>
                            <div style={{ textAlign: "center", marginBottom: 12 }}>
                              <div style={{ fontSize: "2rem", fontWeight: 900, color: fs.color }}>{fs.grade}</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: fs.color }}>{fs.score}점</div>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.7rem", color: "#475569", lineHeight: 1.8 }}>
                              {fs.reasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                            {worstDrop && (
                              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.7rem", color: "#991b1b", lineHeight: 1.6 }}>
                                <strong>병목:</strong> {worstDrop.label} ({fmtPct(worstDrop.rate)})
                                <div style={{ marginTop: 2, color: "#b91c1c" }}>{worstDrop.fix}</div>
                              </div>
                            )}
                            {(vc > c.landing_page_views) && vc > 0 && (
                              <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: "0.66rem", color: "#6d28d9", lineHeight: 1.5 }}>
                                조회({fmtNum(vc)}) &gt; 랜딩({fmtNum(c.landing_page_views)}): Meta 뷰스루 어트리뷰션(광고를 보고 직접 방문한 사용자)이 포함됨
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignAliasReviewSection({ selectedSite }: { selectedSite: { site: string; label: string; account_id: string } }) {
  const [review, setReview] = useState<AliasReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const loadReview = useCallback(async () => {
    if (!REVIEW_TARGET_SITES.has(selectedSite.site)) {
      setReview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ads/campaign-alias-review?site=${selectedSite.site}`);
      const data = await res.json() as AliasReviewResponse;
      if (!data.ok) {
        setReview(null);
        setError(data.error ?? "alias review load failed");
        return;
      }
      setReview(data);
    } catch {
      setReview(null);
      setError("alias review load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedSite.site]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleDecision = async (aliasKey: string, campaignId: string, decision: "yes" | "no") => {
    const actionKey = `${aliasKey}:${campaignId}:${decision}`;
    setActionLoading(actionKey);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ads/campaign-alias-review/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: selectedSite.site,
          aliasKey,
          campaignId,
          decision,
        }),
      });
      const data = await res.json() as { ok: boolean; item?: AliasReviewItem; error?: string };
      if (!data.ok || !data.item) {
        setError(data.error ?? "alias review decision failed");
        return;
      }
      setReview((current) => {
        if (!current) return current;
        const items = current.items
          .map((item) => item.aliasKey === data.item!.aliasKey ? data.item! : item)
          .sort((a, b) => {
            const statusPriority = (status: string) => {
              if (status === "needs_manual_review") return 0;
              if (status === "manual_verified") return 1;
              if (status === "rejected_all_candidates") return 2;
              return 3;
            };

            return statusPriority(a.status) - statusPriority(b.status)
              || b.evidence.confirmedRevenue - a.evidence.confirmedRevenue
              || b.evidence.confirmedOrders - a.evidence.confirmedOrders
              || a.aliasKey.localeCompare(b.aliasKey);
          });
        return {
          ...current,
          summary: summarizeAliasReviewItems(items),
          items,
        };
      });
    } catch {
      setError("alias review decision failed");
    } finally {
      setActionLoading(null);
    }
  };

  const [expandedAlias, setExpandedAlias] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

  if (!REVIEW_TARGET_SITES.has(selectedSite.site)) return null;

  const pendingItems = (review?.items ?? []).filter((i) => i.status === "needs_manual_review");
  const resolvedItems = (review?.items ?? []).filter((i) => i.status !== "needs_manual_review");

  const confidenceLabel = (c: string) => {
    if (c === "auto_url_match") return { text: "URL 자동 매칭", bg: "#dbeafe", fg: "#1d4ed8" };
    if (c === "auto_spend_heuristic") return { text: "집행비 기반 자동", bg: "#e0e7ff", fg: "#4338ca" };
    if (c === "manual_verified") return { text: "수동 확정", bg: "#dcfce7", fg: "#166534" };
    return { text: c, bg: "#f1f5f9", fg: "#64748b" };
  };

  const renderCandidate = (item: AliasReviewItem, candidate: AliasReviewCandidate) => {
    const decisionPrefix = `${item.aliasKey}:${candidate.campaignId}:`;
    const metaRoas = candidate.spend > 0 && candidate.purchaseValue > 0
      ? candidate.purchaseValue / candidate.spend : null;
    const detailKey = `${item.aliasKey}:${candidate.campaignId}`;
    const isDetailOpen = expandedDetail === detailKey;

    // === 추천 이유 & 자신감 점수 계산 ===
    const reasons: string[] = [];
    let confidence = 30; // base

    // 1. URL 증거
    const aliasInUrl = candidate.landingUrlExamples.some((u: string) => u.includes(item.aliasKey));
    if (aliasInUrl) {
      reasons.push("광고 랜딩 URL에 이 UTM 태그가 직접 포함됨");
      confidence += 30;
    } else if (candidate.landingUrlExamples.length > 0) {
      reasons.push("캠페인 내 광고에 UTM 태그가 설정된 랜딩 URL 존재");
      confidence += 15;
    }

    // 2. 유일한 후보
    const nonRejected = item.candidates.filter((c) => !c.rejected);
    if (nonRejected.length === 1 && !candidate.rejected) {
      reasons.push("유일한 후보 캠페인");
      confidence += 20;
    }

    // 3. 활성 상태
    if (candidate.activeAds > 0) {
      reasons.push(`현재 활성 광고 ${candidate.activeAds}개 집행 중`);
      confidence += 10;
    } else {
      reasons.push("현재 활성 광고 없음 — 과거 캠페인일 수 있음");
      confidence -= 10;
    }

    // 4. 집행비 우위
    const totalSpend = item.candidates.reduce((s, c) => s + c.spend, 0);
    if (totalSpend > 0 && candidate.spend > 0) {
      const spendShare = candidate.spend / totalSpend;
      if (spendShare > 0.8) {
        reasons.push(`전체 후보 집행비의 ${Math.round(spendShare * 100)}% 차지`);
        confidence += 15;
      } else if (spendShare > 0.5) {
        reasons.push(`집행비 비중 ${Math.round(spendShare * 100)}%로 최다`);
        confidence += 5;
      }
    }

    // 5. 광고명에 alias 키워드 포함 여부
    const aliasKeyword = item.aliasKey.replace(/^meta_biocom_/, "").replace(/^inpork_biocom_/, "").replace(/_igg$/, "").toLowerCase();
    const adNamesMatch = candidate.adSamples.some((ad: string) => ad.toLowerCase().includes(aliasKeyword));
    if (adNamesMatch) {
      reasons.push("광고명에 alias 키워드가 직접 포함됨");
      confidence += 15;
    }

    confidence = Math.min(95, Math.max(10, confidence));
    const confColor = confidence >= 80 ? "#16a34a" : confidence >= 60 ? "#d97706" : "#dc2626";
    const confLabel = confidence >= 80 ? "높음" : confidence >= 60 ? "보통" : "낮음";

    return (
      <div key={candidate.campaignId} style={{
        padding: "12px 14px", borderRadius: 10,
        border: candidate.selected ? "2px solid #16a34a" : candidate.rejected ? "1px solid #e2e8f0" : "1px solid #dbeafe",
        background: candidate.selected ? "#f0fdf4" : candidate.rejected ? "#fafafa" : "#fff",
        opacity: candidate.rejected ? 0.55 : 1,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{candidate.campaignName}</div>
            <div style={{ display: "flex", gap: 10, fontSize: "0.7rem", color: "#64748b", flexWrap: "wrap" }}>
              <span>집행 <strong style={{ color: "#ef4444" }}>{fmtKRW(candidate.spend)}</strong></span>
              <span>전환매출 <strong style={{ color: "#16a34a" }}>{fmtKRW(candidate.purchaseValue)}</strong></span>
              <span>ROAS <strong style={{ color: "#d97706" }}>{metaRoas != null ? `${metaRoas.toFixed(1)}x` : "—"}</strong></span>
              <span>활성 광고 <strong>{candidate.activeAds}</strong>개</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {candidate.selected && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#16a34a", marginRight: 4 }}>확정됨</span>}
            {candidate.rejected && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", marginRight: 4 }}>제외</span>}
            <button type="button" disabled={Boolean(actionLoading)}
              onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "yes")}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #16a34a", fontSize: "0.72rem", fontWeight: 700,
                background: candidate.selected ? "#16a34a" : "#fff", color: candidate.selected ? "#fff" : "#16a34a",
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading && actionLoading !== `${decisionPrefix}yes` ? 0.4 : 1,
              }}
            >{actionLoading === `${decisionPrefix}yes` ? "..." : "yes"}</button>
            <button type="button" disabled={Boolean(actionLoading)}
              onClick={() => void handleDecision(item.aliasKey, candidate.campaignId, "no")}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #dc2626", fontSize: "0.72rem", fontWeight: 700,
                background: candidate.rejected ? "#dc2626" : "#fff", color: candidate.rejected ? "#fff" : "#dc2626",
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading && actionLoading !== `${decisionPrefix}no` ? 0.4 : 1,
              }}
            >{actionLoading === `${decisionPrefix}no` ? "..." : "no"}</button>
          </div>
        </div>

        {/* 추천 이유 & 자신감 점수 */}
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>AI 추천 근거</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.66rem", color: "#64748b" }}>예상 정확도</span>
              <span style={{
                fontSize: "0.72rem", fontWeight: 800, color: confColor,
                padding: "2px 8px", borderRadius: 999,
                background: confidence >= 80 ? "#dcfce7" : confidence >= 60 ? "#fef3c7" : "#fee2e2",
              }}>{confidence}% {confLabel}</span>
            </div>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.72rem", color: "#334155", lineHeight: 1.8 }}>
            {reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* 상세 토글 */}
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setExpandedDetail(isDetailOpen ? null : detailKey)}
            style={{ background: "none", border: "none", padding: 0, color: "#6366f1", fontSize: "0.68rem", cursor: "pointer", fontWeight: 600 }}>
            {isDetailOpen ? "상세 접기 ▲" : "광고세트 · 광고명 · URL 보기 ▼"}
          </button>
          {isDetailOpen && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginBottom: 3 }}>대표 광고세트</div>
                <div style={{ fontSize: "0.7rem", color: "#334155", lineHeight: 1.6 }}>
                  {candidate.adsetSamples.length > 0 ? candidate.adsetSamples.map((s: string, i: number) => <div key={i}>{s}</div>) : "—"}
                </div>
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginBottom: 3 }}>대표 광고</div>
                <div style={{ fontSize: "0.7rem", color: "#334155", lineHeight: 1.6 }}>
                  {candidate.adSamples.length > 0 ? candidate.adSamples.map((s: string, i: number) => <div key={i}>{s}</div>) : "—"}
                </div>
              </div>
              {candidate.landingUrlExamples.length > 0 && (
                <div style={{ gridColumn: "1 / -1", padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginBottom: 3 }}>랜딩 URL</div>
                  <div style={{ fontSize: "0.66rem", color: "#475569", lineHeight: 1.6, wordBreak: "break-all" }}>
                    {candidate.landingUrlExamples.map((u: string, i: number) => <div key={i}>{u}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 22px", borderRadius: 14, background: "linear-gradient(180deg, #f8fafc, #fff)", border: "1px solid #e2e8f0", marginBottom: 24 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
          캠페인 Alias 매핑
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {review?.generated_at && (
            <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>audit: {formatDateTime(review.generated_at)}</span>
          )}
        </div>
      </div>

      {/* 요약 바 */}
      {review && (
        <div style={{ display: "flex", gap: 16, padding: "12px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", marginBottom: 16, alignItems: "center" }}>
          <div style={{ fontSize: "0.76rem", color: "#0f172a" }}>
            전체 <strong>{review.summary.totalAliases}</strong>
          </div>
          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <div style={{ fontSize: "0.76rem", color: review.summary.pendingReview > 0 ? "#d97706" : "#16a34a", fontWeight: 700 }}>
            {review.summary.pendingReview > 0 ? `검토 필요 ${review.summary.pendingReview}건` : "전부 확정됨"}
          </div>
          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <div style={{ fontSize: "0.76rem", color: "#16a34a" }}>
            확정 <strong>{review.summary.manualVerified}</strong>
          </div>
          {review.summary.rejectedAll > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
              <div style={{ fontSize: "0.76rem", color: "#dc2626" }}>
                거절 <strong>{review.summary.rejectedAll}</strong>
              </div>
            </>
          )}
          {/* 진행률 바 */}
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: review.summary.pendingReview === 0 ? "#16a34a" : "linear-gradient(90deg, #16a34a, #22c55e)",
              width: `${review.summary.totalAliases > 0 ? (review.summary.manualVerified / review.summary.totalAliases) * 100 : 0}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.76rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: "0.78rem" }}>로딩 중...</div>
      ) : (
        <>
          {/* 검토 필요 섹션 */}
          {pendingItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#92400e", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                검토 필요 ({pendingItems.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingItems.map((item) => {
                  const isExpanded = expandedAlias === item.aliasKey;
                  const shortName = item.aliasKey.replace(/^meta_biocom_/, "").replace(/^inpork_biocom_/, "inpork_").replace(/_igg$/, "");
                  const totalActiveAds = item.candidates.reduce((s, c) => s + c.activeAds, 0);
                  const periodLabel = item.validFrom
                    ? `${item.validFrom} ~ ${review?.generated_at ? review.generated_at.slice(0, 10) : "현재"}`
                    : `~ ${review?.generated_at ? review.generated_at.slice(0, 10) : "현재"}`;
                  // AI 분석 생성
                  const aiAnalysis = (() => {
                    if (item.candidates.length === 0) return "Meta 광고에서 이 UTM 태그를 사용하는 캠페인을 찾지 못했소. 삭제된 광고이거나 외부 유입일 수 있소.";
                    if (item.candidates.length === 1) {
                      const c = item.candidates[0];
                      return c.activeAds > 0
                        ? `후보 캠페인 1개 발견. 현재 활성 광고 ${c.activeAds}개가 돌고 있소. 확인 후 yes를 누르시오.`
                        : `후보 캠페인 1개 발견되었으나 현재 활성 광고가 없소. 과거 집행된 캠페인일 수 있소.`;
                    }
                    const activeOnes = item.candidates.filter(c => c.activeAds > 0 && c.spend > 0);
                    if (activeOnes.length > 1) {
                      return `${item.candidates.length}개 캠페인에서 이 UTM 태그가 발견되었고, ${activeOnes.length}개가 동시에 활성 상태라 자동 확정이 어려웠소. Meta 광고관리자에서 어느 캠페인의 광고에 이 UTM이 설정되어 있는지 확인 필요.`;
                    }
                    return `${item.candidates.length}개 후보 캠페인이 있으나 활성 상태가 아닌 캠페인도 포함되어 있소.`;
                  })();

                  return (
                    <div key={item.aliasKey} style={{ borderRadius: 12, border: "1px solid #fbbf24", background: "#fffbeb", overflow: "hidden" }}>
                      {/* 요약 행 — 클릭으로 펼침 */}
                      <div
                        onClick={() => setExpandedAlias(isExpanded ? null : item.aliasKey)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
                      >
                        <span style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 700, width: 16 }}>{isExpanded ? "▼" : "▶"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>
                            {shortName}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
                            {totalActiveAds > 0
                              ? <span style={{ color: "#16a34a" }}>현재 광고 집행 중 · 활성 광고 {totalActiveAds}개</span>
                              : <span style={{ color: "#94a3b8" }}>현재 활성 광고 없음</span>
                            }
                            {item.candidates.length === 0 && <span style={{ color: "#dc2626" }}> · 매칭 후보 없음</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                          <span style={{ fontSize: "0.76rem", color: "#16a34a", fontWeight: 700 }}>{fmtNum(item.evidence.confirmedOrders)}건 · {fmtKRW(item.evidence.confirmedRevenue)}</span>
                          <span style={{ fontSize: "0.64rem", color: "#94a3b8" }}>{periodLabel}</span>
                        </div>
                      </div>

                      {/* 펼침 영역 */}
                      {isExpanded && (
                        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #fde68a" }}>
                          {/* 확인된 사실 */}
                          <div style={{ margin: "12px 0", padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>확인된 사실</div>
                            <div style={{ fontSize: "0.74rem", color: "#334155", lineHeight: 1.8 }}>
                              <div>이 UTM 태그(<code style={{ fontSize: "0.68rem", background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{item.aliasKey}</code>)로 유입된 확정 주문 <strong>{fmtNum(item.evidence.confirmedOrders)}건</strong>, 매출 <strong style={{ color: "#16a34a" }}>{fmtKRW(item.evidence.confirmedRevenue)}</strong></div>
                              <div style={{ color: "#94a3b8", fontSize: "0.68rem" }}>집계 기간: {periodLabel}{item.evidence.pendingOrders > 0 && ` · 미확정 ${item.evidence.pendingOrders}건 ₩${item.evidence.pendingRevenue.toLocaleString("ko-KR")} 별도`}</div>
                              {item.candidates.length > 0 && (
                                <div style={{ marginTop: 4 }}>Meta 광고 중 <strong>{item.candidates.length}개 캠페인</strong>에서 이 UTM 태그를 사용하는 광고가 발견됨</div>
                              )}
                            </div>
                          </div>

                          {/* AI 분석 */}
                          <div style={{ margin: "0 0 12px", padding: "10px 14px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#1e40af", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>AI 분석</div>
                            <div style={{ fontSize: "0.74rem", color: "#1e3a8a", lineHeight: 1.7 }}>{aiAnalysis}</div>
                          </div>

                          {/* 후보 캠페인 */}
                          {item.candidates.length > 0 && (
                            <div>
                              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                                후보 캠페인 ({item.candidates.length})
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {item.candidates.map((c) => renderCandidate(item, c))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingItems.length === 0 && !showResolved && (
            <div style={{ padding: 20, textAlign: "center", color: "#16a34a", background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0", fontSize: "0.8rem", fontWeight: 600 }}>
              모든 alias가 확정되었소.
            </div>
          )}

          {/* 확정 완료 섹션 — 토글 */}
          {resolvedItems.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowResolved((v) => !v)}
                style={{
                  background: "none", border: "none", padding: "8px 0", cursor: "pointer",
                  fontSize: "0.74rem", fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 6,
                }}>
                <span>{showResolved ? "▼" : "▶"}</span>
                확정 완료 ({resolvedItems.length})
              </button>

              {showResolved && (
                <div style={{ marginTop: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#94a3b8", fontWeight: 600 }}>Alias</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#94a3b8", fontWeight: 600 }}>매칭 캠페인</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: "#94a3b8", fontWeight: 600 }}>매출</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: "#94a3b8", fontWeight: 600 }}>주문</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", color: "#94a3b8", fontWeight: 600 }}>방법</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedItems.map((item) => {
                        const conf = confidenceLabel(item.confidence);
                        return (
                          <tr key={item.aliasKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px", color: "#334155", fontWeight: 600 }}>
                              {item.aliasKey.replace(/^meta_biocom_/, "").replace(/_igg$/, "")}
                            </td>
                            <td style={{ padding: "8px", color: "#475569" }}>
                              {item.selectedCampaignName
                                ? item.selectedCampaignName.replace(/^\[바이오컴\]\s*/, "")
                                : item.status === "rejected_all_candidates" ? <span style={{ color: "#dc2626" }}>전부 거절</span> : "—"}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                              {fmtKRW(item.evidence.confirmedRevenue)}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right", color: "#0f172a" }}>
                              {fmtNum(item.evidence.confirmedOrders)}건
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 999, background: conf.bg, color: conf.fg, fontSize: "0.64rem", fontWeight: 700 }}>
                                {conf.text}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type TrackingInfo = {
  optimizationGoal: string;
  pixelId: string | null;
  pageId: string | null;
  customEventType: string | null;
  trackingType: "website_lead" | "instant_form" | "pixel_purchase" | "landing_page" | "unknown";
  trackingLabel: string;
};

type CampaignHealth = {
  id: string; name: string; objective: string; objectiveLabel: string;
  status: string; dailyBudget: number | null; issues: string[]; healthy: boolean;
  impressions?: number; clicks?: number; spend?: number; ctr?: number;
  resultLabel?: string; resultValue?: number; resultCost?: number;
  signal?: "green" | "yellow" | "red";
  tracking?: TrackingInfo | null;
};

type CampaignDetail = {
  adsets: Array<{
    id: string; name: string; status: string; dailyBudget: number | null; optimizationGoal: string | null;
    promotedObject?: { pixelId: string | null; pageId: string | null; customEventType: string | null } | null;
    targeting: { geo: string; age: string };
    ads: Array<{ id: string; name: string; status: string; thumbnailUrl: string | null; imageUrl?: string | null; title: string | null; body: string | null; impressions: number; clicks: number; spend: number; isVideo?: boolean; videoId?: string | null; landingUrl?: string | null; landingDomain?: string | null; isExternalLanding?: boolean }>;
  }>;
};

function CampaignManagerSection({ selectedSite }: { selectedSite: { site: string; label: string; account_id: string } }) {
  const [campaigns, setCampaigns] = useState<CampaignHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggleDetail = async (campaignId: string) => {
    if (expandedCampaign === campaignId) { setExpandedCampaign(null); return; }
    setExpandedCampaign(campaignId);
    setDetailLoading(true);
    setCampaignDetail(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/${campaignId}/detail`);
      const d = await res.json();
      if (d.ok) setCampaignDetail(d);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  // 새 캠페인 준비
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(() => {
    const now = new Date();
    const ts = `${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    return `${selectedSite.label} 리드 캠페인 ${ts}`;
  });
  const [newBudget, setNewBudget] = useState(50000);
  const [newObjective, setNewObjective] = useState("OUTCOME_LEADS");
  const [createResult, setCreateResult] = useState<{ ok: boolean; campaignId?: string; error?: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const loadHealth = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/meta/campaigns/health?account_id=${selectedSite.account_id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCampaigns(d.campaigns ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHealth(); }, [selectedSite.account_id]);

  const handleAction = async (campaignId: string, action: "pause" | "activate") => {
    setActionLoading(campaignId);
    setActionResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/${campaignId}/${action}`, { method: "POST" });
      const d = await res.json();
      setActionResult({ id: campaignId, msg: d.ok ? `${action === "pause" ? "일시정지" : "활성화"} 완료` : (d.error ?? "실패"), ok: d.ok });
      if (d.ok) loadHealth();
    } catch { setActionResult({ id: campaignId, msg: "요청 실패", ok: false }); }
    finally { setActionLoading(null); }
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/meta/campaigns/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedSite.account_id, name: newName, objective: newObjective, dailyBudget: newBudget, status: "PAUSED" }),
      });
      const d = await res.json();
      setCreateResult({ ok: d.ok, campaignId: d.campaignId, error: d.error });
      if (d.ok) { loadHealth(); setShowCreate(false); }
    } catch { setCreateResult({ ok: false, error: "요청 실패" }); }
    finally { setCreating(false); }
  };

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const issueCount = campaigns.filter((c) => c.issues.length > 0).length;

  return (
    <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #fefce8, #fff)", border: "1px solid #fde68a", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.1rem" }}>{"🎯"}</span>
          <strong style={{ fontSize: "0.92rem", color: "#92400e" }}>캠페인 관리 — {selectedSite.label}</strong>
          {issueCount > 0 && (
            <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontWeight: 700 }}>
              문제 {issueCount}건
            </span>
          )}
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)} style={{
          padding: "7px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
          border: "1px solid #6366f1", background: showCreate ? "#6366f1" : "#fff", color: showCreate ? "#fff" : "#6366f1",
        }}>
          {showCreate ? "취소" : "+ 새 캠페인 준비"}
        </button>
      </div>

      {/* 새 캠페인 생성 폼 */}
      {showCreate && (
        <div style={{ padding: "16px 18px", borderRadius: 10, background: "#fff", border: "1px solid #e0e7ff", marginBottom: 16 }}>
          <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>새 캠페인 생성 (PAUSED 상태로 생성됨)</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>캠페인 이름</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>목표</label>
              <select value={newObjective} onChange={(e) => setNewObjective(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }}>
                <option value="OUTCOME_LEADS">리드 (폼 제출/상담 예약)</option>
                <option value="OUTCOME_SALES">매출 (구매)</option>
                <option value="OUTCOME_TRAFFIC">트래픽 (클릭)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>일 예산 (원)</label>
              <input type="number" value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
              background: "#6366f1", color: "#fff", border: "none",
            }}>
              {creating ? "생성 중..." : "Meta에 캠페인 생성 (PAUSED)"}
            </button>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              PAUSED 상태로 생성됨. 광고세트와 소재는 Meta 광고 관리자에서 추가 설정 필요.
            </span>
          </div>
          {createResult && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: createResult.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${createResult.ok ? "#bbf7d0" : "#fecaca"}`, fontSize: "0.78rem", color: createResult.ok ? "#16a34a" : "#dc2626" }}>
              {createResult.ok ? `캠페인 생성 완료 (ID: ${createResult.campaignId}). Meta 광고 관리자에서 광고세트/소재를 설정하세요.` : `실패: ${createResult.error}`}
            </div>
          )}
        </div>
      )}

      {/* 캠페인 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: "0.82rem" }}>캠페인 목록 로딩 중...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: "0.82rem" }}>캠페인 없음</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #fde68a" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#92400e", fontSize: "0.64rem" }}></th>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#92400e", fontSize: "0.64rem" }}>캠페인</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>목표</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>추적</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>상태</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>결과</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>결과당 비용</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>CTR</th>
                <th style={{ padding: "6px 8px", textAlign: "right", color: "#92400e", fontSize: "0.64rem" }}>지출</th>
                <th style={{ padding: "6px 8px", textAlign: "center", color: "#92400e", fontSize: "0.64rem" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <React.Fragment key={c.id}>
                <tr onClick={() => toggleDetail(c.id)} style={{ borderBottom: "1px solid #fef3c7", background: expandedCampaign === c.id ? "#fefce8" : c.signal === "red" ? "#fef2f2" : c.signal === "yellow" ? "#fffbeb" : undefined, cursor: "pointer" }}>
                  {/* 신호등 */}
                  <td style={{ padding: "6px 4px", textAlign: "center", width: 28 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.signal === "green" ? "#16a34a" : c.signal === "red" ? "#dc2626" : "#d97706", margin: "0 auto" }} title={c.issues.length > 0 ? c.issues[0] : "양호"} />
                  </td>
                  {/* 캠페인명 */}
                  <td style={{ padding: "6px 8px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ marginRight: 4, fontSize: "0.55rem", color: "#94a3b8" }}>{expandedCampaign === c.id ? "▼" : "▶"}</span>
                    {c.name}
                    {c.issues.length > 0 && <div style={{ fontSize: "0.58rem", color: "#dc2626", fontWeight: 400, whiteSpace: "normal", lineHeight: 1.3, marginTop: 2 }}>{c.issues[0]?.slice(0, 50)}</div>}
                  </td>
                  {/* 목표 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 600,
                      background: c.objective === "OUTCOME_LEADS" ? "#dcfce7" : c.objective === "OUTCOME_SALES" ? "#dbeafe" : "#fef3c7",
                      color: c.objective === "OUTCOME_LEADS" ? "#16a34a" : c.objective === "OUTCOME_SALES" ? "#2563eb" : "#92400e",
                    }}>
                      {c.objectiveLabel}
                    </span>
                  </td>
                  {/* 추적 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    {c.tracking ? (() => {
                      const t = c.tracking;
                      const colorMap: Record<string, { bg: string; color: string; border: string }> = {
                        website_lead: { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" },
                        pixel_purchase: { bg: "#dbeafe", color: "#2563eb", border: "#bfdbfe" },
                        instant_form: { bg: "#f3e8ff", color: "#7c3aed", border: "#e9d5ff" },
                        landing_page: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
                        unknown: { bg: "#f1f5f9", color: "#94a3b8", border: "#e2e8f0" },
                      };
                      const style = colorMap[t.trackingType] ?? colorMap.unknown;
                      const shortLabel: Record<string, string> = {
                        website_lead: "웹 리드",
                        pixel_purchase: "구매 픽셀",
                        instant_form: "인스턴트 폼",
                        landing_page: "랜딩뷰만",
                        unknown: "미설정",
                      };
                      return (
                        <span title={t.trackingLabel} style={{
                          display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: "0.58rem", fontWeight: 600,
                          background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                          maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {shortLabel[t.trackingType] ?? "미설정"}
                          {t.pixelId && <span style={{ fontSize: "0.5rem", opacity: 0.7, marginLeft: 2 }}>({t.pixelId.slice(-4)})</span>}
                        </span>
                      );
                    })() : (
                      <span style={{ fontSize: "0.58rem", color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  {/* 상태 */}
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: c.status === "ACTIVE" ? "#16a34a" : "#94a3b8" }}>
                      {c.status === "ACTIVE" ? "활성" : "정지"}
                    </span>
                  </td>
                  {/* 결과 (목표별 분기) */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.resultValue ?? 0) > 0 ? (
                      <div>
                        <strong style={{ color: "#334155" }}>{fmtNum(c.resultValue!)}</strong>
                        <div style={{ fontSize: "0.58rem", color: "#94a3b8" }}>{c.resultLabel}</div>
                      </div>
                    ) : c.status === "ACTIVE" ? (
                      <span style={{ fontSize: "0.68rem", color: "#dc2626" }}>0</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  {/* 결과당 비용 */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.resultCost ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem" }}>{fmtKRW(c.resultCost!)}</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  {/* CTR */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.ctr ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem", color: (c.ctr ?? 0) > 2 ? "#16a34a" : "#d97706" }}>{(c.ctr ?? 0).toFixed(1)}%</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  {/* 지출 */}
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(c.spend ?? 0) > 0 ? (
                      <span style={{ fontSize: "0.72rem" }}>{fmtKRW(c.spend!)}</span>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {c.status === "ACTIVE" ? (
                      <button type="button" onClick={() => handleAction(c.id, "pause")} disabled={actionLoading === c.id} style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                        border: "1px solid #fecaca", background: "#fff", color: "#dc2626",
                      }}>
                        {actionLoading === c.id ? "..." : "일시정지"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleAction(c.id, "activate")} disabled={actionLoading === c.id} style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
                        border: "1px solid #bbf7d0", background: "#fff", color: "#16a34a",
                      }}>
                        {actionLoading === c.id ? "..." : "활성화"}
                      </button>
                    )}
                  </td>
                </tr>
                {/* 상세 펼침 — 소재 썸네일 + 타겟 */}
                {expandedCampaign === c.id && (
                  <tr>
                    <td colSpan={10} style={{ padding: "12px 18px", background: "#fefce8" }}>
                      {detailLoading ? (
                        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.78rem", padding: 12 }}>소재 정보 로딩 중...</div>
                      ) : campaignDetail ? (
                        <>
                          {campaignDetail.adsets.map((as) => (
                            <div key={as.id} style={{ marginBottom: 12 }}>
                              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                                <strong style={{ fontSize: "0.78rem", color: "#92400e" }}>{as.name}</strong>
                                <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#fff", border: "1px solid #e2e8f0", color: "#64748b" }}>
                                  타겟: {as.targeting.geo} · {as.targeting.age}
                                </span>
                                {as.optimizationGoal && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#eef2ff", color: "#6366f1" }}>
                                    최적화: {as.optimizationGoal === "LANDING_PAGE_VIEWS" ? "랜딩뷰" : as.optimizationGoal === "LEAD_GENERATION" ? "리드" : as.optimizationGoal === "OFFSITE_CONVERSIONS" ? "전환(구매)" : as.optimizationGoal}
                                  </span>
                                )}
                                {as.promotedObject && (as.promotedObject.pixelId || as.promotedObject.pageId) && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: as.promotedObject.pixelId ? "#dcfce7" : "#f3e8ff", color: as.promotedObject.pixelId ? "#16a34a" : "#7c3aed", border: `1px solid ${as.promotedObject.pixelId ? "#bbf7d0" : "#e9d5ff"}` }}>
                                    {as.promotedObject.pixelId ? (
                                      <>픽셀: ...{as.promotedObject.pixelId.slice(-6)}{as.promotedObject.customEventType && ` · 이벤트: ${as.promotedObject.customEventType}`}</>
                                    ) : (
                                      <>페이지: ...{as.promotedObject.pageId!.slice(-6)}</>
                                    )}
                                  </span>
                                )}
                                {as.promotedObject === null && as.optimizationGoal !== "LANDING_PAGE_VIEWS" && (
                                  <span style={{ fontSize: "0.68rem", padding: "2px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                    promoted_object 미설정
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {as.ads.map((ad) => (
                                  <div key={ad.id} style={{
                                    width: 160, padding: "8px", borderRadius: 8,
                                    background: "#fff", border: `1px solid ${ad.status === "ACTIVE" ? "#bbf7d0" : "#e2e8f0"}`,
                                    opacity: ad.status === "ACTIVE" ? 1 : 0.6,
                                  }}>
                                    {ad.thumbnailUrl ? (
                                      <a href={ad.isVideo && ad.videoId ? `https://www.facebook.com/watch/?v=${ad.videoId}` : (ad.imageUrl || ad.thumbnailUrl)} target="_blank" rel="noopener noreferrer" title={ad.isVideo ? "영상 보기 (Facebook)" : "이미지 크게 보기"}>
                                        <div style={{ position: "relative" }}>
                                          <img src={ad.thumbnailUrl} alt={ad.name} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 4, cursor: "pointer" }} />
                                          {ad.isVideo && (
                                            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                              <div style={{ width: 0, height: 0, borderLeft: "10px solid #fff", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />
                                            </div>
                                          )}
                                        </div>
                                      </a>
                                    ) : (
                                      <div style={{ width: "100%", height: 90, background: "#f1f5f9", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", color: "#94a3b8" }}>썸네일 없음</div>
                                    )}
                                    <div style={{ fontSize: "0.54rem", marginTop: 2, marginBottom: 2 }}>
                                      <span style={{ padding: "1px 4px", borderRadius: 3, fontSize: "0.5rem", fontWeight: 600, background: ad.isVideo ? "#dbeafe" : "#f3e8ff", color: ad.isVideo ? "#2563eb" : "#7c3aed" }}>
                                        {ad.isVideo ? "영상" : "이미지"}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: "0.64rem", fontWeight: 600, color: "#334155", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.name}>{ad.name}</div>
                                    <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                                      <span style={{ color: ad.status === "ACTIVE" ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>{ad.status === "ACTIVE" ? "활성" : "정지"}</span>
                                      {" · 노출 "}{ad.impressions.toLocaleString()}{" · 클릭 "}{ad.clicks.toLocaleString()}
                                    </div>
                                    {ad.spend > 0 && <div style={{ fontSize: "0.58rem", color: "#d97706" }}>비용 ₩{ad.spend.toLocaleString()}</div>}
                                    {ad.title && <div style={{ fontSize: "0.58rem", color: "#6366f1", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.title}>{ad.title}</div>}
                                    {ad.body && <div style={{ fontSize: "0.54rem", color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.body}>{ad.body}</div>}
                                    {/* 랜딩 도메인 표시 */}
                                    {ad.landingDomain ? (
                                      <div style={{ marginTop: 3 }}>
                                        <span title={ad.landingUrl ?? ""} style={{
                                          display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: "0.5rem", fontWeight: 600,
                                          background: ad.isExternalLanding ? "#fef2f2" : "#f0fdf4",
                                          color: ad.isExternalLanding ? "#dc2626" : "#16a34a",
                                          border: `1px solid ${ad.isExternalLanding ? "#fecaca" : "#bbf7d0"}`,
                                        }}>
                                          {ad.isExternalLanding ? "⚠ " : ""}{ad.landingDomain}
                                        </span>
                                        {ad.isExternalLanding && (
                                          <div style={{ fontSize: "0.48rem", color: "#dc2626", marginTop: 1 }}>픽셀 추적 불가</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: 3 }}>
                                        <span style={{ fontSize: "0.5rem", color: "#94a3b8", fontStyle: "italic" }}>랜딩 URL 미확인</span>
                                      </div>
                                    )}
                                    <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                                      <a href={`https://www.facebook.com/ads/manager/creation/creative/?act=${selectedSite.account_id.replace("act_","")}&selected_adsets=${as.id}&selected_ads=${ad.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.54rem", color: "#6366f1", textDecoration: "none" }}>Meta에서 보기</a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {actionResult && (
            <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, background: actionResult.ok ? "#f0fdf4" : "#fef2f2", fontSize: "0.72rem", color: actionResult.ok ? "#16a34a" : "#dc2626" }}>
              {actionResult.msg}
            </div>
          )}
        </div>
      )}

      {/* LEADS로 복사 — 트래픽 캠페인이 있을 때 */}
      {campaigns.some((c) => c.objective === "OUTCOME_TRAFFIC" && c.status === "ACTIVE") && (
        <CloneAsLeadsSection accountId={selectedSite.account_id} campaigns={campaigns} onDone={loadHealth} />
      )}

      {/* 목표 문제 안내 */}
      {issueCount > 0 && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: "0.76rem", color: "#dc2626", lineHeight: 1.7 }}>
          <strong>캠페인 목표 경고:</strong> 트래픽(TRAFFIC) 목표 캠페인은 Meta AI가 "클릭 많이 하는 사람"에게 광고를 보여줌. 전환(구매/리드) 최적화가 안 됨.
          기존 캠페인의 목표는 변경 불가(Meta 제한) — 위 "LEADS로 복사" 버튼으로 기존 소재를 유지하면서 목표만 바꾼 새 캠페인을 만들 수 있음.
        </div>
      )}

      {/* 전환 이벤트 설명 */}
      <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <strong style={{ fontSize: "0.82rem", color: "#334155" }}>전환 이벤트란?</strong>
        <p style={{ fontSize: "0.76rem", color: "#64748b", margin: "6px 0 10px", lineHeight: 1.7 }}>
          Meta 광고를 돌릴 때, "이 광고가 성과를 냈는지" 판단하는 기준이다.
          캠페인 목표에 따라 어떤 행동을 "성공"으로 볼지가 달라진다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#dcfce7", border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>리드 (generate_lead)</div>
            <div style={{ fontSize: "0.68rem", color: "#166534", marginTop: 4, lineHeight: 1.5 }}>
              고객이 상담 폼을 제출. AIBIO처럼 쇼핑몰이 없는 서비스에 적합.
              Meta AI가 "폼 제출 가능성 높은 사람"에게 광고를 보여줌.
            </div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#dbeafe", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2563eb" }}>구매 (purchase)</div>
            <div style={{ fontSize: "0.68rem", color: "#1e40af", marginTop: 4, lineHeight: 1.5 }}>
              고객이 상품을 결제. 바이오컴처럼 온라인 쇼핑몰이 있는 경우에 적합.
              Meta AI가 "구매 가능성 높은 사람"에게 광고를 보여줌.
            </div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fde68a" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e" }}>트래픽 (landing_page_view)</div>
            <div style={{ fontSize: "0.68rem", color: "#78350f", marginTop: 4, lineHeight: 1.5 }}>
              고객이 페이지를 방문. "많이 보여주기"만 할 때 사용.
              Meta AI가 "클릭 잘 하는 사람"에게 노출 → 전환 최적화 안 됨.
            </div>
          </div>
        </div>
      </div>

      {/* 외부 랜딩 도메인 경고 — 소재 중 네이버 등 외부 도메인이 있으면 표시 */}
      {expandedCampaign && campaignDetail && campaignDetail.adsets.some((as) => as.ads.some((ad) => ad.isExternalLanding)) && (
        <div style={{ marginTop: 12, padding: "16px 18px", borderRadius: 10, background: "linear-gradient(180deg, #fef2f2, #fff)", border: "1px solid #fecaca" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: "1rem" }}>{"⚠️"}</span>
            <strong style={{ fontSize: "0.85rem", color: "#dc2626" }}>외부 도메인 랜딩 — 전환 추적 불가 감지</strong>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.7, marginBottom: 12 }}>
            일부 소재가 네이버 플레이스/예약 등 외부 도메인으로 랜딩하고 있소.
            이 도메인에는 Meta 픽셀과 GTM 태그가 설치되지 않아 <strong>전환(리드/구매)이 집계되지 않소</strong>.
          </div>

          {/* 외부 도메인 소재 목록 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>전환 추적 불가 소재:</div>
            {campaignDetail.adsets.flatMap((as) => as.ads.filter((ad) => ad.isExternalLanding).map((ad) => (
              <div key={ad.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", marginBottom: 4, borderRadius: 4, background: "#fff5f5", fontSize: "0.72rem" }}>
                <span style={{ padding: "1px 6px", borderRadius: 3, background: "#fecaca", color: "#991b1b", fontWeight: 600, fontSize: "0.6rem" }}>{ad.landingDomain}</span>
                <span style={{ color: "#334155" }}>{ad.name}</span>
                <span style={{ color: "#94a3b8", fontSize: "0.64rem" }}>{ad.status === "ACTIVE" ? "활성" : "정지"}</span>
              </div>
            )))}
          </div>

          {/* 해결 방안 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "0.9rem" }}>{"🤖"}</span>
                <strong style={{ fontSize: "0.78rem", color: "#4338ca" }}>Claude Code 분석</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#334155", lineHeight: 1.7 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 8 }}>
                  <strong style={{ color: "#dc2626" }}>문제:</strong> 네이버 플레이스/예약에는 커스텀 스크립트(Meta 픽셀, GTM) 삽입 불가. 네이버가 제공하는 플랫폼이라 HTML 편집 권한 없음.
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 8 }}>
                  <strong style={{ color: "#d97706" }}>영향:</strong>{"\n"}
                  · LEADS 캠페인에서 이 소재 전환 = 0 → Meta AI가 이 소재를 비효율로 판단{"\n"}
                  · Meta가 자사몰 소재에만 예산 집중 → 네이버 예약 유입 감소{"\n"}
                  · CPL 과대평가 (실제 리드보다 적게 잡힘)
                </div>
                <strong style={{ color: "#4338ca" }}>해결 방안 (권장순):</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: "0.72rem" }}>
                  <li style={{ marginBottom: 4 }}><strong>자사몰 랜딩 통일</strong> — 가장 확실. 모든 소재를 aibio.kr로 변경하면 픽셀 추적 + CAPI 모두 작동</li>
                  <li style={{ marginBottom: 4 }}><strong>네이버 소재 분리</strong> — LEADS 캠페인에서 제외하고 별도 TRAFFIC 광고세트로 유지. Meta AI 학습 왜곡 방지</li>
                  <li style={{ marginBottom: 4 }}><strong>UTM + GA4 우회</strong> — 네이버 URL에 UTM 파라미터 붙여 GA4에서 추적. Meta 전환에는 안 잡히지만 성과 측정은 가능</li>
                  <li><strong>네이버 예약 API 연동</strong> — 네이버 예약 완료를 서버에서 감지 → Meta CAPI로 전송. 기술적 난이도 높음</li>
                </ol>
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #bbf7d0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "0.9rem" }}>{"🧠"}</span>
                <strong style={{ fontSize: "0.78rem", color: "#166534" }}>Codex 분석</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#334155", lineHeight: 1.7 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 8 }}>
                  <strong style={{ color: "#166534" }}>기술적 확인:</strong>{"\n"}
                  · 네이버 플레이스(map.naver.com): 사업자 커스텀 HTML 삽입 불가{"\n"}
                  · 네이버 예약(booking.naver.com): 예약 위젯 커스텀 불가{"\n"}
                  · 두 도메인 모두 네이버 SaaS 플랫폼 → 서드파티 JS 주입 차단
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "#ecfdf5", border: "1px solid #bbf7d0", marginBottom: 8 }}>
                  <strong style={{ color: "#166534" }}>CAPI 서버사이드 접근:</strong>{"\n"}
                  현재 CAPI 구현(metaCapi.ts)은 Toss 결제 기반이오. 네이버 예약의 경우:{"\n"}
                  · 네이버 예약 API(비공개) 또는 웹훅이 필요{"\n"}
                  · 현재는 예약 완료 이벤트를 서버에서 감지할 방법이 없음{"\n"}
                  · 수동으로 네이버 예약 건을 CAPI로 전송하는 것은 가능하나 자동화 어려움
                </div>
                <strong style={{ color: "#166534" }}>권장:</strong> 단기적으로 자사몰 랜딩 통일이 가장 ROI 높음. 리드 캠페인에는 이미 자사몰 소재만 복사되어 있으므로, 트래픽 캠페인의 네이버 소재만 정리하면 됨.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CloneAsLeadsSection({ accountId, campaigns, onDone }: { accountId: string; campaigns: CampaignHealth[]; onDone: () => void }) {
  const trafficCampaigns = campaigns.filter((c) => c.objective === "OUTCOME_TRAFFIC" && c.status === "ACTIVE");
  const [selectedSource, setSelectedSource] = useState(trafficCampaigns[0]?.id ?? "");
  const [newName, setNewName] = useState(() => {
    const now = new Date();
    const ts = `${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
    return `리드 캠페인 (소재복사 ${ts})`;
  });
  const [budget, setBudget] = useState(50000);
  const [activeOnly, setActiveOnly] = useState(true);
  const [leadType, setLeadType] = useState<"website" | "instant_form">("website");
  const [pixelId, setPixelId] = useState("1068377347547682"); // AIBIO 픽셀 기본값
  const [customEventType, setCustomEventType] = useState("LEAD");
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; summary?: { adsetsCreated: number; adsCreated: number; skippedPausedAds: number }; newCampaign?: { id: string }; error?: string; message?: string; errorDetail?: { message: string; code?: number; error_subcode?: number; error_data?: string; fbtrace_id?: string } } | null>(null);

  const PIXEL_PRESETS = [
    { id: "1068377347547682", label: "AIBIO 리커버리랩스" },
    { id: "1283400029487161", label: "바이오컴" },
    { id: "1186437633687388", label: "더클린커피" },
  ];

  const handleClone = async () => {
    setCloning(true);
    setResult(null);
    try {
      const bodyPayload: Record<string, unknown> = {
        accountId,
        sourceCampaignId: selectedSource,
        newName,
        dailyBudget: budget,
        copyActiveAdsOnly: activeOnly,
        leadType,
        pageId: "110337454469232",
      };
      if (leadType === "website") {
        bodyPayload.pixelId = pixelId;
        bodyPayload.customEventType = customEventType;
      }
      const res = await fetch(`${API_BASE}/api/meta/campaigns/clone-as-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const d = await res.json();
      setResult(d);
      if (d.ok) onDone();
    } catch { setResult({ ok: false, error: "요청 실패" }); }
    finally { setCloning(false); }
  };

  if (trafficCampaigns.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 10, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
      <strong style={{ fontSize: "0.85rem", color: "#4338ca" }}>기존 소재 유지 → LEADS 목표 캠페인으로 복사</strong>
      <p style={{ fontSize: "0.72rem", color: "#64748b", margin: "4px 0 12px" }}>
        기존 트래픽 캠페인의 타겟/소재를 그대로 복사하고, 목표만 LEADS(리드)로 변경한 새 캠페인을 PAUSED 상태로 생성.
      </p>

      {/* 리드 타입 선택 */}
      <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e0e7ff" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4338ca", marginBottom: 8 }}>전환 추적 방식 선택</div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            border: `2px solid ${leadType === "website" ? "#4338ca" : "#e2e8f0"}`,
            background: leadType === "website" ? "#eef2ff" : "#fff",
          }}>
            <input type="radio" name="leadType" checked={leadType === "website"} onChange={() => setLeadType("website")} style={{ display: "none" }} />
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: leadType === "website" ? "#4338ca" : "#334155" }}>웹사이트 리드 (권장)</div>
            <div style={{ fontSize: "0.64rem", color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Meta 픽셀 + 전환 이벤트로 추적. 고객이 웹사이트에서 폼 제출 시 전환으로 집계.
              <br />AIBIO generate_lead처럼 GTM 태그가 설정된 경우 적합.
            </div>
          </label>
          <label style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            border: `2px solid ${leadType === "instant_form" ? "#4338ca" : "#e2e8f0"}`,
            background: leadType === "instant_form" ? "#eef2ff" : "#fff",
          }}>
            <input type="radio" name="leadType" checked={leadType === "instant_form"} onChange={() => setLeadType("instant_form")} style={{ display: "none" }} />
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: leadType === "instant_form" ? "#4338ca" : "#334155" }}>인스턴트 폼</div>
            <div style={{ fontSize: "0.64rem", color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              Meta 앱 내 폼으로 리드 수집. 별도 랜딩 페이지 불필요.
              <br />빠른 리드 수집이 목적이나, 리드 품질이 낮을 수 있음.
            </div>
          </label>
        </div>

        {/* 웹사이트 리드 설정 */}
        {leadType === "website" && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: "0.64rem", color: "#94a3b8", fontWeight: 600 }}>픽셀 ID</label>
              <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.76rem", marginTop: 4 }}>
                {PIXEL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.id.slice(-6)})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.64rem", color: "#94a3b8", fontWeight: 600 }}>전환 이벤트 타입</label>
              <select value={customEventType} onChange={(e) => setCustomEventType(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.76rem", marginTop: 4 }}>
                <option value="LEAD">LEAD (폼 제출 / 상담 예약)</option>
                <option value="PURCHASE">PURCHASE (구매)</option>
                <option value="COMPLETE_REGISTRATION">COMPLETE_REGISTRATION (회원가입)</option>
                <option value="CONTACT">CONTACT (문의)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>소스 캠페인</label>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }}>
            {trafficCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>새 캠페인 이름</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>일 예산 (원)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.78rem", marginTop: 4 }} />
        </div>
        <button type="button" onClick={handleClone} disabled={cloning || !selectedSource} style={{
          padding: "8px 16px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
          background: "#4338ca", color: "#fff", border: "none", whiteSpace: "nowrap",
        }}>
          {cloning ? "복사 중..." : "LEADS로 복사 실행"}
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: "0.72rem", color: "#64748b" }}>
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
        활성 소재만 복사 (일시정지 소재 제외)
      </label>

      {/* 현재 설정 요약 */}
      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.6 }}>
        <strong style={{ color: "#334155" }}>설정 요약:</strong>{" "}
        {leadType === "website" ? (
          <>웹사이트 리드 · 픽셀 {PIXEL_PRESETS.find((p) => p.id === pixelId)?.label ?? pixelId} · 이벤트 {customEventType} · promoted_object: {`{pixel_id: "${pixelId}", custom_event_type: "${customEventType}"}`}</>
        ) : (
          <>인스턴트 폼 · promoted_object: {`{page_id: "110337454469232"}`}</>
        )}
      </div>
      {result && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: result.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`, fontSize: "0.78rem", color: result.ok ? "#16a34a" : "#dc2626" }}>
          {result.ok ? (
            <>
              LEADS 캠페인 복사 완료 (ID: {result.newCampaign?.id}).
              광고세트 {result.summary?.adsetsCreated}개, 소재 {result.summary?.adsCreated}개 연결.
              {(result.summary?.skippedPausedAds ?? 0) > 0 && ` 일시정지 소재 ${result.summary!.skippedPausedAds}개 제외.`}
              {" "}PAUSED 상태 — Meta 광고 관리자에서 확인 후 활성화.
            </>
          ) : (
            <>
              <div><strong>실패:</strong> {result.error}</div>
              {result.message && <div style={{ marginTop: 4, fontSize: "0.72rem" }}>{result.message}</div>}
              {result.errorDetail && (
                <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 6, background: "#fff5f5", border: "1px solid #fecaca", fontSize: "0.68rem", color: "#991b1b", fontFamily: "monospace", lineHeight: 1.5 }}>
                  <div>Meta 에러 상세:</div>
                  <div>code: {result.errorDetail.code} · subcode: {result.errorDetail.error_subcode ?? "없음"}</div>
                  <div>message: {result.errorDetail.message}</div>
                  {result.errorDetail.error_data && <div>data: {result.errorDetail.error_data}</div>}
                  {result.errorDetail.fbtrace_id && <div>trace: {result.errorDetail.fbtrace_id}</div>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CapiStatusSection() {
  const [capiLog, setCapiLog] = useState<{
    summary: CapiLogSummary;
    dedupCandidateDetails: CapiDedupCandidateDetail[];
    latestSentAt: string;
  } | null>(null);

  useEffect(() => {
    fetch(`${ADS_REPORTING_API_BASE}/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=3`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCapiLog({
            summary: d.summary,
            dedupCandidateDetails: d.dedupCandidateDetails ?? [],
            latestSentAt: d.items?.[0]?.timestamp ?? "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const capiSummary = capiLog?.summary ?? null;
  const capiBreakdown = capiSummary?.duplicateOrderEventBreakdown ?? null;
  const highRiskDetails = capiLog?.dedupCandidateDetails ?? [];
  const highRiskSamples = capiSummary?.duplicateOrderEventSamples
    .filter((sample) => sample.classification === "multiple_event_ids_duplicate_risk")
    .slice(0, 3) ?? [];

  return (
    <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #faf5ff, #fff)", border: "1px solid #e9d5ff", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: "1.1rem" }}>{"🔌"}</span>
        <strong style={{ fontSize: "0.92rem", color: "#7c3aed" }}>CAPI (서버사이드 전환) 현황</strong>
        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>운영 중</span>
      </div>

      {/* CAPI 상태 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>최근 7일 운영 성공 로그</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#7c3aed" }}>{capiSummary ? fmtNum(capiSummary.total) + "건" : "—"}</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>테스트/수동 호출 제외</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>동일 event_id 중복</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#d97706" }}>{capiSummary ? `${fmtNum(capiSummary.duplicateEventIdGroups)}그룹` : "—"}</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>중복 row {capiSummary ? fmtNum(capiSummary.duplicateEventIds) : "—"}건</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>같은 주문+이벤트 중복</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#d97706" }}>{capiSummary ? `${fmtNum(capiSummary.duplicateOrderEventGroups)}그룹` : "—"}</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>중복 row {capiSummary ? fmtNum(capiSummary.duplicateOrderEventKeys) : "—"}건</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #f3e8ff" }}>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>차단 후보</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#dc2626" }}>{capiBreakdown ? `${fmtNum(capiBreakdown.multiEventIdGroups)}그룹` : "—"}</div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>event_id 여러 개: {capiBreakdown ? fmtNum(capiBreakdown.multiEventIdRows) : "—"}건</div>
        </div>
      </div>

      {capiSummary && (
        <div style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #f3e8ff", marginBottom: 18 }}>
          <strong style={{ fontSize: "0.85rem", color: "#7c3aed" }}>CAPI 중복 분리 진단</strong>
          <p style={{ fontSize: "0.76rem", color: "#64748b", margin: "6px 0 12px", lineHeight: 1.6 }}>
            현재 표시는 최근 7일, 운영 결제, Meta 2xx 성공 로그만 본다. 같은 event_id 반복은 재시도형으로 보고, 같은 주문+이벤트에 event_id가 여러 개면 재전송 차단 후보로 본다. 브라우저 Pixel과 서버 CAPI가 동시에 들어왔는지는 이 서버 로그만으로 확정할 수 없어 Events Manager의 event_id 매칭 확인이 필요하다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: highRiskSamples.length ? 12 : 0 }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>운영/수동/테스트</div>
              <div style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 700 }}>
                {fmtNum(capiSummary.countsBySegment.operational)} / {fmtNum(capiSummary.countsBySegment.manual)} / {fmtNum(capiSummary.countsBySegment.test)}
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "0.68rem", color: "#92400e" }}>재시도형 중복</div>
              <div style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 700 }}>
                {fmtNum(capiBreakdown?.retryLikeGroups ?? 0)}그룹 · {fmtNum(capiBreakdown?.retryLikeRows ?? 0)}건
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "0.68rem", color: "#991b1b" }}>재전송 차단 후보</div>
              <div style={{ fontSize: "0.82rem", color: "#991b1b", fontWeight: 700 }}>
                {fmtNum(capiBreakdown?.multiEventIdGroups ?? 0)}그룹 · {fmtNum(capiBreakdown?.multiEventIdRows ?? 0)}건
              </div>
            </div>
          </div>
          {highRiskDetails.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {highRiskDetails.map((candidate) => (
                <div key={`${candidate.orderId}-${candidate.eventName}`} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.74rem", color: "#9a3412", lineHeight: 1.5 }}>
                  <strong>{candidate.orderId}</strong> · {candidate.eventName} · {fmtNum(candidate.count)}회 전송 · event_id {fmtNum(candidate.uniqueEventIds)}개
                  <div style={{ color: "#c2410c", marginTop: 3 }}>판정: 같은 주문에 서로 다른 event_id가 있어 Meta dedup이 안 될 수 있음. 이후 차단 규칙 후보.</div>
                  <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                    {candidate.rows.map((row) => (
                      <div key={`${row.eventId}-${row.createdAt}`} style={{ padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #ffedd5", color: "#7c2d12" }}>
                        {formatDateTime(row.createdAt)} · {row.eventId} · {row.sendPath} · {row.mode} · HTTP {row.responseStatus}
                        <div style={{ color: "#9a3412" }}>source_url: {row.eventSourceUrl || row.ledgerLanding || row.ledgerReferrer || "로그/원장에 없음"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : highRiskSamples.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {highRiskSamples.map((sample) => (
                <div key={`${sample.orderId}-${sample.eventName}`} style={{ padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.74rem", color: "#9a3412", lineHeight: 1.5 }}>
                  <strong>{sample.orderId}</strong> · {sample.eventName} · {fmtNum(sample.count)}회 전송 · event_id {fmtNum(sample.uniqueEventIds)}개
                  <div style={{ color: "#c2410c" }}>판정: 같은 주문에 서로 다른 event_id가 있어 Meta dedup이 안 될 수 있음. 이후 차단 규칙 후보.</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 가설 검증 타임라인 */}
      <div style={{ padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid #f3e8ff" }}>
        <strong style={{ fontSize: "0.85rem", color: "#7c3aed" }}>CAPI 효과 가설 — 검증 타임라인</strong>
        <p style={{ fontSize: "0.76rem", color: "#94a3b8", margin: "6px 0 12px" }}>
          CAPI 활성화 전/후를 비교하여 아래 가설이 맞는지 확인한다. 기준일: 2026-04-05.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            {
              period: "0~7일", date: "~04/12",
              hypothesis: "전환 건수 +25~50% 증가",
              metric: "Meta 전환 수",
              check: "Events Manager > 서버 이벤트 비중 확인. 전체 전환 중 서버 소스 비중이 20%+ 이면 iOS 복구 효과 있음.",
              status: "진행 중",
              color: "#d97706", bg: "#fffbeb", border: "#fde68a",
            },
            {
              period: "7~14일", date: "~04/19",
              hypothesis: "Meta AI 학습 → CPA 5~10% 하락",
              metric: "CPA 추이",
              check: "이 대시보드에서 기간을 '최근 7일'로 바꿔 CPA 비교. 04/05 이전 vs 이후.",
              status: "대기",
              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
            },
            {
              period: "14~30일", date: "~05/05",
              hypothesis: "ROAS 5.03x → 6~7.5x 개선",
              metric: "1d_click ROAS",
              check: "이 대시보드에서 '클릭 1일' 기준 ROAS를 04/05 전후로 비교. 즉시 전환 ROAS가 오르면 CAPI/식별자 개선 효과로 해석 가능.",
              status: "대기",
              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe",
            },
            {
              period: "30일+", date: "05/05~",
              hypothesis: "전환 매칭 품질(EMQ) '좋음' 달성",
              metric: "Events Manager EMQ 점수",
              check: "Events Manager > 이벤트 매칭 탭에서 품질 점수 확인. '보통' → '좋음'이면 fbp 쿠키 추가 검토.",
              status: "대기",
              color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0",
            },
          ].map((item) => (
            <div key={item.period} style={{ padding: "12px 14px", borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, fontSize: "0.76rem" }}>
              <div style={{ fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.period}</div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{item.date}</div>
              <div style={{ fontWeight: 600, color: "#334155", margin: "8px 0 4px", lineHeight: 1.4 }}>가설: {item.hypothesis}</div>
              <div style={{ color: "#64748b", lineHeight: 1.5 }}>확인 방법: {item.check}</div>
              <div style={{ marginTop: 6, fontSize: "0.68rem", fontWeight: 600, color: item.color }}>상태: {item.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CAPI 전송 요약 */}
      {capiSummary && capiSummary.total > 0 && (
        <div style={{ marginTop: 12, fontSize: "0.76rem", color: "#64748b", lineHeight: 1.6 }}>
          Pixel별 전송: {Object.entries(capiSummary.countsByPixelId).map(([pid, cnt]) => `${pid.slice(-6)}... ${cnt}건`).join(" · ")}
          {capiLog?.latestSentAt && ` · 최근 전송: ${capiLog.latestSentAt.slice(0, 16).replace("T", " ")}`}
        </div>
      )}
    </div>
  );
}

function AttributionCallerCoverageSection() {
  const [coverageReport, setCoverageReport] = useState<CallerCoverageReport | null>(null);
  const [coffeeCoverageReport, setCoffeeCoverageReport] = useState<CallerCoverageReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${ADS_REPORTING_API_BASE}/api/attribution/caller-coverage?paymentLimit=5&checkoutLimit=5`).then((r) => r.json()),
      fetch(`${ADS_REPORTING_API_BASE}/api/attribution/caller-coverage?source=thecleancoffee_imweb&paymentLimit=5&checkoutLimit=5`).then((r) => r.json()),
    ])
      .then(([allData, coffeeData]) => {
        if (cancelled) return;
        if (allData.ok) {
          setCoverageReport(allData.report ?? null);
          setCoffeeCoverageReport(coffeeData?.ok ? coffeeData.report ?? null : null);
          setLoadError(null);
        } else {
          setLoadError(allData.error ?? "caller coverage load failed");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("caller coverage load failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const payment = coverageReport?.paymentSuccess ?? null;
  const checkout = coverageReport?.checkoutStarted ?? null;
  const coffeePayment = coffeeCoverageReport?.paymentSuccess ?? null;
  const coffeeCheckout = coffeeCoverageReport?.checkoutStarted ?? null;
  const fmtRate = (value: number | null | undefined) => (value != null ? `${value.toFixed(2)}%` : "—");
  const identityCards = [
    {
      label: "결제완료 기록",
      value: payment ? `${fmtNum(payment.total)}건` : "—",
      note: "전태준 대표님 자체 솔루션 원장에 적재된 payment_success",
      color: "#0369a1",
      bg: "#eff6ff",
      border: "#bfdbfe",
    },
    {
      label: "3개 식별자 모두 있음",
      value: payment ? fmtRate(payment.allThreeRate) : "—",
      note: payment ? `${fmtNum(payment.withAllThree)}건 / ${fmtNum(payment.total)}건` : "ga_session_id + client_id + user_pseudo_id",
      color: payment && payment.allThreeRate >= 50 ? "#16a34a" : "#dc2626",
      bg: payment && payment.allThreeRate >= 50 ? "#f0fdf4" : "#fef2f2",
      border: payment && payment.allThreeRate >= 50 ? "#bbf7d0" : "#fecaca",
    },
    {
      label: "ga_session_id 있음",
      value: payment ? fmtRate(payment.gaSessionIdRate) : "—",
      note: payment ? `${fmtNum(payment.withGaSessionId)}건` : "GA4 세션 연결용 식별자",
      color: "#475569",
      bg: "#f8fafc",
      border: "#e2e8f0",
    },
    {
      label: "client_id / user_pseudo_id",
      value: payment ? `${fmtRate(payment.clientIdRate)} / ${fmtRate(payment.userPseudoIdRate)}` : "—",
      note: payment ? `${fmtNum(payment.withClientId)}건 / ${fmtNum(payment.withUserPseudoId)}건` : "브라우저 사용자 연결용 식별자",
      color: "#475569",
      bg: "#f8fafc",
      border: "#e2e8f0",
    },
  ];

  return (
    <div style={{ padding: "24px", borderRadius: 14, background: "linear-gradient(180deg, #eff6ff, #fff)", border: "1px solid #bfdbfe", marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <strong style={{ fontSize: "0.92rem", color: "#0369a1" }}>결제완료 식별자 품질</strong>
        <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: 6, background: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>개선 필요</span>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.7, margin: "0 0 14px" }}>
        이 섹션은 전태준 대표님이 구축한 자체 솔루션 원장에 쌓이는 결제완료 기록이 광고/GA4 식별자를 얼마나 같이 갖고 오는지 본다.
        데이터 소스는 VM 최신 원장 <code>att.ainativeos.net</code>이다. 식별자가 부족하면 주문은 잡혀도 광고 클릭, GA4 세션, Meta CAPI 이벤트를 한 사람의 흐름으로 묶기 어려워진다.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {identityCards.map((card) => (
          <div key={card.label} style={{ padding: "12px 14px", borderRadius: 10, background: card.bg, border: `1px solid ${card.border}` }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{card.label}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.5 }}>{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          {
            label: "전체 payment_success",
            value: payment ? fmtRate(payment.allThreeRate) : "—",
            note: payment ? `${fmtNum(payment.withAllThree)} / ${fmtNum(payment.total)}건 all-three` : "VM 최신 전체",
            color: payment && payment.allThreeRate >= 80 ? "#16a34a" : "#dc2626",
          },
          {
            label: "전체 checkout_started",
            value: checkout ? fmtRate(checkout.allThreeRate) : "—",
            note: checkout ? `${fmtNum(checkout.withAllThree)} / ${fmtNum(checkout.total)}건 all-three` : "VM 최신 전체",
            color: checkout && checkout.allThreeRate >= 80 ? "#16a34a" : "#dc2626",
          },
          {
            label: "커피 payment_success",
            value: coffeePayment ? fmtRate(coffeePayment.allThreeRate) : "—",
            note: coffeePayment ? `${fmtNum(coffeePayment.withAllThree)} / ${fmtNum(coffeePayment.total)}건 all-three` : "thecleancoffee_imweb",
            color: coffeePayment && coffeePayment.allThreeRate >= 80 ? "#16a34a" : "#dc2626",
          },
          {
            label: "커피 checkout_started",
            value: coffeeCheckout ? fmtRate(coffeeCheckout.allThreeRate) : "—",
            note: coffeeCheckout ? `${fmtNum(coffeeCheckout.withAllThree)} / ${fmtNum(coffeeCheckout.total)}건 all-three` : "thecleancoffee_imweb",
            color: coffeeCheckout && coffeeCheckout.allThreeRate >= 80 ? "#16a34a" : "#dc2626",
          },
        ].map((card) => (
          <div key={card.label} style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dbeafe" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{card.label}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.5 }}>{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #dbeafe", fontSize: "0.76rem", color: "#475569", lineHeight: 1.7 }}>
          <strong style={{ color: "#0369a1" }}>현재 해석</strong>
          <p style={{ margin: "6px 0 0" }}>
            {payment
              ? `VM 최신 전체 기준 결제완료 ${fmtNum(payment.total)}건 중 ga_session_id, client_id, user_pseudo_id가 모두 있는 건은 ${fmtNum(payment.withAllThree)}건(${fmtRate(payment.allThreeRate)})이다. 이전 로컬 snapshot의 29.37%보다는 개선됐지만, 목표 80% 대비 아직 낮다. 더클린커피만 보면 ${coffeePayment ? `${fmtNum(coffeePayment.withAllThree)}건 / ${fmtNum(coffeePayment.total)}건(${fmtRate(coffeePayment.allThreeRate)})` : "로딩 중"}이다.`
              : "caller coverage 데이터를 불러오는 중이다."}
          </p>
          {checkout && (
            <p style={{ margin: "8px 0 0" }}>
              결제 시작 단계는 전체 {fmtNum(checkout.total)}건 중 all-three {fmtRate(checkout.allThreeRate)}, 커피 {coffeeCheckout ? fmtRate(coffeeCheckout.allThreeRate) : "—"}다.
              즉 checkout_started는 대체로 식별자를 갖고 있고, 병목은 외부 결제/아임웹 결제완료 복귀 후 payment_success에서 식별자가 끊기는 경로다.
            </p>
          )}
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #dbeafe", fontSize: "0.76rem", color: "#475569", lineHeight: 1.7 }}>
          <strong style={{ color: "#0369a1" }}>개발 요청 기준</strong>
          <p style={{ margin: "6px 0 0" }}>
            결제완료 페이지와 결제완료 서버 호출에서 `ga_session_id`, `client_id`, `user_pseudo_id`를 자체 솔루션 원장에 같이 저장해야 한다. 그래야 Meta CAPI 중복 여부와 실제 광고 기여 주문을 주문 단위로 더 정확히 비교할 수 있다.
          </p>
          {coverageReport?.notes?.length ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {coverageReport.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          {loadError && <p style={{ margin: "8px 0 0", color: "#dc2626" }}>불러오기 실패: {loadError}</p>}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#475569", lineHeight: 1.7 }}>
          <strong style={{ color: "#0f172a" }}>내부 개발팀이 할 수 있는 일</strong>
          <p style={{ margin: "6px 0 0" }}>
            주 책임은 내부 구현이다. checkout_started 시점의 first-party storage/원장 식별자를 order_code, order_no, paymentKey, orderId에 묶고,
            payment_success 서버 호출이 들어오면 같은 키로 carry-over해서 `ga_session_id`, `client_id`, `user_pseudo_id`를 저장한다.
          </p>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#475569", lineHeight: 1.7 }}>
          <strong style={{ color: "#0f172a" }}>아임웹에 확인할 것</strong>
          <p style={{ margin: "6px 0 0" }}>
            결제완료 페이지 커스텀 스크립트가 실행되는 정확한 시점, `order_code/order_no/payment_code` 접근 가능 여부,
            결제완료 서버 호출에 커스텀 파라미터 또는 쿠키/세션 값을 안정적으로 실을 수 있는지 확인한다. 아임웹이 최종 페이지를 렌더링하므로 UX/스크립트 슬롯 확인은 아임웹 쪽이 핵심이다.
          </p>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.74rem", color: "#475569", lineHeight: 1.7 }}>
          <strong style={{ color: "#0f172a" }}>토스페이먼츠에 확인할 것</strong>
          <p style={{ margin: "6px 0 0" }}>
            Toss는 결제 승인/리다이렉트/웹훅의 `paymentKey`, `orderId`, 결제 상태 확인 역할이다.
            GA 식별자를 Toss에 저장시키는 방향은 맞지 않다. 다만 successUrl query 유지, 웹훅 DONE 상태, orderId 매칭 안정성은 Toss 문서 기준으로 확인한다.
          </p>
        </div>
      </div>
    </div>
  );
}
