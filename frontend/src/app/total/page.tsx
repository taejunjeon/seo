"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type FreshnessKey =
  | "fresh"
  | "local_cache"
  | "blocked"
  | "blocked_or_empty"
  | "fallback"
  | "error"
  | "not_queried"
  | "unavailable";

type ChannelRow = {
  primary_channel: string;
  orders: number;
  revenue: number;
  confidence: Record<string, number>;
  share_of_confirmed_revenue: number | null;
  display_label: string;
};

type PlatformRow = {
  platform?: "meta" | "tiktok" | "google" | "naver" | string;
  internalChannel?: string;
  internalConfirmed?: {
    orders: number;
    revenue: number;
    confidenceRevenue?: Record<string, number>;
  };
  platformReference?: {
    status?: string;
    source?: string;
    spendKrw?: number | null;
    conversionValueKrw?: number | null;
    roas?: number | null;
    attributionWindow?: string | null;
    actionReportTime?: string | null;
    queriedAt?: string | null;
    freshness?: FreshnessKey | string;
    sourceWindow?: { startDate?: string | null; endDate?: string | null; latestDate?: string | null };
    sourceDiagnostics?: Record<string, unknown> | null;
    error?: string | null;
  };
  gap?: {
    conversionValueMinusInternalRevenue: number | null;
    roasDelta?: number | null;
    reason?: string | null;
  };
  allowedUse?: string;
  forbiddenUse?: string;
};

type SourceFreshnessRow = {
  source: string;
  role: string;
  status: string;
  queried_at?: string | null;
  latest_observed_at?: string | null;
  row_count?: number | null;
  confidence?: string;
  fallback?: boolean;
  fallback_reason?: string | null;
  summary?: unknown;
};

type ApiResponse = {
  ok: true;
  metadata: {
    contract_version: string;
    site: string;
    month: string;
    timezone: string;
    date_start: string;
    date_end_exclusive: string;
    queried_at: string;
    mode: string;
    write: boolean;
    send: boolean;
    deploy: boolean;
    source_contracts: { spine: string; evidence: string };
  };
  monthly_spine: {
    confirmed_net_revenue_ab: number;
    review_revenue_c: number;
    quarantine_revenue_d: number;
    toss_only_month_boundary_revenue: number;
    net_revenue_candidate_including_c: number;
    primary_sum_matches_revenue: boolean;
    join_methods: unknown[];
  };
  evidence: {
    assignment_version: string;
    totals: {
      orders_total_ab: number;
      revenue_total_ab: number;
      assigned_orders: number;
      assigned_revenue: number;
      unknown_orders: number;
      unknown_revenue: number;
      primary_sum_matches_revenue: boolean;
    };
    channel_summary: ChannelRow[];
    unknown_reasons: Array<{
      reason?: string;
      unknownReason?: string;
      orders: number;
      revenue: number;
    }>;
    evidence_tier_summary: unknown[];
    npay_intent_status_summary: unknown[];
  };
  platform_reference: {
    rows?: PlatformRow[];
    joinStatus?: string;
    [k: string]: unknown;
  };
  source_freshness: SourceFreshnessRow[];
  frontend_copy: {
    headline: string;
    subtext: string;
    warnings: string[];
  };
};

type ApiError = { ok: false; error: string };

const fmtKRW = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "-";
  if (v === 0) return "₩0";
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
const fmtNum = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : v.toLocaleString("ko-KR");
const fmtRoas = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : v.toFixed(2);
const fmtPct = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? "-" : `${(v * 100).toFixed(1)}%`;
const fmtTs = (v: string | null | undefined) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return v;
  }
};

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta 광고",
  tiktok: "TikTok 광고",
  google: "Google 광고",
  naver: "Naver 광고 (참고)",
};

const FRESHNESS_LABEL: Record<string, { text: string; tone: "green" | "yellow" | "red" | "neutral" }> = {
  fresh: { text: "fresh — 플랫폼 source 최신", tone: "green" },
  local_cache: { text: "local cache — 원본 대조 필요", tone: "yellow" },
  blocked: { text: "blocked — 권한·원천 미연결", tone: "red" },
  blocked_or_empty: { text: "blocked / empty — 미연결", tone: "red" },
  fallback: { text: "fallback — 판단 보류", tone: "red" },
  error: { text: "error — 조회 실패", tone: "red" },
  not_queried: { text: "not queried", tone: "neutral" },
  unavailable: { text: "unavailable", tone: "red" },
};

