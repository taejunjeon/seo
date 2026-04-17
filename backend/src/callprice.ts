import type { QueryResult, QueryResultRow } from "pg";

import { categorizeProductName, getDefaultConsultationRange } from "./consultation";
import { resolveIsoDateRange } from "./dateRange";
import { queryPg } from "./postgres";
import { diffIsoDatesInDays, shiftIsoDateByDays, shiftIsoDateByMonths, shiftIsoDateByYears } from "./utils/isoDate";

export const CALLPRICE_MATURITY_DAYS = [30, 60, 90, 180, 365] as const;
export const CALLPRICE_BASELINE_SCOPES = [
  "global_non_consultation",
  "analysis_type_non_consultation",
] as const;
export const CALLPRICE_RAMPUP_MONTHS = [1, 2, 3] as const;
export const CALLPRICE_RAMPUP_FORTNIGHTS = [1, 2, 3, 4, 5, 6] as const;
export const CALLPRICE_RAMPUP_CHECKPOINTS = [1, 2] as const;
export const CALLPRICE_MANAGER_SORT_FIELDS = [
  "completed_consultations",
  "matured_customers",
  "conversion_rate",
  "avg_revenue_per_customer",
  "estimated_incremental_value_per_customer",
  "estimated_incremental_revenue",
  "estimated_value_per_consultation",
] as const;
export const CALLPRICE_SUBSCRIPTION_PERIOD_LABELS = ["6개월", "1년", "2년", "전체 기간"] as const;
export const CALLPRICE_SUPPLEMENT_EXCLUDED_PRODUCT_NAMES = [
  "수원 왕갈비 통 닭목살",
  "기사식당 최강 제육",
  "저당 두부면 라자냐",
  "콜롬비아 수프레모 나리뇨 340g",
  "우삼겹 브로콜리 규동",
  "[일시품절상품] 대기 개별 결제창",
  "울트라 프리미엄 텐",
  "수비드 통삼겹 들기름 두부면 막국수",
  "소고기 버섯 들깨 덮밥",
  "팀키토 시그니처 도시락 6종 골라담기",
  "택배배송비",
  "항아리 차돌 된장",
  "훈제오리 들깨 크림 리조또",
  "팀키토 오리지널 도시락 8종 골라담기",
  "수랏간 삼치 솥밥",
  "강남역 호랑이 삼겹",
  "우삼겹 오일 파스타",
  "B.T.S 치킨 치즈 리조또",
  "팀 키토 저당만두 이베리코 냉동 굴림만두 글루텐프리",
  "춘천 들깨 닭갈비",
  "[품절상품] 대기 개별 결제창",
  "수비드 통삼겹 된장 덮밥",
  "포커스 패키지 3종",
  "제로밥상 무설탕 제육볶음&간장불고기 300g",
] as const;

export type CallpriceMaturityDays = (typeof CALLPRICE_MATURITY_DAYS)[number];
export type CallpriceBaselineScope = (typeof CALLPRICE_BASELINE_SCOPES)[number];
export type CallpriceManagerSortField = (typeof CALLPRICE_MANAGER_SORT_FIELDS)[number];

export type CallpriceDateRange = {
  startDate: string;
  endDate: string;
};

type QueryRunner = <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[],
) => Promise<QueryResult<TRow>>;

type CompletedConsultationRow = {
  customerName: string;
  customerContact: string;
  manager: string;
  rawAnalysisType: string;
  consultationDate: string;
};

type OrderRow = {
  normalizedPhone: string;
  orderDate: string;
  netRevenue: number;
};

type OrderWithProductRow = OrderRow & {
  productName: string;
  productCategory: "test_kit" | "supplement" | "other";
};

type BaselineCustomerRow = {
  normalizedPhone: string;
  firstTestDate: string;
  reportTypes: string[];
};

type CohortCustomer = {
  normalizedPhone: string;
  customerName: string;
  manager: string;
  analysisTypes: string[];
  anchorDate: string;
  completedConsultations: number;
  matchedOrderCustomer: boolean;
  matured: boolean;
  converted: boolean;
  revenueWithinWindow: number;
};

type BaselineCustomer = {
  normalizedPhone: string;
  firstTestDate: string;
  reportTypes: string[];
  matured: boolean;
  converted: boolean;
  revenueWithinWindow: number;
};

type CohortSummary = {
  completed_consultations: number;
  unique_completed_customers: number;
  matched_order_customers: number;
  matured_customers: number;
  converted_customers: number;
  conversion_rate: number;
  avg_revenue_per_customer: number;
  baseline_avg_revenue_per_customer: number;
  estimated_incremental_value_per_customer: number;
  estimated_incremental_revenue: number;
  estimated_value_per_consultation: number;
};

type BaselineStats = {
  globalAvgRevenuePerCustomer: number;
  totalCustomers: number;
  maturedCustomers: number;
  convertedCustomers: number;
  avgRevenueByAnalysisType: Map<string, number>;
  fallbackNotes: string[];
};

type CallpriceEnvelope<TData, TMeta extends Record<string, unknown>> = {
  status: "success";
  data: TData;
  meta: TMeta;
  notes: string[];
};

type CallpriceOverviewData = {
  summary: CohortSummary;
  filters: {
    start_date: string;
    end_date: string;
    manager: string | null;
    analysis_type: string | null;
  };
};

type CallpriceManagersRow = CohortSummary & {
  manager: string;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
  share_of_total_completed_consultations: number;
  share_of_total_estimated_incremental_revenue: number;
};

