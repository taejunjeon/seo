type ReplayOptions = {
  baseUrl: string;
  startDate: string;
  endDate: string;
  limit: string;
  dryRun: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveKstDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const parseArgs = (): ReplayOptions => {
  const defaults: ReplayOptions = {
    baseUrl: trimTrailingSlash(process.env.ATTRIBUTION_BASE_URL || "http://localhost:7020"),
    startDate: resolveKstDate(),
    endDate: resolveKstDate(),
    limit: "20",
    dryRun: "true",
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    const normalizedKey = key.slice(2) as keyof ReplayOptions;
    if (normalizedKey in defaults) {
      defaults[normalizedKey] = value as never;
      index += 1;
    }
  }

  defaults.baseUrl = trimTrailingSlash(defaults.baseUrl);
  return defaults;
};

const main = async () => {
  const options = parseArgs();
  const response = await fetch(`${options.baseUrl}/api/attribution/replay/toss`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate: options.startDate,
      endDate: options.endDate,
      limit: Number(options.limit),
      dryRun: options.dryRun.toLowerCase() !== "false",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }

  console.log(
    JSON.stringify(
      {
        purpose: "P1-S1A toss replay/backfill",
        inputs: options,
        result: payload,
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
        error: error instanceof Error ? error.message : "unknown replay error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