const STATUS_BADGE: Record<string, { text: string; tone: "green" | "yellow" | "red" | "neutral" }> = {
  joined: { text: "joined", tone: "green" },
  partial_join: { text: "partial join", tone: "yellow" },
  skeleton_only: { text: "skeleton only", tone: "neutral" },
  unavailable: { text: "unavailable", tone: "red" },
  not_joined: { text: "not joined", tone: "red" },
};

function FreshBadge({ freshness }: { freshness?: string }) {
  const meta = FRESHNESS_LABEL[freshness || "not_queried"] || FRESHNESS_LABEL.not_queried;
  const cls =
    meta.tone === "green"
      ? styles.badgeFresh
      : meta.tone === "yellow"
      ? styles.badgeLocal
      : meta.tone === "red"
      ? styles.badgeBlocked
      : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{meta.text}</span>;
}

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_BADGE[status || ""] || { text: status || "-", tone: "neutral" as const };
  const cls =
    meta.tone === "green"
      ? styles.badgeFresh
      : meta.tone === "yellow"
      ? styles.badgeLocal
      : meta.tone === "red"
      ? styles.badgeBlocked
      : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{meta.text}</span>;
}

type DiagnosticEntry = {
  scope: string;
  source?: string;
  platform?: string;
  freshness?: string;
  latestDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  importedRows?: number | null;
  usableRows?: number | null;
  rowCount?: number | null;
  warning?: string | null;
  budgetDecisionImpact: "usable" | "reference_only" | "blocked";
  error?: string | null;
  fallbackReason?: string | null;
};

function normalizeDiagnostics(data: ApiResponse): DiagnosticEntry[] {
  const out: DiagnosticEntry[] = [];

  for (const platform of data.platform_reference.rows || []) {
    const ref = platform.platformReference || {};
    const diag = (ref.sourceDiagnostics || {}) as Record<string, unknown>;
    const dailyTable = (diag.dailyTable || null) as Record<string, unknown> | null;
    const warnings = (diag.warnings || null) as unknown[] | null;
    const freshness = ref.freshness || "not_queried";
    const impact: DiagnosticEntry["budgetDecisionImpact"] =
      freshness === "fresh"
        ? "usable"
        : freshness === "local_cache"
        ? "reference_only"
        : "blocked";

    const numOr = (v: unknown): number | null => (typeof v === "number" ? v : null);
    const importedRows =
      numOr(dailyTable?.importedRows) ??
      numOr(diag.importedRowCount) ??
      numOr(diag.importedRows) ??
      null;
    const usableRows =
      numOr(dailyTable?.rows) ??
      numOr(diag.usableRowCount) ??
      numOr(diag.usableRows) ??
      null;
    const rowCount = numOr(diag.rows) ?? numOr(diag.rowCount) ?? null;
    const warning =
      Array.isArray(warnings) && warnings.length
        ? warnings.filter((w) => typeof w === "string").join(" / ")
        : typeof diag.warning === "string"
        ? (diag.warning as string)
        : null;

    out.push({
      scope: "platform_reference",
      platform: platform.platform,
      source: ref.source ?? undefined,
      freshness,
      latestDate: ref.sourceWindow?.latestDate ?? (dailyTable?.maxDate as string | undefined) ?? null,
      startDate: ref.sourceWindow?.startDate ?? (dailyTable?.minDate as string | undefined) ?? null,
      endDate: ref.sourceWindow?.endDate ?? (dailyTable?.maxDate as string | undefined) ?? null,
      importedRows,
      usableRows,
      rowCount,
      warning,
      budgetDecisionImpact: impact,
      error: ref.error ?? null,
    });
  }

  for (const src of data.source_freshness) {
    if (src.role === "platform_reference") continue;
    const isFresh = src.status === "fresh";
    const isStale = ["blocked", "blocked_or_empty", "fallback", "error", "unavailable"].includes(src.status);
    out.push({
      scope: src.role,
      source: src.source,
      freshness: src.status,
      latestDate: src.latest_observed_at ?? null,
      rowCount: src.row_count ?? null,
      budgetDecisionImpact: isFresh ? "usable" : isStale ? "blocked" : "reference_only",
      warning: null,
      fallbackReason: src.fallback_reason ?? null,
    });
  }

  return out;
}

