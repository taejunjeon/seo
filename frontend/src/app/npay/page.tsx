"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import GlobalNav from "@/components/common/GlobalNav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type MonthlyRow = {
  month: string;
  allOrders: number;
  allRevenue: number;
  npayOrders: number;
  npayRevenue: number;
  npayOrderSharePct: number | null;
  npayRevenueSharePct: number | null;
  allAov: number | null;
  npayAov: number | null;
};

type CategoryMixRow = {
  category: string;
  allOrdersWithCategory: number;
  allAllocatedRevenue: number;
  npayOrdersWithCategory: number;
  npayAllocatedRevenue: number;
  npayOrderSharePct: number | null;
  npayRevenueSharePct: number | null;
};

type ProductRow = {
  productName: string;
  category: string;
  orders: number;
  allocatedRevenue: number;
};

type ScenarioRow = {
  key: string;
  label: string;
  npayLossRatePct: number;
  confidencePct: number;
  monthlyRevenueAtRisk: number;
  totalRevenueImpactPct: number | null;
};

type NpayImpact = {
  ok: boolean;
  site: string;
  generatedAt: string;
  timezone: string;
  window: {
    months: number;
    latestMonth: string | null;
    observedDaysInLatestMonth: number;
    daysInLatestMonth: number;
  };
  source: {
    primary: string;
    crossCheck: string;
    confidence: string;
    freshness: {
      firstPaidDate: string | null;
      maxPaidDate: string | null;
      maxNpayPaidDate: string | null;
      cleanOrders: number;
      cleanNpayOrders: number;
    };
    caveats: string[];
  };
  summary: {
    latest: MonthlyRow | null;
    projectedAllRevenue: number;
    projectedNpayRevenue: number;
    recommendation: {
      decision: string;
      expectedBaseLossPctOfNpayRevenue: number;
      expectedBaseLossPctOfTotalRevenue: number | null;
      confidencePct: number;
      reason: string;
    };
  };
  monthly: MonthlyRow[];
  categoryMix: CategoryMixRow[];
  topProducts: ProductRow[];
  scenarios: ScenarioRow[];
  interpretation: string[];
};

const krwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR");

const formatKRW = (value: number | null | undefined) =>
  typeof value === "number" ? krwFormatter.format(value) : "-";

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? numberFormatter.format(value) : "-";

const formatPct = (value: number | null | undefined) =>
  typeof value === "number" ? `${value.toFixed(2)}%` : "-";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 8,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
} as const;

