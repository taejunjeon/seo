/* ═══════════════════════════════════════
   AI 분석 보고서 — API 응답 타입
   ═══════════════════════════════════════ */

/* ── AEO / GEO Score ── */
export type ScoreBreakdownItem = {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  status: string;
  detail?: string;
};

export type AeoGeoScore = {
  type: string;
  totalScore: number;
  maxPossible: number;
  normalizedScore: number;
  breakdown: ScoreBreakdownItem[];
};

/* ── GSC KPI (SEO 점수용) ── */
export type GscKpiPeriod = {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  days: number;
};

export type GscKpiResponse = {
  current: GscKpiPeriod;
  previous: GscKpiPeriod;
  delta: { clicks: number; ctr: number; position: number };
  sparklines: { clicks: number[]; ctr: number[]; position: number[] };
};

/* ── AI vs Organic ── */
export type ChannelMetrics = {
  sessions: number;
  engagementRate: number;
  bounceRate: number;
  conversionRate: number;
  purchaseConversionRate: number;
  pagesPerSession: number;
  averageSessionDuration: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type AiVsOrganicResponse = {
  ai: ChannelMetrics;
  organic: ChannelMetrics;
  period: string;
};

/* ── Trends ── */
export type TrendsPoint = { date: string; value: number };

export type TrendsPeriodSeries = {
  startDate: string;
  endDate: string;
  data: TrendsPoint[];
  total: number;
  average: number;
};

export type TrendsApiResponse = {
  metric: string;
  period: string;
  compare: string;
  current: TrendsPeriodSeries;
  previous: TrendsPeriodSeries;
  change: { absolute: number; percentage: number; direction: "up" | "down" | "flat" };
};

/* ── AI Funnel ── */
export type FunnelStepData = {
  name: string;
  key: string;
  sessions: number;
  conversionRate: number;
};

export type AiFunnelResponse = {
  steps: FunnelStepData[];
  period: string;
  overallConversion: number;
  biggestDropoff?: { from: string; to: string; dropRate: number };
};

/* ── AI Traffic (Journey) ── */
export type AiLandingPage = {
  page: string;
  sessions: number;
  purchases: number;
  revenue: number;
  queries?: string[];
};

export type AiSourceRow = {
  source: string;
  sessions: number;
  engagementRate: number;
};

export type AiTrafficResponse = {
  totals: { sessions: number; purchases?: number; revenue?: number };
  byLandingPage: AiLandingPage[];
  bySource: AiSourceRow[];
};

/* ── 전체 보고서 데이터 상태 ── */
export type SectionStatus = "loading" | "ready" | "error" | "empty";
