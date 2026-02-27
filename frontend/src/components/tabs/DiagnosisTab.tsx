"use client";

import styles from "@/app/page.module.css";
import { AiCitationSection } from "@/components/diagnosis";
import type { AiCitationApiResponse } from "@/components/diagnosis";
import { numberFormatter } from "@/utils/pageUtils";
import { DIAG_PRIORITY_MAP } from "@/constants/pageData";
import type { AeoGeoApiResult, CrawlAnalysisResult, DiagnosisItem, DiagnosisHistoryItem } from "@/types/page";

type Props = {
  diagUrl: string;
  setDiagUrl: (url: string) => void;
  diagLoading: boolean;
  diagMode: "quick" | "detailed";
  setDiagMode: (mode: "quick" | "detailed") => void;
  diagStep: string | null;
  diagError: string | null;
  diagSubpages: { url: string; title: string }[];
  diagSubpagesLoading: boolean;
  diagHistoryOpen: boolean;
  setDiagHistoryOpen: (v: boolean) => void;
  diagHistory: DiagnosisHistoryItem[];
  diagAeoScore: AeoGeoApiResult | null;
  diagGeoScore: AeoGeoApiResult | null;
  diagCrawlResult: CrawlAnalysisResult | null;
  diagCitation: AiCitationApiResponse | null;
  diagCitationLoading: boolean;
  diagnosisItems: DiagnosisItem[];
  handleDiagnosisTest: (mode: "quick" | "detailed") => void;
  handleDiscoverSubpages: () => void;
  loadDiagHistory: () => void;
};

