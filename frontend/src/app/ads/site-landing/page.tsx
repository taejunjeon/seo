"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Derived = { source_evidence_present_rate: number; paid_hint_count: number; organic_count: number; direct_count: number; referral_count: number; unknown_or_hold_count: number; raw_click_mode_count: number; ttl_expiring_24h_count: number; external_send_count: 0; upload_candidate_count: 0 };
type Summary = { total: number; channel_distribution: Record<string, number>; source_breakdown_top10: Array<{ source: string; count: number }>; joinable_session_key_count: number; derived?: Derived };

export default function SiteLandingSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [windowHours, setWindowHours] = useState(24);

  useEffect(() => {
    fetch(`${API_BASE}/api/attribution/site-landing/summary?windowHours=${windowHours}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; error?: string } & Summary) => {
        if (!j.ok) setErr(j.error ?? "unknown_error");
        else setSummary(j);
      })
      .catch((e) => setErr(String(e)));
  }, [windowHours]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>아임웹 수준 유입 분석 (site_landing)</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        L1 referrer / UTM / landing / sessionKey 기반 자체 ledger 요약. campaign_id exact 는 2차 목표.
      </p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12 }}>윈도우: </label>
        {[24, 72, 168].map((h) => (
          <button key={h} onClick={() => setWindowHours(h)} style={{ marginLeft: 6, padding: "2px 8px", fontSize: 12, background: windowHours === h ? "#333" : "#eee", color: windowHours === h ? "#fff" : "#333", border: "1px solid #ccc" }}>{h}h</button>
        ))}
      </div>
      {err && <div style={{ color: "#c33", fontSize: 13 }}>에러: {err}</div>}
      {summary && summary.total < 50 && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          표본 {fmtNum(summary.total)} 건은 작은 표본 — 비율 해석 보류. 50 건 도달 이후 의미 있는 비율로 봅니다.
        </div>
      )}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
          <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>총 row {fmtNum(summary.total)}</div>
            <div>source evidence present rate: {summary.derived ? fmtPct(summary.derived.source_evidence_present_rate) : "-"}</div>
            <div>joinable sessionKey: {fmtNum(summary.joinable_session_key_count)}</div>
            <div>TTL 24h 안 만료: {summary.derived?.ttl_expiring_24h_count ?? 0}</div>
            <div>raw click mode: {summary.derived?.raw_click_mode_count ?? 0}</div>
          </div>
          <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
            <div style={{ fontWeight: 600 }}>채널 분포</div>
            <div>paid: {summary.derived?.paid_hint_count ?? 0}</div>
            <div>organic: {summary.derived?.organic_count ?? 0}</div>
            <div>direct: {summary.derived?.direct_count ?? 0}</div>
            <div>referral: {summary.derived?.referral_count ?? 0}</div>
            <div>unknown/hold: {summary.derived?.unknown_or_hold_count ?? 0}</div>
          </div>
          <div style={{ gridColumn: "1 / -1", border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>source breakdown top10</div>
            {summary.source_breakdown_top10.length === 0 ? <div style={{ color: "#999" }}>데이터 없음</div> : summary.source_breakdown_top10.map((r) => <div key={r.source}>{r.source} — {fmtNum(r.count)}</div>)}
          </div>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#666" }}>
            external_send_count: {summary.derived?.external_send_count ?? 0} / upload_candidate_count: {summary.derived?.upload_candidate_count ?? 0}
          </div>
        </div>
      )}
    </main>
  );
}
