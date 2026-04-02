import type { QueryResult, QueryResultRow } from "pg";

import { resolveIsoDateRange } from "./dateRange";
import { queryPg } from "./postgres";
import { shiftIsoDateByDays } from "./utils/isoDate";

export const CONSULTATION_STATUS_GROUPS = [
  "completed",
  "no_answer",
  "rescheduled",
  "canceled",
  "other",
  "unknown",
] as const;

export const CONSULTATION_CANDIDATE_SCENARIOS = [
  "completed_followup",
  "reschedule_recall",
] as const;

export type ConsultationStatusGroup = (typeof CONSULTATION_STATUS_GROUPS)[number];
export type ConsultationCandidateScenario = (typeof CONSULTATION_CANDIDATE_SCENARIOS)[number];
export type ConsultationProductCategory = "test_kit" | "supplement" | "other";

export type ConsultationDateRange = {
  startDate: string;
  endDate: string;
};

type QueryRunner = <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[],
) => Promise<QueryResult<TRow>>;

const CONSULTATION_LOOKBACK_DAYS = 90;
const COMPLETED_FOLLOWUP_WINDOW_DAYS = 30;
const RESCHEDULE_RECALL_WINDOW_DAYS = 14;

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const trimToEmpty = (value?: string | null) => value?.trim() ?? "";

const normalizeTextForMatch = (value?: string | null) =>
  trimToEmpty(value).toLowerCase().replace(/\s+/g, "");

const toNumber = (value: unknown): number => {
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

const serializeDateRange = (range: ConsultationDateRange): ConsultationDateRange => ({
  startDate: range.startDate,
  endDate: range.endDate,
});

const toIsoDateOnly = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return null;
};

export const normalizePhone = (value?: string | null) => trimToEmpty(value).replace(/[^0-9]/g, "");

export const normalizeConsultationStatus = (value?: string | null): ConsultationStatusGroup => {
  const normalized = normalizeTextForMatch(value);

  if (!normalized || normalized === "-" || normalized === "nan") return "unknown";
  if (normalized.includes("완료")) return "completed";
  if (normalized.includes("부재")) return "no_answer";
  if (normalized.includes("변경") || normalized.includes("채팅")) return "rescheduled";
  if (
    normalized.includes("취소") ||
    normalized.includes("보류") ||
    normalized.includes("중복")
  ) {
    return "canceled";
  }
  return "other";
};

export const categorizeProductName = (value?: string | null): ConsultationProductCategory => {
  const normalized = normalizeTextForMatch(value);

  const isTestKit =
    normalized.includes("검사권") ||
    normalized.includes("검사") ||
    normalized.includes("분석") ||
    normalized.includes("알러지") ||
    normalized.includes("알레르기") ||
    normalized.includes("과민증") ||
    normalized.includes("중금속") ||
    normalized.includes("유기산") ||
    normalized.includes("장내") ||
    normalized.includes("호르몬") ||
    normalized.includes("대사기능");

  if (isTestKit) return "test_kit";

  const isSupplement =
    normalized.includes("영양제") ||
    normalized.includes("비타민") ||
    normalized.includes("프로바이오틱") ||
    normalized.includes("프리바이오틱") ||
    normalized.includes("뉴로마스터") ||
    normalized.includes("바이오밸런스") ||
    normalized.includes("클린밸런스") ||
    normalized.includes("당당케어") ||
    normalized.includes("엔자임") ||
    normalized.includes("썬화이버") ||
    normalized.includes("효소") ||
    normalized.includes("다래케어") ||
    normalized.includes("멀티미네랄") ||
    normalized.includes("아연") ||
    normalized.includes("마그네슘") ||
    normalized.includes("sod");

  return isSupplement ? "supplement" : "other";
};

export const getDefaultConsultationRange = (
  endDate: string = todayIsoDate(),
  lookbackDays: number = CONSULTATION_LOOKBACK_DAYS,
): ConsultationDateRange => ({
  startDate: shiftIsoDateByDays(endDate, -(Math.max(1, lookbackDays) - 1)),
  endDate,
});

export const resolveConsultationDateRange = (params: {
  startDateParam?: string;
  endDateParam?: string;
}) => {
  const defaults = getDefaultConsultationRange();

  return resolveIsoDateRange({
    startDateParam: params.startDateParam,
    endDateParam: params.endDateParam,
    defaultStartDate: defaults.startDate,
    defaultEndDate: defaults.endDate,
  });
};

