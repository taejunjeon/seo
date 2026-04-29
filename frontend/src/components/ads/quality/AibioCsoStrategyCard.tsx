"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const ADS_REPORTING_API_BASE = "https://att.ainativeos.net";
const AIBIO_ACCOUNT_ID = "act_377604674894011";

const fmtKRW = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

const DATE_PRESET_DAY_COUNTS: Record<string, number> = {
  last_7d: 7,
  last_14d: 14,
  last_30d: 30,
  last_90d: 90,
};
const DATE_PRESET_LABELS: Record<string, string> = {
  last_7d: "최근 7일",
  last_14d: "최근 14일",
  last_30d: "최근 30일",
  last_90d: "최근 90일",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type CampaignSummary = {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  avgCpc: number;
  totalLandingViews: number;
  totalLeads: number;
  totalPurchases: number;
  totalPurchaseValue?: number;
};

type AcquisitionDimensionRow = {
  label: string;
  count: number;
  share: number;
  revenue?: number;
  examples?: string[];
};

type AcquisitionChannelRow = AcquisitionDimensionRow & {
  key: string;
  description?: string;
  confirmedCount?: number;
  pendingCount?: number;
  canceledCount?: number;
  pendingRevenue?: number;
};

type AibioAcquisitionSite = {
  key: string;
  name: string;
  conversionName: string;
  operationalConversions: number;
  rawConversions: number;
  excludedConversions: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  topChannel: AcquisitionChannelRow | null;
  channels: AcquisitionChannelRow[];
  campaigns: AcquisitionDimensionRow[];
  landings: AcquisitionDimensionRow[];
  insights?: string[];
  dataWarnings?: string[];
};

function AibioMetricCard({
  label, value, note, color,
}: { label: string; value: string; note: string; color: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.08rem", fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.5, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function AibioStrategyBox({
  title, children, accent,
}: { title: string; children: React.ReactNode; accent: string }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: `1px solid ${accent}55`, fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
      <strong style={{ color: accent, fontSize: "0.82rem" }}>{title}</strong>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

type Props = { datePreset: string };

export default function AibioCsoStrategyCard({ datePreset }: Props) {
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null);
  const [acquisition, setAcquisition] = useState<AibioAcquisitionSite | null>(null);
  const [acquisitionLoading, setAcquisitionLoading] = useState(false);
  const [acquisitionError, setAcquisitionError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${ADS_REPORTING_API_BASE}/api/meta/insights?account_id=${AIBIO_ACCOUNT_ID}&date_preset=${datePreset}&attribution_window=1d_click`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => { if (data?.ok && data.summary) setCampaignSummary(data.summary as CampaignSummary); })
      .catch(() => { /* ignore */ });
    return () => ac.abort();
  }, [datePreset]);

  useEffect(() => {
    const ac = new AbortController();
    const rangeDays = DATE_PRESET_DAY_COUNTS[datePreset] ?? 30;
    setAcquisitionLoading(true);
    setAcquisitionError(null);
    fetch(`${API_BASE}/api/attribution/acquisition-summary?rangeDays=${rangeDays}&dataSource=vm`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: { ok?: boolean; sites?: AibioAcquisitionSite[]; error?: string }) => {
        if (!data?.ok || !Array.isArray(data.sites)) {
          throw new Error(data?.error ?? "AIBIO acquisition summary unavailable");
        }
        setAcquisition(data.sites.find((site) => site.key === "aibio") ?? null);
      })
      .catch((error) => {
        if (!ac.signal.aborted) {
          setAcquisition(null);
          setAcquisitionError(error instanceof Error ? error.message : "AIBIO acquisition summary unavailable");
        }
      })
      .finally(() => { if (!ac.signal.aborted) setAcquisitionLoading(false); });
    return () => ac.abort();
  }, [datePreset]);

  if (!campaignSummary) {
    return (
      <div style={{ marginBottom: 24, padding: "14px 18px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: "0.78rem", color: "#64748b" }}>
        AIBIO CSO 전략 데이터 로딩 중…
      </div>
    );
  }

  const currentPresetLabel = DATE_PRESET_LABELS[datePreset] ?? "선택 기간";
  const fmtPct = (value: number | null | undefined) => (
    value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—"
  );
  const spend = campaignSummary.totalSpend;
  const clickToLanding = campaignSummary.totalClicks > 0
    ? campaignSummary.totalLandingViews / campaignSummary.totalClicks
    : null;
  const internalForms = acquisition?.operationalConversions ?? 0;
  const rawForms = acquisition?.rawConversions ?? 0;
  const excludedForms = acquisition?.excludedConversions ?? 0;
  const metaChannel = acquisition?.channels.find((channel) => channel.key === "meta") ?? null;
  const metaForms = metaChannel?.count ?? 0;
  const internalFormRate = campaignSummary.totalLandingViews > 0 && internalForms > 0
    ? internalForms / campaignSummary.totalLandingViews
    : null;
  const cplByInternal = internalForms > 0 ? spend / internalForms : null;
  const cplByMetaForms = metaForms > 0 ? spend / metaForms : null;
  const topLanding = acquisition?.landings[0] ?? null;
  const topCampaign = acquisition?.campaigns.find((row) => row.label !== "(campaign 없음)") ?? acquisition?.campaigns[0] ?? null;
  const platformLeadEvents = campaignSummary.totalLeads;
  const platformPurchaseEvents = campaignSummary.totalPurchases;
  const hasInternalButNoMetaLead = internalForms > 0 && platformLeadEvents === 0;

  return (
    <div style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: "1 1 620px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 800, marginBottom: 4 }}>
            AIBIO CSO 판단 · 리커버리랩 전환 설계
          </div>
          <div style={{ fontSize: "1.02rem", fontWeight: 900, color: "#0f172a", lineHeight: 1.55 }}>
            전체 Meta를 끄기보다, 전환 계측을 먼저 맞추고 트래픽 목표 예산만 통제하는 쪽이 맞습니다.
          </div>
          <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#475569", lineHeight: 1.75 }}>
            현재 광고는 사람을 데려오고 있습니다. 문제는 수요 부재가 아니라
            <strong> Meta API Lead {fmtNum(platformLeadEvents)}건</strong>과 <strong>내부 form_submit {acquisitionLoading ? "확인 중" : `${fmtNum(internalForms)}건`}</strong>이 갈라진 상태입니다.
            이 상태에서 예산을 크게 늘리면 Meta는 아직 &quot;좋은 리드&quot;를 학습하지 못하고, 반대로 전부 멈추면 이미 들어오는 상담 신호를 잃습니다.
          </div>
        </div>
        <span style={{
          padding: "6px 12px",
          borderRadius: 8,
          background: hasInternalButNoMetaLead ? "#fff7ed" : "#ecfdf5",
          color: hasInternalButNoMetaLead ? "#9a3412" : "#047857",
          border: `1px solid ${hasInternalButNoMetaLead ? "#fed7aa" : "#a7f3d0"}`,
          fontSize: "0.7rem",
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}>
          {hasInternalButNoMetaLead ? "계측 정합성 우선" : "전환 신호 확인 중"}
        </span>
      </div>

      {acquisitionError && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.74rem" }}>
          AIBIO 내부 전환 원장 조회 실패: {acquisitionError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
        <AibioMetricCard
          label="선택 기간 광고비"
          value={fmtKRW(spend)}
          note={`${currentPresetLabel} · Meta API 기준`}
          color="#ef4444"
        />
        <AibioMetricCard
          label="Meta API Lead"
          value={`${fmtNum(platformLeadEvents)}건`}
          note={`Purchase ${fmtNum(platformPurchaseEvents)}건 · Ads Manager 학습 신호는 아직 약함`}
          color={platformLeadEvents > 0 ? "#16a34a" : "#dc2626"}
        />
        <AibioMetricCard
          label="내부 form_submit"
          value={acquisitionLoading ? "확인 중" : `${fmtNum(internalForms)}건`}
          note={acquisition ? `raw ${fmtNum(rawForms)}건 중 테스트 ${fmtNum(excludedForms)}건 제외` : "VM attribution 원장 기준"}
          color={internalForms > 0 ? "#16a34a" : "#d97706"}
        />
        <AibioMetricCard
          label="Meta/Instagram 폼"
          value={acquisitionLoading ? "확인 중" : `${fmtNum(metaForms)}건`}
          note={metaChannel ? `내부 폼의 ${metaChannel.share.toFixed(1)}% · ${metaChannel.examples?.slice(0, 2).join(", ") ?? "campaign 확인"}` : "fbclid/fbc/fbp/Instagram referrer 기준"}
          color="#2563eb"
        />
        <AibioMetricCard
          label="내부 기준 CPL"
          value={cplByInternal != null ? fmtKRW(cplByInternal) : "—"}
          note={cplByMetaForms != null ? `Meta 유입 폼 기준 ${fmtKRW(cplByMetaForms)}/건` : "폼 표본이 쌓이면 판단 가능"}
          color="#0f766e"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
        <AibioStrategyBox title="1. 전환은 하나가 아니라 단계로 쪼갭니다" accent="#0f766e">
          <p style={{ margin: 0 }}>
            메인 전환은 계속 <strong>form_submit</strong>입니다. 보조 전환은
            <strong> 카카오톡 클릭</strong>, <strong>채널톡 열기</strong>, <strong>체험권 결제 시작</strong>,
            <strong> 1분 체류</strong>, <strong>90% 스크롤</strong>, <strong>CTA 클릭</strong>으로 나눕니다.
            보조 전환은 ROAS 분자가 아니라 리타겟팅과 UX 병목 찾기용입니다.
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            GTM 이벤트명 제안: <code>aibio_kakao_click</code>, <code>aibio_channeltalk_open</code>,
            <code>aibio_ticket_checkout</code>, <code>aibio_engaged_60s</code>, <code>aibio_scroll_90</code>.
          </p>
        </AibioStrategyBox>

        <AibioStrategyBox title="2. 카카오톡은 즉시, 채널톡은 운영 준비 후" accent="#2563eb">
          <p style={{ margin: 0 }}>
            AIBIO는 고관여 오프라인 서비스라 즉시 질문 채널이 전환율에 영향을 줍니다.
            <strong> 카카오톡 버튼은 우선 적용</strong>이 맞습니다. 이미 GTM에 카톡채널 클릭 트리거가 있으므로, 고정 CTA와 클릭 이벤트만 안정화하면 됩니다.
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            채널톡은 응답 담당자, 운영 시간, FAQ, 리드 소유자 필드가 준비될 때 붙입니다. 응답이 느리면 위젯은 신뢰를 깎으므로 카카오톡보다 늦게 여는 편이 낫습니다.
          </p>
        </AibioStrategyBox>

        <AibioStrategyBox title="3. shop은 전체 상점보다 체험권 1개부터" accent="#d97706">
          <p style={{ margin: 0 }}>
            {topLanding ? (
              <>
                현재 내부 폼의 <strong>{topLanding.share.toFixed(1)}%</strong>가 <strong>{topLanding.label}</strong>에서 나옵니다.
                이미 shop_view 맥락이 리드를 만들고 있으므로, 전체 쇼핑몰보다 <strong>예약금형 체험권</strong> 1개를 먼저 테스트하는 게 맞습니다.
              </>
            ) : (
              <>체험권은 가능하지만 전체 shop을 먼저 키우면 폼 제출보다 마찰이 커질 수 있습니다.</>
            )}
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            추천 상품은 무료 상담을 대체하는 고가 상품이 아니라, 환불 가능하거나 방문 시 차감되는 소액 예약금입니다.
            결제 시작과 구매가 생기면 Meta에는 더 강한 가치 신호가 생깁니다.
          </p>
        </AibioStrategyBox>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
          <strong style={{ color: "#0f172a", fontSize: "0.82rem" }}>Meta 광고 운영안</strong>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li style={{ marginBottom: 5 }}>
              <strong>전체 중단은 하지 않습니다.</strong> 내부 원장에는 폼이 들어오고, 그중 Meta/Instagram 비중이 높습니다. 수요가 없는 캠페인으로 단정하기 이릅니다.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>증액은 금지합니다.</strong> Meta Lead가 0인 동안은 알고리즘이 리드 품질을 못 배우므로, 예산 확대보다 Lead 이벤트 정합성 확인이 먼저입니다.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>트래픽 목표 캠페인은 감액/일시정지 후보입니다.</strong> 랜딩뷰 최적화는 싼 클릭을 잘 만들지만 상담 가능성이 높은 사람을 찾는 목표가 아닙니다.
            </li>
            <li>
              <strong>48시간 게이트:</strong> Events Manager와 Ads API에서 Lead가 보이면 리드 캠페인만 유지, 계속 0이면 태그/맞춤전환을 고친 뒤 재개합니다.
            </li>
          </ol>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.76rem", color: "#334155", lineHeight: 1.75 }}>
          <strong style={{ color: "#0f172a", fontSize: "0.82rem" }}>다음 의사결정 기준</strong>
          <div style={{ marginTop: 8 }}>
            <div>클릭→랜딩: <strong>{fmtPct(clickToLanding)}</strong></div>
            <div>랜딩→내부 폼: <strong>{fmtPct(internalFormRate)}</strong></div>
            <div>상위 원장 캠페인: <strong>{topCampaign?.label ?? "확인 중"}</strong></div>
            <div>최신 폼 제출: <strong>{formatDateTime(acquisition?.latestLoggedAt ?? null)}</strong></div>
          </div>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            진짜 CSO 지표는 폼 제출 수가 아니라 <strong>폼 제출→상담 연결→예약 확정→방문→체험권/본상품 결제</strong>입니다.
            이 후속 전환율이 붙기 전까지 Meta ROAS 대신 CPL과 상담 연결률로 판단해야 합니다.
          </p>
        </div>
      </div>

      {acquisition?.dataWarnings?.length ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.72rem", color: "#92400e", lineHeight: 1.65 }}>
          <strong>데이터 주의:</strong> {acquisition.dataWarnings.join(" ")}
        </div>
      ) : null}
    </div>
  );
}
