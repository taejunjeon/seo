// P0 정적 fallback 데이터.
// 최신 재조회 기준:
//   data/project/ga4-vm-row-level-safe-bridge-dry-run-20260525.json
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
    vmSafeSessions: 371,
    ga4JoinedSessions: 356,
    joinRatePct: 95.96,
    amountKrw: 111177580,
    p50EngagementSeconds: 206.57,
    p75EngagementSeconds: 372.87,
    scroll90RatePct: 91.85,
    pageViewLongRatePct: 22.47,
    viewItemRatePct: 52.81,
    addToCartRatePct: 14.89,
    beginCheckoutRatePct: 99.16,
    addPaymentInfoRatePct: 4.21,
    ga4PurchaseEventRatePct: 99.44,
  },
  {
    site: "biocom",
    cohort: "dropped_checkout",
    vmSafeSessions: 721,
    ga4JoinedSessions: 689,
    joinRatePct: 95.56,
    amountKrw: 0,
    p50EngagementSeconds: 88.57,
    p75EngagementSeconds: 214.39,
    scroll90RatePct: 69.67,
    pageViewLongRatePct: 19.74,
    viewItemRatePct: 30.33,
    addToCartRatePct: 8.85,
    beginCheckoutRatePct: 44.56,
    addPaymentInfoRatePct: 2.61,
    ga4PurchaseEventRatePct: 3.05,
  },
  {
    site: "thecleancoffee",
    cohort: "confirmed_purchase",
    vmSafeSessions: 127,
    ga4JoinedSessions: 126,
    joinRatePct: 99.21,
    amountKrw: 8277650,
    p50EngagementSeconds: 209.61,
    p75EngagementSeconds: 404.03,
    scroll90RatePct: 100,
    pageViewLongRatePct: 9.52,
    viewItemRatePct: 43.65,
    addToCartRatePct: 28.57,
    beginCheckoutRatePct: 81.75,
    addPaymentInfoRatePct: 0,
    ga4PurchaseEventRatePct: 100,
  },
  {
    site: "thecleancoffee",
    cohort: "dropped_checkout",
    vmSafeSessions: 195,
    ga4JoinedSessions: 188,
    joinRatePct: 96.41,
    amountKrw: 0,
    p50EngagementSeconds: 176.93,
    p75EngagementSeconds: 339.22,
    scroll90RatePct: 90.96,
    pageViewLongRatePct: 15.96,
    viewItemRatePct: 38.83,
    addToCartRatePct: 19.68,
    beginCheckoutRatePct: 57.98,
    addPaymentInfoRatePct: 0,
    ga4PurchaseEventRatePct: 20.74,
  },
];

export const GA4_LIVE_API_BEHAVIOR_GAP: LiveApiBehaviorGapRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    channel: "meta",
    dryRunBuyerP50Seconds: 193.87,
    dryRunNonBuyerP50Seconds: 124.27,
    liveApiBuyerP50Seconds: 48,
    liveApiNonBuyerP50Seconds: 30,
    dryRunJoinRatePct: 95.1,
    liveApiBehaviorSource: "vm_ledger_metadata",
    interpretationKo:
      "live API는 VM 원장의 페이지 관측값을 보고, dry-run은 GA4 BigQuery의 engagement_time을 봅니다. 숫자가 짧아진 것은 행동 급락보다 측정 기준 차이일 가능성이 큽니다.",
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    channel: "meta",
    dryRunBuyerP50Seconds: 188.81,
    dryRunNonBuyerP50Seconds: 225.43,
    liveApiBuyerP50Seconds: null,
    liveApiNonBuyerP50Seconds: null,
    dryRunJoinRatePct: 97.73,
    liveApiBehaviorSource: "missing_ga4_behavior",
    interpretationKo:
      "live API에는 아직 GA4 행동 join이 붙지 않아 체류시간이 비어 있습니다. dry-run에서는 GA4와 VM safe session이 97.73% 붙으므로 API에 붙일 가치가 충분합니다.",
  },
];

export const READINESS: ReadinessRow[] = [
  {
    site: "biocom",
    displayName: "바이오컴",
    status: "safe_bridge_usable_for_behavior_comparison",
    interpretationKo:
      "GA4 safe bridge 연결률이 95%대까지 올라와 구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있습니다. 단 live API는 아직 GA4 행동값이 아닌 VM 원장값을 보여줍니다.",
  },
  {
    site: "thecleancoffee",
    displayName: "더클린커피",
    status: "safe_bridge_usable_for_behavior_comparison",
    interpretationKo:
      "GA4 safe bridge 연결률이 96~99%로 충분합니다. Meta 채널은 체류시간 단독으로 구매를 설명하지 못하므로 장바구니·결제시작·랜딩 bucket과 같이 봐야 합니다.",
  },
];

export const DRY_RUN_META = {
  checkedAtKst: "2026-05-24 11:50 KST",
  window: "최근 7일",
  source: "VM Cloud SQLite safe session hash + GA4 BigQuery export",
  primary: "VM Cloud confirmed purchase",
  crossCheck: "GA4 BigQuery behavior export",
  confidenceCoffee: "medium_high",
  confidenceBiocom: "medium_high",
  caveats: [
    "GA4 purchase 는 행동 cross-check 이고 실제 결제 정본이 아닙니다.",
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
