import { env } from "./env";

export const isSerpApiConfigured = () => !!env.SERP_API_KEY;

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
  ai_overview?: { references?: SerpApiAiOverviewReference[] };
  error?: string;
};

export const fetchSerpApiAccount = async (): Promise<SerpApiAccount> => {
  if (!env.SERP_API_KEY) {
    throw new Error("SERP_API_KEY is not configured");
  }

  const url = new URL("https://serpapi.com/account");
  url.searchParams.set("api_key", env.SERP_API_KEY);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const payload = (await res.json().catch(() => null)) as SerpApiAccount | null;
  if (!res.ok) {
    const msg = payload?.error ? `SerpAPI error: ${payload.error}` : `SerpAPI request failed (${res.status})`;
    throw new Error(msg);
  }

  return payload ?? {};
};

export const fetchSerpApiGoogleAiOverview = async (params: {
  query: string;
  hl?: string;
  gl?: string;
  num?: number;
}): Promise<{ hasAiOverview: boolean; references: SerpApiAiOverviewReference[] }> => {
  if (!env.SERP_API_KEY) {
    throw new Error("SERP_API_KEY is not configured");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", params.query);
  url.searchParams.set("hl", params.hl ?? "ko");
  url.searchParams.set("gl", params.gl ?? "kr");
  url.searchParams.set("num", String(params.num ?? 10));
  url.searchParams.set("api_key", env.SERP_API_KEY);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const payload = (await res.json().catch(() => null)) as SerpApiGoogleSearchResponse | null;
  if (!res.ok) {
    const msg = payload?.error ? `SerpAPI error: ${payload.error}` : `SerpAPI request failed (${res.status})`;
    throw new Error(msg);
  }

  if (payload?.error) {
    throw new Error(`SerpAPI error: ${payload.error}`);
  }

  const references = payload?.ai_overview?.references ?? [];
  return { hasAiOverview: references.length > 0, references };
};
