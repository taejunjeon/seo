"use client";

import { useCallback, useMemo, useState } from "react";
import styles from "./OptimizationChecklist.module.css";

/* ── 타입 ── */
export interface OptimizationTask {
  id: string;
  text: string;
  done: boolean;
  detail?: string;
  priority?: "P0" | "P1" | "P2";
}

interface OptimizationChecklistProps {
  tasks: OptimizationTask[];
}

/* ── 우선순위 매핑 ── */
const PRIORITY_MAP: Record<string, "P0" | "P1" | "P2"> = {
  schema_faq: "P0",
  schema_article: "P0",
  schema_author: "P0",
  schema_speakable: "P2",
  meta_description: "P0",
  opportunity_keywords: "P1",
  pagespeed_history: "P1",
  cwv_lcp_fcp: "P1",
  ai_insights: "P2",
};

type FilterKey = "all" | "P0" | "P1" | "P2";

const STORAGE_KEY = "seo_checklist_done";

/* ── 컴포넌트 ── */
export default function OptimizationChecklist({ tasks }: OptimizationChecklistProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localDone, setLocalDone] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  /* localStorage에 done 상태 저장 */
  const saveDone = useCallback((updated: Record<string, boolean>) => {
    setLocalDone(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }, []);

  /* 우선순위 부여된 태스크 */
  const enrichedTasks = useMemo(() =>
    tasks.map((t) => ({
      ...t,
      priority: t.priority ?? PRIORITY_MAP[t.id] ?? "P2",
      done: localDone[t.id] ?? t.done,
    })),
    [tasks, localDone],
  );

  /* 필터링 */
  const filtered = useMemo(() =>
    filter === "all" ? enrichedTasks : enrichedTasks.filter((t) => t.priority === filter),
    [enrichedTasks, filter],
  );

  /* 통계 */
  const total = enrichedTasks.length;
  const doneTotal = enrichedTasks.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((doneTotal / total) * 100) : 0;

  const pCounts = useMemo(() => {
    const counts = { P0: { total: 0, done: 0 }, P1: { total: 0, done: 0 }, P2: { total: 0, done: 0 } };
    enrichedTasks.forEach((t) => {
      const p = t.priority as keyof typeof counts;
      if (counts[p]) {
        counts[p].total += 1;
        if (t.done) counts[p].done += 1;
      }
    });
    return counts;
  }, [enrichedTasks]);

  /* 토글 */
  const toggleDone = (id: string) => {
    const updated = { ...localDone, [id]: !( localDone[id] ?? tasks.find((t) => t.id === id)?.done ?? false) };
    saveDone(updated);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <h3 className={styles.title}>✅ AEO 최적화 체크리스트</h3>
        <span className={styles.count}>{doneTotal}/{total} 완료</span>
      </div>

      {/* 진행률 바 */}
      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>

      {/* 우선순위별 요약 */}
      <div className={styles.prioritySummary}>
        {(["P0", "P1", "P2"] as const).map((p) => (
          <span key={p} className={`${styles.priorityStat} ${styles[`stat${p}`]}`}>
            {p}: {pCounts[p].done}/{pCounts[p].total}
          </span>
        ))}
      </div>

      {/* 필터 Pill */}
      <div className={styles.filterRow}>
        {(["all", "P0", "P1", "P2"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.filterPill} ${filter === f ? styles.filterPillActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "전체" : f}
          </button>
        ))}
      </div>

      {/* 체크리스트 */}
      <ul className={styles.list}>
        {filtered.map((task) => (
          <li key={task.id} className={`${styles.item} ${task.done ? styles.itemDone : ""}`}>
            <div className={styles.itemRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={task.done}
                  onChange={() => toggleDone(task.id)}
                />
                <span className={styles.itemText}>{task.text}</span>
              </label>
              <span className={`${styles.badge} ${styles[`badge${task.priority}`]}`}>{task.priority}</span>
              {task.detail && (
                <button
                  type="button"
                  className={`${styles.chevron} ${expandedIds.has(task.id) ? styles.chevronOpen : ""}`}
                  onClick={() => toggleExpand(task.id)}
                  aria-label="상세 보기"
                >
                  ›
                </button>
              )}
            </div>
            {task.detail && expandedIds.has(task.id) && (
              <div className={styles.detail}>{task.detail}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
