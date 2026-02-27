import { CONTENT_ORIGIN } from "@/constants/pageData";
import type { MdBlock } from "@/types/page";

/* ═══════════════════════════════════════
   page.tsx에서 추출된 유틸리티 함수
   ═══════════════════════════════════════ */

export const resolveContentUrl = (rawUrl: string) => {
  const url = rawUrl.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${CONTENT_ORIGIN}${url}`;
  return `${CONTENT_ORIGIN}/${url}`;
};

export const isColumnLikePage = (rawUrl: string) => {
  const full = resolveContentUrl(rawUrl);
  try {
    const u = new URL(full);
    const pathname = (u.pathname || "/").replace(/\/+$/, "") || "/";
    return (
      pathname === "/healthinfo" ||
      pathname.startsWith("/healthinfo/") ||
      pathname === "/what_biohacking" ||
      pathname.startsWith("/what_biohacking/")
    );
  } catch {
    const p = rawUrl.trim();
    return (
      p === "/healthinfo" ||
      p.startsWith("/healthinfo/") ||
      p.startsWith("/healthinfo?") ||
      p === "/what_biohacking" ||
      p.startsWith("/what_biohacking/") ||
      p.startsWith("/what_biohacking?")
    );
  }
};

export const normalizeComparableUrl = (rawUrl: string) => {
  const full = resolveContentUrl(rawUrl);
  if (!full) return "";
  try {
    const u = new URL(full);
    u.hash = "";
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return full.replace(/#.*$/, "");
  }
};

export const isColumnIndexUrl = (rawUrl: string) => {
  const full = resolveContentUrl(rawUrl);
  if (!full) return false;
  try {
    const u = new URL(full);
    const pathname = (u.pathname || "/").replace(/\/+$/, "") || "/";
    const hasQuery = !!u.search && u.search !== "?";
    return (pathname === "/healthinfo" || pathname === "/what_biohacking") && !hasQuery;
  } catch {
    const trimmed = rawUrl.trim();
    return trimmed === "/healthinfo" || trimmed === "/what_biohacking";
  }
};

export const pickRepresentativeColumnUrl = (urls: string[]) => {
  const cleaned = urls.map((u) => u?.trim()).filter(Boolean) as string[];
  if (cleaned.length === 0) return "";

  const preferDetail = cleaned.find((u) => isColumnLikePage(u) && !isColumnIndexUrl(u) && /(bmode=view|idx=)/i.test(u));
  if (preferDetail) return preferDetail;

  const anyDetail = cleaned.find((u) => isColumnLikePage(u) && !isColumnIndexUrl(u));
  if (anyDetail) return anyDetail;

  return cleaned[0] ?? "";
};

export const parseMarkdownLite = (markdown: string): MdBlock[] => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let current: MdBlock | null = null;

  const flush = () => {
    if (!current) return;
    blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    if (trimmed === "---") {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flush();
      const level = headingMatch[1]?.length ?? 1;
      const text = headingMatch[2] ?? "";
      blocks.push({
        type: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        text,
      });
      continue;
    }

    const ulMatch = /^\s*-\s+(.*)$/.exec(line);
    if (ulMatch) {
      const item = ulMatch[1] ?? "";
      if (current?.type === "ul") {
        current.items.push(item);
      } else {
        flush();
        current = { type: "ul", items: [item] };
      }
      continue;
    }

    const olMatch = /^\s*\d+\)\s+(.*)$/.exec(line);
    if (olMatch) {
      const item = olMatch[1] ?? "";
      if (current?.type === "ol") {
        current.items.push(item);
      } else {
        flush();
        current = { type: "ol", items: [item] };
      }
      continue;
    }

    if (current?.type === "p") {
      current.lines.push(trimmed);
    } else {
      flush();
      current = { type: "p", lines: [trimmed] };
    }
  }

  flush();
  return blocks;
};

export const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

export const dateNDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
};

export const numberFormatter = new Intl.NumberFormat("ko-KR");
export const decimalFormatter = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const gaugeColor = (score: number): string => {
  if (score >= 90) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
};
