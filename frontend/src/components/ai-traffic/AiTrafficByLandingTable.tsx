"use client";

import { Fragment, useState } from "react";
import type { AiTrafficByLandingPageRow } from "./types";
import styles from "./AiTraffic.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

type Props = {
  rows: AiTrafficByLandingPageRow[];
  onDiagnose?: (url: string) => void;
};

export default function AiTrafficByLandingTable({ rows, onDiagnose }: Props) {
  const [expandedLanding, setExpandedLanding] = useState<string | null>(null);

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableTitle}>
        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        랜딩페이지별 AI 유입
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>랜딩페이지</th>
            <th>세션</th>
            <th>사용자</th>
            <th>참여율</th>
            <th>구매</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
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
                <td>{fmt(row.activeUsers)}</td>
                <td>{pct(row.engagementRate)}</td>
                <td>{row.ecommercePurchases}</td>
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
                      진단 →
                    </button>
                  )}
                </td>
              </tr>
              {expandedLanding === row.landingPagePlusQueryString && (
                <tr>
                  <td colSpan={6} style={{ fontSize: "0.72rem", color: "#94a3b8", padding: "6px 10px" }}>
                    평균 체류: {Math.round(row.averageSessionDuration / 60)}분 {Math.round(row.averageSessionDuration % 60)}초 · PV: {fmt(row.screenPageViews)} · 이탈률: {pct(row.bounceRate)}
                  </td>
                </tr>
              )}
            </Fragment>
          )) : (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>랜딩페이지 데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
