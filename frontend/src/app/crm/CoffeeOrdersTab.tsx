"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtKRW, fmtNum } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";

export function CoffeeOrdersTab() {
  const [txData, setTxData] = useState<{
    transactions: { paymentKey: string; orderId: string; amount: number; method: string; approvedAt: string; status: string }[];
    summary: { totalAmount: number; totalCount: number; avgAmount: number };
  } | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setTxLoading(true);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    fetch(`${API_BASE}/api/toss/daily-summary?startDate=${startDate}&endDate=${endDate}`, { signal: ac.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const days = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          const totalAmount = days.reduce((s: number, d: { totalAmount?: number }) => s + (d.totalAmount ?? 0), 0);
          const totalCount = days.reduce((s: number, d: { totalCount?: number }) => s + (d.totalCount ?? 0), 0);
          setTxData({
            transactions: days,
            summary: { totalAmount, totalCount, avgAmount: totalCount > 0 ? totalAmount / totalCount : 0 },
          });
        }
      })
      .catch((err) => {
        if (!ac.signal.aborted) setTxError(err instanceof Error ? err.message : "주문 데이터를 불러올 수 없습니다");
      })
      .finally(() => { if (!ac.signal.aborted) setTxLoading(false); });
    return () => ac.abort();
  }, []);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>최근 7일 주문 현황</h2>
            <p className={styles.sectionDesc}>
              Toss 결제 데이터 기준으로 최근 주문과 매출 추이를 확인한다.
            </p>
          </div>
        </div>

        {txLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>주문 데이터를 불러오는 중...</p>
          </div>
        ) : txError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{txError}</p>
          </div>
        ) : txData ? (
          <>
            <div className={styles.summaryGrid}>
              <SummaryCard label="7일 매출" value={fmtKRW(txData.summary.totalAmount)} sub="Toss 결제 합산" tone="success" />
              <SummaryCard label="주문 수" value={`${fmtNum(txData.summary.totalCount)}건`} sub="최근 7일" />
              <SummaryCard label="평균 주문액" value={fmtKRW(txData.summary.avgAmount)} sub="건당 평균" />
              <SummaryCard label="결제 추적" value="live" sub="아임웹 푸터 코드 가동 중" tone="success" />
            </div>
            {txData.transactions.length > 0 && (
              <div className={styles.tableScroll} style={{ marginTop: 18 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>날짜</th>
                      <th className={styles.tableCellRight}>주문 수</th>
                      <th className={styles.tableCellRight}>매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txData.transactions.map((day: Record<string, unknown>, idx: number) => (
                      <tr key={idx} className={styles.tableRow}>
                        <td>{String(day.date ?? day.settlementDate ?? `-`)}</td>
                        <td className={styles.tableCellRight}>{fmtNum(Number(day.totalCount ?? day.count ?? 0))}</td>
                        <td className={styles.tableCellRight}>{fmtKRW(Number(day.totalAmount ?? day.amount ?? 0))}</td>
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
        <strong>더클린커피에서 중요한 것</strong>
        <p>
          상담 서비스가 없으므로, 주문 데이터와 재구매율이 핵심 지표다.
          장바구니 이탈, 재구매 주기, 베스트셀러 분석은 다음 단계에서 추가한다.
        </p>
      </section>
    </>
  );
}
