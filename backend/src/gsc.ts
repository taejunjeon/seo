import { google, searchconsole_v1 } from "googleapis";

import { env } from "./env";

const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

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

export const listGscSites = async () => {
  const client = createSearchConsoleClient();
  const response = await client.sites.list();
  return response.data.siteEntry ?? [];
};

export const queryGscSearchAnalytics = async (params: GscQueryParams) => {
  const client = createSearchConsoleClient();

  const response = await client.searchanalytics.query({
    siteUrl: params.siteUrl ?? env.GSC_SITE_URL,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit,
      startRow: params.startRow,
      type: params.type,
      aggregationType: params.aggregationType,
      dataState: "final",
    },
  });

  return {
    siteUrl: params.siteUrl ?? env.GSC_SITE_URL,
    startDate: params.startDate,
    endDate: params.endDate,
    rows: response.data.rows ?? [],
    responseAggregationType: response.data.responseAggregationType,
  };
};
