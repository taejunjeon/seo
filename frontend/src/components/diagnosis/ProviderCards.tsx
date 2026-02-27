"use client";

import type { AiCitationProviderResult, AiCitationProvider } from "./types";
import { PROVIDER_META } from "./types";
import styles from "./AiCitation.module.css";

/* 점수 산식에 반영되는 프로바이더와 가중치 */
const SCORE_WEIGHTS: Partial<Record<AiCitationProvider, number>> = {
  chatgpt_search: 0.8,
  perplexity: 0.2,
};
const MIN_ELIGIBLE = 3;

type Props = {
  providers: AiCitationProviderResult[];
};

const statusIcon = (s: "ok" | "partial" | "error") =>
  s === "ok" ? "✅" : s === "partial" ? "⚠️" : "❌";

function ProviderCard({ p, isScore, weight }: { p: AiCitationProviderResult; isScore: boolean; weight?: number }) {
  const meta = PROVIDER_META[p.provider];
  const pct = p.eligible > 0 ? Math.round(p.citationRate * 100) : 0;
  const active = isScore && p.eligible >= MIN_ELIGIBLE;

  return (
    <div className={`${styles.providerCard} ${!isScore ? styles.providerCardBench : ""} ${isScore && !active ? styles.providerCardInactive : ""}`}>
      <div className={styles.providerCardHeader}>
        <span className={styles.providerIcon}>{meta.icon}</span>
        <span className={styles.providerName}>{meta.label}</span>
        {isScore && weight != null && (
          <span className={styles.providerWeightBadge}>{(weight * 100).toFixed(0)}%</span>
        )}
        {!isScore && (
          <span className={styles.providerBenchBadge}>참고용</span>
        )}
        {isScore && !active && (
          <span className={styles.providerInactiveBadge}>미활성</span>
        )}
        <span className={styles.providerStatusBadge} title={`상태: ${p.providerStatus}`}>
          {statusIcon(p.providerStatus)}
        </span>
      </div>
      <div className={styles.providerMetrics}>
        <div className={styles.providerMetric}>
          <span className={styles.providerMetricLabel}>eligible</span>
          <span className={styles.providerMetricValue}>{p.eligible}/{p.samples.length}</span>
        </div>
        <div className={styles.providerMetric}>
          <span className={styles.providerMetricLabel}>cited</span>
          <span className={styles.providerMetricValue}>{p.citedQueries}</span>
        </div>
        <div className={styles.providerMetric}>
          <span className={styles.providerMetricLabel}>인용률</span>
          <span className={styles.providerMetricValue}>{pct}%</span>
        </div>
      </div>
      <div className={styles.providerBar}>
        <div
          className={styles.providerBarFill}
          style={{ width: `${pct}%`, backgroundColor: meta.color }}
        />
      </div>
      <div className={styles.providerLatency}>
        {(p.latencyMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

export default function ProviderCards({ providers }: Props) {
  const scoreProviders = providers.filter((p) => SCORE_WEIGHTS[p.provider] != null);
  const benchProviders = providers.filter((p) => SCORE_WEIGHTS[p.provider] == null);

  return (
    <div className={styles.providerSection}>
      {/* 점수 산식 프로바이더 */}
      {scoreProviders.length > 0 && (
        <>
          <h4 className={styles.providerGroupTitle}>점수 반영 (ChatGPT 80% + Perplexity 20%)</h4>
          <div className={styles.providerGrid}>
            {scoreProviders.map((p) => (
              <ProviderCard key={p.provider} p={p} isScore weight={SCORE_WEIGHTS[p.provider]} />
            ))}
          </div>
        </>
      )}

      {/* 참고용 프로바이더 (Google AIO) */}
      {benchProviders.length > 0 && (
        <>
          <h4 className={styles.providerGroupTitle}>참고용 벤치마크</h4>
          <div className={styles.providerGrid}>
            {benchProviders.map((p) => (
              <ProviderCard key={p.provider} p={p} isScore={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
