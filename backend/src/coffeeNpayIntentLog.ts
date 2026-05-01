/**
 * Coffee NPay Intent Log (A-1: enforce 준비 + 제한적 live capture 승인 대기)
 *
 * 더클린커피 NPay click 시점에 preview snippet (all-in-one v0.4+v0.5+v0.6) 가
 * 발급한 intent payload 를 backend ledger 로 받아 deterministic join 의 한 축
 * (`coffee_npay_intent_log.imweb_order_code = imweb_orders.order_code`) 을 만든다.
 *
 * 본 phase (A-1) 는:
 *   - schema v2 정의 (DROP+CREATE — v1 은 데이터 0건이라 안전)
 *   - validation 강화 (preview_only=true 강제, source_version 필수, PII reject)
 *   - dry-run 응답 (INSERT 0)
 *   - enforce-mode 함수 정의 (env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true`
 *     일 때만 활성. 본 phase 는 default false 라 호출되어도 safety reject)
 *   - join 리포트 5종 status 분류 (read-only)
 *
 * 가드:
 *   - 외부 API / GA4 MP / Meta CAPI / TikTok Events / Google Ads 송출 0건
 *   - 운영 DB write 0건 (enforce flag 활성 전까지)
 *   - GTM publish / live script 삽입 BLOCKED
 *   - PII (phone, email, name, address, orderer_*, receiver_*, option text) reject
 *   - preview_only !== true reject (snippet 가 false 로 박는 경우 미인정)
 */

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

const TABLE = "coffee_npay_intent_log";
const SCHEMA_VERSIONS_TABLE = "schema_versions";
const SCHEMA_KEY = "coffee_npay_intent_log";
const SCHEMA_VERSION = 2;

const ENFORCE_ENV_FLAG = "COFFEE_NPAY_INTENT_ENFORCE_LIVE";

const PII_KEYS_BLOCKED = [
  "phone",
  "email",
  "name",
  "address",
  "addr",
  "addr_detail",
  "orderer_name",
  "orderer_call",
  "orderer_email",
  "receiver_name",
  "receiver_call",
  "receiver_addr",
  "option_text",
  "memo",
  "delivery_memo",
] as const;

const REQUIRED_FIELDS = [
  "site",
  "version",
  "intent_phase",
  "intent_uuid",
] as const;

const ALLOWED_INTENT_PHASE = new Set([
  "click_to_dialog",
  "dialog_to_npay",
  "confirm_to_pay",
  "sanity_test",
]);

const SITE_ALLOWED = new Set(["thecleancoffee"]);
const RAW_JSON_MAX_BYTES = 16 * 1024;

let schemaEnsured = false;

function ensureSchemaVersionsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSIONS_TABLE} (
      key TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function readCurrentSchemaVersion(db: Database.Database): number {
  ensureSchemaVersionsTable(db);
  const row = db
    .prepare(
      `SELECT version FROM ${SCHEMA_VERSIONS_TABLE} WHERE key = ?`,
    )
    .get(SCHEMA_KEY) as { version: number } | undefined;
  return row?.version ?? 0;
}

function writeSchemaVersion(db: Database.Database, version: number) {
  db.prepare(
    `INSERT INTO ${SCHEMA_VERSIONS_TABLE} (key, version, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
  ).run(SCHEMA_KEY, version);
}

export function ensureCoffeeNpayIntentLogSchema(): void {
  if (schemaEnsured) return;
  const db = getCrmDb();
  const cur = readCurrentSchemaVersion(db);
  if (cur >= SCHEMA_VERSION) {
    schemaEnsured = true;
    return;
  }
  // 기존 테이블 (v1 또는 untracked) 이 존재하면 row count > 0 일 때만 abort.
  // 0건이면 DROP + CREATE 안전. 본 phase 는 enforce 미활성이라 0건 보장.
  const existing = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    )
    .get(TABLE) as { name: string } | undefined;
  if (existing) {
    const cnt = (
      db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }
    ).cnt;
    if (cnt > 0) {
      throw new Error(
        `coffee_npay_intent_log → v${SCHEMA_VERSION} migration aborted: ${cnt} rows present. manual migration required.`,
      );
    }
    db.exec(`DROP TABLE ${TABLE}`);
  }
  db.exec(`
    CREATE TABLE ${TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site TEXT NOT NULL,
      intent_uuid TEXT NOT NULL,
      source_version TEXT NOT NULL,
      intent_phase TEXT NOT NULL,
      session_uuid TEXT,
      intent_seq INTEGER,
      ts_ms_kst INTEGER,
      captured_at_kst TEXT,
      prod_idx INTEGER,
      prod_code TEXT,
      prod_price INTEGER,
      selected_option_count INTEGER,
      selected_quantity INTEGER,
      estimated_item_total INTEGER,
      metadata_missing INTEGER,
      metadata_source TEXT,
      funnel_capi_session_id TEXT,
      funnel_capi_eid_observed TEXT,
      imweb_order_code TEXT,
      imweb_order_code_eid TEXT,
      imweb_order_code_capture_delay_ms INTEGER,
      ga4_synthetic_transaction_id TEXT,
      ga4_synthetic_transaction_id_capture_delay_ms INTEGER,
      ga_client_id TEXT,
      ga_session_id TEXT,
      payment_button_type TEXT,
      page_url TEXT,
      page_path TEXT,
      user_agent_class TEXT,
      preview_only INTEGER NOT NULL DEFAULT 1,
      is_simulation INTEGER NOT NULL DEFAULT 0,
      raw_payload_json TEXT NOT NULL,
      inserted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX uniq_${TABLE}_site_intent_uuid
      ON ${TABLE}(site, intent_uuid);
    CREATE UNIQUE INDEX uniq_${TABLE}_site_order_intent
      ON ${TABLE}(site, imweb_order_code, intent_uuid)
      WHERE imweb_order_code IS NOT NULL;
    CREATE INDEX idx_${TABLE}_imweb_order_code
      ON ${TABLE}(imweb_order_code) WHERE imweb_order_code IS NOT NULL;
    CREATE INDEX idx_${TABLE}_ts_ms ON ${TABLE}(ts_ms_kst);
    CREATE INDEX idx_${TABLE}_session_uuid ON ${TABLE}(session_uuid);
    CREATE INDEX idx_${TABLE}_prod_code_ts ON ${TABLE}(prod_code, ts_ms_kst);
    CREATE INDEX idx_${TABLE}_synthetic_tx
      ON ${TABLE}(ga4_synthetic_transaction_id) WHERE ga4_synthetic_transaction_id IS NOT NULL;
  `);
  writeSchemaVersion(db, SCHEMA_VERSION);
  schemaEnsured = true;
}

export type CoffeeNpayIntentPayload = {
  site?: string;
  version?: string;
  intent_phase?: string;
  session_uuid?: string;
  intent_uuid?: string;
  intent_seq?: number;
  ts_ms_kst?: number;
  ts_label_kst?: string;
  prod_idx?: number;
  prod_code?: string;
  prod_price?: number;
  selected_option_count?: number;
  selected_quantity?: number;
  estimated_item_total?: number;
  metadata_missing?: boolean;
  metadata_source?: string;
  funnel_capi_session_id?: string;
  funnel_capi_eid_observed?: string;
  imweb_order_code?: string;
  imweb_order_code_eid?: string;
  imweb_order_code_capture_delay_ms?: number;
  ga4_synthetic_transaction_id?: string;
  ga4_synthetic_transaction_id_capture_delay_ms?: number;
  ga_client_id?: string;
  ga_session_id?: string;
  payment_button_type?: string;
  page_url?: string;
  page_path?: string;
  user_agent_class?: string;
  is_simulation?: boolean;
  preview_only?: boolean;
  [k: string]: unknown;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  pii_fields_found: string[];
};

export function validateIntentPayload(payload: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const piiFound: string[] = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      errors: ["payload must be a non-array object"],
      warnings: [],
      pii_fields_found: [],
    };
  }
  const p = payload as Record<string, unknown>;

  for (const f of REQUIRED_FIELDS) {
    if (typeof p[f] !== "string" || !(p[f] as string).trim()) {
      errors.push(`${f} is required (string, non-empty)`);
    }
  }
  if (typeof p.site === "string" && !SITE_ALLOWED.has(p.site)) {
    errors.push(`site must be one of [${[...SITE_ALLOWED].join(", ")}]`);
  }
  if (typeof p.intent_phase === "string" && !ALLOWED_INTENT_PHASE.has(p.intent_phase)) {
    errors.push(
      `intent_phase must be one of [${[...ALLOWED_INTENT_PHASE].join(", ")}]`,
    );
  }
  if (typeof p.intent_uuid === "string" && p.intent_uuid.length > 64) {
    errors.push("intent_uuid too long (>64 chars)");
  }
  if (p.payment_button_type !== undefined && p.payment_button_type !== "npay") {
    errors.push("payment_button_type must be 'npay' (only NPay supported)");
  }
  if (p.preview_only !== true) {
    errors.push("preview_only must be true (snippet은 항상 true 박음 — false 면 변조 의심)");
  }
  if (p.is_simulation === true) {
    warnings.push("is_simulation: true — sanity_test payload, ledger insert 시 제외 권장");
  }

  for (const k of Object.keys(p)) {
    const lower = k.toLowerCase();
    for (const blocked of PII_KEYS_BLOCKED) {
      if (lower === blocked || lower.includes(blocked)) {
        piiFound.push(k);
        break;
      }
    }
  }

  let rawJson = "";
  try {
    rawJson = JSON.stringify(p);
  } catch (e) {
    errors.push("payload not JSON serializable");
  }
  if (rawJson.length > RAW_JSON_MAX_BYTES) {
    errors.push(
      `payload too large (${rawJson.length}B > ${RAW_JSON_MAX_BYTES}B limit)`,
    );
  }

  return {
    ok: errors.length === 0 && piiFound.length === 0,
    errors,
    warnings,
    pii_fields_found: piiFound,
  };
}

export type LedgerRowPreview = {
  site: string;
  intent_uuid: string;
  source_version: string;
  intent_phase: string;
  session_uuid: string;
  intent_seq: number | null;
  ts_ms_kst: number | null;
  captured_at_kst: string | null;
  prod_code: string;
  prod_price: number | null;
  selected_quantity: number | null;
  estimated_item_total: number | null;
  imweb_order_code: string | null;
  imweb_order_code_capture_delay_ms: number | null;
  ga4_synthetic_transaction_id: string | null;
  ga4_synthetic_transaction_id_capture_delay_ms: number | null;
  funnel_capi_session_id: string;
  payment_button_type: string;
  preview_only: number;
  is_simulation: number;
};

function tsLabelKst(p: CoffeeNpayIntentPayload): string | null {
  if (typeof p.ts_label_kst === "string" && p.ts_label_kst) return p.ts_label_kst;
  if (typeof p.ts_ms_kst === "number") {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(p.ts_ms_kst));
  }
  return null;
}

export function buildLedgerRowPreview(
  p: CoffeeNpayIntentPayload,
): LedgerRowPreview {
  return {
    site: String(p.site ?? ""),
    intent_uuid: String(p.intent_uuid ?? ""),
    source_version: String(p.version ?? ""),
    intent_phase: String(p.intent_phase ?? ""),
    session_uuid: String(p.session_uuid ?? ""),
    intent_seq: typeof p.intent_seq === "number" ? p.intent_seq : null,
    ts_ms_kst: typeof p.ts_ms_kst === "number" ? p.ts_ms_kst : null,
    captured_at_kst: tsLabelKst(p),
    prod_code: String(p.prod_code ?? ""),
    prod_price: typeof p.prod_price === "number" ? p.prod_price : null,
    selected_quantity:
      typeof p.selected_quantity === "number" ? p.selected_quantity : null,
    estimated_item_total:
      typeof p.estimated_item_total === "number" ? p.estimated_item_total : null,
    imweb_order_code:
      typeof p.imweb_order_code === "string" && p.imweb_order_code
        ? p.imweb_order_code
        : null,
    imweb_order_code_capture_delay_ms:
      typeof p.imweb_order_code_capture_delay_ms === "number"
        ? p.imweb_order_code_capture_delay_ms
        : null,
    ga4_synthetic_transaction_id:
      typeof p.ga4_synthetic_transaction_id === "string" &&
      p.ga4_synthetic_transaction_id
        ? p.ga4_synthetic_transaction_id
        : null,
    ga4_synthetic_transaction_id_capture_delay_ms:
      typeof p.ga4_synthetic_transaction_id_capture_delay_ms === "number"
        ? p.ga4_synthetic_transaction_id_capture_delay_ms
        : null,
    funnel_capi_session_id: String(p.funnel_capi_session_id ?? ""),
    payment_button_type: String(p.payment_button_type ?? ""),
    preview_only: p.preview_only === true ? 1 : 0,
    is_simulation: p.is_simulation === true ? 1 : 0,
  };
}

function buildSafeRawPayloadJson(p: CoffeeNpayIntentPayload): string {
  // PII 키는 reject 단계에서 막혔지만 raw_payload_json 에서도 한 번 더 거름.
  const safe: Record<string, unknown> = {};
  for (const k of Object.keys(p)) {
    const lower = k.toLowerCase();
    let blocked = false;
    for (const b of PII_KEYS_BLOCKED) {
      if (lower === b || lower.includes(b)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    safe[k] = p[k];
  }
  return JSON.stringify(safe);
}

export type DryRunResponse = {
  ok: boolean;
  mode: "dry_run";
  schema_version: number;
  schema_ensured: boolean;
  validation: ValidationResult;
  ledger_row_preview: LedgerRowPreview | null;
  insert_skipped_reason: string;
  enforce_flag_state: { env_key: string; value: string | null; active: boolean };
  notes: string[];
};

export function runDryRun(payload: CoffeeNpayIntentPayload): DryRunResponse {
  ensureCoffeeNpayIntentLogSchema();
  const validation = validateIntentPayload(payload);
  const notes: string[] = [];
  const enforceFlag = process.env[ENFORCE_ENV_FLAG] ?? null;
  const flagState = {
    env_key: ENFORCE_ENV_FLAG,
    value: enforceFlag,
    active: enforceFlag === "true",
  };

  if (!validation.ok) {
    return {
      ok: false,
      mode: "dry_run",
      schema_version: SCHEMA_VERSION,
      schema_ensured: schemaEnsured,
      validation,
      ledger_row_preview: null,
      insert_skipped_reason: "validation_failed",
      enforce_flag_state: flagState,
      notes: ["INSERT 안 함 (dry_run + validation_failed)"],
    };
  }
  if (validation.warnings.length > 0) {
    notes.push(...validation.warnings.map((w) => `warning: ${w}`));
  }

  const preview = buildLedgerRowPreview(payload);
  notes.push(
    "INSERT 안 함 (dry_run mode). enforce mode 진입은 별도 phase + " +
      ENFORCE_ENV_FLAG +
      "=true + TJ 승인 필수",
  );
  notes.push(
    `imweb_order_code 매핑 가능성: ${
      preview.imweb_order_code ? "YES (deterministic key 확보)" : "NO (snippet retry capture 추가 필요)"
    }`,
  );
  notes.push(
    `ga4_synthetic_transaction_id 매핑 가능성: ${
      preview.ga4_synthetic_transaction_id
        ? "YES (BigQuery transaction_id join 가능)"
        : "NO (v0.7 정찰 후 가능, optional)"
    }`,
  );
  return {
    ok: true,
    mode: "dry_run",
    schema_version: SCHEMA_VERSION,
    schema_ensured: schemaEnsured,
    validation,
    ledger_row_preview: preview,
    insert_skipped_reason: "dry_run_mode",
    enforce_flag_state: flagState,
    notes,
  };
}

export type EnforceResponse = {
  ok: boolean;
  mode: "enforce";
  schema_version: number;
  validation: ValidationResult;
  inserted: boolean;
  deduped: boolean;
  inserted_id: number | null;
  enforce_flag_state: { env_key: string; value: string | null; active: boolean };
  reason: string;
  ledger_row_preview: LedgerRowPreview | null;
  notes: string[];
};

/**
 * enforce mode INSERT — 본 phase 에서는 환경변수 ENFORCE_ENV_FLAG=true 일 때만
 * 실제 INSERT. default false 라 기본 reject. TJ 승인 + env flag 활성 후에만
 * 운영에 노출된다. 본 phase commit 시점에는 호출 path 없음 (route alias 가
 * 항상 dry_run 으로만 dispatch).
 */
export function runEnforceInsert(payload: CoffeeNpayIntentPayload): EnforceResponse {
  ensureCoffeeNpayIntentLogSchema();
  const validation = validateIntentPayload(payload);
  const enforceFlag = process.env[ENFORCE_ENV_FLAG] ?? null;
  const flagState = {
    env_key: ENFORCE_ENV_FLAG,
    value: enforceFlag,
    active: enforceFlag === "true",
  };

  if (!flagState.active) {
    return {
      ok: false,
      mode: "enforce",
      schema_version: SCHEMA_VERSION,
      validation,
      inserted: false,
      deduped: false,
      inserted_id: null,
      enforce_flag_state: flagState,
      reason: "enforce_flag_not_active",
      ledger_row_preview: null,
      notes: [
        `INSERT 안 함 — ${ENFORCE_ENV_FLAG}=true 가 필요. 본 phase 는 default false`,
      ],
    };
  }
  if (!validation.ok) {
    return {
      ok: false,
      mode: "enforce",
      schema_version: SCHEMA_VERSION,
      validation,
      inserted: false,
      deduped: false,
      inserted_id: null,
      enforce_flag_state: flagState,
      reason: "validation_failed",
      ledger_row_preview: null,
      notes: ["INSERT 안 함 (validation_failed)"],
    };
  }
  if (payload.is_simulation === true) {
    return {
      ok: false,
      mode: "enforce",
      schema_version: SCHEMA_VERSION,
      validation,
      inserted: false,
      deduped: false,
      inserted_id: null,
      enforce_flag_state: flagState,
      reason: "is_simulation_blocked",
      ledger_row_preview: null,
      notes: ["INSERT 안 함 (is_simulation=true 는 ledger 진입 금지)"],
    };
  }

  const db = getCrmDb();
  const preview = buildLedgerRowPreview(payload);
  const rawJson = buildSafeRawPayloadJson(payload);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ${TABLE} (
      site, intent_uuid, source_version, intent_phase, session_uuid, intent_seq,
      ts_ms_kst, captured_at_kst, prod_idx, prod_code, prod_price,
      selected_option_count, selected_quantity, estimated_item_total,
      metadata_missing, metadata_source,
      funnel_capi_session_id, funnel_capi_eid_observed,
      imweb_order_code, imweb_order_code_eid, imweb_order_code_capture_delay_ms,
      ga4_synthetic_transaction_id, ga4_synthetic_transaction_id_capture_delay_ms,
      ga_client_id, ga_session_id, payment_button_type, page_url, page_path,
      user_agent_class, preview_only, is_simulation, raw_payload_json
    ) VALUES (
      @site, @intent_uuid, @source_version, @intent_phase, @session_uuid, @intent_seq,
      @ts_ms_kst, @captured_at_kst, @prod_idx, @prod_code, @prod_price,
      @selected_option_count, @selected_quantity, @estimated_item_total,
      @metadata_missing, @metadata_source,
      @funnel_capi_session_id, @funnel_capi_eid_observed,
      @imweb_order_code, @imweb_order_code_eid, @imweb_order_code_capture_delay_ms,
      @ga4_synthetic_transaction_id, @ga4_synthetic_transaction_id_capture_delay_ms,
      @ga_client_id, @ga_session_id, @payment_button_type, @page_url, @page_path,
      @user_agent_class, @preview_only, @is_simulation, @raw_payload_json
    )
  `);
  const params = {
    site: preview.site,
    intent_uuid: preview.intent_uuid,
    source_version: preview.source_version,
    intent_phase: preview.intent_phase,
    session_uuid: preview.session_uuid,
    intent_seq: preview.intent_seq,
    ts_ms_kst: preview.ts_ms_kst,
    captured_at_kst: preview.captured_at_kst,
    prod_idx: typeof payload.prod_idx === "number" ? payload.prod_idx : null,
    prod_code: preview.prod_code,
    prod_price: preview.prod_price,
    selected_option_count:
      typeof payload.selected_option_count === "number"
        ? payload.selected_option_count
        : null,
    selected_quantity: preview.selected_quantity,
    estimated_item_total: preview.estimated_item_total,
    metadata_missing:
      payload.metadata_missing === true
        ? 1
        : payload.metadata_missing === false
          ? 0
          : null,
    metadata_source:
      typeof payload.metadata_source === "string"
        ? payload.metadata_source
        : null,
    funnel_capi_session_id: preview.funnel_capi_session_id,
    funnel_capi_eid_observed:
      typeof payload.funnel_capi_eid_observed === "string"
        ? payload.funnel_capi_eid_observed
        : null,
    imweb_order_code: preview.imweb_order_code,
    imweb_order_code_eid:
      typeof payload.imweb_order_code_eid === "string"
        ? payload.imweb_order_code_eid
        : null,
    imweb_order_code_capture_delay_ms:
      preview.imweb_order_code_capture_delay_ms,
    ga4_synthetic_transaction_id: preview.ga4_synthetic_transaction_id,
    ga4_synthetic_transaction_id_capture_delay_ms:
      preview.ga4_synthetic_transaction_id_capture_delay_ms,
    ga_client_id:
      typeof payload.ga_client_id === "string" ? payload.ga_client_id : null,
    ga_session_id:
      typeof payload.ga_session_id === "string" ? payload.ga_session_id : null,
    payment_button_type: preview.payment_button_type,
    page_url: typeof payload.page_url === "string" ? payload.page_url : null,
    page_path: typeof payload.page_path === "string" ? payload.page_path : null,
    user_agent_class:
      typeof payload.user_agent_class === "string"
        ? payload.user_agent_class
        : null,
    preview_only: preview.preview_only,
    is_simulation: preview.is_simulation,
    raw_payload_json: rawJson,
  };
  const info = stmt.run(params);
  const inserted = info.changes === 1;
  const deduped = info.changes === 0;
  const insertedId =
    inserted && typeof info.lastInsertRowid === "number"
      ? info.lastInsertRowid
      : inserted && typeof info.lastInsertRowid === "bigint"
        ? Number(info.lastInsertRowid)
        : null;

  return {
    ok: true,
    mode: "enforce",
    schema_version: SCHEMA_VERSION,
    validation,
    inserted,
    deduped,
    inserted_id: insertedId,
    enforce_flag_state: flagState,
    reason: inserted ? "inserted_new" : "deduped_existing",
    ledger_row_preview: preview,
    notes: [
      inserted
        ? "INSERT OK — confirmed order join 7일 모니터링 시작"
        : "기존 (site, intent_uuid) row 존재 — INSERT OR IGNORE 로 dedupe",
    ],
  };
}

export function getCoffeeNpayIntentLogStats(): {
  ok: true;
  schema_version: number;
  schema_ensured: boolean;
  enforce_flag_active: boolean;
  total_rows: number;
  rows_with_imweb_order_code: number;
  rows_with_ga4_synthetic_transaction_id: number;
  latest_ts_ms_kst: number | null;
} {
  ensureCoffeeNpayIntentLogSchema();
  const db = getCrmDb();
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }).cnt;
  const withCode = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE} WHERE imweb_order_code IS NOT NULL`).get() as { cnt: number }
  ).cnt;
  const withTx = (
    db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE} WHERE ga4_synthetic_transaction_id IS NOT NULL`).get() as { cnt: number }
  ).cnt;
  const latestRow = db.prepare(`SELECT MAX(ts_ms_kst) AS ts FROM ${TABLE}`).get() as { ts: number | null };
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    schema_ensured: schemaEnsured,
    enforce_flag_active: process.env[ENFORCE_ENV_FLAG] === "true",
    total_rows: total,
    rows_with_imweb_order_code: withCode,
    rows_with_ga4_synthetic_transaction_id: withTx,
    latest_ts_ms_kst: latestRow.ts ?? null,
  };
}

