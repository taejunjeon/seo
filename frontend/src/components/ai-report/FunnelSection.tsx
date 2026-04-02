"use client";

import type { AiFunnelResponse } from "./types";
import styles from "./AiReport.module.css";

type Props = { data: AiFunnelResponse | null };

const FUNNEL_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#818cf8", "#a78bfa"];

export default function FunnelSection({ data }: Props) {
  if (!data || data.steps.length === 0) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🔽</span> AI 전환 퍼널
        </h3>
        <div className={styles.errorBox}>
          <div className={styles.errorIcon}>📊</div>
          <div className={styles.errorText}>퍼널 데이터를 불러올 수 없습니다</div>
        </div>
      </section>
    );
  }

  const maxValue = Math.max(...data.steps.map((s) => s.sessions), 1);

  // 각 단계별 이탈률 계산
  const stepsWithDropoff = data.steps.map((step, i) => {
    if (i === 0) return { ...step, dropoff: null as number | null };
    const prev = data.steps[i - 1].sessions;
    const dropoff = prev > 0 ? ((prev - step.sessions) / prev) * 100 : 0;
    return { ...step, dropoff };
  });

  // 최대 이탈 포인트 찾기
  const maxDropoffIdx = stepsWithDropoff.reduce((maxIdx, step, i) => {
    if (step.dropoff === null) return maxIdx;
    if (maxIdx === -1) return i;
    const maxDrop = stepsWithDropoff[maxIdx].dropoff ?? 0;
    return (step.dropoff ?? 0) > maxDrop ? i : maxIdx;
  }, -1);

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>🔽</span> AI 전환 퍼널
        {data.overallConversion != null && (
          <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#64748b", marginLeft: 8 }}>
            전체 전환율 {data.overallConversion.toFixed(1)}%
          </span>
        )}
      </h3>

      <div className={styles.funnelContainer}>
        {stepsWithDropoff.map((step, i) => (
          <div key={step.key}>
            {i > 0 && <div className={styles.funnelArrow}>↓</div>}
            <div className={styles.funnelStep}>
              <div className={styles.funnelLabel}>{step.name}</div>
              <div className={styles.funnelBarWrap}>
                <div
                  className={styles.funnelBar}
                  style={{
                    width: `${Math.max((step.sessions / maxValue) * 100, 8)}%`,
                    background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                  }}
                >
                  <span className={styles.funnelBarValue}>
                    {step.sessions.toLocaleString("ko-KR")}
                  </span>
                </div>
              </div>
              <div className={`${styles.funnelRate} ${i === maxDropoffIdx ? styles.funnelDropoff : ""}`}>
                {step.dropoff !== null ? `−${step.dropoff.toFixed(1)}%` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.biggestDropoff && (
        <div className={styles.insightCallout} style={{ borderColor: "#fecaca", background: "linear-gradient(135deg, #fef2f2, #fff1f2)" }}>
          <strong style={{ color: "#991b1b" }}>최대 이탈 포인트:</strong>{" "}
          <span style={{ color: "#b91c1c" }}>
            {data.biggestDropoff.from} → {data.biggestDropoff.to} (이탈률 {data.biggestDropoff.dropRate.toFixed(1)}%)
          </span>
        </div>
      )}
    </section>
  );
}
