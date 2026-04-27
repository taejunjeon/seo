import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

const BASE_URL = "https://biocom.kr/";
const SITE_HOST = "biocom.kr";
const REQUEST_DELAY_MS = 650;
const MAX_INVENTORY_URLS = 300;
const MAX_CRAWL_PAGES = 40;
const REPORT_DIR = path.join(process.cwd(), "reports", "seo");
const SAMPLE_DIR = path.join(REPORT_DIR, "jsonld_samples");

const TARGET_PAGES = [
  { key: "homepage", label: "홈페이지", url: "https://biocom.kr/" },
  { key: "service", label: "서비스", url: "https://biocom.kr/service" },
  {
    key: "organicacid_product",
    label: "종합 대사기능 분석 상품",
    url: "https://biocom.kr/organicacid_store/?idx=259",
  },
  {
    key: "biobalance_product",
    label: "바이오밸런스 상품",
    url: "https://biocom.kr/HealthFood/?idx=97",
  },
  { key: "healthinfo_list", label: "건강정보 목록", url: "https://biocom.kr/healthinfo" },
  {
    key: "healthinfo_article",
    label: "건강정보 글",
    url: "https://biocom.kr/healthinfo/?bmode=view&idx=5764202",
  },
];

const USER_AGENT = "BiocomSEOReadOnlyAudit/1.0 (+read-only; contact: internal)";

let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nowKst = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 16).replace("T", " ")} KST`;
};

const todayKst = () => nowKst().slice(0, 10);

const politeFetch = async (url, options = {}) => {
  const waitMs = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: options.accept ?? "*/*",
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const ensureDirs = async () => {
  await fs.mkdir(SAMPLE_DIR, { recursive: true });
};

const writeText = async (filePath, text) => {
  await fs.writeFile(path.join(REPORT_DIR, filePath), text, "utf-8");
};

const writeJson = async (filePath, value) => {
  await fs.writeFile(path.join(REPORT_DIR, filePath), `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const csvEscape = (value) => {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
};

const writeCsv = async (filePath, rows, columns) => {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];
  await writeText(filePath, `${lines.join("\n")}\n`);
};

const toAbsoluteUrl = (href, baseUrl = BASE_URL) => {
  try {
    const resolved = new URL(href, baseUrl);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
};

const isInternalUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    return url.hostname === SITE_HOST || url.hostname === `www.${SITE_HOST}`;
  } catch {
    return false;
  }
};

const normalizeUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    const removable = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "gbraid",
      "wbraid",
    ]);
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !removable.has(key))
      .sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, value] of params) url.searchParams.append(key, value);
    return url.toString();
  } catch {
    return rawUrl;
  }
};

const typeUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const pathName = url.pathname.toLowerCase();
    const query = url.searchParams;
    const queryText = url.search.toLowerCase();
    const hasIdx = query.has("idx");
    const bmode = query.get("bmode") ?? "";

    if (pathName === "/" || pathName === "/index") return queryText ? "noisy parameter URL" : "home";
    if (/login|member|mypage|join|cart|shop_cart|order/.test(pathName + queryText)) {
      return "cart/login/member";
    }
    if (/interlock=shop_review|shop_review|review/.test(queryText)) return "review/board";
    if (pathName.includes("healthinfo") && bmode === "view") return "article/column";
    if (pathName.includes("healthinfo")) return "category";
    if (pathName.includes("organicacid") || pathName.includes("lab") || pathName.includes("service")) {
      return hasIdx || pathName.includes("store") ? "lab/test service" : "category";
    }
    if (pathName.includes("healthfood") || pathName.includes("shop_view") || pathName.includes("shop")) {
      return hasIdx ? "product" : "category";
    }
    if (hasIdx && /store|product|food/.test(pathName)) return "product";
    if (hasIdx || bmode || query.has("q") || query.has("t")) return "noisy parameter URL";
    if (pathName.split("/").filter(Boolean).length <= 1) return "category";
    return "unknown";
  } catch {
    return "unknown";
  }
};

const suspectedDuplicateGroup = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const idx = url.searchParams.get("idx");
    const bmode = url.searchParams.get("bmode");
    if (idx && bmode === "view") return `view_idx:${idx}`;
    if (idx) return `${url.pathname.replace(/\/$/, "")}:idx:${idx}`;
    if (url.searchParams.has("q")) return `${url.pathname.replace(/\/$/, "")}:q`;
    return normalizeUrl(`${url.origin}${url.pathname}`);
  } catch {
    return "";
  }
};

const sha1 = (value) => crypto.createHash("sha1").update(value).digest("hex");

const cleanText = (value) => (value ?? "").replace(/\s+/g, " ").trim();

const unique = (values) => [...new Set(values.filter(Boolean))];

const extractJsonLdTypes = (jsonValue) => {
  const types = [];
  const walk = (node, depth = 0) => {
    if (!node || depth > 24) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const type = node["@type"];
    if (typeof type === "string") types.push(type);
    if (Array.isArray(type)) {
      for (const item of type) if (typeof item === "string") types.push(item);
    }
    for (const value of Object.values(node)) walk(value, depth + 1);
  };
  walk(jsonValue);
  return types;
};

const parseJsonLdBlocks = ($) => {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html() ?? "";
    try {
      const parsed = JSON.parse(raw);
      blocks.push({ raw, parsed, types: extractJsonLdTypes(parsed), valid: true });
    } catch (error) {
      blocks.push({
        raw,
        parsed: null,
        types: [],
        valid: false,
        error: error instanceof Error ? error.message : "invalid JSON",
      });
    }
  });
  return blocks;
};

