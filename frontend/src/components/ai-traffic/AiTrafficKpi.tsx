"use client";

import type { AiTrafficTotals } from "./types";
import styles from "./AiTraffic.module.css";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const dur = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)}초`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}분 ${s}초`;
};

type Props = {
  totals: AiTrafficTotals;
};

export default function AiTrafficKpi({ totals }: Props) {
  return (
    <div className={styles.kpiGrid}>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>{fmt(totals.sessions)}</div>
        <div className={styles.kpiLabel}>세션</div>
        <div className={styles.kpiSub}>참여 {fmt(totals.engagedSessions)}</div>
      </div>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>{fmt(totals.activeUsers)}</div>
        <div className={styles.kpiLabel}>활성 사용자</div>
        <div className={styles.kpiSub}>신규 {fmt(totals.newUsers)}</div>
      </div>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>{pct(totals.engagementRate)}</div>
        <div className={styles.kpiLabel}>참여율</div>
        <div className={styles.kpiSub}>이탈 {pct(totals.bounceRate)}</div>
      </div>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>{dur(totals.averageSessionDuration)}</div>
        <div className={styles.kpiLabel}>평균 체류</div>
        <div className={styles.kpiSub}>PV {fmt(totals.screenPageViews)}</div>
      </div>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>{fmt(totals.ecommercePurchases)}</div>
        <div className={styles.kpiLabel}>구매</div>
      </div>
      <div className={styles.kpiItem}>
        <div className={styles.kpiValue}>
          {totals.grossPurchaseRevenue
            ? `₩${fmt(Math.round(totals.grossPurchaseRevenue))}`
            : "₩0"}
        </div>
        <div className={styles.kpiLabel}>매출</div>
      </div>
    </div>
  );
}
