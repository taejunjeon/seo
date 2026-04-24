import crypto from "node:crypto";

import { env } from "./env";

export type CoupangAccount = "biocom" | "teamketo";

type Credentials = { vendorId: string; accessKey: string; secretKey: string };

const COUPANG_BASE_URL = "https://api-gateway.coupang.com";

function getCredentials(account: CoupangAccount): Credentials {
  if (account === "biocom") {
    const vendorId = env.COUPANG_BIOCOM_CODE;
    const accessKey = env.COUPANG_BIOCOM_ACCESS_KEY;
    const secretKey = env.COUPANG_BIOCOM_SECRET_KEY;
    if (!vendorId || !accessKey || !secretKey) {
      throw new Error("COUPANG_BIOCOM_* env not configured");
    }
    return { vendorId, accessKey, secretKey };
  }
  const vendorId = env.COUPANG_TEAMKETO_CODE;
  const accessKey = env.COUPANG_TEAMKETO_ACCESS_KEY;
  const secretKey = env.COUPANG_TEAMKETO_SECRET_KEY;
  if (!vendorId || !accessKey || !secretKey) {
    throw new Error("COUPANG_TEAMKETO_* env not configured");
  }
  return { vendorId, accessKey, secretKey };
}

export const isCoupangConfigured = (account: CoupangAccount): boolean => {
  try {
    getCredentials(account);
    return true;
  } catch {
    return false;
  }
};

function formatSignedDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getUTCFullYear().toString().slice(2) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z"
  );
}

export function buildAuthHeader(
  method: string,
  path: string,
  query: string,
  cred: Credentials,
  now: Date = new Date(),
): string {
  const signedDate = formatSignedDate(now);
  const message = `${signedDate}${method.toUpperCase()}${path}${query}`;
  const signature = crypto
    .createHmac("sha256", cred.secretKey)
    .update(message)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${cred.accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

export async function coupangRequest<T = unknown>(
  account: CoupangAccount,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const cred = getCredentials(account);
  const method = opts.method ?? "GET";

  // Coupang 서명 스펙: query는 URL-encoded 상태로 서명하고,
  // 실제 요청 URL에도 동일한 인코딩 상태로 들어가야 바이트 단위로 일치한다.
  const queryString = opts.query
    ? Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  const auth = buildAuthHeader(method, path, queryString, cred);
  const url = `${COUPANG_BASE_URL}${path}${queryString ? "?" + queryString : ""}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: auth,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Coupang ${account} ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } finally {
    clearTimeout(timeout);
  }
}

// 편의 함수 ─────────────────────────────────────────────

export type CoupangOrderSheet = {
  shipmentBoxId?: number;
  orderId?: number;
  orderedAt?: string;
  paidAt?: string;
  status?: string;
  orderer?: { name?: string; email?: string; safeNumber?: string };
  receiver?: { name?: string; addr1?: string; addr2?: string; safeNumber?: string };
  orderItems?: Array<{
    vendorItemId?: number;
    productId?: number;
    productName?: string;
    shippingCount?: number;
    salesPrice?: number;
    orderPrice?: number;
  }>;
  [key: string]: unknown;
};

/**
 * v5 일단위 페이징 조회 — 날짜는 yyyy-MM-dd (하루 전체)
 * 권장: 백필·일일 sync
 */
export async function listOrderSheetsByDay(
  account: CoupangAccount,
  params: {
    createdAtFrom: string; // "2026-04-23"
    createdAtTo: string;   // "2026-04-24"
    status?: string;       // ACCEPT|INSTRUCT|DEPARTURE|DELIVERING|FINAL_DELIVERY|NONE_TRACKING
    maxPerPage?: number;   // 1~50
    nextToken?: string;
  },
): Promise<{ data: CoupangOrderSheet[]; nextToken?: string }> {
  const { vendorId } = getCredentials(account);
  const query: Record<string, string | number | undefined> = {
    createdAtFrom: params.createdAtFrom,
    createdAtTo: params.createdAtTo,
    maxPerPage: params.maxPerPage ?? 50,
    status: params.status,
    nextToken: params.nextToken,
  };
  const res = await coupangRequest<{ code: number; message: string; data: CoupangOrderSheet[]; nextToken?: string }>(
    account,
    `/v2/providers/openapi/apis/api/v5/vendors/${vendorId}/ordersheets`,
    { query },
  );
  return { data: res.data ?? [], nextToken: res.nextToken };
}

/**
 * v4 분단위 조회 (24시간 범위) — 실시간 incremental 용
 * 날짜 포맷: yyyy-MM-ddTHH:mm
 */
export async function listOrderSheetsByMinute(
  account: CoupangAccount,
  params: {
    createdAtFrom: string; // "2026-04-23T00:00"
    createdAtTo: string;   // "2026-04-23T23:59"
    status?: string;
  },
): Promise<{ data: CoupangOrderSheet[] }> {
  const { vendorId } = getCredentials(account);
  const query: Record<string, string | number | undefined> = {
    createdAtFrom: params.createdAtFrom,
    createdAtTo: params.createdAtTo,
    searchType: "timeFrame",
    status: params.status,
  };
  const res = await coupangRequest<{ code: number; message: string; data: CoupangOrderSheet[] }>(
    account,
    `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/ordersheets`,
    { query },
  );
  return { data: res.data ?? [] };
}

export async function getVendorId(account: CoupangAccount): Promise<string> {
  return getCredentials(account).vendorId;
}

/**
 * 정산 내역 조회 — 단일 파라미터(yearMonth)라 인증·기본 파싱 검증에 유용
 * 주의: API 가 배열을 **직접** 반환 (`data` 래퍼 없음)
 * @param yearMonth YYYY-MM (예: "2026-03" → 매출 인식 월 기준)
 */
export async function getSettlementHistories(
  account: CoupangAccount,
  yearMonth: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await coupangRequest<unknown>(
    account,
    `/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories`,
    { query: { revenueRecognitionYearMonth: yearMonth } },
  );
  // 쿠팡은 배열을 직접 반환. 혹시 wrapper 가 붙는 케이스도 안전하게 처리.
  if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
  const wrap = res as { data?: unknown };
  if (Array.isArray(wrap?.data)) return wrap.data as Array<Record<string, unknown>>;
  return [];
}
