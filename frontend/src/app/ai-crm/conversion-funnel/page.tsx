"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

// site → Meta account_id 매핑 (backend ads.ts SITE_ACCOUNTS 와 일치)
const META_ACCOUNT_BY_SITE: Record<string, string> = {
  biocom: "act_3138805896402376",
  thecleancoffee: "act_654671961007474",
};

// site 한글 라벨 단일 진실 — 화면 곳곳에서 호출
const siteLabelKo = (site: string): string => {
  if (site === "biocom") return "바이오컴";
  if (site === "thecleancoffee") return "더클린커피";
  if (site === "all_sites") return "전체 (all_sites · pixel 합산)";
  return site;
};

type FunnelStepKey =
  | "landing"
  | "add_to_cart"
  | "payment_started"
  | "payment_method_selected"
  | "confirmed_purchase"
  | "meta_capi_success"
  | "browser_purchase";

type FunnelStatusLabel = "정상" | "주의" | "긴급";

type CheckoutSignalItem = {
  label: string;
  count: number | null;
  source: string;
  unit: string;
  basis: string;
  caveat: string;
  send_allowed?: false;
};

type FunnelHealth = {
  ok: true;
  site: "biocom" | "thecleancoffee" | "all_sites";
  window: "1d" | "7d" | "14d" | "30d";
  granularity: "day" | "week";
  payment_method: string;
  source_filter: string;
  checked_at_kst: string;
  source_summary: {
    primary: string;
    cross_check: string[];
    freshness: "fresh" | "stale" | "unknown";
    confidence: string;
    latest_logged_at_kst: string | null;
    latest_logged_age_hours: number | null;
  };
  empty_state_diagnostic: {
    is_empty: boolean;
    reason: string;
    human_label: string;
    next_action: string;
    detail: {
      total_rows_all_time: number;
      rows_in_window_before_filters: number;
      rows_after_filters: number;
      latest_logged_at_kst: string | null;
      window_start_kst: string | null;
    };
  };
  status: {
    label: FunnelStatusLabel;
    main_issue: string;
    next_action: string;
  };
  risk_combo: {
    state: "all_safe" | "browser_only_missing" | "server_only_missing" | "all_missing" | "unknown";
    server_capi_active: boolean;
    browser_purchase_active: boolean;
    human_label: string;
    explanation_ko: string;
  };
  unresolved_leaks: {
    total_count: number;
    total_amount_krw: number;
    items: Array<{
      key: string;
      human_label: string;
      count: number;
      amount_krw: number;
      priority: "critical" | "high" | "medium" | "watch";
      next_action: string;
      explanation_ko: string;
    }>;
  };
  action_queue: Array<{
    key: string;
    priority: "critical" | "high" | "medium" | "watch";
    title: string;
    detail: string;
    next_action: string;
    count: number;
    amount_krw: number;
    explanation_ko: string;
    details?: Array<{
      safe_ref: string;
      logged_at_kst: string;
      amount_krw: number;
      payment_method: string;
      payment_method_label: string;
      source_bucket: string;
      source_label: string;
      evidence: string[];
      confirmed_basis: string;
      capi_status: string;
      missing_reason: string;
      recommended_action: string;
      missing_policy?: "current_missing_watch" | "legacy_do_not_backfill";
      age_minutes: number | null;
      confidence: "high" | "medium" | "low";
    }>;
  }>;
  capi_attribution_join: {
    window_label: string;
    capi_sent_orders: number;
    breakdown: Array<{
      bucket: string;
      human_label: string;
      count: number;
      share_pct: number;
      explanation_ko: string;
    }>;
    note_ko: string;
  };
  purchase_eligibility_queue: {
    confirmed_eligible_unsent_count: number;
    confirmed_eligible_unsent_amount_krw: number;
    oldest_age_minutes: number | null;
    sample_label_safe: string | null;
    explanation_ko: string;
  };
  signal_quality: {
    confirmed_purchases_total: number;
    fields: Array<{
      field: string;
      human_label: string;
      present_count: number;
      present_rate: number;
      explanation_ko: string;
    }>;
  };
  payment_decision_latency: {
    available: boolean;
    explanation_ko: string;
    not_available_reason: string;
    p50_ms: number | null;
    p95_ms: number | null;
    sample_size: number;
    status_distribution: {
      allow_purchase: number;
      virtual_account_issued: number;
      canceled: number;
      unknown: number;
    };
  };
  browser_funnel_health: {
    available: boolean;
    explanation_ko: string;
    not_available_reason: string;
    stages: Array<{ stage: string; count: number; source: string }>;
  };
  checkout_signal_split?: {
    vm_payment_page_reached: CheckoutSignalItem & { count: number };
    meta_initiate_checkout_received: CheckoutSignalItem;
    meta_capi_initiate_checkout_candidate: CheckoutSignalItem & { count: number; send_allowed: false };
    root_causes: Array<{
      reason: string;
      count: number;
      explanation_ko: string;
    }>;
    ordered_exclusion_steps?: Array<{
      step: number;
      reason: string;
      label: string;
      count: number;
      rate_of_payment_page_reached: number | null;
      effect: "start" | "exclude" | "dedupe" | "keep";
      explanation_ko: string;
      next_action_ko: string;
    }>;
    summary?: {
      raw_payment_page_rows: number;
      excluded_rows: number;
      deduped_repeat_rows: number;
      candidate_rows_before_dedupe: number;
      final_candidate_rows: number;
      final_candidate_rate: number | null;
      caveat: string;
    };
  };
  period_label: string;
  kpis: {
    vm_order_signals: { count: number; amount_krw: number; source: string; unit: string; basis: string };
    payment_started: { count: number; source: string; unit: string; basis: string };
    confirmed_purchases: { count: number; amount_krw: number; source: string; unit: string; basis: string };
    meta_capi_success: { count: number; events_received: number; source: string; unit: string; basis: string };
    browser_purchase: { count: number; source: string; unit: string; basis: string };
    unmatched: { count: number; amount_krw: number; source: string; unit: string; basis: string };
  };
  meta_capi_breakdown: {
    window_label: string;
    capi_site_filter?: {
      site: string;
      pixel_ids: string[];
      all_sites_mode: boolean;
      caveat: string;
    };
    send_attempts: number;
    events_received_count: number;
    unique_orders: number;
    unique_event_ids: number;
    duplicate_estimate: number;
    failed: number;
    latency_minutes: { p50: number | null; p95: number | null; sample_size: number };
    no_send_reasons: Array<{ reason: string; human_label: string; count: number }>;
  };
  metric_contract?: {
    site: string;
    pixel_ids: string[];
    all_sites_mode: boolean;
    window: string;
    last_updated_at: string;
    metrics: Record<
      string,
      {
        source: string;
        unit: string;
        window: string;
        site: string;
        pixel_id: string | null;
        caveat: string;
      }
    >;
  };
  cache?: {
    cached: boolean;
    cached_at_kst: string | null;
    next_refresh_at_kst: string | null;
    generation_ms: number;
    staleness_ms: number;
    source: string;
  };
  funnel: Array<{
    step: FunnelStepKey;
    label: string;
    count: number;
    rate_from_previous: number | null;
    status: "normal" | "warning" | "alert" | "unknown";
  }>;
  funnel_views: {
    all_traffic: {
      label: string;
      explanation_ko: string;
      steps: Array<{
        step: FunnelStepKey;
        label: string;
        count: number;
        rate_from_previous: number | null;
        status: "normal" | "warning" | "alert" | "unknown";
      }>;
    };
    paid_attributed: {
      label: string;
      explanation_ko: string;
      steps: Array<{
        step: FunnelStepKey;
        label: string;
        count: number;
        rate_from_previous: number | null;
        status: "normal" | "warning" | "alert" | "unknown";
      }>;
    };
  };
  series: Array<{
    date: string;
    landing: number;
    payment_started: number;
    confirmed_purchases: number;
    meta_capi_success: number;
    browser_purchase: number;
    unmatched: number;
  }>;
  utm_breakdown: Array<{
    channel: string;
    human_label: string;
    landing_count: number;
    payment_started_count: number;
    confirmed_purchase_count: number;
    meta_capi_success_count: number;
    unmatched_count: number;
    budget_roas_included: boolean;
    next_action: string;
  }>;
  unmatched_reasons: Array<{
    reason: string;
    human_label: string;
    count: number;
    amount_krw: number;
    confidence: string;
    budget_roas_included: boolean;
    next_action: string;
    in_kpi_unmatched_metric: boolean;
    category: "kpi_unmatched" | "diagnostic_hint" | "upstream_dropoff" | "capi_pipeline";
  }>;
  capi_health: {
    last_success_at_kst: string | null;
    last_1h: { attempted: number; success: number; events_received: number; failed: number };
    today: { attempted: number; success: number; events_received: number; failed: number };
    last_7d: { attempted: number; success: number; events_received: number; failed: number };
    no_send_reasons: Array<{ reason: string; human_label: string; count: number }>;
  };
  guardrails: {
    raw_identifier_output: 0;
    platform_send_from_this_endpoint: 0;
    operational_db_write: 0;
  };
};

