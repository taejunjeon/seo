// P0 정적 fallback 데이터.
// 출처:
//   data/project/coffee-channel-cohort-truth-table-20260517.json
//   data/project/ga4-vm-row-level-safe-bridge-dry-run-20260517.json
// 운영 endpoint 가 붙기 전까지 화면에는 "샘플/최근 dry-run 기준" 배지를 노출한다.

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
  scroll90RatePct: number;
  viewItemRatePct: number;
  addToCartRatePct: number;
  beginCheckoutRatePct: number;
  addPaymentInfoRatePct: number;
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
  sourceGroup: "meta" | "google_paid" | "youtube";
  sourceLabel: string;
  vmSafeSessions: number;
  confirmedGa4JoinedSessions: number;
  droppedGa4JoinedSessions: number;
  joinRatePct: number | null;
  recommendedThresholdLabel: string | null;
  recommendationStatus:
    | "seven_minutes_too_strict_for_primary_indicator"
    | "shorter_threshold_better_for_primary_indicator"
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

const CHANNEL_LABEL_KO: Record<string, string> = {
  meta: "Meta",
  youtube: "YouTube",
  naver_paid_or_brand: "네이버 paid/brand",
  naver_other: "네이버 기타",
  direct_or_unknown: "직접/불명",
  organic: "오가닉",
  google_paid: "Google paid",
  other: "기타",
};

export function channelLabelKo(key: string): string {
  return CHANNEL_LABEL_KO[key] ?? key;
}

