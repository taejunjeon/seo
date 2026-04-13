"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./page.module.css";
import { API_BASE, fmtKRW, fmtNum } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";

export function AibioAdsTab() {
  const [adsData, setAdsData] = useState<{
    accounts: { id: string; name: string; spend: string; impressions: string; clicks: string; cpc: string }[];
    overview: { totalSpend: number; totalImpressions: number; totalClicks: number; avgCpc: number };
  } | null>(null);
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsError, setAdsError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setAdsLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/meta/overview`, { signal: ac.signal }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([overview]) => {
        if (overview) {
          setAdsData({
            accounts: overview.accounts ?? [],
            overview: {
              totalSpend: overview.totalSpend ?? 0,
              totalImpressions: overview.totalImpressions ?? 0,
              totalClicks: overview.totalClicks ?? 0,
              avgCpc: overview.avgCpc ?? 0,
            },
          });
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) setAdsError(err instanceof Error ? err.message : "광고 데이터를 불러올 수 없습니다");
      })
      .finally(() => { if (!ac.signal.aborted) setAdsLoading(false); });
    return () => ac.abort();
  }, []);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>AIBIO 광고 성과</h2>
            <p className={styles.sectionDesc}>
              Meta 광고의 노출/클릭/비용을 확인하고, 캠페인별 효율을 비교한다.
            </p>
          </div>
          <Link href="/ads" className={styles.retryButton} style={{ textDecoration: "none", textAlign: "center" }}>
            상세 대시보드 →
          </Link>
        </div>

        {adsLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>광고 데이터를 불러오는 중...</p>
          </div>
        ) : adsError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{adsError}</p>
          </div>
        ) : adsData ? (
          <>
            <div className={styles.summaryGrid}>
              <SummaryCard label="총 노출" value={fmtNum(adsData.overview.totalImpressions)} sub="30일 기준" />
              <SummaryCard label="총 클릭" value={fmtNum(adsData.overview.totalClicks)} sub="광고를 클릭한 횟수" />
              <SummaryCard label="총 비용" value={fmtKRW(adsData.overview.totalSpend)} sub="Meta 광고비 합산" />
              <SummaryCard label="평균 CPC" value={fmtKRW(adsData.overview.avgCpc)} sub="클릭 1회당 비용" />
            </div>
            {adsData.accounts.length > 0 && (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>광고 계정</th>
                      <th className={styles.tableCellRight}>노출</th>
                      <th className={styles.tableCellRight}>클릭</th>
                      <th className={styles.tableCellRight}>비용</th>
                      <th className={styles.tableCellRight}>CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsData.accounts.map((acc) => (
                      <tr key={acc.id} className={styles.tableRow}>
                        <td><strong>{acc.name}</strong></td>
                        <td className={styles.tableCellRight}>{acc.impressions}</td>
                        <td className={styles.tableCellRight}>{acc.clicks}</td>
                        <td className={styles.tableCellRight}>{acc.spend}</td>
                        <td className={styles.tableCellRight}>{acc.cpc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
      <section className={styles.interpretBlock}>
        <strong>광고 성과 탭이 왜 필요한가?</strong>
        <p>
          AIBIO는 월 ₩148만을 Meta 광고에 쓰고 있다. 이 돈이 실제 고객을 데려오는지,
          어떤 캠페인이 효율적인지 여기서 확인한다. 상세 분석은 /ads 대시보드에서 본다.
        </p>
      </section>
    </>
  );
}
