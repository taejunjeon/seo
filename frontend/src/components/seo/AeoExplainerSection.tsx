"use client";

import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import ImpactBadge from "./ImpactBadge";

const QUESTION_PATTERNS = [
  { pattern: "무엇 / 뭐예요", example: "유기산 검사가 무엇인가요?", maps: "용어 정의형 칼럼·FAQ" },
  { pattern: "어떻게 / 방법", example: "음식물 과민증 검사 어떻게 받아요?", maps: "절차·방법 안내 칼럼" },
  { pattern: "효능 / 효과", example: "마그네슘 효능", maps: "성분별 칼럼 · 영양제 설명서" },
  { pattern: "차이 / vs", example: "유기산 검사 vs 호르몬 검사 차이", maps: "비교 칼럼" },
  { pattern: "추천 / 후기 / 좋은", example: "피로 회복 영양제 추천", maps: "상품 큐레이션 칼럼" },
  { pattern: "부작용 / 주의", example: "비타민D 부작용", maps: "안전성·복용 가이드 칼럼" },
];

export default function AeoExplainerSection() {
  return (
    <section id="aeo-explainer" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>AEO 확장 (AI 검색 최적화) — 무엇이고 왜 하는가</h2>
          <ImpactBadge variant="readonly" />
        </div>
        <span className={styles.sectionTag}>다음 라운드 후보 · Phase3-Sprint9 입력</span>
      </div>

      <WhyCallout tone="info" title="AEO가 뭐예요">
        <p style={{ marginBottom: 8 }}>
          <strong>AEO(Answer Engine Optimization, 답변 엔진 최적화)</strong>는 ChatGPT·Perplexity·Google AI Overview 같은
          AI 검색이 우리 사이트의 칼럼·FAQ를 인용하기 좋게 만드는 작업입니다.
          전통적인 SEO가 「검색결과 10개 중 위에 뜨기」였다면, AEO는 「AI가 답변할 때 우리 사이트를 출처로 인용하게 만들기」.
        </p>
        <p>
          AI 검색은 「피로가 자주 와요. 어떤 영양제가 좋아요?」 같은 <strong>질문형 검색</strong>에 답을 합니다.
          이 답변에 우리가 인용되려면, 우리 사이트에 그 질문에 대한 <strong>짧고 명확한 답변 문단</strong>이 있어야 합니다.
        </p>
      </WhyCallout>

      <div className={styles.aeoImpactGrid}>
        <div className={styles.aeoImpactCard}>
          <div className={styles.aeoImpactLabel}>왜 지금 해야 하나요</div>
          <ul className={styles.aeoImpactList}>
            <li>ChatGPT 사용자 수가 매월 늘고 있고, 「영양제 추천」, 「검사권 비교」 같은 우리 도메인 질문도 점점 ChatGPT로 이동.</li>
            <li>AI 검색은 인용 출처 1~3개에 트래픽을 집중시키는 「Winner takes all」 구조라 먼저 자리 잡은 쪽이 유리.</li>
            <li>현재 우리 사이트는 칼럼 본문이 길지만 「짧은 답변 문단」 구조가 약해서 AI가 인용하기 어려움.</li>
          </ul>
        </div>
        <div className={styles.aeoImpactCard}>
          <div className={styles.aeoImpactLabel}>파급력 (예상)</div>
          <ul className={styles.aeoImpactList}>
            <li>단기 (1~3개월): 칼럼 검색결과 「부가 표시(Rich Results)」 노출 확대 → CTR 상승</li>
            <li>중기 (3~6개월): ChatGPT/Perplexity 답변에 「바이오컴」 인용 시작 (현재 0건 추정)</li>
            <li>장기 (6~12개월): 검사권 추천 질문에서 「바이오컴 종합 대사기능 분석」이 1순위 인용 후보</li>
          </ul>
        </div>
        <div className={styles.aeoImpactCard}>
          <div className={styles.aeoImpactLabel}>운영 영향</div>
          <ul className={styles.aeoImpactList}>
            <li><strong>제안서 단계</strong>: 운영 영향 0. 콘텐츠팀에 넘길 「칼럼 구조 + 질문 후보」 초안만 만듦.</li>
            <li><strong>운영 반영 단계</strong> (별도 승인): 칼럼 본문 끝에 짧은 FAQ 박스 추가 + FAQPage 검색엔진 설명서 코드 삽입.</li>
            <li>의료·건강 표현 검수 필수.</li>
          </ul>
        </div>
      </div>

      <h3 className={styles.colH} style={{ marginTop: 24 }}>다음 라운드 작업 흐름</h3>
      <div className={styles.aeoFlow}>
        <div className={styles.aeoFlowStep}>
          <div className={styles.aeoFlowNum}>1</div>
          <div className={styles.aeoFlowBody}>
            <div className={styles.aeoFlowTitle}>구글 검색 콘솔에서 질문형 검색어 자동 추출</div>
            <div className={styles.aeoFlowDesc}>
              최근 90일간 우리 사이트에 노출된 검색어 중 아래 6개 패턴에 매칭되는 것을 추출.
              「노출은 있는데 클릭이 적은 질문형 키워드」가 우선순위.
              <strong> 운영 영향 0 — 분석만</strong>.
            </div>
          </div>
        </div>
        <div className={styles.aeoFlowStep}>
          <div className={styles.aeoFlowNum}>2</div>
          <div className={styles.aeoFlowBody}>
            <div className={styles.aeoFlowTitle}>칼럼별 FAQ 후보 매핑</div>
            <div className={styles.aeoFlowDesc}>
              질문형 검색어를 기존 칼럼에 매핑. 어느 칼럼에 어떤 FAQ를 추가하면 좋을지 표로 정리.
              <strong> 운영 영향 0 — 콘텐츠팀 의뢰용 표만 생성</strong>.
            </div>
          </div>
        </div>
        <div className={styles.aeoFlowStep}>
          <div className={styles.aeoFlowNum}>3</div>
          <div className={styles.aeoFlowBody}>
            <div className={styles.aeoFlowTitle}>(별도 승인) 칼럼 본문에 FAQ 블록 추가</div>
            <div className={styles.aeoFlowDesc}>
              콘텐츠팀이 다듬은 짧은 답변(2~3문장)을 칼럼 끝에 추가 + 검색엔진 설명서 코드(FAQPage JSON-LD) 삽입.
              <strong> 운영 영향 있음 — 아임웹 게시 전 TJ 승인 필요</strong>.
            </div>
          </div>
        </div>
      </div>

      <h3 className={styles.colH} style={{ marginTop: 24 }}>대상이 될 질문형 패턴 (시범 6종)</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>질문 패턴</th>
              <th>예시 검색어</th>
              <th>매핑할 콘텐츠 유형</th>
            </tr>
          </thead>
          <tbody>
            {QUESTION_PATTERNS.map((q) => (
              <tr key={q.pattern}>
                <td><strong>{q.pattern}</strong></td>
                <td>{q.example}</td>
                <td>{q.maps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WhyCallout tone="success" title="다음 단계로 가려면">
        TJ가 「AEO 확장도 진행해」 한 줄 회신하면, Codex가 GSC에서 질문형 검색어를 자동 추출해 칼럼별 매핑 표를 만듭니다.
        그 표를 보고 콘텐츠팀에 넘길지 따로 결정하면 됩니다.
      </WhyCallout>
    </section>
  );
}
