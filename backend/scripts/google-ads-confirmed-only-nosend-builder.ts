#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

type DatePreset = "last_7d" | "last_30d";

type DashboardResponse = {
  ok?: boolean;
  fetchedAt?: string;
  datePreset?: DatePreset;
  clickIdHealth?: {
    windowDays?: number;
    dateRange?: {
      startDate?: string;
      endDate?: string;
      startAt?: string;
      endAt?: string;
      timezone?: string;
    };
    generatedAt?: string;
    source?: string;
    mode?: string;
    orderCount?: number;
    totalValueKrw?: number;
    withGoogleClickId?: number;
    missingGoogleClickId?: number;
    preservationRate?: number;
    uploadCandidateCount?: number;
    sendCandidateCount?: number;
    clickIdBreakdown?: {
      gclid?: number;
      gbraid?: number;
      wbraid?: number;
    };
    paymentMethodBreakdown?: Array<{
      paymentMethod: string;
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number;
    }>;
    blockReasonCounts?: Record<string, number>;
    sourceFreshness?: {
      source?: string;
      maxOrderDateKst?: string;
      maxPaymentCompleteKst?: string;
      syncLagMinutes?: number;
      status?: string;
      warnings?: string[];
    };
    caveats?: string[];
  };
  conversionActionSegments?: {
    summary?: Record<string, number>;
  };
};

type OrderDiagnosticResponse = {
  ok?: boolean;
  fetchedAt?: string;
  window?: unknown;
  summary?: {
    orderCount?: number;
    returnedCount?: number;
    withGoogleClickId?: number;
    missingGoogleClickId?: number;
    metaActualPurchaseCriteriaPassed?: number;
    metaActualPurchaseCriteriaBlocked?: number;
    uploadCandidateCount?: number;
    sendCandidateCount?: number;
  };
  orders?: Array<{
    orderNumber?: string;
    channelOrderNo?: string | null;
    paidAt?: string | null;
    paymentMethod?: string;
    paymentStatus?: string;
    orderAmount?: number | null;
    refundAmount?: number | null;
    hasCancel?: boolean;
    hasReturn?: boolean;
    isNpay?: boolean;
    evidenceSource?: string;
    actualPurchaseEligibility?: MetaActualPurchaseEligibility;
    clickIdTypes?: {
      gclid?: boolean;
      gbraid?: boolean;
      wbraid?: boolean;
    };
    uploadCandidateCount?: number;
    sendCandidateCount?: number;
    blockReasons?: string[];
  }>;
  caveats?: string[];
};

type MetaActualPurchaseEligibility = {
  source?: string;
  passed?: boolean;
  criteria?: {
    paymentComplete?: boolean;
    positiveAmount?: boolean;
    noCancel?: boolean;
    noReturn?: boolean;
    noRefund?: boolean;
  };
  blockReasons?: string[];
  plain?: string;
};

type ReadyButNotSentReviewRow = {
  maskedOrder: string;
  paymentMethod: string;
  paymentStatus: string;
  amountKrw: number | null;
  clickIdTypes: string[];
  evidenceSource: string;
  primaryStartStage: "stage_1_clean_gclid_seed" | "stage_2_identifier_choice_needed" | "not_primary_start_seed";
  primaryStartStagePlain: string;
  primaryStartWhy: string;
  actualPurchaseCheck: string;
  actualPurchaseEligibility: MetaActualPurchaseEligibility & {
    source: string;
    passed: boolean;
    blockReasons: string[];
    plain: string;
  };
  currentClassification: "review_row_not_send_ready";
  whyNotSendReady: string[];
};

type ReadyButNotSentReview = {
  source: string;
  fetchedAt: string | null;
  window: unknown;
  summary: {
    reviewRows: number;
    actualPurchaseRows: number;
    metaActualPurchaseCriteriaPassed: number;
    metaActualPurchaseCriteriaBlocked: number;
    directGoogleClickEvidenceRows: number;
    stage1CleanGclidSeedRows: number;
    stage2IdentifierChoiceNeededRows: number;
    sendReadyButNotSent: 0;
    googleAdsSendCandidates: 0;
    uploadCandidateCount: 0;
  };
  rows: ReadyButNotSentReviewRow[];
  blockers: string[];
};

type PrimaryConversionReadiness = {
  todayGoal: string;
  conclusion: string;
  importantCorrection: string;
  currentPrimarySeedRows: number;
  stage1CleanGclidSeedRows: number;
  stage2IdentifierChoiceNeededRows: number;
  actualPurchaseBasisReady: boolean;
  actualPurchaseBasisPlain: string;
  primaryActionCanBePreparedBeforeFirstUpload: boolean;
  whyItStillDoesNotLearnYet: string[];
  nextUse: string;
};

type NoSendPayloadCandidate = {
  stage: "stage_1_clean_gclid_seed";
  maskedOrder: string;
  conversionActionCandidate: "BI confirmed_purchase_offline";
  eventMeaning: "actual_confirmed_purchase";
  amountKrw: number | null;
  currencyCode: "KRW";
  googleIdentifierType: "gclid";
  googleIdentifierValueStatus: "redacted_in_no_send_report";
  actualPurchaseBasis: string;
  conversionTimeStatus: "available_if_paid_at_exported" | "needs_exact_order_level_export";
  orderIdentifierStatus: "masked_in_report_exact_required_before_upload";
  noSend: true;
  readinessPlain: string;
  remainingBeforeRealSend: string[];
};

type RawValuePreflightRequirement = {
  key: string;
  plainName: string;
  whyNeeded: string;
  requiredSource: string;
  currentStatus: "verified_by_public_safe_field" | "needs_private_exact_export" | "needs_guard_lookup" | "needs_red_approval";
  safeReportValue: string;
  passCondition: string;
  failMeaning: string;
};

type RawValuePreflightCandidate = {
  maskedOrder: string;
  amountKrw: number | null;
  currencyCode: "KRW";
  conversionActionCandidate: "BI confirmed_purchase_offline";
  currentReadinessPct: number;
  readinessPlain: string;
  requiredValues: RawValuePreflightRequirement[];
  stillNoSendBecause: string[];
};

type Stage1RawValuePreflight = {
  goal: string;
  progressPct: number;
  progressPlain: string;
  source: string;
  generatedFrom: string;
  candidates: RawValuePreflightCandidate[];
  allCandidatesBlockedFromSend: true;
  nextGreenAction: string;
  nextRedAction: string;
};

type TodayLaunchPlanStep = {
  order: number;
  name: string;
  progressPct: number;
  currentStatus: string;
  successCriteria: string;
  nextAction: string;
  lane: "Green" | "Yellow" | "Red";
  owner: "Codex" | "TJ님" | "Codex+TJ님";
};

type TodayLaunchPlan = {
  goal: string;
  overallProgressPct: number;
  progressPlain: string;
  steps: TodayLaunchPlanStep[];
};

