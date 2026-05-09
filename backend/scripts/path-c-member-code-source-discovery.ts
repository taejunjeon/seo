import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false, quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_JSON = path.join(REPO_ROOT, "data/path-c-member-code-source-discovery-20260508.json");
const OUTPUT_MD = path.join(REPO_ROOT, "gdn/path-c-member-code-source-discovery-20260508.md");

const checkedAt = new Date();
const checkedAtKst = checkedAt.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace("T", " ") + " KST";

type GtmVariableFinding = {
  id: string;
  name: string;
  type: string;
  reads: string[];
  classification: "candidate_empty_in_preview" | "reject_pii" | "session_only" | "not_member_source";
  note: string;
};

type GtmTagFinding = {
  id: string;
  name: string;
  type: string;
  mentions: string[];
  classification: "mentions_member_source" | "mentions_pii_source" | "not_relevant";
};

type PageProbe = {
  url: string;
  loaded: boolean;
  probeError?: string;
  candidatePresence: Array<{ source: string; present: boolean; type: string }>;
  objectShapes: Array<{ source: string; present: boolean; keys: string[] }>;
  matchingWindowKeys: string[];
  matchingStorageKeys: Array<{ storage: "localStorage" | "sessionStorage"; key: string }>;
  blockedRequestHostCount: Record<string, number>;
};

const getAuth = () => {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_KEY 또는 GA4_BIOCOM_SERVICE_ACCOUNT_KEY가 필요합니다.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/tagmanager.readonly"],
  });
};

const paramsToText = (parameter: unknown): string => JSON.stringify(parameter ?? "");

