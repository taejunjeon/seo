type MetaAccountQueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  enqueuedAtMs: number;
  context: MetaAccountRequestContext;
};

export type MetaAccountRequestContext = {
  path?: string;
  method?: string;
  endpoint?: string;
};

type MetaAccountQueueState = {
  active: number;
  queue: Array<MetaAccountQueueItem<unknown>>;
  lastStartedAtMs: number;
  started: number;
  completed: number;
  failed: number;
  maxQueued: number;
  totalQueueWaitMs: number;
  lastQueuedAtMs: number | null;
  lastStartedPath: string | null;
  lastCompletedAtMs: number | null;
  lastError: string | null;
};

type MetaApiUsageSnapshot = {
  account_id: string;
  observed_at_kst: string;
  status: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  parsed: Record<string, unknown>;
  max_usage_percent: number | null;
  estimated_time_to_regain_access_seconds: number | null;
};

const META_ACCOUNT_REQUEST_QUEUE_CONCURRENCY = 2;
const META_ACCOUNT_REQUEST_QUEUE_MIN_GAP_MS = 150;
const META_ACCOUNT_REQUEST_QUEUE_MAX_WAIT_MS = 120_000;
const META_API_USAGE_WARN_PERCENT = 80;
const queues = new Map<string, MetaAccountQueueState>();
const usageSnapshots = new Map<string, MetaApiUsageSnapshot>();

const parsePositiveNumberEnv = (key: string, fallback: number, min: number = 0) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const getQueueConfig = () => ({
  enabled: process.env.META_ACCOUNT_REQUEST_QUEUE_ENABLED !== "0",
  concurrency: Math.max(
    1,
    Math.floor(parsePositiveNumberEnv(
      "META_ACCOUNT_REQUEST_QUEUE_CONCURRENCY",
      META_ACCOUNT_REQUEST_QUEUE_CONCURRENCY,
      1,
    )),
  ),
  minGapMs: parsePositiveNumberEnv(
    "META_ACCOUNT_REQUEST_QUEUE_MIN_GAP_MS",
    META_ACCOUNT_REQUEST_QUEUE_MIN_GAP_MS,
    0,
  ),
  maxWaitMs: parsePositiveNumberEnv(
    "META_ACCOUNT_REQUEST_QUEUE_MAX_WAIT_MS",
    META_ACCOUNT_REQUEST_QUEUE_MAX_WAIT_MS,
    1_000,
  ),
  usageWarnPercent: parsePositiveNumberEnv(
    "META_API_USAGE_WARN_PERCENT",
    META_API_USAGE_WARN_PERCENT,
    1,
  ),
});

const toKstMinute = (ms: number): string => {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

const getQueue = (accountId: string): MetaAccountQueueState => {
  const existing = queues.get(accountId);
  if (existing) return existing;
  const created: MetaAccountQueueState = {
    active: 0,
    queue: [],
    lastStartedAtMs: 0,
    started: 0,
    completed: 0,
    failed: 0,
    maxQueued: 0,
    totalQueueWaitMs: 0,
    lastQueuedAtMs: null,
    lastStartedPath: null,
    lastCompletedAtMs: null,
    lastError: null,
  };
  queues.set(accountId, created);
  return created;
};

const runQueue = (accountId: string) => {
  const state = getQueue(accountId);
  const config = getQueueConfig();
  if (state.active >= config.concurrency || state.queue.length === 0) return;

  const now = Date.now();
  const elapsedSinceLastStartMs = now - state.lastStartedAtMs;
  if (state.lastStartedAtMs > 0 && elapsedSinceLastStartMs < config.minGapMs) {
    setTimeout(() => runQueue(accountId), config.minGapMs - elapsedSinceLastStartMs);
    return;
  }

  const item = state.queue.shift();
  if (!item) return;
  const queueWaitMs = now - item.enqueuedAtMs;
  if (queueWaitMs > config.maxWaitMs) {
    state.failed += 1;
    state.lastError = `Meta request queue wait exceeded ${config.maxWaitMs}ms`;
    item.reject(new Error(state.lastError));
    setImmediate(() => runQueue(accountId));
    return;
  }

  state.active += 1;
  state.started += 1;
  state.totalQueueWaitMs += queueWaitMs;
  state.lastStartedAtMs = now;
  state.lastStartedPath = item.context.path ?? item.context.endpoint ?? null;

  item.task()
    .then((value) => {
      state.completed += 1;
      state.lastCompletedAtMs = Date.now();
      state.active -= 1;
      item.resolve(value);
    })
    .catch((error) => {
      state.failed += 1;
      state.lastError = error instanceof Error ? error.message : String(error);
      state.active -= 1;
      item.reject(error);
    })
    .finally(() => {
      setImmediate(() => runQueue(accountId));
    });

  setImmediate(() => runQueue(accountId));
};

export const runMetaAccountRequest = <T>(
  accountId: string | undefined,
  task: () => Promise<T>,
  context: MetaAccountRequestContext = {},
): Promise<T> => {
  const config = getQueueConfig();
  if (!config.enabled || !accountId) return task();

  return new Promise<T>((resolve, reject) => {
    const state = getQueue(accountId);
    const typedItem: MetaAccountQueueItem<T> = {
      task,
      resolve,
      reject,
      enqueuedAtMs: Date.now(),
      context,
    };
    state.queue.push(typedItem as MetaAccountQueueItem<unknown>);
    state.lastQueuedAtMs = typedItem.enqueuedAtMs;
    state.maxQueued = Math.max(state.maxQueued, state.queue.length);
    runQueue(accountId);
  });
};

const parseJsonHeader = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const collectNumbersByKey = (value: unknown, keyPattern: RegExp, output: number[] = []): number[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectNumbersByKey(item, keyPattern, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "number" && keyPattern.test(key)) output.push(item);
    collectNumbersByKey(item, keyPattern, output);
  }
  return output;
};