type CallpriceAnalysisTypeRow = CohortSummary & {
  analysis_type: string;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceOptionsData = {
  manager_options: string[];
  analysis_type_options: string[];
  baseline_scope_options: Array<{ value: CallpriceBaselineScope; label: string }>;
  maturity_day_options: number[];
};

type ScenarioData = {
  headcount: number;
  monthly_cost: number;
  estimated_incremental_revenue: number;
  estimated_incremental_profit: number;
  incremental_revenue_multiple: number;
  break_even_cost: number;
  break_even_headcount: number;
  assumed_monthly_incremental_revenue_per_headcount: number;
};

type CallpriceDayType = "weekday" | "weekend";
type CallpriceSupplementTimingBucketKey =
  | "same_day"
  | "within_3_days"
  | "within_7_days"
  | "within_14_days"
  | "within_30_days"
  | "after_31_days";

type CallpriceDayTypeCompletionRow = {
  day_type: CallpriceDayType;
  total_consults: number;
  completed_consults: number;
  completion_rate: number;
  absent_consults: number;
  absent_rate: number;
  changed_consults: number;
  changed_rate: number;
  canceled_consults: number;
  canceled_rate: number;
};

type CallpriceDayTypeValueRow = {
  day_type: CallpriceDayType;
  maturity_days: number;
  completed_consultations: number;
  matured_customers: number;
  converted_customers: number;
  conversion_rate: number;
  avg_revenue_per_customer: number;
  ltr: number;
  value_per_completed_consultation: number;
  total_revenue: number;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceDayTypeComparisonData = {
  completion: CallpriceDayTypeCompletionRow[];
  value: CallpriceDayTypeValueRow[];
  comparison: {
    value_maturity_days: number;
    weekend_completion_rate_diff: number;
    weekend_conversion_rate_diff: number;
    weekend_avg_revenue_per_customer_diff: number;
    weekend_avg_revenue_per_customer_multiple: number;
    weekend_value_per_completed_consultation_diff: number;
    weekend_value_per_completed_consultation_multiple: number;
    weekend_ltr_diff: number;
    weekend_90d_tracking_available: boolean;
    weekend_90d_tracking_available_from: string | null;
  };
};

type CallpriceSupplementTimingBucketRow = {
  bucket_key: CallpriceSupplementTimingBucketKey;
  label: string;
  min_day_offset: number;
  max_day_offset: number | null;
  customer_count: number;
  share_of_supplement_buyers: number;
  share_of_matured_consultation_customers: number;
};

type CallpriceSupplementTimingData = {
  cohort: {
    completed_consultations: number;
    unique_completed_customers: number;
    matured_customers: number;
    supplement_buyers: number;
    no_supplement_purchase_customers: number;
    supplement_conversion_rate: number;
  };
  buckets: CallpriceSupplementTimingBucketRow[];
};

type CallpriceSupplementRepeatBucketKey =
  | "one_order"
  | "two_orders"
  | "three_orders"
  | "four_plus_orders";

type CallpriceSupplementRepeatBucketRow = {
  bucket_key: CallpriceSupplementRepeatBucketKey;
  label: string;
  min_total_orders: number;
  max_total_orders: number | null;
  customer_count: number;
  share_of_matured_starters: number;
};

type CallpriceSupplementRepeatPatternData = {
  cohort: {
    completed_consultation_customers: number;
    supplement_starter_customers: number;
    matured_supplement_starter_customers: number;
    excluded_recent_starters: number;
  };
  summary: {
    observation_days: number;
    avg_total_orders_within_1y: number;
    avg_repeat_orders_within_1y: number;
    repeat_purchase_rate_2plus: number;
    repeat_purchase_rate_3plus: number;
    repeat_purchase_rate_4plus: number;
    loyal_rate_6plus: number;
    p50_total_orders_within_1y: number;
    p75_total_orders_within_1y: number;
    p90_total_orders_within_1y: number;
  };
  buckets: CallpriceSupplementRepeatBucketRow[];
};

type CallpriceRampupMonth = (typeof CALLPRICE_RAMPUP_MONTHS)[number];
type CallpriceRampupFortnight = (typeof CALLPRICE_RAMPUP_FORTNIGHTS)[number];
type CallpriceRampupCheckpoint = (typeof CALLPRICE_RAMPUP_CHECKPOINTS)[number];

type RampupWindowDefinition<TIndex extends number = number> = {
  segment_index: TIndex;
  segment_label: string;
  start_day_offset: number;
  end_day_offset: number;
};

type CallpriceRampupSegmentSummaryRow<TIndex extends number = number> = CohortSummary & {
  segment_index: TIndex;
  segment_label: string;
  start_day_offset: number;
  end_day_offset: number;
  manager_count: number;
  matured_manager_count: number;
  manager_names: string[];
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceRampupSegmentManagerRow<TIndex extends number = number> = CohortSummary & {
  manager: string;
  segment_index: TIndex;
  segment_label: string;
  start_day_offset: number;
  end_day_offset: number;
  first_observed_completed_date: string;
  window_start_date: string;
  window_end_date: string;
  baseline_matured_customers: number;
  legacy_assumption: boolean;
  legacy_assumption_reason: string | null;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceManagerAliasGroup = {
  canonical_manager: string;
  aliases: string[];
};

type CallpriceManagerHireDate = {
  manager: string;
  hire_date: string;
  note: string;
};

type CallpriceProbationGuide = {
  checkpoint_label: string;
  maturity_days: number;
  minimum: {
    completed_consultations: number;
    conversion_rate: number;
    value_per_consultation: number;
  };
  typical: {
    completed_consultations: number;
    conversion_rate: number;
    value_per_consultation: number;
  };
  strong: {
    completed_consultations: number;
    conversion_rate: number;
    value_per_consultation: number;
  };
  note: string;
};

type CallpriceRampupSummaryRow = CohortSummary & {
  month_index: CallpriceRampupMonth;
  month_label: string;
  start_day_offset: number;
  end_day_offset: number;
  manager_count: number;
  matured_manager_count: number;
  manager_names: string[];
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceRampupManagerRow = CohortSummary & {
  manager: string;
  month_index: CallpriceRampupMonth;
  month_label: string;
  start_day_offset: number;
  end_day_offset: number;
  first_observed_completed_date: string;
  window_start_date: string;
  window_end_date: string;
  baseline_matured_customers: number;
  legacy_assumption: boolean;
  legacy_assumption_reason: string | null;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

type CallpriceRampupData = {
  summary_excluding_legacy: CallpriceRampupSummaryRow[];
  summary_including_legacy: CallpriceRampupSummaryRow[];
  manager_items: CallpriceRampupManagerRow[];
  fortnight_summary_excluding_legacy: CallpriceRampupSegmentSummaryRow<CallpriceRampupFortnight>[];
  fortnight_summary_including_legacy: CallpriceRampupSegmentSummaryRow<CallpriceRampupFortnight>[];
  fortnight_manager_items: CallpriceRampupSegmentManagerRow<CallpriceRampupFortnight>[];
  checkpoint_summary_excluding_legacy: CallpriceRampupSegmentSummaryRow<CallpriceRampupCheckpoint>[];
  checkpoint_summary_including_legacy: CallpriceRampupSegmentSummaryRow<CallpriceRampupCheckpoint>[];
  checkpoint_manager_items: CallpriceRampupSegmentManagerRow<CallpriceRampupCheckpoint>[];
  legacy_manager_names: string[];
  recent_manager_names: string[];
  manager_alias_groups: CallpriceManagerAliasGroup[];
  manager_hire_dates: CallpriceManagerHireDate[];
  probation_guides: CallpriceProbationGuide[];
};

type RampupSegmentInternal<TIndex extends number = number> = CallpriceRampupSegmentManagerRow<TIndex> & {
  total_revenue: number;
  total_baseline_revenue: number;
};

const COMPLETED_STATUS_SQL = `regexp_replace(lower(coalesce(consultation_status::text, '')), '\\s+', '', 'g') like '%완료%'`;
const CONSULTATION_DATE_SQL = `
  case
    when trim(coalesce(consultation_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(consultation_date::text), 10)::date
    when trim(coalesce(insertdate::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(insertdate::text), 10)::date
    else null
  end
`;
const TEST_DATE_SQL = `
  case
    when trim(coalesce(test_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(test_date::text), 10)::date
    when trim(coalesce(insert_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(insert_date::text), 10)::date
    else null
  end
`;
const ORDER_DATE_SQL = `
  case
    when trim(coalesce(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(payment_complete_time::text), 10)::date
    when trim(coalesce(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(order_date::text), 10)::date
    else null
  end
`;
const ORDER_REVENUE_SQL = `
  greatest(
    coalesce(nullif(final_order_amount, 0), nullif(paid_price, 0), nullif(total_price, 0), 0)
      - coalesce(total_refunded_price, 0),
    0
  )
`;
const NORMALIZED_PHONE_SQL = `regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g')`;
const NORMALIZED_CONTACT_SQL = `regexp_replace(coalesce(customer_contact::text, ''), '[^0-9]', '', 'g')`;
const NORMALIZED_MOBILE_SQL = `regexp_replace(coalesce(mobile::text, ''), '[^0-9]', '', 'g')`;
const CALLPRICE_RAMPUP_WINDOW_DAYS = 30;
const CALLPRICE_MANAGER_ALIAS_GROUPS = [
  {
    canonical_manager: "동주",
    aliases: ["동주", "서동주", "팀장님"],
  },
] as const;
const CALLPRICE_MANAGER_ALIAS_LOOKUP = new Map<string, string>(
  CALLPRICE_MANAGER_ALIAS_GROUPS.flatMap((group) =>
    group.aliases.map((alias) => [alias, group.canonical_manager] as const),
  ),
);
const CALLPRICE_MANAGER_HIRE_DATE_OVERRIDES = new Map<string, string>([
  ["민정", "2023-11-20"],
  ["동주", "2023-07-24"],
  ["경태", "2022-06-21"],
]);
const CALLPRICE_RAMPUP_MONTH_WINDOWS: RampupWindowDefinition<CallpriceRampupMonth>[] = [
  { segment_index: 1, segment_label: "1개월차", start_day_offset: 0, end_day_offset: 29 },
  { segment_index: 2, segment_label: "2개월차", start_day_offset: 30, end_day_offset: 59 },
  { segment_index: 3, segment_label: "3개월차", start_day_offset: 60, end_day_offset: 89 },
];
const CALLPRICE_RAMPUP_FORTNIGHT_WINDOWS: RampupWindowDefinition<CallpriceRampupFortnight>[] = [
  { segment_index: 1, segment_label: "1~2주차", start_day_offset: 0, end_day_offset: 13 },
  { segment_index: 2, segment_label: "3~4주차", start_day_offset: 14, end_day_offset: 27 },
  { segment_index: 3, segment_label: "5~6주차", start_day_offset: 28, end_day_offset: 41 },
  { segment_index: 4, segment_label: "7~8주차", start_day_offset: 42, end_day_offset: 55 },
  { segment_index: 5, segment_label: "9~10주차", start_day_offset: 56, end_day_offset: 69 },
  { segment_index: 6, segment_label: "11~12주차", start_day_offset: 70, end_day_offset: 83 },
];
const CALLPRICE_RAMPUP_CHECKPOINT_WINDOWS: RampupWindowDefinition<CallpriceRampupCheckpoint>[] = [
  { segment_index: 1, segment_label: "5주차", start_day_offset: 0, end_day_offset: 34 },
  { segment_index: 2, segment_label: "10주차", start_day_offset: 0, end_day_offset: 69 },
];
const CALLPRICE_RAMPUP_LEGACY_MANAGERS = ["민정", "경태", "동주"] as const;
const CALLPRICE_RAMPUP_LEGACY_MANAGER_SET = new Set<string>(CALLPRICE_RAMPUP_LEGACY_MANAGERS);
const CALLPRICE_SUPPLEMENT_TIMING_BUCKETS = [
  { bucket_key: "same_day", label: "상담 당일", min_day_offset: 0, max_day_offset: 0 },
  { bucket_key: "within_3_days", label: "3일 이내", min_day_offset: 1, max_day_offset: 3 },
  { bucket_key: "within_7_days", label: "7일 이내", min_day_offset: 4, max_day_offset: 7 },
  { bucket_key: "within_14_days", label: "14일 이내", min_day_offset: 8, max_day_offset: 14 },
  { bucket_key: "within_30_days", label: "30일 이내", min_day_offset: 15, max_day_offset: 30 },
  { bucket_key: "after_31_days", label: "31일 이후", min_day_offset: 31, max_day_offset: null },
] as const satisfies ReadonlyArray<{
  bucket_key: CallpriceSupplementTimingBucketKey;
  label: string;
  min_day_offset: number;
  max_day_offset: number | null;
}>;
const CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS = 365;
const CALLPRICE_SUPPLEMENT_REPEAT_BUCKETS = [
  { bucket_key: "one_order", label: "첫 구매만 하고 종료", min_total_orders: 1, max_total_orders: 1 },
  { bucket_key: "two_orders", label: "1회 재구매 (총 2회)", min_total_orders: 2, max_total_orders: 2 },
  { bucket_key: "three_orders", label: "2회 재구매 (총 3회)", min_total_orders: 3, max_total_orders: 3 },
  { bucket_key: "four_plus_orders", label: "3회 이상 재구매 (총 4회+)", min_total_orders: 4, max_total_orders: null },
] as const satisfies ReadonlyArray<{
  bucket_key: CallpriceSupplementRepeatBucketKey;
  label: string;
  min_total_orders: number;
  max_total_orders: number | null;
}>;

const todayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const trimToEmpty = (value?: string | null) => value?.trim() ?? "";
const normalizeMatchText = (value?: string | null) =>
  trimToEmpty(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();

const toIsoDateOnly = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
};

const toRoundedAverage = (total: number, count: number) => {
  if (count <= 0) return 0;
  return Math.round(total / count);
};

const percentileFromSortedNumbers = (values: number[], percentile: number) => {
  if (values.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, percentile));
  const index = Math.floor((values.length - 1) * clamped);
  return values[index] ?? 0;
};

const classifyCallpriceDayType = (isoDate: string): CallpriceDayType => {
  const [year, month, day] = isoDate.split("-").map((value) => Number.parseInt(value, 10));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6 ? "weekend" : "weekday";
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const normalizeCallpriceManager = (value?: string | null) => {
  const manager = trimToEmpty(value);
  if (!manager) return "미지정";
  return CALLPRICE_MANAGER_ALIAS_LOOKUP.get(manager) ?? manager;
};

export const normalizeCallpricePhone = (value?: string | null) => {
  const digits = trimToEmpty(value).replace(/[^0-9]/g, "");
  if (!digits) return "";

  const maybeNormalize82 = (candidate: string) => {
    if (!candidate) return "";
    if (candidate.startsWith("82")) {
      const local = candidate.slice(2);
      const prefixed = local.startsWith("0") ? local : `0${local}`;
      return prefixed.length === 10 || prefixed.length === 11 ? prefixed : "";
    }
    return candidate.length === 10 || candidate.length === 11 ? candidate : "";
  };

  return maybeNormalize82(digits);
};

export const splitAnalysisTypes = (value?: string | null) => {
  const raw = trimToEmpty(value).replace(/\u00a0/g, " ");
  if (!raw) return ["미분류"];

  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.includes("알레르기")) return "알러지";
      if (token === "음식물과민증") return "음식물";
      if (token === "중금속 미네랄검사") return "중금속";
      if (token === "스트레스 노화" || token === "스트레스노화 분석") return "호르몬";
      return token;
    });

  return uniqueStrings(tokens.length > 0 ? tokens : ["미분류"]);
};

export const mapAnalysisTypesToReportTypes = (analysisTypes: string[]) => {
  const reportTypes = new Set<string>();

  for (const analysisType of analysisTypes) {
    const normalized = normalizeMatchText(analysisType);

    if (!normalized) continue;

    if (
      normalized.includes("알러지") ||
      normalized.includes("알레르기") ||
      normalized.includes("음식물")
    ) {
      reportTypes.add("음식물 과민증");
    }

    if (
      normalized.includes("중금속") ||
      normalized.includes("유기산") ||
      normalized.includes("장내") ||
      normalized.includes("대사")
    ) {
      reportTypes.add("종합대사기능");
    }

    if (
      normalized.includes("스트레스노화") ||
      (normalized.includes("스트레스") && normalized.includes("노화"))
    ) {
      reportTypes.add("스트레스노화 호르몬");
    }

    if (normalized.includes("호르몬")) {
      reportTypes.add("종합호르몬");
      reportTypes.add("스트레스노화 호르몬");
    }
  }

  return Array.from(reportTypes);
};

const containsAnalysisType = (rawAnalysisType: string, analysisType: string) => {
  const wanted = trimToEmpty(analysisType);
  if (!wanted) return true;
  return splitAnalysisTypes(rawAnalysisType).includes(wanted);
};

const isValidMaturityDays = (value: number): value is CallpriceMaturityDays =>
  CALLPRICE_MATURITY_DAYS.includes(value as CallpriceMaturityDays);

const getDefaultCallpriceRange = () => getDefaultConsultationRange();

export const resolveCallpriceDateRange = (params: {
  startDateParam?: string;
  endDateParam?: string;
}) => {
  const defaults = getDefaultCallpriceRange();

  return resolveIsoDateRange({
    startDateParam: params.startDateParam,
    endDateParam: params.endDateParam,
    defaultStartDate: defaults.startDate,
    defaultEndDate: defaults.endDate,
  });
};

const parseRowArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => trimToEmpty(String(item))).filter(Boolean) : [];

const buildNotes = (extraNotes: string[] = []) =>
  uniqueStrings([
    "준증분 추정치는 미상담 비교군 대비 관측 차이이며 인과적으로 확정된 순증분 값이 아닙니다.",
    "공식 ROI가 아니라 read-only 추정 지표입니다.",
    "최근 상담 중 maturity 미도달 고객은 평균 매출 계산에서 제외됩니다.",
    ...extraNotes,
  ]);

const sortStringsByCountThenLabel = (counts: Map<string, number>) =>
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([value]) => value);

const fetchCompletedConsultationRows = async (
  params: {
    range?: CallpriceDateRange;
    manager?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<CompletedConsultationRow[]> => {
  const values: unknown[] = [];
  const filters: string[] = [];
  const normalizedManagerFilter = trimToEmpty(params.manager)
    ? normalizeCallpriceManager(params.manager)
    : "";

  if (params.range) {
    values.push(params.range.startDate, params.range.endDate);
    filters.push(`consultation_date between $1::date and $2::date`);
  }

  const result = await runner<{
    customer_name: string;
    customer_contact: string;
    manager: string;
    raw_analysis_type: string;
    consultation_date: string;
  }>(
    `
      with completed_rows as (
        select
          coalesce(nullif(trim(customer_name), ''), '이름없음') as customer_name,
          trim(coalesce(customer_contact, '')) as customer_contact,
          coalesce(nullif(trim(manager), ''), '미지정') as manager,
          coalesce(nullif(trim(analysis_type), ''), '미분류') as raw_analysis_type,
          ${CONSULTATION_DATE_SQL} as consultation_date
        from public.tb_consultation_records
        where ${COMPLETED_STATUS_SQL}
      )
      select
        customer_name,
        customer_contact,
        manager,
        raw_analysis_type,
        consultation_date::text as consultation_date
      from completed_rows
      ${filters.length > 0 ? `where ${filters.join(" and ")}` : ""}
      order by consultation_date asc, manager asc, customer_name asc
    `,
    values,
  );

  const rows = result.rows
    .map((row) => ({
      customerName: row.customer_name,
      customerContact: row.customer_contact,
      manager: row.manager,
      rawAnalysisType: row.raw_analysis_type,
      consultationDate: toIsoDateOnly(row.consultation_date),
    }))
    .filter(
      (row): row is CompletedConsultationRow =>
        Boolean(row.consultationDate) && Boolean(normalizeCallpricePhone(row.customerContact)),
    )
    .map((row) => ({
      ...row,
      manager: normalizeCallpriceManager(row.manager),
    }));

  return normalizedManagerFilter
    ? rows.filter((row) => row.manager === normalizedManagerFilter)
    : rows;
};

const fetchCompletedConsultPhones = async (runner: QueryRunner = queryPg) => {
  const result = await runner<{ customer_contact: string }>(
    `
      select trim(coalesce(customer_contact, '')) as customer_contact
      from public.tb_consultation_records
      where ${COMPLETED_STATUS_SQL}
        and ${NORMALIZED_CONTACT_SQL} <> ''
    `,
  );

  return new Set(
    result.rows
      .map((row) => normalizeCallpricePhone(row.customer_contact))
      .filter((value): value is string => Boolean(value)),
  );
};

const fetchBaselineCustomerRows = async (runner: QueryRunner = queryPg) => {
  const result = await runner<{
    raw_phone: string;
    first_test_date: string;
    report_types: unknown;
  }>(
    `
      select
        ${NORMALIZED_MOBILE_SQL} as raw_phone,
        min(${TEST_DATE_SQL})::text as first_test_date,
        array_agg(distinct coalesce(nullif(trim(report_type), ''), '미분류')) as report_types
      from public.customer_report_info
      where ${TEST_DATE_SQL} is not null
        and ${NORMALIZED_MOBILE_SQL} <> ''
      group by ${NORMALIZED_MOBILE_SQL}
    `,
  );

  const merged = new Map<string, BaselineCustomerRow>();

  for (const row of result.rows) {
    const normalizedPhone = normalizeCallpricePhone(row.raw_phone);
    const firstTestDate = toIsoDateOnly(row.first_test_date);
    if (!normalizedPhone || !firstTestDate) continue;

    const existing = merged.get(normalizedPhone);
    const reportTypes = uniqueStrings([
      ...(existing?.reportTypes ?? []),
      ...parseRowArray(row.report_types),
    ]);

    if (!existing || firstTestDate < existing.firstTestDate) {
      merged.set(normalizedPhone, {
        normalizedPhone,
        firstTestDate,
        reportTypes,
      });
      continue;
    }

    merged.set(normalizedPhone, {
      ...existing,
      reportTypes,
    });
  }

  return Array.from(merged.values());
};

const fetchOrdersByPhones = async (
  phones: string[],
  minAnchorDate: string,
  runner: QueryRunner = queryPg,
) => {
  if (phones.length === 0) {
    return new Map<string, OrderRow[]>();
  }

  const result = await runner<{
    normalized_phone: string;
    order_date: string;
    net_revenue: number | string;
  }>(
    `
      select
        ${NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ORDER_DATE_SQL}::text as order_date,
        ${ORDER_REVENUE_SQL} as net_revenue
      from public.tb_iamweb_users
      where ${NORMALIZED_PHONE_SQL} = any($1::text[])
        and ${ORDER_DATE_SQL} is not null
        and ${ORDER_DATE_SQL} >= $2::date
        and ${ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      order by ${NORMALIZED_PHONE_SQL} asc, ${ORDER_DATE_SQL} asc
    `,
    [phones, minAnchorDate],
  );

  const grouped = new Map<string, OrderRow[]>();

  for (const row of result.rows) {
    const normalizedPhone = normalizeCallpricePhone(row.normalized_phone);
    const orderDate = toIsoDateOnly(row.order_date);
    if (!normalizedPhone || !orderDate) continue;

    const bucket = grouped.get(normalizedPhone) ?? [];
    bucket.push({
      normalizedPhone,
      orderDate,
      netRevenue: toNumber(row.net_revenue),
    });
    grouped.set(normalizedPhone, bucket);
  }

  return grouped;
};

const fetchOrdersWithProductsByPhones = async (
  phones: string[],
  minAnchorDate: string,
  runner: QueryRunner = queryPg,
) => {
  if (phones.length === 0) {
    return new Map<string, OrderWithProductRow[]>();
  }

  const result = await runner<{
    normalized_phone: string;
    order_date: string;
    net_revenue: number | string;
    product_name: string;
  }>(
    `
      select
        ${NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ORDER_DATE_SQL}::text as order_date,
        ${ORDER_REVENUE_SQL} as net_revenue,
        coalesce(nullif(trim(product_name), ''), '미분류') as product_name
      from public.tb_iamweb_users
      where ${NORMALIZED_PHONE_SQL} = any($1::text[])
        and ${ORDER_DATE_SQL} is not null
        and ${ORDER_DATE_SQL} >= $2::date
        and ${ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      order by ${NORMALIZED_PHONE_SQL} asc, ${ORDER_DATE_SQL} asc
    `,
    [phones, minAnchorDate],
  );

  const grouped = new Map<string, OrderWithProductRow[]>();

  for (const row of result.rows) {
    const normalizedPhone = normalizeCallpricePhone(row.normalized_phone);
    const orderDate = toIsoDateOnly(row.order_date);
    if (!normalizedPhone || !orderDate) continue;

    const bucket = grouped.get(normalizedPhone) ?? [];
    bucket.push({
      normalizedPhone,
      orderDate,
      netRevenue: toNumber(row.net_revenue),
      productName: row.product_name,
      productCategory: categorizeProductName(row.product_name),
    });
    grouped.set(normalizedPhone, bucket);
  }

  return grouped;
};

const fetchCallpriceDayTypeCompletionRows = async (
  params: {
    range: CallpriceDateRange;
  },
  runner: QueryRunner = queryPg,
) => {
  const result = await runner<{
    day_type: CallpriceDayType;
    total_consults: number | string;
    completed_consults: number | string;
    completion_rate: number | string;
    absent_consults: number | string;
    absent_rate: number | string;
    changed_consults: number | string;
    changed_rate: number | string;
    canceled_consults: number | string;
    canceled_rate: number | string;
  }>(
    `
      with rows as (
        select
          ${CONSULTATION_DATE_SQL} as consultation_date,
          coalesce(nullif(trim(consultation_status), ''), '미분류') as consultation_status
        from public.tb_consultation_records
      )
      select
        case
          when extract(isodow from consultation_date) in (6, 7) then 'weekend'
          else 'weekday'
        end as day_type,
        count(*) as total_consults,
        count(*) filter (where consultation_status = '완료') as completed_consults,
        coalesce(count(*) filter (where consultation_status = '완료')::numeric / nullif(count(*), 0), 0) as completion_rate,
        count(*) filter (where consultation_status = '부재') as absent_consults,
        coalesce(count(*) filter (where consultation_status = '부재')::numeric / nullif(count(*), 0), 0) as absent_rate,
        count(*) filter (where consultation_status in ('변경', '시간 변경')) as changed_consults,
        coalesce(count(*) filter (where consultation_status in ('변경', '시간 변경'))::numeric / nullif(count(*), 0), 0) as changed_rate,
        count(*) filter (where consultation_status = '취소') as canceled_consults,
        coalesce(count(*) filter (where consultation_status = '취소')::numeric / nullif(count(*), 0), 0) as canceled_rate
      from rows
      where consultation_date between $1::date and $2::date
      group by 1
      order by 1
    `,
    [params.range.startDate, params.range.endDate],
  );

  return result.rows.map((row) => ({
    day_type: row.day_type,
    total_consults: toNumber(row.total_consults),
    completed_consults: toNumber(row.completed_consults),
    completion_rate: toRate(toNumber(row.completed_consults), toNumber(row.total_consults)),
    absent_consults: toNumber(row.absent_consults),
    absent_rate: toNumber(row.absent_rate),
    changed_consults: toNumber(row.changed_consults),
    changed_rate: toNumber(row.changed_rate),
    canceled_consults: toNumber(row.canceled_consults),
    canceled_rate: toNumber(row.canceled_rate),
  })) satisfies CallpriceDayTypeCompletionRow[];
};

const buildConsultationCohort = (params: {
  rows: CompletedConsultationRow[];
  analysisType?: string;
  maturityDays: CallpriceMaturityDays;
  referenceDate: string;
  ordersByPhone: Map<string, OrderRow[]>;
}) => {
  const filteredRows = params.analysisType
    ? params.rows.filter((row) => containsAnalysisType(row.rawAnalysisType, params.analysisType ?? ""))
    : params.rows;

  const rawCountsByManager = new Map<string, number>();
  const rawCountsByAnalysisType = new Map<string, number>();
  const rowsByPhone = new Map<string, CompletedConsultationRow[]>();

  for (const row of filteredRows) {
    rawCountsByManager.set(row.manager, (rawCountsByManager.get(row.manager) ?? 0) + 1);

    for (const analysisType of splitAnalysisTypes(row.rawAnalysisType)) {
      rawCountsByAnalysisType.set(analysisType, (rawCountsByAnalysisType.get(analysisType) ?? 0) + 1);
    }

    const normalizedPhone = normalizeCallpricePhone(row.customerContact);
    if (!normalizedPhone) continue;

    const bucket = rowsByPhone.get(normalizedPhone) ?? [];
    bucket.push(row);
    rowsByPhone.set(normalizedPhone, bucket);
  }

  const maturityCutoffDate = shiftIsoDateByDays(params.referenceDate, -params.maturityDays);
  const customers: CohortCustomer[] = [];

  for (const [normalizedPhone, rows] of rowsByPhone.entries()) {
    const sortedRows = [...rows].sort(
      (a, b) =>
        a.consultationDate.localeCompare(b.consultationDate) ||
        a.manager.localeCompare(b.manager, "ko") ||
        a.customerName.localeCompare(b.customerName, "ko"),
    );
    const firstRow = sortedRows[0];
    const analysisTypes = uniqueStrings(sortedRows.flatMap((row) => splitAnalysisTypes(row.rawAnalysisType)));
    const anchorDate = firstRow.consultationDate;
    const allOrders = (params.ordersByPhone.get(normalizedPhone) ?? []).filter(
      (order) => order.orderDate >= anchorDate,
    );
    const revenueWindowEnd = shiftIsoDateByDays(anchorDate, params.maturityDays);
    const matured = anchorDate <= maturityCutoffDate;
    const revenueWithinWindow = allOrders
      .filter((order) => order.orderDate < revenueWindowEnd)
      .reduce((sum, order) => sum + order.netRevenue, 0);

    customers.push({
      normalizedPhone,
      customerName: firstRow.customerName,
      manager: firstRow.manager,
      analysisTypes,
      anchorDate,
      completedConsultations: sortedRows.length,
      matchedOrderCustomer: allOrders.length > 0,
      matured,
      converted: matured && revenueWithinWindow > 0,
      revenueWithinWindow: matured ? revenueWithinWindow : 0,
    });
  }

  return {
    rows: filteredRows,
    rawCountsByManager,
    rawCountsByAnalysisType,
    customers,
  };
};

type CallpriceSubscriptionConversionRow = {
  period_label: string;
  non_sub_customers: number;
  converted_customers: number;
  conversion_percentage: number;
};

type CallpriceSupplementSubscriptionRatioRow = {
  period_label: string;
  subscription_ratio_percentage: number;
  total_supplement_sales: number;
  subscription_supplement_sales: number;
  non_subscription_supplement_sales: number;
};

type CallpriceSubscriptionStatusData = {
  availability: {
    exact_active_subscriber_count_available: boolean;
    exact_active_subscriber_count_reason: string;
    subscription_order_history_available: boolean;
    conversion_rate_available: boolean;
    supplement_subscription_ratio_available: boolean;
  };
  current_snapshot: {
    valid_subscription_order_rows: number;
    distinct_subscription_order_customers: number;
    latest_subscription_order_date: string | null;
    latest_month_label: string | null;
    latest_month_subscription_customers: number;
  };
  schema_evidence: {
    subscription_related_base_tables: string[];
    customer_subscription_state_table_detected: boolean;
  };
  conversion_periods: CallpriceSubscriptionConversionRow[];
  supplement_ratio_periods: CallpriceSupplementSubscriptionRatioRow[];
};

type CallpriceSubscriptionConsultComparisonRow = {
  period_label: string;
  consulted_non_sub_customers: number;
  consulted_converted_customers: number;
  consulted_conversion_percentage: number;
  non_consulted_non_sub_customers: number;
  non_consulted_converted_customers: number;
  non_consulted_conversion_percentage: number;
  conversion_rate_diff_percentage_points: number;
  conversion_rate_multiple: number | null;
};

type CallpriceSubscriptionConsultComparisonData = {
  items: CallpriceSubscriptionConsultComparisonRow[];
};

const CALLPRICE_HEAVY_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

let subscriptionConsultComparisonCache:
  | {
      referenceDate: string;
      cachedAt: number;
      payload: CallpriceEnvelope<
        CallpriceSubscriptionConsultComparisonData,
        {
          reference_date: string;
          period_labels: string[];
          definition: string;
        }
      >;
    }
  | null = null;

const buildBaselineCohort = (params: {
  rows: BaselineCustomerRow[];
  completedConsultPhones: Set<string>;
  range: CallpriceDateRange;
  maturityDays: CallpriceMaturityDays;
  referenceDate: string;
  ordersByPhone: Map<string, OrderRow[]>;
}) => {
  const maturityCutoffDate = shiftIsoDateByDays(params.referenceDate, -params.maturityDays);

  return params.rows
    .filter(
      (row) =>
        !params.completedConsultPhones.has(row.normalizedPhone) &&
        row.firstTestDate >= params.range.startDate &&
        row.firstTestDate <= params.range.endDate,
    )
    .map((row) => {
      const allOrders = (params.ordersByPhone.get(row.normalizedPhone) ?? []).filter(
        (order) => order.orderDate >= row.firstTestDate,
      );
      const revenueWindowEnd = shiftIsoDateByDays(row.firstTestDate, params.maturityDays);
      const matured = row.firstTestDate <= maturityCutoffDate;
      const revenueWithinWindow = allOrders
        .filter((order) => order.orderDate < revenueWindowEnd)
        .reduce((sum, order) => sum + order.netRevenue, 0);

      return {
        normalizedPhone: row.normalizedPhone,
        firstTestDate: row.firstTestDate,
        reportTypes: row.reportTypes,
        matured,
        converted: matured && revenueWithinWindow > 0,
        revenueWithinWindow: matured ? revenueWithinWindow : 0,
      } satisfies BaselineCustomer;
    });
};

const computeBaselineStats = (params: {
  baselineCustomers: BaselineCustomer[];
  consultationCustomers: CohortCustomer[];
  baselineScope: CallpriceBaselineScope;
}) => {
  const maturedBaselineCustomers = params.baselineCustomers.filter((customer) => customer.matured);
  const globalAvgRevenuePerCustomer = toRoundedAverage(
    maturedBaselineCustomers.reduce((sum, customer) => sum + customer.revenueWithinWindow, 0),
    maturedBaselineCustomers.length,
  );
  const fallbackNotes: string[] = [];
  const avgRevenueByAnalysisType = new Map<string, number>();
  const allConsultationAnalysisTypes = uniqueStrings(
    params.consultationCustomers.flatMap((customer) => customer.analysisTypes),
  );

  for (const analysisType of allConsultationAnalysisTypes) {
    const mappedReportTypes = mapAnalysisTypesToReportTypes([analysisType]);

    if (mappedReportTypes.length === 0) {
      avgRevenueByAnalysisType.set(analysisType, globalAvgRevenuePerCustomer);
      if (params.baselineScope === "analysis_type_non_consultation") {
        fallbackNotes.push(`'${analysisType}' 비교군 매핑이 없어 전체 미상담 비교군 평균으로 대체했습니다.`);
      }
      continue;
    }

    const matchedCustomers = maturedBaselineCustomers.filter((customer) =>
      customer.reportTypes.some((reportType) => mappedReportTypes.includes(reportType)),
    );

    if (matchedCustomers.length === 0) {
      avgRevenueByAnalysisType.set(analysisType, globalAvgRevenuePerCustomer);
      if (params.baselineScope === "analysis_type_non_consultation") {
        fallbackNotes.push(`'${analysisType}' 비교군 표본이 없어 전체 미상담 비교군 평균으로 대체했습니다.`);
      }
      continue;
    }

    avgRevenueByAnalysisType.set(
      analysisType,
      toRoundedAverage(
        matchedCustomers.reduce((sum, customer) => sum + customer.revenueWithinWindow, 0),
        matchedCustomers.length,
      ),
    );
  }

  if (params.baselineScope === "analysis_type_non_consultation" && allConsultationAnalysisTypes.length === 0) {
    fallbackNotes.push("분석유형 필터가 비어 있어 전체 미상담 비교군 평균을 사용했습니다.");
  }

  return {
    globalAvgRevenuePerCustomer,
    totalCustomers: params.baselineCustomers.length,
    maturedCustomers: maturedBaselineCustomers.length,
    convertedCustomers: maturedBaselineCustomers.filter((customer) => customer.converted).length,
    avgRevenueByAnalysisType,
    fallbackNotes: uniqueStrings(fallbackNotes),
  } satisfies BaselineStats;
};

const resolveCustomerBaselineAverage = (params: {
  baselineScope: CallpriceBaselineScope;
  baselineStats: BaselineStats;
  customer: Pick<CohortCustomer, "analysisTypes">;
}) => {
  if (params.baselineScope === "global_non_consultation") {
    return params.baselineStats.globalAvgRevenuePerCustomer;
  }

  if (params.customer.analysisTypes.length === 0) {
    return params.baselineStats.globalAvgRevenuePerCustomer;
  }

  const values = params.customer.analysisTypes.map(
    (analysisType) =>
      params.baselineStats.avgRevenueByAnalysisType.get(analysisType) ??
      params.baselineStats.globalAvgRevenuePerCustomer,
  );

  return toRoundedAverage(values.reduce((sum, value) => sum + value, 0), values.length);
};

const computeCohortSummary = (params: {
  completedConsultations: number;
  customers: CohortCustomer[];
  baselineScope: CallpriceBaselineScope;
  baselineStats: BaselineStats;
}) => {
  const matchedOrderCustomers = params.customers.filter((customer) => customer.matchedOrderCustomer).length;
  const maturedCustomers = params.customers.filter((customer) => customer.matured);
  const maturedCustomerCount = maturedCustomers.length;
  const convertedCustomers = maturedCustomers.filter((customer) => customer.converted).length;
  const totalRevenue = maturedCustomers.reduce((sum, customer) => sum + customer.revenueWithinWindow, 0);
  const totalBaselineRevenue = maturedCustomers.reduce(
    (sum, customer) =>
      sum +
      resolveCustomerBaselineAverage({
        baselineScope: params.baselineScope,
        baselineStats: params.baselineStats,
        customer,
      }),
    0,
  );
  const estimatedIncrementalRevenue = Math.round(totalRevenue - totalBaselineRevenue);
  const avgRevenuePerCustomer = toRoundedAverage(totalRevenue, maturedCustomerCount);
  const baselineAvgRevenuePerCustomer = toRoundedAverage(totalBaselineRevenue, maturedCustomerCount);

  return {
    completed_consultations: params.completedConsultations,
    unique_completed_customers: params.customers.length,
    matched_order_customers: matchedOrderCustomers,
    matured_customers: maturedCustomerCount,
    converted_customers: convertedCustomers,
    conversion_rate: toRate(convertedCustomers, maturedCustomerCount),
    avg_revenue_per_customer: avgRevenuePerCustomer,
    baseline_avg_revenue_per_customer: baselineAvgRevenuePerCustomer,
    estimated_incremental_value_per_customer: toRoundedAverage(
      estimatedIncrementalRevenue,
      maturedCustomerCount,
    ),
    estimated_incremental_revenue: estimatedIncrementalRevenue,
    estimated_value_per_consultation: toRoundedAverage(
      estimatedIncrementalRevenue,
      params.completedConsultations,
    ),
  } satisfies CohortSummary;
};

const aggregateRampupRows = <TIndex extends number>(
  rows: RampupSegmentInternal<TIndex>[],
  window: RampupWindowDefinition<TIndex>,
): CallpriceRampupSegmentSummaryRow<TIndex> => {
  const bucket = rows.filter((row) => row.segment_index === window.segment_index);
  const completedConsultations = bucket.reduce(
    (sum, row) => sum + row.completed_consultations,
    0,
  );
  const uniqueCompletedCustomers = bucket.reduce(
    (sum, row) => sum + row.unique_completed_customers,
    0,
  );
  const matchedOrderCustomers = bucket.reduce(
    (sum, row) => sum + row.matched_order_customers,
    0,
  );
  const maturedCustomers = bucket.reduce((sum, row) => sum + row.matured_customers, 0);
  const convertedCustomers = bucket.reduce((sum, row) => sum + row.converted_customers, 0);
  const totalRevenue = bucket.reduce((sum, row) => sum + row.total_revenue, 0);
  const totalBaselineRevenue = bucket.reduce((sum, row) => sum + row.total_baseline_revenue, 0);
  const estimatedIncrementalRevenue = Math.round(totalRevenue - totalBaselineRevenue);
  const warning = deriveSampleWarning(maturedCustomers, convertedCustomers);

  return {
    segment_index: window.segment_index,
    segment_label: window.segment_label,
    start_day_offset: window.start_day_offset,
    end_day_offset: window.end_day_offset,
    manager_count: uniqueStrings(bucket.map((row) => row.manager)).length,
    matured_manager_count: uniqueStrings(
      bucket
        .filter((row) => row.matured_customers > 0)
        .map((row) => row.manager),
    ).length,
    manager_names: uniqueStrings(bucket.map((row) => row.manager)).sort((a, b) =>
      a.localeCompare(b, "ko"),
    ),
    completed_consultations: completedConsultations,
    unique_completed_customers: uniqueCompletedCustomers,
    matched_order_customers: matchedOrderCustomers,
    matured_customers: maturedCustomers,
    converted_customers: convertedCustomers,
    conversion_rate: toRate(convertedCustomers, maturedCustomers),
    avg_revenue_per_customer: toRoundedAverage(totalRevenue, maturedCustomers),
    baseline_avg_revenue_per_customer: toRoundedAverage(totalBaselineRevenue, maturedCustomers),
    estimated_incremental_value_per_customer: toRoundedAverage(
      estimatedIncrementalRevenue,
      maturedCustomers,
    ),
    estimated_incremental_revenue: estimatedIncrementalRevenue,
    estimated_value_per_consultation: toRoundedAverage(
      estimatedIncrementalRevenue,
      completedConsultations,
    ),
    ...warning,
  };
};

const toMonthlySummaryRow = (
  row: CallpriceRampupSegmentSummaryRow<CallpriceRampupMonth>,
): CallpriceRampupSummaryRow => ({
  month_index: row.segment_index,
  month_label: row.segment_label,
  start_day_offset: row.start_day_offset,
  end_day_offset: row.end_day_offset,
  manager_count: row.manager_count,
  matured_manager_count: row.matured_manager_count,
  manager_names: row.manager_names,
  sample_warning: row.sample_warning,
  sample_size_grade: row.sample_size_grade,
  sample_warning_reason: row.sample_warning_reason,
  completed_consultations: row.completed_consultations,
  unique_completed_customers: row.unique_completed_customers,
  matched_order_customers: row.matched_order_customers,
  matured_customers: row.matured_customers,
  converted_customers: row.converted_customers,
  conversion_rate: row.conversion_rate,
  avg_revenue_per_customer: row.avg_revenue_per_customer,
  baseline_avg_revenue_per_customer: row.baseline_avg_revenue_per_customer,
  estimated_incremental_value_per_customer: row.estimated_incremental_value_per_customer,
  estimated_incremental_revenue: row.estimated_incremental_revenue,
  estimated_value_per_consultation: row.estimated_value_per_consultation,
});

const toMonthlyManagerRow = (
  row: Omit<RampupSegmentInternal<CallpriceRampupMonth>, "total_revenue" | "total_baseline_revenue">,
): CallpriceRampupManagerRow => ({
  manager: row.manager,
  month_index: row.segment_index,
  month_label: row.segment_label,
  start_day_offset: row.start_day_offset,
  end_day_offset: row.end_day_offset,
  first_observed_completed_date: row.first_observed_completed_date,
  window_start_date: row.window_start_date,
  window_end_date: row.window_end_date,
  baseline_matured_customers: row.baseline_matured_customers,
  legacy_assumption: row.legacy_assumption,
  legacy_assumption_reason: row.legacy_assumption_reason,
  sample_warning: row.sample_warning,
  sample_size_grade: row.sample_size_grade,
  sample_warning_reason: row.sample_warning_reason,
  completed_consultations: row.completed_consultations,
  unique_completed_customers: row.unique_completed_customers,
  matched_order_customers: row.matched_order_customers,
  matured_customers: row.matured_customers,
  converted_customers: row.converted_customers,
  conversion_rate: row.conversion_rate,
  avg_revenue_per_customer: row.avg_revenue_per_customer,
  baseline_avg_revenue_per_customer: row.baseline_avg_revenue_per_customer,
  estimated_incremental_value_per_customer: row.estimated_incremental_value_per_customer,
  estimated_incremental_revenue: row.estimated_incremental_revenue,
  estimated_value_per_consultation: row.estimated_value_per_consultation,
});

const buildRampupSegmentItems = <TIndex extends number>(params: {
  windows: RampupWindowDefinition<TIndex>[];
  allCompletedRows: CompletedConsultationRow[];
  baselineRows: BaselineCustomerRow[];
  completedConsultPhones: Set<string>;
  ordersByPhone: Map<string, OrderRow[]>;
  maturityDays: CallpriceMaturityDays;
  baselineScope: CallpriceBaselineScope;
  referenceDate: string;
}) => {
  const managerFirstObservedDate = new Map<string, string>();
  const rowsByManager = new Map<string, CompletedConsultationRow[]>();

  for (const row of params.allCompletedRows) {
    if (!managerFirstObservedDate.has(row.manager)) {
      managerFirstObservedDate.set(row.manager, row.consultationDate);
    }

    const bucket = rowsByManager.get(row.manager) ?? [];
    bucket.push(row);
    rowsByManager.set(row.manager, bucket);
  }

  return Array.from(managerFirstObservedDate.entries())
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], "ko"))
    .flatMap(([manager, firstObservedCompletedDate]) => {
      const managerRows = rowsByManager.get(manager) ?? [];

      return params.windows.flatMap((window) => {
        const windowStartDate = shiftIsoDateByDays(firstObservedCompletedDate, window.start_day_offset);
        const windowEndDate = shiftIsoDateByDays(firstObservedCompletedDate, window.end_day_offset);
        const segmentRows = managerRows.filter(
          (row) =>
            row.consultationDate >= windowStartDate && row.consultationDate <= windowEndDate,
        );

        if (segmentRows.length === 0) return [];

        const consultationCohort = buildConsultationCohort({
          rows: segmentRows,
          maturityDays: params.maturityDays,
          referenceDate: params.referenceDate,
          ordersByPhone: params.ordersByPhone,
        });
        const baselineCustomers = buildBaselineCohort({
          rows: params.baselineRows,
          completedConsultPhones: params.completedConsultPhones,
          range: {
            startDate: windowStartDate,
            endDate: windowEndDate,
          },
          maturityDays: params.maturityDays,
          referenceDate: params.referenceDate,
          ordersByPhone: params.ordersByPhone,
        });
        const baselineStats = computeBaselineStats({
          baselineCustomers,
          consultationCustomers: consultationCohort.customers,
          baselineScope: params.baselineScope,
        });
        const summary = computeCohortSummary({
          completedConsultations: consultationCohort.rows.length,
          customers: consultationCohort.customers,
          baselineScope: params.baselineScope,
          baselineStats,
        });
        const warning = deriveSampleWarning(
          summary.matured_customers,
          summary.converted_customers,
        );
        const totalRevenue = summary.avg_revenue_per_customer * summary.matured_customers;
        const totalBaselineRevenue =
          summary.baseline_avg_revenue_per_customer * summary.matured_customers;
        const legacyAssumption = CALLPRICE_RAMPUP_LEGACY_MANAGER_SET.has(manager);
        const knownHireDate = CALLPRICE_MANAGER_HIRE_DATE_OVERRIDES.get(manager);
        const missingRampDays = knownHireDate
          ? diffIsoDatesInDays(knownHireDate, firstObservedCompletedDate)
          : 0;

        return {
          manager,
          segment_index: window.segment_index,
          segment_label: window.segment_label,
          start_day_offset: window.start_day_offset,
          end_day_offset: window.end_day_offset,
          first_observed_completed_date: firstObservedCompletedDate,
          window_start_date: windowStartDate,
          window_end_date: windowEndDate,
          baseline_matured_customers: baselineStats.maturedCustomers,
          legacy_assumption: legacyAssumption,
          legacy_assumption_reason: legacyAssumption
            ? knownHireDate
              ? `실제 입사일 ${knownHireDate} 대비 DB 첫 완료 상담일 ${firstObservedCompletedDate}가 늦어 초기 ${missingRampDays}일 구간이 비어 있습니다.`
              : "DB 첫 완료 상담일이 실제 입사일보다 늦을 수 있어 초기 랜딩 비교가 왜곡될 수 있습니다."
            : null,
          ...summary,
          ...warning,
          total_revenue: totalRevenue,
          total_baseline_revenue: totalBaselineRevenue,
        } satisfies RampupSegmentInternal<TIndex>;
      });
    });
};