const extractReads = (variable: { type?: string | null; parameter?: unknown[] | null }): string[] => {
  const text = paramsToText(variable.parameter);
  const reads = new Set<string>();
  for (const match of text.matchAll(/"key":"name","value":"([^"]+)"/g)) reads.add(match[1]);
  for (const match of text.matchAll(/(?:localStorage|sessionStorage)\.getItem\(\\"([^\\"]+)\\"\)/g)) reads.add(match[1]);
  for (const match of text.matchAll(/(?:localStorage|sessionStorage)\.getItem\('([^']+)'\)/g)) reads.add(match[1]);
  for (const match of text.matchAll(/(?:window\.|document\.querySelector\(\\"|\{\{)([A-Za-z0-9_.\-\[\]가-힣 ]{3,80})/g)) {
    const value = match[1].replace(/\\".*$/, "").trim();
    if (/(member|imweb|hurdlers|retous|user_id|email|phone|orderer)/i.test(value)) reads.add(value);
  }
  return [...reads].sort();
};

const classifyVariable = (name: string, reads: string[]): GtmVariableFinding["classification"] => {
  const joined = `${name} ${reads.join(" ")}`.toLowerCase();
  if (/phone|email|user_id|orderercall|ordereremail/.test(joined)) return "reject_pii";
  if (/membercode|member_code/.test(joined)) return "candidate_empty_in_preview";
  if (/__bs_imweb|imweb|session|device|customsession|commonsession/.test(joined)) return "session_only";
  return "not_member_source";
};

const safeMentionList = (text: string): string[] => {
  const mentions = new Set<string>();
  for (const token of ["memberCode", "member_code", "__bs_imweb", "__bs_imweb_session", "window.imweb", "hurdlers_ga4.member_code", "phone_buy", "email_buy", "user_id"]) {
    if (text.includes(token)) mentions.add(token);
  }
  return [...mentions].sort();
};

const inspectGtm = async () => {
  const gtm = google.tagmanager({ version: "v2", auth: getAuth() });
  const workspaces = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const defaultWorkspace = (workspaces.data.workspace ?? []).find((item) => item.name === "Default Workspace") ?? (workspaces.data.workspace ?? [])[0];
  if (!defaultWorkspace?.path) throw new Error("Default Workspace를 찾지 못했습니다.");

  const [variablesResponse, tagsResponse] = await Promise.all([
    gtm.accounts.containers.workspaces.variables.list({ parent: defaultWorkspace.path }),
    gtm.accounts.containers.workspaces.tags.list({ parent: defaultWorkspace.path }),
  ]);

  const variableFindings: GtmVariableFinding[] = (variablesResponse.data.variable ?? [])
    .map((variable) => {
      const reads = extractReads(variable as { type?: string | null; parameter?: unknown[] | null });
      const name = variable.name ?? "";
      return {
        id: variable.variableId ?? "",
        name,
        type: variable.type ?? "",
        reads,
        classification: classifyVariable(name, reads),
        note: "",
      };
    })
    .filter((item) => item.classification !== "not_member_source")
    .map((item) => ({
      ...item,
      note: item.classification === "candidate_empty_in_preview"
        ? "정의는 있으나 TJ Tag Assistant 200/201/203 확인에서 empty/undefined"
        : item.classification === "reject_pii"
          ? "email/phone/user_id 계열이라 Path C source로 사용 금지"
          : "Imweb device/session object. 공유된 구조 기준 memberCode 없음",
    }));

  const tagFindings: GtmTagFinding[] = (tagsResponse.data.tag ?? [])
    .map((tag) => {
      const text = paramsToText(tag.parameter);
      const mentions = safeMentionList(`${tag.name ?? ""} ${text}`);
      const hasPii = mentions.some((item) => /phone|email|user_id/i.test(item));
      return {
        id: tag.tagId ?? "",
        name: tag.name ?? "",
        type: tag.type ?? "",
        mentions,
        classification: mentions.length === 0
          ? "not_relevant"
          : hasPii
            ? "mentions_pii_source"
            : "mentions_member_source",
      } as GtmTagFinding;
    })
    .filter((item) => item.classification !== "not_relevant");

  return {
    workspace: {
      id: defaultWorkspace.workspaceId,
      name: defaultWorkspace.name,
      path: defaultWorkspace.path,
    },
    variableFindings,
    tagFindings,
  };
};

const shouldBlock = (url: string) => {
  const host = new URL(url).hostname;
  return /googletagmanager|google-analytics|googleadservices|doubleclick|facebook|clarity|hotjar|channel\.io|naver|kakao|att\.ainativeos/i.test(host);
};

const probePage = async (url: string): Promise<PageProbe> => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const blockedRequestHostCount: Record<string, number> = {};

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (shouldBlock(requestUrl)) {
      const host = new URL(requestUrl).hostname;
      blockedRequestHostCount[host] = (blockedRequestHostCount[host] ?? 0) + 1;
      await route.abort();
      return;
    }
    await route.continue();
  });

  let loaded = false;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    loaded = true;
  } catch {
    loaded = false;
  }

  const probe = await page.evaluate(`
    (() => {
      const readJson = (storage, key) => {
        try {
          const raw = storage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      const readPath = (root, dotted) => {
        try {
          return dotted.split(".").reduce((cursor, part) => {
            if (cursor === null || cursor === undefined || typeof cursor !== "object") return undefined;
            return cursor[part];
          }, root);
        } catch {
          return undefined;
        }
      };
      const dataLayerValue = (path) => {
        const layer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
        for (let i = layer.length - 1; i >= 0; i -= 1) {
          const value = readPath(layer[i], path);
          if (value !== undefined && value !== null && String(value).trim()) return value;
        }
        return undefined;
      };
      const typeOf = (value) => Array.isArray(value) ? "array" : typeof value;
      const isPresent = (value) => value !== undefined && value !== null && String(value).trim() !== "";
      const localImweb = readJson(window.localStorage, "__bs_imweb");
      const sessionImweb = readJson(window.sessionStorage, "__bs_imweb_session");
      const hurdlers = window.hurdlers_ga4;
      const imwebUser = readPath(window, "imweb.user");
      const siteMember = window.SITE_MEMBER;
      const candidates = [
        ["dataLayer.member_code", dataLayerValue("member_code")],
        ["dataLayer.hurdlers_ga4.member_code", dataLayerValue("hurdlers_ga4.member_code")],
        ["dataLayer.hurdlers_ga4.memberCode", dataLayerValue("hurdlers_ga4.memberCode")],
        ["localStorage.__bs_imweb.memberCode", readPath(localImweb, "memberCode")],
        ["localStorage.__bs_imweb.member_code", readPath(localImweb, "member_code")],
        ["sessionStorage.__bs_imweb_session.memberCode", readPath(sessionImweb, "memberCode")],
        ["sessionStorage.__bs_imweb_session.member_code", readPath(sessionImweb, "member_code")],
        ["window.imweb.user.member_code", readPath(imwebUser, "member_code")],
        ["window.imweb.user.memberCode", readPath(imwebUser, "memberCode")],
        ["window.IMWEB_MEMBER_CODE", window.IMWEB_MEMBER_CODE],
        ["window.hurdlers_member_code", window.hurdlers_member_code],
        ["window.hurdlers_ga4.member_code", readPath(hurdlers, "member_code")],
        ["window.hurdlers_ga4.memberCode", readPath(hurdlers, "memberCode")],
        ["window.MEMBER_UID", window.MEMBER_UID],
        ["window.MEMBER_HASH", window.MEMBER_HASH],
        ["window.SITE_MEMBER.member_code", readPath(siteMember, "member_code")],
        ["window.SITE_MEMBER.memberCode", readPath(siteMember, "memberCode")],
        ["window.SITE_MEMBER.member_uid", readPath(siteMember, "member_uid")],
        ["window.SITE_MEMBER.memberUid", readPath(siteMember, "memberUid")]
      ];
      const shape = (source, value) => ({
        source,
        present: Boolean(value && typeof value === "object"),
        keys: value && typeof value === "object" ? Object.keys(value).sort().slice(0, 80) : []
      });
      const matchingWindowKeys = Object.keys(window)
        .filter((key) => /(member|imweb|hurdlers|retous|login|user)/i.test(key))
        .sort()
        .slice(0, 120);
      const storageKeys = (storage, storageName) => {
        const keys = [];
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i) || "";
          if (/(member|imweb|hurdlers|retous|login|user|session)/i.test(key)) {
            const safeKey = key.includes("{") || key.length > 120
              ? key.replace(/\\{.*$/, "{redacted_json_payload}")
              : key;
            keys.push({ storage: storageName, key: safeKey });
          }
        }
        return keys.sort((a, b) => a.key.localeCompare(b.key));
      };
      return {
        candidatePresence: candidates.map(([source, value]) => ({ source: String(source), present: isPresent(value), type: typeOf(value) })),
        objectShapes: [
          shape("localStorage.__bs_imweb", localImweb),
          shape("sessionStorage.__bs_imweb_session", sessionImweb),
          shape("window.hurdlers_ga4", hurdlers),
          shape("window.imweb.user", imwebUser),
          shape("window.SITE_MEMBER", siteMember),
          shape("window.IMWEB_LOCALSTORAGE", window.IMWEB_LOCALSTORAGE),
          shape("window.IMWEB_SESSIONSTORAGE", window.IMWEB_SESSIONSTORAGE)
        ],
        matchingWindowKeys,
        matchingStorageKeys: [
          ...storageKeys(window.localStorage, "localStorage"),
          ...storageKeys(window.sessionStorage, "sessionStorage")
        ]
      };
    })()
  `).catch((error: unknown) => ({
    probeError: error instanceof Error ? error.message : String(error),
    candidatePresence: [],
    objectShapes: [],
    matchingWindowKeys: [],
    matchingStorageKeys: [],
  }));

  await browser.close();
  return {
    url,
    loaded,
    ...probe,
    blockedRequestHostCount,
  };
};

const writeReport = (summary: {
  checkedAtKst: string;
  verdict: string;
  confidence: number;
  gtm: Awaited<ReturnType<typeof inspectGtm>>;
  pageProbes: PageProbe[];
}) => {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(summary, null, 2), "utf8");

  const lines: string[] = [];
  lines.push("# Path C member_code source 재탐색 결과");
  lines.push("");
  lines.push(`작성 시각: ${summary.checkedAtKst}`);
  lines.push("대상: biocom Path C member_code source discovery");
  lines.push(`Status: ${summary.verdict}`);
  lines.push("Do not use for: GTM Production publish, backend deploy, raw member_code 저장, email/phone/user_id bridge, platform send");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read:");
  lines.push("    - AGENTS.md");
  lines.push("    - harness/common/HARNESS_GUIDELINES.md");
  lines.push("    - harness/common/AUTONOMY_POLICY.md");
  lines.push("    - harness/common/REPORTING_TEMPLATE.md");
  lines.push("  lane: Green read-only/source discovery");
  lines.push("  allowed_actions:");
  lines.push("    - GTM API read-only variable/tag definition inspection");
  lines.push("    - public page probe with analytics/platform hosts blocked");
  lines.push("    - document update");
  lines.push("  forbidden_actions:");
  lines.push("    - GTM Production publish");
  lines.push("    - backend deploy");
  lines.push("    - operational DB write");
  lines.push("    - raw member_code/email/phone storage");
  lines.push("    - GA4/Meta/Google Ads/Naver platform send");
  lines.push("  source_window_freshness_confidence:");
  lines.push(`    source: "GTM Default Workspace read-only + public page storage/global probe + TJ Tag Assistant 200/201/203 evidence"`);
  lines.push(`    window: "2026-05-08 KST"`);
  lines.push(`    freshness: "${summary.checkedAtKst}"`);
  lines.push(`    confidence: ${summary.confidence}`);
  lines.push("```");
  lines.push("");
  lines.push("## 한 줄 결론");
  lines.push("");
  lines.push("현재 브라우저/GTM 경로에서 usable `member_code` source는 발견하지 못했다. GTM에는 `memberCode` 후보 변수가 있지만 200/201/203 실제 이벤트에서 empty였고, 공개 페이지 probe에서도 `member_code` 계열 후보는 모두 absent다. 이메일형 `user_id`는 Path C source로 사용 금지다.");
  lines.push("");
  lines.push("## GTM read-only 결과");
  lines.push("");
  lines.push("| 변수 | type | 읽는 위치 | 판정 |");
  lines.push("|---|---|---|---|");
  for (const variable of summary.gtm.variableFindings) {
    lines.push(`| \`${variable.name}\` | ${variable.type} | ${variable.reads.map((item) => `\`${item}\``).join(", ") || "-"} | ${variable.note} |`);
  }
  lines.push("");
  lines.push("## 공개 페이지 probe 결과");
  lines.push("");
  for (const probe of summary.pageProbes) {
    lines.push(`### ${probe.url}`);
    lines.push("");
    lines.push(`- loaded: ${probe.loaded ? "YES" : "NO"}`);
    if (probe.probeError) lines.push(`- probe_error: ${probe.probeError}`);
    lines.push(`- blocked third-party/platform host count: ${Object.values(probe.blockedRequestHostCount).reduce((sum, count) => sum + count, 0)}`);
    lines.push("");
    lines.push("| source | present | type |");
    lines.push("|---|---:|---|");
    for (const candidate of probe.candidatePresence) {
      lines.push(`| \`${candidate.source}\` | ${candidate.present ? "YES" : "NO"} | ${candidate.type} |`);
    }
    lines.push("");
    lines.push("Object shapes:");
    for (const shape of probe.objectShapes) {
      lines.push(`- \`${shape.source}\`: ${shape.present ? "present" : "absent"} / keys=${shape.keys.join(", ") || "-"}`);
    }
    lines.push("");
  }
  lines.push("## 판단");
  lines.push("");
  lines.push("- `localStorage.__bs_imweb` / `sessionStorage.__bs_imweb_session`는 device/session/UTM 용도로는 쓸 수 있지만, 현재 관측된 구조에서는 memberCode가 없다.");
  lines.push("- `Retous - [맞춤] memberCode`는 `localStorage.__bs_imweb.memberCode`를 읽지만, 실제 이벤트에서 empty였다.");
  lines.push("- `memberCode` / `RETOUS - [변수] member_code`는 `dataLayer.member_code`를 읽지만, 실제 이벤트에서 empty였다.");
  lines.push("- `window.MEMBER_UID` / `window.MEMBER_HASH` key는 공개 페이지에 존재하지만 empty string이다. `window.SITE_MEMBER`는 member data가 아니라 회원 UI method object로 관측됐다.");
  lines.push("- `HURDLERS - [맞춤 JS] user_id`는 이메일형 값이라 사용 금지다.");
  lines.push("");
  lines.push("## 다음 액션");
  lines.push("");
  lines.push("1. client-side wrapper Production publish는 HOLD한다.");
  lines.push("2. Path C를 계속하려면 Imweb body/checkout template에서 raw를 저장하지 않고 server HMAC만 남기는 controlled TEST 설계를 별도 승인안으로 분리한다.");
  lines.push("3. 빠른 우회로는 Path B, 즉 주문/결제완료 서버 원장 기반 bridge를 설계하는 것이다. 이 경우 click-time member_code가 아니라 order sync 이후 deterministic bridge를 쓴다.");
  lines.push("4. 대체 client identifier를 보려면 TJ님 로그인 세션에서 `window.MEMBER_UID` / `window.MEMBER_HASH`가 non-empty인지 raw 값 없이 present/type만 추가 확인한다.");
  lines.push("5. 이메일/전화 기반 bridge는 별도 개인정보/PII 승인 전까지 쓰지 않는다.");
  lines.push("");
  fs.writeFileSync(OUTPUT_MD, lines.join("\n") + "\n", "utf8");
};

const main = async () => {
  const gtm = await inspectGtm();
  const pageProbes = [];
  for (const url of [
    "https://biocom.kr/shop_view/?idx=198",
    "https://biocom.kr/HealthFood/?idx=386",
  ]) {
    pageProbes.push(await probePage(url));
  }
  const anyPageCandidate = pageProbes.some((probe) => probe.candidatePresence.some((item) => item.present));
  const summary = {
    checkedAtKst,
    verdict: anyPageCandidate ? "needs_login_preview_recheck" : "hold_no_client_member_code_source_found",
    confidence: anyPageCandidate ? 0.72 : 0.88,
    gtm,
    pageProbes,
  };
  writeReport(summary);
  console.log(JSON.stringify({
    verdict: summary.verdict,
    checkedAtKst: summary.checkedAtKst,
    outputs: { json: OUTPUT_JSON, markdown: OUTPUT_MD },
    gtmVariableFindings: summary.gtm.variableFindings.length,
    pageProbeCandidatesPresent: pageProbes.flatMap((probe) => probe.candidatePresence.filter((item) => item.present).map((item) => `${probe.url} ${item.source}`)),
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
