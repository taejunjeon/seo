#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_CUSTOMER_ID = "2149990943";
const DEFAULT_ACTION_NAME = "BI confirmed_purchase";

type JsonRecord = Record<string, unknown>;

type GoogleAdsContext = {
  token: string;
  developerToken: string;
  customerId: string;
  loginCustomerId: string | null;
  apiVersion: string;
  clientEmail: string | null;
  projectId: string | null;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const mode = argValue("mode") ?? "pre";
const actionName = argValue("name") ?? DEFAULT_ACTION_NAME;
const outputPath = argValue("out");

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toStringValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
};

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const normalizeCustomerId = (value: string | undefined) =>
  (value || DEFAULT_CUSTOMER_ID).replace(/\D/g, "") || DEFAULT_CUSTOMER_ID;

const summarizeGoogleAdsError = (text: string) => {
  try {
    const parsed = JSON.parse(text) as JsonRecord;
    return parsed.error ?? parsed;
  } catch {
    return { rawPreview: text.slice(0, 1200) };
  }
};

const parseServiceAccountCredentials = () => {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY ?? process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw?.trim()) throw new Error("GSC_SERVICE_ACCOUNT_KEY or GA4_BIOCOM_SERVICE_ACCOUNT_KEY is required");
  const credentials = JSON.parse(raw) as JsonRecord;
  return {
    credentials,
    clientEmail: toStringValue(credentials.client_email) || null,
    projectId: toStringValue(credentials.project_id) || null,
  };
};

const createContext = async (): Promise<GoogleAdsContext> => {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? process.env.API_TOKEN_BIOCOM;
  if (!developerToken?.trim()) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN or API_TOKEN_BIOCOM is required");

  const { credentials, clientEmail, projectId } = parseServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [GOOGLE_ADS_SCOPE],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) throw new Error("Failed to obtain Google Ads OAuth access token");

  return {
    token,
    developerToken,
    customerId: normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID ?? process.env.GOOGLE_ADS_CLIENT_CUSTOMER_ID),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      ? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "")
      : null,
    apiVersion: process.env.GOOGLE_ADS_API_VERSION || "v22",
    clientEmail,
    projectId,
  };
};

const headers = (context: GoogleAdsContext) => ({
  Authorization: `Bearer ${context.token}`,
  "developer-token": context.developerToken,
  ...(context.loginCustomerId ? { "login-customer-id": context.loginCustomerId } : {}),
  "Content-Type": "application/json",
});

