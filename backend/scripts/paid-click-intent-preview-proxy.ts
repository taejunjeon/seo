import http from "node:http";

const PORT = Number(process.env.PAID_CLICK_INTENT_PROXY_PORT ?? 7091);
const TARGET_URL = process.env.PAID_CLICK_INTENT_TARGET_URL?.trim()
  || "http://localhost:7020/api/attribution/paid-click-intent/no-send";
const ALLOWED_PATH = "/api/attribution/paid-click-intent/no-send";
const ALLOWED_ORIGINS = new Set([
  "https://biocom.kr",
  "https://www.biocom.kr",
]);
const MAX_BODY_BYTES = 128 * 1024;

const corsHeaders = (origin?: string) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://biocom.kr";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "300",
    "Vary": "Origin",
  };
};

const readBody = (req: http.IncomingMessage) => new Promise<string>((resolve, reject) => {
  let size = 0;
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      reject(new Error("body too large"));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const writeJson = (res: http.ServerResponse, status: number, origin: string | undefined, body: unknown) => {
  res.writeHead(status, {
    ...corsHeaders(origin),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(body)}\n`);
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === ALLOWED_PATH) {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method !== "POST" || url.pathname !== ALLOWED_PATH) {
    writeJson(res, 404, origin, {
      ok: false,
      error: "not_found",
      allowed_path: ALLOWED_PATH,
      no_write_verified: true,
      no_platform_send_verified: true,
    });
    return;
  }

  let body = "";
  try {
    body = await readBody(req);
  } catch (err) {
    writeJson(res, 413, origin, {
      ok: false,
      error: err instanceof Error ? err.message : "body read failed",
      no_write_verified: true,
      no_platform_send_verified: true,
    });
    return;
  }

  try {
    const targetResponse = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": origin ?? "https://biocom.kr",
      },
      body,
    });
    const responseText = await targetResponse.text();
    res.writeHead(targetResponse.status, {
      ...corsHeaders(origin),
      "Content-Type": targetResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(responseText);
  } catch (err) {
    writeJson(res, 502, origin, {
      ok: false,
      error: err instanceof Error ? err.message : "target request failed",
      target_url: TARGET_URL,
      no_write_verified: true,
      no_platform_send_verified: true,
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(JSON.stringify({
    ok: true,
    receiver: "paid_click_intent_preview_proxy",
    listen: `http://127.0.0.1:${PORT}`,
    allowed_path: ALLOWED_PATH,
    target_url: TARGET_URL,
    no_write_verified: true,
    no_platform_send_verified: true,
  }, null, 2));
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
