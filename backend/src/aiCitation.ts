import { env } from "./env";
import { fetchSerpApiGoogleAiOverview, isSerpApiConfigured, type SerpApiAiOverviewReference } from "./serpapi";

export type AiCitationSample = {
  query: string;
  hasAiOverview: boolean;
  cited: boolean;
  matchedReferences: { title: string; link: string; source?: string }[];
};

export type AiCitationResult = {
  provider: "serpapi";
  siteHost: string;
  hl: string;
  gl: string;
  sampled: number;
  aiOverviewPresent: number;
  citedQueries: number;
  citedReferences: number;
  citationRateAmongAiOverview: number; // citedQueries / aiOverviewPresent
  measuredAt: string;
  samples: AiCitationSample[];
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let cached:
  | {
      key: string;
      measuredAtMs: number;
      value: AiCitationResult;
    }
  | null = null;

const resolveSiteHost = () => {
  const raw = (env.GSC_SITE_URL ?? "").trim();
  if (!raw) return "biocom.kr";

  // sc-domain:biocom.kr 형태
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
    // link가 URL 파싱 불가인 경우 문자열 포함으로 fallback
    return link.toLowerCase().includes(needle);
  }
};

const pickMatchedReferences = (refs: SerpApiAiOverviewReference[], siteHost: string) =>
  refs
    .filter((r) => (r.link ? matchesHost(r.link, siteHost) : false))
    .map((r) => ({
      title: r.title ?? "",
      link: r.link ?? "",
      source: r.source,
    }))
    .filter((r) => r.link);

export const measureAiCitation = async (params: {
  keywords: { query: string; impressions?: number; clicks?: number }[];
  sampleSize?: number;
  hl?: string;
  gl?: string;
  forceRefresh?: boolean;
}): Promise<AiCitationResult | null> => {
  if (!isSerpApiConfigured()) return null;

  const siteHost = resolveSiteHost();
  const hl = params.hl ?? "ko";
  const gl = params.gl ?? "kr";
  const sampleSize = Math.max(1, Math.min(20, params.sampleSize ?? 5));

  const cacheKey = `${siteHost}|${hl}|${gl}|${sampleSize}`;
  if (!params.forceRefresh && cached && cached.key === cacheKey && Date.now() - cached.measuredAtMs < CACHE_TTL_MS) {
    return cached.value;
  }

  const keywords = params.keywords
    .map((k) => ({
      query: k.query?.trim() ?? "",
      impressions: k.impressions ?? 0,
      clicks: k.clicks ?? 0,
    }))
    .filter((k) => k.query);

  const picked = keywords
    .slice()
    .sort((a, b) => (b.impressions - a.impressions) || (b.clicks - a.clicks))
    .slice(0, sampleSize)
    .map((k) => k.query);

  const samples: AiCitationSample[] = [];

  // SerpAPI rate/비용을 고려하여 순차 실행합니다.
  for (const query of picked) {
    try {
      const { hasAiOverview, references } = await fetchSerpApiGoogleAiOverview({ query, hl, gl, num: 10 });
      const matched = hasAiOverview ? pickMatchedReferences(references, siteHost) : [];
      samples.push({
        query,
        hasAiOverview,
        cited: matched.length > 0,
        matchedReferences: matched,
      });
    } catch {
      // 개별 쿼리 실패는 전체 측정 실패로 처리하지 않음(표본 품질만 저하)
      samples.push({
        query,
        hasAiOverview: false,
        cited: false,
        matchedReferences: [],
      });
    }
  }

  const aiOverviewPresent = samples.filter((s) => s.hasAiOverview).length;
  const citedQueries = samples.filter((s) => s.cited).length;
  const citedReferences = samples.reduce((sum, s) => sum + s.matchedReferences.length, 0);
  const citationRateAmongAiOverview = aiOverviewPresent > 0 ? citedQueries / aiOverviewPresent : 0;

  const value: AiCitationResult = {
    provider: "serpapi",
    siteHost,
    hl,
    gl,
    sampled: samples.length,
    aiOverviewPresent,
    citedQueries,
    citedReferences,
    citationRateAmongAiOverview,
    measuredAt: new Date().toISOString(),
    samples,
  };

  cached = { key: cacheKey, measuredAtMs: Date.now(), value };
  return value;
};

