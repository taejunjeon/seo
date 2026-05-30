import express, { type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { google } from "googleapis";

import { readLedgerEntries, type AttributionLedgerEntry } from "../attribution";
import {
  estimateInternalRoasLift,
  fetchNpayActualConfirmedSnapshot,
  type NpayActualConfirmedSnapshot,
} from "../npayActualConfirmedPgReader";
import {
  buildNpayIntentRematchDryRunReport,
  buildNpayIntentUnresolvedReasonBreakdown,
  type NpayIntentRematchDryRunReport,
  type NpayIntentRematchUnresolvedRow,
} from "../npayRoasDryRun";
import { isDatabaseConfigured, queryPg } from "../postgres";
import { env } from "../env";
import { getCrmDb } from "../crmLocalDb";

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_CUSTOMER_ID = "2149990943";
const FINAL_URL_AUDIT_CACHE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_ADS_DASHBOARD_SUMMARY_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const GOOGLE_CAMPAIGN_MATCH_BASELINE_KST = "2026-05-20 23:00 KST";
const GOOGLE_CAMPAIGN_MATCH_ALLOWLIST_DEPLOYED_AT_KST = "2026-05-20 23:48 KST";
const GOOGLE_CLICK_ID_CAPTURE_PATCH_BASELINE_KST = "2026-05-21 21:15 KST";
const GOOGLE_ANALYSIS_ALGORITHM_V2_BASELINE_KST = "2026-05-25 06:30 KST";
const GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID = "7609289411";
const GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_NAME = "BI confirmed_purchase_offline";
const GOOGLE_ADS_CONFIRMED_PURCHASE_CLICK_LOOKBACK_DAYS = 30;
const GOOGLE_ADS_CLICK_ID_STORAGE_DAYS = 90 as const;
const GOOGLE_ADS_TOO_RECENT_RETRY_HOURS = 6 as const;
const GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE = "google_ads_confirmed_purchase_upload_ledger";
const INTERNAL_LEDGER_SOURCE = "biocom_imweb";
const INTERNAL_LEDGER_LIMIT = 10000;
const OPERATIONAL_LEDGER_CHUNK_DAYS = 10;
const KNOWN_NPAY_CONVERSION_LABELS = new Set([
  "r0vuCKvy-8caEJixj5EB",
  "3yjICOXRmJccEJixj5EB",
]);
const KST_TIME_ZONE = "Asia/Seoul";
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_PRESETS = {
  today: "TODAY",
  last_1d: "YESTERDAY",
  last_7d: "LAST_7_DAYS",
  last_14d: "LAST_14_DAYS",
  last_30d: "LAST_30_DAYS",
  last_90d: "LAST_90_DAYS",
} as const;

type DatePreset = keyof typeof DATE_PRESETS;

type DateRange = {
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
  endExclusiveAt?: string;
  timezone: typeof KST_TIME_ZONE;
  basis?: "payment_complete_time" | "paid_at_fallback";
};

type GoogleAdsDateSelection = {
  mode: "preset" | "custom";
  datePreset: DatePreset;
  dateRangeLiteral: string;
  dateRangeCondition: string;
  dateRange: DateRange;
  windowDays: number;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  warnings: string[];
};

class GoogleAdsDateRangeError extends Error {
  statusCode = 400;
}

type GoogleAdsClickIdHealthWindowKey = "last_1d" | "rolling_24h" | "last_7d" | "last_30d" | "analysis_v2";

type GoogleAdsClickIdHealthWindow = DateRange & {
  key: GoogleAdsClickIdHealthWindowKey;
  label: string;
  windowDays: number | null;
  windowHours: number | null;
  isRolling: boolean;
  basis: "payment_complete_time";
};

type OperationalLedgerChunk = {
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
};

type OperationalLedgerPage = {
  entries: AttributionLedgerEntry[];
  latestLoggedAt: string;
  itemCount: number;
  totalEntries: number;
  truncated: boolean;
  url: string;
  chunk: OperationalLedgerChunk;
};

type GoogleAdsErrorSummary = {
  code?: number;
  status?: string;
  message?: string;
  requestId?: string | null;
  googleAdsErrors?: Array<{
    errorCode: unknown;
    message: string;
    fieldPath: string | null;
    index: number | null;
  }>;
  rawPreview?: string;
};

type GoogleAdsSearchResponse = {
  results?: unknown[];
  nextPageToken?: string;
  queryResourceConsumption?: string;
};

type GoogleAdsSearchResult =
  | {
      ok: true;
      status: number;
      body: GoogleAdsSearchResponse;
    }
  | {
      ok: false;
      status: number;
      body: GoogleAdsErrorSummary;
    };

type GoogleAdsClientContext = {
  token: string;
  customerId: string;
  loginCustomerId: string | null;
  apiVersion: string;
  developerToken: string;
  authMode: "service_account" | "user_oauth";
  clientEmail: string | null;
  projectId: string | null;
  oauthClientIdPresent: boolean;
};

type MetricTotals = {
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
};

type CampaignMetricRow = MetricTotals & {
  campaignId: string;
  campaignName: string;
  status: string;
  channel: string;
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
};

type DailyMetricRow = MetricTotals & {
  date: string;
  roas: number | null;
};

type ConversionActionRow = {
  id: string;
  name: string;
  resourceName: string;
  status: string;
  type: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  clickThroughLookbackWindowDays: number | null;
  viewThroughLookbackWindowDays: number | null;
  defaultValue: number | null;
  alwaysUseDefaultValue: boolean;
  sendTo: string[];
  conversionId: string | null;
  conversionLabels: string[];
  snippetTypes: string[];
};

type ConversionActionSegmentCampaignRow = {
  conversionActionResourceName: string;
  conversionActionId: string | null;
  conversionActionName: string;
  campaignId: string;
  campaignName: string;
  channel: string;
  conversions: number;
  conversionValue: number;
  allConversions: number;
  allConversionValue: number;
  viewThroughConversions: number;
  status: string;
  category: string;
  primaryForGoal: boolean;
  countingType: string;
  sendTo: string[];
  conversionLabels: string[];
  classification: string;
  riskFlags: string[];
};

type ConversionActionSegmentActionRow = Omit<
  ConversionActionSegmentCampaignRow,
  "campaignId" | "campaignName" | "channel"
> & {
  campaignCount: number;
  campaigns: string[];
  shareOfPlatformConversionValue: number | null;
  shareOfAllConversionValue: number | null;
};

type ConversionActionGapDriver = {
  key: string;
  label: string;
  value: number;
  shareOfPlatformConversionValue: number | null;
  confidence: "high" | "medium-high" | "medium";
  evidence: string;
  nextAction: string;
};

type InternalOrderStatus = "confirmed" | "pending" | "canceled";

type InternalOrder = {
  key: string;
  date: string;
  status: InternalOrderStatus;
  amount: number;
  campaignId: string | null;
  utmCampaign: string;
  hasClickId: boolean;
};

type InternalRevenueTotals = {
  orders: number;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
};

type InternalCampaignRow = InternalRevenueTotals & {
  campaignId: string | null;
  campaignName: string;
  platformCost: number;
  platformConversionValue: number;
  platformRoas: number | null;
  internalConfirmedRoas: number | null;
  roasGap: number | null;
  matchStatus: "matched" | "internal_only" | "platform_only" | "unknown_campaign";
  examples: string[];
};

type GoogleNpayBridgeReviewRow = {
  orderNumber: string;
  channelOrderNo: string;
  paidAt: string;
  orderAmount: number | null;
  productName: string;
  strongGrade: NpayIntentRematchDryRunReport["candidates"][number]["strongGrade"];
  score: number;
  scoreGap: number | null;
  timeGapMinutes: number;
  orderCreatedAt: string;
  orderCreatedGapMinutes: number | null;
  orderCreateTimeBridge: string;
  amountMatchType: string;
  hasGoogleClickId: boolean;
  googleClickIdTypes: Array<"gclid" | "gbraid" | "wbraid">;
  googleClickIdEvidenceSource:
    | "intent_direct"
    | "paid_click_intent_same_client_session"
    | "site_landing_same_client_session"
    | "none";
  googleClickIdRawValueAvailable: boolean;
  googleClickIdEvidencePlain: string;
  npayBridgeUrlHashPresent?: boolean;
  npayBridgeHost?: string;
  npayBridgePathHashPresent?: boolean;
  npayBridgeObservedAt?: string;
  gadCampaignId: string | null;
  campaignIdEvidenceSource:
    | "intent_page_location"
    | "paid_click_intent_same_client_session"
    | "site_landing_same_client_session"
    | "none";
  utmCampaign: string;
  recommendedAction: string;
  blockReasons: string[];
  gradePlainReason: string;
  gradeAUpgradeDecision:
    | "already_grade_a"
    | "blocked_time_gap"
    | "blocked_amount_mismatch"
    | "blocked_score_gap"
    | "blocked_missing_click_id"
    | "manual_review_only";
  gradeAUpgradePlain: string;
  internalBridgeDecision: "strong_bridge_candidate" | "manual_review_candidate";
  googleAdsSendDecision: "blocked_no_send";
};

type GoogleNpayBridgeCampaignSummary = {
  campaignId: string | null;
  campaignName: string;
  internalBridgeCandidates: number;
  bridgeCandidatesWithGoogleClickId: number;
  gradeA: number;
  gradeB: number;
  amountKrw: number;
  googleAdsSendCandidates: 0;
};

type GoogleNpayFinalSourceChannel =
  | "google"
  | "meta"
  | "naver"
  | "organic"
  | "direct"
  | "unknown";

type GoogleNpayFinalSourceSummaryRow = {
  channel: GoogleNpayFinalSourceChannel;
  label: string;
  completedOrders: number;
  amountKrw: number;
  bridgeCandidateOrders: number;
  directGoogleClickIdOrders: number;
  recoveredGoogleClickIdOrders: number;
  confidence: "high" | "medium" | "low";
  plain: string;
};

type GoogleNpayFinalSourceDateDistributionRow = {
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
};

type GoogleNpayFinalSourceUnclassifiedReasonRow = {
  reason: string;
  label: string;
  completedOrders: number;
  sharePct: number;
  sampleOrderCount: number;
  plain: string;
};

type GoogleNpayFinalSourceSummary = {
  totalCompletedOrders: number;
  classifiedCompletedOrders: number;
  unclassifiedCompletedOrders: number;
  googleEvidenceOrders: number;
  googleEvidenceAmountKrw: number;
  byChannel: GoogleNpayFinalSourceSummaryRow[];
  unclassifiedReasons: GoogleNpayFinalSourceUnclassifiedReasonRow[];
  dateDistribution: GoogleNpayFinalSourceDateDistributionRow[];
  source: "npay_intent_bridge_candidate_rows";
  basis: string;
  caveat: string;
};

type GoogleNpayBridgeSourceFunnelRow = NpayIntentRematchDryRunReport["sourceFunnelComparison"][number];
type GoogleNpayBridgeUnresolvedRow = NpayIntentRematchDryRunReport["unresolvedRows"][number];

type GoogleNpayBridgeReview = {
  generatedAt: string;
  source: "npay_intent_rematch_dry_run";
  mode: "no_write_no_send";
  dateRange: DateRange;
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
    liveIntentWithNpayBridgeUrlHash: number;
    googleLikeIntentWithNpayBridgeUrlHash: number;
    enteredNotCompletedBreakdown: {
      total: number;
      pendingWindow: number;
      loginGatePossible: number;
      checkoutOpenedPossible: number;
      matchingGapPossible: number;
    };
    googleClickIdIntentCount: number;
    googleClickIdIntentBreakdown: {
      gclid: number;
      gbraid: number;
      wbraid: number;
    };
    actualConfirmedNpayOrders: number;
    internalBridgeStrongCandidates: number;
    internalBridgeExactCandidates: number;
    internalBridgeExactWithGoogleClickId: number;
    bridgeCandidatesWithGoogleClickId: number;
    bridgeCandidatesWithRecoveredGoogleClickId: number;
    bridgeCandidatesWithNpayBridgeUrlHash: number;
    gradeA: number;
    gradeAWithDirectGoogleClickId: number;
    gradeAWithRecoveredGoogleClickId: number;
    gradeAWithGoogleClickId: number;
    gradeAWithNpayBridgeUrlHash: number;
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash: number;
    gradeADirectGoogleClickIdAmountKrw: number;
    gradeAWithGoogleClickIdAmountKrw: number;
    gradeARecoveredGoogleClickIdAmountKrw: number;
    gradeANeedsClickIdRecoveryRows: number;
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
  gradeBRows: GoogleNpayBridgeReviewRow[];
  campaignSummary: GoogleNpayBridgeCampaignSummary[];
  finalSourceSummary: GoogleNpayFinalSourceSummary;
  sourceFunnelComparison: GoogleNpayBridgeSourceFunnelRow[];
  unresolvedRows: GoogleNpayBridgeUnresolvedRow[];
  plainMeaning: string;
  noWritePolicy: string;
  caveats: string[];
};

type GoogleAdsClickIdHealthOrderRow = {
  orderNumber: string;
  channelOrderNo: string | null;
  paidAt: string | Date | null;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: string | number | null;
  refundAmount: string | number | null;
  hasCancel: boolean;
  hasReturn: boolean;
  isNpay: boolean;
};

type GoogleAdsActualPurchaseEligibility = {
  source: "meta_capi_compatible_confirmed_purchase_guard";
  passed: boolean;
  criteria: {
    paymentComplete: boolean;
    positiveAmount: boolean;
    noCancel: boolean;
    noReturn: boolean;
    noRefund: boolean;
  };
  blockReasons: string[];
  plain: string;
};

type GoogleAdsClickIdHealthLedgerRow = {
  entry_id: string;
  logged_at: string;
  approved_at: string;
  order_id: string;
  payment_key: string;
  landing: string;
  referrer: string;
  gclid: string;
  metadata_json: string;
  request_context_json: string;
};

type GoogleAdsVmConfirmedPaymentSuccessRow = GoogleAdsClickIdHealthLedgerRow & {
  order_no?: string | null;
  order_code?: string | null;
  channel_order_no?: string | null;
  pay_type?: string | null;
  pg_type?: string | null;
  total_price?: number | null;
  payment_amount?: number | null;
  delivery_price?: number | null;
  raw_json?: string | null;
  imweb_order_time?: string | null;
  imweb_complete_time?: string | null;
  imweb_status?: string | null;
  imweb_status_synced_at?: string | null;
  imweb_synced_at?: string | null;
};

type GoogleAdsVmConfirmedImwebOrderRow = {
  order_no: string | null;
  order_code: string | null;
  channel_order_no: string | null;
  pay_type: string | null;
  pg_type: string | null;
  total_price: number | null;
  payment_amount: number | null;
  delivery_price: number | null;
  raw_json: string | null;
  imweb_order_time: string | null;
  imweb_complete_time: string | null;
  imweb_status: string | null;
  imweb_status_synced_at: string | null;
  imweb_synced_at: string | null;
};

type GoogleAdsClickIdHealthIntentRow = {
  id: string;
  captured_at: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  page_location: string | null;
  matched_order_no: string | null;
};

type GoogleAdsClickIdHealth = {
  windowDays: number | null;
  windowHours?: number | null;
  windowKey?: GoogleAdsClickIdHealthWindowKey;
  windowLabel?: string;
  dateRange: DateRange;
  generatedAt: string;
  source: "operational_db_and_vm_cloud_sqlite";
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
  evidenceSourceBreakdown: {
    paymentSuccessLedgerRows: number;
    npayIntentRows: number;
    bothRows: number;
    noneRows: number;
    clickIdFromPaymentSuccessLedgerRows: number;
    clickIdFromNpayIntentRows: number;
    clickIdFromBothRows: number;
  };
  blockReasonCounts: {
    readOnlyPhase: number;
    approvalRequired: number;
    missingGoogleClickId: number;
    missingAttributionVmEvidence: number;
  };
  sourceFreshness: OperationalDbFreshness;
  caveats: string[];
};

type GoogleClickIdDropoffStage = {
  key:
    | "site_landing"
    | "paid_click_intent"
    | "checkout_started"
    | "payment_page_seen"
    | "payment_success_all"
    | "payment_success_confirmed_direct"
    | "npay_intent_exact";
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
  fromKey: GoogleClickIdDropoffStage["key"];
  toKey: GoogleClickIdDropoffStage["key"];
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
  windowDays: number | null;
  generatedAt: string;
  source: "vm_cloud_sqlite_and_operational_db";
  mode: "no_send_read_only";
  dateRange: DateRange;
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
  orderEvidenceBreakdown: GoogleAdsClickIdHealth["evidenceSourceBreakdown"] & {
    orderCount: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    missingAttributionVmEvidence: number;
    interpretation: string;
  };
  conclusion: {
    status:
      | "click_capture_ok_order_direct_missing"
      | "checkout_or_payment_page_missing"
      | "landing_capture_missing"
      | "order_direct_preserved";
    plain: string;
    nextAction: string;
  };
  sourceFreshness: OperationalDbFreshness;
  invariants: {
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    rawClickIdInResponse: false;
  };
  caveats: string[];
};

type GoogleAdsClickIdHealthOrderDiagnostic = {
  source: "operational_db" | "vm_confirmed_payment_success";
  orderNumber: string;
  channelOrderNo: string | null;
  paidAt: string | Date | null;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number;
  refundAmount: number;
  hasCancel: boolean;
  hasReturn: boolean;
  isNpay: boolean;
  evidenceSource: "payment_success_ledger" | "npay_intent" | "both" | "none";
  evidenceAt: {
    paymentSuccessLoggedAt: string | null;
    paymentSuccessApprovedAt: string | null;
    npayIntentCapturedAt: string | null;
  };
  googleClickIds: {
    gclid: string;
    gbraid: string;
    wbraid: string;
  };
  hasGoogleClickId: boolean;
  clickIdTypes: {
    gclid: boolean;
    gbraid: boolean;
    wbraid: boolean;
  };
  actualPurchaseEligibility: GoogleAdsActualPurchaseEligibility;
  uploadCandidateCount: 0;
  sendCandidateCount: 0;
  blockReasons: string[];
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

type GoogleAdsConfirmedPurchasePrivatePayloadPreviewCandidate = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  sourceWindow: {
    key: GoogleAdsClickIdHealthWindowKey;
    label: string;
    startAt: string;
    endAt: string;
    timezone: typeof KST_TIME_ZONE;
  };
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
    source: GoogleAdsClickIdHealthOrderDiagnostic["evidenceSource"];
    exactClickIdType: "gclid";
    hasGclid: true;
    hasGbraid: boolean;
    hasWbraid: boolean;
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

type GoogleAdsConfirmedPurchasePrivatePayloadPreview = {
  generatedAt: string;
  site: "biocom";
  mode: "private_no_send_payload_preview";
  goal: string;
  progress: {
    privatePreviewProgressPct: number;
    overallPrimaryConversionReadinessPct: number;
    plain: string;
  };
  window: GoogleAdsClickIdHealthWindow;
  requestedLimit: number;
  summary: {
    sourceOrderRows: number;
    exactGclidActualPurchaseRows: number;
    returnedCandidates: number;
    privateRawValueChecksPassed: number;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
  };
  candidates: GoogleAdsConfirmedPurchasePrivatePayloadPreviewCandidate[];
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

type GoogleAdsDuplicateLedgerDryRunRow = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  dedupeKeyHash: string;
  payloadHash: string;
  conversionActionId: string;
  conversionActionName: string;
  payment: {
    amountKrw: number;
    currencyCode: "KRW";
    paidDateKst: string;
  };
  evidence: {
    clickIdType: "gclid";
    rawClickIdExposed: false;
  };
  firstPassDecision: "would_insert_new_preview_row" | "would_block_duplicate_in_same_batch";
  replayDecision: "would_block_duplicate_send";
  sendMode: "blocked_no_send_dry_run";
  ledgerWrite: false;
  reasons: string[];
};

type GoogleAdsDuplicateLedgerDryRun = {
  generatedAt: string;
  site: "biocom";
  mode: "duplicate_send_ledger_dry_run";
  goal: string;
  sourcePreview: {
    mode: GoogleAdsConfirmedPurchasePrivatePayloadPreview["mode"];
    window: GoogleAdsClickIdHealthWindow;
    requestedLimit: number;
    sourceOrderRows: number;
    exactGclidActualPurchaseRows: number;
    privateRawValueChecksPassed: number;
  };
  summary: {
    sourceCandidateCount: number;
    uniqueDedupeKeys: number;
    duplicateDedupeKeys: number;
    simulatedReplayRows: number;
    simulatedReplayBlocked: number;
    dryRunLedgerRows: number;
    ledgerWriteCount: 0;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
  };
  readiness: {
    duplicateLedgerDryRunPassed: boolean;
    actualLedgerReadyForWrite: false;
    googleAdsSendReady: false;
    blockers: string[];
  };
  rows: GoogleAdsDuplicateLedgerDryRunRow[];
  invariants: {
    rawOrderIdInResponse: false;
    rawClickIdInResponse: false;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    googleAdsWrite: 0;
    ledgerWriteCount: 0;
  };
  caveats: string[];
};

type GoogleAdsUploadLedgerWriteSmokePlanRow = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  statusToWrite: "ready";
  dedupeKeyHash: string;
  payloadHash: string;
  conversionActionId: string;
  conversionActionName: string;
  clickIdType: "gclid";
  amountKrw: number;
  currencyCode: "KRW";
  paidDateKst: string;
  firstWriteDecision: "would_insert_ready_row" | "would_block_duplicate_in_same_batch";
  replayDecision: "would_block_duplicate_ready_row";
  sqlParamPresence: {
    safeRef: true;
    dedupeKeyHash: true;
    payloadHash: true;
    conversionActionId: true;
    clickIdDigest: true;
    orderDigest: true;
    conversionTimeKst: true;
    conversionValueKrw: true;
  };
  rawOrderIdExposed: false;
  rawClickIdExposed: false;
};

type GoogleAdsUploadLedgerWriteSmokePlan = {
  generatedAt: string;
  site: "biocom";
  mode: "upload_ledger_write_smoke_plan_no_write";
  goal: string;
  progress: {
    uploadLedgerPrepPct: number;
    overallPrimaryConversionReadinessPct: number;
    plain: string;
  };
  sourceDryRun: {
    mode: GoogleAdsDuplicateLedgerDryRun["mode"] | "upload_candidate_builder";
    sourceCandidateCount: number;
    uniqueDedupeKeys: number;
    simulatedReplayBlocked: number;
    duplicateLedgerDryRunPassed: boolean;
  };
  schemaPlan: {
    tableName: typeof GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE;
    ddlHash: string;
    uniqueKey: "site + conversion_action_id + dedupe_key_hash";
    statusFlow: Array<"ready" | "sent" | "failed" | "blocked_duplicate">;
    rollbackShape: "delete_ready_rows_by_status_and_created_at_before_any_send";
  };
  summary: {
    plannedReadyRows: number;
    duplicateRowsBlockedInPlan: number;
    replayRowsBlocked: number;
    ledgerWriteCount: 0;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
  };
  rows: GoogleAdsUploadLedgerWriteSmokePlanRow[];
  readiness: {
    writeSmokePlanReady: boolean;
    actualLedgerWriteReady: false;
    googleAdsSendReady: false;
    blockers: string[];
  };
  invariants: {
    rawOrderIdInResponse: false;
    rawClickIdInResponse: false;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    googleAdsWrite: 0;
    ledgerWriteCount: 0;
  };
  caveats: string[];
};

type GoogleAdsUploadLedgerWriteSmokeResultRow = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  status: "ready" | "duplicate_existing";
  dedupeKeyHash: string;
  payloadHash: string;
  conversionActionId: string;
  conversionActionName: string;
  clickIdType: "gclid";
  amountKrw: number;
  currencyCode: "KRW";
  paidDateKst: string;
  firstWriteDecision: "inserted_ready_row" | "blocked_existing_duplicate";
  replayDecision: "blocked_duplicate_ready_row";
  rawOrderIdExposed: false;
  rawClickIdExposed: false;
};

type GoogleAdsUploadLedgerWriteSmokeResult = {
  generatedAt: string;
  site: "biocom";
  mode: "upload_ledger_write_smoke_executed";
  goal: string;
  approval: {
    confirmation: "vm_cloud_write_smoke_approved";
    maxReadyRows: 5;
    googleAdsSendApproved: false;
  };
  progress: {
    uploadLedgerWriteSmokePct: number;
    overallPrimaryConversionReadinessPct: number;
    plain: string;
  };
  sourcePlan: {
    mode: GoogleAdsUploadLedgerWriteSmokePlan["mode"];
    plannedReadyRows: number;
    replayRowsBlocked: number;
    writeSmokePlanReady: boolean;
  };
  schema: {
    tableName: typeof GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE;
    ddlHash: string;
    uniqueKey: "site + conversion_action_id + dedupe_key_hash";
  };
  summary: {
    plannedReadyRows: number;
    insertedReadyRows: number;
    existingDuplicateRows: number;
    replayRowsBlocked: number;
    ledgerWriteCount: number;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
  };
  rows: GoogleAdsUploadLedgerWriteSmokeResultRow[];
  readiness: {
    actualLedgerWritePassed: boolean;
    googleAdsSendReady: false;
    nextReadinessPct: number;
    blockers: string[];
  };
  rollback: {
    rollbackShape: "delete_ready_rows_by_smoke_run_id_before_any_send";
    smokeRunId: string;
    deleteWhere: string;
  };
  invariants: {
    rawOrderIdInResponse: false;
    rawClickIdInResponse: false;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: number;
    googleAdsWrite: 0;
    ledgerWriteCount: number;
  };
  caveats: string[];
};

type GoogleAdsConfirmedPurchaseCandidateExpansionTier = {
  key:
    | "ready_exact_gclid"
    | "potential_one_of_gbraid_wbraid"
    | "mixed_google_click_ids"
    | "npay_bridge_grade_a_google_click_id_no_write"
    | "npay_bridge_grade_a_recovered_google_click_id_no_write"
    | "internal_bridge_without_google_click_id"
    | "missing_click_bridge"
    | "not_actual_purchase";
  label: string;
  count: number;
  amountKrw: number;
  googleAdsSendPolicy:
    | "no_send_ready_after_ledger_and_red_approval"
    | "no_send_needs_payload_builder"
    | "no_send_needs_manual_disambiguation"
    | "no_send_needs_bridge_write_and_red_approval"
    | "no_send_internal_analysis_only"
    | "no_send_missing_google_click_id"
    | "no_send_not_actual_purchase";
  plain: string;
};

type GoogleAdsConfirmedPurchaseCandidateExpansion = {
  generatedAt: string;
  site: "biocom";
  mode: "confirmed_purchase_candidate_expansion_no_send";
  goal: string;
  progress: {
    actualPurchaseCandidateReadinessPct: number;
    actualPurchaseCandidateDiscoveryPct: number;
    overallPrimaryConversionReadinessPct: number;
    plain: string;
  };
  window: GoogleAdsClickIdHealthWindow;
  sourceFreshness: OperationalDbFreshness;
  summary: {
    actualPurchaseRows: number;
    actualPurchaseRevenueKrw: number;
    readyExactGclidRows: number;
    potentialOneOfBraidRows: number;
    mixedGoogleClickIdRows: number;
    npayBridgeGradeAWithGoogleClickIdRows: number;
    npayBridgeGradeAWithGoogleClickIdAmountKrw: number;
    npayBridgeGradeARecoveredGoogleClickIdRows: number;
    npayBridgeGradeARecoveredGoogleClickIdAmountKrw: number;
    npayBridgeGradeANeedsClickIdRecoveryRows: number;
    internalBridgeWithoutGoogleClickIdRows: number;
    missingClickBridgeRows: number;
    notActualPurchaseRows: number;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
  };
  tiers: GoogleAdsConfirmedPurchaseCandidateExpansionTier[];
  sampleRows: Array<{
    safeRef: string;
    tier: GoogleAdsConfirmedPurchaseCandidateExpansionTier["key"];
    amountKrw: number;
    paidDateKst: string;
    paymentMethod: "homepage" | "npay" | "unknown";
    evidenceSource: GoogleAdsClickIdHealthOrderDiagnostic["evidenceSource"];
    clickIdTypes: {
      hasGclid: boolean;
      hasGbraid: boolean;
      hasWbraid: boolean;
    };
    rawOrderIdExposed: false;
    rawClickIdExposed: false;
    whyNotSendYet: string;
  }>;
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

type GoogleAdsOfflineDiagnosticClassificationKey =
  | "ready_ledger_waiting_send"
  | "sent_waiting_or_reflected"
  | "failed_click_too_old_for_action"
  | "failed_invalid_or_test_click_id"
  | "failed_google_ads_partial_failure"
  | "candidate_missing_google_click_id"
  | "candidate_needs_bridge_write"
  | "candidate_not_actual_purchase"
  | "needs_manual_review";

type GoogleAdsOfflineDiagnosticClassification = {
  generatedAt: string;
  site: "biocom";
  mode: "offline_diagnostic_classification_no_send";
  goal: string;
  window: GoogleAdsClickIdHealthWindow;
  sourceFreshness: OperationalDbFreshness;
  summary: {
    ledgerRowsInWindow: number;
    candidateRowsInWindow: number;
    actualPurchaseRows: number;
    classifiedRows: number;
    googleAdsSendCandidateRows: number;
    googleAdsSendCandidateAmountKrw: number;
    externalSendCount: 0;
  };
  classificationCounts: Array<{
    key: GoogleAdsOfflineDiagnosticClassificationKey;
    label: string;
    count: number;
    amountKrw: number;
    plain: string;
    sendPolicy:
      | "diagnostic_only"
      | "ready_after_send_approval"
      | "do_not_send"
      | "manual_review_before_send";
  }>;
  separationGuide: {
    classificationPurpose: string;
    sendExpansionPurpose: string;
    plain: string;
  };
  recentRows: Array<{
    safeRef: string;
    rowSource: "upload_ledger" | "candidate_expansion";
    classification: GoogleAdsOfflineDiagnosticClassificationKey;
    amountKrw: number;
    conversionDateKst: string;
    ledgerStatus: string | null;
    reason: string;
    rawOrderIdExposed: false;
    rawClickIdExposed: false;
  }>;
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

type GoogleAdsConfirmedPurchaseUploadCandidate = {
  candidateRank: number;
  safeRef: string;
  maskedOrderRef: string;
  candidateSource: "homepage_direct_gclid" | "npay_bridge_grade_a_gclid";
  rawOrderId: string;
  rawGclid: string;
  conversionActionId: string;
  conversionActionName: string;
  conversionActionResourceName: string;
  conversionDateTime: string;
  conversionValue: number;
  currencyCode: "KRW";
  duplicateSendKeyHash: string;
  dedupeKeyHash: string;
  payloadHash: string;
  ledgerRowId: number | null;
  ledgerStatus: string;
  sendReady: boolean;
  blockReasons: string[];
};

type GoogleAdsConfirmedPurchaseClickAgeDryRunStatus =
  | "within_action_click_window"
  | "click_too_old_for_action"
  | "too_recent_for_google_retry"
  | "click_time_unknown"
  | "conversion_time_missing_or_invalid"
  | "conversion_before_click"
  | "missing_exact_gclid"
  | "not_actual_purchase";

type GoogleAdsConfirmedPurchaseClickAgeDryRun = {
  generatedAt: string;
  site: "biocom";
  mode: "click_age_dry_run_no_send";
  goal: string;
  window: GoogleAdsClickIdHealthWindow;
  criteria: {
    actionClickThroughLookbackDays: number;
    googleClickIdStorageDays: 90;
    tooRecentRetryHours: 6;
    tooOldRulePlain: string;
    tooRecentRulePlain: string;
    unknownRulePlain: string;
  };
  summary: {
    actualPurchaseRows: number;
    exactGclidRows: number;
    knownClickTimeRows: number;
    withinActionClickWindowRows: number;
    clickTooOldForActionRows: number;
    tooRecentForGoogleRetryRows: number;
    clickTimeUnknownRows: number;
    notActualPurchaseRows: number;
    googleAdsSendCount: 0;
    vmCloudWriteCount: 0;
  };
  statusCounts: Array<{
    status: GoogleAdsConfirmedPurchaseClickAgeDryRunStatus;
    count: number;
    amountKrw: number;
    plain: string;
  }>;
  rows: Array<{
    safeRef: string;
    status: GoogleAdsConfirmedPurchaseClickAgeDryRunStatus;
    amountKrw: number;
    paidDateKst: string;
    paymentMethod: "homepage" | "npay" | "unknown";
    evidenceSource: GoogleAdsClickIdHealthOrderDiagnostic["evidenceSource"];
    clickAgeHours: number | null;
    clickAgeDays: number | null;
    clickCapturedAtKnown: boolean;
    rawOrderIdExposed: false;
    rawClickIdExposed: false;
    reason: string;
  }>;
  invariants: {
    rawOrderIdInResponse: false;
    rawClickIdInResponse: false;
    externalSendCount: 0;
    operationalDbWrite: 0;
    vmCloudWrite: 0;
    googleAdsWrite: 0;
  };
  caveats: string[];
};

type GoogleAdsClickConversionUploadResponse = {
  ok: boolean;
  status: number;
  requestId: string;
  responseHash: string;
  resultCount: number;
  partialFailure: boolean;
  sentIndexes: Set<number>;
  failedIndexes: Set<number>;
  errorSummary: GoogleAdsErrorSummary | null;
};

type GoogleCampaignMatchHealth = {
  windowDays: number;
  generatedAt: string;
  source: "vm_cloud_sqlite_and_google_ads_dashboard";
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
  healthSplit: {
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

type FinalUrlSiteBucket = "biocom" | "thecleancoffee" | "other" | "unknown";
type OtherFinalUrlDisposition =
  | "ignore_external_or_legacy"
  | "needs_site_mapping"
  | "review_wrong_destination"
  | "unknown_review";

type GoogleAdsFinalUrlAuditRow = {
  level: "ad" | "asset_group";
  site: FinalUrlSiteBucket;
  hosts: string[];
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  channel: string;
  parentId: string | null;
  parentName: string | null;
  entityId: string;
  entityStatus: string;
  finalUrlCount: number;
  sampleUrls: string[];
  queryKeys: string[];
  hasUtmSource: boolean;
  hasUtmMedium: boolean;
  hasUtmCampaign: boolean;
  hasGoogleClickParam: boolean;
  hasTrackingTemplate: boolean;
  hasFinalUrlSuffix: boolean;
  trackingTemplateKeys: string[];
  finalUrlSuffixKeys: string[];
  readiness: "manual_utm_present" | "auto_tagging_only" | "tracking_gap" | "no_final_url";
  otherUrlDisposition?: OtherFinalUrlDisposition;
  otherUrlDispositionLabel?: string;
  otherUrlDispositionReason?: string;
};

type GoogleAdsFinalUrlSiteSummary = {
  site: FinalUrlSiteBucket;
  label: string;
  rows: number;
  finalUrls: number;
  manualUtmRows: number;
  googleClickParamRows: number;
  trackingTemplateRows: number;
  finalUrlSuffixRows: number;
  readiness: "ok" | "verify_click_id_capture" | "gap" | "not_found";
  interpretation: string;
};

type GoogleAdsLandingClickIdAudit = {
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

type OtherFinalUrlDispositionSummary = {
  disposition: OtherFinalUrlDisposition;
  label: string;
  rows: number;
  finalUrls: number;
  interpretation: string;
};

type OtherFinalUrlSummary = {
  totalRows: number;
  finalUrls: number;
  dispositionSummary: OtherFinalUrlDispositionSummary[];
  samples: Array<{
    campaignName: string;
    campaignStatus: string;
    channel: string;
    parentName: string | null;
    entityStatus: string;
    hosts: string[];
    sampleUrls: string[];
    disposition: OtherFinalUrlDisposition;
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

type GoogleAdsFinalUrlAuditCacheEntry = {
  key: string;
  createdAt: number;
  expiresAt: number;
  body: Record<string, unknown>;
};

let finalUrlAuditCacheEntry: GoogleAdsFinalUrlAuditCacheEntry | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toStringValue(item).trim())
    .filter(Boolean);
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCustomerId = (value: unknown): string => {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : env.GOOGLE_ADS_CUSTOMER_ID || DEFAULT_CUSTOMER_ID;
  return raw.replace(/\D/g, "") || DEFAULT_CUSTOMER_ID;
};

const parseDatePreset = (value: unknown): DatePreset => {
  if (typeof value === "string" && value in DATE_PRESETS) {
    return value as DatePreset;
  }
  return "last_30d";
};

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const kstDate = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
  }
  return KST_DATE_FORMATTER.format(date);
};

const shiftIsoDate = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
};

const dateToUtcMs = (date: string) => {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
};

const isValidIsoDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
};

const inclusiveDateWindowDays = (startDate: string, endDate: string) =>
  Math.floor((dateToUtcMs(endDate) - dateToUtcMs(startDate)) / 86_400_000) + 1;

const toKstIsoWithOffset = (date: Date) =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+09:00");

const toSqliteUtcIsoBound = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolvePresetDateRange = (preset: DatePreset): DateRange => {
  const today = kstDate(new Date());
  if (preset === "today") {
    return {
      startDate: today,
      endDate: today,
      startAt: `${today}T00:00:00.000+09:00`,
      endAt: `${today}T23:59:59.999+09:00`,
      endExclusiveAt: `${shiftIsoDate(today, 1)}T00:00:00.000+09:00`,
      timezone: KST_TIME_ZONE,
      basis: "paid_at_fallback",
    };
  }

  const days =
    preset === "last_1d"
      ? 1
      : preset === "last_7d"
        ? 7
        : preset === "last_14d"
          ? 14
          : preset === "last_90d"
            ? 90
            : 30;
  const startDate = shiftIsoDate(today, -days);
  const endDate = shiftIsoDate(today, -1);
  return {
    startDate,
    endDate,
    startAt: `${startDate}T00:00:00.000+09:00`,
    endAt: `${endDate}T23:59:59.999+09:00`,
    endExclusiveAt: `${shiftIsoDate(endDate, 1)}T00:00:00.000+09:00`,
    timezone: KST_TIME_ZONE,
    basis: "paid_at_fallback",
  };
};

const resolveCustomDateRange = (startDate: string, endDate: string): DateRange => ({
  startDate,
  endDate,
  startAt: `${startDate}T00:00:00.000+09:00`,
  endAt: `${endDate}T23:59:59.999+09:00`,
  endExclusiveAt: `${shiftIsoDate(endDate, 1)}T00:00:00.000+09:00`,
  timezone: KST_TIME_ZONE,
  basis: "paid_at_fallback",
});

const parseGoogleAdsDateSelection = (query: Record<string, unknown>): GoogleAdsDateSelection => {
  const startDate = toStringValue(query.start_date ?? query.startDate ?? query.since).trim();
  const endDate = toStringValue(query.end_date ?? query.endDate ?? query.until).trim();
  const hasCustomRange = Boolean(startDate || endDate);

  if (hasCustomRange) {
    if (!startDate || !endDate) {
      throw new GoogleAdsDateRangeError("custom date range requires both start_date and end_date");
    }
    if (!isValidIsoDateOnly(startDate) || !isValidIsoDateOnly(endDate)) {
      throw new GoogleAdsDateRangeError("custom date range must use YYYY-MM-DD dates");
    }
    if (dateToUtcMs(endDate) < dateToUtcMs(startDate)) {
      throw new GoogleAdsDateRangeError("custom date range end_date must be on or after start_date");
    }

    const windowDays = inclusiveDateWindowDays(startDate, endDate);
    if (windowDays > 366) {
      throw new GoogleAdsDateRangeError("custom date range is limited to 366 days");
    }

    return {
      mode: "custom",
      datePreset: "last_30d",
      dateRangeLiteral: `${startDate}..${endDate}`,
      dateRangeCondition: `segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      dateRange: resolveCustomDateRange(startDate, endDate),
      windowDays,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      warnings: [
        "Google Ads API metrics use the exact custom range. Some auxiliary health cards that rely on rolling snapshots may still be interpreted as reference-only.",
      ],
    };
  }

  const datePreset = parseDatePreset(query.date_preset ?? query.preset);
  const dateRangeLiteral = DATE_PRESETS[datePreset];
  const dateRange = resolvePresetDateRange(datePreset);

  return {
    mode: "preset",
    datePreset,
    dateRangeLiteral,
    dateRangeCondition: `segments.date DURING ${dateRangeLiteral}`,
    dateRange,
    windowDays: datePresetWindowDays(datePreset),
    requestedStartDate: null,
    requestedEndDate: null,
    warnings: [],
  };
};

const ALLOWED_CLICK_ID_HEALTH_WINDOWS: GoogleAdsClickIdHealthWindowKey[] = [
  "last_1d",
  "rolling_24h",
  "last_7d",
  "last_30d",
  "analysis_v2",
];

const parseClickIdHealthWindowKey = (value: unknown): GoogleAdsClickIdHealthWindowKey | null => {
  if (value == null || value === "") return "last_1d";
  if (typeof value !== "string") return null;
  return (ALLOWED_CLICK_ID_HEALTH_WINDOWS as string[]).includes(value)
    ? (value as GoogleAdsClickIdHealthWindowKey)
    : null;
};

const resolveClickIdHealthWindow = (
  key: GoogleAdsClickIdHealthWindowKey,
  now = new Date(),
): GoogleAdsClickIdHealthWindow => {
  const today = kstDate(now);
  if (key === "analysis_v2") {
    return {
      key,
      label: "분석 알고리즘 v2 기준점 이후",
      startDate: "2026-05-25",
      endDate: kstDate(now),
      startAt: "2026-05-25T06:30:00.000+09:00",
      endAt: toKstIsoWithOffset(now),
      endExclusiveAt: toKstIsoWithOffset(now),
      timezone: KST_TIME_ZONE,
      windowDays: null,
      windowHours: null,
      isRolling: true,
      basis: "payment_complete_time",
    };
  }

  if (key === "rolling_24h") {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      key,
      label: "최근 24시간(조회 시각 기준)",
      startDate: kstDate(start),
      endDate: kstDate(now),
      startAt: toKstIsoWithOffset(start),
      endAt: toKstIsoWithOffset(now),
      endExclusiveAt: toKstIsoWithOffset(now),
      timezone: KST_TIME_ZONE,
      windowDays: null,
      windowHours: 24,
      isRolling: true,
      basis: "payment_complete_time",
    };
  }

  const days = key === "last_1d" ? 1 : key === "last_7d" ? 7 : 30;
  const startDate = shiftIsoDate(today, -days);
  const endDate = shiftIsoDate(today, -1);
  return {
    key,
    label: key === "last_1d" ? "전일 완료일 기준" : `최근 ${days}일 완료일 기준`,
    startDate,
    endDate,
    startAt: `${startDate}T00:00:00.000+09:00`,
    endAt: `${endDate}T23:59:59.999+09:00`,
    endExclusiveAt: `${today}T00:00:00.000+09:00`,
    timezone: KST_TIME_ZONE,
    windowDays: days,
    windowHours: null,
    isRolling: false,
    basis: "payment_complete_time",
  };
};

const isInDateRange = (date: string, range: DateRange) =>
  Boolean(date && date >= range.startDate && date <= range.endDate);

const buildOperationalLedgerChunks = (
  startDate: string,
  endDate: string,
  chunkDays: number,
): OperationalLedgerChunk[] => {
  const chunks: OperationalLedgerChunk[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const candidateEnd = shiftIsoDate(cursor, chunkDays - 1);
    const chunkEnd = candidateEnd > endDate ? endDate : candidateEnd;
    chunks.push({
      startDate: cursor,
      endDate: chunkEnd,
      startAt: `${cursor}T00:00:00.000+09:00`,
      endAt: `${chunkEnd}T23:59:59.999+09:00`,
    });
    cursor = shiftIsoDate(chunkEnd, 1);
  }
  return chunks;
};

const toObject = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const firstString = (value: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
};

const firstPositiveNumber = (values: unknown[]) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const urlParam = (value: unknown, key: string) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    return new URL(raw, "https://biocom.kr").searchParams.get(key)?.trim() ?? "";
  } catch {
    return "";
  }
};

const getGoogleAdsErrorRoot = (parsed: unknown): Record<string, unknown> => {
  if (!isRecord(parsed)) return {};
  if (isRecord(parsed.error)) return parsed.error;
  if (isRecord(parsed.partialFailureError)) return parsed.partialFailureError;
  return parsed;
};

const getGoogleAdsFailureErrors = (root: Record<string, unknown>) => {
  const details = Array.isArray(root.details) ? root.details : [];
  const failure = details.find((detail) => isRecord(detail) && Array.isArray(detail.errors));
  const requestDetail = details.find((detail) => isRecord(detail) && typeof detail.requestId === "string");
  const failureErrors = isRecord(failure) && Array.isArray(failure.errors) ? failure.errors : [];

  return {
    requestDetail,
    failureErrors,
  };
};

const summarizeGoogleAdsError = (text: string): GoogleAdsErrorSummary => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const root = getGoogleAdsErrorRoot(parsed);
    if (!isRecord(root)) return { rawPreview: text.slice(0, 800) };

    const { requestDetail, failureErrors } = getGoogleAdsFailureErrors(root);

    return {
      code: toOptionalNumber(root.code) ?? undefined,
      status: toStringValue(root.status) || undefined,
      message: toStringValue(root.message) || undefined,
      requestId: isRecord(requestDetail) ? toStringValue(requestDetail.requestId) : null,
      googleAdsErrors: failureErrors
        .filter(isRecord)
        .map((error) => {
          const location = isRecord(error.location) ? error.location : {};
          const elements = Array.isArray(location.fieldPathElements)
            ? location.fieldPathElements
            : [];
          const pathElements = elements.filter(isRecord).map((element) => {
            const fieldName = toStringValue(element.fieldName);
            const index = toOptionalNumber(element.index);
            return {
              fieldName,
              index,
              formatted: fieldName
                ? `${fieldName}${index != null ? `[${index}]` : ""}`
                : "",
            };
          });
          const index = pathElements.find((element) => element.index != null)?.index ?? null;
          return {
            errorCode: error.errorCode,
            message: toStringValue(error.message),
            fieldPath: pathElements
              .map((element) => element.formatted)
              .filter(Boolean)
              .join(".") || null,
            index,
          };
        }),
    };
  } catch {
    return { rawPreview: text.slice(0, 800) };
  }
};

const parseServiceAccountCredentials = () => {
  const raw = env.GSC_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("Google service account key is not configured");
  }

  const credentials = JSON.parse(raw) as Record<string, unknown>;
  return {
    credentials,
    clientEmail: toStringValue(credentials.client_email) || null,
    projectId: toStringValue(credentials.project_id) || null,
  };
};

const createGoogleAdsServiceAccountAccessToken = async () => {
  const { credentials, clientEmail, projectId } = parseServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [GOOGLE_ADS_SCOPE],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error("Failed to obtain Google Ads OAuth access token");
  }

  return {
    token,
    authMode: "service_account" as const,
    clientEmail,
    projectId,
    oauthClientIdPresent: false,
  };
};

const createGoogleAdsUserOAuthAccessToken = async () => {
  if (!env.GOOGLE_ADS_OAUTH_CLIENT_ID || !env.GOOGLE_ADS_OAUTH_CLIENT_SECRET) {
    throw new Error("Google Ads OAuth client ID/secret is not configured");
  }
  if (!env.GOOGLE_ADS_OAUTH_REFRESH_TOKEN) {
    throw new Error("Google Ads OAuth refresh token is not configured");
  }

  const oauthClient = new google.auth.OAuth2(
    env.GOOGLE_ADS_OAUTH_CLIENT_ID,
    env.GOOGLE_ADS_OAUTH_CLIENT_SECRET,
  );
  oauthClient.setCredentials({
    refresh_token: env.GOOGLE_ADS_OAUTH_REFRESH_TOKEN,
  });
  const accessToken = await oauthClient.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error("Failed to obtain Google Ads user OAuth access token");
  }

  return {
    token,
    authMode: "user_oauth" as const,
    clientEmail: null,
    projectId: null,
    oauthClientIdPresent: true,
  };
};

const createGoogleAdsContext = async (customerIdInput: unknown): Promise<GoogleAdsClientContext> => {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("Google Ads developer token is not configured");
  }

  const authContext = env.GOOGLE_ADS_AUTH_MODE === "user_oauth"
    ? await createGoogleAdsUserOAuthAccessToken()
    : await createGoogleAdsServiceAccountAccessToken();

  return {
    token: authContext.token,
    customerId: normalizeCustomerId(customerIdInput),
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      ? env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "")
      : null,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
    developerToken,
    authMode: authContext.authMode,
    clientEmail: authContext.clientEmail,
    projectId: authContext.projectId,
    oauthClientIdPresent: authContext.oauthClientIdPresent,
  };
};

const googleAdsSearch = async (
  context: GoogleAdsClientContext,
  query: string,
): Promise<GoogleAdsSearchResult> => {
  const url = `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}/googleAds:search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      "developer-token": context.developerToken,
      ...(context.loginCustomerId ? { "login-customer-id": context.loginCustomerId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: summarizeGoogleAdsError(text),
    };
  }
  return {
    ok: true,
    status: response.status,
    body: JSON.parse(text) as GoogleAdsSearchResponse,
  };
};

const emptyTotals = (): MetricTotals => ({
  cost: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversionValue: 0,
  allConversions: 0,
  allConversionValue: 0,
  viewThroughConversions: 0,
});

const addMetrics = (target: MetricTotals, source: MetricTotals) => {
  target.cost += source.cost;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
  target.conversions += source.conversions;
  target.conversionValue += source.conversionValue;
  target.allConversions += source.allConversions;
  target.allConversionValue += source.allConversionValue;
  target.viewThroughConversions += source.viewThroughConversions;
};

const parseMetrics = (row: Record<string, unknown>): MetricTotals => {
  const metrics = isRecord(row.metrics) ? row.metrics : {};
  return {
    cost: toNumber(metrics.costMicros) / 1_000_000,
    impressions: toNumber(metrics.impressions),
    clicks: toNumber(metrics.clicks),
    conversions: toNumber(metrics.conversions),
    conversionValue: toNumber(metrics.conversionsValue),
    allConversions: toNumber(metrics.allConversions),
    allConversionValue: toNumber(metrics.allConversionsValue),
    viewThroughConversions: toNumber(metrics.viewThroughConversions),
  };
};

const withDerivedMetrics = <T extends MetricTotals>(row: T): T & {
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
} => ({
  ...row,
  roas: row.cost > 0 ? row.conversionValue / row.cost : null,
  ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
  cvr: row.clicks > 0 ? row.conversions / row.clicks : null,
});

const extractSendTo = (snippet: string) => {
  const matches = snippet.match(/AW-\d+\/[A-Za-z0-9_-]+/g) ?? [];
  return [...new Set(matches)];
};

const normalizeConversionAction = (row: unknown): ConversionActionRow | null => {
  if (!isRecord(row) || !isRecord(row.conversionAction)) return null;
  const action = row.conversionAction;
  const tagSnippets = Array.isArray(action.tagSnippets) ? action.tagSnippets : [];
  const sendTo = tagSnippets
    .filter(isRecord)
    .flatMap((snippet) => [
      ...extractSendTo(toStringValue(snippet.eventSnippet)),
      ...extractSendTo(toStringValue(snippet.globalSiteTag)),
    ]);
  const uniqueSendTo = [...new Set(sendTo)];
  const labels = uniqueSendTo
    .map((value) => value.split("/")[1])
    .filter(Boolean);
  const conversionIds = uniqueSendTo
    .map((value) => value.split("/")[0]?.replace("AW-", ""))
    .filter(Boolean);
  const valueSettings = isRecord(action.valueSettings) ? action.valueSettings : {};

  return {
    id: toStringValue(action.id),
    name: toStringValue(action.name),
    resourceName: toStringValue(action.resourceName),
    status: toStringValue(action.status),
    type: toStringValue(action.type),
    category: toStringValue(action.category),
    primaryForGoal: action.primaryForGoal === true,
    countingType: toStringValue(action.countingType),
    clickThroughLookbackWindowDays: toOptionalNumber(action.clickThroughLookbackWindowDays),
    viewThroughLookbackWindowDays: toOptionalNumber(action.viewThroughLookbackWindowDays),
    defaultValue: toOptionalNumber(valueSettings.defaultValue),
    alwaysUseDefaultValue: valueSettings.alwaysUseDefaultValue === true,
    sendTo: uniqueSendTo,
    conversionId: conversionIds[0] ?? null,
    conversionLabels: [...new Set(labels)],
    snippetTypes: [
      ...new Set(tagSnippets
        .filter(isRecord)
        .map((snippet) => toStringValue(snippet.type))
        .filter(Boolean)),
    ],
  };
};

const buildCustomerQuery = () => `
  SELECT
    customer.id,
    customer.descriptive_name,
    customer.manager,
    customer.test_account,
    customer.status
  FROM customer
  LIMIT 1
`;

const buildCustomerTrackingQuery = () => `
  SELECT
    customer.id,
    customer.descriptive_name,
    customer.auto_tagging_enabled
  FROM customer
  LIMIT 1
`;

const buildConversionActionsQuery = (limit: number) => `
  SELECT
    conversion_action.id,
    conversion_action.name,
    conversion_action.status,
    conversion_action.type,
    conversion_action.category,
    conversion_action.primary_for_goal,
    conversion_action.counting_type,
    conversion_action.click_through_lookback_window_days,
    conversion_action.view_through_lookback_window_days,
    conversion_action.value_settings.default_value,
    conversion_action.value_settings.always_use_default_value,
    conversion_action.tag_snippets
  FROM conversion_action
  WHERE conversion_action.status != REMOVED
  ORDER BY conversion_action.category, conversion_action.id
  LIMIT ${limit}
`;

const buildCampaignMetricsQuery = (dateRangeCondition: string, limit: number) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE ${dateRangeCondition}
    AND metrics.cost_micros > 0
  ORDER BY metrics.cost_micros DESC
  LIMIT ${limit}
`;

const buildDailyMetricsQuery = (dateRangeCondition: string) => `
  SELECT
    segments.date,
    campaign.id,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE ${dateRangeCondition}
    AND metrics.cost_micros > 0
  ORDER BY segments.date ASC
  LIMIT 10000
`;

const buildConversionActionMetricsQuery = (dateRangeCondition: string) => `
  SELECT
    segments.conversion_action,
    segments.conversion_action_name,
    campaign.id,
    campaign.name,
    campaign.advertising_channel_type,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE ${dateRangeCondition}
    AND metrics.all_conversions > 0
  ORDER BY metrics.all_conversions_value DESC
  LIMIT 10000
`;

const buildAdFinalUrlAuditQuery = (limit: number) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.tracking_url_template,
    campaign.final_url_suffix,
    ad_group.id,
    ad_group.name,
    ad_group_ad.status,
    ad_group_ad.ad.id,
    ad_group_ad.ad.final_urls,
    ad_group_ad.ad.final_mobile_urls,
    ad_group_ad.ad.tracking_url_template
  FROM ad_group_ad
  WHERE campaign.status != REMOVED
    AND ad_group_ad.status != REMOVED
  ORDER BY campaign.id, ad_group.id, ad_group_ad.ad.id
  LIMIT ${limit}
`;

const buildAssetGroupFinalUrlAuditQuery = (limit: number) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.tracking_url_template,
    campaign.final_url_suffix,
    asset_group.id,
    asset_group.name,
    asset_group.status,
    asset_group.final_urls,
    asset_group.final_mobile_urls
  FROM asset_group
  WHERE campaign.status != REMOVED
    AND asset_group.status != REMOVED
  ORDER BY campaign.id, asset_group.id
  LIMIT ${limit}
`;

const classifyFinalUrlSite = (rawUrl: string): FinalUrlSiteBucket => {
  if (!rawUrl.trim()) return "unknown";
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "biocom.kr" || host.endsWith(".biocom.kr")) return "biocom";
    if (host === "thecleancoffee.com" || host.endsWith(".thecleancoffee.com")) {
      return "thecleancoffee";
    }
    return "other";
  } catch {
    return "unknown";
  }
};

const finalUrlHost = (rawUrl: string): string | null => {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

const otherDispositionMeta: Record<OtherFinalUrlDisposition, {
  label: string;
  interpretation: string;
}> = {
  ignore_external_or_legacy: {
    label: "보관만",
    interpretation:
      "바이오컴/더클린커피 현재 구매 퍼널이 아닌 외부·과거 목적지입니다. ROAS 퍼널 미매핑 원인에서는 제외해도 됩니다.",
  },
  needs_site_mapping: {
    label: "매핑 후보",
    interpretation:
      "브랜드명은 관련 있어 보이지만 현재 사이트 도메인으로 분류되지 않습니다. 과거 한글도메인/별도 랜딩인지 확인해야 합니다.",
  },
  review_wrong_destination: {
    label: "도착지 확인",
    interpretation:
      "현재 바이오컴/더클린커피 캠페인처럼 보이는데 외부 도메인으로 나갑니다. 광고 목적지가 의도한 곳인지 확인해야 합니다.",
  },
  unknown_review: {
    label: "확인 필요",
    interpretation:
      "도메인을 안정적으로 해석하지 못했습니다. URL 원문은 Google Ads UI에서 확인해야 합니다.",
  },
};

const classifyOtherFinalUrlDisposition = (input: {
  site: FinalUrlSiteBucket;
  hosts: string[];
  campaignName: string;
  parentName: string | null;
  campaignStatus: string;
}): {
  disposition?: OtherFinalUrlDisposition;
  label?: string;
  reason?: string;
} => {
  if (input.site !== "other") return {};
  const text = [input.campaignName, input.parentName ?? "", ...input.hosts]
    .join(" ")
    .toLowerCase();
  const hasCoffeeIntent =
    /더클린커피|theclean|clean coffee|xn--9m1bq4jj2txnb6yk/.test(text);
  const hasBiocomIntent = /바이오컴|biocom/.test(text);
  const hosts = input.hosts.join(", ") || "host 없음";

  if (hasCoffeeIntent && /xn--9m1bq4jj2txnb6yk\.com/.test(text)) {
    return {
      disposition: "needs_site_mapping",
      label: otherDispositionMeta.needs_site_mapping.label,
      reason:
        `더클린커피 과거 한글도메인으로 보이는 ${hosts}입니다. 현재 thecleancoffee.com 퍼널과 별도라 Google 유료 ROAS에는 자동 포함하지 않습니다.`,
    };
  }

  if (hasCoffeeIntent && !input.hosts.some((host) => host.includes("thecleancoffee.com"))) {
    return {
      disposition: "review_wrong_destination",
      label: otherDispositionMeta.review_wrong_destination.label,
      reason: `더클린커피 의도가 보이지만 도착지는 ${hosts}입니다.`,
    };
  }

  if (hasBiocomIntent && !input.hosts.some((host) => host.includes("biocom.kr"))) {
    return {
      disposition: "ignore_external_or_legacy",
      label: otherDispositionMeta.ignore_external_or_legacy.label,
      reason: `${hosts}는 biocompet/Naver 등 현재 바이오컴·더클린커피 구매 퍼널 밖 도메인입니다.`,
    };
  }

  if (input.hosts.some((host) => /naver\.com|post\.naver\.com|blog\.naver\.com/.test(host))) {
    return {
      disposition: "ignore_external_or_legacy",
      label: otherDispositionMeta.ignore_external_or_legacy.label,
      reason: `${hosts}는 네이버 콘텐츠 랜딩입니다. 현재 VM Cloud 구매 퍼널 URL이 아니므로 보관만 합니다.`,
    };
  }

  if (input.hosts.length > 0) {
    return {
      disposition: "ignore_external_or_legacy",
      label: otherDispositionMeta.ignore_external_or_legacy.label,
      reason: `${hosts}는 현재 추적 대상 사이트가 아닌 외부 URL입니다.`,
    };
  }

  return {
    disposition: "unknown_review",
    label: otherDispositionMeta.unknown_review.label,
    reason: "최종 URL host를 읽지 못했습니다.",
  };
};

const redactUrlQueryValues = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const keys = [...url.searchParams.keys()];
    url.search = "";
    keys.forEach((key) => url.searchParams.set(key, "{set}"));
    return url.toString();
  } catch {
    return rawUrl.replace(/=([^&#]*)/g, "={set}");
  }
};

const queryKeysFromUrlLike = (value: string): string[] => {
  const raw = value.trim();
  if (!raw) return [];
  const collect = (params: URLSearchParams) => [...new Set([...params.keys()].filter(Boolean))].sort();
  try {
    return collect(new URL(raw).searchParams);
  } catch {
    const query = raw.includes("?") ? raw.split("?").slice(1).join("?") : raw;
    if (!query.includes("=")) return [];
    try {
      return collect(new URLSearchParams(query.replace(/^\?/, "")));
    } catch {
      return [];
    }
  }
};

const mergeUniqueSorted = (...groups: string[][]) =>
  [...new Set(groups.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b));

const hasAnyKey = (keys: string[], candidates: string[]) => {
  const normalized = new Set(keys.map((key) => key.toLowerCase()));
  return candidates.some((candidate) => normalized.has(candidate.toLowerCase()));
};

const normalizeFinalUrlAuditCommon = (row: Record<string, unknown>) => {
  const campaign = isRecord(row.campaign) ? row.campaign : {};
  const campaignTrackingTemplate = toStringValue(campaign.trackingUrlTemplate);
  const campaignFinalUrlSuffix = toStringValue(campaign.finalUrlSuffix);

  return {
    campaignId: toStringValue(campaign.id),
    campaignName: toStringValue(campaign.name),
    campaignStatus: toStringValue(campaign.status),
    channel: toStringValue(campaign.advertisingChannelType),
    campaignTrackingTemplate,
    campaignFinalUrlSuffix,
    campaignTrackingKeys: queryKeysFromUrlLike(campaignTrackingTemplate),
    campaignFinalSuffixKeys: queryKeysFromUrlLike(campaignFinalUrlSuffix),
  };
};

const buildFinalUrlAuditRow = (input: {
  level: GoogleAdsFinalUrlAuditRow["level"];
  common: ReturnType<typeof normalizeFinalUrlAuditCommon>;
  parentId: string | null;
  parentName: string | null;
  entityId: string;
  entityStatus: string;
  finalUrls: string[];
  finalMobileUrls: string[];
  entityTrackingTemplate?: string;
}): GoogleAdsFinalUrlAuditRow => {
  const allFinalUrls = [...input.finalUrls, ...input.finalMobileUrls];
  const site = allFinalUrls.map(classifyFinalUrlSite).find((bucket) => bucket !== "unknown") ?? "unknown";
  const hosts = mergeUniqueSorted(allFinalUrls.map(finalUrlHost).filter(Boolean) as string[]);
  const finalUrlKeys = mergeUniqueSorted(...allFinalUrls.map(queryKeysFromUrlLike));
  const trackingTemplate = input.entityTrackingTemplate ?? "";
  const trackingTemplateKeys = mergeUniqueSorted(
    queryKeysFromUrlLike(trackingTemplate),
    input.common.campaignTrackingKeys,
  );
  const finalUrlSuffixKeys = input.common.campaignFinalSuffixKeys;
  const queryKeys = mergeUniqueSorted(finalUrlKeys, trackingTemplateKeys, finalUrlSuffixKeys);
  const hasUtmSource = hasAnyKey(queryKeys, ["utm_source"]);
  const hasUtmMedium = hasAnyKey(queryKeys, ["utm_medium"]);
  const hasUtmCampaign = hasAnyKey(queryKeys, ["utm_campaign"]);
  const hasGoogleClickParam = hasAnyKey(queryKeys, ["gclid", "gbraid", "wbraid"])
    || [trackingTemplate, input.common.campaignTrackingTemplate, input.common.campaignFinalUrlSuffix]
      .some((raw) => /\{(?:gclid|gbraid|wbraid)\}/i.test(raw));
  const hasTrackingTemplate = Boolean(trackingTemplate.trim() || input.common.campaignTrackingTemplate.trim());
  const hasFinalUrlSuffix = Boolean(input.common.campaignFinalUrlSuffix.trim());
  const manualUtmPresent = hasUtmSource && hasUtmMedium;
  const otherDisposition = classifyOtherFinalUrlDisposition({
    site,
    hosts,
    campaignName: input.common.campaignName,
    parentName: input.parentName,
    campaignStatus: input.common.campaignStatus,
  });

  return {
    level: input.level,
    site,
    hosts,
    campaignId: input.common.campaignId,
    campaignName: input.common.campaignName,
    campaignStatus: input.common.campaignStatus,
    channel: input.common.channel,
    parentId: input.parentId,
    parentName: input.parentName,
    entityId: input.entityId,
    entityStatus: input.entityStatus,
    finalUrlCount: allFinalUrls.length,
    sampleUrls: allFinalUrls.slice(0, 3).map(redactUrlQueryValues),
    queryKeys,
    hasUtmSource,
    hasUtmMedium,
    hasUtmCampaign,
    hasGoogleClickParam,
    hasTrackingTemplate,
    hasFinalUrlSuffix,
    trackingTemplateKeys,
    finalUrlSuffixKeys,
    readiness: allFinalUrls.length === 0
      ? "no_final_url"
      : manualUtmPresent
        ? "manual_utm_present"
        : hasGoogleClickParam || hasTrackingTemplate || hasFinalUrlSuffix
          ? "auto_tagging_only"
          : "tracking_gap",
    otherUrlDisposition: otherDisposition.disposition,
    otherUrlDispositionLabel: otherDisposition.label,
    otherUrlDispositionReason: otherDisposition.reason,
  };
};

const parseAdFinalUrlAuditRows = (results: unknown[]): GoogleAdsFinalUrlAuditRow[] =>
  results.filter(isRecord).map((row) => {
    const common = normalizeFinalUrlAuditCommon(row);
    const adGroup = isRecord(row.adGroup) ? row.adGroup : {};
    const adGroupAd = isRecord(row.adGroupAd) ? row.adGroupAd : {};
    const ad = isRecord(adGroupAd.ad) ? adGroupAd.ad : {};

    return buildFinalUrlAuditRow({
      level: "ad",
      common,
      parentId: toStringValue(adGroup.id) || null,
      parentName: toStringValue(adGroup.name) || null,
      entityId: toStringValue(ad.id),
      entityStatus: toStringValue(adGroupAd.status),
      finalUrls: toStringArray(ad.finalUrls),
      finalMobileUrls: toStringArray(ad.finalMobileUrls),
      entityTrackingTemplate: toStringValue(ad.trackingUrlTemplate),
    });
  });

const parseAssetGroupFinalUrlAuditRows = (results: unknown[]): GoogleAdsFinalUrlAuditRow[] =>
  results.filter(isRecord).map((row) => {
    const common = normalizeFinalUrlAuditCommon(row);
    const assetGroup = isRecord(row.assetGroup) ? row.assetGroup : {};

    return buildFinalUrlAuditRow({
      level: "asset_group",
      common,
      parentId: null,
      parentName: null,
      entityId: toStringValue(assetGroup.id),
      entityStatus: toStringValue(assetGroup.status),
      finalUrls: toStringArray(assetGroup.finalUrls),
      finalMobileUrls: toStringArray(assetGroup.finalMobileUrls),
    });
  });

const summarizeFinalUrlAuditRows = (
  rows: GoogleAdsFinalUrlAuditRow[],
  autoTaggingEnabled: boolean | null,
): GoogleAdsFinalUrlSiteSummary[] => {
  const labels: Record<FinalUrlSiteBucket, string> = {
    biocom: "바이오컴",
    thecleancoffee: "더클린커피",
    other: "기타 도메인",
    unknown: "URL 없음/미확인",
  };
  const buckets: FinalUrlSiteBucket[] = ["biocom", "thecleancoffee", "other", "unknown"];

  return buckets.map((site) => {
    const siteRows = rows.filter((row) => row.site === site);
    const manualUtmRows = siteRows.filter((row) => row.hasUtmSource && row.hasUtmMedium).length;
    const googleClickParamRows = siteRows.filter((row) => row.hasGoogleClickParam).length;
    const trackingTemplateRows = siteRows.filter((row) => row.hasTrackingTemplate).length;
    const finalUrlSuffixRows = siteRows.filter((row) => row.hasFinalUrlSuffix).length;
    const finalUrls = siteRows.reduce((sum, row) => sum + row.finalUrlCount, 0);
    let readiness: GoogleAdsFinalUrlSiteSummary["readiness"] = "not_found";
    let interpretation = `${labels[site]} 최종 URL row가 이 광고 계정에서 보이지 않습니다.`;

    if (siteRows.length > 0 && finalUrls === 0) {
      readiness = "not_found";
      interpretation = `${labels[site]} row는 있으나 최종 URL 값이 비어 있습니다. Google 유료 유입 분류에는 사용할 수 없습니다.`;
    } else if (siteRows.length > 0 && manualUtmRows > 0) {
      readiness = "ok";
      interpretation = "수동 UTM이 있는 최종 URL이 있습니다. VM Cloud가 landing query를 보존하면 Google 유료 bucket으로 분류할 수 있습니다.";
    } else if (siteRows.length > 0 && (autoTaggingEnabled || googleClickParamRows > 0 || trackingTemplateRows > 0 || finalUrlSuffixRows > 0)) {
      readiness = "verify_click_id_capture";
      interpretation = "최종 URL은 있으나 수동 UTM은 부족합니다. Google 자동 태깅(gclid/gbraid/wbraid)이 실제 랜딩에서 살아남는지 VM Cloud landing row로 확인해야 합니다.";
    } else if (siteRows.length > 0) {
      readiness = "gap";
      interpretation = "최종 URL은 있지만 Google 유료를 구분할 UTM/클릭 ID 단서가 보이지 않습니다. 최종 URL suffix 또는 tracking template 보강이 필요합니다.";
    }

    return {
      site,
      label: labels[site],
      rows: siteRows.length,
      finalUrls,
      manualUtmRows,
      googleClickParamRows,
      trackingTemplateRows,
      finalUrlSuffixRows,
      readiness,
      interpretation,
    };
  });
};

const labelForSite = (site: "biocom" | "thecleancoffee") =>
  site === "biocom" ? "바이오컴" : "더클린커피";

const googleEvidenceSegmentMeta = {
  google_ads_paid: {
    label: "Google Ads 유료",
    confidence: "high",
    interpretation: "gclid/gbraid/wbraid 또는 Google source + paid/cpc 단서가 있어 Google Ads 유료로 볼 수 있습니다.",
  },
  google_organic: {
    label: "Google 자연검색",
    confidence: "medium",
    interpretation: "Google referrer/source가 있으나 유료 클릭 ID나 paid/cpc 단서가 없어 자연검색 후보입니다.",
  },
  google_unknown: {
    label: "Google 판정 불가",
    confidence: "low",
    interpretation: "Google 단서는 있으나 유료/자연검색을 가르는 필드가 부족합니다.",
  },
  not_google_paid_search: {
    label: "Google 아님: 다른 매체 paid_search",
    confidence: "high",
    interpretation: "paid_search로 분류됐지만 source가 Google이 아니므로 Google 유입으로 세면 안 됩니다.",
  },
} as const;

const normalizeHost = (raw: string): string => {
  try {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    }
    return raw.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const hostLooksGoogle = (host: string): boolean =>
  host === "google.com" || host.endsWith(".google.com") || host.startsWith("google.");

const emptyLandingClickIdAudit = (
  site: "biocom" | "thecleancoffee",
  windowDays: number,
  captureStatus: GoogleAdsLandingClickIdAudit["captureStatus"],
  interpretation: string,
): GoogleAdsLandingClickIdAudit => ({
  site,
  label: labelForSite(site),
  windowDays,
  totalLandingRows: 0,
  googleClickIdRows: 0,
  googleClickIdRowsByType: {
    gclid: 0,
    gbraid: 0,
    wbraid: 0,
  },
  googleUtmRows: 0,
  googleChannelRows: 0,
  googleEvidenceRows: 0,
  nonGooglePaidSearchRows: 0,
  googleEvidenceBreakdown: Object.entries(googleEvidenceSegmentMeta).map(([segment, meta]) => ({
    segment: segment as keyof typeof googleEvidenceSegmentMeta,
    label: meta.label,
    rows: 0,
    confidence: meta.confidence,
    interpretation: meta.interpretation,
  })),
  latestLandingAt: null,
  topLandingPaths: [],
  captureStatus,
  interpretation,
});

const buildLandingClickIdAudits = (windowDays = 7): GoogleAdsLandingClickIdAudit[] => {
  const sites: Array<"biocom" | "thecleancoffee"> = ["biocom", "thecleancoffee"];
  try {
    const db = getCrmDb();
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE name = ?")
      .get("site_landing_ledger");

    if (!table) {
      return sites.map((site) => emptyLandingClickIdAudit(
        site,
        windowDays,
        "table_unavailable",
        "VM Cloud landing 원장 테이블을 찾지 못했습니다. Google 클릭 ID 보존 여부를 이 API에서 확인할 수 없습니다.",
      ));
    }

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`
      SELECT
        site,
        landed_at,
        click_id_type,
        landing_url,
        referrer_host,
        referrer_full_url,
        utm_source,
        utm_medium,
        channel_classified,
        source_breakdown,
        landing_path
      FROM site_landing_ledger
      WHERE site = ? AND landed_at >= ?
    `);

    return sites.map((site) => {
      const rows = stmt.all(site, since).filter(isRecord);
      const typeCounts = {
        gclid: 0,
        gbraid: 0,
        wbraid: 0,
      };
      const pathCounts = new Map<string, { path: string; rows: number; googleEvidenceRows: number }>();
      let latestLandingAt: string | null = null;
      let googleClickIdRows = 0;
      let clickIdUrlRows = 0;
      let googleUtmRows = 0;
      let googleChannelRows = 0;
      let googleEvidenceRows = 0;
      let nonGooglePaidSearchRows = 0;
      const evidenceBreakdown = {
        google_ads_paid: 0,
        google_organic: 0,
        google_unknown: 0,
        not_google_paid_search: 0,
      };

      rows.forEach((row) => {
        const clickIdType = toStringValue(row.click_id_type).toLowerCase();
        const landingUrl = toStringValue(row.landing_url);
        const referrerHost = normalizeHost(
          toStringValue(row.referrer_host) || toStringValue(row.referrer_full_url),
        );
        const utmSource = toStringValue(row.utm_source).toLowerCase();
        const utmMedium = toStringValue(row.utm_medium).toLowerCase();
        const channelClassified = toStringValue(row.channel_classified).toLowerCase();
        const sourceBreakdown = toStringValue(row.source_breakdown).toLowerCase();
        const landedAt = toStringValue(row.landed_at);
        const path = toStringValue(row.landing_path) || "/";

        if (landedAt && (!latestLandingAt || landedAt > latestLandingAt)) {
          latestLandingAt = landedAt;
        }
        if (clickIdType === "gclid" || clickIdType === "gbraid" || clickIdType === "wbraid") {
          typeCounts[clickIdType] += 1;
        }
        const hasClickIdInUrl = /[?&](gclid|gbraid|wbraid)=/i.test(landingUrl);
        const hasClickIdRow =
          hasClickIdInUrl
          || clickIdType === "gclid"
          || clickIdType === "gbraid"
          || clickIdType === "wbraid";
        const hasGoogleReferrer = hostLooksGoogle(referrerHost);
        const hasPaidMarker =
          ["cpc", "ppc", "paid", "paid_search", "sem"].includes(utmMedium)
          || utmMedium.includes("cpc")
          || channelClassified.includes("paid_search")
          || sourceBreakdown.includes("google_ads")
          || sourceBreakdown.includes("googleads")
          || sourceBreakdown.includes("adwords");
        const hasOrganicMarker =
          utmMedium.includes("organic")
          || channelClassified.includes("organic")
          || sourceBreakdown.includes("organic")
          || hasGoogleReferrer;
        const hasGoogleUtm =
          utmSource.includes("google")
          || (sourceBreakdown.includes("google") && (hasPaidMarker || hasOrganicMarker));
        const hasGoogleChannel =
          channelClassified.includes("google")
          || sourceBreakdown.includes("google")
          || hasGoogleReferrer;
        const hasGoogleEvidence = hasClickIdRow || hasGoogleUtm || hasGoogleChannel;
        const isNonGooglePaidSearch =
          !hasGoogleEvidence
          && channelClassified.includes("paid_search")
          && Boolean(sourceBreakdown || utmSource || utmMedium);

        if (hasClickIdRow) googleClickIdRows += 1;
        if (hasClickIdInUrl) clickIdUrlRows += 1;
        if (hasGoogleUtm) googleUtmRows += 1;
        if (hasGoogleChannel) googleChannelRows += 1;
        if (hasGoogleEvidence) {
          googleEvidenceRows += 1;
          if (hasClickIdRow || hasPaidMarker) {
            evidenceBreakdown.google_ads_paid += 1;
          } else if (hasOrganicMarker) {
            evidenceBreakdown.google_organic += 1;
          } else {
            evidenceBreakdown.google_unknown += 1;
          }
        } else if (isNonGooglePaidSearch) {
          nonGooglePaidSearchRows += 1;
          evidenceBreakdown.not_google_paid_search += 1;
        }

        const current = pathCounts.get(path) ?? { path, rows: 0, googleEvidenceRows: 0 };
        current.rows += 1;
        if (hasGoogleEvidence) {
          current.googleEvidenceRows += 1;
        }
        pathCounts.set(path, current);
      });

      let captureStatus: GoogleAdsLandingClickIdAudit["captureStatus"] = "no_landing_rows";
      let interpretation = `${labelForSite(site)} landing row가 최근 ${windowDays}일에 없습니다.`;
      if (rows.length > 0 && googleClickIdRows > 0) {
        captureStatus = "google_click_id_present";
        interpretation = `최근 ${windowDays}일 landing row에서 gclid/gbraid/wbraid가 확인됩니다. Google Ads 자동 태깅 값이 VM Cloud까지 살아남고 있습니다.`;
      } else if (rows.length > 0 && (googleUtmRows > 0 || googleChannelRows > 0)) {
        captureStatus = "google_channel_without_click_id";
        interpretation = `Google 계열 유입 단서는 있으나 gclid/gbraid/wbraid는 0건입니다. 광고 클릭 ID가 리다이렉트나 수집 코드에서 소실되는지 확인해야 합니다.`;
      } else if (rows.length > 0 && nonGooglePaidSearchRows > 0) {
        captureStatus = "not_google_paid_search";
        interpretation = `최근 ${windowDays}일 paid_search row ${nonGooglePaidSearchRows}건은 Google이 아니라 다른 매체 source입니다. Google 유입으로 세면 안 됩니다.`;
      } else if (rows.length > 0) {
        captureStatus = "landing_rows_present_no_google_evidence";
        interpretation = `landing row는 있으나 Google 유료를 확인할 UTM/클릭 ID 단서가 없습니다.`;
      }

      return {
        site,
        label: labelForSite(site),
        windowDays,
        totalLandingRows: rows.length,
        googleClickIdRows,
        googleClickIdRowsByType: typeCounts,
        googleUtmRows,
        googleChannelRows,
        googleEvidenceRows,
        nonGooglePaidSearchRows,
        googleEvidenceBreakdown: Object.entries(googleEvidenceSegmentMeta).map(([segment, meta]) => ({
          segment: segment as keyof typeof googleEvidenceSegmentMeta,
          label: meta.label,
          rows: evidenceBreakdown[segment as keyof typeof evidenceBreakdown],
          confidence: meta.confidence,
          interpretation: meta.interpretation,
        })),
        latestLandingAt,
        topLandingPaths: [...pathCounts.values()]
          .sort((a, b) => (b.googleEvidenceRows - a.googleEvidenceRows) || (b.rows - a.rows))
          .slice(0, 8),
        captureStatus,
        interpretation,
      };
    });
  } catch (error) {
    return sites.map((site) => emptyLandingClickIdAudit(
      site,
      windowDays,
      "table_unavailable",
      `VM Cloud landing 원장 조회에 실패했습니다: ${error instanceof Error ? error.message : "unknown error"}`,
    ));
  }
};

const summarizeOtherFinalUrls = (rows: GoogleAdsFinalUrlAuditRow[]): OtherFinalUrlSummary => {
  const otherRows = rows.filter((row) => row.site === "other");
  const dispositions: OtherFinalUrlDisposition[] = [
    "ignore_external_or_legacy",
    "needs_site_mapping",
    "review_wrong_destination",
    "unknown_review",
  ];
  const dispositionSummary = dispositions.map((disposition) => {
    const dispositionRows = otherRows.filter((row) => row.otherUrlDisposition === disposition);
    return {
      disposition,
      label: otherDispositionMeta[disposition].label,
      rows: dispositionRows.length,
      finalUrls: dispositionRows.reduce((sum, row) => sum + row.finalUrlCount, 0),
      interpretation: otherDispositionMeta[disposition].interpretation,
    };
  });
  const reviewRows = otherRows
    .filter((row) => row.otherUrlDisposition !== "ignore_external_or_legacy")
    .concat(otherRows.filter((row) => row.otherUrlDisposition === "ignore_external_or_legacy"))
    .slice(0, 10);

  return {
    totalRows: otherRows.length,
    finalUrls: otherRows.reduce((sum, row) => sum + row.finalUrlCount, 0),
    dispositionSummary,
    samples: reviewRows.map((row) => ({
      campaignName: row.campaignName,
      campaignStatus: row.campaignStatus,
      channel: row.channel,
      parentName: row.parentName,
      entityStatus: row.entityStatus,
      hosts: row.hosts,
      sampleUrls: row.sampleUrls,
      disposition: row.otherUrlDisposition ?? "unknown_review",
      dispositionLabel: row.otherUrlDispositionLabel ?? otherDispositionMeta.unknown_review.label,
      reason: row.otherUrlDispositionReason ?? "분류 근거 없음",
    })),
    interpretation:
      "기타 도메인은 현재 바이오컴/더클린커피 구매 퍼널 집계에 자동 포함하지 않습니다. 매핑 후보 또는 도착지 확인 row만 운영자가 검토하면 됩니다.",
  };
};

const isEnabledGoogleAdsRow = (row: GoogleAdsFinalUrlAuditRow): boolean => {
  const campaignStatus = row.campaignStatus.toUpperCase();
  const entityStatus = row.entityStatus.toUpperCase();
  return campaignStatus === "ENABLED" && entityStatus === "ENABLED";
};

const isPausedOrRemovedGoogleAdsRow = (row: GoogleAdsFinalUrlAuditRow): boolean => {
  const statuses = [row.campaignStatus, row.entityStatus].map((status) => status.toUpperCase());
  return statuses.some((status) => status === "PAUSED" || status === "REMOVED");
};

const rowLooksRelatedToSite = (
  row: GoogleAdsFinalUrlAuditRow,
  site: "biocom" | "thecleancoffee",
): boolean => {
  const haystack = [
    row.campaignName,
    row.parentName ?? "",
    row.hosts.join(" "),
    row.sampleUrls.join(" "),
  ].join(" ").toLowerCase();
  if (site === "thecleancoffee") {
    return /더클린|theclean|clean\s*coffee|xn--9m1bq4jj2txnb6yk/.test(haystack);
  }
  return /바이오컴|biocom|aibio|ainative|biocom\.kr/.test(haystack);
};

const statusLabelKo = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "ENABLED") return "활성";
  if (normalized === "PAUSED") return "일시중지";
  if (normalized === "REMOVED") return "삭제";
  return status || "상태 없음";
};

const buildGoogleAdsTrafficRouteAudits = ({
  rows,
  siteSummary,
  landingClickIdAudit,
  autoTaggingEnabled,
}: {
  rows: GoogleAdsFinalUrlAuditRow[];
  siteSummary: GoogleAdsFinalUrlSiteSummary[];
  landingClickIdAudit: GoogleAdsLandingClickIdAudit[];
  autoTaggingEnabled: boolean | null;
}): GoogleAdsTrafficRouteAudit[] => {
  const sites: Array<"biocom" | "thecleancoffee"> = ["biocom", "thecleancoffee"];

  return sites.map((site) => {
    const label = labelForSite(site);
    const topicLabel = site === "thecleancoffee" ? `${label}는` : `${label}은`;
    const currentRows = rows.filter((row) => row.site === site);
    const enabledRows = currentRows.filter(isEnabledGoogleAdsRow).length;
    const pausedOrRemovedRows = currentRows.filter(isPausedOrRemovedGoogleAdsRow).length;
    const legacyRows = rows.filter((row) => row.site === "other" && rowLooksRelatedToSite(row, site));
    const legacyNeedsMappingRows = legacyRows.filter((row) => row.otherUrlDisposition === "needs_site_mapping").length;
    const summary = siteSummary.find((row) => row.site === site);
    const landing = landingClickIdAudit.find((row) => row.site === site) ?? emptyLandingClickIdAudit(
      site,
      7,
      "table_unavailable",
      "VM Cloud landing 원장 응답이 없어 실제 유입 증거를 확인하지 못했습니다.",
    );
    const trackingSignalRows =
      (summary?.manualUtmRows ?? 0)
      + (summary?.googleClickParamRows ?? 0)
      + (summary?.trackingTemplateRows ?? 0)
      + (summary?.finalUrlSuffixRows ?? 0);

    const hasLandingGoogleEvidence = landing.googleClickIdRows > 0 || landing.googleEvidenceRows > 0;
    const hasAccountConfig = currentRows.length > 0;
    const hasOnlyPausedOrLegacyConfig =
      !hasLandingGoogleEvidence
      && (pausedOrRemovedRows > 0 || legacyRows.length > 0)
      && enabledRows === 0;

    let decision: GoogleAdsTrafficRouteAudit["decision"] = "no_ads_config_no_landing_evidence";
    let confidence: GoogleAdsTrafficRouteAudit["confidence"] = "medium";
    let interpretation = `${topicLabel} 현재 광고 계정 설정과 VM Cloud landing 원장에서 Google Ads 실제 유입 증거가 모두 보이지 않습니다.`;

    if (landing.captureStatus === "table_unavailable") {
      decision = "landing_table_unavailable";
      confidence = "low";
      interpretation = `${topicLabel} 광고 계정 설정은 확인했지만 VM Cloud landing 원장 조회가 실패해 실제 유입 여부를 닫지 못했습니다.`;
    } else if (hasLandingGoogleEvidence) {
      decision = "actual_google_paid_click_confirmed";
      confidence = "high";
      interpretation = `${topicLabel} 최근 ${landing.windowDays}일 VM Cloud landing 원장에 Google 클릭ID 또는 Google source 증거가 있어 실제 Google 유입이 확인됩니다.`;
    } else if (hasOnlyPausedOrLegacyConfig) {
      decision = "paused_or_legacy_config_only";
      confidence = "high";
      interpretation = `${topicLabel} Google Ads 설정 흔적은 있지만 활성 광고/실제 Google 랜딩 증거가 없습니다. 현재 ROAS에는 Google 유료 유입으로 넣지 않는 것이 맞습니다.`;
    } else if (hasAccountConfig || enabledRows > 0) {
      decision = "ads_config_present_but_no_landing_evidence";
      confidence = enabledRows > 0 ? "medium" : "high";
      interpretation = `${topicLabel} 광고 계정에 최종 URL row가 있지만 최근 ${landing.windowDays}일 VM Cloud에는 Google 클릭ID/Google source가 0건입니다. 설정값만 있고 실제 클릭 증거는 확인되지 않았습니다.`;
    }

    const routeSteps: GoogleAdsTrafficRouteAudit["routeSteps"] = [
      {
        step: "ads_destination",
        label: "1. 광고 계정에 더클린커피/바이오컴 도착 URL이 있는가",
        status: currentRows.length > 0 ? "pass" : legacyRows.length > 0 ? "warn" : "fail",
        evidence: currentRows.length > 0
          ? `현재 도메인 최종 URL row ${currentRows.length}개`
          : legacyRows.length > 0
            ? `관련 과거/기타 도메인 row ${legacyRows.length}개`
            : "관련 최종 URL row 0개",
        interpretation: currentRows.length > 0
          ? "광고 계정 설정에는 해당 사이트로 보내는 URL 흔적이 있습니다."
          : legacyRows.length > 0
            ? "현재 도메인이 아니라 과거 도메인/다른 목적지 흔적만 있습니다."
            : "이 광고 계정에서는 해당 사이트 Google Ads 도착 URL을 찾지 못했습니다.",
      },
      {
        step: "ads_status",
        label: "2. 그 광고가 현재 살아 있는가",
        status: enabledRows > 0 ? "pass" : pausedOrRemovedRows > 0 ? "warn" : "fail",
        evidence: enabledRows > 0
          ? `활성 row ${enabledRows}개`
          : pausedOrRemovedRows > 0
            ? `일시중지/삭제 row ${pausedOrRemovedRows}개`
            : "활성 row 0개",
        interpretation: enabledRows > 0
          ? "현재 클릭이 발생할 수 있는 설정입니다."
          : "현재 계정 설정만으로는 새 Google Ads 클릭이 들어오기 어렵습니다.",
      },
      {
        step: "tracking_parameters",
        label: "3. 광고 클릭 이름표가 붙을 준비가 되어 있는가",
        status: trackingSignalRows > 0 ? "pass" : autoTaggingEnabled ? "warn" : "fail",
        evidence: trackingSignalRows > 0
          ? `UTM/템플릿/suffix/click param row ${trackingSignalRows}개`
          : autoTaggingEnabled
            ? "계정 자동 태깅 ON, URL 자체 UTM/템플릿 row 0개"
            : "자동 태깅/UTM/템플릿 증거 0개",
        interpretation: trackingSignalRows > 0
          ? "URL이나 템플릿에 추적 이름표가 보입니다."
          : "자동 태깅에 의존합니다. 실제 방문 URL에 gclid/gbraid/wbraid가 남는지 VM Cloud로 확인해야 합니다.",
      },
      {
        step: "vm_landing_evidence",
        label: "4. 실제 방문자가 Google 단서를 달고 들어왔는가",
        status: hasLandingGoogleEvidence ? "pass" : landing.totalLandingRows > 0 ? "fail" : "warn",
        evidence: `landing ${landing.totalLandingRows}건 · Google 클릭ID ${landing.googleClickIdRows}건 · Google evidence ${landing.googleEvidenceRows}건 · 다른 매체 paid_search ${landing.nonGooglePaidSearchRows}건`,
        interpretation: hasLandingGoogleEvidence
          ? "실제 방문 원장에 Google 유입 증거가 남았습니다."
          : landing.totalLandingRows > 0
            ? "방문은 있었지만 Google Ads로 볼 수 있는 이름표가 없었습니다."
            : "방문 원장 자체가 없어 유입 여부를 아직 판단할 수 없습니다.",
      },
    ];

    const firstCurrentRow = currentRows[0] ?? null;
    if (firstCurrentRow) {
      routeSteps.push({
        step: "sample_status",
        label: "5. 대표 광고 row 상태",
        status: isEnabledGoogleAdsRow(firstCurrentRow) ? "pass" : "warn",
        evidence: `campaign ${statusLabelKo(firstCurrentRow.campaignStatus)} · entity ${statusLabelKo(firstCurrentRow.entityStatus)} · channel ${firstCurrentRow.channel || "unknown"}`,
        interpretation: "대표 row 기준 상태입니다. 원문 URL 값은 API/화면에 노출하지 않고 도메인/상태만 확인합니다.",
      });
    }

    const nextActions: GoogleAdsTrafficRouteAudit["nextActions"] = hasLandingGoogleEvidence
      ? [
          {
            owner: "Codex",
            action: "Google 유료 cohort를 유지하고 구매/비구매 선행지표를 계속 계산한다.",
            why: "실제 Google 유입 증거가 있으므로 행동 차이 분석 대상으로 삼을 수 있습니다.",
            successCriteria: "Google Ads 유료 cohort의 sample size와 구매율이 화면에 안정적으로 표시됩니다.",
          },
        ]
      : [
          {
            owner: "TJ",
            action: `${label} Google Ads가 실제로 집행 중인지 Google Ads UI에서 캠페인 상태와 날짜 필터를 확인한다.`,
            why: "현재 API 기준으로는 PAUSED/설정 흔적 또는 실제 유입 증거 0으로 보여서, 광고가 꺼져 있으면 코드가 아니라 집행 상태 문제입니다.",
            successCriteria: "활성 캠페인/광고그룹/광고와 현재 도착 URL이 확인되거나, 더클린커피 Google Ads가 현재 집행 중이 아님을 확정합니다.",
          },
          {
            owner: "Codex",
            action: "새 Google 클릭 1건이 생기면 VM Cloud landing row에 gclid/gbraid/wbraid 또는 google source가 남는지 read-only로 재확인한다.",
            why: "광고가 켜져 있는데도 0이면 리다이렉트/아임웹/수집 코드에서 클릭 이름표가 사라지는 문제입니다.",
            successCriteria: "landing 원장에 Google evidence가 1건 이상 생기거나, 소실 위치가 URL/리다이렉트/수집 코드 중 하나로 좁혀집니다.",
          },
        ];

    return {
      site,
      label,
      windowDays: landing.windowDays,
      decision,
      confidence,
      accountEvidence: {
        currentAccountFinalUrlRows: currentRows.length,
        enabledRows,
        pausedOrRemovedRows,
        manualUtmRows: summary?.manualUtmRows ?? 0,
        googleClickParamRows: summary?.googleClickParamRows ?? 0,
        trackingTemplateRows: summary?.trackingTemplateRows ?? 0,
        finalUrlSuffixRows: summary?.finalUrlSuffixRows ?? 0,
        legacyOrOtherRows: legacyRows.length,
        legacyNeedsMappingRows,
      },
      landingEvidence: {
        totalLandingRows: landing.totalLandingRows,
        googleClickIdRows: landing.googleClickIdRows,
        googleEvidenceRows: landing.googleEvidenceRows,
        nonGooglePaidSearchRows: landing.nonGooglePaidSearchRows,
        latestLandingAt: landing.latestLandingAt,
      },
      routeSteps,
      nextActions,
      interpretation,
    };
  });
};

const parseCampaignRows = (results: unknown[]): CampaignMetricRow[] =>
  results
    .filter(isRecord)
    .map((row) => {
      const campaign = isRecord(row.campaign) ? row.campaign : {};
      return {
        campaignId: toStringValue(campaign.id),
        campaignName: toStringValue(campaign.name),
        status: toStringValue(campaign.status),
        channel: toStringValue(campaign.advertisingChannelType),
        ...withDerivedMetrics(parseMetrics(row)),
      };
    });

const parseDailyRows = (results: unknown[]): DailyMetricRow[] => {
  const grouped = new Map<string, MetricTotals>();
  results.filter(isRecord).forEach((row) => {
    const segments = isRecord(row.segments) ? row.segments : {};
    const date = toStringValue(segments.date);
    if (!date) return;
    const current = grouped.get(date) ?? emptyTotals();
    addMetrics(current, parseMetrics(row));
    grouped.set(date, current);
  });

  return [...grouped.entries()]
    .map(([date, totals]) => ({
      date,
      ...withDerivedMetrics(totals),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const conversionActionIdFromResourceName = (resourceName: string) =>
  resourceName.split("/").filter(Boolean).at(-1) ?? null;

const summarizeRows = (rows: CampaignMetricRow[]): MetricTotals & {
  roas: number | null;
  ctr: number | null;
  cvr: number | null;
} => {
  const totals = emptyTotals();
  rows.forEach((row) => addMetrics(totals, row));
  return withDerivedMetrics(totals);
};

const normalizeRemoteLedgerEntry = (value: unknown): AttributionLedgerEntry | null => {
  if (!isRecord(value)) return null;
  const metadata = toObject(value.metadata);
  const requestContext = toObject(value.requestContext);
  const touchpoint = toStringValue(value.touchpoint);
  if (!["payment_success", "checkout_started", "form_submit"].includes(touchpoint)) return null;
  const captureMode = toStringValue(value.captureMode) || "live";
  const paymentStatus = toStringValue(value.paymentStatus);

  return {
    touchpoint: touchpoint as AttributionLedgerEntry["touchpoint"],
    captureMode: ["live", "replay", "smoke"].includes(captureMode)
      ? captureMode as AttributionLedgerEntry["captureMode"]
      : "live",
    paymentStatus: ["confirmed", "pending", "canceled"].includes(paymentStatus)
      ? paymentStatus as AttributionLedgerEntry["paymentStatus"]
      : null,
    loggedAt: toStringValue(value.loggedAt),
    orderId: toStringValue(value.orderId),
    paymentKey: toStringValue(value.paymentKey),
    approvedAt: toStringValue(value.approvedAt),
    checkoutId: toStringValue(value.checkoutId),
    customerKey: toStringValue(value.customerKey),
    landing: toStringValue(value.landing),
    referrer: toStringValue(value.referrer),
    gaSessionId: toStringValue(value.gaSessionId),
    utmSource: toStringValue(value.utmSource),
    utmMedium: toStringValue(value.utmMedium),
    utmCampaign: toStringValue(value.utmCampaign),
    utmTerm: toStringValue(value.utmTerm),
    utmContent: toStringValue(value.utmContent),
    gclid: toStringValue(value.gclid),
    fbclid: toStringValue(value.fbclid),
    ttclid: toStringValue(value.ttclid),
    metadata,
    requestContext: {
      ip: toStringValue(requestContext.ip),
      userAgent: toStringValue(requestContext.userAgent),
      origin: toStringValue(requestContext.origin),
      requestReferer: toStringValue(requestContext.requestReferer),
      method: toStringValue(requestContext.method),
      path: toStringValue(requestContext.path),
    },
  };
};

const loadOperationalLedgerPage = async (
  chunk: OperationalLedgerChunk,
  limit = INTERNAL_LEDGER_LIMIT,
): Promise<OperationalLedgerPage> => {
  const url = new URL("/api/attribution/ledger", env.ATTRIBUTION_OPERATIONAL_BASE_URL);
  url.searchParams.set("source", INTERNAL_LEDGER_SOURCE);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("startAt", chunk.startAt);
  url.searchParams.set("endAt", chunk.endAt);

  let response: globalThis.Response | null = null;
  let text = "";
  let body: unknown = null;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });
      text = await response.text();
      body = JSON.parse(text) as unknown;
      break;
    } catch {
      if (attempt < maxAttempts) {
        await delay(500 * attempt);
        continue;
      }
      const contentType = response?.headers.get("content-type") ?? "";
      throw new Error(
        `Operational attribution ledger returned non-JSON response ` +
        `HTTP ${response?.status ?? "unknown"} content-type=${contentType} url=${url.toString()} ` +
        `preview=${text.slice(0, 120).replace(/\s+/g, " ")}`,
      );
    }
  }

  if (!response) {
    throw new Error("Operational attribution ledger request did not run");
  }
  if (!response.ok || !isRecord(body) || body.ok !== true) {
    throw new Error(`Operational attribution ledger returned HTTP ${response.status}`);
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const entries = rawItems
    .map(normalizeRemoteLedgerEntry)
    .filter((entry): entry is AttributionLedgerEntry => Boolean(entry));
  const summary = toObject(body.summary);
  const itemCount = rawItems.length;
  const totalEntries = toOptionalNumber(summary.totalEntries) ?? itemCount;

  return {
    entries,
    latestLoggedAt: toStringValue(summary.latestLoggedAt),
    itemCount,
    totalEntries,
    truncated: totalEntries > itemCount,
    url: url.toString(),
    chunk,
  };
};

const loadInternalLedgerEntries = async (range: DateRange) => {
  const warnings: string[] = [];
  const loadLocalLedgerEntries = async (extraWarnings: string[] = []) => {
    const localEntries = await readLedgerEntries();
    return {
      dataSource: "local_attribution_ledger" as const,
      entries: localEntries.filter((entry) => {
        const source = toStringValue(entry.metadata?.source) || toStringValue(entry.metadata?.store);
        const date = kstDate(entry.approvedAt || entry.loggedAt);
        return source === INTERNAL_LEDGER_SOURCE && isInDateRange(date, range);
      }),
      latestLoggedAt: localEntries.map((entry) => entry.loggedAt).sort().at(-1) ?? "",
      warnings: extraWarnings,
    };
  };

  if (env.GOOGLE_ADS_DASHBOARD_LEDGER_MODE === "local_only") {
    return loadLocalLedgerEntries([
      "GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_only: VM Cloud dashboard route가 공개 HTTPS 원장 endpoint를 우회하고 같은 프로세스의 SQLite 원장을 직접 읽는다.",
    ]);
  }

  if (env.GOOGLE_ADS_DASHBOARD_LEDGER_MODE === "local_first") {
    try {
      return await loadLocalLedgerEntries([
        "GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first: VM Cloud dashboard route가 공개 HTTPS 원장 endpoint를 우회하고 같은 프로세스의 SQLite 원장을 먼저 읽는다.",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`로컬 attribution ledger 직접 조회 실패. 운영 VM attribution ledger HTTP 조회로 fallback: ${message}`);
    }
  }

  try {
    const chunks = buildOperationalLedgerChunks(
      range.startDate,
      range.endDate,
      OPERATIONAL_LEDGER_CHUNK_DAYS,
    );
    const pages: OperationalLedgerPage[] = [];
    const initialSummaries: OperationalLedgerPage[] = [];
    for (const chunk of chunks) {
      initialSummaries.push(await loadOperationalLedgerPage(chunk, 1));
    }

    for (const summaryPage of initialSummaries) {
      if (summaryPage.totalEntries === 0) {
        pages.push(summaryPage);
        continue;
      }

      if (summaryPage.totalEntries <= INTERNAL_LEDGER_LIMIT) {
        const page = summaryPage.totalEntries <= summaryPage.entries.length
          ? summaryPage
          : await loadOperationalLedgerPage(summaryPage.chunk);
        pages.push(page);
        continue;
      }

      for (const dailyChunk of buildOperationalLedgerChunks(
        summaryPage.chunk.startDate,
        summaryPage.chunk.endDate,
        1,
      )) {
        const dailySummary = await loadOperationalLedgerPage(dailyChunk, 1);
        const dailyPage = dailySummary.totalEntries <= dailySummary.entries.length
          ? dailySummary
          : await loadOperationalLedgerPage(dailyChunk);
        pages.push(dailyPage);
      }
    }

    for (const page of pages) {
      if (page.truncated) {
        warnings.push(
          `운영 VM attribution ledger ${page.chunk.startDate}~${page.chunk.endDate} 응답이 ` +
          `${page.itemCount}/${page.totalEntries}건으로 잘렸다. 내부 ROAS가 낮게 보일 수 있다.`,
        );
      }
    }

    return {
      dataSource: "operational_vm_ledger" as const,
      entries: pages.flatMap((page) => page.entries),
      latestLoggedAt: pages
        .map((page) => page.latestLoggedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? "",
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`운영 VM attribution ledger 조회 실패. 로컬 attribution_ledger로 fallback: ${message}`);
  }

  return loadLocalLedgerEntries(warnings);
};

const collectLedgerUrls = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  return [
    entry.landing,
    entry.referrer,
    entry.requestContext.requestReferer,
    firstString(metadata, [
      "imweb_landing_url",
      "checkout_started_landing",
      "checkoutUrl",
      "initial_referrer",
      "original_referrer",
    ]),
  ].filter(Boolean);
};

const ledgerAmount = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  const referrerPayment = toObject(metadata.referrerPayment);
  const fromUrl = collectLedgerUrls(entry)
    .map((url) => toNumber(urlParam(url, "amount")))
    .find((value) => value > 0) ?? 0;
  return firstPositiveNumber([
    metadata.totalAmount,
    metadata.total_amount,
    metadata.amount,
    metadata.paymentAmount,
    metadata.payment_amount,
    referrerPayment.amount,
    fromUrl,
  ]);
};

const ledgerCampaignId = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  const direct = firstString(metadata, [
    "googleAdsCampaignId",
    "google_ads_campaign_id",
    "campaignId",
    "campaign_id",
  ]);
  if (/^\d{6,}$/.test(direct)) return direct;

  for (const url of collectLedgerUrls(entry)) {
    for (const key of ["gad_campaignid", "utm_id", "campaignid", "campaign_id"]) {
      const value = urlParam(url, key);
      if (/^\d{6,}$/.test(value)) return value;
    }
  }

  return "";
};

const isGoogleAttributedEntry = (entry: AttributionLedgerEntry) => {
  const haystack = [
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.gclid,
    ...collectLedgerUrls(entry),
  ].join(" ").toLowerCase();
  return (
    Boolean(entry.gclid.trim())
    || haystack.includes("google")
    || haystack.includes("gclid=")
    || haystack.includes("gbraid=")
    || haystack.includes("wbraid=")
    || haystack.includes("gad_campaignid=")
  );
};

const normalizeInternalStatus = (entry: AttributionLedgerEntry): InternalOrderStatus => {
  if (entry.paymentStatus === "confirmed" || entry.paymentStatus === "canceled") return entry.paymentStatus;
  return "pending";
};

const statusPriority: Record<InternalOrderStatus, number> = {
  pending: 1,
  confirmed: 2,
  canceled: 3,
};

const ledgerOrderKey = (entry: AttributionLedgerEntry, index: number) => {
  const metadata = toObject(entry.metadata);
  const key = entry.paymentKey
    || entry.orderId
    || firstString(metadata, ["orderIdBase", "order_id_base", "orderNo", "order_no", "orderCode", "order_code"]);
  return key || `ledger:${index}:${entry.loggedAt}`;
};

const buildInternalOrders = (entries: AttributionLedgerEntry[], range: DateRange): InternalOrder[] => {
  const grouped = new Map<string, AttributionLedgerEntry[]>();
  entries
    .filter((entry) => entry.touchpoint === "payment_success")
    .filter(isGoogleAttributedEntry)
    .forEach((entry, index) => {
      const key = ledgerOrderKey(entry, index);
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

  return [...grouped.entries()].flatMap(([key, group]) => {
    const date = group.map((entry) => kstDate(entry.approvedAt || entry.loggedAt)).find(Boolean) ?? "";
    if (!isInDateRange(date, range)) return [];
    const status = group
      .map(normalizeInternalStatus)
      .sort((a, b) => statusPriority[b] - statusPriority[a])[0] ?? "pending";
    const amount = group.map(ledgerAmount).find((value) => value > 0) ?? 0;
    const attributionCarrier = group.find((entry) => ledgerCampaignId(entry) || entry.gclid || entry.utmCampaign)
      ?? group[0];

    return [{
      key,
      date,
      status,
      amount,
      campaignId: ledgerCampaignId(attributionCarrier) || null,
      utmCampaign: attributionCarrier.utmCampaign,
      hasClickId: group.some((entry) => Boolean(entry.gclid.trim())),
    }];
  });
};

const emptyInternalTotals = (): InternalRevenueTotals => ({
  orders: 0,
  confirmedOrders: 0,
  confirmedRevenue: 0,
  pendingOrders: 0,
  pendingRevenue: 0,
  canceledOrders: 0,
  canceledRevenue: 0,
});

const addInternalOrder = (totals: InternalRevenueTotals, order: InternalOrder) => {
  totals.orders += 1;
  if (order.status === "confirmed") {
    totals.confirmedOrders += 1;
    totals.confirmedRevenue += order.amount;
  } else if (order.status === "canceled") {
    totals.canceledOrders += 1;
    totals.canceledRevenue += order.amount;
  } else {
    totals.pendingOrders += 1;
    totals.pendingRevenue += order.amount;
  }
};

const round2 = (value: number) => Number(value.toFixed(2));
const roas = (revenue: number, cost: number) => (cost > 0 ? round2(revenue / cost) : null);
const roasGap = (internalRoas: number | null, platformRoas: number | null) =>
  internalRoas == null || platformRoas == null ? null : round2(internalRoas - platformRoas);

const ratio = (value: number, total: number) => (total > 0 ? round2(value / total) : null);

const classifyConversionActionSegment = (params: {
  actionName: string;
  category: string;
  primaryForGoal: boolean;
  conversionLabels: string[];
}) => {
  const name = params.actionName.toLowerCase();
  const hasKnownNpayLabel = params.conversionLabels.some((label) =>
    KNOWN_NPAY_CONVERSION_LABELS.has(label),
  );
  const hasNpayName = /npay|naver|네이버/.test(name);
  const isPurchase = params.category === "PURCHASE" || /purchase|구매/.test(name);
  const isNonRevenueAction = /page[_ ]?view|장바구니|cart|sign[_ ]?up|회원가입/.test(name);

  if (hasKnownNpayLabel && params.primaryForGoal) return "primary_known_npay";
  if (hasKnownNpayLabel || hasNpayName) return "secondary_known_npay";
  if (isPurchase && params.primaryForGoal) return "primary_purchase";
  if (isPurchase) return "secondary_purchase";
  if (isNonRevenueAction) return "non_revenue_action";
  return params.primaryForGoal ? "other_primary" : "other_secondary";
};

const conversionActionRiskFlags = (params: {
  classification: string;
  primaryForGoal: boolean;
  conversionLabels: string[];
  conversionValue: number;
  allConversionValue: number;
}) => {
  const flags: string[] = [];
  if (params.conversionLabels.some((label) => KNOWN_NPAY_CONVERSION_LABELS.has(label))) {
    flags.push("known_npay_label");
  }
  if (params.classification === "primary_known_npay") {
    flags.push("primary_bid_signal_is_npay");
  }
  if (!params.primaryForGoal && params.allConversionValue > 0) {
    flags.push("all_conversions_only_value");
  }
  if (params.primaryForGoal && params.conversionValue > 0 && params.classification === "non_revenue_action") {
    flags.push("non_revenue_primary_value");
  }
  return flags;
};

const parseConversionActionMetricRows = (
  results: unknown[],
  conversionActions: ConversionActionRow[],
): ConversionActionSegmentCampaignRow[] => {
  const actionByResource = new Map(conversionActions.map((action) => [action.resourceName, action]));
  const actionById = new Map(conversionActions.map((action) => [action.id, action]));

  return results.filter(isRecord).map((row) => {
    const campaign = isRecord(row.campaign) ? row.campaign : {};
    const segments = isRecord(row.segments) ? row.segments : {};
    const metrics = parseMetrics(row);
    const resourceName = toStringValue(segments.conversionAction);
    const actionId = conversionActionIdFromResourceName(resourceName);
    const metadata = actionByResource.get(resourceName) ?? (actionId ? actionById.get(actionId) : undefined);
    const actionName = toStringValue(segments.conversionActionName) || metadata?.name || "(unknown action)";
    const conversionLabels = metadata?.conversionLabels ?? [];
    const category = metadata?.category || "UNKNOWN";
    const primaryForGoal = metadata?.primaryForGoal ?? false;
    const classification = classifyConversionActionSegment({
      actionName,
      category,
      primaryForGoal,
      conversionLabels,
    });

    return {
      conversionActionResourceName: resourceName,
      conversionActionId: actionId,
      conversionActionName: actionName,
      campaignId: toStringValue(campaign.id),
      campaignName: toStringValue(campaign.name),
      channel: toStringValue(campaign.advertisingChannelType),
      conversions: round2(metrics.conversions),
      conversionValue: round2(metrics.conversionValue),
      allConversions: round2(metrics.allConversions),
      allConversionValue: round2(metrics.allConversionValue),
      viewThroughConversions: round2(metrics.viewThroughConversions),
      status: metadata?.status ?? "UNKNOWN",
      category,
      primaryForGoal,
      countingType: metadata?.countingType ?? "UNKNOWN",
      sendTo: metadata?.sendTo ?? [],
      conversionLabels,
      classification,
      riskFlags: conversionActionRiskFlags({
        classification,
        primaryForGoal,
        conversionLabels,
        conversionValue: metrics.conversionValue,
        allConversionValue: metrics.allConversionValue,
      }),
    };
  });
};

const summarizeConversionActionSegments = (params: {
  rows: ConversionActionSegmentCampaignRow[];
  platformSummary: MetricTotals & { roas: number | null };
  internalConfirmedRevenue: number;
}) => {
  const byAction = new Map<string, ConversionActionSegmentActionRow & { campaignIds: Set<string> }>();

  for (const row of params.rows) {
    const key = row.conversionActionResourceName || row.conversionActionName;
    const current = byAction.get(key) ?? {
      conversionActionResourceName: row.conversionActionResourceName,
      conversionActionId: row.conversionActionId,
      conversionActionName: row.conversionActionName,
      conversions: 0,
      conversionValue: 0,
      allConversions: 0,
      allConversionValue: 0,
      viewThroughConversions: 0,
      status: row.status,
      category: row.category,
      primaryForGoal: row.primaryForGoal,
      countingType: row.countingType,
      sendTo: row.sendTo,
      conversionLabels: row.conversionLabels,
      classification: row.classification,
      riskFlags: row.riskFlags,
      campaignCount: 0,
      campaigns: [],
      campaignIds: new Set<string>(),
      shareOfPlatformConversionValue: null,
      shareOfAllConversionValue: null,
    };

    current.conversions += row.conversions;
    current.conversionValue += row.conversionValue;
    current.allConversions += row.allConversions;
    current.allConversionValue += row.allConversionValue;
    current.viewThroughConversions += row.viewThroughConversions;
    if (row.campaignId) current.campaignIds.add(row.campaignId);
    if (row.campaignName && current.campaigns.length < 4 && !current.campaigns.includes(row.campaignName)) {
      current.campaigns.push(row.campaignName);
    }
    current.riskFlags = [...new Set([...current.riskFlags, ...row.riskFlags])];
    byAction.set(key, current);
  }

  const allConversionValue = params.rows.reduce((sum, row) => sum + row.allConversionValue, 0);
  const primaryConversionValue = params.rows.reduce((sum, row) => sum + row.conversionValue, 0);
  const primaryKnownNpayConversionValue = params.rows
    .filter((row) => row.classification === "primary_known_npay")
    .reduce((sum, row) => sum + row.conversionValue, 0);
  const knownNpayAllConversionValue = params.rows
    .filter((row) => row.riskFlags.includes("known_npay_label"))
    .reduce((sum, row) => sum + row.allConversionValue, 0);
  const knownNpayAllOnlyConversionValue = params.rows
    .filter((row) => row.riskFlags.includes("known_npay_label"))
    .reduce((sum, row) => sum + Math.max(0, row.allConversionValue - row.conversionValue), 0);
  const purchasePrimaryConversionValue = params.rows
    .filter((row) => row.category === "PURCHASE" && row.primaryForGoal)
    .reduce((sum, row) => sum + row.conversionValue, 0);
  const nonPurchasePrimaryConversionValue = Math.max(0, primaryConversionValue - purchasePrimaryConversionValue);
  const viewThroughConversions = params.rows.reduce((sum, row) => sum + row.viewThroughConversions, 0);
  const purchaseViewThroughConversions = params.rows
    .filter((row) => row.category === "PURCHASE")
    .reduce((sum, row) => sum + row.viewThroughConversions, 0);
  const platformMinusInternalConfirmed =
    params.platformSummary.conversionValue - params.internalConfirmedRevenue;
  const gapAfterRemovingKnownNpayPrimary =
    params.platformSummary.conversionValue - primaryKnownNpayConversionValue - params.internalConfirmedRevenue;

  const actions = [...byAction.values()]
    .map(({ campaignIds, ...row }) => ({
      ...row,
      campaignCount: campaignIds.size,
      conversions: round2(row.conversions),
      conversionValue: round2(row.conversionValue),
      allConversions: round2(row.allConversions),
      allConversionValue: round2(row.allConversionValue),
      viewThroughConversions: round2(row.viewThroughConversions),
      shareOfPlatformConversionValue: ratio(row.conversionValue, params.platformSummary.conversionValue),
      shareOfAllConversionValue: ratio(row.allConversionValue, allConversionValue),
    }))
    .sort((a, b) =>
      b.conversionValue - a.conversionValue
      || b.allConversionValue - a.allConversionValue
      || a.conversionActionName.localeCompare(b.conversionActionName, "ko"),
    );

  const gapDrivers: ConversionActionGapDriver[] = [
    {
      key: "primary_known_npay_label",
      label: "Primary 전환값의 대부분이 NPay label에서 발생",
      value: round2(primaryKnownNpayConversionValue),
      shareOfPlatformConversionValue: ratio(primaryKnownNpayConversionValue, params.platformSummary.conversionValue),
      confidence: "high",
      evidence: "`구매완료` action의 send_to가 아임웹 자동 NPay count label `r0vuCKvy-8caEJixj5EB`와 일치한다.",
      nextAction: "이 전환 액션을 purchase primary로 계속 둘지 즉시 재검토한다.",
    },
    {
      key: "platform_minus_internal_confirmed",
      label: "Google Conv. value와 내부 confirmed 매출 차이",
      value: round2(platformMinusInternalConfirmed),
      shareOfPlatformConversionValue: ratio(platformMinusInternalConfirmed, params.platformSummary.conversionValue),
      confidence: "medium-high",
      evidence: "같은 기간 Google Ads API live와 operational attribution ledger confirmed를 비교했다.",
      nextAction: "전환 액션별 value와 주문 원장 매칭을 결제수단별로 분해한다.",
    },
    {
      key: "known_npay_all_only_value",
      label: "All conv.에만 잡히는 NPay 보조 전환값",
      value: round2(knownNpayAllOnlyConversionValue),
      shareOfPlatformConversionValue: ratio(knownNpayAllOnlyConversionValue, params.platformSummary.conversionValue),
      confidence: "high",
      evidence: "`TechSol - NPAY구매 50739`는 secondary라 Conv. value에는 0원이지만 All conv. value에는 잡힌다.",
      nextAction: "All conv. value를 운영 ROAS 판단에서 제외하고 보조 오염 지표로만 본다.",
    },
  ];

  return {
    summary: {
      primaryConversionValue: round2(primaryConversionValue),
      allConversionValue: round2(allConversionValue),
      allConversionValueMinusPlatform: round2(allConversionValue - params.platformSummary.conversionValue),
      platformMinusInternalConfirmed: round2(platformMinusInternalConfirmed),
      primaryKnownNpayConversionValue: round2(primaryKnownNpayConversionValue),
      knownNpayAllConversionValue: round2(knownNpayAllConversionValue),
      knownNpayAllOnlyConversionValue: round2(knownNpayAllOnlyConversionValue),
      purchasePrimaryConversionValue: round2(purchasePrimaryConversionValue),
      nonPurchasePrimaryConversionValue: round2(nonPurchasePrimaryConversionValue),
      gapAfterRemovingKnownNpayPrimary: round2(gapAfterRemovingKnownNpayPrimary),
      viewThroughConversions: round2(viewThroughConversions),
      purchaseViewThroughConversions: round2(purchaseViewThroughConversions),
      primaryKnownNpayShareOfPlatform: ratio(primaryKnownNpayConversionValue, params.platformSummary.conversionValue),
      allConversionValueMinusInternalConfirmed: round2(allConversionValue - params.internalConfirmedRevenue),
    },
    actions,
    campaignRows: params.rows
      .map((row) => ({
        ...row,
        shareOfPlatformConversionValue: ratio(row.conversionValue, params.platformSummary.conversionValue),
        shareOfAllConversionValue: ratio(row.allConversionValue, allConversionValue),
      }))
      .sort((a, b) => b.conversionValue - a.conversionValue || b.allConversionValue - a.allConversionValue),
    gapDrivers,
  };
};

const buildInternalReconciliation = async (params: {
  datePreset?: DatePreset;
  dateRange?: DateRange;
  campaigns: CampaignMetricRow[];
  daily: DailyMetricRow[];
  summary: MetricTotals & { roas: number | null };
}) => {
  const dateRange = params.dateRange ?? resolvePresetDateRange(params.datePreset ?? "last_30d");
  const ledger = await loadInternalLedgerEntries(dateRange);
  const orders = buildInternalOrders(ledger.entries, dateRange);
  const totals = emptyInternalTotals();
  orders.forEach((order) => addInternalOrder(totals, order));

  const byCampaign = new Map<string, InternalRevenueTotals & { examples: Set<string> }>();
  for (const order of orders) {
    const key = order.campaignId ?? "(unknown)";
    const current = byCampaign.get(key) ?? { ...emptyInternalTotals(), examples: new Set<string>() };
    addInternalOrder(current, order);
    if (order.utmCampaign && current.examples.size < 3) current.examples.add(order.utmCampaign);
    byCampaign.set(key, current);
  }

  const platformByCampaign = new Map(params.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const campaigns: InternalCampaignRow[] = params.campaigns.map((campaign) => {
    const internal = byCampaign.get(campaign.campaignId) ?? { ...emptyInternalTotals(), examples: new Set<string>() };
    const internalRoas = roas(internal.confirmedRevenue, campaign.cost);
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      platformCost: round2(campaign.cost),
      platformConversionValue: round2(campaign.conversionValue),
      platformRoas: campaign.roas == null ? null : round2(campaign.roas),
      internalConfirmedRoas: internalRoas,
      roasGap: roasGap(internalRoas, campaign.roas),
      matchStatus: internal.orders > 0 ? "matched" : "platform_only",
      ...internal,
      examples: [...internal.examples],
      confirmedRevenue: round2(internal.confirmedRevenue),
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
    };
  });

  const internalOnlyCampaigns: InternalCampaignRow[] = [...byCampaign.entries()]
    .filter(([campaignId]) => campaignId === "(unknown)" || !platformByCampaign.has(campaignId))
    .map(([campaignId, internal]) => ({
      campaignId: campaignId === "(unknown)" ? null : campaignId,
      campaignName: campaignId === "(unknown)" ? "캠페인 ID 미확인 Google 유입" : `Google Ads campaign ${campaignId}`,
      platformCost: 0,
      platformConversionValue: 0,
      platformRoas: null,
      internalConfirmedRoas: null,
      roasGap: null,
      matchStatus: campaignId === "(unknown)" ? "unknown_campaign" as const : "internal_only" as const,
      ...internal,
      examples: [...internal.examples],
      confirmedRevenue: round2(internal.confirmedRevenue),
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
    }))
    .sort((a, b) => b.confirmedRevenue - a.confirmedRevenue || b.orders - a.orders);

  const internalByDate = new Map<string, InternalRevenueTotals>();
  for (const order of orders) {
    const current = internalByDate.get(order.date) ?? emptyInternalTotals();
    addInternalOrder(current, order);
    internalByDate.set(order.date, current);
  }

  const daily = params.daily.map((row) => {
    const internal = internalByDate.get(row.date) ?? emptyInternalTotals();
    const internalRoas = roas(internal.confirmedRevenue, row.cost);
    return {
      date: row.date,
      platformCost: round2(row.cost),
      platformConversionValue: round2(row.conversionValue),
      platformRoas: row.roas == null ? null : round2(row.roas),
      internalConfirmedRevenue: round2(internal.confirmedRevenue),
      internalConfirmedRoas: internalRoas,
      pendingRevenue: round2(internal.pendingRevenue),
      canceledRevenue: round2(internal.canceledRevenue),
      confirmedOrders: internal.confirmedOrders,
      orders: internal.orders,
    };
  });

  const internalRoas = roas(totals.confirmedRevenue, params.summary.cost);
  const matchedCampaignOrders = campaigns.reduce((sum, row) => sum + row.orders, 0);
  const unknownCampaignOrders = internalOnlyCampaigns
    .filter((row) => row.matchStatus === "unknown_campaign")
    .reduce((sum, row) => sum + row.orders, 0);

  return {
    dataSource: ledger.dataSource,
    source: INTERNAL_LEDGER_SOURCE,
    fetchedAt: new Date().toISOString(),
    latestLoggedAt: ledger.latestLoggedAt || null,
    dateRange,
    warnings: [
      ...ledger.warnings,
      "내부 ROAS는 운영 attribution ledger의 Google click/UTM 증거가 있는 payment_success만 집계한다.",
      "캠페인 ID가 없는 주문은 캠페인별 ROAS에는 직접 조인하지 않고 internal-only/unknown으로 분리한다.",
    ],
    summary: {
      ...totals,
      confirmedRevenue: round2(totals.confirmedRevenue),
      pendingRevenue: round2(totals.pendingRevenue),
      canceledRevenue: round2(totals.canceledRevenue),
      platformCost: round2(params.summary.cost),
      platformConversionValue: round2(params.summary.conversionValue),
      platformRoas: params.summary.roas == null ? null : round2(params.summary.roas),
      internalConfirmedRoas: internalRoas,
      roasGap: roasGap(internalRoas, params.summary.roas),
      platformMinusConfirmedRevenue: round2(params.summary.conversionValue - totals.confirmedRevenue),
      matchedCampaignOrders,
      unknownCampaignOrders,
      campaignIdCoverage:
        totals.orders > 0 ? round2((totals.orders - unknownCampaignOrders) / totals.orders) : null,
    },
    campaigns,
    internalOnlyCampaigns,
    daily,
  };
};

const datePresetWindowDays = (preset: DatePreset): number => {
  switch (preset) {
    case "today":
      return 1;
    case "last_1d":
      return 1;
    case "last_7d":
      return 7;
    case "last_14d":
      return 14;
    case "last_30d":
      return 30;
    case "last_90d":
      return 90;
    default:
      return 30;
  }
};

export type NpayActualCorrectionResponse = {
  windowDays: number;
  npayActualConfirmedPgCount: number;
  npayActualConfirmedPgRevenueKrw: number;
  internalConfirmedRevenueCurrentKrw: number;
  internalConfirmedRevenueWithNpayActualPgKrw: number;
  internalConfirmedRoasCurrent: number | null;
  internalConfirmedRoasWithNpayActualPg: number | null;
  npayActualWireStatus:
    | "wired_from_pg_snapshot"
    | "missing_snapshot_input"
    | "snapshot_zero_or_unconfigured"
    | "snapshot_error";
  googleAdsBudgetFloorNpayExactCount: number;
  uploadCandidateCount: 0;
  warnings: string[];
};

const buildNpayActualCorrectionForWindowDays = async (
  windowDays: number,
  internalConfirmedRevenueKrw: number,
  platformCostKrw: number,
  internalConfirmedOrders: number,
): Promise<NpayActualCorrectionResponse> => {
  let snapshot: NpayActualConfirmedSnapshot | null = null;
  let errorMessage: string | null = null;
  try {
    snapshot = await fetchNpayActualConfirmedSnapshot({ windowDays });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "snapshot_unknown_error";
  }

  if (!snapshot || !snapshot.ok) {
    return {
      windowDays,
      npayActualConfirmedPgCount: 0,
      npayActualConfirmedPgRevenueKrw: 0,
      internalConfirmedRevenueCurrentKrw: round2safe(internalConfirmedRevenueKrw),
      internalConfirmedRevenueWithNpayActualPgKrw: round2safe(internalConfirmedRevenueKrw),
      internalConfirmedRoasCurrent:
        platformCostKrw > 0 ? round4(internalConfirmedRevenueKrw / platformCostKrw) : null,
      internalConfirmedRoasWithNpayActualPg:
        platformCostKrw > 0 ? round4(internalConfirmedRevenueKrw / platformCostKrw) : null,
      npayActualWireStatus: errorMessage ? "snapshot_error" : "missing_snapshot_input",
      googleAdsBudgetFloorNpayExactCount: 0,
      uploadCandidateCount: 0,
      warnings: errorMessage ? [`npay_actual_correction_error: ${errorMessage}`] : [],
    };
  }

  if (snapshot.rows <= 0 || snapshot.totalAmountKrw <= 0) {
    return {
      windowDays,
      npayActualConfirmedPgCount: snapshot.rows,
      npayActualConfirmedPgRevenueKrw: snapshot.totalAmountKrw,
      internalConfirmedRevenueCurrentKrw: round2safe(internalConfirmedRevenueKrw),
      internalConfirmedRevenueWithNpayActualPgKrw: round2safe(internalConfirmedRevenueKrw),
      internalConfirmedRoasCurrent:
        platformCostKrw > 0 ? round4(internalConfirmedRevenueKrw / platformCostKrw) : null,
      internalConfirmedRoasWithNpayActualPg:
        platformCostKrw > 0 ? round4(internalConfirmedRevenueKrw / platformCostKrw) : null,
      npayActualWireStatus: "snapshot_zero_or_unconfigured",
      googleAdsBudgetFloorNpayExactCount: 0,
      uploadCandidateCount: 0,
      warnings: snapshot.warnings ?? [],
    };
  }

  const lift = estimateInternalRoasLift(snapshot, {
    confirmedOrders: internalConfirmedOrders,
    confirmedRevenueKrw: internalConfirmedRevenueKrw,
    platformCostKrw,
  });
  return {
    windowDays,
    npayActualConfirmedPgCount: snapshot.rows,
    npayActualConfirmedPgRevenueKrw: snapshot.totalAmountKrw,
    internalConfirmedRevenueCurrentKrw: round2safe(internalConfirmedRevenueKrw),
    internalConfirmedRevenueWithNpayActualPgKrw: round2safe(lift.after.confirmedRevenueKrw),
    internalConfirmedRoasCurrent: lift.before.internalConfirmedRoas,
    internalConfirmedRoasWithNpayActualPg: lift.after.internalConfirmedRoas,
    npayActualWireStatus: "wired_from_pg_snapshot",
    googleAdsBudgetFloorNpayExactCount: 9,
    uploadCandidateCount: 0,
    warnings: [
      "NPay actual은 internal 매출 풀에 합류시키는 보정값이고 Google Ads upload 후보가 아니다.",
      "google_ads_budget_floor_npay_exact_count 는 gpt0508-35 audit의 9건 (gclid + click_view exact). 다음 sprint ledger lookup wire 후 자동 갱신 대상.",
    ],
  };
};

const buildNpayActualCorrection = async (
  datePreset: DatePreset,
  internalConfirmedRevenueKrw: number,
  platformCostKrw: number,
  internalConfirmedOrders: number,
): Promise<NpayActualCorrectionResponse> =>
  buildNpayActualCorrectionForWindowDays(
    datePresetWindowDays(datePreset),
    internalConfirmedRevenueKrw,
    platformCostKrw,
    internalConfirmedOrders,
  );

const round2safe = (value: number) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export type OperationalDbFreshness = {
  source: "operational_db_tb_iamweb_users";
  maxOrderDateKst: string | null;
  maxPaymentCompleteKst: string | null;
  syncLagMinutes: number | null;
  status: "fresh" | "lagged" | "stale" | "unknown";
  warnings: string[];
};

const utcStringToKst = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " KST");
};

const buildOperationalDbFreshness = async (): Promise<OperationalDbFreshness> => {
  if (!isDatabaseConfigured()) {
    return {
      source: "operational_db_tb_iamweb_users",
      maxOrderDateKst: null,
      maxPaymentCompleteKst: null,
      syncLagMinutes: null,
      status: "unknown",
      warnings: ["DATABASE_URL 미설정"],
    };
  }
  try {
    const { rows } = await queryPg<{
      max_order_date: string | null;
      max_payment_complete: string | null;
    }>(
      `SELECT
        MAX(NULLIF(TRIM(order_date::text),'')::timestamp) AS max_order_date,
        MAX(NULLIF(TRIM(payment_complete_time::text),'')::timestamp) AS max_payment_complete
      FROM public.tb_iamweb_users
      WHERE NULLIF(TRIM(order_date::text),'') IS NOT NULL`,
    );
    const row = rows[0];
    const maxOrderDateKst = utcStringToKst(row?.max_order_date ?? null);
    const maxPaymentCompleteKst = utcStringToKst(row?.max_payment_complete ?? null);
    const orderDateMs = row?.max_order_date ? Date.parse(row.max_order_date) : NaN;
    const syncLagMinutes = Number.isFinite(orderDateMs)
      ? Math.max(0, Math.round((Date.now() - orderDateMs) / 60000))
      : null;
    const status: OperationalDbFreshness["status"] =
      syncLagMinutes == null
        ? "unknown"
        : syncLagMinutes <= 60
          ? "fresh"
          : syncLagMinutes <= 360
            ? "lagged"
            : "stale";
    return {
      source: "operational_db_tb_iamweb_users",
      maxOrderDateKst,
      maxPaymentCompleteKst,
      syncLagMinutes,
      status,
      warnings:
        status === "stale"
          ? ["운영DB sync lag 6시간 초과. dashboard 카운트는 lag 기준값."]
          : status === "lagged"
            ? ["운영DB sync lag 1시간 초과. 카운트는 lag 기준값."]
            : [],
    };
  } catch (error) {
    return {
      source: "operational_db_tb_iamweb_users",
      maxOrderDateKst: null,
      maxPaymentCompleteKst: null,
      syncLagMinutes: null,
      status: "unknown",
      warnings: [error instanceof Error ? `freshness_query_error: ${error.message}` : "freshness_query_error"],
    };
  }
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const readGoogleClickIdHealthOrders = async (
  range: DateRange,
): Promise<GoogleAdsClickIdHealthOrderRow[]> => {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await queryPg<GoogleAdsClickIdHealthOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '(blank)') AS payment_status,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN payment_complete_time::timestamptz
          WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN order_date::timestamptz
          ELSE NULL
        END AS paid_at,
        NULLIF(final_order_amount, 0)::numeric AS final_order_amount,
        NULLIF(paid_price, 0)::numeric AS paid_price,
        NULLIF(total_price, 0)::numeric AS total_price,
        COALESCE(NULLIF(total_refunded_price, 0), 0)::numeric AS total_refunded_price,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        COALESCE(MAX(total_refunded_price), 0)::numeric AS "refundAmount",
        BOOL_OR(cancellation_reason NOT IN ('', 'nan', 'null')) AS "hasCancel",
        BOOL_OR(return_reason NOT IN ('', 'nan', 'null')) AS "hasReturn",
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' OR channel_order_no <> '') AS "isNpay"
      FROM raw
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    WHERE "paidAt" >= $1::timestamptz
      AND "paidAt" < $2::timestamptz
      AND "orderAmount" > 0
      AND "paymentStatus" NOT IN (
        'REFUND_COMPLETE',
        'PARTIAL_REFUND_COMPLETE',
        'CANCELLED_BEFORE_DEPOSIT',
        'PAYMENT_OVERDUE',
        'PAYMENT_PREPARATION'
      )
      AND LOWER("paymentStatus") NOT LIKE '%refund%'
      AND LOWER("paymentStatus") NOT LIKE '%cancel%'
    ORDER BY "paidAt" ASC
    LIMIT 10000
    `,
    [range.startAt, range.endExclusiveAt ?? `${shiftIsoDate(range.endDate, 1)}T00:00:00.000+09:00`],
  );
  return rows;
};

const readGoogleClickIdHealthOrdersForWindow = async (
  window: GoogleAdsClickIdHealthWindow,
): Promise<GoogleAdsClickIdHealthOrderRow[]> => {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await queryPg<GoogleAdsClickIdHealthOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '(blank)') AS payment_status,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN payment_complete_time::timestamptz
          ELSE NULL
        END AS paid_at,
        NULLIF(final_order_amount, 0)::numeric AS final_order_amount,
        NULLIF(paid_price, 0)::numeric AS paid_price,
        NULLIF(total_price, 0)::numeric AS total_price,
        COALESCE(NULLIF(total_refunded_price, 0), 0)::numeric AS total_refunded_price,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        COALESCE(MAX(total_refunded_price), 0)::numeric AS "refundAmount",
        BOOL_OR(cancellation_reason NOT IN ('', 'nan', 'null')) AS "hasCancel",
        BOOL_OR(return_reason NOT IN ('', 'nan', 'null')) AS "hasReturn",
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' OR channel_order_no <> '') AS "isNpay"
      FROM raw
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    WHERE "paidAt" >= $1::timestamptz
      AND "paidAt" < $2::timestamptz
      AND "orderAmount" > 0
      AND "paymentStatus" = 'PAYMENT_COMPLETE'
      AND "hasCancel" = false
      AND "hasReturn" = false
    ORDER BY "paidAt" ASC
    LIMIT 10000
    `,
    [window.startAt, window.endExclusiveAt ?? window.endAt],
  );
  return rows;
};

const buildGoogleClickIdLedgerIndex = () => {
  try {
    const db = getCrmDb();
    const rows = db
      .prepare(
        `
        SELECT
          entry_id, logged_at, approved_at, order_id, payment_key,
          landing, referrer, gclid, metadata_json, request_context_json
        FROM attribution_ledger
        WHERE touchpoint = 'payment_success'
          AND payment_status = 'confirmed'
          AND source = ?
        ORDER BY logged_at DESC
        `,
      )
      .all(INTERNAL_LEDGER_SOURCE) as GoogleAdsClickIdHealthLedgerRow[];
    const byKey = new Map<string, GoogleAdsClickIdHealthLedgerRow>();
    for (const row of rows) {
      const metadata = parseJsonObject(row.metadata_json);
      const referrerPayment = toObject(metadata.referrerPayment);
      const keys = [
        row.order_id,
        row.payment_key,
        toStringValue(referrerPayment.orderNo),
        toStringValue(referrerPayment.orderId),
        toStringValue(referrerPayment.channelOrderNo),
        toStringValue(metadata.order_number),
      ].filter(Boolean);
      for (const key of keys) {
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
    return { rows, byKey };
  } catch {
    return { rows: [] as GoogleAdsClickIdHealthLedgerRow[], byKey: new Map<string, GoogleAdsClickIdHealthLedgerRow>() };
  }
};

const buildGoogleClickIdIntentIndex = () => {
  try {
    const db = getCrmDb();
    const rows = db
      .prepare(
        `
        SELECT id, captured_at, gclid, gbraid, wbraid, page_location, matched_order_no
        FROM npay_intent_log
        WHERE site = 'biocom'
          AND environment = 'live'
          AND matched_order_no IS NOT NULL
          AND TRIM(matched_order_no) <> ''
        ORDER BY captured_at DESC
        `,
      )
      .all() as GoogleAdsClickIdHealthIntentRow[];
    const byOrder = new Map<string, GoogleAdsClickIdHealthIntentRow>();
    for (const row of rows) {
      const orderNo = toStringValue(row.matched_order_no);
      if (orderNo && !byOrder.has(orderNo)) byOrder.set(orderNo, row);
    }
    return { rows, byOrder };
  } catch {
    return { rows: [] as GoogleAdsClickIdHealthIntentRow[], byOrder: new Map<string, GoogleAdsClickIdHealthIntentRow>() };
  }
};

const isDateTimeInWindow = (
  value: string | Date | null | undefined,
  range: DateRange,
): boolean => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  const start = new Date(range.startAt);
  const end = new Date(range.endExclusiveAt ?? range.endAt);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return date >= start && date < end;
};

const getVmConfirmedLedgerOrderNumber = (
  row: GoogleAdsClickIdHealthLedgerRow,
): string => {
  const metadata = parseJsonObject(row.metadata_json);
  const referrerPayment = toObject(metadata.referrerPayment);
  return firstString(
    {
      order_id: row.order_id,
      order_number: metadata.order_number,
      orderNo: referrerPayment.orderNo,
      orderId: referrerPayment.orderId,
      channelOrderNo: referrerPayment.channelOrderNo,
      payment_key: row.payment_key,
    },
    ["order_id", "order_number", "orderNo", "orderId", "channelOrderNo", "payment_key"],
  );
};

const getVmConfirmedLedgerDedupKeys = (
  row: GoogleAdsClickIdHealthLedgerRow,
): string[] => {
  const metadata = parseJsonObject(row.metadata_json);
  const referrerPayment = toObject(metadata.referrerPayment);
  return [
    row.order_id,
    row.payment_key,
    toStringValue(metadata.order_number),
    toStringValue(referrerPayment.orderNo),
    toStringValue(referrerPayment.orderId),
    toStringValue(referrerPayment.channelOrderNo),
  ].map((value) => value.trim()).filter(Boolean);
};

const getVmConfirmedPaymentAmountKrw = (
  row: GoogleAdsVmConfirmedPaymentSuccessRow,
): number => {
  const metadata = parseJsonObject(row.metadata_json);
  const raw = parseJsonObject(toStringValue(row.raw_json));
  const payment = toObject(raw.payment);
  const order = toObject(raw.order);
  const referrerPayment = toObject(metadata.referrerPayment);
  return Math.round(firstPositiveNumber([
    metadata.value,
    metadata.amount,
    metadata.totalAmount,
    metadata.total_amount,
    metadata.order_amount,
    metadata.orderAmount,
    metadata.payment_amount,
    metadata.paymentAmount,
    metadata.confirmedAmountKrw,
    metadata.confirmed_amount_krw,
    referrerPayment.value,
    row.payment_amount,
    row.total_price,
    payment.payment_amount,
    payment.amount,
    payment.total_price,
    order.payment_amount,
    order.total_price,
  ]));
};

const getVmConfirmedPaymentMethod = (
  row: GoogleAdsVmConfirmedPaymentSuccessRow,
): string => {
  const metadata = parseJsonObject(row.metadata_json);
  const imwebMethod = firstString(
    {
      pay_type: row.pay_type,
      pg_type: row.pg_type,
    },
    ["pay_type", "pg_type"],
  );
  const ledgerMethod = firstString(
    {
      payment_method: metadata.payment_method,
      paymentMethod: metadata.paymentMethod,
    },
    ["payment_method", "paymentMethod"],
  );
  return imwebMethod || ledgerMethod || "vm_confirmed_payment_success";
};

const buildVmConfirmedPaymentSuccessDiagnostics = (
  window: GoogleAdsClickIdHealthWindow,
  seenKeys: Set<string>,
): GoogleAdsClickIdHealthOrderDiagnostic[] => {
  try {
    const db = getCrmDb();
    const startBound = toSqliteUtcIsoBound(window.startAt);
    const rows = db
      .prepare(
        `
        SELECT
          entry_id, logged_at, approved_at, order_id, payment_key,
          landing, referrer, gclid, metadata_json, request_context_json
        FROM attribution_ledger
        WHERE touchpoint = 'payment_success'
          AND payment_status = 'confirmed'
          AND source = ?
          AND (
            approved_at >= ?
            OR logged_at >= ?
          )
        ORDER BY logged_at ASC
        `,
      )
      .all(INTERNAL_LEDGER_SOURCE, startBound, startBound) as GoogleAdsVmConfirmedPaymentSuccessRow[];

    const lookupImwebOrder = db.prepare(
      `
      SELECT
        order_no,
        order_code,
        channel_order_no,
        pay_type,
        pg_type,
        total_price,
        payment_amount,
        delivery_price,
        raw_json,
        order_time AS imweb_order_time,
        complete_time AS imweb_complete_time,
        imweb_status,
        imweb_status_synced_at,
        synced_at AS imweb_synced_at
      FROM imweb_orders
      WHERE site = 'biocom'
        AND (
          order_no IN (?, ?, ?, ?, ?, ?)
          OR order_code IN (?, ?, ?, ?, ?, ?)
          OR channel_order_no IN (?, ?, ?, ?, ?, ?)
        )
      ORDER BY synced_at DESC
      LIMIT 1
      `,
    );

    const diagnostics: GoogleAdsClickIdHealthOrderDiagnostic[] = [];
    for (const row of rows) {
      const paidAt = toStringValue(row.approved_at) || toStringValue(row.logged_at);
      if (!isDateTimeInWindow(paidAt, window)) continue;

      const dedupKeys = getVmConfirmedLedgerDedupKeys(row);
      if (dedupKeys.some((key) => seenKeys.has(key))) continue;

      const orderNumber = getVmConfirmedLedgerOrderNumber(row);
      if (!orderNumber) continue;

      const lookupKeys = getVmConfirmedLedgerDedupKeys(row).slice(0, 6);
      while (lookupKeys.length < 6) {
        lookupKeys.push(`__google_ads_no_match_${lookupKeys.length}__`);
      }
      const imwebOrder = lookupImwebOrder.get(
        ...lookupKeys,
        ...lookupKeys,
        ...lookupKeys,
      ) as GoogleAdsVmConfirmedImwebOrderRow | undefined;
      const mergedRow: GoogleAdsVmConfirmedPaymentSuccessRow = {
        ...row,
        ...(imwebOrder || {}),
      };
      const evidence = extractGoogleClickIdsFromEvidence(row, null);
      const amountKrw = getVmConfirmedPaymentAmountKrw(mergedRow);
      const channelOrderNo = toStringValue(mergedRow.channel_order_no);
      const order: GoogleAdsClickIdHealthOrderRow = {
        orderNumber,
        channelOrderNo: channelOrderNo || null,
        paidAt,
        paymentMethod: getVmConfirmedPaymentMethod(mergedRow),
        paymentStatus: "PAYMENT_COMPLETE",
        orderAmount: amountKrw,
        refundAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: /naver|npay|네이버/i.test(
          [
            mergedRow.channel_order_no,
            mergedRow.pay_type,
            mergedRow.pg_type,
            row.landing,
            row.referrer,
          ].map((value) => toStringValue(value)).join(" "),
        ),
      };
      const actualPurchaseEligibility = buildMetaCompatibleActualPurchaseEligibility(order);
      const blockReasons = [
        "read_only_phase",
        "approval_required",
        "google_ads_conversion_upload_not_run",
        "vm_confirmed_payment_success_source",
      ];
      if (!evidence.hasAny) blockReasons.push("missing_google_click_id");
      if (!actualPurchaseEligibility.passed) {
        blockReasons.push("meta_actual_purchase_criteria_not_passed");
        blockReasons.push(...actualPurchaseEligibility.blockReasons);
      }

      for (const key of dedupKeys) seenKeys.add(key);
      diagnostics.push({
        source: "vm_confirmed_payment_success",
        orderNumber,
        channelOrderNo: channelOrderNo || null,
        paidAt,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderAmount: amountKrw,
        refundAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: Boolean(order.isNpay),
        evidenceSource: "payment_success_ledger",
        evidenceAt: {
          paymentSuccessLoggedAt: toStringValue(row.logged_at) || null,
          paymentSuccessApprovedAt: toStringValue(row.approved_at) || null,
          npayIntentCapturedAt: null,
        },
        googleClickIds: {
          gclid: evidence.values.gclid,
          gbraid: evidence.values.gbraid,
          wbraid: evidence.values.wbraid,
        },
        hasGoogleClickId: evidence.hasAny,
        clickIdTypes: evidence.types,
        actualPurchaseEligibility,
        uploadCandidateCount: 0,
        sendCandidateCount: 0,
        blockReasons,
      });
    }
    return diagnostics;
  } catch {
    return [];
  }
};

const extractGoogleClickIdsFromEvidence = (
  ledger: GoogleAdsClickIdHealthLedgerRow | null,
  intent: GoogleAdsClickIdHealthIntentRow | null,
) => {
  const metadata = ledger ? parseJsonObject(ledger.metadata_json) : {};
  const firstTouch = toObject(metadata.firstTouch);
  const direct = {
    gclid:
      toStringValue(intent?.gclid)
      || toStringValue(ledger?.gclid)
      || toStringValue(metadata.gclid)
      || toStringValue(firstTouch.gclid)
      || urlParam(intent?.page_location, "gclid")
      || urlParam(ledger?.landing, "gclid")
      || urlParam(ledger?.referrer, "gclid"),
    gbraid:
      toStringValue(intent?.gbraid)
      || toStringValue(metadata.gbraid)
      || toStringValue(firstTouch.gbraid)
      || urlParam(intent?.page_location, "gbraid")
      || urlParam(ledger?.landing, "gbraid")
      || urlParam(ledger?.referrer, "gbraid"),
    wbraid:
      toStringValue(intent?.wbraid)
      || toStringValue(metadata.wbraid)
      || toStringValue(firstTouch.wbraid)
      || urlParam(intent?.page_location, "wbraid")
      || urlParam(ledger?.landing, "wbraid")
      || urlParam(ledger?.referrer, "wbraid"),
  };
  return {
    hasAny: Boolean(direct.gclid || direct.gbraid || direct.wbraid),
    hasEvidence: Boolean(ledger || intent),
    values: direct,
    types: {
      gclid: Boolean(direct.gclid),
      gbraid: Boolean(direct.gbraid),
      wbraid: Boolean(direct.wbraid),
    },
  };
};

const classifyClickIdHealthPaymentMethod = (
  order: GoogleAdsClickIdHealthOrderRow,
): "homepage" | "npay" | "unknown" => {
  if (order.isNpay) return "npay";
  const raw = `${order.paymentMethod || ""} ${order.channelOrderNo || ""}`.toLowerCase();
  if (/naver|npay|네이버/.test(raw)) return "npay";
  return order.paymentMethod ? "homepage" : "unknown";
};

const buildMetaCompatibleActualPurchaseEligibility = (
  order: GoogleAdsClickIdHealthOrderRow,
): GoogleAdsActualPurchaseEligibility => {
  const paymentStatus = toStringValue(order.paymentStatus);
  const amount = toNumber(order.orderAmount);
  const refundAmount = toNumber(order.refundAmount);
  const criteria = {
    paymentComplete: paymentStatus === "PAYMENT_COMPLETE",
    positiveAmount: amount > 0,
    noCancel: !order.hasCancel,
    noReturn: !order.hasReturn,
    noRefund: refundAmount <= 0,
  };
  const blockReasons: string[] = [];

  if (!criteria.paymentComplete) blockReasons.push("meta_actual_purchase_not_payment_complete");
  if (!criteria.positiveAmount) blockReasons.push("meta_actual_purchase_non_positive_amount");
  if (!criteria.noCancel) blockReasons.push("meta_actual_purchase_cancel_present");
  if (!criteria.noReturn) blockReasons.push("meta_actual_purchase_return_present");
  if (!criteria.noRefund) blockReasons.push("meta_actual_purchase_refund_present");

  const passed = blockReasons.length === 0;

  return {
    source: "meta_capi_compatible_confirmed_purchase_guard",
    passed,
    criteria,
    blockReasons,
    plain: passed
      ? "Meta CAPI와 같은 실제 결제완료 기준은 통과했습니다. Google Ads 전송 후보가 되려면 여기에 Google click id와 전송 승인 조건이 추가로 필요합니다."
      : "Meta CAPI와 같은 실제 결제완료 기준을 통과하지 못했습니다. 이 주문은 Google Ads 실제 구매 후보가 아닙니다.",
  };
};

const summarizeGoogleAdsClickIdHealth = (params: {
  orders: GoogleAdsClickIdHealthOrderRow[];
  dateRange: DateRange;
  sourceFreshness: OperationalDbFreshness;
  windowDays: number | null;
  windowHours?: number | null;
  windowKey?: GoogleAdsClickIdHealthWindowKey;
  windowLabel?: string;
  caveats?: string[];
}): GoogleAdsClickIdHealth => {
  const { orders, dateRange, sourceFreshness, windowDays, windowHours, windowKey, windowLabel } = params;
  const ledger = buildGoogleClickIdLedgerIndex();
  const intents = buildGoogleClickIdIntentIndex();
  const clickIdBreakdown = { gclid: 0, gbraid: 0, wbraid: 0 };
  const methodBreakdown = new Map<
    "homepage" | "npay" | "unknown",
    { orders: number; withGoogleClickId: number; missingGoogleClickId: number }
  >();
  const evidenceSourceBreakdown = {
    paymentSuccessLedgerRows: 0,
    npayIntentRows: 0,
    bothRows: 0,
    noneRows: 0,
    clickIdFromPaymentSuccessLedgerRows: 0,
    clickIdFromNpayIntentRows: 0,
    clickIdFromBothRows: 0,
  };
  let withGoogleClickId = 0;
  let missingAttributionVmEvidence = 0;

  for (const order of orders) {
    const orderNumber = toStringValue(order.orderNumber);
    const channelOrderNo = toStringValue(order.channelOrderNo);
    const keys = [orderNumber, channelOrderNo].filter(Boolean);
    const ledgerRow = keys.map((key) => ledger.byKey.get(key)).find(Boolean) ?? null;
    const intentRow = intents.byOrder.get(orderNumber) ?? null;
    const evidence = extractGoogleClickIdsFromEvidence(ledgerRow, intentRow);
    if (ledgerRow && intentRow) {
      evidenceSourceBreakdown.bothRows += 1;
      if (evidence.hasAny) evidenceSourceBreakdown.clickIdFromBothRows += 1;
    } else if (ledgerRow) {
      evidenceSourceBreakdown.paymentSuccessLedgerRows += 1;
      if (evidence.hasAny) evidenceSourceBreakdown.clickIdFromPaymentSuccessLedgerRows += 1;
    } else if (intentRow) {
      evidenceSourceBreakdown.npayIntentRows += 1;
      if (evidence.hasAny) evidenceSourceBreakdown.clickIdFromNpayIntentRows += 1;
    } else {
      evidenceSourceBreakdown.noneRows += 1;
    }
    const paymentMethod = classifyClickIdHealthPaymentMethod(order);
    const current = methodBreakdown.get(paymentMethod) ?? {
      orders: 0,
      withGoogleClickId: 0,
      missingGoogleClickId: 0,
    };
    current.orders += 1;
    if (evidence.hasAny) {
      withGoogleClickId += 1;
      current.withGoogleClickId += 1;
      if (evidence.types.gclid) clickIdBreakdown.gclid += 1;
      if (evidence.types.gbraid) clickIdBreakdown.gbraid += 1;
      if (evidence.types.wbraid) clickIdBreakdown.wbraid += 1;
    } else {
      current.missingGoogleClickId += 1;
    }
    if (!evidence.hasEvidence) missingAttributionVmEvidence += 1;
    methodBreakdown.set(paymentMethod, current);
  }

  const orderCount = orders.length;
  const totalValueKrw = orders.reduce((sum, order) => sum + toNumber(order.orderAmount), 0);
  const missingGoogleClickId = Math.max(0, orderCount - withGoogleClickId);
  return {
    windowDays,
    ...(windowHours !== undefined ? { windowHours } : {}),
    ...(windowKey ? { windowKey } : {}),
    ...(windowLabel ? { windowLabel } : {}),
    dateRange,
    generatedAt: new Date().toISOString(),
    source: "operational_db_and_vm_cloud_sqlite",
    mode: "no_send_read_only",
    orderCount,
    totalValueKrw: Math.round(totalValueKrw),
    withGoogleClickId,
    missingGoogleClickId,
    preservationRate: orderCount > 0 ? round4(withGoogleClickId / orderCount) : null,
    uploadCandidateCount: 0,
    sendCandidateCount: 0,
    clickIdBreakdown,
    paymentMethodBreakdown: [...methodBreakdown.entries()].map(([paymentMethod, value]) => ({
      paymentMethod,
      ...value,
      preservationRate: value.orders > 0 ? round4(value.withGoogleClickId / value.orders) : null,
    })),
    evidenceSourceBreakdown,
    blockReasonCounts: {
      readOnlyPhase: orderCount,
      approvalRequired: orderCount,
      missingGoogleClickId,
      missingAttributionVmEvidence,
    },
    sourceFreshness,
    caveats: params.caveats ?? [
      "no-send/read-only 집계다. Google Ads conversion upload 후보가 아니다.",
      "주문/결제 정본은 운영DB tb_iamweb_users, 광고 클릭 evidence는 VM Cloud SQLite attribution/intent 원장을 분리해서 본다.",
      "npay_intent fuzzy 매칭은 포함하지 않고 matched_order_no 또는 payment_success exact evidence만 센다. 따라서 upload 판단 전 별도 no-send builder 재실행이 필요하다.",
    ],
  };
};

const buildGoogleAdsClickIdOrderDiagnostics = async (
  window: GoogleAdsClickIdHealthWindow,
  params: {
    limit: number;
    only: "all" | "with_click_id" | "missing_click_id";
  },
): Promise<{
  window: GoogleAdsClickIdHealthWindow;
  orders: GoogleAdsClickIdHealthOrderDiagnostic[];
  summary: {
    orderCount: number;
    returnedCount: number;
    withGoogleClickId: number;
    missingGoogleClickId: number;
    metaActualPurchaseCriteriaPassed: number;
    metaActualPurchaseCriteriaBlocked: number;
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
  };
}> => {
  const orders = await readGoogleClickIdHealthOrdersForWindow(window);
  const ledger = buildGoogleClickIdLedgerIndex();
  const intents = buildGoogleClickIdIntentIndex();
  const seenKeys = new Set<string>();
  const diagnosticsFromOperationalDb = orders.map((order): GoogleAdsClickIdHealthOrderDiagnostic => {
    const orderNumber = toStringValue(order.orderNumber);
    const channelOrderNo = toStringValue(order.channelOrderNo);
    const keys = [orderNumber, channelOrderNo].filter(Boolean);
    for (const key of keys) seenKeys.add(key);
    const ledgerRow = keys.map((key) => ledger.byKey.get(key)).find(Boolean) ?? null;
    const intentRow = intents.byOrder.get(orderNumber) ?? null;
    const evidence = extractGoogleClickIdsFromEvidence(ledgerRow, intentRow);
    const evidenceSource = ledgerRow && intentRow
      ? "both"
      : ledgerRow
        ? "payment_success_ledger"
        : intentRow
          ? "npay_intent"
          : "none";
    const actualPurchaseEligibility = buildMetaCompatibleActualPurchaseEligibility(order);
    const blockReasons = [
      "read_only_phase",
      "approval_required",
      "google_ads_conversion_upload_not_run",
    ];
    if (!evidence.hasAny) blockReasons.push("missing_google_click_id");
    if (!evidence.hasEvidence) blockReasons.push("missing_attribution_vm_evidence");
    if (!actualPurchaseEligibility.passed) {
      blockReasons.push("meta_actual_purchase_criteria_not_passed");
      blockReasons.push(...actualPurchaseEligibility.blockReasons);
    }

    return {
      source: "operational_db",
      orderNumber,
      channelOrderNo: channelOrderNo || null,
      paidAt: order.paidAt,
      paymentMethod: toStringValue(order.paymentMethod),
      paymentStatus: toStringValue(order.paymentStatus),
      orderAmount: Math.round(toNumber(order.orderAmount)),
      refundAmount: Math.round(toNumber(order.refundAmount)),
      hasCancel: Boolean(order.hasCancel),
      hasReturn: Boolean(order.hasReturn),
      isNpay: Boolean(order.isNpay),
      evidenceSource,
      evidenceAt: {
        paymentSuccessLoggedAt: toStringValue(ledgerRow?.logged_at) || null,
        paymentSuccessApprovedAt: toStringValue(ledgerRow?.approved_at) || null,
        npayIntentCapturedAt: toStringValue(intentRow?.captured_at) || null,
      },
      googleClickIds: {
        gclid: evidence.values.gclid,
        gbraid: evidence.values.gbraid,
        wbraid: evidence.values.wbraid,
      },
      hasGoogleClickId: evidence.hasAny,
      clickIdTypes: evidence.types,
      actualPurchaseEligibility,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      blockReasons,
    };
  });
  const diagnostics = [
    ...diagnosticsFromOperationalDb,
    ...buildVmConfirmedPaymentSuccessDiagnostics(window, seenKeys),
  ].sort((a, b) => {
    const left = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const right = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return left - right;
  });
  const filtered = diagnostics.filter((row) => {
    if (params.only === "with_click_id") return row.hasGoogleClickId;
    if (params.only === "missing_click_id") return !row.hasGoogleClickId;
    return true;
  });
  const limited = filtered.slice(0, params.limit);
  return {
    window,
    orders: limited,
    summary: {
      orderCount: diagnostics.length,
      returnedCount: limited.length,
      withGoogleClickId: diagnostics.filter((row) => row.hasGoogleClickId).length,
      missingGoogleClickId: diagnostics.filter((row) => !row.hasGoogleClickId).length,
      metaActualPurchaseCriteriaPassed: diagnostics.filter((row) => row.actualPurchaseEligibility.passed).length,
      metaActualPurchaseCriteriaBlocked: diagnostics.filter((row) => !row.actualPurchaseEligibility.passed).length,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
    },
  };
};

const hashDiagnosticValue = (value: unknown, length = 16) =>
  createHash("sha256")
    .update(toStringValue(value))
    .digest("hex")
    .slice(0, length);

const buildPrivatePayloadCheck = (
  key: GoogleAdsPrivatePayloadPreviewCheck["key"],
  label: string,
  passed: boolean,
  publicSummary: string,
  blockerReason: string | null,
): GoogleAdsPrivatePayloadPreviewCheck => ({
  key,
  label,
  passed,
  publicSummary,
  rawValueExposed: false,
  blockerReason,
});

const isValidConversionDateTime = (value: string | Date | null) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
};

const getConfirmedPurchaseConversionActionResourceName = () =>
  `customers/${normalizeCustomerId(undefined)}/conversionActions/${GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID}`;

const GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  safe_ref TEXT NOT NULL,
  conversion_action_id TEXT NOT NULL,
  conversion_action_name TEXT NOT NULL,
  click_id_type TEXT NOT NULL,
  click_id_digest TEXT NOT NULL,
  order_digest TEXT NOT NULL,
  conversion_time_kst TEXT NOT NULL,
  conversion_value_krw INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'KRW',
  payload_hash TEXT NOT NULL,
  dedupe_key_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  block_reason TEXT NOT NULL DEFAULT '',
  google_ads_request_id TEXT NOT NULL DEFAULT '',
  google_ads_response_code TEXT NOT NULL DEFAULT '',
  google_ads_response_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_dedupe
ON ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE} (site, conversion_action_id, dedupe_key_hash);

CREATE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_status
ON ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE} (status, created_at);

CREATE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_order_digest
ON ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE} (order_digest);
`.trim();

const buildGoogleAdsConfirmedPurchasePrivatePayloadPreview = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
): Promise<GoogleAdsConfirmedPurchasePrivatePayloadPreview> => {
  const diagnostics = await buildGoogleAdsClickIdOrderDiagnostics(window, {
    limit: 10000,
    only: "with_click_id",
  });
  const exactGclidActualPurchaseRows = diagnostics.orders.filter((row) =>
    row.actualPurchaseEligibility.passed
    && Boolean(row.googleClickIds.gclid),
  );
  const candidates = exactGclidActualPurchaseRows
    .slice(0, requestedLimit)
    .map((row, index): GoogleAdsConfirmedPurchasePrivatePayloadPreviewCandidate => {
      const orderNumberPresent = Boolean(row.orderNumber);
      const gclidPresent = Boolean(row.googleClickIds.gclid);
      const conversionTimePresent = isValidConversionDateTime(row.paidAt);
      const conversionValuePresent = row.orderAmount > 0;
      const currencyPresent = true;
      const cancelRefundReturnGuardPassed = !row.hasCancel && !row.hasReturn && row.refundAmount <= 0;
      const duplicateKeyMaterialPresent = orderNumberPresent
        && Boolean(GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID);
      const conversionActionResourceName = getConfirmedPurchaseConversionActionResourceName();
      const duplicateSendKeyHash = hashDiagnosticValue(
        [
          GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
          row.orderNumber,
          "confirmed_purchase",
        ].join(":"),
        24,
      );

      const checks = [
        buildPrivatePayloadCheck(
          "actual_purchase_guard",
          "실제 결제완료 주문인지",
          row.actualPurchaseEligibility.passed,
          row.actualPurchaseEligibility.passed
            ? "결제완료, 금액 양수, 취소/반품/환불 없음 조건을 통과했습니다."
            : "실제 결제완료 주문 조건을 통과하지 못했습니다.",
          row.actualPurchaseEligibility.passed ? null : "actual_purchase_guard_failed",
        ),
        buildPrivatePayloadCheck(
          "exact_order_identifier",
          "원문 주문번호를 서버 내부에서 확인했는지",
          orderNumberPresent,
          orderNumberPresent
            ? "서버 내부에서 원문 주문번호 존재를 확인했습니다. 응답에는 원문값을 내보내지 않습니다."
            : "서버 내부에서 원문 주문번호를 찾지 못했습니다.",
          orderNumberPresent ? null : "missing_original_order_number",
        ),
        buildPrivatePayloadCheck(
          "exact_gclid",
          "원문 gclid를 서버 내부에서 확인했는지",
          gclidPresent,
          gclidPresent
            ? "서버 내부에서 원문 gclid 존재를 확인했습니다. 응답에는 원문값을 내보내지 않습니다."
            : "서버 내부에서 원문 gclid를 찾지 못했습니다.",
          gclidPresent ? null : "missing_original_gclid",
        ),
        buildPrivatePayloadCheck(
          "conversion_time",
          "실제 결제완료 시각을 확인했는지",
          conversionTimePresent,
          conversionTimePresent
            ? "서버 내부에서 실제 결제완료 시각을 확인했습니다. 응답에는 날짜 단위만 표시합니다."
            : "실제 결제완료 시각이 비어 있거나 해석할 수 없습니다.",
          conversionTimePresent ? null : "missing_or_invalid_payment_complete_time",
        ),
        buildPrivatePayloadCheck(
          "conversion_value",
          "전송할 결제금액이 0원보다 큰지",
          conversionValuePresent,
          conversionValuePresent
            ? "전송 후보 금액이 0원보다 큽니다."
            : "전송 후보 금액이 0원 이하입니다.",
          conversionValuePresent ? null : "non_positive_conversion_value",
        ),
        buildPrivatePayloadCheck(
          "currency",
          "통화가 KRW로 고정되는지",
          currencyPresent,
          "통화는 KRW로 고정합니다.",
          null,
        ),
        buildPrivatePayloadCheck(
          "cancel_refund_return_guard",
          "취소/환불/반품 주문이 아닌지",
          cancelRefundReturnGuardPassed,
          cancelRefundReturnGuardPassed
            ? "취소, 환불, 반품 신호가 없습니다."
            : "취소, 환불, 반품 중 하나가 감지되었습니다.",
          cancelRefundReturnGuardPassed ? null : "cancel_refund_or_return_present",
        ),
        buildPrivatePayloadCheck(
          "duplicate_key_material",
          "중복 전송 방지 키를 만들 수 있는지",
          duplicateKeyMaterialPresent,
          duplicateKeyMaterialPresent
            ? "전환 액션과 주문번호로 중복 전송 방지 키를 만들 수 있습니다. 응답에는 해시만 표시합니다."
            : "중복 전송 방지 키를 만들 재료가 부족합니다.",
          duplicateKeyMaterialPresent ? null : "missing_duplicate_key_material",
        ),
        buildPrivatePayloadCheck(
          "conversion_action",
          "실제 구매 전용 Google Ads 전환 액션이 정해졌는지",
          Boolean(conversionActionResourceName),
          "실제 구매 전용 후보는 BI confirmed_purchase_offline 기준으로 만듭니다.",
          null,
        ),
        buildPrivatePayloadCheck(
          "send_approval",
          "Google Ads에 실제 전송해도 되는 승인 상태인지",
          false,
          "이번 endpoint는 no-send preview입니다. Google Ads 전환 전송은 별도 Red Lane 승인 전 금지입니다.",
          "google_ads_conversion_upload_not_approved",
        ),
        buildPrivatePayloadCheck(
          "upload_ledger",
          "전송 이력을 남기는 장부가 연결됐는지",
          false,
          "중복 전송 키 재료는 있지만, 실제 Google Ads upload ledger는 아직 연결하지 않았습니다.",
          "google_ads_upload_ledger_not_connected",
        ),
      ];
      const privateChecks = checks.filter((check) => !["send_approval", "upload_ledger"].includes(check.key));
      const privateRawValueChecksPassed = privateChecks.every((check) => check.passed);
      const privatePreviewProgressPct = Math.round(
        (privateChecks.filter((check) => check.passed).length / privateChecks.length) * 100,
      );
      const safeRef = `gads_private_${hashDiagnosticValue([
        row.orderNumber,
        row.googleClickIds.gclid,
        row.paidAt,
      ].join(":"), 14)}`;

      return {
        candidateRank: index + 1,
        safeRef,
        maskedOrderRef: `order_${hashDiagnosticValue(row.orderNumber, 12)}`,
        sourceWindow: {
          key: window.key,
          label: window.label,
          startAt: window.startAt,
          endAt: window.endAt,
          timezone: window.timezone,
        },
        payment: {
          amountKrw: row.orderAmount,
          currencyCode: "KRW",
          paymentMethod: row.paymentMethod,
          paymentStatus: row.paymentStatus,
          isNpay: row.isNpay,
          paidDateKst: kstDate(row.paidAt),
          actualPurchaseGuardPassed: row.actualPurchaseEligibility.passed,
          cancelRefundReturnGuardPassed,
        },
        evidence: {
          source: row.evidenceSource,
          exactClickIdType: "gclid",
          hasGclid: true,
          hasGbraid: Boolean(row.googleClickIds.gbraid),
          hasWbraid: Boolean(row.googleClickIds.wbraid),
          rawClickIdExposed: false,
          clickIdDigestPrefix: hashDiagnosticValue(row.googleClickIds.gclid, 12),
        },
        noSendPayloadShape: {
          conversionActionId: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
          conversionActionName: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_NAME,
          conversionActionResourceName,
          orderIdPresent: orderNumberPresent,
          gclidPresent,
          conversionTimePresent,
          conversionValuePresent,
          currencyPresent,
          duplicateSendKeyHash,
          externalSendMode: "blocked_no_send_preview",
        },
        checks,
        readiness: {
          privateRawValueChecksPassed,
          privatePreviewProgressPct,
          googleAdsSendReady: false,
          uploadCandidateCount: 0,
          sendCandidateCount: 0,
          blockReasons: checks
            .filter((check) => !check.passed && check.blockerReason)
            .map((check) => check.blockerReason as string),
        },
      };
    });
  const privateReadyCount = candidates.filter((candidate) => candidate.readiness.privateRawValueChecksPassed).length;
  const privateProgress = candidates.length > 0
    ? Math.round(
      candidates.reduce((sum, candidate) => sum + candidate.readiness.privatePreviewProgressPct, 0)
        / candidates.length,
    )
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "private_no_send_payload_preview",
    goal: "Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 원문 주문번호와 원문 gclid가 서버 내부에 있는지만 안전하게 확인한다.",
    progress: {
      privatePreviewProgressPct: privateProgress,
      overallPrimaryConversionReadinessPct: 82,
      plain: "원문값 확인 장치는 준비됐지만, 실제 Google Ads 전송과 중복 전송 장부 연결은 아직 하지 않았습니다.",
    },
    window,
    requestedLimit,
    summary: {
      sourceOrderRows: diagnostics.summary.orderCount,
      exactGclidActualPurchaseRows: exactGclidActualPurchaseRows.length,
      returnedCandidates: candidates.length,
      privateRawValueChecksPassed: privateReadyCount,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
    },
    candidates,
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
      "이 endpoint는 no-send preview다. Google Ads conversion upload를 실행하지 않는다.",
      "원문 주문번호와 원문 gclid는 서버 내부에서만 검사하고, 응답에는 해시/존재 여부/통과 여부만 표시한다.",
      "Google 클릭 URL에 gclid와 gbraid가 함께 남은 주문은 gclid를 우선 식별자로 삼는 no-send preview에 포함한다. 실제 전송 전에는 한 주문에 한 click id만 담는 payload 검증이 별도로 필요하다.",
      "중복 전송 방지 key material은 만들 수 있지만, 실제 Google Ads upload ledger 연결 전까지 sendReady는 항상 false다.",
    ],
  };
};

const buildGoogleAdsDuplicateLedgerDedupeHash = (
  candidate: GoogleAdsConfirmedPurchasePrivatePayloadPreviewCandidate,
) => hashDiagnosticValue(JSON.stringify({
  site: "biocom",
  conversionActionId: candidate.noSendPayloadShape.conversionActionId,
  duplicateSendKeyHash: candidate.noSendPayloadShape.duplicateSendKeyHash,
  amountKrw: candidate.payment.amountKrw,
  currencyCode: candidate.payment.currencyCode,
  paidDateKst: candidate.payment.paidDateKst,
}), 24);

const buildGoogleAdsDuplicateLedgerPayloadHash = (
  candidate: GoogleAdsConfirmedPurchasePrivatePayloadPreviewCandidate,
) => hashDiagnosticValue(JSON.stringify({
  site: "biocom",
  conversionActionResourceName: candidate.noSendPayloadShape.conversionActionResourceName,
  conversionActionId: candidate.noSendPayloadShape.conversionActionId,
  clickIdType: candidate.evidence.exactClickIdType,
  clickIdDigestPrefix: candidate.evidence.clickIdDigestPrefix,
  maskedOrderRef: candidate.maskedOrderRef,
  amountKrw: candidate.payment.amountKrw,
  currencyCode: candidate.payment.currencyCode,
  paidDateKst: candidate.payment.paidDateKst,
  orderIdPresent: candidate.noSendPayloadShape.orderIdPresent,
  gclidPresent: candidate.noSendPayloadShape.gclidPresent,
  conversionTimePresent: candidate.noSendPayloadShape.conversionTimePresent,
  conversionValuePresent: candidate.noSendPayloadShape.conversionValuePresent,
}), 24);

const buildGoogleAdsDuplicateLedgerDryRun = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
): Promise<GoogleAdsDuplicateLedgerDryRun> => {
  const preview = await buildGoogleAdsConfirmedPurchasePrivatePayloadPreview(window, requestedLimit);
  const seenKeys = new Set<string>();
  let duplicateDedupeKeys = 0;

  const rows = preview.candidates.map((candidate): GoogleAdsDuplicateLedgerDryRunRow => {
    const dedupeKeyHash = buildGoogleAdsDuplicateLedgerDedupeHash(candidate);
    const alreadySeen = seenKeys.has(dedupeKeyHash);
    if (alreadySeen) {
      duplicateDedupeKeys += 1;
    } else {
      seenKeys.add(dedupeKeyHash);
    }

    return {
      candidateRank: candidate.candidateRank,
      safeRef: candidate.safeRef,
      maskedOrderRef: candidate.maskedOrderRef,
      dedupeKeyHash,
      payloadHash: buildGoogleAdsDuplicateLedgerPayloadHash(candidate),
      conversionActionId: candidate.noSendPayloadShape.conversionActionId,
      conversionActionName: candidate.noSendPayloadShape.conversionActionName,
      payment: {
        amountKrw: candidate.payment.amountKrw,
        currencyCode: candidate.payment.currencyCode,
        paidDateKst: candidate.payment.paidDateKst,
      },
      evidence: {
        clickIdType: candidate.evidence.exactClickIdType,
        rawClickIdExposed: false,
      },
      firstPassDecision: alreadySeen
        ? "would_block_duplicate_in_same_batch"
        : "would_insert_new_preview_row",
      replayDecision: "would_block_duplicate_send",
      sendMode: "blocked_no_send_dry_run",
      ledgerWrite: false,
      reasons: [
        "같은 전환 액션과 같은 주문 후보를 한 번 더 보내려 하면 중복으로 막는지 시뮬레이션했습니다.",
        "이번 dry-run은 실제 전송과 실제 장부 저장을 하지 않습니다.",
      ],
    };
  });

  const simulatedReplayBlocked = rows.filter((row) => row.replayDecision === "would_block_duplicate_send").length;
  const duplicateLedgerDryRunPassed =
    rows.length > 0
    && duplicateDedupeKeys === 0
    && simulatedReplayBlocked === rows.length
    && preview.invariants.rawOrderIdInResponse === false
    && preview.invariants.rawClickIdInResponse === false;
  const blockers = [
    rows.length > 0 ? "" : "no_private_preview_candidates",
    duplicateDedupeKeys === 0 ? "" : "duplicate_dedupe_key_collision",
    "google_ads_conversion_upload_not_approved",
    "google_ads_upload_ledger_write_not_approved",
    "google_ads_dispatcher_not_enabled",
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "duplicate_send_ledger_dry_run",
    goal:
      "실제 결제완료 주문을 Google Ads에 보내기 전, 같은 주문 후보가 두 번 전송되지 않도록 장부 키가 작동하는지 no-write로 확인한다.",
    sourcePreview: {
      mode: preview.mode,
      window: preview.window,
      requestedLimit: preview.requestedLimit,
      sourceOrderRows: preview.summary.sourceOrderRows,
      exactGclidActualPurchaseRows: preview.summary.exactGclidActualPurchaseRows,
      privateRawValueChecksPassed: preview.summary.privateRawValueChecksPassed,
    },
    summary: {
      sourceCandidateCount: rows.length,
      uniqueDedupeKeys: seenKeys.size,
      duplicateDedupeKeys,
      simulatedReplayRows: rows.length,
      simulatedReplayBlocked,
      dryRunLedgerRows: rows.length,
      ledgerWriteCount: 0,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
    },
    readiness: {
      duplicateLedgerDryRunPassed,
      actualLedgerReadyForWrite: false,
      googleAdsSendReady: false,
      blockers,
    },
    rows,
    invariants: {
      rawOrderIdInResponse: false,
      rawClickIdInResponse: false,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
      operationalDbWrite: 0,
      vmCloudWrite: 0,
      googleAdsWrite: 0,
      ledgerWriteCount: 0,
    },
    caveats: [
      "이 endpoint는 dry-run이다. Google Ads conversion upload를 실행하지 않는다.",
      "실제 upload ledger 테이블이나 운영DB에는 아무것도 쓰지 않는다.",
      "원문 주문번호와 원문 gclid는 응답에 포함하지 않는다.",
      "실제 전송 전에는 Red Lane 승인과 장부 write 승인, Google Ads API send smoke가 별도로 필요하다.",
    ],
  };
};

const buildGoogleAdsUploadLedgerWriteSmokePlan = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
): Promise<GoogleAdsUploadLedgerWriteSmokePlan> => {
  const uploadCandidates = await buildGoogleAdsConfirmedPurchaseUploadCandidates(window, requestedLimit);
  const seenKeys = new Set<string>();
  let duplicateRowsBlockedInPlan = 0;

  const rows = uploadCandidates.map((candidate): GoogleAdsUploadLedgerWriteSmokePlanRow => {
    const alreadySeen = seenKeys.has(candidate.dedupeKeyHash);
    const alreadyHasLedgerRow = Boolean(candidate.ledgerRowId);
    if (alreadySeen || alreadyHasLedgerRow) {
      duplicateRowsBlockedInPlan += 1;
    } else {
      seenKeys.add(candidate.dedupeKeyHash);
    }

    return {
      candidateRank: candidate.candidateRank,
      safeRef: candidate.safeRef,
      maskedOrderRef: candidate.maskedOrderRef,
      statusToWrite: "ready",
      dedupeKeyHash: candidate.dedupeKeyHash,
      payloadHash: candidate.payloadHash,
      conversionActionId: candidate.conversionActionId,
      conversionActionName: candidate.conversionActionName,
      clickIdType: "gclid",
      amountKrw: candidate.conversionValue,
      currencyCode: candidate.currencyCode,
      paidDateKst: candidate.conversionDateTime.slice(0, 10),
      firstWriteDecision: alreadySeen || alreadyHasLedgerRow
        ? "would_block_duplicate_in_same_batch"
        : "would_insert_ready_row",
      replayDecision: "would_block_duplicate_ready_row",
      sqlParamPresence: {
        safeRef: true,
        dedupeKeyHash: true,
        payloadHash: true,
        conversionActionId: true,
        clickIdDigest: true,
        orderDigest: true,
        conversionTimeKst: true,
        conversionValueKrw: true,
      },
      rawOrderIdExposed: false,
      rawClickIdExposed: false,
    };
  });

  const replayRowsBlocked = rows.filter((row) => row.replayDecision === "would_block_duplicate_ready_row").length;
  const writeSmokePlanReady =
    rows.length > 0
    && duplicateRowsBlockedInPlan === 0
    && replayRowsBlocked === rows.length;
  const blockers = [
    writeSmokePlanReady ? "" : "write_smoke_plan_not_ready",
    rows.length > 0 ? "" : "no_private_preview_candidates",
    duplicateRowsBlockedInPlan === 0 ? "" : "duplicate_dedupe_key_collision_in_write_plan",
    "vm_cloud_upload_ledger_write_not_executed",
    "google_ads_conversion_upload_not_approved",
    "google_ads_dispatcher_not_enabled",
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "upload_ledger_write_smoke_plan_no_write",
    goal:
      "Google Ads에 실제 구매를 보내기 전에, VM Cloud 장부에 어떤 ready row를 쓸지 원문값 없이 확정한다.",
    progress: {
      uploadLedgerPrepPct: writeSmokePlanReady ? 100 : rows.length > 0 ? 70 : 0,
      overallPrimaryConversionReadinessPct: writeSmokePlanReady ? 88 : 86,
      plain: writeSmokePlanReady
        ? "장부 write smoke는 실행 직전 상태까지 준비됐습니다. 아직 실제 장부 write와 Google Ads 전송은 하지 않았습니다."
        : "장부 write smoke 준비가 아직 막혀 있습니다. 후보 row 또는 중복 key를 먼저 확인해야 합니다.",
    },
    sourceDryRun: {
      mode: "upload_candidate_builder",
      sourceCandidateCount: uploadCandidates.length,
      uniqueDedupeKeys: seenKeys.size,
      simulatedReplayBlocked: replayRowsBlocked,
      duplicateLedgerDryRunPassed: rows.length > 0 && duplicateRowsBlockedInPlan === 0,
    },
    schemaPlan: {
      tableName: GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE,
      ddlHash: hashDiagnosticValue(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL, 24),
      uniqueKey: "site + conversion_action_id + dedupe_key_hash",
      statusFlow: ["ready", "sent", "failed", "blocked_duplicate"],
      rollbackShape: "delete_ready_rows_by_status_and_created_at_before_any_send",
    },
    summary: {
      plannedReadyRows: rows.filter((row) => row.firstWriteDecision === "would_insert_ready_row").length,
      duplicateRowsBlockedInPlan,
      replayRowsBlocked,
      ledgerWriteCount: 0,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
    },
    rows,
    readiness: {
      writeSmokePlanReady,
      actualLedgerWriteReady: false,
      googleAdsSendReady: false,
      blockers,
    },
    invariants: {
      rawOrderIdInResponse: false,
      rawClickIdInResponse: false,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
      operationalDbWrite: 0,
      vmCloudWrite: 0,
      googleAdsWrite: 0,
      ledgerWriteCount: 0,
    },
    caveats: [
      "이 endpoint는 write smoke plan이다. 실제 SQLite 테이블 생성이나 insert를 하지 않는다.",
      "응답에는 원문 주문번호와 원문 gclid를 포함하지 않는다.",
      "실제 장부 write smoke 실행은 VM Cloud SQLite write라 별도 승인과 rollback 기준이 필요하다.",
      "Google Ads conversion upload는 별도 Red Lane 승인 전까지 실행하지 않는다.",
    ],
  };
};

const executeGoogleAdsUploadLedgerWriteSmoke = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
): Promise<GoogleAdsUploadLedgerWriteSmokeResult> => {
  const limit = Math.min(Math.max(requestedLimit, 1), 5);
  const plan = await buildGoogleAdsUploadLedgerWriteSmokePlan(window, limit);
  const now = new Date().toISOString();
  const smokeRunId = `gads_write_smoke_${now.replace(/[^0-9A-Za-z]/g, "").slice(0, 14)}_${hashDiagnosticValue(now, 8)}`;
  const plannedRows = plan.rows.filter((row) => row.firstWriteDecision === "would_insert_ready_row").slice(0, limit);

  /*
    The plan can contain older already-sent rows before a newer ready row.
    For the smoke executor, skip those blocked rows and write only fresh
    would_insert_ready_row entries.
  */
  const readyDedupeKeys = new Set(plannedRows.map((row) => row.dedupeKeyHash));
  const plannedRowsHaveDuplicateKeys = readyDedupeKeys.size !== plannedRows.length;

  if (plannedRows.length === 0 || plannedRows.length > 5 || plannedRowsHaveDuplicateKeys) {
    const blockers = [
      plannedRows.length > 0 ? "" : "no_ready_rows_to_write",
        plannedRows.length <= 5 ? "" : "write_smoke_limit_exceeded",
      plannedRowsHaveDuplicateKeys ? "ready_rows_dedupe_key_collision" : "",
      "google_ads_conversion_upload_not_executed",
      "google_ads_dispatcher_not_enabled",
    ].filter(Boolean);

    return {
      generatedAt: now,
      site: "biocom",
      mode: "upload_ledger_write_smoke_executed",
      goal: "Google Ads 실제 구매 전송 전, VM Cloud 장부에 ready 후보 최대 5건을 안전하게 기록한다.",
      approval: {
        confirmation: "vm_cloud_write_smoke_approved",
        maxReadyRows: 5,
        googleAdsSendApproved: false,
      },
      progress: {
        uploadLedgerWriteSmokePct: 0,
        overallPrimaryConversionReadinessPct: 88,
        plain: "장부 write smoke를 실행하지 않았습니다. 후보 row 또는 write plan 조건을 먼저 확인해야 합니다.",
      },
      sourcePlan: {
        mode: plan.mode,
        plannedReadyRows: plan.summary.plannedReadyRows,
        replayRowsBlocked: plan.summary.replayRowsBlocked,
        writeSmokePlanReady: plan.readiness.writeSmokePlanReady,
      },
      schema: {
        tableName: GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE,
        ddlHash: hashDiagnosticValue(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL, 24),
        uniqueKey: "site + conversion_action_id + dedupe_key_hash",
      },
      summary: {
        plannedReadyRows: plannedRows.length,
        insertedReadyRows: 0,
        existingDuplicateRows: 0,
        replayRowsBlocked: 0,
        ledgerWriteCount: 0,
        uploadCandidateCount: 0,
        sendCandidateCount: 0,
        externalSendCount: 0,
      },
      rows: [],
      readiness: {
        actualLedgerWritePassed: false,
        googleAdsSendReady: false,
        nextReadinessPct: 88,
        blockers,
      },
      rollback: {
        rollbackShape: "delete_ready_rows_by_smoke_run_id_before_any_send",
        smokeRunId,
        deleteWhere: `status = 'ready' AND block_reason LIKE '%${smokeRunId}%'`,
      },
      invariants: {
        rawOrderIdInResponse: false,
        rawClickIdInResponse: false,
        uploadCandidateCount: 0,
        sendCandidateCount: 0,
        externalSendCount: 0,
        operationalDbWrite: 0,
        vmCloudWrite: 0,
        googleAdsWrite: 0,
        ledgerWriteCount: 0,
      },
      caveats: [
        "Google Ads 전송은 실행하지 않았다.",
        "원문 주문번호와 원문 gclid는 응답에 포함하지 않는다.",
        "write smoke가 실패하면 기존 ready row를 만들지 않는다.",
      ],
    };
  }

  const db = getCrmDb();
  db.exec(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL);

  const insertReady = db.prepare(`
    INSERT OR IGNORE INTO ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE} (
      site,
      safe_ref,
      conversion_action_id,
      conversion_action_name,
      click_id_type,
      click_id_digest,
      order_digest,
      conversion_time_kst,
      conversion_value_krw,
      currency_code,
      payload_hash,
      dedupe_key_hash,
      status,
      block_reason,
      created_at,
      updated_at,
      last_error
    ) VALUES (
      @site,
      @safeRef,
      @conversionActionId,
      @conversionActionName,
      @clickIdType,
      @clickIdDigest,
      @orderDigest,
      @conversionTimeKst,
      @conversionValueKrw,
      @currencyCode,
      @payloadHash,
      @dedupeKeyHash,
      'ready',
      @blockReason,
      @createdAt,
      @updatedAt,
      ''
    )
  `);

  const insertRows = db.transaction((rowsToWrite: GoogleAdsUploadLedgerWriteSmokePlanRow[]) => {
    const results: GoogleAdsUploadLedgerWriteSmokeResultRow[] = [];
    let insertedReadyRows = 0;
    let existingDuplicateRows = 0;

    rowsToWrite.forEach((row) => {
      const params = {
        site: "biocom",
        safeRef: row.safeRef,
        conversionActionId: row.conversionActionId,
        conversionActionName: row.conversionActionName,
        clickIdType: row.clickIdType,
        clickIdDigest: hashDiagnosticValue(["click", row.safeRef, row.payloadHash].join(":"), 24),
        orderDigest: hashDiagnosticValue(["order", row.maskedOrderRef, row.dedupeKeyHash].join(":"), 24),
        conversionTimeKst: row.paidDateKst,
        conversionValueKrw: row.amountKrw,
        currencyCode: row.currencyCode,
        payloadHash: row.payloadHash,
        dedupeKeyHash: row.dedupeKeyHash,
        blockReason: `write_smoke_ready_no_google_ads_send:${smokeRunId}`,
        createdAt: now,
        updatedAt: now,
      };
      const result = insertReady.run(params);
      const inserted = result.changes > 0;
      if (inserted) {
        insertedReadyRows += 1;
      } else {
        existingDuplicateRows += 1;
      }

      results.push({
        candidateRank: row.candidateRank,
        safeRef: row.safeRef,
        maskedOrderRef: row.maskedOrderRef,
        status: inserted ? "ready" : "duplicate_existing",
        dedupeKeyHash: row.dedupeKeyHash,
        payloadHash: row.payloadHash,
        conversionActionId: row.conversionActionId,
        conversionActionName: row.conversionActionName,
        clickIdType: row.clickIdType,
        amountKrw: row.amountKrw,
        currencyCode: row.currencyCode,
        paidDateKst: row.paidDateKst,
        firstWriteDecision: inserted ? "inserted_ready_row" : "blocked_existing_duplicate",
        replayDecision: "blocked_duplicate_ready_row",
        rawOrderIdExposed: false,
        rawClickIdExposed: false,
      });
    });

    return {
      rows: results,
      insertedReadyRows,
      existingDuplicateRows,
    };
  });

  const firstPass = insertRows(plannedRows);
  const replayPass = insertRows(plannedRows);
  const replayRowsBlocked = replayPass.existingDuplicateRows;
  const ledgerWriteCount = firstPass.insertedReadyRows;
  const allRowsAccountedFor =
    firstPass.insertedReadyRows + firstPass.existingDuplicateRows === plannedRows.length;
  const actualLedgerWritePassed =
    plannedRows.length > 0
    && plannedRows.length <= 5
    && allRowsAccountedFor
    && replayRowsBlocked === plannedRows.length
    && plan.invariants.rawOrderIdInResponse === false
    && plan.invariants.rawClickIdInResponse === false;
  const blockers = [
    actualLedgerWritePassed ? "" : "upload_ledger_write_smoke_failed",
    "google_ads_conversion_upload_not_executed",
    "google_ads_dispatcher_not_enabled",
  ].filter(Boolean);

  return {
    generatedAt: now,
    site: "biocom",
    mode: "upload_ledger_write_smoke_executed",
    goal: "Google Ads 실제 구매 전송 전, VM Cloud 장부에 ready 후보 최대 5건을 안전하게 기록한다.",
    approval: {
      confirmation: "vm_cloud_write_smoke_approved",
      maxReadyRows: 5,
      googleAdsSendApproved: false,
    },
    progress: {
      uploadLedgerWriteSmokePct: actualLedgerWritePassed ? 100 : 50,
      overallPrimaryConversionReadinessPct: actualLedgerWritePassed ? 92 : 88,
      plain: actualLedgerWritePassed
        ? "VM Cloud 장부에 ready 후보를 기록했고, 같은 후보를 다시 쓰면 중복으로 막히는 것을 확인했습니다."
        : "장부 write smoke 일부가 통과하지 못했습니다. Google Ads 전송으로 넘어가면 안 됩니다.",
    },
    sourcePlan: {
      mode: plan.mode,
      plannedReadyRows: plan.summary.plannedReadyRows,
      replayRowsBlocked: plan.summary.replayRowsBlocked,
      writeSmokePlanReady: plan.readiness.writeSmokePlanReady,
    },
    schema: {
      tableName: GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE,
      ddlHash: hashDiagnosticValue(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL, 24),
      uniqueKey: "site + conversion_action_id + dedupe_key_hash",
    },
    summary: {
      plannedReadyRows: plannedRows.length,
      insertedReadyRows: firstPass.insertedReadyRows,
      existingDuplicateRows: firstPass.existingDuplicateRows,
      replayRowsBlocked,
      ledgerWriteCount,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
    },
    rows: firstPass.rows,
    readiness: {
      actualLedgerWritePassed,
      googleAdsSendReady: false,
      nextReadinessPct: actualLedgerWritePassed ? 92 : 88,
      blockers,
    },
    rollback: {
      rollbackShape: "delete_ready_rows_by_smoke_run_id_before_any_send",
      smokeRunId,
      deleteWhere: `status = 'ready' AND block_reason LIKE '%${smokeRunId}%'`,
    },
    invariants: {
      rawOrderIdInResponse: false,
      rawClickIdInResponse: false,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
      operationalDbWrite: 0,
      vmCloudWrite: ledgerWriteCount,
      googleAdsWrite: 0,
      ledgerWriteCount,
    },
    caveats: [
      "Google Ads 전송은 실행하지 않았다.",
      "원문 주문번호와 원문 gclid는 응답에 포함하지 않는다.",
      "rollback은 Google Ads 전송 전 ready smoke row에만 적용한다.",
    ],
  };
};

const toGoogleAdsConversionDateTime = (value: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} 12:00:00+09:00`;
    return "";
  }

  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ")
    + "+09:00";
};

const buildGoogleAdsConfirmedPurchaseUploadPayloadHash = (candidate: {
  conversionActionResourceName: string;
  clickIdDigestPrefix: string;
  maskedOrderRef: string;
  conversionDateTime: string;
  conversionValue: number;
  currencyCode: "KRW";
}) => hashDiagnosticValue(JSON.stringify({
  conversionActionResourceName: candidate.conversionActionResourceName,
  clickIdDigestPrefix: candidate.clickIdDigestPrefix,
  maskedOrderRef: candidate.maskedOrderRef,
  conversionDateTime: candidate.conversionDateTime,
  conversionValue: candidate.conversionValue,
  currencyCode: candidate.currencyCode,
}), 24);

const isLikelySyntheticGoogleClickId = (value: string) => {
  const normalized = toStringValue(value).trim();
  if (!normalized) return false;

  /*
    Google Ads upload must never use click IDs that came from our smoke URLs.
    Real gclid values do not include these operator-created markers.
  */
  if (/(?:^|[_-])(TEST|SMOKE|PREVIEW|DUMMY|SAMPLE|DEBUG|CODEX|GTM)(?:[_-]|$)/i.test(normalized)) {
    return true;
  }

  if (/^(TEST|SMOKE|PREVIEW|DUMMY|SAMPLE|DEBUG|CODEX)(?:[_-]|$)/i.test(normalized)) {
    return true;
  }

  /*
    The invalid rows found on 2026-05-29 were short TEST-like values, not
    browser/URL corruption. Length alone is not used as a hard block because
    Google does not publish a stable gclid length contract.
  */
  return false;
};

const hasGoogleAdsUploadPayloadFields = (candidate: GoogleAdsConfirmedPurchaseUploadCandidate) =>
  Boolean(candidate.rawOrderId)
  && Boolean(candidate.rawGclid)
  && !isLikelySyntheticGoogleClickId(candidate.rawGclid)
  && Boolean(candidate.conversionDateTime)
  && candidate.conversionValue > 0;

const GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META: Record<
  GoogleAdsConfirmedPurchaseClickAgeDryRunStatus,
  { plain: string }
> = {
  within_action_click_window: {
    plain:
      "Google Ads 전환 액션의 클릭 인정 기간 안에 있는 후보입니다. 다른 중복/환불/형식 검사를 통과하면 전송 가능성이 있습니다.",
  },
  click_too_old_for_action: {
    plain:
      "광고 클릭 증거가 결제완료보다 너무 오래 전입니다. 현재 BI confirmed_purchase_offline 기준 30일을 넘으면 Google Ads가 구매로 붙이지 않을 가능성이 큽니다.",
  },
  too_recent_for_google_retry: {
    plain:
      "광고 클릭이 너무 최근입니다. Google Ads는 클릭 후 6시간 미만 전환을 바로 처리하지 못할 수 있어 나중에 재시도해야 합니다.",
  },
  click_time_unknown: {
    plain:
      "gclid는 있지만 그 gclid가 언제 잡혔는지 서버가 확정하지 못합니다. 오래된 클릭인지 판단할 수 없으므로 보류가 안전합니다.",
  },
  conversion_time_missing_or_invalid: {
    plain:
      "실제 결제완료 시각이 비어 있거나 날짜로 해석되지 않습니다. Google Ads 전송 시간값을 만들 수 없습니다.",
  },
  conversion_before_click: {
    plain:
      "결제완료가 클릭 증거보다 먼저 발생한 모양입니다. 시간대나 매칭 오류 가능성이 있어 전송하면 안 됩니다.",
  },
  missing_exact_gclid: {
    plain:
      "실제 구매여도 현재 전송기는 gclid 원문이 있는 후보만 보냅니다. gbraid/wbraid 단독 후보는 별도 확장 전까지 보류합니다.",
  },
  not_actual_purchase: {
    plain:
      "결제완료, 양수 금액, 취소/환불/반품 없음 기준을 통과하지 못했습니다. 실제 구매 전환으로 보낼 수 없습니다.",
  },
};

const parseGoogleAdsDryRunDateMs = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
};

const getGoogleAdsClickEvidenceCapturedAt = (row: GoogleAdsClickIdHealthOrderDiagnostic) => {
  /*
    payment_success logged/approved time is purchase-side time, not the original ad-click capture time.
    NPay intent captured_at is the closest stored point where the click id was carried into checkout.
  */
  return toStringValue(row.evidenceAt.npayIntentCapturedAt) || "";
};

const classifyGoogleAdsClickAgeDryRunRow = (
  row: GoogleAdsClickIdHealthOrderDiagnostic,
  actionClickThroughLookbackDays: number,
  nowMs: number,
): {
  status: GoogleAdsConfirmedPurchaseClickAgeDryRunStatus;
  clickAgeHours: number | null;
  clickAgeDays: number | null;
  clickCapturedAtKnown: boolean;
  reason: string;
} => {
  if (!row.actualPurchaseEligibility.passed) {
    return {
      status: "not_actual_purchase",
      clickAgeHours: null,
      clickAgeDays: null,
      clickCapturedAtKnown: false,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.not_actual_purchase.plain,
    };
  }

  if (!row.googleClickIds.gclid || isLikelySyntheticGoogleClickId(row.googleClickIds.gclid)) {
    return {
      status: "missing_exact_gclid",
      clickAgeHours: null,
      clickAgeDays: null,
      clickCapturedAtKnown: false,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.missing_exact_gclid.plain,
    };
  }

  const conversionMs = parseGoogleAdsDryRunDateMs(row.paidAt);
  if (conversionMs == null) {
    return {
      status: "conversion_time_missing_or_invalid",
      clickAgeHours: null,
      clickAgeDays: null,
      clickCapturedAtKnown: false,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.conversion_time_missing_or_invalid.plain,
    };
  }

  const clickCapturedAt = getGoogleAdsClickEvidenceCapturedAt(row);
  const clickMs = parseGoogleAdsDryRunDateMs(clickCapturedAt);
  if (clickMs == null) {
    return {
      status: "click_time_unknown",
      clickAgeHours: null,
      clickAgeDays: null,
      clickCapturedAtKnown: false,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.click_time_unknown.plain,
    };
  }

  const clickAgeHours = Math.round(((conversionMs - clickMs) / (60 * 60 * 1000)) * 10) / 10;
  const clickAgeDays = Math.round((clickAgeHours / 24) * 10) / 10;

  if (clickAgeHours < 0) {
    return {
      status: "conversion_before_click",
      clickAgeHours,
      clickAgeDays,
      clickCapturedAtKnown: true,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.conversion_before_click.plain,
    };
  }

  const clickUploadAgeHours = (nowMs - clickMs) / (60 * 60 * 1000);
  if (clickUploadAgeHours < GOOGLE_ADS_TOO_RECENT_RETRY_HOURS) {
    return {
      status: "too_recent_for_google_retry",
      clickAgeHours,
      clickAgeDays,
      clickCapturedAtKnown: true,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.too_recent_for_google_retry.plain,
    };
  }

  if (clickAgeDays > actionClickThroughLookbackDays) {
    return {
      status: "click_too_old_for_action",
      clickAgeHours,
      clickAgeDays,
      clickCapturedAtKnown: true,
      reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.click_too_old_for_action.plain,
    };
  }

  return {
    status: "within_action_click_window",
    clickAgeHours,
    clickAgeDays,
    clickCapturedAtKnown: true,
    reason: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META.within_action_click_window.plain,
  };
};

const buildGoogleAdsConfirmedPurchaseClickAgeDryRun = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
  actionClickThroughLookbackDays: number,
): Promise<GoogleAdsConfirmedPurchaseClickAgeDryRun> => {
  const diagnostics = await buildGoogleAdsClickIdOrderDiagnostics(window, {
    limit: 10000,
    only: "all",
  });
  const nowMs = Date.now();
  const countMap = new Map<GoogleAdsConfirmedPurchaseClickAgeDryRunStatus, { count: number; amountKrw: number }>();
  const addCount = (status: GoogleAdsConfirmedPurchaseClickAgeDryRunStatus, amountKrw: number) => {
    const current = countMap.get(status) ?? { count: 0, amountKrw: 0 };
    current.count += 1;
    current.amountKrw += amountKrw;
    countMap.set(status, current);
  };

  const rows = diagnostics.orders
    .map((row) => {
      const classification = classifyGoogleAdsClickAgeDryRunRow(
        row,
        actionClickThroughLookbackDays,
        nowMs,
      );
      addCount(classification.status, row.orderAmount);
      return {
        safeRef: `gads_click_age_${hashDiagnosticValue([
          row.orderNumber,
          row.paidAt,
          row.orderAmount,
          classification.status,
        ].join(":"), 14)}`,
        status: classification.status,
        amountKrw: row.orderAmount,
        paidDateKst: kstDate(row.paidAt),
        paymentMethod: classifyClickIdHealthPaymentMethod(row),
        evidenceSource: row.evidenceSource,
        clickAgeHours: classification.clickAgeHours,
        clickAgeDays: classification.clickAgeDays,
        clickCapturedAtKnown: classification.clickCapturedAtKnown,
        rawOrderIdExposed: false as const,
        rawClickIdExposed: false as const,
        reason: classification.reason,
      };
    });

  const limitedRows = rows
    .sort((a, b) => {
      const left = a.paidDateKst ? new Date(a.paidDateKst).getTime() : 0;
      const right = b.paidDateKst ? new Date(b.paidDateKst).getTime() : 0;
      return right - left;
    })
    .slice(0, requestedLimit);

  const statusCounts = (Object.keys(GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META) as GoogleAdsConfirmedPurchaseClickAgeDryRunStatus[])
    .map((status) => {
      const current = countMap.get(status) ?? { count: 0, amountKrw: 0 };
      return {
        status,
        count: current.count,
        amountKrw: Math.round(current.amountKrw),
        plain: GOOGLE_ADS_CLICK_AGE_DRY_RUN_STATUS_META[status].plain,
      };
    })
    .filter((row) => row.count > 0);

  const countOf = (status: GoogleAdsConfirmedPurchaseClickAgeDryRunStatus) =>
    countMap.get(status)?.count ?? 0;

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "click_age_dry_run_no_send",
    goal:
      "Google Ads에 실제 구매를 보내기 전, 광고 클릭 증거가 너무 오래됐거나 너무 최근인지 no-send로 먼저 가른다.",
    window,
    criteria: {
      actionClickThroughLookbackDays,
      googleClickIdStorageDays: GOOGLE_ADS_CLICK_ID_STORAGE_DAYS,
      tooRecentRetryHours: GOOGLE_ADS_TOO_RECENT_RETRY_HOURS,
      tooOldRulePlain:
        `현재 BI confirmed_purchase_offline 기준은 클릭일부터 결제완료일까지 ${actionClickThroughLookbackDays}일 이내입니다. 90일은 click id 보관의 바깥 한계이고, 이 전환 액션에는 ${actionClickThroughLookbackDays}일 기준이 먼저 적용됩니다.`,
      tooRecentRulePlain:
        `Google Ads는 클릭 후 ${GOOGLE_ADS_TOO_RECENT_RETRY_HOURS}시간이 지나지 않은 전환을 바로 처리하지 못할 수 있으므로 대기 후 재시도 대상으로 봅니다.`,
      unknownRulePlain:
        "gclid는 있지만 click id가 언제 포착됐는지 모르면 오래된 클릭인지 판단할 수 없어서 전송 보류로 보는 것이 안전합니다.",
    },
    summary: {
      actualPurchaseRows: diagnostics.orders.filter((row) => row.actualPurchaseEligibility.passed).length,
      exactGclidRows: diagnostics.orders.filter((row) =>
        row.actualPurchaseEligibility.passed
        && Boolean(row.googleClickIds.gclid)
        && !isLikelySyntheticGoogleClickId(row.googleClickIds.gclid)
      ).length,
      knownClickTimeRows: rows.filter((row) => row.clickCapturedAtKnown).length,
      withinActionClickWindowRows: countOf("within_action_click_window"),
      clickTooOldForActionRows: countOf("click_too_old_for_action"),
      tooRecentForGoogleRetryRows: countOf("too_recent_for_google_retry"),
      clickTimeUnknownRows: countOf("click_time_unknown"),
      notActualPurchaseRows: countOf("not_actual_purchase"),
      googleAdsSendCount: 0,
      vmCloudWriteCount: 0,
    },
    statusCounts,
    rows: limitedRows,
    invariants: {
      rawOrderIdInResponse: false,
      rawClickIdInResponse: false,
      externalSendCount: 0,
      operationalDbWrite: 0,
      vmCloudWrite: 0,
      googleAdsWrite: 0,
    },
    caveats: [
      "이 endpoint는 no-send dry-run이다. Google Ads conversion upload를 실행하지 않는다.",
      "운영DB나 VM Cloud SQLite에는 아무것도 쓰지 않는다.",
      "원문 주문번호와 원문 click id는 응답에 포함하지 않는다.",
      "payment_success 시각은 구매 시각이지 광고 클릭 포착 시각이 아니므로, NPay intent captured_at이 없으면 click_time_unknown으로 보수 분류한다.",
      "gbraid/wbraid 단독 후보는 현재 실제 전송기에서 아직 one-of click id로 보내지 않으므로 missing_exact_gclid에 포함될 수 있다.",
    ],
  };
};

const buildGoogleAdsConfirmedPurchaseUploadCandidates = async (
  window: GoogleAdsClickIdHealthWindow,
  requestedLimit: number,
): Promise<GoogleAdsConfirmedPurchaseUploadCandidate[]> => {
  const sendLimit = Math.min(Math.max(requestedLimit, 1), 20);
  const scanLimit = Math.max(sendLimit * 25, 50);
  const diagnostics = await buildGoogleAdsClickIdOrderDiagnostics(window, {
    limit: 10000,
    only: "with_click_id",
  });
  const directRows = diagnostics.orders.filter((row) =>
    row.actualPurchaseEligibility.passed
    && Boolean(row.googleClickIds.gclid)
  );

  const npayReport = await buildNpayIntentRematchDryRunReport({
    start: window.startAt,
    end: window.endExclusiveAt ?? window.endAt,
    site: "biocom",
    includeOnlyPending: false,
    includeRawClickIds: true,
    limit: 500,
  });
  const npayRows = npayReport.candidates.filter((row) =>
    row.strongGrade === "A"
    && row.recommendedAction === "safe_apply_candidate_after_write_approval"
    && row.orderCreateTimeBridge === "exact"
    && row.npayBridgeUrlHashPresent
    && Boolean(row.clickIds.gclid)
    && (row.orderAmount ?? 0) > 0
  );

  const db = getCrmDb();
  db.exec(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL);
  const ledgerLookup = db.prepare(`
    SELECT id, status, sent_at
    FROM ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE}
    WHERE site = 'biocom'
      AND conversion_action_id = ?
      AND dedupe_key_hash = ?
    LIMIT 1
  `);

  const buildCandidate = ({
    rank,
    candidateSource,
    orderNumber,
    rawGclid,
    paidAt,
    amountKrw,
    paymentKind,
  }: {
    rank: number;
    candidateSource: GoogleAdsConfirmedPurchaseUploadCandidate["candidateSource"];
    orderNumber: string;
    rawGclid: string;
    paidAt: string | Date | null;
    amountKrw: number;
    paymentKind: "confirmed_purchase" | "confirmed_purchase_npay_bridge";
  }): GoogleAdsConfirmedPurchaseUploadCandidate => {
    const normalizedOrderNumber = toStringValue(orderNumber);
    const conversionDateTime = toGoogleAdsConversionDateTime(paidAt);
    const paidDateKst = kstDate(paidAt);
    const duplicateSendKeyHash = hashDiagnosticValue(
      [
        GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
        normalizedOrderNumber,
        paymentKind,
      ].join(":"),
      24,
    );
    const dedupeKeyHash = hashDiagnosticValue(JSON.stringify({
      site: "biocom",
      conversionActionId: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
      duplicateSendKeyHash,
      amountKrw,
      currencyCode: "KRW",
      paidDateKst,
    }), 24);
    const maskedOrderRef = `order_${hashDiagnosticValue(normalizedOrderNumber, 12)}`;
    const safeRef = `gads_private_${hashDiagnosticValue([
      normalizedOrderNumber,
      rawGclid,
      paidAt,
      paymentKind,
    ].join(":"), 14)}`;
    const conversionActionResourceName = getConfirmedPurchaseConversionActionResourceName();
    const payloadHash = buildGoogleAdsConfirmedPurchaseUploadPayloadHash({
      conversionActionResourceName,
      clickIdDigestPrefix: hashDiagnosticValue(rawGclid, 12),
      maskedOrderRef,
      conversionDateTime,
      conversionValue: amountKrw,
      currencyCode: "KRW",
    });
    const ledgerRow = ledgerLookup.get(
      GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
      dedupeKeyHash,
    ) as { id?: unknown; status?: unknown; sent_at?: unknown } | undefined;
    const ledgerStatus = toStringValue(ledgerRow?.status);
    const blockReasons = [
      normalizedOrderNumber ? "" : "missing_original_order_id",
      rawGclid ? "" : "missing_gclid",
      isLikelySyntheticGoogleClickId(rawGclid) ? "synthetic_or_test_gclid" : "",
      conversionDateTime ? "" : "missing_conversion_date_time",
      amountKrw > 0 ? "" : "non_positive_conversion_value",
      ledgerRow ? "" : "missing_ready_ledger_row",
      ledgerStatus === "ready" ? "" : `ledger_status_not_ready:${ledgerStatus || "none"}`,
      toStringValue(ledgerRow?.sent_at) ? "already_sent" : "",
    ].filter(Boolean);

    return {
      candidateRank: rank,
      safeRef,
      maskedOrderRef,
      candidateSource,
      rawOrderId: normalizedOrderNumber,
      rawGclid,
      conversionActionId: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
      conversionActionName: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_NAME,
      conversionActionResourceName,
      conversionDateTime,
      conversionValue: amountKrw,
      currencyCode: "KRW",
      duplicateSendKeyHash,
      dedupeKeyHash,
      payloadHash,
      ledgerRowId: toNumber(ledgerRow?.id) || null,
      ledgerStatus,
      sendReady: blockReasons.length === 0,
      blockReasons,
    };
  };

  const rawCandidates = [
    ...npayRows.map((row) => ({
      candidateSource: "npay_bridge_grade_a_gclid" as const,
      orderNumber: toStringValue(row.orderNumber) || toStringValue(row.channelOrderNo),
      rawGclid: row.clickIds.gclid,
      paidAt: row.paidAt,
      amountKrw: row.orderAmount ?? 0,
      paymentKind: "confirmed_purchase_npay_bridge" as const,
    })),
    ...directRows.map((row) => ({
      candidateSource: "homepage_direct_gclid" as const,
      orderNumber: toStringValue(row.orderNumber),
      rawGclid: row.googleClickIds.gclid,
      paidAt: row.paidAt,
      amountKrw: row.orderAmount,
      paymentKind: "confirmed_purchase" as const,
    })),
  ].filter((candidate) => !isLikelySyntheticGoogleClickId(candidate.rawGclid));

  const seen = new Set<string>();
  const uniqueCandidates = rawCandidates.filter((candidate) => {
    const key = [
      candidate.candidateSource,
      candidate.orderNumber,
      candidate.rawGclid ? hashDiagnosticValue(candidate.rawGclid, 12) : "",
      candidate.amountKrw,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueCandidates.slice(0, scanLimit).map((candidate, index) => buildCandidate({
    ...candidate,
    rank: index + 1,
  }));
};

const extractPartialFailureIndexes = (body: unknown) => {
  const indexes = new Set<number>();
  const root = getGoogleAdsErrorRoot(body);
  const { failureErrors } = getGoogleAdsFailureErrors(root);
  failureErrors.filter(isRecord).forEach((error) => {
    const location = isRecord(error.location) ? error.location : {};
    const elements = Array.isArray(location.fieldPathElements) ? location.fieldPathElements : [];
    elements.filter(isRecord).forEach((element) => {
      const index = toOptionalNumber(element.index);
      if (index != null) indexes.add(index);
    });
  });
  return indexes;
};

const redactGoogleAdsUploadErrorText = (
  value: string,
  candidate: GoogleAdsConfirmedPurchaseUploadCandidate,
) => {
  let next = value;
  if (candidate.rawGclid) {
    next = next.split(candidate.rawGclid).join("[redacted_click_id]");
  }
  if (candidate.rawOrderId) {
    next = next.split(candidate.rawOrderId).join("[redacted_order_id]");
  }
  return next;
};

const buildGoogleAdsUploadFailureLastError = (
  upload: GoogleAdsClickConversionUploadResponse,
  candidate: GoogleAdsConfirmedPurchaseUploadCandidate,
  index: number,
) => {
  const summary = upload.errorSummary;
  const errors = summary?.googleAdsErrors ?? [];
  const matchingErrors = errors.filter((error) => error.index == null || error.index === index);
  const selectedErrors = matchingErrors.length > 0 ? matchingErrors : errors;
  const errorText = selectedErrors.slice(0, 3).map((error) => {
    const code = JSON.stringify(error.errorCode ?? {});
    const message = error.message || "no_message";
    const fieldPath = error.fieldPath || "unknown_field";
    return `${fieldPath}:${message || code}`;
  }).join(" | ");
  const fallbackText = [
    summary?.status ? `status=${summary.status}` : "",
    summary?.message ? `message=${summary.message}` : "",
    summary?.rawPreview ? `preview=${summary.rawPreview}` : "",
  ].filter(Boolean).join(" | ");
  const detail = redactGoogleAdsUploadErrorText(errorText || fallbackText || "details_unparsed", candidate);
  return [
    "google_ads_upload_partial_failure",
    `hash=${upload.responseHash}`,
    `http=${upload.status}`,
    `request_id=${upload.requestId ? "present" : "missing"}`,
    `index=${index}`,
    `detail=${detail}`,
  ].join(";").slice(0, 900);
};

const uploadGoogleAdsClickConversions = async (
  context: GoogleAdsClientContext,
  candidates: GoogleAdsConfirmedPurchaseUploadCandidate[],
  validateOnly: boolean,
): Promise<GoogleAdsClickConversionUploadResponse> => {
  const url = `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}:uploadClickConversions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      "developer-token": context.developerToken,
      ...(context.loginCustomerId ? { "login-customer-id": context.loginCustomerId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversions: candidates.map((candidate) => ({
        conversionAction: candidate.conversionActionResourceName,
        gclid: candidate.rawGclid,
        conversionValue: candidate.conversionValue,
        conversionDateTime: candidate.conversionDateTime,
        currencyCode: candidate.currencyCode,
        orderId: candidate.rawOrderId,
      })),
      partialFailure: true,
      validateOnly,
    }),
  });
  const requestId = response.headers.get("request-id") || response.headers.get("x-request-id") || "";
  const text = await response.text();
  const responseHash = hashDiagnosticValue(text, 24);
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      requestId,
      responseHash,
      resultCount: 0,
      partialFailure: false,
      sentIndexes: new Set(),
      failedIndexes: new Set(candidates.map((_, index) => index)),
      errorSummary: summarizeGoogleAdsError(text),
    };
  }

  const results = isRecord(body) && Array.isArray(body.results) ? body.results : [];
  const failedIndexes = extractPartialFailureIndexes(body);
  const sentIndexes = new Set<number>();
  results.forEach((_, index) => {
    if (!failedIndexes.has(index)) {
      sentIndexes.add(index);
    }
  });
  const partialFailure = failedIndexes.size > 0;
  return {
    ok: true,
    status: response.status,
    requestId,
    responseHash,
    resultCount: results.length,
    partialFailure,
    sentIndexes,
    failedIndexes,
    errorSummary: partialFailure ? summarizeGoogleAdsError(JSON.stringify(body)) : null,
  };
};

const markGoogleAdsUploadLedgerRows = (
  candidates: GoogleAdsConfirmedPurchaseUploadCandidate[],
  upload: GoogleAdsClickConversionUploadResponse,
) => {
  const db = getCrmDb();
  const now = new Date().toISOString();
  const mark = db.prepare(`
    UPDATE ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE}
    SET
      status = @status,
      google_ads_request_id = @requestId,
      google_ads_response_code = @responseCode,
      google_ads_response_hash = @responseHash,
      sent_at = @sentAt,
      updated_at = @updatedAt,
      last_error = @lastError
    WHERE id = @id
      AND status = 'ready'
      AND sent_at IS NULL
  `);

  return db.transaction(() => candidates.map((candidate, index) => {
      const sent = upload.ok && upload.sentIndexes.has(index);
      const failed = !sent;
      const lastError = failed
        ? buildGoogleAdsUploadFailureLastError(upload, candidate, index)
        : "";
      const changes = candidate.ledgerRowId
        ? mark.run({
          id: candidate.ledgerRowId,
          status: sent ? "sent" : "failed",
          requestId: upload.requestId,
          responseCode: String(upload.status),
          responseHash: upload.responseHash,
          sentAt: sent ? now : null,
          updatedAt: now,
          lastError,
        }).changes
        : 0;

    return {
      candidateRank: candidate.candidateRank,
      safeRef: candidate.safeRef,
      maskedOrderRef: candidate.maskedOrderRef,
      amountKrw: candidate.conversionValue,
      conversionDateTime: candidate.conversionDateTime.slice(0, 10),
      ledgerRowUpdated: changes > 0,
      statusAfter: sent ? "sent" : "failed",
      failureSummary: failed ? lastError : "",
      rawOrderIdExposed: false,
      rawClickIdExposed: false,
    };
  }))();
};

const getExactGoogleClickIdType = (
  row: GoogleAdsClickIdHealthOrderDiagnostic,
): "gclid" | "gbraid" | "wbraid" | "mixed" | "none" => {
  if (row.clickIdTypes.gclid) return "gclid";
  const types = [
    row.clickIdTypes.gbraid ? "gbraid" : "",
    row.clickIdTypes.wbraid ? "wbraid" : "",
  ].filter(Boolean);
  if (types.length === 0) return "none";
  if (types.length > 1) return "mixed";
  return types[0] as "gclid" | "gbraid" | "wbraid";
};

const buildGoogleAdsConfirmedPurchaseCandidateExpansion = async (
  window: GoogleAdsClickIdHealthWindow,
  limit: number,
  sourceFreshness: OperationalDbFreshness,
): Promise<GoogleAdsConfirmedPurchaseCandidateExpansion> => {
  const diagnostics = await buildGoogleAdsClickIdOrderDiagnostics(window, {
    limit: 10000,
    only: "all",
  });
  const tierRows = new Map<GoogleAdsConfirmedPurchaseCandidateExpansionTier["key"], GoogleAdsClickIdHealthOrderDiagnostic[]>();
  const pushTier = (
    key: GoogleAdsConfirmedPurchaseCandidateExpansionTier["key"],
    row: GoogleAdsClickIdHealthOrderDiagnostic,
  ) => {
    const current = tierRows.get(key) ?? [];
    current.push(row);
    tierRows.set(key, current);
  };

  for (const row of diagnostics.orders) {
    if (!row.actualPurchaseEligibility.passed) {
      pushTier("not_actual_purchase", row);
      continue;
    }

    const exactType = getExactGoogleClickIdType(row);
    if (exactType === "gclid") {
      pushTier("ready_exact_gclid", row);
    } else if (exactType === "gbraid" || exactType === "wbraid") {
      pushTier("potential_one_of_gbraid_wbraid", row);
    } else if (exactType === "mixed") {
      pushTier("mixed_google_click_ids", row);
    } else if (row.evidenceSource !== "none") {
      pushTier("internal_bridge_without_google_click_id", row);
    } else {
      pushTier("missing_click_bridge", row);
    }
  }

  const amountOf = (rows: GoogleAdsClickIdHealthOrderDiagnostic[]) =>
    Math.round(rows.reduce((sum, row) => sum + row.orderAmount, 0));
  const tier = (
    key: GoogleAdsConfirmedPurchaseCandidateExpansionTier["key"],
    label: string,
    googleAdsSendPolicy: GoogleAdsConfirmedPurchaseCandidateExpansionTier["googleAdsSendPolicy"],
    plain: string,
  ): GoogleAdsConfirmedPurchaseCandidateExpansionTier => {
    const rows = tierRows.get(key) ?? [];
    return {
      key,
      label,
      count: rows.length,
      amountKrw: amountOf(rows),
      googleAdsSendPolicy,
      plain,
    };
  };

  const tiers = [
    tier(
      "ready_exact_gclid",
      "1단계 후보: 실제 구매 + gclid 직접 연결",
      "no_send_ready_after_ledger_and_red_approval",
      "실제 결제완료이고 gclid가 직접 붙어 있습니다. 장부 write smoke와 Red 승인 후 제한 전송 후보가 될 수 있습니다.",
    ),
    tier(
      "potential_one_of_gbraid_wbraid",
      "2단계 후보: 실제 구매 + gbraid/wbraid 단독 연결",
      "no_send_needs_payload_builder",
      "실제 결제완료이고 Google click id가 하나만 있습니다. 현재 builder는 gclid만 다루므로 gbraid/wbraid payload 확장이 필요합니다.",
    ),
    tier(
      "mixed_google_click_ids",
      "보류 후보: Google click id가 여러 종류 섞임",
      "no_send_needs_manual_disambiguation",
      "실제 구매지만 gclid/gbraid/wbraid가 섞인 경우입니다. Google에는 한 주문에 어떤 click id를 쓸지 명확해야 하므로 자동 전송하지 않습니다.",
    ),
    tier(
      "internal_bridge_without_google_click_id",
      "내부 bridge 후보: 결제 연결은 있으나 Google click id 없음",
      "no_send_internal_analysis_only",
      "내부 여정 분석에는 쓸 수 있지만 Google Ads에 보낼 직접 click id가 없어 전송 후보가 아닙니다.",
    ),
    tier(
      "missing_click_bridge",
      "미연결 실제 구매: 광고 click 증거 없음",
      "no_send_missing_google_click_id",
      "실제 구매는 맞지만 Google click id와 내부 bridge가 없어 Google Ads 전송 근거가 없습니다.",
    ),
    tier(
      "not_actual_purchase",
      "제외: 실제 결제완료 기준 미통과",
      "no_send_not_actual_purchase",
      "결제완료, 양수 금액, 취소/반품/환불 없음 기준을 통과하지 못했습니다.",
    ),
  ];

  const actualPurchaseRows = diagnostics.orders.filter((row) => row.actualPurchaseEligibility.passed);
  const npayBridgeReview = await buildGoogleNpayBridgeReview({
    dateRange: window,
    campaigns: [],
  });
  const npayBridgeGradeAWithGoogleClickIdRows = npayBridgeReview.summary.gradeAWithDirectGoogleClickId;
  const npayBridgeGradeAWithGoogleClickIdAmountKrw =
    npayBridgeReview.summary.gradeADirectGoogleClickIdAmountKrw;
  const npayBridgeGradeARecoveredGoogleClickIdRows =
    npayBridgeReview.summary.gradeAWithRecoveredGoogleClickId;
  const npayBridgeGradeARecoveredGoogleClickIdAmountKrw =
    npayBridgeReview.summary.gradeARecoveredGoogleClickIdAmountKrw;
  const npayBridgeGradeANeedsClickIdRecoveryRows =
    npayBridgeReview.summary.gradeANeedsClickIdRecoveryRows;
  const sampleRows = tiers
    .flatMap((tierItem) =>
      (tierRows.get(tierItem.key) ?? []).slice(0, Math.max(1, Math.ceil(limit / tiers.length))).map((row) => {
        const exactType = getExactGoogleClickIdType(row);
        const whyNotSendYet =
          tierItem.key === "ready_exact_gclid"
            ? "장부 write smoke와 Google Ads 제한 전송 승인이 아직 남아 있습니다."
            : tierItem.plain;
        return {
          safeRef: `gads_expand_${hashDiagnosticValue([
            row.orderNumber,
            row.paidAt,
            row.orderAmount,
            tierItem.key,
          ].join(":"), 14)}`,
          tier: tierItem.key,
          amountKrw: row.orderAmount,
          paidDateKst: kstDate(row.paidAt),
          paymentMethod: classifyClickIdHealthPaymentMethod(row),
          evidenceSource: row.evidenceSource,
          clickIdTypes: {
            hasGclid: exactType === "gclid" || exactType === "mixed" && row.clickIdTypes.gclid,
            hasGbraid: exactType === "gbraid" || exactType === "mixed" && row.clickIdTypes.gbraid,
            hasWbraid: exactType === "wbraid" || exactType === "mixed" && row.clickIdTypes.wbraid,
          },
          rawOrderIdExposed: false as const,
          rawClickIdExposed: false as const,
          whyNotSendYet,
        };
      })
    )
    .slice(0, limit);

  const readyExactGclidRows = tierRows.get("ready_exact_gclid")?.length ?? 0;
  const potentialOneOfBraidRows = tierRows.get("potential_one_of_gbraid_wbraid")?.length ?? 0;
  const actualPurchaseCandidateReadinessPct =
    actualPurchaseRows.length > 0
      ? Math.round(((readyExactGclidRows + potentialOneOfBraidRows) / actualPurchaseRows.length) * 1000) / 10
      : 0;
  const actualPurchaseCandidateDiscoveryPct =
    actualPurchaseRows.length > 0
      ? Math.round(
        ((readyExactGclidRows
          + potentialOneOfBraidRows
          + npayBridgeGradeAWithGoogleClickIdRows
          + npayBridgeGradeARecoveredGoogleClickIdRows)
          / actualPurchaseRows.length) * 1000,
      ) / 10
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "confirmed_purchase_candidate_expansion_no_send",
    goal:
      "실제 구매완료 주문 중 Google Ads 주 전환으로 보낼 수 있는 후보와 아직 못 보내는 후보를 주문 단위로 넓게 분류한다.",
    progress: {
      actualPurchaseCandidateReadinessPct,
      actualPurchaseCandidateDiscoveryPct,
      overallPrimaryConversionReadinessPct: readyExactGclidRows > 0 ? 88 : 84,
      plain:
        "실제 구매 주문을 Google Ads 전송 가능성별로 나눴습니다. NPay bridge A급 후보도 별도로 세지만, 영구 bridge 장부와 Red 승인 전에는 전송하지 않습니다.",
    },
    window,
    sourceFreshness,
    summary: {
      actualPurchaseRows: actualPurchaseRows.length,
      actualPurchaseRevenueKrw: amountOf(actualPurchaseRows),
      readyExactGclidRows,
      potentialOneOfBraidRows,
      mixedGoogleClickIdRows: tierRows.get("mixed_google_click_ids")?.length ?? 0,
      npayBridgeGradeAWithGoogleClickIdRows,
      npayBridgeGradeAWithGoogleClickIdAmountKrw,
      npayBridgeGradeARecoveredGoogleClickIdRows,
      npayBridgeGradeARecoveredGoogleClickIdAmountKrw,
      npayBridgeGradeANeedsClickIdRecoveryRows,
      internalBridgeWithoutGoogleClickIdRows: tierRows.get("internal_bridge_without_google_click_id")?.length ?? 0,
      missingClickBridgeRows: tierRows.get("missing_click_bridge")?.length ?? 0,
      notActualPurchaseRows: tierRows.get("not_actual_purchase")?.length ?? 0,
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
    },
    tiers: [
      ...tiers.slice(0, 3),
      {
        key: "npay_bridge_grade_a_google_click_id_no_write",
        label: "확대 후보: NPay 실제 결제완료 + 내부 bridge A급 + 직접 Google click id",
        count: npayBridgeGradeAWithGoogleClickIdRows,
        amountKrw: npayBridgeGradeAWithGoogleClickIdAmountKrw,
        googleAdsSendPolicy: "no_send_needs_bridge_write_and_red_approval",
        plain:
          "NPay 외부 결제라 결제완료 row에 click id가 직접 남기 어렵지만, 내부 bridge가 A급으로 연결한 후보입니다. 영구 bridge 장부 write와 중복/환불 guard 전까지 Google Ads에 보내지 않습니다.",
      },
      {
        key: "npay_bridge_grade_a_recovered_google_click_id_no_write",
        label: "확대 후보: NPay bridge A급 + 같은 세션 Google click id 복구",
        count: npayBridgeGradeARecoveredGoogleClickIdRows,
        amountKrw: npayBridgeGradeARecoveredGoogleClickIdAmountKrw,
        googleAdsSendPolicy: "no_send_needs_bridge_write_and_red_approval",
        plain:
          "NPay intent row 자체에는 click id가 없지만 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 click id 흔적을 찾은 후보입니다. 원문값 보관 여부와 중복 방지 장부 검증 전에는 전송하지 않습니다.",
      },
      ...tiers.slice(3),
    ],
    sampleRows,
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
      "이 endpoint는 no-send/read-only다. Google Ads conversion upload를 실행하지 않는다.",
      "응답에는 원문 주문번호와 원문 click id를 포함하지 않는다.",
      "gbraid/wbraid 단독 후보는 Google Ads payload builder가 one-of click id를 지원하도록 확장된 뒤 별도 검증이 필요하다.",
      "NPay bridge A급 후보는 no-write discovery다. 실제 Google Ads 전송 후보가 되려면 영구 bridge 장부, 중복/환불 guard, Red 승인이 추가로 필요하다.",
      "같은 세션/클라이언트에서 복구한 click id는 후보율 확대 진단용이다. 원문값 보관 여부와 주문별 private preview 검증 전까지 Google Ads 전송 후보로 세지 않는다.",
      "내부 bridge 후보는 예산 판단 보조에는 쓸 수 있지만 Google Ads 전송 후보로 자동 승격하지 않는다.",
    ],
  };
};

const GOOGLE_ADS_OFFLINE_CLASSIFICATION_META: Record<
  GoogleAdsOfflineDiagnosticClassificationKey,
  {
    label: string;
    plain: string;
    sendPolicy: GoogleAdsOfflineDiagnosticClassification["classificationCounts"][number]["sendPolicy"];
  }
> = {
  ready_ledger_waiting_send: {
    label: "전송 가능 출발점",
    plain:
      "실제 구매, Google click id, 금액, 중복 방지 key가 준비된 row입니다. 장부 status가 ready이거나 ready로 올릴 수 있는 출발점이며, 별도 전송 승인 또는 자동 전송 조건이 맞으면 보낼 수 있습니다.",
    sendPolicy: "ready_after_send_approval",
  },
  sent_waiting_or_reflected: {
    label: "이미 전송됨 또는 반영 대기",
    plain:
      "Google Ads API로 전송한 row입니다. 리포트 반영 여부는 별도 Google Ads 조회와 맞춰야 하므로, 이 분류 자체는 추가 전송 후보가 아닙니다.",
    sendPolicy: "diagnostic_only",
  },
  failed_click_too_old_for_action: {
    label: "클릭 연결 기간 초과",
    plain:
      "전환 액션의 클릭 연결 기간보다 오래된 click id로 보입니다. 현재 BI confirmed_purchase_offline은 30일 기준이므로, 클릭일부터 결제완료일까지 30일을 넘은 row는 Google Ads가 구매로 붙이지 않을 수 있습니다.",
    sendPolicy: "do_not_send",
  },
  failed_invalid_or_test_click_id: {
    label: "테스트/잘못된 click id",
    plain:
      "TEST, SMOKE, GTM preview처럼 운영 광고 클릭이 아닌 값이거나 형식이 의심되는 click id입니다. 실제 구매 전환으로 보내면 안 됩니다.",
    sendPolicy: "do_not_send",
  },
  failed_google_ads_partial_failure: {
    label: "Google Ads 부분 실패",
    plain:
      "Google Ads API가 row 일부를 실패로 돌려준 상태입니다. 실패 원문 요약을 보고 재전송 가능 여부를 따로 판단해야 합니다.",
    sendPolicy: "manual_review_before_send",
  },
  candidate_missing_google_click_id: {
    label: "실제 구매지만 Google click id 없음",
    plain:
      "실제 결제완료 주문은 맞지만 gclid/gbraid/wbraid가 없어 Google Ads에 광고 클릭 구매로 되돌려 보낼 근거가 없습니다.",
    sendPolicy: "do_not_send",
  },
  candidate_needs_bridge_write: {
    label: "bridge 장부 필요",
    plain:
      "NPay처럼 외부 결제에서 내부 연결은 강하지만, 영구 bridge 장부와 중복/환불 guard가 아직 닫히지 않은 후보입니다.",
    sendPolicy: "manual_review_before_send",
  },
  candidate_not_actual_purchase: {
    label: "실제 구매 아님",
    plain:
      "결제완료, 양수 금액, 취소/환불 제외 기준을 통과하지 못했습니다. Google Ads 실제 구매 전환으로 보내면 안 됩니다.",
    sendPolicy: "do_not_send",
  },
  needs_manual_review: {
    label: "수동 검토 필요",
    plain:
      "자동 규칙으로 확정하기 어려운 상태입니다. 실패 메시지, 장부 status, 후보 tier를 함께 봐야 합니다.",
    sendPolicy: "manual_review_before_send",
  },
};

const classifyGoogleAdsOfflineDiagnosticLedgerRow = (row: {
  status?: unknown;
  last_error?: unknown;
  block_reason?: unknown;
}): GoogleAdsOfflineDiagnosticClassificationKey => {
  const status = toStringValue(row.status).toLowerCase();
  const lastError = toStringValue(row.last_error).toLowerCase();
  const blockReason = toStringValue(row.block_reason).toLowerCase();
  const material = `${status} ${lastError} ${blockReason}`;

  if (status === "ready") return "ready_ledger_waiting_send";
  if (status === "sent") return "sent_waiting_or_reflected";
  const clickTooOldForAction =
    material.includes("too old")
    || material.includes("older than")
    || material.includes("expired_event")
    || material.includes("click-through window")
    || material.includes("click through window")
    || material.includes("conversion click-through window")
    || material.includes("click occurred before")
    || ((material.includes("identifier") || material.includes("ios url")) && material.includes("old"))
    || (material.includes("click") && material.includes("window") && material.includes("before"))
    || (material.includes("click") && material.includes("period") && material.includes("before"));

  if (clickTooOldForAction) {
    return "failed_click_too_old_for_action";
  }
  if (
    material.includes("synthetic")
    || material.includes("test_gclid")
    || material.includes("test click")
    || material.includes("smoke")
    || material.includes("preview")
    || material.includes("gtm")
  ) {
    return "failed_invalid_or_test_click_id";
  }
  if (status === "failed") return "failed_google_ads_partial_failure";
  return "needs_manual_review";
};

const classifyGoogleAdsCandidateExpansionTier = (
  key: GoogleAdsConfirmedPurchaseCandidateExpansionTier["key"],
): GoogleAdsOfflineDiagnosticClassificationKey => {
  if (key === "ready_exact_gclid") return "ready_ledger_waiting_send";
  if (
    key === "npay_bridge_grade_a_google_click_id_no_write"
    || key === "npay_bridge_grade_a_recovered_google_click_id_no_write"
  ) {
    return "candidate_needs_bridge_write";
  }
  if (key === "internal_bridge_without_google_click_id" || key === "missing_click_bridge") {
    return "candidate_missing_google_click_id";
  }
  if (key === "not_actual_purchase") return "candidate_not_actual_purchase";
  return "needs_manual_review";
};

const buildGoogleAdsOfflineDiagnosticClassification = async (
  window: GoogleAdsClickIdHealthWindow,
  limit: number,
  sourceFreshness: OperationalDbFreshness,
): Promise<GoogleAdsOfflineDiagnosticClassification> => {
  const db = getCrmDb();
  db.exec(GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_SCHEMA_SQL);
  const ledgerRows = db.prepare(`
    SELECT
      id,
      safe_ref,
      conversion_time_kst,
      conversion_value_krw,
      status,
      block_reason,
      sent_at,
      last_error
    FROM ${GOOGLE_ADS_CONFIRMED_PURCHASE_UPLOAD_LEDGER_TABLE}
    WHERE site = 'biocom'
      AND conversion_action_id = ?
      AND substr(conversion_time_kst, 1, 10) >= ?
      AND substr(conversion_time_kst, 1, 10) <= ?
    ORDER BY datetime(COALESCE(sent_at, updated_at, created_at)) DESC, id DESC
    LIMIT ?
  `).all(
    GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
    window.startDate,
    window.endDate,
    Math.max(limit, 80),
  ) as Array<Record<string, unknown>>;

  const candidateExpansion = await buildGoogleAdsConfirmedPurchaseCandidateExpansion(window, limit, sourceFreshness);
  const countMap = new Map<GoogleAdsOfflineDiagnosticClassificationKey, { count: number; amountKrw: number }>();
  const addCount = (key: GoogleAdsOfflineDiagnosticClassificationKey, count: number, amountKrw: number) => {
    const current = countMap.get(key) ?? { count: 0, amountKrw: 0 };
    current.count += count;
    current.amountKrw += amountKrw;
    countMap.set(key, current);
  };

  const ledgerRecentRows = ledgerRows.map((row) => {
    const classification = classifyGoogleAdsOfflineDiagnosticLedgerRow(row);
    const amountKrw = toNumber(row.conversion_value_krw);
    addCount(classification, 1, amountKrw);
    return {
      safeRef: `ledger_${hashDiagnosticValue(String(row.id ?? row.safe_ref ?? ""), 12)}`,
      rowSource: "upload_ledger" as const,
      classification,
      amountKrw,
      conversionDateKst: toStringValue(row.conversion_time_kst).slice(0, 10),
      ledgerStatus: toStringValue(row.status) || null,
      reason: toStringValue(row.last_error) || toStringValue(row.block_reason) || GOOGLE_ADS_OFFLINE_CLASSIFICATION_META[classification].plain,
      rawOrderIdExposed: false as const,
      rawClickIdExposed: false as const,
    };
  });

  for (const tier of candidateExpansion.tiers) {
    const classification = classifyGoogleAdsCandidateExpansionTier(tier.key);
    addCount(classification, tier.count, tier.amountKrw);
  }

  const candidateRecentRows = candidateExpansion.sampleRows.slice(0, Math.max(0, limit - ledgerRecentRows.length)).map((row) => {
    const classification = classifyGoogleAdsCandidateExpansionTier(row.tier);
    return {
      safeRef: row.safeRef,
      rowSource: "candidate_expansion" as const,
      classification,
      amountKrw: row.amountKrw,
      conversionDateKst: row.paidDateKst,
      ledgerStatus: null,
      reason: row.whyNotSendYet,
      rawOrderIdExposed: false as const,
      rawClickIdExposed: false as const,
    };
  });

  const classificationCounts = (Object.keys(GOOGLE_ADS_OFFLINE_CLASSIFICATION_META) as GoogleAdsOfflineDiagnosticClassificationKey[])
    .map((key) => {
      const current = countMap.get(key) ?? { count: 0, amountKrw: 0 };
      const meta = GOOGLE_ADS_OFFLINE_CLASSIFICATION_META[key];
      return {
        key,
        label: meta.label,
        count: current.count,
        amountKrw: Math.round(current.amountKrw),
        plain: meta.plain,
        sendPolicy: meta.sendPolicy,
      };
    })
    .filter((row) => row.count > 0);

  const googleAdsSendCandidateRows = classificationCounts
    .filter((row) => row.sendPolicy === "ready_after_send_approval")
    .reduce((sum, row) => sum + row.count, 0);
  const googleAdsSendCandidateAmountKrw = classificationCounts
    .filter((row) => row.sendPolicy === "ready_after_send_approval")
    .reduce((sum, row) => sum + row.amountKrw, 0);

  return {
    generatedAt: new Date().toISOString(),
    site: "biocom",
    mode: "offline_diagnostic_classification_no_send",
    goal:
      "Google Ads 오프라인 전환 진단에서 보이는 오류/대기 row와 실제 구매 후보 확장 규칙을 섞지 않고 분리해서 설명한다.",
    window,
    sourceFreshness,
    summary: {
      ledgerRowsInWindow: ledgerRows.length,
      candidateRowsInWindow: candidateExpansion.summary.actualPurchaseRows,
      actualPurchaseRows: candidateExpansion.summary.actualPurchaseRows,
      classifiedRows: classificationCounts.reduce((sum, row) => sum + row.count, 0),
      googleAdsSendCandidateRows,
      googleAdsSendCandidateAmountKrw,
      externalSendCount: 0,
    },
    classificationCounts,
    separationGuide: {
      classificationPurpose:
        "분류 결과는 이미 보낸 row 또는 후보 row가 왜 반영/전송되지 않는지 설명하는 진단표입니다.",
      sendExpansionPurpose:
        "전송 후보 확장 규칙은 앞으로 Google Ads에 실제 구매로 보낼 수 있는 주문을 고르는 별도 기준입니다.",
      plain:
        "즉, '클릭 기간 초과 1건' 같은 진단 숫자가 곧바로 '보낼 수 있는 주문 1건'이라는 뜻은 아닙니다. 진단표와 전송 후보표를 분리해서 봐야 과전송을 막을 수 있습니다.",
    },
    recentRows: [...ledgerRecentRows, ...candidateRecentRows].slice(0, limit),
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
      "이 endpoint는 no-send/read-only다. Google Ads 전송을 실행하지 않는다.",
      "ledger row는 실제 전송 장부 상태를 설명하고, candidate row는 아직 장부에 안 오른 후보를 설명한다.",
      "분류 결과는 Google Ads 전송 승인이나 자동 전송 실행을 의미하지 않는다.",
      "응답에는 원문 주문번호와 원문 click id를 포함하지 않는다.",
    ],
  };
};

const buildGoogleAdsClickIdHealth = async (
  datePreset: DatePreset,
  sourceFreshness: OperationalDbFreshness,
): Promise<GoogleAdsClickIdHealth> => {
  const dateRange = resolvePresetDateRange(datePreset);
  const orders = await readGoogleClickIdHealthOrders(dateRange);
  return summarizeGoogleAdsClickIdHealth({
    orders,
    dateRange,
    sourceFreshness,
    windowDays: datePresetWindowDays(datePreset),
  });
};

const buildGoogleAdsClickIdHealthForDateRange = async (
  dateRange: DateRange,
  sourceFreshness: OperationalDbFreshness,
  windowDays: number,
): Promise<GoogleAdsClickIdHealth> => {
  const orders = await readGoogleClickIdHealthOrders(dateRange);
  return summarizeGoogleAdsClickIdHealth({
    orders,
    dateRange,
    sourceFreshness,
    windowDays,
    caveats: [
      "no-send/read-only 집계다. Google Ads conversion upload 후보가 아니다.",
      "분모는 운영DB tb_iamweb_users payment_complete_time 기준 실제 결제완료 주문이다.",
      "분자는 VM Cloud attribution/intent 원장의 exact Google click id evidence만 센다. fuzzy time-window 매칭은 제외한다.",
      "custom range 조회는 start_date/end_date 기준으로 자른다.",
    ],
  });
};

const buildGoogleAdsClickIdHealthForWindow = async (
  window: GoogleAdsClickIdHealthWindow,
  sourceFreshness: OperationalDbFreshness,
): Promise<GoogleAdsClickIdHealth> => {
  const orders = await readGoogleClickIdHealthOrdersForWindow(window);
  return summarizeGoogleAdsClickIdHealth({
    orders,
    dateRange: window,
    sourceFreshness,
    windowDays: window.windowDays,
    windowHours: window.windowHours,
    windowKey: window.key,
    windowLabel: window.label,
    caveats: [
      "no-send/read-only 집계다. Google Ads conversion upload 후보가 아니다.",
      "분모는 운영DB tb_iamweb_users payment_complete_time 기준 실제 결제완료 주문이다.",
      "분자는 VM Cloud attribution/intent 원장의 exact Google click id evidence만 센다. fuzzy time-window 매칭은 제외한다.",
    ],
  });
};

const emptyGoogleCampaignMatchHealth = (
  windowDays: number,
  status: GoogleCampaignMatchHealth["summary"]["status"],
  interpretation: string,
): GoogleCampaignMatchHealth => {
  const siteLanding = {
    rows: 0,
    googleClickIdRows: 0,
    gadCampaignIdRows: 0,
    gadSourceRows: 0,
    utmBlankGoogleClickIdRows: 0,
    utmPresentGoogleClickIdRows: 0,
    currentCampaignIdCoverageRate: null,
    potentialCoverageRateAfterAllowlist: null,
    latestAt: null,
  };
  const paidClickIntent = {
    rows: 0,
    googleClickIdRows: 0,
    gadCampaignIdRows: 0,
    gadSourceRows: 0,
    utmBlankGoogleClickIdRows: 0,
    utmPresentGoogleClickIdRows: 0,
    currentCampaignIdCoverageRate: null,
    potentialCoverageRateAfterAllowlist: null,
    latestAt: null,
  };
  const attributionLedger = {
    rows: 0,
    gadCampaignIdRows: 0,
    googleClickIdEvidenceRows: 0,
    confirmedPaymentSuccessRows: 0,
    confirmedRowsWithGadCampaignId: 0,
    latestAt: null,
  };
  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    source: "vm_cloud_sqlite_and_google_ads_dashboard",
    mode: "no_send_read_only",
    baseline: {
      candidateStartedAtKst: GOOGLE_CAMPAIGN_MATCH_BASELINE_KST,
      effectiveForRoasRecalculation: false,
      effectiveFromKst: null,
      policy:
        "오늘 작업일은 ROAS 재계산 기준 후보일 뿐이다. 신규 유입에서 gad_campaignid 보존이 확인된 뒤부터 재계산 기준점으로 승격한다.",
    },
    siteLanding,
    paidClickIntent,
    attributionLedger,
    confidenceThresholds: {
      exactClickViewPct: 95,
      gadCampaignIdWithClickIdPct: 85,
      gadCampaignIdSessionOnlyPct: 70,
      utmOnlyPct: 50,
      unmappedPct: 0,
    },
    topCampaignIds: [],
    healthSplit: buildGoogleCampaignHealthSplit({ siteLanding, paidClickIntent, attributionLedger }),
    summary: {
      status,
      mappedRows: 0,
      unmappedRows: 0,
      recoverableRowsAfterAllowlist: 0,
      uploadCandidateCount: 0,
      interpretation,
    },
    caveats: [
      "gad_campaignid는 캠페인 ID 힌트다. gclid/gbraid/wbraid 같은 클릭 식별자가 아니므로 단독으로 Google Ads upload 후보가 되지 않는다.",
      "내부 ROAS 재계산 기준점은 post-deploy smoke에서 신규 row의 gad_campaignid 보존이 확인된 뒤 승격한다.",
    ],
  };
};

const sqliteTableExists = (db: ReturnType<typeof getCrmDb>, tableName: string) => {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return Boolean(row?.name);
};

const ATTRIBUTION_LEDGER_GOOGLE_CLICK_ID_SQL = `(
  COALESCE(gclid, '') <> ''
  OR landing LIKE '%gclid=%'
  OR landing LIKE '%gbraid=%'
  OR landing LIKE '%wbraid=%'
  OR (
    json_valid(metadata_json)
    AND (
      COALESCE(json_extract(metadata_json, '$.gclid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.gbraid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.wbraid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.googleClickIds.gclid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.googleClickIds.gbraid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.googleClickIds.wbraid'), '') <> ''
    )
  )
)`;

const ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL = `(
  landing LIKE '%gad_campaignid=%'
  OR (
    json_valid(metadata_json)
    AND (
      COALESCE(json_extract(metadata_json, '$.gad_campaignid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.gadCampaignId'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.metadata.gad_campaignid'), '') <> ''
      OR COALESCE(json_extract(metadata_json, '$.metadata.gadCampaignId'), '') <> ''
    )
  )
)`;

const buildDropoffStage = (
  params: Omit<GoogleClickIdDropoffStage, "coverageRate">,
): GoogleClickIdDropoffStage => ({
  ...params,
  coverageRate: params.rows > 0 ? round4(params.googleClickIdRows / params.rows) : null,
});

const emptyDropoffStage = (
  key: GoogleClickIdDropoffStage["key"],
  label: string,
  source: string,
  plainMeaning: string,
): GoogleClickIdDropoffStage => buildDropoffStage({
  key,
  label,
  source,
  rows: 0,
  googleClickIdRows: 0,
  gadCampaignIdRows: 0,
  latestAt: null,
  plainMeaning,
});

const buildDropoffStageComparison = (
  from: GoogleClickIdDropoffStage,
  to: GoogleClickIdDropoffStage,
  nextProbe: string,
): GoogleClickIdDropoffStageComparison => {
  const apparentLostClickIdRows = Math.max(0, from.googleClickIdRows - to.googleClickIdRows);
  const comparisonRate = from.googleClickIdRows > 0 ? round4(to.googleClickIdRows / from.googleClickIdRows) : null;
  const interpretation = from.googleClickIdRows <= 0
    ? `${from.label} 단계에 Google click id 표본이 없어 다음 단계 유실 판단 전입니다.`
    : to.googleClickIdRows <= 0
      ? `${from.label}에는 Google click id가 보이지만 ${to.label}에는 보이지 않습니다. 이 구간을 우선 조사해야 합니다.`
      : `${from.label}와 ${to.label} 모두 Google click id가 보입니다. row 단위 exact join은 별도 검토가 필요합니다.`;

  return {
    fromKey: from.key,
    toKey: to.key,
    fromLabel: from.label,
    toLabel: to.label,
    fromGoogleClickIdRows: from.googleClickIdRows,
    toGoogleClickIdRows: to.googleClickIdRows,
    apparentLostClickIdRows,
    comparisonRate,
    interpretation,
    nextProbe,
  };
};

const buildGoogleClickIdDropoffHealth = (params: {
  dateRange: DateRange;
  windowDays: number | null;
  sourceFreshness: OperationalDbFreshness;
  clickIdHealth: GoogleAdsClickIdHealth;
}): GoogleClickIdDropoffHealth => {
  const { dateRange, windowDays, sourceFreshness, clickIdHealth } = params;
  const since = dateRange.startAt;
  const untilExclusive = dateRange.endExclusiveAt ?? `${shiftIsoDate(dateRange.endDate, 1)}T00:00:00.000+09:00`;
  const sqliteSince = toSqliteUtcIsoBound(since);
  const sqliteUntilExclusive = toSqliteUtcIsoBound(untilExclusive);

  let siteLanding = emptyDropoffStage(
    "site_landing",
    "광고 클릭 직후 URL",
    "site_landing_ledger",
    "Google 광고를 누른 직후 gclid/gbraid/wbraid가 첫 방문 URL에 남는지 봅니다.",
  );
  let paidClickIntent = emptyDropoffStage(
    "paid_click_intent",
    "클릭 의도 저장",
    "paid_click_intent_ledger",
    "GTM/아임웹 태그가 광고 클릭 직후 파라미터를 따로 저장했는지 봅니다.",
  );
  let checkoutStarted = emptyDropoffStage(
    "checkout_started",
    "구매하기 진입",
    "attribution_ledger.checkout_started",
    "상품에서 구매하기를 누른 뒤 결제 화면 진입 신호에 click id가 살아 있는지 봅니다.",
  );
  let paymentPageSeen = emptyDropoffStage(
    "payment_page_seen",
    "결제 화면 체류",
    "attribution_ledger.payment_page_seen",
    "결제수단 선택/결제 화면에서 click id가 아직 남아 있는지 봅니다.",
  );
  let paymentSuccessAll = emptyDropoffStage(
    "payment_success_all",
    "결제완료 신호 전체",
    "attribution_ledger.payment_success",
    "confirmed/pending 구분 전 결제완료 신호 전체에 click id가 남는지 봅니다.",
  );
  let npayIntentExact = {
    ...emptyDropoffStage(
      "npay_intent_exact",
      "NPay 클릭-주문 exact 후보",
      "npay_intent_log",
      "NPay는 외부 화면에서 결제가 끝나므로 NPay 클릭 의도와 내부 주문번호가 exact로 붙었는지 봅니다.",
    ),
    matchedOrderRows: 0,
    matchedOrderGoogleClickIdRows: 0,
  };
  let paymentSuccessStatusBreakdown: GoogleClickIdDropoffPaymentStatusRow[] = [];

  try {
    const db = getCrmDb();
    if (sqliteTableExists(db, "site_landing_ledger")) {
      const row = db.prepare(`
        SELECT
          COUNT(*) AS rows,
          SUM(CASE WHEN LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
            OR landing_url LIKE '%gclid=%'
            OR landing_url LIKE '%gbraid=%'
            OR landing_url LIKE '%wbraid=%'
            THEN 1 ELSE 0 END) AS googleClickIdRows,
          SUM(CASE WHEN landing_url LIKE '%gad_campaignid=%' THEN 1 ELSE 0 END) AS gadCampaignIdRows,
          MAX(landed_at) AS latestAt
        FROM site_landing_ledger
        WHERE site = 'biocom'
          AND landed_at >= ?
          AND landed_at < ?
      `).get(sqliteSince, sqliteUntilExclusive) as Record<string, unknown>;
      siteLanding = buildDropoffStage({
        key: "site_landing",
        label: "광고 클릭 직후 URL",
        source: "site_landing_ledger",
        rows: toNumber(row.rows),
        googleClickIdRows: toNumber(row.googleClickIdRows),
        gadCampaignIdRows: toNumber(row.gadCampaignIdRows),
        latestAt: toStringValue(row.latestAt) || null,
        plainMeaning: "Google 광고를 누른 직후 gclid/gbraid/wbraid가 첫 방문 URL에 남는지 봅니다.",
      });
    }

    if (sqliteTableExists(db, "paid_click_intent_ledger")) {
      const row = db.prepare(`
        SELECT
          COUNT(*) AS rows,
          SUM(CASE WHEN LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
            OR allowed_query_json LIKE '%gclid_present%'
            OR allowed_query_json LIKE '%gbraid_present%'
            OR allowed_query_json LIKE '%wbraid_present%'
            THEN 1 ELSE 0 END) AS googleClickIdRows,
          SUM(CASE WHEN allowed_query_json LIKE '%gad_campaignid%' THEN 1 ELSE 0 END) AS gadCampaignIdRows,
          MAX(captured_at) AS latestAt
        FROM paid_click_intent_ledger
        WHERE site = 'biocom'
          AND captured_at >= ?
          AND captured_at < ?
      `).get(sqliteSince, sqliteUntilExclusive) as Record<string, unknown>;
      paidClickIntent = buildDropoffStage({
        key: "paid_click_intent",
        label: "클릭 의도 저장",
        source: "paid_click_intent_ledger",
        rows: toNumber(row.rows),
        googleClickIdRows: toNumber(row.googleClickIdRows),
        gadCampaignIdRows: toNumber(row.gadCampaignIdRows),
        latestAt: toStringValue(row.latestAt) || null,
        plainMeaning: "GTM/아임웹 태그가 광고 클릭 직후 파라미터를 따로 저장했는지 봅니다.",
      });
    }

    if (sqliteTableExists(db, "attribution_ledger")) {
      const statusRows = db.prepare(`
        SELECT
          COALESCE(NULLIF(TRIM(payment_status), ''), 'unknown') AS paymentStatus,
          COUNT(*) AS rows,
          SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GOOGLE_CLICK_ID_SQL} THEN 1 ELSE 0 END) AS googleClickIdRows,
          SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL} THEN 1 ELSE 0 END) AS gadCampaignIdRows,
          MAX(logged_at) AS latestAt
        FROM attribution_ledger
        WHERE source = ?
          AND touchpoint = 'payment_success'
          AND logged_at >= ?
          AND logged_at < ?
        GROUP BY COALESCE(NULLIF(TRIM(payment_status), ''), 'unknown')
        ORDER BY rows DESC
        LIMIT 12
      `).all(INTERNAL_LEDGER_SOURCE, sqliteSince, sqliteUntilExclusive) as Array<Record<string, unknown>>;
      paymentSuccessStatusBreakdown = statusRows.map((row) => {
        const rows = toNumber(row.rows);
        const googleClickIdRows = toNumber(row.googleClickIdRows);
        return {
          paymentStatus: toStringValue(row.paymentStatus) || "unknown",
          rows,
          googleClickIdRows,
          gadCampaignIdRows: toNumber(row.gadCampaignIdRows),
          coverageRate: rows > 0 ? round4(googleClickIdRows / rows) : null,
          latestAt: toStringValue(row.latestAt) || null,
        };
      });

      const readAttributionStage = (
        touchpoint: string,
        key: GoogleClickIdDropoffStage["key"],
        label: string,
        plainMeaning: string,
      ) => {
        const row = db.prepare(`
          SELECT
            COUNT(*) AS rows,
            SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GOOGLE_CLICK_ID_SQL} THEN 1 ELSE 0 END) AS googleClickIdRows,
            SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL} THEN 1 ELSE 0 END) AS gadCampaignIdRows,
            MAX(logged_at) AS latestAt
          FROM attribution_ledger
          WHERE source = ?
            AND touchpoint = ?
            AND logged_at >= ?
            AND logged_at < ?
        `).get(INTERNAL_LEDGER_SOURCE, touchpoint, sqliteSince, sqliteUntilExclusive) as Record<string, unknown>;
        return buildDropoffStage({
          key,
          label,
          source: `attribution_ledger.${touchpoint}`,
          rows: toNumber(row.rows),
          googleClickIdRows: toNumber(row.googleClickIdRows),
          gadCampaignIdRows: toNumber(row.gadCampaignIdRows),
          latestAt: toStringValue(row.latestAt) || null,
          plainMeaning,
        });
      };

      checkoutStarted = readAttributionStage(
        "checkout_started",
        "checkout_started",
        "구매하기 진입",
        "상품에서 구매하기를 누른 뒤 결제 화면 진입 신호에 click id가 살아 있는지 봅니다.",
      );
      paymentPageSeen = readAttributionStage(
        "payment_page_seen",
        "payment_page_seen",
        "결제 화면 체류",
        "결제수단 선택/결제 화면에서 click id가 아직 남아 있는지 봅니다.",
      );
      paymentSuccessAll = readAttributionStage(
        "payment_success",
        "payment_success_all",
        "결제완료 신호 전체",
        "confirmed/pending 구분 전 결제완료 신호 전체에 click id가 남는지 봅니다.",
      );
    }

    if (sqliteTableExists(db, "npay_intent_log")) {
      const row = db.prepare(`
        SELECT
          COUNT(*) AS rows,
          SUM(CASE WHEN COALESCE(gclid, '') <> '' OR COALESCE(gbraid, '') <> '' OR COALESCE(wbraid, '') <> ''
            THEN 1 ELSE 0 END) AS googleClickIdRows,
          SUM(CASE WHEN COALESCE(matched_order_no, '') <> '' THEN 1 ELSE 0 END) AS matchedOrderRows,
          SUM(CASE WHEN COALESCE(matched_order_no, '') <> ''
            AND (COALESCE(gclid, '') <> '' OR COALESCE(gbraid, '') <> '' OR COALESCE(wbraid, '') <> '')
            THEN 1 ELSE 0 END) AS matchedOrderGoogleClickIdRows,
          MAX(captured_at) AS latestAt
        FROM npay_intent_log
        WHERE site = 'biocom'
          AND environment = 'live'
          AND captured_at >= ?
          AND captured_at < ?
      `).get(sqliteSince, sqliteUntilExclusive) as Record<string, unknown>;
      const matchedOrderRows = toNumber(row.matchedOrderRows);
      const matchedOrderGoogleClickIdRows = toNumber(row.matchedOrderGoogleClickIdRows);
      npayIntentExact = {
        ...buildDropoffStage({
          key: "npay_intent_exact",
          label: "NPay 클릭-주문 exact 후보",
          source: "npay_intent_log",
          rows: toNumber(row.rows),
          googleClickIdRows: toNumber(row.googleClickIdRows),
          gadCampaignIdRows: 0,
          latestAt: toStringValue(row.latestAt) || null,
          plainMeaning: "NPay는 외부 화면에서 결제가 끝나므로 NPay 클릭 의도와 내부 주문번호가 exact로 붙었는지 봅니다.",
        }),
        matchedOrderRows,
        matchedOrderGoogleClickIdRows,
      };
    }
  } catch {
    // Keep zero stages and expose the direct order health below.
  }

  const paymentSuccessConfirmedDirect = buildDropoffStage({
    key: "payment_success_confirmed_direct",
    label: "실제 결제완료 주문 직접 보존",
    source: "operational_db + attribution/intent exact evidence",
    rows: clickIdHealth.orderCount,
    googleClickIdRows: clickIdHealth.withGoogleClickId,
    gadCampaignIdRows: 0,
    latestAt: sourceFreshness.maxPaymentCompleteKst,
    plainMeaning: "취소/환불을 제외한 실제 결제완료 주문에 Google click id가 직접 붙었는지 봅니다.",
  });

  const clickStageOk = siteLanding.googleClickIdRows > 0 && paidClickIntent.googleClickIdRows > 0;
  const checkoutStageHasGoogleEvidence = checkoutStarted.googleClickIdRows > 0 || paymentPageSeen.googleClickIdRows > 0;
  const paymentSuccessDirectPreserved = paymentSuccessConfirmedDirect.googleClickIdRows > 0;
  const likelyLossPoint = !clickStageOk
    ? "광고 클릭 직후 URL 저장 단계"
    : !checkoutStageHasGoogleEvidence
      ? "상품 상세에서 결제 화면으로 넘어가는 단계"
      : !paymentSuccessDirectPreserved
        ? "결제완료 신호를 실제 주문번호와 exact로 붙이는 단계"
        : "직접 보존 확인됨";
  const manualClickTestNeeded = !clickStageOk;
  const status: GoogleClickIdDropoffHealth["conclusion"]["status"] = paymentSuccessDirectPreserved
    ? "order_direct_preserved"
    : !clickStageOk
      ? "landing_capture_missing"
      : !checkoutStageHasGoogleEvidence
        ? "checkout_or_payment_page_missing"
        : "click_capture_ok_order_direct_missing";
  const plain = status === "order_direct_preserved"
    ? "실제 결제완료 주문에 Google click id가 직접 붙은 주문이 생겼습니다. 아직 전송은 하지 않고 no-send 후보로만 봅니다."
    : status === "landing_capture_missing"
      ? "광고 클릭 직후 URL 단계부터 Google click id가 충분히 보이지 않습니다. 새 광고 클릭 smoke가 먼저 필요합니다."
      : status === "checkout_or_payment_page_missing"
        ? "광고 클릭은 잡히지만 구매하기/결제화면 단계에서 click id가 약합니다. 아임웹 checkout context를 먼저 봐야 합니다."
        : "광고 클릭과 결제 전 단계는 잡히지만, 실제 결제완료 주문에는 직접 click id가 남지 않습니다. NPay bridge 후보표와 payment_success exact 연결을 보강해야 합니다.";
  const stageComparisons = [
    buildDropoffStageComparison(
      siteLanding,
      paidClickIntent,
      "site_landing에는 있는데 paid_click_intent에 없으면 GTM paid-click-intent 태그와 allowlist를 확인합니다.",
    ),
    buildDropoffStageComparison(
      paidClickIntent,
      checkoutStarted,
      "클릭 저장에는 있는데 구매하기 진입에 없으면 아임웹 footer checkout-context 저장값과 sessionStorage handoff를 확인합니다.",
    ),
    buildDropoffStageComparison(
      checkoutStarted,
      paymentPageSeen,
      "구매하기 진입에는 있는데 결제 화면에 없으면 /shop_payment/ 진입 시 storage 복원과 payment_page_seen payload를 확인합니다.",
    ),
    buildDropoffStageComparison(
      paymentPageSeen,
      paymentSuccessAll,
      "결제 화면에는 있는데 결제완료 신호에 없으면 payment_success footer payload와 header guard 복원값을 확인합니다.",
    ),
    buildDropoffStageComparison(
      paymentSuccessAll,
      paymentSuccessConfirmedDirect,
      "결제완료 신호에는 있는데 실제 confirmed 주문 직접 보존이 약하면 order_no/order_code/channel_order_no exact join을 확인합니다.",
    ),
  ];
  const orderEvidenceBreakdown: GoogleClickIdDropoffHealth["orderEvidenceBreakdown"] = {
    ...clickIdHealth.evidenceSourceBreakdown,
    orderCount: clickIdHealth.orderCount,
    withGoogleClickId: clickIdHealth.withGoogleClickId,
    missingGoogleClickId: clickIdHealth.missingGoogleClickId,
    missingAttributionVmEvidence: clickIdHealth.blockReasonCounts.missingAttributionVmEvidence,
    interpretation: clickIdHealth.withGoogleClickId > 0
      ? "실제 결제완료 주문 중 일부에 Google click id가 연결됐습니다. 아직 no-send 후보로만 봅니다."
      : clickIdHealth.evidenceSourceBreakdown.noneRows > 0
        ? "실제 결제완료 주문 다수는 VM Cloud 결제완료/intent evidence와 exact로 붙지 않습니다. 주문번호 bridge가 다음 병목입니다."
        : "주문 evidence는 있으나 Google click id가 없습니다. click id 복원/보존 경로를 봐야 합니다.",
  };

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    source: "vm_cloud_sqlite_and_operational_db",
    mode: "no_send_read_only",
    dateRange,
    baselines: {
      clickIdCapturePatchKst: GOOGLE_CLICK_ID_CAPTURE_PATCH_BASELINE_KST,
      analysisAlgorithmV2Kst: GOOGLE_ANALYSIS_ALGORITHM_V2_BASELINE_KST,
      policy:
        "5월 21일은 클릭 보존 코드 기준점이고, 5월 25일은 NPay bridge와 주문 직접 보존을 분리해서 읽는 분석 알고리즘 v2 기준점이다.",
    },
    stageSummary: {
      clickStageOk,
      checkoutStageHasGoogleEvidence,
      paymentSuccessDirectPreserved,
      likelyLossPoint,
      manualClickTestNeeded,
    },
    stages: {
      siteLanding,
      paidClickIntent,
      checkoutStarted,
      paymentPageSeen,
      paymentSuccessAll,
      paymentSuccessConfirmedDirect,
      npayIntentExact,
    },
    stageComparisons,
    paymentSuccessStatusBreakdown,
    orderEvidenceBreakdown,
    conclusion: {
      status,
      plain,
      nextAction:
        "영구 원장 write 전까지 NPay bridge no-write 후보표를 넓히고, 직접 보존 주문은 Google Ads 전송 후보가 아니라 내부 검토 후보로만 분리한다.",
    },
    sourceFreshness,
    invariants: {
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      externalSendCount: 0,
      operationalDbWrite: 0,
      vmCloudWrite: 0,
      rawClickIdInResponse: false,
    },
    caveats: [
      "raw gclid/gbraid/wbraid 값은 반환하지 않는다.",
      "NPay bridge 후보는 내부 분석용이다. Google Ads 전송 후보로 승격하지 않는다.",
      "Google Ads upload/send/write는 0건으로 고정한다.",
    ],
  };
};

const extractGadCampaignIdFromText = (value: unknown): string => {
  const raw = toStringValue(value);
  if (!raw) return "";
  const queryMatch = raw.match(/[?&]gad_campaignid=(\d{6,})/i);
  if (queryMatch?.[1]) return queryMatch[1];
  const jsonMatch = raw.match(/"gad_campaignid"\s*:\s*"(\d{6,})"/i);
  if (jsonMatch?.[1]) return jsonMatch[1];
  return "";
};

type GoogleNpayBridgeCampaignEvidence = {
  campaignId: string;
  source: GoogleNpayBridgeReviewRow["campaignIdEvidenceSource"];
};

type GoogleNpayBridgeClickIdEvidence = {
  hasGoogleClickId: boolean;
  googleClickIdTypes: Array<"gclid" | "gbraid" | "wbraid">;
  source: GoogleNpayBridgeReviewRow["googleClickIdEvidenceSource"];
  rawValueAvailable: boolean;
  plain: string;
};

const buildNpayBridgeCampaignEvidenceLookupWindow = (capturedAt: string) => {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) {
    return {
      since: "1970-01-01T00:00:00.000Z",
      until: new Date().toISOString(),
    };
  }

  return {
    since: new Date(capturedMs - 24 * 60 * 60 * 1000).toISOString(),
    until: new Date(capturedMs + 5 * 60 * 1000).toISOString(),
  };
};

const normalizeGoogleClickIdType = (value: unknown): "gclid" | "gbraid" | "wbraid" | "" => {
  const normalized = toStringValue(value).trim().toLowerCase();
  return normalized === "gclid" || normalized === "gbraid" || normalized === "wbraid"
    ? normalized
    : "";
};

const extractGoogleClickIdTypesFromText = (value: unknown): Array<"gclid" | "gbraid" | "wbraid"> => {
  const raw = toStringValue(value);
  const types = new Set<"gclid" | "gbraid" | "wbraid">();
  if (!raw) return [];
  if (/[?&"]gclid(?:=|"\s*:)/i.test(raw) || /gclid_present/i.test(raw)) types.add("gclid");
  if (/[?&"]gbraid(?:=|"\s*:)/i.test(raw) || /gbraid_present/i.test(raw)) types.add("gbraid");
  if (/[?&"]wbraid(?:=|"\s*:)/i.test(raw) || /wbraid_present/i.test(raw)) types.add("wbraid");
  return Array.from(types);
};

const uniqueGoogleClickIdTypes = (
  values: Array<"gclid" | "gbraid" | "wbraid" | "">,
): Array<"gclid" | "gbraid" | "wbraid"> =>
  Array.from(new Set(values.filter((value): value is "gclid" | "gbraid" | "wbraid" => Boolean(value))));

const resolveNpayBridgeClickIdEvidence = (
  row: NpayIntentRematchDryRunReport["candidates"][number],
): GoogleNpayBridgeClickIdEvidence => {
  if (row.clickIds.hasGoogleClickId) {
    return {
      hasGoogleClickId: true,
      googleClickIdTypes: row.clickIds.googleClickIdTypes,
      source: "intent_direct",
      rawValueAvailable: true,
      plain:
        "NPay 버튼 클릭 intent row 자체에 Google click id가 남아 있습니다. 그래도 영구 bridge 장부와 중복/환불 guard 전에는 Google Ads에 보내지 않습니다.",
    };
  }

  const clientId = toStringValue(row.clientId);
  const gaSessionId = toStringValue(row.gaSessionId);
  if (!clientId && !gaSessionId) {
    return {
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      source: "none",
      rawValueAvailable: false,
      plain: "같은 브라우저나 GA 세션을 찾을 키가 없어 직전 Google 클릭 원장을 붙일 수 없습니다.",
    };
  }

  try {
    const db = getCrmDb();
    const { since, until } = buildNpayBridgeCampaignEvidenceLookupWindow(row.intentCapturedAt);
    const clientLookup = clientId || "__none__";
    const sessionLookup = gaSessionId || "__none__";

    if (sqliteTableExists(db, "paid_click_intent_ledger")) {
      const paidClick = db.prepare(`
        SELECT click_id_type, click_id_value, allowed_query_json
        FROM paid_click_intent_ledger
        WHERE site = 'biocom'
          AND captured_at >= ?
          AND captured_at <= ?
          AND (
            (? <> '__none__' AND client_id = ?)
            OR (? <> '__none__' AND ga_session_id = ?)
          )
          AND (
            LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
            OR allowed_query_json LIKE '%gclid%'
            OR allowed_query_json LIKE '%gbraid%'
            OR allowed_query_json LIKE '%wbraid%'
          )
        ORDER BY captured_at DESC
        LIMIT 1
      `).get(since, until, clientLookup, clientLookup, sessionLookup, sessionLookup) as
        | {
            click_id_type?: unknown;
            click_id_value?: unknown;
            allowed_query_json?: unknown;
          }
        | undefined;

      const types = uniqueGoogleClickIdTypes([
        normalizeGoogleClickIdType(paidClick?.click_id_type),
        ...extractGoogleClickIdTypesFromText(paidClick?.allowed_query_json),
      ]);
      if (types.length > 0) {
        return {
          hasGoogleClickId: true,
          googleClickIdTypes: types,
          source: "paid_click_intent_same_client_session",
          rawValueAvailable: Boolean(toStringValue(paidClick?.click_id_value)),
          plain:
            "NPay intent row에는 click id가 없지만, 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 click id 흔적을 찾았습니다. 전송 전에는 원문값 보관 여부와 중복 guard를 별도로 확인해야 합니다.",
        };
      }
    }

    if (sqliteTableExists(db, "site_landing_ledger")) {
      const landing = db.prepare(`
        SELECT click_id_type, click_id_value_or_hash, click_id_storage_mode, landing_url
        FROM site_landing_ledger
        WHERE site = 'biocom'
          AND landed_at >= ?
          AND landed_at <= ?
          AND (
            (? <> '__none__' AND client_id = ?)
            OR (? <> '__none__' AND ga_session_id = ?)
          )
          AND (
            LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
            OR landing_url LIKE '%gclid=%'
            OR landing_url LIKE '%gbraid=%'
            OR landing_url LIKE '%wbraid=%'
          )
        ORDER BY landed_at DESC
        LIMIT 1
      `).get(since, until, clientLookup, clientLookup, sessionLookup, sessionLookup) as
        | {
            click_id_type?: unknown;
            click_id_value_or_hash?: unknown;
            click_id_storage_mode?: unknown;
            landing_url?: unknown;
          }
        | undefined;

      const types = uniqueGoogleClickIdTypes([
        normalizeGoogleClickIdType(landing?.click_id_type),
        ...extractGoogleClickIdTypesFromText(landing?.landing_url),
      ]);
      if (types.length > 0) {
        const storageMode = toStringValue(landing?.click_id_storage_mode).toLowerCase();
        return {
          hasGoogleClickId: true,
          googleClickIdTypes: types,
          source: "site_landing_same_client_session",
          rawValueAvailable:
            storageMode === "raw" || /[?&](?:gclid|gbraid|wbraid)=/i.test(toStringValue(landing?.landing_url)),
          plain:
            "NPay intent row에는 click id가 없지만, 같은 브라우저/GA 세션의 랜딩 기록에서 Google click id 흔적을 찾았습니다. 이 증거는 no-send 후보 확장용이며 바로 전송하지 않습니다.",
        };
      }
    }
  } catch {
    return {
      hasGoogleClickId: false,
      googleClickIdTypes: [],
      source: "none",
      rawValueAvailable: false,
      plain: "직전 Google 클릭 원장 조회 중 오류가 나서 복구 증거를 확정하지 못했습니다.",
    };
  }

  return {
    hasGoogleClickId: false,
    googleClickIdTypes: [],
    source: "none",
    rawValueAvailable: false,
    plain: "같은 브라우저/GA 세션의 직전 Google 클릭 원장에서도 click id를 찾지 못했습니다.",
  };
};

const resolveNpayBridgeCampaignEvidence = (
  row: NpayIntentRematchDryRunReport["candidates"][number],
): GoogleNpayBridgeCampaignEvidence => {
  const directCampaignId = row.gadCampaignId || extractGadCampaignIdFromText(row.pageLocation);
  if (directCampaignId) {
    return {
      campaignId: directCampaignId,
      source: "intent_page_location",
    };
  }

  const clientId = toStringValue(row.clientId);
  const gaSessionId = toStringValue(row.gaSessionId);
  if (!clientId && !gaSessionId) return { campaignId: "", source: "none" };

  try {
    const db = getCrmDb();
    const { since, until } = buildNpayBridgeCampaignEvidenceLookupWindow(row.intentCapturedAt);
    const clientLookup = clientId || "__none__";
    const sessionLookup = gaSessionId || "__none__";

    if (sqliteTableExists(db, "paid_click_intent_ledger")) {
      const paidClick = db.prepare(`
        SELECT allowed_query_json
        FROM paid_click_intent_ledger
        WHERE site = 'biocom'
          AND captured_at >= ?
          AND captured_at <= ?
          AND (
            (? <> '__none__' AND client_id = ?)
            OR (? <> '__none__' AND ga_session_id = ?)
          )
          AND allowed_query_json LIKE '%gad_campaignid%'
        ORDER BY captured_at DESC
        LIMIT 1
      `).get(since, until, clientLookup, clientLookup, sessionLookup, sessionLookup) as
        | { allowed_query_json?: unknown }
        | undefined;
      const campaignId = extractGadCampaignIdFromText(paidClick?.allowed_query_json);
      if (campaignId) {
        return {
          campaignId,
          source: "paid_click_intent_same_client_session",
        };
      }
    }

    if (sqliteTableExists(db, "site_landing_ledger")) {
      const landing = db.prepare(`
        SELECT landing_url
        FROM site_landing_ledger
        WHERE site = 'biocom'
          AND landed_at >= ?
          AND landed_at <= ?
          AND (
            (? <> '__none__' AND client_id = ?)
            OR (? <> '__none__' AND ga_session_id = ?)
          )
          AND landing_url LIKE '%gad_campaignid=%'
        ORDER BY landed_at DESC
        LIMIT 1
      `).get(since, until, clientLookup, clientLookup, sessionLookup, sessionLookup) as
        | { landing_url?: unknown }
        | undefined;
      const campaignId = extractGadCampaignIdFromText(landing?.landing_url);
      if (campaignId) {
        return {
          campaignId,
          source: "site_landing_same_client_session",
        };
      }
    }
  } catch {
    return { campaignId: "", source: "none" };
  }

  return { campaignId: "", source: "none" };
};

const GOOGLE_NPAY_BRIDGE_GRADE_A_AMOUNT_TYPES = new Set([
  "final_exact",
  "shipping_reconciled",
  "discount_reconciled",
  "quantity_reconciled",
  "bundle_multiple_reconciled",
]);

const buildNpayBridgeGradeReview = (
  row: NpayIntentRematchDryRunReport["candidates"][number],
): Pick<
  GoogleNpayBridgeReviewRow,
  "gradePlainReason" | "gradeAUpgradeDecision" | "gradeAUpgradePlain"
> => {
  const score = toNumber(row.score);
  const scoreGap = row.scoreGap == null ? null : toNumber(row.scoreGap);
  const timeGap = toNumber(row.timeGapMinutes);
  const orderCreatedGap =
    row.orderCreatedGapMinutes === null || row.orderCreatedGapMinutes === undefined
      ? null
      : toNumber(row.orderCreatedGapMinutes);
  const amountType = toStringValue(row.amountMatchType);
  const amountOk = GOOGLE_NPAY_BRIDGE_GRADE_A_AMOUNT_TYPES.has(amountType);
  const orderCreateTimeOk =
    row.orderCreateTimeBridge === "exact" &&
    orderCreatedGap !== null &&
    Math.abs(orderCreatedGap) <= 1;
  const timeOk = timeGap <= 2 || orderCreateTimeOk;
  const scoreOk = score >= 70;
  const scoreGapOk = scoreGap !== null && scoreGap >= 15;
  const hasClickId = Boolean(row.clickIds.hasGoogleClickId);

  if (row.strongGrade === "A") {
    return {
      gradePlainReason:
        orderCreateTimeOk && timeGap > 2
          ? "A급입니다. NPay의 결제완료 시각은 늦게 잡혔지만, 실제 주문 생성 시각(order_time)이 버튼 클릭과 1분 이내로 맞고 금액도 맞아 같은 주문으로 보는 강한 후보입니다. 그래도 Google click id가 없으면 Google Ads 전송 후보는 아닙니다."
          : "A급은 결제 시각이 매우 가깝거나 주문 생성 시각이 버튼 클릭과 거의 같고, 금액도 맞아서 내부 보고서에서 같은 주문으로 봐도 되는 강한 후보입니다. 그래도 Google click id가 없으면 Google Ads 전송 후보는 아닙니다.",
      gradeAUpgradeDecision: "already_grade_a",
      gradeAUpgradePlain: hasClickId
        ? "이미 A급입니다. 다만 실제 Google Ads 전송은 별도 no-send 후보 생성기와 중복 방지 검증을 통과해야 합니다."
        : "이미 내부 bridge A급이지만 Google click id가 없어 Google Ads에 보낼 수 없습니다.",
    };
  }

  if (!amountOk) {
    return {
      gradePlainReason:
        "B급입니다. 주문 생성 시각은 맞아도 주문 금액이 상품가/배송비/수량 조합으로 딱 맞지 않아, 장바구니나 다른 상품이 섞였을 가능성을 남깁니다.",
      gradeAUpgradeDecision: hasClickId ? "blocked_amount_mismatch" : "blocked_missing_click_id",
      gradeAUpgradePlain: hasClickId
        ? "A로 올리려면 주문 금액이 어떤 상품/배송비/수량 조합으로 만들어졌는지 추가 증거가 필요합니다."
        : "금액도 맞지 않고 Google click id도 없어 A 승격과 Google Ads 전송 둘 다 보류입니다.",
    };
  }

  if (!timeOk) {
    return {
      gradePlainReason:
        `B급입니다. 결제완료 시각 기준으로는 NPay 클릭 후 ${timeGap}분이 걸렸고, order_time도 1분 이내 exact로 맞지 않습니다. 결제완료 시각은 네이버/아임웹 sync 때문에 늦게 보일 수 있어 order_time을 우선 보지만, 이 주문은 그 기준도 부족합니다.`,
      gradeAUpgradeDecision: "blocked_time_gap",
      gradeAUpgradePlain: hasClickId
        ? "Google click id는 있지만 order_time 기준도 exact가 아니어서 자동 A로 올리지 않습니다. 이 1건은 수동 검토 후보이지 Google Ads 자동 전송 후보가 아닙니다."
        : "order_time/complete_time 기준이 모두 약하고 Google click id도 없어 A 승격 대상이 아닙니다.",
    };
  }

  if (!scoreOk || !scoreGapOk) {
    return {
      gradePlainReason:
        "B급입니다. 후보는 있지만 1등 후보와 2등 후보의 차이가 충분히 크지 않아 자동 확정하면 엉뚱한 주문을 붙일 위험이 있습니다.",
      gradeAUpgradeDecision: "blocked_score_gap",
      gradeAUpgradePlain: "A로 올리려면 같은 주문이라고 볼 수 있는 더 강한 시간/금액/상품명 증거가 필요합니다.",
    };
  }

  if (!hasClickId) {
    return {
      gradePlainReason:
        "B급입니다. 내부 주문 연결 근거는 있으나 Google click id가 없어 Google Ads에 다시 연결할 수 없습니다.",
      gradeAUpgradeDecision: "blocked_missing_click_id",
      gradeAUpgradePlain: "A로 올리더라도 Google Ads 전송 후보가 되지 않으므로 click id 연결 증거를 먼저 찾아야 합니다.",
    };
  }

  return {
    gradePlainReason:
      "B급입니다. 사람이 볼 수 있는 내부 검토 후보지만 자동 원장 write 기준에는 아직 부족합니다.",
    gradeAUpgradeDecision: "manual_review_only",
    gradeAUpgradePlain: "추가 증거 없이 자동 A 승격은 하지 않습니다.",
  };
};

const GOOGLE_NPAY_FINAL_SOURCE_LABELS: Record<GoogleNpayFinalSourceChannel, string> = {
  google: "Google 광고",
  meta: "Meta",
  naver: "Naver",
  organic: "Organic 검색",
  direct: "Direct/출처 없음",
  unknown: "미분류",
};

const GOOGLE_NPAY_UNCLASSIFIED_REASON_LABELS: Record<string, { label: string; plain: string }> = {
  multiple_intents_same_product: {
    label: "같은 상품 클릭 후보가 여러 개",
    plain:
      "같은 상품의 NPay 버튼 클릭 후보가 여러 개라서, 결제완료 1건을 어느 클릭에 붙일지 자동 확정하지 않습니다.",
  },
  same_product_multiple_clicks: {
    label: "짧은 시간 안에 같은 상품을 여러 번 클릭",
    plain:
      "15분 안에 같은 상품 클릭이 여러 번 있어, 마지막 클릭인지 이전 클릭인지 더 좁혀야 합니다.",
  },
  weak_time_gap: {
    label: "클릭과 결제완료 시각 간격이 큼",
    plain:
      "버튼 클릭과 결제완료 시각이 충분히 가깝지 않습니다. NPay는 결제완료가 나중에 확정되는 주문이 있어 order_time 기준 보강이 필요합니다.",
  },
  amount_not_reconciled: {
    label: "금액이 상품가/배송비 조합과 맞지 않음",
    plain:
      "버튼 클릭 상품 가격과 실제 결제금액이 깔끔하게 맞지 않아 장바구니, 수량, 쿠폰, 다른 상품이 섞였을 가능성을 남깁니다.",
  },
  no_member_key: {
    label: "회원/브라우저 연결키 부족",
    plain:
      "클릭 row에 회원 또는 브라우저를 확정할 키가 부족해 다른 후보와 구분하기 어렵습니다.",
  },
  product_name_variant: {
    label: "상품명이 정확히 일치하지 않음",
    plain:
      "상품명이 비슷하지만 완전히 같지 않아, 자동 연결 전에 상품명 정규화가 더 필요합니다.",
  },
  low_score_gap: {
    label: "1등 후보와 2등 후보 차이가 작음",
    plain:
      "가장 유력한 클릭 후보와 다음 후보의 점수 차이가 작습니다. 잘못 붙이는 것을 막기 위해 자동 확정하지 않습니다.",
  },
  cart_multi_item_possible: {
    label: "장바구니/복수 상품 가능성",
    plain:
      "결제금액이 단일 상품 클릭보다 커서 장바구니나 복수 상품 결제일 수 있습니다.",
  },
  no_candidate_intent: {
    label: "주문 근처 NPay 클릭 row 없음",
    plain:
      "해당 주문 주변에서 NPay 버튼 클릭 row를 찾지 못했습니다. 외부 결제 흐름에서 저장이 빠졌거나 보관 기간 밖일 수 있습니다.",
  },
};

const buildNpayUnclassifiedReasons = (
  ambiguousReasons: NpayIntentRematchDryRunReport["ambiguousReasonBreakdown"],
  purchaseWithoutIntent: number,
): GoogleNpayFinalSourceUnclassifiedReasonRow[] => {
  const rows = ambiguousReasons.map<GoogleNpayFinalSourceUnclassifiedReasonRow>((row) => {
    const mapped = GOOGLE_NPAY_UNCLASSIFIED_REASON_LABELS[row.key] ?? {
      label: row.key,
      plain: "자동 분류 규칙에 잡힌 미분류 사유입니다. 원장 샘플을 보며 추가 라벨링이 필요합니다.",
    };

    return {
      reason: row.key,
      label: mapped.label,
      completedOrders: row.count,
      sharePct: row.sharePct,
      sampleOrderCount: row.orderNumbers.length,
      plain: mapped.plain,
    };
  });

  if (purchaseWithoutIntent > 0) {
    const mapped = GOOGLE_NPAY_UNCLASSIFIED_REASON_LABELS.no_candidate_intent;
    rows.push({
      reason: "purchase_without_intent",
      label: "결제완료 주문은 있으나 버튼 클릭 row 없음",
      completedOrders: purchaseWithoutIntent,
      sharePct: 0,
      sampleOrderCount: 0,
      plain: mapped.plain,
    });
  }

  return rows.sort((a, b) => b.completedOrders - a.completedOrders || a.reason.localeCompare(b.reason));
};

const emptyNpayFinalSourceSummary = (totalCompletedOrders = 0): GoogleNpayFinalSourceSummary => ({
  totalCompletedOrders,
  classifiedCompletedOrders: 0,
  unclassifiedCompletedOrders: totalCompletedOrders,
  googleEvidenceOrders: 0,
  googleEvidenceAmountKrw: 0,
  byChannel: (Object.keys(GOOGLE_NPAY_FINAL_SOURCE_LABELS) as GoogleNpayFinalSourceChannel[]).map((channel) => ({
    channel,
    label: GOOGLE_NPAY_FINAL_SOURCE_LABELS[channel],
    completedOrders: channel === "unknown" ? totalCompletedOrders : 0,
    amountKrw: 0,
    bridgeCandidateOrders: 0,
    directGoogleClickIdOrders: 0,
    recoveredGoogleClickIdOrders: 0,
    confidence: "low",
    plain: channel === "unknown"
      ? "아직 NPay 버튼 클릭 row와 강하게 붙지 않아 유입을 단정하지 않습니다."
	      : "해당 유입으로 분류된 NPay 결제완료가 없습니다.",
	  })),
  unclassifiedReasons: [],
  dateDistribution: [],
  source: "npay_intent_bridge_candidate_rows",
  basis:
    "NPay 결제완료 주문과 NPay 버튼 클릭 row를 먼저 붙이고, 그 버튼 클릭 row의 URL/UTM/Google click id/campaign id 증거로 유입을 나눕니다.",
  caveat:
    "NPay 결제완료 전체 22건 중 버튼 클릭 row와 강하게 연결되지 않은 주문은 direct로 단정하지 않고 미분류로 남깁니다.",
});

const includesAnyNeedle = (haystack: string, needles: string[]) =>
  needles.some((needle) => haystack.includes(needle));

const classifyNpayFinalSourceCandidate = ({
  row,
  campaignEvidence,
  clickIdEvidence,
}: {
  row: NpayIntentRematchDryRunReport["candidates"][number];
  campaignEvidence: GoogleNpayBridgeCampaignEvidence;
  clickIdEvidence: GoogleNpayBridgeClickIdEvidence;
}): { channel: GoogleNpayFinalSourceChannel; confidence: "high" | "medium" | "low"; plain: string } => {
  const sourceText = [
    row.pageLocation,
    row.utm.source,
    row.utm.medium,
    row.utm.campaign,
    row.gadCampaignId,
    campaignEvidence.campaignId,
  ].map((value) => toStringValue(value).toLowerCase()).join(" ");

  if (
    clickIdEvidence.hasGoogleClickId ||
    campaignEvidence.campaignId ||
    includesAnyNeedle(sourceText, ["gclid=", "gbraid=", "wbraid=", "gad_campaignid", "googleads", "google_ads"])
  ) {
    return {
      channel: "google",
      confidence: clickIdEvidence.hasGoogleClickId ? "high" : "medium",
      plain: clickIdEvidence.hasGoogleClickId
        ? "NPay 버튼 클릭 또는 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 Google click id를 확인했습니다."
        : "Google campaign id 또는 Google 광고 URL 파라미터가 있어 Google 유입 후보로 봅니다.",
    };
  }

  if (includesAnyNeedle(sourceText, ["fbclid", "facebook", "instagram", "meta", "fb_", "ig_"])) {
    return {
      channel: "meta",
      confidence: "medium",
      plain: "NPay 버튼 클릭 row의 URL/UTM에서 Meta 계열 흔적을 확인했습니다.",
    };
  }

  if (includesAnyNeedle(sourceText, ["napm=", "n_media", "n_query", "naver", "n_rank", "n_ad"])) {
    return {
      channel: "naver",
      confidence: "medium",
      plain: "NPay 버튼 클릭 row의 URL/UTM에서 Naver 계열 흔적을 확인했습니다.",
    };
  }

  if (includesAnyNeedle(sourceText, ["organic", "search", "google / organic", "naver / organic"])) {
    return {
      channel: "organic",
      confidence: "low",
      plain: "NPay 버튼 클릭 row에 organic/search 힌트가 있습니다. 검색엔진 referrer 원장과 함께 봐야 확정할 수 있습니다.",
    };
  }

  return {
    channel: "direct",
    confidence: "low",
    plain: "NPay 버튼 클릭 row에 광고/검색/소셜 파라미터가 없어 direct 또는 출처 유실로 봅니다. 이 값은 예산 판단용 확정값이 아닙니다.",
  };
};

const buildNpayFinalSourceSummary = ({
  enrichedCandidates,
  totalCompletedOrders,
  ambiguousOrders,
  purchaseWithoutIntent,
  ambiguousReasonBreakdown,
  unresolvedReasonBreakdown,
  dateDistribution,
}: {
  enrichedCandidates: Array<{
    row: NpayIntentRematchDryRunReport["candidates"][number];
    campaignEvidence: GoogleNpayBridgeCampaignEvidence;
    clickIdEvidence: GoogleNpayBridgeClickIdEvidence;
  }>;
  totalCompletedOrders: number;
  ambiguousOrders: number;
  purchaseWithoutIntent: number;
  ambiguousReasonBreakdown: NpayIntentRematchDryRunReport["ambiguousReasonBreakdown"];
  unresolvedReasonBreakdown?: NpayIntentRematchDryRunReport["unresolvedReasonBreakdown"];
  dateDistribution: NpayIntentRematchDryRunReport["dateDistribution"];
}): GoogleNpayFinalSourceSummary => {
  const baseRows = new Map<GoogleNpayFinalSourceChannel, GoogleNpayFinalSourceSummaryRow>(
    emptyNpayFinalSourceSummary(0).byChannel.map((row) => [row.channel, { ...row }]),
  );

  let googleEvidenceAmountKrw = 0;
  let googleEvidenceOrders = 0;

  for (const item of enrichedCandidates) {
    const classification = classifyNpayFinalSourceCandidate(item);
    const current = baseRows.get(classification.channel);
    if (!current) continue;
    const amount = item.row.orderAmount ?? 0;

    current.completedOrders += 1;
    current.bridgeCandidateOrders += 1;
    current.amountKrw += amount;
    current.confidence = current.confidence === "high" || classification.confidence === "high"
      ? "high"
      : current.confidence === "medium" || classification.confidence === "medium"
        ? "medium"
        : "low";
    current.plain = classification.plain;

    if (classification.channel === "google") {
      googleEvidenceOrders += 1;
      googleEvidenceAmountKrw += amount;
      if (item.row.clickIds.hasGoogleClickId) current.directGoogleClickIdOrders += 1;
      if (!item.row.clickIds.hasGoogleClickId && item.clickIdEvidence.hasGoogleClickId) {
        current.recoveredGoogleClickIdOrders += 1;
      }
    }
  }

  const classifiedCompletedOrders = enrichedCandidates.length;
  const unclassifiedCompletedOrders = Math.max(0, totalCompletedOrders - classifiedCompletedOrders);
  const unknownRow = baseRows.get("unknown");
  if (unknownRow) {
    unknownRow.completedOrders = unclassifiedCompletedOrders;
    unknownRow.bridgeCandidateOrders = 0;
    unknownRow.amountKrw = 0;
    unknownRow.confidence = "low";
    unknownRow.plain = unclassifiedCompletedOrders > 0
      ? `NPay 결제완료 ${unclassifiedCompletedOrders}건은 버튼 클릭 row와 강하게 붙지 않았습니다. ambiguous ${ambiguousOrders}건, purchase_without_intent ${purchaseWithoutIntent}건을 포함합니다.`
      : "모든 NPay 결제완료가 버튼 클릭 row와 연결되었습니다.";
  }

  return {
    totalCompletedOrders,
    classifiedCompletedOrders,
    unclassifiedCompletedOrders,
    googleEvidenceOrders,
    googleEvidenceAmountKrw: round2(googleEvidenceAmountKrw),
    byChannel: Array.from(baseRows.values()).map((row) => ({
      ...row,
      amountKrw: round2(row.amountKrw),
    })),
    unclassifiedReasons: unresolvedReasonBreakdown?.length
      ? unresolvedReasonBreakdown
      : buildNpayUnclassifiedReasons(ambiguousReasonBreakdown, purchaseWithoutIntent),
    dateDistribution: dateDistribution.map((row) => ({
      dateKst: row.dateKst,
      completedOrders: row.completedOrders,
      amountKrw: row.amountKrw,
      bridgeCandidateOrders: row.strongMatch,
      gradeA: row.gradeA,
      gradeB: row.gradeB,
      ambiguous: row.ambiguous,
      purchaseWithoutIntent: row.purchaseWithoutIntent,
      googleEvidenceOrders: row.googleLikeCompletedOrders,
      directGoogleClickIdOrders: row.googleClickIdCompletedOrders,
    })),
    source: "npay_intent_bridge_candidate_rows",
    basis:
      "NPay 결제완료 주문과 NPay 버튼 클릭 row를 먼저 붙이고, 그 버튼 클릭 row의 URL/UTM/Google click id/campaign id 증거로 유입을 나눕니다.",
    caveat:
      "이 표는 결제완료 전체를 Google 매출로 보지 않기 위한 분리표입니다. 미분류와 direct는 광고 예산 판단용 Google 매출로 쓰지 않습니다.",
  };
};

const buildEmptyGoogleNpayBridgeReview = (
  dateRange: DateRange,
  plainMeaning: string,
  caveats: string[] = [],
): GoogleNpayBridgeReview => ({
  generatedAt: new Date().toISOString(),
  source: "npay_intent_rematch_dry_run",
  mode: "no_write_no_send",
  dateRange,
  windowLabel: `${dateRange.startDate} ~ ${dateRange.endDate} KST`,
  sourceFreshness: {
    dryRunGeneratedAt: null,
    ordersSource: "readonly operational_postgres.public.tb_iamweb_users",
    intentsSource: "readonly VM Cloud SQLite npay_intent_log",
  },
  summary: {
    liveIntentCount: 0,
    googleLikeIntentCount: 0,
    googleLikeIntentWithGoogleClickId: 0,
    liveIntentWithNpayBridgeUrlHash: 0,
    googleLikeIntentWithNpayBridgeUrlHash: 0,
    enteredNotCompletedBreakdown: {
      total: 0,
      pendingWindow: 0,
      loginGatePossible: 0,
      checkoutOpenedPossible: 0,
      matchingGapPossible: 0,
    },
    googleClickIdIntentCount: 0,
    googleClickIdIntentBreakdown: {
      gclid: 0,
      gbraid: 0,
      wbraid: 0,
    },
    actualConfirmedNpayOrders: 0,
    internalBridgeStrongCandidates: 0,
    internalBridgeExactCandidates: 0,
    internalBridgeExactWithGoogleClickId: 0,
    bridgeCandidatesWithGoogleClickId: 0,
    bridgeCandidatesWithRecoveredGoogleClickId: 0,
    bridgeCandidatesWithNpayBridgeUrlHash: 0,
    gradeA: 0,
    gradeAWithDirectGoogleClickId: 0,
    gradeAWithRecoveredGoogleClickId: 0,
    gradeAWithGoogleClickId: 0,
    gradeAWithNpayBridgeUrlHash: 0,
    gradeAWithGoogleClickIdAndNpayBridgeUrlHash: 0,
    gradeADirectGoogleClickIdAmountKrw: 0,
    gradeAWithGoogleClickIdAmountKrw: 0,
    gradeARecoveredGoogleClickIdAmountKrw: 0,
    gradeANeedsClickIdRecoveryRows: 0,
    gradeB: 0,
    gradeBWithGoogleClickId: 0,
    gradeBBlockedByTimeGap: 0,
    gradeBBlockedByAmount: 0,
    gradeBBlockedByMissingGoogleClickId: 0,
    gradeBPromotableToGradeANow: 0,
    googleLikeCompletedOrders: 0,
    googleLikeCompletedAmountKrw: 0,
    googleLikeCompletedWithDirectGoogleClickId: 0,
    ambiguous: 0,
    purchaseWithoutIntent: 0,
    googleAdsSendCandidates: 0,
    vmCloudWrite: 0,
    operationalDbWrite: 0,
  },
  rows: [],
  gradeBRows: [],
  campaignSummary: [],
  finalSourceSummary: emptyNpayFinalSourceSummary(0),
  sourceFunnelComparison: [],
  unresolvedRows: [],
  plainMeaning,
  noWritePolicy:
    "이 표는 내부 검토용입니다. NPay intent row, 주문 원장, Google Ads에는 아무것도 쓰거나 보내지 않습니다.",
  caveats: [
    ...caveats,
    "NPay bridge 후보는 내부 분석용이며 Google Ads 전송 후보로 자동 승격하지 않는다.",
    "Google Ads upload/send/write는 0건으로 고정한다.",
  ],
});

const buildGoogleNpayBridgeReview = async ({
  dateRange,
  campaigns,
}: {
  dateRange: DateRange;
  campaigns: CampaignMetricRow[];
}): Promise<GoogleNpayBridgeReview> => {
  const untilExclusive = dateRange.endExclusiveAt ?? `${shiftIsoDate(dateRange.endDate, 1)}T00:00:00.000+09:00`;
  const campaignById = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign.campaignName]));

  try {
    const report = await buildNpayIntentRematchDryRunReport({
      start: dateRange.startAt,
      end: untilExclusive,
      site: "biocom",
      includeOnlyPending: false,
      includeRawClickIds: false,
      limit: 500,
    });
    const candidates = report.candidates;
    const exactCandidates = candidates.filter((row) => row.orderCreateTimeBridge === "exact");
    const exactWithGoogleClickId = exactCandidates.filter((row) => row.clickIds.hasGoogleClickId);
    const withGoogleClickId = candidates.filter((row) => row.clickIds.hasGoogleClickId);
    const withNpayBridgeUrlHash = candidates.filter((row) => row.npayBridgeUrlHashPresent);
    const gradeAWithDirectGoogleClickId = candidates.filter(
      (row) => row.strongGrade === "A" && row.clickIds.hasGoogleClickId,
    );
    const gradeAWithNpayBridgeUrlHash = candidates.filter(
      (row) => row.strongGrade === "A" && row.npayBridgeUrlHashPresent,
    );
    const gradeAWithGoogleClickIdAndNpayBridgeUrlHash = candidates.filter(
      (row) => row.strongGrade === "A" && row.clickIds.hasGoogleClickId && row.npayBridgeUrlHashPresent,
    );
    const gradeBRows = candidates.filter((row) => row.strongGrade === "B");
    const gradeBReviewRows = gradeBRows.map((row) => ({
      row,
      review: buildNpayBridgeGradeReview(row),
    }));
    const enrichedCandidates = candidates.map((row) => ({
      row,
      campaignEvidence: resolveNpayBridgeCampaignEvidence(row),
      clickIdEvidence: resolveNpayBridgeClickIdEvidence(row),
      gradeReview: buildNpayBridgeGradeReview(row),
    }));
    const withRecoveredGoogleClickId = enrichedCandidates.filter(
      (item) => !item.row.clickIds.hasGoogleClickId && item.clickIdEvidence.hasGoogleClickId,
    );
    const gradeAWithRecoveredGoogleClickId = withRecoveredGoogleClickId.filter(
      (item) => item.row.strongGrade === "A",
    );
    const gradeAWithAnyGoogleClickId = enrichedCandidates.filter(
      (item) => item.row.strongGrade === "A" && item.clickIdEvidence.hasGoogleClickId,
    );
    const gradeANeedsClickIdRecoveryRows = candidates.filter(
      (row) => row.strongGrade === "A" && !row.clickIds.hasGoogleClickId,
    );
    const finalSourceSummary = buildNpayFinalSourceSummary({
      enrichedCandidates,
      totalCompletedOrders: report.summary.confirmedNpayOrderCount,
      ambiguousOrders: report.summary.ambiguous,
      purchaseWithoutIntent: report.summary.purchaseWithoutIntent,
      ambiguousReasonBreakdown: report.ambiguousReasonBreakdown,
      unresolvedReasonBreakdown: report.unresolvedReasonBreakdown,
      dateDistribution: report.dateDistribution,
    });
    const toBridgeReviewRow = ({
      row,
      campaignEvidence,
      clickIdEvidence,
      gradeReview,
    }: (typeof enrichedCandidates)[number]): GoogleNpayBridgeReviewRow => ({
      orderNumber: row.orderNumber,
      channelOrderNo: row.channelOrderNo,
      paidAt: row.paidAt,
      orderAmount: row.orderAmount,
      productName: row.productName,
      strongGrade: row.strongGrade,
      score: row.score,
      scoreGap: row.scoreGap,
      timeGapMinutes: row.timeGapMinutes,
      orderCreatedAt: row.orderCreatedAt,
      orderCreatedGapMinutes: row.orderCreatedGapMinutes,
      orderCreateTimeBridge: row.orderCreateTimeBridge,
      amountMatchType: row.amountMatchType,
      hasGoogleClickId: clickIdEvidence.hasGoogleClickId,
      googleClickIdTypes: clickIdEvidence.googleClickIdTypes,
      googleClickIdEvidenceSource: clickIdEvidence.source,
      googleClickIdRawValueAvailable: clickIdEvidence.rawValueAvailable,
      googleClickIdEvidencePlain: clickIdEvidence.plain,
      npayBridgeUrlHashPresent: row.npayBridgeUrlHashPresent,
      npayBridgeHost: row.npayBridgeHost,
      npayBridgePathHashPresent: row.npayBridgePathHashPresent,
      npayBridgeObservedAt: row.npayBridgeObservedAt,
      gadCampaignId: campaignEvidence.campaignId || null,
      campaignIdEvidenceSource: campaignEvidence.source,
      utmCampaign: row.utm.campaign,
      recommendedAction: row.recommendedAction,
      blockReasons: row.blockReasons,
      gradePlainReason: gradeReview.gradePlainReason,
      gradeAUpgradeDecision: gradeReview.gradeAUpgradeDecision,
      gradeAUpgradePlain:
        !row.clickIds.hasGoogleClickId && clickIdEvidence.hasGoogleClickId
          ? "NPay intent row 자체에는 click id가 없지만 같은 브라우저/GA 세션의 직전 Google 클릭 원장에서 복구 증거를 찾았습니다. 실제 전송 전에는 원문값 보관 여부와 중복 방지 장부를 확인해야 합니다."
          : gradeReview.gradeAUpgradePlain,
      internalBridgeDecision: row.strongGrade === "A"
        ? "strong_bridge_candidate"
        : "manual_review_candidate",
      googleAdsSendDecision: "blocked_no_send",
    });

    const campaignMap = new Map<string, GoogleNpayBridgeCampaignSummary>();
    for (const { row, campaignEvidence } of enrichedCandidates) {
      const campaignId = campaignEvidence.campaignId || null;
      const key = campaignId ?? "(missing)";
      const current = campaignMap.get(key) ?? {
        campaignId,
        campaignName: campaignId
          ? campaignById.get(campaignId) ?? `Google campaign ${campaignId}`
          : "campaign id 없는 NPay bridge 후보",
        internalBridgeCandidates: 0,
        bridgeCandidatesWithGoogleClickId: 0,
        gradeA: 0,
        gradeB: 0,
        amountKrw: 0,
        googleAdsSendCandidates: 0,
      };
      current.internalBridgeCandidates += 1;
      if (row.clickIds.hasGoogleClickId) current.bridgeCandidatesWithGoogleClickId += 1;
      if (row.strongGrade === "A") current.gradeA += 1;
      if (row.strongGrade === "B") current.gradeB += 1;
      current.amountKrw += row.orderAmount ?? 0;
      campaignMap.set(key, current);
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "npay_intent_rematch_dry_run",
      mode: "no_write_no_send",
      dateRange,
      windowLabel: `${dateRange.startDate} ~ ${dateRange.endDate} KST`,
      sourceFreshness: {
        dryRunGeneratedAt: report.generatedAt,
        ordersSource: report.source.orders,
        intentsSource: report.source.intents,
      },
      summary: {
        liveIntentCount: report.summary.liveIntentCount,
        googleLikeIntentCount: report.summary.googleLikeIntentCount,
        googleLikeIntentWithGoogleClickId: report.summary.googleLikeIntentWithGoogleClickId,
        liveIntentWithNpayBridgeUrlHash: report.summary.liveIntentWithNpayBridgeUrlHash,
        googleLikeIntentWithNpayBridgeUrlHash: report.summary.googleLikeIntentWithNpayBridgeUrlHash,
        enteredNotCompletedBreakdown: report.summary.enteredNotCompletedBreakdown,
        googleClickIdIntentCount: report.summary.googleClickIdIntentCount,
        googleClickIdIntentBreakdown: report.summary.googleClickIdIntentBreakdown,
        actualConfirmedNpayOrders: report.summary.confirmedNpayOrderCount,
        internalBridgeStrongCandidates: report.summary.strongMatch,
        internalBridgeExactCandidates: exactCandidates.length,
        internalBridgeExactWithGoogleClickId: exactWithGoogleClickId.length,
        bridgeCandidatesWithGoogleClickId: withGoogleClickId.length,
        bridgeCandidatesWithRecoveredGoogleClickId: withRecoveredGoogleClickId.length,
        bridgeCandidatesWithNpayBridgeUrlHash: withNpayBridgeUrlHash.length,
        gradeA: candidates.filter((row) => row.strongGrade === "A").length,
        gradeAWithDirectGoogleClickId: gradeAWithDirectGoogleClickId.length,
        gradeAWithRecoveredGoogleClickId: gradeAWithRecoveredGoogleClickId.length,
        gradeAWithGoogleClickId: gradeAWithAnyGoogleClickId.length,
        gradeAWithNpayBridgeUrlHash: gradeAWithNpayBridgeUrlHash.length,
        gradeAWithGoogleClickIdAndNpayBridgeUrlHash: gradeAWithGoogleClickIdAndNpayBridgeUrlHash.length,
        gradeADirectGoogleClickIdAmountKrw: round2(
          gradeAWithDirectGoogleClickId.reduce((sum, row) => sum + (row.orderAmount ?? 0), 0),
        ),
        gradeAWithGoogleClickIdAmountKrw: round2(
          gradeAWithAnyGoogleClickId.reduce((sum, item) => sum + (item.row.orderAmount ?? 0), 0),
        ),
        gradeARecoveredGoogleClickIdAmountKrw: round2(
          gradeAWithRecoveredGoogleClickId.reduce((sum, item) => sum + (item.row.orderAmount ?? 0), 0),
        ),
        gradeANeedsClickIdRecoveryRows: gradeANeedsClickIdRecoveryRows.length,
        gradeB: candidates.filter((row) => row.strongGrade === "B").length,
        gradeBWithGoogleClickId: gradeBRows.filter((row) => row.clickIds.hasGoogleClickId).length,
        gradeBBlockedByTimeGap: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_time_gap").length,
        gradeBBlockedByAmount: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_amount_mismatch").length,
        gradeBBlockedByMissingGoogleClickId: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_missing_click_id").length,
        gradeBPromotableToGradeANow: 0,
        googleLikeCompletedOrders: report.summary.googleLikeCompletedOrders,
        googleLikeCompletedAmountKrw: report.summary.googleLikeCompletedAmountKrw,
        googleLikeCompletedWithDirectGoogleClickId: report.summary.googleLikeCompletedWithDirectGoogleClickId,
        ambiguous: report.summary.ambiguous,
        purchaseWithoutIntent: report.summary.purchaseWithoutIntent,
        googleAdsSendCandidates: 0,
        vmCloudWrite: 0,
        operationalDbWrite: 0,
      },
      rows: enrichedCandidates
        .slice()
        .sort((a, b) =>
          Number(b.clickIdEvidence.hasGoogleClickId) - Number(a.clickIdEvidence.hasGoogleClickId)
          || (b.row.strongGrade === "A" ? 1 : 0) - (a.row.strongGrade === "A" ? 1 : 0)
          || Date.parse(b.row.paidAt) - Date.parse(a.row.paidAt),
        )
        .slice(0, 12)
        .map(toBridgeReviewRow),
      gradeBRows: enrichedCandidates
        .filter((item) => item.row.strongGrade === "B")
        .sort((a, b) =>
          Number(b.clickIdEvidence.hasGoogleClickId) - Number(a.clickIdEvidence.hasGoogleClickId)
          || Date.parse(b.row.paidAt) - Date.parse(a.row.paidAt),
        )
        .slice(0, 20)
        .map(toBridgeReviewRow),
      campaignSummary: Array.from(campaignMap.values())
        .sort((a, b) =>
          b.bridgeCandidatesWithGoogleClickId - a.bridgeCandidatesWithGoogleClickId
          || b.internalBridgeCandidates - a.internalBridgeCandidates
          || b.amountKrw - a.amountKrw,
        )
        .slice(0, 12)
        .map((row) => ({
          ...row,
          amountKrw: round2(row.amountKrw),
        })),
      finalSourceSummary,
      sourceFunnelComparison: report.sourceFunnelComparison,
      unresolvedRows: report.unresolvedRows,
      plainMeaning:
        "NPay 외부 결제완료는 네이버 화면에서 끝나므로 우리 결제완료 row에 click id가 직접 남기 어렵다. 그래서 내부 후보와 Google Ads 전송 후보를 분리한다.",
      noWritePolicy:
        "이번 결과는 no-write/no-send 검토표다. 영구 원장 write와 Google Ads 전송은 모두 0건으로 유지한다.",
      caveats: [
        ...report.notes,
        "raw gclid/gbraid/wbraid 값은 이 응답에 포함하지 않는다.",
        "recommendedAction이 safe_apply_candidate_after_write_approval이어도 실제 write 전에는 별도 승인이 필요하다.",
      ],
    };
  } catch (error) {
    return buildEmptyGoogleNpayBridgeReview(
      dateRange,
      "NPay bridge no-write 검토표를 만들지 못했다. Google Ads/내부 ROAS 본문은 유지하되, NPay 후보표는 source 연결을 먼저 확인해야 한다.",
      [error instanceof Error ? error.message : "unknown_npay_bridge_review_error"],
    );
  }
};

const readRecordNumber = (root: unknown, path: string[]): number => {
  let cursor: unknown = root;
  for (const key of path) {
    if (!isRecord(cursor)) return 0;
    cursor = cursor[key];
  }
  return toNumber(cursor);
};

const buildCoarseNpayFinalSourceSummaryFromReviewRecord = (
  review: Record<string, unknown>,
): GoogleNpayFinalSourceSummary => {
  const summary = isRecord(review.summary) ? review.summary : {};
  const campaignSummary = Array.isArray(review.campaignSummary) ? review.campaignSummary : [];
  const totalCompletedOrders = readRecordNumber(review, ["summary", "actualConfirmedNpayOrders"]);
  const classifiedCompletedOrders = readRecordNumber(review, ["summary", "internalBridgeStrongCandidates"]);
  const unclassifiedCompletedOrders = Math.max(0, totalCompletedOrders - classifiedCompletedOrders);

  const channelRows = emptyNpayFinalSourceSummary(0).byChannel.map((row) => ({ ...row }));
  const byChannel = new Map(channelRows.map((row) => [row.channel, row]));
  const googleRow = byChannel.get("google");
  const directRow = byChannel.get("direct");
  const unknownRow = byChannel.get("unknown");

  for (const rawRow of campaignSummary) {
    if (!isRecord(rawRow)) continue;
    const campaignId = toStringValue(rawRow.campaignId).trim();
    const bridgeCandidates = toNumber(rawRow.internalBridgeCandidates);
    const amountKrw = toNumber(rawRow.amountKrw);
    const clickIdCandidates = toNumber(rawRow.bridgeCandidatesWithGoogleClickId);
    const target = campaignId || clickIdCandidates > 0 ? googleRow : directRow;
    if (!target) continue;

    target.completedOrders += bridgeCandidates;
    target.bridgeCandidateOrders += bridgeCandidates;
    target.amountKrw += amountKrw;
    target.directGoogleClickIdOrders += campaignId || clickIdCandidates > 0 ? clickIdCandidates : 0;
    target.confidence = campaignId || clickIdCandidates > 0 ? "medium" : "low";
    target.plain = campaignId || clickIdCandidates > 0
      ? "원격 VM Cloud 요약에서 campaign id 또는 Google click id가 있는 내부 bridge 후보입니다."
      : "원격 VM Cloud 요약에서 campaign id가 없는 내부 bridge 후보입니다. direct 또는 출처 유실로 봅니다.";
  }

  if (unknownRow) {
    unknownRow.completedOrders = unclassifiedCompletedOrders;
    unknownRow.bridgeCandidateOrders = 0;
    unknownRow.confidence = "low";
    unknownRow.plain = unclassifiedCompletedOrders > 0
      ? `버튼 클릭 row와 강하게 붙지 않은 NPay 결제완료입니다. ambiguous ${toNumber(summary.ambiguous)}건, purchase_without_intent ${toNumber(summary.purchaseWithoutIntent)}건을 포함합니다.`
      : "모든 NPay 결제완료가 버튼 클릭 row와 연결되었습니다.";
  }

  const finalRows = Array.from(byChannel.values()).map((row) => ({
    ...row,
    amountKrw: round2(row.amountKrw),
  }));
  const googleEvidenceAmountKrw = round2(googleRow?.amountKrw ?? 0);

  return {
    totalCompletedOrders,
    classifiedCompletedOrders,
    unclassifiedCompletedOrders,
    googleEvidenceOrders: googleRow?.completedOrders ?? 0,
    googleEvidenceAmountKrw,
    byChannel: finalRows,
    unclassifiedReasons: buildNpayUnclassifiedReasons([], toNumber(summary.purchaseWithoutIntent)),
    dateDistribution: [],
    source: "npay_intent_bridge_candidate_rows",
    basis:
      "로컬 보고서가 VM Cloud 최신 요약을 가져온 뒤, campaign id/click id가 있는 bridge 후보와 없는 후보를 나눠 만든 fallback 분류입니다.",
    caveat:
      "원격 API가 row-level source 필드를 아직 제공하지 않을 때 쓰는 요약입니다. Google/Direct 외 Meta/Naver/Organic 세부 분류는 원문 intent source 필드 배포 후 더 정확해집니다.",
  };
};

const setDashboardRemoteFallbackDiagnostic = <T extends Record<string, unknown>>(
  payload: T,
  diagnostic: Record<string, unknown>,
) => {
  const mutablePayload = payload as Record<string, unknown>;
  const previousDiagnostics = isRecord(mutablePayload["diagnostics"]) ? mutablePayload["diagnostics"] : {};
  mutablePayload["diagnostics"] = {
    ...previousDiagnostics,
    npayIntentRemoteFallback: diagnostic,
  };
};

const shouldUseRemoteNpayIntentFallback = (payload: Record<string, unknown>) => {
  const localIntentRows = readRecordNumber(payload, ["npayBridgeReview", "summary", "liveIntentCount"]);
  const localNpayCompletedRows = readRecordNumber(payload, ["npayBridgeReview", "summary", "actualConfirmedNpayOrders"]);
  const localDropoffIntentRows = readRecordNumber(payload, [
    "clickIdDropoffHealth",
    "stages",
    "npayIntentExact",
    "rows",
  ]);

  return localNpayCompletedRows > 0 && localIntentRows === 0 && localDropoffIntentRows === 0;
};

const shouldSkipRemoteNpayIntentFallback = (query: Record<string, unknown>) => {
  const value = toStringValue(query.remote_fallback).trim().toLowerCase();
  return value === "0" || value === "false" || value === "off";
};

const buildRemoteGoogleAdsDashboardSummaryUrl = (query: Record<string, unknown>) => {
  const url = new URL("/api/google-ads/dashboard-summary", env.ATTRIBUTION_OPERATIONAL_BASE_URL);
  [
    "date_preset",
    "start_date",
    "end_date",
    "campaign_limit",
    "conversion_action_limit",
    "customer_id",
  ].forEach((key) => {
    const value = toStringValue(query[key]).trim();
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("remote_fallback", "0");
  return url;
};

const fetchRemoteGoogleAdsDashboardSummary = async (
  query: Record<string, unknown>,
): Promise<{ body: Record<string, unknown> | null; diagnostic?: Record<string, unknown> }> => {
  const url = buildRemoteGoogleAdsDashboardSummaryUrl(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        body: null,
        diagnostic: {
          reason: "remote_http_not_ok",
          status: response.status,
          url: url.toString(),
        },
      };
    }
    const body = await response.json();
    return {
      body: isRecord(body) ? body : null,
      diagnostic: isRecord(body)
        ? undefined
        : {
          reason: "remote_body_not_object",
          url: url.toString(),
        },
    };
  } catch (error) {
    return {
      body: null,
      diagnostic: {
        reason: "remote_fetch_exception",
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        url: url.toString(),
      },
    };
  } finally {
    clearTimeout(timer);
  }
};

const maybeApplyRemoteNpayIntentFallback = async <T extends Record<string, unknown>>(
  payload: T,
  query: Record<string, unknown>,
): Promise<T> => {
  if (shouldSkipRemoteNpayIntentFallback(query) || !shouldUseRemoteNpayIntentFallback(payload)) {
    return payload;
  }

  const remoteResult = await fetchRemoteGoogleAdsDashboardSummary(query);
  const remote = remoteResult.body;
  if (!remote) {
    setDashboardRemoteFallbackDiagnostic(payload, {
      applied: false,
      reason: remoteResult.diagnostic?.reason ?? "remote_fetch_failed",
      source: env.ATTRIBUTION_OPERATIONAL_BASE_URL,
      diagnostic: remoteResult.diagnostic,
      plain:
        "로컬 DB에는 NPay 버튼 클릭 원장이 없어서 VM Cloud 보강을 시도했지만, 원격 요약 API를 읽지 못했습니다.",
    });
    return payload;
  }

  const remoteIntentRows = readRecordNumber(remote, ["npayBridgeReview", "summary", "liveIntentCount"]);
  const remoteDropoffRows = readRecordNumber(remote, [
    "clickIdDropoffHealth",
    "stages",
    "npayIntentExact",
    "rows",
  ]);
  if (remoteIntentRows <= 0 && remoteDropoffRows <= 0) {
    setDashboardRemoteFallbackDiagnostic(payload, {
      applied: false,
      reason: "remote_has_no_npay_intent_rows",
      source: env.ATTRIBUTION_OPERATIONAL_BASE_URL,
      plain:
        "VM Cloud 요약 API에도 해당 window의 NPay 버튼 클릭 row가 없어 로컬 값을 유지했습니다.",
    });
    return payload;
  }

  const mutablePayload = payload as Record<string, unknown>;
  if (isRecord(remote.npayBridgeReview)) {
    const remoteNpayBridgeReview: Record<string, unknown> = { ...remote.npayBridgeReview };
    if (!isRecord(remoteNpayBridgeReview.finalSourceSummary)) {
      remoteNpayBridgeReview.finalSourceSummary = buildCoarseNpayFinalSourceSummaryFromReviewRecord(
        remoteNpayBridgeReview,
      );
    }
    if (
      Array.isArray(remoteNpayBridgeReview.unresolvedRows) &&
      remoteNpayBridgeReview.unresolvedRows.length > 0 &&
      isRecord(remoteNpayBridgeReview.finalSourceSummary)
    ) {
      remoteNpayBridgeReview.finalSourceSummary = {
        ...remoteNpayBridgeReview.finalSourceSummary,
        unclassifiedReasons: buildNpayIntentUnresolvedReasonBreakdown(
          remoteNpayBridgeReview.unresolvedRows as NpayIntentRematchUnresolvedRow[],
        ),
      };
    }
    mutablePayload["npayBridgeReview"] = remoteNpayBridgeReview;
  }
  if (isRecord(remote.clickIdDropoffHealth)) {
    mutablePayload["clickIdDropoffHealth"] = remote.clickIdDropoffHealth;
  }

  setDashboardRemoteFallbackDiagnostic(payload, {
    applied: true,
    source: env.ATTRIBUTION_OPERATIONAL_BASE_URL,
    remoteFetchedAt: toStringValue(remote.fetchedAt),
    remoteGeneratedAt: toStringValue(remote.npayBridgeReview && isRecord(remote.npayBridgeReview)
      ? remote.npayBridgeReview.generatedAt
      : ""),
    remoteNpayIntentRows: remoteIntentRows,
    remoteNpayIntentGoogleClickIdRows:
      readRecordNumber(remote, ["npayBridgeReview", "summary", "googleClickIdIntentCount"]) ||
      readRecordNumber(remote, ["clickIdDropoffHealth", "stages", "npayIntentExact", "googleClickIdRows"]),
    plain:
      "로컬 보고서의 Google Ads 비용/캠페인 값은 그대로 두고, 로컬 DB에 없는 NPay 버튼 클릭 원장만 VM Cloud 최신 요약으로 보강했습니다.",
  });

  return payload;
};

const campaignSignalRate = (matched: number, denominator: number) =>
  denominator > 0 ? round4(matched / denominator) : null;

const buildGoogleCampaignHealthSplit = ({
  siteLanding,
  paidClickIntent,
  attributionLedger,
}: {
  siteLanding: GoogleCampaignMatchHealth["siteLanding"];
  paidClickIntent: GoogleCampaignMatchHealth["paidClickIntent"];
  attributionLedger: GoogleCampaignMatchHealth["attributionLedger"];
}): GoogleCampaignMatchHealth["healthSplit"] => {
  const siteLandingHasCampaignId = siteLanding.gadCampaignIdRows > 0;
  const siteLandingHasClickId = siteLanding.googleClickIdRows > 0;
  const paidIntentHasCampaignId = paidClickIntent.gadCampaignIdRows > 0;
  const paidIntentHasClickId = paidClickIntent.googleClickIdRows > 0;
  const orderHasCampaignId = attributionLedger.confirmedRowsWithGadCampaignId > 0;
  const orderHasGoogleEvidence = attributionLedger.googleClickIdEvidenceRows > 0;
  const paidIntentBehindLanding =
    siteLanding.gadCampaignIdRows > 0 && paidClickIntent.gadCampaignIdRows < siteLanding.gadCampaignIdRows;

  return {
    roasAttribution: {
      source: "site_landing_ledger_and_attribution_ledger",
      status: siteLandingHasCampaignId
        ? "usable_for_budget_review"
        : siteLandingHasClickId
          ? "collecting"
          : "blocked",
      rows: siteLanding.rows,
      googleClickIdRows: siteLanding.googleClickIdRows,
      gadCampaignIdRows: siteLanding.gadCampaignIdRows,
      currentCampaignIdCoverageRate: siteLanding.currentCampaignIdCoverageRate,
      latestAt: siteLanding.latestAt,
      interpretation: siteLandingHasCampaignId
        ? "예산 판단용 내부 ROAS는 site_landing_ledger와 attribution_ledger를 우선 기준으로 본다. 이 경로에는 Google click id와 gad_campaignid가 함께 남고 있다."
        : siteLandingHasClickId
          ? "Google click id는 들어오지만 gad_campaignid가 부족하다. 캠페인별 ROAS 기준점으로 쓰려면 신규 클릭의 campaign id 보존을 더 확인해야 한다."
          : "최근 window에 Google click id 유입 row가 없어 ROAS 캠페인 매칭 기준으로 쓸 수 없다.",
    },
    paidClickIntentTag: {
      source: "paid_click_intent_ledger",
      status: paidIntentBehindLanding
        ? "needs_exact_click_diagnosis"
        : paidIntentHasCampaignId
          ? "monitoring"
          : paidIntentHasClickId
            ? "collecting"
            : "blocked",
      rows: paidClickIntent.rows,
      googleClickIdRows: paidClickIntent.googleClickIdRows,
      gadCampaignIdRows: paidClickIntent.gadCampaignIdRows,
      currentCampaignIdCoverageRate: paidClickIntent.currentCampaignIdCoverageRate,
      latestAt: paidClickIntent.latestAt,
      interpretation: paidIntentBehindLanding
        ? "paid_click_intent_ledger는 태그/receiver 진단용이다. site_landing보다 campaign id row가 적어 exact-click miss를 별도 이슈로 봐야 한다."
        : paidIntentHasCampaignId
          ? "paid-click-intent 태그가 Google click id와 gad_campaignid를 함께 저장하고 있다. 이 값은 ROAS 정본이 아니라 태그 건강도 확인용이다."
          : paidIntentHasClickId
            ? "paid-click-intent 태그는 click id를 저장하지만 campaign id 보존이 아직 부족하다."
            : "paid-click-intent 태그 원장에 최근 Google click id row가 없어 태그 건강도를 판단하기 어렵다.",
    },
    orderAttribution: {
      source: "attribution_ledger",
      status: orderHasCampaignId
        ? "usable_for_order_join"
        : orderHasGoogleEvidence
          ? "collecting"
          : "blocked",
      rows: attributionLedger.rows,
      googleClickIdEvidenceRows: attributionLedger.googleClickIdEvidenceRows,
      confirmedPaymentSuccessRows: attributionLedger.confirmedPaymentSuccessRows,
      confirmedRowsWithGadCampaignId: attributionLedger.confirmedRowsWithGadCampaignId,
      latestAt: attributionLedger.latestAt,
      interpretation: orderHasCampaignId
        ? "주문 원장에도 Google campaign id evidence가 남아 있다. 결제완료 주문 기준 ROAS join의 보조 근거로 쓸 수 있다."
        : orderHasGoogleEvidence
          ? "주문 원장에는 Google click evidence가 있으나 결제완료 campaign id 연결은 더 쌓여야 한다."
          : "주문 원장에서 Google click evidence가 부족해 결제완료 ROAS join 기준으로 쓰기 어렵다.",
    },
  };
};

const buildGoogleCampaignMatchHealth = ({
  campaigns,
  dateRange,
  windowDays,
}: {
  campaigns: CampaignMetricRow[];
  dateRange?: DateRange;
  windowDays: number;
}): GoogleCampaignMatchHealth => {
  const since = dateRange?.startAt ?? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const untilExclusive = dateRange?.endExclusiveAt ?? null;
  const campaignById = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign.campaignName]));

  try {
    const db = getCrmDb();
    if (
      !sqliteTableExists(db, "site_landing_ledger")
      || !sqliteTableExists(db, "paid_click_intent_ledger")
      || !sqliteTableExists(db, "attribution_ledger")
    ) {
      return emptyGoogleCampaignMatchHealth(
        windowDays,
        "table_unavailable",
        "VM Cloud 캠페인 매칭 health에 필요한 SQLite 원장 테이블이 없습니다.",
      );
    }

    const siteLanding = db.prepare(`
      SELECT
        COUNT(*) AS rows,
        SUM(CASE WHEN LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          OR landing_url LIKE '%gclid=%'
          OR landing_url LIKE '%gbraid=%'
          OR landing_url LIKE '%wbraid=%'
          THEN 1 ELSE 0 END) AS googleClickIdRows,
        SUM(CASE WHEN landing_url LIKE '%gad_campaignid=%' THEN 1 ELSE 0 END) AS gadCampaignIdRows,
        SUM(CASE WHEN landing_url LIKE '%gad_source=%' THEN 1 ELSE 0 END) AS gadSourceRows,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(utm_campaign), ''), '') = ''
          AND LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          THEN 1 ELSE 0 END) AS utmBlankGoogleClickIdRows,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(utm_campaign), ''), '') <> ''
          AND LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          THEN 1 ELSE 0 END) AS utmPresentGoogleClickIdRows,
        MAX(landed_at) AS latestAt
      FROM site_landing_ledger
      WHERE site = 'biocom'
        AND landed_at >= ?
        AND (? IS NULL OR landed_at < ?)
    `).get(since, untilExclusive, untilExclusive) as Record<string, unknown>;

    const paidClickIntent = db.prepare(`
      SELECT
        COUNT(*) AS rows,
        SUM(CASE WHEN LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          OR allowed_query_json LIKE '%gclid_present%'
          OR allowed_query_json LIKE '%gbraid_present%'
          OR allowed_query_json LIKE '%wbraid_present%'
          THEN 1 ELSE 0 END) AS googleClickIdRows,
        SUM(CASE WHEN allowed_query_json LIKE '%gad_campaignid%' THEN 1 ELSE 0 END) AS gadCampaignIdRows,
        SUM(CASE WHEN allowed_query_json LIKE '%gad_source%' THEN 1 ELSE 0 END) AS gadSourceRows,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(utm_campaign), ''), '') = ''
          AND LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          THEN 1 ELSE 0 END) AS utmBlankGoogleClickIdRows,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(utm_campaign), ''), '') <> ''
          AND LOWER(COALESCE(click_id_type, '')) IN ('gclid','gbraid','wbraid')
          THEN 1 ELSE 0 END) AS utmPresentGoogleClickIdRows,
        MAX(captured_at) AS latestAt
      FROM paid_click_intent_ledger
      WHERE site = 'biocom'
        AND captured_at >= ?
        AND (? IS NULL OR captured_at < ?)
    `).get(since, untilExclusive, untilExclusive) as Record<string, unknown>;

    const attributionLedger = db.prepare(`
      SELECT
        COUNT(*) AS rows,
        SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL} THEN 1 ELSE 0 END) AS gadCampaignIdRows,
        SUM(CASE WHEN ${ATTRIBUTION_LEDGER_GOOGLE_CLICK_ID_SQL} THEN 1 ELSE 0 END) AS googleClickIdEvidenceRows,
        SUM(CASE WHEN touchpoint = 'payment_success' AND payment_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedPaymentSuccessRows,
        SUM(CASE WHEN touchpoint = 'payment_success'
          AND payment_status = 'confirmed'
          AND ${ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL}
          THEN 1 ELSE 0 END) AS confirmedRowsWithGadCampaignId,
        MAX(logged_at) AS latestAt
      FROM attribution_ledger
      WHERE source = ?
        AND logged_at >= ?
        AND (? IS NULL OR logged_at < ?)
    `).get(INTERNAL_LEDGER_SOURCE, since, untilExclusive, untilExclusive) as Record<string, unknown>;

    const topRows = db.prepare(`
      SELECT logged_at, touchpoint, payment_status, landing, metadata_json
      FROM attribution_ledger
      WHERE source = ?
        AND logged_at >= ?
        AND (? IS NULL OR logged_at < ?)
        AND ${ATTRIBUTION_LEDGER_GAD_CAMPAIGN_ID_SQL}
      ORDER BY logged_at DESC
      LIMIT 5000
    `).all(INTERNAL_LEDGER_SOURCE, since, untilExclusive, untilExclusive) as Array<Record<string, unknown>>;

    const topCounts = new Map<string, { rows: number; confirmedRows: number }>();
    for (const row of topRows) {
      const campaignId = extractGadCampaignIdFromText(
        `${toStringValue(row.landing)} ${toStringValue(row.metadata_json)}`,
      );
      if (!campaignId) continue;
      const current = topCounts.get(campaignId) ?? { rows: 0, confirmedRows: 0 };
      current.rows += 1;
      if (
        toStringValue(row.touchpoint) === "payment_success"
        && toStringValue(row.payment_status) === "confirmed"
      ) {
        current.confirmedRows += 1;
      }
      topCounts.set(campaignId, current);
    }

    const siteLandingGoogleClickIdRows = toNumber(siteLanding.googleClickIdRows);
    const siteLandingGadCampaignIdRows = toNumber(siteLanding.gadCampaignIdRows);
    const siteLandingRecoverableRows = toNumber(siteLanding.utmBlankGoogleClickIdRows);
    const paidClickGoogleClickIdRows = toNumber(paidClickIntent.googleClickIdRows);
    const paidClickGadCampaignIdRows = toNumber(paidClickIntent.gadCampaignIdRows);
    const paidClickRecoverableRows = toNumber(paidClickIntent.utmBlankGoogleClickIdRows);
    const mappedRows = siteLandingGadCampaignIdRows + paidClickGadCampaignIdRows;
    const unmappedRows = Math.max(0, siteLandingRecoverableRows + paidClickRecoverableRows);
    const canPromoteBaseline = mappedRows > 0;
    const hasGoogleClickRows = siteLandingGoogleClickIdRows > 0 || paidClickGoogleClickIdRows > 0;
    const status: GoogleCampaignMatchHealth["summary"]["status"] = canPromoteBaseline
      ? "campaign_id_collecting"
      : hasGoogleClickRows
        ? "allowlist_deployed_waiting_new_click"
        : "no_google_click_id_rows";
    const interpretation = status === "campaign_id_collecting"
      ? "신규 Google 유입에서 gad_campaignid가 수집되고 있습니다. post-deploy smoke 후 ROAS 재계산 기준점으로 승격할 수 있습니다."
      : status === "allowlist_deployed_waiting_new_click"
        ? "gad_campaignid allowlist는 배포됐습니다. 배포 전 window에는 캠페인 ID가 0건이라 신규 Google 클릭 row가 쌓인 뒤 매칭률을 다시 확인해야 합니다."
        : "최근 window에 Google click id row가 없어 캠페인 ID 매칭률을 판단할 수 없습니다.";
    const siteLandingHealth = {
      rows: toNumber(siteLanding.rows),
      googleClickIdRows: siteLandingGoogleClickIdRows,
      gadCampaignIdRows: siteLandingGadCampaignIdRows,
      gadSourceRows: toNumber(siteLanding.gadSourceRows),
      utmBlankGoogleClickIdRows: siteLandingRecoverableRows,
      utmPresentGoogleClickIdRows: toNumber(siteLanding.utmPresentGoogleClickIdRows),
      currentCampaignIdCoverageRate: campaignSignalRate(siteLandingGadCampaignIdRows, siteLandingGoogleClickIdRows),
      potentialCoverageRateAfterAllowlist: campaignSignalRate(
        siteLandingGadCampaignIdRows + siteLandingRecoverableRows,
        siteLandingGoogleClickIdRows,
      ),
      latestAt: toStringValue(siteLanding.latestAt) || null,
    };
    const paidClickIntentHealth = {
      rows: toNumber(paidClickIntent.rows),
      googleClickIdRows: paidClickGoogleClickIdRows,
      gadCampaignIdRows: paidClickGadCampaignIdRows,
      gadSourceRows: toNumber(paidClickIntent.gadSourceRows),
      utmBlankGoogleClickIdRows: paidClickRecoverableRows,
      utmPresentGoogleClickIdRows: toNumber(paidClickIntent.utmPresentGoogleClickIdRows),
      currentCampaignIdCoverageRate: campaignSignalRate(paidClickGadCampaignIdRows, paidClickGoogleClickIdRows),
      potentialCoverageRateAfterAllowlist: campaignSignalRate(
        paidClickGadCampaignIdRows + paidClickRecoverableRows,
        paidClickGoogleClickIdRows,
      ),
      latestAt: toStringValue(paidClickIntent.latestAt) || null,
    };
    const attributionLedgerHealth = {
      rows: toNumber(attributionLedger.rows),
      gadCampaignIdRows: toNumber(attributionLedger.gadCampaignIdRows),
      googleClickIdEvidenceRows: toNumber(attributionLedger.googleClickIdEvidenceRows),
      confirmedPaymentSuccessRows: toNumber(attributionLedger.confirmedPaymentSuccessRows),
      confirmedRowsWithGadCampaignId: toNumber(attributionLedger.confirmedRowsWithGadCampaignId),
      latestAt: toStringValue(attributionLedger.latestAt) || null,
    };

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      source: "vm_cloud_sqlite_and_google_ads_dashboard",
      mode: "no_send_read_only",
      baseline: {
        candidateStartedAtKst: GOOGLE_CAMPAIGN_MATCH_BASELINE_KST,
        effectiveForRoasRecalculation: canPromoteBaseline,
        effectiveFromKst: canPromoteBaseline ? GOOGLE_CAMPAIGN_MATCH_BASELINE_KST : null,
        policy:
          `오늘 작업일은 ROAS 재계산 기준 후보일 뿐이다. allowlist 배포 시각(${GOOGLE_CAMPAIGN_MATCH_ALLOWLIST_DEPLOYED_AT_KST}) 이후 신규 유입에서 gad_campaignid 보존이 확인된 뒤부터 재계산 기준점으로 승격한다.`,
      },
      siteLanding: siteLandingHealth,
      paidClickIntent: paidClickIntentHealth,
      attributionLedger: attributionLedgerHealth,
      confidenceThresholds: {
        exactClickViewPct: 95,
        gadCampaignIdWithClickIdPct: 85,
        gadCampaignIdSessionOnlyPct: 70,
        utmOnlyPct: 50,
        unmappedPct: 0,
      },
      topCampaignIds: [...topCounts.entries()]
        .map(([campaignId, value]) => ({
          campaignId,
          campaignName: campaignById.get(campaignId) ?? null,
          rows: value.rows,
          confirmedRows: value.confirmedRows,
          matchedToDashboardCampaign: campaignById.has(campaignId),
        }))
        .sort((a, b) => b.rows - a.rows || b.confirmedRows - a.confirmedRows)
        .slice(0, 8),
      healthSplit: buildGoogleCampaignHealthSplit({
        siteLanding: siteLandingHealth,
        paidClickIntent: paidClickIntentHealth,
        attributionLedger: attributionLedgerHealth,
      }),
      summary: {
        status,
        mappedRows,
        unmappedRows,
        recoverableRowsAfterAllowlist: unmappedRows,
        uploadCandidateCount: 0,
        interpretation,
      },
      caveats: [
        "gad_campaignid는 캠페인 ID 힌트다. gclid/gbraid/wbraid 같은 클릭 식별자가 아니므로 단독으로 Google Ads upload 후보가 되지 않는다.",
        "Google Ads dashboard campaign 목록에 없는 campaign id는 과거·비활성·limit 밖 캠페인일 수 있어 내부 ROAS 화면에서 보조/미확인으로 표시한다.",
        "내부 ROAS 재계산 기준점은 post-deploy smoke에서 신규 row의 gad_campaignid 보존이 확인된 뒤 승격한다.",
      ],
    };
  } catch (error) {
    return emptyGoogleCampaignMatchHealth(
      windowDays,
      "table_unavailable",
      `Google 캠페인 매칭 health 조회 실패: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
};

export const createGoogleAdsRouter = () => {
  const router = express.Router();
  type GoogleAdsDashboardCacheEntry = {
    key: string;
    computedAtMs: number;
    expiresAtMs: number;
    body: unknown;
  };
  const googleAdsDashboardSummaryCache = new Map<string, GoogleAdsDashboardCacheEntry>();

  const toKstMinute = (ms: number) =>
    new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");

  const isTruthyQueryFlag = (value: unknown) =>
    value === true || value === 1 || value === "1" || value === "true";

  const buildGoogleAdsDashboardSummaryCacheKey = (query: Record<string, unknown>) => {
    const dateSelection = parseGoogleAdsDateSelection(query);
    return JSON.stringify({
      customerId: normalizeCustomerId(query.customer_id),
      mode: dateSelection.mode,
      preset: dateSelection.datePreset,
      startDate: dateSelection.requestedStartDate,
      endDate: dateSelection.requestedEndDate,
      campaignLimit: parsePositiveInt(query.campaign_limit, 50, 200),
      conversionActionLimit: parsePositiveInt(query.conversion_action_limit, 100, 200),
    });
  };

  const readGoogleAdsDashboardSummaryCache = (key: string) => {
    const entry = googleAdsDashboardSummaryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      googleAdsDashboardSummaryCache.delete(key);
      return null;
    }
    return entry;
  };

  const writeGoogleAdsDashboardSummaryCache = (key: string, body: unknown) => {
    const now = Date.now();
    const entry: GoogleAdsDashboardCacheEntry = {
      key,
      computedAtMs: now,
      expiresAtMs: now + GOOGLE_ADS_DASHBOARD_SUMMARY_CACHE_TTL_MS,
      body,
    };
    googleAdsDashboardSummaryCache.set(key, entry);
    return entry;
  };

  const buildGoogleAdsDashboardSummaryCacheMeta = (
    entry: GoogleAdsDashboardCacheEntry | null,
    source: "in_memory_precompute" | "live_cache_miss" | "live_force_refresh",
    generationMs: number | null,
  ) => ({
    cached: source === "in_memory_precompute" && Boolean(entry),
    source,
    cached_at_kst: entry ? `${toKstMinute(entry.computedAtMs)} KST` : null,
    next_refresh_at_kst: entry ? `${toKstMinute(entry.expiresAtMs)} KST` : null,
    generation_ms: generationMs,
    staleness_ms: entry ? Math.max(0, Date.now() - entry.computedAtMs) : 0,
    ttl_ms: GOOGLE_ADS_DASHBOARD_SUMMARY_CACHE_TTL_MS,
  });

  const buildGoogleAdsDashboardPayload = async (query: Record<string, unknown>) => {
    const dateSelection = parseGoogleAdsDateSelection(query);
    const datePreset = dateSelection.datePreset;
    const dateRangeLiteral = dateSelection.dateRangeLiteral;
    const campaignLimit = parsePositiveInt(query.campaign_limit, 50, 200);
    const conversionActionLimit = parsePositiveInt(query.conversion_action_limit, 100, 200);
    const context = await createGoogleAdsContext(query.customer_id);

    const [customerResult, conversionResult, campaignResult, dailyResult, actionMetricResult] = await Promise.all([
      googleAdsSearch(context, buildCustomerQuery()),
      googleAdsSearch(context, buildConversionActionsQuery(conversionActionLimit)),
      googleAdsSearch(context, buildCampaignMetricsQuery(dateSelection.dateRangeCondition, campaignLimit)),
      googleAdsSearch(context, buildDailyMetricsQuery(dateSelection.dateRangeCondition)),
      googleAdsSearch(context, buildConversionActionMetricsQuery(dateSelection.dateRangeCondition)),
    ]);

    const errors = {
      customer: customerResult.ok ? null : customerResult.body,
      conversionActions: conversionResult.ok ? null : conversionResult.body,
      campaigns: campaignResult.ok ? null : campaignResult.body,
      daily: dailyResult.ok ? null : dailyResult.body,
      conversionActionMetrics: actionMetricResult.ok ? null : actionMetricResult.body,
    };
    const hasBlockingError =
      !customerResult.ok || !conversionResult.ok || !campaignResult.ok || !dailyResult.ok || !actionMetricResult.ok;

    if (hasBlockingError) {
      const error = new Error("Google Ads dashboard query failed");
      (error as Error & { statusCode?: number; payload?: unknown }).statusCode = 502;
      (error as Error & { statusCode?: number; payload?: unknown }).payload = {
        ok: false,
        fetchedAt: new Date().toISOString(),
        apiVersion: context.apiVersion,
        customerId: context.customerId,
        datePreset: dateSelection.mode === "custom" ? "custom" : datePreset,
        dateMode: dateSelection.mode,
        dateRangeLiteral,
        dateRangeCondition: dateSelection.dateRangeCondition,
        dateRange: dateSelection.dateRange,
        errors,
      };
      throw error;
    }

    const campaigns = parseCampaignRows(campaignResult.body.results ?? []);
    const daily = parseDailyRows(dailyResult.body.results ?? []);
    const conversionActions = (conversionResult.body.results ?? [])
      .map(normalizeConversionAction)
      .filter((row): row is ConversionActionRow => Boolean(row));
    const customerRaw = customerResult.body.results?.find(isRecord);
    const summary = summarizeRows(campaigns);
    const conversionActionMetricRows = parseConversionActionMetricRows(
      actionMetricResult.body.results ?? [],
      conversionActions,
    );
    const internal = await buildInternalReconciliation({
      datePreset,
      dateRange: dateSelection.dateRange,
      campaigns,
      daily,
      summary,
    });
    const conversionActionSegments = summarizeConversionActionSegments({
      rows: conversionActionMetricRows,
      platformSummary: summary,
      internalConfirmedRevenue: internal.summary.confirmedRevenue,
    });
    const npayActualCorrection = dateSelection.mode === "custom"
      ? await buildNpayActualCorrectionForWindowDays(
        dateSelection.windowDays,
        internal.summary.confirmedRevenue,
        Number(internal.summary.platformCost ?? summary.cost ?? 0),
        Number(internal.summary.confirmedOrders ?? 0),
      )
      : await buildNpayActualCorrection(
        datePreset,
        internal.summary.confirmedRevenue,
        Number(internal.summary.platformCost ?? summary.cost ?? 0),
        Number(internal.summary.confirmedOrders ?? 0),
      );
    if (dateSelection.mode === "custom") {
      npayActualCorrection.warnings.push(
        "custom range에서는 NPay actual snapshot이 exact date가 아니라 같은 일수 window 기준 참고값일 수 있다.",
      );
    }
    const operationalDbFreshness = await buildOperationalDbFreshness();
    const clickIdHealth = dateSelection.mode === "custom"
      ? await buildGoogleAdsClickIdHealthForDateRange(
        dateSelection.dateRange,
        operationalDbFreshness,
        dateSelection.windowDays,
      )
      : await buildGoogleAdsClickIdHealth(datePreset, operationalDbFreshness);
    const googleCampaignMatchHealth = buildGoogleCampaignMatchHealth({
      campaigns,
      dateRange: dateSelection.dateRange,
      windowDays: dateSelection.windowDays,
    });
    const npayBridgeReview = await buildGoogleNpayBridgeReview({
      dateRange: dateSelection.dateRange,
      campaigns,
    });
    const clickIdDropoffHealth = buildGoogleClickIdDropoffHealth({
      dateRange: dateSelection.dateRange,
      windowDays: dateSelection.windowDays,
      sourceFreshness: operationalDbFreshness,
      clickIdHealth,
    });

    const payload = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      apiVersion: context.apiVersion,
      customerId: context.customerId,
      datePreset: dateSelection.mode === "custom" ? "custom" : datePreset,
      dateMode: dateSelection.mode,
      dateRangeLiteral,
      dateRangeCondition: dateSelection.dateRangeCondition,
      dateRange: dateSelection.dateRange,
      dateWarnings: dateSelection.warnings,
      auth: {
        mode: context.authMode,
        oauthClientIdPresent: context.oauthClientIdPresent,
        serviceAccountClientEmailPresent: Boolean(context.clientEmail),
      },
      serviceAccount: {
        clientEmail: context.clientEmail,
        projectId: context.projectId,
      },
      source: "google_ads_api",
      customer: isRecord(customerRaw?.customer) ? customerRaw.customer : null,
      summary,
      campaigns,
      daily,
      conversionActions,
      conversionActionSegments,
      internal,
      npayActualCorrection,
      clickIdHealth,
      clickIdDropoffHealth,
      googleCampaignMatchHealth,
      npayBridgeReview,
      operationalDbFreshness,
      benchmark: {
        cost: internal.summary.platformCost ?? summary.cost,
        platformConversionValue: internal.summary.platformConversionValue ?? summary.conversionValue,
        platformRoas: internal.summary.platformRoas ?? summary.roas,
        internalConfirmedRevenue: internal.summary.confirmedRevenue,
        internalConfirmedOrders: internal.summary.confirmedOrders,
        internalConfirmedRoas: internal.summary.internalConfirmedRoas,
      },
      diagnostics: {
        campaignRows: campaigns.length,
        dailyRows: daily.length,
        conversionActionRows: conversionActions.length,
        conversionActionMetricRows: conversionActionMetricRows.length,
        campaignQueryResourceConsumption: campaignResult.body.queryResourceConsumption ?? null,
        dailyQueryResourceConsumption: dailyResult.body.queryResourceConsumption ?? null,
        conversionActionQueryResourceConsumption: conversionResult.body.queryResourceConsumption ?? null,
        conversionActionMetricQueryResourceConsumption: actionMetricResult.body.queryResourceConsumption ?? null,
        truncated: {
          campaigns: Boolean(campaignResult.body.nextPageToken),
          daily: Boolean(dailyResult.body.nextPageToken),
          conversionActions: Boolean(conversionResult.body.nextPageToken),
          conversionActionMetrics: Boolean(actionMetricResult.body.nextPageToken),
        },
      },
    };
    return maybeApplyRemoteNpayIntentFallback(payload, query);
  };

  router.get("/api/google-ads/status", async (req: Request, res: Response) => {
    try {
      const context = await createGoogleAdsContext(req.query.customer_id);
      const customerResult = await googleAdsSearch(context, buildCustomerQuery());
      if (!customerResult.ok) {
        res.status(customerResult.status).json({
          ok: false,
          error: customerResult.body,
        });
        return;
      }

      const first = customerResult.body.results?.find(isRecord) ?? {};
      res.json({
        ok: true,
        checkedAt: new Date().toISOString(),
        apiVersion: context.apiVersion,
        customerId: context.customerId,
        auth: {
          mode: context.authMode,
          oauthClientIdPresent: context.oauthClientIdPresent,
          serviceAccountClientEmailPresent: Boolean(context.clientEmail),
        },
        serviceAccount: {
          clientEmail: context.clientEmail,
          projectId: context.projectId,
        },
        customer: isRecord(first.customer) ? first.customer : null,
        queryResourceConsumption: customerResult.body.queryResourceConsumption ?? null,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads status check failed",
      });
    }
  });

  router.get("/api/google-ads/click-id-health", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const window = resolveClickIdHealthWindow(windowKey);
      const operationalDbFreshness = await buildOperationalDbFreshness();
      const health = await buildGoogleAdsClickIdHealthForWindow(window, operationalDbFreshness);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        site,
        health,
        invariants: {
          uploadCandidateCount: 0,
          sendCandidateCount: 0,
          externalSendCount: 0,
          operationalDbWrite: 0,
          vmCloudWrite: 0,
          rawClickIdInResponse: false,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_click_id_health_error",
        message: error instanceof Error ? error.message : "Google Ads click id health failed",
      });
    }
  });

  router.get("/api/google-ads/click-id-dropoff", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const operationalDbFreshness = await buildOperationalDbFreshness();
      const requestedWindow = typeof req.query.window === "string" && req.query.window.trim()
        ? req.query.window.trim()
        : "";
      if (requestedWindow) {
        const windowKey = parseClickIdHealthWindowKey(requestedWindow);
        if (!windowKey) {
          res.status(400).json({
            ok: false,
            error: "unsupported_window",
            allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
          });
          return;
        }
        const window = resolveClickIdHealthWindow(windowKey);
        const clickIdHealth = await buildGoogleAdsClickIdHealthForWindow(window, operationalDbFreshness);
        const dropoffHealth = buildGoogleClickIdDropoffHealth({
          dateRange: window,
          windowDays: window.windowDays,
          sourceFreshness: operationalDbFreshness,
          clickIdHealth,
        });

        res.json({
          ok: true,
          fetchedAt: new Date().toISOString(),
          site,
          dateMode: "window",
          datePreset: windowKey,
          dateRangeLiteral: window.label,
          dateRange: window,
          health: dropoffHealth,
          invariants: dropoffHealth.invariants,
        });
        return;
      }

      const dateSelection = parseGoogleAdsDateSelection(req.query as Record<string, unknown>);
      const clickIdHealth = await buildGoogleAdsClickIdHealthForDateRange(
        dateSelection.dateRange,
        operationalDbFreshness,
        dateSelection.windowDays,
      );
      const dropoffHealth = buildGoogleClickIdDropoffHealth({
        dateRange: dateSelection.dateRange,
        windowDays: dateSelection.windowDays,
        sourceFreshness: operationalDbFreshness,
        clickIdHealth,
      });

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        site,
        dateMode: dateSelection.mode,
        datePreset: dateSelection.mode === "custom" ? "custom" : dateSelection.datePreset,
        dateRangeLiteral: dateSelection.dateRangeLiteral,
        dateRange: dateSelection.dateRange,
        health: dropoffHealth,
        invariants: dropoffHealth.invariants,
      });
    } catch (error) {
      res.status(error instanceof GoogleAdsDateRangeError ? error.statusCode : 500).json({
        ok: false,
        error: "google_ads_click_id_dropoff_error",
        message: error instanceof Error ? error.message : "Google Ads click id dropoff failed",
      });
    }
  });

  router.get("/api/google-ads/click-id-health/orders", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const onlyRaw = typeof req.query.only === "string" ? req.query.only : "all";
      const only = onlyRaw === "with_click_id" || onlyRaw === "missing_click_id" ? onlyRaw : "all";
      const limit = parsePositiveInt(req.query.limit, 200, 10000);
      const window = resolveClickIdHealthWindow(windowKey);
      const diagnostics = await buildGoogleAdsClickIdOrderDiagnostics(window, { limit, only });

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        site,
        mode: "read_only_order_level_diagnostics",
        filter: {
          window: windowKey,
          only,
          limit,
        },
        ...diagnostics,
        invariants: {
          uploadCandidateCount: 0,
          sendCandidateCount: 0,
          externalSendCount: 0,
          operationalDbWrite: 0,
          vmCloudWrite: 0,
          rawOrderIdInResponse: true,
          rawClickIdInResponse: true,
        },
        caveats: [
          "이 endpoint는 주문번호와 raw Google click id를 그대로 노출하는 진단용이다. 공개 배포 전에는 접근 제한/마스킹/암호화가 필요하다.",
          "Google Ads conversion upload는 실행하지 않는다. 모든 row는 sendCandidateCount=0이다.",
          "주문 정본은 운영DB tb_iamweb_users, click id evidence는 VM Cloud SQLite payment_success/npay_intent 원장에서 읽는다.",
        ],
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_click_id_order_diagnostics_error",
        message: error instanceof Error ? error.message : "Google Ads click id order diagnostics failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/private-payload-preview", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 2, 20);
      const window = resolveClickIdHealthWindow(windowKey);
      const preview = await buildGoogleAdsConfirmedPurchasePrivatePayloadPreview(window, limit);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...preview,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_private_payload_preview_error",
        message: error instanceof Error ? error.message : "Google Ads private payload preview failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/click-age-dry-run", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 24, 200);
      const actionClickThroughLookbackDays = parsePositiveInt(
        req.query.lookback_days ?? req.query.lookbackDays,
        GOOGLE_ADS_CONFIRMED_PURCHASE_CLICK_LOOKBACK_DAYS,
        GOOGLE_ADS_CLICK_ID_STORAGE_DAYS,
      );
      const window = resolveClickIdHealthWindow(windowKey);
      const dryRun = await buildGoogleAdsConfirmedPurchaseClickAgeDryRun(
        window,
        limit,
        actionClickThroughLookbackDays,
      );

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...dryRun,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_click_age_dry_run_error",
        message: error instanceof Error ? error.message : "Google Ads click age dry-run failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/duplicate-ledger-dry-run", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 2, 20);
      const window = resolveClickIdHealthWindow(windowKey);
      const dryRun = await buildGoogleAdsDuplicateLedgerDryRun(window, limit);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...dryRun,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_duplicate_ledger_dry_run_error",
        message: error instanceof Error ? error.message : "Google Ads duplicate ledger dry-run failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/upload-ledger-write-smoke-plan", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 2, 20);
      const window = resolveClickIdHealthWindow(windowKey);
      const plan = await buildGoogleAdsUploadLedgerWriteSmokePlan(window, limit);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...plan,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_upload_ledger_write_smoke_plan_error",
        message: error instanceof Error ? error.message : "Google Ads upload ledger write smoke plan failed",
      });
    }
  });

  router.post("/api/google-ads/confirmed-purchase/upload-ledger-write-smoke", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const confirmation = typeof req.query.confirm === "string"
        ? req.query.confirm.trim()
        : typeof req.body?.confirmation === "string"
          ? req.body.confirmation.trim()
          : "";
      if (confirmation !== "vm_cloud_write_smoke_approved") {
        res.status(400).json({
          ok: false,
          error: "missing_write_smoke_confirmation",
          requiredConfirmation: "vm_cloud_write_smoke_approved",
          plain:
            "이 endpoint는 VM Cloud 장부에 ready row를 실제로 씁니다. Google Ads 전송은 하지 않지만, 장부 write 승인 문자열이 필요합니다.",
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = Math.min(parsePositiveInt(req.query.limit, 2, 20), 5);
      const window = resolveClickIdHealthWindow(windowKey);
      const smoke = await executeGoogleAdsUploadLedgerWriteSmoke(window, limit);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...smoke,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_upload_ledger_write_smoke_error",
        message: error instanceof Error ? error.message : "Google Ads upload ledger write smoke failed",
      });
    }
  });

  router.post("/api/google-ads/confirmed-purchase/limited-upload", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const confirmation = typeof req.query.confirm === "string"
        ? req.query.confirm.trim()
        : typeof req.body?.confirmation === "string"
          ? req.body.confirmation.trim()
          : "";
      if (confirmation !== "google_ads_limited_send_approved") {
        res.status(400).json({
          ok: false,
          error: "missing_limited_send_confirmation",
          requiredConfirmation: "google_ads_limited_send_approved",
          plain:
            "이 endpoint는 Google Ads에 실제 결제완료 전환을 최대 2건 전송합니다. 제한 전송 승인 문자열이 필요합니다.",
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const validateOnly = req.query.validate_only === "1" || req.query.validateOnly === "true";
      const allowUnwrittenValidateOnly =
        validateOnly
        && (req.query.allow_unwritten === "1" || req.query.allowUnwritten === "true");
      const includeFailedValidateOnly =
        validateOnly
        && (req.query.include_failed === "1" || req.query.includeFailed === "true");
      const requestedDedupeKeyHash = typeof req.query.dedupe_key_hash === "string"
        ? req.query.dedupe_key_hash.trim()
        : typeof req.query.dedupeKeyHash === "string"
          ? req.query.dedupeKeyHash.trim()
          : "";
      const requestedAmountKrw = toOptionalNumber(req.query.amount_krw ?? req.query.amountKrw);
      const limit = validateOnly && allowUnwrittenValidateOnly
        ? Math.min(parsePositiveInt(req.query.limit, 2, 50), 20)
        : Math.min(parsePositiveInt(req.query.limit, 2, 20), 5);
      const window = resolveClickIdHealthWindow(windowKey);
      const candidates = await buildGoogleAdsConfirmedPurchaseUploadCandidates(window, limit);
      const readyCandidates = (
        validateOnly && includeFailedValidateOnly
          ? candidates.filter((candidate) =>
            hasGoogleAdsUploadPayloadFields(candidate)
            && candidate.ledgerStatus === "failed"
            && (!requestedDedupeKeyHash || candidate.dedupeKeyHash === requestedDedupeKeyHash)
            && (requestedAmountKrw == null || candidate.conversionValue === requestedAmountKrw)
          )
          : validateOnly && allowUnwrittenValidateOnly
            ? candidates.filter((candidate) =>
              hasGoogleAdsUploadPayloadFields(candidate)
              && !candidate.ledgerRowId
            )
            : candidates.filter((candidate) => candidate.sendReady)
      ).slice(0, limit);

      if (readyCandidates.length === 0) {
        res.status(409).json({
          ok: false,
          error: "no_ready_google_ads_upload_candidates",
          fetchedAt: new Date().toISOString(),
          mode: validateOnly ? "google_ads_limited_upload_validate_only" : "google_ads_limited_upload",
          summary: {
            sourceCandidates: candidates.length,
            readyCandidates: 0,
            externalSendCount: 0,
            ledgerSentRows: 0,
            validationScope: includeFailedValidateOnly
              ? "failed_ledger_row"
              : allowUnwrittenValidateOnly
                ? "unwritten_candidates"
                : "ready_ledger_rows",
          },
          candidates: candidates.map((candidate) => ({
            candidateRank: candidate.candidateRank,
            safeRef: candidate.safeRef,
            maskedOrderRef: candidate.maskedOrderRef,
            ledgerStatus: candidate.ledgerStatus,
            sendReady: candidate.sendReady,
            blockReasons: candidate.blockReasons,
            rawOrderIdExposed: false,
            rawClickIdExposed: false,
          })),
        });
        return;
      }

      const context = await createGoogleAdsContext(req.query.customer_id);
      const upload = await uploadGoogleAdsClickConversions(context, readyCandidates, validateOnly);
      const ledgerUpdates = validateOnly ? [] : markGoogleAdsUploadLedgerRows(readyCandidates, upload);
      const sentCount = validateOnly ? 0 : upload.sentIndexes.size;
      const validatedCount = validateOnly && upload.ok
        ? readyCandidates.filter((_, index) => !upload.failedIndexes.has(index)).length
        : 0;

      res.json({
        ok: upload.ok,
        fetchedAt: new Date().toISOString(),
        mode: validateOnly ? "google_ads_limited_upload_validate_only" : "google_ads_limited_upload",
        goal: "Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로를 제한 2건으로 검증한다.",
        progress: {
          overallPrimaryConversionReadinessPct: validateOnly
            ? (upload.ok && !upload.partialFailure ? 94 : 92)
            : (sentCount > 0 ? 95 : 92),
          plain: validateOnly
            ? "Google Ads 실제 전송 전 형식 검증만 수행했습니다. 광고 플랫폼 구매 수치는 아직 변하지 않습니다."
            : sentCount > 0
              ? "Google Ads에 실제 구매 전용 전환을 제한 전송했고, 장부에 sent 상태를 남겼습니다."
              : "Google Ads 제한 전송이 완료되지 않았습니다. 장부 상태를 sent로 올리지 않았습니다.",
        },
        googleAds: {
          apiVersion: context.apiVersion,
          customerId: context.customerId,
          conversionActionId: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_ID,
          conversionActionName: GOOGLE_ADS_CONFIRMED_PURCHASE_OFFLINE_ACTION_NAME,
          validateOnly,
          responseStatus: upload.status,
          requestIdPresent: Boolean(upload.requestId),
          responseHash: upload.responseHash,
          partialFailure: upload.partialFailure,
          resultCount: upload.resultCount,
          errorSummary: upload.errorSummary,
        },
        summary: {
          sourceCandidates: candidates.length,
          readyCandidates: readyCandidates.length,
          attemptedConversions: readyCandidates.length,
          validatedConversions: validatedCount,
          externalSendCount: sentCount,
          ledgerSentRows: ledgerUpdates.filter((row) => row.statusAfter === "sent" && row.ledgerRowUpdated).length,
          ledgerFailedRows: ledgerUpdates.filter((row) => row.statusAfter === "failed" && row.ledgerRowUpdated).length,
          validationScope: includeFailedValidateOnly
            ? "failed_ledger_row"
            : allowUnwrittenValidateOnly
              ? "unwritten_candidates"
              : "ready_ledger_rows",
        },
        rows: readyCandidates.map((candidate, index) => ({
          candidateRank: candidate.candidateRank,
          safeRef: candidate.safeRef,
          maskedOrderRef: candidate.maskedOrderRef,
          ledgerStatus: candidate.ledgerStatus,
          amountKrw: candidate.conversionValue,
          conversionDate: candidate.conversionDateTime.slice(0, 10),
          uploadResult: validateOnly
            ? (upload.ok && !upload.failedIndexes.has(index) ? "validated" : "validation_failed")
            : upload.sentIndexes.has(index)
              ? "sent"
              : "failed",
          failureSummary: upload.failedIndexes.has(index)
            ? buildGoogleAdsUploadFailureLastError(upload, candidate, index)
            : "",
          rawOrderIdExposed: false,
          rawClickIdExposed: false,
        })),
        ledgerUpdates,
        invariants: {
          rawOrderIdInResponse: false,
          rawClickIdInResponse: false,
          operationalDbWrite: 0,
          vmCloudWrite: validateOnly ? 0 : ledgerUpdates.filter((row) => row.ledgerRowUpdated).length,
          googleAdsWrite: sentCount,
          externalSendCount: sentCount,
        },
        blockers: [
          upload.ok ? "" : "google_ads_upload_http_error",
          upload.partialFailure ? "google_ads_upload_partial_failure" : "",
        ].filter(Boolean),
        caveats: [
          "응답에는 원문 주문번호와 원문 gclid를 포함하지 않는다.",
          "validate_only=1이면 Google Ads 구매 수치와 장부 sent 상태를 바꾸지 않는다.",
          "실제 전송은 ready 장부 row가 있는 후보 최대 5건만 허용한다.",
          "allow_unwritten=1은 validate_only에서만 장부 미작성 후보를 검증한다.",
          "include_failed=1은 validate_only에서만 기존 failed row를 재검증한다.",
        ],
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_limited_upload_error",
        message: error instanceof Error ? error.message : "Google Ads limited upload failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/candidate-expansion", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 12, 60);
      const window = resolveClickIdHealthWindow(windowKey);
      const sourceFreshness = await buildOperationalDbFreshness();
      const expansion = await buildGoogleAdsConfirmedPurchaseCandidateExpansion(window, limit, sourceFreshness);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...expansion,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_confirmed_purchase_candidate_expansion_error",
        message: error instanceof Error ? error.message : "Google Ads confirmed purchase candidate expansion failed",
      });
    }
  });

  router.get("/api/google-ads/confirmed-purchase/offline-diagnostic-classification", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site.trim()
        ? req.query.site.trim()
        : "biocom";
      if (site !== "biocom") {
        res.status(400).json({
          ok: false,
          error: "unsupported_site",
          allowedSites: ["biocom"],
        });
        return;
      }

      const windowKey = parseClickIdHealthWindowKey(req.query.window);
      if (!windowKey) {
        res.status(400).json({
          ok: false,
          error: "unsupported_window",
          allowedWindows: ALLOWED_CLICK_ID_HEALTH_WINDOWS,
        });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 24, 120);
      const window = resolveClickIdHealthWindow(windowKey);
      const sourceFreshness = await buildOperationalDbFreshness();
      const classification = await buildGoogleAdsOfflineDiagnosticClassification(window, limit, sourceFreshness);

      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        ...classification,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "google_ads_offline_diagnostic_classification_error",
        message: error instanceof Error ? error.message : "Google Ads offline diagnostic classification failed",
      });
    }
  });

  router.get("/api/google-ads/final-url-audit", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(req.query.limit, 500, 2000);
      const requestedCustomerId = normalizeCustomerId(req.query.customer_id);
      const forceRefresh = req.query.force === "1" || req.query.force === "true";
      const cacheKey = `${requestedCustomerId}:${limit}`;
      const now = Date.now();

      if (
        !forceRefresh
        && finalUrlAuditCacheEntry
        && finalUrlAuditCacheEntry.key === cacheKey
        && finalUrlAuditCacheEntry.expiresAt > now
      ) {
        res.json({
          ...finalUrlAuditCacheEntry.body,
          cache: {
            cached: true,
            source: "in_memory_final_url_audit",
            cachedAt: new Date(finalUrlAuditCacheEntry.createdAt).toISOString(),
            expiresAt: new Date(finalUrlAuditCacheEntry.expiresAt).toISOString(),
            stalenessMs: now - finalUrlAuditCacheEntry.createdAt,
            ttlMs: FINAL_URL_AUDIT_CACHE_TTL_MS,
          },
        });
        return;
      }

      const context = await createGoogleAdsContext(req.query.customer_id);

      const [customerTrackingResult, adFinalUrlResult, assetGroupFinalUrlResult] = await Promise.all([
        googleAdsSearch(context, buildCustomerTrackingQuery()),
        googleAdsSearch(context, buildAdFinalUrlAuditQuery(limit)),
        googleAdsSearch(context, buildAssetGroupFinalUrlAuditQuery(limit)),
      ]);

      const errors = {
        customerTracking: customerTrackingResult.ok ? null : customerTrackingResult.body,
        adFinalUrls: adFinalUrlResult.ok ? null : adFinalUrlResult.body,
        assetGroupFinalUrls: assetGroupFinalUrlResult.ok ? null : assetGroupFinalUrlResult.body,
      };

      if (!adFinalUrlResult.ok && !assetGroupFinalUrlResult.ok) {
        res.status(502).json({
          ok: false,
          fetchedAt: new Date().toISOString(),
          apiVersion: context.apiVersion,
          customerId: context.customerId,
          source: "google_ads_api",
          errors,
        });
        return;
      }

      const customerRaw = customerTrackingResult.ok
        ? customerTrackingResult.body.results?.find(isRecord)
        : null;
      const customer = isRecord(customerRaw?.customer) ? customerRaw.customer : null;
      const autoTaggingEnabled = customer
        ? customer.autoTaggingEnabled === true
        : null;
      const adRows = adFinalUrlResult.ok
        ? parseAdFinalUrlAuditRows(adFinalUrlResult.body.results ?? [])
        : [];
      const assetGroupRows = assetGroupFinalUrlResult.ok
        ? parseAssetGroupFinalUrlAuditRows(assetGroupFinalUrlResult.body.results ?? [])
        : [];
      const rows = [...adRows, ...assetGroupRows];
      const siteSummary = summarizeFinalUrlAuditRows(rows, autoTaggingEnabled);
      const landingClickIdAudit = buildLandingClickIdAudits(7);
      const otherUrlSummary = summarizeOtherFinalUrls(rows);
      const actualTrafficRouteAudit = buildGoogleAdsTrafficRouteAudits({
        rows,
        siteSummary,
        landingClickIdAudit,
        autoTaggingEnabled,
      });
      const responseBody = {
        ok: true,
        fetchedAt: new Date().toISOString(),
        apiVersion: context.apiVersion,
        customerId: context.customerId,
        source: "google_ads_api",
        mode: "read_only_final_url_audit",
        customer,
        autoTaggingEnabled,
        summary: {
          totalRows: rows.length,
          adRows: adRows.length,
          assetGroupRows: assetGroupRows.length,
          finalUrls: rows.reduce((sum, row) => sum + row.finalUrlCount, 0),
          manualUtmRows: rows.filter((row) => row.hasUtmSource && row.hasUtmMedium).length,
          googleClickParamRows: rows.filter((row) => row.hasGoogleClickParam).length,
          trackingTemplateRows: rows.filter((row) => row.hasTrackingTemplate).length,
          finalUrlSuffixRows: rows.filter((row) => row.hasFinalUrlSuffix).length,
          siteSummary,
          landingClickIdAudit,
          otherUrlSummary,
          actualTrafficRouteAudit,
          warnings: [
            "Google Ads 최종 URL은 광고 설정값이다. 실제 클릭 시 자동 태깅 gclid/gbraid/wbraid가 붙고 리다이렉트 후 살아남는지는 VM Cloud landing row로 별도 확인해야 한다.",
            "sampleUrls는 query value를 {set}으로 가린 read-only preview다.",
            "landingClickIdAudit은 VM Cloud site_landing_ledger read-only 집계다. gclid/gbraid/wbraid 원문 값은 반환하지 않는다.",
          ],
        },
        rows,
        errors,
        diagnostics: {
          adFinalUrlQueryResourceConsumption: adFinalUrlResult.ok
            ? adFinalUrlResult.body.queryResourceConsumption ?? null
            : null,
          assetGroupFinalUrlQueryResourceConsumption: assetGroupFinalUrlResult.ok
            ? assetGroupFinalUrlResult.body.queryResourceConsumption ?? null
            : null,
          customerTrackingQueryResourceConsumption: customerTrackingResult.ok
            ? customerTrackingResult.body.queryResourceConsumption ?? null
            : null,
          truncated: {
            adFinalUrls: adFinalUrlResult.ok ? Boolean(adFinalUrlResult.body.nextPageToken) : false,
            assetGroupFinalUrls: assetGroupFinalUrlResult.ok
              ? Boolean(assetGroupFinalUrlResult.body.nextPageToken)
              : false,
          },
        },
        cache: {
          cached: false,
          source: "live_google_ads_api",
          cachedAt: null,
          expiresAt: new Date(Date.now() + FINAL_URL_AUDIT_CACHE_TTL_MS).toISOString(),
          stalenessMs: 0,
          ttlMs: FINAL_URL_AUDIT_CACHE_TTL_MS,
        },
      };

      finalUrlAuditCacheEntry = {
        key: cacheKey,
        createdAt: now,
        expiresAt: now + FINAL_URL_AUDIT_CACHE_TTL_MS,
        body: responseBody,
      };

      res.json(responseBody);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads final URL audit failed",
      });
    }
  });

  router.get("/api/google-ads/dashboard-summary", async (req: Request, res: Response) => {
    try {
      const query = req.query as Record<string, unknown>;
      const force = isTruthyQueryFlag(query.force);
      const cacheKey = buildGoogleAdsDashboardSummaryCacheKey(query);
      const cached = !force ? readGoogleAdsDashboardSummaryCache(cacheKey) : null;
      if (cached) {
        const body = isRecord(cached.body) ? cached.body : {};
        res.json({
          ...body,
          source: "google_ads_dashboard_summary",
          cache: buildGoogleAdsDashboardSummaryCacheMeta(cached, "in_memory_precompute", 0),
        });
        return;
      }

      const startedAt = Date.now();
      const payload = await buildGoogleAdsDashboardPayload(query);
      const entry = query.cache_write === "0" ? null : writeGoogleAdsDashboardSummaryCache(cacheKey, payload);
      const source = force ? "live_force_refresh" : "live_cache_miss";
      res.json({
        ...payload,
        source: "google_ads_dashboard_summary",
        cache: buildGoogleAdsDashboardSummaryCacheMeta(entry, source, Date.now() - startedAt),
      });
    } catch (error) {
      const payload = isRecord((error as Error & { payload?: unknown }).payload)
        ? (error as Error & { payload?: unknown }).payload
        : null;
      const status = error instanceof GoogleAdsDateRangeError
        ? error.statusCode
        : (error as Error & { statusCode?: number }).statusCode ?? 500;
      if (payload) {
        res.status(status).json(payload);
        return;
      }
      res.status(status).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads dashboard summary query failed",
      });
    }
  });

  router.get("/api/google-ads/dashboard", async (req: Request, res: Response) => {
    try {
      const payload = await buildGoogleAdsDashboardPayload(req.query as Record<string, unknown>);
      res.json(payload);
    } catch (error) {
      const payload = isRecord((error as Error & { payload?: unknown }).payload)
        ? (error as Error & { payload?: unknown }).payload
        : null;
      const status = error instanceof GoogleAdsDateRangeError
        ? error.statusCode
        : (error as Error & { statusCode?: number }).statusCode ?? 500;
      if (payload) {
        res.status(status).json(payload);
        return;
      }
      res.status(status).json({
        ok: false,
        error: error instanceof Error ? error.message : "Google Ads dashboard query failed",
      });
    }
  });

  return router;
};
