import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_FILE = "lcpfcp1.0.md";

const readReportFile = async () => {
  const candidates = [
    // When `next dev` is started from repo root
    path.resolve(process.cwd(), REPORT_FILE),
    // When `next dev` is started from `frontend/`
    path.resolve(process.cwd(), "..", REPORT_FILE),
  ];

  for (const filePath of candidates) {
    try {
      const [markdown, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath),
      ]);
      return { markdown, updatedAt: stat.mtime.toISOString() };
    } catch {
      // try next candidate
    }
  }

  return null;
};

export const GET = async () => {
  const result = await readReportFile();
  if (!result) {
    return NextResponse.json(
      { error: "not_found", message: `${REPORT_FILE} not found` },
      { status: 404 },
    );
  }

  const response = NextResponse.json(result);
  response.headers.set("Cache-Control", "no-store");
  return response;
};
