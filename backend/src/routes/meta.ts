import express, { type Request, type Response } from "express";
import { env } from "../env";
import {
  buildMetaCapiDedupCandidateDetails,
  buildMetaCapiLogDiagnostics,
  classifyMetaCapiLogSegment,
  readMetaCapiSendLogs,
  sendMetaConversion,
  syncMetaConversionsFromLedger,
} from "../metaCapi";

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";
const META_DEFAULT_ACTION_REPORT_TIME = "conversion";
const META_DEFAULT_ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"] as const;
const META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING = true;

type MetaReference = {
  mode: "ads_manager_parity" | "custom_window_override";
  actionReportTime: string;
  useUnifiedAttributionSetting: boolean;
  requestedAttributionWindow: string | null;
  appliedAttributionWindows: string[] | null;
  actionValueField: string;
  purchaseRoasField: string;
  websitePurchaseRoasField: string;
  numeratorDefinition: string;
  comparisonGuidance: string;
};

type MetaAccount = {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  business_name: string;
};

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: string | null;
  lifetime_budget: string | null;
};

type MetaInsight = {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc: string;
  cpm: string;
  ctr: string;
  date_start: string;
  date_stop: string;
  actions?: Array<{ action_type: string; value: string; "1d_click"?: string; "7d_click"?: string; "28d_click"?: string; "1d_view"?: string }>;
  action_values?: Array<{ action_type: string; value: string; "1d_click"?: string; "7d_click"?: string; "28d_click"?: string; "1d_view"?: string }>;
  purchase_roas?: Array<{ action_type: string; value: string; "1d_click"?: string; "7d_click"?: string; "28d_click"?: string; "1d_view"?: string }>;
  website_purchase_roas?: Array<{ action_type: string; value: string; "1d_click"?: string; "7d_click"?: string; "28d_click"?: string; "1d_view"?: string }>;
};

type MetaCampaignCreateInput = {
  accountId: string;
  name: string;
  objective: "OUTCOME_LEADS";
  dailyBudget: number;
  status: "PAUSED";
};

type MetaCampaignCreateResult = {
  id: string;
  [key: string]: unknown;
};

const COFFEE_ACCOUNT_IDS = new Set(["act_654671961007474"]);

const getToken = (accountId?: string) => {
  if (accountId && COFFEE_ACCOUNT_IDS.has(accountId)) {
    return env.META_ADMANAGER_API_KEY_COFFEE ?? env.META_ADMANAGER_API_KEY ?? "";
  }
  return env.META_ADMANAGER_API_KEY ?? "";
};

const resolveTokenFromPath = (path: string): string => {
  const match = path.match(/^\/(act_\d+)/);
  return getToken(match?.[1]);
};

const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (body as Record<string, unknown>) ?? {};
};

const firstString = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const firstNumber = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const objectValue = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
};

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parseBooleanFlag = (value: unknown) => {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
};

const parseOptionalTimestampMs = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestampMs = Date.parse(trimmed);
  return Number.isFinite(timestampMs) ? timestampMs : Number.NaN;
};

const requestIp = (req: Request) => {
  return (
    (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0] : "")?.trim()
    || req.ip
    || ""
  );
};

const requestUserAgent = (req: Request) => {
  return typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
};

const CAMPAIGN_CREATE_WARNING = "캠페인은 PAUSED 상태로 생성됨. 광고세트와 소재는 별도 설정 필요.";

const validateCampaignCreateInput = (
  input: Record<string, unknown>,
): { ok: true; value: MetaCampaignCreateInput } | { ok: false; error: string } => {
  const accountId = firstString(input, ["accountId", "account_id"]);
  if (!accountId) return { ok: false, error: "accountId 필요" };

  const name = firstString(input, ["name"]);
  if (!name) return { ok: false, error: "name 필요" };

  const objective = firstString(input, ["objective"]).toUpperCase();
  if (objective !== "OUTCOME_LEADS") {
    return { ok: false, error: "objective는 OUTCOME_LEADS만 허용" };
  }

  const dailyBudget = firstNumber(input, ["dailyBudget", "daily_budget"]);
  if (dailyBudget === undefined) return { ok: false, error: "dailyBudget 필요" };
  if (!Number.isInteger(dailyBudget) || dailyBudget <= 0) {
    return { ok: false, error: "dailyBudget은 양의 정수여야 함" };
  }

  const status = (firstString(input, ["status"]) || "PAUSED").toUpperCase();
  if (status !== "PAUSED") {
    return { ok: false, error: "status는 PAUSED만 허용" };
  }

  return {
    ok: true,
    value: {
      accountId,
      name,
      objective: "OUTCOME_LEADS",
      dailyBudget,
      status: "PAUSED",
    },
  };
};

const buildCampaignPreview = (payload: MetaCampaignCreateInput) => ({
  accountId: payload.accountId,
  name: payload.name,
  objective: payload.objective,
  dailyBudget: payload.dailyBudget,
  status: payload.status,
  warnings: [CAMPAIGN_CREATE_WARNING],
});

const classifyCampaignCreateError = (error: string) => {
  const normalized = error.toLowerCase();

  if (
    normalized.includes("permission")
    || normalized.includes("not authorized")
    || normalized.includes("access denied")
    || normalized.includes("ads_management")
  ) {
    return { status: 403, error: "permission_error" };
  }

  if (
    normalized.includes("access token")
    || normalized.includes("oauth")
    || normalized.includes("session has expired")
  ) {
    return { status: 401, error: "auth_error" };
  }

  if (
    normalized.includes("budget")
    || normalized.includes("daily_budget")
    || normalized.includes("currency")
    || normalized.includes("amount")
  ) {
    return { status: 400, error: "budget_error" };
  }

  return { status: 502, error: "meta_api_error" };
};

type MetaApiError = {
  message: string;
  code?: number;
  error_subcode?: number;
  error_data?: string;
  fbtrace_id?: string;
  type?: string;
};

