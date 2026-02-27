"use client";

import styles from "@/app/page.module.css";
import { LiveBadge, NoDataBadge, LoadingBadge, WipBadge } from "@/components/common/Badges";
import { AiTrafficDashboard } from "@/components/ai-traffic";
import { numberFormatter, decimalFormatter } from "@/utils/pageUtils";
import type { BehaviorRangePreset, BehaviorData, FunnelStep, ColumnData } from "@/types/page";

const BEHAVIOR_PRESET_DAYS: Record<Exclude<BehaviorRangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

type Props = {
  behaviorData: unknown;
  behaviorLoading: boolean;
  behaviorRangePreset: BehaviorRangePreset;
  setBehaviorRangePreset: (v: BehaviorRangePreset) => void;
  behaviorDatePickerOpen: boolean;
  setBehaviorDatePickerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  behaviorStartInput: string;
  setBehaviorStartInput: (v: string) => void;
  behaviorEndInput: string;
  setBehaviorEndInput: (v: string) => void;
  behaviorDateRange: { start: string; end: string } | null;
  behaviorRangeLabel: string;
  liveBehavior: BehaviorData[];
  funnelData: unknown;
  liveFunnel: FunnelStep[];
  liveColumns: ColumnData[];
  loadBehavior: (opts: { days?: number; startDate?: string; endDate?: string }) => Promise<void>;
  setDiagUrl: (url: string) => void;
  setActiveTab: (tab: number) => void;
};

