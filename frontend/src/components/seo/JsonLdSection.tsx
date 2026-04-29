"use client";

import { useState } from "react";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import WhyCallout from "./WhyCallout";
import Glossary from "./Glossary";
import ImpactBadge from "./ImpactBadge";
import type { JsonLdResponse } from "./seo.types";

type Props = {
  data: JsonLdResponse | null;
};

const SNIPPET_REASONS: Record<string, { what: string; why: string; where: string }> = {
  "종합 대사기능 분석 Product": {
    what: "종합 대사기능 분석 검사권을 '상품(Product)'으로 명시하고 가격·재고·이미지를 구조화한 기준 코드입니다.",
    why: "현재 공개 HTML에는 아임웹 자동 Product/Offer JSON-LD가 이미 확인됩니다. 이 샘플은 곧바로 중복 삽입하는 코드가 아니라, 자동 값이 틀렸을 때 비교·대체할 기준서로 봅니다.",
    where: "신규 Product를 추가하기보다 기존 아임웹 자동 Product 값과 화면 값이 맞는지 먼저 확인. 보강은 FAQPage/BreadcrumbList처럼 충돌이 적은 항목부터 검토.",
  },
  "바이오밸런스 Product": {
    what: "바이오밸런스 영양제를 '상품'으로 명시하고 가격·이미지를 구조화한 기준 코드.",
    why: "현재 공개 HTML에는 아임웹 자동 Product/Offer JSON-LD가 이미 확인됩니다. 추가 삽입보다는 자동 값의 상품명·가격·이미지가 실제 화면과 맞는지 검증하는 용도입니다.",
    where: "/HealthFood/?idx=97의 자동 Product 값 확인 후, 필요한 경우에만 충돌 없는 보강 항목을 별도로 적용.",
  },
  "건강정보 글 Article": {
    what: "건강정보 칼럼을 'Article(기사)'로 명시하고 제목·작성자·이미지를 구조화한 코드.",
    why: "구글 'Top stories'와 칼럼 리치 결과에 표시될 자격이 생깁니다. AI 검색이 우리 칼럼을 인용할 가능성도 높아집니다 (E-E-A-T 신호).",
    where: "/healthinfo/?bmode=view&idx=* 글 상세 페이지 <head>에 삽입.",
  },
  "바이오컴 Organization": {
    what: "회사 정보(이름·로고·홈페이지 URL)를 구조화한 코드.",
    why: "구글 'Knowledge Panel'(검색결과 우측의 회사 카드)이 정확한 정보로 뜨게 합니다. 'biocom' 검색 시 우리 로고가 함께 노출.",
    where: "홈페이지(/) <head>에 1번만 삽입.",
  },
  "BreadcrumbList 예시": {
    what: "페이지가 사이트 어디에 위치하는지 ('홈 > 상품 > 바이오밸런스') 경로를 구조화한 코드.",
    why: "검색결과 URL 위에 사이트 경로가 표시돼 사용자가 페이지 위치를 한 눈에 파악, 클릭률이 올라갑니다.",
    where: "각 상품/칼럼 페이지에 해당 경로로 맞춰서 삽입. JSON 안의 product/article 필드를 분리해서 페이지 유형별로 1개씩 사용.",
  },
};

const LIVE_STRUCTURED_DATA_NOTES: Record<string, { label: string; detail: string; tone: "good" | "warn" }> = {
  "종합 대사기능 분석 상품": {
    label: "공개 HTML 재확인: Product/Offer/평점/리뷰 JSON-LD 있음",
    detail: "아임웹 쇼핑 SEO 자동 설정으로 보이며, Rich Results Test 결과와 일치합니다. 신규 Product JSON-LD를 그대로 추가하면 중복·불일치 리스크가 있습니다.",
    tone: "good",
  },
  "바이오밸런스 상품": {
    label: "공개 HTML 재확인: Product/Offer JSON-LD 있음",
    detail: "상품명·가격·이미지 자동 스키마가 잡힙니다. 보강은 FAQPage/BreadcrumbList 중심으로 검토합니다.",
    tone: "good",
  },
  "건강정보 글": {
    label: "공개 HTML 재확인: NewsArticle/WebPage JSON-LD 있음",
    detail: "Article 계열 자동 스키마가 있으므로 작성자·이미지·본문 요약 값이 실제 화면과 맞는지 확인합니다.",
    tone: "good",
  },
};

