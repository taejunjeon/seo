"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./RevenueKpiSection.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7020";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const won = (n: number) => `₩${fmt(Math.round(n))}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

type RevenueKpiData = {
  totalRevenue: number;
  totalPurchases: number;
  totalSessions: number;
  purchaseConversionRate: number;
  averageOrderValue: number;
  revenuePerSession: number;
  reportViews: number;
  revenuePerReportView: number;
};

type Props = {
  startDate?: string;
  endDate?: string;
};

export default function RevenueKpiSection({ startDate, endDate }: Props) {
  const [data, setData] = useState<RevenueKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (startDate) qs.set("startDate", startDate);
      if (endDate) qs.set("endDate", endDate);
      const res = await fetch(`${API_BASE}/api/ga4/revenue-kpi?${qs}`);
      if (!res.ok) throw new Error(`API 오류 (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className={styles.loading}>매출 KPI 로딩 중...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data) return null;

  // 데이터 기반 "다음 행동" 추천 생성
  const actions: string[] = [];
  if (data.purchaseConversionRate < 1) {
    actions.push("구매 전환율 1% 미만 → 결제 UX 또는 상품 상세 CTA 점검");
  }
  if (data.revenuePerReportView > 0 && data.revenuePerReportView > data.revenuePerSession * 2) {
    actions.push("리포트 조회당 매출이 높음 → report 페이지 추천 모듈 강화");
  }
  if (data.reportViews > 0 && data.totalPurchases / data.reportViews < 0.05) {
    actions.push("리포트 → 구매 전환 낮음 → 결과 페이지 CTA/추천 구성 수정");
  }
  if (data.averageOrderValue > 0 && data.averageOrderValue < 30000) {
    actions.push("객단가 낮음 → 번들/구독 상품 추천 강화");
  }

  const cards = [
    { label: "매출", value: won(data.totalRevenue), sub: `${fmt(data.totalSessions)} 세션` },
    { label: "구매 수", value: fmt(data.totalPurchases), sub: `전환율 ${pct(data.purchaseConversionRate)}` },
    { label: "구매 전환율", value: pct(data.purchaseConversionRate), sub: `${fmt(data.totalPurchases)}/${fmt(data.totalSessions)}` },
    { label: "객단가", value: won(data.averageOrderValue), sub: "구매당 평균 매출" },
    { label: "세션당 매출", value: won(data.revenuePerSession), sub: `총 ${fmt(data.totalSessions)} 세션` },
    { label: "리포트 조회당 매출", value: won(data.revenuePerReportView), sub: `리포트 ${fmt(data.reportViews)}회 조회` },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.icon}>₩</span>
          매출 핵심 지표
        </div>
      </div>
      <div className={styles.grid}>
        {cards.map((c) => (
          <article key={c.label} className={styles.card}>
            <div className={styles.cardLabel}>{c.label}</div>
            <div className={styles.cardValue}>{c.value}</div>
            {c.sub && <div className={styles.cardSub}>{c.sub}</div>}
          </article>
        ))}
      </div>
      {actions.length > 0 && (
        <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(251, 191, 36, 0.08)", borderRadius: 10, border: "1px solid rgba(251, 191, 36, 0.2)" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", marginBottom: 4 }}>다음 행동</div>
          {actions.map((a) => (
            <div key={a} style={{ fontSize: "0.72rem", color: "#78350f", lineHeight: 1.6 }}>{a}</div>
          ))}
        </div>
      )}
    </div>
  );
}
