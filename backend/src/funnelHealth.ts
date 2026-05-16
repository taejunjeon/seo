/**
 * 전환 퍼널 관제 (Conversion Funnel Monitor) 집계 모듈
 *
 * 설계 정본: gptconfirm/gpt0515-17-funnel-monitor-design/02-funnel-data-contract.md
 *
 * 원칙:
 * - read-only. 외부 플랫폼 send 안 함. 운영DB write 안 함.
 * - primary source = VM Cloud attribution_ledger + Meta CAPI send log
 * - raw identifier (orderId, paymentKey, click id, email, phone, member code) 출력 금지
 */

import { createHash } from "node:crypto";
import type { AttributionLedgerEntry } from "./attribution";
import { resolveLedgerRevenueValue } from "./attribution";
import type { MetaCapiSendLogRecord } from "./metaCapi";
import type { PaymentDecisionRecord } from "./paymentDecisionLatency";

export type FunnelHealthSite = "biocom" | "thecleancoffee" | "all_sites";
export type FunnelHealthWindow = "1d" | "7d" | "14d" | "30d";
export type FunnelHealthGranularity = "day" | "week";
export type FunnelHealthPaymentMethod =
  | "all"
  | "card"
  | "npay"
  | "virtual_account"
  | "bank_transfer"
  | "other";
export type FunnelHealthSource =
  | "all"
  | "meta"
  | "google"
  | "naver"
  | "organic"
  | "direct"
  | "utm_present"
  | "utm_missing"
  | "no_ledger_match";

export type FunnelHealthStatusLabel = "정상" | "주의" | "긴급";

export type FunnelHealthActionQueueDetail = {
  safe_ref: string;
  logged_at_kst: string;
  amount_krw: number;
  payment_method: FunnelHealthPaymentMethod;
  payment_method_label: string;
  source_bucket: FunnelHealthSource;
  source_label: string;
  evidence: string[];
  confirmed_basis: string;
  capi_status: "missing_send_log_match" | "not_applicable";
  missing_reason: string;
  recommended_action: string;
  age_minutes: number | null;
  confidence: "high" | "medium" | "low";
};

export type FunnelHealthLandingEvidence = {
  source: "VM Cloud site_landing_ledger";
  unit: "first_party_landing_row";
  total: number;
  byFunnelSource: Partial<Record<FunnelHealthSource, number>>;
  series: Array<{
    date: string;
    landing: number;
    byFunnelSource?: Partial<Record<FunnelHealthSource, number>>;
  }>;
  cartPageViews?: {
    source: "VM Cloud site_landing_ledger";
    unit: "first_party_cart_page_landing_row";
    pathPattern: "/shop_cart";
    total: number;
    byFunnelSource: Partial<Record<FunnelHealthSource, number>>;
    series?: Array<{
      date: string;
      cart_page_view: number;
      byFunnelSource?: Partial<Record<FunnelHealthSource, number>>;
    }>;
    caveat: string;
  };
  caveat: string;
};

export type FunnelHealthInput = {
  ledgerEntries: AttributionLedgerEntry[];
  capiLogs: MetaCapiSendLogRecord[];
  paymentDecisionRecords?: PaymentDecisionRecord[];
  siteLandingEvidence?: FunnelHealthLandingEvidence;
  site: FunnelHealthSite;
  window: FunnelHealthWindow;
  granularity: FunnelHealthGranularity;
  paymentMethod: FunnelHealthPaymentMethod;
  source: FunnelHealthSource;
  /** 평가 기준 시각 (default: now) */
  asOf?: Date;
};

type FunnelStepKey =
  | "landing"
  | "add_to_cart"
  | "payment_started"
  | "payment_method_selected"
  | "confirmed_purchase"
  | "meta_capi_success"
  | "browser_purchase";

export const FUNNEL_HEALTH_WINDOW_HOURS: Record<FunnelHealthWindow, number> = {
  "1d": 24,
  "7d": 24 * 7,
  "14d": 24 * 14,
  "30d": 24 * 30,
};

const WINDOW_LABEL: Record<FunnelHealthWindow, string> = {
  "1d": "최근 24시간",
  "7d": "최근 7일",
  "14d": "최근 14일",
  "30d": "최근 30일",
};

const FUNNEL_STEP_LABELS: Record<FunnelStepKey, string> = {
  landing: "유입",
  add_to_cart: "장바구니 페이지 진입",
  payment_started: "결제 시작",
  payment_method_selected: "결제수단 선택",
  confirmed_purchase: "실제 결제완료",
  meta_capi_success: "Meta CAPI 성공",
  browser_purchase: "Browser Purchase",
};

const SITE_PIXEL_IDS: Record<FunnelHealthSite, string[]> = {
  biocom: ["1283400029487161"],
  thecleancoffee: ["1186437633687388"],
  all_sites: [],
};

const capiPixelMatchesSite = (
  row: MetaCapiSendLogRecord,
  site: FunnelHealthSite,
): boolean => {
  if (site === "all_sites") return true;
  const allowed = SITE_PIXEL_IDS[site];
  return allowed.includes((row.pixel_id ?? "").trim());
};

const firstString = (
  obj: Record<string, unknown> | undefined | null,
  keys: string[],
): string => {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const classifySite = (entry: AttributionLedgerEntry): FunnelHealthSite | null => {
  const metaSite =
    typeof entry.metadata?.site === "string" ? entry.metadata.site.trim().toLowerCase() : "";
  if (metaSite === "biocom") return "biocom";
  if (metaSite === "thecleancoffee" || metaSite === "coffee") return "thecleancoffee";

  const candidates: string[] = [];
  if (entry.landing) candidates.push(entry.landing);
  if (entry.referrer) candidates.push(entry.referrer);
  const referrerPayment = entry.metadata?.referrerPayment as Record<string, unknown> | undefined;
  if (referrerPayment && typeof referrerPayment.host === "string") {
    candidates.push(referrerPayment.host);
  }
  const blob = candidates.join(" ").toLowerCase();
  if (!blob) return null;
  if (blob.includes("biocom.kr") || blob.includes("biocom.co")) return "biocom";
  if (blob.includes("thecleancoffee.com") || blob.includes("clean-coffee")) {
    return "thecleancoffee";
  }
  return null;
};

const classifySource = (entry: AttributionLedgerEntry): FunnelHealthSource => {
  const utmSource = entry.utmSource?.toLowerCase() ?? "";
  const utmMedium = entry.utmMedium?.toLowerCase() ?? "";
  const referrer = entry.referrer?.toLowerCase() ?? "";
  const metaSource = typeof entry.metadata?.source === "string"
    ? entry.metadata.source.toLowerCase()
    : "";

  if (entry.fbclid || utmSource.includes("meta") || utmSource.includes("facebook") || utmSource.includes("instagram") || metaSource.includes("meta")) {
    return "meta";
  }
  if (entry.gclid || utmSource.includes("google") || metaSource.includes("google")) {
    return "google";
  }
  if (
    utmSource.includes("naver") ||
    referrer.includes("naver.com") ||
    referrer.includes("smartstore") ||
    metaSource.includes("naver")
  ) {
    return "naver";
  }
  if (utmSource || utmMedium) {
    return "utm_present";
  }
  if (referrer) {
    if (referrer.includes("google.") && !utmSource) return "organic";
    if (referrer.includes("naver.com") && !utmSource) return "organic";
    return "organic";
  }
  return "direct";
};

const classifyPaymentMethod = (
  entry: AttributionLedgerEntry,
): FunnelHealthPaymentMethod => {
  const referrerPayment = entry.metadata?.referrerPayment as Record<string, unknown> | undefined;
  const methodRaw = (
    firstString(entry.metadata, ["paymentMethod", "payment_method", "method"]) ||
    firstString(referrerPayment, ["method", "paymentMethod", "payment_method"])
  ).toLowerCase();
  if (!methodRaw) return "other";
  if (methodRaw.includes("naverpay") || methodRaw.includes("npay")) return "npay";
  if (methodRaw.includes("card")) return "card";
  if (methodRaw.includes("virtual") || methodRaw.includes("vbank")) return "virtual_account";
  if (methodRaw.includes("transfer") || methodRaw.includes("bank")) return "bank_transfer";
  return "other";
};

const matchesFilters = (
  entry: AttributionLedgerEntry,
  filters: {
    site: FunnelHealthSite;
    paymentMethod: FunnelHealthPaymentMethod;
    source: FunnelHealthSource;
  },
): boolean => {
  const entrySite = classifySite(entry);
  if (filters.site !== "all_sites" && entrySite !== null && entrySite !== filters.site) return false;
  // site classification 실패한 row 는 보수적으로 포함 (filter 누락보다 over-count 가 안전)

  if (filters.paymentMethod !== "all") {
    if (entry.touchpoint === "payment_success" || entry.touchpoint === "checkout_started" || entry.touchpoint === "payment_page_seen") {
      const pm = classifyPaymentMethod(entry);
      if (pm !== filters.paymentMethod) return false;
    }
  }

  if (filters.source !== "all") {
    const s = classifySource(entry);
    if (filters.source === "utm_missing") {
      if (entry.utmSource || entry.utmMedium) return false;
    } else if (filters.source === "utm_present") {
      if (!entry.utmSource && !entry.utmMedium) return false;
    } else if (s !== filters.source) {
      return false;
    }
  }

  return true;
};

const ledgerJoinKey = (entry: AttributionLedgerEntry): string => {
  const paymentKey = entry.paymentKey?.trim();
  if (paymentKey) return `payment:${paymentKey}`;
  const orderId = entry.orderId?.trim();
  if (orderId) return `order:${orderId}`;
  return "";
};

const capiJoinKey = (row: MetaCapiSendLogRecord): string => {
  const paymentKey = row.ledger_entry?.paymentKey?.trim();
  if (paymentKey) return `payment:${paymentKey}`;
  const orderId = row.ledger_entry?.orderId?.trim();
  if (orderId) return `order:${orderId}`;
  return "";
};

const isWithinWindow = (
  ts: string,
  windowStartMs: number,
  windowEndMs: number,
): boolean => {
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  return ms >= windowStartMs && ms <= windowEndMs;
};

const dateKey = (
  ts: string,
  granularity: FunnelHealthGranularity,
): string => {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  if (granularity === "week") {
    // ISO week starting Monday (KST 기준 단순화: UTC date 기준)
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
};

const SOURCE_CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta 광고",
  google: "Google 광고",
  naver: "Naver 유입",
  organic: "오가닉 유입",
  direct: "직접 입력 / Direct",
  utm_present: "UTM 있음 (기타)",
  utm_missing: "UTM 없음",
  no_ledger_match: "CAPI 전송은 있으나 ledger 매칭 없음",
};

const isConfirmedPurchaseEntry = (entry: AttributionLedgerEntry): boolean =>
  entry.touchpoint === "payment_success" && entry.paymentStatus === "confirmed";

const isPaymentStartedEntry = (entry: AttributionLedgerEntry): boolean =>
  entry.touchpoint === "checkout_started" || entry.touchpoint === "payment_page_seen";

const isLandingEntry = (entry: AttributionLedgerEntry): boolean =>
  entry.touchpoint === "marketing_intent";

const isAddPaymentInfoEntry = (entry: AttributionLedgerEntry): boolean => {
  const eventName = firstString(entry.metadata, ["eventName", "event_name"]);
  return eventName === "AddPaymentInfo";
};

const isAddToCartEntry = (entry: AttributionLedgerEntry): boolean => {
  const eventName = firstString(entry.metadata, ["eventName", "event_name"]);
  return eventName === "AddToCart" || eventName === "ViewContent";
};

const classifyCapiSuccess = (row: MetaCapiSendLogRecord): boolean => {
  if (row.response_status >= 200 && row.response_status < 300) {
    const body = row.response_body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const received = (body as Record<string, unknown>).events_received;
      if (typeof received === "number") {
        return received >= 1;
      }
    }
    return true;
  }
  return false;
};