// page-long threshold fit dry-run · rolling latest 7d (2026-05-20 01:37 KST)
// 출처: data/project/page-long-threshold-fit-dry-run-20260520.json
// "페이지 롱 뷰"는 방문자가 몇 분 이상 머물렀는지 보는 선행지표 후보이며,
// 7분은 너무 엄격할 수 있어 1~10분 기준을 같이 비교한다.
export const PAGE_LONG_THRESHOLD_FIT: PageLongThresholdRow[] = [
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "meta",
    sourceLabel: "Meta 광고",
    vmSafeSessions: 254,
    confirmedGa4JoinedSessions: 126,
    droppedGa4JoinedSessions: 105,
    joinRatePct: 90.94,
    recommendedThresholdLabel: "2분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 29,
      droppedAboveSessions: 16,
      confirmedRatePct: 23.02,
      droppedRatePct: 15.24,
      liftPct: 7.78,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 113, droppedAboveSessions: 83, confirmedRatePct: 89.68, droppedRatePct: 79.05, liftPct: 10.63 },
      { label: "2분", confirmedAboveSessions: 100, droppedAboveSessions: 71, confirmedRatePct: 79.37, droppedRatePct: 67.62, liftPct: 11.75 },
      { label: "3분", confirmedAboveSessions: 74, droppedAboveSessions: 54, confirmedRatePct: 58.73, droppedRatePct: 51.43, liftPct: 7.3 },
      { label: "5분", confirmedAboveSessions: 42, droppedAboveSessions: 24, confirmedRatePct: 33.33, droppedRatePct: 22.86, liftPct: 10.47 },
      { label: "7분", confirmedAboveSessions: 29, droppedAboveSessions: 16, confirmedRatePct: 23.02, droppedRatePct: 15.24, liftPct: 7.78 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "google_paid",
    sourceLabel: "Google 유료",
    vmSafeSessions: 50,
    confirmedGa4JoinedSessions: 5,
    droppedGa4JoinedSessions: 44,
    joinRatePct: 98,
    recommendedThresholdLabel: "3분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 1,
      droppedAboveSessions: 2,
      confirmedRatePct: 20,
      droppedRatePct: 4.55,
      liftPct: 15.45,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 3, droppedAboveSessions: 18, confirmedRatePct: 60, droppedRatePct: 40.91, liftPct: 19.09 },
      { label: "2분", confirmedAboveSessions: 2, droppedAboveSessions: 11, confirmedRatePct: 40, droppedRatePct: 25, liftPct: 15 },
      { label: "3분", confirmedAboveSessions: 2, droppedAboveSessions: 6, confirmedRatePct: 40, droppedRatePct: 13.64, liftPct: 26.36 },
      { label: "5분", confirmedAboveSessions: 1, droppedAboveSessions: 3, confirmedRatePct: 20, droppedRatePct: 6.82, liftPct: 13.18 },
      { label: "7분", confirmedAboveSessions: 1, droppedAboveSessions: 2, confirmedRatePct: 20, droppedRatePct: 4.55, liftPct: 15.45 },
    ],
  },
  {
    site: "biocom",
    siteLabel: "바이오컴",
    sourceGroup: "youtube",
    sourceLabel: "YouTube",
    vmSafeSessions: 14,
    confirmedGa4JoinedSessions: 7,
    droppedGa4JoinedSessions: 4,
    joinRatePct: 78.57,
    recommendedThresholdLabel: "6분",
    recommendationStatus: "insufficient_sample",
    current7Min: {
      confirmedAboveSessions: 4,
      droppedAboveSessions: 2,
      confirmedRatePct: 57.14,
      droppedRatePct: 50,
      liftPct: 7.14,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 7, droppedAboveSessions: 4, confirmedRatePct: 100, droppedRatePct: 100, liftPct: 0 },
      { label: "3분", confirmedAboveSessions: 7, droppedAboveSessions: 4, confirmedRatePct: 100, droppedRatePct: 100, liftPct: 0 },
      { label: "5분", confirmedAboveSessions: 6, droppedAboveSessions: 3, confirmedRatePct: 85.71, droppedRatePct: 75, liftPct: 10.71 },
      { label: "7분", confirmedAboveSessions: 4, droppedAboveSessions: 2, confirmedRatePct: 57.14, droppedRatePct: 50, liftPct: 7.14 },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "meta",
    sourceLabel: "Meta 광고",
    vmSafeSessions: 76,
    confirmedGa4JoinedSessions: 36,
    droppedGa4JoinedSessions: 31,
    joinRatePct: 88.16,
    recommendedThresholdLabel: "3분",
    recommendationStatus: "seven_minutes_too_strict_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 6,
      droppedAboveSessions: 5,
      confirmedRatePct: 16.67,
      droppedRatePct: 16.13,
      liftPct: 0.54,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 33, droppedAboveSessions: 26, confirmedRatePct: 91.67, droppedRatePct: 83.87, liftPct: 7.8 },
      { label: "2분", confirmedAboveSessions: 31, droppedAboveSessions: 18, confirmedRatePct: 86.11, droppedRatePct: 58.06, liftPct: 28.05 },
      { label: "3분", confirmedAboveSessions: 26, droppedAboveSessions: 13, confirmedRatePct: 72.22, droppedRatePct: 41.94, liftPct: 30.28 },
      { label: "5분", confirmedAboveSessions: 14, droppedAboveSessions: 6, confirmedRatePct: 38.89, droppedRatePct: 19.35, liftPct: 19.54 },
      { label: "7분", confirmedAboveSessions: 6, droppedAboveSessions: 5, confirmedRatePct: 16.67, droppedRatePct: 16.13, liftPct: 0.54 },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "google_paid",
    sourceLabel: "Google 유료",
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
      { label: "3분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
      { label: "7분", confirmedAboveSessions: 0, droppedAboveSessions: 0, confirmedRatePct: null, droppedRatePct: null, liftPct: null },
    ],
  },
  {
    site: "thecleancoffee",
    siteLabel: "더클린커피",
    sourceGroup: "youtube",
    sourceLabel: "YouTube",
    vmSafeSessions: 102,
    confirmedGa4JoinedSessions: 60,
    droppedGa4JoinedSessions: 37,
    joinRatePct: 95.1,
    recommendedThresholdLabel: "3분",
    recommendationStatus: "shorter_threshold_better_for_primary_indicator",
    current7Min: {
      confirmedAboveSessions: 16,
      droppedAboveSessions: 5,
      confirmedRatePct: 26.67,
      droppedRatePct: 13.51,
      liftPct: 13.16,
    },
    thresholdRows: [
      { label: "1분", confirmedAboveSessions: 58, droppedAboveSessions: 31, confirmedRatePct: 96.67, droppedRatePct: 83.78, liftPct: 12.89 },
      { label: "2분", confirmedAboveSessions: 50, droppedAboveSessions: 22, confirmedRatePct: 83.33, droppedRatePct: 59.46, liftPct: 23.87 },
      { label: "3분", confirmedAboveSessions: 42, droppedAboveSessions: 16, confirmedRatePct: 70, droppedRatePct: 43.24, liftPct: 26.76 },
      { label: "5분", confirmedAboveSessions: 25, droppedAboveSessions: 7, confirmedRatePct: 41.67, droppedRatePct: 18.92, liftPct: 22.75 },
      { label: "7분", confirmedAboveSessions: 16, droppedAboveSessions: 5, confirmedRatePct: 26.67, droppedRatePct: 13.51, liftPct: 13.16 },
    ],
  },
];

