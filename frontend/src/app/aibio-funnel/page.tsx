"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const AIBIO_ACCOUNT_ID = "act_377604674894011";
const AIBIO_PIXEL_ID = "1068377347547682";
const CHANNELTALK_CUSTOM_CONVERSION_ID = "26760275576970796";

type MetaCampaignRow = {
  campaign_id: string;
  campaign_name: string;
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
};

type MetaSummary = {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  avgCpc: number;
  totalLandingViews: number;
  totalLeads: number;
  totalPurchases: number;
  totalPurchaseValue?: number;
};

type MetaInsightsResponse = {
  ok?: boolean;
  rows?: MetaCampaignRow[];
  summary?: MetaSummary;
  error?: string;
};

type AcquisitionSite = {
  key: string;
  operationalConversions: number;
  rawConversions: number;
  excludedConversions: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  topChannel: { label: string; count: number; share: number } | null;
  channels: Array<{ key: string; label: string; count: number; share: number }>;
  campaigns: Array<{ label: string; count: number; share: number }>;
  landings: Array<{ label: string; count: number; share: number }>;
  insights?: string[];
  dataWarnings?: string[];
};

type AcquisitionResponse = {
  ok?: boolean;
  sites?: AcquisitionSite[];
  error?: string;
};

type AibioStatsResponse = {
  ok?: boolean;
  stats?: Record<string, unknown>;
  customers?: Record<string, unknown>;
  payments?: Record<string, unknown>;
  error?: string;
};

type AibioAdCrmAttributionResponse = {
  ok?: boolean;
  summary?: {
    rawFormSubmits: number;
    operationalFormSubmits: number;
    excludedTestOrDebug: number;
    withPhoneHash: number;
    phoneHashCoverageRate: number | null;
    matchedForms: number;
    matchedCustomers: number;
    matchRateAmongHashedForms: number | null;
    firstVisitCustomers: number;
    visitConsultCustomers: number;
    reservationCustomers: number;
    productUsageCustomers: number;
    paymentCustomers: number;
    grossRevenue: number;
    netRevenue: number;
  };
  campaigns?: Array<{
    campaign: string;
    forms: number;
    withPhoneHash: number;
    matchedCustomers: number;
    firstVisitCustomers: number;
    visitConsultCustomers: number;
    reservationCustomers: number;
    productUsageCustomers: number;
    paymentCustomers: number;
    grossRevenue: number;
  }>;
  freshness?: {
    latestLedgerAt: string | null;
    latestCustomerSyncedAt: string | null;
  };
  warnings?: string[];
  error?: string;
};

type LiveState = {
  meta: MetaInsightsResponse | null;
  acquisition: AcquisitionSite | null;
  aibioStats: AibioStatsResponse | null;
  adCrmAttribution: AibioAdCrmAttributionResponse | null;
  loading: boolean;
  fetchedAt: string | null;
  error: string | null;
};

const snapshotSummary: MetaSummary = {
  totalImpressions: 545340,
  totalClicks: 22754,
  totalSpend: 2667987,
  avgCpc: 117,
  totalLandingViews: 19926,
  totalLeads: 13,
  totalPurchases: 0,
};

const snapshotCampaigns: MetaCampaignRow[] = [
  {
    campaign_id: "120240475481810036",
    campaign_name: "26.01.16 리커버리랩 예약 캠페인",
    impressions: 518216,
    clicks: 21086,
    spend: 1495339,
    cpc: 73,
    cpm: 2886,
    ctr: 4.07,
    link_clicks: 20552,
    landing_page_views: 18821,
    leads: 0,
    purchases: 0,
  },
  {
    campaign_id: "120243904162820036",
    campaign_name: "리드 캠페인 (소재복사 0406_2352)",
    impressions: 27124,
    clicks: 1668,
    spend: 1172648,
    cpc: 703,
    cpm: 43233,
    ctr: 6.15,
    link_clicks: 1530,
    landing_page_views: 1105,
    leads: 13,
    purchases: 0,
  },
];

const sourceNotes = [
  {
    label: "Meta Ads API",
    value: "last_30d, 2026-03-26~2026-04-24",
    note: "광고 계정 act_377604674894011, 캠페인별 spend/link click/landing view/Lead 기준. 신뢰도 높음.",
  },
  {
    label: "Events Manager",
    value: "2026-04-23 화면 확인",
    note: "aibio_channeltalk_open 이벤트 총 4건 수신, Ads Insights 커스텀 전환 귀속은 아직 0건. 신뢰도 중간.",
  },
  {
    label: "Recovery Lab CRM",
    value: "2026-03-01~2026-04-30 화면 확인",
    note: "방문 222명, 신규 고객 49명, 결제 고객 6명, 매출 2,016,000원. Supabase 직접 조인 전까지 신뢰도 중간.",
  },
  {
    label: "AIBIO GitHub",
    value: "접근권한 확인 완료",
    note: "BiocomKR/aibio-frontend, BiocomKR/aibio-backend 모두 taejunjeon 계정으로 클론 가능. 신뢰도 높음.",
  },
];

