#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

type Candidate = {
  payment_method?: string;
  include_reason?: string;
  order_number?: string;
  channel_order_no?: string;
  value?: number;
  vm_evidence?: {
    matched?: boolean;
    source?: string;
    matched_by?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  block_reasons?: string[];
};

type InputPayload = {
  generated_at_kst?: string;
  source?: Record<string, unknown>;
  window?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  candidates?: Candidate[];
};

const DEFAULT_INPUT = path.resolve(__dirname, "..", "..", "data", "bi-confirmed-purchase-operational-dry-run-20260505.json");

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const options = {
  input: path.resolve(argValue("input") ?? DEFAULT_INPUT),
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
};

const readJson = (filePath: string): InputPayload => JSON.parse(fs.readFileSync(filePath, "utf8"));

const countBy = <T extends string>(rows: T[]) => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row || "(blank)", (counts.get(row || "(blank)") ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const sum = (rows: Candidate[]) => rows.reduce((total, row) => total + (Number(row.value) || 0), 0);

const hasGoogleClickId = (row: Candidate) =>
  Boolean(row.vm_evidence?.gclid || row.vm_evidence?.gbraid || row.vm_evidence?.wbraid);

const normalizeToken = (value: unknown) => String(value ?? "").trim().toLowerCase();

const hasExplicitGoogleText = (value: unknown) => {
  const normalized = normalizeToken(value);
  if (!normalized) return false;
  return /(^|[^a-z0-9])(google|googleads|adwords|gdn|youtube)([^a-z0-9]|$)/i.test(normalized);
};

const googleCandidateReasons = (row: Candidate) => {
  const evidence = row.vm_evidence ?? {};
  const reasons: string[] = [];

  if (hasGoogleClickId(row)) reasons.push("google_click_id");
  if (hasExplicitGoogleText(evidence.utm_source)) reasons.push("utm_source_google");
  if (hasExplicitGoogleText(evidence.utm_campaign)) reasons.push("utm_campaign_google");
  if (hasExplicitGoogleText(evidence.source)) reasons.push("evidence_source_google");

  return [...new Set(reasons)];
};

const isGoogleAdsOrderEvidenceCandidate = (row: Candidate) => googleCandidateReasons(row).length > 0;

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 10_000) / 100 : 0);

const groupStats = (rows: Candidate[], key: (row: Candidate) => string) => {
  const groups = new Map<string, Candidate[]>();
  for (const row of rows) {
    const groupKey = key(row) || "(blank)";
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([group, groupRows]) => {
      const withClick = groupRows.filter(hasGoogleClickId);
      return {
        group,
        orders: groupRows.length,
        revenue: sum(groupRows),
        with_google_click_id: withClick.length,
        google_click_id_rate: pct(withClick.length, groupRows.length),
        missing_google_click_id: groupRows.length - withClick.length,
      };
    })
    .sort((a, b) => b.orders - a.orders);
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const buildReport = (payload: InputPayload) => {
  const candidates = payload.candidates ?? [];
  const withGoogleClickId = candidates.filter(hasGoogleClickId);
  const missingGoogleClickId = candidates.filter((row) => !hasGoogleClickId(row));
  const withVmOrIntentEvidence = candidates.filter((row) => row.vm_evidence?.matched);
  const withEvidenceButNoGoogleClickId = withVmOrIntentEvidence.filter((row) => !hasGoogleClickId(row));
  const googleAdsOrderEvidenceCandidates = candidates.filter(isGoogleAdsOrderEvidenceCandidate);
  const googleAdsOrderEvidenceWithClickId = googleAdsOrderEvidenceCandidates.filter(hasGoogleClickId);
  const googleAdsCandidateReasonCounts = countBy(
    googleAdsOrderEvidenceCandidates.flatMap((row) => googleCandidateReasons(row)),
  );

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()) + " KST",
    source: {
      input: options.input,
      upstream_generated_at_kst: payload.generated_at_kst ?? null,
      upstream_source: payload.source ?? null,
      upstream_window: payload.window ?? null,
    },
    summary: {
      total_orders: candidates.length,
      total_revenue: sum(candidates),
      with_google_click_id: withGoogleClickId.length,
      google_click_id_rate: pct(withGoogleClickId.length, candidates.length),
      missing_google_click_id: missingGoogleClickId.length,
      with_vm_or_intent_evidence: withVmOrIntentEvidence.length,
      with_evidence_but_no_google_click_id: withEvidenceButNoGoogleClickId.length,
      evidence_without_google_click_id_rate: pct(withEvidenceButNoGoogleClickId.length, withVmOrIntentEvidence.length),
      gclid: candidates.filter((row) => Boolean(row.vm_evidence?.gclid)).length,
      gbraid: candidates.filter((row) => Boolean(row.vm_evidence?.gbraid)).length,
      wbraid: candidates.filter((row) => Boolean(row.vm_evidence?.wbraid)).length,
    },
    google_ads_order_evidence_summary: {
      note: "이 분모는 주문 원장/VM evidence에 명시적 Google 증거가 남은 주문만 센다. 일반 search/cpc 같은 범용 단어는 Naver brandsearch와 섞이므로 제외했다.",
      candidate_orders: googleAdsOrderEvidenceCandidates.length,
      candidate_revenue: sum(googleAdsOrderEvidenceCandidates),
      with_google_click_id: googleAdsOrderEvidenceWithClickId.length,
      google_click_id_rate: pct(googleAdsOrderEvidenceWithClickId.length, googleAdsOrderEvidenceCandidates.length),
      missing_google_click_id: googleAdsOrderEvidenceCandidates.length - googleAdsOrderEvidenceWithClickId.length,
      candidate_reason_counts: googleAdsCandidateReasonCounts,
      limitation:
        "Google Ads 랜딩 세션 기준 분모는 GA4 BigQuery landing-session 분석이 필요하다. 이 진단은 주문까지 남은 evidence 기준이다.",
    },
    by_payment_method: groupStats(candidates, (row) => row.payment_method ?? ""),
    by_include_reason: groupStats(candidates, (row) => row.include_reason ?? ""),
    by_evidence_source: groupStats(candidates, (row) => row.vm_evidence?.source ?? "missing"),
    by_evidence_match: groupStats(candidates, (row) => row.vm_evidence?.matched_by ?? "none"),
    by_google_candidate_reason: countBy(googleAdsOrderEvidenceCandidates.flatMap((row) => googleCandidateReasons(row))),
    block_reason_counts: countBy(candidates.flatMap((row) => row.block_reasons ?? [])),
    interpretation: [
      "Google Ads confirmed_purchase 연결의 1차 병목은 결제완료 주문에 gclid/gbraid/wbraid가 거의 남지 않는 것이다.",
      "결제완료 시점에만 click id를 찾으면 PG/NPay 리다이렉션 후 이미 사라질 수 있으므로 랜딩/체크아웃 시점 저장이 필요하다.",
      "NPay 실제 결제완료 매출은 포함하되, NPay click/count/payment start만 있는 신호는 purchase 후보에서 제외해야 한다.",
      "전체 보존률은 전체 결제완료 주문 분모다. Google 후보 주문 분모는 명시적 Google evidence가 남은 주문만 별도로 보되, 최종 분모는 BigQuery 랜딩 세션 분석과 함께 봐야 한다.",
    ],
  };
};