export type IntentRow = {
  id: number;
  site: string;
  intent_uuid: string;
  source_version: string;
  intent_phase: string;
  session_uuid: string | null;
  intent_seq: number | null;
  ts_ms_kst: number | null;
  captured_at_kst: string | null;
  prod_code: string | null;
  prod_price: number | null;
  selected_quantity: number | null;
  estimated_item_total: number | null;
  imweb_order_code: string | null;
  ga4_synthetic_transaction_id: string | null;
  funnel_capi_session_id: string | null;
  page_path: string | null;
  preview_only: number;
  is_simulation: number;
  inserted_at: string;
};

export function listCoffeeNpayIntents(opts: {
  site?: string;
  limit?: number;
  withImwebOrderCode?: boolean;
}): IntentRow[] {
  ensureCoffeeNpayIntentLogSchema();
  const db = getCrmDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.site) {
    conditions.push("site = @site");
    params.site = opts.site;
  }
  if (opts.withImwebOrderCode) {
    conditions.push("imweb_order_code IS NOT NULL");
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = db
    .prepare(
      `SELECT id, site, intent_uuid, source_version, intent_phase, session_uuid,
              intent_seq, ts_ms_kst, captured_at_kst, prod_code, prod_price,
              selected_quantity, estimated_item_total, imweb_order_code,
              ga4_synthetic_transaction_id, funnel_capi_session_id, page_path,
              preview_only, is_simulation, inserted_at
       FROM ${TABLE}
       ${where}
       ORDER BY id DESC
       LIMIT ${limit}`,
    )
    .all(params) as IntentRow[];
  return rows;
}

