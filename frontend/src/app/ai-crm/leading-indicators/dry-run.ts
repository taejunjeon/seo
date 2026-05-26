// P0 정적 fallback 데이터.
// 최신 재조회 기준:
//   data/project/ga4-vm-row-level-safe-bridge-dry-run-20260526-7d.json
//   data/project/ga4-vm-row-level-safe-bridge-dry-run-20260526-30d.json
//   data/project/coffee-channel-cohort-truth-table-20260525.json
//   data/project/page-long-threshold-fit-dry-run-20260525.json
//   data/project/biocom-meta-only-buyer-leaver-truth-table-20260525.json
// 운영 endpoint 가 GA4 행동 join 을 직접 내려주기 전까지 화면에는
// "샘플/최근 dry-run 기준" 배지를 노출한다.

export type CohortRow = {
  channel: string;
  channelLabel: string;
  vmSafeSessions: number;
  ga4JoinedSessions: number;
  joinRatePct: number;
  confirmedPurchaseSessions: number;
  droppedCheckoutSessions: number;
  confirmedAmountKrw: number;
  buyerRatePct: number;
  buyerP50DwellSeconds: number | null;
  leaverP50DwellSeconds: number | null;
  buyerScroll90RatePct: number | null;
  leaverScroll90RatePct: number | null;
  buyerCartSignalPct: number | null;
  leaverCartSignalPct: number | null;
  buyerBeginCheckoutRatePct: number | null;
  leaverBeginCheckoutRatePct: number | null;
  buyerAddPaymentInfoRatePct: number | null;
  leaverAddPaymentInfoRatePct: number | null;
  droppedWithGa4PurchaseEventPct: number | null;
  confidence: "high" | "medium" | "low";
};

export type CohortSummary = {
  site: "biocom" | "thecleancoffee";
  cohort: "confirmed_purchase" | "dropped_checkout";
  vmSafeSessions: number;
  ga4JoinedSessions: number;
  joinRatePct: number;
  amountKrw: number;
  p50EngagementSeconds: number;
  p75EngagementSeconds: number;
  scroll90RatePct: number;
  pageViewLongRatePct: number;
  viewItemRatePct: number;
  addToCartRatePct: number;
  beginCheckoutRatePct: number;
  addPaymentInfoRatePct: number;
  ga4PurchaseEventRatePct: number;
};

export type ReadinessRow = {
  site: "biocom" | "thecleancoffee";
  displayName: string;
  status: string;
  interpretationKo: string;
};

export type PageLongThresholdRow = {
  site: "biocom" | "thecleancoffee";
  siteLabel: string;
  sourceGroup: "meta" | "google_paid" | "youtube" | "organic";
  sourceLabel: string;
  vmSafeSessions: number;
  confirmedGa4JoinedSessions: number;
  droppedGa4JoinedSessions: number;
  joinRatePct: number | null;
  recommendedThresholdLabel: string | null;
  recommendationStatus:
    | "seven_minutes_too_strict_for_primary_indicator"
    | "seven_minutes_usable_as_high_intent_indicator"
    | "seven_minutes_candidate"
    | "shorter_threshold_better_for_primary_indicator"
    | "no_threshold_available"
    | "insufficient_sample";
  current7Min: {
    confirmedAboveSessions: number;
    droppedAboveSessions: number;
    confirmedRatePct: number | null;
    droppedRatePct: number | null;
    liftPct: number | null;
  };
  thresholdRows: Array<{
    label: string;
    confirmedAboveSessions: number;
    droppedAboveSessions: number;
    confirmedRatePct: number | null;
    droppedRatePct: number | null;
    liftPct: number | null;
  }>;
};

export type LiveApiBehaviorGapRow = {
  site: "biocom" | "thecleancoffee";
  siteLabel: string;
  channel: "meta";
  dryRunBuyerP50Seconds: number;
  dryRunNonBuyerP50Seconds: number;
  liveApiBuyerP50Seconds: number | null;
  liveApiNonBuyerP50Seconds: number | null;
  dryRunJoinRatePct: number;
  liveApiBehaviorSource: "vm_ledger_metadata" | "missing_ga4_behavior";
  interpretationKo: string;
};

export type SafeBridgeCoverageAuditRow = {
  site: "biocom" | "thecleancoffee";
  siteLabel: string;
  windowLabel: "최근 7일" | "최근 30일";
  checkedAtKst: string;
  ga4LatestDailyTable: string;
  vmSafeSessions: number;
  ga4JoinedSessions: number;
  notJoinedSessions: number;
  joinRatePct: number;
  notJoinedRatePct: number;
  confirmedJoinRatePct: number;
  droppedJoinRatePct: number;
  missingHashRows: number;
  stableBaselineNotJoinedRatePct: number | null;
  interpretationKo: string;
  nextActionKo: string;
};

