import { createHash, randomUUID } from "node:crypto";

import { getCrmDb } from "./crmLocalDb";

export const AIBIO_NATIVE_LEAD_VERSION = "2026-04-26.aibio-native-lead-ledger.v1";

export const AIBIO_NATIVE_LEAD_STATUSES = [
  "new",
  "contact_attempted",
  "contacted",
  "reserved",
  "visited",
  "paid",
  "no_show",
  "invalid_duplicate",
] as const;

export type AibioNativeLeadStatus = (typeof AIBIO_NATIVE_LEAD_STATUSES)[number];

export const AIBIO_NATIVE_STATUS_LABELS: Record<AibioNativeLeadStatus, string> = {
  new: "신규",
  contact_attempted: "연락시도",
  contacted: "연락완료",
  reserved: "예약완료",
  visited: "방문완료",
  paid: "결제완료",
  no_show: "노쇼",
  invalid_duplicate: "불량/중복",
};

const STATUS_SET = new Set<string>(AIBIO_NATIVE_LEAD_STATUSES);
const DUPLICATE_WINDOW_DAYS = 30;

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "fbc",
  "fbp",
  "ga_client_id",
  "landing_path",
  "referrer",
  "capturedAt",
] as const;

type RawLeadRow = {
  lead_id: string;
  site: string;
  source: string;
  status: AibioNativeLeadStatus;
  status_updated_at: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_hash: string;
  customer_phone_last4: string;
  age_range: string;
  purpose: string;
  acquisition_channel: string;
  preferred_time: string;
  privacy_consent: number;
  privacy_consented_at: string | null;
  marketing_consent: number;
  marketing_consented_at: string | null;
  landing_path: string;
  referrer: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  ga_client_id: string | null;
  attribution_json: string;
  first_touch_json: string;
  last_touch_json: string;
  duplicate_of_lead_id: string | null;
  duplicate_window_days: number;
  is_duplicate: number;
  assigned_to: string | null;
  operator_memo: string | null;
  reservation_at: string | null;
  visit_at: string | null;
  payment_amount: number | null;
  payment_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AibioNativeLeadInput = {
  name?: unknown;
  phone?: unknown;
  ageRange?: unknown;
  purpose?: unknown;
  channel?: unknown;
  preferredTime?: unknown;
  consent?: unknown;
  privacyConsent?: unknown;
  marketingConsent?: unknown;
  landingPath?: unknown;
  attribution?: unknown;
  firstTouch?: unknown;
  lastTouch?: unknown;
};

export type AibioNativeLeadPublic = {
  leadId: string;
  site: string;
  source: string;
  status: AibioNativeLeadStatus;
  statusLabel: string;
  statusUpdatedAt: string;
  customerNameMasked: string;
  customerPhoneMasked: string;
  phoneHashSha256: string;
  ageRange: string;
  purpose: string;
  channel: string;
  preferredTime: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  landingPath: string;
  referrer: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  adKeys: {
    fbclid: boolean;
    gclid: boolean;
    fbc: boolean;
    fbp: boolean;
    gaClientId: boolean;
  };
  attributionKeys: string[];
  isDuplicate: boolean;
  duplicateOfLeadId: string | null;
  assignedTo: string | null;
  operatorMemo: string | null;
  reservationAt: string | null;
  visitAt: string | null;
  paymentAmount: number | null;
  paymentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AibioNativeLeadContact = {
  leadId: string;
  name: string;
  phone: string;
  phoneHashSha256: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeText = (value: unknown, max = 512) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const normalizePhoneDigits = (value: unknown) => normalizeText(value, 64).replace(/[^0-9]/g, "");

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

const hashPhoneDigits = (phoneDigits: string) => sha256Hex(phoneDigits);

const readBoolean = (value: unknown) => value === true || value === "true" || value === "1" || value === 1;

const parseJsonObject = (raw: string | null | undefined) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const safeJson = (value: unknown) => JSON.stringify(isRecord(value) ? value : {});

const pickAttribution = (value: unknown) => {
  const result: Record<string, string> = {};
  if (!isRecord(value)) return result;
  for (const key of ATTRIBUTION_KEYS) {
    const text = normalizeText(value[key], 1024);
    if (text) result[key] = text;
  }
  return result;
};

const maskName = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return "";
  if (normalized.length === 1) return "*";
  if (normalized.length === 2) return `${normalized[0]}*`;
  return `${normalized[0]}${"*".repeat(normalized.length - 2)}${normalized.at(-1)}`;
};

const maskPhone = (phone: string) => {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 7) return "****";
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
};

const parseIsoDate = (value: unknown) => {
  const text = normalizeText(value, 64);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const validateStatus = (status: unknown): AibioNativeLeadStatus => {
  const value = normalizeText(status, 64);
  if (!STATUS_SET.has(value)) throw new Error(`invalid_status:${value || "empty"}`);
  return value as AibioNativeLeadStatus;
};

export function isValidAibioNativeLeadStatus(status: unknown): status is AibioNativeLeadStatus {
  return STATUS_SET.has(normalizeText(status, 64));
}

export function initAibioNativeLeadTables() {
  const db = getCrmDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS aibio_native_leads (
      lead_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'aibio',
      source TEXT NOT NULL DEFAULT 'native',
      status TEXT NOT NULL DEFAULT 'new',
      status_updated_at TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_phone_hash TEXT NOT NULL,
      customer_phone_last4 TEXT NOT NULL,
      age_range TEXT NOT NULL,
      purpose TEXT NOT NULL,
      acquisition_channel TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      privacy_consent INTEGER NOT NULL DEFAULT 0,
      privacy_consented_at TEXT,
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      marketing_consented_at TEXT,
      landing_path TEXT NOT NULL,
      referrer TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      fbclid TEXT,
      gclid TEXT,
      fbc TEXT,
      fbp TEXT,
      ga_client_id TEXT,
      attribution_json TEXT NOT NULL DEFAULT '{}',
      first_touch_json TEXT NOT NULL DEFAULT '{}',
      last_touch_json TEXT NOT NULL DEFAULT '{}',
      duplicate_of_lead_id TEXT,
      duplicate_window_days INTEGER NOT NULL DEFAULT 30,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT,
      operator_memo TEXT,
      reservation_at TEXT,
      visit_at TEXT,
      payment_amount REAL,
      payment_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aibio_native_lead_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL REFERENCES aibio_native_leads(lead_id),
      previous_status TEXT,
      next_status TEXT NOT NULL,
      changed_by TEXT,
      memo TEXT,
      changed_at TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_aibio_native_leads_created ON aibio_native_leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_native_leads_status ON aibio_native_leads(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_native_leads_phone_hash ON aibio_native_leads(customer_phone_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_aibio_native_leads_landing ON aibio_native_leads(landing_path, created_at);
  `);
  return db;
}

const rowToPublicLead = (row: RawLeadRow): AibioNativeLeadPublic => {
  const attribution = parseJsonObject(row.attribution_json);
  return {
    leadId: row.lead_id,
    site: row.site,
    source: row.source,
    status: row.status,
    statusLabel: AIBIO_NATIVE_STATUS_LABELS[row.status] ?? row.status,
    statusUpdatedAt: row.status_updated_at,
    customerNameMasked: maskName(row.customer_name),
    customerPhoneMasked: maskPhone(row.customer_phone),
    phoneHashSha256: row.customer_phone_hash,
    ageRange: row.age_range,
    purpose: row.purpose,
    channel: row.acquisition_channel,
    preferredTime: row.preferred_time,
    privacyConsent: Boolean(row.privacy_consent),
    marketingConsent: Boolean(row.marketing_consent),
    landingPath: row.landing_path,
    referrer: row.referrer || null,
    utm: {
      source: row.utm_source,
      medium: row.utm_medium,
      campaign: row.utm_campaign,
      content: row.utm_content,
      term: row.utm_term,
    },
    adKeys: {
      fbclid: Boolean(row.fbclid),
      gclid: Boolean(row.gclid),
      fbc: Boolean(row.fbc),
      fbp: Boolean(row.fbp),
      gaClientId: Boolean(row.ga_client_id),
    },
    attributionKeys: Object.keys(attribution).sort(),
    isDuplicate: Boolean(row.is_duplicate),
    duplicateOfLeadId: row.duplicate_of_lead_id,
    assignedTo: row.assigned_to,
    operatorMemo: row.operator_memo,
    reservationAt: row.reservation_at,
    visitAt: row.visit_at,
    paymentAmount: row.payment_amount,
    paymentAt: row.payment_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const rowToContact = (row: RawLeadRow): AibioNativeLeadContact => ({
  leadId: row.lead_id,
  name: row.customer_name,
  phone: row.customer_phone,
  phoneHashSha256: row.customer_phone_hash,
});

const summarizeRows = (rows: RawLeadRow[]) => {
  const byStatus = Object.fromEntries(AIBIO_NATIVE_LEAD_STATUSES.map((status) => [status, 0])) as Record<AibioNativeLeadStatus, number>;
  const byLanding = new Map<string, number>();
  const bySource = new Map<string, number>();
  let withAdKey = 0;
  let duplicates = 0;

  for (const row of rows) {
    if (isValidAibioNativeLeadStatus(row.status)) byStatus[row.status] += 1;
    byLanding.set(row.landing_path || "(unknown)", (byLanding.get(row.landing_path || "(unknown)") ?? 0) + 1);
    const source = row.utm_source || row.acquisition_channel || "(unknown)";
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    if (row.fbclid || row.gclid || row.fbc || row.fbp || row.ga_client_id) withAdKey += 1;
    if (row.is_duplicate) duplicates += 1;
  }

  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    total: rows.length,
    byStatus,
    byLanding: top(byLanding),
    bySource: top(bySource),
    withAdKey,
    adKeyCoverageRate: rows.length > 0 ? withAdKey / rows.length : null,
    duplicates,
    duplicateRate: rows.length > 0 ? duplicates / rows.length : null,
  };
};

export function createAibioNativeLead(input: AibioNativeLeadInput) {
  const db = initAibioNativeLeadTables();
  const name = normalizeText(input.name, 80);
  const phoneDigits = normalizePhoneDigits(input.phone);
  const ageRange = normalizeText(input.ageRange, 32);
  const purpose = normalizeText(input.purpose, 80);
  const channel = normalizeText(input.channel, 80);
  const preferredTime = normalizeText(input.preferredTime, 80);
  const privacyConsent = readBoolean(input.privacyConsent) || readBoolean(input.consent);
  const marketingConsent = readBoolean(input.marketingConsent);
  const missing: string[] = [];

  if (!name) missing.push("name");
  if (phoneDigits.length < 10 || phoneDigits.length > 11) missing.push("phone");
  if (!ageRange) missing.push("ageRange");
  if (!purpose) missing.push("purpose");
  if (!channel) missing.push("channel");
  if (!preferredTime) missing.push("preferredTime");
  if (!privacyConsent) missing.push("privacyConsent");
  if (missing.length > 0) {
    const error = new Error("missing_required_fields");
    Object.assign(error, { statusCode: 422, missing });
    throw error;
  }

  const now = new Date().toISOString();
  const phoneHash = hashPhoneDigits(phoneDigits);
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const duplicate = db
    .prepare(`
      SELECT lead_id
      FROM aibio_native_leads
      WHERE customer_phone_hash = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(phoneHash, cutoff) as { lead_id: string } | undefined;
  const attribution = pickAttribution(input.attribution);
  const firstTouch = pickAttribution(input.firstTouch);
  const lastTouch = pickAttribution(input.lastTouch);
  const landingPath = normalizeText(input.landingPath, 1024) || attribution.landing_path || "/aibio-native";
  const referrer = normalizeText(attribution.referrer, 1024) || null;
  const status: AibioNativeLeadStatus = duplicate ? "invalid_duplicate" : "new";
  const leadId = `aibio_native_${now.replace(/[-:.TZ]/g, "")}_${phoneHash.slice(0, 10)}_${randomUUID().slice(0, 8)}`;

  const insert = db.prepare(`
    INSERT INTO aibio_native_leads (
      lead_id, site, source, status, status_updated_at, customer_name, customer_phone,
      customer_phone_hash, customer_phone_last4, age_range, purpose, acquisition_channel,
      preferred_time, privacy_consent, privacy_consented_at, marketing_consent,
      marketing_consented_at, landing_path, referrer, utm_source, utm_medium, utm_campaign,
      utm_content, utm_term, fbclid, gclid, fbc, fbp, ga_client_id, attribution_json,
      first_touch_json, last_touch_json, duplicate_of_lead_id, duplicate_window_days,
      is_duplicate, created_at, updated_at
    ) VALUES (
      @leadId, 'aibio', 'native', @status, @now, @name, @phone,
      @phoneHash, @phoneLast4, @ageRange, @purpose, @channel,
      @preferredTime, @privacyConsent, @privacyConsentedAt, @marketingConsent,
      @marketingConsentedAt, @landingPath, @referrer, @utmSource, @utmMedium, @utmCampaign,
      @utmContent, @utmTerm, @fbclid, @gclid, @fbc, @fbp, @gaClientId, @attributionJson,
      @firstTouchJson, @lastTouchJson, @duplicateOfLeadId, @duplicateWindowDays,
      @isDuplicate, @now, @now
    )
  `);

  const tx = db.transaction(() => {
    insert.run({
      leadId,
      status,
      now,
      name,
      phone: phoneDigits,
      phoneHash,
      phoneLast4: phoneDigits.slice(-4),
      ageRange,
      purpose,
      channel,
      preferredTime,
      privacyConsent: privacyConsent ? 1 : 0,
      privacyConsentedAt: privacyConsent ? now : null,
      marketingConsent: marketingConsent ? 1 : 0,
      marketingConsentedAt: marketingConsent ? now : null,
      landingPath,
      referrer,
      utmSource: attribution.utm_source ?? null,
      utmMedium: attribution.utm_medium ?? null,
      utmCampaign: attribution.utm_campaign ?? null,
      utmContent: attribution.utm_content ?? null,
      utmTerm: attribution.utm_term ?? null,
      fbclid: attribution.fbclid ?? null,
      gclid: attribution.gclid ?? null,
      fbc: attribution.fbc ?? null,
      fbp: attribution.fbp ?? null,
      gaClientId: attribution.ga_client_id ?? null,
      attributionJson: JSON.stringify({ ...attribution, landing_path: landingPath, referrer: referrer ?? "" }),
      firstTouchJson: safeJson(firstTouch),
      lastTouchJson: safeJson(lastTouch),
      duplicateOfLeadId: duplicate?.lead_id ?? null,
      duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
      isDuplicate: duplicate ? 1 : 0,
    });
    db.prepare(`
      INSERT INTO aibio_native_lead_status_log (
        lead_id, previous_status, next_status, changed_by, memo, changed_at, payload_json
      ) VALUES (?, NULL, ?, 'system', ?, ?, ?)
    `).run(
      leadId,
      status,
      duplicate ? "30일 이내 동일 phone hash 접수" : "native lead form submit",
      now,
      JSON.stringify({ duplicateOfLeadId: duplicate?.lead_id ?? null }),
    );
  });

  tx();
  const row = db.prepare("SELECT * FROM aibio_native_leads WHERE lead_id = ?").get(leadId) as RawLeadRow;
  return {
    lead: rowToPublicLead(row),
    contact: rowToContact(row),
    duplicateOfLeadId: duplicate?.lead_id ?? null,
    phoneHashSha256: phoneHash,
  };
}

export function listAibioNativeLeads(options: {
  limit?: number;
  offset?: number;
  status?: string;
  startAt?: string;
  endAt?: string;
}) {
  const db = initAibioNativeLeadTables();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const where: string[] = [];
  const params: unknown[] = [];
  if (options.status && isValidAibioNativeLeadStatus(options.status)) {
    where.push("status = ?");
    params.push(options.status);
  }
  const startAt = parseIsoDate(options.startAt);
  if (startAt) {
    where.push("created_at >= ?");
    params.push(startAt);
  }
  const endAt = parseIsoDate(options.endAt);
  if (endAt) {
    where.push("created_at <= ?");
    params.push(endAt);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(`
      SELECT *
      FROM aibio_native_leads
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset) as RawLeadRow[];
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM aibio_native_leads ${whereSql}`).get(...params) as { count: number }).count;
  const summaryRows = db.prepare(`SELECT * FROM aibio_native_leads ${whereSql}`).all(...params) as RawLeadRow[];
  return {
    total,
    limit,
    offset,
    summary: summarizeRows(summaryRows),
    leads: rows.map(rowToPublicLead),
  };
}

export function updateAibioNativeLeadStatus(input: {
  leadId: string;
  status: unknown;
  changedBy?: unknown;
  memo?: unknown;
  assignedTo?: unknown;
  reservationAt?: unknown;
  visitAt?: unknown;
  paymentAmount?: unknown;
  paymentAt?: unknown;
}) {
  const db = initAibioNativeLeadTables();
  const nextStatus = validateStatus(input.status);
  const existing = db.prepare("SELECT * FROM aibio_native_leads WHERE lead_id = ?").get(input.leadId) as RawLeadRow | undefined;
  if (!existing) {
    const error = new Error("lead_not_found");
    Object.assign(error, { statusCode: 404 });
    throw error;
  }
  const now = new Date().toISOString();
  const assignedTo = normalizeText(input.assignedTo, 80) || existing.assigned_to;
  const memo = normalizeText(input.memo, 2000) || existing.operator_memo;
  const reservationAt = parseIsoDate(input.reservationAt) ?? existing.reservation_at;
  const visitAt = parseIsoDate(input.visitAt) ?? existing.visit_at;
  const paymentAmount = Number(input.paymentAmount);
  const paymentAt = parseIsoDate(input.paymentAt) ?? existing.payment_at;
  const nextPaymentAmount = Number.isFinite(paymentAmount) && paymentAmount >= 0 ? paymentAmount : existing.payment_amount;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE aibio_native_leads
      SET status = ?, status_updated_at = ?, assigned_to = ?, operator_memo = ?,
          reservation_at = ?, visit_at = ?, payment_amount = ?, payment_at = ?, updated_at = ?
      WHERE lead_id = ?
    `).run(
      nextStatus,
      now,
      assignedTo,
      memo,
      reservationAt,
      visitAt,
      nextPaymentAmount,
      paymentAt,
      now,
      input.leadId,
    );
    db.prepare(`
      INSERT INTO aibio_native_lead_status_log (
        lead_id, previous_status, next_status, changed_by, memo, changed_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.leadId,
      existing.status,
      nextStatus,
      normalizeText(input.changedBy, 80) || "operator",
      normalizeText(input.memo, 2000) || null,
      now,
      JSON.stringify({ assignedTo, reservationAt, visitAt, paymentAmount: nextPaymentAmount, paymentAt }),
    );
  });

  tx();
  const row = db.prepare("SELECT * FROM aibio_native_leads WHERE lead_id = ?").get(input.leadId) as RawLeadRow;
  return rowToPublicLead(row);
}

export function getAibioNativeLeadContact(leadId: string) {
  const db = initAibioNativeLeadTables();
  const row = db.prepare("SELECT * FROM aibio_native_leads WHERE lead_id = ?").get(leadId) as RawLeadRow | undefined;
  return row ? rowToContact(row) : null;
}

export function getAibioNativeLeadFunnel(options: { days?: number; endAt?: string }) {
  const db = initAibioNativeLeadTables();
  const days = Math.min(Math.max(options.days ?? 7, 1), 90);
  const end = parseIsoDate(options.endAt) ?? new Date().toISOString();
  const start = new Date(Date.parse(end) - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare("SELECT * FROM aibio_native_leads WHERE created_at >= ? AND created_at <= ?").all(start, end) as RawLeadRow[];
  const summary = summarizeRows(rows);
  const count = (statuses: AibioNativeLeadStatus[]) => rows.filter((row) => statuses.includes(row.status)).length;
  return {
    generatedAt: new Date().toISOString(),
    source: "local_sqlite_aibio_native_leads",
    window: { startAt: start, endAt: end, days },
    freshness: {
      latestLeadAt: rows.map((row) => row.created_at).sort().at(-1) ?? null,
      latestStatusUpdatedAt: rows.map((row) => row.status_updated_at).sort().at(-1) ?? null,
    },
    funnel: {
      leads: rows.length,
      contactStarted: count(["contact_attempted", "contacted", "reserved", "visited", "paid", "no_show"]),
      contacted: count(["contacted", "reserved", "visited", "paid", "no_show"]),
      reserved: count(["reserved", "visited", "paid", "no_show"]),
      visited: count(["visited", "paid"]),
      paid: count(["paid"]),
      noShow: count(["no_show"]),
      invalidDuplicate: count(["invalid_duplicate"]),
    },
    summary,
    confidence: rows.length >= 30 ? "medium" : rows.length > 0 ? "low_sample" : "empty",
    notes: [
      "운영 DB가 아니라 local SQLite 원장 기준이다.",
      "상담원이 상태를 입력해야 예약/방문/결제 전환율이 의미를 갖는다.",
    ],
  };
}

export function listAibioNativeLeadHashes(startAt: string, endAt: string) {
  const db = initAibioNativeLeadTables();
  const rows = db
    .prepare(`
      SELECT lead_id, customer_phone_hash, created_at
      FROM aibio_native_leads
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `)
    .all(startAt, endAt) as Array<{ lead_id: string; customer_phone_hash: string; created_at: string }>;
  return rows;
}
