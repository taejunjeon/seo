import crypto from "crypto";

import { env } from "./env";
import { fetchSerpApiGoogleAiOverview, isSerpApiConfigured, type SerpApiAiOverviewReference } from "./serpapi";

export type AiCitationSample = {
  query: string;
  hasAiOverview: boolean;
  cited: boolean;
  followedPageToken?: boolean;
  referencesCount: number;
  references: { title: string; link: string; source?: string }[];
  matchedReferences: { title: string; link: string; source?: string }[];
  status: "ok" | "no_exposure" | "timeout" | "rate_limited" | "invalid_key" | "parse_error" | "provider_error";
  error?: string;
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

const inflight = new Map<string, Promise<AiCitationResult | null>>();

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

const pickReferences = (refs: SerpApiAiOverviewReference[]) =>
  refs
    .map((r) => ({ title: r.title ?? "", link: r.link ?? "", source: r.source }))
    .filter((r) => r.link)
    .slice(0, 12);

const shortenError = (msg: string, maxLen: number = 200) => (msg.length > maxLen ? `${msg.slice(0, maxLen)}…` : msg);

const classifyError = (err: unknown): { status: AiCitationSample["status"]; error: string } => {
  const raw = err instanceof Error ? (err.message || err.name) : String(err);
  const msg = raw.toLowerCase();
  if (msg.includes("abort") || msg.includes("timeout")) return { status: "timeout", error: shortenError(raw) };
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) return { status: "rate_limited", error: shortenError(raw) };
  if (msg.includes("401") || msg.includes("403") || msg.includes("api key") || msg.includes("unauthorized")) return { status: "invalid_key", error: shortenError(raw) };
  if (msg.includes("parse")) return { status: "parse_error", error: shortenError(raw) };
  return { status: "provider_error", error: shortenError(raw) };
};

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

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

  const fingerprint = sha1(picked.join("|"));
  const cacheKey = `${siteHost}|${hl}|${gl}|${sampleSize}|${fingerprint}`;
  if (!params.forceRefresh && cached && cached.key === cacheKey && Date.now() - cached.measuredAtMs < CACHE_TTL_MS) {
    return cached.value;
  }

  if (!params.forceRefresh) {
    const running = inflight.get(cacheKey);
    if (running) return running;
  }

  const promise = (async () => {
  const samples: AiCitationSample[] = new Array(picked.length);

  // SerpAPI rate/비용을 고려해 제한된 동시성으로 실행합니다.
  // (AEO/GEO가 동시에 호출되는 경우도 있어 in-flight dedupe와 함께 초기 로딩 시간을 줄입니다.)
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(2, picked.length));

  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= picked.length) break;
      const query = picked[idx] ?? "";
      try {
        const { hasAiOverview, references, followedPageToken } = await fetchSerpApiGoogleAiOverview({ query, hl, gl, num: 10 });
        const matched = hasAiOverview ? pickMatchedReferences(references, siteHost) : [];
        const allRefs = hasAiOverview ? pickReferences(references) : [];
        samples[idx] = {
          query,
          hasAiOverview,
          cited: matched.length > 0,
          followedPageToken,
          referencesCount: references.length,
          references: allRefs,
          matchedReferences: matched,
          status: "ok",
        };
      } catch (err) {
        const { status, error } = classifyError(err);
        // 개별 쿼리 실패는 전체 측정 실패로 처리하지 않음(표본 품질만 저하)
        samples[idx] = {
          query,
          hasAiOverview: false,
          cited: false,
          referencesCount: 0,
          references: [],
          matchedReferences: [],
          status,
          error,
        };
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const aiOverviewPresent = samples.filter((s) => s.hasAiOverview).length;
  const citedQueries = samples.filter((s) => s.hasAiOverview && s.cited).length;
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
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
};
