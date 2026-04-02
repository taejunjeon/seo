import crypto from "node:crypto";

import { env } from "./env";

export type ChannelTalkConfigInput = {
  pluginKey?: string;
  accessKey?: string;
  accessSecret?: string;
  memberHashSecret?: string;
  marketingEnabled?: boolean;
  accessKeyAliasUsed?: boolean;
};

type ChannelTalkProbeSuccess = {
  ok: true;
  status: number;
  channelId: string | null;
  channelName: string | null;
  defaultPluginId: string | null;
  memberHashEnabledOnChannel: boolean | null;
};

type ChannelTalkProbeFailure = {
  ok: false;
  reason: "missing_credentials" | "api_error" | "network_error";
  status?: number;
  missing?: string[];
  message?: string;
};

export type ChannelTalkProbeResult = ChannelTalkProbeSuccess | ChannelTalkProbeFailure;

const buildDefaultConfig = (): ChannelTalkConfigInput => ({
  pluginKey: env.CHANNELTALK_PLUGIN_KEY,
  accessKey: env.CHANNELTALK_ACCESS_KEY,
  accessSecret: env.CHANNELTALK_ACCESS_SECRET,
  memberHashSecret: env.CHANNELTALK_MEMBER_HASH_SECRET,
  marketingEnabled: env.CHANNELTALK_MARKETING_ENABLED,
  accessKeyAliasUsed: !!process.env.CHANNELTALK_ACCESSKEY && !process.env.CHANNELTALK_ACCESS_KEY,
});

const trimOrEmpty = (value?: string): string => value?.trim() ?? "";

export const normalizeChannelTalkConfig = (input: ChannelTalkConfigInput = buildDefaultConfig()) => ({
  pluginKey: trimOrEmpty(input.pluginKey),
  accessKey: trimOrEmpty(input.accessKey),
  accessSecret: trimOrEmpty(input.accessSecret),
  memberHashSecret: trimOrEmpty(input.memberHashSecret),
  marketingEnabled: Boolean(input.marketingEnabled),
  accessKeyAliasUsed: Boolean(input.accessKeyAliasUsed),
});

export const getChannelTalkConfigStatus = (input?: ChannelTalkConfigInput) => {
  const config = normalizeChannelTalkConfig(input);
  const missingForSdk = [];
  const missingForOpenApi = [];

  if (!config.pluginKey) missingForSdk.push("CHANNELTALK_PLUGIN_KEY");
  if (!config.accessKey) missingForOpenApi.push("CHANNELTALK_ACCESS_KEY");
  if (!config.accessSecret) missingForOpenApi.push("CHANNELTALK_ACCESS_SECRET");

  return {
    pluginKeyConfigured: Boolean(config.pluginKey),
    accessKeyConfigured: Boolean(config.accessKey),
    accessSecretConfigured: Boolean(config.accessSecret),
    memberHashConfigured: Boolean(config.memberHashSecret),
    marketingEnabled: config.marketingEnabled,
    accessKeyAliasUsed: config.accessKeyAliasUsed,
    missingForSdk,
    missingForOpenApi,
  };
};

export const buildMemberHash = (memberId: string, input?: ChannelTalkConfigInput): string | null => {
  const config = normalizeChannelTalkConfig(input);
  const normalizedMemberId = memberId.trim();
  if (!normalizedMemberId || !config.memberHashSecret) {
    return null;
  }

  return crypto.createHmac("sha256", config.memberHashSecret).update(normalizedMemberId).digest("hex");
};

const extractChannelSummary = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return {
      channelId: null,
      channelName: null,
      defaultPluginId: null,
      memberHashEnabledOnChannel: null,
    };
  }

  const root = payload as Record<string, unknown>;
  const record =
    root.channel && typeof root.channel === "object" ? (root.channel as Record<string, unknown>) : root;
  const channelId =
    typeof record.id === "string"
      ? record.id
      : typeof record.channelId === "string"
        ? record.channelId
        : null;
  const channelName =
    typeof record.name === "string"
      ? record.name
      : typeof record.channelName === "string"
        ? record.channelName
        : null;
  const defaultPluginId = typeof record.defaultPluginId === "string" ? record.defaultPluginId : null;
  const memberHashEnabledOnChannel =
    typeof record.enableMemberHash === "boolean" ? record.enableMemberHash : null;

  return { channelId, channelName, defaultPluginId, memberHashEnabledOnChannel };
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

export const verifyChannelTalkAccess = async (
  input?: ChannelTalkConfigInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ChannelTalkProbeResult> => {
  const config = normalizeChannelTalkConfig(input);
  const missing = [];

  if (!config.accessKey) missing.push("CHANNELTALK_ACCESS_KEY");
  if (!config.accessSecret) missing.push("CHANNELTALK_ACCESS_SECRET");

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "missing_credentials",
      missing,
      message: "ChannelTalk Open API requires access key and access secret.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchImpl("https://api.channel.io/open/v5/channel", {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-access-key": config.accessKey,
        "x-access-secret": config.accessSecret,
      },
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: "api_error",
        status: response.status,
        message: extractErrorMessage(payload, `ChannelTalk API request failed with ${response.status}`),
      };
    }

    return {
      ok: true,
      status: response.status,
      ...extractChannelSummary(payload),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: error instanceof Error ? error.message : "Unknown ChannelTalk network error",
    };
  } finally {
    clearTimeout(timeout);
  }
};