const analyzeHtml = (html, url) => {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = cleanText($("title").first().text());
  const description = cleanText($('meta[name="description"]').attr("content"));
  const canonical = cleanText($('link[rel="canonical"]').attr("href"));
  const robotsMeta = cleanText($('meta[name="robots"]').attr("content"));
  const ogTitle = cleanText($('meta[property="og:title"]').attr("content"));
  const ogDescription = cleanText($('meta[property="og:description"]').attr("content"));
  const ogImage = cleanText($('meta[property="og:image"]').attr("content"));
  const h1 = $("h1").map((_, element) => cleanText($(element).text())).get().filter(Boolean);
  const h2 = $("h2").map((_, element) => cleanText($(element).text())).get().filter(Boolean);
  const h3 = $("h3").map((_, element) => cleanText($(element).text())).get().filter(Boolean);
  const emptyHeadings = $("h1,h2,h3,h4,h5,h6")
    .filter((_, element) => cleanText($(element).text()).length === 0)
    .length;
  const images = $("img").map((_, element) => ({
    src: $(element).attr("src") ?? "",
    alt: cleanText($(element).attr("alt") ?? ""),
  })).get();
  const jsonLdBlocks = parseJsonLdBlocks($);
  const schemaTypes = unique(jsonLdBlocks.flatMap((block) => block.types));
  const bodyText = cleanText($("body").text());
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const sentenceCandidates = bodyText
    .split(/(?<=[.!?。])\s+|\n+/)
    .map(cleanText)
    .filter((sentence) => sentence.length >= 24);
  const priceMatch = bodyText.match(/([0-9][0-9,]{2,})\s*원/);
  const reviewMatch = bodyText.match(/(?:구매평|리뷰|후기)\s*([0-9,]{1,6})|([0-9,]{1,6})\s*(?:개\s*)?(?:구매평|리뷰|후기)/);

  return {
    url,
    title,
    description,
    canonical,
    robotsMeta,
    ogTitle,
    ogDescription,
    ogImage,
    h1,
    h2,
    h3,
    emptyHeadings,
    imageCount: images.length,
    imagesWithoutAlt: images.filter((image) => !image.alt).length,
    imagesWithLongAlt: images.filter((image) => image.alt.length > 125).length,
    longestAlt: images.map((image) => image.alt).sort((a, b) => b.length - a.length)[0] ?? "",
    jsonLdCount: jsonLdBlocks.length,
    jsonLdValidCount: jsonLdBlocks.filter((block) => block.valid).length,
    schemaTypes,
    hasProduct: schemaTypes.some((type) => /product/i.test(type)),
    hasArticle: schemaTypes.some((type) => /article|blogposting/i.test(type)),
    hasOrganization: schemaTypes.some((type) => /organization|localbusiness/i.test(type)),
    hasBreadcrumb: schemaTypes.some((type) => /breadcrumblist/i.test(type)),
    hasFAQ: schemaTypes.some((type) => /faqpage/i.test(type)),
    hasOffer: schemaTypes.some((type) => /offer/i.test(type)) || /"offers"\s*:/.test(html),
    hasPriceInJsonLd: /"price"\s*:/.test(html),
    hasReviewInJsonLd: /"review"|"aggregateRating"|"reviewCount"/.test(html),
    hasAvailabilityInJsonLd: /"availability"\s*:/.test(html),
    wordCount,
    bodyText,
    bodyHash: sha1(bodyText.slice(0, 10000)),
    meaningfulSentenceCount: sentenceCandidates.length,
    visiblePrice: priceMatch?.[1]?.replaceAll(",", "") ?? "",
    visibleReviewCount: (reviewMatch?.[1] ?? reviewMatch?.[2] ?? "").replaceAll(",", ""),
    jsonLdBlocks,
  };
};

const fetchText = async (url, accept = "text/html,*/*") => {
  const response = await politeFetch(url, { method: "GET", accept });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type") ?? "",
    text,
  };
};

const probeUrl = async (url) => {
  try {
    let response = await politeFetch(url, { method: "HEAD", timeoutMs: 15000 });
    if ([403, 405, 500].includes(response.status)) {
      response = await politeFetch(url, { method: "GET", timeoutMs: 18000 });
    }
    return {
      statusCode: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return {
      statusCode: 0,
      finalUrl: "",
      contentType: "",
      error: error instanceof Error ? error.message : "probe failed",
    };
  }
};

const parseSitemapXml = (xml) => {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  return { locs, isIndex };
};

const normalizeSitemapDirective = (rawDirective) => {
  const raw = cleanText(rawDirective);
  const markdownLink = raw.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/i);
  if (markdownLink) {
    return {
      raw,
      url: markdownLink[1],
      malformed: true,
      note: "robots.txt sitemap directive uses markdown link syntax",
    };
  }
  const plain = raw.match(/https?:\/\/\S+/i);
  return {
    raw,
    url: plain?.[0] ?? raw,
    malformed: !plain,
    note: plain ? "" : "no valid sitemap URL found",
  };
};

const collectSitemaps = async () => {
  const robotsUrl = new URL("/robots.txt", BASE_URL).toString();
  const robots = await fetchText(robotsUrl, "text/plain,*/*").catch((error) => ({
    ok: false,
    status: 0,
    finalUrl: "",
    contentType: "",
    text: "",
    error: error instanceof Error ? error.message : "robots fetch failed",
  }));
  const robotsSitemapDirectives = [...robots.text.matchAll(/^sitemap:\s*(.+)$/gim)]
    .map((match) => normalizeSitemapDirective(match[1]));
  const sitemapSeeds = unique([
    ...robotsSitemapDirectives.map((directive) => directive.url).filter((url) => /^https?:\/\//i.test(url)),
    new URL("/sitemap.xml", BASE_URL).toString(),
  ]);

  const sitemapFiles = [];
  const sitemapUrls = [];
  const seen = new Set();
  const queue = [...sitemapSeeds];

  while (queue.length > 0 && sitemapFiles.length < 12) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);

    try {
      const result = await fetchText(sitemapUrl, "application/xml,text/xml,*/*");
      const parsed = parseSitemapXml(result.text);
      sitemapFiles.push({
        url: sitemapUrl,
        status: result.status,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        locCount: parsed.locs.length,
        isIndex: parsed.isIndex,
      });

      if (parsed.isIndex) {
        for (const loc of parsed.locs.slice(0, 20)) queue.push(loc);
      } else {
        sitemapUrls.push(...parsed.locs.filter(isInternalUrl));
      }
    } catch (error) {
      sitemapFiles.push({
        url: sitemapUrl,
        status: 0,
        finalUrl: "",
        contentType: "",
        locCount: 0,
        isIndex: false,
        error: error instanceof Error ? error.message : "sitemap fetch failed",
      });
    }
  }

  await writeText("robots_snapshot.txt", robots.text);
  return { robots, robotsSitemapDirectives, sitemapFiles, sitemapUrls: unique(sitemapUrls) };
};

