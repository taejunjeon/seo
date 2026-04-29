"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

type IdentityCoverageResp = {
  generatedAt: string;
  fetchFixDate: string;
  totalPaymentSuccess: number;
  byEra: Array<{ era: "before_fix" | "after_fix"; total: number; allThreePct: number; gaSessionIdPct: number; clientIdPct: number }>;
  historicalShare: { beforeFix: number; afterFix: number; beforeFixPct: number };
  duplicateOrders: { totalDuplicateOrders: number; extraRows: number };
  fieldCoverage: Array<{ field: string; total: number; present: number; pct: number }>;
};

export default function IdentityCoverageCard() {
  const [identityCoverage, setIdentityCoverage] = useState<IdentityCoverageResp | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/identity-coverage/summary`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => { if (data?.ok) setIdentityCoverage(data.summary as IdentityCoverageResp); })
      .catch(() => { /* ignore */ });
    return () => ac.abort();
  }, []);

  if (!identityCoverage || identityCoverage.totalPaymentSuccess <= 0) return null;

  const cov = identityCoverage;
  const afterFix = cov.byEra.find((e) => e.era === "after_fix");
  const beforeFix = cov.byEra.find((e) => e.era === "before_fix");
  const topFields = cov.fieldCoverage.slice(0, 8);

  return (
    <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0369a1" }}>Identity Coverage · payment_success</span>
          <span style={{ fontSize: "0.62rem", color: "#0284c7", marginLeft: 8 }}>
            광고 식별자 유입률 진단 — BQ 쿼리 1/2/3/4 완료, 원인 4/5 확정
          </span>
        </div>
        <div style={{ fontSize: "0.6rem", color: "#64748b" }} title={`fetch-fix 기점: ${cov.fetchFixDate}`}>
          전체 {fmtNum(cov.totalPaymentSuccess)} row · fix={cov.fetchFixDate}
        </div>
      </div>
      <div
        style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: "0.62rem", color: "#047857", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
        title="2026-04-20 17:45 KST biocom + coffee 모두 원치 않는 추천에 tosspayments / nicepay / orders.pay.naver / new.kakaopay / pg.innopay 7개 추가. GA4 반영 24~48h 후 (direct) fallback 1,158건(26%) 감소 기대."
      >
        <span>✓ <strong>GA4 Unwanted Referrals 설정 완료 (2026-04-20)</strong> — tosspayments 등 PG 7개 추가로 session_lost 26% 해결 기대</span>
        <span style={{ color: "#0284c7" }}>→ 2026-04-22 이후 효과 측정 (쿼리 재실행)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }}>
        <div title="fetch-fix (2026-04-08) 이전 row 의 비율. 이 구간은 clientId/gaSessionId 를 snippet 이 수집하지 않던 구조라 식별자 거의 0% — 이미 구조적으로 해결됨.">
          <div style={{ fontSize: "0.6rem", color: "#0369a1" }}>historical 비중</div>
          <div style={{ fontSize: "1.0rem", fontWeight: 700, color: "#0369a1" }}>{cov.historicalShare.beforeFixPct.toFixed(1)}%</div>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>
            before {fmtNum(cov.historicalShare.beforeFix)} · after {fmtNum(cov.historicalShare.afterFix)}
          </div>
        </div>
        <div title="fetch-fix 이후 row 의 clientId+userPseudoId+gaSessionId all-three 유입률. 신규 row 의 실제 커버리지.">
          <div style={{ fontSize: "0.6rem", color: "#0369a1" }}>after_fix all-three</div>
          <div style={{ fontSize: "1.0rem", fontWeight: 700, color: (afterFix?.allThreePct ?? 0) >= 70 ? "#047857" : "#d97706" }}>
            {afterFix ? `${afterFix.allThreePct.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>
            before {beforeFix?.allThreePct.toFixed(1) ?? "—"}% → after {afterFix?.allThreePct.toFixed(1) ?? "—"}%
          </div>
        </div>
        <div title="같은 order_id 에 여러 payment_success row 가 들어온 케이스. duplicate_sender 의 직접 증거.">
          <div style={{ fontSize: "0.6rem", color: "#0369a1" }}>duplicate order</div>
          <div style={{ fontSize: "1.0rem", fontWeight: 700, color: cov.duplicateOrders.totalDuplicateOrders > 0 ? "#d97706" : "#047857" }}>
            {fmtNum(cov.duplicateOrders.totalDuplicateOrders)}건
          </div>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>extra rows {fmtNum(cov.duplicateOrders.extraRows)}</div>
        </div>
        <div title="BQ 쿼리 1/2/3/4 실측 완료. session_lost 26% 확증 → Unwanted Referrals 설정으로 해결 진행 중. 5/5 중 4개 확정, 마지막 raw_export_unknown 은 접근 확보됨.">
          <div style={{ fontSize: "0.6rem", color: "#0369a1" }}>진단 상태</div>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#047857" }}>4/5 확정</div>
          <div style={{ fontSize: "0.58rem", color: "#64748b" }}>session_lost 26% 해결 중</div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #bae6fd" }}>
        <div style={{ fontSize: "0.6rem", color: "#0369a1", marginBottom: 4 }}>metadata 필드 커버리지 (전체 payment_success 기준)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {topFields.map((f) => (
            <span
              key={f.field}
              title={`${f.present}/${f.total}`}
              style={{
                fontSize: "0.62rem",
                padding: "2px 6px",
                borderRadius: 4,
                background: f.pct >= 70 ? "#d1fae5" : f.pct >= 30 ? "#fef3c7" : "#fee2e2",
                color: f.pct >= 70 ? "#047857" : f.pct >= 30 ? "#92400e" : "#991b1b",
              }}
            >
              {f.field} {f.pct.toFixed(1)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