const googleAdsSearch = async (context: GoogleAdsContext, query: string) => {
  const response = await fetch(
    `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}/googleAds:search`,
    {
      method: "POST",
      headers: headers(context),
      body: JSON.stringify({ query }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(JSON.stringify({ status: response.status, error: summarizeGoogleAdsError(text), query }, null, 2));
  }
  return JSON.parse(text) as { results?: JsonRecord[]; queryResourceConsumption?: string };
};

const trySearch = async (context: GoogleAdsContext, key: string, query: string) => {
  try {
    const result = await googleAdsSearch(context, query);
    return {
      ok: true,
      key,
      queryResourceConsumption: result.queryResourceConsumption ?? null,
      rows: result.results ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      key,
      error: error instanceof Error ? error.message : String(error),
      rows: [],
    };
  }
};

const mutateConversionActions = async (
  context: GoogleAdsContext,
  operations: JsonRecord[],
  validateOnly: boolean,
) => {
  const response = await fetch(
    `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}/conversionActions:mutate`,
    {
      method: "POST",
      headers: headers(context),
      body: JSON.stringify({
        customerId: context.customerId,
        operations,
        validateOnly,
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(JSON.stringify({ status: response.status, error: summarizeGoogleAdsError(text), validateOnly }, null, 2));
  }
  return text.trim() ? JSON.parse(text) as JsonRecord : {};
};

const buildConversionActionCreate = (name: string) => ({
  create: {
    name,
    category: "PURCHASE",
    type: "UPLOAD_CLICKS",
    status: "ENABLED",
    primaryForGoal: false,
    countingType: "MANY_PER_CLICK",
    clickThroughLookbackWindowDays: "90",
    valueSettings: {
      defaultValue: 0,
      alwaysUseDefaultValue: false,
    },
  },
});

const conversionActionsQuery = (name: string) => `
  SELECT
    conversion_action.resource_name,
    conversion_action.id,
    conversion_action.name,
    conversion_action.status,
    conversion_action.type,
    conversion_action.category,
    conversion_action.primary_for_goal,
    conversion_action.counting_type,
    conversion_action.click_through_lookback_window_days,
    conversion_action.view_through_lookback_window_days,
    conversion_action.value_settings.default_value,
    conversion_action.value_settings.always_use_default_value,
    conversion_action.tag_snippets
  FROM conversion_action
  WHERE conversion_action.status != REMOVED
    AND conversion_action.name IN ('${name.replaceAll("'", "\\'")}', '구매완료', 'TechSol - NPAY구매 50739')
  ORDER BY conversion_action.id
`;

const activeCampaignsQuery = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.bidding_strategy_type,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status != REMOVED
    AND metrics.cost_micros > 0
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`;

const customerConversionGoalsQuery = `
  SELECT
    customer_conversion_goal.category,
    customer_conversion_goal.origin,
    customer_conversion_goal.biddable
  FROM customer_conversion_goal
`;

const campaignConversionGoalsQuery = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign_conversion_goal.category,
    campaign_conversion_goal.origin,
    campaign_conversion_goal.biddable
  FROM campaign_conversion_goal
  WHERE campaign.status != REMOVED
  LIMIT 10000
`;

const conversionGoalCampaignConfigQuery = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    conversion_goal_campaign_config.goal_config_level,
    conversion_goal_campaign_config.custom_conversion_goal
  FROM conversion_goal_campaign_config
  WHERE campaign.status != REMOVED
  LIMIT 10000
`;

const customConversionGoalsQuery = `
  SELECT
    custom_conversion_goal.resource_name,
    custom_conversion_goal.id,
    custom_conversion_goal.name,
    custom_conversion_goal.status,
    custom_conversion_goal.conversion_actions
  FROM custom_conversion_goal
  LIMIT 1000
`;

const customerQuery = `
  SELECT
    customer.id,
    customer.descriptive_name,
    customer.manager,
    customer.test_account,
    customer.status,
    customer.conversion_tracking_setting.google_ads_conversion_customer
  FROM customer
  LIMIT 1
`;

const normalizeAction = (row: JsonRecord) => {
  const action = isRecord(row.conversionAction) ? row.conversionAction : {};
  const valueSettings = isRecord(action.valueSettings) ? action.valueSettings : {};
  return {
    resourceName: toStringValue(action.resourceName),
    id: toStringValue(action.id),
    name: toStringValue(action.name),
    status: toStringValue(action.status),
    type: toStringValue(action.type),
    category: toStringValue(action.category),
    primaryForGoal: action.primaryForGoal === true,
    countingType: toStringValue(action.countingType),
    clickThroughLookbackWindowDays: toStringValue(action.clickThroughLookbackWindowDays) || null,
    viewThroughLookbackWindowDays: toStringValue(action.viewThroughLookbackWindowDays) || null,
    defaultValue: valueSettings.defaultValue ?? null,
    alwaysUseDefaultValue: valueSettings.alwaysUseDefaultValue === true,
  };
};

const extractRows = (result: Awaited<ReturnType<typeof trySearch>>) => result.rows.filter(isRecord);

const buildSnapshot = async (context: GoogleAdsContext, name: string) => {
  const [
    customer,
    conversionActions,
    activeCampaigns,
    customerConversionGoals,
    campaignConversionGoals,
    conversionGoalCampaignConfigs,
    customConversionGoals,
  ] = await Promise.all([
    trySearch(context, "customer", customerQuery),
    trySearch(context, "conversion_actions", conversionActionsQuery(name)),
    trySearch(context, "active_campaigns_last30", activeCampaignsQuery),
    trySearch(context, "customer_conversion_goals", customerConversionGoalsQuery),
    trySearch(context, "campaign_conversion_goals", campaignConversionGoalsQuery),
    trySearch(context, "conversion_goal_campaign_configs", conversionGoalCampaignConfigQuery),
    trySearch(context, "custom_conversion_goals", customConversionGoalsQuery),
  ]);

  const actions = extractRows(conversionActions).map(normalizeAction);
  const targetAction = actions.find((action) => action.name === name) ?? null;
  const legacyPurchase = actions.find((action) => action.id === "7130249515" || action.name === "구매완료") ?? null;
  const npayCount = actions.find((action) => action.name === "TechSol - NPAY구매 50739") ?? null;
  const customGoalRows = extractRows(customConversionGoals);
  const targetResource = targetAction?.resourceName ?? "";
  const customGoalsIncludingTarget = targetResource
    ? customGoalRows.filter((row) => {
      const goal = isRecord(row.customConversionGoal) ? row.customConversionGoal : {};
      const actionsValue = goal.conversionActions;
      return Array.isArray(actionsValue) && actionsValue.includes(targetResource);
    })
    : [];

  return {
    customer,
    conversionActions,
    activeCampaigns,
    customerConversionGoals,
    campaignConversionGoals,
    conversionGoalCampaignConfigs,
    customConversionGoals,
    normalized: {
      actionCount: actions.length,
      targetAction,
      legacyPurchase,
      npayCount,
      activeCampaignRows: extractRows(activeCampaigns).length,
      customGoalsIncludingTarget: customGoalsIncludingTarget.map((row) => row.customConversionGoal ?? row),
      purchasePrimaryEnabledActions: actions.filter((action) =>
        action.category === "PURCHASE" && action.primaryForGoal && action.status === "ENABLED"
      ),
      targetIsObserveOnly: Boolean(targetAction && targetAction.primaryForGoal === false),
      legacyPurchaseUnchanged: Boolean(
        legacyPurchase
          && legacyPurchase.id === "7130249515"
          && legacyPurchase.status === "ENABLED"
          && legacyPurchase.category === "PURCHASE"
          && legacyPurchase.primaryForGoal === true,
      ),
    },
  };
};

const main = async () => {
  if (!["pre", "create", "post"].includes(mode)) {
    throw new Error("--mode must be pre, create, or post");
  }
  const context = await createContext();
  const before = await buildSnapshot(context, actionName);
  const operations = [buildConversionActionCreate(actionName)];
  let mutation: JsonRecord | null = null;
  let validateOnly: JsonRecord | null = null;

  if (mode === "create") {
    if (before.normalized.targetAction) {
      mutation = {
        skipped: true,
        reason: "conversion_action_already_exists",
        resourceName: before.normalized.targetAction.resourceName,
      };
    } else {
      validateOnly = await mutateConversionActions(context, operations, true);
      mutation = await mutateConversionActions(context, operations, false);
    }
  }

  const after = mode === "create" ? await buildSnapshot(context, actionName) : before;
  const payload = {
    ok: true,
    mode,
    generatedAtKst: kstNow(),
    actionName,
    approvalScope: {
      createSecondaryObserveOnlyAction: mode === "create",
      uploadSend: 0,
      dataManagerIngest: 0,
      enhancedConversionSend: 0,
      campaignBudgetChange: 0,
      legacyPurchaseActionMutation: 0,
    },
    googleAdsContext: {
      apiVersion: context.apiVersion,
      customerId: context.customerId,
      loginCustomerId: context.loginCustomerId,
      serviceAccount: {
        clientEmail: context.clientEmail,
        projectId: context.projectId,
      },
    },
    mutation: {
      validateOnly,
      result: mutation,
    },
    snapshot: {
      before,
      after,
    },
    verdict: {
      targetCreatedOrExists: Boolean(after.normalized.targetAction),
      targetObserveOnly: after.normalized.targetIsObserveOnly,
      legacyPurchaseUnchanged: after.normalized.legacyPurchaseUnchanged,
      customGoalIncludesTarget: after.normalized.customGoalsIncludingTarget.length > 0,
      activeCampaignRows: after.normalized.activeCampaignRows,
      uploadSendCount: 0,
      dataManagerIngestCount: 0,
      campaignBudgetChangeCount: 0,
      pass:
        Boolean(after.normalized.targetAction)
        && after.normalized.targetIsObserveOnly
        && after.normalized.legacyPurchaseUnchanged
        && after.normalized.customGoalsIncludingTarget.length === 0,
    },
  };

  const json = JSON.stringify(payload, null, 2);
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${json}\n`);
  }
  console.log(json);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
