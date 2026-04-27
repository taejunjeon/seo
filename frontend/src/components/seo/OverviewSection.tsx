"use client";

import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import Glossary from "./Glossary";
import ImpactBadge from "./ImpactBadge";
import type { AuditResponse } from "./seo.types";

type Props = {
  audit: AuditResponse | null;
};

function barColor(score: number, max: number): string {
  if (max === 0) return "var(--color-text-muted)";
  const ratio = score / max;
  if (ratio >= 0.75) return "var(--color-success)";
  if (ratio >= 0.4) return "var(--color-accent)";
  return "var(--color-danger)";
}

const SCORE_REASONS: Record<string, { what: string; why: string; how: string }> = {
  "URL/Canonical": {
    what: "같은 페이지가 여러 URL로 노출되면 검색엔진이 어느 URL을 대표로 선택할지 헷갈립니다. 그 헷갈림을 막아주는 표시가 canonical 태그입니다.",
    why: "URL 인벤토리 300개 중 53개(17.7%)가 ?idx= ?q= 같은 parameter URL이고, 중복 의심 그룹이 4개 있습니다. 핵심 6개 페이지에는 canonical이 다 있지만, 같은 상품을 가리키는 다른 URL들의 canonical 목적지는 아직 정리가 안 되어서 일부 감점.",
    how: "URL 정책 매트릭스(아래 'URL 정책' 섹션)에서 유형별로 canonical/sitemap/noindex 정책을 확정하면 12 → 18점 구간까지 회복 가능.",
  },
  "Indexing/Sitemap/Robots": {
    what: "robots.txt(검색엔진에게 보여줄 페이지 안내)와 sitemap.xml(전체 URL 목록)이 정상 응답하는지, 색인하지 말아야 할 URL이 섞여 있는지 봅니다.",
    why: "robots.txt 200, sitemap 200, sitemap URL 239개에 parameter URL이 0개로 깨끗합니다. 만점.",
    how: "현재 만점 유지. 단 robots.txt sitemap 지시문 1줄이 Markdown 링크 형식([https://...](https://...))이라 일반 URL 형식으로 바꾸는 정리가 권장됩니다.",
  },
  "On-page SEO": {
    what: "각 페이지의 title, description, OG 태그, h1/h2/h3 헤딩 구조 같은 '페이지 안에 있는 SEO 신호'들을 평가합니다.",
    why: "핵심 6개 페이지 모두 title·description·canonical·OG는 있고, 본문 헤딩 구조도 어느 정도 잡혀 있습니다. 다만 홈페이지 title이 4자(\"바이오컴\")로 너무 짧고, 건강정보 목록 페이지는 description이 9자로 거의 비어 있어 감점.",
    how: "title 30~60자, description 70~160자 권장. 페이지 SEO 점검표(이 화면 아래쪽)에서 현재 길이 확인 가능.",
  },
  "Structured Data": {
    what: "JSON-LD라는 작은 코드 블록을 페이지에 넣어 '이 페이지는 상품이고, 가격은 X원, 평점은 Y'처럼 검색엔진이 바로 이해할 수 있게 알려주는 작업입니다.",
    why: "핵심 6개 페이지 JSON-LD가 0개입니다. 즉 검색엔진이 우리 상품·검사권·칼럼 정보를 본문 텍스트만 보고 추측해야 합니다. 15점 만점에 3점은 sitemap·robots 같은 기본기 점수만 받고 나머지 영역은 0점.",
    how: "'JSON-LD' 섹션의 5개 삽입 스니펫을 GTM이나 사용자 코드로 게시하면 12점까지 회복 가능. Product/Article/BreadcrumbList가 핵심.",
  },
  "Content Readability for Search/AI": {
    what: "검색엔진과 AI(ChatGPT, Perplexity 등)가 본문 내용을 읽고 이해할 수 있는지. 통이미지로만 만들어진 페이지는 사람은 읽지만 검색엔진은 못 읽습니다.",
    why: "상품 상세 2개(종합 대사기능 분석, 바이오밸런스)에서 본문이 100장 가까운 이미지에 의존, alt 텍스트가 199개 빠져 있음. 검색엔진은 사실상 상품 설명을 못 읽는 상태.",
    how: "상품 텍스트 섹션의 4개 H1/H2/H3/FAQ 블록을 사용자에게도 보이는 텍스트로 추가하면 7점 → 13점 회복 가능.",
  },
  "Performance": {
    what: "모바일 PageSpeed 점수, 페이지 로딩 속도(LCP, CLS), 이미지·JS 용량 등 속도 관련 지표.",
    why: "이번 라운드에서 PageSpeed API를 호출하지 않고 Playwright 리소스 관측만 했기 때문에 0점 처리. 실제로 느리다는 의미가 아니라 '아직 측정 안 함'.",
    how: "메인 대시보드의 'CWV' 탭에서 Google PageSpeed API로 실측 가능. 모바일 60~80점이면 9~12점 환산 가능. 사이트 부하 관측 결과 366요청 등 무거운 편이라 이미지 lazy loading·압축이 필요.",
  },
};

