"use client";

import { Fragment, useMemo, useState } from "react";
import type { AiTrafficByLandingPageRow } from "./types";
import styles from "./AiTraffic.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const won = (n: number) => n > 0 ? `₩${fmt(Math.round(n))}` : "—";

type SortKey = "revenue_per_session" | "sessions" | "purchases" | "revenue";

type Props = {
  rows: AiTrafficByLandingPageRow[];
  onDiagnose?: (url: string) => void;
};

/** 데이터 기반 다음 행동 추천 */
function suggestAction(row: AiTrafficByLandingPageRow): string | null {
  const rps = row.sessions > 0 ? row.grossPurchaseRevenue / row.sessions : 0;
  if (row.landingPagePlusQueryString === "/" || row.landingPagePlusQueryString === "(not set)") {
    return "AI 유입 전용 LP로 리다이렉트 필요";
  }
  if (row.sessions >= 10 && row.ecommercePurchases === 0) {
    return "트래픽 있으나 구매 0 — CTA/상품 연결 점검";
  }
  if (rps > 0 && row.engagementRate < 0.4) {
    return "매출 발생하나 참여율 낮음 — 콘텐츠 개선 여지";
  }
  if (row.bounceRate > 0.7 && row.sessions >= 5) {
    return "이탈률 높음 — 첫 화면 CTA/신뢰 요소 보강";
  }
  return null;
}

export default function AiTrafficByLandingTable({ rows, onDiagnose }: Props) {
  const [expandedLanding, setExpandedLanding] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue_per_session");

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      if (sortKey === "revenue_per_session") {
        const rpsA = a.sessions > 0 ? a.grossPurchaseRevenue / a.sessions : 0;
        const rpsB = b.sessions > 0 ? b.grossPurchaseRevenue / b.sessions : 0;
        return rpsB - rpsA;
      }
      if (sortKey === "revenue") return b.grossPurchaseRevenue - a.grossPurchaseRevenue;
      if (sortKey === "purchases") return b.ecommercePurchases - a.ecommercePurchases;
      return b.sessions - a.sessions;
    });
    return arr;
  }, [rows, sortKey]);

  const sortLabel: Record<SortKey, string> = {
    revenue_per_session: "매출/세션",
    sessions: "세션",
    purchases: "구매",
    revenue: "매출",
  };

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableTitle}>
        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        랜딩페이지별 AI 유입
        <span style={{ marginLeft: 12, fontSize: "0.72rem", color: "#94a3b8" }}>
          정렬:
          {(["revenue_per_session", "revenue", "purchases", "sessions"] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              style={{
                marginLeft: 4,
                padding: "2px 6px",
                border: sortKey === k ? "1px solid #6366f1" : "1px solid #e2e8f0",
                borderRadius: 4,
                background: sortKey === k ? "#eef2ff" : "transparent",
                color: sortKey === k ? "#4338ca" : "#64748b",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
            >
              {sortLabel[k]}
            </button>
          ))}
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>랜딩페이지</th>
            <th>세션</th>
            <th>매출/세션</th>
            <th>매출</th>
            <th>구매</th>
            <th>참여율</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length > 0 ? sorted.map((row) => {
            const rps = row.sessions > 0 ? row.grossPurchaseRevenue / row.sessions : 0;
            const action = suggestAction(row);
            return (
              <Fragment key={row.landingPagePlusQueryString}>
                <tr>
                  <td
                    className={styles.landingCell}
                    title={row.landingPagePlusQueryString}
                    onClick={() => {
                      setExpandedLanding(
                        expandedLanding === row.landingPagePlusQueryString ? null : row.landingPagePlusQueryString,
                      );
                    }}
                  >
                    {row.landingPagePlusQueryString}
                  </td>
                  <td>{fmt(row.sessions)}</td>
                  <td style={{ fontWeight: 600 }}>{won(rps)}</td>
                  <td>{won(row.grossPurchaseRevenue)}</td>
                  <td>{row.ecommercePurchases}</td>
                  <td>{pct(row.engagementRate)}</td>
                  <td>
                    {onDiagnose && (
                      <button
                        type="button"
                        className={styles.diagBtn}
                        onClick={() => {
                          const fullUrl = row.landingPagePlusQueryString.startsWith("http")
                            ? row.landingPagePlusQueryString
                            : `https://biocom.kr${row.landingPagePlusQueryString}`;
                          onDiagnose(fullUrl);
                        }}
                        title="페이지 진단으로 이동"
                      >
                        진단
                      </button>
                    )}
                  </td>
                </tr>
                {expandedLanding === row.landingPagePlusQueryString && (
                  <tr>
                    <td colSpan={7} style={{ fontSize: "0.72rem", color: "#94a3b8", padding: "6px 10px" }}>
                      체류: {Math.round(row.averageSessionDuration / 60)}분 {Math.round(row.averageSessionDuration % 60)}초 · PV: {fmt(row.screenPageViews)} · 이탈률: {pct(row.bounceRate)}
                      {action && <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 600 }}> → {action}</span>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          }) : (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8" }}>랜딩페이지 데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
