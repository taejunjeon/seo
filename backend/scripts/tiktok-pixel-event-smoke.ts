type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type SmokeOptions = {
  baseUrl: string;
  origin: string;
  orderCode: string;
  orderNo: string;
  paymentCode: string;
  eventId: string;
  action: string;
  eventName: string;
  value: string;
  currency: string;
};

type JsonResponse<T extends JsonValue = JsonValue> = {
  ok: boolean;
  status: number;
  headers: Headers;
  body: T;
};

const isRecord = (value: JsonValue): value is { [key: string]: JsonValue } =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const parseArgs = (): SmokeOptions => {
  const runId = Date.now();
  const defaults: SmokeOptions = {
    baseUrl: trimTrailingSlash(process.env.ATTRIBUTION_BASE_URL || "http://localhost:7020"),
    origin: process.env.TIKTOK_SMOKE_ORIGIN || "https://biocom.kr",
    orderCode: `smoke_o_${runId}`,
    orderNo: `smoke_no_${runId}`,
    paymentCode: `smoke_pa_${runId}`,
    eventId: `SmokeTest_Purchase_${runId}`,
    action: "smoke_test",
    eventName: "Purchase",
    value: "1000",
    currency: "KRW",
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    const normalizedKey = key.slice(2) as keyof SmokeOptions;
    if (normalizedKey in defaults) {
      defaults[normalizedKey] = value as never;
      index += 1;
    }
  }

  defaults.baseUrl = trimTrailingSlash(defaults.baseUrl);
  return defaults;
};

const readHeader = (headers: Headers, key: string) => headers.get(key) ?? "";

const requestJson = async <T extends JsonValue = JsonValue>(
  url: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> => {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T;
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    body,
  };
};

const requestText = async (
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; headers: Headers; body: string }> => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
};

