"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import GlobalNav from "@/components/common/GlobalNav";
import CopyButton from "@/components/seo/CopyButton";
import WhyCallout from "@/components/seo/WhyCallout";
import ImpactBadge from "@/components/seo/ImpactBadge";
import styles from "./url-cleanup.module.css";

type CanonicalRow = {
  priority: string; pageLabel: string; canonicalTarget: string;
  variantUrls: string; imwebAction: string; verificationStep: string; confidence: string;
};
type NoindexRow = {
  priority: string; urlPattern: string; reason: string;
  imwebAction: string; verificationStep: string; risk: string;
};
type SitemapRow = {
  priority: string; urlPattern: string; currentInSitemap: string;
  action: string; reason: string; verificationStep: string;
};
type OverviewRow = {
  type: string; example: string; canonical: string;
  sitemap: string; noindex: string; priority: string;
};
type RollbackRow = { signal: string; source: string; threshold: string; response: string };

type ApiResponse = {
  overviewRows: OverviewRow[];
  canonicals: CanonicalRow[];
  noindexes: NoindexRow[];
  sitemaps: SitemapRow[];
  robots: { current: string; revised: string };
  rollbackImmediate: RollbackRow[];
  rollbackWeek: RollbackRow[];
  verify2Weeks: RollbackRow[];
  reportTemplate: string;
  generatedAt: string;
};

const STORAGE_KEY = "seo-url-cleanup-progress-v1";

function useProgress(): {
  done: Record<string, boolean>;
  toggle: (key: string) => void;
  reset: () => void;
} {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done]);

  const toggle = (key: string) => setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  const reset = () => setDone({});
  return { done, toggle, reset };
}

const PRIORITY_BADGE: Record<string, { label: string; tone: "urgent" | "warn" | "info" }> = {
  P0: { label: "P0 즉시", tone: "urgent" },
  P1: { label: "P1 이번 주", tone: "warn" },
  P2: { label: "P2 모니터링", tone: "info" },
  INFO: { label: "참고", tone: "info" },
};

const SECTIONS = [
  { id: "cover", label: "0. 작업 개요", hint: "사전 확인" },
  { id: "overview", label: "1. URL 종류별 표", hint: "12종 한눈에" },
  { id: "noindex", label: "2-1. 검색결과 숨김", hint: "noindex 11건" },
  { id: "canonical", label: "2-2. 대표 URL 통일", hint: "canonical 9건" },
  { id: "robots", label: "2-3. robots.txt", hint: "before/after" },
  { id: "sitemap", label: "2-4. sitemap 정리", hint: "모니터링 6건" },
  { id: "weekly", label: "3. 1주일 점검", hint: "GSC 검증" },
  { id: "rollback", label: "5. 롤백 기준", hint: "즉시/1주/2주" },
  { id: "report", label: "6. 보고 양식", hint: "복사 후 회신" },
];

function PriorityBadge({ p }: { p: string }) {
  const meta = PRIORITY_BADGE[p] ?? { label: p, tone: "info" as const };
  return <span className={styles.priorityBadge} data-tone={meta.tone}>{meta.label}</span>;
}

function ChecklistItem({
  done, onToggle, children,
}: { done: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label className={`${styles.checkRow} ${done ? styles.checkRowDone : ""}`}>
      <input type="checkbox" checked={done} onChange={onToggle} className={styles.checkInput} />
      <span className={styles.checkContent}>{children}</span>
    </label>
  );
}

