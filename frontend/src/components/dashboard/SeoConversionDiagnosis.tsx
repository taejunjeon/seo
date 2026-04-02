"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./SeoConversionDiagnosis.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7020";

type DiagnosisIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  summary: string;
  whyItHappens: string;
  signals: Array<{ label: string; value: string }>;
  checks: string[];
};

type DiagnosisData = {
  issues: DiagnosisIssue[];
  recommendedChecks: string[];
  summary: {
    organicSessionScope: {
      sessions: number;
      entrances: number;
      ecommercePurchases: number;
      keyEvents: number;
      grossPurchaseRevenue: number;
    };
    dataQualitySignals: {
      notSetLandingRatio: number;
    };
    funnelSignals: {
      method: "runFunnelReport" | "eventCount_fallback";
      purchaseUsers: number;
      totalPurchases: number;
    };
    transactionSignals: {
      totalPurchaseEvents: number;
      transactionCoverageRatio: number;
      blankTransactionEvents: number;
      duplicatePurchaseEvents: number;
    };
  };
};

type Props = {
  startDate?: string;
  endDate?: string;
};

const fmtNum = (value: number) => Math.round(value).toLocaleString("ko-KR");
const fmtWon = (value: number) => `₩${Math.round(value).toLocaleString("ko-KR")}`;
const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function SeoConversionDiagnosis({ startDate, endDate }: Props) {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (startDate) qs.set("startDate", startDate);
      if (endDate) qs.set("endDate", endDate);
      const res = await fetch(`${API_BASE}/api/ga4/seo-conversion-diagnosis?${qs}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // 비핵심 보조 진단이므로 실패 시 조용히 숨긴다.
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className={styles.loading}>SEO 전환 진단 계산 중...</div>;
  if (!data || data.issues.length === 0) return null;

  const organic = data.summary.organicSessionScope;
  const funnel = data.summary.funnelSignals;
  const transaction = data.summary.transactionSignals;
  const notSetLandingRatio = data.summary.dataQualitySignals.notSetLandingRatio;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header} onClick={() => setExpanded((prev) => !prev)}>
        <div>
          <div className={styles.title}>SEO 유입보다 purchase가 더 커 보이는 이유 진단</div>
          <div className={styles.subtitle}>
            숫자가 이상해 보여도, 절반은 버그가 아니라 scope와 측정 정의 문제일 수 있다.
          </div>
        </div>
        <button className={styles.toggle}>{expanded ? "접기" : "펼치기"}</button>
      </div>

      {expanded && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.label}>Organic Search 세션</span>
              <strong className={styles.value}>{fmtNum(organic.sessions)}</strong>
              <span className={styles.note}>Entrances {fmtNum(organic.entrances)} · key events {fmtNum(organic.keyEvents)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.label}>Organic Search 구매</span>
              <strong className={styles.value}>{fmtNum(organic.ecommercePurchases)}</strong>
              <span className={styles.note}>매출 {fmtWon(organic.grossPurchaseRevenue)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.label}>Landing page (not set)</span>
              <strong className={styles.value}>{fmtPct(notSetLandingRatio)}</strong>
              <span className={styles.note}>랜딩 분모가 일부 사라졌을 가능성</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.label}>transaction_id 커버리지</span>
              <strong className={styles.value}>{fmtPct(transaction.transactionCoverageRatio)}</strong>
              <span className={styles.note}>
                purchase {fmtNum(transaction.totalPurchaseEvents)}건 · 누락 {fmtNum(transaction.blankTransactionEvents)}건 · 중복 의심 {fmtNum(transaction.duplicatePurchaseEvents)}건
              </span>
            </div>
          </div>

          <div className={styles.interpret}>
            <strong>어떻게 읽어야 하나</strong>: `세션`, `구매`, `key event`는 같은 분모가 아니다.
            여기에 `First user`와 `Session` scope를 섞거나, `/shop_view`를 query string 없이 뭉개거나,
            PG 왕복으로 세션이 끊기면 윗단 유입보다 아랫단 전환 숫자가 더 커 보이는 착시가 생긴다.
            지금 카드는 그 원인 후보를 한 번에 정리해 주는 진단 레이어다.
            {funnel.totalPurchases > 0 && funnel.purchaseUsers === 0 && (
              <>
                {" "}
                특히 현재는 <strong>실제 purchase는 있는데 runFunnelReport의 purchase가 0</strong>이라,
                cross-domain 또는 PG 단절을 가장 먼저 의심해야 한다.
              </>
            )}
          </div>

          <div className={styles.issueList}>
            {data.issues.map((issue) => (
              <article key={issue.id} className={`${styles.issueCard} ${styles[`issue${issue.severity[0].toUpperCase()}${issue.severity.slice(1)}`]}`}>
                <div className={styles.issueHead}>
                  <span className={`${styles.badge} ${styles[`badge${issue.severity[0].toUpperCase()}${issue.severity.slice(1)}`]}`}>
                    {issue.severity === "error" ? "ERROR" : issue.severity === "warning" ? "WARN" : "INFO"}
                  </span>
                  <h3 className={styles.issueTitle}>{issue.title}</h3>
                </div>
                <p className={styles.issueSummary}>{issue.summary}</p>
                <p className={styles.issueWhy}><strong>왜 이런가</strong>: {issue.whyItHappens}</p>
                {issue.signals.length > 0 && (
                  <div className={styles.signalGrid}>
                    {issue.signals.map((signal) => (
                      <div key={`${issue.id}-${signal.label}`} className={styles.signalItem}>
                        <span className={styles.signalLabel}>{signal.label}</span>
                        <span className={styles.signalValue}>{signal.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.checkBlock}>
                  <strong>바로 확인할 것</strong>
                  <ul>
                    {issue.checks.map((check) => (
                      <li key={`${issue.id}-${check}`}>{check}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.checklist}>
            <div className={styles.checklistTitle}>실제 확인 순서</div>
            <ol>
              {data.recommendedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
