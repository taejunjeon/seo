"use client";

import styles from "./page.module.css";
import { fmtDate, fmtNum, fmtKRW, fmtRatio } from "./crm-utils";
import { SummaryCard } from "./SummaryCard";

/**
 * 상담 후속 관리 탭 전용 섹션.
 *
 * Phase B에서 `page.tsx`에서 분리. 기존 상태·fetch는 `CrmPageInner`에 남아
 * 있고 props로 전달받는 구조. 컴포넌트 자체는 순수 표현 계층.
 */

export type CandidateItem = {
  normalizedPhone: string;
  customerName: string;
  customerContact: string;
  manager: string;
  analysisType: string;
  consultationDate: string;
  rawStatus: string;
  statusGroup: string;
  postConsultOrderCount: number;
  hasSupplementOrder: boolean;
  lastOrderDate: string | null;
  lastOrderProduct: string | null;
  hasLtr: boolean;
  recommendedAction: string;
};

export type CandidatesResponse = {
  ok: boolean;
  scenario: string;
  range: { startDate: string; endDate: string };
  windowDays: number;
  count: number;
  items: CandidateItem[];
};

export type ConsultSummary = {
  completed_consultations: number;
  unique_completed_customers: number;
  matched_order_customers: number;
  matured_customers: number;
  converted_customers: number;
  conversion_rate: number;
  avg_revenue_per_customer: number;
  baseline_avg_revenue_per_customer: number;
  estimated_incremental_revenue: number;
  estimated_value_per_consultation: number;
};

type ScenarioItem = { value: string; label: string; desc: string };

export type ActionLabelMap = Record<string, { label: string; color: string; channel?: string }>;
export type StatusLabelMap = Record<string, { label: string; color: string }>;

type Props = {
  candidateData: CandidatesResponse | null;
  candidateLoading: boolean;
  candidateError: string | null;
  managersData: Record<string, unknown>[] | null;
  managersLoading: boolean;
  managersError: string | null;
  orderMatchData: Record<string, unknown>[] | null;
  orderMatchLoading: boolean;
  orderMatchError: string | null;
  consultSummary: ConsultSummary | null;
  scenario: string;
  setScenario: (value: string) => void;
  limit: number;
  setLimit: (value: number) => void;
  scenarios: readonly ScenarioItem[];
  currentScenario: ScenarioItem | undefined;
  actionLabels: ActionLabelMap;
  statusLabels: StatusLabelMap;
  onSendMessage: (phone: string, name: string) => void;
};