const CHANNEL_LABEL_KO: Record<string, string> = {
  meta: "Meta",
  youtube: "YouTube",
  naver_paid_or_brand: "네이버 paid/brand",
  naver_other: "네이버 기타",
  direct_or_unknown: "직접/불명",
  organic: "오가닉",
  google_paid: "Google 유료",
  other: "기타",
};

export function channelLabelKo(key: string): string {
  return CHANNEL_LABEL_KO[key] ?? key;
}

// page-long threshold fit dry-run · rolling latest 7d (2026-05-26 00:13 KST)
// "페이지 롱 뷰"는 방문자가 몇 분 이상 머물렀는지 보는 선행지표 후보이다.
export const PAGE_LONG_THRESHOLD_FIT: PageLongThresholdRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "meta",
    sourceLabel: "Meta 광고",
    vmSafeSessions: 225,
    confirmedGa4JoinedSessions: 112,
    droppedGa4JoinedSessions: 65,
    joinRatePct: 78.67,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 19,
      droppedAboveSessions: 4,
      confirmedRatePct: 16.96,
      droppedRatePct: 6.15,
      liftPct: 10.81,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 99, droppedAboveSessions: 45, confirmedRatePct: 88.39, droppedRatePct: 69.23, liftPct: 19.16 },
      { label: "2분", confirmedAboveSessions: 87, droppedAboveSessions: 33, confirmedRatePct: 77.68, droppedRatePct: 50.77, liftPct: 26.91 },
      { label: "3분", confirmedAboveSessions: 62, droppedAboveSessions: 20, confirmedRatePct: 55.36, droppedRatePct: 30.77, liftPct: 24.59 },
      { label: "4분", confirmedAboveSessions: 47, droppedAboveSessions: 17, confirmedRatePct: 41.96, droppedRatePct: 26.15, liftPct: 15.81 },
      { label: "5분", confirmedAboveSessions: 33, droppedAboveSessions: 13, confirmedRatePct: 29.46, droppedRatePct: 20, liftPct: 9.46 },
      { label: "6분", confirmedAboveSessions: 24, droppedAboveSessions: 8, confirmedRatePct: 21.43, droppedRatePct: 12.31, liftPct: 9.12 },
      { label: "7분", confirmedAboveSessions: 19, droppedAboveSessions: 4, confirmedRatePct: 16.96, droppedRatePct: 6.15, liftPct: 10.81 },
      { label: "10분", confirmedAboveSessions: 10, droppedAboveSessions: 2, confirmedRatePct: 8.93, droppedRatePct: 3.08, liftPct: 5.85 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "google_paid",
    sourceLabel: "Google 유료",
    vmSafeSessions: 11,
    confirmedGa4JoinedSessions: 2,
    droppedGa4JoinedSessions: 9,
    joinRatePct: 100,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 1,
      droppedAboveSessions: 1,
      confirmedRatePct: 50,
      droppedRatePct: 11.11,
      liftPct: 38.89,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 2, droppedAboveSessions: 3, confirmedRatePct: 100, droppedRatePct: 33.33, liftPct: 66.67 },
      { label: "2분", confirmedAboveSessions: 2, droppedAboveSessions: 2, confirmedRatePct: 100, droppedRatePct: 22.22, liftPct: 77.78 },
      { label: "3분", confirmedAboveSessions: 2, droppedAboveSessions: 2, confirmedRatePct: 100, droppedRatePct: 22.22, liftPct: 77.78 },
      { label: "4분", confirmedAboveSessions: 1, droppedAboveSessions: 2, confirmedRatePct: 50, droppedRatePct: 22.22, liftPct: 27.78 },
      { label: "5분", confirmedAboveSessions: 1, droppedAboveSessions: 2, confirmedRatePct: 50, droppedRatePct: 22.22, liftPct: 27.78 },
      { label: "6분", confirmedAboveSessions: 1, droppedAboveSessions: 1, confirmedRatePct: 50, droppedRatePct: 11.11, liftPct: 38.89 },
      { label: "7분", confirmedAboveSessions: 1, droppedAboveSessions: 1, confirmedRatePct: 50, droppedRatePct: 11.11, liftPct: 38.89 },
      { label: "10분", confirmedAboveSessions: 1, droppedAboveSessions: 1, confirmedRatePct: 50, droppedRatePct: 11.11, liftPct: 38.89 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "youtube",
    sourceLabel: "YouTube",
    vmSafeSessions: 11,
    confirmedGa4JoinedSessions: 3,
    droppedGa4JoinedSessions: 8,
    joinRatePct: 100,
    recommendedThresholdLabel: "10분",
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 2,
      droppedAboveSessions: 4,
      confirmedRatePct: 66.67,
      droppedRatePct: 50,
      liftPct: 16.67,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 3, droppedAboveSessions: 7, confirmedRatePct: 100, droppedRatePct: 87.5, liftPct: 12.5 },
      { label: "2분", confirmedAboveSessions: 3, droppedAboveSessions: 7, confirmedRatePct: 100, droppedRatePct: 87.5, liftPct: 12.5 },
      { label: "3분", confirmedAboveSessions: 3, droppedAboveSessions: 6, confirmedRatePct: 100, droppedRatePct: 75, liftPct: 25 },
      { label: "4분", confirmedAboveSessions: 3, droppedAboveSessions: 6, confirmedRatePct: 100, droppedRatePct: 75, liftPct: 25 },
      { label: "5분", confirmedAboveSessions: 2, droppedAboveSessions: 5, confirmedRatePct: 66.67, droppedRatePct: 62.5, liftPct: 4.17 },
      { label: "6분", confirmedAboveSessions: 2, droppedAboveSessions: 5, confirmedRatePct: 66.67, droppedRatePct: 62.5, liftPct: 4.17 },
      { label: "7분", confirmedAboveSessions: 2, droppedAboveSessions: 4, confirmedRatePct: 66.67, droppedRatePct: 50, liftPct: 16.67 },
      { label: "10분", confirmedAboveSessions: 2, droppedAboveSessions: 2, confirmedRatePct: 66.67, droppedRatePct: 25, liftPct: 41.67 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "organic",
    sourceLabel: "오가닉",
    vmSafeSessions: 3,
    confirmedGa4JoinedSessions: 0,
    droppedGa4JoinedSessions: 3,
    joinRatePct: 100,
    recommendedThresholdLabel: null,
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 0,
      droppedAboveSessions: 1,
      confirmedRatePct: null,
      droppedRatePct: 33.33,
      liftPct: null,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 0, droppedAboveSessions: 3, confirmedRatePct: null, droppedRatePct: 100, liftPct: null },
      { label: "2분", confirmedAboveSessions: 0, droppedAboveSessions: 2, confirmedRatePct: null, droppedRatePct: 66.67, liftPct: null },
      { label: "3분", confirmedAboveSessions: 0, droppedAboveSessions: 2, confirmedRatePct: null, droppedRatePct: 66.67, liftPct: null },
      { label: "4분", confirmedAboveSessions: 0, droppedAboveSessions: 2, confirmedRatePct: null, droppedRatePct: 66.67, liftPct: null },
      { label: "5분", confirmedAboveSessions: 0, droppedAboveSessions: 1, confirmedRatePct: null, droppedRatePct: 33.33, liftPct: null },
      { label: "6분", confirmedAboveSessions: 0, droppedAboveSessions: 1, confirmedRatePct: null, droppedRatePct: 33.33, liftPct: null },
      { label: "7분", confirmedAboveSessions: 0, droppedAboveSessions: 1, confirmedRatePct: null, droppedRatePct: 33.33, liftPct: null },
      { label: "10분", confirmedAboveSessions: 0, droppedAboveSessions: 1, confirmedRatePct: null, droppedRatePct: 33.33, liftPct: null },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "meta",
    sourceLabel: "Meta 광고",
    vmSafeSessions: 97,
    confirmedGa4JoinedSessions: 35,
    droppedGa4JoinedSessions: 46,
    joinRatePct: 83.51,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 8,
      droppedAboveSessions: 6,
      confirmedRatePct: 22.86,
      droppedRatePct: 13.04,
      liftPct: 9.82,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 31, droppedAboveSessions: 39, confirmedRatePct: 88.57, droppedRatePct: 84.78, liftPct: 3.79 },
      { label: "2분", confirmedAboveSessions: 25, droppedAboveSessions: 27, confirmedRatePct: 71.43, droppedRatePct: 58.7, liftPct: 12.73 },
      { label: "3분", confirmedAboveSessions: 20, droppedAboveSessions: 26, confirmedRatePct: 57.14, droppedRatePct: 56.52, liftPct: 0.62 },
      { label: "4분", confirmedAboveSessions: 15, droppedAboveSessions: 20, confirmedRatePct: 42.86, droppedRatePct: 43.48, liftPct: -0.62 },
      { label: "5분", confirmedAboveSessions: 13, droppedAboveSessions: 16, confirmedRatePct: 37.14, droppedRatePct: 34.78, liftPct: 2.36 },
      { label: "6분", confirmedAboveSessions: 11, droppedAboveSessions: 11, confirmedRatePct: 31.43, droppedRatePct: 23.91, liftPct: 7.52 },
      { label: "7분", confirmedAboveSessions: 8, droppedAboveSessions: 6, confirmedRatePct: 22.86, droppedRatePct: 13.04, liftPct: 9.82 },
      { label: "10분", confirmedAboveSessions: 5, droppedAboveSessions: 3, confirmedRatePct: 14.29, droppedRatePct: 6.52, liftPct: 7.77 },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "google_paid",
    sourceLabel: "Google 유료",
    vmSafeSessions: 4,
    confirmedGa4JoinedSessions: 0,
    droppedGa4JoinedSessions: 4,
    joinRatePct: 100,
    recommendedThresholdLabel: null,
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 0,
      droppedAboveSessions: 0,
      confirmedRatePct: null,
      droppedRatePct: 0,
      liftPct: null,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 0, droppedAboveSessions: 1, confirmedRatePct: null, droppedRatePct: 25, liftPct: null },
      { label: "2분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "3분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "4분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "5분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "6분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "7분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
      { label: "10분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: 0, liftPct: null },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "youtube",
    sourceLabel: "YouTube",
    vmSafeSessions: 13,
    confirmedGa4JoinedSessions: 7,
    droppedGa4JoinedSessions: 5,
    joinRatePct: 92.31,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 1,
      droppedAboveSessions: 0,
      confirmedRatePct: 14.29,
      droppedRatePct: 0,
      liftPct: 14.29,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 7, droppedAboveSessions: 5, confirmedRatePct: 100, droppedRatePct: 100, liftPct: 0 },
      { label: "2분", confirmedAboveSessions: 5, droppedAboveSessions: 3, confirmedRatePct: 71.43, droppedRatePct: 60, liftPct: 11.43 },
      { label: "3분", confirmedAboveSessions: 2, droppedAboveSessions: 2, confirmedRatePct: 28.57, droppedRatePct: 40, liftPct: -11.43 },
      { label: "4분", confirmedAboveSessions: 1, droppedAboveSessions: 2, confirmedRatePct: 14.29, droppedRatePct: 40, liftPct: -25.71 },
      { label: "5분", confirmedAboveSessions: 1, droppedAboveSessions: 1, confirmedRatePct: 14.29, droppedRatePct: 20, liftPct: -5.71 },
      { label: "6분", confirmedAboveSessions: 1, droppedAboveSessions: 0, confirmedRatePct: 14.29, droppedRatePct: 0, liftPct: 14.29 },
      { label: "7분", confirmedAboveSessions: 1, droppedAboveSessions: 0, confirmedRatePct: 14.29, droppedRatePct: 0, liftPct: 14.29 },
      { label: "10분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: 0, droppedRatePct: 0, liftPct: 0 },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "organic",
    sourceLabel: "오가닉",
    vmSafeSessions: 0,
    confirmedGa4JoinedSessions: 0,
    droppedGa4JoinedSessions: 0,
    joinRatePct: null,
    recommendedThresholdLabel: null,
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 0,
      droppedAboveSessions: 0,
      confirmedRatePct: null,
      droppedRatePct: null,
      liftPct: null,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "2분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "3분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "4분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "5분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "6분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "7분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "10분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
    ],
  }
];