export type JoinStatus =
  | "joined_confirmed_order"
  | "pending_order_sync"
  | "no_order_after_24h"
  | "duplicated_intent"
  | "invalid_payload";

export type JoinReportRow = {
  id: number;
  site: string;
  intent_uuid: string;
  imweb_order_code: string | null;
  intent_ts_ms_kst: number | null;
  intent_captured_at_kst: string | null;
  imweb_order_no: string | null;
  imweb_order_time: string | null;
  imweb_pay_type: string | null;
  imweb_payment_amount: number | null;
  join_status: JoinStatus;
  age_hours: number | null;
};

/**
 * 7일 모니터링용 join dry-run 리포트.
 *
 * coffee_npay_intent_log.imweb_order_code = imweb_orders.order_code (site 동일)
 * 5종 status:
 *   - joined_confirmed_order: order_code 매핑 + imweb_orders 행 존재
 *   - pending_order_sync: imweb_order_code 잡혔으나 imweb_orders 미존재 (sync
 *     가 아직 안 일어남, age < 24h)
 *   - no_order_after_24h: imweb_order_code 잡혔는데 24h 후에도 imweb_orders
 *     미존재 (NPay 결제 미완료 또는 sync gap)
 *   - duplicated_intent: 같은 (site, imweb_order_code) 에 다중 intent_uuid
 *   - invalid_payload: imweb_order_code 자체가 null (snippet retry 실패)
 */