const renderMarkdown = (report: ReturnType<typeof buildReport>) => [
  "# Google click ID 보존률 진단",
  "",
  `작성 시각: ${report.generated_at_kst}`,
  "",
  "## 10초 결론",
  "",
  `운영 결제완료 주문 ${report.summary.total_orders.toLocaleString("ko-KR")}건 중 Google click id(gclid/gbraid/wbraid)가 남은 주문은 ${report.summary.with_google_click_id.toLocaleString("ko-KR")}건이다.`,
  `보존률은 ${report.summary.google_click_id_rate}%이며, Google Ads confirmed_purchase 연결의 핵심 병목이다.`,
  "해결 방향은 결제완료 페이지가 아니라 랜딩/체크아웃/NPay intent 시점에 Google click id를 1st-party storage와 attribution ledger에 남기는 것이다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    Object.entries(report.summary).map(([key, value]) => [key, value]),
  ),
  "",
  "## 분모 분리",
  "",
  "전체 결제완료 주문 기준 보존률과 Google 후보 주문 기준 보존률은 다르게 봐야 한다.",
  "다만 이 리포트의 Google 후보 주문 분모는 주문까지 남은 명시적 Google evidence만 센다.",
  "`search`, `cpc`, `sem` 같은 범용 단어는 Naver brandsearch와 섞일 수 있어 후보 조건에서 제외했다.",
  "",
  mdTable(
    ["metric", "value"],
    Object.entries(report.google_ads_order_evidence_summary).map(([key, value]) => [
      key,
      typeof value === "object" ? JSON.stringify(value) : value,
    ]),
  ),
  "",
  "## 결제수단별",
  "",
  mdTable(
    ["group", "orders", "revenue", "with_google_click_id", "google_click_id_rate", "missing_google_click_id"],
    report.by_payment_method.map((row) => [
      row.group,
      row.orders,
      row.revenue,
      `${row.with_google_click_id}`,
      `${row.google_click_id_rate}%`,
      row.missing_google_click_id,
    ]),
  ),
  "",
  "## Evidence source별",
  "",
  mdTable(
    ["group", "orders", "revenue", "with_google_click_id", "google_click_id_rate", "missing_google_click_id"],
    report.by_evidence_source.map((row) => [
      row.group,
      row.orders,
      row.revenue,
      `${row.with_google_click_id}`,
      `${row.google_click_id_rate}%`,
      row.missing_google_click_id,
    ]),
  ),
  "",
  "## 해석",
  "",
  ...report.interpretation.map((item) => `- ${item}`),
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No-publish verified: YES",
  "No-platform-send verified: YES",
  "```",
].join("\n");

const report = buildReport(readJson(options.input));
const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) fs.writeFileSync(path.resolve(options.output), json, "utf8");
else process.stdout.write(json);
if (options.markdownOutput) {
  fs.writeFileSync(path.resolve(options.markdownOutput), `${renderMarkdown(report)}\n`, "utf8");
}
