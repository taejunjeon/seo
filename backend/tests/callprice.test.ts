import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveSampleWarning,
  fetchCallpriceDayTypeComparison,
  fetchCallpriceManagers,
  fetchCallpriceOptions,
  fetchCallpriceOverview,
  fetchCallpriceRampup,
  fetchCallpriceSubscriptionConsultComparison,
  fetchCallpriceSubscriptionStatus,
  fetchCallpriceSupplementRepeatPattern,
  mapAnalysisTypesToReportTypes,
  fetchCallpriceSupplementPurchaseTiming,
  normalizeCallpricePhone,
  splitAnalysisTypes,
} from "../src/callprice";

const makeResult = <TRow extends Record<string, unknown>>(rows: TRow[]) =>
  ({
    rows,
    rowCount: rows.length,
    command: "SELECT",
    oid: 0,
    fields: [],
  }) as any;

const createQueuedRunner =
  (...queue: Array<Record<string, unknown>[]>) =>
  async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error("Unexpected query");
    }
    return makeResult(next);
  };

test("callprice: normalizeCallpricePhone handles local and +82 formats", () => {
  assert.equal(normalizeCallpricePhone("010-1234-5678"), "01012345678");
  assert.equal(normalizeCallpricePhone("82 10 1234 5678"), "01012345678");
  assert.equal(normalizeCallpricePhone("+82-10-1234-5678"), "01012345678");
  assert.equal(normalizeCallpricePhone("12345"), "");
});

test("callprice: splitAnalysisTypes and report-type mapping normalize mixed strings", () => {
  assert.deepEqual(splitAnalysisTypes("알러지, 유기산 ,호르몬"), ["알러지", "유기산", "호르몬"]);
  assert.deepEqual(splitAnalysisTypes(""), ["미분류"]);
  assert.deepEqual(splitAnalysisTypes("중금속 미네랄검사"), ["중금속"]);
  assert.deepEqual(splitAnalysisTypes("스트레스 노화"), ["호르몬"]);
  assert.deepEqual(splitAnalysisTypes("스트레스노화 분석"), ["호르몬"]);
  assert.deepEqual(mapAnalysisTypesToReportTypes(["알러지", "유기산", "호르몬"]).sort(), [
    "스트레스노화 호르몬",
    "음식물 과민증",
    "종합대사기능",
    "종합호르몬",
  ]);
  assert.deepEqual(mapAnalysisTypesToReportTypes(["스트레스 노화"]), ["스트레스노화 호르몬"]);
  assert.deepEqual(mapAnalysisTypesToReportTypes(["스트레스노화 분석"]), ["스트레스노화 호르몬"]);
});

test("callprice: deriveSampleWarning grades small and stable cohorts", () => {
  assert.deepEqual(deriveSampleWarning(12, 2), {
    sample_warning: true,
    sample_size_grade: "small",
    sample_warning_reason: "matured_customers<30, converted_customers<5",
  });
  assert.deepEqual(deriveSampleWarning(40, 8), {
    sample_warning: false,
    sample_size_grade: "stable",
    sample_warning_reason: null,
  });
});

