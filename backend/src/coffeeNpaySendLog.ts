/**
 * A-6 외부 플랫폼 보강 전송 — skeleton (dry-run only).
 *
 * Sprint 22 (2026-05-02): design + skeleton + dry-run only.
 * 본 commit 시점:
 *   - 외부 플랫폼 (GA4 MP / Meta CAPI / TikTok Events / Google Ads) 실제 send 0
 *   - schema (coffee_npay_send_log) 정의 만, ensure 시점에 SQLite 에 자동 생성
 *   - dry_run mode 만 호출 가능 (validation + plan 출력 정도)
 *   - enforce 활성은 A-5 closure + TJ 명시 승인 후 별도 sprint (22.1, 22.2)
 *
 * 가드 (sprint 19.7 패턴 재사용):
 *   - env flag COFFEE_NPAY_INTENT_A6_SEND_LIVE=true (본 sprint 에서는 default false)
 *   - production_mode OR smoke_window 활성 (A-4 publish 후 운영 모드 가드)
 *   - A6_DAILY_QUOTA=200 일일 cap (publish 후 traffic 60-100/일 기준)
 *   - dedup: UNIQUE (platform, transaction_id) 제약
 *   - retry: 5xx/network 만 retry (max 3회 / 24h), 4xx permanent_failure
 *
 * 외부 send 는 별도 module (`runA6SendEnforce`) 에서 — 본 skeleton 은 throw.
 */

import { getCrmDb } from "./crmLocalDb";

const A6_SEND_LIVE_FLAG = "COFFEE_NPAY_INTENT_A6_SEND_LIVE";
const A6_SEND_LOG_TABLE = "coffee_npay_send_log";
const A6_SCHEMA_VERSION = 1;
const A6_DAILY_QUOTA = 200;

const SCHEMA_VERSIONS_TABLE = "schema_versions";
const A6_SCHEMA_KEY = "coffee_npay_send_log";

export type A6Platform = "ga4_mp" | "meta_capi" | "tiktok_events" | "google_ads";

export interface A6SendPayload {
  ledger_id: number;
  platform: A6Platform;
  transaction_id: string;
  imweb_order_code: string;
  /** GA4 MP / Meta CAPI 등 platform-specific payload (validation 시 schema 검증) */
  platform_payload?: Record<string, unknown>;
}

export interface A6SendLogRow {
  id: number;
  ledger_id: number;
  platform: A6Platform;
  transaction_id: string;
  imweb_order_code: string;
  send_mode: "dry_run" | "enforce";
  send_status: string | null;
  send_response_code: number | null;
  send_response_body: string | null;
  send_payload_hash: string | null;
  attempts: number;
  last_attempt_ms: number | null;
  permanent_failure: number;
  created_at: string;
}

let a6SchemaEnsured = false;

