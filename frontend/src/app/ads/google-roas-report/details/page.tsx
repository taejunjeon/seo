"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";
import styles from "../page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type ClassificationKey =
  | "ready_ledger_waiting_send"
  | "sent_waiting_or_reflected"
  | "failed_click_too_old_for_action"
  | "failed_invalid_or_test_click_id"
  | "failed_google_ads_partial_failure"
  | "candidate_missing_google_click_id"
  | "candidate_needs_bridge_write"
  | "candidate_not_actual_purchase"
  | "needs_manual_review";

type OfflineDiagnosticClassification = {
  ok: true;
  fetchedAt: string;
  generatedAt: string;
  mode: "offline_diagnostic_classification_no_send";
  goal: string;
  window: {
    label: string;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  sourceFreshness?: {
    maxPaymentCompleteKst?: string | null;
    source?: string;
  };
  summary: {
    ledgerRowsInWindow: number;
    candidateRowsInWindow: number;
    actualPurchaseRows: number;
    classifiedRows: number;
    googleAdsSendCandidateRows: number;
    googleAdsSendCandidateAmountKrw: number;
    externalSendCount: 0;
  };
  classificationCounts: Array<{
    key: ClassificationKey;
    label: string;
    count: number;
    amountKrw: number;
    plain: string;
    sendPolicy: "diagnostic_only" | "ready_after_send_approval" | "do_not_send" | "manual_review_before_send";
  }>;
  separationGuide: {
    classificationPurpose: string;
    sendExpansionPurpose: string;
    plain: string;
  };
  recentRows: Array<{
    safeRef: string;
    rowSource: "upload_ledger" | "candidate_expansion";
    classification: ClassificationKey;
    amountKrw: number;
    conversionDateKst: string;
    ledgerStatus: string | null;
    reason: string;
    rawOrderIdExposed: false;
    rawClickIdExposed: false;
  }>;
  caveats: string[];
};

type CandidateExpansion = {
  ok: true;
  fetchedAt: string;
  generatedAt: string;
  summary: {
    actualPurchaseRows: number;
    actualPurchaseRevenueKrw: number;
    readyExactGclidRows: number;
    potentialOneOfBraidRows: number;
    mixedGoogleClickIdRows: number;
    npayBridgeGradeAWithGoogleClickIdRows: number;
    npayBridgeGradeAWithGoogleClickIdAmountKrw: number;
    npayBridgeGradeARecoveredGoogleClickIdRows: number;
    npayBridgeGradeARecoveredGoogleClickIdAmountKrw: number;
    internalBridgeWithoutGoogleClickIdRows: number;
    missingClickBridgeRows: number;
    sendCandidateCount: 0;
  };
  tiers: Array<{
    key: string;
    label: string;
    count: number;
    amountKrw: number;
    googleAdsSendPolicy: string;
    plain: string;
  }>;
  caveats: string[];
};

const formatKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
};

const formatCount = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR") : "-";

const formatFetchedAt = (value: string | undefined) => {
  if (!value) return "조회 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const sendPolicyLabel = (value: string) => {
  if (value === "ready_after_send_approval") return "전송 후보";
  if (value === "manual_review_before_send") return "검토 후 판단";
  if (value === "do_not_send") return "전송 금지";
  return "진단용";
};

const sendPolicyClass = (value: string) => {
  if (value === "ready_after_send_approval") return styles.status;
  if (value === "manual_review_before_send") return `${styles.status} ${styles.statusWarn}`;
  if (value === "do_not_send") return `${styles.status} ${styles.statusHold}`;
  return `${styles.status} ${styles.statusWarn}`;
};

async function fetchJson<T>(urls: string[]): Promise<T | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json() as T & { ok?: boolean };
      if (response.ok && data.ok) return data;
    } catch {
      // Try the next source.
    }
  }
  return null;
}

