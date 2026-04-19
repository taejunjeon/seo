"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";
import { API_BASE, fmtKRW } from "./crm-utils";

type AbVariant = {
  variant_key: string;
  assigned: number;
  sent: number;
  sendFailed: number;
  purchased: number;
  purchaseRate: number;
  revenue: number;
  avgOrderAmount: number;
};

type AbExperiment = {
  experiment_key: string;
  name: string;
  status: string;
  channel: string;
  hypothesis: string;
  conversion_window_days: number;
  created_at: string;
};

type AbSummaryResponse = {
  ok: boolean;
  experiment: AbExperiment;
  variants: AbVariant[];
  conversionWindowDays: number;
};

type FunnelResponse = {
  funnel: { sent: number; delivered: number; visited: number; purchased: number; revenue: number };
  rates: { delivery_rate: number; visit_rate: number; purchase_rate: number; overall_rate: number };
  variants: Array<{ variant_key: string; sent: number; delivered: number; visited: number; purchased: number; revenue: number; purchase_rate: number }>;
};

export function CoffeeAbTestSection({ minDays, maxDays, minOrders, candidates }: {
  minDays: number;
  maxDays: number;
  minOrders: number;
  candidates: { consentSms: boolean; phone: string; name: string; memberCode: string; daysSinceLastPurchase: number }[];
}) {
  const [experiments, setExperiments] = useState<Array<{ experiment_key: string; name: string; status: string; channel: string; created_at: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<AbSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/crm-local/experiments?meta=true`)
      .then((r) => r.json())
      .then((d) => {
        const abExps = (d.experiments ?? []).filter((e: { channel?: string }) => e.channel?.includes("+"));
        setExperiments(abExps);
        if (abExps.length > 0 && !selectedKey) setSelectedKey(abExps[0].experiment_key);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedKey) { setSummary(null); setFunnel(null); return; }
    setSummaryLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/crm-local/experiments/${selectedKey}/ab-summary`).then((r) => r.json()),
      fetch(`${API_BASE}/api/crm-local/experiments/${selectedKey}/funnel`).then((r) => r.json()),
    ])
      .then(([sumData, funnelData]) => {
        if (sumData.ok) setSummary(sumData);
        if (funnelData.ok) setFunnel(funnelData);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [selectedKey]);

  const [testType, setTestType] = useState<"channel" | "consent">("consent");
  const withPhone = candidates.filter((c) => c.phone);
  const consentCount = withPhone.filter((c) => c.consentSms).length;
  const nonConsentCount = withPhone.length - consentCount;

  const TEST_TYPES = [
    { key: "consent" as const, label: "동의 vs 미동의", desc: "양군 모두 SMS 발송, 동의 여부별 전환율 비교", targetCount: withPhone.length },
    { key: "channel" as const, label: "SMS vs 알림톡", desc: "동의 고객을 채널별로 나누어 비교", targetCount: consentCount },
  ];

  const currentType = TEST_TYPES.find((t) => t.key === testType)!;

  const isConsentType = testType === "consent";
  const groupAPreview = isConsentType
    ? { label: "동의 고객 (SMS)", count: consentCount }
    : { label: "SMS", count: Math.floor(consentCount / 2) };
  const groupBPreview = isConsentType
    ? { label: "미동의 고객 (SMS)", count: nonConsentCount }
    : { label: "알림톡", count: consentCount - Math.floor(consentCount / 2) };
  const excludedPreview = isConsentType
    ? candidates.length - withPhone.length
    : candidates.length - consentCount;

  const inferExperimentType = (channel?: string): "consent" | "channel" | null => {
    if (!channel) return null;
    if (channel.includes("동의")) return "consent";
    if (channel.includes("sms+alimtalk") || channel.includes("alimtalk+sms")) return "channel";
    return null;
  };
  const experimentTypeLabel = (channel?: string): string => {
    const t = inferExperimentType(channel);
    if (t === "consent") return "동의 vs 미동의";
    if (t === "channel") return "SMS vs 알림톡";
    return "A/B";
  };

  // 메시지 예상 비용 (VAT 10% 포함): 일반 15원, 타겟 20원
  const SMS_UNIT_NORMAL = 15;
  const SMS_UNIT_TARGET = 20;
  const estimateCost = (count: number, unit: number) => Math.round(count * unit * 1.1);

  const handleCreate = async () => {
    const isConsent = testType === "consent";
    const msg = isConsent
      ? `[동의 vs 미동의 A/B 테스트]\n\nA그룹 (동의 고객, SMS): ${consentCount}명\nB그룹 (미동의 고객, SMS): ${nonConsentCount}명\n\n실험을 생성하시겠습니까?`
      : `[SMS vs 알림톡 A/B 테스트]\n\nA그룹 (SMS): 약 ${Math.floor(consentCount / 2)}명\nB그룹 (알림톡): 약 ${consentCount - Math.floor(consentCount / 2)}명\n대상: SMS 동의 고객 ${consentCount}명\n\n실험을 생성하시겠습니까?`;
    if (!confirm(msg)) return;
    setCreating(true);
    try {
      const body = isConsent
        ? { site: "thecleancoffee", minDays, maxDays, minOrders, variantA: "consent_sms", variantB: "noconsent_sms", splitBy: "consent", conversionWindowDays: 3 }
        : { site: "thecleancoffee", minDays, maxDays, minOrders, variantA: "sms", variantB: "alimtalk", splitBy: "channel", conversionWindowDays: 3 };
      const res = await fetch(`${API_BASE}/api/crm-local/experiments/repurchase-ab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        const counts = Object.entries(data.assigned ?? {}).map(([k, v]) => `${k}: ${v}명`).join("\n");
        setExperiments((prev) => [{ experiment_key: data.experiment.experiment_key, name: data.experiment.name, status: data.experiment.status, channel: data.experiment.channel, created_at: data.experiment.created_at }, ...prev]);
        setSelectedKey(data.experiment.experiment_key);

        const groupIds = data.groups ?? {};
        const firstGroupId = Object.values(groupIds)[0] as string | undefined;
        const goToMsg = confirm(`실험 생성 완료\n\n${counts}\n제외: ${data.excludedNoConsent ?? 0}명\n\n메시지 작성 화면으로 이동하시겠습니까?\n(취소 시 고객 그룹 탭으로 이동)`);
        if (goToMsg && firstGroupId) {
          const params = new URLSearchParams();
          params.set("site", "thecleancoffee");
          params.set("tab", "messaging");
          params.set("groupId", firstGroupId);
          params.set("channel", "sms");
          params.set("adminOverride", "true");
          window.location.search = params.toString();
        } else {
          const params = new URLSearchParams();
          params.set("site", "thecleancoffee");
          params.set("tab", "groups");
          window.location.search = params.toString();
        }
      } else {
        alert(`실험 생성 실패: ${data.error}`);
      }
    } catch (err) {
      alert(`오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className={styles.section} style={{ background: "linear-gradient(180deg, rgba(238,242,255,0.5), rgba(255,255,255,0.9))", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>A/B 테스트</h2>
          <p className={styles.sectionDesc}>
            재구매 후보를 두 그룹으로 나누어 전환율을 비교한다. 발송 후 3일 뒤 구매 전환을 측정한다.
          </p>
        </div>
      </div>

      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: 6 }}>
        ① 테스트 유형을 선택하시오
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TEST_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTestType(t.key)}
            style={{
              padding: "10px 18px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              border: testType === t.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
              background: testType === t.key ? "#eef2ff" : "#fff",
              color: testType === t.key ? "#4f46e5" : "#64748b",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left",
            }}
          >
            <span>{testType === t.key ? "✓ " : ""}{t.label}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 400, color: testType === t.key ? "#6366f1" : "#94a3b8" }}>{t.desc}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", marginBottom: 6 }}>
        ② 아래 배정 내용을 확인 후 실험을 생성하시오
      </div>
      <div style={{ marginBottom: 18, padding: "14px 18px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#4f46e5", marginBottom: 8 }}>
          생성할 실험: <span style={{ color: "#1e293b" }}>{currentType.label}</span>
          <span style={{ marginLeft: 8, fontSize: "0.68rem", fontWeight: 400, color: "#94a3b8" }}>
            필터 {minDays}~{maxDays}일 미구매 · {minOrders}회 이상 구매
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "stretch" }}>
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2563eb", letterSpacing: "0.05em" }}>A그룹</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: 2 }}>{groupAPreview.label}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2563eb", marginTop: 4 }}>{groupAPreview.count}명</div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #bfdbfe", fontSize: "0.68rem", color: "#475569", lineHeight: 1.5 }}>
              <div>일반 {fmtKRW(estimateCost(groupAPreview.count, SMS_UNIT_NORMAL))}</div>
              <div>타겟 {fmtKRW(estimateCost(groupAPreview.count, SMS_UNIT_TARGET))}</div>
            </div>
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#7c3aed", letterSpacing: "0.05em" }}>B그룹</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: 2 }}>{groupBPreview.label}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#7c3aed", marginTop: 4 }}>{groupBPreview.count}명</div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #ddd6fe", fontSize: "0.68rem", color: "#475569", lineHeight: 1.5 }}>
              <div>일반 {fmtKRW(estimateCost(groupBPreview.count, SMS_UNIT_NORMAL))}</div>
              <div>타겟 {fmtKRW(estimateCost(groupBPreview.count, SMS_UNIT_TARGET))}</div>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || currentType.targetCount < 2}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none", cursor: creating || currentType.targetCount < 2 ? "not-allowed" : "pointer",
              background: creating || currentType.targetCount < 2 ? "#94a3b8" : "#6366f1", color: "#fff", fontWeight: 700, fontSize: "0.82rem",
              minWidth: 180,
            }}
          >
            {creating ? "생성 중..." : `${currentType.label} 실험 생성`}
          </button>
        </div>
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", fontSize: "0.7rem", color: "#475569", lineHeight: 1.6 }}>
          <div><strong>합계 예상 비용 (VAT 10% 포함)</strong></div>
          <div>
            일반(15원): <strong>{fmtKRW(estimateCost(groupAPreview.count + groupBPreview.count, SMS_UNIT_NORMAL))}</strong>
            {" · "}
            타겟(20원): <strong>{fmtKRW(estimateCost(groupAPreview.count + groupBPreview.count, SMS_UNIT_TARGET))}</strong>
          </div>
          <div style={{ fontSize: "0.66rem", color: "#94a3b8", marginTop: 2 }}>
            제외 {excludedPreview}명 ({isConsentType ? "연락처 없는 고객" : "SMS 미동의 고객"}) · 유료 발송수 기준, 알림톡 성공분은 실제 과금 시 별도 단가 적용
          </div>
        </div>
      </div>

      {experiments.length > 0 && (
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "2px dashed #cbd5e1", marginBottom: 18 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>과거 실험 내역</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 10 }}>
            이미 생성된 실험의 결과를 조회한다. 필터를 바꿔도 과거 결과 숫자는 변하지 않는다.
          </div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: 6 }}>실험 목록 (클릭하여 결과 조회)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {experiments.map((exp) => {
              const expType = inferExperimentType(exp.channel);
              const typeColor = expType === "consent" ? "#059669" : expType === "channel" ? "#6366f1" : "#64748b";
              const typeBg = expType === "consent" ? "#ecfdf5" : expType === "channel" ? "#eef2ff" : "#f1f5f9";
              return (
                <button
                  key={exp.experiment_key}
                  onClick={() => setSelectedKey(exp.experiment_key)}
                  style={{
                    padding: "8px 14px", borderRadius: 8, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer",
                    border: selectedKey === exp.experiment_key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                    background: selectedKey === exp.experiment_key ? "#eef2ff" : "#fff",
                    color: selectedKey === exp.experiment_key ? "#4f46e5" : "#64748b",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.64rem", fontWeight: 700, color: typeColor, background: typeBg }}>
                    {experimentTypeLabel(exp.channel)}
                  </span>
                  {exp.name}
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                    {exp.created_at?.slice(0, 10)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {summaryLoading && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div>}

      {summary && !summaryLoading && (
        <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: 6, letterSpacing: "0.05em" }}>선택한 과거 실험 결과</div>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700,
              color: inferExperimentType(summary.experiment.channel) === "consent" ? "#059669" : "#6366f1",
              background: inferExperimentType(summary.experiment.channel) === "consent" ? "#ecfdf5" : "#eef2ff" }}>
              {experimentTypeLabel(summary.experiment.channel)}
            </span>
            <span>{summary.experiment.name}</span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "#64748b", marginBottom: 4 }}>
            전환 윈도우: {summary.conversionWindowDays}일 / 상태: {summary.experiment.status} / 생성일: {summary.experiment.created_at?.slice(0, 10)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            {summary.variants.map((v, vi) => {
              const isFirst = vi === 0;
              const accent = isFirst ? "#2563eb" : "#7c3aed";
              const bg = isFirst ? "linear-gradient(180deg, #eff6ff, #fff)" : "linear-gradient(180deg, #f5f3ff, #fff)";
              const border = isFirst ? "#bfdbfe" : "#ddd6fe";
              const VARIANT_LABELS: Record<string, string> = {
                sms: "SMS", alimtalk: "알림톡",
                consent_sms: "동의 고객 (SMS)", noconsent_sms: "미동의 고객 (SMS)",
              };
              const label = VARIANT_LABELS[v.variant_key] ?? v.variant_key;
              return (
                <div key={v.variant_key} style={{ padding: 18, borderRadius: 14, background: bg, border: `1px solid ${border}` }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {isFirst ? "A" : "B"}그룹: {label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>배정</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#334155" }}>{v.assigned}명</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>발송</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: v.sent > 0 ? "#16a34a" : "#94a3b8" }}>{v.sent}건</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>구매 전환</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: accent }}>{v.purchased}건</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>전환율</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: accent }}>
                        {v.assigned > 0 ? (v.purchaseRate * 100).toFixed(1) : "0.0"}%
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.7)", fontSize: "0.76rem", color: "#475569" }}>
                    매출: {fmtKRW(Math.round(v.revenue))} / 객단가: {fmtKRW(Math.round(v.avgOrderAmount))}
                  </div>
                  <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.7)", fontSize: "0.72rem", color: "#475569", lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: "#334155" }}>예상 비용 (VAT 10%)</div>
                    <div>
                      일반: <strong>{fmtKRW(estimateCost(v.sent || v.assigned, SMS_UNIT_NORMAL))}</strong>
                      {" · "}
                      타겟: <strong>{fmtKRW(estimateCost(v.sent || v.assigned, SMS_UNIT_TARGET))}</strong>
                    </div>
                    <div style={{ fontSize: "0.66rem", color: "#94a3b8" }}>
                      기준: {v.sent > 0 ? `발송 ${v.sent}건` : `배정 ${v.assigned}명`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {funnel && (funnel.funnel.sent > 0 || funnel.funnel.delivered > 0) && (() => {
            const steps: Array<{ label: string; count: number; rate: number | null; color: string; bg: string }> = [
              { label: "발송 완료", count: funnel.funnel.sent, rate: null, color: "#6366f1", bg: "#eef2ff" },
              { label: "발송 성공", count: funnel.funnel.delivered, rate: funnel.rates.delivery_rate, color: "#2563eb", bg: "#eff6ff" },
              { label: "사이트 방문", count: funnel.funnel.visited, rate: funnel.rates.visit_rate, color: "#d97706", bg: "#fffbeb" },
              { label: "구매 전환", count: funnel.funnel.purchased, rate: funnel.rates.purchase_rate, color: "#16a34a", bg: "#f0fdf4" },
            ];
            return (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155", marginBottom: 10 }}>
                캠페인 성과 퍼널 (4단계)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
                {steps.map((step, i) => (
                  <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ padding: "12px 18px", borderRadius: 10, background: step.bg, border: `1px solid ${step.color}22`, textAlign: "center", minWidth: 100 }}>
                      <div style={{ fontSize: "0.68rem", color: step.color, fontWeight: 600 }}>{step.label}</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: step.color, marginTop: 4 }}>{step.count}명</div>
                      {step.rate !== null && <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>{(step.rate * 100).toFixed(1)}%</div>}
                    </div>
                    {i < steps.length - 1 && <div style={{ padding: "0 6px", color: "#94a3b8", fontSize: "1.2rem" }}>→</div>}
                  </div>
                ))}
                <div style={{ marginLeft: 16, padding: "8px 14px", borderRadius: 8, background: "#f8fafc", fontSize: "0.76rem", color: "#475569" }}>
                  매출: <strong>{fmtKRW(Math.round(funnel.funnel.revenue))}</strong>
                  <br />전체 전환율: <strong style={{ color: "#16a34a" }}>{(funnel.rates.overall_rate * 100).toFixed(1)}%</strong>
                </div>
              </div>
              {funnel.variants.length > 1 && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: `repeat(${funnel.variants.length}, 1fr)`, gap: 8 }}>
                  {funnel.variants.map((v) => (
                    <div key={v.variant_key} style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.72rem" }}>
                      <div style={{ fontWeight: 700, color: "#475569" }}>{v.variant_key}</div>
                      <div>
                        발송 {v.sent} → 성공 {v.delivered} → 방문 {v.visited} → 구매 {v.purchased} ({(v.purchase_rate * 100).toFixed(1)}%)
                      </div>
                      <div>매출 {fmtKRW(Math.round(v.revenue))}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}

          {summary.variants.length > 0 && summary.variants.every((v) => v.sent === 0) && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.76rem", color: "#92400e", lineHeight: 1.7 }}>
              <strong>다음 단계:</strong> 그룹 배정 완료. 알림톡 발송 탭에서 각 그룹 대상으로 메시지를 발송한 뒤, 3일 후 전환 동기화를 실행하면 결과가 여기에 표시된다.
            </div>
          )}
        </div>
      )}

      {experiments.length === 0 && !summaryLoading && (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
          아직 생성된 A/B 실험이 없다. 위 버튼으로 첫 실험을 시작할 수 있다.
        </div>
      )}
    </section>
  );
}
