/**
 * acquisition-analysis 페이지의 무거운 3개 endpoint 를 백그라운드로 미리 계산.
 *
 *   - /api/attribution/cohort-ltr
 *   - /api/attribution/channel-category-repeat
 *   - /api/attribution/reverse-funnel
 *
 * 셋 다 같은 cohort ledger 를 사용하므로 ledger 1회 load → 3 builder × N window 분기 계산.
 *
 * Target: 사용자 페이지에서 자주 보는 default window (7d/30d/90d/1y) × 3 endpoint = 12 cache key.
 * 사용자가 다른 startAt/endAt 보내면 cache miss → 실시간 fallback.
 *
 * 한계: in-memory Map. backend pm2 restart 시 캐시 날라감 (다음 tick 에서 다시 채움).
 */

import {
  buildAttributionCohortLtrReport,
  buildChannelCategoryRepeatReport,
  buildReverseFunnelReport,
  type FirstPurchaseCategory,
} from "./acquisitionCohort";
import type { AttributionLedgerEntry } from "./attribution";

export type AcquisitionEndpoint = "cohort-ltr" | "channel-category-repeat" | "reverse-funnel";
export type AcquisitionWindowKey = "7d" | "30d" | "90d" | "1y";

type CacheKey = string;
type CacheEntry = {
  result: unknown;
  computedAtMs: number;
  generationMs: number;
};

const cache = new Map<CacheKey, CacheEntry>();

let workerStarted = false;
let lastRunMs = 0;
let nextScheduledMs = 0;

export type AcquisitionCacheMeta = {
  cached: true;
  cached_at_kst: string;
  next_refresh_at_kst: string | null;
  generation_ms: number;
  staleness_ms: number;
  source: "in_memory_precompute";
};

const toKst = (d: Date): string => {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

// 매 tick 마다 today KST 자정 기준 startAt/endAt 계산. 같은 날 안에선 같은 cache key 보장.
const todayKstIsoDate = (): string => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
};

const subtractDaysFromKstIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const WINDOW_DAYS: Record<AcquisitionWindowKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export const resolveWindowRange = (
  window: AcquisitionWindowKey,
  asOfIso?: string,
): { startAt: string; endAt: string } => {
  const endAt = asOfIso ?? todayKstIsoDate();
  const startAt = subtractDaysFromKstIso(endAt, WINDOW_DAYS[window]);
  return { startAt, endAt };
};

const makeKey = (params: {
  endpoint: AcquisitionEndpoint;
  startAt: string;
  endAt: string;
  dataSource: string;
  channels?: FirstPurchaseCategory[] | null;
}): CacheKey => {
  const channelKey =
    params.channels && params.channels.length > 0 ? params.channels.slice().sort().join(",") : "all";
  return `${params.endpoint}_${params.startAt}_${params.endAt}_${params.dataSource}_${channelKey}`;
};

export const getPrecomputedAcquisition = (params: {
  endpoint: AcquisitionEndpoint;
  startAt: string;
  endAt: string;
  dataSource: string;
  channels?: FirstPurchaseCategory[] | null;
}): { entry: CacheEntry; meta: AcquisitionCacheMeta } | null => {
  const key = makeKey(params);
  const entry = cache.get(key);
  if (!entry) return null;
  const meta: AcquisitionCacheMeta = {
    cached: true,
    cached_at_kst: toKst(new Date(entry.computedAtMs)),
    next_refresh_at_kst: nextScheduledMs > 0 ? toKst(new Date(nextScheduledMs)) : null,
    generation_ms: entry.generationMs,
    staleness_ms: Date.now() - entry.computedAtMs,
    source: "in_memory_precompute",
  };
  return { entry, meta };
};

export type AcquisitionDataLoader = () => Promise<{
  ledgerEntries: AttributionLedgerEntry[];
  dataSource: string;
  remoteWarnings: string[];
}>;

const WINDOWS: AcquisitionWindowKey[] = ["7d", "30d", "90d", "1y"];

// frontend 의 `new Date().toISOString()` 가 UTC 기준이라 KST 새벽 시간엔
// UTC 어제 날짜를 endAt 으로 보낼 수 있다. 이 차이를 흡수하려고 endAt 을 KST today 와
// KST today-1 두 가지로 모두 cache.
const ENDAT_VARIANTS = 2;

const computeRanges = (win: AcquisitionWindowKey): Array<{ startAt: string; endAt: string }> => {
  const results: Array<{ startAt: string; endAt: string }> = [];
  const todayKst = todayKstIsoDate();
  for (let dayShift = 0; dayShift < ENDAT_VARIANTS; dayShift += 1) {
    const endAt = subtractDaysFromKstIso(todayKst, dayShift);
    const startAt = subtractDaysFromKstIso(endAt, WINDOW_DAYS[win]);
    results.push({ startAt, endAt });
  }
  return results;
};