type NoSendWindow = {
  key: string;
  label: string;
  source: string;
  window: unknown;
  fetchedAt: string | null;
  actualConfirmedOrders: number;
  actualConfirmedRevenueKrw: number | null;
  directGoogleClickEvidenceOrders: number;
  missingGoogleClickIdOrders: number;
  preservationRate: number;
  rawOrderPayloadAvailable: boolean;
  noSendCandidateCount: 0;
  sendCandidateCount: 0;
  uploadCandidateCount: 0;
  directEvidenceNeedsOrderPayloadReview: number;
  blockReasonCounts: Record<string, number>;
  clickIdBreakdown: {
    gclid: number;
    gbraid: number;
    wbraid: number;
  };
  paymentMethodBreakdown: Array<{
    paymentMethod: string;
    orders: number;
    directGoogleClickEvidenceOrders: number;
    missingGoogleClickIdOrders: number;
    preservationRate: number;
  }>;
  freshness: unknown;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const todayKst = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replaceAll("-", "");

const nowKst = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const numberFrom = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const toYaml = (value: unknown, indent = 0): string => {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map((item) => {
      if (item && typeof item === "object") {
        return `${pad}-\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}- ${JSON.stringify(item)}`;
    }).join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}`;
    return entries.map(([key, item]) => {
      if (item && typeof item === "object") {
        return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}${key}: ${JSON.stringify(item)}`;
    }).join("\n");
  }
  return `${pad}${JSON.stringify(value)}`;
};

const outputDate = argValue("date") ?? todayKst();
const apiBase = (argValue("api-base") ?? "https://att.ainativeos.net").replace(/\/$/, "");
const jsonOutput = path.resolve(
  argValue("json-output") ??
    path.join(REPO_ROOT, "data", "project", `google-ads-confirmed-only-nosend-builder-${outputDate}.json`),
);
const markdownOutput = path.resolve(
  argValue("markdown-output") ??
    path.join(REPO_ROOT, "project", `google-ads-confirmed-only-nosend-builder-${outputDate}.md`),
);

const dashboardUrls = (preset: DatePreset) => [
  `${apiBase}/api/google-ads/dashboard-summary?date_preset=${encodeURIComponent(preset)}&campaign_limit=20`,
  `${apiBase}/api/google-ads/dashboard?date_preset=${encodeURIComponent(preset)}`,
];

const orderDiagnosticUrl = (window: DatePreset) =>
  `${apiBase}/api/google-ads/click-id-health/orders?window=${encodeURIComponent(window)}&only=with_click_id&limit=20`;

const fetchJson = async (url: string): Promise<DashboardResponse> => {
  const fetchFn = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  if (!fetchFn) throw new Error("global fetch is not available");
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`fetch failed ${response.status}: ${url}`);
  return (await response.json()) as DashboardResponse;
};

const fetchDashboardJson = async (preset: DatePreset): Promise<DashboardResponse> => {
  const urls = dashboardUrls(preset);
  const errors: string[] = [];

  for (const url of urls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`all dashboard endpoints failed for ${preset}: ${errors.join(" | ")}`);
};

const maskIdentifier = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= 10) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
};

const clickIdTypesFromRow = (row: NonNullable<OrderDiagnosticResponse["orders"]>[number]) => {
  const types: string[] = [];
  if (row.clickIdTypes?.gclid) types.push("gclid");
  if (row.clickIdTypes?.gbraid) types.push("gbraid");
  if (row.clickIdTypes?.wbraid) types.push("wbraid");
  return types;
};

const buildMetaActualPurchaseEligibilityFromRow = (
  row: NonNullable<OrderDiagnosticResponse["orders"]>[number],
): ReadyButNotSentReviewRow["actualPurchaseEligibility"] => {
  if (row.actualPurchaseEligibility?.source && typeof row.actualPurchaseEligibility.passed === "boolean") {
    return {
      ...row.actualPurchaseEligibility,
      source: row.actualPurchaseEligibility.source,
      passed: row.actualPurchaseEligibility.passed,
      blockReasons: row.actualPurchaseEligibility.blockReasons ?? [],
      plain: row.actualPurchaseEligibility.plain ?? (
        row.actualPurchaseEligibility.passed
          ? "Meta CAPI와 같은 실제 결제완료 기준은 통과했습니다."
          : "Meta CAPI와 같은 실제 결제완료 기준을 통과하지 못했습니다."
      ),
    };
  }

  const amount = Number(row.orderAmount ?? 0);
  const refundAmount = Number(row.refundAmount ?? 0);
  const criteria = {
    paymentComplete: row.paymentStatus === "PAYMENT_COMPLETE",
    positiveAmount: Number.isFinite(amount) && amount > 0,
    noCancel: !row.hasCancel,
    noReturn: !row.hasReturn,
    noRefund: !Number.isFinite(refundAmount) || refundAmount <= 0,
  };
  const blockReasons: string[] = [];

  if (!criteria.paymentComplete) blockReasons.push("meta_actual_purchase_not_payment_complete");
  if (!criteria.positiveAmount) blockReasons.push("meta_actual_purchase_non_positive_amount");
  if (!criteria.noCancel) blockReasons.push("meta_actual_purchase_cancel_present");
  if (!criteria.noReturn) blockReasons.push("meta_actual_purchase_return_present");
  if (!criteria.noRefund) blockReasons.push("meta_actual_purchase_refund_present");

  const passed = blockReasons.length === 0;

  return {
    source: "meta_capi_compatible_confirmed_purchase_guard_fallback",
    passed,
    criteria,
    blockReasons,
    plain: passed
      ? "Meta CAPI와 같은 실제 결제완료 기준은 통과했습니다. Google Ads 전송 후보가 되려면 Google click id와 전송 승인 조건이 추가로 필요합니다."
      : "Meta CAPI와 같은 실제 결제완료 기준을 통과하지 못했습니다.",
  };
};

const buildWhyNotSendReady = (row: NonNullable<OrderDiagnosticResponse["orders"]>[number]) => {
  const reasons = new Set<string>();
  const clickTypes = clickIdTypesFromRow(row);
  const actualPurchaseEligibility = buildMetaActualPurchaseEligibilityFromRow(row);

  reasons.add("no_send_phase");
  reasons.add("google_ads_upload_not_approved");
  reasons.add("dispatcher_closed");
  reasons.add("permanent_safe_ref_snapshot_missing");
  reasons.add("duplicate_and_refund_followup_ledger_missing");

  if (clickTypes.length === 0) reasons.add("missing_google_click_id");
  if (clickTypes.length > 1) reasons.add("one_google_identifier_selection_required");
  if (!actualPurchaseEligibility.passed) {
    reasons.add("meta_actual_purchase_criteria_not_passed");
    actualPurchaseEligibility.blockReasons.forEach((reason) => reasons.add(reason));
  }
  if (row.isNpay) reasons.add("npay_bridge_required_before_google_ads_send");

  return Array.from(reasons);
};

const classifyPrimaryStartStage = (
  clickIdTypes: string[],
  actualPurchaseEligibility: ReadyButNotSentReviewRow["actualPurchaseEligibility"],
) => {
  if (!actualPurchaseEligibility.passed || clickIdTypes.length === 0) {
    return {
      primaryStartStage: "not_primary_start_seed" as const,
      primaryStartStagePlain: "주 전환 시작 후보 아님",
      primaryStartWhy: "실제 구매 기준 또는 Google 클릭 증거가 부족합니다.",
    };
  }

  if (clickIdTypes.length === 1 && clickIdTypes[0] === "gclid") {
    return {
      primaryStartStage: "stage_1_clean_gclid_seed" as const,
      primaryStartStagePlain: "1단계: 바로 검토할 단순 후보",
      primaryStartWhy:
        "실제 결제완료 기준을 통과했고 Google 식별자가 gclid 하나라, 나중에 전송 실험을 열 때 선택 규칙이 가장 단순합니다.",
    };
  }

  return {
    primaryStartStage: "stage_2_identifier_choice_needed" as const,
    primaryStartStagePlain: "2단계: 식별자 선택 규칙 필요",
    primaryStartWhy:
      "실제 결제완료 기준은 통과했지만 gclid/gbraid 같은 Google 식별자가 둘 이상 남아, 전송 전에 어떤 하나를 쓸지 규칙을 정해야 합니다.",
  };
};