function PlatformCard({ row }: { row: PlatformRow }) {
  const ref = row.platformReference || {};
  const internal = row.internalConfirmed || { orders: 0, revenue: 0 };
  const gap = row.gap?.conversionValueMinusInternalRevenue ?? null;
  const fresh = ref.freshness || "not_queried";
  const isTikTokWarn = row.platform === "tiktok" && fresh === "local_cache";
  const isBlocked = ["blocked", "blocked_or_empty", "fallback", "error", "unavailable"].includes(fresh);
  const cardCls = `${styles.pCard} ${
    isTikTokWarn ? styles.warn : isBlocked ? styles.blocked : ""
  }`.trim();

  const naverCandidateNote =
    row.platform === "naver" && (internal.revenue || 0) > 0
      ? "내부 후보 매출은 NaPm 클릭ID 또는 paid UTM 기반입니다. Naver Ads 플랫폼 확정 매출이 아닙니다."
      : null;

  return (
    <div className={cardCls}>
      <div className={styles.pCardHead}>
        <h3>{PLATFORM_LABEL[row.platform || ""] || row.platform}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StatusBadge status={ref.status} />
          <FreshBadge freshness={fresh} />
          <span className={styles.refLabel}>참고값</span>
        </div>
      </div>

      <dl className={styles.pNums}>
        <dt>내부 확정 매출</dt>
        <dd>{fmtKRW(internal.revenue)}</dd>
        <dt>내부 확정 주문</dt>
        <dd>{fmtNum(internal.orders)}건</dd>
        <dt>플랫폼 주장값</dt>
        <dd>{fmtKRW(ref.conversionValueKrw ?? null)}</dd>
        <dt>광고비</dt>
        <dd>{fmtKRW(ref.spendKrw ?? null)}</dd>
        <dt>플랫폼 ROAS</dt>
        <dd>{fmtRoas(ref.roas)}</dd>
        <dt>gap (플랫폼 − 내부)</dt>
        <dd className={`${styles.gap} ${gap != null && gap > 0 ? styles.pos : styles.neg}`}>
          {gap == null ? "-" : (gap > 0 ? "+" : "") + fmtKRW(gap)}
        </dd>
      </dl>

      {isTikTokWarn && (
        <div className={styles.warnNote}>
          <strong>TikTok 강경고.</strong> 값은 로컬 cache(<code>tiktok_ads_daily</code>) 기준이며, 구매값은 한국어 export 의 중복 구매 헤더를 추정한 결과입니다. Ads Manager 원본 대조 전까지 ROAS {fmtRoas(ref.roas)} 는 예산 판단에 사용하지 마세요. <em>reference_only</em>.
        </div>
      )}

      {isBlocked && (
        <div className={styles.blockedNote}>
          {row.platform === "naver"
            ? "Naver Ads source 는 아직 연결되지 않았습니다. 광고비·플랫폼 주장값·ROAS 는 산출 보류입니다."
            : `${ref.error || "source 미연결"} — 예산 판단 보류.`}
        </div>
      )}

      {naverCandidateNote && <div className={styles.warnNote}>{naverCandidateNote}</div>}

      <ul className={styles.diagList}>
        {ref.source && (
          <li>
            source: <code>{ref.source}</code>
          </li>
        )}
        {ref.sourceWindow && (ref.sourceWindow.startDate || ref.sourceWindow.endDate) && (
          <li>
            window: <code>{ref.sourceWindow.startDate || "?"}</code>~<code>{ref.sourceWindow.endDate || "?"}</code>
            {ref.sourceWindow.latestDate ? (
              <>
                {" "}
                · latest <code>{ref.sourceWindow.latestDate}</code>
              </>
            ) : null}
          </li>
        )}
        {ref.attributionWindow && (
          <li>
            attribution window: <code>{ref.attributionWindow}</code>
          </li>
        )}
        {ref.queriedAt && <li>queried at: {fmtTs(ref.queriedAt)}</li>}
      </ul>
    </div>
  );
}

