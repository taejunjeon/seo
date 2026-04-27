"use client";

import { useEffect, useState } from "react";
import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import ImpactBadge from "./ImpactBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const SITE = "sc-domain:biocom.kr";

type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

type RangeResult = {
  range: 7 | 28 | 90;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
};

const numFmt = new Intl.NumberFormat("ko-KR");

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchSummary(days: 7 | 28 | 90): Promise<RangeResult> {
  // GSC has 2-3 day reporting delay
  const endDate = daysAgo(3);
  const startDate = daysAgo(2 + days);

  const queryBody = {
    siteUrl: SITE,
    startDate,
    endDate,
    rowLimit: 25000,
    dimensions: ["date"],
  };
  const queryQueriesBody = {
    siteUrl: SITE,
    startDate,
    endDate,
    rowLimit: 5,
    dimensions: ["query"],
  };
  const queryPagesBody = {
    siteUrl: SITE,
    startDate,
    endDate,
    rowLimit: 5,
    dimensions: ["page"],
  };

  const [dateRes, queryRes, pageRes] = await Promise.all([
    fetch(`${API_BASE}/api/gsc/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryBody),
    }).then((r) => r.json()),
    fetch(`${API_BASE}/api/gsc/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryQueriesBody),
    }).then((r) => r.json()),
    fetch(`${API_BASE}/api/gsc/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryPagesBody),
    }).then((r) => r.json()),
  ]);

  const dateRows: Row[] = dateRes.rows ?? [];
  let clicks = 0, impressions = 0, posSum = 0;
  for (const r of dateRows) {
    clicks += r.clicks ?? 0;
    impressions += r.impressions ?? 0;
    posSum += r.position ?? 0;
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = dateRows.length > 0 ? posSum / dateRows.length : 0;

  const topQueries = (queryRes.rows ?? []).map((r: Row) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  const topPages = (pageRes.rows ?? []).map((r: Row) => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));

  return { range: days, startDate, endDate, clicks, impressions, ctr, position, topQueries, topPages };
}

export default function BaselineSection() {
  const [data, setData] = useState<Record<7 | 28 | 90, RangeResult | null>>({ 7: null, 28: null, 90: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"query" | "page">("query");

  useEffect(() => {
    (async () => {
      try {
        const [r7, r28, r90] = await Promise.all([fetchSummary(7), fetchSummary(28), fetchSummary(90)]);
        setData({ 7: r7, 28: r28, 90: r90 });
      } catch (e) {
        setError(e instanceof Error ? e.message : "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section id="baseline" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>운영 반영 전 성과 기준선 (baseline)</h2>
          <ImpactBadge variant="live-data" />
        </div>
        <span className={styles.sectionTag}>backend /api/gsc/query · sc-domain:biocom.kr · 7/28/90일</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 무엇을 위한 것인가요">
        <p style={{ marginBottom: 8 }}>
          SEO 작업을 하기 <strong>전에</strong> 「지금 우리가 어디에 있는지」를 7일 / 28일 / 90일 3가지 기간으로 찍어둡니다.
          나중에 작업을 반영하고 7~28일이 지난 뒤 같은 기간 데이터를 다시 찍어 비교하면, 효과가 있었는지 객관적으로 판단할 수 있습니다.
        </p>
        <p>
          숫자: <strong>구글 검색 성과(GSC)</strong> 기준 - 클릭(실제 사이트 방문) · 노출(검색결과에 보여진 횟수) · CTR(노출 대비 클릭률) · 평균 순위(검색결과 평균 위치).
          기간이 길수록 데이터가 안정적이지만, 변화 감지는 7일이 빠릅니다. 셋 다 비교해야 진짜 변화인지 자연 변동인지 알 수 있습니다.
        </p>
      </WhyCallout>

      {loading && <p className={styles.sectionEmpty}>3개 기간 데이터 불러오는 중…</p>}
      {error && (
        <WhyCallout tone="warning" title="baseline 데이터를 불러오지 못했습니다">
          백엔드(<code>{API_BASE}</code>) 응답 오류: <code>{error}</code>.
        </WhyCallout>
      )}

      {!loading && !error && (
        <>
          <div className={styles.baselineGrid}>
            {([7, 28, 90] as const).map((d) => {
              const r = data[d];
              if (!r) return null;
              return (
                <article key={d} className={styles.baselineCard}>
                  <div className={styles.baselineCardHead}>
                    <span className={styles.baselineRange}>최근 {d}일</span>
                    <span className={styles.baselineDates}>{r.startDate} ~ {r.endDate}</span>
                  </div>
                  <div className={styles.baselineMetrics}>
                    <div>
                      <div className={styles.baselineMetricLabel}>클릭</div>
                      <div className={styles.baselineMetricValue}>{numFmt.format(r.clicks)}</div>
                    </div>
                    <div>
                      <div className={styles.baselineMetricLabel}>노출</div>
                      <div className={styles.baselineMetricValue}>{numFmt.format(r.impressions)}</div>
                    </div>
                    <div>
                      <div className={styles.baselineMetricLabel}>CTR</div>
                      <div className={styles.baselineMetricValue}>{(r.ctr * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className={styles.baselineMetricLabel}>평균 순위</div>
                      <div className={styles.baselineMetricValue}>{r.position.toFixed(1)}위</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.baselineTabBar}>
            <button type="button" className={`${styles.baselineTab} ${tab === "query" ? styles.baselineTabActive : ""}`} onClick={() => setTab("query")}>
              검색어 TOP5
            </button>
            <button type="button" className={`${styles.baselineTab} ${tab === "page" ? styles.baselineTabActive : ""}`} onClick={() => setTab("page")}>
              페이지 TOP5
            </button>
            <span className={styles.baselineTabHint}>
              ※ 구글 검색 콘솔 API는 모든 행을 반환하지 않고 상위 데이터 위주로 제공합니다. 정확한 전수 비교에는 한계가 있습니다.
            </span>
          </div>

          <div className={styles.baselineCompareGrid}>
            {([7, 28, 90] as const).map((d) => {
              const r = data[d];
              if (!r) return null;
              const rows = tab === "query" ? r.topQueries : r.topPages;
              return (
                <div key={d} className={styles.baselineCompareCol}>
                  <h4 className={styles.baselineCompareH}>최근 {d}일</h4>
                  <ol className={styles.baselineRankList}>
                    {rows.length === 0 && <li className={styles.baselineRankEmpty}>데이터 없음</li>}
                    {rows.map((row, i) => {
                      const label = tab === "query" ? (row as { query: string }).query : (row as { page: string }).page.replace("https://biocom.kr", "");
                      return (
                        <li key={i}>
                          <span className={styles.baselineRankIdx}>{i + 1}</span>
                          <span className={styles.baselineRankLabel} title={label}>{label.length > 40 ? `${label.slice(0, 40)}…` : label}</span>
                          <span className={styles.baselineRankNums}>{numFmt.format(row.clicks)}c / {numFmt.format(row.impressions)}i</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>

          <WhyCallout tone="success" title="작업 반영 후 어떻게 비교하나요">
            예: B 승인안에서 만든 URL 정리 요청서를 아임웹에 반영한 뒤 14일 기다리면, 다음 라운드의 baseline과 이번 baseline을 같은 표로 띄울 수 있습니다.
            클릭이 늘었는지, 같은 노출에서 CTR이 올라갔는지, 평균 순위가 좋아졌는지 한 화면에서 확인 가능합니다.
          </WhyCallout>
        </>
      )}
    </section>
  );
}
