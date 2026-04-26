"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AIBIO_NATIVE_API_BASE,
  AIBIO_NATIVE_STATUS_LABELS,
  type AibioNativeLead,
  type AibioNativeLeadStatus,
} from "@/lib/aibio-native";

const STATUS_OPTIONS = Object.entries(AIBIO_NATIVE_STATUS_LABELS) as Array<[AibioNativeLeadStatus, string]>;

type LeadListResponse = {
  ok: boolean;
  total: number;
  leads: AibioNativeLead[];
  summary: {
    total: number;
    byStatus: Record<AibioNativeLeadStatus, number>;
    byLanding: Array<{ key: string; count: number }>;
    bySource: Array<{ key: string; count: number }>;
    withAdKey: number;
    adKeyCoverageRate: number | null;
    duplicates: number;
    duplicateRate: number | null;
  };
};

type FunnelResponse = {
  ok: boolean;
  source: string;
  window: { startAt: string; endAt: string; days: number };
  freshness: { latestLeadAt: string | null; latestStatusUpdatedAt: string | null };
  funnel: {
    leads: number;
    contactStarted: number;
    contacted: number;
    reserved: number;
    visited: number;
    paid: number;
    noShow: number;
    invalidDuplicate: number;
  };
  confidence: string;
};

const purposeLabel: Record<string, string> = {
  metabolism: "대사/붓기 관리",
  appetite: "식욕 조절",
  recovery: "회복/컨디션",
  program: "프로그램 상담",
};

const channelLabel: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  naver: "Naver",
  google: "Google",
  referral: "지인 소개",
};

const fmtDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const fmtPct = (value: number | null) => {
  if (value == null) return "-";
  return `${Math.round(value * 100)}%`;
};

const sourceLabel = (lead: AibioNativeLead) =>
  lead.utm.source || channelLabel[lead.channel] || lead.channel || "(없음)";

