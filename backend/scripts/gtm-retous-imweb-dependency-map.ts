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
const OUTPUT_JSON = path.join(REPO_ROOT, "data/gtm-retous-imweb-dependency-map-20260508.json");

type Classification = "keep" | "critical_do_not_touch" | "deprecate_candidate" | "pii_risk" | "unknown";

type VariableNode = {
  id: string;
  name: string;
  type: string;
  classification: Classification;
  readsOrMentions: string[];
  referencedByTags: Array<{ id: string; name: string; type: string; classification: Classification }>;
  notes: string[];
};

type TagNode = {
  id: string;
  name: string;
  type: string;
  classification: Classification;
  triggerIds: string[];
  triggerNames: string[];
  variableRefs: string[];
  mentions: string[];
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

const extractVariableRefs = (text: string): string[] => {
  const refs = new Set<string>();
  for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    const ref = String(match[1] ?? "").trim();
    if (ref) refs.add(ref);
  }
  return [...refs].sort();
};

const addRegexMatches = (target: Set<string>, text: string, regex: RegExp) => {
  for (const match of text.matchAll(regex)) {
    const value = String(match[1] ?? "").trim();
    if (value) target.add(value);
  }
};

const extractReadsOrMentions = (name: string, parameter: unknown[] | null | undefined): string[] => {
  const text = `${name} ${paramsToText(parameter)}`;
  const reads = new Set<string>();
  addRegexMatches(reads, text, /"key":"name","value":"([^"]+)"/g);
  addRegexMatches(reads, text, /(?:localStorage|sessionStorage)\.getItem\(\\"([^\\"]+)\\"\)/g);
  addRegexMatches(reads, text, /(?:localStorage|sessionStorage)\.getItem\('([^']+)'\)/g);
  addRegexMatches(reads, text, /document\.querySelector\(\\"([^\\"]+)\\"\)/g);
  addRegexMatches(reads, text, /document\.querySelector\('([^']+)'\)/g);
  for (const token of [
    "__bs_imweb",
    "__bs_imweb_session",
    "hurdlers_ga4.member_code",
    "member_code",
    "memberCode",
    "email_buy",
    "email_reg",
    "phone_buy",
    "phone_reg",
    "user_id",
    ".email-info",
    "order_no",
    "payment_key",
    "UPDE_buy_em_pn",
    "UPDE_reg_em_pn",
    "Retous",
    "RETOUS",
  ]) {
    if (text.includes(token)) reads.add(token);
  }
  return [...reads].sort();
};

const isRelevant = (name: string, readsOrMentions: string[], refs: string[] = []) => {
  const joined = `${name} ${readsOrMentions.join(" ")} ${refs.join(" ")}`.toLowerCase();
  return /(retous|imweb|hurdlers|membercode|member_code|email|phone|user_id|upde|order_no|payment_key)/i.test(joined);
};

const classify = (input: { name: string; type?: string; readsOrMentions?: string[]; variableRefs?: string[]; isTag?: boolean }): Classification => {
  const joined = `${input.name} ${input.type ?? ""} ${(input.readsOrMentions ?? []).join(" ")} ${(input.variableRefs ?? []).join(" ")}`.toLowerCase();
  if (/email|phone|user_id|upde|email-info/.test(joined)) return "pii_risk";
  if (input.isTag && /(구매|purchase|npay|네이버페이|google|ga4|ads|전환|channel|채널톡|user_id)/i.test(input.name)) {
    return "critical_do_not_touch";
  }
  if (/membercode|member_code/.test(joined)) return "deprecate_candidate";
  if (/retous|imweb|hurdlers|utm_|session/.test(joined)) return "keep";
  return "unknown";
};