// page-long threshold fit dry-run · rolling latest 30d (2026-05-26 17:42 KST)
// 최근 7일 표본이 작은 유입의 방향성을 장기 관점으로 확인하기 위한 고정 비교값이다.
export const PAGE_LONG_THRESHOLD_FIT_30D_FOCUSED: PageLongThresholdRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "google_paid",
    sourceLabel: "Google 유료",
    vmSafeSessions: 371,
    confirmedGa4JoinedSessions: 15,
    droppedGa4JoinedSessions: 355,
    joinRatePct: 99.73,
    recommendedThresholdLabel: "1분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 2,
      droppedAboveSessions: 21,
      confirmedRatePct: 13.33,
      droppedRatePct: 5.92,
      liftPct: 7.41,
    },
    thresholdRows: [
      { label: "2분", confirmedAboveSessions: 10, droppedAboveSessions: 63, confirmedRatePct: 66.67, droppedRatePct: 17.75, liftPct: 48.92 },
      { label: "3분", confirmedAboveSessions: 7, droppedAboveSessions: 43, confirmedRatePct: 46.67, droppedRatePct: 12.11, liftPct: 34.56 },
      { label: "7분", confirmedAboveSessions: 2, droppedAboveSessions: 21, confirmedRatePct: 13.33, droppedRatePct: 5.92, liftPct: 7.41 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "youtube",
    sourceLabel: "YouTube",
    vmSafeSessions: 58,
    confirmedGa4JoinedSessions: 29,
    droppedGa4JoinedSessions: 27,
    joinRatePct: 96.55,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "shorter_threshold_better_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 10,
      droppedAboveSessions: 9,
      confirmedRatePct: 34.48,
      droppedRatePct: 33.33,
      liftPct: 1.15,
    },
    thresholdRows: [
      { label: "2분", confirmedAboveSessions: 27, droppedAboveSessions: 20, confirmedRatePct: 93.1, droppedRatePct: 74.07, liftPct: 19.03 },
      { label: "3분", confirmedAboveSessions: 24, droppedAboveSessions: 19, confirmedRatePct: 82.76, droppedRatePct: 70.37, liftPct: 12.39 },
      { label: "7분", confirmedAboveSessions: 10, droppedAboveSessions: 9, confirmedRatePct: 34.48, droppedRatePct: 33.33, liftPct: 1.15 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "organic",
    sourceLabel: "오가닉",
    vmSafeSessions: 17,
    confirmedGa4JoinedSessions: 3,
    droppedGa4JoinedSessions: 13,
    joinRatePct: 94.12,
    recommendedThresholdLabel: "1분",
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 0,
      droppedAboveSessions: 3,
      confirmedRatePct: 0,
      droppedRatePct: 23.08,
      liftPct: -23.08,
    },
    thresholdRows: [
      { label: "2분", confirmedAboveSessions: 1, droppedAboveSessions: 7, confirmedRatePct: 33.33, droppedRatePct: 53.85, liftPct: -20.52 },
      { label: "3분", confirmedAboveSessions: 1, droppedAboveSessions: 6, confirmedRatePct: 33.33, droppedRatePct: 46.15, liftPct: -12.82 },
      { label: "7분", confirmedAboveSessions: 0, droppedAboveSessions: 3, confirmedRatePct: 0, droppedRatePct: 23.08, liftPct: -23.08 },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "meta",
    sourceLabel: "Meta 광고",
    vmSafeSessions: 205,
    confirmedGa4JoinedSessions: 95,
    droppedGa4JoinedSessions: 105,
    joinRatePct: 97.56,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 16,
      droppedAboveSessions: 17,
      confirmedRatePct: 16.84,
      droppedRatePct: 16.19,
      liftPct: 0.65,
    },
    thresholdRows: [
      { label: "2분", confirmedAboveSessions: 74, droppedAboveSessions: 66, confirmedRatePct: 77.89, droppedRatePct: 62.86, liftPct: 15.03 },
      { label: "3분", confirmedAboveSessions: 58, droppedAboveSessions: 57, confirmedRatePct: 61.05, droppedRatePct: 54.29, liftPct: 6.76 },
      { label: "7분", confirmedAboveSessions: 16, droppedAboveSessions: 17, confirmedRatePct: 16.84, droppedRatePct: 16.19, liftPct: 0.65 },
    ],
  },
];

