"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type OverviewSummary = {
  completed_consultations: number;
  unique_completed_customers: number;
  matched_order_customers: number;
  matured_customers: number;
  converted_customers: number;
  conversion_rate: number;
  avg_revenue_per_customer: number;
  baseline_avg_revenue_per_customer: number;
  estimated_incremental_value_per_customer: number;
  estimated_incremental_revenue: number;
  estimated_value_per_consultation: number;
};

type CohortRow = {
  maturityDays: number;
  label: string;
  summary: OverviewSummary | null;
  baselineCustomers: number;
  baselineMatured: number;
  loading: boolean;
  error: string | null;
};

const MATURITY_PERIODS = [
  { days: 30, label: "30일 (1개월)" },
  { days: 60, label: "60일 (2개월)" },
  { days: 90, label: "90일 (3개월)" },
  { days: 180, label: "180일 (6개월)" },
  { days: 365, label: "365일 (1년)" },
];

const fmtKRW = (v: number) => `₩${v.toLocaleString("ko-KR")}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtMultiple = (v: number) => `${v.toFixed(1)}x`;

/* ── 월별 추이용 구간 생성 ── */
const generateQuarterlyRanges = () => {
  const ranges: { label: string; start: string; end: string }[] = [];
  const baseYear = 2025;
  // 2025-Q2 ~ 2026-Q1 (4개 분기)
  const quarters = [
    { label: "25-Q2", start: "2025-04-01", end: "2025-06-30" },
    { label: "25-Q3", start: "2025-07-01", end: "2025-09-30" },
    { label: "25-Q4", start: "2025-10-01", end: "2025-12-31" },
    { label: "26-Q1", start: "2026-01-01", end: "2026-03-27" },
  ];
  return quarters;
};

type TrendPoint = {
  label: string;
  conversionRate: number;
  avgRevenue: number;
  incrementalRevenue: number;
  maturedCustomers: number;
  valuePerConsultation: number;
};

type AnalysisTypeRow = {
  analysis_type: string;
  completed_consultations: number;
  matured_customers: number;
  conversion_rate: number;
  avg_revenue_per_customer: number;
  estimated_incremental_value_per_customer: number;
  estimated_incremental_revenue: number;
  estimated_value_per_consultation: number;
  sample_size_grade: string;
};

export default function CohortPage() {
  const [startDate] = useState("2025-04-01");
  const [endDate] = useState("2026-03-27");
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisTypeRow[]>([]);
  const [analysisTypesLoading, setAnalysisTypesLoading] = useState(true);
  const [rows, setRows] = useState<CohortRow[]>(
    MATURITY_PERIODS.map((p) => ({
      maturityDays: p.days,
      label: p.label,
      summary: null,
      baselineCustomers: 0,
      baselineMatured: 0,
      loading: true,
      error: null,
    })),
  );

  useEffect(() => {
    const ac = new AbortController();

    MATURITY_PERIODS.forEach((p, idx) => {
      fetch(
        `${API_BASE}/api/callprice/overview?maturity_days=${p.days}&start_date=${startDate}&end_date=${endDate}`,
        { signal: ac.signal },
      )
        .then((r) => r.json())
        .then((d) => {
          if (d?.data?.summary) {
            setRows((prev) =>
              prev.map((row, i) =>
                i === idx
                  ? {
                      ...row,
                      summary: d.data.summary,
                      baselineCustomers: d.meta?.baseline_customers ?? 0,
                      baselineMatured: d.meta?.baseline_matured_customers ?? 0,
                      loading: false,
                    }
                  : row,
              ),
            );
          } else {
            setRows((prev) =>
              prev.map((row, i) =>
                i === idx ? { ...row, loading: false, error: "데이터 없음" } : row,
              ),
            );
          }
        })
        .catch((err) => {
          if (ac.signal.aborted) return;
          setRows((prev) =>
            prev.map((row, i) =>
              i === idx
                ? { ...row, loading: false, error: err instanceof Error ? err.message : "오류" }
                : row,
            ),
          );
        });
    });

    return () => ac.abort();
  }, [startDate, endDate]);

  // 분기별 추이 fetch
  useEffect(() => {
    const ac = new AbortController();
    const quarters = generateQuarterlyRanges();

    Promise.all(
      quarters.map((q) =>
        fetch(`${API_BASE}/api/callprice/overview?maturity_days=90&start_date=${q.start}&end_date=${q.end}`, { signal: ac.signal })
          .then((r) => r.json())
          .then((d) => ({
            label: q.label,
            conversionRate: (d?.data?.summary?.conversion_rate ?? 0) * 100,
            avgRevenue: d?.data?.summary?.avg_revenue_per_customer ?? 0,
            incrementalRevenue: d?.data?.summary?.estimated_incremental_revenue ?? 0,
            maturedCustomers: d?.data?.summary?.matured_customers ?? 0,
            valuePerConsultation: d?.data?.summary?.estimated_value_per_consultation ?? 0,
          }))
          .catch(() => ({ label: q.label, conversionRate: 0, avgRevenue: 0, incrementalRevenue: 0, maturedCustomers: 0, valuePerConsultation: 0 })),
      ),
    ).then((results) => {
      setTrendData(results);
      setTrendLoading(false);
    });

    return () => ac.abort();
  }, []);

  // 분석유형별 fetch
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/callprice/analysis-types?maturity_days=90&start_date=${startDate}&end_date=${endDate}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.items) setAnalysisTypes(d.data.items);
        setAnalysisTypesLoading(false);
      })
      .catch(() => setAnalysisTypesLoading(false));
    return () => ac.abort();
  }, [startDate, endDate]);

  const loaded = rows.filter((r) => r.summary);
  const northStar = rows.find((r) => r.maturityDays === 90 && r.summary);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>← 대시보드로 돌아가기</Link>
            <h1 className={styles.headerTitle}>재구매 코호트 · 북극성 지표</h1>
            <p className={styles.headerSub}>
              상담 완료 후 성숙 기간별 전환율/매출 비교 · 회사 북극성: 90일 재구매 순이익
            </p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 북극성 지표 카드 */}
        {northStar?.summary && (
          <div className={styles.northStarCard}>
            <div className={styles.northStarLabel}>회사 북극성 지표 (임시)</div>
            <div className={styles.northStarValue}>
              환불 반영 90일 재구매 순매출: {fmtKRW(northStar.summary.estimated_incremental_revenue)}
            </div>
            <div className={styles.northStarSub}>
              상담 고객 {fmtNum(northStar.summary.matured_customers)}명 × 고객당 상담 효과 {fmtKRW(northStar.summary.estimated_incremental_value_per_customer)}
              {" · "}마진 데이터 확보 후 Repeat Gross Profit 90D로 전환 예정
            </div>
          </div>
        )}

        {/* 실행 지표 카드 */}
        {northStar?.summary && (
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>팀 OMTM</span>
              <strong className={styles.metricValue}>Incremental Gross Profit</strong>
              <span className={styles.metricSub}>현재 근사치: {fmtKRW(northStar.summary.estimated_incremental_revenue)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>identity match rate</span>
              <strong className={styles.metricValue}>
                {fmtPct(northStar.summary.matched_order_customers / Math.max(northStar.summary.unique_completed_customers, 1))}
              </strong>
              <span className={styles.metricSub}>주문 매칭 {fmtNum(northStar.summary.matched_order_customers)} / 상담 {fmtNum(northStar.summary.unique_completed_customers)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>90일 전환율</span>
              <strong className={styles.metricValue}>{fmtPct(northStar.summary.conversion_rate)}</strong>
              <span className={styles.metricSub}>{fmtNum(northStar.summary.converted_customers)}명 전환</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>매출 배수</span>
              <strong className={styles.metricValue}>
                {fmtMultiple(northStar.summary.avg_revenue_per_customer / Math.max(northStar.summary.baseline_avg_revenue_per_customer, 1))}
              </strong>
              <span className={styles.metricSub}>상담 vs 미상담</span>
            </div>
          </div>
        )}

        {/* 코호트 비교 테이블 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>성숙 기간별 코호트 비교</h2>
          <p className={styles.sectionDesc}>
            첫 상담 완료 후 N일이 지난 &quot;성숙 고객&quot;만 각 행의 분모에 포함.
            기간이 길수록 성숙 고객은 줄어들지만 장기 효과를 볼 수 있다.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>성숙 기간</th>
                  <th className={styles.right}>성숙 고객</th>
                  <th className={styles.right}>전환 고객</th>
                  <th className={styles.right}>전환율</th>
                  <th className={styles.right}>상담 고객 매출</th>
                  <th className={styles.right}>미상담 매출</th>
                  <th className={styles.right}>배수</th>
                  <th className={styles.right}>상담 효과/고객</th>
                  <th className={styles.right}>상담 효과 총액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.maturityDays} className={`${styles.tableRow} ${row.maturityDays === 90 ? styles.highlight : ""}`}>
                    <td><strong>{row.label}</strong>{row.maturityDays === 90 && <span className={styles.starBadge}>북극성</span>}</td>
                    {row.loading ? (
                      <td colSpan={8} className={styles.right} style={{ color: "var(--color-text-muted)" }}>로딩 중...</td>
                    ) : row.error ? (
                      <td colSpan={8} className={styles.right} style={{ color: "var(--color-danger)" }}>{row.error}</td>
                    ) : row.summary ? (
                      <>
                        <td className={styles.right}>{fmtNum(row.summary.matured_customers)}</td>
                        <td className={styles.right}>{fmtNum(row.summary.converted_customers)}</td>
                        <td className={styles.right}>{fmtPct(row.summary.conversion_rate)}</td>
                        <td className={styles.right}>{fmtKRW(row.summary.avg_revenue_per_customer)}</td>
                        <td className={styles.right}>{fmtKRW(row.summary.baseline_avg_revenue_per_customer)}</td>
                        <td className={styles.right}>
                          {fmtMultiple(row.summary.avg_revenue_per_customer / Math.max(row.summary.baseline_avg_revenue_per_customer, 1))}
                        </td>
                        <td className={styles.right}>{fmtKRW(row.summary.estimated_incremental_value_per_customer)}</td>
                        <td className={styles.right}>{fmtKRW(row.summary.estimated_incremental_revenue)}</td>
                      </>
                    ) : (
                      <td colSpan={8} className={styles.right}>-</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 해석 블록 */}
        <div className={styles.interpretBlock}>
          <strong>해석 가이드</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
            <li><strong>성숙 기간이 길수록</strong> 성숙 고객 수는 줄어든다 — 최근 상담 고객이 아직 해당 기간에 도달하지 못했기 때문.</li>
            <li><strong>전환율과 고객당 매출</strong>은 기간이 길수록 올라가는 것이 정상이다 — 구매까지 시간이 더 있으므로.</li>
            <li><strong>매출 배수</strong>가 일정하게 유지되면 상담 효과가 장기적으로도 안정적이라는 신호.</li>
            <li><strong>365일 행</strong>이 비어있으면 데이터 기간이 1년 미만이라 성숙 고객이 아직 없는 것.</li>
            <li>이 수치는 관측 차이 기반 추정치이며, 인과적 확정치가 아니다.</li>
          </ul>
        </div>

        {/* 분기별 추이 차트 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>분기별 북극성 지표 추이</h2>
          <p className={styles.sectionDesc}>
            90일 성숙 기준. 분기마다 상담 효과 추정 매출, 전환율, 상담 1건당 가치가 어떻게 변하고 있는지 확인.
          </p>
          {trendLoading ? (
            <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: 32 }}>추이 데이터 로딩 중...</p>
          ) : trendData.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* 상담 효과 추정 매출 추이 */}
              <div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 12, color: "var(--color-text-secondary)" }}>상담 효과 추정 매출</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`} />
                    <Tooltip formatter={(v) => [`₩${Number(v ?? 0).toLocaleString("ko-KR")}`, "추정 매출"]} />
                    <Bar dataKey="incrementalRevenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* 전환율 + 상담 1건 가치 추이 */}
              <div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 12, color: "var(--color-text-secondary)" }}>전환율 · 상담 1건 가치</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left" type="monotone" dataKey="conversionRate" stroke="var(--color-success)" strokeWidth={2} name="전환율(%)" dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="valuePerConsultation" stroke="var(--color-info)" strokeWidth={2} name="1건 가치(원)" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>

        {/* 분석유형별 비교 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>검사 유형별 상담 효과 비교</h2>
          <p className={styles.sectionDesc}>
            90일 성숙 기준. 어떤 검사 유형에서 상담 효과가 가장 큰지 비교.
          </p>
          {analysisTypesLoading ? (
            <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: 32 }}>로딩 중...</p>
          ) : analysisTypes.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analysisTypes.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₩${(Number(v) / 10000).toFixed(0)}만`} />
                  <YAxis type="category" dataKey="analysis_type" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`₩${Number(v ?? 0).toLocaleString("ko-KR")}`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="estimated_value_per_consultation" fill="var(--color-primary)" name="상담 1건 가치" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avg_revenue_per_customer" fill="var(--color-info)" name="고객당 매출" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>검사 유형</th>
                      <th className={styles.right}>완료 상담</th>
                      <th className={styles.right}>성숙 고객</th>
                      <th className={styles.right}>전환율</th>
                      <th className={styles.right}>고객당 매출</th>
                      <th className={styles.right}>상담 1건 가치</th>
                      <th className={styles.right}>상담 효과 총액</th>
                      <th>샘플</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisTypes.map((row) => (
                      <tr key={row.analysis_type} className={styles.tableRow}>
                        <td><strong>{row.analysis_type}</strong></td>
                        <td className={styles.right}>{fmtNum(row.completed_consultations)}</td>
                        <td className={styles.right}>{fmtNum(row.matured_customers)}</td>
                        <td className={styles.right}>{fmtPct(row.conversion_rate)}</td>
                        <td className={styles.right}>{fmtKRW(row.avg_revenue_per_customer)}</td>
                        <td className={styles.right}>{fmtKRW(row.estimated_value_per_consultation)}</td>
                        <td className={styles.right}>{fmtKRW(row.estimated_incremental_revenue)}</td>
                        <td>
                          <span style={{
                            padding: "2px 8px", borderRadius: 9999, fontSize: "0.65rem", fontWeight: 600,
                            background: row.sample_size_grade === "stable" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                            color: row.sample_size_grade === "stable" ? "var(--color-success)" : "var(--color-accent)",
                          }}>
                            {row.sample_size_grade === "stable" ? "안정" : row.sample_size_grade === "watch" ? "주의" : "소표본"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* 향후 기능 */}
        <div className={styles.placeholder}>
          <h3>향후 추가 예정</h3>
          <ul>
            <li>월별 첫 구매 코호트 히트맵 (M+0, M+1, M+2...)</li>
            <li>실험 라벨 (treatment/control) 오버레이</li>
            <li>Repeat Gross Profit 90D (마진 데이터 확보 후)</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