const buildProbationGuides = (): CallpriceProbationGuide[] => [
  {
    checkpoint_label: "5주차",
    maturity_days: 30,
    minimum: {
      completed_consultations: 90,
      conversion_rate: 0.18,
      value_per_consultation: 30_000,
    },
    typical: {
      completed_consultations: 105,
      conversion_rate: 0.22,
      value_per_consultation: 50_000,
    },
    strong: {
      completed_consultations: 120,
      conversion_rate: 0.24,
      value_per_consultation: 70_000,
    },
    note: "5주차 평가는 90일 LTR 대신 30일 기준으로 본다. 표본이 작아도 완료 상담 수와 초기 구매 전환이 같이 나와야 한다.",
  },
  {
    checkpoint_label: "10주차",
    maturity_days: 30,
    minimum: {
      completed_consultations: 200,
      conversion_rate: 0.18,
      value_per_consultation: 50_000,
    },
    typical: {
      completed_consultations: 220,
      conversion_rate: 0.22,
      value_per_consultation: 70_000,
    },
    strong: {
      completed_consultations: 240,
      conversion_rate: 0.27,
      value_per_consultation: 90_000,
    },
    note: "10주차 평가는 채용 전환 판단용이다. 최소 기준 미달이면 채용 전환 보류 검토, 보통 이상이면 전환 검토, 잘함이면 핵심 육성 대상으로 본다.",
  },
];