test("callprice: overview computes summary against global non-consultation baseline", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "민정",
        raw_analysis_type: "알러지",
        consultation_date: "2026-01-10",
      },
      {
        customer_name: "김철수",
        customer_contact: "010-9999-8888",
        manager: "경태",
        raw_analysis_type: "중금속",
        consultation_date: "2026-01-15",
      },
    ],
    [{ customer_contact: "010-1234-5678" }, { customer_contact: "010-9999-8888" }],
    [
      {
        raw_phone: "01077776666",
        first_test_date: "2026-01-05",
        report_types: ["음식물 과민증"],
      },
      {
        raw_phone: "01055554444",
        first_test_date: "2026-01-08",
        report_types: ["종합대사기능"],
      },
    ],
    [{ normalized_phone: "01012345678", order_date: "2026-02-01", net_revenue: "100000" }],
    [
      { normalized_phone: "01077776666", order_date: "2026-02-01", net_revenue: "20000" },
      { normalized_phone: "01055554444", order_date: "2026-02-15", net_revenue: "30000" },
    ],
  );

  const overview = await fetchCallpriceOverview(
    {
      range: { startDate: "2026-01-01", endDate: "2026-01-31" },
      maturityDays: 90,
      baselineScope: "global_non_consultation",
      referenceDate: "2026-05-01",
    },
    runner as any,
  );

  assert.equal(overview.status, "success");
  assert.equal(overview.data.summary.completed_consultations, 2);
  assert.equal(overview.data.summary.unique_completed_customers, 2);
  assert.equal(overview.data.summary.matched_order_customers, 1);
  assert.equal(overview.data.summary.matured_customers, 2);
  assert.equal(overview.data.summary.converted_customers, 1);
  assert.equal(overview.data.summary.avg_revenue_per_customer, 50000);
  assert.equal(overview.data.summary.baseline_avg_revenue_per_customer, 25000);
  assert.equal(overview.data.summary.estimated_incremental_revenue, 50000);
  assert.equal(overview.data.summary.estimated_value_per_consultation, 25000);
});

test("callprice: managers endpoint sorts by estimated incremental revenue", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "민정",
        raw_analysis_type: "알러지",
        consultation_date: "2026-01-10",
      },
      {
        customer_name: "김철수",
        customer_contact: "010-9999-8888",
        manager: "경태",
        raw_analysis_type: "중금속",
        consultation_date: "2026-01-15",
      },
    ],
    [{ customer_contact: "010-1234-5678" }, { customer_contact: "010-9999-8888" }],
    [
      {
        raw_phone: "01077776666",
        first_test_date: "2026-01-05",
        report_types: ["음식물 과민증"],
      },
      {
        raw_phone: "01055554444",
        first_test_date: "2026-01-08",
        report_types: ["종합대사기능"],
      },
    ],
    [{ normalized_phone: "01012345678", order_date: "2026-02-01", net_revenue: "100000" }],
    [
      { normalized_phone: "01077776666", order_date: "2026-02-01", net_revenue: "20000" },
      { normalized_phone: "01055554444", order_date: "2026-02-15", net_revenue: "30000" },
    ],
  );

  const managers = await fetchCallpriceManagers(
    {
      range: { startDate: "2026-01-01", endDate: "2026-01-31" },
      maturityDays: 90,
      baselineScope: "global_non_consultation",
      referenceDate: "2026-05-01",
    },
    runner as any,
  );

  assert.equal(managers.status, "success");
  assert.equal(managers.data.items[0]?.manager, "민정");
  assert.equal(managers.data.items[0]?.estimated_incremental_revenue, 75000);
  assert.equal(managers.data.items[0]?.share_of_total_completed_consultations, 0.5);
  assert.equal(managers.data.items[0]?.share_of_total_estimated_incremental_revenue, 1);
  assert.equal(managers.data.items[1]?.manager, "경태");
  assert.equal(managers.data.items[1]?.estimated_incremental_revenue, -25000);
  assert.equal(managers.data.items[1]?.share_of_total_estimated_incremental_revenue, 0);
});

test("callprice: options merges manager aliases into one canonical option", async () => {
  const runner = createQueuedRunner([
    { manager: "팀장님", raw_analysis_type: "알러지" },
    { manager: "서동주", raw_analysis_type: "유기산" },
    { manager: "동주", raw_analysis_type: "호르몬" },
    { manager: "선희", raw_analysis_type: "중금속" },
  ]);

  const options = await fetchCallpriceOptions(runner as any);

  assert.equal(options.status, "success");
  assert.deepEqual(options.data.manager_options, ["전체", "동주", "선희"]);
  assert.deepEqual(options.data.analysis_type_options, ["전체", "알러지", "유기산", "중금속", "호르몬"]);
});

