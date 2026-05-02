"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AIBIO_NATIVE_API_BASE } from "@/lib/aibio-native";

const ADMIN_TOKEN_STORAGE_KEY = "aibio-native-admin-token";
const OPERATOR_ID_STORAGE_KEY = "aibio-contact-operator-id";

type EnumOption = { value: string; label: string };
type EnumsResponse = {
  ok: boolean;
  enums: {
    statuses: EnumOption[];
    channels: EnumOption[];
    directions: EnumOption[];
    outcomes: EnumOption[];
    reactions: EnumOption[];
    temperatures: EnumOption[];
    nextActions: EnumOption[];
    bucketLabels: Record<string, string>;
  };
};

type SummaryResponse = {
  ok: boolean;
  summary: {
    generatedAt: string;
    rangeDays: number;
    window: { startAt: string; endAt: string };
    totals: { leads: number; events: number; operators: number };
    buckets: Record<string, number>;
    byStatus: Record<string, number>;
    kpis: {
      firstContactRateWithin24h: number | null;
      contactCoverageRate: number | null;
      reservedRate: number | null;
      visitedRate: number | null;
      paidRate: number | null;
      medianMinutesToFirstContact: number | null;
    };
    crm?: CrmPayload;
  };
};

type CrmMatch = {
  matched: boolean;
  matchBlocker: string | null;
  customerId: number | null;
  confidence: "high" | "medium" | "low";
  customer: {
    createdDate: string | null;
    firstVisitDate: string | null;
    lastVisitDate: string | null;
    totalVisits: number;
    totalRevenue: number;
    status: string | null;
    isRegistered: boolean;
    referralSource: string | null;
  } | null;
  lead: {
    leadDate: string | null;
    leadChannel: string | null;
    dbChannel: string | null;
    dbEntryDate: string | null;
    phoneConsultDate: string | null;
    visitConsultDate: string | null;
    registrationDate: string | null;
    status: string | null;
    revenue: number;
  } | null;
  reservations: { total: number; byStatus: Record<string, number>; firstDate: string | null; lastDate: string | null };
  productUsage: { total: number; completed: number; firstDate: string | null; lastDate: string | null };
  payments: {
    total: number;
    positiveCount: number;
    grossRevenue: number;
    netRevenue: number;
    firstDate: string | null;
    lastDate: string | null;
  };
};

type CrmPayload = {
  source: string;
  generatedAt: string;
  freshness: { latestCustomerSyncedAt: string | null; latestPaymentSyncedAt: string | null };
  warnings: string[];
  summary: {
    requestedPhoneHashes: number;
    matchedCustomers: number;
    reservationCustomers: number;
    productUsageCustomers: number;
    paymentCustomers: number;
    grossRevenue: number;
    netRevenue: number;
    confidence: "high" | "medium" | "low";
  };
};

type DashboardLead = {
  leadId: string;
  status: string;
  statusLabel: string;
  formSubmittedAt: string;
  statusUpdatedAt: string;
  maskedName: string;
  maskedPhone: string;
  customerName?: string | null;
  customerPhone?: string | null;
  ageRange: string;
  purpose: string;
  preferredTime: string;
  source: string;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null };
  hasAdKey: boolean;
  assignedTo: string | null;
  operatorMemo: string | null;
  reservationAt: string | null;
  visitAt: string | null;
  paymentAt: string | null;
  paymentAmount: number | null;
  attemptCount: number;
  lastContactAt: string | null;
  lastContactOutcome: string | null;
  lastContactOutcomeLabel: string | null;
  lastCustomerReaction: string | null;
  lastCustomerReactionLabel: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  nextActionLabel: string | null;
  isDuplicate: boolean;
  priorityScore: number;
  crm: CrmMatch | null;
};

type LeadsResponse = {
  ok: boolean;
  total: number;
  filteredTotal: number;
  revealed?: boolean;
  leads: DashboardLead[];
  crm?: CrmPayload;
};

type ContactEvent = {
  eventId: string;
  leadId: string;
  occurredAt: string;
  operatorId: string;
  channel: string;
  channelLabel: string;
  direction: string;
  attemptNo: number;
  outcome: string;
  outcomeLabel: string;
  customerReaction: string | null;
  customerReactionLabel: string | null;
  customerTemperature: string | null;
  note: string;
  nextAction: string | null;
  nextActionLabel: string | null;
  nextActionAt: string | null;
  reservationAt: string | null;
  excludedReason: string | null;
  createdAt: string;
};

type DetailResponse = {
  ok: boolean;
  revealed?: boolean;
  lead: DashboardLead;
  crm?: CrmPayload;
  events: ContactEvent[];
  tasks: Array<{
    taskId: string;
    leadId: string;
    ownerId: string;
    taskType: string;
    dueAt: string;
    status: string;
    completedAt: string | null;
    reason: string;
  }>;
};

