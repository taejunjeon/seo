"use client";

/**
 * 데이터 원천 최신성(source freshness) 배지.
 *
 * `/ads`에 이미 인라인으로 구현된 배지와 동일한 UX를 `/crm`에도 노출하기 위해 분리한 컴포넌트.
 * API: GET {API_BASE}/api/source-freshness
 *
 * 색상 기준:
 * - fresh: 녹색 (정상)
 * - warn: 노랑 (주의 시작)
 * - stale: 주황 (오래됨)
 * - empty: 회색 (원천에 데이터 없음)
 * - missing: 빨강 (테이블 부재)
 * - error: 빨강 (조회 실패)
 *
 * primarySources를 지정하면 그 원천만 배지로 표시. 미지정 시 기본값 사용.
 */

import { useEffect, useState } from "react";

import { API_BASE, fmtDateTime } from "./crm-utils";

type SourceFreshnessStatus = "fresh" | "warn" | "stale" | "empty" | "missing" | "error";

type SourceFreshnessResult = {
  source: string;
  storage: "bigquery" | "postgres" | "sqlite";
  table: string;
  status: SourceFreshnessStatus;
  totalRows: number | null;
  freshnessAt: string | null;
  freshnessColumn: string | null;
  ageHours: number | null;
  note: string;
};

type SourceFreshnessResponse = {
  ok: boolean;
  checkedAt: string;
  results: SourceFreshnessResult[];
  error?: string;
  message?: string;
};

const SOURCE_FRESHNESS_LABELS: Record<string, string> = {
  toss_operational: "Toss 운영",
  playauto_operational: "PlayAuto 운영",
  ga4_bigquery_thecleancoffee: "커피 GA4 BQ",
  imweb_local_orders: "Imweb local",
  attribution_ledger: "Attribution ledger",
};

const DEFAULT_PRIMARY_SOURCES = [
  "imweb_local_orders",
  "toss_operational",
  "attribution_ledger",
  "ga4_bigquery_thecleancoffee",
];

const SOURCE_FRESHNESS_PRIORITY: Record<SourceFreshnessStatus, number> = {
  error: 6,
  missing: 5,
  stale: 4,
  warn: 3,
  empty: 2,
  fresh: 1,
};

const SOURCE_FRESHNESS_COLORS: Record<SourceFreshnessStatus, { bg: string; border: string; text: string }> = {
  fresh: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  warn: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  stale: { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
  empty: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  missing: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  error: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
};

export function SourceFreshnessBadge({
  primarySources = DEFAULT_PRIMARY_SOURCES,
  title = "데이터 기준 시각",
  compact = false,
}: {
  primarySources?: string[];
  title?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<SourceFreshnessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/source-freshness`, { signal: ac.signal })
      .then((r) => r.json())
      .then((payload: SourceFreshnessResponse) => {
        if (!payload?.ok) throw new Error(payload?.message ?? payload?.error ?? "source freshness unavailable");
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        if (!ac.signal.aborted) {
          setData(null);
          setError(err instanceof Error ? err.message : "source freshness unavailable");
        }
      });
    return () => ac.abort();
  }, []);

  const rows = primarySources
    .map((source) => data?.results.find((r) => r.source === source))
    .filter((r): r is SourceFreshnessResult => Boolean(r));

  const worstStatus = data?.results.reduce<SourceFreshnessStatus>(
    (worst, r) => (SOURCE_FRESHNESS_PRIORITY[r.status] > SOURCE_FRESHNESS_PRIORITY[worst] ? r.status : worst),
    "fresh",
  ) ?? null;

  const staleCount = data?.results.filter((r) => ["error", "missing", "stale"].includes(r.status)).length ?? 0;

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: compact ? 8 : 16,
      padding: compact ? "8px 12px" : "12px 14px",
      borderRadius: 8,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}>
      <div>
        <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
          {title}
        </div>
        <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#334155", lineHeight: 1.5 }}>
          {data
            ? `${fmtDateTime(data.checkedAt)} 조회 · 전체 원천 ${staleCount > 0 ? `${staleCount}개 점검 필요` : "정상"}`
            : error
              ? `점검 실패: ${error}`
              : "원천 최신성 확인 중"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {rows.map((row) => {
          const color = SOURCE_FRESHNESS_COLORS[row.status];
          return (
            <span
              key={row.source}
              title={`${row.table} · ${row.note}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 30,
                padding: "5px 9px",
                borderRadius: 8,
                background: color.bg,
                border: `1px solid ${color.border}`,
                color: color.text,
                fontSize: "0.72rem",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{SOURCE_FRESHNESS_LABELS[row.source] ?? row.source}</span>
              <span>{row.status}</span>
              <span style={{ fontWeight: 700, color: "#64748b" }}>
                {row.ageHours != null ? `${row.ageHours}h` : "—"}
              </span>
            </span>
          );
        })}
        {!data && !error && (
          <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>loading</span>
        )}
        {worstStatus && (
          <span style={{
            padding: "5px 9px",
            borderRadius: 8,
            background: SOURCE_FRESHNESS_COLORS[worstStatus].bg,
            border: `1px solid ${SOURCE_FRESHNESS_COLORS[worstStatus].border}`,
            color: SOURCE_FRESHNESS_COLORS[worstStatus].text,
            fontSize: "0.72rem",
            fontWeight: 800,
          }}>
            worst {worstStatus}
          </span>
        )}
      </div>
    </div>
  );
}
