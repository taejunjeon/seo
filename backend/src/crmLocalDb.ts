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
import { inferTossStoreFromPaymentKey } from "./tossConfig";
import { normalizeOrderIdBase, normalizePhoneDigits } from "./orderKeys";

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
    ensureColumn(db, "imweb_members", "birth", "TEXT DEFAULT ''");
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

    CREATE TABLE IF NOT EXISTS crm_customer_groups (
      group_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_customer_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL REFERENCES crm_customer_groups(group_id),
      phone TEXT NOT NULL,
      name TEXT,
      member_code TEXT,
      consent_sms INTEGER DEFAULT 0,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, phone)
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
      birth TEXT DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS imweb_coupon_masters (
      coupon_key TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      coupon_code TEXT NOT NULL,
      name TEXT DEFAULT '',
      status TEXT DEFAULT '',
      type TEXT DEFAULT '',
      apply_sale_price INTEGER DEFAULT 0,
      apply_sale_percent REAL DEFAULT 0,
      type_coupon_create_count INTEGER DEFAULT 0,
      type_coupon_use_count INTEGER DEFAULT 0,
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site, coupon_code)
    );

    CREATE INDEX IF NOT EXISTS idx_imweb_coupon_masters_site_code ON imweb_coupon_masters(site, coupon_code);
    CREATE INDEX IF NOT EXISTS idx_imweb_coupon_masters_site_name ON imweb_coupon_masters(site, name);

    CREATE TABLE IF NOT EXISTS imweb_issue_coupons (
      issue_key TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      issue_coupon_code TEXT NOT NULL,
      coupon_code TEXT DEFAULT '',
      name TEXT DEFAULT '',
      status TEXT DEFAULT '',
      type TEXT DEFAULT '',
      coupon_issue_code TEXT DEFAULT '',
      shop_order_code TEXT DEFAULT '',
      use_date TEXT DEFAULT '',
      raw_json TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site, issue_coupon_code)
    );

    CREATE INDEX IF NOT EXISTS idx_imweb_issue_coupons_site_issue ON imweb_issue_coupons(site, issue_coupon_code);
    CREATE INDEX IF NOT EXISTS idx_imweb_issue_coupons_site_coupon ON imweb_issue_coupons(site, coupon_code);
    CREATE INDEX IF NOT EXISTS idx_imweb_issue_coupons_site_name ON imweb_issue_coupons(site, name);

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

export type ExperimentActivityWindow = {
  experiment_key: string;
  start_at: string | null;
  end_at: string | null;
  first_assignment_at: string | null;
  last_assignment_at: string | null;
  first_conversion_at: string | null;
  last_conversion_at: string | null;
};

