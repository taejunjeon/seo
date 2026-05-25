import express, { type Request, type Response } from "express";
import { google } from "googleapis";

import { readLedgerEntries, type AttributionLedgerEntry } from "../attribution";
import {
  estimateInternalRoasLift,
  fetchNpayActualConfirmedSnapshot,
  type NpayActualConfirmedSnapshot,
} from "../npayActualConfirmedPgReader";
import {
  buildNpayIntentRematchDryRunReport,
  type NpayIntentRematchDryRunReport,
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
  clientEmail: string | null;
  projectId: string | null;
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
    actualConfirmedNpayOrders: number;
    internalBridgeStrongCandidates: number;
    internalBridgeExactCandidates: number;
    internalBridgeExactWithGoogleClickId: number;
    bridgeCandidatesWithGoogleClickId: number;
    gradeA: number;
    gradeB: number;
    gradeBWithGoogleClickId: number;
    gradeBBlockedByTimeGap: number;
    gradeBBlockedByAmount: number;
    gradeBBlockedByMissingGoogleClickId: number;
    gradeBPromotableToGradeANow: number;
    ambiguous: number;
    purchaseWithoutIntent: number;
    googleAdsSendCandidates: 0;
    vmCloudWrite: 0;
    operationalDbWrite: 0;
  };
  rows: GoogleNpayBridgeReviewRow[];
  campaignSummary: GoogleNpayBridgeCampaignSummary[];
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
  uploadCandidateCount: 0;
  sendCandidateCount: 0;
  blockReasons: string[];
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

