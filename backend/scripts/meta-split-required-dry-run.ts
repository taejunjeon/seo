#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

type ManualDecision = "확정" | "분리" | "제외" | "보류" | "";

type ManualRow = {
  priority: string;
  target: string;
  human_name: string;
  current_judgment: string;
  final_decision: ManualDecision;
  campaign_ids: string[];
  evidence_note: string;
  decision_maker: string;
  checked_at_kst: string;
  optional_adset_id: string;
  optional_ad_id: string;
  optional_url_or_parameters: string;
  optional_memo: string;
  codex_recommendation: string;
  reference_scale: string;
  search_keywords: string;
};

type AliasSeed = {
  alias_key: string;
  status: string;
  selected_campaign_id?: string | null;
  selected_campaign_name?: string | null;
  candidate_campaign_ids?: string[];
  candidate_campaign_names?: string[];
  evidence?: {
    confirmed_orders?: number;
    confirmed_revenue?: number;
  };
  confidence?: string;
};

type AuditCandidate = {
  utmCampaign: string;
  confirmedOrders: number;
  confirmedRevenue: number;
  totalOrders?: number;
  totalRevenue?: number;
};

type DryRunRow = {
  target: string;
  final_decision: ManualDecision;
  dry_run_bucket:
    | "mapped_manual"
    | "split_required_order_level_needed"
    | "excluded_from_meta_roas"
    | "quarantine_pending"
    | "precision_loss_review";
  selected_campaign_id: string | null;
  candidate_campaign_ids: string[];
  confirmed_orders: number;
  confirmed_revenue: number;
  block_reasons: string[];
  confidence: number;
  next_action: string;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const KST_NOW = `${new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(new Date())} KST`;

const KST_DATE = KST_NOW.slice(0, 10).replaceAll("-", "");

const options = {
  workbook: path.resolve(argValue("workbook") ?? "/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx"),
  aliasSeed: path.resolve(argValue("alias-seed") ?? path.join(REPO_ROOT, "data", "meta_campaign_aliases.biocom.json")),
  audit: path.resolve(argValue("audit") ?? path.join(REPO_ROOT, "data", "meta_campaign_alias_audit.biocom.json")),
  jsonOutput: path.resolve(argValue("json-output") ?? path.join(REPO_ROOT, "data", `meta-split-required-dry-run-${KST_DATE}.json`)),
  markdownOutput: path.resolve(argValue("markdown-output") ?? path.join(REPO_ROOT, "meta", `campaign-mapping-split-required-dry-run-${KST_DATE}.md`)),
};

const splitLines = (value: unknown) =>
  String(value ?? "")
    .split(/\r?\n|,|\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeHeader = (value: unknown) => String(value ?? "").trim();

const readManualRows = (): ManualRow[] => {
  const workbook = xlsx.readFile(options.workbook);
  const sheet = workbook.Sheets["수동확인_입력"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error(`manual workbook sheet not found: ${options.workbook}`);
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows
    .map((row) => ({
      priority: String(row["우선순위"] ?? "").trim(),
      target: String(row["확인 대상(alias/랜딩)"] ?? "").trim(),
      human_name: String(row["사람이 읽는 이름"] ?? "").trim(),
      current_judgment: String(row["현재 판단"] ?? "").trim(),
      final_decision: String(row["필수_최종 결정"] ?? "").trim() as ManualDecision,
      campaign_ids: splitLines(row["필수_대상 campaign id"]),
      evidence_note: String(row["필수_근거 한 줄"] ?? "").trim(),
      decision_maker: String(row["필수_결정자"] ?? "").trim(),
      checked_at_kst: String(row["필수_확인 시각(KST)"] ?? "").trim(),
      optional_adset_id: String(row["선택_adset id"] ?? "").trim(),
      optional_ad_id: String(row["선택_ad id"] ?? "").trim(),
      optional_url_or_parameters: String(row["선택_URL 또는 URL Parameters"] ?? "").trim(),
      optional_memo: String(row["선택_메모"] ?? "").trim(),
      codex_recommendation: String(row["Codex 추천"] ?? "").trim(),
      reference_scale: String(row["참고 매출/규모"] ?? "").trim(),
      search_keywords: String(row["검색 키워드"] ?? "").trim(),
    }))
    .filter((row) => row.target);
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const hasPrecisionLoss = (ids: string[]) =>
  ids.some((id) => /^120\d{12,}0{3}$/.test(id) || /^120\d+$/.test(id) && id.length >= 15 && id.endsWith("000"));

const isAliasKey = (target: string) => /^meta_|^inpork_/.test(target);

const countBy = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const buildRow = (
  manual: ManualRow,
  seedByAlias: Map<string, AliasSeed>,
  auditByAlias: Map<string, AuditCandidate>,
): DryRunRow => {
  const seed = seedByAlias.get(manual.target);
  const audit = auditByAlias.get(manual.target);
  const confirmedOrders = seed?.evidence?.confirmed_orders ?? audit?.confirmedOrders ?? 0;
  const confirmedRevenue = seed?.evidence?.confirmed_revenue ?? audit?.confirmedRevenue ?? 0;
  const blockReasons: string[] = ["read_only_phase"];
  const precisionLoss = hasPrecisionLoss(manual.campaign_ids);
  let bucket: DryRunRow["dry_run_bucket"] = "quarantine_pending";
  let selectedCampaignId: string | null = null;
  let confidence = 0.6;
  let nextAction = "근거 부족. campaign ROAS 강제 배정 금지.";

  if (precisionLoss) {
    bucket = "precision_loss_review";
    blockReasons.push("campaign_id_precision_loss_possible");
    nextAction = "Excel에서 campaign id가 000으로 반올림/손상됐을 수 있다. Ads Manager 원본 id로 재확인.";
    confidence = 0.55;
  } else if (manual.final_decision === "확정") {
    if (manual.campaign_ids.length === 1 && isAliasKey(manual.target)) {
      bucket = "mapped_manual";
      selectedCampaignId = manual.campaign_ids[0];
      blockReasons.push("manual_confirmed");
      nextAction = "seed selected_campaign_id 반영 가능. 단 최신 order-level evidence로 사후 검산.";
      confidence = 0.88;
    } else if (!isAliasKey(manual.target)) {
      bucket = "quarantine_pending";
      blockReasons.push("not_alias_group", "order_level_or_landing_group_needed");
      nextAction = "fbclid/landing group은 alias가 아니므로 주문별 evidence 없이는 campaign 배정 금지.";
      confidence = 0.65;
    } else {
      bucket = "split_required_order_level_needed";
      blockReasons.push("multiple_campaign_ids_for_confirmed_decision");
      nextAction = "확정으로 표시됐지만 campaign id가 복수다. 주문별 id/date 기준 분리 필요.";
      confidence = 0.72;
    }
  } else if (manual.final_decision === "분리") {
    bucket = "split_required_order_level_needed";
    blockReasons.push("split_required", "order_level_campaign_evidence_required");
    nextAction = "주문별 campaign/adset/ad id, URL Parameters, 날짜 window로 mapped/still_split/quarantine 재산출.";
    confidence = 0.82;
  } else if (manual.final_decision === "제외") {
    bucket = "excluded_from_meta_roas";
    blockReasons.push("excluded_by_growth_manual", "not_meta_campaign_roas");
    nextAction = "상품군/전체 매출에는 둘 수 있으나 Meta campaign ROAS 분자에는 넣지 않는다.";
    confidence = 0.9;
  } else {
    bucket = "quarantine_pending";
    blockReasons.push("manual_decision_pending");
    nextAction = "quarantine 유지. 추가 evidence 필요.";
    confidence = 0.5;
  }

  if (!seed && isAliasKey(manual.target)) blockReasons.push("seed_missing");
  if (!audit && isAliasKey(manual.target)) blockReasons.push("audit_missing_or_stale");
  if (!manual.evidence_note) blockReasons.push("missing_manual_evidence_note");
  if (!manual.decision_maker) blockReasons.push("missing_decision_maker");
  if (!manual.checked_at_kst) blockReasons.push("missing_checked_at");

  return {
    target: manual.target,
    final_decision: manual.final_decision,
    dry_run_bucket: bucket,
    selected_campaign_id: selectedCampaignId,
    candidate_campaign_ids: manual.campaign_ids.length ? manual.campaign_ids : seed?.candidate_campaign_ids ?? [],
    confirmed_orders: confirmedOrders,
    confirmed_revenue: confirmedRevenue,
    block_reasons: Array.from(new Set(blockReasons)),
    confidence,
    next_action: nextAction,
  };
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: any) => [
  "# Meta split_required 캠페인 매핑 dry-run",
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "상태: read-only dry-run",
  "Owner: meta / campaign mapping",
  "Do not use for: Meta Ads 수정, campaign id 강제 배정, 광고 플랫폼 전송",
  "",
  "## 10초 결론",
  "",
  "그로스파트 수동 엑셀을 기준으로 campaign mapping 후보를 dry-run했다. `분리` 항목은 캠페인 ROAS에 바로 붙이지 않고 주문별 id/date/URL Parameters 증거가 생길 때까지 `split_required`로 유지한다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["manual_rows", payload.summary.manual_rows],
      ["mapped_manual", payload.summary.bucket_counts.mapped_manual ?? 0],
      ["split_required_order_level_needed", payload.summary.bucket_counts.split_required_order_level_needed ?? 0],
      ["excluded_from_meta_roas", payload.summary.bucket_counts.excluded_from_meta_roas ?? 0],
      ["precision_loss_review", payload.summary.bucket_counts.precision_loss_review ?? 0],
      ["quarantine_pending", payload.summary.bucket_counts.quarantine_pending ?? 0],
      ["split_required_revenue", payload.summary.split_required_revenue],
    ],
  ),
  "",
  "## Dry-run 결과",
  "",
  mdTable(
    ["target", "decision", "bucket", "selected_campaign", "candidate_ids", "orders", "revenue", "confidence", "block_reasons"],
    payload.rows.map((row: DryRunRow) => [
      row.target,
      row.final_decision,
      row.dry_run_bucket,
      row.selected_campaign_id ?? "",
      row.candidate_campaign_ids.join(", "),
      row.confirmed_orders,
      row.confirmed_revenue,
      row.confidence,
      row.block_reasons.join(", "),
    ]),
  ),
  "",
  "## 다음 할 일",
  "",
  "- `split_required_order_level_needed`는 최신 주문별 campaign/adset/ad id export가 있어야 실제 배정 가능하다.",
  "- `precision_loss_review`는 Excel에서 campaign id가 손상됐을 가능성이 있으므로 Ads Manager 원본 id로 재확인한다.",
  "- 이 dry-run만으로 Meta campaign ROAS 분자를 바꾸지 않는다.",
].join("\n");

const main = () => {
  const manualRows = readManualRows();
  const seeds = readJson<AliasSeed[]>(options.aliasSeed);
  const audit = readJson<{ aliasCandidates?: AuditCandidate[] }>(options.audit);
  const seedByAlias = new Map(seeds.map((row) => [row.alias_key, row]));
  const auditByAlias = new Map((audit.aliasCandidates ?? []).map((row) => [row.utmCampaign, row]));
  const rows = manualRows.map((manual) => buildRow(manual, seedByAlias, auditByAlias));
  const payload = {
    ok: true,
    generated_at: new Date().toISOString(),
    generated_at_kst: KST_NOW,
    source: {
      workbook: options.workbook,
      alias_seed: options.aliasSeed,
      audit: options.audit,
    },
    summary: {
      manual_rows: manualRows.length,
      bucket_counts: countBy(rows.map((row) => row.dry_run_bucket)),
      decision_counts: countBy(rows.map((row) => row.final_decision || "(blank)")),
      block_reason_counts: countBy(rows.flatMap((row) => row.block_reasons)),
      split_required_revenue: rows
        .filter((row) => row.dry_run_bucket === "split_required_order_level_needed")
        .reduce((sum, row) => sum + row.confirmed_revenue, 0),
    },
    rows,
  };

  fs.mkdirSync(path.dirname(options.jsonOutput), { recursive: true });
  fs.mkdirSync(path.dirname(options.markdownOutput), { recursive: true });
  fs.writeFileSync(options.jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(options.markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(payload.summary, null, 2)}\n`);
};

main();