const eventsReceivedCount = (row: MetaCapiSendLogRecord): number => {
  const body = row.response_body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const v = (body as Record<string, unknown>).events_received;
    if (typeof v === "number") return v;
  }
  return classifyCapiSuccess(row) ? 1 : 0;
};

const safeRefForLedgerEntry = (entry: AttributionLedgerEntry): string => {
  const joinKey = ledgerJoinKey(entry);
  const fallback = [
    entry.loggedAt,
    entry.touchpoint,
    entry.captureMode,
    resolveLedgerRevenueValue(entry),
    entry.checkoutId,
    entry.customerKey,
  ].join("\u001f");
  const digest = createHash("sha256")
    .update(joinKey || fallback, "utf8")
    .digest("hex")
    .slice(0, 10);
  return `safe_${digest}`;
};

const sourceLabelKo = (source: FunnelHealthSource): string => {
  const labels: Record<FunnelHealthSource, string> = {
    all: "전체",
    meta: "Meta 유입 증거 있음",
    google: "Google 유입 증거 있음",
    naver: "Naver 유입 증거 있음",
    organic: "자연/추천 유입",
    direct: "직접/내부 유입",
    utm_present: "UTM은 있으나 채널 미분류",
    utm_missing: "UTM 없음",
    no_ledger_match: "원장 매칭 없음",
  };
  return labels[source] ?? source;
};

const paymentMethodLabelKo = (method: FunnelHealthPaymentMethod): string => {
  const labels: Record<FunnelHealthPaymentMethod, string> = {
    all: "전체",
    card: "카드",
    npay: "NPay",
    virtual_account: "가상계좌",
    bank_transfer: "무통장/계좌이체",
    other: "기타/불명",
  };
  return labels[method] ?? method;
};

