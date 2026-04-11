"use client";

/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { useCrmPhase1Data } from "@/hooks/useCrmPhase1Data";
import { useCrmLocalData } from "@/hooks/useCrmLocalData";

import styles from "./page.module.css";
import MessagingTab from "./MessagingTab";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type CandidateItem = {
  normalizedPhone: string;
  customerName: string;
  customerContact: string;
  manager: string;
  analysisType: string;
  consultationDate: string;
  rawStatus: string;
  statusGroup: string;
  postConsultOrderCount: number;
  hasSupplementOrder: boolean;
  lastOrderDate: string | null;
  lastOrderProduct: string | null;
  hasLtr: boolean;
  recommendedAction: string;
};

type CandidatesResponse = {
  ok: boolean;
  scenario: string;
  range: { startDate: string; endDate: string };
  windowDays: number;
  count: number;
  items: CandidateItem[];
};

const SITES = [
  { value: "all", label: "전체", count: "83,017", sub: "3사이트 합산" },
  { value: "biocom", label: "바이오컴", count: "69,681", sub: "검사키트·영양제" },
  { value: "thecleancoffee", label: "더클린커피", count: "13,236", sub: "스페셜티 커피" },
  { value: "aibio", label: "AIBIO", count: "100", sub: "리커버리랩" },
] as const;

type SiteValue = (typeof SITES)[number]["value"];

const SITE_KPI: Record<SiteValue, { label: string; value: string; sub?: string }[]> = {
  all: [
    { label: "총 회원", value: "83,017명", sub: "3사이트 합산" },
    { label: "SMS 동의", value: "47.5%", sub: "39,440명 동의" },
    { label: "상담 완료", value: "8,305건", sub: "전체 기간" },
    { label: "Meta 광고비", value: "₩148만/월", sub: "AIBIO만 집행 중" },
  ],
  biocom: [
    { label: "회원 수", value: "69,681명", sub: "전체의 83.9%" },
    { label: "SMS 동의", value: "47.5%", sub: "검사 구매 고객 중심" },
    { label: "상담 건수", value: "8,305건", sub: "상담사 가치 분석 대상" },
    { label: "Toss 연동", value: "live", sub: "MID: iw_biocomo8tx" },
  ],
  thecleancoffee: [
    { label: "회원 수", value: "13,236명", sub: "전체 83,017명 중 더클린커피 비율" },
    { label: "Live Row", value: "3건", sub: "결제 완료 시 UTM·GA4 정보를 기록한 귀속 원장 행 수" },
    { label: "UTM 추적", value: "활성", sub: "아임웹 푸터 코드 설치" },
    { label: "Meta 광고", value: "집행 중", sub: "A+SC 캠페인 2개 운영 중" },
  ],
  aibio: [
    { label: "회원 수", value: "100명", sub: "성장 초기" },
    { label: "Meta 노출", value: "48만회/월", sub: "30일 기준" },
    { label: "Meta 비용", value: "₩148만/월", sub: "CPC ₩84" },
    { label: "전환율", value: "0.006%", sub: "개선 필요" },
  ],
};

type TabItem = { value: string; label: string; desc: string };

const ALL_TABS: Record<string, TabItem> = {
  consultation: { value: "consultation", label: "상담 후속", desc: "상담 완료/부재 후 바로 액션할 대상을 본다" },
  experiments: { value: "experiments", label: "실험 운영", desc: "실험 생성/배정/전환 결과를 본다" },
  messaging: { value: "messaging", label: "알림톡 발송", desc: "알리고 알림톡 대상 선택 · 템플릿 · 발송" },
  attribution: { value: "attribution", label: "결제 추적", desc: "어디서 유입되어 결제했는지 추적하고 토스 승인과 대조한다" },
  ads: { value: "ads", label: "광고 성과", desc: "Meta 광고 노출/클릭/비용을 확인하고 캠페인별 성과를 본다" },
  leads: { value: "leads", label: "리드 관리", desc: "광고로 유입된 잠재 고객의 전환 현황을 본다" },
  orders: { value: "orders", label: "구매 현황", desc: "최근 주문과 매출 추이를 확인한다" },
  repurchase: { value: "repurchase", label: "재구매 관리", desc: "첫 구매 후 재구매하지 않은 고객을 찾아 관리한다" },
  groups: { value: "groups", label: "고객 그룹", desc: "발송 대상 그룹을 관리하고 메시지 이력을 확인한다" },
  comparison: { value: "comparison", label: "사이트 비교", desc: "3사이트의 핵심 지표를 나란히 비교한다" },
};

const SITE_TABS: Record<SiteValue, TabItem[]> = {
  all: [ALL_TABS.comparison!, ALL_TABS.experiments!, ALL_TABS.messaging!, ALL_TABS.attribution!],
  biocom: [ALL_TABS.consultation!, ALL_TABS.experiments!, ALL_TABS.messaging!, ALL_TABS.attribution!],
  thecleancoffee: [ALL_TABS.orders!, ALL_TABS.repurchase!, ALL_TABS.groups!, ALL_TABS.messaging!, ALL_TABS.attribution!],
  aibio: [ALL_TABS.ads!, ALL_TABS.leads!, ALL_TABS.messaging!, ALL_TABS.attribution!],
};

// 하위 호환: 기존 TABS 상수 유지 (타입 참조용)
const TABS = [
  ALL_TABS.consultation!,
  ALL_TABS.experiments!,
  ALL_TABS.messaging!,
  ALL_TABS.attribution!,
] as const;

const SCENARIOS = [
  {
    value: "completed_followup",
    label: "상담 완료 → 미구매 후속",
    desc: "상담은 완료했지만 아직 주문이 없는 고객",
  },
  {
    value: "reschedule_recall",
    label: "부재/변경 → 재연락 대상",
    desc: "부재 또는 일정 변경으로 상담이 완료되지 않은 고객",
  },
] as const;

const ACTION_LABELS: Record<string, { label: string; color: string; channel?: string }> = {
  order_conversion_nudge: { label: "구매 유도", color: "var(--color-primary)", channel: "알림톡" },
  supplement_recommendation: { label: "영양제 추천", color: "var(--color-success)", channel: "알림톡" },
  reschedule_recall: { label: "재연락", color: "var(--color-accent)", channel: "전화 우선" },
  follow_up_check: { label: "후속 확인", color: "var(--color-info)", channel: "채널톡" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: "완료", color: "#059669" },
  no_answer: { label: "부재", color: "#d97706" },
  rescheduled: { label: "변경/재연락", color: "#6366f1" },
  canceled: { label: "취소/보류", color: "#dc2626" },
  other: { label: "기타", color: "#64748b" },
  unknown: { label: "미정", color: "#94a3b8" },
};

const fmtDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
};

const fmtNum = (value: number | null | undefined) => (value ?? 0).toLocaleString("ko-KR");
const fmtKRW = (value: number | null | undefined) => `₩${fmtNum(Math.round(value ?? 0))}`;
const fmtPct = (value: number | null | undefined) => `${(value ?? 0).toFixed(1)}%`;
const fmtRatio = (value: number | null | undefined) =>
  `${(((value ?? 0) as number) * 100).toFixed(1)}%`;

const extractTableRows = (payload: unknown): Record<string, unknown>[] | null => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (Array.isArray((payload as { data?: unknown })?.data)) {
    return (payload as { data: Record<string, unknown>[] }).data;
  }
  if (Array.isArray((payload as { data?: { items?: unknown } })?.data?.items)) {
    return (payload as { data: { items: Record<string, unknown>[] } }).data.items;
  }
  if (Array.isArray((payload as { items?: unknown })?.items)) {
    return (payload as { items: Record<string, unknown>[] }).items;
  }
  if (Array.isArray((payload as { managers?: unknown })?.managers)) {
    return (payload as { managers: Record<string, unknown>[] }).managers;
  }
  if (Array.isArray((payload as { matches?: unknown })?.matches)) {
    return (payload as { matches: Record<string, unknown>[] }).matches;
  }
  return null;
};

const extractOrderMatchRows = (payload: unknown): Record<string, unknown>[] | null => {
  const tableRows = extractTableRows(payload);
  if (tableRows) return tableRows;

  const totals = (payload as { totals?: Record<string, unknown> })?.totals;
  if (!totals || Array.isArray(totals)) return null;

  return [
    {
      consultDistinctContacts: totals.consultDistinctContacts ?? 0,
      iamwebDistinctCustomers: totals.iamwebDistinctCustomers ?? 0,
      ltrDistinctCustomers: totals.ltrDistinctCustomers ?? 0,
      consultToOrderOverlap: totals.consultToOrderOverlap ?? 0,
      consultToLtrOverlap: totals.consultToLtrOverlap ?? 0,
      orderMatchRate: fmtRatio(Number(totals.orderMatchRate ?? 0)),
      ltrMatchRate: fmtRatio(Number(totals.ltrMatchRate ?? 0)),
    },
  ];
};

function SummaryCard(props: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "success";
}) {
  return (
    <div className={`${styles.summaryCard} ${props.tone ? styles[`summaryCard${props.tone[0]!.toUpperCase()}${props.tone.slice(1)}`] : ""}`}>
      <span className={styles.summaryLabel}>{props.label}</span>
      <strong className={styles.summaryValue}>{props.value}</strong>
      {props.sub ? <span className={styles.summarySub}>{props.sub}</span> : null}
    </div>
  );
}

function CrmPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const validSites = SITES.map((s) => s.value);
  const siteParam = searchParams.get("site") ?? "all";
  const site: SiteValue = validSites.includes(siteParam as SiteValue)
    ? (siteParam as SiteValue)
    : "all";

  const currentTabs = SITE_TABS[site];
  const validTabValues = currentTabs.map((t) => t.value);
  const tabParam = searchParams.get("tab") ?? currentTabs[0]!.value;
  const tab = validTabValues.includes(tabParam) ? tabParam : currentTabs[0]!.value;

  const setTab = useCallback((newTab: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (extra) { for (const [k, v] of Object.entries(extra)) params.set(k, v); }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setSite = useCallback((newSite: SiteValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("site", newSite);
    // 사이트 변경 시 해당 사이트의 첫 번째 탭으로 자동 전환
    const newTabs = SITE_TABS[newSite];
    const currentTab = params.get("tab");
    if (!currentTab || !newTabs.some((t) => t.value === currentTab)) {
      params.set("tab", newTabs[0]!.value);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);
  const [scenario, setScenario] = useState<string>("completed_followup");
  const [limit, setLimit] = useState(20);

  // 실험 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    experiment_key: "",
    name: "",
    hypothesis: "",
    channel: "channeltalk",
    conversion_window_days: 7,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [candidateData, setCandidateData] = useState<CandidatesResponse | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // 상담사별 요약 (consultation/managers)
  const [managersData, setManagersData] = useState<Record<string, unknown>[] | null>(null);
  const [managersError, setManagersError] = useState<string | null>(null);
  const [managersLoading, setManagersLoading] = useState(true);

  // 주문 매칭 현황 (consultation/order-match)
  const [orderMatchData, setOrderMatchData] = useState<Record<string, unknown>[] | null>(null);
  const [orderMatchError, setOrderMatchError] = useState<string | null>(null);
  const [orderMatchLoading, setOrderMatchLoading] = useState(true);

  // 상담 현황 요약 (callprice overview)
  const [consultSummary, setConsultSummary] = useState<{
    completed_consultations: number;
    unique_completed_customers: number;
    matched_order_customers: number;
    matured_customers: number;
    converted_customers: number;
    conversion_rate: number;
    avg_revenue_per_customer: number;
    baseline_avg_revenue_per_customer: number;
    estimated_incremental_revenue: number;
    estimated_value_per_consultation: number;
  } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(
      `${API_BASE}/api/callprice/overview?maturity_days=90&start_date=2025-04-01&end_date=2026-03-27`,
      { signal: ac.signal },
    )
      .then((r) => r.json())
      .then((d) => { if (d?.data?.summary) setConsultSummary(d.data.summary); })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // 상담사별 요약 fetch
  useEffect(() => {
    const ac = new AbortController();
    setManagersLoading(true);
    setManagersError(null);
    fetch(
      `${API_BASE}/api/consultation/managers?start_date=2025-04-01&end_date=2026-03-27`,
      { signal: ac.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`API 오류 (${r.status})`);
        return r.json();
      })
      .then((d) => {
        setManagersData(extractTableRows(d));
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setManagersError(err instanceof Error ? err.message : "상담사 데이터를 불러올 수 없습니다");
      })
      .finally(() => {
        if (!ac.signal.aborted) setManagersLoading(false);
      });
    return () => ac.abort();
  }, []);

  // 주문 매칭 현황 fetch
  useEffect(() => {
    const ac = new AbortController();
    setOrderMatchLoading(true);
    setOrderMatchError(null);
    fetch(
      `${API_BASE}/api/consultation/order-match?start_date=2025-04-01&end_date=2026-03-27`,
      { signal: ac.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`API 오류 (${r.status})`);
        return r.json();
      })
      .then((d) => {
        setOrderMatchData(extractOrderMatchRows(d));
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setOrderMatchError(err instanceof Error ? err.message : "주문 매칭 데이터를 불러올 수 없습니다");
      })
      .finally(() => {
        if (!ac.signal.aborted) setOrderMatchLoading(false);
      });
    return () => ac.abort();
  }, []);

  const [selectedExperimentKey, setSelectedExperimentKey] = useState<string | null>(null);
  const [experimentViewMode, setExperimentViewMode] = useState<"ops" | "results">("ops");

  const {
    data: phase1Data,
    loading: phase1Loading,
    error: phase1Error,
    reload: reloadPhase1,
  } = useCrmPhase1Data({
    experimentKey: selectedExperimentKey,
  });

  // 로컬 SQLite 실험 데이터
  const {
    data: localData,
    loading: localLoading,
    error: localError,
    reload: reloadLocal,
  } = useCrmLocalData(selectedExperimentKey);

  useEffect(() => {
    if (!selectedExperimentKey && localData?.experiments.length) {
      setSelectedExperimentKey(localData.experiments[0].experiment_key);
    }
  }, [localData, selectedExperimentKey]);

  const handleCreateExperiment = async () => {
    if (!createForm.experiment_key.trim() || !createForm.name.trim()) {
      setCreateError("실험 키와 이름은 필수입니다");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `생성 실패 (${res.status})`);
      }
      const payload = await res.json().catch(() => ({}));
      setShowCreateForm(false);
      setCreateForm({ experiment_key: "", name: "", hypothesis: "", channel: "channeltalk", conversion_window_days: 7 });
      if (payload?.experiment?.experiment_key) {
        setSelectedExperimentKey(payload.experiment.experiment_key);
      }
      reloadLocal();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "실험 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const handleSyncConversions = async (experimentKey: string) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/experiments/${encodeURIComponent(experimentKey)}/sync-conversions`, { method: "POST" });
      const d = await res.json();
      setSyncResult(`동기화 완료: ${d.synced}건 매칭 (주문 ${d.totalOrders}건 / 배정 ${d.assignedCustomers}명)`);
      reloadLocal();
    } catch (err) {
      setSyncResult(`동기화 실패: ${err instanceof Error ? err.message : "오류"}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadCandidates = useCallback(
    async (signal: AbortSignal) => {
      setCandidateLoading(true);
      setCandidateError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/consultation/candidates?scenario=${scenario}&limit=${limit}`,
          { signal },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `API 오류 (${res.status})`);
        }
        setCandidateData(await res.json());
      } catch (err) {
        if (signal.aborted) return;
        setCandidateError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      } finally {
        if (!signal.aborted) setCandidateLoading(false);
      }
    },
    [limit, scenario],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCandidates(controller.signal);
    return () => controller.abort();
  }, [loadCandidates]);

  const currentScenario = useMemo(
    () => SCENARIOS.find((item) => item.value === scenario),
    [scenario],
  );

  const selectedExperiment = phase1Data?.p1s1.selectedExperimentResults;
  const selectedAssignments = phase1Data?.p1s1.selectedAssignments;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>
              ← 대시보드로 돌아가기
            </Link>
            <h1 className={styles.headerTitle}>CRM 관리 허브</h1>
            <p className={styles.headerSub}>
              상담 후속 액션, 실험 장부, 결제 추적 진단을 한 화면에서 보는 관제실
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span>{SITES.find((s) => s.value === site)?.label ?? "전체"} · {SITES.find((s) => s.value === site)?.sub ?? ""}</span>
            <span>로컬 검증 모드</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 솔루션 필터 바 */}
        <section className={styles.section}>
          <div className={styles.siteSelector}>
            {SITES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`${styles.siteButton} ${site === s.value ? styles.siteButtonActive : ""}`}
                onClick={() => setSite(s.value)}
              >
                <span className={styles.siteButtonName}>{s.label}</span>
                <span className={styles.siteButtonCount}>{s.count}명</span>
              </button>
            ))}
          </div>

          {/* 사이트별 KPI 카드 */}
          <div className={styles.siteKpiGrid} style={{ marginTop: 14 }}>
            {SITE_KPI[site].map((kpi) => (
              <div key={kpi.label} className={styles.siteKpiCard}>
                <span className={styles.siteKpiLabel}>{kpi.label}</span>
                <span className={styles.siteKpiValue}>{kpi.value}</span>
                {kpi.sub && <span className={styles.siteKpiSub}>{kpi.sub}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* 기능 탭 — 사이트별로 다른 탭 표시 */}
        <section className={styles.section}>
          <div className={styles.tabSelector}>
            {currentTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${styles.tabButton} ${tab === item.value ? styles.tabButtonActive : ""}`}
                onClick={() => setTab(item.value)}
              >
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {tab === "consultation" ? (
          <>
            {/* 오늘 할 일 카드 */}
            {candidateData && candidateData.items.length > 0 && (
              <div style={{
                padding: "12px 18px", borderRadius: 10, marginBottom: 14,
                background: "#eff6ff", border: "1px solid #bfdbfe",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af" }}>
                    오늘 후속 연락 대상: {candidateData.items.length}명
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#3b82f6", marginLeft: 8 }}>
                    시나리오: {scenario === "completed_followup" ? "상담 완료 → 미구매" : "부재/변경 → 재연락"}
                  </span>
                </div>
              </div>
            )}
            {/* 상담 현황 KPI 카드 */}
            {consultSummary && (
              <div className={styles.summaryGrid}>
                <SummaryCard
                  label="완료 상담"
                  value={fmtNum(consultSummary.completed_consultations) + "건"}
                  sub={`고유 고객 ${fmtNum(consultSummary.unique_completed_customers)}명`}
                />
                <SummaryCard
                  label="90일 전환율"
                  value={fmtRatio(consultSummary.conversion_rate)}
                  sub={`전환 ${fmtNum(consultSummary.converted_customers)}명 / 성숙 ${fmtNum(consultSummary.matured_customers)}명`}
                  tone="success"
                />
                <SummaryCard
                  label="상담 효과 추정 매출"
                  value={fmtKRW(consultSummary.estimated_incremental_revenue)}
                  sub={`상담 고객 ${fmtKRW(consultSummary.avg_revenue_per_customer)}/명 vs 미상담 ${fmtKRW(consultSummary.baseline_avg_revenue_per_customer)}/명`}
                />
                <SummaryCard
                  label="상담 1건당 가치"
                  value={fmtKRW(consultSummary.estimated_value_per_consultation)}
                  sub="주문 매칭 고객 기준 추정치"
                />
              </div>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>후속 관리 대상</h2>
                  <p className={styles.sectionDesc}>
                    지금 바로 메시지나 재연락 액션을 할 고객 후보를 본다.
                  </p>
                </div>
              </div>

              <div className={styles.scenarioSelector}>
                {SCENARIOS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`${styles.scenarioBtn} ${scenario === item.value ? styles.scenarioBtnActive : ""}`}
                    onClick={() => setScenario(item.value)}
                  >
                    <strong>{item.label}</strong>
                    <span className={styles.scenarioBtnDesc}>{item.desc}</span>
                  </button>
                ))}
              </div>

              <div className={styles.controlsBar}>
                <div className={styles.controlGroup}>
                  <label className={styles.controlLabel}>표시 건수</label>
                  <select
                    className={styles.controlSelect}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    {[10, 20, 50, 100].map((count) => (
                      <option key={count} value={count}>
                        {count}건
                      </option>
                    ))}
                  </select>
                </div>
                {candidateData ? (
                  <div className={styles.resultInfo}>
                    조회 기간 {fmtDate(candidateData.range.startDate)} ~ {fmtDate(candidateData.range.endDate)}
                    {" · "}윈도우 {candidateData.windowDays}일
                    {" · "}총 {fmtNum(candidateData.count)}명
                  </div>
                ) : null}
              </div>

              {candidateError ? (
                <div className={styles.errorBox}>
                  <strong>오류</strong>
                  <p>{candidateError}</p>
                </div>
              ) : null}

              {candidateLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>후속 관리 대상을 불러오는 중...</p>
                </div>
              ) : null}

              {!candidateLoading && candidateData ? (
                candidateData.items.length === 0 ? (
                  <div className={styles.empty}>해당 조건의 대상 고객이 없습니다.</div>
                ) : (
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHead}>
                          <th>고객명</th>
                          <th>연락처</th>
                          <th>상담사</th>
                          <th>검사 유형</th>
                          <th>상담일</th>
                          <th>상태</th>
                          <th className={styles.tableCellRight}>상담 후 주문</th>
                          <th>영양제 구매</th>
                          <th>마지막 주문</th>
                          <th>추천 액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidateData.items.map((item) => {
                          const action =
                            ACTION_LABELS[item.recommendedAction] ?? {
                              label: item.recommendedAction,
                              color: "var(--color-text-muted)",
                            };

                          return (
                            <tr key={item.normalizedPhone} className={styles.tableRow}>
                              <td>
                                <strong>{item.customerName}</strong>
                              </td>
                              <td className={styles.phone}>{item.customerContact}</td>
                              <td>{item.manager}</td>
                              <td>{item.analysisType}</td>
                              <td>{fmtDate(item.consultationDate)}</td>
                              <td>
                                <span
                                  className={`${styles.statusBadge} ${
                                    item.statusGroup === "completed"
                                      ? styles.statusCompleted
                                      : item.statusGroup === "no_answer"
                                        ? styles.statusNoAnswer
                                        : styles.statusOther
                                  }`}
                                >
                                  {STATUS_LABELS[item.statusGroup]?.label ?? item.rawStatus}
                                </span>
                              </td>
                              <td className={styles.tableCellRight}>{item.postConsultOrderCount}건</td>
                              <td>{item.hasSupplementOrder ? "O" : "-"}</td>
                              <td>{item.lastOrderDate ? fmtDate(item.lastOrderDate) : "-"}</td>
                              <td>
                                <span
                                  className={styles.actionBadge}
                                  style={{ borderColor: action.color, color: action.color }}
                                >
                                  {action.label}
                                </span>
                                {"channel" in action && action.channel && (
                                  <span style={{
                                    marginLeft: 4, fontSize: "0.6rem", fontWeight: 600,
                                    padding: "1px 4px", borderRadius: 3,
                                    background: action.channel === "전화 우선" ? "#fef3c7" : "#eff6ff",
                                    color: action.channel === "전화 우선" ? "#92400e" : "#3b82f6",
                                  }}>{action.channel}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setTab("messaging", { phone: item.normalizedPhone, name: item.customerName })}
                                  style={{
                                    marginLeft: 6, fontSize: "0.58rem", fontWeight: 600,
                                    padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                                    background: "#6366f1", color: "#fff", border: "none",
                                  }}
                                  title={`${item.customerContact}에게 알림톡 보내기`}
                                >
                                  알림톡
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </section>

            {/* 상담사별 요약 섹션 */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>상담사별 요약</h2>
                  <p className={styles.sectionDesc}>
                    상담사별 상담 건수와 전환 현황을 요약한다.
                  </p>
                </div>
              </div>

              {managersLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>상담사 데이터를 불러오는 중...</p>
                </div>
              ) : managersError ? (
                <div className={styles.errorBox}>
                  <strong>오류</strong>
                  <p>상담사 데이터를 불러올 수 없습니다</p>
                  <p style={{ fontSize: "0.76rem", marginTop: 4 }}>{managersError}</p>
                </div>
              ) : !managersData || managersData.length === 0 ? (
                <div className={styles.empty}>상담사 데이터 없음</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        {Object.keys(managersData[0]!).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {managersData.map((row, idx) => (
                        <tr key={idx} className={styles.tableRow}>
                          {Object.values(row).map((val, ci) => (
                            <td key={ci}>{val == null ? "-" : String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 주문 매칭 현황 섹션 */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>주문 매칭 현황</h2>
                  <p className={styles.sectionDesc}>
                    상담 고객과 주문 데이터의 매칭 결과를 확인한다.
                  </p>
                </div>
              </div>

              {orderMatchLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>주문 매칭 데이터를 불러오는 중...</p>
                </div>
              ) : orderMatchError ? (
                <div className={styles.errorBox}>
                  <strong>오류</strong>
                  <p>주문 매칭 데이터를 불러올 수 없습니다</p>
                  <p style={{ fontSize: "0.76rem", marginTop: 4 }}>{orderMatchError}</p>
                </div>
              ) : !orderMatchData || orderMatchData.length === 0 ? (
                <div className={styles.empty}>주문 매칭 데이터 없음</div>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        {Object.keys(orderMatchData[0]!).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderMatchData.map((row, idx) => (
                        <tr key={idx} className={styles.tableRow}>
                          {Object.values(row).map((val, ci) => (
                            <td key={ci}>{val == null ? "-" : String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.interpretBlock}>
              <strong>{currentScenario?.label}</strong>
              <p>
                지금 탭은 사람 손이 바로 가야 하는 고객 리스트다. 실험 장부가 공항의 좌석표라면,
                여기는 오늘 바로 전화를 걸거나 채널톡 메시지를 보내야 하는 탑승 대기줄이다.
              </p>
            </section>
          </>
        ) : null}

        {tab === "experiments" ? (
          <>
            {/* 로컬 검증 모드 배지 + 발송 0건 blocker */}
            {localData && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                  로컬 검증 모드 — 결과 해석 주의
                </span>
                {localData.stats.messages === 0 && (
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    발송 0건 — 실험이 아직 실행되지 않았거나 메시지 로그가 연결되지 않음
                  </span>
                )}
              </div>
            )}

            {/* 운영/결과 모드 토글 */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {([
                { key: "ops" as const, label: "운영 상태" },
                { key: "results" as const, label: "실험 결과" },
              ]).map((m) => (
                <button key={m.key} type="button" onClick={() => setExperimentViewMode(m.key)} style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  border: experimentViewMode === m.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                  background: experimentViewMode === m.key ? "#eef2ff" : "transparent",
                  color: experimentViewMode === m.key ? "#4338ca" : "#64748b",
                }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* 로컬 실험 데이터 (SQLite) */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>실험 운영 (로컬 DB)</h2>
                  <p className={styles.sectionDesc}>
                    로컬 SQLite에 저장된 실험 장부. 운영 DB는 읽기만 하고 실험 데이터는 여기에 관리한다.
                  </p>
                </div>
                <button type="button" className={styles.retryButton} onClick={() => reloadLocal()}>
                  새로고침
                </button>
              </div>

              {localLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>로컬 실험 데이터를 불러오는 중...</p>
                </div>
              ) : null}

              {localError ? (
                <div className={styles.errorBox}>
                  <strong>로컬 실험 오류</strong>
                  <p>{localError}</p>
                </div>
              ) : null}

              {localData ? (
                <>
                  <div className={styles.summaryGrid}>
                    <SummaryCard label="실험 수" value={`${fmtNum(localData.stats.experiments)}개`} sub="로컬 SQLite 기준" />
                    <SummaryCard label="배정" value={`${fmtNum(localData.stats.assignments)}건`} sub="대조군 + 실험군" />
                    <SummaryCard label="전환" value={`${fmtNum(localData.stats.conversions)}건`} sub="구매/환불 기록" tone="success" />
                    <SummaryCard label="발송" value={`${fmtNum(localData.stats.messages)}건`} sub="메시지 로그" />
                  </div>

                  {/* 실험 생성 폼 */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button
                      type="button"
                      className={styles.retryButton}
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      style={{ background: "var(--color-primary)", color: "#fff", border: "none" }}
                    >
                      {showCreateForm ? "취소" : "+ 새 실험 만들기"}
                    </button>
                  </div>

                  {showCreateForm && (
                    <div className={styles.panel} style={{ marginBottom: 18 }}>
                      <h3 className={styles.panelTitle}>새 실험 생성</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        <div className={styles.controlGroup}>
                          <label className={styles.controlLabel}>실험 키 (영문)</label>
                          <input
                            className={styles.controlSelect}
                            placeholder="checkout_abandon_6h"
                            value={createForm.experiment_key}
                            onChange={(e) => setCreateForm({ ...createForm, experiment_key: e.target.value })}
                          />
                        </div>
                        <div className={styles.controlGroup}>
                          <label className={styles.controlLabel}>실험 이름</label>
                          <input
                            className={styles.controlSelect}
                            placeholder="체크아웃 이탈 6시간 리마인드"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                          />
                        </div>
                        <div className={styles.controlGroup}>
                          <label className={styles.controlLabel}>채널</label>
                          <select className={styles.controlSelect} value={createForm.channel} onChange={(e) => setCreateForm({ ...createForm, channel: e.target.value })}>
                            <option value="channeltalk">채널톡</option>
                            <option value="aligo">알리고 알림톡</option>
                            <option value="manual">수동</option>
                          </select>
                        </div>
                        <div className={styles.controlGroup}>
                          <label className={styles.controlLabel}>전환 윈도우 (일)</label>
                          <input
                            type="number"
                            className={styles.controlSelect}
                            min={1}
                            max={365}
                            value={createForm.conversion_window_days}
                            onChange={(e) => setCreateForm({ ...createForm, conversion_window_days: Number(e.target.value) || 7 })}
                          />
                        </div>
                        <div className={styles.controlGroup} style={{ gridColumn: "1 / -1" }}>
                          <label className={styles.controlLabel}>가설</label>
                          <input
                            className={styles.controlSelect}
                            placeholder="체크아웃 이탈 후 6시간 이내 리마인드가 24시간보다 전환율이 높을 것"
                            value={createForm.hypothesis}
                            onChange={(e) => setCreateForm({ ...createForm, hypothesis: e.target.value })}
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>
                      {createError && <p style={{ color: "var(--color-danger)", fontSize: "0.8rem", marginTop: 8 }}>{createError}</p>}
                      <button
                        type="button"
                        className={styles.retryButton}
                        style={{ marginTop: 12, background: "var(--color-primary)", color: "#fff", border: "none" }}
                        onClick={handleCreateExperiment}
                        disabled={creating}
                      >
                        {creating ? "생성 중..." : "실험 생성"}
                      </button>
                    </div>
                  )}

                  {localData.experiments.length === 0 && !showCreateForm ? (
                    <div className={styles.empty}>
                      아직 생성된 실험이 없습니다. 위의 &quot;+ 새 실험 만들기&quot; 버튼으로 시작하세요.
                    </div>
                  ) : localData.experiments.length > 0 ? (
                    <div className={styles.experimentList}>
                      {localData.experiments.map((exp) => (
                        <button
                          key={exp.experiment_key}
                          type="button"
                          className={`${styles.experimentCard} ${selectedExperimentKey === exp.experiment_key ? styles.experimentCardActive : ""}`}
                          onClick={() => setSelectedExperimentKey(exp.experiment_key)}
                        >
                          <span className={styles.experimentStatus}>{exp.status}</span>
                          <strong>{exp.name}</strong>
                          <span>{exp.experiment_key} · {exp.channel}</span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 3, background: "#eff6ff", color: "#3b82f6" }}>
                              배정 {exp.assignmentCount ?? "?"}
                            </span>
                            <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 3, background: "#f0fdf4", color: "#16a34a" }}>
                              전환 {exp.conversionCount ?? "?"}
                            </span>
                            <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 3, background: exp.messageCount ? "#f0fdf4" : "#fef2f2", color: exp.messageCount ? "#16a34a" : "#dc2626" }}>
                              발송 {exp.messageCount ?? 0}
                            </span>
                            {exp.lastSyncAt && (
                              <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: 3, background: "#f8fafc", color: "#94a3b8" }}>
                                동기화 {exp.lastSyncAt.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* 전환 동기화 버튼 */}
                  {localData.selectedExperiment && (
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
                      <button
                        type="button"
                        className={styles.retryButton}
                        onClick={() => handleSyncConversions(localData.selectedExperiment!.experiment_key)}
                        disabled={syncing}
                      >
                        {syncing ? "동기화 중..." : "전환 동기화 (운영DB 주문 매칭)"}
                      </button>
                      {syncResult && <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>{syncResult}</span>}
                    </div>
                  )}

                  {localData.selectedExperiment && localData.results.length > 0 ? (() => {
                    const controlRow = localData.results.find((r) => r.variant_key === "control");
                    const treatmentRow = localData.results.find((r) => r.variant_key !== "control");
                    const hasLift = controlRow && treatmentRow && controlRow.assignment_count > 0 && treatmentRow.assignment_count > 0;
                    const purchaseRateLift = hasLift ? treatmentRow.purchase_rate - controlRow.purchase_rate : null;
                    const revenuePerUserLift = hasLift
                      ? (treatmentRow.net_revenue / treatmentRow.assignment_count) - (controlRow.net_revenue / controlRow.assignment_count)
                      : null;

                    const isVerificationOnly = localData.stats.messages === 0;
                    const minVariantSize = Math.min(...localData.results.map((r) => r.assignment_count));
                    const isSampleInsufficient = minVariantSize < 30;

                    return (
                      <>
                        {/* 경고 배너 */}
                        {isVerificationOnly && (
                          <div style={{
                            padding: "10px 16px", borderRadius: 8, marginTop: 12, marginBottom: -4,
                            background: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(251,191,36,0.06) 10px, rgba(251,191,36,0.06) 20px)",
                            border: "1px solid #fde68a", fontSize: "0.78rem", fontWeight: 600, color: "#92400e",
                          }}>
                            아래 수치는 로컬 검증 데이터입니다. 실제 발송이 0건이므로 운영 성과가 아닌 참고 수치입니다.
                          </div>
                        )}
                        {isSampleInsufficient && !isVerificationOnly && (
                          <div style={{
                            padding: "10px 16px", borderRadius: 8, marginTop: 12, marginBottom: -4,
                            background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.78rem", fontWeight: 600, color: "#92400e",
                          }}>
                            표본 부족 (그룹당 최소 {minVariantSize}명) — 판단하기엔 사람 수가 부족하다
                          </div>
                        )}
                        <div style={isVerificationOnly || experimentViewMode === "ops" ? { opacity: 0.5, pointerEvents: "none" as const, display: experimentViewMode === "ops" ? "none" : undefined } : {}}>
                        {hasLift && (
                          <div className={styles.summaryGrid} style={{ marginTop: 18 }}>
                            <SummaryCard
                              label="구매율 차이"
                              value={`${purchaseRateLift! >= 0 ? "+" : ""}${(purchaseRateLift! * 100).toFixed(2)}%p`}
                              sub={`treatment ${fmtPct(treatmentRow!.purchase_rate)} vs control ${fmtPct(controlRow!.purchase_rate)}`}
                              tone={purchaseRateLift! > 0 ? "success" : "warn"}
                            />
                            <SummaryCard
                              label="인당 순매출 차이"
                              value={`${revenuePerUserLift! >= 0 ? "+" : ""}${fmtKRW(Math.round(revenuePerUserLift!))}`}
                              sub="실험군 - 대조군"
                              tone={revenuePerUserLift! > 0 ? "success" : "warn"}
                            />
                            <SummaryCard
                              label="treatment 순매출"
                              value={fmtKRW(treatmentRow!.net_revenue)}
                              sub={`${fmtNum(treatmentRow!.purchaser_count)}명 구매`}
                            />
                            <SummaryCard
                              label="control 순매출"
                              value={fmtKRW(controlRow!.net_revenue)}
                              sub={`${fmtNum(controlRow!.purchaser_count)}명 구매`}
                            />
                          </div>
                        )}

                        <div className={styles.detailGrid} style={{ marginTop: 18 }}>
                          <div className={styles.panel}>
                            <h3 className={styles.panelTitle}>실험군별 비교 차트</h3>
                            <p className={styles.sectionDesc} style={{ marginBottom: 12 }}>
                              메시지를 받은 그룹과 안 받은 그룹의 매출/구매율을 비교한다. 아직 최종 결론이 아닌 방향 확인용.
                            </p>
                            <div style={{ width: "100%", height: 280 }}>
                              <ResponsiveContainer>
                                <BarChart
                                  data={localData.results.map((row) => {
                                    const alias = localData.selectedExperiment?.variant_aliases?.[row.variant_key];
                                    return {
                                      variant: alias ? `${row.variant_key} (${alias})` : row.variant_key,
                                      netRevenue: Math.round(row.net_revenue),
                                      purchaseRatePct: Number((row.purchase_rate * 100).toFixed(2)),
                                    };
                                  })}
                                  margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="variant" />
                                  <YAxis
                                    yAxisId="krw"
                                    tickFormatter={(value) => `₩${fmtNum(Number(value))}`}
                                    width={86}
                                  />
                                  <YAxis
                                    yAxisId="pct"
                                    orientation="right"
                                    tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                    width={48}
                                  />
                                  <Tooltip
                                    formatter={(value, name) =>
                                      name === "순매출"
                                        ? [`₩${fmtNum(Number(value))}`, name]
                                        : [`${Number(value).toFixed(2)}%`, name]
                                    }
                                  />
                                  <Legend />
                                  <Bar
                                    yAxisId="krw"
                                    dataKey="netRevenue"
                                    name="순매출"
                                    fill="var(--color-primary)"
                                    radius={[8, 8, 0, 0]}
                                  />
                                  <Bar
                                    yAxisId="pct"
                                    dataKey="purchaseRatePct"
                                    name="구매율"
                                    fill="var(--color-accent)"
                                    radius={[8, 8, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className={styles.panel}>
                            <h3 className={styles.panelTitle}>실험군별 성과</h3>
                            <div className={styles.tableScroll}>
                              <table className={styles.table}>
                                <thead>
                                  <tr className={styles.tableHead}>
                                    <th>실험 그룹</th>
                                    <th className={styles.tableCellRight}>배정</th>
                                    <th className={styles.tableCellRight}>구매자</th>
                                    <th className={styles.tableCellRight}>순매출</th>
                                    <th className={styles.tableCellRight}>구매율</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {localData.results.map((row) => {
                                    const alias = localData.selectedExperiment?.variant_aliases?.[row.variant_key];
                                    return (
                                    <tr key={row.variant_key} className={styles.tableRow}>
                                      <td><strong>{row.variant_key}</strong>{alias && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "#6366f1" }}>({alias})</span>}</td>
                                      <td className={styles.tableCellRight}>{fmtNum(row.assignment_count)}</td>
                                      <td className={styles.tableCellRight}>{fmtNum(row.purchaser_count)}</td>
                                      <td className={styles.tableCellRight}>{fmtKRW(row.net_revenue)}</td>
                                      <td className={styles.tableCellRight}>{fmtPct(row.purchase_rate)}</td>
                                    </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                        </div>{/* 결과 반투명 영역 닫기 */}

                          <div className={styles.panel}>
                            <details>
                              <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "#475569", padding: "6px 0" }}>
                                최근 배정 ({fmtNum(localData.assignments.total)}건) — 클릭하여 펼치기
                              </summary>
                            {localData.assignments.items.length > 0 ? (
                              <div className={styles.tableScroll} style={{ marginTop: 8 }}>
                                <table className={styles.table}>
                                  <thead>
                                    <tr className={styles.tableHead}>
                                      <th>고객 식별키</th>
                                      <th>배정 그룹</th>
                                      <th>배정일</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {localData.assignments.items.slice(0, 10).map((row) => (
                                      <tr key={`${row.customer_key}-${row.id}`} className={styles.tableRow}>
                                        <td className={styles.phone}>{row.customer_key}</td>
                                        <td>{row.variant_key}</td>
                                        <td>{fmtDateTime(row.assigned_at)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {localData.assignments.items.length > 10 && (
                                  <div style={{ textAlign: "center", padding: 6, fontSize: "0.72rem", color: "#94a3b8" }}>
                                    최근 10건만 표시. 전체 {fmtNum(localData.assignments.total)}건.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className={styles.empty}>배정 기록이 아직 없습니다.</div>
                            )}
                            </details>
                          </div>
                        </div>
                      </>
                    );
                  })() : null}
                </>
              ) : null}
            </section>

            {/* Revenue bridge 참고 (기존 crmPhase1) */}
            <section className={styles.section}>
              <details style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <summary style={{
                  padding: "12px 18px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600,
                  color: "#64748b", background: "#f8fafc", userSelect: "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>Revenue Bridge 상태 (개발자 진단용)</span>
                  <button type="button" className={styles.retryButton} onClick={(e) => { e.stopPropagation(); reloadPhase1(); }} style={{ fontSize: "0.72rem" }}>
                    새로고침
                  </button>
                </summary>
                <div style={{ padding: "12px 18px" }}>

              {phase1Loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>bridge 상태 확인 중...</p>
                </div>
              ) : null}

              {phase1Error ? (
                <div className={styles.errorBox}>
                  <strong>Revenue bridge 오류</strong>
                  <p>{phase1Error}</p>
                </div>
              ) : null}

              {phase1Data ? (
                <>
                  <div className={styles.summaryGrid}>
                    <SummaryCard
                      label="Revenue Bridge"
                      value={phase1Data.p1s1.revenueBridge.reachable ? "연결됨" : "미연결"}
                      sub={phase1Data.p1s1.revenueBridge.error ?? "실험 API를 읽을 준비가 됨"}
                      tone={phase1Data.p1s1.revenueBridge.reachable ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="실험 수"
                      value={`${fmtNum(phase1Data.p1s1.experimentCount)}개`}
                      sub="외부 매출 시스템에서 조회되는 실험 목록"
                    />
                    <SummaryCard
                      label="선택된 실험"
                      value={phase1Data.p1s1.selectedExperimentKey ?? "없음"}
                      sub="기본은 최신 실험 1건"
                    />
                    <SummaryCard
                      label="막힌 이유"
                      value={`${fmtNum(phase1Data.blockers.length)}건`}
                      sub="live 연결이 닫히지 않은 이유를 명시적으로 기록"
                      tone={phase1Data.blockers.length > 0 ? "warn" : "default"}
                    />
                  </div>

                  {phase1Data.blockers.length > 0 ? (
                    <div className={styles.warningBox}>
                      <strong>현재 남은 blocker</strong>
                      <ul className={styles.flatList}>
                        {phase1Data.blockers.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {!phase1Data.p1s1.revenueBridge.reachable && (
                        <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(13,148,136,0.04)", borderRadius: 8, fontSize: "0.78rem", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
                          <strong>연결 방법:</strong> <code>backend/.env</code>에 아래 2개 값을 추가하고 백엔드를 재시작하면 실험 데이터가 연결됩니다.
                          <pre style={{ margin: "8px 0 0", padding: 10, background: "rgba(0,0,0,0.03)", borderRadius: 6, fontSize: "0.75rem", overflow: "auto" }}>
{`REVENUE_API_BASE_URL=https://workspace.biocom.ai.kr
REVENUE_API_BEARER_TOKEN=여기에_토큰_입력`}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className={styles.experimentList}>
                    {phase1Data.p1s1.experiments.length === 0 ? (
                      <div className={styles.empty}>
                        실험 목록이 아직 비어 있습니다. 현재는 UI와 proxy는 붙었지만, live 조회는 revenue
                        bridge 설정이 필요합니다.
                      </div>
                    ) : (
                      phase1Data.p1s1.experiments.slice(0, 8).map((experiment) => (
                        <button
                          key={experiment.experiment_key}
                          type="button"
                          className={`${styles.experimentCard} ${
                            phase1Data.p1s1.selectedExperimentKey === experiment.experiment_key
                              ? styles.experimentCardActive
                              : ""
                          }`}
                          onClick={() => setSelectedExperimentKey(experiment.experiment_key)}
                        >
                          <span className={styles.experimentStatus}>{experiment.status}</span>
                          <strong>{experiment.name}</strong>
                          <span>{experiment.experiment_key}</span>
                          <span>
                            version {experiment.assignment_version} · window {experiment.conversion_window_days}일
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {selectedExperiment ? (() => {
                    const controlRow = selectedExperiment.variant_summary.find((r) => r.variant_key === "control");
                    const treatmentRow = selectedExperiment.variant_summary.find((r) => r.variant_key !== "control");
                    const hasLift = controlRow && treatmentRow && controlRow.assignment_count > 0 && treatmentRow.assignment_count > 0;
                    const purchaseRateLift = hasLift ? treatmentRow.purchase_rate - controlRow.purchase_rate : null;
                    const revenuePerUserLift = hasLift
                      ? (treatmentRow.net_revenue / treatmentRow.assignment_count) - (controlRow.net_revenue / controlRow.assignment_count)
                      : null;

                    return (
                    <div className={styles.detailGrid}>
                      {/* 증분 효과 요약 */}
                      {hasLift && (
                        <div className={styles.panel} style={{ gridColumn: "1 / -1" }}>
                          <h3 className={styles.panelTitle}>메시지 효과 비교 (실험군 vs 대조군)</h3>
                          <div className={styles.summaryGrid}>
                            <SummaryCard
                              label="구매율 차이"
                              value={`${purchaseRateLift! >= 0 ? "+" : ""}${(purchaseRateLift! * 100).toFixed(2)}%p`}
                              sub={`treatment ${fmtPct(treatmentRow!.purchase_rate)} vs control ${fmtPct(controlRow!.purchase_rate)}`}
                              tone={purchaseRateLift! > 0 ? "success" : "warn"}
                            />
                            <SummaryCard
                              label="인당 순매출 차이"
                              value={`${revenuePerUserLift! >= 0 ? "+" : ""}${fmtKRW(Math.round(revenuePerUserLift!))}`}
                              sub="메시지 받은 그룹 - 안 받은 그룹 (1인당)"
                              tone={revenuePerUserLift! > 0 ? "success" : "warn"}
                            />
                            <SummaryCard
                              label="treatment 구매율"
                              value={fmtPct(treatmentRow!.purchase_rate)}
                              sub={`${fmtNum(treatmentRow!.purchaser_count)}명 구매 / ${fmtNum(treatmentRow!.assignment_count)}명`}
                            />
                            <SummaryCard
                              label="control 구매율"
                              value={fmtPct(controlRow!.purchase_rate)}
                              sub={`${fmtNum(controlRow!.purchaser_count)}명 구매 / ${fmtNum(controlRow!.assignment_count)}명`}
                            />
                          </div>
                        </div>
                      )}

                      <div className={styles.panel}>
                        <h3 className={styles.panelTitle}>실험군별 성과</h3>
                        <div className={styles.tableScroll}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHead}>
                                <th>실험 그룹</th>
                                <th className={styles.tableCellRight}>배정 수</th>
                                <th className={styles.tableCellRight}>구매자</th>
                                <th className={styles.tableCellRight}>구매건</th>
                                <th className={styles.tableCellRight}>순매출</th>
                                <th className={styles.tableCellRight}>구매율</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedExperiment.variant_summary.map((row) => (
                                <tr key={row.variant_key} className={styles.tableRow}>
                                  <td>{row.variant_key}</td>
                                  <td className={styles.tableCellRight}>{fmtNum(row.assignment_count)}</td>
                                  <td className={styles.tableCellRight}>{fmtNum(row.purchaser_count)}</td>
                                  <td className={styles.tableCellRight}>{fmtNum(row.purchase_count)}</td>
                                  <td className={styles.tableCellRight}>{fmtKRW(row.net_revenue)}</td>
                                  <td className={styles.tableCellRight}>{fmtPct(row.purchase_rate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className={styles.panel}>
                        <h3 className={styles.panelTitle}>최근 배정 기록</h3>
                        {selectedAssignments?.items.length ? (
                          <div className={styles.tableScroll}>
                            <table className={styles.table}>
                              <thead>
                                <tr className={styles.tableHead}>
                                  <th>고객 식별키</th>
                                  <th>배정 그룹</th>
                                  <th className={styles.tableCellRight}>순매출</th>
                                  <th>배정일</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedAssignments.items.map((row) => (
                                  <tr key={`${row.customer_key}-${row.assignment_bucket}`} className={styles.tableRow}>
                                    <td className={styles.phone}>{row.customer_key}</td>
                                    <td>{row.variant_key}</td>
                                    <td className={styles.tableCellRight}>{fmtKRW(row.conversion_summary.net_revenue)}</td>
                                    <td>{fmtDateTime(row.assigned_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className={styles.empty}>배정 기록이 아직 없습니다.</div>
                        )}
                      </div>
                    </div>
                  );
                  })() : null}
                </>
              ) : null}
                </div>
              </details>
            </section>

            <section className={styles.interpretBlock}>
              <strong>이 탭은 실험 관제실이다.</strong>
              <p>
                실험 장부에 기록된 결과를 운영자가 읽는 자리다.
                어떤 그룹이 더 잘 샀는지, 메시지가 실제 매출을 만들었는지를 확인한다.
              </p>
            </section>
          </>
        ) : null}

        {tab === "messaging" ? (
          <MessagingTab />

        ) : null}

        {tab === "attribution" ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>결제 추적 현황</h2>
                  <p className={styles.sectionDesc}>
                    고객이 결제를 완료했을 때, 그 기록이 우리 시스템에 제대로 들어오는지 확인한다.
                  </p>
                </div>
                <button type="button" className={styles.retryButton} onClick={() => reloadPhase1()}>
                  새로고침
                </button>
              </div>

              {phase1Loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>귀속 진단 데이터를 불러오는 중...</p>
                </div>
              ) : null}

              {phase1Error ? (
                <div className={styles.errorBox}>
                  <strong>귀속 진단 오류</strong>
                  <p>{phase1Error}</p>
                </div>
              ) : null}

              {phase1Data ? (
                <>
                  {/* Blocker headline */}
                  {(() => {
                    const liveCount = phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live;
                    const replayCount = phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.replay;
                    const headline = liveCount === 0
                      ? `결제 완료 신호가 아직 들어오지 않고 있다 — 사이트 연결이 필요하다`
                      : `실제 결제 ${liveCount}건 수집 완료 (과거 데이터 재확인 ${replayCount}건)`;
                    const isBlocked = liveCount === 0;
                    return (
                      <div style={{
                        padding: "12px 18px", borderRadius: 10, marginBottom: 14,
                        background: isBlocked ? "#fef2f2" : "#f0fdf4",
                        border: `1px solid ${isBlocked ? "#fecaca" : "#bbf7d0"}`,
                        fontSize: "0.88rem", fontWeight: 700,
                        color: isBlocked ? "#dc2626" : "#16a34a",
                      }}>
                        {headline}
                      </div>
                    );
                  })()}

                  <div className={styles.summaryGrid}>
                    <SummaryCard
                      label="수집된 결제 기록"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.totalEntries)}
                      sub={`실제 결제 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.live)}건 / 과거 재확인 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.replay)}건 / 시스템 점검 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.smoke)}건`}
                      tone={phase1Data.p1s1a.ledgerSummary.totalEntries > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="실제 결제 완료"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live)}
                      sub="고객이 결제 완료 페이지에 도달한 건수"
                      tone={phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="확정 매출"
                      value={fmtKRW(phase1Data.p1s1a.ledgerSummary.confirmedRevenue)}
                      sub={`confirmed ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.confirmed)}건`}
                      tone={phase1Data.p1s1a.ledgerSummary.confirmedRevenue > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="입금 대기 매출"
                      value={fmtKRW(phase1Data.p1s1a.ledgerSummary.pendingRevenue)}
                      sub={`pending ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.pending)}건`}
                    />
                    <SummaryCard
                      label="취소/실패 매출"
                      value={fmtKRW(phase1Data.p1s1a.ledgerSummary.canceledRevenue)}
                      sub={`canceled ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.canceled)}건`}
                    />
                    <SummaryCard
                      label="과거 데이터 재확인"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.replay)}
                      sub="이전 결제 기록을 다시 불러와 대조한 건수"
                    />
                    <SummaryCard
                      label="시스템 점검 기록"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.smoke)}
                      sub="시스템이 정상 작동하는지 테스트한 건수"
                    />
                    <SummaryCard
                      label="토스 결제 대조 성공률"
                      value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate)}
                      sub={`토스에서 확인된 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.matchedTossRows)}건 / 전체 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}건 (실제 결제 기준)`}
                      tone={phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="토스 결제 대조 성공률"
                      value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.joinCoverageRate)}
                      sub={`토스에서 확인된 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.matchedTossRows)}건 / 전체 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}건 (과거 재확인 기준)`}
                    />
                    <SummaryCard
                      label="유입 경로 불명 매출"
                      value={fmtKRW(phase1Data.p1s1a.ga4NotSetTotals?.grossPurchaseRevenue ?? 0)}
                      sub={`어디서 왔는지 모르는 구매 ${fmtNum(phase1Data.p1s1a.ga4NotSetTotals?.ecommercePurchases ?? 0)}건`}
                    />
                    <SummaryCard
                      label="출처 누락 비율"
                      value={fmtRatio(phase1Data.p1s1a.ga4Diagnosis?.dataQualitySignals.notSetLandingRatio ?? 0)}
                      sub="처음 방문 기록이 빠진 비율 (광고 효과 측정에 영향)"
                    />
                  </div>

                  <div className={styles.warningBox} style={{ marginTop: 18 }}>
                    <strong>이 숫자들은 어떻게 읽나요?</strong>
                    <ul className={styles.flatList}>
                      <li><strong>실제 결제</strong> — 고객이 사이트에서 결제를 완료했을 때 자동으로 기록된 건수. 가장 중요한 숫자.</li>
                      <li><strong>확정 매출</strong> — 토스 상태가 DONE/PAID로 닫힌 건만 잡은 실제 매출. 광고/CAPI 기준값으로 본다.</li>
                      <li><strong>입금 대기 매출</strong> — 무통장 입금 등 아직 pending인 금액. 확정 전이므로 광고 성과 매출에는 포함하지 않는다.</li>
                      <li><strong>취소/실패 매출</strong> — cancel/fail 상태로 바뀐 금액. 누락/오집계 여부를 보는 감시 숫자다.</li>
                      <li><strong>과거 재확인</strong> — 예전 결제 기록을 토스 DB에서 다시 불러와서 빠진 게 없는지 확인한 건수. (교차 검증용)</li>
                      <li><strong>시스템 점검</strong> — 기록 시스템이 정상 작동하는지 테스트 데이터로 확인한 건수. (실제 매출 아님)</li>
                      <li><strong>토스 결제 대조</strong> — 우리가 수집한 결제 기록을 토스 승인 내역과 맞춰본 비율. 높을수록 기록이 정확함.</li>
                      <li><strong>유입 경로 불명</strong> — 구매는 됐는데 "이 고객이 어디서 왔는지"를 모르는 매출. (광고/검색/직접 방문 중 뭔지 추적 실패)</li>
                    </ul>
                  </div>

                  {/* 날짜별 추이 차트 */}
                  {phase1Data.p1s1a.timeline.length > 0 && (
                    <div className={styles.panel}>
                      <h3 className={styles.panelTitle}>날짜별 결제 수집 추이</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={phase1Data.p1s1a.timeline.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="ga4NotSetPurchases" fill="var(--color-danger)" name="유입 불명 구매" />
                          <Bar dataKey="tossApprovalCount" fill="var(--color-info)" name="토스 결제 승인" />
                          <Bar dataKey="livePaymentSuccessEntries" fill="var(--color-success)" name="실제 결제" />
                          <Bar dataKey="replayPaymentSuccessEntries" fill="#f59e0b" name="과거 재확인" />
                          <Bar dataKey="smokePaymentSuccessEntries" fill="#6b7280" name="시스템 점검" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className={styles.panel}>
                    <h3 className={styles.panelTitle}>날짜별 결제 기록 비교표</h3>
                    <div className={styles.tableScroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr className={styles.tableHead}>
                            <th>날짜</th>
                            <th className={styles.tableCellRight}>유입 불명 구매</th>
                            <th className={styles.tableCellRight}>유입 불명 매출</th>
                            <th className={styles.tableCellRight}>토스 승인</th>
                            <th className={styles.tableCellRight}>토스 승인액</th>
                            <th className={styles.tableCellRight}>실제 결제</th>
                            <th className={styles.tableCellRight}>과거 재확인</th>
                            <th className={styles.tableCellRight}>점검</th>
                            <th className={styles.tableCellRight}>결제 시작</th>
                            <th>상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phase1Data.p1s1a.timeline.length === 0 ? (
                            <tr>
                              <td colSpan={10} className={styles.empty}>
                                비교할 timeline 데이터가 없습니다.
                              </td>
                            </tr>
                          ) : (
                            phase1Data.p1s1a.timeline.slice(0, 20).map((row) => (
                              <tr key={row.date} className={styles.tableRow}>
                                <td>{row.date}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.ga4NotSetPurchases)}</td>
                                <td className={styles.tableCellRight}>{fmtKRW(row.ga4NotSetRevenue)}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.tossApprovalCount)}</td>
                                <td className={styles.tableCellRight}>{fmtKRW(row.tossApprovalAmount)}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.livePaymentSuccessEntries)}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.replayPaymentSuccessEntries)}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.smokePaymentSuccessEntries)}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.checkoutEntries)}</td>
                                <td>{row.diagnosticLabel}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.warningBox}>
                    <strong>다음 액션</strong>
                    <ul className={styles.flatList}>
                      {phase1Data.p1s1a.nextActions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </section>

            <section className={styles.interpretBlock}>
              <strong>이 탭이 왜 필요한가?</strong>
              <p>
                고객이 결제하면 3곳에 기록이 남는다: (1) 구글 애널리틱스, (2) 토스 결제 시스템, (3) 우리 자체 수집기.
                이 세 곳의 숫자가 같은 날에 맞아야 "결제 추적이 정상"이라고 볼 수 있다.
                숫자가 안 맞으면 광고 효과나 매출 분석이 틀어지므로, 여기서 매일 대조하는 것이다.
              </p>
            </section>
          </>
        ) : null}

        {/* ── AIBIO: 광고 성과 탭 ── */}
        {tab === "ads" ? (
          <AibioAdsTab />
        ) : null}

        {/* ── AIBIO: 리드 관리 탭 ── */}
        {tab === "leads" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>리드 관리</h2>
                <p className={styles.sectionDesc}>
                  광고나 콘텐츠를 통해 유입된 잠재 고객의 전환 현황을 추적한다.
                </p>
              </div>
            </div>
            <div className={styles.empty} style={{ padding: "60px 18px" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: 12 }}>준비 중</div>
              <p style={{ fontSize: "0.84rem", color: "var(--color-text-secondary)", lineHeight: 1.7, maxWidth: 440, margin: "0 auto" }}>
                리드 관리 기능은 Phase 7 (증분 실험)에서 구현 예정이다.
                서울 고객 대상 리커버리랩 방문 쿠폰 실험, 리드 마그넷 등이 포함된다.
              </p>
            </div>
          </section>
        ) : null}

        {/* ── 더클린커피: 구매 현황 탭 ── */}
        {tab === "orders" ? (
          <CoffeeOrdersTab />
        ) : null}

        {/* ── 더클린커피: 재구매 관리 탭 ── */}
        {tab === "repurchase" ? (
          <CoffeeRepurchaseTab />
        ) : null}

        {/* ── 고객 그룹 탭 ── */}
        {tab === "groups" ? (
          <CustomerGroupsTab />
        ) : null}

        {/* ── 전체: 사이트 비교 탭 ── */}
        {tab === "comparison" ? (
          <SiteComparisonTab />
        ) : null}
      </main>
    </div>
  );
}

/* ─── AIBIO 광고 성과 탭 컴포넌트 ─── */
function AibioAdsTab() {
  const [adsData, setAdsData] = useState<{
    accounts: { id: string; name: string; spend: string; impressions: string; clicks: string; cpc: string }[];
    overview: { totalSpend: number; totalImpressions: number; totalClicks: number; avgCpc: number };
  } | null>(null);
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsError, setAdsError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setAdsLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/meta/overview`, { signal: ac.signal }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([overview]) => {
        if (overview) {
          setAdsData({
            accounts: overview.accounts ?? [],
            overview: {
              totalSpend: overview.totalSpend ?? 0,
              totalImpressions: overview.totalImpressions ?? 0,
              totalClicks: overview.totalClicks ?? 0,
              avgCpc: overview.avgCpc ?? 0,
            },
          });
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) setAdsError(err instanceof Error ? err.message : "광고 데이터를 불러올 수 없습니다");
      })
      .finally(() => { if (!ac.signal.aborted) setAdsLoading(false); });
    return () => ac.abort();
  }, []);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>AIBIO 광고 성과</h2>
            <p className={styles.sectionDesc}>
              Meta 광고의 노출/클릭/비용을 확인하고, 캠페인별 효율을 비교한다.
            </p>
          </div>
          <Link href="/ads" className={styles.retryButton} style={{ textDecoration: "none", textAlign: "center" }}>
            상세 대시보드 →
          </Link>
        </div>

        {adsLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>광고 데이터를 불러오는 중...</p>
          </div>
        ) : adsError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{adsError}</p>
          </div>
        ) : adsData ? (
          <>
            <div className={styles.summaryGrid}>
              <SummaryCard label="총 노출" value={fmtNum(adsData.overview.totalImpressions)} sub="30일 기준" />
              <SummaryCard label="총 클릭" value={fmtNum(adsData.overview.totalClicks)} sub="광고를 클릭한 횟수" />
              <SummaryCard label="총 비용" value={fmtKRW(adsData.overview.totalSpend)} sub="Meta 광고비 합산" />
              <SummaryCard label="평균 CPC" value={fmtKRW(adsData.overview.avgCpc)} sub="클릭 1회당 비용" />
            </div>
            {adsData.accounts.length > 0 && (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>광고 계정</th>
                      <th className={styles.tableCellRight}>노출</th>
                      <th className={styles.tableCellRight}>클릭</th>
                      <th className={styles.tableCellRight}>비용</th>
                      <th className={styles.tableCellRight}>CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsData.accounts.map((acc) => (
                      <tr key={acc.id} className={styles.tableRow}>
                        <td><strong>{acc.name}</strong></td>
                        <td className={styles.tableCellRight}>{acc.impressions}</td>
                        <td className={styles.tableCellRight}>{acc.clicks}</td>
                        <td className={styles.tableCellRight}>{acc.spend}</td>
                        <td className={styles.tableCellRight}>{acc.cpc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
      <section className={styles.interpretBlock}>
        <strong>광고 성과 탭이 왜 필요한가?</strong>
        <p>
          AIBIO는 월 ₩148만을 Meta 광고에 쓰고 있다. 이 돈이 실제 고객을 데려오는지,
          어떤 캠페인이 효율적인지 여기서 확인한다. 상세 분석은 /ads 대시보드에서 본다.
        </p>
      </section>
    </>
  );
}

/* ─── 더클린커피 구매 현황 탭 컴포넌트 ─── */
function CoffeeOrdersTab() {
  const [txData, setTxData] = useState<{
    transactions: { paymentKey: string; orderId: string; amount: number; method: string; approvedAt: string; status: string }[];
    summary: { totalAmount: number; totalCount: number; avgAmount: number };
  } | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setTxLoading(true);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    fetch(`${API_BASE}/api/toss/daily-summary?startDate=${startDate}&endDate=${endDate}`, { signal: ac.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const days = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          const totalAmount = days.reduce((s: number, d: { totalAmount?: number }) => s + (d.totalAmount ?? 0), 0);
          const totalCount = days.reduce((s: number, d: { totalCount?: number }) => s + (d.totalCount ?? 0), 0);
          setTxData({
            transactions: days,
            summary: { totalAmount, totalCount, avgAmount: totalCount > 0 ? totalAmount / totalCount : 0 },
          });
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) setTxError(err instanceof Error ? err.message : "주문 데이터를 불러올 수 없습니다");
      })
      .finally(() => { if (!ac.signal.aborted) setTxLoading(false); });
    return () => ac.abort();
  }, []);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>최근 7일 주문 현황</h2>
            <p className={styles.sectionDesc}>
              Toss 결제 데이터 기준으로 최근 주문과 매출 추이를 확인한다.
            </p>
          </div>
        </div>

        {txLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>주문 데이터를 불러오는 중...</p>
          </div>
        ) : txError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{txError}</p>
          </div>
        ) : txData ? (
          <>
            <div className={styles.summaryGrid}>
              <SummaryCard label="7일 매출" value={fmtKRW(txData.summary.totalAmount)} sub="Toss 결제 합산" tone="success" />
              <SummaryCard label="주문 수" value={`${fmtNum(txData.summary.totalCount)}건`} sub="최근 7일" />
              <SummaryCard label="평균 주문액" value={fmtKRW(txData.summary.avgAmount)} sub="건당 평균" />
              <SummaryCard label="결제 추적" value="live" sub="아임웹 푸터 코드 가동 중" tone="success" />
            </div>
            {txData.transactions.length > 0 && (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>날짜</th>
                      <th className={styles.tableCellRight}>주문 수</th>
                      <th className={styles.tableCellRight}>매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txData.transactions.map((day: Record<string, unknown>, idx: number) => (
                      <tr key={idx} className={styles.tableRow}>
                        <td>{String(day.date ?? day.settlementDate ?? `-`)}</td>
                        <td className={styles.tableCellRight}>{fmtNum(Number(day.totalCount ?? day.count ?? 0))}</td>
                        <td className={styles.tableCellRight}>{fmtKRW(Number(day.totalAmount ?? day.amount ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
      <section className={styles.interpretBlock}>
        <strong>더클린커피에서 중요한 것</strong>
        <p>
          상담 서비스가 없으므로, 주문 데이터와 재구매율이 핵심 지표다.
          장바구니 이탈, 재구매 주기, 베스트셀러 분석은 다음 단계에서 추가한다.
        </p>
      </section>
    </>
  );
}

/* ─── A/B 테스트 섹션 ─── */

type AbVariant = {
  variant_key: string;
  assigned: number;
  sent: number;
  sendFailed: number;
  purchased: number;
  purchaseRate: number;
  revenue: number;
  avgOrderAmount: number;
};

type AbExperiment = {
  experiment_key: string;
  name: string;
  status: string;
  channel: string;
  hypothesis: string;
  conversion_window_days: number;
  created_at: string;
};

type AbSummaryResponse = {
  ok: boolean;
  experiment: AbExperiment;
  variants: AbVariant[];
  conversionWindowDays: number;
};

/* ─── 고객 그룹 관리 탭 ─── */

type GroupInfo = { group_id: string; name: string; description: string | null; member_count: number; created_at: string; updated_at: string };
type GroupMember = { phone: string; name: string | null; member_code: string | null; consent_sms: boolean; added_at: string };

function CustomerGroupsTab() {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPhones, setNewPhones] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [msgLog, setMsgLog] = useState<Array<Record<string, unknown>>>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const router = useRouter();

  const loadGroups = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/crm-local/groups`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGroups(); }, []);

  useEffect(() => {
    if (!selectedGroup) { setMembers([]); setMembersTotal(0); return; }
    setMembersLoading(true);
    fetch(`${API_BASE}/api/crm-local/groups/${selectedGroup}/members?limit=100`)
      .then((r) => r.json())
      .then((d) => { setMembers(d.members ?? []); setMembersTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [selectedGroup]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm-local/groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok && newPhones.trim()) {
        const phoneList = newPhones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
        await fetch(`${API_BASE}/api/crm-local/groups/${data.group.group_id}/members`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members: phoneList.map((p) => ({ phone: p })) }),
        });
      }
      setNewName(""); setNewDesc(""); setNewPhones(""); setShowCreate(false);
      loadGroups();
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm("이 그룹을 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE}/api/crm-local/groups/${groupId}`, { method: "DELETE" });
    if (selectedGroup === groupId) setSelectedGroup(null);
    loadGroups();
  };

  const handleSendToGroup = (groupId: string) => {
    const params = new URLSearchParams();
    params.set("site", "thecleancoffee");
    params.set("tab", "messaging");
    params.set("groupId", groupId);
    params.set("channel", "sms");
    params.set("adminOverride", "true");
    window.location.search = params.toString();
  };

  const loadMsgLog = () => {
    setShowLog(true);
    fetch(`${API_BASE}/api/crm-local/message-log?limit=50`)
      .then((r) => r.json())
      .then((d) => { setMsgLog(d.messages ?? []); setMsgTotal(d.total ?? 0); })
      .catch(() => {});
  };

  return (
    <>
      {/* 그룹 목록 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>고객 그룹 목록</h2>
            <p className={styles.sectionDesc}>A/B 실험 생성 시 자동으로 그룹이 생성된다. 직접 그룹을 만들 수도 있다.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowCreate(!showCreate)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#fee500", color: "#3c1e1e", fontWeight: 700, fontSize: "0.82rem",
            }}>+ 신규그룹 만들기</button>
            <button onClick={loadMsgLog} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer",
              background: "#fff", color: "#475569", fontWeight: 600, fontSize: "0.82rem",
            }}>메시지 이력</button>
          </div>
        </div>

        {/* 신규 그룹 생성 폼 */}
        {showCreate && (
          <div style={{ padding: 18, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 12 }}>신규그룹 만들기</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>그룹명</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="그룹명을 입력하세요"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4 }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>{newName.length}/20자</div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>그룹 설명</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="그룹 설명을 입력하세요"
                  rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4, resize: "vertical" }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>{newDesc.length}/60자</div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>전화번호 직접 입력</label>
                <textarea value={newPhones} onChange={(e) => setNewPhones(e.target.value)}
                  placeholder={"전화번호를 한 줄에 하나씩 추가해주세요.\nex)\n010-0000-0000\n010-1111-1111"}
                  rows={5} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.82rem", marginTop: 4, resize: "vertical", fontFamily: "monospace" }} />
                <div style={{ textAlign: "right", fontSize: "0.68rem", color: "#94a3b8" }}>
                  {newPhones.split(/[\n,]+/).filter((p) => p.trim()).length}/10,000개
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.82rem" }}>취소</button>
                <button onClick={handleCreate} disabled={creating || !newName.trim()} style={{
                  padding: "8px 20px", borderRadius: 6, border: "none", cursor: creating ? "not-allowed" : "pointer",
                  background: "#fee500", color: "#3c1e1e", fontWeight: 700, fontSize: "0.82rem",
                }}>{creating ? "생성 중..." : "그룹등록"}</button>
              </div>
            </div>
          </div>
        )}

        {/* 그룹 테이블 */}
        {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div> : (
          <>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8 }}>전체 그룹 <span style={{ color: "#6366f1" }}>{groups.length}개</span></div>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>그룹명</th>
                  <th className={styles.tableCellRight}>인원수</th>
                  <th>생성일시</th>
                  <th>설명</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.group_id} className={styles.tableRow} style={{ cursor: "pointer", background: selectedGroup === g.group_id ? "#eef2ff" : undefined }}
                    onClick={() => setSelectedGroup(selectedGroup === g.group_id ? null : g.group_id)}>
                    <td><strong>{g.name}</strong></td>
                    <td className={styles.tableCellRight}><span style={{ color: "#6366f1", fontWeight: 600 }}>{g.member_count}명</span></td>
                    <td style={{ fontSize: "0.76rem", color: "#64748b" }}>{g.created_at?.slice(0, 16)}</td>
                    <td style={{ fontSize: "0.76rem", color: "#94a3b8" }}>{g.description || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSendToGroup(g.group_id)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #6366f1", background: "#eef2ff", color: "#4f46e5", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>발송</button>
                        <button onClick={() => handleDelete(g.group_id)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>생성된 고객 그룹이 없다. A/B 실험 생성 시 자동으로 그룹이 만들어진다.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* 선택된 그룹 멤버 목록 */}
        {selectedGroup && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 8 }}>
              그룹 멤버 — {groups.find((g) => g.group_id === selectedGroup)?.name} (<span style={{ color: "#6366f1" }}>{membersTotal}명</span>)
            </div>
            {membersLoading ? <div style={{ color: "#94a3b8" }}>로딩 중...</div> : (
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHead}>
                    <th>전화번호</th>
                    <th>고객명</th>
                    <th>고객번호</th>
                    <th>SMS 동의</th>
                    <th>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {members.slice(0, 30).map((m) => (
                    <tr key={m.phone} className={styles.tableRow}>
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{m.phone}</td>
                      <td>{m.name || "-"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#64748b" }}>{m.member_code || "-"}</td>
                      <td><span className={`${styles.statusBadge} ${m.consent_sms ? styles.statusCompleted : styles.statusOther}`}>{m.consent_sms ? "동의" : "미동의"}</span></td>
                      <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{m.added_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {membersTotal > 30 && <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>외 {membersTotal - 30}명 더 있음</div>}
          </div>
        )}
      </section>

      {/* 메시지 이력 */}
      {showLog && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>메시지 이력</h2>
              <p className={styles.sectionDesc}>총 {msgTotal}건</p>
            </div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHead}>
                <th>발송일시</th>
                <th>채널</th>
                <th>고객번호</th>
                <th>템플릿</th>
                <th>상태</th>
                <th>실험</th>
              </tr>
            </thead>
            <tbody>
              {msgLog.map((m, i) => (
                <tr key={i} className={styles.tableRow}>
                  <td style={{ fontSize: "0.76rem" }}>{String(m.sent_at ?? "").slice(0, 16)}</td>
                  <td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 600, background: m.channel === "alimtalk" ? "#fee500" : "#dbeafe", color: m.channel === "alimtalk" ? "#3c1e1e" : "#1e40af" }}>{String(m.channel)}</span></td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>{String(m.customer_key ?? "-")}</td>
                  <td style={{ fontSize: "0.76rem", color: "#475569" }}>{String(m.template_code ?? "-")}</td>
                  <td><span className={`${styles.statusBadge} ${m.provider_status === "success" ? styles.statusCompleted : styles.statusOther}`}>{String(m.provider_status ?? "-")}</span></td>
                  <td style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{String(m.experiment_key ?? "-")}</td>
                </tr>
              ))}
              {msgLog.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>발송 이력 없음</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function CoffeeAbTestSection({ minDays, maxDays, minOrders, candidates }: {
  minDays: number;
  maxDays: number;
  minOrders: number;
  candidates: { consentSms: boolean; phone: string; name: string; memberCode: string; daysSinceLastPurchase: number }[];
}) {
  const [experiments, setExperiments] = useState<Array<{ experiment_key: string; name: string; status: string; channel: string; created_at: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<AbSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // 기존 실험 목록 로드
  useEffect(() => {
    fetch(`${API_BASE}/api/crm-local/experiments?meta=true`)
      .then((r) => r.json())
      .then((d) => {
        const abExps = (d.experiments ?? []).filter((e: { channel?: string }) => e.channel?.includes("+"));
        setExperiments(abExps);
        if (abExps.length > 0 && !selectedKey) setSelectedKey(abExps[0].experiment_key);
      })
      .catch(() => {});
  }, []);

  // 선택된 실험 결과 로드
  useEffect(() => {
    if (!selectedKey) { setSummary(null); return; }
    setSummaryLoading(true);
    fetch(`${API_BASE}/api/crm-local/experiments/${selectedKey}/ab-summary`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSummary(d); })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [selectedKey]);

  const [testType, setTestType] = useState<"channel" | "consent">("channel");
  const withPhone = candidates.filter((c) => c.phone);
  const consentCount = withPhone.filter((c) => c.consentSms).length;
  const nonConsentCount = withPhone.length - consentCount;

  const TEST_TYPES = [
    { key: "channel" as const, label: "SMS vs 알림톡", desc: "동의 고객을 채널별로 나누어 비교", targetCount: consentCount },
    { key: "consent" as const, label: "동의 vs 미동의", desc: "양군 모두 SMS 발송, 동의 여부별 전환율 비교", targetCount: withPhone.length },
  ];

  const currentType = TEST_TYPES.find((t) => t.key === testType)!;

  const handleCreate = async () => {
    const isConsent = testType === "consent";
    const msg = isConsent
      ? `전체 ${withPhone.length}명을 동의(${consentCount}명) vs 미동의(${nonConsentCount}명)로 나누어 실험을 생성하시겠습니까?`
      : `SMS 동의 고객 ${consentCount}명을 SMS/알림톡 두 그룹으로 나누어 실험을 생성하시겠습니까?`;
    if (!confirm(msg)) return;
    setCreating(true);
    try {
      const body = isConsent
        ? { site: "thecleancoffee", minDays, maxDays, minOrders, variantA: "consent_sms", variantB: "noconsent_sms", splitBy: "consent", conversionWindowDays: 3 }
        : { site: "thecleancoffee", minDays, maxDays, minOrders, variantA: "sms", variantB: "alimtalk", splitBy: "channel", conversionWindowDays: 3 };
      const res = await fetch(`${API_BASE}/api/crm-local/experiments/repurchase-ab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        const counts = Object.entries(data.assigned ?? {}).map(([k, v]) => `${k}: ${v}명`).join("\n");
        setExperiments((prev) => [{ experiment_key: data.experiment.experiment_key, name: data.experiment.name, status: data.experiment.status, channel: data.experiment.channel, created_at: data.experiment.created_at }, ...prev]);
        setSelectedKey(data.experiment.experiment_key);

        // 실험 생성 후 메시지 발송 탭으로 이동
        const firstConsent = candidates.find((c) => c.consentSms && c.phone);
        if (firstConsent) {
          const goToMessaging = confirm(`실험 생성 완료\n\n${counts}\n제외: ${data.excludedNoConsent ?? 0}명\n\n메시지 작성 화면으로 이동하시겠습니까?`);
          if (goToMessaging) {
            const params = new URLSearchParams();
            params.set("site", "thecleancoffee");
            params.set("tab", "messaging");
            params.set("phone", firstConsent.phone);
            params.set("name", firstConsent.name);
            params.set("channel", "sms");
            params.set("memberCode", firstConsent.memberCode);
            params.set("daysSince", String(firstConsent.daysSinceLastPurchase));
            params.set("adminOverride", "true");
            window.location.search = params.toString();
          }
        } else {
          alert(`실험 생성 완료\n\n${counts}\n제외: ${data.excludedNoConsent ?? 0}명`);
        }
      } else {
        alert(`실험 생성 실패: ${data.error}`);
      }
    } catch (err) {
      alert(`오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={styles.section} style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.5), rgba(255,255,255,0.9))", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>A/B 테스트</h2>
          <p className={styles.sectionDesc}>
            재구매 후보를 두 그룹으로 나누어 전환율을 비교한다. 발송 후 3일 뒤 구매 전환을 측정한다.
          </p>
        </div>
      </div>

      {/* 실험 유형 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TEST_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTestType(t.key)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              border: testType === t.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
              background: testType === t.key ? "#eef2ff" : "#fff",
              color: testType === t.key ? "#4f46e5" : "#64748b",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 실험 생성 */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, padding: "14px 18px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
            현재 필터: {minDays}~{maxDays}일 미구매 / {minOrders}회 이상 구매
          </div>
          <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 4 }}>
            {testType === "consent" ? (
              <>전체 대상: <strong>{withPhone.length}명</strong> (동의 {consentCount}명 / 미동의 {nonConsentCount}명)</>
            ) : (
              <>SMS 동의 대상: <strong>{consentCount}명</strong> → 각 그룹 약 {Math.floor(consentCount / 2)}명</>
            )}
          </div>
          <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>{currentType.desc}</div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || currentType.targetCount < 2}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: creating || currentType.targetCount < 2 ? "not-allowed" : "pointer",
            background: creating || currentType.targetCount < 2 ? "#94a3b8" : "#6366f1", color: "#fff", fontWeight: 600, fontSize: "0.82rem",
          }}
        >
          {creating ? "생성 중..." : "A/B 실험 생성"}
        </button>
      </div>

      {/* 기존 실험 목록 */}
      {experiments.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>실험 목록</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {experiments.map((exp) => (
              <button
                key={exp.experiment_key}
                onClick={() => setSelectedKey(exp.experiment_key)}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer",
                  border: selectedKey === exp.experiment_key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                  background: selectedKey === exp.experiment_key ? "#eef2ff" : "#fff",
                  color: selectedKey === exp.experiment_key ? "#4f46e5" : "#64748b",
                }}
              >
                {exp.name}
                <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "#94a3b8" }}>
                  {exp.created_at?.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 실험 결과 */}
      {summaryLoading && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div>}

      {summary && !summaryLoading && (
        <div>
          <div style={{ fontSize: "0.76rem", color: "#64748b", marginBottom: 4 }}>
            전환 윈도우: {summary.conversionWindowDays}일 / 상태: {summary.experiment.status}
          </div>

          {/* 그룹별 비교 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            {summary.variants.map((v, vi) => {
              const isFirst = vi === 0;
              const accent = isFirst ? "#2563eb" : "#7c3aed";
              const bg = isFirst ? "linear-gradient(180deg, #eff6ff, #fff)" : "linear-gradient(180deg, #f5f3ff, #fff)";
              const border = isFirst ? "#bfdbfe" : "#ddd6fe";
              const VARIANT_LABELS: Record<string, string> = {
                sms: "SMS", alimtalk: "알림톡",
                consent_sms: "동의 고객 (SMS)", noconsent_sms: "미동의 고객 (SMS)",
              };
              const label = VARIANT_LABELS[v.variant_key] ?? v.variant_key;
              return (
                <div key={v.variant_key} style={{ padding: 18, borderRadius: 14, background: bg, border: `1px solid ${border}` }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {isFirst ? "A" : "B"}그룹: {label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>배정</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#334155" }}>{v.assigned}명</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>발송</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: v.sent > 0 ? "#16a34a" : "#94a3b8" }}>{v.sent}건</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>구매 전환</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: accent }}>{v.purchased}건</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>전환율</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: accent }}>
                        {v.assigned > 0 ? (v.purchaseRate * 100).toFixed(1) : "0.0"}%
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.7)", fontSize: "0.76rem", color: "#475569" }}>
                    매출: {fmtKRW(Math.round(v.revenue))} / 객단가: {fmtKRW(Math.round(v.avgOrderAmount))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 실험이 있지만 아직 발송 전인 경우 안내 */}
          {summary.variants.length > 0 && summary.variants.every((v) => v.sent === 0) && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.76rem", color: "#92400e", lineHeight: 1.7 }}>
              <strong>다음 단계:</strong> 그룹 배정 완료. 알림톡 발송 탭에서 각 그룹 대상으로 메시지를 발송한 뒤, 3일 후 전환 동기화를 실행하면 결과가 여기에 표시된다.
            </div>
          )}
        </div>
      )}

      {experiments.length === 0 && !summaryLoading && (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
          아직 생성된 A/B 실험이 없다. 위 버튼으로 첫 실험을 시작할 수 있다.
        </div>
      )}
    </section>
  );
}

/* ─── 더클린커피 재구매 관리 탭 컴포넌트 ─── */
type RepurchaseCandidate = {
  memberCode: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  daysSinceLastPurchase: number;
  avgOrderAmount: number;
  consentSms: boolean;
  consentEmail: boolean;
};

function CoffeeRepurchaseTab() {
  const [candidates, setCandidates] = useState<RepurchaseCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minDays, setMinDays] = useState(30);
  const [maxDays, setMaxDays] = useState(180);
  const [minOrders, setMinOrders] = useState(1);
  const [maxOrders, setMaxOrders] = useState(9999);
  const [tableShowCount, setTableShowCount] = useState(30);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `${API_BASE}/api/crm-local/repurchase-candidates?site=thecleancoffee&minDaysSinceLastPurchase=${minDays}&maxDaysSinceLastPurchase=${maxDays}&minPurchaseCount=${minOrders}&limit=5000`,
      { signal: ac.signal },
    )
      .then((r) => { if (!r.ok) throw new Error(`API 오류 (${r.status})`); return r.json(); })
      .then((d) => {
        const all: RepurchaseCandidate[] = d.candidates ?? [];
        setCandidates(maxOrders < 9999 ? all.filter((c) => c.totalOrders <= maxOrders) : all);
      })
      .catch((err) => { if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다"); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [minDays, maxDays, minOrders, maxOrders]);

  const consentCount = candidates.filter((c) => c.consentSms).length;
  const avgDays = candidates.length > 0
    ? Math.round(candidates.reduce((s, c) => s + c.daysSinceLastPurchase, 0) / candidates.length)
    : 0;
  const totalRevenue = candidates.reduce((s, c) => s + c.totalSpent, 0);

  const handleSendToMessaging = (channel: "alimtalk" | "sms") => {
    const eligible = candidates.filter((c) => c.consentSms);
    if (eligible.length === 0) return;
    const first = eligible[0]!;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "messaging");
    params.set("phone", first.phone);
    params.set("name", first.name);
    params.set("channel", channel);
    params.set("memberCode", first.memberCode);
    params.set("daysSince", String(first.daysSinceLastPurchase));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>재구매 관리</h2>
            <p className={styles.sectionDesc}>
              첫 구매 후 재구매하지 않은 고객을 찾아 알림톡 등으로 재방문을 유도한다.
            </p>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>마지막 구매 후 최소 경과일</label>
              <select className={styles.controlSelect} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))}>
                {[0, 7, 14, 30, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d === 0 ? "제한 없음" : `${d}일`}</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>마지막 구매 후 최대 경과일</label>
              <select className={styles.controlSelect} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))}>
                {[90, 180, 365, 730, 9999].map((d) => <option key={d} value={d}>{d >= 9999 ? "제한 없음" : `${d}일`}</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>최소 구매 횟수 (이 횟수 이상 산 고객)</label>
              <select className={styles.controlSelect} value={minOrders} onChange={(e) => setMinOrders(Number(e.target.value))}>
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}회 이상</option>)}
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>최대 구매 횟수 (이 횟수 이하만)</label>
              <select className={styles.controlSelect} value={maxOrders} onChange={(e) => setMaxOrders(Number(e.target.value))}>
                {[1, 2, 3, 5, 10, 9999].map((n) => <option key={n} value={n}>{n >= 9999 ? "제한 없음" : `${n}회 이하`}</option>)}
              </select>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.5 }}>
            예: 경과일 30~180일 + 구매 1~2회 = "1~2번 사고 1~6개월째 안 사는 고객" (이탈 위험 고객)
          </p>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>재구매 후보를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* KPI 카드 */}
            <div className={styles.summaryGrid}>
              <SummaryCard label="재구매 후보" value={`${fmtNum(candidates.length)}명`} sub={`${minDays}~${maxDays}일 미구매`} />
              <SummaryCard label="발송 가능" value={`${fmtNum(consentCount)}명`} sub="SMS 동의 고객" tone={consentCount > 0 ? "success" : "warn"} />
              <SummaryCard label="평균 미구매일" value={`${avgDays}일`} sub="마지막 구매 후 경과" />
              <SummaryCard label="후보 누적 매출" value={fmtKRW(totalRevenue)} sub={`평균 ${fmtKRW(candidates.length > 0 ? Math.round(totalRevenue / candidates.length) : 0)}/명`} />
            </div>

            {/* 후보 테이블 */}
            {candidates.length === 0 ? (
              <div className={styles.empty}>해당 조건의 재구매 후보가 없습니다.</div>
            ) : (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>고객번호</th>
                      <th>고객명</th>
                      <th>연락처</th>
                      <th className={styles.tableCellRight}>구매 횟수</th>
                      <th className={styles.tableCellRight}>총 매출</th>
                      <th>마지막 구매</th>
                      <th className={styles.tableCellRight}>미구매일</th>
                      <th>SMS 동의</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, tableShowCount).map((c) => (
                      <tr key={c.memberCode} className={styles.tableRow}>
                        <td style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace" }}>{c.memberCode}</td>
                        <td><strong>{c.name || "-"}</strong></td>
                        <td className={styles.phone}>{c.phone}</td>
                        <td className={styles.tableCellRight}>{c.totalOrders}회</td>
                        <td className={styles.tableCellRight}>{fmtKRW(c.totalSpent)}</td>
                        <td>{fmtDate(c.lastOrderDate)}</td>
                        <td className={styles.tableCellRight} style={{
                          color: c.daysSinceLastPurchase > 90 ? "var(--color-danger)" : c.daysSinceLastPurchase > 60 ? "var(--color-accent)" : "var(--color-text-primary)",
                          fontWeight: 600,
                        }}>
                          {c.daysSinceLastPurchase}일
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${c.consentSms ? styles.statusCompleted : styles.statusOther}`}>
                            {c.consentSms ? "동의" : "미동의"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {candidates.length > tableShowCount ? (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <button type="button" onClick={() => setTableShowCount((p) => p + 50)} className={styles.retryButton} style={{ fontSize: "0.78rem" }}>
                      더 보기 ({fmtNum(tableShowCount)}/{fmtNum(candidates.length)}명 표시 중)
                    </button>
                  </div>
                ) : candidates.length > 30 ? (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <button type="button" onClick={() => setTableShowCount(30)} className={styles.retryButton} style={{ fontSize: "0.78rem" }}>
                      접기 (전체 {fmtNum(candidates.length)}명)
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* 발송 연결 버튼 */}
            {candidates.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={styles.retryButton}
                    style={{ background: "var(--color-primary)", color: "#fff", border: "none" }}
                    onClick={() => handleSendToMessaging("alimtalk")}
                  >
                    카카오 알림톡 발송 ({consentCount}명) →
                  </button>
                  <button
                    type="button"
                    className={styles.retryButton}
                    style={{ background: "#6366f1", color: "#fff", border: "none" }}
                    onClick={() => handleSendToMessaging("sms")}
                  >
                    SMS 문자 발송 ({consentCount}명) →
                  </button>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                    SMS 동의 고객만 대상. 알림톡 실패 시 SMS fallback 권장.
                  </span>
                </div>

                {/* 관리자 override — 미동의 고객 포함 발송 */}
                {candidates.length > consentCount && (
                  <div style={{
                    padding: "12px 16px", borderRadius: 10,
                    background: "#fffbeb", border: "1px solid #fde68a",
                    display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "0.78rem", color: "#92400e", fontWeight: 600 }}>
                      미동의 고객 {candidates.length - consentCount}명 포함 전체 발송 (관리자 권한)
                    </span>
                    <button
                      type="button"
                      className={styles.retryButton}
                      style={{ background: "#d97706", color: "#fff", border: "none", fontSize: "0.78rem", padding: "8px 14px" }}
                      onClick={() => {
                        const first = candidates[0]!;
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("tab", "messaging");
                        params.set("phone", first.phone);
                        params.set("name", first.name ?? "");
                        params.set("channel", "alimtalk");
                        params.set("adminOverride", "true");
                        router.replace(`?${params.toString()}`, { scroll: false });
                      }}
                    >
                      전체 알림톡 ({candidates.length}명, 관리자) →
                    </button>
                    <button
                      type="button"
                      className={styles.retryButton}
                      style={{ background: "#92400e", color: "#fff", border: "none", fontSize: "0.78rem", padding: "8px 14px" }}
                      onClick={() => {
                        const first = candidates[0]!;
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("tab", "messaging");
                        params.set("phone", first.phone);
                        params.set("name", first.name ?? "");
                        params.set("channel", "sms");
                        params.set("adminOverride", "true");
                        router.replace(`?${params.toString()}`, { scroll: false });
                      }}
                    >
                      전체 SMS ({candidates.length}명, 관리자) →
                    </button>
                    <span style={{ fontSize: "0.68rem", color: "#b45309" }}>
                      정보성 메시지만 가능. 홍보성은 동의 고객만 발송 가능.
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* A/B 테스트 */}
      <CoffeeAbTestSection minDays={minDays} maxDays={maxDays} minOrders={minOrders} candidates={candidates} />

      {/* 동의/미동의 전환율 가설 */}
      {candidates.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>전환율 가설 — 동의 고객 vs 미동의 고객</h2>
              <p className={styles.sectionDesc}>
                발송 후 결과 분석 시, 아래 가설을 기준으로 동의/미동의 그룹의 전환율을 비교한다.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* 동의 고객 */}
            <div style={{ padding: 18, borderRadius: 14, background: "linear-gradient(180deg, #f0fdf4, #fff)", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>SMS 동의 고객</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#15803d", marginTop: 8 }}>{fmtNum(consentCount)}명</div>
              <div style={{ marginTop: 12, fontSize: "0.82rem", lineHeight: 1.7, color: "#166534" }}>
                <div><strong>예상 전환율: 15~25%</strong></div>
                <div style={{ fontSize: "0.76rem", color: "#4ade80", marginTop: 4 }}>
                  근거: 마케팅 수신에 동의한 고객은 브랜드 호감도가 높고, 아임웹 장바구니 캠페인에서도 동의 고객 구매 전환율 25% 확인됨.
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#dcfce7", fontSize: "0.76rem", color: "#166534" }}>
                예상 매출: {fmtKRW(Math.round(consentCount * 0.20 * (totalRevenue / (candidates.length || 1))))}
                <span style={{ fontSize: "0.68rem", marginLeft: 4 }}>(전환 20% × 평균 {fmtKRW(Math.round(totalRevenue / (candidates.length || 1)))})</span>
              </div>
            </div>

            {/* 미동의 고객 */}
            <div style={{ padding: 18, borderRadius: 14, background: "linear-gradient(180deg, #fffbeb, #fff)", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>SMS 미동의 고객 (관리자 발송)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#92400e", marginTop: 8 }}>{fmtNum(candidates.length - consentCount)}명</div>
              <div style={{ marginTop: 12, fontSize: "0.82rem", lineHeight: 1.7, color: "#78350f" }}>
                <div><strong>예상 전환율: 5~10%</strong></div>
                <div style={{ fontSize: "0.76rem", color: "#d97706", marginTop: 4 }}>
                  근거: 마케팅 수신을 거부한 고객은 브랜드 이탈 가능성이 높음. 다만 정보성 메시지(상품 입고 안내 등)는 법적으로 발송 가능하며, 재구매 의향이 완전히 0은 아님.
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fef3c7", fontSize: "0.76rem", color: "#92400e" }}>
                예상 매출: {fmtKRW(Math.round((candidates.length - consentCount) * 0.07 * (totalRevenue / (candidates.length || 1))))}
                <span style={{ fontSize: "0.68rem", marginLeft: 4 }}>(전환 7% × 평균 {fmtKRW(Math.round(totalRevenue / (candidates.length || 1)))})</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#f1f5f9", fontSize: "0.76rem", color: "#64748b", lineHeight: 1.7 }}>
            <strong>분석 방법:</strong> 발송 후 7~14일 뒤, 발송 로그(aligo-sends.jsonl)의 <code>consentStatus</code> 필드와 주문 데이터를 조인하여 동의/미동의 그룹별 구매 전환율을 비교한다. 발송 로그에 동의 상태가 자동 기록됨.
          </div>
        </section>
      )}

      {/* 경과일 구간별 전환율 가설 */}
      {candidates.length > 0 && (() => {
        const buckets = [
          { label: "30~60일", min: 30, max: 60, rate: "18~25%", rateMid: 0.22, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", reason: "최근 구매 기억이 생생. 재구매 의향 가장 높음" },
          { label: "61~90일", min: 61, max: 90, rate: "10~18%", rateMid: 0.14, color: "#d97706", bg: "#fffbeb", border: "#fde68a", reason: "구매 습관이 약해지는 시점. 리마인드 효과 큼" },
          { label: "91~180일", min: 91, max: 180, rate: "5~10%", rateMid: 0.07, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", reason: "이탈 위험 구간. 쿠폰/할인 없으면 복구 어려움" },
        ];
        const avgSpent = candidates.length > 0 ? totalRevenue / candidates.length : 0;
        return (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>전환율 가설 — 마지막 구매 경과일별</h2>
                <p className={styles.sectionDesc}>
                  최근 구매한 고객일수록 전환율이 높을 것이다. 발송 후 구간별 실제 전환율과 비교한다.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {buckets.map((b) => {
                const count = candidates.filter((c) => c.daysSinceLastPurchase >= b.min && c.daysSinceLastPurchase <= b.max).length;
                const consentInBucket = candidates.filter((c) => c.daysSinceLastPurchase >= b.min && c.daysSinceLastPurchase <= b.max && c.consentSms).length;
                return (
                  <div key={b.label} style={{ padding: 16, borderRadius: 14, background: b.bg, border: `1px solid ${b.border}` }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: b.color, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      마지막 구매 {b.label} 전
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: b.color, marginTop: 6 }}>{fmtNum(count)}명</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>동의 {consentInBucket}명</div>
                    <div style={{ marginTop: 10, fontSize: "0.82rem", fontWeight: 700, color: b.color }}>예상 전환율: {b.rate}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>{b.reason}</div>
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.7)", fontSize: "0.72rem", color: b.color }}>
                      예상 매출: {fmtKRW(Math.round(count * b.rateMid * avgSpent))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, background: "#f1f5f9", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5 }}>
              <strong>결과 비교 방법:</strong> 발송 로그에 각 고객의 <code>daysSinceLastPurchase</code>가 기록됨.
              발송 후 14일 뒤, 경과일 구간별 구매 전환율을 산출하여 위 가설과 비교한다.
            </div>
          </section>
        );
      })()}

      {/* 생일 쿠폰 검토 */}
      <section className={styles.section} style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.5), rgba(255,255,255,0.9))", border: "1px solid rgba(99,102,241,0.15)" }}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>생일 축하 쿠폰 — 검토 결과</h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
          <span style={{ fontSize: "1.2rem", padding: "8px 12px", borderRadius: 10, background: "#fef3c7" }}>
            {"⚠️"}
          </span>
          <div style={{ fontSize: "0.84rem", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
            <strong style={{ color: "#dc2626" }}>더클린커피 생일 쿠폰: 현재 불가</strong>
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <strong>문제:</strong> 더클린커피 회원 13,253명 중 <strong>생일 입력자 1명 (0.0%)</strong>.
              회원가입 시 생일 입력을 요구하지 않아서 데이터가 없음.
              <br /><span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>참고: 바이오컴은 검사키트 구매 시 생일 필수라 94% 입력됨 (65,714명).</span>
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
              <strong>생일 쿠폰을 하려면:</strong>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                <li><strong>선행 조건:</strong> 아임웹 회원가입 폼에 생일 필드 추가 (필수 또는 권장)</li>
                <li><strong>단기:</strong> "생일을 알려주시면 특별 쿠폰을 드립니다" 캠페인으로 기존 회원 생일 수집</li>
                <li><strong>장기:</strong> 생일 입력률이 30% 이상이 되면 생일 쿠폰 자동화 시작</li>
              </ul>
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <strong>바이오컴은 즉시 가능:</strong> 65,714명 생일 보유. 이번 달 생일 고객에게 쿠폰 발급 + 알림톡 발송 가능.
              <br /><span style={{ fontSize: "0.76rem", color: "#16a34a" }}>API: <code>GET /api/crm-local/birthday-members?site=biocom&month=4</code></span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.interpretBlock}>
        <strong>더클린커피 재구매 관리가 왜 중요한가?</strong>
        <p>
          재구매 고객은 1회 구매자보다 평균 2.3배 더 쓴다.
          상담 서비스가 없는 더클린커피에서는 주문 데이터 기반 재구매 유도가 핵심 CRM 전략이다.
        </p>
      </section>
    </>
  );
}

/* ─── 전체: 사이트 비교 탭 컴포넌트 ─── */
function SiteComparisonTab() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>사이트별 핵심 지표 비교</h2>
          <p className={styles.sectionDesc}>
            바이오컴, 더클린커피, AIBIO의 현황을 한 눈에 비교한다.
          </p>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th>지표</th>
              <th className={styles.tableCellRight}>바이오컴</th>
              <th className={styles.tableCellRight}>더클린커피</th>
              <th className={styles.tableCellRight}>AIBIO</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.tableRow}>
              <td><strong>회원 수</strong></td>
              <td className={styles.tableCellRight}>69,681명</td>
              <td className={styles.tableCellRight}>13,236명</td>
              <td className={styles.tableCellRight}>100명</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>비즈니스 모델</strong></td>
              <td className={styles.tableCellRight}>검사 → 상담 → 영양제</td>
              <td className={styles.tableCellRight}>스페셜티 커피 판매</td>
              <td className={styles.tableCellRight}>바이오해킹 체험</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>SMS 수신 동의</strong></td>
              <td className={styles.tableCellRight}>47.5%</td>
              <td className={styles.tableCellRight}>확인 필요</td>
              <td className={styles.tableCellRight}>-</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>상담 서비스</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>있음 (8,305건)</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>없음</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>없음</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>Meta 광고</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>미집행</td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>집행 중 (A+SC 2개)</td>
              <td className={styles.tableCellRight} style={{ color: "#6366f1", fontWeight: 600 }}>₩148만/월</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>결제 추적</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>Toss live</td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>live 3건</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>대기 중</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>CRM 핵심 시나리오</strong></td>
              <td className={styles.tableCellRight}>상담 후 미구매 후속</td>
              <td className={styles.tableCellRight}>재구매 유도</td>
              <td className={styles.tableCellRight}>광고 유입 → 방문 전환</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className={styles.interpretBlock} style={{ marginTop: 18 }}>
        <strong>사이트별로 CRM 전략이 다르다</strong>
        <p>
          바이오컴은 상담 기반(상담 → 후속 → 재구매), 더클린커피는 커머스 기반(구매 → 재구매),
          AIBIO는 광고 기반(광고 → 리드 → 방문)이다. 각 사이트 탭을 클릭하면 해당 전략에 맞는 화면을 본다.
        </p>
      </section>
    </section>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center" }}>로딩 중...</div>}>
      <CrmPageInner />
    </Suspense>
  );
}
