export type FunnelType = "test" | "supplement";

export type FunnelStepConfig = {
  /** UI 표시용 라벨 */
  name: string;
  /** GA4 eventName */
  event: string;
};

export type FunnelFilterRule = {
  /** GA4 dimension field name (예: itemCategory, pagePath 등) */
  fieldName: string;
  /** GA4 stringFilter matchType */
  matchType: "EXACT" | "CONTAINS" | "FULL_REGEXP";
  /** or-group values */
  values: string[];
};

export type FunnelConfigEntry = {
  label: string;
  steps: FunnelStepConfig[];
  /**
   * 검사/영양제 구분 필터.
   * - 환경마다 GA4 ecommerce dimension 구성이 달라질 수 있어, 실제 값에 맞춰 조정 필요.
   */
  filter: FunnelFilterRule;
};

export const FUNNEL_CONFIG: Record<FunnelType, FunnelConfigEntry> = {
  test: {
    label: "검사",
    steps: [
      { name: "상품 조회", event: "view_item" },
      { name: "결제 시작", event: "begin_checkout" },
      { name: "구매 완료", event: "purchase" },
    ],
    filter: {
      // NOTE: 기본값은 보수적으로(0이 나와도 오탐/혼합을 만들지 않게) 설정합니다.
      // 실제 GA4 설정에서 itemCategory 값이 다르면 이 값만 수정하면 됩니다.
      fieldName: "itemCategory",
      matchType: "CONTAINS",
      values: ["검사", "test"],
    },
  },
  supplement: {
    label: "영양제",
    steps: [
      { name: "상품 조회", event: "view_item" },
      { name: "장바구니", event: "add_to_cart" },
      { name: "구매 완료", event: "purchase" },
    ],
    filter: {
      fieldName: "itemCategory",
      matchType: "CONTAINS",
      values: ["영양제", "supplement"],
    },
  },
};

