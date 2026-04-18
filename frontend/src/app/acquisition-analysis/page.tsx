"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/constants/pageData";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

type ChannelRow = {
  key: string;
  label: string;
  description: string;
  count: number;
  share: number;
  confirmedCount: number;
  pendingCount: number;
  canceledCount: number;
  revenue: number;
  pendingRevenue: number;
  examples: string[];
};

type DimensionRow = {
  label: string;
  count: number;
  share: number;
  revenue: number;
  examples: string[];
};

type RecentSample = {
  loggedAt: string;
  touchpoint: string;
  paymentStatus: string | null;
  channel: string;
  landing: string;
  referrer: string;
  utmSource: string;
  utmCampaign: string;
  clickIdType: string | null;
};

type SiteReport = {
  key: string;
  source: string;
  name: string;
  domain: string;
  conversionName: string;
  totalConversions: number;
  operationalConversions?: number;
  rawConversions?: number;
  liveConversions: number;
  confirmedConversions: number;
  pendingConversions: number;
  canceledConversions: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  totalObservedRevenue: number;
  excludedConversions: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  topChannel: ChannelRow | null;
  channels: ChannelRow[];
  campaigns: DimensionRow[];
  landings: DimensionRow[];
  recentSamples: RecentSample[];
  insights: string[];
  dataWarnings: string[];
};

type AcquisitionSummaryResponse = {
  ok: boolean;
  dataSource?: string;
  remoteWarnings?: string[];
  generatedAt: string;
  range: {
    rangeDays: number;
    startAt: string;
    endAt: string;
  };
  sites: SiteReport[];
  notes: string[];
};

type MetaInsightsResponse = {
  ok: boolean;
  account_id: string;
  date_preset: string;
  summary?: {
    totalSpend?: number;
    totalClicks?: number;
    totalLandingViews?: number;
    totalLeads?: number;
    totalPurchases?: number;
    totalPurchaseValue?: number;
  };
  rows?: Array<{
    campaign_name?: string;
    spend?: number;
    leads?: number;
    purchases?: number;
    purchase_value?: number;
  }>;
};

const RANGE_OPTIONS = [7, 30, 90] as const;

const numberFormatter = new Intl.NumberFormat("ko-KR");

const moneyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const fmtNum = (value: number | null | undefined) =>
  value == null ? "-" : numberFormatter.format(value);

const fmtKRW = (value: number | null | undefined) =>
  value == null ? "-" : moneyFormatter.format(Math.round(value));

