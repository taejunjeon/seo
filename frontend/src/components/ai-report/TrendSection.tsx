"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import type { TrendsApiResponse } from "./types";
import styles from "./AiReport.module.css";

type Props = { data: TrendsApiResponse | null };

type ChartRow = { date: string; current: number; previous?: number };

function formatValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export default function TrendSection({ data }: Props) {
  const chartData = useMemo((): ChartRow[] => {
    if (!data) return [];
    return data.current.data.map((pt, i) => ({
      date: pt.date.slice(5), // MM-DD
      current: Math.round(pt.value),
      ...(data.previous.data[i] != null
        ? { previous: Math.round(data.previous.data[i].value) }
        : {}),
    }));
  }, [data]);

  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 7) return 0;
    if (len <= 30) return 6;
    return 13;
  }, [chartData.length]);

  if (!data) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📈</span> 90일 클릭 추이
        </h3>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>📊</div>
          <div className={styles.errorText}>추이 데이터를 불러올 수 없습니다</div>
        </div>
      </section>
    );
  }

  const { change } = data;

  return (
    <section className={styles.section}>
      <div className={styles.trendHeader}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📈</span> 90일 클릭 추이
          {change.direction !== "flat" && (
            <span className={`${styles.changeBadge} ${change.direction === "up" ? styles.changeBadgeUp : styles.changeBadgeDown}`}>
              {change.direction === "up" ? "▲" : "▼"} {Math.abs(change.percentage).toFixed(1)}%
            </span>
          )}
        </h3>
      </div>

      <div className={styles.trendChart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D9488" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
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
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.85rem" }}
            />
            {/* 이전 기간 점선 */}
            <Area
              type="monotone"
              dataKey="previous"
              name="이전 90일"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.5}
              fill="none"
              dot={false}
            />
            {/* 현재 기간 */}
            <Area
              type="monotone"
              dataKey="current"
              name="현재 90일"
              stroke="#0D9488"
              strokeWidth={2.5}
              fill="url(#trendGradCurrent)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
