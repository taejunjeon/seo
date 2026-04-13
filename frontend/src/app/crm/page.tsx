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
import { API_BASE, fmtDate, fmtDateTime, fmtNum, fmtKRW, fmtPct, fmtRatio } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";
import { AibioAdsTab } from "./AibioAdsTab";
import { CoffeeOrdersTab } from "./CoffeeOrdersTab";
import { SiteComparisonTab } from "./SiteComparisonTab";
import { CustomersTab } from "./CustomersTab";
import { BehaviorTab } from "./BehaviorTab";
import { CustomerGroupsTab } from "./CustomerGroupsTab";
import { CoffeeRepurchaseTab } from "./CoffeeRepurchaseTab";
import { ConsentAuditTab } from "./ConsentAuditTab";
import { ConsultationSection } from "./ConsultationSection";
import { AttributionTrackingSection } from "./AttributionTrackingSection";
import { ErrorBoundary } from "./ErrorBoundary";

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
  customers: { value: "customers", label: "고객 목록", desc: "전체 고객 검색과 등급/그룹 관리" },
  behavior: { value: "behavior", label: "고객 행동", desc: "행동 조건으로 고객 그룹을 자동 생성합니다" },
  consent: { value: "consent", label: "수신거부 처리", desc: "고객이 수신거부를 요청했을 때 여기서 처리하고 이력을 남깁니다" },
};

const SITE_TABS: Record<SiteValue, TabItem[]> = {
  all: [ALL_TABS.comparison!, ALL_TABS.experiments!, ALL_TABS.messaging!, ALL_TABS.attribution!],
  biocom: [ALL_TABS.consultation!, ALL_TABS.experiments!, ALL_TABS.messaging!, ALL_TABS.attribution!],
  thecleancoffee: [ALL_TABS.orders!, ALL_TABS.repurchase!, ALL_TABS.groups!, ALL_TABS.customers!, ALL_TABS.behavior!, ALL_TABS.messaging!, ALL_TABS.attribution!, ALL_TABS.consent!],
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
          <ErrorBoundary label="상담 후속">
            <ConsultationSection
              candidateData={candidateData}
              candidateLoading={candidateLoading}
              candidateError={candidateError}
              managersData={managersData}
              managersLoading={managersLoading}
              managersError={managersError}
              orderMatchData={orderMatchData}
              orderMatchLoading={orderMatchLoading}
              orderMatchError={orderMatchError}
              consultSummary={consultSummary}
              scenario={scenario}
              setScenario={setScenario}
              limit={limit}
              setLimit={setLimit}
              scenarios={SCENARIOS}
              currentScenario={currentScenario}
              actionLabels={ACTION_LABELS}
              statusLabels={STATUS_LABELS}
              onSendMessage={(phone, name) => setTab("messaging", { phone, name })}
            />
          </ErrorBoundary>
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
          <ErrorBoundary label="결제 추적">
            <AttributionTrackingSection
              phase1Data={phase1Data}
              phase1Loading={phase1Loading}
              phase1Error={phase1Error}
              reloadPhase1={reloadPhase1}
            />
          </ErrorBoundary>
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

        {/* ── 고객 목록 탭 ── */}
        {tab === "customers" ? <CustomersTab /> : null}

        {/* ── 고객 행동 탭 ── */}
        {tab === "behavior" ? <BehaviorTab /> : null}

        {/* ── 동의 감사 로그 탭 ── */}
        {tab === "consent" ? <ConsentAuditTab /> : null}

        {/* ── 전체: 사이트 비교 탭 ── */}
        {tab === "comparison" ? (
          <SiteComparisonTab />
        ) : null}
      </main>
    </div>
  );
}


export default function CrmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center" }}>로딩 중...</div>}>
      <CrmPageInner />
    </Suspense>
  );
}
