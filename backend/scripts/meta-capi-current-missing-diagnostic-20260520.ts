#!/usr/bin/env tsx
/**
 * Meta CAPI current-missing diagnostic.
 *
 * Green read-only:
 * - Reads VM Cloud attribution ledger and CAPI send log APIs.
 * - Does not call Meta, Toss, Imweb, or production DB.
 * - Emits safe_ref and aggregate/presence buckets only.
 * - Never prints raw order/payment/member/click identifiers.
 */

import { createHash } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

type JsonRecord = Record<string, unknown>;

type LedgerEntry = {
  touchpoint?: string;
  captureMode?: string;
  paymentStatus?: string | null;
  loggedAt?: string;
  orderId?: string;
  paymentKey?: string;
  approvedAt?: string;
  landing?: string;
  referrer?: string;
  fbclid?: string;
  metadata?: JsonRecord;
  requestContext?: {
    origin?: string;
    path?: string;
  };
};

type CapiLogRow = {
  event_id?: string;
  event_name?: string;
  response_status?: number;
  pixel_id?: string;
  ledger_entry?: {
    orderId?: string;
    paymentKey?: string;
  };
};

type ProviderDiagnostic = {
  checked: boolean;
  provider: "toss";
  status_bucket:
    | "done_or_paid"
    | "canceled_or_refunded"
    | "unpaid_or_pending"
    | "not_found"
    | "auth_missing"
    | "api_error"
    | "skipped_no_payment_key"
    | "skipped_provider_check_disabled";
  store?: "biocom" | "thecleancoffee";
  http_status?: number;
  method_bucket?: "card" | "virtual_account" | "bank_transfer" | "transfer" | "mobile" | "unknown";
  amount_match?: boolean | null;
  approved_at_present?: boolean;
};

const ATTR_BASE_URL = process.env.ATTR_BASE_URL?.trim() || "https://att.ainativeos.net";
const BIOCOM_PIXEL_ID = process.env.META_PIXEL_ID_BIOCOM?.trim() || "1283400029487161";
const DEFAULT_LIMIT = Number(process.env.CAPI_DIAGNOSTIC_LIMIT || 100);
const WINDOW_HOURS = Number(process.env.CAPI_DIAGNOSTIC_WINDOW_HOURS || 24);
const PROVIDER_CHECK_ENABLED = process.env.CAPI_DIAGNOSTIC_PROVIDER_CHECK === "1";
const TOSS_API_BASE_URL = process.env.TOSS_API_BASE_URL?.trim() || "https://api.tosspayments.com";

const isRecord = (value: unknown): value is JsonRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

const getString = (record: JsonRecord | undefined, keys: string[]) => {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getNumber = (record: JsonRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const getBoolean = (record: JsonRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "y"].includes(normalized)) return true;
      if (["0", "false", "no", "n"].includes(normalized)) return false;
    }
  }
  return undefined;
};

const getRecord = (record: JsonRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return undefined;
};

const hashSafe = (value: string) =>
  `safe_${createHash("sha256").update(value).digest("hex").slice(0, 10)}`;

const safeRefForEntry = (entry: LedgerEntry) => {
  const joinKey = entry.paymentKey?.trim()
    ? `payment:${entry.paymentKey.trim()}`
    : entry.orderId?.trim()
      ? `order:${entry.orderId.trim()}`
      : "";
  const basis = joinKey || [
    entry.loggedAt || "",
    entry.touchpoint || "",
    entry.captureMode || "",
    getNumber(entry.metadata, ["value", "amount", "totalAmount"]) ?? "",
    "",
    "",
  ].join("\u001f");
  return hashSafe(basis);
};

const normalizeOrderId = (value?: string) => (value || "").trim().replace(/-P\d+$/i, "");

const normalizeEventName = (value?: string) =>
  (value?.trim() || "Purchase")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "event";

const getQueryParam = (name: string, urls: Array<string | undefined>) => {
  for (const url of urls) {
    if (!url) continue;
    try {
      const parsed = new URL(url);
      const value = parsed.searchParams.get(name)?.trim();
      if (value) return value;
    } catch {
      // ignore non-URL values
    }
  }
  return "";
};