const normalizeStatusExprSql = (column: string) =>
  `regexp_replace(lower(coalesce(${column}::text, '')), '\\s+', '', 'g')`;

const normalizedPhoneSql = (column: string) =>
  `regexp_replace(coalesce(${column}::text, ''), '[^0-9]', '', 'g')`;

const normalizedCustomerNumberSql = (column: string) =>
  `translate(trim(coalesce(${column}::text, '')), '+-', '')`;

const consultationStatusGroupSql = (column: string) => {
  const normalized = normalizeStatusExprSql(column);

  return `
    case
      when ${normalized} in ('', '-', 'nan') then 'unknown'
      when ${normalized} like '%완료%' then 'completed'
      when ${normalized} like '%부재%' then 'no_answer'
      when ${normalized} like '%변경%' or ${normalized} like '%채팅%' then 'rescheduled'
      when ${normalized} like '%취소%' or ${normalized} like '%보류%' or ${normalized} like '%중복%' then 'canceled'
      else 'other'
    end
  `;
};

const productCategorySql = (column: string) => {
  const normalized = normalizeStatusExprSql(column);

  return `
    case
      when ${normalized} like '%검사권%'
        or ${normalized} like '%검사%'
        or ${normalized} like '%분석%'
        or ${normalized} like '%알러지%'
        or ${normalized} like '%알레르기%'
        or ${normalized} like '%과민증%'
        or ${normalized} like '%중금속%'
        or ${normalized} like '%유기산%'
        or ${normalized} like '%장내%'
        or ${normalized} like '%호르몬%'
        or ${normalized} like '%대사기능%'
      then 'test_kit'
      when ${normalized} like '%영양제%'
        or ${normalized} like '%비타민%'
        or ${normalized} like '%프로바이오틱%'
        or ${normalized} like '%프리바이오틱%'
        or ${normalized} like '%뉴로마스터%'
        or ${normalized} like '%바이오밸런스%'
        or ${normalized} like '%클린밸런스%'
        or ${normalized} like '%당당케어%'
        or ${normalized} like '%엔자임%'
        or ${normalized} like '%썬화이버%'
        or ${normalized} like '%효소%'
        or ${normalized} like '%다래케어%'
        or ${normalized} like '%멀티미네랄%'
        or ${normalized} like '%아연%'
        or ${normalized} like '%마그네슘%'
        or ${normalized} like '%sod%'
      then 'supplement'
      else 'other'
    end
  `;
};

const orderDateSql = `
  case
    when trim(coalesce(payment_complete_time, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(payment_complete_time), 10)::date
    when trim(coalesce(order_date, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(order_date), 10)::date
    else null
  end
`;

const orderNetRevenueSql = `
  greatest(
    coalesce(nullif(paid_price, 0), nullif(total_price, 0), nullif(final_order_amount, 0), nullif(item_price, 0), 0)
      - coalesce(total_refunded_price, 0),
    0
  )
`;

const consultationBaseCte = `
  with consultation_base as (
    select
      insertdate::date as consultation_date,
      coalesce(nullif(trim(customer_name), ''), '이름없음') as customer_name,
      trim(coalesce(customer_contact, '')) as customer_contact,
      ${normalizedPhoneSql("customer_contact")} as normalized_phone,
      coalesce(nullif(trim(manager), ''), '미지정') as manager,
      coalesce(nullif(trim(analysis_type), ''), '미분류') as analysis_type,
      trim(coalesce(consultation_status, '')) as raw_status,
      ${consultationStatusGroupSql("consultation_status")} as status_group
    from public.tb_consultation_records
    where insertdate between $1::date and $2::date
  )
`;

const ordersBaseCte = `
  orders_base as (
    select
      ${normalizedCustomerNumberSql("customer_number")} as normalized_phone,
      coalesce(nullif(trim(product_name), ''), '미분류') as product_name,
      ${productCategorySql("product_name")} as product_category,
      ${orderDateSql} as order_date,
      ${orderNetRevenueSql} as net_revenue
    from public.tb_iamweb_users
    where ${normalizedCustomerNumberSql("customer_number")} <> ''
  )
`;

