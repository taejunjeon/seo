/**
 * 네이버 검색광고 API (Search Ad API) client.
 *
 * 정본 가이드: https://naver.github.io/searchad-apidoc/#/guides
 * 본 client 의 정책:
 *   - read-only 사용. PUT/POST/DELETE 호출 helper 는 본 sprint 에서 노출하지 않음.
 *   - 광고 게재 상태 변경 / 입찰가 변경 / 키워드 추가/삭제 0.
 *   - SECRET_KEY 는 로그 출력 / 응답 echo / 외부 전송 0.
 *   - `convAmt` (네이버 주장 매출) ↔ 운영DB tb_iamweb_users 결제완료 매출 합산 0 (caller 책임).
 *
 * 사용 site: biocom (`BIOCOM_NAVER_ADS_*` env).
 */

import { createHmac } from "node:crypto";

import "./env";

const BASE_URL = "https://api.searchad.naver.com";

const readNaverAdsEnv = () => {
  const accessKey = process.env.BIOCOM_NAVER_ADS_ACESS ?? "";
  const customerId = process.env.BIOCOM_NAVER_ADS_CUSTOMER_ID ?? "";
  const secretKey = process.env.BIOCOM_NAVER_ADS_SECRET_KEY ?? "";
  return { accessKey, customerId, secretKey };
};

export const isNaverAdsConfigured = (): boolean => {
  const { accessKey, customerId, secretKey } = readNaverAdsEnv();
  return Boolean(accessKey && customerId && secretKey);
};

export const buildNaverSearchAdHeaders = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  uri: string,
): Record<string, string> => {
  const { accessKey, customerId, secretKey } = readNaverAdsEnv();
  if (!accessKey || !customerId || !secretKey) {
    throw new Error("BIOCOM_NAVER_ADS_* env 미설정 (CUSTOMER_ID / ACESS / SECRET_KEY)");
  }
  const timestamp = Date.now().toString();
  const message = `${timestamp}.${method}.${uri}`;
  const signature = createHmac("sha256", secretKey).update(message).digest("base64");
  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": accessKey,
    "X-Customer": customerId,
    "X-Signature": signature,
    "Content-Type": "application/json; charset=UTF-8",
  };
};

const callNaverSearchAd = async <T = unknown>(
  method: "GET",
  uri: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number; error: string }> => {
  const queryString = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const headers = buildNaverSearchAdHeaders(method, uri);
  const res = await fetch(`${BASE_URL}${uri}${queryString}`, { method, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "object" && body !== null
      ? JSON.stringify(body).slice(0, 200)
      : String(body).slice(0, 200);
    return { ok: false, status: res.status, error: msg };
  }
  return { ok: true, status: res.status, body: body as T };
};

export type NaverCampaign = {
  nccCampaignId: string;
  customerId: number;
  name: string;
  campaignTp: string;
  status: string;
  dailyBudget?: number;
  useDailyBudget?: boolean;
  regTm?: string;
  editTm?: string;
};

export const listCampaigns = async (): Promise<
  { ok: true; campaigns: NaverCampaign[] } | { ok: false; status: number; error: string }
> => {
  const res = await callNaverSearchAd<NaverCampaign[]>("GET", "/ncc/campaigns");
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const list = Array.isArray(res.body) ? res.body : [];
  return { ok: true, campaigns: list };
};

export type NaverStatsField =
  | "impCnt" | "clkCnt" | "ctr" | "cpc" | "salesAmt"
  | "convAmt" | "ccnt" | "crto";

export type NaverStatsRow = {
  id: string;
  impCnt?: number;
  clkCnt?: number;
  ctr?: number;
  cpc?: number;
  salesAmt?: number;
  convAmt?: number;
  ccnt?: number;
  crto?: number;
};

export type NaverStatsDailyResponse = {
  summary?: { dateStart: string; dateEnd: string };
  data: Array<{
    dateStart: string;
    dateEnd: string;
    impCnt?: number;
    clkCnt?: number;
    ctr?: number;
    cpc?: number;
    salesAmt?: number;
    convAmt?: number;
    ccnt?: number;
    crto?: number;
  }>;
};

/**
 * 일별 광고 stats — 형식 B (?id=단수 + timeRange) 사용 자동 일별 분해.
 */
export const getDailyStats = async (input: {
  campaignId: string;
  since: string;
  until: string;
  fields?: NaverStatsField[];
}): Promise<
  { ok: true; daily: NaverStatsDailyResponse } | { ok: false; status: number; error: string }
> => {
  const fields = input.fields ?? ["impCnt", "clkCnt", "ctr", "cpc", "salesAmt", "convAmt", "ccnt", "crto"];
  const res = await callNaverSearchAd<NaverStatsDailyResponse>("GET", "/stats", {
    id: input.campaignId,
    fields: JSON.stringify(fields),
    timeRange: JSON.stringify({ since: input.since, until: input.until }),
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const body = res.body && typeof res.body === "object" && "data" in res.body
    ? (res.body as NaverStatsDailyResponse)
    : { data: [] };
  return { ok: true, daily: body };
};

/**
 * 합산 형식 (형식 C). 여러 id 통합 합계만 필요할 때.
 */
export const getStatsSummary = async (input: {
  ids: string[];
  since: string;
  until: string;
  fields?: NaverStatsField[];
}): Promise<
  { ok: true; stats: NaverStatsRow[] } | { ok: false; status: number; error: string }
> => {
  const fields = input.fields ?? ["impCnt", "clkCnt", "ctr", "cpc", "salesAmt", "convAmt", "ccnt", "crto"];
  const res = await callNaverSearchAd<{ data: NaverStatsRow[] }>("GET", "/stats", {
    ids: input.ids.join(","),
    fields: JSON.stringify(fields),
    timeRange: JSON.stringify({ since: input.since, until: input.until }),
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const list = res.body && typeof res.body === "object" && "data" in res.body && Array.isArray(res.body.data)
    ? res.body.data
    : [];
  return { ok: true, stats: list };
};

/** 호환성: 기존 getStats = getStatsSummary alias */
export const getStats = getStatsSummary;

export const verifyNaverAdsAuth = async (): Promise<{
  ok: boolean;
  configured: boolean;
  campaigns_count: number;
  sample_campaign?: { id: string; name: string; status: string; campaignTp: string };
  stats_sample?: NaverStatsRow;
  error?: string;
  status?: number;
}> => {
  if (!isNaverAdsConfigured()) {
    return { ok: false, configured: false, campaigns_count: 0, error: "env 미설정" };
  }
  const c = await listCampaigns();
  if (!c.ok) {
    return { ok: false, configured: true, campaigns_count: 0, status: c.status, error: c.error };
  }
  const cnt = c.campaigns.length;
  if (cnt === 0) {
    return { ok: true, configured: true, campaigns_count: 0 };
  }
  const first = c.campaigns[0];
  const stats = await getDailyStats({
    campaignId: first.nccCampaignId,
    since: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    until: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  return {
    ok: true,
    configured: true,
    campaigns_count: cnt,
    sample_campaign: {
      id: first.nccCampaignId,
      name: first.name,
      status: first.status,
      campaignTp: first.campaignTp,
    },
    stats_sample:
      stats.ok && stats.daily.data.length > 0
        ? ({ id: first.nccCampaignId, ...stats.daily.data[0] } as NaverStatsRow)
        : undefined,
    error: stats.ok ? undefined : stats.error,
  };
};
