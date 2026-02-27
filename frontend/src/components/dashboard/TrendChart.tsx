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
type MetricKey = "clicks" | "impressions" | "ctr" | "position";
type PeriodKey = "7d" | "30d" | "90d";

type TrendsPoint = { date: string; value: number };
type TrendsPeriodSeries = {
  startDate: string;
  endDate: string;
  data: TrendsPoint[];
  total: number;
  average: number;
};
type TrendsApiResponse = {
  metric: MetricKey;
  period: PeriodKey;
  compare: string;
  current: TrendsPeriodSeries;
  previous: TrendsPeriodSeries;
  change: { absolute: number; percentage: number; direction: "up" | "down" | "flat" };
};

type ChartRow = { date: string; current: number; previous?: number };

interface TrendChartProps {
  apiBaseUrl: string;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "90d", label: "90일" },
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

/* ── 값 포맷 함수 ── */
function formatChartValue(v: number, m: MetricKey): number {
  if (m === "ctr") return Math.round(v * 10000) / 100; // 0.0234 → 2.34
  if (m === "position") return Math.round(v * 10) / 10;
  return Math.round(v);
}

function formatDisplayValue(v: number, m: MetricKey): string {
  if (m === "ctr") return `${(v * 100).toFixed(2)}%`;
  if (m === "position") return v.toFixed(1);
  return v.toLocaleString("ko-KR");
}

/* ── 커스텀 툴팁 ── */
function CustomTooltip({ active, payload, label, metric }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string; dataKey: string }[];
  label?: string;
  metric?: MetricKey;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const m = metric ?? "clicks";
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: entry.color }} />
          <span className={styles.tooltipLabel}>{entry.name}</span>
          <span className={styles.tooltipValue}>
            {m === "ctr" ? `${entry.value.toFixed(2)}%` : entry.value.toLocaleString("ko-KR")}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ── TrendChart 컴포넌트 ── */
export default function TrendChart({ apiBaseUrl }: TrendChartProps) {
  const [trendsData, setTrendsData] = useState<TrendsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [metric, setMetric] = useState<MetricKey>("clicks");
  const [compareOn, setCompareOn] = useState(false);

  const fetchTrend = useCallback(async (m: MetricKey, p: PeriodKey) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/trends?metric=${m}&period=${p}&compare=previous`);
      if (!res.ok) throw new Error();
      const d = await res.json() as TrendsApiResponse;
      if (d.current?.data?.length > 0) {
        setTrendsData(d);
      } else {
        setTrendsData(null);
      }
    } catch {
      setTrendsData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void fetchTrend(metric, period);
  }, [metric, period, fetchTrend]);

  /* 차트 데이터 가공 */
  const chartData = useMemo((): ChartRow[] => {
    if (!trendsData) return [];
    const currentData = trendsData.current.data;
    const previousData = trendsData.previous.data;
    return currentData.map((pt, i) => ({
      date: pt.date.slice(5), // MM-DD
      current: formatChartValue(pt.value, metric),
      ...(compareOn && previousData[i] != null
        ? { previous: formatChartValue(previousData[i].value, metric) }
        : {}),
    }));
  }, [trendsData, compareOn, metric]);

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
  const isLive = trendsData !== null;
  const change = trendsData?.change;
  const isSumMetric = metric === "clicks" || metric === "impressions";

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
          {isLive && change && change.direction !== "flat" && (
            <span className={`${styles.changeBadge} ${change.direction === "up" ? styles.changeBadgeUp : styles.changeBadgeDown}`}>
              {change.direction === "up" ? "▲" : "▼"} {Math.abs(change.percentage)}%
            </span>
          )}
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
          <button
            type="button"
            className={`${styles.pill} ${compareOn ? styles.pillActive : ""}`}
            onClick={() => setCompareOn((v) => !v)}
            title="이전 기간과 비교"
          >
            비교
          </button>
        </div>
      </div>

      {/* 비교 요약 */}
      {compareOn && trendsData && (
        <div className={styles.compareSummary}>
          <div className={styles.compareSummaryItem}>
            <span className={styles.compareSummaryLabel}>현재</span>
            <span className={styles.compareSummaryDate}>
              {trendsData.current.startDate.slice(5)} ~ {trendsData.current.endDate.slice(5)}
            </span>
            <span className={styles.compareSummaryValue}>
              {isSumMetric ? "합계" : "평균"}{" "}
              {formatDisplayValue(isSumMetric ? trendsData.current.total : trendsData.current.average, metric)}
            </span>
          </div>
          <div className={`${styles.compareSummaryItem} ${styles.compareSummaryPrev}`}>
            <span className={styles.compareSummaryLabel}>이전</span>
            <span className={styles.compareSummaryDate}>
              {trendsData.previous.startDate.slice(5)} ~ {trendsData.previous.endDate.slice(5)}
            </span>
            <span className={styles.compareSummaryValue}>
              {isSumMetric ? "합계" : "평균"}{" "}
              {formatDisplayValue(isSumMetric ? trendsData.previous.total : trendsData.previous.average, metric)}
            </span>
          </div>
        </div>
      )}

      <div className={styles.chartWrap}>
        {loading ? (
          <div className={styles.skeleton} />
        ) : chartData.length === 0 ? (
          <div className={styles.empty}>
            <p>추이 데이터가 없습니다</p>
            <button type="button" className={styles.retryBtn} onClick={() => void fetchTrend(metric, period)}>
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
              <Tooltip content={<CustomTooltip metric={metric} />} />
              {compareOn && (
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="이전 기간"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  strokeOpacity={0.45}
                  fill="none"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 1, stroke: color, fill: "#fff" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="current"
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
