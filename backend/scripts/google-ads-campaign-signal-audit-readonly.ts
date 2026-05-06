import dotenv from "dotenv";
import { google } from "googleapis";

import { env } from "../src/env";

dotenv.config({ quiet: true });

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_CUSTOMER_ID = "2149990943";
const KNOWN_NPAY_LABELS = new Set(["r0vuCKvy-8caEJixj5EB", "3yjICOXRmJccEJixj5EB"]);
const PRIMARY_NPAY_LABEL = "r0vuCKvy-8caEJixj5EB";
const SECONDARY_NPAY_LABEL = "3yjICOXRmJccEJixj5EB";

type Row = Record<string, unknown>;

const toRecord = (value: unknown): Row => (value && typeof value === "object" && !Array.isArray(value) ? value as Row : {});
const toStringValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
};
const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseArgs = () => {
  const during = process.argv.find((arg) => arg.startsWith("--during="))?.slice("--during=".length) ?? "LAST_14_DAYS";
  const json = process.argv.includes("--json");
  if (!/^LAST_(7|14|30|90)_DAYS$/.test(during)) {
    throw new Error("--during must be one of LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, LAST_90_DAYS");
  }
  return { during, json };
};

const parseServiceAccountCredentials = () => {
  const raw = env.GSC_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_KEY or GA4_BIOCOM_SERVICE_ACCOUNT_KEY is required");
  const credentials = JSON.parse(raw) as Row;
  return {
    credentials,
    clientEmail: toStringValue(credentials.client_email) || null,
    projectId: toStringValue(credentials.project_id) || null,
  };
};

const createContext = async () => {
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN or API_TOKEN_BIOCOM is required");
  }
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
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: (env.GOOGLE_ADS_CUSTOMER_ID || DEFAULT_CUSTOMER_ID).replace(/\D/g, "") || DEFAULT_CUSTOMER_ID,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
    clientEmail,
    projectId,
  };
};

const summarizeGoogleAdsError = (text: string) => {
  try {
    const parsed = JSON.parse(text) as Row;
    return parsed.error ?? parsed;
  } catch {
    return { rawPreview: text.slice(0, 800) };
  }
};

const search = async (context: Awaited<ReturnType<typeof createContext>>, query: string) => {
  const response = await fetch(
    `https://googleads.googleapis.com/${context.apiVersion}/customers/${context.customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.token}`,
        "developer-token": context.developerToken,
        "Content-Type": "application/json",
        ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
          ? { "login-customer-id": env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "") }
          : {}),
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(JSON.stringify({ status: response.status, error: summarizeGoogleAdsError(text), query }, null, 2));
  }
  return (JSON.parse(text) as { results?: unknown[] }).results ?? [];
};

const extractSendTo = (snippet: string) => snippet.match(/AW-\d+\/[A-Za-z0-9_-]+/g) ?? [];

const conversionActionsQuery = `
  SELECT
    conversion_action.id,
    conversion_action.name,
    conversion_action.status,
    conversion_action.type,
    conversion_action.category,
    conversion_action.primary_for_goal,
    conversion_action.counting_type,
    conversion_action.click_through_lookback_window_days,
    conversion_action.view_through_lookback_window_days,
    conversion_action.tag_snippets
  FROM conversion_action
  WHERE conversion_action.status != REMOVED
  LIMIT 200
`;

const campaignQuery = (during: string) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.advertising_channel_sub_type,
    campaign.bidding_strategy_type,
    campaign.bidding_strategy,
    campaign_budget.name,
    campaign_budget.amount_micros,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE segments.date DURING ${during}
    AND metrics.cost_micros > 0
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`;

const actionSegmentQuery = (during: string) => `
  SELECT
    segments.date,
    segments.conversion_action,
    segments.conversion_action_name,
    campaign.id,
    campaign.name,
    campaign.advertising_channel_type,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value,
    metrics.view_through_conversions
  FROM campaign
  WHERE segments.date DURING ${during}
    AND metrics.all_conversions > 0
  ORDER BY segments.date ASC
  LIMIT 10000
