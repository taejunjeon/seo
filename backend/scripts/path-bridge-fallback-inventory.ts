import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false, quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_JSON = path.join(REPO_ROOT, "data/path-bridge-fallback-inventory-20260508.json");
const SOURCE_DISCOVERY_JSON = path.join(REPO_ROOT, "data/path-c-member-code-source-discovery-20260508.json");

type InventoryKind =
  | "email_like"
  | "phone_like"
  | "user_id_email_like"
  | "member_code_candidate"
  | "imweb_retous_storage"
  | "order_payment_candidate"
  | "session_tracking"
  | "other";

type RiskClass =
  | "raw_pii_prohibited"
  | "hashed_yellow_candidate"
  | "path_c_candidate_currently_empty"
  | "session_only_keep"
  | "order_payment_hash_only"
  | "unknown_review";

type InventoryItem = {
  id: string;
  name: string;
  entityType: "variable" | "tag";
  gtmType: string;
  kind: InventoryKind;
  riskClass: RiskClass;
  recommendation:
    | "do_not_use_raw"
    | "yellow_hmac_only"
    | "path_c_hold"
    | "keep_readonly"
    | "design_hash_only"
    | "review_before_change";
  readsOrMentions: string[];
  notes: string[];
};

const checkedAt = new Date();
const checkedAtKst = `${checkedAt.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace("T", " ")} KST`;

const getAuth = () => {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_KEY 또는 GA4_BIOCOM_SERVICE_ACCOUNT_KEY가 필요합니다.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/tagmanager.readonly"],
  });
};

const paramsToText = (parameter: unknown): string => JSON.stringify(parameter ?? "");

const addRegexMatches = (target: Set<string>, text: string, regex: RegExp) => {
  for (const match of text.matchAll(regex)) {
    const value = String(match[1] ?? "").trim();
    if (value) target.add(value);
  }
};

const extractReads = (entity: { name?: string | null; parameter?: unknown[] | null }): string[] => {
  const text = `${entity.name ?? ""} ${paramsToText(entity.parameter)}`;
  const reads = new Set<string>();
  addRegexMatches(reads, text, /"key":"name","value":"([^"]+)"/g);
  addRegexMatches(reads, text, /(?:localStorage|sessionStorage)\.getItem\(\\"([^\\"]+)\\"\)/g);
  addRegexMatches(reads, text, /(?:localStorage|sessionStorage)\.getItem\('([^']+)'\)/g);
  addRegexMatches(reads, text, /document\.querySelector\(\\"([^\\"]+)\\"\)/g);
  addRegexMatches(reads, text, /document\.querySelector\('([^']+)'\)/g);

  const tokenHints = [
    "__bs_imweb",
    "__bs_imweb_session",
    "hurdlers_ga4.member_code",
    "member_code",
    "memberCode",
    "window.imweb",
    "window.MEMBER_UID",
    "window.MEMBER_HASH",
    "email_buy",
    "email_reg",
    "phone_buy",
    "phone_reg",
    "user_id",
    ".email-info",
    "order_no",
    "order_number",
    "payment_key",
    "paymentKey",
    "UPDE_buy_em_pn",
    "UPDE_reg_em_pn",
    "Retous",
    "RETOUS",
  ];
  for (const token of tokenHints) {
    if (text.includes(token)) reads.add(token);
  }

  return [...reads].sort();
};

const classifyKind = (name: string, readsOrMentions: string[]): InventoryKind => {
  const joined = `${name} ${readsOrMentions.join(" ")}`.toLowerCase();
  if (/email/.test(joined)) return "email_like";
  if (/phone|tel|callnum/.test(joined)) return "phone_like";
  if (/user_id|email-info/.test(joined)) return "user_id_email_like";
  if (/order_no|order_number|payment_key|paymentkey|orderno/.test(joined)) return "order_payment_candidate";
  if (/membercode|member_code|member_uid|member_hash/.test(joined)) return "member_code_candidate";
  if (/retous|__bs_imweb|imweb|hurdlers/.test(joined)) return "imweb_retous_storage";
  if (/client_id|ga_session|utm_|gclid|gbraid|wbraid|session/.test(joined)) return "session_tracking";
  return "other";
};

const classifyRisk = (kind: InventoryKind): Pick<InventoryItem, "riskClass" | "recommendation" | "notes"> => {
  switch (kind) {
    case "email_like":
    case "phone_like":
    case "user_id_email_like":
      return {
        riskClass: "raw_pii_prohibited",
        recommendation: "do_not_use_raw",
        notes: [
          "원문 저장/로그/전송 금지",
          "HMAC hash fallback은 개인정보/Yellow 승인 후보로만 검토",
        ],
      };
    case "member_code_candidate":
      return {
        riskClass: "path_c_candidate_currently_empty",
        recommendation: "path_c_hold",
        notes: [
          "Path C 기본 방향은 유지",
          "2026-05-08 GTM/Tag Assistant/source discovery 기준 현재 값 없음",
        ],
      };
    case "imweb_retous_storage":
      return {
        riskClass: "session_only_keep",
        recommendation: "keep_readonly",
        notes: [
          "현재 관측 구조는 device/session/UTM 중심",
          "pause/delete 없이 source 후보 여부만 관찰",
        ],
      };
    case "order_payment_candidate":
      return {
        riskClass: "order_payment_hash_only",
        recommendation: "design_hash_only",
        notes: [
          "Path B 설계 후보",
          "raw order/payment/value 저장 없이 HMAC hash만 허용 후보",
        ],
      };
    default:
      return {
        riskClass: "unknown_review",
        recommendation: "review_before_change",
        notes: ["이번 변경에서 pause/delete 금지"],
      };
  }
};

