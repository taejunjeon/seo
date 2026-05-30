"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type DatePreset = "last_7d" | "last_30d";

const kstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getKstDateString = (date = new Date()) => kstDateFormatter.format(date);

const shiftIsoDate = (dateString: string, deltaDays: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
};

const buildDashboardSummaryUrl = (preset: DatePreset) => {
  if (preset === "last_7d") {
    const endDate = getKstDateString();
    const startDate = shiftIsoDate(endDate, -6);
    return `${API_BASE}/api/google-ads/dashboard-summary?start_date=${startDate}&end_date=${endDate}&campaign_limit=20&refresh=1`;
  }

  return `${API_BASE}/api/google-ads/dashboard-summary?date_preset=${preset}&campaign_limit=20`;
};

type GoogleCampaignMatchHealth = {
  windowDays: number;
  generatedAt: string;
  source: string;
  mode: "no_send_read_only";
  baseline: {
    candidateStartedAtKst: string;
    effectiveForRoasRecalculation: boolean;
    effectiveFromKst: string | null;
    policy: string;
  };
  siteLanding: {
    rows: number;
    googleClickIdRows: number;
    gadCampaignIdRows: number;
    gadSourceRows: number;
    utmBlankGoogleClickIdRows: number;
    utmPresentGoogleClickIdRows: number;
    currentCampaignIdCoverageRate: number | null;
    potentialCoverageRateAfterAllowlist: number | null;
    latestAt: string | null;
  };
  paidClickIntent: {
    rows: number;
    googleClickIdRows: number;
    gadCampaignIdRows: number;
    gadSourceRows: number;
    utmBlankGoogleClickIdRows: number;
    utmPresentGoogleClickIdRows: number;
    currentCampaignIdCoverageRate: number | null;
    potentialCoverageRateAfterAllowlist: number | null;
    latestAt: string | null;
  };
  attributionLedger: {
    rows: number;
    gadCampaignIdRows: number;
    googleClickIdEvidenceRows: number;
    confirmedPaymentSuccessRows: number;
    confirmedRowsWithGadCampaignId: number;
    latestAt: string | null;
  };
  confidenceThresholds: {
    exactClickViewPct: number;
    gadCampaignIdWithClickIdPct: number;
    gadCampaignIdSessionOnlyPct: number;
    utmOnlyPct: number;
    unmappedPct: number;
  };
  topCampaignIds: Array<{
    campaignId: string;
    campaignName: string | null;
    rows: number;
    confirmedRows: number;
    matchedToDashboardCampaign: boolean;
  }>;
  healthSplit?: {
    roasAttribution: {
      source: "site_landing_ledger_and_attribution_ledger";
      status: "usable_for_budget_review" | "collecting" | "blocked";
      rows: number;
      googleClickIdRows: number;
      gadCampaignIdRows: number;
      currentCampaignIdCoverageRate: number | null;
      latestAt: string | null;
      interpretation: string;
    };
    paidClickIntentTag: {
      source: "paid_click_intent_ledger";
      status: "monitoring" | "needs_exact_click_diagnosis" | "collecting" | "blocked";
      rows: number;
      googleClickIdRows: number;
      gadCampaignIdRows: number;
      currentCampaignIdCoverageRate: number | null;
      latestAt: string | null;
      interpretation: string;
    };
    orderAttribution: {
      source: "attribution_ledger";
      status: "usable_for_order_join" | "collecting" | "blocked";
      rows: number;
      googleClickIdEvidenceRows: number;
      confirmedPaymentSuccessRows: number;
      confirmedRowsWithGadCampaignId: number;
      latestAt: string | null;
      interpretation: string;
    };
  };
  summary: {
    status:
      | "needs_allowlist_deploy"
      | "allowlist_deployed_waiting_new_click"
      | "campaign_id_collecting"
      | "no_google_click_id_rows"
      | "table_unavailable";
    mappedRows: number;
    unmappedRows: number;
    recoverableRowsAfterAllowlist: number;
    uploadCandidateCount: 0;
    interpretation: string;
  };
  caveats: string[];
};

type GoogleClickIdDropoffStage = {
  key: string;
  label: string;
  source: string;
  rows: number;
  googleClickIdRows: number;
  gadCampaignIdRows: number;
  coverageRate: number | null;
  latestAt: string | null;
  plainMeaning: string;
};

type GoogleClickIdDropoffStageComparison = {
  fromKey: string;
  toKey: string;
  fromLabel: string;
  toLabel: string;
  fromGoogleClickIdRows: number;
  toGoogleClickIdRows: number;
  apparentLostClickIdRows: number;
  comparisonRate: number | null;
  interpretation: string;
  nextProbe: string;
};

type GoogleClickIdDropoffPaymentStatusRow = {
  paymentStatus: string;
  rows: number;
  googleClickIdRows: number;
  gadCampaignIdRows: number;
  coverageRate: number | null;
  latestAt: string | null;
};

type GoogleClickIdDropoffHealth = {
  generatedAt: string;
  source: string;
  mode: "no_send_read_only";
  baselines: {
    clickIdCapturePatchKst: string;
    analysisAlgorithmV2Kst: string;
    policy: string;
  };
  stageSummary: {
    clickStageOk: boolean;
    checkoutStageHasGoogleEvidence: boolean;
    paymentSuccessDirectPreserved: boolean;
    likelyLossPoint: string;
    manualClickTestNeeded: boolean;
  };
  stages: {
    siteLanding: GoogleClickIdDropoffStage;
    paidClickIntent: GoogleClickIdDropoffStage;
    checkoutStarted: GoogleClickIdDropoffStage;
    paymentPageSeen: GoogleClickIdDropoffStage;
    paymentSuccessAll: GoogleClickIdDropoffStage;
    paymentSuccessConfirmedDirect: GoogleClickIdDropoffStage;
    npayIntentExact: GoogleClickIdDropoffStage & {
      matchedOrderRows: number;
      matchedOrderGoogleClickIdRows: number;
    };
  };
  stageComparisons: GoogleClickIdDropoffStageComparison[];
  paymentSuccessStatusBreakdown: GoogleClickIdDropoffPaymentStatusRow[];
  orderEvidenceBreakdown: {
    orderCount: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    missingAttributionVmEvidence: number;
    paymentSuccessLedgerRows: number;
    npayIntentRows: number;
    bothRows: number;
    noneRows: number;
    clickIdFromPaymentSuccessLedgerRows: number;
    clickIdFromNpayIntentRows: number;
    clickIdFromBothRows: number;
    interpretation: string;
  };
  conclusion: {
    status: string;
    plain: string;
    nextAction: string;
  };
  invariants: {
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    rawClickIdInResponse: false;
  };
};

type GoogleNpayBridgeReviewRow = {
  orderNumber: string;
  channelOrderNo: string;
  paidAt: string;
  orderAmount: number | null;
  productName: string;
  strongGrade: "A" | "B" | null;
  score: number;
  scoreGap: number | null;
  timeGapMinutes: number;
  orderCreatedAt: string;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: string;
  amountMatchType: string;
  hasGoogleClickId: boolean;
  googleClickIdTypes: Array<"gclid" | "gbraid" | "wbraid">;
  googleClickIdEvidenceSource?: string;
  googleClickIdEvidencePlain?: string;
  googleClickIdRawValueAvailable?: boolean;
  gadCampaignId: string | null;
  campaignIdEvidenceSource:
    | "intent_page_location"
    | "paid_click_intent_same_client_session"
    | "site_landing_same_client_session"
    | "none";
  utmCampaign: string;
  recommendedAction: string;
  blockReasons: string[];
  gradePlainReason?: string;
  gradeAUpgradeDecision?:
    | "already_grade_a"
    | "blocked_time_gap"
    | "blocked_amount_mismatch"
    | "blocked_score_gap"
    | "blocked_missing_click_id"
    | "manual_review_only";
  gradeAUpgradePlain?: string;
  npayBridgeUrlHashPresent?: boolean;
  npayBridgeHost?: string;
  npayBridgePathHashPresent?: boolean;
  npayBridgeObservedAt?: string;
  internalBridgeDecision: "strong_bridge_candidate" | "manual_review_candidate";
  googleAdsSendDecision: "blocked_no_send";
};

type GoogleNpayFinalSourceChannel = "google" | "meta" | "naver" | "organic" | "direct" | "unknown";

type GoogleNpayFinalSourceSummary = {
  totalCompletedOrders: number;
  classifiedCompletedOrders: number;
  unclassifiedCompletedOrders: number;
  googleEvidenceOrders: number;
  googleEvidenceAmountKrw: number;
  byChannel: Array<{
    channel: GoogleNpayFinalSourceChannel;
    label: string;
    completedOrders: number;
    amountKrw: number;
    bridgeCandidateOrders: number;
    directGoogleClickIdOrders: number;
    recoveredGoogleClickIdOrders: number;
    confidence: "high" | "medium" | "low";
    plain: string;
  }>;
  unclassifiedReasons?: Array<{
    reason: string;
    label: string;
    completedOrders: number;
    sharePct: number;
    sampleOrderCount: number;
    plain: string;
  }>;
  dateDistribution?: Array<{
    dateKst: string;
    completedOrders: number;
    amountKrw: number;
    bridgeCandidateOrders: number;
    gradeA: number;
    gradeB: number;
    ambiguous: number;
    purchaseWithoutIntent: number;
    googleEvidenceOrders: number;
    directGoogleClickIdOrders: number;
  }>;
  source: "npay_intent_bridge_candidate_rows";
  basis: string;
  caveat: string;
};

type GoogleNpayBridgeSourceFunnelRow = {
  channel: "google" | "meta" | "other";
  label: string;
  intentCount: number;
  bridgeOpenedIntentCount: number;
  googleClickIdIntentCount: number;
  completedOrders: number;
  completedAmountKrw: number;
  completionRatePct: number;
  plain: string;
};

type GoogleNpayBridgeUnresolvedRow = {
  orderNumber: string;
  channelOrderNo: string;
  status: "strong_match" | "ambiguous" | "purchase_without_intent";
  strongGrade: "A" | "B" | null;
  paidAt: string;
  paidAtBasis: string | null;
  orderCreatedAt: string;
  orderAmount: number | null;
  orderItemTotal: number | null;
  deliveryPrice: number | null;
  discountAmount: number | null;
  quantity: number;
  productNames: string[];
  bestIntentCapturedAt: string;
  bestIntentProductPrice: number | null;
  bestIntentSourceChannel: "google" | "meta" | "other";
  bestIntentSourceLabel: string;
  bestIntentHasGoogleClickId: boolean;
  bestIntentHasNpayBridgeUrlHash: boolean;
  bestIntentBridgeHost: string;
  timeGapMinutes: number | null;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: string | null;
  amountMatchType: string;
  amountReconcileReason: string;
  amountMismatchCategory?: string;
  amountMismatchLabel?: string;
  amountMismatchPlain?: string;
  amountMismatchConfidence?: "high" | "medium" | "low";
  amountMismatchSignals?: string[];
  score: number | null;
  scoreGap: number | null;
  candidateCount: number;
  ambiguousReasons: string[];
  availableFacts: string[];
  missingFacts: string[];
  proposedFix: string;
};

type GoogleNpayBridgeReview = {
  generatedAt: string;
  source: "npay_intent_rematch_dry_run";
  mode: "no_write_no_send";
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  windowLabel: string;
  sourceFreshness: {
    dryRunGeneratedAt: string | null;
    ordersSource: string;
    intentsSource: string;
  };
  summary: {
    liveIntentCount: number;
    googleLikeIntentCount: number;
    googleLikeIntentWithGoogleClickId: number;
    googleClickIdIntentCount: number;
    googleClickIdIntentBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
    liveIntentWithNpayBridgeUrlHash?: number;
    googleLikeIntentWithNpayBridgeUrlHash?: number;
    enteredNotCompletedBreakdown?: {
      total: number;
      pendingWindow: number;
      loginGatePossible: number;
      checkoutOpenedPossible: number;
      matchingGapPossible: number;
    };
    actualConfirmedNpayOrders: number;
    internalBridgeStrongCandidates: number;
    internalBridgeExactCandidates: number;
    internalBridgeExactWithGoogleClickId: number;
    bridgeCandidatesWithNpayBridgeUrlHash?: number;
    bridgeCandidatesWithGoogleClickId: number;
    bridgeCandidatesWithRecoveredGoogleClickId?: number;
    gradeA: number;
    gradeAWithDirectGoogleClickId?: number;
    gradeAWithRecoveredGoogleClickId?: number;
    gradeAWithGoogleClickId?: number;
    gradeAWithNpayBridgeUrlHash?: number;
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash?: number;
    gradeADirectGoogleClickIdAmountKrw?: number;
    gradeAWithGoogleClickIdAmountKrw?: number;
    gradeARecoveredGoogleClickIdAmountKrw?: number;
    gradeANeedsClickIdRecoveryRows?: number;
    gradeB: number;
    gradeBWithGoogleClickId: number;
    gradeBBlockedByTimeGap: number;
    gradeBBlockedByAmount: number;
    gradeBBlockedByMissingGoogleClickId: number;
    gradeBPromotableToGradeANow: number;
    googleLikeCompletedOrders: number;
    googleLikeCompletedAmountKrw: number;
    googleLikeCompletedWithDirectGoogleClickId: number;
    ambiguous: number;
    purchaseWithoutIntent: number;
    googleAdsSendCandidates: 0;
    vmCloudWrite: 0;
    operationalDbWrite: 0;
  };
  rows: GoogleNpayBridgeReviewRow[];
  gradeBRows?: GoogleNpayBridgeReviewRow[];
  campaignSummary: Array<{
    campaignId: string | null;
    campaignName: string;
    internalBridgeCandidates: number;
    bridgeCandidatesWithGoogleClickId: number;
    gradeA: number;
    gradeB: number;
    amountKrw: number;
    googleAdsSendCandidates: 0;
  }>;
  finalSourceSummary?: GoogleNpayFinalSourceSummary;
  sourceFunnelComparison?: GoogleNpayBridgeSourceFunnelRow[];
  unresolvedRows?: GoogleNpayBridgeUnresolvedRow[];
  plainMeaning: string;
  noWritePolicy: string;
  caveats: string[];
};

type GoogleAdsPrivatePayloadPreviewCheck = {
  key:
    | "actual_purchase_guard"
    | "exact_order_identifier"
    | "exact_gclid"
    | "conversion_time"
    | "conversion_value"
    | "currency"
    | "cancel_refund_return_guard"
    | "duplicate_key_material"
    | "conversion_action"
    | "send_approval"
    | "upload_ledger";
  label: string;
  passed: boolean;
  publicSummary: string;
  rawValueExposed: false;
  blockerReason: string | null;
};

type GoogleAdsPrivatePayloadPreviewCandidate = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  payment: {
    amountKrw: number;
    currencyCode: "KRW";
    paymentMethod: string;
    paymentStatus: string;
    isNpay: boolean;
    paidDateKst: string;
    actualPurchaseGuardPassed: boolean;
    cancelRefundReturnGuardPassed: boolean;
  };
  evidence: {
    source: string;
    exactClickIdType: "gclid";
    hasGclid: true;
    hasGbraid: false;
    hasWbraid: false;
    rawClickIdExposed: false;
    clickIdDigestPrefix: string;
  };
  noSendPayloadShape: {
    conversionActionId: string;
    conversionActionName: string;
    conversionActionResourceName: string;
    orderIdPresent: boolean;
    gclidPresent: boolean;
    conversionTimePresent: boolean;
    conversionValuePresent: boolean;
    currencyPresent: boolean;
    duplicateSendKeyHash: string;
    externalSendMode: "blocked_no_send_preview";
  };
  checks: GoogleAdsPrivatePayloadPreviewCheck[];
  readiness: {
    privateRawValueChecksPassed: boolean;
    privatePreviewProgressPct: number;
    googleAdsSendReady: false;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    blockReasons: string[];
  };
};

type GoogleAdsPrivatePayloadPreview = {
  ok: true;
  fetchedAt: string;
  generatedAt: string;
  site: "biocom";
  mode: "private_no_send_payload_preview";
  goal: string;
  progress: {
    privatePreviewProgressPct: number;
    overallPrimaryConversionReadinessPct: number;
    plain: string;
  };
  window: {
    key: string;
    label: string;
    startAt: string;
    endAt: string;
    timezone: "Asia/Seoul";
  };
  requestedLimit: number;
  summary: {
    sourceOrderRows: number;
    exactGclidActualPurchaseRows: number;
    returnedCandidates: number;
    privateRawValueChecksPassed: number;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
  };
  candidates: GoogleAdsPrivatePayloadPreviewCandidate[];
  invariants: {
    rawOrderIdInResponse: false;
    rawClickIdInResponse: false;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    googleAdsWrite: 0;
  };
  caveats: string[];
};

type GoogleAdsDashboardResponse = {
  ok: boolean;
  fetchedAt: string;
  customerId: string;
  datePreset: DatePreset;
  dateRangeLiteral: string;
  source?: "google_ads_api" | "google_ads_dashboard_summary";
  cache?: {
    cached?: boolean;
    source?: string;
    cached_at_kst?: string | null;
    next_refresh_at_kst?: string | null;
    generation_ms?: number | null;
    staleness_ms?: number | null;
  };
  summary: {
    cost: number;
    conversionValue: number;
    allConversionValue: number;
    viewThroughConversions: number;
    roas: number | null;
  };
  campaigns?: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    channel: string;
    cost: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    allConversions: number;
    allConversionValue: number;
    roas: number | null;
  }>;
  internal?: {
    summary: {
      confirmedOrders: number;
      confirmedRevenue: number;
      platformCost: number;
      platformConversionValue: number;
      platformRoas: number | null;
      internalConfirmedRoas: number | null;
      roasGap: number | null;
      platformMinusConfirmedRevenue: number;
      campaignIdCoverage: number | null;
      matchedCampaignOrders?: number;
      unknownCampaignOrders: number;
    };
    campaigns?: Array<{
      campaignId: string | null;
      campaignName: string;
      platformCost: number;
      platformConversionValue: number;
      platformRoas: number | null;
      internalConfirmedRoas: number | null;
      roasGap: number | null;
      matchStatus: "matched" | "internal_only" | "platform_only" | "unknown_campaign";
      orders: number;
      confirmedOrders: number;
      confirmedRevenue: number;
      pendingOrders: number;
      pendingRevenue: number;
      canceledOrders: number;
      canceledRevenue: number;
      examples: string[];
    }>;
    internalOnlyCampaigns?: Array<{
      campaignId: string | null;
      campaignName: string;
      platformCost: number;
      platformConversionValue: number;
      platformRoas: number | null;
      internalConfirmedRoas: number | null;
      roasGap: number | null;
      matchStatus: "matched" | "internal_only" | "platform_only" | "unknown_campaign";
      orders: number;
      confirmedOrders: number;
      confirmedRevenue: number;
      pendingOrders: number;
      pendingRevenue: number;
      canceledOrders: number;
      canceledRevenue: number;
      examples: string[];
    }>;
  };
  npayActualCorrection?: {
    windowDays: number;
    npayActualConfirmedPgCount: number;
    npayActualConfirmedPgRevenueKrw: number;
    internalConfirmedRoasCurrent: number | null;
    internalConfirmedRoasWithNpayActualPg: number | null;
    googleAdsBudgetFloorNpayExactCount: number;
    uploadCandidateCount: 0;
    npayActualWireStatus: string;
  };
  clickIdHealth?: {
    windowDays: number;
    generatedAt: string;
    source: string;
    mode: "no_send_read_only";
    orderCount: number;
    totalValueKrw: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    preservationRate: number | null;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    clickIdBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
    paymentMethodBreakdown: Array<{
      paymentMethod: "homepage" | "npay" | "unknown";
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number | null;
    }>;
    blockReasonCounts: {
      readOnlyPhase: number;
      approvalRequired: number;
      missingGoogleClickId: number;
      missingAttributionVmEvidence: number;
    };
  };
  googleCampaignMatchHealth?: GoogleCampaignMatchHealth;
  clickIdDropoffHealth?: GoogleClickIdDropoffHealth;
  npayBridgeReview?: GoogleNpayBridgeReview;
  conversionActionSegments?: {
    summary: {
      primaryConversionValue: number;
      allConversionValue: number;
      platformMinusInternalConfirmed: number;
      primaryKnownNpayConversionValue: number;
      primaryKnownNpayShareOfPlatform: number | null;
      allConversionValueMinusInternalConfirmed: number;
      knownNpayAllOnlyConversionValue?: number;
      nonPurchasePrimaryConversionValue?: number;
      gapAfterRemovingKnownNpayPrimary?: number;
    };
    actions: Array<{
      conversionActionId: string | null;
      conversionActionName: string;
      conversions: number;
      conversionValue: number;
      allConversions: number;
      allConversionValue: number;
      viewThroughConversions: number;
      status: string;
      category: string;
      primaryForGoal: boolean;
      countingType: string;
      classification: string;
      riskFlags: string[];
      campaignCount: number;
      shareOfPlatformConversionValue: number | null;
    }>;
    gapDrivers: Array<{
      key: string;
      label: string;
      value: number;
      shareOfPlatformConversionValue: number | null;
      confidence: "high" | "medium-high" | "medium";
      evidence: string;
      nextAction: string;
    }>;
  };
};

type GoogleClickIdDropoffResponse = {
  ok: boolean;
  fetchedAt: string;
  site: string;
  dateMode: "window" | "preset" | "custom";
  datePreset: string;
  dateRangeLiteral: string;
  dateRange: {
    startDate: string;
    endDate: string;
    startAt: string;
    endAt: string;
    endExclusiveAt?: string;
    timezone: string;
  };
  health: GoogleClickIdDropoffHealth;
};

type Snapshot = {
  preset: DatePreset;
  label: string;
  response: GoogleAdsDashboardResponse | null;
  error: string | null;
};

const fallbackSnapshots: Record<DatePreset, {
  label: string;
  platformRoas: number;
  internalRoas: number;
  internalWithNpayRoas: number;
  platformValue: number;
  internalRevenue: number;
  npayRevenue: number;
  cost: number;
  source: string;
  clickIdHealth: {
    generatedAt: string;
    orderCount: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    preservationRate: number;
    uploadCandidateCount: 0;
    source: string;
    blockReasonCounts: {
      missingAttributionVmEvidence: number;
    };
    paymentMethodBreakdown: Array<{
      paymentMethod: "homepage" | "npay" | "unknown";
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number;
    }>;
    clickIdBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
  };
}> = {
  last_7d: {
    label: "최근 7일",
    platformRoas: 10.04,
    internalRoas: 0.37,
    internalWithNpayRoas: 2.58,
    platformValue: 35268162,
    internalRevenue: 1285627,
    npayRevenue: 7771000,
    cost: 3512212,
    source: "VM Cloud live API snapshot, 2026-05-24 00:59 KST",
    clickIdHealth: {
      generatedAt: "2026-05-23T13:55:31.117Z",
      orderCount: 464,
      withGoogleClickId: 5,
      missingGoogleClickId: 459,
      preservationRate: 0.0108,
      uploadCandidateCount: 0,
      source: "VM Cloud public dashboard API snapshot",
      blockReasonCounts: {
        missingAttributionVmEvidence: 107,
      },
      paymentMethodBreakdown: [
        { paymentMethod: "homepage", orders: 439, withGoogleClickId: 5, missingGoogleClickId: 434, preservationRate: 0.0114 },
        { paymentMethod: "npay", orders: 25, withGoogleClickId: 0, missingGoogleClickId: 25, preservationRate: 0 },
      ],
      clickIdBreakdown: { gclid: 5, gbraid: 2, wbraid: 0 },
    },
  },
  last_30d: {
    label: "최근 30일",
    platformRoas: 9.94,
    internalRoas: 0.28,
    internalWithNpayRoas: 2.22,
    platformValue: 211426031,
    internalRevenue: 5899827,
    npayRevenue: 41297700,
    cost: 21265019,
    source: "VM Cloud live API snapshot, 2026-05-23 22:55 KST",
    clickIdHealth: {
      generatedAt: "2026-05-23T13:55:54.559Z",
      orderCount: 2244,
      withGoogleClickId: 16,
      missingGoogleClickId: 2228,
      preservationRate: 0.0071,
      uploadCandidateCount: 0,
      source: "VM Cloud public dashboard API snapshot",
      blockReasonCounts: {
        missingAttributionVmEvidence: 592,
      },
      paymentMethodBreakdown: [
        { paymentMethod: "homepage", orders: 2079, withGoogleClickId: 16, missingGoogleClickId: 2063, preservationRate: 0.0077 },
        { paymentMethod: "npay", orders: 165, withGoogleClickId: 0, missingGoogleClickId: 165, preservationRate: 0 },
      ],
      clickIdBreakdown: { gclid: 16, gbraid: 11, wbraid: 1 },
    },
  },
};