const metadataString = (entry: AttributionLedgerEntry, keys: string[]): string => {
  for (const key of keys) {
    const value = entry.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const metadataPresent = (entry: AttributionLedgerEntry, keys: string[]): boolean =>
  Boolean(metadataString(entry, keys));

const evidenceLabelsForEntry = (entry: AttributionLedgerEntry): string[] => {
  const labels: string[] = [];
  if (entry.fbclid) labels.push("fbclid 있음");
  if (metadataPresent(entry, ["fbc", "_fbc"])) labels.push("fbc 있음");
  if (metadataPresent(entry, ["fbp", "_fbp"])) labels.push("fbp 있음");
  if (entry.gclid) labels.push("gclid 있음");
  if (entry.ttclid) labels.push("ttclid 있음");
  if (entry.utmSource || entry.utmMedium || entry.utmCampaign) labels.push("UTM 있음");
  if (entry.referrer) labels.push("referrer 있음");
  if (entry.approvedAt) labels.push("결제완료 시각 있음");
  if (entry.paymentKey) labels.push("결제키 있음(값 숨김)");
  if (entry.orderId) labels.push("주문키 있음(값 숨김)");
  return labels.length > 0 ? labels : ["광고/유입 증거 없음"];
};

const actionDetailForConfirmedNoCapi = (
  entry: AttributionLedgerEntry,
  asOf: Date,
): FunnelHealthActionQueueDetail => {
  const loggedAtMs = Date.parse(entry.loggedAt);
  const ageMinutes = Number.isFinite(loggedAtMs)
    ? Math.max(0, Math.round((asOf.getTime() - loggedAtMs) / 60000))
    : null;
  const source = classifySource(entry);
  const paymentMethod = classifyPaymentMethod(entry);
  return {
    safe_ref: safeRefForLedgerEntry(entry),
    logged_at_kst: Number.isFinite(loggedAtMs) ? toKst(new Date(loggedAtMs)) : "불명",
    amount_krw: Math.round(resolveLedgerRevenueValue(entry)),
    payment_method: paymentMethod,
    payment_method_label: paymentMethodLabelKo(paymentMethod),
    source_bucket: source,
    source_label: sourceLabelKo(source),
    evidence: evidenceLabelsForEntry(entry),
    confirmed_basis: entry.approvedAt
      ? "VM Cloud attribution_ledger의 payment_success confirmed + 결제완료 시각 있음"
      : "VM Cloud attribution_ledger의 payment_success confirmed",
    capi_status: "missing_send_log_match",
    missing_reason: "같은 결제/주문 safe key로 성공한 Meta CAPI Purchase send log가 없음",
    recommended_action: "value guard와 duplicate를 확인한 뒤 backfill 후보로 분류",
    age_minutes: ageMinutes,
    confidence: "high",
  };
};

export type FunnelHealthResult = {
  ok: true;
  site: FunnelHealthSite;
  window: FunnelHealthWindow;
  granularity: FunnelHealthGranularity;
  payment_method: FunnelHealthPaymentMethod;
  source_filter: FunnelHealthSource;
  checked_at_kst: string;
  source_summary: {
    primary: string;
    cross_check: string[];
    freshness: "fresh" | "stale" | "unknown";
    confidence: "low" | "medium" | "medium_high" | "high";
    latest_logged_at_kst: string | null;
    latest_logged_age_hours: number | null;
  };
  site_landing_evidence: {
    applied_to_funnel_landing: boolean;
    source: string;
    unit: string;
    total: number;
    selected_count: number;
    attribution_ledger_marketing_intent_count: number;
    by_funnel_source: Partial<Record<FunnelHealthSource, number>>;
    cart_page_views?: {
      source: string;
      unit: string;
      path_pattern: string;
      total: number;
      selected_count: number;
      attribution_ledger_add_to_cart_count: number;
      by_funnel_source: Partial<Record<FunnelHealthSource, number>>;
      caveat: string;
    };
    caveat: string;
  };
  metric_contract: {
    site: FunnelHealthSite;
    pixel_ids: string[];
    all_sites_mode: boolean;
    window: FunnelHealthWindow;
    last_updated_at: string;
    metrics: Record<
      string,
      {
        source: string;
        unit: string;
        window: string;
        site: FunnelHealthSite;
        pixel_id: string | null;
        caveat: string;
      }
    >;
  };
  empty_state_diagnostic: {
    is_empty: boolean;
    reason:
      | "no_rows_in_window_but_data_exists_before"
      | "no_rows_anywhere"
      | "rows_filtered_out_by_site_or_method"
      | "has_rows"
      | "unknown";
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
    label: FunnelHealthStatusLabel;
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
    details?: FunnelHealthActionQueueDetail[];
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
    capi_site_filter: {
      site: FunnelHealthSite;
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
    latency_minutes: {
      p50: number | null;
      p95: number | null;
      sample_size: number;
    };
    no_send_reasons: Array<{ reason: string; human_label: string; count: number }>;
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
    confidence: "low" | "medium" | "high";
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

const toKst = (d: Date): string => {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

const safeRate = (curr: number, prev: number): number | null => {
  if (prev <= 0) return null;
  return Number((curr / prev).toFixed(4));
};

const determineStatus = (params: {
  confirmedPurchases: number;
  capiSuccess: number;
  browserPurchase: number;
  paymentStarted: number;
  unmatched: number;
  confirmedButNoCapi: number;
  decisionCanceled: number;
}): { label: FunnelHealthStatusLabel; main_issue: string; next_action: string } => {
  const { confirmedPurchases, capiSuccess, browserPurchase, paymentStarted, unmatched, confirmedButNoCapi, decisionCanceled } = params;

  // Red: 결제완료 있는데 Server CAPI 도 없고 Browser Purchase 도 없음
  if (confirmedPurchases > 0 && capiSuccess === 0 && browserPurchase === 0) {
    return {
      label: "긴급",
      main_issue: "결제완료가 있는데 Server CAPI · Browser Purchase 둘 다 0 — Meta 가 매출을 못 봄",
      next_action: "Meta CAPI sync 큐와 토큰/픽셀 인증, 브라우저 픽셀 발화를 동시 점검하세요.",
    };
  }
  // Red: 결제완료 대비 CAPI 성공률 80% 미만
  const capiRate = confirmedPurchases > 0 ? capiSuccess / confirmedPurchases : 1;
  if (capiRate < 0.8 && confirmedPurchases >= 5 && !(capiSuccess > confirmedPurchases)) {
    return {
      label: "긴급",
      main_issue: "결제완료 대비 CAPI 성공률이 80% 미만",
      next_action: "Meta CAPI 실패 사유 분포와 최근 24시간 error 코드를 확인하세요.",
    };
  }
  // Red: confirmed_but_no_capi_send 가 결제완료의 5% 이상이거나 절대값이 큼
  if (confirmedButNoCapi > 0 && confirmedPurchases > 0 && confirmedButNoCapi / confirmedPurchases >= 0.05) {
    return {
      label: "긴급",
      main_issue: `결제완료가 있는데 CAPI 전송 기록이 없는 row ${confirmedButNoCapi}건`,
      next_action: "Eligibility queue 의 oldest age 확인 후 backfill 후보 추리세요.",
    };
  }
  // Yellow: decision canceled 가 결제 시작의 10% 이상
  if (decisionCanceled > 0 && paymentStarted > 0 && decisionCanceled / paymentStarted >= 0.1) {
    return {
      label: "주의",
      main_issue: `결제 페이지까지 갔으나 완료 판단 응답이 끊긴 row ${decisionCanceled}건`,
      next_action: "Header Guard v3.1.1 / prefetch cache 무효화 후 canceled 재발 여부를 확인하세요.",
    };
  }
  // Yellow: Browser Purchase 만 누락 (Server CAPI 정상)
  if (confirmedPurchases > 0 && capiSuccess > 0 && browserPurchase === 0) {
    return {
      label: "주의",
      main_issue: "Server CAPI 는 정상 송신 중 · Browser Purchase 만 누락 (보조 신호 누락)",
      next_action:
        "치명은 아닙니다. Server CAPI 가 죽으면 Critical 로 올라갑니다. 시간 여유 있을 때 브라우저 픽셀 발화 점검.",
    };
  }
  if (paymentStarted > 0 && confirmedPurchases === 0) {
    return {
      label: "주의",
      main_issue: "결제 시작은 있는데 실제 결제완료가 없음",
      next_action: "결제 페이지 artifact, payment-decision timeout, 운영DB sync lag 를 확인하세요.",
    };
  }
  if (unmatched > 0 && confirmedPurchases > 0 && unmatched / Math.max(confirmedPurchases, 1) > 0.3) {
    return {
      label: "주의",
      main_issue: "매칭 안 된 결제흐름 비율이 30% 초과",
      next_action: "unmatched drilldown 표에서 가장 큰 사유부터 처리하세요.",
    };
  }
  return {
    label: "정상",
    main_issue: "현재 critical 신호 없음",
    next_action: "기간을 7일/30일로 늘려 구조적 누락 가능성을 추가 확인하세요.",
  };
};

export const buildFunnelHealthReport = (input: FunnelHealthInput): FunnelHealthResult => {
  const asOf = input.asOf ?? new Date();
  const windowEndMs = asOf.getTime();
  const windowStartMs = windowEndMs - FUNNEL_HEALTH_WINDOW_HOURS[input.window] * 60 * 60 * 1000;
  const sitePixelIds = SITE_PIXEL_IDS[input.site] ?? [];

  const ledger = input.ledgerEntries.filter((entry) => {
    if (!isWithinWindow(entry.loggedAt, windowStartMs, windowEndMs)) return false;
    return matchesFilters(entry, {
      site: input.site,
      paymentMethod: input.paymentMethod,
      source: input.source,
    });
  });

  const capiLogsForSite = input.capiLogs.filter((row) => capiPixelMatchesSite(row, input.site));

  const ledgerByJoinKeyForSite = new Map<string, AttributionLedgerEntry>();
  const ledgerByJoinKeyAnySite = new Map<string, AttributionLedgerEntry>();
  const rememberJoinEntry = (
    map: Map<string, AttributionLedgerEntry>,
    entry: AttributionLedgerEntry,
  ) => {
    const key = ledgerJoinKey(entry);
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, entry);
      return;
    }
    if (entry.paymentStatus === "confirmed" && prev.paymentStatus !== "confirmed") {
      map.set(key, entry);
      return;
    }
    const prevMs = Date.parse(prev.loggedAt);
    const entryMs = Date.parse(entry.loggedAt);
    if (Number.isFinite(entryMs) && (!Number.isFinite(prevMs) || entryMs > prevMs)) {
      map.set(key, entry);
    }
  };
  for (const entry of input.ledgerEntries) {
    if (entry.touchpoint !== "payment_success") continue;
    rememberJoinEntry(ledgerByJoinKeyAnySite, entry);
    if (input.site === "all_sites") {
      rememberJoinEntry(ledgerByJoinKeyForSite, entry);
      continue;
    }
    const entrySite = classifySite(entry);
    if (entrySite === input.site || entrySite === null) {
      rememberJoinEntry(ledgerByJoinKeyForSite, entry);
    }
  }
  const findLedgerForCapi = (row: MetaCapiSendLogRecord): AttributionLedgerEntry | undefined => {
    const key = capiJoinKey(row);
    if (!key) return undefined;
    return ledgerByJoinKeyForSite.get(key) ?? ledgerByJoinKeyAnySite.get(key);
  };

  // CAPI logs: filter by timestamp + operational (test/manual 분리)
  const capiInWindow = capiLogsForSite.filter((row) => {
    if (!row.timestamp) return false;
    if (!isWithinWindow(row.timestamp, windowStartMs, windowEndMs)) return false;
    return true;
  });

  const capiPurchaseInWindow = capiInWindow.filter(
    (row) => row.event_name === "Purchase",
  );

  // KPI 계산
  let vmOrderSignalsCount = ledger.length;
  let confirmedRevenue = 0;
  let confirmedCount = 0;
  let paymentStartedCount = 0;
  let attributionLedgerLandingCount = 0;
  let attributionLedgerAddToCartCount = 0;
  let addPaymentInfoCount = 0;

  for (const entry of ledger) {
    if (isLandingEntry(entry)) attributionLedgerLandingCount += 1;
    if (isAddToCartEntry(entry)) attributionLedgerAddToCartCount += 1;
    if (isPaymentStartedEntry(entry)) paymentStartedCount += 1;
    if (isAddPaymentInfoEntry(entry)) addPaymentInfoCount += 1;
    if (isConfirmedPurchaseEntry(entry)) {
      confirmedCount += 1;
      confirmedRevenue += resolveLedgerRevenueValue(entry);
    }
  }

  const siteLandingEvidenceCount =
    input.siteLandingEvidence
      ? input.source === "all"
        ? input.siteLandingEvidence.total
        : input.siteLandingEvidence.byFunnelSource[input.source] ?? 0
      : null;
  const landingCount = siteLandingEvidenceCount ?? attributionLedgerLandingCount;
  const cartPageViewEvidenceCount =
    input.siteLandingEvidence?.cartPageViews
      ? input.source === "all"
        ? input.siteLandingEvidence.cartPageViews.total
        : input.siteLandingEvidence.cartPageViews.byFunnelSource[input.source] ?? 0
      : null;
  const addToCartCount = cartPageViewEvidenceCount ?? attributionLedgerAddToCartCount;

  let capiSuccessCount = 0;
  let capiEventsReceivedTotal = 0;
  let capiFailedCount = 0;
  const capiSuccessOrderIds = new Set<string>();
  const capiSuccessLedgerKeys = new Set<string>();
  const capiSuccessEventIds = new Set<string>();
  for (const row of capiPurchaseInWindow) {
    if (classifyCapiSuccess(row)) {
      capiSuccessCount += 1;
      capiEventsReceivedTotal += eventsReceivedCount(row);
      const oid = row.ledger_entry?.orderId?.trim();
      if (oid) capiSuccessOrderIds.add(oid);
      const joinKey = capiJoinKey(row);
      if (joinKey) capiSuccessLedgerKeys.add(joinKey);
      const eid = row.event_id?.trim();
      if (eid) capiSuccessEventIds.add(eid);
    } else {
      capiFailedCount += 1;
    }
  }
  const capiSendAttempts = capiPurchaseInWindow.length;
  const capiUniqueOrders = capiSuccessLedgerKeys.size || capiSuccessOrderIds.size;
  const capiUniqueEventIds = capiSuccessEventIds.size;
  const capiDuplicateEstimate = Math.max(0, capiSuccessCount - capiUniqueOrders);

  // CAPI latency: payment_success ledger row 의 loggedAt 과 capi send timestamp 간 diff(분)
  const orderToConfirmedAtMs = new Map<string, number>();
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const joinKey = ledgerJoinKey(entry);
    if (!joinKey) continue;
    const ms = Date.parse(entry.loggedAt);
    if (!Number.isFinite(ms)) continue;
    const prev = orderToConfirmedAtMs.get(joinKey);
    if (prev === undefined || ms < prev) {
      orderToConfirmedAtMs.set(joinKey, ms);
    }
  }
  const latencyMinutes: number[] = [];
  for (const row of capiPurchaseInWindow) {
    if (!classifyCapiSuccess(row)) continue;
    const joinKey = capiJoinKey(row);
    if (!joinKey) continue;
    const confirmedMs = orderToConfirmedAtMs.get(joinKey);
    if (confirmedMs === undefined) continue;
    const sendMs = Date.parse(row.timestamp);
    if (!Number.isFinite(sendMs)) continue;
    const diffMin = (sendMs - confirmedMs) / (60 * 1000);
    if (diffMin >= 0 && diffMin < 60 * 24 * 30) {
      latencyMinutes.push(diffMin);
    }
  }
  latencyMinutes.sort((a, b) => a - b);
  const percentile = (sorted: number[], p: number): number | null => {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
    return Number(sorted[idx].toFixed(1));
  };
  const latencyP50 = percentile(latencyMinutes, 0.5);
  const latencyP95 = percentile(latencyMinutes, 0.95);

  // Browser Purchase 는 VM diagnostic 또는 별도 신호 미보유 시 0. 향후 확장 hook.
  const browserPurchaseCount = 0;

  // Unmatched = payment_success 인데 source 가 거의 없거나 fbclid/gclid/utm 모두 없는 경우
  let unmatchedCount = 0;
  let unmatchedRevenue = 0;
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const hasAnyAttribution =
      entry.utmSource ||
      entry.utmMedium ||
      entry.utmCampaign ||
      entry.gclid ||
      entry.fbclid ||
      entry.ttclid ||
      (typeof entry.metadata?.source === "string" && entry.metadata.source.trim());
    if (!hasAnyAttribution) {
      unmatchedCount += 1;
      unmatchedRevenue += resolveLedgerRevenueValue(entry);
    }
  }

  // statusInfo 는 reasonMap 계산 후 최종 산출. 우선 placeholder 로 두고 마지막에 재계산.
  // (placeholder 변수 — 컴파일러 만족용)
  let statusInfo = determineStatus({
    confirmedPurchases: confirmedCount,
    capiSuccess: capiSuccessCount,
    browserPurchase: browserPurchaseCount,
    paymentStarted: paymentStartedCount,
    unmatched: unmatchedCount,
    confirmedButNoCapi: 0,
    decisionCanceled: 0,
  });

  // Funnel 단계
  const funnel: FunnelHealthResult["funnel"] = [
    {
      step: "landing",
      label: FUNNEL_STEP_LABELS.landing,
      count: landingCount,
      rate_from_previous: null,
      status: landingCount === 0 ? "unknown" : "normal",
    },
    {
      step: "add_to_cart",
      label: FUNNEL_STEP_LABELS.add_to_cart,
      count: addToCartCount,
      rate_from_previous: safeRate(addToCartCount, landingCount),
      status: addToCartCount === 0 ? "unknown" : "normal",
    },
    {
      step: "payment_started",
      label: FUNNEL_STEP_LABELS.payment_started,
      count: paymentStartedCount,
      rate_from_previous: safeRate(paymentStartedCount, Math.max(addToCartCount, landingCount)),
      status: paymentStartedCount === 0 ? "warning" : "normal",
    },
    {
      step: "payment_method_selected",
      label: FUNNEL_STEP_LABELS.payment_method_selected,
      count: addPaymentInfoCount,
      rate_from_previous: safeRate(addPaymentInfoCount, paymentStartedCount),
      status: addPaymentInfoCount === 0 && paymentStartedCount > 0 ? "unknown" : "normal",
    },
    {
      step: "confirmed_purchase",
      label: FUNNEL_STEP_LABELS.confirmed_purchase,
      count: confirmedCount,
      rate_from_previous: safeRate(confirmedCount, Math.max(addPaymentInfoCount, paymentStartedCount)),
      status: confirmedCount === 0 && paymentStartedCount > 0 ? "warning" : "normal",
    },
    {
      step: "meta_capi_success",
      label: FUNNEL_STEP_LABELS.meta_capi_success,
      count: capiSuccessCount,
      rate_from_previous: safeRate(capiSuccessCount, confirmedCount),
      status:
        confirmedCount > 0 && capiSuccessCount === 0
          ? "alert"
          : confirmedCount > 0 && capiSuccessCount / confirmedCount < 0.8
            ? "warning"
            : "normal",
    },
    {
      step: "browser_purchase",
      label: FUNNEL_STEP_LABELS.browser_purchase,
      count: browserPurchaseCount,
      rate_from_previous: safeRate(browserPurchaseCount, capiSuccessCount),
      status:
        confirmedCount > 0 && browserPurchaseCount === 0 ? "warning" : "normal",
    },
  ];

  // 시계열 (granularity)
  const bucketMap = new Map<
    string,
    {
      landing: number;
      payment_started: number;
      confirmed_purchases: number;
      meta_capi_success: number;
      browser_purchase: number;
      unmatched: number;
    }
  >();

  const ensureBucket = (key: string) => {
    let b = bucketMap.get(key);
    if (!b) {
      b = {
        landing: 0,
        payment_started: 0,
        confirmed_purchases: 0,
        meta_capi_success: 0,
        browser_purchase: 0,
        unmatched: 0,
      };
      bucketMap.set(key, b);
    }
    return b;
  };

  for (const entry of ledger) {
    const key = dateKey(entry.loggedAt, input.granularity);
    if (!key) continue;
    const b = ensureBucket(key);
    if (isLandingEntry(entry)) b.landing += 1;
    if (isPaymentStartedEntry(entry)) b.payment_started += 1;
    if (isConfirmedPurchaseEntry(entry)) {
      b.confirmed_purchases += 1;
      const hasAttribution =
        entry.utmSource ||
        entry.utmMedium ||
        entry.gclid ||
        entry.fbclid ||
        entry.ttclid ||
        (typeof entry.metadata?.source === "string" && entry.metadata.source.trim());
      if (!hasAttribution) b.unmatched += 1;
    }
  }
  for (const row of capiPurchaseInWindow) {
    if (!classifyCapiSuccess(row)) continue;
    const key = dateKey(row.timestamp, input.granularity);
    if (!key) continue;
    const b = ensureBucket(key);
    b.meta_capi_success += 1;
  }
  if (input.siteLandingEvidence) {
    for (const row of input.siteLandingEvidence.series) {
      const b = ensureBucket(row.date);
      b.landing =
        input.source === "all"
          ? row.landing
          : row.byFunnelSource?.[input.source] ?? 0;
    }
  }

  const series = Array.from(bucketMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({ date, ...b }));

  // UTM breakdown
  type BreakdownAcc = {
    landing: number;
    payment_started: number;
    confirmed_purchase: number;
    meta_capi_success: number;
    unmatched: number;
  };
  const channels: Array<FunnelHealthSource> = [
    "meta",
    "google",
    "naver",
    "organic",
    "direct",
    "utm_present",
    "utm_missing",
    "no_ledger_match",
  ];
  const breakdownMap = new Map<FunnelHealthSource, BreakdownAcc>();
  for (const c of channels) {
    breakdownMap.set(c, {
      landing: 0,
      payment_started: 0,
      confirmed_purchase: 0,
      meta_capi_success: 0,
      unmatched: 0,
    });
  }
  for (const entry of ledger) {
    let key: FunnelHealthSource = classifySource(entry);
    if (!entry.utmSource && !entry.utmMedium && key === "direct") {
      key = "utm_missing";
    }
    const acc = breakdownMap.get(key);
    if (!acc) continue;
    if (isLandingEntry(entry)) acc.landing += 1;
    if (isPaymentStartedEntry(entry)) acc.payment_started += 1;
    if (isConfirmedPurchaseEntry(entry)) {
      acc.confirmed_purchase += 1;
      const hasAttribution =
        entry.utmSource ||
        entry.utmMedium ||
        entry.gclid ||
        entry.fbclid ||
        entry.ttclid ||
        (typeof entry.metadata?.source === "string" && entry.metadata.source.trim());
      if (!hasAttribution) acc.unmatched += 1;
    }
  }
  if (input.siteLandingEvidence) {
    for (const acc of breakdownMap.values()) {
      acc.landing = 0;
    }
    if (input.source === "all") {
      for (const channel of channels) {
        const acc = breakdownMap.get(channel);
        if (!acc) continue;
        acc.landing = input.siteLandingEvidence.byFunnelSource[channel] ?? 0;
      }
    } else {
      const acc = breakdownMap.get(input.source);
      if (acc) acc.landing = input.siteLandingEvidence.byFunnelSource[input.source] ?? 0;
    }
  }
  // CAPI success 는 ledger_entry.touchpoint 별로 매핑
  for (const row of capiPurchaseInWindow) {
    if (!classifyCapiSuccess(row)) continue;
    const matched = findLedgerForCapi(row);
    let key: FunnelHealthSource = "no_ledger_match";
    if (matched) {
      key = classifySource(matched);
      if (!matched.utmSource && !matched.utmMedium && key === "direct") {
        key = "utm_missing";
      }
    }
    const acc = breakdownMap.get(key);
    if (acc) acc.meta_capi_success += 1;
  }

  const utm_breakdown: FunnelHealthResult["utm_breakdown"] = channels.map((channel) => {
    const acc = breakdownMap.get(channel)!;
    const nextAction = (() => {
      if (channel === "meta" && acc.confirmed_purchase > 0 && acc.meta_capi_success === 0) {
        return "Meta evidence와 confirmed purchase bridge 확인이 필요합니다.";
      }
      if (channel === "naver" && acc.landing > 0 && acc.confirmed_purchase === 0) {
        return "Naver paid 후보는 보이나 결제완료 연결이 약합니다. destination URL UTM canary를 먼저 확인하세요.";
      }
      if (channel === "utm_missing" && acc.confirmed_purchase > 0) {
        return "UTM 없이 들어온 결제완료가 있습니다. 광고 링크의 UTM 일관성을 점검하세요.";
      }
      if (channel === "no_ledger_match" && acc.meta_capi_success > 0) {
        return "CAPI send log는 있으나 VM Cloud attribution_ledger와 조인되지 않습니다. pixel/site 필터와 log ledger summary를 확인하세요.";
      }
      if (acc.landing === 0 && acc.payment_started === 0 && acc.confirmed_purchase === 0) {
        return "이 기간에는 신호 없음. 다른 기간 비교를 권장합니다.";
      }
      return "현재 critical 신호 없음. 추세를 계속 확인하세요.";
    })();
    return {
      channel,
      human_label: SOURCE_CHANNEL_LABELS[channel] ?? channel,
      landing_count: acc.landing,
      payment_started_count: acc.payment_started,
      confirmed_purchase_count: acc.confirmed_purchase,
      meta_capi_success_count: acc.meta_capi_success,
      unmatched_count: acc.unmatched,
      budget_roas_included: channel === "meta" || channel === "google" || channel === "naver",
      next_action: nextAction,
    };
  });

  // Unmatched reasons (drilldown)
  type ReasonAcc = { count: number; amount: number };
  const reasonMap = new Map<string, ReasonAcc>();
  const reasonDetails = new Map<string, FunnelHealthActionQueueDetail[]>();
  const bump = (key: string, amount: number) => {
    const cur = reasonMap.get(key) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += amount;
    reasonMap.set(key, cur);
  };
  const rememberReasonDetail = (key: string, detail: FunnelHealthActionQueueDetail) => {
    const rows = reasonDetails.get(key) ?? [];
    if (rows.length < 50) {
      rows.push(detail);
      reasonDetails.set(key, rows);
    }
  };

  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const amt = resolveLedgerRevenueValue(entry);
    const hasAttribution =
      entry.utmSource ||
      entry.utmMedium ||
      entry.gclid ||
      entry.fbclid ||
      entry.ttclid ||
      (typeof entry.metadata?.source === "string" && entry.metadata.source.trim());
    if (!hasAttribution) {
      bump("utm_referrer_missing", amt);
    }
    if (!entry.gclid && !entry.fbclid && !entry.ttclid) {
      // click id 미보유 자체는 별도 진단용 카운트
      bump("click_id_missing", 0);
    }
  }
  // confirmed 인데 CAPI 성공이 없는 ledger entry 추정
  const successfulCapiOrderHints = new Set<string>();
  for (const row of capiLogsForSite) {
    if (row.event_name !== "Purchase") continue;
    const ts = Date.parse(row.timestamp);
    if (Number.isFinite(ts) && ts > windowEndMs) continue;
    if (classifyCapiSuccess(row)) {
      const hint = capiJoinKey(row);
      if (hint) successfulCapiOrderHints.add(hint);
    }
  }
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const joinKey = ledgerJoinKey(entry);
    if (joinKey && successfulCapiOrderHints.has(joinKey)) continue;
    if (!joinKey) continue;
    bump("confirmed_but_no_capi_send", resolveLedgerRevenueValue(entry));
    rememberReasonDetail("confirmed_but_no_capi_send", actionDetailForConfirmedNoCapi(entry, asOf));
  }
  // payment_page_seen 만 있고 confirmed 가 없는 경우 = payment_decision_timeout/canceled 가능성
  const ledgerOrderConfirmed = new Set<string>();
  for (const entry of ledger) {
    if (isConfirmedPurchaseEntry(entry) && entry.orderId) {
      ledgerOrderConfirmed.add(entry.orderId);
    }
  }
  let timeoutCount = 0;
  for (const entry of ledger) {
    if (entry.touchpoint !== "payment_page_seen") continue;
    if (entry.orderId && ledgerOrderConfirmed.has(entry.orderId)) continue;
    timeoutCount += 1;
  }
  if (timeoutCount > 0) {
    reasonMap.set("payment_decision_timeout_or_canceled", { count: timeoutCount, amount: 0 });
  }

  const reasonHumanLabel: Record<string, string> = {
    utm_referrer_missing: "결제완료에 UTM/referrer/click id 정보가 비어 있음",
    click_id_missing: "결제완료 신호에 click id가 없음 (Meta/Google/TikTok)",
    confirmed_but_no_capi_send: "결제완료가 있는데 Meta CAPI 전송 기록이 없음",
    payment_decision_timeout_or_canceled: "결제 페이지까지 갔으나 완료 판단 요청이 끊김",
  };
  const reasonNextAction: Record<string, string> = {
    utm_referrer_missing: "광고 링크 UTM 일관성과 결제 시작 wrapper의 referrer 유지 정책을 확인하세요.",
    click_id_missing: "광고 link tagging과 클라이언트 click id capture 시점을 점검하세요.",
    confirmed_but_no_capi_send: "Meta CAPI sync 큐와 사유 분포를 보고 재전송 정책을 점검하세요.",
    payment_decision_timeout_or_canceled: "Header Guard v3.1 적용 후 canceled 재발 여부와 timeout 사유를 확인하세요.",
  };

  const reasonCategory: Record<
    string,
    { in_kpi: boolean; category: "kpi_unmatched" | "diagnostic_hint" | "upstream_dropoff" | "capi_pipeline" }
  > = {
    utm_referrer_missing: { in_kpi: true, category: "kpi_unmatched" },
    click_id_missing: { in_kpi: false, category: "diagnostic_hint" },
    confirmed_but_no_capi_send: { in_kpi: false, category: "capi_pipeline" },
    payment_decision_timeout_or_canceled: { in_kpi: false, category: "upstream_dropoff" },
  };

  const unmatched_reasons: FunnelHealthResult["unmatched_reasons"] = Array.from(
    reasonMap.entries(),
  )
    .sort((a, b) => b[1].count - a[1].count)
    .map(([reason, acc]) => {
      const cat = reasonCategory[reason] ?? { in_kpi: false, category: "diagnostic_hint" as const };
      return {
        reason,
        human_label: reasonHumanLabel[reason] ?? reason,
        count: acc.count,
        amount_krw: Math.round(acc.amount),
        confidence: reason === "confirmed_but_no_capi_send" || reason === "payment_decision_timeout_or_canceled"
          ? ("high" as const)
          : ("medium" as const),
        budget_roas_included: false,
        next_action: reasonNextAction[reason] ?? "사유별 raw evidence 표본을 확인하세요.",
        in_kpi_unmatched_metric: cat.in_kpi,
        category: cat.category,
      };
    });

  // CAPI health: 1h / today / 7d
  const oneHourAgoMs = windowEndMs - 60 * 60 * 1000;
  const todayKstStartMs = (() => {
    const kst = new Date(windowEndMs + 9 * 60 * 60 * 1000);
    kst.setUTCHours(0, 0, 0, 0);
    return kst.getTime() - 9 * 60 * 60 * 1000;
  })();
  const sevenDaysAgoMs = windowEndMs - 7 * 24 * 60 * 60 * 1000;

  const bucketCapi = (startMs: number) => {
    let attempted = 0;
    let success = 0;
    let events_received = 0;
    let failed = 0;
    for (const row of capiLogsForSite) {
      const ts = Date.parse(row.timestamp);
      if (!Number.isFinite(ts)) continue;
      if (ts < startMs || ts > windowEndMs) continue;
      if (row.event_name !== "Purchase") continue;
      attempted += 1;
      if (classifyCapiSuccess(row)) {
        success += 1;
        events_received += eventsReceivedCount(row);
      } else {
        failed += 1;
      }
    }
    return { attempted, success, events_received, failed };
  };

  let lastSuccessAtKst: string | null = null;
  for (const row of capiLogsForSite) {
    if (row.event_name !== "Purchase") continue;
    if (classifyCapiSuccess(row) && row.timestamp) {
      const d = new Date(row.timestamp);
      if (Number.isFinite(d.getTime())) {
        lastSuccessAtKst = toKst(d);
        break; // logs already sorted desc
      }
    }
  }

  // no_send_reasons placeholder: ledger metadata 의 metaCapiAutoSendAllowed=false hints 등
  const noSendCounts = new Map<string, number>();
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const meta = entry.metadata as Record<string, unknown>;
    if (meta?.metaCapiAutoSendAllowed === false) {
      const reason = typeof meta?.metaCapiNoSendReason === "string"
        ? meta.metaCapiNoSendReason
        : "auto_send_disabled";
      noSendCounts.set(reason, (noSendCounts.get(reason) ?? 0) + 1);
    }
  }
  const noSendHumanLabel: Record<string, string> = {
    auto_send_disabled: "이 ledger row는 자동 send 비활성화 상태",
    safe_candidate_only: "안전 후보만 confirmed로 표시하는 정책",
  };
  const no_send_reasons = Array.from(noSendCounts.entries()).map(([reason, count]) => ({
    reason,
    human_label: noSendHumanLabel[reason] ?? reason,
    count,
  }));

  // Freshness: ledger 최신 row 가 6h 이내면 fresh, 24h 이내면 stale 경계
  let freshness: "fresh" | "stale" | "unknown" = "unknown";
  let latestMs = 0;
  for (const entry of input.ledgerEntries) {
    const ms = Date.parse(entry.loggedAt);
    if (Number.isFinite(ms) && ms > latestMs) latestMs = ms;
  }
  let latestLoggedAgeHours: number | null = null;
  let latestLoggedAtKst: string | null = null;
  if (latestMs > 0) {
    const ageHours = (asOf.getTime() - latestMs) / (60 * 60 * 1000);
    if (ageHours <= 6) freshness = "fresh";
    else freshness = "stale";
    latestLoggedAgeHours = Number(ageHours.toFixed(1));
    latestLoggedAtKst = toKst(new Date(latestMs));
  }

  // Empty state diagnostic: KPI 가 모두 0 일 때 왜 0 인지 사용자에게 풀어쓴다.
  const totalRowsAllTime = input.ledgerEntries.length;
  const rowsInWindowBeforeFilters = input.ledgerEntries.filter((entry) =>
    isWithinWindow(entry.loggedAt, windowStartMs, windowEndMs),
  ).length;
  const rowsAfterFilters = ledger.length;
  const isEmpty = rowsAfterFilters === 0 && landingCount === 0;

  let emptyReason:
    | "no_rows_in_window_but_data_exists_before"
    | "no_rows_anywhere"
    | "rows_filtered_out_by_site_or_method"
    | "has_rows"
    | "unknown" = "has_rows";
  let emptyHuman =
    rowsAfterFilters === 0 && landingCount > 0
      ? "landing row 는 있으나 결제/주문 단계 ledger row 는 아직 없습니다."
      : "이 기간에 row 가 있어 정상 집계되었습니다.";
  let emptyNext =
    rowsAfterFilters === 0 && landingCount > 0
      ? "유입은 잡히므로 결제 시작·결제완료 단계 수집 여부를 확인하세요."
      : "신호가 약한 단계가 있다면 해당 단계의 drilldown 을 확인하세요.";
  if (isEmpty) {
    if (totalRowsAllTime === 0) {
      emptyReason = "no_rows_anywhere";
      emptyHuman = "VM Cloud attribution_ledger 자체가 비어 있습니다.";
      emptyNext = "운영 환경(VM Cloud) 에서 ledger receiver 가 살아 있는지 확인하세요.";
    } else if (rowsInWindowBeforeFilters === 0 && totalRowsAllTime > 0) {
      emptyReason = "no_rows_in_window_but_data_exists_before";
      const ageDays = latestLoggedAgeHours !== null ? Math.round(latestLoggedAgeHours / 24) : null;
      emptyHuman =
        ageDays !== null
          ? `이 기간에는 row 가 없습니다. ledger 의 가장 최신 row 는 약 ${ageDays}일 전이라 30일 window 로도 잡히지 않습니다.`
          : "이 기간에는 row 가 없습니다. ledger 최신 row 가 window 밖에 있습니다.";
      emptyNext =
        "로컬 환경이라면 운영 VM Cloud 배포 후 실시간 row 가 들어옵니다. ledger sync 또는 운영 환경에서 다시 확인하세요.";
    } else if (rowsInWindowBeforeFilters > 0) {
      emptyReason = "rows_filtered_out_by_site_or_method";
      emptyHuman = `window 안에는 ${rowsInWindowBeforeFilters}건이 있지만 사이트/결제수단/유입 필터로 0건만 남았습니다.`;
      emptyNext =
        "사이트 탭을 다른 값으로 바꾸거나, 결제수단/유입 필터를 '전체'로 풀어보세요.";
    } else {
      emptyReason = "unknown";
      emptyHuman = "row 0건 사유를 분류하지 못했습니다.";
      emptyNext = "API 응답을 점검하거나 다른 기간으로 재조회하세요.";
    }
  }

  const windowStartKst = toKst(new Date(windowStartMs));

  // statusInfo 재계산 (reasonMap 카운트 반영)
  const confirmedButNoCapiCount = reasonMap.get("confirmed_but_no_capi_send")?.count ?? 0;
  const decisionCanceledCount = reasonMap.get("payment_decision_timeout_or_canceled")?.count ?? 0;
  statusInfo = determineStatus({
    confirmedPurchases: confirmedCount,
    capiSuccess: capiSuccessCount,
    browserPurchase: browserPurchaseCount,
    paymentStarted: paymentStartedCount,
    unmatched: unmatchedCount,
    confirmedButNoCapi: confirmedButNoCapiCount,
    decisionCanceled: decisionCanceledCount,
  });

  // === risk_combo ===
  const serverCapiActive = capiSuccessCount > 0;
  const browserPurchaseActive = browserPurchaseCount > 0;
  let riskState: "all_safe" | "browser_only_missing" | "server_only_missing" | "all_missing" | "unknown" = "unknown";
  let riskHuman = "";
  let riskExplain = "";
  if (confirmedCount === 0) {
    riskState = "unknown";
    riskHuman = "이 기간 결제완료가 없어 위험 조합 판정을 보류합니다.";
    riskExplain = "결제완료(confirmed) row 자체가 없으면 Server CAPI/Browser Purchase 모두 평가 의미가 없습니다.";
  } else if (serverCapiActive && browserPurchaseActive) {
    riskState = "all_safe";
    riskHuman = "Server CAPI · Browser Purchase 모두 살아 있음";
    riskExplain = "서버는 Meta 로 구매 이벤트를 잘 보내고 있고, 브라우저 픽셀에서도 Purchase 가 잡힙니다. 정상.";
  } else if (serverCapiActive && !browserPurchaseActive) {
    riskState = "browser_only_missing";
    riskHuman = "Server CAPI 정상 · Browser Purchase 만 누락 (보조 신호 누락)";
    riskExplain =
      "Meta 로 가는 구매 신호는 서버가 대체 전송 중이라 치명 장애는 아닙니다. " +
      "다만 브라우저 픽셀 보조 경로가 끊겨 있어 event match quality 등 일부 지표는 약해질 수 있습니다.";
  } else if (!serverCapiActive && browserPurchaseActive) {
    riskState = "server_only_missing";
    riskHuman = "Server CAPI 누락 · Browser Purchase 만 활성 (Critical)";
    riskExplain =
      "서버에서 Meta 로 가는 구매 이벤트가 끊겨 있습니다. Browser Purchase 만으로는 dedup 기준이 약해서 학습/광고 최적화에 손실이 큽니다.";
  } else {
    riskState = "all_missing";
    riskHuman = "Server CAPI · Browser Purchase 모두 누락 — 결제완료가 Meta 에 0 으로 보임 (Critical)";
    riskExplain =
      "결제완료는 있는데 Meta 가 어느 채널로도 그것을 받지 못합니다. 광고 최적화/리타게팅이 즉시 손상됩니다.";
  }

  // === unresolved_leaks (drilldown 의 진단 hint 그룹 합산) ===
  const leakPriorityMap: Record<
    string,
    { priority: "critical" | "high" | "medium" | "watch"; human: string; nextAction: string; explanation: string }
  > = {
    confirmed_but_no_capi_send: {
      priority: "critical",
      human: "결제완료가 있는데 Meta CAPI 전송 기록이 없음",
      nextAction: "Eligibility queue 점검 후 backfill 후보 추리고, Meta CAPI sync 큐 사유 분포 확인",
      explanation:
        "결제는 끝났는데 Meta 로 구매 이벤트가 안 갔다는 뜻입니다. 광고비 효율을 직접 깎는 항목이라 가장 시급합니다.",
    },
    payment_decision_timeout_or_canceled: {
      priority: "high",
      human: "결제 페이지까지 갔으나 완료 판단 응답이 끊김 / 취소됨",
      nextAction: "Header Guard v3.1.1 적용 후 canceled 재발 여부 + prefetch cache 무효화 확인",
      explanation:
        "사용자가 결제하려고 누르긴 했는데 서버 응답이 늦거나 끊겨서 결제완료 판단이 안 된 케이스입니다. " +
        "정말 결제 안 한 경우와 결제는 됐는데 응답만 끊긴 경우가 섞여 있어, 후자는 매출이 잡혀도 Purchase 발화가 안 됩니다.",
    },
    click_id_missing: {
      priority: "medium",
      human: "결제완료에 광고 click id (gclid/fbclid/ttclid) 가 없음",
      nextAction: "광고 link tagging 일관성 + 클라이언트 click id capture timing 점검",
      explanation:
        "결제완료는 잡혔는데 어느 광고로 들어왔는지 식별자가 비어 있어 광고 귀속이 약해지는 케이스입니다. utm 만 있을 수도 있으니 진단 hint 입니다.",
    },
    utm_referrer_missing: {
      priority: "medium",
      human: "결제완료에 utm/referrer/source 가 모두 없음",
      nextAction: "광고 link UTM 일관성 + 결제 시작 wrapper referrer 유지 정책 확인",
      explanation:
        "결제완료가 어디서 왔는지 단서가 거의 없는 row 입니다. KPI '매칭 안 된 흐름' 과 같은 row 입니다.",
    },
  };

  const unresolvedItems: FunnelHealthResult["unresolved_leaks"]["items"] = [];
  for (const [reason, acc] of reasonMap.entries()) {
    const meta = leakPriorityMap[reason];
    if (!meta) continue;
    unresolvedItems.push({
      key: reason,
      human_label: meta.human,
      count: acc.count,
      amount_krw: Math.round(acc.amount),
      priority: meta.priority,
      next_action: meta.nextAction,
      explanation_ko: meta.explanation,
    });
  }
  // sort by priority weight then count desc
  const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, watch: 3 };
  unresolvedItems.sort((a, b) => {
    const pw = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (pw !== 0) return pw;
    return b.count - a.count;
  });
  const unresolvedTotalCount = unresolvedItems.reduce((s, it) => s + it.count, 0);
  const unresolvedTotalAmount = unresolvedItems.reduce((s, it) => s + it.amount_krw, 0);

  // === action_queue ===
  const actionQueue: FunnelHealthResult["action_queue"] = [];
  for (const item of unresolvedItems) {
    const details = (reasonDetails.get(item.key) ?? [])
      .slice()
      .sort((a, b) => {
        if (b.amount_krw !== a.amount_krw) return b.amount_krw - a.amount_krw;
        return (b.age_minutes ?? 0) - (a.age_minutes ?? 0);
      });
    actionQueue.push({
      key: item.key,
      priority: item.priority,
      title: item.human_label,
      detail: `${item.count.toLocaleString()}건${item.amount_krw > 0 ? ` · 추정 ₩${Math.round(item.amount_krw).toLocaleString()}` : ""}`,
      next_action: item.next_action,
      count: item.count,
      amount_krw: item.amount_krw,
      explanation_ko: item.explanation_ko,
      details: details.length > 0 ? details : undefined,
    });
  }
  // browser_purchase 0 은 watch 로 항상 추가 (server_capi 활성 시)
  if (serverCapiActive && !browserPurchaseActive) {
    actionQueue.push({
      key: "browser_purchase_missing_watch",
      priority: "watch",
      title: "Browser Purchase 0 (보조 신호 누락)",
      detail: "Server CAPI 정상 전송 중이라 즉시 조치 불요",
      next_action: "복구는 시간이 있을 때 — 브라우저 픽셀 발화 점검",
      count: 0,
      amount_krw: 0,
      explanation_ko:
        "브라우저에서 facebook.com/tr ev=Purchase 가 안 보입니다. 다만 서버 쪽 CAPI 가 살아 있어 Meta 학습에 큰 손실은 없는 상태입니다. " +
        "Server CAPI 가 죽으면 즉시 Critical 로 올려야 합니다.",
    });
  }

  // === capi_attribution_join ===
  // CAPI 성공 orderId 와 ledger entry 의 utm/click id 를 join 해서 분해
  let capiJoinUtm = 0;
  let capiJoinFbc = 0;
  let capiJoinFbp = 0;
  let capiJoinFbclid = 0;
  let capiJoinGclid = 0;
  let capiJoinUtmMissing = 0;
  let capiJoinSourceUnknown = 0;
  let capiJoinNoLedger = 0;
  let capiJoinStrongMetaEvidence = 0;
  let capiJoinNonMetaOrUnprovenMeta = 0;
  for (const row of capiPurchaseInWindow) {
    if (!classifyCapiSuccess(row)) continue;
    const matched = findLedgerForCapi(row);
    if (!matched) {
      capiJoinNoLedger += 1;
      capiJoinNonMetaOrUnprovenMeta += 1;
      continue;
    }
    const hasUtm = !!(matched.utmSource || matched.utmMedium || matched.utmCampaign);
    if (hasUtm) capiJoinUtm += 1;
    else capiJoinUtmMissing += 1;
    if (matched.fbclid) capiJoinFbclid += 1;
    if (matched.gclid) capiJoinGclid += 1;
    const meta = matched.metadata as Record<string, unknown> | undefined;
    if (meta) {
      if (typeof meta.fbp === "string" && meta.fbp.trim()) capiJoinFbp += 1;
      if (typeof meta.fbc === "string" && meta.fbc.trim()) capiJoinFbc += 1;
    }
    const sourceMeta = typeof meta?.source === "string" ? meta.source.trim() : "";
    const utmSource = matched.utmSource?.toLowerCase() ?? "";
    const utmMedium = matched.utmMedium?.toLowerCase() ?? "";
    const utmCampaign = matched.utmCampaign?.toLowerCase() ?? "";
    const sourceMetaLower = sourceMeta.toLowerCase();
    const hasStrongMetaEvidence =
      Boolean(matched.fbclid) ||
      Boolean(typeof meta?.fbc === "string" && meta.fbc.trim()) ||
      utmSource.includes("meta") ||
      utmSource.includes("facebook") ||
      utmSource.includes("instagram") ||
      utmMedium.includes("facebook") ||
      utmMedium.includes("instagram") ||
      utmCampaign.includes("meta") ||
      utmCampaign.includes("facebook") ||
      utmCampaign.includes("instagram") ||
      sourceMetaLower.includes("meta") ||
      sourceMetaLower.includes("facebook") ||
      sourceMetaLower.includes("instagram");
    if (hasStrongMetaEvidence) capiJoinStrongMetaEvidence += 1;
    else capiJoinNonMetaOrUnprovenMeta += 1;
    if (!hasUtm && !sourceMeta && !matched.fbclid && !matched.gclid && !matched.ttclid) {
      capiJoinSourceUnknown += 1;
    }
  }
  const capiSuccessTotal = capiSuccessCount;
  const sharePct = (n: number) =>
    capiSuccessTotal > 0 ? Number(((n / capiSuccessTotal) * 100).toFixed(1)) : 0;
  const capiAttributionJoin: FunnelHealthResult["capi_attribution_join"] = {
    window_label: WINDOW_LABEL[input.window],
    capi_sent_orders: capiSuccessTotal,
    breakdown: [
      {
        bucket: "utm_present",
        human_label: "CAPI 전송 중 UTM 있음",
        count: capiJoinUtm,
        share_pct: sharePct(capiJoinUtm),
        explanation_ko: "CAPI 가 발송된 주문 중 ledger 에 utm_source/medium/campaign 어느 하나라도 잡힌 비율",
      },
      {
        bucket: "fbclid_present",
        human_label: "CAPI 전송 중 fbclid 있음",
        count: capiJoinFbclid,
        share_pct: sharePct(capiJoinFbclid),
        explanation_ko: "Meta 광고 클릭 식별자(fbclid) 가 ledger 에 있는 주문 비율",
      },
      {
        bucket: "fbp_present",
        human_label: "CAPI 전송 중 fbp 있음",
        count: capiJoinFbp,
        share_pct: sharePct(capiJoinFbp),
        explanation_ko: "Facebook Pixel 의 사용자 식별 쿠키 fbp 가 함께 잡힌 주문 비율",
      },
      {
        bucket: "fbc_present",
        human_label: "CAPI 전송 중 fbc 있음",
        count: capiJoinFbc,
        share_pct: sharePct(capiJoinFbc),
        explanation_ko: "Facebook click 쿠키 fbc 가 함께 잡힌 주문 비율 (event match quality 핵심)",
      },
      {
        bucket: "strong_meta_ad_evidence",
        human_label: "Meta 광고 유입 증거 있음",
        count: capiJoinStrongMetaEvidence,
        share_pct: sharePct(capiJoinStrongMetaEvidence),
        explanation_ko:
          "fbclid/fbc 또는 Meta/Facebook/Instagram UTM·source evidence 가 있는 CAPI Purchase 입니다. Meta 광고 기여로 볼 수 있는 강한 후보입니다.",
      },
      {
        bucket: "non_meta_or_unproven_meta",
        human_label: "Meta 유입 증거 없음 또는 약함",
        count: capiJoinNonMetaOrUnprovenMeta,
        share_pct: sharePct(capiJoinNonMetaOrUnprovenMeta),
        explanation_ko:
          "fbp 쿠키만 있거나 ledger 조인이 없어 Meta 광고 유입이라고 단정할 수 없는 CAPI Purchase 입니다. 다른 유입일 가능성을 여기에 둡니다.",
      },
      {
        bucket: "gclid_present",
        human_label: "CAPI 전송 중 gclid 있음",
        count: capiJoinGclid,
        share_pct: sharePct(capiJoinGclid),
        explanation_ko: "Google 광고 클릭 식별자가 함께 잡힌 주문 비율 (Meta 와 무관한 진단용)",
      },
      {
        bucket: "utm_missing",
        human_label: "CAPI 전송 중 UTM 없음",
        count: capiJoinUtmMissing,
        share_pct: sharePct(capiJoinUtmMissing),
        explanation_ko: "CAPI 는 정상 송신됐는데 ledger 에 utm 흔적이 없는 주문",
      },
      {
        bucket: "source_unknown",
        human_label: "CAPI 전송 중 source unknown",
        count: capiJoinSourceUnknown,
        share_pct: sharePct(capiJoinSourceUnknown),
        explanation_ko: "UTM/click id/source meta 모두 비어 있는 주문 (광고 귀속이 불가능)",
      },
      {
        bucket: "no_ledger_match",
        human_label: "CAPI log 의 orderId 가 ledger 와 매칭 안 됨",
        count: capiJoinNoLedger,
        share_pct: sharePct(capiJoinNoLedger),
        explanation_ko: "다른 사이트 또는 window 밖 ledger 와 attribution join 이 안 되는 row. UTM Breakdown 의 CAPI 합이 작게 나오는 원인.",
      },
    ],
    note_ko:
      "이 표는 'CAPI 가 보내지긴 했지만 어떤 utm/click id 와 짝지어졌는지' 를 보여줍니다. " +
      "UTM Breakdown 표의 CAPI 합이 적게 보일 때 여기서 'no_ledger_match' 가 큰지 먼저 확인하세요.",
  };

  // === purchase_eligibility_queue ===
  // confirmed 인데 capi success orderId set 에 없는 ledger entry
  let eligibleCount = 0;
  let eligibleAmount = 0;
  let eligibleOldestMs: number | null = null;
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    const joinKey = ledgerJoinKey(entry);
    if (!joinKey) continue;
    if (successfulCapiOrderHints.has(joinKey)) continue;
    eligibleCount += 1;
    eligibleAmount += resolveLedgerRevenueValue(entry);
    const ms = Date.parse(entry.loggedAt);
    if (Number.isFinite(ms)) {
      if (eligibleOldestMs === null || ms < eligibleOldestMs) {
        eligibleOldestMs = ms;
      }
    }
  }
  const oldestAgeMinutes =
    eligibleOldestMs !== null ? Number(((asOf.getTime() - eligibleOldestMs) / 60000).toFixed(1)) : null;

  // === signal_quality ===
  let sqTotal = 0;
  let sqFbp = 0;
  let sqFbc = 0;
  let sqFbclid = 0;
  let sqGclid = 0;
  let sqGbraid = 0;
  let sqWbraid = 0;
  let sqUtm = 0;
  let sqClientId = 0;
  let sqGaSession = 0;
  for (const entry of ledger) {
    if (!isConfirmedPurchaseEntry(entry)) continue;
    sqTotal += 1;
    const meta = entry.metadata as Record<string, unknown> | undefined;
    if (typeof meta?.fbp === "string" && meta.fbp.trim()) sqFbp += 1;
    if (typeof meta?.fbc === "string" && meta.fbc.trim()) sqFbc += 1;
    if (entry.fbclid) sqFbclid += 1;
    if (entry.gclid) sqGclid += 1;
    if (typeof meta?.gbraid === "string" && meta.gbraid.trim()) sqGbraid += 1;
    if (typeof meta?.wbraid === "string" && meta.wbraid.trim()) sqWbraid += 1;
    if (entry.utmSource || entry.utmMedium || entry.utmCampaign) sqUtm += 1;
    if (typeof meta?.clientId === "string" && meta.clientId.trim()) sqClientId += 1;
    if (entry.gaSessionId) sqGaSession += 1;
  }
  const sqRate = (n: number) => (sqTotal > 0 ? Number(((n / sqTotal) * 100).toFixed(1)) : 0);
  const signalQuality: FunnelHealthResult["signal_quality"] = {
    confirmed_purchases_total: sqTotal,
    fields: [
      {
        field: "fbp",
        human_label: "fbp (Facebook 사용자 쿠키)",
        present_count: sqFbp,
        present_rate: sqRate(sqFbp),
        explanation_ko: "Meta 가 사용자별 식별에 쓰는 쿠키. event match quality 의 핵심.",
      },
      {
        field: "fbc",
        human_label: "fbc (Facebook 클릭 쿠키)",
        present_count: sqFbc,
        present_rate: sqRate(sqFbc),
        explanation_ko: "Meta 광고 클릭으로 들어온 사용자만 가지는 쿠키. 광고 귀속 핵심.",
      },
      {
        field: "fbclid",
        human_label: "fbclid (Meta 광고 클릭 ID)",
        present_count: sqFbclid,
        present_rate: sqRate(sqFbclid),
        explanation_ko: "URL 쿼리로 전달되는 Meta 광고 클릭 식별자.",
      },
      {
        field: "gclid",
        human_label: "gclid (Google 광고 클릭 ID)",
        present_count: sqGclid,
        present_rate: sqRate(sqGclid),
        explanation_ko: "Google Ads 클릭 식별자. Google 귀속에만 영향.",
      },
      {
        field: "gbraid_wbraid",
        human_label: "gbraid/wbraid (Google iOS 광고 ID)",
        present_count: sqGbraid + sqWbraid,
        present_rate: sqRate(sqGbraid + sqWbraid),
        explanation_ko: "iOS 14+ Google 광고 클릭 식별자. 앱/웹 캠페인 일부에서 사용.",
      },
      {
        field: "utm",
        human_label: "UTM (source/medium/campaign 중 하나)",
        present_count: sqUtm,
        present_rate: sqRate(sqUtm),
        explanation_ko: "광고 링크에 박힌 UTM 파라미터. 채널 분류의 기본 신호.",
      },
      {
        field: "client_id",
        human_label: "GA4 client_id",
        present_count: sqClientId,
        present_rate: sqRate(sqClientId),
        explanation_ko: "GA4 의 사용자 식별 쿠키. 세션 통합/리타게팅 기준.",
      },
      {
        field: "ga_session_id",
        human_label: "GA4 session_id",
        present_count: sqGaSession,
        present_rate: sqRate(sqGaSession),
        explanation_ko: "GA4 세션 단위 식별자. 같은 방문 안에서 행동을 묶을 때 사용.",
      },
    ],
  };

  // === payment_decision_latency (in-memory ring buffer) ===
  const pdRecords = (input.paymentDecisionRecords ?? []).filter(
    (r) => r.receivedAtMs >= windowStartMs && r.receivedAtMs <= windowEndMs,
  );
  const sortedElapsed = pdRecords.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const pickMs = (sorted: number[], p: number): number | null => {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
    return Math.round(sorted[idx]);
  };
  const pdStatusDist = { allow_purchase: 0, virtual_account_issued: 0, canceled: 0, unknown: 0 };
  for (const r of pdRecords) {
    if (r.browserAction === "allow_purchase") pdStatusDist.allow_purchase += 1;
    else if (r.browserAction === "block_purchase_virtual_account") pdStatusDist.virtual_account_issued += 1;
    else if (r.browserAction === "block_purchase" || r.status === "canceled") pdStatusDist.canceled += 1;
    else pdStatusDist.unknown += 1;
  }
  const pdAvailable = pdRecords.length > 0;
  const paymentDecisionLatency: FunnelHealthResult["payment_decision_latency"] = {
    available: pdAvailable,
    explanation_ko:
      "결제완료 판단 응답 지연(payment-decision latency)이란, 사용자가 결제 페이지에서 완료 버튼을 눌렀을 때 서버가 " +
      "'이 주문이 진짜 결제완료인지 / 가상계좌 미입금인지 / 취소인지' 를 판단해 응답을 돌려주는 데 걸린 시간입니다. " +
      "p50 은 보통 응답 시간, p95 는 가장 느린 5% 응답 시간입니다. 이 응답이 늦거나 끊기면 브라우저 Purchase 발화가 막힙니다.",
    not_available_reason: pdAvailable
      ? ""
      : "Backend 가동 후 아직 payment-decision 호출이 없어 in-memory ring buffer 가 비어 있습니다. " +
        "Backend restart 시 reset 됩니다. 결제 시도가 들어오는 대로 자동으로 채워집니다.",
    p50_ms: pickMs(sortedElapsed, 0.5),
    p95_ms: pickMs(sortedElapsed, 0.95),
    sample_size: pdRecords.length,
    status_distribution: pdStatusDist,
  };

  // === browser_funnel_health (ledger metadata.eventName 분포 기반) ===
  // funnel-capi v3 가 browser 발화 행을 server CAPI 로 forward 하면서 metadata.eventName 을 채움.
  // 따라서 이 카운트는 "실제 브라우저에서 발화돼 server 로 들어온 row" 의 근사치.
  const browserStageCounts: Record<string, number> = {
    PageView: 0,
    ViewContent: 0,
    AddToCart: 0,
    InitiateCheckout: 0,
    AddPaymentInfo: 0,
    Purchase: 0,
  };
  let browserStageRowsScanned = 0;
  for (const entry of ledger) {
    const meta = entry.metadata as Record<string, unknown> | undefined;
    const ev = typeof meta?.eventName === "string" ? meta.eventName.trim() : "";
    if (!ev) continue;
    browserStageRowsScanned += 1;
    if (ev in browserStageCounts) {
      browserStageCounts[ev] += 1;
    }
  }
  const browserFunnelStages: FunnelHealthResult["browser_funnel_health"]["stages"] = [
    { stage: "PageView", count: browserStageCounts.PageView, source: "ledger metadata.eventName=PageView" },
    { stage: "ViewContent", count: browserStageCounts.ViewContent, source: "ledger metadata.eventName=ViewContent" },
    { stage: "AddToCart", count: browserStageCounts.AddToCart, source: "ledger metadata.eventName=AddToCart" },
    { stage: "InitiateCheckout", count: browserStageCounts.InitiateCheckout, source: "ledger metadata.eventName=InitiateCheckout" },
    { stage: "AddPaymentInfo", count: browserStageCounts.AddPaymentInfo, source: "ledger metadata.eventName=AddPaymentInfo" },
    { stage: "Purchase", count: browserStageCounts.Purchase, source: "ledger metadata.eventName=Purchase (또는 payment_success row)" },
  ];
  const browserAvailable = browserStageRowsScanned > 0;
  const browserFunnelHealth: FunnelHealthResult["browser_funnel_health"] = {
    available: browserAvailable,
    explanation_ko:
      "브라우저 픽셀 단계별 발화 근사치입니다. funnel-capi v3 가 브라우저에서 픽셀 이벤트를 발화시키면서 server CAPI 로도 " +
      "같이 forward 하기 때문에, 그때 들어온 ledger metadata.eventName 을 단계별로 집계합니다. " +
      "PageView 가 0이면 funnel-capi v3 헤더가 실제 발화 안 되는 의심, AddToCart/InitiateCheckout 가 비정상적으로 작으면 " +
      "block4 fallback 또는 native FBE 어느 한쪽이 깨져 있는 의심입니다.",
    not_available_reason: browserAvailable
      ? ""
      : "이 기간 ledger 에 metadata.eventName 이 채워진 row 가 없습니다. " +
        "funnel-capi v3 헤더가 결제 페이지를 거치는 row 자체가 없거나, eventName 필드 자체가 미정착일 수 있습니다.",
    stages: browserFunnelStages,
  };

  // === Funnel A/B views ===
  // A: 전체 (이미 위에서 계산한 단일 funnel)
  // B: 광고 귀속 (paid click evidence 가 있는 ledger 만)
  const isPaidAttributed = (entry: AttributionLedgerEntry): boolean => {
    if (entry.gclid || entry.fbclid || entry.ttclid) return true;
    const utmSrc = entry.utmSource?.toLowerCase() ?? "";
    if (utmSrc.includes("meta") || utmSrc.includes("facebook") || utmSrc.includes("instagram")) return true;
    if (utmSrc.includes("google")) return true;
    if (utmSrc.includes("naver")) return true;
    if (utmSrc.includes("tiktok")) return true;
    const meta = entry.metadata as Record<string, unknown> | undefined;
    const metaSource = typeof meta?.source === "string" ? meta.source.toLowerCase() : "";
    if (metaSource.includes("meta") || metaSource.includes("google") || metaSource.includes("naver") || metaSource.includes("tiktok")) return true;
    return false;
  };
  let bLanding = 0;
  let bAddToCart = 0;
  let bPaymentStarted = 0;
  let bAddPaymentInfo = 0;
  let bConfirmed = 0;
  const bCapiOrders = new Set<string>();
  for (const entry of ledger) {
    if (!isPaidAttributed(entry)) continue;
    if (isLandingEntry(entry)) bLanding += 1;
    if (isAddToCartEntry(entry)) bAddToCart += 1;
    if (isPaymentStartedEntry(entry)) bPaymentStarted += 1;
    if (isAddPaymentInfoEntry(entry)) bAddPaymentInfo += 1;
    if (isConfirmedPurchaseEntry(entry)) {
      bConfirmed += 1;
      const joinKey = ledgerJoinKey(entry);
      if (joinKey) bCapiOrders.add(joinKey);
    }
  }
  let bCapiSuccess = 0;
  for (const row of capiPurchaseInWindow) {
    if (!classifyCapiSuccess(row)) continue;
    const joinKey = capiJoinKey(row);
    if (joinKey && bCapiOrders.has(joinKey)) bCapiSuccess += 1;
  }
  const paidLandingEvidenceCount = input.siteLandingEvidence
    ? (input.siteLandingEvidence.byFunnelSource.meta ?? 0) +
      (input.siteLandingEvidence.byFunnelSource.google ?? 0) +
      (input.siteLandingEvidence.byFunnelSource.naver ?? 0) +
      (input.siteLandingEvidence.byFunnelSource.utm_present ?? 0)
    : null;
  const paidCartPageViewEvidenceCount = input.siteLandingEvidence?.cartPageViews
    ? (input.siteLandingEvidence.cartPageViews.byFunnelSource.meta ?? 0) +
      (input.siteLandingEvidence.cartPageViews.byFunnelSource.google ?? 0) +
      (input.siteLandingEvidence.cartPageViews.byFunnelSource.naver ?? 0) +
      (input.siteLandingEvidence.cartPageViews.byFunnelSource.utm_present ?? 0)
    : null;
  const buildSteps = (counts: {
    landing: number;
    add_to_cart: number;
    payment_started: number;
    payment_method_selected: number;
    confirmed_purchase: number;
    meta_capi_success: number;
    browser_purchase: number;
  }): FunnelHealthResult["funnel"] => [
    { step: "landing", label: FUNNEL_STEP_LABELS.landing, count: counts.landing, rate_from_previous: null, status: counts.landing === 0 ? "unknown" : "normal" },
    { step: "add_to_cart", label: FUNNEL_STEP_LABELS.add_to_cart, count: counts.add_to_cart, rate_from_previous: safeRate(counts.add_to_cart, counts.landing), status: counts.add_to_cart === 0 ? "unknown" : "normal" },
    { step: "payment_started", label: FUNNEL_STEP_LABELS.payment_started, count: counts.payment_started, rate_from_previous: safeRate(counts.payment_started, Math.max(counts.add_to_cart, counts.landing)), status: counts.payment_started === 0 ? "warning" : "normal" },
    { step: "payment_method_selected", label: FUNNEL_STEP_LABELS.payment_method_selected, count: counts.payment_method_selected, rate_from_previous: safeRate(counts.payment_method_selected, counts.payment_started), status: counts.payment_method_selected === 0 && counts.payment_started > 0 ? "unknown" : "normal" },
    { step: "confirmed_purchase", label: FUNNEL_STEP_LABELS.confirmed_purchase, count: counts.confirmed_purchase, rate_from_previous: safeRate(counts.confirmed_purchase, Math.max(counts.payment_method_selected, counts.payment_started)), status: counts.confirmed_purchase === 0 && counts.payment_started > 0 ? "warning" : "normal" },
    { step: "meta_capi_success", label: FUNNEL_STEP_LABELS.meta_capi_success, count: counts.meta_capi_success, rate_from_previous: safeRate(counts.meta_capi_success, counts.confirmed_purchase), status: counts.confirmed_purchase > 0 && counts.meta_capi_success === 0 ? "alert" : "normal" },
    { step: "browser_purchase", label: FUNNEL_STEP_LABELS.browser_purchase, count: counts.browser_purchase, rate_from_previous: safeRate(counts.browser_purchase, counts.meta_capi_success), status: counts.confirmed_purchase > 0 && counts.browser_purchase === 0 ? "warning" : "normal" },
  ];
  const paidAttributedSteps = buildSteps({
    landing: paidLandingEvidenceCount ?? bLanding,
    add_to_cart: paidCartPageViewEvidenceCount ?? bAddToCart,
    payment_started: bPaymentStarted,
    payment_method_selected: bAddPaymentInfo,
    confirmed_purchase: bConfirmed,
    meta_capi_success: bCapiSuccess,
    browser_purchase: browserStageCounts.Purchase,
  });
  const funnelViews: FunnelHealthResult["funnel_views"] = {
    all_traffic: {
      label: "전체 주문 퍼널",
      explanation_ko:
        "광고/오가닉/직접 유입을 가리지 않고 ledger 의 모든 신호를 합산한 퍼널입니다. " +
        "전체 결제 흐름의 단계별 누락 위치를 보는 용도입니다.",
      steps: funnel,
    },
    paid_attributed: {
      label: "광고 귀속 퍼널",
      explanation_ko:
        "fbclid/gclid/ttclid 또는 광고 source utm 이 잡힌 ledger row 만으로 재계산한 퍼널입니다. " +
        "광고 클릭 evidence 가 결제완료까지 얼마나 따라오는지 봅니다. 전체 퍼널보다 작아야 정상이며, " +
        "광고 비용을 쓴 채널의 실제 ROAS denominator 와 정합성을 갖춥니다.",
      steps: paidAttributedSteps,
    },
  };

  return {
    ok: true,
    site: input.site,
    window: input.window,
    granularity: input.granularity,
    payment_method: input.paymentMethod,
    source_filter: input.source,
    checked_at_kst: toKst(asOf),
    source_summary: {
      primary: input.siteLandingEvidence
        ? "VM Cloud site_landing_ledger + attribution_ledger"
        : "VM Cloud attribution_ledger",
      cross_check: ["Meta CAPI send log", "운영DB PAYMENT_COMPLETE (cross-check only)"],
      freshness,
      confidence: confirmedCount > 0 ? "medium_high" : "medium",
      latest_logged_at_kst: latestLoggedAtKst,
      latest_logged_age_hours: latestLoggedAgeHours,
    },
    site_landing_evidence: {
      applied_to_funnel_landing: Boolean(input.siteLandingEvidence),
      source: input.siteLandingEvidence?.source ?? "VM Cloud attribution_ledger",
      unit: input.siteLandingEvidence?.unit ?? "marketing_intent_row",
      total: input.siteLandingEvidence?.total ?? attributionLedgerLandingCount,
      selected_count: landingCount,
      attribution_ledger_marketing_intent_count: attributionLedgerLandingCount,
      by_funnel_source: input.siteLandingEvidence?.byFunnelSource ?? {},
      cart_page_views: input.siteLandingEvidence?.cartPageViews
        ? {
            source: input.siteLandingEvidence.cartPageViews.source,
            unit: input.siteLandingEvidence.cartPageViews.unit,
            path_pattern: input.siteLandingEvidence.cartPageViews.pathPattern,
            total: input.siteLandingEvidence.cartPageViews.total,
            selected_count: addToCartCount,
            attribution_ledger_add_to_cart_count: attributionLedgerAddToCartCount,
            by_funnel_source: input.siteLandingEvidence.cartPageViews.byFunnelSource,
            caveat: input.siteLandingEvidence.cartPageViews.caveat,
          }
        : undefined,
      caveat:
        input.siteLandingEvidence?.caveat ??
        "site_landing_ledger evidence가 주입되지 않아 legacy marketing_intent row만 landing으로 사용했습니다.",
    },
    metric_contract: {
      site: input.site,
      pixel_ids: sitePixelIds,
      all_sites_mode: input.site === "all_sites",
      window: input.window,
      last_updated_at: toKst(asOf),
      metrics: {
        landing: {
          source: input.siteLandingEvidence
            ? "VM Cloud site_landing_ledger"
            : "VM Cloud attribution_ledger marketing_intent fallback",
          unit: input.siteLandingEvidence ? "first-party landing row" : "marketing_intent event row",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: null,
          caveat: input.siteLandingEvidence
            ? "Meta/Google/Naver가 세는 클릭수가 아니라, VM Cloud가 첫 방문/랜딩 단계에서 받은 자체 landing row입니다."
            : "site_landing_ledger 주입이 없어 landing이 과소 집계될 수 있습니다.",
        },
        cart_page_view: {
          source: input.siteLandingEvidence?.cartPageViews
            ? "VM Cloud site_landing_ledger landing_path=/shop_cart"
            : "VM Cloud attribution_ledger browser event fallback",
          unit: input.siteLandingEvidence?.cartPageViews
            ? "first-party cart page landing row"
            : "AddToCart/ViewContent event row",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: null,
          caveat: input.siteLandingEvidence?.cartPageViews
            ? "장바구니 담기 클릭이 아니라 /shop_cart 페이지 진입입니다. 아임웹/GTM 수정 없이 VM Cloud가 이미 받은 landing row를 사용합니다."
            : "site_landing_ledger /shop_cart 증거가 없으면 legacy event row만 fallback으로 씁니다.",
        },
        vm_order_signals: {
          source: "VM Cloud attribution_ledger",
          unit: "event row",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: null,
          caveat: "사이트 분리는 ledger site/url/source evidence 기준입니다. site evidence 없는 row는 보수적으로 포함됩니다.",
        },
        confirmed_purchases: {
          source: "VM Cloud attribution_ledger confirmed payment_success",
          unit: "unique order에 가까운 ledger row",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: null,
          caveat: "매출 정본 자체가 아니라 VM Cloud confirmed bridge 결과입니다. 운영DB/Toss/Imweb 확인은 cross-check입니다.",
        },
        meta_capi_success: {
          source: "Meta CAPI send log",
          unit: "send attempt / event_id",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: sitePixelIds.length === 1 ? sitePixelIds[0] : null,
          caveat:
            input.site === "all_sites"
              ? "all_sites 모드에서만 모든 Pixel을 합산합니다."
              : "사이트별 Pixel ID로 먼저 필터합니다. ledger join 실패는 no_ledger_match로 분리합니다.",
        },
        browser_purchase: {
          source: "Browser pixel observation",
          unit: "pixel event",
          window: WINDOW_LABEL[input.window],
          site: input.site,
          pixel_id: sitePixelIds.length === 1 ? sitePixelIds[0] : null,
          caveat: "현재 /total에서는 Browser Purchase 직접 관측원이 제한적입니다. Server CAPI와 분리해서 표시해야 합니다.",
        },
        ads_manager_roas: {
          source: "Meta Ads Insights API",
          unit: "ad-attributed purchase/value/spend",
          window: "today / yesterday / last_7d",
          site: input.site,
          pixel_id: sitePixelIds.length === 1 ? sitePixelIds[0] : null,
          caveat: "광고 플랫폼이 주장하는 귀속값입니다. 내부 confirmed 매출과 합산하지 말고 비교 지표로만 표시합니다.",
        },
      },
    },
    empty_state_diagnostic: {
      is_empty: isEmpty,
      reason: emptyReason,
      human_label: emptyHuman,
      next_action: emptyNext,
      detail: {
        total_rows_all_time: totalRowsAllTime,
        rows_in_window_before_filters: rowsInWindowBeforeFilters,
        rows_after_filters: rowsAfterFilters,
        latest_logged_at_kst: latestLoggedAtKst,
        window_start_kst: windowStartKst,
      },
    },
    status: statusInfo,
    period_label: WINDOW_LABEL[input.window],
    kpis: {
      vm_order_signals: {
        count: vmOrderSignalsCount,
        amount_krw: Math.round(confirmedRevenue),
        source: "VM Cloud attribution_ledger",
        unit: "event row",
        basis: "ledger row 전체 (touchpoint 무관)",
      },
      payment_started: {
        count: paymentStartedCount,
        source: "ledger touchpoint = checkout_started + payment_page_seen",
        unit: "event row",
        basis: "InitiateCheckout 후보 + payment_page_seen 합산 (중복 가능)",
      },
      confirmed_purchases: {
        count: confirmedCount,
        amount_krw: Math.round(confirmedRevenue),
        source: "ledger payment_success + paymentStatus=confirmed",
        unit: "ledger row (≈ order 단위)",
        basis: "payment_success + confirmed (취소/대기 제외)",
      },
      meta_capi_success: {
        count: capiSuccessCount,
        events_received: capiEventsReceivedTotal,
        source: "Meta CAPI send log (event_name=Purchase)",
        unit: "send attempt (events_received=1)",
        basis: "send 1회 = 1건. unique order 는 meta_capi_breakdown.unique_orders 참고",
      },
      browser_purchase: {
        count: browserPurchaseCount,
        source: "browser pixel observation (현재 미수집)",
        unit: "pixel event",
        basis: "facebook.com/tr ev=Purchase 관측 — 현재 수집원 미연결",
      },
      unmatched: {
        count: unmatchedCount,
        amount_krw: Math.round(unmatchedRevenue),
        source: "VM Cloud unmatched classifier",
        unit: "confirmed order",
        basis: "confirmed 인데 utm/referrer/click id/source 모두 없음 (drilldown 의 utm_referrer_missing 와 동일)",
      },
    },
    meta_capi_breakdown: {
      window_label: WINDOW_LABEL[input.window],
      capi_site_filter: {
        site: input.site,
        pixel_ids: sitePixelIds,
        all_sites_mode: input.site === "all_sites",
        caveat:
          input.site === "all_sites"
            ? "all_sites 모드라 모든 Pixel의 CAPI send log를 합산합니다."
            : "site별 Pixel ID로 CAPI send log를 필터합니다. 바이오컴과 더클린커피 CAPI success가 섞이지 않습니다.",
      },
      send_attempts: capiSendAttempts,
      events_received_count: capiSuccessCount,
      unique_orders: capiUniqueOrders,
      unique_event_ids: capiUniqueEventIds,
      duplicate_estimate: capiDuplicateEstimate,
      failed: capiFailedCount,
      latency_minutes: {
        p50: latencyP50,
        p95: latencyP95,
        sample_size: latencyMinutes.length,
      },
      no_send_reasons: no_send_reasons,
    },
    funnel,
    funnel_views: funnelViews,
    series,
    utm_breakdown,
    unmatched_reasons,
    risk_combo: {
      state: riskState,
      server_capi_active: serverCapiActive,
      browser_purchase_active: browserPurchaseActive,
      human_label: riskHuman,
      explanation_ko: riskExplain,
    },
    unresolved_leaks: {
      total_count: unresolvedTotalCount,
      total_amount_krw: Math.round(unresolvedTotalAmount),
      items: unresolvedItems,
    },
    action_queue: actionQueue,
    capi_attribution_join: capiAttributionJoin,
    purchase_eligibility_queue: {
      confirmed_eligible_unsent_count: eligibleCount,
      confirmed_eligible_unsent_amount_krw: Math.round(eligibleAmount),
      oldest_age_minutes: oldestAgeMinutes,
      sample_label_safe: null,
      explanation_ko:
        "결제완료(confirmed)는 끝났는데 Meta CAPI 로 아직 안 간 주문 큐입니다. " +
        "oldest age 가 클수록 Meta 학습에 그만큼 늦게 도달한다는 뜻입니다.",
    },
    signal_quality: signalQuality,
    payment_decision_latency: paymentDecisionLatency,
    browser_funnel_health: browserFunnelHealth,
    capi_health: {
      last_success_at_kst: lastSuccessAtKst,
      last_1h: bucketCapi(oneHourAgoMs),
      today: bucketCapi(todayKstStartMs),
      last_7d: bucketCapi(sevenDaysAgoMs),
      no_send_reasons,
    },
    guardrails: {
      raw_identifier_output: 0,
      platform_send_from_this_endpoint: 0,
      operational_db_write: 0,
    },
  };
};

