/**
 * site_landing_ledger channel_classified 자동 분류 helper (gpt0508-41 작업5)
 *
 * 룰 (우선순위 위에서 아래로):
 *   1. Naver 브랜드검색 marker 는 naver_brandsearch 로 별도 분리
 *      - 명시 UTM marker 가 있으면 이전 touch 에서 보존된 click_id 보다 우선
 *   2. click_id_type 이 광고 식별자면 paid_search / paid_social
 *      - gclid / gbraid / wbraid → paid_search
 *      - ttclid / nclick_id → paid_social (network)
 *   3. UTM 있고 medium 이 cpc/cpm/paid/ads/sem → paid_search 또는 paid_social
 *      - utm_source 가 google/bing/yahoo/daum/naver/baidu → paid_search
 *      - utm_source 가 instagram/facebook/youtube/tiktok/twitter → paid_social
 *   4. UTM organic_search / organic_social medium 명시
 *   5. referrerHost 가 자기 도메인 → self_internal
 *   6. referrer 없으면 direct
 *   7. 한국/글로벌 검색 엔진 host (naver/daum/kakao/google/bing/yahoo/baidu/yandex) → organic_search
 *   8. 한국/글로벌 소셜 host (instagram/facebook/youtube/tiktok/twitter/threads/x.com) → organic_social
 *   9. 기타 외부 host → referral
 *   10. 위 매칭 없으면 unknown
 *
 * GA4 default channel grouping 과 호환하되 한국 채널 (naver, daum, kakao) 명시.
 */

const SELF_DOMAINS_BY_SITE: Record<string, ReadonlyArray<string>> = {
  biocom: ["biocom.kr", "www.biocom.kr", "biocom.imweb.me"],
  thecleancoffee: ["thecleancoffee.com", "www.thecleancoffee.com", "thecleancoffee.imweb.me"],
};

const ALL_SELF_DOMAINS: ReadonlyArray<string> = Object.values(SELF_DOMAINS_BY_SITE).flat();

const SEARCH_ENGINE_HOSTS = [
  "naver.com",
  "search.naver.com",
  "m.search.naver.com",
  "daum.net",
  "search.daum.net",
  "m.search.daum.net",
  "kauth.kakao.com", // kakao login redirect — search 아니지만 organic 그룹
  "search.kakao.com",
  "google.com",
  "www.google.com",
  "google.co.kr",
  "www.google.co.kr",
  "bing.com",
  "www.bing.com",
  "search.yahoo.com",
  "baidu.com",
  "www.baidu.com",
  "yandex.com",
  "yandex.ru",
  "duckduckgo.com",
  "ecosia.org",
  "syndicatedsearch.goog",
];

const SOCIAL_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "l.instagram.com",
  "linstagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "lm.facebook.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "twitter.com",
  "x.com",
  "t.co",
  "threads.com",
  "www.threads.com",
  "threads.net",
  "pinterest.com",
];

const PAID_SEARCH_UTM_SOURCES = new Set([
  "google",
  "googleads",
  "google_ads",
  "bing",
  "yahoo",
  "naver",
  "naverads",
  "daum",
  "kakao",
  "kakaoads",
  "baidu",
]);

const PAID_SOCIAL_UTM_SOURCES = new Set([
  "instagram",
  "facebook",
  "meta",
  "youtube",
  "tiktok",
  "twitter",
  "x",
  "pinterest",
  "threads",
]);

const PAID_MEDIUMS = new Set(["cpc", "cpm", "paid", "ads", "sem", "ppc", "paid_social", "paid_search"]);

const NAVER_BRANDSEARCH_MARKERS = [
  "naver_brand_search",
  "naverbrandsearch",
  "naver_brandsearch",
  "brandsearch",
  "brand_search",
];

const NAVER_PAID_SEARCH_MARKERS = [
  "naverad",
  "powerlink",
  "power-link",
];

export type ClassifierInput = {
  referrerHost?: string;
  referrerFullUrl?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  clickIdType?: string;
  /** gpt0508-45 정정: 어느 site 기준으로 self_domain 분류할지. 미설정 시 ALL_SELF_DOMAINS 사용. */
  site?: "biocom" | "thecleancoffee";
};

// gpt0508-45 정정: utm_medium 이 kakao 알림톡(brand-message), naver powerlink 같은
// 광고/마케팅 medium 도 paid 로 분류. 기존 (cpc/cpm/paid/ads/sem/ppc/paid_*) 외 추가.
const EXTRA_PAID_MEDIUMS = new Set([
  "brand-message",
  "brand_message",
  "brandmessage",
  "powerlink",
  "power-link",
  "biz-message",
  "bizmessage",
  "alimtalk",
  "kakao-message",
]);

export type ClassifierChannel =
  | "direct"
  | "self_internal"
  | "organic_search"
  | "organic_social"
  | "naver_brandsearch"
  | "paid_search"
  | "paid_social"
  | "referral"
  | "unknown";

export type ClassifierResult = {
  channel: ClassifierChannel;
  source_breakdown: string; // host or utm_source
  reason: string;
};