const fetchMeta = async <T>(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<{ ok: true; data: T } | { ok: false; error: string; errorDetail?: MetaApiError }> => {
  const token = resolveTokenFromPath(path);
  if (!token) return { ok: false, error: "META_ADMANAGER_API_KEY 미설정" };

  const url = new URL(`${META_GRAPH_URL}${path}`);
  url.searchParams.set("access_token", token);

  let fetchRes: globalThis.Response;
  if (method === "POST") {
    const formData = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) formData.set(k, v);
    fetchRes = await fetch(url.toString(), { method: "POST", body: formData, signal: AbortSignal.timeout(15000) });
  } else {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    fetchRes = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  }

  const body = await fetchRes.json() as Record<string, unknown>;
  if (body.error) {
    const err = body.error as MetaApiError;
    const detail: MetaApiError = {
      message: err.message ?? "Meta API error",
      code: err.code,
      error_subcode: err.error_subcode,
      error_data: err.error_data,
      fbtrace_id: err.fbtrace_id,
      type: err.type,
    };
    console.error(`[Meta API Error] ${method} ${path}`, JSON.stringify(detail));
    return { ok: false, error: err.message ?? "Meta API error", errorDetail: detail };
  }
  return { ok: true, data: body as T };
};

const ACCOUNT_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
  201: "ANY_ACTIVE",
  202: "ANY_CLOSED",
};

const buildMetaReference = (params?: {
  mode?: MetaReference["mode"];
  requestedAttributionWindow?: string | null;
  appliedAttributionWindows?: string[] | null;
}): MetaReference => {
  const mode = params?.mode ?? "ads_manager_parity";
  return {
    mode,
    actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
    useUnifiedAttributionSetting: mode === "ads_manager_parity"
      ? META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING
      : false,
    requestedAttributionWindow: params?.requestedAttributionWindow ?? null,
    appliedAttributionWindows: params?.appliedAttributionWindows ?? null,
    actionValueField: "action_values[purchase]",
    purchaseRoasField: "purchase_roas",
    websitePurchaseRoasField: "website_purchase_roas",
    numeratorDefinition: "Meta ROAS 분자는 PG 확정매출이 아니라 Meta가 광고에 귀속한 conversion value임",
    comparisonGuidance: "운영 메인값은 Attribution confirmed ROAS, Meta purchase ROAS는 platform reference로만 사용",
  };
};