export const recordMetaApiUsageHeaders = (
  accountId: string | undefined,
  headers: Headers,
  context: MetaAccountRequestContext & { status?: number } = {},
) => {
  const headerValues: Record<string, string> = {};
  for (const headerName of ["x-app-usage", "x-ad-account-usage", "x-business-use-case-usage"]) {
    const value = headers.get(headerName);
    if (value) headerValues[headerName] = value;
  }
  if (Object.keys(headerValues).length === 0) return;

  const parsed = Object.fromEntries(
    Object.entries(headerValues).map(([key, value]) => [key, parseJsonHeader(value)]),
  );
  const usageNumbers = [
    ...collectNumbersByKey(parsed, /(?:call_count|total_cputime|total_time|acc_id_util_pct)$/i),
  ];
  const regainAccessNumbers = collectNumbersByKey(parsed, /estimated_time_to_regain_access/i);
  const snapshot: MetaApiUsageSnapshot = {
    account_id: accountId ?? "unknown",
    observed_at_kst: toKstMinute(Date.now()),
    status: context.status ?? 0,
    method: context.method ?? "GET",
    path: context.path ?? context.endpoint ?? "",
    headers: headerValues,
    parsed,
    max_usage_percent: usageNumbers.length ? Math.max(...usageNumbers) : null,
    estimated_time_to_regain_access_seconds: regainAccessNumbers.length
      ? Math.max(...regainAccessNumbers)
      : null,
  };
  usageSnapshots.set(snapshot.account_id, snapshot);

  const config = getQueueConfig();
  if (snapshot.max_usage_percent !== null && snapshot.max_usage_percent >= config.usageWarnPercent) {
    console.warn(
      `[meta] Usage header high account=${snapshot.account_id} max=${snapshot.max_usage_percent}% path=${snapshot.path}`,
    );
  }
};

export const getMetaAccountRequestQueueSnapshot = () => {
  const config = getQueueConfig();
  return {
    config,
    accounts: Object.fromEntries([...queues.entries()].map(([accountId, state]) => [
      accountId,
      {
        active: state.active,
        queued: state.queue.length,
        started: state.started,
        completed: state.completed,
        failed: state.failed,
        max_queued: state.maxQueued,
        avg_queue_wait_ms: state.started > 0
          ? Math.round(state.totalQueueWaitMs / state.started)
          : 0,
        last_queued_at_kst: state.lastQueuedAtMs ? toKstMinute(state.lastQueuedAtMs) : null,
        last_completed_at_kst: state.lastCompletedAtMs ? toKstMinute(state.lastCompletedAtMs) : null,
        last_started_path: state.lastStartedPath,
        last_error: state.lastError,
      },
    ])),
  };
};

export const getMetaApiUsageSnapshots = () => (
  Object.fromEntries([...usageSnapshots.entries()])
);