const normalizeHost = (h: string): string => {
  if (!h) return "";
  return h.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "www.").split("/")[0];
};

const hostFromUrl = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
};

const matchesHostList = (host: string, list: ReadonlyArray<string>): boolean => {
  if (!host) return false;
  const h = host.toLowerCase();
  return list.some((d) => h === d || h.endsWith(`.${d}`));
};

export const classifySiteLandingChannel = (input: ClassifierInput): ClassifierResult => {
  const refHost = normalizeHost(input.referrerHost || "") || hostFromUrl(input.referrerFullUrl || "");
  const utmSource = (input.utm?.source || "").toLowerCase();
  const utmMedium = (input.utm?.medium || "").toLowerCase();
  const utmCampaign = (input.utm?.campaign || "").toLowerCase();
  const clickIdType = (input.clickIdType || "").toLowerCase();
  const utmText = `${utmSource} ${utmMedium} ${utmCampaign}`;

  // 1. Naver 브랜드검색 marker. 결제 페이지 referrer 가 자기 도메인이어도
  // 이전 touch 에서 보존된 브랜드검색 evidence 를 self_internal 로 낮추지 않는다.
  // 또한 이전 Google click id 가 보존된 브라우저에서 새 Naver 브랜드검색 UTM 이 들어오면
  // 현재 landing 의 명시 UTM evidence 를 우선한다.
  if (
    NAVER_BRANDSEARCH_MARKERS.some((marker) => utmText.includes(marker)) ||
    (utmText.includes("naver") && (utmText.includes("brandsearch") || utmText.includes("brand_search")))
  ) {
    return {
      channel: "naver_brandsearch",
      source_breakdown: utmSource || "naver_brandsearch",
      reason: "utm_naver_brandsearch_marker",
    };
  }

  // 2. click_id 기반 paid
  if (clickIdType === "gclid" || clickIdType === "gbraid" || clickIdType === "wbraid") {
    return { channel: "paid_search", source_breakdown: "google.com", reason: "click_id_type_google_paid" };
  }
  if (clickIdType === "ttclid") {
    return { channel: "paid_social", source_breakdown: "tiktok.com", reason: "click_id_type_tiktok_paid" };
  }
  if (clickIdType === "nclick_id") {
    return { channel: "paid_search", source_breakdown: "naver.com", reason: "click_id_type_naver_paid" };
  }

  // 2.5. Naver paid marker 중 브랜드검색이 아닌 것은 기존 유료검색으로 둔다.
  if (NAVER_PAID_SEARCH_MARKERS.some((marker) => utmText.includes(marker))) {
    return {
      channel: "paid_search",
      source_breakdown: utmSource || "naver",
      reason: "utm_naver_paid_search_marker",
    };
  }

  // 2. UTM medium 기반 paid
  const allPaidMediums = utmMedium && (PAID_MEDIUMS.has(utmMedium) || EXTRA_PAID_MEDIUMS.has(utmMedium));
  if (allPaidMediums) {
    if (PAID_SOCIAL_UTM_SOURCES.has(utmSource)) {
      return { channel: "paid_social", source_breakdown: utmSource, reason: "utm_paid_medium_social_source" };
    }
    if (PAID_SEARCH_UTM_SOURCES.has(utmSource)) {
      return { channel: "paid_search", source_breakdown: utmSource, reason: "utm_paid_medium_search_source" };
    }
    return { channel: "paid_search", source_breakdown: utmSource || refHost, reason: "utm_paid_medium_unknown_source" };
  }

  // 3. UTM medium 이 organic_* 인 경우
  if (utmMedium === "organic_search" || utmMedium === "organic-search") {
    return { channel: "organic_search", source_breakdown: utmSource || refHost, reason: "utm_organic_search" };
  }
  if (utmMedium === "organic_social" || utmMedium === "organic-social" || utmMedium === "social") {
    return { channel: "organic_social", source_breakdown: utmSource || refHost, reason: "utm_organic_social" };
  }

  // 4. 자기 도메인 (site 별 분기)
  const selfDomains = input.site ? SELF_DOMAINS_BY_SITE[input.site] ?? ALL_SELF_DOMAINS : ALL_SELF_DOMAINS;
  if (refHost && matchesHostList(refHost, selfDomains)) {
    return { channel: "self_internal", source_breakdown: refHost, reason: "self_domain_referrer" };
  }

  // 5. referrer 없음
  if (!refHost) {
    return { channel: "direct", source_breakdown: "", reason: "no_referrer" };
  }

  // 6. 검색 엔진
  if (matchesHostList(refHost, SEARCH_ENGINE_HOSTS)) {
    return { channel: "organic_search", source_breakdown: refHost, reason: "search_engine_referrer" };
  }

  // 7. 소셜
  if (matchesHostList(refHost, SOCIAL_HOSTS)) {
    return { channel: "organic_social", source_breakdown: refHost, reason: "social_referrer" };
  }

  // 8. 외부 host
  if (refHost) {
    return { channel: "referral", source_breakdown: refHost, reason: "external_referrer" };
  }

  return { channel: "unknown", source_breakdown: "", reason: "no_matching_rule" };
};
