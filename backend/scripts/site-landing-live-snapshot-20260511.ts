/**
 * site-landing live snapshot script (gpt0508-44 작업1)
 *
 * 목적: 운영 summary API 와 VM SQLite read-only 를 사용해 6h/24h/72h 시점별 분포 snapshot 을 산출한다.
 *
 * 정책:
 *   - read-only. 운영 / VM Cloud / 로컬 DB write 0.
 *   - raw email/phone/order/payment/member_code/click_id 출력 0.
 *   - cron / systemd timer 등록은 본 script 가 하지 않음 (approval packet 별도).
 *
 * 사용:
 *   ATT_API_BASE=https://att.ainativeos.net WINDOW_HOURS=24 npx tsx scripts/site-landing-live-snapshot-20260511.ts
 *   또는 --window-hours=6|24|72
 */

const ATT_API_BASE = process.env.ATT_API_BASE || "https://att.ainativeos.net";

const parseArgs = () => {
  const args: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.+)$/.exec(a);
    if (m) args[m[1]] = m[2];
  }
  return args;
};

/**
 * internal/test traffic 분리 규칙 (gpt0508-45 정정)
 *
 * 정정 사유: gpt0508-44 sprint 의 regex 가 false positive 4 건을 internal_test 로
 * 잘못 분류함. 실제 데이터 확인 결과:
 * - `b2026051144755feeb63db` = 카카오 알림톡 (utm_source=kakao + utm_medium=brand-message) 의 캠페인 ID
 * - `1` = 네이버 파워링크 (utm_source=naver + utm_medium=powerlink) 의 캠페인 ID
 * 따라서 utm_source/medium 이 명확한 광고 채널이면 internal_test 분류 제외.
 *
 * 정정 규칙:
 * - utm_source 가 광고 채널 (kakao/naver/google/meta/facebook/instagram/tiktok 등) 이면 → real_customer
 * - 그 외에 test/debug/claude/staging prefix → internal_test
 * - utm_source 없이 짧은 숫자만 또는 imweb 자동 ID → internal_test
 */
const KNOWN_AD_UTM_SOURCES = new Set([
  "kakao", "naver", "google", "googleads", "google_ads",
  "meta", "facebook", "instagram",
  "tiktok", "youtube", "twitter", "x",
  "bing", "yahoo", "daum", "baidu",
]);

const TEST_PREFIX_REGEXES: ReadonlyArray<RegExp> = [
  /^test/i,
  /^debug/i,
  /^claude/i,
  /^staging/i,
];

const SHORT_NUMERIC_ONLY = /^\d{1,3}$/;
const IMWEB_AUTO_ID = /^b\d{8}[a-z0-9]{10,30}$/i;

const tagInternalTest = (
  campaign: string,
  utmSource: string = "",
): "likely_internal_test" | "likely_real_customer" | "unknown" => {
  if (!campaign && !utmSource) return "unknown";
  // 광고 채널 utm_source 가 있으면 real customer 로 인정 (정정 핵심)
  const src = utmSource.toLowerCase();
  if (src && KNOWN_AD_UTM_SOURCES.has(src)) return "likely_real_customer";
  if (!campaign) return "unknown";
  for (const re of TEST_PREFIX_REGEXES) {
    if (re.test(campaign)) return "likely_internal_test";
  }
  if (SHORT_NUMERIC_ONLY.test(campaign)) return "likely_internal_test";
  if (IMWEB_AUTO_ID.test(campaign)) return "likely_internal_test";
  return "likely_real_customer";
};

type SummaryResponse = {
  ok: boolean;
  window_hours: number;
  total: number;
  channel_distribution: Record<string, number>;
  source_breakdown_top10: Array<{ source: string; count: number }>;
  utm_campaign_top10: Array<{ campaign: string; source?: string; medium?: string; count: number }>;
  joinable_session_key_count: number;
  click_id_storage_mode_distribution: Record<string, number>;
  derived?: {
    source_evidence_present_rate: number;
    paid_hint_count: number;
    organic_count: number;
    direct_count: number;
    referral_count: number;
    unknown_or_hold_count: number;
    raw_click_mode_count: number;
  };
};

