"use client";

import styles from "./seo.module.css";
import type { AuditResponse } from "./seo.types";

type Props = {
  audit: AuditResponse | null;
};

const numFmt = new Intl.NumberFormat("ko-KR");

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-success)";
  if (score >= 50) return "var(--color-accent)";
  return "var(--color-danger)";
}

export default function SeoHeader({ audit }: Props) {
  const total = audit?.totalScore ?? 0;
  const generated = audit?.generatedAt ? new Date(audit.generatedAt).toLocaleString("ko-KR") : "-";

  const kpis = [
    { label: "수집 URL", value: audit ? numFmt.format(audit.inventoryTotal) : "-", sub: audit ? `sitemap ${numFmt.format(audit.sitemapCount)}` : "" },
    { label: "parameter URL", value: audit ? `${audit.parameterUrlCount} (${audit.parameterUrlPct.toFixed(1)}%)` : "-", sub: "canonical/sitemap 정책 필요" },
    { label: "JSON-LD 결손", value: audit ? `${audit.pagesWithoutJsonLd}/${audit.pages.length}` : "-", sub: "핵심 6개 페이지" },
    { label: "alt 누락 이미지", value: audit ? numFmt.format(audit.altMissingTotal) : "-", sub: "핵심 6개 페이지 합" },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.headerScore} style={{ borderColor: scoreColor(total) }}>
        <div className={styles.headerScoreLabel}>SEO 감사 점수</div>
        <div className={styles.headerScoreValue} style={{ color: scoreColor(total) }}>
          {total}
          <span className={styles.headerScoreMax}>/100</span>
        </div>
        <div className={styles.headerScoreSub}>{generated} 기준 · 운영 영향 0</div>
      </div>
      <div className={styles.headerKpiGrid}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.headerKpi}>
            <div className={styles.headerKpiLabel}>{k.label}</div>
            <div className={styles.headerKpiValue}>{k.value}</div>
            <div className={styles.headerKpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
