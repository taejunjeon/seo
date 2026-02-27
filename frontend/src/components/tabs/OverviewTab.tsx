"use client";

import React, { FormEvent } from "react";
import styles from "@/app/page.module.css";
import KpiCard from "@/components/dashboard/KpiCard";
import TrendChart from "@/components/dashboard/TrendChart";
import OptimizationChecklist from "@/components/dashboard/OptimizationChecklist";
import type { OptimizationTask as ChecklistTask } from "@/components/dashboard/OptimizationChecklist";
import IntentChart from "@/components/dashboard/IntentChart";
import { AiTrafficSummaryCard } from "@/components/ai-traffic";
import { LiveBadge, LoadingBadge, NoDataBadge } from "@/components/common/Badges";
import { numberFormatter, decimalFormatter } from "@/utils/pageUtils";
import {
  BADGE_CLASS_MAP, TAG_CLASS_MAP,
  PRESET_LABELS, DEVICE_LABELS, API_BASE_URL,
} from "@/constants/pageData";
import type {
  GscRow, DatePreset, AiInsight, AeoGeoApiResult,
  ScoreBreakdown, KpiApiData, OptimizationTask,
} from "@/types/page";

type Props = {
  /* AEO/GEO */
  aeoScore: AeoGeoApiResult | null;
  geoScore: AeoGeoApiResult | null;
  aeoGeoScoresLoading: boolean;
  aeoGeoScoresProgress: number | null;
  aeoDetailOpen: boolean;
  setAeoDetailOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  geoDetailOpen: boolean;
  setGeoDetailOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  openBreakdownItems: Record<string, boolean>;
  toggleBreakdownItem: (type: "AEO" | "GEO", name: string) => void;
  aeoGeoTargetResolved: string | null;
  renderBreakdownExplain: (type: "AEO" | "GEO", item: ScoreBreakdown) => React.ReactNode;
  /* AI Insights */
  aiInsights: AiInsight[] | null;
  aiInsightsLoading: boolean;
  aiInsightsTime: string | null;
  insightsMeta: { source: string; generatedAt?: string; expiresAt?: string; ttl?: number } | null;
  insightsState: "loading" | "ready" | "error" | "empty";
  onRefreshInsights: () => void;
  onRetryInsights: () => void;
  /* KPI */
  kpiData: KpiApiData | null;
  kpiClicks: number;
  kpiCtr: number;
  kpiPosition: number;
  kpiSparkClicks: number[];
  kpiSparkCtr: number[];
  kpiSparkPosition: number[];
  cwvAvg: { performance: number; seo: number; accessibility: number };
  /* Optimization */
  aiOptimizationTasks: OptimizationTask[];
  /* Navigation */
  setActiveTab: (tab: number) => void;
  /* Data query */
  dataQueryOpen: boolean;
  setDataQueryOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  datePreset: DatePreset;
  handlePresetChange: (preset: DatePreset) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  siteUrl: string;
  setSiteUrl: (v: string) => void;
  rowLimit: number;
  setRowLimit: (v: number) => void;
  loading: boolean;
  error: string | null;
  rows: GscRow[];
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function OverviewTab({
  aeoScore, geoScore, aeoGeoScoresLoading, aeoGeoScoresProgress,
  aeoDetailOpen, setAeoDetailOpen, geoDetailOpen, setGeoDetailOpen,
  openBreakdownItems, toggleBreakdownItem, aeoGeoTargetResolved, renderBreakdownExplain,
  aiInsights, aiInsightsLoading, aiInsightsTime, insightsMeta, insightsState,
  onRefreshInsights, onRetryInsights,
  kpiData, kpiClicks, kpiCtr, kpiPosition,
  kpiSparkClicks, kpiSparkCtr, kpiSparkPosition, cwvAvg,
  aiOptimizationTasks, setActiveTab,
  dataQueryOpen, setDataQueryOpen, datePreset, handlePresetChange,
  startDate, setStartDate, endDate, setEndDate,
  siteUrl, setSiteUrl, rowLimit, setRowLimit,
  loading, error, rows, handleSubmit,
}: Props) {
  const formatIsoToKoreanTime = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return "—";
    return new Date(ts).toLocaleString("ko-KR");
  };

  const insightsMetaAgeLabel =
    insightsMeta && insightsMeta.source !== "live" ? formatIsoToKoreanTime(insightsMeta.generatedAt) : "—";
  const aiInsightsAgeLabel = aiInsightsLoading
    ? "AI 분석 중..."
    : aiInsightsTime
      ? formatIsoToKoreanTime(aiInsightsTime)
      : "분석 대기";

  return (
    <>
      {/* AEO/GEO 점수 */}
      <section className={styles.heroGrid}>
        {[
          { label: "AEO Score", data: aeoScore, idx: 0 },
          { label: "GEO Score", data: geoScore, idx: 1 },
        ].map(({ label, data, idx }) => {
          const isLive = !!data;
          const score = data?.normalizedScore ?? 0;
          const max = 100;
          const measured = data ? data.breakdown.filter((b) => b.status === "measured").length : 0;
          const total = data ? data.breakdown.length : 0;
          return (
            <article key={label} className={styles.scoreCard}>
              <div className={styles.scoreCardHeader}>
                <span className={styles.scoreLabel}>
                  {label}
                  {isLive ? <LiveBadge /> : aeoGeoScoresLoading ? <LoadingBadge progress={aeoGeoScoresProgress} /> : <NoDataBadge />}
                </span>
                <span className={styles.scoreFraction}>{score}/{max}</span>
              </div>
              <div className={styles.scoreRingWrap}>
                <svg className={styles.scoreRing} viewBox="0 0 120 120">
                  <circle className={styles.scoreRingTrack} cx="60" cy="60" r="52" />
                  <circle
                    className={`${styles.scoreRingFill} ${idx === 0 ? styles.scoreRingAeo : styles.scoreRingGeo}`}
                    cx="60" cy="60" r="52"
                    style={{ strokeDashoffset: `${326.7 - (326.7 * score) / 100}` }}
                  />
                </svg>
                <div className={styles.scoreRingCenter}>
                  <span className={`${styles.scoreRingValue} ${idx === 0 ? styles.scoreValueAeo : styles.scoreValueGeo}`}>{score}</span>
                  <span className={styles.scoreRingMax}>/100</span>
                </div>
              </div>
              {isLive ? (
                <div className={styles.scoreSegments}>
                  {Array.from({ length: total }, (_, i) => (
                    <div key={i} className={`${styles.scoreSegment} ${i < measured ? (idx === 0 ? styles.scoreSegmentAeo : styles.scoreSegmentGeo) : styles.scoreSegmentEmpty}`} />
                  ))}
                  <span className={styles.scoreSegmentLabel}>{measured}/{total} 항목 측정 완료</span>
                </div>
              ) : (
                <p className={styles.scoreDelta} style={{ color: "var(--color-text-muted)" }}>API 연결 후 표시됩니다</p>
              )}
            </article>
          );
        })}
      </section>

      {/* AEO/GEO 상세 브레이크다운 (아코디언) */}
      {(aeoScore || geoScore) && (
        <section className={styles.breakdownSection}>
          {[
            { result: aeoScore, isOpen: aeoDetailOpen, toggle: () => setAeoDetailOpen((v: boolean) => !v) },
            { result: geoScore, isOpen: geoDetailOpen, toggle: () => setGeoDetailOpen((v: boolean) => !v) },
          ].filter((d) => d.result).map(({ result, isOpen, toggle }) => {
            const items = result!.breakdown;
            const lowCount = items.filter((b) => b.maxScore > 0 && (b.score / b.maxScore) < 0.5).length;
            return (
              <div key={result!.type} className={styles.breakdownCard}>
                {/* 아코디언 헤더 */}
                <div className={styles.breakdownHeader} onClick={toggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                  <div className={styles.breakdownHeaderLeft}>
                    <h3 className={styles.breakdownTitle}>{result!.type} Score 상세 ({result!.normalizedScore}점)</h3>
                    <div className={styles.breakdownMiniBar}>
                      {items.map((b) => {
                        const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                        const cls = pct >= 80 ? styles.breakdownMiniSegGood : pct >= 50 ? styles.breakdownMiniSegWarn : styles.breakdownMiniSegPoor;
                        return <span key={b.name} className={`${styles.breakdownMiniSeg} ${cls}`} title={`${b.label}: ${b.score}/${b.maxScore}`} />;
                      })}
                    </div>
                    {lowCount > 0 && (
                      <span className={styles.breakdownBadge}>{lowCount}개 개선 필요</span>
                    )}
                  </div>
                  <svg className={`${styles.breakdownChevron} ${isOpen ? styles.breakdownChevronOpen : ""}`} viewBox="0 0 20 20" fill="none">
                    <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {/* 아코디언 본문 */}
                <div className={`${styles.breakdownBody} ${isOpen ? styles.breakdownBodyOpen : ""}`}>
                  <div className={styles.breakdownMetaRow}>
                    <span className={styles.breakdownMetaLabel}>대표 URL</span>
                    {aeoGeoTargetResolved ? (
                      <a className={styles.breakdownMetaLink} href={aeoGeoTargetResolved} target="_blank" rel="noreferrer">
                        {aeoGeoTargetResolved.replace(/^https?:\/\//i, "")}
                      </a>
                    ) : (
                      <span className={styles.breakdownMetaEmpty}>미지정</span>
                    )}
                    <span className={styles.breakdownMetaHint}>구조화 데이터/콘텐츠/기술 성능 항목은 이 URL을 기준으로 측정됩니다.</span>
                  </div>
                  <div className={styles.breakdownGrid}>
                    {items.map((b) => {
                      const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                      const level = pct >= 80 ? "good" : pct >= 50 ? "warn" : "poor";
                      const itemKey = `${result!.type}:${b.name}`;
                      const isItemOpen = !!openBreakdownItems[itemKey];
                      const detailId = `breakdown-${result!.type}-${b.name}`;
                      return (
                        <div
                          key={b.name}
                          className={`${styles.breakdownItem} ${b.score === 0 ? styles.breakdownItemZero : ""} ${level === "good" ? styles.breakdownItemGood : level === "warn" ? styles.breakdownItemWarn : styles.breakdownItemPoor}`}
                        >
                          <div
                            className={styles.breakdownItemSummary}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isItemOpen}
                            aria-controls={detailId}
                            onClick={() => toggleBreakdownItem(result!.type as "AEO" | "GEO", b.name)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleBreakdownItem(result!.type as "AEO" | "GEO", b.name);
                              }
                            }}
                          >
                            <div className={styles.breakdownItemHeader}>
                              <span className={styles.breakdownItemLabel}>
                                {pct >= 80 ? (
                                  <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#10B981" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                ) : pct > 0 ? (
                                  <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#F59E0B" strokeWidth="1.5"/><path d="M8 5v3.5M8 10.5h.01" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                ) : (
                                  <svg className={styles.breakdownIcon} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                )}
                                {b.label}
                              </span>
                              <span className={styles.breakdownItemHeaderRight}>
                                <span className={`${styles.breakdownItemScore} ${level === "good" ? styles.breakdownScoreGood : level === "warn" ? styles.breakdownScoreWarn : styles.breakdownScorePoor}`}>{b.score}/{b.maxScore}</span>
                                <svg className={`${styles.breakdownItemChevron} ${isItemOpen ? styles.breakdownItemChevronOpen : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                  <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            </div>
                            <div className={styles.breakdownBar}>
                              <div className={`${styles.breakdownBarFill} ${level === "good" ? styles.breakdownBarGood : level === "warn" ? styles.breakdownBarWarn : styles.breakdownBarPoor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className={styles.breakdownDetail}>{b.detail}</p>
                            <span className={styles.breakdownExpandHint}>{isItemOpen ? "접기" : "자세히"}</span>
                          </div>

                          {isItemOpen && (
                            <div id={detailId} className={styles.breakdownExplain}>
                              {renderBreakdownExplain(result!.type as "AEO" | "GEO", b)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* AI 인사이트 */}
      <section className={styles.insightsPanel}>
        <div className={styles.insightsPanelHeader}>
          <h2 className={styles.insightsPanelTitle}>
            🤖 AI 에이전트 활동 상태
            {insightsState === "ready" ? <LiveBadge /> : insightsState === "loading" ? <LoadingBadge label="AI 분석 중" /> : <NoDataBadge />}
          </h2>
          <div className={styles.insightsPanelActions}>
            {insightsMeta && (
              <span className={insightsMeta.source === "live" ? styles.metaBadgeLive : styles.metaBadgeCache}>
                {insightsMeta.source === "live" ? "🟢 실시간 분석" : `💾 캐시됨 (${insightsMetaAgeLabel})`}
              </span>
            )}
            <span className={styles.insightsPanelMeta}>
              {aiInsightsAgeLabel}
            </span>
            <button
              type="button"
              className={`${styles.insightsRefreshBtn} ${aiInsightsLoading ? styles.refreshSpinning : ""}`}
              title="새로 분석 (POST)"
              disabled={aiInsightsLoading}
              onClick={onRefreshInsights}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
        {/* 상태별 분기 */}
        {insightsState === "loading" ? (
          <div className={styles.sectionPlaceholder}>
            <div className={styles.sectionPlaceholderSkeleton} />
            <div className={styles.sectionPlaceholderSkeleton} />
            <div className={styles.sectionPlaceholderSkeleton} />
          </div>
        ) : insightsState === "error" || insightsState === "empty" ? (
          <div className={styles.sectionPlaceholder}>
            <div className={styles.sectionPlaceholderIcon}>{insightsState === "error" ? "⚠️" : "🤖"}</div>
            <div className={styles.sectionPlaceholderText}>
              {insightsState === "error"
                ? "AI 분석이 아직 실행되지 않았습니다."
                : "AI 분석 결과가 비어 있습니다."}
            </div>
            <div className={styles.sectionPlaceholderHint}>
              AI 분석을 실행하려면 OpenAI API 키 설정 후<br />아래 버튼을 클릭하세요.
            </div>
            <button
              type="button"
              className={styles.sectionPlaceholderBtn}
              disabled={aiInsightsLoading}
              onClick={onRetryInsights}
            >
              다시 분석
            </button>
          </div>
        ) : (
        <>
        <div className={styles.insightCards}>
          {(aiInsights ?? []).map((ins, idx) => {
            const iconMap: Record<string, React.ReactNode> = {
              "키워드": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              "스키마": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
              "추세": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-5 3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              "콘텐츠": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
              "기기": <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
            };
            const icon = iconMap[ins.tag] ?? iconMap["콘텐츠"];
            const categoryBorderCls: Record<AiInsight["priority"], string> = {
              urgent: styles.insightUrgent ?? "",
              opportunity: styles.insightOpportunity ?? "",
              trend: styles.insightTrend ?? "",
              recommend: styles.insightRecommend ?? "",
            };
            const actionableWords = ["추가", "변경", "수정", "적용", "설치", "개선"];
            const monitorWords = ["추이", "모니터링", "관찰", "확인", "지켜보"];
            const isActionable = actionableWords.some((w) => ins.text.includes(w));
            const isMonitor = !isActionable && monitorWords.some((w) => ins.text.includes(w));
            return (
              <div
                key={`${ins.tag}-${idx}`}
                className={`${styles.insightCard} ${categoryBorderCls[ins.priority]} ${styles[BADGE_CLASS_MAP[ins.priority] + "Border"] ?? ""}`}
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div className={`${styles.insightIconWrap} ${styles[BADGE_CLASS_MAP[ins.priority] + "Bg"] ?? ""}`}>
                  {icon}
                </div>
                <div className={styles.insightCardBody}>
                  <div className={styles.insightTagRow}>
                    <span className={`${styles.insightTag} ${styles[TAG_CLASS_MAP[ins.priority]] ?? ""}`}>{ins.tag}</span>
                    {isActionable && <span className={styles.tagActionable}>실행 가능</span>}
                    {isMonitor && <span className={styles.tagMonitor}>모니터링</span>}
                  </div>
                  <span className={styles.insightText}>{ins.text}</span>
                </div>
              </div>
            );
          })}
        </div>
        {aiInsightsTime && (
          <div className={styles.insightsFooter}>
            마지막 분석: {new Date(aiInsightsTime).toLocaleString("ko-KR")}
          </div>
        )}
        </>
        )}
      </section>

      {/* 30일 추세 차트 */}
      <TrendChart apiBaseUrl={API_BASE_URL} />

      {/* KPI 카드 4개 */}
      <section className={styles.kpiGrid}>
        {(() => {
          const clicksChange = kpiData ? kpiData.delta.clicks : 12.3;
          const clicksStatus: "up" | "down" | "neutral" = clicksChange > 0 ? "up" : clicksChange < 0 ? "down" : "neutral";
          const ctrChange = kpiData ? kpiData.delta.ctr : 0.8;
          const ctrStatus: "up" | "down" | "neutral" = ctrChange > 0 ? "up" : ctrChange < 0 ? "down" : "neutral";
          const posChange = kpiData ? kpiData.delta.position : -1.2;
          const posStatus: "up" | "down" | "neutral" = posChange < 0 ? "up" : posChange > 0 ? "down" : "neutral";
          const cwvPerf = cwvAvg.performance;
          return (
            <>
              <KpiCard label="총 클릭수" value={numberFormatter.format(kpiClicks)} change={clicksChange} changeUnit="%" changeLabel="전주 7일" status={clicksStatus} sparklineData={kpiSparkClicks} sparklineColor="#0D9488" />
              <KpiCard label="평균 CTR" value={decimalFormatter.format(kpiCtr)} unit="%" change={ctrChange} changeUnit="%p" changeLabel="전주 7일" status={ctrStatus} sparklineData={kpiSparkCtr} sparklineColor="#2563eb" />
              <KpiCard label="평균 순위" value={decimalFormatter.format(kpiPosition)} change={posChange} changeUnit="" changeLabel="전주 7일" status={posStatus} sparklineData={kpiSparkPosition} sparklineColor="#f59e0b" />
              <KpiCard label="CWV 점수" value={String(cwvPerf)} unit="점" change={0} changeUnit="점" changeLabel="전주" status="neutral" isCwv cwvScore={cwvPerf} />
            </>
          );
        })()}
      </section>

      {/* AI 유입 요약 카드 */}
      <AiTrafficSummaryCard onNavigateToDetail={() => setActiveTab(5)} />

      {/* 인텐트 + 체크리스트 */}
      <section className={styles.twoColGrid}>
        <IntentChart apiBaseUrl={API_BASE_URL} />
        <OptimizationChecklist tasks={aiOptimizationTasks as ChecklistTask[]} />
      </section>

      {/* 접이식 데이터 조회 */}
      <section className={styles.collapsibleSection}>
        <div className={styles.collapsibleHeader} onClick={() => setDataQueryOpen((p: boolean) => !p)}>
          <h2 className={styles.collapsibleTitle}>🔍 검색 데이터 상세 조회</h2>
          <span className={`${styles.collapsibleChevron} ${dataQueryOpen ? styles.collapsibleChevronOpen : ""}`}>▼</span>
        </div>
        {dataQueryOpen && (
          <div className={styles.collapsibleBody}>
            <div className={styles.controlPanel}>
              <div className={styles.presetGroup}>
                {(Object.keys(PRESET_LABELS) as DatePreset[]).map((preset) => (
                  <button key={preset} type="button" className={`${styles.presetBtn} ${datePreset === preset ? styles.presetActive : ""}`} onClick={() => handlePresetChange(preset)}>
                    {PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
              <form className={styles.form} onSubmit={handleSubmit}>
                {datePreset === "custom" && (
                  <div className={styles.dateInputs}>
                    <label className={styles.fieldLabel}>시작일<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label>
                    <label className={styles.fieldLabel}>종료일<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
                  </div>
                )}
                <div className={styles.formRow}>
                  <label className={styles.fieldLabel}>사이트<input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="sc-domain:biocom.kr" /></label>
                  <label className={styles.fieldLabel}>조회 건수<input type="number" min={1} max={25000} value={rowLimit} onChange={(e) => setRowLimit(Number(e.target.value))} /></label>
                  <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "조회 중..." : "검색 데이터 조회"}</button>
                </div>
              </form>
              {error ? <p className={styles.error}>오류: {error}</p> : null}
            </div>
            <div className={styles.tablePanel}>
              <div className={styles.tableHeader}>
                <h2>검색 성과 상세</h2>
                <p>{rows.length > 0 ? `${numberFormatter.format(rows.length)}건 조회됨` : ""}</p>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr><th>검색어</th><th>페이지</th><th>기기</th><th>클릭수</th><th>노출수</th><th>클릭률</th><th>순위</th></tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className={styles.empty}><div className={styles.emptyContent}><svg width="40" height="40" viewBox="0 0 40 40" fill="none" className={styles.emptyIcon}><circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2" /><path d="M27 27L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><p>조회 버튼을 눌러 검색 성과를 확인해 보세요</p></div></td></tr>
                    ) : (
                      rows.map((row, index) => (
                        <tr key={`${row.keys?.join("-") ?? "row"}-${index}`}>
                          <td className={styles.queryCell}>{row.keys?.[1] ?? "-"}</td>
                          <td className={styles.pageCell}>{row.keys?.[0] ?? "-"}</td>
                          <td>{DEVICE_LABELS[row.keys?.[2] ?? ""] ?? row.keys?.[2] ?? "-"}</td>
                          <td className={styles.numCell}>{numberFormatter.format(row.clicks ?? 0)}</td>
                          <td className={styles.numCell}>{numberFormatter.format(row.impressions ?? 0)}</td>
                          <td className={styles.numCell}>{decimalFormatter.format((row.ctr ?? 0) * 100)}%</td>
                          <td className={styles.numCell}>{decimalFormatter.format(row.position ?? 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