export default function NpayImpactPage() {
  const [data, setData] = useState<NpayImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/npay/order-type-impact?months=7`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<NpayImpact>;
      })
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "load failed");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const latest = data?.summary.latest ?? null;
  const baseScenario = data?.scenarios.find((scenario) => scenario.key === "base") ?? null;
  const chartRows = useMemo(
    () =>
      (data?.monthly ?? []).map((row) => ({
        month: row.month.slice(5),
        "전체 매출": Math.round(row.allRevenue / 10000),
        "NPay 매출": Math.round(row.npayRevenue / 10000),
        "NPay 매출비중": row.npayRevenueSharePct ?? 0,
      })),
    [data],
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fb", color: "#172033" }}>
      <GlobalNav activeSlug="ai-crm" />
      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "28px 24px 56px" }}>
        <section style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontWeight: 700 }}>NPay 주문형 영향 분석</p>
              <h1 style={{ margin: "6px 0 0", fontSize: 28, letterSpacing: 0 }}>주문형 제거 전 매출 리스크 판단</h1>
            </div>
            <Link
              href="/#ai-crm"
              style={{
                color: "#0f766e",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
                border: "1px solid rgba(15, 118, 110, 0.24)",
                borderRadius: 8,
                padding: "10px 12px",
                background: "#fff",
              }}
            >
              AI CRM으로 돌아가기
            </Link>
          </div>

          {loading && (
            <div style={{ ...cardStyle, padding: 22, color: "#64748b" }}>운영 주문 원장에서 NPay 데이터를 읽는 중입니다.</div>
          )}

          {error && (
            <div style={{ ...cardStyle, padding: 22, borderColor: "rgba(220, 38, 38, 0.28)", color: "#991b1b" }}>
              데이터를 불러오지 못했습니다: {error}
            </div>
          )}

          {data && latest && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {[
                  { label: `${latest.month} NPay 주문`, value: `${formatNumber(latest.npayOrders)}건`, sub: `전체 ${formatNumber(latest.allOrders)}건 중 ${formatPct(latest.npayOrderSharePct)}` },
                  { label: `${latest.month} NPay 매출`, value: formatKRW(latest.npayRevenue), sub: `전체 매출 중 ${formatPct(latest.npayRevenueSharePct)}` },
                  { label: "월말 NPay 매출 추정", value: formatKRW(data.summary.projectedNpayRevenue), sub: `${data.window.observedDaysInLatestMonth}/${data.window.daysInLatestMonth}일 기준 단순 보정` },
                  { label: "기준 위험액", value: formatKRW(baseScenario?.monthlyRevenueAtRisk), sub: `NPay 매출의 ${baseScenario?.npayLossRatePct ?? "-"}% 이탈 가정` },
                ].map((item) => (
                  <div key={item.label} style={{ ...cardStyle, padding: 18, minHeight: 112 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{item.label}</div>
                    <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{item.sub}</div>
                  </div>
                ))}
              </div>

              <section style={{ ...cardStyle, padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18 }}>운영 판단</h2>
                    <p style={{ margin: "10px 0 0", color: "#334155", lineHeight: 1.7 }}>
                      {data.summary.recommendation.decision}. 검사권은 현재월 매출 대부분이 일반 결제에서 나오지만,
                      건강식품/영양제는 NPay 주문형 비중이 높아 버튼 위치 변경의 영향이 더 크다.
                    </p>
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      {data.interpretation.map((item) => (
                        <div key={item} style={{ display: "flex", gap: 8, color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
                          <span style={{ color: "#0f766e", fontWeight: 800 }}>•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>기준 추정</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 850 }}>{formatPct(data.summary.recommendation.expectedBaseLossPctOfTotalRevenue)}</div>
                    <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                      전체 월매출 기준 예상 손실률이다. 추정 신뢰도는 {data.summary.recommendation.confidencePct}%로 높지 않다.
                      실제 결정은 7-14일 검증 데이터를 붙여야 한다.
                    </p>
                  </div>
                </div>
              </section>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 16 }}>
                <section style={{ ...cardStyle, padding: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>월별 NPay 비중</h2>
                  <div style={{ width: "100%", height: 320, marginTop: 18 }}>
                    <ResponsiveContainer>
                      <BarChart data={chartRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip
                          formatter={(value, name) => {
                            const numeric = Number(value ?? 0);
                            return String(name).includes("비중")
                              ? `${numeric}%`
                              : `${formatNumber(numeric)}만원`;
                          }}
                        />
                        <Bar dataKey="전체 매출" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="NPay 매출" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section style={{ ...cardStyle, padding: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>시나리오</h2>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    {data.scenarios.map((scenario) => (
                      <div key={scenario.key} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <strong>{scenario.label}</strong>
                          <span style={{ color: "#0f766e", fontWeight: 800 }}>{formatKRW(scenario.monthlyRevenueAtRisk)}</span>
                        </div>
                        <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                          NPay 이용자의 {scenario.npayLossRatePct}% 이탈, 전체 매출 영향 {formatPct(scenario.totalRevenueImpactPct)},
                          신뢰도 {scenario.confidencePct}%
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
                <section style={{ ...cardStyle, padding: 20, overflow: "hidden" }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>카테고리별 의존도</h2>
                  <div style={{ overflowX: "auto", marginTop: 14 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: "#64748b", textAlign: "left" }}>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>카테고리</th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>전체 매출</th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>NPay 매출</th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>비중</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categoryMix.map((row) => (
                          <tr key={row.category}>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7", fontWeight: 700 }}>{row.category}</td>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7" }}>{formatKRW(row.allAllocatedRevenue)}</td>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7" }}>{formatKRW(row.npayAllocatedRevenue)}</td>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7" }}>{formatPct(row.npayRevenueSharePct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section style={{ ...cardStyle, padding: 20, overflow: "hidden" }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>NPay 주요 상품</h2>
                  <div style={{ overflowX: "auto", marginTop: 14 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: "#64748b", textAlign: "left" }}>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>상품</th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>주문</th>
                          <th style={{ padding: "10px 8px", borderBottom: "1px solid #e2e8f0" }}>배분 매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((row) => (
                          <tr key={row.productName}>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7", minWidth: 220 }}>
                              <div style={{ fontWeight: 700 }}>{row.productName}</div>
                              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{row.category}</div>
                            </td>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7" }}>{formatNumber(row.orders)}</td>
                            <td style={{ padding: "12px 8px", borderBottom: "1px solid #eef2f7" }}>{formatKRW(row.allocatedRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <section style={{ ...cardStyle, padding: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>데이터 기준</h2>
                <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.7 }}>
                  Primary는 {data.source.primary}이며, 최신 결제일은 {data.source.freshness.maxPaidDate ?? "-"}이다.
                  로컬 아임웹 캐시는 {data.source.crossCheck}라서 현재월 전체 판단에는 보조로만 쓴다.
                </p>
                <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                  {data.source.caveats.map((item) => (
                    <div key={item} style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
