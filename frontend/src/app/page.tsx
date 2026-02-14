"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

import styles from "./page.module.css";
import KpiCard from "@/components/dashboard/KpiCard";

/* ═══════════════════════════════════════
   기존 타입
   ═══════════════════════════════════════ */
type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type GscQueryResponse = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowCount: number;
  rows: GscRow[];
};

type DatePreset = "7d" | "28d" | "90d" | "custom";
type KeywordRangePreset = "7d" | "30d" | "custom";
type BehaviorRangePreset = "7d" | "30d" | "90d" | "custom";

/* ═══════════════════════════════════════
   Mock 타입 & 데이터
   ═══════════════════════════════════════ */
type AiInsight = {
  priority: "urgent" | "opportunity" | "trend" | "recommend";
  tag: string;
  text: string;
};

type IntentType = "informational" | "commercial" | "navigational" | "brand";

type IntentCategory = {
  label: string;
  type: IntentType;
  percent: number;
  count: number;
  colorClass: string;
};

type IntentKeyword = {
  query: string;
  intent: IntentType;
  confidence: "high" | "medium" | "low";
};

type IntentApiResponse = {
  categories: IntentCategory[];
  keywords: IntentKeyword[];
  totalKeywords: number;
  method: "rule" | "hybrid";
  period?: string;
};

type OptimizationTask = {
  id: string;
  text: string;
  done: boolean;
  detail?: string;
};

type ColumnData = {
  title: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  score: number;
  search: number;
  tech: number;
  engage: number;
  aeo: number;
};

type KeywordData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  isQA: boolean;
  featured: boolean;
  delta: number;
  opportunity: boolean;
};

type CwvPageData = {
  url: string;
  label: string;
  performance: number;
  seo: number;
  accessibility: number;
  lcp: number;
  fcp: number;
  cls: number;
  inp: number;
  ttfb: number;
};

type BehaviorData = {
  page: string;
  sessions: number;
  users: number;
  avgTime: number;
  bounceRate: number;
  scrollDepth: number;
  conversions: number;
};

type FunnelStep = {
  label: string;
  value: number;
  percent: number;
};

/* ═══════════════════════════════════════
   API 응답 타입
   ═══════════════════════════════════════ */
type KpiApiData = {
  current: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  previous: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  delta: { clicks: number; ctr: number; position: number };
  sparklines: { clicks: number[]; ctr: number[]; position: number[] };
};

type TrendPoint = { date: string; clicks: number; impressions: number };

type ApiKeywordsResponse = {
  keywords: { query: string; clicks: number; impressions: number; ctr: number; position: number; isQA: boolean; opportunity: boolean }[];
  totalKeywords: number;
  qaKeywords: number;
  opportunityKeywords: number;
};

type ApiColumnsResponse = {
  columns: { url: string; title: string; clicks: number; impressions: number; ctr: number; position: number; score: number; search: number; tech: number; engage: number; aeo: number }[];
};

type PageSpeedApiResult = {
  url: string;
  strategy: string;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  lcpMs: number;
  fcpMs: number;
  cls: number;
  inpMs: number | null;
  ttfbMs: number;
  measuredAt: string;
};

type ScoreBreakdown = {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  status: "measured" | "estimated" | "unavailable";
  detail: string;
};

type AeoGeoApiResult = {
  type: "AEO" | "GEO";
  totalScore: number;
  maxPossible: number;
  normalizedScore: number;
  breakdown: ScoreBreakdown[];
  measuredAt: string;
};

/* ── 페이지 진단 타입 ── */
type SchemaInfo = {
  types: string[];
  hasFAQ: boolean;
  hasHowTo: boolean;
  hasArticle: boolean;
  hasMedical: boolean;
  hasAuthor: boolean;
  hasSpeakable: boolean;
  rawCount: number;
};

type ContentStructure = {
  h2Count: number;
  h3Count: number;
  listCount: number;
  tableCount: number;
  blockquoteCount: number;
  imgCount: number;
  imgWithAlt: number;
  wordCount: number;
  hasMetaDescription: boolean;
  metaDescLength: number;
};

type CrawlAnalysisResult = {
  url: string;
  schema: SchemaInfo;
  content: ContentStructure;
  crawledAt: string;
};

type DiagnosisItem = {
  category: "Schema" | "콘텐츠";
  issue: string;
  priority: "urgent" | "important" | "optional";
  recommendation: string;
};

/* ── 오버뷰 Mock (API 미응답 시 Fallback) ── */
const SCORES = [
  { label: "AEO Score", score: 78, max: 100, delta: 3.2, deltaLabel: "전주 대비" },
  { label: "GEO Score", score: 65, max: 100, delta: 5.1, deltaLabel: "전주 대비" },
];

const AI_INSIGHTS: AiInsight[] = [
  { priority: "urgent", tag: "키워드", text: "\"건강기능식품\" 순위 5→12위 하락 — 즉각적인 콘텐츠 보강 필요" },
  { priority: "opportunity", tag: "스키마", text: "FAQ 스키마 추가 시 CTR 15% 향상 예상" },
  { priority: "trend", tag: "기기", text: "모바일 검색 비율 68%, 전월대비 12% 증가" },
  { priority: "recommend", tag: "콘텐츠", text: "\"프로바이오틱스 효능\" 콘텐츠 보강 필요" },
];

const INTENT_CATEGORIES = [
  { label: "정보성", type: "informational", percent: 45, count: 0, colorClass: "intentBarInfo" },
  { label: "상업성", type: "commercial", percent: 30, count: 0, colorClass: "intentBarCommercial" },
  { label: "탐색성", type: "navigational", percent: 15, count: 0, colorClass: "intentBarNavigation" },
  { label: "브랜드", type: "brand", percent: 10, count: 0, colorClass: "intentBarBrand" },
] satisfies IntentCategory[];

const SPARKLINE_CLICKS = [142, 155, 138, 167, 178, 163, 185];
const SPARKLINE_CTR = [3.2, 3.5, 3.1, 3.8, 4.0, 3.7, 4.2];
const SPARKLINE_POSITION = [8.5, 8.2, 8.8, 7.9, 7.5, 7.8, 7.3];

const TREND_30D = Array.from({ length: 30 }, (_, i) => ({
  clicks: Math.round(120 + Math.sin(i * 0.3) * 30 + i * 2.2),
  impressions: Math.round(2800 + Math.sin(i * 0.25) * 300 + i * 18),
}));

/* ── 칼럼 분석 Mock ── */
const MOCK_COLUMNS: ColumnData[] = [
  { title: "프로바이오틱스의 효능과 올바른 선택법", url: "/healthinfo/probiotics-guide", clicks: 342, impressions: 8420, ctr: 4.06, position: 5.2, score: 85, search: 34, tech: 18, engage: 21, aeo: 12 },
  { title: "비타민D 결핍 증상과 보충 방법", url: "/healthinfo/vitamin-d", clicks: 287, impressions: 7150, ctr: 4.01, position: 6.1, score: 78, search: 31, tech: 16, engage: 19, aeo: 12 },
  { title: "오메가3 지방산의 건강 효과", url: "/healthinfo/omega3", clicks: 234, impressions: 6890, ctr: 3.40, position: 7.4, score: 72, search: 28, tech: 17, engage: 16, aeo: 11 },
  { title: "유산균과 장 건강의 관계", url: "/healthinfo/gut-health", clicks: 198, impressions: 5420, ctr: 3.65, position: 6.8, score: 69, search: 26, tech: 15, engage: 18, aeo: 10 },
  { title: "건강기능식품 선택 가이드", url: "/healthinfo/supplement-guide", clicks: 176, impressions: 8920, ctr: 1.97, position: 12.3, score: 65, search: 22, tech: 14, engage: 17, aeo: 12 },
  { title: "콜라겐 보충제의 효과와 부작용", url: "/healthinfo/collagen", clicks: 156, impressions: 4780, ctr: 3.26, position: 8.5, score: 61, search: 24, tech: 13, engage: 15, aeo: 9 },
  { title: "면역력 강화를 위한 영양소", url: "/healthinfo/immunity", clicks: 134, impressions: 4120, ctr: 3.25, position: 8.9, score: 58, search: 22, tech: 12, engage: 14, aeo: 10 },
  { title: "혈당 관리를 위한 식이요법", url: "/healthinfo/blood-sugar", clicks: 98, impressions: 3560, ctr: 2.75, position: 14.1, score: 54, search: 18, tech: 14, engage: 13, aeo: 9 },
];

/* ── 키워드 분석 Mock ── */
const MOCK_KEYWORDS: KeywordData[] = [
  { query: "프로바이오틱스 효능", clicks: 89, impressions: 2340, ctr: 3.80, position: 4.2, isQA: true, featured: true, delta: -0.5, opportunity: false },
  { query: "비타민D 결핍 증상", clicks: 76, impressions: 2180, ctr: 3.49, position: 5.8, isQA: true, featured: false, delta: -1.2, opportunity: false },
  { query: "유산균 효과", clicks: 68, impressions: 1890, ctr: 3.60, position: 3.1, isQA: true, featured: true, delta: 0.8, opportunity: false },
  { query: "오메가3 부작용", clicks: 52, impressions: 1650, ctr: 3.15, position: 7.4, isQA: true, featured: false, delta: -0.3, opportunity: false },
  { query: "건강기능식품 추천", clicks: 45, impressions: 5820, ctr: 0.77, position: 12.3, isQA: false, featured: false, delta: -3.1, opportunity: true },
  { query: "콜라겐 효과", clicks: 43, impressions: 1420, ctr: 3.03, position: 6.2, isQA: true, featured: true, delta: 1.5, opportunity: false },
  { query: "면역력 높이는 방법", clicks: 38, impressions: 1580, ctr: 2.41, position: 8.9, isQA: true, featured: false, delta: -0.8, opportunity: false },
  { query: "건강기능식품 성분", clicks: 22, impressions: 3240, ctr: 0.68, position: 15.2, isQA: false, featured: false, delta: -2.4, opportunity: true },
  { query: "프로바이오틱스 추천", clicks: 34, impressions: 1980, ctr: 1.72, position: 9.7, isQA: false, featured: false, delta: 0.3, opportunity: false },
  { query: "비타민D 음식", clicks: 28, impressions: 1320, ctr: 2.12, position: 11.3, isQA: true, featured: false, delta: -1.8, opportunity: false },
  { query: "장건강 개선 방법", clicks: 41, impressions: 1450, ctr: 2.83, position: 6.8, isQA: true, featured: false, delta: 0.5, opportunity: false },
  { query: "혈당 낮추는 음식", clicks: 19, impressions: 2870, ctr: 0.66, position: 14.1, isQA: true, featured: false, delta: -1.5, opportunity: true },
];

/* ── Core Web Vitals Mock ── */
const MOCK_CWV_MOBILE: CwvPageData[] = [
  { url: "/healthinfo/probiotics-guide", label: "프로바이오틱스 가이드", performance: 85, seo: 92, accessibility: 90, lcp: 1980, fcp: 1200, cls: 0.05, inp: 150, ttfb: 580 },
  { url: "/healthinfo/vitamin-d", label: "비타민D 결핍", performance: 79, seo: 88, accessibility: 87, lcp: 2340, fcp: 1500, cls: 0.08, inp: 190, ttfb: 650 },
  { url: "/healthinfo/omega3", label: "오메가3 효과", performance: 72, seo: 85, accessibility: 92, lcp: 2780, fcp: 1800, cls: 0.12, inp: 220, ttfb: 720 },
  { url: "/healthinfo/gut-health", label: "장건강 가이드", performance: 88, seo: 90, accessibility: 91, lcp: 1850, fcp: 1100, cls: 0.04, inp: 130, ttfb: 540 },
  { url: "/healthinfo/supplement-guide", label: "건강기능식품 가이드", performance: 65, seo: 82, accessibility: 85, lcp: 3200, fcp: 2100, cls: 0.18, inp: 280, ttfb: 890 },
];

const MOCK_CWV_DESKTOP: CwvPageData[] = [
  { url: "/healthinfo/probiotics-guide", label: "프로바이오틱스 가이드", performance: 92, seo: 95, accessibility: 92, lcp: 1200, fcp: 800, cls: 0.02, inp: 80, ttfb: 420 },
  { url: "/healthinfo/vitamin-d", label: "비타민D 결핍", performance: 88, seo: 91, accessibility: 89, lcp: 1580, fcp: 950, cls: 0.04, inp: 110, ttfb: 480 },
  { url: "/healthinfo/omega3", label: "오메가3 효과", performance: 82, seo: 88, accessibility: 94, lcp: 1920, fcp: 1100, cls: 0.06, inp: 140, ttfb: 520 },
  { url: "/healthinfo/gut-health", label: "장건강 가이드", performance: 95, seo: 93, accessibility: 93, lcp: 1100, fcp: 720, cls: 0.01, inp: 60, ttfb: 380 },
  { url: "/healthinfo/supplement-guide", label: "건강기능식품 가이드", performance: 78, seo: 86, accessibility: 88, lcp: 2200, fcp: 1400, cls: 0.09, inp: 170, ttfb: 620 },
];

/* ── 사용자 행동 Mock ── */
const MOCK_BEHAVIOR: BehaviorData[] = [
  { page: "프로바이오틱스 효능 가이드", sessions: 1240, users: 980, avgTime: 245, bounceRate: 32.5, scrollDepth: 72, conversions: 28 },
  { page: "비타민D 결핍 증상", sessions: 890, users: 720, avgTime: 198, bounceRate: 38.2, scrollDepth: 65, conversions: 15 },
  { page: "오메가3 건강 효과", sessions: 760, users: 610, avgTime: 176, bounceRate: 41.8, scrollDepth: 58, conversions: 12 },
  { page: "유산균 장건강 가이드", sessions: 680, users: 540, avgTime: 220, bounceRate: 35.1, scrollDepth: 68, conversions: 18 },
  { page: "건강기능식품 선택 가이드", sessions: 1520, users: 1280, avgTime: 142, bounceRate: 52.3, scrollDepth: 45, conversions: 8 },
  { page: "콜라겐 효과와 부작용", sessions: 520, users: 430, avgTime: 185, bounceRate: 39.7, scrollDepth: 62, conversions: 9 },
  { page: "면역력 강화 영양소", sessions: 480, users: 380, avgTime: 168, bounceRate: 43.5, scrollDepth: 55, conversions: 6 },
  { page: "혈당 관리 식이요법", sessions: 410, users: 340, avgTime: 195, bounceRate: 37.8, scrollDepth: 64, conversions: 5 },
];

const FUNNEL_STEPS: FunnelStep[] = [
  { label: "유기 검색 유입", value: 4520, percent: 100 },
  { label: "칼럼 페이지 조회", value: 3850, percent: 85.2 },
  { label: "제품 페이지 이동", value: 1230, percent: 27.2 },
  { label: "장바구니 담기", value: 340, percent: 7.5 },
  { label: "구매 완료", value: 89, percent: 2.0 },
];

/* ── 스타일 매핑 ── */
const BADGE_CLASS_MAP: Record<AiInsight["priority"], string> = {
  urgent: "insightBadgeUrgent",
  opportunity: "insightBadgeOpportunity",
  trend: "insightBadgeTrend",
  recommend: "insightBadgeRecommend",
};

const TAG_CLASS_MAP: Record<AiInsight["priority"], string> = {
  urgent: "insightTagUrgent",
  opportunity: "insightTagOpportunity",
  trend: "insightTagTrend",
  recommend: "insightTagRecommend",
};

const NAV_TABS = ["오버뷰", "칼럼 분석", "키워드 분석", "PageSpeed 보고서", "Core Web Vitals", "사용자 행동", "페이지 진단", "솔루션 소개"];

/* ── 진단 탭: CSS 클래스 매핑 ── */
const DIAG_PRIORITY_MAP: Record<DiagnosisItem["priority"], { dot: string; label: string; cls: string }> = {
  urgent: { dot: "diagDotUrgent", label: "긴급", cls: "diagPriorityUrgent" },
  important: { dot: "diagDotImportant", label: "중요", cls: "diagPriorityImportant" },
  optional: { dot: "diagDotOptional", label: "선택", cls: "diagPriorityOptional" },
};

/* ═══════════════════════════════════════
   SVG 헬퍼 컴포넌트
   ═══════════════════════════════════════ */
function ScoreGauge({ score, size = 80, color }: { score: number; size?: number; color: string }) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function cwvStatus(metric: string, value: number): { label: string; cls: string; statusCls: string } {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fcp: [1800, 3000],
    cls: [0.1, 0.25],
    inp: [200, 500],
    ttfb: [800, 1800],
  };
  const [good, poor] = thresholds[metric] ?? [0, 0];
  if (value <= good) return { label: "Good", cls: styles.cwvGood, statusCls: styles.cwvStatusGood };
  if (value <= poor) return { label: "개선 필요", cls: styles.cwvNeedsImprovement, statusCls: styles.cwvStatusWarning };
  return { label: "Poor", cls: styles.cwvPoor, statusCls: styles.cwvStatusPoor };
}

