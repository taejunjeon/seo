import crypto from "crypto";

import { env } from "./env";
import { measureAiCitation, type AiCitationSample } from "./aiCitation";
import { fetchOpenAISearchUrls, isOpenAISearchConfigured } from "./openaiSearch";
import { fetchPerplexityCitations, isPerplexityConfigured, type PerplexitySearchResult } from "./perplexity";

export type AiCitationProvider = "google_ai_overview" | "chatgpt_search" | "perplexity";

export type AiCitationReference = {
  title: string;
  link: string;
  source?: string;
};

export type AiCitationProviderSampleStatus =
  | "ok"
  | "no_exposure"
  | "timeout"
  | "rate_limited"
  | "invalid_key"
  | "parse_error"
  | "provider_error";

export type AiCitationProviderSample = {
  query: string;
  providerStatus: AiCitationProviderSampleStatus;
  eligible: boolean;
  exposure: boolean;
  cited: boolean;
  referencesCount: number;
  references: AiCitationReference[];
  matchedReferences: AiCitationReference[];
  error?: string;
};

export type AiCitationProviderResult = {
  provider: AiCitationProvider;
  providerStatus: "ok" | "partial" | "error";
  statusCounts: Record<AiCitationProviderSampleStatus, number>;
  eligible: number;
  citedQueries: number;
  citedReferences: number;
  citationRate: number;
  latencyMs: number;
  measuredAt: string;
  samples: AiCitationProviderSample[];
  note?: string;
};

export type AiCitationMultiResult = {
  siteHost: string;
  hl: string;
  gl: string;
  sampled: number;
  eligibleTotal: number;
  citedQueriesTotal: number;
  citedReferencesTotal: number;
  citationRateOverall: number;
  latencyMsTotal: number;
  providers: AiCitationProviderResult[];
  pickedQueries: string[];
  measuredAt: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let cached:
  | {
      key: string;
      measuredAtMs: number;
      value: AiCitationMultiResult;
    }
  | null = null;

const inflight = new Map<string, Promise<AiCitationMultiResult | null>>();

const resolveSiteHost = () => {
  const raw = (env.GSC_SITE_URL ?? "").trim();
  if (!raw) return "biocom.kr";

  if (raw.startsWith("sc-domain:")) {
    return raw.replace("sc-domain:", "").replace(/\/+$/, "");
  }

  try {
    const host = new URL(raw).hostname;
    return host || "biocom.kr";
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "") || "biocom.kr";
  }
};

const normalizeHost = (host: string) => host.replace(/^www\./i, "").toLowerCase();

const matchesHost = (link: string, siteHost: string) => {
  const needle = normalizeHost(siteHost);
  if (!needle) return false;
  try {
    const host = normalizeHost(new URL(link).hostname);
    return host === needle || host.endsWith(`.${needle}`);
  } catch {
    return link.toLowerCase().includes(needle);
  }
};

const pickSampleQueries = (params: {
  keywords: { query: string; impressions?: number; clicks?: number }[];
  sampleSize: number;
}) => {
  const keywords = params.keywords
    .map((k) => ({
      query: k.query?.trim() ?? "",
      impressions: k.impressions ?? 0,
      clicks: k.clicks ?? 0,
    }))
    .filter((k) => k.query);

  return keywords
    .slice()
    .sort((a, b) => (b.impressions - a.impressions) || (b.clicks - a.clicks))
    .slice(0, params.sampleSize)
    .map((k) => k.query);
};

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

