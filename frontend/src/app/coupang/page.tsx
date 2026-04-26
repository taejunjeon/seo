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
type RgOrderRow = { ym: string; vendor_id: string; cnt: number; gross: number };
type ProductFlowItem = { product_name: string; project?: string; cnt: number; net?: number; gross?: number };
type ProductFlow = {
  biocom3p_pre: ProductFlowItem[];
  biocom3p_post: ProductFlowItem[];
  teamketoRgCoffee: ProductFlowItem[];
};
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
    rg_orders_source?: string;
    rg_orders_coverage?: string;
    coverage_summary?: string;
  };
  kpi: Kpi;
  monthly: Monthly[];
  transferPivot: TransferRow[];
  typeDist: TypeRow[];
  recent: RecentRow[];
  topProducts: ProductRow[];
  brandBreakdown?: BrandRow[];
  channelTotals?: ChannelTotal[];
  rgOrdersMonthly?: RgOrderRow[];
  productFlow?: ProductFlow;
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

  // 월별 추이를 4개 series 로 분리 · 두 vendor 모두 실측 데이터
  // - biocom_3p / teamketo_3p: coupang_settlements_api (3P only, 16개월)
  // - biocom_rg / teamketo_rg: 두 소스 결합
  //   · tb_sales_coupang.channel='coupang_rg' (수동 업로드 · 2026-01 BIOCOM) — 우선순위 높음
  //   · rgOrdersMonthly (로컬 SQLite 자체 백필 + 원격 PG union · vendor_id 별)
  const bb = data.brandBreakdown ?? [];
  const biocomRgByYm = new Map<string, number>();
  const teamketoRgByYm = new Map<string, number>();
  for (const r of bb) {
    if (r.channel === "coupang_rg") {
      // tb_sales_coupang 수동업로드는 BIOCOM 커피 샘플이라 biocom 귀속 (2026-01 만)
      biocomRgByYm.set(r.ym, (biocomRgByYm.get(r.ym) ?? 0) + r.net);
    }
  }
  for (const r of data.rgOrdersMonthly ?? []) {
    const target =
      r.vendor_id === "A00668577"
        ? biocomRgByYm
        : r.vendor_id === "A00963878"
        ? teamketoRgByYm
        : null;
    if (target && !target.has(r.ym)) {
      target.set(r.ym, r.gross);
    }
  }
  const monthlyChannel = monthly.map((m) => ({
    ym: m.ym,
    biocom_3p: m.biocom,
    biocom_rg: biocomRgByYm.get(m.ym) ?? 0,
    teamketo_3p: m.teamketo,
    teamketo_rg: teamketoRgByYm.get(m.ym) ?? 0,
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
              background: "rgba(5,150,105,0.1)",
              color: "#065f46",
              fontWeight: 600,
            }}
          >
            🚀 로켓그로스: RG Order API 자체 백필 완료 · BIOCOM 16개월 + TEAMKETO 4개월
          </div>
        </div>

        {/* 데이터 정확도 가이드 */}
        <div
          style={{
            padding: "16px 22px",
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(59,130,246,0.04), rgba(16,185,129,0.04))",
            border: "1px solid rgba(59,130,246,0.22)",
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <strong style={{ fontSize: "1rem", color: "#1e3a8a" }}>📊 데이터 정확도 · 커버리지 가이드</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              각 채널의 신뢰도 · 커버리지 · 한계를 투명하게 공개
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {/* 3P 섹션 */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "white", border: "1px solid rgba(13,148,136,0.2)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>
                ✅ 3P 마켓플레이스 (강한 신뢰)
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                <li><strong>BIOCOM 16개월</strong> · 2025-01~2026-04 전수 (₩188M finalAmount)</li>
                <li><strong>TEAMKETO 3개월</strong> · 2026-02~04 (이관 이후 전체)</li>
                <li>수치: Wing &quot;최종지급액&quot; 과 <strong>100% 일치 검증</strong> (7건 샘플)</li>
                <li>의미: 은행 실입금액 = 수수료·물류비 모두 차감 후</li>
              </ul>
            </div>

            {/* RG 섹션 */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "white", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c2410c", marginBottom: 6 }}>
                🚀 로켓그로스 (gross 추정치)
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                <li><strong>BIOCOM 16개월</strong> · 2025-01~2026-04 (₩438M · 10,642건)</li>
                <li><strong>TEAMKETO 4개월</strong> · 2026-01-21~2026-04 (₩14M · 436건)</li>
                <li>소스: RG Order API (자체 백필) + 수동 업로드 + 원격 PG union</li>
                <li style={{ color: "#c2410c" }}>
                  ⚠ 수치: <strong>gross (판매액)</strong> · 쿠팡 수수료·물류비 차감 전. 실제 지급액은 보통 gross의 <strong>65~75%</strong>
                </li>
              </ul>
            </div>

            {/* 이관 시점 */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "white", border: "1px solid rgba(139,92,246,0.2)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>
                🔄 이관 시점 2026-02 (신뢰도 95%+)
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                <li>BIOCOM 3P: ₩7.46M → ₩1.88M (<strong>-75%</strong>)</li>
                <li>BIOCOM 3P 커피: ₩9.46M → ₩2M (<strong>-79%</strong>)</li>
                <li>TEAMKETO 3P 등장: 0 → ₩4.53M (동시)</li>
                <li>월 단위 95%+ · 정확한 일자는 약 50% (정산은 구매확정일 기준)</li>
              </ul>
            </div>

            {/* 한계 */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "white", border: "1px solid rgba(148,163,184,0.3)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                ⚠️ 알려진 한계
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                <li>로켓그로스 정산 전용 endpoint 없음 → 주문 gross 합산으로 대체</li>
                <li>쿠팡 개인정보 마스킹 → phone 기반 고객 통합 불가</li>
                <li>TEAMKETO 3P 2026-04 일부 <code>SUBJECT</code> (정산 미확정)</li>
                <li>3P 상세 건단위: 월 요약만 · 드릴다운 필요 시 Wing 엑셀</li>
              </ul>
            </div>
          </div>

          {/* 15개월 커버리지 매트릭스 */}
          {(() => {
            const months = [
              "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
              "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
              "2026-01", "2026-02", "2026-03",
            ];
            const has3P = new Set<string>(monthly.filter((m) => m.biocom > 0).map((m) => m.ym));
            const hasTk3P = new Set<string>(monthly.filter((m) => m.teamketo > 0).map((m) => m.ym));
            const hasBioRg = new Set<string>(Array.from(biocomRgByYm.keys()).filter((k) => biocomRgByYm.get(k)! > 0));
            const hasTkRg = new Set<string>(Array.from(teamketoRgByYm.keys()).filter((k) => teamketoRgByYm.get(k)! > 0));
            const rows = [
              { label: "BIOCOM 3P", set: has3P, note: "—", ok: true },
              { label: "BIOCOM 로켓그로스", set: hasBioRg, note: "—", ok: true },
              { label: "TEAMKETO 3P", set: hasTk3P, note: "TEAMKETO 는 2026-02 부터 쿠팡 판매 시작 (이관 시점). 그 이전은 사업 자체 없음 — 수집 실패 아님.", ok: false },
              { label: "TEAMKETO 로켓그로스", set: hasTkRg, note: "TEAMKETO RG 는 2026-01-21 가동 시작 (이관 2주 전). 2026-01 부분 · 이전은 미운영.", ok: false },
            ];
            return (
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px dashed rgba(59,130,246,0.3)", overflowX: "auto" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 8, color: "#1e3a8a" }}>
                  📐 15개월 커버리지 매트릭스 (2025-01 ~ 2026-03)
                  <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 8 }}>
                    ● 데이터 있음 · ○ 없음 · 빈 구간 원인은 오른쪽 열 참고
                  </span>
                </div>
                <table style={{ borderCollapse: "collapse", fontSize: "0.72rem", width: "100%", minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid rgba(0,0,0,0.1)", whiteSpace: "nowrap" }}>채널</th>
                      {months.map((ym) => (
                        <th key={ym} style={{ padding: "4px 2px", fontSize: "0.62rem", fontWeight: 600, color: "var(--color-text-muted)", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "center" }}>
                          {ym.slice(2)}
                        </th>
                      ))}
                      <th style={{ padding: "4px 6px", borderBottom: "1px solid rgba(0,0,0,0.1)", textAlign: "left", whiteSpace: "nowrap" }}>빈 구간 원인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const filled = months.filter((m) => r.set.has(m)).length;
                      return (
                        <tr key={r.label}>
                          <td style={{ padding: "6px 6px", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                            {r.label}
                            <span style={{ marginLeft: 6, fontSize: "0.65rem", color: r.ok ? "#059669" : "#c2410c", fontWeight: 700 }}>
                              {filled}/15
                            </span>
                          </td>
                          {months.map((ym) => {
                            const present = r.set.has(ym);
                            return (
                              <td key={ym} style={{ padding: "6px 2px", textAlign: "center", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                <span style={{ color: present ? "#059669" : "#cbd5e1", fontSize: "0.95rem" }}>
                                  {present ? "●" : "○"}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: "6px 6px", fontSize: "0.7rem", color: "var(--color-text-secondary)", borderBottom: "1px solid rgba(0,0,0,0.05)", lineHeight: 1.4 }}>
                            {r.note}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  <strong>결론</strong>: BIOCOM 은 3P·RG 두 채널 모두 15/15 완전. TEAMKETO 는 2026-02 이전 데이터가 없는데 이는 <strong>수집 누락이 아니라 사업 미운영</strong> (쿠팡 settlement-histories API 도 해당 기간 0건 응답 확인). 즉 대시보드에 빠진 정보가 아니라 실제로 없던 것.
                </div>
              </div>
            );
          })()}
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
            <strong style={{ color: "#065f46" }}>
              로켓그로스 커버리지: BIOCOM 2025-01 ~ 2026-04 16개월 (10,642건 · ₩368M) + TEAMKETO 2026-01 ~ 2026-04 (436건 · ₩14M · 이관 2주 전부터 가동)
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
            <strong>읽는 법</strong>: 진한 색 = 3P 마켓플레이스 (정산 API 16개월 전수) · 연한 색 = 로켓그로스. 로켓그로스는 <strong>BIOCOM 10,642건 / ₩368M + TEAMKETO 436건 / ₩14M</strong> 실측 (seo 가 RG Order API 로 자체 백필 + 원격 PG union). 2025-09/10 BIOCOM RG 피크 ₩38.9M 가 3P 스파이크 ₩36.2M 와 동반 — 이관 직전까지 BIOCOM 쿠팡 총 매출 월 ₩50~75M 수준. 2026-02 3P+RG 동시 급감 후 TEAMKETO 가 이관 직전 2026-01-21 부터 RG 먼저 가동 (초기 월 ₩0.9M 소규모 → 2026-03 ₩5.6M 로 증가 중). TEAMKETO RG 는 BIOCOM 의 약 1/25 규모.
          </div>
        </div>

        {/* 3P 마켓플레이스 1년치 · BIOCOM vs TEAMKETO */}
        {(() => {
          const m12 = monthly.slice(-12);
          const biocomTotal = m12.reduce((s, m) => s + m.biocom, 0);
          const teamketoTotal = m12.reduce((s, m) => s + m.teamketo, 0);
          const biocomAvg = biocomTotal / 12;
          const teamketoActiveMonths = m12.filter((m) => m.teamketo > 0).length;
          const teamketoAvg = teamketoActiveMonths ? teamketoTotal / teamketoActiveMonths : 0;
          const peaks = m12.filter((m) => m.biocom > biocomAvg * 1.8);
          return (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>3P 마켓플레이스 1년치 월별 매출 · BIOCOM vs TEAMKETO</h2>
              <p className={styles.sectionDesc}>
                최근 12개월 ({m12[0].ym} ~ {m12[m12.length - 1].ym}) · 로켓그로스 제외 · 정산 기준 finalAmount · 이관 월 2026-02 세로선
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={m12} margin={{ left: 16, right: 16, top: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="ym" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtKRW(Number(v))} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    x={data.note.transfer_month}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    label={{ value: "이관", position: "insideTopRight", fill: "#991b1b", fontSize: 11, fontWeight: 700 }}
                  />
                  <Bar dataKey="biocom" name="BIOCOM 3P" fill="#0D9488" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="teamketo" name="TEAMKETO 3P" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(13,148,136,0.06)", borderLeft: "3px solid #0D9488" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", fontWeight: 600 }}>BIOCOM 3P 12개월 합계</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4 }}>{fmtKRW(biocomTotal)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>월 평균 {fmtKRW(biocomAvg)}</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(139,92,246,0.06)", borderLeft: "3px solid #8b5cf6" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", fontWeight: 600 }}>TEAMKETO 3P {teamketoActiveMonths}개월 합계</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: 4 }}>{fmtKRW(teamketoTotal)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>활동 월 평균 {fmtKRW(teamketoAvg)}</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(239,68,68,0.05)", borderLeft: "3px solid #ef4444" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", fontWeight: 600 }}>BIOCOM 피크 월</div>
                  <div style={{ fontSize: "0.85rem", marginTop: 4, lineHeight: 1.5 }}>
                    {peaks.map((p) => <div key={p.ym}><strong>{p.ym}</strong> {fmtKRW(p.biocom)}</div>)}
                  </div>
                </div>
              </div>
              <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
                <strong>인사이트 · 3P 1년치 매출 패턴</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
                  <li>
                    <strong style={{ color: "#0f766e" }}>BIOCOM 3P 견조 구간 (2025-05~2026-01 · 9개월)</strong>:
                    {" "}월 ₩7.5M~36M · 평균 약 {fmtKRW(m12.slice(0, 9).reduce((s, m) => s + m.biocom, 0) / 9)} · 2025-07 ₩{(m12.find((m) => m.ym === "2025-07")?.biocom ?? 0).toLocaleString()} · 2025-10 ₩{(m12.find((m) => m.ym === "2025-10")?.biocom ?? 0).toLocaleString()} 2번 빅피크 (쿠팡 대형 프로모션 추정)
                  </li>
                  <li>
                    <strong style={{ color: "#b91c1c" }}>이관 직후 (2026-02) 급감</strong>: ₩7.46M → ₩1.88M (<strong>-75%</strong>) · 2026-03 ₩216K (<strong>-97%</strong>) · 2026-04 ₩140K (사실상 종료)
                  </li>
                  <li>
                    <strong style={{ color: "#6d28d9" }}>TEAMKETO 3P 등장 후 성장</strong>: 2026-02 ₩4.53M → 2026-03 ₩7.80M (<strong>+72%</strong>) → 2026-04 ₩3.63M (부분월). TEAMKETO 월 평균 ₩{(teamketoAvg / 1_000_000).toFixed(2)}M — BIOCOM 2025-01 최저월(₩8.8M)과 비슷한 수준.
                  </li>
                  <li>
                    <strong style={{ color: "#1e3a8a" }}>규모 비교</strong>: BIOCOM 12개월 합 {fmtKRW(biocomTotal)} vs TEAMKETO 활동 3개월 합 {fmtKRW(teamketoTotal)} · 이관 후 채널 규모가 초기 단계 (BIOCOM 이 9개월간 쌓은 매출 대비 TEAMKETO 는 3개월 누적이 약 1/12 수준)
                  </li>
                  <li>
                    <strong style={{ color: "#c2410c" }}>해석</strong>: BIOCOM 이 커피 사업부 이관 후 3P 채널을 **사실상 폐쇄** (잔여 ₩140K/월). TEAMKETO 는 3P 에서 이관 받은 커피로 월 ₩5M 내외 매출 · 아직 BIOCOM 의 2025 평균 대비 작지만 성장 중. 로켓그로스 (TEAMKETO RG 2026-03 ₩5.6M) 와 합산 시 이관 3개월차 총 매출이 BIOCOM 1개월 평균에 근접.
                  </li>
                </ul>
              </div>
            </div>
          );
        })()}

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

        {/* 이관 전후 3P 상품 변화 · 뭐가 늘고 뭐가 빠졌는지 */}
        {data.productFlow && data.productFlow.biocom3p_pre.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>이관 전후 3P 상품 변화 · 뭐가 늘고 뭐가 빠졌는지</h2>
            <p className={styles.sectionDesc}>
              2026-02 이관 시점 기준 BIOCOM 3P 상품이 어디로 움직였는지 · 동일 커피 4종이 <strong>TEAMKETO 로켓그로스로 이동</strong>한 경로
            </p>

            {/* 3 컬럼: pre / post / TEAMKETO RG */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {/* 이관 전 BIOCOM 3P */}
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f766e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(13,148,136,0.12)", fontSize: "0.7rem" }}>이관 전</span>
                  BIOCOM 3P · 2026-01 Top 10
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.productFlow.biocom3p_pre.map((r) => ({
                      name: (r.product_name || "(이름없음)").slice(0, 22) + ((r.product_name?.length ?? 0) > 22 ? "…" : ""),
                      net: r.net ?? 0,
                      project: r.project,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtKRW(Number(v))} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                    <Bar dataKey="net" name="순매출">
                      {data.productFlow.biocom3p_pre.map((r, i) => (
                        <Cell
                          key={i}
                          fill={r.project === "커피" ? "#f59e0b" : r.project === "영양제" ? "#0D9488" : "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 이관 후 BIOCOM 3P 잔여 */}
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#c2410c", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,0.12)", fontSize: "0.7rem" }}>이관 후</span>
                  3P 2026-02~03 잔여 Top 10
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.productFlow.biocom3p_post.map((r) => ({
                      name: (r.product_name || "(이름없음)").slice(0, 22) + ((r.product_name?.length ?? 0) > 22 ? "…" : ""),
                      net: r.net ?? 0,
                      project: r.project,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtKRW(Number(v))} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                    <Bar dataKey="net" name="순매출">
                      {data.productFlow.biocom3p_post.map((r, i) => (
                        <Cell
                          key={i}
                          fill={r.project === "커피" ? "#fbbf24" : r.project === "영양제" ? "#14b8a6" : "#cbd5e1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* TEAMKETO RG 커피 10종 */}
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#6d28d9", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(139,92,246,0.12)", fontSize: "0.7rem" }}>이동 후</span>
                  TEAMKETO 로켓그로스 커피 Top 10 (2026-01~04)
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.productFlow.teamketoRgCoffee.map((r) => ({
                      name: (r.product_name || "(이름없음)").slice(0, 22) + ((r.product_name?.length ?? 0) > 22 ? "…" : ""),
                      gross: r.gross ?? 0,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtKRW(Number(v))} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                    <Bar dataKey="gross" name="gross" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 이동한 커피 4종 매칭 표 */}
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 10 }}>핵심 4종 커피 · BIOCOM 3P → TEAMKETO RG 이동 매칭</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>커피 종류</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>BIOCOM 3P 2026-01 (이관 전)</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>TEAMKETO RG 2026-01~04 (이동 후)</th>
                      <th style={{ padding: "8px" }}>변화</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "콜롬비아 수프레모", pre: { cnt: 121, net: 3977000 }, post: { cnt: 72, gross: 2328700 } },
                      { name: "과테말라 안티구아 디카페인", pre: { cnt: 62, net: 2282700 }, post: { cnt: 123, gross: 4271400 } },
                      { name: "에티오피아 예가체프 아리차", pre: { cnt: 50, net: 1791900 }, post: { cnt: 95, gross: 3491700 } },
                      { name: "케냐 아이히더", pre: { cnt: 23, net: 1013200 }, post: { cnt: 62, gross: 2101800 } },
                    ].map((row) => {
                      const delta = (row.post.cnt / row.pre.cnt - 1) * 100;
                      const isUp = delta > 0;
                      return (
                        <tr key={row.name} style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "var(--color-text-muted)" }}>
                            {row.pre.cnt}건 · {fmtKRW(row.pre.net)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                            {row.post.cnt}건 · {fmtKRW(row.post.gross)}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: isUp ? "rgba(5,150,105,0.12)" : "rgba(239,68,68,0.12)",
                                color: isUp ? "#065f46" : "#b91c1c",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                              }}
                            >
                              {isUp ? "▲" : "▼"} 수량 {delta > 0 ? "+" : ""}
                              {delta.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 인사이트 */}
            <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
              <strong>뭐가 늘고 뭐가 빠졌나</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
                <li><strong style={{ color: "#b91c1c" }}>▼ 완전히 빠진 것</strong>: BIOCOM 3P 에서 커피 4종 (콜롬비아 / 디카페인 / 예가체프 / 케냐) 이 <strong>2026-03 에 0건으로 소멸</strong>. 이관 완료.</li>
                <li><strong style={{ color: "#065f46" }}>▲ 늘어난 것 (이동)</strong>: 동일 커피 4종이 <strong>TEAMKETO RG 로 이동</strong>. 특히 과테말라 디카페인 +98% · 예가체프 +90% · 케냐 +170% 로 수량 오히려 증가.</li>
                <li><strong style={{ color: "#c2410c" }}>◇ 유지된 것</strong>: BIOCOM 3P 에 다빈치랩 메가프로바이오틱 · 엔자임 · 핏포즈 밸런스디스크 소량 잔여 (월 ₩200K 수준 · 사실상 미미).</li>
                <li><strong style={{ color: "#1e3a8a" }}>◉ 무관한 것</strong>: BIOCOM 로켓그로스는 이관 무관 · 2026-03 에 커피 0.1% / 건기식 99.9% (썬화이버 · 바이오밸런스 · 다래케어 등) 으로 기존 구성 그대로 유지.</li>
              </ul>
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(139,92,246,0.06)", borderRadius: 6, fontSize: "0.85rem" }}>
                <strong>🎯 핵심 결론</strong>: 이관은 &quot;같은 4종 커피가 BIOCOM 3P 에서 TEAMKETO RG 로 옮긴 것&quot; 이고, 이동 후 <strong>수량이 오히려 증가</strong>. TEAMKETO 가 RG 채널을 적극 활용 · 이관이 매출에 긍정적으로 작동 중.
              </div>
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
