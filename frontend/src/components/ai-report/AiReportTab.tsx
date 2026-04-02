"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AeoGeoScore, GscKpiResponse, AiVsOrganicResponse,
  TrendsApiResponse, AiFunnelResponse,
  SectionStatus,
} from "./types";
import ScoreHero from "./ScoreHero";
import AiVsOrganic from "./AiVsOrganic";
import TrendSection from "./TrendSection";
import FunnelSection from "./FunnelSection";
import JourneySection from "./JourneySection";
import styles from "./AiReport.module.css";

type Props = { apiBaseUrl: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AiReportTab({ apiBaseUrl }: Props) {
  const [status, setStatus] = useState<SectionStatus>("loading");

  /* ── 데이터 상태 ── */
  const [aeoScore, setAeoScore] = useState<AeoGeoScore | null>(null);
  const [geoScore, setGeoScore] = useState<AeoGeoScore | null>(null);
  const [gscKpi, setGscKpi] = useState<GscKpiResponse | null>(null);
  const [aiVsOrganic, setAiVsOrganic] = useState<AiVsOrganicResponse | null>(null);
  const [trends, setTrends] = useState<TrendsApiResponse | null>(null);
  const [funnel, setFunnel] = useState<AiFunnelResponse | null>(null);
  const [journey, setJourney] = useState<any>(null);

  /* ── 7개 API 병렬 호출 ── */
  const loadAll = useCallback(async () => {
    setStatus("loading");

    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 89);
    const qs = `startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`;

    const results = await Promise.allSettled([
      fetch(`${apiBaseUrl}/api/aeo/score`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/geo/score`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/gsc/kpi`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/ga4/ai-vs-organic?period=90d`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/trends?metric=clicks&period=90d&compare=previous`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/ga4/ai-funnel?period=90d`).then((r) => r.ok ? r.json() : null),
      fetch(`${apiBaseUrl}/api/ga4/ai-traffic?${qs}`).then((r) => r.ok ? r.json() : null),
    ]);

    const getValue = <T,>(r: PromiseSettledResult<T | null>): T | null =>
      r.status === "fulfilled" ? r.value : null;

    setAeoScore(getValue(results[0]) as AeoGeoScore | null);
    setGeoScore(getValue(results[1]) as AeoGeoScore | null);
    setGscKpi(getValue(results[2]) as GscKpiResponse | null);
    setAiVsOrganic(getValue(results[3]) as AiVsOrganicResponse | null);
    setTrends(getValue(results[4]) as TrendsApiResponse | null);
    setFunnel(getValue(results[5]) as AiFunnelResponse | null);
    setJourney(getValue(results[6]));

    // 최소 하나라도 성공하면 ready
    const anySuccess = results.some((r) => r.status === "fulfilled" && r.value !== null);
    setStatus(anySuccess ? "ready" : "error");
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ── 로딩 상태 ── */
  if (status === "loading") {
    return (
      <div className={styles.reportWrap}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>AI 분석 보고서를 불러오는 중...</h3>
          <div className={styles.skeleton} />
        </div>
        <div className={styles.section}>
          <div className={styles.skeleton} />
        </div>
        <div className={styles.section}>
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  /* ── 전체 에러 ── */
  if (status === "error") {
    return (
      <div className={styles.section}>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorText}>보고서 데이터를 불러올 수 없습니다. 백엔드 서버 상태를 확인해주세요.</div>
          <button type="button" className={styles.retryBtn} onClick={() => void loadAll()}>
            재시도
          </button>
        </div>
      </div>
    );
  }

  /* ── 보고서 렌더 ── */
  return (
    <div className={styles.reportWrap}>
      {/* 1. Score Hero */}
      <ScoreHero aeoScore={aeoScore} geoScore={geoScore} gscKpi={gscKpi} />

      {/* 2. AI vs Organic */}
      <AiVsOrganic data={aiVsOrganic} />

      {/* 3. 90일 트렌드 */}
      <TrendSection data={trends} />

      {/* 4. AI 전환 퍼널 */}
      <FunnelSection data={funnel} />

      {/* 5. 사용자 여정 */}
      <JourneySection data={journey} />
    </div>
  );
}
