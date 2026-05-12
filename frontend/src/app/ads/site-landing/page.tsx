"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const LOCAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const LIVE_API_BASE = "https://att.ainativeos.net";

const fmtNum = (value: number | null | undefined) => (value ?? 0).toLocaleString("ko-KR");
const fmtKrw = (value: number | null | undefined) => `${fmtNum(value)}원`;
const fmtPct = (value: number | null | undefined) =>
  value == null ? "-" : `${(value * 100).toFixed(1)}%`;

type Site = "biocom" | "thecleancoffee";
type ApiMode = "live" | "local";

type NpayActual = {
  source: string;
  status: string;
  complete_count: number;
  complete_amount_krw: number;
  complete_amount_krw_korean?: string;
  max_payment_complete_time: string | null;
  max_order_date: string | null;
  reason: string;
  warnings: string[];
  gross_count?: number;
  gross_amount_krw?: number;
  excluded_cancel_return_exchange_count?: number;
  excluded_cancel_return_exchange_amount_krw?: number;
  confirmed_status_count?: number;
  confirmed_status_amount_krw?: number;
  status_blank_count?: number;
  status_blank_amount_krw?: number;
  max_order_time?: string | null;
  max_synced_at?: string | null;
  max_status_synced_at?: string | null;
  ga4_guard_role?: string;
};

type NpayLegacy = {
  source: string;
  role: string;
  complete_count: number;
  complete_amount_krw: number;
  max_order_time: string | null;
  warning: string;
};

type NpayBridge = {
  source: string;
  pending_count: number;
  pending_amount_krw: number;
  max_order_time: string | null;
  reason: string;
};

type Derived = {
  source_evidence_present_rate: number;
  paid_hint_count: number;
  organic_count: number;
  direct_count: number;
  referral_count: number;
  unknown_or_hold_count: number;
  raw_click_mode_count: number;
  ttl_expiring_24h_count: number;
  external_send_count: number;
  upload_candidate_count: number;
  npay_revenue_30d_actual_confirmed?: NpayActual;
  npay_revenue_30d_complete_time_legacy?: NpayLegacy;
  npay_revenue_30d_bridge_pending?: NpayBridge;
  source_disagreement_reason?: string | null;
};

type Summary = {
  ok: boolean;
  site: Site;
  total: number;
  window_hours: number;
  mode: string;
  channel_distribution: Record<string, number>;
  source_breakdown_top10: Array<{ source: string; count: number }>;
  utm_campaign_top10?: Array<{ utm_campaign: string; count: number }>;
  joinable_session_key_count: number;
  derived: Derived;
  invariants_held: {
    external_send_count: number;
    upload_candidate_count: number;
    gtm_publish: number;
    imweb_footer_edit: number;
    operational_db_write: number;
    raw_email_phone_member_payment_order_in_response: boolean;
  };
};

type ApiError = {
  status?: number;
  message: string;
  url?: string;
};

const siteLabels: Record<Site, string> = {
  biocom: "바이오컴",
  thecleancoffee: "더클린커피",
};

const apiLabels: Record<ApiMode, string> = {
  live: "Live backend",
  local: "Local backend",
};

const kpiTone = {
  good: { border: "#a7f3d0", background: "#f0fdf4", color: "#047857" },
  warn: { border: "#fde68a", background: "#fffbeb", color: "#b45309" },
  neutral: { border: "#dbeafe", background: "#eff6ff", color: "#1d4ed8" },
  muted: { border: "#e2e8f0", background: "#ffffff", color: "#334155" },
};