export function ConsultationSection(props: Props) {
  const {
    candidateData,
    candidateLoading,
    candidateError,
    managersData,
    managersLoading,
    managersError,
    orderMatchData,
    orderMatchLoading,
    orderMatchError,
    consultSummary,
    scenario,
    setScenario,
    limit,
    setLimit,
    scenarios,
    currentScenario,
    actionLabels,
    statusLabels,
    onSendMessage,
  } = props;

  return (
    <>
      {/* 오늘 할 일 카드 */}
      {candidateData && candidateData.items.length > 0 && (
        <div style={{
          padding: "12px 18px", borderRadius: 10, marginBottom: 14,
          background: "#eff6ff", border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af" }}>
              오늘 후속 연락 대상: {candidateData.items.length}명
            </span>
            <span style={{ fontSize: "0.72rem", color: "#3b82f6", marginLeft: 8 }}>
              시나리오: {scenario === "completed_followup" ? "상담 완료 → 미구매" : "부재/변경 → 재연락"}
            </span>
          </div>
        </div>
      )}

      {/* 상담 현황 KPI 카드 */}
      {consultSummary && (
        <div className={styles.summaryGrid}>
          <SummaryCard
            label="완료 상담"
            value={fmtNum(consultSummary.completed_consultations) + "건"}
            sub={`고유 고객 ${fmtNum(consultSummary.unique_completed_customers)}명`}
          />
          <SummaryCard
            label="90일 전환율"
            value={fmtRatio(consultSummary.conversion_rate)}
            sub={`전환 ${fmtNum(consultSummary.converted_customers)}명 / 성숙 ${fmtNum(consultSummary.matured_customers)}명`}
            tone="success"
          />
          <SummaryCard
            label="상담 효과 추정 매출"
            value={fmtKRW(consultSummary.estimated_incremental_revenue)}
            sub={`상담 고객 ${fmtKRW(consultSummary.avg_revenue_per_customer)}/명 vs 미상담 ${fmtKRW(consultSummary.baseline_avg_revenue_per_customer)}/명`}
          />
          <SummaryCard
            label="상담 1건당 가치"
            value={fmtKRW(consultSummary.estimated_value_per_consultation)}
            sub="주문 매칭 고객 기준 추정치"
          />
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>후속 관리 대상</h2>
            <p className={styles.sectionDesc}>
              지금 바로 메시지나 재연락 액션을 할 고객 후보를 본다.
            </p>
          </div>
        </div>

        <div className={styles.scenarioSelector}>
          {scenarios.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`${styles.scenarioBtn} ${scenario === item.value ? styles.scenarioBtnActive : ""}`}
              onClick={() => setScenario(item.value)}
            >
              <strong>{item.label}</strong>
              <span className={styles.scenarioBtnDesc}>{item.desc}</span>
            </button>
          ))}
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>표시 건수</label>
            <select
              className={styles.controlSelect}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="표시 건수"
            >
              {[10, 20, 50, 100].map((count) => (
                <option key={count} value={count}>
                  {count}건
                </option>
              ))}
            </select>
          </div>
          {candidateData ? (
            <div className={styles.resultInfo}>
              조회 기간 {fmtDate(candidateData.range.startDate)} ~ {fmtDate(candidateData.range.endDate)}
              {" · "}윈도우 {candidateData.windowDays}일
              {" · "}총 {fmtNum(candidateData.count)}명
            </div>
          ) : null}
        </div>

        {candidateError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>{candidateError}</p>
          </div>
        ) : null}

        {candidateLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>후속 관리 대상을 불러오는 중...</p>
          </div>
        ) : null}

        {!candidateLoading && candidateData ? (
          candidateData.items.length === 0 ? (
            <div className={styles.empty}>해당 조건의 대상 고객이 없습니다.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHead}>
                    <th>고객명</th>
                    <th>연락처</th>
                    <th>상담사</th>
                    <th>검사 유형</th>
                    <th>상담일</th>
                    <th>상태</th>
                    <th className={styles.tableCellRight}>상담 후 주문</th>
                    <th>영양제 구매</th>
                    <th>마지막 주문</th>
                    <th>추천 액션</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateData.items.map((item) => {
                    const action =
                      actionLabels[item.recommendedAction] ?? {
                        label: item.recommendedAction,
                        color: "var(--color-text-muted)",
                      };

                    return (
                      <tr key={item.normalizedPhone} className={styles.tableRow}>
                        <td>
                          <strong>{item.customerName}</strong>
                        </td>
                        <td className={styles.phone}>{item.customerContact}</td>
                        <td>{item.manager}</td>
                        <td>{item.analysisType}</td>
                        <td>{fmtDate(item.consultationDate)}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              item.statusGroup === "completed"
                                ? styles.statusCompleted
                                : item.statusGroup === "no_answer"
                                  ? styles.statusNoAnswer
                                  : styles.statusOther
                            }`}
                          >
                            {statusLabels[item.statusGroup]?.label ?? item.rawStatus}
                          </span>
                        </td>
                        <td className={styles.tableCellRight}>{item.postConsultOrderCount}건</td>
                        <td>{item.hasSupplementOrder ? "O" : "-"}</td>
                        <td>{item.lastOrderDate ? fmtDate(item.lastOrderDate) : "-"}</td>
                        <td>
                          <span
                            className={styles.actionBadge}
                            style={{ borderColor: action.color, color: action.color }}
                          >
                            {action.label}
                          </span>
                          {"channel" in action && action.channel && (
                            <span style={{
                              marginLeft: 4, fontSize: "0.6rem", fontWeight: 600,
                              padding: "1px 4px", borderRadius: 3,
                              background: action.channel === "전화 우선" ? "#fef3c7" : "#eff6ff",
                              color: action.channel === "전화 우선" ? "#92400e" : "#3b82f6",
                            }}>{action.channel}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onSendMessage(item.normalizedPhone, item.customerName)}
                            style={{
                              marginLeft: 6, fontSize: "0.58rem", fontWeight: 600,
                              padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                              background: "#6366f1", color: "#fff", border: "none",
                            }}
                            title={`${item.customerContact}에게 알림톡 보내기`}
                          >
                            알림톡
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>

      {/* 상담사별 요약 섹션 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>상담사별 요약</h2>
            <p className={styles.sectionDesc}>
              상담사별 상담 건수와 전환 현황을 요약한다.
            </p>
          </div>
        </div>

        {managersLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>상담사 데이터를 불러오는 중...</p>
          </div>
        ) : managersError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>상담사 데이터를 불러올 수 없습니다</p>
            <p style={{ fontSize: "0.76rem", marginTop: 4 }}>{managersError}</p>
          </div>
        ) : !managersData || managersData.length === 0 ? (
          <div className={styles.empty}>상담사 데이터 없음</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  {Object.keys(managersData[0]!).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managersData.map((row, idx) => (
                  <tr key={idx} className={styles.tableRow}>
                    {Object.values(row).map((val, ci) => (
                      <td key={ci}>{val == null ? "-" : String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 주문 매칭 현황 섹션 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>주문 매칭 현황</h2>
            <p className={styles.sectionDesc}>
              상담 고객과 주문 데이터의 매칭 결과를 확인한다.
            </p>
          </div>
        </div>

        {orderMatchLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>주문 매칭 데이터를 불러오는 중...</p>
          </div>
        ) : orderMatchError ? (
          <div className={styles.errorBox}>
            <strong>오류</strong>
            <p>주문 매칭 데이터를 불러올 수 없습니다</p>
            <p style={{ fontSize: "0.76rem", marginTop: 4 }}>{orderMatchError}</p>
          </div>
        ) : !orderMatchData || orderMatchData.length === 0 ? (
          <div className={styles.empty}>주문 매칭 데이터 없음</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  {Object.keys(orderMatchData[0]!).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderMatchData.map((row, idx) => (
                  <tr key={idx} className={styles.tableRow}>
                    {Object.values(row).map((val, ci) => (
                      <td key={ci}>{val == null ? "-" : String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.interpretBlock}>
        <strong>{currentScenario?.label}</strong>
        <p>
          지금 탭은 사람 손이 바로 가야 하는 고객 리스트다. 실험 장부가 공항의 좌석표라면,
          여기는 오늘 바로 전화를 걸거나 채널톡 메시지를 보내야 하는 탑승 대기줄이다.
        </p>
      </section>
    </>
  );
}
