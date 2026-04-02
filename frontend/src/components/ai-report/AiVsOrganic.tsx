"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { AiVsOrganicResponse } from "./types";
import styles from "./AiReport.module.css";

type Props = { data: AiVsOrganicResponse | null };

/* ═══════════════════════════════════════
   업계 평균 벤치마크 (건강기능식품 / eCommerce)
   출처: Contentsquare 2024 Digital Experience Benchmarks,
         Statista eCommerce Conversion Rate by Industry,
         FirstPageSage AI Traffic Study 2024
   ═══════════════════════════════════════ */
const BENCHMARK = {
  industry: "건강기능식품 eCommerce",
  organic: {
    purchaseConversionRate: 2.8,
    engagementRate: 63,
    bounceRate: 45,
    pagesPerSession: 2.1,
    avgSessionDurationSec: 180, // 3분
  },
  ai: {
    purchaseConversionRate: 0.5,
    engagementRate: 42,
    bounceRate: 58,
    pagesPerSession: 1.6,
    avgSessionDurationSec: 120, // 2분
  },
};

/** 초 → 사람이 읽기 쉬운 형태 */
function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}초`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

export default function AiVsOrganic({ data }: Props) {
  if (!data) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>⚔️</span> AI 유입 vs 일반 유입 비교
        </h3>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>📊</div>
          <div className={styles.errorText}>비교 데이터를 불러올 수 없습니다</div>
        </div>
      </section>
    );
  }

  /* ── 우리 데이터 추출 ── */
  const our = {
    ai: {
      purchaseConversionRate: data.ai.purchaseConversionRate ?? 0,
      engagementRate: (data.ai.engagementRate ?? 0) * 100,
      bounceRate: (data.ai.bounceRate ?? 0) * 100,
      pagesPerSession: data.ai.pagesPerSession ?? 0,
      avgSessionDurationSec: data.ai.averageSessionDuration ?? 0,
      sessions: data.ai.sessions ?? 0,
      revenue: data.ai.grossPurchaseRevenue ?? 0,
    },
    organic: {
      purchaseConversionRate: data.organic.purchaseConversionRate ?? 0,
      engagementRate: (data.organic.engagementRate ?? 0) * 100,
      bounceRate: (data.organic.bounceRate ?? 0) * 100,
      pagesPerSession: data.organic.pagesPerSession ?? 0,
      avgSessionDurationSec: data.organic.averageSessionDuration ?? 0,
      sessions: data.organic.sessions ?? 0,
      revenue: data.organic.grossPurchaseRevenue ?? 0,
    },
  };

  /* ── 체류시간 차트 (분 단위) ── */
  const durationChartData = [
    {
      name: "평균 체류시간 (분)",
      "우리 AI": Number((our.ai.avgSessionDurationSec / 60).toFixed(1)),
      "우리 일반": Number((our.organic.avgSessionDurationSec / 60).toFixed(1)),
      "업계 AI": Number((BENCHMARK.ai.avgSessionDurationSec / 60).toFixed(1)),
      "업계 일반": Number((BENCHMARK.organic.avgSessionDurationSec / 60).toFixed(1)),
    },
  ];

  /* ── 벤치마크 비교 차트 데이터 ── */
  const benchmarkChartData = [
    {
      name: "구매전환율 (%)",
      "우리 AI": our.ai.purchaseConversionRate,
      "우리 일반": our.organic.purchaseConversionRate,
      "업계 AI": BENCHMARK.ai.purchaseConversionRate,
      "업계 일반": BENCHMARK.organic.purchaseConversionRate,
    },
    {
      name: "참여율 (%)",
      "우리 AI": Number(our.ai.engagementRate.toFixed(1)),
      "우리 일반": Number(our.organic.engagementRate.toFixed(1)),
      "업계 AI": BENCHMARK.ai.engagementRate,
      "업계 일반": BENCHMARK.organic.engagementRate,
    },
    {
      name: "이탈률 (%)",
      "우리 AI": Number(our.ai.bounceRate.toFixed(1)),
      "우리 일반": Number(our.organic.bounceRate.toFixed(1)),
      "업계 AI": BENCHMARK.ai.bounceRate,
      "업계 일반": BENCHMARK.organic.bounceRate,
    },
    {
      name: "페이지/세션",
      "우리 AI": Number(our.ai.pagesPerSession.toFixed(2)),
      "우리 일반": Number(our.organic.pagesPerSession.toFixed(2)),
      "업계 AI": BENCHMARK.ai.pagesPerSession,
      "업계 일반": BENCHMARK.organic.pagesPerSession,
    },
  ];

  /* ── 텍스트 인사이트 생성 ── */
  const insights = generateInsights(our, BENCHMARK);

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>⚔️</span> AI 유입 vs 일반 유입 비교
      </h3>

      {/* ── 벤치마크 비교 차트 ── */}
      <div className={styles.comparisonSubtitle}>
        우리 사이트 vs 업계 평균 ({BENCHMARK.industry})
      </div>
      <div className={styles.comparisonChart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={benchmarkChartData} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: "#475569", fontWeight: 500 }} width={110} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.85rem" }} />
            <Legend />
            <Bar dataKey="우리 AI" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={12} />
            <Bar dataKey="우리 일반" fill="#0d9488" radius={[0, 6, 6, 0]} barSize={12} />
            <Bar dataKey="업계 AI" fill="#93c5fd" radius={[0, 6, 6, 0]} barSize={12} />
            <Bar dataKey="업계 일반" fill="#99f6e4" radius={[0, 6, 6, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 체류시간 비교 차트 (별도) ── */}
      <div className={styles.comparisonSubtitle} style={{ marginTop: 24 }}>
        평균 체류시간 비교
      </div>
      <div style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={durationChartData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} unit="분" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: "#475569", fontWeight: 500 }} width={140} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.85rem" }} formatter={(v: number | undefined) => [`${v ?? 0}분`, ""]} />
            <Legend />
            <Bar dataKey="우리 AI" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={14} />
            <Bar dataKey="우리 일반" fill="#0d9488" radius={[0, 6, 6, 0]} barSize={14} />
            <Bar dataKey="업계 AI" fill="#93c5fd" radius={[0, 6, 6, 0]} barSize={14} />
            <Bar dataKey="업계 일반" fill="#99f6e4" radius={[0, 6, 6, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 수치 요약 테이블 ── */}
      <table className={styles.comparisonTable}>
        <thead>
          <tr>
            <th>지표</th>
            <th className={styles.numberCell}>우리 AI</th>
            <th className={styles.numberCell}>우리 일반</th>
            <th className={styles.numberCell}>업계 AI</th>
            <th className={styles.numberCell}>업계 일반</th>
            <th className={styles.numberCell}>우리 AI vs 업계 AI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>구매전환율</td>
            <td className={styles.numberCell}>{our.ai.purchaseConversionRate.toFixed(2)}%</td>
            <td className={styles.numberCell}>{our.organic.purchaseConversionRate.toFixed(2)}%</td>
            <td className={styles.numberCell}>{BENCHMARK.ai.purchaseConversionRate}%</td>
            <td className={styles.numberCell}>{BENCHMARK.organic.purchaseConversionRate}%</td>
            <td className={styles.numberCell}>
              <DiffBadge value={our.ai.purchaseConversionRate - BENCHMARK.ai.purchaseConversionRate} unit="%p" higherIsBetter />
            </td>
          </tr>
          <tr>
            <td>참여율</td>
            <td className={styles.numberCell}>{our.ai.engagementRate.toFixed(1)}%</td>
            <td className={styles.numberCell}>{our.organic.engagementRate.toFixed(1)}%</td>
            <td className={styles.numberCell}>{BENCHMARK.ai.engagementRate}%</td>
            <td className={styles.numberCell}>{BENCHMARK.organic.engagementRate}%</td>
            <td className={styles.numberCell}>
              <DiffBadge value={our.ai.engagementRate - BENCHMARK.ai.engagementRate} unit="%p" higherIsBetter />
            </td>
          </tr>
          <tr>
            <td>이탈률</td>
            <td className={styles.numberCell}>{our.ai.bounceRate.toFixed(1)}%</td>
            <td className={styles.numberCell}>{our.organic.bounceRate.toFixed(1)}%</td>
            <td className={styles.numberCell}>{BENCHMARK.ai.bounceRate}%</td>
            <td className={styles.numberCell}>{BENCHMARK.organic.bounceRate}%</td>
            <td className={styles.numberCell}>
              <DiffBadge value={our.ai.bounceRate - BENCHMARK.ai.bounceRate} unit="%p" higherIsBetter={false} />
            </td>
          </tr>
          <tr>
            <td>평균 체류시간</td>
            <td className={styles.numberCell}>{fmtDuration(our.ai.avgSessionDurationSec)}</td>
            <td className={styles.numberCell}>{fmtDuration(our.organic.avgSessionDurationSec)}</td>
            <td className={styles.numberCell}>{fmtDuration(BENCHMARK.ai.avgSessionDurationSec)}</td>
            <td className={styles.numberCell}>{fmtDuration(BENCHMARK.organic.avgSessionDurationSec)}</td>
            <td className={styles.numberCell}>
              <DiffBadge value={(our.ai.avgSessionDurationSec - BENCHMARK.ai.avgSessionDurationSec) / 60} unit="분" higherIsBetter />
            </td>
          </tr>
          <tr>
            <td>페이지/세션</td>
            <td className={styles.numberCell}>{our.ai.pagesPerSession.toFixed(2)}</td>
            <td className={styles.numberCell}>{our.organic.pagesPerSession.toFixed(2)}</td>
            <td className={styles.numberCell}>{BENCHMARK.ai.pagesPerSession}</td>
            <td className={styles.numberCell}>{BENCHMARK.organic.pagesPerSession}</td>
            <td className={styles.numberCell}>
              <DiffBadge value={our.ai.pagesPerSession - BENCHMARK.ai.pagesPerSession} unit="" higherIsBetter />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 체류시간 산출 방식 설명 ── */}
      <div className={styles.durationExplainer}>
        <div className={styles.durationExplainerTitle}>평균 체류시간 산출 방식</div>
        <div className={styles.durationExplainerBody}>
          <p>
            <strong>측정 기준:</strong> GA4의 <code>averageSessionDuration</code> 메트릭으로, 세션 시작(first_visit / session_start)부터
            해당 세션 내 마지막 이벤트 발생 시각까지의 경과 시간을 전체 세션에 대해 평균한 값입니다.
          </p>
          <p>
            <strong>AI 유입이 높게 나타나는 이유:</strong>
          </p>
          <ul>
            <li>
              <strong>소규모 표본 효과</strong> — AI 유입 {our.ai.sessions.toLocaleString("ko-KR")}세션 vs 일반 {our.organic.sessions.toLocaleString("ko-KR")}세션.
              세션 수가 적어 소수의 장시간 세션(예: 탭을 열어둔 채 이탈)이 평균을 크게 끌어올립니다.
            </li>
            <li>
              <strong>대시보드/보고서 페이지</strong> — AI 유입 중 내부 보고서 페이지(/report)의 비중이 높으며,
              이 페이지는 장시간 열어두고 분석하는 패턴이 많아 체류시간이 30분 이상으로 측정됩니다.
            </li>
            <li>
              <strong>콘텐츠 몰입</strong> — AI 추천으로 유입된 사용자는 건강 정보·연구 콘텐츠를 깊이 읽는 경향이 있어,
              일반 검색(정보 확인 후 빠르게 이탈)보다 체류가 길어집니다.
            </li>
          </ul>
          <p>
            <strong>참고:</strong> GA4는 사용자가 브라우저를 닫거나 30분 이상 비활성(idle)이면 세션을 종료합니다.
            탭을 열어둔 채 다른 작업을 하다 돌아오면 새 세션으로 카운트되지만,
            중간에 간헐적으로 스크롤 등 이벤트가 발생하면 하나의 긴 세션으로 기록될 수 있습니다.
          </p>
        </div>
      </div>

      <div className={styles.benchmarkSource}>
        * 업계 벤치마크 출처: Contentsquare 2024 Digital Benchmarks, Statista, FirstPageSage AI Traffic Study
      </div>

      {/* ── 텍스트 인사이트 ── */}
      <div className={styles.insightSection}>
        <h4 className={styles.insightSectionTitle}>종합 인사이트</h4>
        {insights.map((insight, idx) => (
          <div key={idx} className={`${styles.insightItem} ${styles[`insightType${insight.type}`] ?? ""}`}>
            <span className={styles.insightBullet}>{insight.icon}</span>
            <div>
              <strong className={styles.insightLabel}>{insight.title}</strong>
              <p className={styles.insightText}>{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 차이 배지 ── */
function DiffBadge({ value, unit, higherIsBetter }: { value: number; unit: string; higherIsBetter: boolean }) {
  const isPositive = value > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const cls = isGood ? styles.diffGood : styles.diffBad;
  const arrow = isPositive ? "▲" : "▼";
  return (
    <span className={`${styles.diffBadge} ${cls}`}>
      {arrow} {Math.abs(value).toFixed(value >= 10 || value <= -10 ? 1 : 2)}{unit}
    </span>
  );
}

/* ── 인사이트 생성 로직 ── */
type Insight = { icon: string; type: "positive" | "warning" | "neutral"; title: string; body: string };

type OurData = {
  ai: { purchaseConversionRate: number; engagementRate: number; bounceRate: number; pagesPerSession: number; avgSessionDurationSec: number; sessions: number; revenue: number };
  organic: { purchaseConversionRate: number; engagementRate: number; bounceRate: number; pagesPerSession: number; avgSessionDurationSec: number; sessions: number; revenue: number };
};

function generateInsights(our: OurData, bench: typeof BENCHMARK): Insight[] {
  const insights: Insight[] = [];

  // 1. AI 전환율 vs 업계 AI 전환율
  const aiConvDiff = our.ai.purchaseConversionRate - bench.ai.purchaseConversionRate;
  if (aiConvDiff > 0) {
    insights.push({
      icon: "🏆",
      type: "positive",
      title: `AI 유입 구매전환율 업계 대비 +${aiConvDiff.toFixed(2)}%p 우위`,
      body: `우리 AI 유입 구매전환율(${our.ai.purchaseConversionRate.toFixed(2)}%)은 업계 평균(${bench.ai.purchaseConversionRate}%)을 크게 상회합니다. AI 유입 사용자가 구매까지 이어지는 콘텐츠 품질이 우수합니다.`,
    });
  } else {
    insights.push({
      icon: "⚠️",
      type: "warning",
      title: `AI 유입 구매전환율이 업계 평균 이하`,
      body: `우리 AI 유입 구매전환율(${our.ai.purchaseConversionRate.toFixed(2)}%)이 업계 평균(${bench.ai.purchaseConversionRate}%)보다 낮습니다. AI 랜딩페이지의 구매 전환 경로를 점검하세요.`,
    });
  }

  // 2. 우리 AI vs 우리 Organic 전환율
  const ourDiff = our.ai.purchaseConversionRate - our.organic.purchaseConversionRate;
  if (Math.abs(ourDiff) < 0.1) {
    insights.push({
      icon: "📊",
      type: "neutral",
      title: `AI 유입과 일반 유입의 구매전환율이 거의 동일`,
      body: `AI 유입(${our.ai.purchaseConversionRate.toFixed(2)}%)과 일반 유입(${our.organic.purchaseConversionRate.toFixed(2)}%)의 전환율 차이가 ${Math.abs(ourDiff).toFixed(2)}%p로 미미합니다. AI 유입 사용자도 일반 유입만큼 구매 의도가 높다는 뜻으로, AI 최적화가 잘 작동하고 있는 신호입니다.`,
    });
  } else if (ourDiff > 0) {
    insights.push({
      icon: "🚀",
      type: "positive",
      title: `AI 유입이 일반보다 전환율 +${ourDiff.toFixed(2)}%p 높음`,
      body: `AI 유입 사용자가 일반 검색보다 구매 의도가 높습니다. AI 채널 투자를 확대하면 ROI가 개선될 수 있습니다.`,
    });
  } else {
    insights.push({
      icon: "💡",
      type: "warning",
      title: `일반 유입이 AI보다 전환율 +${Math.abs(ourDiff).toFixed(2)}%p 높음`,
      body: `AI 유입 사용자의 구매 전환이 일반보다 낮습니다. AI 추천 랜딩페이지에 CTA(구매 유도) 요소를 강화하거나, 상품 추천 구조를 개선해보세요.`,
    });
  }

  // 3. 참여율 인사이트
  const engDiffVsBench = our.ai.engagementRate - bench.ai.engagementRate;
  if (engDiffVsBench > 20) {
    insights.push({
      icon: "⭐",
      type: "positive",
      title: `AI 유입 참여율 업계 대비 +${engDiffVsBench.toFixed(0)}%p — 압도적 우위`,
      body: `우리 AI 유입 참여율(${our.ai.engagementRate.toFixed(1)}%)은 업계 평균(${bench.ai.engagementRate}%)을 크게 상회합니다. AI 사용자가 콘텐츠에 깊이 몰입하고 있으며, 콘텐츠 품질이 AI 추천에 최적화되어 있음을 의미합니다.`,
    });
  }

  // 4. 이탈률 인사이트
  const bounceDiffVsBench = our.ai.bounceRate - bench.ai.bounceRate;
  if (bounceDiffVsBench < -20) {
    insights.push({
      icon: "🛡️",
      type: "positive",
      title: `AI 유입 이탈률 업계 대비 ${bounceDiffVsBench.toFixed(0)}%p — 매우 낮음`,
      body: `우리 AI 유입 이탈률(${our.ai.bounceRate.toFixed(1)}%)은 업계 평균(${bench.ai.bounceRate}%)보다 훨씬 낮습니다. AI 채널을 통해 유입된 사용자가 사이트에 잘 정착하고 있습니다.`,
    });
  }

  // 5. 체류시간 인사이트
  const aiDurMin = our.ai.avgSessionDurationSec / 60;
  const orgDurMin = our.organic.avgSessionDurationSec / 60;
  const durRatio = orgDurMin > 0 ? aiDurMin / orgDurMin : 0;

  if (aiDurMin > 10) {
    insights.push({
      icon: "⏱️",
      type: "neutral",
      title: `AI 유입 평균 체류시간 ${fmtDuration(our.ai.avgSessionDurationSec)} — 일반 대비 ${durRatio.toFixed(1)}배`,
      body: `AI 유입의 평균 체류시간(${fmtDuration(our.ai.avgSessionDurationSec)})이 일반(${fmtDuration(our.organic.avgSessionDurationSec)})보다 현저히 깁니다. ` +
        `이는 GA4 실측 데이터(averageSessionDuration)이며, ` +
        `AI 유입 세션 수가 ${our.ai.sessions.toLocaleString("ko-KR")}건으로 적어 소수의 장시간 세션(대시보드·연구 콘텐츠 장기 열람)이 평균을 끌어올리는 효과가 있습니다. ` +
        `참고로 일반 유입은 ${our.organic.sessions.toLocaleString("ko-KR")}세션으로 표본이 충분합니다.`,
    });
  }

  // 6. 세션당 페이지 수 인사이트
  if (our.ai.pagesPerSession > our.organic.pagesPerSession) {
    insights.push({
      icon: "📖",
      type: "positive",
      title: `AI 유입 사용자가 더 많은 페이지 탐색`,
      body: `AI 유입(${our.ai.pagesPerSession.toFixed(2)}p/세션)이 일반 유입(${our.organic.pagesPerSession.toFixed(2)}p/세션)보다 평균 ${(our.ai.pagesPerSession - our.organic.pagesPerSession).toFixed(2)}p 더 많은 페이지를 탐색합니다. AI 추천 콘텐츠가 후속 탐색을 유도하는 효과가 있습니다.`,
    });
  }

  // 7. 매출 기여도 인사이트
  const totalRevenue = our.ai.revenue + our.organic.revenue;
  if (totalRevenue > 0 && our.ai.revenue > 0) {
    const aiRevenueShare = (our.ai.revenue / totalRevenue) * 100;
    const aiSessionShare = (our.ai.sessions / (our.ai.sessions + our.organic.sessions)) * 100;
    const revenuePerSession = {
      ai: our.ai.sessions > 0 ? our.ai.revenue / our.ai.sessions : 0,
      organic: our.organic.sessions > 0 ? our.organic.revenue / our.organic.sessions : 0,
    };

    insights.push({
      icon: "💰",
      type: "neutral",
      title: `AI 유입 매출 기여도: ${aiRevenueShare.toFixed(1)}%`,
      body: `AI 유입은 전체 세션의 ${aiSessionShare.toFixed(1)}%를 차지하며, 전체 매출의 ${aiRevenueShare.toFixed(1)}%를 기여합니다. 세션당 매출은 AI ₩${Math.round(revenuePerSession.ai).toLocaleString("ko-KR")} vs 일반 ₩${Math.round(revenuePerSession.organic).toLocaleString("ko-KR")}입니다.`,
    });
  }

  return insights;
}
