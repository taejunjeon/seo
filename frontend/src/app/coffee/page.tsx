"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const fmtKRW = (v: number) => `₩${v.toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const COLORS = ["#0D9488", "#3b82f6", "#F59E0B", "#EF4444", "#8b5cf6", "#ec4899", "#10B981", "#6366f1"];

type MonthlyData = { month: string; customers: number; orders: number; revenue: number; avg_paid: number };
type CohortData = { cohort_month: string; customers: number; repeat_cust: number; repeat_rate: number; avg_revenue: number; avg_orders: number };
type ProductData = { grp: string; rows: number; customers: number; revenue: number };
type GapData = { gap_bucket: string; occurrences: number; avg_days: number };
type OrderDist = { bucket: string; customers: number; avg_revenue: number; total_orders: number };
type ProductRepeatData = { grp: string; customers: number; repeatRate: number; secondToThirdRate: number; vipRate: number; note: string };
type ProgressionData = { label: string; value: string; sub: string };

const PRODUCT_REPEAT_DATA: ProductRepeatData[] = [
  { grp: "에티오피아", customers: 1069, repeatRate: 28.7, secondToThirdRate: 53.4, vipRate: 6.1, note: "재구매율과 VIP 진입율이 모두 가장 높음" },
  { grp: "드립백", customers: 973, repeatRate: 20.4, secondToThirdRate: 41.4, vipRate: 1.9, note: "2회 구매는 되지만 3회차 이후는 약함" },
  { grp: "과테말라", customers: 1824, repeatRate: 18.8, secondToThirdRate: 52.6, vipRate: 3.2, note: "콜롬비아와 유사하나 조금 더 안정적" },
  { grp: "콜롬비아", customers: 3264, repeatRate: 18.1, secondToThirdRate: 54.8, vipRate: 3.3, note: "볼륨 1위, 절대 고객 수 기준 핵심 SKU" },
  { grp: "케냐", customers: 1009, repeatRate: 12.4, secondToThirdRate: 52.0, vipRate: 2.2, note: "첫 재구매 진입이 가장 약함" },
];

const PROGRESSION_DATA: ProgressionData[] = [
  { label: "1회 → 2회", value: "21.7%", sub: "첫 구매 고객 중 2번째 구매까지 간 비율" },
  { label: "2회 → 3회", value: "59.6%", sub: "2회 이상 고객 중 3회 이상으로 이어진 비율" },
  { label: "3회+ → VIP(6회+)", value: "42.0%", sub: "3회 이상 고객 중 6회 이상 VIP로 진입한 비율" },
  { label: "전체 → VIP(6회+)", value: "5.4%", sub: "전체 고객 중 장기 VIP까지 간 비율" },
];