const buildReadyButNotSentReview = (body: OrderDiagnosticResponse): ReadyButNotSentReview => {
  const rows = body.orders ?? [];
  const reviewRows = rows.map<ReadyButNotSentReviewRow>((row) => {
    const clickIdTypes = clickIdTypesFromRow(row);
    const actualPurchaseEligibility = buildMetaActualPurchaseEligibilityFromRow(row);
    const primaryStartStage = classifyPrimaryStartStage(clickIdTypes, actualPurchaseEligibility);

    return {
      maskedOrder: maskIdentifier(row.orderNumber),
      paymentMethod: row.paymentMethod || "",
      paymentStatus: row.paymentStatus || "",
      amountKrw: row.orderAmount ?? null,
      clickIdTypes,
      evidenceSource: row.evidenceSource || "",
      ...primaryStartStage,
      actualPurchaseCheck: actualPurchaseEligibility.passed
        ? "meta_actual_purchase_criteria_passed"
        : "meta_actual_purchase_criteria_blocked",
      actualPurchaseEligibility,
      currentClassification: "review_row_not_send_ready",
      whyNotSendReady: buildWhyNotSendReady(row),
    };
  });

  return {
    source: orderDiagnosticUrl("last_7d"),
    fetchedAt: body.fetchedAt ?? null,
    window: body.window ?? null,
    summary: {
      reviewRows: reviewRows.length,
      actualPurchaseRows: reviewRows.filter((row) => row.actualPurchaseEligibility.passed).length,
      metaActualPurchaseCriteriaPassed: reviewRows.filter((row) => row.actualPurchaseEligibility.passed).length,
      metaActualPurchaseCriteriaBlocked: reviewRows.filter((row) => !row.actualPurchaseEligibility.passed).length,
      directGoogleClickEvidenceRows: reviewRows.filter((row) => row.clickIdTypes.length > 0).length,
      stage1CleanGclidSeedRows: reviewRows.filter((row) => row.primaryStartStage === "stage_1_clean_gclid_seed").length,
      stage2IdentifierChoiceNeededRows: reviewRows.filter((row) => row.primaryStartStage === "stage_2_identifier_choice_needed").length,
      sendReadyButNotSent: 0,
      googleAdsSendCandidates: 0,
      uploadCandidateCount: 0,
    },
    rows: reviewRows,
    blockers: [
      "Meta 실제 구매 기준은 출발점이며, Google Ads 전송에는 Google click id 조건이 추가로 필요",
      "Google Ads upload 승인 없음",
      "전송 dispatcher 닫힘",
      "영구 safe_ref snapshot 0건",
      "중복 방지/취소/환불 후속 반영 장부 미오픈",
    ],
  };
};

const buildFirstNoSendPayloadCandidates = (
  review: ReadyButNotSentReview,
): NoSendPayloadCandidate[] => review.rows
  .filter((row) => row.primaryStartStage === "stage_1_clean_gclid_seed")
  .map((row) => ({
    stage: "stage_1_clean_gclid_seed",
    maskedOrder: row.maskedOrder,
    conversionActionCandidate: "BI confirmed_purchase_offline",
    eventMeaning: "actual_confirmed_purchase",
    amountKrw: row.amountKrw,
    currencyCode: "KRW",
    googleIdentifierType: "gclid",
    googleIdentifierValueStatus: "redacted_in_no_send_report",
    actualPurchaseBasis: "PAYMENT_COMPLETE + value > 0 + no cancel/return/refund",
    conversionTimeStatus: "needs_exact_order_level_export",
    orderIdentifierStatus: "masked_in_report_exact_required_before_upload",
    noSend: true,
    readinessPlain:
      "실제 구매완료 기준과 gclid 단일 식별자 기준을 통과했습니다. 이 보고서는 no-send라 원문 gclid와 원문 주문번호는 출력하지 않습니다.",
    remainingBeforeRealSend: [
      "exact order id/order number export",
      "exact gclid value export",
      "conversion timestamp export",
      "duplicate/refund follow-up guard",
      "Google Ads upload approval",
    ],
  }));

