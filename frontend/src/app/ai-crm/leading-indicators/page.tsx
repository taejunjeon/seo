"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";
import {
  BIOCOM_META_COHORT_SPLIT,
  COFFEE_CHANNEL_TRUTH,
  COHORT_SUMMARY,
  CohortRow,
  CohortSummary,
  DRY_RUN_META,
  GA4_LIVE_API_BEHAVIOR_GAP,
  PAGE_LONG_THRESHOLD_FIT,
  PAGE_LONG_THRESHOLD_FIT_30D_FOCUSED,
  PageLongThresholdRow,
  READINESS,
  SAFE_BRIDGE_COVERAGE_AUDIT,
  SafeBridgeCoverageAuditRow,
  channelLabelKo,
} from "./dry-run";

type SiteKey = "biocom" | "thecleancoffee";
type WindowKey = "1d" | "7d" | "14d" | "30d";
type ChannelKey =
  | "meta"
  | "youtube"
  | "google_paid"
  | "organic"
  | "naver_paid_or_brand"
  | "direct_or_unknown"
  | "all";
type DimensionKey = "buyer_vs_leaver" | "channel";

type GoogleAdsAuditReadiness = "ok" | "verify_click_id_capture" | "gap" | "not_found";

type GoogleAdsFinalUrlSiteSummary = {
  site: "biocom" | "thecleancoffee" | "other" | "unknown";
  label: string;
  rows: number;
  finalUrls: number;
  manualUtmRows: number;
  googleClickParamRows: number;
  trackingTemplateRows: number;
  finalUrlSuffixRows: number;
  readiness: GoogleAdsAuditReadiness;
  interpretation: string;
};

type LandingClickIdAudit = {
  site: "biocom" | "thecleancoffee";
  label: string;
  windowDays: number;
  totalLandingRows: number;
  googleClickIdRows: number;
  googleClickIdRowsByType: {
    gclid: number;
    gbraid: number;
    wbraid: number;
  };
  googleUtmRows: number;
  googleChannelRows: number;
  googleEvidenceRows: number;
  nonGooglePaidSearchRows: number;
  googleEvidenceBreakdown: Array<{
    segment: "google_ads_paid" | "google_organic" | "google_unknown" | "not_google_paid_search";
    label: string;
    rows: number;
    confidence: "high" | "medium" | "low";
    interpretation: string;
  }>;
  latestLandingAt: string | null;
  topLandingPaths: Array<{
    path: string;
    rows: number;
    googleEvidenceRows: number;
  }>;
  captureStatus:
    | "google_click_id_present"
    | "google_channel_without_click_id"
    | "not_google_paid_search"
    | "landing_rows_present_no_google_evidence"
    | "no_landing_rows"
    | "table_unavailable";
  interpretation: string;
};

type OtherFinalUrlSummary = {
  totalRows: number;
  finalUrls: number;
  dispositionSummary: Array<{
    disposition: string;
    label: string;
    rows: number;
    finalUrls: number;
    interpretation: string;
  }>;
  samples: Array<{
    campaignName: string;
    campaignStatus: string;
    channel: string;
    parentName: string | null;
    entityStatus: string;
    hosts: string[];
    sampleUrls: string[];
    disposition: string;
    dispositionLabel: string;
    reason: string;
  }>;
  interpretation: string;
};

type GoogleAdsTrafficRouteAudit = {
  site: "biocom" | "thecleancoffee";
  label: string;
  windowDays: number;
  decision:
    | "actual_google_paid_click_confirmed"
    | "ads_config_present_but_no_landing_evidence"
    | "paused_or_legacy_config_only"
    | "no_ads_config_no_landing_evidence"
    | "landing_table_unavailable";
  confidence: "high" | "medium" | "low";
  accountEvidence: {
    currentAccountFinalUrlRows: number;
    enabledRows: number;
    pausedOrRemovedRows: number;
    manualUtmRows: number;
    googleClickParamRows: number;
    trackingTemplateRows: number;
    finalUrlSuffixRows: number;
    legacyOrOtherRows: number;
    legacyNeedsMappingRows: number;
  };
  landingEvidence: {
    totalLandingRows: number;
    googleClickIdRows: number;
    googleEvidenceRows: number;
    nonGooglePaidSearchRows: number;
    latestLandingAt: string | null;
  };
  routeSteps: Array<{
    step: string;
    label: string;
    status: "pass" | "warn" | "fail";
    evidence: string;
    interpretation: string;
  }>;
  nextActions: Array<{
    owner: "Codex" | "TJ";
    action: string;
    why: string;
    successCriteria: string;
  }>;
  interpretation: string;
};

type GoogleAdsFinalUrlAuditResponse = {
  ok: boolean;
  fetchedAt?: string;
  customerId?: string;
  autoTaggingEnabled?: boolean | null;
  customer?: {
    descriptiveName?: string;
  } | null;
  summary?: {
    totalRows: number;
    adRows: number;
    assetGroupRows: number;
    finalUrls: number;
    manualUtmRows: number;
    googleClickParamRows: number;
    trackingTemplateRows: number;
    finalUrlSuffixRows: number;
    siteSummary: GoogleAdsFinalUrlSiteSummary[];
    landingClickIdAudit?: LandingClickIdAudit[];
    otherUrlSummary?: OtherFinalUrlSummary;
    actualTrafficRouteAudit?: GoogleAdsTrafficRouteAudit[];
    warnings: string[];
  };
  error?: unknown;
};

type LeadingIndicatorItem = {
  id: string;
  label: string;
  status: string;
  score: number | null;
  score_grade?: string | null;
  buyer_value: number | null;
  non_buyer_value: number | null;
  delta: number | null;
  unit: string;
  sample_sessions: number;
  known_coverage_pct: number | null;
  score_components?: {
    lift?: number | null;
    volume?: number | null;
    confidence?: number | null;
    controllability?: number | null;
    risk_penalty?: number | null;
  } | null;
  interpretation_ko?: string;
  next_action_ko?: string;
  data_quality_note_ko?: string;
  rank?: number;
};

type KpiRole = "lever" | "management" | "diagnostic";

type IndicatorPlaybook = {
  what: string;
  how: string;
  why: string;
  successCriteria: string;
};

type LeadingIndicatorsApiResponse = {
  ok: boolean;
  indicators?: LeadingIndicatorItem[];
  cache?: {
    cached?: boolean;
    cached_at_kst?: string;
    next_refresh_at_kst?: string;
    generation_ms?: number;
    source?: string;
  };
  source?: {
    freshness_kst?: string;
    confidence?: string;
  };
  error?: unknown;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const SITE_OPTIONS: { value: SiteKey; label: string }[] = [
  { value: "biocom", label: "바이오컴" },
  { value: "thecleancoffee", label: "더클린커피" },
];

const WINDOW_OPTIONS: { value: WindowKey; label: string }[] = [
  { value: "1d", label: "어제" },
  { value: "7d", label: "최근 7일" },
  { value: "14d", label: "최근 14일" },
  { value: "30d", label: "최근 30일" },
];

const CHANNEL_OPTIONS: { value: ChannelKey; label: string }[] = [
  { value: "meta", label: "Meta" },
  { value: "youtube", label: "YouTube" },
  { value: "google_paid", label: "Google 유료" },
  { value: "organic", label: "오가닉" },
  { value: "naver_paid_or_brand", label: "네이버 paid/brand" },
  { value: "direct_or_unknown", label: "직접/불명" },
  { value: "all", label: "전체" },
];

const LEADING_INDICATOR_CACHE_AUDIT = {
  checkedAtKst: "2026-05-26 13:00 KST",
  decision: "운영 숫자는 VM 보고서를 기준으로 보고, 로컬 보고서는 화면/문구 개발 확인용으로만 봅니다.",
  reason:
    "로컬 API는 개발용 DB라 safe session이 0으로 나올 수 있습니다. VM API는 실제 수집 원장 기준이며, 선행지표 precompute cache가 켜져 있어 화면은 미리 계산된 값을 빠르게 읽습니다.",
  vmCacheStatus:
    "VM Cloud env: LEADING_INDICATORS_PRECOMPUTE_ENABLED=1, LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000",
  vmResponseStatus:
    "VM API 44개 조합 사전 계산, cache=true/in_memory_precompute, 최근 응답 generation 약 151ms",
};

const PROJECT_OKR_SUMMARY = {
  objective:
    "구매 전에 매출을 예고하는 행동을 찾아, 광고와 랜딩 운영자가 매일 바꿀 수 있는 1~2개 레버지표로 만든다.",
  progressPct: 77,
  reading:
    "수집/조인은 운영 화면에 올릴 수준까지 왔고, 이제 핵심은 지표를 행동 공략집과 연결해 실제 실험으로 넘기는 단계입니다.",
};

const PROJECT_ACTION_PLAN = [
  {
    title: "레버지표 확정",
    progressPct: 82,
    what: "2분 이상 체류, 주문서 진입, 리뷰/깊은 스크롤 중 실제 구매와 가장 잘 붙는 행동을 고릅니다.",
    why: "매출은 직접 움직일 수 없지만, 광고 문구·랜딩 첫 화면·CTA는 오늘 바로 바꿀 수 있습니다.",
    next: "채널별 Top 5 카드에서 표본 충분한 후보만 주간 실험 후보로 승격합니다.",
  },
  {
    title: "관리지표 보강",
    progressPct: 70,
    what: "GA4와 VM Cloud가 같은 방문으로 붙지 않는 비율, 더클린커피 스크롤/결제수단 공백을 매주 줄입니다.",
    why: "데이터가 덜 붙으면 좋은 행동과 나쁜 행동을 잘못 비교해 잘못된 KPI를 만들 수 있습니다.",
    next: "join rate, 수집 공백, 표본 부족 카드는 레버가 아니라 품질 점검 카드로 분리합니다.",
  },
  {
    title: "실험 공략집 연결",
    progressPct: 58,
    what: "선행지표 후보마다 광고·랜딩·리뷰·구매 버튼에서 무엇을 바꿀지 실행안을 붙입니다.",
    why: "KPI만 있으면 압박이고, 공략집이 붙어야 팀이 내일 아침 실제 행동을 바꿀 수 있습니다.",
    next: "Top 5 카드의 공략집을 Claude Code 프론트/운영 실험 backlog로 넘깁니다.",
  },
];

const ORGANIC_PAGE_LONG_STATUS: Record<
  SiteKey,
  { safeSessions: number; ga4JoinedSessions: number; joinRatePct: number }
> = {
  biocom: { safeSessions: 244, ga4JoinedSessions: 189, joinRatePct: 77.1 },
  thecleancoffee: { safeSessions: 29, ga4JoinedSessions: 26, joinRatePct: 89.7 },
};

const DIMENSION_OPTIONS: { value: DimensionKey; label: string }[] = [
  { value: "buyer_vs_leaver", label: "3개 cohort" },
  { value: "channel", label: "채널별" },
];

const siteLabelKo = (site: SiteKey) =>
  SITE_OPTIONS.find((s) => s.value === site)?.label ?? site;

const fmtKRW = (krw: number): string => {
  if (krw === 0) return "₩0";
  if (krw < 10_000) return `₩${krw.toLocaleString("ko-KR")}`;
  const eok = Math.floor(krw / 100_000_000);
  const man = Math.floor((krw % 100_000_000) / 10_000);
  if (eok > 0 && man > 0) return `₩${eok}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok > 0) return `₩${eok}억`;
  return `₩${man.toLocaleString("ko-KR")}만`;
};

const fmtPct = (value: number | null, digits = 1): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
};

const fmtSeconds = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}초`;
};

const fmtCount = (value: number): string => value.toLocaleString("ko-KR");

const fmtRateFraction = (
  numerator: number,
  denominator: number,
  rate: number | null
): string => {
  if (denominator === 0 || rate === null) return "표본 없음";
  return `${numerator}/${denominator}명 · ${fmtPct(rate)}`;
};

const fmtPoint = (value: number | null, digits = 1): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%p`;
};

const fmtScore = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}점`;
};

const fmtIndicatorValue = (value: number | null, unit: string): string => {
  if (value === null || Number.isNaN(value)) return "—";
  if (unit === "pct") return fmtPct(value);
  if (unit === "seconds" || unit === "sec") return fmtSeconds(value);
  if (unit === "count" || unit === "sessions") return fmtCount(value);
  return Number.isInteger(value) ? fmtCount(value) : value.toFixed(1);
};

const fmtIndicatorDelta = (value: number | null, unit: string): string => {
  if (value === null || Number.isNaN(value)) return "—";
  if (unit === "pct") return fmtPoint(value);
  if (unit === "seconds" || unit === "sec") return signedSeconds(value);
  return `${value >= 0 ? "+" : ""}${Number.isInteger(value) ? fmtCount(value) : value.toFixed(1)}`;
};

const indicatorStatusLabel = (status: string): string => {
  if (status === "strong_candidate") return "우선 실험";
  if (status === "candidate") return "관리 후보";
  if (status === "watch") return "관찰";
  if (status === "insufficient_data") return "표본 부족";
  return "후보";
};

const indicatorStatusClass = (
  status: string
): "candidate" | "caution" | "parked" | "shortage" => {
  if (status === "strong_candidate" || status === "candidate") return "candidate";
  if (status === "watch") return "caution";
  if (status === "insufficient_data") return "shortage";
  return "parked";
};

const indicatorKpiRole = (item: LeadingIndicatorItem): KpiRole => {
  const text = `${item.id} ${item.label}`.toLowerCase();
  if (
    item.status === "insufficient_data" ||
    text.includes("coverage") ||
    text.includes("join") ||
    text.includes("source") ||
    text.includes("capi") ||
    text.includes("add_payment")
  ) {
    return "management";
  }
  if (
    text.includes("dwell") ||
    text.includes("long") ||
    text.includes("begin_checkout") ||
    text.includes("checkout") ||
    text.includes("cart") ||
    text.includes("scroll") ||
    text.includes("review")
  ) {
    return "lever";
  }
  return item.status === "watch" ? "diagnostic" : "lever";
};

const indicatorKpiRoleLabel = (role: KpiRole): string => {
  if (role === "lever") return "레버지표";
  if (role === "management") return "관리지표";
  return "진단지표";
};

