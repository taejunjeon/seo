/* ═══════════════════════════════════════
   Callprice API 타입 정의
   백엔드 callprice.ts 응답 구조 기반
   ═══════════════════════════════════════ */

/* ── 공통 Envelope ── */
export type CallpriceEnvelope<TData, TMeta extends Record<string, unknown> = Record<string, unknown>> = {
  status: "success";
  data: TData;
  meta: TMeta;
  notes: string[];
};

/* ── Cohort Summary (overview, managers, analysis-types 공통) ── */
export type CohortSummary = {
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

/* ── Options ── */
export type CallpriceBaselineScope = "global_non_consultation" | "analysis_type_non_consultation";

export type CallpriceOptionsData = {
  manager_options: string[];
  analysis_type_options: string[];
  baseline_scope_options: Array<{ value: CallpriceBaselineScope; label: string }>;
  maturity_day_options: number[];
};

export type CallpriceOptionsResponse = CallpriceEnvelope<
  CallpriceOptionsData,
  { source: string }
>;

/* ── Overview ── */
export type CallpriceOverviewData = {
  summary: CohortSummary;
  filters: {
    start_date: string;
    end_date: string;
    manager: string | null;
    analysis_type: string | null;
  };
};

export type CallpriceOverviewResponse = CallpriceEnvelope<
  CallpriceOverviewData,
  {
    maturity_days: number;
    baseline_scope: CallpriceBaselineScope;
    comparison_unit: string;
    reference_date: string;
    baseline_customers: number;
    baseline_matured_customers: number;
  }
>;

/* ── Managers ── */
export type CallpriceManagersRow = CohortSummary & {
  manager: string;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
  share_of_total_completed_consultations: number;
  share_of_total_estimated_incremental_revenue: number;
};

export type CallpriceManagersResponse = CallpriceEnvelope<
  { items: CallpriceManagersRow[] },
  {
    maturity_days: number;
    baseline_scope: CallpriceBaselineScope;
    sort_by: string;
    sort_order: "asc" | "desc";
    reference_date: string;
  }
>;

/* ── Analysis Types ── */
export type CallpriceAnalysisTypeRow = CohortSummary & {
  analysis_type: string;
  sample_warning: boolean;
  sample_size_grade: "stable" | "watch" | "small";
  sample_warning_reason: string | null;
};

export type CallpriceAnalysisTypesResponse = CallpriceEnvelope<
  { items: CallpriceAnalysisTypeRow[] },
  {
    maturity_days: number;
    baseline_scope: CallpriceBaselineScope;
    reference_date: string;
    manager: string | null;
  }
>;

/* ── Scenario ── */
export type ScenarioData = {
  headcount: number;
  monthly_cost: number;
  estimated_incremental_revenue: number;
  estimated_incremental_profit: number;
  incremental_revenue_multiple: number;
  break_even_cost: number;
  break_even_headcount: number;
  assumed_monthly_incremental_revenue_per_headcount: number;
};

export type CallpriceScenarioResponse = CallpriceEnvelope<
  ScenarioData,
  {
    maturity_days: number;
    baseline_scope: CallpriceBaselineScope;
    reference_date: string;
    period_days: number;
    manager: string | null;
    analysis_type: string | null;
  }
>;

/* ── Daytype Comparison ── */
export type CallpriceDayTypeKey = "weekday" | "weekend";

export type CallpriceDayTypeCompletionRow = {
  day_type: CallpriceDayTypeKey;
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

export type CallpriceDayTypeValueRow = {
  day_type: CallpriceDayTypeKey;
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

export type CallpriceDayTypeComparisonResponse = CallpriceEnvelope<
  {
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
  },
  {
    reference_date: string;
    range: {
      startDate: string;
      endDate: string;
    };
  }
>;

/* ── Supplement Purchase Timing ── */
export type CallpriceSupplementPurchaseTimingBucketRow = {
  bucket_key:
    | "same_day"
    | "within_3_days"
    | "within_7_days"
    | "within_14_days"
    | "within_30_days"
    | "after_31_days";
  label: string;
  min_day_offset: number;
  max_day_offset: number | null;
  customer_count: number;
  share_of_supplement_buyers: number;
  share_of_matured_consultation_customers: number;
};

export type CallpriceSupplementPurchaseTimingResponse = CallpriceEnvelope<
  {
    cohort: {
      completed_consultations: number;
      unique_completed_customers: number;
      matured_customers: number;
      supplement_buyers: number;
      no_supplement_purchase_customers: number;
      supplement_conversion_rate: number;
    };
    buckets: CallpriceSupplementPurchaseTimingBucketRow[];
  },
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
>;

export type CallpriceSupplementRepeatPatternBucketRow = {
  bucket_key: "one_order" | "two_orders" | "three_orders" | "four_plus_orders";
  label: string;
  min_total_orders: number;
  max_total_orders: number | null;
  customer_count: number;
  share_of_matured_starters: number;
};

export type CallpriceSupplementRepeatPatternResponse = CallpriceEnvelope<
  {
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
    buckets: CallpriceSupplementRepeatPatternBucketRow[];
  },
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
>;

export type CallpriceSubscriptionConversionRow = {
  period_label: string;
  non_sub_customers: number;
  converted_customers: number;
  conversion_percentage: number;
};

export type CallpriceSupplementSubscriptionRatioRow = {
  period_label: string;
  subscription_ratio_percentage: number;
  total_supplement_sales: number;
  subscription_supplement_sales: number;
  non_subscription_supplement_sales: number;
};

export type CallpriceSubscriptionStatusResponse = CallpriceEnvelope<
  {
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
  },
  {
    reference_date: string;
    source: string;
  }
>;

export type CallpriceSubscriptionConsultComparisonRow = {
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

export type CallpriceSubscriptionConsultComparisonResponse = CallpriceEnvelope<
  {
    items: CallpriceSubscriptionConsultComparisonRow[];
  },
  {
    reference_date: string;
    period_labels: string[];
    definition: string;
  }
>;

/* ── Ramp-up Comparison ── */
export type CallpriceRampupSummaryRow = CohortSummary & {
  month_index: 1 | 2 | 3;
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

export type CallpriceRampupManagerRow = CohortSummary & {
  manager: string;
  month_index: 1 | 2 | 3;
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

export type CallpriceRampupSegmentSummaryRow<TIndex extends number = number> = CohortSummary & {
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

export type CallpriceRampupSegmentManagerRow<TIndex extends number = number> = CohortSummary & {
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

export type CallpriceManagerAliasGroup = {
  canonical_manager: string;
  aliases: string[];
};

export type CallpriceManagerHireDate = {
  manager: string;
  hire_date: string;
  note: string;
};

export type CallpriceProbationGuide = {
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

export type CallpriceRampupResponse = CallpriceEnvelope<
  {
    summary_excluding_legacy: CallpriceRampupSummaryRow[];
    summary_including_legacy: CallpriceRampupSummaryRow[];
    manager_items: CallpriceRampupManagerRow[];
    fortnight_summary_excluding_legacy: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>[];
    fortnight_summary_including_legacy: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>[];
    fortnight_manager_items: CallpriceRampupSegmentManagerRow<1 | 2 | 3 | 4 | 5 | 6>[];
    checkpoint_summary_excluding_legacy: CallpriceRampupSegmentSummaryRow<1 | 2>[];
    checkpoint_summary_including_legacy: CallpriceRampupSegmentSummaryRow<1 | 2>[];
    checkpoint_manager_items: CallpriceRampupSegmentManagerRow<1 | 2>[];
    legacy_manager_names: string[];
    recent_manager_names: string[];
    manager_alias_groups: CallpriceManagerAliasGroup[];
    manager_hire_dates: CallpriceManagerHireDate[];
    probation_guides: CallpriceProbationGuide[];
  },
  {
    maturity_days: number;
    baseline_scope: CallpriceBaselineScope;
    reference_date: string;
    window_days: number;
    history_start_date: string | null;
    history_end_date: string | null;
  }
>;

/* ── Hook Params / Result ── */
export type CallpriceParams = {
  startDate?: string;
  endDate?: string;
  maturityDays?: number;
  baselineScope?: string;
  manager?: string;
  analysisType?: string;
  monthlyCost?: number;
  headcount?: number;
};

export type CallpriceDataResult = {
  options: CallpriceOptionsResponse | null;
  overview: CallpriceOverviewResponse | null;
  managers: CallpriceManagersResponse | null;
  analysisTypes: CallpriceAnalysisTypesResponse | null;
  scenario: CallpriceScenarioResponse | null;
  loading: boolean;
  error: string | null;
};

export type CallpriceOptionsResult = {
  options: CallpriceOptionsResponse | null;
  loading: boolean;
  error: string | null;
};
