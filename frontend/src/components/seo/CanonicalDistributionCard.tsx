"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./seo.module.css";
import WhyCallout from "./WhyCallout";
import ImpactBadge from "./ImpactBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";
const SITE = "sc-domain:biocom.kr";

type GscPageRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

type Group = {
  key: string;          // representative pattern e.g. "biobalance" or "/HealthFood/?idx=97"
  label: string;        // display name
  representative: string; // canonical-target
  variants: { url: string; impressions: number; clicks: number; ctr: number }[];
  totalImpressions: number;
  totalClicks: number;
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const numFmt = new Intl.NumberFormat("ko-KR");
const COLLAPSED_VARIANT_LIMIT = 8;

// 같은 상품/문서를 가리킬 가능성이 큰 URL 그룹 정의 (시범 6개)
const PROBES: { key: string; label: string; representative: string; matches: (url: string) => boolean }[] = [
  {
    key: "biobalance",
    label: "바이오밸런스 (영양제)",
    representative: "/HealthFood/?idx=97",
    matches: (u) => /idx=97\b/.test(u) || u.includes("/HealthFood/97") || u.includes("/shop_view/?idx=97"),
  },
  {
    key: "neuromaster",
    label: "뉴로마스터 (영양제)",
    representative: "/HealthFood/?idx=198",
    matches: (u) => /idx=198\b/.test(u),
  },
  {
    key: "organicacid",
    label: "종합 대사기능 분석 (검사권)",
    representative: "/organicacid_store/?idx=259",
    matches: (u) => /idx=259\b/.test(u) || u.includes("/organicacid"),
  },
  {
    key: "igg",
    label: "음식물 과민증 분석 (검사권)",
    representative: "/igg_store/?idx=85",
    matches: (u) => /idx=85\b/.test(u) || u.includes("/igg"),
  },
  {
    key: "home",
    label: "홈페이지",
    representative: "https://biocom.kr/",
    matches: (u) => /^https:\/\/biocom\.kr\/(\?|$|index|\?mode=)/.test(u),
  },
  {
    key: "healthinfo",
    label: "건강정보 칼럼 (idx=5764202)",
    representative: "/healthinfo/?bmode=view&idx=5764202",
    matches: (u) => /idx=5764202\b/.test(u),
  },
];

export default function CanonicalDistributionCard() {
  const [pages, setPages] = useState<GscPageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/gsc/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: SITE,
            startDate: daysAgo(31),
            endDate: daysAgo(3),
            rowLimit: 25000,
            dimensions: ["page"],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setPages(json.rows ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups: Group[] = useMemo(() => {
    if (!pages) return [];
    return PROBES.map((p) => {
      const variants: Group["variants"] = [];
      let totalImpressions = 0;
      let totalClicks = 0;
      for (const r of pages) {
        const url = r.keys?.[0] ?? "";
        if (!url || !p.matches(url)) continue;
        const impressions = r.impressions ?? 0;
        const clicks = r.clicks ?? 0;
        const ctr = r.ctr ?? 0;
        variants.push({ url, impressions, clicks, ctr });
        totalImpressions += impressions;
        totalClicks += clicks;
      }
      variants.sort((a, b) => b.impressions - a.impressions);
      return { key: p.key, label: p.label, representative: p.representative, variants, totalImpressions, totalClicks };
    }).filter((g) => g.variants.length > 0);
  }, [pages]);

  const dispersedGroups = groups.filter((g) => g.variants.length > 1);

  return (
    <section id="canonical-check" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>대표 URL 정책 검증 (같은 상품이 여러 URL로 흩어져 있나?)</h2>
          <ImpactBadge variant="live-data" />
        </div>
        <span className={styles.sectionTag}>backend /api/gsc/query · 최근 28일 page 차원</span>
      </div>

      <WhyCallout tone="info" title="이 카드는 무엇을 보여주나요">
        <p style={{ marginBottom: 8 }}>
          같은 상품을 가리키는 URL이 여러 개라면, 구글이 「어느 게 진짜냐」를 헷갈려서 노출과 클릭이 흩어집니다.
          여기서는 시범 6개 묶음(상품 4 + 홈 + 칼럼 1)에 대해, 최근 28일 GSC가 실제로 어떤 URL들을 노출시키고 있는지 본문에서 확인합니다.
        </p>
        <p>
          만약 한 상품에 노출된 URL이 1개뿐이면 이미 깔끔. 2개 이상이면 <strong>승인안 B (URL 정리 요청서 만들기)</strong>의 근거가 됩니다.
          이 카드는 「분석」용이라 운영 사이트는 손대지 않습니다.
        </p>
      </WhyCallout>

      {loading && <p className={styles.sectionEmpty}>최근 28일 페이지별 데이터 불러오는 중…</p>}
      {error && (
        <WhyCallout tone="warning" title="데이터를 불러오지 못했습니다">
          백엔드 응답 오류: <code>{error}</code>
        </WhyCallout>
      )}

      {!loading && !error && (
        <>
          <div className={styles.canonicalSummary}>
            <div className={styles.canonicalStat}>
              <div className={styles.canonicalStatLabel}>측정한 묶음</div>
              <div className={styles.canonicalStatValue}>{groups.length} / {PROBES.length}</div>
            </div>
            <div className={styles.canonicalStat}>
              <div className={styles.canonicalStatLabel}>여러 URL로 흩어진 묶음</div>
              <div className={styles.canonicalStatValue} data-tone={dispersedGroups.length > 0 ? "warn" : "ok"}>
                {dispersedGroups.length}개
              </div>
            </div>
            <div className={styles.canonicalStat}>
              <div className={styles.canonicalStatLabel}>판정</div>
              <div className={styles.canonicalStatValue} data-tone={dispersedGroups.length >= 2 ? "warn" : "ok"}>
                {dispersedGroups.length >= 2 ? "B 승인 권장" : dispersedGroups.length === 1 ? "1개 흩어짐, 검토 필요" : "정리됨"}
              </div>
            </div>
          </div>

          <div className={styles.canonicalGrid}>
            {groups.map((g) => {
              const dispersed = g.variants.length > 1;
              const isExpanded = Boolean(expandedGroups[g.key]);
              const visibleVariants = isExpanded ? g.variants : g.variants.slice(0, COLLAPSED_VARIANT_LIMIT);
              const hiddenCount = Math.max(0, g.variants.length - visibleVariants.length);
              return (
                <article key={g.key} className={styles.canonicalCard} data-dispersed={dispersed}>
                  <div className={styles.canonicalCardHead}>
                    <div>
                      <div className={styles.canonicalLabel}>{g.label}</div>
                      <div className={styles.canonicalRep}>대표 URL 후보: <code>{g.representative}</code></div>
                    </div>
                    <span className={styles.canonicalBadge} data-dispersed={dispersed}>
                      {dispersed ? `⚠️ ${g.variants.length}개 URL` : "✅ 1개 URL"}
                    </span>
                  </div>
                  <div className={styles.canonicalTotal}>
                    총 노출 {numFmt.format(g.totalImpressions)} · 클릭 {numFmt.format(g.totalClicks)}
                    {g.variants.length > COLLAPSED_VARIANT_LIMIT && (
                      <span> · 상위 {COLLAPSED_VARIANT_LIMIT}개 먼저 표시</span>
                    )}
                  </div>
                  <ul className={styles.canonicalVariantList}>
                    {visibleVariants.map((v) => {
                      const share = g.totalImpressions > 0 ? (v.impressions / g.totalImpressions) * 100 : 0;
                      return (
                        <li key={v.url}>
                          <div className={styles.canonicalVariantTop}>
                            <a href={v.url} target="_blank" rel="noreferrer" className={styles.canonicalVariantUrl}>
                              {v.url.replace("https://biocom.kr", "")}
                            </a>
                            <span className={styles.canonicalVariantShare}>{share.toFixed(0)}%</span>
                          </div>
                          <div className={styles.canonicalVariantBar}>
                            <div className={styles.canonicalVariantFill} style={{ width: `${share}%` }} />
                          </div>
                          <div className={styles.canonicalVariantMeta}>
                            노출 {numFmt.format(v.impressions)} · 클릭 {numFmt.format(v.clicks)} · CTR {(v.ctr * 100).toFixed(2)}%
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {g.variants.length > COLLAPSED_VARIANT_LIMIT && (
                    <button
                      type="button"
                      className={styles.canonicalToggle}
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [g.key]: !isExpanded }))}
                    >
                      {isExpanded
                        ? "긴 URL 목록 접기"
                        : `나머지 ${numFmt.format(hiddenCount)}개 URL 펼쳐보기`}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <WhyCallout tone="warning" title="API 한계 안내">
            구글 검색 콘솔 API는 모든 URL의 행을 반환하지 않고 상위 데이터 위주로 제공합니다.
            노출이 매우 적은 URL은 합산에서 빠질 수 있어 「실제 흩어짐」이 더 심할 수 있습니다.
            정확한 전수 비교는 별도 작업이 필요하며, 이 카드는 「방향 판단」 용도입니다.
          </WhyCallout>
        </>
      )}
    </section>
  );
}