const crmSnapshot = [
  { label: "신규 고객", value: "49명", note: "폼 제출 이후 CRM으로 넘어온 신규 방문상담 후보" },
  { label: "방문", value: "222명", note: "센터 운영 대시보드 방문 지표" },
  { label: "결제 고객", value: "6명", note: "방문 이후 실제 매출로 연결된 고객" },
  { label: "기간 매출", value: "₩2,016,000", note: "평균 객단가 ₩336,000" },
  { label: "방문→결제율", value: "12%", note: "현재 화면 기준 계산 지표" },
];

const visitJoinFindings = [
  {
    title: "광고 → 폼 제출",
    status: "가능",
    body: "fbclid, fbc/fbp, UTM, referrer, landing URL이 attribution ledger에 남는다. 현재 최근 30일 운영 폼 제출 34건 중 31건이 Meta/Instagram으로 분류된다.",
  },
  {
    title: "폼 제출 → 고객/방문",
    status: "조건부 가능",
    body: "푸터 v8.1부터 phone_hash_sha256을 남긴다. AIBIO CRM의 customers.phone을 서버에서 같은 방식으로 해시하면 원문 전화번호 노출 없이 조인할 수 있다.",
  },
  {
    title: "방문 → 실제 이용",
    status: "가능",
    body: "AIBIO 백엔드에는 marketing_leads.visit_consult_date, reservations, product_usage.service_date가 있다. 방문상담과 실제 서비스 이용을 분리해서 볼 수 있다.",
  },
  {
    title: "결제 → 광고 ROAS",
    status: "가능",
    body: "payments.customer_id와 조인하면 캠페인별 결제 고객, 결제액, 첫 결제까지 걸린 시간을 계산할 수 있다. 단, 지금 페이지의 캠페인별 매출은 아직 직접 조인 전이다.",
  },
];

const realVisitInsights = [
  {
    title: "현재 바로 말할 수 있는 것",
    body: "AIBIO 폼 제출의 대부분은 Meta/Instagram에서 온다. 최근 30일 운영 제출 34건 중 31건, 91.2%다. 주 랜딩은 /shop_view?idx=25로 30건, 88.2%를 차지한다.",
  },
  {
    title: "아직 말하면 안 되는 것",
    body: "특정 캠페인이 실제 방문 13명 또는 결제 고객 2명을 만들었다고 단정하면 안 된다. 현재는 Attribution 원장과 CRM 고객 테이블의 phone hash 조인이 아직 대시보드에 붙지 않았다.",
  },
  {
    title: "가설로 볼 수 있는 상한선",
    body: "같은 30일 창에서 운영 폼 34건, CRM 첫 방문 13명, 결제 고객 2명이 보인다. 전부 같은 풀이라고 가정하면 폼→방문 최대 38.2%, 폼→결제 최대 5.9%다. 이 값은 조인 전 upper bound다.",
  },
];

const backendJoinPlan = [
  "VM attribution ledger에서 source=aibio_imweb, touchpoint=form_submit, 운영 제출만 가져온다.",
  "metadata.form_fields_safe.phone_hash_sha256과 AIBIO customers.phone의 서버측 SHA-256 값을 매칭한다.",
  "matched customer_id로 marketing_leads, reservations, product_usage, payments를 읽는다.",
  "캠페인별 forms, matched customers, visit_consults, completed visits, payers, revenue, CPL, CPV, CAC를 계산한다.",
  "CAPI에는 Lead 다음 단계로 Schedule/Visit/Purchase를 event_id 기반 dedup 구조로 보낸다.",
];

const decisionCards = [
  {
    label: "감액 / 중지 후보",
    title: "26.01.16 리커버리랩 예약 캠페인",
    body: "트래픽 목표 캠페인이다. 30일간 링크 클릭 20,552건, 랜딩뷰 18,821건을 만들었지만 Meta Lead와 ChannelTalk 전환 귀속은 0건이다.",
    action: "리드 획득이 목표라면 일예산을 줄이거나 중지한다. 리타겟팅 풀 확보 목적이면 최소 예산만 남긴다.",
    accent: "#dc2626",
  },
  {
    label: "유지",
    title: "리드 캠페인 (소재복사 0406_2352)",
    body: "현재 Meta가 폼 제출을 Lead로 학습할 수 있는 유일한 주 캠페인이다. 30일간 Lead 13건이 잡혔다.",
    action: "끄지 않는다. CRM에서 상담 연결률과 방문률이 붙을 때까지 기준 캠페인으로 유지한다.",
    accent: "#0f766e",
  },
  {
    label: "증액 후보",
    title: "260401_리커버리랩 이벤트2",
    body: "최근 2026-04-24~25 API 기준 지출 99,042원에 Lead 3건, CPL 약 33,014원이다.",
    action: "테스트/허수 리드가 아니고 CRM 방문예약으로 이어지면 +10~20%만 단계 증액한다.",
    accent: "#16a34a",
  },
  {
    label: "보조 신호",
    title: "AIBIO - ChannelTalk Open",
    body: "커스텀 전환과 30일 오디언스는 만들어졌다. 다만 이벤트 표본이 4건 수준이고 광고 귀속 전환은 아직 0건이다.",
    action: "최적화 목표로 쓰지 말고 리타겟팅, 상담 의도 점수, UX 병목 확인용으로 쓴다.",
    accent: "#b45309",
  },
];

