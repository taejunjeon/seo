"use client";

import styles from "./seo.module.css";

type Variant = "readonly" | "draft" | "needs-approval" | "live-data";

const META: Record<Variant, { label: string; sub: string; tone: string }> = {
  readonly: {
    label: "읽기 전용",
    sub: "사이트 변경 없음",
    tone: "ok",
  },
  draft: {
    label: "제안서 생성",
    sub: "팀 협의 없이 바로 가능",
    tone: "info",
  },
  "needs-approval": {
    label: "운영 반영 필요",
    sub: "아임웹·GTM 작업 전 TJ 승인",
    tone: "warn",
  },
  "live-data": {
    label: "실시간 데이터",
    sub: "구글 검색 콘솔 라이브",
    tone: "live",
  },
};

export default function ImpactBadge({ variant }: { variant: Variant }) {
  const m = META[variant];
  return (
    <span className={styles.impactBadge} data-tone={m.tone}>
      <span className={styles.impactBadgeLabel}>{m.label}</span>
      <span className={styles.impactBadgeSub}>{m.sub}</span>
    </span>
  );
}