const indicatorKpiRoleClass = (role: KpiRole): string => {
  if (role === "lever") return styles.kpiRoleLever;
  if (role === "management") return styles.kpiRoleManagement;
  return styles.kpiRoleDiagnostic;
};

const indicatorPlaybook = (item: LeadingIndicatorItem): IndicatorPlaybook => {
  const text = `${item.id} ${item.label}`.toLowerCase();
  if (text.includes("dwell") || text.includes("long") || text.includes("체류")) {
    return {
      what: "2분 이상 머무는 방문자 비율을 올립니다.",
      how: "광고 문구와 첫 화면 메시지를 맞추고, 첫 5초 안에 상품 이유·가격·리뷰 진입점을 보이게 합니다.",
      why: "구매자는 보통 더 오래 읽습니다. 오래 읽는 비율이 올라가면 랜딩이 설득하고 있다는 신호입니다.",
      successCriteria: "같은 채널에서 2분 이상 비율과 주문서 진입률이 함께 오르면 성공입니다.",
    };
  }
  if (text.includes("begin_checkout") || text.includes("checkout") || text.includes("주문서")) {
    return {
      what: "상품 상세에서 주문서까지 도착하는 비율을 올립니다.",
      how: "구매 버튼 위치, 옵션 선택, 배송/혜택 문구, 가격 불안을 줄이는 문구를 우선 점검합니다.",
      why: "주문서 진입은 구매 직전 행동이라 광고/랜딩 개선 효과가 빠르게 드러납니다.",
      successCriteria: "주문서 진입률이 오르면서 confirmed purchase도 같이 오르면 레버로 유지합니다.",
    };
  }
  if (text.includes("scroll") || text.includes("review") || text.includes("스크롤")) {
    return {
      what: "리뷰와 핵심 설명 구간까지 도달하는 방문자를 늘립니다.",
      how: "첫 화면에 리뷰 앵커, 핵심 후기 요약, 구매 전 불안 해소 블록으로 이동하는 길을 만듭니다.",
      why: "깊게 읽는 행동은 관심 신호지만 수집 방식 영향을 많이 받아 체류시간과 함께 봐야 합니다.",
      successCriteria: "리뷰 도달률·2분 체류·주문서 진입이 같은 방향으로 오르면 성공입니다.",
    };
  }
  if (text.includes("cart") || text.includes("장바구니")) {
    return {
      what: "장바구니 이후 주문서 진입까지 이어지는 흐름을 줄줄 새지 않게 만듭니다.",
      how: "장바구니 페이지의 혜택, 배송비, 쿠폰 적용, 바로 결제 버튼을 먼저 점검합니다.",
      why: "장바구니는 관심 신호지만 구매자가 아닌 사람도 많이 누르므로 단독 KPI로 쓰면 오판합니다.",
      successCriteria: "장바구니율보다 장바구니 후 주문서 진입률이 개선되면 성공입니다.",
    };
  }
  if (text.includes("add_payment") || text.includes("결제수단")) {
    return {
      what: "결제수단 선택 이벤트가 실제로 비어 있는지, 수집이 빠진 것인지 먼저 닫습니다.",
      how: "GTM/아임웹/VM 원장에서 결제수단 선택 위치와 저장 여부를 read-only로 비교합니다.",
      why: "구매하기 버튼 뒤에서 고르는 행동이라, 의미는 있지만 수집 공백이면 KPI로 쓸 수 없습니다.",
      successCriteria: "결제수단 이벤트가 실제 결제 흐름과 80% 이상 맞으면 후보로 승격합니다.",
    };
  }
  return {
    what: "구매자와 비결제자 차이가 있는 행동을 주간 후보로 관리합니다.",
    how: "표본 수, 데이터 연결률, 채널별 차이를 확인한 뒤 작은 실험으로 검증합니다.",
    why: "선행지표는 결과가 아니라 원인이 되는 행동이어야 운영자가 직접 바꿀 수 있습니다.",
    successCriteria: "다음 주 같은 조건에서 같은 방향의 차이가 반복되면 후보로 유지합니다.",
  };
};

const pageLongStatusLabel = (row: PageLongThresholdRow): string => {
  if (row.vmSafeSessions === 0) return "유입 0 또는 미매핑";
  if (row.confirmedGa4JoinedSessions < 20) return "표본 부족";
  if (row.recommendationStatus === "shorter_threshold_better_for_primary_indicator") {
    return "2분 기준 우선";
  }
  return "2분 기본 · 7분 보조";
};

const pageLongInterpretation = (row: PageLongThresholdRow): string => {
  if (row.vmSafeSessions === 0) {
    return "현재 VM Cloud가 이 유입으로 분류한 세션이 없습니다. 실제 유입이 없었는지, 광고 클릭 ID나 UTM 값이 다른 bucket으로 들어갔는지 source 미매핑 점검이 필요합니다.";
  }
  if (row.confirmedGa4JoinedSessions < 20) {
    const stepPct =
      row.confirmedGa4JoinedSessions > 0 ? 100 / row.confirmedGa4JoinedSessions : null;
    return `구매자 표본이 ${row.confirmedGa4JoinedSessions}명뿐이라 1명만 달라져도 ${
      stepPct ? `${stepPct.toFixed(1)}%p` : "큰 폭"
    } 움직입니다. 그래서 60%, 40%, 20%처럼 딱 떨어지는 숫자는 방향만 봐야 합니다.`;
  }
  if (row.current7Min.liftPct !== null && row.current7Min.liftPct < 3) {
    return "7분까지 오래 읽은 사람만 보면 구매자와 비결제자의 차이가 거의 사라집니다. 운영 주 기준은 2분으로 두고, 7분은 초고의도 보조 신호로만 봅니다.";
  }
  return `7분도 차이는 있지만 도달자가 줄어듭니다. 기본 선행지표는 ${row.recommendedThresholdLabel ?? "2분"} 기준, 7분은 강한 관심 방문 보조 지표로 보는 것이 안전합니다.`;
};

const findThresholdRow = (row: PageLongThresholdRow, label: string) =>
  row.thresholdRows.find((threshold) => threshold.label === label) ?? null;

const focusedPageLongReading = (row: PageLongThresholdRow): string => {
  if (row.vmSafeSessions === 0) {
    return "VM 원장에 이 유입군 세션이 없어 판단을 보류합니다.";
  }
  if (row.confirmedGa4JoinedSessions === 0) {
    return "구매자 표본이 없어 결제자를 예고하는 기준 시간을 고를 수 없습니다.";
  }
  if (row.confirmedGa4JoinedSessions < 20) {
    return "표본이 작아 퍼센트가 딱 떨어집니다. 방향성만 보고 예산 판단에는 쓰지 않습니다.";
  }
  if (row.site === "thecleancoffee" && row.sourceGroup === "meta") {
    return "2분은 결제자와 비결제자 차이가 보이고, 3분은 차이가 거의 없습니다. 그래서 기본 기준은 2분이 더 낫습니다.";
  }
  return "2분은 표본을 덜 잃으면서 구매 전 관심을 잡는 기준입니다. 7분은 매우 강한 관심 신호로만 보조 사용합니다.";
};

const SCROLL_DENOMINATOR_AUDIT = [
  {
    site: "바이오컴",
    ga4Sessions: 64063,
    oldBuyerRatePct: 92.98,
    oldNonBuyerRatePct: 76.52,
    rawScroll90RatePct: 14.2,
    assumedScrollRatePct: 14.2,
    currentMetaBuyerRatePct: 51.1,
    currentMetaNonBuyerRatePct: 30.0,
    pageViewLongRatePct: 8.3,
    reviewReachRatePct: 23.5,
    changeSummary:
      "과거 화면은 결제자 92.98% / 비결제자 76.52%처럼 보였지만, 최신 원본 GA4 전체 세션 기준은 14.2%입니다. Meta cohort만 다시 보면 결제자 51.1% / 비결제자 30.0%입니다.",
    currentReading:
      "숫자가 낮아진 핵심 이유는 고객이 갑자기 덜 읽어서가 아니라, 분모가 달라졌기 때문입니다. 예전 값은 결제 흐름에 들어온 cohort 위주였고, 새 값은 전체 GA4 세션과 Meta cohort를 나눠 봅니다.",
    nextAction:
      "화면에는 전체 방문자 기준, Meta 결제자 기준, Meta 비결제자 기준을 함께 표시해 예전 90%대 숫자와 최신 14.2%/51.1% 숫자를 혼동하지 않게 합니다.",
  },
  {
    site: "더클린커피",
    ga4Sessions: 3904,
    oldBuyerRatePct: 99.68,
    oldNonBuyerRatePct: 88.52,
    rawScroll90RatePct: 0,
    assumedScrollRatePct: 56.5,
    currentMetaBuyerRatePct: null,
    currentMetaNonBuyerRatePct: null,
    pageViewLongRatePct: 14.0,
    reviewReachRatePct: 26.5,
    changeSummary:
      "과거 화면은 결제자 99.68% / 비결제자 88.52%처럼 보였지만, 최신 GA4 원본에서 percent_scrolled 값이 없어 raw 90% 도달률은 0%입니다. scroll 이벤트 자체를 90%로 간주하면 56.5%지만, 이 값은 부풀려질 수 있습니다.",
    currentReading:
      "여기는 고객 행동이 나빠진 것이 아니라 측정값이 비어 있는 문제입니다. 더클린커피는 scroll 이벤트는 많지만 90%인지 50%인지 구분하는 percent_scrolled 값이 빠져 있어 기존 90%대 숫자를 그대로 믿으면 안 됩니다.",
    nextAction:
      "50%/90% 스크롤을 명시 이벤트로 보내거나, VM Cloud에 가장 깊게 본 스크롤 비율(max_scroll_percent)을 별도로 저장해야 결제자/비결제자 스크롤 차이를 다시 볼 수 있습니다.",
  },
];

const dwellDeltaSeconds = (row: CohortRow): number | null => {
  if (row.buyerP50DwellSeconds === null || row.leaverP50DwellSeconds === null) return null;
  return Number((row.buyerP50DwellSeconds - row.leaverP50DwellSeconds).toFixed(1));
};