export function AibioNativeAdmin() {
  const [leads, setLeads] = useState<AibioNativeLead[]>([]);
  const [listSummary, setListSummary] = useState<LeadListResponse["summary"] | null>(null);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | AibioNativeLeadStatus>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    setLoading(true);
    setError(null);
    try {
      const [leadRes, funnelRes] = await Promise.all([
        fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/native-leads?${params.toString()}`, { cache: "no-store" }),
        fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/native-leads/funnel?days=7`, { cache: "no-store" }),
      ]);
      const leadBody = (await leadRes.json()) as LeadListResponse;
      const funnelBody = (await funnelRes.json()) as FunnelResponse;
      if (!leadRes.ok || !leadBody.ok) throw new Error("리드 목록을 읽지 못했습니다.");
      if (!funnelRes.ok || !funnelBody.ok) throw new Error("퍼널 요약을 읽지 못했습니다.");
      setLeads(leadBody.leads);
      setListSummary(leadBody.summary);
      setFunnel(funnelBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 데이터를 읽지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (leadId: string, status: AibioNativeLeadStatus) => {
    setUpdatingLeadId(leadId);
    setError(null);
    try {
      const response = await fetch(`${AIBIO_NATIVE_API_BASE}/api/aibio/native-leads/${encodeURIComponent(leadId)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, changedBy: "aibio-native-admin" }),
      });
      const body = (await response.json()) as { ok: boolean; lead?: AibioNativeLead; error?: string };
      if (!response.ok || !body.ok || !body.lead) throw new Error(body.error ?? "상태 변경 실패");
      setLeads((current) => current.map((lead) => (lead.leadId === leadId ? body.lead! : lead)));
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 실패");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const summaryItems = useMemo(() => {
    const byStatus = listSummary?.byStatus;
    return [
      { label: "전체 리드", value: String(listSummary?.total ?? 0) },
      { label: "신규", value: String(byStatus?.new ?? 0) },
      { label: "예약완료", value: String(byStatus?.reserved ?? 0) },
      { label: "방문/결제", value: String((byStatus?.visited ?? 0) + (byStatus?.paid ?? 0)) },
      { label: "광고키 저장률", value: fmtPct(listSummary?.adKeyCoverageRate ?? null) },
      { label: "중복 후보", value: String(listSummary?.duplicates ?? 0) },
    ];
  }, [listSummary]);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p>AIBIO Native Admin Phase3</p>
          <h1>자체 리드 원장과 주간 퍼널을 실제 API로 봅니다.</h1>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => void load()} disabled={loading}>새로고침</button>
          <a href="/aibio-native">공개 페이지</a>
        </div>
      </header>

      <section className="summary-grid" aria-label="리드 요약">
        {summaryItems.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="funnel-board" aria-label="주간 리드 퍼널">
        <div>
          <p>Weekly funnel</p>
          <h2>최근 7일 상담 상태 흐름</h2>
          <span>source: {funnel?.source ?? "local_sqlite_aibio_native_leads"} · latest: {fmtDateTime(funnel?.freshness.latestLeadAt ?? null)}</span>
        </div>
        <div className="funnel-steps">
          {[
            ["리드", funnel?.funnel.leads ?? 0],
            ["연락시작", funnel?.funnel.contactStarted ?? 0],
            ["연락완료", funnel?.funnel.contacted ?? 0],
            ["예약완료", funnel?.funnel.reserved ?? 0],
            ["방문완료", funnel?.funnel.visited ?? 0],
            ["결제완료", funnel?.funnel.paid ?? 0],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="board" aria-label="리드 목록">
        <div className="board-head">
          <div>
            <p>Lead operations</p>
            <h2>운영 리드 리스트</h2>
          </div>
          <label>
            상태 필터
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | AibioNativeLeadStatus)}>
              <option value="">전체</option>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="notice">리드 원장을 읽는 중입니다.</div> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>접수시각</th>
                <th>고객</th>
                <th>상담 목적</th>
                <th>유입</th>
                <th>랜딩</th>
                <th>광고키</th>
                <th>상태</th>
                <th>중복</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.leadId}>
                  <td>
                    <strong>{fmtDateTime(lead.createdAt)}</strong>
                    <span className="sub">{lead.leadId.slice(0, 26)}</span>
                  </td>
                  <td>
                    <strong>{lead.customerNameMasked}</strong>
                    <span className="sub">{lead.customerPhoneMasked}</span>
                  </td>
                  <td>
                    <strong>{purposeLabel[lead.purpose] ?? lead.purpose}</strong>
                    <span className="sub">{lead.preferredTime}</span>
                  </td>
                  <td>
                    <strong>{sourceLabel(lead)}</strong>
                    <span className="sub">{lead.utm.campaign ?? lead.channel}</span>
                  </td>
                  <td>
                    <strong>{lead.landingPath || "-"}</strong>
                    <span className="sub">{lead.referrer ?? "referrer 없음"}</span>
                  </td>
                  <td>
                    <strong>{lead.attributionKeys.length}개</strong>
                    <span className="sub">{lead.adKeys.fbclid ? "fbclid " : ""}{lead.adKeys.gclid ? "gclid " : ""}{lead.adKeys.fbc ? "_fbc " : ""}{lead.adKeys.fbp ? "_fbp " : ""}{lead.adKeys.gaClientId ? "_ga" : ""}</span>
                  </td>
                  <td>
                    <select
                      value={lead.status}
                      disabled={updatingLeadId === lead.leadId}
                      onChange={(event) => void updateStatus(lead.leadId, event.target.value as AibioNativeLeadStatus)}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`pill ${lead.isDuplicate ? "amber" : "green"}`}>
                      {lead.isDuplicate ? "후보" : "정상"}
                    </span>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="empty">아직 자체 리드 원장에 저장된 상담 신청이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workflow" aria-label="운영 처리 순서">
        <h2>운영 처리 순서</h2>
        <ol>
          <li>신규 리드를 확인하고 유입, 랜딩, 상담 목적을 본다.</li>
          <li>연락 결과를 연락시도, 연락완료, 예약완료 중 하나로 바꾼다.</li>
          <li>방문 후 방문완료, 노쇼, 결제완료를 같은 행에서 갱신한다.</li>
          <li>30일 동안 아임웹 폼 원장과 fallback 대조 후 종료 여부를 판단한다.</li>
        </ol>
      </section>

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          padding: 32px;
          color: #172554;
          background: #eef4ff;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .admin-header,
        .board-head,
        .funnel-board {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .admin-header {
          margin-bottom: 22px;
        }

        .admin-header p,
        .board-head p,
        .funnel-board p {
          margin: 0 0 8px;
          color: #2563eb;
          font-size: 0.74rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .admin-header h1,
        .board-head h2,
        .funnel-board h2,
        .workflow h2 {
          margin: 0;
          color: #172554;
          letter-spacing: 0;
          font-weight: 900;
        }

        .admin-header h1 {
          max-width: 760px;
          font-size: 2rem;
          line-height: 1.25;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-actions a,
        .header-actions button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 14px;
          border-radius: 6px;
          border: 0;
          color: #ffffff;
          background: #3758d4;
          font-size: 0.84rem;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .header-actions button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .summary-grid article,
        .funnel-board,
        .board,
        .workflow {
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .summary-grid article {
          min-height: 98px;
          padding: 18px;
        }

        .summary-grid span,
        .funnel-steps span,
        .sub {
          display: block;
          color: #64748b;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .summary-grid strong {
          display: block;
          margin-top: 8px;
          color: #172554;
          font-size: 1.7rem;
          font-weight: 900;
        }

        .funnel-board {
          align-items: center;
          padding: 20px;
          margin-bottom: 16px;
        }

        .funnel-board h2 {
          font-size: 1.14rem;
        }

        .funnel-board > div > span {
          display: block;
          margin-top: 8px;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 750;
        }

        .funnel-steps {
          display: grid;
          grid-template-columns: repeat(6, minmax(74px, 1fr));
          gap: 8px;
          min-width: min(720px, 100%);
        }

        .funnel-steps div {
          min-height: 78px;
          padding: 12px;
          border-radius: 7px;
          background: #f8fbff;
          border: 1px solid rgba(37, 99, 235, 0.1);
        }

        .funnel-steps strong {
          display: block;
          margin-top: 7px;
          color: #1d4ed8;
          font-size: 1.25rem;
          font-weight: 900;
        }

        .board {
          overflow: hidden;
        }

        .board-head {
          align-items: center;
          min-height: 88px;
          padding: 20px 22px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .board-head h2 {
          font-size: 1.2rem;
        }

        .board-head label {
          display: grid;
          gap: 6px;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 900;
        }

        select {
          min-height: 34px;
          border: 1px solid rgba(37, 99, 235, 0.18);
          border-radius: 6px;
          color: #172554;
          background: #ffffff;
          font-weight: 850;
        }

        .notice {
          padding: 14px 20px;
          color: #1e3a8a;
          background: #eff6ff;
          border-bottom: 1px solid rgba(37, 99, 235, 0.12);
          font-size: 0.84rem;
          font-weight: 850;
        }

        .notice.error {
          color: #b91c1c;
          background: #fef2f2;
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 14px 16px;
          text-align: left;
          vertical-align: top;
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
          font-size: 0.82rem;
          font-weight: 820;
        }

        th {
          color: #64748b;
          background: #f8fbff;
        }

        td {
          color: #334155;
        }

        td strong {
          display: block;
          margin-bottom: 5px;
          color: #172554;
          font-weight: 900;
        }

        .pill {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          border-radius: 5px;
          font-size: 0.74rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.green {
          color: #047857;
          background: #d1fae5;
        }

        .pill.amber {
          color: #92400e;
          background: #fef3c7;
        }

        .empty {
          height: 120px;
          text-align: center;
          color: #64748b;
        }

        .workflow {
          margin-top: 16px;
          padding: 22px;
        }

        .workflow ol {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0 0;
          padding: 0;
          list-style: none;
        }

        .workflow li {
          min-height: 108px;
          padding: 16px;
          border-radius: 8px;
          color: #475569;
          background: #f8fbff;
          border: 1px solid rgba(37, 99, 235, 0.1);
          font-size: 0.84rem;
          line-height: 1.55;
          font-weight: 780;
        }

        @media (max-width: 1100px) {
          .summary-grid,
          .funnel-steps {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .funnel-board {
            align-items: stretch;
            flex-direction: column;
          }
        }

        @media (max-width: 720px) {
          .admin-page {
            padding: 20px;
          }

          .admin-header,
          .board-head {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-grid,
          .funnel-steps,
          .workflow ol {
            grid-template-columns: 1fr;
          }

          .admin-header h1 {
            font-size: 1.55rem;
          }
        }
      `}</style>
    </main>
  );
}
