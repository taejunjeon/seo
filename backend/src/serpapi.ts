import { env } from "./env";
import { CircuitBreaker } from "./utils/circuitBreaker";

export const isSerpApiConfigured = () => !!env.SERP_API_KEY;

const serpApiBreaker = new CircuitBreaker({
  service: "serpapi",
  failureThreshold: 5,
  cooldownMs: 30_000,
});

export type SerpApiAccount = {
  plan_name?: string;
  this_month_usage?: number;
  searches_left?: number | null;
  error?: string;
};

export type SerpApiAiOverviewReference = {
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
  index?: number;
};

export type SerpApiGoogleSearchResponse = {
  search_metadata?: { status?: string; id?: string };
  ai_overview?: { references?: SerpApiAiOverviewReference[]; page_token?: string };
  page_token?: string;
  error?: string;
};

export const fetchSerpApiAccount = async (): Promise<SerpApiAccount> => {
  const apiKey = env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERP_API_KEY is not configured");
  }

  return serpApiBreaker.exec(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = new URL("https://serpapi.com/account");
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const payload = (await res.json().catch(() => null)) as SerpApiAccount | null;
    if (!res.ok) {
      const msg = payload?.error ? `SerpAPI error: ${payload.error}` : `SerpAPI request failed (${res.status})`;
      throw new Error(msg);
    }

    return payload ?? {};
  });
};

export const fetchSerpApiGoogleAiOverview = async (params: {
  query: string;
  hl?: string;
  gl?: string;
  num?: number;
}): Promise<{ hasAiOverview: boolean; references: SerpApiAiOverviewReference[]; followedPageToken: boolean }> => {
  const apiKey = env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERP_API_KEY is not configured");
  }

  return serpApiBreaker.exec(async () => {
    const baseUrl = new URL("https://serpapi.com/search.json");
    baseUrl.searchParams.set("engine", "google");
    baseUrl.searchParams.set("q", params.query);
    baseUrl.searchParams.set("hl", params.hl ?? "ko");
    baseUrl.searchParams.set("gl", params.gl ?? "kr");
    baseUrl.searchParams.set("num", String(params.num ?? 10));
    baseUrl.searchParams.set("api_key", apiKey);

    const fetchOnce = async (url: URL) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const payload = (await res.json().catch(() => null)) as SerpApiGoogleSearchResponse | null;
      if (!res.ok) {
        const msg = payload?.error ? `SerpAPI error: ${payload.error}` : `SerpAPI request failed (${res.status})`;
        throw new Error(msg);
      }
      if (payload?.error) throw new Error(`SerpAPI error: ${payload.error}`);
      return payload;
    };

    const payload = await fetchOnce(baseUrl);
    const references = payload?.ai_overview?.references ?? [];
    if (references.length > 0) {
      return { hasAiOverview: true, references, followedPageToken: false };
    }

    // 일부 케이스는 page_token follow-up 요청으로 AI Overview가 뒤늦게 로드될 수 있습니다.
    // 주의: 다른 블록(예: related_questions)의 next_page_token은 AIO와 무관하므로 사용하지 않습니다.
    const token = payload?.ai_overview?.page_token ?? payload?.page_token ?? null;
    if (!token) {
      return { hasAiOverview: false, references: [], followedPageToken: false };
    }

    const tokenUrl = new URL(baseUrl.toString());
    tokenUrl.searchParams.set("page_token", token);
    const payload2 = await fetchOnce(tokenUrl);
    const references2 = payload2?.ai_overview?.references ?? [];

    return { hasAiOverview: references2.length > 0, references: references2, followedPageToken: true };
  });
};