const fallbackCampaignMatchHealth: Record<DatePreset, GoogleCampaignMatchHealth> = {
  last_7d: {
    windowDays: 7,
    generatedAt: "2026-05-20 23:00 KST",
    source: "VM Cloud SQLite read-only snapshot",
    mode: "no_send_read_only",
    baseline: {
      candidateStartedAtKst: "2026-05-20 23:00 KST",
      effectiveForRoasRecalculation: false,
      effectiveFromKst: null,
      policy: "오늘 작업일은 후보 기준점입니다. 신규 유입에서 gad_campaignid 보존이 확인된 뒤 ROAS 재계산 기준점으로 승격합니다.",
    },
    siteLanding: {
      rows: 13160,
      googleClickIdRows: 10364,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 434,
      utmPresentGoogleClickIdRows: 9930,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0419,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    paidClickIntent: {
      rows: 10952,
      googleClickIdRows: 10839,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 377,
      utmPresentGoogleClickIdRows: 10575,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0348,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    attributionLedger: {
      rows: 4367,
      gadCampaignIdRows: 107,
      googleClickIdEvidenceRows: 4314,
      confirmedPaymentSuccessRows: 371,
      confirmedRowsWithGadCampaignId: 2,
      latestAt: "2026-05-20T13:53:54.707Z",
    },
    confidenceThresholds: {
      exactClickViewPct: 95,
      gadCampaignIdWithClickIdPct: 85,
      gadCampaignIdSessionOnlyPct: 70,
      utmOnlyPct: 50,
      unmappedPct: 0,
    },
    topCampaignIds: [
      { campaignId: "23249701426", campaignName: null, rows: 72, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "23844227518", campaignName: null, rows: 12, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "21808018766", campaignName: null, rows: 8, confirmedRows: 0, matchedToDashboardCampaign: false },
      { campaignId: "14629255429", campaignName: null, rows: 6, confirmedRows: 1, matchedToDashboardCampaign: false },
      { campaignId: "22018178854", campaignName: null, rows: 4, confirmedRows: 1, matchedToDashboardCampaign: false },
    ],
    summary: {
      status: "allowlist_deployed_waiting_new_click",
      mappedRows: 0,
      unmappedRows: 811,
      recoverableRowsAfterAllowlist: 811,
      uploadCandidateCount: 0,
      interpretation: "gad_campaignid allowlist는 배포됐습니다. 신규 Google 클릭 row가 쌓인 뒤 매칭률을 다시 확인해야 합니다.",
    },
    caveats: [
      "gad_campaignid는 캠페인 ID 힌트이며 Google Ads upload 후보가 아닙니다.",
      "오늘 작업일은 후보 기준점이며 post-deploy smoke 후 기준점으로 승격합니다.",
    ],
  },
  last_30d: {
    windowDays: 30,
    generatedAt: "2026-05-20 23:00 KST",
    source: "VM Cloud SQLite read-only snapshot",
    mode: "no_send_read_only",
    baseline: {
      candidateStartedAtKst: "2026-05-20 23:00 KST",
      effectiveForRoasRecalculation: false,
      effectiveFromKst: null,
      policy: "오늘 작업일은 후보 기준점입니다. 신규 유입에서 gad_campaignid 보존이 확인된 뒤 ROAS 재계산 기준점으로 승격합니다.",
    },
    siteLanding: {
      rows: 15920,
      googleClickIdRows: 12427,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 586,
      utmPresentGoogleClickIdRows: 11844,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0472,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    paidClickIntent: {
      rows: 17171,
      googleClickIdRows: 17040,
      gadCampaignIdRows: 0,
      gadSourceRows: 0,
      utmBlankGoogleClickIdRows: 826,
      utmPresentGoogleClickIdRows: 16345,
      currentCampaignIdCoverageRate: 0,
      potentialCoverageRateAfterAllowlist: 0.0485,
      latestAt: "2026-05-20T13:58:35.127Z",
    },
    attributionLedger: {
      rows: 30943,
      gadCampaignIdRows: 572,
      googleClickIdEvidenceRows: 8471,
      confirmedPaymentSuccessRows: 1743,
      confirmedRowsWithGadCampaignId: 15,
      latestAt: "2026-05-20T13:53:54.707Z",
    },
    confidenceThresholds: {
      exactClickViewPct: 95,
      gadCampaignIdWithClickIdPct: 85,
      gadCampaignIdSessionOnlyPct: 70,
      utmOnlyPct: 50,
      unmappedPct: 0,
    },
    topCampaignIds: [],
    summary: {
      status: "allowlist_deployed_waiting_new_click",
      mappedRows: 0,
      unmappedRows: 1412,
      recoverableRowsAfterAllowlist: 1412,
      uploadCandidateCount: 0,
      interpretation: "gad_campaignid allowlist는 배포됐습니다. 신규 Google 클릭 row가 쌓인 뒤 매칭률을 다시 확인해야 합니다.",
    },
    caveats: [
      "gad_campaignid는 캠페인 ID 힌트이며 Google Ads upload 후보가 아닙니다.",
      "오늘 작업일은 후보 기준점이며 post-deploy smoke 후 기준점으로 승격합니다.",
    ],
  },
};

const phasePlan = [
  {
    phase: "Phase 1",
    sprint: "Sprint 1",
    title: "신규 Google 클릭 row가 어떤 파라미터를 들고 들어오는지 확인",
    status: "클릭 단계 수집 확인",
    progress: 86,
    tone: "warn",
    why: "이 일은 Google 광고 클릭이 실제로 어떤 증거를 남기는지 보는 단계입니다. gclid/gbraid/wbraid는 Google Ads에 다시 붙일 수 있는 클릭 식별자이고, gad_campaignid는 어느 캠페인에서 온 클릭인지 나누는 번호입니다. 둘이 같은 row에 남아야 캠페인별 내부 ROAS를 믿고 쪼갤 수 있습니다.",
    cadence: "배포나 실제 광고 클릭 후 T+30분, T+2시간, T+24시간에만 재조회합니다. 계속 감시하려는 것이 아니라 `클릭 URL 파라미터가 들어오나`, `그 값이 결제 단계까지 이어지나`, `캠페인 ID가 Google Ads 캠페인 목록과 맞나`를 순서대로 판정하기 위해서입니다.",
    steps: [
      "고객 유입 장부(site_landing_ledger)에서 실제 랜딩 URL에 gclid/gbraid/wbraid와 gad_campaignid/gad_source가 함께 남는지 셉니다. 이것은 광고 클릭이 사이트 첫 진입에서 보존되는지 보는 지표입니다.",
      "유료 클릭 의도 장부(paid_click_intent_ledger)에서 같은 파라미터가 allowed query로 저장되는지 봅니다. 이것은 GTM/아임웹 태그가 클릭 직후 파라미터를 놓치지 않는지 보는 지표입니다.",
      "결제완료 장부(attribution_ledger payment_success confirmed)에서 같은 캠페인 ID가 주문까지 남는지 봅니다. 이것은 예산 판단용 ROAS에 쓸 수 있는 주문 단계 증거입니다.",
      "Google Ads 캠페인 목록과 gad_campaignid를 대조해 `번호는 있는데 캠페인명을 못 찾는 row`를 분리합니다. 이름이 안 붙는 row는 예산 증액 근거가 아니라 매핑 보강 대상입니다.",
    ],
    success: "클릭 단계에서는 신규 Google click id row의 85% 이상이 gad_campaignid를 함께 가져오고, 주문 단계에서는 confirmed payment_success row에도 같은 증거가 남아야 합니다. 클릭 단계만 통과하면 수집은 성공이지만 ROAS 전송 후보는 아닙니다.",
    currentResult: "2026-05-23 23:02 KST read-only 확인: 5월 21일 21:15 이후 고객 유입 장부는 Google click id 2,857건 중 gad_campaignid 2,751건(96.29%), 유료 클릭 의도 장부는 2,927건 중 2,901건(99.11%)입니다. 클릭 단계 수집은 정상으로 봅니다.",
    nextDecision: "다음 병목은 주문 단계입니다. 같은 기간 결제완료 129건 중 주문 기준 click id 보존은 0건이라, Google Ads upload 후보는 계속 0건으로 두고 payment_success exact evidence 연결을 먼저 보강해야 합니다.",
    owner: "Codex",
    evidence: "VM Cloud SQLite read-only + /api/google-ads/dashboard-summary · raw click id/order id 미출력",
  },
  {
    phase: "Phase 1",
    sprint: "Sprint 2",
    title: "Google Ads 최종 URL 설정에서 캠페인 ID가 안 붙는 원인 좁히기",
    status: "조사 완료",
    progress: 70,
    tone: "normal",
    why: "운영 원장에는 Google click id가 들어오는데 gad_campaignid가 없으므로, 수집기 문제가 아니라 Google Ads URL 옵션에 campaign id 삽입이 없는지 확인해야 합니다.",
    cadence: "최종 URL audit은 설정이 바뀔 때 1회, 그 뒤 신규 클릭 smoke 1회만 다시 합니다.",
    steps: [
      "Google Ads API final URL audit에서 final URL suffix, tracking template, manual UTM 존재 여부를 확인합니다.",
      "현재 캠페인/광고/asset group URL에 Google click id 계열과 campaign id 계열 파라미터가 들어가는지 분리합니다.",
      "실제 방문 원장에 campaign id가 충분히 들어오면 URL suffix 보강은 보류하고, 특정 캠페인 누락이 반복될 때만 제한 보강안을 엽니다.",
    ],
    success: "URL 설정 변경 없이도 신규 클릭 row에서 gclid/gbraid/wbraid와 gad_campaignid가 함께 보존되면 보강은 하지 않습니다. campaign id가 빠지는 캠페인만 별도 보강 대상으로 남깁니다.",
    currentResult: "2026-05-25 final URL audit: 바이오컴 final URL 108개, 수동 UTM 52개, final URL suffix/tracking template 0개입니다. 하지만 실제 방문 원장은 최근 7일 Google click id 7,066건, 분석 v2 이후 paid-click intent gad_campaignid 778/787건으로 확인됩니다.",
    nextDecision: "URL suffix 일괄 보강은 보류합니다. 지금 우선순위는 결제완료 주문에서 click id가 끊기는 지점과 NPay bridge 후보를 좁히는 것입니다.",
    owner: "Codex",
    evidence: "/api/google-ads/final-url-audit?customer_id=2149990943",
  },
  {
    phase: "Phase 2",
    sprint: "Sprint 1",
    title: "campaign id coverage와 unknown campaign order를 줄이는 dry-run",
    status: "1차 완료",
    progress: 55,
    tone: "warn",
    why: "현재 내부 결제 주문 일부는 campaign id나 UTM 힌트가 있지만 Google Ads 캠페인 목록과 정확히 붙지 않아, 캠페인별 증액 판단에 바로 쓰기 어렵습니다.",
    cadence: "last_7d는 신규 클릭 확인 시점마다, last_30d는 하루 1회만 재조회합니다. 목적은 화면 숫자 감시가 아니라 매칭 규칙 개선 전후 차이 확인입니다.",
    steps: [
      "last_7d 내부 주문의 campaignIdCoverage, unknownCampaignOrders, internalOnlyCampaigns를 뽑습니다.",
      "unknown 묶음을 UTM 예시, campaign id 예시, confirmed revenue 기준으로 나눠 사람이 검토할 우선순위를 정합니다.",
      "Google Ads 활성 캠페인 목록과 붙는 항목만 캠페인별 ROAS 후보로 승격하고, UTM만 있는 항목은 진단용으로 남깁니다.",
    ],
    success: "unknownCampaignOrders가 줄고, confirmed revenue가 있는 캠페인의 85% 이상이 Google campaign id 또는 검증된 UTM evidence로 설명됩니다.",
    currentResult: "last_7d live 기준 campaignIdCoverage 58%, matchedCampaignOrders 1건, unknownCampaignOrders 10건입니다. unknown confirmed revenue는 약 104만원입니다.",
    nextDecision: "gad_campaignid 신규 수집이 열리면 같은 dry-run을 재실행해 58%가 올라가는지 봅니다.",
    owner: "Codex",
    evidence: "/api/google-ads/dashboard-summary?date_preset=last_7d",
  },
  {
    phase: "Phase 2",
    sprint: "Sprint 2",
    title: "실제 결제완료 주문만 no-send 후보로 재계산",
    status: "재실행 완료",
    progress: 40,
    tone: "hold",
    why: "Google Ads에 보낼 수 있는 구매 신호는 실제 결제완료 주문이어야 하고, 클릭 ID와 중복 방지 키가 있어야 합니다. 전송 전 후보 품질을 외부 영향 없이 고정합니다.",
    cadence: "click id 보존 개선 후 1회 재실행합니다. 보존률이 10% 미만이면 매일 반복하지 않고 유실 지점 수정을 먼저 합니다.",
    steps: [
      "운영 결제완료 dry-run 후보를 Google Ads offline conversion payload preview로 변환합니다.",
      "missing_google_click_id, missing_attribution_vm_evidence, already_in_ga4, NPay intent ambiguity를 block reason으로 분리합니다.",
      "send_candidate는 승인 전 0건으로 유지하고, 후보 품질만 측정합니다.",
    ],
    success: "click id 보존률이 95%에 가까워지고, missing_google_click_id가 큰 폭으로 줄며, structurally eligible 후보가 생깁니다.",
    currentResult: "2026-05-21 no-send 재실행: 결제완료 후보 623건, click id 보존 5건, missing_google_click_id 618건, send_candidate 0건입니다.",
    nextDecision: "URL/receiver 보강으로 신규 클릭-주문 연결이 개선된 뒤 다시 실행합니다.",
    owner: "Codex",
    evidence: "data/google-ads-confirmed-purchase-candidate-prep-20260521.json",
  },
] as const;

const keyResults = [
  {
    id: "KR1",
    title: "광고 클릭 ID가 주문까지 보존된다",
    targetPct: 95,
    currentPct: 75,
    status: "운영화 판단 전",
    owner: "TJ + Codex",
    actionPlan: "신규 클릭 row 확인, 유실 지점 진단, receiver 보존 정책 정리를 순서대로 끝냅니다.",
    conditions: [
      "랜딩 시점: gclid, gbraid, wbraid 중 하나가 raw URL과 구조화 필드에 남아야 합니다.",
      "중간 이동: checkout_start와 payment_success 사이에서 click id가 세션/first-party evidence로 이어져야 합니다.",
      "주문 연결: 결제완료 order_code 또는 channel_order_no와 click evidence가 같은 원장 row로 묶여야 합니다.",
      "품질 기준: 최근 7일 결제완료 주문 기준 보존률 95%에 근접하고 중복 저장이 없어야 합니다.",
    ],
    why: "광고 클릭 ID가 주문 완료 시점까지 남아야 Google 광고비와 실제 결제완료 주문을 같은 고객 여정으로 묶을 수 있습니다. 24h canary로 유실, 중복, 서버 부담을 먼저 확인해야 잘못된 클릭 증거를 정식 원장에 쌓지 않습니다.",
    evidence: "2026-05-21 실클릭 canary: site_landing/attribution 보존 PASS, paid_click_intent exact row MISS",
    tone: "normal",
  },
  {
    id: "KR2",
    title: "Google ROAS gap을 원인별로 설명한다",
    targetPct: 85,
    currentPct: 68,
    status: "보고서 화면화",
    owner: "Codex",
    actionPlan: "last_7d는 클릭 smoke 때, last_30d는 하루 1회만 재조회하고 gap 원인을 platform value, 내부 confirmed, NPay actual, campaign coverage로 나눕니다.",
    conditions: [
      "예산 판단값: 내부 confirmed ROAS와 NPay actual 보정값이 같은 화면에 표시되어야 합니다.",
      "참고값: Google platform ROAS는 플랫폼 주장값으로 별도 표시되어야 합니다.",
      "캠페인 판단: campaign id coverage와 unknownCampaignOrders가 함께 보여야 합니다.",
      "운영 기준: gap이 왜 생겼는지 NPay, click id, campaign id, GA4 누락 중 어디인지 설명되어야 합니다.",
    ],
    why: "Google Ads ROAS가 높아 보이는 이유가 실제 광고 효율인지, NPay 전환값 과대계상인지, 내부 매출 누락인지 분리해야 예산 증액 판단을 할 수 있습니다. 원인을 나누지 않으면 ROAS 숫자는 커도 어느 캠페인을 키울지 결정할 수 없습니다.",
    evidence: "최근 7일 Google platform ROAS 7.93x, 내부 confirmed ROAS 0.27x, campaignIdCoverage 58%",
    tone: "normal",
  },
  {
    id: "KR3",
    title: "실제 결제완료 전환 후보가 no-send로 검증된다",
    targetPct: 60,
    currentPct: 35,
    status: "no-write 후보 확장",
    owner: "Codex",
    actionPlan: "NPay bridge 후보를 A급, B급, 보류로 나누고 Google click id가 있는 주문만 별도 표시합니다. 영구 원장 write 전까지는 Google Ads 전송 후보 0건을 유지합니다.",
    conditions: [
      "후보 정의: 홈페이지와 NPay 실제 결제완료 주문만 포함해야 합니다.",
      "연결 근거: 각 후보에 gclid/gbraid/wbraid 또는 Google Ads가 인정할 click id가 있어야 합니다.",
      "중복 방지: order_id, 결제완료 시각, 금액 기반 dedupe key가 안정적이어야 합니다.",
      "영구 evidence: matcher version, 기준 window, GA4 guard status, block reason이 append-only snapshot에 남아야 합니다.",
      "전송 전제: conversion action 생성, upload 승인, consent 정책 확인 전 send_candidate는 0건이어야 합니다.",
    ],
    why: "실제 결제완료 주문만 Google Ads에 보낼 후보로 삼으려면 주문마다 click id, 주문 연결, GA4 중복 방지 근거가 있어야 합니다. A급 후보가 생겼더라도 영구 장부에 고정되기 전에는 운영 기준 전환으로 쓰면 안 됩니다.",
    evidence: "live NPay bridge review: 내부 후보와 Google Ads 전송 후보를 분리 표시, 영구 snapshot 0건",
    tone: "warn",
  },
  {
    id: "KR4",
    title: "Google Ads 전환 변경은 승인 전 0건으로 막힌다",
    targetPct: 100,
    currentPct: 100,
    status: "금지선 유지",
    owner: "TJ + Codex",
    actionPlan: "BI confirmed_purchase 병행 관측, upload dry-run, Google Ads UI 승인 전까지 실제 전송과 Primary 변경을 하지 않습니다.",
    conditions: [
      "플랫폼 영향 0: Google Ads conversion upload는 실행하지 않습니다.",
      "입찰 학습 영향 0: Primary 전환 설정을 바꾸지 않습니다.",
      "운영 데이터 영향 0: 운영DB write/import 없이 read-only와 로컬 문서화만 합니다.",
      "승인 조건: 7일 이상 안정 관측, click id 보존률 개선, 후보 dedupe 검증, TJ님 명시 승인까지 필요합니다.",
    ],
    why: "conversion upload와 Primary 전환 변경은 Google 자동입찰 학습과 운영 화면 숫자를 직접 바꿉니다. 검증 전 실행하면 Google이 실제 구매가 아니라 오염된 NPay 클릭/결제시작 신호를 좋은 고객으로 학습할 수 있어, 승인 전 0건 유지가 손실 방지 장치입니다.",
    evidence: "GDN harness: upload candidate 0건 유지",
    tone: "hold",
  },
] as const;

const evidenceRows = [
  {
    decision: "예산 판단값",
    use: "내부 confirmed ROAS를 우선 본다",
    source: "VM Cloud attribution ledger + 운영DB NPay actual snapshot",
    caveat: "NPay 실제 결제완료는 포함하지만, NPay 클릭과 결제 시작 count는 구매가 아니다.",
  },
  {
    decision: "참고값",
    use: "Google platform ROAS는 단독 증액 근거로 쓰지 않는다",
    source: "Google Ads API customer 2149990943",
    caveat: "최근 데이터에서도 primary known NPay value가 platform value의 거의 전부를 차지한다.",
  },
  {
    decision: "전송 후보",
    use: "현재 upload 후보는 0건으로 둔다",
    source: "confirmed_purchase no-send prep + GDN harness rules",
    caveat: "Google Ads conversion upload, 전환 액션 변경, 캠페인 예산 변경은 모두 TJ님 명시 승인 전 금지다.",
  },
  {
    decision: "캠페인별 판단",
    use: "campaign id coverage가 닫힌 행만 안전하게 본다",
    source: "Google Ads campaign metrics + 내부 order evidence",
    caveat: "UTM hint만으로 캠페인별 ROAS를 확정하지 않는다.",
  },
];

const confirmationRequests = [
  {
    title: "Google Ads URL 추적 파라미터 보강",
    status: "현재 보류",
    owner: "Codex",
    when: "24시간 smoke는 이미 지났고, 현재는 전체 URL suffix를 바로 바꿀 필요가 없습니다. 신규 클릭에서 gclid/gbraid/wbraid와 gad_campaignid가 VM Cloud에 들어오고 있기 때문입니다.",
    why: "Google Ads 최종 URL suffix와 tracking template은 0건이지만, 실제 방문 원장에서는 최근 7일 바이오컴 Google click id 7,066건과 수동 UTM 52개 URL이 확인됐습니다. 즉 지금 문제는 `클릭 값이 안 붙는 것`보다 `결제완료 주문까지 직접 이어지지 않는 것`입니다.",
    screen: "Google Ads UI > 계정 또는 캠페인 URL 옵션 > 최종 URL suffix 또는 추적 템플릿",
    effect: "지금 당장 바꾸지 않습니다. 이후 특정 캠페인에서만 gad_campaignid가 빠지는 증거가 나오면 그 캠페인 단위로만 URL suffix 보강안을 다시 엽니다.",
    success: "클릭 단계에서는 paid-click intent 기준 Google click id 100%, gad_campaignid 95% 이상이 유지되고, 주문 단계 병목은 별도 bridge 작업으로 분리됩니다.",
    fallback: "특정 활성 캠페인에서 campaign id가 0으로 반복되면 account level 일괄 변경이 아니라 campaign/ad group level 제한 보강으로 진행합니다.",
  },
  {
    title: "ROAS 재계산 기준점 승격 컨펌",
    status: "증거 확인 후",
    owner: "TJ님 + Codex",
    when: "gad_campaignid 신규 보존이 확인되고 최소 24시간 동안 중복/5xx/메모리 문제가 없을 때입니다.",
    why: "오늘 작업일은 후보 기준점입니다. 실제로 추적이 가능해진 시점부터만 이후 ROAS를 비교해야 전후 효과가 섞이지 않습니다.",
    screen: "/ads/google-roas-report의 캠페인 ID 매칭률 카드와 VM Cloud read-only row evidence",
    effect: "그 시각 이후 주문부터 campaign id 기반 내부 ROAS 재계산 대상으로 삼습니다.",
    success: "effectiveFromKst가 채워지고, campaignIdCoverage가 신규 주문에서 상승합니다.",
    fallback: "신규 주문 표본이 부족하면 클릭 row 기준으로 먼저 기준점을 열고 주문 표본은 7일 관측합니다.",
  },
  {
    title: "Google Ads 실제 전환 전송 승인 보류",
    status: "아직 승인 대상 아님",
    owner: "TJ님",
    when: "click id 보존률이 충분히 올라가고 no-send prep에서 structurally eligible 후보가 생긴 뒤입니다.",
    why: "현재 no-send 재실행 결과는 결제완료 후보 623건 중 click id 보존 5건뿐이라, 지금 전송하면 대부분의 실제 주문을 Google Ads가 받을 수 없습니다.",
    screen: "향후 conversion action 설정 화면과 upload dry-run 결과 문서",
    effect: "승인 전까지 Google Ads 학습값과 운영 전환값은 바꾸지 않습니다.",
    success: "send_candidate는 계속 0건이고, 후보 품질만 개선됩니다.",
    fallback: "보존률 개선 전에는 전송 설계보다 유실 지점 수정이 우선입니다.",
  },
] as const;

const activeReadOnlyWork = [
  {
    title: "신규 클릭 row 재조회",
    items: [
      "T+2시간과 T+24시간에만 VM Cloud read-only SQL과 dashboard API를 재조회합니다.",
      "목적은 단순 모니터링이 아니라 `gad_campaignid=0` 문제가 Google Ads URL 설정 문제인지 확정하는 것입니다.",
      "성공 기준은 신규 Google 클릭 1건 이상에서 click id와 campaign id가 동시에 남는 것입니다.",
    ],
  },
  {
    title: "unknown campaign order dry-run",
    items: [
      "이미 1차 실행했고, last_7d 기준 campaignIdCoverage 58%, unknownCampaignOrders 10건을 확인했습니다.",
      "다음 재실행은 gad_campaignid 신규 수집이 확인된 뒤 1회만 합니다.",
      "목표는 unknown 주문의 매출 우선순위를 보고, 85% 이상 신뢰 가능한 캠페인 연결만 ROAS 후보로 올리는 것입니다.",
    ],
  },
  {
    title: "confirmed_purchase no-send 재실행",
    items: [
      "오늘 재실행 결과는 623건 중 click id 5건, send_candidate 0건입니다.",
      "다음 재실행은 click id 보존 구조가 개선된 뒤 진행합니다.",
      "목표는 missing_google_click_id 618건을 줄여, 실제 결제완료 주문을 Google Ads가 받을 수 있는 후보로 만드는 것입니다.",
    ],
  },
] as const;

const exactEvidenceReadiness = {
  checkedAtKst: "2026-05-23 21:50 KST",
  source: "VM Cloud SQLite read-only matcher + 운영DB 주문 read-only + GA4 BigQuery robust guard",
  window: "2026-05-16부터 2026-05-23까지",
  statusLabel: "영구 반영 전",
  statusTone: "hold",
  plainDecision:
    "실제 NPay 결제완료 주문과 Google 클릭 의도가 붙는 강한 후보는 생겼습니다. 하지만 화면은 live NPay bridge API 숫자를 우선 표시하며, 영구 장부에 고정하기 전에는 Google Ads 전송이나 Primary 전환 판단에 쓰지 않습니다.",
  npayIntentRows: 340,
  npayConfirmedOrders: 25,
  strongMatch: 19,
  gradeAMatch: 13,
  gradeBMatch: 6,
  ambiguous: 6,
  clickedNoPurchase: 296,
  gradeAAmountKrw: 1956900,
  ga4CheckedIds: 26,
  ga4Present: 0,
  ga4RobustAbsent: 26,
  permanentSnapshotRows: 0,
  uploadCandidateCount: 0,
  nextAction:
    "다음 단계는 live NPay bridge 후보 중 A급만 append-only exact evidence snapshot으로 남길지 검토하는 것입니다. 이 작업은 VM Cloud schema/write라 TJ님 승인 전 실행하지 않습니다.",
  interpretationSteps: [
    {
      label: "클릭",
      state: "Google 클릭은 들어오고 있음",
      detail: "clicked no purchase 296건 중 다수는 gclid+fbp 조합입니다. 클릭 유입 자체는 존재합니다.",
    },
    {
      label: "결제 완료",
      state: "NPay 실제 결제완료 주문이 있음",
      detail: "7일 기준 NPay 실제 결제완료 주문 25건이 확인됐습니다. NPay actual은 실제 매출로 포함해야 합니다.",
    },
    {
      label: "주문 연결",
      state: "A급과 B급을 분리",
      detail: "임시 matcher 기준의 숫자는 live NPay bridge API 숫자로 대체합니다. B급과 ambiguous 후보는 자동 반영하지 않습니다.",
    },
    {
      label: "중복 방지",
      state: "GA4 중복 흔적 없음",
      detail: "주문 ID 후보 26개를 GA4 raw에서 조회했고 present 0, robust_absent 26입니다.",
    },
    {
      label: "운영 반영",
      state: "아직 장부 고정 전",
      detail: "영구 snapshot row는 0건입니다. 승인 전 Google Ads upload 후보도 0건으로 유지합니다.",
    },
  ],
} as const;

const fallbackNpayBridgeReview: GoogleNpayBridgeReview = {
  generatedAt: "2026-05-25T06:54:00.000+09:00",
  source: "npay_intent_rematch_dry_run",
  mode: "no_write_no_send",
  windowLabel: "2026-05-18 ~ 2026-05-25 KST",
  sourceFreshness: {
    dryRunGeneratedAt: "2026-05-25T06:54:00.000+09:00",
    ordersSource: "readonly operational_postgres.public.tb_iamweb_users",
    intentsSource: "readonly VM Cloud SQLite npay_intent_log",
  },
  summary: {
    liveIntentCount: 256,
    googleLikeIntentCount: 188,
    googleLikeIntentWithGoogleClickId: 186,
    googleClickIdIntentCount: 186,
    googleClickIdIntentBreakdown: {
      gclid: 186,
      gbraid: 0,
      wbraid: 0,
    },
    liveIntentWithNpayBridgeUrlHash: 0,
    googleLikeIntentWithNpayBridgeUrlHash: 0,
    enteredNotCompletedBreakdown: {
      total: 0,
      pendingWindow: 0,
      loginGatePossible: 0,
      checkoutOpenedPossible: 0,
      matchingGapPossible: 0,
    },
    actualConfirmedNpayOrders: 23,
    internalBridgeStrongCandidates: 20,
    internalBridgeExactCandidates: 20,
    internalBridgeExactWithGoogleClickId: 1,
    bridgeCandidatesWithNpayBridgeUrlHash: 0,
    bridgeCandidatesWithGoogleClickId: 1,
    gradeA: 13,
    gradeAWithNpayBridgeUrlHash: 0,
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash: 0,
    gradeB: 7,
    gradeBWithGoogleClickId: 1,
    gradeBBlockedByTimeGap: 2,
    gradeBBlockedByAmount: 4,
    gradeBBlockedByMissingGoogleClickId: 6,
    gradeBPromotableToGradeANow: 0,
    googleLikeCompletedOrders: 1,
    googleLikeCompletedAmountKrw: 39000,
    googleLikeCompletedWithDirectGoogleClickId: 0,
    ambiguous: 3,
    purchaseWithoutIntent: 0,
    googleAdsSendCandidates: 0,
    vmCloudWrite: 0,
    operationalDbWrite: 0,
  },
  plainMeaning:
    "NPay는 결제가 네이버 화면에서 끝나므로 우리 사이트 결제완료 row에 Google click id가 직접 남기 어렵습니다. 대신 NPay 버튼 클릭 시각과 내부 주문 생성 시각이 거의 같으면, 내부 분석에서는 같은 주문으로 볼 수 있는 후보가 됩니다.",
  noWritePolicy:
    "이 표는 검토용입니다. VM Cloud 원장에 bridge row를 쓰거나 Google Ads로 전송한 내역은 없습니다.",
  caveats: [
    "최근 후보 8건만 표시합니다. 전체 20건은 문서의 7일 확장 no-write 후보표에 있습니다.",
    "검토표 문서: /project/google-npay-bridge-exact-review-table-20260525.md",
  ],
  campaignSummary: [
    {
      campaignId: "22018178848",
      campaignName: "Google campaign 22018178848",
      internalBridgeCandidates: 1,
      bridgeCandidatesWithGoogleClickId: 1,
      gradeA: 0,
      gradeB: 1,
      amountKrw: 39000,
      googleAdsSendCandidates: 0,
    },
    {
      campaignId: null,
      campaignName: "campaign id 없는 NPay bridge 후보",
      internalBridgeCandidates: 19,
      bridgeCandidatesWithGoogleClickId: 0,
      gradeA: 13,
      gradeB: 6,
      amountKrw: 1917900,
      googleAdsSendCandidates: 0,
    },
  ],
  rows: [
    {
      orderNumber: "202605250761319",
      channelOrderNo: "2026052543910790",
      paidAt: "2026-05-24T16:48:00.000Z",
      orderAmount: 35000,
      productName: "뉴로마스터 60정",
      strongGrade: "A",
      score: 115,
      scoreGap: 115,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id"],
      internalBridgeDecision: "strong_bridge_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605258312977",
      channelOrderNo: "2026052543224440",
      paidAt: "2026-05-24T15:29:00.000Z",
      orderAmount: 117000,
      productName: "뉴로마스터 60정",
      strongGrade: "B",
      score: 85,
      scoreGap: 85,
      timeGapMinutes: 0.5,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0.5,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id", "not_grade_a_auto_apply"],
      internalBridgeDecision: "manual_review_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605256770558",
      channelOrderNo: "2026052543211160",
      paidAt: "2026-05-24T15:28:00.000Z",
      orderAmount: 39000,
      productName: "바이오밸런스 90정",
      strongGrade: "A",
      score: 115,
      scoreGap: 115,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id"],
      internalBridgeDecision: "strong_bridge_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605242388870",
      channelOrderNo: "2026052441984490",
      paidAt: "2026-05-24T14:10:00.000Z",
      orderAmount: 39000,
      productName: "바이오밸런스 90정",
      strongGrade: "A",
      score: 115,
      scoreGap: 115,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id"],
      internalBridgeDecision: "strong_bridge_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605242646467",
      channelOrderNo: "2026052431047480",
      paidAt: "2026-05-24T04:53:00.000Z",
      orderAmount: 39000,
      productName: "바이오밸런스 90정",
      strongGrade: "B",
      score: 105,
      scoreGap: 45,
      timeGapMinutes: 12.5,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: true,
      googleClickIdTypes: ["gclid", "gbraid"],
      gadCampaignId: "22018178848",
      campaignIdEvidenceSource: "paid_click_intent_same_client_session",
      utmCampaign: "googleads_biocom_biobalance_PM(USP2)",
      recommendedAction: "manual_review_before_apply",
      blockReasons: ["not_grade_a_auto_apply"],
      internalBridgeDecision: "manual_review_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605230353959",
      channelOrderNo: "2026052317893930",
      paidAt: "2026-05-23T10:28:00.000Z",
      orderAmount: 55600,
      productName: "리셋데이",
      strongGrade: "B",
      score: 95,
      scoreGap: 95,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "shipping_reconciled",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id", "not_grade_a_auto_apply"],
      internalBridgeDecision: "manual_review_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605228438079",
      channelOrderNo: "2026052292291400",
      paidAt: "2026-05-22T13:50:00.000Z",
      orderAmount: 496000,
      productName: "종합 대사기능&음식물 과민증 검사 Set",
      strongGrade: "A",
      score: 115,
      scoreGap: 115,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "final_exact",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id"],
      internalBridgeDecision: "strong_bridge_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
    {
      orderNumber: "202605219905505",
      channelOrderNo: "2026052154742690",
      paidAt: "2026-05-21T04:48:00.000Z",
      orderAmount: 56400,
      productName: "팀키토 오리지널 도시락",
      strongGrade: "A",
      score: 113,
      scoreGap: 113,
      timeGapMinutes: 0,
      orderCreatedAt: "",
      orderCreatedGapMinutes: 0,
      orderCreateTimeBridge: "exact",
      amountMatchType: "shipping_reconciled",
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      gadCampaignId: null,
      campaignIdEvidenceSource: "none",
      utmCampaign: "",
      recommendedAction: "review_but_no_google_click_id",
      blockReasons: ["missing_google_click_id"],
      internalBridgeDecision: "strong_bridge_candidate",
      googleAdsSendDecision: "blocked_no_send",
    },
  ],
} as const;

const postPatchClickIdHealth = {
  checkedAtKst: "2026-05-24 13:09 KST",
  patchStartedAtKst: "2026-05-21 21:15 KST",
  source: "VM Cloud SQLite + 운영DB tb_iamweb_users read-only",
  confidence: "클릭 row 수집은 높음, payment_success confirmed 직접 보존은 0건입니다. same GA session 후보는 upload 후보가 아니라 진단용으로만 봅니다.",
  clickStage: {
    siteLanding: {
      label: "고객 유입 장부",
      googleClickIdRows: 2865,
      gadCampaignIdRows: 2759,
      gadSourceRows: 2759,
      gclidRows: 2863,
      gbraidRows: 152,
      wbraidRows: 2,
      coverageRate: 0.9630,
      why: "광고 클릭 직후 URL 파라미터가 사이트 첫 진입에서 사라지지 않는지 확인합니다.",
    },
    paidClickIntent: {
      label: "유료 클릭 의도 장부",
      googleClickIdRows: 2935,
      gadCampaignIdRows: 2909,
      gadSourceRows: 2909,
      gclidRows: 2933,
      gbraidRows: 1,
      wbraidRows: 1,
      coverageRate: 0.9911,
      why: "GTM/아임웹 태그가 클릭 직후 허용 파라미터를 저장했는지 확인합니다.",
    },
    attributionLedger: {
      label: "결제완료 장부",
      googleClickIdEvidenceRows: 0,
      gadCampaignIdRows: 0,
      confirmedPaymentSuccessRows: 141,
      confirmedRowsWithGadCampaignId: 0,
      why: "실제 결제완료 신호에 click id가 직접 남는지 확인합니다. 여기서 0이면 Google Ads upload 후보가 아닙니다.",
    },
  },
  orderStage: {
    orderCount: 141,
    totalValueKrw: null,
    withGoogleClickId: 0,
    missingGoogleClickId: 141,
    preservationRate: 0,
    priorSameGaSessionRows: 1,
    strictSameSessionAndClientRows: 0,
    invalidAfterSameClientRows: 1,
    uploadCandidateCount: 0,
    clickIdBreakdown: { gclid: 0, gbraid: 0, wbraid: 0 },
    evidenceCounts: {
      ledgerEvidence: 107,
      intentEvidence: 0,
      missingAttributionVmEvidence: 34,
    },
    paymentMethodBreakdown: [
      { paymentMethod: "homepage" as const, orders: 138, withGoogleClickId: 0, preservationRate: 0 },
      { paymentMethod: "npay" as const, orders: 3, withGoogleClickId: 0, preservationRate: 0 },
    ],
  },
  evidenceGrades: [
    {
      grade: "A",
      label: "직접 보존",
      count: 0,
      description: "confirmed 결제완료 row에 gclid/gbraid/wbraid가 직접 남은 경우입니다. Google Ads upload 가능 후보의 최소 출발점입니다.",
      upload: "가능 후보",
    },
    {
      grade: "B",
      label: "같은 GA 세션 + 같은 client id",
      count: 0,
      description: "결제 전 click과 결제완료가 같은 GA 세션과 client id로 동시에 붙은 경우입니다. 내부 분석용 강한 후보지만 upload는 보류합니다.",
      upload: "보류",
    },
    {
      grade: "C",
      label: "같은 GA 세션만 일치",
      count: 1,
      description: "결제 1.3분 전 같은 GA 세션에서 gclid가 보인 경우입니다. client id 엄격 일치가 없어 원인 진단용으로만 씁니다.",
      upload: "불가",
    },
  ],
  decision:
    "5월 21일 밤 보강 이후 클릭 단계는 정상화됐지만, confirmed 결제완료 직접 보존률은 아직 0%입니다. 같은 GA 세션 후보 1건은 원인 진단에는 쓰되 Google Ads upload 후보로 승격하지 않습니다.",
} as const;

const analysisAlgorithmV2Baseline = {
  baselineAtKst: "2026-05-25 06:30 KST",
  label: "분석 알고리즘 v2 기준점",
  meaning:
    "이 시각부터는 NPay 외부 결제 흐름을 내부 bridge 후보와 Google Ads 전송 후보로 분리해서 읽습니다. 코드 보존 기준점이 아니라 분석 기준점입니다.",
} as const;

const staticDropoffStage = (
  key: string,
  label: string,
  source: string,
  rows: number,
  googleClickIdRows: number,
  gadCampaignIdRows: number,
  latestAt: string | null,
  plainMeaning: string,
): GoogleClickIdDropoffStage => ({
  key,
  label,
  source,
  rows,
  googleClickIdRows,
  gadCampaignIdRows,
  coverageRate: rows > 0 ? googleClickIdRows / rows : null,
  latestAt,
  plainMeaning,
});

const fallbackClickIdDropoffHealth: GoogleClickIdDropoffHealth = {
  generatedAt: postPatchClickIdHealth.checkedAtKst,
  source: "VM Cloud SQLite + 운영DB tb_iamweb_users read-only snapshot",
  mode: "no_send_read_only",
  baselines: {
    clickIdCapturePatchKst: postPatchClickIdHealth.patchStartedAtKst,
    analysisAlgorithmV2Kst: analysisAlgorithmV2Baseline.baselineAtKst,
    policy:
      "5월 21일은 클릭 보존 코드 기준점이고, 5월 25일은 NPay bridge와 주문 직접 보존을 나눠 읽는 분석 기준점입니다.",
  },
  stageSummary: {
    clickStageOk: true,
    checkoutStageHasGoogleEvidence: false,
    paymentSuccessDirectPreserved: false,
    likelyLossPoint: "결제완료 신호를 실제 주문번호와 exact로 붙이는 단계",
    manualClickTestNeeded: false,
  },
  stages: {
    siteLanding: staticDropoffStage(
      "site_landing",
      "광고 클릭 직후 URL",
      "site_landing_ledger",
      postPatchClickIdHealth.clickStage.siteLanding.googleClickIdRows,
      postPatchClickIdHealth.clickStage.siteLanding.googleClickIdRows,
      postPatchClickIdHealth.clickStage.siteLanding.gadCampaignIdRows,
      null,
      postPatchClickIdHealth.clickStage.siteLanding.why,
    ),
    paidClickIntent: staticDropoffStage(
      "paid_click_intent",
      "클릭 의도 저장",
      "paid_click_intent_ledger",
      postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows,
      postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows,
      postPatchClickIdHealth.clickStage.paidClickIntent.gadCampaignIdRows,
      null,
      postPatchClickIdHealth.clickStage.paidClickIntent.why,
    ),
    checkoutStarted: staticDropoffStage(
      "checkout_started",
      "구매하기 진입",
      "attribution_ledger.checkout_started",
      0,
      0,
      0,
      null,
      "구매하기 진입 단계에서 click id가 살아 있는지 live API로 더 깊게 봅니다.",
    ),
    paymentPageSeen: staticDropoffStage(
      "payment_page_seen",
      "결제 화면 체류",
      "attribution_ledger.payment_page_seen",
      0,
      0,
      0,
      null,
      "결제 화면에서 click id가 살아 있는지 live API로 더 깊게 봅니다.",
    ),
    paymentSuccessAll: staticDropoffStage(
      "payment_success_all",
      "결제완료 신호 전체",
      "attribution_ledger.payment_success",
      postPatchClickIdHealth.clickStage.attributionLedger.confirmedPaymentSuccessRows,
      postPatchClickIdHealth.clickStage.attributionLedger.googleClickIdEvidenceRows,
      postPatchClickIdHealth.clickStage.attributionLedger.gadCampaignIdRows,
      null,
      postPatchClickIdHealth.clickStage.attributionLedger.why,
    ),
    paymentSuccessConfirmedDirect: staticDropoffStage(
      "payment_success_confirmed_direct",
      "실제 결제완료 주문 직접 보존",
      "operational_db + attribution/intent exact evidence",
      postPatchClickIdHealth.orderStage.orderCount,
      postPatchClickIdHealth.orderStage.withGoogleClickId,
      0,
      null,
      "취소/환불을 제외한 실제 결제완료 주문에 Google click id가 직접 붙었는지 봅니다.",
    ),
    npayIntentExact: {
      ...staticDropoffStage(
        "npay_intent_exact",
        "NPay 클릭-주문 exact 후보",
        "npay_intent_log",
      fallbackNpayBridgeReview.summary.actualConfirmedNpayOrders,
      fallbackNpayBridgeReview.summary.internalBridgeExactWithGoogleClickId,
        0,
        null,
        "NPay 외부 결제는 직접 보존이 약하므로 내부 bridge 후보와 Google Ads 전송 후보를 분리합니다.",
      ),
      matchedOrderRows: fallbackNpayBridgeReview.summary.internalBridgeExactCandidates,
      matchedOrderGoogleClickIdRows: fallbackNpayBridgeReview.summary.internalBridgeExactWithGoogleClickId,
    },
  },
  stageComparisons: [
    {
      fromKey: "site_landing",
      toKey: "paid_click_intent",
      fromLabel: "광고 클릭 직후 URL",
      toLabel: "클릭 의도 저장",
      fromGoogleClickIdRows: postPatchClickIdHealth.clickStage.siteLanding.googleClickIdRows,
      toGoogleClickIdRows: postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows,
      apparentLostClickIdRows: 0,
      comparisonRate: 1,
      interpretation: "광고 클릭 직후 URL과 클릭 의도 저장 단계는 모두 Google click id가 보입니다.",
      nextProbe: "이 구간은 당장 핵심 병목이 아닙니다.",
    },
    {
      fromKey: "paid_click_intent",
      toKey: "checkout_started",
      fromLabel: "클릭 의도 저장",
      toLabel: "구매하기 진입",
      fromGoogleClickIdRows: postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows,
      toGoogleClickIdRows: 0,
      apparentLostClickIdRows: postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows,
      comparisonRate: 0,
      interpretation: "클릭 저장에는 보이지만 구매하기 진입 단계 live API 세부 row는 아직 보강 확인이 필요합니다.",
      nextProbe: "checkout-context 저장값과 sessionStorage handoff를 확인합니다.",
    },
    {
      fromKey: "payment_success_all",
      toKey: "payment_success_confirmed_direct",
      fromLabel: "결제완료 신호 전체",
      toLabel: "실제 결제완료 주문 직접 보존",
      fromGoogleClickIdRows: postPatchClickIdHealth.clickStage.attributionLedger.googleClickIdEvidenceRows,
      toGoogleClickIdRows: postPatchClickIdHealth.orderStage.withGoogleClickId,
      apparentLostClickIdRows: 0,
      comparisonRate: 0,
      interpretation: "결제완료 주문에 직접 남은 Google click id가 아직 없습니다.",
      nextProbe: "order_no/order_code/channel_order_no exact join을 확인합니다.",
    },
  ],
  paymentSuccessStatusBreakdown: [
    {
      paymentStatus: "confirmed",
      rows: postPatchClickIdHealth.orderStage.orderCount,
      googleClickIdRows: postPatchClickIdHealth.orderStage.withGoogleClickId,
      gadCampaignIdRows: 0,
      coverageRate: postPatchClickIdHealth.orderStage.preservationRate,
      latestAt: null,
    },
  ],
  orderEvidenceBreakdown: {
    orderCount: postPatchClickIdHealth.orderStage.orderCount,
    withGoogleClickId: postPatchClickIdHealth.orderStage.withGoogleClickId,
    missingGoogleClickId: postPatchClickIdHealth.orderStage.missingGoogleClickId,
    missingAttributionVmEvidence: postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence,
    paymentSuccessLedgerRows: postPatchClickIdHealth.orderStage.evidenceCounts.ledgerEvidence,
    npayIntentRows: postPatchClickIdHealth.orderStage.evidenceCounts.intentEvidence,
    bothRows: 0,
    noneRows: postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence,
    clickIdFromPaymentSuccessLedgerRows: 0,
    clickIdFromNpayIntentRows: 0,
    clickIdFromBothRows: 0,
    interpretation:
      "실제 결제완료 주문 다수는 결제완료 ledger evidence는 있으나 Google click id가 없습니다. 주문번호 bridge와 click id 복원 경로가 다음 병목입니다.",
  },
  conclusion: {
    status: "click_capture_ok_order_direct_missing",
    plain:
      "광고 클릭과 클릭 의도 저장은 정상에 가깝지만, 실제 결제완료 주문에는 click id가 직접 남지 않습니다. NPay bridge 후보표와 payment_success exact 연결을 나눠 봐야 합니다.",
    nextAction:
      "영구 원장 write 전까지 NPay bridge no-write 후보표를 넓히고, Google Ads 전송 후보는 0건으로 유지합니다.",
  },
  invariants: {
    uploadCandidateCount: 0,
    sendCandidateCount: 0,
    externalSendCount: 0,
    operationalDbWrite: 0,
    vmCloudWrite: 0,
    rawClickIdInResponse: false,
  },
};

const projectOkr = {
  objective:
    "진짜 병목은 네이버 외부 결제창을 지난 뒤 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 것을 해결하는 것입니다.",
  currentPosition:
    "NPay 버튼 클릭은 많이 잡힙니다. 문제는 네이버 외부 결제 화면을 거친 뒤 실제 결제완료 주문과 버튼 클릭 row가 충분히 자동 연결되지 않고, 연결되더라도 Google click id가 주문 근거에 같이 남지 않는다는 점입니다.",
  decision:
    "보고서 예쁘게 보이는 문제가 아니라 NPay 외부 결제 흐름의 연결 장부를 닫는 일이 핵심입니다. Google Ads 전송은 실제 결제완료 주문과 click id가 같이 닫힌 후보만 씁니다.",
  baselines: [
    `클릭 보존 코드 기준점: ${postPatchClickIdHealth.patchStartedAtKst}`,
    `분석 알고리즘 v2 기준점: ${analysisAlgorithmV2Baseline.baselineAtKst}`,
  ],
  source:
    "source: VM Cloud live API + VM Cloud SQLite read-only + 운영DB read-only, no-send/no-write",
} as const;

const projectOkrResults = [
  {
    id: "KR1",
    title: "NPay 버튼 클릭 이후 어디서 이탈/유실되는지 단계별로 나눈다",
    now: "button_clicked, bridge_opened, checkout_opened_possible, completed, entered_not_completed 단계로 나눠 보고 있습니다.",
    target: "NPay 버튼 클릭 100건이 있으면 몇 건이 로그인에서 멈췄고, 몇 건이 결제서까지 갔고, 몇 건이 실제 결제완료가 됐는지 채널별로 설명합니다.",
    why: "버튼 클릭은 구매가 아닙니다. 결제완료까지 가지 않은 이유를 알아야 광고 예산 문제인지 결제 UX 문제인지 분리할 수 있습니다.",
  },
  {
    id: "KR2",
    title: "NPay 실제 결제완료 주문을 버튼 클릭 row와 자동으로 붙인다",
    now: "A급은 자동 연결 가능 후보, B급은 수동 검토 후보, ambiguous는 여러 후보가 겹친 주문으로 나눕니다.",
    target: "실제 NPay 결제완료 주문의 90% 이상을 A/B/미분류 사유로 자동 설명합니다.",
    why: "실제 결제완료 주문이 어느 버튼 클릭에서 왔는지 모르면 Google/Meta/오가닉 중 어느 유입이 매출을 만들었는지 알 수 없습니다.",
  },
  {
    id: "KR3",
    title: "광고 클릭 증거를 주문 근거와 같이 남긴다",
    now: "Google 광고 흔적이 있는 NPay 버튼 클릭은 많이 잡히지만, 실제 결제완료 주문으로 넘어오며 direct/미분류가 크게 남습니다.",
    target: "Google/Meta/Naver/organic/direct/unknown 분류에서 unknown과 direct/출처 유실 비중을 꾸준히 줄입니다.",
    why: "실제 구매가 있어도 광고 클릭 증거가 없으면 Google Ads에는 보낼 수 없고, 예산 판단도 흐려집니다.",
  },
  {
    id: "KR4",
    title: "Google Ads에는 실제 결제완료 주문만 보낸다",
    now: "전송 가능 출발점은 실제 구매, 금액, click id, 중복 방지 key가 맞는 row만 따로 봅니다.",
    target: "자동 전송 장부가 중복/취소/환불/테스트 click id를 막고, 실제 결제완료 후보만 소량 자동 전송합니다.",
    why: "Google Ads가 버튼 클릭이 아니라 실제 구매 고객을 학습해야 ROAS 갭이 줄어듭니다.",
  },
] as const;

const projectActionPlan = [
  {
    step: "1",
    owner: "Codex",
    title: "NPay 버튼 클릭부터 결제완료까지 퍼널을 매일 같은 기준으로 본다",
    why: "버튼 클릭이 많은데 결제완료가 적은 이유가 로그인 이탈인지, 결제서 이탈인지, 주문 연결 유실인지 먼저 갈라야 합니다.",
    how: "NPay intent, bridge URL, checkout 후보, 실제 결제완료 주문을 같은 7일 창으로 묶어 channel별 전환율을 계산합니다.",
    dependency: "로컬 구현은 독립 진행 가능. 운영 반영은 별도 배포 승인 필요.",
    success: "Google/Meta/기타별 NPay 버튼 클릭, bridge 열린 건수, 결제완료 건수, entered_not_completed 건수가 한 줄로 설명됩니다.",
    failureCheck: "숫자가 이상하면 버튼 클릭 원장, bridge URL 저장률, NPay 주문 sync 시각을 먼저 확인합니다.",
    approval: "로컬 수정은 승인 불필요. VM Cloud/프론트 운영 배포는 승인 필요.",
    confidence: "95%",
  },
  {
    step: "2",
    owner: "Codex",
    title: "실제 NPay 결제완료 주문을 A/B/ambiguous로 자동 분류한다",
    why: "결제완료 주문을 어느 버튼 클릭과 붙일지 자동으로 닫아야 유입별 매출을 볼 수 있습니다.",
    how: "order_time, complete_time, 금액, 상품명, bridge host/path, 같은 브라우저/GA 세션, click id를 점수화합니다.",
    dependency: "live API가 최신 VM Cloud/운영DB를 읽을 수 있어야 합니다. 새 주문이 쌓일수록 판단력이 올라갑니다.",
    success: "A급은 자동 연결, B급은 막힌 이유, ambiguous는 여러 후보가 겹친 이유가 주문별로 나옵니다.",
    failureCheck: "B/ambiguous가 많으면 금액 보정, 상품명 정규화, bridge 원문 저장, 회원/브라우저 연결키 부족을 나눠 봅니다.",
    approval: "read-only 집계는 승인 불필요. DB write나 외부 전송은 승인 전 금지.",
    confidence: "90%",
  },
  {
    step: "3",
    owner: "Codex",
    title: "Google/Meta/Naver/organic/direct/unknown 유입 분류를 주문 단위로 좁힌다",
    why: "NPay 실제 매출은 맞지만 어떤 유입이 만든 매출인지 모르면 예산 판단이 계속 흔들립니다.",
    how: "버튼 클릭 row의 URL/UTM/click id와 직전 paid-click/landing 원장을 같이 봐서 최종 유입을 분류합니다.",
    dependency: "NPay actual 주문과 내부 intent 로그가 쌓여야 합니다. 실제 write는 별도 승인 전 하지 않습니다.",
    success: "direct/unknown이 왜 생겼는지 missing intent, missing click id, multiple intents, amount mismatch로 설명됩니다.",
    failureCheck: "direct가 높으면 실제 direct인지 외부 결제 중 출처 유실인지 NPay bridge 저장값을 먼저 봅니다.",
    approval: "no-write 검토는 승인 불필요. 영구 원장 write는 승인 필요.",
    confidence: "88%",
  },
  {
    step: "4",
    owner: "Codex",
    title: "Google Ads 실제 구매 전송 후보를 결제완료 기준으로만 만든다",
    why: "Google Ads가 버튼 클릭이 아니라 실제 결제완료 고객을 학습해야 ROAS 갭이 줄어듭니다.",
    how: "confirmed 주문만 대상으로 금액, 결제완료 시각, 취소/환불 제외, 중복 방지, gclid/gbraid/wbraid 존재 여부를 검사합니다.",
    dependency: "click id 직접 보존 또는 안전한 exact bridge 증거가 먼저 늘어야 합니다.",
    success: "후보마다 `보낼 수 있음`, `click id 없음`, `중복 위험`, `NPay bridge만 있음` 같은 차단 이유가 붙습니다.",
    failureCheck: "후보가 0건이면 전송을 열지 말고 click id 보존/bridge 문제로 되돌아갑니다.",
    approval: "no-send 생성은 승인 불필요. Google Ads upload 실행은 Red Lane이라 명시 승인 필요.",
    confidence: "86%",
  },
  {
    step: "5",
    owner: "TJ님 + Codex",
    title: "병목이 좁혀진 뒤에만 운영 전송/배포를 연다",
    why: "설명되지 않은 NPay 클릭 이탈과 출처 유실을 둔 채 전송만 늘리면 Google Ads 학습이 다시 오염될 수 있습니다.",
    how: "TJ님이 배포나 전송을 승인하면 Codex가 제한 건수, 중복 방지, 환불/취소 guard, 반영 모니터를 붙여 실행합니다.",
    dependency: "앞 단계 로컬 검증 통과와 TJ님 배포 승인 필요.",
    success: "운영에서도 NPay 퍼널 병목과 Google Ads 전송 후보가 분리되고, 전송 후 반영/실패가 장부에 남습니다.",
    failureCheck: "전송 실패가 늘면 click age, invalid/test click id, 전환 추적 기간, 날짜 축 불일치를 먼저 확인합니다.",
    approval: "운영 배포는 승인 필요. 외부 플랫폼 전송은 별도 승인 전 금지.",
    confidence: "82%",
  },
] as const;

const googlePurchaseClaimAudit = {
  checkedAtKst: "2026-05-26 00:54 KST",
  googleAdsAction: {
    actionId: "7130249515",
    actionName: "구매완료",
    simpleName: "Google Ads 주장 구매",
    primaryMeaning: "Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호",
    sendTo: "AW-304339096/r0vuCKvy-8caEJixj5EB",
    type: "WEBPAGE / WEBPAGE_ONCLICK",
    category: "PURCHASE",
  },
  siteEvidence: [
    {
      label: "아임웹 live HTML",
      finding:
        "상품 상세 페이지 HTML에 `GOOGLE_ADWORDS_TRACE.setUseNpayCount(true, ...)`가 있고, 이 값이 Google Ads `구매완료` send_to 라벨과 일치합니다.",
    },
    {
      label: "GTM live v145",
      finding:
        "GTM live에는 `r0vu...` Primary 라벨 태그가 아니라, NPay 링크 클릭용 `TechSol - [GAds]NPAY구매` Secondary 태그와 NPay/GA4 관련 태그가 보입니다.",
    },
    {
      label: "2026-05-26 NPay 버튼 smoke",
      finding:
        "제품 페이지에서 NPay 버튼만 눌렀고 실제 결제는 하지 않았는데도 `www.googleadservices.com/pagead/conversion/304339096` 요청이 발생했습니다. 요청 라벨은 Google Ads `구매완료`와 같은 `r0vuCKvy-8caEJixj5EB`였고, value=35000, currency=KRW가 같이 들어갔습니다.",
    },
    {
      label: "운영 원장",
      finding:
        "2026-05-21 21:15 KST 보강 이후 confirmed 결제완료 114건 중 Google click id가 직접 남은 주문은 0건입니다.",
    },
  ],
  decision:
    "NPay 버튼 클릭만으로 Google Ads `구매완료` 요청이 나가는 것을 확인했습니다. 따라서 기존 `구매완료`는 실제 결제완료 전용 구매가 아니라 Google Ads 주장 구매로 분리해서 봐야 합니다.",
  confirmedOnlyPlan:
    "기존 `구매완료` Primary는 바로 건드리지 않고, 실제 결제완료 주문만 후보로 세는 no-send dry-run 통로를 계속 준비합니다.",
} as const;

const googlePurchaseSignalSplit = [
  {
    label: "1. NPay 구매버튼/count 신호",
    verdict: "실제 결제완료 전용으로 볼 수 없음",
    detail:
      "아임웹 live HTML에서 NPay count 코드가 Google Ads `구매완료` send_to 라벨과 맞습니다. 이 신호는 사용자가 NPay 쪽으로 넘어가려는 행동을 세는 성격이 강합니다.",
    risk:
      "이 값이 Primary 전환이면 Google Ads 자동입찰은 `돈을 낸 사람`이 아니라 `NPay 버튼을 누른 사람`까지 좋은 구매 신호로 학습할 수 있습니다.",
  },
  {
    label: "2. NPay 실제 결제완료",
    verdict: "매출로 포함해야 함",
    detail:
      "네이버페이에서 결제가 끝난 주문은 실제 매출입니다. 다만 네이버 외부 화면에서 끝나기 때문에 우리 결제완료 URL에 Google click id가 직접 남지 않을 수 있습니다.",
    risk:
      "매출에는 포함해야 하지만, click id가 없으면 Google Ads에 `이 광고 클릭이 만든 구매`라고 보내면 안 됩니다.",
  },
  {
    label: "3. Google Ads 전송 후보",
    verdict: "현재 0건 유지",
    detail:
      "실제 결제완료 주문, 금액, 취소/환불 제외, 중복 방지, gclid/gbraid/wbraid 중 하나가 모두 맞아야 전송 후보가 됩니다.",
    risk:
      "지금은 전송을 열지 않고 no-send 후보 생성기로 차단 사유만 계속 쌓습니다.",
  },
] as const;

const googleAdsConversionCleanupPlan = [
  {
    step: "1. 지금은 Google Ads 숫자를 실제 구매로 쓰지 않습니다",
    owner: "Codex",
    lane: "Green",
    action:
      "보고서와 예산 판단에서 기존 `구매완료`를 `Google Ads 주장 구매`로 계속 분리합니다. Google Ads 설정은 아직 바꾸지 않습니다.",
    why:
      "2026-05-26 smoke에서 실제 결제 없이 NPay 버튼/네이버 진입 단계만으로 같은 `구매완료` 라벨 요청이 나갔기 때문입니다.",
    success:
      "운영자가 Google Ads ROAS를 참고값으로 보고, 실제 예산 판단은 내부 confirmed + NPay actual 매출로 봅니다.",
    approval:
      "승인 불필요. 보고서/문서/no-send 계산만 수행합니다.",
  },
  {
    step: "2. 실제 결제완료 전용 전환을 먼저 보조 신호로 준비합니다",
    owner: "Codex + TJ님",
    lane: "Red before Google Ads setting change",
    action:
      "새 전환 액션 후보를 `실제 결제완료 - 내부 원장 확인` 성격으로 설계하고, 처음에는 Secondary 전환=입찰에는 안 쓰고 관찰만 하는 보조 신호로 둡니다.",
    why:
      "기존 Primary를 바로 낮추면 자동입찰 학습이 흔들릴 수 있습니다. 대체 신호를 먼저 안정화해야 합니다.",
    success:
      "no-send 후보 생성기에서 실제 결제완료 주문, 금액, 취소/환불 제외, 중복 방지, Google click id 조건을 모두 통과한 후보가 생깁니다.",
    approval:
      "Google Ads 전환 액션 생성/변경은 TJ님 명시 승인 필요. 전송은 별도 승인 전 금지입니다.",
  },
  {
    step: "3. 7일 이상 비교 후 기존 `구매완료`의 Primary 여부를 결정합니다",
    owner: "TJ님 + Codex",
    lane: "Red",
    action:
      "새 실제 결제완료 신호가 안정되면 기존 `구매완료`를 Secondary로 낮추거나 계정 기본 목표에서 제외할지 결정합니다.",
    why:
      "현재 신호는 NPay 버튼/진입을 구매처럼 세기 때문에 ROAS를 부풀릴 수 있지만, 무작정 끄면 캠페인 학습이 급격히 바뀔 수 있습니다.",
    success:
      "Google Ads가 학습하는 구매 신호가 버튼 클릭이 아니라 실제 결제완료 주문 중심으로 바뀝니다.",
    approval:
      "Primary/Secondary 변경, 계정 기본 목표 변경, 캠페인 목표 변경은 모두 TJ님 승인 필요입니다.",
  },
] as const;

const googleNpayProofSteps = [
  {
    label: "랜딩 URL 확인",
    verdict: "보조 확인",
    detail:
      "광고 클릭 후 gclid/gbraid/gad_campaignid가 붙는지는 볼 수 있습니다. 하지만 이 확인만으로 Google Ads `구매완료`가 실제 결제완료인지 버튼 클릭인지 알 수는 없습니다.",
  },
  {
    label: "NPay 버튼 클릭 직후 네트워크 확인",
    verdict: "확인 완료",
    detail:
      "2026-05-26 smoke에서 제품 페이지 NPay 버튼만 눌렀는데 Google Ads `구매완료` 라벨 요청이 나갔습니다. 네이버 로그인/접근 오류 단계였고, 결제완료는 하지 않았습니다.",
  },
  {
    label: "실제 네이버페이 결제완료 테스트",
    verdict: "현재 불필요",
    detail:
      "버튼 클릭만으로 기존 `구매완료` 라벨이 발화되는 것이 확인됐으므로, 이 질문을 닫기 위한 실제 결제 테스트는 지금 필요하지 않습니다.",
  },
] as const;

const gradeBCurrentRead = [
  {
    label: "시간 기준 초과",
    value: "2건",
    detail:
      "주문 생성 시각과 금액은 맞지만 NPay 클릭 후 결제완료까지 2분을 넘었습니다. TJ님 테스트로 추정되는 20260524...1047480 건도 12.5분이라 여기에 들어갑니다.",
  },
  {
    label: "Google click id 없음",
    value: "2건",
    detail:
      "내부 주문 연결 근거는 있지만 gclid/gbraid/wbraid가 없어 Google Ads에 `이 광고 클릭이 만든 구매`라고 다시 보낼 수 없습니다.",
  },
  {
    label: "금액 불일치",
    value: "0건",
    detail:
      "묶음/수량/배송비 보정 이후 현재 B급의 주된 병목은 금액이 아니라 시간 기준과 click id 부재입니다.",
  },
] as const;

const npayGradeBWithClickIdReview = {
  title: "Google click id가 있는 NPay B급 1건",
  maskedInternalOrder: "20260524...646467",
  maskedChannelOrder: "20260524...1047480",
  amountKrw: 39000,
  productName: "바이오밸런스 90정",
  clickIdTypes: "gclid + gbraid",
  campaignId: "22018178848",
  timeGapMinutes: 12.5,
  decision: "내부 수동 검토 후보. Google Ads 전송 후보 아님.",
  plainReason:
    "실제 NPay 결제완료 주문이고 Google 광고 클릭 증거도 있지만, NPay 버튼 클릭 후 결제완료까지 약 12.5분이 걸렸습니다. 자동 A급 기준은 2분 이내라, 중간에 다른 행동이 끼었을 가능성을 보수적으로 남깁니다.",
  nextAction:
    "이 1건은 광고 예산 판단 참고에는 남기되, Google Ads에 실제 구매로 보내지 않습니다. 같은 유형이 반복되면 시간 기준을 바꾸기 전에 order bridge 원장을 먼저 고정해야 합니다.",
} as const;

const noWriteReviewChecklist = [
  {
    label: "실제 결제완료인가",
    pass: "NPay actual confirmed 주문만 봅니다",
    fail: "NPay 버튼 클릭, 결제 시작, 장바구니는 구매로 쓰지 않습니다.",
  },
  {
    label: "주문과 클릭 시간이 붙는가",
    pass: "주문 생성/결제완료 시각이 클릭 intent와 거의 붙으면 내부 bridge 후보입니다.",
    fail: "시간 간격이 크면 B급 또는 ambiguous로 남깁니다.",
  },
  {
    label: "금액이 설명되는가",
    pass: "최종 결제액, 배송비 포함, 묶음 상품 조합으로 설명되면 A급 후보입니다.",
    fail: "금액 설명이 안 되면 Google Ads 전송 후보로 올리지 않습니다.",
  },
  {
    label: "Google click id가 있는가",
    pass: "gclid/gbraid/wbraid 중 하나가 주문 근거와 같이 있어야 전송 검토가 시작됩니다.",
    fail: "click id가 없으면 내부 분석 후보일 뿐 Google Ads 전송 후보가 아닙니다.",
  },
] as const;

const noSendCandidateGuardrails = [
  {
    step: "후보 입력",
    plain:
      "실제 결제완료 주문만 넣습니다. pending 가상계좌, 취소/환불, 버튼 클릭, 결제 시작 신호는 제외합니다.",
  },
  {
    step: "주문 검증",
    plain:
      "주문번호, 결제완료 시각, 결제 금액, 결제수단, 취소/환불 여부를 확인합니다.",
  },
  {
    step: "광고 클릭 검증",
    plain:
      "주문과 같은 여정에 gclid/gbraid/wbraid 중 하나가 직접 있거나, 승인된 exact bridge evidence가 있어야 합니다.",
  },
  {
    step: "전송 전 차단",
    plain:
      "지금 단계에서는 Google Ads로 보내지 않습니다. 후보마다 `보낼 수 없는 이유`를 붙이는 no-send 모드입니다.",
  },
] as const;

const confirmedOnlyNoSendLatest = {
  generatedAtKst: "2026-05-26 01:57:00 KST",
  source:
    "VM Cloud public dashboard-summary aggregate + confirmed_purchase no-send builder",
  windows: [
    {
      label: "최근 7일",
      orders: 412,
      revenueKrw: 96392797,
      directClickEvidence: 3,
      missingClickId: 409,
      preservationRate: 0.0073,
      sendCandidate: 0,
      mainBlock:
        "대부분의 실제 결제완료 주문에 Google click id가 직접 남지 않았고, 공개 API는 주문별 전송 payload를 만들 수 있는 원자료를 주지 않습니다.",
    },
    {
      label: "최근 30일",
      orders: 2173,
      revenueKrw: 504691775,
      directClickEvidence: 16,
      missingClickId: 2157,
      preservationRate: 0.0074,
      sendCandidate: 0,
      mainBlock:
        "직접 보존률이 1% 미만이라 Google Ads 전송보다 결제완료 주문 bridge 보강이 먼저입니다.",
    },
    {
      label: "5월 21일 밤 보강 이후",
      orders: 114,
      revenueKrw: null,
      directClickEvidence: 0,
      missingClickId: 114,
      preservationRate: 0,
      sendCandidate: 0,
      mainBlock:
        "코드 보강 이후에도 실제 결제완료 주문 직접 보존은 아직 확인되지 않아, no-send 후보는 계속 차단됩니다.",
    },
  ],
  decision:
    "Google Ads에 실제 구매로 보낼 후보는 0건입니다. 지금은 후보마다 보낼 수 없는 이유를 쌓는 단계입니다.",
} as const;

const readyButNotSentReview = {
  checkedAtKst: "2026-05-26 01:52 KST",
  source: "/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id&limit=20",
  summary:
    "최근 7일 실제 결제완료 주문 중 Google click id가 직접 붙은 3건을 주문 단위로 다시 봤습니다. 세 건 모두 실제 카드 결제이고 취소/환불은 없지만, 아직 Google Ads 전송 대기 후보로 올리지 않습니다.",
  totalDirectEvidence: 3,
  reviewRows: 3,
  sendReadyButNotSent: 0,
  googleAdsSendCandidates: 0,
  rows: [
    {
      maskedOrder: "20260519...037917",
      paymentMethod: "카드",
      amountKrw: 245000,
      clickEvidence: "gclid + gbraid",
      purchaseCheck: "실제 결제완료 / 취소·환불 없음",
      decision: "직접 증거 후보",
      whyNotReady:
        "click id가 2종류라 전송용 식별자 하나를 고르는 규칙이 필요하고, 영구 safe_ref snapshot과 중복 방지 장부가 아직 열려 있지 않습니다.",
    },
    {
      maskedOrder: "20260520...016693",
      paymentMethod: "카드",
      amountKrw: 36900,
      clickEvidence: "gclid",
      purchaseCheck: "실제 결제완료 / 취소·환불 없음",
      decision: "직접 증거 후보",
      whyNotReady:
        "직접 gclid는 있지만, no-send 검토표 단계입니다. Google Ads 전송 승인과 dispatcher가 닫혀 있어 아직 전송 대기 후보가 아닙니다.",
    },
    {
      maskedOrder: "20260524...353635",
      paymentMethod: "카드",
      amountKrw: 234000,
      clickEvidence: "gclid",
      purchaseCheck: "실제 결제완료 / 취소·환불 없음",
      decision: "5월 21일 보강 이후 표본",
      whyNotReady:
        "보강 이후에도 직접 보존된 드문 표본입니다. 다만 단일 표본을 바로 Google Ads 학습에 보내지 않고, 7일 이상 같은 조건이 반복되는지 봅니다.",
    },
  ],
  blockers: [
    "Google Ads 전송 승인 없음",
    "전송 dispatcher 닫힘",
    "영구 safe_ref snapshot 0건",
    "중복 방지/환불 후속 반영 장부 미오픈",
  ],
} as const;

const googleAdsLastClickAssist = {
  checkedAtKst: "2026-05-29 13:15 KST",
  source:
    "VM Cloud upload ledger read-only + Google Ads API conversion/date comparison",
  decision:
    "Google Ads 기여 분석 모델은 데이터 기반으로 유지합니다. last-click은 설정값이 아니라 사람이 주문 흐름을 이해하기 위한 보조 카드입니다.",
  observed: {
    conversions: 9,
    valueKrw: 1555827,
    clickDateValueKrw: 1555827,
    conversionDateValueKrw: 1555827,
  },
  pendingRepeated245: {
    rows: 7,
    valueKrw: 1715000,
    sentWindowKst: "2026-05-29 01:18~02:59 KST",
    elapsedAtCheck: "약 10~12시간 경과",
    firstLikelyWindowKst: "2026-05-29 19:00~21:00 KST",
    mostLikelyWindowKst: "2026-05-30 13:00~15:00 KST",
    investigateAfterKst: "2026-06-01 01:00~03:00 KST",
  },
  cards: [
    {
      label: "Google Ads 실제 구매 전환",
      value: "9건 / ₩1,555,827",
      plain:
        "BI confirmed_purchase_offline로 보낸 주문 중 현재 Google Ads 리포트에서 확인되는 합계입니다.",
    },
    {
      label: "클릭 날짜 기준",
      value: "₩1,555,827",
      plain:
        "구매가 발생한 날이 아니라, Google 광고를 클릭한 날짜에 전환값을 나눠 보는 방식입니다.",
    },
    {
      label: "결제 날짜 기준",
      value: "₩1,555,827",
      plain:
        "실제 결제가 일어난 날짜에 전환값을 놓고 보는 방식입니다. 내부 주문 장부와 비교할 때 더 직관적입니다.",
    },
    {
      label: "아직 대기 중",
      value: "7건 / ₩1,715,000",
      plain:
        "전송은 됐지만 Google Ads 리포트에서 아직 분명하게 확인되지 않은 245,000원 반복 주문 묶음입니다.",
    },
  ],
  conditions: [
    {
      label: "click id가 Google에서 인정되는가",
      plain:
        "gclid/gbraid/wbraid가 실제 광고 클릭에서 온 값이어야 합니다. TEST/SMOKE 값은 후보 생성 단계에서 제외합니다.",
    },
    {
      label: "30일 클릭 연결 기간 안인가",
      plain:
        "BI confirmed_purchase_offline은 클릭연결 전환 추적 기간이 30일입니다. 클릭이 너무 오래됐으면 전송은 성공처럼 보여도 리포트에 안 붙을 수 있습니다.",
    },
    {
      label: "조회 날짜 축을 맞췄는가",
      plain:
        "데이터 기반 기여 분석은 구매 금액을 클릭 날짜 쪽으로 나눌 수 있습니다. 그래서 클릭 날짜 기준과 결제 날짜 기준을 같이 봐야 합니다.",
    },
    {
      label: "반영 지연 구간 안인가",
      plain:
        "지금 대기 7건은 전송 후 약 10~12시간 지난 상태입니다. 36시간 전까지는 지연으로 보고, 72시간을 넘으면 원인 점검 대상으로 봅니다.",
    },
  ],
} as const;

const fallbackPrivatePayloadPreview: GoogleAdsPrivatePayloadPreview = {
  ok: true,
  fetchedAt: "2026-05-26T11:32:10.000Z",
  generatedAt: "2026-05-26T11:32:10.000Z",
  site: "biocom",
  mode: "private_no_send_payload_preview",
  goal: "Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 원문 주문번호와 원문 gclid가 서버 내부에 있는지만 안전하게 확인한다.",
  progress: {
    privatePreviewProgressPct: 100,
    overallPrimaryConversionReadinessPct: 82,
    plain: "원문값 확인 장치는 준비됐지만, 실제 Google Ads 전송과 중복 전송 장부 연결은 아직 하지 않았습니다.",
  },
  window: {
    key: "last_7d",
    label: "최근 7일",
    startAt: "2026-05-19T00:00:00.000+09:00",
    endAt: "2026-05-26T23:59:59.999+09:00",
    timezone: "Asia/Seoul",
  },
  requestedLimit: 2,
  summary: {
    sourceOrderRows: 458,
    exactGclidActualPurchaseRows: 2,
    returnedCandidates: 2,
    privateRawValueChecksPassed: 2,
    uploadCandidateCount: 0,
    sendCandidateCount: 0,
  },
  candidates: [
    {
      candidateRank: 1,
      safeRef: "gads_private_bb913bed8f4fd5",
      maskedOrderRef: "masked",
      payment: {
        amountKrw: 36900,
        currencyCode: "KRW",
        paymentMethod: "CARD",
        paymentStatus: "PAYMENT_COMPLETE",
        isNpay: false,
        paidDateKst: "2026-05-20",
        actualPurchaseGuardPassed: true,
        cancelRefundReturnGuardPassed: true,
      },
      evidence: {
        source: "payment_success_ledger",
        exactClickIdType: "gclid",
        hasGclid: true,
        hasGbraid: false,
        hasWbraid: false,
        rawClickIdExposed: false,
        clickIdDigestPrefix: "private",
      },
      noSendPayloadShape: {
        conversionActionId: "7609289411",
        conversionActionName: "BI confirmed_purchase_offline",
        conversionActionResourceName: "customers/2149990943/conversionActions/7609289411",
        orderIdPresent: true,
        gclidPresent: true,
        conversionTimePresent: true,
        conversionValuePresent: true,
        currencyPresent: true,
        duplicateSendKeyHash: "private_preview",
        externalSendMode: "blocked_no_send_preview",
      },
      checks: [],
      readiness: {
        privateRawValueChecksPassed: true,
        privatePreviewProgressPct: 100,
        googleAdsSendReady: false,
        uploadCandidateCount: 0,
        sendCandidateCount: 0,
        blockReasons: ["google_ads_conversion_upload_not_approved", "google_ads_upload_ledger_not_connected"],
      },
    },
    {
      candidateRank: 2,
      safeRef: "gads_private_31670cbdcef49b",
      maskedOrderRef: "masked",
      payment: {
        amountKrw: 234000,
        currencyCode: "KRW",
        paymentMethod: "CARD",
        paymentStatus: "PAYMENT_COMPLETE",
        isNpay: false,
        paidDateKst: "2026-05-24",
        actualPurchaseGuardPassed: true,
        cancelRefundReturnGuardPassed: true,
      },
      evidence: {
        source: "payment_success_ledger",
        exactClickIdType: "gclid",
        hasGclid: true,
        hasGbraid: false,
        hasWbraid: false,
        rawClickIdExposed: false,
        clickIdDigestPrefix: "private",
      },
      noSendPayloadShape: {
        conversionActionId: "7609289411",
        conversionActionName: "BI confirmed_purchase_offline",
        conversionActionResourceName: "customers/2149990943/conversionActions/7609289411",
        orderIdPresent: true,
        gclidPresent: true,
        conversionTimePresent: true,
        conversionValuePresent: true,
        currencyPresent: true,
        duplicateSendKeyHash: "private_preview",
        externalSendMode: "blocked_no_send_preview",
      },
      checks: [],
      readiness: {
        privateRawValueChecksPassed: true,
        privatePreviewProgressPct: 100,
        googleAdsSendReady: false,
        uploadCandidateCount: 0,
        sendCandidateCount: 0,
        blockReasons: ["google_ads_conversion_upload_not_approved", "google_ads_upload_ledger_not_connected"],
      },
    },
  ],
  invariants: {
    rawOrderIdInResponse: false,
    rawClickIdInResponse: false,
    uploadCandidateCount: 0,
    sendCandidateCount: 0,
    externalSendCount: 0,
    operationalDbWrite: 0,
    vmCloudWrite: 0,
    googleAdsWrite: 0,
  },
  caveats: [
    "Fallback is the VM Cloud deployment smoke snapshot. Live API is preferred when reachable.",
  ],
};

const primaryConversionReadinessSteps = [
  {
    label: "1. 실제 구매 후보를 서버 내부에서 확인",
    status: "done",
    progress: 100,
    plain:
      "실제 결제완료이고, 금액이 있고, 취소/환불이 없고, 원문 gclid가 서버 안에 있는 후보 2건을 no-send로 확인했습니다.",
  },
  {
    label: "2. 중복 전송 방지 장부 설계",
    status: "in_progress",
    progress: 70,
    plain:
      "같은 주문을 Google Ads에 두 번 보내지 않도록 order safe ref, 전환 액션, 전송 시각, payload hash를 남기는 장부가 필요합니다.",
  },
  {
    label: "3. 제한 전송 승인안",
    status: "blocked_red",
    progress: 0,
    plain:
      "Google Ads에 실제 전환을 보내는 일은 광고 플랫폼 숫자와 자동입찰 학습을 바꾸므로 TJ님 별도 승인 전 실행하지 않습니다.",
  },
  {
    label: "4. 전송 후 검증과 중단 기준",
    status: "not_started",
    progress: 0,
    plain:
      "전송 직후 Google Ads 수신 여부, 중복 여부, 환불/취소 후속 처리 기준을 확인해야 주 전환으로 올릴 수 있습니다.",
  },
  {
    label: "5. Primary 전환 전환 판단",
    status: "not_started",
    progress: 0,
    plain:
      "Secondary로 관찰한 실제 구매 신호가 안정되면 Google Ads가 입찰 학습에 쓰는 Primary 후보로 올릴지 결정합니다.",
  },
] as const;

const fallbackConversionActionSegments: Record<DatePreset, NonNullable<GoogleAdsDashboardResponse["conversionActionSegments"]>> = {
  last_7d: {
    summary: {
      primaryConversionValue: 35268162.06,
      allConversionValue: 70877550.13,
      platformMinusInternalConfirmed: 35268162.06,
      primaryKnownNpayConversionValue: 35268160.06,
      primaryKnownNpayShareOfPlatform: 1,
      allConversionValueMinusInternalConfirmed: 70877550.13,
      knownNpayAllOnlyConversionValue: 35601091.99,
      nonPurchasePrimaryConversionValue: 2,
      gapAfterRemovingKnownNpayPrimary: 2,
    },
    actions: [
      {
        conversionActionId: "7130249515",
        conversionActionName: "구매완료",
        conversions: 228.45,
        conversionValue: 35268160.06,
        allConversions: 229.45,
        allConversionValue: 35513160.06,
        viewThroughConversions: 1,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: true,
        countingType: "MANY_PER_CLICK",
        classification: "primary_known_npay",
        riskFlags: ["known_npay_label", "primary_bid_signal_is_npay"],
        campaignCount: 4,
        shareOfPlatformConversionValue: 1,
      },
      {
        conversionActionId: "995043268",
        conversionActionName: "[G4] biocom.kr (web) sign_up",
        conversions: 2,
        conversionValue: 2,
        allConversions: 3,
        allConversionValue: 3,
        viewThroughConversions: 0,
        status: "ENABLED",
        category: "SIGNUP",
        primaryForGoal: true,
        countingType: "UNKNOWN",
        classification: "non_revenue_action",
        riskFlags: ["non_revenue_primary_value"],
        campaignCount: 2,
        shareOfPlatformConversionValue: 0,
      },
    ],
    gapDrivers: [],
  },
  last_30d: {
    summary: {
      primaryConversionValue: 219547012.62,
      allConversionValue: 423132609.16,
      platformMinusInternalConfirmed: 218218012.62,
      primaryKnownNpayConversionValue: 219546992.2,
      primaryKnownNpayShareOfPlatform: 1,
      allConversionValueMinusInternalConfirmed: 421803609.16,
      knownNpayAllOnlyConversionValue: 203541536.49,
      nonPurchasePrimaryConversionValue: 20.42,
      gapAfterRemovingKnownNpayPrimary: -1328979.58,
    },
    actions: [
      {
        conversionActionId: "7130249515",
        conversionActionName: "구매완료",
        conversions: 2105.34,
        conversionValue: 219546992.2,
        allConversions: 2119.34,
        allConversionValue: 222397999.2,
        viewThroughConversions: 15,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: true,
        countingType: "UNKNOWN",
        classification: "primary_known_npay",
        riskFlags: ["known_npay_label", "primary_bid_signal_is_npay"],
        campaignCount: 6,
        shareOfPlatformConversionValue: 1,
      },
      {
        conversionActionId: "7564830949",
        conversionActionName: "TechSol - NPAY구매 50739",
        conversions: 0,
        conversionValue: 0,
        allConversions: 1942.93,
        allConversionValue: 200690529.49,
        viewThroughConversions: 0,
        status: "ENABLED",
        category: "PURCHASE",
        primaryForGoal: false,
        countingType: "UNKNOWN",
        classification: "secondary_known_npay",
        riskFlags: ["known_npay_label", "all_conversions_only_value"],
        campaignCount: 6,
        shareOfPlatformConversionValue: 0,
      },
    ],
    gapDrivers: [],
  },
};

const formatKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value);
  const eok = Math.floor(rounded / 100000000);
  const man = Math.floor((rounded % 100000000) / 10000);
  if (eok > 0 && man > 0) return `₩${eok}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok > 0) return `₩${eok}억`;
  if (man > 0) return `₩${man.toLocaleString("ko-KR")}만`;
  return `₩${rounded.toLocaleString("ko-KR")}`;
};

const formatRoas = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}x` : "-";

const formatPct = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "-";

const formatRatePct = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "-";

const formatCount = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR") : "-";

const loadGoogleAdsPrivatePayloadPreview = async (): Promise<GoogleAdsPrivatePayloadPreview | null> => {
  const localUrl = `${API_BASE}/api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=2`;
  const urls = [];

  if (API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1")) {
    urls.push("/api/google-ads/private-payload-preview?site=biocom&window=last_7d&limit=2");
    urls.push(localUrl);
    urls.push("https://att.ainativeos.net/api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=2");
  } else {
    urls.push(localUrl);
  }

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json() as GoogleAdsPrivatePayloadPreview | { ok?: false };

      if (response.ok && data.ok && "summary" in data) {
        if (
          data.summary.returnedCandidates > 0
          || !url.includes("localhost")
          || !urls.some((candidateUrl) => candidateUrl.includes("att.ainativeos.net"))
        ) {
          return data;
        }
      }
    } catch {
      // Try the next source. The report has a VM Cloud smoke fallback below.
    }
  }

  return null;
};

const maskIdentifier = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return "없음";
  if (text.length <= 10) return `${text.slice(0, 3)}...`;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
};

