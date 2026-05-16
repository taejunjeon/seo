/**
 * 공용 lazy TTL cache.
 *
 * Option B 패턴: 사용자 요청 시점에 cache lookup → hit 이면 즉시 반환, miss 면 실시간 계산 후 cache 채움.
 * Meta API rate limit 압박을 자연 감소시키고, 무거운 endpoint 의 응답 시간을 첫 호출 후 5분간 ~10ms 로 유지.
 *
 * 사용 예:
 *   const KEY = `endpoint:${arg1}:${arg2}`;
 *   const hit = getLazyCached(KEY);
 *   if (hit) return res.json({ ...hit.result, cache: buildLazyCacheMeta(hit, "lazy_cache_hit") });
 *   const fresh = await computeExpensiveThing(...);
 *   const entry = setLazyCached(KEY, fresh, 5 * 60 * 1000);
 *   return res.json({ ...fresh, cache: buildLazyCacheMeta(entry, "live_cache_miss") });
 */

export type LazyCacheEntry = {
  result: unknown;
  cachedAtMs: number;
  expiresAtMs: number;
};

const store = new Map<string, LazyCacheEntry>();

const toKstShort = (ms: number): string => {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

export const getLazyCached = (key: string): LazyCacheEntry | null => {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAtMs) {
    store.delete(key);
    return null;
  }
  return e;
};

/**
 * stale-while-revalidate 용: expire 됐어도 ms 안에 있으면 stale entry 반환.
 * 호출자는 stale 인지 알 수 있고, 새 fetch 가 실패해도 사용자에게 옛 데이터를 보여 줌.
 */
export const getLazyCachedStale = (key: string, staleMaxAgeMs = 30 * 60 * 1000): LazyCacheEntry | null => {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.cachedAtMs > staleMaxAgeMs) {
    store.delete(key);
    return null;
  }
  return e;
};

export const setLazyCached = (key: string, result: unknown, ttlMs: number): LazyCacheEntry => {
  const entry: LazyCacheEntry = {
    result,
    cachedAtMs: Date.now(),
    expiresAtMs: Date.now() + ttlMs,
  };
  store.set(key, entry);
  return entry;
};

export type LazyCacheSource = "lazy_cache_hit" | "live_force" | "live_cache_miss";

export const buildLazyCacheMeta = (
  entry: LazyCacheEntry | null,
  source: LazyCacheSource,
): {
  cached: boolean;
  cached_at_kst: string | null;
  next_refresh_at_kst: string | null;
  ttl_seconds: number;
  source: LazyCacheSource;
} => ({
  cached: source === "lazy_cache_hit",
  cached_at_kst: entry ? toKstShort(entry.cachedAtMs) : null,
  next_refresh_at_kst: entry ? toKstShort(entry.expiresAtMs) : null,
  ttl_seconds: entry ? Math.round((entry.expiresAtMs - entry.cachedAtMs) / 1000) : 0,
  source,
});

export const getLazyCacheSize = (): number => store.size;