const main = async () => {
  const options = parseArgs();
  const eventUrl = `${options.baseUrl}/api/attribution/tiktok-pixel-event`;
  const listUrl =
    `${options.baseUrl}/api/attribution/tiktok-pixel-events` +
    `?orderCode=${encodeURIComponent(options.orderCode)}&limit=5`;

  const payload = {
    action: options.action,
    source: "manual_smoke_script",
    eventName: options.eventName,
    eventId: options.eventId,
    orderCode: options.orderCode,
    orderNo: options.orderNo,
    paymentCode: options.paymentCode,
    value: options.value,
    currency: options.currency,
    url:
      `https://biocom.kr/shop_payment_complete?order_code=${encodeURIComponent(options.orderCode)}` +
      `&order_no=${encodeURIComponent(options.orderNo)}` +
      `&payment_code=${encodeURIComponent(options.paymentCode)}` +
      `&ttclid=smoke_ttclid_${Date.now()}`,
    referrer: "https://biocom.kr/shop_payment",
    decision: {
      status: "unknown",
      browserAction: "allow_purchase",
      reason: "smoke_test",
      matchedBy: "none",
    },
  };

  const health = await requestJson<{ ok?: boolean; status?: string; env?: string }>(
    `${options.baseUrl}/health`,
    {
      headers: {
        origin: options.origin,
      },
    },
  );

  const preflight = await requestText(eventUrl, {
    method: "OPTIONS",
    headers: {
      origin: options.origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });

  const post = await requestJson<{
    ok?: boolean;
    receiver?: string;
    writtenRows?: number;
    event?: {
      eventLogId?: string;
      siteSource?: string;
      action?: string;
      eventId?: string;
      orderCode?: string;
      orderNo?: string;
      paymentCode?: string;
    };
  }>(eventUrl, {
    method: "POST",
    headers: {
      origin: options.origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const readback = await requestJson<{
    ok?: boolean;
    summary?: {
      totalEvents?: number;
      uniqueOrderKeys?: number;
      countsByAction?: Record<string, number>;
    };
    items?: Array<{
      eventLogId?: string;
      siteSource?: string;
      action?: string;
      eventId?: string;
      orderCode?: string;
      orderNo?: string;
      paymentCode?: string;
    }>;
  }>(listUrl, {
    headers: {
      origin: options.origin,
    },
  });

  const accessControlAllowOrigin =
    readHeader(post.headers, "access-control-allow-origin") ||
    readHeader(preflight.headers, "access-control-allow-origin");
  const matchingItem = readback.body.items?.find(
    (item) =>
      item.orderCode === options.orderCode &&
      item.orderNo === options.orderNo &&
      item.paymentCode === options.paymentCode &&
      item.eventId === options.eventId,
  );

  const healthBody = isRecord(health.body) ? health.body : {};
  const healthSignal =
    (typeof healthBody.ok === "boolean" && healthBody.ok === true) ||
    (typeof healthBody.status === "string" && healthBody.status.toLowerCase() === "ok");

  const result = {
    purpose: "TikTok pixel event rollout smoke check",
    note: [
      "이 스크립트는 backend 준비 상태만 확인한다.",
      "실제 브라우저 콘솔 fetch와 live source v1/v2 문자열 검증은 별도로 해야 한다.",
      "tiktok_pixel_events row 수는 구매 수가 아니라 action 로그 수다. 구매 수는 eventId/orderCode/orderNo/paymentCode 기준으로 묶어 해석한다.",
    ],
    inputs: options,
    checks: {
      healthOk: health.ok && healthSignal,
      preflightOk: preflight.ok,
      postOk: post.ok && post.body?.ok === true,
      dbInsertOk: Number(post.body?.writtenRows ?? 0) >= 1,
      readbackOk: readback.ok && readback.body?.ok === true,
      readbackVisible: Boolean(matchingItem),
      accessControlAllowOrigin,
      accessControlMatchesOrigin:
        accessControlAllowOrigin === "*" || accessControlAllowOrigin === options.origin,
      backendReadyForHeaderSwap:
        health.ok &&
        healthSignal &&
        post.ok &&
        post.body?.ok === true &&
        Number(post.body?.writtenRows ?? 0) >= 1 &&
        readback.ok &&
        readback.body?.ok === true &&
        Boolean(matchingItem) &&
        (accessControlAllowOrigin === "*" || accessControlAllowOrigin === options.origin),
    },
    details: {
      health: {
        status: health.status,
        body: health.body,
      },
      preflight: {
        status: preflight.status,
        accessControlAllowOrigin: readHeader(preflight.headers, "access-control-allow-origin"),
        accessControlAllowMethods: readHeader(preflight.headers, "access-control-allow-methods"),
        accessControlAllowHeaders: readHeader(preflight.headers, "access-control-allow-headers"),
      },
      post: {
        status: post.status,
        writtenRows: Number(post.body?.writtenRows ?? 0),
        receiver: post.body?.receiver ?? "",
        event: post.body?.event ?? null,
      },
      readback: {
        status: readback.status,
        summary: readback.body?.summary ?? null,
        matchingItem: matchingItem ?? null,
      },
    },
    browserConsoleSmokeSnippet: [
      "fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', {",
      "  method: 'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      "  body: JSON.stringify({",
      "    action: 'smoke_test',",
      "    source: 'manual_browser_test',",
      `    eventName: '${options.eventName}',`,
      `    eventId: '${options.eventId}',`,
      `    orderCode: '${options.orderCode}',`,
      `    orderNo: '${options.orderNo}',`,
      `    paymentCode: '${options.paymentCode}',`,
      `    value: '${options.value}',`,
      `    currency: '${options.currency}',`,
      "    url: location.href,",
      "    referrer: document.referrer",
      "  })",
      "})",
    ].join("\n"),
  };

  console.log(JSON.stringify(result, null, 2));

  if (!result.checks.backendReadyForHeaderSwap) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown tiktok pixel smoke error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