const engineeringSteps = [
  {
    title: "헤더 v1: 첫 유입 보존",
    body: "fbclid, fbc, fbp, UTM, referrer, GA client/session 값을 첫 유입과 최신 유입으로 분리 저장한다. 광고 클릭 정보가 폼 제출 순간까지 살아 있게 만드는 단계다.",
  },
  {
    title: "푸터 v8.1: 아임웹 폼 제출 감지",
    body: "아임웹 기본 입력폼의 성공 신호를 감지하고 이름/연락처 원문은 Meta로 보내지 않는다. 내부 원장에는 안전 필드와 해시, 폼 위젯 ID, 랜딩 URL, 유입 식별자를 남긴다.",
  },
  {
    title: "테스트 리드 분리",
    body: "010-0000-0000 같은 테스트 연락처는 내부에는 남기되 Meta Lead와 운영 분석에서는 제외한다. 2026-04-25 15:07 KST 제출 테스트가 이 규칙으로 분리됐다.",
  },
  {
    title: "GTM / Meta Pixel Lead",
    body: "운영 제출은 dataLayer의 aibio_form_submit으로 들어가고 GTM에서 GA4 generate_lead, Meta Pixel Lead로 매핑된다. Pixel ID는 1068377347547682다.",
  },
  {
    title: "ChannelTalk 마이크로 전환",
    body: "채널톡 열기는 aibio_channeltalk_open으로 따로 기록한다. 상담 의도는 높지만 아직 최종 리드는 아니므로 Lead 최적화가 아니라 리타겟팅과 보조 점수로 쓴다.",
  },
  {
    title: "CAPI 확장 계획",
    body: "Lead는 브라우저 픽셀만으로도 잡히지만, 광고 효율을 더 올리려면 서버 CAPI로 Lead/상담예약/방문/결제 이벤트를 보강한다. 핵심은 event_id로 중복 제거하는 것이다.",
  },
];

const crmJoinPlan = [
  "Meta 광고 클릭과 아임웹 폼 제출은 내부 attribution ledger에 저장한다.",
  "AIBIO Supabase 프로젝트 aibio-center의 고객, 방문, 예약, 결제 테이블과 phone hash, 제출 시각, UTM, fbc/fbp를 기준으로 조인한다.",
  "마케팅 판단 지표를 Lead 수에서 Qualified Lead, 상담 연결, 방문, 결제, 30일 매출로 올린다.",
  "방문/결제까지 검증된 캠페인의 event_id를 CAPI로 되돌려 Meta가 좋은 리드 패턴을 더 빨리 학습하게 만든다.",
];

const futureRoadmap = [
  { phase: "1", title: "리드 품질 장부", text: "폼 제출 row마다 테스트/허수/중복/고관여 여부를 분리하고, 상담 목적과 유입경로를 점수화한다." },
  { phase: "2", title: "CRM 조인", text: "Supabase aibio-center에서 방문·예약·결제 데이터를 가져와 광고 캠페인과 연결한다." },
  { phase: "3", title: "CAPI 보강", text: "Lead, Schedule, Visit, Purchase를 서버 이벤트로 전송하고 Pixel 이벤트와 event_id로 dedup한다." },
  { phase: "4", title: "예산 자동 판정", text: "캠페인별 CPL이 아니라 방문당 비용, 결제당 비용, 30일 LTV/CAC로 유지·중지·증액을 제안한다." },
];

const fmtKRW = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
};

const fmtNum = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("ko-KR");
};

const fmtPct = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

