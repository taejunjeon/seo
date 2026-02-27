import { google, searchconsole_v1 } from "googleapis";

import { env } from "./env";

const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export type GscSearchAnalyticsResponse = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rows: searchconsole_v1.Schema$ApiDataRow[];
  responseAggregationType?: string | null;
};

export type GscDimension =
  | "date"
  | "query"
  | "page"
  | "country"
  | "device"
  | "searchAppearance";

export type GscQueryParams = {
  siteUrl?: string;
  startDate: string;
  endDate: string;
  dimensions: GscDimension[];
  dimensionFilterGroups?: searchconsole_v1.Schema$ApiDimensionFilterGroup[];
  rowLimit: number;
  startRow: number;
  type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  aggregationType?: "auto" | "byPage" | "byProperty";
};

const parseServiceAccountKey = (rawKey: string) => {
  try {
    return JSON.parse(rawKey);
  } catch {
    throw new Error(
      "GSC_SERVICE_ACCOUNT_KEY is not valid JSON. Keep it one-line and escape line breaks as \\n.",
    );
  }
};

const createAuth = () => {
  if (env.GSC_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      credentials: parseServiceAccountKey(env.GSC_SERVICE_ACCOUNT_KEY),
      scopes: GSC_SCOPES,
    });
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: GSC_SCOPES,
    });
  }

  throw new Error(
    "Missing Google auth credentials. Set GOOGLE_APPLICATION_CREDENTIALS or GSC_SERVICE_ACCOUNT_KEY.",
  );
};

const createSearchConsoleClient = (): searchconsole_v1.Searchconsole => {
  return google.searchconsole({
    version: "v1",
    auth: createAuth(),
  });
};

let cachedClient: searchconsole_v1.Searchconsole | null = null;

const getSearchConsoleClient = (): searchconsole_v1.Searchconsole => {
  if (cachedClient) return cachedClient;
  cachedClient = createSearchConsoleClient();
  return cachedClient;
};

const QUERY_CACHE_TTL_MS = 60_000; // 1m: reduce duplicate queries during initial dashboard load
const queryCache = new Map<string, { measuredAtMs: number; value: GscSearchAnalyticsResponse }>();
const inflight = new Map<string, Promise<GscSearchAnalyticsResponse>>();

const serializeFilters = (groups: searchconsole_v1.Schema$ApiDimensionFilterGroup[] | undefined) => {
  if (!groups) return "";
  try {
    return JSON.stringify(groups);
  } catch {
    return "[unserializable_filters]";
  }
};

const makeQueryCacheKey = (params: GscQueryParams, siteUrl: string) => {
  return [
    siteUrl,
    params.startDate,
    params.endDate,
    params.dimensions.join(","),
    params.rowLimit,
    params.startRow,
    params.type ?? "web",
    params.aggregationType ?? "auto",
    serializeFilters(params.dimensionFilterGroups),
  ].join("|");
};

export const listGscSites = async () => {
  const client = getSearchConsoleClient();
  const response = await client.sites.list();
  return response.data.siteEntry ?? [];
};

export const queryGscSearchAnalytics = async (params: GscQueryParams): Promise<GscSearchAnalyticsResponse> => {
  const client = getSearchConsoleClient();
  const resolvedSiteUrl = params.siteUrl ?? env.GSC_SITE_URL;
  const cacheKey = makeQueryCacheKey(params, resolvedSiteUrl);
  const cached = queryCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.measuredAtMs < QUERY_CACHE_TTL_MS) {
    return cached.value;
  }

  const running = inflight.get(cacheKey);
  if (running) return running;

  const promise = (async () => {
    const response = await client.searchanalytics.query({
      siteUrl: resolvedSiteUrl,
      requestBody: {
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: params.dimensions,
        dimensionFilterGroups: params.dimensionFilterGroups,
        rowLimit: params.rowLimit,
        startRow: params.startRow,
        type: params.type,
        aggregationType: params.aggregationType,
        dataState: "final",
      },
    });

    const value: GscSearchAnalyticsResponse = {
      siteUrl: resolvedSiteUrl,
      startDate: params.startDate,
      endDate: params.endDate,
      rows: response.data.rows ?? [],
      responseAggregationType: response.data.responseAggregationType ?? null,
    };

    queryCache.set(cacheKey, { measuredAtMs: Date.now(), value });
    return value;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
};
