"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import styles from "./page.module.css";
import { fmtNum, fmtKRW, fmtPct, fmtRatio } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";

/**
 * 결제 추적 (attribution) 탭 전용 섹션. Phase B에서 page.tsx에서 분리.
 *
 * `useCrmPhase1Data` 훅이 리턴하는 `data`·`loading`·`error`·`reload`를
 * props로 받는 순수 표현 컴포넌트.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Phase1Data = any;

type Props = {
  phase1Data: Phase1Data | null;
  phase1Loading: boolean;
  phase1Error: string | null;
  reloadPhase1: () => void;
};

export function AttributionTrackingSection({
  phase1Data,
  phase1Loading,
  phase1Error,
  reloadPhase1,
}: Props) {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>결제 추적 현황</h2>
            <p className={styles.sectionDesc}>
              고객이 결제를 완료했을 때, 그 기록이 우리 시스템에 제대로 들어오는지 확인한다.
            </p>
          </div>
          <button type="button" className={styles.retryButton} onClick={() => reloadPhase1()}>
            새로고침
          </button>
        </div>

        {phase1Loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>귀속 진단 데이터를 불러오는 중...</p>
          </div>
        ) : null}

        {phase1Error ? (
          <div className={styles.errorBox}>
            <strong>귀속 진단 오류</strong>
            <p>{phase1Error}</p>
          </div>
        ) : null}

        {phase1Data ? (
          <>
            {/* Blocker headline */}
            {(() => {
              const liveCount = phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live;
              const replayCount = phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.replay;
              const headline = liveCount === 0
                ? `결제 완료 신호가 아직 들어오지 않고 있다 — 사이트 연결이 필요하다`
                : `실제 결제 ${liveCount}건 수집 완료 (과거 데이터 재확인 ${replayCount}건)`;
              const isBlocked = liveCount === 0;
              return (
                <div style={{
                  padding: "12px 18px", borderRadius: 10, marginBottom: 14,
                  background: isBlocked ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${isBlocked ? "#fecaca" : "#bbf7d0"}`,
                  fontSize: "0.88rem", fontWeight: 700,
                  color: isBlocked ? "#dc2626" : "#16a34a",
                }}>
                  {headline}
                </div>
              );
            })()}

            <div className={styles.summaryGrid}>
              <SummaryCard
                label="수집된 결제 기록"
                value={fmtNum(phase1Data.p1s1a.ledgerSummary.totalEntries)}
                sub={`실제 결제 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.live)}건 / 과거 재확인 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.replay)}건 / 시스템 점검 ${fmtNum(phase1Data.p1s1a.ledgerSummary.countsByCaptureMode.smoke)}건`}
                tone={phase1Data.p1s1a.ledgerSummary.totalEntries > 0 ? "success" : "warn"}
              />
              <SummaryCard
                label="실제 결제 완료"
                value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live)}
                sub="고객이 결제 완료 페이지에 도달한 건수"
                tone={phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.live > 0 ? "success" : "warn"}
              />
              <SummaryCard
                label="확정 매출"
                value={fmtKRW(phase1Data.p1s1a.ledgerSummary.confirmedRevenue)}
                sub={`confirmed ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.confirmed)}건`}
                tone={phase1Data.p1s1a.ledgerSummary.confirmedRevenue > 0 ? "success" : "warn"}
              />
              <SummaryCard
                label="입금 대기 매출"
                value={fmtKRW(phase1Data.p1s1a.ledgerSummary.pendingRevenue)}
                sub={`pending ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.pending)}건`}
              />
              <SummaryCard
                label="취소/실패 매출"
                value={fmtKRW(phase1Data.p1s1a.ledgerSummary.canceledRevenue)}
                sub={`canceled ${fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByPaymentStatus.canceled)}건`}
              />
              <SummaryCard
                label="과거 데이터 재확인"
                value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.replay)}
                sub="이전 결제 기록을 다시 불러와 대조한 건수"
              />
              <SummaryCard
                label="시스템 점검 기록"
                value={fmtNum(phase1Data.p1s1a.ledgerSummary.paymentSuccessByCaptureMode.smoke)}
                sub="시스템이 정상 작동하는지 테스트한 건수"
              />
              <SummaryCard
                label="토스 결제 대조 성공률"
                value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate)}
                sub={`토스에서 확인된 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.matchedTossRows)}건 / 전체 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}건 (실제 결제 기준)`}
                tone={phase1Data.p1s1a.tossJoinSummary.byCaptureMode.live.joinCoverageRate > 0 ? "success" : "warn"}
              />
              <SummaryCard
                label="토스 결제 대조 성공률"
                value={fmtPct(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.joinCoverageRate)}
                sub={`토스에서 확인된 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.byCaptureMode.replay.matchedTossRows)}건 / 전체 ${fmtNum(phase1Data.p1s1a.tossJoinSummary.tossRows)}건 (과거 재확인 기준)`}
              />
              <SummaryCard
                label="유입 경로 불명 매출"
                value={fmtKRW(phase1Data.p1s1a.ga4NotSetTotals?.grossPurchaseRevenue ?? 0)}
                sub={`어디서 왔는지 모르는 구매 ${fmtNum(phase1Data.p1s1a.ga4NotSetTotals?.ecommercePurchases ?? 0)}건`}
              />
              <SummaryCard
                label="출처 누락 비율"
                value={fmtRatio(phase1Data.p1s1a.ga4Diagnosis?.dataQualitySignals.notSetLandingRatio ?? 0)}
                sub="처음 방문 기록이 빠진 비율 (광고 효과 측정에 영향)"
              />
            </div>

            <div className={styles.warningBox} style={{ marginTop: 18 }}>
              <strong>이 숫자들은 어떻게 읽나요?</strong>
              <ul className={styles.flatList}>
                <li><strong>실제 결제</strong> — 고객이 사이트에서 결제를 완료했을 때 자동으로 기록된 건수. 가장 중요한 숫자.</li>
                <li><strong>확정 매출</strong> — 토스 상태가 DONE/PAID로 닫힌 건만 잡은 실제 매출. 광고/CAPI 기준값으로 본다.</li>
                <li><strong>입금 대기 매출</strong> — 무통장 입금 등 아직 pending인 금액. 확정 전이므로 광고 성과 매출에는 포함하지 않는다.</li>
                <li><strong>취소/실패 매출</strong> — cancel/fail 상태로 바뀐 금액. 누락/오집계 여부를 보는 감시 숫자다.</li>
                <li><strong>과거 재확인</strong> — 예전 결제 기록을 토스 DB에서 다시 불러와서 빠진 게 없는지 확인한 건수. (교차 검증용)</li>
                <li><strong>시스템 점검</strong> — 기록 시스템이 정상 작동하는지 테스트 데이터로 확인한 건수. (실제 매출 아님)</li>
                <li><strong>토스 결제 대조</strong> — 우리가 수집한 결제 기록을 토스 승인 내역과 맞춰본 비율. 높을수록 기록이 정확함.</li>
                <li><strong>유입 경로 불명</strong> — 구매는 됐는데 "이 고객이 어디서 왔는지"를 모르는 매출. (광고/검색/직접 방문 중 뭔지 추적 실패)</li>
              </ul>
            </div>

            {/* 날짜별 추이 차트 */}
            {phase1Data.p1s1a.timeline.length > 0 && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>날짜별 결제 수집 추이</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={phase1Data.p1s1a.timeline.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ga4NotSetPurchases" fill="var(--color-danger)" name="유입 불명 구매" />
                    <Bar dataKey="tossApprovalCount" fill="var(--color-info)" name="토스 결제 승인" />
                    <Bar dataKey="livePaymentSuccessEntries" fill="var(--color-success)" name="실제 결제" />
                    <Bar dataKey="replayPaymentSuccessEntries" fill="#f59e0b" name="과거 재확인" />
                    <Bar dataKey="smokePaymentSuccessEntries" fill="#6b7280" name="시스템 점검" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>날짜별 결제 기록 비교표</h3>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>날짜</th>
                      <th className={styles.tableCellRight}>유입 불명 구매</th>
                      <th className={styles.tableCellRight}>유입 불명 매출</th>
                      <th className={styles.tableCellRight}>토스 승인</th>
                      <th className={styles.tableCellRight}>토스 승인액</th>
                      <th className={styles.tableCellRight}>실제 결제</th>
                      <th className={styles.tableCellRight}>과거 재확인</th>
                      <th className={styles.tableCellRight}>점검</th>
                      <th className={styles.tableCellRight}>결제 시작</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase1Data.p1s1a.timeline.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={styles.empty}>
                          비교할 timeline 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      phase1Data.p1s1a.timeline.slice(0, 20).map((row: Record<string, unknown>) => (
                        <tr key={String(row.date)} className={styles.tableRow}>
                          <td>{String(row.date)}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.ga4NotSetPurchases))}</td>
                          <td className={styles.tableCellRight}>{fmtKRW(Number(row.ga4NotSetRevenue))}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.tossApprovalCount))}</td>
                          <td className={styles.tableCellRight}>{fmtKRW(Number(row.tossApprovalAmount))}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.livePaymentSuccessEntries))}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.replayPaymentSuccessEntries))}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.smokePaymentSuccessEntries))}</td>
                          <td className={styles.tableCellRight}>{fmtNum(Number(row.checkoutEntries))}</td>
                          <td>{String(row.diagnosticLabel ?? "")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.warningBox}>
              <strong>다음 액션</strong>
              <ul className={styles.flatList}>
                {phase1Data.p1s1a.nextActions.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.interpretBlock}>
        <strong>이 탭이 왜 필요한가?</strong>
        <p>
          고객이 결제하면 3곳에 기록이 남는다: (1) 구글 애널리틱스, (2) 토스 결제 시스템, (3) 우리 자체 수집기.
          이 세 곳의 숫자가 같은 날에 맞아야 "결제 추적이 정상"이라고 볼 수 있다.
          숫자가 안 맞으면 광고 효과나 매출 분석이 틀어지므로, 여기서 매일 대조하는 것이다.
        </p>
      </section>
    </>
  );
}
