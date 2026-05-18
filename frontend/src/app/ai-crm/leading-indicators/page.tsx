"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import GlobalNav from "@/components/common/GlobalNav";
import styles from "./page.module.css";
import {
  BIOCOM_META_COHORT_SPLIT,
  COFFEE_CHANNEL_TRUTH,
  COHORT_SUMMARY,
  CohortRow,
  DRY_RUN_META,
  READINESS,
  channelLabelKo,
} from "./dry-run";

type SiteKey = "biocom" | "thecleancoffee";
type WindowKey = "1d" | "7d" | "14d" | "30d";
type ChannelKey =
  | "meta"
  | "youtube"
  | "naver_paid_or_brand"
  | "direct_or_unknown"
  | "all";
type DimensionKey = "buyer_vs_leaver" | "channel";

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

  const coffeeMetaRow = useMemo(() => findCoffeeChannel("meta")!, []);
  const selectedCoffeeRow = useMemo(() => findCoffeeChannel(channel), [channel]);

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
          결제한 사람과 결제하지 않은 사람의 체류시간, 스크롤, 장바구니, 결제 시작 차이를
          비교합니다. 광고 플랫폼 주장값이 아니라 VM Cloud 와 GA4 를 맞춰 본 내부 행동
          분석입니다.
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

        {/* 채널별 비교 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>채널별 비교 · 더클린커피 최근 7일</h2>
          <p className={styles.sectionDesc}>
            같은 매출도 채널마다 결제 전 행동이 다릅니다. 결제율이 낮아도 결제자 체류시간이
            긴 채널은 랜딩/결제 흐름 개선 후보입니다.
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
                현재 화면은 채널 단위까지만 본다. P2 에서 캠페인/랜딩별 dwell 분포를 분해해
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
              <span className={styles.metricHint}>결제자가 더 길면 좋은 신호</span>
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
      label: "중앙 engagement 시간",
      hint: "결제자가 더 길면 좋은 신호",
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
        "3분 이상 머무는 Meta 유입을 늘리세요. 랜딩에서 리뷰/구매평 영역 진입을 더 빠르게 만들어 dwell 을 끌어올립니다.",
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
        "scroll90 대신 scroll50, page_view_long, 특정 리뷰 영역 도달 같은 더 앞단 지표가 필요합니다.",
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
          <th>결제자 dwell</th>
          <th>비결제자 dwell</th>
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
            read = "결제율 낮지만 dwell 우위 — 랜딩/결제 개선 후보";
          else if (r.channel === "direct_or_unknown")
            read = "결제 수 큼, 유입 분류 attribution 보강 후보";
          else if (r.channel === "naver_other") read = "표본 작음, 방향성만";
          else if (r.channel === "other") read = "결제자 dwell 가 오히려 짧음, 보류";
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
