"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  PieChart, Pie,
} from "recharts";
import styles from "./page.module.css";
import type {
  CallpriceOverviewResponse,
  CallpriceManagersResponse,
  CallpriceAnalysisTypesResponse,
  CallpriceScenarioResponse,
  CallpriceOptionsResponse,
  CallpriceManagersRow,
  CallpriceAnalysisTypeRow,
  CallpriceDayTypeComparisonResponse,
  CallpriceDayTypeCompletionRow,
  CallpriceDayTypeValueRow,
  CallpriceSupplementPurchaseTimingResponse,
  CallpriceSupplementPurchaseTimingBucketRow,
  CallpriceSupplementRepeatPatternResponse,
  CallpriceSupplementRepeatPatternBucketRow,
  CallpriceSubscriptionConsultComparisonResponse,
  CallpriceSubscriptionStatusResponse,
  CallpriceRampupResponse,
  CallpriceRampupSummaryRow,
  CallpriceRampupManagerRow,
  CallpriceRampupSegmentSummaryRow,
  CallpriceRampupSegmentManagerRow,
  CallpriceProbationGuide,
} from "@/types/callprice";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

/* ── 현재 상담 업무를 하지 않는 상담사 ── */
const INACTIVE_MANAGERS = new Set(["경태", "글라", "연정"]);

/* ── 포맷 헬퍼 ── */
const fmtKRW = (v: number) => {
  if (Math.abs(v) >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
  if (Math.abs(v) >= 1_0000) return `${Math.round(v / 1_0000).toLocaleString("ko-KR")}만`;
  return v.toLocaleString("ko-KR");
};
const fmtKRWFull = (v: number) => v.toLocaleString("ko-KR");
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtPctPoint = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const fmtMultiple = (v: number) => `${v.toFixed(2)}x`;
const fmtWeekDelta = (current: number, previous: number) => {
  const diff = current - previous;
  if (diff === 0) return "직전 구간과 비슷";
  return diff > 0
    ? `직전 구간보다 ${fmtKRWFull(diff)}원 상승`
    : `직전 구간보다 ${fmtKRWFull(Math.abs(diff))}원 하락`;
};
const fmtVsWeekdayMoney = (diff: number, multiple: number) => {
  const amount = `${fmtKRWFull(Math.abs(diff))}원`;
  const pct = Math.abs((multiple - 1) * 100);
  const directionAmount = diff >= 0 ? "더 많고" : "더 적고";
  const directionPct = multiple >= 1 ? "높음" : "낮음";
  return `평일보다 ${amount} ${directionAmount}, 약 ${pct.toFixed(0)}% ${directionPct}`;
};
const shiftIsoDateLabel = (isoDate: string | null | undefined, days: number) => {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const toBarWidth = (value: number, maxValue: number) => {
  if (maxValue <= 0) return "0%";
  return `${Math.max(8, Math.round((value / maxValue) * 100))}%`;
};

type ProbationLevelTone = "strong" | "typical" | "minimum" | "fail";

const resolveProbationLevel = (
  row: Pick<
    CallpriceRampupSegmentManagerRow<1 | 2>,
    "completed_consultations" | "conversion_rate" | "estimated_value_per_consultation"
  >,
  guide?: CallpriceProbationGuide,
) => {
  if (!guide) {
    return {
      label: "판정 대기",
      tone: "minimum" as ProbationLevelTone,
    };
  }

  const meets = (target: CallpriceProbationGuide["minimum"]) =>
    row.completed_consultations >= target.completed_consultations &&
    row.conversion_rate >= target.conversion_rate &&
    row.estimated_value_per_consultation >= target.value_per_consultation;

  if (meets(guide.strong)) {
    return { label: "잘함", tone: "strong" as ProbationLevelTone };
  }
  if (meets(guide.typical)) {
    return { label: "보통", tone: "typical" as ProbationLevelTone };
  }
  if (meets(guide.minimum)) {
    return { label: "최소", tone: "minimum" as ProbationLevelTone };
  }
  return { label: "기준 미달", tone: "fail" as ProbationLevelTone };
};

/* ── 쿼리스트링 빌더 ── */
function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number] => e[1] != null && e[1] !== "",
  );
  return entries.length ? "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
}