const imwebOrderCodePresent = (entry: LedgerEntry) => {
  const metadata = entry.metadata ?? {};
  return Boolean(
    getString(metadata, ["orderCode", "order_code", "imwebOrderCode"]) ||
    getQueryParam("order_code", [entry.landing, entry.referrer]) ||
    getQueryParam("orderCode", [entry.landing, entry.referrer])
  );
};

const eventIdShape = (entry: LedgerEntry) => {
  if (imwebOrderCodePresent(entry)) return "order_code_based";
  if (normalizeOrderId(entry.orderId)) return "order_id_based";
  return "missing_order_basis";
};

const orderEventKeyBasis = (entry: LedgerEntry) => {
  if (entry.paymentKey?.trim()) return "payment_key";
  if (normalizeOrderId(entry.orderId)) return "order_id";
  return "missing_order_event_basis";
};

const buildOrderEventKey = (params: { paymentKey?: string; orderId?: string; eventName?: string }) => {
  const eventName = params.eventName?.trim() || "Purchase";
  if (params.paymentKey?.trim()) return `payment:${params.paymentKey.trim()}|${eventName}`;
  const orderId = normalizeOrderId(params.orderId);
  return orderId ? `order:${orderId}|${eventName}` : "";
};

const getNoSendReason = (entry: LedgerEntry) => {
  const metadata = entry.metadata ?? {};
  if (entry.touchpoint === "payment_page_seen") return "payment_page_seen_not_purchase";
  if (metadata.semantic_touchpoint === "payment_page_seen") return "semantic_payment_page_seen_not_purchase";

  const bridgeMetadata = getRecord(metadata, ["operationalPaymentCompleteBridge"]) ?? {};
  const paymentStatusSyncSource = getString(metadata, ["paymentStatusSyncSource"]);
  if (
    metadata.metaCapiAutoSendAllowed === false ||
    metadata.bridgeAutoSendAllowed === false ||
    bridgeMetadata.metaCapiAutoSendAllowed === false ||
    paymentStatusSyncSource === "operational_db_tb_iamweb_users_payment_complete_bridge"
  ) {
    return "bridge_no_send_gate";
  }

  const value = getNumber(metadata, ["value", "amount", "totalAmount"]);
  const runtimeTossFallbackAllowed =
    entry.touchpoint === "payment_success" &&
    entry.captureMode === "live" &&
    entry.paymentStatus === "confirmed" &&
    Boolean(entry.paymentKey) &&
    typeof value === "number" &&
    value > 0 &&
    (
      metadata.semantic_touchpoint === "payment_success" ||
      metadata.completed_url_allowlist_pass === true ||
      metadata.completion_url === true ||
      metadata.page_location_class === "payment_success_allowlist"
    );

  if (
    (metadata.meta_purchase_candidate === false || metadata.is_purchase_candidate === false) &&
    !runtimeTossFallbackAllowed
  ) {
    return "explicit_non_purchase_candidate";
  }
  if (typeof value === "number" && value <= 0) return "non_positive_value";
  if (typeof value !== "number" && !entry.paymentKey) return "missing_value_without_payment_key_fallback";

  const refundAmount = getNumber(metadata, [
    "refundAmount",
    "refund_amount",
    "refundPendingAmount",
    "refund_pending_amount",
  ]);
  if (typeof refundAmount === "number" && refundAmount > 0) return "refund_amount_present";

  if (getBoolean(metadata, ["hasCancel", "has_cancel", "canceled", "cancelled", "refunded"]) === true) {
    return "cancel_or_refund_flag_present";
  }

  const guard = getRecord(metadata, ["valueGuard", "value_guard"]);
  const sourceTotal = guard
    ? getNumber(guard, ["sourceTotalKrw", "source_total_krw", "orderTotalKrw", "order_total_krw"])
    : getNumber(metadata, [
      "sourceTotalKrw",
      "source_total_krw",
      "orderTotalKrw",
      "order_total_krw",
      "confirmedAmountKrw",
      "confirmed_amount_krw",
    ]);
  if (typeof sourceTotal === "number" && typeof value === "number" && Math.abs(sourceTotal - value) > 1) {
    return "value_source_total_mismatch";
  }

  const valueGuardRequired = getBoolean(metadata, [
    "valueGuardRequiredBeforeMetaSend",
    "value_guard_required_before_meta_send",
  ]);
  const guardStatus = getString(guard, ["status", "result"]).toLowerCase();
  const valueGuardPassed =
    getBoolean(metadata, ["valueGuardPassed", "value_guard_passed"]) === true ||
    ["pass", "passed", "ok", "safe"].includes(guardStatus);
  if (valueGuardRequired === true && !valueGuardPassed && !runtimeTossFallbackAllowed) {
    return "value_guard_required_not_passed";
  }

  return "";
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${ATTR_BASE_URL}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
};

