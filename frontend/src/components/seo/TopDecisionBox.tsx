"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./seo.module.css";

type Notice = {
  key: "D";
  headline: string;
  status: string;
  evidence: string;
  conditions: string;
  detailItems: string[];
  notYetItems: string[];
};

const NOTICES: Notice[] = [
  {
    key: "D",
    headline: "완성 패키지의 구성품, 삽입 방법, 검증 기준은 아래 상세 섹션에 정리되어 있습니다.",
    status: "상태: 실행 패키지 생성 완료 · 운영 게시 전 검토 단계",
    evidence: "근거: 아임웹 자동 상품 JSON-LD 확인, 보이는 본문 보강 필요, alt 누락 199개",
    conditions: "실제 아임웹 게시, 사용자 코드 게시, Search Console 제출은 별도 승인",
    detailItems: [
      "상품 4개 본문 텍스트 초안",
      "기존 Product 스키마와 충돌하지 않는 Breadcrumb/FAQ 보강 코드",
      "아임웹 삽입 위치와 복사 순서",
      "Rich Results Test와 Search Console 확인 순서",
      "GSC canonical 매트릭스 기록표",
    ],
    notYetItems: [
      "아임웹 운영 화면에는 아직 게시하지 않았습니다.",
      "사용자 코드와 상품 상세 HTML은 아직 바꾸지 않았습니다.",
      "Search Console 제출은 실제 게시 후 별도 진행합니다.",
    ],
  },
];

export default function TopDecisionBox() {
  const [openKey, setOpenKey] = useState<"D" | null>(null);

  return (
    <section className={styles.decisionBox}>
      <div className={styles.decisionHead}>
        <div>
          <span className={styles.decisionLabel}>오늘 확인 포인트</span>
          <h2 className={styles.decisionTitle}>승인안 D 실행 패키지 준비 완료. 상세 정보는 아래에 정리했습니다.</h2>
          <Link href="/seo/url-cleanup" className={styles.decisionLinkBtn}>
            B 작업 요청서 화면 열기
          </Link>
        </div>
        <span className={styles.decisionSubInfo}>아래 P0 완성 패키지와 승인 현황 섹션에서 구성품을 먼저 확인하면 됩니다.</span>
      </div>
      <div className={styles.decisionGrid}>
        {NOTICES.map((d) => {
          const open = openKey === d.key;
          return (
            <article key={d.key} className={styles.decisionCard}>
              <div className={styles.decisionCardHead}>
                <span className={styles.decisionKey}>{d.key}</span>
                <div className={styles.decisionCardBody}>
                  <div className={styles.decisionQuestion}>{d.headline}</div>
                  <div className={styles.decisionRec}>
                    <span className={styles.decisionRecLabel}>안내</span>
                    {d.status}
                  </div>
                  <div className={styles.decisionEvidence}>{d.evidence}</div>
                  <div className={styles.decisionCond}>※ {d.conditions}</div>
                </div>
              </div>
              <div className={styles.decisionActions}>
                <Link href="#p0-confirm" className={styles.decisionPrimaryLink}>
                  아래 상세 정보 보기
                </Link>
                <button
                  type="button"
                  className={styles.decisionExpandBtn}
                  onClick={() => setOpenKey(open ? null : "D")}
                >
                  {open ? "상세 항목 접기" : "상세 항목 펼치기"}
                </button>
              </div>
              {open && (
                <div className={styles.decisionDetail}>
                  <div className={styles.decisionDetailCol}>
                    <div className={styles.decisionDetailLabel} data-tone="yes">아래에서 확인할 수 있는 것</div>
                    <ul>{d.detailItems.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div className={styles.decisionDetailCol}>
                    <div className={styles.decisionDetailLabel} data-tone="no">아직 진행하지 않은 것</div>
                    <ul>{d.notYetItems.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