const ltrContactsCte = `
  ltr_contacts as (
    select distinct ${normalizedCustomerNumberSql("customer_number")} as normalized_phone
    from public.ltr_customer_cohort
    where ${normalizedCustomerNumberSql("customer_number")} <> ''
  )
`;

const buildConsultationFilterClause = (
  params: unknown[],
  filters: {
    manager?: string;
    statusGroup?: ConsultationStatusGroup;
    analysisType?: string;
  },
  alias = "consultation_base",
) => {
  const conditions: string[] = [];

  if (trimToEmpty(filters.manager)) {
    params.push(trimToEmpty(filters.manager));
    conditions.push(`${alias}.manager = $${params.length}`);
  }

  if (filters.statusGroup) {
    params.push(filters.statusGroup);
    conditions.push(`${alias}.status_group = $${params.length}`);
  }

  if (trimToEmpty(filters.analysisType)) {
    params.push(trimToEmpty(filters.analysisType));
    conditions.push(`${alias}.analysis_type = $${params.length}`);
  }

  return conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
};

const clampLimit = (value: number | undefined, fallback: number, max: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
};

export const fetchConsultationSummary = async (
  range: ConsultationDateRange,
  runner: QueryRunner = queryPg,
) => {
  const params = [range.startDate, range.endDate];

  const [totalsResult, statusResult, managerResult, analysisResult] = await Promise.all([
    runner<{
      consultation_rows: number | string;
      distinct_contacts: number | string;
      distinct_managers: number | string;
      distinct_analysis_types: number | string;
    }>(
      `
        ${consultationBaseCte}
        select
          count(*) as consultation_rows,
          count(distinct nullif(normalized_phone, '')) as distinct_contacts,
          count(distinct manager) as distinct_managers,
          count(distinct analysis_type) as distinct_analysis_types
        from consultation_base
      `,
      params,
    ),
    runner<{ status_group: ConsultationStatusGroup; raw_status: string; count: number | string }>(
      `
        ${consultationBaseCte}
        select
          status_group,
          coalesce(nullif(raw_status, ''), '미기재') as raw_status,
          count(*) as count
        from consultation_base
        group by status_group, raw_status
        order by count(*) desc, raw_status asc
      `,
      params,
    ),
    runner<{ manager: string; count: number | string }>(
      `
        ${consultationBaseCte}
        select manager, count(*) as count
        from consultation_base
        group by manager
        order by count(*) desc, manager asc
      `,
      params,
    ),
    runner<{ analysis_type: string; count: number | string }>(
      `
        ${consultationBaseCte}
        select analysis_type, count(*) as count
        from consultation_base
        group by analysis_type
        order by count(*) desc, analysis_type asc
      `,
      params,
    ),
  ]);

  const totalsRow = totalsResult.rows[0];

  return {
    ok: true as const,
    range: serializeDateRange(range),
    totals: {
      consultationRows: toNumber(totalsRow?.consultation_rows),
      distinctContacts: toNumber(totalsRow?.distinct_contacts),
      distinctManagers: toNumber(totalsRow?.distinct_managers),
      distinctAnalysisTypes: toNumber(totalsRow?.distinct_analysis_types),
    },
    statusBreakdown: statusResult.rows.map((row) => ({
      statusGroup: row.status_group,
      rawStatus: row.raw_status,
      count: toNumber(row.count),
    })),
    managerBreakdown: managerResult.rows.map((row) => ({
      manager: row.manager,
      count: toNumber(row.count),
    })),
    analysisTypeBreakdown: analysisResult.rows.map((row) => ({
      analysisType: row.analysis_type,
      count: toNumber(row.count),
    })),
  };
};

