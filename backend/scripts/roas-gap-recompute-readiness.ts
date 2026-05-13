import fs from "node:fs";
import path from "node:path";

type Args = {
  roasInput: string;
  coffeeMonitorInput: string;
  correctionContractInput: string;
  output?: string;
};

const repoRoot = path.resolve(__dirname, "..", "..");

const defaults: Args = {
  roasInput: path.join(repoRoot, "data/project/roas-gap-recompute-20260513.json"),
  coffeeMonitorInput: path.join(repoRoot, "data/project/coffee-actual-status-monitor-script-20260513.json"),
  correctionContractInput: path.join(repoRoot, "data/project/total-correction-line-contract-20260513.json"),
};

const parseArgs = (): Args => {
  const args = { ...defaults };
  for (const raw of process.argv.slice(2)) {
    const [key, value = ""] = raw.replace(/^--/, "").split("=");
    if (key === "roas-input") args.roasInput = value;
    if (key === "coffee-monitor-input") args.coffeeMonitorInput = value;
    if (key === "correction-contract-input") args.correctionContractInput = value;
    if (key === "output") args.output = value;
  }
  return args;
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const kstNow = (): string =>
  new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

type RoasSummary = {
  window: "last_7d" | "last_30d" | string;
  platform_claim: { cost_krw: number; conversion_value_krw: number; roas: number };
  internal_current: { confirmed_revenue_krw: number; roas: number };
  internal_with_biocom_npay_actual: {
    npay_count: number;
    npay_revenue_krw: number;
    confirmed_revenue_krw: number;
    roas: number;
  };
  cross_site_with_coffee_actual_overlay: {
    use_for_google_ads_budget_roas: boolean;
    coffee_count: number;
    coffee_revenue_krw: number;
    combined_reference_roas: number;
  };
  verdict: {
    remaining_gap_after_budget_value_roas_points: number;
    interpretation: string;
  };
};

const main = () => {
  const args = parseArgs();
  const roas = readJson<{ summaries: RoasSummary[]; source_line_items?: unknown }>(args.roasInput);
  const coffee = readJson<Record<string, unknown>>(args.coffeeMonitorInput);
  const correction = readJson<Record<string, unknown>>(args.correctionContractInput);
  const summaries = (roas.summaries || []).filter((row) =>
    ["last_7d", "last_30d"].includes(row.window),
  );

  const output = {
    ok: summaries.length === 2,
    generated_at_kst: kstNow(),
    lane: "Green read-only readiness; no upload/send/write/deploy",
    source_window_freshness_confidence: {
      source: {
        platform_claim: "Google Ads dashboard API read-only cached evidence",
        biocom_actual: "운영DB PostgreSQL dashboard.public.tb_iamweb_users PAYMENT_COMPLETE snapshot via dashboard correction",
        coffee_actual: "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders monitor",
      },
      window: "last_7d and last_30d for ROAS; coffee latest 30d monitor for cross-site reference",
      freshness: {
        roas_input: args.roasInput,
        coffee_checked_at_kst: coffee.checked_at_kst,
        coffee_max_order_time: coffee.max_order_time,
        coffee_max_synced_at: coffee.max_synced_at,
        coffee_max_status_synced_at: coffee.max_status_synced_at,
      },
      confidence: 0.88,
    },
    ready_windows: summaries.map((summary) => ({
      window: summary.window,
      platform_roas_reference: summary.platform_claim.roas,
      platform_cost_krw: summary.platform_claim.cost_krw,
      platform_conversion_value_krw: summary.platform_claim.conversion_value_krw,
      internal_current_roas: summary.internal_current.roas,
      internal_with_biocom_npay_actual_roas: summary.internal_with_biocom_npay_actual.roas,
      remaining_gap_after_budget_value_roas_points:
        summary.verdict.remaining_gap_after_budget_value_roas_points,
      coffee_overlay_is_budget_roas: summary.cross_site_with_coffee_actual_overlay.use_for_google_ads_budget_roas,
      coffee_overlay_reference_roas: summary.cross_site_with_coffee_actual_overlay.combined_reference_roas,
    })),
    latest_coffee_monitor: {
      actual_count: coffee.actual_count,
      actual_amount: coffee.actual_amount,
      status_blank_count: coffee.status_blank_count,
      status_blank_amount: coffee.status_blank_amount,
      status_sync_lag_hours: coffee.status_sync_lag_hours,
      warnings: coffee.warnings,
    },
    next_recompute_inputs_needed: [
      "fresh Google Ads dashboard last_7d and last_30d read-only snapshots",
      "fresh biocom NPay actual correction from 운영DB PostgreSQL PAYMENT_COMPLETE",
      "fresh coffee actual monitor from VM Cloud SQLite imweb_orders",
      "same-window internal confirmed revenue and ad spend",
      "campaign/site spend mapping before coffee can be used for budget ROAS",
    ],
    recommended_next_command: [
      "curl -sS 'http://localhost:7020/api/google-ads/dashboard?date_preset=last_7d'",
      "curl -sS 'http://localhost:7020/api/google-ads/dashboard?date_preset=last_30d'",
      "cd backend && npx tsx scripts/coffee-actual-status-monitor.ts --output=../data/project/coffee-actual-status-monitor-script-YYYYMMDD.json",
    ],
    correction_contract_snapshot: {
      file: args.correctionContractInput,
      generated_at_kst: correction.generated_at_kst,
    },
    no_send: true,
    no_write: true,
    raw_identifier_output: false,
  };

  const body = `${JSON.stringify(output, null, 2)}\n`;
  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, body, "utf8");
  }
  process.stdout.write(body);
};

main();