`;

const normalizeAction = (row: unknown) => {
  const action = toRecord(toRecord(row).conversionAction);
  const tagSnippets = Array.isArray(action.tagSnippets) ? action.tagSnippets : [];
  const sendTo = [...new Set(tagSnippets.flatMap((snippet) => {
    const item = toRecord(snippet);
    return [
      ...extractSendTo(toStringValue(item.eventSnippet)),
      ...extractSendTo(toStringValue(item.globalSiteTag)),
    ];
  }))];
  const labels = sendTo.map((value) => value.split("/")[1]).filter(Boolean);
  return {
    resourceName: toStringValue(action.resourceName),
    id: toStringValue(action.id),
    name: toStringValue(action.name),
    status: toStringValue(action.status),
    type: toStringValue(action.type),
    category: toStringValue(action.category),
    primaryForGoal: action.primaryForGoal === true,
    countingType: toStringValue(action.countingType),
    clickWindowDays: toNumber(action.clickThroughLookbackWindowDays) || null,
    viewWindowDays: toNumber(action.viewThroughLookbackWindowDays) || null,
    sendTo,
    labels,
    classification: labels.includes(PRIMARY_NPAY_LABEL)
      ? "primary_npay_count_label"
      : labels.includes(SECONDARY_NPAY_LABEL)
        ? "secondary_npay_click_label"
        : labels.some((label) => KNOWN_NPAY_LABELS.has(label))
          ? "known_npay_label"
          : "other",
  };
};

const metrics = (row: Row) => {
  const m = toRecord(row.metrics);
  return {
    cost: toNumber(m.costMicros) / 1_000_000,
    impressions: toNumber(m.impressions),
    clicks: toNumber(m.clicks),
    conversions: toNumber(m.conversions),
    conversionValue: toNumber(m.conversionsValue),
    allConversions: toNumber(m.allConversions),
    allConversionValue: toNumber(m.allConversionsValue),
    viewThroughConversions: toNumber(m.viewThroughConversions),
  };
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const ratio = (value: number, denom: number) => (denom > 0 ? round(value / denom, 4) : null);

const main = async () => {
  const args = parseArgs();
  const context = await createContext();
  const [actionRows, campaignRows, segmentRows] = await Promise.all([
    search(context, conversionActionsQuery),
    search(context, campaignQuery(args.during)),
    search(context, actionSegmentQuery(args.during)),
  ]);

  const actions = actionRows.map(normalizeAction);
  const actionByResource = new Map(actions.map((action) => [action.resourceName, action]));

  const campaigns = campaignRows.map((raw) => {
    const row = toRecord(raw);
    const campaign = toRecord(row.campaign);
    const budget = toRecord(row.campaignBudget);
    const m = metrics(row);
    return {
      campaignId: toStringValue(campaign.id),
      campaignName: toStringValue(campaign.name),
      status: toStringValue(campaign.status),
      channel: toStringValue(campaign.advertisingChannelType),
      channelSubType: toStringValue(campaign.advertisingChannelSubType),
      biddingStrategyType: toStringValue(campaign.biddingStrategyType),
      biddingStrategy: toStringValue(campaign.biddingStrategy),
      budgetName: toStringValue(budget.name),
      budgetAmount: toNumber(budget.amountMicros) / 1_000_000,
      ...m,
      roas: m.cost > 0 ? round(m.conversionValue / m.cost, 2) : null,
      allRoas: m.cost > 0 ? round(m.allConversionValue / m.cost, 2) : null,
      ctr: m.impressions > 0 ? round(m.clicks / m.impressions, 4) : null,
      cvr: m.clicks > 0 ? round(m.conversions / m.clicks, 4) : null,
    };
  });

  const actionSegments = segmentRows.map((raw) => {
    const row = toRecord(raw);
    const campaign = toRecord(row.campaign);
    const segments = toRecord(row.segments);
    const action = actionByResource.get(toStringValue(segments.conversionAction));
    return {
      date: toStringValue(segments.date),
      campaignId: toStringValue(campaign.id),
      campaignName: toStringValue(campaign.name),
      channel: toStringValue(campaign.advertisingChannelType),
      actionResourceName: toStringValue(segments.conversionAction),
      actionName: toStringValue(segments.conversionActionName),
      actionId: action?.id ?? null,
      actionCategory: action?.category ?? null,
      primaryForGoal: action?.primaryForGoal ?? null,
      classification: action?.classification ?? "unknown",
      labels: action?.labels ?? [],
      ...metrics(row),
    };
  });

  const campaignActionTotals = new Map<string, {
    primaryNpayValue: number;
    primaryNpayConversions: number;
    secondaryNpayAllValue: number;
    secondaryNpayAllConversions: number;
    otherPrimaryValue: number;
  }>();
  for (const row of actionSegments) {
    const current = campaignActionTotals.get(row.campaignId) ?? {
      primaryNpayValue: 0,
      primaryNpayConversions: 0,
      secondaryNpayAllValue: 0,
      secondaryNpayAllConversions: 0,
      otherPrimaryValue: 0,
    };
    if (row.classification === "primary_npay_count_label") {
      current.primaryNpayValue += row.conversionValue;
      current.primaryNpayConversions += row.conversions;
    } else if (row.classification === "secondary_npay_click_label") {
      current.secondaryNpayAllValue += row.allConversionValue;
      current.secondaryNpayAllConversions += row.allConversions;
    } else if (row.primaryForGoal) {
      current.otherPrimaryValue += row.conversionValue;
    }
    campaignActionTotals.set(row.campaignId, current);
  }

  const campaignAudit = campaigns.map((campaign) => {
    const actionTotals = campaignActionTotals.get(campaign.campaignId) ?? {
      primaryNpayValue: 0,
      primaryNpayConversions: 0,
      secondaryNpayAllValue: 0,
      secondaryNpayAllConversions: 0,
      otherPrimaryValue: 0,
    };
    return {
      ...campaign,
      primaryNpayValue: round(actionTotals.primaryNpayValue),
      primaryNpayConversions: round(actionTotals.primaryNpayConversions, 4),
      primaryNpayShareOfPlatformValue: ratio(actionTotals.primaryNpayValue, campaign.conversionValue),
      secondaryNpayAllValue: round(actionTotals.secondaryNpayAllValue),
      secondaryNpayAllConversions: round(actionTotals.secondaryNpayAllConversions, 4),
      otherPrimaryValue: round(actionTotals.otherPrimaryValue),
      affectedByNpayPrimary: actionTotals.primaryNpayValue > 0,
      recommendedBudgetAction:
        actionTotals.primaryNpayValue > 0 && campaign.channel !== "SEARCH"
          ? "reduce_or_pause_test"
          : actionTotals.primaryNpayValue > 0
            ? "keep_low_cap_until_confirmed_signal"
            : "monitor",
    };
  });

  const dailyAction = new Map<string, {
    date: string;
    primaryNpayValue: number;
    primaryNpayConversions: number;
    secondaryNpayAllValue: number;
    secondaryNpayAllConversions: number;
    otherPrimaryValue: number;
  }>();
  for (const row of actionSegments) {
    const current = dailyAction.get(row.date) ?? {
      date: row.date,
      primaryNpayValue: 0,
      primaryNpayConversions: 0,
      secondaryNpayAllValue: 0,
      secondaryNpayAllConversions: 0,
      otherPrimaryValue: 0,
    };
    if (row.classification === "primary_npay_count_label") {
      current.primaryNpayValue += row.conversionValue;
      current.primaryNpayConversions += row.conversions;
    } else if (row.classification === "secondary_npay_click_label") {
      current.secondaryNpayAllValue += row.allConversionValue;
      current.secondaryNpayAllConversions += row.allConversions;
    } else if (row.primaryForGoal) {
      current.otherPrimaryValue += row.conversionValue;
    }
    dailyAction.set(row.date, current);
  }

  const totals = campaignAudit.reduce((acc, campaign) => {
    acc.cost += campaign.cost;
    acc.conversionValue += campaign.conversionValue;
    acc.allConversionValue += campaign.allConversionValue;
    acc.primaryNpayValue += campaign.primaryNpayValue;
    acc.secondaryNpayAllValue += campaign.secondaryNpayAllValue;
    return acc;
  }, {
    cost: 0,
    conversionValue: 0,
    allConversionValue: 0,
    primaryNpayValue: 0,
    secondaryNpayAllValue: 0,
  });

  const result = {
    generatedAt: new Date().toISOString(),
    mode: "read-only Google Ads API search",
    source: {
      customerId: context.customerId,
      apiVersion: context.apiVersion,
      clientEmail: context.clientEmail,
      projectId: context.projectId,
      during: args.during,
    },
    definitions: {
      primaryNpayLabel: `AW-304339096/${PRIMARY_NPAY_LABEL}`,
      secondaryNpayLabel: `AW-304339096/${SECONDARY_NPAY_LABEL}`,
      searchIntentCampaign:
        "Campaigns with advertising_channel_type=SEARCH, usually explicit keyword/search demand. This is not generic traffic; it is demand capture.",
    },
    totals: {
      cost: round(totals.cost),
      conversionValue: round(totals.conversionValue),
      allConversionValue: round(totals.allConversionValue),
      roas: totals.cost > 0 ? round(totals.conversionValue / totals.cost, 2) : null,
      primaryNpayValue: round(totals.primaryNpayValue),
      primaryNpayShareOfPlatformValue: ratio(totals.primaryNpayValue, totals.conversionValue),
      secondaryNpayAllValue: round(totals.secondaryNpayAllValue),
    },
    actions: actions.filter((action) => action.classification !== "other"),
    campaignAudit,
    dailyAction: [...dailyAction.values()]
      .map((row) => ({
        ...row,
        primaryNpayValue: round(row.primaryNpayValue),
        primaryNpayConversions: round(row.primaryNpayConversions, 4),
        secondaryNpayAllValue: round(row.secondaryNpayAllValue),
        secondaryNpayAllConversions: round(row.secondaryNpayAllConversions, 4),
        otherPrimaryValue: round(row.otherPrimaryValue),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };

  console.log(JSON.stringify(result, null, args.json ? 2 : 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
