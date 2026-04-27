import { NextResponse } from "next/server";
import { csvToObjects, extractNumberedItems, getMdSection, readReportFile } from "@/components/seo/seo.utils";
import type { JsonLdResponse, JsonLdSnippet, JsonLdValidationRow } from "@/components/seo/seo.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSnippets(md: string): JsonLdSnippet[] {
  const snippets: JsonLdSnippet[] = [];
  const blocks = md.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const titleMatch = block.match(/^([^\n]+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    if (title === "10초 요약" || title === "삽입 원칙") continue;
    const sourceMatch = block.match(/Source:\s*`([^`]+)`/);
    const codeMatch = block.match(/```(?:html)?\n([\s\S]*?)```/);
    if (codeMatch) {
      snippets.push({
        title,
        source: sourceMatch ? sourceMatch[1] : "",
        code: codeMatch[1].trim(),
      });
    }
  }
  return snippets;
}

export async function GET() {
  const validationCsv = await readReportFile("reports/seo/jsonld_validation_matrix.csv");
  const snippetsMd = await readReportFile("reports/seo/jsonld_insertion_snippets.md");
  const validationMd = await readReportFile("reports/seo/jsonld_validation_matrix.md");

  if (!validationCsv || !snippetsMd) {
    return NextResponse.json({ error: "jsonld_files_not_found" }, { status: 404 });
  }

  const validation: JsonLdValidationRow[] = csvToObjects(validationCsv.content).map((row) => ({
    page: row.page,
    url: row.url,
    jsonLdCount: Number(row.jsonld_count || 0),
    recommendedSchema: row.recommended_schema,
    blocker: row.blocker,
    confidence: row.confidence,
  }));

  const snippets = parseSnippets(snippetsMd.content);
  const preChecks = validationMd
    ? extractNumberedItems(getMdSection(validationMd.content, "운영 반영 전 체크"))
    : [];

  const payload: JsonLdResponse = {
    validation,
    snippets,
    preChecks,
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