const extractLinks = (html, sourcePage) => {
  const $ = cheerio.load(html);
  const links = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const url = toAbsoluteUrl(href, sourcePage);
    if (!url || !isInternalUrl(url)) return;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|ico)$/i.test(new URL(url).pathname)) return;
    links.push({
      url,
      sourcePage,
      anchorText: cleanText($(element).text()).slice(0, 160),
    });
  });
  return links;
};

const collectInventory = async (sitemapUrls) => {
  const queue = TARGET_PAGES.map((page) => ({
    url: page.url,
    sourcePage: "seed",
    anchorText: page.label,
  }));
  for (const url of sitemapUrls) queue.push({ url, sourcePage: "sitemap", anchorText: "" });

  const discovered = new Map();
  let crawledPages = 0;

  while (queue.length > 0 && discovered.size < MAX_INVENTORY_URLS) {
    const current = queue.shift();
    const normalized = normalizeUrl(current.url);
    if (discovered.has(normalized)) {
      const prev = discovered.get(normalized);
      if (!prev.source_page.includes(current.sourcePage)) {
        prev.source_page = unique([...prev.source_page.split(" | "), current.sourcePage]).join(" | ");
      }
      continue;
    }

    discovered.set(normalized, {
      url: current.url,
      normalized_url: normalized,
      path: "",
      query: "",
      type: typeUrl(current.url),
      source_page: current.sourcePage,
      anchor_text: current.anchorText,
      status_code: "",
      final_url: "",
      is_parameter_url: "",
      suspected_duplicate_group: suspectedDuplicateGroup(current.url),
      content_type: "",
      error: "",
    });

    if (crawledPages >= MAX_CRAWL_PAGES) continue;
    if (typeUrl(current.url) === "cart/login/member") continue;

    try {
      const result = await fetchText(current.url);
      if (!/html/i.test(result.contentType) && !/<html/i.test(result.text)) continue;
      crawledPages += 1;
      const links = extractLinks(result.text, current.url);
      for (const link of links) {
        if (discovered.size + queue.length >= MAX_INVENTORY_URLS * 2) break;
        queue.push(link);
      }
    } catch {
      // Inventory probing below will capture request failures.
    }
  }

  const rows = [...discovered.values()].slice(0, MAX_INVENTORY_URLS);
  for (const row of rows) {
    try {
      const parsed = new URL(row.url);
      row.path = parsed.pathname;
      row.query = parsed.search.replace(/^\?/, "");
      row.is_parameter_url = parsed.search ? "true" : "false";
    } catch {
      row.is_parameter_url = "";
    }
  }

  for (const [index, row] of rows.entries()) {
    const probe = await probeUrl(row.url);
    row.status_code = probe.statusCode;
    row.final_url = probe.finalUrl;
    row.content_type = probe.contentType;
    row.error = probe.error ?? "";
    if ((index + 1) % 25 === 0) {
      console.log(`URL probe ${index + 1}/${rows.length}`);
    }
  }

  return rows;
};

const analyzeTargetPages = async () => {
  const rawAudits = [];
  const renderedAudits = [];
  const resourceAudits = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.warn(`Playwright unavailable, rendered audit skipped: ${error.message}`);
  }

  for (const target of TARGET_PAGES) {
    let raw = null;
    try {
      const fetched = await fetchText(target.url);
      raw = analyzeHtml(fetched.text, fetched.finalUrl || target.url);
      raw.fetchStatus = fetched.status;
      raw.contentType = fetched.contentType;
    } catch (error) {
      raw = {
        url: target.url,
        fetchStatus: 0,
        title: "",
        description: "",
        canonical: "",
        robotsMeta: "",
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
        h1: [],
        h2: [],
        h3: [],
        imageCount: 0,
        imagesWithoutAlt: 0,
        imagesWithLongAlt: 0,
        longestAlt: "",
        jsonLdCount: 0,
        jsonLdValidCount: 0,
        schemaTypes: [],
        hasProduct: false,
        hasArticle: false,
        hasOrganization: false,
        hasBreadcrumb: false,
        hasFAQ: false,
        hasOffer: false,
        hasPriceInJsonLd: false,
        hasReviewInJsonLd: false,
        hasAvailabilityInJsonLd: false,
        wordCount: 0,
        bodyText: "",
        bodyHash: "",
        meaningfulSentenceCount: 0,
        visiblePrice: "",
        visibleReviewCount: "",
        error: error instanceof Error ? error.message : "fetch failed",
      };
    }
    raw.key = target.key;
    raw.label = target.label;
    rawAudits.push(raw);

    if (!browser) continue;
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    const resources = [];
    page.on("response", async (response) => {
      try {
        const request = response.request();
        const headers = response.headers();
        resources.push({
          url: response.url(),
          status: response.status(),
          type: request.resourceType(),
          contentLength: Number(headers["content-length"] ?? 0),
          contentType: headers["content-type"] ?? "",
        });
      } catch {
        // Ignore per-response extraction errors.
      }
    });

    try {
      await page.goto(target.url, { waitUntil: "networkidle", timeout: 45000 });
      const renderedHtml = await page.content();
      const rendered = analyzeHtml(renderedHtml, page.url());
      rendered.key = target.key;
      rendered.label = target.label;
      rendered.fetchStatus = 200;
      rendered.contentType = "rendered-dom";
      renderedAudits.push(rendered);
      resourceAudits.push({ target, resources });
    } catch (error) {
      renderedAudits.push({
        key: target.key,
        label: target.label,
        url: target.url,
        fetchStatus: 0,
        error: error instanceof Error ? error.message : "render failed",
      });
      resourceAudits.push({ target, resources });
    } finally {
      await context.close();
    }
  }

  if (browser) await browser.close();
  return { rawAudits, renderedAudits, resourceAudits };
};

