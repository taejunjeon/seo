import { NextResponse } from "next/server";
import { csvToObjects, readReportFile } from "@/components/seo/seo.utils";
import type { AuditDuplicateGroup, InventoryRow, PolicyRow, UrlPolicyResponse } from "@/components/seo/seo.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const policy = await readReportFile("reports/seo/url_policy_matrix.csv");
  const duplicates = await readReportFile("reports/seo/duplicate_url_groups.csv");
  const inventory = await readReportFile("reports/seo/url_inventory.csv");

  if (!policy || !inventory) {
    return NextResponse.json({ error: "url_policy_files_not_found" }, { status: 404 });
  }

  const policies: PolicyRow[] = csvToObjects(policy.content).map((row) => ({
    type: row.type,
    representativeUrl: row.representative_url,
    currentExamples: row.current_examples,
    canonicalPolicy: row.canonical_policy,
    sitemapPolicy: row.sitemap_policy,
    noindexPolicy: row.noindex_policy,
    action: row.action,
    confidence: row.confidence,
  }));

  let dupRows: AuditDuplicateGroup[] = [];
  if (duplicates) {
    dupRows = csvToObjects(duplicates.content).map((row) => ({
      group: row.group,
      count: Number(row.count || 0),
      representativeUrl: row.representative_url,
      types: row.types,
      statusCodes: row.status_codes,
      urls: row.urls.split("|").map((s) => s.trim()).filter(Boolean),
    }));
  }

  const invObjs = csvToObjects(inventory.content);
  const rows: InventoryRow[] = invObjs.map((row) => ({
    url: row.url,
    normalizedUrl: row.normalized_url,
    path: row.path,
    query: row.query,
    type: row.type,
    statusCode: Number(row.status_code || 0),
    finalUrl: row.final_url,
    isParameterUrl: row.is_parameter_url === "true",
    duplicateGroup: row.suspected_duplicate_group,
    source: row.source_page,
  }));
  const parameterCount = rows.filter((r) => r.isParameterUrl).length;
  const typeCountsMap = new Map<string, number>();
  rows.forEach((r) => {
    typeCountsMap.set(r.type, (typeCountsMap.get(r.type) || 0) + 1);
  });
  const typeCounts = Array.from(typeCountsMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const payload: UrlPolicyResponse = {
    policies,
    duplicates: dupRows,
    inventory: {
      rows,
      total: rows.length,
      parameterCount,
      typeCounts,
    },
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