function gaugeColor(score: number): string {
  if (score >= 90) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function WipBadge() {
  return <span className={styles.wipBadge}>🔧 구현중</span>;
}

function LiveBadge() {
  return (
    <span className={styles.liveBadge}>
      <span className={styles.liveDot} />
      실시간
    </span>
  );
}

function ConfigBadge() {
  return <span className={styles.configBadge}>⚙️ 설정 필요</span>;
}

/* ═══════════════════════════════════════
   기존 유틸 & 상수
   ═══════════════════════════════════════ */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const CONTENT_ORIGIN = process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? "https://biocom.kr";

const resolveContentUrl = (rawUrl: string) => {
  const url = rawUrl.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${CONTENT_ORIGIN}${url}`;
  return `${CONTENT_ORIGIN}/${url}`;
};

const isColumnLikePage = (rawUrl: string) => {
  const full = resolveContentUrl(rawUrl);
  try {
    const u = new URL(full);
    const pathname = (u.pathname || "/").replace(/\/+$/, "") || "/";
    // biocom 칼럼은 주로 /healthinfo 아래에 존재합니다.
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

const normalizeComparableUrl = (rawUrl: string) => {
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

const isColumnIndexUrl = (rawUrl: string) => {
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

const pickRepresentativeColumnUrl = (urls: string[]) => {
  const cleaned = urls.map((u) => u?.trim()).filter(Boolean) as string[];
  if (cleaned.length === 0) return "";

  const preferDetail = cleaned.find((u) => isColumnLikePage(u) && !isColumnIndexUrl(u) && /(bmode=view|idx=)/i.test(u));
  if (preferDetail) return preferDetail;

  const anyDetail = cleaned.find((u) => isColumnLikePage(u) && !isColumnIndexUrl(u));
  if (anyDetail) return anyDetail;

  return cleaned[0] ?? "";
};

type PageSpeedReportResponse = {
  markdown: string;
  updatedAt: string;
};

type MdBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "hr" }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "p"; lines: string[] };

const parseMarkdownLite = (markdown: string): MdBlock[] => {
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

const renderInline = (text: string) => {
  const parts = text.split("`");
  return parts.map((part, idx) => {
    const isCode = idx % 2 === 1;
    if (isCode) return <code key={idx}>{part}</code>;
    return <span key={idx}>{part}</span>;
  });
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const dateNDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
};

const PRESET_DAYS: Record<Exclude<DatePreset, "custom">, number> = { "7d": 7, "28d": 28, "90d": 90 };
const PRESET_LABELS: Record<DatePreset, string> = { "7d": "최근 7일", "28d": "최근 28일", "90d": "최근 3개월", custom: "직접 입력" };
const DEVICE_LABELS: Record<string, string> = { DESKTOP: "데스크톱", MOBILE: "모바일", TABLET: "태블릿" };

const numberFormatter = new Intl.NumberFormat("ko-KR");
const decimalFormatter = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════ */
export default function Home() {
  /* 기존 state */
  const [siteUrl, setSiteUrl] = useState("sc-domain:biocom.kr");
  const [startDate, setStartDate] = useState(dateNDaysAgo(28));
  const [endDate, setEndDate] = useState(dateNDaysAgo(1));
  const [rowLimit, setRowLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GscRow[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "ok" | "error">("checking");
  const [datePreset, setDatePreset] = useState<DatePreset>("28d");

  /* 새 state */
  const [activeTab, setActiveTab] = useState(0);
  const [dataQueryOpen, setDataQueryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cwvStrategy, setCwvStrategy] = useState<"mobile" | "desktop">("mobile");
  const cwvStrategyRef = useRef(cwvStrategy);

  useEffect(() => {
    cwvStrategyRef.current = cwvStrategy;
  }, [cwvStrategy]);

  /* API 데이터 state */
  const [kpiData, setKpiData] = useState<KpiApiData | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[] | null>(null);
  const [keywordsData, setKeywordsData] = useState<KeywordData[] | null>(null);
  const [keywordsDateRange, setKeywordsDateRange] = useState<{ start: string; end: string } | null>(null);
  const [keywordRangePreset, setKeywordRangePreset] = useState<KeywordRangePreset>("7d");
  const [keywordDatePickerOpen, setKeywordDatePickerOpen] = useState(false);
  const [keywordStartInput, setKeywordStartInput] = useState(dateNDaysAgo(10));
  const [keywordEndInput, setKeywordEndInput] = useState(dateNDaysAgo(3));
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [opportunityKeyword, setOpportunityKeyword] = useState<KeywordData | null>(null);
  const [columnsData, setColumnsData] = useState<ColumnData[] | null>(null);
  const [columnPagesData, setColumnPagesData] = useState<ColumnData[] | null>(null);
  const [columnsDateRange, setColumnsDateRange] = useState<{ start: string; end: string } | null>(null);
  const [cwvRealData, setCwvRealData] = useState<CwvPageData[] | null>(null);
  const [cwvLoading, setCwvLoading] = useState(false);
  const [pageSpeedHistory, setPageSpeedHistory] = useState<PageSpeedApiResult[] | null>(null);
  const [pageSpeedHistoryLoading, setPageSpeedHistoryLoading] = useState(false);
  const [pageSpeedHistoryError, setPageSpeedHistoryError] = useState<string | null>(null);
  const [cwvTestUrl, setCwvTestUrl] = useState("https://biocom.kr");
  const [behaviorData, setBehaviorData] = useState<BehaviorData[] | null>(null);
  const [behaviorRangePreset, setBehaviorRangePreset] = useState<BehaviorRangePreset>("30d");
  const [behaviorDatePickerOpen, setBehaviorDatePickerOpen] = useState(false);
  const [behaviorStartInput, setBehaviorStartInput] = useState(dateNDaysAgo(30));
  const [behaviorEndInput, setBehaviorEndInput] = useState(dateNDaysAgo(1));
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorDateRange, setBehaviorDateRange] = useState<{ start: string; end: string } | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStep[] | null>(null);
  const [aeoScore, setAeoScore] = useState<AeoGeoApiResult | null>(null);
  const [geoScore, setGeoScore] = useState<AeoGeoApiResult | null>(null);
  const [aeoGeoTargetUrl, setAeoGeoTargetUrl] = useState<string | null>(null);
  const [pageSpeedReport, setPageSpeedReport] = useState<PageSpeedReportResponse | null>(null);
  const [pageSpeedReportLoading, setPageSpeedReportLoading] = useState(false);
  const [pageSpeedReportError, setPageSpeedReportError] = useState<string | null>(null);

  /* 키워드 인텐트 분석 */
  const [intentData, setIntentData] = useState<IntentApiResponse | null>(null);

  /* AI 인사이트 (ChatGPT) */
  const [aiInsights, setAiInsights] = useState<AiInsight[] | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsTime, setAiInsightsTime] = useState<string | null>(null);

  /* AI 채팅 (ChatGPT) */
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "안녕하세요! BiocomAI SEO 어시스턴트입니다. AEO/GEO 최적화에 대해 무엇이든 물어보세요." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  /* 스크롤 캡처 */
  const pageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [isAeoOpen, setIsAeoOpen] = useState(false);
  const [isGeoOpen, setIsGeoOpen] = useState(false);
  const [openBreakdownItems, setOpenBreakdownItems] = useState<Record<string, boolean>>({});

  /* 칼럼 분석 탭 state */
  const [colShowAll, setColShowAll] = useState(false);
  const [colSearch, setColSearch] = useState("");
  const [colSortKey, setColSortKey] = useState<"clicks" | "impressions" | "ctr" | "position" | "score">("clicks");
  const [colSortAsc, setColSortAsc] = useState(false);
  const [otherShowAll, setOtherShowAll] = useState(false);
  const [otherSortKey, setOtherSortKey] = useState<"clicks" | "impressions" | "ctr" | "position" | "score">("clicks");
  const [otherSortAsc, setOtherSortAsc] = useState(false);
  const [colRangePreset, setColRangePreset] = useState<KeywordRangePreset>("7d");
  const [colDatePickerOpen, setColDatePickerOpen] = useState(false);
  const [colStartInput, setColStartInput] = useState(dateNDaysAgo(10));
  const [colEndInput, setColEndInput] = useState(dateNDaysAgo(3));
  const [colLoading, setColLoading] = useState(false);

  /* 페이지 진단 state */
  const [diagUrl, setDiagUrl] = useState("https://biocom.kr/healthinfo");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagCrawlResult, setDiagCrawlResult] = useState<CrawlAnalysisResult | null>(null);
  const [diagAeoScore, setDiagAeoScore] = useState<AeoGeoApiResult | null>(null);
  const [diagGeoScore, setDiagGeoScore] = useState<AeoGeoApiResult | null>(null);

  /* ── AI 채팅 전송 ── */
  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatSending(true);

    try {
      // API 전송용 메시지 포맷 변환
      const apiMessages = [...chatMessages.filter((m) => m.role !== "ai" || chatMessages.indexOf(m) > 0), { role: "user" as const, text }]
        .map((m) => ({
          role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
          content: m.text,
        }));

      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error("응답 실패");
      const data = (await res.json()) as { reply: string };
      setChatMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "ai", text: "죄송합니다, 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." }]);
    } finally {
      setChatSending(false);
    }
  }, [chatInput, chatSending, chatMessages]);

  // 채팅 메시지 추가 시 스크롤
  useEffect(() => {
    chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  /* ── 스크롤 캡처 핸들러 ── */
  const handleScrollCapture = useCallback(async () => {
    const page = pageRef.current;
    const main = mainRef.current;
    // nav까지 포함하려면 page를 캡처 대상으로 사용합니다.
    const target = page ?? main;
    if (!target || capturing) return;

    setCapturing(true);

    // 캡처 준비: sticky nav → static, chatFab 숨기기
    const nav = (main?.previousElementSibling as HTMLElement | null) ?? null;
    const chatFab = document.querySelector(`.${styles.chatFab}`) as HTMLElement | null;
    const chatPanel = document.querySelector(`.${styles.chatPanel}`) as HTMLElement | null;

    const origNavPosition = nav?.style.position ?? "";
    const origNavTop = nav?.style.top ?? "";
    const origNavZIndex = nav?.style.zIndex ?? "";
    const origFabDisplay = chatFab?.style.display ?? "";
    const origPanelDisplay = chatPanel?.style.display ?? "";

    try {
      if (nav) {
        nav.style.position = "static";
        nav.style.top = "auto";
        nav.style.zIndex = "auto";
      }
      if (chatFab) chatFab.style.display = "none";
      if (chatPanel) chatPanel.style.display = "none";

      // scrollHeight, offsetHeight, getBoundingClientRect 중 가장 큰 값 사용
      const rect = target.getBoundingClientRect();
      const totalHeight = Math.max(target.scrollHeight, target.offsetHeight, Math.ceil(rect.height));
      const totalWidth = Math.max(target.scrollWidth, target.offsetWidth, Math.ceil(rect.width));
      const segmentHeight = 2000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const segmentCount = Math.ceil(totalHeight / segmentHeight);

      // 최종 캔버스 생성
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = totalWidth * dpr;
      finalCanvas.height = totalHeight * dpr;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context 생성 실패");

      // 세그먼트별 캡처
      for (let i = 0; i < segmentCount; i++) {
        const y = i * segmentHeight;
        const height = Math.min(segmentHeight, totalHeight - y);

        const segCanvas = await html2canvas(target, {
          y,
          height,
          width: totalWidth,
          scale: dpr,
          useCORS: true,
          logging: false,
          // 캡처용 UI 오버레이(회색 마스크)는 결과 이미지에 포함되지 않게 제외합니다.
          ignoreElements: (el) => (el as HTMLElement | null)?.classList?.contains(styles.captureOverlay) ?? false,
          // html2canvas는 DOM을 클론해서 렌더링하는데, 클론 시점에 CSS animation이 "초기 상태"로
          // 다시 시작되면(특히 delay가 있으면) 일부 섹션이 투명(=빈 화면)으로 캡처될 수 있습니다.
          // 캡처용 클론 DOM에서만 애니메이션/트랜지션을 비활성화해 항상 최종 상태로 렌더링합니다.
          onclone: (doc) => {
            const style = doc.createElement("style");
            style.textContent = `
              *, *::before, *::after {
                animation: none !important;
                transition: none !important;
              }
              .${styles.insightCard} {
                opacity: 1 !important;
                transform: none !important;
              }
              /* html2canvas는 background-clip:text를 지원하지 않아 gradient가 박스로 보임 → fallback */
              .${styles.navBrandAccent} {
                background: none !important;
                -webkit-background-clip: unset !important;
                background-clip: unset !important;
                -webkit-text-fill-color: #2dd4bf !important;
                color: #2dd4bf !important;
              }
              /* 캡처 시 overflow 강제 해제하여 하단 콘텐츠 누락 방지 */
              .${styles.page}, .${styles.main} {
                overflow: visible !important;
              }
            `;
            doc.head.appendChild(style);
          },
          windowHeight: totalHeight,
        });

        ctx.drawImage(segCanvas, 0, y * dpr, segCanvas.width, height * dpr);
      }

      // PNG 다운로드
      finalCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const tabName = NAV_TABS[activeTab] ?? "page";
        const ts = new Date().toISOString().slice(0, 10);
        a.download = `BiocomAI_${tabName}_${ts}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("캡처 실패:", err);
    } finally {
      // 스타일 복원
      if (nav) {
        nav.style.position = origNavPosition;
        nav.style.top = origNavTop;
        nav.style.zIndex = origNavZIndex;
      }
      if (chatFab) chatFab.style.display = origFabDisplay;
      if (chatPanel) chatPanel.style.display = origPanelDisplay;
      setCapturing(false);
    }
  }, [capturing, activeTab]);

  const loadKeywords = useCallback(async (params: { days?: 7 | 30; startDate?: string; endDate?: string; signal?: AbortSignal }) => {
    setKeywordsLoading(true);
    setKeywordsError(null);

    const qs = new URLSearchParams({ limit: "50" });
    if (params.days) qs.set("days", String(params.days));
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);

    try {
      const res = await fetch(`${API_BASE_URL}/api/gsc/keywords?${qs.toString()}`, {
        signal: params.signal,
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as
        | (ApiKeywordsResponse & { startDate?: string; endDate?: string; message?: string })
        | null;

      if (!res.ok || !data) {
        throw new Error(data?.message ?? "키워드 데이터를 불러오지 못했습니다.");
      }

      const resolvedStart = data.startDate ?? params.startDate ?? "";
      const resolvedEnd = data.endDate ?? params.endDate ?? "";
      if (resolvedStart && resolvedEnd) {
        setKeywordsDateRange({ start: resolvedStart, end: resolvedEnd });
        setKeywordStartInput(resolvedStart);
        setKeywordEndInput(resolvedEnd);
      }

      if (data.keywords) {
        setKeywordsData(
          data.keywords.map((k) => ({
            query: k.query,
            clicks: k.clicks,
            impressions: k.impressions,
            ctr: k.ctr,
            position: k.position,
            isQA: k.isQA,
            featured: false,
            delta: 0,
            opportunity: k.opportunity,
          })),
        );
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      setKeywordsError(e instanceof Error ? e.message : "키워드 데이터를 불러오지 못했습니다.");
    } finally {
      setKeywordsLoading(false);
    }
  }, []);

  const loadColumns = useCallback(async (params: { days?: 7 | 30; startDate?: string; endDate?: string }) => {
    setColLoading(true);
    const qs = new URLSearchParams({ limit: "60", category: "columns" });
    if (params.days) qs.set("days", String(params.days));
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    const mapCol = (c: { title: string; url: string; clicks: number; impressions: number; ctr: number; position: number; score: number; search: number; tech: number; engage: number; aeo: number }) => ({
      title: c.title, url: c.url, clicks: c.clicks, impressions: c.impressions, ctr: c.ctr, position: c.position, score: c.score, search: c.search, tech: c.tech, engage: c.engage, aeo: c.aeo,
    });
    try {
      const [colRes, allRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/gsc/columns?${qs.toString()}`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/gsc/columns?${new URLSearchParams({ limit: "30", ...(params.days ? { days: String(params.days) } : {}), ...(params.startDate ? { startDate: params.startDate, endDate: params.endDate! } : {}) }).toString()}`, { cache: "no-store" }),
      ]);
      const colData = await colRes.json().catch(() => null) as (ApiColumnsResponse & { startDate?: string; endDate?: string }) | null;
      const allData = await allRes.json().catch(() => null) as (ApiColumnsResponse & { startDate?: string; endDate?: string }) | null;
      if (colData?.startDate && colData?.endDate) {
        setColumnsDateRange({ start: colData.startDate, end: colData.endDate });
        setColStartInput(colData.startDate);
        setColEndInput(colData.endDate);
      }
      if (colData?.columns) setColumnPagesData(colData.columns.map(mapCol));
      if (allData?.columns) setColumnsData(allData.columns.map(mapCol));
    } catch { /* ignore */ }
    setColLoading(false);
  }, []);

  const BEHAVIOR_PRESET_DAYS: Record<Exclude<BehaviorRangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

  const loadBehavior = useCallback(async (params: { days?: number; startDate?: string; endDate?: string; signal?: AbortSignal }) => {
    setBehaviorLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (params.startDate && params.endDate) {
        qs.set("startDate", params.startDate);
        qs.set("endDate", params.endDate);
      } else if (params.days) {
        qs.set("startDate", `${params.days}daysAgo`);
        qs.set("endDate", "yesterday");
      }

      const res = await fetch(`${API_BASE_URL}/api/ga4/engagement?${qs.toString()}`, {
        signal: params.signal,
        cache: "no-store",
      });

      if (!res.ok) throw new Error();
      const d = await res.json() as { rows?: BehaviorData[]; startDate?: string; endDate?: string };

      if (d.rows && d.rows.length > 0) {
        setBehaviorData(d.rows.map((r) => ({
          page: (r as unknown as Record<string, unknown>).pagePath as string ?? r.page,
          sessions: r.sessions,
          users: r.users,
          avgTime: (r as unknown as Record<string, unknown>).avgEngagementTime as number ?? r.avgTime,
          bounceRate: r.bounceRate,
          scrollDepth: r.scrollDepth ?? 0,
          conversions: r.conversions,
        })));
      }

      // 날짜 범위 표시 업데이트
      const resolvedStart = d.startDate ?? params.startDate ?? (params.days ? dateNDaysAgo(params.days) : "");
      const resolvedEnd = d.endDate ?? params.endDate ?? dateNDaysAgo(1);
      if (resolvedStart && resolvedEnd) {
        setBehaviorDateRange({ start: resolvedStart.replace("daysAgo", "일전"), end: resolvedEnd === "yesterday" ? dateNDaysAgo(1) : resolvedEnd });
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      // 실패 시 mock 유지 (기존 동작)
    } finally {
      setBehaviorLoading(false);
    }
  }, []);

  const loadPageSpeedHistory = useCallback(async (params?: { limit?: number; signal?: AbortSignal }) => {
    const limit = Math.max(1, Math.min(200, params?.limit ?? 50));
    setPageSpeedHistoryLoading(true);
    setPageSpeedHistoryError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/pagespeed/results?limit=${limit}`, {
        signal: params?.signal,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { results?: PageSpeedApiResult[]; message?: string } | null;
      if (!res.ok || !data) throw new Error(data?.message ?? "PageSpeed 측정 결과를 불러오지 못했습니다.");

      const results = data.results ?? [];
      setPageSpeedHistory(results);

      // CWV 탭 요약 표는 "페이지별 최신 1건"만 보여주기 위해 URL 기준으로 최신값만 남깁니다.
      const latestByUrl = new Map<string, PageSpeedApiResult>();
      for (const r of results) {
        if (!latestByUrl.has(r.url)) latestByUrl.set(r.url, r);
      }
      const latestResults = Array.from(latestByUrl.values());

      setCwvRealData(
        latestResults.map((r) => ({
          url: r.url,
          label: r.url.replace(/^https?:\/\//, ""),
          performance: r.performanceScore,
          seo: r.seoScore,
          accessibility: r.accessibilityScore,
          lcp: r.lcpMs,
          fcp: r.fcpMs,
          cls: r.cls,
          inp: r.inpMs ?? 0,
          ttfb: r.ttfbMs,
        })),
      );
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      setPageSpeedHistoryError(e instanceof Error ? e.message : "PageSpeed 측정 결과를 불러오지 못했습니다.");
    } finally {
      setPageSpeedHistoryLoading(false);
    }
  }, []);

  const refreshAeoGeoScores = useCallback(async (params: { targetUrl: string | null; strategy?: "mobile" | "desktop"; signal?: AbortSignal }) => {
    try {
      const strategy = params.strategy ?? cwvStrategyRef.current;
      const qs = new URLSearchParams();
      if (params.targetUrl) qs.set("url", params.targetUrl);
      qs.set("strategy", strategy);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";

      const [aeoRes, geoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/aeo/score${suffix}`, { signal: params.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/api/geo/score${suffix}`, { signal: params.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (aeoRes?.type === "AEO") setAeoScore(aeoRes as AeoGeoApiResult);
      if (geoRes?.type === "GEO") setGeoScore(geoRes as AeoGeoApiResult);
    } catch {
      // ignore
    }
  }, []);

  /* 기존 useEffect */
  useEffect(() => {
    const controller = new AbortController();
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("fail");
        setConnectionStatus("ok");
      } catch {
        setConnectionStatus("error");
      }
    };
    void checkBackendConnection();
    return () => controller.abort();
  }, []);

  // PageSpeed 히스토리에 "대표 URL" 측정 리포트가 들어오면 GEO의 기술 점수 등을 갱신합니다.
  useEffect(() => {
    if (!aeoGeoTargetUrl) return;
    if (!pageSpeedHistory || pageSpeedHistory.length === 0) return;

    const targetKey = normalizeComparableUrl(aeoGeoTargetUrl);
    if (!targetKey) return;

    const hasTarget = pageSpeedHistory.some((r) => normalizeComparableUrl(r.url) === targetKey);
    if (!hasTarget) return;

    void refreshAeoGeoScores({ targetUrl: aeoGeoTargetUrl });
  }, [aeoGeoTargetUrl, pageSpeedHistory, refreshAeoGeoScores]);

  /* ── PageSpeed 보고서 로드(탭 진입 시) ── */
  useEffect(() => {
    if (activeTab !== 3) return;

    const controller = new AbortController();
    setPageSpeedReportLoading(true);
    setPageSpeedReportError(null);

    fetch("/api/pagespeed-report", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => null)) as { message?: string } | null;
          throw new Error(err?.message ?? "보고서를 불러오지 못했습니다.");
        }
        return r.json() as Promise<PageSpeedReportResponse>;
      })
      .then((d) => {
        setPageSpeedReport(d);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        setPageSpeedReportError(e instanceof Error ? e.message : "보고서를 불러오지 못했습니다.");
      })
      .finally(() => {
        setPageSpeedReportLoading(false);
      });

    return () => controller.abort();
  }, [activeTab]);

  /* ── 키워드 기회 상세(모달) ── */
  useEffect(() => {
    if (!opportunityKeyword) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpportunityKeyword(null);
    };

    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [opportunityKeyword]);

  useEffect(() => {
    if (activeTab !== 2) setOpportunityKeyword(null);
  }, [activeTab]);

  /* ── 실데이터 fetch (마운트 시) ── */
  useEffect(() => {
    const ac = new AbortController();
    const sig = ac.signal;

    // KPI (7일 요약 + 스파크라인)
    fetch(`${API_BASE_URL}/api/gsc/kpi`, { signal: sig })
      .then((r) => r.json())
      .then((d: KpiApiData) => { if (d.current) setKpiData(d); })
      .catch(() => {});

    // 30일 트렌드
    fetch(`${API_BASE_URL}/api/gsc/trends?days=30`, { signal: sig })
      .then((r) => r.json())
      .then((d: { trend?: TrendPoint[] }) => { if (d.trend) setTrendData(d.trend); })
      .catch(() => {});

    // 키워드 (Q&A 자동 태깅)
    void loadKeywords({ days: 7, signal: sig });

    // 칼럼별 분석
    fetch(`${API_BASE_URL}/api/gsc/columns?limit=30`, { signal: sig })
      .then((r) => r.json())
      .then((d: ApiColumnsResponse & { startDate?: string; endDate?: string }) => {
        if (d.startDate && d.endDate) setColumnsDateRange({ start: d.startDate, end: d.endDate });
        if (d.columns) {
          setColumnsData(d.columns.map((c) => ({
            title: c.title,
            url: c.url,
            clicks: c.clicks,
            impressions: c.impressions,
            ctr: c.ctr,
            position: c.position,
            score: c.score,
            search: c.search,
            tech: c.tech,
            engage: c.engage,
            aeo: c.aeo,
          })));
        }
      })
      .catch(() => {});

    // 칼럼(콘텐츠) 전용 조회: 전체 Top 페이지에 밀려 칼럼이 적게 노출되는 문제를 보완합니다.
    fetch(`${API_BASE_URL}/api/gsc/columns?limit=60&category=columns`, { signal: sig })
      .then((r) => r.json())
      .then((d: ApiColumnsResponse & { startDate?: string; endDate?: string }) => {
        if (d.startDate && d.endDate) setColumnsDateRange({ start: d.startDate, end: d.endDate });
        if (d.columns) {
          setColumnPagesData(d.columns.map((c) => ({
            title: c.title,
            url: c.url,
            clicks: c.clicks,
            impressions: c.impressions,
            ctr: c.ctr,
            position: c.position,
            score: c.score,
            search: c.search,
            tech: c.tech,
            engage: c.engage,
            aeo: c.aeo,
          })));
        }
      })
      .catch(() => {});

    // GA4 Engagement (기본 30일)
    void loadBehavior({ days: 30, signal: sig });

    // GA4 Funnel
    fetch(`${API_BASE_URL}/api/ga4/funnel`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { steps?: FunnelStep[] }) => { if (d.steps) setFunnelData(d.steps); })
      .catch(() => {});

    // PageSpeed 측정 결과(최근 기록) 로드
    void loadPageSpeedHistory({ signal: sig, limit: 50 });

    // AEO/GEO Score — GSC 상위 페이지 URL 기반 크롤링 포함
    fetch(`${API_BASE_URL}/api/gsc/columns?limit=60&category=columns`, { signal: sig, cache: "no-store" })
      .then((r) => r.json())
      .then((d: { columns?: { url: string }[] }) => {
        const urls = (d.columns ?? []).map((c) => c.url).filter(Boolean);
        const topUrl = pickRepresentativeColumnUrl(urls);
        setAeoGeoTargetUrl(topUrl || null);
        void refreshAeoGeoScores({ targetUrl: topUrl || null, signal: sig });
      })
      .catch(() => {
        // fallback: URL 없이 호출
        setAeoGeoTargetUrl(null);
        void refreshAeoGeoScores({ targetUrl: null, signal: sig });
      });

    // 키워드 인텐트 분석
    fetch(`${API_BASE_URL}/api/keywords/intent`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: IntentApiResponse) => {
        if (d.categories && d.categories.length > 0) {
          setIntentData(d);
        }
      })
      .catch(() => {});

    // AI 인사이트 (ChatGPT)
    setAiInsightsLoading(true);
    fetch(`${API_BASE_URL}/api/ai/insights`, { signal: sig })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { insights?: AiInsight[]; generatedAt?: string }) => {
        if (d.insights && d.insights.length > 0) {
          setAiInsights(d.insights);
          if (d.generatedAt) setAiInsightsTime(d.generatedAt);
        }
      })
      .catch(() => {})
      .finally(() => setAiInsightsLoading(false));

    return () => ac.abort();
  }, [loadKeywords, loadBehavior, loadPageSpeedHistory, refreshAeoGeoScores]);

  /* ── PageSpeed 수동 테스트 ── */
  const handleCwvTest = async () => {
    setCwvLoading(true);
    setPageSpeedHistoryError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pagespeed/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cwvTestUrl, strategy: cwvStrategy }),
      });
      const data = (await res.json().catch(() => null)) as (PageSpeedApiResult & { message?: string }) | null;
      if (!res.ok || !data?.url) throw new Error(data?.message ?? "PageSpeed 측정에 실패했습니다.");
      if (data.url) {
        const newEntry: CwvPageData = {
          url: data.url,
          label: data.url.replace(/^https?:\/\//, ""),
          performance: data.performanceScore,
          seo: data.seoScore,
          accessibility: data.accessibilityScore,
          lcp: data.lcpMs,
          fcp: data.fcpMs,
          cls: data.cls,
          inp: data.inpMs ?? 0,
          ttfb: data.ttfbMs,
        };
        setCwvRealData((prev) => {
          const existing = prev ?? [];
          const idx = existing.findIndex((p) => p.url === newEntry.url);
          if (idx >= 0) {
            const copy = [...existing];
            copy[idx] = newEntry;
            return copy;
          }
          return [...existing, newEntry];
        });

        // 측정 리포트 누적(최근 50건 유지)
        setPageSpeedHistory((prev) => {
          const existing = prev ?? [];
          return [data as PageSpeedApiResult, ...existing].slice(0, 50);
        });
      }
    } catch (e: unknown) {
      setPageSpeedHistoryError(e instanceof Error ? e.message : "PageSpeed 측정에 실패했습니다.");
    } finally {
      setCwvLoading(false);
    }
  };

  /* ── 페이지 진단 핸들러 ── */
  const handleDiagnosisTest = async () => {
    if (!diagUrl.trim()) return;
    setDiagLoading(true);
    setDiagError(null);
    setDiagCrawlResult(null);
    setDiagAeoScore(null);
    setDiagGeoScore(null);
    try {
      const crawlRes = await fetch(`${API_BASE_URL}/api/crawl/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: diagUrl.trim() }),
      });
      if (!crawlRes.ok) {
        const err = (await crawlRes.json().catch(() => null)) as { message?: string } | null;
        throw new Error(err?.message ?? "크롤링에 실패했습니다.");
      }
      const crawlData = (await crawlRes.json()) as CrawlAnalysisResult;
      setDiagCrawlResult(crawlData);

      const qs = new URLSearchParams();
      qs.set("url", diagUrl.trim());
      qs.set("strategy", cwvStrategyRef.current);
      const urlParam = `?${qs.toString()}`;
      const [aeoRes, geoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/aeo/score${urlParam}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/api/geo/score${urlParam}`).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (aeoRes?.type === "AEO") setDiagAeoScore(aeoRes as AeoGeoApiResult);
      if (geoRes?.type === "GEO") setDiagGeoScore(geoRes as AeoGeoApiResult);
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "진단에 실패했습니다.");
    } finally {
      setDiagLoading(false);
    }
  };

  const aeoGeoTargetResolved = useMemo(() => {
    return aeoGeoTargetUrl ? resolveContentUrl(aeoGeoTargetUrl) : "";
  }, [aeoGeoTargetUrl]);

  const toggleBreakdownItem = useCallback((type: "AEO" | "GEO", name: string) => {
    const key = `${type}:${name}`;
    setOpenBreakdownItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderBreakdownExplain = (type: "AEO" | "GEO", item: ScoreBreakdown) => {
    const target = aeoGeoTargetResolved;
    const targetShort = target ? target.replace(/^https?:\/\//i, "") : "";

    const keywordWindowHint = keywordsDateRange?.start && keywordsDateRange?.end
      ? `참고: 키워드/순위는 GSC 기준 ${keywordsDateRange.start} ~ ${keywordsDateRange.end} 데이터를 사용합니다.`
      : "참고: 키워드/순위는 GSC 최신 지연(약 2~3일)을 고려해 '약 최근 7일' 구간으로 측정합니다.";

    switch (item.name) {
      case "schema":
      case "schemaGeo": {
        const scoreRules = item.name === "schema"
          ? "점수 기준: FAQPage(+7) · Article(+5) · 저자(Person)(+4) · HowTo(+2) · Medical(+2) = 최대 20점"
          : "점수 기준: FAQPage(+8) · Article(+5) · 저자(Person)(+4) · Speakable(+3) = 최대 20점";

        return (
          <>
            <p className={styles.breakdownExplainLead}>
              이 항목은 대표 URL 1개를 크롤링해서 JSON-LD(Structured Data) 존재 여부를 확인합니다. 페이지 유형(메인/목록/상품/칼럼 상세)에 따라 Article/저자 정보가 없을 수도 있어, 결과가 다르게 나올 수 있습니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>{scoreRules}</li>
              <li>현재 대표 URL: {target ? <code>{targetShort}</code> : "미지정"}</li>
              <li>칼럼 목록 페이지(예: <code>biocom.kr/healthinfo</code>)는 Article/저자 스키마가 없어도 정상입니다.</li>
              <li>칼럼 상세 페이지(예: <code>biocom.kr/healthinfo?bmode=view&amp;idx=...</code>)는 NewsArticle/Person(author) 스키마가 포함될 수 있습니다.</li>
              <li>참고: JSON-LD의 <code>@type</code>은 중첩 구조(예: author 객체)에서도 탐지되도록 개선되어, 칼럼 상세 페이지의 저자 정보도 정상 감지됩니다.</li>
              <li>{keywordWindowHint}</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단에서 확인
              </button>
            </div>
          </>
        );
      }
      case "qaKeywords": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              검색어 중 ‘질문형(Q&amp;A)’ 의도를 가진 키워드 비중을 측정합니다. (예: “~이란”, “~하는 법”, “왜”, “어떻게”, “추천” 등)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: Q&amp;A 비중(%)을 0~20점으로 환산 (20% 이상이면 만점)</li>
              <li>개선 액션: Q&amp;A형 제목/소제목 추가, 본문에 짧은 결론(1~2문장) + 근거 + FAQ 섹션 구성</li>
              <li>개선 액션: People Also Ask/관련 질문을 기준으로 “질문-답변” 구조의 단락을 늘리기</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "visibility": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              전체 키워드 중 TOP3에 랭크된 키워드 비중을 가시성으로 환산합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: TOP3 비중을 0~15점으로 환산 (약 30% 이상이면 만점)</li>
              <li>개선 액션: 상위 노출이 필요한 핵심 칼럼의 제목/H1, 서브토픽(H2) 정렬, 내부링크(관련 글/제품) 강화</li>
              <li>개선 액션: 검색 의도에 맞는 “정의/비교/추천/부작용/복용법” 등 섹션 보강</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "contentStructure": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              대표 URL의 콘텐츠 구조(H2/H3, 목록/표/인용, 메타 디스크립션 등)를 점수화합니다. 칼럼 페이지처럼 정보성 콘텐츠에서 가장 영향이 큽니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: H2(4) · H3(3) · 목록(3) · 표(2) · 인용(2) · 메타 디스크립션(1) = 최대 15점</li>
              <li>개선 액션: H2를 “문제/원인/해결/주의/FAQ” 등으로 3개 이상 구성</li>
              <li>개선 액션: 체크리스트/비교표/근거 인용 블록을 최소 1개 이상 추가</li>
              <li>개선 액션: 메타 디스크립션 50~160자 내로 요약(‘누가/무엇을/왜/어떻게’) 추가</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단으로 구조 확인
              </button>
            </div>
          </>
        );
      }
      case "aiCitation": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              표본 키워드에서 Google AI Overview가 노출될 때, AI 답변의 ‘참고 링크’에 biocom.kr이 인용되는 빈도를 측정합니다. (SerpAPI 기반)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 인용률 10% 이상이면 20점 만점(보수적 스케일)</li>
              <li>개선 액션: 칼럼 본문에 1~2문장 요약(Answer-first), 근거(연구/가이드) 인용, Author/Organization 스키마 강화</li>
              <li>개선 액션: 동일 주제의 ‘핵심 질문’들을 FAQ로 확장하고 내부링크로 묶기</li>
              {unavailable ? <li>현재 상태: SerpAPI 미설정이면 측정 불가(SERP_API_KEY 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "aiTraffic": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              GA4에서 AI 추천 유입(예: chatgpt, perplexity, gemini 등)으로 들어온 세션 비중/절대량을 휴리스틱으로 점수화합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 비중(%) 또는 절대 세션 수(건) 중 더 높은 기준으로 0~10점 산정</li>
              <li>개선 액션: AI가 인용하기 쉬운 형태(정의/요약/표/FAQ)로 칼럼을 리라이팅하고 공유 가능한 랜딩 구성</li>
              <li>개선 액션: GA4에서 referral/source 분류가 깨지지 않도록 도메인/리디렉션/UTM 정리</li>
              {unavailable ? <li>현재 상태: GA4 API 미설정 또는 조회 실패(서비스 계정/속성 연결 확인 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "aiOverview": {
        const unavailable = item.status === "unavailable";
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              표본 키워드에서 Google AI Overview 노출 비중을 측정합니다. (SerpAPI 기반)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 표본의 30% 이상에서 AI Overview가 나오면 25점 만점</li>
              <li>개선 액션: Q&amp;A형 커버리지 확대 + FAQ/Article/Author 스키마 적용 + 근거/출처 보강</li>
              {unavailable ? <li>현재 상태: 유료 SERP API 미설정이면 측정 불가(SERP_API_KEY 필요)</li> : null}
            </ul>
          </>
        );
      }
      case "searchRank": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              사이트 전체 키워드의 TOP3/TOP10 분포를 기반으로 GEO의 ‘검색 경쟁력’을 계산합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: TOP3 비중을 더 크게 반영(+40 가중)하고 TOP10 비중도 일부 반영(+10 가중)해 0~20점 산정</li>
              <li>개선 액션: TOP4~10 구간 키워드(‘올라갈 여지’가 큰 키워드)에 집중해 제목/본문/내부링크/스키마를 보강</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      case "contentTrust": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              대표 URL의 신뢰도 신호(근거 인용, 데이터 표, 체계적 목록, 충분한 분량)를 점수화합니다. YMYL(건강) 주제에서 특히 중요합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 인용(5) · 표(4) · 목록(3) · 1000단어+(3) = 최대 15점</li>
              <li>개선 액션: 근거 링크/출처를 인용 블록으로 분리하고, 핵심 수치/요약을 표로 정리</li>
              <li>개선 액션: 글 말미에 ‘요약/주의사항/FAQ’로 구조를 고정</li>
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setDiagUrl(target);
                  setActiveTab(6);
                }}
                disabled={!target}
              >
                페이지 진단으로 근거/구조 확인
              </button>
            </div>
          </>
        );
      }
      case "cwv": {
        const latest = (() => {
          if (!target) return null;
          const key = normalizeComparableUrl(target);
          const strategy = cwvStrategyRef.current;
          const match = (pageSpeedHistory ?? []).find((r) => normalizeComparableUrl(r.url) === key && r.strategy === strategy);
          return match ?? null;
        })();

        return (
          <>
            <p className={styles.breakdownExplainLead}>
              PageSpeed Insights의 Performance 점수를 기반으로 기술 성능을 0~10점으로 환산합니다. (예: Performance 83점 → 8/10)
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: Performance 점수 / 10 → 0~10점</li>
              <li>현재 대표 URL: {target ? <code>{targetShort}</code> : "미지정"}</li>
              {latest ? (
                <li>
                  최근 측정({latest.strategy}): Performance {latest.performanceScore}점 · LCP {numberFormatter.format(latest.lcpMs)}ms · FCP {numberFormatter.format(latest.fcpMs)}ms · 측정 {new Date(latest.measuredAt).toLocaleString("ko-KR")}
                </li>
              ) : (
                <li>최근 측정 리포트가 없습니다. 아래 버튼으로 바로 측정할 수 있습니다.</li>
              )}
            </ul>
            <div className={styles.breakdownActionRow}>
              <button
                type="button"
                className={styles.breakdownActionBtn}
                onClick={() => {
                  if (!target) return;
                  setCwvTestUrl(target);
                  setActiveTab(4);
                }}
                disabled={!target}
              >
                Core Web Vitals에서 이 URL 측정
              </button>
            </div>
          </>
        );
      }
      case "ctrTrend": {
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              최근 7일과 이전 7일의 평균 CTR 변화를 비교해 GEO 점수에 반영합니다.
            </p>
            <ul className={styles.breakdownExplainList}>
              <li>점수 기준: 5점을 기준으로 CTR 변화폭(+/-)에 따라 0~10점으로 조정</li>
              <li>개선 액션: TOP 노출 페이지의 타이틀/메타 디스크립션을 ‘검색 의도+혜택’ 중심으로 개선, 구조화 데이터로 리치 결과 확보</li>
              <li>{keywordWindowHint}</li>
            </ul>
          </>
        );
      }
      default:
        return (
          <>
            <p className={styles.breakdownExplainLead}>
              이 항목은 {type} 점수 산출의 하위 지표입니다. 현재 값과 개선 액션은 상세 로직(backend scoring)을 기준으로 표시됩니다.
            </p>
          </>
        );
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setStartDate(dateNDaysAgo(PRESET_DAYS[preset]));
      setEndDate(dateNDaysAgo(1));
    }
  };

  const summary = useMemo(() => {
    return rows.reduce<{ clicks: number; impressions: number; positionTotal: number }>(
      (acc, row) => {
        acc.clicks += row.clicks ?? 0;
        acc.impressions += row.impressions ?? 0;
        acc.positionTotal += row.position ?? 0;
        return acc;
      },
      { clicks: 0, impressions: 0, positionTotal: 0 },
    );
  }, [rows]);

  const averageCtr = summary.impressions === 0 ? 0 : summary.clicks / summary.impressions;
  const averagePosition = rows.length === 0 ? 0 : summary.positionTotal / rows.length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gsc/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrl || undefined, startDate, endDate, dimensions: ["page", "query", "device"], rowLimit, startRow: 0, type: "web" }),
      });
      const payload = (await response.json()) as GscQueryResponse & { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "검색 데이터 조회에 실패했습니다");
      setRows(payload.rows ?? []);
    } catch (submitError) {
      setRows([]);
      setError(submitError instanceof Error ? submitError.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const connectionLabel = connectionStatus === "ok" ? "서버 연결됨" : connectionStatus === "error" ? "서버 연결 실패" : "서버 확인 중...";

  /* CWV 데이터: 실데이터 우선, 없으면 mock */
  const cwvHasReal = cwvRealData !== null && cwvRealData.length > 0;
  const cwvPages = cwvHasReal ? cwvRealData : (cwvStrategy === "mobile" ? MOCK_CWV_MOBILE : MOCK_CWV_DESKTOP);
  const cwvAvg = {
    performance: Math.round(cwvPages.reduce((s, p) => s + p.performance, 0) / cwvPages.length),
    seo: Math.round(cwvPages.reduce((s, p) => s + p.seo, 0) / cwvPages.length),
    accessibility: Math.round(cwvPages.reduce((s, p) => s + p.accessibility, 0) / cwvPages.length),
  };

  /* 실제 키워드/칼럼 데이터 (API → fallback mock) */
  const liveKeywords = keywordsData ?? MOCK_KEYWORDS;
  const liveColumns = columnsData ?? MOCK_COLUMNS;
  const liveBehavior = behaviorData ?? MOCK_BEHAVIOR;
  const liveFunnel = funnelData ?? FUNNEL_STEPS;
  const columnOnlyPages = useMemo(() => {
    const base = columnPagesData && columnPagesData.length > 0 ? columnPagesData : liveColumns;
    return base.filter((c) => isColumnLikePage(c.url));
  }, [columnPagesData, liveColumns]);
  const otherPages = useMemo(() => liveColumns.filter((c) => !isColumnLikePage(c.url)), [liveColumns]);
  const columnKpis = useMemo(() => {
    const cols = columnOnlyPages;
    const total = cols.length;
    const clicked = cols.filter((c) => (c.clicks ?? 0) > 0).length;
    const avgScore = total > 0 ? cols.reduce((s, c) => s + (c.score ?? 0), 0) / total : 0;
    const top10 = [...cols].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
    const top10AvgCtr = top10.length > 0 ? top10.reduce((s, c) => s + (c.ctr ?? 0), 0) / top10.length : 0;
    const clickedRate = total > 0 ? (clicked / total) * 100 : 0;
    return { total, clicked, clickedRate, top10AvgCtr, avgScore };
  }, [columnOnlyPages]);

  /* 칼럼 테이블 정렬·검색·페이징 */
  const sortCol = useCallback((arr: typeof columnOnlyPages, key: typeof colSortKey, asc: boolean) => {
    return [...arr].sort((a, b) => {
      const va = key === "score" ? (a.score ?? 0) : key === "clicks" ? (a.clicks ?? 0) : key === "impressions" ? (a.impressions ?? 0) : key === "ctr" ? (a.ctr ?? 0) : (a.position ?? 0);
      const vb = key === "score" ? (b.score ?? 0) : key === "clicks" ? (b.clicks ?? 0) : key === "impressions" ? (b.impressions ?? 0) : key === "ctr" ? (b.ctr ?? 0) : (b.position ?? 0);
      return asc ? va - vb : vb - va;
    });
  }, []);
  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    const base = q ? columnOnlyPages.filter((c) => c.title.toLowerCase().includes(q) || c.url.toLowerCase().includes(q)) : columnOnlyPages;
    return sortCol(base, colSortKey, colSortAsc);
  }, [columnOnlyPages, colSearch, colSortKey, colSortAsc, sortCol]);
  const visibleCols = colShowAll ? filteredCols : filteredCols.slice(0, 10);
  const sortedOther = useMemo(() => sortCol(otherPages, otherSortKey, otherSortAsc), [otherPages, otherSortKey, otherSortAsc, sortCol]);
  const visibleOther = otherShowAll ? sortedOther : sortedOther.slice(0, 10);

  const handleColSort = (key: typeof colSortKey) => {
    if (colSortKey === key) { setColSortAsc((v) => !v); } else { setColSortKey(key); setColSortAsc(false); }
  };
  const handleOtherSort = (key: typeof otherSortKey) => {
    if (otherSortKey === key) { setOtherSortAsc((v) => !v); } else { setOtherSortKey(key); setOtherSortAsc(false); }
  };

  const keywordRangeLabel = keywordRangePreset === "7d" ? "최근 7일" : keywordRangePreset === "30d" ? "최근 30일" : "기간 지정";
  const behaviorRangeLabel = behaviorRangePreset === "7d" ? "최근 7일" : behaviorRangePreset === "30d" ? "최근 30일" : behaviorRangePreset === "90d" ? "최근 90일" : "기간 지정";

  const aiOptimizationTasks = useMemo<OptimizationTask[]>(() => {
    const tasks: OptimizationTask[] = [];

    const schemaItem =
      aeoScore?.breakdown.find((b) => b.name === "schema") ??
      geoScore?.breakdown.find((b) => b.name === "schemaGeo") ??
      null;
    const schemaDetail = schemaItem?.detail ?? "";
    const schemaMeasured = schemaItem?.status === "measured";

    const hasFaq = schemaMeasured && /FAQPage\s*✅/.test(schemaDetail);
    const hasArticle = schemaMeasured && /Article\s*✅/.test(schemaDetail);
    const hasAuthor = schemaMeasured && /(저자 정보|저자).*✅/.test(schemaDetail);
    const hasSpeakable = schemaMeasured && /Speakable\s*✅/.test(schemaDetail);

    const schemaTarget = aeoGeoTargetUrl ? `대상: ${aeoGeoTargetUrl}` : "대상: (대표 페이지 URL 확인 필요)";
    const schemaHint = schemaMeasured ? `${schemaDetail}\n${schemaTarget}` : `${schemaDetail || "페이지 크롤링/측정 후 확인 가능합니다."}\n${schemaTarget}`;

    tasks.push({ id: "schema_faq", text: "FAQ 스키마 마크업 추가", done: hasFaq, detail: schemaHint });
    tasks.push({ id: "schema_article", text: "Article 스키마 마크업 추가", done: hasArticle, detail: schemaHint });
    tasks.push({ id: "schema_author", text: "저자(Person) 정보 구조화", done: hasAuthor, detail: schemaHint });
    tasks.push({ id: "schema_speakable", text: "Speakable(음성검색) 스키마 적용", done: hasSpeakable, detail: schemaHint });

    const contentItem = aeoScore?.breakdown.find((b) => b.name === "contentStructure") ?? null;
    const contentMeasured = contentItem?.status === "measured";
    const contentDetail = contentItem?.detail ?? "";
    const metaOk = contentMeasured && /메타 디스크립션\s*✅/.test(contentDetail);
    tasks.push({
      id: "meta_description",
      text: "메타 디스크립션 최적화",
      done: metaOk,
      detail: contentMeasured ? contentDetail : contentDetail || "페이지 크롤링/측정 후 확인 가능합니다.",
    });

    if (keywordsData) {
      const opportunities = keywordsData.filter((k) => k.opportunity);
      const examples = opportunities
        .slice(0, 3)
        .map((k) => `${k.query} (노출 ${numberFormatter.format(k.impressions)}, CTR ${decimalFormatter.format(k.ctr)}%)`)
        .join(" / ");
      tasks.push({
        id: "opportunity_keywords",
        text: `기회 키워드 ${opportunities.length}개 개선`,
        done: opportunities.length === 0,
        detail:
          opportunities.length > 0
            ? `기준: 노출 > 500 & CTR < 2%\n예시: ${examples}`
            : "현재 기준(노출 > 500 & CTR < 2%)에 해당하는 키워드가 없습니다.",
      });
    } else {
      tasks.push({
        id: "opportunity_keywords",
        text: "기회 키워드 탐지/개선(노출↑ CTR↓)",
        done: false,
        detail: "키워드 데이터 로드 대기 또는 GSC 연동이 필요합니다.",
      });
    }

    const historyCount = pageSpeedHistory?.length ?? 0;
    tasks.push({
      id: "pagespeed_history",
      text: "PageSpeed 측정 리포트 누적",
      done: historyCount > 0,
      detail: historyCount > 0 ? `최근 측정 ${historyCount}건` : "Core Web Vitals 탭에서 측정하면 자동 누적됩니다.",
    });

    if (cwvHasReal) {
      const avgLcp = Math.round(cwvPages.reduce((s, p) => s + p.lcp, 0) / cwvPages.length);
      const avgFcp = Math.round(cwvPages.reduce((s, p) => s + p.fcp, 0) / cwvPages.length);
      const lcpOk = avgLcp <= 2500;
      const fcpOk = avgFcp <= 1800;
      tasks.push({
        id: "cwv_lcp_fcp",
        text: "Core Web Vitals 최적화(LCP/FCP)",
        done: lcpOk && fcpOk,
        detail: `기준: ${cwvStrategy === "mobile" ? "모바일" : "데스크톱"}\n현재: Performance ${cwvAvg.performance}점, LCP ${(avgLcp / 1000).toFixed(1)}초, FCP ${(avgFcp / 1000).toFixed(1)}초`,
      });
    } else {
      tasks.push({
        id: "cwv_lcp_fcp",
        text: "Core Web Vitals 실측(PageSpeed) 실행",
        done: false,
        detail: "Core Web Vitals 탭에서 URL을 입력하고 측정하세요.",
      });
    }

    tasks.push({
      id: "ai_insights",
      text: "AI 인사이트 자동 생성/갱신",
      done: !!(aiInsights && aiInsights.length > 0),
      detail:
        aiInsights && aiInsights.length > 0
          ? `생성 시각: ${aiInsightsTime ? new Date(aiInsightsTime).toLocaleString("ko-KR") : "—"}`
          : "OPENAI_API_KEY 설정 시 자동 생성됩니다.",
    });

    return tasks;
  }, [aeoScore, geoScore, aeoGeoTargetUrl, keywordsData, pageSpeedHistory, cwvHasReal, cwvPages, cwvStrategy, cwvAvg.performance, aiInsights, aiInsightsTime]);

  const doneCount = aiOptimizationTasks.filter((t) => t.done).length;

  /* ── 페이지 진단: 감점 요인 자동 생성 ── */
  const diagnosisItems = useMemo<DiagnosisItem[]>(() => {
    if (!diagCrawlResult) return [];
    const { schema, content } = diagCrawlResult;
    const items: DiagnosisItem[] = [];

    // Schema 감점 요인
    if (!schema.hasFAQ) items.push({ category: "Schema", issue: "FAQPage 스키마 없음", priority: "urgent", recommendation: "FAQ 섹션을 추가하고 FAQPage 스키마를 적용하면 AI 검색에서 답변 소스로 선택될 확률이 높아집니다." });
    if (!schema.hasArticle) items.push({ category: "Schema", issue: "Article 스키마 없음", priority: "urgent", recommendation: "Article 또는 NewsArticle 스키마를 추가하여 콘텐츠의 제목, 작성일, 저자 정보를 구조화하세요." });
    if (!schema.hasAuthor) items.push({ category: "Schema", issue: "저자 정보(Person) 없음", priority: "important", recommendation: "저자 정보를 Person 스키마로 추가하면 E-E-A-T 신뢰도가 향상됩니다." });
    if (!schema.hasHowTo) items.push({ category: "Schema", issue: "HowTo 스키마 없음", priority: "optional", recommendation: "단계별 가이드 콘텐츠가 있다면 HowTo 스키마를 추가하여 리치 결과를 노릴 수 있습니다." });
    if (!schema.hasMedical) items.push({ category: "Schema", issue: "의료/건강 스키마 없음", priority: "important", recommendation: "MedicalWebPage 또는 HealthTopicContent 스키마를 추가하여 건강 콘텐츠 신뢰성을 강화하세요." });
    if (!schema.hasSpeakable) items.push({ category: "Schema", issue: "Speakable 스키마 없음", priority: "optional", recommendation: "Speakable 스키마를 추가하면 음성 검색(Google Assistant)에서 콘텐츠가 읽힐 수 있습니다." });

    // 콘텐츠 감점 요인
    if (content.h2Count < 3) items.push({ category: "콘텐츠", issue: `H2 제목 태그 ${content.h2Count}개 (3개 미만)`, priority: "urgent", recommendation: "H2 태그로 콘텐츠를 주제별로 분할하면 검색엔진이 구조를 이해하기 쉬워집니다. 최소 3개 이상 권장합니다." });
    if (content.h3Count === 0) items.push({ category: "콘텐츠", issue: "H3 소제목 없음", priority: "important", recommendation: "H3 태그로 세부 항목을 구분하면 콘텐츠 깊이가 향상됩니다." });
    if (content.listCount === 0) items.push({ category: "콘텐츠", issue: "목록(ul/ol) 없음", priority: "important", recommendation: "핵심 포인트를 목록으로 정리하면 AI가 정보를 추출하기 쉬워집니다." });
    if (content.tableCount === 0) items.push({ category: "콘텐츠", issue: "표(table) 없음", priority: "optional", recommendation: "비교 데이터나 수치 정보가 있다면 표로 정리하면 Featured Snippet 획득 확률이 높아집니다." });
    if (content.blockquoteCount === 0) items.push({ category: "콘텐츠", issue: "인용(blockquote) 없음", priority: "optional", recommendation: "전문가 의견이나 연구 결과를 인용하면 콘텐츠 신뢰성이 향상됩니다." });
    if (content.imgCount > 0 && content.imgWithAlt < content.imgCount) items.push({ category: "콘텐츠", issue: `이미지 alt 텍스트 누락 (${content.imgCount - content.imgWithAlt}/${content.imgCount}개)`, priority: "important", recommendation: "모든 이미지에 설명적인 alt 텍스트를 추가하세요. 접근성과 이미지 검색에 중요합니다." });
    if (!content.hasMetaDescription || content.metaDescLength < 70 || content.metaDescLength > 160) items.push({ category: "콘텐츠", issue: !content.hasMetaDescription ? "메타 설명 없음" : `메타 설명 길이 부적절 (${content.metaDescLength}자)`, priority: "urgent", recommendation: "메타 설명은 70~160자로 핵심 키워드를 포함하여 작성하세요. 검색 결과 CTR에 직접 영향을 줍니다." });
    if (content.wordCount < 1000) items.push({ category: "콘텐츠", issue: `본문 단어수 부족 (${numberFormatter.format(content.wordCount)}단어)`, priority: "important", recommendation: "건강 정보 콘텐츠는 최소 1,000단어 이상이 권장됩니다. 충분한 깊이로 주제를 다루세요." });

    // 우선순위 정렬: urgent > important > optional
    const order: Record<string, number> = { urgent: 0, important: 1, optional: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority]);
    return items;
  }, [diagCrawlResult]);

  /* KPI 실데이터 또는 mock fallback */
  const kpiClicks = kpiData?.current.clicks ?? (summary.clicks || 185);
  const kpiCtr = kpiData ? kpiData.current.ctr * 100 : (averageCtr * 100 || 4.2);
  const kpiPosition = kpiData?.current.avgPosition ?? (averagePosition || 7.3);
  const kpiSparkClicks = kpiData?.sparklines.clicks ?? SPARKLINE_CLICKS;
  const kpiSparkCtr = kpiData?.sparklines.ctr ?? SPARKLINE_CTR;
  const kpiSparkPosition = kpiData?.sparklines.position ?? SPARKLINE_POSITION;

  /* ── Trend 차트 SVG 생성 ── */
  const trendSource = useMemo(() => {
    if (trendData && trendData.length > 0) {
      return trendData.map((d) => ({ clicks: d.clicks, impressions: d.impressions }));
    }
    return TREND_30D;
  }, [trendData]);
  const trendIsLive = trendData !== null && trendData.length > 0;

  const trendSvg = useMemo(() => {
    const w = 800, h = 180, padL = 45, padR = 10, padT = 10, padB = 30;
    const cw = w - padL - padR, ch = h - padT - padB;
    const maxI = Math.max(...trendSource.map((d) => d.impressions));
    const maxC = Math.max(...trendSource.map((d) => d.clicks));
    const n = trendSource.length - 1 || 1;
    const impPts = trendSource.map((d, i) => `${padL + (i / n) * cw},${padT + (1 - d.impressions / maxI) * ch}`).join(" ");
    const clkPts = trendSource.map((d, i) => `${padL + (i / n) * cw},${padT + (1 - d.clicks / maxC) * ch}`).join(" ");
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + f * ch);
    const labelCount = Math.min(trendSource.length, 4);
    const labelIndices = Array.from({ length: labelCount }, (_, i) => Math.round(i * (trendSource.length - 1) / (labelCount - 1)));
    /* 그라디언트 fill용 폴리곤 포인트 (라인 아래 영역) */
    const clkAreaPts = `${padL + 0},${padT + ch} ${clkPts} ${padL + (n / n) * cw},${padT + ch}`;
    const impAreaPts = `${padL + 0},${padT + ch} ${impPts} ${padL + (n / n) * cw},${padT + ch}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748B" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#64748B" stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridLines.map((y) => (
          <line key={y} x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {labelIndices.map((idx) => (
          <text key={idx} x={padL + (idx / n) * cw} y={h - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {idx + 1}일
          </text>
        ))}
        <polygon points={impAreaPts} fill="url(#impGradient)" />
        <polyline points={impPts} fill="none" stroke="#64748B" strokeWidth="2" opacity="0.7" />
        <polygon points={clkAreaPts} fill="url(#clickGradient)" />
        <polyline points={clkPts} fill="none" stroke="#0D9488" strokeWidth="2.5" />
      </svg>
    );
  }, [trendSource]);

  return (
    <div ref={pageRef} className={styles.page}>
      {/* ════════ 네비바 ════════ */}
      <nav className={styles.topNav}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <span className={styles.navBrandIcon}>🧠</span>
            <div className={styles.navBrandText}>
              <span className={styles.navBrandTitle}>Biocom <span className={styles.navBrandAccent}>AI Agent</span></span>
              <span className={styles.navBrandSub}>AEO/GEO Intelligence</span>
            </div>
          </div>
          <div className={styles.navTabs}>
            {NAV_TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                className={`${styles.navTab} ${activeTab === i ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab(i)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.navRight}>
            <button
              type="button"
              className={`${styles.captureBtn} ${capturing ? styles.captureBtnActive : ""}`}
              onClick={handleScrollCapture}
              disabled={capturing}
              title="현재 탭 전체 캡처"
            >
              📸
            </button>
            <div className={styles.statusWrap}>
              <span className={styles.statusDotWrap}>
                <span className={styles.statusDotPing} data-status={connectionStatus} />
                <span className={styles.statusDot} data-status={connectionStatus} />
              </span>
              <span className={styles.statusText}>
                {connectionStatus === "ok" ? "Connected" : connectionStatus === "error" ? "Disconnected" : "Checking..."}
              </span>
              <div className={styles.statusTooltip}>
                <div className={styles.statusTooltipRow}>
                  <span className={styles.statusTooltipLabel}>Backend</span>
                  <span className={styles.statusTooltipValue}>{API_BASE_URL}</span>
                </div>
                <div className={styles.statusTooltipRow}>
                  <span className={styles.statusTooltipLabel}>Status</span>
                  <span className={styles.statusTooltipValue}>{connectionLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main ref={mainRef} className={styles.main}>
        {/* ════════ TAB 0: 오버뷰 ════════ */}
        {activeTab === 0 && (
          <>
            {/* AEO/GEO 점수 */}
            <section className={styles.heroGrid}>
              {[
                { label: "AEO Score", data: aeoScore, fallback: SCORES[0], idx: 0 },
                { label: "GEO Score", data: geoScore, fallback: SCORES[1], idx: 1 },
              ].map(({ label, data, fallback, idx }) => {
                const isLive = !!data;
                const score = data?.normalizedScore ?? fallback.score;
                const max = 100;
                const measured = data ? data.breakdown.filter((b) => b.status === "measured").length : 0;
                const total = data ? data.breakdown.length : 0;
                return (
                  <article key={label} className={styles.scoreCard}>
                    <div className={styles.scoreCardHeader}>
                      <span className={styles.scoreLabel}>{label}{isLive ? <LiveBadge /> : <WipBadge />}</span>
                      <span className={styles.scoreFraction}>{score}/{max}</span>
                    </div>
                    <div className={styles.scoreRingWrap}>
                      <svg className={styles.scoreRing} viewBox="0 0 120 120">
                        <circle className={styles.scoreRingTrack} cx="60" cy="60" r="52" />
                        <circle
                          className={`${styles.scoreRingFill} ${idx === 0 ? styles.scoreRingAeo : styles.scoreRingGeo}`}
                          cx="60" cy="60" r="52"
                          style={{ strokeDashoffset: `${326.7 - (326.7 * score) / 100}` }}
                        />
                      </svg>
                      <div className={styles.scoreRingCenter}>
                        <span className={`${styles.scoreRingValue} ${idx === 0 ? styles.scoreValueAeo : styles.scoreValueGeo}`}>{score}</span>
                        <span className={styles.scoreRingMax}>/100</span>
                      </div>
                    </div>
                    {isLive ? (
                      <div className={styles.scoreSegments}>
                        {Array.from({ length: total }, (_, i) => (
                          <div key={i} className={`${styles.scoreSegment} ${i < measured ? (idx === 0 ? styles.scoreSegmentAeo : styles.scoreSegmentGeo) : styles.scoreSegmentEmpty}`} />
                        ))}
                        <span className={styles.scoreSegmentLabel}>{measured}/{total} 항목 측정 완료</span>
                      </div>
                    ) : (
                      <p className={`${styles.scoreDelta} ${styles.scoreDeltaUp}`}>▲ +{fallback.delta} {fallback.deltaLabel}</p>
                    )}
                  </article>
                );
              })}
            </section>

            {/* AEO/GEO 상세 브레이크다운 (아코디언) */}
            {(aeoScore || geoScore) && (
              <section className={styles.breakdownSection}>
                {[
                  { result: aeoScore, isOpen: isAeoOpen, toggle: () => setIsAeoOpen((v) => !v) },
                  { result: geoScore, isOpen: isGeoOpen, toggle: () => setIsGeoOpen((v) => !v) },
                ].filter((d) => d.result).map(({ result, isOpen, toggle }) => {
                  const items = result!.breakdown;
                  const lowCount = items.filter((b) => b.maxScore > 0 && (b.score / b.maxScore) < 0.5).length;
                  return (
                    <div key={result!.type} className={styles.breakdownCard}>
                      {/* 아코디언 헤더 */}
                      <div className={styles.breakdownHeader} onClick={toggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                        <div className={styles.breakdownHeaderLeft}>
                          <h3 className={styles.breakdownTitle}>{result!.type} Score 상세 ({result!.normalizedScore}점)</h3>
                          <div className={styles.breakdownMiniBar}>
                            {items.map((b) => {
                              const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                              const cls = pct >= 80 ? styles.breakdownMiniSegGood : pct >= 50 ? styles.breakdownMiniSegWarn : styles.breakdownMiniSegPoor;
                              return <span key={b.name} className={`${styles.breakdownMiniSeg} ${cls}`} title={`${b.label}: ${b.score}/${b.maxScore}`} />;
                            })}
                          </div>
                          {lowCount > 0 && (
                            <span className={styles.breakdownBadge}>{lowCount}개 개선 필요</span>
                          )}
                        </div>
                        <svg className={`${styles.breakdownChevron} ${isOpen ? styles.breakdownChevronOpen : ""}`} viewBox="0 0 20 20" fill="none">
                          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
	                      {/* 아코디언 본문 */}
	                      <div className={`${styles.breakdownBody} ${isOpen ? styles.breakdownBodyOpen : ""}`}>
	                        <div className={styles.breakdownMetaRow}>
	                          <span className={styles.breakdownMetaLabel}>대표 URL</span>
	                          {aeoGeoTargetResolved ? (
	                            <a className={styles.breakdownMetaLink} href={aeoGeoTargetResolved} target="_blank" rel="noreferrer">
	                              {aeoGeoTargetResolved.replace(/^https?:\/\//i, "")}
	                            </a>
	                          ) : (
	                            <span className={styles.breakdownMetaEmpty}>미지정</span>
	                          )}
	                          <span className={styles.breakdownMetaHint}>구조화 데이터/콘텐츠/기술 성능 항목은 이 URL을 기준으로 측정됩니다.</span>
	                        </div>
	                        <div className={styles.breakdownGrid}>
	                          {items.map((b) => {
	                            const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
	                            const level = pct >= 80 ? "good" : pct >= 50 ? "warn" : "poor";
	                            const itemKey = `${result!.type}:${b.name}`;
	                            const isItemOpen = !!openBreakdownItems[itemKey];
	                            const detailId = `breakdown-${result!.type}-${b.name}`;
	                            return (
	                              <div
	                                key={b.name}
	                                className={`${styles.breakdownItem} ${b.score === 0 ? styles.breakdownItemZero : ""} ${level === "good" ? styles.breakdownItemGood : level === "warn" ? styles.breakdownItemWarn : styles.breakdownItemPoor}`}
	                              >
	                                <div
	                                  className={styles.breakdownItemSummary}
	                                  role="button"
	                                  tabIndex={0}
	                                  aria-expanded={isItemOpen}
	                                  aria-controls={detailId}
	                                  onClick={() => toggleBreakdownItem(result!.type, b.name)}
	                                  onKeyDown={(e) => {
	                                    if (e.key === "Enter" || e.key === " ") {
	                                      e.preventDefault();
	                                      toggleBreakdownItem(result!.type, b.name);
	                                    }
	                                  }}
	                                >
	                                  <div className={styles.breakdownItemHeader}>
	                                    <span className={styles.breakdownItemLabel}>
	                                      {pct >= 80 ? (
	                                        <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#10B981" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
	                                      ) : pct > 0 ? (
	                                        <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#F59E0B" strokeWidth="1.5"/><path d="M8 5v3.5M8 10.5h.01" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/></svg>
	                                      ) : (
	                                        <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
	                                      )}
	                                      {b.label}
	                                    </span>
	                                    <span className={styles.breakdownItemHeaderRight}>
	                                      <span className={`${styles.breakdownItemScore} ${level === "good" ? styles.breakdownScoreGood : level === "warn" ? styles.breakdownScoreWarn : styles.breakdownScorePoor}`}>{b.score}/{b.maxScore}</span>
	                                      <svg className={`${styles.breakdownItemChevron} ${isItemOpen ? styles.breakdownItemChevronOpen : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
	                                        <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
	                                      </svg>
	                                    </span>
	                                  </div>
	                                  <div className={styles.breakdownBar}>
	                                    <div className={`${styles.breakdownBarFill} ${level === "good" ? styles.breakdownBarGood : level === "warn" ? styles.breakdownBarWarn : styles.breakdownBarPoor}`} style={{ width: `${pct}%` }} />
	                                  </div>
	                                  <p className={styles.breakdownDetail}>{b.detail}</p>
	                                  <span className={styles.breakdownExpandHint}>{isItemOpen ? "접기" : "자세히"}</span>
	                                </div>

	                                {isItemOpen && (
	                                  <div id={detailId} className={styles.breakdownExplain}>
	                                    {renderBreakdownExplain(result!.type, b)}
	                                  </div>
	                                )}
	                              </div>
	                            );
	                          })}
	                        </div>
	                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* AI 인사이트 */}
            <section className={styles.insightsPanel}>
              <div className={styles.insightsPanelHeader}>
                <h2 className={styles.insightsPanelTitle}>🤖 AI 에이전트 활동 상태{aiInsights ? <LiveBadge /> : <WipBadge />}</h2>
                <div className={styles.insightsPanelActions}>
                  <span className={styles.insightsPanelMeta}>
                    {aiInsightsLoading
                      ? "AI 분석 중..."
                      : aiInsightsTime
                        ? (() => {
                            const diff = Math.floor((Date.now() - new Date(aiInsightsTime).getTime()) / 1000);
                            if (diff < 60) return "방금 전";
                            if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
                            if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
                            return `${Math.floor(diff / 86400)}일 전`;
                          })()
                        : "분석 대기"}
                  </span>
                  <button
                    type="button"
                    className={styles.insightsRefreshBtn}
                    title="다시 분석"
                    disabled={aiInsightsLoading}
                    onClick={() => {
                      setAiInsightsLoading(true);
                      fetch(`${API_BASE_URL}/api/ai/insights`)
                        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
                        .then((d: { insights?: AiInsight[]; generatedAt?: string }) => {
                          if (d.insights && d.insights.length > 0) {
                            setAiInsights(d.insights);
                            if (d.generatedAt) setAiInsightsTime(d.generatedAt);
                          }
                        })
                        .catch(() => {})
                        .finally(() => setAiInsightsLoading(false));
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </div>
              <div className={styles.insightCards}>
                {(aiInsights ?? AI_INSIGHTS).map((ins, idx) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    "키워드": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                    "스키마": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
                    "추세": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-5 3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                    "콘텐츠": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                    "기기": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
                  };
                  const icon = iconMap[ins.tag] ?? iconMap["콘텐츠"];
                  return (
                    <div
                      key={`${ins.tag}-${idx}`}
                      className={`${styles.insightCard} ${styles[BADGE_CLASS_MAP[ins.priority] + "Border"] ?? ""}`}
                      style={{ animationDelay: `${idx * 0.08}s` }}
                    >
                      <div className={`${styles.insightIconWrap} ${styles[BADGE_CLASS_MAP[ins.priority] + "Bg"] ?? ""}`}>
                        {icon}
                      </div>
                      <div className={styles.insightCardBody}>
                        <span className={`${styles.insightTag} ${styles[TAG_CLASS_MAP[ins.priority]] ?? ""}`}>{ins.tag}</span>
                        <span className={styles.insightText}>{ins.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 30일 추세 차트 */}
            <section className={styles.trendSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>클릭 / 노출 추이{trendIsLive ? <LiveBadge /> : <WipBadge />}</h2>
                <div className={styles.trendPeriodBtns}>
                  {["7일", "30일", "90일"].map((p, i) => (
                    <button key={p} type="button" className={`${styles.trendPeriodBtn} ${i === 1 ? styles.trendPeriodBtnActive : ""}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className={styles.trendChartWrap}>{trendSvg}</div>
              <div className={styles.trendLegend}>
                <span className={styles.trendLegendItem}><span className={styles.trendLegendDot} style={{ background: "#0D9488" }} /> 클릭수</span>
                <span className={styles.trendLegendItem}><span className={styles.trendLegendDot} style={{ background: "#64748B" }} /> 노출수</span>
              </div>
            </section>

            {/* KPI 카드 4개 (통일 디자인) */}
            <section className={styles.kpiGrid}>
              {(() => {
                /* 클릭수 */
                const clicksChange = kpiData ? kpiData.delta.clicks : 12.3;
                const clicksStatus: "up" | "down" | "neutral" = clicksChange > 0 ? "up" : clicksChange < 0 ? "down" : "neutral";
                /* CTR */
                const ctrChange = kpiData ? kpiData.delta.ctr : 0.8;
                const ctrStatus: "up" | "down" | "neutral" = ctrChange > 0 ? "up" : ctrChange < 0 ? "down" : "neutral";
                /* 순위: 숫자 감소 = 개선 = 초록 (역방향) */
                const posChange = kpiData ? kpiData.delta.position : -1.2;
                const posStatus: "up" | "down" | "neutral" = posChange < 0 ? "up" : posChange > 0 ? "down" : "neutral";
                /* CWV */
                const cwvPerf = cwvAvg.performance;
                return (
                  <>
                    <KpiCard
                      label="총 클릭수"
                      value={numberFormatter.format(kpiClicks)}
                      change={clicksChange}
                      changeUnit="%"
                      changeLabel="전주 7일"
                      status={clicksStatus}
                      sparklineData={kpiSparkClicks}
                      sparklineColor="#0D9488"
                    />
                    <KpiCard
                      label="평균 CTR"
                      value={decimalFormatter.format(kpiCtr)}
                      unit="%"
                      change={ctrChange}
                      changeUnit="%p"
                      changeLabel="전주 7일"
                      status={ctrStatus}
                      sparklineData={kpiSparkCtr}
                      sparklineColor="#2563eb"
                    />
                    <KpiCard
                      label="평균 순위"
                      value={decimalFormatter.format(kpiPosition)}
                      change={posChange}
                      changeUnit=""
                      changeLabel="전주 7일"
                      status={posStatus}
                      sparklineData={kpiSparkPosition}
                      sparklineColor="#f59e0b"
                    />
                    <KpiCard
                      label="CWV 점수"
                      value={String(cwvPerf)}
                      unit="점"
                      change={0}
                      changeUnit="점"
                      changeLabel="전주"
                      status="neutral"
                      isCwv
                      cwvScore={cwvPerf}
                    />
                  </>
                );
              })()}
            </section>

            {/* 인텐트 + 작업 */}
            <section className={styles.twoColGrid}>
              <div className={styles.intentPanel}>
                <h3 className={styles.intentPanelTitle}>키워드 인텐트 분석{intentData ? <LiveBadge /> : <WipBadge />}</h3>
                {(intentData?.categories ?? INTENT_CATEGORIES).map((cat) => (
                  <div key={cat.label} className={styles.intentRow}>
                    <span className={styles.intentLabel}>{cat.label}</span>
                    <div className={styles.intentBarTrack}>
                      <div className={`${styles.intentBarFill} ${styles[cat.colorClass] ?? ""}`} style={{ width: `${cat.percent}%` }} />
                    </div>
                    <span className={styles.intentPercent}>{cat.percent}%</span>
                  </div>
                ))}
                <div className={styles.intentDetailWrap}>
                  <div className={styles.intentDetailMeta}>
                    <span className={styles.intentDetailMetaItem}>
                      기간: {intentData?.period ?? "—"}
                    </span>
                    <span className={styles.intentDetailMetaItem}>
                      대상: {intentData?.totalKeywords ? `${numberFormatter.format(intentData.totalKeywords)}개 키워드` : "—"}
                    </span>
                    <span className={styles.intentDetailMetaItem}>
                      방식: {intentData ? (intentData.method === "hybrid" ? "규칙 + GPT 보완" : "규칙 기반") : "—"}
                    </span>
                  </div>
                  <p className={styles.intentDetailNote}>
                    참고: Google Search Console에는 &quot;검색 의도&quot; 지표가 없어서, 상위 키워드 문구를 규칙(일부는 GPT)으로 분류한 <b>추정치</b>입니다.
                  </p>
                  {intentData?.keywords && intentData.keywords.length > 0 ? (
                    <div className={styles.intentDetailExamples}>
                      {(intentData.categories ?? []).map((cat) => {
                        const examples = intentData.keywords
                          .filter((k) => k.intent === cat.type)
                          .slice(0, 6)
                          .map((k) => k.query)
                          .join(", ");
                        const conf = intentData.keywords.filter((k) => k.intent === cat.type);
                        const high = conf.filter((k) => k.confidence === "high").length;
                        const medium = conf.filter((k) => k.confidence === "medium").length;
                        const low = conf.filter((k) => k.confidence === "low").length;

                        return (
                          <div key={cat.type} className={styles.intentDetailExampleRow}>
                            <div className={styles.intentDetailExampleHead}>
                              <span className={styles.intentDetailExampleTitle}>
                                {cat.label} {cat.percent}% ({numberFormatter.format(cat.count)}개)
                              </span>
                              <span className={styles.intentDetailExampleMeta}>
                                신뢰도: high {high} / med {medium} / low {low}
                              </span>
                            </div>
                            <div className={styles.intentDetailExampleText}>
                              {examples ? `예시: ${examples}` : "예시: —"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.intentDetailEmpty}>
                      인텐트 분류 상세(예시 키워드)는 GSC 키워드가 로드된 후 표시됩니다.
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.taskPanel}>
                <div className={styles.taskPanelHeader}>
                  <h3 className={styles.taskPanelTitle}>
                    AI 최적화 작업
                    {(() => {
                      const hasMeasuredSchema = !!(aeoScore?.breakdown.some((b) => b.status === "measured") || geoScore?.breakdown.some((b) => b.status === "measured"));
                      const hasKeywordData = !!keywordsData;
                      const hasHistory = (pageSpeedHistory?.length ?? 0) > 0;
                      const hasAi = !!(aiInsights && aiInsights.length > 0);
                      const isLive = hasMeasuredSchema || hasKeywordData || hasHistory || cwvHasReal || hasAi;
                      return isLive ? <LiveBadge /> : <ConfigBadge />;
                    })()}
                  </h3>
                  <span className={styles.taskPanelCount}>{doneCount}/{aiOptimizationTasks.length} 완료</span>
                </div>
                <ul className={styles.taskList}>
                  {aiOptimizationTasks.map((task) => (
                    <li key={task.id} className={`${styles.taskItem} ${task.done ? styles.taskItemDone : ""}`}>
                      <span className={`${styles.taskCheckbox} ${task.done ? styles.taskCheckboxDone : ""}`}>
                        {task.done && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={styles.taskTextWrap}>
                        <span className={`${styles.taskText} ${task.done ? styles.taskTextDone : ""}`}>{task.text}</span>
                        {task.detail && <span className={styles.taskDetail}>{task.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 접이식 데이터 조회 */}
            <section className={styles.collapsibleSection}>
              <div className={styles.collapsibleHeader} onClick={() => setDataQueryOpen((p) => !p)}>
                <h2 className={styles.collapsibleTitle}>🔍 검색 데이터 상세 조회</h2>
                <span className={`${styles.collapsibleChevron} ${dataQueryOpen ? styles.collapsibleChevronOpen : ""}`}>▼</span>
              </div>
              {dataQueryOpen && (
                <div className={styles.collapsibleBody}>
                  <div className={styles.controlPanel}>
                    <div className={styles.presetGroup}>
                      {(Object.keys(PRESET_LABELS) as DatePreset[]).map((preset) => (
                        <button key={preset} type="button" className={`${styles.presetBtn} ${datePreset === preset ? styles.presetActive : ""}`} onClick={() => handlePresetChange(preset)}>
                          {PRESET_LABELS[preset]}
                        </button>
                      ))}
                    </div>
                    <form className={styles.form} onSubmit={handleSubmit}>
                      {datePreset === "custom" && (
                        <div className={styles.dateInputs}>
                          <label className={styles.fieldLabel}>시작일<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label>
                          <label className={styles.fieldLabel}>종료일<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
                        </div>
                      )}
                      <div className={styles.formRow}>
                        <label className={styles.fieldLabel}>사이트<input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="sc-domain:biocom.kr" /></label>
                        <label className={styles.fieldLabel}>조회 건수<input type="number" min={1} max={25000} value={rowLimit} onChange={(e) => setRowLimit(Number(e.target.value))} /></label>
                        <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "조회 중..." : "검색 데이터 조회"}</button>
                      </div>
                    </form>
                    {error ? <p className={styles.error}>오류: {error}</p> : null}
                  </div>
                  <div className={styles.tablePanel}>
                    <div className={styles.tableHeader}>
                      <h2>검색 성과 상세</h2>
                      <p>{rows.length > 0 ? `${numberFormatter.format(rows.length)}건 조회됨` : ""}</p>
                    </div>
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr><th>검색어</th><th>페이지</th><th>기기</th><th>클릭수</th><th>노출수</th><th>클릭률</th><th>순위</th></tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr><td colSpan={7} className={styles.empty}><div className={styles.emptyContent}><svg width="40" height="40" viewBox="0 0 40 40" fill="none" className={styles.emptyIcon}><circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2" /><path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><p>조회 버튼을 눌러 검색 성과를 확인해 보세요</p></div></td></tr>
                          ) : (
                            rows.map((row, index) => (
                              <tr key={`${row.keys?.join("-") ?? "row"}-${index}`}>
                                <td className={styles.queryCell}>{row.keys?.[1] ?? "-"}</td>
                                <td className={styles.pageCell}>{row.keys?.[0] ?? "-"}</td>
                                <td>{DEVICE_LABELS[row.keys?.[2] ?? ""] ?? row.keys?.[2] ?? "-"}</td>
                                <td className={styles.numCell}>{numberFormatter.format(row.clicks ?? 0)}</td>
                                <td className={styles.numCell}>{numberFormatter.format(row.impressions ?? 0)}</td>
                                <td className={styles.numCell}>{decimalFormatter.format((row.ctr ?? 0) * 100)}%</td>
                                <td className={styles.numCell}>{decimalFormatter.format(row.position ?? 0)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* ════════ TAB 1: 칼럼별 분석 ════════ */}
        {activeTab === 1 && (
          <>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>칼럼별 성과 분석{(columnsData || columnPagesData) ? <LiveBadge /> : <WipBadge />}</h2>
                <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
                  <div className={styles.keywordMetaTop}>
                    <div className={styles.keywordRangeBtns}>
                      <button
                        type="button"
                        className={`${styles.trendPeriodBtn} ${colRangePreset === "7d" ? styles.trendPeriodBtnActive : ""}`}
                        onClick={() => { setColRangePreset("7d"); setColDatePickerOpen(false); void loadColumns({ days: 7 }); }}
                        disabled={colLoading}
                      >7일</button>
                      <button
                        type="button"
                        className={`${styles.trendPeriodBtn} ${colRangePreset === "30d" ? styles.trendPeriodBtnActive : ""}`}
                        onClick={() => { setColRangePreset("30d"); setColDatePickerOpen(false); void loadColumns({ days: 30 }); }}
                        disabled={colLoading}
                      >30일</button>
                      <button
                        type="button"
                        className={`${styles.trendPeriodBtn} ${colRangePreset === "custom" || colDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
                        onClick={() => setColDatePickerOpen((p) => !p)}
                        disabled={colLoading}
                        title="기간 직접 지정"
                      >📅</button>
                    </div>
                    <span className={styles.keywordRangeText}>
                      {(columnsData || columnPagesData)
                        ? `📅 ${columnsDateRange?.start ?? ""} ~ ${columnsDateRange?.end ?? ""} (${colRangePreset === "7d" ? "최근 7일" : colRangePreset === "30d" ? "최근 30일" : "기간 지정"}) · GSC 실데이터`
                        : "Mock 샘플 데이터"
                      }
                    </span>
                  </div>
                  <span className={styles.keywordMetaBottom}>
                    {colLoading ? "조회 중... · " : ""}종합 스코어 = 검색 40% + 기술 20% + 체류 25% + AEO/GEO 15%
                  </span>
                </div>
              </div>
              {colDatePickerOpen && (
                <div className={styles.keywordDatePicker}>
                  <div className={styles.dateInputs}>
                    <label className={styles.fieldLabel}>시작일<input type="date" value={colStartInput} onChange={(e) => setColStartInput(e.target.value)} required /></label>
                    <label className={styles.fieldLabel}>종료일<input type="date" value={colEndInput} onChange={(e) => setColEndInput(e.target.value)} required /></label>
                  </div>
                  <div className={styles.keywordDateActions}>
                    <button
                      type="button"
                      className={styles.keywordActionBtn}
                      onClick={() => {
                        if (!colStartInput || !colEndInput || colStartInput > colEndInput) return;
                        setColRangePreset("custom");
                        setColDatePickerOpen(false);
                        void loadColumns({ startDate: colStartInput, endDate: colEndInput });
                      }}
                      disabled={colLoading}
                    >적용</button>
                    <button type="button" className={styles.keywordActionBtn} onClick={() => setColDatePickerOpen(false)} disabled={colLoading}>닫기</button>
                  </div>
                </div>
              )}
              <div className={styles.miniKpiGrid}>
                <div className={styles.miniKpiCard}>
                  <div className={styles.miniKpiLabel}>총 칼럼 수</div>
                  <div className={styles.miniKpiValue}>{numberFormatter.format(columnKpis.total)}개</div>
                  <div className={styles.miniKpiSub}>/healthinfo, /what_biohacking 기준</div>
                </div>
                <div className={styles.miniKpiCard}>
                  <div className={styles.miniKpiLabel}>클릭 발생 칼럼</div>
                  <div className={styles.miniKpiValue}>{numberFormatter.format(columnKpis.clicked)}개</div>
                  <div className={styles.miniKpiSub}>클릭 &gt; 0 ({columnKpis.clickedRate.toFixed(0)}%)</div>
                </div>
                <div className={styles.miniKpiCard}>
                  <div className={styles.miniKpiLabel}>TOP 10 평균 CTR</div>
                  <div className={styles.miniKpiValue}>{decimalFormatter.format(columnKpis.top10AvgCtr)}%</div>
                  <div className={styles.miniKpiSub}>종합 스코어 상위 10개 평균</div>
                </div>
                <div className={styles.miniKpiCard}>
                  <div className={styles.miniKpiLabel}>종합 스코어 평균</div>
                  <div className={styles.miniKpiValue}>{columnKpis.avgScore.toFixed(1)}점</div>
                  <div className={styles.miniKpiSub}>전체 칼럼 평균(0~100)</div>
                </div>
              </div>
              {/* 필터 바 */}
              <div className={styles.colFilterBar}>
                <div className={styles.colSearchWrap}>
                  <svg className={styles.colSearchIcon} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <input className={styles.colSearchInput} placeholder="칼럼 검색..." value={colSearch} onChange={(e) => setColSearch(e.target.value)} />
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>칼럼</th>
                      <th className={styles.sortableTh} onClick={() => handleColSort("clicks")}>
                        클릭수
                        <svg className={`${styles.sortIcon} ${colSortKey === "clicks" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={colSortKey === "clicks" && colSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleColSort("impressions")}>
                        노출수
                        <svg className={`${styles.sortIcon} ${colSortKey === "impressions" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={colSortKey === "impressions" && colSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleColSort("ctr")}>
                        CTR
                        <svg className={`${styles.sortIcon} ${colSortKey === "ctr" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={colSortKey === "ctr" && colSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleColSort("position")}>
                        순위
                        <svg className={`${styles.sortIcon} ${colSortKey === "position" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={colSortKey === "position" && colSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleColSort("score")}>
                        종합 스코어
                        <svg className={`${styles.sortIcon} ${colSortKey === "score" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={colSortKey === "score" && colSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCols.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.empty}>
                          <div className={styles.emptyContent}>
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className={styles.emptyIcon}>
                              <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2" />
                              <path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p>{colSearch ? "검색 결과가 없습니다." : "해당 기간에 칼럼 성과 데이터가 없습니다."}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleCols.map((col, idx) => {
                          const href = resolveContentUrl(col.url);
                          const scoreCls = (col.score ?? 0) >= 40 ? styles.scoreNumberGood : (col.score ?? 0) >= 25 ? styles.scoreNumberWarn : styles.scoreNumberPoor;
                          return (
                            <tr key={col.url} className={`${styles.colRow} ${idx % 2 === 1 ? styles.colRowStripe : ""} ${(col.clicks ?? 0) === 0 ? styles.colRowDimmed : ""} ${idx < 3 ? styles.colRowTop3 : ""}`}>
                              <td>
                                <a href={href || undefined} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }} title={col.title}>
                                  <div className={styles.columnTitleCell}>{col.title}</div>
                                  <div className={styles.columnUrlCell}>
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    {col.url.replace("https://biocom.kr", "")}
                                  </div>
                                </a>
                              </td>
                              <td className={styles.numCell}>{numberFormatter.format(col.clicks)}</td>
                              <td className={styles.numCell}>{numberFormatter.format(col.impressions)}</td>
                              <td className={styles.numCell}>{decimalFormatter.format(col.ctr)}%</td>
                              <td className={styles.numCell}>{decimalFormatter.format(col.position)}</td>
                              <td>
                                <div className={styles.scoreBarWrap}>
                                  <div className={styles.scoreBarTrack}>
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentSearch}`} style={{ width: `${col.search}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentTech}`} style={{ width: `${col.tech}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentEngage}`} style={{ width: `${col.engage}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentAeo}`} style={{ width: `${col.aeo}%` }} />
                                  </div>
                                  <span className={`${styles.scoreNumber} ${scoreCls}`}>{col.score}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCols.length > 10 && (
                          <tr className={styles.showMoreRow}>
                            <td colSpan={6}>
                              <button type="button" className={styles.showMoreBtn} onClick={() => setColShowAll((v) => !v)}>
                                {colShowAll ? "접기" : `나머지 ${filteredCols.length - 10}개 칼럼 더 보기`}
                                <svg className={`${styles.showMoreIcon} ${colShowAll ? styles.showMoreIconUp : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={styles.scoreLegend}>
                <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#0D9488" }} /> 검색 성과 (40%)</span>
                <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#2563eb" }} /> 기술 성능 (20%)</span>
                <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#f59e0b" }} /> 사용자 체류 (25%)</span>
                <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#8b5cf6" }} /> AEO/GEO (15%)</span>
              </div>
            </section>

            {/* 섹션 구분 디바이더 */}
            <div className={styles.sectionDivider}>
              <div className={styles.sectionDividerLine} />
              <span className={styles.sectionDividerText}>기타 페이지 분석</span>
              <div className={styles.sectionDividerLine} />
            </div>

            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>상품 및 기타 페이지 성과 분석{columnsData ? <LiveBadge /> : <WipBadge />}</h2>
                <span className={styles.sectionMeta}>
                  {columnsData
                    ? `📅 ${columnsDateRange?.start ?? ""} ~ ${columnsDateRange?.end ?? ""} (최근 7일) · GSC 실데이터`
                    : "Mock 샘플 데이터"
                  } · 칼럼(/healthinfo, /what_biohacking) 제외
                </span>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>페이지</th>
                      <th className={styles.sortableTh} onClick={() => handleOtherSort("clicks")}>
                        클릭수
                        <svg className={`${styles.sortIcon} ${otherSortKey === "clicks" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={otherSortKey === "clicks" && otherSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleOtherSort("impressions")}>
                        노출수
                        <svg className={`${styles.sortIcon} ${otherSortKey === "impressions" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={otherSortKey === "impressions" && otherSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleOtherSort("ctr")}>
                        CTR
                        <svg className={`${styles.sortIcon} ${otherSortKey === "ctr" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={otherSortKey === "ctr" && otherSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleOtherSort("position")}>
                        순위
                        <svg className={`${styles.sortIcon} ${otherSortKey === "position" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={otherSortKey === "position" && otherSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                      <th className={styles.sortableTh} onClick={() => handleOtherSort("score")}>
                        종합 스코어
                        <svg className={`${styles.sortIcon} ${otherSortKey === "score" ? styles.sortIconActive : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform={otherSortKey === "score" && otherSortAsc ? "rotate(180 8 8)" : ""}/></svg>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOther.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.empty}>
                          <div className={styles.emptyContent}>
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className={styles.emptyIcon}>
                              <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2" />
                              <path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p>해당 기간에 상품/기타 페이지 성과 데이터가 없습니다.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleOther.map((col, idx) => {
                          const href = resolveContentUrl(col.url);
                          const scoreCls = (col.score ?? 0) >= 40 ? styles.scoreNumberGood : (col.score ?? 0) >= 25 ? styles.scoreNumberWarn : styles.scoreNumberPoor;
                          return (
                            <tr key={col.url} className={`${styles.colRow} ${idx % 2 === 1 ? styles.colRowStripe : ""} ${(col.clicks ?? 0) === 0 ? styles.colRowDimmed : ""} ${idx < 3 ? styles.colRowTop3 : ""}`}>
                              <td>
                                <a href={href || undefined} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }} title={col.title}>
                                  <div className={styles.columnTitleCell}>{col.title}</div>
                                  <div className={styles.columnUrlCell}>
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    {col.url.replace("https://biocom.kr", "")}
                                  </div>
                                </a>
                              </td>
                              <td className={styles.numCell}>{numberFormatter.format(col.clicks)}</td>
                              <td className={styles.numCell}>{numberFormatter.format(col.impressions)}</td>
                              <td className={styles.numCell}>{decimalFormatter.format(col.ctr)}%</td>
                              <td className={styles.numCell}>{decimalFormatter.format(col.position)}</td>
                              <td>
                                <div className={styles.scoreBarWrap}>
                                  <div className={styles.scoreBarTrack}>
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentSearch}`} style={{ width: `${col.search}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentTech}`} style={{ width: `${col.tech}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentEngage}`} style={{ width: `${col.engage}%` }} />
                                    <div className={`${styles.scoreSegment} ${styles.scoreSegmentAeo}`} style={{ width: `${col.aeo}%` }} />
                                  </div>
                                  <span className={`${styles.scoreNumber} ${scoreCls}`}>{col.score}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {sortedOther.length > 10 && (
                          <tr className={styles.showMoreRow}>
                            <td colSpan={6}>
                              <button type="button" className={styles.showMoreBtn} onClick={() => setOtherShowAll((v) => !v)}>
                                {otherShowAll ? "접기" : `나머지 ${sortedOther.length - 10}개 페이지 더 보기`}
                                <svg className={`${styles.showMoreIcon} ${otherShowAll ? styles.showMoreIconUp : ""}`} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ════════ TAB 2: 키워드 분석 ════════ */}
	        {activeTab === 2 && (
	          <>
	            <section className={styles.card}>
	              <div className={styles.sectionHeader}>
	                <h2 className={styles.sectionTitle}>키워드 순위 추적{keywordsData ? <LiveBadge /> : <WipBadge />}</h2>
	                <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
	                  <div className={styles.keywordMetaTop}>
	                    <div className={styles.keywordRangeBtns}>
	                      <button
	                        type="button"
	                        className={`${styles.trendPeriodBtn} ${keywordRangePreset === "7d" ? styles.trendPeriodBtnActive : ""}`}
	                        onClick={() => {
	                          setKeywordRangePreset("7d");
	                          setKeywordDatePickerOpen(false);
	                          void loadKeywords({ days: 7 });
	                        }}
	                        disabled={keywordsLoading}
	                      >
	                        7일
	                      </button>
	                      <button
	                        type="button"
	                        className={`${styles.trendPeriodBtn} ${keywordRangePreset === "30d" ? styles.trendPeriodBtnActive : ""}`}
	                        onClick={() => {
	                          setKeywordRangePreset("30d");
	                          setKeywordDatePickerOpen(false);
	                          void loadKeywords({ days: 30 });
	                        }}
	                        disabled={keywordsLoading}
	                      >
	                        30일
	                      </button>
	                      <button
	                        type="button"
	                        className={`${styles.trendPeriodBtn} ${keywordRangePreset === "custom" || keywordDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
	                        onClick={() => setKeywordDatePickerOpen((p) => !p)}
	                        disabled={keywordsLoading}
	                        title="기간 직접 지정"
	                      >
	                        📅
	                      </button>
	                    </div>
	                    <span className={styles.keywordRangeText}>
	                      {keywordsData
	                        ? `📅 ${keywordsDateRange?.start ?? ""} ~ ${keywordsDateRange?.end ?? ""} (${keywordRangeLabel}) · GSC 실데이터`
	                        : "Mock 샘플 데이터"}
	                    </span>
	                  </div>
	                  <span className={styles.keywordMetaBottom}>
	                    {keywordsLoading ? "조회 중... · " : ""}
	                    {liveKeywords.filter((k) => k.isQA).length}개 Q&A 키워드 · {liveKeywords.filter((k) => k.featured).length}개 Featured Snippet
	                  </span>
	                </div>
	              </div>
	              {keywordDatePickerOpen && (
	                <div className={styles.keywordDatePicker}>
	                  <div className={styles.dateInputs}>
	                    <label className={styles.fieldLabel}>시작일<input type="date" value={keywordStartInput} onChange={(e) => setKeywordStartInput(e.target.value)} required /></label>
	                    <label className={styles.fieldLabel}>종료일<input type="date" value={keywordEndInput} onChange={(e) => setKeywordEndInput(e.target.value)} required /></label>
	                  </div>
	                  <div className={styles.keywordDateActions}>
	                    <button
	                      type="button"
	                      className={styles.keywordActionBtn}
	                      onClick={() => {
	                        if (!keywordStartInput || !keywordEndInput) {
	                          setKeywordsError("시작일/종료일을 입력해 주세요.");
	                          return;
	                        }
	                        if (keywordStartInput > keywordEndInput) {
	                          setKeywordsError("시작일은 종료일보다 빠르거나 같아야 합니다.");
	                          return;
	                        }
	                        setKeywordsError(null);
	                        setKeywordRangePreset("custom");
	                        setKeywordDatePickerOpen(false);
	                        void loadKeywords({ startDate: keywordStartInput, endDate: keywordEndInput });
	                      }}
	                      disabled={keywordsLoading}
	                    >
	                      적용
	                    </button>
	                    <button type="button" className={styles.keywordActionBtn} onClick={() => setKeywordDatePickerOpen(false)} disabled={keywordsLoading}>닫기</button>
	                  </div>
	                </div>
	              )}
	              {keywordsError ? <p className={styles.error}>오류: {keywordsError}</p> : null}
	              <div className={styles.tableWrap}>
	                <table>
	                  <thead>
	                    <tr>
                      <th>키워드</th>
                      <th>유형</th>
                      <th>클릭수</th>
                      <th>노출수</th>
                      <th>CTR</th>
                      <th>순위</th>
                      <th>변동</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveKeywords.map((kw) => (
                      <tr key={kw.query} className={kw.opportunity ? styles.kwOpportunityRow : undefined}>
                        <td className={styles.queryCell}>{kw.query}</td>
                        <td><span className={`${styles.kwTag} ${kw.isQA ? styles.kwTagQA : styles.kwTagGeneral}`}>{kw.isQA ? "Q&A" : "일반"}</span></td>
                        <td className={styles.numCell}>{numberFormatter.format(kw.clicks)}</td>
                        <td className={styles.numCell}>{numberFormatter.format(kw.impressions)}</td>
                        <td className={styles.numCell}>{decimalFormatter.format(kw.ctr)}%</td>
                        <td className={styles.numCell}>{decimalFormatter.format(kw.position)}</td>
                        <td className={styles.numCell}>
                          <span className={`${styles.kwDelta} ${kw.delta <= 0 ? styles.kwDeltaUp : styles.kwDeltaDown}`}>
                            {kw.delta <= 0 ? "▲" : "▼"} {Math.abs(kw.delta).toFixed(1)}
                          </span>
                        </td>
                        <td className={styles.kwBadgeCell}>
                          {kw.featured && <span className={`${styles.kwTag} ${styles.kwTagFeatured}`}>Featured</span>}
                          {kw.opportunity && (
                            <button
                              type="button"
                              className={`${styles.kwOpportunityBadge} ${styles.kwOpportunityBadgeBtn}`}
                              onClick={() => setOpportunityKeyword(kw)}
                              title="왜 기회 키워드인지 보기"
                            >
                              기회 키워드
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {opportunityKeyword && (
                <div
                  className={styles.opportunityOverlay}
                  role="dialog"
                  aria-modal="true"
                  aria-label="기회 키워드 상세"
                  onClick={() => setOpportunityKeyword(null)}
                >
                  <div className={styles.opportunityModal} onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const IMP_THRESHOLD = 500;
                      const CTR_THRESHOLD_PCT = 2;
                      const kw = opportunityKeyword;
                      const expectedClicksAt2Pct = Math.round((kw.impressions * CTR_THRESHOLD_PCT) / 100);
                      const expectedClicksAt4Pct = Math.round((kw.impressions * 4) / 100);
                      const additionalAt2Pct = Math.max(0, expectedClicksAt2Pct - kw.clicks);
                      const additionalAt4Pct = Math.max(0, expectedClicksAt4Pct - kw.clicks);

                      const positionBucket = (pos: number) => {
                        if (pos <= 3) return "상위 3위권";
                        if (pos <= 10) return "1페이지(상위 10)";
                        if (pos <= 20) return "2페이지(상위 20)";
                        if (pos <= 30) return "3페이지(상위 30)";
                        return "하위권";
                      };

                      return (
                        <>
                          <div className={styles.opportunityHeader}>
                            <div>
                              <h3 className={styles.opportunityTitle}>기회 키워드 상세</h3>
                              <p className={styles.opportunityKeyword}>{kw.query}</p>
                            </div>
                            <button type="button" className={styles.opportunityCloseBtn} onClick={() => setOpportunityKeyword(null)}>
                              닫기
                            </button>
                          </div>

                          <div className={styles.opportunityExplain}>
                            <p className={styles.opportunityExplainText}>
                              이 키워드는 <strong>노출이 충분히 높은데</strong>(≥ {numberFormatter.format(IMP_THRESHOLD)}회),{" "}
                              <strong>CTR이 낮아서</strong>(&lt; {CTR_THRESHOLD_PCT}%) “기회 키워드”로 분류되었습니다.
                            </p>
                            <p className={styles.opportunityExplainText}>
                              현재 값: 노출 {numberFormatter.format(kw.impressions)}회 · CTR {decimalFormatter.format(kw.ctr)}% · 평균 순위{" "}
                              {decimalFormatter.format(kw.position)} ({positionBucket(kw.position)})
                            </p>
                          </div>

                          <div className={styles.opportunityMetrics}>
                            <div className={styles.opportunityMetricCard}>
                              <div className={styles.opportunityMetricLabel}>클릭</div>
                              <div className={styles.opportunityMetricValue}>{numberFormatter.format(kw.clicks)}</div>
                            </div>
                            <div className={styles.opportunityMetricCard}>
                              <div className={styles.opportunityMetricLabel}>노출</div>
                              <div className={styles.opportunityMetricValue}>{numberFormatter.format(kw.impressions)}</div>
                            </div>
                            <div className={styles.opportunityMetricCard}>
                              <div className={styles.opportunityMetricLabel}>CTR</div>
                              <div className={styles.opportunityMetricValue}>{decimalFormatter.format(kw.ctr)}%</div>
                            </div>
                            <div className={styles.opportunityMetricCard}>
                              <div className={styles.opportunityMetricLabel}>평균 순위</div>
                              <div className={styles.opportunityMetricValue}>{decimalFormatter.format(kw.position)}</div>
                            </div>
                          </div>

                          <div className={styles.opportunityReason}>
                            <h4 className={styles.opportunitySubTitle}>왜 “기회”인가?</h4>
                            <ul className={styles.opportunityList}>
                              <li>노출이 높아(검색 수요/가시성) 개선 시 클릭 증가 여지가 큽니다.</li>
                              <li>CTR이 낮아(스니펫/의도/경쟁) 제목·설명·구조 개선만으로도 성과가 바로 반영될 수 있습니다.</li>
                              <li>평균 순위가 10~20 구간이면, 1페이지 진입/상단 이동 시 CTR 상승 폭이 큽니다.</li>
                            </ul>
                          </div>

                          <div className={styles.opportunityPotential}>
                            <h4 className={styles.opportunitySubTitle}>클릭 잠재력(단순 추정)</h4>
                            <ul className={styles.opportunityList}>
                              <li>
                                CTR {CTR_THRESHOLD_PCT}%만 되어도 예상 클릭{" "}
                                {numberFormatter.format(expectedClicksAt2Pct)}회
                                {additionalAt2Pct > 0 ? ` (약 +${numberFormatter.format(additionalAt2Pct)}회)` : ""}
                              </li>
                              <li>
                                CTR 4%면 예상 클릭 {numberFormatter.format(expectedClicksAt4Pct)}회
                                {additionalAt4Pct > 0 ? ` (약 +${numberFormatter.format(additionalAt4Pct)}회)` : ""}
                              </li>
                            </ul>
                            <p className={styles.opportunityNote}>
                              * 동일 노출을 가정한 단순 계산이며, 실제 클릭은 순위/경쟁/계절성/스니펫 구성에 따라 달라질 수 있습니다.
                            </p>
                          </div>

                          <div className={styles.opportunityActions}>
                            <h4 className={styles.opportunitySubTitle}>추천 액션</h4>
                            <ol className={styles.opportunityOl}>
                              <li>검색 의도에 맞춘 타이틀/메타디스크립션 개선(핵심 키워드 포함 + 가치 제안).</li>
                              <li>상단에 “한 줄 결론 + 핵심 요약”을 추가해 스니펫(설명) 품질을 올립니다.</li>
                              <li>FAQ 섹션 추가 + FAQPage 스키마로 CTR/리치 결과를 노립니다.</li>
                              <li>내부 링크(관련 칼럼 ↔ 제품/검사 페이지)로 페이지 권한과 연관성을 강화합니다.</li>
                              <li>콘텐츠 갱신(최신 정보/근거/표/목록)으로 상위 10위 진입을 목표로 개선합니다.</li>
                            </ol>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* ════════ TAB 4: Core Web Vitals ════════ */}
        {activeTab === 4 && (
          <>
            {/* 상단 설명 + 테스트 */}
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>페이지 속도 진단{cwvHasReal ? <LiveBadge /> : <WipBadge />}</h2>
                <div className={styles.strategyToggle}>
                  <button type="button" className={`${styles.strategyBtn} ${cwvStrategy === "mobile" ? styles.strategyBtnActive : ""}`} onClick={() => setCwvStrategy("mobile")}>📱 모바일</button>
                  <button type="button" className={`${styles.strategyBtn} ${cwvStrategy === "desktop" ? styles.strategyBtnActive : ""}`} onClick={() => setCwvStrategy("desktop")}>🖥️ 데스크톱</button>
                </div>
              </div>
              <p className={styles.cwvDesc}>
                Core Web Vitals(핵심 웹 지표)는 <strong>구글이 검색 순위에 반영</strong>하는 페이지 속도 점수입니다.
                점수가 낮으면 검색 결과에서 불이익을 받을 수 있으며, 사용자 이탈률도 높아집니다.
              </p>

              {/* 종합 점수 게이지 */}
              <div className={styles.cwvGrid}>
                {([
                  ["종합 성능", "페이지가 얼마나 빠르게 로딩되는지 종합 평가", cwvAvg.performance],
                  ["검색 최적화 (SEO)", "검색엔진이 페이지를 잘 이해할 수 있는지 평가", cwvAvg.seo],
                  ["접근성", "모든 사용자가 불편 없이 이용할 수 있는지 평가", cwvAvg.accessibility],
                ] as [string, string, number][]).map(([label, desc, score]) => (
                  <div key={label} className={styles.cwvScoreCard}>
                    <ScoreGauge score={score} size={100} color={gaugeColor(score)} />
                    <span className={styles.cwvScoreLabel}>{label}</span>
                    <span className={styles.cwvScoreDesc}>{desc}</span>
                  </div>
                ))}
              </div>

              {/* 점수 기준 안내 */}
              <div className={styles.cwvScaleGuide}>
                <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#10B981" }} /> 90~100 좋음</span>
                <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#F59E0B" }} /> 50~89 개선 필요</span>
                <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#dc2626" }} /> 0~49 나쁨</span>
              </div>
            </section>

            {/* URL 테스트 */}
            <section className={styles.card}>
              <h3 className={styles.cwvSectionSub}>직접 측정하기</h3>
              <p className={styles.cwvDescSmall}>URL을 입력하면 Google PageSpeed API로 실시간 측정합니다. 측정에 15~30초 소요됩니다.</p>
              <div className={styles.cwvTestForm}>
                <input
                  type="url"
                  className={styles.cwvTestInput}
                  value={cwvTestUrl}
                  onChange={(e) => setCwvTestUrl(e.target.value)}
                  placeholder="https://biocom.kr"
                />
                <button
                  type="button"
                  className={styles.cwvTestBtn}
                  onClick={handleCwvTest}
                  disabled={cwvLoading || !cwvTestUrl}
                >
                  {cwvLoading ? "측정 중... (15~30초)" : "⚡ 속도 측정 시작"}
                </button>
              </div>
            </section>

            {/* 측정 리포트 */}
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.cwvSectionSub}>측정 리포트</h3>
                <button
                  type="button"
                  className={styles.trendPeriodBtn}
                  onClick={() => void loadPageSpeedHistory({ limit: 50 })}
                  disabled={pageSpeedHistoryLoading}
                >
                  {pageSpeedHistoryLoading ? "불러오는 중..." : "새로고침"}
                </button>
              </div>
              <p className={styles.cwvDescSmall}>“⚡ 속도 측정 시작”을 누를 때마다 기록이 누적됩니다. (최근 50건)</p>
              {pageSpeedHistoryError ? <p className={styles.error}>오류: {pageSpeedHistoryError}</p> : null}

              {pageSpeedHistory && pageSpeedHistory.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>측정 시각</th>
                        <th>페이지</th>
                        <th>전략</th>
                        <th title="종합 성능 점수">성능</th>
                        <th title="검색 최적화 점수">SEO</th>
                        <th title="최대 콘텐츠 표시 시간">LCP</th>
                        <th title="첫 콘텐츠 표시 시간">FCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSpeedHistory.map((r) => {
                        const href = r.url;
                        const label = r.url.replace(/^https?:\/\//, "");
                        return (
                          <tr key={`${r.measuredAt}:${r.strategy}:${r.url}`}>
                            <td className={styles.numCell}>{new Date(r.measuredAt).toLocaleString("ko-KR")}</td>
                            <td className={styles.queryCell}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "inherit", textDecoration: "none" }}
                                title={href}
                              >
                                {label}
                              </a>
                            </td>
                            <td>{r.strategy === "mobile" ? "모바일" : "데스크톱"}</td>
                            <td className={styles.numCell}>{r.performanceScore}</td>
                            <td className={styles.numCell}>{r.seoScore}</td>
                            <td className={`${styles.numCell} ${cwvStatus("lcp", r.lcpMs).cls}`}>{r.lcpMs >= 1000 ? `${(r.lcpMs / 1000).toFixed(1)}초` : `${r.lcpMs}ms`}</td>
                            <td className={`${styles.numCell} ${cwvStatus("fcp", r.fcpMs).cls}`}>{r.fcpMs >= 1000 ? `${(r.fcpMs / 1000).toFixed(1)}초` : `${r.fcpMs}ms`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.cwvDescSmall} style={{ margin: 0 }}>아직 측정 기록이 없습니다.</p>
              )}
            </section>

            {/* 세부 지표 카드 */}
            <section className={styles.card}>
              <h3 className={styles.cwvSectionSub}>세부 속도 지표</h3>
              <p className={styles.cwvDescSmall}>각 지표가 무엇을 의미하는지, 현재 수치가 어떤 수준인지 확인하세요.</p>
              {(() => {
                const avg = {
                  lcp: Math.round(cwvPages.reduce((s, p) => s + p.lcp, 0) / cwvPages.length),
                  fcp: Math.round(cwvPages.reduce((s, p) => s + p.fcp, 0) / cwvPages.length),
                  cls: +(cwvPages.reduce((s, p) => s + p.cls, 0) / cwvPages.length).toFixed(2),
                  inp: Math.round(cwvPages.reduce((s, p) => s + p.inp, 0) / cwvPages.length),
                  ttfb: Math.round(cwvPages.reduce((s, p) => s + p.ttfb, 0) / cwvPages.length),
                };
                const metrics: { key: string; abbr: string; label: string; desc: string; value: number; unit: string; goodThreshold: string; diagnosis: (v: number) => string }[] = [
                  {
                    key: "lcp", abbr: "LCP", label: "최대 콘텐츠 표시 시간",
                    desc: "페이지에서 가장 큰 이미지나 텍스트가 화면에 보이기까지 걸리는 시간입니다. 사용자가 '페이지가 열렸다'고 느끼는 시점입니다.",
                    value: avg.lcp, unit: "ms", goodThreshold: "2.5초 이하",
                    diagnosis: (v) => v <= 2500 ? "빠르게 로딩되고 있습니다." : v <= 4000 ? "다소 느립니다. 메인 이미지 최적화를 검토하세요." : `${(v / 1000).toFixed(1)}초로 매우 느립니다. 이미지 압축, 서버 응답 속도 개선이 시급합니다.`,
                  },
                  {
                    key: "fcp", abbr: "FCP", label: "첫 콘텐츠 표시 시간",
                    desc: "페이지를 열었을 때 텍스트나 이미지 등 무언가가 처음 화면에 나타나기까지 걸리는 시간입니다.",
                    value: avg.fcp, unit: "ms", goodThreshold: "1.8초 이하",
                    diagnosis: (v) => v <= 1800 ? "빠르게 첫 화면이 표시됩니다." : v <= 3000 ? "첫 화면 표시가 다소 느립니다. CSS 인라인화를 검토하세요." : `${(v / 1000).toFixed(1)}초로 첫 화면 표시가 매우 느립니다. 렌더링 차단 리소스 제거가 필요합니다.`,
                  },
                  {
                    key: "cls", abbr: "CLS", label: "레이아웃 흔들림",
                    desc: "페이지 로딩 중 요소들이 갑자기 위치가 바뀌는 현상입니다. 광고나 이미지가 늦게 로드되면서 버튼 위치가 바뀌어 잘못 클릭하게 되는 문제입니다.",
                    value: avg.cls, unit: "", goodThreshold: "0.1 이하",
                    diagnosis: (v) => v <= 0.1 ? "레이아웃이 안정적입니다. 좋은 상태입니다." : v <= 0.25 ? "가끔 요소 위치가 바뀝니다. 이미지에 크기를 지정하세요." : "레이아웃 흔들림이 심합니다. 이미지/광고 영역에 고정 크기를 설정하세요.",
                  },
                  {
                    key: "inp", abbr: "INP", label: "상호작용 반응 속도",
                    desc: "버튼 클릭이나 입력 등 사용자 조작에 페이지가 반응하기까지 걸리는 시간입니다. 느리면 '먹통'으로 느껴집니다.",
                    value: avg.inp, unit: "ms", goodThreshold: "200ms 이하",
                    diagnosis: (v) => v === 0 ? "측정 데이터가 없습니다. (사용자 상호작용이 감지되지 않음)" : v <= 200 ? "사용자 클릭에 빠르게 반응합니다." : v <= 500 ? "클릭 반응이 다소 느립니다. 무거운 JavaScript를 최적화하세요." : "클릭 반응이 매우 느립니다. JavaScript 번들 크기를 줄이세요.",
                  },
                  {
                    key: "ttfb", abbr: "TTFB", label: "서버 응답 시간",
                    desc: "브라우저가 서버에 요청을 보내고 첫 응답을 받기까지 걸리는 시간입니다. 서버 성능과 네트워크 상태를 반영합니다.",
                    value: avg.ttfb, unit: "ms", goodThreshold: "800ms 이하",
                    diagnosis: (v) => v <= 800 ? "서버가 빠르게 응답합니다." : v <= 1800 ? "서버 응답이 다소 느립니다. 캐싱이나 CDN 도입을 검토하세요." : `서버 응답에 ${(v / 1000).toFixed(1)}초 소요됩니다. 서버 성능 개선 또는 CDN 도입이 시급합니다.`,
                  },
                ];
                return (
                  <div className={styles.cwvDetailGrid}>
                    {metrics.map((m) => {
                      const status = cwvStatus(m.key, m.value);
                      return (
                        <div key={m.key} className={`${styles.cwvDetailCard} ${status.statusCls}`}>
                          <div className={styles.cwvDetailTop}>
                            <div>
                              <span className={styles.cwvDetailAbbr}>{m.abbr}</span>
                              <span className={styles.cwvDetailLabel}>{m.label}</span>
                            </div>
                            <div className={styles.cwvDetailValueWrap}>
                              <span className={`${styles.cwvDetailValue} ${status.cls}`}>
                                {m.key === "cls" ? m.value.toFixed(2) : numberFormatter.format(m.value)}
                              </span>
                              <span className={styles.cwvDetailUnit}>{m.unit}</span>
                            </div>
                          </div>
                          <p className={styles.cwvDetailDesc}>{m.desc}</p>
                          <div className={styles.cwvDetailDiagnosis}>
                            <span className={`${styles.cwvDetailStatusBadge} ${status.statusCls}`}>{status.label}</span>
                            <span className={styles.cwvDetailThreshold}>기준: {m.goodThreshold}</span>
                          </div>
                          <p className={styles.cwvDetailComment}>{m.diagnosis(m.value)}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* 페이지별 상세 */}
            <section className={styles.card}>
              <h3 className={styles.cwvSectionSub}>페이지별 측정 결과</h3>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>페이지</th>
                      <th title="종합 성능 점수">종합 성능</th>
                      <th title="검색 최적화 점수">SEO</th>
                      <th title="최대 콘텐츠 표시 시간">LCP</th>
                      <th title="첫 콘텐츠 표시 시간">FCP</th>
                      <th title="레이아웃 흔들림">CLS</th>
                      <th title="상호작용 반응 속도">INP</th>
                      <th title="서버 응답 시간">TTFB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cwvPages.map((p) => (
                      <tr key={p.url}>
                        <td className={styles.queryCell}>{p.label}</td>
                        <td className={styles.numCell}><span className={gaugeColor(p.performance) === "#10B981" ? styles.cwvGood : gaugeColor(p.performance) === "#F59E0B" ? styles.cwvNeedsImprovement : styles.cwvPoor} style={{ fontWeight: 700 }}>{p.performance}</span></td>
                        <td className={styles.numCell}>{p.seo}</td>
                        <td className={`${styles.numCell} ${cwvStatus("lcp", p.lcp).cls}`}>{p.lcp >= 1000 ? `${(p.lcp / 1000).toFixed(1)}초` : `${p.lcp}ms`}</td>
                        <td className={`${styles.numCell} ${cwvStatus("fcp", p.fcp).cls}`}>{p.fcp >= 1000 ? `${(p.fcp / 1000).toFixed(1)}초` : `${p.fcp}ms`}</td>
                        <td className={`${styles.numCell} ${cwvStatus("cls", p.cls).cls}`}>{p.cls.toFixed(2)}</td>
                        <td className={`${styles.numCell} ${cwvStatus("inp", p.inp).cls}`}>{p.inp === 0 ? "—" : `${p.inp}ms`}</td>
                        <td className={`${styles.numCell} ${cwvStatus("ttfb", p.ttfb).cls}`}>{p.ttfb >= 1000 ? `${(p.ttfb / 1000).toFixed(1)}초` : `${p.ttfb}ms`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ════════ TAB 3: PageSpeed 보고서 ════════ */}
        {activeTab === 3 && (
          <>
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>PageSpeed 보고서</h2>
                <span className={styles.sectionMeta}>
                  {pageSpeedReport?.updatedAt
                    ? `마지막 업데이트: ${new Date(pageSpeedReport.updatedAt).toLocaleString("ko-KR")}`
                    : ""}
                </span>
              </div>

              {pageSpeedReportLoading && <p className={styles.reportLoading}>보고서를 불러오는 중...</p>}
              {pageSpeedReportError && <p className={styles.reportError}>보고서 로드 실패: {pageSpeedReportError}</p>}

              {pageSpeedReport && (
                <div className={styles.reportContent}>
                  {parseMarkdownLite(pageSpeedReport.markdown).map((block, idx) => {
                    switch (block.type) {
                      case "h1":
                        return <h1 key={idx}>{renderInline(block.text)}</h1>;
                      case "h2":
                        return <h2 key={idx}>{renderInline(block.text)}</h2>;
                      case "h3":
                        return <h3 key={idx}>{renderInline(block.text)}</h3>;
                      case "hr":
                        return <hr key={idx} />;
                      case "ul":
                        return (
                          <ul key={idx}>
                            {block.items.map((item, itemIdx) => (
                              <li key={itemIdx}>{renderInline(item)}</li>
                            ))}
                          </ul>
                        );
                      case "ol":
                        return (
                          <ol key={idx}>
                            {block.items.map((item, itemIdx) => (
                              <li key={itemIdx}>{renderInline(item)}</li>
                            ))}
                          </ol>
                        );
                      case "p":
                        return (
                          <p key={idx}>
                            {block.lines.map((line, lineIdx) => (
                              <span key={lineIdx}>
                                {renderInline(line)}
                                {lineIdx < block.lines.length - 1 ? <br /> : null}
                              </span>
                            ))}
                          </p>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ════════ TAB 5: 사용자 행동 ════════ */}
        {activeTab === 5 && (
          <>
            {/* 페이지별 체류 분석 */}
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>페이지별 사용자 행동 (GA4){behaviorData ? <LiveBadge /> : <WipBadge />}</h2>
                <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
                  <div className={styles.keywordMetaTop}>
                    <div className={styles.keywordRangeBtns}>
                      {(["7d", "30d", "90d"] as const).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`${styles.trendPeriodBtn} ${behaviorRangePreset === preset ? styles.trendPeriodBtnActive : ""}`}
                          onClick={() => {
                            setBehaviorRangePreset(preset);
                            setBehaviorDatePickerOpen(false);
                            void loadBehavior({ days: BEHAVIOR_PRESET_DAYS[preset] });
                          }}
                          disabled={behaviorLoading}
                        >
                          {preset.replace("d", "일")}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`${styles.trendPeriodBtn} ${behaviorRangePreset === "custom" || behaviorDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
                        onClick={() => setBehaviorDatePickerOpen((p) => !p)}
                        disabled={behaviorLoading}
                        title="기간 직접 지정"
                      >
                        📅
                      </button>
                    </div>
                    <span className={styles.keywordRangeText}>
                      {behaviorData
                        ? `📅 ${behaviorDateRange?.start ?? ""} ~ ${behaviorDateRange?.end ?? ""} (${behaviorRangeLabel}) · GA4 실데이터`
                        : "GA4 API 활성화 필요 — Mock 데이터 표시 중"}
                    </span>
                  </div>
                  {behaviorLoading && <span className={styles.keywordMetaBottom}>조회 중...</span>}
                </div>
              </div>
              {behaviorDatePickerOpen && (
                <div className={styles.keywordDatePicker}>
                  <div className={styles.dateInputs}>
                    <label className={styles.fieldLabel}>시작일<input type="date" value={behaviorStartInput} onChange={(e) => setBehaviorStartInput(e.target.value)} required /></label>
                    <label className={styles.fieldLabel}>종료일<input type="date" value={behaviorEndInput} onChange={(e) => setBehaviorEndInput(e.target.value)} required /></label>
                  </div>
                  <div className={styles.keywordDateActions}>
                    <button
                      type="button"
                      className={styles.keywordActionBtn}
                      onClick={() => {
                        if (!behaviorStartInput || !behaviorEndInput) return;
                        if (behaviorStartInput > behaviorEndInput) return;
                        setBehaviorRangePreset("custom");
                        setBehaviorDatePickerOpen(false);
                        void loadBehavior({ startDate: behaviorStartInput, endDate: behaviorEndInput });
                      }}
                      disabled={behaviorLoading}
                    >
                      적용
                    </button>
                    <button type="button" className={styles.keywordActionBtn} onClick={() => setBehaviorDatePickerOpen(false)} disabled={behaviorLoading}>닫기</button>
                  </div>
                </div>
              )}
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr><th>페이지</th><th>세션</th><th>사용자</th><th>평균 체류</th><th>이탈률</th><th>스크롤</th><th>전환</th></tr>
                  </thead>
                  <tbody>
                    {liveBehavior.map((b) => (
                      <tr key={b.page}>
                        <td className={styles.queryCell}>{b.page}</td>
                        <td className={styles.numCell}>{numberFormatter.format(b.sessions)}</td>
                        <td className={styles.numCell}>{numberFormatter.format(b.users)}</td>
                        <td className={styles.numCell}>{Math.floor(b.avgTime / 60)}분 {(b.avgTime % 60).toFixed(2)}초</td>
                        <td className={`${styles.numCell} ${b.bounceRate > 45 ? styles.kwDeltaDown : ""}`}>{decimalFormatter.format(b.bounceRate)}%</td>
                        <td className={styles.numCell}>{b.scrollDepth}%</td>
                        <td className={styles.numCell}>{b.conversions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SEO → 전환 퍼널 */}
            <section className={styles.funnelSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>SEO → 전환 퍼널{funnelData ? <LiveBadge /> : <WipBadge />}</h2>
                <span className={styles.sectionMeta}>최근 30일 유기 검색 기준</span>
              </div>
              <div className={styles.funnelSteps}>
                {liveFunnel.map((step) => (
                  <div key={step.label} className={styles.funnelStep}>
                    <span className={styles.funnelLabel}>{step.label}</span>
                    <div className={styles.funnelBarWrap}>
                      <div className={styles.funnelBar} style={{ width: `${step.percent}%` }}>
                        {step.percent > 15 && <span className={styles.funnelBarValue}>{numberFormatter.format(step.value)}</span>}
                      </div>
                    </div>
                    <span className={styles.funnelPercent}>{step.percent}%</span>
                  </div>
                ))}
              </div>

              {/* ── 퍼널 인사이트 ── */}
              {liveFunnel.length >= 2 && (() => {
                const first = liveFunnel[0];
                const last = liveFunnel[liveFunnel.length - 1];
                const overallRate = first.value > 0 ? (last.value / first.value * 100) : 0;
                const pagesPerSession = first.value > 0 ? (liveFunnel[1]?.value ?? 0) / first.value : 0;

                const dropoffs = liveFunnel.slice(1).map((step, idx) => {
                  const prev = liveFunnel[idx];
                  const rate = prev.value > 0 ? (step.value / prev.value * 100) : 0;
                  const lost = prev.value - step.value;
                  return { from: prev.label, to: step.label, rate, lost };
                });

                const worstDrop = dropoffs.reduce((a, b) => a.rate < b.rate ? a : b, dropoffs[0]);
                const bestDrop = dropoffs.reduce((a, b) => a.rate > b.rate ? a : b, dropoffs[0]);

                const engageStep = liveFunnel.find(s => s.label.includes("참여") || s.label.includes("세션"));
                const engageRate = first.value > 0 && engageStep ? (engageStep.value / first.value * 100) : 0;

                return (
                  <div className={styles.funnelInsights}>
                    <div className={styles.funnelInsightsTitle}>퍼널 핵심 지표</div>

                    <div className={styles.funnelKpiRow}>
                      <div className={styles.funnelKpiCard}>
                        <div className={styles.funnelKpiLabel}>전체 전환율</div>
                        <div className={styles.funnelKpiValue} style={{ color: overallRate >= 2 ? "var(--trend-green)" : overallRate >= 1 ? "var(--opportunity-amber)" : "var(--urgent-red)" }}>
                          {overallRate.toFixed(1)}%
                        </div>
                        <div className={styles.funnelKpiSub}>{first.label} → {last.label}</div>
                      </div>
                      <div className={styles.funnelKpiCard}>
                        <div className={styles.funnelKpiLabel}>페이지/세션</div>
                        <div className={styles.funnelKpiValue} style={{ color: "var(--color-primary)" }}>
                          {pagesPerSession.toFixed(1)}
                        </div>
                        <div className={styles.funnelKpiSub}>유입 대비 페이지 조회</div>
                      </div>
                      <div className={styles.funnelKpiCard}>
                        <div className={styles.funnelKpiLabel}>참여율</div>
                        <div className={styles.funnelKpiValue} style={{ color: engageRate >= 80 ? "var(--trend-green)" : engageRate >= 50 ? "var(--opportunity-amber)" : "var(--urgent-red)" }}>
                          {engageRate > 0 ? `${engageRate.toFixed(1)}%` : "-"}
                        </div>
                        <div className={styles.funnelKpiSub}>참여 세션 / 유입</div>
                      </div>
                      <div className={styles.funnelKpiCard}>
                        <div className={styles.funnelKpiLabel}>최대 이탈 구간</div>
                        <div className={styles.funnelKpiValue} style={{ color: "var(--urgent-red)" }}>
                          {worstDrop ? `${Math.abs(100 - worstDrop.rate).toFixed(0)}%` : "-"}
                        </div>
                        <div className={styles.funnelKpiSub}>{worstDrop ? worstDrop.from : "-"} 이탈</div>
                      </div>
                    </div>

                    <div className={styles.funnelInsightsTitle}>단계별 전환율</div>
                    <div className={styles.funnelDropoffs}>
                      {dropoffs.map((d, idx) => {
                        const level = d.rate >= 70 ? "Good" : d.rate >= 30 ? "Warn" : "Poor";
                        const barColor = level === "Good" ? "#10B981" : level === "Warn" ? "#F59E0B" : "#EF4444";
                        return (
                          <div key={idx} className={styles.funnelDropoffRow}>
                            <span className={styles.funnelDropoffArrow}>{d.from} →</span>
                            <span className={styles.funnelDropoffLabel}>{d.to}</span>
                            <div className={styles.funnelDropoffBar}>
                              <div className={styles.funnelDropoffBarFill} style={{ width: `${Math.min(d.rate, 100)}%`, background: barColor }} />
                            </div>
                            <span className={`${styles.funnelDropoffRate} ${styles[`funnelDropoff${level}` as keyof typeof styles]}`}>
                              {d.rate.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0, width: 80, textAlign: "right" }}>
                              {d.lost > 0 ? `-${numberFormatter.format(d.lost)}명` : `+${numberFormatter.format(Math.abs(d.lost))}명`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.funnelInsightNote}>
                      <div className={styles.funnelInsightNoteTitle}>AI 인사이트</div>
                      {worstDrop && worstDrop.rate < 50 ? (
                        <span>
                          가장 큰 이탈이 <strong>{worstDrop.from}</strong> → <strong>{worstDrop.to}</strong> 구간에서 발생 (전환율 {worstDrop.rate.toFixed(1)}%, {numberFormatter.format(Math.abs(worstDrop.lost))}명 이탈).
                          이 구간의 CTA 배치, 페이지 로딩 속도, 콘텐츠 연관성을 점검하면 전체 전환율을 크게 개선할 수 있소.
                        </span>
                      ) : (
                        <span>
                          전체 퍼널의 최종 전환율은 <strong>{overallRate.toFixed(1)}%</strong>이오.
                          {bestDrop && ` 가장 전환이 잘 되는 구간은 ${bestDrop.from} → ${bestDrop.to} (${bestDrop.rate.toFixed(1)}%)이오.`}
                          {engageRate > 0 && ` 참여율 ${engageRate.toFixed(1)}%로 유입 대비 콘텐츠 몰입도가 ${engageRate >= 80 ? "우수" : engageRate >= 50 ? "보통" : "낮은 편"}이오.`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* 뷰저블 바로가기 */}
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>히트맵 / 세션 분석<WipBadge /></h2>
                <span className={styles.sectionMeta}>뷰저블(Beusable) 외부 도구</span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 14 }}>
                뷰저블은 별도 독립 도구로 사용합니다. 아래 버튼으로 해당 페이지의 히트맵을 바로 확인할 수 있습니다.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {liveColumns.slice(0, 5).map((col) => (
                  <button key={col.url} type="button" className={styles.beusableBtn}>
                    🔥 {col.title.substring(0, 15)}...
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ════════ TAB 6: 페이지 진단 ════════ */}
        {activeTab === 6 && (
          <>
            {/* URL 입력 폼 */}
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>페이지 진단 리포트</h2>
              </div>
              <p className={styles.cwvDescSmall}>URL을 입력하면 Schema 마크업, 콘텐츠 구조, AEO/GEO 점수를 종합 진단합니다.</p>
              <div className={styles.cwvTestForm}>
                <input
                  type="url"
                  className={styles.cwvTestInput}
                  value={diagUrl}
                  onChange={(e) => setDiagUrl(e.target.value)}
                  placeholder="https://biocom.kr/healthinfo"
                />
                <button
                  type="button"
                  className={styles.cwvTestBtn}
                  onClick={handleDiagnosisTest}
                  disabled={diagLoading || !diagUrl.trim()}
                >
                  {diagLoading ? "진단 중... (10~30초)" : "🔍 페이지 진단 시작"}
                </button>
              </div>
              {diagError && <p className={styles.reportError}>{diagError}</p>}
            </section>

            {/* AEO/GEO 점수 카드 */}
            {(diagAeoScore || diagGeoScore) && (
              <>
                <section className={styles.heroGrid}>
                  {[
                    { label: "AEO Score", data: diagAeoScore, idx: 0 },
                    { label: "GEO Score", data: diagGeoScore, idx: 1 },
                  ].map(({ label, data, idx }) => {
                    const score = data?.normalizedScore ?? 0;
                    const measured = data ? data.breakdown.filter((b) => b.status === "measured").length : 0;
                    const total = data ? data.breakdown.length : 0;
                    return (
                      <article key={label} className={styles.scoreCard}>
                        <div className={styles.scoreCardHeader}>
                          <span className={styles.scoreLabel}>{label}</span>
                          <span className={styles.scoreFraction}>{score}/100</span>
                        </div>
                        <p className={`${styles.scoreValue} ${idx === 0 ? styles.scoreValueAeo : styles.scoreValueGeo}`}>{score}</p>
                        <div className={styles.progressTrack}>
                          <div
                            className={`${styles.progressFill} ${idx === 0 ? styles.progressFillAeo : styles.progressFillGeo}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        {data && <p className={styles.scoreMeta}>{measured}/{total} 항목 측정 완료 · {data.totalScore}/{data.maxPossible}점</p>}
                      </article>
                    );
                  })}
                </section>

                {/* AEO/GEO 브레이크다운 */}
                <section className={styles.breakdownSection}>
                  {[diagAeoScore, diagGeoScore].filter(Boolean).map((result) => (
                    <div key={result!.type} className={styles.breakdownCard}>
                      <h3 className={styles.breakdownTitle}>{result!.type} Score 상세 ({result!.normalizedScore}점)</h3>
                      <div className={styles.breakdownGrid}>
                        {result!.breakdown.map((b) => (
                          <div key={b.name} className={`${styles.breakdownItem} ${b.status === "unavailable" ? styles.breakdownUnavailable : ""}`}>
                            <div className={styles.breakdownItemHeader}>
                              <span className={styles.breakdownItemLabel}>{b.label}</span>
                              <span className={styles.breakdownItemScore}>{b.score}/{b.maxScore}</span>
                            </div>
                            <div className={styles.breakdownBar}>
                              <div className={styles.breakdownBarFill} style={{ width: b.maxScore > 0 ? `${(b.score / b.maxScore) * 100}%` : "0%" }} />
                            </div>
                            <p className={styles.breakdownDetail}>{b.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}

            {/* Schema 마크업 진단 */}
            {diagCrawlResult && (
              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Schema 마크업 진단</h2>
                  <span className={styles.sectionMeta}>JSON-LD {diagCrawlResult.schema.rawCount}개 블록 감지</span>
                </div>
                <div className={styles.diagSchemaGrid}>
                  {([
                    { key: "FAQPage", icon: "❓", present: diagCrawlResult.schema.hasFAQ, desc: "자주 묻는 질문을 구조화하여 검색 결과에 FAQ 리치 결과로 표시" },
                    { key: "Article", icon: "📰", present: diagCrawlResult.schema.hasArticle, desc: "콘텐츠의 제목, 저자, 날짜 등을 구조화하여 뉴스/기사 리치 결과 생성" },
                    { key: "HowTo", icon: "📋", present: diagCrawlResult.schema.hasHowTo, desc: "단계별 가이드를 구조화하여 How-to 리치 결과로 표시" },
                    { key: "Author/Person", icon: "👤", present: diagCrawlResult.schema.hasAuthor, desc: "저자 정보를 명시하여 E-E-A-T 신뢰도 향상" },
                    { key: "Medical", icon: "🏥", present: diagCrawlResult.schema.hasMedical, desc: "의료/건강 콘텐츠에 특화된 스키마로 YMYL 신뢰도 강화" },
                    { key: "Speakable", icon: "🔊", present: diagCrawlResult.schema.hasSpeakable, desc: "음성 검색(Google Assistant)에서 콘텐츠를 읽어줄 수 있도록 지정" },
                  ] as const).map((s) => (
                    <div key={s.key} className={`${styles.diagSchemaCard} ${s.present ? styles.diagSchemaPresent : styles.diagSchemaAbsent}`}>
                      <div className={styles.diagSchemaIcon}>{s.icon}</div>
                      <div className={styles.diagSchemaName}>{s.key}</div>
                      <div className={styles.diagSchemaStatus}>{s.present ? "✅ 감지됨" : "❌ 없음"}</div>
                      <p className={styles.diagSchemaDesc}>{s.desc}</p>
                    </div>
                  ))}
                </div>
                {diagCrawlResult.schema.types.length > 0 && (
                  <div className={styles.diagDetectedSchemas}>
                    <span className={styles.diagDetectedLabel}>감지된 Schema:</span>
                    {diagCrawlResult.schema.types.map((t) => (
                      <span key={t} className={styles.diagDetectedTag}>{t}</span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 콘텐츠 구조 분석 */}
            {diagCrawlResult && (
              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>콘텐츠 구조 분석</h2>
                  <span className={styles.sectionMeta}>총 {numberFormatter.format(diagCrawlResult.content.wordCount)}단어</span>
                </div>
                <div className={styles.diagContentGrid}>
                  {([
                    { label: "H2 제목", value: diagCrawlResult.content.h2Count, good: 3, warn: 1 },
                    { label: "H3 소제목", value: diagCrawlResult.content.h3Count, good: 2, warn: 1 },
                    { label: "목록(ul/ol)", value: diagCrawlResult.content.listCount, good: 1, warn: 0 },
                    { label: "표(table)", value: diagCrawlResult.content.tableCount, good: 1, warn: 0 },
                    { label: "인용(blockquote)", value: diagCrawlResult.content.blockquoteCount, good: 1, warn: 0 },
                    { label: "이미지", value: diagCrawlResult.content.imgCount, good: 1, warn: 0 },
                    { label: "이미지 alt 있음", value: diagCrawlResult.content.imgWithAlt, good: diagCrawlResult.content.imgCount || 1, warn: Math.max(1, Math.floor((diagCrawlResult.content.imgCount || 1) * 0.5)) },
                    { label: "메타 설명 길이", value: diagCrawlResult.content.metaDescLength, good: 70, warn: 30 },
                  ] as const).map((m) => {
                    const status = m.value >= m.good ? "good" : m.value >= m.warn ? "warning" : "poor";
                    const statusCls = status === "good" ? styles.diagContentGood : status === "warning" ? styles.diagContentWarning : styles.diagContentPoor;
                    const dot = status === "good" ? "🟢" : status === "warning" ? "🟡" : "🔴";
                    return (
                      <div key={m.label} className={`${styles.diagContentCard} ${statusCls}`}>
                        <div className={styles.diagContentLabel}>{m.label}</div>
                        <div className={styles.diagContentValue}>{dot} {m.value}개</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 감점 요인 및 개선 권장 */}
            {diagnosisItems.length > 0 && (
              <section className={styles.card}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>감점 요인 및 개선 권장</h2>
                  <span className={styles.sectionMeta}>{diagnosisItems.length}개 항목 발견</span>
                </div>
                <div className={styles.diagIssuesList}>
                  {diagnosisItems.map((item, idx) => {
                    const pm = DIAG_PRIORITY_MAP[item.priority];
                    return (
                      <div key={idx} className={styles.diagIssueRow}>
                        <span className={`${styles.diagIssueDot} ${styles[pm.dot]}`} />
                        <span className={`${styles.diagIssuePriority} ${styles[pm.cls]}`}>{pm.label}</span>
                        <div className={styles.diagIssueContent}>
                          <div className={styles.diagIssueTitle}>[{item.category}] {item.issue}</div>
                          <div className={styles.diagIssueRec}>💡 {item.recommendation}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ════════ TAB 7: 솔루션 소개 ════════ */}
        {activeTab === 7 && (
          <>
            {/* 히어로 */}
            <section className={styles.introHero}>
              <div className={styles.introHeroIcon}>🧠</div>
              <h1 className={styles.introHeroTitle}>biocom.kr SEO Intelligence Dashboard</h1>
              <p className={styles.introHeroSub}>
                GSC + PageSpeed + GA4 API를 연동하여 건강칼럼 콘텐츠의 검색 성능을 체계적으로
                모니터링하고, AEO/GEO 최적화 인사이트를 자동으로 도출하는 통합 대시보드입니다.
              </p>
              <span className={styles.introHeroSite}>대상: biocom.kr/healthinfo (건강칼럼 섹션)</span>
            </section>

            {/* 문제 인식 & 솔루션 */}
            <section className={styles.introGrid2}>
              <div className={styles.introCard}>
                <h3 className={styles.introCardTitle}>🎯 왜 필요한가?</h3>
                <p className={styles.introCardDesc}>
                  biocom.kr의 건강칼럼은 <strong>YMYL(Your Money or Your Life)</strong> 카테고리에 해당하여
                  구글의 <strong>E-E-A-T</strong> 평가가 특히 중요합니다. 기존에는 검색 성과를 수동으로
                  확인하는 데 <strong>주 2시간 이상</strong> 소요되었고, 데이터 기반의 체계적 의사결정이 어려웠습니다.
                </p>
                <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
                  또한 AI 검색(ChatGPT, Perplexity 등)이 확산되면서, 전통적인 SEO를 넘어
                  <strong> AEO(Answer Engine Optimization)</strong>와 <strong>GEO(Generative Engine Optimization)</strong> 전략이
                  필수가 되었습니다.
                </p>
              </div>
              <div className={styles.introCard}>
                <h3 className={styles.introCardTitle}>💡 무엇을 해결하는가?</h3>
                <p className={styles.introCardDesc}>
                  <strong>1. 자동 모니터링</strong> — Google API 연동으로 검색 성과, 페이지 속도, 사용자 행동을 매일 자동 수집하고 대시보드에 시각화합니다.
                </p>
                <p className={styles.introCardDesc}>
                  <strong>2. AI 기반 인사이트</strong> — 순위 하락, CTR 저하, 기회 키워드 등을 AI가 자동 감지하여 즉각적인 개선 방향을 제시합니다.
                </p>
                <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
                  <strong>3. AEO/GEO 추적</strong> — Q&A 키워드 분류, Featured Snippet 모니터링, AI 인용 여부를 추적하여 차세대 검색 최적화를 지원합니다.
                </p>
              </div>
            </section>

            {/* 데이터 소스 */}
            <section className={styles.introDataSources}>
              <div className={styles.introDataSource}>
                <div className={styles.introDataSourceIcon}>🔍</div>
                <div className={styles.introDataSourceName}>Google Search Console</div>
                <div className={`${styles.introDataSourcePhase} ${styles.introPhase1}`}>Phase 1 — 연동 완료 ✅</div>
                <p className={styles.introDataSourceDesc}>
                  클릭수, 노출수, CTR, 평균 순위를 페이지별/키워드별로 조회. 최대 16개월 과거 데이터 제공.
                </p>
              </div>
              <div className={styles.introDataSource}>
                <div className={styles.introDataSourceIcon}>⚡</div>
                <div className={styles.introDataSourceName}>PageSpeed Insights</div>
                <div className={`${styles.introDataSourcePhase} ${styles.introPhase1}`}>Phase 1 — 연동 완료 ✅</div>
                <p className={styles.introDataSourceDesc}>
                  LCP, FCP, CLS, INP 등 Core Web Vitals 측정. Lighthouse + CrUX 실사용자 데이터 병행 제공.
                </p>
              </div>
              <div className={styles.introDataSource}>
                <div className={styles.introDataSourceIcon}>📊</div>
                <div className={styles.introDataSourceName}>GA4 Data API</div>
                <div className={`${styles.introDataSourcePhase} ${styles.introPhase2}`}>Phase 2 — GCP API 활성화 필요</div>
                <p className={styles.introDataSourceDesc}>
                  체류시간, 이탈률, 스크롤 깊이, 전환율 등 검색 후 사용자 행동 분석. SEO→전환 연결.
                </p>
              </div>
            </section>

            {/* 주요 기능 (5 페이지) */}
            <section className={styles.introCard}>
              <h3 className={styles.introCardTitle}>📋 대시보드 주요 기능</h3>
              <ul className={styles.introFeatureList}>
                {[
                  { num: "01", name: "오버뷰", desc: "KPI 요약 카드 4개, 클릭/노출 추이 차트, AI 인사이트 알림, AEO/GEO 점수 게이지" },
                  { num: "02", name: "칼럼별 분석", desc: "각 칼럼의 클릭/노출/CTR/순위 + 검색(40%)+기술(20%)+체류(25%)+AEO/GEO(15%) 가중 종합 스코어" },
                  { num: "03", name: "키워드 분석", desc: "TOP 50 키워드 순위 변동, Q&A 키워드 자동분류, Featured Snippet 모니터링, 기회 키워드 발견" },
                  { num: "04", name: "Core Web Vitals", desc: "LCP/FCP/CLS/INP/TTFB 게이지, 모바일/데스크톱 전략별 비교, 페이지별 성능 히트맵" },
                  { num: "05", name: "사용자 행동", desc: "GA4 기반 체류 분석, 유기검색→칼럼→제품→구매 전환 퍼널, 뷰저블 히트맵 바로가기" },
                ].map((f) => (
                  <li key={f.num} className={styles.introFeatureItem}>
                    <span className={styles.introFeatureNum}>{f.num}</span>
                    <div>
                      <div className={styles.introFeatureName}>{f.name}</div>
                      <div className={styles.introFeatureDesc}>{f.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* AEO/GEO + 스코어 구성 */}
            <section className={styles.introGrid2}>
              <div className={styles.introCard}>
                <h3 className={styles.introCardTitle}>🤖 AEO/GEO 최적화란?</h3>
                <p className={styles.introCardDesc}>
                  <strong>AEO (Answer Engine Optimization)</strong>는 AI 챗봇(ChatGPT, Perplexity 등)이
                  우리 콘텐츠를 답변 소스로 인용하도록 최적화하는 전략입니다.
                </p>
                <p className={styles.introCardDesc}>
                  <strong>GEO (Generative Engine Optimization)</strong>는 구글 AI Overview, Bing Copilot 등
                  생성형 검색 결과에서 우리 콘텐츠가 노출되도록 하는 전략입니다.
                </p>
                <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
                  이 대시보드는 Q&A 키워드 자동 태깅, Featured Snippet 획득 추적, AI 인용 모니터링을 통해
                  AEO/GEO 성과를 체계적으로 관리합니다.
                </p>
              </div>
              <div className={styles.introCard}>
                <h3 className={styles.introCardTitle}>📐 칼럼 종합 스코어 산출</h3>
                <p className={styles.introCardDesc}>GSC + PageSpeed + GA4 데이터를 종합하여 각 칼럼에 0~100점 스코어를 부여합니다.</p>
                <table className={styles.introScoreTable}>
                  <thead>
                    <tr><th>구성요소</th><th>가중치</th><th>기준</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className={styles.introScoreBar} style={{ width: 40, background: "#0D9488" }} />검색 성과</td>
                      <td><strong>40%</strong></td>
                      <td>클릭수 + CTR + 순위 종합</td>
                    </tr>
                    <tr>
                      <td><span className={styles.introScoreBar} style={{ width: 20, background: "#2563eb" }} />기술 성능</td>
                      <td><strong>20%</strong></td>
                      <td>Performance + CWV 통과</td>
                    </tr>
                    <tr>
                      <td><span className={styles.introScoreBar} style={{ width: 25, background: "#f59e0b" }} />사용자 체류</td>
                      <td><strong>25%</strong></td>
                      <td>체류시간, 이탈률, 스크롤</td>
                    </tr>
                    <tr>
                      <td><span className={styles.introScoreBar} style={{ width: 15, background: "#8b5cf6" }} />AEO/GEO</td>
                      <td><strong>15%</strong></td>
                      <td>Q&A 구조화 + Featured + AI 인용</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 로드맵 */}
            <section className={styles.introCard}>
              <h3 className={styles.introCardTitle}>🗓️ 구현 로드맵</h3>
              <div className={styles.introRoadmap}>
                <div className={styles.introRoadmapPhase}>
                  <div className={styles.introRoadmapLeft}>
                    <div className={styles.introRoadmapWeek}>1주차</div>
                    <span className={`${styles.introRoadmapStatus} ${styles.introStatusDone}`}>✅ 완료</span>
                  </div>
                  <div className={styles.introRoadmapRight}>
                    <div className={styles.introRoadmapTitle}>Phase 1-1: 인프라 + GSC 연동</div>
                    <ul className={styles.introRoadmapItems}>
                      <li className={styles.introRoadmapItem}>✅ GCP 프로젝트 세팅 + API 활성화</li>
                      <li className={styles.introRoadmapItem}>✅ Next.js 프론트엔드 + Express 백엔드 구축</li>
                      <li className={styles.introRoadmapItem}>✅ GSC API 연동 (Service Account 인증)</li>
                      <li className={styles.introRoadmapItem}>✅ 대시보드 UI 5개 탭 프로토타입</li>
                    </ul>
                  </div>
                </div>
                <div className={styles.introRoadmapPhase}>
                  <div className={styles.introRoadmapLeft}>
                    <div className={styles.introRoadmapWeek}>2주차</div>
                    <span className={`${styles.introRoadmapStatus} ${styles.introStatusDone}`}>✅ 완료</span>
                  </div>
                  <div className={styles.introRoadmapRight}>
                    <div className={styles.introRoadmapTitle}>Phase 1-2: PageSpeed + 실데이터 연결</div>
                    <ul className={styles.introRoadmapItems}>
                      <li className={styles.introRoadmapItem}>✅ PageSpeed Insights API 연동</li>
                      <li className={styles.introRoadmapItem}>☐ Supabase DB 스키마 생성 + Cron Job</li>
                      <li className={styles.introRoadmapItem}>✅ 오버뷰 KPI 카드 실데이터 연결</li>
                      <li className={styles.introRoadmapItem}>✅ CWV 게이지 실데이터 연결</li>
                      <li className={styles.introRoadmapItem}>☐ Vercel 배포 + 환경변수 설정</li>
                    </ul>
                  </div>
                </div>
                <div className={styles.introRoadmapPhase}>
                  <div className={styles.introRoadmapLeft}>
                    <div className={styles.introRoadmapWeek}>3주차</div>
                    <span className={`${styles.introRoadmapStatus} ${styles.introStatusProgress}`}>🔧 진행중</span>
                  </div>
                  <div className={styles.introRoadmapRight}>
                    <div className={styles.introRoadmapTitle}>Phase 2-1: GA4 + 키워드 분석</div>
                    <ul className={styles.introRoadmapItems}>
                      <li className={styles.introRoadmapItem}>✅ GA4 Data API 코드 구현 (GCP 활성화 대기)</li>
                      <li className={styles.introRoadmapItem}>✅ 키워드 Q&A 자동분류 로직</li>
                      <li className={styles.introRoadmapItem}>✅ 칼럼 성과 스코어카드 실데이터</li>
                    </ul>
                  </div>
                </div>
                <div className={styles.introRoadmapPhase}>
                  <div className={styles.introRoadmapLeft}>
                    <div className={styles.introRoadmapWeek}>4주차</div>
                    <span className={`${styles.introRoadmapStatus} ${styles.introStatusPending}`}>대기</span>
                  </div>
                  <div className={styles.introRoadmapRight}>
                    <div className={styles.introRoadmapTitle}>Phase 2-2: AI 모니터링 + 완성</div>
                    <ul className={styles.introRoadmapItems}>
                      <li className={styles.introRoadmapItem}>☐ AI 인용 모니터링 (GEO)</li>
                      <li className={styles.introRoadmapItem}>☐ 알림 시스템 (순위 급변, 성능 저하)</li>
                      <li className={styles.introRoadmapItem}>☐ 뷰저블 바로가기 통합</li>
                      <li className={styles.introRoadmapItem}>☐ 최종 QA + 운영 가이드 문서</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 성공 지표 */}
            <section className={styles.introCard}>
              <h3 className={styles.introCardTitle}>🎯 성공 지표</h3>
              <div className={styles.introMetrics}>
                <div className={styles.introMetricCard}>
                  <div className={styles.introMetricLabel}>SEO 모니터링 소요시간</div>
                  <div className={styles.introMetricTarget}>주 2시간 → 주 10분</div>
                </div>
                <div className={styles.introMetricCard}>
                  <div className={styles.introMetricLabel}>건강칼럼 오가닉 클릭</div>
                  <div className={styles.introMetricTarget}>+30% 성장 (3개월)</div>
                </div>
                <div className={styles.introMetricCard}>
                  <div className={styles.introMetricLabel}>평균 검색 순위</div>
                  <div className={styles.introMetricTarget}>TOP 20 → TOP 10</div>
                </div>
                <div className={styles.introMetricCard}>
                  <div className={styles.introMetricLabel}>Core Web Vitals 통과율</div>
                  <div className={styles.introMetricTarget}>90% 이상 Good</div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* ════════ 캡처 오버레이 ════════ */}
      {capturing && (
        <div className={styles.captureOverlay}>
          <span>📸 캡처 중...</span>
        </div>
      )}

      {/* ════════ 플로팅 AI 채팅 ════════ */}
      <button type="button" className={styles.chatFab} onClick={() => setChatOpen((p) => !p)} aria-label="AI 상담 열기">💬</button>
      {chatOpen && (
        <div className={styles.chatPanel}>
          <div className={styles.chatPanelHeader}>
            <span className={styles.chatPanelTitle}>🤖 BiocomAI 어시스턴트<LiveBadge /></span>
            <button type="button" className={styles.chatClose} onClick={() => setChatOpen(false)} aria-label="채팅 닫기">✕</button>
          </div>
          <div ref={chatMessagesRef} className={styles.chatMessages}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`${styles.chatBubble} ${msg.role === "ai" ? styles.chatBubbleAi : styles.chatBubbleUser}`}>{msg.text}</div>
            ))}
            {chatSending && (
              <div className={`${styles.chatBubble} ${styles.chatBubbleAi}`}>답변 생성 중...</div>
            )}
          </div>
          <form className={styles.chatInputRow} onSubmit={(e) => { e.preventDefault(); void handleChatSend(); }}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="SEO 관련 질문을 입력하세요..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
            />
            <button type="submit" className={styles.chatSendBtn} disabled={chatSending || !chatInput.trim()}>전송</button>
          </form>
        </div>
      )}
    </div>
  );
}
