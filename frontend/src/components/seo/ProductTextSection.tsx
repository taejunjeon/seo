"use client";

import { useState } from "react";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import WhyCallout from "./WhyCallout";
import ImpactBadge from "./ImpactBadge";
import type { ProductDraft, ProductTextResponse } from "./seo.types";

type Props = {
  data: ProductTextResponse | null;
};

function buildPlainText(p: ProductDraft): string {
  const lines: string[] = [`# ${p.h1}`];
  for (const b of p.blocks) {
    lines.push("", `## ${b.heading}`, b.body);
  }
  if (p.faq.question) {
    lines.push("", "## 자주 묻는 질문", `Q. ${p.faq.question}`, `A. ${p.faq.answer}`);
  }
  return lines.join("\n");
}

export default function ProductTextSection({ data }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (!data) {
    return (
      <section id="product-text" className={styles.section}>
        <h2 className={styles.sectionH}>상품 텍스트</h2>
        <p className={styles.sectionEmpty}>상품 텍스트 데이터를 불러오지 못했습니다.</p>
      </section>
    );
  }

  const active = data.products.find((p) => p.key === activeKey) ?? data.products[0];

  return (
    <section id="product-text" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>상품 텍스트 초안 (콘텐츠팀 의뢰용)</h2>
          <ImpactBadge variant="draft" />
        </div>
        <span className={styles.sectionTag}>product_text_block_matrix.csv · product_text_block_drafts.md</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 무엇을 위한 것인가요">
        <p style={{ marginBottom: 8 }}>
          현재 상품 상세 페이지는 100장 가까운 통이미지로 만들어져서 사람은 읽지만
          <strong> 검색엔진과 AI는 「이 상품이 무엇이고 누구에게 좋은지」를 본문에서 읽지 못합니다</strong>.
          그래서 alt 누락 199개라는 진단이 나왔습니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          해결책은 통이미지 위·아래에 <strong>사용자에게도 보이는 짧은 텍스트 블록 4~5개</strong>를 추가하는 것입니다.
          숨김 텍스트(글자색 = 배경색, display:none 등)는 구글 페널티 대상이라 절대 사용하지 않습니다.
        </p>
        <p>
          아래 4개 카드는 <strong>검사권 2 + 영양제 2 = 시범 상품 4개</strong>의 H1/H2/H3/FAQ 구조 초안입니다.
          오른쪽 모바일 미리보기에서 사용자가 어떻게 보게 될지 확인하고,
          「텍스트 블록 전체 복사」 버튼으로 콘텐츠팀·디자인팀에 그대로 전달할 수 있습니다.
        </p>
      </WhyCallout>

      <div className={styles.productTabs}>
        {data.products.map((p) => {
          const isActive = (active && active.key === p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setActiveKey(p.key)}
              className={`${styles.productTab} ${isActive ? styles.productTabActive : ""}`}
            >
              <span className={styles.productTabBadge}>{p.pageType}</span>
              <span className={styles.productTabName}>{p.product}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className={styles.productLayout}>
          <div className={styles.productMeta}>
            <div>
              <div className={styles.productMetaLabel}>대상 URL</div>
              <a href={active.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>{active.url}</a>
            </div>
            <div>
              <div className={styles.productMetaLabel}>검색 의도 (이 상품을 찾는 사람)</div>
              <div className={styles.productMetaValue}>{active.searchIntent}</div>
            </div>
            <div>
              <div className={styles.productMetaLabel}>구조</div>
              <div className={styles.productMetaValue}>
                H1 1개 + H2 {active.blocks.length}개 + FAQ 1개. 통이미지 사이에 텍스트 블록으로 삽입하면 SEO 점수와 사용자 가독성이 함께 올라갑니다.
              </div>
            </div>
            <div className={styles.productCopyRow}>
              <CopyButton size="md" label="텍스트 블록 전체 복사" value={buildPlainText(active)} />
            </div>
          </div>

          <article className={styles.productPreview}>
            <div className={styles.productPreviewFrame}>
              <h1 className={styles.productH1}>{active.h1}</h1>
              {active.blocks.map((b, i) => (
                <div key={i} className={styles.productBlock}>
                  <h2 className={styles.productH2}>{b.heading}</h2>
                  <p className={styles.productBody}>{b.body}</p>
                </div>
              ))}
              {active.faq.question && (
                <div className={styles.productBlock}>
                  <h2 className={styles.productH2}>자주 묻는 질문</h2>
                  <div className={styles.faqQ}>Q. {active.faq.question}</div>
                  <div className={styles.faqA}>A. {active.faq.answer}</div>
                </div>
              )}
            </div>
            <div className={styles.productCaption}>375px 모바일 시뮬레이션 · 사용자에게 보이는 텍스트만 사용</div>
          </article>
        </div>
      )}

      <div className={styles.subSection}>
        <h3 className={styles.colH}>적용 원칙 (운영 반영 전 반드시 확인)</h3>
        <ul className={styles.principleList}>
          {data.principles.map((p, i) => (
            <li key={i}><span className={styles.principleDot}>·</span>{p}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