export default function DiagnosisTab({
  diagUrl, setDiagUrl, diagLoading, diagMode, setDiagMode, diagStep, diagError,
  diagSubpages, diagSubpagesLoading, diagHistoryOpen, setDiagHistoryOpen,
  diagHistory, diagAeoScore, diagGeoScore, diagCrawlResult,
  diagCitation, diagCitationLoading, diagnosisItems,
  handleDiagnosisTest, handleDiscoverSubpages, loadDiagHistory,
}: Props) {
  return (
    <>
      {/* URL 입력 폼 + 진단 모드 선택 */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>페이지 진단 리포트</h2>
        </div>
        <p className={styles.cwvDescSmall}>URL을 입력하면 Schema 마크업, 콘텐츠 구조, AEO/GEO 점수를 종합 진단합니다.</p>
        <div className={styles.cwvTestForm}>
          <input
            type="url"
            className={styles.cwvTestInput}
            value={diagUrl}
            onChange={(e) => setDiagUrl(e.target.value)}
            placeholder="https://biocom.kr/healthinfo"
          />
          <button
            type="button"
            className={styles.cwvTestBtn}
            onClick={() => handleDiagnosisTest("quick")}
            disabled={diagLoading || !diagUrl.trim()}
          >
            {diagLoading && diagMode === "quick" ? (diagStep ?? "진단 중...") : "빠른 진단"}
          </button>
          <button
            type="button"
            className={`${styles.cwvTestBtn} ${styles.cwvTestBtnDetailed}`}
            onClick={() => { setDiagMode("detailed"); handleDiagnosisTest("detailed"); }}
            disabled={diagLoading || !diagUrl.trim()}
            title="PageSpeed + AI 인용도 포함 (30~60초 소요, API 비용 발생)"
          >
            {diagLoading && diagMode === "detailed" ? (diagStep ?? "정밀 진단 중...") : "정밀 진단"}
          </button>
        </div>
        <p className={styles.diagModeHint}>
          빠른 진단: Crawl + AEO/GEO 점수 | 정밀 진단: + PageSpeed + AI 인용도 분석 (30~60초, API 비용 발생)
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className={styles.diagSubBtn}
            onClick={handleDiscoverSubpages}
            disabled={diagSubpagesLoading || !diagUrl.trim()}
          >
            {diagSubpagesLoading ? "탐색 중..." : "하위 페이지 탐색"}
          </button>
          <button
            type="button"
            className={styles.diagSubBtn}
            onClick={() => { loadDiagHistory(); setDiagHistoryOpen(!diagHistoryOpen); }}
          >
            {diagHistoryOpen ? "히스토리 닫기" : "진단 히스토리"}
          </button>
        </div>
        {diagError && <p className={styles.reportError}>{diagError}</p>}
      </section>

      {/* 하위 페이지 목록 */}
      {diagSubpages.length > 0 && (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>하위 페이지 목록</h2>
            <span className={styles.sectionMeta}>{diagSubpages.length}개 발견</span>
          </div>
          <div className={styles.subpagesList}>
            {diagSubpages.map((sp) => (
              <div key={sp.url} className={styles.subpageRow}>
                <button
                  type="button"
                  className={styles.subpageLink}
                  onClick={() => { setDiagUrl(sp.url); }}
                  title={sp.url}
                >
                  {sp.title || sp.url}
                </button>
                <button
                  type="button"
                  className={styles.subpageDiagBtn}
                  onClick={() => { setDiagUrl(sp.url); setTimeout(() => handleDiagnosisTest("quick"), 100); }}
                  disabled={diagLoading}
                >
                  진단
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 진단 히스토리 */}
      {diagHistoryOpen && (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>진단 히스토리</h2>
            <span className={styles.sectionMeta}>{diagHistory.length}건</span>
          </div>
          {diagHistory.length === 0 ? (
            <p className={styles.cwvDescSmall}>저장된 진단 기록이 없습니다.</p>
          ) : (
            <div className={styles.historyList}>
              {diagHistory.map((rec) => (
                <div key={rec.id} className={styles.historyRow}>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyDate}>{new Date(rec.createdAt).toLocaleString("ko-KR")}</span>
                    <span className={styles.historyMode}>{rec.mode === "detailed" ? "정밀" : "빠른"}</span>
                  </div>
                  <div className={styles.historyUrl} title={rec.url}>{rec.url.replace(/^https?:\/\//, "").slice(0, 60)}</div>
                  <div className={styles.historyScores}>
                    {rec.aeoScore != null && <span className={styles.historyScore}>AEO {rec.aeoScore}</span>}
                    {rec.geoScore != null && <span className={styles.historyScore}>GEO {rec.geoScore}</span>}
                  </div>
                  <button
                    type="button"
                    className={styles.historyRerunBtn}
                    onClick={() => { setDiagUrl(rec.url); setTimeout(() => handleDiagnosisTest(rec.mode as "quick" | "detailed"), 100); }}
                    disabled={diagLoading}
                  >
                    재진단
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* AEO/GEO 점수 카드 */}
      {(diagAeoScore || diagGeoScore) && (
        <>
          <section className={styles.heroGrid}>
            {[
              { label: "AEO Score", data: diagAeoScore, idx: 0 },
              { label: "GEO Score", data: diagGeoScore, idx: 1 },
            ].map(({ label, data, idx }) => {
              const score = data?.normalizedScore ?? 0;
              const measured = data ? data.breakdown.filter((b) => b.status === "measured").length : 0;
              const total = data ? data.breakdown.length : 0;
              return (
                <article key={label} className={styles.scoreCard}>
                  <div className={styles.scoreCardHeader}>
                    <span className={styles.scoreLabel}>{label}</span>
                    <span className={styles.scoreFraction}>{score}/100</span>
                  </div>
                  <p className={`${styles.scoreValue} ${idx === 0 ? styles.scoreValueAeo : styles.scoreValueGeo}`}>{score}</p>
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${idx === 0 ? styles.progressFillAeo : styles.progressFillGeo}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {data && <p className={styles.scoreMeta}>{measured}/{total} 항목 측정 완료 · {data.totalScore}/{data.maxPossible}점</p>}
                </article>
              );
            })}
          </section>

          {/* AEO/GEO 브레이크다운 */}
          <section className={styles.breakdownSection}>
            {[diagAeoScore, diagGeoScore].filter(Boolean).map((result) => (
              <div key={result!.type} className={styles.breakdownCard}>
                <h3 className={styles.breakdownTitle}>{result!.type} Score 상세 ({result!.normalizedScore}점)</h3>
                <div className={styles.breakdownGrid}>
                  {result!.breakdown.map((b) => (
                    <div key={b.name} className={`${styles.breakdownItem} ${b.status === "unavailable" ? styles.breakdownUnavailable : ""}`}>
                      <div className={styles.breakdownItemHeader}>
                        <span className={styles.breakdownItemLabel}>{b.label}</span>
                        <span className={styles.breakdownItemScore}>{b.score}/{b.maxScore}</span>
                      </div>
                      <div className={styles.breakdownBar}>
                        <div className={`${styles.breakdownBarFill} ${b.maxScore > 0 ? ((b.score / b.maxScore) >= 0.7 ? styles.breakdownBarGood : (b.score / b.maxScore) >= 0.4 ? styles.breakdownBarWarn : styles.breakdownBarPoor) : ""}`} style={{ width: b.maxScore > 0 ? `${(b.score / b.maxScore) * 100}%` : "0%" }} />
                      </div>
                      <p className={styles.breakdownDetail}>{b.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Schema 마크업 진단 */}
      {diagCrawlResult && (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Schema 마크업 진단</h2>
            <span className={styles.sectionMeta}>JSON-LD {diagCrawlResult.schema.rawCount}개 블록 감지</span>
          </div>
          <div className={styles.diagSchemaGrid}>
            {([
              { key: "FAQPage", icon: "❓", present: diagCrawlResult.schema.hasFAQ, desc: "자주 묻는 질문을 구조화하여 검색 결과에 FAQ 리치 결과로 표시" },
              { key: "Article", icon: "📰", present: diagCrawlResult.schema.hasArticle, desc: "콘텐츠의 제목, 저자, 날짜 등을 구조화하여 뉴스/기사 리치 결과 생성" },
              { key: "HowTo", icon: "📋", present: diagCrawlResult.schema.hasHowTo, desc: "단계별 가이드를 구조화하여 How-to 리치 결과로 표시" },
              { key: "Author/Person", icon: "👤", present: diagCrawlResult.schema.hasAuthor, desc: "저자 정보를 명시하여 E-E-A-T 신뢰도 향상" },
              { key: "Medical", icon: "🏥", present: diagCrawlResult.schema.hasMedical, desc: "의료/건강 콘텐츠에 특화된 스키마로 YMYL 신뢰도 강화" },
              { key: "Speakable", icon: "🔊", present: diagCrawlResult.schema.hasSpeakable, desc: "음성 검색(Google Assistant)에서 콘텐츠를 읽어줄 수 있도록 지정" },
            ] as const).map((s) => (
              <div key={s.key} className={`${styles.diagSchemaCard} ${s.present ? styles.diagSchemaPresent : styles.diagSchemaAbsent}`}>
                <div className={styles.diagSchemaIcon}>{s.icon}</div>
                <div className={styles.diagSchemaName}>{s.key}</div>
                <div className={styles.diagSchemaStatus}>{s.present ? "✅ 감지됨" : "❌ 없음"}</div>
                <p className={styles.diagSchemaDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
          {diagCrawlResult.schema.types.length > 0 && (
            <div className={styles.diagDetectedSchemas}>
              <span className={styles.diagDetectedLabel}>감지된 Schema:</span>
              {diagCrawlResult.schema.types.map((t) => (
                <span key={t} className={styles.diagDetectedTag}>{t}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* AI 인용도 분석 (정밀 진단 시) */}
      {diagCitation && (
        <AiCitationSection data={diagCitation} diagUrl={diagUrl} />
      )}
      {diagCitationLoading && !diagCitation && (
        <section className={styles.card}>
          <p style={{ color: "#64748b", fontSize: "0.88rem", textAlign: "center", padding: "20px 0" }}>
            AI 인용도 분석 중... (SerpAPI + ChatGPT + Perplexity 조회, 10~30초)
          </p>
        </section>
      )}

      {/* 콘텐츠 구조 분석 */}
      {diagCrawlResult && (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>콘텐츠 구조 분석</h2>
            <span className={styles.sectionMeta}>총 {numberFormatter.format(diagCrawlResult.content.wordCount)}단어</span>
          </div>
          <div className={styles.diagContentGrid}>
            {([
              { label: "H2 제목", value: diagCrawlResult.content.h2Count, good: 3, warn: 1 },
              { label: "H3 소제목", value: diagCrawlResult.content.h3Count, good: 2, warn: 1 },
              { label: "목록(ul/ol)", value: diagCrawlResult.content.listCount, good: 1, warn: 0 },
              { label: "표(table)", value: diagCrawlResult.content.tableCount, good: 1, warn: 0 },
              { label: "인용(blockquote)", value: diagCrawlResult.content.blockquoteCount, good: 1, warn: 0 },
              { label: "이미지", value: diagCrawlResult.content.imgCount, good: 1, warn: 0 },
              { label: "이미지 alt 있음", value: diagCrawlResult.content.imgWithAlt, good: diagCrawlResult.content.imgCount || 1, warn: Math.max(1, Math.floor((diagCrawlResult.content.imgCount || 1) * 0.5)) },
              { label: "메타 설명 길이", value: diagCrawlResult.content.metaDescLength, good: 70, warn: 30 },
            ] as const).map((m) => {
              const status = m.value >= m.good ? "good" : m.value >= m.warn ? "warning" : "poor";
              const statusCls = status === "good" ? styles.diagContentGood : status === "warning" ? styles.diagContentWarning : styles.diagContentPoor;
              const dot = status === "good" ? "🟢" : status === "warning" ? "🟡" : "🔴";
              return (
                <div key={m.label} className={`${styles.diagContentCard} ${statusCls}`}>
                  <div className={styles.diagContentLabel}>{m.label}</div>
                  <div className={styles.diagContentValue}>{dot} {m.value}개</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 감점 요인 및 개선 권장 */}
      {diagnosisItems.length > 0 && (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>감점 요인 및 개선 권장</h2>
            <span className={styles.sectionMeta}>{diagnosisItems.length}개 항목 발견</span>
          </div>
          <div className={styles.diagIssuesList}>
            {diagnosisItems.map((item, idx) => {
              const pm = DIAG_PRIORITY_MAP[item.priority];
              return (
                <div key={idx} className={styles.diagIssueRow}>
                  <span className={`${styles.diagIssueDot} ${styles[pm.dot]}`} />
                  <span className={`${styles.diagIssuePriority} ${styles[pm.cls]}`}>{pm.label}</span>
                  <div className={styles.diagIssueContent}>
                    <div className={styles.diagIssueTitle}>[{item.category}] {item.issue}</div>
                    <div className={styles.diagIssueRec}>💡 {item.recommendation}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
