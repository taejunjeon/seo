import { createHash } from "node:crypto";

import { getCrmDb } from "./crmLocalDb";
import { env } from "./env";

const PROJECT_ID = env.AIBIO_SUPABASE_PROJECT_ID ?? "";
const SECRET_KEY = env.AIBIO_SUPABASE_SECRET_KEY ?? "";
const SUPABASE_TIMEOUT_MS = 12_000;

type CrmSource = "supabase_rest" | "local_sqlite_partial";
type Confidence = "high" | "medium" | "low";

type CustomerRow = {
  customer_id: number;
  phone?: string | null;
  phone_normalized?: string | null;
  first_visit_date?: string | null;
  last_visit_date?: string | null;
  total_visits?: number | string | null;
  total_revenue?: number | string | null;
  customer_status?: string | null;
  is_registered?: boolean | number | null;
  referral_source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted?: boolean | number | null;
  synced_at?: string | null;
};

type LeadRow = {
  lead_id: number;
  customer_id: number;
  lead_date?: string | null;
  lead_channel?: string | null;
  db_channel?: string | null;
  db_entry_date?: string | null;
  phone_consult_date?: string | null;
  visit_consult_date?: string | null;
  registration_date?: string | null;
  status?: string | null;
  revenue?: number | string | null;
};

type ReservationRow = {
  reservation_id: number;
  customer_id: number;
  reservation_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ProductUsageRow = {
  usage_id: number;
  customer_id?: number | null;
  service_date?: string | null;
  status?: string | null;
  reservation_id?: number | null;
  created_at?: string | null;
};

type PaymentRow = {
  payment_id: number;
  customer_id?: number | null;
  payment_date?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  is_refund?: boolean | number | null;
};

type RelatedRows = {
  leads: LeadRow[];
  reservations: ReservationRow[];
  productUsages: ProductUsageRow[];
  payments: PaymentRow[];
  source: CrmSource;
  warnings: string[];
};

export type AibioCrmJourneyMatch = {
  matched: boolean;
  matchBlocker: string | null;
  customerId: number | null;
  confidence: Confidence;
  customer: {
    createdDate: string | null;
    firstVisitDate: string | null;
    lastVisitDate: string | null;
    totalVisits: number;
    totalRevenue: number;
    status: string | null;
    isRegistered: boolean;
    referralSource: string | null;
  } | null;
  lead: {
    leadDate: string | null;
    leadChannel: string | null;
    dbChannel: string | null;
    dbEntryDate: string | null;
    phoneConsultDate: string | null;
    visitConsultDate: string | null;
    registrationDate: string | null;
    status: string | null;
    revenue: number;
  } | null;
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    firstDate: string | null;
    lastDate: string | null;
  };
  productUsage: {
    total: number;
    completed: number;
    firstDate: string | null;
    lastDate: string | null;
  };
  payments: {
    total: number;
    positiveCount: number;
    grossRevenue: number;
    netRevenue: number;
    firstDate: string | null;
    lastDate: string | null;
  };
};

export type AibioCrmJourneyLoad = {
  source: CrmSource;
  generatedAt: string;
  freshness: {
    latestCustomerSyncedAt: string | null;
    latestPaymentSyncedAt: string | null;
  };
  warnings: string[];
  summary: {
    requestedPhoneHashes: number;
    matchedCustomers: number;
    reservationCustomers: number;
    productUsageCustomers: number;
    paymentCustomers: number;
    grossRevenue: number;
    netRevenue: number;
    confidence: Confidence;
  };
  byPhoneHash: Map<string, AibioCrmJourneyMatch>;
};

const isConfigured = () => Boolean(PROJECT_ID && SECRET_KEY);

const apiBase = () => `https://${PROJECT_ID}.supabase.co/rest/v1`;

const headers = () => ({
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
});

const normalizePhone = (phone: string | null | undefined) => String(phone ?? "").replace(/[^0-9]/g, "");

