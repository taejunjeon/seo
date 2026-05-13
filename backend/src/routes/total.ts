import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { Router, type Request, type Response } from "express";

const execFileAsync = promisify(execFile);

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");
const SCRIPT_TIMEOUT_MS = 90_000;
const DEFAULT_CORRECTION_SOURCE_FILE = path.resolve(
  REPO_ROOT,
  "data",
  "project",
  "total-correction-line-contract-20260513.json",
);

const parseSite = (value: unknown): "biocom" => {
  const site = typeof value === "string" && value.trim() ? value.trim() : "biocom";
  if (site !== "biocom") {
    throw new Error("Only site=biocom is supported in /api/total v0.1");
  }
  return "biocom";
};

const parseMonth = (value: unknown): string => {
  const month = typeof value === "string" && value.trim() ? value.trim() : "2026-04";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must be YYYY-MM");
  }
  return month;
};

const TSX_BIN = path.resolve(BACKEND_ROOT, "node_modules", ".bin", "tsx");

const runDryRunScript = async <T>(script: string, args: string[]): Promise<T> => {
  const nodeBinDir = path.dirname(process.execPath);
  const mergedPath = [nodeBinDir, process.env.PATH || ""].filter(Boolean).join(path.delimiter);
  const { stdout } = await execFileAsync(
    process.execPath,
    [TSX_BIN, script, ...args, "--json"],
    {
      cwd: BACKEND_ROOT,
      timeout: SCRIPT_TIMEOUT_MS,
      maxBuffer: 25 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: mergedPath,
        BACKGROUND_JOBS_ENABLED: "false",
        SCHEDULED_SEND_ENABLED: "false",
      },
    },
  );
  return JSON.parse(stdout) as T;
};

type SpinePayload = {
  metadata: {
    contractVersion: string;
    site: string;
    month: string;
    timezone: string;
    dateStart: string;
    dateEndExclusive: string;
    queriedAt: string;
    dryRun: boolean;
    write: boolean;
    send: boolean;
  };
  summary: {
    confirmed_net_revenue_ab: number;
    review_revenue_c: number;
    quarantine_revenue_d: number;
    toss_only_month_boundary_revenue: number;
    net_revenue_candidate_including_c: number;
  };
  joinMethods: unknown[];
};

type EvidencePayload = {
  metadata: {
    contractVersion: string;
    site: string;
    month: string;
    timezone: string;
    dateStart: string;
    dateEndExclusive: string;
    queriedAt: string;
    dryRun: boolean;
    write: boolean;
    send: boolean;
  };
  source: {
    vmSummary?: unknown;
    npayIntentMatching?: unknown;
  };
  totals: {
    ordersTotalAb: number;
    revenueTotalAb: number;
    assignedOrders: number;
    assignedRevenue: number;
    unknownOrders: number;
    unknownRevenue: number;
    primarySumMatchesRevenue: boolean;
  };
  channelSummary: Array<{
    primaryChannel: string;
    orders: number;
    revenue: number;
    confidence: Record<string, number>;
  }>;
  platformReference: {
    rows?: Array<{
      platform?: string;
      platformReference?: {
        status?: string;
        source?: string;
        queriedAt?: string | null;
        freshness?: string;
        sourceWindow?: {
          startDate?: string | null;
          endDate?: string | null;
          latestDate?: string | null;
        };
        sourceDiagnostics?: Record<string, unknown> | null;
        error?: string | null;
      };
    }>;
  };
  unknownReasons: unknown[];
  evidenceTierSummary: unknown[];
  npayIntentStatusSummary: unknown[];
  sampleRows?: unknown[];
};

type RoasSourceLineItems = {
  biocom_site_summary_30d?: {
    source?: string;
    status?: string;
    count?: number;
    amount_krw?: number;
    note?: string;
  };
  coffee_site_summary_30d?: {
    source?: string;
    db_location?: string;
    table?: string;
    status?: string;
    count?: number;
    amount_krw?: number;
    status_blank_count?: number;
    status_blank_amount_krw?: number;
    warnings?: string[];
    blank_root_cause?: string;
  };
};