export const createMetaRouter = () => {
  const router = express.Router();

  // 상태 확인
  router.get("/api/meta/status", (_req: Request, res: Response) => {
    const token = getToken();
    const coffeeToken = env.META_ADMANAGER_API_KEY_COFFEE ?? "";
    res.json({
      ok: true,
      configured: !!token,
      tokenLength: token.length,
      coffee: {
        configured: !!coffeeToken,
        tokenLength: coffeeToken.length,
        accountId: "act_654671961007474",
      },
    });
  });

  // 광고 계정 목록
  router.get("/api/meta/accounts", async (_req: Request, res: Response) => {
    try {
      const result = await fetchMeta<{ data: MetaAccount[] }>("/me/adaccounts", {
        fields: "id,name,account_status,currency,business_name",
        limit: "50",
      });
      if (!result.ok) { res.status(502).json(result); return; }

      const accounts = (result.data.data ?? []).map((a) => ({
        ...a,
        account_status_label: ACCOUNT_STATUS[a.account_status] ?? String(a.account_status),
      }));

      res.json({ ok: true, accounts });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "accounts failed" });
    }
  });

  // 특정 계정의 캠페인 목록
  router.get("/api/meta/campaigns", async (req: Request, res: Response) => {
    try {
      const accountId = (req.query.account_id as string) ?? "";
      if (!accountId) { res.status(400).json({ ok: false, error: "account_id 필요" }); return; }

      const result = await fetchMeta<{ data: MetaCampaign[] }>(`/${accountId}/campaigns`, {
        fields: "id,name,status,objective,daily_budget,lifetime_budget",
        limit: "100",
      });
      if (!result.ok) { res.status(502).json(result); return; }

      res.json({ ok: true, account_id: accountId, campaigns: result.data.data ?? [] });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "campaigns failed" });
    }
  });

  // 계정 성과 (Insights)
  router.get("/api/meta/insights", async (req: Request, res: Response) => {
    try {
      const accountId = (req.query.account_id as string) ?? "";
      if (!accountId) { res.status(400).json({ ok: false, error: "account_id 필요" }); return; }

      const datePreset = (req.query.date_preset as string) ?? "last_30d";
      const level = (req.query.level as string) ?? "campaign";
      const attrWindow = (req.query.attribution_window as string) ?? "";
      const VALID_WINDOWS = ["1d_click", "7d_click", "28d_click", "1d_view"];

      const fetchParams: Record<string, string> = {
        fields: "campaign_name,campaign_id,impressions,clicks,spend,cpc,cpm,ctr,actions,action_values,purchase_roas,website_purchase_roas",
        date_preset: datePreset,
        level,
        limit: "100",
        action_report_time: META_DEFAULT_ACTION_REPORT_TIME,
      };
      let metaReference = buildMetaReference();
      if (VALID_WINDOWS.includes(attrWindow)) {
        fetchParams.action_attribution_windows = JSON.stringify([attrWindow]);
        metaReference = buildMetaReference({
          mode: "custom_window_override",
          requestedAttributionWindow: attrWindow,
          appliedAttributionWindows: [attrWindow],
        });
      } else {
        fetchParams.use_unified_attribution_setting = "true";
      }

      const result = await fetchMeta<{ data: MetaInsight[] }>(`/${accountId}/insights`, fetchParams);
      if (!result.ok) { res.status(502).json(result); return; }

      const pickValue = (a: { value: string; "1d_click"?: string; "7d_click"?: string; "28d_click"?: string; "1d_view"?: string }): number => {
        if (attrWindow && VALID_WINDOWS.includes(attrWindow)) {
          return Number((a as Record<string, string>)[attrWindow] ?? 0);
        }
        return Number(a.value ?? 0);
      };
      const pickRoasValue = (stats: MetaInsight["purchase_roas"]): number | null => {
        const stat = stats?.find((item) => item.action_type === "purchase")
          ?? stats?.find((item) => item.action_type.includes("purchase"))
          ?? stats?.[0];
        return stat ? pickValue(stat) : null;
      };

      const rows = (result.data.data ?? []).map((r) => {
        const actions: Record<string, number> = {};
        for (const a of r.actions ?? []) actions[a.action_type] = pickValue(a as never);
        const actionValues: Record<string, number> = {};
        for (const a of r.action_values ?? []) actionValues[a.action_type] = pickValue(a as never);

        // window별 구매 건수도 함께 반환
        const purchaseAction = (r.actions ?? []).find((a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        const purchaseWindows = purchaseAction ? {
          "1d_click": Number((purchaseAction as Record<string, string>)["1d_click"] ?? 0),
          "7d_click": Number((purchaseAction as Record<string, string>)["7d_click"] ?? 0),
          "28d_click": Number((purchaseAction as Record<string, string>)["28d_click"] ?? 0),
          "1d_view": Number((purchaseAction as Record<string, string>)["1d_view"] ?? 0),
        } : null;

        return {
          campaign_name: r.campaign_name,
          campaign_id: r.campaign_id,
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          spend: Number(r.spend ?? 0),
          cpc: Number(r.cpc ?? 0),
          cpm: Number(r.cpm ?? 0),
          ctr: Number(r.ctr ?? 0),
          date_start: r.date_start,
          date_stop: r.date_stop,
          link_clicks: actions.link_click ?? 0,
          landing_page_views: actions.landing_page_view ?? 0,
          leads: actions.lead ?? actions["offsite_conversion.fb_pixel_lead"] ?? 0,
          purchases: actions.purchase ?? actions["offsite_conversion.fb_pixel_purchase"] ?? 0,
          purchase_value: actionValues.purchase ?? actionValues["offsite_conversion.fb_pixel_purchase"] ?? 0,
          purchase_roas: pickRoasValue(r.purchase_roas),
          website_purchase_roas: pickRoasValue(r.website_purchase_roas),
          purchase_windows: purchaseWindows,
        };
      });

      const summary = {
        totalImpressions: rows.reduce((s, r) => s + r.impressions, 0),
        totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
        totalSpend: rows.reduce((s, r) => s + r.spend, 0),
        avgCpc: rows.length > 0 ? rows.reduce((s, r) => s + r.spend, 0) / Math.max(rows.reduce((s, r) => s + r.clicks, 0), 1) : 0,
        totalLandingViews: rows.reduce((s, r) => s + r.landing_page_views, 0),
        totalLeads: rows.reduce((s, r) => s + r.leads, 0),
        totalPurchases: rows.reduce((s, r) => s + r.purchases, 0),
        totalPurchaseValue: rows.reduce((s, r) => s + r.purchase_value, 0),
      };

      res.json({
        ok: true,
        account_id: accountId,
        date_preset: datePreset,
        level,
        meta_reference: metaReference,
        summary,
        rows,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "insights failed" });
    }
  });

  // 일별 추이 (time_increment=1)
  router.get("/api/meta/insights/daily", async (req: Request, res: Response) => {
    try {
      const accountId = (req.query.account_id as string) ?? "";
      if (!accountId) { res.status(400).json({ ok: false, error: "account_id 필요" }); return; }

      const datePreset = (req.query.date_preset as string) ?? "last_30d";

      const result = await fetchMeta<{ data: Array<{ date_start: string; impressions: string; clicks: string; spend: string; cpc: string; cpm: string; actions?: Array<{ action_type: string; value: string }> }> }>(`/${accountId}/insights`, {
        fields: "impressions,clicks,spend,cpc,cpm,actions",
        date_preset: datePreset,
        time_increment: "1",
        limit: "90",
        action_report_time: META_DEFAULT_ACTION_REPORT_TIME,
        use_unified_attribution_setting: "true",
      });
      if (!result.ok) { res.status(502).json(result); return; }

      const rows = (result.data.data ?? []).map((r) => {
        const actions: Record<string, number> = {};
        for (const a of r.actions ?? []) actions[a.action_type] = Number(a.value);
        return {
          date: r.date_start,
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          spend: Number(r.spend ?? 0),
          cpc: Number(r.cpc ?? 0),
          cpm: Number(r.cpm ?? 0),
          landing_page_views: actions.landing_page_view ?? 0,
        };
      });

      res.json({
        ok: true,
        account_id: accountId,
        date_preset: datePreset,
        meta_reference: buildMetaReference({
          appliedAttributionWindows: [...META_DEFAULT_ATTRIBUTION_WINDOWS],
        }),
        rows,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "daily insights failed" });
    }
  });

  // 전체 사이트 요약 (3사이트 합산)
  router.get("/api/meta/overview", async (_req: Request, res: Response) => {
    try {
      const SITE_ACCOUNTS: Array<{ site: string; account_id: string }> = [
        { site: "biocom", account_id: "act_3138805896402376" },
        { site: "thecleancoffee", account_id: "act_654671961007474" },
        { site: "aibio", account_id: "act_377604674894011" },
      ];

      const results = [];
      for (const sa of SITE_ACCOUNTS) {
        const result = await fetchMeta<{ data: MetaInsight[] }>(`/${sa.account_id}/insights`, {
          fields: "impressions,clicks,spend,cpc,cpm,actions",
          date_preset: "last_30d",
          limit: "10",
          action_report_time: META_DEFAULT_ACTION_REPORT_TIME,
          use_unified_attribution_setting: "true",
        });
        if (result.ok && result.data.data?.length) {
          const r = result.data.data[0];
          const actions: Record<string, number> = {};
          for (const a of r.actions ?? []) actions[a.action_type] = Number(a.value);
          results.push({
            site: sa.site,
            account_id: sa.account_id,
            impressions: Number(r.impressions ?? 0),
            clicks: Number(r.clicks ?? 0),
            spend: Number(r.spend ?? 0),
            cpc: Number(r.cpc ?? 0),
            cpm: Number(r.cpm ?? 0),
            landing_page_views: actions.landing_page_view ?? 0,
            leads: actions.lead ?? 0,
            purchases: actions.purchase ?? 0,
          });
        } else {
          results.push({ site: sa.site, account_id: sa.account_id, impressions: 0, clicks: 0, spend: 0, cpc: 0, cpm: 0, landing_page_views: 0, leads: 0, purchases: 0 });
        }
      }

      const total = {
        impressions: results.reduce((s, r) => s + r.impressions, 0),
        clicks: results.reduce((s, r) => s + r.clicks, 0),
        spend: results.reduce((s, r) => s + r.spend, 0),
      };

      res.json({
        ok: true,
        date_preset: "last_30d",
        meta_reference: buildMetaReference({
          appliedAttributionWindows: [...META_DEFAULT_ATTRIBUTION_WINDOWS],
        }),
        sites: results,
        total,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "overview failed" });
    }
  });

  // ── 캠페인 관리 API ──

  // 캠페인 목표 헬스체크 — 목표가 잘못된 캠페인 자동 감지
  router.get("/api/meta/campaigns/health", async (req: Request, res: Response) => {
    try {
      const accountId = (req.query.account_id as string) ?? "";
      if (!accountId) { res.status(400).json({ ok: false, error: "account_id 필요" }); return; }

      // 캠페인 목록 + insights + 광고세트 동시 조회
      const [campResult, insightsResult, adsetsResult] = await Promise.all([
        fetchMeta<{ data: Array<{ id: string; name: string; objective: string; status: string; daily_budget?: string; lifetime_budget?: string }> }>(`/${accountId}/campaigns`, {
          fields: "name,objective,status,daily_budget,lifetime_budget", limit: "50",
        }),
        fetchMeta<{ data: Array<{ campaign_id: string; impressions: string; clicks: string; spend: string; ctr: string; actions?: Array<{ action_type: string; value: string }> }> }>(`/${accountId}/insights`, {
          fields: "campaign_id,impressions,clicks,spend,ctr,actions", date_preset: "last_30d", level: "campaign", limit: "50",
        }),
        fetchMeta<{ data: Array<{ id: string; campaign_id: string; name: string; optimization_goal?: string; promoted_object?: { pixel_id?: string; page_id?: string; custom_event_type?: string; application_id?: string } }> }>(`/${accountId}/adsets`, {
          fields: "campaign_id,name,optimization_goal,promoted_object", limit: "100",
        }),
      ]);
      if (!campResult.ok) { res.status(502).json(campResult); return; }

      // insights를 campaign_id로 매핑
      const insightsMap = new Map<string, { impressions: number; clicks: number; spend: number; ctr: number; leads: number; purchases: number; landingViews: number }>();
      if (insightsResult.ok) {
        for (const row of insightsResult.data.data ?? []) {
          const actions: Record<string, number> = {};
          for (const a of row.actions ?? []) actions[a.action_type] = Number(a.value);
          insightsMap.set(row.campaign_id, {
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            spend: Number(row.spend ?? 0),
            ctr: Number(row.ctr ?? 0),
            leads: actions.lead ?? actions["offsite_conversion.fb_pixel_lead"] ?? 0,
            purchases: actions.purchase ?? actions["offsite_conversion.fb_pixel_purchase"] ?? 0,
            landingViews: actions.landing_page_view ?? 0,
          });
        }
      }

      // 광고세트를 campaign_id로 그룹핑 → 추적 상태 요약
      type TrackingInfo = {
        optimizationGoal: string;
        pixelId: string | null;
        pageId: string | null;
        customEventType: string | null;
        trackingType: "website_lead" | "instant_form" | "pixel_purchase" | "landing_page" | "unknown";
        trackingLabel: string;
      };
      const trackingMap = new Map<string, TrackingInfo>();
      if (adsetsResult.ok) {
        for (const adset of adsetsResult.data.data ?? []) {
          if (trackingMap.has(adset.campaign_id)) continue; // 첫 번째 광고세트 기준
          const og = adset.optimization_goal ?? "";
          const po = adset.promoted_object;
          const pixelId = po?.pixel_id ?? null;
          const pageId = po?.page_id ?? null;
          const customEventType = po?.custom_event_type ?? null;

          let trackingType: TrackingInfo["trackingType"] = "unknown";
          let trackingLabel = "설정 없음";

          if (pixelId && customEventType === "LEAD") {
            trackingType = "website_lead";
            trackingLabel = `웹사이트 리드 (픽셀 ${pixelId.slice(-6)})`;
          } else if (pixelId && customEventType === "PURCHASE") {
            trackingType = "pixel_purchase";
            trackingLabel = `구매 전환 (픽셀 ${pixelId.slice(-6)})`;
          } else if (pixelId && !customEventType) {
            trackingType = "pixel_purchase";
            trackingLabel = `픽셀 추적 (${pixelId.slice(-6)})`;
          } else if (pageId && og === "LEAD_GENERATION") {
            trackingType = "instant_form";
            trackingLabel = `인스턴트 폼 (페이지 ${pageId.slice(-6)})`;
          } else if (pageId && !pixelId) {
            trackingType = "instant_form";
            trackingLabel = `페이지 연결 (${pageId.slice(-6)})`;
          } else if (og === "LANDING_PAGE_VIEWS") {
            trackingType = "landing_page";
            trackingLabel = "랜딩 페이지 조회 (전환 추적 없음)";
          }

          trackingMap.set(adset.campaign_id, {
            optimizationGoal: og,
            pixelId,
            pageId,
            customEventType,
            trackingType,
            trackingLabel,
          });
        }
      }

      const campaigns = (campResult.data.data ?? []).map((c) => {
        const issues: string[] = [];
        const perf = insightsMap.get(c.id);
        const tracking = trackingMap.get(c.id) ?? null;

        if (c.objective === "OUTCOME_TRAFFIC" && c.status === "ACTIVE") {
          issues.push("치명: 트래픽 목표 — Meta AI가 클릭 많은 사람에게 노출. 전환 최적화 안 됨.");
        }
        if (c.objective === "OUTCOME_TRAFFIC" && c.status === "PAUSED") {
          issues.push("트래픽 목표 일시정지. 재활성화해도 목표 변경 불가.");
        }
        if (c.status === "ACTIVE" && perf && perf.leads === 0 && perf.purchases === 0 && perf.spend > 100000) {
          issues.push("주의: 비용 " + Math.round(perf.spend).toLocaleString() + "원 지출했지만 전환 0건.");
        }
        // 추적 설정 진단
        if (c.objective === "OUTCOME_LEADS" && tracking && !tracking.pixelId && !tracking.pageId) {
          issues.push("경고: 리드 캠페인이지만 promoted_object 미설정. 전환 집계 안 될 수 있음.");
        }
        if (c.objective === "OUTCOME_LEADS" && tracking && tracking.trackingType === "landing_page") {
          issues.push("경고: 리드 캠페인이지만 최적화가 랜딩뷰로 설정됨. 리드 최적화로 변경 필요.");
        }

        // 목표별 결과 지표 분기
        let resultLabel = "전환";
        let resultValue = 0;
        let resultCost = 0;
        if (c.objective === "OUTCOME_TRAFFIC") {
          resultLabel = "랜딩뷰"; resultValue = perf?.landingViews ?? 0;
        } else if (c.objective === "OUTCOME_LEADS") {
          resultLabel = "리드"; resultValue = perf?.leads ?? 0;
        } else if (c.objective === "OUTCOME_SALES") {
          resultLabel = "구매"; resultValue = perf?.purchases ?? 0;
        }
        resultCost = resultValue > 0 && perf ? Math.round(perf.spend / resultValue) : 0;

        // 신호등
        let signal: "green" | "yellow" | "red" = "green";
        if (c.status !== "ACTIVE") signal = "yellow";
        else if (c.objective === "OUTCOME_TRAFFIC") signal = "red";
        else if (perf && perf.spend > 50000 && resultValue === 0) signal = "red";
        else if (perf && resultValue > 0) signal = "green";

        return {
          id: c.id,
          name: c.name,
          objective: c.objective,
          objectiveLabel: c.objective === "OUTCOME_TRAFFIC" ? "트래픽" : c.objective === "OUTCOME_LEADS" ? "리드" : c.objective === "OUTCOME_SALES" ? "매출" : c.objective,
          status: c.status,
          dailyBudget: c.daily_budget ? Number(c.daily_budget) : null,
          lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) : null,
          // 성과 데이터
          impressions: perf?.impressions ?? 0,
          clicks: perf?.clicks ?? 0,
          spend: perf?.spend ?? 0,
          ctr: perf?.ctr ?? 0,
          resultLabel,
          resultValue,
          resultCost,
          signal,
          issues,
          healthy: issues.length === 0,
          // 추적 상태
          tracking: tracking ? {
            optimizationGoal: tracking.optimizationGoal,
            pixelId: tracking.pixelId,
            pageId: tracking.pageId,
            customEventType: tracking.customEventType,
            trackingType: tracking.trackingType,
            trackingLabel: tracking.trackingLabel,
          } : null,
        };
      });

      const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
      const issueCount = campaigns.filter((c) => c.issues.length > 0).length;

      res.json({ ok: true, account_id: accountId, total: campaigns.length, active: activeCount, issues: issueCount, campaigns });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "campaign health failed" });
    }
  });

  // 캠페인 상세 — 광고세트 + 소재 + 타겟 + 썸네일
  router.get("/api/meta/campaigns/:campaignId/detail", async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;

      // 광고세트 조회
      const adsetResult = await fetchMeta<{ data: Array<{ id: string; name: string; status: string; targeting?: Record<string, unknown>; daily_budget?: string; optimization_goal?: string; promoted_object?: { pixel_id?: string; page_id?: string; custom_event_type?: string } }> }>(
        `/${campaignId}/adsets`, { fields: "id,name,status,targeting,daily_budget,optimization_goal,promoted_object", limit: "20" },
      );
      if (!adsetResult.ok) { res.status(502).json(adsetResult); return; }
      const adsets = adsetResult.data.data ?? [];

      // 각 광고세트의 소재 조회
      const adsetDetails = [];
      for (const as of adsets) {
        const adResult = await fetchMeta<{ data: Array<{ id: string; name: string; status: string; creative?: { id: string; thumbnail_url?: string; image_url?: string; title?: string; body?: string; object_type?: string; video_id?: string; link_url?: string; object_story_spec?: { link_data?: { link?: string; call_to_action?: { value?: { link?: string } } } } }; insights?: { data: Array<{ impressions?: string; clicks?: string; spend?: string }> } }> }>(
          `/${as.id}/ads`, { fields: "id,name,status,creative{id,thumbnail_url,image_url,title,body,object_type,video_id,link_url,object_story_spec},insights.date_preset(last_30d){impressions,clicks,spend}", limit: "20" },
        );
        const ads = (adResult.ok ? adResult.data.data : []) ?? [];

        // 타겟 정보 정리
        const targeting = as.targeting ?? {};
        const geo = targeting.geo_locations as { cities?: Array<{ name: string; radius?: number; distance_unit?: string }>; regions?: Array<{ name: string }> } | undefined;
        const geoSummary = [
          ...(geo?.cities ?? []).map((c) => `${c.name} ${c.radius ?? ""}${c.distance_unit ?? "km"}`),
          ...(geo?.regions ?? []).map((r) => r.name),
        ].join(", ") || "전체";
        const ageSummary = `${(targeting as Record<string, unknown>).age_min ?? "?"}-${(targeting as Record<string, unknown>).age_max ?? "?"}세`;

        adsetDetails.push({
          id: as.id,
          name: as.name,
          status: as.status,
          dailyBudget: as.daily_budget ? Number(as.daily_budget) : null,
          optimizationGoal: as.optimization_goal ?? null,
          promotedObject: as.promoted_object ? {
            pixelId: as.promoted_object.pixel_id ?? null,
            pageId: as.promoted_object.page_id ?? null,
            customEventType: as.promoted_object.custom_event_type ?? null,
          } : null,
          targeting: { geo: geoSummary, age: ageSummary },
          ads: ads.map((ad) => {
            const linkData = ad.creative?.object_story_spec?.link_data;
            const landingUrl = linkData?.link || linkData?.call_to_action?.value?.link || ad.creative?.link_url || null;
            const isExternalLanding = landingUrl ? !landingUrl.includes("aibio.kr") && !landingUrl.includes("biocom.kr") && !landingUrl.includes("thecleancoffee.com") : false;
            const landingDomain = landingUrl ? (() => { try { return new URL(landingUrl).hostname; } catch { return null; } })() : null;
            return {
            id: ad.id,
            name: ad.name,
            status: ad.status,
            thumbnailUrl: ad.creative?.thumbnail_url ?? null,
            imageUrl: ad.creative?.image_url ?? null,
            title: ad.creative?.title ?? null,
            body: ad.creative?.body?.slice(0, 100) ?? null,
            creativeId: ad.creative?.id ?? null,
            objectType: ad.creative?.object_type ?? null,
            landingUrl,
            landingDomain,
            isExternalLanding,
            videoId: ad.creative?.video_id ?? null,
            isVideo: ad.creative?.object_type === "VIDEO" || !!ad.creative?.video_id,
            impressions: Number(ad.insights?.data?.[0]?.impressions ?? 0),
            clicks: Number(ad.insights?.data?.[0]?.clicks ?? 0),
            spend: Number(ad.insights?.data?.[0]?.spend ?? 0),
          }; }),
        });
      }

      res.json({ ok: true, campaignId, adsets: adsetDetails });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "detail failed" });
    }
  });

  // 캠페인 생성 사전 검토
  router.post("/api/meta/campaigns/prepare", (req: Request, res: Response) => {
    const body = parseBody(req.body);
    const validation = validateCampaignCreateInput(body);
    if (!validation.ok) {
      res.status(400).json(validation);
      return;
    }

    res.json({
      ok: true,
      preview: buildCampaignPreview(validation.value),
    });
  });

  // 캠페인 생성
  router.post("/api/meta/campaigns/create", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const validation = validateCampaignCreateInput(body);
      if (!validation.ok) {
        res.status(400).json(validation);
        return;
      }

      const payload = validation.value;
      const result = await fetchMeta<MetaCampaignCreateResult>(`/${payload.accountId}/campaigns`, {
        name: payload.name,
        objective: payload.objective,
        status: payload.status,
        special_ad_categories: JSON.stringify([]),
        daily_budget: String(payload.dailyBudget),
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      }, "POST");

      if (!result.ok) {
        const classified = classifyCampaignCreateError(result.error);
        res.status(classified.status).json({
          ok: false,
          error: classified.error,
          message: result.error,
        });
        return;
      }

      res.json({
        ok: true,
        campaign_id: result.data.id,
        meta: result.data,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "campaign create failed" });
    }
  });

  // TRAFFIC 캠페인의 광고세트/소재를 새 LEADS 캠페인으로 복사
  router.post("/api/meta/campaigns/clone-as-leads", async (req: Request, res: Response) => {
    type SourceAdset = {
      id: string;
      name: string;
      targeting?: Record<string, unknown>;
      daily_budget?: string;
      billing_event?: string;
      promoted_object?: Record<string, unknown> | null;
    };
    type SourceAd = {
      id: string;
      name: string;
      status?: string;
      creative?: { id?: string } | null;
    };
    type SourceAdsetBundle = {
      adset: SourceAdset;
      ads: SourceAd[];
    };
    type CreatedCampaign = {
      id: string;
      name: string;
      objective: "OUTCOME_LEADS";
    };
    type CreatedAdset = {
      id: string;
      name: string;
      sourceAdsetId: string;
    };
    type CreatedAd = {
      id: string;
      name: string;
      creativeId: string;
      sourceAdId: string;
    };

    const partial: {
      newCampaign: CreatedCampaign | null;
      newAdsets: CreatedAdset[];
      newAds: CreatedAd[];
      summary: {
        campaignCreated: boolean;
        adsetsCreated: number;
        adsCreated: number;
        skippedPausedAds: number;
      };
    } = {
      newCampaign: null,
      newAdsets: [],
      newAds: [],
      summary: {
        campaignCreated: false,
        adsetsCreated: 0,
        adsCreated: 0,
        skippedPausedAds: 0,
      },
    };

    const respondFailure = (status: number, error: string, message: string, errorDetail?: MetaApiError) => {
      res.status(status).json({
        ok: false,
        error,
        message,
        errorDetail: errorDetail ?? null,
        newCampaign: partial.newCampaign,
        newAdsets: partial.newAdsets,
        newAds: partial.newAds,
        summary: partial.summary,
      });
    };

    try {
      const body = parseBody(req.body);
      const accountId = firstString(body, ["accountId", "account_id"]);
      const sourceCampaignId = firstString(body, ["sourceCampaignId", "source_campaign_id"]);
      const newName = firstString(body, ["newName", "new_name", "name"]);
      const dailyBudget = firstNumber(body, ["dailyBudget", "daily_budget"]);
      const copyActiveAdsOnlyRaw = body.copyActiveAdsOnly ?? body.copy_active_ads_only;
      const copyActiveAdsOnly = typeof copyActiveAdsOnlyRaw === "boolean"
        ? copyActiveAdsOnlyRaw
        : typeof copyActiveAdsOnlyRaw === "number"
          ? copyActiveAdsOnlyRaw !== 0
          : typeof copyActiveAdsOnlyRaw === "string"
            ? !["false", "0", "no"].includes(copyActiveAdsOnlyRaw.trim().toLowerCase())
            : true;

      if (!accountId) {
        respondFailure(400, "invalid_request", "accountId 필요");
        return;
      }
      if (!sourceCampaignId) {
        respondFailure(400, "invalid_request", "sourceCampaignId 필요");
        return;
      }
      if (!newName) {
        respondFailure(400, "invalid_request", "newName 필요");
        return;
      }
      if (dailyBudget === undefined) {
        respondFailure(400, "invalid_request", "dailyBudget 필요");
        return;
      }
      if (!Number.isInteger(dailyBudget) || dailyBudget <= 0) {
        respondFailure(400, "invalid_request", "dailyBudget은 양의 정수여야 함");
        return;
      }

      const sourceAdsetsResult = await fetchMeta<{ data: SourceAdset[] }>(`/${sourceCampaignId}/adsets`, {
        fields: "id,name,targeting,daily_budget,billing_event,promoted_object",
        limit: "100",
      });
      if (!sourceAdsetsResult.ok) {
        respondFailure(502, "source_adsets_fetch_failed", sourceAdsetsResult.error, sourceAdsetsResult.errorDetail);
        return;
      }

      const sourceAdsetBundles: SourceAdsetBundle[] = [];
      for (const adset of sourceAdsetsResult.data.data ?? []) {
        const sourceAdsResult = await fetchMeta<{ data: SourceAd[] }>(`/${adset.id}/ads`, {
          fields: "id,name,creative{id},status",
          limit: "100",
        });
        if (!sourceAdsResult.ok) {
          respondFailure(502, "source_ads_fetch_failed", `[${adset.id}] ${sourceAdsResult.error}`, sourceAdsResult.errorDetail);
          return;
        }

        const sourceAds = sourceAdsResult.data.data ?? [];
        if (copyActiveAdsOnly) {
          partial.summary.skippedPausedAds += sourceAds.filter((ad) => ad.status !== "ACTIVE").length;
        }

        sourceAdsetBundles.push({
          adset,
          ads: copyActiveAdsOnly ? sourceAds.filter((ad) => ad.status === "ACTIVE") : sourceAds,
        });
      }

      const newCampaignResult = await fetchMeta<MetaCampaignCreateResult>(`/${accountId}/campaigns`, {
        name: newName,
        objective: "OUTCOME_LEADS",
        status: "PAUSED",
        special_ad_categories: JSON.stringify([]),
        daily_budget: String(dailyBudget),
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      }, "POST");
      if (!newCampaignResult.ok) {
        respondFailure(502, "campaign_create_failed", newCampaignResult.error, newCampaignResult.errorDetail);
        return;
      }

      const newCampaignId = newCampaignResult.data.id;
      partial.newCampaign = {
        id: newCampaignId,
        name: newName,
        objective: "OUTCOME_LEADS",
      };
      partial.summary.campaignCreated = true;

      // 리드 타입 결정 (루프 밖에서 한 번만)
      const pageId = firstString(body, ["pageId", "page_id"]);
      const pixelId = firstString(body, ["pixelId", "pixel_id"]);
      const customEventType = firstString(body, ["customEventType", "custom_event_type"]);
      const leadType = firstString(body, ["leadType", "lead_type"]) || (pixelId ? "website" : "instant_form");

      for (const bundle of sourceAdsetBundles) {
        // 웹사이트 리드: OFFSITE_CONVERSIONS + pixel_id/custom_event_type
        // 인스턴트 폼: LEAD_GENERATION + page_id + destination_type=ON_AD
        const isWebsiteLead = leadType === "website" && pixelId;

        const createAdsetParams: Record<string, string> = {
          name: bundle.adset.name,
          campaign_id: newCampaignId,
          optimization_goal: isWebsiteLead ? "OFFSITE_CONVERSIONS" : "LEAD_GENERATION",
          billing_event: "IMPRESSIONS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          status: "PAUSED",
        };

        // targeting 복사 (LEADS 호환성 정규화)
        const srcTargeting = { ...(bundle.adset.targeting ?? {}) };
        // TRAFFIC 전용 placement/platform 필드를 LEADS에서 충돌할 수 있으므로 안전한 필드만 보존
        const safeTargetingKeys = [
          "geo_locations", "age_min", "age_max", "genders",
          "interests", "behaviors", "custom_audiences", "excluded_custom_audiences",
          "flexible_spec", "exclusions", "locales",
        ];
        const filteredTargeting: Record<string, unknown> = {};
        for (const key of safeTargetingKeys) {
          if (key in srcTargeting) {
            filteredTargeting[key] = srcTargeting[key];
          }
        }
        createAdsetParams.targeting = JSON.stringify(filteredTargeting);

        // promoted_object 설정
        if (isWebsiteLead) {
          // 웹사이트 리드: pixel_id + custom_event_type (page_id 제외)
          createAdsetParams.promoted_object = JSON.stringify({
            pixel_id: pixelId,
            custom_event_type: customEventType || "LEAD",
          });
        } else if (pageId) {
          // 인스턴트 폼: page_id만 + destination_type
          createAdsetParams.promoted_object = JSON.stringify({ page_id: pageId });
          createAdsetParams.destination_type = "ON_AD";
        } else {
          // 폴백: 계정 페이지 자동 탐색
          const pagesResult = await fetchMeta<{ data: Array<{ id: string; name: string }> }>("/me/accounts", { fields: "id,name", limit: "10" });
          const autoPageId = pagesResult.ok ? pagesResult.data.data?.[0]?.id : null;
          if (autoPageId) {
            createAdsetParams.promoted_object = JSON.stringify({ page_id: autoPageId });
            createAdsetParams.destination_type = "ON_AD";
          }
        }

        const newAdsetResult = await fetchMeta<{ id: string }>(`/${accountId}/adsets`, createAdsetParams, "POST");
        if (!newAdsetResult.ok) {
          respondFailure(502, "adset_create_failed", `[${bundle.adset.id}] ${newAdsetResult.error}`, newAdsetResult.errorDetail);
          return;
        }

        const newAdset = {
          id: newAdsetResult.data.id,
          name: bundle.adset.name,
          sourceAdsetId: bundle.adset.id,
        };
        partial.newAdsets.push(newAdset);
        partial.summary.adsetsCreated = partial.newAdsets.length;

        for (const ad of bundle.ads) {
          const creativeId = typeof ad.creative?.id === "string" ? ad.creative.id.trim() : "";
          if (!creativeId) {
            respondFailure(502, "creative_missing", `[${ad.id}] creative.id 없음`);
            return;
          }

          const newAdResult = await fetchMeta<{ id: string }>(`/${accountId}/ads`, {
            name: ad.name,
            adset_id: newAdset.id,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: "PAUSED",
          }, "POST");
          if (!newAdResult.ok) {
            respondFailure(502, "ad_create_failed", `[${ad.id}] ${newAdResult.error}`, newAdResult.errorDetail);
            return;
          }

          partial.newAds.push({
            id: newAdResult.data.id,
            name: ad.name,
            creativeId,
            sourceAdId: ad.id,
          });
          partial.summary.adsCreated = partial.newAds.length;
        }
      }

      res.json({
        ok: true,
        newCampaign: partial.newCampaign,
        newAdsets: partial.newAdsets,
        newAds: partial.newAds,
        summary: partial.summary,
      });
    } catch (error) {
      respondFailure(500, "campaign_clone_failed", error instanceof Error ? error.message : "campaign clone failed");
    }
  });

  // 캠페인 일시정지
  router.post("/api/meta/campaigns/:campaignId/pause", async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const result = await fetchMeta<{ success: boolean }>(`/${campaignId}`, { status: "PAUSED" }, "POST");
      if (!result.ok) { res.status(502).json(result); return; }
      res.json({ ok: true, campaignId, action: "paused", result: result.data });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "pause failed" });
    }
  });

  // 캠페인 활성화
  router.post("/api/meta/campaigns/:campaignId/activate", async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const result = await fetchMeta<{ success: boolean }>(`/${campaignId}`, { status: "ACTIVE" }, "POST");
      if (!result.ok) { res.status(502).json(result); return; }
      res.json({ ok: true, campaignId, action: "activated", result: result.data });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "activate failed" });
    }
  });

  return router;
};

