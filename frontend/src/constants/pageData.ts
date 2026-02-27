import type { AiInsight, DatePreset, DiagnosisItem } from "@/types/page";

/* ═══════════════════════════════════════
   page.tsx에서 추출된 상수 및 설정
   ═══════════════════════════════════════ */

/* ── 스타일 매핑 ── */
export const BADGE_CLASS_MAP: Record<AiInsight["priority"], string> = {
  urgent: "insightBadgeUrgent",
  opportunity: "insightBadgeOpportunity",
  trend: "insightBadgeTrend",
  recommend: "insightBadgeRecommend",
};

export const TAG_CLASS_MAP: Record<AiInsight["priority"], string> = {
  urgent: "insightTagUrgent",
  opportunity: "insightTagOpportunity",
  trend: "insightTagTrend",
  recommend: "insightTagRecommend",
};

export const NAV_TABS = ["오버뷰", "칼럼 분석", "키워드 분석", "PageSpeed 보고서", "Core Web Vitals", "사용자 행동", "페이지 진단", "솔루션 소개"];

/* ── 진단 탭: CSS 클래스 매핑 ── */
export const DIAG_PRIORITY_MAP: Record<DiagnosisItem["priority"], { dot: string; label: string; cls: string }> = {
  urgent: { dot: "diagDotUrgent", label: "긴급", cls: "diagPriorityUrgent" },
  important: { dot: "diagDotImportant", label: "중요", cls: "diagPriorityImportant" },
  optional: { dot: "diagDotOptional", label: "선택", cls: "diagPriorityOptional" },
};

/* ── 날짜 프리셋 ── */
export const PRESET_DAYS: Record<Exclude<DatePreset, "custom">, number> = { "7d": 7, "28d": 28, "90d": 90 };
export const PRESET_LABELS: Record<DatePreset, string> = { "7d": "최근 7일", "28d": "최근 28일", "90d": "최근 3개월", custom: "직접 입력" };
export const DEVICE_LABELS: Record<string, string> = { DESKTOP: "데스크톱", MOBILE: "모바일", TABLET: "태블릿" };

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
export const CONTENT_ORIGIN = process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? "https://biocom.kr";