type TotalCorrectionLineItem = {
  id: string;
  label: string;
  site: string;
  source: string;
  db_location: string;
  table: string;
  source_role: string;
  status: string;
  count: number | null;
  amount_krw: number | null;
  status_blank_count?: number | null;
  status_blank_amount_krw?: number | null;
  warnings: string[];
  use_for_budget_roas: string;
  included_in_budget_roas: boolean;
  freshness: string;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

type TotalCorrectionLines = {
  contract_version: "total-correction-lines-v0.1";
  generated_at: string;
  source_status: "loaded" | "missing";
  purpose: string;
  budget_roas_policy: {
    budget_roas_site: "biocom";
    budget_roas_numerator: string;
    cross_site_lines_auto_added: false;
    coffee_line_policy: string;
  };
  items: TotalCorrectionLineItem[];
};

const channelLabels: Record<string, string> = {
  paid_meta: "Meta 광고",
  paid_tiktok: "TikTok 광고",
  paid_google: "Google 광고",
  paid_naver: "Naver 광고 후보",
  npay: "NPay confirmed",
  organic_search: "자연 검색",
  influencer_non_paid: "비광고 인플루언서/공구",
  unknown: "유입 증거 없음",
  quarantine: "보류",
};

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readCorrectionLineSourceItems = (): RoasSourceLineItems | null => {
  const sourceFile = process.env.TOTAL_CORRECTION_SOURCE_FILE?.trim() || DEFAULT_CORRECTION_SOURCE_FILE;
  try {
    const parsed = JSON.parse(fs.readFileSync(sourceFile, "utf8")) as {
      source_line_items?: RoasSourceLineItems;
    };
    return parsed.source_line_items ?? null;
  } catch {
    return null;
  }
};

export const buildTotalCorrectionLines = (
  sourceLineItems: RoasSourceLineItems | null,
  generatedAt: string,
): TotalCorrectionLines => {
  const items: TotalCorrectionLineItem[] = [];

  const biocom = sourceLineItems?.biocom_site_summary_30d;
  if (biocom) {
    items.push({
      id: "biocom_npay_actual_30d",
      label: "biocom NPay actual correction",
      site: "biocom",
      source: biocom.source || "operational_db.tb_iamweb_users PAYMENT_COMPLETE",
      db_location: "운영DB PostgreSQL dashboard.public.tb_iamweb_users",
      table: "dashboard.public.tb_iamweb_users",
      source_role: "order_payment_actual_primary",
      status: biocom.status || "included",
      count: asNumberOrNull(biocom.count),
      amount_krw: asNumberOrNull(biocom.amount_krw),
      warnings: [],
      use_for_budget_roas: "included_for_biocom_google_ads_budget_roas",
      included_in_budget_roas: true,
      freshness: "source_snapshot_from_roas_gap_recompute",
      confidence: "high",
      notes: [
        biocom.note ||
          "Google Ads dashboard correction uses its own 30d operational DB PostgreSQL snapshot.",
      ],
    });
  }

  const coffee = sourceLineItems?.coffee_site_summary_30d;
  if (coffee) {
    items.push({
      id: "thecleancoffee_npay_actual_30d",
      label: "더클린커피 NPay actual correction line",
      site: "thecleancoffee",
      source: coffee.source || "imweb_v2_vm_cloud_imweb_orders",
      db_location:
        coffee.db_location || "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
      table: coffee.table || "imweb_orders",
      source_role: "cross_site_internal_actual_candidate",
      status: coffee.status || "included_with_warning",
      count: asNumberOrNull(coffee.count),
      amount_krw: asNumberOrNull(coffee.amount_krw),
      status_blank_count: asNumberOrNull(coffee.status_blank_count),
      status_blank_amount_krw: asNumberOrNull(coffee.status_blank_amount_krw),
      warnings: Array.isArray(coffee.warnings) ? coffee.warnings : [],
      use_for_budget_roas: "provisional_internal_actual_reference_only_until_campaign_site_mapping",
      included_in_budget_roas: false,
      freshness: "VM Cloud SQLite imweb_orders order sync fresh; imweb_status sync stale",
      confidence: "medium",
      notes: [
        "Do not add this line to biocom Google Ads budget ROAS until campaign/site spend mapping is proven.",
        "GA4 is an already_in_ga4 guard only, not an actual NPay revenue source.",
        `status blank root cause: ${coffee.blank_root_cause || "source_freshness_gap_status_sync_lag"}`,
      ],
    });
  }

  return {
    contract_version: "total-correction-lines-v0.1",
    generated_at: generatedAt,
    source_status: sourceLineItems ? "loaded" : "missing",
    purpose:
      "Show actual correction sources as separate site/source lines. Cross-site coffee actual is never silently added to biocom budget ROAS.",
    budget_roas_policy: {
      budget_roas_site: "biocom",
      budget_roas_numerator: "internal_with_biocom_npay_actual",
      cross_site_lines_auto_added: false,
      coffee_line_policy: "reference_only_until_campaign_site_mapping",
    },
    items,
  };
};

const buildSourceFreshness = (spine: SpinePayload, evidence: EvidencePayload) => {
  const base = [
    {
      source: "imweb_operational",
      role: "order_revenue_primary",
      status: "fresh",
      queried_at: spine.metadata.queriedAt,
      latest_observed_at: null,
      row_count: null,
      confidence: "A",
      fallback: false,
      fallback_reason: null,
    },
    {
      source: "toss_operational",
      role: "payment_cancel_primary",
      status: "fresh",
      queried_at: spine.metadata.queriedAt,
      latest_observed_at: null,
      row_count: null,
      confidence: "A",
      fallback: false,
      fallback_reason: null,
    },
    {
      source: "attribution_vm",
      role: "channel_evidence_primary",
      status: "fresh",
      queried_at: evidence.metadata.queriedAt,
      latest_observed_at: null,
      row_count: null,
      confidence: "A",
      fallback: false,
      fallback_reason: null,
      summary: evidence.source.vmSummary ?? null,
    },
    {
      source: "npay_intent",
      role: "npay_intent_matching",
      status: "blocked_or_empty",
      queried_at: evidence.metadata.queriedAt,
      latest_observed_at: null,
      row_count: null,
      confidence: "C",
      fallback: false,
      fallback_reason: "token_or_snapshot_required_when_sourceAccess_is_not_available",
      summary: evidence.source.npayIntentMatching ?? null,
    },
    {
      source: "ga4_bigquery_raw",
      role: "traffic_source_cross_check",
      status: "blocked",
      queried_at: evidence.metadata.queriedAt,
      latest_observed_at: null,
      row_count: null,
      confidence: "D",
      fallback: false,
      fallback_reason: "biocom_ga4_bigquery_raw_permission_denied",
    },
  ];

  const platformSources = (evidence.platformReference.rows || []).map((row) => {
    const ref = row.platformReference || {};
    const freshness = ref.freshness || "not_queried";
    return {
      source: `platform_${row.platform || "unknown"}`,
      role: "platform_reference",
      status: freshness,
      queried_at: ref.queriedAt ?? evidence.metadata.queriedAt,
      latest_observed_at: ref.sourceWindow?.latestDate ?? null,
      row_count: null,
      confidence: freshness === "fresh" ? "A" : freshness === "local_cache" ? "B" : "D",
      fallback: false,
      fallback_reason: ref.error ?? null,
      summary: {
        platform_status: ref.status ?? null,
        source: ref.source ?? null,
        source_window: ref.sourceWindow ?? null,
        diagnostics: ref.sourceDiagnostics ?? null,
      },
    };
  });

  return [...base, ...platformSources];
};

export const createTotalRouter = () => {
  const router = Router();

  router.get("/api/total/monthly-channel-summary", async (req: Request, res: Response) => {
    try {
      const site = parseSite(req.query.site);
      const month = parseMonth(req.query.month);
      const mode = typeof req.query.mode === "string" && req.query.mode.trim() ? req.query.mode.trim() : "dry_run";
      if (mode !== "dry_run") {
        res.status(400).json({
          ok: false,
          error: "only_dry_run_mode_supported",
        });
        return;
      }

      const args = [`--site=${site}`, `--month=${month}`];
      const [spine, evidence] = await Promise.all([
        runDryRunScript<SpinePayload>("scripts/monthly-spine-dry-run.ts", args),
        runDryRunScript<EvidencePayload>("scripts/monthly-evidence-join-dry-run.ts", args),
      ]);
      const queriedAt = new Date().toISOString();

      const response = {
        ok: true,
        metadata: {
          contract_version: "total-monthly-channel-summary-v0.2",
          site,
          month,
          timezone: evidence.metadata.timezone,
          date_start: evidence.metadata.dateStart,
          date_end_exclusive: evidence.metadata.dateEndExclusive,
          queried_at: queriedAt,
          mode,
          write: false,
          send: false,
          deploy: false,
          source_contracts: {
            spine: spine.metadata.contractVersion,
            evidence: evidence.metadata.contractVersion,
            correction_lines: "total-correction-lines-v0.1",
          },
        },
        monthly_spine: {
          confirmed_net_revenue_ab: spine.summary.confirmed_net_revenue_ab,
          review_revenue_c: spine.summary.review_revenue_c,
          quarantine_revenue_d: spine.summary.quarantine_revenue_d,
          toss_only_month_boundary_revenue: spine.summary.toss_only_month_boundary_revenue,
          net_revenue_candidate_including_c: spine.summary.net_revenue_candidate_including_c,
          primary_sum_matches_revenue: evidence.totals.primarySumMatchesRevenue,
          join_methods: spine.joinMethods,
        },
        evidence: {
          assignment_version: evidence.metadata.contractVersion,
          totals: {
            orders_total_ab: evidence.totals.ordersTotalAb,
            revenue_total_ab: evidence.totals.revenueTotalAb,
            assigned_orders: evidence.totals.assignedOrders,
            assigned_revenue: evidence.totals.assignedRevenue,
            unknown_orders: evidence.totals.unknownOrders,
            unknown_revenue: evidence.totals.unknownRevenue,
            primary_sum_matches_revenue: evidence.totals.primarySumMatchesRevenue,
          },
          channel_summary: evidence.channelSummary.map((row) => ({
            primary_channel: row.primaryChannel,
            orders: row.orders,
            revenue: row.revenue,
            confidence: row.confidence,
            share_of_confirmed_revenue:
              evidence.totals.revenueTotalAb > 0 ? row.revenue / evidence.totals.revenueTotalAb : null,
            display_label: channelLabels[row.primaryChannel] ?? row.primaryChannel,
          })),
          unknown_reasons: evidence.unknownReasons,
          evidence_tier_summary: evidence.evidenceTierSummary,
          npay_intent_status_summary: evidence.npayIntentStatusSummary,
        },
        platform_reference: evidence.platformReference,
        correction_lines: buildTotalCorrectionLines(readCorrectionLineSourceItems(), queriedAt),
        source_freshness: buildSourceFreshness(spine, evidence),
        frontend_copy: {
          headline: `${month} ${site} 내부 확정 순매출은 ${spine.summary.confirmed_net_revenue_ab.toLocaleString("ko-KR")}원입니다.`,
          subtext: "이 금액은 아임웹 주문과 토스 결제/취소를 맞춘 내부 장부 기준입니다.",
          warnings: [
            "플랫폼 ROAS는 참고값이며 내부 confirmed revenue에 합산하지 않습니다.",
            "NPay intent source가 연결되기 전까지 NPay confirmed 주문의 matched/unmatched 분포는 보류입니다.",
            "GA4 BigQuery raw 권한이 열리기 전까지 GA4 traffic source 교차검증은 제한됩니다.",
          ],
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "monthly channel summary failed",
      });
    }
  });

  return router;
};