export const createMetaCapiRouter = () => {
  const router = express.Router();

  router.post("/api/meta/capi/send", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const metadata = objectValue(body, ["metadata", "meta"]);

      const result = await sendMetaConversion({
        orderId: firstString(body, ["orderId", "order_id"]),
        paymentKey: firstString(body, ["paymentKey", "payment_key"]),
        source: firstString(body, ["source"]),
        pixelId: firstString(body, ["pixelId", "pixel_id"]),
        approvedAt: firstString(body, ["approvedAt", "approved_at"]),
        loggedAt: firstString(body, ["loggedAt", "logged_at", "timestamp"]),
        value: firstNumber(body, ["value", "amount", "totalAmount"]),
        email: firstString(body, ["email", "customerEmail", "customer_email"]),
        phone: firstString(body, ["phone", "mobilePhone", "mobile_phone", "customerMobilePhone"]),
        clientIpAddress: firstString(body, ["client_ip_address", "clientIpAddress"]) || requestIp(req),
        clientUserAgent: firstString(body, ["client_user_agent", "clientUserAgent"]) || requestUserAgent(req),
        fbc: firstString(body, ["fbc"]),
        fbp: firstString(body, ["fbp"]),
        fbclid: firstString(body, ["fbclid"]),
        landing: firstString(body, ["landing", "event_source_url"]),
        referrer: firstString(body, ["referrer", "referer"]),
        origin: typeof req.headers.origin === "string" ? req.headers.origin : "",
        eventName: firstString(body, ["eventName", "event_name"]),
        testEventCode: firstString(body, ["testEventCode", "test_event_code"]),
        metadata,
      });

      res.status(200).json({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "meta capi send failed";
      const status = message.startsWith("Meta CAPI ") ? 502 : 400;
      res.status(status).json({ ok: false, error: "meta_capi_send_error", message });
    }
  });

  router.post("/api/meta/capi/sync", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const queryLimit = typeof req.query.limit === "string" ? req.query.limit : undefined;
      const queryTestEventCode = typeof req.query.test_event_code === "string" ? req.query.test_event_code : "";
      const queryOrderId = typeof req.query.order_id === "string" ? req.query.order_id : "";
      const queryPaymentKey = typeof req.query.payment_key === "string" ? req.query.payment_key : "";
      const rawLimit = queryLimit ?? body.limit;

      const result = await syncMetaConversionsFromLedger({
        limit: rawLimit === undefined ? undefined : parsePositiveInt(rawLimit, 500, 2000),
        testEventCode: queryTestEventCode || firstString(body, ["testEventCode", "test_event_code"]),
        orderId: queryOrderId || firstString(body, ["orderId", "order_id"]),
        paymentKey: queryPaymentKey || firstString(body, ["paymentKey", "payment_key"]),
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "meta capi sync failed";
      res.status(500).json({ ok: false, error: "meta_capi_sync_error", message });
    }
  });

  router.get("/api/meta/capi/log", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(req.query.limit, 50, 500);
      const pixelId = typeof req.query.pixel_id === "string" ? req.query.pixel_id.trim() : "";
      const responseStatus = typeof req.query.response_status === "string" ? Number.parseInt(req.query.response_status, 10) : Number.NaN;
      const responseStatusClass = typeof req.query.response_status_class === "string"
        ? req.query.response_status_class.trim()
        : "";
      const scope = typeof req.query.scope === "string" ? req.query.scope.trim() : "";
      const includeDedupCandidates = parseBooleanFlag(req.query.include_dedup_candidates);
      const dedupCandidateLimit = parsePositiveInt(req.query.dedup_candidate_limit, 3, 50);
      const dedupCandidateClassification = typeof req.query.dedup_candidate_classification === "string"
        ? req.query.dedup_candidate_classification.trim()
        : "multiple_event_ids_duplicate_risk";
      const rawSinceDays = typeof req.query.since_days === "string" || typeof req.query.since_days === "number"
        ? req.query.since_days
        : undefined;
      const sinceDays = rawSinceDays !== undefined
        ? parsePositiveInt(rawSinceDays, 7, 365)
        : scope === "recent_operational"
          ? 7
          : null;
      const explicitSinceTimestampMs = parseOptionalTimestampMs(req.query.since);
      const explicitUntilTimestampMs = parseOptionalTimestampMs(req.query.until);
      if (Number.isNaN(explicitSinceTimestampMs)) {
        res.status(400).json({ ok: false, error: "since must be an ISO timestamp" });
        return;
      }
      if (Number.isNaN(explicitUntilTimestampMs)) {
        res.status(400).json({ ok: false, error: "until must be an ISO timestamp" });
        return;
      }
      if (
        explicitSinceTimestampMs !== null &&
        explicitUntilTimestampMs !== null &&
        explicitSinceTimestampMs > explicitUntilTimestampMs
      ) {
        res.status(400).json({ ok: false, error: "since must be earlier than until" });
        return;
      }
      const sinceTimestampMs = explicitSinceTimestampMs ?? (sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : null);
      const untilTimestampMs = explicitUntilTimestampMs;

      const logs = await readMetaCapiSendLogs();
      const filtered = logs.filter((row) => {
        const segment = classifyMetaCapiLogSegment(row);
        const isSuccess = row.response_status >= 200 && row.response_status < 300;
        if (scope === "recent_operational" && segment !== "operational") return false;
        if (scope === "recent_operational" && !isSuccess) return false;
        if (pixelId && row.pixel_id !== pixelId) return false;
        if (Number.isFinite(responseStatus) && row.response_status !== responseStatus) return false;
        if (responseStatusClass === "success" && !isSuccess) return false;
        if (responseStatusClass === "failure" && isSuccess) return false;
        if (sinceTimestampMs !== null) {
          const timestampMs = Date.parse(row.timestamp);
          if (!Number.isFinite(timestampMs) || timestampMs < sinceTimestampMs) return false;
        }
        if (untilTimestampMs !== null) {
          const timestampMs = Date.parse(row.timestamp);
          if (!Number.isFinite(timestampMs) || timestampMs > untilTimestampMs) return false;
        }
        return true;
      });
      const diagnostics = buildMetaCapiLogDiagnostics(filtered);
      const dedupCandidateDetails = includeDedupCandidates
        ? await buildMetaCapiDedupCandidateDetails(filtered, {
          limit: dedupCandidateLimit,
          classification:
            dedupCandidateClassification === "all"
            || dedupCandidateClassification === "same_event_id_retry_like"
            || dedupCandidateClassification === "multiple_event_ids_duplicate_risk"
              ? dedupCandidateClassification
              : "multiple_event_ids_duplicate_risk",
        })
        : undefined;

      res.json({
        ok: true,
        filters: {
          limit,
          pixel_id: pixelId || null,
          response_status: Number.isFinite(responseStatus) ? responseStatus : null,
          response_status_class: responseStatusClass || (scope === "recent_operational" ? "success" : null),
          scope: scope || "all",
          since_days: sinceDays,
          since: explicitSinceTimestampMs === null ? null : new Date(explicitSinceTimestampMs).toISOString(),
          until: explicitUntilTimestampMs === null ? null : new Date(explicitUntilTimestampMs).toISOString(),
          include_dedup_candidates: includeDedupCandidates,
          dedup_candidate_limit: includeDedupCandidates ? dedupCandidateLimit : null,
          dedup_candidate_classification: includeDedupCandidates ? dedupCandidateClassification : null,
        },
        summary: diagnostics,
        ...(dedupCandidateDetails ? { dedupCandidateDetails } : {}),
        items: filtered.slice(0, limit),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "meta capi log read failed";
      res.status(500).json({ ok: false, error: "meta_capi_log_error", message });
    }
  });

  return router;
};
