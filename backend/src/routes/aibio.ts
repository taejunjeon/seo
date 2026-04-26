import { createHash } from "node:crypto";
import { type Request, type Response, Router } from "express";

import type { AttributionLedgerEntry } from "../attribution";
import { listAttributionLedgerEntries } from "../attributionLedgerDb";
import { getCrmDb } from "../crmLocalDb";
import { env } from "../env";
import {
  getAibioStats,
  isAibioConfigured,
  syncAibioCustomers,
  syncAibioPayments,
} from "../aibioSync";

const AIBIO_AD_CRM_ATTRIBUTION_VERSION = "2026-04-26.aibio-ad-crm-attribution.v1";
const AIBIO_ATTRIBUTION_SOURCE = "aibio_imweb";
const AIBIO_REMOTE_LEDGER_TIMEOUT_MS = 8_000;
const AIBIO_SUPABASE_TIMEOUT_MS = 15_000;

type AibioAdCrmDataSource = "vm" | "local";

type AibioCustomerJoinRow = {
  customer_id: number;
  phone?: string | null;
  phone_normalized?: string | null;
  first_visit_date?: string | null;
  last_visit_date?: string | null;
  total_visits?: number | null;
  total_revenue?: number | string | null;
  customer_status?: string | null;
  is_registered?: boolean | number | null;
  referral_source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted?: boolean | number | null;
  synced_at?: string | null;
};