test("callprice: daytype comparison returns completion and 30-day value proxy", async () => {
  const runner = createQueuedRunner(
    [
      {
        day_type: "weekday",
        total_consults: 10,
        completed_consults: 8,
        completion_rate: 0.8,
        absent_consults: 1,
        absent_rate: 0.1,
        changed_consults: 1,
        changed_rate: 0.1,
        canceled_consults: 0,
        canceled_rate: 0,
      },
      {
        day_type: "weekend",
        total_consults: 4,
        completed_consults: 3,
        completion_rate: 0.75,
        absent_consults: 1,
        absent_rate: 0.25,
        changed_consults: 0,
        changed_rate: 0,
        canceled_consults: 0,
        canceled_rate: 0,
      },
    ],
    [
      {
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "민정",
        raw_analysis_type: "알러지",
        consultation_date: "2026-01-06",
      },
      {
        customer_name: "김철수",
        customer_contact: "010-9999-8888",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2026-01-04",
      },
    ],
    [
      { normalized_phone: "01012345678", order_date: "2026-01-10", net_revenue: "100000" },
      { normalized_phone: "01099998888", order_date: "2026-01-09", net_revenue: "160000" },
    ],
  );

  const comparison = await fetchCallpriceDayTypeComparison(
    {
      range: { startDate: "2026-01-01", endDate: "2026-01-31" },
      valueMaturityDays: 30,
      referenceDate: "2026-03-10",
    },
    runner as any,
  );

  assert.equal(comparison.status, "success");
  assert.equal(comparison.data.completion[0]?.day_type, "weekday");
  assert.equal(comparison.data.completion[1]?.day_type, "weekend");
  assert.equal(comparison.data.value[0]?.day_type, "weekday");
  assert.equal(comparison.data.value[0]?.avg_revenue_per_customer, 100000);
  assert.equal(comparison.data.value[1]?.day_type, "weekend");
  assert.equal(comparison.data.value[1]?.avg_revenue_per_customer, 160000);
  assert.equal(comparison.data.comparison.weekend_avg_revenue_per_customer_diff, 60000);
  assert.equal(comparison.data.comparison.weekend_completion_rate_diff, -0.05);
});

test("callprice: supplement purchase timing buckets first supplement order after consultation", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "예진",
        raw_analysis_type: "알러지",
        consultation_date: "2026-01-10",
      },
      {
        customer_name: "김철수",
        customer_contact: "010-9999-8888",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2026-01-15",
      },
    ],
    [{ customer_contact: "010-1234-5678" }, { customer_contact: "010-9999-8888" }],
    [],
    [],
    [
      {
        normalized_phone: "01012345678",
        order_date: "2026-01-10",
        net_revenue: "100000",
        product_name: "뉴로마스터 60정",
      },
      {
        normalized_phone: "01099998888",
        order_date: "2026-01-20",
        net_revenue: "120000",
        product_name: "바이오밸런스 1개월분",
      },
    ],
  );

  const timing = await fetchCallpriceSupplementPurchaseTiming(
    {
      range: { startDate: "2026-01-01", endDate: "2026-01-31" },
      maturityDays: 30,
      baselineScope: "global_non_consultation",
      referenceDate: "2026-03-10",
    },
    runner as any,
  );

  assert.equal(timing.status, "success");
  assert.equal(timing.data.cohort.matured_customers, 2);
  assert.equal(timing.data.cohort.supplement_buyers, 2);
  assert.equal(timing.data.cohort.supplement_conversion_rate, 1);
  assert.equal(timing.data.buckets.find((row) => row.bucket_key === "same_day")?.customer_count, 1);
  assert.equal(
    timing.data.buckets.find((row) => row.bucket_key === "same_day")?.share_of_supplement_buyers,
    0.5,
  );
  assert.equal(
    timing.data.buckets.find((row) => row.bucket_key === "within_7_days")?.customer_count,
    1,
  );
});