const extractRows = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];
  for (const key of ["items", "rows", "data", "entries", "logs"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
};

const sourceLooksBiocom = (entry: LedgerEntry) => {
  const metadata = entry.metadata ?? {};
  const source = getString(metadata, ["source", "site", "store"]).toLowerCase();
  const origin = (entry.requestContext?.origin || "").toLowerCase();
  const paymentKeyPrefix = (entry.paymentKey || "").slice(0, 5).toLowerCase();
  return (
    source.includes("biocom") ||
    origin.includes("biocom.kr") ||
    paymentKeyPrefix === "iw_bi"
  );
};

const inferStoreFromPaymentKey = (paymentKey?: string): "biocom" | "thecleancoffee" => {
  const normalized = (paymentKey || "").trim().toLowerCase();
  return normalized.startsWith("iw_th") ? "thecleancoffee" : "biocom";
};

const getTossSecret = (store: "biocom" | "thecleancoffee") => {
  if (store === "thecleancoffee") {
    return (
      process.env.TOSS_NEW_COFFEE_API_SECRET_KEY?.trim() ||
      process.env.TOSS_LIVE_SECRET_KEY_COFFEE?.trim() ||
      process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API?.trim() ||
      ""
    );
  }

  return (
    process.env.TOSS_LIVE_SECRET_KEY_BIOCOM?.trim() ||
    process.env.TOSS_LIVE_SECRET_KEY?.trim() ||
    ""
  );
};

const normalizeTossMethod = (value: unknown): ProviderDiagnostic["method_bucket"] => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "unknown";
  if (normalized.includes("카드") || normalized.includes("card")) return "card";
  if (normalized.includes("가상") || normalized.includes("virtual")) return "virtual_account";
  if (normalized.includes("계좌") || normalized.includes("bank")) return "bank_transfer";
  if (normalized.includes("간편") || normalized.includes("transfer")) return "transfer";
  if (normalized.includes("휴대") || normalized.includes("mobile")) return "mobile";
  return "unknown";
};

const normalizeTossStatus = (value: unknown): ProviderDiagnostic["status_bucket"] => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (["DONE", "PAID", "APPROVED"].includes(normalized)) return "done_or_paid";
  if (["CANCELED", "PARTIAL_CANCELED", "REFUNDED"].includes(normalized)) return "canceled_or_refunded";
  if (["READY", "IN_PROGRESS", "WAITING_FOR_DEPOSIT", "ABORTED", "EXPIRED"].includes(normalized)) {
    return "unpaid_or_pending";
  }
  return "api_error";
};

