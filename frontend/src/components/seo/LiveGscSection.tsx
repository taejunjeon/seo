"use client";

import { useEffect, useState } from "react";
import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import Glossary from "./Glossary";
import ImpactBadge from "./ImpactBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type GscKpi = {
  current: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  previous: { clicks: number; impressions: number; ctr: number; avgPosition: number; days: number };
  delta: { clicks: number; ctr: number; position: number };
  sparklines: { clicks: number[]; ctr: number[]; position: number[] };
};

const numFmt = new Intl.NumberFormat("ko-KR");

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length === 0) {
    return <svg width="80" height="24" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const step = w / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function deltaClass(value: number, lowerIsBetter = false): string {
  if (value === 0) return styles.deltaFlat;
  const positive = lowerIsBetter ? value < 0 : value > 0;
  return positive ? styles.deltaUp : styles.deltaDown;
}

function deltaArrow(value: number, lowerIsBetter = false): string {
  if (value === 0) return "→";
  const positive = lowerIsBetter ? value < 0 : value > 0;
  return positive ? "▲" : "▼";
}

export default function LiveGscSection() {
  const [data, setData] = useState<GscKpi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/gsc/kpi`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GscKpi;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section id="live-gsc" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>지금 구글 검색 성과 <span className={styles.sectionHTech}>(GSC 라이브 KPI · 7일)</span></h2>
          <ImpactBadge variant="live-data" />
        </div>
        <span className={styles.sectionTag}>backend /api/gsc/kpi · sc-domain:biocom.kr</span>
      </div>

      <WhyCallout tone="info" title="이 카드는 무엇을 보여주나요">
        <Glossary term="구글 검색 성과 (GSC)" short="Google Search Console — 구글이 우리 사이트에 직접 보내주는 공식 검색 통계 도구.">
          어떤 키워드로 노출됐는지, 클릭됐는지, 평균 순위가 몇 위인지 등을 매일 업데이트해줍니다.
        </Glossary>
        의 최근 7일 데이터입니다. 위쪽 정적 진단(<code>reports/seo/*</code>)은 운영 영향이 없는 사진 한 장이라면, 이 카드는 살아 있는 검색 성과를 보여줍니다.
        지금 우리가 SEO 작업을 하는 이유는 결국 <strong>이 4개 숫자</strong>를 좋아지게 만들기 위함입니다.
      </WhyCallout>

      {loading && <p className={styles.sectionEmpty}>최근 7일 검색 데이터 불러오는 중…</p>}
      {error && (
        <WhyCallout tone="warning" title="GSC 데이터를 불러오지 못했습니다">
          백엔드(<code>{API_BASE}</code>) 응답 오류: <code>{error}</code>. 백엔드 서버가 7020 포트에서 동작 중인지, 서비스 계정이 GSC 속성에 추가되어 있는지 확인해주세요.
        </WhyCallout>
      )}

      {data && (
        <>
          <div className={styles.gscKpiGrid}>
            <article className={styles.gscKpiCard}>
              <div className={styles.gscKpiTop}>
                <div className={styles.gscKpiLabel}>클릭수</div>
                <Sparkline values={data.sparklines.clicks} color="#0d9488" />
              </div>
              <div className={styles.gscKpiValue}>{numFmt.format(data.current.clicks)}</div>
              <div className={styles.gscKpiSub}>
                지난 7일 vs 이전 7일{" "}
                <span className={deltaClass(data.delta.clicks)}>
                  {deltaArrow(data.delta.clicks)} {Math.abs(data.delta.clicks)}%
                </span>
                {" "}({numFmt.format(data.previous.clicks)} → {numFmt.format(data.current.clicks)})
              </div>
              <div className={styles.gscKpiHelp}>실제 검색 결과에서 우리 사이트가 클릭된 횟수. <strong>SEO 작업의 최종 목표 지표</strong>.</div>
            </article>

            <article className={styles.gscKpiCard}>
              <div className={styles.gscKpiTop}>
                <div className={styles.gscKpiLabel}>노출수</div>
                <Sparkline values={data.sparklines.clicks.map((_, i) => data.sparklines.ctr[i] || 0)} color="#3b82f6" />
              </div>
              <div className={styles.gscKpiValue}>{numFmt.format(data.current.impressions)}</div>
              <div className={styles.gscKpiSub}>
                {numFmt.format(data.previous.impressions)} → {numFmt.format(data.current.impressions)}
              </div>
              <div className={styles.gscKpiHelp}>검색 결과에 우리 페이지가 보여진 횟수. <strong>색인·노출 범위가 늘면 함께 늘어남</strong> (SEO 진단 점수가 직접적으로 영향).</div>
            </article>

            <article className={styles.gscKpiCard}>
              <div className={styles.gscKpiTop}>
                <div className={styles.gscKpiLabel}>CTR (클릭률)</div>
                <Sparkline values={data.sparklines.ctr} color="#f59e0b" />
              </div>
              <div className={styles.gscKpiValue}>{(data.current.ctr * 100).toFixed(2)}%</div>
              <div className={styles.gscKpiSub}>
                지난 7일 vs 이전 7일{" "}
                <span className={deltaClass(data.delta.ctr)}>
                  {deltaArrow(data.delta.ctr)} {Math.abs(data.delta.ctr)}%p
                </span>
              </div>
              <div className={styles.gscKpiHelp}>노출 대비 클릭 비율. <strong>title·description·JSON-LD가 매력적일수록 올라감</strong>. SEO 작업 즉효 지표.</div>
            </article>

            <article className={styles.gscKpiCard}>
              <div className={styles.gscKpiTop}>
                <div className={styles.gscKpiLabel}>평균 순위</div>
                <Sparkline values={data.sparklines.position.map((p) => -p)} color="#8b5cf6" />
              </div>
              <div className={styles.gscKpiValue}>{data.current.avgPosition.toFixed(1)}<span className={styles.gscKpiUnit}>위</span></div>
              <div className={styles.gscKpiSub}>
                지난 7일 vs 이전 7일{" "}
                <span className={deltaClass(data.delta.position, true)}>
                  {deltaArrow(data.delta.position, true)} {Math.abs(data.delta.position)}계단
                </span>
              </div>
              <div className={styles.gscKpiHelp}>검색 결과에서 우리 페이지가 평균 몇 번째에 뜨는지. <strong>낮을수록 좋음</strong> (1위가 가장 좋음).</div>
            </article>
          </div>

          <WhyCallout tone="success" title="이 데이터를 어떻게 활용하나요">
            <strong>운영 반영 후 추적</strong>: JSON-LD 삽입·텍스트 블록 추가·canonical 정리를 한 뒤 7일~14일 단위로 이 4개 숫자가 어떻게 바뀌는지 봅니다.
            노출은 빨리(1~2주), 클릭은 중간(2~4주), 평균 순위는 천천히(4~8주) 반응합니다.
            특정 작업이 효과 없으면 롤백 기준에 따라 되돌립니다 (운영 체크리스트 참고).
          </WhyCallout>
        </>
      )}
    </section>
  );
}
