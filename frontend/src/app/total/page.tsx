"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type FreshnessKey =
  | "fresh"
  | "local_cache"
  | "warn"
  | "stale"
  | "empty"
  | "missing"
  | "data_sparse"
  | "blocked"
  | "blocked_or_empty"
  | "fallback"
  | "error"
  | "not_queried"
  | "unavailable";

type ChannelRow = {
  primary_channel: string;
  orders: number;
  revenue: number;
  confidence: Record<string, number>;
  share_of_confirmed_revenue: number | null;
  display_label: string;
};

type PlatformRow = {
  platform?: "meta" | "tiktok" | "google" | "naver" | string;
  internalChannel?: string;
  internalConfirmed?: {
    orders: number;
    revenue: number;
    confidenceRevenue?: Record<string, number>;
  };
  platformReference?: {
    status?: string;
    source?: string;
    spendKrw?: number | null;
    conversionValueKrw?: number | null;
    roas?: number | null;
    attributionWindow?: string | null;
    actionReportTime?: string | null;
    queriedAt?: string | null;
    freshness?: FreshnessKey | string;
    sourceWindow?: { startDate?: string | null; endDate?: string | null; latestDate?: string | null };
    sourceDiagnostics?: Record<string, unknown> | null;
    error?: string | null;
  };
  gap?: {
    conversionValueMinusInternalRevenue: number | null;
    roasDelta?: number | null;
    reason?: string | null;
  };
  allowedUse?: string;
  forbiddenUse?: string;
};

type SourceFreshnessRow = {
  source: string;
  role: string;
  status: string;
  queried_at?: string | null;
  latest_observed_at?: string | null;
  row_count?: number | null;
  confidence?: string;
  fallback?: boolean;
  fallback_reason?: string | null;
  summary?: unknown;
};

type CorrectionLineItem = {
  id: string;
  label: string;
  site: string;
  source: string;
  db_location: string;
  table: string;
  source_role: string;
  status: string;
  count: number | null;
  amount_krw: number | null;
  status_blank_count?: number | null;
  status_blank_amount_krw?: number | null;
  warnings: string[];
  use_for_budget_roas: string;
  included_in_budget_roas: boolean;
  freshness: string;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

type ApiResponse = {
  ok: true;
  metadata: {
    contract_version: string;
    site: string;
    month: string;
    timezone: string;
    date_start: string;
    date_end_exclusive: string;
    queried_at: string;
    mode: string;
    write: boolean;
    send: boolean;
    deploy: boolean;
    source_contracts: { spine: string; evidence: string; correction_lines?: string };
  };
  monthly_spine: {
    confirmed_net_revenue_ab: number;
    review_revenue_c: number;
    quarantine_revenue_d: number;
    toss_only_month_boundary_revenue: number;
    net_revenue_candidate_including_c: number;
    primary_sum_matches_revenue: boolean;
    join_methods: unknown[];
  };
  evidence: {
    assignment_version: string;
    totals: {
      orders_total_ab: number;
      revenue_total_ab: number;
      assigned_orders: number;
      assigned_revenue: number;
      unknown_orders: number;
      unknown_revenue: number;
      primary_sum_matches_revenue: boolean;
    };
    channel_summary: ChannelRow[];
    unknown_reasons: Array<{
      reason?: string;
      unknownReason?: string;
      orders: number;
      revenue: number;
    }>;
    unknown_reason_details?: Array<{
      rootReason: string;
      detail: string;
      orders: number;
      revenue: number;
      nextEvidenceNeeded: string;
      recommendedFix: string;
      confidence?: string;
    }>;
    naver_organic_evidence?: Array<{
      label: string;
      orders: number;
      revenue: number | null;
      confidence: string;
      source: string;
      useForBudgetRoas: string;
      note: string;
    }>;
    naver_evidence_aggregate?: {
      contractVersion: string;
      aggregateOnly: boolean;
      rawIdentifierOutput: boolean;
      budgetRoasIncluded: boolean;
      source: string;
      coverageStatus?: string;
      endpointStatus?: string;
      summary?: {
        rowsTotal: number;
        naverAny: number;
        byClass: Record<string, number>;
      };
      rows: Array<{
        class: string;
        touchpoint: string;
        rows: number;
        bridgeKeyPresent: number;
        confidence: string;
        budgetRoasIncluded: boolean;
        useForBudgetRoas: string;
        note: string;
      }>;
      warnings?: string[];
    } | null;
    utm_invalid_audit?: Array<{
      source: string;
      medium: string;
      campaign: string;
      family: string;
      candidateRule: string;
      orders: number;
      revenue: number;
      useForBudgetRoas: string;
      note: string;
    }>;
    subscription_acquisition_summary?: {
      renewable_order_count: number;
      renewable_revenue: number;
      first_subscription_order_count: number;
      first_subscription_revenue: number;
      first_acquisition_channel_found: number;
      first_acquisition_revenue_found: number;
      archive_lookup_needed: number;
      archive_lookup_needed_revenue: number;
      member_key_missing: number;
      member_key_missing_revenue: number;
    } | null;
    evidence_tier_summary: unknown[];
    npay_intent_status_summary: unknown[];
  };
  platform_reference: {
    rows?: PlatformRow[];
    joinStatus?: string;
    [k: string]: unknown;
  };
  correction_lines?: {
    contract_version: string;
    generated_at: string;
    source_status: "loaded" | "missing";
    purpose: string;
    budget_roas_policy: {
      budget_roas_site: string;
      budget_roas_numerator: string;
      cross_site_lines_auto_added: false;
      coffee_line_policy: string;
    };
    items: CorrectionLineItem[];
  };
  source_freshness: SourceFreshnessRow[];
  frontend_copy: {
    headline: string;
    subtext: string;
    warnings: string[];
  };
};

type ApiError = { ok: false; error: string };
type SelectedSite = "biocom" | "thecleancoffee";

const defaultReportMonth = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : "2026-05";
};

const SITE_OPTIONS: Array<{ id: SelectedSite; label: string; helper: string }> = [
  { id: "biocom", label: "바이오컴", helper: "월별 채널 분석" },
  { id: "thecleancoffee", label: "더클린커피", helper: "최근 30일 actual line" },
];

const SITE_LABEL: Record<SelectedSite | string, string> = {
  biocom: "바이오컴",
  thecleancoffee: "더클린커피",
};

