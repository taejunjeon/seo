"use client";

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

const TABS = [
  {
    value: "consultation",
    label: "후속 관리",
    desc: "상담 완료/부재 후 바로 액션할 대상을 본다",
  },
  {
    value: "experiments",
    label: "실험 운영",
    desc: "실험 생성/배정/전환 결과를 본다",
  },
  {
    value: "messaging",
    label: "알림톡 발송",
    desc: "알리고 알림톡 대상 선택 · 템플릿 · 발송",
  },
  {
    value: "attribution",
    label: "결제 추적",
    desc: "어디서 유입되어 결제했는지 추적하고 토스 승인과 대조한다",
  },
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
  const validTabs = TABS.map((t) => t.value);
  const tabParam = searchParams.get("tab") ?? "consultation";
  const tab = validTabs.includes(tabParam as (typeof TABS)[number]["value"])
    ? (tabParam as (typeof TABS)[number]["value"])
    : "consultation";
  const setTab = useCallback((newTab: (typeof TABS)[number]["value"], extra?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (extra) { for (const [k, v] of Object.entries(extra)) params.set(k, v); }
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
        const items = Array.isArray(d) ? d : d?.data ?? d?.items ?? d?.managers ?? null;
        setManagersData(Array.isArray(items) ? items : null);
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
        const items = Array.isArray(d) ? d : d?.data ?? d?.items ?? d?.matches ?? null;
        setOrderMatchData(Array.isArray(items) ? items : null);
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
            <span>후속 관리 대상에게 바로 연락 가능</span>
            <span>실험 결과는 로컬 검증 모드 (실발송 전)</span>
            <span>결제 추적 진단은 live 연결 후 확정</span>
            <span>알림톡 발송은 화이트리스트 대상만</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <div className={styles.tabSelector}>
            {TABS.map((item) => (
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
                    <SummaryCard label="배정" value={`${fmtNum(localData.stats.assignments)}건`} sub="control + treatment" />
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
                            표본 부족 (variant 최소 {minVariantSize}명) — 의사결정을 위한 수치 보완 권장
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
                              sub="treatment - control"
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
                            <h3 className={styles.panelTitle}>Variant 비교 차트</h3>
                            <p className={styles.sectionDesc} style={{ marginBottom: 12 }}>
                              순매출과 구매율을 한 번에 본다. 지금 단계는 uplift 확정이 아니라 배선과 방향을 읽는 용도다.
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
                            <h3 className={styles.panelTitle}>Variant 성과</h3>
                            <div className={styles.tableScroll}>
                              <table className={styles.table}>
                                <thead>
                                  <tr className={styles.tableHead}>
                                    <th>Variant</th>
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
                                      <th>customer_key</th>
                                      <th>variant</th>
                                      <th>assigned_at</th>
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
                      sub="revenue backend에서 보이는 experiment 목록"
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
                          <h3 className={styles.panelTitle}>증분 효과 (treatment vs control)</h3>
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
                              sub="treatment 인당 순매출 - control 인당 순매출"
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
                        <h3 className={styles.panelTitle}>Variant 성과</h3>
                        <div className={styles.tableScroll}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHead}>
                                <th>Variant</th>
                                <th className={styles.tableCellRight}>Assignment</th>
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
                        <h3 className={styles.panelTitle}>최근 Assignment 샘플</h3>
                        {selectedAssignments?.items.length ? (
                          <div className={styles.tableScroll}>
                            <table className={styles.table}>
                              <thead>
                                <tr className={styles.tableHead}>
                                  <th>customer_key</th>
                                  <th>variant</th>
                                  <th className={styles.tableCellRight}>순매출</th>
                                  <th>assigned_at</th>
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
                          <div className={styles.empty}>assignment 샘플이 아직 없습니다.</div>
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
              <strong>이 탭은 관제실 모니터다.</strong>
              <p>
                `P1-S1`이 채점표라면 여기는 그 채점표를 운영자가 읽는 자리다. 아직 revenue bridge 토큰이
                없으면 실제 점수판을 못 읽지만, 어디서 막히는지는 화면에서 바로 드러나게 했다.
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
                  <h2 className={styles.sectionTitle}>P1-S1A 결제 추적 진단</h2>
                  <p className={styles.sectionDesc}>
                    GA4 `(not set)`, 토스 승인, receiver row를 날짜별로 같은 표에 올려둔다.
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
                      ? `오늘 blocker: live payment_success ${liveCount}건 → 실제 고객 사이트 receiver 연결 필요`
                      : `live ${liveCount}건 수집 중 (replay ${replayCount}건)`;
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
                      label="ledger row"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.totalEntries)}
                      sub={`live ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.live)} / replay ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.replay)} / smoke ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.smoke)}`}
                      tone={phase1Data.p1s1a.ledgerSummary.totalEntries > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="live payment_success"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live)}
                      sub="실제 고객 사이트 receiver 기준"
                      tone={phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="replay payment_success"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.replay)}
                      sub="read-only 운영 DB backfill 기준"
                    />
                    <SummaryCard
                      label="smoke payment_success"
                      value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.smoke)}
                      sub="더미 receiver 점검 row"
                    />
                    <SummaryCard
                      label="live 토스 조인율"
                      value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate)}
                      sub={`matched ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.matchedTossRows)} / ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}`}
                      tone={phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate > 0 ? "success" : "warn"}
                    />
                    <SummaryCard
                      label="replay 토스 조인율"
                      value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.joinCoverageRate)}
                      sub={`matched ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.matchedTossRows)} / ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}`}
                    />
                    <SummaryCard
                      label="GA4 (not set) 매출"
                      value={fmtKRW(phase1Data.p1s1a.ga4NotSetTotals?.grossPurchaseRevenue ?? 0)}
                      sub={`구매 ${fmtNum(phase1Data.p1s1a.ga4NotSetTotals?.ecommercePurchases ?? 0)}건`}
                    />
                    <SummaryCard
                      label="(not set) 랜딩 비율"
                      value={fmtRatio(phase1Data.p1s1a.ga4Diagnosis?.dataQualitySignals.notSetLandingRatio ?? 0)}
                      sub="첫 page_view 누락 가능성"
                    />
                  </div>

                  <div className={styles.warningBox} style={{ marginTop: 18 }}>
                    <strong>해석 규칙</strong>
                    <ul className={styles.flatList}>
                      <li>`live`는 실제 고객 사이트 receiver가 남긴 row입니다.</li>
                      <li>`replay`는 read-only 운영 DB `tb_sales_toss`를 다시 읽어 넣은 점검 row입니다.</li>
                      <li>`smoke`는 더미 payload로 receiver 자체를 확인한 row입니다.</li>
                    </ul>
                  </div>

                  {/* 날짜별 추이 차트 */}
                  {phase1Data.p1s1a.timeline.length > 0 && (
                    <div className={styles.panel}>
                      <h3 className={styles.panelTitle}>날짜별 추이 차트</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={phase1Data.p1s1a.timeline.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="ga4NotSetPurchases" fill="var(--color-danger)" name="GA4 (not set) 구매" />
                          <Bar dataKey="tossApprovalCount" fill="var(--color-info)" name="토스 승인" />
                          <Bar dataKey="livePaymentSuccessEntries" fill="var(--color-success)" name="live payment_success" />
                          <Bar dataKey="replayPaymentSuccessEntries" fill="#f59e0b" name="replay payment_success" />
                          <Bar dataKey="smokePaymentSuccessEntries" fill="#6b7280" name="smoke payment_success" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className={styles.panel}>
                    <h3 className={styles.panelTitle}>날짜별 비교표</h3>
                    <div className={styles.tableScroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr className={styles.tableHead}>
                            <th>날짜</th>
                            <th className={styles.tableCellRight}>GA4 (not set) 구매</th>
                            <th className={styles.tableCellRight}>GA4 (not set) 매출</th>
                            <th className={styles.tableCellRight}>토스 승인</th>
                            <th className={styles.tableCellRight}>토스 승인액</th>
                            <th className={styles.tableCellRight}>live row</th>
                            <th className={styles.tableCellRight}>replay row</th>
                            <th className={styles.tableCellRight}>smoke row</th>
                            <th className={styles.tableCellRight}>checkout row</th>
                            <th>진단 라벨</th>
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
              <strong>이 탭은 블랙박스 판독기다.</strong>
              <p>
                아직 `(not set)=PG 직결`로 확정할 수는 없다. 그래서 같은 날짜에 `GA4 not set`,
                `토스 승인`, `live / replay / smoke receiver row`를 나란히 놓고, 비어 있는 고리가 실제 live인지
                아니면 replay로만 보이는지 먼저 가르게 만들었다.
              </p>
            </section>
          </>
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