/* ═══════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════ */
export default function CallpricePage() {
  /* ── 필터 상태 ── */
  const [startDate, setStartDate] = useState("2024-04-01");
  const [endDate, setEndDate] = useState("2026-03-27");
  const [maturityDays, setMaturityDays] = useState(90);
  const [baselineScope, setBaselineScope] = useState("global_non_consultation");
  const [manager, setManager] = useState("");
  const [analysisType, setAnalysisType] = useState("");
  const [monthlyCost, setMonthlyCost] = useState(4_000_000);
  const [headcount, setHeadcount] = useState(1);

  /* ── 데이터 상태 ── */
  const [options, setOptions] = useState<CallpriceOptionsResponse | null>(null);
  const [overview, setOverview] = useState<CallpriceOverviewResponse | null>(null);
  const [managers, setManagers] = useState<CallpriceManagersResponse | null>(null);
  const [analysisTypes, setAnalysisTypes] = useState<CallpriceAnalysisTypesResponse | null>(null);
  const [analysisTypesByType, setAnalysisTypesByType] = useState<CallpriceAnalysisTypesResponse | null>(null);
  const [scenario, setScenario] = useState<CallpriceScenarioResponse | null>(null);
  const [dayTypeComparison, setDayTypeComparison] = useState<CallpriceDayTypeComparisonResponse | null>(null);
  const [supplementTiming, setSupplementTiming] = useState<CallpriceSupplementPurchaseTimingResponse | null>(null);
  const [supplementRepeatPattern, setSupplementRepeatPattern] = useState<CallpriceSupplementRepeatPatternResponse | null>(null);
  const [subscriptionConsultComparison, setSubscriptionConsultComparison] = useState<CallpriceSubscriptionConsultComparisonResponse | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<CallpriceSubscriptionStatusResponse | null>(null);
  const [rampup, setRampup] = useState<CallpriceRampupResponse | null>(null);
  const [rampupProbation, setRampupProbation] = useState<CallpriceRampupResponse | null>(null);
  const [ltr6m, setLtr6m] = useState<CallpriceOverviewResponse | null>(null);
  const [ltr1y, setLtr1y] = useState<CallpriceOverviewResponse | null>(null);
  // P2-S5 상품 믹스 데이터
  const [productMix, setProductMix] = useState<Array<{ statusGroup: string; productCategory: string; customerCount: number; orderCount: number; totalRevenue: number; avgOrderValue: number }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleCard = (id: string) => setExpandedCard((prev) => (prev === id ? null : id));

  /* ── 옵션 로드 (1회) ── */
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/callprice/options`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setOptions(d))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  /* ── 메인 데이터 로드 ── */
  const loadData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    const common: Record<string, string | number | undefined> = {
      start_date: startDate,
      end_date: endDate,
      maturity_days: maturityDays,
      baseline_scope: baselineScope,
      manager: manager || undefined,
      analysis_type: analysisType || undefined,
    };

    try {
      const ltrBase = {
        start_date: startDate,
        end_date: endDate,
        baseline_scope: baselineScope,
        manager: manager || undefined,
        analysis_type: analysisType || undefined,
      };

      const [ov, mg, at, atByType, sc, dt, st, sr, ss, ru, ru30, l6m, l1y, pm] = await Promise.all([
        fetch(`${API_BASE}/api/callprice/overview${qs(common)}`, { signal }).then((r) => r.json()),
        fetch(`${API_BASE}/api/callprice/managers${qs(common)}`, { signal }).then((r) => r.json()),
        fetch(`${API_BASE}/api/callprice/analysis-types${qs({ ...common, manager: manager || undefined })}`, { signal }).then((r) => r.json()),
        fetch(
          `${API_BASE}/api/callprice/analysis-types${qs({
            ...common,
            manager: manager || undefined,
            baseline_scope: "analysis_type_non_consultation",
          })}`,
          { signal },
        ).then((r) => r.json()),
        fetch(`${API_BASE}/api/callprice/scenario${qs({ ...common, monthly_cost: monthlyCost, headcount })}`, { signal }).then((r) => r.json()),
        fetch(`${API_BASE}/api/callprice/daytype-comparison${qs({ start_date: startDate, end_date: endDate, value_maturity_days: 30 })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/supplement-purchase-timing${qs(common)}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/supplement-repeat-pattern${qs({ start_date: startDate, end_date: endDate, manager: manager || undefined, analysis_type: analysisType || undefined })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/subscription-status`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/rampup${qs({ maturity_days: maturityDays, baseline_scope: baselineScope })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/rampup${qs({ maturity_days: 30, baseline_scope: baselineScope })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/overview${qs({ ...ltrBase, maturity_days: 180 })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/callprice/overview${qs({ ...ltrBase, maturity_days: 365 })}`, { signal }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/consultation/product-followup?startDate=${startDate}&endDate=${endDate}`, { signal }).then((r) => r.json()).catch(() => null),
      ]);
      setOverview(ov);
      setManagers(mg);
      setAnalysisTypes(at);
      setAnalysisTypesByType(atByType);
      setScenario(sc);
      setDayTypeComparison(dt);
      setSupplementTiming(st);
      setSupplementRepeatPattern(sr);
      setSubscriptionStatus(ss);
      setRampup(ru);
      setRampupProbation(ru30);
      setLtr6m(l6m);
      setLtr1y(l1y);
      if (pm?.items) setProductMix(pm.items);
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [startDate, endDate, maturityDays, baselineScope, manager, analysisType, monthlyCost, headcount]);

  useEffect(() => {
    const ac = new AbortController();
    loadData(ac.signal);
    return () => ac.abort();
  }, [loadData]);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE}/api/callprice/subscription-consult-comparison`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setSubscriptionConsultComparison(d))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const s = overview?.data?.summary;
  const sc = scenario?.data;
  const allMgRows = managers?.data?.items ?? [];
  const activeMgRows = allMgRows.filter((r: CallpriceManagersRow) => !INACTIVE_MANAGERS.has(r.manager));
  const inactiveMgRows = allMgRows.filter((r: CallpriceManagersRow) => INACTIVE_MANAGERS.has(r.manager));
  const atRows = (analysisTypesByType?.data?.items ?? analysisTypes?.data?.items ?? []).filter(
    (row: CallpriceAnalysisTypeRow) => row.analysis_type !== "펫",
  );
  const analysisTypeNotes = analysisTypesByType?.notes ?? [];
  const analysisTypeFallbackNotes = analysisTypeNotes.filter(
    (note) => (note.includes("비교군") || note.includes("대체했습니다.")) && !note.includes("'펫'"),
  );
  const notes = overview?.notes ?? [];
  const dayTypeCompletion = dayTypeComparison?.data?.completion ?? [];
  const dayTypeValue = dayTypeComparison?.data?.value ?? [];
  const supplementTimingCohort = supplementTiming?.data?.cohort;
  const supplementTimingRows = supplementTiming?.data?.buckets ?? [];
  const supplementRepeatCohort = supplementRepeatPattern?.data?.cohort;
  const supplementRepeatSummary = supplementRepeatPattern?.data?.summary;
  const supplementRepeatRows = supplementRepeatPattern?.data?.buckets ?? [];
  const subscriptionConsultRows = subscriptionConsultComparison?.data?.items ?? [];
  const subscriptionConsult6m = subscriptionConsultRows.find((row) => row.period_label === "6개월");
  const subscriptionConsult1y = subscriptionConsultRows.find((row) => row.period_label === "1년");
  const subscriptionAvailability = subscriptionStatus?.data?.availability;
  const subscriptionSnapshot = subscriptionStatus?.data?.current_snapshot;
  const subscriptionSchemaEvidence = subscriptionStatus?.data?.schema_evidence;
  const subscriptionConversionRows = subscriptionStatus?.data?.conversion_periods ?? [];
  const subscriptionRatioRows = subscriptionStatus?.data?.supplement_ratio_periods ?? [];
  const subscription6m = subscriptionConversionRows.find((row) => row.period_label === "6개월");
  const subscription1y = subscriptionConversionRows.find((row) => row.period_label === "1년");
  const supplementSubscription6m = subscriptionRatioRows.find((row) => row.period_label === "6개월");
  const weekdayCompletion = dayTypeCompletion.find((row: CallpriceDayTypeCompletionRow) => row.day_type === "weekday");
  const weekendCompletion = dayTypeCompletion.find((row: CallpriceDayTypeCompletionRow) => row.day_type === "weekend");
  const weekdayValue = dayTypeValue.find((row: CallpriceDayTypeValueRow) => row.day_type === "weekday");
  const weekendValue = dayTypeValue.find((row: CallpriceDayTypeValueRow) => row.day_type === "weekend");
  const ltr6mCutoffDate = shiftIsoDateLabel(ltr6m?.meta?.reference_date as string | undefined, -180);
  const ltr1yCutoffDate = shiftIsoDateLabel(ltr1y?.meta?.reference_date as string | undefined, -365);
  const dayTypeMeta = dayTypeComparison?.data?.comparison;
  const rampupSummaryRows = rampup?.data?.summary_excluding_legacy ?? [];
  const rampupAllSummaryRows = rampup?.data?.summary_including_legacy ?? [];
  const rampupFortnightRows = rampup?.data?.fortnight_summary_excluding_legacy ?? [];
  const rampupAliasGroups = rampup?.data?.manager_alias_groups ?? [];
  const rampupHireDates = rampup?.data?.manager_hire_dates ?? [];
  const rampupManagerRows = [...(rampup?.data?.manager_items ?? [])].sort(
    (a: CallpriceRampupManagerRow, b: CallpriceRampupManagerRow) =>
      a.month_index - b.month_index || a.manager.localeCompare(b.manager, "ko"),
  );
  const rampupProbationRows = rampupProbation?.data?.checkpoint_summary_excluding_legacy ?? [];
  const rampupProbationManagerRows = [...(rampupProbation?.data?.checkpoint_manager_items ?? [])]
    .filter((row: CallpriceRampupSegmentManagerRow<1 | 2>) => !row.legacy_assumption)
    .sort(
      (a: CallpriceRampupSegmentManagerRow<1 | 2>, b: CallpriceRampupSegmentManagerRow<1 | 2>) =>
        a.segment_index - b.segment_index ||
        b.estimated_value_per_consultation - a.estimated_value_per_consultation ||
        a.manager.localeCompare(b.manager, "ko"),
    );
  const probationGuides = rampupProbation?.data?.probation_guides ?? [];
  const rampupMonth1 = rampupSummaryRows.find((row) => row.month_index === 1);
  const rampupMonth2 = rampupSummaryRows.find((row) => row.month_index === 2);
  const rampupMonth3 = rampupSummaryRows.find((row) => row.month_index === 3);
  const rampupFirstMonthAll = rampupAllSummaryRows.find((row) => row.month_index === 1);
  const rampupFortnightPeakRow = [...rampupFortnightRows].sort(
    (a: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>, b: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>) =>
      b.estimated_value_per_consultation - a.estimated_value_per_consultation,
  )[0];
  const rampupFortnightLowRow = [...rampupFortnightRows].sort(
    (a: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>, b: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>) =>
      a.estimated_value_per_consultation - b.estimated_value_per_consultation,
  )[0];
  const maxFortnightValue = Math.max(
    ...rampupFortnightRows.map((row: CallpriceRampupSegmentSummaryRow<1 | 2 | 3 | 4 | 5 | 6>) => row.estimated_value_per_consultation),
    0,
  );
  const probationWeek5 = rampupProbationRows.find((row) => row.segment_index === 1);
  const probationWeek10 = rampupProbationRows.find((row) => row.segment_index === 2);
  const probationGuideWeek5 = probationGuides.find((guide) => guide.checkpoint_label === "5주차");
  const probationGuideWeek10 = probationGuides.find((guide) => guide.checkpoint_label === "10주차");
  const probationWeek5Managers = rampupProbationManagerRows.filter((row) => row.segment_index === 1);
  const probationWeek10Managers = rampupProbationManagerRows.filter((row) => row.segment_index === 2);
  const fastStarterWeek5 = probationWeek5Managers[0];
  const slowStarterWeek5 = probationWeek5Managers[probationWeek5Managers.length - 1];
  const fastStarterWeek10 = probationWeek10Managers[0];
  const slowStarterWeek10 = probationWeek10Managers[probationWeek10Managers.length - 1];
  const aliasSummaryText = rampupAliasGroups
    .map((group) => `${group.aliases.join(", ")} = ${group.canonical_manager}`)
    .join(" · ");
  const hireDateSummaryText = rampupHireDates
    .map((item) => `${item.manager} ${item.hire_date}`)
    .join(" · ");
  const maxSupplementTimingShare = Math.max(
    ...supplementTimingRows.map(
      (row: CallpriceSupplementPurchaseTimingBucketRow) => row.share_of_supplement_buyers,
    ),
    0,
  );
  const maxSupplementRepeatShare = Math.max(
    ...supplementRepeatRows.map(
      (row: CallpriceSupplementRepeatPatternBucketRow) => row.share_of_matured_starters,
    ),
    0,
  );
  const supplementSameDay = supplementTimingRows.find((row) => row.bucket_key === "same_day");
  const supplementWithin3Days = supplementTimingRows.find((row) => row.bucket_key === "within_3_days");
  const supplementWithin30Days = supplementTimingRows
    .filter((row) => row.bucket_key !== "after_31_days")
    .reduce((sum, row) => sum + row.share_of_supplement_buyers, 0);
  const supplementAfter31Days = supplementTimingRows.find((row) => row.bucket_key === "after_31_days");
  const weekendConversionDiffPct = ((dayTypeMeta?.weekend_conversion_rate_diff ?? 0) * 100).toFixed(1);
  const weekendValueDiffText =
    dayTypeMeta && weekendValue && weekdayValue
      ? fmtVsWeekdayMoney(
          dayTypeMeta.weekend_value_per_completed_consultation_diff,
          dayTypeMeta.weekend_value_per_completed_consultation_multiple,
        )
      : null;

  /* ── 상담사 테이블 렌더 헬퍼 ── */
  const renderManagerRow = (row: CallpriceManagersRow, inactive?: boolean) => (
    <tr key={row.manager} className={`${styles.tableRow} ${inactive ? styles.tableRowInactive : ""}`}>
      <td>
        <strong>{row.manager}</strong>
        {inactive && <span className={styles.badgeInactive}>과거</span>}
      </td>
      <td className={styles.tableCellRight}>{fmtNum(row.completed_consultations)}</td>
      <td className={styles.tableCellRight}>{fmtNum(row.matured_customers)}</td>
      <td className={styles.tableCellRight}>{fmtPct(row.conversion_rate)}</td>
      <td className={styles.tableCellRight}>{fmtKRWFull(row.avg_revenue_per_customer)}원</td>
      <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_incremental_value_per_customer)}원</td>
      <td className={styles.tableCellRight}>{fmtKRW(row.estimated_incremental_revenue)}원</td>
      <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_value_per_consultation)}원</td>
      <td className={styles.tableCellRight}>{fmtPct(row.share_of_total_estimated_incremental_revenue)}</td>
      <td>
        <span className={`${styles.badge} ${
          row.sample_size_grade === "stable"
            ? styles.badgeStable
            : row.sample_size_grade === "watch"
              ? styles.badgeWatch
              : styles.badgeSmall
        }`}>
          {row.sample_size_grade === "stable" ? "안정" : row.sample_size_grade === "watch" ? "주의" : "소표본"}
        </span>
      </td>
    </tr>
  );

  /* ═══ 렌더링 ═══ */
  return (
    <div className={styles.page}>
      {/* ── 헤더 ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>
              ← 대시보드로 돌아가기
            </Link>
            <h1 className={styles.headerTitle}>상담사 가치 분석</h1>
            <p className={styles.headerSub}>
              상담 받은 고객 vs 미상담 고객 매출 비교 · 추정치 · read-only
            </p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* ── 용어 안내 ── */}
        <div className={styles.interpretBlock}>
          <strong>이 페이지의 핵심 개념</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
            <li><strong>상담 효과 추정 매출</strong> = 상담 받은 고객의 매출에서 미상담 고객의 매출을 뺀 차이. &quot;상담이 있어서 더 발생한 것으로 추정되는 매출&quot;이라는 뜻이다. 다만 상담 고객이 원래 구매 의향이 더 높았을 수 있으므로 <em>확정된 인과가 아닌 추정치</em>다.</li>
            <li><strong>성숙 고객</strong> = 첫 상담 완료일로부터 {maturityDays}일이 지난 고객. 최근 상담은 아직 구매할 시간이 부족하므로, 충분한 시간이 지난 고객만 비교 대상에 포함한다.</li>
            <li><strong>매출배수</strong> = 상담 효과 추정 매출 ÷ 인건비. 1x 이상이면 인건비보다 매출이 크다는 뜻.</li>
          </ul>
        </div>

        {/* ── 에러 ── */}
        {error && (
          <div className={styles.error}>
            <strong>오류</strong>: {error}
            <button onClick={() => { const ac = new AbortController(); loadData(ac.signal); }} style={{ marginLeft: 12, cursor: "pointer" }}>
              재시도
            </button>
          </div>
        )}

        {/* ── 컨트롤 바 ── */}
        <div className={styles.controlsBar}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>시작일</label>
            <input
              type="date"
              className={styles.controlInput}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>종료일</label>
            <input
              type="date"
              className={styles.controlInput}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>관찰 기간</label>
            <select
              className={styles.controlSelect}
              value={maturityDays}
              onChange={(e) => setMaturityDays(Number(e.target.value))}
            >
              {(options?.data?.maturity_day_options ?? [30, 60, 90, 180]).map((d) => (
                <option key={d} value={d}>{d}일</option>
              ))}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>비교군</label>
            <select
              className={styles.controlSelect}
              value={baselineScope}
              onChange={(e) => setBaselineScope(e.target.value)}
            >
              {(options?.data?.baseline_scope_options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {!options && (
                <>
                  <option value="global_non_consultation">전체 미상담 비교군</option>
                  <option value="analysis_type_non_consultation">분석유형별 미상담 비교군</option>
                </>
              )}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>상담사</label>
            <select
              className={styles.controlSelect}
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">전체</option>
              {(options?.data?.manager_options ?? [])
                .filter((m) => m !== "전체")
                .map((m) => (
                  <option key={m} value={m}>
                    {m}{INACTIVE_MANAGERS.has(m) ? " (과거)" : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>분석 유형</label>
            <select
              className={styles.controlSelect}
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
            >
              <option value="">전체</option>
              {(options?.data?.analysis_type_options ?? [])
                .filter((t) => t !== "전체" && t !== "펫")
                .map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
            </select>
          </div>
        </div>

        {/* ── 로딩 ── */}
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>데이터를 불러오는 중...</p>
          </div>
        )}

        {!loading && s && (
          <>
            {/* ═══ 1. Hero Summary (아코디언) ═══ */}
            <div className={styles.heroCards}>
              {/* 카드 1: 상담 효과 추정 매출 */}
              <div
                className={`${styles.heroCard} ${styles.heroCardClickable}`}
                onClick={() => toggleCard("revenue")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCard("revenue"); }}
              >
                <span className={styles.heroLabel}>
                  상담 효과 추정 매출
                  <span className={styles.heroToggle}>{expandedCard === "revenue" ? "▲" : "▼"}</span>
                </span>
                <span className={styles.heroValue}>
                  {fmtKRW(s.estimated_incremental_revenue)}
                  <span className={styles.heroUnit}>원</span>
                </span>
                <span className={styles.heroNote}>
                  클릭하면 계산 과정을 볼 수 있습니다
                </span>
                {expandedCard === "revenue" && (
                  <div className={styles.heroDetail}>
                    <div className={styles.heroDetailTitle}>어떻게 계산했나?</div>
                    <table className={styles.heroDetailTable}>
                      <tbody>
                        <tr><td>① 상담 완료 고객 수</td><td className={styles.tableCellRight}>{fmtNum(s.unique_completed_customers)}명</td></tr>
                        <tr><td>② 이 중 {maturityDays}일이 지난 성숙 고객</td><td className={styles.tableCellRight}>{fmtNum(s.matured_customers)}명</td></tr>
                        <tr><td>③ 성숙 고객의 평균 매출</td><td className={styles.tableCellRight}>{fmtKRWFull(s.avg_revenue_per_customer)}원</td></tr>
                        <tr><td>④ 미상담 고객의 평균 매출</td><td className={styles.tableCellRight}>{fmtKRWFull(s.baseline_avg_revenue_per_customer)}원</td></tr>
                        <tr className={styles.heroDetailHighlight}><td>⑤ 차이 (③ - ④) = 고객당 상담 효과</td><td className={styles.tableCellRight}><strong>{fmtKRWFull(s.estimated_incremental_value_per_customer)}원</strong></td></tr>
                        <tr className={styles.heroDetailHighlight}><td>⑥ 총 상담 효과 (② × ⑤)</td><td className={styles.tableCellRight}><strong>{fmtKRWFull(s.estimated_incremental_revenue)}원</strong></td></tr>
                      </tbody>
                    </table>
                    <p className={styles.heroDetailNote}>
                      쉽게 말하면: 상담 받은 고객이 미상담 고객보다 1인당 {fmtKRWFull(s.estimated_incremental_value_per_customer)}원을 더 소비했고,
                      이런 고객이 {fmtNum(s.matured_customers)}명이므로 총 {fmtKRW(s.estimated_incremental_revenue)}원의 추가 매출이 발생한 것으로 추정.
                      다만 상담 고객은 원래 구매 의향이 높은 사람이 많을 수 있어 정확한 인과 수치는 아님.
                    </p>
                  </div>
                )}
              </div>

              {/* 카드 2: 상담 1건당 추정 가치 */}
              <div
                className={`${styles.heroCard} ${styles.heroCardClickable}`}
                onClick={() => toggleCard("perConsultation")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCard("perConsultation"); }}
              >
                <span className={styles.heroLabel}>
                  상담 1건당 추정 가치
                  <span className={styles.heroToggle}>{expandedCard === "perConsultation" ? "▲" : "▼"}</span>
                </span>
                <span className={styles.heroValue}>
                  {fmtKRWFull(s.estimated_value_per_consultation)}
                  <span className={styles.heroUnit}>원</span>
                </span>
                <span className={styles.heroNote}>
                  완료 상담 {fmtNum(s.completed_consultations)}건
                </span>
                {expandedCard === "perConsultation" && (
                  <div className={styles.heroDetail}>
                    <div className={styles.heroDetailTitle}>계산 방법</div>
                    <table className={styles.heroDetailTable}>
                      <tbody>
                        <tr><td>총 상담 효과 추정 매출</td><td className={styles.tableCellRight}>{fmtKRWFull(s.estimated_incremental_revenue)}원</td></tr>
                        <tr><td>완료 상담 건수</td><td className={styles.tableCellRight}>{fmtNum(s.completed_consultations)}건</td></tr>
                        <tr className={styles.heroDetailHighlight}><td>1건당 가치 (÷)</td><td className={styles.tableCellRight}><strong>{fmtKRWFull(s.estimated_value_per_consultation)}원</strong></td></tr>
                      </tbody>
                    </table>
                    <p className={styles.heroDetailNote}>
                      상담 1건을 수행할 때마다 평균적으로 {fmtKRWFull(s.estimated_value_per_consultation)}원의 추가 매출이 발생한 것으로 추정.
                      상담사 충원 의사결정의 기초 자료로 활용할 수 있음.
                    </p>
                  </div>
                )}
              </div>

              {/* 카드 3: 구매 전환율 */}
              <div
                className={`${styles.heroCard} ${styles.heroCardClickable}`}
                onClick={() => toggleCard("conversion")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCard("conversion"); }}
              >
                <span className={styles.heroLabel}>
                  {maturityDays}일 내 구매 전환율
                  <span className={styles.heroToggle}>{expandedCard === "conversion" ? "▲" : "▼"}</span>
                </span>
                <span className={styles.heroValue}>
                  {fmtPct(s.conversion_rate)}
                </span>
                <span className={styles.heroNote}>
                  {fmtNum(s.converted_customers)}명 구매 / {fmtNum(s.matured_customers)}명 성숙 고객
                </span>
                {expandedCard === "conversion" && (
                  <div className={styles.heroDetail}>
                    <div className={styles.heroDetailTitle}>전환 퍼널</div>
                    <table className={styles.heroDetailTable}>
                      <tbody>
                        <tr><td>상담 완료 고객</td><td className={styles.tableCellRight}>{fmtNum(s.unique_completed_customers)}명</td></tr>
                        <tr><td>{maturityDays}일 성숙 고객</td><td className={styles.tableCellRight}>{fmtNum(s.matured_customers)}명</td></tr>
                        <tr><td>이 중 주문 매칭 고객</td><td className={styles.tableCellRight}>{fmtNum(s.matched_order_customers)}명</td></tr>
                        <tr className={styles.heroDetailHighlight}><td>{maturityDays}일 내 구매 전환</td><td className={styles.tableCellRight}><strong>{fmtNum(s.converted_customers)}명 ({fmtPct(s.conversion_rate)})</strong></td></tr>
                      </tbody>
                    </table>
                    <p className={styles.heroDetailNote}>
                      상담 완료 후 {maturityDays}일 이내에 실제 구매로 이어진 비율.
                      최근 상담 고객은 아직 구매 시간이 부족하므로 {maturityDays}일이 지난 &quot;성숙 고객&quot;만 분모에 포함.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 해석 블록 */}
            <div className={styles.interpretBlock}>
              <strong>핵심 요약</strong>: 상담의 가장 큰 효과는 <em>구매하지 않았을 고객을 구매하게 만드는 것</em>이다.
              상담 고객은 미상담 고객 대비 {maturityDays}일 매출이{" "}
              <strong>{fmtMultiple(s.avg_revenue_per_customer / Math.max(s.baseline_avg_revenue_per_customer, 1))}</strong> 높다.
              다만 이 수치는 참고용 추정치이다.
            </div>

            {/* ═══ 2. 시나리오 시뮬레이션 ═══ */}
            {sc && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>상담사 충원 시 매출 시뮬레이션</h2>
                <p className={styles.sectionDesc}>
                  현재 기간 성과를 월 단위로 환산한 추정치이다. 공식 인력 계획이 아니라 의사결정 참고용이다.
                </p>

                <div className={styles.controlsBar} style={{ marginBottom: 16 }}>
                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>월 인건비 (원)</label>
                    <input
                      type="number"
                      className={styles.controlInput}
                      value={monthlyCost}
                      onChange={(e) => setMonthlyCost(Number(e.target.value) || 0)}
                      step={500000}
                    />
                  </div>
                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>충원 인원</label>
                    <input
                      type="number"
                      className={styles.controlInput}
                      value={headcount}
                      onChange={(e) => setHeadcount(Number(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                </div>

                <div className={styles.scenarioGrid}>
                  <div className={styles.scenarioItem}>
                    <span className={styles.heroLabel}>월 추정 매출 효과</span>
                    <span className={styles.heroValue}>{fmtKRW(sc.estimated_incremental_revenue)}원</span>
                  </div>
                  <div className={styles.scenarioItem}>
                    <span className={styles.heroLabel}>매출배수 (매출÷인건비)</span>
                    <span className={`${styles.heroValue} ${sc.incremental_revenue_multiple >= 1 ? styles.heroPositive : styles.heroNegative}`}>
                      {fmtMultiple(sc.incremental_revenue_multiple)}
                    </span>
                  </div>
                  <div className={styles.scenarioItem}>
                    <span className={styles.heroLabel}>인건비 차감 후 잔여매출</span>
                    <span className={`${styles.heroValue} ${sc.estimated_incremental_profit >= 0 ? styles.heroPositive : styles.heroNegative}`}>
                      {fmtKRW(sc.estimated_incremental_profit)}원
                    </span>
                  </div>
                  <div className={styles.scenarioItem}>
                    <span className={styles.heroLabel}>손익분기 인건비</span>
                    <span className={styles.heroValue}>{fmtKRW(sc.break_even_cost)}원</span>
                  </div>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>참고</strong>: 이 시뮬레이션은 현재 기간({scenario?.meta?.period_days ?? "-"}일) 실적을 월 환산한 값이다.
                  신규 상담사의 실제 성과는 온보딩 기간, 고객 배정 패턴, 시즌성에 따라 달라진다.
                </div>
              </div>
            )}

            {/* ═══ 3. 신규 상담사 랜딩 속도 ═══ */}
            {rampupSummaryRows.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>신규 상담사 초기 랜딩 속도</h2>
                <p className={styles.sectionDesc}>
                  `1개월차 / 2개월차 / 3개월차`는 각 상담사의 <strong>초기 근무 구간</strong>을 30일씩 끊어서 본 값이다.
                  상단 평균은 기본적으로 <strong>민정, 경태, 동주</strong>를 제외한 값이며,
                  이 셋은 실제 입사일이 오래되어 DB에 초기 구간이 비어 있기 때문이다.
                  {aliasSummaryText ? ` ${aliasSummaryText}.` : ""}
                  {hireDateSummaryText ? ` 확인된 실제 입사일은 ${hireDateSummaryText}.` : ""}
                  이 섹션은 <strong>상단 시작일/종료일 필터와 별개로 전체 관측기간</strong>을 기준으로 계산한다.
                </p>

                <div className={styles.comparisonGrid}>
                  {rampupSummaryRows.map((row: CallpriceRampupSummaryRow) => (
                    <div key={row.month_index} className={styles.comparisonCard}>
                      <span className={styles.comparisonLabel}>{row.month_label}</span>
                      <span className={styles.comparisonValue}>
                        {fmtKRWFull(row.estimated_value_per_consultation)}원
                      </span>
                      <span className={styles.heroNote}>
                        상담 1건 가치 · 전환율 {fmtPct(row.conversion_rate)} · 고객당 매출 {fmtKRW(row.avg_revenue_per_customer)}원
                      </span>
                      <span className={styles.heroNote}>
                        상담 효과/고객 {fmtKRW(row.estimated_incremental_value_per_customer)}원 · 상담 효과 매출 {fmtKRW(row.estimated_incremental_revenue)}원 · 포함 상담사 {fmtNum(row.manager_count)}명
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.interpretBlock}>
                  <strong>해석</strong>: 최근 입사자 기준으로 보면 1개월차 상담 1건 가치는{" "}
                  <strong>{fmtKRW(rampupMonth1?.estimated_value_per_consultation ?? 0)}원</strong>,
                  2개월차는 <strong>{fmtKRW(rampupMonth2?.estimated_value_per_consultation ?? 0)}원</strong>으로 한 번 주춤했다가,
                  3개월차에는 <strong>{fmtKRW(rampupMonth3?.estimated_value_per_consultation ?? 0)}원</strong>까지 올라간다.
                  따라서 평균적으로는 첫 달부터 기본 성과는 나오지만, <em>2개월 안팎에 안정화되고 3개월차에 상방이 확인되는 구조</em>로 읽는 것이 안전하다.
                  다만 3개월차는 포함 상담사가 <strong>{fmtNum(rampupMonth3?.manager_count ?? 0)}명</strong>으로 줄고,
                  가장 최근 입사자는 아직 {maturityDays}일 관찰기간이 다 차지 않아 과대해석하면 안 된다.
                  {rampupFirstMonthAll
                    ? ` 민정·경태까지 포함하면 1개월차 상담 1건 가치는 ${fmtKRW(
                        rampupFirstMonthAll.estimated_value_per_consultation,
                      )}원으로 더 높게 보이지만, 이 둘은 실제 입사월과 DB 첫 관측월이 다를 수 있어 기본 판단에서는 제외한다.`
                    : ""}
                </div>

                {rampupFortnightRows.length > 0 && (
                  <>
                    <h3 className={styles.sectionTitle} style={{ marginTop: 28, fontSize: "1rem" }}>
                      2주 단위 랜딩 경향성
                    </h3>
                    <p className={styles.sectionDesc}>
                      `1~2주차`, `3~4주차`, `5~6주차`, `7~8주차`, `9~10주차`, `11~12주차` 순으로 보면
                      어디서 잠깐 흔들리고, 어느 시점에 다시 올라오는지 더 빨리 볼 수 있다.
                    </p>
                    <div className={styles.trendChart}>
                      {rampupFortnightRows.map((row, index) => {
                        const previous = index > 0 ? rampupFortnightRows[index - 1] : null;
                        return (
                          <div key={row.segment_index} className={styles.trendRow}>
                            <div className={styles.trendRowHeader}>
                              <div>
                                <strong>{row.segment_label}</strong>
                                <span className={styles.trendMeta}>
                                  전환율 {fmtPct(row.conversion_rate)} · 고객당 매출 {fmtKRWFull(row.avg_revenue_per_customer)}원
                                </span>
                              </div>
                              <strong>{fmtKRWFull(row.estimated_value_per_consultation)}원</strong>
                            </div>
                            <div className={styles.trendBarTrack}>
                              <div
                                className={styles.trendBarFill}
                                style={{ width: toBarWidth(row.estimated_value_per_consultation, maxFortnightValue) }}
                              />
                            </div>
                            <div className={styles.trendMeta}>
                              상담 효과/고객 {fmtKRWFull(row.estimated_incremental_value_per_customer)}원 ·
                              {" "}
                              상담 효과 매출 {fmtKRW(row.estimated_incremental_revenue)}원 ·
                              {" "}
                              {previous
                                ? fmtWeekDelta(
                                    row.estimated_value_per_consultation,
                                    previous.estimated_value_per_consultation,
                                  )
                                : "첫 구간"}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.interpretBlock}>
                      <strong>2주 단위 해석</strong>: 가장 강한 구간은{" "}
                      <strong>{rampupFortnightPeakRow?.segment_label ?? "-"}</strong>
                      {rampupFortnightPeakRow
                        ? ` (${fmtKRWFull(rampupFortnightPeakRow.estimated_value_per_consultation)}원)`
                        : ""}
                      이고, 가장 약한 구간은{" "}
                      <strong>{rampupFortnightLowRow?.segment_label ?? "-"}</strong>
                      {rampupFortnightLowRow
                        ? ` (${fmtKRWFull(rampupFortnightLowRow.estimated_value_per_consultation)}원)`
                        : ""}
                      이다. 지금 데이터에서는 `3~4주차`까지는 버티다가 `5~8주차`에 한 번 약해지고,
                      `9~10주차`에 다시 크게 올라가는 흐름이 보인다.
                    </div>
                  </>
                )}

                {rampupProbationRows.length > 0 && (
                  <>
                    <h3 className={styles.sectionTitle} style={{ marginTop: 28, fontSize: "1rem" }}>
                      5주차 · 10주차 수습 평가
                    </h3>
                    <p className={styles.sectionDesc}>
                      수습 평가는 <strong>90일 LTR</strong>보다 <strong>30일 기준</strong>이 맞다.
                      5주차 1차 수습평가, 10주차 2차 수습평가 모두 `완료 상담 수`, `30일 구매 전환율`, `상담 1건 가치`를 같이 본다.
                    </p>

                    <div className={styles.checkpointGrid}>
                      {[probationWeek5, probationWeek10].filter(Boolean).map((row) => {
                        const checkpointRow = row!;
                        const guide =
                          checkpointRow.segment_index === 1 ? probationGuideWeek5 : probationGuideWeek10;
                        return (
                          <div key={checkpointRow.segment_index} className={styles.checkpointCard}>
                            <div className={styles.checkpointHeader}>
                              <strong>{checkpointRow.segment_label}</strong>
                              <span>{fmtKRWFull(checkpointRow.estimated_value_per_consultation)}원</span>
                            </div>
                            <div className={styles.checkpointMetrics}>
                              <div>
                                <span className={styles.heroLabel}>완료 상담</span>
                                <strong>{fmtNum(checkpointRow.completed_consultations)}건</strong>
                              </div>
                              <div>
                                <span className={styles.heroLabel}>30일 구매 전환율</span>
                                <strong>{fmtPct(checkpointRow.conversion_rate)}</strong>
                              </div>
                              <div>
                                <span className={styles.heroLabel}>고객당 매출</span>
                                <strong>{fmtKRWFull(checkpointRow.avg_revenue_per_customer)}원</strong>
                              </div>
                              <div>
                                <span className={styles.heroLabel}>상담 효과/고객</span>
                                <strong>{fmtKRWFull(checkpointRow.estimated_incremental_value_per_customer)}원</strong>
                              </div>
                            </div>
                            {guide && (
                              <div className={styles.checkpointGuide}>
                                <div>최소: 완료 상담 {fmtNum(guide.minimum.completed_consultations)}건 · 전환율 {fmtPct(guide.minimum.conversion_rate)} · 상담 1건 가치 {fmtKRWFull(guide.minimum.value_per_consultation)}원</div>
                                <div>보통: 완료 상담 {fmtNum(guide.typical.completed_consultations)}건 · 전환율 {fmtPct(guide.typical.conversion_rate)} · 상담 1건 가치 {fmtKRWFull(guide.typical.value_per_consultation)}원</div>
                                <div>잘함: 완료 상담 {fmtNum(guide.strong.completed_consultations)}건 · 전환율 {fmtPct(guide.strong.conversion_rate)} · 상담 1건 가치 {fmtKRWFull(guide.strong.value_per_consultation)}원</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.starterGrid}>
                      {fastStarterWeek5 && (
                        <div className={styles.starterCard}>
                          <span className={styles.heroLabel}>5주차 빠른 시작</span>
                          <strong>{fastStarterWeek5.manager}</strong>
                          <span className={styles.heroNote}>
                            상담 1건 가치 {fmtKRWFull(fastStarterWeek5.estimated_value_per_consultation)}원 · 전환율 {fmtPct(fastStarterWeek5.conversion_rate)}
                          </span>
                        </div>
                      )}
                      {slowStarterWeek5 && (
                        <div className={styles.starterCard}>
                          <span className={styles.heroLabel}>5주차 느린 시작</span>
                          <strong>{slowStarterWeek5.manager}</strong>
                          <span className={styles.heroNote}>
                            상담 1건 가치 {fmtKRWFull(slowStarterWeek5.estimated_value_per_consultation)}원 · 전환율 {fmtPct(slowStarterWeek5.conversion_rate)}
                          </span>
                        </div>
                      )}
                      {fastStarterWeek10 && (
                        <div className={styles.starterCard}>
                          <span className={styles.heroLabel}>10주차 상위권</span>
                          <strong>{fastStarterWeek10.manager}</strong>
                          <span className={styles.heroNote}>
                            상담 1건 가치 {fmtKRWFull(fastStarterWeek10.estimated_value_per_consultation)}원 · 전환율 {fmtPct(fastStarterWeek10.conversion_rate)}
                          </span>
                        </div>
                      )}
                      {slowStarterWeek10 && (
                        <div className={styles.starterCard}>
                          <span className={styles.heroLabel}>10주차 하위권</span>
                          <strong>{slowStarterWeek10.manager}</strong>
                          <span className={styles.heroNote}>
                            상담 1건 가치 {fmtKRWFull(slowStarterWeek10.estimated_value_per_consultation)}원 · 전환율 {fmtPct(slowStarterWeek10.conversion_rate)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.interpretBlock}>
                      <strong>초기 랜딩 판단</strong>: 5주차 기준으로 가장 빠르게 자리 잡은 상담사는{" "}
                      <strong>{fastStarterWeek5?.manager ?? "-"}</strong>이고, 가장 느린 쪽은{" "}
                      <strong>{slowStarterWeek5?.manager ?? "-"}</strong>다. 10주차까지 보면{" "}
                      <strong>{fastStarterWeek10?.manager ?? "-"}</strong>가 가장 높고,{" "}
                      <strong>{slowStarterWeek10?.manager ?? "-"}</strong>가 상대적으로 느리다.
                      다만 `느리다`는 말은 <em>상대 비교</em>이고, 절대적으로 실패라는 뜻은 아니다.
                    </div>

                    <div style={{ overflowX: "auto", marginTop: 20 }}>
                      <table className={styles.table}>
                        <thead>
                          <tr className={styles.tableHead}>
                            <th>상담사</th>
                            <th>평가 시점</th>
                            <th className={styles.tableCellRight}>완료 상담</th>
                            <th className={styles.tableCellRight}>30일 전환율</th>
                            <th className={styles.tableCellRight}>고객당 매출</th>
                            <th className={styles.tableCellRight}>상담 효과/고객</th>
                            <th className={styles.tableCellRight}>상담 1건 가치</th>
                            <th>판정</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rampupProbationManagerRows.map((row) => {
                            const guide =
                              row.segment_index === 1 ? probationGuideWeek5 : probationGuideWeek10;
                            const level = resolveProbationLevel(row, guide);
                            return (
                              <tr key={`${row.manager}-${row.segment_index}`} className={styles.tableRow}>
                                <td><strong>{row.manager}</strong></td>
                                <td>{row.segment_label}</td>
                                <td className={styles.tableCellRight}>{fmtNum(row.completed_consultations)}</td>
                                <td className={styles.tableCellRight}>{fmtPct(row.conversion_rate)}</td>
                                <td className={styles.tableCellRight}>{fmtKRWFull(row.avg_revenue_per_customer)}원</td>
                                <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_incremental_value_per_customer)}원</td>
                                <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_value_per_consultation)}원</td>
                                <td>
                                  <span
                                    className={`${styles.badge} ${
                                      level.tone === "strong"
                                        ? styles.badgeStable
                                        : level.tone === "typical"
                                          ? styles.badgeTypical
                                          : level.tone === "minimum"
                                            ? styles.badgeWatch
                                            : styles.badgeSmall
                                    }`}
                                  >
                                    {level.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>월차</th>
                        <th className={styles.tableCellRight}>포함 상담사</th>
                        <th className={styles.tableCellRight}>완료 상담</th>
                        <th className={styles.tableCellRight}>성숙 고객</th>
                        <th className={styles.tableCellRight}>전환율</th>
                        <th className={styles.tableCellRight}>고객당 매출</th>
                        <th className={styles.tableCellRight}>상담 효과/고객</th>
                        <th className={styles.tableCellRight}>상담 효과 매출</th>
                        <th className={styles.tableCellRight}>상담 1건 가치</th>
                        <th>샘플</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rampupSummaryRows.map((row: CallpriceRampupSummaryRow) => (
                        <tr key={row.month_index} className={styles.tableRow}>
                          <td>
                            <strong>{row.month_label}</strong>
                          </td>
                          <td className={styles.tableCellRight}>{fmtNum(row.manager_count)}명</td>
                          <td className={styles.tableCellRight}>{fmtNum(row.completed_consultations)}</td>
                          <td className={styles.tableCellRight}>{fmtNum(row.matured_customers)}</td>
                          <td className={styles.tableCellRight}>{fmtPct(row.conversion_rate)}</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.avg_revenue_per_customer)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_incremental_value_per_customer)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRW(row.estimated_incremental_revenue)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_value_per_consultation)}원</td>
                          <td>
                            <span className={`${styles.badge} ${
                              row.sample_size_grade === "stable"
                                ? styles.badgeStable
                                : row.sample_size_grade === "watch"
                                  ? styles.badgeWatch
                                  : styles.badgeSmall
                            }`}>
                              {row.sample_size_grade === "stable" ? "안정" : row.sample_size_grade === "watch" ? "주의" : "소표본"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: 32, fontSize: "1rem" }}>
                  상담사별 1개월차 · 2개월차 · 3개월차 상세
                </h3>
                <p className={styles.sectionDesc}>
                  `민정`, `경태`, `동주`는 <strong>참고</strong> 배지로 표시했다.
                  이 셋은 실제 입사일이 각각 2023-11-20, 2022-06-21, 2023-07-24로 확인돼 있어,
                  DB 첫 완료 상담일만으로 초기 랜딩을 읽으면 왜곡될 수 있다.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>상담사</th>
                        <th>월차</th>
                        <th>첫 관측일</th>
                        <th>구간</th>
                        <th className={styles.tableCellRight}>완료 상담</th>
                        <th className={styles.tableCellRight}>성숙 고객</th>
                        <th className={styles.tableCellRight}>전환율</th>
                        <th className={styles.tableCellRight}>고객당 매출</th>
                        <th className={styles.tableCellRight}>상담 효과/고객</th>
                        <th className={styles.tableCellRight}>상담 효과 매출</th>
                        <th className={styles.tableCellRight}>상담 1건 가치</th>
                        <th>샘플</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rampupManagerRows.map((row: CallpriceRampupManagerRow) => (
                        <tr
                          key={`${row.manager}-${row.month_index}`}
                          className={`${styles.tableRow} ${row.legacy_assumption ? styles.tableRowInactive : ""}`}
                        >
                          <td>
                            <strong>{row.manager}</strong>
                            {row.legacy_assumption && <span className={styles.badgeInactive}>참고</span>}
                          </td>
                          <td>{row.month_label}</td>
                          <td>{row.first_observed_completed_date}</td>
                          <td>{row.window_start_date} ~ {row.window_end_date}</td>
                          <td className={styles.tableCellRight}>{fmtNum(row.completed_consultations)}</td>
                          <td className={styles.tableCellRight}>{fmtNum(row.matured_customers)}</td>
                          <td className={styles.tableCellRight}>{fmtPct(row.conversion_rate)}</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.avg_revenue_per_customer)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_incremental_value_per_customer)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRW(row.estimated_incremental_revenue)}원</td>
                          <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_value_per_consultation)}원</td>
                          <td>
                            <span className={`${styles.badge} ${
                              row.sample_size_grade === "stable"
                                ? styles.badgeStable
                                : row.sample_size_grade === "watch"
                                  ? styles.badgeWatch
                                  : styles.badgeSmall
                            }`}>
                              {row.sample_size_grade === "stable" ? "안정" : row.sample_size_grade === "watch" ? "주의" : "소표본"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ 4. 상담사 순위 ═══ */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>현재 상담사별 성과</h2>
              <p className={styles.sectionDesc}>
                현재 상담 업무를 수행 중인 상담사 기준.
                &quot;상담 효과/고객&quot;은 상담 고객 평균 매출에서 미상담 고객 평균 매출을 뺀 차이다.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>상담사</th>
                      <th className={styles.tableCellRight}>완료 상담</th>
                      <th className={styles.tableCellRight}>성숙 고객</th>
                      <th className={styles.tableCellRight}>전환율</th>
                      <th className={styles.tableCellRight}>고객당 매출</th>
                      <th className={styles.tableCellRight}>상담 효과/고객</th>
                      <th className={styles.tableCellRight}>상담 효과 매출</th>
                      <th className={styles.tableCellRight}>상담 1건 가치</th>
                      <th className={styles.tableCellRight}>매출 점유</th>
                      <th>샘플</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMgRows.map((row) => renderManagerRow(row))}
                  </tbody>
                </table>
              </div>

              {/* 과거 상담사 */}
              {inactiveMgRows.length > 0 && (
                <>
                  <h3 className={styles.sectionTitle} style={{ marginTop: 32, fontSize: "1rem" }}>
                    과거 상담사 (현재 상담 업무 미수행)
                  </h3>
                  <p className={styles.sectionDesc}>
                    경태, 글라, 연정은 현재 상담 업무를 하지 않는다. 과거 실적 참고용으로만 표시한다.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHead}>
                          <th>상담사</th>
                          <th className={styles.tableCellRight}>완료 상담</th>
                          <th className={styles.tableCellRight}>성숙 고객</th>
                          <th className={styles.tableCellRight}>전환율</th>
                          <th className={styles.tableCellRight}>고객당 매출</th>
                          <th className={styles.tableCellRight}>상담 효과/고객</th>
                          <th className={styles.tableCellRight}>상담 효과 매출</th>
                          <th className={styles.tableCellRight}>상담 1건 가치</th>
                          <th className={styles.tableCellRight}>매출 점유</th>
                          <th>샘플</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inactiveMgRows.map((row) => renderManagerRow(row, true))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* ═══ 5. 분석유형별 비교 ═══ */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>검사 유형별 상담 효과 비교</h2>
              <p className={styles.sectionDesc}>
                이 표는 `전체 미상담 평균`이 아니라, <strong>해당 검사 유형에 가까운 미상담 고객</strong>을 비교군으로 다시 잡아 계산한다.
                그래서 예전처럼 미상담 매출이 전부 같은 숫자로 보이지 않고, 검사별 기준선이 다르게 나온다.
              </p>

              {/* 분석유형별 차트 (P2-S3) */}
              {atRows.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14, padding: "20px 16px", marginBottom: 16, border: "1px solid rgba(226,232,240,0.5)" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: 12 }}>검사 유형별 상담 1건 가치 vs 고객당 매출</div>
                  <ResponsiveContainer width="100%" height={Math.max(220, atRows.length * 44)}>
                    <BarChart data={atRows.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₩${(Number(v) / 10000).toFixed(0)}만`} />
                      <YAxis type="category" dataKey="analysis_type" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v, name) => [`₩${Number(v ?? 0).toLocaleString("ko-KR")}`, String(name)]}
                        contentStyle={{ fontSize: "0.78rem", borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="estimated_value_per_consultation" fill="#6366f1" name="상담 1건 가치" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="avg_revenue_per_customer" fill="#0ea5e9" name="고객당 매출" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>분석 유형</th>
                      <th className={styles.tableCellRight}>완료 상담</th>
                      <th className={styles.tableCellRight}>성숙 고객</th>
                      <th className={styles.tableCellRight}>전환율</th>
                      <th className={styles.tableCellRight}>고객당 매출</th>
                      <th className={styles.tableCellRight}>해당 검사 유형 미상담 매출</th>
                      <th className={styles.tableCellRight}>상담 효과/고객</th>
                      <th className={styles.tableCellRight}>상담 효과 매출</th>
                      <th className={styles.tableCellRight}>상담 1건 가치</th>
                      <th>샘플</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRows.map((row: CallpriceAnalysisTypeRow) => (
                      <tr key={row.analysis_type} className={styles.tableRow}>
                        <td><strong>{row.analysis_type}</strong></td>
                        <td className={styles.tableCellRight}>{fmtNum(row.completed_consultations)}</td>
                        <td className={styles.tableCellRight}>{fmtNum(row.matured_customers)}</td>
                        <td className={styles.tableCellRight}>{fmtPct(row.conversion_rate)}</td>
                        <td className={styles.tableCellRight}>{fmtKRWFull(row.avg_revenue_per_customer)}원</td>
                        <td className={styles.tableCellRight}>{fmtKRWFull(row.baseline_avg_revenue_per_customer)}원</td>
                        <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_incremental_value_per_customer)}원</td>
                        <td className={styles.tableCellRight}>{fmtKRW(row.estimated_incremental_revenue)}원</td>
                        <td className={styles.tableCellRight}>{fmtKRWFull(row.estimated_value_per_consultation)}원</td>
                        <td>
                          <span className={`${styles.badge} ${
                            row.sample_size_grade === "stable"
                              ? styles.badgeStable
                              : row.sample_size_grade === "watch"
                                ? styles.badgeWatch
                                : styles.badgeSmall
                          }`}>
                            {row.sample_size_grade === "stable" ? "안정" : row.sample_size_grade === "watch" ? "주의" : "소표본"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.interpretBlock}>
                <strong>읽는 법</strong>: 여기의 `해당 검사 유형 미상담 매출`은
                `같은 검사 유형인데 상담은 받지 않은 고객`의 {maturityDays}일 고객당 매출이다.
                예를 들어 유기산 상담 고객은 유기산 계열 미상담 고객과, 중금속 상담 고객은 중금속 계열 미상담 고객과 비교하는 식이다.
                그래서 이 표는 `검사 종류가 달라서 원래 매출 수준이 다른 문제`를 조금 더 줄여서 보는 데 목적이 있다.
                {analysisTypeFallbackNotes.length > 0 && (
                  <>
                    {" "}다만 {analysisTypeFallbackNotes.map((note) => note.replace(/.*'(.+?)'.*/, "$1")).join(", ")}처럼
                    원천 `report_type`에 직접 매핑이 안 되는 유형은 전체 미상담 평균으로 대체했다.
                  </>
                )}
              </div>
            </div>

            {/* ═══ 6. 코호트 비교 (상담군 vs 미상담군) ═══ */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>상담 받은 고객 vs 미상담 고객 비교</h2>
              <p className={styles.sectionDesc}>
                첫 상담 완료 후 {maturityDays}일이 지난 &quot;성숙 고객&quot;만 비교 대상에 포함.
                최근 상담 고객은 아직 구매할 시간이 충분하지 않으므로 제외된다.
              </p>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>상담 고객 평균 매출</span>
                  <span className={styles.comparisonValue}>{fmtKRWFull(s.avg_revenue_per_customer)}원</span>
                </div>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>미상담 고객 평균 매출</span>
                  <span className={styles.comparisonValue}>{fmtKRWFull(s.baseline_avg_revenue_per_customer)}원</span>
                </div>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>매출 배수</span>
                  <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                    {fmtMultiple(s.avg_revenue_per_customer / Math.max(s.baseline_avg_revenue_per_customer, 1))}
                  </span>
                </div>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>상담 효과 추정/고객</span>
                  <span className={`${styles.comparisonValue} ${s.estimated_incremental_value_per_customer >= 0 ? styles.heroPositive : styles.heroNegative}`}>
                    {fmtKRWFull(s.estimated_incremental_value_per_customer)}원
                  </span>
                </div>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>{maturityDays}일 내 구매 전환율</span>
                  <span className={styles.comparisonValue}>{fmtPct(s.conversion_rate)}</span>
                </div>
                <div className={styles.comparisonCard}>
                  <span className={styles.comparisonLabel}>주문 매칭 고객</span>
                  <span className={styles.comparisonValue}>
                    {fmtNum(s.matched_order_customers)}명 / {fmtNum(s.unique_completed_customers)}명
                  </span>
                </div>
              </div>
            </div>

            {supplementTimingCohort && supplementTimingRows.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>상담 후 영양제 첫 구매 시점</h2>
                <p className={styles.sectionDesc}>
                  여기서는 <strong>첫 완료 상담일 이후 첫 영양제 주문</strong>이 언제 발생했는지를 본다.
                  최근 상담 편향을 줄이기 위해 <strong>{maturityDays}일 이상 지난 성숙 상담 고객</strong>만 포함했다.
                  구간은 겹치지 않게 `상담 당일`, `1~3일`, `4~7일`, `8~14일`, `15~30일`, `31일 이후`로 나눴다.
                </p>

                <div className={styles.comparisonGrid}>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>성숙 상담 고객</span>
                    <span className={styles.comparisonValue}>{fmtNum(supplementTimingCohort.matured_customers)}명</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>영양제 구매 고객</span>
                    <span className={styles.comparisonValue}>{fmtNum(supplementTimingCohort.supplement_buyers)}명</span>
                    <span className={styles.heroNote}>
                      전체 대비 {fmtPct(supplementTimingCohort.supplement_conversion_rate)}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>아직 영양제 구매 없음</span>
                    <span className={styles.comparisonValue}>{fmtNum(supplementTimingCohort.no_supplement_purchase_customers)}명</span>
                  </div>
                </div>

                <div className={styles.trendChart}>
                  {supplementTimingRows.map((row) => (
                    <div key={row.bucket_key} className={styles.trendRow}>
                      <div className={styles.trendRowHeader}>
                        <div>
                          <strong>{row.label}</strong>
                          <span className={styles.trendMeta}>
                            영양제 구매 고객 안에서 {fmtPct(row.share_of_supplement_buyers)} ·
                            {" "}
                            성숙 상담 고객 전체에서 {fmtPct(row.share_of_matured_consultation_customers)}
                          </span>
                        </div>
                        <strong>{fmtNum(row.customer_count)}명</strong>
                      </div>
                      <div className={styles.trendBarTrack}>
                        <div
                          className={styles.trendBarFill}
                          style={{ width: toBarWidth(row.share_of_supplement_buyers, maxSupplementTimingShare) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>구간</th>
                        <th className={styles.tableCellRight}>고객 수</th>
                        <th className={styles.tableCellRight}>영양제 구매 고객 내 비중</th>
                        <th className={styles.tableCellRight}>성숙 상담 고객 전체 대비 비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplementTimingRows.map((row) => (
                        <tr key={row.bucket_key} className={styles.tableRow}>
                          <td><strong>{row.label}</strong></td>
                          <td className={styles.tableCellRight}>{fmtNum(row.customer_count)}명</td>
                          <td className={styles.tableCellRight}>{fmtPct(row.share_of_supplement_buyers)}</td>
                          <td className={styles.tableCellRight}>{fmtPct(row.share_of_matured_consultation_customers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>해석</strong>: 이 표는 `상담 후 영양제를 산 사람들`이 어느 시점에 첫 구매를 했는지를 보여준다.
                  `영양제 구매 고객 내 비중`은 구매자 분포를 뜻하고, `성숙 상담 고객 전체 대비 비중`은 전체 상담 고객 중 어느 정도가 그 시점에 첫 구매로 이어졌는지를 뜻한다.
                </div>
              </div>
            )}

            {supplementRepeatCohort && supplementRepeatSummary && supplementRepeatRows.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>영양제 시작 고객의 1년 재구매 패턴</h2>
                <p className={styles.sectionDesc}>
                  여기서는 <strong>상담 후 영양제를 처음 구매한 고객</strong>만 따로 본다.
                  그리고 그 첫 영양제 구매일 이후 <strong>1년을 끝까지 관찰할 수 있는 고객</strong>만 남겨,
                  1년 안에 총 몇 번 샀는지와 몇 번 다시 샀는지를 계산했다.
                </p>

                <div className={styles.comparisonGrid}>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>영양제 시작 고객</span>
                    <span className={styles.comparisonValue}>{fmtNum(supplementRepeatCohort.supplement_starter_customers)}명</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>1년 관찰 가능 고객</span>
                    <span className={styles.comparisonValue}>{fmtNum(supplementRepeatCohort.matured_supplement_starter_customers)}명</span>
                    <span className={styles.heroNote}>
                      최근 시작이라 제외된 고객 {fmtNum(supplementRepeatCohort.excluded_recent_starters)}명
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>1년 평균 총 구매 횟수</span>
                    <span className={styles.comparisonValue}>{supplementRepeatSummary.avg_total_orders_within_1y.toFixed(2)}회</span>
                    <span className={styles.heroNote}>첫 구매 1회를 포함한 횟수</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>1년 평균 추가 재구매 횟수</span>
                    <span className={styles.comparisonValue}>{supplementRepeatSummary.avg_repeat_orders_within_1y.toFixed(2)}회</span>
                    <span className={styles.heroNote}>첫 구매 이후 다시 산 횟수만 계산</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>2회 이상 구매 비율</span>
                    <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                      {fmtPct(supplementRepeatSummary.repeat_purchase_rate_2plus)}
                    </span>
                    <span className={styles.heroNote}>최소 1번은 다시 산 고객 비율</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>3회 이상 구매 비율</span>
                    <span className={styles.comparisonValue}>{fmtPct(supplementRepeatSummary.repeat_purchase_rate_3plus)}</span>
                    <span className={styles.heroNote}>최소 2번은 다시 산 고객 비율</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>4회 이상 구매 비율</span>
                    <span className={styles.comparisonValue}>{fmtPct(supplementRepeatSummary.repeat_purchase_rate_4plus)}</span>
                    <span className={styles.heroNote}>최소 3번은 다시 산 고객 비율</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6회 이상 구매 비율</span>
                    <span className={styles.comparisonValue}>{fmtPct(supplementRepeatSummary.loyal_rate_6plus)}</span>
                    <span className={styles.heroNote}>강한 장기 재구매 고객 비율</span>
                  </div>
                </div>

                <div className={styles.trendChart}>
                  {supplementRepeatRows.map((row) => (
                    <div key={row.bucket_key} className={styles.trendRow}>
                      <div className={styles.trendRowHeader}>
                        <div>
                          <strong>{row.label}</strong>
                          <span className={styles.trendMeta}>
                            1년 관찰 가능 고객 안에서 {fmtPct(row.share_of_matured_starters)}
                          </span>
                        </div>
                        <strong>{fmtNum(row.customer_count)}명</strong>
                      </div>
                      <div className={styles.trendBarTrack}>
                        <div
                          className={styles.trendBarFill}
                          style={{ width: toBarWidth(row.share_of_matured_starters, maxSupplementRepeatShare) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>구간</th>
                        <th className={styles.tableCellRight}>고객 수</th>
                        <th className={styles.tableCellRight}>1년 관찰 가능 고객 내 비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplementRepeatRows.map((row) => (
                        <tr key={row.bucket_key} className={styles.tableRow}>
                          <td><strong>{row.label}</strong></td>
                          <td className={styles.tableCellRight}>{fmtNum(row.customer_count)}명</td>
                          <td className={styles.tableCellRight}>{fmtPct(row.share_of_matured_starters)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>해석</strong>: 이 섹션은 `영양제를 한 번 산 뒤 얼마나 다시 사는가`를 보는 것이다.
                  평균적으로는 첫 구매를 시작한 고객이 1년 동안 총 <strong>{supplementRepeatSummary.avg_total_orders_within_1y.toFixed(2)}회</strong> 구매하고,
                  첫 구매를 제외한 추가 재구매는 평균 <strong>{supplementRepeatSummary.avg_repeat_orders_within_1y.toFixed(2)}회</strong>다.
                  중간값은 총 <strong>{fmtNum(supplementRepeatSummary.p50_total_orders_within_1y)}회</strong>,
                  상위 25% 구간은 총 <strong>{fmtNum(supplementRepeatSummary.p75_total_orders_within_1y)}회</strong>,
                  상위 10% 구간은 총 <strong>{fmtNum(supplementRepeatSummary.p90_total_orders_within_1y)}회</strong>까지 간다.
                  또 `첫 구매만 하고 끝나는 고객`과 `3회 이상 재구매로 이어지는 고객`의 비중을 같이 보면,
                  단순 첫 전환보다 장기 복용 고객이 얼마나 만들어지는지 읽기 쉬워진다.
                </div>
              </div>
            )}

            {subscriptionAvailability && subscriptionSnapshot && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>정기구독 데이터 상태</h2>
                <p className={styles.sectionDesc}>
                  여기서는 <strong>현재 정확한 활성 구독자 수를 바로 셀 수 있는지</strong>와
                  <strong> 일반 구매 고객이 정기구독으로 얼마나 넘어가는지</strong>를 분리해서 본다.
                  핵심은 `지금 구독 중인 사람 수`와 `과거 주문 기준 전환율`이 같은 데이터가 아니라는 점이다.
                </p>

                <div className={styles.comparisonGrid}>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>현재 활성 구독자 정확한 데이터</span>
                    <span
                      className={`${styles.comparisonValue} ${
                        subscriptionAvailability.exact_active_subscriber_count_available
                          ? styles.heroPositive
                          : styles.heroNegative
                      }`}
                    >
                      {subscriptionAvailability.exact_active_subscriber_count_available ? "있음" : "없음"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscriptionAvailability.exact_active_subscriber_count_reason}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>정기구독 주문 이력 데이터</span>
                    <span
                      className={`${styles.comparisonValue} ${
                        subscriptionAvailability.subscription_order_history_available
                          ? styles.heroPositive
                          : styles.heroNegative
                      }`}
                    >
                      {subscriptionAvailability.subscription_order_history_available ? "있음" : "없음"}
                    </span>
                    <span className={styles.heroNote}>
                      유효 주문 {fmtNum(subscriptionSnapshot.valid_subscription_order_rows)}행 · 고객{" "}
                      {fmtNum(subscriptionSnapshot.distinct_subscription_order_customers)}명
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>최근 정기 주문 최신일</span>
                    <span className={styles.comparisonValue}>
                      {subscriptionSnapshot.latest_subscription_order_date ?? "-"}
                    </span>
                    <span className={styles.heroNote}>주문 이력은 최근까지 들어오고 있다</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>최근 월 정기 상품 구매 고객</span>
                    <span className={styles.comparisonValue}>
                      {fmtNum(subscriptionSnapshot.latest_month_subscription_customers)}명
                    </span>
                    <span className={styles.heroNote}>
                      {subscriptionSnapshot.latest_month_label ?? "-"} 기준, `정기` 상품을 실제로 산 고객
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6개월 정기구독 전환율</span>
                    <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                      {subscription6m ? fmtPctPoint(subscription6m.conversion_percentage) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscription6m
                        ? `일반 영양제 고객 ${fmtNum(subscription6m.non_sub_customers)}명 중 ${fmtNum(subscription6m.converted_customers)}명이 이후 정기구독으로 전환`
                        : "전환율 집계 없음"}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>1년 정기구독 전환율</span>
                    <span className={styles.comparisonValue}>
                      {subscription1y ? fmtPctPoint(subscription1y.conversion_percentage) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscription1y
                        ? `일반 영양제 고객 ${fmtNum(subscription1y.non_sub_customers)}명 중 ${fmtNum(subscription1y.converted_customers)}명이 전환`
                        : "전환율 집계 없음"}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6개월 영양제 매출 중 정기 비중</span>
                    <span className={styles.comparisonValue}>
                      {supplementSubscription6m ? fmtPctPoint(supplementSubscription6m.subscription_ratio_percentage) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {supplementSubscription6m
                        ? `영양제 매출 ${fmtKRWFull(supplementSubscription6m.total_supplement_sales)}원 중 정기구독 ${fmtKRWFull(supplementSubscription6m.subscription_supplement_sales)}원`
                        : "영양제 구독 비중 집계 없음"}
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>기간</th>
                        <th className={styles.tableCellRight}>정기구독 전환율</th>
                        <th className={styles.tableCellRight}>일반 구매 고객 수</th>
                        <th className={styles.tableCellRight}>정기구독 전환 고객 수</th>
                        <th className={styles.tableCellRight}>영양제 매출 중 정기 비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionConversionRows.map((row) => {
                        const ratioRow = subscriptionRatioRows.find((ratio) => ratio.period_label === row.period_label);
                        return (
                          <tr key={row.period_label} className={styles.tableRow}>
                            <td><strong>{row.period_label}</strong></td>
                            <td className={styles.tableCellRight}>{fmtPctPoint(row.conversion_percentage)}</td>
                            <td className={styles.tableCellRight}>{fmtNum(row.non_sub_customers)}명</td>
                            <td className={styles.tableCellRight}>{fmtNum(row.converted_customers)}명</td>
                            <td className={styles.tableCellRight}>
                              {ratioRow ? fmtPctPoint(ratioRow.subscription_ratio_percentage) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>어떻게 읽어야 하나</strong>: 지금 DB에는 `정기 상품을 실제로 산 주문 이력`과
                  `일반 구매 후 정기구독으로 넘어간 비율`은 있다. 반면 `이 사람이 오늘도 활성 구독자인가`를
                  바로 알려주는 시작일·해지일·다음 결제 예정일 테이블은 아직 확인되지 않았다.
                  그래서 현재는 <strong>활성 구독자 수를 정확히 세는 단계는 아니고</strong>,
                  대신 <strong>정기구독으로 넘어가는 흐름과 정기 매출 비중은 충분히 추적 가능</strong>하다고 보는 게 맞다.
                  <br />
                  쉽게 말하면, 지금 데이터는 `회원권이 살아 있는 사람 명단`은 없지만,
                  `회원권을 산 사람들의 결제 기록`과 `일반권에서 회원권으로 얼마나 넘어갔는지`는 있는 상태다.
                  {subscriptionSchemaEvidence && subscriptionSchemaEvidence.subscription_related_base_tables.length > 0 && (
                    <>
                      <br />
                      현재 확인된 구독 관련 원천 테이블:{" "}
                      <strong>{subscriptionSchemaEvidence.subscription_related_base_tables.join(", ")}</strong>
                    </>
                  )}
                </div>
              </div>
            )}

            {subscriptionConsultRows.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>상담군 vs 미상담군 정기구독 전환율</h2>
                <p className={styles.sectionDesc}>
                  여기서는 <strong>일반 영양제를 먼저 산 고객</strong>을 기준으로 본다.
                  그 고객이 일반 영양제 첫 구매를 하기 전에 <strong>완료 상담이 있었으면 상담군</strong>,
                  없으면 <strong>미상담군</strong>으로 나눈 뒤,
                  이후 정기 상품으로 넘어갔는지를 비교한다.
                </p>

                <div className={styles.comparisonGrid}>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6개월 상담군 전환율</span>
                    <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                      {subscriptionConsult6m ? fmtPctPoint(subscriptionConsult6m.consulted_conversion_percentage) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscriptionConsult6m
                        ? `일반 구매 고객 ${fmtNum(subscriptionConsult6m.consulted_non_sub_customers)}명 중 ${fmtNum(subscriptionConsult6m.consulted_converted_customers)}명이 정기로 전환`
                        : "집계 없음"}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6개월 미상담군 전환율</span>
                    <span className={styles.comparisonValue}>
                      {subscriptionConsult6m ? fmtPctPoint(subscriptionConsult6m.non_consulted_conversion_percentage) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscriptionConsult6m
                        ? `일반 구매 고객 ${fmtNum(subscriptionConsult6m.non_consulted_non_sub_customers)}명 중 ${fmtNum(subscriptionConsult6m.non_consulted_converted_customers)}명이 정기로 전환`
                        : "집계 없음"}
                    </span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>6개월 전환율 차이</span>
                    <span
                      className={`${styles.comparisonValue} ${
                        (subscriptionConsult6m?.conversion_rate_diff_percentage_points ?? 0) >= 0
                          ? styles.heroPositive
                          : styles.heroNegative
                      }`}
                    >
                      {subscriptionConsult6m
                        ? `${subscriptionConsult6m.conversion_rate_diff_percentage_points >= 0 ? "+" : ""}${subscriptionConsult6m.conversion_rate_diff_percentage_points.toFixed(1)}%p`
                        : "-"}
                    </span>
                    <span className={styles.heroNote}>상담군 전환율 - 미상담군 전환율</span>
                  </div>
                  <div className={styles.comparisonCard}>
                    <span className={styles.comparisonLabel}>1년 전환율 차이</span>
                    <span
                      className={`${styles.comparisonValue} ${
                        (subscriptionConsult1y?.conversion_rate_diff_percentage_points ?? 0) >= 0
                          ? styles.heroPositive
                          : styles.heroNegative
                      }`}
                    >
                      {subscriptionConsult1y
                        ? `${subscriptionConsult1y.conversion_rate_diff_percentage_points >= 0 ? "+" : ""}${subscriptionConsult1y.conversion_rate_diff_percentage_points.toFixed(1)}%p`
                        : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      {subscriptionConsult1y
                        ? `상담군 ${fmtPctPoint(subscriptionConsult1y.consulted_conversion_percentage)} vs 미상담군 ${fmtPctPoint(subscriptionConsult1y.non_consulted_conversion_percentage)}`
                        : "집계 없음"}
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto", marginTop: 20 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.tableHead}>
                        <th>기간</th>
                        <th className={styles.tableCellRight}>상담군 일반 구매 고객</th>
                        <th className={styles.tableCellRight}>상담군 전환율</th>
                        <th className={styles.tableCellRight}>미상담군 일반 구매 고객</th>
                        <th className={styles.tableCellRight}>미상담군 전환율</th>
                        <th className={styles.tableCellRight}>차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionConsultRows.map((row) => (
                        <tr key={row.period_label} className={styles.tableRow}>
                          <td><strong>{row.period_label}</strong></td>
                          <td className={styles.tableCellRight}>
                            {fmtNum(row.consulted_non_sub_customers)}명
                          </td>
                          <td className={styles.tableCellRight}>
                            {fmtPctPoint(row.consulted_conversion_percentage)}
                          </td>
                          <td className={styles.tableCellRight}>
                            {fmtNum(row.non_consulted_non_sub_customers)}명
                          </td>
                          <td className={styles.tableCellRight}>
                            {fmtPctPoint(row.non_consulted_conversion_percentage)}
                          </td>
                          <td className={styles.tableCellRight}>
                            {row.conversion_rate_diff_percentage_points >= 0 ? "+" : ""}
                            {row.conversion_rate_diff_percentage_points.toFixed(1)}%p
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>해석</strong>: 이 비교는 `상담을 받은 사람이 정기구독으로 더 잘 넘어가는가`를
                  보는 것이다. 기준은 `일반 영양제 첫 구매 시점`이다.
                  즉 그 시점보다 전에 상담이 끝났으면 상담군, 아니면 미상담군으로 본다.
                  <br />
                  따라서 이 숫자는 `전체 상담 고객 대비 정기구독 전환율`이 아니라,
                  <strong>`일반 영양제를 한번 산 사람들 중` 누가 더 정기구독으로 넘어가는가</strong>를 보는 숫자다.
                  전화번호 매칭이 안 되거나 가족 주문처럼 주문자와 상담자가 다르면 일부는 미상담군 쪽으로 남을 수 있다.
                </div>
              </div>
            )}

            {/* ═══ 7. 평일 vs 주말 상담 가치 ═══ */}
            {(weekdayCompletion || weekendCompletion || weekdayValue || weekendValue) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>평일 vs 주말 상담 가치</h2>
                <p className={styles.sectionDesc}>
                  위의 완료 전환율은 <strong>예약된 상담 전체</strong>를 기준으로 본 숫자다. 아래의 가치
                  비교는 <strong>상담을 끝낸 뒤 30일 안에 실제 구매가 얼마나 일어났는지</strong>를 기준으로
                  본 숫자다. 주말 상담은 시작한 지 오래되지 않아 <strong>90일치 구매 결과</strong>가 아직
                  충분히 쌓이지 않았기 때문에, 지금은 먼저 30일 기준으로 비교한다.
                  여기서 가장 중요한 것은 <strong>분모가 다르다</strong>는 점이다.
                  하나는 `주말에 상담을 끝낸 고객 1명 기준`, 다른 하나는 `주말 상담 슬롯 1건 기준`이다.
                </p>
                <div className={styles.dayTypeGrid}>
                  <div className={styles.dayTypeCard}>
                    <span className={styles.comparisonLabel}>평일 완료 전환율</span>
                    <span className={styles.comparisonValue}>
                      {weekdayCompletion ? fmtPct(weekdayCompletion.completion_rate) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      완료 {fmtNum(weekdayCompletion?.completed_consults ?? 0)}건 / 전체 {fmtNum(weekdayCompletion?.total_consults ?? 0)}건
                    </span>
                  </div>
                  <div className={styles.dayTypeCard}>
                    <span className={styles.comparisonLabel}>주말 완료 전환율</span>
                    <span className={styles.comparisonValue}>
                      {weekendCompletion ? fmtPct(weekendCompletion.completion_rate) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      완료 {fmtNum(weekendCompletion?.completed_consults ?? 0)}건 / 전체 {fmtNum(weekendCompletion?.total_consults ?? 0)}건
                    </span>
                  </div>
                  <div className={styles.dayTypeCard}>
                    <span className={styles.comparisonLabel}>주말 30일 구매 전환율</span>
                    <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                      {weekendValue ? fmtPct(weekendValue.conversion_rate) : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      평일 {weekdayValue ? fmtPct(weekdayValue.conversion_rate) : "-"} 대비{" "}
                      {dayTypeMeta ? `${(dayTypeMeta.weekend_conversion_rate_diff * 100).toFixed(1)}%p` : "-"}
                    </span>
                  </div>
                  <div className={styles.dayTypeCard}>
                    <span className={styles.comparisonLabel}>주말 고객 1명 기준 30일 매출</span>
                    <span className={`${styles.comparisonValue} ${styles.heroPositive}`}>
                      {weekendValue ? `${fmtKRWFull(weekendValue.avg_revenue_per_customer)}원` : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      주말에 상담을 끝낸 고객 한 명이 30일 안에 실제로 쓴 평균 금액.{" "}
                      {dayTypeMeta
                        ? fmtVsWeekdayMoney(
                            dayTypeMeta.weekend_avg_revenue_per_customer_diff,
                            dayTypeMeta.weekend_avg_revenue_per_customer_multiple,
                          )
                        : "-"}
                    </span>
                  </div>
                </div>

                <div className={styles.dayTypeSummary}>
                  <div className={styles.dayTypeSummaryCard}>
                    <span className={styles.comparisonLabel}>평일 상담 슬롯 1건 기준 30일 매출</span>
                    <span className={styles.comparisonValue}>
                      {weekdayValue ? `${fmtKRWFull(weekdayValue.value_per_completed_consultation)}원` : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      평일 상담 한 건을 잡았을 때, 30일 안에 돌아온 평균 매출
                    </span>
                  </div>
                  <div className={styles.dayTypeSummaryCard}>
                    <span className={styles.comparisonLabel}>주말 상담 슬롯 1건 기준 30일 매출</span>
                    <span
                      className={`${styles.comparisonValue} ${
                        (dayTypeMeta?.weekend_value_per_completed_consultation_diff ?? 0) >= 0
                          ? styles.heroPositive
                          : styles.heroNegative
                      }`}
                    >
                      {weekendValue ? `${fmtKRWFull(weekendValue.value_per_completed_consultation)}원` : "-"}
                    </span>
                    <span className={styles.heroNote}>
                      주말 상담 한 건을 잡았을 때, 30일 안에 돌아온 평균 매출.{" "}
                      {dayTypeMeta
                        ? fmtVsWeekdayMoney(
                            dayTypeMeta.weekend_value_per_completed_consultation_diff,
                            dayTypeMeta.weekend_value_per_completed_consultation_multiple,
                          )
                        : "-"}
                    </span>
                  </div>
                </div>

                <div className={styles.interpretBlock}>
                  <strong>어떻게 읽어야 하나</strong>: 두 숫자는 둘 다 `30일 매출`이지만 기준이 다르다.
                  <br />
                  1. <strong>주말 고객 1명 기준 30일 매출</strong>은 `주말 고객 한 사람당 객단가`에 가깝다.
                  카페로 비유하면, <em>주말에 들어온 손님 한 명이 평일 손님 한 명보다 더 비싼 메뉴를 사는가</em>를 보는 숫자다.
                  그래서 이 숫자가 평일보다 높다는 것은 <em>주말 고객 자체는 더 잘 사는 편</em>이라는 뜻이다.
                  <br />
                  2. <strong>주말 상담 슬롯 1건 기준 30일 매출</strong>은 `주말 상담 시간 1칸당 매출`에 가깝다.
                  같은 카페 비유로 보면, <em>테이블 한 개를 한 시간 돌렸을 때 결국 얼마를 버는가</em>를 보는 숫자다.
                  그래서 이 숫자가 평일보다 낮다는 것은 <em>좋은 손님이 와도 빈 슬롯, 완료율, 운영 흐름까지 합치면 주말 한 칸이 벌어오는 돈은 아직 평일보다 적다</em>는 뜻이다.
                  <br />
                  쉽게 말하면, <strong>`손님 한 명의 질`과 `자리 한 칸의 효율`은 다른 숫자</strong>다.
                  지금 데이터는 `주말 손님은 더 잘 사는 편`이지만, `주말 자리 한 칸이 더 돈을 잘 버는지는 아직 아니다` 쪽에 가깝다.
                  주말 성숙 표본은 <strong>{fmtNum(weekendValue?.matured_customers ?? 0)}명</strong>으로 작아 방향 참고용이며, 90일 주말 구매전환 비교는{" "}
                  <strong>{dayTypeMeta?.weekend_90d_tracking_available_from ?? "추후"}</strong> 이후에야 의미 있게 본다.
                </div>
              </div>
            )}

            {/* ═══ 8. LTR 비교 (6개월 / 1년) ═══ */}
            {(ltr6m?.data?.summary || ltr1y?.data?.summary) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>장기 매출 비교 (6개월 / 1년)</h2>
                <p className={styles.sectionDesc}>
                  상담 완료 후 6개월·1년 동안의 고객당 매출 비교.
                  관찰 기간이 길수록 성숙 고객 수는 줄어들지만 장기 효과를 볼 수 있다.
                  기본 시작일을 <strong>2024-04-01</strong>로 넓혀 두어, 1년 비교에서도 성숙 고객이 0명이 아닌 상태에서 보이도록 조정했다.
                </p>
                <div className={styles.comparisonGrid}>
                  {ltr6m?.data?.summary && (() => {
                    const d = ltr6m.data.summary;
                    return (
                      <>
                        <div className={styles.comparisonCard}>
                          <span className={styles.comparisonLabel}>6개월 상담 고객 평균 매출</span>
                          <span className={styles.comparisonValue}>{fmtKRWFull(d.avg_revenue_per_customer)}원</span>
                          <span className={styles.heroNote}>성숙 고객 {fmtNum(d.matured_customers)}명 · 전환율 {fmtPct(d.conversion_rate)}</span>
                        </div>
                        <div className={styles.comparisonCard}>
                          <span className={styles.comparisonLabel}>6개월 미상담 고객 평균 매출</span>
                          <span className={styles.comparisonValue}>{fmtKRWFull(d.baseline_avg_revenue_per_customer)}원</span>
                          <span className={styles.heroNote}>
                            상담 효과 추정: <strong className={d.estimated_incremental_value_per_customer >= 0 ? styles.heroPositive : styles.heroNegative}>{fmtKRWFull(d.estimated_incremental_value_per_customer)}원/고객</strong>
                            {" · "}배수 {fmtMultiple(d.avg_revenue_per_customer / Math.max(d.baseline_avg_revenue_per_customer, 1))}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                  {ltr1y?.data?.summary && (() => {
                    const d = ltr1y.data.summary;
                    return (
                      <>
                        <div className={styles.comparisonCard}>
                          <span className={styles.comparisonLabel}>1년 상담 고객 평균 매출</span>
                          <span className={styles.comparisonValue}>{fmtKRWFull(d.avg_revenue_per_customer)}원</span>
                          <span className={styles.heroNote}>성숙 고객 {fmtNum(d.matured_customers)}명 · 전환율 {fmtPct(d.conversion_rate)}</span>
                        </div>
                        <div className={styles.comparisonCard}>
                          <span className={styles.comparisonLabel}>1년 미상담 고객 평균 매출</span>
                          <span className={styles.comparisonValue}>{fmtKRWFull(d.baseline_avg_revenue_per_customer)}원</span>
                          <span className={styles.heroNote}>
                            상담 효과 추정: <strong className={d.estimated_incremental_value_per_customer >= 0 ? styles.heroPositive : styles.heroNegative}>{fmtKRWFull(d.estimated_incremental_value_per_customer)}원/고객</strong>
                            {" · "}배수 {fmtMultiple(d.avg_revenue_per_customer / Math.max(d.baseline_avg_revenue_per_customer, 1))}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className={styles.interpretBlock}>
                  <strong>왜 성숙 고객이 0명으로 보일 수 있나</strong>: 성숙 고객은 `조회 기간에 포함된 상담 고객` 중에서,
                  기준일 기준으로 관찰 기간만큼 충분히 지난 사람만 센다. 즉 `기준일 - 관찰기간`보다 더 이전에 상담을 끝낸 고객만 성숙 고객으로 들어온다.
                  <br />
                  현재 기본값으로 보면 6개월 컷오프는 <strong>{ltr6mCutoffDate ?? "-"}</strong> 이라서
                  그 날짜보다 먼저 상담을 끝낸 고객은 들어올 수 있고, 그래서 6개월 성숙 고객은{" "}
                  <strong>{fmtNum(ltr6m?.data?.summary.matured_customers ?? 0)}명</strong>이 나온다.
                  반면 1년 컷오프는 <strong>{ltr1yCutoffDate ?? "-"}</strong> 다.
                  예전처럼 조회 시작일이 너무 최근이면 이 컷오프보다 앞선 고객이 범위에 없어 `0명`으로 보일 수 있다.
                  지금 화면은 기본 시작일을 <strong>2024-04-01</strong>로 넓혀 두었기 때문에,
                  1년 성숙 고객도 <strong>{fmtNum(ltr1y?.data?.summary.matured_customers ?? 0)}명</strong>이 남아 있다.
                  <br />
                  쉽게 말하면, <strong>1년치를 보려면 최소 1년 전 상담 고객이 조회 범위 안에 있어야 한다</strong>.
                  조회 시작일이 너무 최근이면 1년 비교는 다시 `0명`이 될 수 있다.
                  <br />
                  그래서 6개월/1년 LTR(구매자 기준 총매출)만 단독으로 보기보다, `성숙 고객 수`, `구매 전환율`, `고객당 매출`을 같이 읽어야 해석 오류가 줄어든다.
                </div>
              </div>
            )}

            {/* ═══ 9. Wait-Loss Placeholder ═══ */}
            <div className={styles.waitLossPlaceholder}>
              <div className={styles.waitLossIcon}>&#9888;</div>
              <h3 className={styles.waitLossTitle}>상담 대기 손실 리드 분석 — 데이터 준비 중</h3>
              <p className={styles.waitLossDesc}>
                &quot;상담 대기 때문에 월 몇 건의 리드를 놓치고 있는가?&quot;에 답하려면
                현재 DB에 없는 이벤트 시각 로그가 필요하다.
              </p>
              <div className={styles.waitLossFields}>
                <strong>추가 필요한 로그 필드:</strong>
                <ul>
                  <li><code>lead_created_at</code> — 고객이 시스템에 처음 들어온 시각</li>
                  <li><code>slot_assigned_at</code> — 상담 예정 슬롯 배정 시각</li>
                  <li><code>connected_at</code> — 실제 상담 연결 완료 시각</li>
                  <li><code>lost_reason</code> — 손실 사유 분류 (연락불가/장기대기/고객취소 등)</li>
                  <li><code>reschedule_count</code> — 재예약 횟수</li>
                </ul>
              </div>
              <p className={styles.waitLossDesc}>
                이 로그가 최소 2~4주 쌓인 뒤, 대기 기간별 완료율/구매전환율로 월 손실 리드 수를 추정할 수 있다.
              </p>
            </div>

            {/* ═══ 10. CSO 메모 ═══ */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>CSO 관점 메모</h2>
              <p className={styles.sectionDesc}>
                지금 데이터만으로도 운영 판단은 꽤 할 수 있다. 다만 여기서 더 강한 의사결정을 하려면
                무엇을 이미 확신할 수 있는지와, 무엇을 추가로 봐야 하는지를 분리해서 읽어야 한다.
              </p>

              <div className={styles.csoGrid}>
                <div className={styles.csoCard}>
                  <h3 className={styles.csoTitle}>지금 확신할 수 있는 것</h3>
                  <ul className={styles.csoList}>
                    <li>
                      상담은 `구매 전환 진입`을 강하게 만든다. 지금 화면 전체를 보면 상담 효과는
                      단순히 객단가를 조금 올리는 수준이 아니라, 구매하는 고객 수 자체를 늘리는 쪽에 더 가깝다.
                    </li>
                    <li>
                      영양제 구매는 상담 직후에 가장 많이 일어난다. 현재 표본에서는 영양제 구매 고객의{" "}
                      <strong>{supplementSameDay ? fmtPct(supplementSameDay.share_of_supplement_buyers) : "-"}</strong>가
                      상담 당일, <strong>{supplementWithin3Days && supplementSameDay ? fmtPct(supplementSameDay.share_of_supplement_buyers + supplementWithin3Days.share_of_supplement_buyers) : "-"}</strong>가
                      3일 안에 첫 구매를 한다.
                    </li>
                    <li>
                      따라서 상담사 스크립트, 결제 CTA, 후속 메시지는 `당일~3일` 구간이 가장 중요하다.
                      반대로 `31일 이후`까지 늦게 사는 고객도{" "}
                      <strong>{supplementAfter31Days ? fmtPct(supplementAfter31Days.share_of_supplement_buyers) : "-"}</strong>는
                      남아 있으므로, 장기 후속 터치도 완전히 버리면 안 된다.
                    </li>
                    <li>
                      신규 상담사 랜딩은 `첫 달 즉시 완성`이 아니라 `9~10주차에 본격 안착` 패턴에 더 가깝다.
                      그래서 채용 전환 판단은 5주차 한 번으로 끝내기보다 10주차까지 보는 것이 맞다.
                    </li>
                    <li>
                      주말 상담은 현재 고객 기준 30일 구매 전환율이 평일보다{" "}
                      <strong>{weekendConversionDiffPct}%p</strong> 높지만, 상담 1건당 30일 매출은{" "}
                      <strong>{weekendValueDiffText ?? "-"}</strong>이다. 즉 `좋은 고객이 주말에 오지만, 슬롯 효율까지 더 좋다`고 바로 말하기는 이르다.
                    </li>
                  </ul>
                </div>

                <div className={styles.csoCard}>
                  <h3 className={styles.csoTitle}>지금 바로 실행할 액션</h3>
                  <ul className={styles.csoList}>
                    <li>
                      `상담 당일`과 `3일 안`에 집중하는 영양제 전환 플로우를 따로 설계한다.
                      현재는 이 구간에 영양제 구매자의 약 <strong>{supplementWithin3Days && supplementSameDay ? fmtPct(supplementSameDay.share_of_supplement_buyers + supplementWithin3Days.share_of_supplement_buyers) : "-"}</strong>가 몰려 있다.
                    </li>
                    <li>
                      수습 평가는 `5주차 최소`, `10주차 전환 여부`의 2단계로 운영한다.
                      특히 10주차 기준 미달은 채용 전환을 다시 생각해야 한다.
                    </li>
                    <li>
                      주말 상담은 무조건 늘리기보다, `주말 예약 고객의 특성`과 `실제 슬롯 효율`을 먼저 분리해서 봐야 한다.
                      현재 데이터만 보면 주말은 고객 질은 좋아 보이지만, 상담 1건당 수익성은 평일보다 낮다.
                    </li>
                    <li>
                      `31일 이후` 늦게 사는 고객군은 따로 태깅해서 후속 메시지, 재접촉, 복약 제안이 먹히는지 실험한다.
                      지금은 이 집단이 작지 않다.
                    </li>
                  </ul>
                </div>

                <div className={styles.csoCard}>
                  <h3 className={styles.csoTitle}>CSO라면 다음에 더 보고 싶은 것</h3>
                  <ul className={styles.csoList}>
                    <li>
                      `대기 때문에 잃는 리드`가 제일 크다. 지금은 이게 가장 비싼 블라인드 스팟이다.
                      `lead_created_at`, `slot_assigned_at`, `connected_at`이 쌓이면 대기 손실을 월 건수와 매출로 바꿔 말할 수 있다.
                    </li>
                    <li>
                      `상담 후 0~3일 미구매 이탈군`이 누구인지 더 보고 싶다.
                      분석유형, 상담사, 주말/평일, 첫 상담 시간대별로 보면 바로 개선 액션이 나온다.
                    </li>
                    <li>
                      `선택편향`을 더 줄인 비교군이 필요하다.
                      동일 분석유형, 동일 월, 동일 시간대, 가능하면 배정됐지만 미완료된 고객까지 붙여야 상담 효과를 더 정확히 읽을 수 있다.
                    </li>
                    <li>
                      `상담사별 리드 품질 차이`와 `상담사별 슬롯 생산성`을 분리해서 보고 싶다.
                      지금은 사람 실력과 배정 리드 질이 섞여 있을 가능성이 있다.
                    </li>
                    <li>
                      영양제 첫 구매가 빠른 고객이 `장기 LTR도 높은지`, 아니면 단순히 구매 시점만 빠른지 보고 싶다.
                      이게 확인되면 즉시 전환 중심 전략과 장기 육성 전략의 우선순위를 더 명확히 나눌 수 있다.
                    </li>
                  </ul>
                </div>

                <div className={styles.csoCard}>
                  <h3 className={styles.csoTitle}>추천 CRM 전략</h3>
                  <ul className={styles.csoList}>
                    <li>
                      <strong>상담 당일</strong>: 가장 중요한 구간이다. 상담 종료 직후 제품 요약, 복용 이유, 추천 상품 링크를 바로 보내고,
                      장바구니나 결제 페이지까지 한 번에 이동하게 만든다. 이 구간은 먼저 `설명력`과 `편의성`으로 밀고, 무조건 할인부터 주지는 않는 편이 낫다.
                    </li>
                    <li>
                      <strong>D+1 ~ D+3</strong>: 아직 안 산 고객에게는 1차 리마인드가 필요하다. 상담사가 말한 핵심 문제, 추천 이유, 후기 1개, FAQ 1개를 묶어서 보내고,
                      실험군에만 `소액 할인쿠폰` 또는 `무료배송`을 붙여본다. 지금 데이터상 영양제 구매의 대부분이 이 구간 안에서 결정된다.
                    </li>
                    <li>
                      <strong>D+4 ~ D+7</strong>: `타임세일`, `오늘까지`, `이번 주말까지` 같은 약한 마감 장치를 넣을 수 있다.
                      다만 전 고객 동일 쿠폰보다 `상담사 추천 번들`, `검사 결과 기반 추천 세트`처럼 이유가 있는 제안이 더 낫다.
                    </li>
                    <li>
                      <strong>D+8 ~ D+14</strong>: 이 시점부터는 단순 할인보다 `왜 지금 이 영양제가 필요한지`를 다시 설명하는 콘텐츠형 CRM이 더 중요하다.
                      검사 유형별, 상담사별로 많이 막히는 이유를 붙여서 교육형 메시지로 전환하는 것이 좋다.
                    </li>
                    <li>
                      <strong>D+15 ~ D+30</strong>: 여기서는 첫 구매 구조를 살리는 `구조적 제안`이 필요하다. 예를 들면 `첫 구매 전용 쿠폰`, `2주 체험 패키지`, `정기구독 첫 달 혜택` 같은 식이다.
                      이 구간은 타임세일보다 `첫 구매 장벽 제거`가 핵심이다.
                    </li>
                    <li>
                      <strong>31일 이후</strong>: 즉시 전환군과는 다른 집단으로 보고 `윈백 CRM`으로 분리하는 게 맞다.
                      광범위 할인보다 재상담 제안, 복약 질문 리마인드, 결과지 재해석, 후기 기반 재설득이 더 맞을 가능성이 높다.
                    </li>
                    <li>
                      <strong>주말 상담 고객</strong>: 고객 질은 좋아 보이므로, 월요일 오전 첫 메시지와 월요일 저녁 리마인드를 따로 실험해볼 만하다.
                      다만 슬롯 효율은 아직 낮으므로, 주말 상담 수를 무작정 늘리기 전에 `후속 CRM 최적화`가 먼저다.
                    </li>
                  </ul>
                </div>

                <div className={styles.csoCard}>
                  <h3 className={styles.csoTitle}>단발 분석에서 그로스 AI Agent로</h3>
                  <ul className={styles.csoList}>
                    <li>
                      지금 화면은 이미 `좋은 분석 대시보드` 역할은 한다. 다음 단계는 사람이 질문할 때만 답하는 구조를 넘어서,
                      매일 `이상징후`, `가장 큰 기회`, `당장 실행할 액션`을 먼저 뽑아주는 운영 레이어를 만드는 것이다.
                    </li>
                    <li>
                      그 구조가 되려면 최소 4개가 더 붙어야 한다. `상담 대기 로그`, `쿠폰 코드와 목적 태그`,
                      `활성 정기구독 상태`, `실험 로그`다. 그래야 상담 효과, 쿠폰 효과, 운영 병목을 분리해서 볼 수 있다.
                    </li>
                    <li>
                      운영 형태는 `하나의 메인 Agent + 여러 전문 Agent`가 가장 자연스럽다.
                      추천 메인 이름은 <strong>프로메테우스</strong>다.
                      미리 내다보는 자라는 뜻이 있고, 인사이트를 실제 성장 동력으로 바꾼다는 상징이 강하다.
                    </li>
                    <li>
                      서브 이름은 이렇게 두면 좋다.
                      `아테나`는 전략과 우선순위, `아폴론`은 예측과 시그널, `플루토스`는 매출과 풍요, `헤르메스`는 CRM과 쿠폰 실행을 맡는 구조다.
                    </li>
                    <li>
                      한 줄로 말하면, 다음 목표는 `callprice를 잘 만든 페이지`로 끝내는 게 아니라
                      <strong>`PROMETHEUS`라는 지속형 그로스 AI Agent의 첫 번째 두뇌 조각으로 승격</strong>하는 것이다.
                    </li>
                  </ul>
                </div>
              </div>

              <div className={styles.interpretBlock}>
                <strong>한 줄 판단</strong>: 현재 자료만으로도 `상담은 가치가 있다`, `영양제 전환의 골든타임은 상담 당일~3일`, `신규 상담사 랜딩 평가는 10주차까지 봐야 한다`는 세 가지는 이미 말할 수 있다.
                추가로 가장 파급력 큰 다음 질문은 `상담 대기 때문에 월 몇 건의 리드를 잃고 있는가`, `상담 후 0~3일 미구매 이탈군이 누구인가`, `쿠폰이 실제 전환을 만들었는가`다.
                이 세 축이 붙으면 여기서부터는 분석 대시보드가 아니라 `PROMETHEUS` 같은 지속형 그로스 AI Agent로 넘어갈 수 있다.
              </div>
            </div>

            {/* ═══ 11. 상품 믹스 분석 (P2-S5) ═══ */}
            {productMix && productMix.length > 0 && (() => {
              // 상품 카테고리별 집계
              const catMap = new Map<string, { revenue: number; orders: number; customers: number }>();
              for (const row of productMix) {
                const cat = row.productCategory;
                if (!catMap.has(cat)) catMap.set(cat, { revenue: 0, orders: 0, customers: 0 });
                const c = catMap.get(cat)!;
                c.revenue += row.totalRevenue;
                c.orders += row.orderCount;
                c.customers += row.customerCount;
              }
              const catLabels: Record<string, string> = { test_kit: "검사 키트", supplement: "영양제", other: "기타" };
              const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
              const pieData = [...catMap.entries()].map(([cat, d]) => ({
                name: catLabels[cat] ?? cat,
                value: d.revenue,
                orders: d.orders,
                customers: d.customers,
              })).sort((a, b) => b.value - a.value);
              const totalRevenue = pieData.reduce((s, d) => s + d.value, 0);

              // 상태별 × 상품별 교차표
              const statusLabels: Record<string, string> = { completed: "완료", no_answer: "부재", rescheduled: "변경", canceled: "취소", other: "기타", unknown: "미정" };
              const crossData = productMix.map((r) => ({
                ...r,
                statusLabel: statusLabels[r.statusGroup] ?? r.statusGroup,
                catLabel: catLabels[r.productCategory] ?? r.productCategory,
              }));

              // 매출 분포 (고객당 주문 가치 분포)
              const avgValues = productMix
                .filter((r) => r.customerCount > 0)
                .map((r) => ({ label: `${statusLabels[r.statusGroup] ?? r.statusGroup}-${catLabels[r.productCategory] ?? r.productCategory}`, avgOrderValue: r.avgOrderValue, customers: r.customerCount }))
                .sort((a, b) => b.avgOrderValue - a.avgOrderValue);

              return (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>상품 믹스 분석</h2>
                  <p className={styles.sectionDesc}>상담 상태별 × 상품 카테고리별 매출 구성과 주문 가치 분포를 시각화한다.</p>

                  {/* 파이 차트 + 요약 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(226,232,240,0.5)" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: 8 }}>상품 카테고리별 매출 비중</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(props) => `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [`₩${Number(v ?? 0).toLocaleString("ko-KR")}`, "매출"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14, padding: "20px 16px", border: "1px solid rgba(226,232,240,0.5)" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: 8 }}>카테고리별 요약</div>
                      <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                        <thead><tr className={styles.tableHead}><th>카테고리</th><th className={styles.tableCellRight}>고객</th><th className={styles.tableCellRight}>주문</th><th className={styles.tableCellRight}>매출</th><th className={styles.tableCellRight}>비중</th></tr></thead>
                        <tbody>
                          {pieData.map((d) => (
                            <tr key={d.name} className={styles.tableRow}>
                              <td>{d.name}</td>
                              <td className={styles.tableCellRight}>{d.customers.toLocaleString("ko-KR")}명</td>
                              <td className={styles.tableCellRight}>{d.orders.toLocaleString("ko-KR")}건</td>
                              <td className={styles.tableCellRight}>{fmtKRW(d.value)}</td>
                              <td className={styles.tableCellRight}>{totalRevenue > 0 ? ((d.value / totalRevenue) * 100).toFixed(1) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 주문 가치 분포 바 차트 */}
                  <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14, padding: "20px 16px", marginBottom: 16, border: "1px solid rgba(226,232,240,0.5)" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: 12 }}>상태별 × 상품별 평균 주문 가치</div>
                    <ResponsiveContainer width="100%" height={Math.max(200, avgValues.length * 32)}>
                      <BarChart data={avgValues} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₩${(Number(v) / 10000).toFixed(0)}만`} />
                        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => [`₩${Number(v ?? 0).toLocaleString("ko-KR")}`, "평균 주문 가치"]} contentStyle={{ fontSize: "0.78rem", borderRadius: 8 }} />
                        <Bar dataKey="avgOrderValue" fill="#6366f1" name="평균 주문 가치" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 상세 교차표 */}
                  <div style={{ overflowX: "auto" }}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHead}>
                          <th>상담 상태</th><th>상품 카테고리</th>
                          <th className={styles.tableCellRight}>고객 수</th>
                          <th className={styles.tableCellRight}>주문 수</th>
                          <th className={styles.tableCellRight}>매출</th>
                          <th className={styles.tableCellRight}>평균 주문가</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossData.map((r, i) => (
                          <tr key={i} className={styles.tableRow}>
                            <td>{r.statusLabel}</td>
                            <td>{r.catLabel}</td>
                            <td className={styles.tableCellRight}>{r.customerCount.toLocaleString("ko-KR")}</td>
                            <td className={styles.tableCellRight}>{r.orderCount.toLocaleString("ko-KR")}</td>
                            <td className={styles.tableCellRight}>{fmtKRW(r.totalRevenue)}</td>
                            <td className={styles.tableCellRight}>{fmtKRW(r.avgOrderValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ═══ 12. API 주석 ═══ */}
            {notes.length > 0 && (
              <div className={styles.notesList}>
                {notes.map((note, i) => (
                  <div key={i} className={styles.noteItem}>
                    <span style={{ marginRight: 6 }}>ℹ</span> {note}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