export default function CoffeePage() {
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [orderDist, setOrderDist] = useState<OrderDist[]>([]);
  const [summary, setSummary] = useState<{ customers: number; repeat: number; rate: number; avgOrders: number; revenue: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const coffeeWhere = `(lower(coalesce(shop_sale_name::text,'')) LIKE '%커피%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%콜롬비아%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%에티오피아%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%과테말라%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%드립백%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%원두%' OR lower(coalesce(shop_sale_name::text,'')) LIKE '%케냐%' OR lower(coalesce(order_name::text,'')) LIKE '%커피%')`;

    // PlayAuto 데이터가 있는 callprice API는 커피 전용이 없으므로, 정적 데이터를 사용
    // 실제 구현에서는 커피 전용 API를 만들거나 직접 쿼리
    const staticData = {
      monthly: [
        { month: "25-01", customers: 1105, orders: 1321, revenue: 3928100, avg_paid: 28260 },
        { month: "25-02", customers: 339, orders: 354, revenue: 963460, avg_paid: 30108 },
        { month: "25-03", customers: 469, orders: 495, revenue: 1973120, avg_paid: 28596 },
        { month: "25-04", customers: 900, orders: 996, revenue: 3678850, avg_paid: 28518 },
        { month: "25-05", customers: 678, orders: 703, revenue: 2248760, avg_paid: 28465 },
        { month: "25-06", customers: 962, orders: 1105, revenue: 3758820, avg_paid: 28051 },
        { month: "25-07", customers: 615, orders: 679, revenue: 2940640, avg_paid: 30316 },
        { month: "25-08", customers: 1226, orders: 1449, revenue: 5261620, avg_paid: 30066 },
        { month: "25-09", customers: 1159, orders: 1323, revenue: 6163060, avg_paid: 30662 },
        { month: "25-10", customers: 1391, orders: 1524, revenue: 6084600, avg_paid: 28974 },
        { month: "25-11", customers: 1032, orders: 1108, revenue: 6323210, avg_paid: 29826 },
        { month: "25-12", customers: 1029, orders: 1106, revenue: 8910050, avg_paid: 30831 },
        { month: "26-01", customers: 1130, orders: 1246, revenue: 9385850, avg_paid: 31925 },
        { month: "26-02", customers: 989, orders: 1080, revenue: 7607550, avg_paid: 29373 },
      ],
      cohorts: [
        { cohort_month: "25-01", customers: 1105, repeat_cust: 574, repeat_rate: 51.9, avg_revenue: 13102, avg_orders: 3.75 },
        { cohort_month: "25-02", customers: 212, repeat_cust: 67, repeat_rate: 31.6, avg_revenue: 4970, avg_orders: 2.14 },
        { cohort_month: "25-03", customers: 267, repeat_cust: 86, repeat_rate: 32.2, avg_revenue: 10907, avg_orders: 2.00 },
        { cohort_month: "25-04", customers: 533, repeat_cust: 154, repeat_rate: 28.9, avg_revenue: 9519, avg_orders: 1.81 },
        { cohort_month: "25-05", customers: 384, repeat_cust: 97, repeat_rate: 25.3, avg_revenue: 6430, avg_orders: 1.53 },
        { cohort_month: "25-06", customers: 504, repeat_cust: 103, repeat_rate: 20.4, avg_revenue: 7343, avg_orders: 1.49 },
        { cohort_month: "25-07", customers: 279, repeat_cust: 55, repeat_rate: 19.7, avg_revenue: 6043, avg_orders: 1.45 },
        { cohort_month: "25-08", customers: 694, repeat_cust: 134, repeat_rate: 19.3, avg_revenue: 4643, avg_orders: 1.35 },
        { cohort_month: "25-09", customers: 627, repeat_cust: 74, repeat_rate: 11.8, avg_revenue: 5854, avg_orders: 1.19 },
        { cohort_month: "25-10", customers: 871, repeat_cust: 81, repeat_rate: 9.3, avg_revenue: 3845, avg_orders: 1.12 },
        { cohort_month: "25-11", customers: 630, repeat_cust: 36, repeat_rate: 5.7, avg_revenue: 3620, avg_orders: 1.07 },
        { cohort_month: "25-12", customers: 928, repeat_cust: 67, repeat_rate: 7.2, avg_revenue: 8987, avg_orders: 1.08 },
      ],
      products: [
        { grp: "콜롬비아", rows: 5575, customers: 3264, revenue: 24137370 },
        { grp: "과테말라", rows: 3064, customers: 1824, revenue: 12372140 },
        { grp: "에티오피아", rows: 2340, customers: 1069, revenue: 10345300 },
        { grp: "드립백", rows: 2203, customers: 973, revenue: 0 },
        { grp: "케냐", rows: 1509, customers: 1009, revenue: 4852280 },
        { grp: "정기구독", rows: 762, customers: 128, revenue: 0 },
        { grp: "기타", rows: 726, customers: 660, revenue: 527200 },
      ],
      gaps: [
        { gap_bucket: "0~3일", occurrences: 156, avg_days: 2 },
        { gap_bucket: "4~7일", occurrences: 233, avg_days: 6 },
        { gap_bucket: "8~14일", occurrences: 725, avg_days: 12 },
        { gap_bucket: "15~21일", occurrences: 748, avg_days: 19 },
        { gap_bucket: "22~30일", occurrences: 732, avg_days: 27 },
        { gap_bucket: "31~60일", occurrences: 1398, avg_days: 42 },
        { gap_bucket: "61~90일", occurrences: 527, avg_days: 71 },
        { gap_bucket: "91일+", occurrences: 571, avg_days: 142 },
      ],
      orderDist: [
        { bucket: "1회", customers: 5507, avg_revenue: 3373, total_orders: 5507 },
        { bucket: "2회", customers: 617, avg_revenue: 12418, total_orders: 1234 },
        { bucket: "3회", customers: 274, avg_revenue: 18833, total_orders: 822 },
        { bucket: "4~5회", customers: 254, avg_revenue: 20248, total_orders: 1123 },
        { bucket: "6~10회", customers: 294, avg_revenue: 34632, total_orders: 2226 },
        { bucket: "11회+", customers: 89, avg_revenue: 61958, total_orders: 1268 },
      ],
    };

    setMonthly(staticData.monthly);
    setCohorts(staticData.cohorts);
    setProducts(staticData.products);
    setGaps(staticData.gaps);
    setOrderDist(staticData.orderDist);
    setSummary({ customers: 7035, repeat: 1528, rate: 21.7, avgOrders: 1.73, revenue: 50723907 });
    setLoading(false);

    return () => ac.abort();
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>← 대시보드로 돌아가기</Link>
            <h1 className={styles.headerTitle}>더클린커피 전략 대시보드</h1>
            <p className={styles.headerSub}>PlayAuto 2025 데이터 기반 · 재구매/LTR/가격 전략 분석</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 솔루션 소개 히어로 */}
        <div style={{
          padding: "36px 40px", borderRadius: 20,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0D9488 100%)",
          color: "#fff", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -20, fontSize: "12rem", opacity: 0.04, fontWeight: 900 }}>P</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #14b8a6, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", fontWeight: 800, color: "#fff",
            }}>P</div>
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-display)" }}>
                PROMETHEUS
              </div>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", opacity: 0.6, textTransform: "uppercase" as const }}>
                Growth Intelligence Engine
              </div>
            </div>
          </div>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 800, opacity: 0.92 }}>
            실리콘밸리 탑티어 CSO 관점의 <strong style={{ color: "#2dd4bf" }}>AI 그로스 전략 엔진</strong>.
            매출 데이터, 고객 행동, 재구매 패턴을 실시간으로 분석하고,
            가격 정책, CRM 실험, 고객 세그먼트 전략을 데이터 기반으로 설계합니다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 22 }}>
            {[
              { icon: "🏛", name: "아테나", role: "전략 두뇌", desc: "가장 큰 문제와 기회를 판별하고, 어디에 먼저 투자할지 우선순위를 산정한다" },
              { icon: "🔮", name: "아폴론", role: "수요 예측", desc: "가격 변경·쿠폰·계절에 따른 판매량 변화를 시뮬레이션하고 이탈 위험을 조기 감지한다" },
              { icon: "💰", name: "플루토스", role: "이익 계산", desc: "상품별 순이익, 채널별 ROAS, LTV vs CAC를 계산하여 실제로 돈이 남는 구조를 찾는다" },
              { icon: "📨", name: "헤르메스", role: "CRM 실행", desc: "알림톡·쿠폰·윈백 메시지를 최적 타이밍에 발송하고, 실험 결과를 자동으로 기록한다" },
            ].map((a) => (
              <div key={a.name} style={{
                padding: "16px 18px", borderRadius: 12,
                background: "rgba(255,255,255,0.07)", backdropFilter: "blur(4px)",
              }}>
                <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{a.icon}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.65, marginBottom: 6 }}>{a.role}</div>
                <div style={{ fontSize: "0.76rem", opacity: 0.8, lineHeight: 1.6 }}>{a.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 20, padding: "12px 18px", borderRadius: 10,
            background: "rgba(255,255,255,0.08)", backdropFilter: "blur(4px)",
            fontSize: "0.82rem", lineHeight: 1.7,
          }}>
            이 대시보드는 더클린커피의 <strong>7,035명 고객 데이터</strong>를 분석하여,
            재구매율을 끌어올리고, 최적 가격대를 찾고, VIP를 유지하며,
            광고 ROAS를 극대화하는 전략을 제안합니다.
            모든 수치는 <strong>운영 DB 실데이터</strong> 기반이며,
            제안은 A/B 실험으로 검증합니다.
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /><p>데이터 로딩 중...</p></div>
        ) : (
          <>
            {/* KPI 카드 */}
            {summary && (
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>2025 고객 수</span>
                  <strong className={styles.kpiValue}>{fmtNum(summary.customers)}명</strong>
                  <span className={styles.kpiSub}>전화번호 기준 고유 고객</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>재구매율</span>
                  <strong className={styles.kpiValue}>{fmtPct(summary.rate)}</strong>
                  <span className={styles.kpiSub}>{fmtNum(summary.repeat)}명이 2회 이상 구매</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>고객당 평균 주문</span>
                  <strong className={styles.kpiValue}>{summary.avgOrders}회</strong>
                  <span className={styles.kpiSub}>재구매 골든타임: 3주</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>총 매출 (유료)</span>
                  <strong className={styles.kpiValue}>{fmtKRW(summary.revenue)}</strong>
                  <span className={styles.kpiSub}>Toss 결제 기준 (크로스 조인)</span>
                </div>
              </div>
            )}

            {/* 전략 요약 카드 */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>CRM 전략 우선순위</h2>
              <div className={styles.strategyGrid}>
                {[
                  { rank: "1", title: "3주 차 재구매 알림톡", desc: "1회 구매 후 이탈 78% 고객에게 14~21일 시점에 알림톡 발송. 5% 전환 시 +825만원", color: "var(--color-primary)", tag: "즉시 실행 가능" },
                  { rank: "2", title: "가격 5% 인상 A/B 테스트", desc: "Toss 객단가 45,500원, PlayAuto 31,000원으로 상승 추세. 에티오피아부터 테스트", color: "var(--color-info)", tag: "GA4 권한 필요" },
                  { rank: "3", title: "정기구독 전환 캠페인", desc: "3회+ 구매 고객 891명에게 구독 첫 달 15% 할인. 고정 매출 확보", color: "var(--color-accent)", tag: "아임웹 원장 필요" },
                  { rank: "4", title: "VIP 이탈 방지", desc: "6회+ 충성 고객 383명 관리. 할인 아닌 경험/신규 원두 선행 체험으로 유지", color: "var(--color-danger)", tag: "PlayAuto 충분" },
                ].map((s) => (
                  <div key={s.rank} className={styles.strategyCard} style={{ borderLeftColor: s.color }}>
                    <div className={styles.strategyRank} style={{ background: s.color }}>{s.rank}</div>
                    <div>
                      <strong>{s.title}</strong>
                      <p>{s.desc}</p>
                      <span className={styles.strategyTag}>{s.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 월별 추이 차트 */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>월별 매출 · 고객 추이</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [fmtKRW(Number(v)), ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="revenue" fill="var(--color-primary)" name="매출" radius={[3,3,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="customers" stroke="var(--color-accent)" strokeWidth={2} name="고객 수" dot={{ r: 3 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 재구매 간격 + 주문 횟수 분포 */}
            <div className={styles.twoCol}>
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>재구매 간격 분포</h2>
                <p className={styles.sectionDesc}>15~21일(2~3주)이 최대 빈도 748건 → 이 시점이 CRM 골든타임</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gaps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="gap_bucket" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="occurrences" fill="var(--color-info)" name="건수" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>고객별 주문 횟수 분포</h2>
                <p className={styles.sectionDesc}>1회 구매 후 이탈: 78.3% (5,507/7,035명). 1회→2회 전환: <strong>21.7%</strong>만 넘어감</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={orderDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [fmtNum(Number(v)), ""]} />
                    <Bar dataKey="customers" fill="var(--color-primary)" name="고객 수" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 상품 믹스 */}
            <div className={styles.twoCol}>
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>상품 믹스 (고객 수)</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={products.filter(p => p.customers > 100)} dataKey="customers" nameKey="grp" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {products.filter(p => p.customers > 100).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtNum(Number(v)) + "명", "고객"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>상품별 매출</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={products.filter(p => p.revenue > 0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}만`} />
                    <YAxis type="category" dataKey="grp" width={70} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [fmtKRW(Number(v)), "매출"]} />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 코호트 재구매율 */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>월별 코호트 재구매율</h2>
              <p className={styles.sectionDesc}>초기 코호트는 관찰 기간이 길어 재구매율이 높음. 같은 기간 기준 비교 필요.</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cohorts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="cohort_month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v)}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="repeat_rate" stroke="var(--color-primary)" strokeWidth={2} name="재구매율(%)" dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="customers" stroke="var(--color-text-muted)" strokeWidth={1} name="신규 고객" strokeDasharray="4 4" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>원두별 재구매율 · 3회차 진입 · VIP 진입율</h2>
              <p className={styles.sectionDesc}>
                정의: 해당 원두를 2025년에 1회 이상 산 전화번호 기준 고객 중, 같은 원두를 2회 이상 다시 산 비율을 봤다.
                `디카페인`은 현재 데이터상 `과테말라` 묶음으로 잡혀 별도 분리하지 않았다.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>원두</th>
                      <th style={{ textAlign: "right" }}>고객 수</th>
                      <th style={{ textAlign: "right" }}>재구매율</th>
                      <th style={{ textAlign: "right" }}>2회→3회</th>
                      <th style={{ textAlign: "right" }}>VIP 진입율</th>
                      <th>해석</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCT_REPEAT_DATA.map((row) => (
                      <tr key={row.grp} className={styles.tableRow}>
                        <td><strong>{row.grp}</strong></td>
                        <td style={{ textAlign: "right" }}>{fmtNum(row.customers)}명</td>
                        <td style={{ textAlign: "right", color: "var(--color-primary)", fontWeight: 700 }}>{fmtPct(row.repeatRate)}</td>
                        <td style={{ textAlign: "right" }}>{fmtPct(row.secondToThirdRate)}</td>
                        <td style={{ textAlign: "right" }}>{fmtPct(row.vipRate)}</td>
                        <td>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.interpretBlock} style={{ marginTop: 14 }}>
                <strong>핵심 해석</strong>: 에티오피아는 첫 재구매율과 VIP 진입율이 모두 가장 높아
                <strong> 충성 고객형 SKU</strong>로 볼 수 있다.
                콜롬비아는 비율은 아주 높지 않지만 고객 수가 압도적으로 많아서
                <strong> 전체 재구매 매출에 가장 크게 기여하는 볼륨 SKU</strong>다.
                케냐는 첫 재구매 진입이 약하고, 드립백은 첫 재구매는 되지만 3회차 이후 충성 전환이 약하다.
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>재구매 퍼널 · VIP 진입율</h2>
              <p className={styles.sectionDesc}>
                첫 구매에서 끝나는 고객이 대부분이지만, 2번째 구매까지 온 뒤부터는 다음 단계로 넘어갈 확률이 크게 높아진다.
              </p>
              <div className={styles.kpiGrid}>
                {PROGRESSION_DATA.map((item) => (
                  <div key={item.label} className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>{item.label}</span>
                    <strong className={styles.kpiValue}>{item.value}</strong>
                    <span className={styles.kpiSub}>{item.sub}</span>
                  </div>
                ))}
              </div>
              <div className={styles.interpretBlock} style={{ marginTop: 14 }}>
                <strong>쉽게 말하면</strong>: 첫 구매 고객 100명 중 약 22명만 2번째 구매까지 간다.
                그런데 2번째 구매까지 온 고객만 놓고 보면 약 60명은 3번째 구매까지 간다.
                즉 더클린커피의 가장 큰 병목은 <strong>1회 → 2회 전환</strong>이고,
                한번 재구매 궤도에 올라탄 고객은 그다음부터는 훨씬 잘 이어진다.
              </div>
            </div>

            {/* 가격 전략 — 별도 페이지로 분리 */}
            <div className={styles.section} style={{ textAlign: "center", padding: "32px" }}>
              <h2 className={styles.sectionTitle}>가격 전략 · 원가 분석</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", margin: "8px 0 16px" }}>
                원두별 원가/마진, 경쟁사 비교, 가격 인상 시뮬레이션은 전용 페이지에서 확인
              </p>
              <a href="/coffee-pricing" style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                background: "var(--color-accent)", color: "#fff", fontWeight: 600,
                fontSize: "0.9rem", textDecoration: "none",
              }}>
                가격 전략 · 원가 분석 보기 →
              </a>
            </div>
            {/* 핵심 인사이트 배너 */}
            <div style={{
              padding: "28px 32px", borderRadius: 16,
              background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(139,92,246,0.06))",
              border: "2px solid rgba(245,158,11,0.2)",
              display: "flex", alignItems: "center", gap: 24,
            }}>
              <div style={{ fontSize: "3rem", lineHeight: 1 }}>👑</div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-text-primary)", fontFamily: "var(--font-display)" }}>
                  VIP 383명(5.4%)이 전체 매출의 30%를 만든다
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.6 }}>
                  울트라 VIP 8명은 일반 고객 대비 <strong style={{ color: "var(--color-accent)" }}>35.8배</strong> 매출.
                  반면 1회 이탈 78.3%(5,506명)가 가장 큰 성장 기회.
                  <strong> 이 두 축이 더클린커피 CRM의 핵심이다.</strong>
                </div>
              </div>
            </div>

            {/* VIP 고객 현황 */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>고객 세그먼트 · VIP 파급효과 <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 400 }}>(PlayAuto 주문 횟수 기준 · 매출은 PlayAuto pay_amt 기반으로 과소추정 가능 → Toss 크로스 조인으로 보정)</span></h2>

              {/* 세그먼트 비교 테이블 */}
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>세그먼트</th>
                      <th style={{ textAlign: "right" }}>고객 수</th>
                      <th style={{ textAlign: "right" }}>비중</th>
                      <th style={{ textAlign: "right" }}>평균 주문</th>
                      <th style={{ textAlign: "right" }}>평균 매출</th>
                      <th style={{ textAlign: "right" }}>1회 고객 대비</th>
                      <th style={{ textAlign: "right" }}>총 매출</th>
                      <th style={{ textAlign: "right" }}>매출 비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { seg: "울트라 VIP (20회+)", cnt: 8, pct: "0.1%", orders: "25.5회", rev: "120,713원", vs1: "35.8x", total: "965,700원", share: "1.8%" },
                      { seg: "슈퍼 VIP (10~19회)", cnt: 117, pct: "1.7%", orders: "12.2회", rev: "46,117원", vs1: "13.7x", total: "5,395,730원", share: "10.3%" },
                      { seg: "VIP (6~9회)", cnt: 258, pct: "3.7%", orders: "7.2회", rev: "36,181원", vs1: "10.7x", total: "9,334,710원", share: "17.9%" },
                      { seg: "재구매 (2~5회)", cnt: 1145, pct: "16.3%", orders: "2.8회", rev: "15,690원", vs1: "4.7x", total: "17,965,030원", share: "34.4%" },
                      { seg: "1회 이탈", cnt: 5506, pct: "78.3%", orders: "1.0회", rev: "3,373원", vs1: "1.0x", total: "18,573,120원", share: "35.6%" },
                    ].map((r) => (
                      <tr key={r.seg} className={styles.tableRow} style={r.seg.includes("울트라") ? { background: "rgba(245,158,11,0.08)", fontWeight: 600 } : r.seg.includes("슈퍼") ? { background: "rgba(139,92,246,0.06)" } : undefined}>
                        <td><strong>{r.seg}</strong></td>
                        <td style={{ textAlign: "right" }}>{fmtNum(r.cnt)}</td>
                        <td style={{ textAlign: "right" }}>{r.pct}</td>
                        <td style={{ textAlign: "right" }}>{r.orders}</td>
                        <td style={{ textAlign: "right" }}>{r.rev}</td>
                        <td style={{ textAlign: "right", color: "var(--color-primary)", fontWeight: 600 }}>{r.vs1}</td>
                        <td style={{ textAlign: "right" }}>{r.total}</td>
                        <td style={{ textAlign: "right" }}>{r.share}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* VIP 파급효과 카드 */}
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard} style={{ borderLeft: "4px solid var(--color-accent)" }}>
                  <span className={styles.kpiLabel}>울트라 VIP (20회+)</span>
                  <strong className={styles.kpiValue}>8명</strong>
                  <span className={styles.kpiSub}>1인당 평균 120,713원 · 일반 고객의 <strong>35.8배</strong> · 평균 25.5회 주문 · 28.4개 상품</span>
                </div>
                <div className={styles.kpiCard} style={{ borderLeft: "4px solid #8b5cf6" }}>
                  <span className={styles.kpiLabel}>슈퍼 VIP (10~19회)</span>
                  <strong className={styles.kpiValue}>117명</strong>
                  <span className={styles.kpiSub}>1인당 평균 46,117원 · 일반의 <strong>13.7배</strong> · 평균 12.2회 · 17.6개 상품</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>VIP (6~9회)</span>
                  <strong className={styles.kpiValue}>258명</strong>
                  <span className={styles.kpiSub}>1인당 평균 36,181원 · 일반의 <strong>10.7배</strong> · 평균 7.2회 · 11개 상품</span>
                </div>
                <div className={styles.kpiCard} style={{ borderLeft: "4px solid var(--color-danger)" }}>
                  <span className={styles.kpiLabel}>1회 이탈</span>
                  <strong className={styles.kpiValue}>5,506명</strong>
                  <span className={styles.kpiSub}>78.3% · 1인당 3,373원 · 이 중 21.7%만 재구매로 전환</span>
                </div>
              </div>

              {/* VIP 선호 상품 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>VIP가 좋아하는 원두</h3>
                <div className={styles.twoCol}>
                  <div>
                    <h4 style={{ fontSize: "0.82rem", color: "#8b5cf6", marginBottom: 8 }}>슈퍼 VIP (10회+) 선호</h4>
                    <div style={{ fontSize: "0.78rem", lineHeight: 1.8 }}>
                      {[
                        { p: "콜롬비아", cnt: 392, bar: 100 },
                        { p: "과테말라", cnt: 350, bar: 89 },
                        { p: "에티오피아", cnt: 336, bar: 86 },
                        { p: "케냐", cnt: 171, bar: 44 },
                        { p: "드립백", cnt: 152, bar: 39 },
                      ].map((r) => (
                        <div key={r.p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 70 }}>{r.p}</span>
                          <div style={{ flex: 1, height: 14, background: "var(--color-surface-alt)", borderRadius: 7, overflow: "hidden" }}>
                            <div style={{ width: `${r.bar}%`, height: "100%", background: "#8b5cf6", borderRadius: 7 }} />
                          </div>
                          <span style={{ width: 40, textAlign: "right", color: "var(--color-text-muted)" }}>{r.cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.82rem", color: "var(--color-accent)", marginBottom: 8 }}>울트라 VIP (20회+) 선호</h4>
                    <div style={{ fontSize: "0.78rem", lineHeight: 1.8 }}>
                      {[
                        { p: "콜롬비아", cnt: 58, bar: 67 },
                        { p: "에티오피아", cnt: 49, bar: 56 },
                        { p: "과테말라", cnt: 27, bar: 31 },
                        { p: "드립백", cnt: 3, bar: 3 },
                        { p: "케냐", cnt: 2, bar: 2 },
                      ].map((r) => (
                        <div key={r.p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 70 }}>{r.p}</span>
                          <div style={{ flex: 1, height: 14, background: "var(--color-surface-alt)", borderRadius: 7, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(r.bar, 3)}%`, height: "100%", background: "var(--color-accent)", borderRadius: 7 }} />
                          </div>
                          <span style={{ width: 40, textAlign: "right", color: "var(--color-text-muted)" }}>{r.cnt}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 8 }}>
                      울트라 VIP는 &quot;기타&quot; 비중이 높음(87건) → 다양한 원두를 고루 시도하는 탐험형 고객
                    </p>
                  </div>
                </div>
              </div>

              {/* 홀빈/분쇄 선호 분석 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>홀빈 vs 분쇄: VIP일수록 홀빈을 선택한다</h3>
                <div className={styles.twoCol}>
                  <div>
                    <div style={{ overflowX: "auto" }}>
                      <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                        <thead>
                          <tr className={styles.tableHead}>
                            <th>세그먼트</th>
                            <th style={{ textAlign: "right" }}>홀빈</th>
                            <th style={{ textAlign: "right" }}>분쇄</th>
                            <th style={{ textAlign: "right" }}>드립백</th>
                            <th style={{ textAlign: "right" }}>홀빈 비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { seg: "울트라 VIP (20+)", h: 219, g: 0, d: 1, pct: "96.9%" },
                            { seg: "슈퍼 VIP (10~19)", h: 1222, g: 274, d: 44, pct: "79.3%" },
                            { seg: "VIP (6~9)", h: 1613, g: 458, d: 113, pct: "73.8%" },
                            { seg: "일반 (1~5)", h: 6209, g: 1344, d: 868, pct: "73.7%" },
                          ].map((r) => (
                            <tr key={r.seg} className={styles.tableRow}>
                              <td><strong>{r.seg}</strong></td>
                              <td style={{ textAlign: "right" }}>{fmtNum(r.h)}</td>
                              <td style={{ textAlign: "right" }}>{fmtNum(r.g)}</td>
                              <td style={{ textAlign: "right" }}>{fmtNum(r.d)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>{r.pct}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <div className={styles.interpretBlock}>
                      <strong>인사이트</strong>
                      <ul style={{ paddingLeft: 18, marginTop: 6, lineHeight: 1.8, fontSize: "0.78rem" }}>
                        <li><strong>울트라 VIP 8명은 홀빈 96.9%</strong> — 그라인더를 갖고 있고 원두 품질에 민감한 전문 소비자</li>
                        <li>슈퍼 VIP → VIP → 일반으로 갈수록 분쇄/드립백 비중 증가</li>
                        <li><strong>홀빈 선호 = 높은 충성도 시그널</strong>: 홀빈 구매자는 직접 추출하므로 원두 품질 차이를 체감, 브랜드 전환 비용이 높음</li>
                        <li>CRM 시사점: VIP 대상 메시지에는 &quot;분쇄 추천&quot;보다 <strong>&quot;원두 특성·산지 스토리&quot;</strong>가 더 효과적</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP 이벤트 전략 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>VIP 전용 이벤트 전략</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 14 }}>
                  VIP는 가격 할인이 아닌 <strong>경험과 소속감</strong>으로 유지한다. 할인 쿠폰은 오히려 브랜드 가치를 낮출 수 있다.
                </p>
                <div className={styles.strategyGrid}>
                  {/* 1. 오감 커핑 클래스 (확장) */}
                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>1</div>
                    <div>
                      <strong>오감 커핑 클래스 — 3층 라운지 (리커버리랩)</strong>
                      <p>
                        슈퍼 VIP 이상(125명) 초청. 단순 시음이 아니라
                        <strong> 향수 · 촉감 · 음악과 함께하는 오감 커핑 체험</strong>.
                      </p>
                      <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.9, marginTop: 8 }}>
                        <li>
                          <strong>향 (시향)</strong>: 각 원두와 어울리는 향수를 시향하며 커핑.
                          콜롬비아 수프레모의 고소한 너티함에는 톰포드 네롤리 포르토피노의 지중해 시트러스,
                          에티오피아 예가체프의 과일향에는 루이비통 캘리포니아 드림의 만다린·무스크.
                          신규 런칭 원두 때마다 AI Agent(아테나)가 향 프로필을 매칭하고 운영팀이 최종 컨펌.
                        </li>
                        <li>
                          <strong>촉감</strong>: 원두별 풍미에 어울리는 소재를 손에 쥐고 시음.
                          콜롬비아는 부드러운 캐시미어 니트(고소한 질감),
                          에티오피아는 매끈한 실크 스카프(산미의 매끄러움),
                          케냐는 리넨 패브릭(밝고 경쾌한 산미).
                          촉각이 미각을 증폭시킨다는 감각 크로스오버를 체험.
                        </li>
                        <li>
                          <strong>음악</strong>: B&amp;W Formation Duo 스피커로 원두별 큐레이션 플레이리스트 재생.
                          콜롬비아는 보사노바, 에티오피아는 에티오 재즈, 케냐는 어쿠스틱 기타.
                          음악이 바뀌면 같은 원두라도 풍미가 다르게 느껴지는 실험.
                        </li>
                      </ul>
                      <span className={styles.strategyTag}>대상: 슈퍼+울트라 VIP 125명 · 3층 라운지 · 분기 1회</span>
                    </div>
                  </div>

                  {/* 2. 바이오해킹 세계관 확장 */}
                  <div className={styles.strategyCard} style={{ borderLeftColor: "#ec4899" }}>
                    <div className={styles.strategyRank} style={{ background: "#ec4899" }}>2</div>
                    <div>
                      <strong>바이오해킹 세계관 확장 프로그램</strong>
                      <p>
                        커피를 시작점으로 바이오컴의 <strong>바이오해킹 세계관</strong>으로 자연스럽게 확장.
                        &quot;깨끗한 원두&quot;에서 시작해 &quot;깨끗한 몸&quot;까지 경험하게 한다.
                      </p>
                      <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.9, marginTop: 8 }}>
                        <li><strong>리커버리랩스 체험권</strong>: VIP 이벤트 참석자에게 리커버리랩 바이오해킹 프로그램 1회 체험 제공</li>
                        <li><strong>팀키토 도시락</strong>: 커핑 클래스에 키토제닉 도시락 동봉. 클린 커피 + 클린 푸드 시너지 체험</li>
                        <li><strong>연구소 라운딩</strong>: 바이오컴 연구소를 직접 둘러보며 곰팡이독소 검사, 원두 품질 관리 과정 견학</li>
                        <li><strong>검사권 소개</strong>: 미네랄/중금속/알러지 검사 소개 + VIP 전용 할인가. 커피에서 건강 관리로 자연스러운 크로스셀</li>
                      </ul>
                      <span className={styles.strategyTag}>커피 VIP → 바이오컴 전체 고객으로 확장 · 연 2~4회</span>
                    </div>
                  </div>

                  {/* 3. 로스터의 선택 */}
                  <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
                    <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>3</div>
                    <div>
                      <strong>원두 구독자 전용 &quot;로스터의 선택&quot; 한정 원두</strong>
                      <p>
                        매월 로스터가 직접 선별한 소량 한정 원두를 VIP 구독자에게만 제공.
                        일반 판매 없이 <strong>VIP 전용 SKU</strong>로 운영.
                        포장에 로스팅 날짜/배치 넘버/로스터 서명을 넣어 프리미엄 감성 강화.
                      </p>
                      <span className={styles.strategyTag}>대상: 정기구독 VIP · 월 1회 · 한정 50팩</span>
                    </div>
                  </div>

                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-primary)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-primary)" }}>4</div>
                    <div>
                      <strong>홀빈 VIP 대상 &quot;나만의 블렌딩&quot; 워크숍</strong>
                      <p>
                        울트라 VIP 8명 + 슈퍼 VIP 중 홀빈 비율 90%+ 고객 대상.
                        자신만의 블렌딩 비율을 직접 설계하고, 그 레시피로 <strong>1회 한정 생산</strong>.
                        결과물에 고객 이름을 넣은 라벨로 배송. SNS 공유 유도 → 자연 바이럴.
                      </p>
                      <span className={styles.strategyTag}>대상: 홀빈 울트라/슈퍼 VIP · 연 2회 · 리커버리랩</span>
                    </div>
                  </div>

                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>5</div>
                    <div>
                      <strong>VIP 조기 경고 시스템 (이탈 방지)</strong>
                      <p>
                        VIP 고객의 평균 주문 간격을 개인별로 추적. 평균 간격의 <strong>1.5배를 초과</strong>하면 자동 알림.
                        이탈 위험 고객에게 &quot;새로운 크롭이 도착했어요&quot; 메시지 + 신규 원두 샘플 동봉.
                        <strong>절대 할인 쿠폰이 아닌</strong> 새로운 경험으로 재방문 유도.
                      </p>
                      <span className={styles.strategyTag}>아폴론 에이전트 자동 감지 → 헤르메스 실행</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Toss+PlayAuto 크로스 분석 결과 ═══ */}
            <div className={styles.section} style={{ borderTop: "3px solid var(--color-success)" }}>
              <h2 className={styles.sectionTitle}>Toss × PlayAuto 크로스 분석 — LTR 정밀 측정 완료</h2>
              <p className={styles.sectionDesc}>
                Toss orderId와 PlayAuto shop_ord_no를 매칭하여 &quot;누가 실제로 얼마를 결제했는지&quot; 확인. 매칭률 99.8%.
              </p>

              {/* 기존 vs 정확 비교 */}
              <div className={styles.compGrid}>
                <div className={styles.compCard} style={{ borderTopColor: "var(--color-text-muted)" }}>
                  <strong>PlayAuto 기반 (기존, 과소추정)</strong>
                  <div className={styles.compRow}><span>고객당 LTR</span><span style={{ textDecoration: "line-through" }}>₩5,508</span></div>
                  <div className={styles.compRow}><span>평균 객단가</span><span>₩29,000~31,000</span></div>
                  <div className={styles.compRow}><span>재구매율</span><span>21.7%</span></div>
                  <div className={styles.compRow}><span>문제</span><span style={{ color: "var(--color-danger)" }}>pay_amt 89%가 0원 (물류 행)</span></div>
                </div>
                <div className={styles.compCard} style={{ borderTopColor: "var(--color-success)" }}>
                  <strong>Toss 크로스 조인 (정확)</strong>
                  <div className={styles.compRow}><span>고객당 LTR</span><span style={{ fontWeight: 700, color: "var(--color-primary)" }}>₩98,112</span></div>
                  <div className={styles.compRow}><span>평균 객단가</span><span style={{ fontWeight: 700 }}>₩48,579</span></div>
                  <div className={styles.compRow}><span>재구매율</span><span>20.9% (PlayAuto와 일치)</span></div>
                  <div className={styles.compRow}><span>매칭률</span><span style={{ color: "var(--color-success)" }}>663/664건 (99.8%)</span></div>
                </div>
              </div>

              {/* Toss 검증: 1회 이탈 비율 */}
              <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
                <strong>Toss 교차 검증: 1회 이탈 비율</strong> —
                PlayAuto 기준 78.3% vs <strong>Toss 기준 79.1%</strong> (517명 중 409명).
                양쪽 데이터 소스에서 일치. <strong>1회 이탈 ~79%는 신뢰할 수 있는 수치.</strong>
                재구매율도 PlayAuto 21.7% vs Toss 20.9%로 일치.
              </div>

              {/* 왜 차이가 나는가 */}
              <div style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>왜 17.8배 차이가 나는가</h3>
                <div className={styles.strategyGrid}>
                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-danger)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-danger)" }}>1</div>
                    <div>
                      <strong>PlayAuto pay_amt 89%가 0원</strong>
                      <p>PlayAuto는 물류 시스템이라 결제 금액이 아닌 출고 기록. 결제는 Toss에서 처리. 14,413행이 ₩0.</p>
                    </div>
                  </div>
                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>2</div>
                    <div>
                      <strong>PlayAuto 1주문 = N행, Toss 1주문 = 1행</strong>
                      <p>콜롬비아+에티오피아+드립백 묶음 → PlayAuto 3행(line-item), Toss 1행(결제). 주문 횟수도 과대계산.</p>
                    </div>
                  </div>
                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>3</div>
                    <div>
                      <strong>기간 불일치</strong>
                      <p>Toss에는 2026-01~02(2개월)만, PlayAuto는 2025 전체. VIP 주문 대부분이 2025년이라 Toss에서 VIP LTR이 낮게 보임.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 수정된 지표 기준 */}
              <div style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>앞으로의 지표 기준</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>지표</th>
                        <th>데이터 소스</th>
                        <th>이유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["LTR / 객단가 / 순매출", "Toss 결제 API", "실제 결제 금액"],
                        ["재구매율", "PlayAuto 또는 Toss", "양쪽 ~21%로 일치"],
                        ["고객 식별 (전화번호)", "PlayAuto", "Toss에는 전화번호 없음"],
                        ["상품별 분석 / 홀빈·분쇄", "PlayAuto", "상품명/옵션 필드 있음"],
                        ["PG 수수료", "Toss 정산 API", "건별 3.41~3.63% 실비"],
                        ["크로스 분석 (누가 얼마를)", "Toss × PlayAuto 조인", "orderId 매칭 99.8%"],
                      ].map((r, i) => (
                        <tr key={i} className={styles.tableRow}>
                          <td><strong>{r[0]}</strong></td>
                          <td style={{ color: "var(--color-primary)" }}>{r[1]}</td>
                          <td>{r[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VIP LTR 주의사항 */}
              <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
                <strong>VIP LTR 주의</strong>: 현재 Toss에는 2026-01~02 데이터(2개월)만 있어, VIP(6회+ 구매)의 Toss LTR이 낮게 나옴.
                VIP 대부분의 주문은 2025년에 발생했으므로 Toss 기간이 짧은 것이 원인.
                <strong>정확한 VIP LTR은 Toss 데이터가 6개월+ 쌓인 후 재산출</strong>하거나, 아임웹 커피 siteCode 연동으로 해결.
                현재 VIP 분석(홀빈/분쇄/상품 선호/주문 횟수)은 PlayAuto 기반으로 유효.
              </div>
            </div>

            {/* Codex 보완 의견 */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Codex 기술 보완 의견</h2>
              <p className={styles.sectionDesc}>백엔드/데이터 설계 관점에서 CSO 전략에 대한 보충</p>

              <div className={styles.strategyGrid}>
                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>✓</div>
                  <div>
                    <strong>정식 주문 원장: 아임웹 API로 지금 확인 가능</strong>
                    <p>
                      `IMWEB_API_KEY_COFFEE`와 `IMWEB_SECRET_KEY_COFFEE`로 <strong>v2/auth 토큰 발급 200</strong>,
                      <strong> `member/members` 200</strong>, <strong>`shop/orders` 200</strong>까지 확인했다.
                      즉 더클린커피는 <strong>아임웹 API 쪽에서 정식 주문 원장을 당길 수 있는 상태</strong>다.
                      주문번호, 주문시각, 주문자 member_code, 전화번호, 상품 정보가 내려온다.
                    </p>
                    <span className={styles.strategyTag}>가능: 아임웹 = 고객/주문 원장</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>i</div>
                  <div>
                    <strong>Toss API만으로는 정식 재구매 원장 불충분</strong>
                    <p>
                      Toss는 결제 금액과 `orderId/paymentKey`를 확인하는 데는 가장 정확하다.
                      하지만 고객 식별자(전화번호, 회원코드)가 없어서 <strong>Toss만으로는 재구매율/LTR을 닫을 수 없다.</strong>
                      가장 좋은 구조는 <strong>아임웹 주문 원장 + Toss 결제금액 조인</strong>이다.
                    </p>
                    <span className={styles.strategyTag}>권장: 아임웹 = 고객, Toss = 결제 truth</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>✓</div>
                  <div>
                    <strong>Toss+PlayAuto 크로스 조인 완료 — LTR 과소추정 해결</strong>
                    <p>
                      Toss <code>order_id</code>와 PlayAuto <code>shop_ord_no</code>를 매칭하여 <strong>99.8% 조인 성공</strong>.
                      PlayAuto 기반 LTR 5,508원 → <strong>Toss 기준 정확한 LTR: 98,112원 (17.8배)</strong>.
                      실제 객단가 ₩48,579. 재구매율은 양쪽 ~21%로 일치하여 신뢰 확인.
                      이제 커피 고객별 정확한 매출을 Toss 결제 금액 기준으로 산출 가능.
                    </p>
                    <span className={styles.strategyTag}>해결 완료 · 상세: coffee/coffee.md 섹션 14</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>2</div>
                  <div>
                    <strong>알림톡 발송 준비 상태</strong>
                    <p>
                      알리고 자격증명 <strong>전부 확보 완료</strong> (API Key, User ID, Sender Key, 발신번호, @바이오컴 채널).
                      남은 것 2가지만:
                      (1) 카카오 알림톡 <strong>템플릿 등록 + 심사 통과</strong> (보통 1~3영업일),
                      (2) 더클린커피 회원가입 시 <strong>마케팅 수신 동의</strong> 여부 확인 (아임웹 회원 API의 smsAgree 필드로 확인 가능).
                    </p>
                    <span className={styles.strategyTag}>남은 것: 템플릿 심사 + 수신동의 확인</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>3</div>
                  <div>
                    <strong>가격 A/B의 기술적 현실</strong>
                    <p>
                      아임웹은 SaaS 빌더라 동일 상품 가격을 사용자별로 다르게 보여주는 서버사이드 A/B가 어려움.
                      대안: (1) 쿠폰 역방향 — A그룹은 할인 없이, B그룹은 5% 쿠폰 제공,
                      (2) 시간 기반 — 1주 기존가, 다음 1주 인상가,
                      (3) 상품 단위 — 에티오피아만 인상하고 콜롬비아는 유지.
                    </p>
                    <span className={styles.strategyTag}>아임웹 제약 → 쿠폰/시간/상품 단위 대안</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-text-muted)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-text-muted)" }}>4</div>
                  <div>
                    <strong>정기구독 데이터 사각지대</strong>
                    <p>
                      PlayAuto의 &quot;정기구독 762건, 128명&quot;은 배송 물류 행이지 결제 행이 아님.
                      실제 구독 전환율/유지율(M+1, M+3, M+6 churn)은 아임웹 구독 관리 데이터 없이는 계산 불가.
                      <strong>확보 방법</strong>: 아임웹 v1 API (<code>IMWEB_API_KEY</code> 확보 완료)로
                      주문 목록 조회 시 <code>isSubscription=Y</code> 필터링하면 정기구독 주문만 추출 가능.
                    </p>
                    <span className={styles.strategyTag}>아임웹 API isSubscription 필터로 확보 가능</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>권장 실행 순서 (기술적 현실 반영)</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { label: "이번 주", value: "크로스 조인", sub: "Toss 결제 + PlayAuto 전화번호로 정확한 객단가/LTR 확인" },
                    { label: "다음 주", value: "알리고 준비", sub: "자격증명 확보 + 알림톡 템플릿 등록 신청" },
                    { label: "2주 후", value: "첫 발송", sub: "3주 차 재구매 대상 추출 + 대조군 설계 + 알림톡 발송" },
                    { label: "4주 후", value: "가격 검토", sub: "재구매 알림톡 효과 확인 → 가격 A/B 여부 결정" },
                  ].map((step) => (
                    <div key={step.label} className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>{step.label}</span>
                      <strong className={styles.kpiValue}>{step.value}</strong>
                      <span className={styles.kpiSub}>{step.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* ═══ 첫구매 15% 쿠폰 실험 전략 ═══ */}
            <div className={styles.section} style={{ borderTop: "3px solid var(--color-primary)" }}>
              <h2 className={styles.sectionTitle}>첫구매 고객 15% 쿠폰 재구매 실험</h2>
              <p className={styles.sectionDesc}>
                실험 ID: <code>coffee_first_purchase_coupon_v1</code> · 로컬 SQLite 실험 원장 · 전환 윈도우 30일
              </p>

              {/* 실험 설계 */}
              <div className={styles.interpretBlock} style={{ marginBottom: 18 }}>
                <strong>실험 목적</strong>: 더클린커피 첫 구매 고객에게 15% 할인 쿠폰을 보내되,
                <em>언제 보내는지(타이밍)</em>와 <em>얼마나 급하게 만드는지(만료 기간)</em>의 최적 조합을 찾는다.
              </div>

              {/* 변수 매트릭스 */}
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table className={styles.table} style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th></th>
                      <th style={{ textAlign: "center" }}>24시간 만료<br />(타임세일)</th>
                      <th style={{ textAlign: "center" }}>2일 만료<br />(적당한 긴박)</th>
                      <th style={{ textAlign: "center" }}>3일 만료<br />(여유)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>2주 후</strong><br /><span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>원두 절반 소진 시점</span></td>
                      <td style={{ textAlign: "center" }}>t2w_24h</td>
                      <td style={{ textAlign: "center" }}>t2w_2d</td>
                      <td style={{ textAlign: "center" }}>t2w_3d</td>
                    </tr>
                    <tr style={{ background: "rgba(13,148,136,0.06)" }}>
                      <td><strong>2.5주 후</strong><br /><span style={{ fontSize: "0.7rem", color: "var(--color-primary)" }}>CSO 추천 타이밍</span></td>
                      <td style={{ textAlign: "center" }}>t2h_24h</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "var(--color-primary)" }}>t2h_2d ★</td>
                      <td style={{ textAlign: "center" }}>t2h_3d</td>
                    </tr>
                    <tr>
                      <td><strong>3주 후</strong><br /><span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>원두 거의 소진 시점</span></td>
                      <td style={{ textAlign: "center" }}>t3w_24h</td>
                      <td style={{ textAlign: "center" }}>t3w_2d</td>
                      <td style={{ textAlign: "center" }}>t3w_3d</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 6 }}>
                  + control 그룹 (쿠폰 없음) = 총 10그룹
                </p>
              </div>

              {/* CSO 예측 */}
              <div className={styles.section} style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.04), rgba(59,130,246,0.03))", border: "2px solid rgba(13,148,136,0.15)" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)", marginBottom: 12 }}>CSO 예측: 가장 효과적인 조합</h3>

                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard} style={{ borderLeft: "4px solid var(--color-primary)" }}>
                    <span className={styles.kpiLabel}>1순위 예측</span>
                    <strong className={styles.kpiValue}>t2h_2d ★</strong>
                    <span className={styles.kpiSub}>2.5주 후(17~18일차) 발송 + 2일 만료</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>2순위 예측</span>
                    <strong className={styles.kpiValue}>t3w_24h</strong>
                    <span className={styles.kpiSub}>3주 후(21일차) 발송 + 24시간 타임세일</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>3순위 예측</span>
                    <strong className={styles.kpiValue}>t2w_2d</strong>
                    <span className={styles.kpiSub}>2주 후(14일차) 발송 + 2일 만료</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>대조군 예상</span>
                    <strong className={styles.kpiValue}>~5%</strong>
                    <span className={styles.kpiSub}>쿠폰 없이 자연 재구매</span>
                  </div>
                </div>

                <div style={{ marginTop: 16, fontSize: "0.82rem", lineHeight: 1.8, color: "var(--color-text-secondary)" }}>
                  <strong>왜 t2h_2d가 1순위인가:</strong>
                  <ol style={{ paddingLeft: 20, marginTop: 6 }}>
                    <li><strong>2.5주 = 원두 소진 직전</strong>: PlayAuto 재구매 간격 p75 = 21일. 17~18일차에 &quot;곧 떨어지죠?&quot; 메시지는 고객이 이미 느끼는 불편을 건드린다.</li>
                    <li><strong>2일 만료 = 적당한 긴박감</strong>: 24시간은 &quot;지금 당장 안 사면 손해&quot;라는 압박이 커피 구매 맥락에 안 맞음 (커피는 충동구매 아님). 3일은 &quot;내일 해야지&quot; 심리로 결국 안 삼. 2일은 &quot;오늘이나 내일 중에&quot;로 적당한 데드라인.</li>
                    <li><strong>15% 할인 + 2일 제한 = 손실 회피 트리거</strong>: 행동경제학에서 &quot;가격을 내린 것&quot;보다 &quot;곧 사라지는 혜택&quot;이 더 강한 동기 부여. 2일은 이 효과를 최대화하면서 불쾌감은 최소화.</li>
                  </ol>

                  <strong style={{ display: "block", marginTop: 12 }}>왜 t3w_24h가 2순위인가:</strong>
                  <p>3주 = 진짜 원두가 떨어진 시점. 이때 24시간 타임세일은 &quot;지금 바로 주문하세요&quot;와 정확히 일치한다. 다만 3주까지 기다리면 일부 고객은 이미 다른 곳에서 샀을 수 있다.</p>

                  <strong style={{ display: "block", marginTop: 12 }}>실험 실패 기준 (손절선):</strong>
                  <p>최고 성과 variant의 재구매 전환율이 control 대비 3%p 미만이면 쿠폰 전략 자체를 재검토. 15% 할인의 마진 영향(객단가 ~31,000원 × 15% = ~4,650원 할인)을 감안하면, 전환율 차이가 작으면 마진 손해가 더 크다.</p>
                </div>
              </div>

              {/* 구체적 실행 방법 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>구체적 실행 방법 (본 솔루션 활용)</h3>
                <div className={styles.strategyGrid}>
                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-primary)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-primary)" }}>1</div>
                    <div>
                      <strong>대상자 추출 (완료)</strong>
                      <p>
                        PlayAuto <code>tb_playauto_orders</code>에서 커피 1회 구매 고객 전화번호 추출.
                        <code>/api/crm-local/experiments</code>에 실험 생성 + 10그룹 배정 완료.
                        전환 동기화로 운영 DB 주문 데이터 자동 매칭.
                      </p>
                      <span className={styles.strategyTag}>crm-local SQLite · 자동화</span>
                    </div>
                  </div>

                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>2</div>
                    <div>
                      <strong>알림톡 템플릿 등록 (TJ 액션 필요)</strong>
                      <p>
                        알리고 관리자(kakaoapi.aligo.in)에서 9개 variant별 알림톡 템플릿 등록.
                        예시: &quot;[더클린커피] 고객님, 원두가 떨어질 때쯤이죠? 지금 15% 할인 쿠폰을 드립니다. 48시간 내 사용해주세요.&quot;
                        카카오 심사 통과 필요 (1~3영업일).
                      </p>
                      <span className={styles.strategyTag}>ALIGO_API_KEY + 템플릿 심사</span>
                    </div>
                  </div>

                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>3</div>
                    <div>
                      <strong>자동 발송 스케줄링</strong>
                      <p>
                        각 variant별 발송 시점에 맞춰 알리고 API 호출.
                        <code>/api/crm-local/messages</code>에 발송 로그 자동 적재.
                        <code>/crm</code> 알림톡 발송 탭에서 발송 상태 실시간 확인.
                      </p>
                      <span className={styles.strategyTag}>알리고 senddate 예약 발송</span>
                    </div>
                  </div>

                  <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                    <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>4</div>
                    <div>
                      <strong>전환 측정 (30일 윈도우)</strong>
                      <p>
                        발송 후 30일간 <code>sync-conversions</code>를 매일 실행.
                        variant별 재구매 전환율, 순매출, 쿠폰 사용률을 <code>/crm</code> 실험 탭에서 확인.
                        control 대비 구매율 차이가 3%p 이상이면 성공.
                      </p>
                      <span className={styles.strategyTag}>crm-local 전환 동기화 · 자동</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 예상 타임라인 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>예상 타임라인</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { label: "D+0 (오늘)", value: "실험 생성", sub: "10그룹 배정 + 대상자 추출 + 전환 동기화" },
                    { label: "D+1~3", value: "템플릿 등록", sub: "알리고에 9개 variant 템플릿 등록 + 카카오 심사" },
                    { label: "D+14~21", value: "발송 시작", sub: "variant별 시점에 맞춰 알림톡 순차 발송" },
                    { label: "D+44~51", value: "결과 확정", sub: "마지막 발송 후 30일 전환 윈도우 종료 → 최종 판정" },
                  ].map((step) => (
                    <div key={step.label} className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>{step.label}</span>
                      <strong className={styles.kpiValue}>{step.value}</strong>
                      <span className={styles.kpiSub}>{step.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ 리드 마그넷 개발 계획 ═══ */}
            <div className={styles.section} style={{ borderTop: "3px solid #ec4899" }}>
              <h2 className={styles.sectionTitle}>리드 마그넷: &quot;1분 커피 타입 진단&quot;</h2>
              <p className={styles.sectionDesc}>
                더클린커피의 병목은 &quot;관심 없음&quot;이 아니라 <strong>선택 피로</strong>.
                처음 온 사람이 어떤 상품부터 사야 하는지 10초 안에 못 정하는 것이 문제.
                진단형 리드 마그넷으로 &quot;누구에게 무엇을 먼저 사게 할지&quot; 빠르게 분기한다.
              </p>

              {/* 진단 결과 유형 */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>진단 결과 4유형 → 상품 연결</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { icon: "☕", type: "클린 입문형", product: "드립백", desc: "커피 입문자, 간편 추출 선호. 10,900원대 저가 진입", color: "#ec4899" },
                    { icon: "🫘", type: "고소한 데일리형", product: "콜롬비아 수프레모", desc: "매일 마시는 고소한 맛. 더클린커피 대표 원두", color: "var(--color-primary)" },
                    { icon: "🍊", type: "풍미 탐색형", product: "에티오피아/케냐", desc: "산미·과일향 선호. VIP로 성장할 가능성 높은 탐험가", color: "var(--color-accent)" },
                    { icon: "🌙", type: "카페인 민감형", product: "디카페인", desc: "오후/임산부/민감 체질. 별도 퍼널 필요", color: "var(--color-info)" },
                  ].map((t) => (
                    <div key={t.type} className={styles.kpiCard} style={{ borderLeft: `4px solid ${t.color}` }}>
                      <span style={{ fontSize: "1.5rem" }}>{t.icon}</span>
                      <strong className={styles.kpiValue} style={{ fontSize: "1rem" }}>{t.type}</strong>
                      <span className={styles.kpiSub}>→ <strong>{t.product}</strong></span>
                      <span className={styles.kpiSub}>{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 퍼널 구조 */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>퍼널 구조</h3>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "16px 20px", background: "var(--color-surface-alt)", borderRadius: 12, fontSize: "0.82rem",
                }}>
                  {["광고/SEO", "→", "1분 진단", "→", "결과 페이지", "→", "첫 구매", "→", "후속 CRM", "→", "정기구독"].map((step, i) => (
                    step === "→" ? <span key={i} style={{ color: "var(--color-text-muted)" }}>→</span> :
                    <span key={i} style={{
                      padding: "6px 14px", borderRadius: 8, fontWeight: 600,
                      background: i === 4 ? "var(--color-primary)" : "white",
                      color: i === 4 ? "#fff" : "var(--color-text-primary)",
                      border: "1px solid var(--color-border)",
                    }}>{step}</span>
                  ))}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 6 }}>
                  결과 보기 직전에 휴대폰/이메일 1개만 수집 → 후속 CRM: D0, D1, D3, D7, D21 시퀀스
                </div>
              </div>

              {/* 진단 문항 예시 */}
              <div className={styles.twoCol}>
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 10 }}>진단 문항 예시 (7개)</h3>
                  <ol style={{ paddingLeft: 20, fontSize: "0.8rem", lineHeight: 2.0 }}>
                    <li>카페인에 민감한 편인가요?</li>
                    <li>산미를 좋아하나요, 고소함을 좋아하나요?</li>
                    <li>집에서 내려 마시나요, 간편하게 마시나요?</li>
                    <li>아침 루틴용인가요, 오후에도 마시나요?</li>
                    <li>방탄커피처럼 버터/MCT와 함께 마실 생각이 있나요?</li>
                    <li>선물용인가요, 내가 마실 용도인가요?</li>
                    <li>커피 구독에 관심이 있나요?</li>
                  </ol>
                </div>
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 10 }}>CRM 실험 연계</h3>
                  <div className={styles.strategyGrid}>
                    <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-text-muted)" }}>
                      <div>
                        <strong>대조군 설계 (3그룹)</strong>
                        <p>
                          A. 무메시지 대조군<br />
                          B. 진단 결과 기반 맞춤 메시지<br />
                          C. 일반 할인 메시지 (15%)
                        </p>
                        <p style={{ marginTop: 6, fontWeight: 600 }}>
                          → &quot;진단형이 일반 할인보다 더 파는가?&quot; 검증
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, textAlign: "center" }}>
                    <a href="/lead-magnet" style={{
                      display: "inline-block", padding: "12px 28px", borderRadius: 10,
                      background: "var(--color-primary)", color: "#fff", fontWeight: 600,
                      fontSize: "0.9rem", textDecoration: "none",
                    }}>
                      리드 마그넷 자세히 보기 →
                    </a>
                  </div>
                </div>
              </div>

              {/* 실행 로드맵 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>실행 로드맵</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { label: "오늘", value: "유형 확정", sub: "진단 문항 7개 + 결과 유형 4개 + 대표 상품 매핑" },
                    { label: "이번 주", value: "퍼널 제작", sub: "진단 랜딩 1장 + 결과 페이지 4개 + 후속 메시지 3개" },
                    { label: "다음 배치", value: "광고 + 실험", sub: "Meta 광고 2세트 + SEO 3편 + 대조군 A/B/C 실험" },
                    { label: "4주 후", value: "결과 판정", sub: "진단형 vs 일반 할인 전환율 비교 → 우승 퍼널 확정" },
                  ].map((s) => (
                    <div key={s.label} className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>{s.label}</span>
                      <strong className={styles.kpiValue}>{s.value}</strong>
                      <span className={styles.kpiSub}>{s.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ 향후 분석 계획: 원가/이익/ROAS ═══ */}
            <div className={styles.section} style={{ borderTop: "3px solid var(--color-accent)" }}>
              <h2 className={styles.sectionTitle}>향후 분석 계획: 원가 · 이익 최적화 · ROAS</h2>
              <p className={styles.sectionDesc}>
                TJ님이 원가/판관비/광고비 자료를 제공하면, 아래 분석을 순차 진행 예정.
                일부 데이터는 본 솔루션의 API(Toss/PlayAuto/GA4)로 교차 검증.
              </p>

              {/* Phase 아웃라인 */}
              <div className={styles.strategyGrid}>
                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>A</div>
                  <div>
                    <strong>원두 원가 구조 분석</strong>
                    <p>
                      상품별(콜롬비아/에티오피아/과테말라/케냐/드립백) 원두 원가, 포장비, 로스팅 비용을 파악한다.
                      상품별 <strong>공헌이익률</strong>(매출 - 변동비)을 산출하여, 어떤 원두가 마진이 높은지 확인.
                      현재 콜롬비아가 매출 1위이지만 이익 1위인지는 별개 문제.
                    </p>
                    <span className={styles.strategyTag}>TJ 제공: 상품별 원가 · 포장비 · 로스팅 비용</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>B</div>
                  <div>
                    <strong>판관비 분해 · 손익분기 분석</strong>
                    <p>
                      고정비(인건비/임대료/장비 감가)와 변동비(배송비/포장재/결제수수료)를 분리한다.
                      월 <strong>손익분기 주문 수</strong>와 <strong>손익분기 매출</strong>을 산출.
                      현재 월 매출 1,400~1,600만원이 손익분기를 넘기는지 판정.
                    </p>
                    <span className={styles.strategyTag}>TJ 제공: 월 고정비 · 배송비 · PG 수수료율</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-primary)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-primary)" }}>C</div>
                  <div>
                    <strong>최적 가격대 · 이익 극대화점 탐색</strong>
                    <p>
                      상품별 공헌이익률 × 판매량 = <strong>총 공헌이익</strong> 곡선을 그린다.
                      가격 인상 시 판매량 감소와 이익 증가의 교차점(최적 가격)을 시뮬레이션.
                      Toss 가격대별 분포(2~4만 46%, 4~6만 32%, 6만+ 20%)가 기초 데이터.
                    </p>
                    <span className={styles.strategyTag}>솔루션 제공: Toss 가격대 분포 · 쿠폰 실험 결과</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-danger)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-danger)" }}>D</div>
                  <div>
                    <strong>광고비 ROAS · 채널별 효율 분석</strong>
                    <p>
                      Meta/네이버/카카오 등 채널별 광고비 · 노출 · 클릭 · 전환 데이터를 분석한다.
                      채널별 <strong>ROAS</strong>(광고수익률)와 <strong>CAC</strong>(고객획득비용)를 산출.
                      어떤 채널에서 커피 고객을 가장 싸게 데려오는지 확인.
                    </p>
                    <span className={styles.strategyTag}>TJ 제공: 광고비 · 솔루션 검증: GA4/Toss 교차</span>
                  </div>
                </div>

                <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
                  <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>E</div>
                  <div>
                    <strong>통합 수익성 대시보드</strong>
                    <p>
                      위 A~D 결과를 종합하여 <strong>상품별 순이익</strong>, <strong>채널별 ROAS</strong>,
                      <strong>고객 세그먼트별 LTV vs CAC</strong>를 한 화면에 보여준다.
                      &quot;어떤 원두를, 어떤 채널로, 어떤 가격에, 어떤 고객에게 팔 때 가장 돈이 남는가?&quot;에 답하는 대시보드.
                    </p>
                    <span className={styles.strategyTag}>최종 산출물: 수익성 대시보드</span>
                  </div>
                </div>
              </div>

              {/* 데이터 소스 매트릭스 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>데이터 소스 · 역할 분담</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>분석 항목</th>
                        <th>TJ님 제공</th>
                        <th>솔루션 API 교차 검증</th>
                        <th>분석 주체</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["상품별 원가", "원두 원가, 포장비, 로스팅 비용 엑셀", "-", "Claude Code"],
                        ["월 고정비", "인건비, 임대료, 장비 감가", "-", "Claude Code"],
                        ["배송비/PG수수료", "PG 수수료율, 평균 배송비", "Toss store=coffee (수수료 역산)", "Claude Code"],
                        ["상품별 매출", "-", "PlayAuto 상품 그룹별 매출 (확보됨)", "Claude Code"],
                        ["가격대별 수요", "-", "Toss 가격대 분포 (확보됨)", "Claude Code"],
                        ["광고비 (Meta)", "Meta Ads Manager export", "향후 Meta API 연동 (Phase 5)", "Claude Code"],
                        ["광고비 (네이버/카카오)", "각 광고 플랫폼 리포트", "-", "Claude Code"],
                        ["전환 데이터", "-", "GA4 (권한 확보 후) + Toss + PlayAuto", "Claude Code"],
                        ["고객 LTV", "-", "아임웹 API (키 확보됨) + PlayAuto", "Claude Code"],
                      ].map((row, i) => (
                        <tr key={i} className={styles.tableRow}>
                          <td><strong>{row[0]}</strong></td>
                          <td>{row[1]}</td>
                          <td>{row[2]}</td>
                          <td>{row[3]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 분석 로드맵 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>분석 로드맵</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { label: "Step 1", value: "원가 자료 수집", sub: "TJ님이 상품별 원가/포장비/배송비/PG수수료 제공" },
                    { label: "Step 2", value: "공헌이익 산출", sub: "상품별 매출(PlayAuto) - 변동비 = 공헌이익률" },
                    { label: "Step 3", value: "광고비 ROAS", sub: "TJ님 광고비 + GA4/Toss 전환 교차 → 채널별 ROAS/CAC" },
                    { label: "Step 4", value: "통합 대시보드", sub: "원가/이익/ROAS를 한 화면에 → 최적 가격/채널 판단" },
                  ].map((step) => (
                    <div key={step.label} className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>{step.label}</span>
                      <strong className={styles.kpiValue}>{step.value}</strong>
                      <span className={styles.kpiSub}>{step.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.interpretBlock} style={{ marginTop: 18 }}>
                <strong>최종 목표</strong>: &quot;어떤 원두를, 어떤 가격에, 어떤 채널로, 어떤 고객에게 팔 때 가장 이익이 남는가?&quot;
                이 질문에 데이터로 답하는 것. 현재는 매출과 재구매율까지 보이는 상태이고,
                원가/판관비/광고비가 추가되면 <strong>순이익 관점의 의사결정</strong>이 가능해진다.
              </div>
            </div>

            {/* ═══ PROMETHEUS AI Agent 활용 계획 ═══ */}
            <div className={styles.section} style={{ borderTop: "3px solid #8b5cf6" }}>
              <h2 className={styles.sectionTitle}>PROMETHEUS AI Agent 활용 계획</h2>
              <p className={styles.sectionDesc}>
                커피 가격정책/마케팅 시뮬레이션에서 4개 전문 에이전트가 각각 담당하는 역할.
                참고: <code>callagent.md</code>
              </p>

              <div className={styles.strategyGrid}>
                {/* 아테나 */}
                <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
                  <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>A</div>
                  <div>
                    <strong>아테나 (ATHENA) — 전략 두뇌</strong>
                    <p style={{ marginBottom: 8 }}>
                      &quot;지금 커피 사업에서 가장 큰 문제가 무엇인가?&quot;를 판단한다.
                    </p>
                    <p><strong>커피 가격정책에서 하는 일:</strong></p>
                    <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.7 }}>
                      <li>상품별 공헌이익률을 읽고 <strong>&quot;콜롬비아가 매출 1위이지만 이익 1위인지&quot;</strong> 판정</li>
                      <li>가격 인상 A/B 실험 결과가 나오면 <strong>&quot;인상 유지 vs 철회&quot;</strong> 의사결정 근거 분해</li>
                      <li>1회 이탈 78.3%를 줄이는 것 vs VIP 유지 중 <strong>어디에 먼저 투자할지</strong> 우선순위 산정</li>
                      <li>매주 &quot;이번 주 커피 사업 Top 3 기회&quot;를 자동 생성</li>
                    </ul>
                    <span className={styles.strategyTag}>입력: 원가 데이터 + 쿠폰 실험 결과 + 코호트</span>
                  </div>
                </div>

                {/* 아폴론 */}
                <div className={styles.strategyCard} style={{ borderLeftColor: "#3b82f6" }}>
                  <div className={styles.strategyRank} style={{ background: "#3b82f6" }}>B</div>
                  <div>
                    <strong>아폴론 (APOLLO) — 예측 엔진</strong>
                    <p style={{ marginBottom: 8 }}>
                      &quot;앞으로 무엇이 일어날 가능성이 큰가?&quot;를 예측한다.
                    </p>
                    <p><strong>커피 마케팅 시뮬레이션에서 하는 일:</strong></p>
                    <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.7 }}>
                      <li>가격 5% 인상 시 <strong>판매량 감소 폭</strong>을 Toss 가격대 분포 + 쿠폰 실험 결과로 시뮬레이션</li>
                      <li>15% 쿠폰 실험 9개 variant의 <strong>30일 후 예상 전환율</strong>을 과거 재구매 간격 데이터로 예측</li>
                      <li>월별 코호트 재구매율 추세에서 <strong>다음 분기 재구매율 예측</strong></li>
                      <li>정기구독 전환 캠페인 시 <strong>예상 구독자 수와 MRR(월간반복매출) 증가분</strong> 시뮬레이션</li>
                      <li>VIP 383명 중 <strong>이탈 위험 고객</strong>을 최근 주문 간격 이상으로 조기 감지</li>
                    </ul>
                    <span className={styles.strategyTag}>입력: PlayAuto 재구매 간격 + Toss 가격대 + 코호트 추이</span>
                  </div>
                </div>

                {/* 플루토스 */}
                <div className={styles.strategyCard} style={{ borderLeftColor: "#F59E0B" }}>
                  <div className={styles.strategyRank} style={{ background: "#F59E0B" }}>C</div>
                  <div>
                    <strong>플루토스 (PLUTUS) — 매출/이익 엔진</strong>
                    <p style={{ marginBottom: 8 }}>
                      &quot;무엇이 실제로 돈을 남기는가?&quot;를 계산한다.
                    </p>
                    <p><strong>커피 원가/이익 분석에서 하는 일:</strong></p>
                    <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.7 }}>
                      <li>TJ님이 제공한 원가 + Toss 매출을 조합하여 <strong>상품별 순이익</strong> 산출</li>
                      <li>쿠폰 15% 할인의 <strong>마진 영향</strong> 계산: 객단가 31,000원 × 15% = 4,650원 할인 → 전환율 몇 %p 이상이어야 이익인지</li>
                      <li>채널별 ROAS: TJ님 광고비 + GA4/Toss 전환 데이터를 <strong>교차 검증</strong>하여 실제 ROAS 산출</li>
                      <li>고객 세그먼트별 <strong>LTV vs CAC</strong>: 어떤 채널에서 온 고객이 장기적으로 가장 이익인지</li>
                      <li>손익분기 분석: 현재 월 매출 1,400~1,600만원이 <strong>월 고정비를 넘기는지</strong> 판정</li>
                    </ul>
                    <span className={styles.strategyTag}>입력: TJ 원가/광고비 + 솔루션 Toss/PlayAuto/GA4</span>
                  </div>
                </div>

                {/* 헤르메스 */}
                <div className={styles.strategyCard} style={{ borderLeftColor: "#10B981" }}>
                  <div className={styles.strategyRank} style={{ background: "#10B981" }}>D</div>
                  <div>
                    <strong>헤르메스 (HERMES) — 실행/발송 엔진</strong>
                    <p style={{ marginBottom: 8 }}>
                      &quot;누구에게 어떤 메시지를 언제 보내는가?&quot;를 실행한다.
                    </p>
                    <p><strong>커피 CRM 실행에서 하는 일:</strong></p>
                    <ul style={{ paddingLeft: 18, fontSize: "0.78rem", lineHeight: 1.7 }}>
                      <li>15% 쿠폰 실험: 9개 variant별로 <strong>알리고 알림톡을 예약 발송</strong> (D+14, D+17, D+21)</li>
                      <li>VIP 이탈 감지 시 <strong>자동 윈백 메시지</strong> 발송 (아폴론이 감지 → 헤르메스가 발송)</li>
                      <li>정기구독 전환 캠페인: 3회+ 구매 고객에게 <strong>구독 안내 알림톡</strong> 발송</li>
                      <li>쿠폰 코드 생성/추적: 발급 → 사용 → <strong>crm_local에 자동 로그</strong></li>
                      <li>발송 결과를 <code>/crm</code> 알림톡 탭에서 <strong>실시간 확인</strong></li>
                    </ul>
                    <span className={styles.strategyTag}>실행: 알리고 API + crm-local + /crm 대시보드</span>
                  </div>
                </div>
              </div>

              {/* 에이전트 협업 흐름 */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}>에이전트 협업 흐름 (예: 가격 인상 판단)</h3>
                <div className={styles.kpiGrid}>
                  {[
                    { label: "1. 플루토스", value: "이익 계산", sub: "에티오피아 원가 + 현재가 → 공헌이익률 산출. 5% 인상 시 이익 변화 시뮬레이션" },
                    { label: "2. 아폴론", value: "수요 예측", sub: "Toss 가격대 분포 + 재구매율로 5% 인상 시 판매량 감소 폭 예측" },
                    { label: "3. 아테나", value: "의사결정", sub: "이익 증가 > 판매량 감소이면 인상 권고. 아니면 다른 상품부터 테스트 제안" },
                    { label: "4. 헤르메스", value: "테스트 실행", sub: "인상 결정 시 쿠폰 A/B로 실행. 결과를 다시 플루토스에 피드백" },
                  ].map((step) => (
                    <div key={step.label} className={styles.kpiCard}>
                      <span className={styles.kpiLabel}>{step.label}</span>
                      <strong className={styles.kpiValue}>{step.value}</strong>
                      <span className={styles.kpiSub}>{step.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.interpretBlock} style={{ marginTop: 18 }}>
                <strong>현재 상태</strong>: 아직 4개 에이전트가 자동으로 돌아가는 상태는 아니다.
                지금은 <strong>Claude Code가 분석가 역할</strong>로 위 에이전트들의 사고 과정을 수동으로 수행하고 있다.
                원가/광고비 자료가 확보되면 각 에이전트의 로직을 <strong>코드로 자동화</strong>하여,
                매주 &quot;커피 사업 Top 3 기회 + Top 3 리스크&quot;를 자동 생성하는 것이 목표.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