export const deriveSampleWarning = (maturedCustomers: number, convertedCustomers: number) => {
  const lowMatured = maturedCustomers < 30;
  const lowConverted = convertedCustomers < 5;

  if (lowMatured && lowConverted) {
    return {
      sample_warning: true,
      sample_size_grade: "small" as const,
      sample_warning_reason: "matured_customers<30, converted_customers<5",
    };
  }

  if (lowMatured || lowConverted) {
    return {
      sample_warning: true,
      sample_size_grade: "watch" as const,
      sample_warning_reason: lowMatured ? "matured_customers<30" : "converted_customers<5",
    };
  }

  return {
    sample_warning: false,
    sample_size_grade: "stable" as const,
    sample_warning_reason: null,
  };
};

const sortManagerRows = (
  rows: CallpriceManagersRow[],
  sortBy: CallpriceManagerSortField,
  sortOrder: "asc" | "desc",
) => {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = toNumber(a[sortBy]);
    const right = toNumber(b[sortBy]);
    if (left !== right) return direction * (left - right);
    return a.manager.localeCompare(b.manager, "ko");
  });
};

const loadCallpriceContext = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    analysisType?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    referenceDate: string;
  },
  runner: QueryRunner = queryPg,
) => {
  const [consultationRows, completedConsultPhones, baselineRows] = await Promise.all([
    fetchCompletedConsultationRows(
      {
        range: params.range,
        manager: params.manager,
      },
      runner,
    ),
    fetchCompletedConsultPhones(runner),
    fetchBaselineCustomerRows(runner),
  ]);

  const filteredConsultationRows = params.analysisType
    ? consultationRows.filter((row) => containsAnalysisType(row.rawAnalysisType, params.analysisType ?? ""))
    : consultationRows;
  const consultationPhones = uniqueStrings(
    filteredConsultationRows.map((row) => normalizeCallpricePhone(row.customerContact)),
  );
  const baselineCandidates = baselineRows.filter(
    (row) =>
      !completedConsultPhones.has(row.normalizedPhone) &&
      row.firstTestDate >= params.range.startDate &&
      row.firstTestDate <= params.range.endDate,
  );
  const baselinePhones = uniqueStrings(baselineCandidates.map((row) => row.normalizedPhone));
  const minConsultationAnchor = filteredConsultationRows[0]?.consultationDate ?? params.range.startDate;
  const minBaselineAnchor =
    baselineCandidates
      .map((row) => row.firstTestDate)
      .sort((a, b) => a.localeCompare(b))[0] ?? params.range.startDate;
  const [consultationOrdersByPhone, baselineOrdersByPhone] = await Promise.all([
    fetchOrdersByPhones(consultationPhones, minConsultationAnchor, runner),
    fetchOrdersByPhones(baselinePhones, minBaselineAnchor, runner),
  ]);

  const consultationCohort = buildConsultationCohort({
    rows: consultationRows,
    analysisType: params.analysisType,
    maturityDays: params.maturityDays,
    referenceDate: params.referenceDate,
    ordersByPhone: consultationOrdersByPhone,
  });
  const baselineCustomers = buildBaselineCohort({
    rows: baselineRows,
    completedConsultPhones,
    range: params.range,
    maturityDays: params.maturityDays,
    referenceDate: params.referenceDate,
    ordersByPhone: baselineOrdersByPhone,
  });
  const baselineStats = computeBaselineStats({
    baselineCustomers,
    consultationCustomers: consultationCohort.customers,
    baselineScope: params.baselineScope,
  });

  return {
    consultationCohort,
    baselineCustomers,
    baselineStats,
  };
};