export function getExperimentActivityWindow(experimentKey: string): ExperimentActivityWindow | null {
  const experiment = getExperiment(experimentKey);
  if (!experiment) return null;

  const database = getCrmDb();
  const assignmentRange = database.prepare(`
    SELECT
      MIN(assigned_at) AS first_assignment_at,
      MAX(assigned_at) AS last_assignment_at
    FROM crm_assignment_log
    WHERE experiment_key = ?
  `).get(experimentKey) as {
    first_assignment_at: string | null;
    last_assignment_at: string | null;
  };

  const conversionRange = database.prepare(`
    SELECT
      MIN(occurred_at) AS first_conversion_at,
      MAX(occurred_at) AS last_conversion_at
    FROM crm_conversion_log
    WHERE experiment_key = ?
  `).get(experimentKey) as {
    first_conversion_at: string | null;
    last_conversion_at: string | null;
  };

  const startAt = experiment.start_at
    ?? assignmentRange.first_assignment_at
    ?? conversionRange.first_conversion_at
    ?? null;
  const endAt = experiment.end_at
    ?? conversionRange.last_conversion_at
    ?? assignmentRange.last_assignment_at
    ?? startAt;

  return {
    experiment_key: experiment.experiment_key,
    start_at: startAt,
    end_at: endAt,
    first_assignment_at: assignmentRange.first_assignment_at,
    last_assignment_at: assignmentRange.last_assignment_at,
    first_conversion_at: conversionRange.first_conversion_at,
    last_conversion_at: conversionRange.last_conversion_at,
  };
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
    imwebCouponMasters: (db.prepare("SELECT COUNT(*) as cnt FROM imweb_coupon_masters").get() as { cnt: number }).cnt,
    imwebIssueCoupons: (db.prepare("SELECT COUNT(*) as cnt FROM imweb_issue_coupons").get() as { cnt: number }).cnt,
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
  birth: string;
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
    INSERT INTO imweb_members (member_code, uid, name, callnum, email, birth, marketing_agree_sms, marketing_agree_email, third_party_agree, member_grade, join_time, last_login_time, site, synced_at)
    VALUES (@member_code, @uid, @name, @callnum, @email, @birth, @marketing_agree_sms, @marketing_agree_email, @third_party_agree, @member_grade, @join_time, @last_login_time, @site, datetime('now'))
    ON CONFLICT(member_code) DO UPDATE SET
      uid=excluded.uid, name=excluded.name, callnum=excluded.callnum, email=excluded.email, birth=excluded.birth,
      marketing_agree_sms=excluded.marketing_agree_sms, marketing_agree_email=excluded.marketing_agree_email,
      third_party_agree=excluded.third_party_agree, member_grade=excluded.member_grade,
      join_time=excluded.join_time, last_login_time=excluded.last_login_time, site=excluded.site, synced_at=datetime('now')
  `).run(row);
}

export function upsertImwebMembers(rows: ImwebMemberRow[]) {
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO imweb_members (member_code, uid, name, callnum, email, birth, marketing_agree_sms, marketing_agree_email, third_party_agree, member_grade, join_time, last_login_time, site, synced_at)
    VALUES (@member_code, @uid, @name, @callnum, @email, @birth, @marketing_agree_sms, @marketing_agree_email, @third_party_agree, @member_grade, @join_time, @last_login_time, @site, datetime('now'))
    ON CONFLICT(member_code) DO UPDATE SET
      uid=excluded.uid, name=excluded.name, callnum=excluded.callnum, email=excluded.email, birth=excluded.birth,
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

export type ImwebCouponMasterRow = {
  coupon_key: string;
  site: string;
  coupon_code: string;
  name: string;
  status: string;
  type: string;
  apply_sale_price: number;
  apply_sale_percent: number;
  type_coupon_create_count: number;
  type_coupon_use_count: number;
  raw_json: string;
};

export type ImwebIssueCouponRow = {
  issue_key: string;
  site: string;
  issue_coupon_code: string;
  coupon_code: string;
  name: string;
  status: string;
  type: string;
  coupon_issue_code: string;
  shop_order_code: string;
  use_date: string;
  raw_json: string;
};

export function upsertImwebCouponMasters(rows: ImwebCouponMasterRow[]) {
  if (!rows.length) {
    return;
  }
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO imweb_coupon_masters (
      coupon_key, site, coupon_code, name, status, type,
      apply_sale_price, apply_sale_percent, type_coupon_create_count, type_coupon_use_count,
      raw_json, synced_at
    )
    VALUES (
      @coupon_key, @site, @coupon_code, @name, @status, @type,
      @apply_sale_price, @apply_sale_percent, @type_coupon_create_count, @type_coupon_use_count,
      @raw_json, datetime('now')
    )
    ON CONFLICT(coupon_key) DO UPDATE SET
      site=excluded.site,
      coupon_code=excluded.coupon_code,
      name=excluded.name,
      status=excluded.status,
      type=excluded.type,
      apply_sale_price=excluded.apply_sale_price,
      apply_sale_percent=excluded.apply_sale_percent,
      type_coupon_create_count=excluded.type_coupon_create_count,
      type_coupon_use_count=excluded.type_coupon_use_count,
      raw_json=excluded.raw_json,
      synced_at=datetime('now')
  `);
  const tx = db.transaction((items: ImwebCouponMasterRow[]) => {
    for (const row of items) {
      stmt.run(row);
    }
  });
  tx(rows);
}