test("callprice: supplement repeat pattern counts 1-year repeat orders from first supplement purchase", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "예진",
        raw_analysis_type: "알러지",
        consultation_date: "2024-01-10",
      },
      {
        customer_name: "김철수",
        customer_contact: "010-9999-8888",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2024-01-20",
      },
    ],
    [{ customer_contact: "010-1234-5678" }, { customer_contact: "010-9999-8888" }],
    [],
    [],
    [
      {
        normalized_phone: "01012345678",
        order_date: "2024-01-15",
        net_revenue: "100000",
        product_name: "뉴로마스터 60정",
      },
      {
        normalized_phone: "01012345678",
        order_date: "2024-02-15",
        net_revenue: "100000",
        product_name: "뉴로마스터 60정",
      },
      {
        normalized_phone: "01012345678",
        order_date: "2024-06-01",
        net_revenue: "100000",
        product_name: "바이오밸런스 1개월분",
      },
      {
        normalized_phone: "01099998888",
        order_date: "2024-01-21",
        net_revenue: "120000",
        product_name: "바이오밸런스 1개월분",
      },
    ],
  );

  const pattern = await fetchCallpriceSupplementRepeatPattern(
    {
      range: { startDate: "2024-01-01", endDate: "2025-01-31" },
      referenceDate: "2025-03-01",
    },
    runner as any,
  );

  assert.equal(pattern.status, "success");
  assert.equal(pattern.data.cohort.supplement_starter_customers, 2);
  assert.equal(pattern.data.cohort.matured_supplement_starter_customers, 2);
  assert.equal(pattern.data.summary.avg_total_orders_within_1y, 2);
  assert.equal(pattern.data.summary.avg_repeat_orders_within_1y, 1);
  assert.equal(pattern.data.summary.repeat_purchase_rate_2plus, 0.5);
  assert.equal(pattern.data.summary.repeat_purchase_rate_3plus, 0.5);
  assert.equal(pattern.data.summary.repeat_purchase_rate_4plus, 0);
  assert.equal(
    pattern.data.buckets.find((row) => row.bucket_key === "one_order")?.customer_count,
    1,
  );
  assert.equal(
    pattern.data.buckets.find((row) => row.bucket_key === "three_orders")?.customer_count,
    1,
  );
});

test("callprice: subscription status distinguishes active-state absence from conversion data availability", async () => {
  const runner = createQueuedRunner(
    [{ table_name: "tb_notification_subscriptions" }],
    [
      {
        valid_subscription_order_rows: "120",
        distinct_subscription_order_customers: "45",
        latest_subscription_order_date: "2026-03-28 22:30:12",
      },
    ],
    [{ latest_month_label: "2026-03", latest_month_subscription_customers: "33" }],
    [
      {
        period_label: "6개월",
        non_sub_customers: "100",
        converted_customers: "12",
        conversion_percentage: "12.0",
      },
    ],
    [
      {
        period_label: "6개월",
        subscription_ratio_percentage: "22.6",
        total_supplement_sales: "1000000",
        subscription_supplement_sales: "226000",
        non_subscription_supplement_sales: "774000",
      },
    ],
  );

  const subscriptionStatus = await fetchCallpriceSubscriptionStatus(
    { referenceDate: "2026-03-29" },
    runner as any,
  );

  assert.equal(subscriptionStatus.status, "success");
  assert.equal(subscriptionStatus.data.availability.exact_active_subscriber_count_available, false);
  assert.equal(subscriptionStatus.data.current_snapshot.valid_subscription_order_rows, 120);
  assert.equal(subscriptionStatus.data.current_snapshot.distinct_subscription_order_customers, 45);
  assert.equal(subscriptionStatus.data.current_snapshot.latest_month_label, "2026-03");
  assert.equal(subscriptionStatus.data.current_snapshot.latest_month_subscription_customers, 33);
  assert.equal(subscriptionStatus.data.conversion_periods[0]?.conversion_percentage, 12);
  assert.equal(subscriptionStatus.data.supplement_ratio_periods[0]?.subscription_ratio_percentage, 22.6);
});

