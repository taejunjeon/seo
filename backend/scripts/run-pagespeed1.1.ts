import fs from "node:fs";
import path from "node:path";

import { env } from "../src/env";

type Strategy = "mobile" | "desktop";

type LighthouseResponse = {
  lighthouseResult: {
    categories?: Record<string, { score?: number }>;
    audits?: Record<string, any>;
  };
};

const TARGET_URL = "https://biocom.kr";

const fmtBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "-";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const fmtMs = (ms: number) => {
  if (!Number.isFinite(ms)) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
};

const normalizeHost = (host: string) => host.replace(/^www\./i, "").toLowerCase();

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const isFirstPartyHost = (host: string) => {
  const h = normalizeHost(host);
  return h.endsWith("biocom.kr") || h.endsWith("imweb.me");
};

const isTrackingHost = (host: string) => {
  const h = normalizeHost(host);
  return [
    "googletagmanager.com",
    "google-analytics.com",
    "doubleclick.net",
    "googleadservices.com",
    "daumcdn.net",
    "kakao.com",
    "facebook.net",
    "facebook.com",
    "naver.com",
    "criteo.com",
  ].some((d) => h === d || h.endsWith(`.${d}`));
};

const mdTable = (headers: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => String(v).replace(/\|/g, "\\|");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
};

