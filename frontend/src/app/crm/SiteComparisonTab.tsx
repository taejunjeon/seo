"use client";

import styles from "./page.module.css";

export function SiteComparisonTab() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>사이트별 핵심 지표 비교</h2>
          <p className={styles.sectionDesc}>
            바이오컴, 더클린커피, AIBIO의 현황을 한 눈에 비교한다.
          </p>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th>지표</th>
              <th className={styles.tableCellRight}>바이오컴</th>
              <th className={styles.tableCellRight}>더클린커피</th>
              <th className={styles.tableCellRight}>AIBIO</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.tableRow}>
              <td><strong>회원 수</strong></td>
              <td className={styles.tableCellRight}>69,681명</td>
              <td className={styles.tableCellRight}>13,236명</td>
              <td className={styles.tableCellRight}>100명</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>비즈니스 모델</strong></td>
              <td className={styles.tableCellRight}>검사 → 상담 → 영양제</td>
              <td className={styles.tableCellRight}>스페셜티 커피 판매</td>
              <td className={styles.tableCellRight}>바이오해킹 체험</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>SMS 수신 동의</strong></td>
              <td className={styles.tableCellRight}>47.5%</td>
              <td className={styles.tableCellRight}>확인 필요</td>
              <td className={styles.tableCellRight}>-</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>상담 서비스</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>있음 (8,305건)</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>없음</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>없음</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>Meta 광고</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>미집행</td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>집행 중 (A+SC 2개)</td>
              <td className={styles.tableCellRight} style={{ color: "#6366f1", fontWeight: 600 }}>₩148만/월</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>결제 추적</strong></td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>Toss live</td>
              <td className={styles.tableCellRight} style={{ color: "#16a34a", fontWeight: 600 }}>live 3건</td>
              <td className={styles.tableCellRight} style={{ color: "#94a3b8" }}>대기 중</td>
            </tr>
            <tr className={styles.tableRow}>
              <td><strong>CRM 핵심 시나리오</strong></td>
              <td className={styles.tableCellRight}>상담 후 미구매 후속</td>
              <td className={styles.tableCellRight}>재구매 유도</td>
              <td className={styles.tableCellRight}>광고 유입 → 방문 전환</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className={styles.interpretBlock} style={{ marginTop: 18 }}>
        <strong>사이트별로 CRM 전략이 다르다</strong>
        <p>
          바이오컴은 상담 기반(상담 → 후속 → 재구매), 더클린커피는 커머스 기반(구매 → 재구매),
          AIBIO는 광고 기반(광고 → 리드 → 방문)이다. 각 사이트 탭을 클릭하면 해당 전략에 맞는 화면을 본다.
        </p>
      </section>
    </section>
  );
}