test("callprice: subscription consult comparison splits conversion by prior consultation", async () => {
  const runner = createQueuedRunner([
    {
      customer_number: "A",
      normalized_phone: "01011112222",
      first_non_sub_date: "2026-01-05",
    },
    {
      customer_number: "B",
      normalized_phone: "01033334444",
      first_non_sub_date: "2026-01-06",
    },
    {
      customer_number: "C",
      normalized_phone: "01055556666",
      first_non_sub_date: "2026-01-07",
    },
  ], [
    {
      customer_number: "A",
      first_subscription_date: "2026-01-10",
    },
    {
      customer_number: "B",
      first_subscription_date: "2026-01-12",
    },
  ], [
    {
      normalized_phone: "01011112222",
      earliest_completed_consultation_date: "2026-01-01",
    },
  ]);

  const comparison = await fetchCallpriceSubscriptionConsultComparison(
    { referenceDate: "2026-03-29" },
    runner as any,
  );

  assert.equal(comparison.status, "success");
  assert.equal(comparison.data.items[0]?.consulted_conversion_percentage, 100);
  assert.equal(comparison.data.items[0]?.non_consulted_conversion_percentage, 50);
  assert.equal(comparison.data.items[0]?.conversion_rate_diff_percentage_points, 50);
  assert.equal(comparison.data.items[0]?.conversion_rate_multiple, 2);
});

test("callprice: rampup compares month 1-3 and excludes legacy managers by default summary", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "민정고객1",
        customer_contact: "010-1111-1111",
        manager: "민정",
        raw_analysis_type: "알러지",
        consultation_date: "2024-01-02",
      },
      {
        customer_name: "민정고객2",
        customer_contact: "010-1111-2222",
        manager: "민정",
        raw_analysis_type: "알러지",
        consultation_date: "2024-02-05",
      },
      {
        customer_name: "선희고객1",
        customer_contact: "010-2222-1111",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2025-12-12",
      },
      {
        customer_name: "선희고객2",
        customer_contact: "010-2222-2222",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2026-01-15",
      },
      {
        customer_name: "선희고객3",
        customer_contact: "010-2222-3333",
        manager: "선희",
        raw_analysis_type: "중금속",
        consultation_date: "2026-02-20",
      },
    ],
    [
      {
        raw_phone: "010-9999-0001",
        first_test_date: "2024-01-10",
        report_types: ["음식물 과민증"],
      },
      {
        raw_phone: "010-9999-0002",
        first_test_date: "2024-02-10",
        report_types: ["음식물 과민증"],
      },
      {
        raw_phone: "010-9999-0003",
        first_test_date: "2025-12-20",
        report_types: ["종합대사기능"],
      },
      {
        raw_phone: "010-9999-0004",
        first_test_date: "2026-01-20",
        report_types: ["종합대사기능"],
      },
      {
        raw_phone: "010-9999-0005",
        first_test_date: "2026-02-25",
        report_types: ["종합대사기능"],
      },
    ],
    [
      { normalized_phone: "01011111111", order_date: "2024-01-20", net_revenue: "100000" },
      { normalized_phone: "01022221111", order_date: "2025-12-20", net_revenue: "200000" },
      { normalized_phone: "01022222222", order_date: "2026-02-10", net_revenue: "120000" },
      { normalized_phone: "01022223333", order_date: "2026-03-10", net_revenue: "90000" },
      { normalized_phone: "01099990001", order_date: "2024-01-20", net_revenue: "20000" },
      { normalized_phone: "01099990002", order_date: "2024-02-20", net_revenue: "30000" },
      { normalized_phone: "01099990003", order_date: "2025-12-25", net_revenue: "50000" },
      { normalized_phone: "01099990004", order_date: "2026-02-15", net_revenue: "40000" },
      { normalized_phone: "01099990005", order_date: "2026-03-15", net_revenue: "30000" },
    ],
  );

  const rampup = await fetchCallpriceRampup(
    {
      maturityDays: 90,
      baselineScope: "global_non_consultation",
      referenceDate: "2026-06-01",
    },
    runner as any,
  );

  assert.equal(rampup.status, "success");
  assert.deepEqual(rampup.data.legacy_manager_names, ["민정", "경태", "동주"]);
  assert.equal(rampup.data.summary_excluding_legacy[0]?.month_index, 1);
  assert.equal(rampup.data.summary_excluding_legacy[0]?.manager_count, 1);
  assert.equal(rampup.data.summary_excluding_legacy[0]?.conversion_rate, 1);
  assert.equal(rampup.data.summary_excluding_legacy[0]?.avg_revenue_per_customer, 200000);
  assert.equal(
    rampup.data.summary_excluding_legacy[0]?.estimated_incremental_value_per_customer,
    150000,
  );
  assert.equal(rampup.data.summary_excluding_legacy[1]?.estimated_incremental_revenue, 80000);
  assert.equal(rampup.data.summary_excluding_legacy[2]?.estimated_value_per_consultation, 60000);
  assert.equal(rampup.data.summary_including_legacy[0]?.manager_count, 2);
  assert.equal(rampup.data.summary_including_legacy[0]?.estimated_incremental_revenue, 230000);

  const legacyRow = rampup.data.manager_items.find(
    (row) => row.manager === "민정" && row.month_index === 1,
  );
  assert.equal(legacyRow?.legacy_assumption, true);
  assert.equal(legacyRow?.estimated_value_per_consultation, 80000);

  const recentRow = rampup.data.manager_items.find(
    (row) => row.manager === "선희" && row.month_index === 2,
  );
  assert.equal(recentRow?.legacy_assumption, false);
  assert.equal(recentRow?.baseline_matured_customers, 1);
  assert.equal(recentRow?.estimated_incremental_revenue, 80000);
  assert.equal(rampup.data.fortnight_summary_excluding_legacy[0]?.segment_label, "1~2주차");
  assert.equal(rampup.data.checkpoint_summary_excluding_legacy[0]?.segment_label, "5주차");
  assert.equal(rampup.data.probation_guides[0]?.checkpoint_label, "5주차");
  assert.equal(rampup.data.manager_alias_groups[0]?.canonical_manager, "동주");
});