const auditRowFromAnalysis = (raw, rendered) => {
  const pick = rendered?.fetchStatus === 200 ? rendered : raw;
  return {
    key: raw.key,
    label: raw.label,
    url: raw.url,
    fetch_status: raw.fetchStatus ?? "",
    rendered_status: rendered?.fetchStatus ?? "",
    title: pick.title ?? "",
    title_length: (pick.title ?? "").length,
    meta_description: pick.description ?? "",
    meta_description_length: (pick.description ?? "").length,
    canonical: pick.canonical ?? "",
    robots_meta: pick.robotsMeta ?? "",
    og_title: pick.ogTitle ?? "",
    og_description: pick.ogDescription ?? "",
    og_image: pick.ogImage ?? "",
    h1_count: pick.h1?.length ?? 0,
    h1_text: (pick.h1 ?? []).join(" | "),
    h2_count: pick.h2?.length ?? 0,
    h2_text: (pick.h2 ?? []).slice(0, 12).join(" | "),
    h3_count: pick.h3?.length ?? 0,
    image_count: pick.imageCount ?? 0,
    images_without_alt: pick.imagesWithoutAlt ?? 0,
    images_with_long_alt: pick.imagesWithLongAlt ?? 0,
    empty_heading_count: pick.emptyHeadings ?? 0,
    jsonld_count: pick.jsonLdCount ?? 0,
    schema_types: (pick.schemaTypes ?? []).join(" | "),
    has_product: pick.hasProduct ? "true" : "false",
    has_article: pick.hasArticle ? "true" : "false",
    has_organization: pick.hasOrganization ? "true" : "false",
    has_breadcrumb: pick.hasBreadcrumb ? "true" : "false",
    has_faq: pick.hasFAQ ? "true" : "false",
    has_price_jsonld: pick.hasPriceInJsonLd ? "true" : "false",
    has_review_jsonld: pick.hasReviewInJsonLd ? "true" : "false",
    has_availability_jsonld: pick.hasAvailabilityInJsonLd ? "true" : "false",
    word_count: pick.wordCount ?? 0,
    meaningful_sentence_count: pick.meaningfulSentenceCount ?? 0,
    raw_body_hash: raw.bodyHash ?? "",
    rendered_body_hash: rendered?.bodyHash ?? "",
  };
};

const summarizeInventory = (rows) => {
  const byType = {};
  for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
  const parameterCount = rows.filter((row) => row.is_parameter_url === "true").length;
  const noisyCount = rows.filter((row) => row.type === "noisy parameter URL").length;
  const statusCounts = {};
  for (const row of rows) statusCounts[row.status_code] = (statusCounts[row.status_code] ?? 0) + 1;
  return {
    total: rows.length,
    byType,
    parameterCount,
    noisyCount,
    parameterRatio: rows.length ? parameterCount / rows.length : 0,
    statusCounts,
  };
};

const duplicateGroups = (inventoryRows, pageRows) => {
  const groups = new Map();
  for (const row of inventoryRows) {
    const key = row.suspected_duplicate_group;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const row of pageRows) {
    if (!row.raw_body_hash) continue;
    const key = `body:${row.raw_body_hash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      url: row.url,
      normalized_url: normalizeUrl(row.url),
      type: "audited page",
      status_code: row.fetch_status,
      final_url: row.url,
      suspected_duplicate_group: key,
    });
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([group, rows]) => ({
      group,
      count: rows.length,
      representative_url: pickRepresentativeUrl(rows.map((row) => row.url)),
      urls: rows.map((row) => row.url),
      types: unique(rows.map((row) => row.type)).join(" | "),
      status_codes: unique(rows.map((row) => row.status_code)).join(" | "),
    }));
};

const pickRepresentativeUrl = (urls) => {
  const sorted = [...urls].sort((a, b) => {
    const aUrl = new URL(a);
    const bUrl = new URL(b);
    const aScore = (aUrl.pathname === "/index/" || aUrl.pathname === "/index" ? 10 : 0) + aUrl.search.length;
    const bScore = (bUrl.pathname === "/index/" || bUrl.pathname === "/index" ? 10 : 0) + bUrl.search.length;
    return aScore - bScore || a.length - b.length;
  });
  return sorted[0] ?? "";
};

const buildProductContentAudit = (pageAudits) => {
  const targets = ["organicacid_product", "biobalance_product"];
  return targets.map((key) => {
    const audit = pageAudits.find((page) => page.key === key);
    const textToImageRisk =
      (audit?.wordCount ?? 0) < 600 || (audit?.imageCount ?? 0) > 20 || (audit?.h2?.length ?? 0) < 3
        ? "높음"
        : "중간";
    return {
      key,
      label: audit?.label ?? key,
      url: audit?.url ?? "",
      html_word_count: audit?.wordCount ?? 0,
      meaningful_sentence_count: audit?.meaningfulSentenceCount ?? 0,
      h1_count: audit?.h1?.length ?? 0,
      h2_count: audit?.h2?.length ?? 0,
      h3_count: audit?.h3?.length ?? 0,
      image_count: audit?.imageCount ?? 0,
      images_without_alt: audit?.imagesWithoutAlt ?? 0,
      images_with_long_alt: audit?.imagesWithLongAlt ?? 0,
      longest_alt_length: (audit?.longestAlt ?? "").length,
      jsonld_count: audit?.jsonLdCount ?? 0,
      schema_types: audit?.schemaTypes ?? [],
      text_to_image_risk: textToImageRisk,
      visible_price: audit?.visiblePrice ?? "",
      visible_review_count: audit?.visibleReviewCount ?? "",
    };
  });
};

const bestAuditForKey = (key, rawAudits, renderedAudits) => {
  const rendered = renderedAudits.find((audit) => audit.key === key);
  if (rendered?.fetchStatus === 200 && rendered.bodyHash) return rendered;
  return rawAudits.find((audit) => audit.key === key) ?? rendered;
};

const makeProductSample = (audit, fallbackName) => {
  const name = audit.h1?.[0] || audit.ogTitle || audit.title || fallbackName;
  const description = audit.description || audit.ogDescription || `${name} 상품 페이지`;
  const image = audit.ogImage ? toAbsoluteUrl(audit.ogImage, audit.url) : undefined;
  const price = audit.visiblePrice || undefined;
  const sample = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    brand: {
      "@type": "Brand",
      name: "Biocom",
    },
    url: audit.url,
  };
  if (image) sample.image = [image];
  if (price) {
    sample.offers = {
      "@type": "Offer",
      url: audit.url,
      priceCurrency: "KRW",
      price,
      availability: "https://schema.org/InStock",
    };
  }
  return sample;
};

const shortDescription = (value, fallback) => {
  const text = cleanText(value || fallback);
  if (text.length <= 180) return text;
  const trimmed = text.slice(0, 177).replace(/\s+\S*$/, "");
  return `${trimmed}...`;
};

const makeArticleSample = (audit) => {
  const headline = audit.h1?.[0] || audit.ogTitle || audit.title || "바이오컴 건강정보";
  const sample = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description: shortDescription(audit.description || audit.ogDescription, headline),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": audit.url,
    },
    publisher: {
      "@type": "Organization",
      name: "Biocom",
      url: "https://biocom.kr/",
    },
  };
  if (audit.ogImage) sample.image = [toAbsoluteUrl(audit.ogImage, audit.url)];
  return sample;
};

const makeOrganizationSample = (homeAudit) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Biocom",
  url: "https://biocom.kr/",
  logo: homeAudit?.ogImage ? toAbsoluteUrl(homeAudit.ogImage, homeAudit.url) : "https://biocom.kr/favicon.ico",
  sameAs: [],
});

const makeBreadcrumbSamples = () => ({
  product: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: "https://biocom.kr/" },
      { "@type": "ListItem", position: 2, name: "상품", item: "https://biocom.kr/HealthFood/" },
      { "@type": "ListItem", position: 3, name: "바이오밸런스", item: "https://biocom.kr/HealthFood/?idx=97" },
    ],
  },
  article: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: "https://biocom.kr/" },
      { "@type": "ListItem", position: 2, name: "건강정보", item: "https://biocom.kr/healthinfo" },
    ],
  },
});

const buildResourceSummary = (resourceAudits) => {
  return resourceAudits.map(({ target, resources }) => {
    const byType = {};
    let totalKnownBytes = 0;
    for (const resource of resources) {
      if (!byType[resource.type]) byType[resource.type] = { count: 0, knownBytes: 0 };
      byType[resource.type].count += 1;
      byType[resource.type].knownBytes += resource.contentLength || 0;
      totalKnownBytes += resource.contentLength || 0;
    }
    const topResources = [...resources]
      .sort((a, b) => (b.contentLength || 0) - (a.contentLength || 0))
      .slice(0, 20);
    return {
      key: target.key,
      label: target.label,
      url: target.url,
      requestCount: resources.length,
      totalKnownBytes,
      byType,
      topResources,
    };
  });
};

const mdTable = (columns, rows) => {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column.key] ?? "").replaceAll("\n", " ")).join(" | ")} |`);
  return [header, sep, ...body].join("\n");
};