function KpiCard({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof kpiTone;
}) {
  const colors = kpiTone[tone];
  return (
    <div
      style={{
        minHeight: 112,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: colors.color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: keyof typeof kpiTone;
}) {
  const colors = kpiTone[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 26,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, lineHeight: 1.2 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ApiModeButton({
  value,
  current,
  onClick,
}: {
  value: ApiMode;
  current: ApiMode;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid #cbd5e1",
        background: active ? "#0f172a" : "#ffffff",
        color: active ? "#ffffff" : "#334155",
        borderRadius: 7,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {apiLabels[value]}
    </button>
  );
}

function SelectButton<T extends string>({
  value,
  current,
  label,
  onClick,
}: {
  value: T;
  current: T;
  label: string;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid #cbd5e1",
        background: active ? "#0d9488" : "#ffffff",
        color: active ? "#ffffff" : "#334155",
        borderRadius: 7,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function explainWarning(warning: string) {
  const known: Record<string, string> = {
    ga4_guard_not_actual_source: "GA4는 이미 들어간 주문인지 보는 guard일 뿐, 실제 NPay 매출 source가 아닙니다.",
    status_blank_rows_included_with_warning:
      "VM Cloud SQLite imweb_orders.imweb_status가 비어 있는 주문이 포함됐습니다. 미결제 단정이 아니라 status sync freshness 경고입니다.",
    status_sync_stale_over_6h:
      "VM Cloud SQLite imweb_orders.imweb_status_synced_at이 6시간 이상 오래됐습니다.",
    coffee_npay_no_rows_in_window:
      "현재 선택한 backend의 VM Cloud/로컬 SQLite imweb_orders에 더클린커피 NPay row가 없습니다.",
  };
  return known[warning] ?? warning;
}

export default function SiteLandingSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [site, setSite] = useState<Site>("thecleancoffee");
  const [apiMode, setApiMode] = useState<ApiMode>("live");

  const apiBase = apiMode === "live" ? LIVE_API_BASE : LOCAL_API_BASE;
  const requestUrl = useMemo(
    () =>
      `${apiBase}/api/attribution/site-landing/summary?site=${encodeURIComponent(site)}&windowHours=${windowHours}`,
    [apiBase, site, windowHours],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetch(requestUrl, { signal: ac.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw {
            status: response.status,
            message: payload?.error || payload?.message || response.statusText || "unknown_error",
            url: requestUrl,
          };
        }
        setSummary(payload as Summary);
        setErr(null);
      })
      .catch((error) => {
        if (ac.signal.aborted) return;
        setSummary(null);
        setErr({
          status: typeof error?.status === "number" ? error.status : undefined,
          message: error?.message || String(error),
          url: requestUrl,
        });
      })
    return () => ac.abort();
  }, [requestUrl]);

  const actual = summary?.derived?.npay_revenue_30d_actual_confirmed;
  const legacy = summary?.derived?.npay_revenue_30d_complete_time_legacy;
  const bridge = summary?.derived?.npay_revenue_30d_bridge_pending;
  const hasStatusBlank = (actual?.status_blank_count ?? 0) > 0;
  const warningTone = actual?.status === "included_with_warning" ? "warn" : "good";

  return (
    <main style={{ minHeight: "100vh", padding: "28px 28px 60px", fontFamily: "system-ui", color: "#0f172a" }}>
      <header style={{ maxWidth: 1180, margin: "0 auto 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 8 }}>아임웹 유입·NPay actual 대시보드</h1>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              고객 유입 장부와 NPay 실제 결제 후보를 함께 봅니다. Google Ads/GA4/Meta/TikTok 전송 없이 read-only로 조회합니다.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ApiModeButton value="live" current={apiMode} onClick={() => setApiMode("live")} />
            <ApiModeButton value="local" current={apiMode} onClick={() => setApiMode("local")} />
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginRight: 2 }}>사이트</span>
            {(["thecleancoffee", "biocom"] as Site[]).map((item) => (
              <SelectButton key={item} value={item} current={site} label={siteLabels[item]} onClick={() => setSite(item)} />
            ))}
            <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", margin: "0 2px 0 12px" }}>윈도우</span>
            {[24, 72, 168].map((hours) => (
              <button
                key={hours}
                onClick={() => setWindowHours(hours)}
                style={{
                  border: "1px solid #cbd5e1",
                  background: windowHours === hours ? "#334155" : "#ffffff",
                  color: windowHours === hours ? "#ffffff" : "#334155",
                  borderRadius: 7,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {hours}h
              </button>
            ))}
            {summary && <Pill tone="good">API 200</Pill>}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            API: {requestUrl}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {err && (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>API 오류</div>
            <div style={{ fontSize: 13 }}>
              {err.status ? `${err.status} ` : ""}
              {err.message}
            </div>
            <div style={{ fontSize: 12, marginTop: 8, color: "#991b1b", overflowWrap: "anywhere" }}>{err.url}</div>
          </div>
        )}

        {summary && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              <KpiCard
                label="NPay actual source"
                value={actual?.status ?? "-"}
                sub={actual?.source ?? "source 없음"}
                tone={warningTone}
              />
              <KpiCard
                label="actual 후보 매출"
                value={fmtKrw(actual?.complete_amount_krw)}
                sub={`${fmtNum(actual?.complete_count)}건 · ${siteLabels[site]}`}
                tone="good"
              />
              <KpiCard
                label="status blank"
                value={`${fmtNum(actual?.status_blank_count)}건`}
                sub={`${fmtKrw(actual?.status_blank_amount_krw)} · VM Cloud SQLite imweb_orders.imweb_status`}
                tone={hasStatusBlank ? "warn" : "good"}
              />
              <KpiCard
                label="legacy complete_time"
                value={fmtKrw(legacy?.complete_amount_krw)}
                sub={`${fmtNum(legacy?.complete_count)}건 · 진단값`}
                tone="muted"
              />
              <KpiCard
                label="bridge pending"
                value={fmtKrw(bridge?.pending_amount_krw)}
                sub={`${fmtNum(bridge?.pending_count)}건 · 주문 bridge 진단`}
                tone="neutral"
              />
            </div>

            {actual?.warnings?.length ? (
              <Section title="경고와 해석">
                <div style={{ display: "grid", gap: 8 }}>
                  {actual.warnings.map((warning) => (
                    <div
                      key={warning}
                      style={{
                        border: "1px solid #fde68a",
                        background: "#fffbeb",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: "#92400e",
                      }}
                    >
                      <strong>{warning}</strong>
                      <div>{explainWarning(warning)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section title="status blank 원인 단서" action={<Pill tone={hasStatusBlank ? "warn" : "good"}>{hasStatusBlank ? "확인 필요" : "blank 없음"}</Pill>}>
              <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
                <p>
                  위치: VM Cloud SQLite <strong>/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3</strong>의{" "}
                  <strong>imweb_orders.imweb_status</strong>.
                </p>
                <p>
                  현재 latest order sync는 <strong>{actual?.max_synced_at ?? "-"}</strong>, latest status sync는{" "}
                  <strong>{actual?.max_status_synced_at ?? "-"}</strong>입니다. 주문 수집이 status 수집보다 최신이면 새 주문의
                  <strong> imweb_status</strong>가 비어 있을 수 있습니다.
                </p>
                <p>
                  이 값은 미결제 확정 근거가 아닙니다. 그래서 actual에는 포함하되 `included_with_warning`으로 표시합니다.
                </p>
              </div>
            </Section>

            <Section title="유입 장부 요약">
              {summary.total < 50 && (
                <div style={{ background: "#fff8e1", border: "1px solid #ffd54f", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  표본 {fmtNum(summary.total)}건은 작은 표본입니다. 비율 해석은 50건 이상부터 봅니다.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <KpiCard label="총 row" value={fmtNum(summary.total)} sub={`${summary.window_hours}h window · ${summary.mode}`} />
                <KpiCard
                  label="source evidence present"
                  value={fmtPct(summary.derived?.source_evidence_present_rate)}
                  sub={`joinable sessionKey ${fmtNum(summary.joinable_session_key_count)}`}
                />
                <KpiCard
                  label="paid / organic / direct"
                  value={`${fmtNum(summary.derived?.paid_hint_count)} / ${fmtNum(summary.derived?.organic_count)} / ${fmtNum(summary.derived?.direct_count)}`}
                  sub={`unknown ${fmtNum(summary.derived?.unknown_or_hold_count)}`}
                />
                <KpiCard
                  label="no-send guard"
                  value={`${fmtNum(summary.invariants_held.external_send_count)} send / ${fmtNum(summary.invariants_held.upload_candidate_count)} upload`}
                  sub={`DB write ${fmtNum(summary.invariants_held.operational_db_write)} · GTM publish ${fmtNum(summary.invariants_held.gtm_publish)}`}
                  tone="good"
                />
              </div>
            </Section>

            <Section title="source breakdown top10">
              <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 8, overflow: "hidden" }}>
                {summary.source_breakdown_top10.length === 0 ? (
                  <div style={{ color: "#64748b", padding: 14, fontSize: 13 }}>데이터 없음</div>
                ) : (
                  summary.source_breakdown_top10.map((row) => (
                    <div
                      key={row.source}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 90px",
                        gap: 12,
                        padding: "10px 14px",
                        borderTop: "1px solid #f1f5f9",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ overflowWrap: "anywhere" }}>{row.source}</span>
                      <strong style={{ textAlign: "right" }}>{fmtNum(row.count)}</strong>
                    </div>
                  ))
                )}
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