test("callprice: rampup merges 팀장님/서동주 into 동주", async () => {
  const runner = createQueuedRunner(
    [
      {
        customer_name: "동주고객1",
        customer_contact: "010-3333-1111",
        manager: "팀장님",
        raw_analysis_type: "알러지",
        consultation_date: "2024-01-04",
      },
      {
        customer_name: "동주고객2",
        customer_contact: "010-3333-2222",
        manager: "서동주",
        raw_analysis_type: "알러지",
        consultation_date: "2024-01-18",
      },
    ],
    [
      {
        raw_phone: "010-9999-1001",
        first_test_date: "2024-01-08",
        report_types: ["음식물 과민증"],
      },
    ],
    [
      { normalized_phone: "01033331111", order_date: "2024-01-20", net_revenue: "100000" },
      { normalized_phone: "01033332222", order_date: "2024-01-25", net_revenue: "120000" },
      { normalized_phone: "01099991001", order_date: "2024-01-22", net_revenue: "20000" },
    ],
  );

  const rampup = await fetchCallpriceRampup(
    {
      maturityDays: 30,
      baselineScope: "global_non_consultation",
      referenceDate: "2024-03-10",
    },
    runner as any,
  );

  assert.equal(rampup.status, "success");
  assert.deepEqual(rampup.data.recent_manager_names, []);
  assert.deepEqual(rampup.data.summary_including_legacy[0]?.manager_names, ["동주"]);
  assert.equal(rampup.data.summary_including_legacy[0]?.manager_count, 1);
  assert.equal(rampup.data.summary_including_legacy[0]?.completed_consultations, 2);

  const aliasRow = rampup.data.manager_items.find(
    (row) => row.manager === "동주" && row.month_index === 1,
  );
  assert.equal(aliasRow?.legacy_assumption, true);
  assert.equal(aliasRow?.completed_consultations, 2);
});
