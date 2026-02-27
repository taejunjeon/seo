"use client";

import styles from "@/app/page.module.css";
import type { CwvPageData, PageSpeedApiResult } from "@/types/page";
import { ScoreGauge, cwvStatus, LiveBadge, LoadingBadge, NoDataBadge } from "@/components/common/Badges";
import { numberFormatter, gaugeColor } from "@/utils/pageUtils";

type Props = {
  cwvHasReal: boolean;
  cwvPages: CwvPageData[];
  cwvAvg: { performance: number; seo: number; accessibility: number };
  cwvStrategy: "mobile" | "desktop";
  setCwvStrategy: (s: "mobile" | "desktop") => void;
  cwvTestUrl: string;
  setCwvTestUrl: (url: string) => void;
  cwvLoading: boolean;
  handleCwvTest: () => void;
  pageSpeedHistory: PageSpeedApiResult[] | null;
  pageSpeedHistoryLoading: boolean;
  pageSpeedHistoryError: string | null;
  loadPageSpeedHistory: (opts: { limit: number }) => Promise<void>;
};

export default function CoreWebVitalsTab({
  cwvHasReal, cwvPages, cwvAvg, cwvStrategy, setCwvStrategy,
  cwvTestUrl, setCwvTestUrl, cwvLoading, handleCwvTest,
  pageSpeedHistory, pageSpeedHistoryLoading, pageSpeedHistoryError,
  loadPageSpeedHistory,
}: Props) {
  return (
    <>
      {/* 상단 설명 + 테스트 */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>페이지 속도 진단{cwvHasReal ? <LiveBadge /> : pageSpeedHistoryLoading ? <LoadingBadge /> : <NoDataBadge />}</h2>
          <div className={styles.strategyToggle}>
            <button type="button" className={`${styles.strategyBtn} ${cwvStrategy === "mobile" ? styles.strategyBtnActive : ""}`} onClick={() => setCwvStrategy("mobile")}>📱 모바일</button>
            <button type="button" className={`${styles.strategyBtn} ${cwvStrategy === "desktop" ? styles.strategyBtnActive : ""}`} onClick={() => setCwvStrategy("desktop")}>🖥️ 데스크톱</button>
          </div>
        </div>
        <p className={styles.cwvDesc}>
          Core Web Vitals(핵심 웹 지표)는 <strong>구글이 검색 순위에 반영</strong>하는 페이지 속도 점수입니다.
          점수가 낮으면 검색 결과에서 불이익을 받을 수 있으며, 사용자 이탈률도 높아집니다.
        </p>

        {/* 종합 점수 게이지 */}
        {cwvPages.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyContent}>
              <p>CWV 측정 데이터가 없습니다. 아래에서 URL을 입력하여 속도를 측정해 보세요.</p>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.cwvGrid}>
              {([
                ["종합 성능", "페이지가 얼마나 빠르게 로딩되는지 종합 평가", cwvAvg.performance],
                ["검색 최적화 (SEO)", "검색엔진이 페이지를 잘 이해할 수 있는지 평가", cwvAvg.seo],
                ["접근성", "모든 사용자가 불편 없이 이용할 수 있는지 평가", cwvAvg.accessibility],
              ] as [string, string, number][]).map(([label, desc, score]) => (
                <div key={label} className={styles.cwvScoreCard}>
                  <ScoreGauge score={score} size={100} color={gaugeColor(score)} />
                  <span className={styles.cwvScoreLabel}>{label}</span>
                  <span className={styles.cwvScoreDesc}>{desc}</span>
                </div>
              ))}
            </div>
            <div className={styles.cwvScaleGuide}>
              <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#10B981" }} /> 90~100 좋음</span>
              <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#F59E0B" }} /> 50~89 개선 필요</span>
              <span className={styles.cwvScaleItem}><span className={styles.cwvScaleDot} style={{ background: "#dc2626" }} /> 0~49 나쁨</span>
            </div>
          </>
        )}
      </section>

      {/* URL 테스트 */}
      <section className={styles.card}>
        <h3 className={styles.cwvSectionSub}>직접 측정하기</h3>
        <p className={styles.cwvDescSmall}>URL을 입력하면 Google PageSpeed API로 실시간 측정합니다. 측정에 15~30초 소요됩니다.</p>
        <div className={styles.cwvTestForm}>
          <input
            type="url"
            className={styles.cwvTestInput}
            value={cwvTestUrl}
            onChange={(e) => setCwvTestUrl(e.target.value)}
            placeholder="https://biocom.kr"
          />
          <button
            type="button"
            className={styles.cwvTestBtn}
            onClick={handleCwvTest}
            disabled={cwvLoading || !cwvTestUrl}
          >
            {cwvLoading ? "측정 중... (15~30초)" : "⚡ 속도 측정 시작"}
          </button>
        </div>
      </section>

      {/* 측정 리포트 */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.cwvSectionSub}>측정 리포트</h3>
          <button
            type="button"
            className={styles.trendPeriodBtn}
            onClick={() => void loadPageSpeedHistory({ limit: 50 })}
            disabled={pageSpeedHistoryLoading}
          >
            {pageSpeedHistoryLoading ? "불러오는 중..." : "새로고침"}
          </button>
        </div>
        <p className={styles.cwvDescSmall}>&quot;⚡ 속도 측정 시작&quot;을 누를 때마다 기록이 누적됩니다. (최근 50건)</p>
        {pageSpeedHistoryError ? <p className={styles.error}>오류: {pageSpeedHistoryError}</p> : null}

        {pageSpeedHistory && pageSpeedHistory.length > 0 ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>측정 시각</th>
                  <th>페이지</th>
                  <th>전략</th>
                  <th title="종합 성능 점수">성능</th>
                  <th title="검색 최적화 점수">SEO</th>
                  <th title="최대 콘텐츠 표시 시간">LCP</th>
                  <th title="첫 콘텐츠 표시 시간">FCP</th>
                </tr>
              </thead>
              <tbody>
                {pageSpeedHistory.map((r) => {
                  const href = r.url;
                  const label = r.url.replace(/^https?:\/\//, "");
                  return (
                    <tr key={`${r.measuredAt}:${r.strategy}:${r.url}`}>
                      <td className={styles.numCell}>{new Date(r.measuredAt).toLocaleString("ko-KR")}</td>
                      <td className={styles.queryCell}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "none" }}
                          title={href}
                        >
                          {label}
                        </a>
                      </td>
                      <td>{r.strategy === "mobile" ? "모바일" : "데스크톱"}</td>
                      <td className={styles.numCell}>{r.performanceScore}</td>
                      <td className={styles.numCell}>{r.seoScore}</td>
                      <td className={`${styles.numCell} ${cwvStatus("lcp", r.lcpMs).cls}`}>{r.lcpMs >= 1000 ? `${(r.lcpMs / 1000).toFixed(1)}초` : `${r.lcpMs}ms`}</td>
                      <td className={`${styles.numCell} ${cwvStatus("fcp", r.fcpMs).cls}`}>{r.fcpMs >= 1000 ? `${(r.fcpMs / 1000).toFixed(1)}초` : `${r.fcpMs}ms`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.cwvDescSmall} style={{ margin: 0 }}>아직 측정 기록이 없습니다.</p>
        )}
      </section>

      {/* 세부 지표 카드 */}
      <section className={styles.card}>
        <h3 className={styles.cwvSectionSub}>세부 속도 지표</h3>
        <p className={styles.cwvDescSmall}>각 지표가 무엇을 의미하는지, 현재 수치가 어떤 수준인지 확인하세요.</p>
        {(() => {
          const avg = {
            lcp: Math.round(cwvPages.reduce((s, p) => s + p.lcp, 0) / cwvPages.length),
            fcp: Math.round(cwvPages.reduce((s, p) => s + p.fcp, 0) / cwvPages.length),
            cls: +(cwvPages.reduce((s, p) => s + p.cls, 0) / cwvPages.length).toFixed(2),
            inp: Math.round(cwvPages.reduce((s, p) => s + p.inp, 0) / cwvPages.length),
            ttfb: Math.round(cwvPages.reduce((s, p) => s + p.ttfb, 0) / cwvPages.length),
          };
          const metrics: { key: string; abbr: string; label: string; desc: string; value: number; unit: string; goodThreshold: string; diagnosis: (v: number) => string }[] = [
            {
              key: "lcp", abbr: "LCP", label: "최대 콘텐츠 표시 시간",
              desc: "페이지에서 가장 큰 이미지나 텍스트가 화면에 보이기까지 걸리는 시간입니다. 사용자가 '페이지가 열렸다'고 느끼는 시점입니다.",
              value: avg.lcp, unit: "ms", goodThreshold: "2.5초 이하",
              diagnosis: (v) => v <= 2500 ? "빠르게 로딩되고 있습니다." : v <= 4000 ? "다소 느립니다. 메인 이미지 최적화를 검토하세요." : `${(v / 1000).toFixed(1)}초로 매우 느립니다. 이미지 압축, 서버 응답 속도 개선이 시급합니다.`,
            },
            {
              key: "fcp", abbr: "FCP", label: "첫 콘텐츠 표시 시간",
              desc: "페이지를 열었을 때 텍스트나 이미지 등 무언가가 처음 화면에 나타나기까지 걸리는 시간입니다.",
              value: avg.fcp, unit: "ms", goodThreshold: "1.8초 이하",
              diagnosis: (v) => v <= 1800 ? "빠르게 첫 화면이 표시됩니다." : v <= 3000 ? "첫 화면 표시가 다소 느립니다. CSS 인라인화를 검토하세요." : `${(v / 1000).toFixed(1)}초로 첫 화면 표시가 매우 느립니다. 렌더링 차단 리소스 제거가 필요합니다.`,
            },
            {
              key: "cls", abbr: "CLS", label: "레이아웃 흔들림",
              desc: "페이지 로딩 중 요소들이 갑자기 위치가 바뀌는 현상입니다. 광고나 이미지가 늦게 로드되면서 버튼 위치가 바뀌어 잘못 클릭하게 되는 문제입니다.",
              value: avg.cls, unit: "", goodThreshold: "0.1 이하",
              diagnosis: (v) => v <= 0.1 ? "레이아웃이 안정적입니다. 좋은 상태입니다." : v <= 0.25 ? "가끔 요소 위치가 바뀝니다. 이미지에 크기를 지정하세요." : "레이아웃 흔들림이 심합니다. 이미지/광고 영역에 고정 크기를 설정하세요.",
            },
            {
              key: "inp", abbr: "INP", label: "상호작용 반응 속도",
              desc: "버튼 클릭이나 입력 등 사용자 조작에 페이지가 반응하기까지 걸리는 시간입니다. 느리면 '먹통'으로 느껴집니다.",
              value: avg.inp, unit: "ms", goodThreshold: "200ms 이하",
              diagnosis: (v) => v === 0 ? "측정 데이터가 없습니다. (사용자 상호작용이 감지되지 않음)" : v <= 200 ? "사용자 클릭에 빠르게 반응합니다." : v <= 500 ? "클릭 반응이 다소 느립니다. 무거운 JavaScript를 최적화하세요." : "클릭 반응이 매우 느립니다. JavaScript 번들 크기를 줄이세요.",
            },
            {
              key: "ttfb", abbr: "TTFB", label: "서버 응답 시간",
              desc: "브라우저가 서버에 요청을 보내고 첫 응답을 받기까지 걸리는 시간입니다. 서버 성능과 네트워크 상태를 반영합니다.",
              value: avg.ttfb, unit: "ms", goodThreshold: "800ms 이하",
              diagnosis: (v) => v <= 800 ? "서버가 빠르게 응답합니다." : v <= 1800 ? "서버 응답이 다소 느립니다. 캐싱이나 CDN 도입을 검토하세요." : `서버 응답에 ${(v / 1000).toFixed(1)}초 소요됩니다. 서버 성능 개선 또는 CDN 도입이 시급합니다.`,
            },
          ];
          return (
            <div className={styles.cwvDetailGrid}>
              {metrics.map((m) => {
                const status = cwvStatus(m.key, m.value);
                return (
                  <div key={m.key} className={`${styles.cwvDetailCard} ${status.statusCls}`}>
                    <div className={styles.cwvDetailTop}>
                      <div>
                        <span className={styles.cwvDetailAbbr}>{m.abbr}</span>
                        <span className={styles.cwvDetailLabel}>{m.label}</span>
                      </div>
                      <div className={styles.cwvDetailValueWrap}>
                        <span className={`${styles.cwvDetailValue} ${status.cls}`}>
                          {m.key === "cls" ? m.value.toFixed(2) : numberFormatter.format(m.value)}
                        </span>
                        <span className={styles.cwvDetailUnit}>{m.unit}</span>
                      </div>
                    </div>
                    <p className={styles.cwvDetailDesc}>{m.desc}</p>
                    <div className={styles.cwvDetailDiagnosis}>
                      <span className={`${styles.cwvDetailStatusBadge} ${status.statusCls}`}>{status.label}</span>
                      <span className={styles.cwvDetailThreshold}>기준: {m.goodThreshold}</span>
                    </div>
                    <p className={styles.cwvDetailComment}>{m.diagnosis(m.value)}</p>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* 페이지별 상세 */}
      <section className={styles.card}>
        <h3 className={styles.cwvSectionSub}>페이지별 측정 결과</h3>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>페이지</th>
                <th title="종합 성능 점수">종합 성능</th>
                <th title="검색 최적화 점수">SEO</th>
                <th title="최대 콘텐츠 표시 시간">LCP</th>
                <th title="첫 콘텐츠 표시 시간">FCP</th>
                <th title="레이아웃 흔들림">CLS</th>
                <th title="상호작용 반응 속도">INP</th>
                <th title="서버 응답 시간">TTFB</th>
              </tr>
            </thead>
            <tbody>
              {cwvPages.map((p) => (
                <tr key={p.url}>
                  <td className={styles.queryCell}>{p.label}</td>
                  <td className={styles.numCell}><span className={gaugeColor(p.performance) === "#10B981" ? styles.cwvGood : gaugeColor(p.performance) === "#F59E0B" ? styles.cwvNeedsImprovement : styles.cwvPoor} style={{ fontWeight: 700 }}>{p.performance}</span></td>
                  <td className={styles.numCell}>{p.seo}</td>
                  <td className={`${styles.numCell} ${cwvStatus("lcp", p.lcp).cls}`}>{p.lcp >= 1000 ? `${(p.lcp / 1000).toFixed(1)}초` : `${p.lcp}ms`}</td>
                  <td className={`${styles.numCell} ${cwvStatus("fcp", p.fcp).cls}`}>{p.fcp >= 1000 ? `${(p.fcp / 1000).toFixed(1)}초` : `${p.fcp}ms`}</td>
                  <td className={`${styles.numCell} ${cwvStatus("cls", p.cls).cls}`}>{p.cls.toFixed(2)}</td>
                  <td className={`${styles.numCell} ${cwvStatus("inp", p.inp).cls}`}>{p.inp === 0 ? "—" : `${p.inp}ms`}</td>
                  <td className={`${styles.numCell} ${cwvStatus("ttfb", p.ttfb).cls}`}>{p.ttfb >= 1000 ? `${(p.ttfb / 1000).toFixed(1)}초` : `${p.ttfb}ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