type ContactRevealResponse = {
  ok: boolean;
  contact?: { leadId: string; name: string; phone: string; phoneHashSha256: string };
  error?: string;
  message?: string;
};

const BUCKETS = [
  { key: "new", tone: "blue" },
  { key: "today_action", tone: "amber" },
  { key: "no_answer_2plus", tone: "rose" },
  { key: "reserved", tone: "violet" },
  { key: "visited", tone: "green" },
  { key: "sla_overdue", tone: "red" },
] as const;

const PURPOSE_LABEL: Record<string, string> = {
  metabolism: "대사/붓기 관리",
  appetite: "식욕 조절",
  recovery: "회복/컨디션",
  program: "프로그램 상담",
};

const PREFERRED_TIME_LABEL: Record<string, string> = {
  morning: "오전",
  afternoon: "오후",
  evening: "저녁",
};

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtRelative = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "-";
  const m = Math.round(ms / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return `${d}일 전`;
};

const fmtRate = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);

const fmtCurrency = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `₩${Math.round(value).toLocaleString("ko-KR")}` : "-";

const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromLocalInput = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

type EventDraft = {
  channel: string;
  direction: string;
  outcome: string;
  customerReaction: string;
  customerTemperature: string;
  note: string;
  nextAction: string;
  nextActionAt: string;
  reservationAt: string;
  excludedReason: string;
};

const emptyDraft: EventDraft = {
  channel: "phone",
  direction: "outbound",
  outcome: "",
  customerReaction: "",
  customerTemperature: "",
  note: "",
  nextAction: "",
  nextActionAt: "",
  reservationAt: "",
  excludedReason: "",
};

