"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CallpriceOverviewResponse,
  CallpriceSupplementPurchaseTimingResponse,
  CallpriceSupplementRepeatPatternResponse,
  CallpriceSubscriptionConsultComparisonResponse,
  CallpriceSubscriptionStatusResponse,
} from "../../types/callprice";
import styles from "./page.module.css";

const API_BASE = "http://localhost:7020";
const ADS_API_BASE = "https://att.ainativeos.net";
const START_DATE = "2025-04-01";
const END_DATE = "2026-03-27";
const MATURITY_DAYS = [30, 60, 90, 180, 365] as const;

const CAMPAIGN_SELECTION_ROWS = [
  {
    campaignId: "120242626179290396",
    campaignName: "공동구매 인플루언서 파트너 광고 모음_3",
    confirmedSignal: "13건 / ₩4,015,700",
    followupSignal: "상담·영양제 후속 조인 전",
    decision: "보류",
  },
  {
    campaignId: "120213362391690396",
    campaignName: "음식물 과민증 검사 전환캠페인",
    confirmedSignal: "4건 / ₩1,209,000",
    followupSignal: "검사 후 영양제 후속 가능성이 큰 상품군",
    decision: "우선 확인",
  },
  {
    campaignId: "120237452088280396",
    campaignName: "종합대사기능검사 전환캠페인",
    confirmedSignal: "2건 / ₩536,400",
    followupSignal: "상담·영양제 후속 조인 필요",
    decision: "확인 후 소액 테스트",
  },
  {
    campaignId: "120218496689750396",
    campaignName: "영양중금속검사 전환 캠페인",
    confirmedSignal: "1건 / ₩268,200",
    followupSignal: "표본 추가 필요",
    decision: "보류",
  },
  {
    campaignId: "120235591897270396",
    campaignName: "음식물 과민증 검사 어드밴티지+캠페인",
    confirmedSignal: "1건 / ₩245,000",
    followupSignal: "표본 추가 필요",
    decision: "보류",
  },
] as const;

type ProductFollowupItem = {
  statusGroup: string;
  productCategory: string;
  customerCount: number;
  orderCount: number;
  totalRevenue: number;
  avgOrderValue: number;
};

type ProductFollowupResponse = {
  ok: boolean;
  range: { startDate: string; endDate: string };
  items: ProductFollowupItem[];
};

type SiteSummarySite = {
  site: string;
  account_id: string;
  spend: number;
  purchases: number;
  purchase_value: number;
  revenue: number;
  roas: number | null;
  orders: number;
  confirmedRevenue: number;
  confirmedOrders: number;
  pendingRevenue: number;
  pendingOrders: number;
  potentialRevenue: number;
  potentialRoas: number | null;
  metaPurchaseValue: number;
  metaPurchaseRoas: number | null;
  siteConfirmedRevenue: number;
  siteConfirmedOrders: number;
  bestCaseCeilingRoas: number | null;
};

type SiteSummaryResponse = {
  ok?: boolean;
  date_preset?: string;
  start_date?: string;
  end_date?: string;
  total: {
    spend: number;
    confirmedRevenue: number;
    pendingRevenue: number;
    potentialRevenue: number;
    metaPurchaseValue: number;
    confirmedRoas: number | null;
    potentialRoas: number | null;
    metaPurchaseRoas: number | null;
    orders: number;
  };
  sites: SiteSummarySite[];
};

type CampaignRoasResponse = {
  ok: boolean;
  range: { startDate: string; endDate: string };
  campaigns: Array<{
    campaignId: string | null;
    campaignName: string;
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
  }>;
  summary: {
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
  };
};

type CampaignLtvRoasResponse = {
  ok: boolean;
  range: { startDate: string; endDate: string };
  ltv_window_days: number;
  rows: Array<{
    campaignId: string | null;
    campaignName: string;
    spend: number;
    attributedRevenue: number;
    roas: number | null;
    orders: number;
    ltvRevenue: number;
    repeatRevenue: number;
    supplementRevenue: number;
    ltvRoas: number | null;
    matchedCustomers: number;
    consultedCustomers: number;
    supplementCustomers: number;
    ltvStatus: "ready" | "low_sample" | "identity_missing" | "no_attribution" | "blocked";
    ltvBlocker: string | null;
  }>;
  summary: {
    attributedRevenue: number;
    ltvRevenue: number;
    repeatRevenue: number;
    supplementRevenue: number;
    ltvRoas: number | null;
    readyCampaigns: number;
    blockedCampaigns: number;
  };
};

