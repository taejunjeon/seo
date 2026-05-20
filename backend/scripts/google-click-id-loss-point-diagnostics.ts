#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

type Candidate = {
  payment_method?: "homepage" | "npay" | "unknown";
  include_reason?: string;
  order_number?: string;
  channel_order_no?: string;
  conversion_time?: string;
  value?: number;
  vm_evidence?: {
    matched?: boolean;
    source?: string;
    matched_by?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    client_id?: string;
    ga_session_id?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  block_reasons?: string[];
};

type InputPayload = {
  generated_at_kst?: string;
  window?: Record<string, unknown>;
  source_freshness?: Record<string, unknown>;
  summary?: {
    operational_orders?: number;
    total_value?: number;
    with_google_click_id?: number;
    send_candidate?: number;
    include_reason_counts?: Record<string, number>;
    payment_method_counts?: Record<string, number>;
    block_reason_counts?: Record<string, number>;
    send_candidate_breakdown?: Record<string, number>;
  };
  candidates?: Candidate[];
};

type VmRow = {
  stage: "landing" | "paid_click" | "checkout" | "payment_success" | "npay_intent";
  event_at: string;
  client_id: string;
  ga_session_id: string;
  click_id_type: string;
  has_google_click_id: number;
};

type LossStage =
  | "kept_to_order"
  | "lost_between_early_session_and_order"
  | "early_session_tracked_without_click_id"
  | "order_evidence_has_no_session_key"
  | "order_evidence_without_prior_session"
  | "order_join_missing";

type ClassifiedCandidate = {
  paymentMethod: "homepage" | "npay" | "unknown";
  sourceGroup: SourceGroup;
  value: number;
  hasOrderEvidence: boolean;
  hasSessionKey: boolean;
  hasOrderClickId: boolean;
  hasPriorSessionEvidence: boolean;
  hasPriorClickId: boolean;
  stage: LossStage;
};

type SourceGroup =
  | "google_click_id_observed"
  | "google_utm_like"
  | "meta"
  | "naver"
  | "kakao"
  | "crm_or_owned"
  | "direct_or_unknown"
  | "other";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const options = {
  input: path.resolve(argValue("input") ?? path.join(REPO_ROOT, "data", "bi-confirmed-purchase-operational-dry-run-20260505.json")),
  vmDb: path.resolve(argValue("vm-db") ?? path.join(REPO_ROOT, "backend", "data", "crm.sqlite3")),
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
  lookbackDays: Math.max(1, Number(argValue("lookback-days") ?? "30")),
};

const kstNow = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(new Date()).replace(" ", " ") + " KST";

const readJson = (filePath: string): InputPayload => JSON.parse(fs.readFileSync(filePath, "utf8"));

const toText = (value: unknown) => String(value ?? "").trim();

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasOrderClickId = (row: Candidate) =>
  Boolean(row.vm_evidence?.gclid || row.vm_evidence?.gbraid || row.vm_evidence?.wbraid);

const classifySourceGroup = (row: Candidate, hasAnyPriorClickId: boolean): SourceGroup => {
  const evidence = row.vm_evidence;
  const text = [
    evidence?.source,
    evidence?.utm_source,
    evidence?.utm_medium,
    evidence?.utm_campaign,
  ].map(toText).join(" ").toLowerCase();

  if (hasOrderClickId(row) || hasAnyPriorClickId) return "google_click_id_observed";
  if (/(^|[^a-z])(google|googleads|gads|adwords|youtube|yt_|pmax|gdn|search)([^a-z]|$)|\bcpc\b|\bppc\b/.test(text)) {
    return "google_utm_like";
  }
  if (/meta|facebook|instagram|fb_|ig_|paid_social/.test(text)) return "meta";
  if (/naver|powerlink/.test(text)) return "naver";
  if (/kakao|brand-message|plus/.test(text)) return "kakao";
  if (/crm|coupon|newmember|topbanner|imweb/.test(text)) return "crm_or_owned";
  if (!text.trim()) return "direct_or_unknown";
  return "other";
};

const parseTime = (value: unknown) => {
  const raw = toText(value);
  if (!raw) return NaN;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 10000) / 100 : 0;

const sum = (rows: ClassifiedCandidate[]) => rows.reduce((total, row) => total + row.value, 0);

const readVmRows = (vmDbPath: string): VmRow[] => {
  const db = new Database(vmDbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare(`
      SELECT 'landing' AS stage,
             landed_at AS event_at,
             client_id,
             ga_session_id,
             click_id_type,
             CASE WHEN click_id_type IN ('gclid','gbraid','wbraid')
                    AND COALESCE(click_id_value_or_hash, '') != ''
                  THEN 1 ELSE 0 END AS has_google_click_id
      FROM site_landing_ledger
      WHERE site = 'biocom'
        AND (COALESCE(client_id, '') != '' OR COALESCE(ga_session_id, '') != '')
      UNION ALL
      SELECT 'paid_click' AS stage,
             captured_at AS event_at,
             client_id,
             ga_session_id,
             click_id_type,
             CASE WHEN click_id_type IN ('gclid','gbraid','wbraid')
                    AND (COALESCE(click_id_hash, '') != '' OR COALESCE(click_id_value, '') != '')
                  THEN 1 ELSE 0 END AS has_google_click_id
      FROM paid_click_intent_ledger
      WHERE site = 'biocom'
        AND (COALESCE(client_id, '') != '' OR COALESCE(ga_session_id, '') != '')
      UNION ALL
      SELECT 'checkout' AS stage,
             logged_at AS event_at,
             json_extract(request_context_json, '$.client_id') AS client_id,
             COALESCE(ga_session_id, json_extract(request_context_json, '$.ga_session_id')) AS ga_session_id,
             CASE
               WHEN COALESCE(NULLIF(gclid, ''), NULLIF(json_extract(metadata_json, '$.gclid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gclid'), ''), '') != '' THEN 'gclid'
               WHEN COALESCE(NULLIF(json_extract(metadata_json, '$.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gbraid'), ''), '') != '' THEN 'gbraid'
               WHEN COALESCE(NULLIF(json_extract(metadata_json, '$.wbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.wbraid'), ''), '') != '' THEN 'wbraid'
               ELSE ''
             END AS click_id_type,
             CASE WHEN COALESCE(NULLIF(gclid, ''), NULLIF(json_extract(metadata_json, '$.gclid'), ''), NULLIF(json_extract(metadata_json, '$.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.wbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gclid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.wbraid'), ''), '') != ''
                  THEN 1 ELSE 0 END AS has_google_click_id
      FROM attribution_ledger
      WHERE source = 'biocom_imweb'
        AND touchpoint IN ('checkout_started','payment_page_seen','marketing_intent')
        AND (COALESCE(json_extract(request_context_json, '$.client_id'), '') != ''
          OR COALESCE(ga_session_id, json_extract(request_context_json, '$.ga_session_id'), '') != '')
      UNION ALL
      SELECT 'payment_success' AS stage,
             logged_at AS event_at,
             json_extract(request_context_json, '$.client_id') AS client_id,
             COALESCE(ga_session_id, json_extract(request_context_json, '$.ga_session_id')) AS ga_session_id,
             CASE
               WHEN COALESCE(NULLIF(gclid, ''), NULLIF(json_extract(metadata_json, '$.gclid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gclid'), ''), '') != '' THEN 'gclid'
               WHEN COALESCE(NULLIF(json_extract(metadata_json, '$.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gbraid'), ''), '') != '' THEN 'gbraid'
               WHEN COALESCE(NULLIF(json_extract(metadata_json, '$.wbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.wbraid'), ''), '') != '' THEN 'wbraid'
               ELSE ''
             END AS click_id_type,
             CASE WHEN COALESCE(NULLIF(gclid, ''), NULLIF(json_extract(metadata_json, '$.gclid'), ''), NULLIF(json_extract(metadata_json, '$.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.wbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gclid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.gbraid'), ''), NULLIF(json_extract(metadata_json, '$.firstTouch.wbraid'), ''), '') != ''
                  THEN 1 ELSE 0 END AS has_google_click_id
      FROM attribution_ledger
      WHERE source = 'biocom_imweb'
        AND touchpoint = 'payment_success'
        AND payment_status = 'confirmed'
        AND (COALESCE(json_extract(request_context_json, '$.client_id'), '') != ''
          OR COALESCE(ga_session_id, json_extract(request_context_json, '$.ga_session_id'), '') != '')
      UNION ALL
      SELECT 'npay_intent' AS stage,
             captured_at AS event_at,
             client_id,
             ga_session_id,
             CASE
               WHEN COALESCE(NULLIF(gclid, ''), '') != '' THEN 'gclid'
               WHEN COALESCE(NULLIF(gbraid, ''), '') != '' THEN 'gbraid'
               WHEN COALESCE(NULLIF(wbraid, ''), '') != '' THEN 'wbraid'
               ELSE ''
             END AS click_id_type,
             CASE WHEN COALESCE(NULLIF(gclid, ''), NULLIF(gbraid, ''), NULLIF(wbraid, ''), '') != '' THEN 1 ELSE 0 END AS has_google_click_id
      FROM npay_intent_log
      WHERE site = 'biocom'
        AND environment = 'live'
        AND (COALESCE(client_id, '') != '' OR COALESCE(ga_session_id, '') != '')
    `).all() as VmRow[];
    return rows.map((row) => ({
      ...row,
      client_id: toText(row.client_id),
      ga_session_id: toText(row.ga_session_id),
      click_id_type: toText(row.click_id_type),
      has_google_click_id: Number(row.has_google_click_id) || 0,
    }));
  } finally {
    db.close();
  }
};

const inLookback = (eventAt: string, conversionTime: string, lookbackDays: number) => {
  const eventMs = parseTime(eventAt);
  const conversionMs = parseTime(conversionTime);
  if (!Number.isFinite(eventMs) || !Number.isFinite(conversionMs)) return false;
  return eventMs <= conversionMs + 60 * 60 * 1000
    && eventMs >= conversionMs - lookbackDays * 24 * 60 * 60 * 1000;
};

const buildSessionIndex = (rows: VmRow[]) => {
  const byClient = new Map<string, VmRow[]>();
  const bySession = new Map<string, VmRow[]>();
  for (const row of rows) {
    if (row.client_id) byClient.set(row.client_id, [...(byClient.get(row.client_id) ?? []), row]);
    if (row.ga_session_id) bySession.set(row.ga_session_id, [...(bySession.get(row.ga_session_id) ?? []), row]);
  }
  return { byClient, bySession };
};

const priorRowsForCandidate = (
  candidate: Candidate,
  index: ReturnType<typeof buildSessionIndex>,
  lookbackDays: number,
) => {
  const clientId = toText(candidate.vm_evidence?.client_id);
  const sessionId = toText(candidate.vm_evidence?.ga_session_id);
  const conversionTime = toText(candidate.conversion_time);
  const seen = new Set<string>();
  const rows: VmRow[] = [];
  for (const row of [
    ...(clientId ? index.byClient.get(clientId) ?? [] : []),
    ...(sessionId ? index.bySession.get(sessionId) ?? [] : []),
  ]) {
    const key = `${row.stage}:${row.event_at}:${row.client_id}:${row.ga_session_id}:${row.click_id_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inLookback(row.event_at, conversionTime, lookbackDays)) rows.push(row);
  }
  return rows;
};

const classify = (
  candidate: Candidate,
  index: ReturnType<typeof buildSessionIndex>,
  lookbackDays: number,
): ClassifiedCandidate => {
  const hasOrderEvidence = Boolean(candidate.vm_evidence?.matched);
  const hasSessionKey = Boolean(candidate.vm_evidence?.client_id || candidate.vm_evidence?.ga_session_id);
  const orderClick = hasOrderClickId(candidate);
  const priorRows = hasSessionKey ? priorRowsForCandidate(candidate, index, lookbackDays) : [];
  const priorRowsBeforeOrAtOrder = priorRows.filter((row) => row.stage !== "payment_success");
  const hasPriorSessionEvidence = priorRowsBeforeOrAtOrder.length > 0;
  const hasPriorClickId = priorRowsBeforeOrAtOrder.some((row) => row.has_google_click_id === 1);
  const sourceGroup = classifySourceGroup(candidate, hasPriorClickId);
  let stage: LossStage;

  if (!hasOrderEvidence) stage = "order_join_missing";
  else if (orderClick) stage = "kept_to_order";
  else if (!hasSessionKey) stage = "order_evidence_has_no_session_key";
  else if (hasPriorClickId) stage = "lost_between_early_session_and_order";
  else if (hasPriorSessionEvidence) stage = "early_session_tracked_without_click_id";
  else stage = "order_evidence_without_prior_session";

  return {
    paymentMethod: candidate.payment_method ?? "unknown",
    sourceGroup,
    value: toNumber(candidate.value),
    hasOrderEvidence,
    hasSessionKey,
    hasOrderClickId: orderClick,
    hasPriorSessionEvidence,
    hasPriorClickId,
    stage,
  };
};

const groupRows = <K extends string>(rows: ClassifiedCandidate[], key: (row: ClassifiedCandidate) => K) => {
  const groups = new Map<K, ClassifiedCandidate[]>();
  for (const row of rows) {
    const group = key(row);
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return [...groups.entries()].map(([group, groupRows]) => ({
    group,
    orders: groupRows.length,
    revenue: Math.round(sum(groupRows)),
    share_of_orders_pct: pct(groupRows.length, rows.length),
    with_order_click_id: groupRows.filter((row) => row.hasOrderClickId).length,
    with_prior_click_id: groupRows.filter((row) => row.hasPriorClickId).length,
    with_prior_session_evidence: groupRows.filter((row) => row.hasPriorSessionEvidence).length,
  })).sort((a, b) => b.orders - a.orders);
};

const stageLabels: Record<LossStage, string> = {
  kept_to_order: "보존 성공: 주문 evidence까지 Google click id가 남음",
  lost_between_early_session_and_order: "초기 세션에는 click id가 있었지만 주문 evidence에는 없음",
  early_session_tracked_without_click_id: "초기 세션은 잡혔지만 Google click id가 없음",
  order_evidence_has_no_session_key: "주문 evidence는 있지만 세션 키가 없음",
  order_evidence_without_prior_session: "주문 evidence는 있지만 같은 세션의 이전 유입/체크아웃이 없음",
  order_join_missing: "운영DB 결제완료 주문과 VM Cloud 주문 evidence 조인 없음",
};

const buildReport = (payload: InputPayload, vmRows: VmRow[]) => {
  const candidates = payload.candidates ?? [];
  const index = buildSessionIndex(vmRows);
  const classified = candidates.map((candidate) => classify(candidate, index, options.lookbackDays));
  const stageBreakdown = groupRows(classified, (row) => row.stage);
  const paymentMethodBreakdown = groupRows(classified, (row) => row.paymentMethod);
  const sourceGroupBreakdown = groupRows(classified, (row) => row.sourceGroup);
  const googleLikeRows = classified.filter((row) =>
    row.sourceGroup === "google_click_id_observed" || row.sourceGroup === "google_utm_like",
  );
  const googleLikeStageBreakdown = groupRows(googleLikeRows, (row) => row.stage);
  const orderEvidenceRows = classified.filter((row) => row.hasOrderEvidence);
  const orderEvidenceNoClickRows = orderEvidenceRows.filter((row) => !row.hasOrderClickId);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: kstNow(),
    mode: "read_only_no_send_loss_point_diagnostics",
    harness_preflight: {
      common_harness_read: [
        "harness/common/HARNESS_GUIDELINES.md",
        "harness/common/AUTONOMY_POLICY.md",
        "harness/common/REPORTING_TEMPLATE.md",
      ],
      project_harness_read: [
        "AGENTS.md",
        "docs/agent-harness/growth-data-harness-v0.md",
        "harness/npay-recovery/README.md",
        "gdn/attribution-data-source-decision-guide-20260511.md",
        "data/!data_inventory.md",
      ],
      lane: "Green",
      allowed_actions: ["read_only_vm_cloud_sqlite", "read_only_operational_dry_run_input", "local_report_write"],
      forbidden_actions: ["operating_db_write", "vm_cloud_write", "platform_send_or_upload", "gtm_publish", "deploy_or_restart"],
      source_window_freshness_confidence: {
        source: "운영DB tb_iamweb_users no-send dry-run + VM Cloud SQLite snapshot",
        window: payload.window ?? null,
        freshness: payload.generated_at_kst ?? null,
        confidence: "medium_high",
      },
    },
    source: {
      operational_dry_run_input: options.input,
      vm_cloud_sqlite_snapshot: options.vmDb,
      upstream_generated_at_kst: payload.generated_at_kst ?? null,
      upstream_window: payload.window ?? null,
      source_freshness: payload.source_freshness ?? null,
      lookback_days: options.lookbackDays,
    },
    summary: {
      total_orders: classified.length,
      total_revenue_krw: Math.round(sum(classified)),
      vm_order_evidence_orders: orderEvidenceRows.length,
      vm_order_evidence_rate_pct: pct(orderEvidenceRows.length, classified.length),
      order_click_id_orders: classified.filter((row) => row.hasOrderClickId).length,
      order_click_id_rate_pct: pct(classified.filter((row) => row.hasOrderClickId).length, classified.length),
      order_evidence_no_click_id_orders: orderEvidenceNoClickRows.length,
      prior_session_evidence_orders: classified.filter((row) => row.hasPriorSessionEvidence).length,
      prior_google_click_id_orders: classified.filter((row) => row.hasPriorClickId).length,
      prior_click_lost_before_order_orders: classified.filter((row) => row.stage === "lost_between_early_session_and_order").length,
      google_like_orders: googleLikeRows.length,
      google_like_order_click_id_orders: googleLikeRows.filter((row) => row.hasOrderClickId).length,
      google_like_order_click_id_rate_pct: pct(googleLikeRows.filter((row) => row.hasOrderClickId).length, googleLikeRows.length),
      google_like_prior_click_id_orders: googleLikeRows.filter((row) => row.hasPriorClickId).length,
      send_candidate: payload.summary?.send_candidate ?? 0,
    },
    stage_breakdown: stageBreakdown.map((row) => ({
      ...row,
      label: stageLabels[row.group as LossStage],
    })),
    payment_method_breakdown: paymentMethodBreakdown,
    source_group_breakdown: sourceGroupBreakdown,
    google_like_stage_breakdown: googleLikeStageBreakdown.map((row) => ({
      ...row,
      label: stageLabels[row.group as LossStage],
    })),
    interpretation: {
      primary_loss_point:
        "전체 결제완료 주문에는 Meta/Naver/Kakao/직접 유입도 섞여 있다. 따라서 전체 click id 보존률은 시장 전체 숫자이고, 실제 개선 우선순위는 Google UTM 의심 주문 중 click id가 없는 묶음이다.",
      secondary_loss_point:
        "운영DB 결제완료 주문이 VM Cloud 주문 evidence와 조인되지 않는 주문도 별도 병목이다. 이 경우 payment_success 또는 NPay intent/order bridge가 주문번호까지 못 가져온 것이다.",
      upload_decision:
        "send_candidate는 0건으로 유지한다. click id 유실 지점이 닫히기 전 Google Ads conversion upload는 열면 안 된다.",
    },
    guardrails: {
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true,
      no_platform_send: true,
      raw_identifier_output: false,
    },
  };
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (report: ReturnType<typeof buildReport>) => [
  `작성 시각: ${report.generated_at_kst}`,
  "기준일: 2026-05-20",
  "문서 성격: Google Ads click id 유실 지점 read-only 진단",
  "",
  "```yaml",
  `harness_preflight: ${JSON.stringify(report.harness_preflight, null, 2)}`,
  "```",
  "",
  "# Google Ads click id 유실 지점 진단",
  "",
  "## 10초 요약",
  "",
  `결제완료 주문 ${report.summary.total_orders.toLocaleString("ko-KR")}건 중 Google click id가 주문 evidence까지 남은 주문은 ${report.summary.order_click_id_orders.toLocaleString("ko-KR")}건(${report.summary.order_click_id_rate_pct}%)이다.`,
  `다만 전체 주문에는 Meta/Naver/Kakao/직접 유입이 섞여 있어, Google UTM 의심 주문 ${report.summary.google_like_orders.toLocaleString("ko-KR")}건을 따로 봐야 한다. 이 묶음에서 주문 evidence까지 click id가 남은 주문은 ${report.summary.google_like_order_click_id_orders.toLocaleString("ko-KR")}건(${report.summary.google_like_order_click_id_rate_pct}%)이다.`,
  `따라서 다음 액션은 Google 광고 랜딩 시점 click id가 URL에서 고객 유입 장부와 결제 전 storage로 들어오는지 검증하는 것이다. Google Ads upload는 계속 0건으로 막는다.`,
  "",
  "## 핵심 숫자",
  "",
  mdTable(
    ["metric", "value"],
    Object.entries(report.summary).map(([key, value]) => [key, value]),
  ),
  "",
  "## 유실 지점별",
  "",
  mdTable(
    ["유실 지점", "orders", "share", "revenue", "주문 click id", "과거 click id", "과거 세션"],
    report.stage_breakdown.map((row) => [
      row.label,
      row.orders,
      `${row.share_of_orders_pct}%`,
      row.revenue,
      row.with_order_click_id,
      row.with_prior_click_id,
      row.with_prior_session_evidence,
    ]),
  ),
  "",
  "## 소스 그룹별",
  "",
  mdTable(
    ["source group", "orders", "share", "revenue", "주문 click id", "과거 click id", "과거 세션"],
    report.source_group_breakdown.map((row) => [
      row.group,
      row.orders,
      `${row.share_of_orders_pct}%`,
      row.revenue,
      row.with_order_click_id,
      row.with_prior_click_id,
      row.with_prior_session_evidence,
    ]),
  ),
  "",
  "## Google UTM 의심 주문만 본 유실 지점",
  "",
  mdTable(
    ["유실 지점", "orders", "share", "revenue", "주문 click id", "과거 click id", "과거 세션"],
    report.google_like_stage_breakdown.map((row) => [
      row.label,
      row.orders,
      `${row.share_of_orders_pct}%`,
      row.revenue,
      row.with_order_click_id,
      row.with_prior_click_id,
      row.with_prior_session_evidence,
    ]),
  ),
  "",
  "## 결제수단별",
  "",
  mdTable(
    ["결제수단", "orders", "share", "revenue", "주문 click id", "과거 click id", "과거 세션"],
    report.payment_method_breakdown.map((row) => [
      row.group,
      row.orders,
      `${row.share_of_orders_pct}%`,
      row.revenue,
      row.with_order_click_id,
      row.with_prior_click_id,
      row.with_prior_session_evidence,
    ]),
  ),
  "",
  "## 해석",
  "",
  `- 1차 병목: ${report.interpretation.primary_loss_point}`,
  `- 2차 병목: ${report.interpretation.secondary_loss_point}`,
  `- 업로드 판단: ${report.interpretation.upload_decision}`,
  "",
  "## Source / Window / Freshness",
  "",
  mdTable(
    ["항목", "값"],
    [
      ["source", report.source.operational_dry_run_input],
      ["vm_cloud_sqlite_snapshot", report.source.vm_cloud_sqlite_snapshot],
      ["upstream_generated_at_kst", report.source.upstream_generated_at_kst],
      ["window", JSON.stringify(report.source.upstream_window)],
      ["lookback_days", report.source.lookback_days],
      ["confidence", report.harness_preflight.source_window_freshness_confidence.confidence],
    ],
  ),
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No-publish verified: YES",
  "No-platform-send verified: YES",
  "raw order/payment/member/click id output: 0",
  "```",
].join("\n");

const report = buildReport(readJson(options.input), readVmRows(options.vmDb));
const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) fs.writeFileSync(path.resolve(options.output), json, "utf8");
if (options.markdownOutput) fs.writeFileSync(path.resolve(options.markdownOutput), `${renderMarkdown(report)}\n`, "utf8");
if (!options.output && !options.markdownOutput) process.stdout.write(json);