// 더클린커피 최근 7d · channel_truth_table (2026-05-17 17:44 KST 기준)
export const COFFEE_CHANNEL_TRUTH: CohortRow[] = [
  {
    channel: "meta",
    channelLabel: channelLabelKo("meta"),
    vmSafeSessions: 67,
    ga4JoinedSessions: 61,
    joinRatePct: 91.04,
    confirmedPurchaseSessions: 37,
    droppedCheckoutSessions: 30,
    confirmedAmountKrw: 2329544,
    buyerRatePct: 55.22,
    buyerP50DwellSeconds: 210.76,
    leaverP50DwellSeconds: 162.88,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 17.14,
    leaverCartSignalPct: 23.08,
    droppedWithGa4PurchaseEventPct: 19.23,
    confidence: "high",
  },
  {
    channel: "youtube",
    channelLabel: channelLabelKo("youtube"),
    vmSafeSessions: 185,
    ga4JoinedSessions: 177,
    joinRatePct: 95.68,
    confirmedPurchaseSessions: 110,
    droppedCheckoutSessions: 75,
    confirmedAmountKrw: 7558524,
    buyerRatePct: 59.46,
    buyerP50DwellSeconds: 264.38,
    leaverP50DwellSeconds: 171.33,
    buyerScroll90RatePct: 99.05,
    leaverScroll90RatePct: 91.67,
    buyerCartSignalPct: 8.57,
    leaverCartSignalPct: 8.33,
    droppedWithGa4PurchaseEventPct: 11.11,
    confidence: "high",
  },
  {
    channel: "naver_paid_or_brand",
    channelLabel: channelLabelKo("naver_paid_or_brand"),
    vmSafeSessions: 177,
    ga4JoinedSessions: 171,
    joinRatePct: 96.61,
    confirmedPurchaseSessions: 39,
    droppedCheckoutSessions: 138,
    confirmedAmountKrw: 2046049,
    buyerRatePct: 22.03,
    buyerP50DwellSeconds: 226.99,
    leaverP50DwellSeconds: 105.01,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 73.88,
    buyerCartSignalPct: 43.24,
    leaverCartSignalPct: 10.45,
    droppedWithGa4PurchaseEventPct: 18.66,
    confidence: "high",
  },
  {
    channel: "naver_other",
    channelLabel: channelLabelKo("naver_other"),
    vmSafeSessions: 19,
    ga4JoinedSessions: 16,
    joinRatePct: 84.21,
    confirmedPurchaseSessions: 6,
    droppedCheckoutSessions: 13,
    confirmedAmountKrw: 381695,
    buyerRatePct: 31.58,
    buyerP50DwellSeconds: 330.98,
    leaverP50DwellSeconds: 130.74,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 16.67,
    leaverCartSignalPct: 10.0,
    droppedWithGa4PurchaseEventPct: 80,
    confidence: "medium",
  },
  {
    channel: "direct_or_unknown",
    channelLabel: channelLabelKo("direct_or_unknown"),
    vmSafeSessions: 229,
    ga4JoinedSessions: 222,
    joinRatePct: 96.94,
    confirmedPurchaseSessions: 120,
    droppedCheckoutSessions: 109,
    confirmedAmountKrw: 8253844,
    buyerRatePct: 52.4,
    buyerP50DwellSeconds: 264.43,
    leaverP50DwellSeconds: 181.58,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 31.93,
    leaverCartSignalPct: 23.3,
    droppedWithGa4PurchaseEventPct: 12.62,
    confidence: "high",
  },
  {
    channel: "other",
    channelLabel: channelLabelKo("other"),
    vmSafeSessions: 27,
    ga4JoinedSessions: 26,
    joinRatePct: 96.3,
    confirmedPurchaseSessions: 14,
    droppedCheckoutSessions: 13,
    confirmedAmountKrw: 582059,
    buyerRatePct: 51.85,
    buyerP50DwellSeconds: 217.3,
    leaverP50DwellSeconds: 235.24,
    buyerScroll90RatePct: 100,
    leaverScroll90RatePct: 100,
    buyerCartSignalPct: 28.57,
    leaverCartSignalPct: 16.67,
    droppedWithGa4PurchaseEventPct: 33.33,
    confidence: "medium",
  },
];