export const hashAibioPhoneDigits = (phone: string | null | undefined) => {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  return createHash("sha256").update(digits).digest("hex");
};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asBool = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

const day = (value: string | null | undefined) => value?.slice(0, 10) ?? null;

const minDate = (values: Array<string | null | undefined>) => {
  const dates = values.filter(Boolean).map(String).sort();
  return dates[0] ?? null;
};

const maxDate = (values: Array<string | null | undefined>) => {
  const dates = values.filter(Boolean).map(String).sort();
  return dates.at(-1) ?? null;
};

const emptyMatch = (matchBlocker: string): AibioCrmJourneyMatch => ({
  matched: false,
  matchBlocker,
  customerId: null,
  confidence: "low",
  customer: null,
  lead: null,
  reservations: { total: 0, byStatus: {}, firstDate: null, lastDate: null },
  productUsage: { total: 0, completed: 0, firstDate: null, lastDate: null },
  payments: { total: 0, positiveCount: 0, grossRevenue: 0, netRevenue: 0, firstDate: null, lastDate: null },
});

async function fetchPages<T>(table: string, params: Record<string, string>, order: string): Promise<T[]> {
  const limit = 1000;
  const out: T[] = [];
  let offset = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
    try {
      const qs = new URLSearchParams({
        select: "*",
        order,
        limit: String(limit),
        offset: String(offset),
        ...params,
      });
      const response = await fetch(`${apiBase()}/${table}?${qs}`, {
        headers: headers(),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${table} fetch failed: ${response.status} ${body.slice(0, 200)}`);
      }
      const rows = (await response.json()) as T[];
      out.push(...rows);
      if (rows.length < limit) return out;
      offset += limit;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function fetchRowsByCustomerIds<T>(
  table: string,
  select: string,
  customerIds: number[],
  order: string,
) {
  const out: T[] = [];
  for (let i = 0; i < customerIds.length; i += 200) {
    const chunk = customerIds.slice(i, i + 200);
    out.push(...await fetchPages<T>(table, {
      select,
      customer_id: `in.(${chunk.join(",")})`,
    }, order));
  }
  return out;
}

async function loadCustomers(): Promise<{ rows: CustomerRow[]; source: CrmSource; warnings: string[] }> {
  if (isConfigured()) {
    try {
      const rows = await fetchPages<CustomerRow>("customers", {
        select: "customer_id,phone,first_visit_date,last_visit_date,total_visits,total_revenue,customer_status,is_registered,referral_source,created_at,updated_at,deleted",
      }, "customer_id");
      return { rows, source: "supabase_rest", warnings: [] };
    } catch (error) {
      return {
        rows: [],
        source: "supabase_rest",
        warnings: [`customers: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  const rows = getCrmDb().prepare(`
    SELECT
      customer_id, phone_normalized, first_visit_date, last_visit_date, total_visits, total_revenue,
      customer_status, is_registered, referral_source, created_at, updated_at, deleted, synced_at
    FROM aibio_customers
    WHERE COALESCE(deleted, 0) = 0
  `).all() as CustomerRow[];
  return {
    rows,
    source: "local_sqlite_partial",
    warnings: ["AIBIO Supabase env 미설정: local SQLite customer/payment cache만 사용"],
  };
}

async function loadRelatedRows(customerIds: number[], preferredSource: CrmSource): Promise<RelatedRows> {
  if (customerIds.length === 0) {
    return { leads: [], reservations: [], productUsages: [], payments: [], source: preferredSource, warnings: [] };
  }

  if (preferredSource === "supabase_rest" && isConfigured()) {
    const warnings: string[] = [];
    const safeFetch = async <T>(label: string, table: string, select: string, order: string) => {
      try {
        return await fetchRowsByCustomerIds<T>(table, select, customerIds, order);
      } catch (error) {
        warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    };

    const [leads, reservations, productUsages, payments] = await Promise.all([
      safeFetch<LeadRow>(
        "marketing_leads",
        "marketing_leads",
        "lead_id,customer_id,lead_date,lead_channel,db_channel,db_entry_date,phone_consult_date,visit_consult_date,registration_date,status,revenue",
        "lead_date",
      ),
      safeFetch<ReservationRow>(
        "reservations",
        "reservations",
        "reservation_id,customer_id,reservation_date,status,created_at",
        "reservation_date",
      ),
      safeFetch<ProductUsageRow>(
        "product_usage",
        "product_usage",
        "usage_id,customer_id,service_date,status,reservation_id,created_at",
        "service_date",
      ),
      safeFetch<PaymentRow>(
        "payments",
        "payments",
        "payment_id,customer_id,payment_date,amount,created_at",
        "payment_date",
      ),
    ]);

    return { leads, reservations, productUsages, payments, source: "supabase_rest", warnings };
  }

  const placeholders = customerIds.map(() => "?").join(",");
  const payments = getCrmDb().prepare(`
    SELECT payment_id, customer_id, payment_date, amount, created_at, is_refund
    FROM aibio_payments
    WHERE customer_id IN (${placeholders})
  `).all(...customerIds) as PaymentRow[];

  return {
    leads: [],
    reservations: [],
    productUsages: [],
    payments,
    source: "local_sqlite_partial",
    warnings: ["local SQLite fallback은 payments만 연결한다. reservations/product_usage/marketing_leads는 Supabase env 필요"],
  };
}

const groupByCustomer = <T extends { customer_id?: number | null }>(rows: T[]) => {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    if (typeof row.customer_id !== "number") continue;
    const current = grouped.get(row.customer_id) ?? [];
    current.push(row);
    grouped.set(row.customer_id, current);
  }
  return grouped;
};

const summarizeJourney = (
  customer: CustomerRow,
  related: {
    leads: LeadRow[];
    reservations: ReservationRow[];
    productUsages: ProductUsageRow[];
    payments: PaymentRow[];
  },
  source: CrmSource,
): AibioCrmJourneyMatch => {
  const lead = related.leads[0] ?? null;
  const reservationStatuses = related.reservations.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const positivePayments = related.payments.filter((payment) => asNumber(payment.amount) > 0 && !asBool(payment.is_refund));
  const netRevenue = related.payments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const grossRevenue = positivePayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  return {
    matched: true,
    matchBlocker: null,
    customerId: customer.customer_id,
    confidence: source === "supabase_rest" ? "high" : "medium",
    customer: {
      createdDate: day(customer.created_at),
      firstVisitDate: day(customer.first_visit_date),
      lastVisitDate: day(customer.last_visit_date),
      totalVisits: asNumber(customer.total_visits),
      totalRevenue: asNumber(customer.total_revenue),
      status: customer.customer_status ?? null,
      isRegistered: asBool(customer.is_registered),
      referralSource: customer.referral_source ?? null,
    },
    lead: lead ? {
      leadDate: day(lead.lead_date),
      leadChannel: lead.lead_channel ?? null,
      dbChannel: lead.db_channel ?? null,
      dbEntryDate: day(lead.db_entry_date),
      phoneConsultDate: day(lead.phone_consult_date),
      visitConsultDate: day(lead.visit_consult_date),
      registrationDate: day(lead.registration_date),
      status: lead.status ?? null,
      revenue: asNumber(lead.revenue),
    } : null,
    reservations: {
      total: related.reservations.length,
      byStatus: reservationStatuses,
      firstDate: minDate(related.reservations.map((row) => day(row.reservation_date))),
      lastDate: maxDate(related.reservations.map((row) => day(row.reservation_date))),
    },
    productUsage: {
      total: related.productUsages.length,
      completed: related.productUsages.filter((row) => String(row.status ?? "completed") === "completed").length,
      firstDate: minDate(related.productUsages.map((row) => day(row.service_date))),
      lastDate: maxDate(related.productUsages.map((row) => day(row.service_date))),
    },
    payments: {
      total: related.payments.length,
      positiveCount: positivePayments.length,
      grossRevenue,
      netRevenue,
      firstDate: minDate(related.payments.map((row) => day(row.payment_date))),
      lastDate: maxDate(related.payments.map((row) => day(row.payment_date))),
    },
  };
};

export async function loadAibioCrmJourneysByPhoneHash(phoneHashes: string[]): Promise<AibioCrmJourneyLoad> {
  const requestedPhoneHashes = [...new Set(phoneHashes.filter(Boolean))];
  const generatedAt = new Date().toISOString();
  const customers = await loadCustomers();
  const customerByPhoneHash = new Map<string, CustomerRow>();
  let duplicateCustomerHashes = 0;

  for (const customer of customers.rows) {
    if (asBool(customer.deleted)) continue;
    const hash = customer.phone ? hashAibioPhoneDigits(customer.phone) : hashAibioPhoneDigits(customer.phone_normalized);
    if (!hash) continue;
    if (customerByPhoneHash.has(hash)) duplicateCustomerHashes += 1;
    if (!customerByPhoneHash.has(hash)) customerByPhoneHash.set(hash, customer);
  }

  const matchedCustomers = requestedPhoneHashes
    .map((hash) => customerByPhoneHash.get(hash) ?? null)
    .filter((row): row is CustomerRow => Boolean(row));
  const customerIds = [...new Set(matchedCustomers.map((row) => row.customer_id))];
  const related = await loadRelatedRows(customerIds, customers.source);
  const leadsByCustomer = groupByCustomer(related.leads);
  const reservationsByCustomer = groupByCustomer(related.reservations);
  const productUsagesByCustomer = groupByCustomer(related.productUsages);
  const paymentsByCustomer = groupByCustomer(related.payments);

  const byPhoneHash = new Map<string, AibioCrmJourneyMatch>();
  for (const hash of requestedPhoneHashes) {
    const customer = customerByPhoneHash.get(hash);
    if (!customer) {
      byPhoneHash.set(hash, emptyMatch("phone_hash_not_found_in_aibio_customers"));
      continue;
    }
    byPhoneHash.set(hash, summarizeJourney(customer, {
      leads: leadsByCustomer.get(customer.customer_id) ?? [],
      reservations: reservationsByCustomer.get(customer.customer_id) ?? [],
      productUsages: productUsagesByCustomer.get(customer.customer_id) ?? [],
      payments: paymentsByCustomer.get(customer.customer_id) ?? [],
    }, related.source));
  }

  const matches = [...byPhoneHash.values()];
  const matched = matches.filter((match) => match.matched);
  const latestCustomerSyncedAt = customers.rows
    .map((row) => row.synced_at ?? row.updated_at ?? "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const latestPaymentSyncedAt = related.payments
    .map((row) => row.created_at ?? row.payment_date ?? "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const warnings = [
    ...customers.warnings,
    ...related.warnings,
    ...(duplicateCustomerHashes > 0 ? [`duplicate_customer_phone_hashes:${duplicateCustomerHashes}`] : []),
  ];
  const confidence: Confidence = customers.source === "supabase_rest" && warnings.length === 0
    ? "high"
    : customers.source === "supabase_rest"
      ? "medium"
      : "low";

  return {
    source: related.source,
    generatedAt,
    freshness: {
      latestCustomerSyncedAt,
      latestPaymentSyncedAt,
    },
    warnings,
    summary: {
      requestedPhoneHashes: requestedPhoneHashes.length,
      matchedCustomers: new Set(matched.map((match) => match.customerId).filter(Boolean)).size,
      reservationCustomers: matched.filter((match) => match.reservations.total > 0).length,
      productUsageCustomers: matched.filter((match) => match.productUsage.total > 0).length,
      paymentCustomers: matched.filter((match) => match.payments.grossRevenue > 0).length,
      grossRevenue: matched.reduce((sum, match) => sum + match.payments.grossRevenue, 0),
      netRevenue: matched.reduce((sum, match) => sum + match.payments.netRevenue, 0),
      confidence,
    },
    byPhoneHash,
  };
}
