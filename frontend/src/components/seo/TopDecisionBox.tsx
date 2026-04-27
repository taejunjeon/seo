"use client";

import { useState } from "react";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";

type Decision = {
  key: "B" | "C";
  question: string;
  recommendation: string;
  conditions: string;
  yesAnswer: string;
  yesProduces: string[];
  noImpact: string[];
};

const DECISIONS: Decision[] = [
  {
    key: "B",
    question: "운영팀이 그대로 작업할 수 있는 URL 정리 요청서를 만들까요?",
    recommendation: "YES (운영 반영이 아니라 요청서 「초안」을 만드는 것입니다)",
    conditions: "리뷰/검색 URL의 검색결과 숨김(noindex)은 보류 가능",
    yesAnswer: "YES: URL 정리 요청서 만들기",
    yesProduces: [
      "아임웹 작업 요청서 1개 (어느 URL을 어떻게 처리할지 표 형식)",
      "URL 종류별 대표 URL 목록",
      "검색결과에서 숨길 URL 목록 (noindex 후보)",
      "검색엔진 제출 URL 목록에서 뺄 URL 목록 (sitemap 제외 후보)",
      "롤백 기준 (이렇게 되면 되돌리기)",
    ],
    noImpact: [
      "검색엔진 설명서 코드(JSON-LD)에 어느 URL을 적을지 결정 불가",
      "구글에 다시 제출할 URL 확정 지연",
      "구글 검색 성과 분석에서 같은 상품이 여러 줄로 흩어져 보고가 계속 부정확",
    ],
  },
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
  const [openKey, setOpenKey] = useState<"B" | "C" | null>(null);

  return (
    <section className={styles.decisionBox}>
      <div className={styles.decisionHead}>
        <div>
          <span className={styles.decisionLabel}>오늘 TJ님 결정 2개</span>
          <h2 className={styles.decisionTitle}>둘 다 운영 사이트 변경이 아니라, 「작업 요청서·초안」을 만들지 결정하는 것입니다.</h2>
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
                  onClick={() => setOpenKey(open ? null : d.key)}
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
