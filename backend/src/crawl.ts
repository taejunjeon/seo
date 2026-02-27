import * as cheerio from "cheerio";

/* ═══════════════════════════════════════
   페이지 크롤링 — Schema + 콘텐츠 구조 분석
   ═══════════════════════════════════════ */

export type SchemaInfo = {
  types: string[];          // 발견된 Schema 타입: FAQPage, HowTo, Article 등
  hasFAQ: boolean;
  hasHowTo: boolean;
  hasArticle: boolean;
  hasMedical: boolean;
  hasAuthor: boolean;
  hasSpeakable: boolean;
  rawCount: number;         // JSON-LD 블록 수
};

export type ContentStructure = {
  h2Count: number;
  h3Count: number;
  listCount: number;        // ul + ol
  tableCount: number;
  blockquoteCount: number;
  imgCount: number;
  imgWithAlt: number;
  wordCount: number;
  hasMetaDescription: boolean;
  metaDescLength: number;
};

export type CrawlResult = {
  url: string;
  schema: SchemaInfo;
  content: ContentStructure;
  crawledAt: string;
};

/**
 * URL을 크롤링하여 Schema 마크업과 콘텐츠 구조를 분석합니다.
 */
export const crawlAndAnalyze = async (url: string): Promise<CrawlResult> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BiocomAI-SEO-Crawler/1.0",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // ── Schema 분석 (JSON-LD) ──
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");

      // JSON-LD는 @type이 중첩(author 안의 Person 등)될 수 있어 전체 트리를 순회합니다.
      const extractTypes = (node: unknown, depth: number = 0) => {
        if (depth > 20) return;
        if (!node) return;

        if (Array.isArray(node)) {
          for (const item of node) extractTypes(item, depth + 1);
          return;
        }

        if (typeof node !== "object") return;
        const obj = node as Record<string, unknown>;

        const t = obj["@type"];
        if (typeof t === "string") schemaTypes.push(t);
        else if (Array.isArray(t)) {
          for (const tt of t) {
            if (typeof tt === "string") schemaTypes.push(tt);
          }
        }

        // @graph도 일반 속성으로 순회하되, 명시적으로 한번 더 커버합니다.
        const graph = obj["@graph"];
        if (Array.isArray(graph)) {
          for (const item of graph) extractTypes(item, depth + 1);
        }

        for (const value of Object.values(obj)) {
          extractTypes(value, depth + 1);
        }
      };

      extractTypes(data);
    } catch {
      // invalid JSON-LD, skip
    }
  });

  // microdata fallback
  $("[itemtype]").each((_, el) => {
    const itemtype = $(el).attr("itemtype") ?? "";
    const typeName = itemtype.split("/").pop();
    if (typeName) schemaTypes.push(typeName);
  });

  const typesLower = schemaTypes.map((t) => t.toLowerCase());
  const schema: SchemaInfo = {
    types: [...new Set(schemaTypes)],
    hasFAQ: typesLower.some((t) => t.includes("faq")),
    hasHowTo: typesLower.some((t) => t.includes("howto")),
    hasArticle: typesLower.some((t) => t.includes("article")),
    hasMedical: typesLower.some((t) => t.includes("medical") || t.includes("health")),
    hasAuthor: typesLower.some((t) => t.includes("person")) || !!$('[itemprop="author"]').length,
    hasSpeakable: typesLower.some((t) => t.includes("speakable")),
    rawCount: $('script[type="application/ld+json"]').length,
  };

  // ── 콘텐츠 구조 분석 ──
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";

  const content: ContentStructure = {
    h2Count: $("h2").length,
    h3Count: $("h3").length,
    listCount: $("ul").length + $("ol").length,
    tableCount: $("table").length,
    blockquoteCount: $("blockquote").length,
    imgCount: $("img").length,
    imgWithAlt: $("img[alt]").filter((_, el) => ($(el).attr("alt") ?? "").trim().length > 0).length,
    wordCount: bodyText.split(/\s+/).length,
    hasMetaDescription: metaDesc.length > 0,
    metaDescLength: metaDesc.length,
  };

  return {
    url,
    schema,
    content,
    crawledAt: new Date().toISOString(),
  };
};

/* ═══════════════════════════════════════
   하위 페이지 링크 추출
   ═══════════════════════════════════════ */

export type SubpageLink = {
  url: string;
  title: string;
};

/**
 * 부모 URL을 크롤링하여 동일 도메인 하위 페이지 링크를 추출합니다.
 * @param parentUrl 부모 URL
 * @param maxLinks 최대 추출 링크 수 (기본 50)
 */
export const discoverSubpages = async (parentUrl: string, maxLinks = 50): Promise<SubpageLink[]> => {
  const response = await fetch(parentUrl, {
    headers: {
      "User-Agent": "BiocomAI-SEO-Crawler/1.0",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${parentUrl}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const parentUrlObj = new URL(parentUrl);
  const parentHost = parentUrlObj.hostname;
  const parentPath = parentUrlObj.pathname.replace(/\/$/, "");

  const seen = new Set<string>();
  const links: SubpageLink[] = [];

  $("a[href]").each((_, el) => {
    if (links.length >= maxLinks) return false;

    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim().replace(/\s+/g, " ").slice(0, 120);
    if (!href || !title) return;

    try {
      const resolved = new URL(href, parentUrl);
      // 동일 호스트만
      if (resolved.hostname !== parentHost) return;
      const resolvedPath = resolved.pathname.replace(/\/$/, "");
      // 부모 경로 하위이거나, 동일 경로이지만 쿼리 파라미터가 다른 경우
      const isSamePath = resolvedPath === parentPath;
      const isSubPath = resolvedPath.startsWith(parentPath + "/");
      if (!isSamePath && !isSubPath) return;
      // 자기 자신 제외 (경로+쿼리 모두 동일)
      if (isSamePath && resolved.search === parentUrlObj.search) return;
      // 동일 경로이면 쿼리 파라미터가 있어야 하위 페이지로 간주
      if (isSamePath && !resolved.search) return;

      const fullUrl = resolved.href;
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      // 파일 확장자 필터 (이미지, PDF 등 제외)
      if (/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js)$/i.test(resolvedPath)) return;

      links.push({ url: fullUrl, title });
    } catch {
      // 잘못된 URL 무시
    }
  });

  return links;
};
