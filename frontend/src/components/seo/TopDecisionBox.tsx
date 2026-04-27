"use client";

import { useState } from "react";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";

type Decision = {
  key: "C";
  question: string;
  recommendation: string;
  conditions: string;
  yesAnswer: string;
  yesProduces: string[];
  noImpact: string[];
};

const DECISIONS: Decision[] = [
  {
    key: "C",
    question: "상품 4개 텍스트 초안을 콘텐츠팀에 검토 의뢰할까요?",
    recommendation: "YES (운영 반영이 아니라 콘텐츠팀이 다듬을 「초안」을 넘기는 것입니다)",
    conditions: "건강·검사 표현은 콘텐츠팀이 표시 가능 문구로 다듬어야 함",
    yesAnswer: "YES: 상품 4개 텍스트 초안 검토 의뢰",
    yesProduces: [
      "콘텐츠팀 요청서 1개 (상품 4개 H1/H2/H3/FAQ 구조 + 톤 가이드)",
      "각 상품별 검색 의도와 핵심 키워드",
      "건강·검사 표현 검수 체크리스트",
      "다듬어진 문구가 들어올 자리 (운영 반영은 별도 승인)",
    ],
    noImpact: [
      "통이미지 위주 상품 상세 페이지의 검색엔진 본문 인식 점수(현재 7/15) 정체",
      "「지연성 알러지 검사」 같은 검색 키워드의 클릭률 개선 지연",
      "AI 검색(ChatGPT, Perplexity)이 상품을 추천할 때 인용할 본문 부족",
    ],
  },
];

export default function TopDecisionBox() {
  const [openKey, setOpenKey] = useState<"C" | null>(null);

  return (
    <section className={styles.decisionBox}>
      <div className={styles.decisionHead}>
        <div>
          <span className={styles.decisionLabel}>오늘 TJ님 결정 1개 (B는 ✅ 완료)</span>
          <h2 className={styles.decisionTitle}>승인안 B는 진행 완료 — 산출물 6개 reports/seo/imweb_*.* 생성됨. 승인안 C만 남았습니다.</h2>
        </div>
        <span className={styles.decisionSubInfo}>아래 카드의 답변 코드를 복사해 채팅으로 회신하면 됩니다.</span>
      </div>
      <div className={styles.decisionGrid}>
        {DECISIONS.map((d) => {
          const open = openKey === d.key;
          return (
            <article key={d.key} className={styles.decisionCard}>
              <div className={styles.decisionCardHead}>
                <span className={styles.decisionKey}>{d.key}</span>
                <div className={styles.decisionCardBody}>
                  <div className={styles.decisionQuestion}>{d.question}</div>
                  <div className={styles.decisionRec}>
                    <span className={styles.decisionRecLabel}>추천</span>
                    {d.recommendation}
                  </div>
                  <div className={styles.decisionCond}>※ {d.conditions}</div>
                </div>
              </div>
              <div className={styles.decisionActions}>
                <CopyButton size="md" label={`YES 답변 복사 (${d.key})`} value={d.yesAnswer} />
                <button
                  type="button"
                  className={styles.decisionExpandBtn}
                  onClick={() => setOpenKey(open ? null : "C")}
                >
                  {open ? "▲ 결정 결과물 접기" : "▼ YES/NO 하면 무엇이 생기는지 보기"}
                </button>
              </div>
              {open && (
                <div className={styles.decisionDetail}>
                  <div className={styles.decisionDetailCol}>
                    <div className={styles.decisionDetailLabel} data-tone="yes">✅ YES 하면 생성되는 것</div>
                    <ul>{d.yesProduces.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div className={styles.decisionDetailCol}>
                    <div className={styles.decisionDetailLabel} data-tone="no">⚠️ NO 하면 발생하는 일</div>
                    <ul>{d.noImpact.map((x) => <li key={x}>{x}</li>)}</ul>
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
