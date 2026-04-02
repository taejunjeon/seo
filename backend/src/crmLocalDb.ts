/**
 * CRM 실험 로컬 SQLite DB
 *
 * 운영 DB는 읽기만 하고, 실험 데이터는 이 로컬 파일에 저장한다.
 * 파일 위치: backend/data/crm.sqlite3
 *
 * 테이블:
 * - crm_experiments: 실험 정의
 * - crm_assignment_log: 고객별 실험군/대조군 배정
 * - crm_conversion_log: 구매/환불 전환 기록
 * - crm_message_log: 발송 기록
 * - crm_lead_profile: 구매 전 리드 프로필
 * - crm_lead_event_log: 리드 마그넷/상담 예약/첫 구매 이벤트
 * - crm_consent_log: 리드 수신 동의 상태
 * - imweb_orders: 아임웹 주문 원장 로컬 캐시
 */

import Database from "better-sqlite3";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(__dirname, "..", "data", "crm.sqlite3");

let db: Database.Database | null = null;

function resolveDbPath() {
  return process.env.CRM_LOCAL_DB_PATH?.trim() || DEFAULT_DB_PATH;
}

export function getCrmDb(): Database.Database {
  if (!db) {
    db = new Database(resolveDbPath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
    ensureColumn(db, "imweb_members", "site", "TEXT DEFAULT 'biocom'");
  }
  return db;
}

export function resetCrmDbForTests() {
  if (db) {
    db.close();
    db = null;
  }
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_experiments (
      experiment_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      channel TEXT NOT NULL DEFAULT 'channeltalk',
      status TEXT NOT NULL DEFAULT 'draft',
      hypothesis TEXT,
      assignment_version INTEGER NOT NULL DEFAULT 1,
      variant_weights TEXT NOT NULL DEFAULT '{"control":5000,"treatment":5000}',
      funnel_stage TEXT NOT NULL DEFAULT 'post_purchase',
      asset_id TEXT,
      lead_magnet_id TEXT,
      conversion_window_days INTEGER NOT NULL DEFAULT 7,
      start_at TEXT,
      end_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_assignment_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_key TEXT NOT NULL REFERENCES crm_experiments(experiment_key),
      customer_key TEXT NOT NULL,
      variant_key TEXT NOT NULL,
      assignment_version INTEGER NOT NULL DEFAULT 1,
      assignment_bucket INTEGER,
      source_segment TEXT,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(experiment_key, customer_key, assignment_version)
    );

    CREATE TABLE IF NOT EXISTS crm_conversion_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_key TEXT NOT NULL REFERENCES crm_experiments(experiment_key),
      customer_key TEXT NOT NULL,
      order_id TEXT,
      conversion_type TEXT NOT NULL DEFAULT 'purchase',
      revenue_amount REAL NOT NULL DEFAULT 0,
      refund_amount REAL NOT NULL DEFAULT 0,
      net_revenue REAL NOT NULL DEFAULT 0,
      occurred_at TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(experiment_key, order_id, conversion_type)
    );

    CREATE TABLE IF NOT EXISTS crm_message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_key TEXT,
      customer_key TEXT NOT NULL,
      channel TEXT NOT NULL,
      provider_status TEXT,
      template_code TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      response_payload TEXT
    );

    CREATE TABLE IF NOT EXISTS crm_lead_profile (
      lead_id TEXT PRIMARY KEY,
      customer_key TEXT,
      lead_magnet_id TEXT,
      lead_source TEXT,
      problem_cluster TEXT,
      intent_stage TEXT NOT NULL DEFAULT 'unknown',
      consent_status TEXT NOT NULL DEFAULT 'unknown',
      content_asset_version TEXT,
      claim_review_status TEXT,
      phone_hash TEXT,
      channel_user_key TEXT,
      funnel_stage TEXT NOT NULL DEFAULT 'pre_purchase',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_lead_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL REFERENCES crm_lead_profile(lead_id),
      event_name TEXT NOT NULL,
      lead_magnet_id TEXT,
      asset_id TEXT,
      funnel_stage TEXT NOT NULL DEFAULT 'pre_purchase',
      problem_cluster TEXT,
      intent_stage TEXT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS crm_consent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL REFERENCES crm_lead_profile(lead_id),
      consent_type TEXT NOT NULL DEFAULT 'marketing',
      consent_status TEXT NOT NULL,
      policy_version TEXT,
      source_channel TEXT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS imweb_members (
      member_code TEXT PRIMARY KEY,
      uid TEXT,
      name TEXT,
      callnum TEXT,
      email TEXT,
      marketing_agree_sms TEXT DEFAULT 'N',
      marketing_agree_email TEXT DEFAULT 'N',
      third_party_agree TEXT DEFAULT 'N',
      member_grade TEXT,
      join_time TEXT,
      last_login_time TEXT,
      site TEXT DEFAULT 'biocom',
      synced_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_imweb_callnum ON imweb_members(callnum);
    CREATE INDEX IF NOT EXISTS idx_imweb_sms_agree ON imweb_members(marketing_agree_sms);
    CREATE INDEX IF NOT EXISTS idx_imweb_site ON imweb_members(site);

    CREATE TABLE IF NOT EXISTS imweb_orders (
      order_key TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      order_no TEXT NOT NULL,
      order_code TEXT,
      channel_order_no TEXT,
      order_type TEXT,
      sale_channel_idx INTEGER,
      device_type TEXT,
      order_time_unix INTEGER,
      order_time TEXT,
      complete_time_unix INTEGER,
      complete_time TEXT,
      member_code TEXT,
      orderer_name TEXT,
      orderer_call TEXT,
      pay_type TEXT,
      pg_type TEXT,
      price_currency TEXT DEFAULT 'KRW',
      total_price INTEGER DEFAULT 0,
      payment_amount INTEGER DEFAULT 0,
      coupon_amount INTEGER DEFAULT 0,
      delivery_price INTEGER DEFAULT 0,
      use_issue_coupon_codes TEXT DEFAULT '[]',
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_imweb_orders_site_time ON imweb_orders(site, order_time);
    CREATE INDEX IF NOT EXISTS idx_imweb_orders_order_no ON imweb_orders(order_no);
    CREATE INDEX IF NOT EXISTS idx_imweb_orders_member_code ON imweb_orders(member_code);
    CREATE INDEX IF NOT EXISTS idx_imweb_orders_orderer_call ON imweb_orders(orderer_call);

    CREATE INDEX IF NOT EXISTS idx_assignment_exp_variant ON crm_assignment_log(experiment_key, variant_key);
    CREATE INDEX IF NOT EXISTS idx_conversion_exp_customer ON crm_conversion_log(experiment_key, customer_key);
    CREATE INDEX IF NOT EXISTS idx_message_exp ON crm_message_log(experiment_key);
    CREATE INDEX IF NOT EXISTS idx_lead_profile_source ON crm_lead_profile(lead_source, intent_stage);
    CREATE INDEX IF NOT EXISTS idx_lead_event_name ON crm_lead_event_log(event_name, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_consent_status ON crm_consent_log(consent_status, occurred_at);

    CREATE TABLE IF NOT EXISTS toss_transactions (
      transaction_key TEXT PRIMARY KEY,
      payment_key TEXT NOT NULL,
      order_id TEXT NOT NULL,
      method TEXT,
      status TEXT,
      transaction_at TEXT,
      currency TEXT DEFAULT 'KRW',
      amount INTEGER DEFAULT 0,
      m_id TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS toss_settlements (
      payment_key TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT,
      amount INTEGER DEFAULT 0,
      fee INTEGER DEFAULT 0,
      pay_out_amount INTEGER DEFAULT 0,
      sold_date TEXT,
      paid_out_date TEXT,
      approved_at TEXT,
      card_issuer TEXT,
      card_type TEXT,
      cancel_amount INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_toss_txn_order ON toss_transactions(order_id);
    CREATE INDEX IF NOT EXISTS idx_toss_txn_date ON toss_transactions(transaction_at);
    CREATE INDEX IF NOT EXISTS idx_toss_settle_sold ON toss_settlements(sold_date);
  `);

  ensureColumn(db, "crm_experiments", "funnel_stage", "TEXT NOT NULL DEFAULT 'post_purchase'");
  ensureColumn(db, "crm_experiments", "asset_id", "TEXT");
  ensureColumn(db, "crm_experiments", "lead_magnet_id", "TEXT");
  ensureColumn(db, "crm_experiments", "variant_aliases", "TEXT DEFAULT '{}'");
}

/* ── 실험 CRUD ── */

export type CrmExperiment = {
  experiment_key: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  hypothesis: string | null;
  assignment_version: number;
  variant_weights: Record<string, number>;
  variant_aliases: Record<string, string>;
  funnel_stage: string;
  asset_id: string | null;
  lead_magnet_id: string | null;
  conversion_window_days: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 실험 목록 + 집계 메타정보 (배정 수, 전환 수, 메시지 수, 마지막 동기화) */
export type CrmExperimentWithMeta = CrmExperiment & {
  assignmentCount: number;
  conversionCount: number;
  messageCount: number;
  lastSyncAt: string | null;
};

export function listExperiments(): CrmExperiment[] {
  const rows = getCrmDb().prepare("SELECT * FROM crm_experiments ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
  return rows.map(parseExperimentRow);
}

/** 실험 목록 + 집계 메타 (배정/전환/메시지 수, 마지막 동기화) — 로컬 SQLite만 읽음, 운영 DB 미접근 */
export function listExperimentsWithMeta(): CrmExperimentWithMeta[] {
  const db = getCrmDb();
  const experiments = listExperiments();
  return experiments.map((exp) => {
    const assignmentCount = (db.prepare("SELECT COUNT(*) as cnt FROM crm_assignment_log WHERE experiment_key = ?").get(exp.experiment_key) as { cnt: number })?.cnt ?? 0;
    const conversionCount = (db.prepare("SELECT COUNT(*) as cnt FROM crm_conversion_log WHERE experiment_key = ?").get(exp.experiment_key) as { cnt: number })?.cnt ?? 0;
    const messageCount = (db.prepare("SELECT COUNT(*) as cnt FROM crm_message_log WHERE experiment_key = ?").get(exp.experiment_key) as { cnt: number })?.cnt ?? 0;
    const lastSync = db.prepare("SELECT MAX(assigned_at) as last_at FROM crm_assignment_log WHERE experiment_key = ?").get(exp.experiment_key) as { last_at: string | null } | undefined;
    return {
      ...exp,
      assignmentCount,
      conversionCount,
      messageCount,
      lastSyncAt: lastSync?.last_at ?? null,
    };
  });
}

/** variant_aliases 업데이트 — 로컬 SQLite만 수정 */
export function updateVariantAliases(experimentKey: string, aliases: Record<string, string>): void {
  getCrmDb().prepare("UPDATE crm_experiments SET variant_aliases = ?, updated_at = datetime('now') WHERE experiment_key = ?")
    .run(JSON.stringify(aliases), experimentKey);
}

export function getExperiment(key: string): CrmExperiment | null {
  const row = getCrmDb().prepare("SELECT * FROM crm_experiments WHERE experiment_key = ?").get(key) as Record<string, unknown> | undefined;
  return row ? parseExperimentRow(row) : null;
}

export function createExperiment(input: {
  experiment_key: string;
  name: string;
  description?: string;
  channel?: string;
  hypothesis?: string;
  variant_weights?: Record<string, number>;
  funnel_stage?: string;
  asset_id?: string;
  lead_magnet_id?: string;
  conversion_window_days?: number;
}): CrmExperiment {
  const weights = input.variant_weights ?? { control: 5000, treatment: 5000 };
  getCrmDb().prepare(`
    INSERT INTO crm_experiments (
      experiment_key, name, description, channel, hypothesis, variant_weights,
      funnel_stage, asset_id, lead_magnet_id, conversion_window_days
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.experiment_key,
    input.name,
    input.description ?? null,
    input.channel ?? "channeltalk",
    input.hypothesis ?? null,
    JSON.stringify(weights),
    input.funnel_stage ?? "post_purchase",
    input.asset_id ?? null,
    input.lead_magnet_id ?? null,
    input.conversion_window_days ?? 7,
  );
  return getExperiment(input.experiment_key)!;
}

export function updateExperimentStatus(key: string, status: string): void {
  getCrmDb().prepare("UPDATE crm_experiments SET status = ?, updated_at = datetime('now') WHERE experiment_key = ?").run(status, key);
}

/* ── 배정 ── */

export type AssignmentRow = {
  id: number;
  experiment_key: string;
  customer_key: string;
  variant_key: string;
  assignment_version: number;
  assignment_bucket: number | null;
  source_segment: string | null;
  assigned_at: string;
};

export function createAssignment(input: {
  experiment_key: string;
  customer_key: string;
  variant_key: string;
  assignment_version?: number;
  assignment_bucket?: number;
  source_segment?: string;
}): void {
  getCrmDb().prepare(`
    INSERT OR IGNORE INTO crm_assignment_log (experiment_key, customer_key, variant_key, assignment_version, assignment_bucket, source_segment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.experiment_key,
    input.customer_key,
    input.variant_key,
    input.assignment_version ?? 1,
    input.assignment_bucket ?? null,
    input.source_segment ?? null,
  );
}

export function listAssignments(experimentKey: string, limit = 20, offset = 0): { total: number; items: AssignmentRow[] } {
  const total = (getCrmDb().prepare("SELECT COUNT(*) as cnt FROM crm_assignment_log WHERE experiment_key = ?").get(experimentKey) as { cnt: number }).cnt;
  const items = getCrmDb().prepare("SELECT * FROM crm_assignment_log WHERE experiment_key = ? ORDER BY assigned_at DESC LIMIT ? OFFSET ?").all(experimentKey, limit, offset) as AssignmentRow[];
  return { total, items };
}

/* ── 전환 ── */

export function recordConversion(input: {
  experiment_key: string;
  customer_key: string;
  order_id?: string;
  conversion_type?: string;
  revenue_amount?: number;
  refund_amount?: number;
}): void {
  const net = (input.revenue_amount ?? 0) - (input.refund_amount ?? 0);
  getCrmDb().prepare(`
    INSERT OR IGNORE INTO crm_conversion_log (experiment_key, customer_key, order_id, conversion_type, revenue_amount, refund_amount, net_revenue, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    input.experiment_key,
    input.customer_key,
    input.order_id ?? null,
    input.conversion_type ?? "purchase",
    input.revenue_amount ?? 0,
    input.refund_amount ?? 0,
    net,
  );
}

/* ── 실험 결과 집계 ── */

export type VariantSummary = {
  variant_key: string;
  assignment_count: number;
  purchaser_count: number;
  purchase_count: number;
  revenue_amount: number;
  refund_amount: number;
  net_revenue: number;
  purchase_rate: number;
};

export function getExperimentResults(experimentKey: string): {
  experiment: CrmExperiment | null;
  variant_summary: VariantSummary[];
} {
  const experiment = getExperiment(experimentKey);
  if (!experiment) return { experiment: null, variant_summary: [] };

  const rows = getCrmDb().prepare(`
    SELECT
      a.variant_key,
      COUNT(DISTINCT a.customer_key) AS assignment_count,
      COUNT(DISTINCT c.customer_key) AS purchaser_count,
      COUNT(c.id) AS purchase_count,
      COALESCE(SUM(c.revenue_amount), 0) AS revenue_amount,
      COALESCE(SUM(c.refund_amount), 0) AS refund_amount,
      COALESCE(SUM(c.net_revenue), 0) AS net_revenue
    FROM crm_assignment_log a
    LEFT JOIN crm_conversion_log c
      ON a.experiment_key = c.experiment_key AND a.customer_key = c.customer_key
    WHERE a.experiment_key = ?
    GROUP BY a.variant_key
    ORDER BY a.variant_key
  `).all(experimentKey) as Array<Record<string, unknown>>;

  const variant_summary: VariantSummary[] = rows.map((r) => {
    const assignmentCount = Number(r.assignment_count) || 0;
    const purchaserCount = Number(r.purchaser_count) || 0;
    return {
      variant_key: String(r.variant_key),
      assignment_count: assignmentCount,
      purchaser_count: purchaserCount,
      purchase_count: Number(r.purchase_count) || 0,
      revenue_amount: Number(r.revenue_amount) || 0,
      refund_amount: Number(r.refund_amount) || 0,
      net_revenue: Number(r.net_revenue) || 0,
      purchase_rate: assignmentCount > 0 ? purchaserCount / assignmentCount : 0,
    };
  });

  return { experiment, variant_summary };
}

/* ── 메시지 로그 ── */

export function recordMessage(input: {
  experiment_key?: string;
  customer_key: string;
  channel: string;
  provider_status?: string;
  template_code?: string;
  response_payload?: string;
}): void {
  getCrmDb().prepare(`
    INSERT INTO crm_message_log (experiment_key, customer_key, channel, provider_status, template_code, response_payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.experiment_key ?? null,
    input.customer_key,
    input.channel,
    input.provider_status ?? null,
    input.template_code ?? null,
    input.response_payload ?? null,
  );
}

/* ── 리드 프로필/이벤트/동의 ── */

export type LeadProfileRow = {
  lead_id: string;
  customer_key: string | null;
  lead_magnet_id: string | null;
  lead_source: string | null;
  problem_cluster: string | null;
  intent_stage: string;
  consent_status: string;
  content_asset_version: string | null;
  claim_review_status: string | null;
  phone_hash: string | null;
  channel_user_key: string | null;
  funnel_stage: string;
  created_at: string;
  updated_at: string;
};

export type LeadEventRow = {
  id: number;
  lead_id: string;
  event_name: string;
  lead_magnet_id: string | null;
  asset_id: string | null;
  funnel_stage: string;
  problem_cluster: string | null;
  intent_stage: string | null;
  occurred_at: string;
  payload_json: string | null;
};

export function upsertLeadProfile(input: {
  lead_id: string;
  customer_key?: string | null;
  lead_magnet_id?: string | null;
  lead_source?: string | null;
  problem_cluster?: string | null;
  intent_stage?: string | null;
  consent_status?: string | null;
  content_asset_version?: string | null;
  claim_review_status?: string | null;
  phone_hash?: string | null;
  channel_user_key?: string | null;
  funnel_stage?: string | null;
}): LeadProfileRow {
  const database = getCrmDb();
  database.prepare(`
    INSERT OR IGNORE INTO crm_lead_profile (
      lead_id, customer_key, lead_magnet_id, lead_source, problem_cluster,
      intent_stage, consent_status, content_asset_version, claim_review_status,
      phone_hash, channel_user_key, funnel_stage
    )
    VALUES (?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), 'unknown', 'unknown', NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), 'pre_purchase')
  `).run(
    input.lead_id,
    input.customer_key ?? "",
    input.lead_magnet_id ?? "",
    input.lead_source ?? "",
    input.problem_cluster ?? "",
    input.content_asset_version ?? "",
    input.claim_review_status ?? "",
    input.phone_hash ?? "",
    input.channel_user_key ?? "",
  );
  database.prepare(`
    UPDATE crm_lead_profile
    SET
      customer_key = COALESCE(NULLIF(?, ''), customer_key),
      lead_magnet_id = COALESCE(NULLIF(?, ''), lead_magnet_id),
      lead_source = COALESCE(NULLIF(?, ''), lead_source),
      problem_cluster = COALESCE(NULLIF(?, ''), problem_cluster),
      intent_stage = CASE WHEN ? = '' THEN intent_stage ELSE ? END,
      consent_status = CASE WHEN ? = '' THEN consent_status ELSE ? END,
      content_asset_version = COALESCE(NULLIF(?, ''), content_asset_version),
      claim_review_status = COALESCE(NULLIF(?, ''), claim_review_status),
      phone_hash = COALESCE(NULLIF(?, ''), phone_hash),
      channel_user_key = COALESCE(NULLIF(?, ''), channel_user_key),
      funnel_stage = CASE WHEN ? = '' THEN funnel_stage ELSE ? END,
      updated_at = datetime('now')
    WHERE lead_id = ?
  `).run(
    input.customer_key ?? "",
    input.lead_magnet_id ?? "",
    input.lead_source ?? "",
    input.problem_cluster ?? "",
    input.intent_stage ?? "",
    input.intent_stage ?? "",
    input.consent_status ?? "",
    input.consent_status ?? "",
    input.content_asset_version ?? "",
    input.claim_review_status ?? "",
    input.phone_hash ?? "",
    input.channel_user_key ?? "",
    input.funnel_stage ?? "",
    input.funnel_stage ?? "",
    input.lead_id,
  );
  return getLeadProfile(input.lead_id)!;
}

export function getLeadProfile(leadId: string): LeadProfileRow | null {
  const row = getCrmDb()
    .prepare("SELECT * FROM crm_lead_profile WHERE lead_id = ?")
    .get(leadId) as LeadProfileRow | undefined;
  return row ?? null;
}

export function listLeadProfiles(limit = 20, offset = 0): { total: number; items: LeadProfileRow[] } {
  const database = getCrmDb();
  const total = (database.prepare("SELECT COUNT(*) as cnt FROM crm_lead_profile").get() as { cnt: number }).cnt;
  const items = database
    .prepare("SELECT * FROM crm_lead_profile ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?")
    .all(limit, offset) as LeadProfileRow[];
  return { total, items };
}

export function recordLeadEvent(input: {
  lead_id: string;
  event_name: string;
  lead_magnet_id?: string | null;
  asset_id?: string | null;
  funnel_stage?: string | null;
  problem_cluster?: string | null;
  intent_stage?: string | null;
  occurred_at?: string | null;
  payload_json?: string | null;
}): LeadEventRow {
  const funnelStage = input.funnel_stage ?? inferFunnelStage(input.event_name);
  upsertLeadProfile({
    lead_id: input.lead_id,
    lead_magnet_id: input.lead_magnet_id ?? null,
    problem_cluster: input.problem_cluster ?? null,
    intent_stage: input.intent_stage ?? null,
    funnel_stage: funnelStage,
  });
  const result = getCrmDb()
    .prepare(`
      INSERT INTO crm_lead_event_log (
        lead_id, event_name, lead_magnet_id, asset_id, funnel_stage,
        problem_cluster, intent_stage, occurred_at, payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
    `)
    .run(
      input.lead_id,
      input.event_name,
      input.lead_magnet_id ?? null,
      input.asset_id ?? null,
      funnelStage,
      input.problem_cluster ?? null,
      input.intent_stage ?? null,
      input.occurred_at ?? null,
      input.payload_json ?? null,
    );
  return getCrmDb()
    .prepare("SELECT * FROM crm_lead_event_log WHERE id = ?")
    .get(result.lastInsertRowid) as LeadEventRow;
}

export function recordConsent(input: {
  lead_id: string;
  consent_status: string;
  consent_type?: string | null;
  policy_version?: string | null;
  source_channel?: string | null;
  occurred_at?: string | null;
  payload_json?: string | null;
}) {
  upsertLeadProfile({
    lead_id: input.lead_id,
    consent_status: input.consent_status,
  });
  getCrmDb()
    .prepare(`
      INSERT INTO crm_consent_log (
        lead_id, consent_type, consent_status, policy_version, source_channel, occurred_at, payload_json
      )
      VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
    `)
    .run(
      input.lead_id,
      input.consent_type ?? "marketing",
      input.consent_status,
      input.policy_version ?? null,
      input.source_channel ?? null,
      input.occurred_at ?? null,
      input.payload_json ?? null,
    );
}

export function getLeadOverview() {
  const database = getCrmDb();
  const profile = database
    .prepare(`
      SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (WHERE customer_key IS NOT NULL AND TRIM(customer_key) <> '') AS identified_leads,
        COUNT(*) FILTER (WHERE consent_status IN ('opt_in', 'granted', 'marketing_opt_in', 'subscribed')) AS contactable_leads,
        COUNT(*) FILTER (WHERE funnel_stage = 'consultation' OR intent_stage IN ('consultation', 'consultation_ready')) AS consultation_ready_leads,
        COUNT(*) FILTER (WHERE funnel_stage = 'post_purchase') AS purchased_leads
      FROM crm_lead_profile
    `)
    .get() as Record<string, number>;
  const eventCounts = database
    .prepare(`
      SELECT event_name, COUNT(*) AS row_count, COUNT(DISTINCT lead_id) AS lead_count
      FROM crm_lead_event_log
      GROUP BY event_name
      ORDER BY row_count DESC, event_name
    `)
    .all() as Array<Record<string, unknown>>;
  const topProblemClusters = database
    .prepare(`
      SELECT problem_cluster, COUNT(*) AS row_count
      FROM crm_lead_profile
      WHERE problem_cluster IS NOT NULL AND TRIM(problem_cluster) <> ''
      GROUP BY problem_cluster
      ORDER BY row_count DESC, problem_cluster
      LIMIT 5
    `)
    .all() as Array<Record<string, unknown>>;

  return {
    total_leads: Number(profile.total_leads) || 0,
    identified_leads: Number(profile.identified_leads) || 0,
    contactable_leads: Number(profile.contactable_leads) || 0,
    consultation_ready_leads: Number(profile.consultation_ready_leads) || 0,
    purchased_leads: Number(profile.purchased_leads) || 0,
    event_counts: eventCounts.map((row) => ({
      event_name: String(row.event_name),
      row_count: Number(row.row_count) || 0,
      lead_count: Number(row.lead_count) || 0,
    })),
    top_problem_clusters: topProblemClusters.map((row) => ({
      problem_cluster: String(row.problem_cluster),
      row_count: Number(row.row_count) || 0,
    })),
  };
}

/* ── 통계 ── */

export function getDbStats() {
  const db = getCrmDb();
  return {
    experiments: (db.prepare("SELECT COUNT(*) as cnt FROM crm_experiments").get() as { cnt: number }).cnt,
    assignments: (db.prepare("SELECT COUNT(*) as cnt FROM crm_assignment_log").get() as { cnt: number }).cnt,
    conversions: (db.prepare("SELECT COUNT(*) as cnt FROM crm_conversion_log").get() as { cnt: number }).cnt,
    messages: (db.prepare("SELECT COUNT(*) as cnt FROM crm_message_log").get() as { cnt: number }).cnt,
    leads: (db.prepare("SELECT COUNT(*) as cnt FROM crm_lead_profile").get() as { cnt: number }).cnt,
    lead_events: (db.prepare("SELECT COUNT(*) as cnt FROM crm_lead_event_log").get() as { cnt: number }).cnt,
    consents: (db.prepare("SELECT COUNT(*) as cnt FROM crm_consent_log").get() as { cnt: number }).cnt,
    imwebMembers: (db.prepare("SELECT COUNT(*) as cnt FROM imweb_members").get() as { cnt: number }).cnt,
    imwebOrders: (db.prepare("SELECT COUNT(*) as cnt FROM imweb_orders").get() as { cnt: number }).cnt,
    tossTransactions: (db.prepare("SELECT COUNT(*) as cnt FROM toss_transactions").get() as { cnt: number }).cnt,
    tossSettlements: (db.prepare("SELECT COUNT(*) as cnt FROM toss_settlements").get() as { cnt: number }).cnt,
  };
}

/* ── 헬퍼 ── */

function parseExperimentRow(row: Record<string, unknown>): CrmExperiment {
  let weights: Record<string, number> = { control: 5000, treatment: 5000 };
  try { weights = JSON.parse(String(row.variant_weights)); } catch { /* ignore */ }
  let aliases: Record<string, string> = {};
  try { aliases = JSON.parse(String(row.variant_aliases || "{}")); } catch { /* ignore */ }
  return {
    experiment_key: String(row.experiment_key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    channel: String(row.channel),
    status: String(row.status),
    hypothesis: row.hypothesis ? String(row.hypothesis) : null,
    assignment_version: Number(row.assignment_version) || 1,
    variant_weights: weights,
    variant_aliases: aliases,
    funnel_stage: row.funnel_stage ? String(row.funnel_stage) : "post_purchase",
    asset_id: row.asset_id ? String(row.asset_id) : null,
    lead_magnet_id: row.lead_magnet_id ? String(row.lead_magnet_id) : null,
    conversion_window_days: Number(row.conversion_window_days) || 7,
    start_at: row.start_at ? String(row.start_at) : null,
    end_at: row.end_at ? String(row.end_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function inferFunnelStage(eventName?: string | null) {
  if (eventName === "consultation_booked") return "consultation";
  if (eventName === "first_purchase") return "post_purchase";
  return "pre_purchase";
}

function ensureColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

// ── 아임웹 회원 동기화 ──

export type ImwebMemberRow = {
  member_code: string;
  uid: string;
  name: string;
  callnum: string;
  email: string;
  marketing_agree_sms: string;
  marketing_agree_email: string;
  third_party_agree: string;
  member_grade: string;
  join_time: string;
  last_login_time: string;
  site: string;
};

export function upsertImwebMember(row: ImwebMemberRow) {
  const db = getCrmDb();
  db.prepare(`
    INSERT INTO imweb_members (member_code, uid, name, callnum, email, marketing_agree_sms, marketing_agree_email, third_party_agree, member_grade, join_time, last_login_time, site, synced_at)
    VALUES (@member_code, @uid, @name, @callnum, @email, @marketing_agree_sms, @marketing_agree_email, @third_party_agree, @member_grade, @join_time, @last_login_time, @site, datetime('now'))
    ON CONFLICT(member_code) DO UPDATE SET
      uid=excluded.uid, name=excluded.name, callnum=excluded.callnum, email=excluded.email,
      marketing_agree_sms=excluded.marketing_agree_sms, marketing_agree_email=excluded.marketing_agree_email,
      third_party_agree=excluded.third_party_agree, member_grade=excluded.member_grade,
      join_time=excluded.join_time, last_login_time=excluded.last_login_time, site=excluded.site, synced_at=datetime('now')
  `).run(row);
}

export function upsertImwebMembers(rows: ImwebMemberRow[]) {
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO imweb_members (member_code, uid, name, callnum, email, marketing_agree_sms, marketing_agree_email, third_party_agree, member_grade, join_time, last_login_time, site, synced_at)
    VALUES (@member_code, @uid, @name, @callnum, @email, @marketing_agree_sms, @marketing_agree_email, @third_party_agree, @member_grade, @join_time, @last_login_time, @site, datetime('now'))
    ON CONFLICT(member_code) DO UPDATE SET
      uid=excluded.uid, name=excluded.name, callnum=excluded.callnum, email=excluded.email,
      marketing_agree_sms=excluded.marketing_agree_sms, marketing_agree_email=excluded.marketing_agree_email,
      third_party_agree=excluded.third_party_agree, member_grade=excluded.member_grade,
      join_time=excluded.join_time, last_login_time=excluded.last_login_time, site=excluded.site, synced_at=datetime('now')
  `);
  const tx = db.transaction((items: ImwebMemberRow[]) => {
    for (const row of items) stmt.run(row);
  });
  tx(rows);
}

export function getImwebMemberConsentStats(site?: string) {
  const db = getCrmDb();
  const where = site ? `WHERE site = '${site}'` : "";
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM imweb_members ${where}`).get() as { cnt: number }).cnt;
  const smsY = (db.prepare(`SELECT COUNT(*) as cnt FROM imweb_members ${where ? where + " AND" : "WHERE"} marketing_agree_sms = 'Y'`).get() as { cnt: number }).cnt;
  const emailY = (db.prepare(`SELECT COUNT(*) as cnt FROM imweb_members ${where ? where + " AND" : "WHERE"} marketing_agree_email = 'Y'`).get() as { cnt: number }).cnt;
  const thirdY = (db.prepare(`SELECT COUNT(*) as cnt FROM imweb_members ${where ? where + " AND" : "WHERE"} third_party_agree = 'Y'`).get() as { cnt: number }).cnt;
  const withPhone = (db.prepare(`SELECT COUNT(*) as cnt FROM imweb_members ${where ? where + " AND" : "WHERE"} callnum IS NOT NULL AND callnum != ''`).get() as { cnt: number }).cnt;

  const bySite = db.prepare("SELECT site, COUNT(*) as cnt FROM imweb_members GROUP BY site").all() as Array<{ site: string; cnt: number }>;

  return { total, smsAgreeY: smsY, emailAgreeY: emailY, thirdPartyAgreeY: thirdY, withPhone, bySite };
}

export function getImwebMemberByPhone(phone: string) {
  const db = getCrmDb();
  const normalized = phone.replace(/[^0-9]/g, "");
  return db.prepare("SELECT * FROM imweb_members WHERE REPLACE(REPLACE(callnum, '-', ''), ' ', '') = ?").get(normalized) as ImwebMemberRow | undefined;
}

// ── 아임웹 주문 동기화 ──

export type ImwebOrderRow = {
  order_key: string;
  site: string;
  order_no: string;
  order_code: string;
  channel_order_no: string;
  order_type: string;
  sale_channel_idx: number | null;
  device_type: string;
  order_time_unix: number | null;
  order_time: string | null;
  complete_time_unix: number | null;
  complete_time: string | null;
  member_code: string;
  orderer_name: string;
  orderer_call: string;
  pay_type: string;
  pg_type: string;
  price_currency: string;
  total_price: number;
  payment_amount: number;
  coupon_amount: number;
  delivery_price: number;
  use_issue_coupon_codes: string;
  raw_json: string;
};

export function upsertImwebOrders(rows: ImwebOrderRow[]) {
  if (!rows.length) {
    return;
  }
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO imweb_orders (
      order_key, site, order_no, order_code, channel_order_no, order_type,
      sale_channel_idx, device_type, order_time_unix, order_time, complete_time_unix, complete_time,
      member_code, orderer_name, orderer_call, pay_type, pg_type, price_currency,
      total_price, payment_amount, coupon_amount, delivery_price, use_issue_coupon_codes, raw_json, synced_at
    )
    VALUES (
      @order_key, @site, @order_no, @order_code, @channel_order_no, @order_type,
      @sale_channel_idx, @device_type, @order_time_unix, @order_time, @complete_time_unix, @complete_time,
      @member_code, @orderer_name, @orderer_call, @pay_type, @pg_type, @price_currency,
      @total_price, @payment_amount, @coupon_amount, @delivery_price, @use_issue_coupon_codes, @raw_json, datetime('now')
    )
    ON CONFLICT(order_key) DO UPDATE SET
      order_no=excluded.order_no,
      order_code=excluded.order_code,
      channel_order_no=excluded.channel_order_no,
      order_type=excluded.order_type,
      sale_channel_idx=excluded.sale_channel_idx,
      device_type=excluded.device_type,
      order_time_unix=excluded.order_time_unix,
      order_time=excluded.order_time,
      complete_time_unix=excluded.complete_time_unix,
      complete_time=excluded.complete_time,
      member_code=excluded.member_code,
      orderer_name=excluded.orderer_name,
      orderer_call=excluded.orderer_call,
      pay_type=excluded.pay_type,
      pg_type=excluded.pg_type,
      price_currency=excluded.price_currency,
      total_price=excluded.total_price,
      payment_amount=excluded.payment_amount,
      coupon_amount=excluded.coupon_amount,
      delivery_price=excluded.delivery_price,
      use_issue_coupon_codes=excluded.use_issue_coupon_codes,
      raw_json=excluded.raw_json,
      synced_at=datetime('now')
  `);
  const tx = db.transaction((items: ImwebOrderRow[]) => {
    for (const row of items) {
      stmt.run(row);
    }
  });
  tx(rows);
}

export function getImwebOrderStats(site?: string) {
  const db = getCrmDb();
  const where = site ? "WHERE site = ?" : "";
  const params = site ? [site] : [];
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      COUNT(DISTINCT NULLIF(member_code, '')) AS member_orders,
      COUNT(DISTINCT NULLIF(REPLACE(REPLACE(orderer_call, '-', ''), ' ', ''), '')) AS phone_customers,
      COALESCE(SUM(payment_amount), 0) AS payment_amount_sum,
      MIN(order_time) AS first_order_at,
      MAX(order_time) AS last_order_at,
      MAX(synced_at) AS last_synced_at
    FROM imweb_orders
    ${where}
  `).get(...params) as Record<string, unknown>;

  const bySite = db.prepare(`
    SELECT
      site,
      COUNT(*) AS total_orders,
      COALESCE(SUM(payment_amount), 0) AS payment_amount_sum,
      MIN(order_time) AS first_order_at,
      MAX(order_time) AS last_order_at,
      MAX(synced_at) AS last_synced_at
    FROM imweb_orders
    GROUP BY site
    ORDER BY total_orders DESC, site
  `).all() as Array<Record<string, unknown>>;

  return {
    totalOrders: Number(summary.total_orders) || 0,
    memberOrders: Number(summary.member_orders) || 0,
    phoneCustomers: Number(summary.phone_customers) || 0,
    paymentAmountSum: Number(summary.payment_amount_sum) || 0,
    firstOrderAt: summary.first_order_at ? String(summary.first_order_at) : null,
    lastOrderAt: summary.last_order_at ? String(summary.last_order_at) : null,
    lastSyncedAt: summary.last_synced_at ? String(summary.last_synced_at) : null,
    bySite: bySite.map((row) => ({
      site: String(row.site),
      totalOrders: Number(row.total_orders) || 0,
      paymentAmountSum: Number(row.payment_amount_sum) || 0,
      firstOrderAt: row.first_order_at ? String(row.first_order_at) : null,
      lastOrderAt: row.last_order_at ? String(row.last_order_at) : null,
      lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    })),
  };
}