// 더클린커피 최근 7d · channel_truth_table (2026-05-24 11:50 KST 기준)
export const COFFEE_CHANNEL_TRUTH: CohortRow[] = [
  {
    channel: "direct_or_unknown",
    channelLabel: channelLabelKo("direct_or_unknown"),
    vmSafeSessions: 61,
    ga4JoinedSessions: 61,
    joinRatePct: 100,
    confirmedPurchaseSessions: 26,
    droppedCheckoutSessions: 35,
    confirmedAmountKrw: 1833809,
    buyerRatePct: 42.62,
    buyerP50DwellSeconds: 385.54,
    leaverP50DwellSeconds: 232.52,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 46.15,
    leaverCartSignalPct: 25.71,
    buyerBeginCheckoutRatePct: 80.77,
    leaverBeginCheckoutRatePct: 85.71,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 22.86,
    confidence: "high",
  },
  {
    channel: "google_paid",
    channelLabel: channelLabelKo("google_paid"),
    vmSafeSessions: 3,
    ga4JoinedSessions: 3,
    joinRatePct: 100,
    confirmedPurchaseSessions: 0,
    droppedCheckoutSessions: 3,
    confirmedAmountKrw: 0,
    buyerRatePct: 0,
    buyerP50DwellSeconds: null,
    leaverP50DwellSeconds: 43.09,
    buyerScroll90RatePct: null,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: null,
    leaverCartSignalPct: 0,
    buyerBeginCheckoutRatePct: null,
    leaverBeginCheckoutRatePct: 100,
    buyerAddPaymentInfoRatePct: null,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 0,
    confidence: "low",
  },
  {
    channel: "meta",
    channelLabel: channelLabelKo("meta"),
    vmSafeSessions: 88,
    ga4JoinedSessions: 86,
    joinRatePct: 97.73,
    confirmedPurchaseSessions: 39,
    droppedCheckoutSessions: 49,
    confirmedAmountKrw: 2156704,
    buyerRatePct: 44.32,
    buyerP50DwellSeconds: 188.81,
    leaverP50DwellSeconds: 225.43,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 15.38,
    leaverCartSignalPct: 14.89,
    buyerBeginCheckoutRatePct: 79.49,
    leaverBeginCheckoutRatePct: 85.11,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 14.89,
    confidence: "high",
  },
  {
    channel: "naver_other",
    channelLabel: channelLabelKo("naver_other"),
    vmSafeSessions: 13,
    ga4JoinedSessions: 13,
    joinRatePct: 100,
    confirmedPurchaseSessions: 4,
    droppedCheckoutSessions: 9,
    confirmedAmountKrw: 330964,
    buyerRatePct: 30.77,
    buyerP50DwellSeconds: 152.54,
    leaverP50DwellSeconds: 416.26,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 25,
    leaverCartSignalPct: 55.56,
    buyerBeginCheckoutRatePct: 100,
    leaverBeginCheckoutRatePct: 66.67,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 33.33,
    confidence: "medium",
  },
  {
    channel: "naver_paid_or_brand",
    channelLabel: channelLabelKo("naver_paid_or_brand"),
    vmSafeSessions: 119,
    ga4JoinedSessions: 114,
    joinRatePct: 95.8,
    confirmedPurchaseSessions: 38,
    droppedCheckoutSessions: 81,
    confirmedAmountKrw: 2016776,
    buyerRatePct: 31.93,
    buyerP50DwellSeconds: 200.6,
    leaverP50DwellSeconds: 116.42,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 79.22,
    buyerCartSignalPct: 37.84,
    leaverCartSignalPct: 20.78,
    buyerBeginCheckoutRatePct: 94.59,
    leaverBeginCheckoutRatePct: 29.87,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 25.97,
    confidence: "high",
  },
  {
    channel: "other",
    channelLabel: channelLabelKo("other"),
    vmSafeSessions: 14,
    ga4JoinedSessions: 13,
    joinRatePct: 92.86,
    confirmedPurchaseSessions: 6,
    droppedCheckoutSessions: 8,
    confirmedAmountKrw: 540427,
    buyerRatePct: 42.86,
    buyerP50DwellSeconds: 576.56,
    leaverP50DwellSeconds: 44.97,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 85.71,
    buyerCartSignalPct: 50,
    leaverCartSignalPct: 0,
    buyerBeginCheckoutRatePct: 83.33,
    leaverBeginCheckoutRatePct: 28.57,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 14.29,
    confidence: "medium",
  },
  {
    channel: "youtube",
    channelLabel: channelLabelKo("youtube"),
    vmSafeSessions: 24,
    ga4JoinedSessions: 24,
    joinRatePct: 100,
    confirmedPurchaseSessions: 14,
    droppedCheckoutSessions: 10,
    confirmedAmountKrw: 1398970,
    buyerRatePct: 58.33,
    buyerP50DwellSeconds: 165.49,
    leaverP50DwellSeconds: 175.15,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 0,
    leaverCartSignalPct: 0,
    buyerBeginCheckoutRatePct: 50,
    leaverBeginCheckoutRatePct: 50,
    buyerAddPaymentInfoRatePct: 0,
    leaverAddPaymentInfoRatePct: 0,
    droppedWithGa4PurchaseEventPct: 0,
    confidence: "medium",
  },
];