export const fetchCallpriceOptions = async (
  runner: QueryRunner = queryPg,
): Promise<CallpriceEnvelope<CallpriceOptionsData, { source: string }>> => {
  const result = await runner<{
    manager: string;
    raw_analysis_type: string;
  }>(
    `
      select
        coalesce(nullif(trim(manager), ''), '미지정') as manager,
        coalesce(nullif(trim(analysis_type), ''), '미분류') as raw_analysis_type
      from public.tb_consultation_records
      where ${COMPLETED_STATUS_SQL}
    `,
  );

  const managerCounts = new Map<string, number>();
  const analysisTypeCounts = new Map<string, number>();

  for (const row of result.rows) {
    const normalizedManager = normalizeCallpriceManager(row.manager);
    managerCounts.set(normalizedManager, (managerCounts.get(normalizedManager) ?? 0) + 1);
    for (const analysisType of splitAnalysisTypes(row.raw_analysis_type)) {
      analysisTypeCounts.set(analysisType, (analysisTypeCounts.get(analysisType) ?? 0) + 1);
    }
  }

  return {
    status: "success",
    data: {
      manager_options: ["전체", ...sortStringsByCountThenLabel(managerCounts)],
      analysis_type_options: ["전체", ...sortStringsByCountThenLabel(analysisTypeCounts)],
      baseline_scope_options: [
        { value: "global_non_consultation", label: "전체 미상담 비교군" },
        { value: "analysis_type_non_consultation", label: "분석유형별 미상담 비교군" },
      ],
      maturity_day_options: [...CALLPRICE_MATURITY_DAYS],
    },
    meta: {
      source: "tb_consultation_records",
    },
    notes: buildNotes([
      "분석유형 옵션은 상담 기록의 analysis_type 문자열을 쉼표 기준으로 분해해 구성했습니다.",
    ]),
  };
};

export const fetchCallpriceOverview = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    analysisType?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceOverviewData,
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      comparison_unit: string;
      reference_date: string;
      baseline_customers: number;
      baseline_matured_customers: number;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const context = await loadCallpriceContext(
    {
      ...params,
      referenceDate,
    },
    runner,
  );

  const summary = computeCohortSummary({
    completedConsultations: context.consultationCohort.rows.length,
    customers: context.consultationCohort.customers,
    baselineScope: params.baselineScope,
    baselineStats: context.baselineStats,
  });

  return {
    status: "success",
    data: {
      summary,
      filters: {
        start_date: params.range.startDate,
        end_date: params.range.endDate,
        manager: trimToEmpty(params.manager) ? normalizeCallpriceManager(params.manager) : null,
        analysis_type: trimToEmpty(params.analysisType) || null,
      },
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      comparison_unit: `revenue_per_customer_${params.maturityDays}d`,
      reference_date: referenceDate,
      baseline_customers: context.baselineStats.totalCustomers,
      baseline_matured_customers: context.baselineStats.maturedCustomers,
    },
    notes: buildNotes(context.baselineStats.fallbackNotes),
  };
};

export const fetchCallpriceManagers = async (
  params: {
    range: CallpriceDateRange;
    analysisType?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    sortBy?: CallpriceManagerSortField;
    sortOrder?: "asc" | "desc";
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    { items: CallpriceManagersRow[] },
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      sort_by: CallpriceManagerSortField;
      sort_order: "asc" | "desc";
      reference_date: string;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const sortBy = params.sortBy ?? "estimated_incremental_revenue";
  const sortOrder = params.sortOrder ?? "desc";
  const context = await loadCallpriceContext(
    {
      range: params.range,
      analysisType: params.analysisType,
      maturityDays: params.maturityDays,
      baselineScope: params.baselineScope,
      referenceDate,
    },
    runner,
  );

  const totalCompletedConsultations = context.consultationCohort.rows.length;

  const managers = uniqueStrings([
    ...Array.from(context.consultationCohort.rawCountsByManager.keys()),
    ...context.consultationCohort.customers.map((customer) => customer.manager),
  ]);

  const items = managers.map((manager) => {
    const managerCustomers = context.consultationCohort.customers.filter((customer) => customer.manager === manager);
    const summary = computeCohortSummary({
      completedConsultations: context.consultationCohort.rawCountsByManager.get(manager) ?? 0,
      customers: managerCustomers,
      baselineScope: params.baselineScope,
      baselineStats: context.baselineStats,
    });
    const warning = deriveSampleWarning(summary.matured_customers, summary.converted_customers);

    return {
      manager,
      ...summary,
      ...warning,
      share_of_total_completed_consultations: toRate(
        summary.completed_consultations,
        totalCompletedConsultations,
      ),
      share_of_total_estimated_incremental_revenue: 0,
    } satisfies CallpriceManagersRow;
  });

  const totalPositiveIncrementalRevenue = items.reduce(
    (sum, item) => sum + Math.max(0, item.estimated_incremental_revenue),
    0,
  );

  const itemsWithShare = items.map((item) => ({
    ...item,
    share_of_total_estimated_incremental_revenue: toRate(
      Math.max(0, item.estimated_incremental_revenue),
      totalPositiveIncrementalRevenue,
    ),
  }));

  return {
    status: "success",
    data: {
      items: sortManagerRows(itemsWithShare, sortBy, sortOrder),
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      sort_by: sortBy,
      sort_order: sortOrder,
      reference_date: referenceDate,
    },
    notes: buildNotes(context.baselineStats.fallbackNotes),
  };
};

export const fetchCallpriceAnalysisTypes = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    { items: CallpriceAnalysisTypeRow[] },
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      reference_date: string;
      manager: string | null;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const context = await loadCallpriceContext(
    {
      range: params.range,
      manager: params.manager,
      maturityDays: params.maturityDays,
      baselineScope: params.baselineScope,
      referenceDate,
    },
    runner,
  );

  const items = Array.from(context.consultationCohort.rawCountsByAnalysisType.keys())
    .sort((a, b) => (context.consultationCohort.rawCountsByAnalysisType.get(b) ?? 0) - (context.consultationCohort.rawCountsByAnalysisType.get(a) ?? 0) || a.localeCompare(b, "ko"))
    .map((analysisType) => {
      const customers = context.consultationCohort.customers.filter((customer) =>
        customer.analysisTypes.includes(analysisType),
      );
      const summary = computeCohortSummary({
        completedConsultations: context.consultationCohort.rawCountsByAnalysisType.get(analysisType) ?? 0,
        customers,
        baselineScope: params.baselineScope,
        baselineStats: context.baselineStats,
      });
      const warning = deriveSampleWarning(summary.matured_customers, summary.converted_customers);

      return {
        analysis_type: analysisType,
        ...summary,
        ...warning,
      } satisfies CallpriceAnalysisTypeRow;
    });

  return {
    status: "success",
    data: {
      items,
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      reference_date: referenceDate,
      manager: trimToEmpty(params.manager) ? normalizeCallpriceManager(params.manager) : null,
    },
    notes: buildNotes([
      ...context.baselineStats.fallbackNotes,
      "analysis_type 집계는 상담 문자열을 쉼표 기준으로 분해해 고객 단위로 중복 포함할 수 있습니다.",
    ]),
  };
};

export const fetchCallpriceScenario = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    analysisType?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    monthlyCost: number;
    headcount: number;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    ScenarioData,
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      reference_date: string;
      period_days: number;
      manager: string | null;
      analysis_type: string | null;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const periodDays = diffIsoDatesInDays(params.range.startDate, params.range.endDate) + 1;
  const totalMonthlyCost = Math.round(params.monthlyCost * params.headcount);

  let assumedMonthlyRevenuePerHeadcount = 0;

  if (trimToEmpty(params.manager)) {
    const overview = await fetchCallpriceOverview(
      {
        range: params.range,
        manager: params.manager,
        analysisType: params.analysisType,
        maturityDays: params.maturityDays,
        baselineScope: params.baselineScope,
        referenceDate,
      },
      runner,
    );
    assumedMonthlyRevenuePerHeadcount = Math.round(
      (overview.data.summary.estimated_incremental_revenue / Math.max(1, periodDays)) * 30,
    );
  } else {
    const managers = await fetchCallpriceManagers(
      {
        range: params.range,
        analysisType: params.analysisType,
        maturityDays: params.maturityDays,
        baselineScope: params.baselineScope,
        referenceDate,
      },
      runner,
    );
    const managerRows = managers.data.items.filter((item) => item.completed_consultations > 0);
    const totalManagerPeriodRevenue = managerRows.reduce(
      (sum, item) => sum + item.estimated_incremental_revenue,
      0,
    );
    assumedMonthlyRevenuePerHeadcount = managerRows.length
      ? Math.round((totalManagerPeriodRevenue / managerRows.length / Math.max(1, periodDays)) * 30)
      : 0;
  }

  const estimatedIncrementalRevenue = assumedMonthlyRevenuePerHeadcount * params.headcount;
  const estimatedIncrementalProfit = estimatedIncrementalRevenue - totalMonthlyCost;
  const incrementalRevenueMultiple = toRate(estimatedIncrementalRevenue, totalMonthlyCost);
  const breakEvenCost = estimatedIncrementalRevenue;
  const breakEvenHeadcount = assumedMonthlyRevenuePerHeadcount
    ? Number((totalMonthlyCost / assumedMonthlyRevenuePerHeadcount).toFixed(2))
    : 0;

  return {
    status: "success",
    data: {
      headcount: params.headcount,
      monthly_cost: Math.round(params.monthlyCost),
      estimated_incremental_revenue: estimatedIncrementalRevenue,
      estimated_incremental_profit: estimatedIncrementalProfit,
      incremental_revenue_multiple: incrementalRevenueMultiple,
      break_even_cost: breakEvenCost,
      break_even_headcount: breakEvenHeadcount,
      assumed_monthly_incremental_revenue_per_headcount: assumedMonthlyRevenuePerHeadcount,
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      reference_date: referenceDate,
      period_days: periodDays,
      manager: trimToEmpty(params.manager) || null,
      analysis_type: trimToEmpty(params.analysisType) || null,
    },
    notes: buildNotes([
      "시나리오 계산은 현재 기간 성과를 월 단위로 환산한 값이며 공식 인력 계획 기준은 아닙니다.",
    ]),
  };
};