export function ContactDashboard() {
  const [enums, setEnums] = useState<EnumsResponse["enums"] | null>(null);
  const [summary, setSummary] = useState<SummaryResponse["summary"] | null>(null);
  const [leads, setLeads] = useState<DashboardLead[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const [adminToken, setAdminToken] = useState("");
  const [adminTokenDraft, setAdminTokenDraft] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdminToken(window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "");
    setOperatorId(window.localStorage.getItem(OPERATOR_ID_STORAGE_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (!operatorId) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OPERATOR_ID_STORAGE_KEY, operatorId);
  }, [operatorId]);

  useEffect(() => {
    let alive = true;
    void fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/enums`, { cache: "no-store" })
      .then((r) => r.json() as Promise<EnumsResponse>)
      .then((body) => {
        if (alive && body.ok) setEnums(body.enums);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/summary?rangeDays=${rangeDays}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as SummaryResponse;
      if (body.ok) setSummary(body.summary);
    } catch {
      /* swallow */
    }
  }, [rangeDays]);

  const loadLeads = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (bucketFilter) params.set("bucket", bucketFilter);
      if (search) params.set("search", search);
      if (adminToken) params.set("reveal", "true");
      const res = await fetch(
        `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/leads?${params.toString()}`,
        {
          cache: "no-store",
          headers: {
            ...(adminToken ? { "x-admin-token": adminToken } : {}),
            ...(adminToken && operatorId ? { "x-operator-id": operatorId } : {}),
          },
        },
      );
      const body = (await res.json()) as LeadsResponse;
      if (body.ok) {
        setLeads(body.leads);
        setFilteredTotal(body.filteredTotal);
      }
    } catch {
      /* swallow */
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, bucketFilter, search, adminToken, operatorId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const loadDetail = useCallback(async (leadId: string) => {
    try {
      const url = adminToken
        ? `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/leads/${encodeURIComponent(leadId)}?reveal=true`
        : `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/leads/${encodeURIComponent(leadId)}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
          ...(adminToken && operatorId ? { "x-operator-id": operatorId } : {}),
        },
      });
      const body = (await res.json()) as DetailResponse;
      if (body.ok) setDetail(body);
    } catch {
      /* swallow */
    }
  }, [adminToken, operatorId]);

  useEffect(() => {
    if (!selectedLeadId) {
      setDetail(null);
      setRevealedPhone(null);
      setRevealedName(null);
      setRevealError("");
      setDraft(emptyDraft);
      setSubmitState("idle");
      setSubmitMessage("");
      return;
    }
    void loadDetail(selectedLeadId);
  }, [selectedLeadId, loadDetail]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const saveAdminToken = () => {
    const next = adminTokenDraft.trim();
    setAdminToken(next);
    if (typeof window === "undefined") return;
    if (next) window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, next);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminTokenDraft("");
  };

  const clearAdminToken = () => {
    setAdminToken("");
    if (typeof window !== "undefined") window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  };

  const revealContact = async () => {
    if (!selectedLeadId) return;
    if (!adminToken) {
      setRevealError("관리자 토큰을 먼저 저장해 주세요.");
      return;
    }
    setRevealing(true);
    setRevealError("");
    try {
      const res = await fetch(
        `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/leads/${encodeURIComponent(selectedLeadId)}/contact`,
        {
          cache: "no-store",
          headers: {
            "x-admin-token": adminToken,
            ...(operatorId ? { "x-operator-id": operatorId } : {}),
          },
        },
      );
      const body = (await res.json()) as ContactRevealResponse;
      if (!res.ok || !body.ok || !body.contact) {
        setRevealError(body.message ?? body.error ?? "원문 연락처 조회 실패");
        return;
      }
      setRevealedPhone(body.contact.phone);
      setRevealedName(body.contact.name);
    } catch {
      setRevealError("네트워크 오류로 조회 실패");
    } finally {
      setRevealing(false);
    }
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLeadId) return;
    if (!operatorId.trim()) {
      setSubmitState("error");
      setSubmitMessage("상담원 ID(이름)를 먼저 입력해 주세요.");
      return;
    }
    if (!draft.outcome) {
      setSubmitState("error");
      setSubmitMessage("결과(outcome)를 선택해 주세요.");
      return;
    }
    setSubmitState("submitting");
    setSubmitMessage("");
    try {
      const payload: Record<string, unknown> = {
        operatorId: operatorId.trim(),
        channel: draft.channel,
        direction: draft.direction,
        outcome: draft.outcome,
      };
      if (draft.customerReaction) payload.customerReaction = draft.customerReaction;
      if (draft.customerTemperature) payload.customerTemperature = draft.customerTemperature;
      if (draft.note) payload.note = draft.note;
      if (draft.nextAction) payload.nextAction = draft.nextAction;
      const nextActionAt = fromLocalInput(draft.nextActionAt);
      if (nextActionAt) payload.nextActionAt = nextActionAt;
      const reservationAt = fromLocalInput(draft.reservationAt);
      if (reservationAt) payload.reservationAt = reservationAt;
      if (draft.excludedReason) payload.excludedReason = draft.excludedReason;

      const res = await fetch(
        `${AIBIO_NATIVE_API_BASE}/api/aibio/contact-dashboard/leads/${encodeURIComponent(selectedLeadId)}/events`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(adminToken ? { "x-admin-token": adminToken } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json()) as { ok?: boolean; error?: string; event?: ContactEvent };
      if (!res.ok || !body.ok) {
        setSubmitState("error");
        setSubmitMessage(body.error ?? "이벤트 저장 실패");
        return;
      }
      setSubmitState("success");
      setSubmitMessage("저장되었습니다.");
      setDraft({ ...emptyDraft });
      await Promise.all([loadDetail(selectedLeadId), loadLeads(), loadSummary()]);
    } catch {
      setSubmitState("error");
      setSubmitMessage("네트워크 오류로 저장 실패");
    }
  };

  const setQuickDraft = (patch: Partial<EventDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSubmitState("idle");
  };

  const selectedLead = useMemo(
    () => detail?.lead ?? leads.find((lead) => lead.leadId === selectedLeadId) ?? null,
    [detail, leads, selectedLeadId],
  );

  return (
    <main className="contact-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">AIBIO Contact Operations</p>
          <h1>접수 폼 컨택 관리 대시보드</h1>
          <p className="lead">
            상담원이 어떤 리드에 누구에게 무슨 결과로 컨택했는지, 고객 반응이 어땠는지, 다음에 무엇을 해야 하는지 한 화면에서 봅니다.
          </p>
        </div>
        <div className="header-actions">
          <label className="operator-input">
            상담원 ID
            <input
              value={operatorId}
              onChange={(event) => setOperatorId(event.target.value)}
              placeholder="예: 김상담"
              autoComplete="off"
            />
          </label>
          <div className="token-block">
            {adminToken ? (
              <div className="token-applied">
                <span>관리자 토큰 적용됨</span>
                <button type="button" onClick={clearAdminToken}>해제</button>
              </div>
            ) : (
              <div className="token-form">
                <input
                  type="password"
                  value={adminTokenDraft}
                  onChange={(event) => setAdminTokenDraft(event.target.value)}
                  placeholder="관리자 토큰"
                />
                <button type="button" onClick={saveAdminToken}>저장</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="summary-cards" aria-label="컨택 요약">
        {summary ? (
          <>
            {BUCKETS.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                className={`summary-card ${bucket.tone} ${bucketFilter === bucket.key ? "active" : ""}`}
                onClick={() => setBucketFilter(bucketFilter === bucket.key ? "" : bucket.key)}
              >
                <span className="card-label">{enums?.bucketLabels[bucket.key] ?? bucket.key}</span>
                <strong>{summary.buckets[bucket.key] ?? 0}</strong>
              </button>
            ))}
            <div className="summary-card kpi">
              <span className="card-label">24h 첫 컨택률</span>
              <strong>{fmtRate(summary.kpis.firstContactRateWithin24h)}</strong>
              <small>예약전환 {fmtRate(summary.kpis.reservedRate)} · 방문전환 {fmtRate(summary.kpis.visitedRate)}</small>
            </div>
            <div className="summary-card kpi">
              <span className="card-label">총 리드 / 컨택</span>
              <strong>{summary.totals.leads} / {summary.totals.events}</strong>
              <small>최근 {summary.rangeDays}일 · 상담원 {summary.totals.operators}명</small>
            </div>
            {summary.crm && (
              <div className="summary-card kpi crm-summary">
                <span className="card-label">CRM 매칭 / 결제</span>
                <strong>{summary.crm.summary.matchedCustomers} / {summary.crm.summary.paymentCustomers}</strong>
                <small>
                  예약 {summary.crm.summary.reservationCustomers} · 사용 {summary.crm.summary.productUsageCustomers} · {fmtCurrency(summary.crm.summary.grossRevenue)}
                </small>
              </div>
            )}
          </>
        ) : (
          <div className="summary-card placeholder">요약 로딩 중...</div>
        )}
      </section>

      <section className="filter-bar" aria-label="필터">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">상태 전체</option>
          {enums?.statuses.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select value={String(rangeDays)} onChange={(event) => setRangeDays(Number(event.target.value))}>
          <option value="3">최근 3일</option>
          <option value="7">최근 7일</option>
          <option value="14">최근 14일</option>
          <option value="30">최근 30일</option>
          <option value="90">최근 90일</option>
        </select>
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="이름/번호 마스킹/캠페인 검색"
          />
          <button type="submit">검색</button>
          {(statusFilter || bucketFilter || search) && (
            <button
              type="button"
              className="clear-button"
              onClick={() => {
                setStatusFilter("");
                setBucketFilter("");
                setSearch("");
                setSearchInput("");
              }}
            >
              필터 해제
            </button>
          )}
        </form>
        <div className="result-count">{filteredTotal}건 표시</div>
      </section>

      <section className="lead-grid" aria-label="리드 리스트">
        {listLoading && <div className="muted">불러오는 중...</div>}
        {!listLoading && leads.length === 0 && <div className="empty">선택한 조건에 접수 리드가 없습니다.</div>}
        <ul>
          {leads.map((lead) => {
            const isSelected = selectedLeadId === lead.leadId;
            const purposeText = PURPOSE_LABEL[lead.purpose] ?? lead.purpose ?? "-";
            return (
              <li key={lead.leadId}>
                <button
                  type="button"
                  className={`lead-card ${isSelected ? "selected" : ""} ${lead.priorityScore >= 100 ? "urgent" : ""}`}
                  onClick={() => setSelectedLeadId(isSelected ? null : lead.leadId)}
                >
                  <div className="lead-row1">
                    <span className={`status-pill status-${lead.status}`}>{lead.statusLabel}</span>
                    <span className="lead-source">{lead.source}</span>
                    <span className="lead-time">{fmtRelative(lead.formSubmittedAt)} 접수</span>
                  </div>
                  <div className="lead-row2">
                    <strong>{lead.customerName || lead.maskedName || "익명"}</strong>
                    <span className={`phone ${lead.customerPhone ? "phone-revealed" : ""}`}>
                      {lead.customerPhone || lead.maskedPhone}
                    </span>
                    <span className="purpose">{purposeText}</span>
                    {lead.customerName && <span className="reveal-flag">원문</span>}
                  </div>
                  <div className="lead-row3">
                    <span>
                      컨택 {lead.attemptCount}회{lead.lastContactOutcomeLabel ? ` · 최근 ${lead.lastContactOutcomeLabel}` : " · 미접촉"}
                    </span>
                    {lead.lastCustomerReactionLabel && <span className="reaction">{lead.lastCustomerReactionLabel}</span>}
                    {lead.nextActionLabel && lead.nextActionAt && (
                      <span className="next-action">다음 {lead.nextActionLabel} · {fmtDateTime(lead.nextActionAt)}</span>
                    )}
                    {lead.crm?.matched ? (
                      <span className="crm-chip crm-matched">
                        CRM 고객 #{lead.crm.customerId} · 예약 {lead.crm.reservations.total} · 방문 {lead.crm.customer?.totalVisits ?? 0} · 결제 {fmtCurrency(lead.crm.payments.grossRevenue)}
                      </span>
                    ) : (
                      <span className="crm-chip">CRM 미매칭</span>
                    )}
                    {lead.assignedTo && <span className="assignee">담당 {lead.assignedTo}</span>}
                    {lead.priorityScore >= 100 && <span className="urgent-flag">우선 처리</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selectedLeadId && selectedLead && (
        <aside className="detail-drawer" role="dialog" aria-label="리드 상세 패널">
          <div className="drawer-header">
            <div>
              <span className={`status-pill status-${selectedLead.status}`}>{selectedLead.statusLabel}</span>
              <h2>
                {selectedLead.customerName || selectedLead.maskedName || "익명"}
                {selectedLead.customerName && <span className="reveal-flag">원문</span>}
              </h2>
              <p className="muted">접수 {fmtDateTime(selectedLead.formSubmittedAt)} · 상태 변경 {fmtRelative(selectedLead.statusUpdatedAt)}</p>
            </div>
            <button type="button" className="close-button" onClick={() => setSelectedLeadId(null)}>닫기</button>
          </div>

          <section className="info-block">
            <h3>기본 정보</h3>
            <dl>
              <div>
                <dt>{selectedLead.customerPhone ? "연락처(원문)" : "마스킹 연락처"}</dt>
                <dd className={selectedLead.customerPhone ? "phone-revealed" : ""}>
                  {selectedLead.customerPhone || selectedLead.maskedPhone}
                </dd>
              </div>
              <div><dt>나이대</dt><dd>{selectedLead.ageRange || "-"}</dd></div>
              <div><dt>상담 목적</dt><dd>{PURPOSE_LABEL[selectedLead.purpose] ?? selectedLead.purpose}</dd></div>
              <div><dt>희망 시간</dt><dd>{PREFERRED_TIME_LABEL[selectedLead.preferredTime] ?? selectedLead.preferredTime}</dd></div>
              <div><dt>유입</dt><dd>{selectedLead.source}{selectedLead.utm.campaign ? ` · ${selectedLead.utm.campaign}` : ""}</dd></div>
              <div><dt>광고 키</dt><dd>{selectedLead.hasAdKey ? "있음" : "없음"}{selectedLead.isDuplicate ? " · 30일 중복" : ""}</dd></div>
              <div><dt>예약</dt><dd>{fmtDateTime(selectedLead.reservationAt)}</dd></div>
              <div><dt>방문</dt><dd>{fmtDateTime(selectedLead.visitAt)}</dd></div>
            </dl>
            <div className="reveal-row">
              {!adminToken ? (
                <>
                  <button type="button" onClick={revealContact} disabled={revealing}>
                    {revealing ? "조회 중..." : "이 리드만 원문 조회"}
                  </button>
                  {revealedPhone && (
                    <span className="revealed">
                      {revealedName} · {revealedPhone}
                    </span>
                  )}
                  {revealError && <span className="error">{revealError}</span>}
                  <span className="muted">관리자 토큰을 저장하면 모든 리드의 원문이 자동으로 보입니다.</span>
                </>
              ) : (
                <span className="revealed">
                  최고 관리자 권한 · 모든 리드의 이름/연락처를 자동으로 표시 중. 모든 조회는 audit log에 기록됩니다.
                </span>
              )}
            </div>
          </section>

          <section className="info-block crm-block">
            <h3>센터 CRM 연결</h3>
            {selectedLead.crm?.matched ? (
              <>
                <dl>
                  <div><dt>매칭 고객</dt><dd>#{selectedLead.crm.customerId} · 신뢰도 {selectedLead.crm.confidence}</dd></div>
                  <div><dt>첫 방문</dt><dd>{selectedLead.crm.customer?.firstVisitDate ?? "-"}</dd></div>
                  <div><dt>최근 방문</dt><dd>{selectedLead.crm.customer?.lastVisitDate ?? "-"}</dd></div>
                  <div><dt>누적 방문</dt><dd>{selectedLead.crm.customer?.totalVisits ?? 0}회</dd></div>
                  <div><dt>예약</dt><dd>{selectedLead.crm.reservations.total}건 · 최근 {selectedLead.crm.reservations.lastDate ?? "-"}</dd></div>
                  <div><dt>서비스 사용</dt><dd>{selectedLead.crm.productUsage.total}건 · 완료 {selectedLead.crm.productUsage.completed}건</dd></div>
                  <div><dt>결제</dt><dd>{selectedLead.crm.payments.positiveCount}건 · {fmtCurrency(selectedLead.crm.payments.grossRevenue)}</dd></div>
                  <div><dt>CRM 리드</dt><dd>{selectedLead.crm.lead?.status ?? "-"} · 방문상담 {selectedLead.crm.lead?.visitConsultDate ?? "-"}</dd></div>
                </dl>
                <p className="muted">
                  phone hash 기준으로 CRM 고객/예약/방문/사용/결제를 붙였습니다. 원문 전화번호는 이 영역에 표시하지 않습니다.
                </p>
              </>
            ) : (
              <p className="muted">
                아직 센터 CRM 고객과 매칭되지 않았습니다. 폼 제출자가 CRM 고객으로 생성되거나 동기화되면 같은 phone hash로 연결됩니다.
              </p>
            )}
            {detail?.crm && (
              <p className="muted">
                source {detail.crm.source} · latest customer {detail.crm.freshness.latestCustomerSyncedAt ?? "-"} · confidence {detail.crm.summary.confidence}
              </p>
            )}
          </section>

          <section className="composer-block">
            <h3>컨택/반응 기록</h3>
            <div className="quick-actions">
              <span className="quick-label">빠른 액션</span>
              <button type="button" onClick={() => setQuickDraft({ channel: "phone", direction: "outbound", outcome: "connected" })}>전화 연결됨</button>
              <button type="button" onClick={() => setQuickDraft({ channel: "phone", direction: "outbound", outcome: "no_answer" })}>전화 부재</button>
              <button type="button" onClick={() => setQuickDraft({ channel: "kakao", direction: "outbound", outcome: "connected", customerReaction: "wants_visit" })}>카톡 방문 희망</button>
              <button type="button" onClick={() => setQuickDraft({ channel: "phone", direction: "outbound", outcome: "connected", customerReaction: "needs_price" })}>가격 문의</button>
              <button type="button" onClick={() => setQuickDraft({ channel: "phone", direction: "outbound", outcome: "requested_callback", nextAction: "call_again", nextActionAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)) })}>1시간 뒤 재전화</button>
              <button type="button" onClick={() => setQuickDraft({ channel: "phone", direction: "outbound", outcome: "rejected", customerReaction: "not_interested" })}>거절</button>
            </div>
            <form className="event-form" onSubmit={submitEvent}>
              <label>채널
                <select value={draft.channel} onChange={(event) => setQuickDraft({ channel: event.target.value })}>
                  {enums?.channels.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>방향
                <select value={draft.direction} onChange={(event) => setQuickDraft({ direction: event.target.value })}>
                  {enums?.directions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>결과 *
                <select value={draft.outcome} onChange={(event) => setQuickDraft({ outcome: event.target.value })}>
                  <option value="">선택</option>
                  {enums?.outcomes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>고객 반응
                <select value={draft.customerReaction} onChange={(event) => setQuickDraft({ customerReaction: event.target.value })}>
                  <option value="">선택 안 함</option>
                  {enums?.reactions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>온도
                <select value={draft.customerTemperature} onChange={(event) => setQuickDraft({ customerTemperature: event.target.value })}>
                  <option value="">선택 안 함</option>
                  {enums?.temperatures.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>다음 액션
                <select value={draft.nextAction} onChange={(event) => setQuickDraft({ nextAction: event.target.value })}>
                  <option value="">선택 안 함</option>
                  {enums?.nextActions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>다음 액션 시각
                <input type="datetime-local" value={draft.nextActionAt} onChange={(event) => setQuickDraft({ nextActionAt: event.target.value })} />
              </label>
              <label>예약 시각 (예약 잡음 시 필수)
                <input type="datetime-local" value={draft.reservationAt} onChange={(event) => setQuickDraft({ reservationAt: event.target.value })} />
              </label>
              <label className="full">제외 사유 (제외 결과 시 필수)
                <input value={draft.excludedReason} onChange={(event) => setQuickDraft({ excludedReason: event.target.value })} placeholder="예: 잘못된 번호" />
              </label>
              <label className="full">메모
                <textarea
                  value={draft.note}
                  onChange={(event) => setQuickDraft({ note: event.target.value })}
                  placeholder="상담원 메모 (1,000자 이하)"
                  maxLength={1000}
                  rows={3}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={submitState === "submitting"}>
                  {submitState === "submitting" ? "저장 중..." : "컨택 기록 저장"}
                </button>
                {submitMessage && (
                  <span className={submitState === "error" ? "error" : "success"}>{submitMessage}</span>
                )}
              </div>
            </form>
          </section>

          <section className="timeline-block">
            <h3>타임라인 ({detail?.events.length ?? 0}건)</h3>
            {detail?.events.length === 0 && <p className="muted">아직 기록된 컨택이 없습니다.</p>}
            <ol>
              {detail?.events.map((event) => (
                <li key={event.eventId}>
                  <div className="event-head">
                    <strong>{event.attemptNo}회차 · {event.channelLabel} {event.direction === "outbound" ? "발신" : "수신"}</strong>
                    <span className={`outcome outcome-${event.outcome}`}>{event.outcomeLabel}</span>
                  </div>
                  <div className="event-meta">
                    <span>{fmtDateTime(event.occurredAt)}</span>
                    <span>{event.operatorId}</span>
                    {event.customerReactionLabel && <span>고객반응 {event.customerReactionLabel}</span>}
                    {event.customerTemperature && <span>온도 {event.customerTemperature}</span>}
                  </div>
                  {event.note && <p className="event-note">{event.note}</p>}
                  {event.nextAction && event.nextActionAt && (
                    <p className="event-next">다음 {event.nextActionLabel} · {fmtDateTime(event.nextActionAt)}</p>
                  )}
                  {event.reservationAt && <p className="event-next">예약 {fmtDateTime(event.reservationAt)}</p>}
                  {event.excludedReason && <p className="event-next">제외 사유 {event.excludedReason}</p>}
                </li>
              ))}
            </ol>
          </section>

          {detail && detail.tasks.length > 0 && (
            <section className="task-block">
              <h3>예정 할 일 ({detail.tasks.length}건)</h3>
              <ul>
                {detail.tasks.map((task) => (
                  <li key={task.taskId}>
                    <strong>{task.taskType}</strong>
                    <span>{fmtDateTime(task.dueAt)}</span>
                    <span>담당 {task.ownerId}</span>
                    <span>{task.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}

      <style jsx>{`
        .contact-dashboard {
          max-width: 1440px;
          margin: 0 auto;
          padding: 28px clamp(16px, 4vw, 40px) 80px;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 22px;
          color: #0f172a;
          background: #f4f7fb;
          min-height: 100vh;
          font-family: var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0;
        }

        .dashboard-header {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #2563eb;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 1.55rem;
          font-weight: 900;
        }

        .lead {
          margin: 0;
          color: #475569;
          font-size: 0.92rem;
          line-height: 1.6;
          max-width: 620px;
        }

        .header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .operator-input {
          display: grid;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 800;
          color: #475569;
        }

        .operator-input input {
          min-width: 160px;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .token-block input {
          min-width: 200px;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .token-form,
        .token-applied {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .token-applied {
          color: #15803d;
        }

        .token-form button,
        .token-applied button {
          min-height: 38px;
          padding: 0 12px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #2563eb;
          font-weight: 800;
          cursor: pointer;
        }

        .token-applied button {
          background: #94a3b8;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }

        .summary-card {
          appearance: none;
          text-align: left;
          display: grid;
          gap: 8px;
          padding: 16px 18px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: transform 120ms ease, border-color 120ms ease;
        }

        .summary-card.kpi {
          cursor: default;
          background: #eef2ff;
        }

        .summary-card.crm-summary {
          background: #f0fdf4;
        }

        .summary-card.placeholder {
          color: #94a3b8;
          font-weight: 700;
        }

        .summary-card.active {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
        }

        .summary-card:hover:not(.kpi):not(.placeholder) {
          transform: translateY(-1px);
        }

        .card-label {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .summary-card strong {
          font-size: 1.7rem;
          font-weight: 900;
        }

        .summary-card small {
          color: #64748b;
          font-size: 0.74rem;
        }

        .summary-card.blue strong { color: #2563eb; }
        .summary-card.amber strong { color: #b45309; }
        .summary-card.rose strong { color: #be123c; }
        .summary-card.violet strong { color: #6d28d9; }
        .summary-card.green strong { color: #15803d; }
        .summary-card.red strong { color: #b91c1c; }

        .filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          padding: 14px 18px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .filter-bar select,
        .filter-bar input {
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .search-form {
          display: flex;
          gap: 6px;
          flex: 1;
          min-width: 240px;
        }

        .search-form input {
          flex: 1;
        }

        .search-form button,
        .clear-button {
          min-height: 38px;
          padding: 0 12px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #2563eb;
          font-weight: 800;
          cursor: pointer;
        }

        .clear-button {
          background: #94a3b8;
        }

        .result-count {
          color: #475569;
          font-size: 0.84rem;
          font-weight: 800;
        }

        .lead-grid ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }

        .lead-card {
          width: 100%;
          appearance: none;
          text-align: left;
          padding: 14px 16px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          font: inherit;
          color: inherit;
          display: grid;
          gap: 8px;
        }

        .lead-card:hover {
          border-color: #93c5fd;
        }

        .lead-card.selected {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
        }

        .lead-card.urgent {
          background: #fff7ed;
          border-color: #fb923c;
        }

        .lead-row1,
        .lead-row2,
        .lead-row3 {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        .lead-row2 strong {
          font-size: 1rem;
          font-weight: 900;
        }

        .lead-row2 .phone {
          color: #475569;
          font-weight: 800;
        }

        .lead-row2 .purpose {
          color: #475569;
          font-size: 0.86rem;
        }

        .lead-row3 {
          font-size: 0.84rem;
          color: #475569;
        }

        .lead-row3 .reaction {
          padding: 2px 8px;
          border-radius: 999px;
          background: #fef3c7;
          color: #92400e;
          font-weight: 800;
        }

        .lead-row3 .next-action {
          color: #2563eb;
          font-weight: 800;
        }

        .crm-chip {
          padding: 2px 8px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
        }

        .crm-chip.crm-matched {
          background: #dcfce7;
          color: #166534;
        }

        .lead-row3 .assignee {
          color: #15803d;
        }

        .lead-row3 .urgent-flag {
          padding: 2px 8px;
          border-radius: 999px;
          background: #fed7aa;
          color: #9a3412;
          font-weight: 900;
        }

        .phone-revealed {
          color: #b91c1c !important;
          font-weight: 900 !important;
        }

        .reveal-flag {
          display: inline-flex;
          align-items: center;
          margin-left: 6px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #fee2e2;
          color: #991b1b;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .lead-source {
          font-size: 0.82rem;
          font-weight: 800;
          color: #2563eb;
        }

        .lead-time {
          font-size: 0.78rem;
          color: #64748b;
          margin-left: auto;
        }

        .status-pill {
          display: inline-flex;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 900;
          background: #e2e8f0;
          color: #1e293b;
        }

        .status-new { background: #dbeafe; color: #1e3a8a; }
        .status-contact_attempted { background: #fef3c7; color: #92400e; }
        .status-contacted { background: #ccfbf1; color: #115e59; }
        .status-reserved { background: #ede9fe; color: #5b21b6; }
        .status-visited { background: #dcfce7; color: #166534; }
        .status-paid { background: #fce7f3; color: #9d174d; }
        .status-no_show { background: #fee2e2; color: #991b1b; }
        .status-invalid_duplicate { background: #f1f5f9; color: #475569; }

        .empty,
        .muted {
          padding: 14px;
          color: #64748b;
          font-weight: 700;
        }

        .detail-drawer {
          position: fixed;
          inset: 0 0 0 auto;
          width: min(540px, 100%);
          background: #ffffff;
          border-left: 1px solid #cbd5e1;
          box-shadow: -16px 0 32px rgba(15, 23, 42, 0.08);
          padding: 22px 22px 80px;
          overflow-y: auto;
          z-index: 50;
          display: grid;
          gap: 22px;
        }

        .drawer-header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .drawer-header h2 {
          margin: 8px 0 4px;
          font-size: 1.3rem;
          font-weight: 900;
        }

        .close-button {
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #475569;
          font-weight: 800;
          cursor: pointer;
        }

        .info-block dl {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          margin: 10px 0;
        }

        .info-block dt {
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 800;
        }

        .info-block dd {
          margin: 0 0 6px;
          font-weight: 700;
          font-size: 0.92rem;
        }

        h3 {
          margin: 0 0 10px;
          font-size: 1rem;
          font-weight: 900;
        }

        .reveal-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 8px;
          background: #f1f5f9;
        }

        .reveal-row button {
          min-height: 38px;
          padding: 0 14px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #1e293b;
          font-weight: 800;
          cursor: pointer;
        }

        .reveal-row button:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .revealed {
          color: #166534;
          font-weight: 900;
        }

        .error {
          color: #b91c1c;
          font-weight: 800;
        }

        .success {
          color: #15803d;
          font-weight: 800;
        }

        .quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .quick-actions .quick-label {
          width: 100%;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .quick-actions button {
          min-height: 34px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 0.82rem;
          font-weight: 800;
          color: #1e293b;
          cursor: pointer;
        }

        .quick-actions button:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .event-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .event-form label {
          display: grid;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 800;
          color: #475569;
        }

        .event-form label.full {
          grid-column: 1 / -1;
        }

        .event-form select,
        .event-form input,
        .event-form textarea {
          min-height: 38px;
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .event-form textarea {
          min-height: 80px;
          resize: vertical;
        }

        .form-actions {
          grid-column: 1 / -1;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .form-actions button {
          min-height: 42px;
          padding: 0 16px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #2563eb;
          font-weight: 900;
          cursor: pointer;
        }

        .form-actions button:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .timeline-block ol {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }

        .timeline-block li {
          padding: 12px 14px;
          border-radius: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .event-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        .event-head strong {
          font-size: 0.92rem;
        }

        .outcome {
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 900;
          background: #e2e8f0;
        }

        .outcome-connected { background: #dcfce7; color: #166534; }
        .outcome-no_answer,
        .outcome-busy { background: #fef3c7; color: #92400e; }
        .outcome-rejected,
        .outcome-wrong_number,
        .outcome-invalid { background: #fee2e2; color: #991b1b; }
        .outcome-requested_callback { background: #e0e7ff; color: #3730a3; }
        .outcome-reserved { background: #ede9fe; color: #5b21b6; }

        .event-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .event-note,
        .event-next {
          margin: 6px 0 0;
          font-size: 0.86rem;
          color: #1e293b;
          font-weight: 700;
        }

        .event-next {
          color: #2563eb;
        }

        .task-block ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }

        .task-block li {
          padding: 10px 12px;
          border-radius: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 0.84rem;
          font-weight: 700;
        }

        @media (max-width: 880px) {
          .detail-drawer {
            width: 100%;
            inset: auto 0 0 0;
            max-height: 90vh;
            border-left: 0;
            border-top: 1px solid #cbd5e1;
            border-radius: 14px 14px 0 0;
          }

          .event-form {
            grid-template-columns: 1fr;
          }

          .info-block dl {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