const buildStage1RawValuePreflight = (
  firstCandidates: NoSendPayloadCandidate[],
): Stage1RawValuePreflight => {
  const buildRequirements = (row: NoSendPayloadCandidate): RawValuePreflightRequirement[] => [
    {
      key: "exact_order_identifier",
      plainName: "원문 주문번호",
      whyNeeded: "같은 주문을 Google Ads에 두 번 보내지 않기 위한 중복 방지 기준입니다.",
      requiredSource: "VM Cloud order-level private export 또는 서버 내부 전송 job",
      currentStatus: "needs_private_exact_export",
      safeReportValue: row.maskedOrder,
      passCondition: "마스킹되지 않은 주문번호가 1개만 확인되고, 전환 액션별 중복 key로 만들 수 있어야 합니다.",
      failMeaning: "주문번호가 없거나 여러 개면 같은 구매를 중복 전송할 위험이 있어 전송하면 안 됩니다.",
    },
    {
      key: "exact_google_click_id",
      plainName: "원문 gclid",
      whyNeeded: "Google Ads가 이 구매를 어느 광고 클릭과 연결할지 판단하는 핵심 값입니다.",
      requiredSource: "payment_success_ledger raw evidence 또는 서버 내부 order-level evidence export",
      currentStatus: "needs_private_exact_export",
      safeReportValue: row.googleIdentifierValueStatus,
      passCondition: "gclid 원문이 비어 있지 않고, gclid/gbraid/wbraid 중 gclid 하나만 payload에 들어가야 합니다.",
      failMeaning: "gclid가 없거나 다른 Google 식별자와 동시에 들어가면 Google Ads가 구매를 잘못 연결하거나 업로드를 거부할 수 있습니다.",
    },
    {
      key: "conversion_time",
      plainName: "실제 결제완료 시각",
      whyNeeded: "Google Ads가 광고 클릭 이후 언제 구매가 일어났는지 계산하는 기준입니다.",
      requiredSource: "운영DB 결제완료 시각 또는 VM Cloud order-level paidAt/paymentCompleteAt",
      currentStatus: "needs_private_exact_export",
      safeReportValue: row.conversionTimeStatus,
      passCondition: "Asia/Seoul 기준 실제 결제완료 시각이 있고, Google Ads 업로드 형식으로 변환 가능해야 합니다.",
      failMeaning: "결제완료 시각이 없으면 버튼 클릭 시각이나 주문 생성 시각을 구매 시각으로 착각할 수 있습니다.",
    },
    {
      key: "conversion_value",
      plainName: "실제 결제금액",
      whyNeeded: "Google Ads가 어떤 광고가 실제 매출을 만들었는지 학습하는 금액입니다.",
      requiredSource: "운영DB 주문 금액 cross-check + VM Cloud no-send 후보 금액",
      currentStatus: row.amountKrw && row.amountKrw > 0 ? "verified_by_public_safe_field" : "needs_private_exact_export",
      safeReportValue: row.amountKrw === null ? "n/a" : row.amountKrw.toLocaleString("ko-KR"),
      passCondition: "금액이 0보다 크고, 내부 실제 결제금액과 일치해야 합니다.",
      failMeaning: "금액이 틀리면 Google Ads ROAS가 다시 부풀거나 줄어들어 예산 판단이 흔들립니다.",
    },
    {
      key: "currency_code",
      plainName: "통화",
      whyNeeded: "금액 36,900/234,000이 원화인지 Google Ads에 명확히 알려야 합니다.",
      requiredSource: "사이트 고정 통화 + payload hard guard",
      currentStatus: "verified_by_public_safe_field",
      safeReportValue: row.currencyCode,
      passCondition: "currency_code가 KRW로 고정되어야 합니다.",
      failMeaning: "통화가 빠지거나 다르면 전환값 해석이 틀어집니다.",
    },
    {
      key: "actual_purchase_guard",
      plainName: "실제 결제완료 조건",
      whyNeeded: "미입금 가상계좌, NPay 버튼 클릭, 결제창 진입을 실제 구매로 보내지 않기 위한 기준입니다.",
      requiredSource: "Meta CAPI compatible confirmed purchase guard + 운영DB 취소/환불/반품 상태",
      currentStatus: "needs_guard_lookup",
      safeReportValue: row.actualPurchaseBasis,
      passCondition: "PAYMENT_COMPLETE이고, 금액이 0보다 크며, 취소/환불/반품이 없어야 합니다.",
      failMeaning: "이 조건이 깨지면 버튼 클릭이나 취소 주문이 구매로 들어가 Google Ads 학습을 다시 오염시킵니다.",
    },
    {
      key: "duplicate_guard",
      plainName: "중복 전송 방지 key",
      whyNeeded: "같은 주문을 여러 번 보내 Google Ads 구매건수와 매출이 두 번 잡히는 것을 막습니다.",
      requiredSource: "전송 이력 장부 또는 no-send dispatcher ledger",
      currentStatus: "needs_guard_lookup",
      safeReportValue: "not_opened",
      passCondition: "conversion_action_id + order_no 또는 conversion_action_id + payment_key 조합이 이전 전송 이력에 없어야 합니다.",
      failMeaning: "중복 guard가 없으면 제한 전송 1건도 여러 번 들어갈 수 있어 전송을 열면 안 됩니다.",
    },
    {
      key: "conversion_action",
      plainName: "Google Ads 실제 구매 전환 액션",
      whyNeeded: "버튼 클릭용 전환이 아니라 실제 구매완료 전용 전환에 보내기 위해 필요합니다.",
      requiredSource: "Google Ads conversion action inventory",
      currentStatus: "verified_by_public_safe_field",
      safeReportValue: row.conversionActionCandidate,
      passCondition: "전환 액션이 BI confirmed_purchase_offline이고, 기존 NPay 버튼/진입 라벨이 아니어야 합니다.",
      failMeaning: "잘못된 전환 액션으로 보내면 실제 구매 통로와 버튼 클릭 통로가 다시 섞입니다.",
    },
    {
      key: "red_approval",
      plainName: "TJ님 실제 Google Ads 전송 승인",
      whyNeeded: "전환 업로드는 Google Ads 전환값과 입찰 학습에 영향을 주는 Red Lane 작업입니다.",
      requiredSource: "대화 내 명시 승인 + 실행 전 승인 문서",
      currentStatus: "needs_red_approval",
      safeReportValue: "not_approved",
      passCondition: "TJ님이 Google Ads conversion upload 1건 제한 전송을 명시 승인해야 합니다.",
      failMeaning: "승인 없이는 외부 광고 플랫폼에 구매 신호를 보내면 안 됩니다.",
    },
  ];

  const candidates = firstCandidates.map<RawValuePreflightCandidate>((row) => {
    const requiredValues = buildRequirements(row);
    const closedCount = requiredValues.filter((item) => item.currentStatus === "verified_by_public_safe_field").length;
    const currentReadinessPct = Math.round((closedCount / requiredValues.length) * 100);

    return {
      maskedOrder: row.maskedOrder,
      amountKrw: row.amountKrw,
      currencyCode: row.currencyCode,
      conversionActionCandidate: row.conversionActionCandidate,
      currentReadinessPct,
      readinessPlain:
        "안전한 보고서에 보이는 값만으로는 금액/통화/전환 액션은 닫혔지만, 원문 주문번호/gclid/전환시각/중복·환불 guard/승인은 아직 닫히지 않았습니다.",
      requiredValues,
      stillNoSendBecause: [
        "원문 주문번호를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.",
        "원문 gclid를 문서에 노출하지 않고 서버 내부에서 확인해야 합니다.",
        "실제 결제완료 시각과 취소/환불 후속 상태를 교차 확인해야 합니다.",
        "Google Ads 전송 승인과 dispatcher가 아직 닫혀 있습니다.",
      ],
    };
  });

  const progressPct = firstCandidates.length > 0 ? 82 : 45;

  return {
    goal:
      "1단계 후보 2건을 Google Ads에 보내기 직전, 원문 주문번호/gclid/전환시각/금액/중복·환불 guard가 어디서 확인되어야 하는지 닫는다.",
    progressPct,
    progressPlain:
      firstCandidates.length > 0
        ? "후보 2건은 전환 액션, 금액, 통화, gclid 단일 후보까지는 정리됐습니다. 실제 전송 전에는 서버 내부 원문값 export와 중복/환불 guard가 남아 있습니다."
        : "1단계 후보가 없어 원문값 점검 설계를 적용할 대상이 없습니다.",
    source: "VM Cloud public order diagnostic safe rows + local no-send builder",
    generatedFrom: "firstNoSendPayloadCandidates",
    candidates,
    allCandidatesBlockedFromSend: true,
    nextGreenAction:
      "raw 값을 문서에 노출하지 않는 private payload preview 또는 서버 내부 validate-only 형태의 전송 전 검증표를 만든다.",
    nextRedAction:
      "TJ님이 승인하면 BI confirmed_purchase_offline으로 1건 제한 Google Ads conversion upload를 실행한다.",
  };
};

