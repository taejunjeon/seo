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
      const extractTypes = (obj: Record<string, unknown>) => {
        if (obj["@type"]) {
          const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
          schemaTypes.push(...(types as string[]));
        }
        if (obj["@graph"] && Array.isArray(obj["@graph"])) {
          for (const item of obj["@graph"]) {
            extractTypes(item as Record<string, unknown>);
          }
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