type AibioLeadJoinRow = {
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

type AibioReservationJoinRow = {
  reservation_id: number;
  customer_id: number;
  reservation_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AibioProductUsageJoinRow = {
  usage_id: number;
  customer_id?: number | null;
  service_date?: string | null;
  status?: string | null;
  reservation_id?: number | null;
  created_at?: string | null;
};

type AibioPaymentJoinRow = {
  payment_id: number;
  customer_id?: number | null;
  payment_date?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  is_refund?: boolean | number | null;
};

type AibioRelatedRows = {
  leads: AibioLeadJoinRow[];
  reservations: AibioReservationJoinRow[];
  productUsages: AibioProductUsageJoinRow[];
  payments: AibioPaymentJoinRow[];
  source: "supabase_rest" | "local_sqlite_partial";
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readOne = (value: unknown) => Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(readOne(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const parseBooleanFlag = (value: unknown, fallback = false) => {
  const raw = readOne(value).trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y"].includes(raw);
};

const isoDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const resolveDateWindow = (req: Request) => {
  const rangeDays = parsePositiveInt(req.query.rangeDays, 30, 365);
  const endAtRaw = readOne(req.query.endAt).trim();
  const startAtRaw = readOne(req.query.startAt).trim();
  const end = endAtRaw ? new Date(endAtRaw) : new Date();
  const endAt = Number.isFinite(end.getTime()) ? end : new Date();
  const fallbackStart = new Date(endAt.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const start = startAtRaw ? new Date(startAtRaw) : fallbackStart;
  const startAt = Number.isFinite(start.getTime()) ? start : fallbackStart;
  return {
    rangeDays,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    startDate: isoDateOnly(startAt),
    endDate: isoDateOnly(endAt),
  };
};

const normalizePhoneDigits = (phone: string | null | undefined) => String(phone ?? "").replace(/[^0-9]/g, "");

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

const hashPhoneDigits = (phone: string | null | undefined) => {
  const normalized = normalizePhoneDigits(phone);
  return normalized ? sha256Hex(normalized) : "";
};

const shortHash = (hash: string) => hash ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : "";

const metadataSource = (entry: AttributionLedgerEntry) =>
  typeof entry.metadata?.source === "string" ? entry.metadata.source.trim() : "";

const isAibioFormSubmit = (entry: AttributionLedgerEntry) =>
  entry.touchpoint === "form_submit" && metadataSource(entry) === AIBIO_ATTRIBUTION_SOURCE;

const nestedRecord = (value: unknown, key: string) => {
  if (!isRecord(value)) return {};
  const next = value[key];
  return isRecord(next) ? next : {};
};

const nestedString = (value: unknown, key: string) => {
  if (!isRecord(value)) return "";
  const next = value[key];
  return typeof next === "string" ? next.trim() : "";
};

const extractPhoneHash = (entry: AttributionLedgerEntry) => {
  const formFieldsSafe = nestedRecord(entry.metadata, "form_fields_safe");
  return (
    nestedString(formFieldsSafe, "phone_hash_sha256")
    || nestedString(entry.metadata, "phone_hash_sha256")
    || ""
  ).toLowerCase();
};

const hasAibioDebugMarker = (entry: AttributionLedgerEntry) => {
  const combined = [
    entry.landing,
    entry.referrer,
    JSON.stringify(entry.metadata ?? {}),
  ].join(" ").toLowerCase();
  return (
    combined.includes("__seo_attribution_debug=1")
    || combined.includes("gtm_debug=")
    || combined.includes("tagassistant.google.com")
    || combined.includes("test_fbclid")
    || combined.includes("meta_recoverylab_test")
    || combined.includes("debug=true")
    || combined.includes("test=true")
  );
};

const isTestOrDebugForm = (entry: AttributionLedgerEntry) => {
  const leadQuality = nestedRecord(entry.metadata, "lead_quality");
  const loggedMs = Date.parse(entry.loggedAt);
  const isPreCleanCutoverSetupTest = Number.isFinite(loggedMs)
    && loggedMs < Date.parse("2026-04-08T15:00:00.000Z")
    && !(entry.fbclid || entry.gclid || entry.ttclid || entry.utmSource || entry.utmMedium || entry.utmCampaign || entry.utmContent || entry.utmTerm)
    && [entry.landing, entry.referrer, nestedString(entry.metadata, "formPage")].join(" ").includes("/59");

  return (
    entry.captureMode !== "live"
    || hasAibioDebugMarker(entry)
    || entry.metadata?.is_debug === true
    || entry.metadata?.is_test_contact === true
    || nestedString(leadQuality, "bucket") === "test"
    || Boolean(nestedString(entry.metadata, "test_contact_reason"))
    || isPreCleanCutoverSetupTest
  );
};

const campaignLabel = (entry: AttributionLedgerEntry) =>
  entry.utmCampaign || entry.utmSource || nestedString(nestedRecord(entry.metadata, "first_touch"), "utm_campaign") || "(campaign 없음)";

const landingLabel = (landing: string) => {
  try {
    const url = new URL(landing);
    const params = new URLSearchParams(url.search);
    for (const key of ["fbclid", "gclid", "ttclid", "fbp", "fbc"]) params.delete(key);
    const search = params.toString();
    return `${url.pathname}${search ? `?${search}` : ""}` || "/";
  } catch {
    return landing || "";
  }
};

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const boolValue = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

const fetchRemoteAibioLedgerEntries = async (window: { startAt: string; endAt: string }, limit: number) => {
  const base = env.ATTRIBUTION_OPERATIONAL_BASE_URL.replace(/\/$/, "");
  const url = new URL("/api/attribution/ledger", base);
  url.searchParams.set("source", AIBIO_ATTRIBUTION_SOURCE);
  url.searchParams.set("startAt", window.startAt);
  url.searchParams.set("endAt", window.endAt);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, { signal: AbortSignal.timeout(AIBIO_REMOTE_LEDGER_TIMEOUT_MS) });
  const body = await response.json() as unknown;
  if (!response.ok || !isRecord(body) || body.ok !== true || !Array.isArray(body.items)) {
    throw new Error(`remote attribution ledger failed: HTTP ${response.status}`);
  }
  return body.items as AttributionLedgerEntry[];
};

const readAibioLedgerEntries = async (
  dataSource: AibioAdCrmDataSource,
  window: { startAt: string; endAt: string },
  limit: number,
) => {
  const warnings: string[] = [];
  if (dataSource === "vm") {
    try {
      return {
        entries: await fetchRemoteAibioLedgerEntries(window, limit),
        source: "operational_vm_ledger" as const,
        warnings,
      };
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
      warnings.push("VM 원장 조회 실패로 로컬 attribution_ledger로 fallback");
    }
  }

  const startMs = Date.parse(window.startAt);
  const endMs = Date.parse(window.endAt);
  const entries = listAttributionLedgerEntries()
    .filter(isAibioFormSubmit)
    .filter((entry) => {
      const loggedMs = Date.parse(entry.loggedAt);
      if (!Number.isFinite(loggedMs)) return true;
      return loggedMs >= startMs && loggedMs <= endMs;
    })
    .slice(0, limit);
  return { entries, source: "local_sqlite_ledger" as const, warnings };
};

const aibioHeaders = () => ({
  apikey: env.AIBIO_SUPABASE_SECRET_KEY ?? "",
  Authorization: `Bearer ${env.AIBIO_SUPABASE_SECRET_KEY ?? ""}`,
});

const fetchAibioRestPages = async <T,>(
  table: string,
  params: Record<string, string>,
  order: string,
): Promise<T[]> => {
  if (!isAibioConfigured()) throw new Error("AIBIO_SUPABASE_* env not configured");
  const projectId = env.AIBIO_SUPABASE_PROJECT_ID ?? "";
  const limit = 1000;
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const qs = new URLSearchParams({
      ...params,
      order,
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(`https://${projectId}.supabase.co/rest/v1/${table}?${qs}`, {
      headers: aibioHeaders(),
      signal: AbortSignal.timeout(AIBIO_SUPABASE_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AIBIO ${table} read failed: ${response.status} ${body.slice(0, 160)}`);
    }
    const page = await response.json() as T[];
    rows.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }

  return rows;
};

const fetchAibioRowsByCustomerIds = async <T,>(
  table: string,
  select: string,
  customerIds: number[],
  order: string,
) => {
  const out: T[] = [];
  for (let i = 0; i < customerIds.length; i += 200) {
    const chunk = customerIds.slice(i, i + 200);
    out.push(...await fetchAibioRestPages<T>(table, {
      select,
      customer_id: `in.(${chunk.join(",")})`,
    }, order));
  }
  return out;
};

const loadAibioCustomersForHashJoin = async (): Promise<{
  rows: AibioCustomerJoinRow[];
  source: "supabase_rest" | "local_sqlite";
  warning: string | null;
}> => {
  if (isAibioConfigured()) {
    try {
      const rows = await fetchAibioRestPages<AibioCustomerJoinRow>("customers", {
        select: "customer_id,phone,first_visit_date,last_visit_date,total_visits,total_revenue,customer_status,is_registered,referral_source,created_at,updated_at,deleted",
      }, "customer_id");
      return { rows, source: "supabase_rest", warning: null };
    } catch (error) {
      return {
        rows: [],
        source: "supabase_rest",
        warning: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const rows = getCrmDb().prepare(`
    SELECT
      customer_id, phone_normalized, first_visit_date, last_visit_date, total_visits, total_revenue,
      customer_status, is_registered, referral_source, created_at, updated_at, deleted, synced_at
    FROM aibio_customers
    WHERE COALESCE(deleted, 0) = 0
  `).all() as AibioCustomerJoinRow[];
  return { rows, source: "local_sqlite", warning: "AIBIO Supabase 미설정으로 local SQLite customer cache 사용" };
};

const loadAibioRelatedRows = async (customerIds: number[]): Promise<AibioRelatedRows> => {
  if (customerIds.length === 0) {
    return { leads: [], reservations: [], productUsages: [], payments: [], source: "supabase_rest", warnings: [] };
  }

  if (isAibioConfigured()) {
    const warnings: string[] = [];
    const safeFetch = async <T,>(label: string, table: string, select: string, order: string) => {
      try {
        return await fetchAibioRowsByCustomerIds<T>(table, select, customerIds, order);
      } catch (error) {
        warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    };

    const [leads, reservations, productUsages, payments] = await Promise.all([
      safeFetch<AibioLeadJoinRow>(
        "marketing_leads",
        "marketing_leads",
        "lead_id,customer_id,lead_date,lead_channel,db_channel,db_entry_date,phone_consult_date,visit_consult_date,registration_date,status,revenue",
        "lead_date",
      ),
      safeFetch<AibioReservationJoinRow>(
        "reservations",
        "reservations",
        "reservation_id,customer_id,reservation_date,status,created_at",
        "reservation_date",
      ),
      safeFetch<AibioProductUsageJoinRow>(
        "product_usage",
        "product_usage",
        "usage_id,customer_id,service_date,status,reservation_id,created_at",
        "service_date",
      ),
      safeFetch<AibioPaymentJoinRow>(
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
  `).all(...customerIds) as AibioPaymentJoinRow[];

  return {
    leads: [],
    reservations: [],
    productUsages: [],
    payments,
    source: "local_sqlite_partial",
    warnings: ["AIBIO Supabase 미설정: payments만 local SQLite cache에서 연결, visit/reservation/usage는 미연동"],
  };
};

const groupByCustomer = <T extends { customer_id?: number | null }>(rows: T[]) => {
  const out = new Map<number, T[]>();
  for (const row of rows) {
    if (typeof row.customer_id !== "number") continue;
    const existing = out.get(row.customer_id) ?? [];
    existing.push(row);
    out.set(row.customer_id, existing);
  }
  return out;
};

const minDate = (values: Array<string | null | undefined>) => {
  const dates = values.filter(Boolean).map(String).sort();
  return dates[0] ?? null;
};

const maxDate = (values: Array<string | null | undefined>) => {
  const dates = values.filter(Boolean).map(String).sort();
  return dates[dates.length - 1] ?? null;
};

const summarizeCustomerJourney = (
  customer: AibioCustomerJoinRow,
  related: {
    leads: AibioLeadJoinRow[];
    reservations: AibioReservationJoinRow[];
    productUsages: AibioProductUsageJoinRow[];
    payments: AibioPaymentJoinRow[];
  },
) => {
  const lead = related.leads[0] ?? null;
  const reservationStatuses = related.reservations.reduce<Record<string, number>>((acc, reservation) => {
    const status = String(reservation.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const positivePayments = related.payments.filter((payment) => numberValue(payment.amount) > 0 && !boolValue(payment.is_refund));
  const netRevenue = related.payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const grossRevenue = positivePayments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  return {
    customerId: customer.customer_id,
    customer: {
      createdDate: customer.created_at?.slice(0, 10) ?? null,
      firstVisitDate: customer.first_visit_date?.slice(0, 10) ?? null,
      lastVisitDate: customer.last_visit_date?.slice(0, 10) ?? null,
      totalVisits: numberValue(customer.total_visits),
      totalRevenue: numberValue(customer.total_revenue),
      status: customer.customer_status ?? null,
      isRegistered: boolValue(customer.is_registered),
      referralSource: customer.referral_source ?? null,
    },
    lead: lead ? {
      leadDate: lead.lead_date?.slice(0, 10) ?? null,
      leadChannel: lead.lead_channel ?? null,
      dbChannel: lead.db_channel ?? null,
      dbEntryDate: lead.db_entry_date?.slice(0, 10) ?? null,
      phoneConsultDate: lead.phone_consult_date?.slice(0, 10) ?? null,
      visitConsultDate: lead.visit_consult_date?.slice(0, 10) ?? null,
      registrationDate: lead.registration_date?.slice(0, 10) ?? null,
      status: lead.status ?? null,
      revenue: numberValue(lead.revenue),
    } : null,
    reservations: {
      total: related.reservations.length,
      byStatus: reservationStatuses,
      firstDate: minDate(related.reservations.map((reservation) => reservation.reservation_date?.slice(0, 10))),
      lastDate: maxDate(related.reservations.map((reservation) => reservation.reservation_date?.slice(0, 10))),
    },
    productUsage: {
      total: related.productUsages.length,
      completed: related.productUsages.filter((usage) => String(usage.status ?? "completed") === "completed").length,
      firstServiceDate: minDate(related.productUsages.map((usage) => usage.service_date?.slice(0, 10))),
      lastServiceDate: maxDate(related.productUsages.map((usage) => usage.service_date?.slice(0, 10))),
    },
    payments: {
      count: positivePayments.length,
      grossRevenue,
      netRevenue,
      firstPaymentDate: minDate(positivePayments.map((payment) => payment.payment_date?.slice(0, 10))),
      lastPaymentDate: maxDate(positivePayments.map((payment) => payment.payment_date?.slice(0, 10))),
    },
  };
};

export const createAibioRouter = () => {
  const router = Router();

  router.get("/api/aibio/ad-crm-attribution", async (req: Request, res: Response) => {
    try {
      res.set("Cache-Control", "no-store");
      const dataSource: AibioAdCrmDataSource = readOne(req.query.dataSource).toLowerCase() === "local" ? "local" : "vm";
      const includeRows = parseBooleanFlag(req.query.includeRows, true);
      const limit = parsePositiveInt(req.query.limit, 500, 5000);
      const window = resolveDateWindow(req);

      const ledger = await readAibioLedgerEntries(dataSource, window, limit);
      const formSubmits = ledger.entries.filter(isAibioFormSubmit);
      const operationalForms = formSubmits.filter((entry) => !isTestOrDebugForm(entry));
      const formsWithHash = operationalForms
        .map((entry) => ({ entry, phoneHash: extractPhoneHash(entry) }))
        .filter((row) => row.phoneHash);

      const customerLoad = await loadAibioCustomersForHashJoin();
      const customerWarnings = customerLoad.warning ? [customerLoad.warning] : [];
      const customerByPhoneHash = new Map<string, AibioCustomerJoinRow>();
      let customersWithHash = 0;
      let duplicateCustomerHashes = 0;

      for (const customer of customerLoad.rows) {
        if (boolValue(customer.deleted)) continue;
        const hash = customer.phone ? hashPhoneDigits(customer.phone) : hashPhoneDigits(customer.phone_normalized);
        if (!hash) continue;
        customersWithHash += 1;
        if (customerByPhoneHash.has(hash)) duplicateCustomerHashes += 1;
        if (!customerByPhoneHash.has(hash)) customerByPhoneHash.set(hash, customer);
      }

      const matchedCustomerIds = new Set<number>();
      const matchedRows = formsWithHash.map((row) => {
        const customer = customerByPhoneHash.get(row.phoneHash) ?? null;
        if (customer) matchedCustomerIds.add(customer.customer_id);
        return { ...row, customer };
      });

      const related = await loadAibioRelatedRows([...matchedCustomerIds]);
      const leadsByCustomer = groupByCustomer(related.leads);
      const reservationsByCustomer = groupByCustomer(related.reservations);
      const productUsagesByCustomer = groupByCustomer(related.productUsages);
      const paymentsByCustomer = groupByCustomer(related.payments);

      const journeyByCustomer = new Map<number, ReturnType<typeof summarizeCustomerJourney>>();
      for (const customer of customerByPhoneHash.values()) {
        if (!matchedCustomerIds.has(customer.customer_id)) continue;
        journeyByCustomer.set(customer.customer_id, summarizeCustomerJourney(customer, {
          leads: leadsByCustomer.get(customer.customer_id) ?? [],
          reservations: reservationsByCustomer.get(customer.customer_id) ?? [],
          productUsages: productUsagesByCustomer.get(customer.customer_id) ?? [],
          payments: paymentsByCustomer.get(customer.customer_id) ?? [],
        }));
      }

      const rows = matchedRows.map(({ entry, phoneHash, customer }) => {
        const journey = customer ? journeyByCustomer.get(customer.customer_id) ?? null : null;
        const leadQuality = nestedRecord(entry.metadata, "lead_quality");
        return {
          loggedAt: entry.loggedAt,
          campaign: campaignLabel(entry),
          utmSource: entry.utmSource || null,
          utmMedium: entry.utmMedium || null,
          utmCampaign: entry.utmCampaign || null,
          landing: landingLabel(entry.landing),
          referrer: entry.referrer ? landingLabel(entry.referrer) : null,
          clickIdType: entry.fbclid ? "fbclid" : entry.gclid ? "gclid" : entry.ttclid ? "ttclid" : null,
          leadQuality: {
            bucket: nestedString(leadQuality, "bucket") || null,
            score: numberValue(leadQuality.score),
          },
          phoneHash: {
            present: Boolean(phoneHash),
            preview: shortHash(phoneHash),
          },
          matched: Boolean(customer),
          match: customer ? {
            customerId: customer.customer_id,
            journey,
          } : null,
          matchBlocker: customer ? null : "phone_hash_not_found_in_aibio_customers",
        };
      });

      const uniqueMatchedCustomers = [...matchedCustomerIds]
        .map((customerId) => journeyByCustomer.get(customerId))
        .filter(Boolean) as Array<ReturnType<typeof summarizeCustomerJourney>>;
      const campaignGroups = new Map<string, {
        forms: number;
        withPhoneHash: number;
        matchedCustomerIds: Set<number>;
        firstVisitCustomerIds: Set<number>;
        visitConsultCustomerIds: Set<number>;
        reservationCustomerIds: Set<number>;
        productUsageCustomerIds: Set<number>;
        paymentCustomerIds: Set<number>;
      }>();

      for (const entry of operationalForms) {
        const key = campaignLabel(entry);
        const group = campaignGroups.get(key) ?? {
          forms: 0,
          withPhoneHash: 0,
          matchedCustomerIds: new Set<number>(),
          firstVisitCustomerIds: new Set<number>(),
          visitConsultCustomerIds: new Set<number>(),
          reservationCustomerIds: new Set<number>(),
          productUsageCustomerIds: new Set<number>(),
          paymentCustomerIds: new Set<number>(),
        };
        group.forms += 1;
        const phoneHash = extractPhoneHash(entry);
        if (phoneHash) group.withPhoneHash += 1;
        const customer = phoneHash ? customerByPhoneHash.get(phoneHash) : null;
        const journey = customer ? journeyByCustomer.get(customer.customer_id) ?? null : null;
        if (customer && journey) {
          group.matchedCustomerIds.add(customer.customer_id);
          if (journey.customer.firstVisitDate) group.firstVisitCustomerIds.add(customer.customer_id);
          if (journey.lead?.visitConsultDate) group.visitConsultCustomerIds.add(customer.customer_id);
          if (journey.reservations.total > 0) group.reservationCustomerIds.add(customer.customer_id);
          if (journey.productUsage.total > 0) group.productUsageCustomerIds.add(customer.customer_id);
          if (journey.payments.grossRevenue > 0) group.paymentCustomerIds.add(customer.customer_id);
        }
        campaignGroups.set(key, group);
      }

      const revenueByCustomer = new Map(uniqueMatchedCustomers.map((journey) => [journey.customerId, journey.payments.grossRevenue]));
      const campaignRows = [...campaignGroups.entries()]
        .map(([campaign, group]) => {
          const revenue = [...group.paymentCustomerIds].reduce((sum, customerId) => sum + (revenueByCustomer.get(customerId) ?? 0), 0);
          return {
            campaign,
            forms: group.forms,
            withPhoneHash: group.withPhoneHash,
            matchedCustomers: group.matchedCustomerIds.size,
            firstVisitCustomers: group.firstVisitCustomerIds.size,
            visitConsultCustomers: group.visitConsultCustomerIds.size,
            reservationCustomers: group.reservationCustomerIds.size,
            productUsageCustomers: group.productUsageCustomerIds.size,
            paymentCustomers: group.paymentCustomerIds.size,
            grossRevenue: revenue,
          };
        })
        .sort((a, b) => b.forms - a.forms || b.matchedCustomers - a.matchedCustomers);

      const summary = {
        rawFormSubmits: formSubmits.length,
        operationalFormSubmits: operationalForms.length,
        excludedTestOrDebug: formSubmits.length - operationalForms.length,
        withPhoneHash: formsWithHash.length,
        phoneHashCoverageRate: operationalForms.length > 0 ? formsWithHash.length / operationalForms.length : null,
        matchedForms: matchedRows.filter((row) => row.customer).length,
        matchedCustomers: matchedCustomerIds.size,
        matchRateAmongHashedForms: formsWithHash.length > 0
          ? matchedRows.filter((row) => row.customer).length / formsWithHash.length
          : null,
        customerHashIndexSize: customersWithHash,
        duplicateCustomerHashes,
        firstVisitCustomers: uniqueMatchedCustomers.filter((journey) => journey.customer.firstVisitDate).length,
        visitConsultCustomers: uniqueMatchedCustomers.filter((journey) => journey.lead?.visitConsultDate).length,
        reservationCustomers: uniqueMatchedCustomers.filter((journey) => journey.reservations.total > 0).length,
        productUsageCustomers: uniqueMatchedCustomers.filter((journey) => journey.productUsage.total > 0).length,
        paymentCustomers: uniqueMatchedCustomers.filter((journey) => journey.payments.grossRevenue > 0).length,
        grossRevenue: uniqueMatchedCustomers.reduce((sum, journey) => sum + journey.payments.grossRevenue, 0),
        netRevenue: uniqueMatchedCustomers.reduce((sum, journey) => sum + journey.payments.netRevenue, 0),
      };

      const latestLedgerAt = formSubmits
        .map((entry) => entry.loggedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const latestCustomerSyncedAt = customerLoad.rows
        .map((row) => row.synced_at ?? row.updated_at ?? "")
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      res.json({
        ok: true,
        version: AIBIO_AD_CRM_ATTRIBUTION_VERSION,
        generatedAt: new Date().toISOString(),
        filters: {
          dataSource,
          startAt: window.startAt,
          endAt: window.endAt,
          rangeDays: window.rangeDays,
          limit,
        },
        sources: {
          attributionLedger: ledger.source,
          aibioCustomers: customerLoad.source,
          aibioRelated: related.source,
          privacy: "raw name/phone/email are not returned; matching uses SHA-256 normalized phone in server memory",
        },
        freshness: {
          latestLedgerAt,
          latestCustomerSyncedAt,
        },
        summary,
        campaigns: campaignRows,
        rows: includeRows ? rows : undefined,
        warnings: [...ledger.warnings, ...customerWarnings, ...related.warnings],
        notes: [
          "읽기 전용 API다. attribution ledger, AIBIO Supabase, local SQLite 어디에도 쓰지 않는다.",
          "2026-04-25 v8.1 이후 폼만 phone_hash_sha256이 있으므로 과거 폼은 고객 조인 대상에서 제외된다.",
          "캠페인별 방문/결제 판단은 matchedCustomers가 충분히 쌓인 뒤에 사용한다.",
        ],
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "ad crm attribution failed" });
    }
  });

  router.get("/api/aibio/stats", (_req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      res.json({ ok: true, ...getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "stats failed" });
    }
  });

  router.post("/api/aibio/sync-customers", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const out = await syncAibioCustomers({ mode });
      res.json({ ok: true, ...out, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  router.post("/api/aibio/sync-payments", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const out = await syncAibioPayments({ mode });
      res.json({ ok: true, ...out, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  router.post("/api/aibio/sync-all", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const c = await syncAibioCustomers({ mode });
      const p = await syncAibioPayments({ mode });
      res.json({ ok: true, customers: c, payments: p, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  // 통합 등급 분포 · 로컬 SQLite (aibio_*) 기준 빠른 읽기
  router.get("/api/aibio/tier-distribution", (_req: Request, res: Response) => {
    try {
      const db = getCrmDb();
      const rows = db
        .prepare(
          `
          WITH cust_rev AS (
            SELECT customer_id, SUM(amount) AS rev
            FROM aibio_payments
            WHERE payment_date >= date('now','-12 months')
            GROUP BY customer_id
          )
          SELECT
            CASE
              WHEN rev >= 10000000 THEN 'PRIME'
              WHEN rev >= 5000000  THEN 'PLATINUM'
              WHEN rev >= 2000000  THEN 'GOLD'
              WHEN rev >= 1000000  THEN 'SILVER'
              WHEN rev >= 300000   THEN 'INITIATE'
              ELSE 'below'
            END AS tier,
            COUNT(*) AS customers,
            SUM(rev) AS total_rev
          FROM cust_rev
          GROUP BY 1
          ORDER BY CASE tier
            WHEN 'PRIME' THEN 1
            WHEN 'PLATINUM' THEN 2
            WHEN 'GOLD' THEN 3
            WHEN 'SILVER' THEN 4
            WHEN 'INITIATE' THEN 5
            ELSE 6
          END
          `,
        )
        .all();
      res.json({ ok: true, basedOn: "aibio_payments (12 months)", tiers: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  return router;
};
