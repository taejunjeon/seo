"use client";

import { useMemo } from "react";
import styles from "@/app/page.module.css";
import { LiveBadge, NoDataBadge } from "@/components/common/Badges";
import DataTable from "@/components/common/DataTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { numberFormatter, decimalFormatter, resolveContentUrl } from "@/utils/pageUtils";
import type { ColumnData, KeywordRangePreset } from "@/types/page";

type ColRow = ColumnData & Record<string, unknown>;

type Props = {
  columnsData: unknown;
  columnPagesData: unknown;
  colRangePreset: KeywordRangePreset;
  setColRangePreset: (v: KeywordRangePreset) => void;
  colDatePickerOpen: boolean;
  setColDatePickerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  colStartInput: string;
  setColStartInput: (v: string) => void;
  colEndInput: string;
  setColEndInput: (v: string) => void;
  columnsDateRange: { start: string; end: string } | null;
  colLoading: boolean;
  columnKpis: { total: number; clicked: number; clickedRate: number; top10AvgCtr: number; avgScore: number };
  columnOnlyPages: ColumnData[];
  otherPages: ColumnData[];
  loadColumns: (opts: { days?: 7 | 30; startDate?: string; endDate?: string }) => Promise<void>;
};

/** 공통 칼럼 정의 생성 */
function makeColColumns(): DataTableColumn<ColRow>[] {
  return [
    {
      key: "title", label: "칼럼", sortable: true, width: "35%",
      render: (_v, row) => {
        const href = resolveContentUrl(row.url as string);
        return (
          <a href={href || undefined} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }} title={row.title as string}>
            <div className={styles.columnTitleCell}>{row.title as string}</div>
            <div className={styles.columnUrlCell}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {(row.url as string).replace("https://biocom.kr", "")}
            </div>
          </a>
        );
      },
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
      key: "aeo", label: "AEO", sortable: true, align: "center", width: "110px",
      render: (v) => {
        const aeo = (v as number) ?? 0;
        /* AEO는 0~15 범위(15%가중). 100점 환산하여 색상 결정 */
        const pct100 = Math.min(100, Math.round((aeo / 15) * 100));
        const barColor = pct100 >= 70 ? "#10B981" : pct100 >= 40 ? "#F59E0B" : "#EF4444";
        return (
          <div className={styles.aeoBarWrap}>
            <div className={styles.aeoBarTrack}>
              <div className={styles.aeoBarFill} style={{ width: `${pct100}%`, background: barColor }} />
            </div>
            <span className={styles.aeoBarValue}>{aeo.toFixed(1)}</span>
          </div>
        );
      },
    },
    {
      key: "score", label: "종합", sortable: true, align: "center",
      render: (_v, row) => {
        const score = (row.score as number) ?? 0;
        const scoreCls = score >= 40 ? styles.scoreNumberGood : score >= 25 ? styles.scoreNumberWarn : styles.scoreNumberPoor;
        return (
          <div className={styles.scoreBarWrap}>
            <div className={styles.scoreBarTrack}>
              <div className={`${styles.scoreSegment} ${styles.scoreSegmentSearch}`} style={{ width: `${row.search}%` }} />
              <div className={`${styles.scoreSegment} ${styles.scoreSegmentTech}`} style={{ width: `${row.tech}%` }} />
              <div className={`${styles.scoreSegment} ${styles.scoreSegmentEngage}`} style={{ width: `${row.engage}%` }} />
              <div className={`${styles.scoreSegment} ${styles.scoreSegmentAeo}`} style={{ width: `${row.aeo}%` }} />
            </div>
            <span className={`${styles.scoreNumber} ${scoreCls}`}>{score}</span>
          </div>
        );
      },
    },
  ];
}