type LoadedData = {
  overviews: Array<{ maturity: number; response: CallpriceOverviewResponse | null }>;
  timing: CallpriceSupplementPurchaseTimingResponse | null;
  repeat: CallpriceSupplementRepeatPatternResponse | null;
  subscription: CallpriceSubscriptionStatusResponse | null;
  subscriptionConsult: CallpriceSubscriptionConsultComparisonResponse | null;
  productFollowup: ProductFollowupResponse | null;
  siteSummary: SiteSummaryResponse | null;
  campaignRoas: CampaignRoasResponse | null;
  campaignLtvRoas: CampaignLtvRoasResponse | null;
};

const fmtNum = (value: number | null | undefined) =>
  value == null ? "-" : Math.round(value).toLocaleString("ko-KR");

const fmtDecimal = (value: number | null | undefined, digits = 2) =>
  value == null ? "-" : value.toFixed(digits);

const fmtKRW = (value: number | null | undefined) =>
  value == null ? "-" : `₩${Math.round(value).toLocaleString("ko-KR")}`;

const fmtPct = (value: number | null | undefined) =>
  value == null ? "-" : `${(value * 100).toFixed(1)}%`;

const fmtPctPoint = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(1)}%`;

const fmtRoas = (value: number | null | undefined) =>
  value == null ? "-" : `${value.toFixed(2)}x`;

const safeDiv = (numerator: number | null | undefined, denominator: number | null | undefined) => {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
};

const buildCallpriceQuery = (maturityDays?: number) => {
  const params = new URLSearchParams({
    start_date: START_DATE,
    end_date: END_DATE,
    baseline_scope: "global_non_consultation",
  });
  if (maturityDays) params.set("maturity_days", String(maturityDays));
  return params.toString();
};

const fetchJson = async <T,>(path: string, signal: AbortSignal, base = API_BASE): Promise<T | null> => {
  try {
    const response = await fetch(`${base}${path}`, { signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    return null;
  }
};

export default function BiocomLtvCacPage() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      const [
        overviews,
        timing,
        repeat,
        subscription,
        subscriptionConsult,
        productFollowup,
        siteSummary,
        campaignRoas,
        campaignLtvRoas,
      ] = await Promise.all([
        Promise.all(
          MATURITY_DAYS.map(async (maturity) => ({
            maturity,
            response: await fetchJson<CallpriceOverviewResponse>(
              `/api/callprice/overview?${buildCallpriceQuery(maturity)}`,
              abortController.signal,
            ),
          })),
        ),
        fetchJson<CallpriceSupplementPurchaseTimingResponse>(
          `/api/callprice/supplement-purchase-timing?${buildCallpriceQuery(90)}`,
          abortController.signal,
        ),
        fetchJson<CallpriceSupplementRepeatPatternResponse>(
          `/api/callprice/supplement-repeat-pattern?start_date=${START_DATE}&end_date=${END_DATE}`,
          abortController.signal,
        ),
        fetchJson<CallpriceSubscriptionStatusResponse>(
          "/api/callprice/subscription-status",
          abortController.signal,
        ),
        fetchJson<CallpriceSubscriptionConsultComparisonResponse>(
          "/api/callprice/subscription-consult-comparison",
          abortController.signal,
        ),
        fetchJson<ProductFollowupResponse>(
          `/api/consultation/product-followup?startDate=${START_DATE}&endDate=${END_DATE}`,
          abortController.signal,
        ),
        fetchJson<SiteSummaryResponse>(
          "/api/ads/site-summary?date_preset=last_7d",
          abortController.signal,
          ADS_API_BASE,
        ),
        fetchJson<CampaignRoasResponse>(
          "/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d",
          abortController.signal,
          API_BASE,
        ),
        fetchJson<CampaignLtvRoasResponse>(
          "/api/ads/campaign-ltv-roas?account_id=act_3138805896402376&date_preset=last_7d&ltv_window_days=180",
          abortController.signal,
          API_BASE,
        ),
      ]);

      if (!abortController.signal.aborted) {
        setData({
          overviews,
          timing,
          repeat,
          subscription,
          subscriptionConsult,
          productFollowup,
          siteSummary,
          campaignRoas,
          campaignLtvRoas,
        });
        setError(overviews.some((item) => item.response) ? null : "상담/코호트 API 응답을 불러오지 못했습니다.");
        setLoading(false);
      }
    };

    void load();

    return () => abortController.abort();
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;

    const overview90 = data.overviews.find((item) => item.maturity === 90)?.response?.data.summary ?? null;
    const overview180 = data.overviews.find((item) => item.maturity === 180)?.response?.data.summary ?? null;
    const biocomAd = data.siteSummary?.sites.find((site) => site.site === "biocom") ?? null;
    const timingCohort = data.timing?.data.cohort ?? null;
    const timingRows = data.timing?.data.buckets ?? [];
    const sameDay = timingRows.find((row) => row.bucket_key === "same_day");
    const within3Days = timingRows.find((row) => row.bucket_key === "within_3_days");
    const within3Share = (sameDay?.share_of_supplement_buyers ?? 0) + (within3Days?.share_of_supplement_buyers ?? 0);
    const repeatSummary = data.repeat?.data.summary ?? null;
    const repeatCohort = data.repeat?.data.cohort ?? null;
    const subscription6m = data.subscription?.data.conversion_periods.find((row) => row.period_label === "6개월") ?? null;
    const subscriptionRatio6m =
      data.subscription?.data.supplement_ratio_periods.find((row) => row.period_label === "6개월") ?? null;
    const subscriptionConsult6m =
      data.subscriptionConsult?.data.items.find((row) => row.period_label === "6개월") ?? null;
    const completedSupplement = data.productFollowup?.items.find(
      (row) => row.statusGroup === "completed" && row.productCategory === "supplement",
    ) ?? null;
    const confirmedOrderCac = safeDiv(biocomAd?.spend, biocomAd?.confirmedOrders);
    const metaPurchaseCac = safeDiv(biocomAd?.spend, biocomAd?.purchases);
    const supplementRevenuePerCustomer = safeDiv(completedSupplement?.totalRevenue, completedSupplement?.customerCount);
    const supplementOrdersPerCustomer = safeDiv(completedSupplement?.orderCount, completedSupplement?.customerCount);
    const metaVsAttributionGap = safeDiv(biocomAd?.metaPurchaseRoas, biocomAd?.roas);
    const unmappedCampaign = data.campaignRoas?.campaigns.find((campaign) => campaign.campaignName === "(unmapped)");
    const campaignLtvRows = (data.campaignLtvRoas?.rows ?? []).filter((row) => row.campaignId);
    const campaignMappingCoverage = safeDiv(data.campaignRoas?.summary.attributedRevenue, biocomAd?.confirmedRevenue);
    const adsRangeLabel = data.campaignRoas?.range
      ? `${data.campaignRoas.range.startDate} - ${data.campaignRoas.range.endDate}`
      : data.siteSummary?.start_date && data.siteSummary?.end_date
        ? `${data.siteSummary.start_date} - ${data.siteSummary.end_date}`
        : "last_7d";

    return {
      overview90,
      overview180,
      biocomAd,
      timingCohort,
      timingRows,
      within3Share,
      repeatSummary,
      repeatCohort,
      subscription6m,
      subscriptionRatio6m,
      subscriptionConsult6m,
      completedSupplement,
      confirmedOrderCac,
      metaPurchaseCac,
      supplementRevenuePerCustomer,
      supplementOrdersPerCustomer,
      metaVsAttributionGap,
      unmappedCampaign,
      campaignLtvRows,
      campaignMappingCoverage,
      adsRangeLabel,
    };
  }, [data]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backLink}>
            ← 대시보드로 돌아가기
          </Link>
          <h1 className={styles.title}>바이오컴 재구매율 및 LTV/CAC</h1>
          <p className={styles.subtitle}>
            상담 후 구매·영양제 전환·정기구독·최근 7일 ROAS를 한 화면에서 비교합니다.
          </p>
        </div>
      </header>

      <main className={styles.main}>
        {loading && <div className={styles.loading}>데이터를 불러오는 중입니다.</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && computed && (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <span className={styles.heroLabel}>Biocom growth control room</span>
                <h2 className={styles.heroTitle}>광고를 끌지 말고, 전체 증액도 아직 보류합니다.</h2>
                <p className={styles.heroText}>
                  90일 상담 코호트는 구매 전환과 영양제 후속 매출이 확인됩니다. 반면 최근 7일 광고는
                  Attribution confirmed 기준으로 거의 손익분기이고, Meta ROAS는 내부 원장보다 훨씬 높습니다.
                  지금은 전체 예산을 크게 늘리는 단계가 아니라, 식별자와 캠페인 매핑을 보강하면서 핵심 캠페인만
                  선별 유지·소폭 테스트하는 단계로 보는 것이 안전합니다.
                </p>
              </div>
              <div className={styles.heroPanel}>
                <span className={styles.heroLabel}>운영 판단</span>
                <span className={styles.heroPanelValue}>유지 / 선별 증액</span>
                <span className={styles.heroPanelNote}>
                  Meta {fmtRoas(computed.biocomAd?.metaPurchaseRoas)}만 보고 전체 증액하지 않습니다. Attribution{" "}
                  {fmtRoas(computed.biocomAd?.roas)}만 보고 전체 중단하지도 않습니다.
                </span>
              </div>
            </section>

            <section className={styles.metricsGrid}>
              <MetricCard
                label="최근 7일 Attribution ROAS"
                value={fmtRoas(computed.biocomAd?.roas)}
                sub={`${fmtKRW(computed.biocomAd?.confirmedRevenue)} confirmed / 광고비 ${fmtKRW(computed.biocomAd?.spend)}`}
              />
              <MetricCard
                label="최근 7일 Meta purchase ROAS"
                value={fmtRoas(computed.biocomAd?.metaPurchaseRoas)}
                sub={`Meta purchase value ${fmtKRW(computed.biocomAd?.metaPurchaseValue)} · gap ${fmtDecimal(computed.metaVsAttributionGap, 1)}x`}
              />
              <MetricCard
                label="90일 상담 후 구매 전환"
                value={fmtPct(computed.overview90?.conversion_rate)}
                sub={`${fmtNum(computed.overview90?.converted_customers)}명 구매 / ${fmtNum(computed.overview90?.matured_customers)}명 성숙 고객`}
              />
              <MetricCard
                label="90일 영양제 전환"
                value={fmtPct(computed.timingCohort?.supplement_conversion_rate)}
                sub={`${fmtNum(computed.timingCohort?.supplement_buyers)}명 영양제 구매 / ${fmtNum(computed.timingCohort?.matured_customers)}명`}
              />
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>LTV/CAC 빠른 판정</h2>
                  <p className={styles.sectionDesc}>
                    아래 CAC는 “진짜 신규 고객 CAC”가 아니라 최근 7일 광고비를 주문/구매 이벤트 수로 나눈 프록시입니다.
                    캠페인 매핑이 아직 풀리지 않았으므로 site-level 판단에만 씁니다.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.warningBadge}`}>campaign alias 검증 전</span>
              </div>

              <div className={styles.twoColumn}>
                <div className={styles.miniCards}>
                  <MiniCard
                    label="Attribution confirmed 주문당 광고비"
                    value={fmtKRW(computed.confirmedOrderCac)}
                    sub={`${fmtNum(computed.biocomAd?.confirmedOrders)}건 confirmed 기준`}
                  />
                  <MiniCard
                    label="Meta purchase 이벤트당 광고비"
                    value={fmtKRW(computed.metaPurchaseCac)}
                    sub={`${fmtNum(computed.biocomAd?.purchases)}건 Meta purchase 기준`}
                  />
                  <MiniCard
                    label="90일 상담 고객 평균 매출"
                    value={fmtKRW(computed.overview90?.avg_revenue_per_customer)}
                    sub={`미상담 비교군 ${fmtKRW(computed.overview90?.baseline_avg_revenue_per_customer)}`}
                  />
                </div>

                <div className={styles.decision}>
                  <strong>판정:</strong> Attribution 기준 주문당 광고비는 90일 상담 고객 평균 매출보다 높아, 1차 구매
                  매출만 보면 공격적 증액 근거가 부족합니다. 다만 상담 완료군 영양제 고객은 고객당{" "}
                  <strong>{fmtKRW(computed.supplementRevenuePerCustomer)}</strong>, 평균{" "}
                  <strong>{fmtDecimal(computed.supplementOrdersPerCustomer, 2)}회</strong> 주문이 확인되어 후속 LTV가
                  있습니다. 따라서 광고는 계속하되, Meta ROAS만 보고 전체 예산을 크게 늘리지 말고, 상담·영양제
                  전환이 확인되는 캠페인만 소액 증액 테스트하는 것이 맞습니다.
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>소액 증액 후보를 발라내는 방법</h2>
                  <p className={styles.sectionDesc}>
                    증액 후보는 Meta ROAS가 아니라 campaign id가 확인된 confirmed 주문과 상담·영양제 후속 전환이 함께
                    붙은 캠페인에서만 고릅니다.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.warningBadge}`}>+10-15% 제한 테스트</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>게이트</th>
                      <th>통과 기준</th>
                      <th>탈락 기준</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>캠페인 식별</td>
                      <td>`utm_id` campaign id 직접 일치 또는 `utm_term` adset id의 부모 campaign 확인</td>
                      <td>`fbclid` only, `meta_*` source only, 내부 배너·네이버·파트너 유입</td>
                    </tr>
                    <tr>
                      <td>결제 상태</td>
                      <td>Toss/Attribution `confirmed` 주문</td>
                      <td>가상계좌 pending, 테스트 이벤트, CAPI retry/duplicate 의심 이벤트</td>
                    </tr>
                    <tr>
                      <td>상담·영양제 후속</td>
                      <td>고객 식별자 기준 상담 완료 또는 90/180일 내 영양제 주문</td>
                      <td>1차 구매만 있고 상담·영양제 후속 연결이 없는 캠페인</td>
                    </tr>
                    <tr>
                      <td>테스트 규모</td>
                      <td>clean window confirmed 2건 이상 또는 ₩500,000 이상</td>
                      <td>표본 1건, 매핑 보류, 전체 ROAS만 좋은 캠페인</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>캠페인</th>
                      <th>confirmed 신호</th>
                      <th>상담·영양제 신호</th>
                      <th>현재 판단</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMPAIGN_SELECTION_ROWS.map((row) => (
                      <tr key={row.campaignId}>
                        <td>
                          <strong>{row.campaignName}</strong>
                          <br />
                          <span className={styles.metricSub}>{row.campaignId}</span>
                        </td>
                        <td>{row.confirmedSignal}</td>
                        <td>{row.followupSignal}</td>
                        <td>{row.decision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>캠페인</th>
                      <th>Att ROAS</th>
                      <th>LTV 기준 ROAS</th>
                      <th>후속 매출</th>
                      <th>상담/영양제 고객</th>
                      <th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.campaignLtvRows.map((row) => (
                      <tr key={row.campaignId ?? row.campaignName}>
                        <td>
                          <strong>{row.campaignName}</strong>
                          <br />
                          <span className={styles.metricSub}>{row.campaignId}</span>
                        </td>
                        <td className={styles.right}>{fmtRoas(row.roas)}</td>
                        <td className={styles.right}>{fmtRoas(row.ltvRoas)}</td>
                        <td className={styles.right}>
                          {fmtKRW(row.repeatRevenue)}
                          <br />
                          <span className={styles.metricSub}>영양제 {fmtKRW(row.supplementRevenue)}</span>
                        </td>
                        <td className={styles.right}>
                          {fmtNum(row.consultedCustomers)} / {fmtNum(row.supplementCustomers)}
                          <br />
                          <span className={styles.metricSub}>매칭 고객 {fmtNum(row.matchedCustomers)}</span>
                        </td>
                        <td>
                          {row.ltvStatus === "ready" ? "계산 가능" : row.ltvBlocker ?? row.ltvStatus}
                        </td>
                      </tr>
                    ))}
                    {computed.campaignLtvRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>캠페인별 LTV ROAS API 응답 대기 중</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.decision} style={{ marginTop: 18 }}>
                <strong>운영 원칙:</strong> 지금 표는 증액 승인 목록이 아니라 선별 순서입니다. 먼저 캠페인 매핑을 확정하고,
                그 주문 고객이 상담 완료 또는 영양제 후속 구매로 이어졌는지 조인합니다. 이 조인을 통과한 캠페인만
                전체 예산 안에서 +10-15% 소액 증액 테스트합니다. 캠페인별 LTV ROAS는 localhost alias/LTV 계산 기준이고,
                VM 최신 confirmed 매출 대비 매핑 커버리지는 {fmtPct(computed.campaignMappingCoverage)}라 아직 후보 선별용입니다.
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>상담 후 구매 전환과 고객당 매출</h2>
                  <p className={styles.sectionDesc}>
                    기준 기간 {START_DATE} - {END_DATE}. 성숙 기간별로 “구매할 시간이 충분히 지난 고객”만 봅니다.
                  </p>
                </div>
                <span className={styles.badge}>callprice / cohort 기반</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>성숙 기간</th>
                      <th className={styles.right}>성숙 고객</th>
                      <th className={styles.right}>구매 고객</th>
                      <th className={styles.right}>전환율</th>
                      <th className={styles.right}>상담 고객 평균 매출</th>
                      <th className={styles.right}>미상담 비교군</th>
                      <th className={styles.right}>고객당 상담 효과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.overviews.map((item) => {
                      const summary = item.response?.data.summary;
                      return (
                        <tr key={item.maturity}>
                          <td>{item.maturity}일</td>
                          <td className={styles.right}>{fmtNum(summary?.matured_customers)}</td>
                          <td className={styles.right}>{fmtNum(summary?.converted_customers)}</td>
                          <td className={styles.right}>{fmtPct(summary?.conversion_rate)}</td>
                          <td className={styles.right}>{fmtKRW(summary?.avg_revenue_per_customer)}</td>
                          <td className={styles.right}>{fmtKRW(summary?.baseline_avg_revenue_per_customer)}</td>
                          <td className={styles.right}>{fmtKRW(summary?.estimated_incremental_value_per_customer)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.note} style={{ marginTop: 16 }}>
                90일 기준 상담 고객은 평균 {fmtKRW(computed.overview90?.avg_revenue_per_customer)}를 만들고, 미상담
                비교군 대비 고객당 {fmtKRW(computed.overview90?.estimated_incremental_value_per_customer)} 높습니다.
                180일 기준으로는 고객당 평균 매출이 {fmtKRW(computed.overview180?.avg_revenue_per_customer)}까지
                올라갑니다. 다만 365일은 성숙 고객 표본이 112명이라 아직 headline으로 쓰기 어렵습니다.
              </div>
            </section>

            <section className={styles.twoColumn}>
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>검사 후 영양제 전환</h2>
                    <p className={styles.sectionDesc}>
                      90일 성숙 상담 고객 중 영양제 구매가 언제 발생했는지 봅니다.
                    </p>
                  </div>
                  <span className={styles.badge}>{fmtPct(computed.within3Share)}가 3일 내</span>
                </div>

                <div className={styles.barList}>
                  {computed.timingRows.map((row) => (
                    <div className={styles.barRow} key={row.bucket_key}>
                      <div className={styles.barMeta}>
                        <strong>{row.label}</strong>
                        <span>
                          {fmtNum(row.customer_count)}명 · 영양제 구매자 중 {fmtPct(row.share_of_supplement_buyers)}
                        </span>
                      </div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${Math.min(100, row.share_of_supplement_buyers * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>영양제 재구매와 정기구독</h2>
                    <p className={styles.sectionDesc}>
                      1년 재구매율은 표본이 작아 보조 지표로 보고, 상품 후속 매출과 정기 전환을 같이 봅니다.
                    </p>
                  </div>
                  <span className={`${styles.badge} ${styles.warningBadge}`}>
                    1년 재구매 표본 {fmtNum(computed.repeatCohort?.matured_supplement_starter_customers)}명
                  </span>
                </div>

                <div className={styles.miniCards}>
                  <MiniCard
                    label="1년 2회 이상 구매율"
                    value={fmtPct(computed.repeatSummary?.repeat_purchase_rate_2plus)}
                    sub={`성숙 영양제 시작 고객 ${fmtNum(computed.repeatCohort?.matured_supplement_starter_customers)}명 기준`}
                  />
                  <MiniCard
                    label="상담 완료군 영양제 고객당 매출"
                    value={fmtKRW(computed.supplementRevenuePerCustomer)}
                    sub={`${fmtNum(computed.completedSupplement?.customerCount)}명 · ${fmtNum(computed.completedSupplement?.orderCount)}건`}
                  />
                  <MiniCard
                    label="6개월 정기구독 전환"
                    value={fmtPctPoint(computed.subscription6m?.conversion_percentage)}
                    sub={`영양제 매출 중 정기 ${fmtPctPoint(computed.subscriptionRatio6m?.subscription_ratio_percentage)}`}
                  />
                </div>

                <div className={styles.note} style={{ marginTop: 16 }}>
                  상담군의 6개월 정기 전환은 {fmtPctPoint(computed.subscriptionConsult6m?.consulted_conversion_percentage)},
                  미상담군은 {fmtPctPoint(computed.subscriptionConsult6m?.non_consulted_conversion_percentage)}입니다.
                  상담군이 {fmtDecimal(computed.subscriptionConsult6m?.conversion_rate_multiple, 2)}x 높아, 광고 유입을
                  상담·영양제 후속관리까지 연결하면 1차 ROAS보다 긴 LTV를 기대할 수 있습니다.
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>최근 7일 ROAS와 광고비 운영 의견</h2>
                  <p className={styles.sectionDesc}>
                    기준 기간은 VM 광고 API `last_7d`, 현재 응답 기준 {computed.adsRangeLabel}입니다.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.dangerBadge}`}>Meta 단독 증액 금지</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <tbody>
                    <tr>
                      <th>광고비</th>
                      <td className={styles.right}>{fmtKRW(computed.biocomAd?.spend)}</td>
                      <th>Attribution confirmed ROAS</th>
                      <td className={styles.right}>{fmtRoas(computed.biocomAd?.roas)}</td>
                    </tr>
                    <tr>
                      <th>Attribution confirmed 매출</th>
                      <td className={styles.right}>{fmtKRW(computed.biocomAd?.confirmedRevenue)}</td>
                      <th>confirmed+pending ROAS</th>
                      <td className={styles.right}>{fmtRoas(computed.biocomAd?.potentialRoas)}</td>
                    </tr>
                    <tr>
                      <th>Meta purchase value</th>
                      <td className={styles.right}>{fmtKRW(computed.biocomAd?.metaPurchaseValue)}</td>
                      <th>Meta purchase ROAS</th>
                      <td className={styles.right}>{fmtRoas(computed.biocomAd?.metaPurchaseRoas)}</td>
                    </tr>
                    <tr>
                      <th>site-wide confirmed ceiling</th>
                      <td className={styles.right}>{fmtKRW(computed.biocomAd?.siteConfirmedRevenue)}</td>
                      <th>잠정 ceiling ROAS</th>
                      <td className={styles.right}>{fmtRoas(computed.biocomAd?.bestCaseCeilingRoas)}</td>
                    </tr>
                    <tr>
                      <th>캠페인 매핑 상태</th>
                      <td className={styles.right} colSpan={3}>
                        {computed.unmappedCampaign
                          ? `(unmapped) ${fmtKRW(computed.unmappedCampaign.attributedRevenue)} / ${fmtNum(computed.unmappedCampaign.orders)}건`
                          : `확정 alias 기준 매핑 커버리지 ${fmtPct(computed.campaignMappingCoverage)}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.decision} style={{ marginTop: 18 }}>
                <strong>결론:</strong> 광고는 계속 진행합니다. 다만 전체 예산의 공격적 증액은 보류합니다. 최근 7일
                Attribution confirmed ROAS가 {fmtRoas(computed.biocomAd?.roas)}라 1차 confirmed 매출 기준으로는
                거의 손익분기이고, 마진까지 감안하면 무리한 증액 근거가 약합니다. 반대로 Meta ROAS가{" "}
                {fmtRoas(computed.biocomAd?.metaPurchaseRoas)}이고 site-wide 잠정 ceiling이{" "}
                {fmtRoas(computed.biocomAd?.bestCaseCeilingRoas)}까지 보이며, 90일 상담 후 영양제 전환과 정기구독
                전환 여지가 확인되므로 전체 중단도 과합니다. 운영안은 <strong>현 예산 유지</strong>, 성과가 확인되는
                소재·랜딩·상담 연계 캠페인만 <strong>10-15% 이내 소폭 증액 테스트</strong>, Attribution/랜딩/상담
                후속 신호가 약한 캠페인은 <strong>감액 또는 유지 중단 후보</strong>로 두는 것입니다.
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricSub}>{sub}</span>
    </div>
  );
}

function MiniCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.miniCard}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricSub}>{sub}</span>
    </div>
  );
}
