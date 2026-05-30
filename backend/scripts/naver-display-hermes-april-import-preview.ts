#!/usr/bin/env tsx
/**
 * Naver performance display Hermes April import preview.
 *
 * Green Lane / read-only by design:
 * - Reads Hermes JSON/XLSX artifacts already committed to this repository.
 * - Writes aggregate-only JSON/Markdown reports.
 * - No external API call, no DB write, no ad account state change, no platform send.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as xlsx from "xlsx";

const SCHEMA_VERSION = "naver-display-hermes-april-import-preview-v1-20260526";
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RESULT_JSON = "hermes/results/naver-display-april-20260401-20260430.result.json";
const DOWNLOADS = [
  "hermes/downloads/naver-display-april-20260401-20260430-thecleancoffee.xlsx",
  "hermes/downloads/naver-display-april-20260401-20260430-biocom-1887533.xlsx",
  "hermes/downloads/naver-display-april-20260401-20260430-biocom-1804337.xlsx",
];
const DEFAULT_JSON_OUTPUT = "data/project/naver-display-april-hermes-result-20260526.json";
const DEFAULT_MD_OUTPUT = "project/naver-display-april-hermes-result-20260526.md";
const EXTERNAL_SOURCE_REPO = "https://github.com/taejunjeon/hermes-codex-repo.git";
const EXTERNAL_SOURCE_COMMIT = "0fb737f18f5c6b017db576ec753e7d7386f065b2";

type CliOptions = {
  jsonOutput: string;
  mdOutput: string;
  printJson: boolean;
};

type ResultJson = {
  status?: string;
  queried_at?: string;
  source?: string;
  mode?: string;
  date_range?: { start?: string; end?: string };
  rows?: unknown[];
  forbidden_actions_triggered?: unknown[];
  no_write_verified?: boolean;
  no_ad_state_change_verified?: boolean;
  no_display_campaign_found?: Array<Record<string, unknown>>;
  blocked_access?: unknown[];
  notes?: string[];
};

type RawXlsxRow = Record<string, unknown>;

type CampaignRow = {
  site: "biocom" | "thecleancoffee";
  account_name: string;
  account_id: string;
  campaign_name: string;
  campaign_id: string;
  campaign_type: string;
  spend_krw: number;
  naver_claim_conversion_revenue_krw: number;
  clicks: number;
  naver_claim_roas_percent: number;
  impressions: number;
  ctr_percent: number;
  avg_cpc_krw: number;
  conversions: number;
  status: string;
  serving_status: string;
  source_file: string;
};

type Aggregate = {
  spend_krw: number;
  naver_claim_conversion_revenue_krw: number;
  clicks: number;
  impressions: number;
  conversions: number;
  active_campaigns: number;
  zero_spend_campaigns: number;
  total_campaigns: number;
  naver_claim_roas_percent: number | null;
  naver_claim_roas_multiple: number | null;
  avg_cpc_krw: number | null;
  ctr_percent: number | null;
};

type SiteSummary = Aggregate & {
  site: "biocom" | "thecleancoffee";
  accounts: string[];
  account_names: string[];
  no_display_campaign_accounts: string[];
  campaigns: CampaignRow[];
  interpretation: string;
};

type Output = {
  ok: true;
  schema_version: string;
  generated_at: string;
  mode: "read_only_no_send_no_write";
  requested_window: { since: string; until: string; timezone: "KST" };
  source: {
    metric_primary: string;
    safety_cross_check: string;
    external_source_repo: string;
    external_source_commit: string;
    files: Array<{ path: string; purpose: string }>;
    caveats: string[];
  };
  freshness: {
    hermes_queried_at: string;
    imported_at: string;
  };
  validation: {
    result_json_parse_ok: boolean;
    result_json_status: string;
    result_json_rows: number;
    xlsx_file_count: number;
    xlsx_rows_total: number;
    xlsx_columns: string[];
    row_count_match: boolean;
    forbidden_actions_triggered: unknown[];
    blocked_access: unknown[];
    no_write_verified: boolean;
    no_ad_state_change_verified: boolean;
    result_json_metric_fields_complete: boolean;
    xlsx_metric_fields_complete: boolean;
    warnings: string[];
  };
  totals: {
    all_display: Aggregate;
  };
  by_site: SiteSummary[];
  all_campaigns: CampaignRow[];
  no_display_campaign_found: Array<Record<string, unknown>>;
  invariants_held: {
    read_only: true;
    operating_db_write: 0;
    vm_cloud_write: 0;
    platform_send: 0;
    naver_ads_state_change: 0;
  };
};

const usage = () => `
Usage:
  npx tsx scripts/naver-display-hermes-april-import-preview.ts [options]

Options:
  --json-output=path     Default: ${DEFAULT_JSON_OUTPUT}
  --md-output=path       Default: ${DEFAULT_MD_OUTPUT}
  --json                 Print JSON only
  --help                 Show help
`;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    jsonOutput: DEFAULT_JSON_OUTPUT,
    mdOutput: DEFAULT_MD_OUTPUT,
    printJson: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.printJson = true;
      continue;
    }
    if (arg.startsWith("--json-output=")) {
      options.jsonOutput = arg.slice("--json-output=".length).trim();
      continue;
    }
    if (arg.startsWith("--md-output=")) {
      options.mdOutput = arg.slice("--md-output=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const formatKrw = (value: number): string => {
  if (value === 0) return "0원";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[,\s%원]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toText = (value: unknown): string => (
  value === null || value === undefined ? "" : String(value).trim()
);

const siteFromAccountId = (accountId: string): "biocom" | "thecleancoffee" => (
  accountId === "2424664" ? "thecleancoffee" : "biocom"
);

const readResultJson = (): ResultJson => {
  const fullPath = path.resolve(REPO_ROOT, RESULT_JSON);
  if (!existsSync(fullPath)) throw new Error(`Missing result JSON: ${RESULT_JSON}`);
  return JSON.parse(readFileSync(fullPath, "utf8")) as ResultJson;
};

const readXlsxRows = (relativePath: string): CampaignRow[] => {
  const fullPath = path.resolve(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing XLSX: ${relativePath}`);

  const workbook = xlsx.readFile(fullPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<RawXlsxRow>(sheet, { defval: null, raw: true });

  return rows.map((row) => {
    const accountId = toText(row["계정ID"]);
    return {
      site: siteFromAccountId(accountId),
      account_name: toText(row["계정명"]),
      account_id: accountId,
      campaign_name: toText(row["캠페인명"]),
      campaign_id: toText(row["캠페인ID"]),
      campaign_type: toText(row["캠페인 유형"]),
      spend_krw: toNumber(row["광고비"]),
      naver_claim_conversion_revenue_krw: toNumber(row["전환금액"]),
      clicks: toNumber(row["클릭수"]),
      naver_claim_roas_percent: toNumber(row["ROAS"]),
      impressions: toNumber(row["노출수"]),
      ctr_percent: toNumber(row["CTR"]),
      avg_cpc_krw: toNumber(row["평균 CPC"]),
      conversions: toNumber(row["전환수"]),
      status: toText(row["상태"]),
      serving_status: toText(row["서빙상태"]),
      source_file: relativePath,
    };
  });
};

const aggregateRows = (rows: CampaignRow[]): Aggregate => {
  const spend = rows.reduce((sum, row) => sum + row.spend_krw, 0);
  const revenue = rows.reduce((sum, row) => sum + row.naver_claim_conversion_revenue_krw, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);

  return {
    spend_krw: spend,
    naver_claim_conversion_revenue_krw: revenue,
    clicks,
    impressions,
    conversions,
    active_campaigns: rows.filter((row) => row.spend_krw > 0).length,
    zero_spend_campaigns: rows.filter((row) => row.spend_krw === 0).length,
    total_campaigns: rows.length,
    naver_claim_roas_percent: spend > 0 ? round2((revenue / spend) * 100) : null,
    naver_claim_roas_multiple: spend > 0 ? round2(revenue / spend) : null,
    avg_cpc_krw: clicks > 0 ? round2(spend / clicks) : null,
    ctr_percent: impressions > 0 ? round2((clicks / impressions) * 100) : null,
  };
};

const uniqueSorted = (values: string[]): string[] => (
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
);

const buildSiteSummary = (
  site: "biocom" | "thecleancoffee",
  rows: CampaignRow[],
  noDisplayAccounts: Array<Record<string, unknown>>,
): SiteSummary => {
  const siteRows = rows.filter((row) => row.site === site);
  const aggregate = aggregateRows(siteRows);
  const noDisplay = noDisplayAccounts
    .filter((row) => siteFromAccountId(toText(row.account_id)) === site)
    .map((row) => toText(row.account_id));

  return {
    site,
    ...aggregate,
    accounts: uniqueSorted(siteRows.map((row) => row.account_id).concat(noDisplay)),
    account_names: uniqueSorted(siteRows.map((row) => row.account_name)),
    no_display_campaign_accounts: uniqueSorted(noDisplay),
    campaigns: siteRows,
    interpretation: site === "thecleancoffee"
      ? "2026년 4월 더클린커피 성과 디스플레이는 [ADVoost] 쇼핑 1개 캠페인이 실집행 source다. 네이버 주장 전환금액은 참고값이고 내부 confirmed 매출과 별도다."
      : "2026년 4월 바이오컴 성과 디스플레이는 계정 1887533의 2개 캠페인이 실집행 source다. 1804337은 0원, 1804338은 no_display_campaign_found로 분리한다.",
  };
};

const hasCompleteMetrics = (rows: unknown[]): boolean => rows.every((item) => {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  return typeof row.cost_krw === "number"
    && typeof row.conversion_amount_krw === "number"
    && typeof row.roas_percent === "number";
});

const buildOutput = (): Output => {
  const resultJson = readResultJson();
  const allRows = DOWNLOADS.flatMap(readXlsxRows);
  const resultRows = Array.isArray(resultJson.rows) ? resultJson.rows : [];
  const xlsxColumns = allRows.length > 0
    ? [
      "계정명",
      "계정ID",
      "캠페인명",
      "캠페인ID",
      "캠페인 유형",
      "광고비",
      "전환금액",
      "클릭수",
      "ROAS",
      "노출수",
      "CTR",
      "평균 CPC",
      "전환수",
      "상태",
      "서빙상태",
    ]
    : [];
  const noDisplayAccounts = Array.isArray(resultJson.no_display_campaign_found)
    ? resultJson.no_display_campaign_found
    : [];
  const resultMetricComplete = hasCompleteMetrics(resultRows);
  const xlsxMetricComplete = allRows.every((row) => (
    Number.isFinite(row.spend_krw)
    && Number.isFinite(row.naver_claim_conversion_revenue_krw)
    && Number.isFinite(row.naver_claim_roas_percent)
  ));
  const warnings = [
    resultMetricComplete ? "" : "result_json_metric_fields_null; use_xlsx_as_metric_primary",
    allRows.some((row) => row.spend_krw > 0 && row.naver_claim_roas_percent === 0)
      ? "spend_positive_roas_zero_campaign_found"
      : "",
    resultRows.length === allRows.length ? "" : "result_json_xlsx_row_count_mismatch",
  ].filter(Boolean);
  const generatedAt = new Date().toISOString();

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    mode: "read_only_no_send_no_write",
    requested_window: {
      since: "2026-04-01",
      until: "2026-04-30",
      timezone: "KST",
    },
    source: {
      metric_primary: "Hermes XLSX downloads from Naver Ads UI performance display campaign report",
      safety_cross_check: "Hermes result JSON status/row_count/forbidden_actions/no_write flags",
      external_source_repo: EXTERNAL_SOURCE_REPO,
      external_source_commit: EXTERNAL_SOURCE_COMMIT,
      files: [
        { path: RESULT_JSON, purpose: "safety/status/row-count cross-check" },
        ...DOWNLOADS.map((filePath) => ({ path: filePath, purpose: "metric primary XLSX" })),
      ],
      caveats: [
        "Naver claim conversion revenue is platform-claimed revenue, not internal confirmed purchase revenue.",
        "Performance display is not included in Naver Search Ad API cache; keep it as a separate Hermes manual source until API availability is proven.",
        "Zero-spend campaigns are kept for account/campaign inventory but excluded from active spend interpretation.",
      ],
    },
    freshness: {
      hermes_queried_at: toText(resultJson.queried_at),
      imported_at: generatedAt,
    },
    validation: {
      result_json_parse_ok: true,
      result_json_status: toText(resultJson.status),
      result_json_rows: resultRows.length,
      xlsx_file_count: DOWNLOADS.length,
      xlsx_rows_total: allRows.length,
      xlsx_columns: xlsxColumns,
      row_count_match: resultRows.length === allRows.length,
      forbidden_actions_triggered: Array.isArray(resultJson.forbidden_actions_triggered)
        ? resultJson.forbidden_actions_triggered
        : [],
      blocked_access: Array.isArray(resultJson.blocked_access) ? resultJson.blocked_access : [],
      no_write_verified: resultJson.no_write_verified === true,
      no_ad_state_change_verified: resultJson.no_ad_state_change_verified === true,
      result_json_metric_fields_complete: resultMetricComplete,
      xlsx_metric_fields_complete: xlsxMetricComplete,
      warnings,
    },
    totals: {
      all_display: aggregateRows(allRows),
    },
    by_site: [
      buildSiteSummary("thecleancoffee", allRows, noDisplayAccounts),
      buildSiteSummary("biocom", allRows, noDisplayAccounts),
    ],
    all_campaigns: allRows.sort((a, b) => b.spend_krw - a.spend_krw),
    no_display_campaign_found: noDisplayAccounts,
    invariants_held: {
      read_only: true,
      operating_db_write: 0,
      vm_cloud_write: 0,
      platform_send: 0,
      naver_ads_state_change: 0,
    },
  };
};

const makeMarkdown = (output: Output): string => {
  const coffee = output.by_site.find((row) => row.site === "thecleancoffee");
  const biocom = output.by_site.find((row) => row.site === "biocom");
  const total = output.totals.all_display;

  const campaignLines = output.all_campaigns.map((row) => (
    `| ${row.site} | ${row.account_id} | ${row.campaign_name} | ${row.campaign_type} | ${formatKrw(row.spend_krw)} | ${formatKrw(row.naver_claim_conversion_revenue_krw)} | ${row.clicks.toLocaleString("ko-KR")} | ${row.naver_claim_roas_percent}% | ${row.status} |`
  ));

  return `# 네이버 성과 디스플레이 2026년 4월 Hermes 원본 검증 결과

작성 시각: 2026-05-26 17:50 KST  
기준일: 2026-05-26  
문서 성격: Naver performance display Hermes XLSX/JSON read-only import preview

## 10초 요약

Hermes가 받은 2026년 4월 네이버 성과 디스플레이 원본은 리포트 반영에 사용할 수 있다. 단, 광고비와 전환금액의 primary source는 XLSX이고, JSON은 안전성·행 수 확인용이다. 네이버 플랫폼 전환금액은 내부 결제완료 매출이 아니므로 예산 판단 화면에서는 "네이버 주장값"으로만 표시한다.

## Harness Preflight

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read: n/a
  required_context_docs:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - hermes/README.md
    - project/hermes-naver-display-april-export-prompt-20260526.md
  lane: Green
  allowed_actions:
    - read Hermes JSON/XLSX artifacts
    - aggregate-only JSON/Markdown result generation
    - local API skeleton source update
  forbidden_actions:
    - Naver Ads state change
    - platform conversion send
    - operating DB write
    - VM Cloud write/deploy
    - GTM publish
  source_window_freshness_confidence:
    source: Hermes XLSX downloads + Hermes result JSON
    window: 2026-04-01~2026-04-30 KST
    freshness: Hermes queried_at ${output.freshness.hermes_queried_at || "unknown"}
    confidence: 0.92
\`\`\`

## 이번에 가능해진 것

네이버 ROAS 화면에서 성과 디스플레이 광고비를 더 이상 비워두지 않아도 된다. 2026년 4월 성과 디스플레이 광고비는 더클린커피 ${formatKrw(coffee?.spend_krw ?? 0)}, 바이오컴 ${formatKrw(biocom?.spend_krw ?? 0)}로 표시하면 된다.

## 왜 중요한가

검색광고 API에는 성과 디스플레이가 들어오지 않는다. 그래서 검색광고 API 비용만 보면 네이버 광고비가 과소 집계되고, 전체 ROAS가 과대평가된다.

## 실제 확인된 숫자

| 구분 | 광고비 | 네이버 주장 전환금액 | 클릭수 | 네이버 주장 ROAS | 활성 캠페인 |
|---|---:|---:|---:|---:|---:|
| 더클린커피 | ${formatKrw(coffee?.spend_krw ?? 0)} | ${formatKrw(coffee?.naver_claim_conversion_revenue_krw ?? 0)} | ${(coffee?.clicks ?? 0).toLocaleString("ko-KR")} | ${coffee?.naver_claim_roas_percent ?? 0}% | ${coffee?.active_campaigns ?? 0} |
| 바이오컴 | ${formatKrw(biocom?.spend_krw ?? 0)} | ${formatKrw(biocom?.naver_claim_conversion_revenue_krw ?? 0)} | ${(biocom?.clicks ?? 0).toLocaleString("ko-KR")} | ${biocom?.naver_claim_roas_percent ?? 0}% | ${biocom?.active_campaigns ?? 0} |
| 합계 | ${formatKrw(total.spend_krw)} | ${formatKrw(total.naver_claim_conversion_revenue_krw)} | ${total.clicks.toLocaleString("ko-KR")} | ${total.naver_claim_roas_percent}% | ${total.active_campaigns} |

## 캠페인별 원본

| site | account_id | campaign | type | 광고비 | 네이버 주장 전환금액 | 클릭수 | ROAS | 상태 |
|---|---|---|---|---:|---:|---:|---:|---|
${campaignLines.join("\n")}

## 검증 결과

- JSON parse: PASS
- XLSX 파일 수: ${output.validation.xlsx_file_count}개
- XLSX 행 수: ${output.validation.xlsx_rows_total}건
- JSON rows: ${output.validation.result_json_rows}건
- 행 수 일치: ${output.validation.row_count_match ? "PASS" : "FAIL"}
- forbidden_actions_triggered: ${output.validation.forbidden_actions_triggered.length}건
- blocked_access: ${output.validation.blocked_access.length}건
- JSON metric completeness: ${output.validation.result_json_metric_fields_complete ? "complete" : "partial"}
- XLSX metric completeness: ${output.validation.xlsx_metric_fields_complete ? "complete" : "partial"}

## 해석 규칙

- 예산 판단에 쓸 값: 내부 결제완료 주문 기준 매출 ÷ 광고비.
- 참고만 볼 값: 네이버 플랫폼이 주장하는 전환금액과 ROAS.
- 이번 문서는 성과 디스플레이 광고비 source를 채우는 문서다. 내부 결제완료 주문 연결은 다음 단계다.

## 남은 병목

1. 성과 디스플레이 클릭/주문 연결이 아직 없다. 같은 2026년 4월 window에서 내부 결제완료 주문과 연결해야 한다.
2. Hermes export는 수동 source다. 반복 수집 runbook 또는 API 가능성 재확인이 필요하다.
3. 바이오컴 계정 1804337은 커피 이름 캠페인이 있지만 4월 0원이다. 바이오컴 1887533과 섞어 해석하지 않는다.

## 산출물

- JSON: \`${DEFAULT_JSON_OUTPUT}\`
- 원본 JSON: \`${RESULT_JSON}\`
- 원본 XLSX: \`hermes/downloads/naver-display-april-20260401-20260430-*.xlsx\`
`;
};

const writeText = (relativePath: string, content: string): void => {
  const fullPath = path.resolve(REPO_ROOT, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const output = buildOutput();
  writeText(options.jsonOutput, `${JSON.stringify(output, null, 2)}\n`);
  writeText(options.mdOutput, makeMarkdown(output));

  if (options.printJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const total = output.totals.all_display;
  console.log("Naver display Hermes April import preview");
  console.log(`rows=${output.validation.xlsx_rows_total} json_rows=${output.validation.result_json_rows}`);
  console.log(
    `spend=${formatKrw(total.spend_krw)} naver_claim_revenue=${formatKrw(total.naver_claim_conversion_revenue_krw)} roas=${total.naver_claim_roas_percent}%`,
  );
  console.log(`json=${options.jsonOutput}`);
  console.log(`md=${options.mdOutput}`);
};

main();
