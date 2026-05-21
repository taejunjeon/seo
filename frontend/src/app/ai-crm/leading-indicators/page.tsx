"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";
import {
  BIOCOM_META_COHORT_SPLIT,
  COFFEE_CHANNEL_TRUTH,
  COHORT_SUMMARY,
  CohortRow,
  DRY_RUN_META,
  PAGE_LONG_THRESHOLD_FIT,
  PageLongThresholdRow,
  READINESS,
  channelLabelKo,
} from "./dry-run";

type SiteKey = "biocom" | "thecleancoffee";
type WindowKey = "1d" | "7d" | "14d" | "30d";
type ChannelKey =
  | "meta"
  | "youtube"
  | "google_paid"
  | "naver_paid_or_brand"
  | "direct_or_unknown"
  | "all";
type DimensionKey = "buyer_vs_leaver" | "channel";

type GoogleAdsAuditReadiness = "ok" | "verify_click_id_capture" | "gap" | "not_found";

type GoogleAdsFinalUrlSiteSummary = {
  site: "biocom" | "thecleancoffee" | "other" | "unknown";
  label: string;
  rows: number;
  finalUrls: number;
  manualUtmRows: number;
  googleClickParamRows: number;
  trackingTemplateRows: number;
  finalUrlSuffixRows: number;
  readiness: GoogleAdsAuditReadiness;
  interpretation: string;
};

type LandingClickIdAudit = {
  site: "biocom" | "thecleancoffee";
  label: string;
  windowDays: number;
  totalLandingRows: number;
  googleClickIdRows: number;
  googleClickIdRowsByType: {
    gclid: number;
    gbraid: number;
    wbraid: number;
  };
  googleUtmRows: number;
  googleChannelRows: number;
  googleEvidenceRows: number;
  nonGooglePaidSearchRows: number;
  googleEvidenceBreakdown: Array<{
    segment: "google_ads_paid" | "google_organic" | "google_unknown" | "not_google_paid_search";
    label: string;
    rows: number;
    confidence: "high" | "medium" | "low";
    interpretation: string;
  }>;
  latestLandingAt: string | null;
  topLandingPaths: Array<{
    path: string;
    rows: number;
    googleEvidenceRows: number;
  }>;
  captureStatus:
    | "google_click_id_present"
    | "google_channel_without_click_id"
    | "not_google_paid_search"
    | "landing_rows_present_no_google_evidence"
    | "no_landing_rows"
    | "table_unavailable";
  interpretation: string;
};

type OtherFinalUrlSummary = {
  totalRows: number;
  finalUrls: number;
  dispositionSummary: Array<{
    disposition: string;
    label: string;
    rows: number;
    finalUrls: number;
    interpretation: string;
  }>;
  samples: Array<{
    campaignName: string;
    campaignStatus: string;
    channel: string;
    parentName: string | null;
    entityStatus: string;
    hosts: string[];
    sampleUrls: string[];
    disposition: string;
    dispositionLabel: string;
    reason: string;
  }>;
  interpretation: string;
};

type GoogleAdsTrafficRouteAudit = {
  site: "biocom" | "thecleancoffee";
  label: string;
  windowDays: number;
  decision:
    | "actual_google_paid_click_confirmed"
    | "ads_config_present_but_no_landing_evidence"
    | "paused_or_legacy_config_only"
    | "no_ads_config_no_landing_evidence"
    | "landing_table_unavailable";
  confidence: "high" | "medium" | "low";
  accountEvidence: {
    currentAccountFinalUrlRows: number;
    enabledRows: number;
    pausedOrRemovedRows: number;
    manualUtmRows: number;
    googleClickParamRows: number;
    trackingTemplateRows: number;
    finalUrlSuffixRows: number;
    legacyOrOtherRows: number;
    legacyNeedsMappingRows: number;
  };
  landingEvidence: {
    totalLandingRows: number;
    googleClickIdRows: number;
    googleEvidenceRows: number;
    nonGooglePaidSearchRows: number;
    latestLandingAt: string | null;
  };
  routeSteps: Array<{
    step: string;
    label: string;
    status: "pass" | "warn" | "fail";
    evidence: string;
    interpretation: string;
  }>;
  nextActions: Array<{
    owner: "Codex" | "TJ";
    action: string;
    why: string;
    successCriteria: string;
  }>;
  interpretation: string;
};

type GoogleAdsFinalUrlAuditResponse = {
  ok: boolean;
  fetchedAt?: string;
  customerId?: string;
  autoTaggingEnabled?: boolean | null;
  customer?: {
    descriptiveName?: string;
  } | null;
  summary?: {
    totalRows: number;
    adRows: number;
    assetGroupRows: number;
    finalUrls: number;
    manualUtmRows: number;
    googleClickParamRows: number;
    trackingTemplateRows: number;
    finalUrlSuffixRows: number;
    siteSummary: GoogleAdsFinalUrlSiteSummary[];
    landingClickIdAudit?: LandingClickIdAudit[];
    otherUrlSummary?: OtherFinalUrlSummary;
    actualTrafficRouteAudit?: GoogleAdsTrafficRouteAudit[];
    warnings: string[];
  };
  error?: unknown;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const SITE_OPTIONS: { value: SiteKey; label: string }[] = [
  { value: "biocom", label: "바이오컴" },
  { value: "thecleancoffee", label: "더클린커피" },
];

const WINDOW_OPTIONS: { value: WindowKey; label: string }[] = [
  { value: "1d", label: "어제" },
  { value: "7d", label: "최근 7일" },
  { value: "14d", label: "최근 14일" },
  { value: "30d", label: "최근 30일" },
];

const CHANNEL_OPTIONS: { value: ChannelKey; label: string }[] = [
  { value: "meta", label: "Meta" },
  { value: "youtube", label: "YouTube" },
  { value: "google_paid", label: "Google 유료" },
  { value: "naver_paid_or_brand", label: "네이버 paid/brand" },
  { value: "direct_or_unknown", label: "직접/불명" },
  { value: "all", label: "전체" },
];

const DIMENSION_OPTIONS: { value: DimensionKey; label: string }[] = [
  { value: "buyer_vs_leaver", label: "3개 cohort" },
  { value: "channel", label: "채널별" },
];

const siteLabelKo = (site: SiteKey) =>
  SITE_OPTIONS.find((s) => s.value === site)?.label ?? site;

const fmtKRW = (krw: number): string => {
  if (krw === 0) return "₩0";
  if (krw < 10_000) return `₩${krw.toLocaleString("ko-KR")}`;
  const eok = Math.floor(krw / 100_000_000);
  const man = Math.floor((krw % 100_000_000) / 10_000);
  if (eok > 0 && man > 0) return `₩${eok}억 ${man.toLocaleString("ko-KR")}만`;
  if (eok > 0) return `₩${eok}억`;
  return `₩${man.toLocaleString("ko-KR")}만`;
};

const fmtPct = (value: number | null, digits = 1): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
};

