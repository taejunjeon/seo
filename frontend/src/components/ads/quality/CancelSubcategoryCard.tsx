"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

type CancelSubcategoryBucket = { count: number; amount: number };
type PurchaseConfirmStats = {
  site: string;
  total: number;
  confirmed: number;
  confirmedAmount: number;
  cancelSubcategories?: {
    actual_canceled: CancelSubcategoryBucket;
    partial_canceled: CancelSubcategoryBucket;
    vbank_expired: CancelSubcategoryBucket;
    legacy_uncertain: CancelSubcategoryBucket;
  };
  cancelTotal?: { count: number; amount: number };
  partialCancelRefundedAmount?: number;
};

type Props = { site: string };

export default function CancelSubcategoryCard({ site }: Props) {
  const [cancelBreakdown, setCancelBreakdown] = useState<PurchaseConfirmStats | null>(null);

  useEffect(() => {
    if (site !== "biocom") {
      setCancelBreakdown(null);
      return;
    }
    const ac = new AbortController();
    fetch(`${API_BASE}/api/crm-local/imweb/purchase-confirm-stats?site=biocom`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => { if (data?.ok) setCancelBreakdown(data as PurchaseConfirmStats); })
      .catch(() => { /* ignore */ });
    return () => ac.abort();
  }, [site]);

  if (site !== "biocom" || !cancelBreakdown?.cancelSubcategories) return null;

  const c = cancelBreakdown.cancelSubcategories;
  const partialRefunded = cancelBreakdown.partialCancelRefundedAmount ?? 0;
  const cells: Array<{ label: string; sub: string; count: number; amount: number; tag: string; tagColor: string; tooltip: string; extra?: string }> = [
    {
      label: "실제 환불",
      sub: "actual_canceled",
      count: c.actual_canceled.count,
      amount: c.actual_canceled.amount,
      tag: "net 차감",
      tagColor: "#dc2626",
      tooltip: "Toss DONE → CANCELED 전이된 실제 환불. ROAS net에서 차감한다.",
    },
    {
      label: "부분 환불",
      sub: "partial_canceled",
      count: c.partial_canceled.count,
      amount: c.partial_canceled.amount,
      tag: "부분 차감",
      tagColor: "#d97706",
      tooltip: "Toss PARTIAL_CANCELED. 주문 총액이 아니라 실제 Toss 환불 금액만 net에서 차감.",
      extra: `Toss 환불 ${fmtKRW(partialRefunded)}`,
    },
    {
      label: "가상계좌 만료",
      sub: "vbank_expired",
      count: c.vbank_expired.count,
      amount: c.vbank_expired.amount,
      tag: "매출 아님",
      tagColor: "#64748b",
      tooltip: "가상계좌 발급 후 미입금 만료. 애초에 매출이 아니었으므로 net에서 차감하지 않음.",
    },
    {
      label: "원인 불명",
      sub: "legacy_uncertain",
      count: c.legacy_uncertain.count,
      amount: c.legacy_uncertain.amount,
      tag: "수동 확인",
      tagColor: "#7c3aed",
      tooltip: "Toss 미매칭 + 위 3종 아님. net 자동 차감 안 함. 운영팀이 원인 확인 필요.",
    },
  ];

  return (
    <div style={{ marginBottom: 24, padding: "14px 18px", borderRadius: 12, background: "#fafafa", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>매출 보정 내역</span>
          <span style={{ fontSize: "0.68rem", color: "#94a3b8", marginLeft: 8 }}>biocom 전체 기간 · Imweb CANCEL 분리</span>
        </div>
        <div style={{ fontSize: "0.65rem", color: "#64748b" }} title="gross CANCEL을 4가지로 분리해 net 매출을 계산. vbank_expired는 가상계좌 미입금 만료라 매출이 아니었으므로 net 차감하지 않음.">
          전체 CANCEL {fmtNum(cancelBreakdown.cancelTotal?.count ?? 0)}건 / {fmtKRW(cancelBreakdown.cancelTotal?.amount ?? 0)} ⓘ
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
        {cells.map((cell) => (
          <div key={cell.sub} title={cell.tooltip} style={{ padding: "10px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e293b" }}>{cell.label}</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: `${cell.tagColor}15`, color: cell.tagColor }}>{cell.tag}</span>
            </div>
            <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginBottom: 2 }}>{cell.sub}</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>{fmtKRW(cell.amount)}</div>
            <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{fmtNum(cell.count)}건{cell.extra ? ` · ${cell.extra}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
