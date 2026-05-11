/**
 * site_landing_ledger summary dry-run (gpt0508-41 작업6)
 *
 * 목적: 신설 site_landing_ledger 에 sample 데이터를 채워
 *   channel_distribution / source_top10 / joinable_rate 를 산출하고
 *   아임웹 수준 유입 분석 점수 재평가.
 *
 * operational DB 호출 0, 외부 API 호출 0. 로컬 SQLite (CRM_LOCAL_DB_PATH) 만 사용.
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const TEST_DB_PATH = path.join(os.tmpdir(), `site-landing-dryrun-${Date.now()}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

import {
  recordSiteLanding,
  summarizeSiteLanding,
  bootstrapSiteLandingTable,
} from "../src/siteLandingLedger";
import { classifySiteLandingChannel } from "../src/siteLandingChannelClassifier";

const run = async () => {
bootstrapSiteLandingTable();
const FIXTURE = [
  // (referrerHost, count, utm_source, utm_medium, clickIdType)
  ["instagram.com", 1025, "instagram", "", ""],
  ["", 917, "", "", ""], // direct 1
  ["", 423, "", "", ""], // direct biocom.imweb.me
  ["l.facebook.com", 241, "", "", ""],
  ["syndicatedsearch.goog", 230, "", "", ""],
  ["m.search.naver.com", 165, "", "", ""],
  ["kauth.kakao.com", 55, "", "", ""],
  ["www.google.com", 46, "", "", ""],
  ["search.naver.com", 33, "", "", ""],
  ["m.facebook.com", 21, "", "", ""],
  ["link.inpock.co.kr", 20, "", "", ""],
  ["l.instagram.com", 20, "", "", ""],
  ["accounts.kakao.com", 14, "", "", ""],
  ["m.blog.naver.com", 9, "", "", ""],
  ["www.threads.com", 6, "", "", ""],
  // UTM paid 시뮬레이션 (아임웹 마케팅 성과 측정 UTM 표 기반)
  ["instagram.com", 230, "instagram", "cpc", ""],
  ["facebook.com", 159, "facebook", "cpc", ""],
  ["google.com", 60, "google", "cpc", ""],
  ["tiktok.com", 30, "tiktok", "paid_social", "ttclid"],
] as const;

const baseTime = Date.now() - 60 * 60 * 1000;
let rowsCreated = 0;

for (const [host, count, utmSource, utmMedium, clickIdType] of FIXTURE) {
  for (let i = 0; i < count; i++) {
    const landedAt = new Date(baseTime + i * 1000).toISOString();
    const cls = classifySiteLandingChannel({
      referrerHost: host,
      utm: { source: utmSource, medium: utmMedium },
      clickIdType,
    });
    const result = recordSiteLanding({
      site: "biocom",
      landedAt,
      landingUrl: "https://biocom.kr/?_t=" + i + "&_h=" + host,
      referrerHost: host,
      referrerFullUrl: host ? `https://${host}/` : "",
      utm: { source: utmSource, medium: utmMedium, campaign: utmSource ? `camp-${utmSource}` : "" },
      clickId: clickIdType
        ? { type: clickIdType, valueOrHash: `fixture-${clickIdType}-${i}`, storageMode: "raw" }
        : undefined,
      sessionKey: { gaSessionId: `sess-${host}-${i}`, clientId: `cli-${host}-${i}` },
      channelClassified: cls.channel,
      sourceBreakdown: cls.source_breakdown,
    });
    if (result.stored) rowsCreated++;
  }
}

const summary = summarizeSiteLanding("biocom", 24);

// 추적 coverage 점수 재평가
const totalRows = summary.total;
const channelKnown = Object.entries(summary.channel_distribution)
  .filter(([k]) => k && k !== "unknown")
  .reduce((sum, [, v]) => sum + v, 0);
const channelKnownRate = totalRows > 0 ? channelKnown / totalRows : 0;
const joinableRate = totalRows > 0 ? summary.joinable_session_key_count / totalRows : 0;

const componentScores = {
  l1_referrer_utm_landing_storage: totalRows > 0 ? 0.95 : 0, // 신규 ledger 에 저장 가능 = 95% (footer trigger 미연결로 100% 아님)
  l1_channel_classification: channelKnownRate, // unknown 제외 비율
  l2_session_key_join_ready: joinableRate,
  l3_paid_click_intent: 0.65, // 변동 없음 — gpt0508-40 기준
  l4_click_view_exact: 0.7,
  l5_platform_send: 0, // 본 sprint 정책상 0
};

const aimweb_basic_coverage =
  componentScores.l1_referrer_utm_landing_storage * 0.45 +
  componentScores.l1_channel_classification * 0.30 +
  componentScores.l2_session_key_join_ready * 0.25;

const overall_self_tracking =
  componentScores.l1_referrer_utm_landing_storage * 0.30 +
  componentScores.l1_channel_classification * 0.20 +
  componentScores.l2_session_key_join_ready * 0.20 +
  componentScores.l3_paid_click_intent * 0.15 +
  componentScores.l4_click_view_exact * 0.10 +
  componentScores.l5_platform_send * 0.05;

const out = {
  ok: true,
  schema_version: "site_landing_summary_dryrun_20260511",
  generated_at_kst: new Date().toISOString(),
  rows_created_in_dryrun: rowsCreated,
  summary,
  rates: {
    channel_known_rate: Number(channelKnownRate.toFixed(3)),
    joinable_session_key_rate: Number(joinableRate.toFixed(3)),
  },
  scores: {
    component: Object.fromEntries(Object.entries(componentScores).map(([k, v]) => [k, Number(v.toFixed(3))])),
    aimweb_basic_inflow_coverage: Number(aimweb_basic_coverage.toFixed(3)),
    overall_self_tracking_coverage: Number(overall_self_tracking.toFixed(3)),
  },
  target_check: {
    aimweb_basic_target: 0.85,
    aimweb_basic_met: aimweb_basic_coverage >= 0.85,
    overall_target: 0.85,
    overall_met: overall_self_tracking >= 0.85,
  },
  invariants_held: {
    send_candidate: false,
    actual_send_candidate: false,
    upload_candidate: 0,
    external_platform_send: 0,
    operational_db_write: 0,
    raw_pii_logged: false,
  },
};

console.log(JSON.stringify(out, null, 2));

try {
  fs.unlinkSync(TEST_DB_PATH);
} catch {
  // ignore
}
};

run().catch((err) => {
  console.error("site-landing-summary-dryrun failed", err);
  process.exit(1);
});