const paymentMethodLabel = (value: "homepage" | "npay" | "unknown") => {
  if (value === "homepage") return "자사몰";
  if (value === "npay") return "NPay";
  return "미분류";
};

const bridgeGradeLabel = (value: "A" | "B" | null) => {
  if (value === "A") return "A급 내부 후보";
  if (value === "B") return "B급 수동 검토";
  return "등급 없음";
};

const bridgeDecisionLabel = (value: GoogleNpayBridgeReview["rows"][number]["internalBridgeDecision"]) => {
  if (value === "strong_bridge_candidate") return "내부 bridge 후보";
  return "수동 검토 후보";
};

const googleAdsSendDecisionLabel = (value: GoogleNpayBridgeReview["rows"][number]["googleAdsSendDecision"]) => {
  if (value === "blocked_no_send") return "전송 금지";
  return "전송 보류";
};

const campaignIdEvidenceSourceLabel = (
  value: GoogleNpayBridgeReview["rows"][number]["campaignIdEvidenceSource"],
) => {
  if (value === "intent_page_location") return "NPay intent URL";
  if (value === "paid_click_intent_same_client_session") return "같은 세션 paid-click";
  if (value === "site_landing_same_client_session") return "같은 세션 landing";
  return "campaign id 없음";
};

const amountMismatchCategoryLabel = (value: string | null | undefined) => {
  if (value === "quantity") return "수량";
  if (value === "cart_multi_item") return "장바구니/복수상품";
  if (value === "set_or_bundle") return "세트상품/묶음";
  if (value === "coupon_shipping") return "쿠폰·배송비";
  if (value === "insufficient_item_data") return "정보부족";
  if (value === "matched_or_reconciled") return "금액 설명됨";
  return "미분류 금액차";
};