const fmtKRW = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "-";
  if (v === 0) return "₩0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const rest = abs % 100_000_000;
    const man = Math.round(rest / 10_000);
    return `${sign}₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};
const fmtNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : v.toLocaleString("ko-KR");
const fmtRoas = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : v.toFixed(2);
const fmtPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : `${(v * 100).toFixed(1)}%`;
const fmtTs = (v: string | null | undefined) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return v;
  }
};

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta 광고",
  tiktok: "TikTok 광고",
  google: "Google 광고",
  naver: "Naver 광고 (참고)",
};

const FRESHNESS_LABEL: Record<string, { text: string; tone: "green" | "yellow" | "red" | "neutral" }> = {
  fresh: { text: "최신 데이터", tone: "green" },
  local_cache: { text: "참고용 캐시", tone: "yellow" },
  warn: { text: "주의 필요", tone: "yellow" },
  empty: { text: "데이터 비어있음", tone: "yellow" },
  missing: { text: "연결 없음", tone: "red" },
  data_sparse: { text: "최근 데이터 적음", tone: "yellow" },
  blocked: { text: "연결 필요", tone: "red" },
  blocked_or_empty: { text: "연결 필요", tone: "red" },
  fallback: { text: "판단 보류", tone: "red" },
  stale: { text: "오래된 데이터", tone: "yellow" },
  error: { text: "조회 실패", tone: "red" },
  not_queried: { text: "미조회", tone: "neutral" },
  unavailable: { text: "사용 불가", tone: "red" },
};

const STATUS_BADGE: Record<string, { text: string; tone: "green" | "yellow" | "red" | "neutral" }> = {
  joined: { text: "연결됨", tone: "green" },
  partial_join: { text: "일부 연결", tone: "yellow" },
  skeleton_only: { text: "뼈대만 있음", tone: "neutral" },
  unavailable: { text: "사용 불가", tone: "red" },
  not_joined: { text: "미연결", tone: "red" },
  included: { text: "포함", tone: "green" },
  included_with_warning: { text: "포함, 주의 필요", tone: "yellow" },
  bridge_pending: { text: "주문 연결 대기", tone: "yellow" },
};

function FreshBadge({ freshness }: { freshness?: string }) {
  const meta = FRESHNESS_LABEL[freshness || "not_queried"] || FRESHNESS_LABEL.not_queried;
  const cls =
    meta.tone === "green"
      ? styles.badgeFresh
      : meta.tone === "yellow"
      ? styles.badgeLocal
      : meta.tone === "red"
      ? styles.badgeBlocked
      : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{meta.text}</span>;
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_BADGE[status || ""] || { text: status || "-", tone: "neutral" as const };
  const cls =
    meta.tone === "green"
      ? styles.badgeFresh
      : meta.tone === "yellow"
      ? styles.badgeLocal
      : meta.tone === "red"
      ? styles.badgeBlocked
      : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{meta.text}</span>;
}

const correctionAmount = (lines: CorrectionLineItem[], included: boolean) =>
  lines
    .filter((line) => line.included_in_budget_roas === included)
    .reduce((sum, line) => sum + (line.amount_krw || 0), 0);

// 비개발자 친화 라벨 변환 (gpt0508-49 UX 개선)
function translateUnknownReason(reason: string): string {
  const map: Record<string, string> = {
    unknown: "유입 흔적 부족 (전체)",
    no_click_id: "광고 클릭 ID 없음",
    no_utm: "UTM 태그 없음",
    no_referrer: "referrer 없음 (직접 입력 / 북마크 추정)",
    session_lost: "세션 키 손실 (쿠키 비허용 / 다른 origin redirect)",
    no_evidence: "유입 증거 전혀 없음",
    expired_evidence: "유입 증거 만료 (TTL 초과)",
    vm_payment_success_missing: "결제완료 이벤트 연결 누락",
    missing_channel_evidence: "채널 증거 부족",
    subscription_without_acquisition_evidence: "구독 최초 유입 확인 필요",
    subscription_first_without_acquisition_evidence: "첫 구독 시작 유입 근거 부족",
    npay_intent_ambiguous: "NPay 의도 매칭 후보 여러 개",
  };
  return map[reason] || `기타: ${reason}`;
}

function translateUnknownDetail(detail: string): string {
  const map: Record<string, string> = {
    payment_success_missing_in_vm_cloud: "VM Cloud 유입 장부에 결제완료 이벤트가 없음",
    checkout_started_but_payment_success_missing: "결제 시작은 보이나 결제완료 연결이 없음",
    payment_success_order_key_normalize_failed: "결제완료 주문번호 연결 규칙 확인 필요",
    npay_return_missing: "NPay 완료 후 사이트 복귀/주문 연결 부족",
    naver_referrer_present_but_order_bridge_missing: "네이버 검색 유입은 보이나 주문 연결 부족",
    no_click_id_utm_referrer_or_first_touch: "광고 클릭 ID, UTM, referrer, 첫 방문 정보가 모두 부족",
    utm_present_but_not_classifiable: "UTM은 있으나 광고/자연/추천 규칙으로 분류 불가",
    utm_present_but_invalid_rule: "UTM은 있으나 규칙이 맞지 않음",
    self_or_internal_referrer_only: "외부 유입 없이 내부 도메인 이동 흔적만 있음",
    no_click_id_or_referrer: "광고 클릭 ID와 referrer가 없음",
    no_referrer: "referrer와 첫 유입 정보가 부족",
    no_paid_or_referrer_evidence: "광고 클릭 또는 자연/추천 referrer 근거 부족",
    click_id_missing: "광고 클릭 ID가 부족",
    first_touch_expired: "첫 유입 정보 보존 기간 확인 필요",
    first_subscription_missing_acquisition_evidence: "첫 구독 시작 시점의 유입 근거 부족",
    first_order_outside_window: "첫 주문이 현재 조회 기간 밖에 있음",
    member_hash_missing: "회원 연결 key가 부족",
    acquisition_archive_lookup_needed: "과거 유입 장부 조회 필요",
    npay_intent_multiple_candidates: "NPay 클릭 의도 후보가 여러 개라 한 주문으로 확정 불가",
  };
  return map[detail] || detail;
}

function translateEvidenceNeed(value: string): string {
  const map: Record<string, string> = {
    "VM Cloud attribution_ledger payment_success coverage": "VM Cloud 결제완료 이벤트가 충분히 남았는지",
    "original external referrer before internal redirect": "내부 이동 전 최초 외부 유입 주소",
    "utm_source/utm_medium naming rule": "광고/자연검색을 구분할 수 있는 UTM 규칙",
    "subscription first-order acquisition archive": "첫 구독 시작 당시의 과거 유입 장부",
    "first order outside current report window": "현재 월 밖에 있는 최초 주문 유입",
    "VM Cloud checkout event to payment_success continuity": "결제 시작에서 결제완료까지 이어지는 서버 신호",
    "NPay intent disambiguation key": "NPay 클릭 후보를 한 주문으로 좁히는 key",
  };
  return map[value] || value;
}

function translateRecommendedFix(value: string): string {
  const map: Record<string, string> = {
    "server-side payment_success capture 또는 order id normalize rule 점검": "서버 결제완료 수집과 주문 연결 규칙을 점검",
    "내부 도메인 이동 전 최초 referrer/landing 보존": "내부 이동 전에 최초 유입 주소와 landing을 보존",
    "paid/organic 판정 가능한 UTM source/medium 표준으로 정리": "광고와 자연검색이 구분되도록 UTM 이름을 표준화",
    "첫 구독 시작 주문의 과거 유입 장부 archive lookup 설계": "첫 구독 시작 시점의 과거 유입 장부 조회 설계",
    "월별 화면 밖 최초 주문 acquisition을 archive에서 조회": "현재 월 밖 최초 주문의 획득 채널을 archive에서 조회",
    "checkout 진입 후 결제완료 신호가 끊기는 구간의 server-side success capture 점검": "결제 시작 뒤 결제완료 서버 신호가 끊기는 구간을 점검",
    "NPay intent ledger의 order/session key 정밀도 개선": "NPay 클릭 장부의 주문/세션 key 정밀도 개선",
  };
  return map[value] || value;
}

function translateNaverEvidenceLabel(label: string): string {
  const map: Record<string, string> = {
    organic_naver_order_level_strong: "주문 단위 네이버 자연검색",
    organic_naver_session_level_medium: "세션 단위 네이버 자연검색 후보",
    naver_referrer_but_order_bridge_missing: "네이버 유입 보임, 주문 연결 부족",
    naver_searchadvisor_aggregate_only: "Search Advisor 참고 지표",
    naver_search_referrer_paid_marker_excluded: "네이버 검색 유입 중 유료 표식 제외",
    naver_non_search_referrer_reference_only: "네이버 비검색 referrer 참고",
  };
  return map[label] || label;
}

function translateNaverAggregateClass(value: string): string {
  const map: Record<string, string> = {
    paid_naver: "네이버 광고 후보",
    naver_brandsearch: "네이버 브랜드검색 후보",
    organic_naver_candidate: "네이버 자연검색 후보",
    naver_referrer_or_utm_only: "네이버 흔적 있음, 분류 보류",
  };
  return map[value] || value;
}

function translateTouchpoint(value: string): string {
  const map: Record<string, string> = {
    marketing_intent: "광고 클릭/의도",
    checkout_started: "결제 시작",
    checkout_context: "결제 시작",
    payment_success: "결제 완료",
    form_submit: "폼 제출",
  };
  return map[value] || value;
}

function translateUtmFamily(family: string): string {
  const map: Record<string, string> = {
    naver_brandsearch: "네이버 브랜드검색 후보",
    paid_naver_candidate: "네이버 유료검색 후보",
    naver_utm_needs_rule: "네이버 UTM 규칙 확인",
    kakao_candidate: "카카오 후보",
    meta_candidate: "Meta 후보",
    google_candidate: "Google 후보",
    unknown_utm_invalid: "규칙 없는 UTM",
  };
  return map[family] || family;
}

function translateUtmCandidateRule(rule: string): string {
  const map: Record<string, string> = {
    naver_brandsearch_reference: "브랜드검색 참고 evidence",
    paid_naver_reference: "네이버 광고 참고 evidence",
    naver_rule_review: "네이버 규칙 추가 검토",
    kakao_reference: "카카오 참고 evidence",
    paid_meta_reference: "Meta 참고 evidence",
    paid_google_reference: "Google 참고 evidence",
    unknown_utm_invalid: "자동 분류 보류",
  };
  return map[rule] || rule;
}

function translateSource(source: string): string {
  const map: Record<string, string> = {
    ga4_bigquery_raw: "GA4 BigQuery 원본",
    ga4_bigquery_biocom: "GA4 BigQuery 원본",
    ga4_bigquery_thecleancoffee: "더클린커피 GA4 BigQuery",
    npay_intent: "NPay 클릭 의도",
    platform_meta: "Meta 광고",
    platform_tiktok: "TikTok 광고",
    platform_google: "Google 광고",
    platform_naver: "네이버 광고",
    naver: "네이버 광고",
    imweb_operational: "아임웹 운영 주문",
    toss_operational: "토스 결제",
    attribution_vm: "VM Cloud 유입 장부",
  };
  return map[source] || source;
}

function translateFreshness(f: string | undefined): string {
  const map: Record<string, string> = {
    fresh: "최신",
    local_cache: "캐시 (원본 대조 전 참고)",
    warn: "주의 필요",
    empty: "데이터 비어있음",
    missing: "연결 없음",
    data_sparse: "최근 데이터 적음",
    blocked: "연결 끊김",
    blocked_or_empty: "연결 안 됨 또는 비어있음",
    fallback: "대체 데이터 사용 중",
    stale: "오래된 데이터",
    error: "조회 실패",
    not_queried: "미조회",
    unavailable: "사용 불가",
  };
  return map[f || "not_queried"] || f || "-";
}

function translateChannelCode(primary: string): string {
  const map: Record<string, string> = {
    paid_meta: "Meta 광고",
    paid_tiktok: "TikTok 광고",
    paid_google: "Google 광고",
    paid_naver: "네이버 광고",
    paid_search: "유료 검색",
    paid_social: "유료 소셜",
    organic_search: "자연 검색",
    organic_naver: "네이버 자연검색",
    organic_social: "자연 소셜",
    direct: "직접 방문",
    referral: "추천 링크",
    self_internal: "자기 도메인 이동",
    npay: "NPay 결제",
    subscription_recurring: "구독/정기결제",
    unknown: "어디서 왔는지 모름",
  };
  return map[primary] || primary;
}

function channelAction(row: ChannelRow): { text: string; tone: "green" | "yellow" | "red" | "neutral" } {
  if (row.primary_channel === "unknown") return { text: "데이터 연결 필요", tone: "red" };
  if (row.primary_channel === "npay") return { text: "판단 보류", tone: "yellow" };
  if (row.primary_channel === "subscription_recurring") return { text: "유지 매출", tone: "neutral" };
  if (row.primary_channel === "paid_naver") return { text: "데이터 연결 필요", tone: "red" };
  if (row.primary_channel.startsWith("paid_") && row.revenue > 0) {
    return { text: "예산 유지", tone: "green" };
  }
  if (row.primary_channel.startsWith("paid_")) return { text: "예산 축소 후보", tone: "yellow" };
  return { text: "관찰 유지", tone: "neutral" };
}

type DiagnosticEntry = {
  scope: string;
  source?: string;
  platform?: string;
  freshness?: string;
  latestDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  importedRows?: number | null;
  usableRows?: number | null;
  rowCount?: number | null;
  warning?: string | null;
  budgetDecisionImpact: "usable" | "reference_only" | "blocked";
  error?: string | null;
  fallbackReason?: string | null;
};

const LOADING_STAGES = [
  "요청 준비",
  "운영DB 월 매출 원장 확인",
  "VM Cloud 유입 증거 대조",
  "광고 플랫폼 참고값 점검",
  "화면용 숫자 정리",
] as const;

const loadingStageForProgress = (progress: number) => {
  if (progress < 22) return 0;
  if (progress < 48) return 1;
  if (progress < 68) return 2;
  if (progress < 86) return 3;
  return 4;
};

function normalizeDiagnostics(data: ApiResponse): DiagnosticEntry[] {
  const out: DiagnosticEntry[] = [];

  for (const platform of data.platform_reference.rows || []) {
    const ref = platform.platformReference || {};
    const diag = (ref.sourceDiagnostics || {}) as Record<string, unknown>;
    const dailyTable = (diag.dailyTable || null) as Record<string, unknown> | null;
    const warnings = (diag.warnings || null) as unknown[] | null;
    const freshness = ref.freshness || "not_queried";
    const impact: DiagnosticEntry["budgetDecisionImpact"] =
      freshness === "fresh"
        ? "usable"
        : freshness === "local_cache"
        ? "reference_only"
        : "blocked";

    const numOr = (v: unknown): number | null => (typeof v === "number" ? v : null);
    const importedRows =
      numOr(dailyTable?.importedRows) ??
      numOr(diag.importedRowCount) ??
      numOr(diag.importedRows) ??
      null;
    const usableRows =
      numOr(dailyTable?.rows) ??
      numOr(diag.usableRowCount) ??
      numOr(diag.usableRows) ??
      null;
    const rowCount = numOr(diag.rows) ?? numOr(diag.rowCount) ?? null;
    const warning =
      Array.isArray(warnings) && warnings.length
        ? warnings.filter((w) => typeof w === "string").join(" / ")
        : typeof diag.warning === "string"
        ? (diag.warning as string)
        : null;

    out.push({
      scope: "platform_reference",
      platform: platform.platform,
      source: ref.source ?? undefined,
      freshness,
      latestDate: ref.sourceWindow?.latestDate ?? (dailyTable?.maxDate as string | undefined) ?? null,
      startDate: ref.sourceWindow?.startDate ?? (dailyTable?.minDate as string | undefined) ?? null,
      endDate: ref.sourceWindow?.endDate ?? (dailyTable?.maxDate as string | undefined) ?? null,
      importedRows,
      usableRows,
      rowCount,
      warning,
      budgetDecisionImpact: impact,
      error: ref.error ?? null,
    });
  }

  for (const src of data.source_freshness) {
    if (src.role === "platform_reference") continue;
    const isFresh = src.status === "fresh";
    const isStale = ["blocked", "blocked_or_empty", "fallback", "stale", "error", "unavailable", "missing", "empty"].includes(src.status);
    out.push({
      scope: src.role,
      source: src.source,
      freshness: src.status,
      latestDate: src.latest_observed_at ?? null,
      rowCount: src.row_count ?? null,
      budgetDecisionImpact: isFresh ? "usable" : isStale ? "blocked" : "reference_only",
      warning: null,
      fallbackReason: src.fallback_reason ?? null,
    });
  }

  return out;
}

function PlatformCard({ row }: { row: PlatformRow }) {
  const ref = row.platformReference || {};
  const internal = row.internalConfirmed || { orders: 0, revenue: 0 };
  const gap = row.gap?.conversionValueMinusInternalRevenue ?? null;
  const fresh = ref.freshness || "not_queried";
  const isTikTokWarn = row.platform === "tiktok" && fresh === "local_cache";
  const isBlocked = ["blocked", "blocked_or_empty", "fallback", "error", "unavailable"].includes(fresh);
  const cardCls = `${styles.pCard} ${
    isTikTokWarn ? styles.warn : isBlocked ? styles.blocked : ""
  }`.trim();

  const naverCandidateNote =
    row.platform === "naver" && (internal.revenue || 0) > 0
      ? "내부 후보 매출은 NaPm 클릭ID 또는 paid UTM 기반입니다. Naver Ads 플랫폼 확정 매출이 아닙니다."
      : null;

  return (
    <div className={cardCls}>
      <div className={styles.pCardHead}>
        <h3>{PLATFORM_LABEL[row.platform || ""] || row.platform}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StatusBadge status={ref.status} />
          <FreshBadge freshness={fresh} />
          <span className={styles.refLabel}>참고값</span>
        </div>
      </div>

      <dl className={styles.pNums}>
        <dt>실제 결제 매출</dt>
        <dd>{fmtKRW(internal.revenue)}</dd>
        <dt>실제 결제 주문</dt>
        <dd>{fmtNum(internal.orders)}건</dd>
        <dt>광고 플랫폼 주장 매출</dt>
        <dd>{fmtKRW(ref.conversionValueKrw ?? null)}</dd>
        <dt>광고비</dt>
        <dd>{fmtKRW(ref.spendKrw ?? null)}</dd>
        <dt>플랫폼 주장 ROAS</dt>
        <dd>{fmtRoas(ref.roas)}</dd>
        <dt>광고 플랫폼이 더 잡은 매출 (over-claim)</dt>
        <dd className={`${styles.gap} ${gap != null && gap > 0 ? styles.pos : styles.neg}`}>
          {gap == null ? "-" : (gap > 0 ? "+" : "") + fmtKRW(gap)}
        </dd>
      </dl>

      {isTikTokWarn && (
        <div className={styles.warnNote}>
          <strong>TikTok 강경고.</strong> 값은 로컬 cache(<code>tiktok_ads_daily</code>) 기준이며, 구매값은 한국어 export 의 중복 구매 헤더를 추정한 결과입니다. Ads Manager 원본 대조 전까지 ROAS {fmtRoas(ref.roas)} 는 예산 판단에 사용하지 마세요. <em>reference_only</em>.
        </div>
      )}

      {isBlocked && (
        <div className={styles.blockedNote}>
          {row.platform === "naver"
            ? "Naver Ads source 는 아직 연결되지 않았습니다. 광고비·플랫폼 주장값·ROAS 는 산출 보류입니다."
            : `${ref.error || "source 미연결"} — 예산 판단 보류.`}
        </div>
      )}

      {naverCandidateNote && <div className={styles.warnNote}>{naverCandidateNote}</div>}

      <ul className={styles.diagList}>
        {ref.source && (
          <li>
            source: <code>{ref.source}</code>
          </li>
        )}
        {ref.sourceWindow && (ref.sourceWindow.startDate || ref.sourceWindow.endDate) && (
          <li>
            window: <code>{ref.sourceWindow.startDate || "?"}</code>~<code>{ref.sourceWindow.endDate || "?"}</code>
            {ref.sourceWindow.latestDate ? (
              <>
                {" "}
                · latest <code>{ref.sourceWindow.latestDate}</code>
              </>
            ) : null}
          </li>
        )}
        {ref.attributionWindow && (
          <li>
            attribution window: <code>{ref.attributionWindow}</code>
          </li>
        )}
        {ref.queriedAt && <li>queried at: {fmtTs(ref.queriedAt)}</li>}
      </ul>
    </div>
  );
}

function CorrectionLinesSection({ lines }: { lines: CorrectionLineItem[] }) {
  if (!lines.length) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        보정 라인
        <small>site/source 별도 표시 · cross-site 자동 합산 금지</small>
      </h2>
      <p className={styles.sectionDesc}>
        biocom 예산 ROAS에 들어가는 보정값과 더클린커피 내부 actual 후보를 별도 line으로 보여준다.
        더클린커피 line은 campaign/site spend mapping 전까지 참고값이다.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>line</th>
            <th>site / source</th>
            <th style={{ textAlign: "right" }}>주문</th>
            <th style={{ textAlign: "right" }}>금액</th>
            <th>status / blank</th>
            <th>예산 ROAS 사용</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong>{line.label}</strong>
                <div className={styles.kpiSub}>{line.source_role}</div>
              </td>
              <td>
                <div>
                  <code>{line.site}</code> · <code>{line.source}</code>
                </div>
                <div className={styles.kpiSub}>
                  {line.db_location} · {line.table}
                </div>
              </td>
              <td className={styles.num}>{fmtNum(line.count)}</td>
              <td className={styles.num}>{fmtKRW(line.amount_krw)}</td>
              <td>
                <div>
                  <StatusBadge status={line.status} />
                </div>
                {line.status_blank_count != null && line.status_blank_count > 0 && (
                  <div className={styles.kpiSub}>
                    status blank {fmtNum(line.status_blank_count)}건 /{" "}
                    {fmtKRW(line.status_blank_amount_krw)}
                  </div>
                )}
                {line.warnings.length > 0 && (
                  <div className={styles.kpiSub}>{line.warnings.join(" / ")}</div>
                )}
              </td>
              <td>
                <span
                  className={`${styles.badge} ${
                    line.included_in_budget_roas ? styles.badgeFresh : styles.badgeLocal
                  }`}
                >
                  {line.included_in_budget_roas ? "예산 ROAS 포함" : "참고 line"}
                </span>
                <div className={styles.kpiSub}>{line.use_for_budget_roas}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CoffeeReferenceView({
  line,
  queriedAt,
  month,
}: {
  line?: CorrectionLineItem;
  queriedAt?: string | null;
  month: string;
}) {
  if (!line) {
    return (
      <section className={styles.blockedPanel}>
        <h2>더클린커피 데이터 연결 대기</h2>
        <p>
          현재 `/total` 응답에 더클린커피 correction line이 없습니다. backend correction source 파일 또는
          site-landing summary API 연결 상태를 먼저 확인해야 합니다.
        </p>
      </section>
    );
  }

  return (
    <div>
      <section className={styles.decisionHero}>
        <div className={`${styles.decisionCard} ${styles.primaryDecision}`}>
          <span className={styles.kpiLabel}>더클린커피 실제 NPay 매출 후보</span>
          <strong className={styles.decisionValue}>{fmtKRW(line.amount_krw)}</strong>
          <span className={styles.kpiSub}>
            최근 30일 rolling actual line · {fmtNum(line.count)}건
          </span>
        </div>
        <div className={styles.decisionCard}>
          <span className={styles.kpiLabel}>현재 상태</span>
          <strong className={styles.decisionValue}>
            <StatusBadge status={line.status} />
          </strong>
          <span className={styles.kpiSub}>VM Cloud SQLite imweb_orders 기준</span>
        </div>
        <div className={styles.decisionCard}>
          <span className={styles.kpiLabel}>status blank</span>
          <strong className={styles.decisionValue}>{fmtNum(line.status_blank_count ?? 0)}건</strong>
          <span className={styles.kpiSub}>{fmtKRW(line.status_blank_amount_krw ?? 0)} · sync lag 관찰 대상</span>
        </div>
        <div className={styles.decisionCard}>
          <span className={styles.kpiLabel}>예산 ROAS 사용</span>
          <strong className={styles.decisionValue}>제외</strong>
          <span className={styles.kpiSub}>biocom 광고 예산 판단에 자동 합산 금지</span>
        </div>
      </section>

      <section className={styles.blockedPanel}>
        <h2>더클린커피 탭은 아직 월별 채널 분석이 아닙니다</h2>
        <p>
          이 탭은 {month} 월별 채널 breakdown이 아니라, 더클린커피 NPay actual correction line을 별도로
          보여주는 참고 화면입니다. 광고/자연검색/직접방문 분해는 coffee용 월별 spine과 channel evidence가
          붙은 뒤 열어야 합니다.
        </p>
        <ul>
          <li>source: <code>{line.source}</code></li>
          <li>위치: <code>{line.db_location}</code> · <code>{line.table}</code></li>
          <li>정책: <code>{line.use_for_budget_roas}</code></li>
          <li>조회 시각: {fmtTs(queriedAt)}</li>
        </ul>
      </section>

      {line.warnings.length > 0 && (
        <section className={styles.warningBanner}>
          <strong>주의할 점</strong>
          <ul>
            {line.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            <li>GA4는 already_in_ga4 guard일 뿐 actual 매출 source가 아닙니다.</li>
            <li>campaign/site spend mapping 전까지 biocom budget ROAS에 더하지 않습니다.</li>
          </ul>
        </section>
      )}

      <CorrectionLinesSection lines={[line]} />
    </div>
  );
}

export default function TotalPage() {
  const [month, setMonth] = useState(defaultReportMonth);
  const [draftMonth, setDraftMonth] = useState(defaultReportMonth);
  const [selectedSite, setSelectedSite] = useState<SelectedSite>("biocom");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let progressTimer: number | null = null;
    setLoading(true);
    setLoadingProgress(7);
    setError(null);
    // gpt0508-49 UX fix: 새 fetch 시작 시 옛 data 유지 — 카드 회색 처리 + 로딩 표시
    const url = `${API_BASE}/api/total/monthly-channel-summary?site=biocom&month=${encodeURIComponent(
      month,
    )}&mode=dry_run`;
    progressTimer = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= 92) return current;
        const next = current + (current < 35 ? 8 : current < 70 ? 5 : 2);
        return Math.min(next, 92);
      });
    }, 650);
    fetch(url)
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse | ApiError;
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setError("error" in json ? json.error : `HTTP ${res.status}`);
          // 에러 시에도 옛 data 유지 (사용자가 어디 있었는지 알도록)
        } else {
          setLoadingProgress(100);
          setData(json);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "fetch failed");
      })
      .finally(() => {
        if (progressTimer) window.clearInterval(progressTimer);
        if (!cancelled) {
          window.setTimeout(() => {
            if (!cancelled) setLoading(false);
          }, 160);
        }
      });
    return () => {
      cancelled = true;
      if (progressTimer) window.clearInterval(progressTimer);
    };
  }, [month]);

  const diagnostics = useMemo(() => (data ? normalizeDiagnostics(data) : []), [data]);
  const stale = diagnostics.filter((d) => d.budgetDecisionImpact !== "usable");
  const correctionLines = data?.correction_lines?.items || [];
  const coffeeLine = correctionLines.find((line) => line.site === "thecleancoffee");
  const budgetCorrectionAmount = correctionAmount(correctionLines, true);
  const holdRevenue = data
    ? data.evidence.totals.unknown_revenue +
      data.monthly_spine.review_revenue_c +
      data.monthly_spine.quarantine_revenue_d
    : 0;
  const loadingStageIndex = loadingStageForProgress(loadingProgress);
  const submitMonth = () => {
    setLoading(true);
    setLoadingProgress(7);
    setError(null);
    setMonth(draftMonth);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>월 매출 어디서 왔는가</h1>
      <p className={styles.subtitle}>
        이번 달 실제 결제완료 매출이 어느 채널 (광고 / 자연 검색 / 직접 방문 / 추천) 에서 들어왔는지 한 화면에 보여줍니다. 광고 플랫폼이 주장하는 매출은 절대 더하지 않습니다.
      </p>

      <div className={styles.siteTabs} role="tablist" aria-label="사이트 선택">
        {SITE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selectedSite === option.id}
            className={`${styles.siteTab} ${selectedSite === option.id ? styles.siteTabActive : ""}`.trim()}
            onClick={() => setSelectedSite(option.id)}
          >
            <span>{option.label}</span>
            <small>{option.helper}</small>
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <label>
          월:
          <input
            type="month"
            value={draftMonth}
            min="2024-01"
            max="2026-12"
            onChange={(e) => setDraftMonth(e.target.value)}
          />
        </label>
        <button type="button" onClick={submitMonth} className={styles.queryBtn}>
          조회
        </button>
        {data && (
          <span className={styles.controlMeta}>
            표시 사이트 <strong>{SITE_LABEL[selectedSite]}</strong> · source 조회 시각 {fmtTs(data.metadata.queried_at)}
          </span>
        )}
      </div>

      {loading && (
        <div
          className={styles.loadingPanel}
          role="status"
          aria-live="polite"
          aria-label={`이번 달 데이터 불러오는 중 ${loadingProgress}%`}
        >
          <div className={styles.loadingTopRow}>
            <div>
              <strong>이번 달 데이터 불러오는 중</strong>
              <span>운영DB + VM Cloud 조회 약 10~15초 소요</span>
            </div>
            <b>{loadingProgress}%</b>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${loadingProgress}%` }} />
          </div>
          <ol className={styles.loadingSteps}>
            {LOADING_STAGES.map((stage, index) => (
              <li
                key={stage}
                className={
                  index < loadingStageIndex
                    ? styles.stepDone
                    : index === loadingStageIndex
                    ? styles.stepActive
                    : undefined
                }
              >
                {stage}
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          API 호출 실패: <code>{error}</code>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            backend route 가 운영 7020 포트에 미반영일 수 있습니다. 로컬 검증은{" "}
            <code>PORT=7022 npm exec -- tsx src/server.ts</code> 로 띄워 NEXT_PUBLIC_API_BASE_URL 을
            <code>http://localhost:7022</code> 로 지정하세요.
          </div>
        </div>
      )}

      {data && selectedSite === "thecleancoffee" && (
        <div className={loading ? styles.dataDimmed : undefined}>
          <CoffeeReferenceView line={coffeeLine} queriedAt={data.metadata.queried_at} month={month} />
        </div>
      )}

      {data && selectedSite === "biocom" && (
        <div className={loading ? styles.dataDimmed : undefined}>
          <section className={styles.decisionHero}>
            <div className={`${styles.decisionCard} ${styles.primaryDecision}`}>
              <span className={styles.kpiLabel}>이번 달 광고 예산 판단에 쓸 매출</span>
              <strong className={styles.decisionValue}>
                {fmtKRW(data.monthly_spine.confirmed_net_revenue_ab + budgetCorrectionAmount)}
              </strong>
              <span className={styles.kpiSub}>
                바이오컴 결제완료 (아임웹 + 토스 정본). 광고 플랫폼 주장값과 합치지 않음
              </span>
            </div>
            <div className={styles.decisionCard}>
              <span className={styles.kpiLabel}>어디서 왔는지 모르는 매출</span>
              <strong className={styles.decisionValue}>{fmtKRW(holdRevenue)}</strong>
              <span className={styles.kpiSub}>
                {fmtNum(data.evidence.totals.unknown_orders)}건 — 유입 흔적 부족, 광고/자연/직접 분류 불가
              </span>
            </div>
            <div className={styles.decisionCard}>
              <span className={styles.kpiLabel}>데이터 신뢰도 경고</span>
              <strong className={styles.decisionValue} style={{ color: stale.length ? "#b91c1c" : "#16a34a" }}>
                {stale.length ? `${fmtNum(stale.length)}건` : "정상"}
              </strong>
              <span className={styles.kpiSub}>
                {stale.length ? "원본 대조 후 예산 판단 권장" : "모든 데이터 source 정상"}
              </span>
            </div>
          </section>

          {/* 미분류 매출이 큰 카테고리면 즉시 drilldown 노출 */}
          {data.evidence.totals.unknown_revenue > 0 && (
            <section className={styles.unknownCallout}>
              <h2 className={styles.calloutTitle}>
                어디서 왔는지 모르는 매출 분석
                <span className={styles.calloutSub}>
                  전체의 {fmtPct(data.evidence.totals.unknown_revenue / (data.evidence.totals.revenue_total_ab || 1))} · {fmtKRW(data.evidence.totals.unknown_revenue)} · {fmtNum(data.evidence.totals.unknown_orders)}건
                </span>
              </h2>
              <p className={styles.calloutDesc}>
                이 주문들에는 광고 클릭 ID / UTM / referrer 정보가 충분히 남아있지 않아서 자동 채널 분류가 안 됐습니다.
                <strong> 매출은 분명 있지만 어떻게 들어왔는지 모르는 상태</strong>입니다. 구독/정기결제는 첫 구독 시작만 유입을 보고,
                2회차 이후 매출은 별도 `구독/정기결제` 채널로 분리했습니다.
              </p>
              {data.evidence.unknown_reasons && data.evidence.unknown_reasons.length > 0 && (
                <table className={styles.calloutTable}>
                  <thead>
                    <tr>
                      <th>부족한 정보</th>
                      <th style={{ textAlign: "right" }}>주문</th>
                      <th style={{ textAlign: "right" }}>매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence.unknown_reasons
                      .slice()
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((r) => (
                        <tr key={r.reason || r.unknownReason || "unknown"}>
                          <td>{translateUnknownReason(r.reason || r.unknownReason || "unknown")}</td>
                          <td className={styles.num}>{fmtNum(r.orders)}</td>
                          <td className={styles.num}>{fmtKRW(r.revenue)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {data.evidence.unknown_reason_details && data.evidence.unknown_reason_details.length > 0 && (
                <table className={styles.calloutTable}>
                  <thead>
                    <tr>
                      <th>구체 원인</th>
                      <th style={{ textAlign: "right" }}>주문</th>
                      <th style={{ textAlign: "right" }}>매출</th>
                      <th>다음 확인</th>
                      <th>줄이는 방법</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence.unknown_reason_details
                      .slice()
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((row) => (
                        <tr key={`${row.rootReason}-${row.detail}`}>
                          <td>
                            <strong>{translateUnknownReason(row.rootReason)}</strong>
                            <br />
                            <span className={styles.detailMuted}>{translateUnknownDetail(row.detail)}</span>
                          </td>
                          <td className={styles.num}>{fmtNum(row.orders)}</td>
                          <td className={styles.num}>{fmtKRW(row.revenue)}</td>
                          <td>{translateEvidenceNeed(row.nextEvidenceNeeded)}</td>
                          <td>{translateRecommendedFix(row.recommendedFix)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {data.evidence.naver_organic_evidence && data.evidence.naver_organic_evidence.length > 0 && (
                <table className={styles.calloutTable}>
                  <thead>
                    <tr>
                      <th>네이버 검색 근거</th>
                      <th style={{ textAlign: "right" }}>건수</th>
                      <th style={{ textAlign: "right" }}>매출</th>
                      <th>예산 판단</th>
                      <th>설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence.naver_organic_evidence.map((row) => (
                      <tr key={row.label}>
                        <td>
                          <strong>{translateNaverEvidenceLabel(row.label)}</strong>
                          <br />
                          <span className={styles.detailMuted}>{row.source}</span>
                        </td>
                        <td className={styles.num}>{fmtNum(row.orders)}</td>
                        <td className={styles.num}>{row.revenue == null ? "-" : fmtKRW(row.revenue)}</td>
                        <td>
                          {row.useForBudgetRoas === "yes_order_level"
                            ? "주문 단위 사용 가능"
                            : row.useForBudgetRoas === "reference_only"
                            ? "참고용"
                            : "예산 판단 제외"}
                        </td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.evidence.naver_evidence_aggregate && data.evidence.naver_evidence_aggregate.rows.length > 0 && (
                <>
                  <p className={styles.calloutFix}>
                    <strong>네이버 전체 원장 기준:</strong> {fmtNum(data.evidence.naver_evidence_aggregate.summary?.naverAny || 0)}건 · {data.evidence.naver_evidence_aggregate.coverageStatus === "full_aggregate" ? "전체 aggregate" : "제한된 item 기준"} · 모두 참고용, 예산 판단 제외
                  </p>
                  <table className={styles.calloutTable}>
                    <thead>
                      <tr>
                        <th>분류</th>
                        <th>단계</th>
                        <th style={{ textAlign: "right" }}>건수</th>
                        <th style={{ textAlign: "right" }}>연결키 있음</th>
                        <th>예산 판단</th>
                        <th>설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.evidence.naver_evidence_aggregate.rows.map((row) => (
                        <tr key={`${row.class}-${row.touchpoint}`}>
                          <td><strong>{translateNaverAggregateClass(row.class)}</strong></td>
                          <td>{translateTouchpoint(row.touchpoint)}</td>
                          <td className={styles.num}>{fmtNum(row.rows)}</td>
                          <td className={styles.num}>{fmtNum(row.bridgeKeyPresent)}</td>
                          <td>참고용, 예산 판단 제외</td>
                          <td>{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {data.evidence.utm_invalid_audit && data.evidence.utm_invalid_audit.length > 0 && (
                <table className={styles.calloutTable}>
                  <thead>
                    <tr>
                      <th>UTM 규칙 후보</th>
                      <th style={{ textAlign: "right" }}>주문</th>
                      <th style={{ textAlign: "right" }}>매출</th>
                      <th>판정</th>
                      <th>검증용 값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence.utm_invalid_audit.slice(0, 8).map((row) => (
                      <tr key={`${row.family}-${row.source}-${row.medium}-${row.campaign}`}>
                        <td>
                          <strong>{translateUtmFamily(row.family)}</strong>
                          <br />
                          <span className={styles.detailMuted}>{translateUtmCandidateRule(row.candidateRule)}</span>
                        </td>
                        <td className={styles.num}>{fmtNum(row.orders)}</td>
                        <td className={styles.num}>{fmtKRW(row.revenue)}</td>
                        <td>참고용, 예산 판단 제외</td>
                        <td>
                          <span className={styles.detailMuted}>
                            source={row.source} / medium={row.medium} / campaign={row.campaign}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.evidence.subscription_acquisition_summary && (
                <p className={styles.calloutFix}>
                  <strong>구독/정기결제:</strong> 2회차 이후 {fmtNum(data.evidence.subscription_acquisition_summary.renewable_order_count)}건 · {fmtKRW(data.evidence.subscription_acquisition_summary.renewable_revenue)}은
                  별도 구독 매출로 분리했습니다. 첫 구독 중 유입 확인이 필요한 건은 {fmtNum(data.evidence.subscription_acquisition_summary.archive_lookup_needed)}건입니다.
                </p>
              )}
              <p className={styles.calloutFix}>
                <strong>줄이는 방법:</strong> 광고 destination URL 의 UTM 정정 (utm_source/medium 분리) + 카카오 알림톡 / 네이버 파워링크 같은 한국 채널 트래픽도 광고 클릭 ID 캡쳐 추가.
              </p>
            </section>
          )}

          {stale.length > 0 && (
            <details className={styles.disclosure} open>
              <summary>데이터 연결 경고 {stale.length}건 (펼쳐 보임 — 예산 판단 전 점검)</summary>
              <div className={styles.warningBanner} style={{ background: "#fef2f2", borderColor: "#fecaca", borderLeftColor: "#dc2626" }}>
                <strong>예산 판단 전 점검 필요</strong>
                <ul>
                  {stale.map((d, i) => (
                    <li key={`${d.scope}-${d.source}-${i}`}>
                      <strong>{translateSource(d.source || d.platform || d.scope)}</strong> — {translateFreshness(d.freshness)}
                      {d.warning ? ` · ${d.warning}` : ""}
                      {d.fallbackReason ? ` · ${d.fallbackReason}` : ""}
                      {d.error ? ` · ${d.error}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          <details className={styles.disclosure}>
            <summary>읽기 전 주의사항 (펼쳐 보기)</summary>
            <div className={styles.warningBanner}>
              <strong>주의 기준</strong>
              <ul>
                <li>내부 확정 매출은 아임웹 주문 + 토스 결제·취소 정본 기준입니다. 광고 플랫폼이 자기 attribution 기준으로 주장하는 값은 절대 더하지 않습니다.</li>
                <li>광고 플랫폼 카드의 ROAS / 매출은 광고 플랫폼이 주장하는 참고값입니다. 예산 판단은 화면 맨 위 "이번 달 광고 예산 판단에 쓸 매출" 만 사용하세요.</li>
                <li>TikTok ROAS 는 자체 캐시 기반이라 Ads Manager 원본 대조 전까지 참고용입니다.</li>
                <li>Naver Ads 광고비 / 매출 / ROAS 는 source 미연결 — 현재 보류 상태.</li>
                <li>NPay 결제 매칭은 별도 source 연결 전까지 분포 확정 안 함.</li>
              </ul>
            </div>
          </details>

          <CorrectionLinesSection lines={correctionLines} />

          {(data.monthly_spine.review_revenue_c > 0 ||
            data.monthly_spine.quarantine_revenue_d > 0 ||
            data.monthly_spine.toss_only_month_boundary_revenue > 0) && (
            <details className={styles.disclosure}>
              <summary>
                예산 판단에서 제외된 매출{" "}
                {fmtKRW(
                  data.monthly_spine.review_revenue_c +
                    data.monthly_spine.quarantine_revenue_d +
                    data.monthly_spine.toss_only_month_boundary_revenue,
                )}{" "}
                있음 (펼쳐 보기)
              </summary>
              <div className={styles.diffCard}>
                <p style={{ margin: "0 0 12px", fontSize: 13 }}>
                  아래 매출은 결제는 들어왔지만 정합성 검증 / 환불 처리 / 토스 매칭 등의 이유로
                  이번 달 광고 예산 판단에 <strong>포함하지 않은</strong> 금액입니다.
                </p>
                <div className={styles.diffGrid}>
                  <div className={styles.diffCell}>
                    <div className={styles.kpiLabel}>가상계좌 매출 (토스 매칭 못 함)</div>
                    <div className={styles.kpiValue}>
                      {fmtKRW(data.monthly_spine.review_revenue_c)}
                    </div>
                    <div className={styles.kpiSub}>아임웹은 결제완료, 토스 대조 전까지 보류</div>
                  </div>
                  <div className={styles.diffCell}>
                    <div className={styles.kpiLabel}>격리 매출 (환불 처리 중)</div>
                    <div className={styles.kpiValue}>
                      {fmtKRW(data.monthly_spine.quarantine_revenue_d)}
                    </div>
                    <div className={styles.kpiSub}>월 마감 전 점검 대상</div>
                  </div>
                  <div className={styles.diffCell}>
                    <div className={styles.kpiLabel}>월 경계 매출 (토스만 잡힘)</div>
                    <div className={styles.kpiValue}>
                      {fmtKRW(data.monthly_spine.toss_only_month_boundary_revenue)}
                    </div>
                    <div className={styles.kpiSub}>주문 시점과 결제 시점이 다른 달</div>
                  </div>
                </div>
              </div>
            </details>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              채널별 매출 (큰 채널부터)
              <small>합계 {fmtKRW(data.evidence.totals.revenue_total_ab)}</small>
            </h2>
            <p className={styles.sectionDesc}>
              아래 표의 값은 <strong>실제 결제완료 매출</strong>입니다. 광고 플랫폼이 자기 기준으로 주장하는 값과는 다릅니다.
              "신뢰 강" = 광고 클릭 ID 또는 유입 흔적이 명확한 매출, "신뢰 중" = 추정 매출입니다.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>채널</th>
                  <th style={{ textAlign: "right" }}>주문</th>
                  <th style={{ textAlign: "right" }}>매출</th>
                  <th style={{ textAlign: "right" }}>비중</th>
                  <th>다음 액션</th>
                  <th style={{ textAlign: "right" }}>신뢰도</th>
                  <th>참고</th>
                </tr>
              </thead>
              <tbody>
                {data.evidence.channel_summary
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((row) => {
                    const action = channelAction(row);
                    const actionCls =
                      action.tone === "green"
                        ? styles.badgeFresh
                        : action.tone === "yellow"
                        ? styles.badgeLocal
                        : action.tone === "red"
                        ? styles.badgeBlocked
                        : styles.badgeNeutral;
                    const confA = row.confidence?.A ?? 0;
                    const confB = row.confidence?.B ?? 0;
                    const totalConf = confA + confB;
                    const confLabel = totalConf === 0
                      ? "-"
                      : confA >= confB * 2
                      ? "강"
                      : confB >= confA * 2
                      ? "중"
                      : "강+중";
                    const channelKr = translateChannelCode(row.primary_channel) || row.display_label;
                    return (
                      <tr key={row.primary_channel}>
                        <td>
                          <strong>{channelKr}</strong>
                          <span
                            className={styles.codeHint}
                            title={`내부 코드: ${row.primary_channel}`}
                          >
                            ?
                          </span>
                        </td>
                        <td className={styles.num}>{fmtNum(row.orders)}</td>
                        <td className={styles.num}>
                          <strong>{fmtKRW(row.revenue)}</strong>
                        </td>
                        <td className={styles.num}>
                          <span className={styles.shareBar}>
                            <span
                              className={styles.shareBarFill}
                              style={{ width: `${Math.min((row.share_of_confirmed_revenue ?? 0) * 100, 100)}%` }}
                            />
                          </span>
                          <span className={styles.shareText}>{fmtPct(row.share_of_confirmed_revenue)}</span>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${actionCls}`}>{action.text}</span>
                        </td>
                        <td className={styles.num} title={`A 신뢰 ${fmtKRW(confA)} / B 신뢰 ${fmtKRW(confB)}`}>
                          {confLabel}
                        </td>
                        <td style={{ fontSize: 11.5, color: "#64748b" }}>
                          {row.primary_channel === "paid_naver"
                            ? "네이버 광고비는 로컬 캐시 연결, 캠페인별 주문 join은 보류"
                            : row.primary_channel === "npay"
                            ? "NPay 결제완료, 광고 연결은 보류"
                            : row.primary_channel === "organic_naver"
                            ? "네이버 검색 referrer 기반, paid marker 없음"
                            : row.primary_channel === "unknown"
                            ? "매출은 있으나 유입 흔적 부족"
                            : ""}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              광고 플랫폼이 주장하는 매출 (참고용)
              <small>예산 판단에는 위의 "내부 확정 매출" 사용</small>
            </h2>
            <p className={styles.sectionDesc}>
              아래 카드의 ROAS 와 매출은 광고 플랫폼이 자기 attribution 기준으로 "이 광고 덕분에 매출이 났다"
              고 주장하는 참고값입니다. 광고 플랫폼끼리는 같은 매출을 중복으로 자기 공으로 잡기 때문에 합치면 안 됩니다.
            </p>
            <div className={styles.platformGrid}>
              {(data.platform_reference.rows || []).map((row, i) => (
                <PlatformCard key={`${row.platform}-${i}`} row={row} />
              ))}
            </div>
          </section>

          <details className={`${styles.section} ${styles.disclosure}`}>
            <summary>데이터 source 신선도 (펼쳐 보기 · 기술 상세)</summary>
            <h2 className={styles.sectionTitle}>데이터 source 신선도</h2>
            <p className={styles.sectionDesc}>
              운영DB / VM Cloud / 외부 API 각각의 데이터가 얼마나 최신인지. "최신" 외의 상태는 예산 판단 전 점검.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>source</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>신뢰</th>
                  <th>조회 시각</th>
                  <th>최근 데이터</th>
                  <th>fallback / 사유</th>
                </tr>
              </thead>
              <tbody>
                {data.source_freshness.map((s, i) => (
                  <tr key={`${s.source}-${i}`}>
                    <td>
                      <strong>{translateSource(s.source)}</strong>
                      <span className={styles.codeHint} title={`내부 코드: ${s.source}`}>?</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{s.role}</td>
                    <td>
                      <FreshBadge freshness={s.status} />
                    </td>
                    <td>{s.confidence || "-"}</td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>{fmtTs(s.queried_at)}</td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>{fmtTs(s.latest_observed_at)}</td>
                    <td style={{ fontSize: 11.5, color: "#7c2d12" }}>
                      {s.fallback ? "fallback · " : ""}
                      {s.fallback_reason || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <details className={`${styles.section} ${styles.disclosure}`}>
            <summary>데이터 source 진단 상세 (펼쳐 보기 · 기술 상세)</summary>
            <h2 className={styles.sectionTitle}>데이터 source 진단</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>scope</th>
                  <th>source</th>
                  <th>freshness</th>
                  <th>window / latest</th>
                  <th style={{ textAlign: "right" }}>imported</th>
                  <th style={{ textAlign: "right" }}>usable</th>
                  <th>warning / impact</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((d, i) => (
                  <tr key={`diag-${i}`}>
                    <td style={{ fontSize: 11.5 }}>{d.scope}</td>
                    <td>
                      <code>{d.source || d.platform || "-"}</code>
                    </td>
                    <td>
                      <FreshBadge freshness={d.freshness} />
                    </td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>
                      {d.startDate || d.endDate
                        ? `${d.startDate || "?"} ~ ${d.endDate || "?"}`
                        : "-"}
                      {d.latestDate ? ` (latest ${d.latestDate})` : ""}
                    </td>
                    <td className={styles.num}>{fmtNum(d.importedRows ?? d.rowCount ?? null)}</td>
                    <td className={styles.num}>{fmtNum(d.usableRows ?? null)}</td>
                    <td style={{ fontSize: 11.5 }}>
                      <strong style={{ color: d.budgetDecisionImpact === "usable" ? "#166534" : d.budgetDecisionImpact === "reference_only" ? "#92400e" : "#991b1b" }}>
                        {d.budgetDecisionImpact}
                      </strong>
                      {d.warning ? ` · ${d.warning}` : ""}
                      {d.fallbackReason ? ` · ${d.fallbackReason}` : ""}
                      {d.error ? ` · ${d.error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.glossary}>
              <strong>용어:</strong> <code>fresh</code>=플랫폼 source 최신 (단, 내부 정본 매출 의미 아님) · <code>local_cache</code>=로컬 cache, 원본 대조 전 참고용 · <code>blocked</code>=권한·원천 미연결, 예산 판단 보류 · <code>budgetDecisionImpact: usable</code>=예산 판단 사용 가능, <code>reference_only</code>=참고만, <code>blocked</code>=보류.
            </div>
          </details>

          <details className={`${styles.section} ${styles.disclosure}`}>
            <summary>기술 메타 (개발자용)</summary>
            <div className={styles.diffCard}>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>
                <strong>{data.frontend_copy.headline}</strong>
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#475569" }}>
                {data.frontend_copy.subtext}
              </p>
              <ul className={styles.diagList}>
                <li>
                  계약 버전: <code>{data.metadata.contract_version}</code> · spine{" "}
                  <code>{data.metadata.source_contracts.spine}</code> · evidence{" "}
                  <code>{data.metadata.source_contracts.evidence}</code>
                </li>
                <li>
                  윈도우: <code>{data.metadata.date_start}</code> ~{" "}
                  <code>{data.metadata.date_end_exclusive}</code> ({data.metadata.timezone}) · 모드{" "}
                  <code>{data.metadata.mode}</code> · write <code>{String(data.metadata.write)}</code>{" "}
                  · send <code>{String(data.metadata.send)}</code> · deploy{" "}
                  <code>{String(data.metadata.deploy)}</code>
                </li>
                <li>
                  primary 합산이 매출과 일치:{" "}
                  <code>{String(data.monthly_spine.primary_sum_matches_revenue)}</code>
                </li>
              </ul>
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
