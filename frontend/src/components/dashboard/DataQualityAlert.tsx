"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./DataQualityAlert.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7020";

type DataQualityIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  value: number;
};

type DataQualityData = {
  score: number;
  issues: DataQualityIssue[];
  stats: {
    totalPagePaths: number;
    duplicateUrlGroups: number;
    notSetLandingRatio: number;
    queryParamPageRatio: number;
    purchaseCount: number;
    beginCheckoutCount: number;
    totalSessions: number;
    pageViewMissingRatio: number;
  };
};

type Props = {
  startDate?: string;
  endDate?: string;
};

export default function DataQualityAlert({ startDate, endDate }: Props) {
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (startDate) qs.set("startDate", startDate);
      if (endDate) qs.set("endDate", endDate);
      const res = await fetch(`${API_BASE}/api/ga4/data-quality?${qs}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // 데이터 품질 경고는 비필수 — 실패 시 표시 안 함
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className={styles.loading}>데이터 품질 점검 중...</div>;
  if (!data || data.issues.length === 0) return null;

  const scoreClass = data.score >= 80 ? styles.scoreGood : data.score >= 50 ? styles.scoreWarn : styles.scoreBad;
  const iconClass = data.score >= 80 ? styles.iconGood : data.score >= 50 ? styles.iconWarn : styles.iconBad;
  const iconChar = data.score >= 80 ? "OK" : data.score >= 50 ? "!" : "!!";

  const severityClass = (s: string) =>
    s === "error" ? styles.issueError : s === "warning" ? styles.issueWarning : styles.issueInfo;
  const badgeClass = (s: string) =>
    s === "error" ? styles.badgeError : s === "warning" ? styles.badgeWarning : styles.badgeInfo;
  const badgeLabel = (s: string) =>
    s === "error" ? "ERROR" : s === "warning" ? "WARN" : "INFO";

  return (
    <div className={styles.wrapper}>
      <div className={styles.box}>
        <div className={styles.header} onClick={() => setExpanded(!expanded)}>
          <div className={styles.headerLeft}>
            <span className={`${styles.icon} ${iconClass}`}>{iconChar}</span>
            <div>
              <div className={styles.title}>데이터 품질 점검</div>
              <div className={styles.scoreLabel}>
                점수 <span className={`${styles.scoreValue} ${scoreClass}`}>{data.score}/100</span>
                {" · "}
                {data.issues.length}건 이슈
              </div>
            </div>
          </div>
          <button className={styles.toggle}>
            {expanded ? "접기" : "펼치기"}
          </button>
        </div>

        {expanded && (
          <div className={styles.issues}>
            {data.issues.map((issue) => (
              <div key={issue.id} className={`${styles.issue} ${severityClass(issue.severity)}`}>
                <span className={`${styles.issueBadge} ${badgeClass(issue.severity)}`}>
                  {badgeLabel(issue.severity)}
                </span>
                <div className={styles.issueBody}>
                  <div className={styles.issueTitle}>{issue.title}</div>
                  <div className={styles.issueDetail}>{issue.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