const shouldInclude = (item: InventoryItem) =>
  item.kind !== "other" || /retous|hurdlers|imweb|user|email|phone|member|order|payment/i.test(item.name);

const toInventoryItem = (
  entityType: InventoryItem["entityType"],
  entity: { variableId?: string | null; tagId?: string | null; name?: string | null; type?: string | null; parameter?: unknown[] | null },
): InventoryItem => {
  const name = entity.name ?? "";
  const readsOrMentions = extractReads(entity);
  const kind = classifyKind(name, readsOrMentions);
  const risk = classifyRisk(kind);
  return {
    id: entityType === "variable" ? entity.variableId ?? "" : entity.tagId ?? "",
    name,
    entityType,
    gtmType: entity.type ?? "",
    kind,
    ...risk,
    readsOrMentions,
  };
};

const loadSourceDiscoverySummary = () => {
  if (!fs.existsSync(SOURCE_DISCOVERY_JSON)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(SOURCE_DISCOVERY_JSON, "utf8")) as {
      checkedAtKst?: string;
      verdict?: string;
      confidence?: number;
      gtm?: { variableFindings?: unknown[]; tagFindings?: unknown[] };
      pageProbes?: Array<{ candidatePresence?: Array<{ present?: boolean }> }>;
    };
    const pageProbeCandidatesPresent = (parsed.pageProbes ?? []).reduce(
      (count, probe) => count + (probe.candidatePresence ?? []).filter((candidate) => candidate.present).length,
      0,
    );
    return {
      checkedAtKst: parsed.checkedAtKst ?? "",
      verdict: parsed.verdict ?? "unknown",
      confidence: parsed.confidence ?? null,
      gtmVariableFindings: parsed.gtm?.variableFindings?.length ?? 0,
      gtmTagFindings: parsed.gtm?.tagFindings?.length ?? 0,
      pageProbeCandidatesPresent,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const main = async () => {
  const gtm = google.tagmanager({ version: "v2", auth: getAuth() });
  const workspaces = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const defaultWorkspace =
    (workspaces.data.workspace ?? []).find((item) => item.name === "Default Workspace") ??
    (workspaces.data.workspace ?? [])[0];
  if (!defaultWorkspace?.path) throw new Error("Default Workspace를 찾지 못했습니다.");

  const [variablesResponse, tagsResponse, triggersResponse] = await Promise.all([
    gtm.accounts.containers.workspaces.variables.list({ parent: defaultWorkspace.path }),
    gtm.accounts.containers.workspaces.tags.list({ parent: defaultWorkspace.path }),
    gtm.accounts.containers.workspaces.triggers.list({ parent: defaultWorkspace.path }),
  ]);

  const variables = (variablesResponse.data.variable ?? [])
    .map((variable) => toInventoryItem("variable", variable))
    .filter(shouldInclude);
  const tags = (tagsResponse.data.tag ?? [])
    .map((tag) => toInventoryItem("tag", tag))
    .filter(shouldInclude);

  const items = [...variables, ...tags].sort((a, b) =>
    `${a.entityType}:${a.name}`.localeCompare(`${b.entityType}:${b.name}`),
  );
  const countsByKind = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  const countsByRisk = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.riskClass] = (acc[item.riskClass] ?? 0) + 1;
    return acc;
  }, {});

  const summary = {
    checkedAtKst,
    site: "biocom",
    lane: "Green read-only GTM inventory",
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: "GTM-W2Z6PHN",
      workspaceId: defaultWorkspace.workspaceId ?? "",
      workspaceName: defaultWorkspace.name ?? "",
    },
    sourceDiscoverySummary: loadSourceDiscoverySummary(),
    totals: {
      variablesInContainer: variablesResponse.data.variable?.length ?? 0,
      tagsInContainer: tagsResponse.data.tag?.length ?? 0,
      triggersInContainer: triggersResponse.data.trigger?.length ?? 0,
      relevantItems: items.length,
      relevantVariables: variables.length,
      relevantTags: tags.length,
    },
    countsByKind,
    countsByRisk,
    decisions: {
      rawEmailBridge: "NO",
      emailHashBridge: "Yellow/privacy approval candidate only",
      pathCMemberCode: "HOLD until usable browser/server source exists",
      pathBOrderConfirmBeacon: "Recommended design path for member + guest bridge",
      bulkGtmCleanup: "NO, inventory and risk classification only",
    },
    items,
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    checkedAtKst,
    output: OUTPUT_JSON,
    relevantItems: items.length,
    countsByKind,
    countsByRisk,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