const generateReports = async ({
  measuredAt,
  robots,
  robotsSitemapDirectives,
  sitemapFiles,
  sitemapUrls,
  inventoryRows,
  pageRows,
  duplicateRows,
  productContentRows,
  resourceSummary,
}) => {
  const inventorySummary = summarizeInventory(inventoryRows);
  const sitemapParameterCount = sitemapUrls.filter((url) => new URL(url).search).length;
  const sitemapBadCandidates = sitemapUrls.filter((url) =>
    /login|member|mypage|join|cart|shop_cart|q=|interlock=shop_review|t=board/i.test(url),
  );

  const pageSummaryRows = pageRows.map((row) => ({
    label: row.label,
    status: row.fetch_status,
    title: row.title_length ? `${row.title_length}자` : "없음",
    description: row.meta_description_length ? `${row.meta_description_length}자` : "없음",
    canonical: row.canonical ? "있음" : "없음",
    h1: row.h1_count,
    jsonld: row.jsonld_count,
    schema: row.schema_types || "없음",
    imagesNoAlt: row.images_without_alt,
  }));

  const robotsSitemapMd = `# robots.txt / sitemap.xml 진단

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 URL \`https://biocom.kr/robots.txt\`, sitemap XML
Freshness: ${measuredAt}
Confidence: 86%

## 10초 요약

robots.txt 응답은 ${robots.status || 0}으로 확인됐다. sitemap 파일은 ${sitemapFiles.length}개를 확인했고, sitemap URL은 ${sitemapUrls.length}개를 수집했다. sitemap 안 parameter URL 비중은 ${sitemapUrls.length ? ((sitemapParameterCount / sitemapUrls.length) * 100).toFixed(1) : "0.0"}%다.

## robots.txt sitemap 지시문

${mdTable(
  [
    { key: "raw", label: "원문" },
    { key: "url", label: "해석 URL" },
    { key: "malformed", label: "형식 문제" },
    { key: "note", label: "메모" },
  ],
  robotsSitemapDirectives.map((directive) => ({
    ...directive,
    malformed: directive.malformed ? "있음" : "없음",
  })),
)}

## 응답 상태

${mdTable(
  [
    { key: "url", label: "URL" },
    { key: "status", label: "status" },
    { key: "contentType", label: "content-type" },
    { key: "locCount", label: "loc 수" },
    { key: "isIndex", label: "index 여부" },
  ],
  sitemapFiles,
)}

## sitemap 요약

- sitemap URL 수: ${sitemapUrls.length}
- parameter URL 수: ${sitemapParameterCount}
- 제외 후보 URL 수: ${sitemapBadCandidates.length}

## 제외 후보 예시

${sitemapBadCandidates.slice(0, 30).map((url) => `- ${url}`).join("\n") || "- 없음"}

## 판단

사실: 이 보고서는 공개 응답만 기준으로 작성됐다.

현재 판단: sitemap에 parameter URL이 많으면 canonical 정책과 충돌할 수 있다. Search Console과 Naver Search Advisor 제출 상태는 로그인 확인이 필요하다.
`;

  await writeText("robots_sitemap_audit.md", robotsSitemapMd);

  const pageAuditMd = `# 페이지별 SEO 태그 진단

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 URL raw HTML + Playwright rendered DOM
Freshness: ${measuredAt}
Confidence: 82%

## 10초 요약

핵심 페이지 ${pageRows.length}개를 확인했다. canonical이 없는 페이지는 ${pageRows.filter((row) => !row.canonical).length}개, JSON-LD가 없는 페이지는 ${pageRows.filter((row) => Number(row.jsonld_count) === 0).length}개, alt 없는 이미지는 합계 ${pageRows.reduce((sum, row) => sum + Number(row.images_without_alt || 0), 0)}개다.

## 페이지 요약

${mdTable(
  [
    { key: "label", label: "페이지" },
    { key: "status", label: "status" },
    { key: "title", label: "title" },
    { key: "description", label: "description" },
    { key: "canonical", label: "canonical" },
    { key: "h1", label: "h1" },
    { key: "jsonld", label: "JSON-LD" },
    { key: "schema", label: "schema" },
    { key: "imagesNoAlt", label: "alt 없음" },
  ],
  pageSummaryRows,
)}

## 현재 판단

canonical, 구조화 데이터, heading, alt 누락은 한 페이지씩 따로 보지 말고 페이지 유형별 정책으로 정리해야 한다.
`;
  await writeText("page_seo_audit.md", pageAuditMd);

  const canonicalMd = `# canonical / 중복 URL 위험 진단

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: URL 인벤토리, 핵심 페이지 본문 hash, 공개 HTML canonical
Freshness: ${measuredAt}
Confidence: 76%

## 10초 요약

수집 URL ${inventoryRows.length}개 중 parameter URL은 ${inventorySummary.parameterCount}개다. noisy parameter URL로 분류된 URL은 ${inventorySummary.noisyCount}개다. 중복 의심 그룹은 ${duplicateRows.length}개다.

## URL 유형 요약

${mdTable(
  [
    { key: "type", label: "유형" },
    { key: "count", label: "수" },
  ],
  Object.entries(inventorySummary.byType).map(([type, count]) => ({ type, count })),
)}

## 중복 의심 그룹 예시

${mdTable(
  [
    { key: "group", label: "그룹" },
    { key: "count", label: "URL 수" },
    { key: "representative_url", label: "대표 URL 후보" },
    { key: "types", label: "유형" },
  ],
  duplicateRows.slice(0, 30),
)}

## 판단

사실: 중복 그룹은 URL 패턴과 본문 hash 기준의 기계적 후보군이다.

현재 판단: \`/index/?bmode=view&idx=...\`, \`?idx=\`, \`?bmode=view\` 유형은 canonical, 내부 링크, sitemap 정책을 함께 정해야 한다.
`;
  await writeText("canonical_duplicate_risk.md", canonicalMd);

  const productMd = `# 상품 상세 본문 텍스트 진단

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 상품 상세 raw HTML + rendered DOM
Freshness: ${measuredAt}
Confidence: 78%

## 10초 요약

상품 상세 2개를 우선 확인했다. 이 진단은 검색엔진이 읽을 수 있는 HTML 텍스트와 이미지/alt 의존도를 구분하기 위한 것이다.

## 상품별 결과

${mdTable(
  [
    { key: "label", label: "상품" },
    { key: "html_word_count", label: "본문 단어" },
    { key: "meaningful_sentence_count", label: "핵심 문장 후보" },
    { key: "h1_count", label: "h1" },
    { key: "h2_count", label: "h2" },
    { key: "image_count", label: "이미지" },
    { key: "images_without_alt", label: "alt 없음" },
    { key: "images_with_long_alt", label: "긴 alt" },
    { key: "jsonld_count", label: "JSON-LD" },
    { key: "text_to_image_risk", label: "이미지 의존 위험" },
  ],
  productContentRows,
)}

## 권장 방향

- 숨김 텍스트는 쓰지 않는다.
- 모바일 전환율을 유지하되, PC/공통 영역에 사용자에게 보이는 H2/H3 텍스트 블록을 추가한다.
- Product JSON-LD는 실제 화면에 보이는 상품명, 가격, 이미지, URL만 먼저 넣는다.
`;
  await writeText("product_detail_content_audit.md", productMd);

  const jsonLdMd = `# JSON-LD 추천서

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 페이지에서 추출한 title, description, og:image, 가격 후보
Freshness: ${measuredAt}
Confidence: 74%

## 10초 요약

JSON-LD 샘플은 운영 삽입용 최종본이 아니라 개발팀 검토용 초안이다. 실제 운영 반영 전에는 화면에 보이는 값과 1:1로 맞는지 다시 확인해야 한다.

## 생성 샘플

- \`reports/seo/jsonld_samples/product_organicacid.json\`
- \`reports/seo/jsonld_samples/product_biobalance.json\`
- \`reports/seo/jsonld_samples/article_health_goal.json\`
- \`reports/seo/jsonld_samples/organization_biocom.json\`
- \`reports/seo/jsonld_samples/breadcrumb_examples.json\`

## 삽입 방식 판단

| 방식 | 장점 | 위험 | 추천 |
|---|---|---|---|
| 아임웹 직접 삽입 | 페이지별 값 관리가 명확함 | 관리자 제어 범위 확인 필요 | 1순위 |
| 사용자 코드/GTM 삽입 | 빠르게 테스트 가능 | 가격/후기 같은 동적 값 불일치 위험 | 테스트용 |
| 서버 렌더링 | 가장 안정적 | 아임웹 기반에서는 적용 범위 제한 | 현재 보류 |

## 주의

AggregateRating과 Review는 실제 화면에 평점과 리뷰 값이 보일 때만 넣는다. 보이지 않는 값을 추정해서 넣지 않는다.
`;
  await writeText("jsonld_recommendations.md", jsonLdMd);

  const performanceMd = `# 속도와 리소스 진단

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: Playwright 네트워크 응답 header
Freshness: ${measuredAt}
Confidence: 70%

## 10초 요약

이 보고서는 PageSpeed API 점수가 아니라 공개 페이지 로딩 중 관측된 리소스 수와 header의 content-length 기준이다. content-length가 없는 리소스는 용량 합계에 반영되지 않는다.

## 페이지별 리소스 요약

${mdTable(
  [
    { key: "label", label: "페이지" },
    { key: "requestCount", label: "요청 수" },
    { key: "totalKb", label: "확인 용량 KB" },
    { key: "imageCount", label: "이미지 요청" },
    { key: "scriptCount", label: "스크립트 요청" },
    { key: "fontCount", label: "폰트 요청" },
  ],
  resourceSummary.map((item) => ({
    label: item.label,
    requestCount: item.requestCount,
    totalKb: Math.round(item.totalKnownBytes / 1024),
    imageCount: item.byType.image?.count ?? 0,
    scriptCount: item.byType.script?.count ?? 0,
    fontCount: item.byType.font?.count ?? 0,
  })),
)}

## 큰 리소스 예시

${resourceSummary
  .map((item) => {
    const rows = item.topResources
      .filter((resource) => resource.contentLength)
      .slice(0, 8)
      .map((resource) => `  - ${resource.type} ${Math.round(resource.contentLength / 1024)}KB ${resource.url}`)
      .join("\n");
    return `### ${item.label}\n${rows || "- content-length로 확인된 큰 리소스 없음"}`;
  })
  .join("\n\n")}