export function upsertImwebIssueCoupons(rows: ImwebIssueCouponRow[]) {
  if (!rows.length) {
    return;
  }
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO imweb_issue_coupons (
      issue_key, site, issue_coupon_code, coupon_code, name, status, type,
      coupon_issue_code, shop_order_code, use_date, raw_json, synced_at
    )
    VALUES (
      @issue_key, @site, @issue_coupon_code, @coupon_code, @name, @status, @type,
      @coupon_issue_code, @shop_order_code, @use_date, @raw_json, datetime('now')
    )
    ON CONFLICT(issue_key) DO UPDATE SET
      site=excluded.site,
      issue_coupon_code=excluded.issue_coupon_code,
      coupon_code=excluded.coupon_code,
      name=excluded.name,
      status=excluded.status,
      type=excluded.type,
      coupon_issue_code=excluded.coupon_issue_code,
      shop_order_code=excluded.shop_order_code,
      use_date=excluded.use_date,
      raw_json=excluded.raw_json,
      synced_at=datetime('now')
  `);
  const tx = db.transaction((items: ImwebIssueCouponRow[]) => {
    for (const row of items) {
      stmt.run(row);
    }
  });
  tx(rows);
}

export function listUnmappedImwebIssueCouponCodes(site: string, limit = 500) {
  const db = getCrmDb();
  return db.prepare(`
    WITH issue_codes AS (
      SELECT DISTINCT json_each.value AS issue_coupon_code
      FROM imweb_orders, json_each(imweb_orders.use_issue_coupon_codes)
      WHERE imweb_orders.site = ?
        AND imweb_orders.coupon_amount > 0
        AND imweb_orders.use_issue_coupon_codes != '[]'
    )
    SELECT issue_codes.issue_coupon_code
    FROM issue_codes
    LEFT JOIN imweb_issue_coupons mapped
      ON mapped.site = ?
      AND mapped.issue_coupon_code = issue_codes.issue_coupon_code
    WHERE mapped.issue_coupon_code IS NULL
    ORDER BY issue_codes.issue_coupon_code
    LIMIT ?
  `).all(site, site, limit) as Array<{ issue_coupon_code: string }>;
}

export function getImwebCouponBackfillStats(site?: string) {
  const db = getCrmDb();
  const where = site ? "WHERE site = ?" : "";
  const params = site ? [site] : [];
  const master = db.prepare(`
    SELECT COUNT(*) AS total, MAX(synced_at) AS last_synced_at
    FROM imweb_coupon_masters
    ${where}
  `).get(...params) as Record<string, unknown>;
  const issue = db.prepare(`
    SELECT COUNT(*) AS total, COUNT(NULLIF(name, '')) AS named, MAX(synced_at) AS last_synced_at
    FROM imweb_issue_coupons
    ${where}
  `).get(...params) as Record<string, unknown>;
  const sourceWhere = site ? "WHERE imweb_orders.site = ?" : "";
  const sourceParams = site ? [site] : [];
  const source = db.prepare(`
    SELECT COUNT(DISTINCT json_each.value) AS total
    FROM imweb_orders, json_each(imweb_orders.use_issue_coupon_codes)
    ${sourceWhere}
  `).get(...sourceParams) as Record<string, unknown>;

  const topNames = db.prepare(`
    SELECT name, COUNT(*) AS issue_count
    FROM imweb_issue_coupons
    ${where}
    GROUP BY name
    ORDER BY issue_count DESC, name
    LIMIT 20
  `).all(...params) as Array<Record<string, unknown>>;

  return {
    site: site ?? "all",
    couponMasters: Number(master.total) || 0,
    couponMastersLastSyncedAt: master.last_synced_at ? String(master.last_synced_at) : null,
    sourceIssueCouponCodes: Number(source.total) || 0,
    mappedIssueCoupons: Number(issue.total) || 0,
    mappedIssueCouponsWithName: Number(issue.named) || 0,
    issueCouponsLastSyncedAt: issue.last_synced_at ? String(issue.last_synced_at) : null,
    topNames: topNames.map((row) => ({
      name: String(row.name ?? ""),
      issueCount: Number(row.issue_count) || 0,
    })),
  };
}

export type ImwebTossReconcileItem = {
  orderIdBase: string;
  orderNo: string;
  paymentKey: string | null;
  imwebPaymentAmount: number | null;
  tossAmount: number | null;
  tossStatus: string | null;
  normalizedPhone: string;
  orderTime: string | null;
  transactionAt: string | null;
};

export type ImwebTossReconcileReport = {
  site: string;
  tossStore: "biocom" | "coffee";
  lookbackDays: number;
  imwebOrders: number;
  tossOrders: number;
  matchedOrders: number;
  missingInToss: number;
  missingInImweb: number;
  amountMismatchCount: number;
  coverageRate: number;
  ageBuckets: Array<{
    key: "0_1d" | "2_7d" | "8_30d" | "31d_plus";
    label: string;
    minAgeDays: number;
    maxAgeDays: number | null;
    imwebOrders: number;
    matchedOrders: number;
    missingInToss: number;
    amountMismatchCount: number;
    coverageRate: number;
  }>;
  samples: {
    missingInToss: ImwebTossReconcileItem[];
    missingInImweb: ImwebTossReconcileItem[];
    amountMismatches: ImwebTossReconcileItem[];
  };
};

const RECONCILE_AGE_BUCKETS = [
  { key: "0_1d" as const, label: "0-1일", minAgeDays: 0, maxAgeDays: 1 },
  { key: "2_7d" as const, label: "2-7일", minAgeDays: 2, maxAgeDays: 7 },
  { key: "8_30d" as const, label: "8-30일", minAgeDays: 8, maxAgeDays: 30 },
  { key: "31d_plus" as const, label: "31일 이상", minAgeDays: 31, maxAgeDays: null },
];

function buildEmptyReconcileAgeBuckets() {
  return RECONCILE_AGE_BUCKETS.map((bucket) => ({
    ...bucket,
    imwebOrders: 0,
    matchedOrders: 0,
    missingInToss: 0,
    amountMismatchCount: 0,
    coverageRate: 0,
  }));
}

function resolveReconcileAgeBucket(ageDays: number) {
  return RECONCILE_AGE_BUCKETS.find((bucket) => (
    ageDays >= bucket.minAgeDays
      && (bucket.maxAgeDays == null || ageDays <= bucket.maxAgeDays)
  )) ?? RECONCILE_AGE_BUCKETS[RECONCILE_AGE_BUCKETS.length - 1];
}

function computeOrderAgeDays(timestamp: string | null, nowMs: number) {
  if (!timestamp) return null;
  const eventMs = new Date(timestamp).getTime();
  if (!Number.isFinite(eventMs)) return null;
  return Math.max(Math.floor((nowMs - eventMs) / 86400000), 0);
}

type ImwebOrderForReconcile = {
  order_no: string;
  payment_amount: number;
  order_time: string | null;
  complete_time: string | null;
  orderer_call: string;
};

type TossTransactionForReconcile = {
  payment_key: string;
  order_id: string;
  amount: number;
  status: string | null;
  transaction_at: string | null;
};

export function getImwebTossReconcileReport(input: {
  site: string;
  limit: number;
  lookbackDays?: number;
  now?: string;
}): ImwebTossReconcileReport {
  const db = getCrmDb();
  const tossStore = input.site === "thecleancoffee" ? "coffee" : "biocom";
  const lookbackDays = Math.max(input.lookbackDays ?? 90, 1);
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const nowMs = input.now ? new Date(input.now).getTime() : Date.now();
  const cutoffDate = new Date(nowMs - lookbackDays * 86400000).toISOString();
  const ageBuckets = buildEmptyReconcileAgeBuckets();
  const ageBucketMap = new Map(ageBuckets.map((bucket) => [bucket.key, bucket]));

  const imwebOrders = db.prepare(`
    SELECT order_no, payment_amount, order_time, complete_time, orderer_call
    FROM imweb_orders
    WHERE site = ?
      AND COALESCE(NULLIF(complete_time, ''), NULLIF(order_time, ''), '') >= ?
    ORDER BY COALESCE(NULLIF(complete_time, ''), NULLIF(order_time, '')) DESC, order_no DESC
  `).all(input.site, cutoffDate) as ImwebOrderForReconcile[];

  const tossTransactions = db.prepare(`
    SELECT payment_key, order_id, amount, status, transaction_at
    FROM toss_transactions
    WHERE COALESCE(transaction_at, '') >= ?
    ORDER BY COALESCE(transaction_at, '') DESC, order_id DESC
  `).all(cutoffDate) as TossTransactionForReconcile[];

  const tossByOrderIdBase = new Map<string, TossTransactionForReconcile>();
  for (const row of tossTransactions) {
    if (inferTossStoreFromPaymentKey(row.payment_key, tossStore) !== tossStore) {
      continue;
    }
    const orderIdBase = normalizeOrderIdBase(row.order_id);
    if (!orderIdBase) continue;
    if (!tossByOrderIdBase.has(orderIdBase)) {
      tossByOrderIdBase.set(orderIdBase, row);
    }
  }

  const missingInToss: ImwebTossReconcileItem[] = [];
  const amountMismatches: ImwebTossReconcileItem[] = [];
  const matchedOrderIds = new Set<string>();
  let amountMismatchCount = 0;

  for (const row of imwebOrders) {
    const orderIdBase = normalizeOrderIdBase(row.order_no);
    if (!orderIdBase) continue;
    const normalizedPhone = normalizePhoneDigits(row.orderer_call);
    const orderTimestamp = row.complete_time || row.order_time;
    const ageDays = computeOrderAgeDays(orderTimestamp, nowMs);
    const ageBucket = ageBucketMap.get(resolveReconcileAgeBucket(ageDays ?? 31).key);
    if (ageBucket) {
      ageBucket.imwebOrders += 1;
    }
    const matched = tossByOrderIdBase.get(orderIdBase);
    if (!matched) {
      if (ageBucket) {
        ageBucket.missingInToss += 1;
      }
      if (missingInToss.length < limit) {
        missingInToss.push({
          orderIdBase,
          orderNo: row.order_no,
          paymentKey: null,
          imwebPaymentAmount: Number(row.payment_amount) || 0,
          tossAmount: null,
          tossStatus: null,
          normalizedPhone,
          orderTime: orderTimestamp,
          transactionAt: null,
        });
      }
      continue;
    }

    matchedOrderIds.add(orderIdBase);
    if (ageBucket) {
      ageBucket.matchedOrders += 1;
    }
    const imwebPaymentAmount = Number(row.payment_amount) || 0;
    const tossAmount = Number(matched.amount) || 0;
    if (imwebPaymentAmount > 0 && tossAmount > 0 && imwebPaymentAmount !== tossAmount) {
      amountMismatchCount += 1;
      if (ageBucket) {
        ageBucket.amountMismatchCount += 1;
      }
      if (amountMismatches.length < limit) {
        amountMismatches.push({
          orderIdBase,
          orderNo: row.order_no,
          paymentKey: matched.payment_key || null,
          imwebPaymentAmount,
          tossAmount,
          tossStatus: matched.status || null,
          normalizedPhone,
          orderTime: orderTimestamp,
          transactionAt: matched.transaction_at,
        });
      }
    }
  }

  const missingInImweb: ImwebTossReconcileItem[] = [];
  for (const [orderIdBase, row] of tossByOrderIdBase.entries()) {
    if (matchedOrderIds.has(orderIdBase)) continue;
    if (missingInImweb.length >= limit) continue;
    missingInImweb.push({
      orderIdBase,
      orderNo: row.order_id,
      paymentKey: row.payment_key || null,
      imwebPaymentAmount: null,
      tossAmount: Number(row.amount) || 0,
      tossStatus: row.status || null,
      normalizedPhone: "",
      orderTime: null,
      transactionAt: row.transaction_at,
    });
  }

  const matchedOrders = matchedOrderIds.size;
  const imwebOrderCount = imwebOrders.filter((row) => Boolean(normalizeOrderIdBase(row.order_no))).length;
  const tossOrderCount = tossByOrderIdBase.size;
  const finalAgeBuckets = ageBuckets.map((bucket) => ({
    ...bucket,
    coverageRate: bucket.imwebOrders > 0
      ? Number(((bucket.matchedOrders / bucket.imwebOrders) * 100).toFixed(2))
      : 0,
  }));

  return {
    site: input.site,
    tossStore,
    lookbackDays,
    imwebOrders: imwebOrderCount,
    tossOrders: tossOrderCount,
    matchedOrders,
    missingInToss: Math.max(imwebOrderCount - matchedOrders, 0),
    missingInImweb: Math.max(tossOrderCount - matchedOrders, 0),
    amountMismatchCount,
    coverageRate: imwebOrderCount > 0 ? Number(((matchedOrders / imwebOrderCount) * 100).toFixed(2)) : 0,
    ageBuckets: finalAgeBuckets,
    samples: {
      missingInToss,
      missingInImweb,
      amountMismatches,
    },
  };
}

export type RepurchaseCandidateRow = {
  memberCode: string;
  name: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastPurchase: number;
  avgOrderAmount: number;
  consentSms: boolean;
  consentEmail: boolean;
};

export function listRepurchaseCandidates(input: {
  site: string;
  minDaysSinceLastPurchase: number;
  maxDaysSinceLastPurchase: number;
  minPurchaseCount: number;
  limit: number;
}): RepurchaseCandidateRow[] {
  const db = getCrmDb();
  const rows = db.prepare(`
    WITH order_agg AS (
      SELECT
        o.member_code AS member_code,
        COUNT(*) AS total_orders,
        COALESCE(SUM(o.payment_amount), 0) AS total_spent,
        MIN(COALESCE(NULLIF(o.complete_time, ''), NULLIF(o.order_time, ''))) AS first_order_date,
        MAX(COALESCE(NULLIF(o.complete_time, ''), NULLIF(o.order_time, ''))) AS last_order_date,
        CAST(
          julianday('now') - julianday(MAX(COALESCE(NULLIF(o.complete_time, ''), NULLIF(o.order_time, ''))))
          AS INTEGER
        ) AS days_since_last_purchase,
        COALESCE(AVG(o.payment_amount), 0) AS avg_order_amount,
        MIN(NULLIF(o.orderer_name, '')) AS fallback_name,
        MIN(NULLIF(o.orderer_call, '')) AS fallback_phone
      FROM imweb_orders o
      WHERE
        o.site = ?
        AND NULLIF(TRIM(o.member_code), '') IS NOT NULL
      GROUP BY o.member_code
    )
    SELECT
      agg.member_code AS member_code,
      COALESCE(NULLIF(m.name, ''), agg.fallback_name) AS name,
      COALESCE(NULLIF(m.callnum, ''), agg.fallback_phone) AS phone,
      agg.total_orders AS total_orders,
      agg.total_spent AS total_spent,
      agg.first_order_date AS first_order_date,
      agg.last_order_date AS last_order_date,
      agg.days_since_last_purchase AS days_since_last_purchase,
      agg.avg_order_amount AS avg_order_amount,
      CASE WHEN COALESCE(m.marketing_agree_sms, 'N') = 'Y' THEN 1 ELSE 0 END AS consent_sms,
      CASE WHEN COALESCE(m.marketing_agree_email, 'N') = 'Y' THEN 1 ELSE 0 END AS consent_email
    FROM order_agg agg
    LEFT JOIN imweb_members m
      ON m.member_code = agg.member_code
      AND m.site = ?
    WHERE
      agg.total_orders >= ?
      AND agg.days_since_last_purchase >= ?
      AND agg.days_since_last_purchase <= ?
    ORDER BY agg.days_since_last_purchase DESC, agg.total_spent DESC, agg.member_code
    LIMIT ?
  `).all(
    input.site,
    input.site,
    input.minPurchaseCount,
    input.minDaysSinceLastPurchase,
    input.maxDaysSinceLastPurchase,
    input.limit,
  ) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memberCode: String(row.member_code),
    name: row.name ? String(row.name) : null,
    phone: row.phone ? String(row.phone) : null,
    totalOrders: Number(row.total_orders) || 0,
    totalSpent: Number(row.total_spent) || 0,
    firstOrderDate: row.first_order_date ? String(row.first_order_date) : null,
    lastOrderDate: row.last_order_date ? String(row.last_order_date) : null,
    daysSinceLastPurchase: Number(row.days_since_last_purchase) || 0,
    avgOrderAmount: Number(row.avg_order_amount) || 0,
    consentSms: Number(row.consent_sms) === 1,
    consentEmail: Number(row.consent_email) === 1,
  }));
}

export function getImwebMembersByPhones(phones: string[]): ImwebMemberRow[] {
  const normalizedPhones = [...new Set(
    phones
      .map((phone) => phone.replace(/[^0-9]/g, ""))
      .filter((phone) => phone.length > 0),
  )];

  if (normalizedPhones.length === 0) {
    return [];
  }

  const placeholders = normalizedPhones.map(() => "?").join(", ");
  return getCrmDb()
    .prepare(`
      SELECT *
      FROM imweb_members
      WHERE REPLACE(REPLACE(callnum, '-', ''), ' ', '') IN (${placeholders})
    `)
    .all(...normalizedPhones) as ImwebMemberRow[];
}

/** 이번 달 또는 지정 월의 생일 고객 목록 조회 */
export function listBirthdayMembers(input: {
  site?: string;
  month?: number; // 1~12, 미지정 시 이번 달
  limit?: number;
}): Array<{ member_code: string; name: string; callnum: string; email: string; birth: string; site: string; marketing_agree_sms: string }> {
  const db = getCrmDb();
  const month = input.month ?? (new Date().getMonth() + 1);
  const monthStr = String(month).padStart(2, "0");
  const limitVal = input.limit ?? 5000;

  const siteClause = input.site ? "AND site = ?" : "";
  const params: unknown[] = [`%-${monthStr}-%`];
  if (input.site) params.push(input.site);
  params.push(limitVal);

  return db.prepare(`
    SELECT member_code, name, callnum, email, birth, site, marketing_agree_sms
    FROM imweb_members
    WHERE birth LIKE ? AND birth != '0000-00-00' AND birth != ''
    ${siteClause}
    ORDER BY SUBSTR(birth, 6) ASC
    LIMIT ?
  `).all(...params) as Array<{ member_code: string; name: string; callnum: string; email: string; birth: string; site: string; marketing_agree_sms: string }>;
}

/* ── A/B 테스트: 재구매 후보 실험 생성 ── */

import { createHash } from "node:crypto";

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function hashBucket(experimentKey: string, customerKey: string): number {
  const hash = createHash("sha256").update(`${experimentKey}:${customerKey}`).digest();
  return hash.readUInt32BE(0) % 10000;
}

export type RepurchaseAbInput = {
  site: string;
  minDays: number;
  maxDays: number;
  minOrders: number;
  variantA: string; // e.g. "sms"
  variantB: string; // e.g. "alimtalk"
  splitBy?: "channel" | "consent"; // channel: 채널 비교 (기본), consent: 동의/미동의 비교
  conversionWindowDays: number;
  experimentName?: string;
};

export type RepurchaseAbResult = {
  experiment: CrmExperiment;
  totalCandidates: number;
  excludedNoConsent: number;
  assigned: { [variant: string]: number };
  groups: { [variant: string]: string };
};

export function createRepurchaseAbExperiment(input: RepurchaseAbInput): RepurchaseAbResult {
  const splitBy = input.splitBy ?? "channel";

  const candidates = listRepurchaseCandidates({
    site: input.site,
    minDaysSinceLastPurchase: input.minDays,
    maxDaysSinceLastPurchase: input.maxDays,
    minPurchaseCount: input.minOrders,
    limit: 10000,
  });

  const totalCandidates = candidates.length;
  const withPhone = candidates.filter((c) => c.phone);

  let eligible: typeof candidates;
  let excludedNoConsent: number;
  let experimentKey: string;
  let experimentName: string;
  let hypothesis: string;
  let channel: string;
  let assignFn: (candidate: (typeof candidates)[0]) => string;

  if (splitBy === "consent") {
    // 동의/미동의 분할: 전화번호 있는 모든 고객 포함, 동의 여부로 그룹 결정
    eligible = withPhone;
    excludedNoConsent = totalCandidates - withPhone.length;
    experimentKey = `repurchase-consent-${input.site}-${input.minDays}-${input.maxDays}-${Date.now()}`;
    experimentName = input.experimentName
      ?? `재구매 동의비교: 동의 vs 미동의 (${input.minDays}-${input.maxDays}일)`;
    hypothesis = `${input.minDays}~${input.maxDays}일 미구매 고객 중 SMS 동의 고객과 미동의 고객의 재구매 전환율 비교 (양군 모두 SMS 발송)`;
    channel = "sms(동의)+sms(미동의)";
    assignFn = (c) => c.consentSms ? input.variantA : input.variantB;
  } else {
    // 채널 분할 (기존): SMS 동의자만 대상, 해시 버킷으로 분할
    eligible = withPhone.filter((c) => c.consentSms);
    excludedNoConsent = totalCandidates - eligible.length;
    experimentKey = `repurchase-ab-${input.site}-${input.minDays}-${input.maxDays}-${Date.now()}`;
    experimentName = input.experimentName
      ?? `재구매 A/B: ${input.variantA} vs ${input.variantB} (${input.minDays}-${input.maxDays}일)`;
    hypothesis = `${input.minDays}~${input.maxDays}일 미구매 고객에게 ${input.variantA} vs ${input.variantB} 발송 시 재구매 전환율 비교`;
    channel = `${input.variantA}+${input.variantB}`;
    assignFn = (c) => {
      const bucket = hashBucket(experimentKey, normalizePhone(c.phone!));
      return bucket < 5000 ? input.variantA : input.variantB;
    };
  }

  const experiment = createExperiment({
    experiment_key: experimentKey,
    name: experimentName,
    channel,
    hypothesis,
    variant_weights: { [input.variantA]: 5000, [input.variantB]: 5000 },
    funnel_stage: "post_purchase",
    conversion_window_days: input.conversionWindowDays,
  });

  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO crm_assignment_log
      (experiment_key, customer_key, variant_key, assignment_version, assignment_bucket, source_segment)
    VALUES (?, ?, ?, 1, ?, ?)
  `);

  const assignCounts: Record<string, number> = { [input.variantA]: 0, [input.variantB]: 0 };

  const insertMany = db.transaction(() => {
    for (const candidate of eligible) {
      const customerKey = normalizePhone(candidate.phone!);
      const variant = assignFn(candidate);
      const bucket = hashBucket(experimentKey, customerKey);
      stmt.run(
        experimentKey,
        customerKey,
        variant,
        bucket,
        `${input.site}:${input.minDays}-${input.maxDays}d:${splitBy}`,
      );
      assignCounts[variant]++;
    }
  });
  insertMany();

  // 실험 variant별 고객 그룹 자동 생성
  const groups: Record<string, string> = {};
  for (const variantKey of [input.variantA, input.variantB]) {
    if (assignCounts[variantKey] > 0) {
      const VARIANT_LABELS: Record<string, string> = {
        sms: "SMS", alimtalk: "알림톡",
        consent_sms: "동의고객", noconsent_sms: "미동의고객",
      };
      const label = VARIANT_LABELS[variantKey] ?? variantKey;
      const group = createGroupFromExperiment(experimentKey, variantKey, `${label} (${input.minDays}-${input.maxDays}일)`);
      groups[variantKey] = group.group_id;
    }
  }

  return {
    experiment,
    totalCandidates,
    excludedNoConsent,
    assigned: assignCounts,
    groups,
  };
}