// ga4-vm row-level safe bridge dry-run · rolling latest 7d
export const COHORT_SUMMARY: CohortSummary[] = [
  {
    site: "biocom",
    cohort: "confirmed_purchase",
    vmSafeSessions: 402,
    ga4JoinedSessions: 353,
    joinRatePct: 87.81,
    amountKrw: 117478734,
    p50EngagementSeconds: 205.94,
    p75EngagementSeconds: 343.46,
    scroll90RatePct: 90.93,
    pageViewLongRatePct: 22.95,
    viewItemRatePct: 49.58,
    addToCartRatePct: 14.16,
    beginCheckoutRatePct: 99.15,
    addPaymentInfoRatePct: 4.25,
    ga4PurchaseEventRatePct: 99.72,
  },
  {
    site: "biocom",
    cohort: "dropped_checkout",
    vmSafeSessions: 686,
    ga4JoinedSessions: 598,
    joinRatePct: 87.17,
    amountKrw: 0,
    p50EngagementSeconds: 101.45,
    p75EngagementSeconds: 233.99,
    scroll90RatePct: 72.58,
    pageViewLongRatePct: 22.07,
    viewItemRatePct: 31.94,
    addToCartRatePct: 10.87,
    beginCheckoutRatePct: 52.51,
    addPaymentInfoRatePct: 3.34,
    ga4PurchaseEventRatePct: 4.35,
  },
  {
    site: "thecleancoffee",
    cohort: "confirmed_purchase",
    vmSafeSessions: 115,
    ga4JoinedSessions: 104,
    joinRatePct: 90.43,
    amountKrw: 6281853,
    p50EngagementSeconds: 213.28,
    p75EngagementSeconds: 375.77,
    scroll90RatePct: 100,
    pageViewLongRatePct: 10.58,
    viewItemRatePct: 47.12,
    addToCartRatePct: 29.81,
    beginCheckoutRatePct: 100,
    addPaymentInfoRatePct: 0,
    ga4PurchaseEventRatePct: 100,
  },
  {
    site: "thecleancoffee",
    cohort: "dropped_checkout",
    vmSafeSessions: 203,
    ga4JoinedSessions: 179,
    joinRatePct: 88.18,
    amountKrw: 0,
    p50EngagementSeconds: 150.69,
    p75EngagementSeconds: 339.22,
    scroll90RatePct: 89.94,
    pageViewLongRatePct: 15.64,
    viewItemRatePct: 34.64,
    addToCartRatePct: 16.76,
    beginCheckoutRatePct: 67.04,
    addPaymentInfoRatePct: 0,
    ga4PurchaseEventRatePct: 23.46,
  },
];

