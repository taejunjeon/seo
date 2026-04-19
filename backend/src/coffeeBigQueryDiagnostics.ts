import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env"), quiet: true });

const COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const COFFEE_DATASET = `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`;
const COFFEE_LOCATION = "asia-northeast3";
const TABLE_PREFIX = "events_";

type BigQueryRow = Record<string, unknown>;

type CoffeeBigQueryWindow = {
  startSuffix: string;
  endSuffix: string;
  firstTable: string | null;
  latestTable: string | null;
  tableCount: number;
};

type PurchaseQuality = {
  purchaseEvents: number;
  distinctTransactionIds: number;
  missingTransactionId: number;
  missingUserPseudoId: number;
  missingGaSessionId: number;
  eventLevelSourceOrGclidMissing: number;
  withGclid: number;
  purchaseRevenue: number;
};

type SourceQuality = {
  purchaseEvents: number;
  eventLevelSourceOrGclidMissing: number;
  sessionLastClickMissing: number;
  directLike: number;
  unassignedChannelGroup: number;
  withGoogleAdsCampaign: number;
  joinedSessionEvent: number;
  joinedSessionHasEventSourceOrGclid: number;
  firstJoinedEventIsSessionStart: number;
};

type UtmChannelMappingRow = {
  channelGroup: string;
  rawSource: string;
  rawMedium: string;
  purchaseEvents: number;
  distinctTransactions: number;
  purchaseRevenue: number;
  recommendedChannel: string;
  recommendedSource: string;
  recommendedMedium: string;
  approvalAction: "approve" | "exclude" | "investigate" | "needs_review";
  note: string;
};

export type CoffeeBigQueryDiagnostics = {
  ok: true;
  checkedAt: string;
  projectId: string;
  dataset: string;
  location: string;
  window: CoffeeBigQueryWindow;
  purchase_quality: PurchaseQuality;
  source_quality: SourceQuality;
  utm_channel_mapping: UtmChannelMappingRow[];
};

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) return null;
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  if (!credentials) {
    throw new Error("GA4 service account key missing");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });

  return google.bigquery({ version: "v2", auth });
};

const runBigQuery = async (
  bq: bigquery_v2.Bigquery,
  query: string,
) => {
  const response = await bq.jobs.query({
    projectId: COFFEE_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: COFFEE_LOCATION,
      timeoutMs: 30_000,
    },
  });

  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
};

const stringValue = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
};

const validateSuffix = (value: string | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{8}$/.test(trimmed)) {
    throw new Error(`Invalid table suffix: ${value}`);
  }
  return trimmed;
};

const suffixToDate = (suffix: string) =>
  new Date(Date.UTC(Number(suffix.slice(0, 4)), Number(suffix.slice(4, 6)) - 1, Number(suffix.slice(6, 8))));

const dateToSuffix = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;

const shiftSuffix = (suffix: string, days: number) => {
  const date = suffixToDate(suffix);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToSuffix(date);
};

const listEventTables = async (bq: bigquery_v2.Bigquery) => {
  await bq.datasets.get({ projectId: COFFEE_PROJECT_ID, datasetId: COFFEE_DATASET });
  const tableResponse = await bq.tables.list({
    projectId: COFFEE_PROJECT_ID,
    datasetId: COFFEE_DATASET,
    maxResults: 1000,
  });

  return (tableResponse.data.tables ?? [])
    .map((table) => table.tableReference?.tableId ?? "")
    .filter((tableId) => /^events_\d{8}$/.test(tableId))
    .sort();
};

const resolveWindow = async (
  bq: bigquery_v2.Bigquery,
  startSuffixParam?: string,
  endSuffixParam?: string,
): Promise<CoffeeBigQueryWindow> => {
  const tables = await listEventTables(bq);
  const latestTable = tables.at(-1) ?? null;
  const firstTable = tables[0] ?? null;
  if (!latestTable) {
    throw new Error(`No GA4 event tables in ${COFFEE_PROJECT_ID}.${COFFEE_DATASET}`);
  }

  const latestSuffix = latestTable.slice(TABLE_PREFIX.length);
  const endSuffix = validateSuffix(endSuffixParam) ?? latestSuffix;
  const startSuffix = validateSuffix(startSuffixParam) ?? shiftSuffix(endSuffix, -5);

  if (startSuffix > endSuffix) {
    throw new Error(`startSuffix must be <= endSuffix: ${startSuffix} > ${endSuffix}`);
  }

  return {
    startSuffix,
    endSuffix,
    firstTable,
    latestTable,
    tableCount: tables.length,
  };
};