export default function UrlCleanupPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { done, toggle, reset } = useProgress();
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/seo/api/url-cleanup", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { total: 0, done: 0, pct: 0 };
    const keys: string[] = [
      ...data.canonicals.map((_, i) => `canonical:${i}`),
      ...data.noindexes.map((_, i) => `noindex:${i}`),
      ...data.sitemaps.map((_, i) => `sitemap:${i}`),
      "robots:apply",
      "robots:verify",
      "weekly:gsc-index",
      "weekly:gsc-pages",
      "weekly:incognito",
      "weekly:product-search",
    ];
    const doneCount = keys.filter((k) => done[k]).length;
    return { total: keys.length, done: doneCount, pct: keys.length === 0 ? 0 : (doneCount / keys.length) * 100 };
  }, [data, done]);

  const handleSectionClick = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <GlobalNav activeSlug="seo" />
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <Link href="/seo" className={styles.sidebarBack}>← /seo 대시보드</Link>
          <div className={styles.sidebarBrand}>
            <span className={styles.sidebarBrandTitle}>아임웹 URL 정리</span>
            <span className={styles.sidebarBrandSub}>승인안 B 작업 요청서</span>
          </div>
          <div className={styles.progressBox}>
            <div className={styles.progressTopRow}>
              <span className={styles.progressLabel}>전체 진행률</span>
              <span className={styles.progressNum}>{totals.done} / {totals.total}</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${totals.pct}%` }} />
            </div>
            <button type="button" onClick={reset} className={styles.resetBtn}>모든 체크 해제</button>
          </div>
          <nav className={styles.sidebarNav}>
            {SECTIONS.map((s, idx) => {
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSectionClick(s.id)}
                  className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
                >
                  <span className={styles.sidebarLinkIndex}>{String(idx).padStart(2, "0")}</span>
                  <span className={styles.sidebarLinkBody}>
                    <span className={styles.sidebarLinkLabel}>{s.label}</span>
                    <span className={styles.sidebarLinkHint}>{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className={styles.sidebarFooter}>
            진행률은 이 브라우저에 저장됩니다. 다른 기기에서는 다시 체크해야 합니다.
          </div>
        </aside>

        <main className={styles.content}>
          <header className={styles.pageHeader}>
            <div className={styles.pageHeaderLeft}>
              <div className={styles.pageHeaderTag}>승인안 B · 운영팀 작업 요청서</div>
              <h1 className={styles.pageHeaderH}>아임웹 URL 정리 작업</h1>
              <div className={styles.pageHeaderSub}>
                예상 시간 4~6시간 · 즉시 영향 0 · 검색엔진 반영 1~7일 · 모든 단계 즉시 롤백 가능
              </div>
            </div>
            <div className={styles.pageHeaderBadges}>
              <ImpactBadge variant="needs-approval" />
              <span className={styles.pageHeaderApproved}>✅ 2026-04-28 TJ 승인 완료</span>
            </div>
          </header>

          {loading && <div className={styles.loading}>작업 요청서 데이터 불러오는 중…</div>}
          {error && <WhyCallout tone="warning" title="데이터를 불러오지 못했습니다">{error}</WhyCallout>}
          {data && (
            <>
              {/* 0. Cover */}
              <section id="cover" className={styles.section}>
                <h2 className={styles.sectionH}>0. 작업 개요 (먼저 읽기)</h2>
                <WhyCallout tone="info" title="무엇을 하는가">
                  바이오컴 사이트의 URL이 같은 페이지를 가리키는데도 여러 형태로 흩어져 있어, 구글이 「어느 게 진짜냐」를 헷갈립니다.
                  이 작업은 다음 4가지를 정리합니다.
                  <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                    <li><strong>대표 URL 지정</strong> — 같은 상품/검사권/칼럼이 여러 URL로 있을 때 「이 URL이 대표」라고 명시 (canonical 태그)</li>
                    <li><strong>검색결과 숨김 처리</strong> — 로그인·장바구니·내부 검색 결과처럼 검색결과에 뜰 필요 없는 페이지에 noindex 메타 추가</li>
                    <li><strong>검색엔진 제출 목록 정리</strong> — robots.txt sitemap 지시문 형식 수정 + 잡음 차단 6 규칙</li>
                    <li><strong>잡음 URL 차단</strong> — 의미 없이 검색결과에 떠서 클릭률을 떨어뜨리는 URL 패턴</li>
                  </ol>
                </WhyCallout>
                <h3 className={styles.subH}>사전 확인 사항 (작업 전 1번만)</h3>
                <div className={styles.checkList}>
                  {[
                    ["pre:1", "아임웹 관리자 권한이 있는가"],
                    ["pre:2", "SEO 설정 메뉴 (대시보드 > 사이트 관리 > SEO 또는 페이지별 SEO) 위치 확인"],
                    ["pre:3", "robots.txt 편집 권한 확인 (사이트 관리 > robots.txt 또는 사용자 코드 영역)"],
                    ["pre:4", "작업 시작 전 현재 robots.txt 전체 복사해서 백업 (롤백용)"],
                  ].map(([key, label]) => (
                    <ChecklistItem key={key} done={!!done[key]} onToggle={() => toggle(key)}>
                      {label}
                    </ChecklistItem>
                  ))}
                </div>
              </section>

              {/* 1. URL types - action cards */}
              <section id="overview" className={styles.section}>
                <h2 className={styles.sectionH}>1. URL 종류별 — 무엇을 어떻게 할지 (12개 유형)</h2>
                <WhyCallout tone="info">
                  사이트의 URL을 12개 유형으로 나눠서 「이 유형은 무엇을 어디서 어떻게 하면 되는지」 적어 둡니다.
                  대부분은 §2-1 / §2-2 / §2-3 의 체크리스트로 자동 처리됩니다 — 여기서는 「왜 그렇게 처리하는지」와 유형별 추가 작업이 있는 경우만 표시.
                </WhyCallout>
                <div className={styles.typeGuideList}>
                  {data.overviewRows.map((r, i) => (
                    <TypeGuideCard key={i} row={r} idx={i} done={done} toggle={toggle} />
                  ))}
                </div>
              </section>

              {/* 2-1. Noindex */}
              <section id="noindex" className={styles.section}>
                <h2 className={styles.sectionH}>2-1. 검색결과 숨김 처리 (noindex) — {data.noindexes.length}건</h2>
                <WhyCallout tone="info">
                  로그인·장바구니·검색결과·리뷰 잡음 페이지가 구글 검색결과에 뜨지 않도록 차단.
                  아임웹 작업 위치: 대시보드 &gt; 사이트 관리 &gt; SEO 설정 &gt; 페이지별 SEO 또는 robots.txt 편집.
                </WhyCallout>
                <div className={styles.taskList}>
                  {data.noindexes.map((row, i) => {
                    const k = `noindex:${i}`;
                    return (
                      <div key={i} className={`${styles.taskCard} ${done[k] ? styles.taskCardDone : ""}`}>
                        <label className={styles.taskHead}>
                          <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} className={styles.checkInput} />
                          <PriorityBadge p={row.priority} />
                          <code className={styles.taskUrl}>{row.urlPattern}</code>
                        </label>
                        <div className={styles.taskBody}>
                          <div><strong>이유</strong> · {row.reason}</div>
                          <div><strong>아임웹 작업</strong> · {row.imwebAction}</div>
                          <div><strong>검증</strong> · {row.verificationStep}</div>
                          <div><strong>리스크</strong> · {row.risk}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2-2. Canonical */}
              <section id="canonical" className={styles.section}>
                <h2 className={styles.sectionH}>2-2. 대표 URL 통일 (canonical) — {data.canonicals.length}건</h2>
                <WhyCallout tone="info">
                  같은 상품/검사권을 가리키는 여러 URL의 canonical 목적지를 1개로 고정.
                  아임웹 작업 위치: 대시보드 &gt; 페이지 관리 &gt; 해당 페이지 &gt; SEO 설정 &gt; Canonical URL.
                </WhyCallout>
                <div className={styles.taskList}>
                  {data.canonicals.map((row, i) => {
                    const k = `canonical:${i}`;
                    return (
                      <div key={i} className={`${styles.taskCard} ${done[k] ? styles.taskCardDone : ""}`}>
                        <label className={styles.taskHead}>
                          <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} className={styles.checkInput} />
                          <PriorityBadge p={row.priority} />
                          <span className={styles.taskUrl}><strong>{row.pageLabel}</strong></span>
                          <span className={styles.taskConfidence}>{row.confidence}</span>
                        </label>
                        <div className={styles.taskBody}>
                          <div><strong>대표 URL (canonical 목적지)</strong> · <code className={styles.codeCell}>{row.canonicalTarget}</code></div>
                          <div><strong>흡수할 변형 URL</strong> · <span className={styles.codeCell}>{row.variantUrls}</span></div>
                          <div><strong>아임웹 작업</strong> · {row.imwebAction}</div>
                          <div><strong>검증</strong> · {row.verificationStep}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2-3. robots.txt */}
              <section id="robots" className={styles.section}>
                <h2 className={styles.sectionH}>2-3. robots.txt 정리</h2>
                <WhyCallout tone="warning">
                  현재 robots.txt의 sitemap 지시문 첫 줄이 Markdown 링크 형식이라 일부 검색엔진(특히 Naver)이 파싱 실패할 수 있습니다.
                  아래 「수정 후」 블록 전체를 복사해 아임웹 robots.txt 편집기에 교체.
                </WhyCallout>
                <div className={styles.robotsCompare}>
                  <div className={styles.robotsCol}>
                    <div className={styles.robotsColLabel}>현재 (수정 전)</div>
                    <pre className={styles.robotsCode} data-state="before">{data.robots.current}</pre>
                  </div>
                  <div className={styles.robotsCol}>
                    <div className={styles.robotsColLabelRow}>
                      <span className={styles.robotsColLabel} data-state="after">수정 후 (이대로 교체)</span>
                      <CopyButton size="sm" label="전체 복사" value={data.robots.revised} />
                    </div>
                    <pre className={styles.robotsCode} data-state="after">{data.robots.revised}</pre>
                  </div>
                </div>
                <h3 className={styles.subH}>적용 체크</h3>
                <div className={styles.checkList}>
                  <ChecklistItem done={!!done["robots:apply"]} onToggle={() => toggle("robots:apply")}>
                    아임웹 관리자에서 위 「수정 후」 블록으로 robots.txt 교체 + 저장
                  </ChecklistItem>
                  <ChecklistItem done={!!done["robots:verify"]} onToggle={() => toggle("robots:verify")}>
                    저장 후 https://biocom.kr/robots.txt 직접 열어 적용 확인 → Search Console &gt; Sitemaps에서 「다시 보내기」
                  </ChecklistItem>
                </div>
              </section>

              {/* 2-4. Sitemap */}
              <section id="sitemap" className={styles.section}>
                <h2 className={styles.sectionH}>2-4. sitemap 정리·모니터링 — {data.sitemaps.length}건</h2>
                <WhyCallout tone="success">
                  현재 sitemap.xml은 깨끗한 상태(parameter URL 0건). 추가 작업 없이 1주일 후 잡음 URL이 새로 들어오지 않았는지만 확인하면 됩니다.
                </WhyCallout>
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th></th>
                        <th>URL 패턴</th>
                        <th>현재 sitemap 포함?</th>
                        <th>처리</th>
                        <th>이유</th>
                        <th>검증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sitemaps.map((row, i) => {
                        const k = `sitemap:${i}`;
                        return (
                          <tr key={i} className={done[k] ? styles.tableRowDone : ""}>
                            <td><input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} /></td>
                            <td><code className={styles.codeCell}>{row.urlPattern}</code></td>
                            <td>{row.currentInSitemap}</td>
                            <td><PriorityBadge p={row.priority} /> {row.action}</td>
                            <td>{row.reason}</td>
                            <td>{row.verificationStep}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 3. Weekly check */}
              <section id="weekly" className={styles.section}>
                <h2 className={styles.sectionH}>3. 1주일 점검 체크리스트</h2>
                <WhyCallout tone="info">
                  작업 반영 후 7일이 지나면 다음 4가지를 한 번 확인합니다. 정상이면 2주차 검증으로 진행, 이상이면 §5 롤백.
                </WhyCallout>
                <div className={styles.checkList}>
                  <ChecklistItem done={!!done["weekly:gsc-index"]} onToggle={() => toggle("weekly:gsc-index")}>
                    <strong>Google Search Console &gt; 색인 &gt; 페이지</strong>에서 「색인 안 됨」 사유에 noindex 표시 페이지 수가 늘어 있어야 함 (의도한 차단이 적용된 증거)
                  </ChecklistItem>
                  <ChecklistItem done={!!done["weekly:gsc-pages"]} onToggle={() => toggle("weekly:gsc-pages")}>
                    <strong>GSC &gt; URL 검사</strong> 핵심 6개 URL 입력: 「색인됨」 + 사용자가 선언한 표준 URL = Google이 선택한 표준 URL 일치
                  </ChecklistItem>
                  <ChecklistItem done={!!done["weekly:incognito"]} onToggle={() => toggle("weekly:incognito")}>
                    <strong>시크릿 모드</strong>에서 차단 URL 직접 열기 (/login, /?q=… 등): page source에서 noindex 메타 또는 robots.txt 차단 확인
                  </ChecklistItem>
                  <ChecklistItem done={!!done["weekly:product-search"]} onToggle={() => toggle("weekly:product-search")}>
                    <strong>같은 상품 검색</strong> (예: 「바이오밸런스」): 같은 상품의 다른 URL이 동시에 안 뜨는지 확인
                  </ChecklistItem>
                </div>
              </section>

              {/* 5. Rollback */}
              <section id="rollback" className={styles.section}>
                <h2 className={styles.sectionH}>5. 롤백 기준 (이렇게 되면 되돌리기)</h2>
                <h3 className={styles.subH}>5-1. 즉시 롤백 신호 (적용 후 0~24시간)</h3>
                <RollbackTable rows={data.rollbackImmediate} />
                <h3 className={styles.subH}>5-2. 1주일 후 롤백 신호 (적용 후 7일)</h3>
                <RollbackTable rows={data.rollbackWeek} />
                <h3 className={styles.subH}>5-3. 2주 후 검증 (적용 후 14일) — 이게 정상이면 작업 성공</h3>
                <RollbackTable rows={data.verify2Weeks} />
              </section>

              {/* 6. Report */}
              <section id="report" className={styles.section}>
                <h2 className={styles.sectionH}>6. 진행 상황 보고 양식</h2>
                <WhyCallout tone="info">
                  작업 중·후 다음 양식으로 TJ에게 회신. 「전체 복사」 버튼으로 클립보드에 담아 채팅으로 붙여 넣으면 됩니다.
                </WhyCallout>
                <div className={styles.reportBlock}>
                  <div className={styles.reportTopRow}>
                    <span className={styles.reportLabel}>회신 양식</span>
                    <CopyButton size="md" label="전체 복사" value={data.reportTemplate} />
                  </div>
                  <pre className={styles.reportCode}>{data.reportTemplate}</pre>
                </div>
              </section>

              <footer className={styles.pageFooter}>
                근거 산출물: <code>reports/seo/imweb_url_cleanup_workorder.md</code>,{" "}
                <code>imweb_canonical_targets.csv</code>,{" "}
                <code>imweb_noindex_targets.csv</code>,{" "}
                <code>imweb_sitemap_excludes.csv</code>,{" "}
                <code>imweb_robots_txt_revision.md</code>,{" "}
                <code>imweb_rollback_criteria.md</code>.
                <br />
                생성: {new Date(data.generatedAt).toLocaleString("ko-KR")}.
              </footer>
            </>
          )}
        </main>
      </div>
    </>
  );
}

type TypeGuide = {
  whatToDo: string;
  whereInImweb: string;
  verify: string;
  crossRef?: { sectionId: string; label: string };
  affectedCount?: string;
  alreadyApplied?: boolean;
};

const TYPE_GUIDES: Record<string, TypeGuide> = {
  "홈": {
    whatToDo: "홈 페이지의 Canonical URL 입력란이 https://biocom.kr/ 로 되어 있는지 확인합니다. 비어 있으면 https://biocom.kr/ 입력. (대부분 이미 적용되어 있음 — 확인만)",
    whereInImweb: "대시보드 > 사이트 관리 > SEO 설정 > 홈페이지 > Canonical URL",
    verify: "시크릿 모드에서 https://biocom.kr/ 열어 view-source. <link rel=\"canonical\" href=\"https://biocom.kr/\"> 가 있는지 확인.",
    affectedCount: "1건",
  },
  "/index 별칭": {
    whatToDo: "/index 페이지의 Canonical URL을 https://biocom.kr/ 로 입력 + 「검색엔진 색인 차단(noindex)」 체크. 또는 가능하다면 /index → / 로 301 redirect 설정 (권장).",
    whereInImweb: "대시보드 > 페이지 관리 > /index > 설정 (canonical + noindex). redirect는 사이트 관리 > URL 리디렉션 메뉴",
    verify: "/index 직접 열어 / 로 자동 이동하거나, view-source에서 noindex 메타 + canonical=https://biocom.kr/ 확인.",
    affectedCount: "1건",
  },
  "홈의 ?mode=privacy/?mode=policy": {
    whatToDo: "아임웹은 ?mode= 같은 query string에 대해 페이지별 SEO 설정을 직접 적용하기 어렵습니다. 따라서 §2-3 robots.txt에 Disallow 규칙으로 차단합니다 (이미 적용본에 포함됨). 추가로 정책 본문 페이지가 따로 있다면 ?mode=privacy → 정책 본문 URL로 redirect 설정.",
    whereInImweb: "robots.txt (이미 §2-3 적용본에 Disallow: /?mode=privacy 포함). 정책 본문 redirect는 사이트 관리 > URL 리디렉션",
    verify: "https://biocom.kr/robots.txt 열어 Disallow: /?mode=privacy 확인.",
    crossRef: { sectionId: "robots", label: "§2-3 robots.txt 적용본에 포함" },
    affectedCount: "2건",
    alreadyApplied: true,
  },
  "카테고리/서비스": {
    whatToDo: "카테고리 페이지(`/service`, `/healthinfo`, `/HealthFood` 등) 각각의 SEO 설정에서 Canonical URL이 자기 자신을 가리키는지 확인. 비어 있으면 채우기. (대부분 이미 적용됨 — 확인만)",
    whereInImweb: "대시보드 > 페이지 관리 > 각 카테고리 페이지 > SEO 설정",
    verify: "각 카테고리 페이지 view-source에서 canonical 태그 존재 확인. 핵심 3개 페이지만 점검해도 충분.",
    affectedCount: "주요 카테고리 5~10개",
  },
  "상품 상세": {
    whatToDo: "§2-2 「대표 URL 통일」 카드에서 상품별로 정확한 대표 URL이 적힌 8건 카드를 따라 작업. 자기 자신을 canonical로 명시 + 변형 URL이 있으면 흡수.",
    whereInImweb: "대시보드 > 상품 관리 > 각 상품 > SEO 설정 > Canonical URL",
    verify: "§2-2 카드의 「검증」 단계 따라.",
    crossRef: { sectionId: "canonical", label: "§2-2 대표 URL 통일 8건 카드 참조" },
    affectedCount: "시범 4개 + 카탈로그 전체",
  },
  "검사권 상세": {
    whatToDo: "상품 상세와 동일한 방식. §2-2의 검사권 행 (종합 대사기능 분석, 음식물 과민증 분석) 참조.",
    whereInImweb: "대시보드 > 상품 관리 > 검사권 상품 > SEO 설정",
    verify: "§2-2 카드의 「검증」 단계 따라.",
    crossRef: { sectionId: "canonical", label: "§2-2 대표 URL 통일에 포함" },
    affectedCount: "검사권 4개",
  },
  "같은 상품 다른 경로": {
    whatToDo: "/shop_view/?idx=97, /HealthFood/97 같이 같은 상품을 가리키는 변형 URL의 canonical을 「대표 상품 URL」로 통일. 즉 변형 URL의 SEO 설정에서 Canonical을 대표 URL로 입력.",
    whereInImweb: "변형 URL이 별도 페이지로 존재하면: 페이지 관리 > 해당 변형 페이지 > SEO 설정. 자동 생성된 별칭이라면 별도 redirect 규칙으로 처리.",
    verify: "변형 URL을 시크릿 모드로 열어 view-source에서 canonical이 대표 URL을 가리키는지 확인. GSC URL 검사로 「표준 URL」 일치 확인.",
    crossRef: { sectionId: "canonical", label: "§2-2의 「흡수할 변형 URL」 컬럼에 명시됨" },
    affectedCount: "상품별 1~3개",
  },
  "칼럼 글": {
    whatToDo: "각 칼럼 글 상세 페이지는 자기 자신(idx별 URL)을 canonical로 유지. 추가 작업: sitemap.xml에 「모든 칼럼 글」이 자동으로 포함되지 않도록 자동 생성 옵션 점검 — 상위 칼럼 페이지 (/healthinfo) 와 주요 글만 포함하도록.",
    whereInImweb: "대시보드 > 사이트 관리 > sitemap 자동 생성 설정. 「블로그/게시판 글 자동 포함」 옵션이 있으면 끄거나 「최근 N건」으로 제한.",
    verify: "https://biocom.kr/sitemap.xml 다운로드해서 칼럼 글 idx URL 수가 폭증하지 않는지(예: 50개 이내) 확인.",
    affectedCount: "칼럼 글 전체",
  },
  "리뷰/게시판 잡음": {
    whatToDo: "이건 페이지별 SEO 설정으로 잡기 어려운 query string 잡음입니다. §2-3 robots.txt에 Disallow: /*interlock=shop_review* 규칙으로 차단 (이미 적용본에 포함).",
    whereInImweb: "robots.txt (이미 §2-3 적용본에 포함됨). 페이지 관리에서 별도 작업 불필요.",
    verify: "https://biocom.kr/robots.txt 열어 해당 규칙 확인. GSC URL 검사로 리뷰 잡음 URL 1개 입력 → 「robots.txt에 의해 차단됨」 표시 확인.",
    crossRef: { sectionId: "robots", label: "§2-3 robots.txt 적용본에 포함" },
    affectedCount: "10건+",
    alreadyApplied: true,
  },
  "검색 결과 페이지": {
    whatToDo: "내부 검색 결과 페이지 (/?q=*&page=*&only_photo=*) 차단. §2-3 robots.txt 적용본에 Disallow: /?q= 와 Disallow: /*?q=* 규칙으로 포함됨.",
    whereInImweb: "robots.txt (이미 §2-3 적용본에 포함됨).",
    verify: "https://biocom.kr/robots.txt 열어 Disallow: /?q= 확인. GSC에서 site:biocom.kr ?q= 검색 → 결과 0건 또는 급감 확인.",
    crossRef: { sectionId: "robots", label: "§2-3 robots.txt 적용본에 포함" },
    affectedCount: "10건+",
    alreadyApplied: true,
  },
  "로그인/회원가입": {
    whatToDo: "각 로그인·회원가입 단계 페이지의 SEO 설정에서 「검색엔진 색인 차단(noindex)」 체크. §2-1 noindex 카드 11건에 모두 포함됨.",
    whereInImweb: "페이지 관리 > /login, /site_join_pattern_choice, /site_join_type_choice, /membership 각각 > SEO > noindex 체크",
    verify: "각 URL 시크릿 모드로 열어 view-source. <meta name=\"robots\" content=\"noindex\"> 확인.",
    crossRef: { sectionId: "noindex", label: "§2-1 검색결과 숨김 11건 체크리스트 참조" },
    affectedCount: "5건",
  },
  "장바구니/마이페이지": {
    whatToDo: "/shop_cart, /shop_mypage 의 SEO 설정에서 noindex 체크. §2-1 noindex 카드에 포함됨.",
    whereInImweb: "페이지 관리 > /shop_cart, /shop_mypage > SEO > noindex 체크",
    verify: "시크릿 모드 view-source 확인.",
    crossRef: { sectionId: "noindex", label: "§2-1 검색결과 숨김 체크리스트 참조" },
    affectedCount: "2건",
  },
};

function TypeGuideCard({
  row, idx, done, toggle,
}: { row: OverviewRow; idx: number; done: Record<string, boolean>; toggle: (k: string) => void }) {
  const guide = TYPE_GUIDES[row.type];
  const k = `type:${idx}`;
  const isDone = !!done[k];

  return (
    <article className={`${styles.typeGuideCard} ${isDone ? styles.typeGuideCardDone : ""}`}>
      <div className={styles.typeGuideHead}>
        <input type="checkbox" checked={isDone} onChange={() => toggle(k)} className={styles.checkInput} />
        <div className={styles.typeGuideHeadBody}>
          <div className={styles.typeGuideTitleRow}>
            <PriorityBadge p={row.priority} />
            <h3 className={styles.typeGuideTitle}>{row.type}</h3>
            {guide?.alreadyApplied && <span className={styles.typeGuideApplied}>✅ §2-3 robots.txt 적용본에 자동 포함</span>}
            {guide?.affectedCount && <span className={styles.typeGuideCount}>{guide.affectedCount}</span>}
          </div>
          <div className={styles.typeGuideExample}>
            예: <code className={styles.codeCell}>{row.example}</code>
          </div>
        </div>
      </div>

      {guide ? (
        <div className={styles.typeGuideBody}>
          <div className={styles.typeGuideSection}>
            <span className={styles.typeGuideSectionLabel}>① 무엇을 해요</span>
            <p className={styles.typeGuideSectionText}>{guide.whatToDo}</p>
          </div>
          <div className={styles.typeGuideSection}>
            <span className={styles.typeGuideSectionLabel}>② 아임웹 어디서</span>
            <p className={styles.typeGuideSectionText}>{guide.whereInImweb}</p>
          </div>
          <div className={styles.typeGuideSection}>
            <span className={styles.typeGuideSectionLabel}>③ 어떻게 확인</span>
            <p className={styles.typeGuideSectionText}>{guide.verify}</p>
          </div>
          {guide.crossRef && (
            <a
              href={`#${guide.crossRef.sectionId}`}
              className={styles.typeGuideCrossRef}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(guide.crossRef!.sectionId);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", `#${guide.crossRef!.sectionId}`);
                }
              }}
            >
              → {guide.crossRef.label}
            </a>
          )}
          <div className={styles.typeGuideMeta}>
            <span>canonical: {row.canonical}</span>
            <span>sitemap: {row.sitemap}</span>
            <span>noindex: {row.noindex}</span>
          </div>
        </div>
      ) : (
        <div className={styles.typeGuideBody}>
          <p className={styles.typeGuideSectionText}>(가이드 누락)</p>
        </div>
      )}
    </article>
  );
}

function RollbackTable({ rows }: { rows: RollbackRow[] }) {
  if (rows.length === 0) return <p className={styles.emptyHint}>표 데이터를 파싱하지 못했습니다.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>신호</th>
            <th>측정 위치</th>
            <th>임계값</th>
            <th>대응</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><strong>{r.signal}</strong></td>
              <td>{r.source}</td>
              <td className={styles.thresholdCell}>{r.threshold}</td>
              <td>{r.response}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