const formatKst = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AibioFunnelPage() {
  const [live, setLive] = useState<LiveState>({
    meta: null,
    acquisition: null,
    aibioStats: null,
    adCrmAttribution: null,
    loading: true,
    fetchedAt: null,
    error: null,
  });

  useEffect(() => {
    const ac = new AbortController();

    const load = async () => {
      try {
        const [meta, acquisition, aibioStats, adCrmAttribution] = await Promise.all([
          fetch(`${API_BASE}/api/meta/insights?account_id=${AIBIO_ACCOUNT_ID}&date_preset=last_30d&attribution_window=1d_click`, { signal: ac.signal })
            .then((res) => res.ok ? res.json() as Promise<MetaInsightsResponse> : null)
            .catch(() => null),
          fetch(`${API_BASE}/api/attribution/acquisition-summary?rangeDays=30&dataSource=vm`, { signal: ac.signal })
            .then((res) => res.ok ? res.json() as Promise<AcquisitionResponse> : null)
            .catch(() => null),
          fetch(`${API_BASE}/api/aibio/stats`, { signal: ac.signal })
            .then((res) => res.ok ? res.json() as Promise<AibioStatsResponse> : null)
            .catch(() => null),
          fetch(`${API_BASE}/api/aibio/ad-crm-attribution?rangeDays=30&dataSource=vm&includeRows=false`, { signal: ac.signal })
            .then((res) => res.ok ? res.json() as Promise<AibioAdCrmAttributionResponse> : null)
            .catch(() => null),
        ]);

        if (ac.signal.aborted) return;
        setLive({
          meta,
          acquisition: acquisition?.sites?.find((site) => site.key === "aibio") ?? null,
          aibioStats,
          adCrmAttribution,
          loading: false,
          fetchedAt: new Date().toISOString(),
          error: null,
        });
      } catch (error) {
        if (ac.signal.aborted) return;
        setLive({
          meta: null,
          acquisition: null,
          aibioStats: null,
          adCrmAttribution: null,
          loading: false,
          fetchedAt: null,
          error: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
        });
      }
    };

    void load();
    return () => ac.abort();
  }, []);

  const summary = live.meta?.ok && live.meta.summary ? live.meta.summary : snapshotSummary;
  const campaigns = live.meta?.ok && live.meta.rows?.length ? live.meta.rows : snapshotCampaigns;

  const leadCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.campaign_name.includes("리드 캠페인")) ?? snapshotCampaigns[1],
    [campaigns],
  );
  const trafficCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.campaign_name.includes("26.01.16")) ?? snapshotCampaigns[0],
    [campaigns],
  );

  const totalCpl = summary.totalLeads > 0 ? summary.totalSpend / summary.totalLeads : null;
  const clickToLanding = summary.totalClicks > 0 ? summary.totalLandingViews / summary.totalClicks : null;
  const landingToLead = summary.totalLandingViews > 0 ? summary.totalLeads / summary.totalLandingViews : null;
  const leadCampaignCpl = leadCampaign.leads > 0 ? leadCampaign.spend / leadCampaign.leads : null;
  const trafficLeadRate = trafficCampaign.landing_page_views > 0 ? trafficCampaign.leads / trafficCampaign.landing_page_views : null;
  const acquisitionForms = live.acquisition?.operationalConversions ?? null;
  const excludedForms = live.acquisition?.excludedConversions ?? null;
  const topChannel = live.acquisition?.topChannel?.label ?? "Meta/Instagram 확인 중";
  const latestFormAt = live.acquisition?.latestLoggedAt ?? null;
  const operationalForms = live.acquisition?.operationalConversions ?? 34;
  const metaForms = live.acquisition?.channels.find((channel) => channel.key === "meta")?.count ?? 31;
  const primaryLanding = live.acquisition?.landings[0]?.label ?? "/shop_view?idx=25";
  const primaryLandingCount = live.acquisition?.landings[0]?.count ?? 30;
  const metaFormShare = operationalForms > 0 ? metaForms / operationalForms : null;
  const firstVisitUpperBound = operationalForms > 0 ? 13 / operationalForms : null;
  const payerUpperBound = operationalForms > 0 ? 2 / operationalForms : null;
  const joinSummary = live.adCrmAttribution?.ok ? live.adCrmAttribution.summary : null;
  const joinCampaigns = live.adCrmAttribution?.ok ? live.adCrmAttribution.campaigns ?? [] : [];
  const joinSnapshot = [
    {
      label: "읽기 API 운영 제출",
      value: joinSummary ? `${fmtNum(joinSummary.operationalFormSubmits)}건` : "34건",
      note: joinSummary ? `raw ${fmtNum(joinSummary.rawFormSubmits)} · 제외 ${fmtNum(joinSummary.excludedTestOrDebug)}` : "VM 원장 기준 fallback",
    },
    {
      label: "phone hash 적용",
      value: joinSummary ? `${fmtNum(joinSummary.withPhoneHash)}건` : "0건",
      note: joinSummary ? `운영 제출 커버리지 ${fmtPct(joinSummary.phoneHashCoverageRate)}` : "운영 row 기준",
    },
    {
      label: "고객 매칭",
      value: joinSummary ? `${fmtNum(joinSummary.matchedCustomers)}명` : "0명",
      note: joinSummary ? `hashed form 매칭률 ${fmtPct(joinSummary.matchRateAmongHashedForms)}` : "customer_id 조인 전",
    },
    {
      label: "방문상담 매칭",
      value: joinSummary ? `${fmtNum(joinSummary.visitConsultCustomers)}명` : "0명",
      note: "marketing_leads.visit_consult_date",
    },
    {
      label: "실제 이용 매칭",
      value: joinSummary ? `${fmtNum(joinSummary.productUsageCustomers)}명` : "0명",
      note: "product_usage.service_date",
    },
    {
      label: "결제 매칭",
      value: joinSummary ? `${fmtKRW(joinSummary.grossRevenue)}` : "₩0",
      note: joinSummary ? `결제 고객 ${fmtNum(joinSummary.paymentCustomers)}명` : "payments.customer_id",
    },
  ];

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main style={{
        minHeight: "100vh",
        background: "#f6f8f7",
        color: "#172027",
        padding: "30px 24px 56px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <Link href="/#ai-crm" style={{ color: "#0f766e", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                ← AI CRM으로 돌아가기
              </Link>
              <h1 style={{ margin: "8px 0 8px", fontSize: 30, lineHeight: 1.25, letterSpacing: 0, color: "#111827" }}>
                AIBIO 리커버리랩 광고 퍼널
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "#52605c", lineHeight: 1.7, fontSize: 15 }}>
                광고를 많이 태웠는지가 아니라 어떤 광고가 상담 가능성이 높은 사람을 데려오고,
                그 사람이 폼 제출, 채널톡, 방문, 결제까지 이어지는지를 한 화면에서 판단한다.
              </p>
            </div>
            <div style={{
              border: "1px solid #d7ded9",
              background: "#ffffff",
              borderRadius: 8,
              padding: "12px 14px",
              minWidth: 260,
              boxShadow: "0 1px 8px rgba(17,24,39,0.05)",
            }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>데이터 상태</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 900 }}>
                <span style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: live.loading ? "#d97706" : live.meta?.ok ? "#16a34a" : "#ef4444",
                  display: "inline-block",
                }} />
                {live.loading ? "API 확인 중" : live.meta?.ok ? "Live API 연결" : "Snapshot 표시"}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>
                {live.fetchedAt ? `갱신 ${formatKst(live.fetchedAt)}` : "기준 스냅샷: 2026-04-25 KST"}
                {live.error ? ` · ${live.error}` : ""}
              </div>
            </div>
          </div>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 18 }}>
            <MetricCard label="30일 광고비" value={fmtKRW(summary.totalSpend)} note="Meta API / AIBIO 계정" accent="#dc2626" />
            <MetricCard label="링크 클릭" value={`${fmtNum(summary.totalClicks)}건`} note={`클릭→랜딩 ${fmtPct(clickToLanding)}`} accent="#0f766e" />
            <MetricCard label="랜딩뷰" value={`${fmtNum(summary.totalLandingViews)}건`} note={`랜딩→Lead ${fmtPct(landingToLead)}`} accent="#256f63" />
            <MetricCard label="Meta Lead" value={`${fmtNum(summary.totalLeads)}건`} note={`평균 CPL ${fmtKRW(totalCpl)}`} accent="#16a34a" />
            <MetricCard label="내부 폼 제출" value={acquisitionForms != null ? `${fmtNum(acquisitionForms)}건` : "연동 확인 중"} note={excludedForms != null ? `테스트 제외 ${fmtNum(excludedForms)}건` : "VM attribution 원장"} accent="#b45309" />
            <MetricCard label="채널톡 열기" value="4건" note="Events Manager 수신, 광고 귀속 0건" accent="#7c2d12" />
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <Eyebrow>현재 운영 판단</Eyebrow>
                  <h2 style={sectionTitleStyle}>전체 광고를 끄는 문제가 아니라, 트래픽 예산을 Lead 학습 쪽으로 이동하는 문제다.</h2>
                </div>
                <Link href="/ads" style={{
                  alignSelf: "flex-start",
                  color: "#0f766e",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 900,
                  textDecoration: "none",
                }}>
                  Meta 상세 보기
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                {decisionCards.map((card) => (
                  <DecisionCard key={card.title} {...card} />
                ))}
              </div>
            </Panel>

            <Panel>
              <Eyebrow>캠페인 비교</Eyebrow>
              <h2 style={sectionTitleStyle}>Lead 캠페인이 학습 기준점이다.</h2>
              <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                <CampaignBar
                  label="트래픽 캠페인"
                  spend={trafficCampaign.spend}
                  clicks={trafficCampaign.link_clicks || trafficCampaign.clicks}
                  landingViews={trafficCampaign.landing_page_views}
                  leads={trafficCampaign.leads}
                  maxSpend={Math.max(trafficCampaign.spend, leadCampaign.spend)}
                  accent="#dc2626"
                  note={`Lead rate ${fmtPct(trafficLeadRate)} · 리드 획득 목적이면 축소`}
                />
                <CampaignBar
                  label="리드 캠페인"
                  spend={leadCampaign.spend}
                  clicks={leadCampaign.link_clicks || leadCampaign.clicks}
                  landingViews={leadCampaign.landing_page_views}
                  leads={leadCampaign.leads}
                  maxSpend={Math.max(trafficCampaign.spend, leadCampaign.spend)}
                  accent="#16a34a"
                  note={`CPL ${fmtKRW(leadCampaignCpl)} · 유지 후 품질 검증`}
                />
              </div>
            </Panel>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <Eyebrow>우리가 만든 AI 엔지니어링</Eyebrow>
              <h2 style={sectionTitleStyle}>단순 버튼 추적이 아니라, Meta가 배울 수 있는 리드 신호를 정제하고 있다.</h2>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {engineeringSteps.map((step, index) => (
                  <FlowStep key={step.title} index={index + 1} title={step.title}>
                    {step.body}
                  </FlowStep>
                ))}
              </div>
            </Panel>

            <Panel>
              <Eyebrow>추적 파이프라인</Eyebrow>
              <h2 style={sectionTitleStyle}>폼 제출은 Lead, 채널톡은 의도 신호, CRM은 품질 판정이다.</h2>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <PipelineRow left="광고 클릭" right="fbclid · fbc · fbp · UTM 보존" />
                <PipelineRow left="아임웹 폼" right="푸터 v8.1이 제출 성공 감지" />
                <PipelineRow left="Meta" right={`Pixel ${AIBIO_PIXEL_ID} Lead 전송`} />
                <PipelineRow left="채널톡" right={`Custom Conversion ${CHANNELTALK_CUSTOM_CONVERSION_ID}`} />
                <PipelineRow left="내부 원장" right="테스트 제외 · phone hash · form_widget_id 저장" />
                <PipelineRow left="CRM" right="방문, 결제, 재방문과 조인" />
              </div>
              <div style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: 13,
                lineHeight: 1.65,
                fontWeight: 700,
              }}>
                마케팅팀에 보여줄 핵심 문장: “AIBIO는 이제 클릭 광고가 아니라 리드 품질을 학습시키는 구조로 바뀌고 있습니다.”
              </div>
            </Panel>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <Eyebrow>Recovery Lab CRM 연동 설계</Eyebrow>
              <h2 style={sectionTitleStyle}>방문 지표와 붙으면 광고 판단 기준이 달라진다.</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 14 }}>
                {crmSnapshot.map((item) => (
                  <div key={item.label} style={{ border: "1px solid #d9e2dd", borderRadius: 8, background: "#fbfdfc", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 950, color: "#0f766e" }}>{item.value}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginTop: 4 }}>{item.note}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, color: "#52605c", fontSize: 13, lineHeight: 1.7 }}>
                현재 화면 지표만 보면 방문은 발생하고 있다. 다음 병목은 “어떤 광고가 방문자를 만들었는지”와
                “그 방문자가 결제 고객 6명 안에 들어갔는지”를 연결하는 것이다.
              </div>
            </Panel>

            <Panel>
              <Eyebrow>Supabase aibio-center 조인 플랜</Eyebrow>
              <h2 style={sectionTitleStyle}>광고 성과를 센터 매출 언어로 번역한다.</h2>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {crmJoinPlan.map((item, index) => (
                  <div key={item} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 28,
                      height: 28,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      background: "#ecfdf5",
                      color: "#0f766e",
                      fontWeight: 950,
                      border: "1px solid #a7f3d0",
                      fontSize: 13,
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.65 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 13,
                lineHeight: 1.65,
              }}>
                GitHub 초대 레포는 접근 확인이 끝났다. AIBIO 백엔드 스키마 기준으로 customers, marketing_leads,
                reservations, product_usage, payments를 읽으면 방문과 결제까지 이어지는 광고 품질 지표를 만들 수 있다.
              </div>
            </Panel>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <Eyebrow>실제 방문 연동 검토</Eyebrow>
              <h2 style={sectionTitleStyle}>연동은 가능하다. 다만 지금 당장 캠페인별 방문 ROAS라고 부르면 안 된다.</h2>
              <p style={bodyStyle}>
                현재는 광고 클릭과 폼 제출까지는 강하게 연결돼 있다. 다음 단계는 폼 제출자와 AIBIO CRM 고객을
                전화번호 해시로 매칭하고, 그 고객의 방문상담, 예약, 실제 이용, 결제를 따라가는 것이다.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginTop: 14 }}>
                {joinSnapshot.map((item) => (
                  <div key={item.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fbfdfc", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 21, color: "#111827", fontWeight: 950, lineHeight: 1.2 }}>{item.value}</div>
                    <div style={{ marginTop: 5, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{item.note}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 14 }}>
                {realVisitInsights.map((item) => (
                  <div key={item.title} style={{ border: "1px solid #d9e2dd", borderRadius: 8, padding: 13, background: "#ffffff" }}>
                    <strong style={{ display: "block", color: "#111827", fontSize: 14, marginBottom: 6 }}>{item.title}</strong>
                    <p style={{ margin: 0, color: "#52605c", fontSize: 13, lineHeight: 1.65 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <Eyebrow>인사이트 기준선</Eyebrow>
              <h2 style={sectionTitleStyle}>마케팅팀에는 “가능한 연결”과 “검증된 연결”을 분리해서 보여준다.</h2>
              <KpiLine label="운영 제출 중 Meta 비중" value={`${fmtNum(metaForms)} / ${fmtNum(operationalForms)} (${fmtPct(metaFormShare)})`} />
              <KpiLine label="주요 랜딩" value={`${primaryLanding} · ${fmtNum(primaryLandingCount)}건`} />
              <KpiLine label="읽기 API 최신 원장" value={formatKst(live.adCrmAttribution?.freshness?.latestLedgerAt ?? null)} />
              <KpiLine label="운영 제출 Hash 커버리지" value={joinSummary ? fmtPct(joinSummary.phoneHashCoverageRate) : "확인 중"} />
              <KpiLine label="Hash→고객 매칭" value={joinSummary ? `${fmtNum(joinSummary.matchedCustomers)}명` : "확인 중"} />
              <KpiLine label="폼→방문 상한" value={fmtPct(firstVisitUpperBound)} />
              <KpiLine label="폼→결제 상한" value={fmtPct(payerUpperBound)} />
              <KpiLine label="현재 신뢰도" value="방문/결제 캠페인 조인 전: 중간 이하" />
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.65 }}>
                결론: 지금도 “Meta가 폼 제출을 만들고 있다”는 인사이트는 제시할 수 있다.
                “어떤 캠페인이 실제 방문과 매출을 만들었다”는 결론은 phone hash 조인 API를 붙인 뒤에 제시한다.
              </div>
            </Panel>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <Eyebrow>AIBIO 백엔드에서 확인한 방문 테이블</Eyebrow>
              <h2 style={sectionTitleStyle}>실제 방문은 하나의 숫자가 아니라 단계별로 나눠야 한다.</h2>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {visitJoinFindings.map((item) => (
                  <div key={item.title} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 13, background: "#fbfdfc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <strong style={{ color: "#111827", fontSize: 14 }}>{item.title}</strong>
                      <span style={{ color: item.status === "가능" ? "#166534" : "#92400e", background: item.status === "가능" ? "#dcfce7" : "#fffbeb", border: "1px solid #d9e2dd", borderRadius: 8, padding: "3px 7px", fontSize: 12, fontWeight: 900 }}>
                        {item.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "#52605c", fontSize: 13, lineHeight: 1.65 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <Eyebrow>구현하면 나오는 화면</Eyebrow>
              <h2 style={sectionTitleStyle}>캠페인별로 “방문당 비용”과 “결제 고객당 비용”을 보여줄 수 있다.</h2>
              <div style={{ marginTop: 14, display: "grid", gap: 9 }}>
                {backendJoinPlan.map((item, index) => (
                  <div key={item} style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 9, alignItems: "flex-start" }}>
                    <span style={{
                      width: 24,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      color: "#fff",
                      background: "#172027",
                      fontSize: 12,
                      fontWeight: 950,
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ color: "#374151", fontSize: 13, lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
              {joinCampaigns.length > 0 ? (
                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  {joinCampaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.campaign} style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff", padding: 11 }}>
                      <strong style={{ display: "block", color: "#111827", fontSize: 13, lineHeight: 1.45, marginBottom: 6 }}>{campaign.campaign}</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, color: "#52605c", fontSize: 12 }}>
                        <span>폼 {fmtNum(campaign.forms)}</span>
                        <span>Hash {fmtNum(campaign.withPhoneHash)}</span>
                        <span>고객 {fmtNum(campaign.matchedCustomers)}</span>
                        <span>매출 {fmtKRW(campaign.grossRevenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: 13, lineHeight: 1.65, fontWeight: 700 }}>
                이 작업은 DB 스키마 변경 없이 읽기 전용 API로 시작할 수 있다. 운영 DB 쓰기나 스키마 변경은 별도 승인 후 진행한다.
              </div>
            </Panel>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Panel>
              <Eyebrow>폼 제출 Lead 판정</Eyebrow>
              <h2 style={sectionTitleStyle}>이제 폼 제출은 Meta에서 Lead로 잡을 수 있다.</h2>
              <p style={bodyStyle}>
                2026-04-25 테스트에서 일반 제출은 Meta Pixel Lead로 보였고, 테스트 연락처는 내부 원장에만 남도록 분리됐다.
                즉 운영 리드는 Meta 학습 신호로 보내고, 디버그 제출은 학습을 오염시키지 않는다.
              </p>
              <KpiLine label="최근 내부 유입 상위 채널" value={topChannel} />
              <KpiLine label="최신 폼 제출" value={formatKst(latestFormAt)} />
              <KpiLine label="현재 정책" value="운영 제출만 Lead, 테스트는 aibio_form_submit_test" />
            </Panel>

            <Panel>
              <Eyebrow>채널톡 활용 기준</Eyebrow>
              <h2 style={sectionTitleStyle}>채널톡 클릭자는 “관심자”로 참조하되, 아직 “리드”로 최적화하지 않는다.</h2>
              <p style={bodyStyle}>
                채널톡은 문의 의도 신호라서 리타겟팅 가치가 높다. 하지만 표본 4건으로 Meta 최적화 목표를 바꾸면
                알고리즘이 배울 데이터가 부족하다. 30일 오디언스로 묶고, 폼 제출자와 교차해 품질을 본다.
              </p>
              <KpiLine label="맞춤 전환" value="AIBIO - ChannelTalk Open" />
              <KpiLine label="사용처" value="30일 리타겟팅, 상담 의도 점수" />
              <KpiLine label="CAPI 우선순위" value="Lead와 방문/결제 이후에 보강" />
            </Panel>

            <Panel>
              <Eyebrow>예산 게이트</Eyebrow>
              <h2 style={sectionTitleStyle}>증액은 Lead 수가 아니라 CRM 품질로 한다.</h2>
              <p style={bodyStyle}>
                이벤트2 소재가 당장 CPL은 가장 좋다. 다만 좋은 리드인지 확인 전 대폭 증액하면 허수 리드만 늘 수 있다.
                방문예약률과 결제율이 붙는 순간부터 예산 판단은 훨씬 명확해진다.
              </p>
              <KpiLine label="1차 게이트" value="Lead CPL이 기준 이하" />
              <KpiLine label="2차 게이트" value="상담 연결률, 방문예약률" />
              <KpiLine label="3차 게이트" value="방문당 비용, 결제당 비용, 30일 LTV" />
            </Panel>
          </section>

          <Panel>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <Eyebrow>앞으로의 계획</Eyebrow>
                <h2 style={sectionTitleStyle}>AIBIO 광고 운영은 “폼 제출 최적화”에서 “방문·결제 최적화”로 올라간다.</h2>
              </div>
              <Link href="/tracking-integrity" style={{ color: "#0f766e", fontSize: 13, fontWeight: 900, textDecoration: "none" }}>
                추적 정합성 문서형 대시보드 →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {futureRoadmap.map((item) => (
                <div key={item.phase} style={{ border: "1px solid #d9e2dd", borderRadius: 8, background: "#fbfdfc", padding: 14 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{
                      width: 26,
                      height: 26,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      background: "#172027",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 950,
                    }}>
                      {item.phase}
                    </span>
                    <strong style={{ color: "#111827", fontSize: 14 }}>{item.title}</strong>
                  </div>
                  <p style={{ margin: 0, color: "#52605c", fontSize: 13, lineHeight: 1.65 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </Panel>

          <section style={{ marginTop: 18 }}>
            <Panel>
              <Eyebrow>숫자 기준</Eyebrow>
              <h2 style={sectionTitleStyle}>숫자는 출처와 기준 시각을 같이 본다.</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10, marginTop: 14 }}>
                {sourceNotes.map((source) => (
                  <div key={source.label} style={{ border: "1px solid #e5e7eb", background: "#ffffff", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f766e", marginBottom: 4 }}>{source.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 6 }}>{source.value}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: "#6b7280" }}>{source.note}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </main>
    </>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section style={{
      background: "#ffffff",
      border: "1px solid #d9e2dd",
      borderRadius: 8,
      boxShadow: "0 1px 12px rgba(17,24,39,0.05)",
      padding: 18,
      minWidth: 0,
    }}>
      {children}
    </section>
  );
}

function MetricCard({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <div style={{
      border: "1px solid #d9e2dd",
      borderRadius: 8,
      background: "#ffffff",
      padding: 14,
      boxShadow: "0 1px 8px rgba(17,24,39,0.04)",
      minHeight: 118,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div style={{ width: 32, height: 4, borderRadius: 999, background: accent, marginBottom: 10 }} />
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 5 }}>{label}</div>
        <div style={{ fontSize: 24, color: "#111827", fontWeight: 950, lineHeight: 1.2 }}>{value}</div>
      </div>
      <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>{note}</div>
    </div>
  );
}

function DecisionCard({
  label,
  title,
  body,
  action,
  accent,
}: {
  label: string;
  title: string;
  body: string;
  action: string;
  accent: string;
}) {
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 14,
      background: "#fbfdfc",
      minHeight: 240,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div>
        <span style={{
          display: "inline-flex",
          color: accent,
          background: "#ffffff",
          border: `1px solid ${accent}33`,
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: 950,
          marginBottom: 10,
        }}>
          {label}
        </span>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#111827", lineHeight: 1.45 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#52605c", lineHeight: 1.65 }}>{body}</p>
      </div>
      <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid #e5e7eb",
        color: "#111827",
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.6,
      }}>
        {action}
      </div>
    </div>
  );
}

function CampaignBar({
  label,
  spend,
  clicks,
  landingViews,
  leads,
  maxSpend,
  accent,
  note,
}: {
  label: string;
  spend: number;
  clicks: number;
  landingViews: number;
  leads: number;
  maxSpend: number;
  accent: string;
  note: string;
}) {
  const width = maxSpend > 0 ? Math.max(8, Math.round((spend / maxSpend) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
        <span>{label}</span>
        <span>{fmtKRW(spend)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#eef2ef", overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${width}%`, background: accent, borderRadius: 999 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 12, color: "#52605c" }}>
        <span>클릭 {fmtNum(clicks)}</span>
        <span>랜딩 {fmtNum(landingViews)}</span>
        <span>Lead {fmtNum(leads)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "#6b7280" }}>{note}</div>
    </div>
  );
}

function FlowStep({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10 }}>
      <span style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "#ecfdf5",
        border: "1px solid #a7f3d0",
        color: "#0f766e",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 950,
      }}>
        {index}
      </span>
      <div>
        <strong style={{ display: "block", fontSize: 14, color: "#111827", marginBottom: 3 }}>{title}</strong>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "#52605c" }}>{children}</p>
      </div>
    </div>
  );
}

function PipelineRow({ left, right }: { left: string; right: string }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "112px 1fr",
      gap: 10,
      alignItems: "center",
      padding: "10px 12px",
      borderRadius: 8,
      background: "#fbfdfc",
      border: "1px solid #e5e7eb",
    }}>
      <strong style={{ color: "#111827", fontSize: 13 }}>{left}</strong>
      <span style={{ color: "#52605c", fontSize: 13, lineHeight: 1.5 }}>{right}</span>
    </div>
  );
}

function KpiLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid #e5e7eb" }}>
      <span style={{ color: "#6b7280", fontSize: 13 }}>{label}</span>
      <strong style={{ color: "#111827", fontSize: 13, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{
      color: "#0f766e",
      fontSize: 12,
      fontWeight: 950,
      marginBottom: 6,
      letterSpacing: 0,
    }}>
      {children}
    </div>
  );
}

const sectionTitleStyle = {
  margin: 0,
  color: "#111827",
  fontSize: 20,
  lineHeight: 1.42,
  letterSpacing: 0,
  fontWeight: 950,
};

const bodyStyle = {
  margin: "10px 0 14px",
  color: "#52605c",
  fontSize: 14,
  lineHeight: 1.7,
};