export default function GoogleRoasDetailReportPage() {
  const [classification, setClassification] = useState<OfflineDiagnosticClassification | null>(null);
  const [expansion, setExpansion] = useState<CandidateExpansion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const classificationUrls = [
      "https://att.ainativeos.net/api/google-ads/confirmed-purchase/offline-diagnostic-classification?site=biocom&window=last_7d&limit=40",
      `${API_BASE}/api/google-ads/confirmed-purchase/offline-diagnostic-classification?site=biocom&window=last_7d&limit=40`,
    ];
    const expansionUrls = [
      "https://att.ainativeos.net/api/google-ads/confirmed-purchase/candidate-expansion?site=biocom&window=last_7d&limit=40",
      `${API_BASE}/api/google-ads/confirmed-purchase/candidate-expansion?site=biocom&window=last_7d&limit=40`,
    ];

    const [nextClassification, nextExpansion] = await Promise.all([
      fetchJson<OfflineDiagnosticClassification>(classificationUrls),
      fetchJson<CandidateExpansion>(expansionUrls),
    ]);

    setClassification(nextClassification);
    setExpansion(nextExpansion);
    if (!nextClassification && !nextExpansion) {
      setError("live API에서 상세 진단 값을 읽지 못했습니다. backend 상태 또는 CORS/API_BASE를 확인해야 합니다.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const keyCards = useMemo(() => {
    if (!classification) return [];
    return [
      {
        label: "최근 7일 실제 구매",
        value: `${formatCount(classification.summary.actualPurchaseRows)}건`,
        sub: "운영 주문 원장 기준 결제완료 주문입니다.",
      },
      {
        label: "분류된 row",
        value: `${formatCount(classification.summary.classifiedRows)}건`,
        sub: "전송 장부 row와 후보 row를 합쳐 차단 이유별로 나눴습니다.",
      },
      {
        label: "전송 가능 출발점",
        value: `${formatCount(classification.summary.googleAdsSendCandidateRows)}건`,
        sub: `${formatKrw(classification.summary.googleAdsSendCandidateAmountKrw)} · 승인/중복 guard 전 단계입니다.`,
      },
      {
        label: "외부 전송",
        value: `${classification.summary.externalSendCount}건`,
        sub: "이 상세 보고서는 read-only/no-send입니다.",
      },
    ];
  }, [classification]);

  return (
    <div className={styles.page}>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.main}>
        <div className={styles.topRow}>
          <div>
            <Link href="/ads/google-roas-report" className={styles.backLink}>요약 보고서로 돌아가기</Link>
            <p className={styles.eyebrow}>Google ROAS 상세 진단</p>
            <h1 className={styles.title}>오프라인 전환 진단과 실제 전송 후보를 분리해서 봅니다</h1>
            <p className={styles.lead}>
              이 화면은 정보량이 많은 원본 보고서에서 분리한 상세 화면입니다.
              Google Ads에 이미 보낸 row의 진단 상태와, 앞으로 실제 구매로 보낼 수 있는 후보 확장 규칙을 따로 보여줍니다.
            </p>
          </div>
          <div className={styles.actions}>
            <Link href="/ads/google-roas-report" className={styles.actionLink}>요약 보고서</Link>
            <button className={`${styles.refreshButton} ${styles.primaryAction}`} onClick={() => void load()} disabled={loading}>
              {loading ? "조회 중" : "상세값 다시 조회"}
            </button>
          </div>
        </div>

        <section className={styles.decisionBand}>
          <div>
            <p className={styles.decisionLabel}>읽는 법</p>
            <h2>진단표는 “왜 안 붙었나”, 전송 후보표는 “무엇을 보낼 수 있나”입니다.</h2>
            <p>
              Google Ads 오프라인 전환 화면의 오류는 이미 보낸 row가 왜 리포트에 반영되지 않는지 설명합니다.
              반대로 전송 후보 확장 규칙은 앞으로 실제 구매 주문 중 어떤 주문을 Google Ads에 알려줄 수 있는지 고르는 기준입니다.
              두 숫자를 섞으면 과전송 위험이 생기므로 이 화면에서 분리했습니다.
            </p>
          </div>
          <div className={styles.decisionAside}>
            <div className={styles.guardPill}>
              <strong>전송 안전선</strong>
              <span>이 상세 화면은 read-only입니다. Google Ads send, VM write, 운영DB write는 0건입니다.</span>
            </div>
            <div className={styles.guardPill}>
              <strong>조회 기준</strong>
              <span>{classification ? `${classification.window.startDate} ~ ${classification.window.endDate}` : "최근 7일"}</span>
            </div>
          </div>
        </section>

        {error ? (
          <section className={styles.section}>
            <span className={`${styles.status} ${styles.statusHold}`}>API 확인 필요</span>
            <p>{error}</p>
          </section>
        ) : null}

        <section className={styles.kpiGrid} aria-label="상세 진단 핵심 숫자">
          {keyCards.map((card) => (
            <article key={card.label} className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{card.label}</div>
              <div className={styles.kpiValue}>{card.value}</div>
              <div className={styles.kpiSub}>{card.sub}</div>
            </article>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>오프라인 전환 진단 분류</h2>
              <p>
                Google Ads 화면의 “식별자 오래됨”, “부분 실패”, “대기” 같은 상태를 사람이 읽을 수 있는 이유로 바꾼 표입니다.
              </p>
            </div>
            <span className={styles.metaText}>source: live API · {formatFetchedAt(classification?.fetchedAt)}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>분류</th>
                  <th>건수</th>
                  <th>금액</th>
                  <th>전송 판단</th>
                  <th>쉬운 설명</th>
                </tr>
              </thead>
              <tbody>
                {(classification?.classificationCounts ?? []).map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong><span>{row.key}</span></td>
                    <td>{formatCount(row.count)}건</td>
                    <td>{formatKrw(row.amountKrw)}</td>
                    <td><span className={sendPolicyClass(row.sendPolicy)}>{sendPolicyLabel(row.sendPolicy)}</span></td>
                    <td>{row.plain}</td>
                  </tr>
                ))}
                {!classification?.classificationCounts?.length ? (
                  <tr>
                    <td colSpan={5}>아직 live 분류 결과가 없습니다. backend 배포 후 다시 조회합니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Google Ads 전송 후보 확장 규칙</h2>
              <p>
                이 표는 “보낼 수 있는 주문을 어떻게 넓힐지” 보는 표입니다.
                위 진단표와 다르게, 실제 구매 조건과 click id 조건을 통과할 수 있는 후보군을 나눕니다.
              </p>
            </div>
            <span className={styles.metaText}>source: candidate-expansion API · {formatFetchedAt(expansion?.fetchedAt)}</span>
          </div>

          <section className={styles.kpiGrid} aria-label="후보 확장 핵심 숫자">
            <article className={styles.kpiCard}>
              <div className={styles.kpiLabel}>실제 구매 전체</div>
              <div className={styles.kpiValue}>{formatCount(expansion?.summary.actualPurchaseRows)}건</div>
              <div className={styles.kpiSub}>{formatKrw(expansion?.summary.actualPurchaseRevenueKrw)} 기준입니다.</div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiLabel}>gclid 직접 후보</div>
              <div className={styles.kpiValue}>{formatCount(expansion?.summary.readyExactGclidRows)}건</div>
              <div className={styles.kpiSub}>장부와 승인 조건이 맞으면 전송 출발점입니다.</div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiLabel}>NPay bridge Google 후보</div>
              <div className={styles.kpiValue}>{formatCount(expansion?.summary.npayBridgeGradeAWithGoogleClickIdRows)}건</div>
              <div className={styles.kpiSub}>{formatKrw(expansion?.summary.npayBridgeGradeAWithGoogleClickIdAmountKrw)} · bridge write 전 보류입니다.</div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiLabel}>click id 없는 내부 후보</div>
              <div className={styles.kpiValue}>{formatCount(expansion?.summary.internalBridgeWithoutGoogleClickIdRows)}건</div>
              <div className={styles.kpiSub}>내부 분석용이지 Google 전송 후보가 아닙니다.</div>
            </article>
          </section>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>후보군</th>
                  <th>건수</th>
                  <th>금액</th>
                  <th>Google Ads 정책</th>
                  <th>의미</th>
                </tr>
              </thead>
              <tbody>
                {(expansion?.tiers ?? []).map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong><span>{row.key}</span></td>
                    <td>{formatCount(row.count)}건</td>
                    <td>{formatKrw(row.amountKrw)}</td>
                    <td>{row.googleAdsSendPolicy}</td>
                    <td>{row.plain}</td>
                  </tr>
                ))}
                {!expansion?.tiers?.length ? (
                  <tr>
                    <td colSpan={5}>아직 후보 확장 결과가 없습니다. backend 배포 후 다시 조회합니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>최근 row 샘플</h2>
              <p>
                원문 주문번호와 원문 click id는 노출하지 않습니다. 어떤 상태로 막혔는지만 확인합니다.
              </p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>safe ref</th>
                  <th>출처</th>
                  <th>분류</th>
                  <th>금액/날짜</th>
                  <th>상태</th>
                  <th>이유</th>
                </tr>
              </thead>
              <tbody>
                {(classification?.recentRows ?? []).slice(0, 20).map((row) => (
                  <tr key={`${row.rowSource}:${row.safeRef}`}>
                    <td><strong>{row.safeRef}</strong></td>
                    <td>{row.rowSource === "upload_ledger" ? "전송 장부" : "후보 확장"}</td>
                    <td>{GOOGLE_ADS_CLASSIFICATION_LABELS[row.classification] ?? row.classification}</td>
                    <td>{formatKrw(row.amountKrw)}<span>{row.conversionDateKst}</span></td>
                    <td>{row.ledgerStatus ?? "-"}</td>
                    <td>{row.reason}</td>
                  </tr>
                ))}
                {!classification?.recentRows?.length ? (
                  <tr>
                    <td colSpan={6}>최근 row 샘플이 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

const GOOGLE_ADS_CLASSIFICATION_LABELS: Record<ClassificationKey, string> = {
  ready_ledger_waiting_send: "전송 가능 출발점",
  sent_waiting_or_reflected: "전송됨/반영 대기",
  failed_click_too_old_for_action: "클릭 기간 초과",
  failed_invalid_or_test_click_id: "테스트/잘못된 click id",
  failed_google_ads_partial_failure: "Google 부분 실패",
  candidate_missing_google_click_id: "click id 없음",
  candidate_needs_bridge_write: "bridge 장부 필요",
  candidate_not_actual_purchase: "실제 구매 아님",
  needs_manual_review: "수동 검토",
};
