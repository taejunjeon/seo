export type MetaApiErrorDetail = {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_data?: unknown;
  fbtrace_id?: string;
  type?: string;
};

export type MetaAccountCircuitBreakerState = {
  accountId: string;
  openedAtMs: number;
  blockedUntilMs: number;
  lastRateLimitAtMs: number;
  consecutiveRateLimitCount: number;
  hitCount: number;
  lastError: string;
  errorCode?: number;
  errorSubcode?: number;
};

export type MetaAccountCircuitBreakerSnapshot = {
  account_id: string;
  opened_at_kst: string;
  blocked_until_kst: string;
  retry_after_ms: number;
  retry_after_seconds: number;
  consecutive_rate_limit_count: number;
  hit_count: number;
  last_error: string;
  error_code?: number;
  error_subcode?: number;
};

export type MetaAccountCircuitBreakerErrorFields = {
  error: string;
  errorDetail?: MetaApiErrorDetail;
  rateLimited: true;
  blockedByCircuitBreaker?: boolean;
  retryAfterMs: number;
  circuitBreaker: MetaAccountCircuitBreakerSnapshot;
};

const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
const META_ACCOUNT_RATE_LIMIT_BREAKER_MS = 5 * 60 * 1000;
const META_ACCOUNT_RATE_LIMIT_BREAKER_MAX_MS = 15 * 60 * 1000;
const META_ACCOUNT_RATE_LIMIT_BREAKER_REPEAT_WINDOW_MS = 30 * 60 * 1000;
const metaAccountCircuitBreakers = new Map<string, MetaAccountCircuitBreakerState>();

const parsePositiveMsEnv = (key: string, fallback: number, min: number = 0) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const toKstMinute = (ms: number): string => {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

const getMetaAccountCircuitBreakerConfig = () => {
  const openMs = parsePositiveMsEnv(
    "META_ACCOUNT_RATE_LIMIT_BREAKER_MS",
    META_ACCOUNT_RATE_LIMIT_BREAKER_MS,
    30_000,
  );
  const maxOpenMs = parsePositiveMsEnv(
    "META_ACCOUNT_RATE_LIMIT_BREAKER_MAX_MS",
    META_ACCOUNT_RATE_LIMIT_BREAKER_MAX_MS,
    openMs,
  );
  return {
    enabled: process.env.META_ACCOUNT_RATE_LIMIT_BREAKER_ENABLED !== "0",
    openMs,
    maxOpenMs: Math.max(openMs, maxOpenMs),
    repeatWindowMs: parsePositiveMsEnv(
      "META_ACCOUNT_RATE_LIMIT_BREAKER_REPEAT_WINDOW_MS",
      META_ACCOUNT_RATE_LIMIT_BREAKER_REPEAT_WINDOW_MS,
      openMs,
    ),
  };
};

export const normalizeMetaApiError = (error: unknown): MetaApiErrorDetail => {
  if (!error || typeof error !== "object") return { message: "Meta API error" };
  const raw = error as Record<string, unknown>;
  return {
    message: typeof raw.message === "string" ? raw.message : "Meta API error",
    code: typeof raw.code === "number" ? raw.code : undefined,
    error_subcode: typeof raw.error_subcode === "number" ? raw.error_subcode : undefined,
    error_data: raw.error_data,
    fbtrace_id: typeof raw.fbtrace_id === "string" ? raw.fbtrace_id : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
  };
};

export const isMetaRateLimitError = (detail: MetaApiErrorDetail, httpStatus: number): boolean => (
  httpStatus === 429
  || (typeof detail.code === "number" && META_RATE_LIMIT_CODES.has(detail.code))
);

export const toMetaAccountCircuitBreakerSnapshot = (
  state: MetaAccountCircuitBreakerState,
): MetaAccountCircuitBreakerSnapshot => {
  const retryAfterMs = Math.max(0, state.blockedUntilMs - Date.now());
  return {
    account_id: state.accountId,
    opened_at_kst: toKstMinute(state.openedAtMs),
    blocked_until_kst: toKstMinute(state.blockedUntilMs),
    retry_after_ms: retryAfterMs,
    retry_after_seconds: Math.ceil(retryAfterMs / 1000),
    consecutive_rate_limit_count: state.consecutiveRateLimitCount,
    hit_count: state.hitCount,
    last_error: state.lastError,
    error_code: state.errorCode,
    error_subcode: state.errorSubcode,
  };
};

export const getOpenMetaAccountCircuitBreaker = (
  accountId: string | undefined,
): MetaAccountCircuitBreakerState | null => {
  if (!accountId || !getMetaAccountCircuitBreakerConfig().enabled) return null;
  const state = metaAccountCircuitBreakers.get(accountId);
  if (!state) return null;
  if (Date.now() >= state.blockedUntilMs) {
    metaAccountCircuitBreakers.delete(accountId);
    return null;
  }
  return state;
};

export const openMetaAccountCircuitBreaker = (
  accountId: string | undefined,
  detail: MetaApiErrorDetail,
): MetaAccountCircuitBreakerSnapshot | null => {
  const config = getMetaAccountCircuitBreakerConfig();
  if (!accountId || !config.enabled) return null;
  const now = Date.now();
  const existing = metaAccountCircuitBreakers.get(accountId);
  const repeated = Boolean(existing && now - existing.lastRateLimitAtMs <= config.repeatWindowMs);
  const consecutiveRateLimitCount = repeated ? existing!.consecutiveRateLimitCount + 1 : 1;
  const openMs = Math.min(
    config.maxOpenMs,
    config.openMs * (2 ** Math.max(0, consecutiveRateLimitCount - 1)),
  );
  const nextState: MetaAccountCircuitBreakerState = {
    accountId,
    openedAtMs: now,
    blockedUntilMs: Math.max(existing?.blockedUntilMs ?? 0, now + openMs),
    lastRateLimitAtMs: now,
    consecutiveRateLimitCount,
    hitCount: (existing?.hitCount ?? 0) + 1,
    lastError: detail.message ?? "Meta API rate limit",
    errorCode: detail.code,
    errorSubcode: detail.error_subcode,
  };
  metaAccountCircuitBreakers.set(accountId, nextState);
  const snapshot = toMetaAccountCircuitBreakerSnapshot(nextState);
  console.warn(
    `[meta] Account circuit breaker opened account=${accountId} retry_after=${snapshot.retry_after_seconds}s code=${detail.code ?? "n/a"} subcode=${detail.error_subcode ?? "n/a"}`,
  );
  return snapshot;
};

export const buildMetaAccountCircuitBreakerErrorFields = (
  state: MetaAccountCircuitBreakerState,
): MetaAccountCircuitBreakerErrorFields => {
  const snapshot = toMetaAccountCircuitBreakerSnapshot(state);
  return {
    error: `Meta API account circuit breaker active for ${state.accountId}; retry live Meta request after ${snapshot.retry_after_seconds}s. Last rate-limit: ${state.lastError}`,
    rateLimited: true,
    blockedByCircuitBreaker: true,
    retryAfterMs: snapshot.retry_after_ms,
    circuitBreaker: snapshot,
  };
};