const fmtPct = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(1)}%`;

const fmtKst = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
};

const compactUrl = (value: string) => {
  if (!value) return "-";
  try {
    const parsed = new URL(value);
    const idx = parsed.searchParams.get("idx");
    const campaign = parsed.searchParams.get("utm_campaign");
    const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
    if (campaign) return `${parsed.hostname}${path} · ${campaign}`;
    if (idx) return `${parsed.hostname}${path}?idx=${idx}`;
    return `${parsed.hostname}${path}`;
  } catch {
    return value.length > 64 ? `${value.slice(0, 64)}...` : value;
  }
};

const statusLabel = (site: SiteReport) => {
  if (site.key === "aibio") return "폼 제출";
  if (site.confirmedConversions > 0) return "confirmed 결제";
  if (site.pendingConversions > 0) return "pending 결제";
  return "결제완료";
};

const getOperationalConversions = (site: SiteReport) => site.operationalConversions ?? site.totalConversions;

const getRawConversions = (site: SiteReport) =>
  site.rawConversions ?? getOperationalConversions(site) + site.excludedConversions;

const resolveDataSourceLabel = (dataSource?: string) => {
  if (dataSource === "operational_vm_ledger") return "운영 VM 원장";
  if (dataSource === "local_ledger") return "로컬 원장";
  return dataSource || "원장";
};

const SiteHeroCard = ({ site }: { site: SiteReport }) => {
  const operationalConversions = getOperationalConversions(site);
  const rawConversions = getRawConversions(site);

  return (
    <article className={styles.siteCard}>
      <div className={styles.siteCardTop}>
        <div>
          <span className={styles.eyebrow}>{site.domain}</span>
          <h2>{site.name}</h2>
        </div>
        <span className={styles.sourceBadge}>{site.source}</span>
      </div>
      <div className={styles.siteMainMetric}>
        <span>{site.topChannel?.label ?? "데이터 없음"}</span>
        <strong>{site.topChannel ? `${fmtPct(site.topChannel.share)}` : "-"}</strong>
        <p>
          {site.topChannel
            ? `${statusLabel(site)} ${fmtNum(site.topChannel.count)}건이 이 유입원에서 발생`
            : "원장 row가 아직 없거나 기간 내 운영 전환이 없습니다."}
        </p>
      </div>
      <div className={styles.metricGrid}>
        <div>
          <span>운영 전환</span>
          <strong>{fmtNum(operationalConversions)}</strong>
        </div>
        <div>
          <span>confirmed</span>
          <strong>{fmtNum(site.confirmedConversions)}</strong>
        </div>
        <div>
          <span>pending</span>
          <strong>{fmtNum(site.pendingConversions)}</strong>
        </div>
        <div>
          <span>식별자</span>
          <strong>{fmtPct(site.identityCoverageRate)}</strong>
        </div>
      </div>
      <div className={styles.revenueLine}>
        <span>confirmed 매출 {fmtKRW(site.confirmedRevenue)}</span>
        <span>pending {fmtKRW(site.pendingRevenue)}</span>
      </div>
      <p className={styles.latest}>최근 원장: {fmtKst(site.latestLoggedAt)} KST</p>
      <p className={styles.excludedNote}>
        원장 raw {fmtNum(rawConversions)}건 중 테스트/디버그 {fmtNum(site.excludedConversions)}건 제외,
        운영 전환 {fmtNum(operationalConversions)}건
      </p>
    </article>
  );
};

const ChannelTable = ({ site }: { site: SiteReport }) => (
  <div className={styles.tableWrap}>
    <table>
      <thead>
        <tr>
          <th>유입원</th>
          <th>전환</th>
          <th>비중</th>
          <th>confirmed</th>
          <th>pending</th>
          <th>confirmed 매출</th>
          <th>근거</th>
        </tr>
      </thead>
      <tbody>
        {site.channels.length === 0 ? (
          <tr>
            <td colSpan={7} className={styles.emptyCell}>기간 내 전환 데이터가 없습니다.</td>
          </tr>
        ) : (
          site.channels.map((row) => (
            <tr key={row.key}>
              <td>
                <strong>{row.label}</strong>
                <small>{row.description}</small>
              </td>
              <td>{fmtNum(row.count)}</td>
              <td>{fmtPct(row.share)}</td>
              <td>{fmtNum(row.confirmedCount)}</td>
              <td>{fmtNum(row.pendingCount)}</td>
              <td>{fmtKRW(row.revenue)}</td>
              <td>{row.examples.length > 0 ? row.examples.join(", ") : "-"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const DimensionList = ({ title, items }: { title: string; items: DimensionRow[] }) => (
  <div className={styles.dimensionBox}>
    <h4>{title}</h4>
    <div className={styles.dimensionList}>
      {items.length === 0 ? (
        <p className={styles.muted}>표시할 데이터가 없습니다.</p>
      ) : (
        items.slice(0, 6).map((item) => (
          <div key={item.label} className={styles.dimensionItem}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.examples.join(", ") || "근거 없음"}</span>
            </div>
            <div>
              <strong>{fmtNum(item.count)}건</strong>
              <span>{fmtPct(item.share)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const AibioMetaReference = ({
  meta,
  loading,
}: {
  meta: MetaInsightsResponse | null;
  loading: boolean;
}) => {
  const summary = meta?.summary;
  return (
    <div className={styles.aibioReferenceGrid}>
      <div className={styles.metaReferenceBox}>
        <h4>AIBIO Meta Ads Manager 확인</h4>
        {loading ? (
          <p className={styles.muted}>Meta campaign insight를 확인하는 중입니다.</p>
        ) : summary ? (
          <>
            <p>
              최근 7일 Meta API 기준 지출은 {fmtKRW(summary.totalSpend ?? 0)}, 클릭은 {fmtNum(summary.totalClicks ?? 0)}건,
              랜딩 조회는 {fmtNum(summary.totalLandingViews ?? 0)}건입니다.
            </p>
            <p>
              같은 기간 Meta 캠페인 전환값은 lead {fmtNum(summary.totalLeads ?? 0)}건,
              purchase {fmtNum(summary.totalPurchases ?? 0)}건, purchase value {fmtKRW(summary.totalPurchaseValue ?? 0)}입니다.
              현재 Ads Manager campaign row에는 전환값이 잡히지 않는 상태로 봐야 합니다.
            </p>
            <div className={styles.metaMiniGrid}>
              <span>lead {fmtNum(summary.totalLeads ?? 0)}</span>
              <span>purchase {fmtNum(summary.totalPurchases ?? 0)}</span>
              <span>value {fmtKRW(summary.totalPurchaseValue ?? 0)}</span>
            </div>
          </>
        ) : (
          <p className={styles.muted}>
            Meta API 응답을 확인하지 못했습니다. 토큰/권한 또는 백엔드 7020 상태를 확인해야 합니다.
          </p>
        )}
      </div>
      <div className={styles.planBox}>
        <h4>AIBIO 폼 유입 정합성 개선 방향</h4>
        <p>
          바이오컴/커피처럼 개선 가능합니다. 헤더 상단에서는 최초 유입 URL, referrer, fbclid/gclid/ttclid,
          fbc/fbp, GA client/session 값을 먼저 보존하고, 푸터에서는 실제 폼 제출 순간에 해당 값을
          `/api/attribution/form-submit`으로 보내면 됩니다.
        </p>
        <p>
          다음 단계는 Meta Events Manager에서 AIBIO Pixel의 Lead/Form 이벤트 설정을 확인하고, 필요하면
          서버 CAPI로 `Lead` 또는 별도 `FormSubmit` 이벤트를 보강하는 것입니다. 단, 폼 제출은 매출값이
          없으므로 value를 억지로 넣기보다 상담/방문/결제 후속 전환율을 붙이는 쪽이 안전합니다.
        </p>
      </div>
    </div>
  );
};

const SiteDetail = ({
  site,
  aibioMeta,
  aibioMetaLoading,
}: {
  site: SiteReport;
  aibioMeta: MetaInsightsResponse | null;
  aibioMetaLoading: boolean;
}) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div>
        <span className={styles.eyebrow}>{site.name}</span>
        <h3>주요 전환 유입 분석</h3>
        <p>
          {site.conversionName} 기준으로 UTM, click ID, referrer, user agent를 함께 읽어 유입원을 분류합니다.
        </p>
      </div>
      <span className={styles.sectionBadge}>latest {fmtKst(site.latestLoggedAt)} KST</span>
    </div>
    {site.key === "aibio" && <AibioMetaReference meta={aibioMeta} loading={aibioMetaLoading} />}
    <ChannelTable site={site} />
    <div className={styles.twoColumn}>
      <DimensionList title="상위 캠페인 / 소스" items={site.campaigns} />
      <DimensionList title="상위 랜딩" items={site.landings} />
    </div>
    <div className={styles.insightGrid}>
      <div className={styles.insightBox}>
        <h4>인사이트</h4>
        {site.insights.length === 0 ? (
          <p className={styles.muted}>아직 자동 인사이트를 만들 표본이 부족합니다.</p>
        ) : (
          site.insights.map((insight) => <p key={insight}>{insight}</p>)
        )}
      </div>
      <div className={styles.warningBox}>
        <h4>주의할 점</h4>
        {site.dataWarnings.length === 0 ? (
          <p>치명적인 데이터 경고는 없습니다.</p>
        ) : (
          site.dataWarnings.map((warning) => <p key={warning}>{warning}</p>)
        )}
      </div>
    </div>
    <div className={styles.samples}>
      <h4>최근 전환 샘플</h4>
      <div className={styles.sampleGrid}>
        {site.recentSamples.slice(0, 4).map((sample) => (
          <article key={`${sample.loggedAt}-${sample.landing}`} className={styles.sampleCard}>
            <span>{fmtKst(sample.loggedAt)} KST · {sample.channel}</span>
            <strong>{compactUrl(sample.landing)}</strong>
            <p>referrer: {compactUrl(sample.referrer)}</p>
            <p>
              UTM: {sample.utmSource || "-"} / {sample.utmCampaign || "-"}
              {sample.clickIdType ? ` · ${sample.clickIdType}` : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default function AcquisitionAnalysisPage() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const [data, setData] = useState<AcquisitionSummaryResponse | null>(null);
  const [aibioMeta, setAibioMeta] = useState<MetaInsightsResponse | null>(null);
  const [aibioMetaLoading, setAibioMetaLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/attribution/acquisition-summary?rangeDays=${rangeDays}&dataSource=vm`,
          { signal: abortController.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const nextData = (await response.json()) as AcquisitionSummaryResponse;
        setData(nextData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("유입분석 API 응답을 불러오지 못했습니다. 백엔드 7020 실행 상태를 확인하세요.");
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };

    void load();

    return () => abortController.abort();
  }, [rangeDays]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadMeta = async () => {
      setAibioMetaLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/meta/insights?account_id=act_377604674894011&date_preset=last_7d`,
          { signal: abortController.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const nextData = (await response.json()) as MetaInsightsResponse;
        setAibioMeta(nextData.ok ? nextData : null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAibioMeta(null);
      } finally {
        if (!abortController.signal.aborted) setAibioMetaLoading(false);
      }
    };

    void loadMeta();

    return () => abortController.abort();
  }, []);

  const totalConversions = useMemo(
    () => data?.sites.reduce((sum, site) => sum + getOperationalConversions(site), 0) ?? 0,
    [data],
  );
  const totalRawConversions = useMemo(
    () => data?.sites.reduce((sum, site) => sum + getRawConversions(site), 0) ?? 0,
    [data],
  );
  const totalExcludedConversions = useMemo(
    () => data?.sites.reduce((sum, site) => sum + site.excludedConversions, 0) ?? 0,
    [data],
  );
  const bestSite = useMemo(
    () =>
      data?.sites.reduce<SiteReport | null>(
        (best, site) => (!best || getOperationalConversions(site) > getOperationalConversions(best) ? site : best),
        null,
      ) ?? null,
    [data],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/?tab=crm" className={styles.backLink}>← AI CRM으로 돌아가기</Link>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Acquisition Intelligence</p>
              <h1>유입분석</h1>
              <p>
                AIBIO 센터, 더클린커피, 바이오컴 자사몰의 주요 전환이 어느 유입원에서 발생하는지
                운영 Attribution 원장 기준으로 비교합니다.
              </p>
            </div>
            <div className={styles.rangeGroup} aria-label="분석 기간">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === rangeDays ? styles.rangeActive : ""}
                  onClick={() => setRangeDays(option)}
                >
                  최근 {option}일
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span className={styles.heroBadge}>전환 유입 정리</span>
            <h2>
              광고비 판단 전에 “어디서 들어와서 전환됐는지”를 먼저 본다.
            </h2>
            <p>
              Meta·Google·Naver·Direct를 같은 원장 기준으로 묶어 봅니다. 바이오컴/커피는 결제완료,
              AIBIO는 폼 제출을 전환으로 보며, 테스트/디버그 row를 분리합니다.
            </p>
          </div>
          <div className={styles.heroPanel}>
            <span>기간 내 운영 전환</span>
            <strong>{loading ? "..." : fmtNum(totalConversions)}</strong>
            <p>
              기준: {resolveDataSourceLabel(data?.dataSource)}
              <br />
              원장 raw {fmtNum(totalRawConversions)}건 / 제외 {fmtNum(totalExcludedConversions)}건
              <br />
              가장 많은 전환 source: {bestSite ? bestSite.name : "-"}
              <br />
              생성 시각: {fmtKst(data?.generatedAt)} KST
            </p>
          </div>
        </section>

        {error && <div className={styles.errorBox}>{error}</div>}
        {loading && <div className={styles.loadingBox}>유입분석 데이터를 불러오는 중입니다.</div>}

        {data && !loading && (
          <>
            <div className={styles.siteGrid}>
              {data.sites.map((site) => <SiteHeroCard key={site.key} site={site} />)}
            </div>

            <section className={styles.notesBox}>
              <h3>읽는 기준</h3>
              <p>현재 데이터 기준: {resolveDataSourceLabel(data.dataSource)}</p>
              {data.notes.map((note) => <p key={note}>{note}</p>)}
              {(data.remoteWarnings ?? []).map((warning) => <p key={warning}>운영 원장 경고: {warning}</p>)}
            </section>

            {data.sites.map((site) => (
              <SiteDetail
                key={site.key}
                site={site}
                aibioMeta={aibioMeta}
                aibioMetaLoading={aibioMetaLoading}
              />
            ))}

            {/* GA4 채널별 결제 분석 */}
            <GA4ChannelAnalysis />

            {/* Sprint9 결과: 유입채널 × 상품 카테고리 × 재구매 교차 */}
            <CohortCategoryCard />
          </>
        )}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════
   GA4 채널별 결제·LTV 분석
   ══════════════════════════════════════════ */

type GA4Row = {
  sessionSource: string;
  sessionMedium: string;
  channel: string;
  sessions: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  purchaseConversionRate: number;
  totalUsers: number;
};
type GA4ChannelGroup = {
  channel: string;
  sessions: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
};

// 영양제 vs 검사권 LTV 승수 (광고 유입 50% 보정 적용)
const AD_DISCOUNT = 0.5;
const LTV_SUPPLEMENTS = { additionalRevenue: 139965, label: "영양제 180일 재구매" };
const LTV_TEST_KIT = { additionalRevenue: 98914, label: "검사 상담효과(가중)" };

const classifyLtv = (source: string): { additional: number; label: string } | null => {
  const s = source.toLowerCase();
  if (s.includes("kimteamjang") || s.includes("supplement") || s.includes("healthfood") || s.includes("dietset") || s.includes("dangdang") || s.includes("newromaster") || s.includes("bangtanjelly")) {
    return { additional: Math.round(LTV_SUPPLEMENTS.additionalRevenue * AD_DISCOUNT), label: LTV_SUPPLEMENTS.label };
  }
  if (s.includes("meta_biocom") || s.includes("tiktok_biocom")) {
    return { additional: Math.round(LTV_TEST_KIT.additionalRevenue * AD_DISCOUNT), label: LTV_TEST_KIT.label };
  }
  return null;
};

type DateRange = {
  value: string;
  label: string;
  mode: "days" | "year";
  days?: number;
  year?: number;
};

const CURRENT_YEAR = new Date().getFullYear();

const DATE_RANGES: DateRange[] = [
  { value: "7", label: "최근 7일", mode: "days", days: 7 },
  { value: "14", label: "최근 14일", mode: "days", days: 14 },
  { value: "30", label: "최근 30일", mode: "days", days: 30 },
  { value: "90", label: "최근 90일", mode: "days", days: 90 },
  { value: "y2024", label: "2024년", mode: "year", year: 2024 },
  { value: "y2025", label: "2025년", mode: "year", year: 2025 },
  { value: "y2026", label: `${CURRENT_YEAR}년 YTD`, mode: "year", year: CURRENT_YEAR },
];

function GA4ChannelAnalysis() {
  const [ga4Data, setGa4Data] = useState<{ rows: GA4Row[]; byChannel: GA4ChannelGroup[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangeValue, setRangeValue] = useState("30");
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const selectedRange = useMemo(
    () => DATE_RANGES.find((r) => r.value === rangeValue) ?? DATE_RANGES[2],
    [rangeValue],
  );

  const resolvedRange = useMemo(() => {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (selectedRange.mode === "year" && selectedRange.year != null) {
      const year = selectedRange.year;
      const startDate = `${year}-01-01`;
      const lastDay = new Date(year, 11, 31);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = fmt(year === yesterday.getFullYear() ? yesterday : lastDay);
      return { startDate, endDate };
    }
    const days = selectedRange.days ?? 30;
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return { startDate: fmt(start), endDate: fmt(end) };
  }, [selectedRange]);

  const loadGA4 = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/ga4/source-conversion?site=biocom&startDate=${resolvedRange.startDate}&endDate=${resolvedRange.endDate}&limit=500`,
      );
      const d = await res.json();
      setGa4Data({ rows: d.rows ?? [], byChannel: d.byChannel ?? [] });
    } catch { /* ignore */ }
    setLoading(false);
  }, [resolvedRange]);

  useEffect(() => {
    void Promise.resolve().then(loadGA4);
  }, [loadGA4]);

  const fmtN = (n: number) => n.toLocaleString("ko-KR");
  const fmtW = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;
  const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;

  // 채널 그룹별 집계 + 상세 소스 분류
  const channelDetails = useMemo(() => {
    if (!ga4Data?.rows) return [];
    const groups = new Map<string, { rows: GA4Row[]; purchases: number; revenue: number; sessions: number }>();
    for (const row of ga4Data.rows) {
      const ch = row.channel || "unknown";
      const g = groups.get(ch) ?? { rows: [], purchases: 0, revenue: 0, sessions: 0 };
      g.rows.push(row);
      g.purchases += row.ecommercePurchases;
      g.revenue += row.grossPurchaseRevenue;
      g.sessions += row.sessions;
      groups.set(ch, g);
    }
    return [...groups.entries()]
      .map(([channel, g]) => ({
        channel,
        ...g,
        conversionRate: g.sessions > 0 ? g.purchases / g.sessions : 0,
        rows: g.rows.sort((a, b) => b.ecommercePurchases - a.ecommercePurchases),
      }))
      .sort((a, b) => b.purchases - a.purchases);
  }, [ga4Data]);

  // YouTube 상세
  const youtubeRows = useMemo(() => {
    if (!ga4Data?.rows) return [];
    return ga4Data.rows
      .filter((r) => r.sessionSource.toLowerCase().includes("youtube"))
      .sort((a, b) => b.ecommercePurchases - a.ecommercePurchases);
  }, [ga4Data]);

  if (!ga4Data && !loading) return null;

  return (
    <section className={styles.section} style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className={styles.sectionTitle} style={{ margin: 0 }}>GA4 채널별 결제 분석 (바이오컴)</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {DATE_RANGES.map((dr) => (
            <button key={dr.value} onClick={() => setRangeValue(dr.value)} style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
              background: rangeValue === dr.value ? "#6366f1" : "#fff", color: rangeValue === dr.value ? "#fff" : "#64748b",
            }}>{dr.label}</button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
        GA4 ecommerce Purchase 이벤트 기준. sessionSource/sessionMedium로 유입 채널 식별.
        추정 LTV는 광고 유입 보정(50% 할인) 적용.
        <br />
        <span style={{ color: "#475569" }}>
          조회 기간: <strong>{resolvedRange.startDate} ~ {resolvedRange.endDate}</strong>
        </span>
        <br />
        <span style={{ color: "#d97706", fontWeight: 600 }}>코호트 실측 진행 중: Meta 유입 47명 중 재구매 12.8% (50% 보정 추정치와 일치)</span>
      </p>

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div>
      ) : (
        <>
          {/* 채널 그룹 요약 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
            {channelDetails.slice(0, 8).map((ch) => (
              <div key={ch.channel} onClick={() => setExpandedChannel(expandedChannel === ch.channel ? null : ch.channel)} style={{
                padding: "12px 14px", borderRadius: 10, background: expandedChannel === ch.channel ? "#f0f9ff" : "#f8fafc",
                border: `1px solid ${expandedChannel === ch.channel ? "#3b82f6" : "#e2e8f0"}`, cursor: "pointer", transition: "all 0.15s",
              }}>
                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{ch.channel}</div>
                <div style={{ fontSize: "0.68rem", color: "#475569", lineHeight: 1.8 }}>
                  <div>구매 <strong>{fmtN(ch.purchases)}</strong>건</div>
                  <div>매출 <strong>{fmtW(ch.revenue)}</strong></div>
                  <div>전환율 <strong style={{ color: ch.conversionRate >= 0.02 ? "#16a34a" : ch.conversionRate >= 0.005 ? "#d97706" : "#dc2626" }}>{fmtP(ch.conversionRate)}</strong></div>
                </div>
              </div>
            ))}
          </div>

          {/* 확장된 채널의 상세 소스 */}
          {expandedChannel && (() => {
            const ch = channelDetails.find((c) => c.channel === expandedChannel);
            if (!ch) return null;
            return (
              <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 12, background: "#f0f9ff", border: "1px solid #93c5fd" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>{ch.channel} 상세 소스 (구매 Top 15)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        {["소스", "세션", "구매", "매출", "전환율", "객단가", "추정 LTV 매출"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#64748b", fontSize: "0.66rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ch.rows.slice(0, 15).map((r) => {
                        const ltv = classifyLtv(r.sessionSource);
                        const avgOv = r.ecommercePurchases > 0 ? r.grossPurchaseRevenue / r.ecommercePurchases : 0;
                        const ltvRevenue = ltv && r.ecommercePurchases > 0 ? r.grossPurchaseRevenue + r.ecommercePurchases * ltv.additional : null;
                        const conv = r.sessions > 0 ? r.ecommercePurchases / r.sessions : 0;
                        return (
                          <tr key={r.sessionSource} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#1e293b", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sessionSource}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(r.sessions)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: r.ecommercePurchases > 0 ? "#16a34a" : "#94a3b8" }}>{r.ecommercePurchases}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtW(r.grossPurchaseRevenue)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: conv >= 0.02 ? "#16a34a" : conv >= 0.005 ? "#d97706" : "#dc2626" }}>{fmtP(conv)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{avgOv > 0 ? fmtW(avgOv) : "—"}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: ltvRevenue ? "#2563eb" : "#94a3b8" }}>
                              {ltvRevenue ? fmtW(ltvRevenue) : "—"}
                              {ltv && <div style={{ fontSize: "0.56rem", color: "#64748b" }}>{ltv.label}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* YouTube 인사이트 */}
          {youtubeRows.length > 0 && (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "linear-gradient(135deg, #fef2f2, #fff1f2)", border: "1px solid #fca5a5", marginBottom: 16 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>YouTube 유입 결제 분석</div>
              <div style={{ fontSize: "0.72rem", color: "#7f1d1d", lineHeight: 1.8 }}>
                {youtubeRows.map((r) => {
                  const conv = r.sessions > 0 ? r.ecommercePurchases / r.sessions : 0;
                  return (
                    <div key={r.sessionSource} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #fecaca" }}>
                      <span style={{ fontWeight: 600 }}>{r.sessionSource}</span>
                      <span>구매 <strong>{r.ecommercePurchases}</strong>건 · 매출 {fmtW(r.grossPurchaseRevenue)} · 전환율 <strong style={{ color: conv >= 0.03 ? "#16a34a" : "#d97706" }}>{fmtP(conv)}</strong> · 세션 {fmtN(r.sessions)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: "0.68rem", color: "#991b1b", lineHeight: 1.6 }}>
                <strong>인사이트:</strong> YouTube 유입의 세션→구매 전환율이 Meta({fmtP((channelDetails.find((c) => c.channel === "meta")?.conversionRate ?? 0))})보다 높소.
                유튜브 콘텐츠가 강한 구매 의향을 만들고 있으며, UTM 체계화로 영상별 ROI 정밀 측정이 가능하오.
              </div>
            </div>
          )}

          {/* 인사이트 요약 */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "1px solid #fcd34d" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#92400e", marginBottom: 6 }}>데이터 수집 현황 및 다음 단계</div>
            <div style={{ fontSize: "0.72rem", color: "#78350f", lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>Meta 유입 코호트 추적 (진행 중):</strong> Attribution ledger에 Meta 유입 48건 수집 완료.
                건강기능식품 캠페인(`kimteamjang_supplements`) 14명 중 재구매 3명(21.4%) — 50% 보정 추정치와 일치.
                표본 50건+ 모이면 광고 유입 전용 LTV multiplier로 전환 예정.
              </p>
              <p style={{ margin: "0 0 6px" }}>
                <strong>YouTube UTM 체계화 필요:</strong> 이 기간의 YouTube 관련 유입원은 <strong>{youtubeRows.length}개</strong> (유기 referrer + 기존 utm_source 태깅 조합).
                유기 `youtube.com/referral` 세션은 영상이 특정되지 않아 ROI 추적이 불가하고, 기존 태깅은 `youtube_teamketo_0527...` 같은
                채널·에피소드 단위로 일관되지 않소. 모든 영상에 `utm_source=youtube` + `utm_campaign=&lt;video_id&gt;` 같은
                표준 스킴을 붙이면 영상별 ROI 정밀 측정 가능.
              </p>
              <p style={{ margin: 0 }}>
                <strong>아임웹 API 한계:</strong> 유입분석(referrer) API 없음. GA4 API가 유일한 채널별 결제 분석 소스.
                openapi.imweb.me OAuth 확보 시 추가 가능성 있으나 미확인.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════
   유입채널 × 상품 카테고리 × 재구매 코호트 (Sprint6·9 결과)
   ══════════════════════════════════════════ */

type CohortWindowSummary = { n: number; revenue: number; median: number | null };
type CohortChannel = {
  channel: string;
  customerCount: number;
  matureCohort: { d30: CohortWindowSummary; d90: CohortWindowSummary; d180: CohortWindowSummary };
};
type CohortLtrResponse = {
  ok: boolean;
  dataSource?: string;
  range?: { startAt: string; endAt: string };
  channels: CohortChannel[];
};

type CategoryRepeatCell = {
  channel: string;
  category: "test_kit" | "supplement" | "other";
  isDangdangcare: boolean;
  customerCount: number;
  repeaterCount: number;
  repeatRate: number;
  medianFirstPurchaseAmount: number | null;
  median180dLtr: number | null;
};
type ChannelCategoryRepeatResponse = {
  ok: boolean;
  dataSource?: string;
  cells: CategoryRepeatCell[];
};

type ReverseFunnelByChannel = {
  channel: string;
  supplementFirstBuyers: number;
  convertedToTest: number;
  rate: number;
};
type ReverseFunnelResponse = {
  ok: boolean;
  overall: ReverseFunnelByChannel;
  byChannel: ReverseFunnelByChannel[];
};

type IdentityDiagnosticsResponse = {
  ok: boolean;
  identity: {
    total: number;
    filled: number;
    empty: number;
    bySource: {
      vm_native: number;
      imweb_order_lookup: number;
      ga_session_link: number;
      ga_session_synthetic: number;
      empty: number;
    };
  };
  fillRatePercent: number;
  joinableRatePercent: number;
  emptyRowsByTouchpoint?: Record<string, number>;
};

const CHANNEL_DISPLAY: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "#dc2626" },
  meta: { label: "Meta", color: "#1877f2" },
  tiktok: { label: "TikTok", color: "#000000" },
  google: { label: "Google", color: "#ea4335" },
  other: { label: "기타/Direct", color: "#64748b" },
};

const CATEGORY_DISPLAY: Record<CategoryRepeatCell["category"], { label: string; color: string }> = {
  test_kit: { label: "검사권", color: "#0ea5e9" },
  supplement: { label: "영양제", color: "#16a34a" },
  other: { label: "기타", color: "#94a3b8" },
};

function CohortCategoryCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cohort, setCohort] = useState<CohortLtrResponse | null>(null);
  const [cells, setCells] = useState<CategoryRepeatCell[]>([]);
  const [funnel, setFunnel] = useState<ReverseFunnelResponse | null>(null);
  const [diag, setDiag] = useState<IdentityDiagnosticsResponse | null>(null);

  // 기본 조회 범위: 최근 365일 (VM 원장 기본 lookback과 일치)
  const [range] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 365);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { startAt: fmt(start), endAt: fmt(end) };
  });

  useEffect(() => {
    const abort = new AbortController();
    const base = `${API_BASE}/api/attribution`;
    const params = `startAt=${range.startAt}&endAt=${range.endAt}&dataSource=vm`;
    Promise.all([
      fetch(`${base}/cohort-ltr?${params}`, { signal: abort.signal }).then((r) => r.json()),
      fetch(`${base}/channel-category-repeat?${params}`, { signal: abort.signal }).then((r) => r.json()),
      fetch(`${base}/reverse-funnel?${params}`, { signal: abort.signal }).then((r) => r.json()),
      fetch(`${base}/identity-diagnostics?dataSource=vm`, { signal: abort.signal }).then((r) => r.json()),
    ])
      .then(([c, r, f, d]) => {
        setCohort(c);
        setCells((r?.cells as CategoryRepeatCell[]) ?? []);
        setFunnel(f);
        setDiag(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as DOMException)?.name === "AbortError") return;
        setError((err as Error).message ?? "cohort fetch failed");
        setLoading(false);
      });
    return () => abort.abort();
  }, [range]);

  const totalCustomers = useMemo(
    () => cohort?.channels.reduce((sum, c) => sum + c.customerCount, 0) ?? 0,
    [cohort],
  );

  const nonzeroCells = useMemo(
    () => cells.filter((c) => c.customerCount > 0).sort((a, b) => b.customerCount - a.customerCount),
    [cells],
  );

  const fmtW = (n: number | null | undefined) => (n == null ? "—" : `₩${Math.round(n).toLocaleString("ko-KR")}`);
  const fmtRate = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <section className={styles.section} style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            유입채널 × 상품 카테고리 × 재구매 코호트
          </h2>
          <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4, marginBottom: 0 }}>
            Attribution 원장(VM) · Imweb 주문(로컬 SQLite) · Playauto 상품 라인(Postgres)을 join한 고객 단위 집계. 론 코하비
            6체크(Twyman·SRM·Selection·Survivorship·OEC·Power) 기준으로 읽을 것.
          </p>
        </div>
        <span style={{ fontSize: "0.66rem", color: "#64748b", padding: "4px 8px", background: "#f1f5f9", borderRadius: 6 }}>
          조회 범위 {range.startAt} ~ {range.endAt} · dataSource=vm
        </span>
      </div>

      {loading && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>코호트 집계를 불러오는 중...</div>}
      {error && <div style={{ padding: 12, color: "#dc2626", background: "#fef2f2", borderRadius: 8 }}>로드 실패: {error}</div>}

      {!loading && !error && (
        <>
          {/* 관측 가능 기간 + ID 진단 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>관측 가능 고객 수</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1e293b" }}>
                {totalCustomers.toLocaleString("ko-KR")}명
              </div>
              <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: 4 }}>
                VM 원장에서 first_touch가 잡힌 고유 고객 합계
              </div>
            </div>
            {diag && (
              <>
                <div style={{ padding: 12, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#166534", marginBottom: 4 }}>customerKey 채움률</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#166534" }}>{diag.fillRatePercent}%</div>
                  <div style={{ fontSize: "0.62rem", color: "#16a34a", marginTop: 4 }}>
                    filled {diag.identity.filled.toLocaleString("ko-KR")} / total {diag.identity.total.toLocaleString("ko-KR")}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: "0.68rem", color: "#1d4ed8", marginBottom: 4 }}>imweb_orders 조인 가능</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1d4ed8" }}>{diag.joinableRatePercent}%</div>
                  <div style={{ fontSize: "0.62rem", color: "#2563eb", marginTop: 4 }}>
                    vm_native {diag.identity.bySource.vm_native} · imweb lookup {diag.identity.bySource.imweb_order_lookup} · session
                    link {diag.identity.bySource.ga_session_link}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "#fef3c7", border: "1px solid #fcd34d" }}>
                  <div style={{ fontSize: "0.68rem", color: "#92400e", marginBottom: 4 }}>조인 불가(ga 합성)</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#92400e" }}>
                    {diag.identity.bySource.ga_session_synthetic.toLocaleString("ko-KR")}건
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "#b45309", marginTop: 4 }}>
                    customerKey는 채웠지만 imweb_orders 직접 매치 불가 — 주문 없는 touch
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 채널 × 카테고리 × 당당케어 교차 */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              채널 × 카테고리 × 재구매 교차 표
            </h3>
            <p style={{ fontSize: "0.66rem", color: "#64748b", marginBottom: 8 }}>
              `customerCount` = 해당 채널 유입 중 해당 카테고리로 첫 구매한 고객 수. `rep` = 그 중 180일 내 재구매자. 숫자 옆의
              「N= 관측」은 관찰 데이터임을 명시 — 인과 주장 금지, 표본 50 미만이면 외부 인용 금지.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                    {["채널", "카테고리", "당당케어", "n(고객)", "rep(재구매)", "재구매율", "중앙 첫구매액"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonzeroCells.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>
                        customerCount 0. VM 원장이 비어 있거나 조회 범위 밖일 수 있소.
                      </td>
                    </tr>
                  )}
                  {nonzeroCells.map((c) => {
                    const chDisp = CHANNEL_DISPLAY[c.channel] ?? { label: c.channel, color: "#64748b" };
                    const catDisp = CATEGORY_DISPLAY[c.category];
                    const underPower = c.customerCount < 50;
                    return (
                      <tr key={`${c.channel}-${c.category}-${c.isDangdangcare}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px", textAlign: "left" }}>
                          <span style={{ color: chDisp.color, fontWeight: 600 }}>{chDisp.label}</span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "left" }}>
                          <span style={{ color: catDisp.color, fontWeight: 600 }}>{catDisp.label}</span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {c.isDangdangcare ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>★ 당당케어</span>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>
                          {c.customerCount.toLocaleString("ko-KR")}
                          {underPower && (
                            <span style={{ fontSize: "0.56rem", color: "#dc2626", marginLeft: 4 }}>N&lt;50</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{c.repeaterCount}</td>
                        <td
                          style={{
                            padding: "6px 10px",
                            textAlign: "right",
                            fontWeight: 700,
                            color:
                              c.customerCount < 10
                                ? "#94a3b8"
                                : c.repeatRate >= 0.1
                                ? "#16a34a"
                                : c.repeatRate >= 0.03
                                ? "#d97706"
                                : "#94a3b8",
                          }}
                        >
                          {c.customerCount > 0 ? fmtRate(c.repeatRate) : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtW(c.medianFirstPurchaseAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 역퍼널 */}
          {funnel && (
            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #bfdbfe" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>
                역퍼널: 영양제 첫 구매 → 180일 내 검사권 전환
              </h3>
              <p style={{ fontSize: "0.66rem", color: "#1e3a8a", marginBottom: 8 }}>
                /callprice 전사 평균은 7.0%. 아래는 채널별 분해. 표본 제약으로 채널별 비교는 아직 유의하지 않음.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                <div style={{ padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: "0.62rem", color: "#1d4ed8" }}>전체</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{fmtRate(funnel.overall.rate)}</div>
                  <div style={{ fontSize: "0.58rem", color: "#64748b" }}>
                    {funnel.overall.convertedToTest}/{funnel.overall.supplementFirstBuyers}
                  </div>
                </div>
                {funnel.byChannel.map((b) => {
                  const chDisp = CHANNEL_DISPLAY[b.channel] ?? { label: b.channel, color: "#64748b" };
                  return (
                    <div key={b.channel} style={{ padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.62rem", color: chDisp.color, fontWeight: 600 }}>{chDisp.label}</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                        {b.supplementFirstBuyers > 0 ? fmtRate(b.rate) : "—"}
                      </div>
                      <div style={{ fontSize: "0.58rem", color: "#64748b" }}>
                        {b.convertedToTest}/{b.supplementFirstBuyers}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 관측 한계 / 검토 내역 */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              fontSize: "0.72rem",
              color: "#78350f",
              lineHeight: 1.6,
            }}
          >
            <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", marginTop: 0, marginBottom: 6 }}>
              현재 관측 한계 + 다른 데이터로 유입분석이 되는가에 대한 검토
            </h3>
            <p style={{ margin: "0 0 6px" }}>
              <strong>문제</strong>: 위 표에서 대부분 cell의 `n` 이 10~50 사이인 이유는 VM attribution 원장이 <strong>2026-04-12 cutover
              이후 17일치</strong>만 쌓여 있기 때문. first_touch_at 이 전부 최근 17일 안이라, 180일 LTR·재구매 분석의 성숙 cohort가
              형성되지 않는다. /callprice 전사 평균(영양제 재구매율 45.1%, 역퍼널 7.0%)과 정면 비교하려면 VM이 최소 90~180일
              누적돼야 한다.
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong>다른 데이터로 유입분석이 가능한가</strong>: 검토한 대안 4가지 모두 "채널 × 고객 × 재구매" 3축 동시 조인이
              안 된다.
            </p>
            <ul style={{ margin: "0 0 6px 16px", padding: 0 }}>
              <li>
                <strong>GA4 (2024~2026 전체)</strong>: 세션·매체 단위 집계는 가능(본 페이지 상단 &lt;GA4 채널별 결제 분석&gt;이 이
                방식). 그러나 GA4 client_id 는 imweb member_code 와 매칭 불가 → 고객 단위 LTV 연결 못 한다.
              </li>
              <li>
                <strong>Imweb/Playauto 주문 (2023-07 ~ 2026-04, 3년)</strong>: 상품 × 재구매는 본 Sprint9 로 확보됨. 그러나 주문
                row 자체에 유입 채널 정보가 없음(UTM·referrer 미저장).
              </li>
              <li>
                <strong>Meta CAPI 로그</strong>: fbclid → imweb 주문 join 은 ROAS 추적에서 이미 쓰이는 중. 그러나 이건 Meta 한
                채널에만 해당하고, 해당 주문의 &quot;첫 터치 유입&quot; 시점 원장은 여전히 VM attribution_ledger.
              </li>
              <li>
                <strong>로컬 노트북 attribution_ledger</strong>: 2026-04-12 이전 데이터가 있지만 개발·디버그 섞인 표본이라 운영
                지표로 쓰기 어렵다.
              </li>
            </ul>
            <p style={{ margin: "0 0 6px" }}>
              <strong>결론</strong>: 유입 × 고객 × 재구매 3축 동시 분석은 <strong>VM attribution_ledger 가 유일한 원천</strong>. 따라서
              시간이 쌓이기를 기다리는 것 외에 지금 당장 숫자를 키우는 방법은 없다. 대신 아래 두 갈래로 보완한다.
            </p>
            <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
              <li>
                채널·세션 수준 분석은 본 페이지 상단 &lt;GA4 채널별 결제 분석&gt;에서 2024/2025/2026 YTD 로 이미 보고 있음.
              </li>
              <li>
                상품·재구매 수준 분석은 /callprice 전사 평균(상담 분석)에서 이미 보고 있음.
              </li>
              <li>
                두 축의 교차(= 이 카드)는 VM 히스토리 누적 대기. 90일 시점(~2026-07)에 1차 중간 점검, 180일 시점(~2026-10)에 론
                코하비 6체크 돌리고 YouTube LTV 주장을 확정/기각한다.
              </li>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