/* ── A/B 결과 요약 (발송 상태 포함) ── */

export type AbVariantSummary = {
  variant_key: string;
  assigned: number;
  sent: number;
  sendFailed: number;
  purchased: number;
  purchaseRate: number;
  revenue: number;
  avgOrderAmount: number;
};

export function getAbSummary(experimentKey: string): {
  experiment: CrmExperiment | null;
  variants: AbVariantSummary[];
  conversionWindowDays: number;
} {
  const experiment = getExperiment(experimentKey);
  if (!experiment) return { experiment: null, variants: [], conversionWindowDays: 0 };

  const db = getCrmDb();
  const rows = db.prepare(`
    SELECT
      a.variant_key,
      COUNT(DISTINCT a.customer_key) AS assigned,
      COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN a.customer_key END) AS sent,
      COUNT(DISTINCT CASE WHEN m.provider_status = 'fail' THEN a.customer_key END) AS send_failed,
      COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN a.customer_key END) AS purchased,
      COALESCE(SUM(c.net_revenue), 0) AS revenue
    FROM crm_assignment_log a
    LEFT JOIN crm_message_log m
      ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
    LEFT JOIN crm_conversion_log c
      ON c.experiment_key = a.experiment_key AND c.customer_key = a.customer_key
    WHERE a.experiment_key = ?
    GROUP BY a.variant_key
    ORDER BY a.variant_key
  `).all(experimentKey) as Array<Record<string, unknown>>;

  const variants: AbVariantSummary[] = rows.map((r) => {
    const assigned = Number(r.assigned) || 0;
    const purchased = Number(r.purchased) || 0;
    const revenue = Number(r.revenue) || 0;
    return {
      variant_key: String(r.variant_key),
      assigned,
      sent: Number(r.sent) || 0,
      sendFailed: Number(r.send_failed) || 0,
      purchased,
      purchaseRate: assigned > 0 ? purchased / assigned : 0,
      revenue,
      avgOrderAmount: purchased > 0 ? revenue / purchased : 0,
    };
  });

  return { experiment, variants, conversionWindowDays: experiment.conversion_window_days };
}