export const fetchCallpriceDayTypeComparison = async (
  params: {
    range: CallpriceDateRange;
    valueMaturityDays: CallpriceMaturityDays;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceDayTypeComparisonData,
    {
      reference_date: string;
      range: CallpriceDateRange;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const [completionRows, completedRows] = await Promise.all([
    fetchCallpriceDayTypeCompletionRows({ range: params.range }, runner),
    fetchCompletedConsultationRows({ range: params.range }, runner),
  ]);

  const phones = uniqueStrings(
    completedRows.map((row) => normalizeCallpricePhone(row.customerContact)),
  );
  const minAnchorDate = completedRows[0]?.consultationDate ?? params.range.startDate;
  const ordersByPhone = await fetchOrdersByPhones(phones, minAnchorDate, runner);
  const consultationCohort = buildConsultationCohort({
    rows: completedRows,
    maturityDays: params.valueMaturityDays,
    referenceDate,
    ordersByPhone,
  });

  const valueRows = (["weekday", "weekend"] as CallpriceDayType[]).map((dayType) => {
    const customers = consultationCohort.customers.filter(
      (customer) => classifyCallpriceDayType(customer.anchorDate) === dayType,
    );
    const maturedCustomers = customers.filter((customer) => customer.matured);
    const completedConsultations = customers.reduce(
      (sum, customer) => sum + customer.completedConsultations,
      0,
    );
    const convertedCustomers = maturedCustomers.filter((customer) => customer.converted).length;
    const totalRevenue = maturedCustomers.reduce(
      (sum, customer) => sum + customer.revenueWithinWindow,
      0,
    );
    const warning = deriveSampleWarning(maturedCustomers.length, convertedCustomers);

    return {
      day_type: dayType,
      maturity_days: params.valueMaturityDays,
      completed_consultations: completedConsultations,
      matured_customers: maturedCustomers.length,
      converted_customers: convertedCustomers,
      conversion_rate: toRate(convertedCustomers, maturedCustomers.length),
      avg_revenue_per_customer: toRoundedAverage(totalRevenue, maturedCustomers.length),
      ltr: toRoundedAverage(totalRevenue, convertedCustomers),
      value_per_completed_consultation: toRoundedAverage(totalRevenue, completedConsultations),
      total_revenue: Math.round(totalRevenue),
      ...warning,
    } satisfies CallpriceDayTypeValueRow;
  });

  const weekdayCompletion = completionRows.find((row) => row.day_type === "weekday");
  const weekendCompletion = completionRows.find((row) => row.day_type === "weekend");
  const weekdayValue = valueRows.find((row) => row.day_type === "weekday");
  const weekendValue = valueRows.find((row) => row.day_type === "weekend");
  const weekendTrackingStartDate = "2026-04-03";
  const weekend90dTrackingAvailable = referenceDate >= weekendTrackingStartDate;

  return {
    status: "success",
    data: {
      completion: completionRows,
      value: valueRows,
      comparison: {
        value_maturity_days: params.valueMaturityDays,
        weekend_completion_rate_diff: Number(
          (
            (weekendCompletion?.completion_rate ?? 0) -
            (weekdayCompletion?.completion_rate ?? 0)
          ).toFixed(3),
        ),
        weekend_conversion_rate_diff: Number(
          (((weekendValue?.conversion_rate ?? 0) - (weekdayValue?.conversion_rate ?? 0)).toFixed(3)),
        ),
        weekend_avg_revenue_per_customer_diff:
          (weekendValue?.avg_revenue_per_customer ?? 0) -
          (weekdayValue?.avg_revenue_per_customer ?? 0),
        weekend_avg_revenue_per_customer_multiple: toRate(
          weekendValue?.avg_revenue_per_customer ?? 0,
          weekdayValue?.avg_revenue_per_customer ?? 0,
        ),
        weekend_value_per_completed_consultation_diff:
          (weekendValue?.value_per_completed_consultation ?? 0) -
          (weekdayValue?.value_per_completed_consultation ?? 0),
        weekend_value_per_completed_consultation_multiple: toRate(
          weekendValue?.value_per_completed_consultation ?? 0,
          weekdayValue?.value_per_completed_consultation ?? 0,
        ),
        weekend_ltr_diff: (weekendValue?.ltr ?? 0) - (weekdayValue?.ltr ?? 0),
        weekend_90d_tracking_available: weekend90dTrackingAvailable,
        weekend_90d_tracking_available_from: weekend90dTrackingAvailable
          ? weekendTrackingStartDate
          : weekendTrackingStartDate,
      },
    },
    meta: {
      reference_date: referenceDate,
      range: params.range,
    },
    notes: buildNotes([
      `평일/주말 가치 비교는 ${params.valueMaturityDays}일 proxy 기준입니다.`,
      "예약 -> 완료 전환율은 consultation_date 기준 전체 상담 건수로 계산했습니다.",
      "상담 후 구매전환율/가치는 최초 완료 상담일 기준 고유 고객 cohort로 계산했습니다.",
      "주말 최초 완료 상담 고객은 2026-01-03부터 발생해 90일 비교는 아직 표본이 부족합니다.",
    ]),
  };
};

export const fetchCallpriceSupplementPurchaseTiming = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    analysisType?: string;
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceSupplementTimingData,
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      reference_date: string;
      filters: {
        start_date: string;
        end_date: string;
        manager: string | null;
        analysis_type: string | null;
      };
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const context = await loadCallpriceContext(
    {
      range: params.range,
      manager: params.manager,
      analysisType: params.analysisType,
      maturityDays: params.maturityDays,
      baselineScope: params.baselineScope,
      referenceDate,
    },
    runner,
  );

  const consultationPhones = uniqueStrings(
    context.consultationCohort.customers.map((customer) => customer.normalizedPhone),
  );
  const minAnchorDate =
    context.consultationCohort.customers
      .map((customer) => customer.anchorDate)
      .sort((a, b) => a.localeCompare(b))[0] ?? params.range.startDate;
  const ordersWithProductsByPhone = await fetchOrdersWithProductsByPhones(
    consultationPhones,
    minAnchorDate,
    runner,
  );

  const maturedCustomers = context.consultationCohort.customers.filter((customer) => customer.matured);
  const firstSupplementPurchaseOffsets = maturedCustomers
    .map((customer) => {
      const firstSupplementOrder = (ordersWithProductsByPhone.get(customer.normalizedPhone) ?? [])
        .filter(
          (order) =>
            order.productCategory === "supplement" && order.orderDate >= customer.anchorDate,
        )
        .sort((a, b) => a.orderDate.localeCompare(b.orderDate))[0];

      if (!firstSupplementOrder) return null;
      return diffIsoDatesInDays(customer.anchorDate, firstSupplementOrder.orderDate);
    })
    .filter((value): value is number => value != null && value >= 0);

  const supplementBuyers = firstSupplementPurchaseOffsets.length;
  const buckets = CALLPRICE_SUPPLEMENT_TIMING_BUCKETS.map((bucket) => {
    const customerCount = firstSupplementPurchaseOffsets.filter((offset) =>
      bucket.max_day_offset == null
        ? offset >= bucket.min_day_offset
        : offset >= bucket.min_day_offset && offset <= bucket.max_day_offset,
    ).length;

    return {
      bucket_key: bucket.bucket_key,
      label: bucket.label,
      min_day_offset: bucket.min_day_offset,
      max_day_offset: bucket.max_day_offset,
      customer_count: customerCount,
      share_of_supplement_buyers: toRate(customerCount, supplementBuyers),
      share_of_matured_consultation_customers: toRate(customerCount, maturedCustomers.length),
    } satisfies CallpriceSupplementTimingBucketRow;
  });

  return {
    status: "success",
    data: {
      cohort: {
        completed_consultations: context.consultationCohort.rows.length,
        unique_completed_customers: context.consultationCohort.customers.length,
        matured_customers: maturedCustomers.length,
        supplement_buyers: supplementBuyers,
        no_supplement_purchase_customers: Math.max(0, maturedCustomers.length - supplementBuyers),
        supplement_conversion_rate: toRate(supplementBuyers, maturedCustomers.length),
      },
      buckets,
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      reference_date: referenceDate,
      filters: {
        start_date: params.range.startDate,
        end_date: params.range.endDate,
        manager: trimToEmpty(params.manager) ? normalizeCallpriceManager(params.manager) : null,
        analysis_type: trimToEmpty(params.analysisType) || null,
      },
    },
    notes: buildNotes([
      "영양제 구매 시점은 첫 완료 상담일 이후의 첫 영양제 주문일을 기준으로 계산했습니다.",
      "구간은 서로 겹치지 않게 상담 당일, 1~3일, 4~7일, 8~14일, 15~30일, 31일 이후로 나눴습니다.",
      "비중은 '영양제 구매 고객 내 비중'과 '성숙 상담 고객 전체 대비 비중' 두 가지로 봅니다.",
      `${params.maturityDays}일 이상 지난 성숙 상담 고객만 포함해 최근 상담의 관찰 부족을 줄였습니다.`,
    ]),
  };
};

export const fetchCallpriceSupplementRepeatPattern = async (
  params: {
    range: CallpriceDateRange;
    manager?: string;
    analysisType?: string;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceSupplementRepeatPatternData,
    {
      reference_date: string;
      observation_days: number;
      filters: {
        start_date: string;
        end_date: string;
        manager: string | null;
        analysis_type: string | null;
      };
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const context = await loadCallpriceContext(
    {
      range: params.range,
      manager: params.manager,
      analysisType: params.analysisType,
      maturityDays: 365,
      baselineScope: "global_non_consultation",
      referenceDate,
    },
    runner,
  );

  const consultationPhones = uniqueStrings(
    context.consultationCohort.customers.map((customer) => customer.normalizedPhone),
  );
  const minAnchorDate =
    context.consultationCohort.customers
      .map((customer) => customer.anchorDate)
      .sort((a, b) => a.localeCompare(b))[0] ?? params.range.startDate;
  const ordersWithProductsByPhone = await fetchOrdersWithProductsByPhones(
    consultationPhones,
    minAnchorDate,
    runner,
  );
  const firstSupplementCutoffDate = shiftIsoDateByDays(
    referenceDate,
    -CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS,
  );

  const supplementStarterItems = context.consultationCohort.customers
    .map((customer) => {
      const supplementOrders = (ordersWithProductsByPhone.get(customer.normalizedPhone) ?? [])
        .filter(
          (order) =>
            order.productCategory === "supplement" && order.orderDate >= customer.anchorDate,
        )
        .sort((a, b) => a.orderDate.localeCompare(b.orderDate));
      const firstSupplementOrder = supplementOrders[0];
      if (!firstSupplementOrder) return null;

      const maturedStarter =
        firstSupplementOrder.orderDate <= firstSupplementCutoffDate;
      const repeatWindowEnd = shiftIsoDateByDays(
        firstSupplementOrder.orderDate,
        CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS,
      );
      const ordersWithinWindow = maturedStarter
        ? supplementOrders.filter(
            (order) =>
              order.orderDate >= firstSupplementOrder.orderDate &&
              order.orderDate < repeatWindowEnd,
          )
        : [];
      const totalOrdersWithinWindow = ordersWithinWindow.length;

      return {
        normalizedPhone: customer.normalizedPhone,
        first_supplement_date: firstSupplementOrder.orderDate,
        maturedStarter,
        total_orders_within_1y: totalOrdersWithinWindow,
        repeat_orders_within_1y: Math.max(0, totalOrdersWithinWindow - 1),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const maturedStarters = supplementStarterItems.filter((item) => item.maturedStarter);
  const sortedOrderCounts = maturedStarters
    .map((item) => item.total_orders_within_1y)
    .sort((a, b) => a - b);
  const buckets = CALLPRICE_SUPPLEMENT_REPEAT_BUCKETS.map((bucket) => {
    const customerCount = maturedStarters.filter((item) =>
      bucket.max_total_orders == null
        ? item.total_orders_within_1y >= bucket.min_total_orders
        : item.total_orders_within_1y >= bucket.min_total_orders &&
          item.total_orders_within_1y <= bucket.max_total_orders,
    ).length;

    return {
      bucket_key: bucket.bucket_key,
      label: bucket.label,
      min_total_orders: bucket.min_total_orders,
      max_total_orders: bucket.max_total_orders,
      customer_count: customerCount,
      share_of_matured_starters: toRate(customerCount, maturedStarters.length),
    } satisfies CallpriceSupplementRepeatBucketRow;
  });

  return {
    status: "success",
    data: {
      cohort: {
        completed_consultation_customers: context.consultationCohort.customers.length,
        supplement_starter_customers: supplementStarterItems.length,
        matured_supplement_starter_customers: maturedStarters.length,
        excluded_recent_starters: Math.max(0, supplementStarterItems.length - maturedStarters.length),
      },
      summary: {
        observation_days: CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS,
        avg_total_orders_within_1y: Number(
          (
            maturedStarters.reduce((sum, item) => sum + item.total_orders_within_1y, 0) /
            Math.max(1, maturedStarters.length)
          ).toFixed(3),
        ),
        avg_repeat_orders_within_1y: Number(
          (
            maturedStarters.reduce((sum, item) => sum + item.repeat_orders_within_1y, 0) /
            Math.max(1, maturedStarters.length)
          ).toFixed(3),
        ),
        repeat_purchase_rate_2plus: toRate(
          maturedStarters.filter((item) => item.total_orders_within_1y >= 2).length,
          maturedStarters.length,
        ),
        repeat_purchase_rate_3plus: toRate(
          maturedStarters.filter((item) => item.total_orders_within_1y >= 3).length,
          maturedStarters.length,
        ),
        repeat_purchase_rate_4plus: toRate(
          maturedStarters.filter((item) => item.total_orders_within_1y >= 4).length,
          maturedStarters.length,
        ),
        loyal_rate_6plus: toRate(
          maturedStarters.filter((item) => item.total_orders_within_1y >= 6).length,
          maturedStarters.length,
        ),
        p50_total_orders_within_1y: percentileFromSortedNumbers(sortedOrderCounts, 0.5),
        p75_total_orders_within_1y: percentileFromSortedNumbers(sortedOrderCounts, 0.75),
        p90_total_orders_within_1y: percentileFromSortedNumbers(sortedOrderCounts, 0.9),
      },
      buckets,
    },
    meta: {
      reference_date: referenceDate,
      observation_days: CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS,
      filters: {
        start_date: params.range.startDate,
        end_date: params.range.endDate,
        manager: trimToEmpty(params.manager) ? normalizeCallpriceManager(params.manager) : null,
        analysis_type: trimToEmpty(params.analysisType) || null,
      },
    },
    notes: buildNotes([
      "재구매 패턴은 첫 완료 상담 이후 첫 영양제 구매가 발생한 고객만 대상으로 계산했습니다.",
      `첫 영양제 구매일 기준 ${CALLPRICE_SUPPLEMENT_REPEAT_WINDOW_DAYS}일을 온전히 관찰할 수 있는 고객만 재구매 분포에 포함했습니다.`,
      "총 구매 횟수는 첫 영양제 구매 1회를 포함한 수치이며, 추가 재구매 횟수는 첫 구매를 제외한 횟수입니다.",
    ]),
  };
};

export const fetchCallpriceSubscriptionStatus = async (
  params: {
    referenceDate?: string;
  } = {},
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceSubscriptionStatusData,
    {
      reference_date: string;
      source: string;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();

  const subscriptionTableQuery = await runner<{ table_name: string }>(
    `
      select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on c.table_schema = t.table_schema
       and c.table_name = t.table_name
      where c.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and (
          lower(c.table_name) like '%subscription%'
          or lower(c.table_name) like '%subscribe%'
          or lower(c.column_name) like '%subscription%'
          or lower(c.column_name) like '%subscribe%'
          or lower(c.column_name) like '%recurr%'
          or c.column_name like '%구독%'
        )
      order by c.table_name
    `,
  );

  const subscriptionSnapshotQuery = await runner<{
    valid_subscription_order_rows: number | string;
    distinct_subscription_order_customers: number | string;
    latest_subscription_order_date: string | null;
  }>(
    `
      select
        count(*) filter (
          where product_name like '%정기%'
            and coalesce(cancellation_reason, 'nan') = 'nan'
            and coalesce(return_reason, 'nan') = 'nan'
        ) as valid_subscription_order_rows,
        count(distinct customer_number) filter (
          where product_name like '%정기%'
            and coalesce(cancellation_reason, 'nan') = 'nan'
            and coalesce(return_reason, 'nan') = 'nan'
        ) as distinct_subscription_order_customers,
        to_char(
          max(order_date::timestamp) filter (
            where product_name like '%정기%'
              and coalesce(cancellation_reason, 'nan') = 'nan'
              and coalesce(return_reason, 'nan') = 'nan'
          ),
          'YYYY-MM-DD HH24:MI:SS'
        ) as latest_subscription_order_date
      from public.tb_iamweb_users
    `,
  );

  const latestMonthQuery = await runner<{
    latest_month_label: string | null;
    latest_month_subscription_customers: number | string;
  }>(
    `
      with monthly as (
        select
          to_char(date_trunc('month', order_date::timestamp), 'YYYY-MM') as latest_month_label,
          count(distinct customer_number) as latest_month_subscription_customers
        from public.tb_iamweb_users
        where product_name like '%정기%'
          and coalesce(cancellation_reason, 'nan') = 'nan'
          and coalesce(return_reason, 'nan') = 'nan'
        group by 1
        order by 1 desc
        limit 1
      )
      select
        latest_month_label,
        latest_month_subscription_customers
      from monthly
    `,
  );

  const conversionQuery = await runner<{
    period_label: string;
    non_sub_customers: number | string;
    converted_customers: number | string;
    conversion_percentage: number | string;
  }>(
    `
      select
        period_label,
        non_sub_customers,
        converted_customers,
        conversion_percentage
      from public.vw_subscription_conversion_ratio
      order by case period_label
        when '6개월' then 1
        when '1년' then 2
        when '2년' then 3
        when '전체 기간' then 4
        else 5
      end
    `,
  );

  const supplementRatioQuery = await runner<{
    period_label: string;
    subscription_ratio_percentage: number | string;
    total_supplement_sales: number | string;
    subscription_supplement_sales: number | string;
    non_subscription_supplement_sales: number | string;
  }>(
    `
      select
        period_label,
        subscription_ratio_percentage,
        total_supplement_sales,
        subscription_supplement_sales,
        non_subscription_supplement_sales
      from public.vw_supplement_subscription_ratio
      order by case period_label
        when '6개월' then 1
        when '1년' then 2
        when '2년' then 3
        when '전체 기간' then 4
        else 5
      end
    `,
  );

  const subscriptionRelatedBaseTables = uniqueStrings(
    subscriptionTableQuery.rows.map((row) => row.table_name),
  );
  const customerSubscriptionStateTables = subscriptionRelatedBaseTables.filter(
    (tableName) => tableName !== "tb_notification_subscriptions",
  );
  const snapshot = subscriptionSnapshotQuery.rows[0];
  const latestMonth = latestMonthQuery.rows[0];

  return {
    status: "success",
    data: {
      availability: {
        exact_active_subscriber_count_available: customerSubscriptionStateTables.length > 0,
        exact_active_subscriber_count_reason:
          customerSubscriptionStateTables.length > 0
            ? "고객 구독 상태를 담는 별도 테이블/컬럼이 일부 존재합니다."
            : "주문 원장과 집계 뷰는 있지만, 현재 활성 여부를 직접 담는 고객 구독 상태 테이블/컬럼은 확인되지 않았습니다.",
        subscription_order_history_available: toNumber(snapshot?.valid_subscription_order_rows) > 0,
        conversion_rate_available: conversionQuery.rows.length > 0,
        supplement_subscription_ratio_available: supplementRatioQuery.rows.length > 0,
      },
      current_snapshot: {
        valid_subscription_order_rows: toNumber(snapshot?.valid_subscription_order_rows),
        distinct_subscription_order_customers: toNumber(snapshot?.distinct_subscription_order_customers),
        latest_subscription_order_date: snapshot?.latest_subscription_order_date ?? null,
        latest_month_label: latestMonth?.latest_month_label ?? null,
        latest_month_subscription_customers: toNumber(latestMonth?.latest_month_subscription_customers),
      },
      schema_evidence: {
        subscription_related_base_tables: subscriptionRelatedBaseTables,
        customer_subscription_state_table_detected: customerSubscriptionStateTables.length > 0,
      },
      conversion_periods: conversionQuery.rows.map((row) => ({
        period_label: row.period_label,
        non_sub_customers: toNumber(row.non_sub_customers),
        converted_customers: toNumber(row.converted_customers),
        conversion_percentage: toNumber(row.conversion_percentage),
      })),
      supplement_ratio_periods: supplementRatioQuery.rows.map((row) => ({
        period_label: row.period_label,
        subscription_ratio_percentage: toNumber(row.subscription_ratio_percentage),
        total_supplement_sales: toNumber(row.total_supplement_sales),
        subscription_supplement_sales: toNumber(row.subscription_supplement_sales),
        non_subscription_supplement_sales: toNumber(row.non_subscription_supplement_sales),
      })),
    },
    meta: {
      reference_date: referenceDate,
      source: "public.tb_iamweb_users + public.vw_subscription_conversion_ratio + public.vw_supplement_subscription_ratio",
    },
    notes: buildNotes([
      "정확한 '현재 활성 정기구독자 수'는 주문 원장만으로는 확정하기 어렵습니다.",
      "이유는 시작일, 해지일, 다음 결제 예정일 같은 활성 상태 컬럼/테이블이 현재 소스에서 확인되지 않았기 때문입니다.",
      "대신 정기 상품 주문 이력, 일반 구매 후 정기구독 전환율, 영양제 매출 중 정기구독 비중은 현재 바로 집계 가능합니다.",
      "정기구독 전환율은 '일반 영양제를 먼저 산 고객 중 이후 정기 상품을 산 고객 비율' 기준입니다.",
    ]),
  };
};

export const fetchCallpriceSubscriptionConsultComparison = async (
  params: {
    referenceDate?: string;
  } = {},
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceSubscriptionConsultComparisonData,
    {
      reference_date: string;
      period_labels: string[];
      definition: string;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  if (
    subscriptionConsultComparisonCache &&
    subscriptionConsultComparisonCache.referenceDate === referenceDate &&
    Date.now() - subscriptionConsultComparisonCache.cachedAt < CALLPRICE_HEAVY_QUERY_CACHE_TTL_MS
  ) {
    return subscriptionConsultComparisonCache.payload;
  }

  const [firstNonSubQuery, firstSubscriptionQuery, earliestConsultQuery] = await Promise.all([
    runner<{
      customer_number: string;
      normalized_phone: string;
      first_non_sub_date: string;
    }>(
      `
        select
          customer_number,
          ${NORMALIZED_PHONE_SQL} as normalized_phone,
          min(${ORDER_DATE_SQL})::text as first_non_sub_date
        from public.tb_iamweb_users
        where customer_number is not null
          and trim(customer_number) <> ''
          and ${ORDER_DATE_SQL} is not null
          and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
          and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
          and coalesce(nullif(trim(product_name), ''), '미분류') !~~ '%분석%'
          and coalesce(nullif(trim(product_name), ''), '미분류') !~~ '%검사%'
          and coalesce(nullif(trim(option_name), ''), '미분류') !~~ '%분석%'
          and coalesce(nullif(trim(option_name), ''), '미분류') !~~ '%검사%'
          and not (coalesce(nullif(trim(product_name), ''), '미분류') = any($1::text[]))
          and coalesce(nullif(trim(product_name), ''), '미분류') not like '%정기%'
        group by customer_number, ${NORMALIZED_PHONE_SQL}
      `,
      [CALLPRICE_SUPPLEMENT_EXCLUDED_PRODUCT_NAMES],
    ),
    runner<{
      customer_number: string;
      first_subscription_date: string;
    }>(
      `
        select
          customer_number,
          min(${ORDER_DATE_SQL})::text as first_subscription_date
        from public.tb_iamweb_users
        where customer_number is not null
          and trim(customer_number) <> ''
          and ${ORDER_DATE_SQL} is not null
          and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
          and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
          and coalesce(nullif(trim(product_name), ''), '미분류') !~~ '%분석%'
          and coalesce(nullif(trim(product_name), ''), '미분류') !~~ '%검사%'
          and coalesce(nullif(trim(option_name), ''), '미분류') !~~ '%분석%'
          and coalesce(nullif(trim(option_name), ''), '미분류') !~~ '%검사%'
          and not (coalesce(nullif(trim(product_name), ''), '미분류') = any($1::text[]))
          and coalesce(nullif(trim(product_name), ''), '미분류') like '%정기%'
        group by customer_number
      `,
      [CALLPRICE_SUPPLEMENT_EXCLUDED_PRODUCT_NAMES],
    ),
    runner<{
      normalized_phone: string;
      earliest_completed_consultation_date: string;
    }>(
      `
        select
          ${NORMALIZED_CONTACT_SQL} as normalized_phone,
          min(${CONSULTATION_DATE_SQL})::text as earliest_completed_consultation_date
        from public.tb_consultation_records
        where ${COMPLETED_STATUS_SQL}
          and ${CONSULTATION_DATE_SQL} is not null
          and ${NORMALIZED_CONTACT_SQL} <> ''
        group by ${NORMALIZED_CONTACT_SQL}
      `,
    ),
  ]);

  const firstSubscriptionByCustomer = new Map<string, string>();
  for (const row of firstSubscriptionQuery.rows) {
    if (!row.customer_number) continue;
    const firstSubscriptionDate = toIsoDateOnly(row.first_subscription_date);
    if (!firstSubscriptionDate) continue;
    firstSubscriptionByCustomer.set(row.customer_number, firstSubscriptionDate);
  }

  const earliestConsultByPhone = new Map<string, string>();
  for (const row of earliestConsultQuery.rows) {
    const normalizedPhone = normalizeCallpricePhone(row.normalized_phone);
    const earliestCompletedConsultationDate = toIsoDateOnly(
      row.earliest_completed_consultation_date,
    );
    if (!normalizedPhone || !earliestCompletedConsultationDate) continue;
    earliestConsultByPhone.set(normalizedPhone, earliestCompletedConsultationDate);
  }

  const periodDefinitions = [
    { period_label: "6개월", period_start_date: shiftIsoDateByMonths(referenceDate, -6) },
    { period_label: "1년", period_start_date: shiftIsoDateByYears(referenceDate, -1) },
    { period_label: "2년", period_start_date: shiftIsoDateByYears(referenceDate, -2) },
    { period_label: "전체 기간", period_start_date: "0001-01-01" },
  ] as const;

  const aggregates = new Map<
    string,
    {
      consulted_non_sub_customers: number;
      consulted_converted_customers: number;
      non_consulted_non_sub_customers: number;
      non_consulted_converted_customers: number;
    }
  >(
    periodDefinitions.map((period) => [
      period.period_label,
      {
        consulted_non_sub_customers: 0,
        consulted_converted_customers: 0,
        non_consulted_non_sub_customers: 0,
        non_consulted_converted_customers: 0,
      },
    ]),
  );

  for (const row of firstNonSubQuery.rows) {
    const customerNumber = trimToEmpty(row.customer_number);
    const normalizedPhone = normalizeCallpricePhone(row.normalized_phone);
    const firstNonSubDate = toIsoDateOnly(row.first_non_sub_date);
    if (!customerNumber || !firstNonSubDate) continue;

    const earliestConsultDate = normalizedPhone
      ? earliestConsultByPhone.get(normalizedPhone) ?? null
      : null;
    const firstSubscriptionDate = firstSubscriptionByCustomer.get(customerNumber) ?? null;
    const consultedBeforeFirstPurchase = Boolean(
      earliestConsultDate && earliestConsultDate <= firstNonSubDate,
    );
    const convertedToSubscription = Boolean(
      firstSubscriptionDate && firstSubscriptionDate > firstNonSubDate,
    );

    for (const period of periodDefinitions) {
      if (firstNonSubDate < period.period_start_date || firstNonSubDate >= referenceDate) {
        continue;
      }

      const bucket = aggregates.get(period.period_label);
      if (!bucket) continue;

      if (consultedBeforeFirstPurchase) {
        bucket.consulted_non_sub_customers += 1;
        if (convertedToSubscription) {
          bucket.consulted_converted_customers += 1;
        }
      } else {
        bucket.non_consulted_non_sub_customers += 1;
        if (convertedToSubscription) {
          bucket.non_consulted_converted_customers += 1;
        }
      }
    }
  }

  const items = periodDefinitions.map((period) => {
    const bucket = aggregates.get(period.period_label) ?? {
      consulted_non_sub_customers: 0,
      consulted_converted_customers: 0,
      non_consulted_non_sub_customers: 0,
      non_consulted_converted_customers: 0,
    };

    const consultedConversionPercentage =
      bucket.consulted_non_sub_customers > 0
        ? Number(
            (
              (bucket.consulted_converted_customers / bucket.consulted_non_sub_customers) *
              100
            ).toFixed(1),
          )
        : 0;
    const nonConsultedConversionPercentage =
      bucket.non_consulted_non_sub_customers > 0
        ? Number(
            (
              (bucket.non_consulted_converted_customers /
                bucket.non_consulted_non_sub_customers) *
              100
            ).toFixed(1),
          )
        : 0;
    const conversionRateMultiple =
      bucket.non_consulted_converted_customers > 0 && bucket.non_consulted_non_sub_customers > 0
        ? Number(
            (
              (bucket.consulted_converted_customers /
                Math.max(1, bucket.consulted_non_sub_customers)) /
              (bucket.non_consulted_converted_customers /
                bucket.non_consulted_non_sub_customers)
            ).toFixed(3),
          )
        : null;

    return {
      period_label: period.period_label,
      consulted_non_sub_customers: bucket.consulted_non_sub_customers,
      consulted_converted_customers: bucket.consulted_converted_customers,
      consulted_conversion_percentage: consultedConversionPercentage,
      non_consulted_non_sub_customers: bucket.non_consulted_non_sub_customers,
      non_consulted_converted_customers: bucket.non_consulted_converted_customers,
      non_consulted_conversion_percentage: nonConsultedConversionPercentage,
      conversion_rate_diff_percentage_points: Number(
        (consultedConversionPercentage - nonConsultedConversionPercentage).toFixed(1),
      ),
      conversion_rate_multiple: conversionRateMultiple,
    } satisfies CallpriceSubscriptionConsultComparisonRow;
  });

  const payload: CallpriceEnvelope<
    CallpriceSubscriptionConsultComparisonData,
    {
      reference_date: string;
      period_labels: string[];
      definition: string;
    }
  > = {
    status: "success",
    data: {
      items,
    },
    meta: {
      reference_date: referenceDate,
      period_labels: [...CALLPRICE_SUBSCRIPTION_PERIOD_LABELS],
      definition: "일반 영양제 첫 구매 이전에 완료 상담이 있었는지 기준으로 상담군/미상담군을 나눈 뒤, 이후 정기 상품 구매 전환율을 비교합니다.",
    },
    notes: buildNotes([
      "정기구독 전환율은 '일반 영양제 첫 구매 이후 나중에 정기 상품을 샀는가' 기준입니다.",
      "상담군 판정은 주문 연락처와 상담 연락처를 정규화해 매칭했고, 첫 일반 구매일 이전에 완료 상담이 있었는지로 나눴습니다.",
      "전화번호 불일치나 가족 주문처럼 연락처 매칭이 안 되는 경우는 미상담군 쪽으로 남을 수 있습니다.",
    ]),
  };

  subscriptionConsultComparisonCache = {
    referenceDate,
    cachedAt: Date.now(),
    payload,
  };

  return payload;
};

export const fetchCallpriceRampup = async (
  params: {
    maturityDays: CallpriceMaturityDays;
    baselineScope: CallpriceBaselineScope;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
): Promise<
  CallpriceEnvelope<
    CallpriceRampupData,
    {
      maturity_days: number;
      baseline_scope: CallpriceBaselineScope;
      reference_date: string;
      window_days: number;
      history_start_date: string | null;
      history_end_date: string | null;
    }
  >
> => {
  const referenceDate = params.referenceDate ?? todayIsoDate();
  const [allCompletedRows, baselineRows] = await Promise.all([
    fetchCompletedConsultationRows({}, runner),
    fetchBaselineCustomerRows(runner),
  ]);

  const completedConsultPhones = new Set(
    allCompletedRows
      .map((row) => normalizeCallpricePhone(row.customerContact))
      .filter((value): value is string => Boolean(value)),
  );
  const allPhones = uniqueStrings([
    ...Array.from(completedConsultPhones),
    ...baselineRows.map((row) => row.normalizedPhone),
  ]);
  const earliestConsultationDate = allCompletedRows[0]?.consultationDate ?? null;
  const earliestBaselineDate =
    [...baselineRows]
      .map((row) => row.firstTestDate)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;
  const minAnchorDate = [earliestConsultationDate, earliestBaselineDate]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))[0];
  const ordersByPhone = await fetchOrdersByPhones(
    allPhones,
    minAnchorDate ?? referenceDate,
    runner,
  );

  const monthlyManagerItems = buildRampupSegmentItems({
    windows: CALLPRICE_RAMPUP_MONTH_WINDOWS,
    allCompletedRows,
    baselineRows,
    completedConsultPhones,
    ordersByPhone,
    maturityDays: params.maturityDays,
    baselineScope: params.baselineScope,
    referenceDate,
  });
  const fortnightManagerItems = buildRampupSegmentItems({
    windows: CALLPRICE_RAMPUP_FORTNIGHT_WINDOWS,
    allCompletedRows,
    baselineRows,
    completedConsultPhones,
    ordersByPhone,
    maturityDays: params.maturityDays,
    baselineScope: params.baselineScope,
    referenceDate,
  });
  const checkpointManagerItems = buildRampupSegmentItems({
    windows: CALLPRICE_RAMPUP_CHECKPOINT_WINDOWS,
    allCompletedRows,
    baselineRows,
    completedConsultPhones,
    ordersByPhone,
    maturityDays: params.maturityDays,
    baselineScope: params.baselineScope,
    referenceDate,
  });
  const monthlySummaryIncludingLegacy = CALLPRICE_RAMPUP_MONTH_WINDOWS.map((window) =>
    aggregateRampupRows(monthlyManagerItems, window),
  );
  const monthlySummaryExcludingLegacy = CALLPRICE_RAMPUP_MONTH_WINDOWS.map((window) =>
    aggregateRampupRows(
      monthlyManagerItems.filter((row) => !row.legacy_assumption),
      window,
    ),
  );
  const fortnightSummaryIncludingLegacy = CALLPRICE_RAMPUP_FORTNIGHT_WINDOWS.map((window) =>
    aggregateRampupRows(fortnightManagerItems, window),
  );
  const fortnightSummaryExcludingLegacy = CALLPRICE_RAMPUP_FORTNIGHT_WINDOWS.map((window) =>
    aggregateRampupRows(
      fortnightManagerItems.filter((row) => !row.legacy_assumption),
      window,
    ),
  );
  const checkpointSummaryIncludingLegacy = CALLPRICE_RAMPUP_CHECKPOINT_WINDOWS.map((window) =>
    aggregateRampupRows(checkpointManagerItems, window),
  );
  const checkpointSummaryExcludingLegacy = CALLPRICE_RAMPUP_CHECKPOINT_WINDOWS.map((window) =>
    aggregateRampupRows(
      checkpointManagerItems.filter((row) => !row.legacy_assumption),
      window,
    ),
  );

  return {
    status: "success",
    data: {
      summary_excluding_legacy: monthlySummaryExcludingLegacy.map(toMonthlySummaryRow),
      summary_including_legacy: monthlySummaryIncludingLegacy.map(toMonthlySummaryRow),
      manager_items: monthlyManagerItems
        .map(({ total_revenue, total_baseline_revenue, ...row }) => toMonthlyManagerRow(row)),
      fortnight_summary_excluding_legacy: fortnightSummaryExcludingLegacy,
      fortnight_summary_including_legacy: fortnightSummaryIncludingLegacy,
      fortnight_manager_items: fortnightManagerItems.map(
        ({ total_revenue, total_baseline_revenue, ...row }) => row,
      ),
      checkpoint_summary_excluding_legacy: checkpointSummaryExcludingLegacy,
      checkpoint_summary_including_legacy: checkpointSummaryIncludingLegacy,
      checkpoint_manager_items: checkpointManagerItems.map(
        ({ total_revenue, total_baseline_revenue, ...row }) => row,
      ),
      legacy_manager_names: [...CALLPRICE_RAMPUP_LEGACY_MANAGERS],
      manager_alias_groups: CALLPRICE_MANAGER_ALIAS_GROUPS.map((group) => ({
        canonical_manager: group.canonical_manager,
        aliases: [...group.aliases],
      })),
      manager_hire_dates: Array.from(CALLPRICE_MANAGER_HIRE_DATE_OVERRIDES.entries())
        .map(([manager, hire_date]) => ({
          manager,
          hire_date,
          note:
            manager === "동주"
              ? "동주, 서동주, 팀장님은 동일 상담사로 보고 동주 입사일로 통합했습니다."
              : "TJ님 제공 입사일 기준입니다.",
        }))
        .sort((a, b) => a.hire_date.localeCompare(b.hire_date) || a.manager.localeCompare(b.manager, "ko")),
      probation_guides: buildProbationGuides(),
      recent_manager_names: uniqueStrings(
        monthlyManagerItems
          .filter((row) => !row.legacy_assumption)
          .map((row) => row.manager),
      ).sort((a, b) => a.localeCompare(b, "ko")),
    },
    meta: {
      maturity_days: params.maturityDays,
      baseline_scope: params.baselineScope,
      reference_date: referenceDate,
      window_days: CALLPRICE_RAMPUP_WINDOW_DAYS,
      history_start_date: earliestConsultationDate,
      history_end_date:
        [...allCompletedRows]
          .map((row) => row.consultationDate)
          .sort((a, b) => b.localeCompare(a))[0] ?? null,
    },
    notes: buildNotes([
      "초기 랜딩 비교의 1개월차, 2개월차, 3개월차는 상담사별 첫 완료 상담일을 기준으로 30일 단위로 나눴습니다.",
      "동주, 서동주, 팀장님은 동일 상담사로 보고 '동주'로 합산했습니다.",
      "실제 입사일이 확인된 경태(2022-06-21), 동주(2023-07-24), 민정(2023-11-20)은 초기 구간 데이터가 비어 있어 랜딩 평균에서 제외합니다.",
      "2주 단위 경향성은 1~2주차, 3~4주차, 5~6주차, 7~8주차, 9~10주차, 11~12주차로 나눠 봅니다.",
      "월차별 비교군은 각 상담사의 해당 월차가 실제로 발생한 달력 구간의 미상담 고객을 사용했습니다.",
      "민정, 경태, 동주는 DB 관측 시작 전에 이미 근무했을 가능성이 있어 기본 비교에서는 제외하고 별도 참고용으로만 보여줍니다.",
      "가장 최근 입사한 상담사는 2개월차, 3개월차의 90일 성숙 표본이 아직 부족할 수 있습니다.",
    ]),
  };
};

export const parseCallpriceMaturityDays = (value: unknown, fallback: CallpriceMaturityDays = 90) => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  return isValidMaturityDays(parsed) ? parsed : null;
};

// ═══════════════════════════════════════════════════════════════
// 영양제 첫구매 고객 LTV 분석
// ═══════════════════════════════════════════════════════════════

type SupplementFirstLtvSegment = {
  segment: "supplement_first" | "test_kit_first" | "other_first";
  label: string;
  customerCount: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrdersPerCustomer: number;
  avgRevenuePerCustomer: number;
  avgFirstOrderValue: number;
  repeatPurchaseRate: number; // 2회 이상 구매 비율
  repeatCustomers: number;
  avgRepeatRevenue: number; // 첫 구매 제외 추가 매출 평균
  ltvWindows: Array<{
    days: number;
    avgRevenue: number;
    repeatRate: number;
    avgOrders: number;
  }>;
  topRepeatProducts: Array<{ product: string; count: number }>;
  topFirstProducts: Array<{ product: string; count: number }>; // 첫구매 상품 Top
  topFirstProductsByYear: Array<{ year: string; products: Array<{ product: string; count: number }> }>;
  conversionToTest: number | null; // 영양제-먼저 → 이후 검사 구매 비율 (supplement_first만)
};

export const fetchSupplementFirstLtv = async (params: {
  startDate?: string;
  endDate?: string;
}): Promise<{ ok: true; data: { segments: SupplementFirstLtvSegment[]; notes: string[]; queryDate: string } }> => {
  const endDate = params.endDate || new Date().toISOString().slice(0, 10);
  const startDate = params.startDate || shiftIsoDateByYears(endDate, -2);
  const notes: string[] = [];

  // 1. 전체 주문 가져오기 (고객별 상품 카테고리 포함)
  const ordersResult = await queryPg<{
    normalized_phone: string;
    order_date: string;
    net_revenue: number | string;
    product_name: string;
  }>(
    `
      select
        ${NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ORDER_DATE_SQL}::text as order_date,
        ${ORDER_REVENUE_SQL} as net_revenue,
        coalesce(nullif(trim(product_name), ''), '미분류') as product_name
      from public.tb_iamweb_users
      where ${NORMALIZED_PHONE_SQL} <> ''
        and ${ORDER_DATE_SQL} is not null
        and ${ORDER_DATE_SQL} >= $1::date
        and ${ORDER_DATE_SQL} <= $2::date
        and ${ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      order by ${NORMALIZED_PHONE_SQL} asc, ${ORDER_DATE_SQL} asc
    `,
    [startDate, endDate],
  );

  // 2. 고객별로 그룹핑
  const customerOrders = new Map<string, Array<{
    orderDate: string;
    netRevenue: number;
    productName: string;
    category: "test_kit" | "supplement" | "other";
  }>>();

  for (const row of ordersResult.rows) {
    const phone = row.normalized_phone?.trim();
    if (!phone || phone.length < 10) continue;
    const orderDate = row.order_date ? String(row.order_date).slice(0, 10) : null;
    if (!orderDate) continue;

    const orders = customerOrders.get(phone) ?? [];
    orders.push({
      orderDate,
      netRevenue: typeof row.net_revenue === "string" ? Number(row.net_revenue) : (row.net_revenue ?? 0),
      productName: row.product_name,
      category: categorizeProductName(row.product_name),
    });
    customerOrders.set(phone, orders);
  }

  notes.push(`총 고객 수: ${customerOrders.size}명, 주문 수: ${ordersResult.rows.length}건 (${startDate} ~ ${endDate})`);

  // 3. 첫 구매 카테고리 기준으로 세그먼트 분류
  const segments: Record<string, {
    customers: Array<{
      phone: string;
      firstOrderDate: string;
      firstOrderValue: number;
      firstCategory: string;
      orders: typeof customerOrders extends Map<string, infer V> ? V : never;
    }>;
  }> = {
    supplement_first: { customers: [] },
    test_kit_first: { customers: [] },
    other_first: { customers: [] },
  };

  for (const [phone, orders] of customerOrders) {
    if (orders.length === 0) continue;
    // 첫 주문의 카테고리로 세그먼트 결정
    const first = orders[0];
    const segKey = first.category === "supplement" ? "supplement_first"
      : first.category === "test_kit" ? "test_kit_first"
      : "other_first";
    segments[segKey].customers.push({
      phone,
      firstOrderDate: first.orderDate,
      firstOrderValue: first.netRevenue,
      firstCategory: first.category,
      orders,
    });
  }

  // 4. 각 세그먼트별 LTV 메트릭 계산
  const LTV_WINDOWS = [30, 90, 180, 365];
  const result: SupplementFirstLtvSegment[] = [];

  for (const [segKey, seg] of Object.entries(segments)) {
    if (seg.customers.length === 0) continue;

    const customerCount = seg.customers.length;
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalFirstOrderValue = 0;
    let repeatCustomers = 0;
    let totalRepeatRevenue = 0;
    let testConversions = 0;
    const firstProductCounts = new Map<string, number>();
    const firstProductByYear = new Map<string, Map<string, number>>();

    // LTV window accumulators
    const windowStats = LTV_WINDOWS.map(() => ({ totalRevenue: 0, totalOrders: 0, repeatCustomers: 0, eligibleCustomers: 0 }));

    // Top repeat products
    const productCounts = new Map<string, number>();

    for (const cust of seg.customers) {
      const orders = cust.orders;
      totalOrders += orders.length;
      const custRevenue = orders.reduce((s, o) => s + o.netRevenue, 0);
      totalRevenue += custRevenue;
      totalFirstOrderValue += cust.firstOrderValue;

      if (orders.length > 1) {
        repeatCustomers++;
        totalRepeatRevenue += custRevenue - cust.firstOrderValue;
      }

      // 영양제-먼저 → 검사 전환 체크
      if (segKey === "supplement_first") {
        const hasTest = orders.some((o, i) => i > 0 && o.category === "test_kit");
        if (hasTest) testConversions++;
      }

      // LTV window 계산
      const firstDate = new Date(cust.firstOrderDate);
      for (let wi = 0; wi < LTV_WINDOWS.length; wi++) {
        const windowEnd = new Date(firstDate.getTime() + LTV_WINDOWS[wi] * 86400000);
        const cutoffDate = new Date(endDate);
        // 윈도우가 아직 안 끝난 고객 제외
        if (windowEnd > cutoffDate) continue;
        windowStats[wi].eligibleCustomers++;
        const windowOrders = orders.filter((o) => new Date(o.orderDate) <= windowEnd);
        windowStats[wi].totalRevenue += windowOrders.reduce((s, o) => s + o.netRevenue, 0);
        windowStats[wi].totalOrders += windowOrders.length;
        if (windowOrders.length > 1) windowStats[wi].repeatCustomers++;
      }

      // 반복 구매 상품 집계 (첫 주문 제외)
      for (let i = 1; i < orders.length; i++) {
        const name = orders[i].productName;
        productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
      }

      // 첫구매 상품 집계
      firstProductCounts.set(cust.orders[0].productName, (firstProductCounts.get(cust.orders[0].productName) ?? 0) + 1);
      const year = cust.firstOrderDate.slice(0, 4);
      const yearMap = firstProductByYear.get(year) ?? new Map<string, number>();
      yearMap.set(cust.orders[0].productName, (yearMap.get(cust.orders[0].productName) ?? 0) + 1);
      firstProductByYear.set(year, yearMap);
    }

    const topRepeatProducts = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product, count]) => ({ product, count }));

    const topFirstProducts = [...firstProductCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product, count]) => ({ product, count }));

    const topFirstProductsByYear = [...firstProductByYear.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, prods]) => ({
        year,
        products: [...prods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([product, count]) => ({ product, count })),
      }));

    const label = segKey === "supplement_first" ? "영양제 첫구매"
      : segKey === "test_kit_first" ? "검사권 첫구매"
      : "기타 첫구매";

    result.push({
      segment: segKey as SupplementFirstLtvSegment["segment"],
      label,
      customerCount,
      totalOrders,
      totalRevenue,
      avgOrdersPerCustomer: customerCount > 0 ? totalOrders / customerCount : 0,
      avgRevenuePerCustomer: customerCount > 0 ? totalRevenue / customerCount : 0,
      avgFirstOrderValue: customerCount > 0 ? totalFirstOrderValue / customerCount : 0,
      repeatPurchaseRate: customerCount > 0 ? repeatCustomers / customerCount : 0,
      repeatCustomers,
      avgRepeatRevenue: repeatCustomers > 0 ? totalRepeatRevenue / repeatCustomers : 0,
      ltvWindows: LTV_WINDOWS.map((days, wi) => ({
        days,
        avgRevenue: windowStats[wi].eligibleCustomers > 0 ? windowStats[wi].totalRevenue / windowStats[wi].eligibleCustomers : 0,
        repeatRate: windowStats[wi].eligibleCustomers > 0 ? windowStats[wi].repeatCustomers / windowStats[wi].eligibleCustomers : 0,
        avgOrders: windowStats[wi].eligibleCustomers > 0 ? windowStats[wi].totalOrders / windowStats[wi].eligibleCustomers : 0,
      })),
      topRepeatProducts,
      topFirstProducts,
      topFirstProductsByYear,
      conversionToTest: segKey === "supplement_first" ? (customerCount > 0 ? testConversions / customerCount : 0) : null,
    });
  }

  return {
    ok: true,
    data: {
      segments: result.sort((a, b) => b.customerCount - a.customerCount),
      notes,
      queryDate: endDate,
    },
  };
};
