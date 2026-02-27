import { env } from "../env";
import type { DataSourceMeta } from "../ga4";

export const makeLiveMeta = (period: { startDate: string; endDate: string }): DataSourceMeta => ({
  type: "live",
  propertyId: env.GA4_PROPERTY_ID ? `properties/${env.GA4_PROPERTY_ID}` : undefined,
  queriedAt: new Date().toISOString(),
  period,
});

export const makeEmptyMeta = (period: { startDate: string; endDate: string }): DataSourceMeta => ({
  type: "empty",
  queriedAt: new Date().toISOString(),
  period,
  notice: "GA4 미연결. 실제 데이터가 아닙니다.",
});

export const isGa4CredentialError = (message: string) => {
  const msgLower = message.toLowerCase();
  return (
    message.includes("UNAUTHENTICATED") ||
    message.includes("401") ||
    msgLower.includes("unauthenticated") ||
    msgLower.includes("default credentials") ||
    message.includes("GA4_SERVICE_ACCOUNT_KEY is not configured") ||
    message.includes("GA4_SERVICE_ACCOUNT_KEY is not valid JSON") ||
    msgLower.includes("permission_denied") ||
    msgLower.includes("permission denied")
  );
};