const fmtKRW = (won: number): string => {
  if (!Number.isFinite(won)) return "—";
  if (won === 0) return "₩0";
  const abs = Math.abs(won);
  const sign = won < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.round((abs % 100_000_000) / 10_000);
    if (man === 0) return `${sign}₩${eok}억`;
    return `${sign}₩${eok}억 ${man.toLocaleString()}만`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString()}만`;
  }
  return `${sign}₩${Math.round(abs).toLocaleString()}`;
};

const fmtPct = (rate: number | null): string => {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
};

const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
};

const fmtOptionalNum = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "—";
  return fmtNum(n);
};

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
};

const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) {
    alert("CSV 로 내보낼 row 가 없습니다.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const statusClass = (label: FunnelStatusLabel | undefined): string => {
  if (label === "주의") return styles.yellow;
  if (label === "긴급") return styles.red;
  return styles.green;
};

const funnelBarClass = (status: string): string => {
  if (status === "warning") return `${styles.funnelBar} ${styles.warning}`;
  if (status === "alert") return `${styles.funnelBar} ${styles.alert}`;
  if (status === "unknown") return `${styles.funnelBar} ${styles.unknown}`;
  return styles.funnelBar;
};

type StepDetail = {
  title: string;
  description: string;
  headers: string[];
  numCols: Set<number>;
  rows: Array<Array<string>>;
};

const describeStepDetail = (step: FunnelStepKey, data: FunnelHealth): StepDetail => {
  if (step === "confirmed_purchase") {
    return {
      title: "결제완료 단계 — 매칭 안 된 사유",
      description: "결제완료가 있는데 광고/유입 매칭이 실패한 row 의 사유 분포입니다.",
      headers: ["사유", "건수", "금액", "신뢰도", "다음 조치"],
      numCols: new Set([1, 2]),
      rows: data.unmatched_reasons.map((r) => [
        r.human_label,
        fmtNum(r.count),
        r.amount_krw > 0 ? fmtKRW(r.amount_krw) : "—",
        r.confidence,
        r.next_action,
      ]),
    };
  }
  if (step === "meta_capi_success") {
    const last = data.capi_health.last_success_at_kst ?? "없음";
    const reasons = data.capi_health.no_send_reasons.map((r) => [
      r.human_label,
      fmtNum(r.count),
    ]);
    return {
      title: "Meta CAPI 단계 — 전송 통로 상태",
      description: `최근 성공 시각: ${last}. 결제완료 대비 전송 성공률이 핵심입니다.`,
      headers: ["사유", "건수"],
      numCols: new Set([1]),
      rows: reasons.length > 0
        ? reasons
        : [["분류된 no-send 사유 없음", "0"]],
    };
  }
  if (step === "payment_started") {
    if (data.checkout_signal_split) {
      const split = data.checkout_signal_split;
      return {
        title: "결제 화면 신호 — 3개 기준 분리",
        description:
          "같은 '결제 시작'처럼 보여도 내부 진단값, Meta가 받은 값, 서버 CAPI 후보는 서로 다른 숫자입니다.",
        headers: ["구분", "건수", "뜻", "주의점"],
        numCols: new Set([1]),
        rows: [
          [
            split.vm_payment_page_reached.label,
            fmtOptionalNum(split.vm_payment_page_reached.count),
            "우리 VM Cloud가 주문서/결제 페이지 도착을 본 넓은 진단값",
            split.vm_payment_page_reached.caveat,
          ],
          [
            split.meta_initiate_checkout_received.label,
            fmtOptionalNum(split.meta_initiate_checkout_received.count),
            "Meta 픽셀/forward 경로에서 InitiateCheckout 이름으로 들어온 수신 근사값",
            split.meta_initiate_checkout_received.caveat,
          ],
          [
            split.meta_capi_initiate_checkout_candidate.label,
            fmtOptionalNum(split.meta_capi_initiate_checkout_candidate.count),
            "Meta 광고 단서가 강한 결제 시작 흐름만 남긴 서버 전송 후보",
            split.meta_capi_initiate_checkout_candidate.caveat,
          ],
        ],
      };
    }
    const total = data.utm_breakdown.reduce((s, r) => s + r.payment_started_count, 0);
    return {
      title: "결제 페이지 도달 단계 — 유입별 분포",
      description: `이 기간 총 결제 페이지 도달 ${fmtNum(total)}건의 유입별 분포입니다.`,
      headers: ["유입", "결제 페이지 도달", "결제완료", "매칭없음"],
      numCols: new Set([1, 2, 3]),
      rows: data.utm_breakdown.map((r) => [
        r.human_label,
        fmtNum(r.payment_started_count),
        fmtNum(r.confirmed_purchase_count),
        fmtNum(r.unmatched_count),
      ]),
    };
  }
  if (step === "landing") {
    return {
      title: "유입 단계 — UTM/Referrer 분포",
      description: "유입(landing) 신호의 분포입니다. UTM 누락이 큰 채널부터 점검하세요.",
      headers: ["유입", "유입수", "결제 페이지 도달", "결제완료"],
      numCols: new Set([1, 2, 3]),
      rows: data.utm_breakdown.map((r) => [
        r.human_label,
        fmtNum(r.landing_count),
        fmtNum(r.payment_started_count),
        fmtNum(r.confirmed_purchase_count),
      ]),
    };
  }
  if (step === "browser_purchase") {
    return {
      title: "Browser Purchase 단계 — 수집원 미연결",
      description:
        "현재 브라우저 ev=Purchase 관측 신호가 별도 수집되지 않아 항상 0 입니다. VM diagnostic hook 추가 후 채워집니다.",
      headers: [],
      numCols: new Set(),
      rows: [],
    };
  }
  // landing/add_to_cart/payment_method_selected default
  return {
    title: `${step} 단계`,
    description: "추가 drilldown 정보가 정의되지 않은 단계입니다.",
    headers: [],
    numCols: new Set(),
    rows: [],
  };
};

export default function ConversionFunnelPage() {
  const [site, setSite] = useState<"biocom" | "thecleancoffee" | "all_sites">("biocom");
  const [windowKey, setWindowKey] = useState<"1d" | "7d" | "14d" | "30d">("7d");
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const [data, setData] = useState<FunnelHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<FunnelStepKey | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  // Option B: 강제 새로고침 — cache miss 유도. 연타 방지 위해 5분 cooldown.
  const [forceRefreshCooldownMs, setForceRefreshCooldownMs] = useState<number>(0);
  const [forceRefreshTick, setForceRefreshTick] = useState<number>(Date.now());
  const [forceRefreshFlag, setForceRefreshFlag] = useState<number>(0);
  const [funnelView, setFunnelView] = useState<"all_traffic" | "paid_attributed">("all_traffic");
  const [expandedActionKey, setExpandedActionKey] = useState<string | null>(null);

  // Meta ROAS 카드 — 기본은 어제 사전 계산값, 당일은 사용자 버튼으로만 조회.
  type MetaRoasPreset = "today" | "yesterday" | "last_7d";
  type MetaRoasError = {
    error: string;
    status?: number;
    endpoint?: string;
    date_preset?: string;
    account_id_suffix?: string;
    timestamp?: string;
    response_message?: string;
  };
  type MetaRoasSummary = {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    queried_at?: string;
    date_range?: { start_date?: string; end_date?: string };
  } | MetaRoasError;
  const [metaRoasToday, setMetaRoasToday] = useState<MetaRoasSummary | null>(null);
  const [metaRoasYesterday, setMetaRoasYesterday] = useState<MetaRoasSummary | null>(null);
  const [, setMetaRoasLast7d] = useState<MetaRoasSummary | null>(null);
  const [metaRoasView, setMetaRoasView] = useState<"yesterday" | "today">("yesterday");
  const [metaRoasLoading, setMetaRoasLoading] = useState(false);

  // v9: 카드 별 보조 상태 — 마지막 성공값 / 실패 카운트 / 쿨다운
  type RoasSuccessSummary = {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    queried_at?: string;
    date_range?: { start_date?: string; end_date?: string };
    captured_at: string; // 이 success 가 잡힌 시각 (UI 의 "마지막 정상값" 표시용)
  };
  type RoasAuxState = {
    lastSuccess: RoasSuccessSummary | null;
    failCount: number;
    cooldownUntilMs: number;
  };
  const initialAux: RoasAuxState = { lastSuccess: null, failCount: 0, cooldownUntilMs: 0 };
  const [metaRoasAux, setMetaRoasAux] = useState<Record<MetaRoasPreset, RoasAuxState>>({
    today: initialAux,
    yesterday: initialAux,
    last_7d: initialAux,
  });
  const [cooldownTickMs, setCooldownTickMs] = useState(Date.now());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState("");


  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const requestedSite = site; // closure capture — 응답 시점에 user 가 site 를 바꿨는지 검사용
    const ac = new AbortController();
    const hardTimeout = setTimeout(() => ac.abort(), 30000); // 30초 hard timeout
    try {
      const url = new URL(`${API_BASE}/api/attribution/funnel-health`);
      url.searchParams.set("site", site);
      url.searchParams.set("window", windowKey);
      url.searchParams.set("granularity", granularity);
      url.searchParams.set("paymentMethod", paymentMethod);
      url.searchParams.set("source", sourceFilter);
      // 강제 새로고침 — backend precompute cache 건너뛰고 실시간 계산
      if (forceRefreshFlag > 0) {
        url.searchParams.set("force", "true");
      }
      const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
      }
      const body = (await res.json()) as FunnelHealth | { ok: false; error?: string; message?: string };
      if (!("ok" in body) || body.ok !== true) {
        const errBody = body as { error?: string; message?: string };
        throw new Error(`서버가 응답은 했지만 ok=false. (${errBody.error ?? "unknown"}: ${errBody.message ?? ""})`);
      }
      // site mismatch — user 가 fetch 도중 site 를 바꿨다면 stale 응답이므로 화면 갱신 skip
      if (body.site !== requestedSite) {
        console.warn("funnel_health_stale_dropped", { requested: requestedSite, received: body.site });
        return;
      }
      setData(body);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      const msg = aborted ? "요청 취소 또는 30초 timeout" : e instanceof Error ? e.message : String(e);
      if (!aborted) setError(msg);
    } finally {
      clearTimeout(hardTimeout);
      setLoading(false);
    }
  }, [site, windowKey, granularity, paymentMethod, sourceFilter, forceRefreshFlag]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 강제 새로고침 쿨다운 카운트다운 (1초 tick)
  useEffect(() => {
    if (forceRefreshCooldownMs <= 0) return;
    const id = setInterval(() => setForceRefreshTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [forceRefreshCooldownMs]);

  // Meta ROAS 별도 비동기 fetch. 기본 로드는 어제 사전 계산값 1개만 읽어 화면 진입을 막지 않는다.
  const loadMetaRoas = useCallback(async () => {
    const requestedPreset: MetaRoasPreset = metaRoasView === "today" ? "today" : "yesterday";
    if (site === "all_sites") {
      const msg = "all_sites 합산 ROAS 는 site 별 광고비 합산이 필요. backend /api/ads/roas multi-account 보강 대기";
      setMetaRoasToday({ error: msg });
      setMetaRoasYesterday({ error: msg });
      setMetaRoasLast7d({ error: msg });
      return;
    }
    const accountId = META_ACCOUNT_BY_SITE[site];
    if (!accountId) {
      setMetaRoasToday({ error: "지원하지 않는 site 입니다." });
      setMetaRoasYesterday({ error: "지원하지 않는 site 입니다." });
      setMetaRoasLast7d({ error: "지원하지 않는 site 입니다." });
      return;
    }
    setMetaRoasLoading(true);
    setMetaRoasToday(null);
    setMetaRoasYesterday(null);
    setMetaRoasLast7d(null);

    const accountSuffix = accountId.slice(-4);
    type BatchSuccess = {
      summary: { spend: number; attributedRevenue: number; roas: number | null; orders: number };
      queried_at?: string;
      date_range?: { start_date?: string; end_date?: string };
      cache?: { cached_at?: string; stale?: boolean };
    };
    const makeError = (
      preset: MetaRoasPreset,
      error: string,
      extras: Partial<MetaRoasError> = {},
    ): MetaRoasSummary => ({
      error,
      endpoint: "/api/ads/roas-summary",
      date_preset: preset,
      account_id_suffix: accountSuffix,
      timestamp: new Date().toISOString(),
      ...extras,
    });
    const tryBatch = async (preset: MetaRoasPreset): Promise<MetaRoasSummary> => {
      try {
        const url = new URL(`${API_BASE}/api/ads/roas-summary`);
        url.searchParams.set("account_id", accountId);
        url.searchParams.set("presets", preset);
        url.searchParams.set("ui_mode", metaRoasView === "today" ? "today_button_4h_precompute" : "default_yesterday_precompute");
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 20000);
        const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
        clearTimeout(to);
        if (!res.ok) {
          let responseMessage = "";
          try {
            const errBody = await res.json();
            responseMessage = typeof errBody?.error === "string" ? errBody.error : "";
          } catch {
            /* ignore */
          }
          return makeError(preset, `HTTP ${res.status}`, { status: res.status, response_message: responseMessage });
        }
        const body = (await res.json()) as {
          ok: boolean;
          results?: Record<string, BatchSuccess>;
          errors?: Record<string, { error: string; status?: number; response_message?: string; retry_after_ms?: number }>;
        };
        if (!body.ok) return makeError(preset, "응답 비정상");
        const ok = body.results?.[preset];
        if (ok?.summary) {
          return { ...ok.summary, queried_at: ok.queried_at, date_range: ok.date_range };
        }
        const err = body.errors?.[preset];
        if (err) {
          return makeError(preset, err.error, { status: err.status, response_message: err.response_message });
        }
        return makeError(preset, "missing_in_batch");
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        return makeError(requestedPreset, aborted ? "timeout (20s)" : e instanceof Error ? e.message : String(e));
      }
    };

    const nextSummary = await tryBatch(requestedPreset);
    console.info("roas_batch_used", { endpoint: "/api/ads/roas-summary", preset: requestedPreset });

    // 카드별 lastSuccess + failCount + cooldown 업데이트
    const applyAux = (
      preset: MetaRoasPreset,
      next: MetaRoasSummary,
      prevAux: typeof metaRoasAux,
    ): RoasAuxState => {
      const prev = prevAux[preset];
      if ("error" in next) {
        const wait = nextCooldownMs(prev.failCount + 1);
        return {
          lastSuccess: prev.lastSuccess,
          failCount: prev.failCount + 1,
          cooldownUntilMs: Date.now() + wait,
        };
      }
      return {
        lastSuccess: { ...next, captured_at: new Date().toISOString() },
        failCount: 0,
        cooldownUntilMs: 0,
      };
    };

    setMetaRoasToday(requestedPreset === "today" ? nextSummary : null);
    setMetaRoasYesterday(requestedPreset === "yesterday" ? nextSummary : null);
    setMetaRoasLast7d(null);
    setMetaRoasAux((prevAux) => ({
      ...prevAux,
      [requestedPreset]: applyAux(requestedPreset, nextSummary, prevAux),
    }));
    setMetaRoasLoading(false);
  }, [metaRoasView, site]);

  const retryMetaRoas = useCallback(
    async (preset: "today" | "yesterday" | "last_7d") => {
      if (site === "all_sites") return;
      const accountId = META_ACCOUNT_BY_SITE[site];
      if (!accountId) return;
      // cooldown 강제 — 사용자 연타로 Meta API 호출 폭증 방지
      const aux = metaRoasAux[preset];
      if (aux.cooldownUntilMs > Date.now()) {
        console.warn("roas_retry_blocked_by_cooldown", {
          preset,
          remaining_ms: aux.cooldownUntilMs - Date.now(),
        });
        return;
      }
      const setter =
        preset === "today" ? setMetaRoasToday : preset === "yesterday" ? setMetaRoasYesterday : setMetaRoasLast7d;
      setter(null);
      const accountSuffix = accountId.slice(-4);
      const ts = new Date().toISOString();
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 45000);
      const baseErr = {
        endpoint: "/api/ads/roas-summary",
        date_preset: preset,
        account_id_suffix: accountSuffix,
        timestamp: ts,
      };
      const bumpAuxFail = (extra?: { retryAfterMs?: number }) => {
        setMetaRoasAux((prev) => {
          const p = prev[preset];
          const wait = nextCooldownMs(p.failCount + 1, extra?.retryAfterMs);
          return {
            ...prev,
            [preset]: {
              lastSuccess: p.lastSuccess,
              failCount: p.failCount + 1,
              cooldownUntilMs: Date.now() + wait,
            },
          };
        });
      };
      const setAuxSuccess = (summary: { spend: number; attributedRevenue: number; roas: number | null; orders: number; queried_at?: string; date_range?: { start_date?: string; end_date?: string } }) => {
        setMetaRoasAux((prev) => ({
          ...prev,
          [preset]: {
            lastSuccess: { ...summary, captured_at: new Date().toISOString() },
            failCount: 0,
            cooldownUntilMs: 0,
          },
        }));
      };
      try {
        const url = new URL(`${API_BASE}/api/ads/roas-summary`);
        url.searchParams.set("account_id", accountId);
        url.searchParams.set("presets", preset);
        url.searchParams.set("ui_mode", preset === "today" ? "today_button_4h_precompute_retry" : "manual_retry_precompute");
        const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
        if (!res.ok) {
          let respMsg = "";
          let retryAfterMs: number | undefined;
          try {
            const eb = await res.json();
            respMsg = typeof eb?.error === "string" ? eb.error : "";
            if (typeof eb?.retry_after_ms === "number") retryAfterMs = eb.retry_after_ms;
          } catch {/* */}
          console.error("roas_fetch_failed", { ...baseErr, status: res.status, message: respMsg });
          setter({ error: `HTTP ${res.status}`, status: res.status, response_message: respMsg, ...baseErr });
          bumpAuxFail({ retryAfterMs });
          return;
        }
        const body = await res.json();
        const item = body.results?.[preset];
        const itemError = body.errors?.[preset];
        if (!body.ok || (!item?.summary && !itemError)) {
          console.error("roas_fetch_failed", { ...baseErr, status: res.status, message: body.error });
          setter({
            error: body.error ?? "응답 비정상",
            status: res.status,
            response_message: body.error,
            ...baseErr,
          });
          bumpAuxFail({ retryAfterMs: typeof body.retry_after_ms === "number" ? body.retry_after_ms : undefined });
          return;
        }
        if (itemError) {
          setter({
            error: itemError.error ?? "응답 비정상",
            status: itemError.status,
            response_message: itemError.response_message,
            ...baseErr,
          });
          bumpAuxFail({ retryAfterMs: typeof itemError.retry_after_ms === "number" ? itemError.retry_after_ms : undefined });
          return;
        }
        setter({ ...item.summary, queried_at: item.queried_at, date_range: item.date_range });
        setAuxSuccess({ ...item.summary, queried_at: item.queried_at, date_range: item.date_range });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        const msg = aborted ? "timeout (45s)" : e instanceof Error ? e.message : String(e);
        console.error("roas_fetch_failed", { ...baseErr, message: msg });
        setter({ error: msg, ...baseErr });
        bumpAuxFail();
      } finally {
        clearTimeout(to);
      }
    },
    [site, metaRoasAux],
  );

  useEffect(() => {
    void loadMetaRoas();
  }, [loadMetaRoas]);

  // cooldown 1초 tick — 버튼 disabled / 카운트다운 표시용
  useEffect(() => {
    const anyActive =
      metaRoasAux.today.cooldownUntilMs > Date.now() ||
      metaRoasAux.yesterday.cooldownUntilMs > Date.now() ||
      metaRoasAux.last_7d.cooldownUntilMs > Date.now();
    if (!anyActive) return;
    const id = setInterval(() => setCooldownTickMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [metaRoasAux]);

  // 데이터 로딩 progress (시간 기반 추정 — funnel-health ≈ 1-3초, Meta ROAS ≈ 10-17초)
  useEffect(() => {
    // error 가 set 됐으면 progress 즉시 종료. 한쪽 fetch 실패해도 progress 가 계속 회전하던 문제 fix.
    const isBusy = (loading || metaRoasLoading) && !error;
    if (!isBusy) {
      // 완료 시 100% 까지 채우고 잠시 후 사라지게
      setLoadingProgress((prev) => (prev > 0 ? 100 : 0));
      const t = setTimeout(() => {
        setLoadingProgress(0);
        setLoadingStep("");
      }, 500);
      return () => clearTimeout(t);
    }
    setLoadingProgress(2);
    setLoadingStep("요청 보내는 중");
    const startMs = Date.now();
    const HARD_TIMEOUT_MS = 60000; // 60초 넘어가면 progress 자체 중단
    const id = setInterval(() => {
      const elapsed = Date.now() - startMs;
      if (elapsed > HARD_TIMEOUT_MS) {
        setLoadingProgress(95);
        setLoadingStep("⚠ 60초 초과 — 응답 대기. 새로고침 또는 재조회를 권장합니다");
        return;
      }
      const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 6500))));
      setLoadingProgress(pct);
      if (elapsed < 1500) setLoadingStep("VM Cloud attribution_ledger 집계 중");
      else if (elapsed < 3500) setLoadingStep("Meta CAPI send log 분석 중");
      else if (elapsed < 6000) setLoadingStep("위험 조합 · 미해결 누수 · 신호 품질 계산 중");
      else if (elapsed < 10000) setLoadingStep(metaRoasView === "today" ? "당일 ROAS 사전 계산값 조회 중" : "어제 ROAS 사전 계산값 조회 중");
      else if (elapsed < 14000) setLoadingStep("캐시가 비어 있어 백엔드 계산 응답 대기 중");
      else setLoadingStep("응답 지연 — 오늘 데이터는 버튼 조회 후 4시간 단위 캐시로 갱신됩니다");
    }, 200);
    return () => clearInterval(id);
  }, [loading, metaRoasLoading, error, metaRoasView]);

  const maxSeriesCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      ...data.series.flatMap((s) => [s.landing, s.payment_started, s.confirmed_purchases, s.meta_capi_success]),
    );
  }, [data]);

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
      <h1 className={styles.title}>
        오늘 전환 신호가 어디서 새는가
        <span className={styles.siteChip}>{siteLabelKo(site)}</span>
      </h1>
      <p className={styles.subtitle}>
        유입부터 결제완료, Meta 로 구매 신호 전송까지 한 화면에서 확인합니다. 광고 플랫폼 주장값이 아니라 VM Cloud
        수집 원장 기준입니다.
      </p>

      {/* 용어 풀이 박스 — 한 번 열어두면 화면 곳곳의 영문 약어가 이해됨 */}
      <div className={styles.glossary}>
        <button
          type="button"
          className={styles.glossaryToggle}
          onClick={() => setGlossaryOpen((v) => !v)}
          aria-expanded={glossaryOpen}
        >
          {glossaryOpen ? "▾" : "▸"} 용어 풀이 (처음 보는 단어가 있으면 펼치기)
        </button>
        {glossaryOpen && (
          <div className={styles.glossaryBody}>
            <dl>
              <dt>전환 API · Server CAPI · Meta CAPI</dt>
              <dd>
                서버가 Meta(페이스북/인스타그램)로 구매·이벤트를 보내는 통로. 브라우저 픽셀이 깨져도 서버가 대체로 보내므로
                광고 학습이 끊기지 않게 해 줍니다. <code>CAPI = Conversions API</code>.
              </dd>
              <dt>브라우저 구매 신호 · Browser Purchase</dt>
              <dd>
                사용자 브라우저에서 직접 발화되는 Meta 픽셀 이벤트 (<code>ev=Purchase</code>). 위의 서버 CAPI 와 짝을 이루는 보조 경로.
                서버 CAPI 가 살아 있으면 0 이어도 치명 장애 아님.
              </dd>
              <dt>events_received</dt>
              <dd>
                Meta 가 우리 서버 전송을 정상 수신했다고 응답한 카운트. 1 = 1건 받음.
                <strong> 전송 성공 ≠ 구매 발생</strong> — send 시도 단위입니다.
              </dd>
              <dt>fbp / fbc / fbclid / gclid</dt>
              <dd>
                광고 식별자. <code>fbp</code> = 페이스북 방문자 쿠키 (광고 클릭 증거 아님),{" "}
                <code>fbc</code>/<code>fbclid</code> = Meta 광고 클릭 증거,{" "}
                <code>gclid</code> = Google 광고 클릭 증거.
              </dd>
              <dt>p50 / p95</dt>
              <dd>
                응답 시간 분포. p50 = 보통 응답 시간 (절반 기준), p95 = 가장 느린 5% 응답 시간.
              </dd>
              <dt>전송 대기 줄 · Eligibility Queue</dt>
              <dd>
                결제완료 됐는데 아직 Meta 로 안 보낸 주문 줄. 오래 묵을수록 Meta 학습에 그만큼 늦게 도달.
              </dd>
              <dt>사후 보충 전송 · backfill</dt>
              <dd>
                놓친 주문/이벤트를 나중에 Meta 로 보내 채우는 작업. 단, 5/14~5/15 수리 전 과거 누락은
                ROAS 오염을 막기 위해 후보가 아니라 <strong>보관만, 전송하지 않음</strong>으로 표시합니다.
              </dd>
              <dt>결제완료 판단 응답 끊김 · payment-decision canceled</dt>
              <dd>
                사용자가 결제 완료 버튼을 눌렀는데 우리 서버 응답이 늦거나 끊겨서 결제완료 판단이 안 된 상태.
                매출은 잡혔어도 브라우저 Purchase 발화가 막힐 수 있음.
              </dd>
              <dt>원장 매칭 실패 · no_ledger_match</dt>
              <dd>
                Meta CAPI 로 보낸 주문번호가 우리 VM 원장에서 못 찾는 row. 0% 면 정합성 정상.
              </dd>
              <dt>strong_meta_ad_evidence · 강한 Meta 광고 증거</dt>
              <dd>
                fbclid 또는 fbc 또는 Meta UTM 중 하나 이상이 잡힌 주문. 이 주문은 Meta 광고로 들어왔다는 점을 입증.
              </dd>
              <dt>non_meta_or_unproven_meta · 비-Meta 또는 미입증</dt>
              <dd>
                fbp 만 있거나 다른 채널(구글/네이버) evidence 가 더 강한 주문. 광고 귀속이 약한 그룹.
              </dd>
              <dt>safe_ref</dt>
              <dd>
                주문번호의 안전한 약식 표기 (앞 8자만). raw 주문번호/결제키/회원코드는 화면 노출 금지.
              </dd>
              <dt>광고 매니저 ROAS · Ads Manager ROAS</dt>
              <dd>
                Meta 가 광고 매니저 화면에서 보여주는 attributed ROAS. <strong>내부 ROAS 와 source 가 다름</strong>.
                내부 ROAS = VM 원장 결제완료 매출 ÷ Meta 광고비.
              </dd>
            </dl>
          </div>
        )}
      </div>

      {/* 컨트롤 바 */}
      <div className={styles.controls}>
        <span className={styles.controlLabel}>사이트</span>
        <select
          value={site}
          onChange={(e) => {
            const next = e.target.value as "biocom" | "thecleancoffee" | "all_sites";
            // site 변경 시 stale 데이터를 즉시 비워서 사용자가 이전 site 카드/배너를 보지 않게.
            // 이후 useEffect 가 새 loadData / loadMetaRoas 를 site 인자로 다시 발화.
            setData(null);
            setError(null);
            setMetaRoasToday(null);
            setMetaRoasYesterday(null);
            setMetaRoasLast7d(null);
            setMetaRoasAux({ today: initialAux, yesterday: initialAux, last_7d: initialAux });
            setExpandedStep(null);
            setSite(next);
          }}
        >
          <option value="biocom">바이오컴</option>
          <option value="thecleancoffee">더클린커피</option>
          <option value="all_sites">전체 (all_sites · pixel 합산)</option>
        </select>

        <span className={styles.controlLabel}>기간</span>
        <select value={windowKey} onChange={(e) => setWindowKey(e.target.value as typeof windowKey)}>
          <option value="1d">오늘</option>
          <option value="7d">최근 7일</option>
          <option value="14d">최근 14일</option>
          <option value="30d">최근 30일</option>
        </select>

        <span className={styles.controlLabel}>집계</span>
        <select value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)}>
          <option value="day">일별</option>
          <option value="week">주별</option>
        </select>

        <span className={styles.controlLabel}>결제수단</span>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="all">전체</option>
          <option value="card">카드</option>
          <option value="npay">NPay</option>
          <option value="virtual_account">가상계좌</option>
          <option value="bank_transfer">계좌이체</option>
          <option value="other">기타</option>
        </select>

        <span className={styles.controlLabel}>유입</span>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">전체</option>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
          <option value="naver">Naver</option>
          <option value="organic">Organic</option>
          <option value="direct">Direct</option>
          <option value="utm_present">UTM 있음</option>
          <option value="utm_missing">UTM 없음</option>
        </select>

        <button className={styles.reloadBtn} onClick={() => void loadData()} disabled={loading}>
          {loading ? "조회 중…" : "조회"}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <strong>API 호출이 실패했습니다.</strong>
          <div style={{ marginTop: 6 }}>{error}</div>
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55 }}>
            backend endpoint: <code>{API_BASE}</code>
            <br />
            • 화면이 한 번 켜진 적 있는데 갑자기 실패: <strong>backend 일시적 재시작 또는 Meta API 호출 제한</strong> 가능성. 잠시 후 다시 시도.
            <br />
            • 처음부터 실패하고 <code>localhost:7020</code> 으로 표시되면: 로컬 개발 환경인데 backend 가 안 켜진 상태. <code>cd backend && npm run dev</code>.
          </div>
          <button
            type="button"
            className={styles.errorRetryBtn}
            onClick={() => {
              setError(null);
              void loadData();
              void loadMetaRoas();
            }}
          >
            ↻ 다시 시도
          </button>
        </div>
      )}

      {((loading || metaRoasLoading || loadingProgress > 0) && !error) && (
        <div className={styles.loadingBox}>
          <div className={styles.loadingHead}>
            <span className={styles.loadingSpinner} />
            <strong>{loadingStep || "데이터를 불러오는 중"}</strong>
            <span className={styles.loadingPct}>{loadingProgress}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className={styles.loadingSub}>
            VM Cloud attribution_ledger · Meta CAPI send log · Meta Insights API 를 순차적으로 호출합니다.
            Meta ROAS 3개는 Meta API 직접 호출이라 합쳐서 10–17초까지 걸릴 수 있습니다.
          </div>
        </div>
      )}

      {data && (
        <>
          {/* 상단 판단 바 */}
          <div className={`${styles.statusBar} ${statusClass(data.status.label)}`}>
            <div className={styles.statusHead}>
              <span className={`${styles.statusBadge} ${statusClass(data.status.label)}`}>
                {data.status.label}
              </span>
              <span className={styles.statusIssue}>{data.status.main_issue}</span>
            </div>
            <div className={styles.statusAction}>
              <strong>지금 할 일</strong>: {data.status.next_action}
            </div>
            <div className={styles.statusMeta}>
              기준 {data.checked_at_kst} KST · source: {data.source_summary.primary} · 신선도{" "}
              {data.source_summary.freshness} · 자신감 {data.source_summary.confidence}
              {data.source_summary.latest_logged_at_kst && (
                <>
                  {" · "}최신 row{" "}
                  <strong>{data.source_summary.latest_logged_at_kst}</strong>
                  {data.source_summary.latest_logged_age_hours !== null && (
                    <> (약 {Math.round(data.source_summary.latest_logged_age_hours / 24)}일 전)</>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Option B 캐시 배너 — 데이터 기준 시각 + 강제 새로고침 */}
          {data.cache && (
            <div className={`${styles.cacheBanner} ${data.cache.cached ? styles.cacheBannerCached : styles.cacheBannerLive}`}>
              <div className={styles.cacheBannerHead}>
                {data.cache.cached ? (
                  <>
                    <span className={`${styles.sourceBadge} ${styles.sourceContract}`}>cached</span>
                    <strong>데이터 기준 {data.cache.cached_at_kst} KST</strong>
                    <span className={styles.muted}>
                      · 다음 갱신 {data.cache.next_refresh_at_kst ?? "—"} KST
                      {" "}· 백그라운드 사전 집계 (in_memory_precompute, 5분 주기)
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`${styles.sourceBadge} ${styles.sourceAmber}`}>live</span>
                    <strong>실시간 계산 응답</strong>
                    <span className={styles.muted}>
                      · 계산 시간 {data.cache.generation_ms}ms
                      {" "}· source: {data.cache.source}
                      {" "}· 캐시 hit 이 아닙니다. (옵션 변경 또는 강제 새로고침)
                    </span>
                  </>
                )}
                <button
                  type="button"
                  className={styles.forceRefreshBtn}
                  disabled={forceRefreshCooldownMs - forceRefreshTick > 0}
                  onClick={() => {
                    setForceRefreshFlag((n) => n + 1);
                    setForceRefreshCooldownMs(Date.now() + 5 * 60 * 1000); // 5분
                    setForceRefreshTick(Date.now());
                  }}
                >
                  {forceRefreshCooldownMs - forceRefreshTick > 0
                    ? `↻ 강제 새로고침 (쿨다운 ${Math.ceil((forceRefreshCooldownMs - forceRefreshTick) / 1000)}초)`
                    : "↻ 지금 강제 새로고침"}
                </button>
              </div>
              <div className={styles.cacheBannerBody}>
                {data.cache.cached
                  ? "백엔드가 5분마다 site × window 조합을 미리 계산해 두고, 사용자 요청은 그 결과를 그대로 읽어 < 50ms 안에 응답합니다. 신선도와 응답 속도를 동시에 잡는 패턴입니다. (아임웹 유입 분석 같은 사전 집계 방식)"
                  : "이 응답은 캐시가 아닌 실시간 계산입니다. 백엔드 startup 직후이거나, 사용자 옵션이 사전 집계 대상이 아니거나, 강제 새로고침을 누른 경우입니다."}
              </div>
            </div>
          )}

          {/* metric_contract 상단 요약 — Codex backend v6 live contract */}
          {data.metric_contract && (
            <div className={styles.metricContract}>
              <div className={styles.metricContractHead}>
                <span className={`${styles.sourceBadge} ${styles.sourceContract}`}>metric_contract</span>
                <strong>
                  site={data.metric_contract.site}
                  {data.metric_contract.all_sites_mode && " · all_sites_mode=true (pixel 합산)"}
                </strong>
                <span className={styles.muted}>
                  · pixel_ids=[{data.metric_contract.pixel_ids.length > 0 ? data.metric_contract.pixel_ids.join(", ") : "—"}]
                  {" "}· window={data.metric_contract.window}
                  {" "}· last_updated_at {data.metric_contract.last_updated_at} KST
                </span>
              </div>
              <div className={styles.metricContractBody}>
                Codex backend live contract v6 가 응답을 보내고 있습니다. 각 KPI 의 source/unit/window/site/pixel_id 가 명시되어
                있으며, CAPI send log 는 site 별 Pixel ID 로 먼저 필터합니다 — 바이오컴/더클린커피 send 가 더 이상 섞이지 않습니다.
              </div>
            </div>
          )}

          {/* Meta ROAS — Internal source 와 Ads Manager source 분리 표시 */}
          <div className={styles.metaRoasSection}>
            <div className={styles.metaRoasHead}>
              <div>
                <strong>Meta ROAS 두 source 비교</strong>{" "}
                <span className={styles.muted}>
                  · {siteLabelKo(data.site)}
                  {" "}· account {META_ACCOUNT_BY_SITE[data.site] ?? "—"}
                </span>
              </div>
              <button className={styles.csvBtn} onClick={() => void loadMetaRoas()} disabled={metaRoasLoading}>
                {metaRoasLoading ? "조회 중…" : "재조회"}
              </button>
            </div>

            {/* Row 1: Internal Meta ROAS — 현재 화면 윈도우 기준 (VM confirmed) */}
            <div className={styles.roasRowHead}>
              <span className={`${styles.sourceBadge} ${styles.sourceInternal}`}>internal</span>
              <strong>VM 내부 매출 (confirmed purchase)</strong>
              <span className={styles.muted}>
                · 현재 화면 윈도우({data.period_label}) 기준 · funnel-health 의 KPI &quot;실제 결제완료&quot; 와 같은 row
              </span>
            </div>
            <div className={styles.internalRoasLine}>
              <div className={styles.internalRoasField}>
                <span className={styles.internalRoasLabel}>VM 확정 매출</span>
                <span className={styles.internalRoasValue}>{fmtKRW(data.kpis.confirmed_purchases.amount_krw)}</span>
              </div>
              <div className={styles.internalRoasField}>
                <span className={styles.internalRoasLabel}>주문</span>
                <span className={styles.internalRoasValue}>{fmtNum(data.kpis.confirmed_purchases.count)}건</span>
              </div>
              <div className={styles.internalRoasField}>
                <span className={styles.internalRoasLabel}>광고비 / ROAS 비율</span>
                <span className={`${styles.internalRoasValue} ${styles.muted}`}>
                  Codex data contract 대기 (site/pixel filter 미적용)
                </span>
              </div>
            </div>

            {/* Row 2: 내부 Meta 귀속 ROAS — /api/ads/roas (VM confirmed purchase + Meta spend) */}
            <div className={styles.roasRowHead} style={{ marginTop: 12 }}>
              <span className={`${styles.sourceBadge} ${styles.sourceInternalAttr}`}>internal_attr</span>
              <strong>내부 Meta 귀속 ROAS</strong>
              <span className={styles.muted}>
                · 기본은 <strong>어제 사전 계산값</strong> · endpoint <code>/api/ads/roas-summary</code>{" "}
                · 당일 데이터는 버튼을 눌렀을 때 4시간 단위 캐시를 읽습니다
              </span>
            </div>
            <div className={styles.roasModeBar}>
              <div className={styles.roasBasisText}>
                <strong>
                  {metaRoasView === "today" ? "당일 데이터" : "기본 화면: 어제 데이터"}
                </strong>
                <span>
                  기준 데이터 날짜 {metaRoasView === "today" ? getKstIsoDate(0) : getKstIsoDate(-1)} KST
                  {" "}· 사전 계산 cache 우선 · 광고 플랫폼 주장값이 아닌 내부 귀속 계산값
                </span>
              </div>
              <div className={styles.roasModeBtns} aria-label="Meta ROAS 표시 기간">
                <button
                  type="button"
                  className={`${styles.roasModeBtn} ${metaRoasView === "yesterday" ? styles.roasModeBtnActive : ""}`}
                  onClick={() => setMetaRoasView("yesterday")}
                  disabled={metaRoasLoading && metaRoasView === "yesterday"}
                >
                  어제 데이터 보기
                </button>
                <button
                  type="button"
                  className={`${styles.roasModeBtn} ${metaRoasView === "today" ? styles.roasModeBtnActive : ""}`}
                  onClick={() => setMetaRoasView("today")}
                  disabled={metaRoasLoading && metaRoasView === "today"}
                >
                  당일 데이터 보기
                </button>
              </div>
            </div>
            <div className={styles.metaRoasGrid}>
              {metaRoasView === "today" ? (
                <MetaRoasCard
                  title="오늘 · 4시간 단위 사전 계산"
                  preset="today"
                  data={metaRoasToday}
                  lastSuccess={metaRoasAux.today.lastSuccess}
                  failCount={metaRoasAux.today.failCount}
                  cooldownLeftMs={Math.max(0, metaRoasAux.today.cooldownUntilMs - cooldownTickMs)}
                  onRetry={() => void retryMetaRoas("today")}
                  caveatLag={
                    data.risk_combo.server_capi_active
                      ? "당일 값은 Meta 집계 지연과 4시간 cache 주기 때문에 Ads Manager 화면보다 늦거나 다르게 보일 수 있습니다."
                      : "Meta same-day 집계 lag 가능"
                  }
                />
              ) : (
                <MetaRoasCard
                  title="어제 · 기본 사전 계산값"
                  preset="yesterday"
                  data={metaRoasYesterday}
                  lastSuccess={metaRoasAux.yesterday.lastSuccess}
                  failCount={metaRoasAux.yesterday.failCount}
                  cooldownLeftMs={Math.max(0, metaRoasAux.yesterday.cooldownUntilMs - cooldownTickMs)}
                  onRetry={() => void retryMetaRoas("yesterday")}
                />
              )}
            </div>
            <div className={styles.legendRow}>
              <span>
                💡 이 row 의 ROAS 는 <strong>내부 attribution</strong> 기반입니다 (VM confirmed purchase 분자 + Meta spend 분모).
                Meta Ads Manager 화면의 attributed ROAS 는 별도 source 이며 같지 않습니다.
                기본 화면은 어제 값만 읽어 느린 당일 API 호출을 피하고, 당일 값은 필요할 때만 버튼으로 확인합니다.
              </span>
            </div>
          </div>

          {/* 빈 상태 진단 카드 */}
          {data.empty_state_diagnostic.is_empty && (
            <div className={styles.emptyDiagnostic}>
              <div className={styles.emptyTitle}>
                <span className={styles.emptyIcon}>🔎</span>
                이 화면이 비어 있는 이유
              </div>
              <div className={styles.emptyMsg}>{data.empty_state_diagnostic.human_label}</div>
              <div className={styles.emptyAction}>
                <strong>지금 할 일</strong>: {data.empty_state_diagnostic.next_action}
              </div>
              <div className={styles.emptyDetail}>
                전체 ledger row {fmtNum(data.empty_state_diagnostic.detail.total_rows_all_time)}건
                · window 안 row {fmtNum(data.empty_state_diagnostic.detail.rows_in_window_before_filters)}건
                · 필터 적용 후 {fmtNum(data.empty_state_diagnostic.detail.rows_after_filters)}건
                {data.empty_state_diagnostic.detail.window_start_kst && (
                  <> · window 시작 {data.empty_state_diagnostic.detail.window_start_kst} KST</>
                )}
              </div>
            </div>
          )}

          {/* KPI 카드 6개 — 카드마다 (기간/단위/기준/source) 명시 */}
          <div className={styles.kpiGrid}>
            <KpiCard
              title="VM Cloud 주문 신호"
              value={fmtNum(data.kpis.vm_order_signals.count)}
              unit={data.kpis.vm_order_signals.unit}
              period={data.period_label}
              basis={data.kpis.vm_order_signals.basis}
              source={data.kpis.vm_order_signals.source}
              badge="refer"
              badgeLabel="참고용"
            />
            <KpiCard
              title="결제 페이지 도달"
              value={fmtNum(data.kpis.payment_started.count)}
              unit={data.kpis.payment_started.unit}
              period={data.period_label}
              basis={data.kpis.payment_started.basis}
              source={data.kpis.payment_started.source}
              badge="refer"
              badgeLabel="참고용"
            />
            <KpiCard
              title="실제 결제완료"
              value={`${fmtNum(data.kpis.confirmed_purchases.count)} · ${fmtKRW(data.kpis.confirmed_purchases.amount_krw)}`}
              unit={data.kpis.confirmed_purchases.unit}
              period={data.period_label}
              basis={data.kpis.confirmed_purchases.basis}
              source={data.kpis.confirmed_purchases.source}
              badge="budget"
              badgeLabel="예산 판단 가능"
            />
            <KpiCard
              title="Meta로 구매 신호 전송 성공 (Meta CAPI)"
              value={fmtNum(data.kpis.meta_capi_success.count)}
              unit={data.kpis.meta_capi_success.unit}
              period={data.period_label}
              basis={`${data.kpis.meta_capi_success.basis} · events_received=${fmtNum(data.kpis.meta_capi_success.events_received)}`}
              source={data.kpis.meta_capi_success.source}
              badge={data.kpis.confirmed_purchases.count > 0 && data.kpis.meta_capi_success.count === 0 ? "fix" : "refer"}
              badgeLabel={data.kpis.confirmed_purchases.count > 0 && data.kpis.meta_capi_success.count === 0 ? "조치 필요" : "참고용"}
            />
            <KpiCard
              title="브라우저 구매 발화 (Browser Purchase)"
              value={fmtNum(data.kpis.browser_purchase.count)}
              unit={data.kpis.browser_purchase.unit}
              period={data.period_label}
              basis={
                data.risk_combo.state === "server_only_missing" || data.risk_combo.state === "all_missing"
                  ? "🔴 Server CAPI 도 0 — 결제 신호가 Meta 에 닿지 않습니다. 즉시 점검"
                  : data.risk_combo.server_capi_active
                    ? "🟡 보조 경로 미복구 — 서버 CAPI 가 구매 신호를 대체 전송 중이라 치명 장애 아님. 시간 여유 있을 때 브라우저 픽셀 발화 점검"
                    : data.kpis.browser_purchase.basis
              }
              source={data.kpis.browser_purchase.source}
              badge={
                data.risk_combo.state === "server_only_missing" || data.risk_combo.state === "all_missing"
                  ? "fix"
                  : "refer"
              }
              badgeLabel={
                data.risk_combo.state === "server_only_missing" || data.risk_combo.state === "all_missing"
                  ? "긴급 점검"
                  : data.risk_combo.server_capi_active
                    ? "보조 경로 미복구 (Yellow · 치명 아님)"
                    : "수집 대기"
              }
            />
            <KpiCard
              title="미해결 누수"
              value={`${fmtNum(data.unresolved_leaks.total_count)}${data.unresolved_leaks.total_amount_krw > 0 ? " · " + fmtKRW(data.unresolved_leaks.total_amount_krw) : ""}`}
              unit={"건 합계"}
              period={data.period_label}
              basis={
                "Click ID 누락 + Decision canceled + Confirmed but CAPI missing 합산. " +
                "윗쪽 '매칭 안 된 흐름' 정의보다 넓은 누수 풀입니다."
              }
              source={"drilldown [B] 진단 hint 합산"}
              badge={data.unresolved_leaks.total_count > 0 ? "fix" : "refer"}
              badgeLabel={data.unresolved_leaks.total_count > 0 ? "조치 필요" : "정상"}
            />
          </div>

          {data.checkout_signal_split && (
            <div className={styles.checkoutSplit}>
              <div className={styles.checkoutSplitHead}>
                <div>
                  <h2 className={styles.sectionTitle}>결제 시작 화면 신호를 3개로 나눠 봅니다</h2>
                  <p className={styles.sectionSub}>
                    내부 원장이 본 화면 도달, Meta가 받은 InitiateCheckout, 앞으로 서버 CAPI로 보낼 수 있는 후보는 서로 다른 숫자입니다.
                  </p>
                </div>
                <span className={styles.checkoutSplitBadge}>no-send preview</span>
              </div>
              <div className={styles.checkoutSplitGrid}>
                {[
                  data.checkout_signal_split.vm_payment_page_reached,
                  data.checkout_signal_split.meta_initiate_checkout_received,
                  data.checkout_signal_split.meta_capi_initiate_checkout_candidate,
                ].map((item) => (
                  <div key={item.label} className={styles.checkoutSplitCard}>
                    <div className={styles.checkoutSplitLabel}>{item.label}</div>
                    <div className={styles.checkoutSplitValue}>{fmtOptionalNum(item.count)}</div>
                    <div className={styles.checkoutSplitMeta}>{item.basis}</div>
                    <div className={styles.checkoutSplitCaveat}>{item.caveat}</div>
                  </div>
                ))}
              </div>
              {data.checkout_signal_split.summary && (
                <div className={styles.checkoutSplitSummary}>
                  <strong>
                    {fmtNum(data.checkout_signal_split.summary.raw_payment_page_rows)}건 중{" "}
                    {fmtNum(data.checkout_signal_split.summary.final_candidate_rows)}건만 남김
                  </strong>
                  <span>
                    최종 후보율 {fmtPct(data.checkout_signal_split.summary.final_candidate_rate)} · 제외/중복 제거{" "}
                    {fmtNum(data.checkout_signal_split.summary.excluded_rows)}건
                  </span>
                  <small>{data.checkout_signal_split.summary.caveat}</small>
                </div>
              )}
              {data.checkout_signal_split.ordered_exclusion_steps && data.checkout_signal_split.ordered_exclusion_steps.length > 0 && (
                <div className={styles.checkoutSplitOrdered}>
                  <div className={styles.checkoutSplitOrderedHead}>
                    <strong>왜 최종 후보가 줄어드는가</strong>
                    <span>위에서 아래로 순서대로 걸러낸 값입니다. 같은 row를 여러 원인에 중복 집계하지 않습니다.</span>
                  </div>
                  {data.checkout_signal_split.ordered_exclusion_steps.map((step) => (
                    <div key={`${step.step}-${step.reason}`} className={styles.checkoutSplitStep}>
                      <div className={styles.checkoutStepIndex}>{step.step}</div>
                      <div className={styles.checkoutStepBody}>
                        <div className={styles.checkoutStepTitle}>
                          <span>{step.label}</span>
                          <em className={styles[`checkoutEffect_${step.effect}`] ?? styles.checkoutEffect_keep}>
                            {step.effect === "start"
                              ? "분모"
                              : step.effect === "exclude"
                                ? "제외"
                                : step.effect === "dedupe"
                                  ? "중복 제거"
                                  : "후보"}
                          </em>
                        </div>
                        <div className={styles.checkoutStepMeta}>
                          <strong>{fmtNum(step.count)}건</strong>
                          <span>결제 페이지 도달 대비 {fmtPct(step.rate_of_payment_page_reached)}</span>
                        </div>
                        <p>{step.explanation_ko}</p>
                        <small>다음 조치: {step.next_action_ko}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {data.checkout_signal_split.root_causes.length > 0 && (
                <div className={styles.checkoutSplitReasons}>
                  {data.checkout_signal_split.root_causes.map((reason) => (
                    <div key={reason.reason} className={styles.checkoutSplitReason}>
                      <strong>{fmtNum(reason.count)}건</strong>
                      <span>{reason.explanation_ko}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 위험 조합 (Server CAPI × Browser Purchase) */}
          <div className={`${styles.riskCombo} ${styles[`risk_${data.risk_combo.state}`] ?? ""}`}>
            <div className={styles.riskComboHead}>
              <span className={styles.riskComboBadge}>위험 조합</span>
              <strong>{data.risk_combo.human_label}</strong>
            </div>
            <div className={styles.riskComboBody}>
              <span className={styles.riskChip}>
                서버→Meta 전송 (Server CAPI) {data.risk_combo.server_capi_active ? "✅ 정상" : "❌ 0건"}
              </span>
              <span className={styles.riskChip}>
                브라우저 구매 발화 (Browser Purchase) {data.risk_combo.browser_purchase_active ? "✅ 정상" : "⚠️ 0건"}
              </span>
              <span className={styles.riskComboExplain}>{data.risk_combo.explanation_ko}</span>
            </div>
          </div>

          {/* 오늘의 액션 큐 — 대시보드를 운영 지휘판으로 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>오늘의 액션 큐</h2>
            <p className={styles.sectionSub}>
              상태판이 아니라 운영 지휘판입니다. 우선순위(Critical / High / Medium / Watch)는 데이터 기반으로 자동 분류됩니다.
              아래는 항상 점검되는 4 카테고리이며, 해당하는 row 가 있을 때만 카드로 채워집니다.
            </p>
            <div className={styles.actionLegend}>
              <span className={`${styles.actionBadge} ${styles.badge_critical}`}>긴급 (CRITICAL)</span>
              결제는 됐는데 Meta 로 안 보내진 주문
              <span className={styles.actionLegendDivider}>·</span>
              <span className={`${styles.actionBadge} ${styles.badge_high}`}>높음 (HIGH)</span>
              결제 페이지에서 완료 판단 응답이 끊긴 케이스
              <span className={styles.actionLegendDivider}>·</span>
              <span className={`${styles.actionBadge} ${styles.badge_medium}`}>보통 (MEDIUM)</span>
              광고 클릭 식별자가 빠진 결제완료
              <span className={styles.actionLegendDivider}>·</span>
              <span className={`${styles.actionBadge} ${styles.badge_watch}`}>모니터 (WATCH)</span>
              브라우저 구매 신호 0 이지만 서버 CAPI 정상 (치명 아님)
            </div>
            {data.action_queue.length > 0 ? (
              <div className={styles.actionList}>
                {data.action_queue.map((a, i) => {
                  const prioLabel: Record<string, string> = {
                    critical: "긴급",
                    high: "높음",
                    medium: "보통",
                    watch: "모니터",
                  };
                  const easyNext = humanizeActionText(a.next_action);
                  const actionKey = a.key || `${a.title}-${i}`;
                  const hasDetails = Array.isArray(a.details) && a.details.length > 0;
                  const isExpanded = expandedActionKey === actionKey;
                  return (
                    <div key={actionKey} className={`${styles.actionItem} ${styles[`prio_${a.priority}`]}`}>
                      <button
                        type="button"
                        className={`${styles.actionHead} ${styles.actionHeadButton}`}
                        onClick={() => hasDetails && setExpandedActionKey(isExpanded ? null : actionKey)}
                        aria-expanded={hasDetails ? isExpanded : undefined}
                        disabled={!hasDetails}
                        title={hasDetails ? "상세 row 펼치기" : "이 항목은 상세 row가 없습니다"}
                      >
                        <span className={`${styles.actionBadge} ${styles[`badge_${a.priority}`]}`}>
                          {prioLabel[a.priority] ?? a.priority.toUpperCase()}
                        </span>
                        <strong>{a.title}</strong>
                        <span className={styles.actionDetail}>{a.detail}</span>
                        {hasDetails && (
                          <span className={styles.actionExpandHint}>
                            {isExpanded ? "상세 접기" : `${a.details?.length ?? 0}건 상세 보기`}
                          </span>
                        )}
                      </button>
                      <div className={styles.actionWhy}>
                        <strong>이게 왜 중요한지</strong>: {a.explanation_ko}
                      </div>
                      <div className={styles.actionNext}>
                        <strong>지금 할 일 (쉬운 풀이)</strong>: {easyNext}
                      </div>
                      {easyNext !== a.next_action && (
                        <div className={styles.actionNextTechnical}>
                          <strong>원문 (기술 용어)</strong>: <code>{a.next_action}</code>
                        </div>
                      )}
                      {hasDetails && isExpanded && (
                        <div className={styles.actionDetailPanel}>
                          <div className={styles.actionDetailPanelHead}>
                            <strong>상세 row</strong>
                            <span>
                              raw 주문번호·결제키·click id는 숨기고 safe_ref만 표시합니다. 기준: VM Cloud attribution_ledger + Meta CAPI send log.
                            </span>
                          </div>
                          <div className={styles.actionDetailTableWrap}>
                            <table className={`${styles.table} ${styles.tableSmall}`}>
                              <thead>
                                <tr>
                                  <th>safe_ref</th>
                                  <th>결제완료 시각</th>
                                  <th className={styles.num}>금액</th>
                                  <th>결제수단</th>
                                  <th>유입 근거</th>
                                  <th>증거</th>
                                  <th>확정 근거</th>
                                  <th>왜 빠졌나</th>
                                  <th>다음 조치</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.details?.map((row, detailIndex) => (
                                  <tr key={`${row.safe_ref}-${row.logged_at_kst}-${detailIndex}`}>
                                    <td><code>{row.safe_ref}</code></td>
                                    <td>{row.logged_at_kst}</td>
                                    <td className={styles.num}>{fmtKRW(row.amount_krw)}</td>
                                    <td>{row.payment_method_label}</td>
                                    <td>{row.source_label}</td>
                                    <td>{row.evidence.join(" · ")}</td>
                                    <td>{row.confirmed_basis}</td>
                                    <td>{row.missing_reason}</td>
                                    <td>{row.recommended_action}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.actionEmpty}>
                <strong>✅ 현재 활성 액션 없음.</strong> Critical/High/Medium/Watch 4 카테고리 모두 비어 있습니다.
                risk_combo / unresolved_leaks 가 변하면 이 자리가 자동으로 채워집니다.
              </div>
            )}
          </div>

          {/* 오늘 주문 신호 테이블 (placeholder — backend daily_order_signal API 대기) */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>
                  오늘 주문 신호 테이블
                  <span className={`${styles.statePill} ${styles.statePillWaiting}`}>backend daily_order_signal API 대기</span>
                </h2>
                <p className={styles.sectionSub}>
                  주문 단위로 evidence / CAPI status / Browser Purchase / payment-decision 을 한 줄에서 보는 운영 테이블입니다.
                  <strong> raw order_no / payment_key / member / click_id 는 노출 금지</strong>이며 safe_ref 만 표시합니다.
                </p>
              </div>
            </div>

            {/* 필터 UI (data 없어도 자리 표시) */}
            <div className={styles.signalFilter}>
              {[
                { key: "all", label: "전체" },
                { key: "meta_strong", label: "Meta strong only" },
                { key: "capi_missing", label: "CAPI missing" },
                { key: "browser_missing", label: "Browser Purchase missing" },
                { key: "confirmed", label: "Confirmed only" },
                { key: "pending", label: "Pending / Unpaid" },
              ].map((f) => (
                <button key={f.key} type="button" className={styles.signalFilterBtn} disabled>
                  {f.label}
                </button>
              ))}
            </div>

            <table className={`${styles.table} ${styles.tableSmall}`}>
              <thead>
                <tr>
                  <th>time</th>
                  <th>safe_ref</th>
                  <th className={styles.num}>amount</th>
                  <th>payment_method</th>
                  <th>payment_status</th>
                  <th>source_bucket</th>
                  <th>evidence</th>
                  <th>capi_status</th>
                  <th className={styles.num}>events_received</th>
                  <th>browser_purchase</th>
                  <th>payment_decision</th>
                  <th>action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={12} className={styles.signalEmpty}>
                    <div className={styles.signalEmptyTitle}>📥 backend daily_order_signal API 미연결</div>
                    <div className={styles.signalEmptyBody}>
                      현재 funnel-health 응답에는 주문 단위 row 가 없습니다. backend 가{" "}
                      <code>daily_order_signal</code> 또는 <code>order_signals</code> 필드를 추가하면 이 표가 자동으로 채워집니다.
                      <br />
                      필요 컬럼: time / safe_ref / amount / payment_method / payment_status / source_bucket
                      (strong_meta_ad_evidence / non_meta_or_unproven_meta / no_ledger_match / google / naver / organic / unknown) /
                      evidence (fbc, fbclid, meta_utm, gclid, naver, utm) / capi_status (sent / missing / duplicate / no_send_guard) /
                      events_received / browser_purchase / payment_decision / action (ok / backfill_candidate / investigate / no_send).
                      <br />
                      <strong>raw order_no / payment_key / member / click_id 는 절대 노출하지 않고 safe_ref(8자 prefix) 로만 전송</strong>해야 합니다.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 퍼널 차트 — A/B 토글 */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>퍼널 단계별 신호</h2>
                <p className={styles.sectionSub}>
                  단계명을 클릭하면 해당 단계의 원인 패널이 펼쳐집니다. 아래 토글로 <strong>전체 주문</strong>과{" "}
                  <strong>광고 귀속 주문</strong> 두 가지 모수를 분리해 볼 수 있습니다.
                </p>
                <div className={styles.viewToggle}>
                  <button
                    type="button"
                    title="ledger 전체 신호 (organic + direct + paid)"
                    className={`${styles.viewToggleBtn} ${funnelView === "all_traffic" ? styles.viewToggleActive : ""}`}
                    onClick={() => setFunnelView("all_traffic")}
                  >
                    A. 전체 주문 퍼널
                  </button>
                  <button
                    type="button"
                    title="fbclid/gclid/ttclid/utm 광고 evidence 가 있는 ledger 만"
                    className={`${styles.viewToggleBtn} ${funnelView === "paid_attributed" ? styles.viewToggleActive : ""}`}
                    onClick={() => setFunnelView("paid_attributed")}
                  >
                    B. 광고 귀속 퍼널
                  </button>
                </div>
                {(() => {
                  const allConfirmed = data.funnel_views.all_traffic.steps.find((s) => s.step === "confirmed_purchase")?.count ?? 0;
                  const paidConfirmed = data.funnel_views.paid_attributed.steps.find((s) => s.step === "confirmed_purchase")?.count ?? 0;
                  const evidenceRate = allConfirmed > 0 ? Math.round((paidConfirmed / allConfirmed) * 1000) / 10 : null;
                  return (
                    <div className={styles.funnelCaveat}>
                      <strong>주의 — 모수가 다릅니다.</strong> A 는 모든 ledger 신호, B 는 광고 click evidence 가 잡힌 row 만입니다.{" "}
                      B 가 A 보다 작은 것은 정상이며, B/A 비율이 <strong>광고 evidence 보유율</strong>입니다.
                      {evidenceRate !== null && (
                        <>
                          {" "}현재 confirmed 기준 보유율: <strong>{evidenceRate.toFixed(1)}%</strong> (A {fmtNum(allConfirmed)} → B {fmtNum(paidConfirmed)}).
                        </>
                      )}{" "}이 비율이 너무 낮으면 광고 link UTM/click id capture 정합성 점검이 필요합니다.
                    </div>
                  );
                })()}
                <p className={`${styles.sectionSub} ${styles.muted}`} style={{ marginTop: 6 }}>
                  {data.funnel_views[funnelView].explanation_ko}
                </p>
              </div>
              <button
                className={styles.csvBtn}
                onClick={() =>
                  downloadCsv(
                    `funnel_steps_${data.site}_${data.window}_${data.granularity}_${funnelView}.csv`,
                    data.funnel_views[funnelView].steps.map((f) => ({
                      view: funnelView,
                      step: f.step,
                      label: f.label,
                      count: f.count,
                      rate_from_previous: f.rate_from_previous,
                      status: f.status,
                    })),
                  )
                }
              >
                CSV 내보내기
              </button>
            </div>
            <div className={styles.funnel}>
              {data.funnel_views[funnelView].steps.map((step) => {
                const maxC = Math.max(
                  1,
                  ...data.funnel_views[funnelView].steps.map((s) => s.count),
                );
                const width = `${Math.max(1, Math.round((step.count / maxC) * 100))}%`;
                const isExpanded = expandedStep === step.step;
                const detail = describeStepDetail(step.step, data);
                return (
                  <div key={step.step}>
                    <button
                      type="button"
                      className={`${styles.funnelRow} ${styles.funnelRowButton} ${isExpanded ? styles.funnelRowExpanded : ""}`}
                      onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                      aria-expanded={isExpanded}
                    >
                      <div className={styles.funnelLabel}>
                        <span className={styles.funnelToggle}>{isExpanded ? "▾" : "▸"}</span>
                        {step.label}
                      </div>
                      <div className={styles.funnelBarShell}>
                        <div className={funnelBarClass(step.status)} style={{ width }} />
                      </div>
                      <div className={styles.funnelCount}>{fmtNum(step.count)}</div>
                      <div className={styles.funnelRate}>{fmtPct(step.rate_from_previous)}</div>
                      <div className={styles.funnelStatus}>
                        {step.status === "normal" && <span style={{ color: "#16a34a" }}>정상</span>}
                        {step.status === "warning" && <span style={{ color: "#d97706" }}>주의</span>}
                        {step.status === "alert" && <span style={{ color: "#dc2626" }}>긴급</span>}
                        {step.status === "unknown" && <span style={{ color: "#64748b" }}>불명</span>}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className={styles.funnelDetail}>
                        <div className={styles.funnelDetailHead}>{detail.title}</div>
                        <div className={styles.funnelDetailDesc}>{detail.description}</div>
                        {detail.rows.length > 0 && (
                          <table className={`${styles.table} ${styles.tableSmall}`}>
                            <thead>
                              <tr>
                                {detail.headers.map((h) => (
                                  <th key={h} className={h === "건수" || h === "금액" ? styles.num : ""}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.rows.map((row, i) => (
                                <tr key={i}>
                                  {row.map((cell, j) => (
                                    <td key={j} className={detail.numCols.has(j) ? styles.num : ""}>
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {detail.rows.length === 0 && (
                          <div className={styles.muted}>이 단계에 분류된 표본/사유가 없습니다.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 일별/주별 추세 */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>
                  {granularity === "week" ? "주별 추세" : "일별 추세"}
                </h2>
                <p className={styles.sectionSub}>
                  결제 페이지 도달 / 실제 결제완료 / Meta CAPI 성공 / 매칭 안 된 흐름의 추세를 같은 축에서 비교합니다.
                </p>
              </div>
              <button
                className={styles.csvBtn}
                disabled={data.series.length === 0}
                onClick={() =>
                  downloadCsv(
                    `funnel_series_${data.site}_${data.window}_${data.granularity}.csv`,
                    data.series,
                  )
                }
              >
                CSV 내보내기
              </button>
            </div>
            {data.series.length === 0 ? (
              <div className={styles.muted}>이 기간에는 row가 없습니다.</div>
            ) : (
              <>
                <div className={styles.legendRow}>
                  <span className={styles.legendChip}>
                    <span className={`${styles.legendDot} ${styles.legendStarted}`} /> 결제 페이지 도달
                  </span>
                  <span className={styles.legendChip}>
                    <span className={`${styles.legendDot} ${styles.legendConfirmed}`} /> 결제완료
                  </span>
                  <span className={styles.legendChip}>
                    <span className={`${styles.legendDot} ${styles.legendCapi}`} /> CAPI성공
                  </span>
                  <span className={styles.legendChip}>
                    <span className={`${styles.legendDot} ${styles.legendUnmatched}`} /> 매칭없음
                  </span>
                </div>
                <div className={styles.multiChart}>
                  <div className={styles.multiHead}>
                    <div>{granularity === "week" ? "주차(월시작)" : "날짜"}</div>
                    <div>4개 신호 비교(같은 축)</div>
                    <div style={{ textAlign: "right" }}>결제 페이지 도달</div>
                    <div style={{ textAlign: "right" }}>결제완료</div>
                    <div style={{ textAlign: "right" }}>CAPI성공</div>
                    <div style={{ textAlign: "right" }}>매칭없음</div>
                  </div>
                  {data.series.map((row) => {
                    const w = (n: number) =>
                      `${Math.max(0, Math.round((n / maxSeriesCount) * 100))}%`;
                    return (
                      <div key={row.date} className={styles.multiRow}>
                        <div className={styles.multiDate}>{row.date}</div>
                        <div className={styles.multiBars}>
                          <div className={styles.multiBarShell}>
                            <div className={`${styles.multiBar} ${styles.lineStarted}`} style={{ width: w(row.payment_started) }} />
                          </div>
                          <div className={styles.multiBarShell}>
                            <div className={`${styles.multiBar} ${styles.lineConfirmed}`} style={{ width: w(row.confirmed_purchases) }} />
                          </div>
                          <div className={styles.multiBarShell}>
                            <div className={`${styles.multiBar} ${styles.lineCapi}`} style={{ width: w(row.meta_capi_success) }} />
                          </div>
                          <div className={styles.multiBarShell}>
                            <div className={`${styles.multiBar} ${styles.lineUnmatched}`} style={{ width: w(row.unmatched) }} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>{fmtNum(row.payment_started)}</div>
                        <div style={{ textAlign: "right" }}>{fmtNum(row.confirmed_purchases)}</div>
                        <div style={{ textAlign: "right" }}>{fmtNum(row.meta_capi_success)}</div>
                        <div style={{ textAlign: "right" }}>{fmtNum(row.unmatched)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.legendRow}>
                  <span>막대 길이는 같은 기간 최댓값 대비 비율입니다. (max={fmtNum(maxSeriesCount)})</span>
                </div>
              </>
            )}
          </div>

          {/* UTM Breakdown */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>유입(UTM) Breakdown</h2>
                <p className={styles.sectionSub}>
                  어떤 유입에서 주문이 시작되고 결제완료로 이어졌는지, 그리고 어떤 유입이 매칭에 실패했는지 보여줍니다.
                </p>
              </div>
              <button
                className={styles.csvBtn}
                onClick={() =>
                  downloadCsv(
                    `funnel_utm_${data.site}_${data.window}.csv`,
                    data.utm_breakdown,
                  )
                }
              >
                CSV 내보내기
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>유입</th>
                  <th className={styles.num}>유입</th>
                  <th className={styles.num}>결제 페이지 도달</th>
                  <th className={styles.num}>결제완료</th>
                  <th className={styles.num}>CAPI성공</th>
                  <th className={styles.num}>매칭없음</th>
                  <th>다음 조치</th>
                </tr>
              </thead>
              <tbody>
                {data.utm_breakdown.map((row) => (
                  <tr key={row.channel}>
                    <td>
                      {row.human_label}
                      {row.budget_roas_included && (
                        <span className={`${styles.kpiBadge} ${styles.budget}`} style={{ marginLeft: 6 }}>
                          예산 판단
                        </span>
                      )}
                    </td>
                    <td className={styles.num}>{fmtNum(row.landing_count)}</td>
                    <td className={styles.num}>{fmtNum(row.payment_started_count)}</td>
                    <td className={styles.num}>{fmtNum(row.confirmed_purchase_count)}</td>
                    <td className={styles.num}>{fmtNum(row.meta_capi_success_count)}</td>
                    <td className={styles.num}>{fmtNum(row.unmatched_count)}</td>
                    <td style={{ fontSize: 12 }}>{row.next_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unmatched drilldown — KPI 일치 vs 진단 hint 분리 */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>사유별 drilldown</h2>
                <p className={styles.sectionSub}>
                  <strong>윗 KPI &quot;매칭 안 된 흐름&quot;</strong>은 아래 [A] 그룹의 합과 일치합니다. [B] 진단 hint 는 KPI 와 별개 사유로,
                  같은 화면에서 다른 단계의 누락을 함께 보여주기 위함입니다.
                </p>
              </div>
              <button
                className={styles.csvBtn}
                disabled={data.unmatched_reasons.length === 0}
                onClick={() =>
                  downloadCsv(
                    `funnel_unmatched_${data.site}_${data.window}.csv`,
                    data.unmatched_reasons,
                  )
                }
              >
                CSV 내보내기
              </button>
            </div>
            {data.unmatched_reasons.length === 0 ? (
              <div className={styles.muted}>이 기간에는 분류된 사유가 없습니다.</div>
            ) : (
              <>
                <div className={styles.drilldownGroup}>
                  <div className={styles.drilldownGroupTitle}>
                    [A] KPI &quot;매칭 안 된 흐름&quot; 과 일치 — confirmed 인데 attribution 0
                  </div>
                  <UnmatchedTable rows={data.unmatched_reasons.filter((r) => r.in_kpi_unmatched_metric)} />
                </div>
                <div className={styles.drilldownGroup}>
                  <div className={styles.drilldownGroupTitle}>
                    [B] 진단 hint — KPI 와 별개. 다른 단계의 누락/지연 신호
                  </div>
                  <UnmatchedTable rows={data.unmatched_reasons.filter((r) => !r.in_kpi_unmatched_metric)} showCategory />
                </div>
              </>
            )}
          </div>

          {/* Meta CAPI 분해 (gpt0515 사용자 지적) */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Meta CAPI 분해 ({data.meta_capi_breakdown.window_label})</h2>
            <p className={styles.sectionSub}>
              &quot;Meta CAPI 성공 N건&quot;이 모호하지 않게 send attempt / events_received=1 / unique order / 중복 추정 / 전송 지연을 분리해 보여줍니다.
              <strong> CAPI 성공 = events_received=1 send success</strong> 이지 unique purchase count 가 아닙니다.
              <strong> Meta 학습</strong>에는 결제완료 후 Purchase 이벤트가 몇 분만에 도착하는지(latency)가 중요합니다.
            </p>
            {(() => {
              const csf = data.meta_capi_breakdown.capi_site_filter;
              if (!csf) {
                return (
                  <div className={styles.capiCaveat}>
                    <span className={styles.capiCaveatBadge}>caveat</span>
                    응답에 capi_site_filter 정보가 없습니다. <strong>모든 pixel send 가 혼입 가능</strong>.
                  </div>
                );
              }
              if (csf.all_sites_mode) {
                return (
                  <div className={styles.capiCaveat}>
                    <span className={styles.capiCaveatBadge}>all_sites</span>
                    <strong>all_sites 모드</strong>로 바이오컴/더클린커피 pixel 의 send 가 합산되어 표시됩니다.
                    개별 site 별 정확도가 필요하면 위의 사이트 컨트롤을 단일 site 로 바꾸세요.
                  </div>
                );
              }
              return (
                <div className={`${styles.capiCaveat} ${styles.capiCaveatOk}`}>
                  <span className={`${styles.capiCaveatBadge} ${styles.capiCaveatBadgeOk}`}>filtered</span>
                  ✅ site=<strong>{csf.site}</strong> · pixel_id=<strong>{csf.pixel_ids.join(", ")}</strong> 로
                  필터된 CAPI 입니다. {csf.caveat}
                </div>
              );
            })()}
            <div className={styles.capiBreakdown}>
              <div className={styles.capiBox}>
                <div className={styles.capiBoxTitle}>전송 시도 수 (send attempts)</div>
                <div className={styles.capiBoxValue}>{fmtNum(data.meta_capi_breakdown.send_attempts)}</div>
                <div className={styles.capiBoxSub}>Meta 로 보낸 구매 이벤트(event_name=Purchase) 의 총 시도 수</div>
              </div>
              <div className={styles.capiBox}>
                <div className={styles.capiBoxTitle}>Meta 정상 수신 (events_received=1)</div>
                <div className={styles.capiBoxValue}>
                  {fmtNum(data.meta_capi_breakdown.events_received_count)}
                  <span className={styles.capiBoxRate}>
                    {data.meta_capi_breakdown.send_attempts > 0
                      ? ` (${fmtPct(data.meta_capi_breakdown.events_received_count / data.meta_capi_breakdown.send_attempts)})`
                      : ""}
                  </span>
                </div>
                <div className={styles.capiBoxSub}>
                  Meta 가 정상 수신했다고 응답한 건수 · 실패 {fmtNum(data.meta_capi_breakdown.failed)}건
                </div>
              </div>
              <div className={styles.capiBox}>
                <div className={styles.capiBoxTitle}>고유 주문 수 (unique purchase)</div>
                <div className={styles.capiBoxValue}>{fmtNum(data.meta_capi_breakdown.unique_orders)}</div>
                <div className={styles.capiBoxSub}>중복 제거된 주문 수 — 한 주문에 여러 번 보냈으면 1로 셈</div>
              </div>
              <div className={styles.capiBox}>
                <div className={styles.capiBoxTitle}>중복 전송 추정</div>
                <div className={styles.capiBoxValue}>
                  {fmtNum(data.meta_capi_breakdown.duplicate_estimate)}
                </div>
                <div className={styles.capiBoxSub}>
                  같은 주문을 두 번 이상 보낸 추정 건수 · 이벤트 ID 종류 {fmtNum(data.meta_capi_breakdown.unique_event_ids)}개
                </div>
              </div>
              <div className={`${styles.capiBox} ${styles.capiBoxLatency}`}>
                <div className={styles.capiBoxTitle}>결제 후 Meta 도착 시간 (전송 지연)</div>
                <div className={styles.capiBoxValue}>
                  {data.meta_capi_breakdown.latency_minutes.p50 !== null
                    ? `보통 ${fmtNum(data.meta_capi_breakdown.latency_minutes.p50)}분`
                    : "—"}
                </div>
                <div className={styles.capiBoxSub}>
                  가장 느린 5%{" "}
                  {data.meta_capi_breakdown.latency_minutes.p95 !== null
                    ? `${fmtNum(data.meta_capi_breakdown.latency_minutes.p95)}분`
                    : "—"}
                  {" · "}표본 {fmtNum(data.meta_capi_breakdown.latency_minutes.sample_size)}건 (p50/p95)
                </div>
              </div>
            </div>
            {data.meta_capi_breakdown.no_send_reasons.length > 0 && (
              <div className={styles.capiNoSend}>
                <strong>부적격 차단 사유</strong>:{" "}
                {data.meta_capi_breakdown.no_send_reasons
                  .map((r) => `${r.human_label} (${fmtNum(r.count)}건)`)
                  .join(" · ")}
              </div>
            )}
          </div>

          {/* CAPI Attribution Join */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>CAPI 전송 주문의 광고 식별자 분해</h2>
            <p className={styles.sectionSub}>
              &quot;CAPI 가 N건 보내졌다&quot; 만으로는 모자랍니다. 그 N건이 어떤 광고 식별자(utm / fbclid / fbc / fbp / gclid)와 짝지어 있는지를 봐야
              <strong> UTM Breakdown 의 CAPI 합이 왜 적게 보이는지</strong>도 같이 진단됩니다.
            </p>
            <p className={styles.sectionSub}>
              <em>{data.capi_attribution_join.note_ko}</em>
            </p>
            {(() => {
              const order = ["strong_meta_ad_evidence", "non_meta_or_unproven_meta", "no_ledger_match"];
              const sorted = [...data.capi_attribution_join.breakdown].sort((a, b) => {
                const ai = order.indexOf(a.bucket);
                const bi = order.indexOf(b.bucket);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });
              const bucketClass = (bucket: string): string => {
                if (bucket === "strong_meta_ad_evidence") return styles.bucketStrongMeta;
                if (bucket === "non_meta_or_unproven_meta") return styles.bucketUnproven;
                if (bucket === "no_ledger_match") return styles.bucketNoMatch;
                return "";
              };
              return (
                <table className={`${styles.table} ${styles.tableSmall}`}>
                  <thead>
                    <tr>
                      <th>버킷</th>
                      <th className={styles.num}>건수</th>
                      <th className={styles.num}>비율</th>
                      <th>한글 설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((b) => (
                      <tr key={b.bucket} className={bucketClass(b.bucket)}>
                        <td>
                          {b.human_label}
                          {b.bucket === "strong_meta_ad_evidence" && (
                            <span className={`${styles.sourceBadge} ${styles.sourceMetaAd}`}>meta_ad</span>
                          )}
                          {b.bucket === "non_meta_or_unproven_meta" && (
                            <span className={`${styles.sourceBadge} ${styles.sourceUnproven}`}>unproven</span>
                          )}
                          {b.bucket === "no_ledger_match" && (
                            <span className={`${styles.sourceBadge} ${styles.sourceNoMatch}`}>no_join</span>
                          )}
                        </td>
                        <td className={styles.num}>{fmtNum(b.count)}</td>
                        <td className={styles.num}>{b.share_pct.toFixed(1)}%</td>
                        <td style={{ fontSize: 12 }}>{b.explanation_ko}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            <div className={styles.legendRow}>
              <span>
                💡 <strong>fbp 단독은 Meta 광고 귀속 증거가 아닙니다.</strong> fbp 는 Facebook 방문자 식별 쿠키이고,
                광고 클릭 증거는 fbclid 또는 fbc 입니다. 위 표에서 <strong>strong_meta_ad_evidence</strong> 는 fbclid/fbc/Meta UTM 중
                하나 이상이 잡힌 row 만, <strong>non_meta_or_unproven_meta</strong> 는 fbp 만 있거나 다른 채널 evidence 가 더 강한 row 입니다.
              </span>
            </div>
          </div>

          {/* Purchase Eligibility Queue */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Meta 로 보낼 대기 주문 줄 (Purchase Eligibility Queue)</h2>
            <p className={styles.sectionSub}>
              {data.purchase_eligibility_queue.explanation_ko}
            </p>
            <div className={styles.eligibleGrid}>
              <div className={styles.eligibleBox}>
                <div className={styles.eligibleTitle}>대기 중 주문 수</div>
                <div className={styles.eligibleValue}>
                  {fmtNum(data.purchase_eligibility_queue.confirmed_eligible_unsent_count)}
                </div>
                <div className={styles.eligibleSub}>confirmed 인데 CAPI 성공 hint 없음</div>
              </div>
              <div className={styles.eligibleBox}>
                <div className={styles.eligibleTitle}>금액 (추정)</div>
                <div className={styles.eligibleValue}>
                  {fmtKRW(data.purchase_eligibility_queue.confirmed_eligible_unsent_amount_krw)}
                </div>
                <div className={styles.eligibleSub}>해당 주문의 매출 합계</div>
              </div>
              <div className={styles.eligibleBox}>
                <div className={styles.eligibleTitle}>가장 오래된 주문 age</div>
                <div className={styles.eligibleValue}>
                  {data.purchase_eligibility_queue.oldest_age_minutes !== null
                    ? `${fmtNum(Math.round(data.purchase_eligibility_queue.oldest_age_minutes))}분`
                    : "—"}
                </div>
                <div className={styles.eligibleSub}>클수록 Meta 학습에 그만큼 늦게 도달</div>
              </div>
            </div>
          </div>

          {/* Signal Quality */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>신호 품질 (결제완료 row 의 식별자 보유율)</h2>
            <p className={styles.sectionSub}>
              결제완료 row {fmtNum(data.signal_quality.confirmed_purchases_total)} 건 중 광고/세션 식별자가 얼마나 채워져 있는지 보여줍니다.
              이 비율이 낮을수록 광고 귀속과 Meta event match quality 가 약해집니다.
            </p>
            <div className={styles.pixelTooltip}>
              ⚠ <strong>fbp 단독은 Meta 광고 귀속 증거가 아닙니다.</strong> fbp 는 모든 Facebook 방문자에게 발급되는 식별 쿠키이며,
              실제 광고 클릭으로 들어왔다는 증거는 <strong>fbclid</strong> 또는 <strong>fbc</strong> 입니다.
              fbp 가 98% 라도 fbclid/fbc 가 30~40% 면 Meta 광고 귀속 가능 비율은 그 수준입니다.
            </div>
            <table className={`${styles.table} ${styles.tableSmall}`}>
              <thead>
                <tr>
                  <th>식별자</th>
                  <th className={styles.num}>보유 row</th>
                  <th className={styles.num}>보유율</th>
                  <th>한글 설명</th>
                </tr>
              </thead>
              <tbody>
                {data.signal_quality.fields.map((f) => (
                  <tr key={f.field}>
                    <td>{f.human_label}</td>
                    <td className={styles.num}>{fmtNum(f.present_count)}</td>
                    <td className={styles.num}>{f.present_rate.toFixed(1)}%</td>
                    <td style={{ fontSize: 12 }}>{f.explanation_ko}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* payment-decision latency */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              결제완료 판단 응답 지연 (payment-decision latency)
              {!data.payment_decision_latency.available && (
                <span className={`${styles.statePill} ${styles.statePillWaiting}`}>수집 대기</span>
              )}
            </h2>
            <p className={styles.sectionSub}>
              <strong>한글로 쉽게</strong>: {data.payment_decision_latency.explanation_ko}
            </p>
            {data.payment_decision_latency.available && data.payment_decision_latency.sample_size > 0 ? (
              <>
                <div className={styles.pdLatencyGrid}>
                  <div className={styles.pdLatencyBox}>
                    <div className={styles.pdLatencyTitle}>p50 (보통 응답)</div>
                    <div className={styles.pdLatencyValue}>
                      {data.payment_decision_latency.p50_ms !== null
                        ? `${fmtNum(data.payment_decision_latency.p50_ms)}ms`
                        : "—"}
                    </div>
                  </div>
                  <div className={styles.pdLatencyBox}>
                    <div className={styles.pdLatencyTitle}>p95 (가장 느린 5%)</div>
                    <div className={styles.pdLatencyValue}>
                      {data.payment_decision_latency.p95_ms !== null
                        ? `${fmtNum(data.payment_decision_latency.p95_ms)}ms`
                        : "—"}
                    </div>
                  </div>
                  <div className={styles.pdLatencyBox}>
                    <div className={styles.pdLatencyTitle}>sample size</div>
                    <div className={styles.pdLatencyValue}>
                      {fmtNum(data.payment_decision_latency.sample_size)}건
                    </div>
                  </div>
                </div>
                <table className={`${styles.table} ${styles.tableSmall}`}>
                  <thead>
                    <tr>
                      <th>응답 상태</th>
                      <th className={styles.num}>건수</th>
                      <th>의미</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>allow_purchase</td>
                      <td className={styles.num}>{fmtNum(data.payment_decision_latency.status_distribution.allow_purchase)}</td>
                      <td style={{ fontSize: 12 }}>결제완료 확정 — 브라우저 Purchase 발화 허용</td>
                    </tr>
                    <tr>
                      <td>virtual_account_issued</td>
                      <td className={styles.num}>{fmtNum(data.payment_decision_latency.status_distribution.virtual_account_issued)}</td>
                      <td style={{ fontSize: 12 }}>가상계좌 발급만 됨 — 미입금 상태로 Purchase 차단</td>
                    </tr>
                    <tr>
                      <td>canceled</td>
                      <td className={styles.num}>{fmtNum(data.payment_decision_latency.status_distribution.canceled)}</td>
                      <td style={{ fontSize: 12 }}>취소/환불 — Purchase 차단</td>
                    </tr>
                    <tr>
                      <td>unknown</td>
                      <td className={styles.num}>{fmtNum(data.payment_decision_latency.status_distribution.unknown)}</td>
                      <td style={{ fontSize: 12 }}>판단 불가 — 보수적으로 Purchase 차단</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <div className={styles.waitingBox}>
                <div className={styles.waitingTitle}>📥 sample 없음 (0ms 아님)</div>
                <div className={styles.waitingBody}>
                  Backend 의 in-memory ring buffer 가 비어 있습니다. 운영 backend 가 최근 restart 되었거나, 결제 시도가
                  아직 들어오지 않은 상태입니다. <strong>0ms 가 아니라 &quot;미수집&quot;</strong>입니다.
                </div>
                <div className={styles.waitingDetail}>
                  reason: {data.payment_decision_latency.not_available_reason}
                </div>
              </div>
            )}
          </div>

          {/* Browser funnel health */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              브라우저 픽셀 단계별 발화 상태 (Browser funnel health)
              {!data.browser_funnel_health.available && (
                <span className={`${styles.statePill} ${styles.statePillWaiting}`}>ledger eventName 매핑 대기</span>
              )}
            </h2>
            <p className={styles.sectionSub}>
              <strong>한글로 쉽게</strong>: {data.browser_funnel_health.explanation_ko}
            </p>
            <div className={styles.pixelTooltip}>
              💡 <strong>Meta Pixel Helper / Chrome Network 와 이 화면의 숫자는 다릅니다.</strong>{" "}
              Pixel Helper 는 <em>내 브라우저 한 대</em>의 발화를 보는 진단 도구이고,
              여기 숫자는 <em>모든 사용자 브라우저의 발화가 서버로 들어온 누적 집계</em>입니다. 비교 대상이 아닙니다.
            </div>
            <table className={`${styles.table} ${styles.tableSmall}`}>
              <thead>
                <tr>
                  <th>단계</th>
                  <th className={styles.num}>발화 row (server 측 수집)</th>
                  <th>source 구분</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {data.browser_funnel_health.stages.map((s) => (
                  <tr key={s.stage}>
                    <td>{s.stage}</td>
                    <td className={styles.num}>
                      {data.browser_funnel_health.available ? fmtNum(s.count) : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span className={`${styles.sourceBadge} ${styles.sourceWaiting}`}>대기</span>
                      <span className={styles.muted}>native FBE / block4 fallback / unknown 구분 대기</span>
                    </td>
                    <td style={{ fontSize: 11, color: "#475569" }}>
                      {data.browser_funnel_health.available
                        ? s.source
                        : "ledger metadata.eventName 매핑 contract 대기"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.browser_funnel_health.available && (
              <div className={styles.waitingBox} style={{ marginTop: 10 }}>
                <div className={styles.waitingTitle}>📥 미수집 (장애 아님)</div>
                <div className={styles.waitingBody}>{data.browser_funnel_health.not_available_reason}</div>
              </div>
            )}
          </div>

          {/* CAPI 생존 상태 */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>전환 API 생존 상태</h2>
            <p className={styles.sectionSub}>
              서버가 Meta에 구매 이벤트를 보내는 통로가 살아 있는지 확인합니다. 마지막 성공 시각:{" "}
              <strong>{data.capi_health.last_success_at_kst ?? "없음"}</strong>
            </p>
            {(() => {
              const csf = data.meta_capi_breakdown.capi_site_filter;
              const filteredMode = csf && !csf.all_sites_mode;
              return (
                <div className={`${styles.capiCaveat} ${filteredMode ? styles.capiCaveatOk : ""}`}>
                  <span className={`${styles.capiCaveatBadge} ${filteredMode ? styles.capiCaveatBadgeOk : ""}`}>
                    {filteredMode ? "filtered" : csf?.all_sites_mode ? "all_sites" : "caveat"}
                  </span>
                  {filteredMode ? (
                    <>
                      ✅ site=<strong>{csf.site}</strong> pixel=<strong>{csf.pixel_ids.join(", ")}</strong> 로 필터된 CAPI 입니다.
                    </>
                  ) : csf?.all_sites_mode ? (
                    <>
                      <strong>all_sites</strong> — 바이오컴/더클린커피 send 합산. 개별 site 정확도는 site 컨트롤로 단일 site 선택.
                    </>
                  ) : (
                    <>응답에 capi_site_filter 가 없어 모든 pixel 혼입 가능.</>
                  )}
                  {" "}<strong>&quot;success&quot;</strong> 는 events_received=1 응답 받은 <strong>send 시도</strong>건수입니다 (unique purchase 아님).
                </div>
              );
            })()}
            <div className={styles.capiGrid}>
              <CapiCard title="최근 1시간" b={data.capi_health.last_1h} />
              <CapiCard title="오늘 (KST)" b={data.capi_health.today} />
              <CapiCard title="최근 7일" b={data.capi_health.last_7d} />
            </div>
            {data.capi_health.no_send_reasons.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 12 }}>no-send 사유</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                  {data.capi_health.no_send_reasons.map((r) => (
                    <li key={r.reason}>
                      {r.human_label} — {fmtNum(r.count)}건
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Guardrail 표기 */}
          <div className={styles.guardrail}>
            <strong>안전 invariant</strong> — 이 화면이 호출한 endpoint는 외부 플랫폼 send 0, 운영DB write 0, raw
            identifier 노출 0을 보장합니다. (
            raw_identifier_output={data.guardrails.raw_identifier_output},{" "}
            platform_send_from_this_endpoint={data.guardrails.platform_send_from_this_endpoint},{" "}
            operational_db_write={data.guardrails.operational_db_write}
            ) · cross-check source: {data.source_summary.cross_check.join(", ")}
          </div>
        </>
      )}
      </main>
    </>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  unit: string;
  period: string;
  basis: string;
  source: string;
  badge: "budget" | "refer" | "fix";
  badgeLabel: string;
}) {
  const badgeClass =
    props.badge === "budget"
      ? `${styles.kpiBadge} ${styles.budget}`
      : props.badge === "fix"
        ? `${styles.kpiBadge} ${styles.fix}`
        : `${styles.kpiBadge} ${styles.refer}`;
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTitle}>{props.title}</div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{props.value}</span>
        <span className={styles.kpiUnit}>{props.unit}</span>
      </div>
      <div className={styles.kpiPeriod}>📅 {props.period}</div>
      <div className={styles.kpiBasis}>
        <strong>기준</strong>: {props.basis}
      </div>
      <div className={styles.kpiSource}>
        <strong>source</strong>: {props.source}
      </div>
      <span className={badgeClass}>{props.badgeLabel}</span>
    </div>
  );
}

function CapiCard(props: {
  title: string;
  b: { attempted: number; success: number; events_received: number; failed: number };
}) {
  return (
    <div className={styles.capiCard}>
      <h4>{props.title}</h4>
      <div>
        <span className={styles.num}>{props.b.success}</span>
        <span style={{ fontSize: 12, color: "#475569" }}>
          성공 / {props.b.attempted} 시도 · 실패 {props.b.failed} · events_received {props.b.events_received}
        </span>
      </div>
    </div>
  );
}

function MetaRoasCard(props: {
  title: string;
  preset: string;
  caveatLag?: string;
  onRetry?: () => void;
  cooldownLeftMs?: number;
  failCount?: number;
  lastSuccess?: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    queried_at?: string;
    captured_at: string;
  } | null;
  data:
    | { spend: number; attributedRevenue: number; roas: number | null; orders: number; queried_at?: string; date_range?: { start_date?: string; end_date?: string } }
    | {
        error: string;
        status?: number;
        endpoint?: string;
        date_preset?: string;
        account_id_suffix?: string;
        timestamp?: string;
        response_message?: string;
      }
    | null;
}) {
  if (props.data === null) {
    return (
      <div className={styles.metaRoasCard}>
        <div className={styles.metaRoasTitle}>
          {props.title}
          <span className={`${styles.sourceBadge} ${styles.sourceInternalAttr}`}>internal_attr</span>
        </div>
        <div className={styles.metaRoasLoading}>VM 내부 귀속 ROAS 조회 중…</div>
        <div className={styles.metaRoasSub}>date_preset={props.preset}</div>
      </div>
    );
  }
  if ("error" in props.data) {
    const err = props.data;
    const kind = classifyRoasError(err) ?? "backend_unknown";
    const cooldownSec = props.cooldownLeftMs && props.cooldownLeftMs > 0 ? Math.ceil(props.cooldownLeftMs / 1000) : 0;
    const last = props.lastSuccess;
    const kindMeta: Record<RoasErrorKind, { wrapper: string; badge: string; badgeLabel: string; topline: string; hint?: string }> = {
      meta_rate_limit: {
        wrapper: styles.metaRoasAmber,
        badge: styles.sourceAmber,
        badgeLabel: "Meta API 호출 제한",
        topline:
          "Meta Graph API 의 호출 횟수 제한(rate limit, code 80004)에 걸렸습니다. " +
          "광고가 0 이라는 의미가 아니라, Meta 가 \"잠깐 호출 너무 많다, 기다려라\"고 응답한 정상 throttling 입니다.",
        hint:
          "잠시 후 ↻ 재시도 (자동 쿨다운 적용). backend 캐시 patch 가 들어오면 사용자 화면에서 거의 안 보입니다.",
      },
      backend_unknown: {
        wrapper: styles.metaRoasAmber,
        badge: styles.sourceAmber,
        badgeLabel: "API 오류",
        topline:
          "내부 계산용 ROAS API 가 응답을 못 줬습니다. 광고가 0 이라는 의미가 아니라, 계산을 위한 백엔드 API 호출이 실패한 것입니다.",
      },
      // 아래 두 enum 은 실제로는 error 객체에서 안 나오지만 type 안전을 위해 placeholder.
      no_data: { wrapper: styles.metaRoasAmber, badge: styles.sourceAmber, badgeLabel: "데이터 없음", topline: "" },
      real_zero: { wrapper: styles.metaRoasAmber, badge: styles.sourceAmber, badgeLabel: "성과 0", topline: "" },
    };
    const k = kindMeta[kind];
    return (
      <div className={`${styles.metaRoasCard} ${k.wrapper}`}>
        <div className={styles.metaRoasTitle}>
          {props.title}
          <span className={`${styles.sourceBadge} ${styles.sourceInternalAttr}`}>internal_attr</span>
          <span className={`${styles.sourceBadge} ${k.badge}`}>{k.badgeLabel}</span>
        </div>
        <div className={styles.metaRoasErrorTopline}>{k.topline}</div>
        {k.hint && <div className={styles.metaRoasErrorHint}>💡 {k.hint}</div>}

        {/* 마지막 성공값 표시 — 사용자가 "성과 0" 으로 오해하지 않게 */}
        {last && (
          <div className={styles.lastSuccessBox}>
            <div className={styles.lastSuccessTopline}>
              <strong>최신 계산 실패, 마지막 정상값 표시 중</strong>
              <span className={styles.muted}>· captured {toKstShort(last.captured_at)}</span>
            </div>
            <div className={styles.lastSuccessRow}>
              <span className={styles.lastSuccessRoas}>
                {last.roas !== null ? `${last.roas.toFixed(2)}×` : "—"}
              </span>
              <span className={styles.muted}>
                광고비 {fmtKRW(last.spend)} · 매출 {fmtKRW(last.attributedRevenue)} · 주문 {fmtNum(last.orders)}건
              </span>
            </div>
          </div>
        )}

        <div className={styles.metaRoasErrorDiag}>
          <div><strong>status</strong>: {err.status ?? "—"} · <strong>error</strong>: {err.error}</div>
          {err.response_message && (
            <div><strong>response_message</strong>: {err.response_message}</div>
          )}
          <div>
            <strong>endpoint</strong>: <code>{err.endpoint ?? "/api/ads/roas"}</code> · <strong>date_preset</strong>: {err.date_preset ?? props.preset}
          </div>
          <div>
            <strong>account suffix</strong>: …{err.account_id_suffix ?? "????"} · <strong>at</strong>: {err.timestamp ? toKstShort(err.timestamp) : "—"}
          </div>
          {props.failCount !== undefined && props.failCount > 0 && (
            <div><strong>연속 실패</strong>: {props.failCount}회</div>
          )}
        </div>
        {props.onRetry && (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => props.onRetry && props.onRetry()}
            disabled={cooldownSec > 0}
          >
            {cooldownSec > 0 ? `↻ 재시도 가능까지 ${cooldownSec}초` : "↻ 이 카드만 재시도"}
          </button>
        )}
      </div>
    );
  }
  const roasColor =
    props.data.roas === null
      ? "#64748b"
      : props.data.roas >= 2
        ? "#16a34a"
        : props.data.roas >= 1
          ? "#d97706"
          : "#dc2626";
  const lastUpdatedKst = props.data.queried_at
    ? toKstShort(props.data.queried_at)
    : null;
  const dateRangeText = props.data.date_range
    ? `${props.data.date_range.start_date ?? ""} ~ ${props.data.date_range.end_date ?? ""}`
    : null;
  const okKind = classifyRoasError(props.data);
  const okBadge: { cls?: string; label?: string; wrapper?: string; note?: string } =
    okKind === "no_data"
      ? {
          cls: styles.sourceGray,
          label: "데이터 없음",
          wrapper: styles.metaRoasGray,
          note:
            "이 기간 광고비/매출이 모두 0 입니다. 광고가 안 돌고 있거나 (새벽/캠페인 off) Meta 가 아직 집계 전입니다. " +
            "치명 장애 아닙니다.",
        }
      : okKind === "real_zero"
        ? {
            cls: styles.sourceRed,
            label: "성과 0",
            wrapper: styles.metaRoasRed,
            note:
              "광고비는 썼는데 귀속 주문이 0 — 실제 성과 0 케이스. 캠페인 점검 필요.",
          }
        : {};
  return (
    <div className={`${styles.metaRoasCard} ${okBadge.wrapper ?? ""}`}>
      <div className={styles.metaRoasTitle}>
        {props.title}
        <span className={`${styles.sourceBadge} ${styles.sourceInternalAttr}`}>internal_attr</span>
        {okBadge.label && <span className={`${styles.sourceBadge} ${okBadge.cls}`}>{okBadge.label}</span>}
      </div>
      <div className={styles.metaRoasValueRow}>
        <span className={styles.metaRoasRoas} style={{ color: roasColor }}>
          {props.data.roas !== null ? `${props.data.roas.toFixed(2)}×` : "—"}
        </span>
        <span className={styles.metaRoasUnit}>ROAS</span>
      </div>
      <div className={styles.metaRoasDetail}>
        <div>
          <span className={styles.metaRoasLabel}>광고비</span> {fmtKRW(props.data.spend)}
        </div>
        <div>
          <span className={styles.metaRoasLabel}>귀속 매출</span> {fmtKRW(props.data.attributedRevenue)}
        </div>
        <div>
          <span className={styles.metaRoasLabel}>주문</span> {fmtNum(props.data.orders)}건
        </div>
      </div>
      {okBadge.note && <div className={styles.metaRoasCaveat}>ℹ {okBadge.note}</div>}
      {props.caveatLag && (
        <div className={styles.metaRoasCaveat}>⚠ {props.caveatLag}</div>
      )}
      <div className={styles.metaRoasSub}>
        window {dateRangeText ?? props.preset}
        {lastUpdatedKst ? ` · last_updated ${lastUpdatedKst}` : ""}
      </div>
    </div>
  );
}

// v9: ROAS error 의 색상/카피 분기를 위한 분류
type RoasErrorKind = "meta_rate_limit" | "no_data" | "real_zero" | "backend_unknown";
type _RoasOk = { spend: number; attributedRevenue: number; roas: number | null; orders: number };
type _RoasErr = { error: string; status?: number; response_message?: string };
const classifyRoasError = (
  data: _RoasOk | _RoasErr,
): RoasErrorKind | null => {
  if ("error" in data) {
    const err = data as _RoasErr;
    const msg = ((err.response_message ?? "") + " " + (err.error ?? "")).toLowerCase();
    if (msg.includes("meta_rate_limit") || msg.includes("80004") || msg.includes("rate limit") || msg.includes("too many calls")) {
      return "meta_rate_limit";
    }
    if (msg.includes("fetch failed") || msg.includes("network")) {
      return "meta_rate_limit";
    }
    return "backend_unknown";
  }
  const ok = data as _RoasOk;
  if (ok.spend === 0 && ok.orders === 0) return "no_data";
  if (ok.spend > 0 && ok.orders === 0) return "real_zero";
  return null;
};

// 쿨다운 시간 결정. retry_after_ms 가 응답에 있으면 우선. 없으면 failCount 기반 5s → 15s → 30s.
const nextCooldownMs = (failCount: number, retryAfterMs?: number): number => {
  if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 60000);
  }
  if (failCount <= 1) return 5000;
  if (failCount <= 2) return 15000;
  return 30000;
};

// Action 큐의 raw 기술 카피를 일반 사용자가 이해할 수 있는 풀이로 변환.
// 매핑이 없으면 원문 그대로 반환.
const ACTION_HUMANIZE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /Eligibility queue.*oldest age.*backfill 후보/i,
    rewrite:
      "5/14~5/15 수리 전 과거 누락 기록은 ROAS 오염 방지를 위해 보관만 하고 전송하지 않습니다. " +
      "5/17 이후 새 누락만 current monitor 에서 확인하세요.",
  },
  {
    match: /보관만.*전송하지 않음/i,
    rewrite: "과거 장애 기록으로만 보관합니다. Meta 로 다시 보내지 않으며 예산 판단 ROAS 에도 보정 전송으로 섞지 않습니다.",
  },
  {
    match: /Header Guard v3\.1\.1.*prefetch cache/i,
    rewrite:
      "결제완료 판단 응답이 끊기는 케이스(payment-decision canceled) 처리: Header Guard v3.1.1 패치 적용 후 prefetch 캐시를 비워서 같은 증상이 재발하는지 다시 보세요.",
  },
  {
    match: /광고 link tagging.*click id capture/i,
    rewrite:
      "광고 링크 UTM 일관성과 클라이언트의 광고 클릭 ID(gclid/fbclid) 수집 타이밍을 점검하세요. " +
      "광고를 누르고 들어왔는데 click ID 가 비어 있다면 광고 link 에 파라미터가 빠졌거나 redirect 단계에서 잘립니다.",
  },
  {
    match: /Meta CAPI sync.*큐.*사유 분포/i,
    rewrite:
      "Meta 로 보내는 자동 전송(CAPI sync) 의 대기 큐와 실패 사유 분포를 확인하고 재전송 정책을 손보세요.",
  },
  {
    match: /광고 link UTM.*referrer 유지/i,
    rewrite:
      "광고 링크의 UTM 파라미터가 일관되게 붙어 있는지, 그리고 결제 시작 단계 wrapper 가 referrer 값을 유지하는지 확인하세요.",
  },
];

const humanizeActionText = (raw: string): string => {
  if (!raw) return raw;
  for (const rule of ACTION_HUMANIZE_RULES) {
    if (rule.match.test(raw)) return rule.rewrite;
  }
  return raw;
};

const toKstShort = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${kst.toISOString().slice(5, 10)} ${kst.toISOString().slice(11, 16)} KST`;
  } catch {
    return iso;
  }
};

