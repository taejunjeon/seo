import fs from "node:fs/promises";
import path from "node:path";

const REPO_CANDIDATES = [
  process.cwd(),
  path.resolve(process.cwd(), ".."),
];

export async function readReportFile(relativePath: string): Promise<{ content: string; updatedAt: string } | null> {
  for (const base of REPO_CANDIDATES) {
    const filePath = path.resolve(base, relativePath);
    try {
      const [content, stat] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.stat(filePath),
      ]);
      return { content, updatedAt: stat.mtime.toISOString() };
    } catch {
      // try next
    }
  }
  return null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(buf);
        buf = "";
      } else if (ch === "\n") {
        cur.push(buf);
        rows.push(cur);
        cur = [];
        buf = "";
      } else if (ch === "\r") {
        // ignore
      } else {
        buf += ch;
      }
    }
  }
  if (buf.length > 0 || cur.length > 0) {
    cur.push(buf);
    rows.push(cur);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
}

export function splitPipe(value: string): string[] {
  return value.split("|").map((s) => s.trim()).filter(Boolean);
}

export function getMdSection(md: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##+\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "m");
  const match = md.match(re);
  return match ? match[1].trim() : "";
}

export function getMdSectionByLevel(md: string, level: number, heading: string): string {
  const hashes = "#".repeat(level);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${hashes}\\s+${escaped}\\s*$([\\s\\S]*?)(?=^${hashes.slice(0, level)}\\s|^#{1,${level}}\\s|\\Z)`, "m");
  const match = md.match(re);
  return match ? match[1].trim() : "";
}

export function extractListItems(block: string): string[] {
  return block
    .split(/\n/)
    .map((line) => line.replace(/^\s*[-*\d.]+\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function extractNumberedItems(block: string): string[] {
  return block
    .split(/\n/)
    .map((line) => line.match(/^\d+\.\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => m[1].trim());
}

export function extractScoreTable(md: string): { label: string; score: number; max: number }[] {
  const section = getMdSection(md, "현재 점수");
  const lines = section.split("\n");
  const result: { label: string; score: number; max: number }[] = [];
  for (const line of lines) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\|/);
    if (m) {
      result.push({ label: m[1].trim(), score: Number(m[2]), max: Number(m[3]) });
    }
  }
  return result;
}

export function extractTotalScore(md: string): number {
  const section = getMdSection(md, "현재 점수");
  const m = section.match(/총점:\s*(\d+)\s*\/\s*\d+/);
  return m ? Number(m[1]) : 0;
}