export default function UserBehaviorTab({
  behaviorData, behaviorLoading, behaviorRangePreset, setBehaviorRangePreset,
  behaviorDatePickerOpen, setBehaviorDatePickerOpen,
  behaviorStartInput, setBehaviorStartInput, behaviorEndInput, setBehaviorEndInput,
  behaviorDateRange, behaviorRangeLabel, liveBehavior,
  funnelData, liveFunnel, liveColumns,
  loadBehavior, setDiagUrl, setActiveTab,
}: Props) {
  return (
    <>
      {/* 페이지별 체류 분석 */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>페이지별 사용자 행동 (GA4){behaviorData ? <LiveBadge /> : behaviorLoading ? <LoadingBadge /> : <NoDataBadge />}</h2>
          <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
            <div className={styles.keywordMetaTop}>
              <div className={styles.keywordRangeBtns}>
                {(["7d", "30d", "90d"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.trendPeriodBtn} ${behaviorRangePreset === preset ? styles.trendPeriodBtnActive : ""}`}
                    onClick={() => {
                      setBehaviorRangePreset(preset);
                      setBehaviorDatePickerOpen(false);
                      void loadBehavior({ days: BEHAVIOR_PRESET_DAYS[preset] });
                    }}
                    disabled={behaviorLoading}
                  >
                    {preset.replace("d", "일")}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${behaviorRangePreset === "custom" || behaviorDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => setBehaviorDatePickerOpen((p: boolean) => !p)}
                  disabled={behaviorLoading}
                  title="기간 직접 지정"
                >
                  📅
                </button>
              </div>
              <span className={styles.keywordRangeText}>
                {behaviorData
                  ? `📅 ${behaviorDateRange?.start ?? ""} ~ ${behaviorDateRange?.end ?? ""} (${behaviorRangeLabel}) · GA4 실데이터`
                  : "GA4 API 활성화 필요"}
              </span>
            </div>
            {behaviorLoading && <span className={styles.keywordMetaBottom}>조회 중...</span>}
          </div>
        </div>
        {behaviorDatePickerOpen && (
          <div className={styles.keywordDatePicker}>
            <div className={styles.dateInputs}>
              <label className={styles.fieldLabel}>시작일<input type="date" value={behaviorStartInput} onChange={(e) => setBehaviorStartInput(e.target.value)} required /></label>
              <label className={styles.fieldLabel}>종료일<input type="date" value={behaviorEndInput} onChange={(e) => setBehaviorEndInput(e.target.value)} required /></label>
            </div>
            <div className={styles.keywordDateActions}>
              <button
                type="button"
                className={styles.keywordActionBtn}
                onClick={() => {
                  if (!behaviorStartInput || !behaviorEndInput) return;
                  if (behaviorStartInput > behaviorEndInput) return;
                  setBehaviorRangePreset("custom");
                  setBehaviorDatePickerOpen(false);
                  void loadBehavior({ startDate: behaviorStartInput, endDate: behaviorEndInput });
                }}
                disabled={behaviorLoading}
              >
                적용
              </button>
              <button type="button" className={styles.keywordActionBtn} onClick={() => setBehaviorDatePickerOpen(false)} disabled={behaviorLoading}>닫기</button>
            </div>
          </div>
        )}
        {liveBehavior.length === 0 && !behaviorLoading ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>사용자 행동 데이터가 없습니다. GA4 API 연결 후 자동으로 표시됩니다.</p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th>페이지</th><th>세션</th><th>사용자</th><th>평균 체류</th><th>이탈률</th><th>스크롤</th><th>전환</th></tr>
              </thead>
              <tbody>
                {liveBehavior.map((b) => (
                  <tr key={b.page}>
                    <td className={styles.queryCell}>{b.page}</td>
                    <td className={styles.numCell}>{numberFormatter.format(b.sessions)}</td>
                    <td className={styles.numCell}>{numberFormatter.format(b.users)}</td>
                    <td className={styles.numCell}>{Math.floor(b.avgTime / 60)}분 {(b.avgTime % 60).toFixed(2)}초</td>
                    <td className={`${styles.numCell} ${b.bounceRate > 45 ? styles.kwDeltaDown : ""}`}>{decimalFormatter.format(b.bounceRate)}%</td>
                    <td className={styles.numCell}>{b.scrollDepth}%</td>
                    <td className={styles.numCell}>{b.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── AI 유입 (AI Referral Traffic) — 분리된 컴포넌트 ── */}
      <AiTrafficDashboard
        onDiagnose={(url) => {
          setDiagUrl(url);
          setActiveTab(6);
        }}
      />

      {/* SEO → 전환 퍼널 */}
      <section className={styles.funnelSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>SEO → 전환 퍼널{funnelData ? <LiveBadge /> : <NoDataBadge />}</h2>
          <span className={styles.sectionMeta}>최근 30일 유기 검색 기준</span>
        </div>
        {liveFunnel.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>퍼널 데이터가 없습니다. GA4 API 연결 후 자동으로 표시됩니다.</p>
            </div>
          </div>
        ) : (
          <div className={styles.funnelSteps}>
            {liveFunnel.map((step) => (
              <div key={step.label} className={styles.funnelStep}>
                <span className={styles.funnelLabel}>{step.label}</span>
                <div className={styles.funnelBarWrap}>
                  <div className={styles.funnelBar} style={{ width: `${step.percent}%` }}>
                    {step.percent > 15 && <span className={styles.funnelBarValue}>{numberFormatter.format(step.value)}</span>}
                  </div>
                </div>
                <span className={styles.funnelPercent}>{step.percent}%</span>
              </div>
            ))}
          </div>
        )}

        {/* ── 퍼널 인사이트 ── */}
        {liveFunnel.length >= 2 && (() => {
          const first = liveFunnel[0];
          const last = liveFunnel[liveFunnel.length - 1];
          const overallRate = first.value > 0 ? (last.value / first.value * 100) : 0;
          const pagesPerSession = first.value > 0 ? (liveFunnel[1]?.value ?? 0) / first.value : 0;

          const dropoffs = liveFunnel.slice(1).map((step, idx) => {
            const prev = liveFunnel[idx];
            const rate = prev.value > 0 ? (step.value / prev.value * 100) : 0;
            const lost = prev.value - step.value;
            return { from: prev.label, to: step.label, rate, lost };
          });

          const worstDrop = dropoffs.reduce((a, b) => a.rate < b.rate ? a : b, dropoffs[0]);
          const bestDrop = dropoffs.reduce((a, b) => a.rate > b.rate ? a : b, dropoffs[0]);

          const engageStep = liveFunnel.find(s => s.label.includes("참여") || s.label.includes("세션"));
          const engageRate = first.value > 0 && engageStep ? (engageStep.value / first.value * 100) : 0;

          return (
            <div className={styles.funnelInsights}>
              <div className={styles.funnelInsightsTitle}>퍼널 핵심 지표</div>

              <div className={styles.funnelKpiRow}>
                <div className={styles.funnelKpiCard}>
                  <div className={styles.funnelKpiLabel}>전체 전환율</div>
                  <div className={styles.funnelKpiValue} style={{ color: overallRate >= 2 ? "var(--trend-green)" : overallRate >= 1 ? "var(--opportunity-amber)" : "var(--urgent-red)" }}>
                    {overallRate.toFixed(1)}%
                  </div>
                  <div className={styles.funnelKpiSub}>{first.label} → {last.label}</div>
                </div>
                <div className={styles.funnelKpiCard}>
                  <div className={styles.funnelKpiLabel}>페이지/세션</div>
                  <div className={styles.funnelKpiValue} style={{ color: "var(--color-primary)" }}>
                    {pagesPerSession.toFixed(1)}
                  </div>
                  <div className={styles.funnelKpiSub}>유입 대비 페이지 조회</div>
                </div>
                <div className={styles.funnelKpiCard}>
                  <div className={styles.funnelKpiLabel}>참여율</div>
                  <div className={styles.funnelKpiValue} style={{ color: engageRate >= 80 ? "var(--trend-green)" : engageRate >= 50 ? "var(--opportunity-amber)" : "var(--urgent-red)" }}>
                    {engageRate > 0 ? `${engageRate.toFixed(1)}%` : "-"}
                  </div>
                  <div className={styles.funnelKpiSub}>참여 세션 / 유입</div>
                </div>
                <div className={styles.funnelKpiCard}>
                  <div className={styles.funnelKpiLabel}>최대 이탈 구간</div>
                  <div className={styles.funnelKpiValue} style={{ color: "var(--urgent-red)" }}>
                    {worstDrop ? `${Math.abs(100 - worstDrop.rate).toFixed(0)}%` : "-"}
                  </div>
                  <div className={styles.funnelKpiSub}>{worstDrop ? worstDrop.from : "-"} 이탈</div>
                </div>
              </div>

              <div className={styles.funnelInsightsTitle}>단계별 전환율</div>
              <div className={styles.funnelDropoffs}>
                {dropoffs.map((d, idx) => {
                  const level = d.rate >= 70 ? "Good" : d.rate >= 30 ? "Warn" : "Poor";
                  const barColor = level === "Good" ? "#10B981" : level === "Warn" ? "#F59E0B" : "#EF4444";
                  return (
                    <div key={idx} className={styles.funnelDropoffRow}>
                      <span className={styles.funnelDropoffArrow}>{d.from} →</span>
                      <span className={styles.funnelDropoffLabel}>{d.to}</span>
                      <div className={styles.funnelDropoffBar}>
                        <div className={styles.funnelDropoffBarFill} style={{ width: `${Math.min(d.rate, 100)}%`, background: barColor }} />
                      </div>
                      <span className={`${styles.funnelDropoffRate} ${styles[`funnelDropoff${level}` as keyof typeof styles]}`}>
                        {d.rate.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0, width: 80, textAlign: "right" }}>
                        {d.lost > 0 ? `-${numberFormatter.format(d.lost)}명` : `+${numberFormatter.format(Math.abs(d.lost))}명`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.funnelInsightNote}>
                <div className={styles.funnelInsightNoteTitle}>AI 인사이트</div>
                {worstDrop && worstDrop.rate < 50 ? (
                  <span>
                    가장 큰 이탈이 <strong>{worstDrop.from}</strong> → <strong>{worstDrop.to}</strong> 구간에서 발생 (전환율 {worstDrop.rate.toFixed(1)}%, {numberFormatter.format(Math.abs(worstDrop.lost))}명 이탈).
                    이 구간의 CTA 배치, 페이지 로딩 속도, 콘텐츠 연관성을 점검하면 전체 전환율을 크게 개선할 수 있소.
                  </span>
                ) : (
                  <span>
                    전체 퍼널의 최종 전환율은 <strong>{overallRate.toFixed(1)}%</strong>이오.
                    {bestDrop && ` 가장 전환이 잘 되는 구간은 ${bestDrop.from} → ${bestDrop.to} (${bestDrop.rate.toFixed(1)}%)이오.`}
                    {engageRate > 0 && ` 참여율 ${engageRate.toFixed(1)}%로 유입 대비 콘텐츠 몰입도가 ${engageRate >= 80 ? "우수" : engageRate >= 50 ? "보통" : "낮은 편"}이오.`}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* 뷰저블 바로가기 */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>히트맵 / 세션 분석<WipBadge /></h2>
          <span className={styles.sectionMeta}>뷰저블(Beusable) 외부 도구</span>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 14 }}>
          뷰저블은 별도 독립 도구로 사용합니다. 아래 버튼으로 해당 페이지의 히트맵을 바로 확인할 수 있습니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {liveColumns.slice(0, 5).map((col) => (
            <button key={col.url} type="button" className={styles.beusableBtn}>
              🔥 {col.title.substring(0, 15)}...
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