const toErrorMessage = (err: unknown) => {
  if (!err) return "";
  if (err instanceof Error) return err.message || err.name;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const shortenError = (msg: string, maxLen: number = 200) => (msg.length > maxLen ? `${msg.slice(0, maxLen)}…` : msg);

const classifyProviderError = (err: unknown): { status: AiCitationProviderSampleStatus; error: string } => {
  const raw = toErrorMessage(err);
  const msg = raw.toLowerCase();

  // AbortError / timeout
  if (msg.includes("abort") || msg.includes("timeout")) return { status: "timeout", error: shortenError(raw) };
  // 429 rate limit
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) return { status: "rate_limited", error: shortenError(raw) };
  // auth / invalid key
  if (msg.includes("401") || msg.includes("403") || msg.includes("api key") || msg.includes("unauthorized")) return { status: "invalid_key", error: shortenError(raw) };
  // parse errors
  if (msg.includes("parse")) return { status: "parse_error", error: shortenError(raw) };

  return { status: "provider_error", error: shortenError(raw) };
};

const emptyStatusCounts = (): Record<AiCitationProviderSampleStatus, number> => ({
  ok: 0,
  no_exposure: 0,
  timeout: 0,
  rate_limited: 0,
  invalid_key: 0,
  parse_error: 0,
  provider_error: 0,
});

const summarizeProviderStatus = (samples: AiCitationProviderSample[]): { status: "ok" | "partial" | "error"; counts: Record<AiCitationProviderSampleStatus, number> } => {
  const counts = emptyStatusCounts();
  for (const s of samples) counts[s.providerStatus] = (counts[s.providerStatus] ?? 0) + 1;
  const errorCount = counts.timeout + counts.rate_limited + counts.invalid_key + counts.parse_error + counts.provider_error;
  if (errorCount === samples.length) return { status: "error", counts };
  if (errorCount > 0) return { status: "partial", counts };
  return { status: "ok", counts };
};

const measureGoogleAiOverview = async (params: {
  keywords: { query: string; impressions?: number; clicks?: number }[];
  sampleSize: number;
  hl: string;
  gl: string;
  forceRefresh?: boolean;
}): Promise<{ provider: AiCitationProviderResult; picked: string[] } | null> => {
  const t0 = Date.now();
  const measured = await measureAiCitation({
    keywords: params.keywords,
    sampleSize: params.sampleSize,
    hl: params.hl,
    gl: params.gl,
    forceRefresh: params.forceRefresh,
  });

  if (!measured) return null;

  const samples: AiCitationProviderSample[] = measured.samples.map((s: AiCitationSample) => ({
    query: s.query,
    providerStatus: s.status === "ok" ? (s.hasAiOverview ? "ok" : "no_exposure") : s.status,
    eligible: s.status === "ok" && s.hasAiOverview,
    exposure: s.hasAiOverview,
    cited: s.cited,
    referencesCount: s.referencesCount,
    references: s.references.map((r) => ({
      title: r.title ?? "",
      link: r.link ?? "",
      source: r.source,
    })).filter((r) => r.link),
    matchedReferences: s.matchedReferences.map((r) => ({
      title: r.title ?? "",
      link: r.link ?? "",
      source: r.source,
    })).filter((r) => r.link),
    error: s.error,
  }));

  const summary = summarizeProviderStatus(samples);

  const provider: AiCitationProviderResult = {
    provider: "google_ai_overview",
    providerStatus: summary.status,
    statusCounts: summary.counts,
    eligible: measured.aiOverviewPresent,
    citedQueries: measured.citedQueries,
    citedReferences: measured.citedReferences,
    citationRate: measured.citationRateAmongAiOverview,
    latencyMs: Date.now() - t0,
    measuredAt: measured.measuredAt,
    samples,
    note: "eligible=AI Overview 노출 표본 수(ai_overview.references 존재)",
  };

  return { provider, picked: measured.samples.map((s) => s.query) };
};

const withConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx] as T, idx);
    }
  });

  await Promise.all(runners);
  return results;
};

