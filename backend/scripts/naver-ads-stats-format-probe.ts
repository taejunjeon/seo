/**
 * stats endpoint query 형식 탐색.
 * 정본 가이드의 stats 응답 형식 명시가 모호해 3 가지 시도.
 */
import { createHmac } from "node:crypto";
import "../src/env";

const BASE = "https://api.searchad.naver.com";

const hmacHeaders = (method: string, uri: string) => {
  const access = process.env.BIOCOM_NAVER_ADS_ACESS ?? "";
  const customer = process.env.BIOCOM_NAVER_ADS_CUSTOMER_ID ?? "";
  const secret = process.env.BIOCOM_NAVER_ADS_SECRET_KEY ?? "";
  const ts = Date.now().toString();
  const sig = createHmac("sha256", secret).update(`${ts}.${method}.${uri}`).digest("base64");
  return { "X-Timestamp": ts, "X-API-KEY": access, "X-Customer": customer, "X-Signature": sig };
};

const get = async (path: string, query: Record<string, string>) => {
  const qs = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const url = `${BASE}${path}?${qs}`;
  const res = await fetch(url, { headers: hmacHeaders("GET", path) });
  const text = await res.text();
  return { status: res.status, body: text };
};

const main = async () => {
  // 첫 캠페인 id 가져오기
  const camp = await fetch(`${BASE}/ncc/campaigns`, { headers: hmacHeaders("GET", "/ncc/campaigns") });
  const list = (await camp.json()) as Array<{ nccCampaignId: string; name: string }>;
  const id = list[0].nccCampaignId;
  console.log(`첫 캠페인: ${id} (총 ${list.length}건)`);

  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const until = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const tries = [
    {
      name: "형식 A: ?id=단수 + datePreset",
      path: "/stats",
      query: {
        id,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "convAmt"]),
        datePreset: "LAST_7_DAYS",
      },
    },
    {
      name: "형식 B: ?id=단수 + timeRange",
      path: "/stats",
      query: {
        id,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "convAmt"]),
        timeRange: JSON.stringify({ since, until }),
      },
    },
    {
      name: "형식 C: ?ids=쉼표분리 + timeRange",
      path: "/stats",
      query: {
        ids: id,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "convAmt"]),
        timeRange: JSON.stringify({ since, until }),
      },
    },
    {
      name: "형식 D: ?id=단수 + timeRange + breakdown=day",
      path: "/stats",
      query: {
        id,
        fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "convAmt"]),
        timeRange: JSON.stringify({ since, until }),
        breakdown: "day",
      },
    },
  ];

  for (const t of tries) {
    const r = await get(t.path, t.query);
    console.log(`\n--- ${t.name} ---`);
    console.log(`status: ${r.status}`);
    console.log(`body: ${r.body.slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 600));
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
