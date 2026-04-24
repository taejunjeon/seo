"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "../coupon/page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const fmtKRW = (v: number): string => {
  if (!v || v === 0) return "₩0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const rest = abs % 100_000_000;
    const man = Math.round(rest / 10_000);
    return `${sign}₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

type Monthly = {
  ym: string;
  biocom: number;
  teamketo: number;
  biocom_gross: number;
  teamketo_gross: number;
  weekly: number;
  reserve: number;
  rows: number;
};
type Kpi = {
  total_final: number;
  total_gross: number;
  total_fee: number;
  biocom_total: number;
  teamketo_total: number;
  rows: number;
};
type TransferRow = {
  vendor_id: string;
  before_total: number;
  before_months: number;
  after_total: number;
  after_months: number;
};
type TypeRow = { type: string; cnt: number; total: number };
type RecentRow = {
  vendor_id: string;
  settlement_date: string;
  settlement_type: string;
  recognition_year_month: string;
  recognition_date_from: string;
  recognition_date_to: string;
  total_sale: number;
  final_amount: number;
  status: string;
};
type ProductRow = { product_name: string; orders: number; qty: number; rev: number };
type BrandRow = { ym: string; channel: string; project: string; net: number; rows: number };
type ChannelTotal = { channel: string; net: number; rows: number };
type DashboardData = {
  ok: boolean;
  queryDate: string;
  note: {
    transfer_month: string;
    transfer_description: string;
    rocket_growth: string;
    top_products_source: string;
    brand_breakdown_source?: string;
    brand_breakdown_coverage?: string;
  };
  kpi: Kpi;
  monthly: Monthly[];
  transferPivot: TransferRow[];
  typeDist: TypeRow[];
  recent: RecentRow[];
  topProducts: ProductRow[];
  brandBreakdown?: BrandRow[];
  channelTotals?: ChannelTotal[];
};

const CHANNEL_LABEL: Record<string, string> = {
  coupang_3p: "3P 마켓플레이스",
  coupang_rg: "로켓그로스",
};
const CHANNEL_COLOR: Record<string, string> = {
  coupang_3p: "#0D9488",
  coupang_rg: "#f97316",
};
const PROJECT_COLOR: Record<string, string> = {
  "커피": "#f59e0b",
  "영양제": "#0D9488",
  "펫_영양제 외": "#60a5fa",
  "미분류": "#94a3b8",
};

const VENDOR_LABEL: Record<string, string> = {
  A00668577: "BIOCOM",
  A00963878: "TEAMKETO",
};

const CATEGORY_PATTERNS = [
  { label: "커피", re: /커피|콜롬비아|에티오피아|과테말라|케냐|디카페인|드립백|원두|수프레모|예가체프|더클린/ },
  { label: "건기식", re: /뉴로마스터|바이오밸런스|당당케어|썬화이버|메타드림|다래케어|풍성밸런스|클린밸런스|멜라토닌|오메가|마그네슘|프로바이오|구아검/ },
];
const classify = (name: string): string => {
  for (const c of CATEGORY_PATTERNS) if (c.re.test(name)) return c.label;
  return "기타";
};

export default function CoupangPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/coupang/dashboard`)
      .then((r) => r.json())
      .then((d: DashboardData) => setData(d))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div style={{ padding: 40 }}>⚠️ {err}</div>;
  if (!data) return <div style={{ padding: 40 }}>로딩…</div>;

  const monthly = data.monthly;
  const biocomTransfer = data.transferPivot.find((r) => r.vendor_id === "A00668577");
  const teamketoTransfer = data.transferPivot.find((r) => r.vendor_id === "A00963878");

  // 월별 추이를 4개 series 로 분리
  // - biocom_3p / teamketo_3p: coupang_settlements_api (3P only, 16개월)
  // - biocom_rg: tb_sales_coupang channel='coupang_rg' (현재 2026-01 만 · 상품명 전부 BIOCOM 건기식)
  // - teamketo_rg: 미업로드 (Wing 로켓그로스 엑셀 업로드 대기)
  const bb = data.brandBreakdown ?? [];
  const rgByYm = new Map<string, number>();
  for (const r of bb) {
    if (r.channel === "coupang_rg") rgByYm.set(r.ym, (rgByYm.get(r.ym) ?? 0) + r.net);
  }
  const monthlyChannel = monthly.map((m) => ({
    ym: m.ym,
    biocom_3p: m.biocom,
    biocom_rg: rgByYm.get(m.ym) ?? 0,
    teamketo_3p: m.teamketo,
    teamketo_rg: 0,
  }));

  // 특이사항 자동 추출: 평균의 1.8배 이상
  const nonZero = monthly.filter((m) => m.biocom + m.teamketo > 0);
  const avg = nonZero.reduce((s, m) => s + m.biocom + m.teamketo, 0) / Math.max(1, nonZero.length);
  const spikes = monthly.filter((m) => m.biocom + m.teamketo > avg * 1.8);

  // Top5 상품 (revenue 내림차순 5개) + 카테고리 분류
  const top5 = data.topProducts.slice(0, 5).map((p) => ({ ...p, category: classify(p.product_name) }));
  const topChartData = data.topProducts.slice(0, 10).map((p) => ({
    name: p.product_name.slice(0, 30) + (p.product_name.length > 30 ? "…" : ""),
    rev: p.rev,
    category: classify(p.product_name),
  }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>
              ← 대시보드로 돌아가기
            </Link>
            <h1 className={styles.headerTitle}>쿠팡 매출 대시보드</h1>
            <p className={styles.headerSub}>
              BIOCOM + TEAMKETO · 2025-01 ~ 2026-04 정산 원장 · 쿠팡 Open API settlement-histories 기반 · 106건 백필
            </p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 데이터 소스 배너 */}
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: "linear-gradient(90deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))",
            border: "1px solid rgba(245,158,11,0.3)",
            fontSize: "0.82rem",
            color: "var(--color-text-secondary)",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <strong style={{ color: "#b45309" }}>📊 데이터</strong>: coupang_settlements_api {data.kpi.rows}건 · 16개월
          </div>
          <div>
            <strong style={{ color: "#b45309" }}>⏰ 최종 sync</strong>:{" "}
            {new Date(data.queryDate).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(139,92,246,0.1)",
              color: "#6d28d9",
              fontWeight: 600,
            }}
          >
            🔄 이관 시점: {data.note.transfer_month}
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(249,115,22,0.1)",
              color: "#c2410c",
              fontWeight: 600,
            }}
          >
            🚀 로켓그로스: 공식 API 부재 · 수동 업로드분만 집계 (2026-01)
          </div>
        </div>

        {/* KPI 4카드 */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>16개월 총 지급액 (finalAmount)</span>
            <strong className={styles.kpiValue}>{fmtKRW(data.kpi.total_final)}</strong>
            <span className={styles.kpiSub}>총 판매액 {fmtKRW(data.kpi.total_gross)} 중 실 입금</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>BIOCOM 누적</span>
            <strong className={styles.kpiValue}>{fmtKRW(data.kpi.biocom_total)}</strong>
            <span className={styles.kpiSub}>건기식 + 커피 (이관 전) + 건기식 (이관 후)</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>TEAMKETO 누적</span>
            <strong className={styles.kpiValue}>{fmtKRW(data.kpi.teamketo_total)}</strong>
            <span className={styles.kpiSub}>2026-02 부터 등장 · 더클린커피 이관 이후</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>쿠팡 수수료 누적</span>
            <strong className={styles.kpiValue}>{fmtKRW(data.kpi.total_fee)}</strong>
            <span className={styles.kpiSub}>수수료율 {((data.kpi.total_fee / data.kpi.total_gross) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* 월별 추이 차트 + 이관 시점 세로선 (4 series stack) */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>월별 매출 추이 · 4 채널 분리</h2>
          <p className={styles.sectionDesc}>
            BIOCOM 3P · BIOCOM 로켓그로스 · TEAMKETO 3P · TEAMKETO 로켓그로스 스택 바 ·{" "}
            <strong>2026-02</strong> 이관 시점 세로선
            {" · "}
            <strong style={{ color: "#c2410c" }}>
              로켓그로스 커버리지: BIOCOM 2026-01 1개월 (수동 업로드) · TEAMKETO 미업로드
            </strong>
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={monthlyChannel} margin={{ left: 16, right: 16, top: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="ym" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => fmtKRW(Number(v))} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtKRW(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                x={data.note.transfer_month}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{
                  value: "더클린커피 사업부 이관",
                  position: "insideTopRight",
                  fill: "#991b1b",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
              <Bar dataKey="biocom_3p" name="BIOCOM 3P" stackId="v" fill="#0D9488" />
              <Bar dataKey="biocom_rg" name="BIOCOM 로켓그로스" stackId="v" fill="#2dd4bf" />
              <Bar dataKey="teamketo_3p" name="TEAMKETO 3P" stackId="v" fill="#8b5cf6" />
              <Bar dataKey="teamketo_rg" name="TEAMKETO 로켓그로스" stackId="v" fill="#c4b5fd" />
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>읽는 법</strong>: 진한 색 = 3P 마켓플레이스 (정산 API 전수) · 연한 색 = 로켓그로스 (수동 업로드분만 · 공식 정산 API 없음). 2026-01 BIOCOM 로켓그로스 ₩32.17M 이 같은 달 3P ₩7.46M 의 4배 규모. TEAMKETO 로켓그로스는 Wing 엑셀 업로드 대기 중이라 0 으로 표시됨.
          </div>
        </div>

        {/* 이관 전/후 비교 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>이관 전/후 비교 (경계 · 2026-02)</h2>
          <p className={styles.sectionDesc}>더클린커피 사업부가 BIOCOM → TEAMKETO 로 이관되면서 매출 축이 바뀜</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>Vendor</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>이관 전 누적 (finalAmount)</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>이관 전 월평균</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>이관 후 누적</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>이관 후 월평균</th>
                  <th style={{ padding: "10px 8px" }}>해석</th>
                </tr>
              </thead>
              <tbody>
                {[biocomTransfer, teamketoTransfer].map((t) => {
                  if (!t) return null;
                  const name = VENDOR_LABEL[t.vendor_id] ?? t.vendor_id;
                  const bAvg = t.before_months ? Math.round(t.before_total / t.before_months) : 0;
                  const aAvg = t.after_months ? Math.round(t.after_total / t.after_months) : 0;
                  const interp =
                    t.vendor_id === "A00668577"
                      ? `건기식+커피 → 건기식 only (월 평균 ${bAvg ? Math.round((aAvg / bAvg) * 100) : 0}% 수준으로 축소)`
                      : `0 → 신규 매출 등장 (월 평균 ${fmtKRW(aAvg)})`;
                  return (
                    <tr key={t.vendor_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>{name}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>{fmtKRW(t.before_total)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--color-text-muted)" }}>
                        {fmtKRW(bAvg)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>{fmtKRW(t.after_total)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--color-text-muted)" }}>
                        {fmtKRW(aAvg)}
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: "0.82rem" }}>{interp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>해석</strong>: {data.note.transfer_description}
          </div>
        </div>

        {/* 채널별·브랜드별 매출 (tb_sales_coupang 수동 업로드 · 3개월 한정) */}
        {data.brandBreakdown && data.brandBreakdown.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>채널 × 브랜드 매출 (수동 업로드 구간 · 2026-01 ~ 03)</h2>
            <p className={styles.sectionDesc}>
              {data.note.brand_breakdown_source ?? "tb_sales_coupang"}
              {" · "}
              커버리지: {data.note.brand_breakdown_coverage ?? "2026-01~03"}
              {" · "}
              <strong>주의</strong>: 정산 ₩{Math.round(data.kpi.total_final / 1_000_000)}M 는 3P 만 포함 · 로켓그로스는 공식 Open API endpoint 부재로 수동 업로드한 2026-01 한 달만 확인
            </p>

            {/* 채널 전체 누적 비교 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
              {(data.channelTotals ?? []).map((c) => (
                <div
                  key={c.channel}
                  style={{
                    padding: "16px 20px",
                    borderRadius: 10,
                    background: c.channel === "coupang_rg" ? "rgba(249,115,22,0.06)" : "rgba(13,148,136,0.05)",
                    borderLeft: `4px solid ${CHANNEL_COLOR[c.channel] ?? "#94a3b8"}`,
                  }}
                >
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
                    {CHANNEL_LABEL[c.channel] ?? c.channel}
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4 }}>{fmtKRW(c.net)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    {fmtNum(c.rows)}건 · 2026-01 기준
                  </div>
                </div>
              ))}
            </div>

            {/* 월 × 채널 × 브랜드 피벗 테이블 */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "10px 8px" }}>월</th>
                    <th style={{ padding: "10px 8px" }}>채널</th>
                    <th style={{ padding: "10px 8px" }}>브랜드</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>순매출 (환불 차감 후)</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.brandBreakdown.map((b, i) => (
                    <tr key={`${b.ym}-${b.channel}-${b.project}-${i}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 600 }}>{b.ym}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: b.channel === "coupang_rg" ? "rgba(249,115,22,0.15)" : "rgba(13,148,136,0.12)",
                            color: b.channel === "coupang_rg" ? "#9a3412" : "#0f766e",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          {CHANNEL_LABEL[b.channel] ?? b.channel}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: `${PROJECT_COLOR[b.project] ?? "#94a3b8"}22`,
                            color: PROJECT_COLOR[b.project] ?? "#475569",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          {b.project}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{fmtKRW(b.net)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--color-text-muted)" }}>{fmtNum(b.rows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
              <strong>인사이트</strong>: 2026-01 기준 3P 마켓플레이스 ₩10.93M 중 커피가 ₩9.46M (87%). 이게 2026-02 엔 ₩2M 로 −79% 급감 → 커피 사업부가 BIOCOM 3P 에서 빠져나간 증거. 로켓그로스 ₩32.17M (2026-01) 은 BIOCOM 계정 건기식 (썬화이버 · 바이오밸런스 · 클린밸런스 등) 이 대부분.
            </div>
          </div>
        )}

        {/* 특이사항 · 매출 스파이크 월 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>특이사항 · 월별 스파이크 자동 탐지</h2>
          <p className={styles.sectionDesc}>비제로 월 평균({fmtKRW(avg)}) 의 1.8 배 이상인 월</p>
          <div style={{ display: "grid", gap: 10 }}>
            {spikes.length === 0 && <div style={{ color: "var(--color-text-muted)" }}>스파이크 없음</div>}
            {spikes.map((m) => (
              <div
                key={m.ym}
                style={{
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.04)",
                  borderLeft: "4px solid #ef4444",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                    📈 {m.ym} · {fmtKRW(m.biocom + m.teamketo)} (평균 대비{" "}
                    {((m.biocom + m.teamketo) / Math.max(avg, 1)).toFixed(1)}x)
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
                    BIOCOM {fmtKRW(m.biocom)} · TEAMKETO {fmtKRW(m.teamketo)}
                  </div>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                  {m.rows}건 · 추정: 쿠팡 프로모션·기획전 · 대량 구매건 · 수동 확인 필요
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOP 상품 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>TOP 상품 · 최근 2개월 (BIOCOM 건기식)</h2>
          <p className={styles.sectionDesc}>
            {data.note.top_products_source}
            {" · "}
            TEAMKETO 커피 상품 목록은 별도 백필 필요 (Phase 2)
          </p>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={topChartData} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtKRW(Number(v))} />
              <YAxis type="category" dataKey="name" width={240} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmtKRW(Number(v))} />
              <Bar dataKey="rev" name="매출">
                {topChartData.map((r, i) => (
                  <Cell
                    key={i}
                    fill={r.category === "커피" ? "#f59e0b" : r.category === "건기식" ? "#0D9488" : "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 8 }}>Top 5 상세</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>순위</th>
                  <th style={{ padding: "8px" }}>상품명</th>
                  <th style={{ padding: "8px" }}>카테고리</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>주문수</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>수량</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>매출</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: "8px" }}>{p.product_name}</td>
                    <td style={{ padding: "8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 9999,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: p.category === "커피" ? "rgba(245,158,11,0.12)" : "rgba(13,148,136,0.12)",
                          color: p.category === "커피" ? "#b45309" : "#065f46",
                        }}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtNum(p.orders)}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtNum(p.qty)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{fmtKRW(p.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* settlement_type 분포 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>정산 유형 분포</h2>
          <p className={styles.sectionDesc}>
            WEEKLY = 주정산 (70%) · RESERVE = 월말 최종액정산 (30%) · 로켓그로스는 별도 미연동
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.typeDist}
                  dataKey="cnt"
                  nameKey="type"
                  outerRadius={70}
                  label={(entry) => {
                    const p = entry as { type?: string; cnt?: number };
                    return `${p.type ?? ""} ${p.cnt ?? 0}`;
                  }}
                >
                  {data.typeDist.map((r, i) => (
                    <Cell key={i} fill={r.type === "WEEKLY" ? "#0D9488" : "#8b5cf6"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>유형</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>건수</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>finalAmount 합</th>
                </tr>
              </thead>
              <tbody>
                {data.typeDist.map((r) => (
                  <tr key={r.type} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px", fontWeight: 700 }}>{r.type}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtNum(r.cnt)}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtKRW(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 수수료율 추이 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>수수료율 · 월별 매출 대비</h2>
          <p className={styles.sectionDesc}>serviceFee / totalSale (%) · 쿠팡이 가져가는 비중</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={monthly.map((m) => ({
                ym: m.ym,
                pct:
                  m.biocom_gross + m.teamketo_gross > 0
                    ? Math.round(((m.biocom_gross + m.teamketo_gross - (m.biocom + m.teamketo)) / (m.biocom_gross + m.teamketo_gross)) * 1000) / 10
                    : 0,
              }))}
              margin={{ left: 16, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="ym" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => `${Number(v)}%`} />
              <Line type="monotone" dataKey="pct" stroke="#ef4444" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 최근 10건 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>최근 정산 10건</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>정산일</th>
                  <th style={{ padding: "8px" }}>Vendor</th>
                  <th style={{ padding: "8px" }}>유형</th>
                  <th style={{ padding: "8px" }}>구매확정기간</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>총판매</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>최종지급</th>
                  <th style={{ padding: "8px" }}>status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{r.settlement_date}</td>
                    <td style={{ padding: "8px" }}>{VENDOR_LABEL[r.vendor_id] ?? r.vendor_id}</td>
                    <td style={{ padding: "8px" }}>{r.settlement_type}</td>
                    <td style={{ padding: "8px" }}>
                      {r.recognition_date_from}~{r.recognition_date_to}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>{fmtKRW(r.total_sale)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{fmtKRW(r.final_amount)}</td>
                    <td style={{ padding: "8px" }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 한계·운영 안내 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>한계·운영 안내</h2>
          <ul style={{ paddingLeft: 20, fontSize: "0.85rem", lineHeight: 1.8 }}>
            <li>
              <strong>로켓그로스 정산</strong>: {data.note.rocket_growth}
            </li>
            <li>
              <strong>상품별 매출</strong>: {data.note.top_products_source}
            </li>
            <li>
              <strong>finalAmount 해석</strong>: 쿠팡 Wing UI &quot;최종지급액&quot; 과 100% 일치 확인 완료 (TEAMKETO 2026-04 7건 / ₩7,252,827)
            </li>
            <li>
              <strong>상품 카테고리 분류</strong>: 상품명 ILIKE 키워드 매칭 · 커피(콜롬비아/에티오피아/드립백/원두 등) / 건기식(뉴로마스터/바이오밸런스/썬화이버 등) / 기타
            </li>
            <li>
              <strong>다음 단계</strong>: Phase 2 상품 단위 백필 (ordersheets API) · Phase 3 로켓그로스 별도 endpoint 확보
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
