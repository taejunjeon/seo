import path from "node:path";
import Database from "better-sqlite3";

type Args = {
  dbPath: string;
  start: string;
  end: string;
  source: string;
  limit: number;
  json: boolean;
};

type LedgerRow = {
  entry_id: string;
  logged_at: string;
  approved_at: string;
  order_id: string;
  payment_key: string;
  landing: string;
  gclid: string;
  source: string;
  payment_status: string | null;
  metadata_json: string;
  request_context_json: string;
};

type Candidate = {
  site: "biocom";
  source: string;
  order_id: string;
  payment_key: string;
  conversion_time: string;
  value: number;
  currency: "KRW";
  payment_method: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  gad_campaignid: string;
  send_candidate: false;
  would_be_eligible_after_approval: boolean;
  block_reasons: string[];
  source_entry_id: string;
  source_logged_at: string;
};

const parseArgs = (): Args => {
  const cwd = path.resolve(__dirname, "..");
  const get = (name: string) =>
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  const start = get("start") ?? "2026-04-01";
  const end = get("end") ?? "2026-05-03";
  const limit = Number(get("limit") ?? "1000");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("--start and --end must be YYYY-MM-DD");
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("--limit must be a positive number");
  }

  return {
    dbPath: path.resolve(get("db") ?? path.join(cwd, "data", "crm.sqlite3")),
    start,
    end,
    source: get("source") ?? "biocom_imweb",
    limit,
    json: process.argv.includes("--json"),
  };
};

const safeJson = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const stringFrom = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const numberFrom = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const nestedRecord = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = obj[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const pickUrlParam = (urlText: string, key: string): string => {
  if (!urlText) return "";
  const candidates = [urlText];
  try {
    candidates.push(decodeURIComponent(urlText));
  } catch {
    // ignore malformed percent encoding
  }
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const value = url.searchParams.get(key);
      if (value) return value.trim();
    } catch {
      const match = candidate.match(new RegExp(`[?&]${key}=([^&#]+)`));
      if (match?.[1]) {
        try {
          return decodeURIComponent(match[1]).trim();
        } catch {
          return match[1].trim();
        }
      }
    }
  }
  return "";
};

const extractFromAllText = (row: LedgerRow, metadata: Record<string, unknown>, key: string): string => {
  const firstTouch = nestedRecord(metadata, "firstTouch");
  const direct =
    stringFrom(row[key as keyof LedgerRow]) ||
    stringFrom(metadata[key]) ||
    stringFrom(firstTouch[key]);
  if (direct) return direct;

  const text = [row.landing, row.metadata_json, row.request_context_json].join(" ");
  return pickUrlParam(text, key);
};

const classifyPaymentMethod = (metadata: Record<string, unknown>): string => {
  const channel = stringFrom(metadata.channel).toLowerCase();
  const paymentMethod = stringFrom(metadata.paymentMethod || metadata.payment_method).toLowerCase();
  const referrerPayment = nestedRecord(metadata, "referrerPayment");
  const combined = [channel, paymentMethod, stringFrom(referrerPayment.payType), stringFrom(referrerPayment.paymentMethod)]
    .join(" ")
    .toLowerCase();
  if (/naver|npay|네이버/.test(combined)) return "npay";
  if (/card/.test(combined)) return "card";
  if (/vbank|virtual/.test(combined)) return "vbank";
  if (/bank/.test(combined)) return "bank";
  return combined.trim() || "unknown";
};

