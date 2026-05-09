import { createHmac, createHash } from "node:crypto";

export const ORDER_BRIDGE_IDENTITY_HASH_VERSION = "hmac_sha256_identity_v1";

export type OrderBridgeIdentitySource = "email" | "phone" | "both" | "none";
export type OrderBridgeLedgerStatus =
  | "full_bridge"
  | "identity_only_quarantine"
  | "session_only_quarantine"
  | "click_missing_hold"
  | "ambiguous"
  | "do_not_send";

export class OrderBridgeIdentityHmacConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderBridgeIdentityHmacConfigError";
  }
}

type OrderBridgeIdentityInput = Record<string, unknown>;

export type OrderBridgeIdentityHmacPreview = {
  ok: true;
  would_store: boolean;
  would_send: false;
  email_hash_present: boolean;
  phone_hash_present: boolean;
  order_no_hash_present: boolean;
  client_session_present: boolean;
  click_id_hash_present: boolean;
  no_raw_echo_verified: true;
  no_platform_send_verified: true;
  platform_send_count: 0;
  raw_payload_stored: false;
  raw_logging_enabled: false;
  row_status: OrderBridgeLedgerStatus;
  hash_version: typeof ORDER_BRIDGE_IDENTITY_HASH_VERSION;
  identity_source: OrderBridgeIdentitySource;
  normalized_presence: {
    email: boolean;
    phone: boolean;
    order_no: boolean;
    client_id: boolean;
    ga_session_id: boolean;
    local_session_id: boolean;
    click_id: boolean;
  };
  hash_prefixes: {
    email_hash_prefix: string;
    phone_hash_prefix: string;
    order_no_hash_prefix: string;
    local_session_id_hash_prefix: string;
    click_id_hash_prefix: string;
  };
  safe_debug: {
    site: string;
    capture_stage: string;
    received_at: string;
    input_keys: string[];
  };
};

export type OrderBridgeIdentityHmacMaterial = {
  preview: OrderBridgeIdentityHmacPreview;
  site: string;
  captureStage: string;
  receivedAt: string;
  hashes: {
    email_hash: string;
    phone_hash: string;
    order_no_hash: string;
    local_session_id_hash: string;
    click_id_hash: string;
  };
  passthrough: {
    client_id: string;
    ga_session_id: string;
    identity_source: OrderBridgeIdentitySource;
    pay_type: string;
    pg_type: string;
  };
};

const textField = (input: OrderBridgeIdentityInput, ...keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
};

export const normalizeOrderBridgeEmail = (raw: unknown) => {
  if (typeof raw !== "string") return "";
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return "";
  return normalized;
};

export const normalizeOrderBridgePhone = (raw: unknown) => {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
};

export const hmacSha256Hex = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const requireSecret = (secret: string) => {
  if (!secret || secret.trim().length < 16) {
    throw new OrderBridgeIdentityHmacConfigError("ORDER_BRIDGE_IDENTITY_HASH_SECRET is missing or too short");
  }
  return secret;
};

const prefix = (value: string) => (value ? value.slice(0, 8) : "");

const identitySource = (emailHash: string, phoneHash: string): OrderBridgeIdentitySource => {
  if (emailHash && phoneHash) return "both";
  if (emailHash) return "email";
  if (phoneHash) return "phone";
  return "none";
};

export const classifyOrderBridgeLedgerStatus = (input: {
  orderNoHash?: string;
  emailHash?: string;
  phoneHash?: string;
  clientId?: string;
  gaSessionId?: string;
  localSessionIdHash?: string;
  clickIdHash?: string;
}): OrderBridgeLedgerStatus => {
  const hasOrder = Boolean(input.orderNoHash);
  const hasIdentity = Boolean(input.emailHash || input.phoneHash);
  const hasSession = Boolean(input.clientId || input.gaSessionId || input.localSessionIdHash);
  const hasClick = Boolean(input.clickIdHash);

  if (!hasOrder) return "do_not_send";
  if (hasIdentity && hasSession && hasClick) return "full_bridge";
  if (hasIdentity && hasSession && !hasClick) return "identity_only_quarantine";
  if (!hasIdentity && hasSession) return "session_only_quarantine";
  if (!hasClick) return "click_missing_hold";
  return "do_not_send";
};