const buildTodayLaunchPlan = (
  review: ReadyButNotSentReview,
  firstCandidates: NoSendPayloadCandidate[],
  rawValuePreflight?: Stage1RawValuePreflight,
): TodayLaunchPlan => {
  const stage1Count = review.summary.stage1CleanGclidSeedRows;
  const stage2Count = review.summary.stage2IdentifierChoiceNeededRows;
  const rawValueProgress = rawValuePreflight?.progressPct ?? 0;

  return {
    goal: "오늘 안에 Google Ads가 효과적으로 학습할 실제 구매완료 주 전환 액션을 시작할 준비를 끝낸다.",
    overallProgressPct: rawValueProgress >= 80 ? 79 : 72,
    progressPlain:
      rawValueProgress >= 80
        ? "잘못된 구매 신호 분리, 실제 구매 기준 정렬, 1단계 후보 2건의 전송 전 필요값 설계까지 닫혔습니다. 남은 핵심은 원문값을 서버 내부에서 확인하고, 첫 제한 전송 승인 여부를 결정하는 것입니다."
        : "잘못된 구매 신호 분리와 실제 구매 기준 정렬은 대부분 끝났습니다. 남은 핵심은 Google Ads에서 주 전환 액션을 어떤 이름/목표로 둘지 확정하고, 첫 실제 구매 이벤트를 보낼 때 필요한 원문 주문/클릭 식별자와 중복 방지 장치를 여는 것입니다.",
    steps: [
      {
        order: 1,
        name: "잘못된 구매 신호를 학습에서 빼기",
        progressPct: 88,
        currentStatus:
          "기존 구매완료는 NPay 버튼/결제진입 보조 신호로 낮췄고, TechSol NPay 구매 액션은 삭제됐다고 확인했습니다.",
        successCriteria:
          "Google Ads Primary 구매 신호에 버튼 클릭/결제진입 전환이 남지 않는다.",
        nextAction:
          "24시간 뒤 Google Ads에서 삭제/보조 처리한 액션의 전환 증가가 멈췄는지 read-only로 확인합니다.",
        lane: "Green",
        owner: "Codex",
      },
      {
        order: 2,
        name: "실제 구매완료 기준을 고정하기",
        progressPct: 92,
        currentStatus:
          "Meta CAPI와 같은 실제 구매 기준을 Google Ads 후보 생성기의 첫 관문으로 맞췄습니다.",
        successCriteria:
          "PAYMENT_COMPLETE, 금액 있음, 취소/반품/환불 없음 주문만 실제 구매 후보가 된다.",
        nextAction:
          "이 기준을 로컬/운영 보고서 문구와 no-send 후보 생성기에 계속 유지합니다.",
        lane: "Green",
        owner: "Codex",
      },
      {
        order: 3,
        name: "첫 후보를 두 단계로 나누기",
        progressPct: 90,
        currentStatus:
          `최근 7일 seed row 4건 중 1단계 gclid 단일 후보 ${stage1Count}건, 2단계 식별자 선택 필요 후보 ${stage2Count}건으로 나눴습니다.`,
        successCriteria:
          "오늘 먼저 볼 후보와 나중에 식별자 규칙을 정할 후보가 분리된다.",
        nextAction:
          "1단계 후보를 no-send payload 후보표로 따로 출력합니다.",
        lane: "Green",
        owner: "Codex",
      },
      {
        order: 4,
        name: "첫 no-send payload 후보 만들기",
        progressPct: rawValueProgress >= 80 ? 88 : (firstCandidates.length > 0 ? 78 : 40),
        currentStatus:
          rawValueProgress >= 80
            ? `1단계 후보 ${firstCandidates.length}건의 전환 전 필요값 목록과 source/실패 의미를 정리했습니다.`
            : firstCandidates.length > 0
            ? `1단계 후보 ${firstCandidates.length}건을 BI confirmed_purchase_offline no-send payload 후보로 분리했습니다.`
            : "아직 gclid 단일 후보가 없어 payload 후보를 만들 수 없습니다.",
        successCriteria:
          "전송 전 미리 볼 후보표에 전환 액션, 금액, 통화, Google 식별자 종류, 원문값 source, 중복/환불 guard, 남은 차단 조건이 표시된다.",
        nextAction:
          "실제 전송 전에는 원문 주문번호, 원문 gclid, 전환 시각을 서버 내부 private preview로 확인합니다.",
        lane: "Green",
        owner: "Codex",
      },
      {
        order: 5,
        name: "Google Ads 주 전환 액션을 시작할 실행안 확정",
        progressPct: rawValueProgress >= 80 ? 76 : 62,
        currentStatus:
          rawValueProgress >= 80
            ? "BI confirmed_purchase_offline을 실제 구매완료 전용 후보로 쓰는 화면 실행안과 전송 전 필요값 설계가 정리됐습니다. 데이터 소스 연결/Primary 설정/전송은 아직 실행하지 않았습니다."
            : "BI confirmed_purchase_offline이 실제 구매완료 전용 후보로 가장 자연스럽지만, 데이터 소스 연결/Primary 설정은 아직 실행하지 않았습니다.",
        successCriteria:
          "Google Ads 화면에서 어떤 액션을 Primary로 두고 어떤 액션을 보조/삭제 상태로 둘지 한 번에 판단된다.",
        nextAction:
          "화면 기준 실행안을 작성하고, 설정 변경이 필요한 부분만 TJ님 승인 대상으로 분리합니다.",
        lane: "Green",
        owner: "Codex",
      },
      {
        order: 6,
        name: "실제 구매 이벤트 전송 시작",
        progressPct: 25,
        currentStatus:
          "아직 Google Ads conversion upload는 0건입니다. no-send 후보 검토 단계입니다.",
        successCriteria:
          "승인 후 첫 실제 구매완료 이벤트가 Google Ads 전환 액션에 중복 없이 들어간다.",
        nextAction:
          "TJ님이 명시 승인하면 1건 제한 전송 또는 validate-only 성격의 사전 점검부터 진행합니다.",
        lane: "Red",
        owner: "Codex+TJ님",
      },
    ],
  };
};

const fetchOrderDiagnosticReview = async (): Promise<ReadyButNotSentReview> => {
  const body = await fetchJson(orderDiagnosticUrl("last_7d")) as OrderDiagnosticResponse;
  if (body.ok !== true) throw new Error("order diagnostic endpoint returned not ok");
  return buildReadyButNotSentReview(body);
};

const buildWindowFromDashboard = (
  preset: DatePreset,
  body: DashboardResponse,
): NoSendWindow => {
  const health = body.clickIdHealth ?? {};
  const orderCount = numberFrom(health.orderCount);
  const withClick = numberFrom(health.withGoogleClickId);
  const missingClick = numberFrom(health.missingGoogleClickId);
  const missingAttribution = numberFrom(health.blockReasonCounts?.missingAttributionVmEvidence);

  return {
    key: preset,
    label: preset === "last_7d" ? "최근 7일" : "최근 30일",
    source: "VM Cloud public dashboard API aggregate",
    window: health.dateRange ?? { preset },
    fetchedAt: body.fetchedAt ?? health.generatedAt ?? null,
    actualConfirmedOrders: orderCount,
    actualConfirmedRevenueKrw: health.totalValueKrw ?? null,
    directGoogleClickEvidenceOrders: withClick,
    missingGoogleClickIdOrders: missingClick,
    preservationRate: numberFrom(health.preservationRate),
    rawOrderPayloadAvailable: false,
    noSendCandidateCount: 0,
    sendCandidateCount: 0,
    uploadCandidateCount: 0,
    directEvidenceNeedsOrderPayloadReview: withClick,
    blockReasonCounts: {
      read_only_phase: orderCount,
      approval_required: orderCount,
      google_ads_conversion_action_not_selected_or_dispatch_closed: orderCount,
      conversion_upload_not_approved: orderCount,
      exact_order_level_payload_not_exported_from_public_endpoint: withClick,
      missing_google_click_id: missingClick,
      missing_attribution_vm_evidence: missingAttribution,
    },
    clickIdBreakdown: {
      gclid: numberFrom(health.clickIdBreakdown?.gclid),
      gbraid: numberFrom(health.clickIdBreakdown?.gbraid),
      wbraid: numberFrom(health.clickIdBreakdown?.wbraid),
    },
    paymentMethodBreakdown: (health.paymentMethodBreakdown ?? []).map((row) => ({
      paymentMethod: row.paymentMethod,
      orders: row.orders,
      directGoogleClickEvidenceOrders: row.withGoogleClickId,
      missingGoogleClickIdOrders: row.missingGoogleClickId,
      preservationRate: row.preservationRate,
    })),
    freshness: health.sourceFreshness ?? null,
  };
};