const buildCandidate = (row: LedgerRow, duplicateSeen: Set<string>): Candidate => {
  const metadata = safeJson(row.metadata_json);
  const referrerPayment = nestedRecord(metadata, "referrerPayment");
  const orderId = row.order_id || stringFrom(referrerPayment.orderNo) || stringFrom(referrerPayment.orderId);
  const paymentKey = row.payment_key || stringFrom(referrerPayment.paymentKey);
  const value =
    numberFrom(metadata.totalAmount) ||
    numberFrom(referrerPayment.amount) ||
    numberFrom(metadata.amount);
  const conversionTime = row.approved_at || row.logged_at;
  const gclid = extractFromAllText(row, metadata, "gclid");
  const gbraid = extractFromAllText(row, metadata, "gbraid");
  const wbraid = extractFromAllText(row, metadata, "wbraid");
  const gadCampaignId = extractFromAllText(row, metadata, "gad_campaignid");
  const dedupeKey = paymentKey || orderId;

  const blockReasons = ["read_only_phase", "approval_required"];
  if (!orderId && !paymentKey) blockReasons.push("missing_order_id");
  if (!conversionTime) blockReasons.push("missing_conversion_time");
  if (value <= 0) blockReasons.push("invalid_value");
  if (!gclid && !gbraid && !wbraid) blockReasons.push("missing_google_click_id");
  if (dedupeKey && duplicateSeen.has(dedupeKey)) blockReasons.push("duplicate_order");
  if (dedupeKey) duplicateSeen.add(dedupeKey);

  const wouldBeEligibleAfterApproval = blockReasons.every((reason) =>
    ["read_only_phase", "approval_required"].includes(reason),
  );

  return {
    site: "biocom",
    source: row.source,
    order_id: orderId,
    payment_key: paymentKey,
    conversion_time: conversionTime,
    value: Math.round(value),
    currency: "KRW",
    payment_method: classifyPaymentMethod(metadata),
    gclid,
    gbraid,
    wbraid,
    gad_campaignid: gadCampaignId,
    send_candidate: false,
    would_be_eligible_after_approval: wouldBeEligibleAfterApproval,
    block_reasons: blockReasons,
    source_entry_id: row.entry_id,
    source_logged_at: row.logged_at,
  };
};

const countBy = (items: string[]) => {
  const map = new Map<string, number>();
  for (const item of items) map.set(item || "(empty)", (map.get(item || "(empty)") ?? 0) + 1);
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
};

const main = () => {
  const args = parseArgs();
  const db = new Database(args.dbPath, { readonly: true, fileMustExist: true });

  const rows = db
    .prepare(`
      SELECT
        entry_id, logged_at, approved_at, order_id, payment_key, landing, gclid,
        source, payment_status, metadata_json, request_context_json
      FROM attribution_ledger
      WHERE touchpoint = 'payment_success'
        AND payment_status = 'confirmed'
        AND source = @source
        AND datetime(logged_at) >= datetime(@start)
        AND datetime(logged_at) < datetime(@end, '+1 day')
      ORDER BY logged_at ASC
      LIMIT @limit
    `)
    .all({ source: args.source, start: args.start, end: args.end, limit: args.limit }) as LedgerRow[];

  const sourceFreshness = db
    .prepare(`
      SELECT MIN(logged_at) AS min_logged_at, MAX(logged_at) AS max_logged_at, COUNT(*) AS total_rows
      FROM attribution_ledger
      WHERE touchpoint = 'payment_success' AND source = @source
    `)
    .get({ source: args.source }) as { min_logged_at: string | null; max_logged_at: string | null; total_rows: number };

  db.close();

  const duplicateSeen = new Set<string>();
  const candidates = rows.map((row) => buildCandidate(row, duplicateSeen));
  const blockReasonCounts = countBy(candidates.flatMap((candidate) => candidate.block_reasons));
  const campaignIdCounts = countBy(candidates.map((candidate) => candidate.gad_campaignid).filter(Boolean));
  const paymentMethodCounts = countBy(candidates.map((candidate) => candidate.payment_method));

  const result = {
    generated_at: new Date().toISOString(),
    mode: "no-send/no-write local dry-run",
    source: {
      db_path: args.dbPath,
      table: "attribution_ledger",
      source: args.source,
      freshness: sourceFreshness,
      warning:
        "Local attribution ledger is a fallback/dev source. Use operational DB + Attribution VM for final Google Ads upload candidates.",
    },
    window: {
      start: args.start,
      end: args.end,
      timezone_note: "logged_at is stored as ISO timestamp; report window is an operational dry-run filter, not Google Ads attribution window.",
    },
    no_send_verified: true,
    no_write_verified: true,
    summary: {
      rows: candidates.length,
      total_value: candidates.reduce((sum, candidate) => sum + candidate.value, 0),
      with_google_click_id: candidates.filter((candidate) => candidate.gclid || candidate.gbraid || candidate.wbraid).length,
      would_be_eligible_after_approval: candidates.filter((candidate) => candidate.would_be_eligible_after_approval).length,
      block_reason_counts: blockReasonCounts,
      payment_method_counts: paymentMethodCounts,
      gad_campaignid_counts: campaignIdCounts,
    },
    sample_candidates: candidates.slice(0, 30),
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(JSON.stringify(result, null, 2));
};

main();