export const fetchConsultationManagers = async (
  paramsInput: {
    range: ConsultationDateRange;
    limit?: number;
  },
  runner: QueryRunner = queryPg,
) => {
  const params: unknown[] = [
    paramsInput.range.startDate,
    paramsInput.range.endDate,
    clampLimit(paramsInput.limit, 20, 100),
  ];

  const result = await runner<{
    manager: string;
    consultation_rows: number | string;
    distinct_contacts: number | string;
    completed_rows: number | string;
    matched_order_contacts: number | string;
  }>(
    `
      ${consultationBaseCte},
      order_contacts as (
        select distinct ${normalizedCustomerNumberSql("customer_number")} as normalized_phone
        from public.tb_iamweb_users
        where ${normalizedCustomerNumberSql("customer_number")} <> ''
      ),
      manager_contacts as (
        select manager, normalized_phone
        from consultation_base
        where normalized_phone <> ''
        group by manager, normalized_phone
      ),
      manager_matches as (
        select mc.manager, count(*) as matched_order_contacts
        from manager_contacts mc
        join order_contacts oc on oc.normalized_phone = mc.normalized_phone
        group by mc.manager
      )
      select
        consultation_base.manager,
        count(*) as consultation_rows,
        count(distinct nullif(consultation_base.normalized_phone, '')) as distinct_contacts,
        count(*) filter (where consultation_base.status_group = 'completed') as completed_rows,
        coalesce(manager_matches.matched_order_contacts, 0) as matched_order_contacts
      from consultation_base
      left join manager_matches on manager_matches.manager = consultation_base.manager
      group by consultation_base.manager, manager_matches.matched_order_contacts
      order by count(*) desc, consultation_base.manager asc
      limit $3
    `,
    params,
  );

  return {
    ok: true as const,
    range: serializeDateRange(paramsInput.range),
    items: result.rows.map((row) => {
      const distinctContacts = toNumber(row.distinct_contacts);
      const completedRows = toNumber(row.completed_rows);
      const matchedOrderContacts = toNumber(row.matched_order_contacts);

      return {
        manager: row.manager,
        consultationRows: toNumber(row.consultation_rows),
        distinctContacts,
        completedRows,
        completedRate: toRate(completedRows, toNumber(row.consultation_rows)),
        matchedOrderContacts,
        orderMatchRate: toRate(matchedOrderContacts, distinctContacts),
      };
    }),
  };
};

export const fetchConsultationOrderMatch = async (
  paramsInput: {
    range: ConsultationDateRange;
    manager?: string;
    statusGroup?: ConsultationStatusGroup;
  },
  runner: QueryRunner = queryPg,
) => {
  const params: unknown[] = [paramsInput.range.startDate, paramsInput.range.endDate];
  const filterClause = buildConsultationFilterClause(params, paramsInput);

  const result = await runner<{
    consult_distinct_contacts: number | string;
    iamweb_distinct_customers: number | string;
    ltr_distinct_customers: number | string;
    consult_to_order_overlap: number | string;
    consult_to_ltr_overlap: number | string;
  }>(
    `
      ${consultationBaseCte},
      filtered_consultation as (
        select * from consultation_base
        ${filterClause}
      ),
      consult_contacts as (
        select distinct normalized_phone
        from filtered_consultation
        where normalized_phone <> ''
      ),
      iamweb_contacts as (
        select distinct ${normalizedCustomerNumberSql("customer_number")} as normalized_phone
        from public.tb_iamweb_users
        where ${normalizedCustomerNumberSql("customer_number")} <> ''
      ),
      ${ltrContactsCte}
      select
        (select count(*) from consult_contacts) as consult_distinct_contacts,
        (select count(*) from iamweb_contacts) as iamweb_distinct_customers,
        (select count(*) from ltr_contacts) as ltr_distinct_customers,
        (
          select count(*)
          from consult_contacts
          join iamweb_contacts using (normalized_phone)
        ) as consult_to_order_overlap,
        (
          select count(*)
          from consult_contacts
          join ltr_contacts using (normalized_phone)
        ) as consult_to_ltr_overlap
    `,
    params,
  );

  const row = result.rows[0];
  const consultDistinctContacts = toNumber(row?.consult_distinct_contacts);
  const consultToOrderOverlap = toNumber(row?.consult_to_order_overlap);
  const consultToLtrOverlap = toNumber(row?.consult_to_ltr_overlap);

  return {
    ok: true as const,
    range: serializeDateRange(paramsInput.range),
    filters: {
      manager: trimToEmpty(paramsInput.manager) || null,
      statusGroup: paramsInput.statusGroup ?? null,
    },
    totals: {
      consultDistinctContacts,
      iamwebDistinctCustomers: toNumber(row?.iamweb_distinct_customers),
      ltrDistinctCustomers: toNumber(row?.ltr_distinct_customers),
      consultToOrderOverlap,
      consultToLtrOverlap,
      orderMatchRate: toRate(consultToOrderOverlap, consultDistinctContacts),
      ltrMatchRate: toRate(consultToLtrOverlap, consultDistinctContacts),
    },
  };
};