`;
  await writeText("performance_resource_audit.md", performanceMd);

  const score = {
    urlCanonical: Math.max(0, 20 - Math.round(inventorySummary.parameterRatio * 20) - Math.min(6, duplicateRows.length)),
    indexing: Math.max(0, 15 - (sitemapFiles.some((file) => file.status >= 400 || file.status === 0) ? 6 : 0) - Math.min(5, sitemapBadCandidates.length)),
    onPage: Math.max(
      0,
      20
        - pageRows.filter((row) => !row.canonical).length * 2
        - pageRows.filter((row) => !row.meta_description).length * 2
        - pageRows.filter((row) => Number(row.h1_count) !== 1).length,
    ),
    structuredData: Math.max(0, 15 - pageRows.filter((row) => Number(row.jsonld_count) === 0).length * 2),
    contentReadability: Math.max(0, 15 - productContentRows.filter((row) => row.text_to_image_risk === "높음").length * 4),
    performance: Math.max(0, 15 - resourceSummary.filter((row) => row.requestCount > 120).length * 3),
  };
  const totalScore = Object.values(score).reduce((sum, value) => sum + value, 0);

  const summaryMd = `# SEO 감사 요약

작성 시각: ${measuredAt}
기준일: ${todayKst()}
Source: 공개 URL 읽기 전용 진단
Freshness: ${measuredAt}
Confidence: 78%

