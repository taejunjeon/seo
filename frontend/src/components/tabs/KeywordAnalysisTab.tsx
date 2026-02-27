"use client";

import { useMemo } from "react";
import styles from "@/app/page.module.css";
import { LiveBadge, LoadingBadge, NoDataBadge } from "@/components/common/Badges";
import DataTable from "@/components/common/DataTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { numberFormatter, decimalFormatter } from "@/utils/pageUtils";
import type { KeywordRangePreset, KeywordData } from "@/types/page";

type KwRow = KeywordData & Record<string, unknown>;

type Props = {
  keywordsData: unknown;
  keywordsLoading: boolean;
  keywordsError: string | null;
  setKeywordsError: (v: string | null) => void;
  keywordRangePreset: KeywordRangePreset;
  setKeywordRangePreset: (v: KeywordRangePreset) => void;
  keywordDatePickerOpen: boolean;
  setKeywordDatePickerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  keywordStartInput: string;
  setKeywordStartInput: (v: string) => void;
  keywordEndInput: string;
  setKeywordEndInput: (v: string) => void;
  keywordsDateRange: { start: string; end: string } | null;
  keywordRangeLabel: string;
  liveKeywords: KeywordData[];
  opportunityKeyword: KeywordData | null;
  setOpportunityKeyword: (kw: KeywordData | null) => void;
  loadKeywords: (opts: { days?: 7 | 30; startDate?: string; endDate?: string; signal?: AbortSignal }) => Promise<void>;
};

