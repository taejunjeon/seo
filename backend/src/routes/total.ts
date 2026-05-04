import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { Router, type Request, type Response } from "express";

const execFileAsync = promisify(execFile);

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT_TIMEOUT_MS = 90_000;

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

      const response = {
        ok: true,
        metadata: {
          contract_version: "total-monthly-channel-summary-v0.1",
          site,
          month,
          timezone: evidence.metadata.timezone,
          date_start: evidence.metadata.dateStart,
          date_end_exclusive: evidence.metadata.dateEndExclusive,
          queried_at: new Date().toISOString(),
          mode,
          write: false,
          send: false,
          deploy: false,
          source_contracts: {
            spine: spine.metadata.contractVersion,
            evidence: evidence.metadata.contractVersion,
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