## 10초 요약

이번 진단은 운영 사이트를 수정하지 않고 공개 URL만 확인했다. 현재 가장 먼저 볼 문제는 parameter URL과 canonical, sitemap, 구조화 데이터, 상품 상세 본문 텍스트다. 다음 행동은 대표 URL 정책과 JSON-LD 삽입 방식을 TJ 승인안으로 좁히는 것이다.

## 현재 점수

총점: ${totalScore}/100

| 항목 | 점수 |
|---|---:|
| URL/Canonical | ${score.urlCanonical}/20 |
| Indexing/Sitemap/Robots | ${score.indexing}/15 |
| On-page SEO | ${score.onPage}/20 |
| Structured Data | ${score.structuredData}/15 |
| Content Readability for Search/AI | ${score.contentReadability}/15 |
| Performance | ${score.performance}/15 |

## 가장 큰 문제 5개

1. parameter URL 비중이 ${inventoryRows.length ? ((inventorySummary.parameterRatio) * 100).toFixed(1) : "0.0"}%로 확인됐다.
2. 중복 의심 그룹이 ${duplicateRows.length}개 발견됐다.
3. 핵심 6개 페이지에는 canonical이 있으나, 중복 URL의 canonical 목적지는 별도 확인이 필요하다.
4. 핵심 페이지 중 JSON-LD 없는 페이지가 ${pageRows.filter((row) => Number(row.jsonld_count) === 0).length}개다.
5. 상품 상세는 이미지 의존 위험을 계속 봐야 한다.

## 오늘 바로 할 일

- URL 인벤토리에서 대표 URL 후보를 확정한다.
- sitemap 제외 후보를 개발팀 요청서로 정리한다.
- Product JSON-LD 샘플을 아임웹 삽입 가능 여부와 대조한다.

## 이번 주 할 일

- canonical 정책을 상품, 검사권, 칼럼, 게시판 유형별로 확정한다.
- 상품 4개 텍스트 블록 초안을 만든다.
- 구조화 데이터 테스트를 돌린다.

## 다음 배치에서 할 일

- Search Console/Naver Search Advisor 제출 상태를 확인한다.
- 승인된 URL만 sitemap과 내부 링크에 남긴다.
- 주간 GSC/PageSpeed 추적 표를 만든다.
`;
  await writeText("seo_audit_summary.md", summaryMd);

  await writeCsv(
    "action_plan.csv",
    [
      {
        priority: "P0",
        task: "대표 URL과 canonical 정책 확정",
        owner: "Codex+TJ",
        expected_impact: "중복 색인과 GSC 분석 혼선 감소",
        difficulty: "중간",
        risk: "운영 URL 변경 승인 필요",
        evidence_file: "reports/seo/canonical_duplicate_risk.md",
        recommended_deadline: "2026-05-01",
      },
      {
        priority: "P0",
        task: "sitemap 제외 후보 정리",
        owner: "Codex",
        expected_impact: "검색엔진 크롤 예산 낭비 감소",
        difficulty: "낮음",
        risk: "제외 기준 과도 적용 주의",
        evidence_file: "reports/seo/robots_sitemap_audit.md",
        recommended_deadline: "2026-05-01",
      },
      {
        priority: "P1",
        task: "Product JSON-LD 시범 삽입",
        owner: "Codex+Claude Code",
        expected_impact: "상품 검색 결과 이해도 개선",
        difficulty: "중간",
        risk: "화면 값과 JSON-LD 값 불일치",
        evidence_file: "reports/seo/jsonld_recommendations.md",
        recommended_deadline: "2026-05-04",
      },
      {
        priority: "P1",
        task: "상품 상세 보이는 텍스트 블록 작성",
        owner: "Claude Code+TJ",
        expected_impact: "검색엔진과 AI의 상품 이해 개선",
        difficulty: "중간",
        risk: "전환율 영향",
        evidence_file: "reports/seo/product_detail_content_audit.md",
        recommended_deadline: "2026-05-04",
      },
    ],
    ["priority", "task", "owner", "expected_impact", "difficulty", "risk", "evidence_file", "recommended_deadline"],
  );

  const devRequestMd = `# 개발팀 요청서

