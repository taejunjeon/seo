import { NextRequest, NextResponse } from "next/server";

const VM_CLOUD_API_BASE = "https://att.ainativeos.net";

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const upstream = new URL("/api/google-ads/confirmed-purchase/private-payload-preview", VM_CLOUD_API_BASE);

  ["site", "window", "limit"].forEach((key) => {
    const value = sourceUrl.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  });

  const response = await fetch(upstream.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