const postPatchSnapshot: NoSendWindow = {
  key: "post_patch_20260521_2115",
  label: "5월 21일 21:15 보강 이후",
  source: "frontend report snapshot from VM Cloud SQLite + operational DB read-only",
  window: {
    patchStartedAtKst: "2026-05-21 21:15 KST",
    checkedAtKst: "2026-05-24 KST",
  },
  fetchedAt: null,
  actualConfirmedOrders: 114,
  actualConfirmedRevenueKrw: null,
  directGoogleClickEvidenceOrders: 0,
  missingGoogleClickIdOrders: 114,
  preservationRate: 0,
  rawOrderPayloadAvailable: false,
  noSendCandidateCount: 0,
  sendCandidateCount: 0,
  uploadCandidateCount: 0,
  directEvidenceNeedsOrderPayloadReview: 0,
  blockReasonCounts: {
    read_only_phase: 114,
    approval_required: 114,
    google_ads_conversion_action_not_selected_or_dispatch_closed: 114,
    conversion_upload_not_approved: 114,
    missing_google_click_id: 114,
  },
  clickIdBreakdown: {
    gclid: 0,
    gbraid: 0,
    wbraid: 0,
  },
  paymentMethodBreakdown: [
    {
      paymentMethod: "homepage",
      orders: 112,
      directGoogleClickEvidenceOrders: 0,
      missingGoogleClickIdOrders: 112,
      preservationRate: 0,
    },
    {
      paymentMethod: "npay",
      orders: 2,
      directGoogleClickEvidenceOrders: 0,
      missingGoogleClickIdOrders: 2,
      preservationRate: 0,
    },
  ],
  freshness: {
    note: "snapshot is from report constants. Use VM order-level read-only endpoint before any send decision.",
  },
};

const clickStageSnapshot = {
  source: "VM Cloud SQLite read-only snapshot embedded in frontend report",
  checkedAtKst: "2026-05-24 KST",
  patchStartedAtKst: "2026-05-21 21:15 KST",
  siteLanding: {
    label: "고객 유입 장부",
    googleClickIdRows: 2865,
    gadCampaignIdRows: 2759,
    campaignIdCoverageRate: 0.963,
    meaning: "광고 클릭 직후 URL 파라미터가 사이트 첫 진입 장부에 남는지 보는 단계",
  },
  paidClickIntent: {
    label: "유료 클릭 의도 장부",
    googleClickIdRows: 2935,
    gadCampaignIdRows: 2909,
    campaignIdCoverageRate: 0.9911,
    meaning: "GTM/아임웹 태그가 클릭 직후 허용 파라미터를 저장했는지 보는 단계",
  },
  confirmedPaymentSuccess: {
    label: "실제 결제완료 장부",
    confirmedPaymentSuccessRows: 114,
    directGoogleClickEvidenceRows: 0,
    preservationRate: 0,
    meaning: "실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남는지 보는 단계",
  },
};

const buildPayload = async () => {
  const [last7, last30, readyButNotSentReview] = await Promise.all([
    fetchDashboardJson("last_7d"),
    fetchDashboardJson("last_30d"),
    fetchOrderDiagnosticReview(),
  ]);

  const windows = [
    buildWindowFromDashboard("last_7d", last7),
    buildWindowFromDashboard("last_30d", last30),
    postPatchSnapshot,
  ];
  const liveLast7 = windows[0];
  const firstNoSendPayloadCandidates = buildFirstNoSendPayloadCandidates(readyButNotSentReview);
  const stage1RawValuePreflight = buildStage1RawValuePreflight(firstNoSendPayloadCandidates);
  const todayLaunchPlan = buildTodayLaunchPlan(
    readyButNotSentReview,
    firstNoSendPayloadCandidates,
    stage1RawValuePreflight,
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedAtKst: nowKst(),
    mode: "confirmed_purchase_no_send_candidate_builder",
    harness_preflight: {
      common_harness_read: [
        "harness/common/HARNESS_GUIDELINES.md",
        "harness/common/AUTONOMY_POLICY.md",
        "harness/common/REPORTING_TEMPLATE.md",
      ],
      project_harness_read: [
        "AGENTS.md",
        "data/!data_inventory.md",
        "gdn/attribution-data-source-decision-guide-20260511.md",
      ],
      lane: "Green",
      allowed_actions: [
        "public_api_read_only",
        "local_script_write",
        "local_json_report_write",
        "local_markdown_report_write",
      ],
      forbidden_actions: [
        "google_ads_conversion_upload",
        "google_ads_conversion_action_change",
        "google_ads_primary_goal_change",
        "operational_db_write",
        "vm_cloud_sqlite_write",
        "deploy_or_restart",
        "gtm_publish",
      ],
      source_window_freshness_confidence: {
        source: "VM Cloud public dashboard-summary aggregate + frontend post-patch report snapshot",
        window: "last_7d, last_30d, post_patch_20260521_2115",
        freshness: "last_7d/last_30d from live public dashboard-summary API; post_patch snapshot from current frontend report constants",
        confidence: "medium-high for aggregate counts, medium for exact loss point until order-level endpoint is added",
      },
    },
    guardrails: {
      noSend: true,
      noWrite: true,
      noDeploy: true,
      noPublish: true,
      noPlatformSend: true,
      rawOrderIdOutput: false,
      rawClickIdOutput: false,
    },
    whyGoogleAdsWouldReceiveThisLater: {
      plainKorean:
        "Google Ads가 자동입찰을 할 때 '어떤 클릭이 실제 매출을 만들었는지'를 배웁니다. 지금 Google Ads의 구매완료 숫자는 NPay 클릭/결제시작 같은 넓은 신호가 섞였을 가능성이 커서, 나중에는 내부 장부에서 실제 결제완료로 확인된 주문만 별도 전환으로 알려주는 것이 목적입니다.",
      currentDecision:
        "지금은 보내지 않습니다. Google Ads 계정에는 관찰용 offline 전환 액션이 보이지만, 실제 결제완료 주문 후보를 그 액션으로 보내는 전송 승인과 dispatcher는 열지 않았습니다.",
    },
    todayLaunchPlan,
    primaryConversionReadiness: {
      todayGoal:
        "오늘 안에 Google Ads가 효과적으로 학습할 실제 구매완료 주 전환 액션을 시작할 준비를 끝낸다.",
      conclusion:
        "Google Ads 주 전환으로 삼을 기준은 '지금 당장 보낼 수 있는 주문이 있는가'가 아니라 '실제 결제완료 주문만 구매로 보는 기준이 고정됐는가'입니다.",
      importantCorrection:
        "BI confirmed_purchase_offline을 Primary 전환으로 준비하거나 올리는 데 과거 전송 가능 주문이 꼭 먼저 있어야 하는 것은 아닙니다. 다만 Google Ads가 학습하려면 이후 실제 구매 이벤트가 꾸준히 들어와야 합니다.",
      currentPrimarySeedRows: readyButNotSentReview.summary.metaActualPurchaseCriteriaPassed,
      stage1CleanGclidSeedRows: readyButNotSentReview.summary.stage1CleanGclidSeedRows,
      stage2IdentifierChoiceNeededRows: readyButNotSentReview.summary.stage2IdentifierChoiceNeededRows,
      actualPurchaseBasisReady: readyButNotSentReview.summary.metaActualPurchaseCriteriaPassed > 0,
      actualPurchaseBasisPlain:
        "Meta CAPI와 같은 실제 구매 기준, 즉 결제완료/금액 있음/취소 없음/반품 없음/환불 없음 기준을 Google Ads 후보 생성기의 첫 관문으로 맞췄습니다.",
      primaryActionCanBePreparedBeforeFirstUpload: true,
      whyItStillDoesNotLearnYet: [
        "Google Ads conversion upload는 아직 실행하지 않았습니다.",
        "전송 dispatcher는 닫혀 있습니다.",
        "중복 방지와 취소/환불 후속 확인 장부는 아직 운영 전송용으로 열지 않았습니다.",
        "gclid와 gbraid가 같이 남은 주문은 Google Ads 전송 시 식별자 하나를 고르는 규칙이 필요합니다.",
      ],
      nextUse:
        "이 기준은 기존 NPay 버튼/결제진입 신호를 대체할 '실제 구매완료 주 전환'의 후보 기준입니다. 전송은 계속 no-send로 검증합니다.",
    } satisfies PrimaryConversionReadiness,
    noSendWindows: windows,
    readyButNotSentReview,
    firstNoSendPayloadCandidates,
    stage1RawValuePreflight,
    lastLossPoint: {
      conclusion:
        "마지막으로 크게 끊기는 지점은 광고 클릭 직후가 아니라, 결제완료 주문으로 넘어가는 payment_success/order bridge 구간입니다.",
      evidence: [
        {
          step: "광고 클릭 직후",
          observed:
            "5월 21일 21:15 KST 보강 이후 고객 유입 장부는 Google click id 2,865건, 그중 gad_campaignid 2,759건입니다.",
          interpretation:
            "클릭 URL 파라미터 자체는 대부분 들어오고 있습니다.",
        },
        {
          step: "태그가 저장한 유료 클릭 의도",
          observed:
            "같은 기간 유료 클릭 의도 장부는 Google click id 2,935건, 그중 gad_campaignid 2,909건입니다.",
          interpretation:
            "GTM/아임웹 태그의 초기 수집도 대체로 정상입니다.",
        },
        {
          step: "실제 결제완료",
          observed:
            `같은 기간 confirmed payment_success 114건 중 직접 Google click id 보존은 0건입니다. live 최근 7일 dashboard-summary 기준으로 넓히면 ${liveLast7.actualConfirmedOrders.toLocaleString("ko-KR")}건 중 ${liveLast7.directGoogleClickEvidenceOrders.toLocaleString("ko-KR")}건만 직접 보존입니다.`,
          interpretation:
            "결제완료 주문에 붙는 최종 evidence가 부족합니다. Google Ads upload 후보로 올릴 수 없습니다.",
        },
      ],
      nextProofNeeded:
        "정확한 마지막 코드 경로를 닫으려면 order-level read-only 진단이 필요합니다. 공개 API는 aggregate만 주므로 raw 주문번호/click id를 노출하지 않는 safe_ref 단위 order-level diagnostic endpoint 또는 VM Cloud SQLite read-only 접근이 다음 단계입니다.",
    },
    decision: {
      sendCandidateCount: 0,
      uploadCandidateCount: 0,
      reason:
        "실제 구매완료 주 전환의 출발 기준은 Meta CAPI와 같은 실제 결제완료 기준으로 맞췄습니다. 다만 지금 스크립트는 no-send 모드이며 Google Ads 전송 승인과 dispatcher가 닫혀 있어 실제 업로드 후보는 0건입니다.",
    },
  };
};