const queryPurchaseQuality = async (bq: bigquery_v2.Bigquery, window: CoffeeBigQueryWindow): Promise<PurchaseQuality> => {
  const rows = await runBigQuery(
    bq,
    `
      WITH p AS (
        SELECT
          user_pseudo_id,
          (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
          COALESCE(ecommerce.transaction_id, (
            SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
          )) AS transaction_id,
          collected_traffic_source.manual_source AS manual_source,
          collected_traffic_source.manual_medium AS manual_medium,
          collected_traffic_source.gclid AS gclid,
          ecommerce.purchase_revenue AS purchase_revenue
        FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
        WHERE _TABLE_SUFFIX BETWEEN '${window.startSuffix}' AND '${window.endSuffix}'
          AND event_name = 'purchase'
      )
      SELECT
        COUNT(*) AS purchase_events,
        COUNT(DISTINCT transaction_id) AS distinct_transaction_ids,
        COUNTIF(transaction_id IS NULL OR transaction_id = '') AS missing_transaction_id,
        COUNTIF(user_pseudo_id IS NULL) AS missing_user_pseudo_id,
        COUNTIF(ga_session_id IS NULL) AS missing_ga_session_id,
        COUNTIF((manual_source IS NULL OR manual_source = '') AND gclid IS NULL) AS event_level_source_or_gclid_missing,
        COUNTIF(gclid IS NOT NULL) AS with_gclid,
        ROUND(SUM(COALESCE(purchase_revenue, 0))) AS purchase_revenue
      FROM p
    `,
  );

  const row = rows[0] ?? {};
  return {
    purchaseEvents: parseNumber(row.purchase_events),
    distinctTransactionIds: parseNumber(row.distinct_transaction_ids),
    missingTransactionId: parseNumber(row.missing_transaction_id),
    missingUserPseudoId: parseNumber(row.missing_user_pseudo_id),
    missingGaSessionId: parseNumber(row.missing_ga_session_id),
    eventLevelSourceOrGclidMissing: parseNumber(row.event_level_source_or_gclid_missing),
    withGclid: parseNumber(row.with_gclid),
    purchaseRevenue: parseNumber(row.purchase_revenue),
  };
};

const querySourceQuality = async (bq: bigquery_v2.Bigquery, window: CoffeeBigQueryWindow): Promise<SourceQuality> => {
  const rows = await runBigQuery(
    bq,
    `
      WITH purchase AS (
        SELECT
          user_pseudo_id,
          (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
          collected_traffic_source.manual_source AS event_source,
          collected_traffic_source.gclid AS event_gclid,
          session_traffic_source_last_click.manual_campaign.source AS manual_source,
          session_traffic_source_last_click.cross_channel_campaign.source AS cross_source,
          session_traffic_source_last_click.cross_channel_campaign.default_channel_group AS channel_group,
          session_traffic_source_last_click.google_ads_campaign.campaign_id AS google_ads_campaign_id
        FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
        WHERE _TABLE_SUFFIX BETWEEN '${window.startSuffix}' AND '${window.endSuffix}'
          AND event_name = 'purchase'
      ),
      session_events AS (
        SELECT
          user_pseudo_id,
          (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
          ARRAY_AGG(STRUCT(
            event_name,
            collected_traffic_source.manual_source AS manual_source,
            collected_traffic_source.gclid AS gclid,
            event_timestamp
          ) ORDER BY event_timestamp ASC LIMIT 1)[OFFSET(0)] AS first_event
        FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
        WHERE _TABLE_SUFFIX BETWEEN '${window.startSuffix}' AND '${window.endSuffix}'
        GROUP BY user_pseudo_id, ga_session_id
      )
      SELECT
        COUNT(*) AS purchase_events,
        COUNTIF((p.event_source IS NULL OR p.event_source = '') AND p.event_gclid IS NULL) AS event_level_source_or_gclid_missing,
        COUNTIF(COALESCE(p.manual_source, p.cross_source, p.google_ads_campaign_id) IS NULL) AS session_last_click_missing,
        COUNTIF(COALESCE(p.manual_source, p.cross_source) = '(direct)') AS direct_like,
        COUNTIF(p.channel_group = 'Unassigned') AS unassigned_channel_group,
        COUNTIF(p.google_ads_campaign_id IS NOT NULL) AS with_google_ads_campaign,
        COUNTIF(s.first_event.event_name IS NOT NULL) AS joined_session_event,
        COUNTIF(s.first_event.manual_source IS NOT NULL OR s.first_event.gclid IS NOT NULL) AS joined_session_has_event_source_or_gclid,
        COUNTIF(s.first_event.event_name = 'session_start') AS first_joined_event_is_session_start
      FROM purchase p
      LEFT JOIN session_events s
        ON p.user_pseudo_id = s.user_pseudo_id AND p.ga_session_id = s.ga_session_id
    `,
  );

  const row = rows[0] ?? {};
  return {
    purchaseEvents: parseNumber(row.purchase_events),
    eventLevelSourceOrGclidMissing: parseNumber(row.event_level_source_or_gclid_missing),
    sessionLastClickMissing: parseNumber(row.session_last_click_missing),
    directLike: parseNumber(row.direct_like),
    unassignedChannelGroup: parseNumber(row.unassigned_channel_group),
    withGoogleAdsCampaign: parseNumber(row.with_google_ads_campaign),
    joinedSessionEvent: parseNumber(row.joined_session_event),
    joinedSessionHasEventSourceOrGclid: parseNumber(row.joined_session_has_event_source_or_gclid),
    firstJoinedEventIsSessionStart: parseNumber(row.first_joined_event_is_session_start),
  };
};