const getKstIsoDate = (offsetDays: number): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
};

const CATEGORY_LABEL: Record<string, string> = {
  kpi_unmatched: "KPI 매칭 누락",
  diagnostic_hint: "진단 hint",
  upstream_dropoff: "상위 단계 이탈",
  capi_pipeline: "CAPI 파이프라인",
};

function UnmatchedTable(props: {
  rows: FunnelHealth["unmatched_reasons"];
  showCategory?: boolean;
}) {
  if (props.rows.length === 0) {
    return <div className={styles.muted} style={{ padding: "8px 0" }}>이 그룹에는 row 가 없습니다.</div>;
  }
  return (
    <table className={`${styles.table} ${styles.tableSmall}`}>
      <thead>
        <tr>
          <th>사유</th>
          {props.showCategory && <th>카테고리</th>}
          <th className={styles.num}>건수</th>
          <th className={styles.num}>금액</th>
          <th>신뢰도</th>
          <th>지금 할 일</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.reason}>
            <td>{r.human_label}</td>
            {props.showCategory && (
              <td>
                <span className={styles.categoryChip}>{CATEGORY_LABEL[r.category] ?? r.category}</span>
              </td>
            )}
            <td className={styles.num}>{fmtNum(r.count)}</td>
            <td className={styles.num}>{r.amount_krw > 0 ? fmtKRW(r.amount_krw) : "—"}</td>
            <td>{r.confidence}</td>
            <td style={{ fontSize: 12 }}>{r.next_action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
