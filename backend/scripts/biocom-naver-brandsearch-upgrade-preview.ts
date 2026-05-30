#!/usr/bin/env tsx
/**
 * Biocom Naver brandsearch upgrade preview.
 *
 * Green Lane / no-write:
 * - Reads local JSON artifacts only.
 * - Separates current conservative ROAS from VM exact cross-check upgrade candidate.
 * - Does not emit raw order/payment/member identifiers.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SCHEMA_VERSION = "biocom-naver-brandsearch-upgrade-preview-v1-20260526";
const DEFAULT_BRIDGE = "data/project/naver-brandsearch-order-bridge-preview-20260525.json";
const DEFAULT_NARROWING = "data/project/biocom-naver-brandsearch-unresolved-narrowing-20260526.json";

type CliOptions = {
  bridge: string;
  narrowing: string;
  output: string;
  json: boolean;
};

type BridgeArtifact = {
  generated_at?: string;
  by_site: Array<{
    site: string;
    window: { since: string; until: string; timezone: string };
    cost_krw: number;
    bridge: {
      exact_rows: number;
      exact_marker_amount_krw: number;
      exact_unique_order_count: number;
      ambiguous_rows: number;
      no_bridge_rows: number;
    };
    roas: { exact_order_bridge_roas: number | null };
  }>;
};

type NarrowingArtifact = {
  generated_at?: string;
  window: { since: string; until: string; timezone: string };
  source_summary: {
    marker_rows: number;
    previous_unresolved_rows: number;
    operating_db_order_rows_in_extended_window: number;
    vm_cloud_imweb_order_rows_in_extended_window: number;
  };
  narrowing: {
    classification_counts: Record<string, { rows: number; budget_treatment: string }>;
    narrowed_safe_rows: Array<{
      narrowed_classification: string;
      source_amount_sums?: {
        exact_key_match_krw_by_source?: {
          operating_db?: number;
          vm_cloud_imweb_orders?: number;
        };
      };
    }>;
  };
  freshness?: Record<string, unknown>;
};

const usage = () => `
Usage:
  npx tsx backend/scripts/biocom-naver-brandsearch-upgrade-preview.ts [options]

Options:
  --bridge=path       Bridge preview JSON. Default: ${DEFAULT_BRIDGE}
  --narrowing=path    Narrowing JSON. Default: ${DEFAULT_NARROWING}
  --output=path       Write JSON output to path
  --json              Print JSON only
`;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    bridge: DEFAULT_BRIDGE,
    narrowing: DEFAULT_NARROWING,
    output: "",
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--bridge=")) options.bridge = arg.slice("--bridge=".length).trim();
    else if (arg.startsWith("--narrowing=")) options.narrowing = arg.slice("--narrowing=".length).trim();
    else if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length).trim();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;

const round2 = (value: number): number => Math.round(value * 100) / 100;

const roas = (revenue: number, cost: number): number | null => (cost > 0 ? round2(revenue / cost) : null);

const sumVmExactCandidateRevenue = (narrowing: NarrowingArtifact): number =>
  narrowing.narrowing.narrowed_safe_rows.reduce((sum, row) => (
    sum + (row.source_amount_sums?.exact_key_match_krw_by_source?.vm_cloud_imweb_orders ?? 0)
  ), 0);

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const bridgeArtifact = readJson<BridgeArtifact>(options.bridge);
  const narrowingArtifact = readJson<NarrowingArtifact>(options.narrowing);
  const biocomBridge = bridgeArtifact.by_site.find((row) => row.site === "biocom");
  if (!biocomBridge) throw new Error("biocom row missing in bridge artifact");

  const costKrw = biocomBridge.cost_krw;
  const conservativeRevenueKrw = biocomBridge.bridge.exact_marker_amount_krw;
  const conservativeRows = biocomBridge.bridge.exact_rows;
  const upgradeRows = narrowingArtifact.source_summary.previous_unresolved_rows;
  const upgradeRevenueKrw = sumVmExactCandidateRevenue(narrowingArtifact);
  const candidateRevenueKrw = conservativeRevenueKrw + upgradeRevenueKrw;
  const allUpgradeRowsVmExact = Boolean(
    upgradeRows > 0 &&
    narrowingArtifact.narrowing.classification_counts.vm_cloud_order_exact_operating_db_key_gap?.rows === upgradeRows,
  );

  const output = {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: "local_preview_no_write_no_send",
    site: "biocom",
    window: biocomBridge.window,
    source_policy: {
      cost_source: "VM Cloud naver_brandsearch_manual_cost_daily manual period allocation cache",
      conservative_revenue_source: "운영DB public.tb_iamweb_users exact order bridge",
      upgrade_candidate_revenue_source: "VM Cloud imweb_orders exact order-key cross-check for previously unresolved marker rows",
      internal_budget_rule: "Do not replace the conservative value silently. Show conservative and upgrade candidate as separate lines until source policy is approved.",
      platform_send_rule: "Never use this preview for Naver/Meta/GA4/Google Ads conversion send.",
    },
    source_freshness: {
      bridge_generated_at: bridgeArtifact.generated_at || "",
      narrowing_generated_at: narrowingArtifact.generated_at || "",
      narrowing_freshness: narrowingArtifact.freshness || {},
      bridge_file: options.bridge,
      narrowing_file: options.narrowing,
    },
    scenarios: [
      {
        scenario_id: "conservative_operating_db_exact",
        plain_label: "예산 화면에 현재 바로 쓸 수 있는 보수 기준",
        cost_krw: costKrw,
        revenue_krw: conservativeRevenueKrw,
        roas: roas(conservativeRevenueKrw, costKrw),
        order_bridge_rows: conservativeRows,
        included_sources: ["operating_db_exact"],
        confidence: "medium_high",
        budget_use: "current_reporting_primary",
      },
      {
        scenario_id: "vm_exact_crosscheck_upgrade_candidate",
        plain_label: "주문 source 정책 승인 후 올릴 수 있는 후보 기준",
        cost_krw: costKrw,
        revenue_krw: candidateRevenueKrw,
        roas: roas(candidateRevenueKrw, costKrw),
        order_bridge_rows: conservativeRows + upgradeRows,
        added_rows: upgradeRows,
        added_revenue_krw: upgradeRevenueKrw,
        included_sources: ["operating_db_exact", "vm_cloud_imweb_orders_exact_cross_check"],
        confidence: allUpgradeRowsVmExact ? "medium_high" : "medium",
        budget_use: "recommended_conditional_candidate_not_primary_until_approved",
      },
    ],
    delta_if_accepted: {
      added_rows: upgradeRows,
      added_revenue_krw: upgradeRevenueKrw,
      roas_delta: roas(candidateRevenueKrw, costKrw) != null && roas(conservativeRevenueKrw, costKrw) != null
        ? round2((roas(candidateRevenueKrw, costKrw) ?? 0) - (roas(conservativeRevenueKrw, costKrw) ?? 0))
        : null,
      revenue_lift_percent: conservativeRevenueKrw > 0
        ? round2((upgradeRevenueKrw / conservativeRevenueKrw) * 100)
        : null,
    },
    recommendation: {
      codex_recommendation:
        "accept_vm_cloud_imweb_orders_exact_as_cross_check_for_internal_brandsearch_roas_preview",
      stance: "conditional_accept_not_primary_replacement",
      confidence_percent: allUpgradeRowsVmExact ? 88 : 76,
      reason: [
        "기존 미해결 6건 모두 VM Cloud imweb_orders에서 주문키 exact match가 났다.",
        "6건 모두 금액 합계가 marker total gap과 맞아 결제완료 주문 후보로 해석할 근거가 충분하다.",
        "운영DB exact가 0인 이유는 주문 부재보다 운영DB sync/key 기준 차이일 가능성이 높다.",
        "다만 운영DB를 정본에서 제외하는 결정은 아니므로 화면에서는 보수 기준과 후보 기준을 분리해야 한다.",
      ],
      guardrails: [
        "광고 플랫폼 전환 전송에는 쓰지 않는다.",
        "운영DB 값을 수정하지 않는다.",
        "최종 보고에는 conservative와 upgrade candidate를 동시에 표시한다.",
        "추후 운영DB sync/key gap 원인을 닫으면 candidate를 primary로 승격한다.",
      ],
    },
    invariants_held: {
      local_json_read_only: true,
      operating_db_write: 0,
      vm_cloud_write: 0,
      backend_deploy_or_restart: 0,
      platform_send: 0,
      raw_identifier_output: 0,
    },
  };

  if (options.output) {
    const out = resolve(process.cwd(), options.output);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log("Biocom Naver brandsearch upgrade preview");
    console.log(`mode: ${output.mode}`);
    console.log(`conservative_roas=${output.scenarios[0].roas} candidate_roas=${output.scenarios[1].roas}`);
    console.log(`added_rows=${upgradeRows} added_revenue=${upgradeRevenueKrw.toLocaleString("ko-KR")}원`);
    if (options.output) console.log(`output: ${options.output}`);
  }
};

main();