/* ── 고객 그룹 관리 ── */

export type CustomerGroup = {
  group_id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type CustomerGroupMember = {
  phone: string;
  name: string | null;
  member_code: string | null;
  consent_sms: boolean;
  added_at: string;
};

export function listCustomerGroups(): CustomerGroup[] {
  const db = getCrmDb();
  return db.prepare(`
    SELECT g.group_id, g.name, g.description, g.created_at, g.updated_at,
      (SELECT COUNT(*) FROM crm_customer_group_members m WHERE m.group_id = g.group_id) AS member_count
    FROM crm_customer_groups g
    ORDER BY g.created_at DESC
  `).all() as CustomerGroup[];
}

export function createCustomerGroup(input: { name: string; description?: string }): CustomerGroup {
  const db = getCrmDb();
  const groupId = `grp-${Date.now()}`;
  db.prepare(`
    INSERT INTO crm_customer_groups (group_id, name, description) VALUES (?, ?, ?)
  `).run(groupId, input.name, input.description ?? null);
  return listCustomerGroups().find((g) => g.group_id === groupId)!;
}

export function deleteCustomerGroup(groupId: string): void {
  const db = getCrmDb();
  db.prepare("DELETE FROM crm_customer_group_members WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM crm_customer_groups WHERE group_id = ?").run(groupId);
}

export function listGroupMembers(groupId: string, limit = 500, offset = 0): { total: number; members: CustomerGroupMember[] } {
  const db = getCrmDb();
  const total = (db.prepare("SELECT COUNT(*) AS cnt FROM crm_customer_group_members WHERE group_id = ?").get(groupId) as { cnt: number }).cnt;
  const rows = db.prepare(`
    SELECT phone, name, member_code, consent_sms, added_at
    FROM crm_customer_group_members WHERE group_id = ? ORDER BY added_at DESC LIMIT ? OFFSET ?
  `).all(groupId, limit, offset) as Array<Record<string, unknown>>;
  return {
    total,
    members: rows.map((r) => ({
      phone: String(r.phone),
      name: r.name ? String(r.name) : null,
      member_code: r.member_code ? String(r.member_code) : null,
      consent_sms: Number(r.consent_sms) === 1,
      added_at: String(r.added_at),
    })),
  };
}

export function addGroupMembers(groupId: string, members: Array<{ phone: string; name?: string; member_code?: string; consent_sms?: boolean }>): number {
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO crm_customer_group_members (group_id, phone, name, member_code, consent_sms) VALUES (?, ?, ?, ?, ?)
  `);
  let added = 0;
  const insertMany = db.transaction(() => {
    for (const m of members) {
      const normalized = m.phone.replace(/[^0-9]/g, "");
      if (!normalized) continue;
      const result = stmt.run(groupId, normalized, m.name ?? null, m.member_code ?? null, m.consent_sms ? 1 : 0);
      if (result.changes > 0) added++;
    }
  });
  insertMany();
  db.prepare("UPDATE crm_customer_groups SET updated_at = datetime('now') WHERE group_id = ?").run(groupId);
  return added;
}

export function deleteGroupMembers(groupId: string, phones: string[]): number {
  const db = getCrmDb();
  let deleted = 0;
  const stmt = db.prepare("DELETE FROM crm_customer_group_members WHERE group_id = ? AND phone = ?");
  for (const phone of phones) {
    const result = stmt.run(groupId, phone.replace(/[^0-9]/g, ""));
    deleted += result.changes;
  }
  return deleted;
}

export function createGroupFromExperiment(experimentKey: string, variantKey: string, groupName: string): CustomerGroup {
  const db = getCrmDb();
  const group = createCustomerGroup({ name: groupName, description: `실험 ${experimentKey} - ${variantKey}` });

  const assignments = db.prepare(`
    SELECT a.customer_key AS phone
    FROM crm_assignment_log a
    WHERE a.experiment_key = ? AND a.variant_key = ?
  `).all(experimentKey, variantKey) as Array<{ phone: string }>;

  if (assignments.length > 0) {
    addGroupMembers(group.group_id, assignments.map((a) => ({ phone: a.phone })));
  }

  return listCustomerGroups().find((g) => g.group_id === group.group_id)!;
}

export function listMessageLog(input: { limit?: number; offset?: number; channel?: string }): { total: number; messages: Array<Record<string, unknown>> } {
  const db = getCrmDb();
  const where = input.channel ? "WHERE channel = ?" : "";
  const params: unknown[] = input.channel ? [input.channel] : [];

  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM crm_message_log ${where}`).get(...params) as { cnt: number }).cnt;
  const messages = db.prepare(`
    SELECT id, experiment_key, customer_key, channel, provider_status, template_code, sent_at, response_payload
    FROM crm_message_log ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?
  `).all(...params, input.limit ?? 50, input.offset ?? 0) as Array<Record<string, unknown>>;

  return { total, messages };
}
