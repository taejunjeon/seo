/**
 * site_landing_ledger — 광고/organic 무관 모든 landing 을 자체 DB 에 저장하는 기본 ledger.
 *
 * 본 ledger 의 책임:
 *   - L1 attribution ladder: referrer / UTM / landing URL / sessionKey 캡쳐 보관
 *   - L2 attribution ladder: sessionKey 기반 R2 ledger / 운영DB 주문 / 회원 가입과 join 가능한 기반
 *
 * 저장 정책:
 *   - click_id_value 는 hash (sha256) 가 기본. hash 생성이 쉬우면 hash.
 *   - hash 작업이 병목이면 raw 저장 허용 (TTL 30일 자동 만료).
 *   - 저장 mode 는 click_id_storage_mode = 'hash' | 'raw' | 'none'
 *   - raw click_id 는 frontend 응답에 노출 / 로그 출력 / export / 외부 전송 모두 금지.
 *
 * 절대 금지:
 *   - raw email / phone / member_code / order_no / payment 저장 또는 logging
 */

import { createHash, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

const TABLE = "site_landing_ledger";
let tableReady = false;

const ensureTable = (db: Database.Database) => {
  if (tableReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      landing_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      landed_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      referrer_host TEXT NOT NULL DEFAULT '',
      referrer_full_url TEXT NOT NULL DEFAULT '',
      is_self_domain INTEGER NOT NULL DEFAULT 0,
      landing_url TEXT NOT NULL DEFAULT '',
      landing_path TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      click_id_type TEXT NOT NULL DEFAULT '',
      click_id_value_or_hash TEXT NOT NULL DEFAULT '',
      click_id_storage_mode TEXT NOT NULL DEFAULT 'none',
      ga_session_id TEXT NOT NULL DEFAULT '',
      client_id TEXT NOT NULL DEFAULT '',
      local_session_id_hash TEXT NOT NULL DEFAULT '',
      channel_classified TEXT NOT NULL DEFAULT '',
      source_breakdown TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sll_dedupe ON ${TABLE}(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_sll_session ON ${TABLE}(site, ga_session_id);
    CREATE INDEX IF NOT EXISTS idx_sll_client ON ${TABLE}(site, client_id);
    CREATE INDEX IF NOT EXISTS idx_sll_channel ON ${TABLE}(site, channel_classified, landed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sll_expires ON ${TABLE}(expires_at);
  `);
  tableReady = true;
};

/**
 * site 별 자기 도메인. gpt0508-45 정정: thecleancoffee 트래픽이 같은 backend 로 들어와서
 * 별도 site 로 저장하기 위해 site 별 SELF_DOMAINS 매핑.
 */
export type SiteKey = "biocom" | "thecleancoffee";

const SELF_DOMAINS_BY_SITE: Record<SiteKey, ReadonlyArray<string>> = {
  biocom: ["biocom.kr", "www.biocom.kr", "biocom.imweb.me"],
  thecleancoffee: ["thecleancoffee.com", "www.thecleancoffee.com", "thecleancoffee.imweb.me"],
};

const SELF_DOMAINS_FLAT: ReadonlyArray<string> = [
  ...SELF_DOMAINS_BY_SITE.biocom,
  ...SELF_DOMAINS_BY_SITE.thecleancoffee,
];

export const detectSiteFromHost = (host: string): SiteKey | null => {
  if (!host) return null;
  const h = host.toLowerCase();
  for (const site of Object.keys(SELF_DOMAINS_BY_SITE) as SiteKey[]) {
    if (SELF_DOMAINS_BY_SITE[site].some((d) => h === d || h.endsWith(`.${d}`))) return site;
  }
  return null;
};

export const detectSiteFromUrl = (url: string): SiteKey | null => {
  if (!url) return null;
  try {
    const host = new URL(url).host.toLowerCase();
    return detectSiteFromHost(host);
  } catch {
    return null;
  }
};

const PII_FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /\b\d{6}-?\d{7}\b/, // 주민번호
  /\b\d{2,3}-\d{3,4}-\d{4}\b/, // 전화
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email
  /\b\d{4}-?\d{4}-?\d{4}-?\d{4}\b/, // 카드
];

export type ClickIdStorageMode = "hash" | "raw" | "none";

export type SiteLandingChannelClassified =
  | "direct"
  | "self_internal"
  | "organic_search"
  | "organic_social"
  | "paid_search"
  | "paid_social"
  | "referral"
  | "unknown";

export type SiteLandingInput = {
  site: SiteKey;
  landedAt: string;
  receivedAt?: string;
  referrerHost?: string;
  referrerFullUrl?: string;
  landingUrl: string;
  landingPath?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  clickId?: {
    type: string;
    valueOrHash: string;
    storageMode: ClickIdStorageMode;
  };
  sessionKey?: {
    gaSessionId?: string;
    clientId?: string;
    localSessionIdHash?: string;
  };
  channelClassified?: SiteLandingChannelClassified;
  sourceBreakdown?: string;
  ttlDays?: number;
};

export type SiteLandingRow = {
  landingId: string;
  site: string;
  landedAt: string;
  receivedAt: string;
  referrerHost: string;
  referrerFullUrl: string;
  isSelfDomain: boolean;
  landingUrl: string;
  landingPath: string;
  utm: { source: string; medium: string; campaign: string; term: string; content: string };
  clickId: { type: string; valueOrHash: string; storageMode: ClickIdStorageMode };
  sessionKey: { gaSessionId: string; clientId: string; localSessionIdHash: string };
  channelClassified: string;
  sourceBreakdown: string;
  dedupeKey: string;
  duplicateCount: number;
  expiresAt: string;
};

export type SiteLandingRecordResult =
  | { stored: true; deduped: false; row: SiteLandingRow }
  | { stored: true; deduped: true; row: SiteLandingRow }
  | { stored: false; rejected: true; reason: string };

const isSelfDomain = (host: string, site: SiteKey): boolean => {
  if (!host) return true;
  const h = host.toLowerCase();
  return SELF_DOMAINS_BY_SITE[site].some((d) => h === d || h.endsWith(`.${d}`));
};

const extractHost = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
};

const extractPath = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url).pathname.slice(0, 200);
  } catch {
    return "";
  }
};

const sanitize = (raw: string | undefined | null, maxLen = 300): string => {
  if (!raw) return "";
  return String(raw).slice(0, maxLen);
};

const containsForbiddenPii = (...values: ReadonlyArray<string>): boolean =>
  values.some((v) => v && PII_FORBIDDEN_PATTERNS.some((re) => re.test(v)));

const computeDedupeKey = (input: {
  site: string;
  landingUrl: string;
  sessionKey: { gaSessionId: string; clientId: string };
  landedAt: string;
  utm: { source: string; medium: string; campaign: string };
  referrerFullUrl: string;
}): string => {
  const bucket = Math.floor(Date.parse(input.landedAt) / (10 * 60 * 1000)); // 10분 bucket
  const raw = [
    input.site,
    input.landingUrl,
    input.sessionKey.gaSessionId || input.sessionKey.clientId,
    bucket,
    input.utm.source,
    input.utm.medium,
    input.utm.campaign,
    input.referrerFullUrl,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
};

const dbRowToRow = (row: Record<string, unknown>): SiteLandingRow => ({
  landingId: String(row.landing_id),
  site: String(row.site),
  landedAt: String(row.landed_at),
  receivedAt: String(row.received_at),
  referrerHost: String(row.referrer_host ?? ""),
  referrerFullUrl: String(row.referrer_full_url ?? ""),
  isSelfDomain: Number(row.is_self_domain) === 1,
  landingUrl: String(row.landing_url ?? ""),
  landingPath: String(row.landing_path ?? ""),
  utm: {
    source: String(row.utm_source ?? ""),
    medium: String(row.utm_medium ?? ""),
    campaign: String(row.utm_campaign ?? ""),
    term: String(row.utm_term ?? ""),
    content: String(row.utm_content ?? ""),
  },
  clickId: {
    type: String(row.click_id_type ?? ""),
    valueOrHash: String(row.click_id_value_or_hash ?? ""),
    storageMode: String(row.click_id_storage_mode ?? "none") as ClickIdStorageMode,
  },
  sessionKey: {
    gaSessionId: String(row.ga_session_id ?? ""),
    clientId: String(row.client_id ?? ""),
    localSessionIdHash: String(row.local_session_id_hash ?? ""),
  },
  channelClassified: String(row.channel_classified ?? ""),
  sourceBreakdown: String(row.source_breakdown ?? ""),
  dedupeKey: String(row.dedupe_key ?? ""),
  duplicateCount: Number(row.duplicate_count) || 0,
  expiresAt: String(row.expires_at ?? ""),
});

export const bootstrapSiteLandingTable = (): void => {
  ensureTable(getCrmDb());
};

export const recordSiteLanding = (input: SiteLandingInput): SiteLandingRecordResult => {
  const db = getCrmDb();
  ensureTable(db);

  if (!input.landingUrl) {
    return { stored: false, rejected: true, reason: "missing_landing_url" };
  }

  const landingUrl = sanitize(input.landingUrl, 600);
  const referrerFullUrl = sanitize(input.referrerFullUrl, 600);
  const utmSource = sanitize(input.utm?.source, 120);
  const utmMedium = sanitize(input.utm?.medium, 120);
  const utmCampaign = sanitize(input.utm?.campaign, 200);
  const utmTerm = sanitize(input.utm?.term, 200);
  const utmContent = sanitize(input.utm?.content, 200);
  const referrerHostInput = sanitize(input.referrerHost, 200) || extractHost(referrerFullUrl);
  const landingPath = sanitize(input.landingPath, 200) || extractPath(landingUrl);
  const channelClassified = sanitize(input.channelClassified, 32) || "unknown";
  const sourceBreakdown = sanitize(input.sourceBreakdown, 120);

  if (
    containsForbiddenPii(
      landingUrl,
      referrerFullUrl,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
    )
  ) {
    return { stored: false, rejected: true, reason: "forbidden_pii_pattern" };
  }

  const clickIdType = sanitize(input.clickId?.type, 32);
  const clickIdValue = sanitize(input.clickId?.valueOrHash, 200);
  const clickIdStorageMode: ClickIdStorageMode = input.clickId?.storageMode ?? "none";
  if (clickIdStorageMode === "raw" && clickIdValue) {
    // raw click_id 는 PII 패턴 추가 검사로 안전망
    if (containsForbiddenPii(clickIdValue)) {
      return { stored: false, rejected: true, reason: "click_id_value_contains_pii_pattern" };
    }
  }

  const gaSessionId = sanitize(input.sessionKey?.gaSessionId, 120);
  const clientId = sanitize(input.sessionKey?.clientId, 120);
  const localSessionIdHash = sanitize(input.sessionKey?.localSessionIdHash, 120);

  const landedAt = input.landedAt;
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const ttlDays = Math.max(1, Math.min(input.ttlDays ?? 30, 90));
  const expiresAt = new Date(Date.parse(landedAt) + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const dedupeKey = computeDedupeKey({
    site: input.site,
    landingUrl,
    sessionKey: { gaSessionId, clientId },
    landedAt,
    utm: { source: utmSource, medium: utmMedium, campaign: utmCampaign },
    referrerFullUrl,
  });

  const existing = db
    .prepare(`SELECT * FROM ${TABLE} WHERE dedupe_key = ?`)
    .get(dedupeKey) as Record<string, unknown> | undefined;
  if (existing) {
    db.prepare(
      `UPDATE ${TABLE} SET duplicate_count = duplicate_count + 1, updated_at = ? WHERE dedupe_key = ?`,
    ).run(new Date().toISOString(), dedupeKey);
    const refreshed = db
      .prepare(`SELECT * FROM ${TABLE} WHERE dedupe_key = ?`)
      .get(dedupeKey) as Record<string, unknown>;
    return { stored: true, deduped: true, row: dbRowToRow(refreshed) };
  }

  const landingId = `sll-${randomUUID()}`;
  const now = new Date().toISOString();
  const isSelf = isSelfDomain(referrerHostInput, input.site) ? 1 : 0;

  db.prepare(
    `INSERT INTO ${TABLE}
      (landing_id, site, landed_at, received_at, referrer_host, referrer_full_url, is_self_domain,
       landing_url, landing_path, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       click_id_type, click_id_value_or_hash, click_id_storage_mode,
       ga_session_id, client_id, local_session_id_hash,
       channel_classified, source_breakdown,
       dedupe_key, duplicate_count, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(
    landingId,
    input.site,
    landedAt,
    receivedAt,
    referrerHostInput,
    referrerFullUrl,
    isSelf,
    landingUrl,
    landingPath,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    clickIdType,
    clickIdValue,
    clickIdStorageMode,
    gaSessionId,
    clientId,
    localSessionIdHash,
    channelClassified,
    sourceBreakdown,
    dedupeKey,
    expiresAt,
    now,
    now,
  );

  const row = db
    .prepare(`SELECT * FROM ${TABLE} WHERE landing_id = ?`)
    .get(landingId) as Record<string, unknown>;
  return { stored: true, deduped: false, row: dbRowToRow(row) };
};

export type SiteLandingSummary = {
  total: number;
  channel_distribution: Record<string, number>;
  source_breakdown_top10: Array<{ source: string; count: number }>;
  utm_campaign_top10: Array<{ campaign: string; source: string; medium: string; count: number }>;
  joinable_session_key_count: number;
  click_id_storage_mode_distribution: Record<ClickIdStorageMode, number>;
  pii_safety_check: { rows_scanned: number; forbidden_hits: number };
  /** gpt0508-42 작업3: dashboard 표시용 추가 derived 필드 */
  derived?: {
    source_evidence_present_rate: number;
    paid_hint_count: number;
    organic_count: number;
    direct_count: number;
    referral_count: number;
    unknown_or_hold_count: number;
    raw_click_mode_count: number;
    ttl_expiring_24h_count: number;
    external_send_count: 0;
    upload_candidate_count: 0;
    /** gpt0508-45 정정: imweb v2 API → 로컬 imweb_orders 정본 NPay 매출 (운영DB 우회) */
    npay_revenue_30d?: {
      source: "imweb_orders (imweb v2 API cached)";
      complete_count: number;
      complete_amount_krw: number;
      complete_amount_krw_korean: string;
      max_order_time: string | null;
    };
  };
};

export const summarizeSiteLanding = (
  site: SiteKey,
  windowHours = 24,
): SiteLandingSummary => {
  const db = getCrmDb();
  ensureTable(db);
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ?`)
    .get(site, sinceIso) as { n: number };

  const channelRows = db
    .prepare(
      `SELECT channel_classified AS c, COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ? GROUP BY channel_classified`,
    )
    .all(site, sinceIso) as Array<{ c: string; n: number }>;
  const channel_distribution: Record<string, number> = {};
  for (const r of channelRows) channel_distribution[r.c || "unknown"] = Number(r.n);

  const sourceRows = db
    .prepare(
      `SELECT source_breakdown AS s, COUNT(*) AS n FROM ${TABLE}
       WHERE site = ? AND landed_at >= ? AND source_breakdown != ''
       GROUP BY source_breakdown ORDER BY n DESC LIMIT 10`,
    )
    .all(site, sinceIso) as Array<{ s: string; n: number }>;
  const source_breakdown_top10 = sourceRows.map((r) => ({ source: r.s, count: Number(r.n) }));

  // gpt0508-45 정정: utm_campaign 만이 아니라 utm_source / utm_medium 도 함께 group by.
  // internal_test 판정 / 광고 채널 매칭에서 utm_source 가 필수.
  const utmRows = db
    .prepare(
      `SELECT utm_campaign AS c, utm_source AS s, utm_medium AS m, COUNT(*) AS n FROM ${TABLE}
       WHERE site = ? AND landed_at >= ? AND utm_campaign != ''
       GROUP BY utm_campaign, utm_source, utm_medium ORDER BY n DESC LIMIT 10`,
    )
    .all(site, sinceIso) as Array<{ c: string; s: string; m: string; n: number }>;
  const utm_campaign_top10 = utmRows.map((r) => ({
    campaign: r.c,
    source: r.s ?? "",
    medium: r.m ?? "",
    count: Number(r.n),
  }));

  const joinableRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ? AND (ga_session_id != '' OR client_id != '')`,
    )
    .get(site, sinceIso) as { n: number };

  const storageRows = db
    .prepare(
      `SELECT click_id_storage_mode AS m, COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ? GROUP BY click_id_storage_mode`,
    )
    .all(site, sinceIso) as Array<{ m: string; n: number }>;
  const click_id_storage_mode_distribution: Record<ClickIdStorageMode, number> = {
    hash: 0,
    raw: 0,
    none: 0,
  };
  for (const r of storageRows) {
    const k = (r.m as ClickIdStorageMode) ?? "none";
    if (k === "hash" || k === "raw" || k === "none") click_id_storage_mode_distribution[k] = Number(r.n);
  }

  const total = Number(totalRow.n);
  const paidHint =
    (channel_distribution["paid_search"] ?? 0) + (channel_distribution["paid_social"] ?? 0);
  const organic =
    (channel_distribution["organic_search"] ?? 0) + (channel_distribution["organic_social"] ?? 0);
  const direct = (channel_distribution["direct"] ?? 0) + (channel_distribution["self_internal"] ?? 0);
  const referral = channel_distribution["referral"] ?? 0;
  const unknown = channel_distribution["unknown"] ?? 0;

  // source_evidence_present_rate = referrer 또는 utm_source 또는 click_id_value_or_hash 가 한 개라도 있는 row 비율
  const evidenceRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ?
       AND (referrer_host != '' OR utm_source != '' OR click_id_value_or_hash != '')`,
    )
    .get(site, sinceIso) as { n: number };

  const ttlExpiringRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND landed_at >= ? AND expires_at <= ?`,
    )
    .get(
      site,
      sinceIso,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ) as { n: number };

  // gpt0508-45 정정: NPay 매출은 운영DB sync lag (9h) 회피, imweb v2 API → 로컬 imweb_orders 정본 사용.
  // imweb_orders 테이블이 있을 때만 (없으면 빈값). 30d 윈도우 고정.
  let npay_revenue_30d: SiteLandingSummary["derived"] extends infer D
    ? D extends { npay_revenue_30d?: infer N }
      ? N
      : never
    : never;
  try {
    const tableExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='imweb_orders'`)
      .get() as { name?: string } | undefined;
    if (tableExists?.name) {
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const npayRow = db
        .prepare(
          `SELECT COUNT(*) AS cnt, SUM(payment_amount) AS amt, MAX(order_time) AS max_t
           FROM imweb_orders
           WHERE site = ? AND pay_type = 'npay'
             AND complete_time != '' AND complete_time IS NOT NULL
             AND order_time >= ?`,
        )
        .get(site, thirtyDaysAgoIso) as { cnt: number; amt: number | null; max_t: string | null };
      const amount = Number(npayRow.amt) || 0;
      const koreanAmount = (() => {
        if (amount === 0) return "₩0";
        const eok = Math.floor(amount / 100_000_000);
        const man = Math.floor((amount % 100_000_000) / 10_000);
        const rest = amount % 10_000;
        const parts: string[] = [];
        if (eok > 0) parts.push(`${eok}억`);
        if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
        if (rest > 0 && eok === 0) parts.push(`${rest.toLocaleString("ko-KR")}`);
        return `₩${parts.join(" ")}`.trim() || `₩${amount.toLocaleString("ko-KR")}`;
      })();
      npay_revenue_30d = {
        source: "imweb_orders (imweb v2 API cached)" as const,
        complete_count: Number(npayRow.cnt),
        complete_amount_krw: amount,
        complete_amount_krw_korean: koreanAmount,
        max_order_time: npayRow.max_t,
      };
    } else {
      npay_revenue_30d = undefined as never;
    }
  } catch {
    npay_revenue_30d = undefined as never;
  }

  return {
    total,
    channel_distribution,
    source_breakdown_top10,
    utm_campaign_top10,
    joinable_session_key_count: Number(joinableRow.n),
    click_id_storage_mode_distribution,
    pii_safety_check: { rows_scanned: 0, forbidden_hits: 0 },
    derived: {
      source_evidence_present_rate:
        total > 0 ? Number((Number(evidenceRow.n) / total).toFixed(3)) : 0,
      paid_hint_count: paidHint,
      organic_count: organic,
      direct_count: direct,
      referral_count: referral,
      unknown_or_hold_count: unknown,
      raw_click_mode_count: click_id_storage_mode_distribution.raw,
      ttl_expiring_24h_count: Number(ttlExpiringRow.n),
      external_send_count: 0,
      upload_candidate_count: 0,
      ...(npay_revenue_30d ? { npay_revenue_30d } : {}),
    },
  };
};
