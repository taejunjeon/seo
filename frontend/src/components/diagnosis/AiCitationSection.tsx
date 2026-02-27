"use client";

import { useMemo } from "react";
import type { AiCitationApiResponse, AiCitationProvider } from "./types";
import { VERDICT_META } from "./types";
import ProviderCards from "./ProviderCards";
import CitationSamplesTable from "./CitationSamplesTable";
import CompetitorDomainsTable from "./CompetitorDomainsTable";
import styles from "./AiCitation.module.css";

/* 점수 산식: ChatGPT 80% + Perplexity 20% (Google AIO 제외) */
const SCORE_WEIGHTS: Partial<Record<AiCitationProvider, number>> = {
  chatgpt_search: 0.8,
  perplexity: 0.2,
};
const MIN_ELIGIBLE = 3;

type Props = {
  data: AiCitationApiResponse;
  diagUrl?: string;
};

export default function AiCitationSection({ data, diagUrl }: Props) {
  const vm = VERDICT_META[data.verdict];
  const measuredTime = new Date(data.measuredAt).toLocaleString("ko-KR");

  /* 점수 기준 가중 인용률 계산 (백엔드 산식과 동일) */
  const { weightedPct, activeNames } = useMemo(() => {
    const activeProviders = data.providers.filter(
      (p) => (SCORE_WEIGHTS[p.provider] ?? 0) > 0 && p.eligible >= MIN_ELIGIBLE,
    );
    const totalWeight = activeProviders.reduce((s, p) => s + (SCORE_WEIGHTS[p.provider] ?? 0), 0);
    const rate = totalWeight > 0
      ? activeProviders.reduce((s, p) => s + (SCORE_WEIGHTS[p.provider] ?? 0) * p.citationRate, 0) / totalWeight
      : 0;
    const names = activeProviders.map((p) => {
      const w = SCORE_WEIGHTS[p.provider] ?? 0;
      return `${p.provider === "chatgpt_search" ? "ChatGPT" : "Perplexity"} ${(w * 100).toFixed(0)}%`;
    }).join(" + ");
    return { weightedPct: Math.round(rate * 100), activeNames: names };
  }, [data.providers]);

  /* diagUrl이 matchedReferences에 존재하는지 확인 */
  const currentUrlCited = diagUrl
    ? data.providers.some((p) =>
        p.samples.some((s) =>
          s.matchedReferences.some((r) =>
            r.link.includes(diagUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "")),
          ),
        ),
      )
    : false;

  return (
    <section className={styles.citationSection}>
      {/* 헤더 */}
      <div className={styles.citationHeader}>
        <h2 className={styles.citationTitle}>AI 답변 인용도 분석</h2>
        <span className={styles.citationProviderCount}>{data.providers.length}개 프로바이더</span>
      </div>

      {/* 도메인 단위 안내 */}
      <p className={styles.citationNotice}>
        AI 인용도는 이 URL이 아니라 <strong>{data.siteHost}</strong> 전체가 AI 답변 출처에 등장하는지 측정합니다.
        점수 산식: {activeNames || "활성 프로바이더 없음"} (Google AIO는 참고용 벤치마크)
      </p>

      {/* 현재 URL 인용 배지 */}
      {currentUrlCited && diagUrl && (
        <div className={styles.urlCitedBanner}>
          이 페이지({diagUrl.replace(/^https?:\/\//i, "").slice(0, 60)})가 AI 출처에 직접 인용되었습니다
        </div>
      )}

      {/* verdict + 종합 지표 */}
      <div className={styles.verdictRow}>
        <div className={`${styles.verdictCard} ${styles[vm.colorClass]}`}>
          <span className={styles.verdictIcon}>{vm.icon}</span>
          <div className={styles.verdictText}>
            <strong className={styles.verdictLabel}>{vm.label}</strong>
            <span className={styles.verdictDesc}>{vm.description}</span>
          </div>
        </div>
        <div className={styles.summaryMetrics}>
          <div className={styles.summaryMetric}>
            <span className={styles.summaryMetricLabel}>가중 인용률</span>
            <span className={styles.summaryMetricValue}>{weightedPct}%</span>
          </div>
          <div className={styles.summaryMetric}>
            <span className={styles.summaryMetricLabel}>전체 인용</span>
            <span className={styles.summaryMetricValue}>{data.citedQueriesTotal}/{data.eligibleTotal}</span>
          </div>
          <div className={styles.summaryMetric}>
            <span className={styles.summaryMetricLabel}>측정 시각</span>
            <span className={styles.summaryMetricValue}>{measuredTime}</span>
          </div>
        </div>
      </div>

      {/* 프로바이더 카드 (점수 반영 vs 참고용 분리) */}
      <ProviderCards providers={data.providers} />

      {/* 표본 키워드 테이블 */}
      <CitationSamplesTable
        providers={data.providers}
        siteHost={data.siteHost}
        pickedQueries={data.pickedQueries}
        diagUrl={diagUrl}
      />

      {/* 경쟁 출처 테이블 */}
      <CompetitorDomainsTable
        providers={data.providers}
        siteHost={data.siteHost}
      />
    </section>
  );
}
