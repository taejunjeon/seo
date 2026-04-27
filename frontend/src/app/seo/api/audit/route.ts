import { NextResponse } from "next/server";
import {
  csvToObjects,
  extractListItems,
  extractNumberedItems,
  extractScoreTable,
  extractTotalScore,
  getMdSection,
  readReportFile,
} from "@/components/seo/seo.utils";
import type { AuditDuplicateGroup, AuditPageRow, AuditResponse } from "@/components/seo/seo.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await readReportFile("reports/seo/seo_audit_summary.md");
  const pagesCsv = await readReportFile("reports/seo/page_seo_audit.csv");
  const inventoryCsv = await readReportFile("reports/seo/url_inventory.csv");
  const duplicatesCsv = await readReportFile("reports/seo/duplicate_url_groups.csv");

  if (!summary) {
    return NextResponse.json({ error: "audit_summary_not_found" }, { status: 404 });
  }

  const totalScore = extractTotalScore(summary.content);
  const scores = extractScoreTable(summary.content);
  const problems = extractNumberedItems(getMdSection(summary.content, "가장 큰 문제 5개"));
  const todayActions = extractListItems(getMdSection(summary.content, "오늘 바로 할 일"));
  const weekActions = extractListItems(getMdSection(summary.content, "이번 주 할 일"));
  const nextActions = extractListItems(getMdSection(summary.content, "다음 배치에서 할 일"));

  let pages: AuditPageRow[] = [];
  let altMissingTotal = 0;
  let pagesWithoutJsonLd = 0;
  if (pagesCsv) {
    pages = csvToObjects(pagesCsv.content).map((row) => {
      const page: AuditPageRow = {
        key: row.key,
        label: row.label,
        url: row.url,
        title: row.title,
        titleLength: Number(row.title_length || 0),
        metaDescription: row.meta_description,
        metaDescriptionLength: Number(row.meta_description_length || 0),
        canonical: row.canonical,
        jsonLdCount: Number(row.jsonld_count || 0),
        imageCount: Number(row.image_count || 0),
        imagesWithoutAlt: Number(row.images_without_alt || 0),
        wordCount: Number(row.word_count || 0),
        h1Count: Number(row.h1_count || 0),
        h2Count: Number(row.h2_count || 0),
        fetchStatus: Number(row.fetch_status || 0),
        renderedStatus: Number(row.rendered_status || 0),
      };
      altMissingTotal += page.imagesWithoutAlt;
      if (page.jsonLdCount === 0) pagesWithoutJsonLd += 1;
      return page;
    });
  }

  let duplicateCount = 0;
  if (duplicatesCsv) {
    const dupRows: AuditDuplicateGroup[] = csvToObjects(duplicatesCsv.content).map((row) => ({
      group: row.group,
      count: Number(row.count || 0),
      representativeUrl: row.representative_url,
      types: row.types,
      statusCodes: row.status_codes,
      urls: row.urls.split("|").map((s) => s.trim()).filter(Boolean),
    }));
    duplicateCount = dupRows.length;
  }

  let inventoryTotal = 0;
  let parameterUrlCount = 0;
  let sitemapCount = 0;
  if (inventoryCsv) {
    const rows = csvToObjects(inventoryCsv.content);
    inventoryTotal = rows.length;
    parameterUrlCount = rows.filter((r) => r.is_parameter_url === "true").length;
    sitemapCount = rows.filter((r) => (r.source_page ?? "").includes("sitemap")).length;
  }

  const parameterUrlPct = inventoryTotal > 0 ? (parameterUrlCount / inventoryTotal) * 100 : 0;

  const payload: AuditResponse = {
    generatedAt: summary.updatedAt,
    totalScore,
    scores,
    problems,
    todayActions,
    weekActions,
    nextActions,
    pages,
    duplicateCount,
    parameterUrlCount,
    parameterUrlPct,
    inventoryTotal,
    sitemapCount,
    altMissingTotal,
    pagesWithoutJsonLd,
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
