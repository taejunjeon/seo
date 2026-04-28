import { NextResponse } from "next/server";
import { csvToObjects, getMdSection, readReportFile } from "@/components/seo/seo.utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CanonicalRow = {
  priority: string;
  pageLabel: string;
  canonicalTarget: string;
  variantUrls: string;
  imwebAction: string;
  verificationStep: string;
  confidence: string;
};
type NoindexRow = {
  priority: string;
  urlPattern: string;
  reason: string;
  imwebAction: string;
  verificationStep: string;
  risk: string;
};
type SitemapRow = {
  priority: string;
  urlPattern: string;
  currentInSitemap: string;
  action: string;
  reason: string;
  verificationStep: string;
};
type RollbackRow = {
  signal: string;
  source: string;
  threshold: string;
  response: string;
};

function parseRollbackTable(md: string, sectionTitle: string): RollbackRow[] {
  const section = getMdSection(md, sectionTitle);
  const rows: RollbackRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (line.includes("신호") && line.includes("측정")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 4) {
      rows.push({ signal: cells[0], source: cells[1], threshold: cells[2], response: cells[3] });
    } else if (cells.length === 3) {
      // 2주 후 검증은 3컬럼: 신호/측정 위치/정상 기준
      rows.push({ signal: cells[0], source: cells[1], threshold: cells[2], response: "" });
    }
  }
  return rows;
}

function parseRobotsBlocks(md: string): { current: string; revised: string } {
  const currentMatch = md.match(/## 1\. 현재 robots\.txt 문제점\s*\n+```([\s\S]*?)```/);
  const revisedMatch = md.match(/## 2\. 수정 후 robots\.txt[^\n]*\n[\s\S]*?```([\s\S]*?)```/);
  return {
    current: currentMatch ? currentMatch[1].trim() : "",
    revised: revisedMatch ? revisedMatch[1].trim() : "",
  };
}

export async function GET() {
  const [workorder, canonicalCsv, noindexCsv, sitemapCsv, robotsRev, rollback] = await Promise.all([
    readReportFile("reports/seo/imweb_url_cleanup_workorder.md"),
    readReportFile("reports/seo/imweb_canonical_targets.csv"),
    readReportFile("reports/seo/imweb_noindex_targets.csv"),
    readReportFile("reports/seo/imweb_sitemap_excludes.csv"),
    readReportFile("reports/seo/imweb_robots_txt_revision.md"),
    readReportFile("reports/seo/imweb_rollback_criteria.md"),
  ]);

  if (!workorder || !canonicalCsv || !noindexCsv || !sitemapCsv || !robotsRev || !rollback) {
    return NextResponse.json({ error: "url_cleanup_files_missing" }, { status: 404 });
  }

  const canonicals: CanonicalRow[] = csvToObjects(canonicalCsv.content).map((r) => ({
    priority: r.priority,
    pageLabel: r.page_label,
    canonicalTarget: r.canonical_target,
    variantUrls: r.variant_urls_to_redirect,
    imwebAction: r.imweb_action,
    verificationStep: r.verification_step,
    confidence: r.confidence,
  }));
  const noindexes: NoindexRow[] = csvToObjects(noindexCsv.content).map((r) => ({
    priority: r.priority,
    urlPattern: r.url_pattern,
    reason: r.reason,
    imwebAction: r.imweb_action,
    verificationStep: r.verification_step,
    risk: r.risk,
  }));
  const sitemaps: SitemapRow[] = csvToObjects(sitemapCsv.content).map((r) => ({
    priority: r.priority,
    urlPattern: r.url_pattern,
    currentInSitemap: r.current_in_sitemap,
    action: r.action,
    reason: r.reason,
    verificationStep: r.verification_step,
  }));
  const robots = parseRobotsBlocks(robotsRev.content);

  const rollbackImmediate = parseRollbackTable(rollback.content, "1. 즉시 롤백 신호 (적용 후 0~24시간 내)");
  const rollbackWeek = parseRollbackTable(rollback.content, "2. 1주일 후 롤백 신호 (적용 후 7일)");
  const verify2Weeks = parseRollbackTable(rollback.content, "3. 2주 후 검증 (적용 후 14일)");

  // URL 종류별 처리 기준표 (workorder 본문 §1)
  const overviewSection = getMdSection(workorder.content, "1. URL 종류별 처리 기준표 (한눈에 보기)");
  const overviewRows: { type: string; example: string; canonical: string; sitemap: string; noindex: string; priority: string }[] = [];
  for (const line of overviewSection.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (line.includes("URL 유형") || line.includes("우선순위")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 7 && cells[0] && cells[0] !== "#") {
      overviewRows.push({
        type: cells[1],
        example: cells[2],
        canonical: cells[3],
        sitemap: cells[4],
        noindex: cells[5],
        priority: cells[6],
      });
    }
  }

  const reportTemplate = `[아임웹 URL 정리 작업 보고]

§2-1 noindex 처리: __개 URL 적용 / __개 보류 (사유)
§2-2 canonical 통일: __개 URL 적용 / __개 보류 (사유)
§2-3 robots.txt 수정: 적용 완료 ☐ / 미적용 ☐ (사유)
§3 1주일 점검: __개 정상 / __개 이상 (상세)

이상 사항: (있다면 §5 롤백 기준 중 어느 항목인지)
첨부: 적용 전·후 robots.txt 파일`;

  return NextResponse.json({
    overviewRows,
    canonicals,
    noindexes,
    sitemaps,
    robots,
    rollbackImmediate,
    rollbackWeek,
    verify2Weeks,
    reportTemplate,
    generatedAt: workorder.updatedAt,
  });
}
