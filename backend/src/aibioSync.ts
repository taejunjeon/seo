import { env } from "./env";
import { getCrmDb } from "./crmLocalDb";

const PROJECT_ID = env.AIBIO_SUPABASE_PROJECT_ID ?? "";
const SECRET_KEY = env.AIBIO_SUPABASE_SECRET_KEY ?? "";

const apiBase = () => `https://${PROJECT_ID}.supabase.co/rest/v1`;

const buildHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SECRET_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
  ...extra,
});

const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  return String(phone).replace(/[^0-9]/g, "");
};

export const isAibioConfigured = () => Boolean(PROJECT_ID && SECRET_KEY);

async function fetchAllPages<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string> = {},
  order = "created_at",
): Promise<T[]> {
  if (!isAibioConfigured()) throw new Error("AIBIO Supabase 환경변수 미설정");
  const limit = 1000;
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const qs = new URLSearchParams({
      select: "*",
      order,
      limit: String(limit),
      offset: String(offset),
      ...params,
    });
    const res = await fetch(`${apiBase()}/${table}?${qs}`, { headers: buildHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AIBIO ${table} fetch failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const rows = (await res.json()) as T[];
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

type AibioCustomerRow = {
  customer_id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  birth_year?: number | null;
  region?: string | null;
  referral_source?: string | null;
  first_visit_date?: string | null;
  last_visit_date?: string | null;
  total_visits?: number | null;
  total_revenue?: number | null;
  customer_status?: string | null;
  membership_level?: string | null;
  is_registered?: boolean | null;
  deleted?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AibioPaymentRow = {
  payment_id: number;
  customer_id?: number | null;
  payment_date: string;
  amount: number;
  payment_method?: string | null;
  approval_number?: string | null;
  card_holder_name?: string | null;
  payment_number?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const getLastSyncedAt = (table: "aibio_customers" | "aibio_payments"): string | null => {
  const db = getCrmDb();
  const row = db.prepare(`SELECT MAX(updated_at) AS latest FROM ${table}`).get() as
    | { latest: string | null }
    | undefined;
  return row?.latest ?? null;
};

export async function syncAibioCustomers(opts: { mode: "full" | "incremental" } = { mode: "incremental" }) {
  const params: Record<string, string> = {};
  if (opts.mode === "incremental") {
    const since = getLastSyncedAt("aibio_customers");
    if (since) params.updated_at = `gte.${since}`;
  }
  const rows = await fetchAllPages<AibioCustomerRow>("customers", params, "customer_id");
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO aibio_customers (
      customer_id, name, phone, phone_normalized, email, gender, birth_year, region,
      referral_source, first_visit_date, last_visit_date, total_visits, total_revenue,
      customer_status, membership_level, is_registered, deleted, created_at, updated_at, synced_at
    ) VALUES (
      @customer_id, @name, @phone, @phone_normalized, @email, @gender, @birth_year, @region,
      @referral_source, @first_visit_date, @last_visit_date, @total_visits, @total_revenue,
      @customer_status, @membership_level, @is_registered, @deleted, @created_at, @updated_at, datetime('now')
    )
    ON CONFLICT(customer_id) DO UPDATE SET
      name=excluded.name, phone=excluded.phone, phone_normalized=excluded.phone_normalized,
      email=excluded.email, gender=excluded.gender, birth_year=excluded.birth_year,
      region=excluded.region, referral_source=excluded.referral_source,
      first_visit_date=excluded.first_visit_date, last_visit_date=excluded.last_visit_date,
      total_visits=excluded.total_visits, total_revenue=excluded.total_revenue,
      customer_status=excluded.customer_status, membership_level=excluded.membership_level,
      is_registered=excluded.is_registered, deleted=excluded.deleted,
      created_at=excluded.created_at, updated_at=excluded.updated_at, synced_at=datetime('now')
  `);
  const tx = db.transaction((items: AibioCustomerRow[]) => {
    for (const r of items) {
      stmt.run({
        customer_id: r.customer_id,
        name: r.name ?? null,
        phone: r.phone ?? null,
        phone_normalized: normalizePhone(r.phone),
        email: r.email ?? null,
        gender: r.gender ?? null,
        birth_year: r.birth_year ?? null,
        region: r.region ?? null,
        referral_source: r.referral_source ?? null,
        first_visit_date: r.first_visit_date ?? null,
        last_visit_date: r.last_visit_date ?? null,
        total_visits: r.total_visits ?? 0,
        total_revenue: r.total_revenue ?? 0,
        customer_status: r.customer_status ?? null,
        membership_level: r.membership_level ?? null,
        is_registered: r.is_registered ? 1 : 0,
        deleted: r.deleted ? 1 : 0,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      });
    }
  });
  tx(rows);
  return { synced: rows.length, mode: opts.mode };
}

export async function syncAibioPayments(opts: { mode: "full" | "incremental" } = { mode: "incremental" }) {
  const params: Record<string, string> = {};
  if (opts.mode === "incremental") {
    const since = getLastSyncedAt("aibio_payments");
    if (since) params.updated_at = `gte.${since}`;
  }
  const rows = await fetchAllPages<AibioPaymentRow>("payments", params, "payment_id");
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO aibio_payments (
      payment_id, customer_id, payment_date, amount, payment_method, approval_number,
      card_holder_name, payment_number, notes, is_refund, created_at, updated_at, synced_at
    ) VALUES (
      @payment_id, @customer_id, @payment_date, @amount, @payment_method, @approval_number,
      @card_holder_name, @payment_number, @notes, @is_refund, @created_at, @updated_at, datetime('now')
    )
    ON CONFLICT(payment_id) DO UPDATE SET
      customer_id=excluded.customer_id, payment_date=excluded.payment_date, amount=excluded.amount,
      payment_method=excluded.payment_method, approval_number=excluded.approval_number,
      card_holder_name=excluded.card_holder_name, payment_number=excluded.payment_number,
      notes=excluded.notes, is_refund=excluded.is_refund,
      created_at=excluded.created_at, updated_at=excluded.updated_at, synced_at=datetime('now')
  `);
  const tx = db.transaction((items: AibioPaymentRow[]) => {
    for (const r of items) {
      const amt = Number(r.amount || 0);
      stmt.run({
        payment_id: r.payment_id,
        customer_id: r.customer_id ?? null,
        payment_date: r.payment_date,
        amount: amt,
        payment_method: r.payment_method ?? null,
        approval_number: r.approval_number ?? null,
        card_holder_name: r.card_holder_name ?? null,
        payment_number: r.payment_number ?? null,
        notes: r.notes ?? null,
        is_refund: amt < 0 ? 1 : 0,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      });
    }
  });
  tx(rows);
  return { synced: rows.length, mode: opts.mode };
}

export function getAibioStats() {
  const db = getCrmDb();
  const c = db.prepare("SELECT COUNT(*) AS cnt FROM aibio_customers").get() as { cnt: number };
  const p = db.prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS net_rev FROM aibio_payments").get() as {
    cnt: number;
    net_rev: number;
  };
  const lastC = db.prepare("SELECT MAX(synced_at) AS latest FROM aibio_customers").get() as { latest: string | null };
  const lastP = db.prepare("SELECT MAX(synced_at) AS latest FROM aibio_payments").get() as { latest: string | null };
  return {
    customers: c.cnt,
    payments: p.cnt,
    net_revenue: Number(p.net_rev || 0),
    last_synced: { customers: lastC.latest, payments: lastP.latest },
  };
}
