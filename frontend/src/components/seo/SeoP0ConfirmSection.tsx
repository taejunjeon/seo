"use client";

import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import ImpactBadge from "./ImpactBadge";
import WhyCallout from "./WhyCallout";
import type { JsonLdResponse, ProductDraft, ProductTextResponse } from "./seo.types";

type Props = {
  productText: ProductTextResponse | null;
  jsonld: JsonLdResponse | null;
};

type ProductPackageMeta = {
  key: string;
  displayName: string;
  jsonLdPlan: string;
  evidence: string;
  risk: string;
  confidence: number;
};

type CanonicalCheckRow = {
  group: string;
  url: string;
  expected: string;
  why: string;
  confidence: number;
};

const YES_ANSWER = "YES: 완성 패키지 확인 완료, 아임웹 삽입 준비 진행";
const NO_ANSWER = "NO: 완성 패키지 수정 필요";

const PACKAGE_FILES = [
  {
    title: "상품 4개 SEO/AEO 최종 실행 패키지",
    path: "reports/seo/seo_aeo_execution_package.md",
    description: "보이는 본문 텍스트, JSON-LD, 삽입 방법, 롤백 기준을 묶은 운영 전 최종 검토 문서",
  },
  {
    title: "GSC canonical 검사 매트릭스",
    path: "reports/seo/gsc_canonical_check_matrix.md",
    description: "Search Console URL 검사에서 Google 선택 canonical을 기록할 10개 URL 표",
  },
];

const INSERTION_STEPS = [
  {
    title: "1. 아임웹에 넣습니다",
    body: "JSON-LD는 구글에 직접 넣는 코드가 아닙니다. 아임웹 상품 페이지의 HTML 또는 사용자 코드 영역에 넣습니다.",
    owner: "아임웹",
  },
  {
    title: "2. 구글이 읽습니다",
    body: "구글이 해당 상품 페이지를 다시 크롤링하면서 페이지 안의 JSON-LD를 읽고 상품, 가격, FAQ를 이해합니다.",
    owner: "Google",
  },
  {
    title: "3. 테스트 도구로 확인합니다",
    body: "Google Rich Results Test에 URL을 넣어 Product, Breadcrumb, FAQ가 오류 없이 인식되는지 확인합니다.",
    owner: "Rich Results Test",
  },
  {
    title: "4. Search Console에 요청합니다",
    body: "URL 검사에서 색인 요청을 하고, Google이 선택한 canonical을 10개 매트릭스에 기록합니다.",
    owner: "GSC",
  },
];

const PRODUCT_META: ProductPackageMeta[] = [
  {
    key: "organicacid",
    displayName: "종합 대사기능 분석",
    jsonLdPlan: "Product + Offer + BreadcrumbList + FAQPage",
    evidence: "본문 초안 있음, Product JSON-LD 샘플 있음, 가격 후보 있음",
    risk: "검사 진행 방식과 최신 가격 문구만 운영 전 재확인",
    confidence: 86,
  },
  {
    key: "igg",
    displayName: "음식물 과민증 분석",
    jsonLdPlan: "Product + Offer + BreadcrumbList + FAQPage",
    evidence: "본문 초안 있음, FAQ 후보 있음, 검사 표현 검수가 필요함",
    risk: "알레르기 진단처럼 보이는 표현 금지",
    confidence: 78,
  },
  {
    key: "biobalance",
    displayName: "바이오밸런스",
    jsonLdPlan: "Product + Offer + BreadcrumbList + FAQPage",
    evidence: "본문 초안 있음, Product JSON-LD 샘플 있음, 가격 후보 있음",
    risk: "성분표와 섭취 안내를 최신 상세페이지 기준으로 재확인",
    confidence: 86,
  },
  {
    key: "neuromaster",
    displayName: "뉴로마스터",
    jsonLdPlan: "Product + Offer + BreadcrumbList + FAQPage",
    evidence: "본문 초안 있음, FAQ 후보 있음, Product JSON-LD 신규 작성 필요",
    risk: "집중력 개선 단정 표현 금지",
    confidence: 76,
  },
];

