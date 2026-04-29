"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

type RefundSummaryResp = {
  windowStart: string;
  totals: { cases: number; amount: number; metaSent: number; ga4Sent: number; purchaseRefundSent: number };
  bySite: Array<{ site: string; cases: number; amount: number; metaSent: number; ga4Sent: number; purchaseRefundSent: number }>;
  latestDetectedAt: string | null;
};

export default function RefundDispatchCard() {
  const [refundSummary, setRefundSummary] = useState<RefundSummaryResp | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/refund/summary?windowDays=90`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => { if (data?.ok) setRefundSummary(data as RefundSummaryResp); })
      .catch(() => { /* ignore */ });
    return () => ac.abort();
  }, []);

  if (!refundSummary || refundSummary.totals.cases <= 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "#fdf4ff", border: "1px solid #f0abfc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#86198f" }}>Refund Dispatch · 최근 90일</span>
          <span style={{ fontSize: "0.62rem", color: "#a21caf", marginLeft: 8 }}>
            Toss DONE → CANCELED/PARTIAL 전이를 감지해 Meta CAPI Refund + GA4 MP Refund로 정정 발송 준비
          </span>
        </div>
        <div
          style={{ fontSize: "0.62rem", fontWeight: 600, color: refundSummary.totals.metaSent > 0 ? "#047857" : "#a16207", padding: "2px 8px", borderRadius: 4, background: refundSummary.totals.metaSent > 0 ? "#ecfdf5" : "#fef9c3" }}
          title="dry_run: 감지·로그만. 실제 Meta/GA4 전송 없음. enforce: REFUND_DISPATCH_ENFORCE=true + GA4_MP_API_SECRET_* 가 있어야 실 전송."
        >
          {refundSummary.totals.metaSent > 0 || refundSummary.totals.ga4Sent > 0 ? "enforce 활성" : "dry_run (전송 대기)"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: "0.6rem", color: "#86198f" }}>감지 건수</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{fmtNum(refundSummary.totals.cases)}건</div>
        </div>
        <div>
          <div style={{ fontSize: "0.6rem", color: "#86198f" }}>환불 금액</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{fmtKRW(refundSummary.totals.amount)}</div>
        </div>
        <div title="Meta CAPI 로 event_name=Refund custom event 전송 성공 (관측용)">
          <div style={{ fontSize: "0.6rem", color: "#86198f" }}>Meta Refund</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: refundSummary.totals.metaSent > 0 ? "#047857" : "#94a3b8" }}>
            {fmtNum(refundSummary.totals.metaSent)}건
          </div>
        </div>
        <div title="Meta CAPI 로 event_name=Purchase value 음수 전송 (ROAS 차감 반영용). event_id=Refund-As-Purchase.{order_code} 로 dedup 안전.">
          <div style={{ fontSize: "0.6rem", color: "#86198f" }}>Meta Purchase(-)</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: refundSummary.totals.purchaseRefundSent > 0 ? "#047857" : "#94a3b8" }}>
            {fmtNum(refundSummary.totals.purchaseRefundSent)}건
          </div>
        </div>
        <div title="GA4 Measurement Protocol로 refund event 전송 성공">
          <div style={{ fontSize: "0.6rem", color: "#86198f" }}>GA4 Refund</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: refundSummary.totals.ga4Sent > 0 ? "#047857" : "#94a3b8" }}>
            {fmtNum(refundSummary.totals.ga4Sent)}건
          </div>
        </div>
      </div>
      {refundSummary.bySite.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: "0.68rem", color: "#6b21a8" }}>
          {refundSummary.bySite.map((s) => (
            <span key={s.site} style={{ background: "#fff", padding: "2px 8px", borderRadius: 4, border: "1px solid #e9d5ff" }}>
              {s.site} {fmtNum(s.cases)}건 · {fmtKRW(s.amount)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
