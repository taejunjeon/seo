"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./TrendChart.module.css";

/* ── 타입 ── */
type TrendPoint = { date: string; clicks: number; impressions: number };
type MetricKey = "clicks" | "impressions" | "ctr" | "position";
type PeriodKey = "7d" | "30d" | "90d";

interface TrendChartProps {
  apiBaseUrl: string;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7일", days: 7 },
  { key: "30d", label: "30일", days: 30 },
  { key: "90d", label: "90일", days: 90 },
];

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "clicks", label: "클릭" },
  { key: "impressions", label: "노출" },
  { key: "ctr", label: "CTR" },
  { key: "position", label: "순위" },
];

const METRIC_COLORS: Record<MetricKey, string> = {
  clicks: "#0D9488",
  impressions: "#64748B",
  ctr: "#2563EB",
  position: "#F59E0B",
};

/* ── 커스텀 툴팁 ── */
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: entry.color }} />
          <span className={styles.tooltipLabel}>{entry.name}</span>
          <span className={styles.tooltipValue}>
            {typeof entry.value === "number" ? entry.value.toLocaleString("ko-KR") : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── TrendChart 컴포넌트 ── */
export default function TrendChart({ apiBaseUrl }: TrendChartProps) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [metric, setMetric] = useState<MetricKey>("clicks");
  const [isLive, setIsLive] = useState(false);

  const fetchTrend = useCallback(async (days: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/gsc/trends?days=${days}`);
      if (!res.ok) throw new Error();
      const d = await res.json() as { trend?: TrendPoint[] };
      if (d.trend && d.trend.length > 0) {
        setData(d.trend);
        setIsLive(true);
      } else {
        setData([]);
        setIsLive(false);
      }
    } catch {
      setData([]);
      setIsLive(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const days = PERIOD_OPTIONS.find((p) => p.key === period)?.days ?? 30;
    void fetchTrend(days);
  }, [period, fetchTrend]);

  /* 차트 데이터 가공 */
  const chartData = useMemo(() => {
    return data.map((d) => ({
      date: d.date ? d.date.slice(5) : "", // MM-DD
      clicks: d.clicks,
      impressions: d.impressions,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      position: 0, // TODO: /api/trends 연동 시 position 데이터 추가
    }));
  }, [data]);

  /* X축 tick 간격 */
  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 7) return 0;
    if (len <= 30) return 6;
    return 13;
  }, [chartData.length]);

  const color = METRIC_COLORS[metric];
  const gradientId = `trendGrad_${metric}`;

  const metricLabel = METRIC_OPTIONS.find((m) => m.key === metric)?.label ?? "클릭";

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {metricLabel} 추이
          {isLive ? (
            <span className={styles.badgeLive}>● LIVE</span>
          ) : error ? (
            <span className={styles.badgeNo}>데이터 없음</span>
          ) : null}
        </h2>
        <div className={styles.controls}>
          <div className={styles.pillGroup}>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.pill} ${period === p.key ? styles.pillActive : ""}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={styles.pillGroup}>
            {METRIC_OPTIONS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`${styles.pill} ${metric === m.key ? styles.pillActive : ""}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.chartWrap}>
        {loading ? (
          <div className={styles.skeleton} />
        ) : chartData.length === 0 ? (
          <div className={styles.empty}>
            <p>추이 데이터가 없습니다</p>
            <button type="button" className={styles.retryBtn} onClick={() => {
              const days = PERIOD_OPTIONS.find((p) => p.key === period)?.days ?? 30;
              void fetchTrend(days);
            }}>
              새로고침
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) =>
                  metric === "ctr" ? `${v}%` : metric === "position" ? String(v) : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                name={metricLabel}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
