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
 * internal/test traffic 분리 규칙 (gpt0508-44 작업2)
 * - test/debug/claude/staging prefix → 명확한 test
 * - 짧은 숫자만 (`1`, `2` 등) → UTM 오작성, internal 의심
 * - imweb 자동 생성 trans id 패턴 (`b` + YYYYMMDD + 숫자 + hex) → automated_id (internal 의심)
 * - 그 외 → likely_real_customer
 */
const TEST_PREFIX_REGEXES: ReadonlyArray<RegExp> = [
  /^test/i,
  /^debug/i,
  /^claude/i,
  /^staging/i,
];

const SHORT_NUMERIC_ONLY = /^\d{1,3}$/;
// imweb 자동 trans id: b + YYYYMMDD(8자리) + 숫자 + hex 혼합, 보통 22~32자
const IMWEB_AUTO_ID = /^b\d{8}[a-z0-9]{10,30}$/i;

const tagInternalTest = (campaign: string): "likely_internal_test" | "likely_real_customer" | "unknown" => {
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
  utm_campaign_top10: Array<{ campaign: string; count: number }>;
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

const fetchSummary = async (windowHours: number): Promise<SummaryResponse> => {
  const url = `${ATT_API_BASE}/api/attribution/site-landing/summary?windowHours=${windowHours}`;
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
    count: c.count,
    test_tag: tagInternalTest(c.campaign),
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
  const summary = await fetchSummary(windowHours);
  const snapshot = computeSnapshot(summary);
  console.log(JSON.stringify(snapshot, null, 2));
};

main().catch((err) => {
  console.error("snapshot failed", err);
  process.exit(1);
});
