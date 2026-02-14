"use client";

import styles from "./KpiCard.module.css";

/* ── 인라인 Sparkline (의존성 없음) ── */
function Sparkline({ data, color, width = 60, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data
    .map((v, i) => `${pad + (i / (data.length - 1)) * (width - pad * 2)},${pad + (1 - (v - min) / range) * (height - pad * 2)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── 변화량 화살표 아이콘 ── */
function TrendIcon({ status }: { status: "up" | "down" | "neutral" }) {
  if (status === "up") {
    return (
      <svg className={`${styles.changeIcon} ${styles.changeUp}`} viewBox="0 0 16 16" fill="none">
        <path d="M3 11l5-6 5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "down") {
    return (
      <svg className={`${styles.changeIcon} ${styles.changeDown}`} viewBox="0 0 16 16" fill="none">
        <path d="M3 5l5 6 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={`${styles.changeIcon} ${styles.changeNeutral}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── KpiCard 컴포넌트 ── */
export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  change: number;
  changeUnit: string;
  changeLabel: string;
  status: "up" | "down" | "neutral";
  sparklineData?: number[];
  sparklineColor?: string;
  /** CWV 전용 */
  isCwv?: boolean;
  cwvScore?: number;
}

export default function KpiCard({
  label,
  value,
  unit,
  change,
  changeUnit,
  changeLabel,
  status,
  sparklineData,
  sparklineColor,
  isCwv,
  cwvScore,
}: KpiCardProps) {
  /* CWV 점수별 색상 클래스 */
  const cwvValueCls = isCwv && cwvScore != null
    ? cwvScore >= 90 ? styles.valueGood : cwvScore >= 50 ? styles.valueWarn : styles.valuePoor
    : "";
  const cwvBarCls = isCwv && cwvScore != null
    ? cwvScore >= 90 ? styles.cwvBarGood : cwvScore >= 50 ? styles.cwvBarWarn : styles.cwvBarPoor
    : "";

  const statusCls = status === "up" ? styles.changeUp : status === "down" ? styles.changeDown : styles.changeNeutral;

  const sparkColor = sparklineColor ?? (status === "up" ? "#10B981" : status === "down" ? "#EF4444" : "#94a3b8");

  return (
    <article className={styles.card}>
      {/* 상단 */}
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.dot} />
      </div>

      {/* 핵심 숫자 */}
      <div className={styles.valueRow}>
        <span className={`${styles.value} ${cwvValueCls}`}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>

      {/* CWV 인라인 바 */}
      {isCwv && cwvScore != null && (
        <div className={styles.cwvBar}>
          <div className={`${styles.cwvBarFill} ${cwvBarCls}`} style={{ width: `${cwvScore}%` }} />
        </div>
      )}

      {/* 하단: 변화량 + 스파크라인 */}
      <div className={styles.bottom}>
        <div className={styles.changeWrap}>
          <TrendIcon status={status} />
          <span className={`${styles.changeValue} ${statusCls}`}>
            {change > 0 ? "+" : ""}{change}{changeUnit}
          </span>
          <span className={styles.changeSub}>{changeLabel}</span>
        </div>
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline data={sparklineData} color={sparkColor} />
        )}
      </div>
    </article>
  );
}