const fmtSeconds = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}초`;
};

const fmtCount = (value: number): string => value.toLocaleString("ko-KR");

const fmtRateFraction = (
  numerator: number,
  denominator: number,
  rate: number | null
): string => {
  if (denominator === 0 || rate === null) return "표본 없음";
  return `${numerator}/${denominator}명 · ${fmtPct(rate)}`;
};

const pageLongStatusLabel = (row: PageLongThresholdRow): string => {
  if (row.vmSafeSessions === 0) return "유입 0 또는 미매핑";
  if (row.confirmedGa4JoinedSessions < 20) return "표본 부족";
  if (row.recommendationStatus === "shorter_threshold_better_for_primary_indicator") {
    return "3분 기준 우선";
  }
  return "7분은 보조 기준";
};

const pageLongInterpretation = (row: PageLongThresholdRow): string => {
  if (row.vmSafeSessions === 0) {
    return "현재 VM Cloud가 Google 유료로 분류한 세션이 없습니다. 실제 유입이 없었는지, gclid/utm 값이 다른 bucket으로 들어갔는지 source 미매핑 점검이 필요합니다.";
  }
  if (row.confirmedGa4JoinedSessions < 20) {
    const stepPct =
      row.confirmedGa4JoinedSessions > 0 ? 100 / row.confirmedGa4JoinedSessions : null;
    return `구매자 표본이 ${row.confirmedGa4JoinedSessions}명뿐이라 1명만 달라져도 ${
      stepPct ? `${stepPct.toFixed(1)}%p` : "큰 폭"
    } 움직입니다. 그래서 60%, 40%, 20%처럼 딱 떨어지는 숫자는 방향만 봐야 합니다.`;
  }
  if (row.current7Min.liftPct !== null && row.current7Min.liftPct < 3) {
    return "7분까지 오래 읽은 사람만 보면 구매자와 비결제자의 차이가 거의 사라집니다. 7분은 초고의도 보조 신호로 두고, 2~3분을 기본 관심 신호로 보는 편이 낫습니다.";
  }
  return `7분도 차이는 있지만 도달자가 줄어듭니다. 기본 선행지표는 ${row.recommendedThresholdLabel ?? "2~3분"} 기준, 7분은 강한 관심 방문 보조 지표로 보는 것이 안전합니다.`;
};

const SCROLL_DENOMINATOR_AUDIT = [
  {
    site: "바이오컴",
    ga4Sessions: 64063,
    oldBuyerRatePct: 92.98,
    oldNonBuyerRatePct: 76.52,
    rawScroll90RatePct: 14.2,
    assumedScrollRatePct: 14.2,
    currentMetaBuyerRatePct: 51.1,
    currentMetaNonBuyerRatePct: 30.0,
    pageViewLongRatePct: 8.3,
    reviewReachRatePct: 23.5,
    changeSummary:
      "과거 화면은 결제자 92.98% / 비결제자 76.52%처럼 보였지만, 최신 원본 GA4 전체 세션 기준은 14.2%입니다. Meta cohort만 다시 보면 결제자 51.1% / 비결제자 30.0%입니다.",
    currentReading:
      "숫자가 낮아진 핵심 이유는 고객이 갑자기 덜 읽어서가 아니라, 분모가 달라졌기 때문입니다. 예전 값은 결제 흐름에 들어온 cohort 위주였고, 새 값은 전체 GA4 세션과 Meta cohort를 나눠 봅니다.",
    nextAction:
      "화면에는 전체 방문자 기준, Meta 결제자 기준, Meta 비결제자 기준을 함께 표시해 예전 90%대 숫자와 최신 14.2%/51.1% 숫자를 혼동하지 않게 합니다.",
  },
  {
    site: "더클린커피",
    ga4Sessions: 3904,
    oldBuyerRatePct: 99.68,
    oldNonBuyerRatePct: 88.52,
    rawScroll90RatePct: 0,
    assumedScrollRatePct: 56.5,
    currentMetaBuyerRatePct: null,
    currentMetaNonBuyerRatePct: null,
    pageViewLongRatePct: 14.0,
    reviewReachRatePct: 26.5,
    changeSummary:
      "과거 화면은 결제자 99.68% / 비결제자 88.52%처럼 보였지만, 최신 GA4 원본에서 percent_scrolled 값이 없어 raw 90% 도달률은 0%입니다. scroll 이벤트 자체를 90%로 간주하면 56.5%지만, 이 값은 부풀려질 수 있습니다.",
    currentReading:
      "여기는 고객 행동이 나빠진 것이 아니라 측정값이 비어 있는 문제입니다. 더클린커피는 scroll 이벤트는 많지만 90%인지 50%인지 구분하는 percent_scrolled 값이 빠져 있어 기존 90%대 숫자를 그대로 믿으면 안 됩니다.",
    nextAction:
      "50%/90% 스크롤을 명시 이벤트로 보내거나, VM Cloud에 가장 깊게 본 스크롤 비율(max_scroll_percent)을 별도로 저장해야 결제자/비결제자 스크롤 차이를 다시 볼 수 있습니다.",
  },
];

const dwellDeltaSeconds = (row: CohortRow): number | null => {
  if (row.buyerP50DwellSeconds === null || row.leaverP50DwellSeconds === null) return null;
  return Number((row.buyerP50DwellSeconds - row.leaverP50DwellSeconds).toFixed(1));
};

const findCoffeeChannel = (channel: ChannelKey): CohortRow | null => {
  if (channel === "all") return null;
  return COFFEE_CHANNEL_TRUTH.find((r) => r.channel === channel) ?? null;
};

export default function LeadingIndicatorsPage() {
  const [site, setSite] = useState<SiteKey>("biocom");
  const [windowKey, setWindowKey] = useState<WindowKey>("7d");
  const [channel, setChannel] = useState<ChannelKey>("meta");
  const [dimension, setDimension] = useState<DimensionKey>("buyer_vs_leaver");
  const [googleAdsAudit, setGoogleAdsAudit] = useState<GoogleAdsFinalUrlAuditResponse | null>(null);
  const [googleAdsAuditError, setGoogleAdsAuditError] = useState<string | null>(null);

  const coffeeMetaRow = useMemo(() => findCoffeeChannel("meta")!, []);
  const selectedCoffeeRow = useMemo(() => findCoffeeChannel(channel), [channel]);
  const pageLongRows = useMemo(() => {
    const siteRows = PAGE_LONG_THRESHOLD_FIT.filter((row) => row.site === site);
    if (channel === "all") return siteRows;
    return siteRows.filter((row) => row.sourceGroup === channel);
  }, [channel, site]);

  const biocomConfirmed = COHORT_SUMMARY.find(
    (r) => r.site === "biocom" && r.cohort === "confirmed_purchase"
  )!;
  const biocomDropped = COHORT_SUMMARY.find(
    (r) => r.site === "biocom" && r.cohort === "dropped_checkout"
  )!;
  const coffeeConfirmed = COHORT_SUMMARY.find(
    (r) => r.site === "thecleancoffee" && r.cohort === "confirmed_purchase"
  )!;
  const coffeeDropped = COHORT_SUMMARY.find(
    (r) => r.site === "thecleancoffee" && r.cohort === "dropped_checkout"
  )!;

  const biocomReadiness = READINESS.find((r) => r.site === "biocom")!;
  const coffeeReadiness = READINESS.find((r) => r.site === "thecleancoffee")!;

  // dry-run 모드에서 13d/14d/30d 는 동일한 7d snapshot 만 보유
  const windowHint =
    windowKey === "7d"
      ? ""
      : "(현재 dry-run 은 7일 snapshot 만 보유, 다른 기간은 P1 라이브 API 연결 후 분리)";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    fetch(`${API_BASE}/api/google-ads/final-url-audit?limit=1000`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<GoogleAdsFinalUrlAuditResponse>;
      })
      .then((body) => {
        if (!body.ok) {
          throw new Error("Google Ads final URL audit failed");
        }
        setGoogleAdsAudit(body);
        setGoogleAdsAuditError(null);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setGoogleAdsAuditError(error instanceof Error ? error.message : "audit fetch failed");
        }
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <>
      <GlobalNav activeSlug="ai-crm" />
      <main className={styles.page}>
        <div className={styles.headerBar}>
          <h1 className={styles.title}>
            오늘 구매를 예고하는 행동은 무엇인가?
            <span className={styles.sampleBadge}>샘플 / 최근 dry-run 기준</span>
          </h1>
          <span className={styles.freshness}>
            데이터 기준 {DRY_RUN_META.checkedAtKst} · {DRY_RUN_META.window} · source{" "}
            {DRY_RUN_META.source}
          </span>
        </div>
        <p className={styles.subtitle}>
          결제한 사람과 결제하지 않은 사람의 체류시간(페이지에 머문 시간), 스크롤,
          장바구니, 결제 시작 차이를 비교합니다. 광고 플랫폼 주장값이 아니라 VM Cloud 와
          GA4 를 맞춰 본 내부 행동 분석입니다.
        </p>

        <p className={styles.linkRow}>
          관련 화면 · 퍼널 수집/전송 정상 여부는{" "}
          <Link href="/ai-crm/conversion-funnel">/ai-crm/conversion-funnel</Link> 에서 봅니다.
          이 화면은 정상 수집된 데이터에서 <strong>구매 전 좋은 행동</strong>을 찾는 분석
          화면입니다.
        </p>

        {/* 필터 */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>사이트</span>
            <div className={styles.filterPills}>
              {SITE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${site === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setSite(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>기간</span>
            <div className={styles.filterPills}>
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${windowKey === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setWindowKey(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>채널</span>
            <div className={styles.filterPills}>
              {CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${channel === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setChannel(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>분석 기준</span>
            <div className={styles.filterPills}>
              {DIMENSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.pill} ${dimension === opt.value ? styles.pillActive : ""}`}
                  onClick={() => setDimension(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 상단 판단 카드 3종 */}
        <div className={styles.headlineGrid}>
          <div className={`${styles.headlineCard} ${styles.green}`}>
            <span className={styles.headlineKicker}>오늘 가장 강한 구매 예고 신호</span>
            <h2 className={styles.headlineTitle}>
              Meta 유입 결제자는 비결제자보다 약 48초 더 오래 봅니다
            </h2>
            <p className={styles.headlineBody}>
              더클린커피 · 최근 7일 · safe session 기준 · 결제자 중앙{" "}
              {fmtSeconds(coffeeMetaRow.buyerP50DwellSeconds)} vs 비결제자{" "}
              {fmtSeconds(coffeeMetaRow.leaverP50DwellSeconds)} (+
              {dwellDeltaSeconds(coffeeMetaRow)?.toFixed(1)}초)
            </p>
          </div>
          <div className={`${styles.headlineCard} ${styles.yellow}`}>
            <span className={styles.headlineKicker}>주의할 신호</span>
            <h2 className={styles.headlineTitle}>장바구니는 단독 KPI 로 쓰지 마세요</h2>
            <p className={styles.headlineBody}>
              더클린커피 Meta · 결제자 장바구니/장바구니 페이지 신호{" "}
              {fmtPct(coffeeMetaRow.buyerCartSignalPct)} vs 비결제자{" "}
              {fmtPct(coffeeMetaRow.leaverCartSignalPct)} — 비결제자 쪽이 오히려 높습니다.
            </p>
          </div>
          <div className={`${styles.headlineCard} ${styles.blue}`}>
            <span className={styles.headlineKicker}>데이터 신뢰도</span>
            <h2 className={styles.headlineTitle}>
              더클린커피 high / 바이오컴 보강 필요
            </h2>
            <p className={styles.headlineBody}>
              더클린커피 GA4 join {fmtPct(coffeeMetaRow.joinRatePct)}, 바이오컴 row-level
              join {fmtPct(biocomConfirmed.joinRatePct, 0)}. 바이오컴 Meta-only 비교는
              방향성으로만 봅니다.
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>페이지 롱 뷰 기준 시간 · 7분이 맞는가?</h2>
          <p className={styles.sectionDesc}>
            페이지 롱 뷰는 “방문자가 페이지에 오래 머물렀다”는 신호입니다. 현재 7분은
            너무 강한 기준이라 많은 방문자를 놓칠 수 있습니다. 아래 표는 1분, 2분, 3분,
            5분, 7분 기준에서 결제자와 비결제자가 얼마나 남는지 비교합니다.
          </p>
          <PageLongThresholdPanel rows={pageLongRows} site={site} channel={channel} />
        </section>

        <GooglePaidFinalUrlAuditPanel
          audit={googleAdsAudit}
          error={googleAdsAuditError}
        />

        {/* 구매자 vs 비결제자 비교 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            구매자 vs 비결제자 비교 · {siteLabelKo(site)}{" "}
            {site === "thecleancoffee" && channel !== "all"
              ? `· ${channelLabelKo(channel)}`
              : ""}
          </h2>
          <p className={styles.sectionDesc}>
            결제자와 비결제자가 결제 전 어떻게 다르게 행동했는지 같은 표에서 비교합니다.{" "}
            {windowHint}
          </p>
          <div className={styles.compareCard}>
            {site === "thecleancoffee" && selectedCoffeeRow ? (
              <CoffeeChannelCompare row={selectedCoffeeRow} />
            ) : site === "thecleancoffee" && channel !== "all" ? (
              <MissingCoffeeChannelCompare channel={channel} />
            ) : site === "thecleancoffee" ? (
              <CoffeeAllCompare confirmed={coffeeConfirmed} dropped={coffeeDropped} />
            ) : (
              <BiocomCompare
                confirmed={biocomConfirmed}
                dropped={biocomDropped}
                channel={channel}
              />
            )}
          </div>
        </section>

        {/* 선행지표 후보 랭킹 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>선행지표 후보 랭킹</h2>
          <p className={styles.sectionDesc}>
            분석 결과를 오늘 운영/광고/랜딩에서 무엇을 바꿀지 결정하는 카드로 정리했습니다.
            현재 숫자는 더클린커피 Meta · 최근 7일 기준입니다.
          </p>
          <IndicatorRanking row={coffeeMetaRow} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>90% 스크롤 수치가 낮아진 이유</h2>
          <p className={styles.sectionDesc}>
            90% 스크롤은 “방문자가 페이지의 90% 지점까지 봤다”는 뜻으로 쓰고 싶지만,
            사이트마다 수집 방식이 달라 그대로 비교하면 오해가 납니다. 아래 표는 최근
            7일 GA4 원본과 VM Cloud cohort 화면의 차이를 사람이 이해할 수 있게 나눈
            점검표입니다. 핵심은 “고객이 갑자기 덜 읽었다”가 아니라 “예전 숫자와 지금
            숫자의 분모와 측정 기준이 다르다”입니다.
          </p>
          <div className={styles.denominatorGrid}>
            {SCROLL_DENOMINATOR_AUDIT.map((row) => (
              <article key={row.site} className={styles.denominatorCard}>
                <h3>{row.site}</h3>
                <div className={styles.scrollChangeBox}>
                  <span>얼마에서 얼마로 바뀌었나</span>
                  <strong>
                    과거 결제자/비결제자 {fmtPct(row.oldBuyerRatePct)} /{" "}
                    {fmtPct(row.oldNonBuyerRatePct)} → 최신 원본{" "}
                    {fmtPct(row.rawScroll90RatePct)}
                  </strong>
                  <p>{row.changeSummary}</p>
                </div>
                <dl>
                  <dt>GA4 세션</dt>
                  <dd>{row.ga4Sessions.toLocaleString("ko-KR")}</dd>
                  <dt>GA4 원본 90% 스크롤</dt>
                  <dd>{fmtPct(row.rawScroll90RatePct)}</dd>
                  <dt>scroll 이벤트를 90으로 간주할 때</dt>
                  <dd>{fmtPct(row.assumedScrollRatePct)}</dd>
                  <dt>현재 Meta 결제자 / 비결제자</dt>
                  <dd>
                    {row.currentMetaBuyerRatePct === null
                      ? "측정 보강 필요"
                      : `${fmtPct(row.currentMetaBuyerRatePct)} / ${fmtPct(
                          row.currentMetaNonBuyerRatePct
                        )}`}
                  </dd>
                  <dt>긴 조회 이벤트(page_view_long)</dt>
                  <dd>{fmtPct(row.pageViewLongRatePct)}</dd>
                  <dt>리뷰 URL/이벤트 도달</dt>
                  <dd>{fmtPct(row.reviewReachRatePct)}</dd>
                </dl>
                <p>{row.currentReading}</p>
                <p>
                  <strong>다음 보강:</strong> {row.nextAction}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 채널별 비교 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>채널별 비교 · 더클린커피 최근 7일</h2>
          <p className={styles.sectionDesc}>
            같은 매출도 채널마다 결제 전 행동이 다릅니다. 결제율이 낮아도 결제한 사람이
            페이지에 오래 머무른 채널은 랜딩/결제 흐름 개선 후보입니다.
          </p>
          <CoffeeChannelTable rows={COFFEE_CHANNEL_TRUTH} />
        </section>

        {/* 더클린커피 Meta 분석 예시 카드 (항상 노출) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            더클린커피 Meta 분석 예시 <span className={styles.sampleBadge}>항상 노출</span>
          </h2>
          <p className={styles.sectionDesc}>
            바이오컴을 보고 있어도 이 카드는 P0 에서 항상 띄웁니다. 더클린커피 Meta 결과는
            현재 가장 신뢰도가 높은 행동 비교라서, 의사결정 기준점으로 같이 봅니다.
          </p>
          <div className={styles.compareCard}>
            <p className={styles.compareSummary}>
              Meta 유입 safe session <strong>{coffeeMetaRow.vmSafeSessions}</strong> /{" "}
              GA4 연결 <strong>{coffeeMetaRow.ga4JoinedSessions}</strong> ({fmtPct(coffeeMetaRow.joinRatePct)}).{" "}
              결제 세션 <strong>{coffeeMetaRow.confirmedPurchaseSessions}</strong>,{" "}
              비결제 세션 <strong>{coffeeMetaRow.droppedCheckoutSessions}</strong>,{" "}
              결제금액 <strong>{fmtKRW(coffeeMetaRow.confirmedAmountKrw)}</strong>. 결제자가
              비결제자보다 중앙 체류시간이{" "}
              <strong>+{dwellDeltaSeconds(coffeeMetaRow)?.toFixed(1)}초</strong> 깁니다.
            </p>
            <CoffeeChannelCompare row={coffeeMetaRow} />
          </div>
        </section>

        {/* 데이터 신뢰도 패널 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>데이터 신뢰도</h2>
          <p className={styles.sectionDesc}>
            이 화면 숫자를 예산 판단에 써도 되는지 사이트별로 구분합니다. join rate 가 낮은
            site/channel 은 결제율로 단정하지 않습니다.
          </p>
          <div className={styles.trustGrid}>
            <TrustCard
              name={coffeeReadiness.displayName}
              level="high"
              source={DRY_RUN_META.primary}
              crossCheck={DRY_RUN_META.crossCheck}
              window={DRY_RUN_META.window}
              freshness={DRY_RUN_META.checkedAtKst}
              joinRatePct={coffeeMetaRow.joinRatePct}
              confidence={DRY_RUN_META.confidenceCoffee}
              note={coffeeReadiness.interpretationKo}
            />
            <TrustCard
              name={biocomReadiness.displayName}
              level="mid"
              source={DRY_RUN_META.primary}
              crossCheck={DRY_RUN_META.crossCheck}
              window={DRY_RUN_META.window}
              freshness={DRY_RUN_META.checkedAtKst}
              joinRatePct={biocomConfirmed.joinRatePct}
              confidence={DRY_RUN_META.confidenceBiocom}
              note={biocomReadiness.interpretationKo}
            />
          </div>
          <ul className={styles.caveatList}>
            {DRY_RUN_META.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        {/* 액션 큐 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>액션 큐</h2>
          <p className={styles.sectionDesc}>
            분석에서 멈추지 않고, 누가 무엇을 다음에 할지로 바로 이어집니다.
          </p>
          <div className={styles.queueGrid}>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex 데이터 / Claude Code 화면</span>
              <h3 className={styles.queueTitle}>
                더클린커피 Meta: 3분 이상 체류 비율을 캠페인/랜딩별로 비교
              </h3>
              <p className={styles.queueDetail}>
                현재 화면은 채널 단위까지만 본다. P2 에서 캠페인/랜딩별 체류시간 분포를 분해해
                어느 광고와 랜딩을 키울지 결정한다.
              </p>
              <span className={styles.queueMeta}>승인: 없음</span>
            </div>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex read-only 재조회</span>
              <h3 className={styles.queueTitle}>
                더클린커피: AGENTSOS begin_checkout export 반영 후 재분석
              </h3>
              <p className={styles.queueDetail}>
                현재 더클린커피 GA4 begin_checkout/add_payment_info 가 0% 로 잡혀 있다.
                GTM Preview 검증 후 BigQuery export 가 들어오면 결제 페이지 도달도 사람말
                숫자로 채울 수 있다.
              </p>
              <span className={styles.queueMeta}>의존성: GA4 BigQuery daily export 적재</span>
            </div>
            <div className={styles.queueCard}>
              <span className={styles.queueOwner}>Codex 설계 + TJ 승인</span>
              <h3 className={styles.queueTitle}>
                바이오컴: GA4 purchase 충돌 cohort 를 순수 비결제자에서 제외
              </h3>
              <p className={styles.queueDetail}>
                Meta-only 세션 중 GA4 purchase 가 보이지만 VM confirmed purchase 로 닫히지 않은
                row 는 이탈자가 아니다. 최근 3일 재조회로 이 보류 bucket 이 줄었는지 확인한 뒤
                key capture 보강 범위를 결정한다.
              </p>
              <span className={styles.queueMeta}>
                승인: read-only 재조회는 없음 · key capture 변경 시 필요
              </span>
            </div>
          </div>
        </section>

        {/* 금지선 footer */}
        <div className={styles.footerBar}>
          <strong>금지선</strong> · 이 화면의 수치는 read-only 분석 전용입니다. 다음 동작은
          별도 승인 전 절대 실행하지 않습니다.
          <ul>
            <li>Meta CAPI 전송 / GA4 Measurement Protocol 전송 / Google Ads upload</li>
            <li>TikTok·Naver 전송 또는 upload / GTM Production publish / VM Cloud deploy·restart</li>
            <li>운영 DB write / raw order·payment·member·click id 화면 노출</li>
            <li>join rate 가 낮은 site/channel 을 예산 판단용 전환율로 표시</li>
          </ul>
        </div>
      </main>
    </>
  );
}