export const buildOrderBridgeIdentityHmacMaterial = (
  input: OrderBridgeIdentityInput,
  options: { secret: string; receivedAt?: string },
): OrderBridgeIdentityHmacMaterial => {
  const secret = requireSecret(options.secret);
  const receivedAt = options.receivedAt ?? new Date().toISOString();

  const site = textField(input, "site") || "biocom";
  const captureStage = textField(input, "capture_stage", "captureStage") || "order_confirm_preview";
  const emailNormalized = normalizeOrderBridgeEmail(textField(input, "email", "ordererEmail", "email_buy", "buyerEmail"));
  const phoneNormalized = normalizeOrderBridgePhone(textField(input, "phone", "ordererCall", "phone_buy", "buyerPhone"));
  const orderNo = textField(input, "order_no", "orderNo", "order_number", "orderNumber");
  const clientId = textField(input, "client_id", "clientId");
  const gaSessionId = textField(input, "ga_session_id", "gaSessionId");
  const localSessionId = textField(input, "local_session_id", "localSessionId");
  const clickId = textField(input, "click_id", "clickId", "gclid", "gbraid", "wbraid", "ttclid", "nclick_id");
  const payType = textField(input, "pay_type", "payType");
  const pgType = textField(input, "pg_type", "pgType");

  const emailHash = emailNormalized ? hmacSha256Hex(emailNormalized, secret) : "";
  const phoneHash = phoneNormalized ? hmacSha256Hex(phoneNormalized, secret) : "";
  const orderNoHash = orderNo ? hmacSha256Hex(orderNo, secret) : "";
  const localSessionIdHash = localSessionId ? sha256Hex(localSessionId) : "";
  const clickIdHash = clickId ? sha256Hex(clickId) : "";
  const source = identitySource(emailHash, phoneHash);
  const rowStatus = classifyOrderBridgeLedgerStatus({
    orderNoHash,
    emailHash,
    phoneHash,
    clientId,
    gaSessionId,
    localSessionIdHash,
    clickIdHash,
  });

  const preview: OrderBridgeIdentityHmacPreview = {
    ok: true,
    would_store: false,
    would_send: false,
    email_hash_present: Boolean(emailHash),
    phone_hash_present: Boolean(phoneHash),
    order_no_hash_present: Boolean(orderNoHash),
    client_session_present: Boolean(clientId || gaSessionId || localSessionIdHash),
    click_id_hash_present: Boolean(clickIdHash),
    no_raw_echo_verified: true,
    no_platform_send_verified: true,
    platform_send_count: 0,
    raw_payload_stored: false,
    raw_logging_enabled: false,
    row_status: rowStatus,
    hash_version: ORDER_BRIDGE_IDENTITY_HASH_VERSION,
    identity_source: source,
    normalized_presence: {
      email: Boolean(emailNormalized),
      phone: Boolean(phoneNormalized),
      order_no: Boolean(orderNoHash),
      client_id: Boolean(clientId),
      ga_session_id: Boolean(gaSessionId),
      local_session_id: Boolean(localSessionIdHash),
      click_id: Boolean(clickIdHash),
    },
    hash_prefixes: {
      email_hash_prefix: prefix(emailHash),
      phone_hash_prefix: prefix(phoneHash),
      order_no_hash_prefix: prefix(orderNoHash),
      local_session_id_hash_prefix: prefix(localSessionIdHash),
      click_id_hash_prefix: prefix(clickIdHash),
    },
    safe_debug: {
      site,
      capture_stage: captureStage,
      received_at: receivedAt,
      input_keys: Object.keys(input).sort(),
    },
  };

  return {
    preview,
    site,
    captureStage,
    receivedAt,
    hashes: {
      email_hash: emailHash,
      phone_hash: phoneHash,
      order_no_hash: orderNoHash,
      local_session_id_hash: localSessionIdHash,
      click_id_hash: clickIdHash,
    },
    passthrough: {
      client_id: clientId,
      ga_session_id: gaSessionId,
      identity_source: source,
      pay_type: payType,
      pg_type: pgType,
    },
  };
};

export const buildOrderBridgeIdentityHmacPreview = (
  input: OrderBridgeIdentityInput,
  options: { secret: string; receivedAt?: string },
): OrderBridgeIdentityHmacPreview => buildOrderBridgeIdentityHmacMaterial(input, options).preview;

export const buildOrderBridgeIdentityHmacLogRecord = (preview: OrderBridgeIdentityHmacPreview) => ({
  receiver: "order_bridge_identity_hmac_no_send",
  would_store: preview.would_store,
  would_send: preview.would_send,
  email_hash_present: preview.email_hash_present,
  phone_hash_present: preview.phone_hash_present,
  order_no_hash_present: preview.order_no_hash_present,
  client_session_present: preview.client_session_present,
  click_id_hash_present: preview.click_id_hash_present,
  row_status: preview.row_status,
  no_platform_send_verified: preview.no_platform_send_verified,
  platform_send_count: preview.platform_send_count,
  hash_version: preview.hash_version,
  identity_source: preview.identity_source,
  hash_prefixes: preview.hash_prefixes,
  safe_debug: preview.safe_debug,
});
