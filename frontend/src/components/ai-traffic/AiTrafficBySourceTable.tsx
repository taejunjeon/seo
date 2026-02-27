"use client";

import { useState } from "react";
import type { AiTrafficBySourceRow } from "./types";
import styles from "./AiTraffic.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** AI 소스별 브랜드 색상 매핑 */
const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  chatgpt:    { bg: "rgba(16, 163, 127, 0.12)", text: "#10A37F", label: "ChatGPT" },
  openai:     { bg: "rgba(16, 163, 127, 0.12)", text: "#10A37F", label: "OpenAI" },
  perplexity: { bg: "rgba(90, 103, 216, 0.12)", text: "#5A67D8", label: "Perplexity" },
  gemini:     { bg: "rgba(66, 133, 244, 0.12)", text: "#4285F4", label: "Gemini" },
  google:     { bg: "rgba(66, 133, 244, 0.12)", text: "#4285F4", label: "Google" },
  claude:     { bg: "rgba(217, 119, 6, 0.12)",  text: "#D97706", label: "Claude" },
  anthropic:  { bg: "rgba(217, 119, 6, 0.12)",  text: "#D97706", label: "Anthropic" },
  copilot:    { bg: "rgba(14, 165, 233, 0.12)", text: "#0EA5E9", label: "Copilot" },
  bing:       { bg: "rgba(14, 165, 233, 0.12)", text: "#0EA5E9", label: "Bing" },
};

function getSourceStyle(sourceMedium: string) {
  const lower = sourceMedium.toLowerCase();
  for (const [key, val] of Object.entries(SOURCE_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

type Props = {
  rows: AiTrafficBySourceRow[];
};

export default function AiTrafficBySourceTable({ rows }: Props) {
  const [aiOnly, setAiOnly] = useState(false);
  const filtered = aiOnly ? rows.filter((r) => r.category === "ai_referral") : rows;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableTitle}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        소스별 AI 유입
        <button
          type="button"
          className={`${styles.filterToggle} ${aiOnly ? styles.filterToggleActive : ""}`}
          onClick={() => setAiOnly((v) => !v)}
        >
          {aiOnly ? "AI 유입만" : "전체"}
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>소스</th>
            <th>세션</th>
            <th>사용자</th>
            <th>참여율</th>
            <th>구매</th>
            <th>매출</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? filtered.map((row) => {
            const srcStyle = row.category === "ai_referral" ? getSourceStyle(row.sessionSourceMedium) : null;
            return (
              <tr key={row.sessionSourceMedium}>
                <td className={styles.sourceCell} title={row.sessionSourceMedium}>
                  {row.sessionSourceMedium}
                  {row.category === "ai_referral" ? (
                    <span
                      className={styles.categoryBadge}
                      style={srcStyle ? { background: srcStyle.bg, color: srcStyle.text } : undefined}
                    >
                      {srcStyle?.label ?? "AI"}
                    </span>
                  ) : (
                    <span className={`${styles.categoryBadge} ${styles.categoryOther}`}>
                      {row.category === "search_legacy" ? "검색" : "기타"}
                    </span>
                  )}
                </td>
                <td>{fmt(row.sessions)}</td>
                <td>{fmt(row.activeUsers)}</td>
                <td>{pct(row.engagementRate)}</td>
                <td>{row.ecommercePurchases}</td>
                <td>{row.grossPurchaseRevenue ? `₩${fmt(Math.round(row.grossPurchaseRevenue))}` : "-"}</td>
              </tr>
            );
          }) : (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>소스 데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