function PageLongThresholdPanel({
  rows,
  site,
  channel,
}: {
  rows: PageLongThresholdRow[];
  site: SiteKey;
  channel: ChannelKey;
}) {
  if (rows.length === 0) {
    return (
      <div className={styles.pageLongEmpty}>
        <strong>
          {siteLabelKo(site)} · {channel === "all" ? "전체" : channelLabelKo(channel)} 기준은
          아직 page long view 비교표가 없습니다.
        </strong>
        <p>
          현재 dry-run은 Meta, Google 유료, YouTube만 우선 비교했습니다. 네이버/직접/기타는
          P1 live endpoint가 붙으면 같은 방식으로 채울 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pageLongGrid}>
      {rows.map((row) => (
        <article key={`${row.site}-${row.sourceGroup}`} className={styles.pageLongCard}>
          <div className={styles.pageLongHeader}>
            <div>
              <span className={styles.headlineKicker}>
                {row.siteLabel} · {row.sourceLabel}
              </span>
              <h3>{pageLongStatusLabel(row)}</h3>
            </div>
            <span
              className={`${styles.trustBadge} ${
                row.confirmedGa4JoinedSessions < 20 || row.vmSafeSessions === 0
                  ? styles.low
                  : styles.mid
              }`}
            >
              {row.vmSafeSessions === 0 ? "미매핑 점검" : `GA4 연결 ${fmtPct(row.joinRatePct)}`}
            </span>
          </div>

          <p className={styles.pageLongReading}>{pageLongInterpretation(row)}</p>

          <div className={styles.pageLongMetricGrid}>
            <div>
              <span>전체 후보 세션</span>
              <strong>{fmtCount(row.vmSafeSessions)}</strong>
            </div>
            <div>
              <span>구매자 표본</span>
              <strong>{fmtCount(row.confirmedGa4JoinedSessions)}</strong>
            </div>
            <div>
              <span>비결제자 표본</span>
              <strong>{fmtCount(row.droppedGa4JoinedSessions)}</strong>
            </div>
            <div>
              <span>추천 기준</span>
              <strong>{row.recommendedThresholdLabel ?? "보류"}</strong>
            </div>
          </div>

          <div className={styles.pageLongSevenMinute}>
            <span>현재 7분 기준</span>
            <strong>
              구매자{" "}
              {fmtRateFraction(
                row.current7Min.confirmedAboveSessions,
                row.confirmedGa4JoinedSessions,
                row.current7Min.confirmedRatePct
              )}{" "}
              / 비결제자{" "}
              {fmtRateFraction(
                row.current7Min.droppedAboveSessions,
                row.droppedGa4JoinedSessions,
                row.current7Min.droppedRatePct
              )}
            </strong>
            <p>
              차이 {fmtPct(row.current7Min.liftPct)}. 이 차이가 작거나 표본이 작으면 7분은
              기본 KPI가 아니라 보조 신호로만 봅니다.
            </p>
          </div>

          <table className={styles.pageLongTable}>
            <thead>
              <tr>
                <th>기준</th>
                <th>구매자</th>
                <th>비결제자</th>
                <th>차이</th>
              </tr>
            </thead>
            <tbody>
              {row.thresholdRows.map((threshold) => (
                <tr key={threshold.label}>
                  <td>{threshold.label} 이상</td>
                  <td>
                    {fmtRateFraction(
                      threshold.confirmedAboveSessions,
                      row.confirmedGa4JoinedSessions,
                      threshold.confirmedRatePct
                    )}
                  </td>
                  <td>
                    {fmtRateFraction(
                      threshold.droppedAboveSessions,
                      row.droppedGa4JoinedSessions,
                      threshold.droppedRatePct
                    )}
                  </td>
                  <td>{fmtPct(threshold.liftPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </div>
  );
}

function googleAdsReadinessLabel(readiness: GoogleAdsAuditReadiness): string {
  if (readiness === "ok") return "UTM 있음";
  if (readiness === "verify_click_id_capture") return "클릭 ID 확인 필요";
  if (readiness === "gap") return "추적 단서 부족";
  return "광고 URL 없음";
}

function googleAdsReadinessClass(readiness: GoogleAdsAuditReadiness): string {
  if (readiness === "ok") return styles.high;
  if (readiness === "verify_click_id_capture") return styles.mid;
  return styles.low;
}

function landingCaptureLabel(status: LandingClickIdAudit["captureStatus"]): string {
  if (status === "google_click_id_present") return "클릭 ID 보존";
  if (status === "google_channel_without_click_id") return "Google 단서만 있음";
  if (status === "not_google_paid_search") return "Google 아님";
  if (status === "landing_rows_present_no_google_evidence") return "Google 단서 없음";
  if (status === "no_landing_rows") return "랜딩 row 없음";
  return "원장 확인 불가";
}

function landingCaptureClass(status: LandingClickIdAudit["captureStatus"]): string {
  if (status === "google_click_id_present") return styles.high;
  if (status === "google_channel_without_click_id") return styles.mid;
  if (status === "not_google_paid_search") return styles.mid;
  return styles.low;
}

function trafficRouteDecisionLabel(decision: GoogleAdsTrafficRouteAudit["decision"]): string {
  if (decision === "actual_google_paid_click_confirmed") return "실제 Google 유입 확인";
  if (decision === "ads_config_present_but_no_landing_evidence") return "설정 있음 · 실제 유입 증거 없음";
  if (decision === "paused_or_legacy_config_only") return "일시중지/과거 설정만 있음";
  if (decision === "landing_table_unavailable") return "랜딩 원장 확인 실패";
  return "Google 유입 증거 없음";
}

function trafficRouteDecisionClass(decision: GoogleAdsTrafficRouteAudit["decision"]): string {
  if (decision === "actual_google_paid_click_confirmed") return styles.high;
  if (decision === "ads_config_present_but_no_landing_evidence") return styles.mid;
  if (decision === "paused_or_legacy_config_only") return styles.mid;
  return styles.low;
}

function routeStepClass(status: GoogleAdsTrafficRouteAudit["routeSteps"][number]["status"]): string {
  if (status === "pass") return styles.high;
  if (status === "warn") return styles.mid;
  return styles.low;
}

function GooglePaidFinalUrlAuditPanel({
  audit,
  error,
}: {
  audit: GoogleAdsFinalUrlAuditResponse | null;
  error: string | null;
}) {
  const siteSummary = audit?.summary?.siteSummary ?? [];
  const landingAudit = audit?.summary?.landingClickIdAudit ?? [];
  const otherUrlSummary = audit?.summary?.otherUrlSummary ?? null;
  const biocom = siteSummary.find((row) => row.site === "biocom");
  const coffee = siteSummary.find((row) => row.site === "thecleancoffee");
  const biocomLanding = landingAudit.find((row) => row.site === "biocom");
  const coffeeLanding = landingAudit.find((row) => row.site === "thecleancoffee");
  const coffeeTrafficRoute = audit?.summary?.actualTrafficRouteAudit?.find(
    (row) => row.site === "thecleancoffee",
  );
  const rows = [
    {
      site: "바이오컴",
      googleAds: biocom,
      landing: biocomLanding,
    },
    {
      site: "더클린커피",
      googleAds: coffee,
      landing: coffeeLanding,
    },
  ];

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Google 유료 유입 미매핑 점검</h2>
      <p className={styles.sectionDesc}>
        Google Ads 최종 URL은 “광고를 누르면 사용자를 어디로 보내는지”입니다. 여기에
        UTM(광고 출처 이름표)이나 gclid/gbraid/wbraid(구글 클릭 식별자)가 살아 있어야
        VM Cloud가 Google 유료 유입으로 분류할 수 있습니다.
      </p>
      <div className={styles.compareCard}>
        <div className={styles.compareHeader}>
          <p className={styles.compareSummary}>
            <strong>Google Ads API read-only audit</strong> · 계정{" "}
            {audit?.customer?.descriptiveName ?? "조회 중"} · 자동 태깅{" "}
            {audit?.autoTaggingEnabled === true
              ? "ON"
              : audit?.autoTaggingEnabled === false
                ? "OFF"
                : "확인 중"}
          </p>
          <span className={`${styles.trustBadge} ${error ? styles.low : audit ? styles.high : styles.mid}`}>
            {error ? "조회 실패" : audit ? "읽기 전용 확인" : "조회 중"}
          </span>
        </div>
        {error && (
          <p className={styles.compareSummary}>
            Google Ads 최종 URL audit API 응답을 받지 못했습니다: {error}. 아래 VM Cloud
            진단값은 마지막 read-only audit 결과를 기준으로 표시합니다.
          </p>
        )}
        <table className={styles.channelTable}>
	          <thead>
	            <tr>
	              <th>사이트</th>
	              <th>Google Ads 최종 URL row</th>
	              <th>UTM row</th>
	              <th>템플릿/URL suffix</th>
	              <th>VM Cloud landing row</th>
	              <th>판정</th>
	            </tr>
	          </thead>
          <tbody>
            {rows.map((row) => {
              const googleAds = row.googleAds;
              const readiness = googleAds?.readiness ?? "not_found";
              return (
	                <tr key={row.site}>
	                  <td className={styles.metricLabel}>
	                    {row.site}
	                    <span className={styles.metricHint}>
	                      {row.landing?.interpretation ??
	                        "VM Cloud landing 원장 응답을 기다리는 중입니다."}
	                    </span>
	                  </td>
	                  <td>{googleAds ? `${googleAds.rows}개 · URL ${googleAds.finalUrls}개` : "조회 중"}</td>
	                  <td>{googleAds ? `${googleAds.manualUtmRows}개` : "—"}</td>
                  <td>
                    {googleAds
                      ? `template ${googleAds.trackingTemplateRows} · suffix ${googleAds.finalUrlSuffixRows}`
	                      : "—"}
		                  </td>
		                  <td>
		                    {row.landing
		                      ? `전체 ${fmtCount(row.landing.totalLandingRows)} · 클릭ID ${fmtCount(row.landing.googleClickIdRows)} · 진짜 Google 단서 ${fmtCount(row.landing.googleEvidenceRows ?? 0)}`
		                      : "조회 중"}
		                    {row.landing && (
		                      <span className={styles.metricHint}>
		                        gclid {fmtCount(row.landing.googleClickIdRowsByType.gclid)} · gbraid{" "}
		                        {fmtCount(row.landing.googleClickIdRowsByType.gbraid)} · wbraid{" "}
		                        {fmtCount(row.landing.googleClickIdRowsByType.wbraid)} · Google 아님 paid_search{" "}
		                        {fmtCount(row.landing.nonGooglePaidSearchRows ?? 0)} · 최신{" "}
		                        {row.landing.latestLandingAt ?? "없음"}
		                      </span>
		                    )}
	                  </td>
	                  <td>
	                    <span className={`${styles.trustBadge} ${googleAdsReadinessClass(readiness)}`}>
	                      {googleAdsReadinessLabel(readiness)}
	                    </span>
	                    {row.landing && (
	                      <span className={`${styles.trustBadge} ${landingCaptureClass(row.landing.captureStatus)}`}>
	                        {landingCaptureLabel(row.landing.captureStatus)}
	                      </span>
	                    )}
	                    <span className={styles.metricHint}>
	                      {googleAds?.interpretation ??
	                        "Google Ads API 응답을 기다리는 중입니다. 응답 전까지는 VM Cloud capture gap 기준으로 봅니다."}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
	      </table>
	        {coffeeLanding && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>더클린커피 실제 Google Ads 클릭 ID 보존 여부</strong> · 최근{" "}
	                {coffeeLanding.windowDays}일 VM Cloud landing row {fmtCount(coffeeLanding.totalLandingRows)}건
	              </p>
	              <span className={`${styles.trustBadge} ${landingCaptureClass(coffeeLanding.captureStatus)}`}>
	                {landingCaptureLabel(coffeeLanding.captureStatus)}
	              </span>
	            </div>
		            <p className={styles.compareSummary}>
		              결론: 더클린커피는 landing row는 있지만 gclid/gbraid/wbraid가{" "}
		              <strong>{fmtCount(coffeeLanding.googleClickIdRows)}건</strong>입니다. 예전에는 paid_search
		              row를 Google 단서로 보았지만, 실제로는 Google-specific 값이{" "}
		              <strong>{fmtCount(coffeeLanding.googleEvidenceRows ?? 0)}건</strong>이고 Google이 아닌
		              다른 매체 paid_search가 {fmtCount(coffeeLanding.nonGooglePaidSearchRows ?? 0)}건입니다.
		              현재 판정은 “Google 유료 클릭 식별자가 VM Cloud에 잡히지 않는다”입니다.
		            </p>
		            <table className={styles.channelTable}>
		              <thead>
		                <tr>
		                  <th>분류</th>
		                  <th>row</th>
		                  <th>해석</th>
		                </tr>
		              </thead>
		              <tbody>
		                {(coffeeLanding.googleEvidenceBreakdown ?? []).map((bucket) => (
		                  <tr key={bucket.segment}>
		                    <td className={styles.metricLabel}>
		                      {bucket.label}
		                      <span className={styles.metricHint}>신뢰도 {bucket.confidence}</span>
		                    </td>
		                    <td>{fmtCount(bucket.rows)}</td>
		                    <td>{bucket.interpretation}</td>
		                  </tr>
		                ))}
		              </tbody>
		            </table>
		            <table className={styles.channelTable}>
		              <thead>
		                <tr>
		                  <th>랜딩 경로</th>
		                  <th>전체 row</th>
		                  <th>진짜 Google 단서 row</th>
		                </tr>
	              </thead>
	              <tbody>
	                {coffeeLanding.topLandingPaths.slice(0, 5).map((path) => (
	                  <tr key={path.path}>
	                    <td>{path.path || "/"}</td>
	                    <td>{fmtCount(path.rows)}</td>
	                    <td>{fmtCount(path.googleEvidenceRows)}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        {coffeeTrafficRoute && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>더클린커피 Google Ads 실제 유입 재확인 루트</strong> · 최근{" "}
	                {coffeeTrafficRoute.windowDays}일 · 신뢰도 {coffeeTrafficRoute.confidence}
	              </p>
	              <span
	                className={`${styles.trustBadge} ${trafficRouteDecisionClass(coffeeTrafficRoute.decision)}`}
	              >
	                {trafficRouteDecisionLabel(coffeeTrafficRoute.decision)}
	              </span>
	            </div>
	            <p className={styles.compareSummary}>
	              {coffeeTrafficRoute.interpretation} 광고 계정 설정값만 보고 Google 유입이라고
	              세지 않고, 실제 방문 원장에 Google 클릭 이름표가 남았는지까지 확인한 판정입니다.
	            </p>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>확인 단계</th>
	                  <th>증거</th>
	                  <th>해석</th>
	                </tr>
	              </thead>
	              <tbody>
	                {coffeeTrafficRoute.routeSteps.map((step) => (
	                  <tr key={step.step}>
	                    <td className={styles.metricLabel}>
	                      {step.label}
	                      <span className={`${styles.trustBadge} ${routeStepClass(step.status)}`}>
	                        {step.status === "pass" ? "확인" : step.status === "warn" ? "주의" : "미확인"}
	                      </span>
	                    </td>
	                    <td>{step.evidence}</td>
	                    <td>{step.interpretation}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>바로 다음 확인</th>
	                  <th>왜 필요한가</th>
	                  <th>성공 기준</th>
	                </tr>
	              </thead>
	              <tbody>
	                {coffeeTrafficRoute.nextActions.map((action, index) => (
	                  <tr key={`${action.owner}-${index}`}>
	                    <td className={styles.metricLabel}>
	                      {action.owner === "TJ" ? "TJ님" : "Codex"} · {action.action}
	                    </td>
	                    <td>{action.why}</td>
	                    <td>{action.successCriteria}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        {otherUrlSummary && (
	          <div className={styles.auditSubsection}>
	            <div className={styles.compareHeader}>
	              <p className={styles.compareSummary}>
	                <strong>Google Ads 최종 URL 기타 도메인 분류</strong> · other row{" "}
	                {fmtCount(otherUrlSummary.totalRows)}건 · URL {fmtCount(otherUrlSummary.finalUrls)}개
	              </p>
	              <span className={`${styles.trustBadge} ${styles.mid}`}>운영 검토용</span>
	            </div>
	            <p className={styles.compareSummary}>{otherUrlSummary.interpretation}</p>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>분류</th>
	                  <th>row</th>
	                  <th>의미</th>
	                </tr>
	              </thead>
	              <tbody>
	                {otherUrlSummary.dispositionSummary.map((row) => (
	                  <tr key={row.disposition}>
	                    <td>{row.label}</td>
	                    <td>{fmtCount(row.rows)}</td>
	                    <td>{row.interpretation}</td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	            <table className={styles.channelTable}>
	              <thead>
	                <tr>
	                  <th>캠페인/광고그룹</th>
	                  <th>host</th>
	                  <th>분류 근거</th>
	                </tr>
	              </thead>
	              <tbody>
	                {otherUrlSummary.samples.slice(0, 8).map((sample, index) => (
	                  <tr key={`${sample.campaignName}-${sample.parentName}-${index}`}>
	                    <td className={styles.metricLabel}>
	                      {sample.campaignName}
	                      <span className={styles.metricHint}>
	                        {sample.parentName ?? "광고그룹 없음"} · campaign {sample.campaignStatus} · entity{" "}
	                        {sample.entityStatus}
	                      </span>
	                    </td>
	                    <td>{sample.hosts.join(", ") || "host 없음"}</td>
	                    <td>
	                      <span className={`${styles.trustBadge} ${
	                        sample.disposition === "ignore_external_or_legacy" ? styles.high : styles.mid
	                      }`}>
	                        {sample.dispositionLabel}
	                      </span>
	                      <span className={styles.metricHint}>{sample.reason}</span>
	                    </td>
	                  </tr>
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	        <ul className={styles.caveatList}>
	          <li>
	            더클린커피가 Google 유료 0세션으로 보이면 “주문이 없다”가 아니라, 현재 VM Cloud
	            원장에 gclid/gbraid/wbraid 같은 광고 클릭 식별자가 남지 않는다는 뜻입니다.
	          </li>
          <li>
            Google Ads 계정에 더클린커피 최종 URL row가 없으면, 이 계정에서 더클린커피
            Google 광고를 집행하지 않거나 다른 광고 계정에 있을 가능성이 큽니다.
          </li>
          <li>
            최종 URL row는 있는데 UTM이 없으면, 실제 클릭 URL에서 자동 태깅 값이 살아남는지
            1건의 클릭 landing row로 확인해야 합니다. 운영 설정 변경은 이 화면에서 하지 않습니다.
          </li>
        </ul>
      </div>
    </section>
  );
}

function MissingCoffeeChannelCompare({ channel }: { channel: ChannelKey }) {
  return (
    <div className={styles.pageLongEmpty}>
      <strong>더클린커피 · {channelLabelKo(channel)} 비교표는 아직 확정 cohort가 없습니다.</strong>
      <p>
        특히 Google 유료는 이번 dry-run에서 VM Cloud가 Google 유료 세션을 0건으로 잡았습니다.
        실제 유입이 없는지, gclid/utm 값이 다른 source bucket으로 들어갔는지 먼저 확인해야
        결제자/비결제자 비교를 만들 수 있습니다.
      </p>
    </div>
  );
}

// 더클린커피 채널 1개를 buyer vs leaver 비교표로
function CoffeeChannelCompare({ row }: { row: CohortRow }) {
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>{row.channelLabel}</strong> 유입 · safe session {row.vmSafeSessions} ·
          결제율 {fmtPct(row.buyerRatePct)} · 결제금액 {fmtKRW(row.confirmedAmountKrw)}
        </p>
        <span
          className={`${styles.trustBadge} ${
            row.confidence === "high" ? styles.high : row.confidence === "medium" ? styles.mid : styles.low
          }`}
        >
          신뢰도 {row.confidence === "high" ? "높음" : row.confidence === "medium" ? "중간" : "낮음"}
        </span>
      </div>
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th>지표</th>
            <th>결제자</th>
            <th>비결제자</th>
            <th>차이</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.metricLabel}>
              유입 세션 / 결제 세션
              <span className={styles.metricHint}>safe session 기준</span>
            </td>
            <td>{row.confirmedPurchaseSessions}</td>
            <td>{row.droppedCheckoutSessions}</td>
            <td className={styles.deltaNeutral}>
              {row.confirmedPurchaseSessions - row.droppedCheckoutSessions > 0
                ? `+${row.confirmedPurchaseSessions - row.droppedCheckoutSessions}`
                : row.confirmedPurchaseSessions - row.droppedCheckoutSessions}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              중앙 체류시간
              <span className={styles.metricHint}>페이지에 머문 시간의 중간값</span>
            </td>
            <td>{fmtSeconds(row.buyerP50DwellSeconds)}</td>
            <td>{fmtSeconds(row.leaverP50DwellSeconds)}</td>
            <td>
              {dwellDeltaSeconds(row) !== null && (
                <span
                  className={
                    (dwellDeltaSeconds(row) as number) >= 0
                      ? styles.deltaPos
                      : styles.deltaNeg
                  }
                >
                  {(dwellDeltaSeconds(row) as number) >= 0 ? "+" : ""}
                  {dwellDeltaSeconds(row)?.toFixed(1)}초
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              90% 스크롤 도달률
              <span className={styles.metricHint}>포화면 구분력 없음</span>
            </td>
            <td>{fmtPct(row.buyerScroll90RatePct)}</td>
            <td>{fmtPct(row.leaverScroll90RatePct)}</td>
            <td className={styles.deltaNeutral}>—</td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              장바구니/장바구니 페이지 신호
              <span className={styles.metricHint}>비결제자가 더 높으면 단독 KPI 금지</span>
            </td>
            <td>{fmtPct(row.buyerCartSignalPct)}</td>
            <td>{fmtPct(row.leaverCartSignalPct)}</td>
            <td>
              {row.buyerCartSignalPct !== null && row.leaverCartSignalPct !== null && (
                <span
                  className={
                    row.buyerCartSignalPct - row.leaverCartSignalPct >= 0
                      ? styles.deltaPos
                      : styles.deltaNeg
                  }
                >
                  {row.buyerCartSignalPct - row.leaverCartSignalPct >= 0 ? "+" : ""}
                  {(row.buyerCartSignalPct - row.leaverCartSignalPct).toFixed(1)}p
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              결제 시작 · 결제수단 선택
              <span className={styles.metricHint}>
                더클린커피 GA4 begin_checkout 은 현재 비어 있음
              </span>
            </td>
            <td colSpan={2}>현재 0% · AGENTSOS export 후 재분석 필요</td>
            <td className={styles.deltaNeutral}>—</td>
          </tr>
          <tr>
            <td className={styles.metricLabel}>
              비결제 cohort 안의 GA4 purchase event
              <span className={styles.metricHint}>session/window mismatch 또는 늦은 결제</span>
            </td>
            <td colSpan={3}>{fmtPct(row.droppedWithGa4PurchaseEventPct)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

// 더클린커피 전체 (채널 = all) - cohort_summary 사용
function CoffeeAllCompare({
  confirmed,
  dropped,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
}) {
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>더클린커피 전체 채널</strong> · safe session{" "}
          {confirmed.vmSafeSessions + dropped.vmSafeSessions} · 결제율{" "}
          {fmtPct(
            (confirmed.vmSafeSessions /
              (confirmed.vmSafeSessions + dropped.vmSafeSessions)) *
              100
          )}{" "}
          · 결제금액 {fmtKRW(confirmed.amountKrw)}
        </p>
        <span className={`${styles.trustBadge} ${styles.high}`}>신뢰도 높음</span>
      </div>
      <CohortMetricsTable confirmed={confirmed} dropped={dropped} />
    </>
  );
}

// 바이오컴 전체 또는 Meta-only (낮은 join rate 경고 포함)
function BiocomCompare({
  confirmed,
  dropped,
  channel,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
  channel: ChannelKey;
}) {
  const isMetaOnly = channel === "meta";
  if (channel !== "all" && !isMetaOnly) {
    return (
      <div className={styles.pageLongEmpty}>
        <strong>바이오컴 · {channelLabelKo(channel)} 전체 행동 비교표는 아직 보류입니다.</strong>
        <p>
          지금 화면의 바이오컴 구매자/비결제자 상세 비교는 전체 또는 Meta-only 기준만
          신뢰할 수 있습니다. Google 유료와 YouTube는 위 “페이지 롱 뷰 기준 시간” 섹션에서
          표본 수를 먼저 확인하고, P1 live endpoint에서 채널별 cohort가 닫히면 전체 행동표로
          확장합니다.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className={styles.compareHeader}>
        <p className={styles.compareSummary}>
          <strong>
            바이오컴 {channel === "all" ? "전체 채널" : channelLabelKo(channel)}
          </strong>{" "}
          · safe session {confirmed.vmSafeSessions + dropped.vmSafeSessions} · 결제율{" "}
          {fmtPct(
            (confirmed.vmSafeSessions /
              (confirmed.vmSafeSessions + dropped.vmSafeSessions)) *
              100
          )}{" "}
          · 결제금액 {fmtKRW(confirmed.amountKrw)}
        </p>
        <span className={`${styles.trustBadge} ${styles.mid}`}>
          신뢰도 보강 필요 (row-level join {fmtPct(confirmed.joinRatePct, 0)})
        </span>
      </div>
      {isMetaOnly && (
        <BiocomMetaThreeCohort />
      )}
      <CohortMetricsTable confirmed={confirmed} dropped={dropped} />
    </>
  );
}

function BiocomMetaThreeCohort() {
  const split = BIOCOM_META_COHORT_SPLIT;

  return (
    <div className={styles.cohortSplitBox}>
      <p className={styles.compareSummary}>
        <strong>바이오컴 Meta-only 3개 cohort</strong> · safe session{" "}
        {split.vmMetaSafeSessions} · GA4 연결 {split.ga4JoinedSessions} (
        {fmtPct(split.joinRatePct)}) · 기준 {split.checkedAtKst}
      </p>
      <div className={styles.cohortSplitGrid}>
        <div className={`${styles.cohortSplitCard} ${styles.greenSoft}`}>
          <span>확정 구매자</span>
          <strong>{split.confirmedBuyerSessions}</strong>
          <p>VM Cloud confirmed purchase 로 닫힌 세션입니다.</p>
        </div>
        <div className={`${styles.cohortSplitCard} ${styles.slateSoft}`}>
          <span>순수 비결제자</span>
          <strong>{split.checkoutNonBuyerSessions}</strong>
          <p>VM confirmed purchase 도 GA4 purchase 도 없는 비교 기준입니다.</p>
        </div>
        <div className={`${styles.cohortSplitCard} ${styles.yellowSoft}`}>
          <span>GA4 purchase 충돌</span>
          <strong>{split.ga4PurchaseConflictSessions}</strong>
          <p>순수 비결제자 평균에서 제외합니다 · {fmtPct(split.ga4PurchaseConflictRatePct)}.</p>
        </div>
      </div>
      <ul className={styles.reasonList}>
        {split.conflictReasonBuckets.map((reason) => (
          <li key={reason.bucket}>
            <strong>{reason.count}건</strong> · {reason.label}
          </li>
        ))}
      </ul>
      <p className={styles.compareSummary}>{split.interpretationKo}</p>
    </div>
  );
}

function CohortMetricsTable({
  confirmed,
  dropped,
}: {
  confirmed: (typeof COHORT_SUMMARY)[number];
  dropped: (typeof COHORT_SUMMARY)[number];
}) {
  const rows: Array<{
    label: string;
    hint?: string;
    buyer: string;
    leaver: string;
    delta?: string;
    deltaPos?: boolean;
  }> = [
    {
      label: "safe session 수",
      hint: "GA4·VM 같은 사람으로 연결된 세션만",
      buyer: String(confirmed.vmSafeSessions),
      leaver: String(dropped.vmSafeSessions),
    },
    {
      label: "GA4 연결률",
      hint: "행동 비교 신뢰도",
      buyer: fmtPct(confirmed.joinRatePct),
      leaver: fmtPct(dropped.joinRatePct),
    },
    {
      label: "중앙 체류시간",
      hint: "페이지에 머문 시간의 중간값",
      buyer: fmtSeconds(confirmed.p50EngagementSeconds),
      leaver: fmtSeconds(dropped.p50EngagementSeconds),
      delta: `${(confirmed.p50EngagementSeconds - dropped.p50EngagementSeconds).toFixed(1)}초`,
      deltaPos: confirmed.p50EngagementSeconds >= dropped.p50EngagementSeconds,
    },
    {
      label: "90% 스크롤 도달률",
      buyer: fmtPct(confirmed.scroll90RatePct),
      leaver: fmtPct(dropped.scroll90RatePct),
      delta: `${(confirmed.scroll90RatePct - dropped.scroll90RatePct).toFixed(1)}p`,
      deltaPos: confirmed.scroll90RatePct >= dropped.scroll90RatePct,
    },
    {
      label: "상품 상세 도달",
      buyer: fmtPct(confirmed.viewItemRatePct),
      leaver: fmtPct(dropped.viewItemRatePct),
      delta: `${(confirmed.viewItemRatePct - dropped.viewItemRatePct).toFixed(1)}p`,
      deltaPos: confirmed.viewItemRatePct >= dropped.viewItemRatePct,
    },
    {
      label: "장바구니 신호",
      hint: "단독 KPI 금지",
      buyer: fmtPct(confirmed.addToCartRatePct),
      leaver: fmtPct(dropped.addToCartRatePct),
      delta: `${(confirmed.addToCartRatePct - dropped.addToCartRatePct).toFixed(1)}p`,
      deltaPos: confirmed.addToCartRatePct >= dropped.addToCartRatePct,
    },
    {
      label: "결제 시작 (begin_checkout)",
      hint: "더클린커피는 GA4 export 적재 후 채워짐",
      buyer: fmtPct(confirmed.beginCheckoutRatePct),
      leaver: fmtPct(dropped.beginCheckoutRatePct),
      delta: `${(confirmed.beginCheckoutRatePct - dropped.beginCheckoutRatePct).toFixed(1)}p`,
      deltaPos: confirmed.beginCheckoutRatePct >= dropped.beginCheckoutRatePct,
    },
    {
      label: "결제수단 선택 (add_payment_info)",
      buyer: fmtPct(confirmed.addPaymentInfoRatePct),
      leaver: fmtPct(dropped.addPaymentInfoRatePct),
      delta: `${(confirmed.addPaymentInfoRatePct - dropped.addPaymentInfoRatePct).toFixed(1)}p`,
      deltaPos: confirmed.addPaymentInfoRatePct >= dropped.addPaymentInfoRatePct,
    },
  ];
  return (
    <table className={styles.compareTable}>
      <thead>
        <tr>
          <th>지표</th>
          <th>결제자</th>
          <th>비결제자</th>
          <th>차이</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className={styles.metricLabel}>
              {r.label}
              {r.hint && <span className={styles.metricHint}>{r.hint}</span>}
            </td>
            <td>{r.buyer}</td>
            <td>{r.leaver}</td>
            <td>
              {r.delta ? (
                <span className={r.deltaPos ? styles.deltaPos : styles.deltaNeg}>
                  {r.deltaPos && !r.delta.startsWith("-") ? "+" : ""}
                  {r.delta}
                </span>
              ) : (
                <span className={styles.deltaNeutral}>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndicatorRanking({ row }: { row: CohortRow }) {
  const cards: Array<{
    name: string;
    status: "candidate" | "caution" | "parked" | "shortage";
    statusLabel: string;
    why: string;
    number: string;
    action: string;
  }> = [
    {
      name: "체류시간 3분 이상",
      status: "candidate",
      statusLabel: "관리 후보",
      why:
        "Meta 결제자가 비결제자보다 중앙 체류시간이 깁니다. 광고/랜딩이 충분히 읽혔다는 신호입니다.",
      number: `결제자 ${fmtSeconds(row.buyerP50DwellSeconds)} · 비결제자 ${fmtSeconds(
        row.leaverP50DwellSeconds
      )} · 차이 +${dwellDeltaSeconds(row)?.toFixed(1)}초`,
      action:
        "3분 이상 머무는 Meta 유입을 늘리세요. 랜딩에서 리뷰/구매평 영역 진입을 더 빠르게 만들어 페이지에 머무는 시간을 늘립니다.",
    },
    {
      name: "결제 페이지 도달",
      status: "candidate",
      statusLabel: "관리 후보",
      why:
        "결제 페이지 도달은 구매 직전 행동입니다. 단, 결제완료와 절대 혼동하면 안 됩니다.",
      number:
        "현재 더클린커피 GA4 begin_checkout 0% · AGENTSOS export 적재 후 재분석",
      action:
        "결제 페이지 도달은 좋은 신호지만 구매완료는 아닙니다. 결제완료는 VM Cloud confirmed purchase 로만 봅니다.",
    },
    {
      name: "장바구니 신호",
      status: "caution",
      statusLabel: "주의",
      why:
        "더클린커피 Meta 에서는 비결제자의 장바구니 신호가 결제자보다 높게 잡힙니다. 단독으로 보면 오판할 수 있습니다.",
      number: `결제자 ${fmtPct(row.buyerCartSignalPct)} · 비결제자 ${fmtPct(
        row.leaverCartSignalPct
      )}`,
      action: "장바구니는 결제 페이지 도달 또는 체류시간과 같이 볼 때만 의미가 있습니다.",
    },
    {
      name: "90% 스크롤",
      status: "parked",
      statusLabel: "보류",
      why:
        "더클린커피 Meta 에서는 결제자와 비결제자가 모두 100% 라 구분력이 없습니다.",
      number: `결제자 ${fmtPct(row.buyerScroll90RatePct)} · 비결제자 ${fmtPct(
        row.leaverScroll90RatePct
      )}`,
      action:
        "90% 스크롤 대신 50% 스크롤, 긴 조회 이벤트(page_view_long), 특정 리뷰 영역 도달 같은 더 앞단 지표가 필요합니다.",
    },
  ];
  return (
    <div className={styles.indicatorGrid}>
      {cards.map((c) => (
        <div key={c.name} className={styles.indicatorCard}>
          <div className={styles.indicatorHeader}>
            <h3 className={styles.indicatorName}>{c.name}</h3>
            <span className={`${styles.statusBadge} ${styles[c.status]}`}>
              {c.statusLabel}
            </span>
          </div>
          <p className={styles.indicatorWhy}>
            <strong>왜:</strong> {c.why}
          </p>
          <div className={styles.indicatorNumber}>{c.number}</div>
          <p className={styles.indicatorAction}>
            <strong>액션:</strong> {c.action}
          </p>
        </div>
      ))}
    </div>
  );
}

function CoffeeChannelTable({ rows }: { rows: CohortRow[] }) {
  return (
    <table className={styles.channelTable}>
      <thead>
        <tr>
          <th>채널</th>
          <th>safe session</th>
          <th>결제율</th>
          <th>결제금액</th>
          <th>결제자 체류시간</th>
          <th>비결제자 체류시간</th>
          <th>차이</th>
          <th>장바구니 결제자/비결제자</th>
          <th>해석</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const delta = dwellDeltaSeconds(r);
          let read = "—";
          if (r.channel === "youtube") read = "체류시간 우위, 강한 후보";
          else if (r.channel === "meta") read = "체류시간 우위, 장바구니는 주의";
          else if (r.channel === "naver_paid_or_brand")
            read = "결제율 낮지만 체류시간 우위 — 랜딩/결제 개선 후보";
          else if (r.channel === "direct_or_unknown")
            read = "결제 수 큼, 유입 분류 attribution 보강 후보";
          else if (r.channel === "naver_other") read = "표본 작음, 방향성만";
          else if (r.channel === "other") read = "결제자 체류시간이 오히려 짧음, 보류";
          return (
            <tr key={r.channel}>
              <td className={styles.metricLabel}>{r.channelLabel}</td>
              <td>{r.vmSafeSessions}</td>
              <td>{fmtPct(r.buyerRatePct)}</td>
              <td>{fmtKRW(r.confirmedAmountKrw)}</td>
              <td>{fmtSeconds(r.buyerP50DwellSeconds)}</td>
              <td>{fmtSeconds(r.leaverP50DwellSeconds)}</td>
              <td>
                {delta !== null && (
                  <span className={delta >= 0 ? styles.deltaPos : styles.deltaNeg}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}초
                  </span>
                )}
              </td>
              <td>
                {fmtPct(r.buyerCartSignalPct)} / {fmtPct(r.leaverCartSignalPct)}
              </td>
              <td>{read}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TrustCard({
  name,
  level,
  source,
  crossCheck,
  window,
  freshness,
  joinRatePct,
  confidence,
  note,
}: {
  name: string;
  level: "high" | "mid" | "low";
  source: string;
  crossCheck: string;
  window: string;
  freshness: string;
  joinRatePct: number;
  confidence: string;
  note: string;
}) {
  const levelLabel = level === "high" ? "행동 비교 가능" : level === "mid" ? "보강 필요" : "사용 금지";
  return (
    <div className={styles.trustCard}>
      <div className={styles.trustHead}>
        <h3 className={styles.trustName}>{name}</h3>
        <span className={`${styles.trustBadge} ${styles[level]}`}>{levelLabel}</span>
      </div>
      <dl>
        <dt>source</dt>
        <dd>{source}</dd>
        <dt>cross-check</dt>
        <dd>{crossCheck}</dd>
        <dt>window</dt>
        <dd>{window}</dd>
        <dt>freshness</dt>
        <dd>{freshness}</dd>
        <dt>GA4 join rate</dt>
        <dd>{fmtPct(joinRatePct)}</dd>
        <dt>결제완료 기준</dt>
        <dd>VM Cloud confirmed purchase</dd>
        <dt>confidence</dt>
        <dd>{confidence}</dd>
      </dl>
      <p className={styles.trustNote}>{note}</p>
    </div>
  );
}
