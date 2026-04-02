/**
 * 페이지 그룹(content_group) 분류 유틸리티
 *
 * GA4 pagePath를 의미 있는 그룹으로 분류하여
 * "어느 덩어리가 돈을 버는가"를 파악할 수 있게 한다.
 */

export type PageGroup =
  | "store_category"
  | "product_detail"
  | "report"
  | "member"
  | "checkout"
  | "seo_article"
  | "ai_landing"
  | "partner_lp"
  | "home"
  | "other";

export type PageGroupMeta = {
  group: PageGroup;
  label: string;
  description: string;
};

export const PAGE_GROUP_META: Record<PageGroup, Omit<PageGroupMeta, "group">> = {
  store_category: { label: "스토어/카테고리", description: "상품 목록 및 카테고리 페이지" },
  product_detail: { label: "상품 상세", description: "개별 상품 상세 페이지" },
  report: { label: "리포트/결과", description: "검사 결과 및 리포트 페이지" },
  member: { label: "회원", description: "로그인/회원가입/마이페이지" },
  checkout: { label: "결제", description: "장바구니/결제/주문완료 페이지" },
  seo_article: { label: "SEO 콘텐츠", description: "블로그/건강정보 콘텐츠 페이지" },
  ai_landing: { label: "AI 랜딩", description: "AI 유입 전용 랜딩 페이지" },
  partner_lp: { label: "제휴/파트너", description: "파트너 전용 랜딩 페이지" },
  home: { label: "홈", description: "메인 홈페이지" },
  other: { label: "기타", description: "분류되지 않은 페이지" },
};

const RULES: Array<{ pattern: RegExp; group: PageGroup }> = [
  // 홈
  { pattern: /^\/?$/, group: "home" },

  // 리포트/결과
  { pattern: /\/(report|reportPC|reportMobile)/i, group: "report" },

  // 결제 흐름
  { pattern: /\/(shop_payment|payment|checkout|cart|order_complete|shop_order)/i, group: "checkout" },

  // 상품 상세
  { pattern: /\/(shop_view|product_view|product_detail|item_view)/i, group: "product_detail" },

  // 스토어/카테고리
  { pattern: /\/(shop|store|HealthFood|supplements|_store|shop_mypage|shop_list|shop_category)/i, group: "store_category" },

  // 회원
  { pattern: /\/(login|signup|register|mypage|member|auth|shop_mypage)/i, group: "member" },

  // SEO 콘텐츠
  { pattern: /\/(blog|article|health|column|guide|info|magazine|news|story)/i, group: "seo_article" },

  // AI 랜딩
  { pattern: /\/(ai-landing|ai_landing|chatgpt|ai-guide)/i, group: "ai_landing" },

  // 파트너 LP
  { pattern: /\/(partner|affiliate|lp|landing|promotion)/i, group: "partner_lp" },
];

export const classifyPageGroup = (pagePath: string): PageGroup => {
  const path = (pagePath || "").split("?")[0] ?? "";
  for (const rule of RULES) {
    if (rule.pattern.test(path)) return rule.group;
  }
  return "other";
};

export type PageGroupAggregation = {
  group: PageGroup;
  label: string;
  totalSessions: number;
  totalUsers: number;
  totalRevenue: number;
  totalPurchases: number;
  avgBounceRate: number;
  pageCount: number;
  topPages: Array<{ path: string; sessions: number }>;
};

export const aggregateByPageGroup = (
  rows: Array<{
    pagePath: string;
    sessions: number;
    users: number;
    bounceRate: number;
    revenue?: number;
    purchases?: number;
  }>,
): PageGroupAggregation[] => {
  const groups = new Map<
    PageGroup,
    {
      sessions: number;
      users: number;
      revenue: number;
      purchases: number;
      bounceRateSum: number;
      count: number;
      topPages: Array<{ path: string; sessions: number }>;
    }
  >();

  for (const row of rows) {
    const group = classifyPageGroup(row.pagePath);
    if (!groups.has(group)) {
      groups.set(group, { sessions: 0, users: 0, revenue: 0, purchases: 0, bounceRateSum: 0, count: 0, topPages: [] });
    }
    const g = groups.get(group)!;
    g.sessions += row.sessions;
    g.users += row.users;
    g.revenue += row.revenue ?? 0;
    g.purchases += row.purchases ?? 0;
    g.bounceRateSum += row.bounceRate * row.sessions; // 가중 평균용
    g.count += 1;
    g.topPages.push({ path: row.pagePath, sessions: row.sessions });
  }

  const result: PageGroupAggregation[] = [];
  for (const [group, data] of groups) {
    data.topPages.sort((a, b) => b.sessions - a.sessions);
    result.push({
      group,
      label: PAGE_GROUP_META[group].label,
      totalSessions: data.sessions,
      totalUsers: data.users,
      totalRevenue: data.revenue,
      totalPurchases: data.purchases,
      avgBounceRate: data.sessions > 0 ? +(data.bounceRateSum / data.sessions).toFixed(1) : 0,
      pageCount: data.count,
      topPages: data.topPages.slice(0, 5),
    });
  }

  result.sort((a, b) => b.totalSessions - a.totalSessions);
  return result;
};
