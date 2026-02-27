"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiTrafficReport, AiTrafficRangePreset, AiTrafficUserTypeReport } from "./types";
import AiTrafficKpi from "./AiTrafficKpi";
import AiTrafficUserType from "./AiTrafficUserType";
import AiTrafficBySourceTable from "./AiTrafficBySourceTable";
import AiTrafficByLandingTable from "./AiTrafficByLandingTable";
import styles from "./AiTraffic.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7020";

type Props = {
  /** 페이지 진단 탭으로 이동 콜백 */
  onDiagnose?: (url: string) => void;
};

/** YYYY-MM-DD 형식의 날짜 문자열 반환 */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 프리셋 → { startDate, endDate } */
function presetToRange(preset: AiTrafficRangePreset): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1); // yesterday
  const start = new Date(end);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  else if (preset === "30d") start.setDate(start.getDate() - 29);
  else if (preset === "90d") start.setDate(start.getDate() - 89);
  return { startDate: toDateStr(start), endDate: toDateStr(end) };
}

export default function AiTrafficDashboard({ onDiagnose }: Props) {
  /* ── 상태 ── */
  const [data, setData] = useState<AiTrafficReport | null>(null);
  const [userTypeData, setUserTypeData] = useState<AiTrafficUserTypeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── 기간 선택 ── */
  const [rangePreset, setRangePreset] = useState<AiTrafficRangePreset>("30d");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [currentRange, setCurrentRange] = useState(presetToRange("30d"));

  /* ── API 호출 ── */
  const loadData = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = `startDate=${startDate}&endDate=${endDate}`;
      const [trafficRes, userTypeRes] = await Promise.all([
        fetch(`${API_BASE}/api/ga4/ai-traffic?${qs}`),
        fetch(`${API_BASE}/api/ga4/ai-traffic/user-type?${qs}`),
      ]);

      if (!trafficRes.ok) {
        throw new Error(`AI Traffic API 오류 (${trafficRes.status})`);
      }
      const trafficJson: AiTrafficReport = await trafficRes.json();
      setData(trafficJson);
      setCurrentRange({ startDate, endDate });

      if (userTypeRes.ok) {
        const userTypeJson: AiTrafficUserTypeReport = await userTypeRes.json();
        setUserTypeData(userTypeJson);
      } else {
        setUserTypeData(null);
      }
    } catch (err) {
      console.error("[AiTraffic] load error:", err);
      setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      /* 에러 시 data는 null 유지 — empty state 표시 */
    } finally {
      setLoading(false);
    }
  }, [data]);

  /* ── 초기 로드 ── */
  useEffect(() => {
    const { startDate, endDate } = presetToRange("30d");
    loadData(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 프리셋 변경 핸들러 ── */
  const handlePreset = (preset: AiTrafficRangePreset) => {
    setRangePreset(preset);
    setDatePickerOpen(false);
    const { startDate, endDate } = presetToRange(preset);
    loadData(startDate, endDate);
  };

  /* ── 커스텀 기간 적용 ── */
  const handleCustomApply = () => {
    if (!startInput || !endInput || startInput > endInput) return;
    setRangePreset("custom");
    setDatePickerOpen(false);
    loadData(startInput, endInput);
  };

  /* ── 표시용 데이터 ── */
  const displayData = data;
  const hasData = displayData !== null && (displayData.totals.sessions > 0 || displayData.bySource.length > 0);
  const isLive = displayData?._meta.type === "live";
  const metaNotice = displayData?._meta.notice;

  return (
    <section className={`${styles.card} ${styles.section}`}>
      {/* ── 헤더 + 기간 선택 ── */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.aiIcon}>AI</span>
          AI 유입 트래픽
          {loading ? (
            <span className={`${styles.badge} ${styles.badgeLoading}`}>
              <span className={styles.badgeDot} />
              로딩...
            </span>
          ) : (
            <span className={`${styles.badge} ${isLive ? styles.badgeLive : styles.badgeFallback}`}>
              <span className={styles.badgeDot} />
              {isLive ? "실시간 데이터" : "GA4 미연결"}
            </span>
          )}
          {metaNotice && <span className={styles.noticeText}>{metaNotice}</span>}
        </h2>
        <div>
          <div className={styles.periodBtns}>
            {(["7d", "30d", "90d"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`${styles.periodBtn} ${rangePreset === preset ? styles.periodBtnActive : ""}`}
                onClick={() => handlePreset(preset)}
                disabled={loading}
              >
                {preset.replace("d", "일")}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.periodBtn} ${rangePreset === "custom" || datePickerOpen ? styles.periodBtnActive : ""}`}
              onClick={() => setDatePickerOpen((p) => !p)}
              disabled={loading}
              title="기간 직접 지정"
            >
              📅
            </button>
          </div>
          <div className={styles.metaText}>
            📅 {currentRange.startDate} ~ {currentRange.endDate} · GA4 AI 유입 데이터
          </div>
        </div>
      </div>

      {/* ── 커스텀 기간 선택 ── */}
      {datePickerOpen && (
        <div className={styles.datePicker}>
          <label className={styles.dateLabel}>
            시작일
            <input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)} required />
          </label>
          <label className={styles.dateLabel}>
            종료일
            <input type="date" value={endInput} onChange={(e) => setEndInput(e.target.value)} required />
          </label>
          <div className={styles.dateActions}>
            <button
              type="button"
              className={styles.dateActionBtn}
              onClick={handleCustomApply}
              disabled={loading}
            >
              적용
            </button>
            <button type="button" className={styles.dateActionBtn} onClick={() => setDatePickerOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 정의 설명 ── */}
      <div className={styles.definition}>
        AI 유입 = ChatGPT, Perplexity, Gemini, Claude 등 AI 서비스에서 직접 넘어온 유입(referral).
        {displayData?.debug?.matchedPatterns && (
          <> 측정 대상: {displayData.debug.matchedPatterns.join(", ")}</>
        )}
      </div>

      {/* ── 로딩 스켈레톤 ── */}
      {loading ? (
        <>
          <div className={styles.skeleton}>
            {[0, 1, 2, 3].map((i) => <div key={i} className={styles.skeletonItem} />)}
          </div>
          <div className={styles.tablesWrap}>
            <div className={styles.skeletonTable} />
            <div className={styles.skeletonTable} />
          </div>
        </>
      ) : error && !data ? (
        /* ── 에러 상태 (데이터 없음) ── */
        <div className={styles.error}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorText}>{error}</div>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => {
              const range = rangePreset === "custom"
                ? { startDate: startInput, endDate: endInput }
                : presetToRange(rangePreset);
              loadData(range.startDate, range.endDate);
            }}
          >
            재시도
          </button>
        </div>
      ) : hasData ? (
        <>
          {/* KPI 카드 */}
          <AiTrafficKpi totals={displayData!.totals} />

          {/* 신규 vs 재방문 */}
          <AiTrafficUserType
            totals={displayData!.totals}
            userTypeSummary={userTypeData?.summary ?? null}
          />

          {/* 소스별 + 랜딩페이지별 테이블 */}
          <div className={styles.tablesWrap}>
            <AiTrafficBySourceTable rows={displayData!.bySource} />
            <AiTrafficByLandingTable rows={displayData!.byLandingPage} onDiagnose={onDiagnose} />
          </div>
        </>
      ) : (
        /* ── 빈 데이터 (sessions=0) ── */
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🤖</div>
          <div className={styles.emptyText}>해당 기간에 AI 유입 데이터가 없습니다</div>
          <div className={styles.emptyHint}>
            AI 유입 = ChatGPT, Perplexity, Gemini, Claude 등 AI 서비스에서 직접 링크를 타고 유입된 트래픽.<br />
            GA4의 sessionSource 기준으로 측정됩니다.
          </div>
        </div>
      )}
    </section>
  );
}