export const GA4_LIVE_API_BEHAVIOR_GAP: LiveApiBehaviorGapRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    channel: "meta",
    dryRunBuyerP50Seconds: 205.94,
    dryRunNonBuyerP50Seconds: 101.45,
    liveApiBuyerP50Seconds: 48,
    liveApiNonBuyerP50Seconds: 30,
    dryRunJoinRatePct: 87.41,
    liveApiBehaviorSource: "vm_ledger_metadata",
    interpretationKo:
      "live API는 VM 원장의 페이지 관측값을 보고, dry-run은 GA4 BigQuery의 engagement_time을 봅니다. 최신 7일 연결률은 GA4 daily export가 전일까지만 있어 낮아 보이며, 최근 30일 안정 구간은 96.84%까지 붙습니다.",
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    channel: "meta",
    dryRunBuyerP50Seconds: 213.28,
    dryRunNonBuyerP50Seconds: 150.69,
    liveApiBuyerP50Seconds: null,
    liveApiNonBuyerP50Seconds: null,
    dryRunJoinRatePct: 88.99,
    liveApiBehaviorSource: "missing_ga4_behavior",
    interpretationKo:
      "live API에는 아직 GA4 행동 join이 붙지 않아 체류시간이 비어 있습니다. 최신 7일은 GA4 export 지연으로 88.99%이고, 최근 30일 안정 구간은 97.09%까지 붙으므로 API에 붙일 가치가 충분합니다.",
  },
];

