"use client";

import styles from "@/app/page.module.css";

export function ScoreGauge({ score, size = 80, color }: { score: number; size?: number; color: string }) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function cwvStatus(metric: string, value: number): { label: string; cls: string; statusCls: string } {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fcp: [1800, 3000],
    cls: [0.1, 0.25],
    inp: [200, 500],
    ttfb: [800, 1800],
  };
  const [good, poor] = thresholds[metric] ?? [0, 0];
  if (value <= good) return { label: "Good", cls: styles.cwvGood, statusCls: styles.cwvStatusGood };
  if (value <= poor) return { label: "개선 필요", cls: styles.cwvNeedsImprovement, statusCls: styles.cwvStatusWarning };
  return { label: "Poor", cls: styles.cwvPoor, statusCls: styles.cwvStatusPoor };
}

export function WipBadge() {
  return <span className={styles.wipBadge}>🔧 구현중</span>;
}

export function NoDataBadge() {
  return <span className={styles.noDataBadge}>📭 데이터 없음</span>;
}

export function LoadingBadge({ label = "데이터 수집 중", progress }: { label?: string; progress?: number | null }) {
  const hasProgress = typeof progress === "number" && Number.isFinite(progress);
  const pct = hasProgress ? Math.max(0, Math.min(100, progress!)) : null;
  return (
    <span className={styles.loadingBadge} title={label}>
      <span className={styles.loadingBadgeText}>⏳ {label}</span>
      <span className={styles.loadingBarTrack} aria-hidden="true">
        <span
          className={styles.loadingBarFill}
          data-indeterminate={pct === null ? "1" : "0"}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className={styles.liveBadge}>
      <span className={styles.liveDot} />
      실시간
    </span>
  );
}

export function ConfigBadge() {
  return <span className={styles.configBadge}>⚙️ 설정 필요</span>;
}