export const fetchConsultationProductFollowup = async (
  paramsInput: {
    range: ConsultationDateRange;
    manager?: string;
    statusGroup?: ConsultationStatusGroup;
  },
  runner: QueryRunner = queryPg,
) => {
  const params: unknown[] = [paramsInput.range.startDate, paramsInput.range.endDate];
  const filterClause = buildConsultationFilterClause(params, paramsInput);

  const result = await runner<{
    status_group: ConsultationStatusGroup;
    product_category: ConsultationProductCategory;
    customer_count: number | string;
    order_count: number | string;
    total_revenue: number | string;
  }>(
    `
      ${consultationBaseCte},
      filtered_consultation as (
        select * from consultation_base
        ${filterClause}
      ),
      consult_contacts as (
        select
          status_group,
          normalized_phone,
          max(consultation_date) as latest_consultation_date
        from filtered_consultation
        where normalized_phone <> ''
        group by status_group, normalized_phone
      ),
      ${ordersBaseCte}
      select
        consult_contacts.status_group,
        orders_base.product_category,
        count(distinct consult_contacts.normalized_phone) as customer_count,
        count(*) as order_count,
        coalesce(sum(orders_base.net_revenue), 0) as total_revenue
      from consult_contacts
      join orders_base
        on orders_base.normalized_phone = consult_contacts.normalized_phone
       and orders_base.order_date is not null
       and orders_base.order_date >= consult_contacts.latest_consultation_date
      group by consult_contacts.status_group, orders_base.product_category
      order by count(distinct consult_contacts.normalized_phone) desc,
        count(*) desc,
        consult_contacts.status_group asc,
        orders_base.product_category asc
    `,
    params,
  );

  return {
    ok: true as const,
    range: serializeDateRange(paramsInput.range),
    filters: {
      manager: trimToEmpty(paramsInput.manager) || null,
      statusGroup: paramsInput.statusGroup ?? null,
    },
    items: result.rows.map((row) => {
      const orderCount = toNumber(row.order_count);
      const totalRevenue = toNumber(row.total_revenue);

      return {
        statusGroup: row.status_group,
        productCategory: row.product_category,
        customerCount: toNumber(row.customer_count),
        orderCount,
        totalRevenue,
        avgOrderValue: toRoundedAverage(totalRevenue, orderCount),
      };
    }),
  };
};

const getCandidateWindowDays = (scenario: ConsultationCandidateScenario) =>
  scenario === "completed_followup"
    ? COMPLETED_FOLLOWUP_WINDOW_DAYS
    : RESCHEDULE_RECALL_WINDOW_DAYS;

