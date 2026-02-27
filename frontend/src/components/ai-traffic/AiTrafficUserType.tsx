"use client";

import type { AiTrafficTotals, AiTrafficUserTypeSummaryRow } from "./types";
import styles from "./AiTraffic.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");

type Props = {
  totals: AiTrafficTotals;
  /** /api/ga4/ai-traffic/user-type 의 summary (있으면 우선 사용) */
  userTypeSummary?: { new: AiTrafficUserTypeSummaryRow; returning: AiTrafficUserTypeSummaryRow } | null;
};

export default function AiTrafficUserType({ totals, userTypeSummary }: Props) {
  /* user-type API 데이터가 있으면 우선 사용, 없으면 totals에서 추정 */
  const newUsers = userTypeSummary
    ? userTypeSummary.new.activeUsers
    : totals.newUsers;
  const returningUsers = userTypeSummary
    ? userTypeSummary.returning.activeUsers
    : Math.max(0, totals.totalUsers - totals.newUsers);

  const total = newUsers + returningUsers;
  const newPct = total > 0 ? (newUsers / total) * 100 : 0;
  const retPct = total > 0 ? (returningUsers / total) * 100 : 0;

  /* 미분류 감지: summary.new + summary.returning < totals */
  const totalFromType = userTypeSummary
    ? userTypeSummary.new.sessions + userTypeSummary.returning.sessions
    : null;
  const hasUnclassified = totalFromType !== null && totalFromType < totals.sessions;

  return (
    <div className={styles.userTypeCard}>
      <div className={styles.userTypeTitle}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none"><circle cx="8" cy="5" r="3" stroke="#6366f1" strokeWidth="1.4" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round" /></svg>
        신규 vs 재방문 사용자
      </div>
      <div className={styles.userTypeGrid}>
        <div className={`${styles.userTypeItem} ${styles.userTypeNew}`}>
          <div className={`${styles.userTypeValue} ${styles.userTypeNewValue}`}>{fmt(newUsers)}</div>
          <div className={styles.userTypeLabel}>신규 사용자 ({newPct.toFixed(0)}%)</div>
        </div>
        <div className={`${styles.userTypeItem} ${styles.userTypeReturning}`}>
          <div className={`${styles.userTypeValue} ${styles.userTypeReturningValue}`}>{fmt(returningUsers)}</div>
          <div className={styles.userTypeLabel}>재방문 사용자 ({retPct.toFixed(0)}%)</div>
        </div>
      </div>
      {total > 0 && (
        <div className={styles.userTypeBar}>
          <div className={styles.userTypeBarNew} style={{ width: `${newPct}%` }} />
          <div className={styles.userTypeBarReturning} style={{ width: `${retPct}%` }} />
        </div>
      )}
      {hasUnclassified && (
        <div className={styles.userTypeNotice}>
          일부 미분류 데이터 있음 (전체 세션 {fmt(totals.sessions)} 중 분류된 세션 {fmt(totalFromType!)})
        </div>
      )}
    </div>
  );
}