// ga4-vm row-level safe bridge dry-run · 7d
export const COHORT_SUMMARY: CohortSummary[] = [
  {
    site: "biocom",
    cohort: "confirmed_purchase",
    vmSafeSessions: 380,
    ga4JoinedSessions: 114,
    joinRatePct: 30,
    amountKrw: 104640021,
    p50EngagementSeconds: 226.13,
    scroll90RatePct: 92.98,
    viewItemRatePct: 62.28,
    addToCartRatePct: 16.67,
    beginCheckoutRatePct: 99.12,
    addPaymentInfoRatePct: 7.89,
  },
  {
    site: "biocom",
    cohort: "dropped_checkout",
    vmSafeSessions: 717,
    ga4JoinedSessions: 247,
    joinRatePct: 34.45,
    amountKrw: 0,
    p50EngagementSeconds: 139.69,
    scroll90RatePct: 76.52,
    viewItemRatePct: 34.41,
    addToCartRatePct: 10.93,
    beginCheckoutRatePct: 61.94,
    addPaymentInfoRatePct: 3.24,
  },
  {
    site: "thecleancoffee",
    cohort: "confirmed_purchase",
    vmSafeSessions: 326,
    ga4JoinedSessions: 316,
    joinRatePct: 96.93,
    amountKrw: 21151715,
    p50EngagementSeconds: 251.75,
    scroll90RatePct: 99.68,
    viewItemRatePct: 39.24,
    addToCartRatePct: 23.42,
    beginCheckoutRatePct: 0,
    addPaymentInfoRatePct: 0,
  },
  {
    site: "thecleancoffee",
    cohort: "dropped_checkout",
    vmSafeSessions: 378,
    ga4JoinedSessions: 357,
    joinRatePct: 94.44,
    amountKrw: 0,
    p50EngagementSeconds: 154.91,
    scroll90RatePct: 88.52,
    viewItemRatePct: 35.29,
    addToCartRatePct: 14.85,
    beginCheckoutRatePct: 0,
    addPaymentInfoRatePct: 0,
  },
];

export const READINESS: ReadinessRow[] = [
  {
    site: "biocom",
    displayName: "바이오컴",
    status: "meta_only_three_cohort_ready",
    interpretationKo:
      "Meta-only 비교는 확정 구매자, 순수 비결제자, GA4 purchase 충돌 3개 cohort 로 나눠 볼 수 있습니다. 충돌 bucket 은 예산 판단 전 보류로 봅니다.",
  },
  {
    site: "thecleancoffee",
    displayName: "더클린커피",
    status: "safe_bridge_usable_for_behavior_comparison",
    interpretationKo:
      "구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있습니다.",
  },
];

export const DRY_RUN_META = {
  checkedAtKst: "2026-05-18 23:01 KST",
  window: "최근 3일/7일 dry-run 혼합",
  source: "VM Cloud SQLite + GA4 BigQuery export",
  primary: "VM Cloud SQLite",
  crossCheck: "GA4 BigQuery export",
  confidenceCoffee: "medium_high",
  confidenceBiocom: "medium_high_for_meta_split",
  caveats: [
    "GA4 purchase 는 행동 cross-check 이고 실제 결제 정본이 아닙니다.",
    "dropped checkout 은 같은 safe 세션에서 결제완료가 안 된 경우라 session/window rollover 또는 늦은 결제가 섞여 있을 수 있습니다.",
    "바이오컴 Meta-only 는 확정 구매자, 순수 비결제자, GA4 purchase 충돌 3개 cohort 로 분리해서 봅니다.",
    "더클린커피 GA4 begin_checkout / add_payment_info 는 아직 비어 있어, 결제완료는 VM Cloud confirmed purchase 만 사용합니다.",
  ],
};

// site → 채널 카운트 (cohort_summary 의 vm_source_groups 합)
// 바이오컴 Meta-only 는 최근 3일 기준 3개 cohort 로 분리 가능.
export const BIOCOM_SOURCE_BREAKDOWN = {
  confirmedPurchaseTotal: 380,
  droppedCheckoutTotal: 717,
  metaConfirmedCount: 134,
  metaDroppedCount: 106,
  note: "바이오컴 Meta-only 는 GA4-VM safe bridge 로 3개 cohort 를 분리합니다. GA4 purchase 충돌은 순수 비결제자에서 제외해야 합니다.",
};

export const BIOCOM_META_COHORT_SPLIT = {
  checkedAtKst: "2026-05-18 23:01 KST",
  window: "최근 3일",
  source: "VM Cloud source_group=meta + GA4 BigQuery safe session join",
  vmMetaSafeSessions: 126,
  ga4JoinedSessions: 106,
  joinRatePct: 84.13,
  confirmedBuyerSessions: 80,
  checkoutNonBuyerSessions: 44,
  ga4PurchaseConflictSessions: 2,
  ga4PurchaseConflictRatePct: 5.41,
  conflictReasonBuckets: [
    {
      bucket: "vm_payment_success_not_confirmed",
      label: "VM payment_success가 confirmed로 닫히지 않은 경우",
      count: 1,
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