const fetchPsi = async (strategy: Strategy): Promise<LighthouseResponse> => {
  if (!env.PAGESPEED_API_KEY) throw new Error("PAGESPEED_API_KEY is not configured");

  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", TARGET_URL);
  apiUrl.searchParams.set("key", env.PAGESPEED_API_KEY);
  apiUrl.searchParams.set("strategy", strategy);
  apiUrl.searchParams.append("category", "performance");

  const res = await fetch(apiUrl.toString(), { headers: { Accept: "application/json" } });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json) {
    const msg = json?.error?.message ?? `PageSpeed API request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as LighthouseResponse;
};

const extractLcpNode = (audits: Record<string, any>) => {
  const a = audits["lcp-discovery-insight"] ?? audits["lcp-breakdown-insight"];
  const items: any[] = a?.details?.items ?? [];
  const node = items.find((it) => it && (it.type === "node" || it.selector || it.snippet));
  if (!node) return null;

  const snippet = String(node.snippet ?? "");
  const selector = String(node.selector ?? "");
  const nodeLabel = String(node.nodeLabel ?? "").trim();

  let elementType = "텍스트";
  if (/background-image\s*:/i.test(snippet)) elementType = "이미지(background-image)";
  else if (/<img\b/i.test(snippet)) elementType = "이미지(img)";
  else if (/<video\b/i.test(snippet)) elementType = "영상(video)";

  const urlCandidates: string[] = [];
  const re = /https?:\/\/[^"\s&]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet))) {
    urlCandidates.push(m[0]);
  }

  return { elementType, selector, nodeLabel, snippet, urlCandidates };
};

const resolveFullResourceUrl = (candidates: string[], networkRequests: any[]) => {
  if (!candidates.length) return null;
  const reqUrls = new Set<string>((networkRequests ?? []).map((r) => String(r.url ?? "")));

  for (const raw of candidates) {
    const cand = raw.replace(/…+$/g, "");
    if (reqUrls.has(cand)) return cand;
    const startsWith = (networkRequests ?? []).find((r) => typeof r.url === "string" && r.url.startsWith(cand));
    if (startsWith) return String(startsWith.url);
    const contains = (networkRequests ?? []).find((r) => typeof r.url === "string" && r.url.includes(cand));
    if (contains) return String(contains.url);
  }
  return null;
};

const computeLcpBreakdownSimulated = (metricsItem: any) => {
  const lcp = metricsItem?.largestContentfulPaint;
  const ttfb = metricsItem?.timeToFirstByte;
  const reqStart = metricsItem?.lcpLoadDelay;
  const reqEnd = metricsItem?.lcpLoadDuration;
  if (![lcp, ttfb, reqStart, reqEnd].every(Number.isFinite)) return null;

  // Lighthouse simulated metrics debugdata uses timestamps for LCP request start/end (ms since navigation).
  // Derive the four components so that they sum to simulated LCP.
  const loadDelay = reqStart - ttfb;
  const loadTime = reqEnd - reqStart;
  const renderDelay = lcp - reqEnd;

  return { ttfb, loadDelay, loadTime, renderDelay, lcp, reqStart, reqEnd };
};

const pickTopRenderBlocking = (audits: Record<string, any>, networkRequests: any[], n: number) => {
  const items: any[] = audits["render-blocking-insight"]?.details?.items ?? [];
  const byUrl = new Map<string, any>((networkRequests ?? []).map((r) => [String(r.url ?? ""), r]));
  return items
    .filter((it) => it && typeof it.url === "string" && Number.isFinite(it.wastedMs))
    .map((it) => {
      const url = String(it.url);
      const req = byUrl.get(url);
      const type =
        req?.resourceType === "Stylesheet"
          ? "CSS"
          : req?.resourceType === "Script"
            ? "JS"
            : url.endsWith(".css")
              ? "CSS"
              : url.endsWith(".js")
                ? "JS"
                : "기타";
      return { url, type, wastedMs: Number(it.wastedMs), totalBytes: Number(it.totalBytes ?? 0) };
    })
    .filter((it) => it.type === "CSS" || it.type === "JS")
    .sort((a, b) => b.wastedMs - a.wastedMs)
    .slice(0, n);
};

const classifyImportance = (req: any, lcpUrl: string | null) => {
  const url = String(req.url ?? "");
  const host = hostOf(url);

  if (String(req.resourceType ?? "").toLowerCase() === "document") return "첫 화면 필수";
  if (lcpUrl && url === lcpUrl) return "첫 화면 필수(LCP)";
  if (isTrackingHost(host)) return "나중(추적/광고)";
  if (String(req.resourceType ?? "").toLowerCase() === "media") return "나중(미디어)";

  const pr = String(req.priority ?? "");
  const highPr = pr === "VeryHigh" || pr === "High";
  const start = Number.isFinite(req.networkRequestTime) ? Number(req.networkRequestTime) : 999999;
  const early = start < 5000;
  const first = isFirstPartyHost(host);

  if (first && highPr && early && ["Script", "Stylesheet", "Font", "Image"].includes(String(req.resourceType ?? ""))) {
    return "첫 화면 가능성↑";
  }
  if (early && ["Stylesheet", "Font"].includes(String(req.resourceType ?? ""))) return "첫 화면 가능성↑";
  return "나중(지연 가능)";
};

const groupNetworkTop20 = (networkRequests: any[], lcpUrl: string | null) => {
  const top = (networkRequests ?? [])
    .filter((r) => Number.isFinite(r.transferSize) && r.transferSize > 0 && typeof r.url === "string")
    .slice()
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 20)
    .map((r) => {
      const url = String(r.url);
      const host = hostOf(url);
      const importance = classifyImportance(r, lcpUrl);
      const startMs = Number.isFinite(r.networkRequestTime) ? Math.round(r.networkRequestTime) : null;
      const type = String(r.resourceType ?? "Other");
      const mapped =
        type === "Image"
          ? "이미지"
          : type === "Font"
            ? "폰트"
            : type === "Script"
              ? "스크립트"
              : type === "Stylesheet"
                ? "CSS"
                : type === "Media"
                  ? "영상/미디어"
                  : type === "Document"
                    ? "문서"
                    : "기타";

      return {
        mapped,
        importance,
        transferSize: Number(r.transferSize),
        priority: String(r.priority ?? "-"),
        startMs,
        host,
        url,
      };
    });

  const grouped = new Map<string, typeof top>();
  for (const r of top) {
    const list = grouped.get(r.mapped) ?? [];
    list.push(r);
    grouped.set(r.mapped, list);
  }

  return { top, grouped };
};

const thirdPartyCosts = (audits: Record<string, any>) => {
  const items: any[] = audits["third-parties-insight"]?.details?.items ?? [];
  return items
    .filter((it) => it && typeof it.entity === "string")
    .map((it) => ({
      entity: String(it.entity),
      requestCount: Number.isFinite(it.subItems?.items?.length) ? it.subItems.items.length : null,
      transferSize: Number(it.transferSize ?? 0),
      mainThreadTime: Number(it.mainThreadTime ?? 0),
    }))
    .sort((a, b) => b.mainThreadTime - a.mainThreadTime);
};

const buildReportFor = (strategy: Strategy, data: LighthouseResponse) => {
  const audits = data.lighthouseResult.audits ?? {};
  const categories = data.lighthouseResult.categories ?? {};
  const perf = Math.round(((categories as any).performance?.score ?? 0) * 100);

  const lcpSim = Number(audits["largest-contentful-paint"]?.numericValue ?? NaN);
  const fcpSim = Number(audits["first-contentful-paint"]?.numericValue ?? NaN);

  const metricsItem = audits["metrics"]?.details?.items?.[0] ?? {};
  const lcpObs = Number(metricsItem.observedLargestContentfulPaint ?? NaN);
  const fcpObs = Number(metricsItem.observedFirstContentfulPaint ?? NaN);

  const networkRequests: any[] = audits["network-requests"]?.details?.items ?? [];
  const lcpNode = extractLcpNode(audits);
  const lcpUrl = lcpNode ? resolveFullResourceUrl(lcpNode.urlCandidates, networkRequests) : null;
  const lcpReq = lcpUrl ? networkRequests.find((r) => String(r.url) === lcpUrl) : null;

  const lcpBreakSim = computeLcpBreakdownSimulated(metricsItem);
  const renderBlockingTop = pickTopRenderBlocking(audits, networkRequests, 10);
  const netTop = groupNetworkTop20(networkRequests, lcpUrl);
  const thirdParty = thirdPartyCosts(audits);

  const measuredAt = new Date().toISOString();

  let md = `## ${strategy.toUpperCase()} 측정\n\n`;
  md += `- 측정 시각: ${measuredAt}\n`;
  md += `- URL: ${TARGET_URL}\n`;
  md += `- Performance 점수: ${perf}\n`;
  md += `- LCP(시뮬레이션): ${fmtMs(lcpSim)} / LCP(관측): ${fmtMs(lcpObs)}\n`;
  md += `- FCP(시뮬레이션): ${fmtMs(fcpSim)} / FCP(관측): ${fmtMs(fcpObs)}\n\n`;

  md += `### 1) LCP 요소(이번 측정)\n\n`;
  if (lcpNode) {
    md += `- 요소 타입: ${lcpNode.elementType}\n`;
    if (lcpNode.selector) md += `- selector: \`${lcpNode.selector}\`\n`;
    if (lcpNode.nodeLabel) md += `- 화면 텍스트(요약): ${lcpNode.nodeLabel.replace(/\s+/g, " ").slice(0, 120)}\n`;
    md += `- 리소스 URL: ${lcpUrl ?? "(네트워크 목록에서 전체 URL 매칭 실패)"}\n`;
    if (lcpReq) md += `- 전송량(transfer): ${fmtBytes(Number(lcpReq.transferSize ?? 0))} / MIME: ${String(lcpReq.mimeType ?? "-")}\n`;
  } else {
    md += `- (PSI 응답에서 LCP 요소 정보를 찾지 못했습니다)\n`;
  }
  md += `\n`;

  md += `### 2) LCP 구간별 분해(TTFB/로딩지연/다운로드/렌더)\n\n`;
  if (lcpBreakSim) {
    md += mdTable(
      ["구간", "시간"],
      [
        ["TTFB", fmtMs(lcpBreakSim.ttfb)],
        ["로딩 지연(요청 시작까지)", fmtMs(lcpBreakSim.loadDelay)],
        ["다운로드(요청 duration)", fmtMs(lcpBreakSim.loadTime)],
        ["렌더 지연(다운로드 후 paint까지)", fmtMs(lcpBreakSim.renderDelay)],
      ],
    );
    md += `\n\n`;
    const parts = [
      { name: "TTFB", ms: lcpBreakSim.ttfb },
      { name: "로딩 지연(요청 시작까지)", ms: lcpBreakSim.loadDelay },
      { name: "다운로드(요청 duration)", ms: lcpBreakSim.loadTime },
      { name: "렌더 지연(다운로드 후 paint까지)", ms: lcpBreakSim.renderDelay },
    ].sort((a, b) => b.ms - a.ms);
    md += `- 가장 큰 병목: **${parts[0]?.name ?? "-"}**\n`;
    md += `- 참고: PSI는 시뮬레이션/관측 값이 함께 있어 LCP가 과대/과소 추정될 수 있습니다.\n\n`;
  } else {
    md += `- (LCP breakdown 데이터를 계산할 수 없었습니다)\n\n`;
  }

  md += `### 3) FCP를 막는 상위 10개 리소스(CSS/JS) + 낭비 시간(ms)\n\n`;
  if (renderBlockingTop.length) {
    md += mdTable(
      ["#", "타입", "낭비(추정)", "전송량", "URL"],
      renderBlockingTop.map((r, idx) => [
        idx + 1,
        r.type,
        fmtMs(r.wastedMs),
        fmtBytes(r.totalBytes),
        r.url,
      ]),
    );
    md += `\n\n`;
  } else {
    md += `- (render-blocking-insight 항목이 없습니다)\n\n`;
  }

  md += `### 4) 전송량 Top 20 요청(타입별) + “첫 화면” vs “지연” 추천\n\n`;
  for (const [type, list] of netTop.grouped.entries()) {
    md += `#### ${type}\n\n`;
    md += mdTable(
      ["분류", "전송량", "우선순위", "시작", "호스트", "URL"],
      list.map((r) => [
        r.importance,
        fmtBytes(r.transferSize),
        r.priority,
        r.startMs === null ? "-" : `${r.startMs}ms`,
        r.host,
        r.url,
      ]),
    );
    md += `\n\n`;
  }

  md += `### 5) 서드파티 도메인별 비용(요청 수/전송량/메인스레드 시간)\n\n`;
  if (thirdParty.length) {
    md += mdTable(
      ["도메인(entity)", "요청 수", "전송량", "메인스레드 시간"],
      thirdParty.slice(0, 15).map((t) => [
        t.entity,
        t.requestCount ?? "-",
        fmtBytes(t.transferSize),
        fmtMs(t.mainThreadTime),
      ]),
    );
    md += `\n\n`;
  } else {
    md += `- (third-parties-insight 항목이 없습니다)\n\n`;
  }

  md += `### 6) (임웹 제약 가정) 당장 가능한 개선 우선순위\n\n`;
  md += `1. **히어로(첫 화면) 이미지 최적화**: LCP 후보가 큰 PNG인 경우가 많습니다. 가능하면 **WebP/AVIF**로 교체 + 해상도/압축 재조정.\n`;
  md += `2. **추적/광고 스크립트 지연**: 3rd-party JS가 렌더를 막는다면 GTM에서 **동의/인터랙션 후 로드**로 변경.\n`;
  md += `3. **폰트 정리**: 사용 웨이트 수 최소화 + 가능하면 system font + \`font-display: swap\`.\n`;
  md += `4. **영상 로딩 방식**: 첫 화면 영상은 poster 이미지로 대체하고 실제 영상은 **사용자 액션 후 로드**.\n`;
  md += `5. **이미지 Lazy-load 재점검**: 첫 화면 1장(LCP)만 우선 로드, 나머지는 지연.\n\n`;

  return md;
};

const main = async () => {
  const [mobile, desktop] = await Promise.all([fetchPsi("mobile"), fetchPsi("desktop")]);

  let md = `# PageSpeed 실행 결과 (pagespeed1.1)\n\n`;
  md += `- 대상 URL: ${TARGET_URL} (mobile/desktop)\n\n`;
  md += `> PSI는 **시뮬레이션(점수 산정용)** 과 **관측(실측 trace)** 값이 동시에 존재합니다. 아래에는 둘 다 표기했습니다.\n\n`;

  md += buildReportFor("mobile", mobile);
  md += buildReportFor("desktop", desktop);

  const outPath = path.resolve(process.cwd(), "..", "pagespeed1.1.md");
  fs.writeFileSync(outPath, md, "utf8");
  console.log(`wrote ${outPath}`);
};

void main();

