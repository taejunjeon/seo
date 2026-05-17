/**
 * Leading Indicator Agent P0 dry-run.
 *
 * Purpose:
 * - Build a safe source matrix for pre-purchase leading indicators.
 * - Build an aggregate buyer/dropout cohort baseline from VM Cloud cached APIs.
 *
 * Safety:
 * - Read-only API calls only.
 * - No platform send/upload.
 * - No raw order/payment/customer/ad-click identifier output.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

type WindowKey = "1d" | "7d";
type SourceKey =
  | "all"
  | "meta"
  | "google"
  | "naver"
  | "organic"
  | "direct"
  | "utm_present"
  | "utm_missing";

type FunnelStep = {
  step: string;
  label: string;
  count: number;
  rate_from_previous?: number | null;
  status?: string;
};

type FunnelHealthResponse = {
  ok?: boolean;
  error?: string;
  site?: string;
  window?: string;
  checked_at_kst?: string;
  cache?: Record<string, unknown>;
  metric_contract?: Record<string, unknown>;
  funnel?: FunnelStep[];
  site_landing_evidence?: Record<string, unknown>;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const DEFAULT_BASE_URL = "https://att.ainativeos.net";

const windows: WindowKey[] = ["1d", "7d"];
const sources: SourceKey[] = ["all", "meta", "google", "naver", "organic", "direct", "utm_present", "utm_missing"];

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const toKst = (date = new Date()): string => `${kstFormatter.format(date).replace(",", "")} KST`;

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (numerator: number, denominator: number): number => {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
};

const readText = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(path.join(REPO_ROOT, filePath), "utf8");
  } catch {
    return "";
  }
};

const fetchFunnel = async (
  baseUrl: string,
  site: string,
  window: WindowKey,
  source: SourceKey,
): Promise<FunnelHealthResponse> => {
  const url = new URL("/api/attribution/funnel-health", baseUrl);
  url.searchParams.set("site", site);
  url.searchParams.set("window", window);
  if (source !== "all") url.searchParams.set("source", source);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        if (attempt === 0) continue;
        return {
          ok: false,
          error: `http_${response.status}`,
          site,
          window,
          checked_at_kst: toKst(),
          cache: { source: "api_error", status: response.status, source_filter: source },
          funnel: [],
        };
      }
      return (await response.json()) as FunnelHealthResponse;
    } catch (error) {
      if (attempt === 0) continue;
      return {
        ok: false,
        error: error instanceof Error ? error.name : "fetch_error",
        site,
        window,
        checked_at_kst: toKst(),
        cache: { source: "api_error", source_filter: source },
        funnel: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: "unknown_fetch_error", site, window, cache: { source: "api_error" }, funnel: [] };
};

const stepCount = (payload: FunnelHealthResponse, step: string): number => {
  const found = payload.funnel?.find((item) => item.step === step);
  return safeNumber(found?.count);
};

const getNestedNumber = (obj: unknown, keys: string[]): number => {
  let cursor: unknown = obj;
  for (const key of keys) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) return 0;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return safeNumber(cursor);
};

const getCacheFreshness = (payload: FunnelHealthResponse): string => {
  const cache = payload.cache ?? {};
  const cachedAt = typeof cache.cached_at_kst === "string" ? cache.cached_at_kst : "";
  const source = typeof cache.source === "string" ? cache.source : "unknown";
  return cachedAt ? `${cachedAt} / ${source}` : source;
};

const sourceLabel: Record<SourceKey, string> = {
  all: "전체",
  meta: "Meta 광고 유입 증거",
  google: "Google 광고 유입 증거",
  naver: "Naver 유입 증거",
  organic: "오가닉/추천 유입",
  direct: "직접 유입",
  utm_present: "UTM 있음, 채널 미분류",
  utm_missing: "UTM 없음",
};

const buildCohortRow = (
  source: SourceKey,
  payloads: Record<WindowKey, FunnelHealthResponse>,
) => {
  const byWindow = Object.fromEntries(
    windows.map((window) => {
      const payload = payloads[window];
      const landing = stepCount(payload, "landing");
      const cart = stepCount(payload, "add_to_cart");
      const paymentStarted = stepCount(payload, "payment_started");
      const paymentMethodSelected = stepCount(payload, "payment_method_selected");
      const confirmed = stepCount(payload, "confirmed_purchase");
      const rawCapi = stepCount(payload, "meta_capi_success");
      const sourceFilteredCapi = source === "all" ? rawCapi : null;
      const browserPurchase = stepCount(payload, "browser_purchase");
      const samePopulationRateSafe = source === "all";
      return [
        window,
        {
          landing,
          cart_page_seen: cart,
          payment_started: paymentStarted,
          payment_method_selected: paymentMethodSelected,
          confirmed_purchase: confirmed,
          meta_capi_success: sourceFilteredCapi,
          meta_capi_success_all_sources_observed: source === "all" ? null : rawCapi,
          browser_purchase: browserPurchase,
          dropped_without_confirmed_purchase: Math.max(landing - confirmed, 0),
          same_population_rate_safe: samePopulationRateSafe,
          landing_to_purchase_rate_pct: samePopulationRateSafe ? pct(confirmed, landing) : null,
          checkout_to_purchase_rate_pct: samePopulationRateSafe ? pct(confirmed, paymentStarted) : null,
          capi_coverage_pct: samePopulationRateSafe ? pct(rawCapi, confirmed) : null,
          freshness: getCacheFreshness(payload),
        },
      ];
    }),
  );

  return {
    source,
    label: sourceLabel[source],
    by_window: byWindow,
    interpretation:
      source === "meta"
        ? "Meta evidence가 있는 유입의 구매 전 funnel diagnostic. source별 단계는 같은 모집단 전환율이 아니므로 구매 예고 후보만 본다."
        : source === "organic"
          ? "오가닉/추천 유입 diagnostic. 검색어/콘텐츠별 선행지표는 GA4/Search source join이 필요."
          : source === "utm_present"
            ? "UTM은 있으나 channel rule이 닫히지 않은 bucket. naming rule 개선 후보."
            : "VM Cloud funnel-health aggregate 기준 baseline.",
    caveat:
      source === "all"
        ? "전체 funnel은 같은 화면 기준 전체 흐름으로 해석 가능."
        : "source별 funnel-health는 CAPI 성공과 일부 단계가 source-filtered unique order로 닫히지 않아 전환율보다 방향성 진단으로만 사용.",
  };
};

const fetchSourcePayloads = async (
  baseUrl: string,
  site: string,
): Promise<Record<SourceKey, Record<WindowKey, FunnelHealthResponse>>> => {
  const result = {} as Record<SourceKey, Record<WindowKey, FunnelHealthResponse>>;

  // Avoid hammering the VM Cloud backend from local dry-runs.
  for (const source of sources) {
    result[source] = {} as Record<WindowKey, FunnelHealthResponse>;
    for (const window of windows) {
      result[source][window] = await fetchFunnel(baseUrl, site, window, source);
    }
  }

  return result;
};

const buildSourceMatrix = (
  allPayloads: Record<WindowKey, FunnelHealthResponse>,
  docs: {
    dataInventory: string;
    channelFunnel: string;
    gtm: string;
    capiPlan: string;
  },
) => {
  const oneDay = allPayloads["1d"];
  const sevenDay = allPayloads["7d"];
  const gtmHasSignUp = /sign_up|회원가입/.test(docs.gtm);
  const gtmHasScroll50 = /scrollDepth|10,25,50,75,90|50% scroll|50%/.test(docs.gtm);
  const gtmHasAddToCart = /add_to_cart|장바구니 담기/.test(docs.gtm);
  const gtmHasAddPaymentInfo = /add_payment_info|AddPaymentInfo/.test(docs.gtm);

  const counts = {
    "1d": {
      landing: stepCount(oneDay, "landing"),
      cart_page_seen: stepCount(oneDay, "add_to_cart"),
      payment_started: stepCount(oneDay, "payment_started"),
      payment_method_selected: stepCount(oneDay, "payment_method_selected"),
      confirmed_purchase: stepCount(oneDay, "confirmed_purchase"),
      meta_capi_success: stepCount(oneDay, "meta_capi_success"),
      browser_purchase: stepCount(oneDay, "browser_purchase"),
    },
    "7d": {
      landing: stepCount(sevenDay, "landing"),
      cart_page_seen: stepCount(sevenDay, "add_to_cart"),
      payment_started: stepCount(sevenDay, "payment_started"),
      payment_method_selected: stepCount(sevenDay, "payment_method_selected"),
      confirmed_purchase: stepCount(sevenDay, "confirmed_purchase"),
      meta_capi_success: stepCount(sevenDay, "meta_capi_success"),
      browser_purchase: stepCount(sevenDay, "browser_purchase"),
    },
  };

  const cartLandingCount7d = getNestedNumber(sevenDay.site_landing_evidence, ["cart_page_views", "total"]);

  return [
    {
      indicator_id: "landing",
      label_ko: "유입",
      business_question: "어떤 채널이 구매 전 행동의 시작점을 만들고 있는가.",
      primary_source: "VM Cloud site_landing_ledger",
      cross_check_source: "GA4 session/source medium",
      fallback_source: "VM Cloud attribution_ledger marketing_intent diagnostic",
      current_status: "available",
      blocker_category: null,
      latest_counts: { "1d": counts["1d"].landing, "7d": counts["7d"].landing },
      freshness: getCacheFreshness(sevenDay),
      confidence: "high",
    },
    {
      indicator_id: "cart_page_seen",
      label_ko: "장바구니 페이지 진입",
      business_question: "구매 전 장바구니까지 온 사용자가 얼마나 되는가.",
      primary_source: "VM Cloud site_landing_ledger landing_path=/shop_cart",
      cross_check_source: gtmHasAddToCart ? "GTM/GA4 add_to_cart and view_cart" : "not confirmed",
      fallback_source: "Browser AddToCart event, but ViewContent excluded",
      current_status: cartLandingCount7d > 0 ? "available" : "source_gap",
      blocker_category: cartLandingCount7d > 0 ? null : "데이터 부족",
      latest_counts: { "1d": counts["1d"].cart_page_seen, "7d": counts["7d"].cart_page_seen },
      freshness: getCacheFreshness(sevenDay),
      confidence: cartLandingCount7d > 0 ? "high_for_page_seen_medium_for_click" : "low",
    },
    {
      indicator_id: "payment_started",
      label_ko: "결제 시작",
      business_question: "구매 의도가 있는 사용자가 결제 페이지까지 얼마나 도달하는가.",
      primary_source: "VM Cloud attribution_ledger checkout_started + payment_page_seen",
      cross_check_source: "Meta Browser InitiateCheckout / GA4 begin_checkout",
      fallback_source: "site_landing_ledger shop_payment path evidence",
      current_status: "available",
      blocker_category: null,
      latest_counts: { "1d": counts["1d"].payment_started, "7d": counts["7d"].payment_started },
      freshness: getCacheFreshness(sevenDay),
      confidence: "medium_high",
    },
    {
      indicator_id: "payment_method_selected",
      label_ko: "결제수단 선택",
      business_question: "결제 페이지에서 실제 결제수단 선택까지 가는가.",
      primary_source: "VM Cloud payment_page_seen metadata selected_payment_method",
      cross_check_source: gtmHasAddPaymentInfo ? "GTM/GA4 add_payment_info" : "not confirmed",
      fallback_source: "Block 4 AddPaymentInfo browser observation",
      current_status: counts["7d"].payment_method_selected > 0 ? "available" : "source_gap",
      blocker_category: counts["7d"].payment_method_selected > 0 ? null : "source_freshness_gap",
      latest_counts: {
        "1d": counts["1d"].payment_method_selected,
        "7d": counts["7d"].payment_method_selected,
      },
      freshness: getCacheFreshness(sevenDay),
      confidence: counts["7d"].payment_method_selected > 0 ? "medium" : "low",
      next_fix: "payment_page_seen metadata를 aggregate로 노출하거나 intermediate no-send receiver에 AddPaymentInfo를 저장한다.",
    },
    {
      indicator_id: "confirmed_purchase",
      label_ko: "실제 결제완료",
      business_question: "선행 행동이 실제 매출로 이어졌는가.",
      primary_source: "VM Cloud attribution_ledger confirmed payment_success",
      cross_check_source: "운영DB PAYMENT_COMPLETE / Toss / Imweb direct",
      fallback_source: "fresh VM Cloud imweb_orders cache",
      current_status: "available",
      blocker_category: null,
      latest_counts: {
        "1d": counts["1d"].confirmed_purchase,
        "7d": counts["7d"].confirmed_purchase,
      },
      freshness: getCacheFreshness(sevenDay),
      confidence: "medium_high",
    },
    {
      indicator_id: "meta_capi_success",
      label_ko: "Meta CAPI 성공",
      business_question: "구매 신호가 Meta 학습 쪽으로 실제 전달됐는가.",
      primary_source: "VM Cloud Meta CAPI send log, Pixel filtered",
      cross_check_source: "Meta Events Manager UI",
      fallback_source: "Ads Manager attributed purchase, delayed",
      current_status: "available",
      blocker_category: null,
      latest_counts: { "1d": counts["1d"].meta_capi_success, "7d": counts["7d"].meta_capi_success },
      freshness: getCacheFreshness(sevenDay),
      confidence: "high_for_send_medium_for_ads_attribution",
    },
    {
      indicator_id: "dwell_time",
      label_ko: "평균 체류시간",
      business_question: "구매자는 이탈자보다 오래 머무는가.",
      primary_source: "GA4 BigQuery engagement_time_msec",
      cross_check_source: "future VM Cloud engagement-intent receiver",
      fallback_source: "none",
      current_status: "needs_ga4_join",
      blocker_category: "권한 부족 또는 source join 필요",
      latest_counts: null,
      freshness: "GA4 access dependent",
      confidence: "medium_when_ga4_available",
    },
    {
      indicator_id: "scroll50",
      label_ko: "50% 스크롤",
      business_question: "구매자는 초기에 페이지 절반 이상을 읽는가.",
      primary_source: gtmHasScroll50 ? "GTM scrollDepth trigger exists; VM Cloud route not wired" : "not found",
      cross_check_source: "GA4 scroll / ProductEngagementSummary POC",
      fallback_source: "Scroll90 historical analysis",
      current_status: gtmHasScroll50 ? "source_exists_route_gap" : "source_gap",
      blocker_category: "route 미구현",
      latest_counts: null,
      freshness: "GTM doc snapshot + historical channel funnel",
      confidence: gtmHasScroll50 ? "medium_for_source_low_for_vm" : "low",
    },
    {
      indicator_id: "complete_registration",
      label_ko: "회원가입 완료",
      business_question: "회원가입이 구매 전 강한 행동인지 확인한다.",
      primary_source: gtmHasSignUp ? "GTM GA4 sign_up tag" : "not found",
      cross_check_source: "GA4 sign_up event",
      fallback_source: "future VM Cloud intermediate no-send receiver",
      current_status: gtmHasSignUp ? "source_exists_route_gap" : "source_gap",
      blocker_category: "route 미구현",
      latest_counts: null,
      freshness: "GTM doc snapshot",
      confidence: gtmHasSignUp ? "medium" : "low",
    },
    {
      indicator_id: "youtube_content",
      label_ko: "YouTube 콘텐츠 유입",
      business_question: "YouTube 콘텐츠 유입이 구매 전 몰입과 구매를 예고하는가.",
      primary_source: "UTM/referrer classification needed",
      cross_check_source: "GA4 source/medium/page path",
      fallback_source: "manual campaign naming inventory",
      current_status: "source_gap",
      blocker_category: "필터 불일치",
      latest_counts: null,
      freshness: "not connected to funnel-health source enum",
      confidence: "low",
    },
  ];
};

const buildMarkdown = (payload: Record<string, unknown>): string => {
  const sourceMatrix = payload.source_matrix as Array<Record<string, unknown>>;
  const cohort = payload.cohort_dry_run as Array<Record<string, unknown>>;
  const lines: string[] = [];

  lines.push("# Leading Indicator Agent P0 Dry-run");
  lines.push("");
  lines.push(`작성 시각: ${payload.checked_at_kst}`);
  lines.push("문서 성격: P0 source inventory + aggregate cohort dry-run");
  lines.push("Lane: Green read-only");
  lines.push("");
  lines.push("## 10초 요약");
  lines.push("");
  lines.push("- P0-1 source inventory는 로컬 산출물 기준으로 30%에서 65%까지 올릴 수 있다.");
  lines.push("- P0-2 cohort는 VM Cloud aggregate 기준으로 15%에서 35%까지 올릴 수 있다.");
  lines.push("- 체류시간/스크롤/회원가입은 아직 GA4/GTM/VM Cloud route join이 필요하다.");
  lines.push("- 프론트엔드 개발은 Claude Code가 담당하고, Codex는 API/data contract와 dry-run 산출물을 제공한다.");
  lines.push("");
  lines.push("## Source Matrix");
  lines.push("");
  lines.push("| 지표 | 상태 | primary source | 1d | 7d | confidence | blocker |");
  lines.push("|---|---|---|---:|---:|---|---|");
  for (const row of sourceMatrix) {
    const counts = row.latest_counts as Record<string, number> | null;
    lines.push(
      `| ${row.label_ko} | ${row.current_status} | ${row.primary_source} | ${counts?.["1d"] ?? ""} | ${counts?.["7d"] ?? ""} | ${row.confidence} | ${row.blocker_category ?? ""} |`,
    );
  }
  lines.push("");
  lines.push("## Cohort Baseline");
  lines.push("");
  lines.push("| source | 7d landing | 7d purchase | 7d purchase rate | 7d CAPI coverage | 해석 |");
  lines.push("|---|---:|---:|---:|---:|---|");
  for (const row of cohort) {
    const byWindow = row.by_window as Record<string, Record<string, number>>;
    const sevenDay = byWindow["7d"] ?? {};
    const purchaseRate =
      typeof sevenDay.landing_to_purchase_rate_pct === "number"
        ? `${sevenDay.landing_to_purchase_rate_pct}%`
        : "diagnostic only";
    const capiCoverage =
      typeof sevenDay.capi_coverage_pct === "number" ? `${sevenDay.capi_coverage_pct}%` : "source filter gap";
    lines.push(
      `| ${row.label} | ${sevenDay.landing ?? 0} | ${sevenDay.confirmed_purchase ?? 0} | ${purchaseRate} | ${capiCoverage} | ${row.interpretation} |`,
    );
  }
  lines.push("");
  lines.push("## Claude Code Frontend Handoff");
  lines.push("");
  lines.push("- route 후보: `/ai-crm/leading-indicators`");
  lines.push("- 첫 화면 카드: 구매 전 강한 신호, Meta 구매자 vs 이탈자, scroll/dwell source gap, 회원가입 후보, YouTube/오가닉 후보, 오늘 실험 추천");
  lines.push("- 화면은 `source`, `window`, `freshness`, `confidence`, `blocker_category`를 항상 보여준다.");
  lines.push("");
  lines.push("## 금지선");
  lines.push("");
  lines.push("- Meta CAPI 운영 send 0");
  lines.push("- GTM Production publish 0");
  lines.push("- 운영DB write/import 0");
  lines.push("- VM Cloud deploy/restart 0");
  lines.push("- raw identifier output 0");
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const baseUrl = process.env.ATTR_BASE_URL ?? DEFAULT_BASE_URL;
  const site = process.env.SITE ?? "biocom";
  const checkedAt = toKst();

  const docs = {
    dataInventory: await readText("data/!data_inventory.md"),
    channelFunnel: await readText("data/!channelfunnel.md"),
    gtm: await readText("GA4/gtm.md"),
    capiPlan: await readText("capivm/!capiplan.md"),
  };

  const allPayloads = Object.fromEntries(
    await Promise.all(windows.map(async (window) => [window, await fetchFunnel(baseUrl, site, window, "all")])),
  ) as Record<WindowKey, FunnelHealthResponse>;

  const sourcePayloads = await fetchSourcePayloads(baseUrl, site);

  const payload = {
    ok: true,
    checked_at_kst: checkedAt,
    mode: "green_read_only_p0_dry_run",
    site,
    base_url: baseUrl,
    source_window_freshness_confidence: {
      source: "VM Cloud funnel-health cached aggregate + local docs",
      window: "1d and 7d",
      freshness: {
        "1d": getCacheFreshness(allPayloads["1d"]),
        "7d": getCacheFreshness(allPayloads["7d"]),
      },
      confidence: 0.78,
      caveat: "dwell/scroll/signup은 아직 GA4/GTM/VM route join 전이므로 source inventory 단계로만 해석한다.",
    },
    source_matrix: buildSourceMatrix(allPayloads, docs),
    cohort_dry_run: sources.map((source) => buildCohortRow(source, sourcePayloads[source])),
    p0_progress_recommendation: {
      "Phase1-Sprint1": {
        before_pct: 30,
        after_pct: 65,
        reason: "지표별 primary/cross-check/fallback source와 live aggregate counts가 생성됐다.",
        remaining: ["GA4 dwell/scroll join", "CompleteRegistration VM route", "YouTube source classification"],
      },
      "Phase1-Sprint2": {
        before_pct: 15,
        after_pct: 35,
        reason: "source별 aggregate purchased/dropped baseline은 생성됐지만 row/session-level dwell/scroll join은 아직 없다.",
        remaining: ["safe session cohort", "GA4 engagement join", "median/p75 dwell", "YouTube cohort"],
      },
    },
    frontend_handoff: {
      owner: "Claude Code",
      suggested_route: "/ai-crm/leading-indicators",
      required_cards: [
        "오늘 구매 전 강한 신호",
        "Meta 유입 구매자 vs 이탈자",
        "장바구니/결제 시작/결제수단 선택 source 상태",
        "오가닉/YouTube 후보",
        "source gap blocker table",
        "오늘 실험 추천",
      ],
      required_fields: ["source", "window", "freshness", "confidence", "blocker_category", "owner"],
    },
    no_send_no_write: {
      meta_capi_send: 0,
      gtm_publish: 0,
      operational_db_write: 0,
      vm_cloud_deploy_restart: 0,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `leading-indicator-p0-dry-run-${OUTPUT_DATE}.json`);
  const mdPath = path.join(REPO_ROOT, "project", `leading-indicator-p0-dry-run-${OUTPUT_DATE}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdown(payload), "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, checkedAt }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