const buildFallbackNpayFinalSourceSummary = (
  review: GoogleNpayBridgeReview,
): GoogleNpayFinalSourceSummary => {
  const googleRows = review.campaignSummary.filter(
    (row) => Boolean(row.campaignId) || row.bridgeCandidatesWithGoogleClickId > 0,
  );
  const noCampaignRows = review.campaignSummary.filter(
    (row) => !row.campaignId && row.bridgeCandidatesWithGoogleClickId === 0,
  );
  const googleCompletedOrders = googleRows.reduce((sum, row) => sum + row.internalBridgeCandidates, 0);
  const googleAmountKrw = googleRows.reduce((sum, row) => sum + row.amountKrw, 0);
  const directOrUnknownOrders = noCampaignRows.reduce((sum, row) => sum + row.internalBridgeCandidates, 0);
  const directOrUnknownAmountKrw = noCampaignRows.reduce((sum, row) => sum + row.amountKrw, 0);
  const unclassifiedCompletedOrders = Math.max(
    0,
    review.summary.actualConfirmedNpayOrders - review.summary.internalBridgeStrongCandidates,
  );

  return {
    totalCompletedOrders: review.summary.actualConfirmedNpayOrders,
    classifiedCompletedOrders: review.summary.internalBridgeStrongCandidates,
    unclassifiedCompletedOrders,
    googleEvidenceOrders: googleCompletedOrders,
    googleEvidenceAmountKrw: googleAmountKrw,
    byChannel: [
      {
        channel: "google",
        label: "Google 광고",
        completedOrders: googleCompletedOrders,
        amountKrw: googleAmountKrw,
        bridgeCandidateOrders: googleCompletedOrders,
        directGoogleClickIdOrders: review.summary.internalBridgeExactWithGoogleClickId,
        recoveredGoogleClickIdOrders: Math.max(
          0,
          review.summary.bridgeCandidatesWithRecoveredGoogleClickId ?? 0,
        ),
        confidence: googleCompletedOrders > 0 ? "medium" : "low",
        plain:
          "campaign id 또는 Google click id가 있는 내부 bridge 후보입니다. 실제 Google Ads 전송 후보와는 별도로 봅니다.",
      },
      {
        channel: "meta",
        label: "Meta",
        completedOrders: 0,
        amountKrw: 0,
        bridgeCandidateOrders: 0,
        directGoogleClickIdOrders: 0,
        recoveredGoogleClickIdOrders: 0,
        confidence: "low",
        plain: "현재 요약 API에는 Meta로 확정할 수 있는 NPay bridge 후보가 없습니다.",
      },
      {
        channel: "naver",
        label: "Naver",
        completedOrders: 0,
        amountKrw: 0,
        bridgeCandidateOrders: 0,
        directGoogleClickIdOrders: 0,
        recoveredGoogleClickIdOrders: 0,
        confidence: "low",
        plain: "현재 요약 API에는 Naver로 확정할 수 있는 NPay bridge 후보가 없습니다.",
      },
      {
        channel: "organic",
        label: "Organic 검색",
        completedOrders: 0,
        amountKrw: 0,
        bridgeCandidateOrders: 0,
        directGoogleClickIdOrders: 0,
        recoveredGoogleClickIdOrders: 0,
        confidence: "low",
        plain: "현재 요약 API에는 organic 검색으로 확정할 수 있는 NPay bridge 후보가 없습니다.",
      },
      {
        channel: "direct",
        label: "Direct/출처 없음",
        completedOrders: directOrUnknownOrders,
        amountKrw: directOrUnknownAmountKrw,
        bridgeCandidateOrders: directOrUnknownOrders,
        directGoogleClickIdOrders: 0,
        recoveredGoogleClickIdOrders: 0,
        confidence: "low",
        plain:
          "campaign id가 없는 내부 bridge 후보입니다. 실제 direct일 수도 있고, NPay 외부 결제 과정에서 출처가 유실됐을 수도 있습니다.",
      },
      {
        channel: "unknown",
        label: "미분류",
        completedOrders: unclassifiedCompletedOrders,
        amountKrw: 0,
        bridgeCandidateOrders: 0,
        directGoogleClickIdOrders: 0,
        recoveredGoogleClickIdOrders: 0,
        confidence: "low",
        plain: "버튼 클릭 row와 강하게 붙지 않아 유입을 단정하지 않습니다.",
      },
	    ],
    unclassifiedReasons: [],
	    dateDistribution: [],
	    source: "npay_intent_bridge_candidate_rows",
    basis:
      "VM Cloud NPay 버튼 클릭 원장과 실제 NPay 결제완료 주문을 먼저 붙이고, 붙은 후보의 광고/검색 흔적으로 유입을 나눕니다.",
    caveat:
      "이 fallback은 구버전 API를 위한 요약입니다. source별 원문 row가 배포되면 더 정확한 분류로 자동 대체됩니다.",
  };
};

const matchStatusLabel = (value: string) => {
  if (value === "matched") return "내부 주문 연결 있음";
  if (value === "platform_only") return "Google 주장만 있음";
  if (value === "internal_only") return "내부 주문만 있음";
  if (value === "unknown_campaign") return "캠페인 미확인";
  return "상태 확인";
};

const conversionClassificationLabel = (value: string) => {
  if (value === "primary_known_npay") return "Primary NPay 의심";
  if (value === "secondary_known_npay") return "Secondary NPay";
  if (value === "primary_purchase") return "Primary 구매";
  if (value === "secondary_purchase") return "Secondary 구매";
  if (value === "non_revenue_action") return "비매출 행동";
  if (value === "other_primary") return "기타 Primary";
  return "기타 Secondary";
};

const riskFlagLabel = (value: string) => {
  if (value === "known_npay_label") return "NPay label";
  if (value === "primary_bid_signal_is_npay") return "입찰 학습 신호";
  if (value === "all_conversions_only_value") return "All conv. 전용";
  if (value === "non_revenue_primary_value") return "비매출 Primary";
  return value;
};

const privatePreviewCheckLabel = (value: GoogleAdsPrivatePayloadPreviewCheck["key"]) => {
  if (value === "actual_purchase_guard") return "실제 결제완료";
  if (value === "exact_order_identifier") return "원문 주문 식별자";
  if (value === "exact_gclid") return "원문 gclid";
  if (value === "conversion_time") return "결제완료 시각";
  if (value === "conversion_value") return "결제금액";
  if (value === "currency") return "통화";
  if (value === "cancel_refund_return_guard") return "취소/환불 제외";
  if (value === "duplicate_key_material") return "중복 방지 key 재료";
  if (value === "conversion_action") return "전환 액션";
  if (value === "send_approval") return "전송 승인";
  if (value === "upload_ledger") return "전송 장부";
  return value;
};

const readinessStepStatusLabel = (value: (typeof primaryConversionReadinessSteps)[number]["status"]) => {
  if (value === "done") return "완료";
  if (value === "in_progress") return "진행 중";
  if (value === "blocked_red") return "승인 전 중지";
  return "대기";
};

const readinessStepStatusClass = (value: (typeof primaryConversionReadinessSteps)[number]["status"]) => {
  if (value === "done") return styles.status;
  if (value === "in_progress") return `${styles.status} ${styles.statusWarn}`;
  if (value === "blocked_red") return `${styles.status} ${styles.statusHold}`;
  return `${styles.status} ${styles.statusWarn}`;
};

const campaignMatchStatusLabel = (status: GoogleCampaignMatchHealth["summary"]["status"]) => {
  if (status === "campaign_id_collecting") return "수집 확인";
  if (status === "allowlist_deployed_waiting_new_click") return "신규 row 대기";
  if (status === "needs_allowlist_deploy") return "배포 필요";
  if (status === "no_google_click_id_rows") return "표본 없음";
  return "원장 없음";
};

const campaignMatchStatusClass = (status: GoogleCampaignMatchHealth["summary"]["status"]) => {
  if (status === "campaign_id_collecting") return styles.status;
  if (status === "allowlist_deployed_waiting_new_click") return `${styles.status} ${styles.statusWarn}`;
  if (status === "needs_allowlist_deploy") return `${styles.status} ${styles.statusWarn}`;
  return `${styles.status} ${styles.statusHold}`;
};

const roleStatusClass = (status: string) => {
  if (status === "usable_for_budget_review" || status === "usable_for_order_join" || status === "monitoring") {
    return styles.status;
  }
  if (status === "collecting" || status === "needs_exact_click_diagnosis") {
    return `${styles.status} ${styles.statusWarn}`;
  }
  return `${styles.status} ${styles.statusHold}`;
};

const roleStatusLabel = (status: string) => {
  if (status === "usable_for_budget_review") return "예산 판단 가능";
  if (status === "usable_for_order_join") return "주문 연결 가능";
  if (status === "monitoring") return "태그 관찰 정상";
  if (status === "needs_exact_click_diagnosis") return "exact-click 진단 필요";
  if (status === "collecting") return "더 쌓는 중";
  return "사용 보류";
};

const campaignHealthSplitCards = (health: GoogleCampaignMatchHealth) => {
  const roasAttribution = health.healthSplit?.roasAttribution ?? {
    source: "site_landing_ledger_and_attribution_ledger" as const,
    status: health.siteLanding.gadCampaignIdRows > 0 ? "usable_for_budget_review" as const : "collecting" as const,
    rows: health.siteLanding.rows,
    googleClickIdRows: health.siteLanding.googleClickIdRows,
    gadCampaignIdRows: health.siteLanding.gadCampaignIdRows,
    currentCampaignIdCoverageRate: health.siteLanding.currentCampaignIdCoverageRate,
    latestAt: health.siteLanding.latestAt,
    interpretation:
      "예산 판단용 내부 ROAS는 고객 유입 원장과 주문 원장을 우선 기준으로 봅니다. paid-click-intent 태그 원장과 섞지 않습니다.",
  };
  const orderAttribution = health.healthSplit?.orderAttribution ?? {
    source: "attribution_ledger" as const,
    status: health.attributionLedger.confirmedRowsWithGadCampaignId > 0 ? "usable_for_order_join" as const : "collecting" as const,
    rows: health.attributionLedger.rows,
    googleClickIdEvidenceRows: health.attributionLedger.googleClickIdEvidenceRows,
    confirmedPaymentSuccessRows: health.attributionLedger.confirmedPaymentSuccessRows,
    confirmedRowsWithGadCampaignId: health.attributionLedger.confirmedRowsWithGadCampaignId,
    latestAt: health.attributionLedger.latestAt,
    interpretation:
      "결제완료 주문까지 이어진 evidence입니다. 플랫폼 전송 후보가 아니라 내부 ROAS 재계산의 주문 연결 근거입니다.",
  };
  const paidClickIntentTag = health.healthSplit?.paidClickIntentTag ?? {
    source: "paid_click_intent_ledger" as const,
    status: health.paidClickIntent.gadCampaignIdRows < health.siteLanding.gadCampaignIdRows
      ? "needs_exact_click_diagnosis" as const
      : "monitoring" as const,
    rows: health.paidClickIntent.rows,
    googleClickIdRows: health.paidClickIntent.googleClickIdRows,
    gadCampaignIdRows: health.paidClickIntent.gadCampaignIdRows,
    currentCampaignIdCoverageRate: health.paidClickIntent.currentCampaignIdCoverageRate,
    latestAt: health.paidClickIntent.latestAt,
    interpretation:
      "GTM paid-click-intent 태그가 최소 click evidence를 남기는지 보는 보조 헬스입니다. 예산 판단용 ROAS 정본으로 쓰지 않습니다.",
  };

  return [
    {
      key: "roas",
      title: "예산 판단용 헬스",
      subtitle: "고객 유입 원장 + 주문 원장",
      status: roasAttribution.status,
      rate: roasAttribution.currentCampaignIdCoverageRate,
      primary: roasAttribution.gadCampaignIdRows,
      secondary: roasAttribution.googleClickIdRows,
      primaryLabel: "campaign id 보존",
      secondaryLabel: "Google click id",
      latestAt: roasAttribution.latestAt,
      interpretation: roasAttribution.interpretation,
      source: roasAttribution.source,
    },
    {
      key: "order",
      title: "주문 연결 헬스",
      subtitle: "결제완료 기준 attribution",
      status: orderAttribution.status,
      rate: orderAttribution.confirmedPaymentSuccessRows > 0
        ? orderAttribution.confirmedRowsWithGadCampaignId / orderAttribution.confirmedPaymentSuccessRows
        : null,
      primary: orderAttribution.confirmedRowsWithGadCampaignId,
      secondary: orderAttribution.confirmedPaymentSuccessRows,
      primaryLabel: "결제완료 campaign id",
      secondaryLabel: "결제완료 row",
      latestAt: orderAttribution.latestAt,
      interpretation: orderAttribution.interpretation,
      source: orderAttribution.source,
    },
    {
      key: "tag",
      title: "태그 진단용 헬스",
      subtitle: "paid_click_intent_ledger",
      status: paidClickIntentTag.status,
      rate: paidClickIntentTag.currentCampaignIdCoverageRate,
      primary: paidClickIntentTag.gadCampaignIdRows,
      secondary: paidClickIntentTag.googleClickIdRows,
      primaryLabel: "campaign id 보존",
      secondaryLabel: "Google click id",
      latestAt: paidClickIntentTag.latestAt,
      interpretation: paidClickIntentTag.interpretation,
      source: paidClickIntentTag.source,
    },
  ];
};