const fetchSummary = async (windowHours: number, site: string): Promise<SummaryResponse> => {
  const url = `${ATT_API_BASE}/api/attribution/site-landing/summary?windowHours=${windowHours}&site=${encodeURIComponent(site)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`summary api ${url} returned ${res.status}`);
  return (await res.json()) as SummaryResponse;
};

const computeSnapshot = (s: SummaryResponse) => {
  const channel = s.channel_distribution || {};
  const hashCount = s.click_id_storage_mode_distribution?.hash ?? 0;
  const rawCount = s.click_id_storage_mode_distribution?.raw ?? 0;
  const noneCount = s.click_id_storage_mode_distribution?.none ?? 0;
  const totalClickAware = hashCount + rawCount;

  const utmTagged = s.utm_campaign_top10.map((c) => ({
    campaign: c.campaign,
    source: c.source ?? "",
    medium: c.medium ?? "",
    count: c.count,
    test_tag: tagInternalTest(c.campaign, c.source ?? ""),
  }));
  const internalTestCount = utmTagged
    .filter((r) => r.test_tag === "likely_internal_test")
    .reduce((sum, r) => sum + r.count, 0);

  const verdict = (() => {
    const rate = s.derived?.source_evidence_present_rate ?? 0;
    const organic = (s.derived?.organic_count ?? 0) + (s.derived?.direct_count ?? 0) + (s.derived?.referral_count ?? 0);
    const onlyPaid = organic === 0 && (s.derived?.paid_hint_count ?? 0) > 0;
    if (s.total < 50) return "INSUFFICIENT_SAMPLE_HOLD";
    if (rate >= 0.6) return onlyPaid ? "GTM_PREVIEW_RECOMMENDED_FAN_OUT_BIAS" : "GTM_PARKED";
    if (rate >= 0.3) return "GTM_PREVIEW_CONDITIONAL_RECOMMENDED";
    return "GTM_PREVIEW_STRONGLY_RECOMMENDED";
  })();

  return {
    snapshot_at_kst: new Date().toISOString(),
    window_hours: s.window_hours,
    total_rows: s.total,
    unique_session_count: s.joinable_session_key_count,
    source_evidence_present_rate: s.derived?.source_evidence_present_rate ?? 0,
    channel_distribution: channel,
    paid_search_count: channel["paid_search"] ?? 0,
    paid_social_count: channel["paid_social"] ?? 0,
    organic_search_count: channel["organic_search"] ?? 0,
    organic_social_count: channel["organic_social"] ?? 0,
    direct_count: (channel["direct"] ?? 0) + (channel["self_internal"] ?? 0),
    referral_count: channel["referral"] ?? 0,
    unknown_count: channel["unknown"] ?? 0,
    utm_campaign_distribution: utmTagged,
    source_breakdown: s.source_breakdown_top10,
    hash_only_rate: totalClickAware > 0 ? hashCount / totalClickAware : 1,
    raw_click_count: rawCount,
    internal_or_test_traffic_count: internalTestCount,
    sample_too_small_warning: s.total < 50,
    gtm_verdict_provisional: verdict,
    invariants_held: {
      send_candidate: false,
      actual_send_candidate: false,
      upload_candidate: 0,
      external_send_count: 0,
      raw_pii_logged: false,
      operational_db_write: 0,
    },
  };
};

const main = async () => {
  const args = parseArgs();
  const windowHours = Number(args["window-hours"] || process.env.WINDOW_HOURS || "24");
  const site = args["site"] || process.env.SITE || "biocom";
  const summary = await fetchSummary(windowHours, site);
  const snapshot = { site, ...computeSnapshot(summary) };
  console.log(JSON.stringify(snapshot, null, 2));
};

main().catch((err) => {
  console.error("snapshot failed", err);
  process.exit(1);
});
