"use client";

import styles from "./AiReport.module.css";

/* ── API 응답에 맞는 로컬 타입 ── */
type LandingPageRow = {
  landingPagePlusQueryString: string;
  sessions: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  engagementRate: number;
};

type SourceRow = {
  sessionSource: string;
  sessions: number;
  engagementRate: number;
};

type AiTrafficData = {
  totals: { sessions: number; ecommercePurchases?: number; grossPurchaseRevenue?: number };
  byLandingPage: LandingPageRow[];
  bySource: SourceRow[];
};

type Props = { data: AiTrafficData | null };

export default function JourneySection({ data }: Props) {
  if (!data || data.byLandingPage.length === 0) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🗺️</span> 사용자 여정 인사이트
        </h3>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>📊</div>
          <div className={styles.errorText}>여정 데이터를 불러올 수 없습니다</div>
        </div>
      </section>
    );
  }

  const topPages = data.byLandingPage.slice(0, 10);

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>🗺️</span> 사용자 여정 인사이트
      </h3>

      <table className={styles.journeyTable}>
        <thead>
          <tr>
            <th>랜딩페이지</th>
            <th className={styles.numberCell}>세션</th>
            <th className={styles.numberCell}>구매</th>
            <th className={styles.numberCell}>매출</th>
            <th className={styles.numberCell}>참여율</th>
          </tr>
        </thead>
        <tbody>
          {topPages.map((page, idx) => (
            <tr key={`${page.landingPagePlusQueryString}-${idx}`}>
              <td>
                <span className={styles.pagePath} title={page.landingPagePlusQueryString}>
                  {page.landingPagePlusQueryString}
                </span>
              </td>
              <td className={styles.numberCell}>{page.sessions.toLocaleString("ko-KR")}</td>
              <td className={styles.numberCell}>{(page.ecommercePurchases ?? 0).toLocaleString("ko-KR")}</td>
              <td className={styles.numberCell}>
                {(page.grossPurchaseRevenue ?? 0) > 0
                  ? `₩${Math.round(page.grossPurchaseRevenue).toLocaleString("ko-KR")}`
                  : "-"}
              </td>
              <td className={styles.numberCell}>
                {((page.engagementRate ?? 0) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 소스별 요약 */}
      {data.bySource.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 className={styles.sectionTitle} style={{ fontSize: "0.95rem" }}>
            AI 소스별 유입
          </h4>
          <table className={styles.journeyTable}>
            <thead>
              <tr>
                <th>소스</th>
                <th className={styles.numberCell}>세션</th>
                <th className={styles.numberCell}>참여율</th>
              </tr>
            </thead>
            <tbody>
              {data.bySource.slice(0, 5).map((src, idx) => (
                <tr key={`src-${src.sessionSource}-${idx}`}>
                  <td>{src.sessionSource}</td>
                  <td className={styles.numberCell}>{src.sessions.toLocaleString("ko-KR")}</td>
                  <td className={styles.numberCell}>{((src.engagementRate ?? 0) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
