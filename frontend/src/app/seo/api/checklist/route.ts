import { NextResponse } from "next/server";
import { csvToObjects, extractListItems, extractNumberedItems, getMdSection, readReportFile } from "@/components/seo/seo.utils";
import type { ActionRow, ChecklistResponse, ChecklistRow } from "@/components/seo/seo.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseChecklistTable(md: string): ChecklistRow[] {
  const section = getMdSection(md, "운영 전 확인");
  const rows: ChecklistRow[] = [];
  const lines = section.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("순서")) continue;
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= 5) {
      rows.push({
        order: cells[0],
        owner: cells[1],
        task: cells[2],
        artifact: cells[3],
        doneCriteria: cells[4],
      });
    }
  }
  return rows;
}

export async function GET() {
  const checklist = await readReportFile("reports/seo/operation_change_checklist.md");
  const actions = await readReportFile("reports/seo/action_plan.csv");

  if (!checklist) {
    return NextResponse.json({ error: "checklist_not_found" }, { status: 404 });
  }

  const preChecks = parseChecklistTable(checklist.content);
  const runOrder = extractNumberedItems(getMdSection(checklist.content, "운영 반영 순서"));
  const rollback = extractListItems(getMdSection(checklist.content, "롤백 기준"));

  let actionRows: ActionRow[] = [];
  if (actions) {
    actionRows = csvToObjects(actions.content).map((row) => ({
      priority: row.priority,
      task: row.task,
      owner: row.owner,
      expectedImpact: row.expected_impact,
      difficulty: row.difficulty,
      risk: row.risk,
      evidenceFile: row.evidence_file,
      recommendedDeadline: row.recommended_deadline,
    }));
  }

  const payload: ChecklistResponse = {
    preChecks,
    runOrder,
    rollback,
    actions: actionRows,
  };

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
