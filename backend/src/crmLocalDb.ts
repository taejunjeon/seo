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
 * - crm_scheduled_send: 그룹 예약 발송 작업
 * - crm_saved_segments: 저장 세그먼트 조건 AST
 * - crm_lead_profile: 구매 전 리드 프로필
 * - crm_lead_event_log: 리드 마그넷/상담 예약/첫 구매 이벤트
 * - crm_consent_log: 리드 수신 동의 상태
 * - crm_consent_change_log: 아임웹 회원 SMS/email 동의 변경 감사 로그
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
    ensureColumn(db, "crm_scheduled_send", "template_type", "TEXT DEFAULT NULL");
    ensureColumn(db, "imweb_orders", "imweb_status", "TEXT DEFAULT NULL");
    ensureColumn(db, "imweb_orders", "imweb_status_synced_at", "TEXT DEFAULT NULL");
    // C-Sprint 4 v1.5 — refund 옵션 C (Refund custom event + Purchase 음수 value 이중 전송).
    // 기존 refund_dispatch_log 행에도 purchase_refund_* 컬럼 backfill 가능하게 ensureColumn 으로 추가.
    ensureColumn(db, "refund_dispatch_log", "purchase_refund_dispatched", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db, "refund_dispatch_log", "purchase_refund_dispatched_at", "TEXT");
    ensureColumn(db, "refund_dispatch_log", "purchase_refund_error", "TEXT");
    ensureCustomerGroupLifecycleColumns(db);
    backfillCustomerGroupKinds(db);
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
      group_kind TEXT DEFAULT 'manual',
      source_ref TEXT DEFAULT NULL,
      archived_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_customer_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL REFERENCES crm_customer_groups(group_id),
      phone TEXT NOT NULL,
      name TEXT,
      member_code TEXT,
      consent_sms INTEGER DEFAULT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, phone)
    );

    CREATE TABLE IF NOT EXISTS crm_saved_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      site TEXT NOT NULL,
      query_json TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_evaluated_at TEXT,
      last_result_count INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_saved_segments_site ON crm_saved_segments(site);

    CREATE TABLE IF NOT EXISTS crm_scheduled_send (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      template_code TEXT,
      template_type TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      error_message TEXT,
      admin_override INTEGER NOT NULL DEFAULT 0,
      test_mode INTEGER NOT NULL DEFAULT 0,
      experiment_key TEXT,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_status_time ON crm_scheduled_send(status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_group ON crm_scheduled_send(group_id);

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

    CREATE TABLE IF NOT EXISTS crm_consent_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site TEXT NOT NULL,
      member_code TEXT NOT NULL,
      phone TEXT,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      source TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_consent_member ON crm_consent_change_log(member_code);
    CREATE INDEX IF NOT EXISTS idx_consent_changed_at ON crm_consent_change_log(changed_at);

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

    CREATE TABLE IF NOT EXISTS imweb_order_items (
      line_key TEXT PRIMARY KEY,
      site TEXT,
      order_no TEXT NOT NULL,
      line_no TEXT DEFAULT '',
      shop_name TEXT DEFAULT '',
      item_name TEXT NOT NULL DEFAULT '',
      opt_name TEXT DEFAULT '',
      sale_cnt INTEGER DEFAULT 0,
      pay_amt INTEGER DEFAULT 0,
      order_htel TEXT DEFAULT '',
      ord_time TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'playauto',
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_imweb_order_items_order_no ON imweb_order_items(order_no);
    CREATE INDEX IF NOT EXISTS idx_imweb_order_items_ord_time ON imweb_order_items(ord_time);

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

    -- C-Sprint 4 (confirmed_stopline v1): Toss DONE → CANCELED / PARTIAL_CANCELED 전이를
    -- Meta CAPI Refund + GA4 MP Refund 로 뒤따라 보내기 위한 dispatch log.
    -- UNIQUE (order_id, toss_status) 로 동일 전이에 대한 중복 전송을 막는다.
    CREATE TABLE IF NOT EXISTS refund_dispatch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      payment_key TEXT NOT NULL,
      toss_status TEXT NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      cancel_amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KRW',
      method TEXT,
      site TEXT,
      transaction_at TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      mode TEXT NOT NULL,
      meta_dispatched INTEGER NOT NULL DEFAULT 0,
      meta_dispatched_at TEXT,
      meta_error TEXT,
      ga4_dispatched INTEGER NOT NULL DEFAULT 0,
      ga4_dispatched_at TEXT,
      ga4_error TEXT,
      UNIQUE(order_id, toss_status)
    );
    CREATE INDEX IF NOT EXISTS idx_refund_dispatch_detected ON refund_dispatch_log(detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_refund_dispatch_site ON refund_dispatch_log(site, detected_at DESC);
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

function tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  if (tableHasColumn(db, tableName, columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function ensureCustomerGroupLifecycleColumns(db: Database.Database) {
  ensureColumn(db, "crm_customer_groups", "group_kind", "TEXT DEFAULT 'manual'");
  ensureColumn(db, "crm_customer_groups", "source_ref", "TEXT DEFAULT NULL");
  ensureColumn(db, "crm_customer_groups", "archived_at", "TEXT DEFAULT NULL");
  ensureColumn(db, "crm_customer_group_members", "consent_sms", "INTEGER DEFAULT NULL");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customer_groups_kind ON crm_customer_groups(group_kind, archived_at);
    CREATE INDEX IF NOT EXISTS idx_customer_groups_source_ref ON crm_customer_groups(source_ref);
  `);
}

function backfillCustomerGroupKinds(db: Database.Database) {
  db.exec(`
    UPDATE crm_customer_groups
    SET group_kind = 'manual'
    WHERE group_kind IS NULL OR TRIM(group_kind) = '';

    UPDATE crm_customer_groups
    SET group_kind = 'repurchase_temp'
    WHERE group_kind != 'repurchase_temp'
      AND (
        name LIKE '재구매%'
        OR name LIKE '[임시] 재구매%'
      );

    UPDATE crm_customer_groups
    SET group_kind = 'experiment_snapshot'
    WHERE group_kind NOT IN ('repurchase_temp', 'experiment_snapshot')
      AND (
        name LIKE '실험-%'
        OR COALESCE(description, '') LIKE '실험 %'
      );
  `);
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

export type ConsentChangeEntry = {
  id: number;
  site: string;
  member_code: string;
  phone: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  source: string;
  changed_at: string;
  note: string | null;
};

export type ConsentChangeParams = {
  site: string;
  member_code: string;
  phone?: string | null;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  source: string;
  changed_at?: string | null;
  note?: string | null;
};

type ExistingImwebConsentRow = {
  site: string | null;
  member_code: string;
  callnum: string | null;
  marketing_agree_sms: string | null;
  marketing_agree_email: string | null;
};

const normalizeConsentForCompare = (value: unknown) => String(value ?? "").trim();

function insertConsentChange(db: Database.Database, input: ConsentChangeParams): number {
  const result = db.prepare(`
    INSERT INTO crm_consent_change_log (
      site, member_code, phone, field, old_value, new_value, source, changed_at, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
  `).run(
    input.site,
    input.member_code,
    input.phone ?? null,
    input.field,
    input.old_value ?? null,
    input.new_value ?? null,
    input.source,
    input.changed_at ?? null,
    input.note ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function recordConsentChange(params: ConsentChangeParams): number {
  return insertConsentChange(getCrmDb(), params);
}

export function getConsentChangeById(id: number): ConsentChangeEntry | null {
  const row = getCrmDb().prepare(`
    SELECT id, site, member_code, phone, field, old_value, new_value, source, changed_at, note
    FROM crm_consent_change_log
    WHERE id = ?
  `).get(id) as ConsentChangeEntry | undefined;
  return row ?? null;
}

function recordImwebConsentChanges(
  db: Database.Database,
  row: ImwebMemberRow,
  existing: ExistingImwebConsentRow | undefined,
  source: string,
  note: string,
) {
  const fields = [
    ["marketing_agree_sms", existing?.marketing_agree_sms ?? null, row.marketing_agree_sms],
    ["marketing_agree_email", existing?.marketing_agree_email ?? null, row.marketing_agree_email],
  ] as const;

  const isNewMember = !existing;
  const noteForChange = isNewMember ? `${note} (initial)` : note;

  for (const [field, oldValueRaw, newValueRaw] of fields) {
    const oldValue = normalizeConsentForCompare(oldValueRaw);
    const newValue = normalizeConsentForCompare(newValueRaw);
    // 기존 회원은 변화가 없으면 스킵. 신규 회원은 new_value가 비어있지 않으면 초기값으로 기록.
    if (isNewMember) {
      if (!newValue) continue;
    } else {
      if (oldValue === newValue) continue;
    }
    insertConsentChange(db, {
      site: row.site || existing?.site || "biocom",
      member_code: row.member_code,
      phone: row.callnum || existing?.callnum || null,
      field,
      old_value: isNewMember ? null : oldValue,
      new_value: newValue,
      source,
      note: noteForChange,
    });
  }
}

export function upsertImwebMember(row: ImwebMemberRow) {
  const db = getCrmDb();
  const existing = db.prepare(`
    SELECT site, member_code, callnum, marketing_agree_sms, marketing_agree_email
    FROM imweb_members
    WHERE member_code = ?
  `).get(row.member_code) as ExistingImwebConsentRow | undefined;
  const stmt = db.prepare(`
    INSERT INTO imweb_members (member_code, uid, name, callnum, email, birth, marketing_agree_sms, marketing_agree_email, third_party_agree, member_grade, join_time, last_login_time, site, synced_at)
    VALUES (@member_code, @uid, @name, @callnum, @email, @birth, @marketing_agree_sms, @marketing_agree_email, @third_party_agree, @member_grade, @join_time, @last_login_time, @site, datetime('now'))
    ON CONFLICT(member_code) DO UPDATE SET
      uid=excluded.uid, name=excluded.name, callnum=excluded.callnum, email=excluded.email, birth=excluded.birth,
      marketing_agree_sms=excluded.marketing_agree_sms, marketing_agree_email=excluded.marketing_agree_email,
      third_party_agree=excluded.third_party_agree, member_grade=excluded.member_grade,
      join_time=excluded.join_time, last_login_time=excluded.last_login_time, site=excluded.site, synced_at=datetime('now')
  `);
  const tx = db.transaction((item: ImwebMemberRow) => {
    recordImwebConsentChanges(db, item, existing, "imweb_member_sync", "upsertImwebMember");
    stmt.run(item);
  });
  tx(row);
}

export function upsertImwebMembers(rows: ImwebMemberRow[]) {
  const db = getCrmDb();
  const existingStmt = db.prepare(`
    SELECT site, member_code, callnum, marketing_agree_sms, marketing_agree_email
    FROM imweb_members
    WHERE member_code = ?
  `);
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
    for (const row of items) {
      const existing = existingStmt.get(row.member_code) as ExistingImwebConsentRow | undefined;
      recordImwebConsentChanges(db, row, existing, "imweb_member_sync", "upsertImwebMembers");
      stmt.run(row);
    }
  });
  tx(rows);
}

export function listConsentChanges(input: {
  site?: string;
  memberCode?: string;
  limit?: number;
  offset?: number;
}): { total: number; entries: ConsentChangeEntry[] } {
  const db = getCrmDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.site) {
    conditions.push("site = ?");
    params.push(input.site);
  }
  if (input.memberCode) {
    conditions.push("member_code = ?");
    params.push(input.memberCode);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  const offset = Math.max(0, input.offset ?? 0);

  const total = (db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM crm_consent_change_log
    ${where}
  `).get(...params) as { cnt: number }).cnt;

  const entries = db.prepare(`
    SELECT id, site, member_code, phone, field, old_value, new_value, source, changed_at, note
    FROM crm_consent_change_log
    ${where}
    ORDER BY changed_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ConsentChangeEntry[];

  return { total, entries };
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

export function getImwebMemberByMemberCode(memberCode: string) {
  const normalized = memberCode.trim();
  if (!normalized) return undefined;
  return getCrmDb().prepare("SELECT * FROM imweb_members WHERE member_code = ?").get(normalized) as ImwebMemberRow | undefined;
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

/* ── 예약 발송 ── */

export type ScheduledSendStatus =
  | "pending"
  | "running"
  | "success"
  | "partial"
  | "fail"
  | "canceled";

export type ScheduledSendChannel = "alimtalk" | "sms";

export type ScheduledSendRow = {
  id: number;
  group_id: string;
  channel: ScheduledSendChannel;
  template_code: string | null;
  template_type: string | null;
  subject: string | null;
  message: string;
  scheduled_at: string;
  status: ScheduledSendStatus;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_count: number;
  success_count: number;
  fail_count: number;
  error_message: string | null;
  admin_override: number;
  test_mode: number;
  experiment_key: string | null;
  note: string | null;
};

export type ScheduledSendInput = {
  group_id: string;
  channel: ScheduledSendChannel;
  template_code?: string | null;
  template_type?: string | null;
  subject?: string | null;
  message: string;
  scheduled_at: string;
  created_by?: string | null;
  admin_override?: boolean | number;
  test_mode?: boolean | number;
  experiment_key?: string | null;
  note?: string | null;
};

export function createScheduledSend(input: ScheduledSendInput): { id: number; status: "pending" } {
  const result = getCrmDb().prepare(`
    INSERT INTO crm_scheduled_send (
      group_id, channel, template_code, template_type, subject, message, scheduled_at,
      created_by, admin_override, test_mode, experiment_key, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.group_id,
    input.channel,
    input.template_code ?? null,
    input.template_type ?? null,
    input.subject ?? null,
    input.message,
    input.scheduled_at,
    input.created_by ?? null,
    input.admin_override ? 1 : 0,
    input.test_mode ? 1 : 0,
    input.experiment_key ?? null,
    input.note ?? null,
  );
  return { id: Number(result.lastInsertRowid), status: "pending" };
}

export function listScheduledSends(input: {
  status?: ScheduledSendStatus;
  groupId?: string;
  limit?: number;
  offset?: number;
} = {}): { total: number; rows: ScheduledSendRow[] } {
  const db = getCrmDb();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (input.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }
  if (input.groupId) {
    conditions.push("group_id = ?");
    params.push(input.groupId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(input.limit ?? 50, 500));
  const offset = Math.max(0, input.offset ?? 0);
  const total = (db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM crm_scheduled_send
    ${where}
  `).get(...params) as { cnt: number }).cnt;
  const rows = db.prepare(`
    SELECT *
    FROM crm_scheduled_send
    ${where}
    ORDER BY scheduled_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ScheduledSendRow[];
  return { total, rows };
}

export function getScheduledSend(id: number): ScheduledSendRow | null {
  const row = getCrmDb().prepare("SELECT * FROM crm_scheduled_send WHERE id = ?").get(id) as ScheduledSendRow | undefined;
  return row ?? null;
}

export function cancelScheduledSend(id: number): boolean {
  const result = getCrmDb().prepare(`
    UPDATE crm_scheduled_send
    SET status = 'canceled', finished_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(id);
  return result.changes > 0;
}

export function claimDueScheduledSends(now: string, limit = 10): ScheduledSendRow[] {
  return getCrmDb().prepare(`
    UPDATE crm_scheduled_send
    SET status = 'running', started_at = datetime('now'), error_message = NULL
    WHERE id IN (
      SELECT id
      FROM crm_scheduled_send
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC, id ASC
      LIMIT ?
    )
    RETURNING *
  `).all(now, Math.max(1, limit)) as ScheduledSendRow[];
}

export function finishScheduledSend(id: number, input: {
  status: Extract<ScheduledSendStatus, "success" | "partial" | "fail">;
  successCount: number;
  failCount: number;
  errorMessage?: string | null;
}): void {
  const successCount = Math.max(0, input.successCount);
  const failCount = Math.max(0, input.failCount);
  getCrmDb().prepare(`
    UPDATE crm_scheduled_send
    SET
      status = ?,
      finished_at = datetime('now'),
      total_count = ?,
      success_count = ?,
      fail_count = ?,
      error_message = ?
    WHERE id = ?
  `).run(
    input.status,
    successCount + failCount,
    successCount,
    failCount,
    input.errorMessage ?? null,
    id,
  );
}

/* ── 저장 세그먼트 ── */

export type SavedSegmentRow = {
  id: number;
  name: string;
  site: string;
  query_json: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_evaluated_at: string | null;
  last_result_count: number | null;
};

export function createSavedSegment(input: {
  name: string;
  site: string;
  queryJson: string;
  description?: string | null;
  createdBy?: string | null;
  resultCount: number;
}): SavedSegmentRow {
  const result = getCrmDb().prepare(`
    INSERT INTO crm_saved_segments (
      name, site, query_json, description, created_by, last_evaluated_at, last_result_count
    )
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(
    input.name,
    input.site,
    input.queryJson,
    input.description ?? null,
    input.createdBy ?? null,
    input.resultCount,
  );
  return getSavedSegment(Number(result.lastInsertRowid))!;
}

export function listSavedSegments(site: string): SavedSegmentRow[] {
  return getCrmDb().prepare(`
    SELECT id, name, site, query_json, description, created_by, created_at, updated_at, last_evaluated_at, last_result_count
    FROM crm_saved_segments
    WHERE site = ?
    ORDER BY created_at DESC, id DESC
  `).all(site) as SavedSegmentRow[];
}

export function getSavedSegment(id: number): SavedSegmentRow | null {
  const row = getCrmDb().prepare(`
    SELECT id, name, site, query_json, description, created_by, created_at, updated_at, last_evaluated_at, last_result_count
    FROM crm_saved_segments
    WHERE id = ?
  `).get(id) as SavedSegmentRow | undefined;
  return row ?? null;
}

export function deleteSavedSegment(id: number): boolean {
  const result = getCrmDb().prepare("DELETE FROM crm_saved_segments WHERE id = ?").run(id);
  return result.changes > 0;
}

/* ── 고객 그룹 관리 ── */

export type CustomerGroupKind =
  | "manual"
  | "repurchase_temp"
  | "experiment_snapshot"
  | "segment_snapshot";

export type CustomerGroup = {
  group_id: string;
  name: string;
  description: string | null;
  group_kind: CustomerGroupKind;
  source_ref: string | null;
  archived_at: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type CustomerGroupMember = {
  phone: string;
  name: string | null;
  member_code: string | null;
  consent_sms: boolean | null;
  added_at: string;
};

export function listCustomerGroups(input: {
  kind?: CustomerGroupKind | "all";
  includeArchived?: boolean;
} = {}): CustomerGroup[] {
  const db = getCrmDb();
  const kind = input.kind ?? "manual";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (kind !== "all") {
    conditions.push("COALESCE(g.group_kind, 'manual') = ?");
    params.push(kind);
    if (!input.includeArchived) {
      conditions.push("g.archived_at IS NULL");
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`
    SELECT
      g.group_id,
      g.name,
      g.description,
      COALESCE(g.group_kind, 'manual') AS group_kind,
      g.source_ref,
      g.archived_at,
      g.created_at,
      g.updated_at,
      (SELECT COUNT(*) FROM crm_customer_group_members m WHERE m.group_id = g.group_id) AS member_count
    FROM crm_customer_groups g
    ${where}
    ORDER BY g.created_at DESC
  `).all(...params) as CustomerGroup[];
}

export function getCustomerGroup(groupId: string): CustomerGroup | null {
  return listCustomerGroups({ kind: "all" }).find((g) => g.group_id === groupId) ?? null;
}

export function getCustomerGroupStats(): Record<CustomerGroupKind | "archived", number> {
  const rows = getCrmDb().prepare(`
    SELECT COALESCE(group_kind, 'manual') AS group_kind, COUNT(*) AS cnt
    FROM crm_customer_groups
    WHERE archived_at IS NULL
    GROUP BY COALESCE(group_kind, 'manual')
  `).all() as Array<{ group_kind: CustomerGroupKind; cnt: number }>;
  const archived = (getCrmDb().prepare(`
    SELECT COUNT(*) AS cnt
    FROM crm_customer_groups
    WHERE archived_at IS NOT NULL
  `).get() as { cnt: number }).cnt;
  const counts: Record<CustomerGroupKind | "archived", number> = {
    manual: 0,
    repurchase_temp: 0,
    experiment_snapshot: 0,
    segment_snapshot: 0,
    archived,
  };
  for (const row of rows) {
    if (row.group_kind in counts) {
      counts[row.group_kind] = Number(row.cnt) || 0;
    }
  }
  return counts;
}

function normalizeCustomerGroupKind(value: unknown): CustomerGroupKind {
  return value === "repurchase_temp"
    || value === "experiment_snapshot"
    || value === "segment_snapshot"
    || value === "manual"
    ? value
    : "manual";
}

export function createCustomerGroup(input: {
  name: string;
  description?: string;
  kind?: CustomerGroupKind;
  sourceRef?: string | null;
}): CustomerGroup {
  const db = getCrmDb();
  const groupId = `grp-${Date.now()}`;
  const kind = normalizeCustomerGroupKind(input.kind);
  db.prepare(`
    INSERT INTO crm_customer_groups (group_id, name, description, group_kind, source_ref)
    VALUES (?, ?, ?, ?, ?)
  `).run(groupId, input.name, input.description ?? null, kind, input.sourceRef ?? null);
  return getCustomerGroup(groupId)!;
}

export function deleteCustomerGroup(groupId: string): void {
  const db = getCrmDb();
  db.prepare("DELETE FROM crm_customer_group_members WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM crm_customer_groups WHERE group_id = ?").run(groupId);
}

export function canArchiveGroup(groupId: string): { canArchive: boolean; reason?: string } {
  const normalized = groupId.trim();
  if (!normalized) {
    return { canArchive: false, reason: "groupId가 필요하다" };
  }
  const db = getCrmDb();
  const recurrenceCondition = tableHasColumn(db, "crm_scheduled_send", "recurrence_rule")
    ? "COALESCE(recurrence_rule, '') != ''"
    : "0";
  const row = db.prepare(`
    SELECT id, status
    FROM crm_scheduled_send
    WHERE group_id = ?
      AND (
        status IN ('pending', 'running')
        OR (status = 'success' AND ${recurrenceCondition})
      )
    LIMIT 1
  `).get(normalized) as { id: number; status: string } | undefined;

  if (!row) return { canArchive: true };
  return {
    canArchive: false,
    reason: `예약 발송 #${row.id}(${row.status})이 이 그룹을 참조 중이다`,
  };
}

export function archiveCustomerGroup(groupId: string): boolean {
  const result = getCrmDb().prepare(`
    UPDATE crm_customer_groups
    SET archived_at = datetime('now'), updated_at = datetime('now')
    WHERE group_id = ?
  `).run(groupId);
  return result.changes > 0;
}

export function listArchivedCustomerGroupsForCleanup(): Array<{ group_id: string; name: string; group_kind: CustomerGroupKind; archived_at: string }> {
  return getCrmDb().prepare(`
    SELECT group_id, name, COALESCE(group_kind, 'manual') AS group_kind, archived_at
    FROM crm_customer_groups
    WHERE archived_at IS NOT NULL
      AND archived_at < datetime('now', '-30 days')
  `).all() as Array<{ group_id: string; name: string; group_kind: CustomerGroupKind; archived_at: string }>;
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
      consent_sms: r.consent_sms === null || r.consent_sms === undefined ? null : Number(r.consent_sms) === 1,
      added_at: String(r.added_at),
    })),
  };
}

export function addGroupMembers(groupId: string, members: Array<{ phone: string; name?: string; member_code?: string; consent_sms?: boolean | null }>): number {
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO crm_customer_group_members (group_id, phone, name, member_code, consent_sms) VALUES (?, ?, ?, ?, ?)
  `);
  let added = 0;
  const insertMany = db.transaction(() => {
    for (const m of members) {
      const normalized = m.phone.replace(/[^0-9]/g, "");
      if (!normalized) continue;
      const consentSms = typeof m.consent_sms === "boolean" ? (m.consent_sms ? 1 : 0) : null;
      const result = stmt.run(groupId, normalized, m.name ?? null, m.member_code ?? null, consentSms);
      if (result.changes > 0) added++;
    }
  });
  insertMany();
  db.prepare("UPDATE crm_customer_groups SET updated_at = datetime('now') WHERE group_id = ?").run(groupId);
  return added;
}

export function createRepurchaseTempGroup(input: {
  name: string;
  description?: string;
  sourceRef?: string | null;
  members: Array<{ phone: string; name?: string; member_code?: string; consent_sms?: boolean | null }>;
}): CustomerGroup {
  const group = createCustomerGroup({
    name: input.name,
    description: input.description,
    kind: "repurchase_temp",
    sourceRef: input.sourceRef ?? null,
  });
  if (input.members.length > 0) {
    addGroupMembers(group.group_id, input.members);
  }
  return getCustomerGroup(group.group_id)!;
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
  const group = createCustomerGroup({
    name: groupName,
    description: `실험 ${experimentKey} - ${variantKey}`,
    kind: "experiment_snapshot",
    sourceRef: `experiment:${experimentKey}:${variantKey}`,
  });

  // assignment_log의 customer_key(정규화 전화번호)로 imweb_members를 조인하여 이름/고객번호/동의 가져오기
  const rows = db.prepare(`
    SELECT
      a.customer_key AS phone,
      COALESCE(m.name, '') AS name,
      COALESCE(m.member_code, '') AS member_code,
      CASE WHEN COALESCE(m.marketing_agree_sms, 'N') = 'Y' THEN 1 ELSE 0 END AS consent_sms
    FROM crm_assignment_log a
    LEFT JOIN imweb_members m
      ON REPLACE(REPLACE(REPLACE(m.callnum, '-', ''), ' ', ''), '+82', '0') = a.customer_key
    WHERE a.experiment_key = ? AND a.variant_key = ?
  `).all(experimentKey, variantKey) as Array<{ phone: string; name: string; member_code: string; consent_sms: number }>;

  if (rows.length > 0) {
    addGroupMembers(group.group_id, rows.map((r) => ({
      phone: r.phone,
      name: r.name || undefined,
      member_code: r.member_code || undefined,
      consent_sms: r.consent_sms === 1,
    })));
  }

  return getCustomerGroup(group.group_id)!;
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

/* ─── Phase 2: 고객 목록 / 등급 / 세그먼트 ─── */

export function listCustomers(input: {
  site: string;
  search?: string;
  grade?: string;
  consentSms?: boolean;
  limit?: number;
  offset?: number;
}): {
  total: number;
  customers: Array<{
    member_code: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    member_grade: string | null;
    join_time: string | null;
    marketing_agree_sms: string;
    total_orders: number;
    total_spent: number;
    last_order_date: string | null;
  }>;
} {
  const db = getCrmDb();
  const conditions: string[] = ["m.site = ?"];
  const params: unknown[] = [input.site];

  if (input.search) {
    const like = `%${input.search}%`;
    conditions.push("(m.name LIKE ? OR m.callnum LIKE ? OR m.email LIKE ?)");
    params.push(like, like, like);
  }
  if (input.grade) {
    conditions.push("m.member_grade = ?");
    params.push(input.grade);
  }
  if (input.consentSms !== undefined) {
    conditions.push("m.marketing_agree_sms = ?");
    params.push(input.consentSms ? "Y" : "N");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const total = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM imweb_members m ${where}`).get(...params) as { cnt: number }
  ).cnt;

  const rows = db.prepare(`
    SELECT
      m.member_code,
      m.name,
      m.callnum AS phone,
      m.email,
      m.member_grade,
      m.join_time,
      m.marketing_agree_sms,
      COALESCE(o.total_orders, 0) AS total_orders,
      COALESCE(o.total_spent, 0) AS total_spent,
      o.last_order_date
    FROM imweb_members m
    LEFT JOIN (
      SELECT member_code,
             COUNT(*) AS total_orders,
             SUM(payment_amount) AS total_spent,
             MAX(order_time) AS last_order_date
      FROM imweb_orders
      WHERE site = ?
      GROUP BY member_code
    ) o ON m.member_code = o.member_code
    ${where}
    ORDER BY m.join_time DESC
    LIMIT ? OFFSET ?
  `).all(input.site, ...params, limit, offset) as Array<{
    member_code: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    member_grade: string | null;
    join_time: string | null;
    marketing_agree_sms: string;
    total_orders: number;
    total_spent: number;
    last_order_date: string | null;
  }>;

  return { total, customers: rows };
}

export function listShoppingGrades(site: string): Array<{ grade: string; count: number }> {
  const db = getCrmDb();
  return db.prepare(`
    SELECT COALESCE(member_grade, '(없음)') AS grade, COUNT(*) AS count
    FROM imweb_members
    WHERE site = ?
    GROUP BY member_grade
    ORDER BY count DESC
  `).all(site) as Array<{ grade: string; count: number }>;
}

export function queryCustomerSegment(input: {
  site: string;
  segment: string;
  params?: Record<string, string>;
}): {
  total: number;
  customers: Array<{ member_code: string; name: string | null; phone: string | null; email: string | null }>;
} {
  const db = getCrmDb();
  const { site, segment } = input;
  let sql: string;
  const sqlParams: unknown[] = [site];

  switch (segment) {
    case "no_repurchase":
      // Members with exactly 1 order
      sql = `
        SELECT m.member_code, m.name, m.callnum AS phone, m.email
        FROM imweb_members m
        INNER JOIN (
          SELECT member_code, COUNT(*) AS cnt
          FROM imweb_orders WHERE site = ?
          GROUP BY member_code HAVING cnt = 1
        ) o ON m.member_code = o.member_code
        WHERE m.site = ?
      `;
      sqlParams.push(site); // second ? for m.site
      break;
    case "birthday_month":
      // Members whose birth month matches current month
      sql = `
        SELECT m.member_code, m.name, m.callnum AS phone, m.email
        FROM imweb_members m
        WHERE m.site = ?
          AND m.birth IS NOT NULL AND m.birth != ''
          AND CAST(SUBSTR(m.birth, 5, 2) AS INTEGER) = CAST(STRFTIME('%m', 'now') AS INTEGER)
      `;
      break;
    case "high_spender":
      // Members with total_spent > 300000
      sql = `
        SELECT m.member_code, m.name, m.callnum AS phone, m.email
        FROM imweb_members m
        INNER JOIN (
          SELECT member_code, SUM(payment_amount) AS total_spent
          FROM imweb_orders WHERE site = ?
          GROUP BY member_code HAVING total_spent > 300000
        ) o ON m.member_code = o.member_code
        WHERE m.site = ?
      `;
      sqlParams.push(site);
      break;
    case "inactive_90d":
      // Members with no order in 90 days but had at least 1 order
      sql = `
        SELECT m.member_code, m.name, m.callnum AS phone, m.email
        FROM imweb_members m
        INNER JOIN (
          SELECT member_code, MAX(order_time) AS last_order
          FROM imweb_orders WHERE site = ?
          GROUP BY member_code
          HAVING DATE(last_order) < DATE('now', '-90 days')
        ) o ON m.member_code = o.member_code
        WHERE m.site = ?
      `;
      sqlParams.push(site);
      break;
    case "new_member_30d":
      // Members who joined in the last 30 days
      sql = `
        SELECT m.member_code, m.name, m.callnum AS phone, m.email
        FROM imweb_members m
        WHERE m.site = ?
          AND m.join_time IS NOT NULL
          AND DATE(m.join_time) >= DATE('now', '-30 days')
      `;
      break;
    default:
      return { total: 0, customers: [] };
  }

  const rows = db.prepare(sql).all(...sqlParams) as Array<{
    member_code: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  }>;

  return { total: rows.length, customers: rows };
}

/* ── 캠페인 성과 퍼널 ── */

export type FunnelStep = { label: string; count: number; rate: number };
export type FunnelVariant = { variant_key: string; sent: number; delivered: number; visited: number; purchased: number; revenue: number; purchase_rate: number };

export function getExperimentFunnel(experimentKey: string): {
  experiment: CrmExperiment | null;
  funnel: { sent: number; delivered: number; visited: number; purchased: number; revenue: number };
  rates: { delivery_rate: number; visit_rate: number; purchase_rate: number; overall_rate: number };
  variants: FunnelVariant[];
} {
  const experiment = getExperiment(experimentKey);
  if (!experiment) return { experiment: null, funnel: { sent: 0, delivered: 0, visited: 0, purchased: 0, revenue: 0 }, rates: { delivery_rate: 0, visit_rate: 0, purchase_rate: 0, overall_rate: 0 }, variants: [] };

  const db = getCrmDb();
  const windowDays = experiment.conversion_window_days;

  // 발송/성공 집계. Frontend: this endpoint now includes a visited stage between delivered and purchased.
  const sendRows = db.prepare(`
    SELECT
      a.variant_key,
      COUNT(DISTINCT a.customer_key) AS assigned,
      COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN a.customer_key END) AS sent,
      COUNT(DISTINCT CASE WHEN m.provider_status = 'success' THEN a.customer_key END) AS delivered
    FROM crm_assignment_log a
    LEFT JOIN crm_message_log m
      ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
    WHERE a.experiment_key = ?
    GROUP BY a.variant_key
  `).all(experimentKey) as Array<Record<string, unknown>>;

  const attributionTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attribution_ledger'
  `).get() as { name: string } | undefined;
  const visitRows = attributionTable ? db.prepare(`
    WITH first_success AS (
      SELECT experiment_key, customer_key, MIN(sent_at) AS sent_at
      FROM crm_message_log
      WHERE experiment_key = ? AND provider_status = 'success'
      GROUP BY experiment_key, customer_key
    )
    SELECT
      a.variant_key,
      COUNT(DISTINCT a.customer_key) AS visited
    FROM crm_assignment_log a
    INNER JOIN first_success m
      ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
    INNER JOIN attribution_ledger l
      ON (
        l.customer_key = a.customer_key
        OR COALESCE(json_extract(l.metadata_json, '$.normalizedPhone'), '') = a.customer_key
      )
      AND julianday(l.logged_at) >= julianday(m.sent_at)
      AND julianday(l.logged_at) <= julianday(m.sent_at) + ?
    WHERE a.experiment_key = ?
    GROUP BY a.variant_key
  `).all(experimentKey, windowDays, experimentKey) as Array<Record<string, unknown>> : [];

  // 구매 전환 집계 (발송 성공 후 window 내 구매)
  const purchaseRows = db.prepare(`
    SELECT
      a.variant_key,
      COUNT(DISTINCT o.member_code) AS purchased,
      COALESCE(SUM(o.payment_amount), 0) AS revenue
    FROM crm_assignment_log a
    INNER JOIN crm_message_log m
      ON m.experiment_key = a.experiment_key AND m.customer_key = a.customer_key
      AND m.provider_status = 'success'
    LEFT JOIN imweb_members mb
      ON REPLACE(REPLACE(REPLACE(mb.callnum, '-', ''), ' ', ''), '+82', '0') = a.customer_key
    LEFT JOIN imweb_orders o
      ON o.member_code = mb.member_code
      AND o.site = 'thecleancoffee'
      AND NULLIF(o.complete_time, '') IS NOT NULL
      AND julianday(o.complete_time) >= julianday(m.sent_at)
      AND julianday(o.complete_time) <= julianday(m.sent_at) + ?
    WHERE a.experiment_key = ?
    GROUP BY a.variant_key
  `).all(windowDays, experimentKey) as Array<Record<string, unknown>>;

  const purchaseMap = new Map<string, { purchased: number; revenue: number }>();
  for (const r of purchaseRows) {
    purchaseMap.set(String(r.variant_key), { purchased: Number(r.purchased) || 0, revenue: Number(r.revenue) || 0 });
  }

  // attribution_ledger has no experiment_key. We only count visits when its customer_key
  // or metadata.normalizedPhone matches the experiment's normalized phone; anonymous GA/session-only visits stay unassigned.
  const visitMap = new Map<string, number>();
  for (const r of visitRows) {
    visitMap.set(String(r.variant_key), Number(r.visited) || 0);
  }

  let totalSent = 0, totalDelivered = 0, totalVisited = 0, totalPurchased = 0, totalRevenue = 0;
  const variants: FunnelVariant[] = sendRows.map((r) => {
    const vk = String(r.variant_key);
    const sent = Number(r.sent) || 0;
    const delivered = Number(r.delivered) || 0;
    const visited = visitMap.get(vk) ?? 0;
    const p = purchaseMap.get(vk) ?? { purchased: 0, revenue: 0 };
    totalSent += sent;
    totalDelivered += delivered;
    totalVisited += visited;
    totalPurchased += p.purchased;
    totalRevenue += p.revenue;
    return { variant_key: vk, sent, delivered, visited, purchased: p.purchased, revenue: p.revenue, purchase_rate: visited > 0 ? p.purchased / visited : 0 };
  });

  return {
    experiment,
    funnel: { sent: totalSent, delivered: totalDelivered, visited: totalVisited, purchased: totalPurchased, revenue: totalRevenue },
    rates: {
      delivery_rate: totalSent > 0 ? totalDelivered / totalSent : 0,
      visit_rate: totalDelivered > 0 ? totalVisited / totalDelivered : 0,
      purchase_rate: totalVisited > 0 ? totalPurchased / totalVisited : 0,
      overall_rate: totalSent > 0 ? totalPurchased / totalSent : 0,
    },
    variants,
  };
}
