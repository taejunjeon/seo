import { env } from "./env";

export type PageSpeedStrategy = "mobile" | "desktop";

export type PageSpeedResult = {
  url: string;
  strategy: PageSpeedStrategy;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  lcpMs: number;
  fcpMs: number;
  cls: number;
  inpMs: number | null;
  ttfbMs: number;
  measuredAt: string;
};

const normalizePageSpeedUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl.trim());
    url.hash = "";
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
};

export const runPageSpeedTest = async (
  url: string,
  strategy: PageSpeedStrategy = "mobile",
): Promise<PageSpeedResult> => {
  if (!env.PAGESPEED_API_KEY) {
    throw new Error("PAGESPEED_API_KEY is not configured");
  }

  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("key", env.PAGESPEED_API_KEY);
  apiUrl.searchParams.set("strategy", strategy);
  apiUrl.searchParams.set("category", "performance");
  apiUrl.searchParams.append("category", "seo");
  apiUrl.searchParams.append("category", "accessibility");

  const response = await fetch(apiUrl.toString());
  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const msg =
      (data as { error?: { message?: string } } | undefined)?.error?.message ??
      "PageSpeed API request failed";
    throw new Error(msg);
  }

  const categories = (data as { lighthouseResult?: { categories?: Record<string, unknown> } })
    .lighthouseResult?.categories ?? {};
  const audits = (data as { lighthouseResult?: { audits?: Record<string, unknown> } })
    .lighthouseResult?.audits ?? {};

  return {
    url: normalizePageSpeedUrl(url),
    strategy,
    performanceScore: Math.round(((categories as any).performance?.score ?? 0) * 100),
    seoScore: Math.round(((categories as any).seo?.score ?? 0) * 100),
    accessibilityScore: Math.round(((categories as any).accessibility?.score ?? 0) * 100),
    lcpMs: Math.round(((audits as any)["largest-contentful-paint"]?.numericValue ?? 0) as number),
    fcpMs: Math.round(((audits as any)["first-contentful-paint"]?.numericValue ?? 0) as number),
    cls: +(
      (((audits as any)["cumulative-layout-shift"]?.numericValue ?? 0) as number).toFixed(4)
    ),
    inpMs: ((audits as any)["interaction-to-next-paint"]?.numericValue as number | undefined)
      ? Math.round(((audits as any)["interaction-to-next-paint"].numericValue ?? 0) as number)
      : null,
    ttfbMs: Math.round(((audits as any)["server-response-time"]?.numericValue ?? 0) as number),
    measuredAt: new Date().toISOString(),
  };
};

/* ── 간단 인메모리 캐시 (Supabase 전까지 사용) ── */
const cache = new Map<string, PageSpeedResult>();

export const getCachedResult = (url: string, strategy: PageSpeedStrategy) =>
  cache.get(`${strategy}:${normalizePageSpeedUrl(url)}`);

export const setCachedResult = (result: PageSpeedResult) =>
  cache.set(`${result.strategy}:${normalizePageSpeedUrl(result.url)}`, {
    ...result,
    url: normalizePageSpeedUrl(result.url),
  });

export const getAllCachedResults = (): PageSpeedResult[] =>
  Array.from(cache.values());
