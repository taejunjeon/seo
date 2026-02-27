/* ═══════════════════════════════════════
   page.tsx에서 추출된 타입 정의
   ═══════════════════════════════════════ */

export type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type GscQueryResponse = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowCount: number;
  rows: GscRow[];
};

export type DatePreset = "7d" | "28d" | "90d" | "custom";
export type KeywordRangePreset = "7d" | "30d" | "custom";
export type BehaviorRangePreset = "7d" | "30d" | "90d" | "custom";

export type AiInsight = {
  priority: "urgent" | "opportunity" | "trend" | "recommend";
  tag: string;
  text: string;
};

export type IntentType = "informational" | "commercial" | "navigational" | "brand";

export type IntentCategory = {
  label: string;
  type: IntentType;
  percent: number;
  count: number;
  colorClass: string;
};

export type IntentKeyword = {
  query: string;
  intent: IntentType;
  confidence: "high" | "medium" | "low";
};

export type IntentApiResponse = {
  categories: IntentCategory[];
  keywords: IntentKeyword[];
  totalKeywords: number;
  method: "rule" | "hybrid";
  period?: string;
};

export type OptimizationTask = {
  id: string;
  text: string;
  done: boolean;
  detail?: string;
};

export type ColumnData = {
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

export type KeywordData = {
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

export type CwvPageData = {
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

export type BehaviorData = {
  page: string;
  sessions: number;
  users: number;
  avgTime: number;
  bounceRate: number;
  scrollDepth: number;
  conversions: number;
};

export type FunnelStep = {
  label: string;
  value: number;
  percent: number;
};

/* ═══════════════════════════════════════
   API 응답 타입
   ═══════════════════════════════════════ */
export type KpiApiData = {
  current: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  previous: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  delta: { clicks: number; ctr: number; position: number };
  sparklines: { clicks: number[]; ctr: number[]; position: number[] };
};

export type TrendPoint = { date: string; clicks: number; impressions: number };

export type ApiKeywordsResponse = {
  keywords: { query: string; clicks: number; impressions: number; ctr: number; position: number; isQA: boolean; opportunity: boolean }[];
  totalKeywords: number;
  qaKeywords: number;
  opportunityKeywords: number;
};

export type ApiColumnsResponse = {
  columns: { url: string; title: string; clicks: number; impressions: number; ctr: number; position: number; score: number; search: number; tech: number; engage: number; aeo: number }[];
};

export type PageSpeedApiResult = {
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

export type ScoreBreakdown = {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  status: "measured" | "estimated" | "unavailable";
  detail: string;
};

export type AeoGeoApiResult = {
  type: "AEO" | "GEO";
  totalScore: number;
  maxPossible: number;
  normalizedScore: number;
  breakdown: ScoreBreakdown[];
  measuredAt: string;
};

/* ── 페이지 진단 타입 ── */
export type SchemaInfo = {
  types: string[];
  hasFAQ: boolean;
  hasHowTo: boolean;
  hasArticle: boolean;
  hasMedical: boolean;
  hasAuthor: boolean;
  hasSpeakable: boolean;
  rawCount: number;
};

export type ContentStructure = {
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

export type CrawlAnalysisResult = {
  url: string;
  schema: SchemaInfo;
  content: ContentStructure;
  crawledAt: string;
};

export type DiagnosisItem = {
  category: "Schema" | "콘텐츠";
  issue: string;
  priority: "urgent" | "important" | "optional";
  recommendation: string;
};

export type PageSpeedReportResponse = {
  markdown: string;
  updatedAt: string;
};

export type MdBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "hr" }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "p"; lines: string[] };

export type DiagnosisHistoryItem = {
  id: string;
  url: string;
  mode: string;
  aeoScore: number | null;
  geoScore: number | null;
  crawlSummary: {
    schemaTypes: string[];
    wordCount: number;
    h2Count: number;
    h3Count: number;
    hasMetaDescription: boolean;
  } | null;
  createdAt: string;
};