const measureOpenAiSearch = async (params: {
  queries: string[];
  siteHost: string;
}): Promise<AiCitationProviderResult | null> => {
  if (!isOpenAISearchConfigured()) return null;
  const t0 = Date.now();

  const samples = await withConcurrency(params.queries, 1, async (query) => {
    try {
      const { citations } = await fetchOpenAISearchUrls({ query });
      const refs: AiCitationReference[] = citations.map((c) => ({ title: c.title ?? "", link: c.url, source: "openai_web_search" })).filter((r) => r.link);
      const matched = refs.filter((r) => matchesHost(r.link, params.siteHost));
      const exposure = refs.length > 0;
      return {
        query,
        providerStatus: exposure ? "ok" : "no_exposure",
        eligible: exposure,
        exposure,
        cited: matched.length > 0,
        referencesCount: refs.length,
        references: refs,
        matchedReferences: matched,
      } satisfies AiCitationProviderSample;
    } catch (err) {
      const { status, error } = classifyProviderError(err);
      return {
        query,
        providerStatus: status,
        eligible: false,
        exposure: false,
        cited: false,
        referencesCount: 0,
        references: [],
        matchedReferences: [],
        error,
      } satisfies AiCitationProviderSample;
    }
  });

  const eligible = samples.filter((s) => s.eligible).length;
  const citedQueries = samples.filter((s) => s.eligible && s.cited).length;
  const citedReferences = samples.reduce((sum, s) => sum + s.matchedReferences.length, 0);
  const citationRate = eligible > 0 ? citedQueries / eligible : 0;
  const summary = summarizeProviderStatus(samples);

  return {
    provider: "chatgpt_search",
    providerStatus: summary.status,
    statusCounts: summary.counts,
    eligible,
    citedQueries,
    citedReferences,
    citationRate,
    latencyMs: Date.now() - t0,
    measuredAt: new Date().toISOString(),
    samples,
    note: "OpenAI Responses + web_search_preview 기반(url_citation annotations에서 출처 추출)",
  };
};

const measurePerplexity = async (params: {
  queries: string[];
  siteHost: string;
}): Promise<AiCitationProviderResult | null> => {
  if (!isPerplexityConfigured()) return null;
  const t0 = Date.now();

  const samples = await withConcurrency(params.queries, 1, async (query) => {
    try {
      const { citations } = await fetchPerplexityCitations({ query });
      const refs: AiCitationReference[] = (citations as PerplexitySearchResult[]).map((c) => ({
        title: c.title ?? "",
        link: c.url,
        source: c.source ?? "perplexity",
      })).filter((r) => r.link);
      const matched = refs.filter((r) => matchesHost(r.link, params.siteHost));
      const exposure = refs.length > 0;
      return {
        query,
        providerStatus: exposure ? "ok" : "no_exposure",
        eligible: exposure,
        exposure,
        cited: matched.length > 0,
        referencesCount: refs.length,
        references: refs,
        matchedReferences: matched,
      } satisfies AiCitationProviderSample;
    } catch (err) {
      const { status, error } = classifyProviderError(err);
      return {
        query,
        providerStatus: status,
        eligible: false,
        exposure: false,
        cited: false,
        referencesCount: 0,
        references: [],
        matchedReferences: [],
        error,
      } satisfies AiCitationProviderSample;
    }
  });

  const eligible = samples.filter((s) => s.eligible).length;
  const citedQueries = samples.filter((s) => s.eligible && s.cited).length;
  const citedReferences = samples.reduce((sum, s) => sum + s.matchedReferences.length, 0);
  const citationRate = eligible > 0 ? citedQueries / eligible : 0;
  const summary = summarizeProviderStatus(samples);

  return {
    provider: "perplexity",
    providerStatus: summary.status,
    statusCounts: summary.counts,
    eligible,
    citedQueries,
    citedReferences,
    citationRate,
    latencyMs: Date.now() - t0,
    measuredAt: new Date().toISOString(),
    samples,
    note: "Perplexity API search_results/citations 기반",
  };
};