const summarizeGoogleAdsError = (text: string): GoogleAdsErrorSummary => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const root = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : parsed;
    if (!isRecord(root)) return { rawPreview: text.slice(0, 800) };

    const details = Array.isArray(root.details) ? root.details : [];
    const failure = details.find((detail) => isRecord(detail) && Array.isArray(detail.errors));
    const requestDetail = details.find((detail) => isRecord(detail) && typeof detail.requestId === "string");
    const failureErrors = isRecord(failure) && Array.isArray(failure.errors) ? failure.errors : [];

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
          return {
            errorCode: error.errorCode,
            message: toStringValue(error.message),
            fieldPath: elements
              .filter(isRecord)
              .map((element) => toStringValue(element.fieldName))
              .filter(Boolean)
              .join(".") || null,
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

const createGoogleAdsContext = async (customerIdInput: unknown): Promise<GoogleAdsClientContext> => {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("Google Ads developer token is not configured");
  }

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
    customerId: normalizeCustomerId(customerIdInput),
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      ? env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "")
      : null,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
    developerToken,
    clientEmail,
    projectId,
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
    uploadCandidateCount: 0;
    sendCandidateCount: 0;
  };
}> => {
  const orders = await readGoogleClickIdHealthOrdersForWindow(window);
  const ledger = buildGoogleClickIdLedgerIndex();
  const intents = buildGoogleClickIdIntentIndex();
  const diagnostics = orders.map((order): GoogleAdsClickIdHealthOrderDiagnostic => {
    const orderNumber = toStringValue(order.orderNumber);
    const channelOrderNo = toStringValue(order.channelOrderNo);
    const keys = [orderNumber, channelOrderNo].filter(Boolean);
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
    const blockReasons = [
      "read_only_phase",
      "approval_required",
      "google_ads_conversion_upload_not_run",
    ];
    if (!evidence.hasAny) blockReasons.push("missing_google_click_id");
    if (!evidence.hasEvidence) blockReasons.push("missing_attribution_vm_evidence");
    if (toNumber(order.orderAmount) <= 0) blockReasons.push("invalid_order_amount");
    if (order.hasCancel) blockReasons.push("order_has_cancel");
    if (order.hasReturn) blockReasons.push("order_has_return");

    return {
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
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
      blockReasons,
    };
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
      uploadCandidateCount: 0,
      sendCandidateCount: 0,
    },
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
  const amountType = toStringValue(row.amountMatchType);
  const amountOk = GOOGLE_NPAY_BRIDGE_GRADE_A_AMOUNT_TYPES.has(amountType);
  const timeOk = timeGap <= 2;
  const scoreOk = score >= 70;
  const scoreGapOk = scoreGap !== null && scoreGap >= 15;
  const hasClickId = Boolean(row.clickIds.hasGoogleClickId);

  if (row.strongGrade === "A") {
    return {
      gradePlainReason:
        "A급은 결제 시각이 매우 가깝고, 주문 생성 시각과 금액도 맞아서 내부 보고서에서 같은 주문으로 봐도 되는 강한 후보입니다. 그래도 Google click id가 없으면 Google Ads 전송 후보는 아닙니다.",
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
        `B급입니다. 주문 생성 시각과 금액은 맞지만 NPay 클릭 후 결제완료까지 ${timeGap}분이 걸렸습니다. A급 기준은 2분 이내라, 중간에 다른 행동이 끼었을 가능성을 보수적으로 남깁니다.`,
      gradeAUpgradeDecision: "blocked_time_gap",
      gradeAUpgradePlain: hasClickId
        ? "Google click id는 있지만 시간 간격이 길어 자동 A로 올리지 않습니다. 이 1건은 수동 검토 후보이지 Google Ads 자동 전송 후보가 아닙니다."
        : "시간 간격이 A 기준을 넘고 Google click id도 없어 A 승격 대상이 아닙니다.",
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
    actualConfirmedNpayOrders: 0,
    internalBridgeStrongCandidates: 0,
    internalBridgeExactCandidates: 0,
    internalBridgeExactWithGoogleClickId: 0,
    bridgeCandidatesWithGoogleClickId: 0,
    gradeA: 0,
    gradeB: 0,
    gradeBWithGoogleClickId: 0,
    gradeBBlockedByTimeGap: 0,
    gradeBBlockedByAmount: 0,
    gradeBBlockedByMissingGoogleClickId: 0,
    gradeBPromotableToGradeANow: 0,
    ambiguous: 0,
    purchaseWithoutIntent: 0,
    googleAdsSendCandidates: 0,
    vmCloudWrite: 0,
    operationalDbWrite: 0,
  },
  rows: [],
  campaignSummary: [],
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
    const gradeBRows = candidates.filter((row) => row.strongGrade === "B");
    const gradeBReviewRows = gradeBRows.map((row) => ({
      row,
      review: buildNpayBridgeGradeReview(row),
    }));
    const enrichedCandidates = candidates.map((row) => ({
      row,
      campaignEvidence: resolveNpayBridgeCampaignEvidence(row),
      gradeReview: buildNpayBridgeGradeReview(row),
    }));

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
        actualConfirmedNpayOrders: report.summary.confirmedNpayOrderCount,
        internalBridgeStrongCandidates: report.summary.strongMatch,
        internalBridgeExactCandidates: exactCandidates.length,
        internalBridgeExactWithGoogleClickId: exactWithGoogleClickId.length,
        bridgeCandidatesWithGoogleClickId: withGoogleClickId.length,
        gradeA: candidates.filter((row) => row.strongGrade === "A").length,
        gradeB: candidates.filter((row) => row.strongGrade === "B").length,
        gradeBWithGoogleClickId: gradeBRows.filter((row) => row.clickIds.hasGoogleClickId).length,
        gradeBBlockedByTimeGap: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_time_gap").length,
        gradeBBlockedByAmount: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_amount_mismatch").length,
        gradeBBlockedByMissingGoogleClickId: gradeBReviewRows.filter((item) => item.review.gradeAUpgradeDecision === "blocked_missing_click_id").length,
        gradeBPromotableToGradeANow: 0,
        ambiguous: report.summary.ambiguous,
        purchaseWithoutIntent: report.summary.purchaseWithoutIntent,
        googleAdsSendCandidates: 0,
        vmCloudWrite: 0,
        operationalDbWrite: 0,
      },
      rows: enrichedCandidates
        .slice()
        .sort((a, b) =>
          Number(b.row.clickIds.hasGoogleClickId) - Number(a.row.clickIds.hasGoogleClickId)
          || (b.row.strongGrade === "A" ? 1 : 0) - (a.row.strongGrade === "A" ? 1 : 0)
          || Date.parse(b.row.paidAt) - Date.parse(a.row.paidAt),
        )
        .slice(0, 12)
        .map(({ row, campaignEvidence, gradeReview }) => ({
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
          hasGoogleClickId: row.clickIds.hasGoogleClickId,
          googleClickIdTypes: row.clickIds.googleClickIdTypes,
          gadCampaignId: campaignEvidence.campaignId || null,
          campaignIdEvidenceSource: campaignEvidence.source,
          utmCampaign: row.utm.campaign,
          recommendedAction: row.recommendedAction,
          blockReasons: row.blockReasons,
          gradePlainReason: gradeReview.gradePlainReason,
          gradeAUpgradeDecision: gradeReview.gradeAUpgradeDecision,
          gradeAUpgradePlain: gradeReview.gradeAUpgradePlain,
          internalBridgeDecision: row.strongGrade === "A"
            ? "strong_bridge_candidate"
            : "manual_review_candidate",
          googleAdsSendDecision: "blocked_no_send",
        })),
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

    return {
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