export default function ColumnAnalysisTab({
  columnsData, columnPagesData, colRangePreset, setColRangePreset,
  colDatePickerOpen, setColDatePickerOpen, colStartInput, setColStartInput,
  colEndInput, setColEndInput, columnsDateRange, colLoading,
  columnKpis, columnOnlyPages, otherPages, loadColumns,
}: Props) {

  const colColumns = useMemo(() => makeColColumns(), []);
  const otherColumns = useMemo((): DataTableColumn<ColRow>[] => {
    const cols = makeColColumns();
    cols[0] = { ...cols[0], label: "페이지" };
    return cols;
  }, []);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>칼럼별 성과 분석{(columnsData || columnPagesData) ? <LiveBadge /> : <NoDataBadge />}</h2>
          <div className={`${styles.sectionMeta} ${styles.keywordMeta}`}>
            <div className={styles.keywordMetaTop}>
              <div className={styles.keywordRangeBtns}>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${colRangePreset === "7d" ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => { setColRangePreset("7d"); setColDatePickerOpen(false); void loadColumns({ days: 7 }); }}
                  disabled={colLoading}
                >7일</button>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${colRangePreset === "30d" ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => { setColRangePreset("30d"); setColDatePickerOpen(false); void loadColumns({ days: 30 }); }}
                  disabled={colLoading}
                >30일</button>
                <button
                  type="button"
                  className={`${styles.trendPeriodBtn} ${colRangePreset === "custom" || colDatePickerOpen ? styles.trendPeriodBtnActive : ""}`}
                  onClick={() => setColDatePickerOpen((p: boolean) => !p)}
                  disabled={colLoading}
                  title="기간 직접 지정"
                >📅</button>
              </div>
              <span className={styles.keywordRangeText}>
                {(columnsData || columnPagesData)
                  ? `📅 ${columnsDateRange?.start ?? ""} ~ ${columnsDateRange?.end ?? ""} (${colRangePreset === "7d" ? "최근 7일" : colRangePreset === "30d" ? "최근 30일" : "기간 지정"}) · GSC 실데이터`
                  : "GSC 데이터 조회 필요"
                }
              </span>
            </div>
            <span className={styles.keywordMetaBottom}>
              {colLoading ? "조회 중... · " : ""}종합 스코어 = 검색 40% + 기술 20% + 체류 25% + AEO/GEO 15%
            </span>
          </div>
        </div>
        {colDatePickerOpen && (
          <div className={styles.keywordDatePicker}>
            <div className={styles.dateInputs}>
              <label className={styles.fieldLabel}>시작일<input type="date" value={colStartInput} onChange={(e) => setColStartInput(e.target.value)} required /></label>
              <label className={styles.fieldLabel}>종료일<input type="date" value={colEndInput} onChange={(e) => setColEndInput(e.target.value)} required /></label>
            </div>
            <div className={styles.keywordDateActions}>
              <button
                type="button"
                className={styles.keywordActionBtn}
                onClick={() => {
                  if (!colStartInput || !colEndInput || colStartInput > colEndInput) return;
                  setColRangePreset("custom");
                  setColDatePickerOpen(false);
                  void loadColumns({ startDate: colStartInput, endDate: colEndInput });
                }}
                disabled={colLoading}
              >적용</button>
              <button type="button" className={styles.keywordActionBtn} onClick={() => setColDatePickerOpen(false)} disabled={colLoading}>닫기</button>
            </div>
          </div>
        )}
        <div className={styles.miniKpiGrid}>
          <div className={styles.miniKpiCard}>
            <div className={styles.miniKpiLabel}>총 칼럼 수</div>
            <div className={styles.miniKpiValue}>{numberFormatter.format(columnKpis.total)}개</div>
            <div className={styles.miniKpiSub}>/healthinfo, /what_biohacking 기준</div>
          </div>
          <div className={styles.miniKpiCard}>
            <div className={styles.miniKpiLabel}>클릭 발생 칼럼</div>
            <div className={styles.miniKpiValue}>{numberFormatter.format(columnKpis.clicked)}개</div>
            <div className={styles.miniKpiSub}>클릭 &gt; 0 ({columnKpis.clickedRate.toFixed(0)}%)</div>
          </div>
          <div className={styles.miniKpiCard}>
            <div className={styles.miniKpiLabel}>TOP 10 평균 CTR</div>
            <div className={styles.miniKpiValue}>{decimalFormatter.format(columnKpis.top10AvgCtr)}%</div>
            <div className={styles.miniKpiSub}>종합 스코어 상위 10개 평균</div>
          </div>
          <div className={styles.miniKpiCard}>
            <div className={styles.miniKpiLabel}>종합 스코어 평균</div>
            <div className={styles.miniKpiValue}>{columnKpis.avgScore.toFixed(1)}점</div>
            <div className={styles.miniKpiSub}>전체 칼럼 평균(0~100)</div>
          </div>
        </div>
        {columnOnlyPages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>{columnsData || columnPagesData ? "해당 기간에 칼럼 성과 데이터가 없습니다." : "칼럼 데이터가 없습니다. GSC API 연결 후 자동으로 표시됩니다."}</p>
            </div>
          </div>
        ) : (
          <DataTable<ColRow>
            columns={colColumns}
            data={columnOnlyPages as ColRow[]}
            defaultSortKey="clicks"
            searchKeys={["title", "url"]}
            searchPlaceholder="칼럼 검색..."
            pageSize={20}
          />
        )}
        <div className={styles.scoreLegend}>
          <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#0D9488" }} /> 검색 성과 (40%)</span>
          <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#2563eb" }} /> 기술 성능 (20%)</span>
          <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#f59e0b" }} /> 사용자 체류 (25%)</span>
          <span className={styles.scoreLegendItem}><span className={styles.scoreLegendDot} style={{ background: "#8b5cf6" }} /> AEO/GEO (15%)</span>
        </div>
      </section>

      {/* 섹션 구분 디바이더 */}
      <div className={styles.sectionDivider}>
        <div className={styles.sectionDividerLine} />
        <span className={styles.sectionDividerText}>기타 페이지 분석</span>
        <div className={styles.sectionDividerLine} />
      </div>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>상품 및 기타 페이지 성과 분석{columnsData ? <LiveBadge /> : <NoDataBadge />}</h2>
          <span className={styles.sectionMeta}>
            {columnsData
              ? `📅 ${columnsDateRange?.start ?? ""} ~ ${columnsDateRange?.end ?? ""} (최근 7일) · GSC 실데이터`
              : "GSC 데이터 조회 필요"
            } · 칼럼(/healthinfo, /what_biohacking) 제외
          </span>
        </div>
        {otherPages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>해당 기간에 상품/기타 페이지 성과 데이터가 없습니다.</p>
            </div>
          </div>
        ) : (
          <DataTable<ColRow>
            columns={otherColumns}
            data={otherPages as ColRow[]}
            defaultSortKey="clicks"
            searchKeys={["title", "url"]}
            searchPlaceholder="페이지 검색..."
            pageSize={20}
          />
        )}
      </section>
    </>
  );
}