export const SAFE_BRIDGE_COVERAGE_AUDIT: SafeBridgeCoverageAuditRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    windowLabel: "최근 7일",
    checkedAtKst: "2026-05-26 17:43 KST",
    ga4LatestDailyTable: "events_20260525",
    vmSafeSessions: 1088,
    ga4JoinedSessions: 951,
    notJoinedSessions: 137,
    joinRatePct: 87.41,
    notJoinedRatePct: 12.59,
    confirmedJoinRatePct: 87.81,
    droppedJoinRatePct: 87.17,
    missingHashRows: 1102,
    stableBaselineNotJoinedRatePct: 3.16,
    interpretationKo:
      "최근 7일에는 VM Cloud가 2026-05-26 오늘 row까지 갖고 있지만 GA4 daily export는 2026-05-25까지만 있어, 오늘 행동 데이터가 아직 못 붙은 비중이 크게 보입니다.",
    nextActionKo:
      "7일 화면은 freshness 주의를 붙이고, 예산/랜딩 판단은 최근 30일 안정 연결률 또는 전일 완료 기준으로 봅니다.",
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    windowLabel: "최근 7일",
    checkedAtKst: "2026-05-26 17:43 KST",
    ga4LatestDailyTable: "events_20260525",
    vmSafeSessions: 318,
    ga4JoinedSessions: 283,
    notJoinedSessions: 35,
    joinRatePct: 88.99,
    notJoinedRatePct: 11.01,
    confirmedJoinRatePct: 90.43,
    droppedJoinRatePct: 88.18,
    missingHashRows: 15,
    stableBaselineNotJoinedRatePct: 2.91,
    interpretationKo:
      "더클린커피도 최신 7일은 오늘 VM row가 GA4 daily export보다 앞서 있어 11.01%가 안 붙어 보입니다. 구조적 미연결은 최근 30일 기준 2.91% 수준입니다.",
    nextActionKo:
      "오늘 데이터는 다음 GA4 export 반영 후 재계산하고, 상시 화면은 stable baseline과 freshness gap을 분리해 표시합니다.",
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    windowLabel: "최근 30일",
    checkedAtKst: "2026-05-26 17:42 KST",
    ga4LatestDailyTable: "events_20260525",
    vmSafeSessions: 4561,
    ga4JoinedSessions: 4417,
    notJoinedSessions: 144,
    joinRatePct: 96.84,
    notJoinedRatePct: 3.16,
    confirmedJoinRatePct: 97.07,
    droppedJoinRatePct: 96.71,
    missingHashRows: 1935,
    stableBaselineNotJoinedRatePct: null,
    interpretationKo:
      "30일로 넓히면 freshness 영향이 희석되어 구조적인 미연결은 3.16%로 줄어듭니다. 이 값을 현재의 안정 baseline으로 보는 것이 맞습니다.",
    nextActionKo:
      "남은 3%대는 safe key 누락, 외부 결제 리다이렉트, 동의/차단, source window mismatch bucket으로 쪼개면 더 줄일 수 있습니다.",
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    windowLabel: "최근 30일",
    checkedAtKst: "2026-05-26 17:42 KST",
    ga4LatestDailyTable: "events_20260525",
    vmSafeSessions: 1444,
    ga4JoinedSessions: 1402,
    notJoinedSessions: 42,
    joinRatePct: 97.09,
    notJoinedRatePct: 2.91,
    confirmedJoinRatePct: 97.8,
    droppedJoinRatePct: 96.6,
    missingHashRows: 65,
    stableBaselineNotJoinedRatePct: null,
    interpretationKo:
      "30일 기준 더클린커피는 97.09%가 GA4 행동과 붙습니다. 행동 공백은 대규모 추적 장애라기보다 최신일 export 지연과 일부 safe key 누락에 가깝습니다.",
    nextActionKo:
      "GA4 intraday 또는 전일 완료 기준을 붙이면 최신 7일 화면의 불안정성을 줄일 수 있습니다.",
  },
];