export const parseFunnelHealthQuery = (params: {
  site?: unknown;
  window?: unknown;
  granularity?: unknown;
  paymentMethod?: unknown;
  source?: unknown;
}): {
  site: FunnelHealthSite;
  window: FunnelHealthWindow;
  granularity: FunnelHealthGranularity;
  paymentMethod: FunnelHealthPaymentMethod;
  source: FunnelHealthSource;
} => {
  const siteRaw = typeof params.site === "string" ? params.site.toLowerCase() : "";
  const site: FunnelHealthSite =
    siteRaw === "thecleancoffee" ? "thecleancoffee" : siteRaw === "all_sites" ? "all_sites" : "biocom";

  const windowRaw = typeof params.window === "string" ? params.window : "";
  const window: FunnelHealthWindow =
    windowRaw === "7d" || windowRaw === "14d" || windowRaw === "30d" ? (windowRaw as FunnelHealthWindow) : "1d";

  const granularityRaw = typeof params.granularity === "string" ? params.granularity : "";
  const granularity: FunnelHealthGranularity = granularityRaw === "week" ? "week" : "day";

  const pmRaw = typeof params.paymentMethod === "string" ? params.paymentMethod : "all";
  const pmAllowed: Set<FunnelHealthPaymentMethod> = new Set([
    "all",
    "card",
    "npay",
    "virtual_account",
    "bank_transfer",
    "other",
  ]);
  const paymentMethod: FunnelHealthPaymentMethod = pmAllowed.has(pmRaw as FunnelHealthPaymentMethod)
    ? (pmRaw as FunnelHealthPaymentMethod)
    : "all";

  const srcRaw = typeof params.source === "string" ? params.source : "all";
  const srcAllowed: Set<FunnelHealthSource> = new Set([
    "all",
    "meta",
    "google",
    "naver",
    "organic",
    "direct",
    "utm_present",
    "utm_missing",
    "no_ledger_match",
  ]);
  const source: FunnelHealthSource = srcAllowed.has(srcRaw as FunnelHealthSource)
    ? (srcRaw as FunnelHealthSource)
    : "all";

  return { site, window, granularity, paymentMethod, source };
};
