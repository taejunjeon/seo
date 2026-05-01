/**
 * Coffee NPay Intent Log
 *
 * 더클린커피 NPay click 시점에 preview snippet v0.4 + v0.5 가 발급한
 * intent payload 를 backend ledger 로 받기 위한 모듈.
 *
 * 본 phase 는 **dry-run only**.
 *   - schema 는 CREATE TABLE IF NOT EXISTS 로 미리 만들어 둔다.
 *   - dry-run 응답은 payload validation + ledger row preview 만 돌려준다.
 *   - 실제 INSERT 는 enforce mode 가 별도 phase 에서 켜진 뒤에만 한다.
 *
 * 가드:
 *   - 본 모듈은 외부 API 호출 / GA4 / Meta CAPI / TikTok Events / Google Ads
 *     송출 0건이다. local SQLite write 도 enforce mode 전까지 0건.
 *   - PII 필드 (phone / email / name / address / option 원문) 는 payload
 *     자체에 있으면 ledger row 에 저장하지 않고 reject 한다.
 */

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

const TABLE = "coffee_npay_intent_log";

const PII_KEYS_BLOCKED = [
  "phone",
  "email",
  "name",
  "address",
  "addr",
  "addr_detail",
  "orderer_name",
  "orderer_call",
  "receiver_name",
  "receiver_call",
  "option_text",
] as const;

let schemaEnsured = false;

