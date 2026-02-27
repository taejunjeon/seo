/* ═══════════════════════════════════════
   AI Traffic 타입 정의
   실제 백엔드 /api/ga4/ai-traffic 응답 기반
   ═══════════════════════════════════════ */

/** AI 소스 카테고리 */
export type AiSourceCategory = "ai_referral" | "search_legacy" | "organic";

/** 공통 메트릭 (totals / bySource / byLandingPage 공용) */
export type AiTrafficMetrics = {
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  bounceRate: number;            // 0–1 fraction
  engagementRate: number;        // 0–1 fraction
  averageSessionDuration: number; // 초
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

/** totals (공통 메트릭과 동일) */
export type AiTrafficTotals = AiTrafficMetrics;

/** bySource 행 */
export type AiTrafficBySourceRow = AiTrafficMetrics & {
  sessionSource: string;
  sessionSourceMedium: string;
  category: AiSourceCategory;
};

/** byLandingPage 행 */
export type AiTrafficByLandingPageRow = AiTrafficMetrics & {
  landingPagePlusQueryString: string;
};

/** API _meta 공통 */
export type AiTrafficMeta = {
  type: "live" | "empty";
  propertyId?: string;
  queriedAt: string;
  period: { startDate: string; endDate: string };
  notice?: string;
};

/** API 전체 응답 (/api/ga4/ai-traffic) */
export type AiTrafficReport = {
  _meta: AiTrafficMeta;
  range: { startDate: string; endDate: string };
  definition: string;
  identification?: { method: string };
  totals: AiTrafficTotals;
  bySource: AiTrafficBySourceRow[];
  byLandingPage: AiTrafficByLandingPageRow[];
  debug: { matchedPatterns: string[]; notes: string[] };
};

/** user-type 요약 행 메트릭 */
export type AiTrafficUserTypeSummaryRow = {
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  bounceRate: number;
  engagementRate: number;
  averageSessionDuration: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

/** user-type bySourceAndType 행 */
export type AiTrafficUserTypeBySource = AiTrafficUserTypeSummaryRow & {
  source: string;
  userType: "new" | "returning";
  category: AiSourceCategory;
};

/** /api/ga4/ai-traffic/user-type 응답 */
export type AiTrafficUserTypeReport = {
  _meta: AiTrafficMeta;
  period: { startDate: string; endDate: string };
  identification?: { method: string };
  summary: {
    new: AiTrafficUserTypeSummaryRow;
    returning: AiTrafficUserTypeSummaryRow;
  };
  bySourceAndType: AiTrafficUserTypeBySource[];
};

/** 기간 프리셋 */
export type AiTrafficRangePreset = "7d" | "30d" | "90d" | "custom";