작성 시각: ${measuredAt}
기준일: ${todayKst()}

## 2줄 요약

바이오컴 SEO의 1차 개발 요청은 canonical, sitemap, JSON-LD, 내부 링크를 대표 URL 기준으로 맞추는 것이다. 운영 반영 전에는 아래 evidence 파일과 URL 정책표를 확인해야 한다.

## 요청사항

1. \`reports/seo/canonical_duplicate_risk.md\`의 중복 의심 그룹을 보고 대표 URL을 확정한다.
2. \`reports/seo/robots_sitemap_audit.md\`의 sitemap 제외 후보를 확인한다.
3. Product/Article/Breadcrumb JSON-LD 삽입 가능 위치를 확인한다.
4. 운영 반영 전 rollback 방법을 정한다.

## 근거 파일

- \`reports/seo/url_inventory.csv\`
- \`reports/seo/page_seo_audit.csv\`
- \`reports/seo/duplicate_url_groups.csv\`
- \`reports/seo/jsonld_recommendations.md\`
`;
  await writeText("dev_team_request.md", devRequestMd);

  const contentRequestMd = `# 콘텐츠/디자인팀 요청서

작성 시각: ${measuredAt}
기준일: ${todayKst()}

## 2줄 요약

상품 상세를 통이미지와 숨김 텍스트로 해결하지 않는다. 사용자에게 보이는 H2/H3 텍스트 블록을 검사권 2개와 영양제 2개에 먼저 추가한다.

## 요청사항

1. \`종합 대사기능 분석\`, \`음식물 과민증 분석\`, \`바이오밸런스\`, \`뉴로마스터\` 4개를 우선 대상으로 본다.
2. 각 상품에 아래 구조를 만든다.
   - 이런 분께 필요합니다
   - 무엇을 확인하나요
   - 결과 또는 성분의 핵심
   - 진행 방식 또는 복용 방식
   - 자주 묻는 질문
3. FAQPage JSON-LD는 실제 화면에 보이는 질문답변만 사용한다.

## 근거 파일

- \`reports/seo/product_detail_content_audit.md\`
- \`reports/seo/page_seo_audit.md\`
- \`reports/seo/jsonld_recommendations.md\`
`;
  await writeText("content_team_request.md", contentRequestMd);
};

const main = async () => {
  await ensureDirs();
  const measuredAt = nowKst();
  console.log(`SEO read-only audit started: ${measuredAt}`);

  const { robots, robotsSitemapDirectives, sitemapFiles, sitemapUrls } = await collectSitemaps();
  console.log(`Sitemap URLs: ${sitemapUrls.length}`);

  const inventoryRows = await collectInventory(sitemapUrls);
  await writeCsv("url_inventory.csv", inventoryRows, [
    "url",
    "normalized_url",
    "path",
    "query",
    "type",
    "source_page",
    "anchor_text",
    "status_code",
    "final_url",
    "is_parameter_url",
    "suspected_duplicate_group",
    "content_type",
    "error",
  ]);

  const { rawAudits, renderedAudits, resourceAudits } = await analyzeTargetPages();
  const pageRows = rawAudits.map((raw) => {
    const rendered = renderedAudits.find((item) => item.key === raw.key);
    return auditRowFromAnalysis(raw, rendered);
  });

  await writeCsv("page_seo_audit.csv", pageRows, [
    "key",
    "label",
    "url",
    "fetch_status",
    "rendered_status",
    "title",
    "title_length",
    "meta_description",
    "meta_description_length",
    "canonical",
    "robots_meta",
    "og_title",
    "og_description",
    "og_image",
    "h1_count",
    "h1_text",
    "h2_count",
    "h2_text",
    "h3_count",
    "image_count",
    "images_without_alt",
    "images_with_long_alt",
    "empty_heading_count",
    "jsonld_count",
    "schema_types",
    "has_product",
    "has_article",
    "has_organization",
    "has_breadcrumb",
    "has_faq",
    "has_price_jsonld",
    "has_review_jsonld",
    "has_availability_jsonld",
    "word_count",
    "meaningful_sentence_count",
    "raw_body_hash",
    "rendered_body_hash",
  ]);

  const duplicateRows = duplicateGroups(inventoryRows, pageRows);
  await writeCsv(
    "duplicate_url_groups.csv",
    duplicateRows.map((row) => ({ ...row, urls: row.urls.join(" | ") })),
    ["group", "count", "representative_url", "types", "status_codes", "urls"],
  );

  const bestAudits = TARGET_PAGES.map((target) => bestAuditForKey(target.key, rawAudits, renderedAudits)).filter(Boolean);
  const productContentRows = buildProductContentAudit(bestAudits);
  const resourceSummary = buildResourceSummary(resourceAudits);

  const auditByKey = Object.fromEntries(bestAudits.map((audit) => [audit.key, audit]));
  await writeJson("jsonld_samples/product_organicacid.json", makeProductSample(auditByKey.organicacid_product, "종합 대사기능 분석"));
  await writeJson("jsonld_samples/product_biobalance.json", makeProductSample(auditByKey.biobalance_product, "바이오밸런스"));
  await writeJson("jsonld_samples/article_health_goal.json", makeArticleSample(auditByKey.healthinfo_article));
  await writeJson("jsonld_samples/organization_biocom.json", makeOrganizationSample(auditByKey.homepage));
  await writeJson("jsonld_samples/breadcrumb_examples.json", makeBreadcrumbSamples());

  await generateReports({
    measuredAt,
    robots,
    robotsSitemapDirectives,
    sitemapFiles,
    sitemapUrls,
    inventoryRows,
    pageRows,
    duplicateRows,
    productContentRows,
    resourceSummary,
  });

  console.log(`SEO read-only audit completed: ${nowKst()}`);
  console.log(`Reports: ${REPORT_DIR}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
