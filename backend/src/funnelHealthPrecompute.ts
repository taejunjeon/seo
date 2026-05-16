/**
 * funnel-health 응답을 백그라운드로 미리 계산해 두는 캐시 layer.
 *
 * 목적:
 *  - frontend 가 /api/attribution/funnel-health 를 호출할 때 매번 ledger SQLite + CAPI log
 *    + 분기 계산을 실시간으로 돌면 17~30초 걸린다. Option B 의 핵심은
 *    cron 처럼 주기적으로 미리 계산해 두고, 사용자 요청은 그 캐시만 read 해서 < 500ms 응답.
 *  - 화면에는 "데이터 기준: 03:24 KST / 다음 갱신: 03:30" 처럼 마지막 batch 시각이 보임.
 *
 * 한계:
 *  - in-memory Map 이므로 backend pm2 restart 시 캐시 날라감. 새 worker 가 1tick 후 다시 채움.
 *  - site × window 조합만 cache key. paymentMethod / source / granularity 변경은 cache miss → 실시간.
 *    (대부분 사용자는 default 옵션을 보므로 hit rate 충분)
 */

import {
  buildFunnelHealthReport,
  FUNNEL_HEALTH_WINDOW_HOURS,
  type FunnelHealthInput,
  type FunnelHealthResult,
} from "./funnelHealth";
import { summarizeSiteLandingFunnelEvidence } from "./siteLandingLedger";

type CacheKey = string; // `${site}_${window}_${granularity}_${paymentMethod}_${source}`

type CacheEntry = {
  result: FunnelHealthResult;
  computedAtMs: number;
  generationMs: number;
};

const cache = new Map<CacheKey, CacheEntry>();

let workerStarted = false;
let lastWorkerRunMs = 0;
let nextScheduledRunMs = 0;

const makeKey = (params: {
  site: string;
  window: string;
  granularity: string;
  paymentMethod: string;
  source: string;
}): CacheKey =>
  `${params.site}_${params.window}_${params.granularity}_${params.paymentMethod}_${params.source}`;

export type FunnelHealthCacheMeta = {
  cached: true;
  cached_at_kst: string;
  next_refresh_at_kst: string;
  generation_ms: number;
  staleness_ms: number;
  source: "in_memory_precompute";
};

const toKst = (d: Date): string => {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

export const getPrecomputedFunnelHealth = (params: {
  site: string;
  window: string;
  granularity: string;
  paymentMethod: string;
  source: string;
}): { entry: CacheEntry; meta: FunnelHealthCacheMeta } | null => {
  const key = makeKey(params);
  const entry = cache.get(key);
  if (!entry) return null;
  const now = Date.now();
  const meta: FunnelHealthCacheMeta = {
    cached: true,
    cached_at_kst: toKst(new Date(entry.computedAtMs)),
    next_refresh_at_kst: nextScheduledRunMs > 0 ? toKst(new Date(nextScheduledRunMs)) : "—",
    generation_ms: entry.generationMs,
    staleness_ms: now - entry.computedAtMs,
    source: "in_memory_precompute",
  };
  return { entry, meta };
};

const PRECOMPUTE_TARGETS: Array<{
  site: "biocom" | "thecleancoffee" | "all_sites";
  window: "1d" | "7d" | "14d" | "30d";
  granularity: "day" | "week";
  paymentMethod: "all";
  source: "all";
}> = [
  // 가장 자주 보는 조합만 미리 계산. 사용자가 다른 옵션 누르면 cache miss → 실시간 fallback.
  { site: "biocom", window: "1d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "biocom", window: "7d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "biocom", window: "30d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "thecleancoffee", window: "1d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "thecleancoffee", window: "7d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "thecleancoffee", window: "30d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "all_sites", window: "1d", granularity: "day", paymentMethod: "all", source: "all" },
  { site: "all_sites", window: "7d", granularity: "day", paymentMethod: "all", source: "all" },
];

export type FunnelHealthDataLoader = () => Promise<Omit<FunnelHealthInput, "site" | "window" | "granularity" | "paymentMethod" | "source">>;

/**
 * 한 번의 precompute tick.
 * 외부 호출자가 ledger / capi log / payment-decision records 를 load 해서 dataLoader 로 넘긴다.
 * (각 row 를 한 번만 읽어 모든 target 에 재사용 → I/O 효율)
 */
export const runPrecomputeOnce = async (
  loadData: FunnelHealthDataLoader,
): Promise<{ targets: number; failed: number }> => {
  let failed = 0;
  let ok = 0;
  try {
    const shared = await loadData();
    for (const target of PRECOMPUTE_TARGETS) {
      const started = Date.now();
      try {
        const result = buildFunnelHealthReport({
          ...shared,
          siteLandingEvidence: summarizeSiteLandingFunnelEvidence(
            target.site,
            FUNNEL_HEALTH_WINDOW_HOURS[target.window],
          ),
          site: target.site,
          window: target.window,
          granularity: target.granularity,
          paymentMethod: target.paymentMethod,
          source: target.source,
        });
        const key = makeKey(target);
        cache.set(key, {
          result,
          computedAtMs: Date.now(),
          generationMs: Date.now() - started,
        });
        ok += 1;
      } catch (err) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error("[funnel-health precompute] target failed", target, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[funnel-health precompute] dataLoader failed", err instanceof Error ? err.message : err);
    failed = PRECOMPUTE_TARGETS.length;
  }
  return { targets: ok, failed };
};

export const startFunnelHealthPrecomputeWorker = (
  loadData: FunnelHealthDataLoader,
  intervalMs: number,
): void => {
  if (workerStarted) return;
  workerStarted = true;
  const tick = async () => {
    lastWorkerRunMs = Date.now();
    nextScheduledRunMs = lastWorkerRunMs + intervalMs;
    const result = await runPrecomputeOnce(loadData);
    // eslint-disable-next-line no-console
    console.log(
      `[funnel-health precompute] tick — ok=${result.targets} failed=${result.failed} next=${Math.round(intervalMs / 1000)}s`,
    );
  };
  // 첫 tick 은 backend startup 후 안정화 시간 (30초) 두고 실행
  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, intervalMs);
  }, 30_000);
};

export const getPrecomputeWorkerStatus = (): {
  worker_started: boolean;
  last_run_at_kst: string | null;
  next_run_at_kst: string | null;
  cached_keys: number;
} => ({
  worker_started: workerStarted,
  last_run_at_kst: lastWorkerRunMs > 0 ? toKst(new Date(lastWorkerRunMs)) : null,
  next_run_at_kst: nextScheduledRunMs > 0 ? toKst(new Date(nextScheduledRunMs)) : null,
  cached_keys: cache.size,
});