const FALLBACK_PRODUCTS: ProductDraft[] = PRODUCT_META.map((m) => ({
  key: m.key,
  product: m.displayName,
  url: "https://biocom.kr/",
  pageType: m.key === "organicacid" || m.key === "igg" ? "검사권" : "영양제",
  searchIntent: "검색엔진과 AI가 상품의 대상 고객, 확인 내용, FAQ를 읽을 수 있게 만드는 시범 대상",
  h1: m.displayName,
  blocks: [],
  faq: { question: "운영 반영 전 무엇을 확인하나요?", answer: "최신 상품 정보, 표시 가능 문구, 가격, 재고, FAQ 공개 여부를 확인합니다." },
}));

const CANONICAL_ROWS: CanonicalCheckRow[] = [
  {
    group: "홈 대표 URL",
    url: "https://biocom.kr/",
    expected: "Google 선택 canonical도 https://biocom.kr/ 인지 확인",
    why: "홈이 가장 강한 브랜드 URL이라 /index나 정책 모드 URL로 신호가 나뉘면 안 됩니다.",
    confidence: 88,
  },
  {
    group: "홈 /index 별칭",
    url: "https://biocom.kr/index",
    expected: "Google 선택 canonical이 홈으로 모이는지 확인",
    why: "아임웹에서 직접 301을 못 걸어도 구글이 홈을 대표로 선택하는지 봐야 합니다.",
    confidence: 82,
  },
  {
    group: "종합 대사기능 분석 공식 URL",
    url: "https://biocom.kr/organicacid_store/?idx=259",
    expected: "공식 판매 URL 또는 Google 선택 URL 기록",
    why: "현재 상품 URL과 /shop_view 변형이 함께 존재해 실제 대표 URL 확인이 필요합니다.",
    confidence: 78,
  },
  {
    group: "종합 대사기능 분석 shop_view 변형",
    url: "https://biocom.kr/shop_view/?idx=259",
    expected: "공식 URL과 같은 페이지로 판단되는지 확인",
    why: "기획전 위젯 등에서 자동 생성된 URL이 검색에 남을 수 있습니다.",
    confidence: 76,
  },
  {
    group: "음식물 과민증 공식 URL",
    url: "https://biocom.kr/igg_store/?idx=85",
    expected: "공식 판매 URL 또는 Google 선택 URL 기록",
    why: "검사권 2개 중 하나라 JSON-LD와 대표 URL이 반드시 맞아야 합니다.",
    confidence: 78,
  },
  {
    group: "음식물 과민증 shop_view 변형",
    url: "https://biocom.kr/shop_view/?idx=85",
    expected: "공식 URL과 같은 페이지로 판단되는지 확인",
    why: "아임웹 자동 canonical 한계를 실제 검색 콘솔에서 확인하는 행입니다.",
    confidence: 76,
  },
  {
    group: "바이오밸런스 공식 URL",
    url: "https://biocom.kr/HealthFood/?idx=97",
    expected: "Google 선택 canonical이 같은 URL인지 확인",
    why: "영양제 대표 시범 상품이며 기존 Product JSON-LD 샘플이 있습니다.",
    confidence: 84,
  },
  {
    group: "바이오밸런스 shop_view 변형",
    url: "https://biocom.kr/shop_view/?idx=97",
    expected: "HealthFood URL로 모이는지 확인",
    why: "같은 상품의 변형 URL이 검색 노출을 나눌 수 있습니다.",
    confidence: 78,
  },
  {
    group: "뉴로마스터 공식 URL",
    url: "https://biocom.kr/HealthFood/?idx=198",
    expected: "Google 선택 canonical이 같은 URL인지 확인",
    why: "신규 Product JSON-LD 작성 대상이라 대표 URL을 먼저 고정해 기록해야 합니다.",
    confidence: 82,
  },
  {
    group: "건강정보 칼럼 시범 URL",
    url: "https://biocom.kr/healthinfo/?bmode=view&idx=5764202",
    expected: "칼럼 Article URL의 Google 선택 canonical 기록",
    why: "AEO 확장 때 Article/FAQ 구조의 기준 URL로 재사용합니다.",
    confidence: 80,
  },
];

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.p0Confidence}>
      <div className={styles.p0ConfidenceText}>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className={styles.p0ConfidenceBar}>
        <div style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function findProduct(products: ProductDraft[], key: string): ProductDraft {
  return products.find((p) => p.key === key) ?? FALLBACK_PRODUCTS.find((p) => p.key === key) ?? FALLBACK_PRODUCTS[0];
}

