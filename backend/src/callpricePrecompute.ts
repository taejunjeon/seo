/**
 * callprice (상담사 가치 분석) 응답을 백그라운드로 미리 계산해 두는 layer.
 *
 * 목적:
 *  - frontend /callprice 페이지가 14개 endpoint 를 Promise.all 로 동시 호출.
 *    각 endpoint 가 운영DB join 쿼리로 1~4초 → 사용자 5~10초+ 대기.
 *  - 5분 주기로 default 조합 (전체 기간 × 자주 쓰는 maturity_days) 을 미리 계산.
 *    routes/callprice.ts 의 lazy TTL cache 를 채워 둠. 사용자 요청은 cache hit → ~10ms.
 *
 * 동작:
 *  - localhost:7020 self-fetch 로 endpoint 호출 → route handler 가 SQL → setLazyCached.
 *  - 환경변수 CALLPRICE_PRECOMPUTE_ENABLED=0 으로 끌 수 있음.
 *  - CALLPRICE_PRECOMPUTE_INTERVAL_MS=300000 (5분 default).
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const SELF_BASE_URL = process.env.CALLPRICE_PRECOMPUTE_BASE_URL ?? "http://localhost:7020";
const FETCH_TIMEOUT_MS = 30_000;

let workerStarted = false;
let lastRunSummary: {
  startedAtMs: number;
  finishedAtMs: number;
  succeeded: number;
  failed: number;
  totalMs: number;
} | null = null;

// 자주 쓰는 default 조합. 사용자가 다른 옵션 누르면 cache miss → 실시간 SQL (여전히 느리지만 1회만).
const buildDefaultTargets = (): Array<{ label: string; path: string }> => {
  // 페이지 default = 시작일 2024-04-01, 종료일 오늘(KST). 사용자가 임의로 바꿔도
  // default 가 가장 자주 보이므로 이 조합을 미리 채운다.
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const startDate = "2024-04-01";
  const endDate = todayKst;
  const dateRange = `start_date=${startDate}&end_date=${endDate}`;
  return [
    { label: "options", path: `/api/callprice/options` },
    { label: "subscription-status", path: `/api/callprice/subscription-status` },
    { label: "subscription-consult-comparison", path: `/api/callprice/subscription-consult-comparison` },
    // overview · 3 maturity_days 변형 (페이지가 90/180/365 모두 호출)
    { label: "overview-90", path: `/api/callprice/overview?${dateRange}&maturity_days=90` },
    { label: "overview-180", path: `/api/callprice/overview?${dateRange}&maturity_days=180` },
    { label: "overview-365", path: `/api/callprice/overview?${dateRange}&maturity_days=365` },
    { label: "managers", path: `/api/callprice/managers?${dateRange}&maturity_days=90` },
    { label: "analysis-types", path: `/api/callprice/analysis-types?${dateRange}&maturity_days=90` },
    { label: "scenario", path: `/api/callprice/scenario?${dateRange}&maturity_days=90&monthly_cost=3000000&headcount=1` },
    { label: "daytype-comparison", path: `/api/callprice/daytype-comparison?${dateRange}&value_maturity_days=30` },
    { label: "supplement-purchase-timing", path: `/api/callprice/supplement-purchase-timing?${dateRange}&maturity_days=90` },
    { label: "supplement-repeat-pattern", path: `/api/callprice/supplement-repeat-pattern?${dateRange}` },
    { label: "rampup-30", path: `/api/callprice/rampup?maturity_days=30&baseline_scope=global_non_consultation` },
    { label: "supplement-first-ltv", path: `/api/callprice/supplement-first-ltv?start_date=${startDate}&end_date=${endDate}` },
  ];
};

const fetchOne = async (path: string): Promise<{ ok: boolean; status: number; ms: number }> => {
  const t0 = Date.now();
  try {
    const res = await fetch(`${SELF_BASE_URL}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    // body 까지 다 읽어야 cache 가 set 됨 (route handler 가 fresh 결과를 setLazyCached 후 res.json 함)
    // → 그냥 status 만 확인하면 안 되고 body 까지 consume.
    await res.text();
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t0 };
  }
};

const runOneCycle = async (): Promise<void> => {
  const targets = buildDefaultTargets();
  const startedAtMs = Date.now();
  // 직렬 호출 — 운영DB 부담 분산 + Cloudflare 우회 부담 없음 (localhost).
  let succeeded = 0;
  let failed = 0;
  for (const t of targets) {
    const r = await fetchOne(t.path);
    if (r.ok) succeeded += 1;
    else failed += 1;
  }
  const finishedAtMs = Date.now();
  lastRunSummary = {
    startedAtMs,
    finishedAtMs,
    succeeded,
    failed,
    totalMs: finishedAtMs - startedAtMs,
  };
  // eslint-disable-next-line no-console
  console.log(
    `[callprice precompute] cycle 완료 — ${succeeded}/${targets.length} 성공, ${failed} 실패, ${finishedAtMs - startedAtMs}ms`,
  );
};

export const startCallpricePrecomputeWorker = (intervalMs: number = DEFAULT_INTERVAL_MS): void => {
  if (workerStarted) return;
  workerStarted = true;

  // 첫 사이클은 backend 가 listen 한 직후 너무 빨리 돌면 DB 가 아직 warm-up 안 됐을 수 있음.
  // 30초 지연 후 첫 cycle, 그 후 intervalMs 주기로 반복.
  setTimeout(() => {
    runOneCycle().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[callprice precompute] cycle error", err instanceof Error ? err.message : err);
    });
    setInterval(() => {
      runOneCycle().catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[callprice precompute] cycle error", err instanceof Error ? err.message : err);
      });
    }, intervalMs);
  }, 30_000);
};

export const getCallpricePrecomputeSummary = () => lastRunSummary;
