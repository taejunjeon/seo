"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import styles from "./IntentChart.module.css";

/* ── 타입 ── */
type IntentType = "informational" | "commercial" | "navigational" | "brand";

type IntentCategory = {
  label: string;
  type: IntentType;
  percent: number;
  count: number;
  colorClass: string;
  topKeywords?: { query: string; clicks: number; position: number }[];
};

type IntentApiResponse = {
  categories: IntentCategory[];
  keywords: { query: string; intent: IntentType; confidence: "high" | "medium" | "low" }[];
  totalKeywords: number;
  method: "rule" | "hybrid";
  period?: string;
};

type WeightKey = "clicks" | "impressions" | "count";

interface IntentChartProps {
  apiBaseUrl: string;
}

const INTENT_COLORS: Record<IntentType, string> = {
  informational: "#3B82F6",
  commercial: "#F59E0B",
  navigational: "#10B981",
  brand: "#8B5CF6",
};

const INTENT_LABELS: Record<IntentType, string> = {
  informational: "정보형",
  commercial: "상업형",
  navigational: "탐색형",
  brand: "브랜드",
};

const WEIGHT_OPTIONS: { key: WeightKey; label: string }[] = [
  { key: "clicks", label: "클릭 가중" },
  { key: "impressions", label: "노출 가중" },
  { key: "count", label: "개수 기준" },
];

/* ── 커스텀 툴팁 ── */
function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: IntentCategory & { name: string; value: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{d.label}</p>
      <p className={styles.tooltipRow}>비율: {d.percent}%</p>
      <p className={styles.tooltipRow}>키워드 수: {d.count}개</p>
    </div>
  );
}

/* ── IntentChart 컴포넌트 ── */
export default function IntentChart({ apiBaseUrl }: IntentChartProps) {
  const [data, setData] = useState<IntentApiResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [weight, setWeight] = useState<WeightKey>("clicks");
  const [expandedType, setExpandedType] = useState<IntentType | null>(null);

  const fetchIntent = useCallback(async (w: WeightKey) => {
    setState("loading");
    try {
      const res = await fetch(`${apiBaseUrl}/api/keywords/intent?weight=${w}`);
      if (!res.ok) throw new Error();
      const d = await res.json() as IntentApiResponse;
      if (d.categories && d.categories.length > 0) {
        setData(d);
        setState("ready");
      } else {
        setState("empty");
      }
    } catch {
      setState("error");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void fetchIntent(weight);
  }, [weight, fetchIntent]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.categories.map((c) => ({
      ...c,
      name: c.label,
      value: c.percent,
      fill: INTENT_COLORS[c.type] ?? "#9CA3AF",
    }));
  }, [data]);

  const totalKeywords = data?.totalKeywords ?? 0;

  /* 카테고리별 Top 키워드 (accordion용) */
  const topKeywordsByType = useMemo(() => {
    if (!data) return {};
    const map: Record<string, { query: string; clicks: number; position: number }[]> = {};
    data.categories.forEach((c) => {
      if (c.topKeywords) {
        map[c.type] = c.topKeywords.slice(0, 5);
      }
    });
    /* topKeywords가 없으면 keywords 목록에서 추출 */
    if (Object.keys(map).length === 0 && data.keywords) {
      const grouped: Record<string, { query: string; clicks: number; position: number }[]> = {};
      data.keywords.forEach((k) => {
        if (!grouped[k.intent]) grouped[k.intent] = [];
        grouped[k.intent].push({ query: k.query, clicks: 0, position: 0 });
      });
      Object.keys(grouped).forEach((t) => {
        map[t] = grouped[t].slice(0, 5);
      });
    }
    return map;
  }, [data]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          키워드 인텐트 분석
          {state === "ready" && <span className={styles.badgeLive}>● LIVE</span>}
          {state === "loading" && <span className={styles.badgeLoading}>분석 중</span>}
        </h3>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void fetchIntent(weight)}
          aria-label="새로고침"
        >
          🔄
        </button>
      </div>

      {/* 가중치 토글 */}
      <div className={styles.weightRow}>
        {WEIGHT_OPTIONS.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`${styles.weightPill} ${weight === w.key ? styles.weightPillActive : ""}`}
            onClick={() => setWeight(w.key)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {state === "loading" ? (
        <div className={styles.skeletonWrap}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : state === "error" || state === "empty" ? (
        <div className={styles.empty}>
          <p>⚠️ 키워드 인텐트 데이터를 불러올 수 없습니다</p>
          <button type="button" className={styles.retryBtn} onClick={() => void fetchIntent(weight)}>새로고침</button>
        </div>
      ) : (
        <div className={styles.content}>
          {/* 도넛 차트 */}
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.centerText}>
              <span className={styles.centerNumber}>{totalKeywords}</span>
              <span className={styles.centerLabel}>키워드</span>
            </div>
          </div>

          {/* 카테고리 목록 */}
          <div className={styles.categoryList}>
            {(data?.categories ?? []).map((cat) => {
              const color = INTENT_COLORS[cat.type] ?? "#9CA3AF";
              const isExpanded = expandedType === cat.type;
              const topKws = topKeywordsByType[cat.type] ?? [];
              return (
                <div key={cat.type} className={styles.categoryItem}>
                  <button
                    type="button"
                    className={styles.categoryRow}
                    onClick={() => setExpandedType(isExpanded ? null : cat.type)}
                  >
                    <span className={styles.categoryDot} style={{ background: color }} />
                    <span className={styles.categoryLabel}>{INTENT_LABELS[cat.type] ?? cat.label}</span>
                    <span className={styles.categoryPct}>{cat.percent}%</span>
                    <span className={styles.categoryCount}>({cat.count})</span>
                    {topKws.length > 0 && (
                      <span className={`${styles.categoryChevron} ${isExpanded ? styles.categoryChevronOpen : ""}`}>›</span>
                    )}
                  </button>
                  {isExpanded && topKws.length > 0 && (
                    <div className={styles.kwAccordion}>
                      {topKws.map((kw, i) => (
                        <div key={i} className={styles.kwRow}>
                          <span className={styles.kwQuery}>{kw.query}</span>
                          {kw.clicks > 0 && <span className={styles.kwStat}>{kw.clicks}클릭</span>}
                          {kw.position > 0 && <span className={styles.kwStat}>{kw.position.toFixed(1)}위</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 메타 */}
          {data?.method && (
            <div className={styles.meta}>
              분석 방법: {data.method === "hybrid" ? "AI + 규칙" : "규칙 기반"} ·
              {data.period && ` 기간: ${data.period}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