const signedSeconds = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}초`;
};

const dwellDeltaReading = (row: CohortRow): string => {
  const delta = dwellDeltaSeconds(row);
  if (delta === null) return "체류시간 비교에 필요한 GA4 행동 데이터가 부족합니다.";
  if (delta >= 0) {
    return `결제자가 비결제자보다 중앙 체류시간이 ${delta.toFixed(
      1
    )}초 더 깁니다.`;
  }
  return `비결제자가 결제자보다 중앙 체류시간이 ${Math.abs(delta).toFixed(
    1
  )}초 더 깁니다. 체류시간만으로 구매 의도를 판단하면 오판할 수 있습니다.`;
};

const buildSummaryFallbackIndicators = (
  confirmed: CohortSummary,
  dropped: CohortSummary
): LeadingIndicatorItem[] => {
  const sampleSessions = confirmed.ga4JoinedSessions + dropped.ga4JoinedSessions;
  const rows: LeadingIndicatorItem[] = [
    {
      id: "begin_checkout_rate_fallback",
      label: "주문서 진입 비율",
      status: "candidate",
      score: 60,
      buyer_value: confirmed.beginCheckoutRatePct,
      non_buyer_value: dropped.beginCheckoutRatePct,
      delta: confirmed.beginCheckoutRatePct - dropped.beginCheckoutRatePct,
      unit: "pct",
      sample_sessions: sampleSessions,
      known_coverage_pct: Math.min(confirmed.joinRatePct, dropped.joinRatePct),
      interpretation_ko:
        "주문서 진입은 결제 직전 행동입니다. 구매 완료와는 다르지만, 구매 의도가 가장 강하게 드러나는 앞단 신호입니다.",
      next_action_ko:
        "구매 버튼 클릭 후 주문서까지 잘 도착하는지 랜딩/상품/결제 흐름별로 나눠 봅니다.",
      data_quality_note_ko: "운영 API를 못 읽을 때 쓰는 정적 dry-run fallback입니다.",
      rank: 1,
    },
    {
      id: "scroll90_rate_fallback",
      label: "90% 이상 스크롤 비율",
      status: "watch",
      score: 55,
      buyer_value: confirmed.scroll90RatePct,
      non_buyer_value: dropped.scroll90RatePct,
      delta: confirmed.scroll90RatePct - dropped.scroll90RatePct,
      unit: "pct",
      sample_sessions: sampleSessions,
      known_coverage_pct: Math.min(confirmed.joinRatePct, dropped.joinRatePct),
      interpretation_ko:
        "깊게 읽은 방문자는 구매 가능성이 높을 수 있지만, 사이트마다 스크롤 수집 방식이 달라 보조 지표로 봅니다.",
      next_action_ko:
        "스크롤만 보지 말고 체류시간, 리뷰 구간 도달, 주문서 진입을 함께 묶어 판단합니다.",
      data_quality_note_ko: "운영 API를 못 읽을 때 쓰는 정적 dry-run fallback입니다.",
      rank: 2,
    },
    {
      id: "page_view_long_rate_fallback",
      label: "2분 이상 오래 본 비율",
      status: "watch",
      score: 54,
      buyer_value: confirmed.pageViewLongRatePct,
      non_buyer_value: dropped.pageViewLongRatePct,
      delta: confirmed.pageViewLongRatePct - dropped.pageViewLongRatePct,
      unit: "pct",
      sample_sessions: sampleSessions,
      known_coverage_pct: Math.min(confirmed.joinRatePct, dropped.joinRatePct),
      interpretation_ko:
        "2분 이상 머문 방문자는 상품 설명을 읽었을 가능성이 큽니다. 구매를 바로 뜻하지는 않지만 랜딩 품질 판단에 유용합니다.",
      next_action_ko:
        "2분 이상 체류 비율을 캠페인/랜딩별로 나눠 어떤 유입이 잘 읽히는지 봅니다.",
      data_quality_note_ko: "운영 API를 못 읽을 때 쓰는 정적 dry-run fallback입니다.",
      rank: 3,
    },
    {
      id: "cart_signal_rate_fallback",
      label: "장바구니 신호 비율",
      status: "watch",
      score: 52,
      buyer_value: confirmed.addToCartRatePct,
      non_buyer_value: dropped.addToCartRatePct,
      delta: confirmed.addToCartRatePct - dropped.addToCartRatePct,
      unit: "pct",
      sample_sessions: sampleSessions,
      known_coverage_pct: Math.min(confirmed.joinRatePct, dropped.joinRatePct),
      interpretation_ko:
        "장바구니는 관심 신호지만 단독으로는 약합니다. 주문서 진입과 같이 볼 때 의미가 커집니다.",
      next_action_ko:
        "장바구니 후 결제 시작으로 이어지지 않는 상품/랜딩을 따로 봅니다.",
      data_quality_note_ko: "운영 API를 못 읽을 때 쓰는 정적 dry-run fallback입니다.",
      rank: 4,
    },
    {
      id: "add_payment_info_rate_fallback",
      label: "결제수단 선택 비율",
      status: "insufficient_data",
      score: 40,
      buyer_value: confirmed.addPaymentInfoRatePct,
      non_buyer_value: dropped.addPaymentInfoRatePct,
      delta: confirmed.addPaymentInfoRatePct - dropped.addPaymentInfoRatePct,
      unit: "pct",
      sample_sessions: sampleSessions,
      known_coverage_pct: Math.min(confirmed.joinRatePct, dropped.joinRatePct),
      interpretation_ko:
        "결제수단 선택은 좋은 중간 신호지만, 현재 일부 사이트에서는 이벤트가 비어 있어 먼저 수집 공백을 닫아야 합니다.",
      next_action_ko:
        "add_payment_info가 실제 행동 부재인지 GTM/아임웹 수집 누락인지 분리합니다.",
      data_quality_note_ko: "운영 API를 못 읽을 때 쓰는 정적 dry-run fallback입니다.",
      rank: 5,
    },
  ];
  return rows;
};

const findCoffeeChannel = (channel: ChannelKey): CohortRow | null => {
  if (channel === "all") return null;
  return COFFEE_CHANNEL_TRUTH.find((r) => r.channel === channel) ?? null;
};

export default function LeadingIndicatorsPage() {
  const [site, setSite] = useState<SiteKey>("biocom");
  const [windowKey, setWindowKey] = useState<WindowKey>("7d");
  const [channel, setChannel] = useState<ChannelKey>("meta");
  const [dimension, setDimension] = useState<DimensionKey>("buyer_vs_leaver");
  const [googleAdsAudit, setGoogleAdsAudit] = useState<GoogleAdsFinalUrlAuditResponse | null>(null);
  const [googleAdsAuditError, setGoogleAdsAuditError] = useState<string | null>(null);
  const [leadingIndicators, setLeadingIndicators] = useState<LeadingIndicatorItem[]>([]);
  const [leadingIndicatorsCache, setLeadingIndicatorsCache] = useState<
    LeadingIndicatorsApiResponse["cache"] | null
  >(null);
  const [leadingIndicatorsLoading, setLeadingIndicatorsLoading] = useState(false);
  const [leadingIndicatorsError, setLeadingIndicatorsError] = useState<string | null>(null);

  const coffeeMetaRow = useMemo(() => findCoffeeChannel("meta")!, []);
  const selectedCoffeeRow = useMemo(() => findCoffeeChannel(channel), [channel]);
  const pageLongRows = useMemo(() => {
    const siteRows = PAGE_LONG_THRESHOLD_FIT.filter((row) => row.site === site);
    if (channel === "all") return siteRows;
    return siteRows.filter((row) => row.sourceGroup === channel);
  }, [channel, site]);
  const focusedPageLongRows = useMemo(() => {
    const targets: Array<[SiteKey, PageLongThresholdRow["sourceGroup"]]> = [
      ["biocom", "google_paid"],
      ["biocom", "youtube"],
      ["biocom", "organic"],
      ["thecleancoffee", "meta"],
    ];
    return targets
      .map(([targetSite, targetChannel]) =>
        PAGE_LONG_THRESHOLD_FIT.find(
          (row) => row.site === targetSite && row.sourceGroup === targetChannel
        )
      )
      .filter((row): row is PageLongThresholdRow => Boolean(row));
  }, []);
  const focusedPageLong30dRows = useMemo(() => PAGE_LONG_THRESHOLD_FIT_30D_FOCUSED, []);

  const biocomConfirmed = COHORT_SUMMARY.find(
    (r) => r.site === "biocom" && r.cohort === "confirmed_purchase"
  )!;
  const biocomDropped = COHORT_SUMMARY.find(
    (r) => r.site === "biocom" && r.cohort === "dropped_checkout"
  )!;
  const coffeeConfirmed = COHORT_SUMMARY.find(
    (r) => r.site === "thecleancoffee" && r.cohort === "confirmed_purchase"
  )!;
  const coffeeDropped = COHORT_SUMMARY.find(
    (r) => r.site === "thecleancoffee" && r.cohort === "dropped_checkout"
  )!;
  const fallbackIndicators = useMemo(
    () =>
      site === "thecleancoffee"
        ? buildSummaryFallbackIndicators(coffeeConfirmed, coffeeDropped)
        : buildSummaryFallbackIndicators(biocomConfirmed, biocomDropped),
    [biocomConfirmed, biocomDropped, coffeeConfirmed, coffeeDropped, site]
  );

  const biocomReadiness = READINESS.find((r) => r.site === "biocom")!;
  const coffeeReadiness = READINESS.find((r) => r.site === "thecleancoffee")!;
  const biocomBehaviorGap = GA4_LIVE_API_BEHAVIOR_GAP.find((r) => r.site === "biocom")!;
  const coffeeBehaviorGap = GA4_LIVE_API_BEHAVIOR_GAP.find(
    (r) => r.site === "thecleancoffee"
  )!;
  const biocomMetaDwellDelta =
    biocomBehaviorGap.dryRunBuyerP50Seconds - biocomBehaviorGap.dryRunNonBuyerP50Seconds;
  const coffeeMetaDwellDelta =
    coffeeBehaviorGap.dryRunBuyerP50Seconds - coffeeBehaviorGap.dryRunNonBuyerP50Seconds;

  // dry-run 모드에서 13d/14d/30d 는 동일한 7d snapshot 만 보유
  const windowHint =
    windowKey === "7d"
      ? ""
      : "(현재 dry-run 은 7일 snapshot 만 보유, 다른 기간은 P1 라이브 API 연결 후 분리)";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    fetch(`${API_BASE}/api/google-ads/final-url-audit?limit=1000`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<GoogleAdsFinalUrlAuditResponse>;
      })
      .then((body) => {
        if (!body.ok) {
          throw new Error("Google Ads final URL audit failed");
        }
        setGoogleAdsAudit(body);
        setGoogleAdsAuditError(null);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setGoogleAdsAuditError(error instanceof Error ? error.message : "audit fetch failed");
        }
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    const params = new URLSearchParams({
      site,
      window: windowKey,
      channel,
      dimension,
    });

    const loadingTimer = window.setTimeout(() => {
      setLeadingIndicatorsLoading(true);
    }, 0);
    fetch(`${API_BASE}/api/attribution/leading-indicators?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<LeadingIndicatorsApiResponse>;
      })
      .then((body) => {
        if (!body.ok) {
          throw new Error("leading indicators API failed");
        }
        setLeadingIndicators(body.indicators ?? []);
        setLeadingIndicatorsCache(body.cache ?? null);
        setLeadingIndicatorsError(null);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setLeadingIndicators([]);
          setLeadingIndicatorsCache(null);
          setLeadingIndicatorsError(error instanceof Error ? error.message : "leading indicators fetch failed");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        window.clearTimeout(loadingTimer);
        setLeadingIndicatorsLoading(false);
      });

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [channel, dimension, site, windowKey]);

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
        <div className={styles.headerBar}>
          <h1 className={styles.title}>
            오늘 구매를 예고하는 행동은 무엇인가?
            <span className={styles.sampleBadge}>VM live API + GA4 dry-run</span>
          </h1>
          <span className={styles.freshness}>
            데이터 기준 {DRY_RUN_META.checkedAtKst} · {DRY_RUN_META.window} · source{" "}
            {DRY_RUN_META.source}
          </span>
        </div>
        <p className={styles.subtitle}>
          결제한 사람과 결제하지 않은 사람의 체류시간(페이지에 머문 시간), 스크롤,
          장바구니, 결제 시작 차이를 비교합니다. 광고 플랫폼 주장값이 아니라 VM Cloud 와
          GA4 를 맞춰 본 내부 행동 분석입니다.
        </p>

        <p className={styles.linkRow}>
          관련 화면 · 퍼널 수집/전송 정상 여부는{" "}
          <Link href="/ai-crm/conversion-funnel">/ai-crm/conversion-funnel</Link> 에서 봅니다.
          이 화면은 정상 수집된 데이터에서 <strong>구매 전 좋은 행동</strong>을 찾는 분석
          화면입니다.
        </p>

        <div className={styles.runtimeNotice}>
          <div>
            <span className={styles.headlineKicker}>보고서 기준</span>
            <strong>{LEADING_INDICATOR_CACHE_AUDIT.decision}</strong>
            <p>{LEADING_INDICATOR_CACHE_AUDIT.reason}</p>
          </div>
          <dl>
            <div>
              <dt>점검 시각</dt>
              <dd>{LEADING_INDICATOR_CACHE_AUDIT.checkedAtKst}</dd>
            </div>
            <div>
              <dt>VM cache</dt>
              <dd>켜짐 · 30분 사전 계산</dd>
            </div>
            <div>
              <dt>근거</dt>
              <dd>{LEADING_INDICATOR_CACHE_AUDIT.vmResponseStatus}</dd>
            </div>
          </dl>
        </div>

        <ProjectOkrPanel />

        {/* 필터 */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>사이트</span>
            <div className={styles.filterPills}>
              {SITE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${site === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setSite(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>기간</span>
            <div className={styles.filterPills}>
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${windowKey === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setWindowKey(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>채널</span>
            <div className={styles.filterPills}>
              {CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${channel === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setChannel(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>분석 기준</span>
            <div className={styles.filterPills}>
              {DIMENSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${dimension === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setDimension(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 상단 판단 카드 3종 */}
        <div className={styles.headlineGrid}>
          <div className={`${styles.headlineCard} ${styles.green}`}>
            <span className={styles.headlineKicker}>바이오컴 Meta 행동 신호</span>
            <h2 className={styles.headlineTitle}>
              GA4 기준 결제자가 약 {biocomMetaDwellDelta.toFixed(0)}초 더 오래 봅니다
            </h2>
            <p className={styles.headlineBody}>
              바이오컴 Meta · 최근 7일 · GA4 BigQuery 기준 · 결제자 중앙{" "}
              {fmtSeconds(biocomBehaviorGap.dryRunBuyerP50Seconds)} vs 비결제자{" "}
              {fmtSeconds(biocomBehaviorGap.dryRunNonBuyerP50Seconds)} (
              {signedSeconds(biocomMetaDwellDelta)})
            </p>
          </div>
          <div className={`${styles.headlineCard} ${styles.yellow}`}>
            <span className={styles.headlineKicker}>더클린커피 Meta 주의점</span>
            <h2 className={styles.headlineTitle}>체류시간만으로 구매 의도를 판단하지 마세요</h2>
            <p className={styles.headlineBody}>
              더클린커피 Meta · 결제자 {fmtSeconds(coffeeBehaviorGap.dryRunBuyerP50Seconds)}
              {" "}vs 비결제자 {fmtSeconds(coffeeBehaviorGap.dryRunNonBuyerP50Seconds)} (
              {signedSeconds(coffeeMetaDwellDelta)}). 랜딩/장바구니/결제시작을 같이 봐야 합니다.
            </p>
          </div>
          <div className={`${styles.headlineCard} ${styles.blue}`}>
            <span className={styles.headlineKicker}>live API 보강 필요</span>
            <h2 className={styles.headlineTitle}>
              짧아진 체류시간은 행동 급락이 아니라 source 차이입니다
            </h2>
            <p className={styles.headlineBody}>
              live API 바이오컴 Meta는 VM 원장값 {fmtSeconds(
                biocomBehaviorGap.liveApiBuyerP50Seconds
              )}/{fmtSeconds(biocomBehaviorGap.liveApiNonBuyerP50Seconds)}로 보입니다. GA4 행동 join을
              붙이면 {fmtSeconds(biocomBehaviorGap.dryRunBuyerP50Seconds)}/
              {fmtSeconds(biocomBehaviorGap.dryRunNonBuyerP50Seconds)}입니다.
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>페이지 롱 뷰 기준 시간 · 기본은 2분으로 봅니다</h2>
          <p className={styles.sectionDesc}>
            페이지 롱 뷰는 “방문자가 페이지에 오래 머물렀다”는 신호입니다. 운영에서 볼
            기본 기준은 2분으로 고정합니다. 3분은 “2분보다 오래 본 사람만 남겼을 때
            신호가 더 좋아지는지” 확인하는 비교값이고, 7분은 구매 직전의 아주 강한 관심
            보조 신호입니다. 아래 표는 TJ님이 요청한 바이오컴 Google 유료/YouTube/오가닉과
            더클린커피 Meta를 2분/3분/7분으로 고정 비교합니다.
          </p>
          <div className={styles.focusedPageLongStack}>
            <FocusedPageLongComparison
              rows={focusedPageLongRows}
              title="최근 7일 · 빠른 변화 감지용"
              description="현재 화면에 보이던 표입니다. 7일은 빠르게 이상 징후를 잡는 데 좋지만, Google 유료·YouTube·오가닉처럼 유입이 적은 채널은 구매자 표본이 0~3명까지 줄어 퍼센트가 딱 떨어집니다."
            />
            <FocusedPageLongComparison
              rows={focusedPageLong30dRows}
              title="최근 30일 · 기준 시간 판단용"
              description="표본을 넓혀 같은 기준을 다시 봅니다. 바이오컴 Google 유료는 구매자 15명까지 늘고, 더클린커피 Meta는 구매자 95명까지 늘어 2분 기준이 더 안정적으로 보입니다. 그래도 오가닉처럼 구매자 표본이 3명인 row는 아직 방향만 봅니다."
            />
          </div>
          <h3 className={styles.subsectionTitle}>현재 선택한 필터 상세</h3>
          <PageLongThresholdPanel rows={pageLongRows} site={site} channel={channel} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>GA4 행동 데이터 최신 7일 · live API와 왜 다른가</h2>
          <p className={styles.sectionDesc}>
            체류시간은 “페이지에 실제로 머문 시간”입니다. 지금 화면의 최신 dry-run은 GA4
            BigQuery 행동값을 VM Cloud 결제 원장과 safe session으로 맞춘 값입니다. 로컬
            leadingIndicators API에는 이 GA4 행동 snapshot을 붙였고, 운영 배포 전 화면은
            dry-run 기준으로 live API와 왜 다르게 보였는지 설명합니다.
          </p>
          <BehaviorSourceGapPanel />
        </section>

        <GooglePaidFinalUrlAuditPanel
          audit={googleAdsAudit}
          error={googleAdsAuditError}
        />

        {/* 구매자 vs 비결제자 비교 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            구매자 vs 비결제자 비교 · {siteLabelKo(site)}{" "}
            {site === "thecleancoffee" && channel !== "all"
              ? `· ${channelLabelKo(channel)}`
              : ""}
          </h2>
          <p className={styles.sectionDesc}>
            결제자와 비결제자가 결제 전 어떻게 다르게 행동했는지 같은 표에서 비교합니다.{" "}
            {windowHint}
          </p>
          <div className={styles.compareCard}>
            {site === "thecleancoffee" && selectedCoffeeRow ? (
              <CoffeeChannelCompare row={selectedCoffeeRow} />
            ) : site === "thecleancoffee" && channel !== "all" ? (
              <MissingCoffeeChannelCompare channel={channel} />
            ) : site === "thecleancoffee" ? (
              <CoffeeAllCompare confirmed={coffeeConfirmed} dropped={coffeeDropped} />
            ) : (
              <BiocomCompare
                confirmed={biocomConfirmed}
                dropped={biocomDropped}
                channel={channel}
              />
            )}
          </div>
        </section>

        {/* 선행지표 후보 랭킹 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>선행지표 후보 랭킹</h2>
          <p className={styles.sectionDesc}>
            분석 결과를 오늘 운영/광고/랜딩에서 무엇을 바꿀지 결정하는 카드로 정리했습니다.
            Top 5는 운영 API가 미리 계산한 점수입니다. 점수는 차이 크기, 표본 수, 신뢰도,
            우리가 실제로 바꿀 수 있는지, 오판 위험을 함께 반영합니다.
          </p>
          <IndicatorRanking
            indicators={leadingIndicators}
            fallbackIndicators={fallbackIndicators}
            loading={leadingIndicatorsLoading}
            error={leadingIndicatorsError}
            cache={leadingIndicatorsCache}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>90% 스크롤 수치가 낮아진 이유</h2>
          <p className={styles.sectionDesc}>
            90% 스크롤은 “방문자가 페이지의 90% 지점까지 봤다”는 뜻으로 쓰고 싶지만,
            사이트마다 수집 방식이 달라 그대로 비교하면 오해가 납니다. 아래 표는 최근
            7일 GA4 원본과 VM Cloud cohort 화면의 차이를 사람이 이해할 수 있게 나눈
            점검표입니다. 핵심은 “고객이 갑자기 덜 읽었다”가 아니라 “예전 숫자와 지금
            숫자의 분모와 측정 기준이 다르다”입니다.
          </p>
          <div className={styles.denominatorGrid}>
            {SCROLL_DENOMINATOR_AUDIT.map((row) => (
              <article key={row.site} className={styles.denominatorCard}>
                <h3>{row.site}</h3>
                <div className={styles.scrollChangeBox}>
                  <span>얼마에서 얼마로 바뀌었나</span>
                  <strong>
                    과거 결제자/비결제자 {fmtPct(row.oldBuyerRatePct)} /{" "}
                    {fmtPct(row.oldNonBuyerRatePct)} → 최신 원본{" "}
                    {fmtPct(row.rawScroll90RatePct)}
                  </strong>
                  <p>{row.changeSummary}</p>
                </div>
                <dl>
                  <dt>GA4 세션</dt>
                  <dd>{row.ga4Sessions.toLocaleString("ko-KR")}</dd>
                  <dt>GA4 원본 90% 스크롤</dt>
                  <dd>{fmtPct(row.rawScroll90RatePct)}</dd>
                  <dt>scroll 이벤트를 90으로 간주할 때</dt>
                  <dd>{fmtPct(row.assumedScrollRatePct)}</dd>
                  <dt>현재 Meta 결제자 / 비결제자</dt>
                  <dd>
                    {row.currentMetaBuyerRatePct === null
                      ? "측정 보강 필요"
                      : `${fmtPct(row.currentMetaBuyerRatePct)} / ${fmtPct(
                          row.currentMetaNonBuyerRatePct
                        )}`}
                  </dd>
                  <dt>긴 조회 이벤트(page_view_long)</dt>
                  <dd>{fmtPct(row.pageViewLongRatePct)}</dd>
                  <dt>리뷰 URL/이벤트 도달</dt>
                  <dd>{fmtPct(row.reviewReachRatePct)}</dd>
                </dl>
                <p>{row.currentReading}</p>
                <p>
                  <strong>다음 보강:</strong> {row.nextAction}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 채널별 비교 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>채널별 비교 · 더클린커피 최근 7일</h2>
          <p className={styles.sectionDesc}>
            같은 매출도 채널마다 결제 전 행동이 다릅니다. 결제율이 낮아도 결제한 사람이
            페이지에 오래 머무른 채널은 랜딩/결제 흐름 개선 후보입니다.
          </p>
          <CoffeeChannelTable rows={COFFEE_CHANNEL_TRUTH} />
        </section>

        {/* 더클린커피 Meta 분석 예시 카드 (항상 노출) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            더클린커피 Meta 분석 예시 <span className={styles.sampleBadge}>항상 노출</span>
          </h2>
          <p className={styles.sectionDesc}>
            바이오컴을 보고 있어도 이 카드는 P0 에서 항상 띄웁니다. 더클린커피 Meta 결과는
            현재 가장 신뢰도가 높은 행동 비교라서, 의사결정 기준점으로 같이 봅니다.
          </p>
          <div className={styles.compareCard}>
            <p className={styles.compareSummary}>
              Meta 유입 safe session <strong>{coffeeMetaRow.vmSafeSessions}</strong> /{" "}
              GA4 연결 <strong>{coffeeMetaRow.ga4JoinedSessions}</strong> ({fmtPct(coffeeMetaRow.joinRatePct)}).{" "}
              결제 세션 <strong>{coffeeMetaRow.confirmedPurchaseSessions}</strong>,{" "}
              비결제 세션 <strong>{coffeeMetaRow.droppedCheckoutSessions}</strong>,{" "}
              결제금액 <strong>{fmtKRW(coffeeMetaRow.confirmedAmountKrw)}</strong>.{" "}
              {dwellDeltaReading(coffeeMetaRow)}
            </p>
            <CoffeeChannelCompare row={coffeeMetaRow} />
          </div>
        </section>

        {/* 데이터 신뢰도 패널 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>데이터 신뢰도</h2>
          <p className={styles.sectionDesc}>
            이 화면 숫자를 예산 판단에 써도 되는지 사이트별로 구분합니다. join rate 가 낮은
            site/channel 은 결제율로 단정하지 않습니다.
          </p>
          <div className={styles.trustGrid}>
            <TrustCard
              name={coffeeReadiness.displayName}
              level="high"
              source={DRY_RUN_META.primary}
              crossCheck={DRY_RUN_META.crossCheck}
              window={DRY_RUN_META.window}
              freshness={DRY_RUN_META.checkedAtKst}
              joinRatePct={coffeeMetaRow.joinRatePct}
              confidence={DRY_RUN_META.confidenceCoffee}
              note={coffeeReadiness.interpretationKo}
            />
            <TrustCard
              name={biocomReadiness.displayName}
              level="mid"
              source={DRY_RUN_META.primary}
              crossCheck={DRY_RUN_META.crossCheck}
              window={DRY_RUN_META.window}
              freshness={DRY_RUN_META.checkedAtKst}
              joinRatePct={biocomConfirmed.joinRatePct}
              confidence={DRY_RUN_META.confidenceBiocom}
              note={biocomReadiness.interpretationKo}
            />
          </div>
          <ul className={styles.caveatList}>
            {DRY_RUN_META.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        {/* 액션 큐 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>액션 큐</h2>
          <p className={styles.sectionDesc}>
            분석에서 멈추지 않고, 누가 무엇을 다음에 할지로 바로 이어집니다.
          </p>
          <div className={styles.queueGrid}>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex 데이터 / Claude Code 화면</span>
              <h3 className={styles.queueTitle}>
                더클린커피 Meta: 2분 이상 체류 비율을 캠페인/랜딩별로 비교
              </h3>
              <p className={styles.queueDetail}>
                현재 화면은 채널 단위까지만 본다. P2 에서 캠페인/랜딩별 체류시간 분포를 분해해
                어느 광고와 랜딩을 키울지 결정한다.
              </p>
              <span className={styles.queueMeta}>승인: 없음</span>
            </div>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex read-only 재조회</span>
              <h3 className={styles.queueTitle}>
                더클린커피: add_payment_info 공백 원인 분해
              </h3>
              <p className={styles.queueDetail}>
                최신 GA4 export에서는 begin_checkout은 보입니다. 하지만 add_payment_info는
                결제자와 비결제자 모두 0%라 결제수단 선택 단계가 비어 있습니다. 다음 재조회는
                결제수단 선택이 실제로 없는지, GTM/아임웹에서 이벤트가 빠지는지 분리합니다.
              </p>
              <span className={styles.queueMeta}>의존성: GA4 BigQuery daily export + GTM Preview evidence</span>
            </div>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex 설계 + TJ 승인</span>
              <h3 className={styles.queueTitle}>
                바이오컴: GA4 purchase 충돌 cohort 를 순수 비결제자에서 제외
              </h3>
              <p className={styles.queueDetail}>
                Meta-only 세션 중 GA4 purchase 가 보이지만 VM confirmed purchase 로 닫히지 않은
                row 는 이탈자가 아니다. 최근 3일 재조회로 이 보류 bucket 이 줄었는지 확인한 뒤
                key capture 보강 범위를 결정한다.
              </p>
              <span className={styles.queueMeta}>
                승인: read-only 재조회는 없음 · key capture 변경 시 필요
              </span>
            </div>
          </div>
        </section>

        {/* 금지선 footer */}
        <div className={styles.footerBar}>
          <strong>금지선</strong> · 이 화면의 수치는 read-only 분석 전용입니다. 다음 동작은
          별도 승인 전 절대 실행하지 않습니다.
          <ul>
            <li>Meta CAPI 전송 / GA4 Measurement Protocol 전송 / Google Ads upload</li>
            <li>TikTok·Naver 전송 또는 upload / GTM Production publish / VM Cloud deploy·restart</li>
            <li>운영 DB write / raw order·payment·member·click id 화면 노출</li>
            <li>join rate 가 낮은 site/channel 을 예산 판단용 전환율로 표시</li>
          </ul>
        </div>
      </main>
    </>
  );
}

function ProjectOkrPanel() {
  return (
    <section className={styles.okrPanel}>
      <div className={styles.okrHeader}>
        <div>
          <span className={styles.headlineKicker}>프로젝트 OKR</span>
          <h2>{PROJECT_OKR_SUMMARY.objective}</h2>
          <p>{PROJECT_OKR_SUMMARY.reading}</p>
        </div>
        <div className={styles.okrProgress}>
          <span>종합 진척률</span>
          <strong>{PROJECT_OKR_SUMMARY.progressPct}%</strong>
          <div className={styles.progressTrack} aria-hidden="true">
            <span style={{ width: `${PROJECT_OKR_SUMMARY.progressPct}%` }} />
          </div>
        </div>
      </div>
      <div className={styles.okrActionGrid}>
        {PROJECT_ACTION_PLAN.map((item) => (
          <article key={item.title} className={styles.okrActionCard}>
            <div className={styles.okrActionTop}>
              <h3>{item.title}</h3>
              <strong>{item.progressPct}%</strong>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${item.progressPct}%` }} />
            </div>
            <p>
              <strong>무엇:</strong> {item.what}
            </p>
            <p>
              <strong>왜:</strong> {item.why}
            </p>
            <p>
              <strong>다음:</strong> {item.next}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PageLongThresholdPanel({
  rows,
  site,
  channel,
}: {
  rows: PageLongThresholdRow[];
  site: SiteKey;
  channel: ChannelKey;
}) {
  if (rows.length === 0) {
    const organicStatus = channel === "organic" ? ORGANIC_PAGE_LONG_STATUS[site] : null;

    return (
      <div className={styles.pageLongEmpty}>
        <strong>
          {siteLabelKo(site)} · {channel === "all" ? "전체" : channelLabelKo(channel)} 기준은
          아직 page long view 비교표가 없습니다.
        </strong>
        {organicStatus ? (
          <>
            <p>
              운영 VM API에서는 오가닉 유입 자체는 잡힙니다. 최근 7일 기준{" "}
              {fmtCount(organicStatus.safeSessions)}개 후보 세션 중 GA4 행동 데이터가 붙은
              세션은 {fmtCount(organicStatus.ga4JoinedSessions)}개 (
              {fmtPct(organicStatus.joinRatePct)})입니다.
            </p>
            <p>
              다만 이 조합은 표본이 부족하면 추천 시간을 확정하지 않습니다. 즉 오가닉은
              유입 자체는 보되, 결제자를 예고하는 기준 시간은 표본이 쌓일 때까지 보류합니다.
            </p>
          </>
        ) : (
          <p>
            현재 dry-run은 Meta, Google 유료, YouTube, 오가닉을 우선 비교했습니다.
            네이버/직접/기타는 P1 live endpoint가 붙으면 같은 방식으로 채울 수 있습니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.pageLongGrid}>
      {rows.map((row) => (
        <article key={`${row.site}-${row.sourceGroup}`} className={styles.pageLongCard}>
          <div className={styles.pageLongHeader}>
            <div>
              <span className={styles.headlineKicker}>
                {row.siteLabel} · {row.sourceLabel}
              </span>
              <h3>{pageLongStatusLabel(row)}</h3>
            </div>
            <span
              className={`${styles.trustBadge} ${
                row.confirmedGa4JoinedSessions < 20 || row.vmSafeSessions === 0
                  ? styles.low
                  : styles.mid
              }`}
            >
              {row.vmSafeSessions === 0 ? "미매핑 점검" : `GA4 연결 ${fmtPct(row.joinRatePct)}`}
            </span>
          </div>

          <p className={styles.pageLongReading}>{pageLongInterpretation(row)}</p>

          <div className={styles.pageLongMetricGrid}>
            <div>
              <span>전체 후보 세션</span>
              <strong>{fmtCount(row.vmSafeSessions)}</strong>
            </div>
            <div>
              <span>구매자 표본</span>
              <strong>{fmtCount(row.confirmedGa4JoinedSessions)}</strong>
            </div>
            <div>
              <span>비결제자 표본</span>
              <strong>{fmtCount(row.droppedGa4JoinedSessions)}</strong>
            </div>
            <div>
              <span>추천 기준</span>
              <strong>{row.recommendedThresholdLabel ?? "보류"}</strong>
            </div>
          </div>

          <div className={styles.pageLongSevenMinute}>
            <span>7분 보조 기준</span>
            <strong>
              구매자{" "}
              {fmtRateFraction(
                row.current7Min.confirmedAboveSessions,
                row.confirmedGa4JoinedSessions,
                row.current7Min.confirmedRatePct
              )}{" "}
              / 비결제자{" "}
              {fmtRateFraction(
                row.current7Min.droppedAboveSessions,
                row.droppedGa4JoinedSessions,
                row.current7Min.droppedRatePct
              )}
            </strong>
            <p>
              차이 {fmtPct(row.current7Min.liftPct)}. 이 차이가 작거나 표본이 작으면 7분은
              기본 KPI가 아니라 보조 신호로만 봅니다.
            </p>
          </div>

          <table className={styles.pageLongTable}>
            <thead>
              <tr>
                <th>기준</th>
                <th>구매자</th>
                <th>비결제자</th>
                <th>차이</th>
              </tr>
            </thead>
            <tbody>
              {row.thresholdRows
                .filter(
                  (threshold) =>
                    threshold.label === "2분" ||
                    threshold.label === "3분" ||
                    threshold.label === "7분"
                )
                .map((threshold) => (
                <tr key={threshold.label}>
                  <td>{threshold.label} 이상</td>
                  <td>
                    {fmtRateFraction(
                      threshold.confirmedAboveSessions,
                      row.confirmedGa4JoinedSessions,
                      threshold.confirmedRatePct
                    )}
                  </td>
                  <td>
                    {fmtRateFraction(
                      threshold.droppedAboveSessions,
                      row.droppedGa4JoinedSessions,
                      threshold.droppedRatePct
                    )}
                  </td>
                  <td>{fmtPct(threshold.liftPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </div>
  );
}

function FocusedPageLongComparison({
  rows,
  title = "고정 비교: 기본 2분 · 비교 3분 · 보조 7분",
  description = "아래 4개 유입은 필터 선택과 무관하게 항상 보여줍니다. 숫자가 60%, 40%, 20%처럼 딱 떨어지는 row는 표본이 작다는 뜻이라 “확정”이 아니라 “방향”으로만 읽습니다. 2분은 기본 선행지표, 3분은 비교값, 7분은 강한 관심 보조 신호로 분리해 봅니다.",
}: {
  rows: PageLongThresholdRow[];
  title?: string;
  description?: string;
}) {
  const thresholdLabels = ["2분", "3분", "7분"];
  return (
    <div className={styles.focusedPageLongBox}>
      <div className={styles.focusedPageLongIntro}>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <table className={styles.focusedPageLongTable}>
        <thead>
          <tr>
            <th>유입</th>
            <th>표본</th>
            {thresholdLabels.map((label) => (
              <th key={label}>{label} 이상</th>
            ))}
            <th>판정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.site}-${row.sourceGroup}-focused`}>
              <td>
                <strong>{row.siteLabel}</strong>
                <span>{row.sourceLabel}</span>
              </td>
              <td>
                구매자 {fmtCount(row.confirmedGa4JoinedSessions)}명 / 비결제자{" "}
                {fmtCount(row.droppedGa4JoinedSessions)}명
              </td>
              {thresholdLabels.map((label) => {
                const threshold = findThresholdRow(row, label);
                return (
                  <td key={`${row.site}-${row.sourceGroup}-${label}`}>
                    {threshold ? (
                      <>
                        <strong>
                          {fmtPct(threshold.confirmedRatePct)} /{" "}
                          {fmtPct(threshold.droppedRatePct)}
                        </strong>
                        <span>차이 {fmtPoint(threshold.liftPct)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
              <td>{focusedPageLongReading(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function googleAdsReadinessLabel(readiness: GoogleAdsAuditReadiness): string {
  if (readiness === "ok") return "UTM 있음";
  if (readiness === "verify_click_id_capture") return "클릭 ID 확인 필요";
  if (readiness === "gap") return "추적 단서 부족";
  return "광고 URL 없음";
}

function googleAdsReadinessClass(readiness: GoogleAdsAuditReadiness): string {
  if (readiness === "ok") return styles.high;
  if (readiness === "verify_click_id_capture") return styles.mid;
  return styles.low;
}

function landingCaptureLabel(status: LandingClickIdAudit["captureStatus"]): string {
  if (status === "google_click_id_present") return "클릭 ID 보존";
  if (status === "google_channel_without_click_id") return "Google 단서만 있음";
  if (status === "not_google_paid_search") return "Google 아님";
  if (status === "landing_rows_present_no_google_evidence") return "Google 단서 없음";
  if (status === "no_landing_rows") return "랜딩 row 없음";
  return "원장 확인 불가";
}

function landingCaptureClass(status: LandingClickIdAudit["captureStatus"]): string {
  if (status === "google_click_id_present") return styles.high;
  if (status === "google_channel_without_click_id") return styles.mid;
  if (status === "not_google_paid_search") return styles.mid;
  return styles.low;
}

function trafficRouteDecisionLabel(decision: GoogleAdsTrafficRouteAudit["decision"]): string {
  if (decision === "actual_google_paid_click_confirmed") return "실제 Google 유입 확인";
  if (decision === "ads_config_present_but_no_landing_evidence") return "설정 있음 · 실제 유입 증거 없음";
  if (decision === "paused_or_legacy_config_only") return "일시중지/과거 설정만 있음";
  if (decision === "landing_table_unavailable") return "랜딩 원장 확인 실패";
  return "Google 유입 증거 없음";
}

function trafficRouteDecisionClass(decision: GoogleAdsTrafficRouteAudit["decision"]): string {
  if (decision === "actual_google_paid_click_confirmed") return styles.high;
  if (decision === "ads_config_present_but_no_landing_evidence") return styles.mid;
  if (decision === "paused_or_legacy_config_only") return styles.mid;
  return styles.low;
}

function routeStepClass(status: GoogleAdsTrafficRouteAudit["routeSteps"][number]["status"]): string {
  if (status === "pass") return styles.high;
  if (status === "warn") return styles.mid;
  return styles.low;
}

function GooglePaidFinalUrlAuditPanel({
  audit,
  error,
}: {
  audit: GoogleAdsFinalUrlAuditResponse | null;
  error: string | null;
}) {
  const siteSummary = audit?.summary?.siteSummary ?? [];
  const landingAudit = audit?.summary?.landingClickIdAudit ?? [];
  const otherUrlSummary = audit?.summary?.otherUrlSummary ?? null;
  const biocom = siteSummary.find((row) => row.site === "biocom");
  const coffee = siteSummary.find((row) => row.site === "thecleancoffee");
  const biocomLanding = landingAudit.find((row) => row.site === "biocom");
  const coffeeLanding = landingAudit.find((row) => row.site === "thecleancoffee");
  const coffeeTrafficRoute = audit?.summary?.actualTrafficRouteAudit?.find(
    (row) => row.site === "thecleancoffee",
  );
  const rows = [
    {
      site: "바이오컴",
      googleAds: biocom,
      landing: biocomLanding,
    },
    {
      site: "더클린커피",
      googleAds: coffee,
      landing: coffeeLanding,
    },
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Google 유료 유입 미매핑 점검</h2>
      <p className={styles.sectionDesc}>
        Google Ads 최종 URL은 “광고를 누르면 사용자를 어디로 보내는지”입니다. 여기에
        UTM(광고 출처 이름표)이나 gclid/gbraid/wbraid(구글 클릭 식별자)가 살아 있어야
        VM Cloud가 Google 유료 유입으로 분류할 수 있습니다.
      </p>
      <div className={styles.compareCard}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>Google Ads API read-only audit</strong> · 계정{" "}
            {audit?.customer?.descriptiveName ?? "조회 중"} · 자동 태깅{" "}
            {audit?.autoTaggingEnabled === true
              ? "ON"
              : audit?.autoTaggingEnabled === false
                ? "OFF"
                : "확인 중"}
          </p>
          <span className={`${styles.trustBadge} ${error ? styles.low : audit ? styles.high : styles.mid}`}>
            {error ? "조회 실패" : audit ? "읽기 전용 확인" : "조회 중"}
          </span>
        </div>
        {error && (
          <p className={styles.compareSummary}>
            Google Ads 최종 URL audit API 응답을 받지 못했습니다: {error}. 아래 VM Cloud
            진단값은 마지막 read-only audit 결과를 기준으로 표시합니다.
          </p>
        )}
        <table className={styles.channelTable}>
	          <thead>
	            <tr>
	              <th>사이트</th>
	              <th>Google Ads 최종 URL row</th>
	              <th>UTM row</th>
	              <th>템플릿/URL suffix</th>
	              <th>VM Cloud landing row</th>
	              <th>판정</th>
	            </tr>
	          </thead>
          <tbody>
            {rows.map((row) => {
              const googleAds = row.googleAds;
              const readiness = googleAds?.readiness ?? "not_found";
              return (
	                <tr key={row.site}>
	                  <td className={styles.metricLabel}>
	                    {row.site}
	                    <span className={styles.metricHint}>
	                      {row.landing?.interpretation ??
	                        "VM Cloud landing 원장 응답을 기다리는 중입니다."}
	                    </span>
	                  </td>
	                  <td>{googleAds ? `${googleAds.rows}개 · URL ${googleAds.finalUrls}개` : "조회 중"}</td>
	                  <td>{googleAds ? `${googleAds.manualUtmRows}개` : "—"}</td>
                  <td>
                    {googleAds
                      ? `template ${googleAds.trackingTemplateRows} · suffix ${googleAds.finalUrlSuffixRows}`
	                      : "—"}
		                  </td>
		                  <td>
		                    {row.landing
		                      ? `전체 ${fmtCount(row.landing.totalLandingRows)} · 클릭ID ${fmtCount(row.landing.googleClickIdRows)} · 진짜 Google 단서 ${fmtCount(row.landing.googleEvidenceRows ?? 0)}`
		                      : "조회 중"}
		                    {row.landing && (
		                      <span className={styles.metricHint}>
		                        gclid {fmtCount(row.landing.googleClickIdRowsByType.gclid)} · gbraid{" "}
		                        {fmtCount(row.landing.googleClickIdRowsByType.gbraid)} · wbraid{" "}
		                        {fmtCount(row.landing.googleClickIdRowsByType.wbraid)} · Google 아님 paid_search{" "}
		                        {fmtCount(row.landing.nonGooglePaidSearchRows ?? 0)} · 최신{" "}
		                        {row.landing.latestLandingAt ?? "없음"}
		                      </span>
		                    )}
	                  </td>
	                  <td>
	                    <span className={`${styles.trustBadge} ${googleAdsReadinessClass(readiness)}`}>
	                      {googleAdsReadinessLabel(readiness)}
	                    </span>
	                    {row.landing && (
	                      <span className={`${styles.trustBadge} ${landingCaptureClass(row.landing.captureStatus)}`}>
	                        {landingCaptureLabel(row.landing.captureStatus)}
	                      </span>
	                    )}
	                    <span className={styles.metricHint}>
	                      {googleAds?.interpretation ??
	                        "Google Ads API 응답을 기다리는 중입니다. 응답 전까지는 VM Cloud capture gap 기준으로 봅니다."}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
	      </table>
	        {coffeeLanding && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>더클린커피 실제 Google Ads 클릭 ID 보존 여부</strong> · 최근{" "}
	                {coffeeLanding.windowDays}일 VM Cloud landing row {fmtCount(coffeeLanding.totalLandingRows)}건
	              </p>
	              <span className={`${styles.trustBadge} ${landingCaptureClass(coffeeLanding.captureStatus)}`}>
	                {landingCaptureLabel(coffeeLanding.captureStatus)}
	              </span>
	            </div>
		            <p className={styles.compareSummary}>
		              결론: 더클린커피는 landing row는 있지만 gclid/gbraid/wbraid가{" "}
		              <strong>{fmtCount(coffeeLanding.googleClickIdRows)}건</strong>입니다. 예전에는 paid_search
		              row를 Google 단서로 보았지만, 실제로는 Google-specific 값이{" "}
		              <strong>{fmtCount(coffeeLanding.googleEvidenceRows ?? 0)}건</strong>이고 Google이 아닌
		              다른 매체 paid_search가 {fmtCount(coffeeLanding.nonGooglePaidSearchRows ?? 0)}건입니다.
		              현재 판정은 “Google 유료 클릭 식별자가 VM Cloud에 잡히지 않는다”입니다.
		            </p>
		            <table className={styles.channelTable}>
		              <thead>
		                <tr>
		                  <th>분류</th>
		                  <th>row</th>
		                  <th>해석</th>
		                </tr>
		              </thead>
		              <tbody>
		                {(coffeeLanding.googleEvidenceBreakdown ?? []).map((bucket) => (
		                  <tr key={bucket.segment}>
		                    <td className={styles.metricLabel}>
		                      {bucket.label}
		                      <span className={styles.metricHint}>신뢰도 {bucket.confidence}</span>
		                    </td>
		                    <td>{fmtCount(bucket.rows)}</td>
		                    <td>{bucket.interpretation}</td>
		                  </tr>
		                ))}
		              </tbody>
		            </table>
		            <table className={styles.channelTable}>
		              <thead>
		                <tr>
		                  <th>랜딩 경로</th>
		                  <th>전체 row</th>
		                  <th>진짜 Google 단서 row</th>
		                </tr>
	              </thead>
	              <tbody>
	                {coffeeLanding.topLandingPaths.slice(0, 5).map((path) => (
	                  <tr key={path.path}>
	                    <td>{path.path || "/"}</td>
	                    <td>{fmtCount(path.rows)}</td>
	                    <td>{fmtCount(path.googleEvidenceRows)}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        {coffeeTrafficRoute && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>더클린커피 Google Ads 실제 유입 재확인 루트</strong> · 최근{" "}
	                {coffeeTrafficRoute.windowDays}일 · 신뢰도 {coffeeTrafficRoute.confidence}
	              </p>
	              <span
	                className={`${styles.trustBadge} ${trafficRouteDecisionClass(coffeeTrafficRoute.decision)}`}
	              >
	                {trafficRouteDecisionLabel(coffeeTrafficRoute.decision)}
	              </span>
	            </div>
	            <p className={styles.compareSummary}>
	              {coffeeTrafficRoute.interpretation} 광고 계정 설정값만 보고 Google 유입이라고
	              세지 않고, 실제 방문 원장에 Google 클릭 이름표가 남았는지까지 확인한 판정입니다.
	            </p>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>확인 단계</th>
	                  <th>증거</th>
	                  <th>해석</th>
	                </tr>
	              </thead>
	              <tbody>
	                {coffeeTrafficRoute.routeSteps.map((step) => (
	                  <tr key={step.step}>
	                    <td className={styles.metricLabel}>
	                      {step.label}
	                      <span className={`${styles.trustBadge} ${routeStepClass(step.status)}`}>
	                        {step.status === "pass" ? "확인" : step.status === "warn" ? "주의" : "미확인"}
	                      </span>
	                    </td>
	                    <td>{step.evidence}</td>
	                    <td>{step.interpretation}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>바로 다음 확인</th>
	                  <th>왜 필요한가</th>
	                  <th>성공 기준</th>
	                </tr>
	              </thead>
	              <tbody>
	                {coffeeTrafficRoute.nextActions.map((action, index) => (
	                  <tr key={`${action.owner}-${index}`}>
	                    <td className={styles.metricLabel}>
	                      {action.owner === "TJ" ? "TJ님" : "Codex"} · {action.action}
	                    </td>
	                    <td>{action.why}</td>
	                    <td>{action.successCriteria}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        {otherUrlSummary && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>Google Ads 최종 URL 기타 도메인 분류</strong> · other row{" "}
	                {fmtCount(otherUrlSummary.totalRows)}건 · URL {fmtCount(otherUrlSummary.finalUrls)}개
	              </p>
	              <span className={`${styles.trustBadge} ${styles.mid}`}>운영 검토용</span>
	            </div>
	            <p className={styles.compareSummary}>{otherUrlSummary.interpretation}</p>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>분류</th>
	                  <th>row</th>
	                  <th>의미</th>
	                </tr>
	              </thead>
	              <tbody>
	                {otherUrlSummary.dispositionSummary.map((row) => (
	                  <tr key={row.disposition}>
	                    <td>{row.label}</td>
	                    <td>{fmtCount(row.rows)}</td>
	                    <td>{row.interpretation}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>캠페인/광고그룹</th>
	                  <th>host</th>
	                  <th>분류 근거</th>
	                </tr>
	              </thead>
	              <tbody>
	                {otherUrlSummary.samples.slice(0, 8).map((sample, index) => (
	                  <tr key={`${sample.campaignName}-${sample.parentName}-${index}`}>
	                    <td className={styles.metricLabel}>
	                      {sample.campaignName}
	                      <span className={styles.metricHint}>
	                        {sample.parentName ?? "광고그룹 없음"} · campaign {sample.campaignStatus} · entity{" "}
	                        {sample.entityStatus}
	                      </span>
	                    </td>
	                    <td>{sample.hosts.join(", ") || "host 없음"}</td>
	                    <td>
	                      <span className={`${styles.trustBadge} ${
	                        sample.disposition === "ignore_external_or_legacy" ? styles.high : styles.mid
	                      }`}>
	                        {sample.dispositionLabel}
	                      </span>
	                      <span className={styles.metricHint}>{sample.reason}</span>
	                    </td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        <ul className={styles.caveatList}>
	          <li>
	            더클린커피가 Google 유료 0세션으로 보이면 “주문이 없다”가 아니라, 현재 VM Cloud
	            원장에 gclid/gbraid/wbraid 같은 광고 클릭 식별자가 남지 않는다는 뜻입니다.
	          </li>
          <li>
            Google Ads 계정에 더클린커피 최종 URL row가 없으면, 이 계정에서 더클린커피
            Google 광고를 집행하지 않거나 다른 광고 계정에 있을 가능성이 큽니다.
          </li>
          <li>
            최종 URL row는 있는데 UTM이 없으면, 실제 클릭 URL에서 자동 태깅 값이 살아남는지
            1건의 클릭 landing row로 확인해야 합니다. 운영 설정 변경은 이 화면에서 하지 않습니다.
          </li>
        </ul>
      </div>
    </section>
  );
}

function MissingCoffeeChannelCompare({ channel }: { channel: ChannelKey }) {
  return (
    <div className={styles.pageLongEmpty}>
      <strong>더클린커피 · {channelLabelKo(channel)} 비교표는 아직 확정 cohort가 없습니다.</strong>
      <p>
        특히 Google 유료는 이번 dry-run에서 VM Cloud가 Google 유료 세션을 0건으로 잡았습니다.
        실제 유입이 없는지, gclid/utm 값이 다른 source bucket으로 들어갔는지 먼저 확인해야
        결제자/비결제자 비교를 만들 수 있습니다.
      </p>
    </div>
  );
}

function BehaviorSourceGapPanel() {
  const sourceMeaningRows = [
    {
      title: "GA4 행동값",
      subtitle: "방문자가 실제 페이지에서 한 행동을 재는 값",
      body:
        "GA4 BigQuery의 engagement_time, scroll, view_item, begin_checkout 같은 이벤트를 VM Cloud 주문/세션과 safe key로 맞춘 값입니다. 콘텐츠와 랜딩이 얼마나 읽혔는지 판단할 때 더 적합합니다.",
      useFor: "선행지표, 상세페이지 품질, 채널별 구매자/비결제자 행동 비교",
    },
    {
      title: "VM 원장 metadata 값",
      subtitle: "우리 서버가 전환 단계마다 받은 스냅샷 값",
      body:
        "VM Cloud attribution ledger에 landing, payment_page_seen, payment_success 같은 row가 쌓일 때 함께 들어온 보조 필드입니다. 결제 단계가 어디까지 왔는지 빠르게 보는 데 좋지만, GA4처럼 전체 페이지 체류 행동을 계속 측정한 값은 아닙니다.",
      useFor: "실시간 전환 단계, CAPI 전송 상태, 결제완료/누락 큐 감시",
    },
  ];

  const sourceGapReasons = [
    {
      reason: "측정 목적이 다릅니다",
      detail:
        "GA4는 사용자가 페이지를 보는 동안 행동 이벤트를 계속 모읍니다. VM 원장은 전환 row가 생기는 순간의 payload를 저장하므로, 방문 전체 체류시간을 대표하지 않을 수 있습니다.",
    },
    {
      reason: "분모가 다를 수 있습니다",
      detail:
        "GA4 dry-run은 GA4와 VM이 같은 safe session으로 붙은 세션만 비교합니다. live API는 아직 VM 원장 row 중심이라 같은 사람/같은 주문 단위로 완전히 닫힌 모집단이 아닐 수 있습니다.",
    },
    {
      reason: "더클린커피는 live API에 GA4 행동 join이 아직 없습니다",
      detail:
        "그래서 live 화면에서는 체류시간이 비어 보이지만, 최신 GA4 dry-run에서는 더클린커피도 96~99% 수준으로 행동 데이터가 붙습니다.",
    },
    {
      reason: "업데이트 주기가 다릅니다",
      detail:
        "GA4 BigQuery 행동값은 별도 조회 또는 사전 계산이 필요합니다. VM 원장은 실시간에 가깝지만 행동 분석용으로 정제된 값은 아닙니다.",
    },
  ];

  const summaryRows = [
    {
      site: "바이오컴",
      confirmed: COHORT_SUMMARY.find(
        (row) => row.site === "biocom" && row.cohort === "confirmed_purchase"
      )!,
      dropped: COHORT_SUMMARY.find(
        (row) => row.site === "biocom" && row.cohort === "dropped_checkout"
      )!,
      liveGap: GA4_LIVE_API_BEHAVIOR_GAP.find((row) => row.site === "biocom")!,
    },
    {
      site: "더클린커피",
      confirmed: COHORT_SUMMARY.find(
        (row) => row.site === "thecleancoffee" && row.cohort === "confirmed_purchase"
      )!,
      dropped: COHORT_SUMMARY.find(
        (row) => row.site === "thecleancoffee" && row.cohort === "dropped_checkout"
      )!,
      liveGap: GA4_LIVE_API_BEHAVIOR_GAP.find((row) => row.site === "thecleancoffee")!,
    },
  ];

  const coverageRows = SAFE_BRIDGE_COVERAGE_AUDIT;
  const latestCoverageRows = coverageRows.filter((row) => row.windowLabel === "최근 7일");
  const stableCoverageRows = coverageRows.filter((row) => row.windowLabel === "최근 30일");

  return (
    <div className={styles.compareCard}>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>이번 재조회 결론</strong> · 최신 7일만 보면 GA4와 VM이 안 붙은 세션이
          바이오컴 {fmtPct(latestCoverageRows[0]?.notJoinedRatePct ?? null)}, 더클린커피{" "}
          {fmtPct(latestCoverageRows[1]?.notJoinedRatePct ?? null)}입니다. 다만 GA4 daily export가
          전일까지만 반영되어 생긴 신선도 차이가 크고, 최근 30일 안정 구간에서는 미연결이
          바이오컴 {fmtPct(stableCoverageRows[0]?.notJoinedRatePct ?? null)}, 더클린커피{" "}
          {fmtPct(stableCoverageRows[1]?.notJoinedRatePct ?? null)}까지 줄어듭니다.
        </p>
        <span className={`${styles.trustBadge} ${styles.high}`}>로컬 API 보강 완료</span>
      </div>

      <div className={styles.auditSubsection}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>두 숫자의 뜻부터 다릅니다</strong> · GA4 행동값은 “사람이 페이지에서
            실제로 무엇을 했는가”이고, VM 원장 metadata는 “우리 서버가 전환 단계에서 받은
            기록”입니다. 이름이 비슷해도 예산/콘텐츠 판단에 쓰는 값은 GA4 쪽입니다.
          </p>
          <span className={`${styles.trustBadge} ${styles.high}`}>용어 정리</span>
        </div>
        <div className={styles.headlineGrid}>
          {sourceMeaningRows.map((row) => (
            <div className={`${styles.headlineCard} ${styles.blue}`} key={row.title}>
              <span className={styles.headlineKicker}>{row.title}</span>
              <h3 className={styles.headlineTitle}>{row.subtitle}</h3>
              <p className={styles.headlineBody}>{row.body}</p>
              <p className={styles.headlineBody}>
                <strong>주로 볼 때:</strong> {row.useFor}
              </p>
            </div>
          ))}
          <div className={`${styles.headlineCard} ${styles.yellow}`}>
            <span className={styles.headlineKicker}>판단 원칙</span>
            <h3 className={styles.headlineTitle}>행동 분석은 GA4, 전송 감시는 VM</h3>
            <p className={styles.headlineBody}>
              “광고 유입자가 왜 사고/안 사는가”는 GA4 행동값으로 봅니다. “구매가 실제로
              Meta CAPI로 갔는가”는 VM 원장과 CAPI 로그로 봅니다.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.auditSubsection}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>GA4와 VM이 같은 세션으로 안 붙는 비율</strong> · 여기서 “안 붙음”은
            VM Cloud에는 결제 시작/결제완료 기록이 있는데, GA4 행동 기록과 같은 safe session
            key로 연결되지 않아 행동 분석에서 빠지는 세션이라는 뜻입니다. 결제 자체가 없다는
            뜻은 아닙니다.
          </p>
          <span className={`${styles.trustBadge} ${styles.mid}`}>bridge coverage</span>
        </div>
        <table className={styles.channelTable}>
          <thead>
            <tr>
              <th>사이트/기간</th>
              <th>VM 세션</th>
              <th>GA4 연결</th>
              <th>안 붙은 세션</th>
              <th>해석</th>
              <th>줄이는 방법</th>
            </tr>
          </thead>
          <tbody>
            {coverageRows.map((row: SafeBridgeCoverageAuditRow) => (
              <tr key={`${row.site}-${row.windowLabel}`}>
                <td className={styles.metricLabel}>
                  {row.siteLabel}
                  <span className={styles.metricHint}>
                    {row.windowLabel} · {row.checkedAtKst}
                  </span>
                </td>
                <td>
                  {fmtCount(row.vmSafeSessions)}
                  <span className={styles.metricHint}>
                    safe session 기준
                  </span>
                </td>
                <td>
                  {fmtCount(row.ga4JoinedSessions)} · {fmtPct(row.joinRatePct)}
                  <span className={styles.metricHint}>
                    결제자 {fmtPct(row.confirmedJoinRatePct)} / 비결제자{" "}
                    {fmtPct(row.droppedJoinRatePct)}
                  </span>
                </td>
                <td>
                  {fmtCount(row.notJoinedSessions)} · {fmtPct(row.notJoinedRatePct)}
                  <span className={styles.metricHint}>
                    GA4 latest {row.ga4LatestDailyTable}
                  </span>
                </td>
                <td>{row.interpretationKo}</td>
                <td>{row.nextActionKo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className={styles.caveatList}>
          <li>
            <strong>가장 큰 원인:</strong> 최신 7일은 VM Cloud가 오늘 row까지 갖고 있지만,
            GA4 BigQuery daily export는 전일 테이블까지만 있어 오늘 행동이 아직 못 붙습니다.
          </li>
          <li>
            <strong>구조적으로 남는 gap:</strong> 최근 30일 기준 미연결은 바이오컴 3.16%,
            더클린커피 2.91%입니다. 이 구간은 safe key 누락, 외부 결제 리다이렉트,
            동의/차단, source/window 차이로 더 쪼개야 합니다.
          </li>
          <li>
            <strong>추가 blind spot:</strong> VM row 자체에 safe key가 없어 세션 집계에
            못 들어간 row도 있습니다. 바이오컴은 7일 {fmtCount(latestCoverageRows[0]?.missingHashRows ?? 0)}
            row, 더클린커피는 7일 {fmtCount(latestCoverageRows[1]?.missingHashRows ?? 0)}
            row입니다. 이 값은 row 단위라 세션 미연결률과 직접 더하면 안 됩니다.
          </li>
        </ul>
      </div>

      <div className={styles.auditSubsection}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>왜 숫자가 다르게 보였나</strong> · 바이오컴 체류시간이 짧아진 것처럼
            보인 것은 구매 행동이 급락해서가 아니라, 기존 화면이 VM 원장 metadata를 먼저
            읽고 GA4 행동 snapshot을 직접 읽지 않았기 때문입니다.
          </p>
          <span className={`${styles.trustBadge} ${styles.mid}`}>원인 분해</span>
        </div>
        <table className={styles.channelTable}>
          <thead>
            <tr>
              <th>원인</th>
              <th>사람 말로 풀면</th>
            </tr>
          </thead>
          <tbody>
            {sourceGapReasons.map((row) => (
              <tr key={row.reason}>
                <td className={styles.metricLabel}>{row.reason}</td>
                <td>{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className={styles.channelTable}>
        <thead>
          <tr>
            <th>사이트</th>
            <th>live API 현재 값</th>
            <th>GA4 dry-run 값</th>
            <th>왜 다른가</th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.map((row) => (
            <tr key={row.site}>
              <td className={styles.metricLabel}>
                {row.site}
                <span className={styles.metricHint}>
                  GA4 연결 {fmtPct(row.confirmed.joinRatePct)} / {fmtPct(row.dropped.joinRatePct)}
                </span>
              </td>
              <td>
                결제자 {fmtSeconds(row.liveGap.liveApiBuyerP50Seconds)} · 비결제자{" "}
                {fmtSeconds(row.liveGap.liveApiNonBuyerP50Seconds)}
                <span className={styles.metricHint}>
                  source: {row.liveGap.liveApiBehaviorSource}
                </span>
              </td>
              <td>
                결제자 {fmtSeconds(row.liveGap.dryRunBuyerP50Seconds)} · 비결제자{" "}
                {fmtSeconds(row.liveGap.dryRunNonBuyerP50Seconds)}
                <span className={styles.metricHint}>
                  GA4 BigQuery engagement_time 기준
                </span>
              </td>
              <td>{row.liveGap.interpretationKo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.auditSubsection}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>사이트별 최신 7일 핵심 행동값</strong> · 실제 결제완료는 VM Cloud
            confirmed purchase, 행동은 GA4 BigQuery safe bridge 기준입니다.
          </p>
          <span className={`${styles.trustBadge} ${styles.high}`}>read-only dry-run</span>
        </div>
        <table className={styles.channelTable}>
          <thead>
            <tr>
              <th>사이트</th>
              <th>cohort</th>
              <th>safe session</th>
              <th>중앙 체류시간</th>
              <th>90% 스크롤</th>
              <th>긴 조회</th>
              <th>장바구니</th>
              <th>결제 시작</th>
              <th>결제수단 선택</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.flatMap((row) => [
              { site: row.site, label: "결제자", data: row.confirmed },
              { site: row.site, label: "비결제자", data: row.dropped },
            ]).map((row) => (
              <tr key={`${row.site}-${row.label}`}>
                <td className={styles.metricLabel}>{row.site}</td>
                <td>{row.label}</td>
                <td>{fmtCount(row.data.ga4JoinedSessions)}</td>
                <td>{fmtSeconds(row.data.p50EngagementSeconds)}</td>
                <td>{fmtPct(row.data.scroll90RatePct)}</td>
                <td>{fmtPct(row.data.pageViewLongRatePct)}</td>
                <td>{fmtPct(row.data.addToCartRatePct)}</td>
                <td>{fmtPct(row.data.beginCheckoutRatePct)}</td>
                <td>{fmtPct(row.data.addPaymentInfoRatePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={styles.caveatList}>
        <li>
          바이오컴 체류시간이 예전보다 확 짧아진 것처럼 보인 원인은 행동 변화가 아니라
          live API source 차이입니다. 최신 GA4 dry-run은 결제자 중앙 205.9초,
          비결제자 101.5초입니다.
        </li>
        <li>
          더클린커피 행동 공백은 “데이터가 없다”가 아니라 live API contract에 GA4 behavior
          snapshot이 아직 안 붙은 문제입니다. 최신 GA4 dry-run 값은 결제자 중앙 213.3초,
          비결제자 150.7초입니다.
        </li>
        <li>
          다음 API 보강은 BigQuery를 요청마다 직접 치지 않고, 4시간 또는 1일 단위로
          site × window × channel별 GA4 행동 snapshot을 미리 계산해 live API에 붙이는 방식이
          안전합니다. 최신 7일 화면은 GA4 export 지연을 별도로 표시해야 합니다.
        </li>
      </ul>
    </div>
  );
}

// 더클린커피 채널 1개를 buyer vs leaver 비교표로
function CoffeeChannelCompare({ row }: { row: CohortRow }) {
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>{row.channelLabel}</strong> 유입 · safe session {row.vmSafeSessions} ·
          결제율 {fmtPct(row.buyerRatePct)} · 결제금액 {fmtKRW(row.confirmedAmountKrw)}
        </p>
        <span
          className={`${styles.trustBadge} ${
            row.confidence === "high" ? styles.high : row.confidence === "medium" ? styles.mid : styles.low
          }`}
        >
          신뢰도 {row.confidence === "high" ? "높음" : row.confidence === "medium" ? "중간" : "낮음"}
        </span>
      </div>
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th>지표</th>
            <th>결제자</th>
            <th>비결제자</th>
            <th>차이</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.metricLabel}>
              유입 세션 / 결제 세션
              <span className={styles.metricHint}>safe session 기준</span>
            </td>
            <td>{row.confirmedPurchaseSessions}</td>
            <td>{row.droppedCheckoutSessions}</td>
            <td className={styles.deltaNeutral}>
              {row.confirmedPurchaseSessions - row.droppedCheckoutSessions > 0
                ? `+${row.confirmedPurchaseSessions - row.droppedCheckoutSessions}`
                : row.confirmedPurchaseSessions - row.droppedCheckoutSessions}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              중앙 체류시간
              <span className={styles.metricHint}>페이지에 머문 시간의 중간값</span>
            </td>
            <td>{fmtSeconds(row.buyerP50DwellSeconds)}</td>
            <td>{fmtSeconds(row.leaverP50DwellSeconds)}</td>
            <td>
              {dwellDeltaSeconds(row) !== null && (
                <span
                  className={
                    (dwellDeltaSeconds(row) as number) >= 0
                      ? styles.deltaPos
                      : styles.deltaNeg
                  }
                >
                  {(dwellDeltaSeconds(row) as number) >= 0 ? "+" : ""}
                  {dwellDeltaSeconds(row)?.toFixed(1)}초
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              90% 스크롤 도달률
              <span className={styles.metricHint}>포화면 구분력 없음</span>
            </td>
            <td>{fmtPct(row.buyerScroll90RatePct)}</td>
            <td>{fmtPct(row.leaverScroll90RatePct)}</td>
            <td className={styles.deltaNeutral}>—</td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              장바구니/장바구니 페이지 신호
              <span className={styles.metricHint}>비결제자가 더 높으면 단독 KPI 금지</span>
            </td>
            <td>{fmtPct(row.buyerCartSignalPct)}</td>
            <td>{fmtPct(row.leaverCartSignalPct)}</td>
            <td>
              {row.buyerCartSignalPct !== null && row.leaverCartSignalPct !== null && (
                <span
                  className={
                    row.buyerCartSignalPct - row.leaverCartSignalPct >= 0
                      ? styles.deltaPos
                      : styles.deltaNeg
                  }
                >
                  {row.buyerCartSignalPct - row.leaverCartSignalPct >= 0 ? "+" : ""}
                  {(row.buyerCartSignalPct - row.leaverCartSignalPct).toFixed(1)}p
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              결제 시작 · 결제수단 선택
              <span className={styles.metricHint}>
                begin_checkout은 보이고, add_payment_info는 아직 0%
              </span>
            </td>
            <td>
              결제 시작 {fmtPct(row.buyerBeginCheckoutRatePct)}
              <span className={styles.metricHint}>
                결제수단 {fmtPct(row.buyerAddPaymentInfoRatePct)}
              </span>
            </td>
            <td>
              결제 시작 {fmtPct(row.leaverBeginCheckoutRatePct)}
              <span className={styles.metricHint}>
                결제수단 {fmtPct(row.leaverAddPaymentInfoRatePct)}
              </span>
            </td>
            <td>
              {row.buyerBeginCheckoutRatePct !== null &&
              row.leaverBeginCheckoutRatePct !== null ? (
                <span
                  className={
                    row.buyerBeginCheckoutRatePct - row.leaverBeginCheckoutRatePct >= 0
                      ? styles.deltaPos
                      : styles.deltaNeg
                  }
                >
                  {row.buyerBeginCheckoutRatePct - row.leaverBeginCheckoutRatePct >= 0
                    ? "+"
                    : ""}
                  {(row.buyerBeginCheckoutRatePct - row.leaverBeginCheckoutRatePct).toFixed(1)}p
                </span>
              ) : (
                <span className={styles.deltaNeutral}>—</span>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              비결제 cohort 안의 GA4 purchase event
              <span className={styles.metricHint}>session/window mismatch 또는 늦은 결제</span>
            </td>
            <td colSpan={3}>{fmtPct(row.droppedWithGa4PurchaseEventPct)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

// 더클린커피 전체 (채널 = all) - cohort_summary 사용
function CoffeeAllCompare({
  confirmed,
  dropped,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
}) {
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>더클린커피 전체 채널</strong> · safe session{" "}
          {confirmed.vmSafeSessions + dropped.vmSafeSessions} · 결제율{" "}
          {fmtPct(
            (confirmed.vmSafeSessions /
              (confirmed.vmSafeSessions + dropped.vmSafeSessions)) *
              100
          )}{" "}
          · 결제금액 {fmtKRW(confirmed.amountKrw)}
        </p>
        <span className={`${styles.trustBadge} ${styles.high}`}>신뢰도 높음</span>
      </div>
      <CohortMetricsTable confirmed={confirmed} dropped={dropped} />
    </>
  );
}

// 바이오컴 전체 또는 Meta-only (낮은 join rate 경고 포함)
function BiocomCompare({
  confirmed,
  dropped,
  channel,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
  channel: ChannelKey;
}) {
  const isMetaOnly = channel === "meta";
  if (channel !== "all" && !isMetaOnly) {
    return (
      <div className={styles.pageLongEmpty}>
        <strong>바이오컴 · {channelLabelKo(channel)} 전체 행동 비교표는 아직 보류입니다.</strong>
        <p>
          지금 화면의 바이오컴 구매자/비결제자 상세 비교는 전체 또는 Meta-only 기준만
          신뢰할 수 있습니다. Google 유료와 YouTube는 위 “페이지 롱 뷰 기준 시간” 섹션에서
          표본 수를 먼저 확인하고, P1 live endpoint에서 채널별 cohort가 닫히면 전체 행동표로
          확장합니다.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>
            바이오컴 {channel === "all" ? "전체 채널" : channelLabelKo(channel)}
          </strong>{" "}
          · safe session {confirmed.vmSafeSessions + dropped.vmSafeSessions} · 결제율{" "}
          {fmtPct(
            (confirmed.vmSafeSessions /
              (confirmed.vmSafeSessions + dropped.vmSafeSessions)) *
              100
          )}{" "}
          · 결제금액 {fmtKRW(confirmed.amountKrw)}
        </p>
        <span className={`${styles.trustBadge} ${styles.mid}`}>
          신뢰도 보강 필요 (row-level join {fmtPct(confirmed.joinRatePct, 0)})
        </span>
      </div>
      <div className={styles.joinExplainBox}>
        <strong>row-level join {fmtPct(confirmed.joinRatePct, 0)}가 무슨 뜻인가?</strong>
        <p>
          VM Cloud가 “이 사람은 결제 완료/비결제”라고 분류한 방문 기록 100개 중 약{" "}
          {fmtPct(confirmed.joinRatePct, 0)}는 GA4의 행동 기록과 같은 방문으로 맞붙었다는
          뜻입니다. 쉽게 말해, 주문 장부와 행동 관찰 일지를 같은 사람 단위로 대조했을 때
          대부분은 짝을 찾았다는 의미입니다.
        </p>
        <p>
          그래도 “보강 필요”라고 쓰는 이유는 남은 약{" "}
          {fmtPct(100 - confirmed.joinRatePct, 0)}가 아직 못 붙었고, 채널별 표본이 작으면
          1~2명 차이만으로 비율이 크게 흔들릴 수 있기 때문입니다. 예산 판단은 VM 운영
          보고서를 기준으로 보고, 이 로컬 화면은 해석과 UI 확인용으로 보세요.
        </p>
      </div>
      {isMetaOnly && (
        <BiocomMetaThreeCohort />
      )}
      <CohortMetricsTable confirmed={confirmed} dropped={dropped} />
    </>
  );
}

function BiocomMetaThreeCohort() {
  const split = BIOCOM_META_COHORT_SPLIT;

  return (
    <div className={styles.cohortSplitBox}>
      <p className={styles.compareSummary}>
        <strong>바이오컴 Meta-only 3개 cohort</strong> · safe session{" "}
        {split.vmMetaSafeSessions} · GA4 연결 {split.ga4JoinedSessions} (
        {fmtPct(split.joinRatePct)}) · 기준 {split.checkedAtKst}
      </p>
      <div className={styles.cohortSplitGrid}>
        <div className={`${styles.cohortSplitCard} ${styles.greenSoft}`}>
          <span>확정 구매자</span>
          <strong>{split.confirmedBuyerSessions}</strong>
          <p>VM Cloud confirmed purchase 로 닫힌 세션입니다.</p>
        </div>
        <div className={`${styles.cohortSplitCard} ${styles.slateSoft}`}>
          <span>순수 비결제자</span>
          <strong>{split.checkoutNonBuyerSessions}</strong>
          <p>VM confirmed purchase 도 GA4 purchase 도 없는 비교 기준입니다.</p>
        </div>
        <div className={`${styles.cohortSplitCard} ${styles.yellowSoft}`}>
          <span>GA4 purchase 충돌</span>
          <strong>{split.ga4PurchaseConflictSessions}</strong>
          <p>순수 비결제자 평균에서 제외합니다 · {fmtPct(split.ga4PurchaseConflictRatePct)}.</p>
        </div>
      </div>
      <ul className={styles.reasonList}>
        {split.conflictReasonBuckets.map((reason) => (
          <li key={reason.bucket}>
            <strong>{reason.count}건</strong> · {reason.label}
          </li>
        ))}
      </ul>
      <p className={styles.compareSummary}>{split.interpretationKo}</p>
    </div>
  );
}

function CohortMetricsTable({
  confirmed,
  dropped,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
}) {
  const rows: Array<{
    label: string;
    hint?: string;
    buyer: string;
    leaver: string;
    delta?: string;
    deltaPos?: boolean;
  }> = [
    {
      label: "safe session 수",
      hint: "GA4·VM 같은 사람으로 연결된 세션만",
      buyer: String(confirmed.vmSafeSessions),
      leaver: String(dropped.vmSafeSessions),
    },
    {
      label: "GA4 연결률",
      hint: "행동 비교 신뢰도",
      buyer: fmtPct(confirmed.joinRatePct),
      leaver: fmtPct(dropped.joinRatePct),
    },
    {
      label: "중앙 체류시간",
      hint: "페이지에 머문 시간의 중간값",
      buyer: fmtSeconds(confirmed.p50EngagementSeconds),
      leaver: fmtSeconds(dropped.p50EngagementSeconds),
      delta: `${(confirmed.p50EngagementSeconds - dropped.p50EngagementSeconds).toFixed(1)}초`,
      deltaPos: confirmed.p50EngagementSeconds >= dropped.p50EngagementSeconds,
    },
    {
      label: "90% 스크롤 도달률",
      buyer: fmtPct(confirmed.scroll90RatePct),
      leaver: fmtPct(dropped.scroll90RatePct),
      delta: `${(confirmed.scroll90RatePct - dropped.scroll90RatePct).toFixed(1)}p`,
      deltaPos: confirmed.scroll90RatePct >= dropped.scroll90RatePct,
    },
    {
      label: "상품 상세 도달",
      buyer: fmtPct(confirmed.viewItemRatePct),
      leaver: fmtPct(dropped.viewItemRatePct),
      delta: `${(confirmed.viewItemRatePct - dropped.viewItemRatePct).toFixed(1)}p`,
      deltaPos: confirmed.viewItemRatePct >= dropped.viewItemRatePct,
    },
    {
      label: "장바구니 신호",
      hint: "단독 KPI 금지",
      buyer: fmtPct(confirmed.addToCartRatePct),
      leaver: fmtPct(dropped.addToCartRatePct),
      delta: `${(confirmed.addToCartRatePct - dropped.addToCartRatePct).toFixed(1)}p`,
      deltaPos: confirmed.addToCartRatePct >= dropped.addToCartRatePct,
    },
    {
      label: "결제 시작 (begin_checkout)",
      hint: "더클린커피는 GA4 export 적재 후 채워짐",
      buyer: fmtPct(confirmed.beginCheckoutRatePct),
      leaver: fmtPct(dropped.beginCheckoutRatePct),
      delta: `${(confirmed.beginCheckoutRatePct - dropped.beginCheckoutRatePct).toFixed(1)}p`,
      deltaPos: confirmed.beginCheckoutRatePct >= dropped.beginCheckoutRatePct,
    },
    {
      label: "결제수단 선택 (add_payment_info)",
      buyer: fmtPct(confirmed.addPaymentInfoRatePct),
      leaver: fmtPct(dropped.addPaymentInfoRatePct),
      delta: `${(confirmed.addPaymentInfoRatePct - dropped.addPaymentInfoRatePct).toFixed(1)}p`,
      deltaPos: confirmed.addPaymentInfoRatePct >= dropped.addPaymentInfoRatePct,
    },
  ];
  return (
    <table className={styles.compareTable}>
      <thead>
        <tr>
          <th>지표</th>
          <th>결제자</th>
          <th>비결제자</th>
          <th>차이</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className={styles.metricLabel}>
              {r.label}
              {r.hint && <span className={styles.metricHint}>{r.hint}</span>}
            </td>
            <td>{r.buyer}</td>
            <td>{r.leaver}</td>
            <td>
              {r.delta ? (
                <span className={r.deltaPos ? styles.deltaPos : styles.deltaNeg}>
                  {r.deltaPos && !r.delta.startsWith("-") ? "+" : ""}
                  {r.delta}
                </span>
              ) : (
                <span className={styles.deltaNeutral}>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndicatorRanking({
  indicators,
  fallbackIndicators,
  loading,
  error,
  cache,
}: {
  indicators: LeadingIndicatorItem[];
  fallbackIndicators: LeadingIndicatorItem[];
  loading: boolean;
  error: string | null;
  cache: LeadingIndicatorsApiResponse["cache"] | null;
}) {
  const cards = indicators.length > 0 ? indicators.slice(0, 5) : fallbackIndicators.slice(0, 5);
  const sourceLine =
    indicators.length > 0
      ? `VM Cloud live API 기준 · ${cache?.cached ? "사전 계산 cache" : "실시간 계산"}${
          cache?.cached_at_kst ? ` · 데이터 기준 ${cache.cached_at_kst}` : ""
        }${cache?.generation_ms ? ` · 계산 ${cache.generation_ms}ms` : ""}`
      : "API 응답이 없을 때만 쓰는 화면 내 예비 계산값입니다. 운영 판단은 VM Cloud live API 값을 우선합니다.";

  if (loading && cards.length === 0) {
    return (
      <div className={styles.indicatorGrid}>
        <div className={styles.indicatorCard}>
          <div className={styles.indicatorHeader}>
            <h3 className={styles.indicatorName}>선행지표 점수 계산 중</h3>
            <span className={`${styles.statusBadge} ${styles.parked}`}>조회 중</span>
          </div>
          <p className={styles.indicatorWhy}>
            VM Cloud가 구매자와 비결제자의 행동 차이를 점수화한 Top 5를 읽고 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.indicatorSourceLine}>
        <span>{sourceLine}</span>
        {loading && <strong>새로고침 중</strong>}
        {error && <strong className={styles.indicatorError}>API 확인 실패: {error}</strong>}
      </div>
      {indicators.length === 0 && !error && (
        <p className={styles.indicatorFallbackNote}>
          아직 live API 값이 비어 있어 현재 화면의 cohort summary로 임시 Top 5를 계산했습니다.
        </p>
      )}
      <div className={styles.indicatorGrid}>
        {cards.map((item, index) => {
          const statusClass = indicatorStatusClass(item.status);
          const kpiRole = indicatorKpiRole(item);
          const playbook = indicatorPlaybook(item);
          const components = item.score_components ?? {};
          return (
            <div key={item.id || item.label} className={styles.indicatorCard}>
              <div className={styles.indicatorHeader}>
                <div className={styles.indicatorTitleBlock}>
                  <span className={styles.indicatorRank}>
                    #{item.rank ?? index + 1}
                  </span>
                  <h3 className={styles.indicatorName}>{item.label}</h3>
                </div>
                <div className={styles.indicatorScore}>
                  <strong>{fmtScore(item.score)}</strong>
                  <span>점</span>
                </div>
              </div>
              <div className={styles.indicatorMetaLine}>
                <span className={`${styles.kpiRole} ${indicatorKpiRoleClass(kpiRole)}`}>
                  {indicatorKpiRoleLabel(kpiRole)}
                </span>
                <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
                  {indicatorStatusLabel(item.status)}
                </span>
                {item.score_grade && <span>등급 {item.score_grade}</span>}
                <span>표본 {fmtCount(item.sample_sessions)}명</span>
                {item.known_coverage_pct !== null && (
                  <span>확인 가능 {fmtPct(item.known_coverage_pct)}</span>
                )}
              </div>
              <div className={styles.indicatorNumberGrid}>
                <div>
                  <span>구매자</span>
                  <strong>{fmtIndicatorValue(item.buyer_value, item.unit)}</strong>
                </div>
                <div>
                  <span>비결제자</span>
                  <strong>{fmtIndicatorValue(item.non_buyer_value, item.unit)}</strong>
                </div>
                <div>
                  <span>차이</span>
                  <strong>{fmtIndicatorDelta(item.delta, item.unit)}</strong>
                </div>
              </div>
              <p className={styles.indicatorWhy}>
                <strong>왜:</strong>{" "}
                {item.interpretation_ko ||
                  "구매자와 비결제자 사이에 차이가 있어 선행지표 후보로 관리할 수 있습니다."}
              </p>
              <p className={styles.indicatorAction}>
                <strong>다음 액션:</strong>{" "}
                {item.next_action_ko ||
                  "이 지표를 단독 목표로 쓰기 전에 표본 수와 다른 행동 지표를 함께 확인합니다."}
              </p>
              <div className={styles.indicatorPlaybook}>
                <strong>공략집</strong>
                <ul>
                  <li>
                    <span>무엇</span>
                    {playbook.what}
                  </li>
                  <li>
                    <span>어떻게</span>
                    {playbook.how}
                  </li>
                  <li>
                    <span>왜</span>
                    {playbook.why}
                  </li>
                  <li>
                    <span>성공 기준</span>
                    {playbook.successCriteria}
                  </li>
                </ul>
              </div>
              {item.data_quality_note_ko && (
                <p className={styles.indicatorQuality}>
                  <strong>주의:</strong> {item.data_quality_note_ko}
                </p>
              )}
              <div className={styles.indicatorComponents}>
                {[
                  ["구분력", components.lift],
                  ["표본", components.volume],
                  ["신뢰도", components.confidence],
                  ["관리 가능성", components.controllability],
                  ["감점", components.risk_penalty],
                ].map(([label, value]) => (
                  <span key={label as string} className={styles.indicatorComponent}>
                    {label}: {typeof value === "number" ? value.toFixed(1) : "—"}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CoffeeChannelTable({ rows }: { rows: CohortRow[] }) {
  return (
    <table className={styles.channelTable}>
      <thead>
        <tr>
          <th>채널</th>
          <th>safe session</th>
          <th>결제율</th>
          <th>결제금액</th>
          <th>결제자 체류시간</th>
          <th>비결제자 체류시간</th>
          <th>차이</th>
          <th>장바구니 결제자/비결제자</th>
          <th>해석</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const delta = dwellDeltaSeconds(r);
          let read = "체류시간 차이 작음 — 결제 시작/장바구니 같이 보기";
          if (r.channel === "google_paid" && r.confirmedPurchaseSessions === 0) {
            read = "Google 유료 표본 부족 — 추적은 보류";
          } else if (delta !== null && delta < 0) {
            read = "비결제자가 더 오래 봄 — 체류시간 단독 KPI 금지";
          } else if (delta !== null && delta >= 100) {
            read = "결제자가 훨씬 오래 봄 — 랜딩/리뷰 후보";
          } else if (delta !== null && delta >= 30) {
            read = "결제자 체류시간 우위 — 보조 후보";
          } else if (r.channel === "direct_or_unknown") {
            read = "결제 수 큼 — 유입 분류 attribution 보강 후보";
          } else if (r.channel === "naver_other") {
            read = "표본 작음 — 방향성만";
          }
          return (
            <tr key={r.channel}>
              <td className={styles.metricLabel}>{r.channelLabel}</td>
              <td>{r.vmSafeSessions}</td>
              <td>{fmtPct(r.buyerRatePct)}</td>
              <td>{fmtKRW(r.confirmedAmountKrw)}</td>
              <td>{fmtSeconds(r.buyerP50DwellSeconds)}</td>
              <td>{fmtSeconds(r.leaverP50DwellSeconds)}</td>
              <td>
                {delta !== null && (
                  <span className={delta >= 0 ? styles.deltaPos : styles.deltaNeg}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}초
                  </span>
                )}
              </td>
              <td>
                {fmtPct(r.buyerCartSignalPct)} / {fmtPct(r.leaverCartSignalPct)}
              </td>
              <td>{read}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TrustCard({
  name,
  level,
  source,
  crossCheck,
  window,
  freshness,
  joinRatePct,
  confidence,
  note,
}: {
  name: string;
  level: "high" | "mid" | "low";
  source: string;
  crossCheck: string;
  window: string;
  freshness: string;
  joinRatePct: number;
  confidence: string;
  note: string;
}) {
  const levelLabel = level === "high" ? "행동 비교 가능" : level === "mid" ? "보강 필요" : "사용 금지";
  return (
    <div className={styles.trustCard}>
      <div className={styles.trustHead}>
        <h3 className={styles.trustName}>{name}</h3>
        <span className={`${styles.trustBadge} ${styles[level]}`}>{levelLabel}</span>
      </div>
      <dl>
        <dt>source</dt>
        <dd>{source}</dd>
        <dt>cross-check</dt>
        <dd>{crossCheck}</dd>
        <dt>window</dt>
        <dd>{window}</dd>
        <dt>freshness</dt>
        <dd>{freshness}</dd>
        <dt>GA4 join rate</dt>
        <dd>{fmtPct(joinRatePct)}</dd>
        <dt>결제완료 기준</dt>
        <dd>VM Cloud confirmed purchase</dd>
        <dt>confidence</dt>
        <dd>{confidence}</dd>
      </dl>
      <p className={styles.trustNote}>{note}</p>
    </div>
  );
}