export function getCoffeeNpayIntentJoinReport(opts: {
  site?: string;
  windowDays?: number;
  limit?: number;
}): {
  ok: true;
  generated_at: string;
  schema_version: number;
  window_days: number;
  enforce_flag_active: boolean;
  total_intents_in_window: number;
  status_counts: Record<JoinStatus, number>;
  rows: JoinReportRow[];
} {
  ensureCoffeeNpayIntentLogSchema();
  const db = getCrmDb();
  const site = opts.site || "thecleancoffee";
  const windowDays = Math.min(Math.max(opts.windowDays ?? 7, 1), 30);
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const cutoffMs = Date.now() - windowDays * 24 * 3600 * 1000;
  const nowMs = Date.now();

  const intentRows = db
    .prepare(
      `SELECT id, site, intent_uuid, imweb_order_code, ts_ms_kst, captured_at_kst
       FROM ${TABLE}
       WHERE site = @site
         AND (ts_ms_kst IS NULL OR ts_ms_kst >= @cutoffMs)
         AND is_simulation = 0
       ORDER BY id DESC
       LIMIT @limit`,
    )
    .all({ site, cutoffMs, limit }) as Array<{
      id: number;
      site: string;
      intent_uuid: string;
      imweb_order_code: string | null;
      ts_ms_kst: number | null;
      captured_at_kst: string | null;
    }>;

  // duplicated detection: 같은 imweb_order_code 에 intent_uuid 여러 개
  const dupCodes = new Set<string>();
  const codeIntentMap = new Map<string, number>();
  for (const r of intentRows) {
    if (!r.imweb_order_code) continue;
    const key = `${r.site}::${r.imweb_order_code}`;
    codeIntentMap.set(key, (codeIntentMap.get(key) ?? 0) + 1);
  }
  for (const [k, c] of codeIntentMap) {
    if (c > 1) dupCodes.add(k);
  }

  const statusCounts: Record<JoinStatus, number> = {
    joined_confirmed_order: 0,
    pending_order_sync: 0,
    no_order_after_24h: 0,
    duplicated_intent: 0,
    invalid_payload: 0,
  };
  const orderStmt = db.prepare(
    `SELECT order_no, order_time, pay_type, payment_amount
       FROM imweb_orders WHERE site = ? AND order_code = ? LIMIT 1`,
  );

  const rows: JoinReportRow[] = intentRows.map((r) => {
    if (!r.imweb_order_code) {
      statusCounts.invalid_payload += 1;
      return {
        id: r.id,
        site: r.site,
        intent_uuid: r.intent_uuid,
        imweb_order_code: null,
        intent_ts_ms_kst: r.ts_ms_kst,
        intent_captured_at_kst: r.captured_at_kst,
        imweb_order_no: null,
        imweb_order_time: null,
        imweb_pay_type: null,
        imweb_payment_amount: null,
        join_status: "invalid_payload",
        age_hours: r.ts_ms_kst != null ? Math.round((nowMs - r.ts_ms_kst) / 3600000) : null,
      };
    }
    const dupKey = `${r.site}::${r.imweb_order_code}`;
    const order = orderStmt.get(r.site, r.imweb_order_code) as
      | {
          order_no: string;
          order_time: string;
          pay_type: string;
          payment_amount: number;
        }
      | undefined;
    let status: JoinStatus;
    if (dupCodes.has(dupKey)) {
      status = "duplicated_intent";
    } else if (order) {
      status = "joined_confirmed_order";
    } else {
      const ageHours = r.ts_ms_kst != null ? (nowMs - r.ts_ms_kst) / 3600000 : 0;
      status = ageHours < 24 ? "pending_order_sync" : "no_order_after_24h";
    }
    statusCounts[status] += 1;
    return {
      id: r.id,
      site: r.site,
      intent_uuid: r.intent_uuid,
      imweb_order_code: r.imweb_order_code,
      intent_ts_ms_kst: r.ts_ms_kst,
      intent_captured_at_kst: r.captured_at_kst,
      imweb_order_no: order?.order_no ?? null,
      imweb_order_time: order?.order_time ?? null,
      imweb_pay_type: order?.pay_type ?? null,
      imweb_payment_amount: order?.payment_amount ?? null,
      join_status: status,
      age_hours: r.ts_ms_kst != null ? Math.round((nowMs - r.ts_ms_kst) / 3600000) : null,
    };
  });

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    window_days: windowDays,
    enforce_flag_active: process.env[ENFORCE_ENV_FLAG] === "true",
    total_intents_in_window: intentRows.length,
    status_counts: statusCounts,
    rows,
  };
}
