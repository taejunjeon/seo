type CacheEntry = {
  title: string;
  expiresAtMs: number;
};

const TITLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TITLE_RETRY_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const normalizeUrlForCache = (rawUrl: string) => {
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

const isAllowedToFetch = (url: URL) => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "biocom.kr" || host.endsWith(".biocom.kr");
};

const decodeHtmlEntities = (value: string) =>
  value.replace(
    /&(#(\d+)|#x([0-9a-fA-F]+)|amp|lt|gt|quot|apos);/g,
    (_match, token: string, dec: string | undefined, hex: string | undefined) => {
      if (token === "amp") return "&";
      if (token === "lt") return "<";
      if (token === "gt") return ">";
      if (token === "quot") return "\"";
      if (token === "apos") return "'";
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return _match;
    },
  );

const stripHtmlTags = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractMetaContent = (html: string, key: { attr: "property" | "name"; value: string }) => {
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  const attrRegex = /([a-zA-Z:_-]+)\s*=\s*["']([^"']*)["']/g;

  for (const metaTag of html.match(metaTagRegex) ?? []) {
    const attrs = new Map<string, string>();
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = attrRegex.exec(metaTag)) !== null) {
      attrs.set(match[1].toLowerCase(), match[2]);
    }

    const attrValue = attrs.get(key.attr);
    if (!attrValue || attrValue.toLowerCase() !== key.value.toLowerCase()) continue;
    const content = attrs.get("content");
    if (content && content.trim()) return content.trim();
  }

  return null;
};

const extractTitle = (html: string) => {
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const h1Text = h1Match?.[1] ? stripHtmlTags(decodeHtmlEntities(h1Match[1])) : "";
  if (h1Text) return h1Text.replace(/\s+/g, " ").trim();

  const ogTitle = extractMetaContent(html, { attr: "property", value: "og:title" });
  if (ogTitle) return decodeHtmlEntities(ogTitle).replace(/\s+/g, " ").trim();

  const twitterTitle = extractMetaContent(html, { attr: "name", value: "twitter:title" });
  if (twitterTitle) return decodeHtmlEntities(twitterTitle).replace(/\s+/g, " ").trim();

  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (titleMatch?.[1]) return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim();

  return null;
};

const deriveFallbackTitleFromUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.replace(/\/+$/, "");
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    const idx = url.searchParams.get("idx");

    if (lastSegment && idx) return `${lastSegment} (idx=${idx})`;
    if (lastSegment) return lastSegment;
    if (idx) return `idx=${idx}`;
    return url.hostname;
  } catch {
    return rawUrl.split("/").pop() || rawUrl;
  }
};

const fetchHtmlWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "biocom-seo-dashboard/1.0",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return null;

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const resolvePageTitle = async (
  rawUrl: string,
  options?: { timeoutMs?: number },
): Promise<{ url: string; title: string }> => {
  const normalizedUrl = normalizeUrlForCache(rawUrl);
  const cached = cache.get(normalizedUrl);
  if (cached && Date.now() < cached.expiresAtMs) {
    return { url: normalizedUrl, title: cached.title };
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    parsedUrl = null;
  }

  if (!parsedUrl || !isAllowedToFetch(parsedUrl)) {
    const fallback = deriveFallbackTitleFromUrl(normalizedUrl);
    cache.set(normalizedUrl, { title: fallback, expiresAtMs: Date.now() + TITLE_CACHE_TTL_MS });
    return { url: normalizedUrl, title: fallback };
  }

  const timeoutMs = options?.timeoutMs ?? 5000;
  const html = await fetchHtmlWithTimeout(normalizedUrl, timeoutMs);
  const title = html ? extractTitle(html) : null;
  const finalTitle = title && title.length > 0 ? title : deriveFallbackTitleFromUrl(normalizedUrl);

  cache.set(normalizedUrl, {
    title: finalTitle,
    expiresAtMs: Date.now() + (title && title.length > 0 ? TITLE_CACHE_TTL_MS : TITLE_RETRY_TTL_MS),
  });
  return { url: normalizedUrl, title: finalTitle };
};

export const resolvePageTitles = async (
  urls: string[],
  options?: { concurrency?: number; timeoutMs?: number; maxUrls?: number },
): Promise<Map<string, string>> => {
  const concurrency = Math.max(1, Math.min(10, options?.concurrency ?? 6));
  const timeoutMs = options?.timeoutMs ?? 5000;
  const maxUrls = Math.max(1, Math.min(100, options?.maxUrls ?? 50));

  const uniqueUrls = Array.from(
    new Set(urls.map((u) => normalizeUrlForCache(u)).filter((u) => u.trim() !== "")),
  ).slice(0, maxUrls);

  const results = new Map<string, string>();
  let index = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = index;
      index += 1;
      const url = uniqueUrls[currentIndex];
      if (!url) return;
      const { title } = await resolvePageTitle(url, { timeoutMs });
      results.set(url, title);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueUrls.length) }, () => worker()));
  return results;
};