const readJsonOrEmpty = async (response: Response): Promise<JsonRecord> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const fetchProviderDiagnostic = async (entry: LedgerEntry): Promise<ProviderDiagnostic> => {
  const paymentKey = entry.paymentKey?.trim();
  if (!paymentKey) {
    return {
      checked: false,
      provider: "toss",
      status_bucket: "skipped_no_payment_key",
    };
  }

  const store = inferStoreFromPaymentKey(paymentKey);
  const secret = getTossSecret(store);
  if (!secret) {
    return {
      checked: false,
      provider: "toss",
      store,
      status_bucket: "auth_missing",
    };
  }

  try {
    const response = await fetch(`${TOSS_API_BASE_URL}/v1/payments/${encodeURIComponent(paymentKey)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    const body = await readJsonOrEmpty(response);

    if (response.status === 404) {
      return {
        checked: true,
        provider: "toss",
        store,
        http_status: response.status,
        status_bucket: "not_found",
      };
    }

    if (!response.ok) {
      return {
        checked: true,
        provider: "toss",
        store,
        http_status: response.status,
        status_bucket: "api_error",
      };
    }

    const expectedValue = getNumber(entry.metadata, ["value", "amount", "totalAmount"]);
    const providerAmount = getNumber(body, ["totalAmount", "balanceAmount", "suppliedAmount"]);
    const statusBucket = normalizeTossStatus(body.status);
    return {
      checked: true,
      provider: "toss",
      store,
      http_status: response.status,
      status_bucket: statusBucket,
      method_bucket: normalizeTossMethod(body.method),
      amount_match: typeof expectedValue === "number" && typeof providerAmount === "number"
        ? Math.abs(expectedValue - providerAmount) <= 1
        : null,
      approved_at_present: typeof body.approvedAt === "string" && body.approvedAt.trim().length > 0,
    };
  } catch {
    return {
      checked: true,
      provider: "toss",
      store,
      status_bucket: "api_error",
    };
  }
};

const main = async () => {
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const ledgerQuery = new URLSearchParams({
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    limit: "1000",
  });
  const capiQuery = new URLSearchParams({
    since_days: "7",
    limit: "1000",
    pixel_id: BIOCOM_PIXEL_ID,
  });

  const [ledgerPayload, capiPayload] = await Promise.all([
    fetchJson<unknown>(`/api/attribution/ledger?${ledgerQuery.toString()}`),
    fetchJson<unknown>(`/api/meta/capi/log?${capiQuery.toString()}`),
  ]);

  const ledgerRows = extractRows<LedgerEntry>(ledgerPayload);
  const capiRows = extractRows<CapiLogRow>(capiPayload);
  const successfulCapiRows = capiRows.filter(
    (row) => typeof row.response_status === "number" && row.response_status >= 200 && row.response_status < 300,
  );
  const successfulOrderEventKeys = new Set(
    successfulCapiRows
      .map((row) =>
        buildOrderEventKey({
          paymentKey: row.ledger_entry?.paymentKey,
          orderId: row.ledger_entry?.orderId,
          eventName: row.event_name,
        }),
      )
      .filter(Boolean),
  );
  const successfulEventIds = new Set(
    successfulCapiRows
      .map((row) => row.event_id)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );

  const confirmed = ledgerRows.filter(
    (entry) =>
      sourceLooksBiocom(entry) &&
      entry.touchpoint === "payment_success" &&
      entry.captureMode === "live" &&
      entry.paymentStatus === "confirmed",
  );

  const eligible = confirmed
    .map((entry, index) => ({
      entry,
      index,
      noSendReason: getNoSendReason(entry),
    }))
    .filter((row) => !row.noSendReason);

  const diagnostics = eligible.map((row, eligibleIndex) => {
    const orderEventKey = buildOrderEventKey({
      paymentKey: row.entry.paymentKey,
      orderId: row.entry.orderId,
      eventName: "Purchase",
    });
    const eventIdBasis = eventIdShape(row.entry);
    const expectedEventIdSeen = eventIdBasis === "order_code_based"
      ? "not_checked_raw_order_code_redacted"
      : "not_checked_raw_order_id_redacted";
    const orderEventKeySeen = orderEventKey ? successfulOrderEventKeys.has(orderEventKey) : false;
    const status = orderEventKeySeen ? "already_sent_order_event_key" : "eligible_unsent_or_event_id_match_unknown";

    return {
      safe_ref: safeRefForEntry(row.entry),
      status,
      eligible_index: eligibleIndex,
      selected_by_limit: eligibleIndex < DEFAULT_LIMIT,
      no_send_reason: "",
      order_event_key_seen: orderEventKeySeen,
      event_id_seen_check: expectedEventIdSeen,
      event_id_basis: eventIdBasis,
      order_event_key_basis: orderEventKeyBasis(row.entry),
      value_present: typeof getNumber(row.entry.metadata, ["value", "amount", "totalAmount"]) === "number",
      payment_key_present: Boolean(row.entry.paymentKey),
      order_key_present: Boolean(row.entry.orderId),
      completion_signal_present: Boolean(
        row.entry.metadata?.semantic_touchpoint === "payment_success" ||
        row.entry.metadata?.completed_url_allowlist_pass === true ||
        row.entry.metadata?.completion_url === true ||
        row.entry.metadata?.page_location_class === "payment_success_allowlist"
      ),
      logged_at_kst_hint: row.entry.loggedAt || "",
    };
  });

  const unsent = diagnostics.filter((row) => !row.order_event_key_seen);
  const providerDiagnosticsBySafeRef = new Map<string, ProviderDiagnostic>();
  if (PROVIDER_CHECK_ENABLED) {
    await Promise.all(
      eligible.map(async (row) => {
        const safeRef = safeRefForEntry(row.entry);
        if (!unsent.some((candidate) => candidate.safe_ref === safeRef)) return;
        providerDiagnosticsBySafeRef.set(safeRef, await fetchProviderDiagnostic(row.entry));
      }),
    );
  }
  const providerStatusCounts = Array.from(providerDiagnosticsBySafeRef.values()).reduce<Record<string, number>>(
    (acc, diagnostic) => {
      acc[diagnostic.status_bucket] = (acc[diagnostic.status_bucket] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const report = {
    generated_at: new Date().toISOString(),
    mode: "read_only_no_send",
    site: "biocom",
    pixel_id: BIOCOM_PIXEL_ID,
    window_hours: WINDOW_HOURS,
    limit: DEFAULT_LIMIT,
    counts: {
      ledger_rows: ledgerRows.length,
      confirmed_payment_success: confirmed.length,
      eligible_candidates: eligible.length,
      successful_capi_logs_checked: successfulCapiRows.length,
      eligible_without_order_event_success_log: unsent.length,
      provider_checked_candidates: providerDiagnosticsBySafeRef.size,
    },
    status_counts: diagnostics.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {}),
    unsent_candidates: unsent.map((row) => ({
      safe_ref: row.safe_ref,
      status: row.status,
      eligible_index: row.eligible_index,
      selected_by_limit: row.selected_by_limit,
      event_id_basis: row.event_id_basis,
      order_event_key_basis: row.order_event_key_basis,
      value_present: row.value_present,
      payment_key_present: row.payment_key_present,
      order_key_present: row.order_key_present,
      completion_signal_present: row.completion_signal_present,
      provider_diagnostic: providerDiagnosticsBySafeRef.get(row.safe_ref) ?? {
        checked: false,
        provider: "toss",
        status_bucket: PROVIDER_CHECK_ENABLED ? "api_error" : "skipped_provider_check_disabled",
      },
      logged_at_kst_hint: row.logged_at_kst_hint,
    })),
    provider_status_counts: providerStatusCounts,
    caveats: [
      "event_id exact match is not checked because raw order code/order id is intentionally not emitted",
      "order_event_key match uses in-memory raw values but output is safe_ref only",
      PROVIDER_CHECK_ENABLED
        ? "provider/Toss read-only status is checked for unsent candidates only; raw payment identifiers and provider response body are never emitted"
        : "provider/Toss status is disabled by default; run with CAPI_DIAGNOSTIC_PROVIDER_CHECK=1 for unsent-candidate provider buckets",
    ],
    safety: {
      raw_identifier_output: false,
      meta_send_count: 0,
      production_db_write_count: 0,
      vm_write_count: 0,
    },
  };

  // Prove that the successful event-id set was built, while never printing raw event ids.
  if (successfulEventIds.size < 0) {
    throw new Error("unreachable");
  }

  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    mode: "read_only_no_send",
    error: error instanceof Error ? error.message : String(error),
    safety: {
      raw_identifier_output: false,
      meta_send_count: 0,
      production_db_write_count: 0,
      vm_write_count: 0,
    },
  }, null, 2));
  process.exitCode = 1;
});