const recommendMapping = (
  rawSource: string,
  rawMedium: string,
  channelGroup: string,
): Pick<UtmChannelMappingRow, "recommendedChannel" | "recommendedSource" | "recommendedMedium" | "approvalAction" | "note"> => {
  const source = rawSource.toLowerCase();
  const medium = rawMedium.toLowerCase();
  const group = channelGroup.toLowerCase();

  if (source.includes("naver_brand_search")) {
    return {
      recommendedChannel: "paid_search_naver_brand",
      recommendedSource: "naver",
      recommendedMedium: "paid_search",
      approvalAction: "approve",
      note: "아임웹 유입 분석에서도 매출 상위 UTM. GA4 기본 채널은 Unassigned라 내부 표준 채널이 필요함.",
    };
  }

  if (source === "meta" || medium === "paid_social" || source.includes("instagram") || source.includes("facebook")) {
    return {
      recommendedChannel: "paid_social_meta",
      recommendedSource: "meta",
      recommendedMedium: "paid_social",
      approvalAction: "approve",
      note: "Meta 광고/인스타그램 유입 표준명.",
    };
  }

  if (source === "(direct)" || medium === "(none)" || group === "direct") {
    return {
      recommendedChannel: "direct",
      recommendedSource: "(direct)",
      recommendedMedium: "(none)",
      approvalAction: "approve",
      note: "직접 유입. 캠페인 성과로 해석하지 않음.",
    };
  }

  if (group.includes("organic search") || medium === "organic") {
    return {
      recommendedChannel: "organic_search",
      recommendedSource: rawSource,
      recommendedMedium: rawMedium,
      approvalAction: "approve",
      note: "검색 자연유입.",
    };
  }

  if (group.includes("organic shopping")) {
    return {
      recommendedChannel: "organic_shopping",
      recommendedSource: rawSource,
      recommendedMedium: rawMedium,
      approvalAction: "approve",
      note: "네이버 쇼핑 등 쇼핑 자연유입.",
    };
  }

  if (source === "channel_talk") {
    return {
      recommendedChannel: "owned_crm_channel_talk",
      recommendedSource: "channel_talk",
      recommendedMedium: "message",
      approvalAction: "approve",
      note: "TJ 승인 완료. 상담/CRM 메시지 계열로 광고 ROAS와 분리.",
    };
  }

  if (source.includes("imwebcrm_cart")) {
    return {
      recommendedChannel: "owned_crm_cart_reminder",
      recommendedSource: "imwebcrm",
      recommendedMedium: "cart_reminder",
      approvalAction: "approve",
      note: "TJ 승인 완료. 장바구니 리마인드 CRM 캠페인.",
    };
  }

  if (source === "kakao" && medium === "message") {
    return {
      recommendedChannel: "owned_crm_kakaotalk",
      recommendedSource: "kakao",
      recommendedMedium: "message",
      approvalAction: "approve",
      note: "TJ 승인 완료. 카카오 메시지 유입은 owned CRM으로 분리.",
    };
  }

  if (source.includes("kakako") || source.includes("kakao") || source.includes("channel_talk") || source.includes("imwebcrm") || source.includes("crm_")) {
    return {
      recommendedChannel: "owned_crm_message",
      recommendedSource: rawSource,
      recommendedMedium: "message",
      approvalAction: "needs_review",
      note: "CRM/카카오 계열 후보. 오탈자 또는 세부 캠페인명 확인 필요.",
    };
  }

  if (source === "test") {
    return {
      recommendedChannel: "exclude_test",
      recommendedSource: "test",
      recommendedMedium: "test",
      approvalAction: "exclude",
      note: "테스트 유입으로 운영 ROAS에서 제외 권장.",
    };
  }

  if (source === "(not set)" || source === "(missing)") {
    return {
      recommendedChannel: "unknown",
      recommendedSource: rawSource,
      recommendedMedium: rawMedium,
      approvalAction: "investigate",
      note: "source/medium 원인 확인 필요.",
    };
  }

  return {
    recommendedChannel: "needs_mapping",
    recommendedSource: rawSource,
    recommendedMedium: rawMedium,
    approvalAction: "needs_review",
    note: "표본과 운영 캠페인명을 보고 TJ 승인 필요.",
  };
};