export default function JsonLdSection({ data }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!data) {
    return (
      <section id="jsonld" className={styles.section}>
        <h2 className={styles.sectionH}>JSON-LD</h2>
        <p className={styles.sectionEmpty}>JSON-LD 데이터를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section id="jsonld" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>검색엔진 설명서 코드 <span className={styles.sectionHTech}>(JSON-LD · 구조화 데이터)</span></h2>
          <ImpactBadge variant="readonly" />
        </div>
        <span className={styles.sectionTag}>jsonld_validation_matrix.csv · jsonld_insertion_snippets.md</span>
      </div>

      <WhyCallout tone="info" title="검색엔진 설명서 코드가 뭐고 왜 필요한가요">
        <p style={{ marginBottom: 8 }}>
          <strong>검색엔진 설명서 코드(JSON-LD)</strong>는 페이지 안에 숨겨두는 작은 코드(<code>&lt;script type=「application/ld+json」&gt;</code>)입니다.
          사람 눈에는 안 보이지만, 검색엔진과 AI에게 「이 페이지는 상품이고, 가격은 X원, 평점은 Y, 작성자는 Z」처럼
          본문을 추측할 필요 없이 직접 정확하게 알려주는 역할을 합니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          <strong>없으면 무엇이 문제?</strong> 검색엔진은 본문 텍스트만 보고 추측하기 때문에 (1) 별점·가격·재고 같은
          <strong> 검색결과 부가 표시(Rich Results)가 안 뜨고</strong>, (2) 같은 노출수에서 다른 사이트 대비 클릭률이 떨어지고,
          (3) AI 검색(ChatGPT, Perplexity)이 우리 상품·칼럼을 인용할 가능성이 줄어듭니다.
        </p>
        <p>
          <strong>현재 상태</strong>: 2026-04-29 공개 HTML 재확인 기준, 아임웹이 자동으로 넣은 JSON-LD가 확인됩니다.
          이 화면의 목적은 “무조건 새 코드를 추가”가 아니라, 자동 스키마와 충돌하지 않게 무엇을 보강할지 판단하는 것입니다.
        </p>
      </WhyCallout>

      <WhyCallout tone="success" title="종합 대사기능 분석 상품 표기 정정">
        <p style={{ marginBottom: 8 }}>
          TJ님이 확인한 내용이 맞습니다. <strong>종합 대사기능 분석 상품에는 현재 JSON-LD가 있습니다.</strong>
          공개 HTML 기준 <code>application/ld+json</code> 스크립트 4개가 확인되고, Product, Offer, AggregateRating,
          Review 값이 Rich Results Test에 잡히는 상태입니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          기존 화면의 “JSON-LD 없음”은 2026-04-27 감사 CSV 기준이 남아 있던 표기입니다. 현재 판단은
          “구조화 데이터 없음”이 아니라 <strong>“아임웹 자동 상품 스키마가 있으므로 중복 삽입을 피하고 보강만 검토”</strong>입니다.
        </p>
        <p>
          참고로 Google은 JSON-LD를 권장하지만 Microdata, RDFa도 구조화 데이터로 읽습니다. 이번 종합 대사기능 페이지는
          실제 공개 HTML에서도 JSON-LD Product가 확인되므로, 아임웹 쇼핑 SEO 자동 설정으로 보는 것이 타당합니다.
        </p>
      </WhyCallout>

      <h3 className={styles.colH}>페이지별 권장 schema</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>페이지</th>
              <th>현재 명시 JSON-LD</th>
              <th>권장 작업</th>
              <th>현재 상태</th>
              <th>자신감</th>
            </tr>
          </thead>
          <tbody>
            {data.validation.map((v) => {
              const note = LIVE_STRUCTURED_DATA_NOTES[v.page];
              return (
                <tr key={v.url}>
                  <td>
                    <div className={styles.pageCellTitle}>{v.page}</div>
                    <a href={v.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>{v.url}</a>
                  </td>
                  <td>
                    <div className={v.jsonLdCount === 0 ? styles.cellDanger : styles.cellGood}>
                      {v.jsonLdCount}{v.jsonLdCount === 0 && " ⚠️ 없음"}
                    </div>
                    {note && (
                      <div className={styles.jsonLdCellNote} data-tone={note.tone}>
                        {note.label}
                      </div>
                    )}
                  </td>
                  <td>{v.recommendedSchema.split(",").map((s) => (
                    <span key={s} className={styles.schemaTag} title={`${s.trim()} 작업 권장`}>{s.trim()}</span>
                  ))}</td>
                  <td className={styles.pageCellMetaSmall}>
                    {v.blocker || "—"}
                    {note && <div className={styles.jsonLdStatusDetail}>{note.detail}</div>}
                  </td>
                  <td className={styles.confCell}>{v.confidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className={styles.colH} style={{ marginTop: 28 }}>운영 반영 전 체크</h3>
      <WhyCallout tone="warning">
        JSON-LD는 화면에 보이지 않지만 검색엔진이 본문에 적힌 값과 다른 정보를 보면 페널티를 줄 수 있습니다.
        실제 화면 값과 일치하는지 게시 전에 반드시 확인하세요.
      </WhyCallout>
      <ol className={styles.checkList}>
        {data.preChecks.map((c, i) => (
          <li key={i}><span className={styles.checkDot}>{i + 1}</span>{c}</li>
        ))}
      </ol>

      <h3 className={styles.colH} style={{ marginTop: 28 }}>삽입 스니펫 ({data.snippets.length}) <ImpactBadge variant="needs-approval" /></h3>
      <WhyCallout tone="warning">
        아래 5개 코드 블록은 「비어 있는 페이지에 바로 추가」가 아니라 <strong>현재 자동 JSON-LD와 비교할 기준 코드</strong>입니다.
        특히 상품 Product/Offer는 이미 아임웹 자동 값이 있으므로 그대로 중복 삽입하지 않습니다. 실제 사이트 게시는 운영 반영이라 별도 TJ 승인이 필요합니다.
        각 카드를 펼치면 무엇을, 왜, 어디에 넣어야 하는지 안내가 함께 나옵니다.
        게시 후에는{" "}
        <Glossary term="검색결과 부가 표시 검증 (Rich Results Test)" short="구글이 제공하는 무료 검증 도구.">
          search.google.com/test/rich-results 에 URL을 넣으면 검색엔진 설명서 코드가 잘 인식되는지 즉시 확인 가능.
        </Glossary>
        로 검증 → 구글 검색 콘솔에서 색인 요청 → 1~7일 안에 검색결과에 반영.
      </WhyCallout>
      <div className={styles.snippetList}>
        {data.snippets.map((s, idx) => {
          const open = openIdx === idx;
          const reason = SNIPPET_REASONS[s.title];
          return (
            <div key={s.title} className={styles.snippet}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                className={styles.snippetHead}
              >
                <div>
                  <div className={styles.snippetTitle}>{s.title}</div>
                  {s.source && <div className={styles.snippetSource}>{s.source}</div>}
                </div>
                <div className={styles.snippetActions}>
                  <CopyButton value={s.code} label="코드 복사" />
                  <span className={styles.snippetChevron}>{open ? "▲" : "▼"}</span>
                </div>
              </button>
              {open && (
                <div className={styles.snippetBody}>
                  {reason && (
                    <div className={styles.snippetReason}>
                      <div><strong>이게 뭐예요</strong> · {reason.what}</div>
                      <div><strong>왜 넣어요</strong> · {reason.why}</div>
                      <div><strong>어디에 넣어요</strong> · {reason.where}</div>
                    </div>
                  )}
                  <pre className={styles.snippetCode}>{s.code}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