export const READINESS: ReadinessRow[] = [
  {
    site: "biocom",
    displayName: "바이오컴",
    status: "safe_bridge_usable_for_behavior_comparison",
    interpretationKo:
      "최근 7일 연결률은 87.41%로 낮아 보이지만 GA4 daily export가 전일까지만 있는 freshness 영향이 큽니다. 최근 30일 안정 구간은 96.84%라 구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있습니다.",
  },
  {
    site: "thecleancoffee",
    displayName: "더클린커피",
    status: "safe_bridge_usable_for_behavior_comparison",
    interpretationKo:
      "최근 7일 연결률은 88.99%, 최근 30일 안정 구간은 97.09%입니다. Meta 채널은 체류시간 단독으로 구매를 설명하지 못하므로 장바구니·결제시작·랜딩 bucket과 같이 봐야 합니다.",
  },
];

export const DRY_RUN_META = {
  checkedAtKst: "2026-05-26 17:43 KST",
  window: "최근 7일",
  source: "VM Cloud SQLite safe session hash + GA4 BigQuery export",
  primary: "VM Cloud confirmed purchase",
  crossCheck: "GA4 BigQuery behavior export",
  confidenceCoffee: "medium_high",
  confidenceBiocom: "medium_high",
  caveats: [
    "GA4 purchase 는 행동 cross-check 이고 실제 결제 정본이 아닙니다.",
    "최신 7일은 VM Cloud가 오늘 row까지 갖고 있지만 GA4 daily export는 전일까지만 있어 연결률이 낮아 보일 수 있습니다.",
    "체류시간은 GA4 engagement_time 기준입니다. live API의 VM 원장 체류시간과 숫자가 다를 수 있습니다.",
    "dropped checkout 은 같은 safe 세션에서 결제완료가 안 된 경우라 session/window rollover 또는 늦은 결제가 섞여 있을 수 있습니다.",
    "더클린커피 Meta는 비결제자의 중앙 체류시간이 더 길게 나와, 체류시간 단독 KPI보다 결제시작·장바구니·랜딩 bucket을 같이 봐야 합니다.",
  ],
};

export const BIOCOM_SOURCE_BREAKDOWN = {
  confirmedPurchaseTotal: 371,
  droppedCheckoutTotal: 721,
  metaConfirmedCount: 131,
  metaDroppedCount: 73,
  note: "바이오컴 Meta-only 는 GA4-VM safe bridge 로 구매자/비결제자/GA4 purchase 충돌 cohort 를 분리합니다. GA4 purchase 충돌은 순수 비결제자에서 제외해야 합니다.",
};

export const BIOCOM_META_COHORT_SPLIT = {
  checkedAtKst: "2026-05-24 11:50 KST",
  window: "최근 7일",
  source: "VM Cloud source_group=meta + GA4 BigQuery safe session join",
  vmMetaSafeSessions: 204,
  ga4JoinedSessions: 194,
  joinRatePct: 95.1,
  confirmedBuyerSessions: 131,
  checkoutNonBuyerSessions: 70,
  ga4PurchaseConflictSessions: 3,
  ga4PurchaseConflictRatePct: 4.35,
  conflictReasonBuckets: [
    {
      bucket: "vm_payment_success_not_confirmed",
      label: "VM payment_success가 confirmed로 닫히지 않은 경우",
      count: 2,
    },
    {
      bucket: "payment_page_seen_only_ga4_purchase",
      label: "VM은 결제 페이지 진입까지만 봤지만 GA4는 purchase를 본 경우",
      count: 1,
    },
  ],
  interpretationKo:
    "GA4 purchase 충돌 row는 순수 이탈자가 아닙니다. 결제완료 source가 다르거나 session/window가 어긋난 보류 bucket으로 분리합니다.",
};
