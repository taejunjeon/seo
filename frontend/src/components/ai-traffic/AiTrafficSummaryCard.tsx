"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiTrafficReport } from "./types";
import styles from "./AiTraffic.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7020";
const fmt = (n: number) => n.toLocaleString("ko-KR");

export interface AiTrafficSummaryCardProps {
  /** "→ 상세 분석" 클릭 시 Tab 5로 이동 */
  onNavigateToDetail?: () => void;
}

/** YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 변화율 계산 (prev→curr). prev가 0이면 null 반환 */
function calcChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

export default function AiTrafficSummaryCard({ onNavigateToDetail }: AiTrafficSummaryCardProps) {
  const [data, setData] = useState<AiTrafficReport | null>(null);
  const [prevData, setPrevData] = useState<AiTrafficReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      /* 현재 30일 */
      const end = new Date();
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      const qs = `startDate=${toDateStr(start)}&endDate=${toDateStr(end)}`;

      const res = await fetch(`${API_BASE}/api/ga4/ai-traffic?${qs}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error();
      const json: AiTrafficReport = await res.json();
      setData(json);
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
    } finally {
      setLoading(false);
    }

    /* 이전 30일 (비동기, 메인 로딩 차단 안 함) */
    try {
      const prevEnd = new Date();
      prevEnd.setDate(prevEnd.getDate() - 31);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 29);
      const prevQs = `startDate=${toDateStr(prevStart)}&endDate=${toDateStr(prevEnd)}`;

      const prevRes = await fetch(`${API_BASE}/api/ga4/ai-traffic?${prevQs}`, { signal, cache: "no-store" });
      if (prevRes.ok) {
        const prevJson: AiTrafficReport = await prevRes.json();
        setPrevData(prevJson);
      }
    } catch {
      /* 이전 기간 실패 시 무시 */
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  /* 계산 */
  const totals = data?.totals;
  const sessions = totals?.sessions ?? 0;
  const activeUsers = totals?.activeUsers ?? 0;
  const hasData = data !== null && (sessions > 0 || (data.bySource?.length ?? 0) > 0);
  const isLive = data?._meta?.type === "live";

  /* 변화율 */
  const prevTotals = prevData?.totals;
  const sessionsChange = prevTotals ? calcChange(sessions, prevTotals.sessions) : null;
  const usersChange = prevTotals ? calcChange(activeUsers, prevTotals.activeUsers) : null;

  return (
    <section className={styles.summaryCard}>
      {/* 헤더 */}
      <div className={styles.summaryHeader}>
        <h3 className={styles.summaryTitle}>
          <span className={styles.summaryIcon}>AI</span>
          AI 유입 (Referral)
          {hasData ? (
            <span className={`${styles.badge} ${styles.badgeLive}`}>
              <span className={styles.badgeDot} />
              실시간
            </span>
          ) : loading ? (
            <span className={`${styles.badge} ${styles.badgeLoading}`}>
              <span className={styles.badgeDot} />
              데이터 수집 중
            </span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeFallback}`}>
              <span className={styles.badgeDot} />
              미연결
            </span>
          )}
        </h3>
        <div className={styles.summaryHeaderRight}>
          <span className={styles.summaryPeriod}>최근 30일</span>
          {onNavigateToDetail && (
            <button type="button" className={styles.summaryDetailLink} onClick={onNavigateToDetail}>
              → 상세 분석
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      {loading && !data ? (
        <div className={styles.summarySkeleton}>
          {[0, 1].map((i) => <div key={i} className={styles.summarySkeletonItem} />)}
        </div>
      ) : (
        <>
          <div className={styles.summaryKpiGrid}>
            <div className={styles.summaryKpiItem}>
              <div className={styles.summaryKpiValue}>
                {fmt(sessions)}
                <ChangeIndicator value={sessionsChange} />
              </div>
              <div className={styles.summaryKpiLabel}>AI 유입 세션</div>
            </div>
            <div className={styles.summaryKpiItem}>
              <div className={styles.summaryKpiValue}>
                {fmt(activeUsers)}
                <ChangeIndicator value={usersChange} />
              </div>
              <div className={styles.summaryKpiLabel}>AI 활성 사용자</div>
            </div>
          </div>

          {/* 상위 3개 소스 */}
          {data && data.bySource.length > 0 && (
            <div className={styles.summarySources}>
              상위 소스: {data.bySource.slice(0, 3).map((s) => `${s.sessionSource} (${s.sessions})`).join(", ")}
            </div>
          )}
        </>
      )}

      {/* 설명 */}
      <div className={styles.summaryNote}>
        AI 유입 = ChatGPT, Perplexity, Gemini, Claude 등 AI 서비스에서 직접 넘어온 유입. Google 검색의 AI Overview 유입은 여기 포함되지 않을 수 있음.
      </div>
    </section>
  );
}

/** 변화량 표시 (+12% ▲ / -5% ▼) */
function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  const cls = positive ? styles.changeUp : styles.changeDown;
  return (
    <span className={cls}>
      {positive ? "+" : ""}{Math.abs(value).toFixed(0)}% {positive ? "▲" : "▼"}
    </span>
  );
}