export default function KeywordAnalysisTab({
  keywordsData, keywordsLoading, keywordsError, setKeywordsError,
  keywordRangePreset, setKeywordRangePreset,
  keywordDatePickerOpen, setKeywordDatePickerOpen,
  keywordStartInput, setKeywordStartInput, keywordEndInput, setKeywordEndInput,
  keywordsDateRange, keywordRangeLabel, liveKeywords,
  opportunityKeyword, setOpportunityKeyword, loadKeywords,
}: Props) {
  const kwColumns = useMemo((): DataTableColumn<KwRow>[] => [
    { key: "query", label: "키워드", sortable: true, width: "30%" },
    {
      key: "isQA", label: "유형", sortable: false, align: "center",
      render: (_v, row) => (
        <span className={`${styles.kwTag} ${row.isQA ? styles.kwTagQA : styles.kwTagGeneral}`}>
          {row.isQA ? "Q&A" : "일반"}
        </span>
      ),
    },
    {
      key: "clicks", label: "클릭수", sortable: true, align: "right",
      render: (v) => numberFormatter.format(v as number),
    },
    {
      key: "impressions", label: "노출수", sortable: true, align: "right",
      render: (v) => numberFormatter.format(v as number),
    },
    {
      key: "ctr", label: "CTR", sortable: true, align: "right",
      render: (v) => `${decimalFormatter.format(v as number)}%`,
    },
    {
      key: "position", label: "순위", sortable: true, align: "right",
      render: (v) => decimalFormatter.format(v as number),
    },
    {
      key: "delta", label: "변동", sortable: true, align: "right",
      render: (v) => {
        const d = v as number;
        return (
          <span className={`${styles.kwDelta} ${d <= 0 ? styles.kwDeltaUp : styles.kwDeltaDown}`}>
            {d <= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}
          </span>
        );
      },
    },
    {
      key: "opportunity", label: "비고", sortable: false, align: "center",
      render: (_v, row) => (
        <>
          {row.featured && <span className={`${styles.kwTag} ${styles.kwTagFeatured}`}>Featured</span>}
          {row.opportunity && (
            <button
              type="button"
              className={`${styles.kwOpportunityBadge} ${styles.kwOpportunityBadgeBtn}`}
              onClick={() => setOpportunityKeyword(row as KeywordData)}
              title="왜 기회 키워드인지 보기"
            >
              기회 키워드
            </button>
          )}
        </>
      ),
    },
  ], [setOpportunityKeyword]);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>키워드 순위 추적{keywordsData ? <LiveBadge /> : keywordsLoading ? <LoadingBadge /> : <NoDataBadge />}</h2>
          <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
            <div className={styles.keywordMetaTop}>
              <div className={styles.keywordRangeBtns}>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${keywordRangePreset === "7d" ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => {
                    setKeywordRangePreset("7d");
                    setKeywordDatePickerOpen(false);
                    void loadKeywords({ days: 7 });
                  }}
                  disabled={keywordsLoading}
                >
                  7일
                </button>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${keywordRangePreset === "30d" ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => {
                    setKeywordRangePreset("30d");
                    setKeywordDatePickerOpen(false);
                    void loadKeywords({ days: 30 });
                  }}
                  disabled={keywordsLoading}
                >
                  30일
                </button>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${keywordRangePreset === "custom" || keywordDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => setKeywordDatePickerOpen((p: boolean) => !p)}
                  disabled={keywordsLoading}
                  title="기간 직접 지정"
                >
                  📅
                </button>
              </div>
              <span className={styles.keywordRangeText}>
                {keywordsData
                  ? `📅 ${keywordsDateRange?.start ?? ""} ~ ${keywordsDateRange?.end ?? ""} (${keywordRangeLabel}) · GSC 실데이터`
                  : "GSC 데이터 조회 필요"}
              </span>
            </div>
            <span className={styles.keywordMetaBottom}>
              {keywordsLoading ? "조회 중... · " : ""}
              {liveKeywords.filter((k) => k.isQA).length}개 Q&A 키워드 · {liveKeywords.filter((k) => k.featured).length}개 Featured Snippet
            </span>
          </div>
        </div>
        {keywordDatePickerOpen && (
          <div className={styles.keywordDatePicker}>
            <div className={styles.dateInputs}>
              <label className={styles.fieldLabel}>시작일<input type="date" value={keywordStartInput} onChange={(e) => setKeywordStartInput(e.target.value)} required /></label>
              <label className={styles.fieldLabel}>종료일<input type="date" value={keywordEndInput} onChange={(e) => setKeywordEndInput(e.target.value)} required /></label>
            </div>
            <div className={styles.keywordDateActions}>
              <button
                type="button"
                className={styles.keywordActionBtn}
                onClick={() => {
                  if (!keywordStartInput || !keywordEndInput) {
                    setKeywordsError("시작일/종료일을 입력해 주세요.");
                    return;
                  }
                  if (keywordStartInput > keywordEndInput) {
                    setKeywordsError("시작일은 종료일보다 빠르거나 같아야 합니다.");
                    return;
                  }
                  setKeywordsError(null);
                  setKeywordRangePreset("custom");
                  setKeywordDatePickerOpen(false);
                  void loadKeywords({ startDate: keywordStartInput, endDate: keywordEndInput });
                }}
                disabled={keywordsLoading}
              >
                적용
              </button>
              <button type="button" className={styles.keywordActionBtn} onClick={() => setKeywordDatePickerOpen(false)} disabled={keywordsLoading}>닫기</button>
            </div>
          </div>
        )}
        {keywordsError ? <p className={styles.error}>오류: {keywordsError}</p> : null}
        {liveKeywords.length === 0 && !keywordsLoading ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>키워드 데이터가 없습니다. GSC API 연결 후 자동으로 표시됩니다.</p>
            </div>
          </div>
        ) : (
          <DataTable<KwRow>
            columns={kwColumns}
            data={liveKeywords as KwRow[]}
            defaultSortKey="clicks"
            searchKeys={["query"]}
            searchPlaceholder="키워드 검색..."
            pageSize={20}
          />
        )}

        {opportunityKeyword && (
          <div
            className={styles.opportunityOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="기회 키워드 상세"
            onClick={() => setOpportunityKeyword(null)}
          >
            <div className={styles.opportunityModal} onClick={(e) => e.stopPropagation()}>
              {(() => {
                const IMP_THRESHOLD = 500;
                const CTR_THRESHOLD_PCT = 2;
                const kw = opportunityKeyword;
                const expectedClicksAt2Pct = Math.round((kw.impressions * CTR_THRESHOLD_PCT) / 100);
                const expectedClicksAt4Pct = Math.round((kw.impressions * 4) / 100);
                const additionalAt2Pct = Math.max(0, expectedClicksAt2Pct - kw.clicks);
                const additionalAt4Pct = Math.max(0, expectedClicksAt4Pct - kw.clicks);

                const positionBucket = (pos: number) => {
                  if (pos <= 3) return "상위 3위권";
                  if (pos <= 10) return "1페이지(상위 10)";
                  if (pos <= 20) return "2페이지(상위 20)";
                  if (pos <= 30) return "3페이지(상위 30)";
                  return "하위권";
                };

                return (
                  <>
                    <div className={styles.opportunityHeader}>
                      <div>
                        <h3 className={styles.opportunityTitle}>기회 키워드 상세</h3>
                        <p className={styles.opportunityKeyword}>{kw.query}</p>
                      </div>
                      <button type="button" className={styles.opportunityCloseBtn} onClick={() => setOpportunityKeyword(null)}>
                        닫기
                      </button>
                    </div>

                    <div className={styles.opportunityExplain}>
                      <p className={styles.opportunityExplainText}>
                        이 키워드는 <strong>노출이 충분히 높은데</strong>(≥ {numberFormatter.format(IMP_THRESHOLD)}회),{" "}
                        <strong>CTR이 낮아서</strong>(&lt; {CTR_THRESHOLD_PCT}%) &quot;기회 키워드&quot;로 분류되었습니다.
                      </p>
                      <p className={styles.opportunityExplainText}>
                        현재 값: 노출 {numberFormatter.format(kw.impressions)}회 · CTR {decimalFormatter.format(kw.ctr)}% · 평균 순위{" "}
                        {decimalFormatter.format(kw.position)} ({positionBucket(kw.position)})
                      </p>
                    </div>

                    <div className={styles.opportunityMetrics}>
                      <div className={styles.opportunityMetricCard}>
                        <div className={styles.opportunityMetricLabel}>클릭</div>
                        <div className={styles.opportunityMetricValue}>{numberFormatter.format(kw.clicks)}</div>
                      </div>
                      <div className={styles.opportunityMetricCard}>
                        <div className={styles.opportunityMetricLabel}>노출</div>
                        <div className={styles.opportunityMetricValue}>{numberFormatter.format(kw.impressions)}</div>
                      </div>
                      <div className={styles.opportunityMetricCard}>
                        <div className={styles.opportunityMetricLabel}>CTR</div>
                        <div className={styles.opportunityMetricValue}>{decimalFormatter.format(kw.ctr)}%</div>
                      </div>
                      <div className={styles.opportunityMetricCard}>
                        <div className={styles.opportunityMetricLabel}>평균 순위</div>
                        <div className={styles.opportunityMetricValue}>{decimalFormatter.format(kw.position)}</div>
                      </div>
                    </div>

                    <div className={styles.opportunityReason}>
                      <h4 className={styles.opportunitySubTitle}>왜 &quot;기회&quot;인가?</h4>
                      <ul className={styles.opportunityList}>
                        <li>노출이 높아(검색 수요/가시성) 개선 시 클릭 증가 여지가 큽니다.</li>
                        <li>CTR이 낮아(스니펫/의도/경쟁) 제목·설명·구조 개선만으로도 성과가 바로 반영될 수 있습니다.</li>
                        <li>평균 순위가 10~20 구간이면, 1페이지 진입/상단 이동 시 CTR 상승 폭이 큽니다.</li>
                      </ul>
                    </div>

                    <div className={styles.opportunityPotential}>
                      <h4 className={styles.opportunitySubTitle}>클릭 잠재력(단순 추정)</h4>
                      <ul className={styles.opportunityList}>
                        <li>
                          CTR {CTR_THRESHOLD_PCT}%만 되어도 예상 클릭{" "}
                          {numberFormatter.format(expectedClicksAt2Pct)}회
                          {additionalAt2Pct > 0 ? ` (약 +${numberFormatter.format(additionalAt2Pct)}회)` : ""}
                        </li>
                        <li>
                          CTR 4%면 예상 클릭 {numberFormatter.format(expectedClicksAt4Pct)}회
                          {additionalAt4Pct > 0 ? ` (약 +${numberFormatter.format(additionalAt4Pct)}회)` : ""}
                        </li>
                      </ul>
                      <p className={styles.opportunityNote}>
                        * 동일 노출을 가정한 단순 계산이며, 실제 클릭은 순위/경쟁/계절성/스니펫 구성에 따라 달라질 수 있습니다.
                      </p>
                    </div>

                    <div className={styles.opportunityActions}>
                      <h4 className={styles.opportunitySubTitle}>추천 액션</h4>
                      <ol className={styles.opportunityOl}>
                        <li>검색 의도에 맞춘 타이틀/메타디스크립션 개선(핵심 키워드 포함 + 가치 제안).</li>
                        <li>상단에 &quot;한 줄 결론 + 핵심 요약&quot;을 추가해 스니펫(설명) 품질을 올립니다.</li>
                        <li>FAQ 섹션 추가 + FAQPage 스키마로 CTR/리치 결과를 노립니다.</li>
                        <li>내부 링크(관련 칼럼 ↔ 제품/검사 페이지)로 페이지 권한과 연관성을 강화합니다.</li>
                        <li>콘텐츠 갱신(최신 정보/근거/표/목록)으로 상위 10위 진입을 목표로 개선합니다.</li>
                      </ol>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
