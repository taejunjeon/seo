import { env } from "./env";

const ALIGO_BASE_URL = "https://kakaoapi.aligo.in";
const ALIGO_SMS_BASE_URL = "https://apis.aligo.in";

export type AligoProbeResult =
  | {
      ok: true;
      path: string;
      status: number;
      body: unknown;
    }
  | {
      ok: false;
      path: string;
      status?: number;
      reason: "missing_credentials" | "api_error";
      message: string;
      body?: unknown;
    };

export type AligoTestSendInput = {
  tplCode: string;
  receiver: string;
  recvname?: string;
  subject: string;
  message: string;
  emtitle?: string;
  button?: unknown;
  sender?: string;
  senddate?: string;
  failover?: "Y" | "N";
  fsubject?: string;
  fmessage?: string;
  testMode?: "Y" | "N";
};

export type AligoHistoryListInput = {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export type AligoHistoryDetailInput = {
  mid: string;
  page?: number;
  limit?: number;
};

export const getAligoConfigStatus = () => ({
  apiKeyConfigured: !!env.ALIGO_API_KEY,
  userIdConfigured: !!env.ALIGO_USER_ID,
  senderKeyConfigured: !!env.ALIGO_SENDER_KEY,
  senderPhoneConfigured: !!env.ALIGO_SENDER_PHONE,
  kakaoChannelIdConfigured: !!env.ALIGO_KAKAOCHANNEL_ID,
  ready: !!env.ALIGO_API_KEY && !!env.ALIGO_USER_ID && !!env.ALIGO_SENDER_KEY,
  sourceOfTruth: "seo-backend-env",
  notes: [
    "알리고 test-mode 전송은 provider side effect가 남을 수 있으므로 testMode=Y를 기본값으로 쓴다.",
    "승인된 템플릿 코드가 없으면 send-test는 막히고 profile/template/quota 조회만 먼저 닫는다.",
  ],
});

export const buildAligoTemplateListForm = (senderKey = env.ALIGO_SENDER_KEY) => {
  const form = buildBaseFormData();
  if (senderKey) form.set("senderkey", senderKey);
  return form;
};

export const buildAligoTestSendForm = (input: AligoTestSendInput) => {
  const form = buildBaseFormData();
  form.set("senderkey", env.ALIGO_SENDER_KEY ?? "");
  form.set("tpl_code", input.tplCode);
  form.set("sender", input.sender ?? env.ALIGO_SENDER_PHONE ?? "");
  form.set("receiver_1", input.receiver);
  form.set("recvname_1", input.recvname ?? "테스트수신자");
  form.set("subject_1", input.subject);
  form.set("message_1", input.message);
  form.set("testMode", input.testMode ?? "Y");
  if (input.emtitle) form.set("emtitle_1", input.emtitle);
  if (input.senddate) form.set("senddate", input.senddate);
  if (input.failover) form.set("failover", input.failover);
  if (input.fsubject) form.set("fsubject_1", input.fsubject);
  if (input.fmessage) form.set("fmessage_1", input.fmessage);
  if (input.button) {
    form.set(
      "button_1",
      typeof input.button === "string" ? input.button : JSON.stringify(input.button),
    );
  }
  return form;
};

export const buildAligoHistoryListForm = (input: AligoHistoryListInput = {}) => {
  const form = buildBaseFormData();
  form.set("page", String(input.page ?? 1));
  form.set("page_size", String(input.limit ?? 50));
  if (input.startDate) form.set("start_date", input.startDate);
  if (input.endDate) form.set("end_date", input.endDate);
  return form;
};

export const buildAligoHistoryDetailForm = (input: AligoHistoryDetailInput) => {
  const form = buildBaseFormData();
  form.set("mid", input.mid);
  form.set("page", String(input.page ?? 1));
  form.set("page_size", String(input.limit ?? 50));
  return form;
};

export const verifyAligoAccess = async (): Promise<AligoProbeResult> => {
  if (!getAligoConfigStatus().ready) {
    return {
      ok: false,
      path: "/akv10/profile/list/",
      reason: "missing_credentials",
      message: "ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY 중 하나 이상이 없다.",
    };
  }

  return postAligo("/akv10/profile/list/", buildBaseFormData());
};

export const listAligoProfiles = async (): Promise<AligoProbeResult> => {
  return postAligo("/akv10/profile/list/", buildBaseFormData());
};

export const listAligoTemplates = async (senderKey = env.ALIGO_SENDER_KEY): Promise<AligoProbeResult> => {
  return postAligo("/akv10/template/list/", buildAligoTemplateListForm(senderKey));
};

export const getAligoQuota = async (): Promise<AligoProbeResult> => {
  return postAligo("/akv10/heartinfo/", buildBaseFormData());
};

export const sendAligoTest = async (input: AligoTestSendInput): Promise<AligoProbeResult> => {
  return postAligo("/akv10/alimtalk/send/", buildAligoTestSendForm(input));
};

export const sendAligo = async (input: AligoTestSendInput): Promise<AligoProbeResult> => {
  return postAligo(
    "/akv10/alimtalk/send/",
    buildAligoTestSendForm({
      ...input,
      testMode: input.testMode ?? "Y",
    }),
  );
};

export type AligoSmsInput = {
  receiver: string;
  message: string;
  sender?: string;
  testMode?: "Y" | "N";
};

export const sendAligoSms = async (input: AligoSmsInput): Promise<AligoProbeResult> => {
  const config = getAligoConfigStatus();
  if (!config.ready) {
    return { ok: false, path: "/send/", reason: "missing_credentials", message: "알리고 자격증명 없음" };
  }
  const form = new URLSearchParams();
  if (env.ALIGO_API_KEY) form.set("key", env.ALIGO_API_KEY);
  if (env.ALIGO_USER_ID) form.set("user_id", env.ALIGO_USER_ID);
  form.set("sender", input.sender ?? env.ALIGO_SENDER_PHONE ?? "");
  form.set("receiver", input.receiver);
  form.set("msg", input.message);
  form.set("testmode_yn", input.testMode ?? "Y");

  const response = await fetch(`${ALIGO_SMS_BASE_URL}/send/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form,
  });

  let body: unknown = null;
  try { body = await response.json(); } catch { body = await response.text(); }
  const code = extractNumericCode(body);

  if (!response.ok || code < 0) {
    return { ok: false, path: "/send/", status: response.status, reason: "api_error", message: `SMS 발송 실패: ${response.status}`, body };
  }
  return { ok: true, path: "/send/", status: response.status, body };
};

// ── 템플릿 CRUD ──

export type AligoTemplateCreateInput = {
  tplName: string;
  tplContent: string;
  templateType?: string; // BA(기본), EX(부가), AD(광고)
  buttons?: unknown;
};

export const createAligoTemplate = async (input: AligoTemplateCreateInput): Promise<AligoProbeResult> => {
  const form = buildBaseFormData();
  form.set("senderkey", env.ALIGO_SENDER_KEY ?? "");
  form.set("tpl_name", input.tplName);
  form.set("tpl_content", input.tplContent);
  if (input.templateType) form.set("tpl_type", input.templateType);
  if (input.buttons) {
    form.set("tpl_button", typeof input.buttons === "string" ? input.buttons : JSON.stringify(input.buttons));
  }
  return postAligo("/akv10/template/add/", form);
};

export const requestAligoTemplateReview = async (tplCode: string): Promise<AligoProbeResult> => {
  const form = buildBaseFormData();
  form.set("senderkey", env.ALIGO_SENDER_KEY ?? "");
  form.set("tpl_code", tplCode);
  return postAligo("/akv10/template/request/", form);
};

export const deleteAligoTemplate = async (tplCode: string): Promise<AligoProbeResult> => {
  const form = buildBaseFormData();
  form.set("senderkey", env.ALIGO_SENDER_KEY ?? "");
  form.set("tpl_code", tplCode);
  return postAligo("/akv10/template/del/", form);
};

export const listAligoHistory = async (input: AligoHistoryListInput = {}): Promise<AligoProbeResult> => {
  return postAligo("/akv10/history/list/", buildAligoHistoryListForm(input));
};

export const getAligoHistoryDetail = async (input: AligoHistoryDetailInput): Promise<AligoProbeResult> => {
  return postAligo("/akv10/history/detail/", buildAligoHistoryDetailForm(input));
};

const buildBaseFormData = () => {
  const form = new URLSearchParams();
  if (env.ALIGO_API_KEY) form.set("apikey", env.ALIGO_API_KEY);
  if (env.ALIGO_USER_ID) form.set("userid", env.ALIGO_USER_ID);
  return form;
};

const postAligo = async (path: string, form: URLSearchParams): Promise<AligoProbeResult> => {
  const config = getAligoConfigStatus();
  if (!config.ready) {
    return {
      ok: false,
      path,
      reason: "missing_credentials",
      message: "알리고 기본 자격증명이 비어 있다.",
    };
  }

  const response = await fetch(`${ALIGO_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: form,
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }

  const code = extractNumericCode(body);
  if (!response.ok || code < 0) {
    return {
      ok: false,
      path,
      status: response.status,
      reason: "api_error",
      message: `알리고 API 호출 실패: ${response.status}`,
      body,
    };
  }

  return {
    ok: true,
    path,
    status: response.status,
    body,
  };
};

const extractNumericCode = (body: unknown): number => {
  if (!body || typeof body !== "object") return 0;
  const bodyRecord = body as Record<string, unknown>;
  const rawCode = bodyRecord.code ?? bodyRecord.result_code ?? 0;
  if (typeof rawCode === "number") return rawCode;
  if (typeof rawCode === "string") {
    const parsed = Number(rawCode);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export type AligoRenderPreviewInput = {
  templateCode: string;
  variables?: Record<string, string>;
};

export type AligoRenderPreviewResult = {
  ok: boolean;
  templateCode: string;
  templateName: string;
  approvedTemplate: string;
  renderedBody: string;
  buttons: Array<{ name: string; linkType: string; linkMo?: string }>;
  variablesFound: string[];
  variablesProvided: string[];
  variablesMissing: string[];
  exactMatch: boolean;
  warnings: string[];
};

type AligoRenderPreviewButton = {
  name: string;
  linkType: string;
  linkMo?: string;
};

type AligoTemplatePreview = {
  templateCode: string;
  templateName: string;
  approvedTemplate: string;
  buttons: AligoRenderPreviewButton[];
};

export const renderAligoPreview = async (
  input: AligoRenderPreviewInput,
): Promise<AligoRenderPreviewResult> => {
  const normalizedTemplateCode = input.templateCode.trim();
  const normalizedVariables = normalizeAligoPreviewVariables(input.variables);
  const variablesProvided = Object.keys(normalizedVariables);

  if (!normalizedTemplateCode) {
    return {
      ok: false,
      templateCode: normalizedTemplateCode,
      templateName: "",
      approvedTemplate: "",
      renderedBody: "",
      buttons: [],
      variablesFound: [],
      variablesProvided,
      variablesMissing: [],
      exactMatch: false,
      warnings: ["templateCode is required"],
    };
  }

  const templateResult = await listAligoTemplates();
  if (!templateResult.ok) {
    return {
      ok: false,
      templateCode: normalizedTemplateCode,
      templateName: "",
      approvedTemplate: "",
      renderedBody: "",
      buttons: [],
      variablesFound: [],
      variablesProvided,
      variablesMissing: [],
      exactMatch: false,
      warnings: [buildAligoPreviewFailureWarning(templateResult)],
    };
  }

  const template = findAligoTemplateByCode(templateResult.body, normalizedTemplateCode);
  if (!template) {
    return {
      ok: false,
      templateCode: normalizedTemplateCode,
      templateName: "",
      approvedTemplate: "",
      renderedBody: "",
      buttons: [],
      variablesFound: [],
      variablesProvided,
      variablesMissing: [],
      exactMatch: false,
      warnings: [`승인된 알리고 템플릿을 찾지 못했다: ${normalizedTemplateCode}`],
    };
  }

  const variablesFound = extractAligoTemplateVariables(template.approvedTemplate);
  const variablesMissing = variablesFound.filter(
    (variableName) => !Object.prototype.hasOwnProperty.call(normalizedVariables, variableName),
  );
  const renderedBody = renderApprovedAligoTemplate(template.approvedTemplate, normalizedVariables);
  const warnings: string[] = [];

  if (!template.approvedTemplate) {
    warnings.push("승인 템플릿 본문이 비어 있다.");
  }

  if (variablesMissing.length > 0) {
    warnings.push(`치환되지 않은 변수: ${variablesMissing.join(", ")}`);
  }

  const unusedVariables = variablesProvided.filter(
    (variableName) => !variablesFound.includes(variableName),
  );
  if (unusedVariables.length > 0) {
    warnings.push(`템플릿에서 사용되지 않는 변수: ${unusedVariables.join(", ")}`);
  }

  const ok = template.approvedTemplate.length > 0;

  return {
    ok,
    templateCode: template.templateCode,
    templateName: template.templateName,
    approvedTemplate: template.approvedTemplate,
    renderedBody,
    buttons: template.buttons,
    variablesFound,
    variablesProvided,
    variablesMissing,
    exactMatch: ok && variablesMissing.length === 0,
    warnings,
  };
};

const buildAligoPreviewFailureWarning = (
  result: Extract<AligoProbeResult, { ok: false }>,
): string => {
  if (result.reason === "missing_credentials") {
    return `알리고 템플릿 조회 실패: ${result.message}`;
  }
  return `알리고 템플릿 조회 실패(${result.status ?? "unknown"}): ${result.message}`;
};

const findAligoTemplateByCode = (
  body: unknown,
  templateCode: string,
): AligoTemplatePreview | null => {
  for (const item of extractAligoTemplateItems(body)) {
    const normalizedTemplate = normalizeAligoTemplatePreview(item);
    if (normalizedTemplate?.templateCode === templateCode) {
      return normalizedTemplate;
    }
  }
  return null;
};

const extractAligoTemplateItems = (body: unknown): unknown[] => {
  if (!isRecord(body)) return [];
  const list = body.list;
  return Array.isArray(list) ? list : [];
};

const normalizeAligoTemplatePreview = (value: unknown): AligoTemplatePreview | null => {
  if (!isRecord(value)) return null;

  const templateCode = readFirstString(
    value,
    ["templtCode", "templateCode", "tplCode", "tpl_code"],
  );
  if (!templateCode) return null;

  return {
    templateCode,
    templateName: readFirstString(value, ["templtName", "templateName", "tplName", "tpl_name"]),
    approvedTemplate: readFirstRawString(value, [
      "templtContent",
      "templateContent",
      "tplContent",
      "tpl_content",
      "content",
      "message",
    ]),
    buttons: normalizeAligoPreviewButtons(value.buttons ?? value.button),
  };
};

const normalizeAligoPreviewButtons = (value: unknown): AligoRenderPreviewButton[] => {
  const source = unwrapAligoPreviewButtonSource(value);
  if (!Array.isArray(source)) return [];

  const buttons: AligoRenderPreviewButton[] = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const name = readFirstString(item, ["name", "buttonName", "button_name"]);
    const linkType = readFirstString(item, ["linkType", "linktype", "link_type"]);
    if (!name || !linkType) continue;

    const linkMo = readFirstString(item, ["linkMo", "link_mo", "linkMobile"]);
    buttons.push(linkMo ? { name, linkType, linkMo } : { name, linkType });
  }

  return buttons;
};

const unwrapAligoPreviewButtonSource = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (Array.isArray(value.button)) return value.button;
    if (Array.isArray(value.buttons)) return value.buttons;
    return [];
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    return unwrapAligoPreviewButtonSource(JSON.parse(trimmed));
  } catch {
    return [];
  }
};

const extractAligoTemplateVariables = (templateContent: string): string[] => {
  const variables: string[] = [];
  const seen = new Set<string>();

  for (const match of templateContent.matchAll(/#\{([^}]+)\}/g)) {
    const variableName = match[1]?.trim() ?? "";
    if (!variableName || seen.has(variableName)) continue;
    seen.add(variableName);
    variables.push(variableName);
  }

  return variables;
};

const renderApprovedAligoTemplate = (
  templateContent: string,
  variables: Record<string, string>,
): string => {
  return templateContent.replace(/#\{([^}]+)\}/g, (match, variableName: string) => {
    const normalizedVariableName = variableName.trim();
    if (!Object.prototype.hasOwnProperty.call(variables, normalizedVariableName)) {
      return match;
    }
    return variables[normalizedVariableName] ?? "";
  });
};

const normalizeAligoPreviewVariables = (
  variables?: Record<string, string>,
): Record<string, string> => {
  if (!variables) return {};

  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(variables)) {
    const normalizedKey = rawKey.trim();
    if (!normalizedKey) continue;
    normalized[normalizedKey] = rawValue;
  }
  return normalized;
};

const readFirstString = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return "";
};

const readFirstRawString = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