const PROBLEM_DETAILS: Record<number, { why: string; impact: string; action: string }> = {
  1: {
    why: "?idx=, ?q=, ?bmode=view 같은 query string으로만 다른 URL이 17.7%를 차지합니다. 같은 상품을 가리키는 URL이 여러 개라는 뜻.",
    impact: "검색엔진이 \"어느 URL이 진짜 대표인가\"를 헷갈려서 클릭이 분산되고, GSC 분석에서도 같은 페이지 성과가 여러 줄로 흩어져서 보고가 부정확해집니다.",
    action: "URL 정책 매트릭스의 정책안 A로 canonical을 통일하고, 잡음 parameter URL은 sitemap 제외 + noindex 처리.",
  },
  2: {
    why: "본문 hash와 URL 패턴 분석에서 거의 같은 내용을 가진 URL 그룹 4개(홈페이지 ?mode=*, /login back_url=*, /site_join_pattern_choice, /?q=* 검색결과 페이지네이션)를 찾았습니다.",
    impact: "구글 색인 예산이 의미 없는 URL에 낭비되고, 사용자 검색 결과에 잡음 URL이 떠서 클릭률이 떨어집니다.",
    action: "중복 그룹 카드(URL 정책 섹션)에서 각 그룹별로 대표 URL을 정하고 나머지는 noindex.",
  },
  3: {
    why: "핵심 페이지 6개에는 canonical이 다 있지만, '/index', '?mode=privacy', '/organicacid', '/organicacid_store', '/organicacid_store/?idx=259' 처럼 같은 상품을 가리키는 여러 URL의 canonical 목적지가 일관되지 않을 가능성이 있습니다.",
    impact: "구글이 우리가 의도한 대표 URL이 아닌 다른 URL을 색인할 수 있고, 그러면 SEO 작업·내부 링크·sitemap의 효과가 흩어집니다.",
    action: "URL 정책 매트릭스에서 상품/검사권 유형별로 canonical 목적지 1개를 확정하고, 모든 내부 링크·JSON-LD url을 그 1개에 맞춥니다.",
  },
  4: {
    why: "홈, 서비스, 종합 대사기능 분석, 바이오밸런스, 건강정보 목록, 건강정보 글 — 6개 핵심 페이지 모두 JSON-LD 코드가 0개입니다.",
    impact: "구글 검색 결과에 별점·가격·이미지·FAQ 같은 '리치 결과(Rich Results)'가 안 뜹니다. 같은 키워드로 노출돼도 다른 사이트보다 클릭률이 떨어지고, AI 검색(ChatGPT, Perplexity)이 우리 상품 정보를 인용할 가능성도 낮아집니다.",
    action: "JSON-LD 섹션의 5개 스니펫(Product 2개, Article 1개, Organization 1개, BreadcrumbList 1개)을 시범 삽입.",
  },
  5: {
    why: "상품 상세 페이지 2개를 분석한 결과 alt 없는 이미지가 199개, 본문 텍스트가 거의 없는 통이미지 위주 구조입니다.",
    impact: "검색엔진이 \"이 상품이 무엇이고 누구에게 좋은지\"를 본문에서 읽을 수 없어서, 키워드 매칭이 약해집니다. 또 시각장애 사용자 접근성도 떨어집니다.",
    action: "상품 텍스트 섹션의 H2/H3/FAQ 블록 4개를 사용자에게 보이는 텍스트로 추가 + 핵심 이미지에 alt 작성.",
  },
};