export const fetchConsultationCandidates = async (
  paramsInput: {
    scenario: ConsultationCandidateScenario;
    manager?: string;
    analysisType?: string;
    limit?: number;
    referenceDate?: string;
  },
  runner: QueryRunner = queryPg,
) => {
  const endDate = paramsInput.referenceDate ?? todayIsoDate();
  const windowDays = getCandidateWindowDays(paramsInput.scenario);
  const requestedLimit = clampLimit(paramsInput.limit, 100, 300);
  const sampleLimit = Math.max(500, Math.min(5_000, requestedLimit * 40));
  const range = {
    startDate: shiftIsoDateByDays(endDate, -(windowDays - 1)),
    endDate,
  };

  const params: unknown[] = [range.startDate, range.endDate];
  const filterClause = buildConsultationFilterClause(params, {
    manager: paramsInput.manager,
    analysisType: paramsInput.analysisType,
  });
  params.push(sampleLimit);
  const sampleLimitPlaceholder = `$${params.length}`;

  const latestConsultationResult = await runner<{
    normalized_phone: string;
    customer_name: string;
    customer_contact: string;
    manager: string;
    analysis_type: string;
    consultation_date: string;
    raw_status: string;
    status_group: ConsultationStatusGroup;
  }>(
    `
      ${consultationBaseCte},
      filtered_consultation as (
        select *
        from consultation_base
        ${filterClause}
      ),
      latest_consultation as (
        select *
        from (
          select distinct on (normalized_phone)
            normalized_phone,
            customer_name,
            customer_contact,
            manager,
            analysis_type,
            consultation_date,
            raw_status,
            status_group
          from filtered_consultation
          where normalized_phone <> ''
            and (
              ${paramsInput.scenario === "completed_followup"
                ? "status_group = 'completed'"
                : "status_group in ('no_answer', 'rescheduled')"}
            )
          order by normalized_phone, consultation_date desc, manager asc, customer_name asc
        ) deduped_consultation
        order by consultation_date desc, manager asc, customer_name asc
        limit ${sampleLimitPlaceholder}
      )
      select
        latest_consultation.*
      from latest_consultation
      order by latest_consultation.consultation_date desc, latest_consultation.manager asc, latest_consultation.customer_name asc
    `,
    params,
  );

  const latestConsultations = latestConsultationResult.rows.map((row) => ({
    normalizedPhone: row.normalized_phone,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    manager: row.manager,
    analysisType: row.analysis_type,
    consultationDate: toIsoDateOnly(row.consultation_date),
    rawStatus: row.raw_status || "미기재",
    statusGroup: row.status_group,
  }));

  const phones = Array.from(
    new Set(
      latestConsultations
        .map((row) => row.normalizedPhone)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const ordersByPhone = new Map<
    string,
    Array<{
      productName: string;
      productCategory: ConsultationProductCategory;
      orderDate: string | null;
    }>
  >();
  const ltrPhones = new Set<string>();

  if (phones.length > 0) {
    const [orderRowsResult, ltrRowsResult] = await Promise.all([
      runner<{
        normalized_phone: string;
        product_name: string;
        product_category: ConsultationProductCategory;
        order_date: string | null;
      }>(
        `
          select
            customer_number as normalized_phone,
            coalesce(nullif(trim(product_name), ''), '미분류') as product_name,
            ${productCategorySql("product_name")} as product_category,
            ${orderDateSql} as order_date
          from public.tb_iamweb_users
          where customer_number = any($1::text[])
        `,
        [phones],
      ),
      runner<{ normalized_phone: string }>(
        `
          select distinct customer_number as normalized_phone
          from public.ltr_customer_cohort
          where customer_number = any($1::text[])
        `,
        [phones],
      ),
    ]);

    for (const row of orderRowsResult.rows) {
      const phone = row.normalized_phone;
      if (!phone) continue;
      const bucket = ordersByPhone.get(phone) ?? [];
      bucket.push({
        productName: row.product_name,
        productCategory: row.product_category,
        orderDate: toIsoDateOnly(row.order_date),
      });
      ordersByPhone.set(phone, bucket);
    }

    for (const row of ltrRowsResult.rows) {
      if (row.normalized_phone) {
        ltrPhones.add(row.normalized_phone);
      }
    }
  }

  const items = [];
  for (const consultation of latestConsultations) {
    const phone = consultation.normalizedPhone;
    const consultationDate = consultation.consultationDate;
    const matchedOrders = (ordersByPhone.get(phone) ?? [])
      .filter((order) => !consultationDate || !order.orderDate || order.orderDate >= consultationDate)
      .sort((a, b) => (b.orderDate ?? "").localeCompare(a.orderDate ?? ""));

    const postConsultOrderCount = matchedOrders.length;
    const hasSupplementOrder = matchedOrders.some((order) => order.productCategory === "supplement");
    const lastOrder = matchedOrders[0];
    const shouldInclude =
      paramsInput.scenario === "completed_followup"
        ? postConsultOrderCount === 0 || !hasSupplementOrder
        : consultation.statusGroup === "no_answer" || consultation.statusGroup === "rescheduled";

    if (!shouldInclude) continue;

    items.push({
      normalizedPhone: consultation.normalizedPhone,
      customerName: consultation.customerName,
      customerContact: consultation.customerContact,
      manager: consultation.manager,
      analysisType: consultation.analysisType,
      consultationDate,
      rawStatus: consultation.rawStatus,
      statusGroup: consultation.statusGroup,
      postConsultOrderCount,
      hasSupplementOrder,
      lastOrderDate: lastOrder?.orderDate ?? null,
      lastOrderProduct: lastOrder?.productName ?? null,
      hasLtr: ltrPhones.has(phone),
      recommendedAction:
        paramsInput.scenario === "completed_followup"
          ? postConsultOrderCount === 0
            ? "order_conversion_nudge"
            : "supplement_followup"
          : "reschedule_recall",
    });

    if (items.length >= requestedLimit) break;
  }

  return {
    ok: true as const,
    scenario: paramsInput.scenario,
    range,
    windowDays,
    count: items.length,
    items,
  };
};
