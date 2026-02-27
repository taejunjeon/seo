export const normalizeHost = (host: string) => host.replace(/^www\./i, "").toLowerCase();

export const matchesHostStrict = (link: string, siteHost: string) => {
  const needle = normalizeHost(siteHost);
  if (!needle) return false;
  try {
    const host = normalizeHost(new URL(link).hostname);
    return host === needle || host.endsWith(`.${needle}`);
  } catch {
    return link.toLowerCase().includes(needle);
  }
};

type ResolveResult = {
  finalUrl: string | null;
  canonicalUrl: string | null;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, { measuredAtMs: number; value: ResolveResult }>();
const inflight = new Map<string, Promise<ResolveResult>>();

const readTextLimit = async (res: Response, limitBytes: number) => {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8");
  let out = "";
  let readBytes = 0;

  while (readBytes < limitBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    readBytes += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (readBytes >= limitBytes) {
      // Stop downloading the remainder of the body (we only need a small HTML prefix for canonical parsing).
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }
  }

  out += decoder.decode();
  return out;
};

const extractCanonicalUrl = (html: string, baseUrl: string) => {
  // Basic, resilient canonical extraction. We intentionally avoid a full HTML parser here.
  const linkTag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0] ?? "";
  if (!linkTag) return null;
  const href = linkTag.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? "";
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
};

export const resolveUrlForBroadMatch = async (inputUrl: string): Promise<ResolveResult> => {
  const url = inputUrl.trim();
  if (!url.startsWith("http")) return { finalUrl: null, canonicalUrl: null };

  const cached = cache.get(url);
  const now = Date.now();
  if (cached && now - cached.measuredAtMs < CACHE_TTL_MS) return cached.value;

  const running = inflight.get(url);
  if (running) return running;

  const promise = (async (): Promise<ResolveResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: "text/html,*/*;q=0.8",
          "User-Agent": "biocom-seo-dashboard/1.0 (broad-match)",
        },
        signal: controller.signal,
      });

      const finalUrl = typeof res.url === "string" && res.url.startsWith("http") ? res.url : url;
      const contentType = res.headers.get("content-type") ?? "";
      let canonicalUrl: string | null = null;

      if (contentType.toLowerCase().includes("text/html")) {
        const html = await readTextLimit(res, 64 * 1024);
        canonicalUrl = extractCanonicalUrl(html, finalUrl);
      }

      return { finalUrl, canonicalUrl };
    } catch {
      return { finalUrl: null, canonicalUrl: null };
    } finally {
      clearTimeout(timeout);
    }
  })();

  inflight.set(url, promise);
  try {
    const value = await promise;
    cache.set(url, { measuredAtMs: Date.now(), value });
    return value;
  } finally {
    inflight.delete(url);
  }
};

export const matchesHostBroad = async (link: string, siteHost: string) => {
  if (matchesHostStrict(link, siteHost)) return true;

  const { finalUrl, canonicalUrl } = await resolveUrlForBroadMatch(link);
  if (finalUrl && matchesHostStrict(finalUrl, siteHost)) return true;
  if (canonicalUrl && matchesHostStrict(canonicalUrl, siteHost)) return true;
  return false;
};