const queryUtmChannelMapping = async (
  bq: bigquery_v2.Bigquery,
  window: CoffeeBigQueryWindow,
): Promise<UtmChannelMappingRow[]> => {
  const rows = await runBigQuery(
    bq,
    `
      SELECT
        COALESCE(session_traffic_source_last_click.cross_channel_campaign.default_channel_group, '(missing)') AS channel_group,
        COALESCE(
          session_traffic_source_last_click.cross_channel_campaign.source,
          session_traffic_source_last_click.manual_campaign.source,
          IF(session_traffic_source_last_click.google_ads_campaign.campaign_id IS NOT NULL, 'google_ads', NULL),
          '(missing)'
        ) AS source_key,
        COALESCE(
          session_traffic_source_last_click.cross_channel_campaign.medium,
          session_traffic_source_last_click.manual_campaign.medium,
          '(missing)'
        ) AS medium_key,
        COUNT(*) AS purchase_events,
        COUNT(DISTINCT COALESCE(ecommerce.transaction_id, (
          SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
        ))) AS distinct_txn,
        ROUND(SUM(COALESCE(ecommerce.purchase_revenue, 0))) AS purchase_revenue
      FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
      WHERE _TABLE_SUFFIX BETWEEN '${window.startSuffix}' AND '${window.endSuffix}'
        AND event_name = 'purchase'
      GROUP BY channel_group, source_key, medium_key
      ORDER BY purchase_events DESC, purchase_revenue DESC
      LIMIT 100
    `,
  );

  return rows.map((row) => {
    const rawSource = stringValue(row.source_key, "(missing)");
    const rawMedium = stringValue(row.medium_key, "(missing)");
    const channelGroup = stringValue(row.channel_group, "(missing)");
    return {
      channelGroup,
      rawSource,
      rawMedium,
      purchaseEvents: parseNumber(row.purchase_events),
      distinctTransactions: parseNumber(row.distinct_txn),
      purchaseRevenue: parseNumber(row.purchase_revenue),
      ...recommendMapping(rawSource, rawMedium, channelGroup),
    };
  });
};

export const getCoffeeBigQueryDiagnostics = async (params: {
  startSuffix?: string;
  endSuffix?: string;
} = {}): Promise<CoffeeBigQueryDiagnostics> => {
  const bq = createBigQueryClient();
  const window = await resolveWindow(bq, params.startSuffix, params.endSuffix);
  const [purchaseQuality, sourceQuality, utmChannelMapping] = await Promise.all([
    queryPurchaseQuality(bq, window),
    querySourceQuality(bq, window),
    queryUtmChannelMapping(bq, window),
  ]);

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    projectId: COFFEE_PROJECT_ID,
    dataset: COFFEE_DATASET,
    location: COFFEE_LOCATION,
    window,
    purchase_quality: purchaseQuality,
    source_quality: sourceQuality,
    utm_channel_mapping: utmChannelMapping,
  };
};