const notesFor = (classification: Classification, isTag: boolean): string[] => {
  if (classification === "pii_risk") {
    return [
      "raw email/phone/user_id 재사용 금지",
      "Path B 승인 범위 안의 server-side HMAC hash-only Preview는 별도 승인으로 허용 가능",
    ];
  }
  if (classification === "critical_do_not_touch") {
    return ["구매/전환/광고/GA4 영향 가능성이 있어 pause/delete 금지", "정리하려면 별도 dependency review와 Preview 필요"];
  }
  if (classification === "deprecate_candidate") {
    return ["memberCode 계열 기대 흔적이 있으나 2026-05-08 evidence 기준 empty", "즉시 삭제 금지, 후보로만 표시"];
  }
  if (classification === "keep") {
    return [isTag ? "기존 태그 흐름 유지" : "session/UTM/dataLayer 보조 변수로 유지"];
  }
  return ["정의만으로 영향 판단 부족, 변경 전 추가 조사 필요"];
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

  const triggersById = new Map(
    (triggersResponse.data.trigger ?? []).map((trigger) => [trigger.triggerId ?? "", trigger.name ?? ""]),
  );

  const tags: TagNode[] = (tagsResponse.data.tag ?? []).map((tag) => {
    const text = `${tag.name ?? ""} ${paramsToText(tag.parameter)}`;
    const variableRefs = extractVariableRefs(text);
    const mentions = extractReadsOrMentions(tag.name ?? "", tag.parameter);
    const triggerIds = [
      ...(tag.firingTriggerId ?? []),
      ...(tag.blockingTriggerId ?? []).map((id) => `blocking:${id}`),
    ];
    const classification = classify({
      name: tag.name ?? "",
      type: tag.type ?? "",
      readsOrMentions: mentions,
      variableRefs,
      isTag: true,
    });
    return {
      id: tag.tagId ?? "",
      name: tag.name ?? "",
      type: tag.type ?? "",
      classification,
      triggerIds,
      triggerNames: triggerIds.map((id) => {
        const normalizedId = id.replace(/^blocking:/, "");
        const prefix = id.startsWith("blocking:") ? "blocking:" : "";
        return `${prefix}${triggersById.get(normalizedId) ?? normalizedId}`;
      }),
      variableRefs,
      mentions,
      notes: notesFor(classification, true),
    };
  });

  const tagsByVariable = new Map<string, TagNode[]>();
  for (const tag of tags) {
    for (const variableName of tag.variableRefs) {
      const current = tagsByVariable.get(variableName) ?? [];
      current.push(tag);
      tagsByVariable.set(variableName, current);
    }
  }

  const variables: VariableNode[] = (variablesResponse.data.variable ?? []).map((variable) => {
    const name = variable.name ?? "";
    const readsOrMentions = extractReadsOrMentions(name, variable.parameter);
    const classification = classify({ name, type: variable.type ?? "", readsOrMentions });
    const referencedByTags = (tagsByVariable.get(name) ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      type: tag.type,
      classification: tag.classification,
    }));
    return {
      id: variable.variableId ?? "",
      name,
      type: variable.type ?? "",
      classification,
      readsOrMentions,
      referencedByTags,
      notes: notesFor(classification, false),
    };
  });

  const relevantVariables = variables
    .filter((variable) => isRelevant(variable.name, variable.readsOrMentions) || variable.referencedByTags.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const relevantTags = tags
    .filter((tag) => isRelevant(tag.name, tag.mentions, tag.variableRefs) || tag.variableRefs.some((ref) => relevantVariables.some((variable) => variable.name === ref)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const classificationCounts = [...relevantVariables, ...relevantTags].reduce<Record<string, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});

  const output = {
    checkedAtKst,
    site: "biocom",
    lane: "Green GTM read-only dependency map",
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: "GTM-W2Z6PHN",
      workspaceId: defaultWorkspace.workspaceId ?? "",
      workspaceName: defaultWorkspace.name ?? "",
    },
    totals: {
      variablesInContainer: variablesResponse.data.variable?.length ?? 0,
      tagsInContainer: tagsResponse.data.tag?.length ?? 0,
      triggersInContainer: triggersResponse.data.trigger?.length ?? 0,
      relevantVariables: relevantVariables.length,
      relevantTags: relevantTags.length,
    },
    classificationCounts,
    runtimeFiringCounts: {
      availableViaGtmApi: false,
      note: "GTM API read-only definitions do not expose Tag Assistant runtime firing counts. Manual 200/201/203 evidence is documented in markdown.",
    },
    variables: relevantVariables,
    tags: relevantTags,
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    checkedAtKst,
    output: OUTPUT_JSON,
    totals: output.totals,
    classificationCounts,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
