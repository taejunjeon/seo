"use client";

import type { AeoGeoScore, GscKpiResponse } from "./types";
import styles from "./AiReport.module.css";

/* ── 반원 게이지 SVG ── */
function SemiGauge({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(score / max, 1) : 0;
  const r = 52;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * r; // 반원
  const dashOffset = circumference * (1 - pct);

  return (
    <svg width="120" height="68" viewBox="0 0 120 68">
      {/* 배경 호 */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* 값 호 */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

/* ── SEO 점수 계산: CTR(0~15%) → 0~50, 평균순위(1~50) → 0~50 ── */
function calcSeoScore(kpi: GscKpiResponse): { total: number; ctrScore: number; posScore: number } {
  const ctrPct = (kpi.current.ctr ?? 0) * 100; // 0.026 → 2.6
  const ctrScore = Math.round(Math.min(ctrPct / 15, 1) * 50);
  const pos = kpi.current.avgPosition ?? 50;
  const posScore = Math.round(Math.max(0, (50 - pos) / 49) * 50);
  return { total: ctrScore + posScore, ctrScore, posScore };
}

type Props = {
  aeoScore: AeoGeoScore | null;
  geoScore: AeoGeoScore | null;
  gscKpi: GscKpiResponse | null;
};

export default function ScoreHero({ aeoScore, geoScore, gscKpi }: Props) {
  const seo = gscKpi ? calcSeoScore(gscKpi) : null;

  const cards: {
    label: string;
    score: number;
    max: number;
    color: string;
    breakdown: { name: string; value: string }[];
  }[] = [
    {
      label: "AEO",
      score: aeoScore?.normalizedScore ?? aeoScore?.totalScore ?? 0,
      max: 100,
      color: "#2563eb",
      breakdown: aeoScore?.breakdown.map((b) => ({
        name: b.label || b.name,
        value: `${b.score}/${b.maxScore}`,
      })) ?? [],
    },
    {
      label: "SEO",
      score: seo?.total ?? 0,
      max: 100,
      color: "#0d9488",
      breakdown: seo && gscKpi
        ? [
            { name: "CTR 점수", value: `${seo.ctrScore}/50` },
            { name: "순위 점수", value: `${seo.posScore}/50` },
            { name: "평균 CTR", value: `${((gscKpi.current.ctr ?? 0) * 100).toFixed(2)}%` },
            { name: "평균 순위", value: `${(gscKpi.current.avgPosition ?? 0).toFixed(1)}` },
          ]
        : [],
    },
    {
      label: "GEO",
      score: geoScore?.normalizedScore ?? geoScore?.totalScore ?? 0,
      max: 100,
      color: "#7c3aed",
      breakdown: geoScore?.breakdown.map((b) => ({
        name: b.label || b.name,
        value: `${b.score}/${b.maxScore}`,
      })) ?? [],
    },
  ];

  const allEmpty = !aeoScore && !geoScore && !gscKpi;

  if (allEmpty) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🏆</span> AEO / SEO / GEO 점수
        </h3>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>📊</div>
          <div className={styles.errorText}>점수 데이터를 불러올 수 없습니다</div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>🏆</span> AEO / SEO / GEO 점수
      </h3>
      <div className={styles.scoreGrid}>
        {cards.map((c) => (
          <div key={c.label} className={styles.scoreCard}>
            <div className={styles.scoreLabel}>{c.label}</div>
            <div className={styles.gaugeWrap}>
              <SemiGauge score={c.score} max={c.max} color={c.color} />
            </div>
            <div className={styles.scoreValue}>{c.score}</div>
            <div className={styles.scoreMax}>/ {c.max}</div>
            {c.breakdown.length > 0 && (
              <div className={styles.breakdownList}>
                {c.breakdown.map((b) => (
                  <div key={b.name} className={styles.breakdownItem}>
                    <span className={styles.breakdownName}>{b.name}</span>
                    <span className={styles.breakdownScore}>{b.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
