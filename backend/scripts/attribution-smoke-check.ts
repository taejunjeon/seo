type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type SmokeOptions = {
  baseUrl: string;
  date: string;
  checkoutId: string;
  customerKey: string;
  orderId: string;
  paymentKey: string;
  landing: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveKstDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const parseArgs = (): SmokeOptions => {
  const runId = Date.now();
  const defaults: SmokeOptions = {
    baseUrl: trimTrailingSlash(process.env.ATTRIBUTION_BASE_URL || "http://localhost:7020"),
    date: resolveKstDate(),
    checkoutId: `smoke-checkout-${runId}`,
    customerKey: `ck_smoke_${runId}`,
    orderId: `smoke-order-${runId}`,
    paymentKey: `smoke-payment-${runId}`,
    landing: "/products/smoke-check",
    utmSource: "codex",
    utmMedium: "smoke",
    utmCampaign: "p1-s1a-receiver-check",
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

const requestJson = async (url: string, init?: RequestInit): Promise<JsonValue> => {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as JsonValue;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
};

const main = async () => {
  const options = parseArgs();

  const beforeLedger = (await requestJson(
    `${options.baseUrl}/api/attribution/ledger`,
  )) as {
    summary?: { totalEntries?: number };
  };

  const checkoutPayload = {
    checkoutId: options.checkoutId,
    customerKey: options.customerKey,
    landing: options.landing,
    referrer: "https://biocom.kr/products/smoke-referrer",
    gaSessionId: `ga-smoke-${options.checkoutId}`,
    utmSource: options.utmSource,
    utmMedium: options.utmMedium,
    utmCampaign: options.utmCampaign,
    captureMode: "smoke",
    metadata: {
      smokeCheck: true,
      runType: "checkout-context",
    },
  };

  const paymentPayload = {
    orderId: options.orderId,
    paymentKey: options.paymentKey,
    approvedAt: `${options.date}T10:00:00+09:00`,
    checkoutId: options.checkoutId,
    customerKey: options.customerKey,
    landing: options.landing,
    referrer: "https://biocom.kr/checkout",
    gaSessionId: `ga-smoke-${options.checkoutId}`,
    utmSource: options.utmSource,
    utmMedium: options.utmMedium,
    utmCampaign: options.utmCampaign,
    captureMode: "smoke",
    metadata: {
      smokeCheck: true,
      runType: "payment-success",
    },
  };

  const checkoutResult = await requestJson(`${options.baseUrl}/api/attribution/checkout-context`, {
    method: "POST",
    body: JSON.stringify(checkoutPayload),
  });
  const paymentResult = await requestJson(`${options.baseUrl}/api/attribution/payment-success`, {
    method: "POST",
    body: JSON.stringify(paymentPayload),
  });

  const afterLedger = (await requestJson(
    `${options.baseUrl}/api/attribution/ledger`,
  )) as {
    summary?: { totalEntries?: number };
    items?: Array<{ checkoutId?: string; orderId?: string; paymentKey?: string; touchpoint?: string }>;
  };
  const hourlyCompare = await requestJson(
    `${options.baseUrl}/api/attribution/hourly-compare?date=${encodeURIComponent(options.date)}`,
  );
  const tossJoin = await requestJson(
    `${options.baseUrl}/api/attribution/toss-join?startDate=${encodeURIComponent(options.date)}&endDate=${encodeURIComponent(options.date)}&limit=20`,
  );

  const beforeCount = beforeLedger.summary?.totalEntries ?? 0;
  const afterCount = afterLedger.summary?.totalEntries ?? 0;

  console.log(
    JSON.stringify(
      {
        purpose: "P1-S1A receiver smoke check",
        note: "더미 paymentKey/orderId를 쓰면 toss-join은 보통 unmatched가 나온다. 실제 토스 승인 키를 넣어야 join coverage까지 같이 본다.",
        inputs: options,
        result: {
          receiverDelta: afterCount - beforeCount,
          expectedMinimumDelta: 2,
          ok: afterCount - beforeCount >= 2,
          checkoutResult,
          paymentResult,
          afterLedgerSummary: afterLedger.summary ?? null,
          latestLedgerItems: afterLedger.items?.slice(0, 5) ?? [],
          hourlyCompare,
          tossJoin,
        },
      },
      null,
      2,
    ),
  );
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown attribution smoke error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