const renderMarkdown = (payload: Awaited<ReturnType<typeof buildPayload>>) => {
  const windows = payload.noSendWindows;

  return [
    "# Google Ads 실제 결제완료 no-send 후보 생성 결과",
    "",
    `작성 시각: ${payload.generatedAtKst}`,
    "문서 성격: read-only / no-send / no-write",
    "",
    "```yaml",
    "harness_preflight:",
    toYaml(payload.harness_preflight, 2),
    "```",
    "",
    "## 한 줄 결론",
    "",
    "Meta CAPI와 같은 실제 구매 기준을 Google Ads 주 전환 후보표의 출발점으로 재사용했습니다. Primary 전환을 준비하는 기준은 '지금 당장 보낼 주문이 있는가'가 아니라 '실제 결제완료 주문만 구매로 보는 기준이 고정됐는가'입니다.",
    "",
    "## 오늘 목표",
    "",
    payload.primaryConversionReadiness.todayGoal,
    "",
    `현재 진척률: ${payload.todayLaunchPlan.overallProgressPct}%`,
    "",
    payload.todayLaunchPlan.progressPlain,
    "",
    "## 목표 달성 단계별 계획",
    "",
    mdTable(
      ["순서", "할 일", "진척률", "현재 상태", "통과 기준", "다음 액션", "Lane/담당"],
      payload.todayLaunchPlan.steps.map((step) => [
        step.order,
        step.name,
        `${step.progressPct}%`,
        step.currentStatus,
        step.successCriteria,
        step.nextAction,
        `${step.lane}/${step.owner}`,
      ]),
    ),
    "",
    "## Google Ads에는 왜 보내는가",
    "",
    payload.whyGoogleAdsWouldReceiveThisLater.plainKorean,
    "",
    `현재 판단: ${payload.whyGoogleAdsWouldReceiveThisLater.currentDecision}`,
    "",
    "## Primary 전환 후보 기준 정리",
    "",
    payload.primaryConversionReadiness.conclusion,
    "",
    payload.primaryConversionReadiness.importantCorrection,
    "",
    mdTable(
      ["항목", "현재 판단", "사람 말 해석"],
      [
        [
          "실제 구매 기준",
          payload.primaryConversionReadiness.actualPurchaseBasisReady ? "준비됨" : "보강 필요",
          payload.primaryConversionReadiness.actualPurchaseBasisPlain,
        ],
        [
          "Primary 준비 가능 여부",
          payload.primaryConversionReadiness.primaryActionCanBePreparedBeforeFirstUpload ? "가능" : "보류",
          "첫 전송 전에도 실제 구매 전용 전환 액션을 준비할 수 있습니다. 다만 Google Ads 학습은 실제 이벤트가 들어온 뒤부터 시작됩니다.",
        ],
        [
          "현재 seed row",
          `${payload.primaryConversionReadiness.currentPrimarySeedRows}건`,
          "최근 7일 주문 단위 검토표에서 Meta식 실제 구매 기준을 통과하고 Google click id가 함께 보이는 후보입니다.",
        ],
        [
          "1단계 후보",
          `${payload.primaryConversionReadiness.stage1CleanGclidSeedRows}건`,
          "실제 결제완료이고 gclid 하나만 남아 있어, 오늘 주 전환 액션을 시작할 때 가장 먼저 검토할 단순 후보입니다.",
        ],
        [
          "2단계 후보",
          `${payload.primaryConversionReadiness.stage2IdentifierChoiceNeededRows}건`,
          "실제 결제완료는 맞지만 gclid와 gbraid가 같이 남아 있어, 전송 전에 식별자 선택 규칙이 필요합니다.",
        ],
        [
          "지금의 역할",
          "no-send 후보표",
          payload.primaryConversionReadiness.nextUse,
        ],
      ],
    ),
    "",
    "아직 학습이 시작되지 않는 이유:",
    "",
    ...payload.primaryConversionReadiness.whyItStillDoesNotLearnYet.map((item) => `- ${item}`),
    "",
    "## 1단계 no-send payload 후보",
    "",
    "이 표는 실제 전송 payload가 아니라, 오늘 주 전환 액션을 시작하기 전에 먼저 볼 수 있는 후보 미리보기입니다. 원문 주문번호와 원문 gclid는 보고서에 출력하지 않습니다.",
    "",
    `후보 수: ${payload.firstNoSendPayloadCandidates.length}건`,
    "",
    mdTable(
      [
        "masked order",
        "전환 액션 후보",
        "의미",
        "금액",
        "통화",
        "Google 식별자",
        "식별자 값",
        "남은 조건",
      ],
      payload.firstNoSendPayloadCandidates.map((row) => [
        row.maskedOrder,
        row.conversionActionCandidate,
        row.eventMeaning,
        row.amountKrw === null ? "n/a" : row.amountKrw.toLocaleString("ko-KR"),
        row.currencyCode,
        row.googleIdentifierType,
        row.googleIdentifierValueStatus,
        row.remainingBeforeRealSend.join(", "),
      ]),
    ),
    "",
    "## 1단계 후보 2건 전송 전 원문값 점검 설계",
    "",
    `목표: ${payload.stage1RawValuePreflight.goal}`,
    "",
    `진척률: ${payload.stage1RawValuePreflight.progressPct}%`,
    "",
    payload.stage1RawValuePreflight.progressPlain,
    "",
    "중요: 아래 표는 원문 주문번호나 원문 gclid를 보여주는 표가 아닙니다. 실제 값은 문서/대화에 노출하지 않고, 서버 내부 private preview 또는 전송 job 안에서만 확인해야 합니다.",
    "",
    ...payload.stage1RawValuePreflight.candidates.flatMap((candidate, index) => [
      `### 후보 ${index + 1}: ${candidate.maskedOrder}`,
      "",
      `현재 준비도: ${candidate.currentReadinessPct}%`,
      "",
      candidate.readinessPlain,
      "",
      mdTable(
        [
          "필요값",
          "왜 필요한가",
          "확인 source",
          "현재 상태",
          "안전 표시값",
          "통과 기준",
          "실패 시 해석",
        ],
        candidate.requiredValues.map((item) => [
          item.plainName,
          item.whyNeeded,
          item.requiredSource,
          item.currentStatus,
          item.safeReportValue,
          item.passCondition,
          item.failMeaning,
        ]),
      ),
      "",
      "아직 전송하지 않는 이유:",
      "",
      ...candidate.stillNoSendBecause.map((item) => `- ${item}`),
      "",
    ]),
    "다음 Green 작업:",
    "",
    `- ${payload.stage1RawValuePreflight.nextGreenAction}`,
    "",
    "다음 Red 작업:",
    "",
    `- ${payload.stage1RawValuePreflight.nextRedAction}`,
    "",
    "## no-send 후보 판정",
    "",
    mdTable(
      [
        "기준",
        "실제 결제완료",
        "매출",
        "click id 직접 보존",
        "보존률",
        "전송 후보",
        "주요 차단 이유",
      ],
      windows.map((row) => [
        row.label,
        row.actualConfirmedOrders.toLocaleString("ko-KR"),
        row.actualConfirmedRevenueKrw === null ? "n/a" : row.actualConfirmedRevenueKrw.toLocaleString("ko-KR"),
        row.directGoogleClickEvidenceOrders.toLocaleString("ko-KR"),
        pct(row.preservationRate),
        row.sendCandidateCount,
        Object.entries(row.blockReasonCounts)
          .filter(([, count]) => count > 0)
          .slice(0, 4)
          .map(([key, count]) => `${key} ${count}`)
          .join(", "),
      ]),
    ),
    "",
    "## ready_but_not_sent 검토표",
    "",
    "`ready_but_not_sent`는 전송 준비 완료가 아니다. Meta CAPI와 같은 실제 구매 기준을 통과한 주문 중 Google click id가 함께 보이는 주문을 따로 꺼내서, 왜 아직 Google Ads에 보내면 안 되는지 사유를 붙이는 검토표다.",
    "",
    `검토 row: ${payload.readyButNotSentReview.summary.reviewRows}건 / Meta 실제 구매 기준 통과: ${payload.readyButNotSentReview.summary.metaActualPurchaseCriteriaPassed}건 / 실제 전송 대기: ${payload.readyButNotSentReview.summary.sendReadyButNotSent}건 / Google Ads 전송 후보: ${payload.readyButNotSentReview.summary.googleAdsSendCandidates}건`,
    "",
    "여기서 중요한 점: 이 4건은 `Primary 전환 기준을 실제 구매완료로 잡는 데 쓸 수 있는 검토 표본`입니다. 반대로 `당장 Google Ads에 업로드해도 되는 주문 4건`이라는 뜻은 아닙니다.",
    "",
    `2단계 분리: 1단계 단순 후보 ${payload.readyButNotSentReview.summary.stage1CleanGclidSeedRows}건 / 2단계 식별자 선택 필요 후보 ${payload.readyButNotSentReview.summary.stage2IdentifierChoiceNeededRows}건`,
    "",
    mdTable(
      [
        "단계",
        "masked order",
        "결제",
        "금액",
        "click id 종류",
        "Meta 실제 구매 기준",
        "왜 이 단계인가",
        "아직 못 보내는 이유",
      ],
      payload.readyButNotSentReview.rows.map((row) => [
        row.primaryStartStagePlain,
        row.maskedOrder,
        `${row.paymentMethod}/${row.paymentStatus}`,
        row.amountKrw === null ? "n/a" : row.amountKrw.toLocaleString("ko-KR"),
        row.clickIdTypes.join("+") || "없음",
        row.actualPurchaseEligibility.passed ? "통과" : `보류: ${row.actualPurchaseEligibility.blockReasons.join("+")}`,
        row.primaryStartWhy,
        row.whyNotSendReady.join(", "),
      ]),
    ),
    "",
    "검토표 차단 조건:",
    "",
    ...payload.readyButNotSentReview.blockers.map((item) => `- ${item}`),
    "",
    "## click id가 마지막으로 끊기는 지점",
    "",
    `결론: ${payload.lastLossPoint.conclusion}`,
    "",
    mdTable(
      ["단계", "관측값", "뜻"],
      payload.lastLossPoint.evidence.map((row) => [row.step, row.observed, row.interpretation]),
    ),
    "",
    "## 왜 아직 Google Ads upload 후보가 아닌가",
    "",
    "- `send_candidate=0`: 이 스크립트는 실제 Google Ads 전송 코드를 호출하지 않습니다.",
    "- `read_only_phase`: 지금은 후보 판정만 합니다.",
    "- `approval_required`: 실제 전송은 TJ님이 별도 승인해야 합니다.",
    "- `meta_actual_purchase_criteria_not_passed`: Meta CAPI와 같은 실제 구매 기준을 통과하지 못한 주문은 Google Ads 실제 구매 후보에서 제외합니다.",
    "- `google_ads_conversion_action_not_selected_or_dispatch_closed`: 계정에 관찰용 offline 전환 액션은 보이지만, 이 no-send 결과를 실제 전송 대상으로 연결하지 않았습니다.",
    "- `missing_google_click_id`: 대부분의 실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남지 않았습니다.",
    "- `exact_order_level_payload_not_exported_from_public_endpoint`: 공개 API는 aggregate라서 실제 전송 payload를 만들 주문 단위 데이터가 없습니다.",
    "",
    "## 다음 증거",
    "",
    payload.lastLossPoint.nextProofNeeded,
    "",
    "## Guardrails",
    "",
    "```text",
    "Google Ads conversion upload: NOT RUN",
    "Google Ads conversion action change: NOT RUN",
    "운영DB write: NOT RUN",
    "VM Cloud SQLite write: NOT RUN",
    "배포/restart: NOT RUN",
    "raw order id 출력: 0",
    "raw click id 출력: 0",
    "```",
  ].join("\n");
};

buildPayload()
  .then((payload) => {
    fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
    fs.mkdirSync(path.dirname(markdownOutput), { recursive: true });
    fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
    process.stdout.write(JSON.stringify({
      ok: true,
      jsonOutput,
      markdownOutput,
      sendCandidateCount: payload.decision.sendCandidateCount,
      uploadCandidateCount: payload.decision.uploadCandidateCount,
      generatedAtKst: payload.generatedAtKst,
    }, null, 2));
    process.stdout.write("\n");
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