const formatFetchedAt = (value: string | undefined) => {
  if (!value) return "문서 기준";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const shouldUseCampaignMatchFallback = (health: GoogleCampaignMatchHealth | undefined) => {
  if (!health) return true;
  const isLocalApi = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
  const totalLedgerRows =
    health.siteLanding.rows
    + health.paidClickIntent.rows
    + health.attributionLedger.rows;
  return isLocalApi && totalLedgerRows === 0;
};

function makeSnapshot(preset: DatePreset, response: GoogleAdsDashboardResponse | null, error: string | null): Snapshot {
  return {
    preset,
    label: preset === "last_7d" ? "최근 7일" : "최근 30일",
    response,
    error,
  };
}

const shouldUseClickIdHealthFallback = (health?: GoogleAdsDashboardResponse["clickIdHealth"]) => {
  if (!health) return true;
  const isLocalBackend = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");

  /*
    Local backend can have the operational order denominator without the VM Cloud
    SQLite evidence rows. In that case it returns a false 0% card while the public
    VM Cloud dashboard has current evidence. Use the verified VM Cloud snapshot
    only for that local evidence-gap shape.
  */
  return Boolean(
    isLocalBackend
      && health.orderCount > 0
      && health.withGoogleClickId === 0
      && health.blockReasonCounts.missingAttributionVmEvidence >= health.orderCount,
  );
};

const shouldUseClickIdDropoffFallback = (health?: GoogleClickIdDropoffHealth) => {
  if (!health) return true;
  const isLocalBackend = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
  const liveRows =
    health.stages.siteLanding.rows
    + health.stages.paidClickIntent.rows
    + health.stages.paymentSuccessAll.rows;
  return isLocalBackend && liveRows === 0;
};

function snapshotMetrics(snapshot: Snapshot) {
  const fallback = fallbackSnapshots[snapshot.preset];
  const response = snapshot.response;
  const googleCampaignMatchHealth = shouldUseCampaignMatchFallback(response?.googleCampaignMatchHealth)
    ? fallbackCampaignMatchHealth[snapshot.preset]
    : response?.googleCampaignMatchHealth ?? fallbackCampaignMatchHealth[snapshot.preset];
  const useClickIdFallback = shouldUseClickIdHealthFallback(response?.clickIdHealth);
  const clickIdDropoffHealth = shouldUseClickIdDropoffFallback(response?.clickIdDropoffHealth)
    ? fallbackClickIdDropoffHealth
    : response?.clickIdDropoffHealth ?? fallbackClickIdDropoffHealth;
  return {
    label: snapshot.label,
    fetchedAt: response?.fetchedAt,
    platformRoas: response?.summary.roas ?? fallback.platformRoas,
    internalRoas: response?.internal?.summary.internalConfirmedRoas ?? fallback.internalRoas,
    internalWithNpayRoas: response?.npayActualCorrection?.internalConfirmedRoasWithNpayActualPg ?? fallback.internalWithNpayRoas,
    cost: response?.summary.cost ?? fallback.cost,
    platformValue: response?.summary.conversionValue ?? fallback.platformValue,
    internalRevenue: response?.internal?.summary.confirmedRevenue ?? fallback.internalRevenue,
    npayRevenue: response?.npayActualCorrection?.npayActualConfirmedPgRevenueKrw ?? fallback.npayRevenue,
    npayCount: response?.npayActualCorrection?.npayActualConfirmedPgCount,
    uploadCandidateCount: response?.npayActualCorrection?.uploadCandidateCount ?? 0,
    nPayShare: response?.conversionActionSegments?.summary.primaryKnownNpayShareOfPlatform ?? 1,
    conversionActionSegments: response?.conversionActionSegments ?? fallbackConversionActionSegments[snapshot.preset],
    campaignCoverage: response?.internal?.summary.campaignIdCoverage,
    unknownCampaignOrders: response?.internal?.summary.unknownCampaignOrders,
    source: response ? "VM Cloud summary-first API" : fallback.source,
    clickIdHealth: response?.clickIdHealth && !useClickIdFallback
      ? {
          generatedAt: response.clickIdHealth.generatedAt,
          orderCount: response.clickIdHealth.orderCount,
          withGoogleClickId: response.clickIdHealth.withGoogleClickId,
          missingGoogleClickId: response.clickIdHealth.missingGoogleClickId,
          preservationRate: response.clickIdHealth.preservationRate ?? 0,
          uploadCandidateCount: response.clickIdHealth.uploadCandidateCount,
          source: "VM Cloud summary-first API",
          blockReasonCounts: {
            missingAttributionVmEvidence: response.clickIdHealth.blockReasonCounts.missingAttributionVmEvidence,
          },
          paymentMethodBreakdown: response.clickIdHealth.paymentMethodBreakdown.map((row) => ({
            paymentMethod: row.paymentMethod,
            orders: row.orders,
            withGoogleClickId: row.withGoogleClickId,
            missingGoogleClickId: row.missingGoogleClickId,
            preservationRate: row.preservationRate ?? 0,
          })),
          clickIdBreakdown: response.clickIdHealth.clickIdBreakdown,
        }
      : fallback.clickIdHealth,
    clickIdDropoffHealth,
    googleCampaignMatchHealth,
    npayBridgeReview: response?.npayBridgeReview ?? fallbackNpayBridgeReview,
    error: snapshot.error,
  };
}

export default function GoogleRoasProjectReportPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([
    makeSnapshot("last_7d", null, null),
    makeSnapshot("last_30d", null, null),
  ]);
  const [analysisV2DropoffHealth, setAnalysisV2DropoffHealth] = useState<GoogleClickIdDropoffHealth | null>(null);
  const [privatePayloadPreview, setPrivatePayloadPreview] = useState<GoogleAdsPrivatePayloadPreview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const presets: DatePreset[] = ["last_7d", "last_30d"];
    const [next, analysisDropoff, privatePreview] = await Promise.all([
      Promise.all(presets.map(async (preset) => {
        try {
          const response = await fetch(
            buildDashboardSummaryUrl(preset),
            { cache: "no-store" },
          );
          const data = await response.json() as GoogleAdsDashboardResponse | { ok?: false; error?: unknown };
          if (!response.ok || !data.ok) {
            throw new Error(JSON.stringify("error" in data ? data.error : data).slice(0, 240));
          }
          return makeSnapshot(preset, data, null);
        } catch (error) {
          return makeSnapshot(preset, null, error instanceof Error ? error.message : "load_failed");
        }
      })),
      fetch(`${API_BASE}/api/google-ads/click-id-dropoff?site=biocom&window=analysis_v2`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as GoogleClickIdDropoffResponse | { ok?: false };
          if (!response.ok || !data.ok || !("health" in data)) return null;
          return data.health;
        })
        .catch(() => null),
      loadGoogleAdsPrivatePayloadPreview(),
    ]);
    setSnapshots(next);
    setAnalysisV2DropoffHealth(analysisDropoff);
    setPrivatePayloadPreview(privatePreview);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const metrics = useMemo(() => snapshots.map(snapshotMetrics), [snapshots]);
  const last7 = metrics[0];
  const last30 = metrics[1];
  const maxRoas = Math.max(10, last7.platformRoas, last30.platformRoas, last7.internalWithNpayRoas, last30.internalWithNpayRoas);
  const currentGap = last30.platformRoas - last30.internalWithNpayRoas;
  const exactEvidenceStatusClass = exactEvidenceReadiness.statusTone === "hold"
    ? `${styles.status} ${styles.statusHold}`
    : styles.status;
  const conversionSummary7d = last7.conversionActionSegments.summary;
  const conversionSummary30d = last30.conversionActionSegments.summary;
  const conversionActions7d = last7.conversionActionSegments.actions.slice(0, 6);
  const last7InternalActualRevenue = last7.internalRevenue + last7.npayRevenue;
  const privatePreview = privatePayloadPreview ?? fallbackPrivatePayloadPreview;
  const privatePreviewSource = privatePayloadPreview
    ? "VM Cloud live private preview API"
    : "VM Cloud deploy smoke fallback";
  const privatePreviewNeedsLiveRefresh = privatePayloadPreview === null;
  const primaryReadiness = privatePreview.progress.overallPrimaryConversionReadinessPct;
  const postPatchClickIdCard = {
    label: "5/21 21:15 이후",
    clickIdHealth: {
      generatedAt: postPatchClickIdHealth.checkedAtKst,
      orderCount: postPatchClickIdHealth.orderStage.orderCount,
      withGoogleClickId: postPatchClickIdHealth.orderStage.withGoogleClickId,
      missingGoogleClickId: postPatchClickIdHealth.orderStage.missingGoogleClickId,
      preservationRate: postPatchClickIdHealth.orderStage.preservationRate,
      uploadCandidateCount: postPatchClickIdHealth.orderStage.uploadCandidateCount,
      source: postPatchClickIdHealth.source,
      blockReasonCounts: {
        missingAttributionVmEvidence: postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence,
      },
      paymentMethodBreakdown: postPatchClickIdHealth.orderStage.paymentMethodBreakdown.map((row) => ({
        paymentMethod: row.paymentMethod,
        orders: row.orders,
        withGoogleClickId: row.withGoogleClickId,
        missingGoogleClickId: row.orders - row.withGoogleClickId,
        preservationRate: row.preservationRate,
      })),
      clickIdBreakdown: postPatchClickIdHealth.orderStage.clickIdBreakdown,
    },
  };
  const clickIdHealthCards = [postPatchClickIdCard, last7, last30];
  const clickIdDropoffHealth = last7.clickIdDropoffHealth;
  const analysisV2Health = analysisV2DropoffHealth ?? clickIdDropoffHealth;
  const clickIdDropoffStages = [
    analysisV2Health.stages.siteLanding,
    analysisV2Health.stages.paidClickIntent,
    analysisV2Health.stages.checkoutStarted,
    analysisV2Health.stages.paymentPageSeen,
    analysisV2Health.stages.paymentSuccessAll,
    analysisV2Health.stages.paymentSuccessConfirmedDirect,
  ];
  const npayBridgeReview = last7.npayBridgeReview;
  const npayIntentStage = analysisV2Health.stages.npayIntentExact;
  const rawNpayBridgeSummary = npayBridgeReview.summary;
  const npayBridgeSummary = {
    ...rawNpayBridgeSummary,
    liveIntentCount: rawNpayBridgeSummary.liveIntentCount ?? npayIntentStage.rows ?? 0,
    googleLikeIntentCount: rawNpayBridgeSummary.googleLikeIntentCount ?? npayIntentStage.rows ?? 0,
    googleLikeIntentWithGoogleClickId:
      rawNpayBridgeSummary.googleLikeIntentWithGoogleClickId ?? npayIntentStage.googleClickIdRows ?? 0,
    googleClickIdIntentCount: rawNpayBridgeSummary.googleClickIdIntentCount ?? npayIntentStage.googleClickIdRows ?? 0,
    googleClickIdIntentBreakdown: rawNpayBridgeSummary.googleClickIdIntentBreakdown ?? {
      gclid: npayIntentStage.googleClickIdRows ?? 0,
      gbraid: 0,
      wbraid: 0,
    },
    liveIntentWithNpayBridgeUrlHash: rawNpayBridgeSummary.liveIntentWithNpayBridgeUrlHash ?? 0,
    googleLikeIntentWithNpayBridgeUrlHash: rawNpayBridgeSummary.googleLikeIntentWithNpayBridgeUrlHash ?? 0,
    bridgeCandidatesWithNpayBridgeUrlHash: rawNpayBridgeSummary.bridgeCandidatesWithNpayBridgeUrlHash ?? 0,
    gradeAWithNpayBridgeUrlHash: rawNpayBridgeSummary.gradeAWithNpayBridgeUrlHash ?? 0,
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash:
      rawNpayBridgeSummary.gradeAWithGoogleClickIdAndNpayBridgeUrlHash ?? 0,
    googleLikeCompletedOrders: rawNpayBridgeSummary.googleLikeCompletedOrders ?? npayIntentStage.matchedOrderRows ?? 0,
    googleLikeCompletedAmountKrw: rawNpayBridgeSummary.googleLikeCompletedAmountKrw ?? 0,
    googleLikeCompletedWithDirectGoogleClickId:
      rawNpayBridgeSummary.googleLikeCompletedWithDirectGoogleClickId
      ?? npayIntentStage.matchedOrderGoogleClickIdRows
      ?? 0,
  };
  const npayFinalSourceSummary =
    npayBridgeReview.finalSourceSummary ?? buildFallbackNpayFinalSourceSummary(npayBridgeReview);
  const npayFinalSourceDateDistribution = npayFinalSourceSummary.dateDistribution ?? [];
  const npayUnclassifiedReasonRows = npayFinalSourceSummary.unclassifiedReasons ?? [];
  const npaySourceFunnelComparison = npayBridgeReview.sourceFunnelComparison ?? [];
  const npayUnresolvedRows = npayBridgeReview.unresolvedRows ?? [];
  const npayAmountMismatchRows = npayUnresolvedRows.filter((row) =>
    row.ambiguousReasons.includes("amount_not_reconciled") ||
    row.amountReconcileReason === "amount_not_reconciled" ||
    row.amountMatchType === "none",
  );
  const npayAmountMismatchCategoryCounts = npayAmountMismatchRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.amountMismatchCategory ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const npayAmountMismatchCategorySummary = Object.entries(npayAmountMismatchCategoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${amountMismatchCategoryLabel(key)} ${formatCount(count)}건`)
    .join(" · ");
  const npayTimeAmbiguousRows = npayUnresolvedRows.filter((row) =>
    row.ambiguousReasons.includes("weak_time_gap") ||
    (row.orderCreateTimeBridge !== "exact" && (row.timeGapMinutes ?? 0) > 2),
  );
  const googleLikeNpayClickIdPreservationRate =
    npayBridgeSummary.googleLikeIntentCount > 0
      ? npayBridgeSummary.googleLikeIntentWithGoogleClickId / npayBridgeSummary.googleLikeIntentCount
      : null;
  const allNpayClickIdPreservationRate =
    npayBridgeSummary.liveIntentCount > 0
      ? npayBridgeSummary.googleClickIdIntentCount / npayBridgeSummary.liveIntentCount
      : null;
  const googleLikeNpayButtonToCompletedRate =
    npayBridgeSummary.googleLikeIntentCount > 0
      ? npayBridgeSummary.googleLikeCompletedOrders / npayBridgeSummary.googleLikeIntentCount
      : null;
  const allNpayButtonToCompletedRate =
    npayBridgeSummary.liveIntentCount > 0
      ? npayBridgeSummary.actualConfirmedNpayOrders / npayBridgeSummary.liveIntentCount
      : null;
  const npayGradeAToCompletedRate =
    npayBridgeSummary.actualConfirmedNpayOrders > 0
      ? npayBridgeSummary.gradeA / npayBridgeSummary.actualConfirmedNpayOrders
      : null;
  const npayGoogleAdsSendCandidateRate =
    npayBridgeSummary.actualConfirmedNpayOrders > 0
      ? npayBridgeSummary.googleAdsSendCandidates / npayBridgeSummary.actualConfirmedNpayOrders
      : null;
  const npayBridgeOpenedCount = npayBridgeSummary.liveIntentWithNpayBridgeUrlHash ?? 0;
  const npayBridgeOpenedMatchedCount = npayBridgeSummary.bridgeCandidatesWithNpayBridgeUrlHash ?? 0;
  const npayBridgeHashRate =
    npayBridgeSummary.liveIntentCount > 0
      ? npayBridgeOpenedCount / npayBridgeSummary.liveIntentCount
      : null;
  const googleLikeBridgeHashRate =
    npayBridgeSummary.googleLikeIntentCount > 0
      ? (npayBridgeSummary.googleLikeIntentWithNpayBridgeUrlHash ?? 0) / npayBridgeSummary.googleLikeIntentCount
      : null;
  const gradeABridgeHashRate =
    npayBridgeSummary.gradeA > 0
      ? (npayBridgeSummary.gradeAWithNpayBridgeUrlHash ?? 0) / npayBridgeSummary.gradeA
      : null;
  const gradeAGoogleBridgeHashRate =
    npayBridgeSummary.gradeA > 0
      ? (npayBridgeSummary.gradeAWithGoogleClickIdAndNpayBridgeUrlHash ?? 0) / npayBridgeSummary.gradeA
      : null;
  const rawEnteredNotCompletedBreakdown = npayBridgeSummary.enteredNotCompletedBreakdown;
  const npayEnteredNotCompletedCount =
    rawEnteredNotCompletedBreakdown?.total ?? Math.max(0, npayBridgeOpenedCount - npayBridgeOpenedMatchedCount);
  const npayEnteredNotCompletedBreakdown = {
    total: npayEnteredNotCompletedCount,
    pendingWindow: rawEnteredNotCompletedBreakdown?.pendingWindow ?? 0,
    loginGatePossible: rawEnteredNotCompletedBreakdown?.loginGatePossible ?? 0,
    checkoutOpenedPossible: rawEnteredNotCompletedBreakdown?.checkoutOpenedPossible ?? npayEnteredNotCompletedCount,
    matchingGapPossible: rawEnteredNotCompletedBreakdown?.matchingGapPossible ?? 0,
  };
  const npayStageLabelRows = [
    {
      key: "button_clicked",
      certainty: "확정 가능",
      countText: `${formatCount(npayBridgeSummary.liveIntentCount)}건`,
      meaning:
        "바이오컴 상품 페이지에서 NPay 버튼을 누른 순간입니다. 이 단계는 자사몰 안에서 직접 관찰되므로 버튼 클릭 자체는 확정할 수 있습니다.",
      evidence:
        "VM Cloud NPay intent row. Google click id, 상품 idx, 금액, page URL이 같이 저장됩니다.",
    },
    {
      key: "bridge_opened",
      certainty: "확정 가능",
      countText: `${formatCount(npayBridgeOpenedCount)}건`,
      meaning:
        "버튼 클릭 뒤 네이버 결제 bridge URL이 열린 순간입니다. 자사몰을 떠나기 직전에 관찰되는 값이라 결제창 진입 연결고리로 쓸 수 있습니다.",
      evidence:
        `bridge URL hash가 남은 intent row입니다. 이 중 결제완료 후보와 붙은 row는 ${formatCount(npayBridgeOpenedMatchedCount)}건입니다.`,
    },
    {
      key: "login_gate_possible",
      certainty: "가능 후보",
      countText: `후보군 ${formatCount(npayEnteredNotCompletedBreakdown.loginGatePossible)}건`,
      meaning:
        "네이버 로그인 화면에서 멈췄을 가능성이 있는 단계입니다. 로그인 화면은 네이버 도메인이라 바이오컴 GTM이 직접 볼 수 없어서 확정값이 아니라 후보로만 표시합니다.",
      evidence:
        "bridge URL host가 nid.naver.com으로 남았거나, 로그인 gate로 해석되는 row만 별도로 봅니다.",
    },
    {
      key: "checkout_opened_possible",
      certainty: "가능 후보",
      countText: `후보군 ${formatCount(npayEnteredNotCompletedBreakdown.checkoutOpenedPossible)}건`,
      meaning:
        "네이버 결제서 화면까지 갔을 가능성이 있는 단계입니다. checkout URL 역시 네이버 도메인이라 직접 수집이 어렵고, bridge row와 이후 주문 원장으로만 추론합니다.",
      evidence:
        "orders.pay.naver.com 또는 pay.naver.com 계열 bridge가 열렸지만 결제완료 주문과 아직 연결되지 않은 row입니다.",
    },
    {
      key: "completed",
      certainty: "실제 주문 원장과 붙으면 확정",
      countText: `${formatCount(npayBridgeSummary.actualConfirmedNpayOrders)}건`,
      meaning:
        "네이버페이 결제완료가 실제 주문 원장에 들어온 상태입니다. 이 단계부터는 매출로 봅니다.",
      evidence:
        `그중 버튼 클릭 row와 자동 bridge 후보로 붙은 주문은 ${formatCount(npayBridgeSummary.internalBridgeExactCandidates)}건입니다.`,
    },
    {
      key: "entered_not_completed",
      certainty: "이탈 후보",
      countText: `${formatCount(npayEnteredNotCompletedCount)}건`,
      meaning:
        "네이버 결제 bridge는 열렸지만, 같은 분석 창 안에서 결제완료 주문과 붙지 않은 상태입니다. 로그인 이탈, 결제서 이탈, 나중 결제, 매칭 실패가 섞일 수 있습니다.",
      evidence:
        `자동 분해: 아직 대기 ${formatCount(npayEnteredNotCompletedBreakdown.pendingWindow)}건 · 로그인 이탈 후보 ${formatCount(npayEnteredNotCompletedBreakdown.loginGatePossible)}건 · 결제서 이탈 후보 ${formatCount(npayEnteredNotCompletedBreakdown.checkoutOpenedPossible)}건 · 매칭 보강 필요 ${formatCount(npayEnteredNotCompletedBreakdown.matchingGapPossible)}건`,
    },
  ];
  const npayPaymentTagFunnelRows = [
    {
      step: "1",
      stage: "상품 페이지 진입",
      status: "자사몰에서 직접 확인",
      tag: "PageView + Google click id 저장",
      fires:
        "헤더의 click id 보존 코드가 gclid, gbraid, wbraid를 저장하고, 기본 PageView 태그가 켜집니다.",
      meaning:
        "광고 클릭으로 들어왔는지 확인하는 시작점입니다. 이 단계는 구매가 아니라 방문입니다.",
    },
    {
      step: "2",
      stage: "NPay 버튼 클릭",
      status: "자사몰에서 직접 확인",
      tag: "BI NPay Bridge v1.1 + NPay 버튼 보조 전환",
      fires:
        "VM Cloud NPay intent row가 저장되고, Google Ads의 NPay 버튼 클릭/결제진입 보조 전환이 관찰용으로 켜질 수 있습니다.",
      meaning:
        "구매 의도는 강하지만 아직 결제완료가 아닙니다. 그래서 Google Ads 입찰 학습의 주 구매 신호로 쓰면 안 됩니다.",
    },
    {
      step: "3",
      stage: "네이버 bridge/login",
      status: "직접 확정 대신 후보 분류",
      tag: "bridge URL hash / host 저장",
      fires:
        "자사몰을 떠나기 직전 보이는 네이버 bridge 주소의 hash와 host를 저장합니다. 네이버 로그인 화면 안쪽은 자사몰 태그가 직접 볼 수 없습니다.",
      meaning:
        "로그인에서 멈춘 사람과 결제서까지 간 사람을 나누기 위한 연결고리입니다.",
    },
    {
      step: "4",
      stage: "네이버 결제서",
      status: "가능 후보",
      tag: "checkout_opened_possible",
      fires:
        "orders.pay.naver.com 계열 bridge가 남으면 결제서 진입 가능 후보로 표시합니다.",
      meaning:
        "여기서 이탈하면 entered_not_completed 중 결제서 이탈 후보로 분리합니다.",
    },
    {
      step: "5",
      stage: "실제 결제완료",
      status: "주문 원장으로 확정",
      tag: "BI confirmed_purchase_offline 후보",
      fires:
        "실제 주문 원장에 결제완료가 들어온 뒤, click id와 중복/취소/금액 guard를 통과한 주문만 Google Ads 실제 구매 후보가 됩니다.",
      meaning:
        "Google Ads 주 전환으로 써야 하는 단계입니다. 버튼 클릭 신호와 분리해서 봅니다.",
    },
    {
      step: "6",
      stage: "결제완료 미연결",
      status: "이탈 또는 매칭 보강 필요",
      tag: "entered_not_completed 자동 분해",
      fires:
        "bridge는 열렸지만 같은 기간 실제 결제완료 주문과 붙지 않으면 pending, login, checkout, matching gap으로 나눕니다.",
      meaning:
        "NPay 버튼을 눌렀지만 실제 구매까지 가지 않았거나, 아직 주문 원장과 자동 연결하지 못한 구간입니다.",
    },
  ];
  const npayIntentSourceGap =
    npayBridgeSummary.liveIntentCount === 0 && npayBridgeSummary.actualConfirmedNpayOrders > 0;
  const npayBridgeGradeBRows = (npayBridgeReview.gradeBRows?.length
    ? npayBridgeReview.gradeBRows
    : npayBridgeReview.rows.filter((row) => row.strongGrade === "B"));
  const npayBridgeGradeBRowsWithAnyGoogleEvidence = npayBridgeGradeBRows.filter((row) =>
    row.hasGoogleClickId ||
    Boolean(row.gadCampaignId) ||
    (row.googleClickIdEvidenceSource && row.googleClickIdEvidenceSource !== "none") ||
    row.campaignIdEvidenceSource !== "none",
  );
  const npayBridgeGradeBRowsWithDirectIntentClickId = npayBridgeGradeBRowsWithAnyGoogleEvidence.filter((row) =>
    row.googleClickIdEvidenceSource === "intent_direct",
  );
  const npayBridgeGradeBRowsWithRecoveredClickId = npayBridgeGradeBRowsWithAnyGoogleEvidence.filter((row) =>
    row.googleClickIdEvidenceSource &&
    row.googleClickIdEvidenceSource !== "intent_direct" &&
    row.googleClickIdEvidenceSource !== "none",
  );
  const npayCoreFunnelCards = [
    {
      label: "NPay 버튼 클릭",
      value: `${formatCount(npayBridgeSummary.liveIntentCount)}건`,
      detail: `Google 흔적 ${formatCount(npayBridgeSummary.googleLikeIntentCount)}건 · Google click id 보존 ${formatRatePct(googleLikeNpayClickIdPreservationRate)}`,
      plain:
        "자사몰 안에서 NPay 버튼을 누른 숫자입니다. 클릭 자체는 잘 잡히지만 아직 구매완료가 아닙니다.",
    },
    {
      label: "네이버 결제창 진입",
      value: `${formatCount(npayBridgeOpenedCount)}건`,
      detail: `Google 흔적 있는 bridge ${formatCount(npayBridgeSummary.googleLikeIntentWithNpayBridgeUrlHash ?? 0)}건`,
      plain:
        "네이버 외부 화면으로 넘어가기 직전까지 잡힌 연결고리입니다. 이 값이 있어야 로그인/결제서 이탈을 더 좁힐 수 있습니다.",
    },
    {
      label: "실제 NPay 결제완료",
      value: `${formatCount(npayBridgeSummary.actualConfirmedNpayOrders)}건`,
      detail: `Google 흔적 결제완료 ${formatCount(npayBridgeSummary.googleLikeCompletedOrders)}건 · 전환율 ${formatRatePct(googleLikeNpayButtonToCompletedRate)}`,
      plain:
        "네이버페이에서 돈이 결제된 실제 주문입니다. 매출은 맞지만 유입 증거와 자동 연결이 별도 문제입니다.",
    },
    {
      label: "자동 연결 성공",
      value: `${formatCount(npayBridgeSummary.internalBridgeExactCandidates)}건`,
      detail: `A급 ${formatCount(npayBridgeSummary.gradeA)}건 · B급 ${formatCount(npayBridgeSummary.gradeB)}건 · 미분류 ${formatCount(npayBridgeSummary.ambiguous)}건`,
      plain:
        "주문과 버튼 클릭을 내부적으로 붙인 후보입니다. A급은 강하고, B급/미분류는 왜 막혔는지 더 줄여야 합니다.",
    },
  ];
  const npayRootBottleneckCards = [
    {
      label: "1차 병목",
      value: "결제창 진입 후 이탈/미연결",
      detail:
        `bridge는 ${formatCount(npayBridgeOpenedCount)}건 열렸지만 결제완료와 붙은 bridge 후보는 ${formatCount(npayBridgeOpenedMatchedCount)}건입니다.`,
    },
    {
      label: "2차 병목",
      value: "출처 유실",
      detail:
        `결제완료 ${formatCount(npayFinalSourceSummary.totalCompletedOrders)}건 중 direct/unknown은 ${formatCount((npayFinalSourceSummary.byChannel.find((row) => row.channel === "direct")?.completedOrders ?? 0) + npayFinalSourceSummary.unclassifiedCompletedOrders)}건입니다.`,
    },
    {
      label: "3차 병목",
      value: "Google 전송 근거 부족",
      detail:
        `Google 증거 결제완료 ${formatCount(npayFinalSourceSummary.googleEvidenceOrders)}건 중 실제 Google Ads 전송 후보는 ${formatCount(npayBridgeSummary.googleAdsSendCandidates)}건입니다.`,
    },
    {
      label: "Grade B Google 1건",
      value: `${formatCount(npayBridgeGradeBRowsWithAnyGoogleEvidence.length)}건`,
      detail:
        `직접 intent click id ${formatCount(npayBridgeGradeBRowsWithDirectIntentClickId.length)}건 · 같은 세션 복구 ${formatCount(npayBridgeGradeBRowsWithRecoveredClickId.length)}건입니다.`,
    },
  ];
  const last7Response = snapshots[0]?.response;
  const internalCampaignRows = [
    ...(last7Response?.internal?.campaigns ?? []),
    ...(last7Response?.internal?.internalOnlyCampaigns ?? []),
  ];
  const internalCampaignById = new Map(
    internalCampaignRows.map((row) => [row.campaignId ?? "(unknown)", row]),
  );
  const bridgeCampaignById = new Map(
    npayBridgeReview.campaignSummary.map((row) => [row.campaignId ?? "(missing)", row]),
  );
  const platformCampaignRows = last7Response?.campaigns ?? [];
  const seenCampaignKeys = new Set<string>();
  const campaignRoasRows = [
    ...platformCampaignRows.map((campaign) => {
      const key = campaign.campaignId;
      seenCampaignKeys.add(key);
      return {
        key,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        googleCost: campaign.cost,
        googleConversions: campaign.conversions,
        googleConversionValue: campaign.conversionValue,
        googleRoas: campaign.roas,
        internal: internalCampaignById.get(key),
        bridge: bridgeCampaignById.get(key),
        source: "platform",
      };
    }),
    ...internalCampaignRows
      .filter((row) => {
        const key = row.campaignId ?? "(unknown)";
        return !seenCampaignKeys.has(key);
      })
      .map((row) => {
        const key = row.campaignId ?? "(unknown)";
        seenCampaignKeys.add(key);
        return {
          key,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          googleCost: 0,
          googleConversions: 0,
          googleConversionValue: 0,
          googleRoas: null,
          internal: row,
          bridge: bridgeCampaignById.get(key),
          source: "internal",
        };
      }),
    ...npayBridgeReview.campaignSummary
      .filter((row) => {
        const key = row.campaignId ?? "(missing)";
        return !seenCampaignKeys.has(key);
      })
      .map((row) => ({
        key: row.campaignId ?? "(missing)",
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        googleCost: 0,
        googleConversions: 0,
        googleConversionValue: 0,
        googleRoas: null,
        internal: undefined,
        bridge: row,
        source: "bridge",
      })),
  ].slice(0, 12);

  return (
    <div className={styles.page}>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.main}>
        <div className={styles.topRow}>
          <div>
            <Link href="/ads/google" className={styles.backLink}>Google Ads 성과 화면으로 돌아가기</Link>
            <p className={styles.eyebrow}>Google ROAS 정합성 프로젝트</p>
            <h1 className={styles.title}>Google Ads 숫자를 실제 결제완료 매출 기준으로 다시 읽습니다</h1>
            <p className={styles.lead}>
              이 화면의 질문은 하나입니다. Google Ads가 보여주는 ROAS를 예산 판단에 그대로 써도 되는가.
              답은 아직 아니오입니다. 플랫폼 주장값, 내부 confirmed 매출, NPay actual 보정, 전송 금지선을 분리해서 봅니다.
            </p>
          </div>
          <div className={styles.actions}>
            <Link href="/ads/google-roas-report/details" className={`${styles.actionLink} ${styles.primaryAction}`}>
              상세 진단 보기
            </Link>
            <Link href="/ads/google" className={styles.actionLink}>실시간 성과 보기</Link>
            <Link href="/ads/roas" className={styles.actionLink}>ROAS 대시보드</Link>
            <button className={`${styles.refreshButton} ${styles.primaryAction}`} onClick={() => void loadSnapshots()} disabled={loading}>
              {loading ? "조회 중" : "현재값 다시 조회"}
            </button>
          </div>
        </div>

        <section className={styles.decisionBand}>
          <div>
            <p className={styles.decisionLabel}>현재 운영 판단</p>
            <h2>Google Ads ROAS는 아직 참고값입니다. 예산 판단은 내부 결제완료 매출을 기준으로 봅니다.</h2>
            <p>
              Google Ads가 보여주는 큰 ROAS에는 기존 NPay `구매완료` 전환값이 많이 섞여 있습니다.
              NPay 실제 결제완료 매출은 내부 매출에 포함해야 하지만, NPay 클릭이나 결제 시작 count를 구매완료로 보면 안 됩니다.
              지금은 내부 confirmed 매출, NPay actual, click id 보존, exact evidence를 분리해서 판단합니다.
            </p>
          </div>
          <div className={styles.decisionAside}>
            <div className={styles.guardPill}>
              <strong>지금 결론</strong>
              <span>증액 판단은 보류하고, 내부 confirmed + NPay actual ROAS를 기준으로 봅니다.</span>
            </div>
            <div className={styles.guardPill}>
              <strong>진전된 부분</strong>
              <span>
                NPay bridge 후보 {formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건을
                A급 {formatCount(npayBridgeReview.summary.gradeA)}건,
                B급 {formatCount(npayBridgeReview.summary.gradeB)}건으로 나눠 보고 있습니다.
                Google Ads 전송 후보는 {formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건입니다.
              </span>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.bridgeSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>핵심 임무: NPay 클릭이 왜 결제완료와 끊기는지 찾습니다</h2>
              <p>
                이 화면의 첫 질문은 Google Ads 리포트 숫자가 아니라,
                “NPay 버튼을 누른 사람이 네이버 결제창을 거쳐 실제 결제완료 주문으로 얼마나 붙는가”입니다.
                버튼 클릭, 네이버 bridge, 결제완료, 광고 클릭 증거를 같은 줄에 놓고 병목을 봅니다.
              </p>
            </div>
            <span className={styles.metaText}>
              source: {npayBridgeReview.source} · {npayBridgeReview.windowLabel} · 기준 {formatFetchedAt(npayBridgeReview.generatedAt)}
            </span>
          </div>

          <div className={styles.signalFlowGrid}>
            {npayCoreFunnelCards.map((card) => (
              <article key={card.label} className={styles.signalFlowCard}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
                <em>{card.plain}</em>
              </article>
            ))}
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>현재 병목 판단</strong>
            <p>
              클릭 수집 자체가 제일 큰 문제는 아닙니다. 최근 7일 Google 흔적이 있는 NPay 버튼 클릭
              {" "}{formatCount(npayBridgeSummary.googleLikeIntentCount)}건 중 Google click id는
              {" "}{formatCount(npayBridgeSummary.googleLikeIntentWithGoogleClickId)}건에 남아 있습니다.
              그런데 실제 NPay 결제완료로 붙은 Google 흔적 주문은 {formatCount(npayBridgeSummary.googleLikeCompletedOrders)}건입니다.
            </p>
            <p>
              따라서 핵심 병목은 “클릭 저장”보다 “네이버 외부 결제창을 지나온 주문을 다시 우리 버튼 클릭 row와 안전하게 붙이는 일”입니다.
              이 연결이 닫혀야 Meta와 Google 모두에서 실제 구매 기준 ROAS를 볼 수 있습니다.
            </p>
          </div>

          <div className={styles.signalFlowGrid}>
            {npayRootBottleneckCards.map((card) => (
              <article key={card.label} className={styles.signalFlowCard}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>Grade B 7건 중 Google 흔적 1건이 왜 바로 전송 후보가 아닌가</strong>
            <p>
              현재 B급 중 Google 흔적이 있는 주문은 {formatCount(npayBridgeGradeBRowsWithAnyGoogleEvidence.length)}건입니다.
              이 주문은 NPay intent row 자체에 Google click id가 직접 붙은 것이 아니라,
              같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 복구한 흔적입니다.
              또한 금액 조합이 아직 A급으로 닫히지 않아 자동 전송 후보로 올리지 않습니다.
            </p>
            <p>
              쉽게 말하면 “Google 광고에서 온 정황은 있다”와 “Google Ads에 실제 구매로 보내도 된다”는 다른 기준입니다.
              전송하려면 실제 결제완료, 주문-버튼 연결, 금액 설명, 중복 방지, 원문 click id 확인이 모두 통과해야 합니다.
            </p>
            <Link href="/ads/google-roas-report/details" className={`${styles.actionLink} ${styles.primaryAction}`}>
              전송 장부/후보 상세 보기
            </Link>
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>전송 가능 출발점은 “새로 보낼 주문”과 다릅니다</strong>
            <p>
              상세 진단의 전송 가능 출발점은 후보 생성기가 찾은 출발점입니다.
              같은 날짜와 금액이 이미 전송 장부에 있으면 새로 보내면 안 됩니다.
              최신 대조에서는 출발점 5건이 모두 기존 장부와 겹쳤고, 4건은 sent, 1건은 failed 상태였습니다.
            </p>
            <p>
              그래서 다음 병목은 “후보를 더 많이 찾기”보다, 실제 NPay 결제완료 주문이 어느 버튼 클릭에서 왔는지
              장부와 중복 없이 자동으로 붙이는 기준을 닫는 일입니다.
            </p>
          </div>
        </section>

        <section className={styles.kpiGrid} aria-label="핵심 KPI">
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 7일 Google ROAS</div>
            <div className={styles.kpiValue}>{formatRoas(last7.platformRoas)}</div>
            <div className={styles.kpiSub}>플랫폼 주장값. 내부 confirmed ROAS는 {formatRoas(last7.internalRoas)}입니다.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 7일 내부 ROAS, NPay actual 포함</div>
            <div className={`${styles.kpiValue} ${styles.good}`}>{formatRoas(last7.internalWithNpayRoas)}</div>
            <div className={styles.kpiSub}>실제 NPay 결제완료 {last7.npayCount ? `${last7.npayCount}건` : ""} {formatKrw(last7.npayRevenue)} 합류 후.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>최근 30일 gap</div>
            <div className={`${styles.kpiValue} ${currentGap > 4 ? styles.warn : styles.good}`}>{currentGap.toFixed(2)}p</div>
            <div className={styles.kpiSub}>Google {formatRoas(last30.platformRoas)} vs 내부+NPay {formatRoas(last30.internalWithNpayRoas)}.</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Google Ads upload 후보</div>
            <div className={`${styles.kpiValue} ${styles.danger}`}>{last30.uploadCandidateCount}건</div>
            <div className={styles.kpiSub}>명시 승인 전 conversion upload, 전환 액션 변경, 예산 변경은 하지 않습니다.</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.okrSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>OKR와 액션플랜</h2>
              <p>
                이 프로젝트의 목표는 Google Ads가 보여주는 큰 숫자를 그대로 믿는 것이 아니라,
                실제 결제완료 매출 기준으로 다시 읽고 예산 판단에 쓸 수 있는 기준을 만드는 것입니다.
              </p>
            </div>
            <span className={styles.metaText}>{projectOkr.source}</span>
          </div>

          <div className={styles.okrHero}>
            <div>
              <span>목표</span>
              <strong>{projectOkr.objective}</strong>
              <p>{projectOkr.currentPosition}</p>
            </div>
            <div className={styles.okrDecision}>
              <span>현재 결정</span>
              <strong>{projectOkr.decision}</strong>
              <ul>
                {projectOkr.baselines.map((baseline) => (
                  <li key={baseline}>{baseline}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.okrResultGrid}>
            {projectOkrResults.map((result) => (
              <article key={result.id} className={styles.okrResultCard}>
                <span>{result.id}</span>
                <h3>{result.title}</h3>
                <dl>
                  <div>
                    <dt>현재 상태</dt>
                    <dd>{result.now}</dd>
                  </div>
                  <div>
                    <dt>성공하면 보이는 모습</dt>
                    <dd>{result.target}</dd>
                  </div>
                  <div>
                    <dt>왜 중요한가</dt>
                    <dd>{result.why}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className={styles.okrActionHeader}>
            <strong>실제 필요한 작업 순서</strong>
            <p>
              아래 순서는 승인 요청 목록이 아니라 목표 달성 순서입니다.
              로컬 read-only와 no-write 작업은 Codex가 계속 진행하고, 배포/write/send처럼 운영에 영향을 주는 단계만 TJ님 승인 후 진행합니다.
            </p>
          </div>

          <div className={styles.okrActionGrid}>
            {projectActionPlan.map((action) => (
              <article key={action.step} className={styles.okrActionCard}>
                <div className={styles.okrActionTop}>
                  <span>{action.step}</span>
                  <em>{action.owner}</em>
                </div>
                <h3>{action.title}</h3>
                <dl>
                  <div>
                    <dt>왜 하는가</dt>
                    <dd>{action.why}</dd>
                  </div>
                  <div>
                    <dt>어떻게 하는가</dt>
                    <dd>{action.how}</dd>
                  </div>
                  <div>
                    <dt>의존성</dt>
                    <dd>{action.dependency}</dd>
                  </div>
                  <div>
                    <dt>성공 기준</dt>
                    <dd>{action.success}</dd>
                  </div>
                  <div>
                    <dt>실패하면 먼저 볼 것</dt>
                    <dd>{action.failureCheck}</dd>
                  </div>
                </dl>
                <div className={styles.okrApprovalRow}>
                  <span>{action.approval}</span>
                  <strong>추천 {action.confidence}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.truthSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>“구매완료”라는 이름을 실제 구매와 분리해서 봅니다</h2>
              <p>
                Google Ads 화면의 `구매완료`는 광고 플랫폼이 구매라고 세는 값입니다.
                내부 주문 장부에서 돈이 실제로 결제완료됐다는 뜻과 같지 않아서, 여기서는 이름을 바꿔 읽습니다.
              </p>
            </div>
            <span className={styles.metaText}>source: Google Ads API + GTM live + 아임웹 live HTML · 기준 {googlePurchaseClaimAudit.checkedAtKst}</span>
          </div>

          <div className={styles.truthSplitGrid}>
            <article className={styles.truthCard}>
              <span>Google Ads 주장 구매</span>
              <strong>{formatKrw(conversionSummary7d.primaryConversionValue)}</strong>
              <p>
                최근 7일 Google Ads가 `구매완료`라고 부른 전환값입니다.
                이 값은 예산 판단용 정답이 아니라, 플랫폼이 주장하는 구매 금액으로 따로 둡니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>내부 실제 결제완료</span>
              <strong>{formatKrw(last7InternalActualRevenue)}</strong>
              <p>
                내부 confirmed 매출에 NPay actual 결제완료 보정값을 합쳐 보는 값입니다.
                예산을 실제 매출 기준으로 볼 때 우선 참고할 쪽입니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>Google 증거 있는 실제 결제완료</span>
              <strong className={styles.danger}>
                {formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)} / {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건
              </strong>
              <p>
                5월 21일 밤 보강 이후 실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남은 건수입니다.
                0건이므로 Google Ads upload 후보도 0건으로 유지합니다.
              </p>
            </article>
            <article className={styles.truthCard}>
              <span>실제 구매 전환 통로</span>
              <strong>준비 중 · no-send</strong>
              <p>
                기존 Primary를 바로 바꾸지 않고, 실제 결제완료 주문만 따로 모으는 전환 통로를 dry-run으로 준비합니다.
                전송과 Primary 변경은 별도 승인 전까지 하지 않습니다.
              </p>
            </article>
          </div>

          <div className={styles.truthEvidenceBox}>
            <strong>{googlePurchaseClaimAudit.googleAdsAction.actionName} 액션을 지금 이렇게 읽습니다</strong>
            <p>
              Google Ads action {googlePurchaseClaimAudit.googleAdsAction.actionId}는 {googlePurchaseClaimAudit.googleAdsAction.primaryMeaning}입니다.
              send_to 라벨은 {googlePurchaseClaimAudit.googleAdsAction.sendTo}이고, 아임웹 live HTML의 NPay count 코드와 일치합니다.
            </p>
            <div className={styles.truthEvidenceGrid}>
              {googlePurchaseClaimAudit.siteEvidence.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <p>{item.finding}</p>
                </div>
              ))}
            </div>
            <em>{googlePurchaseClaimAudit.decision}</em>
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>질문: 이 `구매완료`가 NPay 구매버튼 클릭인가, 실제 네이버페이 결제완료인가?</strong>
            <p>
              현재 답은 “실제 네이버페이 결제완료 전용으로 볼 수 없다”입니다.
              Google Ads API에서는 최근 7일 `구매완료` 전환값의 {formatPct(conversionSummary7d.primaryKnownNpayShareOfPlatform)}가
              known NPay label로 분류되고, 아임웹 live HTML에는 같은 라벨을 쓰는 NPay count 코드가 보입니다.
              반면 내부 NPay 실제 결제완료는 별도 주문 원장과 bridge 후보표에서 확인해야 합니다.
            </p>
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>결제 테스트보다 먼저 볼 것</strong>
            <p>
              Google 광고 랜딩 URL은 `gclid`, `gbraid`, `gad_campaignid`가 붙는지 확인하는 용도입니다.
              하지만 `구매완료`가 실제 결제완료인지 알려주지는 않습니다. 더 빠른 확인은 제품 페이지에서
              NPay 버튼을 누르는 순간 Google Ads `구매완료` 요청이 나가는지 보는 것입니다.
              결제 전에 요청이 나가면, 그 신호는 실제 구매가 아니라 NPay 버튼/주문시작 신호입니다.
            </p>
          </div>

          <div className={styles.signalFlowGrid}>
            {googleNpayProofSteps.map((item) => (
              <article key={item.label} className={styles.signalFlowCard}>
                <span>{item.label}</span>
                <strong>{item.verdict}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.signalFlowGrid}>
            {googlePurchaseSignalSplit.map((item) => (
              <article key={item.label} className={styles.signalFlowCard}>
                <span>{item.label}</span>
                <strong>{item.verdict}</strong>
                <p>{item.detail}</p>
                <em>{item.risk}</em>
              </article>
            ))}
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>Google Ads 설정은 이렇게 정리하는 것이 안전합니다</strong>
            <p>
              지금 바로 기존 `구매완료`를 끄는 것보다, 먼저 실제 결제완료 전용 신호를 no-send로 안정화하고
              그 다음 Google Ads 전환 설정을 바꾸는 순서가 맞습니다. 이유는 기존 `구매완료`가 현재 자동입찰 학습에 쓰이는
              Primary 전환이기 때문입니다.
            </p>
            <p>
              쉽게 말하면, 지금 Google Ads는 “NPay 버튼을 누른 사람”까지 구매처럼 배웠을 가능성이 큽니다.
              앞으로는 “진짜 돈을 낸 주문”만 배우게 바꿔야 하지만, 대체 신호 없이 갑자기 끊으면 광고 학습이 흔들릴 수 있습니다.
            </p>
          </div>

          <div className={styles.noSendStepGrid}>
            {googleAdsConversionCleanupPlan.map((item) => (
              <article key={item.step} className={styles.noSendStepCard}>
                <span>{item.lane}</span>
                <strong>{item.step}</strong>
                <p>{item.action}</p>
                <em>{item.why}</em>
                <p>{item.success}</p>
                <small>{item.owner} · {item.approval}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.conversionActionSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google이 무엇을 구매로 세는지 먼저 분해</h2>
              <p>
                Primary 전환은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호입니다.
                여기서 실제 결제완료가 아닌 NPay 클릭/count 성격이 섞이면 Google ROAS가 내부 매출보다 크게 부풀 수 있습니다.
              </p>
            </div>
            <span className={styles.metaText}>source: Google Ads summary-first · 기준 {formatFetchedAt(last7.fetchedAt)}</span>
          </div>

          <div className={styles.conversionSummaryGrid}>
            <div className={styles.conversionSummaryCard}>
              <span>최근 7일 Google 주장 구매값</span>
              <strong>{formatKrw(conversionSummary7d.primaryConversionValue)}</strong>
              <p>
                그중 known NPay label 전환값이 {formatKrw(conversionSummary7d.primaryKnownNpayConversionValue)}입니다.
                비중은 {formatPct(conversionSummary7d.primaryKnownNpayShareOfPlatform)}입니다.
              </p>
            </div>
            <div className={styles.conversionSummaryCard}>
              <span>최근 7일 내부 confirmed와의 차이</span>
              <strong className={styles.danger}>{formatKrw(conversionSummary7d.platformMinusInternalConfirmed)}</strong>
              <p>
                같은 기간 실제 결제완료 원장으로 검증된 매출과 Google 주장값의 차이입니다.
                이 차이를 줄이려면 전환 액션 오염과 click id 유실을 따로 봐야 합니다.
              </p>
            </div>
            <div className={styles.conversionSummaryCard}>
              <span>최근 30일 Google 주장 구매값</span>
              <strong>{formatKrw(conversionSummary30d.primaryConversionValue)}</strong>
              <p>
                30일 기준으로도 known NPay label 비중은 {formatPct(conversionSummary30d.primaryKnownNpayShareOfPlatform)}입니다.
                즉 구조적 오염 가능성이 7일 일시 현상으로 보이지 않습니다.
              </p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>전환 액션</th>
                  <th>입찰 사용</th>
                  <th>전환값</th>
                  <th>All conv. 값</th>
                  <th>위험 해석</th>
                </tr>
              </thead>
              <tbody>
                {conversionActions7d.map((action) => (
                  <tr key={`${action.conversionActionId}-${action.conversionActionName}`}>
                    <td>
                      <strong className={styles.conversionActionName}>{action.conversionActionName}</strong>
                      <span>action id {action.conversionActionId ?? "unknown"} · {action.category}</span>
                    </td>
                    <td>
                      <strong>{action.primaryForGoal ? "Primary" : "Secondary"}</strong>
                      <span>{conversionClassificationLabel(action.classification)}</span>
                    </td>
                    <td>
                      <strong>{formatKrw(action.conversionValue)}</strong>
                      <span>{formatCount(action.conversions)} conv.</span>
                    </td>
                    <td>
                      <strong>{formatKrw(action.allConversionValue)}</strong>
                      <span>{formatCount(action.allConversions)} all conv.</span>
                    </td>
                    <td>
                      <div className={styles.riskBadgeList}>
                        {(action.riskFlags.length ? action.riskFlags : ["risk_not_flagged"]).map((flag) => (
                          <span key={flag} className={styles.riskBadge}>{riskFlagLabel(flag)}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.plainQuestionBox}>
            <strong>쉬운 해석</strong>
            <p>
              Google Ads가 `구매완료`라고 이름 붙인 숫자는 “실제 돈을 낸 주문”이라고 바로 읽으면 안 됩니다.
              지금 증거로는 NPay 구매버튼/count 쪽 신호가 Primary 전환=입찰 학습에 쓰는 핵심 구매 신호로 들어간 가능성이 큽니다.
              그래서 화면에서는 `Google Ads 주장 구매`와 `내부 실제 결제완료`를 따로 보여줍니다.
            </p>
          </div>
          <p className={styles.postPatchDecision}>
            현재 가장 큰 갭 원인은 Google Ads의 `구매완료` Primary 전환값 대부분이 known NPay label에서 발생한다는 점입니다.
            NPay 실제 결제완료는 매출로 포함해야 하지만, NPay 클릭/count를 구매완료로 학습시키면 예산 판단 ROAS가 부풀 수 있습니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.exactEvidenceSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>실제 주문으로 이어진 Google 클릭 증거</h2>
              <p>
                exact evidence는 광고 클릭과 실제 결제완료 주문이 주문 단위로 붙는 증거입니다.
                Google Ads에 실제 구매만 알려주려면 이 증거가 먼저 내부 장부에 고정되어야 합니다.
              </p>
            </div>
            <span className={styles.metaText}>
              source: {npayBridgeReview.source} · 기준 {formatFetchedAt(npayBridgeReview.generatedAt)} · {npayBridgeReview.windowLabel}
            </span>
          </div>
          <div className={styles.exactEvidenceGrid}>
            <article className={styles.exactDecisionCard}>
              <div className={styles.requestTop}>
                <span className={exactEvidenceStatusClass}>영구 반영 전</span>
                <span>no-write / no-send</span>
              </div>
              <h3>강한 후보는 생겼지만 아직 Google Ads로 보내지 않습니다.</h3>
              <p>
                NPay 외부 결제완료와 내부 주문을 연결할 수 있는 후보는 생겼습니다.
                하지만 이 후보들은 아직 영구 원장에 쓰지 않았고, Google click id가 없는 후보는 Google Ads가 인정할 전송 후보가 아닙니다.
              </p>
              <div className={styles.exactMetricGrid}>
                <div>
                  <span>A급 내부 후보</span>
                  <strong>{formatCount(npayBridgeReview.summary.gradeA)}건</strong>
                  <em>내부 bridge 후보</em>
                </div>
                <div>
                  <span>B급 수동 검토</span>
                  <strong>{formatCount(npayBridgeReview.summary.gradeB)}건</strong>
                  <em>A급 승격 {formatCount(npayBridgeReview.summary.gradeBPromotableToGradeANow)}건</em>
                </div>
                <div>
                  <span>click id 있는 bridge</span>
                  <strong>{formatCount(npayBridgeReview.summary.internalBridgeExactWithGoogleClickId)}건</strong>
                  <em>자동 전송 아님</em>
                </div>
                <div>
                  <span>Google Ads 전송 후보</span>
                  <strong>{formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건</strong>
                  <em>승인 전 0 유지</em>
                </div>
              </div>
              <div className={styles.exactNextBox}>
                <strong>다음 액션</strong>
                <span>
                  A급 내부 후보는 no-write 검토표로 계속 확장합니다.
                  Google Ads 전송 후보는 직접 click id와 영구 evidence가 함께 확인될 때만 별도로 올립니다.
                </span>
              </div>
            </article>
            <article className={styles.exactDetailCard}>
              <h3>왜 “거의 다 된 것”이 아니라 “영구 반영 전”인가</h3>
              <div className={styles.exactFlow}>
                <div className={styles.exactFlowStep}>
                  <span>1</span>
                  <div>
                    <strong>클릭: 광고 클릭은 잘 저장됩니다</strong>
                    <p>
                      최근 7일 NPay click intent는 {formatCount(npayBridgeReview.summary.liveIntentCount)}건이고,
                      그중 Google click id가 있는 bridge 후보도 따로 분리됩니다.
                    </p>
                  </div>
                </div>
                <div className={styles.exactFlowStep}>
                  <span>2</span>
                  <div>
                    <strong>주문 연결: 내부 후보와 전송 후보를 나눕니다</strong>
                    <p>
                      내부 bridge 후보 {formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건 중
                      A급은 {formatCount(npayBridgeReview.summary.gradeA)}건,
                      B급은 {formatCount(npayBridgeReview.summary.gradeB)}건입니다.
                      하지만 Google Ads 전송 후보는 {formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건입니다.
                    </p>
                  </div>
                </div>
                <div className={styles.exactFlowStep}>
                  <span>3</span>
                  <div>
                    <strong>영구 반영: 아직 장부에 쓰지 않았습니다</strong>
                    <p>
                      VM Cloud write와 운영DB write는 모두 0건입니다.
                      실제 광고 전송이나 장부 고정 전에 no-write 표에서 주문별 근거를 더 확인합니다.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <div className={styles.exactSummaryRow}>
            <div>
              <span>NPay click intent</span>
              <strong>{formatCount(npayBridgeReview.summary.liveIntentCount)}건</strong>
            </div>
            <div>
              <span>NPay 실제 결제완료</span>
              <strong>{formatCount(npayBridgeReview.summary.actualConfirmedNpayOrders)}건</strong>
            </div>
            <div>
              <span>strong match</span>
              <strong>{formatCount(npayBridgeReview.summary.internalBridgeStrongCandidates)}건</strong>
            </div>
            <div>
              <span>B급 보류</span>
              <strong>{formatCount(npayBridgeReview.summary.gradeB)}건</strong>
            </div>
            <div>
              <span>ambiguous 보류</span>
              <strong>{formatCount(npayBridgeReview.summary.ambiguous)}건</strong>
            </div>
            <div>
              <span>영구 snapshot</span>
              <strong>{formatCount(npayBridgeReview.summary.vmCloudWrite + npayBridgeReview.summary.operationalDbWrite)}건</strong>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.bridgeSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>NPay 내부 bridge 후보와 Google Ads 전송 후보</h2>
              <p>
                같은 NPay 결제완료라도 “내부 보고서에서 같은 주문으로 볼 수 있는 후보”와
                “Google Ads에 실제 구매로 보내도 되는 후보”는 다릅니다. 이 섹션은 두 숫자를 섞지 않기 위한 검토판입니다.
              </p>
            </div>
            <span className={styles.metaText}>
              source: {npayBridgeReview.source} · 기준 {formatFetchedAt(npayBridgeReview.generatedAt)} · {npayBridgeReview.windowLabel}
            </span>
          </div>

          <div className={styles.bridgeIntroGrid}>
            <article className={styles.bridgeIntroCard}>
              <span>내부 bridge 후보</span>
              <strong>{formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건</strong>
              <p>
                내부 bridge 후보=우리 내부 보고서에서 “이 NPay 결제는 이 광고 클릭에서 이어졌을 가능성이 높다”고 보는 후보입니다.
                실제 장부 write는 아직 하지 않았습니다.
              </p>
            </article>
            <article className={styles.bridgeIntroCard}>
              <span>Google click id 있는 bridge</span>
              <strong>{formatCount(npayBridgeReview.summary.internalBridgeExactWithGoogleClickId)}건</strong>
              <p>
                내부 bridge exact 중 Google 광고 클릭 증거가 같이 있는 주문입니다.
                이 숫자는 내부 분석에는 중요하지만, 자동으로 Google Ads 전송 후보가 되지는 않습니다.
              </p>
            </article>
            <article className={styles.bridgeIntroCard}>
              <span>Google Ads 전송 후보</span>
              <strong className={styles.danger}>{formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건</strong>
              <p>
                Google Ads 전송 후보=Google Ads에 “이 주문은 실제 구매입니다”라고 보내도 되는 후보입니다.
                직접 click id와 중복 방지 검증이 더 필요하므로 현재 0건입니다.
              </p>
            </article>
            <article className={styles.bridgeIntroCard}>
              <span>실제 write/apply</span>
              <strong>{formatCount(npayBridgeReview.summary.vmCloudWrite + npayBridgeReview.summary.operationalDbWrite)}건</strong>
              <p>
                이번 표는 검토용입니다. VM Cloud 원장에 bridge row를 쓰거나 Google Ads로 전송한 내역은 없습니다.
              </p>
            </article>
          </div>

          <div className={styles.signalFlowGrid}>
            <article className={styles.signalFlowCard}>
              <span>NPay bridge URL hash 저장</span>
              <strong>{formatCount(npayBridgeSummary.liveIntentWithNpayBridgeUrlHash)}건</strong>
              <p>
                네이버 외부 결제창/로그인창 주소를 원문으로 저장하지 않고 hash로 보관한 버튼 클릭 row입니다.
                이 값이 있어야 나중에 “어느 버튼 클릭이 어느 NPay 결제로 이어졌는지”를 더 안정적으로 자동 연결할 수 있습니다.
              </p>
              <em>전체 NPay 버튼 클릭 {formatCount(npayBridgeSummary.liveIntentCount)}건 중 {formatRatePct(npayBridgeHashRate)} 준비</em>
            </article>
            <article className={styles.signalFlowCard}>
              <span>Google 흔적 + bridge hash</span>
              <strong>{formatCount(npayBridgeSummary.googleLikeIntentWithNpayBridgeUrlHash)}건</strong>
              <p>
                Google 광고 흔적이 있는 NPay 버튼 클릭 중 네이버 bridge hash까지 같이 남은 건수입니다.
                현재 값이 낮으면 “광고 클릭은 알지만 외부 결제창 연결고리는 약한” 상태입니다.
              </p>
              <em>Google 흔적 NPay 클릭 {formatCount(npayBridgeSummary.googleLikeIntentCount)}건 중 {formatRatePct(googleLikeBridgeHashRate)}</em>
            </article>
            <article className={styles.signalFlowCard}>
              <span>A급 bridge + hash</span>
              <strong>{formatCount(npayBridgeSummary.gradeAWithNpayBridgeUrlHash)}건</strong>
              <p>
                주문-버튼 연결은 A급이고, 네이버 bridge hash도 있는 주문입니다.
                이 값이 늘면 수동 판정 없이 결제완료 주문을 자동 연결할 수 있는 기반이 커집니다.
              </p>
              <em>A급 전체 {formatCount(npayBridgeSummary.gradeA)}건 중 {formatRatePct(gradeABridgeHashRate)} hash 동반</em>
            </article>
            <article className={styles.signalFlowCard}>
              <span>A급 + hash + Google click id</span>
              <strong>{formatCount(npayBridgeSummary.gradeAWithGoogleClickIdAndNpayBridgeUrlHash)}건</strong>
              <p>
                내부 연결도 강하고, 네이버 bridge hash도 있고, Google Ads가 요구하는 click id까지 있는 후보입니다.
                이 숫자가 실제 구매 전용 Google 전송 후보로 올라갈 수 있는 핵심 후보군입니다.
              </p>
              <em>A급 전체 대비 {formatRatePct(gradeAGoogleBridgeHashRate)}. 그래도 중복/취소/금액 guard 통과 전에는 자동 전송하지 않음</em>
            </article>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>NPay bridge 저장값 보강 효과를 이렇게 판정합니다</strong>
            <p>
              보강 전에는 버튼 클릭만 있고 네이버 외부 결제창 연결고리가 약했습니다. 이제는
              전체 NPay 버튼 클릭 대비 bridge hash 저장률, Google 흔적 클릭 대비 bridge hash 저장률,
              A급 주문 대비 bridge hash 동반률을 따로 봅니다.
            </p>
            <p>
              이 세 숫자가 올라가면 “버튼 클릭은 봤는데 결제완료 주문과 다시 못 붙이는 문제”가 줄어든 것입니다.
              반대로 클릭 수는 많은데 bridge hash나 A급 연결률이 낮으면 Google Ads 전송 문제가 아니라
              네이버 외부 결제창 이후 연결 장부가 아직 약한 상태입니다.
            </p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>후보 생성기와 전송 장부의 중복 제거 기준</strong>
            <p>
              후보 생성기는 “보낼 수 있을지 모르는 주문을 찾는 표”이고, 전송 장부는 “이미 Google Ads에 보내려고 시도한 기록”입니다.
              같은 주문이 두 표에 동시에 보이면 전송 장부가 우선입니다.
            </p>
            <p>
              중복 방지 기준은 site, 전환 액션, 결제 날짜, 결제금액, 내부 주문 식별자 또는 private safe ref입니다.
              원문 주문번호나 원문 click id가 화면에 없어도 서버 내부에서는 같은 후보를 한 번만 전송 대상으로 봅니다.
              원문 식별자가 부족해 같은 주문인지 확정하지 못하면 자동 전송 후보가 아니라 “검토 필요”로 둡니다.
            </p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>자동 연결 기준을 더 좁혔습니다</strong>
            <p>
              NPay 버튼 클릭 row는 결제완료보다 먼저 찍힌 경우에만 주문 연결 후보로 봅니다.
              결제 후에 같은 브라우저에서 다시 눌린 버튼이나 로그인 화면 재시도 row는 실제 구매의 원인으로 쓰지 않습니다.
            </p>
            <p>
              Google Ads에 보낼 후보는 더 엄격합니다. 실제 NPay 결제완료 주문과 버튼 클릭이 강하게 붙어도,
              그 버튼 클릭 row에 gclid, gbraid, wbraid 중 하나가 없으면 내부 분석용 후보로만 남깁니다.
            </p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>NPay 단계 라벨 읽는 법</strong>
            <p>
              NPay는 자사몰 버튼 클릭 뒤 네이버 도메인으로 넘어갑니다. 그래서 자사몰 안에서 직접 본 단계와,
              네이버 화면 안에서 일어났을 가능성이 있는 단계를 섞어 말하면 안 됩니다.
              아래 라벨은 “확정 가능”, “가능 후보”, “실제 주문 원장으로 확정”을 분리해서 보여줍니다.
            </p>
            <em>
              보고서 주소: http://localhost:7010/ads/google-roas-report · source: NPay intent log + 실제 주문 원장
            </em>
            <em>
              최근 7일 카드는 오늘 포함 7일 범위로 읽습니다. Google Ads 기본 last_7d와 달리 오늘 들어온
              NPay bridge hash와 entered_not_completed 분해 결과를 바로 반영하기 위한 기준입니다.
            </em>
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>NPay 결제 진행 단계별 태그 발화 구조</strong>
            <p>
              이 퍼널은 “버튼을 눌렀다”와 “실제로 결제했다”를 분리해서 보기 위한 지도입니다.
              앞쪽 단계는 의도 신호이고, 마지막 실제 결제완료 단계만 Google Ads의 주 구매 신호 후보입니다.
            </p>
            <div className={styles.npayTagFunnel}>
              {npayPaymentTagFunnelRows.map((row, index) => (
                <article className={styles.npayTagFunnelStep} key={row.stage}>
                  <div className={styles.npayTagFunnelTop}>
                    <span>{row.step}</span>
                    <em>{row.status}</em>
                  </div>
                  <strong>{row.stage}</strong>
                  <p>{row.meaning}</p>
                  <dl>
                    <div>
                      <dt>켜지는 신호</dt>
                      <dd>{row.tag}</dd>
                    </div>
                    <div>
                      <dt>실제 동작</dt>
                      <dd>{row.fires}</dd>
                    </div>
                  </dl>
                  {index < npayPaymentTagFunnelRows.length - 1 ? (
                    <b aria-hidden="true">↓</b>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className={styles.signalFlowGrid}>
            {npayStageLabelRows.map((row) => (
              <article className={styles.signalFlowCard} key={row.key}>
                <span>{row.key}</span>
                <strong>{row.certainty}</strong>
                <p>
                  {row.countText} · {row.meaning}
                </p>
                <em>{row.evidence}</em>
              </article>
            ))}
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>entered_not_completed 자동 분해</strong>
            <p>
              이 값은 “네이버 결제창으로 넘어간 흔적은 있는데, 같은 기간의 실제 결제완료 주문과 아직 자동으로 붙지 않은 row”입니다.
              한 덩어리로 보면 원인을 알기 어렵기 때문에 아래처럼 나눠 봅니다.
            </p>
            <div className={styles.signalFlowGrid}>
              <article className={styles.signalFlowCard}>
                <span>pending_window</span>
                <strong>{formatCount(npayEnteredNotCompletedBreakdown.pendingWindow)}건</strong>
                <p>버튼 클릭 후 아직 24시간이 지나지 않아 “이탈”로 단정하지 않는 후보입니다.</p>
                <em>결제완료가 늦게 들어오거나 주문 원장 sync가 늦을 수 있습니다.</em>
              </article>
              <article className={styles.signalFlowCard}>
                <span>login_gate_possible</span>
                <strong>{formatCount(npayEnteredNotCompletedBreakdown.loginGatePossible)}건</strong>
                <p>네이버 로그인 화면에서 멈췄을 가능성이 큰 후보입니다.</p>
                <em>네이버 로그인 도메인은 자사몰 스크립트가 직접 볼 수 없어 후보로만 표시합니다.</em>
              </article>
              <article className={styles.signalFlowCard}>
                <span>checkout_opened_possible</span>
                <strong>{formatCount(npayEnteredNotCompletedBreakdown.checkoutOpenedPossible)}건</strong>
                <p>네이버 결제서까지 열렸지만 실제 결제완료 주문과 아직 안 붙은 후보입니다.</p>
                <em>결제서 이탈, 결제 실패, 결제완료 원장 지연이 섞일 수 있습니다.</em>
              </article>
              <article className={styles.signalFlowCard}>
                <span>matching_gap_possible</span>
                <strong>{formatCount(npayEnteredNotCompletedBreakdown.matchingGapPossible)}건</strong>
                <p>URL 흔적은 있지만 host/시간/금액 기준만으로 자동 분류가 어려운 후보입니다.</p>
                <em>이 숫자가 많으면 bridge 원문 저장 또는 주문번호 bridge가 더 필요합니다.</em>
              </article>
            </div>
          </div>

          <div className={styles.plainQuestionBox}>
            <strong>실제 결제완료 주문과 자동 연결하는 기준</strong>
            <p>
              자동 연결은 “NPay 버튼 클릭이 있었다”만으로 하지 않습니다. 결제완료 주문보다 먼저 찍힌 버튼 클릭이어야 하고,
              bridge URL hash가 있으면 더 강하게 보고, 시간 간격과 금액이 맞아야 합니다.
              지금 화면에서는 이 조건을 통과한 주문을 A급 bridge 후보로 표시합니다.
            </p>
            <p>
              Google Ads에 실제 구매로 보낼 수 있는 후보는 여기서 한 번 더 좁힙니다.
              A급 bridge 후보라도 Google이 받아줄 gclid, gbraid, wbraid 중 하나가 전송 가능한 형태로 남아 있고,
              중복 전송·취소·환불·금액 불일치 방어를 통과해야 합니다.
            </p>
            <em>
              현재 A급 bridge 후보 {formatCount(npayBridgeSummary.gradeA)}건 ·
              bridge hash 동반 {formatCount(npayBridgeSummary.gradeAWithNpayBridgeUrlHash)}건 ·
              Google click id와 bridge hash 동반 {formatCount(npayBridgeSummary.gradeAWithGoogleClickIdAndNpayBridgeUrlHash)}건 ·
              Google Ads 전송 후보 {formatCount(npayBridgeSummary.googleAdsSendCandidates)}건
            </em>
          </div>

          {npayIntentSourceGap ? (
            <div className={styles.bridgeExplainBox}>
              <strong>현재 로컬 원장 주의</strong>
              <p>
                이 화면의 로컬 백엔드가 NPay 버튼 클릭 원장을 아직 읽지 못하고 있습니다.
                실제 결제완료 주문은 보이지만 버튼 클릭 row가 0건이면 “버튼 클릭이 없었다”가 아니라
                로컬 DB와 VM Cloud 수집 원장이 다른 상태로 해석해야 합니다.
              </p>
            </div>
          ) : null}

	          <div className={styles.signalFlowGrid}>
	            <article className={styles.signalFlowCard}>
	              <span>Google로 보이는 NPay 버튼 클릭</span>
              <strong>{formatCount(npayBridgeSummary.googleLikeIntentCount)}건</strong>
              <p>
                Google click id가 있거나 URL/UTM에 Google 광고 흔적이 있는 NPay 버튼 클릭입니다.
                전체 NPay 버튼 클릭은 {formatCount(npayBridgeSummary.liveIntentCount)}건입니다.
              </p>
              <em>source: NPay button intent log</em>
            </article>
            <article className={styles.signalFlowCard}>
              <span>그중 Google click id 보존</span>
              <strong>{formatRatePct(googleLikeNpayClickIdPreservationRate)}</strong>
              <p>
                {formatCount(npayBridgeSummary.googleLikeIntentWithGoogleClickId)} / {formatCount(npayBridgeSummary.googleLikeIntentCount)}건입니다.
                전체 NPay 버튼 클릭 기준 보존률은 {formatRatePct(allNpayClickIdPreservationRate)}입니다.
              </p>
              <em>
                gclid {formatCount(npayBridgeSummary.googleClickIdIntentBreakdown.gclid)} ·
                gbraid {formatCount(npayBridgeSummary.googleClickIdIntentBreakdown.gbraid)} ·
                wbraid {formatCount(npayBridgeSummary.googleClickIdIntentBreakdown.wbraid)}
              </em>
            </article>
            <article className={styles.signalFlowCard}>
              <span>실제 NPay 결제완료로 연결</span>
              <strong>{formatRatePct(googleLikeNpayButtonToCompletedRate)}</strong>
              <p>
                Google로 보이는 버튼 클릭 {formatCount(npayBridgeSummary.googleLikeIntentCount)}건 중
                실제 결제완료와 강하게 연결된 주문은 {formatCount(npayBridgeSummary.googleLikeCompletedOrders)}건입니다.
                금액은 {formatKrw(npayBridgeSummary.googleLikeCompletedAmountKrw)}입니다.
              </p>
              <em>
                결제완료 주문에 직접 click id가 같이 남은 건은 {formatCount(npayBridgeSummary.googleLikeCompletedWithDirectGoogleClickId)}건입니다.
              </em>
	            </article>
	          </div>

	          <div className={styles.signalFlowGrid}>
	            <article className={styles.signalFlowCard}>
	              <span>전체 NPay 버튼 클릭</span>
	              <strong>{formatCount(npayBridgeSummary.liveIntentCount)}건</strong>
	              <p>
	                우리 사이트에서 NPay 버튼을 눌러 네이버 결제 화면으로 넘어간 기록입니다.
	                이 단계는 “구매 의도”이지 “결제 완료”가 아닙니다.
	              </p>
	              <em>click id 보존 {formatCount(npayBridgeSummary.googleClickIdIntentCount)}건</em>
	            </article>
	            <article className={styles.signalFlowCard}>
	              <span>실제 NPay 결제완료</span>
	              <strong>{formatCount(npayBridgeSummary.actualConfirmedNpayOrders)}건</strong>
	              <p>
	                NPay 버튼 클릭 {formatCount(npayBridgeSummary.liveIntentCount)}건 중 결제완료 주문으로 확인된 비율은
	                {formatRatePct(allNpayButtonToCompletedRate)}입니다.
	              </p>
	              <em>모든 유입 포함, Google 전용 아님</em>
	            </article>
	            <article className={styles.signalFlowCard}>
	              <span>A급 내부 bridge 후보</span>
	              <strong>{formatCount(npayBridgeSummary.gradeA)}건</strong>
	              <p>
	                버튼 클릭과 결제완료가 시간/금액 기준으로 강하게 붙은 주문입니다.
	                실제 결제완료 {formatCount(npayBridgeSummary.actualConfirmedNpayOrders)}건 중 {formatRatePct(npayGradeAToCompletedRate)}입니다.
	              </p>
	              <em>내부 연결 후보이지 Google 전송 후보는 아님</em>
	            </article>
	            <article className={styles.signalFlowCard}>
	              <span>Google Ads 전송 후보</span>
	              <strong>{formatCount(npayBridgeSummary.googleAdsSendCandidates)}건</strong>
	              <p>
	                Google에 실제 구매로 다시 알려도 되는 주문만 세는 값입니다.
	                현재 비율은 {formatRatePct(npayGoogleAdsSendCandidateRate)}입니다.
	              </p>
	              <em>raw click id와 중복 방지 조건을 모두 통과해야 함</em>
	            </article>
	          </div>

	          <div className={styles.plainQuestionBox}>
	            <strong>A급 {formatCount(npayBridgeSummary.gradeA)}건인데 왜 Google Ads 전송 후보는 {formatCount(npayBridgeSummary.googleAdsSendCandidates)}건인가</strong>
	            <p>
	              A급은 “이 NPay 결제완료가 우리 사이트의 NPay 버튼 클릭에서 이어진 것이 거의 맞다”는 내부 판단입니다.
	              하지만 Google Ads에 전송하려면 한 단계가 더 필요합니다. Google이 다시 확인할 수 있는
	              gclid, gbraid, wbraid 원문값 중 하나가 전송용 payload에 안전하게 붙어 있어야 합니다.
	            </p>
	            <p>
	              현재 A급 후보는 구매 연결은 강하지만, 실제 전송에 쓸 직접 Google click id가 없거나
	              recovered/session evidence 수준입니다. 그래서 내부 분석에는 쓰되 Google Ads 자동 전송은 막습니다.
	              이 선을 지켜야 버튼 클릭이나 시간 추정만으로 구매를 과장해서 보내는 일을 피할 수 있습니다.
	            </p>
	          </div>

	          <div className={styles.plainQuestionBox}>
	            <strong>수동으로 계속 쪼개야 하나</strong>
	            <p>
	              계속 수동으로 볼 필요가 없게 만드는 방향이 맞습니다. 앞으로는 NPay 버튼 클릭 시점에
	              광고 click id, 유입 URL, 상품/금액, 브라우저 세션, 네이버 bridge URL 일부를 함께 저장하고,
	              NPay 결제완료 주문이 들어오면 서버가 자동으로 “Google/Meta/Naver/organic/direct/미분류”를 나눕니다.
	            </p>
	            <p>
	              사람이 볼 것은 자동 분류에서 애매하다고 남은 주문뿐입니다. 지금 화면의 목표도
	              “전체를 수동으로 판정”이 아니라 “자동 판정 기준을 만들고, 애매한 부분만 좁히는 것”입니다.
	            </p>
	          </div>

	          <div className={styles.plainQuestionBox}>
	            <strong>현재 판단: 허수와 추적 실패가 둘 다 있다</strong>
	            <p>
	              기존 Google Ads 구매완료는 NPay 버튼/결제진입 신호까지 구매처럼 세던 흔적이 있어 허수 가능성이 큽니다.
	              동시에 버튼 클릭 단계에서는 Google click id가 많이 남는데, 네이버 외부 결제완료 단계로 넘어가면
	              주문 row에 그 값이 직접 남지 않아 실제 Google 매출도 일부 놓치고 있습니다.
	            </p>
	            <p>
	              그래서 지금의 해결 방향은 두 가지입니다. Google Ads에서는 버튼 클릭 신호를 보조로 낮추고,
	              실제 결제완료만 주 전환으로 쓰는 통로를 만들며, NPay bridge 저장을 보강해 실제 Google 구매를 더 많이 찾아냅니다.
	            </p>
	          </div>

	          <div className={styles.plainQuestionBox}>
	            <strong>Google click id와 gclid/gbraid/wbraid 관계</strong>
            <p>
              Google click id는 Google 광고 클릭을 다시 알아보기 위한 식별자를 묶어 부르는 말입니다.
              이 화면에서는 gclid, gbraid, wbraid 중 하나라도 있으면 “Google click id 보존”으로 셉니다.
              gclid는 일반 웹 클릭 식별자, gbraid는 iOS 등 개인정보 보호 환경에서 앱/웹 전환 측정에 쓰이는 Google 식별자,
              wbraid는 웹 전환 측정에 쓰이는 Google 식별자입니다.
            </p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>NPay 버튼 클릭에서 실제 결제완료까지, 유입별로 나눠 봅니다</strong>
            <p>
              이 표는 NPay 버튼을 누른 사람 중 실제 결제완료 주문과 자동으로 붙은 비율입니다.
              Google은 Google 광고 흔적이 있는 버튼 클릭, Meta는 Meta/Facebook/Instagram 흔적이 있는 버튼 클릭,
              기타는 Naver, organic, direct, 출처 유실을 포함합니다.
            </p>
            <p>
              이 값은 “구매 의도”와 “실제 구매”를 분리하기 위한 표입니다.
              버튼 클릭 수가 많아도 결제완료와 붙지 않으면 Google Ads 주 구매 신호로 쓰지 않습니다.
            </p>
          </div>

          {npaySourceFunnelComparison.length > 0 ? (
            <div className={styles.signalFlowGrid}>
              {npaySourceFunnelComparison.map((row) => (
                <article className={styles.signalFlowCard} key={`npay-source-funnel-${row.channel}`}>
                  <span>{row.label}</span>
                  <strong>{row.completionRatePct.toFixed(2)}%</strong>
                  <p>
                    버튼 클릭 {formatCount(row.intentCount)}건 중 실제 결제완료 연결 {formatCount(row.completedOrders)}건입니다.
                    결제완료 금액은 {formatKrw(row.completedAmountKrw)}입니다.
                  </p>
                  <em>
                    bridge 열린 클릭 {formatCount(row.bridgeOpenedIntentCount)}건 ·
                    Google click id 있는 클릭 {formatCount(row.googleClickIdIntentCount)}건
                  </em>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.bridgeExplainBox}>
              <strong>NPay 유입별 버튼→결제완료 비교</strong>
              <p>
                현재 연결된 API는 유입별 NPay 버튼→결제완료 비교표를 아직 내려주지 않습니다.
                백엔드 최신화 후 Google/Meta/기타별 클릭 수, 결제완료 수, 전환율이 표시됩니다.
              </p>
            </div>
          )}

          <div className={styles.bridgeExplainBox}>
            <strong>자동 연결이 아직 불충분한 주문 상세</strong>
            <p>
              아래 표는 “실제 NPay 결제완료 주문은 있는데, 버튼 클릭 row와 자동으로 붙이기에는 증거가 부족한 주문”입니다.
              어떤 정보가 있고 어떤 정보가 없는지 함께 보여줍니다. 원문 주문번호와 원문 click id는 화면에 노출하지 않습니다.
            </p>
            <p>
              현재 표시된 보류 row {formatCount(npayUnresolvedRows.length)}건 중 금액 조합 문제가 있는 row는
              {" "}{formatCount(npayAmountMismatchRows.length)}건, 시간 기준이 애매한 row는
              {" "}{formatCount(npayTimeAmbiguousRows.length)}건입니다.
            </p>
            {npayAmountMismatchRows.length > 0 ? (
              <p>
                금액 조합 문제는 {npayAmountMismatchCategorySummary || "아직 세부 분류 없음"}으로 나눠 봅니다.
                이 분류는 “왜 가격이 안 맞아 보이는지”를 먼저 좁히기 위한 no-write 진단입니다.
              </p>
            ) : null}
          </div>

          {npayUnresolvedRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.bridgeReviewTable}`}>
                <thead>
                  <tr>
                    <th>주문</th>
                    <th>있는 정보</th>
                    <th>없는 정보/막힌 이유</th>
                    <th>다음 보강</th>
                  </tr>
                </thead>
                <tbody>
                  {npayUnresolvedRows.slice(0, 10).map((row) => (
                    <tr key={`npay-unresolved-${row.orderNumber}-${row.channelOrderNo}`}>
                      <td>
                        <strong>{maskIdentifier(row.orderNumber)} · {formatKrw(row.orderAmount)}</strong>
                        <span>
                          {row.status === "ambiguous"
                            ? "자동 연결 애매함"
                            : row.status === "purchase_without_intent"
                              ? "주변 버튼 클릭 없음"
                              : `B급 후보${row.strongGrade ? ` (${row.strongGrade})` : ""}`}
                        </span>
                        <span>{row.productNames.join(" + ") || "상품명 없음"}</span>
                      </td>
                      <td>
                        <strong>{row.bestIntentSourceLabel}</strong>
                        <span>{row.availableFacts.length ? row.availableFacts.join(" · ") : "사용 가능한 추가 정보 없음"}</span>
                        <span>
                          order_time {row.orderCreateTimeBridge ?? "없음"}
                          {row.orderCreatedGapMinutes === null ? "" : ` · 클릭과 ${row.orderCreatedGapMinutes}분 차이`}
                        </span>
                      </td>
                      <td>
                        <strong>{row.amountMatchType} · {row.amountReconcileReason}</strong>
                        <span>
                          {row.amountMismatchLabel ?? amountMismatchCategoryLabel(row.amountMismatchCategory)}
                          {row.amountMismatchConfidence ? ` · 신뢰도 ${row.amountMismatchConfidence}` : ""}
                        </span>
                        <span>{row.amountMismatchPlain ?? "금액 차이 원인을 아직 세부 분류하지 못했습니다."}</span>
                        {row.amountMismatchSignals?.length ? (
                          <span>판단 재료: {row.amountMismatchSignals.join(" · ")}</span>
                        ) : null}
                        <span>{row.missingFacts.length ? row.missingFacts.join(" · ") : "큰 누락 정보 없음"}</span>
                        <span>
                          complete/payment 기준 {row.timeGapMinutes === null ? "판단 전" : `${row.timeGapMinutes}분 차이`}
                          {row.bestIntentHasGoogleClickId ? " · Google click id 있음" : " · Google click id 없음"}
                        </span>
                      </td>
                      <td>
                        <strong>{row.candidateCount}개 후보 중 자동 확정 보류</strong>
                        <span>{row.proposedFix}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.bridgeExplainBox}>
              <strong>자동 연결 불충분 상세</strong>
              <p>현재 API가 내려준 보류 row가 없습니다. 최신 VM Cloud API 배포 후 상세 row가 표시됩니다.</p>
            </div>
          )}

          <div className={styles.plainQuestionBox}>
            <strong>왜 complete_time은 늦어 보이고 order_time을 같이 봐야 하나</strong>
            <p>
              NPay 외부 결제는 사용자가 네이버 화면에서 결제를 끝냅니다. 우리 원장에는 보통 두 시간이 남습니다.
              order_time은 사용자가 주문을 만든 시각에 가깝고, complete_time 또는 payment_time은 아임웹/네이버 쪽에서 결제완료가 확정되어
              우리 VM Cloud 원장으로 sync된 시각에 가깝습니다.
            </p>
            <p>
              그래서 사용자는 버튼 클릭 직후 주문을 만들었지만, complete_time만 보면 몇 시간 또는 하루 뒤처럼 보일 수 있습니다.
              자동 연결은 이제 complete_time만 보지 않고, 버튼 클릭과 order_time이 1분 이내로 맞는지를 먼저 봅니다.
              complete_time은 “실제 결제완료가 맞는지” 확인하는 용도이고, order_time은 “어느 버튼 클릭에서 온 주문인지” 붙이는 용도입니다.
            </p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>NPay 결제완료 22건을 유입별로 나눠 봅니다</strong>
            <p>
              NPay 실제 결제완료는 모두 매출입니다. 다만 Google Ads 예산 판단에는
              “그중 Google 광고에서 온 주문”만 따로 봐야 합니다.
              이 표는 실제 결제완료 {formatCount(npayFinalSourceSummary.totalCompletedOrders)}건 중
              버튼 클릭 row와 강하게 붙은 {formatCount(npayFinalSourceSummary.classifiedCompletedOrders)}건을 먼저 나누고,
              아직 붙지 않은 {formatCount(npayFinalSourceSummary.unclassifiedCompletedOrders)}건은 미분류로 남깁니다.
            </p>
            <p>
              현재 Google 증거가 있는 NPay 결제완료 후보는 {formatCount(npayFinalSourceSummary.googleEvidenceOrders)}건,
              금액은 {formatKrw(npayFinalSourceSummary.googleEvidenceAmountKrw)}입니다.
              미분류/direct는 Google 매출로 간주하지 않습니다.
            </p>
          </div>

	          <div className={styles.signalFlowGrid}>
	            {npayFinalSourceSummary.byChannel.map((row) => (
	              <article className={styles.signalFlowCard} key={row.channel}>
                <span>{row.label}</span>
                <strong>{formatCount(row.completedOrders)}건</strong>
                <p>
                  금액 {formatKrw(row.amountKrw)} · 내부 bridge 후보 {formatCount(row.bridgeCandidateOrders)}건
                </p>
                <em>
                  신뢰도 {row.confidence} · 직접 click id {formatCount(row.directGoogleClickIdOrders)}건 ·
                  복구 click id {formatCount(row.recoveredGoogleClickIdOrders)}건
                </em>
		              </article>
		            ))}
		          </div>

          {npayUnclassifiedReasonRows.length > 0 ? (
            <>
              <div className={styles.bridgeExplainBox}>
                <strong>NPay 미분류/보류 주문을 주문당 하나의 주 사유로 다시 쪼갭니다</strong>
                <p>
                  예전 방식은 한 주문이 “금액 불일치”, “시간 애매함”, “click id 없음”처럼 여러 사유에 동시에 잡혀
                  실제로 무엇부터 고쳐야 하는지 흐려졌습니다. 지금 표는 주문 1건당 가장 먼저 풀어야 할 사유 하나만 골라
                  자동 연결 병목을 봅니다.
                </p>
                <p>
                  이 숫자는 “구매가 아니다”라는 뜻이 아닙니다. 실제 NPay 결제완료는 매출이지만,
                  아직 원래 버튼 클릭 row와 안정적으로 붙지 않았거나 광고 전송 근거가 부족하다는 뜻입니다.
                </p>
              </div>
              <div className={styles.signalFlowGrid}>
                {npayUnclassifiedReasonRows.map((row) => (
                  <article className={styles.signalFlowCard} key={`npay-unclassified-${row.reason}`}>
                    <span>{row.label}</span>
                    <strong>{formatCount(row.completedOrders)}건</strong>
                    <p>{row.plain}</p>
                    <em>
                      미분류/보류 내 비중 {row.sharePct.toFixed(2)}% · 샘플 주문 {formatCount(row.sampleOrderCount)}건
                    </em>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.bridgeExplainBox}>
              <strong>NPay 미분류 사유 분해</strong>
              <p>
                현재 API가 주문당 주 사유 분해를 아직 내려주지 않습니다.
                최신 백엔드가 연결되면 미분류가 버튼 클릭 누락, bridge URL 누락, 금액 조합, 시간 차이, 후보 중복으로 자동 표시됩니다.
              </p>
            </div>
          )}

	          {npayFinalSourceDateDistribution.length > 0 ? (
	            <>
	              <div className={styles.bridgeExplainBox}>
	                <strong>NPay 결제완료 날짜별 분포</strong>
	                <p>
	                  날짜별로 실제 결제완료가 언제 몰렸고, 그중 자동 bridge 후보와 Google 증거가 얼마나 있었는지 봅니다.
	                  특정 날짜만 출처가 비는지, 전체적으로 NPay 외부 결제 흐름에서 비는지 구분하기 위한 표입니다.
	                </p>
	              </div>
	              <div className={styles.signalFlowGrid}>
	                {npayFinalSourceDateDistribution.map((row) => (
	                  <article className={styles.signalFlowCard} key={`npay-final-source-${row.dateKst}`}>
	                    <span>{row.dateKst}</span>
	                    <strong>{formatCount(row.completedOrders)}건</strong>
	                    <p>
	                      금액 {formatKrw(row.amountKrw)} · bridge 후보 {formatCount(row.bridgeCandidateOrders)}건 ·
	                      A급 {formatCount(row.gradeA)}건 · B급 {formatCount(row.gradeB)}건
	                    </p>
	                    <em>
	                      Google 증거 {formatCount(row.googleEvidenceOrders)}건 · 직접 click id {formatCount(row.directGoogleClickIdOrders)}건 ·
	                      미분류 {formatCount(row.ambiguous + row.purchaseWithoutIntent)}건
	                    </em>
	                  </article>
	                ))}
	              </div>
	            </>
	          ) : (
	            <div className={styles.bridgeExplainBox}>
	              <strong>NPay 결제완료 날짜별 분포</strong>
	              <p>
	                현재 연결된 API는 날짜별 분포를 아직 내려주지 않습니다.
	                VM Cloud API 배포 후 이 영역에 결제완료 날짜별 건수와 Google 증거 건수가 자동으로 표시됩니다.
	              </p>
	            </div>
	          )}

	          <div className={styles.plainQuestionBox}>
	            <strong>유입 분류 기준</strong>
            <p>{npayFinalSourceSummary.basis}</p>
            <p>{npayFinalSourceSummary.caveat}</p>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>왜 이 구분이 중요한가</strong>
            <p>{npayBridgeReview.plainMeaning}</p>
            <p>{npayBridgeReview.noWritePolicy}</p>
            <em>
              실제 NPay 결제완료 {formatCount(npayBridgeReview.summary.actualConfirmedNpayOrders)}건 ·
              A급 {formatCount(npayBridgeReview.summary.gradeA)}건 ·
              B급 {formatCount(npayBridgeReview.summary.gradeB)}건 ·
              애매한 후보 {formatCount(npayBridgeReview.summary.ambiguous)}건
            </em>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>B급이 왜 A급이 아닌가</strong>
            <p>
              A급은 “네이버에서 결제한 주문”과 “우리 사이트에서 누른 NPay/광고 클릭”이 거의 바로 이어지고,
              금액도 맞아서 자동으로 같은 주문이라고 봐도 되는 후보입니다. B급은 구매가 가짜라는 뜻이 아니라,
              자동으로 장부에 쓰기에는 시간 간격이나 금액 증거가 한 단계 부족하다는 뜻입니다.
            </p>
            <p>
              최근 7일 내부 bridge 후보 {formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건 중
              지금 증거만으로 B를 A로 올릴 수 있는 후보는 {formatCount(npayBridgeReview.summary.gradeBPromotableToGradeANow)}건입니다.
              B급 {formatCount(npayBridgeReview.summary.gradeB)}건은 시간 간격 초과 {formatCount(npayBridgeReview.summary.gradeBBlockedByTimeGap)}건,
              금액 불일치 {formatCount(npayBridgeReview.summary.gradeBBlockedByAmount)}건,
              Google click id 없음 {formatCount(npayBridgeReview.summary.gradeBBlockedByMissingGoogleClickId)}건으로 보류됩니다. 이 사유는 한 주문에 여러 개가 겹칠 수 있습니다.
            </p>
            <em>
              B급 중 Google 흔적이 있는 주문은 row 기준 {formatCount(npayBridgeGradeBRowsWithAnyGoogleEvidence.length)}건입니다.
              그중 intent row에 직접 click id가 남은 것은 {formatCount(npayBridgeGradeBRowsWithDirectIntentClickId.length)}건,
              같은 세션의 직전 Google 클릭 원장에서 복구한 것은 {formatCount(npayBridgeGradeBRowsWithRecoveredClickId.length)}건입니다.
              복구 흔적은 내부 분석 후보이지 Google Ads 자동 전송 후보가 아닙니다.
            </em>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>{npayGradeBWithClickIdReview.title}</strong>
            <p>
              내부 주문 {npayGradeBWithClickIdReview.maskedInternalOrder} ·
              NPay 주문 {npayGradeBWithClickIdReview.maskedChannelOrder} ·
              {formatKrw(npayGradeBWithClickIdReview.amountKrw)} · {npayGradeBWithClickIdReview.productName}
            </p>
            <p>
              Google click id는 {npayGradeBWithClickIdReview.clickIdTypes}로 남았고,
              campaign id는 {npayGradeBWithClickIdReview.campaignId}입니다.
              그래도 결제완료까지 {npayGradeBWithClickIdReview.timeGapMinutes}분이 걸려 자동 A급으로 올리지 않습니다.
            </p>
            <p>{npayGradeBWithClickIdReview.plainReason}</p>
            <em>{npayGradeBWithClickIdReview.nextAction}</em>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>B급 후보를 더 좁혀보는 표</strong>
            <p>
              이 표는 “구매는 맞아 보이지만 자동으로 Google Ads에 보내기에는 아직 부족한 주문”만 따로 모읍니다.
              백엔드가 B급 전용 목록을 내려주면 전체 B급을 보여주고, 아직 배포 전이면 현재 API가 노출하는 B급만 보여줍니다.
            </p>
            <em>
              현재 화면 표시 {formatCount(npayBridgeGradeBRows.length)}건 ·
              전체 B급 {formatCount(npayBridgeReview.summary.gradeB)}건 ·
              Google 흔적 있는 B급 {formatCount(npayBridgeGradeBRowsWithAnyGoogleEvidence.length)}건 ·
              A급 승격 가능 {formatCount(npayBridgeReview.summary.gradeBPromotableToGradeANow)}건
            </em>
          </div>

          {npayBridgeGradeBRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.bridgeReviewTable}`}>
                <thead>
                  <tr>
                    <th>B급 주문</th>
                    <th>왜 B급인가</th>
                    <th>Google click id</th>
                    <th>지금 결정</th>
                  </tr>
                </thead>
                <tbody>
                  {npayBridgeGradeBRows.map((row) => (
                    <tr key={`grade-b-${row.orderNumber}-${row.channelOrderNo}`}>
                      <td>
                        <strong>{formatKrw(row.orderAmount)} · {row.productName}</strong>
                        <span>내부 {maskIdentifier(row.orderNumber)} · NPay {maskIdentifier(row.channelOrderNo)}</span>
                      </td>
                      <td>
                        <strong>
                          결제까지 {row.timeGapMinutes}분 · score {row.score}
                          {row.scoreGap !== null ? ` · score gap ${row.scoreGap}` : ""}
                        </strong>
                        <span>{row.gradeAUpgradePlain ?? row.gradePlainReason ?? "A급 자동 반영 전 수동 검토가 필요합니다."}</span>
                      </td>
                      <td>
                        <strong>{row.hasGoogleClickId ? row.googleClickIdTypes.join("+") : "없음"}</strong>
                        <span>campaign {row.gadCampaignId ?? "없음"}</span>
                        <span>{row.googleClickIdEvidencePlain ?? "주문 또는 intent row에 직접 전송 가능한 click id가 확인되지 않았습니다."}</span>
                      </td>
                      <td>
                        <strong>Google Ads 전송 후보 아님</strong>
                        <span>{row.blockReasons.length ? row.blockReasons.join(", ") : "no-write/no-send 유지"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className={styles.signalFlowGrid}>
            {gradeBCurrentRead.map((item) => (
              <article key={item.label} className={styles.signalFlowCard}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.candidateGateGrid}>
            {noWriteReviewChecklist.map((item) => (
              <article key={item.label} className={styles.candidateGateCard}>
                <span>{item.label}</span>
                <strong>{item.pass}</strong>
                <p>{item.fail}</p>
              </article>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.bridgeReviewTable}`}>
              <thead>
                <tr>
                  <th>주문</th>
                  <th>결제/상품</th>
                  <th>내부 bridge 근거</th>
                  <th>Google click id</th>
                  <th>판단</th>
                </tr>
              </thead>
              <tbody>
                {npayBridgeReview.rows.map((row) => (
                  <tr key={`${row.orderNumber}-${row.channelOrderNo}`}>
                    <td>
                      <strong>내부 {maskIdentifier(row.orderNumber)}</strong>
                      <span>NPay {maskIdentifier(row.channelOrderNo)}</span>
                    </td>
                    <td>
                      <strong>{formatKrw(row.orderAmount)}</strong>
                      <span>{formatFetchedAt(row.paidAt)} · {row.productName}</span>
                    </td>
                    <td>
                      <strong>{bridgeDecisionLabel(row.internalBridgeDecision)}</strong>
                      <span>
                        {bridgeGradeLabel(row.strongGrade)} · score {row.score} ·
                        주문 생성 {row.orderCreateTimeBridge} · 결제까지 {row.timeGapMinutes}분
                      </span>
                      <span>{row.gradePlainReason ?? "내부 bridge 규칙으로 검토한 후보입니다."}</span>
                    </td>
                    <td>
                      <strong>{row.hasGoogleClickId ? row.googleClickIdTypes.join("+") : "Google click id 없음"}</strong>
                      <span>
                        campaign {row.gadCampaignId ?? "없음"}
                        {` · ${campaignIdEvidenceSourceLabel(row.campaignIdEvidenceSource)}`}
                        {row.utmCampaign ? ` · ${row.utmCampaign}` : ""}
                      </span>
                    </td>
                    <td>
                      <strong>{googleAdsSendDecisionLabel(row.googleAdsSendDecision)}</strong>
                      <span>{row.blockReasons.length ? row.blockReasons.join(", ") : "no-write 검토만 수행"}</span>
                      <span>{row.gradeAUpgradePlain ?? "추가 증거 없이 Google Ads로 보내지 않습니다."}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.section} ${styles.noSendSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>실제 결제완료 전용 Google 전환 통로는 no-send로 준비합니다</h2>
              <p>
                no-send 후보 생성기=Google Ads에 아직 보내지 않고, “나중에 보내도 되는 실제 구매 후보인지”만 따지는 안전한 준비 단계입니다.
                기존 `구매완료` Primary는 바로 건드리지 않고, 실제 결제완료 주문만 따로 세는 통로를 먼저 검증합니다.
              </p>
            </div>
            <span className={styles.metaText}>send 0 · write 0 · Primary 변경 0</span>
          </div>

          <div className={styles.noSendSummaryGrid}>
            <article>
              <span>후보 생성기 현재 결론</span>
              <strong>전송 후보 {formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건</strong>
              <p>
                NPay bridge 내부 후보는 {formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건이지만,
                Google Ads에 보낼 수 있는 실제 구매 후보는 아직 0건입니다.
              </p>
            </article>
            <article>
              <span>왜 Google Ads에 보내려 하는가</span>
              <strong>실제 매출을 학습시키기 위해</strong>
              <p>
                지금 Google Ads는 NPay count 성격의 `구매완료`를 크게 보고 있습니다.
                나중에는 실제 결제완료 주문만 Google에 알려줘야 자동입찰이 “돈을 낸 고객”을 학습합니다.
              </p>
            </article>
            <article>
              <span>왜 지금은 안 보내는가</span>
              <strong>click id와 영구 evidence 부족</strong>
              <p>
                주문마다 Google click id와 중복 방지 근거가 같이 있어야 합니다.
                현재는 내부 분석 후보와 Google Ads 전송 후보를 분리하는 단계입니다.
              </p>
            </article>
          </div>

          <div className={styles.privatePreviewPanel}>
            <div className={styles.privatePreviewHeader}>
              <div>
                <span>private preview · 원문값 비노출</span>
                <h3>Google Ads에 보내기 전, 서버 안에서만 원문값을 점검한 실제 구매 후보</h3>
                <p>
                  원문 주문번호와 원문 gclid는 화면에 나오지 않습니다.
                  대신 실제 결제완료인지, gclid가 서버 안에 있는지, 금액과 취소/환불 guard가 맞는지만 안전하게 보여줍니다.
                </p>
              </div>
              <em>
                {privatePreviewSource} · {formatFetchedAt(privatePreview.fetchedAt)}
                {privatePreviewNeedsLiveRefresh ? " · live API fallback" : ""}
              </em>
            </div>

            <div className={styles.privatePreviewSummary}>
              <article>
                <span>실제 구매 후보</span>
                <strong>{formatCount(privatePreview.summary.returnedCandidates)}건</strong>
                <p>
                  최근 7일 실제 결제완료 {formatCount(privatePreview.summary.sourceOrderRows)}건 중
                  서버 내부에서 원문 gclid까지 확인된 후보입니다.
                </p>
              </article>
              <article>
                <span>원문값 내부 확인</span>
                <strong>{formatCount(privatePreview.summary.privateRawValueChecksPassed)} / {formatCount(privatePreview.summary.returnedCandidates)}건</strong>
                <p>
                  원문 주문번호와 원문 gclid는 서버 내부에서만 확인하고, 화면에는 safe ref와 통과 여부만 표시합니다.
                </p>
              </article>
              <article>
                <span>Google Ads 전송</span>
                <strong>{formatCount(privatePreview.invariants.externalSendCount)}건</strong>
                <p>
                  send, upload, DB write는 모두 0건입니다. 이 카드는 전송 전 점검표입니다.
                </p>
              </article>
              <article>
                <span>주 전환 준비도</span>
                <strong>{formatCount(primaryReadiness)}%</strong>
                <p>{privatePreview.progress.plain}</p>
              </article>
            </div>

            <div className={styles.privateCandidateGrid}>
              {privatePreview.candidates.map((candidate) => (
                <article key={candidate.safeRef} className={styles.privateCandidateCard}>
                  <div className={styles.privateCandidateTop}>
                    <span>후보 {candidate.candidateRank}</span>
                    <strong>{candidate.safeRef}</strong>
                  </div>
                  <dl>
                    <div><dt>결제</dt><dd>{candidate.payment.paymentMethod} · {formatKrw(candidate.payment.amountKrw)}</dd></div>
                    <div><dt>완료일</dt><dd>{candidate.payment.paidDateKst}</dd></div>
                    <div><dt>click id</dt><dd>{candidate.evidence.exactClickIdType}</dd></div>
                    <div><dt>원문 노출</dt><dd>{candidate.evidence.rawClickIdExposed ? "위험" : "없음"}</dd></div>
                  </dl>
                  <div className={styles.privateCheckList}>
                    {(candidate.checks.length > 0 ? candidate.checks : [
                      {
                        key: "actual_purchase_guard" as const,
                        label: "실제 결제완료",
                        passed: candidate.payment.actualPurchaseGuardPassed,
                        publicSummary: "",
                        rawValueExposed: false as const,
                        blockerReason: null,
                      },
                      {
                        key: "exact_gclid" as const,
                        label: "원문 gclid 내부 확인",
                        passed: candidate.evidence.hasGclid,
                        publicSummary: "",
                        rawValueExposed: false as const,
                        blockerReason: null,
                      },
                      {
                        key: "send_approval" as const,
                        label: "전송 승인",
                        passed: false,
                        publicSummary: "",
                        rawValueExposed: false as const,
                        blockerReason: "google_ads_conversion_upload_not_approved",
                      },
                      {
                        key: "upload_ledger" as const,
                        label: "전송 장부",
                        passed: false,
                        publicSummary: "",
                        rawValueExposed: false as const,
                        blockerReason: "google_ads_upload_ledger_not_connected",
                      },
                    ]).map((check) => (
                      <span key={`${candidate.safeRef}-${check.key}`} className={check.passed ? styles.checkPass : styles.checkHold}>
                        {check.passed ? "통과" : "대기"} · {check.label || privatePreviewCheckLabel(check.key)}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.readinessPanel}>
              <div>
                <span>82%에서 100%까지 남은 것</span>
                <h3>후보는 생겼고, 이제 “한 번만 안전하게 보내는 장치”가 남았습니다</h3>
                <p>
                  82%는 원문값 확인 장치까지 준비됐다는 뜻입니다.
                  100%는 Google Ads 전송 전 중복 방지 장부, 제한 전송 승인안, 전송 후 검증 기준까지 준비된 상태입니다.
                </p>
              </div>
              <div className={styles.readinessStepGrid}>
                {primaryConversionReadinessSteps.map((step) => (
                  <article key={step.label} className={styles.readinessStepCard}>
                    <span className={readinessStepStatusClass(step.status)}>
                      {readinessStepStatusLabel(step.status)}
                    </span>
                    <strong>{step.label}</strong>
                    <p>{step.plain}</p>
                    <div className={styles.progressTrack} aria-label={`${step.label} ${step.progress}%`}>
                      <div
                        className={`${styles.progressFill} ${step.progress < 100 ? styles.progressFillWarn : ""}`}
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>{confirmedOnlyNoSendLatest.generatedAtKst} no-send 재계산 결과</strong>
            <p>{confirmedOnlyNoSendLatest.decision}</p>
            <em>{confirmedOnlyNoSendLatest.source}</em>
          </div>

          <div className={styles.bridgeExplainBox}>
            <strong>실제 결제완료 후보 3건을 더 좁힌 결론</strong>
            <p>{readyButNotSentReview.summary}</p>
            <em>
              직접 증거 후보 {formatCount(readyButNotSentReview.totalDirectEvidence)}건 ·
              ready_but_not_sent 검토표 row {formatCount(readyButNotSentReview.reviewRows)}건 ·
              실제 전송 대기 {formatCount(readyButNotSentReview.sendReadyButNotSent)}건 ·
              Google Ads 전송 후보 {formatCount(readyButNotSentReview.googleAdsSendCandidates)}건 ·
              기준 {readyButNotSentReview.checkedAtKst}
            </em>
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.readyReviewTable}`}>
              <thead>
                <tr>
                  <th>후보 주문</th>
                  <th>실제 결제 확인</th>
                  <th>광고 클릭 증거</th>
                  <th>현재 판단</th>
                  <th>왜 아직 안 보내나</th>
                </tr>
              </thead>
              <tbody>
                {readyButNotSentReview.rows.map((row) => (
                  <tr key={row.maskedOrder}>
                    <td>
                      <strong>{row.maskedOrder}</strong>
                      <span>{row.paymentMethod} · {formatKrw(row.amountKrw)}</span>
                    </td>
                    <td>
                      <strong>{row.purchaseCheck}</strong>
                      <span>미입금/버튼 클릭/결제 시작 신호가 아니라 실제 결제완료 주문입니다.</span>
                    </td>
                    <td>
                      <strong>{row.clickEvidence}</strong>
                      <span>raw click id는 화면에 표시하지 않습니다.</span>
                    </td>
                    <td>
                      <strong>{row.decision}</strong>
                      <span>Google Ads send 0 · write 0</span>
                    </td>
                    <td>
                      <strong>전송 대기 아님</strong>
                      <span>{row.whyNotReady}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.noSendStepGrid}>
            {readyButNotSentReview.blockers.map((blocker, index) => (
              <article key={blocker} className={styles.noSendStepCard}>
                <span>차단 {index + 1}</span>
                <strong>{blocker}</strong>
                <p>이 조건이 닫히기 전에는 실제 결제완료 주문이어도 Google Ads로 보내지 않습니다.</p>
              </article>
            ))}
          </div>

          <div className={styles.noSendStepGrid}>
            {confirmedOnlyNoSendLatest.windows.map((item) => (
              <article key={item.label} className={styles.noSendStepCard}>
                <span>{item.label}</span>
                <strong>{formatRatePct(item.preservationRate)}</strong>
                <p>
                  실제 결제완료 {formatCount(item.orders)}건 중 Google click id 직접 보존은
                  {" "}{formatCount(item.directClickEvidence)}건입니다. 전송 후보는 {formatCount(item.sendCandidate)}건입니다.
                </p>
                <em>{item.mainBlock}</em>
                <small>
                  미보존 {formatCount(item.missingClickId)}건
                  {item.revenueKrw === null ? "" : ` · 매출 ${formatKrw(item.revenueKrw)}`}
                </small>
              </article>
            ))}
          </div>

          <div className={styles.noSendStepGrid}>
            {noSendCandidateGuardrails.map((item, index) => (
              <article key={item.step} className={styles.noSendStepCard}>
                <span>{index + 1}</span>
                <strong>{item.step}</strong>
                <p>{item.plain}</p>
              </article>
            ))}
          </div>

          <p className={styles.postPatchDecision}>
            바로잡는 순서: 기존 Primary를 급하게 끄거나 바꾸기보다,
            먼저 실제 결제완료 전용 후보 생성기를 no-send로 안정화하고,
            후보가 충분히 생긴 뒤 Google Ads 전환 설정 변경과 upload 여부를 별도 승인안으로 엽니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.clickHealthSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google click id 보존률</h2>
              <p>실제 결제완료 주문에 gclid, gbraid, wbraid 중 하나가 남아야 Google Ads에 안전하게 다시 연결할 수 있습니다.</p>
            </div>
            <span className={styles.metaText}>
              source: {last30.clickIdHealth.source} · 기준 {formatFetchedAt(last30.clickIdHealth.generatedAt)}
            </span>
          </div>
          <div className={styles.clickBaselineBanner}>
            <div>
              <span>click id 알고리즘 업데이트 기준일</span>
              <strong>{postPatchClickIdHealth.patchStartedAtKst}</strong>
              <p>
                이 시각에 아임웹 헤더/푸터의 Google click id 보존 로직을 교체했습니다.
                최근 7일/30일 숫자는 보강 전 주문이 섞이므로, 개선 여부는 이 기준일 이후 주문만 따로 봐야 합니다.
              </p>
            </div>
            <div>
              <span>보강 이후 실제 결제완료 주문</span>
              <strong>{formatRatePct(postPatchClickIdHealth.orderStage.preservationRate)}</strong>
              <p>
                {formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)} / {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건만
                Google click id가 직접 남았습니다. upload 후보는 {formatCount(postPatchClickIdHealth.orderStage.uploadCandidateCount)}건입니다.
              </p>
            </div>
            <div>
              <span>{analysisAlgorithmV2Baseline.label}</span>
              <strong>{analysisV2Health.baselines.analysisAlgorithmV2Kst}</strong>
              <p>
                {analysisAlgorithmV2Baseline.meaning}
                현재 판단은 “{analysisV2Health.stageSummary.likelyLossPoint}”입니다.
              </p>
            </div>
          </div>
          <article className={styles.dropoffHealthCard}>
            <div className={styles.postPatchHeader}>
              <div>
                <span>live API 단계 분해</span>
                <h3>click id가 어느 지점에서 사라지는지 나눠 봅니다</h3>
                <p>
                  같은 0%라도 원인이 다릅니다. 광고 클릭 직후부터 없는지, 결제 화면까지는 있다가 결제완료 주문에서 끊기는지,
                  NPay 외부 결제라 내부 bridge가 필요한지를 단계별로 분리합니다.
                </p>
              </div>
              <em>{formatFetchedAt(analysisV2Health.generatedAt)} · {analysisV2Health.source}</em>
            </div>
            <div className={styles.dropoffSummaryBox}>
              <strong>{analysisV2Health.conclusion.plain}</strong>
              <p>{analysisV2Health.conclusion.nextAction}</p>
              <em>
                write {analysisV2Health.invariants.operationalDbWrite}건 · VM write {analysisV2Health.invariants.vmCloudWrite}건 ·
                Google Ads send {analysisV2Health.invariants.externalSendCount}건
              </em>
            </div>
            <div className={styles.analysisSinceBox}>
              <strong>2026-05-25 06:30 KST 이후 숫자만 따로 본 결과</strong>
              <p>
                광고 클릭 저장은 계속 잘 됩니다. 클릭 의도 저장 단계는
                {" "}{formatCount(analysisV2Health.stages.paidClickIntent.googleClickIdRows)} / {formatCount(analysisV2Health.stages.paidClickIntent.rows)}건이 click id를 갖고 있고,
                campaign id도 {formatCount(analysisV2Health.stages.paidClickIntent.gadCampaignIdRows)}건 남았습니다.
                반면 실제 결제완료 주문 직접 보존은
                {" "}{formatCount(analysisV2Health.stages.paymentSuccessConfirmedDirect.googleClickIdRows)} / {formatCount(analysisV2Health.stages.paymentSuccessConfirmedDirect.rows)}건입니다.
              </p>
              <p>
                따라서 지금 추가 테스트 클릭이 급한 상태는 아닙니다. 클릭 수집은 통과했고,
                남은 병목은 NPay 외부 결제완료를 내부 주문과 안전하게 이어 붙이는 bridge 검토입니다.
              </p>
            </div>
            <div className={styles.dropoffGrid}>
              {clickIdDropoffStages.map((stage) => (
                <div key={stage.key} className={styles.dropoffStageCard}>
                  <span>{stage.label}</span>
                  <strong className={stage.coverageRate === null || stage.coverageRate < 0.1 ? styles.danger : styles.good}>
                    {stage.coverageRate === null ? "판단 전" : formatRatePct(stage.coverageRate)}
                  </strong>
                  <p>{stage.plainMeaning}</p>
                  <dl>
                    <div><dt>row</dt><dd>{formatCount(stage.rows)}</dd></div>
                    <div><dt>click id</dt><dd>{formatCount(stage.googleClickIdRows)}</dd></div>
                    <div><dt>campaign id</dt><dd>{formatCount(stage.gadCampaignIdRows)}</dd></div>
                    <div><dt>latest</dt><dd>{formatFetchedAt(stage.latestAt ?? undefined)}</dd></div>
                  </dl>
                </div>
              ))}
              <div className={styles.dropoffStageCard}>
                <span>{analysisV2Health.stages.npayIntentExact.label}</span>
                <strong className={analysisV2Health.stages.npayIntentExact.matchedOrderGoogleClickIdRows > 0 ? styles.warn : styles.danger}>
                  {formatCount(analysisV2Health.stages.npayIntentExact.matchedOrderGoogleClickIdRows)}건
                </strong>
                <p>{analysisV2Health.stages.npayIntentExact.plainMeaning}</p>
                <dl>
                  <div><dt>전체 intent</dt><dd>{formatCount(analysisV2Health.stages.npayIntentExact.rows)}</dd></div>
                  <div><dt>주문 연결</dt><dd>{formatCount(analysisV2Health.stages.npayIntentExact.matchedOrderRows)}</dd></div>
                  <div><dt>click id 포함</dt><dd>{formatCount(analysisV2Health.stages.npayIntentExact.matchedOrderGoogleClickIdRows)}</dd></div>
                  <div><dt>send 후보</dt><dd>{formatCount(analysisV2Health.invariants.sendCandidateCount)}</dd></div>
                </dl>
              </div>
            </div>

            <div className={styles.dropoffCompareGrid}>
              {analysisV2Health.stageComparisons.map((comparison) => (
                <article key={`${comparison.fromKey}-${comparison.toKey}`} className={styles.dropoffCompareCard}>
                  <span>{comparison.fromLabel} → {comparison.toLabel}</span>
                  <strong className={comparison.toGoogleClickIdRows === 0 && comparison.fromGoogleClickIdRows > 0 ? styles.danger : styles.good}>
                    {comparison.comparisonRate === null ? "판단 전" : formatRatePct(comparison.comparisonRate)}
                  </strong>
                  <p>{comparison.interpretation}</p>
                  <dl>
                    <div><dt>앞 단계 click id</dt><dd>{formatCount(comparison.fromGoogleClickIdRows)}</dd></div>
                    <div><dt>다음 단계 click id</dt><dd>{formatCount(comparison.toGoogleClickIdRows)}</dd></div>
                    <div><dt>겉보기 감소</dt><dd>{formatCount(comparison.apparentLostClickIdRows)}</dd></div>
                  </dl>
                  <em>{comparison.nextProbe}</em>
                </article>
              ))}
            </div>

            <div className={styles.orderEvidenceBox}>
              <div>
                <span>주문 연결 근거</span>
                <strong>{analysisV2Health.orderEvidenceBreakdown.interpretation}</strong>
                <p>
                  실제 결제완료 주문 {formatCount(analysisV2Health.orderEvidenceBreakdown.orderCount)}건 중
                  Google click id가 직접 연결된 주문은 {formatCount(analysisV2Health.orderEvidenceBreakdown.withGoogleClickId)}건입니다.
                </p>
              </div>
              <dl>
                <div><dt>결제완료 ledger 근거</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.paymentSuccessLedgerRows)}</dd></div>
                <div><dt>NPay intent 근거</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.npayIntentRows)}</dd></div>
                <div><dt>둘 다 있음</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.bothRows)}</dd></div>
                <div><dt>근거 없음</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.noneRows)}</dd></div>
                <div><dt>ledger에서 click id</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.clickIdFromPaymentSuccessLedgerRows)}</dd></div>
                <div><dt>NPay에서 click id</dt><dd>{formatCount(analysisV2Health.orderEvidenceBreakdown.clickIdFromNpayIntentRows)}</dd></div>
              </dl>
            </div>

            {analysisV2Health.paymentSuccessStatusBreakdown.length > 0 && (
              <div className={styles.paymentStatusGrid}>
                {analysisV2Health.paymentSuccessStatusBreakdown.map((row) => (
                  <article key={row.paymentStatus} className={styles.paymentStatusCard}>
                    <span>{row.paymentStatus}</span>
                    <strong className={row.googleClickIdRows > 0 ? styles.good : styles.danger}>
                      {formatRatePct(row.coverageRate)}
                    </strong>
                    <p>
                      결제완료 신호 {formatCount(row.rows)}건 중 Google click id {formatCount(row.googleClickIdRows)}건,
                      campaign id {formatCount(row.gadCampaignIdRows)}건입니다.
                    </p>
                    <em>{formatFetchedAt(row.latestAt ?? undefined)}</em>
                  </article>
                ))}
              </div>
            )}
          </article>
          <div className={styles.healthGrid}>
            {clickIdHealthCards.map((item) => (
              <article key={item.label} className={styles.healthCard}>
                <div className={styles.healthTop}>
                  <div>
                    <span className={styles.healthLabel}>{item.label}</span>
                    <strong className={item.clickIdHealth.preservationRate < 0.1 ? styles.danger : styles.good}>
                      {formatRatePct(item.clickIdHealth.preservationRate)}
                    </strong>
                  </div>
                  <span className={`${styles.status} ${item.clickIdHealth.uploadCandidateCount === 0 ? styles.statusHold : styles.statusWarn}`}>
                    upload 후보 {item.clickIdHealth.uploadCandidateCount}건
                  </span>
                </div>
                <p className={styles.healthSummary}>
                  결제완료 {formatCount(item.clickIdHealth.orderCount)}건 중 Google click id 보존 {formatCount(item.clickIdHealth.withGoogleClickId)}건,
                  미보존 {formatCount(item.clickIdHealth.missingGoogleClickId)}건입니다.
                </p>
                <div className={styles.healthStats}>
                  <div>
                    <span>gclid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.gclid)}</strong>
                  </div>
                  <div>
                    <span>gbraid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.gbraid)}</strong>
                  </div>
                  <div>
                    <span>wbraid</span>
                    <strong>{formatCount(item.clickIdHealth.clickIdBreakdown.wbraid)}</strong>
                  </div>
                  <div>
                    <span>VM evidence 없음</span>
                    <strong>{formatCount(item.clickIdHealth.blockReasonCounts.missingAttributionVmEvidence)}</strong>
                  </div>
                </div>
                <div className={styles.methodRows}>
                  {item.clickIdHealth.paymentMethodBreakdown.map((row) => (
                    <div key={`${item.label}-${row.paymentMethod}`} className={styles.methodRow}>
                      <span>{paymentMethodLabel(row.paymentMethod)}</span>
                      <strong>{formatRatePct(row.preservationRate)}</strong>
                      <em>{formatCount(row.withGoogleClickId)} / {formatCount(row.orders)}건</em>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <article className={styles.postPatchHealthCard}>
            <div className={styles.postPatchHeader}>
              <div>
                <span>별도 기준점 재계산</span>
                <h3>5월 21일 밤 아임웹 헤더/푸터 보강 이후</h3>
                <p>
                  기준점은 {postPatchClickIdHealth.patchStartedAtKst}입니다. 최근 7일 카드는 보강 전/후가 섞이므로,
                  여기서는 보강 이후 결제완료 주문만 따로 잘라 click id 보존률을 봅니다.
                </p>
              </div>
              <em>{postPatchClickIdHealth.checkedAtKst} · {postPatchClickIdHealth.source}</em>
            </div>

            <div className={styles.postPatchGrid}>
              <div className={styles.postPatchMetric}>
                <span>직접 보존률</span>
                <strong className={styles.danger}>{formatRatePct(postPatchClickIdHealth.orderStage.preservationRate)}</strong>
                <p>
                  confirmed 결제완료 신호 {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건 중 gclid/gbraid/wbraid가 직접 남은 건은
                  {" "}{formatCount(postPatchClickIdHealth.orderStage.withGoogleClickId)}건입니다.
                </p>
              </div>
              <div className={styles.postPatchMetric}>
                <span>진단용 세션 bridge</span>
                <strong className={styles.warn}>{formatCount(postPatchClickIdHealth.orderStage.priorSameGaSessionRows)}건</strong>
                <p>
                  같은 GA 세션에서 결제 직전 gclid가 보인 후보입니다.
                  client id까지 일치한 후보는 {formatCount(postPatchClickIdHealth.orderStage.strictSameSessionAndClientRows)}건이라 upload 후보는 아닙니다.
                </p>
              </div>
              <div className={styles.postPatchMetric}>
                <span>Google Ads upload 후보</span>
                <strong className={styles.danger}>{formatCount(postPatchClickIdHealth.orderStage.uploadCandidateCount)}건</strong>
                <p>
                  same-session, same-client, time-window 후보는 Google Ads에 보내지 않습니다.
                  직접 click id가 있는 confirmed 주문만 후보로 올립니다.
                </p>
              </div>
            </div>

            <div className={styles.postPatchDetailGrid}>
              {[
                postPatchClickIdHealth.clickStage.siteLanding,
                postPatchClickIdHealth.clickStage.paidClickIntent,
              ].map((stage) => (
                <div key={stage.label}>
                  <strong>{stage.label}</strong>
                  <p>{stage.why}</p>
                  <dl>
                    <div><dt>gclid</dt><dd>{formatCount(stage.gclidRows)}</dd></div>
                    <div><dt>gbraid</dt><dd>{formatCount(stage.gbraidRows)}</dd></div>
                    <div><dt>wbraid</dt><dd>{formatCount(stage.wbraidRows)}</dd></div>
                    <div><dt>gad_source</dt><dd>{formatCount(stage.gadSourceRows)}</dd></div>
                  </dl>
                </div>
              ))}
              <div>
                <strong>{postPatchClickIdHealth.clickStage.attributionLedger.label}</strong>
                <p>{postPatchClickIdHealth.clickStage.attributionLedger.why}</p>
                <dl>
                  <div><dt>click 증거</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.googleClickIdEvidenceRows)}</dd></div>
                  <div><dt>campaign ID</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.gadCampaignIdRows)}</dd></div>
                  <div><dt>결제완료</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.confirmedPaymentSuccessRows)}</dd></div>
                  <div><dt>주문+campaign</dt><dd>{formatCount(postPatchClickIdHealth.clickStage.attributionLedger.confirmedRowsWithGadCampaignId)}</dd></div>
                </dl>
              </div>
            </div>

            <div className={styles.postPatchOrderRows}>
              <div>
                <span>클릭 URL 파라미터</span>
                <strong>{formatRatePct(postPatchClickIdHealth.clickStage.siteLanding.coverageRate)}</strong>
                <em>
                  고객 유입 장부 {formatCount(postPatchClickIdHealth.clickStage.siteLanding.googleClickIdRows)}건 중
                  campaign id {formatCount(postPatchClickIdHealth.clickStage.siteLanding.gadCampaignIdRows)}건
                </em>
              </div>
              <div>
                <span>태그 저장 파라미터</span>
                <strong>{formatRatePct(postPatchClickIdHealth.clickStage.paidClickIntent.coverageRate)}</strong>
                <em>
                  유료 클릭 의도 장부 {formatCount(postPatchClickIdHealth.clickStage.paidClickIntent.googleClickIdRows)}건 중
                  campaign id {formatCount(postPatchClickIdHealth.clickStage.paidClickIntent.gadCampaignIdRows)}건
                </em>
              </div>
              <div>
                <span>결제 후 click 오인 방지</span>
                <strong>{formatCount(postPatchClickIdHealth.orderStage.invalidAfterSameClientRows)}건 제외</strong>
                <em>결제 이후 click은 confirmed 주문 근거로 쓰지 않습니다.</em>
              </div>
              {postPatchClickIdHealth.orderStage.paymentMethodBreakdown.map((row) => (
                <div key={`post-patch-${row.paymentMethod}`}>
                  <span>{paymentMethodLabel(row.paymentMethod)}</span>
                  <strong>{formatRatePct(row.preservationRate)}</strong>
                  <em>{formatCount(row.withGoogleClickId)} / {formatCount(row.orders)}건</em>
                </div>
              ))}
              <div>
                <span>VM evidence 없음</span>
                <strong>{formatCount(postPatchClickIdHealth.orderStage.evidenceCounts.missingAttributionVmEvidence)}건</strong>
                <em>confirmed 결제완료 {formatCount(postPatchClickIdHealth.orderStage.orderCount)}건 중 결제완료 ledger/intent exact 증거가 없는 주문</em>
              </div>
            </div>

            <div className={styles.evidenceGradeGrid}>
              {postPatchClickIdHealth.evidenceGrades.map((grade) => (
                <div key={grade.grade} className={styles.evidenceGradeCard}>
                  <span>{grade.grade}등급 · {grade.label}</span>
                  <strong>{formatCount(grade.count)}건</strong>
                  <p>{grade.description}</p>
                  <em>Google Ads upload: {grade.upload}</em>
                </div>
              ))}
            </div>

            <p className={styles.postPatchDecision}>{postPatchClickIdHealth.decision}</p>
          </article>
          <p className={styles.healthNote}>
            보존률이 10% 미만이면 Google Ads upload를 열기보다 landing, checkout, payment_success 사이에서 click id가 사라지는 지점을 먼저 고치는 것이 맞습니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.campaignMatchSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google 캠페인 ID 매칭률</h2>
              <p>
                gad_campaignid는 Google 광고가 붙여주는 캠페인 번호입니다. UTM이 없어도 이 번호와 click id가 함께 남으면 내부 ROAS를 캠페인 단위로 더 정확히 나눌 수 있습니다.
                이 화면은 ROAS 산정 헬스와 GTM 태그 진단 헬스를 분리해서 봅니다.
              </p>
            </div>
            <span className={styles.metaText}>
              기준 후보일: {last30.googleCampaignMatchHealth.baseline.candidateStartedAtKst} · upload 후보 {last30.googleCampaignMatchHealth.summary.uploadCandidateCount}건
            </span>
          </div>
          <div className={styles.healthStandardGrid}>
            {campaignHealthSplitCards(last7.googleCampaignMatchHealth).map((card) => (
              <article key={card.key} className={styles.healthStandardCard}>
                <div className={styles.healthTop}>
                  <div>
                    <span className={styles.healthLabel}>{card.subtitle}</span>
                    <strong>{card.title}</strong>
                  </div>
                  <span className={roleStatusClass(card.status)}>{roleStatusLabel(card.status)}</span>
                </div>
                <p>{card.interpretation}</p>
                <div className={styles.healthStats}>
                  <div>
                    <span>{card.primaryLabel}</span>
                    <strong>{formatCount(card.primary)}</strong>
                  </div>
                  <div>
                    <span>{card.secondaryLabel}</span>
                    <strong>{formatCount(card.secondary)}</strong>
                  </div>
                  <div>
                    <span>매칭률</span>
                    <strong>{formatRatePct(card.rate)}</strong>
                  </div>
                </div>
                <em>source: {card.source} · latest {formatFetchedAt(card.latestAt ?? undefined)}</em>
              </article>
            ))}
          </div>
          <div className={styles.probeNote}>
            <strong>2026-05-21 실클릭 canary 해석</strong>
            <span>
              주문 202605214186402는 고객 유입 원장과 주문 원장에 gclid, gbraid, gad_campaignid가 남았습니다.
              반면 paid-click-intent exact row는 누락되어 이 원장은 ROAS 정본이 아니라 태그 진단 대상으로 분리합니다.
            </span>
          </div>
          <div className={styles.campaignMatchGrid}>
            {[last7, last30].map((item) => {
              const health = item.googleCampaignMatchHealth;
              return (
                <article key={`${item.label}-campaign-match`} className={styles.campaignMatchCard}>
                  <div className={styles.healthTop}>
                    <div>
                      <span className={styles.healthLabel}>{item.label}</span>
                      <strong className={health.baseline.effectiveForRoasRecalculation ? styles.good : styles.warn}>
                        {formatRatePct(health.siteLanding.currentCampaignIdCoverageRate)}
                      </strong>
                    </div>
                    <span className={campaignMatchStatusClass(health.summary.status)}>
                      {campaignMatchStatusLabel(health.summary.status)}
                    </span>
                  </div>
                  <p className={styles.healthSummary}>{health.summary.interpretation}</p>
                  <div className={styles.healthStats}>
                    <div>
                      <span>유입 click id</span>
                      <strong>{formatCount(health.siteLanding.googleClickIdRows)}</strong>
                    </div>
                    <div>
                      <span>캠페인 ID 보존</span>
                      <strong>{formatCount(health.siteLanding.gadCampaignIdRows)}</strong>
                    </div>
                    <div>
                      <span>미맵핑 후보</span>
                      <strong>{formatCount(health.summary.unmappedRows)}</strong>
                    </div>
                    <div>
                      <span>보강 후 잠재</span>
                      <strong>{formatRatePct(health.siteLanding.potentialCoverageRateAfterAllowlist)}</strong>
                    </div>
                  </div>
                  <div className={styles.baselineBox}>
                    <strong>{health.baseline.effectiveForRoasRecalculation ? "ROAS 재계산 기준점 사용 가능" : "ROAS 재계산 기준 후보"}</strong>
                    <p>{health.baseline.policy}</p>
                    <em>effective from: {health.baseline.effectiveFromKst ?? "신규 row 확인 전"}</em>
                  </div>
                </article>
              );
            })}
          </div>
          <div className={styles.campaignTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>캠페인 ID</th>
                  <th>매칭율%</th>
                  <th>근거</th>
                  <th>원장 rows</th>
                  <th>결제완료 rows</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {(last7.googleCampaignMatchHealth.topCampaignIds.length > 0
                  ? last7.googleCampaignMatchHealth.topCampaignIds
                  : [
                      {
                        campaignId: "미맵핑",
                        campaignName: "gad_campaignid 미보존 click id 묶음",
                        rows: last7.googleCampaignMatchHealth.summary.unmappedRows,
                        confirmedRows: 0,
                        matchedToDashboardCampaign: false,
                      },
                    ]).map((row) => (
                    <tr key={row.campaignId}>
                      <td>
                        <strong>{row.campaignName ?? row.campaignId}</strong>
                        <span>{row.campaignId}</span>
                      </td>
                      <td>
                        <strong>{row.matchedToDashboardCampaign ? `${last7.googleCampaignMatchHealth.confidenceThresholds.gadCampaignIdWithClickIdPct}%+` : "0~70%"}</strong>
                      </td>
                      <td>{row.matchedToDashboardCampaign ? "gad_campaignid + Google Ads campaign 목록" : "캠페인 ID 보존/Google Ads 목록 확인 필요"}</td>
                      <td>{formatCount(row.rows)}</td>
                      <td>{formatCount(row.confirmedRows)}</td>
                      <td>
                        <span className={row.matchedToDashboardCampaign ? styles.good : styles.warn}>
                          {row.matchedToDashboardCampaign ? "내부 ROAS 보조 사용" : "미맵핑/진단"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className={styles.healthNote}>
            오늘 작업일은 기준점 후보로만 기록합니다. 배포 후 신규 Google 클릭에서 gad_campaignid가 보존되는 것이 확인되면 그 시점부터 캠페인별 ROAS 재계산 기준으로 승격합니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.campaignEvidenceSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>캠페인별 Google 주장 ROAS와 내부 주문 연결</h2>
              <p>
                같은 캠페인이라도 Google Ads가 “구매”라고 세는 금액과, 우리 내부에서 실제 주문으로 연결된 금액은 다를 수 있습니다.
                이 표는 두 숫자를 한 row에 놓되, 서로 다른 기준이라는 점을 분리해서 보여줍니다.
              </p>
            </div>
            <span className={styles.metaText}>
              최근 7일 · Google Ads API + 내부 attribution + NPay no-write bridge
            </span>
          </div>

          <div className={styles.campaignEvidenceSummary}>
            <article>
              <span>Google Ads 주장 전환값</span>
              <strong>{formatKrw(last7.platformValue)}</strong>
              <p>Google Ads가 구매로 세고 있는 캠페인별 합계입니다. 예산 판단 참고값이지 내부 확정 매출이 아닙니다.</p>
            </article>
            <article>
              <span>내부 직접 연결 주문</span>
              <strong>{formatCount(last7Response?.internal?.summary.matchedCampaignOrders ?? 0)}건</strong>
              <p>주문 원장에 campaign id가 직접 붙어 캠페인과 연결된 주문입니다.</p>
            </article>
            <article>
              <span>NPay 내부 bridge 후보</span>
              <strong>{formatCount(npayBridgeReview.summary.internalBridgeExactCandidates)}건</strong>
              <p>아직 원장에 쓰지 않은 no-write 후보입니다. Google Ads 전송 후보는 {formatCount(npayBridgeReview.summary.googleAdsSendCandidates)}건입니다.</p>
            </article>
          </div>

          <div className={styles.campaignTableWrap}>
            <table className={`${styles.table} ${styles.campaignEvidenceTable}`}>
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>Google Ads 주장값</th>
                  <th>내부 직접 연결</th>
                  <th>NPay bridge 후보</th>
                  <th>판단</th>
                </tr>
              </thead>
              <tbody>
                {campaignRoasRows.map((row) => {
                  const internalOrders = row.internal?.orders ?? 0;
                  const confirmedOrders = row.internal?.confirmedOrders ?? 0;
                  const confirmedRevenue = row.internal?.confirmedRevenue ?? 0;
                  const bridgeCandidates = row.bridge?.internalBridgeCandidates ?? 0;
                  const bridgeWithClickId = row.bridge?.bridgeCandidatesWithGoogleClickId ?? 0;
                  const hasGoogleClaim = row.googleConversionValue > 0 || row.googleConversions > 0;
                  const hasInternalOrder = confirmedOrders > 0 || bridgeCandidates > 0;
                  return (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.campaignName}</strong>
                        <span>{row.campaignId ?? "campaign id 없음"}</span>
                      </td>
                      <td>
                        <strong>{formatRoas(row.googleRoas)}</strong>
                        <span>
                          전환값 {formatKrw(row.googleConversionValue)} ·
                          구매 수 {formatCount(row.googleConversions)}
                        </span>
                      </td>
                      <td>
                        <strong>{formatCount(confirmedOrders)}건 / {formatKrw(confirmedRevenue)}</strong>
                        <span>
                          전체 연결 {formatCount(internalOrders)}건 ·
                          {matchStatusLabel(row.internal?.matchStatus ?? (hasGoogleClaim ? "platform_only" : "internal_only"))}
                        </span>
                      </td>
                      <td>
                        <strong>{formatCount(bridgeCandidates)}건</strong>
                        <span>
                          Google click id 포함 {formatCount(bridgeWithClickId)}건 ·
                          전송 후보 {formatCount(row.bridge?.googleAdsSendCandidates ?? 0)}건
                        </span>
                      </td>
                      <td>
                        <strong className={hasInternalOrder ? styles.warn : styles.danger}>
                          {hasInternalOrder ? "내부 연결 근거 확인" : "Google 주장값만 있음"}
                        </strong>
                        <span>
                          {hasGoogleClaim && !hasInternalOrder
                            ? "Google Ads는 구매를 세지만 내부 주문 연결은 아직 없습니다."
                            : hasInternalOrder
                              ? "예산 판단에는 내부 직접 연결과 bridge 후보를 따로 봅니다."
                              : "현재 기간에 판단할 주문 근거가 없습니다."}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.healthNote}>
            중요한 해석: NPay bridge 후보는 내부 분석에는 쓸 수 있지만 Google Ads에 보내는 구매 신호가 아닙니다.
            전송 후보가 0건이면 Google Ads upload는 열지 않고, 내부 연결 기준을 더 보강하는 것이 맞습니다.
          </p>
        </section>

        <section className={`${styles.section} ${styles.campaignEvidenceSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Last-click 보조 관점</h2>
              <p>
                Last-click은 마지막으로 누른 Google 광고 하나에 구매를 붙여 보는 쉬운 해석 방식입니다.
                Google Ads 설정은 데이터 기반 기여 분석으로 그대로 두고, 이 카드는 사람이 대기 주문을 읽기 쉽게 보는 보조 화면입니다.
              </p>
            </div>
            <span className={styles.metaText}>
              {googleAdsLastClickAssist.source} · 기준 {googleAdsLastClickAssist.checkedAtKst}
            </span>
          </div>

          <div className={styles.campaignEvidenceSummary}>
            {googleAdsLastClickAssist.cards.map((card) => (
              <article key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.plain}</p>
              </article>
            ))}
          </div>

          <div className={styles.truthEvidenceBox}>
            <strong>결정: Google Ads 기여 분석 모델은 last-click으로 바꾸지 않습니다</strong>
            <p>{googleAdsLastClickAssist.decision}</p>
            <p>
              현재 확인된 합계는 클릭 날짜 기준과 결제 날짜 기준 모두
              {" "}{formatKrw(googleAdsLastClickAssist.observed.valueKrw)}입니다.
              다만 데이터 기반 기여 분석은 일부 주문 금액을 여러 클릭 날짜로 나눌 수 있으므로,
              “어느 날 주문이 생겼나”를 볼 때는 결제 날짜 기준도 같이 확인합니다.
            </p>
            <em>
              예측: 대기 {formatCount(googleAdsLastClickAssist.pendingRepeated245.rows)}건은
              {" "}{googleAdsLastClickAssist.pendingRepeated245.firstLikelyWindowKst}부터 일부 보일 가능성이 있고,
              대부분은 {googleAdsLastClickAssist.pendingRepeated245.mostLikelyWindowKst}까지 확인될 가능성이 큽니다.
              {googleAdsLastClickAssist.pendingRepeated245.investigateAfterKst} 이후에도 안 보이면 지연이 아니라 원인 점검 대상으로 봅니다.
            </em>
          </div>

          <div className={styles.signalFlowGrid}>
            {googleAdsLastClickAssist.conditions.map((condition) => (
              <article key={condition.label} className={styles.signalFlowCard}>
                <span>반영 조건</span>
                <strong>{condition.label}</strong>
                <p>{condition.plain}</p>
              </article>
            ))}
          </div>

          <p className={styles.healthNote}>
            이 예측은 Google Ads 설정을 바꾸는 판단이 아닙니다. 이미 전송된 row가 Google Ads 리포트에 언제 보일지
            과거 반영 속도와 현재 대기 row의 전송 시각을 기준으로 나눈 read-only 시뮬레이션입니다.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>KR과 연결 액션플랜</h2>
              <p>KR은 Key Result, 즉 이번 프로젝트가 실제로 성공했다고 말할 수 있는 측정 결과입니다. 현재%는 문서 기준 진행률과 화면 구현 상태를 함께 반영했습니다.</p>
            </div>
            <span className={styles.metaText}>plan source: gdn/!gdnplan_new + 2026-05-23 exact evidence guard, 화면 갱신: {formatFetchedAt(last30.fetchedAt)}</span>
          </div>
          <div className={styles.krGrid}>
            {keyResults.map((item) => (
              <article key={item.id} className={styles.krCard}>
                <div className={styles.krTop}>
                  <span className={`${styles.status} ${item.tone === "warn" ? styles.statusWarn : item.tone === "hold" ? styles.statusHold : ""}`}>
                    {item.id} · {item.status}
                  </span>
                  <span className={styles.krOwner}>{item.owner}</span>
                </div>
                <h3>{item.title}</h3>
                <div className={styles.krMetricRow}>
                  <div>
                    <span>현재</span>
                    <strong>{item.currentPct}%</strong>
                  </div>
                  <div>
                    <span>목표</span>
                    <strong>{item.targetPct}%</strong>
                  </div>
                </div>
                <div className={styles.progressTrack} aria-label={`${item.id} current progress`}>
                  <div className={`${styles.progressFill} ${item.tone === "warn" ? styles.progressFillWarn : item.tone === "hold" ? styles.progressFillHold : ""}`} style={{ width: `${Math.min(100, item.currentPct)}%` }} />
                </div>
                <div className={styles.krAction}>
                  <strong>연결 액션플랜</strong>
                  <p>{item.actionPlan}</p>
                </div>
                <div className={styles.krConditions}>
                  <strong>목표 달성 조건</strong>
                  <ul>
                    {item.conditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.krWhy}>
                  <strong>왜 하는가</strong>
                  <p>{item.why}</p>
                </div>
                <p className={styles.krEvidence}>{item.evidence}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>플랫폼 ROAS와 내부 ROAS를 같은 눈금으로 비교</h2>
              <p>막대는 ROAS 크기만 비교합니다. 예산 판단에는 파란 막대가 아니라 초록 막대와 보정 후 값을 우선합니다.</p>
            </div>
            <span className={styles.metaText}>source: VM Cloud live API, fallback: gdn 정본 문서</span>
          </div>
          <div className={styles.twoColumn}>
            <div className={styles.compareList}>
              {[last7, last30].map((item) => (
                <div key={item.label} className={styles.compareItem}>
                  <div className={styles.compareTop}>
                    <strong>{item.label} Google platform ROAS</strong>
                    <span>{formatRoas(item.platformRoas)}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${Math.min(100, (item.platformRoas / maxRoas) * 100)}%` }} />
                  </div>
                  <p>전환값 {formatKrw(item.platformValue)} / 광고비 {formatKrw(item.cost)}. Google Ads가 주장하는 참고값입니다.</p>
                </div>
              ))}
              {[last7, last30].map((item) => (
                <div key={`${item.label}-internal`} className={styles.compareItem}>
                  <div className={styles.compareTop}>
                    <strong>{item.label} 내부 confirmed + NPay actual ROAS</strong>
                    <span className={styles.good}>{formatRoas(item.internalWithNpayRoas)}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={`${styles.barFill} ${styles.barFillInternal}`} style={{ width: `${Math.min(100, (item.internalWithNpayRoas / maxRoas) * 100)}%` }} />
                  </div>
                  <p>내부 confirmed {formatKrw(item.internalRevenue)} + NPay actual {formatKrw(item.npayRevenue)}. 예산 판단 후보입니다.</p>
                </div>
              ))}
            </div>
            <div className={styles.findingCard}>
              <strong>현재 Google ROAS 정합성 상태</strong>
              <p>
                최근 live API 기준으로도 Primary known NPay 전환값 비중은 {formatPct(last30.nPayShare)}입니다.
                즉 Google Ads가 잡은 큰 전환값 대부분은 실제 결제완료 원장으로 검증된 매출과 아직 분리해서 봐야 합니다.
              </p>
              <p>
                NPay actual을 내부 매출에 합류시키면 최근 30일 내부 ROAS는 {formatRoas(last30.internalRoas)}에서 {formatRoas(last30.internalWithNpayRoas)}로 올라갑니다.
                그래도 Google platform ROAS {formatRoas(last30.platformRoas)}와는 아직 차이가 큽니다.
              </p>
              <p>
                campaign id coverage는 {formatPct(last30.campaignCoverage)}이고 미확인 주문은 {last30.unknownCampaignOrders ?? "-"}건입니다.
                캠페인별 증액은 이 커버리지가 더 닫힌 뒤 판단하는 편이 안전합니다.
              </p>
              <p>
                다만 진전도 있습니다. NPay 실제 결제완료 중 내부 bridge 후보 {npayBridgeReview.summary.internalBridgeExactCandidates}건을
                A급 {npayBridgeReview.summary.gradeA}건, B급 {npayBridgeReview.summary.gradeB}건으로 나눴습니다.
                남은 병목은 이 결과를 영구 evidence snapshot으로 고정하고, Google click id가 있는 후보만 전송 후보로 따로 올리는 것입니다.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Phase 기준 다음 할일</h2>
              <p>기술 위험 구분표가 아니라 실제 실행 순서로 재배치했습니다. 한 Phase 안의 Sprint는 위에서 아래 순서로 진행합니다.</p>
            </div>
            <span className={styles.metaText}>문서 기준: 2026-05-07, live KPI 보강: {formatFetchedAt(last30.fetchedAt)}</span>
          </div>
          <div className={styles.phasePlan}>
            {phasePlan.map((item) => (
              <div key={`${item.phase}-${item.sprint}`} className={styles.phaseCard}>
                <div className={styles.phaseMeta}>
                  <span className={`${styles.status} ${item.tone === "warn" ? styles.statusWarn : item.tone === "hold" ? styles.statusHold : ""}`}>
                    {item.phase} · {item.sprint} · {item.status}
                  </span>
                  <span>{item.owner}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.why}</p>
                <div className={styles.cadenceBox}>
                  <strong>조회 주기</strong>
                  <span>{item.cadence}</span>
                </div>
                <ol className={styles.phaseSteps}>
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className={styles.phaseResultGrid}>
                  <div>
                    <strong>성공 기준</strong>
                    <span>{item.success}</span>
                  </div>
                  <div>
                    <strong>현재 결과</strong>
                    <span>{item.currentResult}</span>
                  </div>
                  <div>
                    <strong>다음 판단</strong>
                    <span>{item.nextDecision}</span>
                  </div>
                </div>
                <p className={styles.phaseEvidence}>{item.evidence}</p>
                <div className={styles.progressTrack}>
                  <div className={`${styles.progressFill} ${item.tone === "warn" ? styles.progressFillWarn : item.tone === "hold" ? styles.progressFillHold : ""}`} style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>정합성 판단 기준</h2>
              <p>숫자는 출처와 용도를 같이 봐야 합니다. 아래 기준은 GDN harness와 attribution source guide를 화면 문구로 옮긴 것입니다.</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>판단 항목</th>
                  <th>운영에서 쓰는 방식</th>
                  <th>출처</th>
                  <th>주의점</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map((row) => (
                  <tr key={row.decision}>
                    <td><strong>{row.decision}</strong></td>
                    <td>{row.use}</td>
                    <td>{row.source}</td>
                    <td>{row.caveat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>원본 근거</h2>
              <p>운영자가 봐야 하는 핵심 근거만 남겼습니다. 원본 ID와 기술명은 검증용으로만 표시합니다.</p>
            </div>
          </div>
          <div className={styles.evidenceGrid}>
            <div className={styles.evidenceCard}>
              <strong>정본 계획 문서</strong>
              <p>Google Ads ROAS 정합성 작업의 실제 개발 순서와 금지선을 정의합니다.</p>
              <code>gdn/!gdnplan_new.md</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>데이터 source 결정 가이드</strong>
              <p>주문/결제 정본과 광고 클릭 evidence를 분리해서 보라는 기준입니다.</p>
              <code>gdn/attribution-data-source-decision-guide-20260511.md</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>현재 live 조회 API</strong>
              <p>Google Ads API와 내부 원장 값을 같은 화면에서 읽습니다. 최근 7일 카드는 오늘 포함 custom range로 읽습니다.</p>
              <code>/api/google-ads/dashboard-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD</code>
            </div>
            <div className={styles.evidenceCard}>
              <strong>exact evidence 설계안</strong>
              <p>NPay matcher 결과를 영구 evidence로 고정하는 다음 단계 설계입니다. 실행은 승인 전 보류합니다.</p>
              <code>project/google-roas-npay-exact-evidence-design-20260523.md</code>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Codex가 승인 없이 계속 진행할 read-only 작업</h2>
              <p>외부 계정, 운영 DB, Google Ads 학습값을 바꾸지 않는 범위에서만 진행합니다. 반복 조회는 목적과 종료 조건이 있을 때만 합니다.</p>
            </div>
          </div>
          <div className={styles.actionGrid}>
            {activeReadOnlyWork.map((card) => (
              <div key={card.title} className={styles.actionCard}>
                <span className={styles.status}>자동 진행</span>
                <h3>{card.title}</h3>
                <ul>
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>컨펌 요청사항</h2>
              <p>아래는 지금 당장 누르는 버튼이 아니라, 앞 단계 성공/실패 조건이 확인되면 TJ님에게 요청할 결정입니다.</p>
            </div>
          </div>
          <div className={styles.requestGrid}>
            {confirmationRequests.map((request) => (
              <article key={request.title} className={styles.requestCard}>
                <div className={styles.requestTop}>
                  <span className={`${styles.status} ${styles.statusWarn}`}>{request.status}</span>
                  <span>{request.owner}</span>
                </div>
                <h3>{request.title}</h3>
                <dl>
                  <div>
                    <dt>언제</dt>
                    <dd>{request.when}</dd>
                  </div>
                  <div>
                    <dt>왜</dt>
                    <dd>{request.why}</dd>
                  </div>
                  <div>
                    <dt>어느 화면</dt>
                    <dd>{request.screen}</dd>
                  </div>
                  <div>
                    <dt>바꾸면 생기는 효과</dt>
                    <dd>{request.effect}</dd>
                  </div>
                  <div>
                    <dt>성공 기준</dt>
                    <dd>{request.success}</dd>
                  </div>
                  <div>
                    <dt>실패 시 확인점</dt>
                    <dd>{request.fallback}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <p className={styles.footerNote}>
          Source / window / freshness / confidence: primary source는 Google Ads API customer 2149990943와 VM Cloud attribution ledger입니다.
          live KPI window는 Google Ads `LAST_7_DAYS`, `LAST_30_DAYS`이고 기준 시각은 {formatFetchedAt(last30.fetchedAt)}입니다.
          문서 근거는 `gdn/!gdnplan_new.md`, `harness/gdn/RULES.md`, `project/google-ads-confirmed-primary-npay-check-20260523.md`, `project/google-roas-npay-exact-evidence-design-20260523.md`이며 confidence는 0.88-0.93 범위입니다.
          {last7.error || last30.error ? ` 일부 live 조회 실패 시 문서 fallback을 표시했습니다: ${last7.error ?? last30.error}` : ""}
        </p>
      </main>
    </div>
  );
}