export default function OverviewSection({ audit }: Props) {
  if (!audit) {
    return (
      <section id="overview" className={styles.section}>
        <h2 className={styles.sectionH}>종합 점수</h2>
        <p className={styles.sectionEmpty}>감사 데이터를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section id="overview" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>종합 점수</h2>
          <ImpactBadge variant="readonly" />
        </div>
        <span className={styles.sectionTag}>seo_audit_summary.md</span>
      </div>

      <WhyCallout tone="info" title="이 점수는 무엇인가요">
        100점 만점의 SEO 진단 점수입니다. 6개 항목으로 나눠서 평가했고, 각 항목 옆에 <strong>왜 이 점수인지</strong>의 설명을 붙였습니다.
        점수는 운영 사이트를 바꾸지 않고 공개 URL만 읽어서 매긴 것이라, 우리가 어디서 점수를 잃었는지 한눈에 보여주는 진단표입니다.
      </WhyCallout>

      <div className={styles.scoreGrid}>
        {audit.scores.map((s) => {
          const ratio = s.max > 0 ? (s.score / s.max) * 100 : 0;
          const reason = SCORE_REASONS[s.label];
          return (
            <div key={s.label} className={styles.scoreItem}>
              <div className={styles.scoreItemTop}>
                <span className={styles.scoreItemLabel}>{s.label}</span>
                <span className={styles.scoreItemValue}>{s.score}<span className={styles.scoreItemMax}>/{s.max}</span></span>
              </div>
              <div className={styles.scoreItemBar}>
                <div className={styles.scoreItemBarFill} style={{ width: `${ratio}%`, background: barColor(s.score, s.max) }} />
              </div>
              {reason && (
                <div className={styles.scoreReason}>
                  <div><strong>이게 뭐예요</strong> · {reason.what}</div>
                  <div><strong>왜 이 점수예요</strong> · {reason.why}</div>
                  <div><strong>어떻게 올려요</strong> · {reason.how}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.problemGrid}>
        <div className={styles.problemCol}>
          <h3 className={styles.colH}>가장 큰 문제 5개 (왜 문제인지 함께)</h3>
          <ol className={styles.problemList}>
            {audit.problems.map((p, i) => {
              const detail = PROBLEM_DETAILS[i + 1];
              return (
                <li key={i} className={styles.problemItem}>
                  <div className={styles.problemHead}>
                    <span className={styles.problemDot}>{i + 1}</span>
                    <span className={styles.problemTitle}>{p}</span>
                  </div>
                  {detail && (
                    <div className={styles.problemBody}>
                      <div><span className={styles.problemTag}>왜</span>{detail.why}</div>
                      <div><span className={styles.problemTag}>영향</span>{detail.impact}</div>
                      <div><span className={styles.problemTag}>해결</span>{detail.action}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div className={styles.problemCol}>
          <h3 className={styles.colH}>오늘 / 이번 주 / 다음 배치</h3>
          <div className={styles.actionStack}>
            <div className={styles.actionGroup}>
              <span className={styles.actionTag} data-tone="urgent">오늘</span>
              <ul>{audit.todayActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
            <div className={styles.actionGroup}>
              <span className={styles.actionTag} data-tone="opportunity">이번 주</span>
              <ul>{audit.weekActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
            <div className={styles.actionGroup}>
              <span className={styles.actionTag} data-tone="recommend">다음 배치</span>
              <ul>{audit.nextActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.subSection}>
        <h3 className={styles.colH}>핵심 6개 페이지 상세</h3>
        <WhyCallout tone="info">
          이 표는 진단의 기준이 된 6개 대표 페이지의 메타 정보입니다.{" "}
          <Glossary term="title" short="검색 결과에 굵은 글씨로 뜨는 페이지 제목. 권장 30~60자.">너무 짧으면 검색엔진이 페이지 주제를 못 잡고, 너무 길면 검색결과에서 잘립니다.</Glossary>,{" "}
          <Glossary term="description" short="검색 결과에서 title 아래 회색 글씨로 뜨는 요약문. 권장 70~160자.">CTR(클릭률)에 직접 영향. AI 검색(ChatGPT)도 이 문장을 자주 인용합니다.</Glossary>,{" "}
          <Glossary term="JSON-LD" short="페이지 안에 숨겨두는 구조화된 정보 코드. 검색엔진이 본문 추측 없이 바로 이해.">상품이라면 가격·평점, 칼럼이라면 제목·작성일 같은 정보를 직접 알려줘서 리치 결과가 뜨게 합니다.</Glossary>,{" "}
          <Glossary term="alt 누락" short="이미지에 대체 텍스트가 없는 상태.">시각장애 사용자가 못 읽고, 검색엔진도 이미지 내용을 모릅니다.</Glossary>{" "}
          기준으로 보세요.
        </WhyCallout>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>페이지</th>
                <th>title (권장 30~60자)</th>
                <th>description (권장 70~160자)</th>
                <th>JSON-LD</th>
                <th>alt 누락</th>
                <th>단어수</th>
                <th>H1/H2</th>
              </tr>
            </thead>
            <tbody>
              {audit.pages.map((p) => (
                <tr key={p.key}>
                  <td>
                    <div className={styles.pageCellTitle}>{p.label}</div>
                    <a href={p.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>{p.url}</a>
                  </td>
                  <td>
                    <div className={styles.pageCellMeta}>{p.title || "—"}</div>
                    <div className={styles.pageCellSub} title={p.titleLength < 30 ? "권장보다 짧음" : p.titleLength > 60 ? "권장보다 김" : "권장 범위"}>
                      {p.titleLength}자 {p.titleLength < 30 ? "(짧음)" : p.titleLength > 60 ? "(김)" : "(적정)"}
                    </div>
                  </td>
                  <td>
                    <div className={styles.pageCellMetaSmall}>{p.metaDescription ? `${p.metaDescription.slice(0, 50)}…` : "—"}</div>
                    <div className={styles.pageCellSub}>{p.metaDescriptionLength}자 {p.metaDescriptionLength < 70 ? "(짧음)" : p.metaDescriptionLength > 160 ? "(김)" : "(적정)"}</div>
                  </td>
                  <td className={p.jsonLdCount === 0 ? styles.cellDanger : styles.cellGood} title={p.jsonLdCount === 0 ? "구조화 데이터가 없어 리치 결과가 뜨지 않습니다" : "구조화 데이터 존재"}>
                    {p.jsonLdCount}{p.jsonLdCount === 0 && " ⚠️"}
                  </td>
                  <td className={p.imagesWithoutAlt > 30 ? styles.cellDanger : p.imagesWithoutAlt > 5 ? styles.cellWarn : styles.cellGood} title={`이미지 ${p.imageCount}개 중 ${p.imagesWithoutAlt}개에 alt 텍스트 없음`}>
                    {p.imagesWithoutAlt}/{p.imageCount}
                  </td>
                  <td>{p.wordCount.toLocaleString()}</td>
                  <td>{p.h1Count}/{p.h2Count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