export function ensureCoffeeNpayIntentLogSchema(): void {
  if (schemaEnsured) return;
  const db = getCrmDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      intent_uuid TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'thecleancoffee',
      version TEXT NOT NULL,
      intent_phase TEXT NOT NULL,
      session_uuid TEXT,
      intent_seq INTEGER,
      ts_ms_kst INTEGER,
      ts_label_kst TEXT,
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
      ga_client_id TEXT,
      ga_session_id TEXT,
      payment_button_type TEXT,
      page_url TEXT,
      page_path TEXT,
      user_agent_class TEXT,
      is_simulation INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT NOT NULL,
      inserted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_imweb_order_code
      ON ${TABLE}(imweb_order_code) WHERE imweb_order_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_ts_ms ON ${TABLE}(ts_ms_kst);
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_session_uuid ON ${TABLE}(session_uuid);
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_prod_code_ts
      ON ${TABLE}(prod_code, ts_ms_kst);
    CREATE INDEX IF NOT EXISTS idx_${TABLE}_synthetic_tx
      ON ${TABLE}(ga4_synthetic_transaction_id) WHERE ga4_synthetic_transaction_id IS NOT NULL;
  `);
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

  if (
    typeof p.intent_phase === "string" &&
    !ALLOWED_INTENT_PHASE.has(p.intent_phase)
  ) {
    errors.push(
      `intent_phase must be one of [${[...ALLOWED_INTENT_PHASE].join(", ")}]`,
    );
  }

  if (typeof p.intent_uuid === "string" && p.intent_uuid.length > 64) {
    errors.push("intent_uuid too long (>64 chars)");
  }

  if (
    p.payment_button_type !== undefined &&
    p.payment_button_type !== "npay"
  ) {
    errors.push("payment_button_type must be 'npay' (only NPay supported in this phase)");
  }

  if (p.preview_only !== true) {
    warnings.push("preview_only != true — payload generated outside snippet?");
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

  // raw_json size sanity
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
  intent_uuid: string;
  site: string;
  version: string;
  intent_phase: string;
  session_uuid: string;
  intent_seq: number | null;
  ts_ms_kst: number | null;
  prod_code: string;
  prod_price: number | null;
  estimated_item_total: number | null;
  imweb_order_code: string | null;
  imweb_order_code_capture_delay_ms: number | null;
  ga4_synthetic_transaction_id: string | null;
  funnel_capi_session_id: string;
  payment_button_type: string;
  is_simulation: number;
};

export function buildLedgerRowPreview(
  p: CoffeeNpayIntentPayload,
): LedgerRowPreview {
  return {
    intent_uuid: String(p.intent_uuid ?? ""),
    site: String(p.site ?? ""),
    version: String(p.version ?? ""),
    intent_phase: String(p.intent_phase ?? ""),
    session_uuid: String(p.session_uuid ?? ""),
    intent_seq: typeof p.intent_seq === "number" ? p.intent_seq : null,
    ts_ms_kst: typeof p.ts_ms_kst === "number" ? p.ts_ms_kst : null,
    prod_code: String(p.prod_code ?? ""),
    prod_price: typeof p.prod_price === "number" ? p.prod_price : null,
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
    funnel_capi_session_id: String(p.funnel_capi_session_id ?? ""),
    payment_button_type: String(p.payment_button_type ?? ""),
    is_simulation: p.is_simulation === true ? 1 : 0,
  };
}

export type DryRunResponse = {
  ok: boolean;
  mode: "dry_run";
  schema_ensured: boolean;
  validation: ValidationResult;
  ledger_row_preview: LedgerRowPreview | null;
  insert_skipped_reason: string;
  notes: string[];
};

export function runDryRun(payload: CoffeeNpayIntentPayload): DryRunResponse {
  ensureCoffeeNpayIntentLogSchema();
  const validation = validateIntentPayload(payload);
  const notes: string[] = [];

  if (!validation.ok) {
    return {
      ok: false,
      mode: "dry_run",
      schema_ensured: schemaEnsured,
      validation,
      ledger_row_preview: null,
      insert_skipped_reason: "validation_failed",
      notes: ["INSERT 안 함 (dry_run + validation_failed)"],
    };
  }

  if (validation.warnings.length > 0) {
    notes.push(...validation.warnings.map((w) => `warning: ${w}`));
  }

  const preview = buildLedgerRowPreview(payload);
  notes.push("INSERT 안 함 (dry_run mode, enforce mode 는 별도 phase 에서 활성)");
  notes.push(
    `imweb_order_code 매핑 가능성: ${
      preview.imweb_order_code ? "YES (deterministic key 확보)" : "NO (다음 retry 또는 sandbox 결제 필요)"
    }`,
  );
  notes.push(
    `ga4_synthetic_transaction_id 매핑 가능성: ${
      preview.ga4_synthetic_transaction_id
        ? "YES (BigQuery transaction_id join 가능)"
        : "NO (snippet v0.6 capture 후 가능)"
    }`,
  );

  return {
    ok: true,
    mode: "dry_run",
    schema_ensured: schemaEnsured,
    validation,
    ledger_row_preview: preview,
    insert_skipped_reason: "dry_run_mode",
    notes,
  };
}

/**
 * Stats — read-only. enforce mode 가 켜진 뒤 row count 와 최근 row 미리보기를
 * 보여준다. dry-run 단계에서도 호출 가능 (단 row 0 응답).
 */
export function getCoffeeNpayIntentLogStats(): {
  ok: true;
  schema_ensured: boolean;
  total_rows: number;
  rows_with_imweb_order_code: number;
  rows_with_ga4_synthetic_transaction_id: number;
  latest_ts_ms_kst: number | null;
} {
  ensureCoffeeNpayIntentLogSchema();
  const db: Database.Database = getCrmDb();
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }).cnt;
  const withCode = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM ${TABLE} WHERE imweb_order_code IS NOT NULL`,
      )
      .get() as { cnt: number }
  ).cnt;
  const withTx = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM ${TABLE} WHERE ga4_synthetic_transaction_id IS NOT NULL`,
      )
      .get() as { cnt: number }
  ).cnt;
  const latestRow = db
    .prepare(`SELECT MAX(ts_ms_kst) AS ts FROM ${TABLE}`)
    .get() as { ts: number | null };
  return {
    ok: true,
    schema_ensured: schemaEnsured,
    total_rows: total,
    rows_with_imweb_order_code: withCode,
    rows_with_ga4_synthetic_transaction_id: withTx,
    latest_ts_ms_kst: latestRow.ts ?? null,
  };
}
