/**
 * Naver Ads campaign summary precompute.
 *
 * /ads/naver 화면은 광고비 cache 집계 자체보다 내부 evidence join 이 느리다.
 * 자주 보는 7/30/90일 조합을 self-fetch 로 미리 계산해 routes/naverAds lazy cache 를 채운다.
 * 실제 광고 플랫폼 전송/DB write 없음. 로컬 SQLite read + 내부 summary 계산만 수행한다.
 */

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_START_DELAY_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 120_000;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getSelfBaseUrl = (): string => (
  process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_BASE_URL
    ?? `http://127.0.0.1:${process.env.PORT ?? "7020"}`
);

const daysAgoIso = (days: number): string => (
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
);

const parseWindows = (): number[] => {
  const raw = process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_WINDOWS ?? "7,30,90";
  const windows = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return windows.length > 0 ? windows : [7, 30, 90];
};

const parseSites = (): Array<"biocom" | "thecleancoffee"> => {
  const raw = process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_SITES ?? "biocom";
  const sites = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is "biocom" | "thecleancoffee" => (
      value === "biocom" || value === "thecleancoffee"
    ));
  return sites.length > 0 ? sites : ["biocom"];
};

const buildTargets = (): Array<{ label: string; path: string }> => {
  const until = daysAgoIso(1);
  const sites = parseSites();
  const windows = parseWindows();

  return sites.flatMap((site) => (
    windows.map((windowDays) => {
      const since = daysAgoIso(windowDays);
      const params = new URLSearchParams({
        site,
        since,
        until,
        force: "1",
        precompute: "1",
      });
      return {
        label: `${site}:last_${windowDays}d:${since}~${until}`,
        path: `/api/ads/naver/campaign-summary?${params.toString()}`,
      };
    })
  ));
};

const fetchOne = async (
  baseUrl: string,
  path: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; ms: number; source: string }> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; summary_cache?: { source?: string } }
      | null;
    return {
      ok: response.ok && body?.ok === true,
      status: response.status,
      ms: Date.now() - startedAt,
      source: body?.summary_cache?.source ?? "?",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - startedAt,
      source: "fetch_error",
    };
  } finally {
    clearTimeout(timer);
  }
};

let workerStarted = false;
let running = false;
let lastRunSummary: {
  startedAtMs: number;
  finishedAtMs: number;
  succeeded: number;
  failed: number;
  totalMs: number;
  targets: number;
} | null = null;

const runOneCycle = async (): Promise<void> => {
  if (running) {
    // eslint-disable-next-line no-console
    console.log("[Naver Ads summary precompute] skip — previous tick still running");
    return;
  }

  running = true;
  const startedAtMs = Date.now();
  const targets = buildTargets();
  const baseUrl = getSelfBaseUrl();
  const timeoutMs = parsePositiveInt(
    process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  let succeeded = 0;
  let failed = 0;

  try {
    for (const target of targets) {
      const result = await fetchOne(baseUrl, target.path, timeoutMs);
      if (result.ok) {
        succeeded += 1;
        // eslint-disable-next-line no-console
        console.log(
          `[Naver Ads summary precompute] ok ${target.label} source=${result.source} ${result.ms}ms`,
        );
      } else {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error(
          `[Naver Ads summary precompute] fail ${target.label} HTTP ${result.status} ${result.ms}ms`,
        );
      }
    }
  } finally {
    const finishedAtMs = Date.now();
    lastRunSummary = {
      startedAtMs,
      finishedAtMs,
      succeeded,
      failed,
      totalMs: finishedAtMs - startedAtMs,
      targets: targets.length,
    };
    running = false;
    // eslint-disable-next-line no-console
    console.log(
      `[Naver Ads summary precompute] tick — ok=${succeeded} failed=${failed} total=${targets.length} ${finishedAtMs - startedAtMs}ms`,
    );
  }
};

export const startNaverAdsSummaryPrecomputeWorker = (intervalMs = DEFAULT_INTERVAL_MS): void => {
  if (workerStarted) return;
  workerStarted = true;

  const startDelayMs = parsePositiveInt(
    process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_START_DELAY_MS,
    DEFAULT_START_DELAY_MS,
  );

  setTimeout(() => {
    runOneCycle().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[Naver Ads summary precompute] cycle error", error instanceof Error ? error.message : error);
    });
    setInterval(() => {
      runOneCycle().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[Naver Ads summary precompute] cycle error", error instanceof Error ? error.message : error);
      });
    }, intervalMs);
  }, startDelayMs);
};

export const getNaverAdsSummaryPrecomputeSummary = () => lastRunSummary;
