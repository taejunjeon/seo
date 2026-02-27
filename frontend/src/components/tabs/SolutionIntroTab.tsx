"use client";

import styles from "@/app/page.module.css";

export default function SolutionIntroTab() {
  return (
    <>
      {/* 히어로 */}
      <section className={styles.introHero}>
        <div className={styles.introHeroIcon}>🧠</div>
        <h1 className={styles.introHeroTitle}>biocom.kr SEO Intelligence Dashboard</h1>
        <p className={styles.introHeroSub}>
          GSC + PageSpeed + GA4 API를 연동하여 건강칼럼 콘텐츠의 검색 성능을 체계적으로
          모니터링하고, AEO/GEO 최적화 인사이트를 자동으로 도출하는 통합 대시보드입니다.
        </p>
        <span className={styles.introHeroSite}>대상: biocom.kr/healthinfo (건강칼럼 섹션)</span>
      </section>

      {/* 문제 인식 & 솔루션 */}
      <section className={styles.introGrid2}>
        <div className={styles.introCard}>
          <h3 className={styles.introCardTitle}>🎯 왜 필요한가?</h3>
          <p className={styles.introCardDesc}>
            biocom.kr의 건강칼럼은 <strong>YMYL(Your Money or Your Life)</strong> 카테고리에 해당하여
            구글의 <strong>E-E-A-T</strong> 평가가 특히 중요합니다. 기존에는 검색 성과를 수동으로
            확인하는 데 <strong>주 2시간 이상</strong> 소요되었고, 데이터 기반의 체계적 의사결정이 어려웠습니다.
          </p>
          <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
            또한 AI 검색(ChatGPT, Perplexity 등)이 확산되면서, 전통적인 SEO를 넘어
            <strong> AEO(Answer Engine Optimization)</strong>와 <strong>GEO(Generative Engine Optimization)</strong> 전략이
            필수가 되었습니다.
          </p>
        </div>
        <div className={styles.introCard}>
          <h3 className={styles.introCardTitle}>💡 무엇을 해결하는가?</h3>
          <p className={styles.introCardDesc}>
            <strong>1. 자동 모니터링</strong> — Google API 연동으로 검색 성과, 페이지 속도, 사용자 행동을 매일 자동 수집하고 대시보드에 시각화합니다.
          </p>
          <p className={styles.introCardDesc}>
            <strong>2. AI 기반 인사이트</strong> — 순위 하락, CTR 저하, 기회 키워드 등을 AI가 자동 감지하여 즉각적인 개선 방향을 제시합니다.
          </p>
          <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
            <strong>3. AEO/GEO 추적</strong> — Q&A 키워드 분류, Featured Snippet 모니터링, AI 인용 여부를 추적하여 차세대 검색 최적화를 지원합니다.
          </p>
        </div>
      </section>

      {/* 데이터 소스 */}
      <section className={styles.introDataSources}>
        <div className={styles.introDataSource}>
          <div className={styles.introDataSourceIcon}>🔍</div>
          <div className={styles.introDataSourceName}>Google Search Console</div>
          <div className={`${styles.introDataSourcePhase} ${styles.introPhase1}`}>Phase 1 — 연동 완료 ✅</div>
          <p className={styles.introDataSourceDesc}>
            클릭수, 노출수, CTR, 평균 순위를 페이지별/키워드별로 조회. 최대 16개월 과거 데이터 제공.
          </p>
        </div>
        <div className={styles.introDataSource}>
          <div className={styles.introDataSourceIcon}>⚡</div>
          <div className={styles.introDataSourceName}>PageSpeed Insights</div>
          <div className={`${styles.introDataSourcePhase} ${styles.introPhase1}`}>Phase 1 — 연동 완료 ✅</div>
          <p className={styles.introDataSourceDesc}>
            LCP, FCP, CLS, INP 등 Core Web Vitals 측정. Lighthouse + CrUX 실사용자 데이터 병행 제공.
          </p>
        </div>
        <div className={styles.introDataSource}>
          <div className={styles.introDataSourceIcon}>📊</div>
          <div className={styles.introDataSourceName}>GA4 Data API</div>
          <div className={`${styles.introDataSourcePhase} ${styles.introPhase2}`}>Phase 2 — GCP API 활성화 필요</div>
          <p className={styles.introDataSourceDesc}>
            체류시간, 이탈률, 스크롤 깊이, 전환율 등 검색 후 사용자 행동 분석. SEO→전환 연결.
          </p>
        </div>
      </section>

      {/* 주요 기능 (5 페이지) */}
      <section className={styles.introCard}>
        <h3 className={styles.introCardTitle}>📋 대시보드 주요 기능</h3>
        <ul className={styles.introFeatureList}>
          {[
            { num: "01", name: "오버뷰", desc: "KPI 요약 카드 4개, 클릭/노출 추이 차트, AI 인사이트 알림, AEO/GEO 점수 게이지" },
            { num: "02", name: "칼럼별 분석", desc: "각 칼럼의 클릭/노출/CTR/순위 + 검색(40%)+기술(20%)+체류(25%)+AEO/GEO(15%) 가중 종합 스코어" },
            { num: "03", name: "키워드 분석", desc: "TOP 50 키워드 순위 변동, Q&A 키워드 자동분류, Featured Snippet 모니터링, 기회 키워드 발견" },
            { num: "04", name: "Core Web Vitals", desc: "LCP/FCP/CLS/INP/TTFB 게이지, 모바일/데스크톱 전략별 비교, 페이지별 성능 히트맵" },
            { num: "05", name: "사용자 행동", desc: "GA4 기반 체류 분석, 유기검색→칼럼→제품→구매 전환 퍼널, 뷰저블 히트맵 바로가기" },
          ].map((f) => (
            <li key={f.num} className={styles.introFeatureItem}>
              <span className={styles.introFeatureNum}>{f.num}</span>
              <div>
                <div className={styles.introFeatureName}>{f.name}</div>
                <div className={styles.introFeatureDesc}>{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* AEO/GEO + 스코어 구성 */}
      <section className={styles.introGrid2}>
        <div className={styles.introCard}>
          <h3 className={styles.introCardTitle}>🤖 AEO/GEO 최적화란?</h3>
          <p className={styles.introCardDesc}>
            <strong>AEO (Answer Engine Optimization)</strong>는 AI 챗봇(ChatGPT, Perplexity 등)이
            우리 콘텐츠를 답변 소스로 인용하도록 최적화하는 전략입니다.
          </p>
          <p className={styles.introCardDesc}>
            <strong>GEO (Generative Engine Optimization)</strong>는 구글 AI Overview, Bing Copilot 등
            생성형 검색 결과에서 우리 콘텐츠가 노출되도록 하는 전략입니다.
          </p>
          <p className={styles.introCardDesc} style={{ marginBottom: 0 }}>
            이 대시보드는 Q&A 키워드 자동 태깅, Featured Snippet 획득 추적, AI 인용 모니터링을 통해
            AEO/GEO 성과를 체계적으로 관리합니다.
          </p>
        </div>
        <div className={styles.introCard}>
          <h3 className={styles.introCardTitle}>📐 칼럼 종합 스코어 산출</h3>
          <p className={styles.introCardDesc}>GSC + PageSpeed + GA4 데이터를 종합하여 각 칼럼에 0~100점 스코어를 부여합니다.</p>
          <table className={styles.introScoreTable}>
            <thead>
              <tr><th>구성요소</th><th>가중치</th><th>기준</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className={styles.introScoreBar} style={{ width: 40, background: "#0D9488" }} />검색 성과</td>
                <td><strong>40%</strong></td>
                <td>클릭수 + CTR + 순위 종합</td>
              </tr>
              <tr>
                <td><span className={styles.introScoreBar} style={{ width: 20, background: "#2563eb" }} />기술 성능</td>
                <td><strong>20%</strong></td>
                <td>Performance + CWV 통과</td>
              </tr>
              <tr>
                <td><span className={styles.introScoreBar} style={{ width: 25, background: "#f59e0b" }} />사용자 체류</td>
                <td><strong>25%</strong></td>
                <td>체류시간, 이탈률, 스크롤</td>
              </tr>
              <tr>
                <td><span className={styles.introScoreBar} style={{ width: 15, background: "#8b5cf6" }} />AEO/GEO</td>
                <td><strong>15%</strong></td>
                <td>Q&A 구조화 + Featured + AI 인용</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 로드맵 */}
      <section className={styles.introCard}>
        <h3 className={styles.introCardTitle}>🗓️ 구현 로드맵</h3>
        <div className={styles.introRoadmap}>
          <div className={styles.introRoadmapPhase}>
            <div className={styles.introRoadmapLeft}>
              <div className={styles.introRoadmapWeek}>1주차</div>
              <span className={`${styles.introRoadmapStatus} ${styles.introStatusDone}`}>✅ 완료</span>
            </div>
            <div className={styles.introRoadmapRight}>
              <div className={styles.introRoadmapTitle}>Phase 1-1: 인프라 + GSC 연동</div>
              <ul className={styles.introRoadmapItems}>
                <li className={styles.introRoadmapItem}>✅ GCP 프로젝트 세팅 + API 활성화</li>
                <li className={styles.introRoadmapItem}>✅ Next.js 프론트엔드 + Express 백엔드 구축</li>
                <li className={styles.introRoadmapItem}>✅ GSC API 연동 (Service Account 인증)</li>
                <li className={styles.introRoadmapItem}>✅ 대시보드 UI 5개 탭 프로토타입</li>
              </ul>
            </div>
          </div>
          <div className={styles.introRoadmapPhase}>
            <div className={styles.introRoadmapLeft}>
              <div className={styles.introRoadmapWeek}>2주차</div>
              <span className={`${styles.introRoadmapStatus} ${styles.introStatusDone}`}>✅ 완료</span>
            </div>
            <div className={styles.introRoadmapRight}>
              <div className={styles.introRoadmapTitle}>Phase 1-2: PageSpeed + 실데이터 연결</div>
              <ul className={styles.introRoadmapItems}>
                <li className={styles.introRoadmapItem}>✅ PageSpeed Insights API 연동</li>
                <li className={styles.introRoadmapItem}>☐ Supabase DB 스키마 생성 + Cron Job</li>
                <li className={styles.introRoadmapItem}>✅ 오버뷰 KPI 카드 실데이터 연결</li>
                <li className={styles.introRoadmapItem}>✅ CWV 게이지 실데이터 연결</li>
                <li className={styles.introRoadmapItem}>☐ Vercel 배포 + 환경변수 설정</li>
              </ul>
            </div>
          </div>
          <div className={styles.introRoadmapPhase}>
            <div className={styles.introRoadmapLeft}>
              <div className={styles.introRoadmapWeek}>3주차</div>
              <span className={`${styles.introRoadmapStatus} ${styles.introStatusProgress}`}>🔧 진행중</span>
            </div>
            <div className={styles.introRoadmapRight}>
              <div className={styles.introRoadmapTitle}>Phase 2-1: GA4 + 키워드 분석</div>
              <ul className={styles.introRoadmapItems}>
                <li className={styles.introRoadmapItem}>✅ GA4 Data API 코드 구현 (GCP 활성화 대기)</li>
                <li className={styles.introRoadmapItem}>✅ 키워드 Q&A 자동분류 로직</li>
                <li className={styles.introRoadmapItem}>✅ 칼럼 성과 스코어카드 실데이터</li>
              </ul>
            </div>
          </div>
          <div className={styles.introRoadmapPhase}>
            <div className={styles.introRoadmapLeft}>
              <div className={styles.introRoadmapWeek}>4주차</div>
              <span className={`${styles.introRoadmapStatus} ${styles.introStatusPending}`}>대기</span>
            </div>
            <div className={styles.introRoadmapRight}>
              <div className={styles.introRoadmapTitle}>Phase 2-2: AI 모니터링 + 완성</div>
              <ul className={styles.introRoadmapItems}>
                <li className={styles.introRoadmapItem}>☐ AI 인용 모니터링 (GEO)</li>
                <li className={styles.introRoadmapItem}>☐ 알림 시스템 (순위 급변, 성능 저하)</li>
                <li className={styles.introRoadmapItem}>☐ 뷰저블 바로가기 통합</li>
                <li className={styles.introRoadmapItem}>☐ 최종 QA + 운영 가이드 문서</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 성공 지표 */}
      <section className={styles.introCard}>
        <h3 className={styles.introCardTitle}>🎯 성공 지표</h3>
        <div className={styles.introMetrics}>
          <div className={styles.introMetricCard}>
            <div className={styles.introMetricLabel}>SEO 모니터링 소요시간</div>
            <div className={styles.introMetricTarget}>주 2시간 → 주 10분</div>
          </div>
          <div className={styles.introMetricCard}>
            <div className={styles.introMetricLabel}>건강칼럼 오가닉 클릭</div>
            <div className={styles.introMetricTarget}>+30% 성장 (3개월)</div>
          </div>
          <div className={styles.introMetricCard}>
            <div className={styles.introMetricLabel}>평균 검색 순위</div>
            <div className={styles.introMetricTarget}>TOP 20 → TOP 10</div>
          </div>
          <div className={styles.introMetricCard}>
            <div className={styles.introMetricLabel}>Core Web Vitals 통과율</div>
            <div className={styles.introMetricTarget}>90% 이상 Good</div>
          </div>
        </div>
      </section>
    </>
  );
}