export default function TotalPage() {
  const [month, setMonth] = useState("2026-04");
  const [draftMonth, setDraftMonth] = useState("2026-04");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${API_BASE}/api/total/monthly-channel-summary?site=biocom&month=${encodeURIComponent(
      month,
    )}&mode=dry_run`;
    fetch(url)
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse | ApiError;
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setError("error" in json ? json.error : `HTTP ${res.status}`);
          setData(null);
        } else {
          setData(json);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "fetch failed");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const diagnostics = useMemo(() => (data ? normalizeDiagnostics(data) : []), [data]);
  const stale = diagnostics.filter((d) => d.budgetDecisionImpact !== "usable");
  const submitMonth = () => {
    setLoading(true);
    setError(null);
    setMonth(draftMonth);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>총 월별 채널 매출 ( /total )</h1>
      <p className={styles.subtitle}>
        이번 달 실제 확정 매출이 어느 유입 채널에서 왔는지 빠르게 판단하기 위한 화면입니다. 내부 확정 매출과 플랫폼 주장값은 절대 합산하지 않습니다.
      </p>

      <div className={styles.controls}>
        <label>
          월:
          <input
            type="month"
            value={draftMonth}
            min="2024-01"
            max="2026-12"
            onChange={(e) => setDraftMonth(e.target.value)}
          />
        </label>
        <button type="button" onClick={submitMonth}>
          조회
        </button>
        {data && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            site=<code>{data.metadata.site}</code> · queried{" "}
            <code>{fmtTs(data.metadata.queried_at)}</code> · mode=<code>{data.metadata.mode}</code>{" "}
            · contract <code>{data.metadata.contract_version}</code>
          </span>
        )}
      </div>

      {loading && <div className={styles.loading}>불러오는 중…</div>}

      {error && (
        <div className={styles.errorBox}>
          API 호출 실패: <code>{error}</code>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            backend route 가 운영 7020 포트에 미반영일 수 있습니다. 로컬 검증은{" "}
            <code>PORT=7022 npm exec -- tsx src/server.ts</code> 로 띄워 NEXT_PUBLIC_API_BASE_URL 을
            <code>http://localhost:7022</code> 로 지정하세요.
          </div>
        </div>
      )}

      {data && (
        <>
          <div className={styles.warningBanner}>
            <strong>읽기 전 주의 5가지</strong>
            <ul>
              <li>
                내부 확정 순매출은 <code>monthly_spine.confirmed_net_revenue_ab</code>(아임웹+토스 정본) 기준입니다. 플랫폼 주장값을 더하지 않습니다.
              </li>
              <li>
                <code>fresh</code> 는 <em>플랫폼 source 가 최신</em>이라는 뜻이지, 그 플랫폼 value 가 내부 정본 매출이라는 뜻이 아닙니다.
              </li>
              <li>
                TikTok ROAS 는 <code>local_cache</code> + 한국어 export 중복 구매 헤더 추정 기준입니다. Ads Manager 원본 대조 전까지 예산 판단에 쓰지 마세요.
              </li>
              <li>
                Naver 내부 후보 매출은 <code>NaPm</code> 또는 paid UTM 기반 후보이고 Naver Ads 플랫폼 확정 매출이 아닙니다. Naver Ads spend/value/ROAS 는 source 미연결로 보류 상태입니다.
              </li>
              <li>
                NPay intent source 가 연결되기 전까지 NPay confirmed 주문의 matched/unmatched 분포는 확정하지 않습니다.
              </li>
            </ul>
          </div>

          {stale.length > 0 && (
            <div className={styles.warningBanner} style={{ background: "#fef2f2", borderColor: "#fecaca", borderLeftColor: "#dc2626" }}>
              <strong>예산 판단 보류 source ({stale.length})</strong>
              <ul>
                {stale.map((d, i) => (
                  <li key={`${d.scope}-${d.source}-${i}`}>
                    <code>{d.source || d.platform || d.scope}</code> — {d.freshness}
                    {d.warning ? ` · ${d.warning}` : ""}
                    {d.fallbackReason ? ` · ${d.fallbackReason}` : ""}
                    {d.error ? ` · ${d.error}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.kpiRow}>
            <div className={`${styles.kpiCard} ${styles.primary}`}>
              <span className={styles.kpiLabel}>① 내부 확정 순매출 (A/B)</span>
              <span className={`${styles.kpiValue} ${styles.large}`}>
                {fmtKRW(data.monthly_spine.confirmed_net_revenue_ab)}
              </span>
              <span className={styles.kpiSub}>
                아임웹 주문 × 토스 결제·취소 정본
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>② 분류 완료 매출</span>
              <span className={styles.kpiValue}>{fmtKRW(data.evidence.totals.assigned_revenue)}</span>
              <span className={styles.kpiSub}>{fmtNum(data.evidence.totals.assigned_orders)}건 — 채널 증거 OK</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>③ 미분류 매출</span>
              <span className={styles.kpiValue}>{fmtKRW(data.evidence.totals.unknown_revenue)}</span>
              <span className={styles.kpiSub}>
                {fmtNum(data.evidence.totals.unknown_orders)}건 — 매출 0 아님, 유입 증거 부족
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>④ 채널 ( primary )</span>
              <span className={styles.kpiValue}>{fmtNum(data.evidence.channel_summary.length)}</span>
              <span className={styles.kpiSub}>1차 채널 분류 — assist 는 합계 미반영</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>⑤ Source 경고</span>
              <span className={styles.kpiValue} style={{ color: stale.length ? "#b91c1c" : "#16a34a" }}>
                {fmtNum(stale.length)}
              </span>
              <span className={styles.kpiSub}>
                {stale.length ? "예산 판단 보류 source 수" : "모든 source fresh"}
              </span>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              A/B 확정 vs 후보 차이
              <small>candidate(A/B/C) − confirmed(A/B) = review_revenue_c</small>
            </h2>
            <p className={styles.sectionDesc}>
              spine dry-run 의 후보값({fmtKRW(data.monthly_spine.net_revenue_candidate_including_c)})과
              A/B 확정값({fmtKRW(data.monthly_spine.confirmed_net_revenue_ab)})의 차이는{" "}
              {fmtKRW(
                data.monthly_spine.net_revenue_candidate_including_c -
                  data.monthly_spine.confirmed_net_revenue_ab,
              )}{" "}
              이며, <code>imweb_virtual_without_toss</code>(가상계좌 결제 완료, 토스 매칭 미확인) 가 C
              review 로 격리된 결과입니다.
            </p>
            <div className={styles.diffCard}>
              <div className={styles.diffGrid}>
                <div className={styles.diffCell}>
                  <div className={styles.kpiLabel}>confirmed_net_revenue_ab</div>
                  <div className={styles.kpiValue}>{fmtKRW(data.monthly_spine.confirmed_net_revenue_ab)}</div>
                  <div className={styles.kpiSub}>예산·내부 정본 기준</div>
                </div>
                <div className={styles.diffCell}>
                  <div className={styles.kpiLabel}>net_revenue_candidate_including_c</div>
                  <div className={styles.kpiValue}>
                    {fmtKRW(data.monthly_spine.net_revenue_candidate_including_c)}
                  </div>
                  <div className={styles.kpiSub}>참고: A/B/C 합산 후보</div>
                </div>
                <div className={`${styles.diffCell} ${styles.exclude}`}>
                  <div className={styles.kpiLabel}>excluded_from_ab (review_revenue_c)</div>
                  <div className={styles.kpiValue}>{fmtKRW(data.monthly_spine.review_revenue_c)}</div>
                  <div className={styles.kpiSub}>
                    reason: <code>imweb_virtual_without_toss_review</code>
                  </div>
                </div>
              </div>
              <div className={styles.diffNote}>
                참고: <code>toss_only_month_boundary_revenue</code>{" "}
                {fmtKRW(data.monthly_spine.toss_only_month_boundary_revenue)} ·{" "}
                <code>quarantine_revenue_d</code>{" "}
                {fmtKRW(data.monthly_spine.quarantine_revenue_d)}. 두 값은 모두 A/B 확정에 포함되지
                않으며 별도 격리되어 close 전 점검 대상입니다.
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              채널별 내부 확정 매출
              <small>
                A/B confidence 기준 · primary_channel 합 ={" "}
                {fmtKRW(data.evidence.totals.revenue_total_ab)}
              </small>
            </h2>
            <p className={styles.sectionDesc}>
              이 표의 값은 <strong>내부 정본 매출</strong>이며 광고 플랫폼 주장값과 합산하지 않습니다.
              <code> assist_channels</code> 는 합계 중복 반영을 막기 위해 포함하지 않았습니다.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>채널</th>
                  <th style={{ textAlign: "right" }}>주문</th>
                  <th style={{ textAlign: "right" }}>매출</th>
                  <th style={{ textAlign: "right" }}>비중</th>
                  <th style={{ textAlign: "right" }}>A confidence</th>
                  <th style={{ textAlign: "right" }}>B confidence</th>
                  <th>참고</th>
                </tr>
              </thead>
              <tbody>
                {data.evidence.channel_summary
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((row) => (
                    <tr key={row.primary_channel}>
                      <td>
                        <strong>{row.display_label}</strong>{" "}
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>{row.primary_channel}</span>
                      </td>
                      <td className={styles.num}>{fmtNum(row.orders)}</td>
                      <td className={styles.num}>{fmtKRW(row.revenue)}</td>
                      <td className={styles.num}>{fmtPct(row.share_of_confirmed_revenue)}</td>
                      <td className={styles.num}>{fmtKRW(row.confidence?.A ?? 0)}</td>
                      <td className={styles.num}>{fmtKRW(row.confidence?.B ?? 0)}</td>
                      <td style={{ fontSize: 11.5, color: "#64748b" }}>
                        {row.primary_channel === "paid_naver"
                          ? "NaPm 클릭ID 또는 paid UTM 기반 내부 후보 (Naver Ads 확정 매출 아님)"
                          : row.primary_channel === "npay"
                          ? "NPay confirmed — intent source 연결 전까지 matched/unmatched 확정 보류"
                          : row.primary_channel === "unknown"
                          ? "유입 증거 부족 — 매출이 없는 게 아님"
                          : ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              플랫폼 참고값 (광고 플랫폼 주장값)
              <small>합산 금지 · reference only · do_not_add_to_internal_confirmed_revenue</small>
            </h2>
            <p className={styles.sectionDesc}>
              아래 카드의 모든 플랫폼 ROAS 와 conversion value 는 광고 플랫폼이 자기 attribution 기준으로 주장한 참고값입니다. 내부 확정 매출에 더하지 마세요.
            </p>
            <div className={styles.platformGrid}>
              {(data.platform_reference.rows || []).map((row, i) => (
                <PlatformCard key={`${row.platform}-${i}`} row={row} />
              ))}
            </div>
          </section>

          {data.evidence.unknown_reasons && data.evidence.unknown_reasons.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                미분류 사유 (drilldown)
                <small>합계 = {fmtKRW(data.evidence.totals.unknown_revenue)}</small>
              </h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>reason</th>
                    <th style={{ textAlign: "right" }}>주문</th>
                    <th style={{ textAlign: "right" }}>매출</th>
                  </tr>
                </thead>
                <tbody>
                  {data.evidence.unknown_reasons
                    .slice()
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((r) => {
                      const key = r.reason || r.unknownReason || "unknown";
                      return (
                        <tr key={key}>
                          <td>
                            <code>{key}</code>
                          </td>
                          <td className={styles.num}>{fmtNum(r.orders)}</td>
                          <td className={styles.num}>{fmtKRW(r.revenue)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Source freshness
              <small>fresh = 플랫폼 source 최신. 정본 매출 의미 아님.</small>
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>source</th>
                  <th>role</th>
                  <th>status</th>
                  <th>conf</th>
                  <th>queried at</th>
                  <th>latest observed</th>
                  <th>fallback / reason</th>
                </tr>
              </thead>
              <tbody>
                {data.source_freshness.map((s, i) => (
                  <tr key={`${s.source}-${i}`}>
                    <td>
                      <code>{s.source}</code>
                    </td>
                    <td style={{ fontSize: 12 }}>{s.role}</td>
                    <td>
                      <FreshBadge freshness={s.status} />
                    </td>
                    <td>{s.confidence || "-"}</td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>{fmtTs(s.queried_at)}</td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>{fmtTs(s.latest_observed_at)}</td>
                    <td style={{ fontSize: 11.5, color: "#7c2d12" }}>
                      {s.fallback ? "fallback · " : ""}
                      {s.fallback_reason || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              sourceDiagnostics (정규화 배열)
              <small>
                Codex 가 route 응답에 통일해주기로 한 형태. 현재는 프론트에서 즉시 파생.
              </small>
            </h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>scope</th>
                  <th>source</th>
                  <th>freshness</th>
                  <th>window / latest</th>
                  <th style={{ textAlign: "right" }}>imported</th>
                  <th style={{ textAlign: "right" }}>usable</th>
                  <th>warning / impact</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.map((d, i) => (
                  <tr key={`diag-${i}`}>
                    <td style={{ fontSize: 11.5 }}>{d.scope}</td>
                    <td>
                      <code>{d.source || d.platform || "-"}</code>
                    </td>
                    <td>
                      <FreshBadge freshness={d.freshness} />
                    </td>
                    <td style={{ fontSize: 11.5, color: "#475569" }}>
                      {d.startDate || d.endDate
                        ? `${d.startDate || "?"} ~ ${d.endDate || "?"}`
                        : "-"}
                      {d.latestDate ? ` (latest ${d.latestDate})` : ""}
                    </td>
                    <td className={styles.num}>{fmtNum(d.importedRows ?? d.rowCount ?? null)}</td>
                    <td className={styles.num}>{fmtNum(d.usableRows ?? null)}</td>
                    <td style={{ fontSize: 11.5 }}>
                      <strong style={{ color: d.budgetDecisionImpact === "usable" ? "#166534" : d.budgetDecisionImpact === "reference_only" ? "#92400e" : "#991b1b" }}>
                        {d.budgetDecisionImpact}
                      </strong>
                      {d.warning ? ` · ${d.warning}` : ""}
                      {d.fallbackReason ? ` · ${d.fallbackReason}` : ""}
                      {d.error ? ` · ${d.error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.glossary}>
              <strong>용어:</strong> <code>fresh</code>=플랫폼 source 최신 (단, 내부 정본 매출 의미 아님) · <code>local_cache</code>=로컬 cache, 원본 대조 전 참고용 · <code>blocked</code>=권한·원천 미연결, 예산 판단 보류 · <code>budgetDecisionImpact: usable</code>=예산 판단 사용 가능, <code>reference_only</code>=참고만, <code>blocked</code>=보류.
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>headline / API 메타</h2>
            <div className={styles.diffCard}>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>
                <strong>{data.frontend_copy.headline}</strong>
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#475569" }}>
                {data.frontend_copy.subtext}
              </p>
              <ul className={styles.diagList}>
                <li>
                  contract: <code>{data.metadata.contract_version}</code> · spine{" "}
                  <code>{data.metadata.source_contracts.spine}</code> · evidence{" "}
                  <code>{data.metadata.source_contracts.evidence}</code>
                </li>
                <li>
                  window: <code>{data.metadata.date_start}</code> ~{" "}
                  <code>{data.metadata.date_end_exclusive}</code> ({data.metadata.timezone}) · mode=
                  <code>{data.metadata.mode}</code> · write=<code>{String(data.metadata.write)}</code>{" "}
                  · send=<code>{String(data.metadata.send)}</code> · deploy=
                  <code>{String(data.metadata.deploy)}</code>
                </li>
                <li>
                  primary sum matches revenue:{" "}
                  <code>{String(data.monthly_spine.primary_sum_matches_revenue)}</code>
                </li>
              </ul>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