export function ensureA6SendLogSchema(): void {
  if (a6SchemaEnsured) return;
  const db = getCrmDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSIONS_TABLE} (
      key TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${A6_SEND_LOG_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      imweb_order_code TEXT NOT NULL,
      send_mode TEXT NOT NULL,
      send_status TEXT,
      send_response_code INTEGER,
      send_response_body TEXT,
      send_payload_hash TEXT,
      attempts INTEGER DEFAULT 1,
      last_attempt_ms INTEGER,
      permanent_failure INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', '+09:00'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_${A6_SEND_LOG_TABLE}_platform_tx
      ON ${A6_SEND_LOG_TABLE} (platform, transaction_id);
    CREATE INDEX IF NOT EXISTS idx_${A6_SEND_LOG_TABLE}_ledger_id
      ON ${A6_SEND_LOG_TABLE} (ledger_id);
    CREATE INDEX IF NOT EXISTS idx_${A6_SEND_LOG_TABLE}_status
      ON ${A6_SEND_LOG_TABLE} (send_status, created_at);
  `);
  db.prepare(
    `INSERT OR REPLACE INTO ${SCHEMA_VERSIONS_TABLE} (key, version, updated_at) VALUES (?, ?, datetime('now'))`,
  ).run(A6_SCHEMA_KEY, A6_SCHEMA_VERSION);
  a6SchemaEnsured = true;
}

export function validateA6Payload(p: A6SendPayload): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof p.ledger_id !== "number" || p.ledger_id <= 0) {
    errors.push("ledger_id required (positive integer)");
  }
  if (!["ga4_mp", "meta_capi", "tiktok_events", "google_ads"].includes(p.platform)) {
    errors.push("platform must be one of [ga4_mp, meta_capi, tiktok_events, google_ads]");
  }
  if (typeof p.transaction_id !== "string" || !p.transaction_id) {
    errors.push("transaction_id required (non-empty string)");
  }
  if (typeof p.imweb_order_code !== "string" || !p.imweb_order_code) {
    errors.push("imweb_order_code required (non-empty string)");
  }
  // GA4 MP 특화 schema (platform === 'ga4_mp')
  if (p.platform === "ga4_mp" && p.platform_payload) {
    const pp = p.platform_payload;
    if (!pp.events || !Array.isArray(pp.events)) {
      errors.push("ga4_mp: platform_payload.events required (array)");
    }
    if (!pp.client_id) {
      errors.push("ga4_mp: platform_payload.client_id required");
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * dry_run mode: validation + plan 출력 만. INSERT 0, send 0.
 * enforce 활성은 A-5 closure + TJ 명시 승인 후만.
 */
export function runA6SendDryRun(p: A6SendPayload): {
  ok: boolean;
  mode: "dry_run";
  validation: { ok: boolean; errors: string[] };
  insert_skipped_reason: string;
  send_live_flag_state: { env_key: string; value: string | null; active: boolean };
  notes: string[];
} {
  ensureA6SendLogSchema();
  const validation = validateA6Payload(p);
  const sendLiveFlag = process.env[A6_SEND_LIVE_FLAG] ?? null;
  const flagState = {
    env_key: A6_SEND_LIVE_FLAG,
    value: sendLiveFlag,
    active: sendLiveFlag === "true",
  };

  if (!validation.ok) {
    return {
      ok: false,
      mode: "dry_run",
      validation,
      insert_skipped_reason: "validation_failed",
      send_live_flag_state: flagState,
      notes: ["INSERT 안 함 (dry_run + validation_failed)"],
    };
  }
  return {
    ok: true,
    mode: "dry_run",
    validation,
    insert_skipped_reason: "dry_run_mode",
    send_live_flag_state: flagState,
    notes: [
      `INSERT 안 함 (dry_run mode). enforce mode 진입은 A-5 closure + TJ 승인 + ${A6_SEND_LIVE_FLAG}=true 필수`,
      `${p.platform} platform 의 transaction_id=${p.transaction_id} payload validation OK`,
      "design 단계 — backend send module 은 본 commit 에서 skeleton + dry-run only",
    ],
  };
}

/**
 * enforce mode — 본 sprint 에서는 throw. 후속 sprint 22.1+ 에서 구현.
 */
export function runA6SendEnforce(_p: A6SendPayload): never {
  throw new Error(
    `runA6SendEnforce: A-5 closure + TJ 명시 send 승인 후만 활성. 본 sprint (22) 의 commit 시점에는 사용 금지. ${A6_SEND_LIVE_FLAG} env flag + production_mode OR smoke_window 가드 + daily_quota_a6 (${A6_DAILY_QUOTA}) 검사 + dedup 후 send 가 후속 sprint 22.1+ 에서 구현됨.`,
  );
}

export function getA6SendLogStats(): {
  ok: boolean;
  schema_version: number;
  schema_ensured: boolean;
  send_live_flag_active: boolean;
  send_live_flag_env_key: string;
  daily_send_count: number;
  daily_quota: number;
  total_rows: number;
  rows_by_platform: Record<string, number>;
  rows_by_status: Record<string, number>;
} {
  ensureA6SendLogSchema();
  const db = getCrmDb();
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM ${A6_SEND_LOG_TABLE}`).get() as { cnt: number }).cnt;

  const byPlatformRows = db
    .prepare(`SELECT platform, COUNT(*) AS cnt FROM ${A6_SEND_LOG_TABLE} GROUP BY platform`)
    .all() as { platform: string; cnt: number }[];
  const byPlatform: Record<string, number> = {};
  for (const r of byPlatformRows) byPlatform[r.platform] = r.cnt;

  const byStatusRows = db
    .prepare(`SELECT send_status, COUNT(*) AS cnt FROM ${A6_SEND_LOG_TABLE} GROUP BY send_status`)
    .all() as { send_status: string | null; cnt: number }[];
  const byStatus: Record<string, number> = {};
  for (const r of byStatusRows) byStatus[r.send_status ?? "null"] = r.cnt;

  // daily count (today KST)
  const todayKst = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 10);
  const startKst = `${todayKst} 00:00:00`;
  const dailyCount = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM ${A6_SEND_LOG_TABLE} WHERE created_at >= ?`).get(startKst) as {
      cnt: number;
    }
  ).cnt;

  return {
    ok: true,
    schema_version: A6_SCHEMA_VERSION,
    schema_ensured: a6SchemaEnsured,
    send_live_flag_active: process.env[A6_SEND_LIVE_FLAG] === "true",
    send_live_flag_env_key: A6_SEND_LIVE_FLAG,
    daily_send_count: dailyCount,
    daily_quota: A6_DAILY_QUOTA,
    total_rows: total,
    rows_by_platform: byPlatform,
    rows_by_status: byStatus,
  };
}