export const measureAiCitationMulti = async (params: {
  keywords: { query: string; impressions?: number; clicks?: number }[];
  queries?: string[];
  providers?: AiCitationProvider[];
  sampleSize?: number;
  hl?: string;
  gl?: string;
  forceRefresh?: boolean;
}): Promise<AiCitationMultiResult | null> => {
  const t0 = Date.now();
  const siteHost = resolveSiteHost();
  const hl = params.hl ?? "ko";
  const gl = params.gl ?? "kr";
  const sampleSize = Math.max(1, Math.min(20, params.sampleSize ?? 5));

  const selectedProviders = (params.providers?.length ? params.providers : ["google_ai_overview", "chatgpt_search", "perplexity"]).slice();
  const providedQueries = (params.queries ?? []).map((q) => q.trim()).filter(Boolean);
  const basePickedQueries = providedQueries.length > 0
    ? providedQueries.slice(0, sampleSize)
    : pickSampleQueries({ keywords: params.keywords, sampleSize });

  // SerpAPI 측정에서 표본을 고정해야 할 때(queries=로 입력) 강제로 선택되도록 가중치를 부여합니다.
  const keywordsForGoogle = providedQueries.length > 0
    ? basePickedQueries.map((q, i) => ({ query: q, impressions: 10_000 - i, clicks: 0 }))
    : params.keywords;

  const fingerprint = sha1(basePickedQueries.join("|"));
  const providersKey = selectedProviders.slice().sort().join("|") || "none";
  const providerKey = [
    providersKey,
    isOpenAISearchConfigured() ? "openai" : "no-openai",
    isPerplexityConfigured() ? "perplexity" : "no-perplexity",
  ].join(",");
  const cacheKey = `${siteHost}|${hl}|${gl}|${sampleSize}|${providerKey}|${fingerprint}`;

  if (!params.forceRefresh && cached && cached.key === cacheKey && Date.now() - cached.measuredAtMs < CACHE_TTL_MS) {
    return cached.value;
  }

  if (!params.forceRefresh) {
    const running = inflight.get(cacheKey);
    if (running) return running;
  }

  const promise = (async () => {
    const providers: AiCitationProviderResult[] = [];

    // 1) Google AI Overview (SerpAPI)
    const google = selectedProviders.includes("google_ai_overview")
      ? await measureGoogleAiOverview({
          keywords: keywordsForGoogle,
          sampleSize,
          hl,
          gl,
          forceRefresh: params.forceRefresh,
        }).catch(() => null)
      : null;
    if (google?.provider) providers.push(google.provider);

    // 멀티 프로바이더는 동일 표본을 쓰는 게 중요하므로, SerpAPI가 성공하면 그 표본을 우선 사용합니다.
    const picked = google?.picked?.length ? google.picked : basePickedQueries;

    // 2) ChatGPT(Search)
    const openai = selectedProviders.includes("chatgpt_search")
      ? await measureOpenAiSearch({ queries: picked, siteHost }).catch(() => null)
      : null;
    if (openai) providers.push(openai);

    // 3) Perplexity
    const perplexity = selectedProviders.includes("perplexity")
      ? await measurePerplexity({ queries: picked, siteHost }).catch(() => null)
      : null;
    if (perplexity) providers.push(perplexity);

    if (providers.length === 0) return null;

    const eligibleTotal = providers.reduce((s, p) => s + p.eligible, 0);
    const citedQueriesTotal = providers.reduce((s, p) => s + p.citedQueries, 0);
    const citedReferencesTotal = providers.reduce((s, p) => s + p.citedReferences, 0);
    const citationRateOverall = eligibleTotal > 0 ? citedQueriesTotal / eligibleTotal : 0;
    const latencyMsTotal = Date.now() - t0;

    const value: AiCitationMultiResult = {
      siteHost,
      hl,
      gl,
      sampled: picked.length,
      eligibleTotal,
      citedQueriesTotal,
      citedReferencesTotal,
      citationRateOverall,
      latencyMsTotal,
      providers,
      pickedQueries: picked,
      measuredAt: new Date().toISOString(),
    };

    cached = { key: cacheKey, measuredAtMs: Date.now(), value };
    return value;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
};