export default function SeoP0ConfirmSection({ productText, jsonld }: Props) {
  const products = productText?.products.length ? productText.products : FALLBACK_PRODUCTS;
  const jsonLdSnippetCount = jsonld?.snippets.length ?? 0;

  return (
    <section id="p0-confirm" className={styles.section}>
      <div className={styles.p0Hero}>
        <div className={styles.p0HeroMain}>
          <span className={styles.p0Eyebrow}>P0 완성 패키지</span>
          <h2 className={styles.p0HeroTitle}>
            최종 실행 패키지를 만들었습니다. 다음은 아임웹 삽입 전 확인입니다.
          </h2>
          <p className={styles.p0HeroBody}>
            상품 4개 본문 텍스트, Product/Breadcrumb/FAQ JSON-LD, 삽입 방법, 롤백 기준, GSC canonical 검사표를
            최종 실행 패키지로 정리했습니다. 실제 아임웹 게시와 Search Console 제출은 운영 영향이 있으므로 이 화면 확인 뒤 별도 진행합니다.
          </p>
          <code className={styles.p0AnswerCode}>{YES_ANSWER}</code>
          <div className={styles.p0ActionRow}>
            <CopyButton size="md" label="YES 답변 복사" value={YES_ANSWER} />
            <CopyButton size="md" label="NO 답변 복사" value={NO_ANSWER} />
          </div>
        </div>
        <div className={styles.p0HeroAside}>
          <div className={styles.p0EvidenceLabel}>완성 패키지 생성됨</div>
          <ConfidenceMeter value={82} label="추천 자신감" />
          <div className={styles.p0EvidenceList}>
            <div>강한 근거: 핵심 6개 페이지 JSON-LD 0개</div>
            <div>강한 근거: 상품 상세 이미지 의존과 alt 누락 199개</div>
            <div>보조 근거: robots.txt 공개 적용 완료</div>
            <div>주의: 실제 게시 전 상품 가격·문구 최종 확인 필요</div>
          </div>
        </div>
      </div>

      <div className={styles.p0DecisionGrid}>
        <article className={styles.p0DecisionCard} data-priority="p0">
          <div className={styles.p0DecisionHead}>
            <span className={styles.p0Priority}>P0</span>
            <ImpactBadge variant="draft" />
          </div>
          <h3>생성된 최종 실행 패키지</h3>
          <p>
            보이는 본문 텍스트, Product/Breadcrumb/FAQ JSON-LD, 아임웹 삽입 순서, 롤백 기준을 하나의 운영 전 검토 문서로 묶었습니다.
          </p>
          <ConfidenceMeter value={82} label="완성 패키지 자신감" />
        </article>

        <article className={styles.p0DecisionCard} data-priority="p0">
          <div className={styles.p0DecisionHead}>
            <span className={styles.p0Priority}>P0</span>
            <ImpactBadge variant="needs-approval" />
          </div>
          <h3>GSC URL 검사 10개 canonical 매트릭스</h3>
          <p>
            아임웹에서 canonical과 301을 직접 바꾸기 어려우므로, Google이 실제로 어떤 URL을 대표로 선택하는지
            Search Console 기준으로 기록할 표를 만들었습니다.
          </p>
          <ConfidenceMeter value={78} label="검사 매트릭스 자신감" />
        </article>
      </div>

      <div className={styles.p0FileGrid}>
        {PACKAGE_FILES.map((file) => (
          <article key={file.path} className={styles.p0FileCard}>
            <span className={styles.p0FileLabel}>산출물</span>
            <h3>{file.title}</h3>
            <code>{file.path}</code>
            <p>{file.description}</p>
          </article>
        ))}
      </div>

      <WhyCallout tone="info" title="JSON-LD와 canonical을 쉬운 말로 정리하면">
        <p>
          검색엔진 설명서 코드(JSON-LD)는 검색엔진과 AI에게 이 페이지가 어떤 상품인지, 가격과 FAQ가 무엇인지 알려주는 코드입니다.
          대표 URL(canonical)은 같은 상품 URL이 여러 개일 때 Google이 어느 주소를 진짜로 볼지 정하는 기준입니다.
          이번 화면은 완성 패키지를 운영에 넣기 전, 삽입 위치와 검증 순서를 확인하기 위한 화면입니다.
        </p>
      </WhyCallout>

      <div className={styles.subSection}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.colH}>JSON-LD 삽입 방법</h3>
          </div>
          <span className={styles.sectionTag}>아임웹에 삽입 → 구글이 읽음 → Search Console에서 확인</span>
        </div>
        <div className={styles.p0InsertGrid}>
          {INSERTION_STEPS.map((step) => (
            <article key={step.title} className={styles.p0InsertCard}>
              <span>{step.owner}</span>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <WhyCallout tone="warning" title="중요">
          구글에 코드를 업로드하는 방식이 아닙니다. 코드는 아임웹 페이지에 들어가고, 구글은 그 페이지를 다시 읽습니다.
          따라서 게시 후 Rich Results Test와 Search Console URL 검사까지 해야 작업이 닫힙니다.
        </WhyCallout>
      </div>

      <div className={styles.subSection}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.colH}>상품/검사권 4개 최종 패키지 요약</h3>
          </div>
          <span className={styles.sectionTag}>
            product_text_block_matrix.csv · JSON-LD 스니펫 {jsonLdSnippetCount}개
          </span>
        </div>
        <div className={styles.p0ProductGrid}>
          {PRODUCT_META.map((meta) => {
            const product = findProduct(products, meta.key);
            const blockCount = product.blocks.length;
            return (
              <article key={meta.key} className={styles.p0ProductCard}>
                <div className={styles.p0ProductTop}>
                  <div>
                    <span className={styles.p0ProductType}>{product.pageType}</span>
                    <h4>{product.product}</h4>
                  </div>
                  <span className={styles.p0StatusBadge}>검토 후 진행</span>
                </div>
                <a href={product.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>
                  {product.url}
                </a>
                <dl className={styles.p0DefinitionList}>
                  <div>
                    <dt>보이는 본문</dt>
                    <dd>H1 1개, H2 {blockCount}개, FAQ 1개 초안 준비</dd>
                  </div>
                  <div>
                    <dt>검색엔진 설명서 코드</dt>
                    <dd>{meta.jsonLdPlan}</dd>
                  </div>
                  <div>
                    <dt>근거</dt>
                    <dd>{meta.evidence}</dd>
                  </div>
                  <div>
                    <dt>주의</dt>
                    <dd>{meta.risk}</dd>
                  </div>
                </dl>
                <ConfidenceMeter value={meta.confidence} label="상품별 자신감" />
              </article>
            );
          })}
        </div>
      </div>

      <div className={styles.subSection}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.colH}>GSC URL 검사 10개 canonical 매트릭스</h3>
          </div>
          <span className={styles.sectionTag}>Search Console URL 검사 화면에서 확인 필요</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>검사 대상</th>
                <th>URL</th>
                <th>확인할 것</th>
                <th>왜 필요한가</th>
                <th>자신감</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_ROWS.map((row) => (
                <tr key={row.url}>
                  <td>
                    <div className={styles.pageCellTitle}>{row.group}</div>
                    <div className={styles.pageCellSub}>사람 검토 후 기록</div>
                  </td>
                  <td>
                    <a href={row.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>
                      {row.url}
                    </a>
                  </td>
                  <td className={styles.pageCellMetaSmall}>{row.expected}</td>
                  <td className={styles.pageCellMetaSmall}>{row.why}</td>
                  <td className={styles.confCell}>{row.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