export const runAcquisitionPrecomputeOnce = async (
  loadData: AcquisitionDataLoader,
): Promise<{ ok: number; failed: number }> => {
  let ok = 0;
  let failed = 0;
  try {
    const shared = await loadData();
    for (const win of WINDOWS) {
      const ranges = computeRanges(win);
      for (const range of ranges) {
      // 1) cohort-ltr (channels=all only — 채널 필터는 사용자가 누를 때 fallback)
      {
        const started = Date.now();
        try {
          const report = buildAttributionCohortLtrReport({
            startAt: range.startAt,
            endAt: range.endAt,
            channels: undefined,
            ledgerEntries: shared.ledgerEntries,
          });
          const key = makeKey({
            endpoint: "cohort-ltr",
            startAt: range.startAt,
            endAt: range.endAt,
            dataSource: shared.dataSource,
          });
          cache.set(key, {
            result: { ok: true, dataSource: shared.dataSource, remoteWarnings: shared.remoteWarnings, ...report },
            computedAtMs: Date.now(),
            generationMs: Date.now() - started,
          });
          ok += 1;
        } catch (err) {
          failed += 1;
          // eslint-disable-next-line no-console
          console.error(`[acquisition precompute] cohort-ltr ${win} failed`, err instanceof Error ? err.message : err);
        }
      }
      // 2) channel-category-repeat
      {
        const started = Date.now();
        try {
          const report = buildChannelCategoryRepeatReport({
            startAt: range.startAt,
            endAt: range.endAt,
            ledgerEntries: shared.ledgerEntries,
          });
          const key = makeKey({
            endpoint: "channel-category-repeat",
            startAt: range.startAt,
            endAt: range.endAt,
            dataSource: shared.dataSource,
          });
          cache.set(key, {
            result: { ok: true, dataSource: shared.dataSource, remoteWarnings: shared.remoteWarnings, ...report },
            computedAtMs: Date.now(),
            generationMs: Date.now() - started,
          });
          ok += 1;
        } catch (err) {
          failed += 1;
          // eslint-disable-next-line no-console
          console.error(`[acquisition precompute] channel-category-repeat ${win} failed`, err instanceof Error ? err.message : err);
        }
      }
      // 3) reverse-funnel
      {
        const started = Date.now();
        try {
          const report = buildReverseFunnelReport({
            startAt: range.startAt,
            endAt: range.endAt,
            ledgerEntries: shared.ledgerEntries,
          });
          const key = makeKey({
            endpoint: "reverse-funnel",
            startAt: range.startAt,
            endAt: range.endAt,
            dataSource: shared.dataSource,
          });
          cache.set(key, {
            result: { ok: true, dataSource: shared.dataSource, remoteWarnings: shared.remoteWarnings, ...report },
            computedAtMs: Date.now(),
            generationMs: Date.now() - started,
          });
          ok += 1;
        } catch (err) {
          failed += 1;
          // eslint-disable-next-line no-console
          console.error(`[acquisition precompute] reverse-funnel ${win} failed`, err instanceof Error ? err.message : err);
        }
      }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[acquisition precompute] dataLoader failed", err instanceof Error ? err.message : err);
    failed += WINDOWS.length * 3;
  }
  return { ok, failed };
};

export const startAcquisitionPrecomputeWorker = (
  loadData: AcquisitionDataLoader,
  intervalMs: number,
): void => {
  if (workerStarted) return;
  workerStarted = true;
  const tick = async () => {
    lastRunMs = Date.now();
    nextScheduledMs = lastRunMs + intervalMs;
    const res = await runAcquisitionPrecomputeOnce(loadData);
    // eslint-disable-next-line no-console
    console.log(
      `[acquisition precompute] tick — ok=${res.ok} failed=${res.failed} next=${Math.round(intervalMs / 1000)}s`,
    );
  };
  // 첫 tick 은 backend startup 후 60초 두고 (funnel-health precompute 와 시각 분산)
  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, intervalMs);
  }, 60_000);
};

export const getAcquisitionPrecomputeStatus = (): {
  worker_started: boolean;
  last_run_at_kst: string | null;
  next_run_at_kst: string | null;
  cached_keys: number;
} => ({
  worker_started: workerStarted,
  last_run_at_kst: lastRunMs > 0 ? toKst(new Date(lastRunMs)) : null,
  next_run_at_kst: nextScheduledMs > 0 ? toKst(new Date(nextScheduledMs)) : null,
  cached_keys: cache.size,
});
